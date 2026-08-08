/* =========================================================================
   Werwölfe von Düsterwald — Spiellogik
   =========================================================================
   Aufgeteilt nach Verantwortung:
     ROLLEN      – Stammdaten aller Rollen
     verteilung  – Balance: wer ist bei wie vielen Spielern dabei
     EREIGNISSE  – Zufallsereignisse mit ihren Auswirkungen
     Spiel       – Zustandsmaschine (Nacht -> Tag -> Abstimmung -> ...)
     Erzähler    – Sprachausgabe
   Die Oberfläche (oberflaeche.js) liest nur, sie rechnet nichts.
   ========================================================================= */

"use strict";

/* ---------------------------------------------------------------- Rollen */

const TEAM = { DORF: "dorf", WOLF: "wolf", SOLO: "solo" };

const ROLLEN = {
  werwolf: {
    name: "Werwolf", team: TEAM.WOLF, symbol: "🐺",
    kurz: "Reißt jede Nacht gemeinsam mit dem Rudel ein Opfer.",
    text: "Du bist ein Werwolf. Nachts wählst du mit dem Rudel ein Opfer. " +
          "Tagsüber tust du so, als wärst du harmlos.",
    nachtaktion: "wolf_opfer", reihenfolge: 30,
  },
  dorfbewohner: {
    name: "Dorfbewohner", team: TEAM.DORF, symbol: "🧑‍🌾",
    kurz: "Keine Sonderfähigkeit — aber eine Stimme und einen Verstand.",
    text: "Du bist ein einfacher Dorfbewohner. Deine Waffe ist das Gespräch.",
    nachtaktion: null,
  },
  seherin: {
    name: "Seherin", team: TEAM.DORF, symbol: "🔮",
    kurz: "Erfährt jede Nacht die Rolle eines Mitspielers.",
    text: "Du bist die Seherin. Jede Nacht darfst du eine Person durchschauen.",
    nachtaktion: "sehen", reihenfolge: 20,
  },
  hexe: {
    name: "Hexe", team: TEAM.DORF, symbol: "🧪",
    kurz: "Ein Heiltrank, ein Gifttrank — je einmal im ganzen Spiel.",
    text: "Du bist die Hexe. Du besitzt einen Heiltrank und einen Gifttrank. " +
          "Jeden nur ein einziges Mal.",
    nachtaktion: "hexe", reihenfolge: 40,
  },
  jaeger: {
    name: "Jäger", team: TEAM.DORF, symbol: "🏹",
    kurz: "Stirbt er, reißt sein letzter Schuss jemanden mit.",
    text: "Du bist der Jäger. Wenn du stirbst, nimmst du eine Person mit ins Grab.",
    nachtaktion: null,
  },
  beschuetzer: {
    name: "Beschützer", team: TEAM.DORF, symbol: "🛡️",
    kurz: "Schützt nachts eine Person — nie zweimal dieselbe hintereinander.",
    text: "Du bist der Beschützer. Jede Nacht stellst du dich vor eine Person. " +
          "Zweimal hintereinander dieselbe geht nicht.",
    nachtaktion: "schuetzen", reihenfolge: 10,
  },
  amor: {
    name: "Amor", team: TEAM.DORF, symbol: "💘",
    kurz: "Verkuppelt in der ersten Nacht zwei Menschen auf Leben und Tod.",
    text: "Du bist Amor. In der ersten Nacht bestimmst du ein Liebespaar. " +
          "Stirbt einer von beiden, stirbt auch der andere vor Kummer.",
    nachtaktion: "amor", reihenfolge: 5, nurErsteNacht: true,
  },
  narr: {
    name: "Dorfnarr", team: TEAM.SOLO, symbol: "🃏",
    kurz: "Gewinnt allein, wenn das Dorf ihn am Tag hinrichtet.",
    text: "Du bist der Dorfnarr. Wirst du vom Dorf gelyncht, gewinnst du auf der Stelle. " +
          "Also mach dich verdächtig — aber nicht zu offensichtlich.",
    nachtaktion: null,
  },
};

/* --------------------------------------------------------- Balance-Tabelle
   Faustregel: rund ein Wolf auf vier Spieler. Sonderrollen kommen gestaffelt
   dazu, damit kleine Runden nicht von Fähigkeiten erschlagen werden.
   Getestet mit `pruefeBalance()` weiter unten.                              */

function verteilung(anzahl, optionen = {}) {
  if (anzahl < 4) throw new Error("Mindestens 4 Spieler.");

  const woelfe = anzahl <= 5 ? 1
    : anzahl <= 11 ? 2
      : anzahl <= 15 ? 3
        : Math.min(4 + Math.floor((anzahl - 16) / 5), Math.floor(anzahl / 4));

  const rollen = Array(woelfe).fill("werwolf");
  rollen.push("seherin");                                   // ab 4
  if (anzahl >= 6) rollen.push("hexe");
  if (anzahl >= 7) rollen.push("jaeger");
  if (anzahl >= 9) rollen.push("beschuetzer");
  if (anzahl >= 10 && optionen.amor !== false) rollen.push("amor");
  if (anzahl >= 12 && optionen.narr) rollen.push("narr");

  while (rollen.length < anzahl) rollen.push("dorfbewohner");
  if (rollen.length > anzahl) rollen.length = anzahl;       // Sicherheitsnetz
  return rollen;
}

/** Prüft, dass keine Runde entgleist: Wölfe nie ≥ halbes Dorf, immer
 *  mindestens ein einfacher Dorfbewohner als Puffer ab 8 Spielern. */
function pruefeBalance() {
  const fehler = [];
  for (let n = 4; n <= 30; n++) {
    const r = verteilung(n, { narr: true });
    const w = r.filter((x) => x === "werwolf").length;
    if (r.length !== n) fehler.push(`${n}: ${r.length} Rollen verteilt`);
    if (w * 2 >= n) fehler.push(`${n}: ${w} Wölfe sind zu viele`);
    if (w < 1) fehler.push(`${n}: kein Wolf`);
    if (n >= 8 && !r.includes("dorfbewohner")) fehler.push(`${n}: kein einfacher Dorfbewohner`);
  }
  return fehler;
}

/* ------------------------------------------------------- Zufallsereignisse
   Jedes Ereignis beschreibt sich selbst und trägt seine Wirkung als Marke
   ("wirkung"), die die Zustandsmaschine auswertet. Neue Ereignisse brauchen
   deshalb nur hier einen Eintrag.                                           */

const EREIGNISSE = [
  {
    id: "verschlafen", titel: "Ein langer Schlaf", gewicht: 3, phase: "tag",
    text: (n) => `${n} hat die halbe Nacht wach gelegen und verschläft nun den ganzen Tag. ` +
                 `${n} bekommt vom Dorfgespräch nichts mit und darf heute nicht mitreden — ` +
                 `wählen aber schon.`,
    wirkung: "stumm", brauchtSpieler: true,
  },
  {
    id: "vollmond", titel: "Vollmond", gewicht: 2, phase: "nacht",
    text: () => "Der Mond steht voll über Düsterwald. Das Rudel ist außer sich vor Hunger — " +
                "in dieser Nacht reißt es zwei Opfer.",
    wirkung: "doppelriss",
  },
  {
    id: "nebel", titel: "Dichter Nebel", gewicht: 2, phase: "nacht",
    text: () => "Ein Nebel liegt so dicht über dem Dorf, dass selbst die Seherin nichts erkennt. " +
                "Ihre Vision bleibt heute Nacht leer.",
    wirkung: "blind",
  },
  {
    id: "sturm", titel: "Sturmnacht", gewicht: 2, phase: "tag",
    text: () => "Ein Sturm peitscht durch die Gassen. Niemand traut sich, offen zu sprechen — " +
                "die heutige Abstimmung erfolgt geheim.",
    wirkung: "geheimwahl",
  },
  {
    id: "fest", titel: "Erntedankfest", gewicht: 1, phase: "tag",
    text: () => "Das Dorf feiert Erntedank. Bei Wein und Musik bringt niemand es übers Herz, " +
                "jemanden an den Galgen zu schicken. Heute wird nicht gerichtet.",
    wirkung: "keinewahl",
  },
  {
    id: "kraehen", titel: "Die Krähen", gewicht: 3, phase: "tag",
    text: (n) => `Drei Krähen haben die ganze Nacht auf ${n}s Dach gesessen. ` +
                 `Das Dorf hält das für ein Zeichen: ${n} beginnt den Tag mit einer Stimme gegen sich.`,
    wirkung: "vorstimme", brauchtSpieler: true,
  },
  {
    id: "aeltester", titel: "Der Rat des Ältesten", gewicht: 2, phase: "tag",
    text: (n) => `Der Älteste des Dorfes vertraut ${n}. ` +
                 `${n}s Stimme zählt heute doppelt.`,
    wirkung: "doppelstimme", brauchtSpieler: true,
  },
  {
    id: "wanderer", titel: "Ein Wanderer", gewicht: 2, phase: "tag",
    text: () => "Ein Wanderer zieht durchs Dorf und erzählt, er habe in der Nacht " +
                "genau zwei Gestalten am Waldrand gesehen. Mehr weiß er nicht.",
    wirkung: "hinweis_wolfzahl",
  },
  {
    id: "stille", titel: "Eine ruhige Nacht", gewicht: 4, phase: "nacht",
    text: () => "Nichts Ungewöhnliches geschieht. Der Wald schweigt.",
    wirkung: null,
  },
  {
    id: "ruhigertag", titel: "Ein gewöhnlicher Tag", gewicht: 5, phase: "tag",
    text: () => "Der Tag beginnt wie jeder andere. Kein Omen, kein Zeichen.",
    wirkung: null,
  },
];

function zieheEreignis(phase, zufall = Math.random) {
  const passend = EREIGNISSE.filter((e) => e.phase === phase);
  const summe = passend.reduce((s, e) => s + e.gewicht, 0);
  let w = zufall() * summe;
  for (const e of passend) {
    w -= e.gewicht;
    if (w <= 0) return e;
  }
  return passend[passend.length - 1];
}

/* ------------------------------------------------------------------ Spiel */

class Spiel {
  constructor(namen, optionen = {}) {
    this.optionen = { ereignisse: true, narr: false, ...optionen };
    const rollen = verteilung(namen.length, this.optionen);
    this.mischen(rollen);

    this.spieler = namen.map((name, i) => ({
      id: i, name, rolle: rollen[i], lebt: true,
      verliebt: false, todesgrund: null,
    }));

    this.runde = 0;
    this.phase = "vorbereitung";          // vorbereitung|nacht|tag|wahl|ende
    this.protokoll = [];
    this.ereignis = null;
    this.marken = new Set();              // aktive Wirkungen dieser Phase
    this.betroffener = null;              // Spieler des aktuellen Ereignisses
    this.heiltrank = true;
    this.gifttrank = true;
    this.zuletztGeschuetzt = null;
    this.liebespaar = [];
    this.gewinner = null;
    this.offenerJaeger = null;            // Jäger darf noch schießen
  }

  mischen(feld) {                          // Fisher-Yates
    for (let i = feld.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [feld[i], feld[j]] = [feld[j], feld[i]];
    }
    return feld;
  }

  /* ---- Abfragen ---- */
  lebende() { return this.spieler.filter((s) => s.lebt); }
  mitRolle(r) { return this.lebende().filter((s) => s.rolle === r); }
  woelfe() { return this.mitRolle("werwolf"); }
  spielerVon(id) { return this.spieler.find((s) => s.id === Number(id)); }
  hatMarke(m) { return this.marken.has(m); }

  notiz(text, art = "info") {
    this.protokoll.push({ runde: this.runde, phase: this.phase, text, art });
  }

  /* ---- Ablauf ---- */

  starteNacht() {
    this.runde += 1;
    this.phase = "nacht";
    this.marken.clear();
    this.betroffener = null;
    this.opferDerNacht = [];
    this.geschuetzt = null;
    this.sicht = null;

    if (this.optionen.ereignisse && this.runde > 1) this.wuerfleEreignis("nacht");
    this.notiz(`Nacht ${this.runde} bricht an.`, "phase");
    return this.naechsteNachtaktion();
  }

  wuerfleEreignis(phase) {
    const e = zieheEreignis(phase);
    this.ereignis = e;
    if (e.brauchtSpieler) {
      const kandidaten = this.lebende();
      this.betroffener = kandidaten[Math.floor(Math.random() * kandidaten.length)];
    }
    if (e.wirkung) this.marken.add(e.wirkung);
    this.notiz(e.text(this.betroffener ? this.betroffener.name : ""), "ereignis");
    return e;
  }

  /** Liefert die nächste offene Nachtaktion oder null, wenn die Nacht durch ist. */
  naechsteNachtaktion() {
    const offen = Object.entries(ROLLEN)
      .filter(([id, r]) => r.nachtaktion)
      .filter(([id, r]) => !r.nurErsteNacht || this.runde === 1)
      .filter(([id]) => this.mitRolle(id).length > 0)
      .filter(([id]) => !this.erledigt?.has(id))
      .sort((a, b) => a[1].reihenfolge - b[1].reihenfolge);
    if (!this.erledigt) this.erledigt = new Set();
    if (offen.length === 0) return null;
    const [id, rolle] = offen[0];
    if (id === "seherin" && this.hatMarke("blind")) {   // Nebel: übersprungen
      this.erledigt.add(id);
      this.notiz("Die Seherin sieht im Nebel nichts.", "aktion");
      return this.naechsteNachtaktion();
    }
    return { rollenId: id, rolle, akteure: this.mitRolle(id) };
  }

  fuehreAus(rollenId, daten) {
    if (!this.erledigt) this.erledigt = new Set();
    switch (rollenId) {
      case "amor": {
        const [a, b] = daten.ziele.map((id) => this.spielerVon(id));
        a.verliebt = b.id; b.verliebt = a.id;
        this.liebespaar = [a.id, b.id];
        this.notiz(`Amor verbindet ${a.name} und ${b.name}.`, "aktion");
        break;
      }
      case "schuetzen": {
        const z = this.spielerVon(daten.ziel);
        this.geschuetzt = z.id;
        this.zuletztGeschuetzt = z.id;
        this.notiz(`Der Beschützer wacht über ${z.name}.`, "aktion");
        break;
      }
      case "sehen": {
        const z = this.spielerVon(daten.ziel);
        this.sicht = { name: z.name, rolle: ROLLEN[z.rolle].name };
        this.notiz(`Die Seherin durchschaut ${z.name}: ${ROLLEN[z.rolle].name}.`, "geheim");
        break;
      }
      case "wolf_opfer": {
        const ziele = (daten.ziele || [daten.ziel]).map((id) => this.spielerVon(id));
        for (const z of ziele) {
          if (z.id === this.geschuetzt) {
            this.notiz(`Das Rudel greift ${z.name} an — der Beschützer hält stand.`, "aktion");
          } else {
            this.opferDerNacht.push(z.id);
            this.notiz(`Das Rudel reißt ${z.name}.`, "aktion");
          }
        }
        break;
      }
      case "hexe": {
        if (daten.heilen && this.heiltrank) {
          this.heiltrank = false;
          this.opferDerNacht = this.opferDerNacht.filter((id) => id !== Number(daten.heilen));
          this.notiz(`Die Hexe rettet ${this.spielerVon(daten.heilen).name}.`, "aktion");
        }
        if (daten.giften && this.gifttrank) {
          this.gifttrank = false;
          this.opferDerNacht.push(Number(daten.giften));
          this.notiz(`Die Hexe vergiftet ${this.spielerVon(daten.giften).name}.`, "aktion");
        }
        break;
      }
    }
    this.erledigt.add(rollenId);
    return this.naechsteNachtaktion();
  }

  /** Nacht abschließen, Tote ermitteln, in den Tag wechseln. */
  starteTag() {
    this.erledigt = new Set();
    const tote = [];
    for (const id of new Set(this.opferDerNacht)) {
      tote.push(...this.toeten(id, "in der Nacht"));
    }
    this.phase = "tag";
    this.marken.clear();
    this.betroffener = null;
    if (this.optionen.ereignisse) this.wuerfleEreignis("tag");
    this.notiz(`Tag ${this.runde} beginnt.`, "phase");
    this.pruefeEnde();
    return tote;
  }

  /** Tötet einen Spieler und löst Folgetode aus (Liebespaar, Jäger). */
  toeten(id, grund) {
    const s = this.spielerVon(id);
    if (!s || !s.lebt) return [];
    s.lebt = false; s.todesgrund = grund;
    const tote = [s];
    this.notiz(`${s.name} stirbt (${ROLLEN[s.rolle].name}).`, "tod");

    if (s.rolle === "jaeger") this.offenerJaeger = s.id;

    if (s.verliebt !== false) {
      const p = this.spielerVon(s.verliebt);
      if (p && p.lebt) {
        this.notiz(`${p.name} stirbt aus Kummer.`, "tod");
        tote.push(...this.toeten(p.id, "aus Liebeskummer"));
      }
    }
    return tote;
  }

  jaegerSchiesst(zielId) {
    const tote = this.toeten(zielId, "vom letzten Schuss des Jägers");
    this.offenerJaeger = null;
    this.pruefeEnde();
    return tote;
  }

  /** Abstimmung. stimmen = { waehlerId: gewaehlterId }. */
  werteWahlAus(stimmen) {
    if (this.hatMarke("keinewahl")) {
      this.notiz("Das Fest verhindert jede Hinrichtung.", "phase");
      return { hingerichtet: null, tote: [], zaehlung: {} };
    }
    const zaehlung = {};
    if (this.hatMarke("vorstimme") && this.betroffener) {
      zaehlung[this.betroffener.id] = 1;
    }
    for (const [waehler, gewaehlt] of Object.entries(stimmen)) {
      if (gewaehlt === "" || gewaehlt == null) continue;
      const gewicht = (this.hatMarke("doppelstimme") && this.betroffener &&
                       Number(waehler) === this.betroffener.id) ? 2 : 1;
      zaehlung[gewaehlt] = (zaehlung[gewaehlt] || 0) + gewicht;
    }
    const max = Math.max(0, ...Object.values(zaehlung));
    const spitze = Object.keys(zaehlung).filter((id) => zaehlung[id] === max);
    if (max === 0 || spitze.length !== 1) {
      this.notiz("Das Dorf kann sich nicht einigen. Niemand stirbt.", "phase");
      return { hingerichtet: null, tote: [], zaehlung, gleichstand: spitze.length > 1 };
    }
    const opfer = this.spielerVon(spitze[0]);

    if (opfer.rolle === "narr") {
      opfer.lebt = false; opfer.todesgrund = "vom Dorf gelyncht";
      this.gewinner = { team: TEAM.SOLO, wer: [opfer], grund:
        `${opfer.name} war der Dorfnarr — und wollte genau das.` };
      this.phase = "ende";
      return { hingerichtet: opfer, tote: [opfer], zaehlung };
    }
    const tote = this.toeten(opfer.id, "vom Dorf gelyncht");
    this.pruefeEnde();
    return { hingerichtet: opfer, tote, zaehlung };
  }

  pruefeEnde() {
    if (this.gewinner) return this.gewinner;
    const lebend = this.lebende();
    const w = lebend.filter((s) => ROLLEN[s.rolle].team === TEAM.WOLF);
    const rest = lebend.filter((s) => ROLLEN[s.rolle].team !== TEAM.WOLF);

    // Liebespaar über die Fronten hinweg: die beiden gewinnen allein.
    if (this.liebespaar.length === 2) {
      const [a, b] = this.liebespaar.map((id) => this.spielerVon(id));
      if (a.lebt && b.lebt && lebend.length === 2 &&
          ROLLEN[a.rolle].team !== ROLLEN[b.rolle].team) {
        this.gewinner = { team: TEAM.SOLO, wer: [a, b],
          grund: "Das Liebespaar bleibt allein zurück und gewinnt gemeinsam." };
        this.phase = "ende";
        return this.gewinner;
      }
    }
    if (w.length === 0) {
      this.gewinner = { team: TEAM.DORF, wer: rest,
        grund: "Der letzte Werwolf ist tot. Düsterwald ist frei." };
      this.phase = "ende";
    } else if (w.length >= rest.length) {
      this.gewinner = { team: TEAM.WOLF, wer: w,
        grund: "Die Wölfe sind in der Überzahl. Das Dorf ist verloren." };
      this.phase = "ende";
    }
    return this.gewinner;
  }
}

/* -------------------------------------------------------------- Erzähler */

class Erzaehler {
  constructor() {
    this.an = true;
    this.stimme = null;
    this.tempo = 0.95;
    if ("speechSynthesis" in window) {
      const laden = () => {
        const alle = speechSynthesis.getVoices();
        this.stimme = alle.find((s) => /de[-_]DE/i.test(s.lang) && /male|mann|conrad|stefan/i.test(s.name))
                   || alle.find((s) => /^de/i.test(s.lang))
                   || null;
      };
      laden();
      speechSynthesis.onvoiceschanged = laden;
    }
  }
  verfuegbar() { return "speechSynthesis" in window; }
  sprich(text) {
    if (!this.an || !this.verfuegbar() || !text) return;
    speechSynthesis.cancel();
    const a = new SpeechSynthesisUtterance(text);
    a.lang = "de-DE"; a.rate = this.tempo; a.pitch = 0.9;
    if (this.stimme) a.voice = this.stimme;
    speechSynthesis.speak(a);
  }
  schweig() { if (this.verfuegbar()) speechSynthesis.cancel(); }
}

if (typeof module !== "undefined") {
  module.exports = { ROLLEN, TEAM, verteilung, pruefeBalance, EREIGNISSE,
                     zieheEreignis, Spiel };
}
