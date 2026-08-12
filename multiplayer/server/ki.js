"use strict";
/* ---------------------------------------------------------------- KI-Bots ---
   Bots, die in der Tagesdiskussion mitreden und ihre Stimme begruenden.

   Die eine Regel, die alles traegt: EIN BOT DARF NUR WISSEN, WAS EIN MENSCH AN
   SEINER STELLE WUESSTE. Der Kontext wird deshalb pro Bot aus seinem eigenen
   Blickwinkel gebaut -- eigene Rolle, oeffentlicher Verlauf, Chat, und nur bei
   Werwoelfen die Mitwoelfe, nur bei der Seherin ihre eigenen Visionen. Ein Bot,
   der heimlich alle Rollen kennt, macht das Spiel wertlos; das waere kein
   cleverer Gegner, sondern ein Betrueger.

   Faellt OpenAI aus, kein Schluessel, Zeitueberschreitung: Das Spiel laeuft
   ohne KI weiter, die Bots ziehen dann wie vorher zufaellig aber regelkonform.
   Ein Partyspiel darf nie an einem fremden Dienst haengenbleiben.            */

const MODELL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const SCHLUESSEL = process.env.OPENAI_API_KEY || "";
const ZEITLIMIT = Number(process.env.OPENAI_TIMEOUT_MS || 12000);

function kiAktiv() { return Boolean(SCHLUESSEL); }

/* Charaktere. Sie geben den Bots eine erkennbare Stimme -- ohne sie klingen
   alle gleich und das Misstrauen hat keinen Ansatzpunkt. */
const CHARAKTERE = [
  { name: "misstrauisch", zug: "Du bist von Natur aus misstrauisch und sprichst Verdächtigungen offen aus. Kurz, direkt." },
  { name: "ruhig",        zug: "Du bist besonnen, wägst ab und mahnst zur Vorsicht, bevor jemand gehängt wird." },
  { name: "vorlaut",      zug: "Du redest schnell, machst Witze und wirfst gern steile Behauptungen in den Raum." },
  { name: "aengstlich",   zug: "Du bist nervös, suchst Schutz bei anderen und fragst viel nach." },
  { name: "analytisch",   zug: "Du zählst auf, wer wie abgestimmt hat, und leitest daraus ab. Nüchtern." },
  { name: "gesellig",     zug: "Du bist freundlich, nimmst Leute in Schutz und suchst nach Ausgleich." },
];

function charakterFuer(bot) {
  // Stabil an den Namen gebunden, damit ein Bot ueber die ganze Runde
  // derselbe Typ bleibt.
  let summe = 0;
  for (const z of String(bot.name)) summe += z.charCodeAt(0);
  return CHARAKTERE[summe % CHARAKTERE.length];
}

/* Was dieser eine Bot legitim weiss. */
function wissen(room, bot, hilfen) {
  const { aliveList, byId, ROLES } = hilfen;
  const lebend = aliveList(room);
  const w = {
    ichHeisse: bot.name,
    meineRolle: ROLES[bot.role] ? ROLES[bot.role].name : bot.role,
    tag: room.dayCount || 1,
    lebende: lebend.map((p) => p.name),
    tote: room.players.filter((p) => !p.alive).map((p) => p.name),
  };
  if (bot.role === "werwolf") {
    w.meineMitwoelfe = room.players
      .filter((p) => p.role === "werwolf" && p.id !== bot.id)
      .map((p) => p.name);
  }
  if (bot.role === "seherin" && Array.isArray(bot.visionen)) {
    w.meineVisionen = bot.visionen;          // [{name, rolle}]
  }
  if (bot.lover) {
    const l = byId(room, bot.lover);
    if (l) w.meinLiebespaar = l.name;
  }
  // Nur der oeffentliche Verlauf -- derselbe Text, den alle am Tisch hoeren.
  w.verlauf = (room.log || []).slice(-14).map((z) => z.text);
  w.gespraech = (room.chat || []).slice(-25).map((m) => `${m.name}: ${m.text}`);
  return w;
}

function systemText(room, bot, hilfen) {
  const ch = charakterFuer(bot);
  const wolf = bot.role === "werwolf";
  return [
    `Du spielst "Die Werwölfe von Schattenmoor" als Dorfbewohner namens ${bot.name}.`,
    `Deine Rolle: ${hilfen.ROLES[bot.role] ? hilfen.ROLES[bot.role].name : bot.role}.`,
    ch.zug,
    wolf
      ? "Du bist ein Werwolf. Du LÜGST über deine Rolle, lenkst Verdacht auf Unschuldige und schützt deine Mitwölfe, ohne sie offen zu verteidigen — das wäre zu auffällig."
      : "Du bist auf der Seite des Dorfes. Du willst die Werwölfe finden.",
    "Regeln für deine Antwort:",
    "- Sprich Deutsch, wie am Küchentisch. Keine Anführungszeichen, kein Rollenspiel-Sternchen.",
    "- HÖCHSTENS zwei Sätze. Lieber einer.",
    "- Sprich andere beim Namen an, wenn es passt.",
    "- Nenne NIEMALS Informationen, die du laut deinem Wissen nicht hast.",
    "- Behaupte nie, du seist die Seherin, wenn du es nicht bist — außer du bist ein Werwolf, dann darfst du bluffen.",
    "- Wiederhole dich nicht.",
    // Ohne diesen Satz stürzen sich alle Bots auf denselben Verdächtigen,
    // sobald einer angefangen hat. Das ist für Menschen am Tisch frustrierend
    // und macht jede Runde gleich.
    "- Denk selbst. Schließ dich NICHT einfach der Mehrheit an, nur weil andere jemanden verdächtigen — widersprich ruhig, wenn dir etwas zu einfach erscheint.",
  ].join("\n");
}

async function frageModell(system, benutzer, maxTokens) {
  const steuerung = new AbortController();
  const uhr = setTimeout(() => steuerung.abort(), ZEITLIMIT);
  try {
    const antwort = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: steuerung.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SCHLUESSEL}`,
      },
      body: JSON.stringify({
        model: MODELL,
        max_tokens: maxTokens,
        temperature: 0.95,
        messages: [
          { role: "system", content: system },
          { role: "user", content: benutzer },
        ],
      }),
    });
    if (!antwort.ok) {
      const text = await antwort.text();
      throw new Error(`OpenAI ${antwort.status}: ${text.slice(0, 160)}`);
    }
    const daten = await antwort.json();
    return (daten.choices?.[0]?.message?.content || "").trim();
  } finally {
    clearTimeout(uhr);
  }
}

/* Ein Diskussionsbeitrag. Gibt null zurueck, wenn nichts zu sagen ist oder die
   KI nicht erreichbar war -- der Aufrufer schweigt dann einfach. */
async function botBeitrag(room, bot, hilfen) {
  if (!kiAktiv()) return null;
  const w = wissen(room, bot, hilfen);
  const benutzer = [
    "Das ist alles, was du weißt:",
    JSON.stringify(w, null, 1),
    "",
    "Sag jetzt etwas in die Runde. Wenn schon jemand geredet hat, geh darauf ein.",
  ].join("\n");
  try {
    let text = await frageModell(systemText(room, bot, hilfen), benutzer, 90);
    text = text.replace(/^["'„»]|["'“«]$/g, "").replace(/\s+/g, " ").trim();
    if (text.toLowerCase().startsWith(bot.name.toLowerCase() + ":")) {
      text = text.slice(bot.name.length + 1).trim();
    }
    return text.slice(0, 320) || null;
  } catch (e) {
    console.warn("[ki] Beitrag fehlgeschlagen:", e.message);
    return null;
  }
}

/* Eine begruendete Stimme. Faellt auf null zurueck -- dann wuerfelt der Aufrufer
   wie bisher. Das Ergebnis wird gegen die erlaubten Ziele geprueft: Ein Modell,
   das einen Toten oder sich selbst nennt, darf das Spiel nicht kaputtmachen. */
async function botStimme(room, bot, erlaubteNamen, hilfen) {
  if (!kiAktiv() || !erlaubteNamen.length) return null;
  const w = wissen(room, bot, hilfen);
  const benutzer = [
    "Das ist alles, was du weißt:",
    JSON.stringify(w, null, 1),
    "",
    "Es wird abgestimmt, wer heute gehängt wird.",
    "Wählbar sind genau diese Namen: " + erlaubteNamen.join(", "),
    "Entscheide selbst. Stimm nicht blind mit der Mehrheit.",
    "",
    'Antworte NUR mit JSON: {"name":"<einer der Namen>","grund":"<ein kurzer Satz, der den Namen nennt>"}',
  ].join("\n");
  try {
    const roh = await frageModell(systemText(room, bot, hilfen), benutzer, 80);
    const treffer = roh.match(/\{[\s\S]*\}/);
    if (!treffer) return null;
    const d = JSON.parse(treffer[0]);
    // Namen streng gegen die erlaubte Liste pruefen, gross/klein egal.
    const name = erlaubteNamen.find(
      (n) => n.toLowerCase() === String(d.name || "").trim().toLowerCase()
    );
    if (!name) return null;
    return { name, grund: String(d.grund || "").slice(0, 200) };
  } catch (e) {
    console.warn("[ki] Stimme fehlgeschlagen:", e.message);
    return null;
  }
}

module.exports = { kiAktiv, botBeitrag, botStimme, charakterFuer, MODELL };
