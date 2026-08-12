"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const { ROLES, rolePoolFor } = require("./roleData");
const ki = require("./ki");

const PORT = process.env.PORT || 8791;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0, I/1

const rooms = new Map(); // code -> room

/* ---------------- helpers ---------------- */

function genCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (rooms.has(code));
  return code;
}
function genToken() { return crypto.randomBytes(16).toString("hex"); }
function genId() { return crypto.randomBytes(6).toString("hex"); }

function aliveList(room) { return room.players.filter((p) => p.alive); }
/* ---------------------------------------------------------------- Bots ----
   Ein Bot handelt genau dort, wo sonst ein Mensch tippen muesste. Die Zuege
   laufen ueber dieselben Zustandsfelder wie bei echten Spielern -- es gibt
   keinen zweiten Regelweg, der auseinanderlaufen koennte.
   Absichtlich simpel: zufaellige, aber immer gueltige Zuege. Ein Bot, der
   klug spielt, wuerde die Runde dominieren; ein Bot, der Unsinn macht, wuerde
   sie verderben.                                                            */
function zufall(feld) {
  return feld.length ? feld[Math.floor(Math.random() * feld.length)] : null;
}

function botZug(room) {
  const bots = room.players.filter((p) => p.isBot);
  if (!bots.length) return false;
  const lebend = aliveList(room);
  let getan = false;

  if (room.phase === "reveal") {
    bots.forEach((b) => { if (!b.ackedRole) { b.ackedRole = true; getan = true; } });
  } else if (room.phase === "cupid") {
    const amor = lebend.find((p) => p.role === "amor");
    if (amor && amor.isBot && room.cupidPick.length < 2) {
      const frei = lebend.filter((p) => !room.cupidPick.includes(p.id));
      while (room.cupidPick.length < 2 && frei.length) {
        const w = zufall(frei); room.cupidPick.push(w.id);
        frei.splice(frei.indexOf(w), 1);
      }
      getan = true;
    }
  } else if (room.phase === "seer") {
    const s = lebend.find((p) => p.role === "seherin");
    if (s && s.isBot) {
      // Zwei Schritte wie beim Menschen: erst schauen, dann die Augen schliessen.
      if (room.seerResult == null) {
        const z = zufall(lebend.filter((p) => p.id !== s.id));
        if (z) {
          room.seerResult = z.id;
          // Die eigene Vision merken -- ein Bot muss sich am Tag darauf
          // berufen koennen, ohne dafuer fremdes Wissen zu brauchen.
          s.visionen = s.visionen || [];
          s.visionen.push({ name: z.name, rolle: ROLES[z.role] ? ROLES[z.role].name : z.role });
          getan = true;
        }
      } else { afterSeer(room); getan = true; }
    }
  } else if (room.phase === "wolves") {
    const woelfe = lebend.filter((p) => p.role === "werwolf");
    if (woelfe.length && woelfe.every((w) => w.isBot)) {
      if (room.wolfTarget == null) {
        const z = zufall(lebend.filter((p) => p.role !== "werwolf")) || zufall(lebend);
        if (z) { room.wolfTarget = z.id; room.wolfConfirmedBy = []; getan = true; }
      } else { afterWolves(room); getan = true; }
    }
  } else if (room.phase === "witch") {
    const h = lebend.find((p) => p.role === "hexe");
    if (h && h.isBot) {
      // Bots halten ihre Traenke zurueck -- so verschenken sie nichts.
      if (room.witchStep === "ask-heal") { room.witchStep = "ask-poison"; getan = true; }
      else if (room.witchStep === "ask-poison") { room.witchPoisonTarget = null; resolveNight(room); getan = true; }
    }
  } else if (room.phase === "day-vote") {
    const offen = lebend.filter((p) => p.isBot && room.votesCast[p.id] == null);
    if (offen.length && ki.kiAktiv() && !room.kiLaeuft) {
      // Begruendete Stimmen holen. Laeuft nebenher; bis die Antwort da ist,
      // bleibt die Stimme offen. Kommt keine Antwort, greift unten der Wuerfel.
      kiStimmenHolen(room, offen);
    }
    offen.forEach((b) => {
      if (room.votesCast[b.id] != null) return;
      if (b.kiStimmeLaeuft) return;            // wartet noch auf das Modell
      let ziele = lebend.filter((p) => p.id !== b.id);
      if (room.voteRestrict) ziele = ziele.filter((p) => room.voteRestrict.includes(p.id));
      const z = zufall(ziele);
      if (z) { room.votesCast[b.id] = z.id; getan = true; }
    });
  } else if (room.phase === "hunter-shot") {
    const j = room.players.find((p) => p.id === room.hunterQueue[0]);
    if (j && j.isBot) {
      if (room.hunterTarget == null) {
        const z = zufall(lebend.filter((p) => p.id !== j.id));
        if (z) { room.hunterTarget = z.id; getan = true; }
      } else { handleHunterConfirm(room, room.hunterTarget); getan = true; }
    }
  }
  return getan;
}

/* ------------------------------------------------------------- KI-Anbindung --
   Die Modellaufrufe laufen strikt nebenher: Der Spielablauf wartet nie auf
   OpenAI. Kommt eine Antwort, wird sie eingespielt und der Raum neu gesendet;
   kommt keine, passiert schlicht nichts Weiteres. Ein Partyspiel darf nicht
   stehenbleiben, weil ein fremder Dienst gerade langsam ist.                */
const KI_HILFEN = { aliveList, byId: null, ROLES };   // byId unten nachgereicht

function chatEintrag(room, name, text, art) {
  room.chat.push({ name, text, art: art || "spieler", ts: Date.now() });
  if (room.chat.length > 120) room.chat.splice(0, room.chat.length - 120);
}

const KI_MAX_BEITRAEGE = 8;        // je Diskussionsrunde, gegen Endlosgeplapper

function kiDiskussion(room) {
  if (!ki.kiAktiv() || room.phase !== "day-discuss") return;
  if (room.kiLaeuft) return;
  if (room.kiBeitraege >= KI_MAX_BEITRAEGE) return;
  const bots = aliveList(room).filter((p) => p.isBot);
  if (!bots.length) return;
  // Wer am laengsten nichts gesagt hat, kommt dran -- sonst reden immer dieselben.
  bots.sort((a, b) => (a.zuletztGeredet || 0) - (b.zuletztGeredet || 0));
  const bot = bots[0];
  room.kiLaeuft = true;
  ki.botBeitrag(room, bot, KI_HILFEN)
    .then((text) => {
      if (text && room.phase === "day-discuss") {
        bot.zuletztGeredet = Date.now();
        room.kiBeitraege++;
        chatEintrag(room, bot.name, text, "bot");
        broadcast(room);
      }
    })
    .catch(() => {})
    .finally(() => {
      room.kiLaeuft = false;
      // Naechsten Beitrag mit Abstand planen, damit es sich wie ein Gespraech
      // anfuehlt und nicht wie ein Wasserfall.
      if (room.phase === "day-discuss") {
        clearTimeout(room.kiGeplant);
        room.kiGeplant = setTimeout(() => kiDiskussion(room), 6000 + Math.random() * 7000);
      }
    });
}

function kiStimmenHolen(room, bots) {
  const lebend = aliveList(room);
  bots.forEach((b) => {
    if (b.kiStimmeLaeuft) return;
    let ziele = lebend.filter((p) => p.id !== b.id);
    if (room.voteRestrict) ziele = ziele.filter((p) => room.voteRestrict.includes(p.id));
    if (!ziele.length) return;
    b.kiStimmeLaeuft = true;
    ki.botStimme(room, b, ziele.map((p) => p.name), KI_HILFEN)
      .then((wahl) => {
        if (!wahl || room.phase !== "day-vote") return;
        const ziel = ziele.find((p) => p.name === wahl.name);
        if (!ziel || room.votesCast[b.id] != null) return;
        room.votesCast[b.id] = ziel.id;
        // Die Begruendung nennt, gegen WEN sie sich richtet -- ohne das liest
        // sich "wirkt zu selbstsicher" wie ein Satz ohne Adressat.
        if (wahl.grund) {
          const grund = wahl.grund.includes(ziel.name)
            ? wahl.grund : `Ich stimme für ${ziel.name}: ${wahl.grund}`;
          chatEintrag(room, b.name, grund, "bot");
        }
        broadcast(room);
      })
      .catch(() => {})
      .finally(() => { b.kiStimmeLaeuft = false; });
  });
}

function byId(room, id) { return room.players.find((p) => p.id === id); }
KI_HILFEN.byId = byId;

function dedupeName(room, name) {
  const base = (name || "").trim().slice(0, 24) || "Spieler";
  let candidate = base;
  let n = 2;
  while (room.players.some((p) => p.name === candidate)) {
    candidate = `${base} (${n})`;
    n++;
  }
  return candidate;
}

function newRoom(code, narratorToken) {
  return {
    code,
    narratorToken,
    narratorWs: null,
    players: [],
    phase: "lobby",
    chat: [],                 // Tagesdiskussion, oeffentlich fuer alle
    kiLaeuft: false,          // verhindert parallele Modellaufrufe je Raum
    kiBeitraege: 0,           // Deckel je Diskussionsrunde
    kiGeplant: null,
    night: 1,
    log: [],
    logMarkStart: 0,
    wolfTarget: null,
    wolfConfirmedBy: [],
    seerResult: null,
    witchStep: "ask-heal",
    witchHeal: null,
    witchPoisonTarget: null,
    witchHealUsed: false,
    witchPoisonUsed: false,
    cupidPick: [],
    hunterQueue: [],
    hunterTarget: null,
    afterHunterTarget: null,
    votesCast: {},
    voteRestrict: null,
    timerSeconds: 180,
    timerTotal: 180,
    timerRunning: false,
    timerHandle: null,
    winner: null,
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
}

/* ---------------- game engine ---------------- */

function pushLog(room, text, cls) { room.log.push({ text, cls: cls || "" }); }

function applyDeaths(room, ids, causeMap) {
  const newlyDead = [];
  ids.forEach((id) => {
    const p = byId(room, id);
    if (p && p.alive) { p.alive = false; newlyDead.push(p); }
  });
  newlyDead.forEach((p) => {
    const cause = causeMap[p.id] || "unbekannt";
    const roleName = ROLES[p.role].name;
    if (cause === "wolf" && p.role === "werwolf") pushLog(room, `Das Rudel hat sich in dieser Nacht selbst zerfleischt: ${p.name} war ein Werwolf.`, "death");
    else if (cause === "wolf") pushLog(room, `${p.name} wurde in der Nacht von den Werwölfen gerissen. Rolle: ${roleName}.`, "death");
    else if (cause === "gift") pushLog(room, `${p.name} atmete Gift ein und starb im Schlaf. Rolle: ${roleName}.`, "death");
    else if (cause === "liebe") pushLog(room, `Aus Kummer um die verlorene Liebe stirbt auch ${p.name}. Rolle: ${roleName}.`, "death");
    else if (cause === "jaeger") pushLog(room, `Der letzte Schuss des Jägers trifft ${p.name}. Rolle: ${roleName}.`, "death");
    else if (cause === "vote") pushLog(room, `Das Dorf verbannt ${p.name}. Zum Vorschein kommt: ${roleName}!`, "death");

    if (p.lover != null) {
      const lov = byId(room, p.lover);
      if (lov && lov.alive) applyDeaths(room, [lov.id], { [lov.id]: "liebe" });
    }
    if (p.role === "jaeger" && !room.hunterQueue.includes(p.id)) room.hunterQueue.push(p.id);
  });
  return newlyDead;
}

/* Kleine Runden brauchen zwei Ausnahmen, sonst ist eine Dreierpartie nach der
   ersten Nacht entschieden -- bevor ueberhaupt geredet wurde. Identisch zur
   Ein-Geraet-Fassung. */
const KLEINE_RUNDE = 4;

function istKleineRunde(room) { return room.players.length <= KLEINE_RUNDE; }

function checkWin(room) {
  const liv = aliveList(room);
  if (liv.length === 2 && liv[0].lover === liv[1].id && liv[1].lover === liv[0].id) {
    return { type: "lovers", ids: [liv[0].id, liv[1].id] };
  }
  const wolves = liv.filter((p) => p.role === "werwolf").length;
  const village = liv.length - wolves;
  if (wolves === 0) return { type: "village" };
  // Klein: erst wenn wirklich niemand mehr uebrig ist. Sonst: Gleichstand genuegt.
  const ende = istKleineRunde(room) ? village === 0 : wolves >= village;
  if (ende) return { type: "wolves" };
  return null;
}

function startNight(room) {
  clearTimeout(room.kiGeplant);
  room.logMarkStart = room.log.length;
  room.wolfTarget = null;
  room.wolfConfirmedBy = [];
  room.seerResult = null;
  room.witchStep = "ask-heal";
  room.witchHeal = null;
  room.witchPoisonTarget = null;
  room.hunterTarget = null;
  room.cupidPick = [];
  const hasCupid = room.night === 1 && aliveList(room).some((p) => p.role === "amor");
  room.phase = hasCupid ? "cupid" : nextAfterCupid(room);
}

function nextAfterCupid(room) {
  return aliveList(room).some((p) => p.role === "seherin") ? "seer" : "wolves";
}

function afterCupid(room) { room.phase = nextAfterCupid(room); }

function afterSeer(room) {
  // Kleine Runde, erste Nacht: das Rudel zieht nur seine Kreise.
  if (istKleineRunde(room) && room.night === 1) {
    room.wolfTarget = null;
    pushLog(room, "Die Runde ist klein — das Rudel reißt in dieser Nacht nicht.", "narr");
    afterWolves(room);
    return;
  }
  room.phase = "wolves";
}

function afterWolves(room) {
  const hasWitch = aliveList(room).some((p) => p.role === "hexe");
  if (hasWitch) { room.phase = "witch"; return; }
  resolveNight(room);
}

function resolveNight(room) {
  const deaths = [];
  const causeMap = {};
  if (room.wolfTarget != null && room.wolfTarget !== room.witchHeal) {
    deaths.push(room.wolfTarget); causeMap[room.wolfTarget] = "wolf";
  }
  if (room.witchPoisonTarget != null) {
    deaths.push(room.witchPoisonTarget); causeMap[room.witchPoisonTarget] = "gift";
  }
  applyDeaths(room, deaths, causeMap);
  room.phase = "morning";
}

function afterHunterQueueDrained(room) {
  const w = checkWin(room);
  if (w) { room.winner = w; room.phase = "end"; stopTimer(room); return; }
  if (room.afterHunterTarget === "toDay") {
    room.phase = "day-discuss";
    room.kiBeitraege = 0;
    clearTimeout(room.kiGeplant);
    room.kiGeplant = setTimeout(() => kiDiskussion(room), 3500);
    room.timerSeconds = room.timerTotal;
    room.timerRunning = false;
  } else {
    room.night++;
    startNight(room);
  }
}

function proceedFromMorning(room) {
  room.afterHunterTarget = "toDay";
  if (room.hunterQueue.length > 0) { room.phase = "hunter-shot"; return; }
  afterHunterQueueDrained(room);
}

function proceedFromElimination(room) {
  room.afterHunterTarget = "toNextNight";
  if (room.hunterQueue.length > 0) { room.phase = "hunter-shot"; return; }
  afterHunterQueueDrained(room);
}

function handleHunterConfirm(room, targetId) {
  room.hunterQueue.shift();
  applyDeaths(room, [targetId], { [targetId]: "jaeger" });
  room.hunterTarget = null;
  if (room.hunterQueue.length > 0) return;
  afterHunterQueueDrained(room);
}

function tallyVotes(room) {
  const t = {};
  Object.values(room.votesCast).forEach((id) => { t[id] = (t[id] || 0) + 1; });
  return t;
}

function resolveVote(room) {
  const tally = tallyVotes(room);
  const entries = Object.entries(tally);
  if (!entries.length) return;
  const max = Math.max(...entries.map(([, v]) => v));
  const top = entries.filter(([, v]) => v === max).map(([k]) => k);
  if (top.length > 1) {
    room.voteRestrict = top;
    room.votesCast = {};
    return;
  }
  const chosenId = top[0];
  applyDeaths(room, [chosenId], { [chosenId]: "vote" });
  room.lastEliminated = chosenId;
  room.voteRestrict = null;
  room.votesCast = {};
  room.phase = "elimination";
}

function stopTimer(room) {
  if (room.timerHandle) { clearInterval(room.timerHandle); room.timerHandle = null; }
  room.timerRunning = false;
}
function startTimer(room) {
  if (room.timerHandle) return;
  room.timerRunning = true;
  room.timerHandle = setInterval(() => {
    if (room.timerSeconds > 0) { room.timerSeconds--; broadcast(room); }
    else { stopTimer(room); broadcast(room); }
  }, 1000);
}

/* ---------------- tailored views ---------------- */

function publicRosterFor(room, viewerId) {
  return room.players.map((p) => {
    const revealed = !p.alive || viewerId === "narrator" || p.id === viewerId;
    return {
      id: p.id,
      name: p.name,
      alive: p.alive,
      connected: p.connected,
      isYou: p.id === viewerId,
      isBot: !!p.isBot,
      role: revealed ? p.role : null,
      roleName: revealed && p.role ? ROLES[p.role].name : null,
      ackedRole: p.ackedRole,
      lover: revealed ? p.lover : (p.id === viewerId ? p.lover : null)
    };
  });
}

function waitingMessageFor(room, me) {
  if (!me) return null;
  if (!me.alive && ["cupid", "wolves", "seer", "witch", "hunter-shot", "day-vote"].includes(room.phase)) {
    return "Du bist ausgeschieden und schaust nur noch zu.";
  }
  switch (room.phase) {
    case "lobby": return "Warte auf den Erzähler …";
    case "night-intro": return "Schließt die Augen, Schattenmoor …";
    case "cupid": return me.role === "amor" ? null : "Amor verknüpft in der Dunkelheit zwei Herzen …";
    case "wolves": return me.role === "werwolf" ? null : "Die Werwölfe beraten sich leise über ihr Opfer …";
    case "seer": return me.role === "seherin" ? null : "Die Seherin blickt in die Zukunft …";
    case "witch": return me.role === "hexe" ? null : "Die Hexe entscheidet über ihre letzten Tränke …";
    case "hunter-shot": return (room.hunterQueue[0] === me.id) ? null : "Der Jäger zielt ein letztes Mal …";
    default: return null;
  }
}

function buildMyAction(room, me) {
  if (!me) return null;
  switch (room.phase) {
    case "cupid":
      if (me.role !== "amor") return null;
      return { type: "cupid", pickable: aliveList(room).map((p) => p.id), picked: room.cupidPick };
    case "wolves":
      if (me.role !== "werwolf" || !me.alive) return null;
      return {
        type: "wolf",
        pickable: aliveList(room).map((p) => p.id),
        shared: room.wolfTarget
      };
    case "seer": {
      if (me.role !== "seherin" || !me.alive) return null;
      const seenPlayer = room.seerResult != null ? byId(room, room.seerResult) : null;
      return {
        type: "seer",
        pickable: aliveList(room).filter((p) => p.id !== me.id).map((p) => p.id),
        result: room.seerResult,
        resultRole: seenPlayer ? seenPlayer.role : null,
        resultRoleName: seenPlayer ? ROLES[seenPlayer.role].name : null
      };
    }
    case "witch": {
      if (me.role !== "hexe" || !me.alive) return null;
      const poisonPickable = aliveList(room)
        .filter((p) => !(room.witchHeal != null && p.id === room.wolfTarget))
        .map((p) => p.id);
      return {
        type: "witch",
        step: room.witchStep,
        wolfVictimId: room.wolfTarget,
        healUsed: room.witchHealUsed,
        poisonUsed: room.witchPoisonUsed,
        poisonPick: room.witchPoisonTarget,
        poisonPickable
      };
    }
    case "hunter-shot":
      if (room.hunterQueue[0] !== me.id) return null;
      return { type: "hunter", pickable: room.players.filter((p) => p.alive && p.id !== me.id).map((p) => p.id), picked: room.hunterTarget };
    case "day-vote":
      if (!me.alive) return null;
      return {
        type: "vote",
        pickable: room.voteRestrict || aliveList(room).map((p) => p.id),
        myVote: room.votesCast[me.id] || null
      };
    default:
      return null;
  }
}

function wolfCompanionsFor(room, me) {
  if (!me || me.role !== "werwolf") return null;
  return room.players.filter((p) => p.role === "werwolf" && p.id !== me.id).map((p) => p.name);
}

function buildStateFor(room, viewerId) {
  const isNarrator = viewerId === "narrator";
  const me = isNarrator ? null : byId(room, viewerId);
  const base = {
    t: "state",
    code: room.code,
    chat: room.chat.slice(-40),
    kiAn: ki.kiAktiv(),
    phase: room.phase,
    night: room.night,
    players: publicRosterFor(room, viewerId),
    log: room.log.map((l) => ({ text: l.text, cls: l.cls })),
    winner: room.winner,
    timer: { seconds: room.timerSeconds, total: room.timerTotal, running: room.timerRunning },
    voteTally: tallyVotes(room),
    voteRestrict: room.voteRestrict
  };
  if (isNarrator) {
    base.isNarrator = true;
    base.wolfShared = { target: room.wolfTarget, confirmedBy: room.wolfConfirmedBy };
    base.seerResult = room.seerResult;
    base.witch = {
      step: room.witchStep, heal: room.witchHeal, poisonTarget: room.witchPoisonTarget,
      healUsed: room.witchHealUsed, poisonUsed: room.witchPoisonUsed
    };
    base.cupidPick = room.cupidPick;
    base.hunterQueue = room.hunterQueue;
    base.hunterTarget = room.hunterTarget;
    base.ackCount = room.players.filter((p) => p.ackedRole).length;
    base.lastEliminated = room.lastEliminated || null;
  } else {
    base.me = me ? { id: me.id, name: me.name, alive: me.alive, role: me.role, lover: me.lover } : null;
    base.myAction = buildMyAction(room, me);
    base.waitingMessage = waitingMessageFor(room, me);
    base.wolfCompanions = room.phase === "reveal" ? wolfCompanionsFor(room, me) : null;
  }
  return base;
}

function sendJSON(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }
}

function broadcast(room) {
  // Erst zeichnen, dann die Bots ziehen lassen und noch einmal zeichnen --
  // so sehen alle Geraete den Zug, statt ihn zu ueberspringen.
  broadcastRoh(room);
  if (room.__botLauft) return;
  room.__botLauft = true;
  setTimeout(() => {
    room.__botLauft = false;
    try { if (botZug(room)) broadcast(room); } catch (e) { console.error("Bot:", e); }
  }, 700);
}

function broadcastRoh(room) {
  room.lastActivity = Date.now();
  if (room.narratorWs) sendJSON(room.narratorWs, buildStateFor(room, "narrator"));
  room.players.forEach((p) => { if (p.ws) sendJSON(p.ws, buildStateFor(room, p.id)); });
}

/* ---------------- HTTP + static files ---------------- */

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8" };

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split("?")[0]);
  if (reqPath === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  if (reqPath === "/" || reqPath === "") reqPath = "/player.html";
  if (reqPath === "/narrator") reqPath = "/narrator.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    try { handleMessage(ws, msg); } catch (e) { console.error("Fehler bei Nachricht", msg && msg.t, e); }
  });

  ws.on("close", () => {
    if (ws.role === "narrator" && ws.roomCode) {
      const room = rooms.get(ws.roomCode);
      if (room && room.narratorWs === ws) room.narratorWs = null;
    } else if (ws.role === "player" && ws.roomCode && ws.playerId) {
      const room = rooms.get(ws.roomCode);
      if (room) {
        const p = byId(room, ws.playerId);
        if (p && p.ws === ws) { p.connected = false; p.ws = null; broadcast(room); }
      }
    }
  });
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { ws.terminate(); return; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* ignore */ }
  });
}, 30000);

const roomSweep = setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyoneConnected = room.narratorWs || room.players.some((p) => p.connected);
    if (!anyoneConnected && now - room.lastActivity > 30 * 60 * 1000) {
      stopTimer(room);
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000);

process.on("exit", () => { clearInterval(heartbeat); clearInterval(roomSweep); });

/* ---------------- message router ---------------- */

function handleMessage(ws, msg) {
  const t = msg.t;

  if (t === "createRoom") {
    const code = genCode();
    const token = genToken();
    const room = newRoom(code, token);
    rooms.set(code, room);
    ws.role = "narrator";
    ws.roomCode = code;
    room.narratorWs = ws;
    sendJSON(ws, { t: "roomCreated", code, narratorToken: token });
    broadcast(room);
    return;
  }

  if (t === "joinAsNarrator") {
    const room = rooms.get((msg.code || "").toUpperCase());
    if (!room || room.narratorToken !== msg.token) { sendJSON(ws, { t: "error", message: "Lobby nicht gefunden." }); return; }
    ws.role = "narrator"; ws.roomCode = room.code;
    room.narratorWs = ws;
    sendJSON(ws, { t: "roomCreated", code: room.code, narratorToken: room.narratorToken });
    broadcast(room);
    return;
  }

  if (t === "joinAsPlayer") {
    const code = (msg.code || "").toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) { sendJSON(ws, { t: "error", message: "Lobby-Code nicht gefunden." }); return; }

    if (msg.token) {
      const existing = room.players.find((p) => p.token === msg.token);
      if (existing) {
        existing.ws = ws; existing.connected = true;
        ws.role = "player"; ws.roomCode = room.code; ws.playerId = existing.id;
        sendJSON(ws, { t: "joined", playerId: existing.id, token: existing.token, code: room.code });
        broadcast(room);
        return;
      }
    }

    if (room.phase !== "lobby") { sendJSON(ws, { t: "error", message: "Das Spiel läuft schon — kein Beitritt mehr möglich." }); return; }
    if (room.players.length >= 12) { sendJSON(ws, { t: "error", message: "Lobby ist voll (max. 12 Spieler)." }); return; }

    const player = {
      id: genId(), token: genToken(), name: dedupeName(room, msg.name),
      ws, connected: true, alive: true, role: null, lover: null, ackedRole: false
    };
    room.players.push(player);
    ws.role = "player"; ws.roomCode = room.code; ws.playerId = player.id;
    sendJSON(ws, { t: "joined", playerId: player.id, token: player.token, code: room.code });
    broadcast(room);
    return;
  }

  // everything below needs an established room/role
  const room = rooms.get(ws.roomCode);
  if (!room) return;

  if (ws.role === "narrator") {
    handleNarratorMessage(room, ws, msg);
  } else if (ws.role === "player") {
    handlePlayerMessage(room, ws, msg);
  }
}

function handleNarratorMessage(room, ws, msg) {
  switch (msg.t) {
    case "kick": {
      if (room.phase !== "lobby") return;
      const idx = room.players.findIndex((p) => p.id === msg.playerId);
      if (idx >= 0) {
        sendJSON(room.players[idx].ws, { t: "kicked" });
        if (room.players[idx].ws) room.players[idx].ws.close();
        room.players.splice(idx, 1);
        broadcast(room);
      }
      return;
    }
    case "addBot": {
      // Bots fuellen kleine Runden auf. Sie haben keine Verbindung, bestaetigen
      // ihre Rolle sofort und handeln zufaellig -- ein Bot bluffft nicht, er
      // ersetzt nur die fehlende Hand am Tisch.
      if (room.phase !== "lobby") return;
      if (room.players.length >= 12) {
        sendJSON(ws, { t: "error", message: "Lobby ist voll (max. 12)." }); return;
      }
      const n = room.players.filter((p) => p.isBot).length + 1;
      room.players.push({
        id: genId(), token: genToken(), name: dedupeName(room, "Bot " + n),
        ws: null, connected: true, alive: true, role: null, lover: null,
        ackedRole: false, isBot: true
      });
      broadcast(room);
      return;
    }
    case "removeBot": {
      if (room.phase !== "lobby") return;
      for (let i = room.players.length - 1; i >= 0; i--) {
        if (room.players[i].isBot) { room.players.splice(i, 1); break; }
      }
      broadcast(room);
      return;
    }
    case "startGame": {
      if (room.phase !== "lobby") return;
      const count = room.players.length;
      if (count < 3 || count > 12) return;
      const pool = rolePoolFor(count);
      room.players.forEach((p, i) => { p.role = pool[i]; p.alive = true; p.lover = null; p.ackedRole = false; });
      room.night = 1;
      room.log = [];
      room.logMarkStart = 0;
      room.winner = null;
      room.hunterQueue = [];
      room.phase = "reveal";
      broadcast(room);
      return;
    }
    case "advance": {
      if (room.phase === "reveal") { room.phase = "night-intro"; }
      else if (room.phase === "night-intro") { startNight(room); }
      else if (room.phase === "morning") { proceedFromMorning(room); }
      else if (room.phase === "elimination") { proceedFromElimination(room); }
      broadcast(room);
      return;
    }
    case "timerToggle": {
      if (room.phase !== "day-discuss") return;
      if (room.timerRunning) stopTimer(room); else startTimer(room);
      broadcast(room);
      return;
    }
    case "timerAdjust": {
      if (room.phase !== "day-discuss") return;
      const delta = Number(msg.delta) || 0;
      room.timerSeconds = Math.max(0, room.timerSeconds + delta);
      room.timerTotal = Math.max(room.timerTotal, room.timerSeconds);
      broadcast(room);
      return;
    }
    case "toVote": {
      if (room.phase !== "day-discuss") return;
      stopTimer(room);
      room.votesCast = {};
      room.voteRestrict = null;
      room.phase = "day-vote";
      broadcast(room);
      return;
    }
    case "resolveVote": {
      if (room.phase !== "day-vote") return;
      resolveVote(room);
      broadcast(room);
      return;
    }
    case "restart": {
      stopTimer(room);
      room.phase = "lobby";
      room.night = 1;
      room.log = [];
      room.logMarkStart = 0;
      room.winner = null;
      room.hunterQueue = [];
      room.votesCast = {};
      room.voteRestrict = null;
      room.players.forEach((p) => { p.alive = true; p.role = null; p.lover = null; p.ackedRole = false; });
      broadcast(room);
      return;
    }
  }
}

function handlePlayerMessage(room, ws, msg) {
  const me = byId(room, ws.playerId);
  if (!me) return;

  switch (msg.t) {
    case "chat": {
      // Reden darf nur, wer lebt und nur waehrend der Tagesdiskussion --
      // sonst waere es ein Kanal, um Nachtwissen durchzustechen.
      if (room.phase !== "day-discuss" || !me.alive) return;
      const text = String(msg.text || "").replace(/\s+/g, " ").trim().slice(0, 240);
      if (!text) return;
      chatEintrag(room, me.name, text, "spieler");
      broadcast(room);
      // Auf einen Menschen antworten die Bots zeitnah, nicht nach Fahrplan.
      clearTimeout(room.kiGeplant);
      room.kiGeplant = setTimeout(() => kiDiskussion(room), 2200 + Math.random() * 2500);
      return;
    }
    case "ackRole": {
      if (room.phase !== "reveal") return;
      me.ackedRole = true;
      broadcast(room);
      return;
    }
    case "cupidPick": {
      if (room.phase !== "cupid" || me.role !== "amor") return;
      const id = msg.targetId;
      const idx = room.cupidPick.indexOf(id);
      if (idx > -1) room.cupidPick.splice(idx, 1);
      else if (room.cupidPick.length < 2 && aliveList(room).some((p) => p.id === id)) room.cupidPick.push(id);
      broadcast(room);
      return;
    }
    case "cupidConfirm": {
      if (room.phase !== "cupid" || me.role !== "amor" || room.cupidPick.length !== 2) return;
      const [a, b] = room.cupidPick;
      byId(room, a).lover = b; byId(room, b).lover = a;
      pushLog(room, `Amor verbindet ${byId(room, a).name} und ${byId(room, b).name} für immer.`, "");
      afterCupid(room);
      broadcast(room);
      return;
    }
    case "wolfPick": {
      if (room.phase !== "wolves" || me.role !== "werwolf" || !me.alive) return;
      const target = byId(room, msg.targetId);
      if (!target || !target.alive) return;
      room.wolfTarget = msg.targetId;
      room.wolfConfirmedBy = [];
      broadcast(room);
      return;
    }
    case "wolfConfirm": {
      if (room.phase !== "wolves" || me.role !== "werwolf" || !me.alive || room.wolfTarget == null) return;
      afterWolves(room);
      broadcast(room);
      return;
    }
    case "seerPick": {
      if (room.phase !== "seer" || me.role !== "seherin" || !me.alive) return;
      const target = byId(room, msg.targetId);
      if (!target || !target.alive || target.id === me.id) return;
      room.seerResult = msg.targetId;
      broadcast(room);
      return;
    }
    case "seerClose": {
      if (room.phase !== "seer" || me.role !== "seherin" || room.seerResult == null) return;
      afterSeer(room);
      broadcast(room);
      return;
    }
    case "witchHeal": {
      if (room.phase !== "witch" || me.role !== "hexe" || room.witchStep !== "ask-heal") return;
      if (msg.value === true && !room.witchHealUsed && room.wolfTarget != null) {
        room.witchHeal = room.wolfTarget;
        room.witchHealUsed = true;
      }
      room.witchStep = "ask-poison";
      broadcast(room);
      return;
    }
    case "witchPoisonPick": {
      if (room.phase !== "witch" || me.role !== "hexe" || room.witchStep !== "ask-poison" || room.witchPoisonUsed) return;
      const target = byId(room, msg.targetId);
      if (!target || !target.alive) return;
      if (room.witchHeal != null && target.id === room.wolfTarget) return;
      room.witchPoisonTarget = msg.targetId;
      broadcast(room);
      return;
    }
    case "witchPoisonDecide": {
      if (room.phase !== "witch" || me.role !== "hexe" || room.witchStep !== "ask-poison") return;
      if (msg.value === true) {
        if (room.witchPoisonUsed || room.witchPoisonTarget == null) return;
        room.witchPoisonUsed = true;
      } else {
        room.witchPoisonTarget = null;
      }
      resolveNight(room);
      broadcast(room);
      return;
    }
    case "hunterPick": {
      if (room.phase !== "hunter-shot" || room.hunterQueue[0] !== me.id) return;
      const target = byId(room, msg.targetId);
      if (!target || !target.alive || target.id === me.id) return;
      room.hunterTarget = msg.targetId;
      broadcast(room);
      return;
    }
    case "hunterConfirm": {
      if (room.phase !== "hunter-shot" || room.hunterQueue[0] !== me.id || room.hunterTarget == null) return;
      handleHunterConfirm(room, room.hunterTarget);
      broadcast(room);
      return;
    }
    case "votePick": {
      if (room.phase !== "day-vote" || !me.alive) return;
      const target = byId(room, msg.targetId);
      if (!target || !target.alive) return;
      if (room.voteRestrict && !room.voteRestrict.includes(msg.targetId)) return;
      room.votesCast[me.id] = msg.targetId;
      broadcast(room);
      return;
    }
  }
}

server.listen(PORT, () => {
  console.log(`Werwölfe von Schattenmoor — Server läuft auf Port ${PORT}`);
  console.log(`Spieler: http://<host>:${PORT}/`);
  console.log(`Erzähler: http://<host>:${PORT}/narrator`);
});
