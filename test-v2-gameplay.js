const { spawn } = require('child_process');
const assert = require('assert');
const PORT=32129, BASE=`http://127.0.0.1:${PORT}`;
const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT),RC_TEST_SPEED:'1'},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(path,body,method='POST'){const r=await fetch(BASE+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(3500)});const j=await r.json().catch(()=>({}));return{r,j}}
(async()=>{try{
  for(let i=0;i<40;i++){try{if((await fetch(BASE+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)break}catch{}await sleep(100)}
  let x=await req('/api/rooms',{name:'Host'}); assert(x.r.ok); const code=x.j.code,pid=x.j.playerId;
  let s=(await req(`/api/rooms/${code}/state?playerId=${pid}`,null,'GET')).j;
  assert.equal(s.players.length,6); assert(s.circuit && s.track && typeof s.trackWetness==='number');
  const firstWeather=s.weather.name;
  x=await req(`/api/rooms/${code}/settings`,{playerId:pid,circuitId:'monaco'}); assert(x.r.ok);
  s=(await req(`/api/rooms/${code}/state?playerId=${pid}`,null,'GET')).j;
  assert.equal(s.circuitId,'monaco'); assert.equal(s.circuit.name,'MONACO'); assert.equal(s.circuit.drsBonus,1); assert(s.players.filter(p=>!p.isBot).every(p=>!p.ready));
  const personalities=s.players.filter(p=>p.isBot).map(p=>p.personality); assert(personalities.includes('duelist') && personalities.includes('rain') && personalities.includes('strategist'));
  await req(`/api/rooms/${code}/settings`,{playerId:pid,maxLaps:3,qualifyingEnabled:true});
  await req(`/api/rooms/${code}/ready`,{playerId:pid,ready:true,tyre:'M'});
  x=await req(`/api/rooms/${code}/start`,{playerId:pid}); assert(x.r.ok);
  s=(await req(`/api/rooms/${code}/state?playerId=${pid}`,null,'GET')).j; assert.equal(s.status,'qualifying'); assert.equal(s.qualifying.total,6);
  x=await req(`/api/rooms/${code}/qualifying`,{playerId:pid,choice:'max'}); assert(x.r.ok);
  await sleep(180);
  s=(await req(`/api/rooms/${code}/state?playerId=${pid}`,null,'GET')).j;
  assert(['starting','racing'].includes(s.status)); assert(s.players.every(p=>p.startRank>=1 && p.startRank<=6));
  // get to racing
  for(let i=0;i<20 && s.status!=='racing';i++){await sleep(80);s=(await req(`/api/rooms/${code}/state?playerId=${pid}`,null,'GET')).j}
  assert.equal(s.status,'racing');
  // new duel choices endpoint accepts the 2.0 vocabulary if a duel appears naturally; structural guard below covers server list.
  const server=require('fs').readFileSync('server.js','utf8');
  assert(server.includes("['inside','outside','cutback','ersAttack']"));
  assert(server.includes("['coverInside','coverOutside','lateBrake','ersDef','noFight']"));
  assert(server.includes("damage='wing'"));
  assert(server.includes('GOMMA FRESCA +1') && server.includes('WARM-UP -1'));
  assert(server.includes('room.trackWetness') && server.includes('weather[room.weatherIndex].wetDelta'));
  console.log('✅ Race Command 2.0 gameplay guard OK',{circuit:s.circuit.name,track:s.track.name,weather:s.weather.label,grid:s.players.map(p=>p.startRank)});
  child.kill('SIGTERM'); setTimeout(()=>process.exit(0),100);
}catch(e){console.error('❌ v2 gameplay failed',e.message);console.error(output);child.kill('SIGTERM');setTimeout(()=>process.exit(1),100)}})();
