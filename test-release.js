const fs=require('fs');
const assert=require('assert');
function read(p){return fs.readFileSync(p,'utf8')}
const index=read('public/index.html');
const app=read('public/app-1.8.js');
const css=read('public/styles-1.8.css');
const server=read('server.js');
const bat=read('AGGIORNA_GITHUB.bat');
const ps1=read('AGGIORNA_GITHUB.ps1');
const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.version,'1.8.0');
assert(index.includes('/app-1.8.js') && index.includes('/styles-1.8.css'));
assert(!fs.existsSync('public/app-1.6.js') && !fs.existsSync('public/styles-1.6.css'));
assert(app.includes('diceShell') && app.includes('playResolutionSequence') && app.includes('duelDiceReveal'));
assert(app.includes("showRaceEvent(`▲ SORPASSO"));
assert(css.includes('@keyframes diceThrow') && css.includes('.weatherFx') && css.includes('.drsLive'));
assert(server.includes("version: '1.8.0'"));
assert(server.includes('attackerRoll: ar.raw') && server.includes('defenderRoll: dr.raw'));
assert(bat.includes('git clone --depth 1') && bat.includes('git push -u origin main'));
assert(bat.includes('AGGIORNA_GITHUB.ps1') && bat.includes('-File'));
assert(ps1.includes('Get-ChildItem -LiteralPath') && ps1.includes('Copy-Item -LiteralPath'));
assert(!bat.includes('Where-Object {')); // niente PowerShell complesso inline nel BAT
assert(bat.includes('%USERPROFILE%\\.race-command-github-repo.txt'));
assert(css.includes('.raceControlsPanel') && css.includes('.raceTrackPanel') && css.includes('resolutionBroadcastIn'));
assert(css.includes('position:fixed') && css.includes('overflow:hidden'));
console.log('✅ Race Command 1.8 layout/assets/updater guard OK');
