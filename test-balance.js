// Lightweight deterministic balance guard for the three dry compounds.
// It is not intended to prove perfect balance; it catches obvious dominant strategies.
let seed = 0xC0FFEE;
function rnd(){ seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
function die(n){ return 1 + Math.floor(rnd() * n); }
const deg={S:16,M:7,H:4};
function effective(c,w){
  let n={S:10,M:8,H:7}[c];
  if(c==='S'){ if(w<70)n-=2; if(w<40)n-=2; if(w<20)n-=1; }
  else if(c==='M'){ if(w<50)n-=1; if(w<20)n-=2; }
  else if(w<20)n-=1;
  return Math.max(3,n);
}
function run(c,reps=12000,turns=18){
  let total=0;
  for(let r=0;r<reps;r++){
    let wear=100,pace=0;
    for(let t=0;t<turns;t++){
      if(wear<28){ wear=100; pace+=Math.max(1,die(effective(c,wear))-5); }
      else { pace+=die(effective(c,wear)); wear=Math.max(0,wear-deg[c]); }
    }
    total+=pace;
  }
  return total/reps;
}
const scores={S:run('S'),M:run('M'),H:run('H')};
const spread=Math.max(...Object.values(scores))-Math.min(...Object.values(scores));
if(Math.abs(scores.S-scores.M)>5 || spread>9){
  console.error('❌ Tyre balance guard failed',scores); process.exit(1);
}
console.log('✅ Tyre balance guard OK',Object.fromEntries(Object.entries(scores).map(([k,v])=>[k,Number(v.toFixed(2))])));
