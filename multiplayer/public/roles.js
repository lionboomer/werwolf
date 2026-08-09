// Shared role metadata + icons for player.html and narrator.html
(function (global) {
  "use strict";

  const ICON = {
    narrator: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M30 44c0-16 9-30 20-30s20 14 20 30c0 18-9 34-20 34s-20-16-20-34z"/><path d="M40 42c1-4 4-6 10-6s9 2 10 6" /><ellipse cx="41" cy="46" rx="3.4" ry="5" fill="currentColor" stroke="none"/><ellipse cx="59" cy="46" rx="3.4" ry="5" fill="currentColor" stroke="none"/><path d="M50 6c6 4 8 9 8 9s-6-2-8-2-8 2-8-2 2-5 8-7z" fill="currentColor" stroke="none"/></svg>`,
    werwolf: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M76 18a24 24 0 1 1-2 26" stroke-dasharray="2 5" opacity=".55"/><path d="M30 30 20 12l14 8" fill="currentColor" stroke="none" opacity=".9"/><path d="M70 30 80 12l-14 8" fill="currentColor" stroke="none" opacity=".9"/><path d="M22 52c2-16 12-26 28-26s26 10 28 26c1 10-4 16-4 24-6-6-10-8-24-8s-18 2-24 8c0-8-5-14-4-24z"/><path d="M50 52l-6 12h12l-6-12z" fill="currentColor" stroke="none"/><circle cx="38" cy="42" r="2.6" fill="currentColor" stroke="none"/><circle cx="62" cy="42" r="2.6" fill="currentColor" stroke="none"/></svg>`,
    dorfbewohner: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M50 14 86 42v6H14v-6L50 14z"/><path d="M24 46v34h52V46"/><path d="M42 80V58h16v22"/><path d="M60 8v10" stroke-width="2.4"/></svg>`,
    seherin: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M10 50c10-18 26-27 40-27s30 9 40 27c-10 18-26 27-40 27S20 68 10 50z"/><circle cx="50" cy="50" r="13"/><circle cx="50" cy="50" r="3.6" fill="currentColor" stroke="none"/><path d="M50 10v8M50 82v8M15 25l6 6M85 25l-6 6" stroke-width="2.4" opacity=".7"/></svg>`,
    hexe: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M40 14h20l4 18h-28z"/><path d="M36 32h28l6 44a10 10 0 0 1-10 10H40a10 10 0 0 1-10-10z"/><path d="M40 56c4-4 8-4 10 0s6 4 10 0" opacity=".8"/><circle cx="42" cy="70" r="2.4" fill="currentColor" stroke="none"/><circle cx="58" cy="66" r="2.4" fill="currentColor" stroke="none"/><path d="M28 32c-6 0-10-4-10-4M72 32c6 0 10-4 10-4" stroke-width="2.4"/></svg>`,
    jaeger: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M18 50c8-14 18-22 32-22s24 8 32 22" /><path d="M14 50h72" stroke-width="2.6"/><path d="M50 22v56" stroke-dasharray="1 6" opacity=".7"/><path d="M60 40 88 12" stroke-width="3.6"/><path d="M88 12l-10 1 9-9-1 8z" fill="currentColor" stroke="none"/></svg>`,
    amor: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M50 78C24 60 16 44 24 32c6-9 20-9 26 2 6-11 20-11 26-2 8 12 0 28-26 46z"/><path d="M8 26l84 0" stroke-width="2.4" opacity=".6"/><path d="M86 26 76 20l0 12z" fill="currentColor" stroke="none"/></svg>`
  };

  const ROLES = {
    werwolf: {
      name: "Werwolf", team: "wolf", icon: ICON.werwolf,
      flavor: "Bei Vollmond erwacht der Hunger. Das Fell wächst, die Augen glühen – und im Dorf schläft jemand seinen letzten Schlaf.",
      mechanic: "Jede Nacht bestimmst du gemeinsam mit den anderen Werwölfen ein Opfer. Ziel: Überlebt, bis ihr dem Dorf an Zahl ebenbürtig seid."
    },
    dorfbewohner: {
      name: "Dorfbewohner", team: "village", icon: ICON.dorfbewohner,
      flavor: "Kein Zauber, keine Klaue – nur wache Augen, ein rascher Verstand und der Mut, laut Verdacht zu äußern.",
      mechanic: "Keine Nachtaktion. Am Tag stimmst du mit ab, wer des Dorfes verwiesen wird. Ziel: alle Werwölfe enttarnen."
    },
    seherin: {
      name: "Seherin", team: "village", icon: ICON.seherin,
      flavor: "In ihren Träumen zeigt sich, wessen Herz vom Wolf befallen ist – ein Blick genügt, die Wahrheit zu ahnen.",
      mechanic: "Einmal pro Nacht darfst du heimlich die wahre Rolle einer Person sehen."
    },
    hexe: {
      name: "Hexe", team: "village", icon: ICON.hexe,
      flavor: "Zwei Fläschchen im Kessel: eines heilt, eines tötet. Beide brennen im ganzen Spiel nur ein einziges Mal.",
      mechanic: "Du erfährst, wen die Werwölfe angegriffen haben. Einmal im Spiel darfst du dieses Opfer retten, einmal darfst du eine beliebige Person vergiften."
    },
    jaeger: {
      name: "Jäger", team: "village", icon: ICON.jaeger,
      flavor: "Sein letzter Atemzug gehört noch dem Abzug. Fällt er, fällt niemand allein.",
      mechanic: "Stirbst du – nachts oder durch die Dorfabstimmung – gibst du sofort einen letzten Schuss ab und reißt eine weitere Person mit dir."
    },
    amor: {
      name: "Amor", team: "village", icon: ICON.amor,
      flavor: "In der ersten Nacht verknüpft er zwei Herzen mit einem unsichtbaren Faden – komme, was wolle, sie gehen gemeinsam.",
      mechanic: "In der ersten Nacht wählst du zwei Spieler als Verliebte. Stirbt einer der beiden, stirbt der andere aus Kummer mit."
    }
  };

  const DIST = {
    5: { werwolf: 1, seherin: 1, dorfbewohner: 3 },
    6: { werwolf: 1, seherin: 1, dorfbewohner: 4 },
    7: { werwolf: 2, seherin: 1, hexe: 1, dorfbewohner: 3 },
    8: { werwolf: 2, seherin: 1, hexe: 1, jaeger: 1, dorfbewohner: 3 },
    9: { werwolf: 2, seherin: 1, hexe: 1, jaeger: 1, amor: 1, dorfbewohner: 3 },
    10: { werwolf: 3, seherin: 1, hexe: 1, jaeger: 1, amor: 1, dorfbewohner: 3 },
    11: { werwolf: 3, seherin: 1, hexe: 1, jaeger: 1, amor: 1, dorfbewohner: 4 },
    12: { werwolf: 3, seherin: 1, hexe: 1, jaeger: 1, amor: 1, dorfbewohner: 5 }
  };

  global.WERWOLF_DATA = { ICON, ROLES, DIST };
})(window);
