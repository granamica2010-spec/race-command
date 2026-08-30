const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');
const rooms = new Map();
// code -> Map(playerId -> Set(SSE responses))
const sseClients = new Map();

const CELLS_PER_LAP = 30;
const DEFAULT_LAPS = 5;
const PIT_ENTRY_CELL = 25;
const TEST_SPEED = process.env.RC_TEST_SPEED === '1';
const ACTION_SECONDS = TEST_SPEED ? 2 : 20;
const DUEL_SECONDS = TEST_SPEED ? 2 : 15;
const LIGHTS_SECONDS = TEST_SPEED ? 0.25 : 4;
const RESOLUTION_DELAY_MS = TEST_SPEED ? 35 : 1550;
const DUEL_RESULT_DELAY_MS = TEST_SPEED ? 35 : 2100;
const MAX_PLAYERS = 6;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const LOBBY_DISCONNECT_GRACE_MS = 60 * 1000;

const compounds = {
  S: { name: 'SOFT', deg: 16 },
  M: { name: 'MEDIUM', deg: 7 },
  H: { name: 'HARD', deg: 4 },
  I: { name: 'INTER', deg: 8 },
  W: { name: 'WET', deg: 6 },
};
const weather = [
  { name: 'DRY', icon: '☀️', rain: 5 },
  { name: 'DAMP', icon: '🌦️', rain: 42 },
  { name: 'WET', icon: '🌧️', rain: 76 },
  { name: 'VERY WET', icon: '⛈️', rain: 95 },
];
function randomStartingWeatherIndex() {
  const r = Math.random();
  if (r < 0.62) return 0;      // DRY
  if (r < 0.84) return 1;      // DAMP
  if (r < 0.96) return 2;      // WET
  return 3;                     // VERY WET
}
function botStartTyre(room, index = 0) {
  const w = weather[room.weatherIndex].name;
  if (w === 'DAMP') return index % 3 === 0 ? 'W' : 'I';
  if (w === 'WET') return index % 3 === 0 ? 'I' : 'W';
  if (w === 'VERY WET') return 'W';
  return ['S', 'M', 'H'][index % 3];
}
const grip = {
  DRY: { S: 10, M: 8, H: 7, I: 4, W: 3 },
  DAMP: { S: 6, M: 6, H: 5, I: 10, W: 7 },
  WET: { S: 4, M: 4, H: 4, I: 8, W: 10 },
  'VERY WET': { S: 3, M: 3, H: 3, I: 6, W: 10 },
};
const palette = ['#f04444', '#4e8cff', '#f0b429', '#35b779', '#9b6cff', '#ff7a3d'];
const BOT_NAMES = ['Apex AI', 'Nova AI', 'Velocity AI', 'Pulse AI', 'Titan AI'];

function uid() { return crypto.randomBytes(8).toString('hex'); }
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out;
  do out = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  while (rooms.has(out));
  return out;
}
function now() { return Date.now(); }
function touch(room) { room.updatedAt = now(); }
function clamp(v, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }
function roll(n) { return 1 + Math.floor(Math.random() * n); }
function raceFinish(room) { return CELLS_PER_LAP * room.maxLaps; }
function lapCell(p) { return ((Math.floor(p.progress) % CELLS_PER_LAP) + CELLS_PER_LAP) % CELLS_PER_LAP; }
function lapOf(room, p) { return Math.min(room.maxLaps, Math.floor(p.progress / CELLS_PER_LAP) + 1); }
function sectorOf(p) { const c = lapCell(p); return c < 10 ? 1 : c < 20 ? 2 : 3; }
function nextPitEntryProgress(progress) {
  const lapStart = Math.floor(progress / CELLS_PER_LAP) * CELLS_PER_LAP;
  const cell = ((progress % CELLS_PER_LAP) + CELLS_PER_LAP) % CELLS_PER_LAP;
  return lapStart + PIT_ENTRY_CELL + (cell > PIT_ENTRY_CELL ? CELLS_PER_LAP : 0);
}
function boxDistance(p) { return Math.max(0, Math.ceil(nextPitEntryProgress(p.progress) - p.progress)); }
function willReachPitEntry(p, move) { return !!p.pitPlanTyre && p.progress + move >= nextPitEntryProgress(p.progress); }
function standings(room) { return [...room.players].sort((a, b) => b.progress - a.progress); }
function nextAhead(room, p) { return room.players.filter(x => x.id !== p.id && x.progress > p.progress).sort((a, b) => a.progress - b.progress)[0] || null; }
function effectiveDie(room, p) {
  let n = grip[weather[room.weatherIndex].name][p.tyre];
  // Compound-specific falloff: Soft is fastest fresh but loses performance sharply;
  // Medium is progressive; Hard gives up peak pace for a much longer stable stint.
  if (p.tyre === 'S') {
    if (p.wear < 70) n -= 2;
    if (p.wear < 40) n -= 2;
    if (p.wear < 20) n -= 1;
  } else if (p.tyre === 'M') {
    if (p.wear < 50) n -= 1;
    if (p.wear < 20) n -= 2;
  } else if (p.tyre === 'H') {
    if (p.wear < 20) n -= 1;
  } else {
    if (p.wear < 45) n -= 2;
    if (p.wear < 20) n -= 1;
  }
  return Math.max(3, n);
}
function drsEligible(room, p) {
  const c = lapCell(p);
  const zone = (c >= 2 && c <= 8) || (c >= 16 && c <= 21);
  const ahead = nextAhead(room, p);
  return !!(zone && ahead && ahead.progress - p.progress <= 2.5 && room.safetyTurns === 0);
}
function degrade(room, p, mult = 1) {
  let extra = 0;
  const w = weather[room.weatherIndex].name;
  if (w === 'DRY' && (p.tyre === 'I' || p.tyre === 'W')) extra = 5;
  if ((w === 'WET' || w === 'VERY WET') && ['S', 'M', 'H'].includes(p.tyre)) extra = 3;
  p.wear = clamp(p.wear - (compounds[p.tyre].deg + extra) * mult);
}
function log(room, msg) {
  room.log.push(msg);
  if (room.log.length > 80) room.log.shift();
  touch(room);
}

function getClientSet(code, playerId, create = false) {
  let roomMap = sseClients.get(code);
  if (!roomMap && create) { roomMap = new Map(); sseClients.set(code, roomMap); }
  if (!roomMap) return null;
  let set = roomMap.get(playerId);
  if (!set && create) { set = new Set(); roomMap.set(playerId, set); }
  return set || null;
}
function isConnected(code, playerId) {
  const set = getClientSet(code, playerId, false);
  return !!(set && set.size);
}
function publicPlayer(room, p) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    ready: p.ready,
    tyre: p.tyre,
    wear: Math.round(p.wear),
    ers: Math.round(p.ers),
    progress: p.progress,
    lap: lapOf(room, p),
    sector: sectorOf(p),
    isBot: p.isBot,
    connected: p.isBot ? true : isConnected(room.code, p.id),
    stats: { ...p.stats },
    strategy: [...p.strategy],
  };
}
function roomView(room, viewerId) {
  const me = room.players.find(p => p.id === viewerId);
  const ranked = standings(room);
  const myRank = me ? ranked.findIndex(p => p.id === viewerId) + 1 : null;
  return {
    code: room.code,
    status: room.status,
    phase: room.phase,
    hostId: room.hostId,
    turn: room.turn,
    maxLaps: room.maxLaps,
    weather: weather[room.weatherIndex],
    weatherIndex: room.weatherIndex,
    safetyTurns: room.safetyTurns,
    deadline: room.deadline,
    lockedCount: room.phase === 'action' ? room.players.filter(p => p.selectedAction).length : 0,
    totalPlayers: room.players.length,
    players: ranked.map(p => publicPlayer(room, p)),
    me: me ? {
      ...publicPlayer(room, me),
      rank: myRank,
      effectiveDie: effectiveDie(room, me),
      boxDistance: boxDistance(me),
      pitPlanTyre: me.pitPlanTyre,
      drs: drsEligible(room, me),
      selectedAction: me.selectedAction,
    } : null,
    duel: room.duel ? {
      attackerId: room.duel.attackerId,
      defenderId: room.duel.defenderId,
      attackerName: room.players.find(p => p.id === room.duel.attackerId)?.name,
      defenderName: room.players.find(p => p.id === room.duel.defenderId)?.name,
      locked: Object.keys(room.duel.choices).length,
      myChoice: room.duel.choices[viewerId] || null,
      result: room.duel.result || null,
    } : null,
    raceLog: room.log.slice(-14),
    rules: { cellsPerLap: CELLS_PER_LAP, maxLaps: room.maxLaps, pitEntryCell: PIT_ENTRY_CELL, actionSeconds: ACTION_SECONDS, duelSeconds: DUEL_SECONDS },
  };
}
function sendSSE(res, type, data) { res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(room, type = 'state', payloadFactory = null) {
  const roomMap = sseClients.get(room.code);
  if (!roomMap) return;
  for (const [pid, set] of roomMap) {
    for (const res of [...set]) {
      try { sendSSE(res, type, payloadFactory ? payloadFactory(pid) : roomView(room, pid)); }
      catch { set.delete(res); }
    }
  }
}

function newPlayer(name, color, isBot = false) {
  return {
    id: uid(),
    name: String(name || 'Pilota').trim().slice(0, 18) || 'Pilota',
    color,
    ready: isBot,
    tyre: 'M',
    wear: 100,
    ers: 60,
    progress: 0,
    selectedAction: null,
    pitPlanTyre: null,
    isBot,
    disconnectedAt: null,
    stats: { passes: 0, pits: 0, duelW: 0, duelL: 0, ersUsed: 0, bestPace: 0 },
    strategy: ['M'],
  };
}

function botNameFor(room, index) {
  const used = new Set(room.players.filter(p => p.isBot).map(p => p.name));
  for (const name of BOT_NAMES) if (!used.has(name)) return name;
  return `Bot ${index + 1}`;
}
function syncLobbyBots(room) {
  if (room.status !== 'lobby') return;
  const humans = room.players.filter(p => !p.isBot);
  if (!humans.length) return;
  const desiredBots = Math.max(0, MAX_PLAYERS - humans.length);
  const bots = room.players.filter(p => p.isBot);
  while (bots.length > desiredBots) {
    const bot = bots.pop();
    room.players = room.players.filter(p => p.id !== bot.id);
  }
  while (room.players.filter(p => p.isBot).length < desiredBots) {
    const idx = room.players.filter(p => p.isBot).length;
    const bot = newPlayer(botNameFor(room, idx), palette[room.players.length % palette.length], true);
    bot.tyre = botStartTyre(room, idx);
    bot.strategy = [bot.tyre];
    room.players.push(bot);
  }
  let botSlot = 0;
  room.players.forEach((p, i) => {
    p.color = palette[i % palette.length];
    if (p.isBot) {
      p.ready = true;
      p.tyre = botStartTyre(room, botSlot++);
      p.strategy = [p.tyre];
    }
  });
  touch(room);
}
function humanCount(room) { return room.players.filter(p => !p.isBot).length; }
function createRoom(hostName) {
  const code = makeCode();
  const host = newPlayer(hostName, palette[0]);
  const room = {
    code,
    hostId: host.id,
    status: 'lobby',
    phase: 'lobby',
    turn: 0,
    maxLaps: DEFAULT_LAPS,
    weatherIndex: randomStartingWeatherIndex(),
    safetyTurns: 0,
    duelCooldown: 0,
    players: [host],
    deadline: null,
    duel: null,
    log: ['Stanza creata. In attesa dei piloti.'],
    createdAt: now(),
    updatedAt: now(),
  };
  syncLobbyBots(room);
  rooms.set(code, room);
  return { room, host };
}
function resetPlayerForLobby(p) {
  p.ready = p.isBot;
  p.wear = 100;
  p.ers = 60;
  p.progress = 0;
  p.selectedAction = null;
  p.pitPlanTyre = null;
  p.stats = { passes: 0, pits: 0, duelW: 0, duelL: 0, ersUsed: 0, bestPace: 0 };
  p.strategy = [p.tyre];
}
function resetRoomToLobby(room) {
  room.status = 'lobby';
  room.phase = 'lobby';
  room.turn = 0;
  room.weatherIndex = randomStartingWeatherIndex();
  room.safetyTurns = 0;
  room.duelCooldown = 0;
  room.deadline = null;
  room.duel = null;
  room.log = ['🏁 Rematch pronta. Scegliete le gomme e mettete READY.'];
  room.players.forEach(resetPlayerForLobby);
  syncLobbyBots(room);
  touch(room);
  broadcast(room);
}
function removePlayer(room, playerId) {
  const idx = room.players.findIndex(p => p.id === playerId);
  if (idx < 0) return false;
  const p = room.players[idx];

  // In an active race an explicit leaver is converted into AI so the grid remains at 6.
  if (room.status !== 'lobby' && !p.isBot) {
    p.isBot = true;
    p.ready = true;
    p.name = `${p.name} · AI`.slice(0, 18);
    if (p.selectedAction == null && room.phase === 'action') chooseBotAction(room, p);
    if (room.hostId === playerId) {
      const next = room.players.find(x => !x.isBot && x.id !== playerId);
      if (next) { room.hostId = next.id; log(room, `👑 ${next.name} è il nuovo host.`); }
    }
    if (humanCount(room) === 0) {
      rooms.delete(room.code);
      const roomMap = sseClients.get(room.code);
      if (roomMap) { for (const set of roomMap.values()) for (const res of set) { try { res.end(); } catch {} } sseClients.delete(room.code); }
      return true;
    }
    log(room, `🤖 ${p.name} continua la gara come bot.`);
    broadcast(room);
    maybeResolveActions(room);
    return true;
  }

  room.players.splice(idx, 1);
  if (!p.isBot) log(room, `${p.name} ha lasciato la stanza.`);
  if (humanCount(room) === 0) {
    rooms.delete(room.code);
    const roomMap = sseClients.get(room.code);
    if (roomMap) { for (const set of roomMap.values()) for (const res of set) { try { res.end(); } catch {} } sseClients.delete(room.code); }
    return true;
  }
  if (room.hostId === playerId || !room.players.some(x => x.id === room.hostId && !x.isBot)) {
    const next = room.players.find(x => !x.isBot);
    room.hostId = next.id;
    log(room, `👑 ${next.name} è il nuovo host.`);
  }
  syncLobbyBots(room);
  broadcast(room);
  return true;
}

function bestBotPitTyre(room, p) {
  const w = weather[room.weatherIndex].name;
  if (w === 'DAMP') return 'I';
  if (w === 'WET' || w === 'VERY WET') return 'W';
  const remaining = Math.max(0, raceFinish(room) - p.progress);
  return remaining <= 18 ? 'S' : remaining <= 42 ? 'M' : 'H';
}
function chooseBotAction(room, p) {
  if (p.selectedAction) return;
  const w = weather[room.weatherIndex].name;
  const ahead = nextAhead(room, p);
  const gap = ahead ? ahead.progress - p.progress : 99;
  const wrongWet = (w === 'WET' || w === 'VERY WET') && ['S', 'M', 'H'].includes(p.tyre);
  const wrongDry = w === 'DRY' && ['I', 'W'].includes(p.tyre);
  const needsPit = p.wear < 34 || wrongWet || wrongDry;
  if (needsPit) p.pitPlanTyre = bestBotPitTyre(room, p);
  // Once a stop is planned, protect the current set until the car reaches the pit entry.
  if (p.pitPlanTyre && p.wear < 42 && boxDistance(p) > 0) { p.selectedAction = 'conserve'; return; }
  // Close combat: favour ERS or attack when resources and tyres allow it.
  if (gap <= 2.5 && p.wear > 45) {
    if (p.ers >= 45 && Math.random() < .58) { p.selectedAction = 'ers'; return; }
    if (Math.random() < .70) { p.selectedAction = 'attack'; return; }
  }
  // Technical sector + ageing tyres: conserve more often.
  if (sectorOf(p) === 2 && p.wear < 58 && Math.random() < .62) { p.selectedAction = 'conserve'; return; }
  if (p.ers >= 75 && Math.random() < .35) { p.selectedAction = 'ers'; return; }
  const r = Math.random();
  p.selectedAction = r < .18 ? 'attack' : r < .38 ? 'conserve' : 'normal';
}

function chooseBotDuel(role, p) {
  if (role === 'attack') {
    if (p.wear < 24) return 'hold';
    if (p.ers >= 35 && Math.random() < .55) return 'ersAttack';
    if (p.wear > 62 && Math.random() < .28) return 'aggressive';
    return Math.random() < .78 ? 'attack' : 'hold';
  }
  if (p.wear < 20) return 'noFight';
  if (p.ers >= 35 && Math.random() < .52) return 'ersDef';
  if (p.wear > 62 && Math.random() < .24) return 'hardDefend';
  return Math.random() < .82 ? 'defend' : 'noFight';
}


function prepareRace(room) {
  room.status = 'starting';
  room.phase = 'lights';
  room.deadline = now() + LIGHTS_SECONDS * 1000;
  room.turn = 0;
  // Keep the pre-race weather shown in the lobby: tyre choice must match the actual start conditions.
  room.safetyTurns = 0;
  room.duelCooldown = 0;
  room.duel = null;
  // No qualifying in this version: randomise the six-car starting grid for fairness.
  for (let i = room.players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [room.players[i], room.players[j]] = [room.players[j], room.players[i]];
  }
  room.log = ['🚦 Griglia da 6 pronta. Sequenza di partenza…'];
  room.players.forEach((p, i) => {
    p.progress = Math.max(0, room.players.length - i - 1);
    p.wear = 100;
    p.ers = 60;
    p.selectedAction = null;
    p.pitPlanTyre = null;
    p.stats = { passes: 0, pits: 0, duelW: 0, duelL: 0, ersUsed: 0, bestPace: 0 };
    p.strategy = [p.tyre];
  });
  touch(room);
  broadcast(room);
}
function beginRace(room) {
  if (room.status !== 'starting') return;
  room.status = 'racing';
  room.log = ['🚦 LIGHTS OUT! La gara è iniziata.'];
  startTurn(room);
}
function startTurn(room) {
  if (room.status !== 'racing') return;
  room.phase = 'action';
  room.duel = null;
  room.deadline = now() + ACTION_SECONDS * 1000;
  for (const p of room.players) {
    p.selectedAction = null;
    if (p.isBot) chooseBotAction(room, p);
  }
  touch(room);
  broadcast(room);
  maybeResolveActions(room);
}
function actionScore(room, p, action) {
  const die = effectiveDie(room, p);
  const raw = roll(die);
  let bonus = 0, mult = 1, mods = [], pitted = false;
  if (action === 'attack') {
    bonus += 2; mult = sectorOf(p) === 2 ? 1.8 : 1.55; mods.push('ATTACK +2');
    if (sectorOf(p) === 2 && Math.random() < .10) { bonus -= 2; p.wear = clamp(p.wear - 8); mods.push('LOCK-UP -2'); log(room, `⚠️ ${p.name}: lock-up nel settore tecnico.`); }
  } else if (action === 'conserve') {
    bonus -= 1; mult = .45; p.ers = clamp(p.ers + 10); mods.push('CONSERVE -1');
  } else if (action === 'ers') {
    if (p.ers >= 25) { bonus += 3; p.ers -= 25; p.stats.ersUsed += 25; mods.push('ERS +3'); }
    else mods.push('ERS EMPTY');
  } else {
    p.ers = clamp(p.ers + 5);
  }
  if (!pitted && drsEligible(room, p)) { bonus += 2; mods.push('DRS +2'); }
  else if (!pitted) {
    const ahead = nextAhead(room, p);
    if (sectorOf(p) === 1 && ahead && ahead.progress - p.progress <= 1.5) { bonus += 1; mods.push('SCIA +1'); }
  }
  let move = Math.max(1, raw + bonus);
  if (!pitted) degrade(room, p, mult);
  if (room.safetyTurns > 0) move = Math.min(move, 4);
  p.stats.bestPace = Math.max(p.stats.bestPace, move);
  return { die, raw, bonus, move, mods, pitted, pitTyre: pitted ? p.tyre : null };
}
function maybeResolveActions(room) {
  if (room.status !== 'racing' || room.phase !== 'action') return;
  if (room.players.some(p => !p.selectedAction)) return;
  resolveActions(room);
}
function resolveActions(room) {
  room.phase = 'resolving';
  room.deadline = null;
  touch(room);
  const oldPositions = Object.fromEntries(room.players.map(p => [p.id, p.progress]));
  const oldOrder = standings(room).map(p => p.id);
  const results = {};
  // Snapshot DRS before movement so all players are evaluated from the same race state.
  const drsSnapshot = new Map(room.players.map(p => [p.id, drsEligible(room, p)]));
  const nextSnapshot = new Map(room.players.map(p => [p.id, nextAhead(room, p)?.id || null]));
  const originalDrs = drsEligible;
  // actionScore is deterministic with current state except random roll; temporarily supply snapshot via room helpers below.
  room._drsSnapshot = drsSnapshot;
  room._nextSnapshot = nextSnapshot;
  for (const p of room.players) {
    // Inline the snapshot by temporarily overriding p flags used below.
    const die = effectiveDie(room, p);
    const raw = roll(die);
    let bonus = 0, mult = 1, mods = [], pitted = false;
    const action = p.selectedAction;
    if (action === 'attack') {
      bonus += 2; mult = sectorOf(p) === 2 ? 1.8 : 1.55; mods.push('ATTACK +2');
      if (sectorOf(p) === 2 && Math.random() < .10) { bonus -= 2; p.wear = clamp(p.wear - 8); mods.push('LOCK-UP -2'); log(room, `⚠️ ${p.name}: lock-up nel settore tecnico.`); }
    } else if (action === 'conserve') {
      bonus -= 1; mult = .45; p.ers = clamp(p.ers + 10); mods.push('CONSERVE -1');
    } else if (action === 'ers') {
      if (p.ers >= 25) { bonus += 3; p.ers -= 25; p.stats.ersUsed += 25; mods.push('ERS +3'); }
      else mods.push('ERS EMPTY');
    } else p.ers = clamp(p.ers + 5);
    if (!pitted && drsSnapshot.get(p.id)) { bonus += 2; mods.push('DRS +2'); }
    else if (!pitted && sectorOf(p) === 1) {
      const aheadId = nextSnapshot.get(p.id);
      const ahead = aheadId ? room.players.find(x => x.id === aheadId) : null;
      if (ahead && ahead.progress - p.progress <= 1.5) { bonus += 1; mods.push('SCIA +1'); }
    }
    let move = Math.max(1, raw + bonus);
    if (room.safetyTurns > 0) move = Math.min(move, 4);
    const pitEntryProgress = nextPitEntryProgress(p.progress);
    if (willReachPitEntry(p, move)) {
      pitted = true;
      const nt = p.pitPlanTyre;
      const pitCost = room.safetyTurns > 0 ? 2 : 5;
      const distanceToEntry = Math.max(0, pitEntryProgress - p.progress);
      move = Math.max(distanceToEntry + 1, move - pitCost);
      p.tyre = nt; p.wear = 100; p.stats.pits++; p.strategy.push(nt); p.pitPlanTyre = null;
      mods.push(`PIT -${pitCost}`);
      log(room, `🔧 ${p.name}: pit stop, ${compounds[nt].name}.`);
    } else {
      degrade(room, p, mult);
    }
    p.stats.bestPace = Math.max(p.stats.bestPace, move);
    results[p.id] = { die, raw, bonus, move, mods, pitted, pitTyre: pitted ? p.tyre : null, pitEntryProgress: pitted ? pitEntryProgress : null };
  }
  delete room._drsSnapshot; delete room._nextSnapshot;
  for (const p of room.players) p.progress += results[p.id].move;
  const newOrder = standings(room).map(p => p.id);
  for (const p of room.players) {
    const a = oldOrder.indexOf(p.id), b = newOrder.indexOf(p.id);
    if (b < a) p.stats.passes += a - b;
  }
  const newPositions = Object.fromEntries(room.players.map(p => [p.id, p.progress]));
  broadcast(room, 'resolution', pid => ({ turn: room.turn, oldPositions, newPositions, results, viewerId: pid, players: room.players.map(p => publicPlayer(room, p)), rules: { cellsPerLap: CELLS_PER_LAP, pitEntryCell: PIT_ENTRY_CELL } }));
  setTimeout(() => afterMovement(room), RESOLUTION_DELAY_MS);
}
function weatherStep(room) {
  if (room.turn >= 2 && room.weatherIndex < 3 && Math.random() < .26) { room.weatherIndex++; log(room, `🌧️ Pista → ${weather[room.weatherIndex].name}.`); }
  else if (room.weatherIndex > 0 && Math.random() < .11) { room.weatherIndex--; log(room, `☀️ Pista → ${weather[room.weatherIndex].name}.`); }
}
function findDuel(room) {
  if (room.safetyTurns > 0 || room.duelCooldown > 0) return null;
  const sorted = standings(room);
  let best = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const ahead = sorted[i], behind = sorted[i + 1], gap = ahead.progress - behind.progress;
    if (gap <= 1.15 && (!best || gap < best.gap)) best = { attackerId: behind.id, defenderId: ahead.id, gap };
  }
  return best;
}
function afterMovement(room) {
  if (room.status !== 'racing') return;
  room.turn++;
  if (room.duelCooldown > 0) room.duelCooldown--;
  if (room.players.some(p => p.progress >= raceFinish(room))) { finishRace(room); return; }
  weatherStep(room);
  // A Safety Car turn is consumed only after a complete action phase, so "2 turni" really means 2 turns.
  if (room.safetyTurns > 0) {
    room.safetyTurns--;
    if (room.safetyTurns === 0) log(room, '🟢 Safety Car in this lap. Ripartenza!');
  }
  const duel = findDuel(room);
  if (duel) {
    room.phase = 'duel';
    room.duel = { attackerId: duel.attackerId, defenderId: duel.defenderId, choices: {}, result: null };
    room.deadline = now() + DUEL_SECONDS * 1000;
    const a = room.players.find(p => p.id === duel.attackerId), d = room.players.find(p => p.id === duel.defenderId);
    if (a.isBot) room.duel.choices[a.id] = chooseBotDuel('attack', a);
    if (d.isBot) room.duel.choices[d.id] = chooseBotDuel('defend', d);
    touch(room);
    broadcast(room);
    maybeResolveDuel(room);
    return;
  }
  startTurn(room);
}
function duelScore(room, p, k) {
  let base = roll(6);
  if (k === 'attack') { base += 2; p.wear = clamp(p.wear - 8); }
  if (k === 'aggressive') { base += 4; p.wear = clamp(p.wear - 16); }
  if (k === 'ersAttack') { if (p.ers >= 15) { base += 3; p.ers -= 15; p.stats.ersUsed += 15; } }
  if (k === 'hold') { base = 0; p.ers = clamp(p.ers + 8); }
  if (k === 'defend') { base += 2; p.wear = clamp(p.wear - 8); }
  if (k === 'hardDefend') { base += 4; p.wear = clamp(p.wear - 16); }
  if (k === 'ersDef') { if (p.ers >= 15) { base += 3; p.ers -= 15; p.stats.ersUsed += 15; } }
  if (k === 'noFight') base = 0;
  return base;
}
function maybeResolveDuel(room) {
  if (room.phase !== 'duel' || !room.duel) return;
  const { attackerId, defenderId, choices } = room.duel;
  if (!choices[attackerId] || !choices[defenderId]) return;
  const a = room.players.find(p => p.id === attackerId), d = room.players.find(p => p.id === defenderId);
  const ac = choices[attackerId], dc = choices[defenderId];
  const as = duelScore(room, a, ac), ds = duelScore(room, d, dc);
  let winner = 'defender';
  if (ac === 'hold') winner = 'defender';
  else if (dc === 'noFight' || as > ds) {
    a.progress += 1; winner = 'attacker'; a.stats.duelW++; d.stats.duelL++; a.stats.passes++; log(room, `⚔️ ${a.name} supera ${d.name}.`);
  } else {
    d.stats.duelW++; a.stats.duelL++; log(room, `⚔️ ${d.name} difende su ${a.name}.`);
  }
  const risky = ['aggressive', 'hardDefend'];
  const contact = ac !== 'hold' && dc !== 'noFight' && (risky.includes(ac) || risky.includes(dc)) && Math.random() < .14;
  if (contact) { room.safetyTurns = 2; compressField(room); log(room, '🟡 Contatto! Safety Car per 2 turni.'); }
  room.duel.result = { attackerChoice: ac, defenderChoice: dc, attackerScore: as, defenderScore: ds, winner, contact };
  room.duelCooldown = 2;
  room.phase = 'duel_result';
  room.deadline = null;
  touch(room);
  broadcast(room, 'duel_resolution', pid => ({ viewerId: pid, ...room.duel.result, attackerId, defenderId, attackerName: a.name, defenderName: d.name }));
  broadcast(room);
  setTimeout(() => { if (room.status === 'racing') startTurn(room); }, DUEL_RESULT_DELAY_MS);
}
function compressField(room) {
  const r = standings(room);
  for (let i = 1; i < r.length; i++) if (r[i - 1].progress - r[i].progress > 4) r[i].progress = r[i - 1].progress - 4;
}
function finishRace(room) {
  room.status = 'finished'; room.phase = 'finished'; room.deadline = null;
  const r = standings(room); log(room, `🏁 Bandiera a scacchi: ${r[0].name} vince!`); touch(room); broadcast(room);
}

function autoTick() {
  const t = now();
  for (const [code, room] of rooms) {
    if (t - room.updatedAt > ROOM_TTL_MS) { rooms.delete(code); sseClients.delete(code); continue; }
    if (room.status === 'lobby') {
      const expired = room.players.filter(p => !p.isBot && p.disconnectedAt && t - p.disconnectedAt >= LOBBY_DISCONNECT_GRACE_MS);
      for (const p of expired) {
        if (!rooms.has(code)) break;
        removePlayer(room, p.id);
      }
      if (!rooms.has(code)) continue;
    }
    if (!room.deadline || t < room.deadline) continue;
    if (room.status === 'starting' && room.phase === 'lights') { beginRace(room); continue; }
    if (room.status !== 'racing') continue;
    if (room.phase === 'action') {
      for (const p of room.players) if (!p.selectedAction) p.selectedAction = 'normal';
      log(room, '⏱️ Tempo scaduto: NORMALE assegnato ai piloti non pronti.');
      broadcast(room); maybeResolveActions(room);
    } else if (room.phase === 'duel' && room.duel) {
      const a = room.players.find(p => p.id === room.duel.attackerId), d = room.players.find(p => p.id === room.duel.defenderId);
      if (!room.duel.choices[a.id]) room.duel.choices[a.id] = 'hold';
      if (!room.duel.choices[d.id]) room.duel.choices[d.id] = 'noFight';
      maybeResolveDuel(room);
    }
  }
}
setInterval(autoTick, 400);
setInterval(() => {
  for (const roomMap of sseClients.values()) {
    for (const set of roomMap.values()) for (const res of [...set]) {
      try { res.write(': ping\n\n'); } catch { set.delete(res); }
    }
  }
}, 20000);

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) { req.destroy(); reject(new Error('too large')); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function mime(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' })[path.extname(file)] || 'application/octet-stream';
}
function staticFile(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(PUBLIC, urlPath));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC, 'index.html'), (e, d) => {
        if (e) { res.writeHead(404); res.end('Not found'); }
        else { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(d); }
      });
    } else {
      res.writeHead(200, {
        'Content-Type': mime(file),
        'Cache-Control': path.basename(file) === 'service-worker.js' || path.basename(file) === 'index.html' ? 'no-cache' : 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
        'X-Frame-Options': 'DENY',
      });
      res.end(data);
    }
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const parts = u.pathname.split('/').filter(Boolean);
    if (u.pathname === '/api/health') return json(res, 200, { ok: true, rooms: rooms.size, version: '1.3.0' });

    if (req.method === 'POST' && u.pathname === '/api/rooms') {
      const b = await readBody(req);
      const { room, host } = createRoom(b.name || 'Host');
      return json(res, 201, { code: room.code, playerId: host.id });
    }

    if (parts[0] === 'api' && parts[1] === 'rooms' && parts[2]) {
      const code = parts[2].toUpperCase();
      const room = rooms.get(code);
      if (!room) return json(res, 404, { error: 'Stanza non trovata' });
      touch(room);

      if (req.method === 'GET' && parts[3] === 'events') {
        const pid = u.searchParams.get('playerId');
        const streamPlayer = room.players.find(p => p.id === pid);
        if (!streamPlayer) return json(res, 403, { error: 'Pilota non valido' });
        streamPlayer.disconnectedAt = null;
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'X-Content-Type-Options': 'nosniff',
        });
        res.write('retry: 1500\n: connected\n\n');
        const set = getClientSet(code, pid, true);
        set.add(res);
        sendSSE(res, 'state', roomView(room, pid));
        broadcast(room);
        req.on('close', () => {
          set.delete(res);
          if (!set.size) {
            getClientSet(code, pid, false)?.clear();
            const current = room.players.find(x => x.id === pid);
            if (current && !current.isBot) current.disconnectedAt = now();
          }
          broadcast(room);
        });
        return;
      }

      if (req.method === 'GET' && parts[3] === 'state') {
        const pid = u.searchParams.get('playerId');
        if (!room.players.some(p => p.id === pid)) return json(res, 403, { error: 'Pilota non valido' });
        return json(res, 200, roomView(room, pid));
      }

      if (req.method === 'POST' && parts[3] === 'join') {
        if (room.status !== 'lobby') return json(res, 409, { error: 'Gara già iniziata' });
        if (humanCount(room) >= MAX_PLAYERS) return json(res, 409, { error: 'Stanza piena: 6 giocatori umani' });
        const b = await readBody(req);
        const name = String(b.name || 'Pilota').trim().slice(0, 18) || 'Pilota';
        // Free one of the automatic grid slots, then fill the vacated seat with the new human.
        const botIndex = room.players.findIndex(x => x.isBot);
        if (botIndex >= 0) room.players.splice(botIndex, 1);
        const p = newPlayer(name, palette[room.players.length % palette.length]);
        room.players.push(p);
        syncLobbyBots(room);
        log(room, `${p.name} è entrato nella lobby. Griglia: ${humanCount(room)} umani + ${MAX_PLAYERS-humanCount(room)} bot.`);
        broadcast(room);
        return json(res, 201, { code, playerId: p.id });
      }

      const b = await readBody(req);
      const p = room.players.find(x => x.id === b.playerId);
      if (!p) return json(res, 403, { error: 'Pilota non valido' });

      if (req.method === 'POST' && parts[3] === 'leave') {
        removePlayer(room, p.id);
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && parts[3] === 'ready') {
        if (room.status !== 'lobby') return json(res, 409, { error: 'Non in lobby' });
        if (['S', 'M', 'H', 'I', 'W'].includes(b.tyre)) p.tyre = b.tyre;
        p.strategy = [p.tyre];
        p.ready = !!b.ready;
        touch(room); broadcast(room);
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && parts[3] === 'settings') {
        if (p.id !== room.hostId) return json(res, 403, { error: 'Solo host' });
        if (room.status !== 'lobby') return json(res, 409, { error: 'Solo in lobby' });
        const laps = Number(b.maxLaps);
        if (![3, 5, 8, 10].includes(laps)) return json(res, 400, { error: 'Numero giri non valido' });
        room.maxLaps = laps; touch(room); broadcast(room); return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && parts[3] === 'start') {
        if (p.id !== room.hostId) return json(res, 403, { error: 'Solo host' });
        syncLobbyBots(room);
        if (room.players.length !== MAX_PLAYERS) return json(res, 409, { error: 'La griglia deve avere 6 piloti' });
        if (room.players.some(x => !x.isBot && !x.ready)) return json(res, 409, { error: 'Non tutti i giocatori umani sono READY' });
        prepareRace(room); return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && parts[3] === 'rematch') {
        if (p.id !== room.hostId) return json(res, 403, { error: 'Solo host' });
        if (room.status !== 'finished') return json(res, 409, { error: 'La gara non è finita' });
        resetRoomToLobby(room); return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && parts[3] === 'pit-plan') {
        if (room.status !== 'racing') return json(res, 409, { error: 'Il pit si programma durante la gara' });
        if (b.pitTyre == null || b.pitTyre === '') {
          p.pitPlanTyre = null;
          touch(room); broadcast(room);
          return json(res, 200, { ok: true, pitPlanTyre: null });
        }
        if (!compounds[b.pitTyre]) return json(res, 400, { error: 'Mescola non valida' });
        p.pitPlanTyre = b.pitTyre;
        touch(room); broadcast(room);
        return json(res, 200, { ok: true, pitPlanTyre: p.pitPlanTyre, pitEntryIn: boxDistance(p) });
      }
      if (req.method === 'POST' && parts[3] === 'action') {
        if (room.status !== 'racing' || room.phase !== 'action') return json(res, 409, { error: 'Non è la fase strategia' });
        if (p.selectedAction) return json(res, 409, { error: 'Scelta già bloccata' });
        const allowed = ['normal', 'attack', 'conserve', 'ers'];
        if (!allowed.includes(b.action)) return json(res, 400, { error: 'Azione non valida' });
        if (b.action === 'ers' && p.ers < 25) return json(res, 409, { error: `ERS insufficiente: serve 25%, hai ${Math.round(p.ers)}%` });
        p.selectedAction = b.action;
        touch(room); broadcast(room); maybeResolveActions(room);
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && parts[3] === 'duel') {
        if (room.phase !== 'duel' || !room.duel) return json(res, 409, { error: 'Nessun duello attivo' });
        if (![room.duel.attackerId, room.duel.defenderId].includes(p.id)) return json(res, 403, { error: 'Non sei nel duello' });
        if (room.duel.choices[p.id]) return json(res, 409, { error: 'Scelta già bloccata' });
        const role = p.id === room.duel.attackerId ? 'attack' : 'defend';
        const allowed = role === 'attack' ? ['attack', 'aggressive', 'ersAttack', 'hold'] : ['defend', 'hardDefend', 'ersDef', 'noFight'];
        if (!allowed.includes(b.choice)) return json(res, 400, { error: 'Scelta non valida' });
        if ((b.choice === 'ersAttack' || b.choice === 'ersDef') && p.ers < 15) return json(res, 409, { error: `ERS insufficiente: serve 15%, hai ${Math.round(p.ers)}%` });
        room.duel.choices[p.id] = b.choice; touch(room); broadcast(room); maybeResolveDuel(room);
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: 'Endpoint non trovato' });
    }

    staticFile(req, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Errore server' }); else res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏁 Race Command Web 1.0 FINAL avviato`);
  console.log(`   Locale: http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const arr of Object.values(nets)) for (const n of arr || []) if (n.family === 'IPv4' && !n.internal) console.log(`   Wi-Fi/LAN: http://${n.address}:${PORT}`);
  console.log('   Ctrl+C per chiudere.\n');
});
