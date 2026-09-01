const { spawn } = require('child_process');
const PORT = 32124, BASE=`http://127.0.0.1:${PORT}`;
const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT),RC_TEST_SPEED:'1'},stdio:['ignore','pipe','pipe']});
let out='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(path,body,method='POST'){const r=await fetch(BASE+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(3000)});const j=await r.json().catch(()=>({}));return{r,j}}
(async()=>{try{
 for(let i=0;i<40;i++){try{if((await fetch(BASE+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)break}catch{}await sleep(100)}
 let x=await req('/api/rooms',{name:'Tester'}),code=x.j.code,pid=x.j.playerId;
 await req(`/api/rooms/${code}/settings`,{playerId:pid,maxLaps:3,qualifyingEnabled:false});
 await req(`/api/rooms/${code}/ready`,{playerId:pid,ready:true,tyre:'M'});
 await req(`/api/rooms/${code}/start`,{playerId:pid});
 const deadline=Date.now()+30000;let lastTurn=-1,actions=0,duels=0,lastLog=0,forcedPlan=false;
 while(Date.now()<deadline){
   const s=(await req(`/api/rooms/${code}/state?playerId=${pid}`,null,'GET')).j;
   if(s.status==='finished'){
     if(s.players.length!==6)throw new Error('finish grid not 6');
     if((s.me.stats?.pits||0)<1)throw new Error('planned pit was never executed');
     console.log('✅ Full race completed',{code,turns:s.turn,actions,duels,pits:s.me.stats.pits,finish:`P${s.me.rank}`,winner:s.players[0].name});child.kill('SIGTERM');setTimeout(()=>process.exit(0),100);return;
   }
   if(s.status==='racing'&&s.phase==='action'&&!s.me.selectedAction){
     const wet = s.track.name === 'DAMP' ? 'I' : s.track.name.includes('WET') ? 'W' : null;
     if(!forcedPlan){
       const pr=await req(`/api/rooms/${code}/pit-plan`,{playerId:pid,pitTyre:wet||'S'}); if(!pr.r.ok)throw new Error('pit-plan '+JSON.stringify(pr.j)); forcedPlan=true;
     } else if((s.me.wear<48 || (wet && ['S','M','H'].includes(s.me.tyre)) || (!wet && ['I','W'].includes(s.me.tyre))) && !s.me.pitPlanTyre && (s.me.stats?.pits||0)>0){
       const pr=await req(`/api/rooms/${code}/pit-plan`,{playerId:pid,pitTyre:wet||'M'}); if(!pr.r.ok)throw new Error('pit-replan '+JSON.stringify(pr.j));
     }
     let action='normal';
     if(s.me.wear<38) action='conserve';
     else if(s.me.ers>=70) action='ers';
     const r=await req(`/api/rooms/${code}/action`,{playerId:pid,action}); if(!r.r.ok)throw new Error('action '+JSON.stringify(r.j));actions++;lastTurn=s.turn;
   }
   if(s.status==='racing'&&s.phase==='duel'&&s.duel&&[s.duel.attackerId,s.duel.defenderId].includes(pid)&&!s.duel.myChoice){
     const role=s.duel.attackerId===pid?'attack':'defend';
     const choice=role==='attack'?(s.me.ers>=15?'ersAttack':'cutback'):(s.me.ers>=15?'ersDef':'coverInside');
     const r=await req(`/api/rooms/${code}/duel`,{playerId:pid,choice}); if(!r.r.ok)throw new Error('duel '+JSON.stringify(r.j));duels++;
   }
   await sleep(180);
 }
 throw new Error('full race timeout');
}catch(e){console.error('❌ Full race failed',e.message);console.error(out);child.kill('SIGTERM');setTimeout(()=>process.exit(1),100)}})();
