const { spawn } = require('child_process');
const PORT = 32123;
const BASE = `http://127.0.0.1:${PORT}`;
const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: { ...process.env, PORT: String(PORT), RC_TEST_SPEED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', d => output += d);
child.stderr.on('data', d => output += d);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function request(path, body, method='POST') {
  const r = await fetch(BASE + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { r, j };
}
async function state(code, pid) { return (await request(`/api/rooms/${code}/state?playerId=${pid}`, null, 'GET')).j; }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function composition(s) { return [s.players.filter(p=>!p.isBot).length, s.players.filter(p=>p.isBot).length]; }
(async()=>{
  try {
    for(let i=0;i<40;i++) { try { const h=await fetch(BASE+'/api/health'); if(h.ok) break; } catch{} await sleep(100); }

    // Test every automatic 6-car lobby composition from 1+5 through 6+0.
    let x=await request('/api/rooms',{name:'H1'}); assert(x.r.ok,'create room');
    const code=x.j.code, humans=[x.j.playerId];
    let s=await state(code,humans[0]);
    assert(s.players.length===6,'create must auto-fill to 6');
    assert(composition(s).join(',')==='1,5','expected 1 human + 5 bots');
    for(let n=2;n<=6;n++) {
      x=await request(`/api/rooms/${code}/join`,{name:`H${n}`}); assert(x.r.ok,`join H${n}`); humans.push(x.j.playerId);
      s=await state(code,humans[0]);
      const [h,b]=composition(s);
      assert(s.players.length===6,`grid must remain 6 after join ${n}`);
      assert(h===n && b===6-n,`expected ${n}+${6-n}, got ${h}+${b}`);
    }
    x=await request(`/api/rooms/${code}/join`,{name:'H7'}); assert(x.r.status===409,'7th human must be rejected');

    // Leaving the lobby automatically restores a bot.
    await request(`/api/rooms/${code}/leave`,{playerId:humans[5]});
    s=await state(code,humans[0]);
    assert(composition(s).join(',')==='5,1','leave should refill with bot');

    // One-human race: 1 human + 5 bots is a valid game.
    x=await request('/api/rooms',{name:'Solo'}); assert(x.r.ok,'solo create');
    const soloCode=x.j.code, solo=x.j.playerId;
    s=await state(soloCode,solo); assert(composition(s).join(',')==='1,5','solo room composition');
    // Pre-room tyre selection must persist before READY (regression: UI used to snap back to Medium).
    await request(`/api/rooms/${soloCode}/ready`,{playerId:solo,ready:false,tyre:'S'});
    s=await state(soloCode,solo); assert(s.me.tyre==='S' && !s.me.ready,'pre-room Soft selection must persist before READY');
    await request(`/api/rooms/${soloCode}/ready`,{playerId:solo,ready:false,tyre:'H'});
    s=await state(soloCode,solo); assert(s.me.tyre==='H' && !s.me.ready,'pre-room Hard selection must persist before READY');
    await request(`/api/rooms/${soloCode}/ready`,{playerId:solo,ready:false,tyre:'I'});
    s=await state(soloCode,solo); assert(s.me.tyre==='I' && !s.me.ready,'pre-room Intermediate selection must persist before READY');
    await request(`/api/rooms/${soloCode}/ready`,{playerId:solo,ready:false,tyre:'W'});
    s=await state(soloCode,solo); assert(s.me.tyre==='W' && !s.me.ready,'pre-room Wet selection must persist before READY');
    const lobbyWeather=s.weather.name;
    await request(`/api/rooms/${soloCode}/settings`,{playerId:solo,maxLaps:3});
    await request(`/api/rooms/${soloCode}/ready`,{playerId:solo,ready:true,tyre:'W'});
    x=await request(`/api/rooms/${soloCode}/start`,{playerId:solo}); assert(x.r.ok,'solo start with bots');
    await sleep(700);
    s=await state(soloCode,solo); assert(s.status==='racing'&&s.phase==='action','solo race did not start');
    assert(s.me.tyre==='W','Wet pre-room choice must be used at race start');
    assert(s.weather.name===lobbyWeather,'lobby weather must remain unchanged through lights out');
    assert(s.players.length===6,'solo race must keep six cars');
    // Pit can be programmed from anywhere and must persist independently from the turn action.
    x=await request(`/api/rooms/${soloCode}/pit-plan`,{playerId:solo,pitTyre:'I'}); assert(x.r.ok,'early pit plan');
    s=await state(soloCode,solo); assert(s.me.pitPlanTyre==='I','pit plan must persist on server');
    x=await request(`/api/rooms/${soloCode}/action`,{playerId:solo,action:'normal'}); assert(x.r.ok,'solo action while pit is planned');
    await sleep(250);
    s=await state(soloCode,solo); assert(s.turn>=1,'solo turn did not resolve with bots');
    assert(s.me.pitPlanTyre==='I' || (s.me.stats && s.me.stats.pits>=1),'pit plan must survive turns until the entry is reached');
    x=await request(`/api/rooms/${soloCode}/pit-plan`,{playerId:solo,pitTyre:null}); assert(x.r.ok,'cancel pit plan');
    s=await state(soloCode,solo); assert(s.me.pitPlanTyre===null,'pit plan cancellation');

    // Two-human internet-style flow: both humans + four bots, secret simultaneous lock.
    x=await request('/api/rooms',{name:'Andre'}); const c2=x.j.code,p1=x.j.playerId;
    x=await request(`/api/rooms/${c2}/join`,{name:'Bimba'}); const p2=x.j.playerId;
    s=await state(c2,p1); assert(composition(s).join(',')==='2,4','2 humans + 4 bots');
    await request(`/api/rooms/${c2}/ready`,{playerId:p1,ready:true,tyre:'M'});
    await request(`/api/rooms/${c2}/ready`,{playerId:p2,ready:true,tyre:'S'});
    x=await request(`/api/rooms/${c2}/start`,{playerId:p1}); assert(x.r.ok,'2-human start');
    await sleep(700);
    s=await state(c2,p1); assert(s.phase==='action','2-human action phase');
    await request(`/api/rooms/${c2}/action`,{playerId:p1,action:'attack'});
    let s1=await state(c2,p1), s2=await state(c2,p2);
    assert(s1.me.selectedAction==='attack','own locked action visible');
    assert(!s2.players.find(p=>p.id===p1).selectedAction,'opponent action must remain secret in public player state');
    await request(`/api/rooms/${c2}/action`,{playerId:p2,action:'normal'});
    await sleep(250);
    s=await state(c2,p1); assert(s.turn>=1,'2-human turn did not resolve');
    assert(s.players.length===6,'2-human race must keep six cars');

    console.log('✅ Race Command 1.3 smoke test OK', { autoGrid:'1+5 → 6+0', soloRace:true, twoHumanRace:true, code:c2 });
    process.exitCode=0;
  } catch(e) {
    console.error('❌ Smoke test failed:',e.message); console.error(output); process.exitCode=1;
  } finally { child.kill('SIGTERM'); }
})();
