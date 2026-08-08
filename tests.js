/* =========================================================================
   Tests — laufen ohne Browser:  node tests.js
   Prüfen Balance, Siegbedingungen, Sonderrollen und Ereignis-Wirkungen.
   ========================================================================= */

"use strict";
global.window = { speechSynthesis: undefined };
const { ROLLEN, TEAM, verteilung, pruefeBalance, EREIGNISSE, zieheEreignis, Spiel } =
  require("./spiel.js");

let bestanden = 0, gefallen = 0;
function pruefe(name, bedingung, zusatz = "") {
  if (bedingung) { bestanden++; console.log("  ✔", name); }
  else { gefallen++; console.log("  ✘", name, zusatz); }
}
function block(t) { console.log("\n" + t); }

/* ------------------------------------------------------------ Balance */
block("Balance");
const fehler = pruefeBalance();
pruefe("Verteilung 4–30 Spieler ist stimmig", fehler.length === 0, fehler.join(" | "));

for (const n of [4, 6, 8, 12, 18, 25]) {
  const r = verteilung(n, { narr: true });
  const w = r.filter((x) => x === "werwolf").length;
  pruefe(`${n} Spieler → ${w} Wölfe (${(w / n * 100).toFixed(0)} %)`,
         w / n >= 0.15 && w / n <= 0.34, `${w}/${n}`);
}
pruefe("Unter 4 Spielern wird abgelehnt", (() => {
  try { verteilung(3); return false; } catch { return true; }
})());

/* ------------------------------------------- Siegbedingung: Dorf gewinnt */
block("Siegbedingungen");
{
  const s = new Spiel(["A", "B", "C", "D", "E", "F"]);
  s.spieler.forEach((p, i) => { p.rolle = i < 2 ? "werwolf" : "dorfbewohner"; });
  s.woelfe().forEach((w) => s.toeten(w.id, "Test"));
  s.pruefeEnde();
  pruefe("Alle Wölfe tot → Dorf gewinnt", s.gewinner && s.gewinner.team === TEAM.DORF);
}
{
  const s = new Spiel(["A", "B", "C", "D", "E", "F"]);
  s.spieler.forEach((p, i) => { p.rolle = i < 2 ? "werwolf" : "dorfbewohner"; });
  s.spieler.filter((p) => p.rolle === "dorfbewohner").slice(0, 3)
    .forEach((d) => s.toeten(d.id, "Test"));
  s.pruefeEnde();
  pruefe("Wölfe ≥ Rest → Wölfe gewinnen", s.gewinner && s.gewinner.team === TEAM.WOLF);
}
{
  const s = new Spiel(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"], { narr: true });
  s.spieler.forEach((p, i) => { p.rolle = i === 0 ? "narr" : i < 4 ? "werwolf" : "dorfbewohner"; });
  const narr = s.spieler[0];
  const stimmen = {};
  s.lebende().filter((x) => x.id !== narr.id).forEach((x) => { stimmen[x.id] = String(narr.id); });
  s.werteWahlAus(stimmen);
  pruefe("Gelynchter Dorfnarr gewinnt allein",
         s.gewinner && s.gewinner.team === TEAM.SOLO && s.gewinner.wer[0].id === narr.id);
}

/* --------------------------------------------------------- Sonderrollen */
block("Sonderrollen");
{
  const s = new Spiel(["A", "B", "C", "D", "E", "F", "G", "H", "I"]);
  s.spieler.forEach((p, i) => {
    p.rolle = i < 2 ? "werwolf" : i === 2 ? "beschuetzer" : "dorfbewohner";
  });
  s.starteNacht();
  const opfer = s.spieler[5];
  s.fuehreAus("schuetzen", { ziel: opfer.id });
  s.fuehreAus("wolf_opfer", { ziele: [opfer.id] });
  pruefe("Beschützer verhindert den Riss", s.opferDerNacht.length === 0);
}
{
  const s = new Spiel(["A", "B", "C", "D", "E", "F", "G"]);
  s.spieler.forEach((p, i) => { p.rolle = i < 2 ? "werwolf" : i === 2 ? "hexe" : "dorfbewohner"; });
  s.starteNacht();
  const opfer = s.spieler[4];
  s.fuehreAus("wolf_opfer", { ziele: [opfer.id] });
  s.fuehreAus("hexe", { heilen: opfer.id, giften: null });
  pruefe("Heiltrank rettet das Opfer", s.opferDerNacht.length === 0);
  pruefe("Heiltrank ist danach aufgebraucht", s.heiltrank === false);
}
{
  const s = new Spiel(["A", "B", "C", "D", "E", "F", "G", "H"]);
  s.spieler.forEach((p, i) => { p.rolle = i < 2 ? "werwolf" : i === 2 ? "jaeger" : "dorfbewohner"; });
  const jaeger = s.spieler[2];
  s.toeten(jaeger.id, "Test");
  pruefe("Toter Jäger darf noch schießen", s.offenerJaeger === jaeger.id);
  const ziel = s.lebende()[0];
  s.jaegerSchiesst(ziel.id);
  pruefe("Jägerschuss tötet das Ziel", !s.spielerVon(ziel.id).lebt);
}
{
  const s = new Spiel(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
  s.spieler.forEach((p, i) => { p.rolle = i < 2 ? "werwolf" : i === 2 ? "amor" : "dorfbewohner"; });
  s.starteNacht();
  const [a, b] = [s.spieler[4], s.spieler[5]];
  s.fuehreAus("amor", { ziele: [a.id, b.id] });
  s.toeten(a.id, "Test");
  pruefe("Stirbt ein Liebender, stirbt auch der andere", !s.spielerVon(b.id).lebt);
}

/* ----------------------------------------------------------- Ereignisse */
block("Zufallsereignisse");
pruefe("Jedes Ereignis hat Titel, Text und Phase",
  EREIGNISSE.every((e) => e.titel && typeof e.text === "function" && ["tag", "nacht"].includes(e.phase)));
pruefe("Jedes Ereignis hat ein positives Gewicht",
  EREIGNISSE.every((e) => e.gewicht > 0));
pruefe("Ereignisse mit Spielerbezug nennen den Namen im Text",
  EREIGNISSE.filter((e) => e.brauchtSpieler).every((e) => e.text("Testname").includes("Testname")));
{
  const gezogen = new Set();
  for (let i = 0; i < 4000; i++) gezogen.add(zieheEreignis("tag").id);
  const tagE = EREIGNISSE.filter((e) => e.phase === "tag").map((e) => e.id);
  pruefe("Alle Tag-Ereignisse werden auch gezogen",
         tagE.every((id) => gezogen.has(id)), [...gezogen].join(","));
  pruefe("Nur Tag-Ereignisse in der Tagphase",
         [...gezogen].every((id) => tagE.includes(id)));
}
{
  const s = new Spiel(["A", "B", "C", "D", "E", "F", "G", "H"]);
  s.spieler.forEach((p, i) => { p.rolle = i < 2 ? "werwolf" : "dorfbewohner"; });
  s.marken.add("keinewahl");
  const vorher = s.lebende().length;
  s.werteWahlAus({ 0: "3", 1: "3", 2: "3" });
  pruefe("Erntedankfest verhindert die Hinrichtung", s.lebende().length === vorher);
}
{
  const s = new Spiel(["A", "B", "C", "D", "E", "F", "G", "H"]);
  s.spieler.forEach((p, i) => { p.rolle = i < 2 ? "werwolf" : "dorfbewohner"; });
  s.marken.add("vorstimme");
  s.betroffener = s.spieler[7];
  const erg = s.werteWahlAus({});            // niemand stimmt ab
  pruefe("Krähen-Vorstimme allein reicht zur Hinrichtung",
         erg.hingerichtet && erg.hingerichtet.id === s.spieler[7].id);
}
{
  const s = new Spiel(["A", "B", "C", "D", "E", "F", "G", "H"]);
  s.spieler.forEach((p, i) => { p.rolle = i < 2 ? "werwolf" : "dorfbewohner"; });
  s.marken.add("doppelstimme");
  s.betroffener = s.spieler[0];
  // Eine doppelte Stimme schlaegt EINE einfache ...
  const erg = s.werteWahlAus({ 0: "5", 1: "6" });
  pruefe("Doppelstimme des Ältesten schlägt eine einfache",
         erg.hingerichtet && erg.hingerichtet.id === 5, JSON.stringify(erg.zaehlung));
}
{
  const s = new Spiel(["A", "B", "C", "D", "E", "F", "G", "H"]);
  s.spieler.forEach((p, i) => { p.rolle = i < 2 ? "werwolf" : "dorfbewohner"; });
  s.marken.add("doppelstimme");
  s.betroffener = s.spieler[0];
  // ... aber zwei einfache halten dagegen: Gleichstand, niemand stirbt.
  const erg = s.werteWahlAus({ 0: "5", 1: "6", 2: "6" });
  pruefe("Zwei einfache Stimmen halten der Doppelstimme stand (Gleichstand)",
         erg.hingerichtet === null && erg.gleichstand === true, JSON.stringify(erg.zaehlung));
}

/* ------------------------------------------------- Vollständige Partien */
block("Vollständige Partien (Zufallsspieler)");
function spielDurch(anzahl, runden = 60) {
  const namen = Array.from({ length: anzahl }, (_, i) => "S" + i);
  const s = new Spiel(namen, { ereignisse: true, narr: anzahl >= 12 });
  let schutz = 0;
  while (!s.gewinner && schutz++ < runden) {
    let a = s.starteNacht();
    let innen = 0;
    while (a && innen++ < 20) {
      const lebend = s.lebende();
      const zufall = (ohne = []) => {
        const m = lebend.filter((x) => !ohne.includes(x.id));
        return m.length ? m[Math.floor(Math.random() * m.length)].id : null;
      };
      const eigene = a.akteure.map((x) => x.id);
      if (a.rollenId === "amor") {
        const x = zufall(), y = zufall([x]);
        a = s.fuehreAus("amor", { ziele: [x, y] });
      } else if (a.rollenId === "wolf_opfer") {
        a = s.fuehreAus("wolf_opfer", { ziele: [zufall(eigene)].filter((v) => v !== null) });
      } else if (a.rollenId === "hexe") {
        a = s.fuehreAus("hexe", { heilen: null, giften: null });
      } else {
        a = s.fuehreAus(a.rollenId, { ziel: zufall(eigene) });
      }
    }
    s.starteTag();
    if (s.gewinner) break;
    while (s.offenerJaeger !== null && s.lebende().length) {
      s.jaegerSchiesst(s.lebende()[0].id);
    }
    if (s.gewinner) break;
    const stimmen = {};
    const lebend = s.lebende();
    for (const w of lebend) {
      const andere = lebend.filter((x) => x.id !== w.id);
      if (andere.length) stimmen[w.id] = String(andere[Math.floor(Math.random() * andere.length)].id);
    }
    s.werteWahlAus(stimmen);
    while (s.offenerJaeger !== null && s.lebende().length) {
      s.jaegerSchiesst(s.lebende()[0].id);
    }
  }
  return s;
}

const zaehler = { dorf: 0, wolf: 0, solo: 0, offen: 0 };
const laengen = [];
for (let i = 0; i < 300; i++) {
  const n = 5 + Math.floor(Math.random() * 14);
  const s = spielDurch(n);
  if (!s.gewinner) zaehler.offen++;
  else { zaehler[s.gewinner.team]++; laengen.push(s.runde); }
}
pruefe("Jede Partie endet (keine Endlosschleife)", zaehler.offen === 0, `offen: ${zaehler.offen}`);
const gesamt = zaehler.dorf + zaehler.wolf + zaehler.solo;
const dorfQuote = zaehler.dorf / gesamt;
console.log(`     Dorf ${(dorfQuote * 100).toFixed(0)} % · Wölfe ${(zaehler.wolf / gesamt * 100).toFixed(0)} % · ` +
            `allein ${(zaehler.solo / gesamt * 100).toFixed(0)} % · ` +
            `Ø ${(laengen.reduce((a, b) => a + b, 0) / laengen.length).toFixed(1)} Runden`);
pruefe("Beide Seiten gewinnen regelmäßig (bei Zufallszügen)",
       dorfQuote > 0.1 && dorfQuote < 0.9, `Dorf ${(dorfQuote * 100).toFixed(0)} %`);
pruefe("Partien dauern nicht ewig",
       laengen.reduce((a, b) => a + b, 0) / laengen.length < 15);

/* ------------------------------------------------------------ Konsistenz */
block("Konsistenz der Rollendaten");
pruefe("Jede Rolle hat Name, Team, Symbol und Text",
  Object.values(ROLLEN).every((r) => r.name && r.team && r.symbol && r.text && r.kurz));
pruefe("Nachtrollen haben eine Reihenfolge",
  Object.values(ROLLEN).filter((r) => r.nachtaktion).every((r) => typeof r.reihenfolge === "number"));
pruefe("Reihenfolgen sind eindeutig", (() => {
  const z = Object.values(ROLLEN).filter((r) => r.nachtaktion).map((r) => r.reihenfolge);
  return new Set(z).size === z.length;
})());

console.log(`\n${bestanden} bestanden, ${gefallen} gefallen`);
process.exit(gefallen ? 1 : 0);
