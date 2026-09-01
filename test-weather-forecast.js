const { spawn } = require('child_process');
const assert = require('assert');
const PORT=32131, BASE=`http://127.0.0.1:${PORT}`;
const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT),RC_TEST_SPEED:'1'},stdio:['ignore','pipe','pipe']});
let output=''; child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(path,body,method='POST'){const r=await fetch(BASE+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(3500)});const j=await r.json().catch(()=>({}));return{r,j}}
async function state(code,pid){return (await req(`/api/rooms/${code}/state?playerId=${pid}`,null,'GET')).j}
(async()=>{try{
  for(let i=0;i<40;i++){try{if((await fetch(BASE+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)break}catch{}await sleep(100)}
  let x=await req('/api/rooms',{name:'Forecast'}); assert(x.r.ok); const code=x.j.code,pid=x.j.playerId;
  await req(`/api/rooms/${code}/settings`,{playerId:pid,maxLaps:10,qualifyingEnabled:false,circuitId:'spa'});
  let s=await state(code,pid);
  assert.equal(s.weatherForecast.length,4);
  assert.equal(s.weatherForecast[0].weatherIndex,s.weatherIndex);
  await req(`/api/rooms/${code}/ready`,{playerId:pid,ready:true,tyre:'M'});
  await req(`/api/rooms/${code}/start`,{playerId:pid});
  await sleep(700); s=await state(code,pid); assert.equal(s.status,'racing');
  let checked=0, consecutiveRain=0, maxRain=0;
  for(let turn=0;turn<12 && s.status==='racing';turn++){
    // Resolve any duel that may be active before the next action phase.
    if(s.phase==='duel'){
      await sleep(220); s=await state(code,pid); turn--; continue;
    }
    if(s.phase!=='action'){await sleep(100);s=await state(code,pid);turn--;continue;}
    const expected=s.weatherForecast[1];
    assert(expected,'missing +10m forecast');
    await req(`/api/rooms/${code}/action`,{playerId:pid,action:'normal'});
    await sleep(240); s=await state(code,pid);
    assert.equal(s.weatherIndex,expected.weatherIndex,`turn ${turn}: actual weather diverged from +10m forecast`);
    assert.equal(s.weatherForecast[0].weatherIndex,s.weatherIndex,'forecast NOW must match actual weather');
    checked++;
    if(s.weatherIndex>=2){consecutiveRain++;maxRain=Math.max(maxRain,consecutiveRain)} else consecutiveRain=0;
  }
  assert(checked>=5,'not enough forecast transitions checked');
  assert(maxRain<=4,'rain spell exceeded four consecutive forecast slots');
  const server=require('fs').readFileSync('server.js','utf8');
  assert(server.includes('weatherPlan') && server.includes('weatherForecast(room, 4)'));
  assert(!server.includes("const r=Math.random();\n  if (r < .12"),'old independent weatherStep randomness still present');
  console.log('✅ Weather forecast authoritative OK',{checked,maxRain});
  child.kill('SIGTERM'); setTimeout(()=>process.exit(0),100);
}catch(e){console.error('❌ weather forecast failed',e.message);console.error(output);child.kill('SIGTERM');setTimeout(()=>process.exit(1),100)}})();
