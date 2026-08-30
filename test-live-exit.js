const { spawn } = require('child_process');
const http = require('http');
const PORT = 32127;
const BASE = `http://127.0.0.1:${PORT}`;
const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: { ...process.env, PORT: String(PORT), RC_TEST_SPEED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let output=''; child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(path,body,method='POST'){
  const r=await fetch(BASE+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({})); return {r,j};
}
function assert(x,m){if(!x)throw new Error(m)}
function liveEvent(path, eventName, trigger, timeoutMs=1800){
  return new Promise((resolve,reject)=>{
    let buf=''; let triggered=false; let done=false;
    const timer=setTimeout(()=>finish(new Error(`timeout waiting for ${eventName}`)),timeoutMs);
    function finish(err,data){if(done)return;done=true;clearTimeout(timer);try{request.destroy()}catch{};err?reject(err):resolve(data)}
    const request=http.get(BASE+path,res=>{
      res.setEncoding('utf8');
      res.on('data',async chunk=>{
        buf+=chunk;
        if(!triggered && buf.includes(': connected')){
          triggered=true;
          try{await trigger()}catch(e){return finish(e)}
        }
        const blocks=buf.split('\n\n'); buf=blocks.pop()||'';
        for(const block of blocks){
          const ev=(block.match(/^event:\s*(.+)$/m)||[])[1];
          const data=(block.match(/^data:\s*(.+)$/m)||[])[1];
          if(ev===eventName){let parsed={};try{parsed=JSON.parse(data||'{}')}catch{};return finish(null,parsed)}
        }
      });
      res.on('error',finish);
    });
    request.on('error',finish);
  });
}
(async()=>{try{
  for(let i=0;i<40;i++){try{if((await fetch(BASE+'/api/health')).ok)break}catch{}await sleep(100)}

  // Solo player: terminal event must arrive live, and POST must say closed immediately.
  let a=(await req('/api/rooms',{name:'Solo'})).j;
  let closeResponse;
  const ev=await liveEvent(`/api/rooms/${a.code}/events?playerId=${a.playerId}`,'session_closed',async()=>{
    closeResponse=await req(`/api/rooms/${a.code}/close-request`,{playerId:a.playerId});
  });
  assert(ev.reason==='single_human_closed','solo live event reason incorrect');
  assert(closeResponse?.r.ok && closeResponse.j.closed===true,'solo POST must return closed:true');

  // Partial vote: an earlier YES voter must receive session_exit live when a later NO completes voting.
  a=(await req('/api/rooms',{name:'A'})).j;
  const b=(await req(`/api/rooms/${a.code}/join`,{name:'B'})).j;
  const c=(await req(`/api/rooms/${a.code}/join`,{name:'C'})).j;
  await req(`/api/rooms/${a.code}/close-request`,{playerId:a.playerId}); // A auto YES
  await req(`/api/rooms/${a.code}/close-vote`,{playerId:b.playerId,choice:'yes'});
  const exitEv=await liveEvent(`/api/rooms/${a.code}/events?playerId=${b.playerId}`,'session_exit',async()=>{
    await req(`/api/rooms/${a.code}/close-vote`,{playerId:c.playerId,choice:'no'});
  });
  assert(exitEv.reason==='accepted_close_request','YES voter must receive live session_exit');

  // All YES: already-connected non-last voter must receive session_closed live.
  a=(await req('/api/rooms',{name:'A'})).j;
  const d=(await req(`/api/rooms/${a.code}/join`,{name:'D'})).j;
  await req(`/api/rooms/${a.code}/close-request`,{playerId:a.playerId});
  const closedEv=await liveEvent(`/api/rooms/${a.code}/events?playerId=${a.playerId}`,'session_closed',async()=>{
    const last=await req(`/api/rooms/${a.code}/close-vote`,{playerId:d.playerId,choice:'yes'});
    assert(last.j.closed===true && last.j.exited===true,'last YES POST must return closed/exited live fallback');
  });
  assert(closedEv.reason==='all_humans_accepted','unanimous live event reason incorrect');

  console.log('✅ Live session exit test OK — no refresh required');
}catch(e){console.error('❌ Live session exit test failed:',e.message);console.error(output);process.exitCode=1}finally{child.kill('SIGTERM')}})();
