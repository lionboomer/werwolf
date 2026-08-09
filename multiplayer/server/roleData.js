"use strict";

const ROLES = {
  werwolf: { name: "Werwolf", team: "wolf" },
  dorfbewohner: { name: "Dorfbewohner", team: "village" },
  seherin: { name: "Seherin", team: "village" },
  hexe: { name: "Hexe", team: "village" },
  jaeger: { name: "Jäger", team: "village" },
  amor: { name: "Amor", team: "village" }
};

/* Kleine Runden (3-4) folgen denselben Ausnahmen wie die Ein-Geraet-Fassung:
   kein Riss in Nacht 1, und die Woelfe gewinnen erst bei vollstaendiger
   Ausloeschung statt schon bei Gleichstand. Siehe KLEINE_RUNDE in server.js. */
const DIST = {
  3:  { werwolf: 1, seherin: 1, dorfbewohner: 1 },
  4:  { werwolf: 1, seherin: 1, dorfbewohner: 2 },
  5:  { werwolf: 1, seherin: 1, dorfbewohner: 3 },
  6:  { werwolf: 1, seherin: 1, dorfbewohner: 4 },
  7:  { werwolf: 2, seherin: 1, hexe: 1, dorfbewohner: 3 },
  8:  { werwolf: 2, seherin: 1, hexe: 1, jaeger: 1, dorfbewohner: 3 },
  9:  { werwolf: 2, seherin: 1, hexe: 1, jaeger: 1, amor: 1, dorfbewohner: 3 },
  10: { werwolf: 3, seherin: 1, hexe: 1, jaeger: 1, amor: 1, dorfbewohner: 3 },
  11: { werwolf: 3, seherin: 1, hexe: 1, jaeger: 1, amor: 1, dorfbewohner: 4 },
  12: { werwolf: 3, seherin: 1, hexe: 1, jaeger: 1, amor: 1, dorfbewohner: 5 }
};

function rolePoolFor(count) {
  const dist = DIST[count];
  if (!dist) throw new Error("Unsupported player count: " + count);
  const pool = [];
  Object.entries(dist).forEach(([role, n]) => { for (let i = 0; i < n; i++) pool.push(role); });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

module.exports = { ROLES, DIST, rolePoolFor };
