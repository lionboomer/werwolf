/* =========================================================================
   Oberfläche — zeichnet nur, entscheidet nichts.
   Jede Regel steckt in spiel.js; hier stehen ausschließlich Ansichten und
   die Reihenfolge, in der sie erscheinen.
   ========================================================================= */

"use strict";

const buehne = document.getElementById("buehne");
const erzaehler = new Erzaehler();
let spiel = null;
let namen = JSON.parse(localStorage.getItem("werwolf_namen") || "[]");
let ansicht = "start";
let zwischen = {};        // Zustand innerhalb einer Ansicht (Rollenvergabe usw.)

const h = (html) => { buehne.innerHTML = html; };
const sicher = (s) => String(s).replace(/[&<>"']/g,
  (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

function teamMarke(rollenId) {
  const t = ROLLEN[rollenId].team;
  const wort = t === TEAM.WOLF ? "Wölfe" : t === TEAM.DORF ? "Dorf" : "allein";
  return `<span class="marke ${t}">${wort}</span>`;
}

/* ------------------------------------------------------------ Startseite */

function zeigeStart() {
  ansicht = "start";
  const liste = namen.map((n, i) => `
    <div class="spieler">
      <span class="sym">🧑</span>
      <span class="name">${sicher(n)}</span>
      <button class="zweit" data-weg="${i}" aria-label="${sicher(n)} entfernen">✕</button>
    </div>`).join("");

  const genug = namen.length >= 4;
  const vor = genug ? verteilung(namen.length, { narr: document.getElementById("narr")?.checked })
                    : [];
  const zaehlung = {};
  vor.forEach((r) => { zaehlung[r] = (zaehlung[r] || 0) + 1; });
  const vorschau = genug
    ? Object.entries(zaehlung).map(([r, n]) =>
        `<div class="spieler"><span class="sym">${ROLLEN[r].symbol}</span>
         <span class="name">${n}× ${ROLLEN[r].name}</span>${teamMarke(r)}</div>`).join("")
    : `<p class="unter">Ab 4 Spielern zeigt sich hier die Rollenverteilung.</p>`;

  h(`
  <div class="karte">
    <h2>Wer spielt mit?</h2>
    <div class="reihe">
      <input id="neuerName" placeholder="Name eingeben" autocomplete="off" enterkeyhint="done">
      <button id="hinzu">+</button>
    </div>
    <div id="liste">${liste || '<p class="unter">Noch niemand dabei.</p>'}</div>
    <p class="unter">${namen.length} Spieler${namen.length ? "" : ""} · mindestens 4 nötig</p>
    ${namen.length ? '<button class="zweit gross" id="leeren">Liste leeren</button>' : ""}
  </div>

  <div class="karte hell">
    <h2>Einstellungen</h2>
    <div class="schalter">
      <input type="checkbox" id="ereignisse" checked>
      <label for="ereignisse">Zufallsereignisse (Vollmond, Nebel, Erntedankfest …)</label>
    </div>
    <div class="schalter">
      <input type="checkbox" id="narr">
      <label for="narr">Dorfnarr ab 12 Spielern — gewinnt allein, wenn er gelyncht wird</label>
    </div>
    <div class="schalter">
      <input type="checkbox" id="stimme" ${erzaehler.verfuegbar() ? "checked" : "disabled"}>
      <label for="stimme">Erzähler spricht${erzaehler.verfuegbar() ? "" : " — von diesem Browser nicht unterstützt"}</label>
    </div>
  </div>

  <div class="karte">
    <h2>Rollen in dieser Runde</h2>
    ${vorschau}
  </div>

  <button class="gross" id="los" ${genug ? "" : "disabled"}>Spiel starten</button>
  `);

  const feld = document.getElementById("neuerName");
  const dazu = () => {
    const n = feld.value.trim();
    if (!n) return;
    if (namen.some((x) => x.toLowerCase() === n.toLowerCase())) {
      feld.value = ""; return;
    }
    namen.push(n);
    localStorage.setItem("werwolf_namen", JSON.stringify(namen));
    zeigeStart();
    document.getElementById("neuerName").focus();
  };
  document.getElementById("hinzu").onclick = dazu;
  feld.onkeydown = (e) => { if (e.key === "Enter") dazu(); };
  buehne.querySelectorAll("[data-weg]").forEach((b) => {
    b.onclick = () => {
      namen.splice(Number(b.dataset.weg), 1);
      localStorage.setItem("werwolf_namen", JSON.stringify(namen));
      zeigeStart();
    };
  });
  const leeren = document.getElementById("leeren");
  if (leeren) leeren.onclick = () => { namen = []; localStorage.removeItem("werwolf_namen"); zeigeStart(); };
  document.getElementById("narr").onchange = zeigeStart;
  document.getElementById("stimme").onchange = (e) => { erzaehler.an = e.target.checked; };
  document.getElementById("los").onclick = () => {
    spiel = new Spiel(namen, {
      ereignisse: document.getElementById("ereignisse").checked,
      narr: document.getElementById("narr").checked,
    });
    erzaehler.an = document.getElementById("stimme").checked;
    zwischen = { index: 0, aufgedeckt: false };
    zeigeRollenvergabe();
  };
}

/* -------------------------------------------------------- Rollenvergabe */

function zeigeRollenvergabe() {
  ansicht = "vergabe";
  const s = spiel.spieler[zwischen.index];
  if (!s) { erzaehler.sprich("Alle kennen ihre Rolle. Die erste Nacht beginnt."); return zeigeNachtStart(); }

  if (!zwischen.aufgedeckt) {
    h(`<div class="karte rollenkarte">
        <div class="sym">📱</div>
        <div class="rname">${sicher(s.name)}</div>
        <p class="rtext">Nimm das Gerät und achte darauf, dass niemand mitliest.</p>
        <button class="gross" id="zeigen">Meine Rolle ansehen</button>
       </div>
       <p class="unter" style="text-align:center">Spieler ${zwischen.index + 1} von ${spiel.spieler.length}</p>`);
    document.getElementById("zeigen").onclick = () => { zwischen.aufgedeckt = true; zeigeRollenvergabe(); };
    return;
  }

  const r = ROLLEN[s.rolle];
  const rudel = r.team === TEAM.WOLF
    ? spiel.spieler.filter((x) => ROLLEN[x.rolle].team === TEAM.WOLF && x.id !== s.id)
    : [];
  h(`<div class="karte rollenkarte ${r.team === TEAM.WOLF ? "blut" : ""}">
      <div class="sym">${r.symbol}</div>
      <div class="rname">${r.name}</div>
      ${teamMarke(s.rolle)}
      <p class="rtext">${r.text}</p>
      ${rudel.length ? `<p class="rtext"><strong>Dein Rudel:</strong> ${rudel.map((x) => sicher(x.name)).join(", ")}</p>` : ""}
     </div>
     <button class="gross" id="weiter">Gemerkt — weitergeben</button>`);
  document.getElementById("weiter").onclick = () => {
    zwischen.index += 1; zwischen.aufgedeckt = false; zeigeRollenvergabe();
  };
}

/* ---------------------------------------------------------------- Nacht */

function zeigeNachtStart() {
  const text = `Die Sonne geht unter. Düsterwald schläft ein. Nacht ${spiel.runde + 1} beginnt. Alle schließen die Augen.`;
  h(`<div class="karte">
      <h2>🌙 Nacht ${spiel.runde + 1}</h2>
      <p>${text}</p>
      <p class="unter">Lest den Text laut vor — oder lasst den Erzähler sprechen.</p>
      <button class="gross" id="los">Nacht beginnen</button>
     </div>`);
  erzaehler.sprich(text);
  document.getElementById("los").onclick = () => {
    const aktion = spiel.starteNacht();
    zeigeNachtaktion(aktion);
  };
}

function zeigeNachtaktion(aktion) {
  ansicht = "nacht";
  if (!aktion) return zeigeTag();

  const { rollenId, rolle, akteure } = aktion;
  const wer = akteure.map((a) => sicher(a.name)).join(", ");
  const auswahl = (id, ohne = []) => `
    <select id="${id}">
      <option value="">— niemand —</option>
      ${spiel.lebende().filter((s) => !ohne.includes(s.id))
        .map((s) => `<option value="${s.id}">${sicher(s.name)}</option>`).join("")}
    </select>`;

  let inhalt = "";
  let ansage = "";

  if (rollenId === "amor") {
    ansage = "Amor, erwache. Wähle zwei Menschen, die sich von nun an lieben.";
    inhalt = `<label>Erste Person</label>${auswahl("a1")}
              <label>Zweite Person</label>${auswahl("a2")}`;
  } else if (rollenId === "beschuetzer") {
    ansage = "Beschützer, erwache. Wen bewachst du in dieser Nacht?";
    const ohne = spiel.zuletztGeschuetzt !== null ? [spiel.zuletztGeschuetzt] : [];
    inhalt = `<label>Beschützen</label>${auswahl("z", ohne)}
      ${ohne.length ? '<p class="unter">Die zuletzt geschützte Person steht nicht zur Wahl.</p>' : ""}`;
  } else if (rollenId === "sehen") {
    ansage = "Seherin, erwache. Wessen wahres Gesicht willst du sehen?";
    inhalt = `<label>Durchschauen</label>${auswahl("z", akteure.map((a) => a.id))}`;
  } else if (rollenId === "wolf_opfer") {
    const doppelt = spiel.hatMarke("doppelriss");
    ansage = doppelt
      ? "Werwölfe, erwacht. Der Vollmond treibt euch — wählt zwei Opfer."
      : "Werwölfe, erwacht. Wen reißt ihr in dieser Nacht?";
    inhalt = `<label>Opfer</label>${auswahl("z", akteure.map((a) => a.id))}
              ${doppelt ? `<label>Zweites Opfer (Vollmond)</label>${auswahl("z2", akteure.map((a) => a.id))}` : ""}`;
  } else if (rollenId === "hexe") {
    const opfer = spiel.opferDerNacht.map((id) => spiel.spielerVon(id));
    ansage = "Hexe, erwache. Du siehst, wen es in dieser Nacht getroffen hat.";
    inhalt = `
      <p>${opfer.length
        ? `Getroffen: <strong>${opfer.map((o) => sicher(o.name)).join(", ")}</strong>`
        : "Diese Nacht wurde niemand gerissen."}</p>
      ${spiel.heiltrank && opfer.length ? `
        <label>Heiltrank einsetzen (einmalig)</label>
        <select id="heilen"><option value="">— nein —</option>
        ${opfer.map((o) => `<option value="${o.id}">${sicher(o.name)} retten</option>`).join("")}</select>` : ""}
      ${spiel.gifttrank ? `<label>Gifttrank einsetzen (einmalig)</label>${auswahl("giften", akteure.map((a) => a.id))}` : ""}
      ${!spiel.heiltrank && !spiel.gifttrank ? '<p class="unter">Beide Tränke sind aufgebraucht.</p>' : ""}`;
  }

  h(`<div class="karte">
      <h2>${rolle.symbol} ${rolle.name}</h2>
      <p><strong>${wer}</strong></p>
      <p>${ansage}</p>
      ${spiel.ereignis && spiel.ereignis.wirkung && spiel.phase === "nacht" ? ereignisKarte() : ""}
      ${inhalt}
      <button class="gross" id="ok">Bestätigen</button>
     </div>`);
  erzaehler.sprich(ansage);

  document.getElementById("ok").onclick = () => {
    let daten = {};
    if (rollenId === "amor") {
      const a = document.getElementById("a1").value, b = document.getElementById("a2").value;
      if (!a || !b || a === b) { alert("Bitte zwei verschiedene Personen wählen."); return; }
      daten = { ziele: [a, b] };
    } else if (rollenId === "wolf_opfer") {
      const z = document.getElementById("z").value;
      const z2 = document.getElementById("z2")?.value;
      if (!z) { alert("Die Wölfe müssen ein Opfer wählen."); return; }
      daten = { ziele: z2 && z2 !== z ? [z, z2] : [z] };
    } else if (rollenId === "hexe") {
      daten = { heilen: document.getElementById("heilen")?.value || null,
                giften: document.getElementById("giften")?.value || null };
    } else {
      const z = document.getElementById("z").value;
      if (!z && rollenId === "sehen") { alert("Bitte eine Person wählen."); return; }
      daten = { ziel: z };
    }
    const naechste = spiel.fuehreAus(rollenId, daten);
    if (rollenId === "sehen" && spiel.sicht) return zeigeSicht(naechste);
    zeigeNachtaktion(naechste);
  };
}

function zeigeSicht(naechste) {
  h(`<div class="karte rollenkarte hell">
      <div class="sym">🔮</div>
      <div class="rname">${sicher(spiel.sicht.name)}</div>
      <p class="rtext">ist <strong>${spiel.sicht.rolle}</strong></p>
      <p class="unter">Nur die Seherin darf das sehen.</p>
     </div>
     <button class="gross" id="ok">Verstanden</button>`);
  document.getElementById("ok").onclick = () => zeigeNachtaktion(naechste);
}

/* ------------------------------------------------------------------ Tag */

function ereignisKarte() {
  const e = spiel.ereignis;
  if (!e) return "";
  return `<div class="ereignis"><h3>${e.titel}</h3>
          <p>${sicher(e.text(spiel.betroffener ? spiel.betroffener.name : ""))}</p></div>`;
}

function zeigeTag() {
  const tote = spiel.starteTag();
  ansicht = "tag";

  let text = `Der Morgen graut über Düsterwald. `;
  text += tote.length === 0
    ? "Und heute — heute hat niemand sein Leben gelassen."
    : tote.map((t) => `${t.name} liegt tot im Dorf. ${t.name} war ${ROLLEN[t.rolle].name}.`).join(" ");

  const wolfHinweis = spiel.hatMarke("hinweis_wolfzahl")
    ? `<p class="unter">Hinweis des Wanderers: Es leben aktuell <strong>${spiel.woelfe().length}</strong> Werwölfe.</p>` : "";

  h(`<div class="karte ${tote.length ? "blut" : ""}">
      <h2>☀️ Tag ${spiel.runde}</h2>
      <p>${sicher(text)}</p>
     </div>
     ${ereignisKarte()}
     ${wolfHinweis}
     ${spielerListe()}
     <button class="gross" id="weiter">${spiel.offenerJaeger !== null ? "Der Jäger schießt" : "Zur Abstimmung"}</button>
     ${protokollKarte()}`);

  erzaehler.sprich(text + " " + (spiel.ereignis ? spiel.ereignis.text(spiel.betroffener ? spiel.betroffener.name : "") : ""));

  document.getElementById("weiter").onclick = () => {
    if (spiel.gewinner) return zeigeEnde();
    if (spiel.offenerJaeger !== null) return zeigeJaeger();
    zeigeWahl();
  };
}

function zeigeJaeger() {
  const j = spiel.spielerVon(spiel.offenerJaeger);
  const ansage = `${j.name} war der Jäger. Mit letzter Kraft hebt ${j.name} die Armbrust.`;
  h(`<div class="karte warn">
      <h2>🏹 Der letzte Schuss</h2>
      <p>${sicher(ansage)}</p>
      <label>Wen nimmt ${sicher(j.name)} mit?</label>
      <select id="z">${spiel.lebende().map((s) =>
        `<option value="${s.id}">${sicher(s.name)}</option>`).join("")}</select>
      <button class="gross gefahr" id="ok">Schuss</button>
     </div>`);
  erzaehler.sprich(ansage);
  document.getElementById("ok").onclick = () => {
    spiel.jaegerSchiesst(document.getElementById("z").value);
    if (spiel.gewinner) return zeigeEnde();
    if (spiel.offenerJaeger !== null) return zeigeJaeger();
    zeigeWahl();
  };
}

function zeigeWahl() {
  ansicht = "wahl";
  if (spiel.hatMarke("keinewahl")) {
    const erg = spiel.werteWahlAus({});
    return zeigeWahlErgebnis(erg);
  }
  const geheim = spiel.hatMarke("geheimwahl");
  const stumm = spiel.hatMarke("stumm") ? spiel.betroffener : null;

  const zeilen = spiel.lebende().map((w) => `
    <div class="spieler">
      <span class="sym">🗳️</span>
      <span class="name">${sicher(w.name)}${stumm && stumm.id === w.id ? ' <span class="zusatz">(verschlafen)</span>' : ""}</span>
      <select data-waehler="${w.id}" style="flex:1">
        <option value="">— enthalten —</option>
        ${spiel.lebende().filter((z) => z.id !== w.id)
          .map((z) => `<option value="${z.id}">${sicher(z.name)}</option>`).join("")}
      </select>
    </div>`).join("");

  h(`<div class="karte">
      <h2>🗳️ Abstimmung — Tag ${spiel.runde}</h2>
      <p>Das Dorf entscheidet, wer an den Galgen kommt.</p>
      ${geheim ? '<p class="unter">Sturmnacht: Reicht das Gerät herum, damit niemand die Wahl der anderen sieht.</p>' : ""}
      ${spiel.hatMarke("vorstimme") && spiel.betroffener ? `<p class="unter">${sicher(spiel.betroffener.name)} startet mit einer Stimme gegen sich.</p>` : ""}
      ${spiel.hatMarke("doppelstimme") && spiel.betroffener ? `<p class="unter">${sicher(spiel.betroffener.name)}s Stimme zählt doppelt.</p>` : ""}
      ${zeilen}
      <button class="gross" id="ok">Auszählen</button>
     </div>`);
  erzaehler.sprich("Das Dorf stimmt ab. Wer soll sterben?");

  document.getElementById("ok").onclick = () => {
    const stimmen = {};
    buehne.querySelectorAll("[data-waehler]").forEach((s) => {
      stimmen[s.dataset.waehler] = s.value;
    });
    zeigeWahlErgebnis(spiel.werteWahlAus(stimmen));
  };
}

function zeigeWahlErgebnis(erg) {
  let text;
  if (!erg.hingerichtet) {
    text = erg.gleichstand
      ? "Stimmengleichheit. Das Dorf kann sich nicht einigen — heute stirbt niemand."
      : "Heute wird niemand gerichtet.";
  } else {
    const o = erg.hingerichtet;
    text = `${o.name} wird zum Galgen geführt. ${o.name} war ${ROLLEN[o.rolle].name}.`;
    const weitere = erg.tote.filter((t) => t.id !== o.id);
    if (weitere.length) text += " " + weitere.map((t) => `${t.name} folgt in den Tod.`).join(" ");
  }

  h(`<div class="karte ${erg.hingerichtet ? "blut" : ""}">
      <h2>⚖️ Urteil</h2>
      <p>${sicher(text)}</p>
     </div>
     ${spielerListe()}
     <button class="gross" id="weiter">Weiter</button>
     ${protokollKarte()}`);
  erzaehler.sprich(text);

  document.getElementById("weiter").onclick = () => {
    if (spiel.gewinner) return zeigeEnde();
    if (spiel.offenerJaeger !== null) return zeigeJaeger();
    zeigeNachtStart();
  };
}

/* ----------------------------------------------------------------- Ende */

function zeigeEnde() {
  const g = spiel.gewinner;
  const titel = g.team === TEAM.WOLF ? "🐺 Die Werwölfe gewinnen"
             : g.team === TEAM.DORF ? "🏡 Das Dorf gewinnt"
             : "🃏 Alleingang";
  h(`<div class="karte ${g.team === TEAM.WOLF ? "blut" : "warn"}">
      <h2>${titel}</h2>
      <p>${sicher(g.grund)}</p>
      <p><strong>${g.wer.map((s) => sicher(s.name)).join(", ")}</strong></p>
     </div>
     <div class="karte">
      <h2>Alle Rollen</h2>
      ${spiel.spieler.map((s) => `
        <div class="spieler ${s.lebt ? "" : "tot"}">
          <span class="sym">${ROLLEN[s.rolle].symbol}</span>
          <span class="name">${sicher(s.name)}</span>
          <span class="zusatz">${ROLLEN[s.rolle].name}${s.lebt ? "" : " · " + s.todesgrund}</span>
          ${teamMarke(s.rolle)}
        </div>`).join("")}
     </div>
     ${protokollKarte(true)}
     <button class="gross gut" id="neu">Neue Runde mit denselben Namen</button>
     <button class="gross zweit" id="start">Zurück zum Anfang</button>`);
  erzaehler.sprich(titel.replace(/[🐺🏡🃏]/g, "") + ". " + g.grund);

  document.getElementById("neu").onclick = () => {
    spiel = new Spiel(namen, spiel.optionen);
    zwischen = { index: 0, aufgedeckt: false };
    zeigeRollenvergabe();
  };
  document.getElementById("start").onclick = () => { spiel = null; zeigeStart(); };
}

/* ------------------------------------------------------------- Bausteine */

function spielerListe() {
  return `<div class="karte hell"><h3>Im Dorf</h3>
    ${spiel.spieler.map((s) => `
      <div class="spieler ${s.lebt ? "" : "tot"}">
        <span class="sym">${s.lebt ? "🧑" : "💀"}</span>
        <span class="name">${sicher(s.name)}</span>
        ${s.lebt ? "" : `<span class="zusatz">${ROLLEN[s.rolle].name} · ${s.todesgrund}</span>`}
      </div>`).join("")}
    <p class="unter">${spiel.lebende().length} von ${spiel.spieler.length} leben noch.</p>
  </div>`;
}

function protokollKarte(alles = false) {
  const eintraege = spiel.protokoll
    .filter((p) => alles || p.art !== "geheim")
    .slice(alles ? 0 : -14).reverse();
  return `<div class="karte hell"><h3>Chronik</h3>
    <div class="protokoll">${eintraege.map((p) =>
      `<div class="${p.art === "tod" ? "tod" : p.art === "ereignis" ? "ereignis-z"
        : p.art === "phase" ? "phase" : p.art === "geheim" ? "geheim" : ""}">${sicher(p.text)}</div>`
      ).join("")}</div></div>`;
}

/* ------------------------------------------------------------------ Start */

const balanceFehler = pruefeBalance();
if (balanceFehler.length) console.error("Balance-Prüfung fehlgeschlagen:", balanceFehler);
zeigeStart();
