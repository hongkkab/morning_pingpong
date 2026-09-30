const assert=require('assert/strict'),{createApp}=require('./harness');
(async()=>{
 const app=await createApp(),run=s=>app.eval(s);
 run("S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false,confirmedOnly:true,legacyBefore:''},rounds:{}}).meta;S.lg='all';S.players=Array.from({length:40},(_,i)=>({id:'p'+i,name:'선수'+i,bu:10,active:true}));S.matches=[];recompute();function rng(seed=7){let s=seed;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}};function drawCfg(groups,advances){const ids=S.players.slice(0,groups.reduce((a,b)=>a+b,0)).map(p=>p.id),assignments={};let i=0;groups.forEach((n,g)=>{for(let j=0;j<n;j++)assignments[ids[i++]]='0-'+g});return {ids,division:'rookie',drawMode:'fixed',assignments,thirdPlace:'shared',entries:{},slots:[4],bestOf:3,formatMode:'custom',customFormat:{groups,advances},bracketMode:'random'}}");
 const source=run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks})');
 for(let n=2;n<=40;n++){
  const plan=run('promotionPlan('+n+')');assert.equal(plan.length,1);assert.equal(plan[0].n,n);assert.equal(plan[0].label,'');
  assert.deepEqual(Array.from(run('promotionGroupSlots(promotionPlan('+n+'))'),g=>g.label),Array.from({length:plan[0].groups.length},(_,g)=>(g+1)+'조'));
 }
 // Every qualifier count, including 18/33/40, must form one valid bracket.
 for(let n=2;n<=40;n++)for(let trial=0;trial<8;trial++){
  const groups=n<=20?[n]:[20,n-20],plan={groups,advances:groups,knockout:n};
  const slots=Array.from(run('promotionDefaultBracket('+JSON.stringify(plan)+',rng('+trial+'))')),size=2**Math.ceil(Math.log2(n)),byes=size-n;
  assert.equal(slots.length,size);assert.equal(slots.filter(x=>x==='bye').length,byes);assert.equal(new Set(slots.filter(x=>x!=='bye')).size,n);
  for(let i=0;i<size;i+=2)assert(slots[i]!=='bye'||slots[i+1]!=='bye');
  for(let parts=2;parts<=size/2;parts*=2){const counts=Array.from({length:parts},(_,i)=>slots.slice(i*size/parts,(i+1)*size/parts).filter(x=>x==='bye').length);assert(Math.max(...counts)-Math.min(...counts)<=1,'balanced byes at every draw depth');}
 }
 console.log('PASS one numbered event for 2–40 players; all 2–40 qualifier brackets conserve entrants and evenly spread byes');
 // Eighteen qualifiers: nine groups with two qualifiers each. Winners get
 // byes first and each group's runner-up stays in the opposite draw half.
 run('globalThis.c=drawCfg(Array(9).fill(3),Array(9).fill(2))');
 for(let i=0;i<80;i++){
  const slots=Array.from(run('promotionDefaultBracket(promotionPlansFor(c)[0],rng('+i+'))'));
  assert.equal(slots.filter(x=>x==='bye').length,14);
  for(let g=0;g<9;g++){const winner=slots.indexOf(g+':1'),runner=slots.indexOf(g+':2');assert.equal(slots[winner^1],'bye');assert.notEqual(Math.floor(winner/16),Math.floor(runner/16));}
 }
 await run('preparePromotionSimulation(promotionSnapshot(c)).then(x=>globalThis.ctx=x)');
 for(let i=0;i<12;i++){
  const ev=run('promotionSimOnce(ctx,rng('+i+')).events[0]');assert.equal(ev.log.length,17);
  assert.deepEqual(['32강','16강','8강','4강','결승'].map(stage=>ev.log.filter(m=>m.stage===stage).length),[2,8,4,2,1]);
  assert.equal(ev.slots.slice(0,16).filter(x=>!x).length,7);assert.equal(ev.slots.slice(16).filter(x=>!x).length,7);assert.equal(ev.podiumThird.length,2);
 }
 const r=await run('runPromotionTrials(ctx,{trials:1000,rnd:rng(91)})');
 for(const [key,total]of [['win',1000],['runnerUp',1000],['third',2000],['promote',4000],['qualified',18000]])assert.equal(r.rows.reduce((n,p)=>n+p[key],0),total);
 assert.equal(run('promotionBracketSummary(ctx.plans[0])'),'본선 18명 · 32강 · 부전승 14명 · 첫 라운드 2경기');
 assert(run('promotionExampleHTML(promotionSimOnce(ctx,rng()),ctx)').includes('첫 라운드 부전승 14명'));
 console.log('PASS 18 qualifiers: 32 slots, 14 byes, two first-round matches, 17 played matches, opposite group halves, shared thirds and conserved probabilities');
 // Upper supported boundary and irregular advancement counts remain valid.
 for(const [groups,advances]of [[Array(20).fill(2),Array(20).fill(2)],[[5,3,4,5,3],[1,3,2,4,2]]]){
  run('c=drawCfg('+JSON.stringify(groups)+','+JSON.stringify(advances)+')');await run('preparePromotionSimulation(promotionSnapshot(c)).then(x=>globalThis.ctx=x)');
  const ev=run('promotionSimOnce(ctx,rng()).events[0]');assert.equal(ev.log.length,advances.reduce((a,b)=>a+b,0)-1);assert.equal(ev.groups.length,groups.length);
 }
 assert.equal(source,run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks})'));
 console.log('PASS 20 groups/40 qualifiers, uneven advances, and no changes to real records or Elo');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
