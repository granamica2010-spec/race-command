const { spawn } = require('child_process');
const PORT = 32126;
const BASE = `http://127.0.0.1:${PORT}`;
const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: { ...process.env, PORT: String(PORT), RC_TEST_SPEED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let output=''; child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(path,body,method='POST'){const r=await fetch(BASE+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({}));return {r,j}}
async function state(code,pid){return req(`/api/rooms/${code}/state?playerId=${pid}`,null,'GET')}
function assert(x,m){if(!x)throw new Error(m)}
(async()=>{try{
  for(let i=0;i<40;i++){try{if((await fetch(BASE+'/api/health')).ok)break}catch{}await sleep(100)}
  // Partial acceptance: YES players leave, NO player stays, grid returns to 1+5.
  let a=(await req('/api/rooms',{name:'A'})).j; let b=(await req(`/api/rooms/${a.code}/join`,{name:'B'})).j; let c=(await req(`/api/rooms/${a.code}/join`,{name:'C'})).j;
  await req(`/api/rooms/${a.code}/close-request`,{playerId:a.playerId});
  let s=(await state(a.code,b.playerId)).j; assert(s.closeRequest && s.closeRequest.voters.filter(v=>v.vote==='yes').length===1,'requester must auto-vote yes');
  await req(`/api/rooms/${a.code}/close-vote`,{playerId:b.playerId,choice:'yes'}); await req(`/api/rooms/${a.code}/close-vote`,{playerId:c.playerId,choice:'no'});
  s=(await state(a.code,c.playerId)).j; assert(!s.closeRequest,'vote must finish'); assert(s.players.filter(p=>!p.isBot).length===1,'NO voter must remain human'); assert(s.players.filter(p=>p.isBot).length===5,'YES voters must be replaced by bots');
  // The only remaining human can close the session permanently.
  await req(`/api/rooms/${a.code}/close-request`,{playerId:c.playerId}); let z=await state(a.code,c.playerId); assert(z.r.status===410,'single-human acceptance must tombstone room');
  // Unanimous multi-human close.
  a=(await req('/api/rooms',{name:'A'})).j; b=(await req(`/api/rooms/${a.code}/join`,{name:'B'})).j;
  await req(`/api/rooms/${a.code}/close-request`,{playerId:a.playerId}); await req(`/api/rooms/${a.code}/close-vote`,{playerId:b.playerId,choice:'yes'}); z=await state(a.code,a.playerId); assert(z.r.status===410,'all YES must permanently close room');
  // Pause/resume during an active action phase.
  a=(await req('/api/rooms',{name:'A'})).j; b=(await req(`/api/rooms/${a.code}/join`,{name:'B'})).j;
  await req(`/api/rooms/${a.code}/ready`,{playerId:a.playerId,ready:true,tyre:'M'}); await req(`/api/rooms/${a.code}/ready`,{playerId:b.playerId,ready:true,tyre:'H'}); await req(`/api/rooms/${a.code}/start`,{playerId:a.playerId});
  for(let i=0;i<8;i++){await sleep(180);s=(await state(a.code,a.playerId)).j;if(s.status==='racing'&&s.phase==='action')break} assert(s.phase==='action','race action phase expected');
  const turn=s.turn; await req(`/api/rooms/${a.code}/close-request`,{playerId:a.playerId}); s=(await state(a.code,b.playerId)).j; assert(s.deadline===null,'gameplay deadline must pause'); await sleep(650); s=(await state(a.code,b.playerId)).j; assert(s.turn===turn,'turn must not advance while vote open');
  await req(`/api/rooms/${a.code}/close-vote`,{playerId:b.playerId,choice:'no'}); s=(await state(a.code,b.playerId)).j; assert(s.deadline!==null && !s.closeRequest,'timer must resume after partial rejection'); assert(s.players.filter(p=>!p.isBot).length===1,'requester exits after YES'); await sleep(2400); s=(await state(a.code,b.playerId)).j; assert(s.turn>turn,'race must continue after vote');
  console.log('✅ Session close voting test OK');
}catch(e){console.error('❌ Session close test failed:',e.message);console.error(output);process.exitCode=1}finally{child.kill('SIGTERM')}})();
