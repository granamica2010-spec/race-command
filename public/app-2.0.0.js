const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const netEl = document.getElementById('network-status');

let session = { code: localStorage.getItem('rc_code') || '', playerId: localStorage.getItem('rc_player') || '' };
let state = null;
let source = null;
let selectedTyre = 'M';
let selectedDuel = null;
let pendingAction = null;
let pendingTurn = null;
let animFrame = null;
let resolutionData = null;
let duelResult = null;
let reconnectCheck = null;
let lastToastTimer = null;
let soundEnabled = localStorage.getItem('rc_sound') === '1';
let audioCtx = null;
let resolutionTimers = [];

const circuitPaths = {
  catalunya:{race:'M78 212 C58 140 109 89 181 91 C231 93 250 119 291 110 C338 100 360 67 418 91 C474 114 501 172 478 222 C456 269 399 280 353 256 C313 235 294 210 257 220 C219 231 207 275 157 273 C112 271 89 247 78 212 Z',pit:'M162 269 C135 302 94 282 78 212'},
  monza:{race:'M78 212 C60 135 105 78 190 80 C275 82 352 65 440 97 C495 117 512 165 487 203 C458 246 393 238 331 238 C263 237 211 278 151 271 C105 266 86 241 78 212 Z',pit:'M158 268 C127 298 95 278 78 212'},
  monaco:{race:'M78 212 C53 163 77 112 128 101 C172 92 183 130 221 126 C255 122 244 78 294 82 C339 85 340 133 377 137 C420 142 448 105 482 142 C516 179 486 212 447 210 C409 208 411 255 364 263 C318 272 296 232 256 236 C212 241 197 281 147 271 C103 263 88 239 78 212 Z',pit:'M151 268 C123 300 94 276 78 212'},
  spa:{race:'M78 212 C54 126 111 67 187 82 C230 90 245 130 291 112 C338 93 365 49 426 75 C487 101 519 168 481 218 C449 260 401 252 358 264 C309 278 298 220 257 220 C210 219 198 285 145 273 C103 264 88 239 78 212 Z',pit:'M151 270 C118 304 91 276 78 212'},
  suzuka:{race:'M78 212 C59 151 100 93 159 96 C221 99 233 156 282 154 C327 151 327 91 386 91 C447 91 496 135 486 190 C478 231 433 253 386 239 C342 226 320 198 281 219 C244 239 222 280 167 273 C118 267 91 243 78 212 Z',pit:'M165 269 C132 301 96 281 78 212'},
};
const colors = { S:'var(--soft)', M:'var(--medium)', H:'var(--hard)', I:'var(--inter)', W:'var(--wet)' };
const names = { S:'SOFT', M:'MEDIUM', H:'HARD', I:'INTER', W:'WET' };
const gripByTrack = { DRY:{S:10,M:8,H:7,I:4,W:3}, DAMP:{S:6,M:6,H:5,I:10,W:7}, WET:{S:4,M:4,H:4,I:8,W:10}, 'VERY WET':{S:3,M:3,H:3,I:6,W:10} };
const circuitInfo = {
  catalunya:{name:'CATALUNYA',country:'Spagna'}, monza:{name:'MONZA',country:'Italia'}, monaco:{name:'MONACO',country:'Monaco'}, spa:{name:'SPA-FRANCORCHAMPS',country:'Belgio'}, suzuka:{name:'SUZUKA',country:'Giappone'}
};
const duelLabels = { inside:'INTERNO +2', outside:'ESTERNO +2', cutback:'CUTBACK +1', ersAttack:'ERS ATTACK +3', coverInside:'COPRI INTERNO +2', coverOutside:'COPRI ESTERNO +2', lateBrake:'FRENATA TARDIVA +3', ersDef:'ERS DEFENCE +3', noFight:'NON COMBATTERE' };
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function toast(text) {
  clearTimeout(lastToastTimer);
  toastEl.textContent = text;
  toastEl.classList.add('show');
  lastToastTimer = setTimeout(() => toastEl.classList.remove('show'), 1900);
}
function setNetwork(ok, label) {
  if (!netEl) return;
  netEl.textContent = label || (ok ? 'ONLINE' : 'RICONNESSIONE…');
  netEl.classList.toggle('offline', !ok);
}
function soundToggleHtml() {
  return `<button class="soundToggle ${soundEnabled ? 'on' : ''}" id="soundToggle" title="Effetti audio">${soundEnabled ? '🔊' : '🔇'} FX</button>`;
}
function bindSoundToggle() {
  const el = document.getElementById('soundToggle');
  if (!el) return;
  el.onclick = () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('rc_sound', soundEnabled ? '1' : '0');
    if (soundEnabled) playFx('confirm');
    render();
  };
}
function playTone(freq, duration = .07, gain = .035, type = 'sine', delay = 0) {
  if (!soundEnabled) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .008); g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g); g.connect(audioCtx.destination); osc.start(t); osc.stop(t + duration + .02);
  } catch {}
}
function playFx(kind) {
  if (!soundEnabled) return;
  if (kind === 'roll') { for (let i=0;i<5;i++) playTone(170 + i*45, .045, .025, 'square', i*.055); }
  else if (kind === 'land') { playTone(430,.08,.05,'triangle'); playTone(620,.09,.035,'triangle',.07); }
  else if (kind === 'pass') { playTone(500,.06,.035,'sawtooth'); playTone(760,.10,.04,'sawtooth',.065); }
  else if (kind === 'pit') { playTone(310,.06,.035,'square'); playTone(310,.06,.035,'square',.09); playTone(520,.08,.04,'square',.18); }
  else if (kind === 'confirm') { playTone(480,.055,.025,'triangle'); }
  else if (kind === 'warning') { playTone(220,.10,.04,'square'); playTone(180,.10,.04,'square',.12); }
}
function weatherClass() {
  const n=state?.track?.name||'DRY'; return n==='VERY WET'?'weatherVeryWet':n==='WET'?'weatherWet':n==='DAMP'?'weatherDamp':'weatherDry';
}
function weatherLayer() {
  const i=state?.weatherIndex??0; return i>=2?`<div class="weatherFx ${i>=3?'weatherVeryWet':'weatherWet'}" aria-hidden="true"></div>`:'';
}
function trackFrame(extra = '') {
  return `<div class="trackWrap ${weatherClass()} ${state?.me?.drs ? 'drsLive' : ''} ${extra}">${trackSvg()}${weatherLayer()}</div>`;
}
function clearResolutionTimers() {
  for (const id of resolutionTimers) { clearTimeout(id); clearInterval(id); }
  resolutionTimers = [];
}
function later(fn, ms) { const id = setTimeout(fn, ms); resolutionTimers.push(id); return id; }
function showRaceEvent(text, kind = 'neutral') {
  document.getElementById('raceEventSplash')?.remove();
  const el = document.createElement('div'); el.id = 'raceEventSplash'; el.className = `raceEventSplash ${kind}`; el.textContent = text;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(()=>el.remove(),220); }, 1150);
}
async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Errore');
  return j;
}
async function getJSON(path) {
  const r = await fetch(path, { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Errore');
  return j;
}
function saveSession() {
  localStorage.setItem('rc_code', session.code);
  localStorage.setItem('rc_player', session.playerId);
}
function wipeSession() {
  localStorage.removeItem('rc_code');
  localStorage.removeItem('rc_player');
  session = { code: '', playerId: '' };
  if (source) source.close();
  source = null;
  state = null;
  pendingAction = null;
  pendingTurn = null;
  renderHome();
}
async function leaveRoom() {
  try {
    if (session.code && session.playerId) await post(`/api/rooms/${session.code}/leave`, { playerId: session.playerId });
  } catch {}
  wipeSession();
}

function inviteCodeFromUrl() {
  const code = new URLSearchParams(location.search).get('room');
  return code ? code.trim().toUpperCase().slice(0, 4) : '';
}
function renderHome() {
  const invite = inviteCodeFromUrl();
  const savedName = localStorage.getItem('rc_name') || '';
  app.innerHTML = `<div class="home"><section class="homeCard"><div class="brand"><b>RACE</b> COMMAND · WEB 2.0.0</div><h1 class="screenTitle">La gara, sui vostri telefoni.</h1><p class="subtitle">Stanza condivisa, strategie segrete simultanee, meteo, gomme, pit stop e duelli reali tra giocatori.</p><div class="field"><label>Nickname</label><input id="name" maxlength="18" placeholder="Andre" autocomplete="nickname" value="${escapeHtml(savedName)}"></div><div class="homeActions"><button class="btn primary" id="create">CREA PARTITA</button><button class="btn" id="joinToggle">ENTRA CON CODICE</button></div><div id="joinBox" ${invite ? '' : 'hidden'}><div class="field"><label>Codice stanza</label><input id="roomCode" maxlength="4" placeholder="F7K2" autocapitalize="characters" value="${escapeHtml(invite)}"></div><button class="btn green" id="join" style="width:100%;margin-top:10px">ENTRA</button></div><div class="homeNote">Nessun account richiesto. Online potete giocare anche da Wi-Fi, 5G o città diverse usando lo stesso link e codice stanza.</div></section></div>`;
  const nameEl = document.getElementById('name');
  const rememberName = () => localStorage.setItem('rc_name', nameEl.value.trim().slice(0, 18));
  document.getElementById('create').onclick = async () => {
    try {
      rememberName();
      const j = await post('/api/rooms', { name: nameEl.value.trim() || 'Host' });
      session = { code: j.code, playerId: j.playerId }; saveSession(); connect();
    } catch (e) { toast(e.message); }
  };
  document.getElementById('joinToggle').onclick = () => { const b = document.getElementById('joinBox'); b.hidden = !b.hidden; };
  document.getElementById('join').onclick = async () => {
    try {
      rememberName();
      const code = document.getElementById('roomCode').value.trim().toUpperCase();
      if (code.length !== 4) throw new Error('Inserisci il codice di 4 caratteri');
      const j = await post(`/api/rooms/${code}/join`, { name: nameEl.value.trim() || 'Pilota' });
      session = { code: j.code, playerId: j.playerId }; saveSession(); history.replaceState({}, '', '/'); connect();
    } catch (e) { toast(e.message); }
  };
}

function connect() {
  if (!session.code || !session.playerId) return renderHome();
  if (source) source.close();
  setNetwork(false, 'CONNESSIONE…');
  source = new EventSource(`/api/rooms/${session.code}/events?playerId=${encodeURIComponent(session.playerId)}`);
  source.onopen = () => { setNetwork(true); clearTimeout(reconnectCheck); };
  source.addEventListener('state', e => {
    state = JSON.parse(e.data);
    setNetwork(true);
    if (state.phase === 'action' && pendingTurn !== state.turn) { pendingTurn = state.turn; pendingAction = null; }
    if (state.me?.selectedAction) pendingAction = state.me.selectedAction;
    render();
  });
  source.addEventListener('resolution', e => {
    showResolution(JSON.parse(e.data));
  });
  source.addEventListener('duel_resolution', e => {
    duelResult = JSON.parse(e.data);
    showDuelResult(duelResult);
  });
  source.addEventListener('session_exit', e => {
    let info = {}; try { info = JSON.parse(e.data); } catch {}
    exitSessionLive(info.reason === 'accepted_close_request' ? 'Hai accettato: sei uscito dalla sessione' : 'Sei uscito dalla sessione');
  });
  source.addEventListener('session_closed', e => {
    exitSessionLive('Sessione chiusa definitivamente');
  });
  source.onerror = () => {
    setNetwork(false);
    clearTimeout(reconnectCheck);
    reconnectCheck = setTimeout(async () => {
      try {
        const fresh = await getJSON(`/api/rooms/${session.code}/state?playerId=${encodeURIComponent(session.playerId)}`);
        state = fresh; setNetwork(true); render();
      } catch (e) {
        if (/stanza|pilota|sessione chiusa/i.test(e.message)) { toast('La sessione non esiste più'); wipeSession(); }
      }
    }, 650);
  };
}

function render() {
  if (!state) { renderHome(); return; }
  if (state.status === 'lobby') renderLobby();
  else if (state.status === 'qualifying') renderQualifying();
  else if (state.status === 'starting') renderStarting();
  else if (state.status === 'racing') renderRace();
  else renderFinish();
  renderSessionCloseControls();
}
function exitSessionLive(message = 'Sei uscito dalla sessione') {
  toast(message);
  history.replaceState({}, '', '/');
  wipeSession();
}
async function requestSessionClose() {
  if (!state?.me || state.me.isBot) return;
  if (!window.confirm('Inviare a tutti i giocatori reali una richiesta per fermare la sessione? La tua risposta sarà automaticamente “OK, esco”.')) return;
  try {
    const result = await post(`/api/rooms/${state.code}/close-request`, { playerId: state.me.id });
    if (result.closed) exitSessionLive('Sessione chiusa definitivamente');
    else if (result.exited) exitSessionLive('Hai accettato: sei uscito dalla sessione');
  } catch (e) { toast(e.message); }
}
async function voteSessionClose(choice) {
  try {
    const result = await post(`/api/rooms/${state.code}/close-vote`, { playerId: state.me.id, choice });
    if (result.closed) exitSessionLive('Sessione chiusa definitivamente');
    else if (result.exited) exitSessionLive('Hai accettato: sei uscito dalla sessione');
  } catch (e) { toast(e.message); }
}
function renderSessionCloseControls() {
  document.getElementById('sessionStopFab')?.remove();
  document.getElementById('sessionCloseOverlay')?.remove();
  clearInterval(window.__rcCloseCount);
  if (!state?.me || state.me.isBot) return;
  const req = state.closeRequest;
  if (!req) {
    const btn = document.createElement('button');
    btn.id = 'sessionStopFab'; btn.className = 'sessionStopFab';
    btn.innerHTML = '⏹ <span>FERMA / ESCI</span>';
    btn.onclick = requestSessionClose;
    document.body.appendChild(btn);
    return;
  }
  const mine = req.myVote;
  const rows = req.voters.map(v => `<div class="closeVoteRow"><b>${escapeHtml(v.name)}${v.id === req.requesterId ? ' · RICHIEDENTE' : ''}</b><span class="closeVoteState ${v.vote || 'waiting'}">${v.vote === 'yes' ? '✅ OK, ESCO' : v.vote === 'no' ? '↩️ NO, RESTO' : '⏳ IN ATTESA'}</span></div>`).join('');
  const overlay = document.createElement('div');
  overlay.id = 'sessionCloseOverlay'; overlay.className = 'sessionCloseOverlay';
  overlay.innerHTML = `<section class="closeSessionCard"><div class="ey">Richiesta condivisa</div><h2>⏹️ Fermare la sessione?</h2><p class="subtitle"><b>${escapeHtml(req.requesterName)}</b> ha chiesto di interrompere la partita. Chi sceglie <b>OK</b> uscirà; chi sceglie <b>NO</b> resterà in gara. Se tutti accettano, la stanza viene chiusa definitivamente.</p><div class="closeTimer">⏱ <b id="closeVoteCountdown">—</b>s</div><div class="closeVoteList">${rows}</div>${mine ? `<div class="closeMyChoice ${mine}">${mine === 'yes' ? 'Hai scelto OK: uscirai quando la votazione termina.' : 'Hai scelto NO: resterai nella sessione.'}</div>` : `<div class="closeVoteActions"><button class="btn primary" id="closeVoteYes">OK · ESCO</button><button class="btn green" id="closeVoteNo">NO · RESTO</button></div>`}<div class="small closeRule">Durante la richiesta la gara è in pausa. Se non rispondi entro il tempo, vale automaticamente <b>NO · RESTO</b>.</div></section>`;
  document.body.appendChild(overlay);
  document.getElementById('closeVoteYes')?.addEventListener('click', () => voteSessionClose('yes'));
  document.getElementById('closeVoteNo')?.addEventListener('click', () => voteSessionClose('no'));
  const update = () => { const el = document.getElementById('closeVoteCountdown'); if (el) el.textContent = Math.max(0, Math.ceil((req.deadline - Date.now()) / 1000)); };
  update(); window.__rcCloseCount = setInterval(update, 250);
}
function tyreButtons(keys = ['S', 'M', 'H'], disabled = false, showPace = false) {
  const weatherName = state?.track?.name || 'DRY';
  const best = showPace ? Math.max(...keys.map(k => gripByTrack[weatherName]?.[k] || 3)) : null;
  return keys.map(k => {
    const die = gripByTrack[weatherName]?.[k] || 3;
    const badge = showPace ? `<small class="tyrePace ${die === best ? 'best' : ''}">D${die}${die === best ? ' · IDEALE' : ''}</small>` : '';
    return `<button class="tyreBtn ${selectedTyre === k ? 'active' : ''}" data-tyre="${k}" ${disabled ? 'disabled' : ''}><span class="ring" style="border-color:${colors[k]}">${k}</span><b>${names[k]}</b>${badge}</button>`;
  }).join('');
}
function rankOfPlayer(id) { const i = state?.players?.findIndex(p => p.id === id) ?? -1; return i >= 0 ? i + 1 : null; }
function gapToLeader(p, index) {
  if (!state?.players?.length || index === 0) return 'LEADER';
  const gap = Math.max(0, state.players[0].progress - p.progress);
  return `+${gap.toFixed(gap < 10 ? 1 : 0)}`;
}
function gapToAhead(p, index) {
  if (!state?.players?.length || index === 0) return '—';
  const gap = Math.max(0, state.players[index - 1].progress - p.progress);
  return `+${gap.toFixed(1)}`;
}
function compactStandings(highlightIds = []) {
  return `<div class="rank compactRank">${state.players.map((p, i) => `<div class="rankRow ${p.id === state.me.id ? 'me' : ''} ${highlightIds.includes(p.id) ? 'duelActive' : ''}"><b>${i + 1}</b><i class="dot ${p.connected ? 'online' : ''}" style="background:${p.color}"></i><div><b>${escapeHtml(p.name)}</b><div class="small">${names[p.tyre]} · ${p.wear}% · ERS ${p.ers}%</div></div><span class="gapChip">${gapToLeader(p, i)}</span></div>`).join('')}</div>`;
}
function shareInvite() {
  const url = `${location.origin}/?room=${encodeURIComponent(state.code)}`;
  if (navigator.share) navigator.share({ title: 'Race Command', text: `Entra nella mia gara Race Command — stanza ${state.code}`, url }).catch(() => {});
  else window.prompt('Condividi questo link', url);
}
function renderLobby() {
  const me=state.me,isHost=state.hostId===me.id,humans=state.players.filter(p=>!p.isBot).length,bots=state.players.filter(p=>p.isBot).length;
  selectedTyre=me.tyre||selectedTyre; const humansReady=state.players.filter(p=>!p.isBot).every(p=>p.ready); const trackName=state.track?.name||'DRY';
  const advice=trackName==='DRY'?'Asfalto asciutto: scegli fra Soft, Medium e Hard.':trackName==='DAMP'?'Pista umida: Intermediate normalmente ideale.':trackName==='WET'?'Pista bagnata: Wet favorite, Inter ancora possibile.':'Molta acqua: Wet fortemente consigliate.';
  const c=state.circuit||{name:'CATALUNYA',country:'Spagna',traits:[]};
  const circuitOptions=Object.entries(circuitInfo).map(([id,x])=>`<option value="${id}" ${state.circuitId===id?'selected':''}>${x.name} · ${x.country}</option>`).join('');
  app.innerHTML=`<div class="app"><div class="topbar"><div><div class="brand"><b>RACE</b> COMMAND · 2.0</div><h2 style="margin-top:3px">Pre-race · ${c.name}</h2></div><div class="badges"><span class="badge">STANZA ${state.code}</span><span class="badge">${humans} UMANI + ${bots} BOT = 6</span><button class="btn ghost" id="leave">ESCI</button></div></div><div class="lobbyGrid lobbyV2"><section class="panel"><div class="ey">Codice da condividere</div><div class="roomCode">${state.code}</div><p class="subtitle">La griglia resta sempre da 6. Ogni umano che entra sostituisce automaticamente un bot.</p><button class="btn" id="share">CONDIVIDI INVITO</button><div class="players">${state.players.map(p=>`<div class="playerRow"><i class="dot ${p.connected?'online':''}" style="background:${p.color}"></i><div><div class="pname">${escapeHtml(p.name)} ${p.id===state.hostId?'👑':''}</div><div class="small">${p.isBot?`🤖 ${String(p.personality||'AI').toUpperCase()} · `:p.connected?'🟢 ONLINE · ':'⚪ OFFLINE · '}${names[p.tyre]}</div></div><span class="ready ${p.ready?'on':''}">${p.isBot?'AUTO':p.ready?'READY':'WAIT'}</span></div>`).join('')}</div></section><section class="panel preRaceSetup"><div class="setupGrid"><div class="settingsCard circuitSetup"><div class="ey">Circuito</div>${isHost?`<select id="circuitSelect">${circuitOptions}</select>`:`<b>${c.name} · ${c.country}</b>`}<div class="circuitTraits">${(c.traits||[]).map(t=>`<span>${t}</span>`).join('')}</div><div class="small">Usura ×${Number(c.tyreWear||1).toFixed(2)} · DRS +${c.drsBonus||2} · pit loss ${c.pitLoss||5}</div></div><div class="settingsCard"><div class="ey">Formato</div>${isHost?`<select id="laps"><option value="3" ${state.maxLaps===3?'selected':''}>3 giri · sprint</option><option value="5" ${state.maxLaps===5?'selected':''}>5 giri · standard</option><option value="8" ${state.maxLaps===8?'selected':''}>8 giri · lunga</option><option value="10" ${state.maxLaps===10?'selected':''}>10 giri · GP</option></select><label class="toggleSetting"><input id="qualiToggle" type="checkbox" ${state.qualifyingEnabled?'checked':''}> <span>QUALIFICA RAPIDA</span></label>`:`<b>${state.maxLaps} giri · ${state.qualifyingEnabled?'con qualifica':'griglia casuale'}</b>`}</div></div><div class="preRaceWeather"><div class="row"><div><div class="ey">Meteo</div><div class="preWeatherNow">${state.weather.icon} ${state.weather.label||state.weather.name}</div></div><span class="badge">${state.weather.rain}% PIOGGIA</span></div><div class="trackStateRow"><b>${state.track.icon} PISTA ${state.track.label}</b><span>${state.trackWetness}% acqua</span></div><div class="small preWeatherAdvice">${advice}</div><div class="forecast preForecast">${forecast()}</div></div><div class="ey" style="margin-top:14px">Gomma di partenza</div><div class="tyres" id="tyres">${tyreButtons(['S','M','H','I','W'],me.ready,true)}</div>${me.ready?'<div class="small" style="margin-top:7px">Annulla READY per cambiare mescola.</div>':'<div class="small" style="margin-top:7px">Il dado mostrato usa lo stato reale della pista, non solo la pioggia.</div>'}<button class="btn ${me.ready?'':'green'}" id="readyBtn" style="width:100%;margin-top:10px">${me.ready?'ANNULLA READY':'READY'}</button>${isHost?`<button class="btn primary" id="start" style="width:100%;margin-top:10px" ${!humansReady?'disabled':''}>${state.qualifyingEnabled?'AVVIA QUALIFICA':'START RACE'} · 6 PILOTI</button>`:''}</section></div></div>`;
  document.getElementById('leave').onclick=leaveRoom; document.getElementById('share').onclick=shareInvite;
  document.querySelectorAll('[data-tyre]').forEach(b=>b.onclick=async()=>{if(me.ready)return;const old=selectedTyre;selectedTyre=b.dataset.tyre;document.querySelectorAll('[data-tyre]').forEach(x=>x.classList.toggle('active',x.dataset.tyre===selectedTyre));try{await post(`/api/rooms/${state.code}/ready`,{playerId:me.id,ready:false,tyre:selectedTyre});}catch(e){selectedTyre=old;toast(e.message);render();}});
  document.getElementById('readyBtn').onclick=async()=>{try{await post(`/api/rooms/${state.code}/ready`,{playerId:me.id,ready:!me.ready,tyre:selectedTyre});}catch(e){toast(e.message);}};
  if(isHost){
    document.getElementById('start').onclick=async()=>{try{await post(`/api/rooms/${state.code}/start`,{playerId:me.id});}catch(e){toast(e.message);}};
    document.getElementById('laps').onchange=e=>post(`/api/rooms/${state.code}/settings`,{playerId:me.id,maxLaps:Number(e.target.value)}).catch(e=>toast(e.message));
    document.getElementById('qualiToggle').onchange=e=>post(`/api/rooms/${state.code}/settings`,{playerId:me.id,qualifyingEnabled:e.target.checked}).catch(e=>toast(e.message));
    document.getElementById('circuitSelect').onchange=async e=>{try{await post(`/api/rooms/${state.code}/settings`,{playerId:me.id,circuitId:e.target.value});toast('Circuito aggiornato · READY azzerati');}catch(err){toast(err.message);}};
  }
}

function renderQualifying(){
  const me=state.me,q=state.qualifying,c=state.circuit; const locked=!!q?.myChoice;
  const result=q?.result;
  app.innerHTML=`<div class="home"><section class="homeCard qualiCard"><div class="brand"><b>RACE</b> COMMAND · ${state.code}</div><div class="ey">${c.name} · QUALIFYING SHOOTOUT</div><h1 class="screenTitle">UN GIRO. UNA SCELTA.</h1><p class="subtitle">SAFE è stabile. PUSH dà +2. MAX ATTACK dà +4 ma può invalidare il giro.</p>${result?`<div class="qualiResults">${result.map((r,i)=>`<div class="qualiRow ${r.id===me.id?'me':''}"><b>P${i+1}</b><span>${escapeHtml(r.name)}</span><em>${r.choice.toUpperCase()} · ${r.invalid?'ERRORE · ':''}${r.score}</em></div>`).join('')}</div><div class="waiting"><b>Griglia definita · preparazione semafori…</b></div>`:`<div class="qualiChoices"><button data-quali="safe" ${locked?'disabled':''}><b>SAFE</b><small>D10 · nessun bonus · rischio minimo</small></button><button data-quali="push" ${locked?'disabled':''}><b>PUSH</b><small>D10 +2 · piccolo rischio errore</small></button><button data-quali="max" ${locked?'disabled':''}><b>MAX ATTACK</b><small>D10 +4 · rischio giro invalidato</small></button></div><div class="waiting"><b>${locked?`SCELTA BLOCCATA: ${q.myChoice.toUpperCase()}`:`${q?.locked||0} / ${q?.total||6} hanno scelto`}</b><span>⏱ ${secondsLeft()}s</span></div>`}</section></div>`;
  document.querySelectorAll('[data-quali]').forEach(b=>b.onclick=async()=>{try{await post(`/api/rooms/${state.code}/qualifying`,{playerId:me.id,choice:b.dataset.quali});toast('Qualifica bloccata 🔒');}catch(e){toast(e.message);}});
}

function secondsLeft() { return state?.deadline ? Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)) : 0; }
function renderStarting() {
  app.innerHTML = `<div class="home"><section class="homeCard startCard"><div class="brand"><b>RACE</b> COMMAND · ${state.code}</div><div class="ey" style="margin-top:20px">${state.circuit.name} · ${state.maxLaps} giri · ${state.players.length} piloti</div><h1 class="screenTitle" style="font-size:38px">LIGHTS OUT</h1><div class="startLights" id="startLights">${Array.from({ length: 5 }, (_, i) => `<i data-light="${i}"></i>`).join('')}</div><div class="startMessage" id="startMessage">Preparati…</div><div class="gridPreview">${state.players.map((p, i) => `<span><b>P${i + 1}</b> ${escapeHtml(p.name)}</span>`).join('')}</div></section></div>`;
  clearInterval(window.__rcLights);
  const update = () => {
    if (!state || state.status !== 'starting') return clearInterval(window.__rcLights);
    const left = Math.max(0, state.deadline - Date.now());
    const elapsed = Math.max(0, 4000 - left);
    const lit = Math.min(5, Math.floor(elapsed / 620) + (elapsed > 150 ? 1 : 0));
    document.querySelectorAll('[data-light]').forEach((el, i) => el.classList.toggle('on', i < lit));
    const msg = document.getElementById('startMessage');
    if (msg) msg.textContent = left < 350 ? 'GO!' : 'Preparati…';
  };
  update(); window.__rcLights = setInterval(update, 90);
}

function sectorText(s) { return s === 1 ? ['SETTORE 1 · SPEED', 'DRS e scia sono particolarmente efficaci.'] : s === 2 ? ['SETTORE 2 · TECHNICAL', 'ATTACK consuma più gomma e aumenta il rischio.'] : ['SETTORE 3 · STRATEGY', 'Se hai programmato il pit, entrerai automaticamente raggiungendo la pit-entry.']; }
function forecast() {
  const icons=['☀️','☁️','🌧️','⛈️']; const base=state.weatherIndex||0;
  return [0,1,2,3].map(x=>{const drift=x>=2?(state.weather.rain>50?0:-1):0;const wi=Math.max(0,Math.min(3,base+drift));const chance=Math.max(3,Math.min(98,(state.weather.rain||5)+(x*4)));return `<div><span>${x?`+${x*10}m`:'ORA'}</span><b>${icons[wi]}</b><span>${chance}%</span></div>`;}).join('');
}
function trackSvg() {
  const cp=circuitPaths[state.circuitId]||circuitPaths.catalunya, d=cp.race, pit=cp.pit;
  return `<svg id="trackSvg" viewBox="0 0 560 360" role="img" aria-label="${escapeHtml(state.circuit.name)}"><path id="racePath" class="road" pathLength="30" d="${d}"/><path class="line" pathLength="30" d="${d}"/><path class="sectorStroke s1" pathLength="30" d="${d}"/><path class="sectorStroke s2" pathLength="30" d="${d}"/><path class="sectorStroke s3" pathLength="30" d="${d}"/><path id="pitPath" class="pit" d="${pit}"/><text x="30" y="190" class="finishText">START / FINISH</text><text x="112" y="65" fill="var(--green)" font-size="13" font-weight="900">S1 · SPEED</text><text x="386" y="67" fill="var(--yellow)" font-size="13" font-weight="900">S2 · TECH</text><text x="336" y="319" fill="var(--accent)" font-size="13" font-weight="900">S3 · STRATEGY</text><text x="130" y="319" fill="var(--blue)" font-size="12" font-weight="900">PIT ENTRY →</text>${state.players.map(p=>`<g id="car-${p.id}" class="car ${state.duel&&[state.duel.attackerId,state.duel.defenderId].includes(p.id)?'duelCar':''}"><circle r="${p.id===state.me.id?17:15}" fill="${p.color}"/><text>${p.id===state.me.id?'YOU':escapeHtml(p.name.slice(0,2).toUpperCase())}</text></g>`).join('')}</svg>`;
}
function positionCars() {
  requestAnimationFrame(() => {
    const path = document.getElementById('racePath'); if (!path || !state) return;
    const len = path.getTotalLength();
    for (const p of state.players) {
      const el = document.getElementById(`car-${p.id}`); if (!el) continue;
      const frac = ((p.progress % state.rules.cellsPerLap) + state.rules.cellsPerLap) % state.rules.cellsPerLap / state.rules.cellsPerLap;
      const pt = path.getPointAtLength(frac * len); el.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    }
  });
}
function actionButton(action, title, desc, disabled, wide = false) {
  const selected = pendingAction === action;
  return `<button class="action ${wide ? 'box' : ''} ${selected ? 'selected' : ''}" data-action="${action}" ${disabled ? 'disabled' : ''}>${title}<small>${desc}</small></button>`;
}
function renderRace() {
  if (!state || state.status !== 'racing') return;
  if (state.phase === 'duel' || state.phase === 'duel_result') return renderBattle();
  const me = state.me, [secName, secHint] = sectorText(me.sector), locked = !!me.selectedAction;
  const plan = me.pitPlanTyre;
  const pitDistanceText = me.boxDistance === 0 ? 'PIT ENTRY ORA' : `PIT ENTRY FRA ${me.boxDistance}`;
  const pitStatus = plan
    ? `<div><div class="ey">Pit strategy</div><b>BOX PROGRAMMATO · ${names[plan]}</b><div class="small">${pitDistanceText} · entrerai automaticamente appena la raggiungi</div></div>`
    : `<div><div class="ey">Pit strategy</div><b>${pitDistanceText}</b><div class="small">Puoi programmare il prossimo cambio gomme in qualsiasi momento</div></div>`;
  const rankingHtml = state.players.map((p, i) => `<div class="rankRow ${p.id === me.id ? 'me' : ''}"><b>${i + 1}</b><i class="dot ${p.connected ? 'online' : ''}" style="background:${p.color}"></i><div><b>${escapeHtml(p.name)}</b><div class="small">${names[p.tyre]} · ${p.wear}% · ERS ${p.ers}%${p.connected ? '' : p.isBot ? '' : ' · OFFLINE'}</div></div><span class="gapChip" title="Distacco dal leader">${gapToLeader(p, i)}</span></div>`).join('');
  const raceLogHtml = state.raceLog.slice().reverse().map(x => `<div>${escapeHtml(x)}</div>`).join('');
  app.innerHTML = `<div class="app raceApp"><div class="topbar raceTopbar"><div><div class="brand"><b>RACE</b> COMMAND · ${state.code}</div><h2 style="margin-top:3px">${state.circuit.name} · GP</h2></div><div class="badges"><span class="badge">Giro ${me.lap} / ${state.rules.maxLaps}</span><span class="badge">${state.weather.icon} ${state.weather.label||state.weather.name}</span><span class="badge">${state.track.icon} ${state.track.label}</span><span class="badge">${state.safetyTurns ? `🟡 SC · ${state.safetyTurns} TURNI` : '🟢 GREEN'}</span><span class="badge buildBadge">v2.0.0</span>${soundToggleHtml()}</div></div><div class="raceLayout raceLayoutWide"><section class="panel raceControlsPanel"><div class="stats"><div class="card"><div class="ey">Posizione</div><div class="big">${me.rank}°</div><div class="small">${me.rank === 1 ? 'Leader' : `+${(state.players[me.rank-2].progress-me.progress).toFixed(1)} dalla P${me.rank-1}`}</div></div><div class="card"><div class="ey">Avanzamento</div><div class="big">${Math.floor(me.progress)}</div><div class="small">caselle totali</div></div></div><div class="card tyreStatusCard"><div class="row"><div class="tyreLine"><span class="ring" style="border-color:${colors[me.tyre]};margin:0">${me.tyre}</span><div><div class="ey">${names[me.tyre]}</div><b>Ritmo D${me.effectiveDie}${state.track.name !== 'DRY' && ['S','M','H'].includes(me.tyre) ? ' ⚠️' : ''}</b></div></div><div style="text-align:right"><div class="ey">Usura</div><b>${me.wear}%</b></div></div><div class="bar" style="margin-top:8px"><i style="width:${me.wear}%"></i></div>${me.damage?`<div class="damageWarning">🛠️ ALA DANNEGGIATA · -1 finché non vai ai box</div>`:""}</div><div class="card ersStatusCard"><div class="row"><div class="ey">ERS</div><b>${me.ers}%</b></div><div class="bar" style="margin-top:7px"><i style="width:${me.ers}%"></i></div></div><div class="card sectorCard"><div class="row"><div><div class="ey">Zona pista</div><b>${secName}</b><div class="small">${secHint}</div></div><span class="badge ${me.drs ? 'drsOn' : ''}">${me.drs ? 'DRS ON' : 'DRS OFF'}</span></div></div><div class="card weatherCard"><div class="row"><div><div class="ey">Meteo</div><b class="weatherNow">${state.weather.icon} ${state.weather.label||state.weather.name}</b></div><span class="small">${state.weather.rain}% pioggia</span></div><div class="trackStateMini">${state.track.icon} PISTA ${state.track.label} · ${state.trackWetness}%</div><div class="forecast">${forecast()}</div></div><div class="card pitPlanCard"><div class="row pitPlanRow">${pitStatus}<div class="pitPlanActions"><button class="btn ${plan ? '' : 'primary'}" id="pitPlanBtn">${plan ? 'CAMBIA PIANO' : 'PROGRAMMA PIT'}</button>${plan ? '<button class="btn" id="cancelPitPlan">ANNULLA</button>' : ''}</div></div></div><div class="card actionCard"><div class="row"><div><div class="ey">Fase simultanea</div><b>${locked ? 'SCELTA BLOCCATA 🔒' : state.phase === 'resolving' ? 'RISOLUZIONE…' : 'SCEGLI E CONFERMA'}</b></div><div class="big" id="countdown">${secondsLeft()}</div></div><div class="actionGrid">${actionButton('normal', 'NORMALE', 'ritmo standard', locked || state.phase !== 'action')}${actionButton('attack', 'ATTACK', '+2 · più usura', locked || state.phase !== 'action')}${actionButton('conserve', 'CONSERVE', '-1 · salva gomme', locked || state.phase !== 'action')}${actionButton('ers', 'ERS', me.ers >= 25 ? '+3 · costa 25%' : `serve 25% · hai ${me.ers}%`, locked || state.phase !== 'action' || me.ers < 25)}</div>${!locked && state.phase === 'action' ? `<button class="btn primary confirmAction" id="confirmAction" ${!pendingAction ? 'disabled' : ''}>${pendingAction ? `CONFERMA ${pendingAction.toUpperCase()}` : 'SCEGLI UN’AZIONE'}</button>` : ''}<div class="small lockCount">${state.lockedCount} / ${state.totalPlayers} piloti hanno bloccato la scelta</div><div class="resolution ${resolutionData ? 'show' : ''}" id="resolution"></div></div></section><section class="panel raceTrackPanel"><div class="trackHeader"><div><div class="ey">Circuito live</div><b>${state.circuit.name}</b></div><div class="trackMiniStatus"><span>${me.drs ? 'DRS DISPONIBILE' : secName}</span><span>${plan ? `BOX → ${names[plan]}` : pitDistanceText}</span></div></div>${trackFrame()}</section><aside class="raceSidebar"><section class="panel raceRankingPanel"><div class="sidebarTitle"><div><div class="ey">Classifica live</div><b>6 PILOTI</b></div><span class="badge">P${me.rank}</span></div><div class="rank">${rankingHtml}</div></section><section class="panel raceFeedPanel"><div class="sidebarTitle"><div><div class="ey">Race Control</div><b>EVENTI GARA</b></div><span class="badge">LIVE</span></div><div class="feed">${raceLogHtml}</div></section></aside></div></div>`;
  positionCars(); bindRaceActions(); bindSoundToggle(); startCountdown(); if (resolutionData) renderResolutionBox(resolutionData);
}
function startCountdown() {
  const el = document.getElementById('countdown'); if (!el) return;
  clearInterval(window.__rcCount);
  window.__rcCount = setInterval(() => { const current = document.getElementById('countdown'); if (current) current.textContent = secondsLeft(); }, 250);
}
function bindRaceActions() {
  document.querySelectorAll('[data-action]').forEach(b => b.onclick = () => {
    pendingAction = b.dataset.action; pendingTurn = state.turn; render();
  });
  const confirm = document.getElementById('confirmAction');
  if (confirm) confirm.onclick = () => submitAction(pendingAction);
  const pitPlanBtn = document.getElementById('pitPlanBtn');
  if (pitPlanBtn) pitPlanBtn.onclick = openPit;
  const cancelPit = document.getElementById('cancelPitPlan');
  if (cancelPit) cancelPit.onclick = () => setPitPlan(null);
}
async function submitAction(action) {
  if (!action) return;
  try {
    await post(`/api/rooms/${state.code}/action`, { playerId: state.me.id, action });
    toast('Scelta bloccata 🔒');
  } catch (e) { toast(e.message); }
}
async function setPitPlan(pitTyre) {
  try {
    await post(`/api/rooms/${state.code}/pit-plan`, { playerId: state.me.id, pitTyre });
    toast(pitTyre ? `🔧 Pit programmato: ${names[pitTyre]}` : 'Pit annullato');
  } catch (e) { toast(e.message); }
}
function openPit() {
  selectedTyre = state.me.pitPlanTyre || (state.track.name === 'DAMP' ? 'I' : state.track.name.includes('WET') ? 'W' : 'S');
  const overlay = document.createElement('div'); overlay.className = 'overlay';
  const draw = () => {
    const ideal = gripByTrack[state.track.name];
    overlay.innerHTML = `<div class="modal"><div class="ey">Pit strategy</div><h2>Programma il prossimo pit stop</h2><p class="subtitle">Puoi deciderlo in qualsiasi punto del circuito. Continuerai a scegliere il ritmo ogni turno e la monoposto entrerà automaticamente quando il movimento raggiunge o supera la pit-entry.</p><div class="tyres" id="pitTyres">${tyreButtons(['S', 'M', 'H', 'I', 'W'], false, true)}</div><div class="pitAdvice">Pista: <b>${state.track.icon} ${state.track.label} · ${state.trackWetness}%</b> · ingresso box fra <b>${state.me.boxDistance}</b> caselle · ${names[selectedTyre]} = <b>D${ideal[selectedTyre]}</b></div><div class="modalBtns"><button class="btn" id="cancelPit">CHIUDI</button>${state.me.pitPlanTyre ? '<button class="btn" id="removePlan">ANNULLA PIT</button>' : ''}<button class="btn primary" id="confirmPit">PROGRAMMA ${names[selectedTyre]}</button></div></div>`;
    overlay.querySelectorAll('[data-tyre]').forEach(b => b.onclick = () => { selectedTyre = b.dataset.tyre; draw(); });
    overlay.querySelector('#cancelPit').onclick = () => overlay.remove();
    const remove = overlay.querySelector('#removePlan'); if (remove) remove.onclick = async () => { await setPitPlan(null); overlay.remove(); };
    overlay.querySelector('#confirmPit').onclick = async () => { await setPitPlan(selectedTyre); overlay.remove(); };
  };
  document.body.appendChild(overlay); draw();
}
function showResolution(r) {
  resolutionData = r;
  clearResolutionTimers();
  if (state && state.status === 'racing' && state.phase !== 'duel') render();
  renderResolutionBox(r);
  playResolutionSequence(r);
  later(() => { resolutionData = null; const box = document.getElementById('resolution'); if (box) { box.classList.remove('show'); box.innerHTML = ''; } }, 1750);
}
function renderResolutionBox(r) {
  const my = r.results[state.me.id], el = document.getElementById('resolution'); if (!my || !el) return;
  const actionName = (state.me.selectedAction || pendingAction || 'normal').toUpperCase();
  el.innerHTML = `<div class="resolutionTop"><div><div class="ey">Turno ${r.turn} · ${actionName}</div><b>Risoluzione server</b></div><div class="turnPipeline"><span class="active" id="pipeRoll">1 · DADO</span><span id="pipeMods">2 · BONUS</span><span id="pipeMove">3 · MOVIMENTO</span></div></div><div class="diceStage"><div class="diceShadow"></div><div class="diceShell d${my.die} rolling" id="liveDie"><span id="liveDieValue">?</span><small>D${my.die}</small></div></div><div class="chips resolutionMods" id="resolutionMods"><span class="chip baseChip">BASE D${my.die}</span>${my.mods.map(m => `<span class="chip modChip">${escapeHtml(m)}</span>`).join('')}</div><div class="totalPace" id="totalPace">PACE <b>—</b></div>`;
}
function playResolutionSequence(r) {
  const my = r.results[state.me.id]; if (!my) return;
  const die = document.getElementById('liveDie'), value = document.getElementById('liveDieValue');
  const mods = [...document.querySelectorAll('#resolutionMods .modChip')], total = document.getElementById('totalPace');
  if (!die || !value) { animateTrack(r, 850); return; }
  playFx('roll');
  let tick = 0;
  const roller = setInterval(() => { value.textContent = String(1 + Math.floor(Math.random() * my.die)); if (++tick > 12) clearInterval(roller); }, 42);
  resolutionTimers.push(roller);
  later(() => {
    clearInterval(roller); value.textContent = my.raw; die.classList.remove('rolling'); die.classList.add('landed'); playFx('land');
    document.getElementById('pipeRoll')?.classList.add('done'); document.getElementById('pipeMods')?.classList.add('active');
  }, 420);
  mods.forEach((chip, i) => later(() => chip.classList.add('reveal'), 500 + i*70));
  later(() => {
    if (total) { total.innerHTML = `PACE <b>${my.move}</b>`; total.classList.add('show'); }
    document.getElementById('pipeMods')?.classList.add('done'); document.getElementById('pipeMove')?.classList.add('active');
    animateTrack(r, 760);
    if (my.pitted) playFx('pit');
  }, 650 + Math.min(240, mods.length*55));
  later(() => {
    document.getElementById('pipeMove')?.classList.add('done');
    const ids = Object.keys(r.oldPositions || {});
    const oldOrder = [...ids].sort((a,b)=>(r.oldPositions[b]||0)-(r.oldPositions[a]||0));
    const newOrder = [...ids].sort((a,b)=>(r.newPositions[b]||0)-(r.newPositions[a]||0));
    const oldRank = oldOrder.indexOf(state.me.id)+1, newRank = newOrder.indexOf(state.me.id)+1;
    if (my.pitted) showRaceEvent(`🔧 BOX · ${names[my.pitTyre]}`, 'pit');
    else if (newRank && oldRank && newRank < oldRank) { showRaceEvent(`▲ SORPASSO · P${oldRank} → P${newRank}`, 'gain'); playFx('pass'); }
    else if (newRank && oldRank && newRank > oldRank) { showRaceEvent(`▼ POSIZIONE PERSA · P${oldRank} → P${newRank}`, 'loss'); playFx('warning'); }
    else if (my.mods.some(m=>m.startsWith('DRS'))) showRaceEvent('DRS +2 · ATTACCO APERTO', 'drs');
  }, 1450);
}
function pointOn(path, frac) { return path.getPointAtLength(Math.max(0, Math.min(1, frac)) * path.getTotalLength()); }
function animateTrack(r, dur = 850) {
  requestAnimationFrame(() => {
    const racePath = document.getElementById('racePath'), pitPath = document.getElementById('pitPath');
    if (!racePath || !state) return;
    cancelAnimationFrame(animFrame);
    const start = performance.now();
    const ids = Object.keys(r.oldPositions || {});
    const oldOrder = [...ids].sort((a,b)=>(r.oldPositions[b]||0)-(r.oldPositions[a]||0));
    const newOrder = [...ids].sort((a,b)=>(r.newPositions[b]||0)-(r.newPositions[a]||0));
    const gained = new Set(ids.filter(id => newOrder.indexOf(id) < oldOrder.indexOf(id)));
    function racePoint(progress) {
      const frac = ((progress % state.rules.cellsPerLap) + state.rules.cellsPerLap) % state.rules.cellsPerLap / state.rules.cellsPerLap;
      return pointOn(racePath, frac);
    }
    function frame(t) {
      const f = Math.min(1, (t - start) / dur), ease = f < .5 ? 2*f*f : 1 - Math.pow(-2*f+2,2)/2;
      for (const p of r.players) {
        const el = document.getElementById(`car-${p.id}`); if (!el) continue;
        const a = r.oldPositions[p.id] ?? p.progress, b = r.newPositions[p.id] ?? p.progress, result = r.results[p.id];
        let pt;
        if (result?.pitted && pitPath) {
          if (f < .28) {
            const startPt = racePoint(a), entryPt = pointOn(pitPath, 0), lf = f / .28;
            pt = { x: startPt.x + (entryPt.x - startPt.x) * lf, y: startPt.y + (entryPt.y - startPt.y) * lf };
          } else if (f < .80) pt = pointOn(pitPath, (f - .28) / .52);
          else {
            const exitPt = pointOn(pitPath, 1), endPt = racePoint(b), lf = (f - .80) / .20;
            pt = { x: exitPt.x + (endPt.x - exitPt.x) * lf, y: exitPt.y + (endPt.y - exitPt.y) * lf };
          }
        } else { const v = a + (b - a) * ease; pt = racePoint(v); }
        el.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
        el.classList.toggle('overtakeCar', gained.has(p.id) && f > .42);
        el.classList.toggle('pitCar', !!result?.pitted && f > .25 && f < .88);
      }
      if (f < 1) animFrame = requestAnimationFrame(frame);
    }
    animFrame = requestAnimationFrame(frame);
  });
}

function duelOptions(role, me) {
  if(role==='attack') return [['inside','INTERNO','+2 · batte COPRI ESTERNO',false],['outside','ESTERNO','+2 · batte COPRI INTERNO',false],['cutback','CUTBACK','+1 · forte contro FRENATA TARDIVA',false],['ersAttack','ERS ATTACK','+3 · costa 15% ERS',me.ers<15]];
  return [['coverInside','COPRI INTERNO','+2 · chiude INTERNO',false],['coverOutside','COPRI ESTERNO','+2 · chiude ESTERNO',false],['lateBrake','FRENATA TARDIVA','+3 · rischio contatto',false],['ersDef','ERS DEFENCE','+3 · costa 15% ERS',me.ers<15],['noFight','NON COMBATTERE','cedi la posizione e salvi risorse',false]];
}
function startDuelCountdown() {
  clearInterval(window.__rcDuelCount);
  const update = () => { const el = document.getElementById('duelCountdown'); if (el) el.textContent = secondsLeft(); };
  update(); window.__rcDuelCount = setInterval(update, 250);
}
function renderBattle() {
  const d = state.duel, me = state.me, involved = d && [d.attackerId, d.defenderId].includes(me.id), role = me.id === d?.attackerId ? 'attack' : 'defend';
  const oppId = role === 'attack' ? d?.defenderId : d?.attackerId;
  const opp = state.players.find(p => p.id === oppId);
  const locked = !!d?.myChoice, attackerRank = rankOfPlayer(d?.attackerId), defenderRank = rankOfPlayer(d?.defenderId);
  const duelGap = d ? Math.abs((state.players.find(p=>p.id===d.attackerId)?.progress || 0) - (state.players.find(p=>p.id===d.defenderId)?.progress || 0)).toFixed(1) : '—';
  const pitMini = `<div class="card" style="margin-top:9px"><div class="row" style="align-items:flex-start"><div><div class="ey">Pit strategy</div><b>${me.pitPlanTyre ? `BOX PROGRAMMATO · ${names[me.pitPlanTyre]}` : `PIT ENTRY FRA ${me.boxDistance}`}</b><div class="small">${me.pitPlanTyre ? 'Entrata automatica alla prossima pit-entry' : 'Puoi programmare il cambio anche durante il duello'}</div></div><div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn" id="battlePitPlan">${me.pitPlanTyre ? 'CAMBIA' : 'PROGRAMMA'}</button>${me.pitPlanTyre ? '<button class="btn" id="battleCancelPit">ANNULLA</button>' : ''}</div></div></div>`;
  const context = `<aside class="battleContext"><div class="card contextSummary"><div class="ey">Situazione prima della scelta</div><div class="contextVs"><div><b>${escapeHtml(d?.attackerName || '')}</b><span>P${attackerRank || '—'} · ATTACCA</span></div><strong>${duelGap}<small> cas.</small></strong><div><b>${escapeHtml(d?.defenderName || '')}</b><span>P${defenderRank || '—'} · DIFENDE</span></div></div></div>${trackFrame('miniTrack')}${pitMini}<div class="ey" style="margin-top:9px">Classifica live</div>${compactStandings([d?.attackerId,d?.defenderId])}</aside>`;
  const spectator = `<section class="panel battle"><div class="waiting"><div class="battleIcon">⚔️</div><div class="screenTitle" style="font-size:28px">Duello in corso</div><p class="subtitle">${escapeHtml(d?.attackerName || '')} sta attaccando ${escapeHtml(d?.defenderName || '')}. Puoi continuare a vedere mappa e classifica mentre aspetti.</p><div class="spectatorBattle"><b>${escapeHtml(d?.attackerName || '')}</b><span>VS</span><b>${escapeHtml(d?.defenderName || '')}</b></div></div></section>`;
  const options = involved ? duelOptions(role, me) : [];
  const battle = involved ? `<section class="panel battle"><div class="battleTop"><div><div class="ey">${role === 'attack' ? 'Stai attaccando' : 'Stai difendendo'}</div><h2>YOU vs ${escapeHtml(opp?.name || '')}</h2><div class="duelResources"><span>P${me.rank} · ${names[me.tyre]} ${me.wear}%</span><span>ERS ${me.ers}%</span><span>Rivale P${rankOfPlayer(oppId)} · ${names[opp?.tyre] || ''} ${opp?.wear ?? '—'}%</span></div></div><span class="role">${role === 'attack' ? 'ATTACCANTE' : 'DIFENSORE'}</span></div><div class="arena"><div class="row"><b>YOU</b><b>${escapeHtml(opp?.name || '')}</b></div><div class="lane"><div class="battleCar you" id="battleYou">YOU</div><div class="battleCar rival" id="battleRival">R</div></div><div class="reveal"><div class="choice" id="myReveal">${duelResult ? duelLabels[role === 'attack' ? duelResult.attackerChoice : duelResult.defenderChoice] : (locked ? 'LOCKED 🔒' : '?')}</div><b>VS</b><div class="choice" id="oppReveal">${duelResult ? duelLabels[role === 'attack' ? duelResult.defenderChoice : duelResult.attackerChoice] : '?'}</div></div><div class="duelDiceReveal" id="duelDiceReveal">${duelResult ? `<div><span>D6</span><b>${role === 'attack' ? duelResult.attackerRoll : duelResult.defenderRoll}</b><small>${role === 'attack' ? `+${duelResult.attackerBonus}` : `+${duelResult.defenderBonus}`}</small></div><strong>${role === 'attack' ? duelResult.attackerScore : duelResult.defenderScore} — ${role === 'attack' ? duelResult.defenderScore : duelResult.attackerScore}</strong><div><span>D6</span><b>${role === 'attack' ? duelResult.defenderRoll : duelResult.attackerRoll}</b><small>${role === 'attack' ? `+${duelResult.defenderBonus}` : `+${duelResult.attackerBonus}`}</small></div>` : '<em>Scegli la mossa</em>'}</div>${duelResult?.matchup?`<div class="matchupBanner">${escapeHtml(duelResult.matchup)}</div>`:''}</div>${state.phase === 'duel' && !locked ? `<div class="duelGrid">${options.map(([k,t,s,disabled]) => `<button class="duelBtn ${selectedDuel === k ? 'active' : ''}" data-duel="${k}" ${disabled ? 'disabled' : ''}>${t}<small>${disabled ? `${s} · NON DISPONIBILE` : s}</small></button>`).join('')}</div><div class="duelExplain">Il punteggio è <b>D6 + bonus + contro-mossa</b>. INTERNO/ESTERNO possono essere coperti; CUTBACK punisce la frenata tardiva. In parità difende chi è davanti.</div><button class="btn primary" id="duelLock" style="width:100%;margin-top:10px" ${!selectedDuel || options.find(x=>x[0]===selectedDuel)?.[3] ? 'disabled' : ''}>LOCK IN</button>` : `<div class="waiting compact"><b>${state.phase === 'duel_result' ? 'REVEAL!' : 'Scelta bloccata. Attendo l’avversario…'}</b></div>`}</section>` : spectator;
  app.innerHTML = `<div class="app"><div class="topbar"><div><div class="brand"><b>RACE</b> COMMAND · ${state.code}</div><h2 style="margin-top:3px">BATTLE FOR POSITION</h2></div><div class="badges"><span class="badge">Giro ${me.lap} / ${state.rules.maxLaps}</span><span class="badge">${state.weather.icon} ${state.weather.label||state.weather.name}</span><span class="badge">${state.track.icon} ${state.track.label}</span><span class="badge">⏱ <span id="duelCountdown">${secondsLeft()}</span>s</span><span class="badge">${d?.locked || 0} / 2 LOCKED</span>${soundToggleHtml()}</div></div><div class="battleLayout">${battle}${context}</div></div>`;
  positionCars(); bindSoundToggle(); startDuelCountdown();
  const battlePit = document.getElementById('battlePitPlan'); if (battlePit) battlePit.onclick = openPit;
  const battleCancelPit = document.getElementById('battleCancelPit'); if (battleCancelPit) battleCancelPit.onclick = () => setPitPlan(null);
  if (involved && state.phase === 'duel' && !locked) {
    document.querySelectorAll('[data-duel]:not(:disabled)').forEach(b => b.onclick = () => { selectedDuel = b.dataset.duel; document.querySelectorAll('[data-duel]').forEach(x => x.classList.toggle('active', x === b)); const lockBtn = document.getElementById('duelLock'); if (lockBtn) lockBtn.disabled = false; });
    const lock = document.getElementById('duelLock'); if (lock) lock.onclick = async () => { try { await post(`/api/rooms/${state.code}/duel`, { playerId: me.id, choice: selectedDuel }); selectedDuel = null; } catch (e) { toast(e.message); } };
  }
  if (duelResult) animateDuelResult(role, duelResult);
}
function showDuelResult(r) { duelResult = r; if (state) render(); playFx('roll'); setTimeout(()=>playFx('land'),320); setTimeout(() => { duelResult = null; }, 2000); }
function animateDuelResult(role, r) {
  requestAnimationFrame(() => {
    const y = document.getElementById('battleYou'), o = document.getElementById('battleRival'); if (!y || !o) return;
    const youWon = role === 'attack' ? r.winner === 'attacker' : r.winner === 'defender';
    y.classList.add('launch'); o.classList.add('launch'); document.getElementById('duelDiceReveal')?.classList.add('rollingReveal');
    setTimeout(() => { y.classList.remove('launch'); o.classList.remove('launch'); y.style.left = youWon ? '61%' : '29%'; o.style.left = youWon ? '29%' : '61%'; document.getElementById('duelDiceReveal')?.classList.remove('rollingReveal'); if (r.contact) { playFx('warning'); toast('🟡 CONTACT! SAFETY CAR · 2 TURNI'); } else { playFx(youWon ? 'pass' : 'warning'); toast(youWon ? 'BATTLE WON ▲' : 'BATTLE LOST ▼'); } }, 420);
  });
}

function renderFinish() {
  const ranked = state.players, me = state.me, isHost = state.hostId === me.id, stats = me.stats || {};
  app.innerHTML = `<div class="home"><section class="homeCard finishCard"><div class="brand"><b>RACE</b> COMMAND · ${state.code}</div><div class="screenTitle" style="font-size:42px">P${me.rank} · FINISH</div><p class="subtitle">🏁 ${escapeHtml(ranked[0].name)} vince il GP.</p><div class="finishGrid"><div class="finishStat"><div class="ey">Sorpassi</div><b>${stats.passes || 0}</b></div><div class="finishStat"><div class="ey">Pit stop</div><b>${stats.pits || 0}</b></div><div class="finishStat"><div class="ey">Duelli</div><b>${stats.duelW || 0}-${stats.duelL || 0}</b></div><div class="finishStat"><div class="ey">Best pace</div><b>${stats.bestPace || 0}</b></div><div class="finishStat"><div class="ey">ERS usato</div><b>${stats.ersUsed || 0}%</b></div><div class="finishStat"><div class="ey">Strategia</div><b class="strategyText">${(me.strategy || []).join(' → ')}</b></div></div><div class="players" style="margin-top:12px">${ranked.map((p, i) => `<div class="playerRow"><i class="dot" style="background:${p.color}"></i><div><div class="pname">P${i + 1} · ${escapeHtml(p.name)}</div><div class="small">${(p.strategy || []).join(' → ')}</div></div><span class="ready on">${names[p.tyre]}</span></div>`).join('')}</div>${state.awards?`<div class="awardsGrid"><div><span>⭐ DRIVER OF THE DAY</span><b>${escapeHtml(state.players.find(p=>p.id===state.awards.driverOfDay)?.name||'—')}</b></div><div><span>▲ OVERTAKE KING</span><b>${escapeHtml(state.players.find(p=>p.id===state.awards.overtakeKing)?.name||'—')}</b></div><div><span>⚔️ DUEL MASTER</span><b>${escapeHtml(state.players.find(p=>p.id===state.awards.duelMaster)?.name||'—')}</b></div><div><span>🧠 BEST STRATEGIST</span><b>${escapeHtml(state.players.find(p=>p.id===state.awards.bestStrategist)?.name||'—')}</b></div></div>`:''}<div class="finishActions">${isHost ? '<button class="btn green" id="rematch">REMATCH</button>' : ''}<button class="btn primary" id="home">TORNA ALLA HOME</button></div></section></div>`;
  document.getElementById('home').onclick = leaveRoom;
  if (isHost) document.getElementById('rematch').onclick = async () => { try { await post(`/api/rooms/${state.code}/rematch`, { playerId: me.id }); } catch (e) { toast(e.message); } };
}


// Keep an active Internet game awake on hosts that suspend idle services (e.g. Render Free).
// Only runs while this browser is attached to a room.
setInterval(() => {
  if (!session.code) return;
  fetch('/api/health', { cache: 'no-store' }).catch(() => {});
}, 4 * 60 * 1000);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js?v=1.9.1').catch(() => {});
if (session.code && session.playerId) connect(); else renderHome();
