const assert=require('assert/strict'),{createApp}=require('./harness');
(async()=>{
 const app=await createApp(),run=s=>app.eval(s);
 run("S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false,confirmedOnly:true,legacyBefore:''},rounds:{}}).meta;S.lg='all';S.players=Array.from({length:40},(_,i)=>({id:'p'+i,name:'선수'+i,bu:10,active:true}));S.matches=[];recompute();function rng(seed=7){let s=seed;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}};function entryCfg(n){const ids=S.players.map(p=>p.id);const c={ids,freeFormat:true,division:'rookie',drawMode:'fixed',assignments:Object.fromEntries(ids.map((id,i)=>[id,'0-'+(i%6)])),thirdPlace:'shared',entries:{},slots:[],bestOf:3,formatMode:'custom',customFormat:{groups:Array(6).fill(0)},bracketMode:'fixed',bracketCount:n,bracketEntries:Array.from({length:n},(_,i)=>(i%6)+':'+(Math.floor(i/6)+1)),bracketPairs:promotionEntryPairs(n)};promotionSyncEntryBracket(c);return c}");
 const source=run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks})');
 for(let n=2;n<=40;n++){
  run('globalThis.c=entryCfg('+n+')');const slots=Array.from(run('c.brackets[0]'));
  assert.equal(slots.filter(x=>x!=='bye').length,n);assert.equal(slots.length,2**Math.ceil(Math.log2(n)));assert.equal(slots.filter(x=>x==='bye').length,slots.length-n);
  for(let i=0;i<slots.length;i+=2)assert(slots[i]!=='bye'||slots[i+1]!=='bye');
  for(let parts=2;parts<=slots.length/2;parts*=2){const byes=Array.from({length:parts},(_,i)=>slots.slice(i*slots.length/parts,(i+1)*slots.length/parts).filter(x=>x==='bye').length);assert(Math.max(...byes)-Math.min(...byes)<=1);}
  const html=run('promotionFreeBracketEditorHTML(c,promotionPlansFor(c)[0])');assert.equal((html.match(/data-ps-entry=/g)||[]).length,n);assert(!html.includes('id="psBracketSize"'));assert(html.includes('type="number"'));
  run("c.bracketView='compact'");const preview=run('promotionFreeBracketEditorHTML(c,promotionPlansFor(c)[0])');assert.equal((preview.match(/data-ps-entry=/g)||[]).length,n);
  await run('preparePromotionSimulation(promotionSnapshot(c)).then(x=>globalThis.ctx=x)');const ev=run('promotionSimOnce(ctx,rng()).events[0]');assert.equal(ev.qualified.length,n);assert.equal(ev.log.filter(m=>m.stage!=='3위전').length,n-1);
 }
 console.log('PASS every integer from 2–40 renders exactly N entrant cards and simulates N−1 matches; automatic balanced byes stay internal');
 // Empty positions must remain visible and must block calculation, not count as byes.
 run("c=entryCfg(18);c.bracketEntries=Array(18).fill('');promotionSyncEntryBracket(c)");const empty=run('promotionFreeBracketEditorHTML(c,promotionPlansFor(c,false)[0])');assert.equal((empty.match(/data-ps-entry=/g)||[]).length,18);assert.throws(()=>run('promotionSnapshot(c)'),/1번 자리에/);
 // The supplied photograph is entered as 18 references + the two first matches.
 run("c=entryCfg(18);c.bracketEntries=PROMOTION_ROOKIE_18_SLOTS.filter(x=>x!=='bye');c.bracketPairs=[1,15];promotionSyncEntryBracket(c)");
 assert.deepEqual(Array.from(run('c.brackets[0]')),Array.from(run('PROMOTION_ROOKIE_18_SLOTS')));
 await run('preparePromotionSimulation(promotionSnapshot(c)).then(x=>globalThis.ctx=x)');const e=run('promotionSimOnce(ctx,rng()).events[0]');assert.equal(e.log.filter(m=>m.stage==='32강').length,2);assert.equal(e.podiumThird.length,2);
 const result=await run('runPromotionTrials(ctx,{trials:1000,rnd:rng(19)})');for(const [key,total]of [['win',1000],['runnerUp',1000],['third',2000],['qualified',18000]])assert.equal(result.rows.reduce((sum,row)=>sum+row[key],0),total);
 run('c.bracketPairs=[1,2]');assert.throws(()=>run('promotionSnapshot(c)'),/겹치지/);
 run("c=entryCfg(18);promotionLoadEntryBracket(c,PROMOTION_ROOKIE_18_SLOTS.slice())");assert.equal(run('c.bracketCount'),18);assert.deepEqual(Array.from(run('c.bracketPairs')),[1,15]);assert.deepEqual(Array.from(run('c.brackets[0]')),Array.from(run('PROMOTION_ROOKIE_18_SLOTS')));
 run("promotionLoadEntryBracket(c,Array(32).fill('bye'))");assert.equal(run('c.bracketCount'),null);assert.equal(run('c.bracketEntries.length'),0);assert.throws(()=>run('promotionSnapshot(c)'),/본선 인원/);
 assert.equal(source,run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks})'));
 console.log('PASS 18 empty cards, incomplete placement blocked, photograph routes selected by user, shared-third totals, overlap validation, legacy migration and unchanged real data');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
