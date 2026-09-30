const assert=require('assert/strict'),{createApp}=require('./harness');
(async()=>{
 const app=await createApp(),run=s=>app.eval(s);
 run("S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false,confirmedOnly:true,legacyBefore:''},rounds:{}}).meta;S.lg='all';S.players=Array.from({length:40},(_,i)=>({id:'p'+i,name:'선수'+String(i).padStart(2,'0'),bu:9,active:true}));S.matches=[];recompute();function rng(seed=7){let s=seed;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}};function fixedCfg(n){const ids=S.players.slice(0,n).map(p=>p.id),assignments={};let i=0;for(const g of promotionGroupSlots(promotionPlan(n)))for(let k=0;k<g.target;k++)assignments[ids[i++]]=g.key;return {ids,division:'challenge',drawMode:'fixed',assignments,thirdPlace:'shared',entries:{},slots:[],bestOf:3}}");
 const source=run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks})');
 for(const n of [7,8,9,12,16,20,21,23,40]){
  await run('preparePromotionSimulation(promotionSnapshot(fixedCfg('+n+'))).then(x=>globalThis.ctx=x)');
  for(let i=0;i<12;i++){
   const out=run('promotionSimOnce(ctx,rng('+i+'))');
   out.events.forEach((ev,index)=>{
    const fixed=run('ctx.fixedEvents['+index+'].groups');
    assert.deepEqual(Array.from(ev.groups,g=>Array.from(g,p=>p.id).sort()),Array.from(fixed,g=>Array.from(g).sort()));
    assert.equal(ev.promoted.length,ev.plan.promote);
    if(ev.plan.knockout)assert.equal(ev.podiumThird.length,2);
   });
  }
 }
 run("globalThis.c=fixedCfg(9);c.assignments.p4='0-1'");
 const reversed=run('promotionSnapshot(c)');
 assert.deepEqual(Array.from(reversed.fixedEvents[0].plan.groups),[4,5]);
 run("delete c.assignments.p0");assert.throws(()=>run('promotionSnapshot(c)'),/조를 배정/);
 run("c.assignments.p0='missing'");assert.throws(()=>run('promotionSnapshot(c)'),/조를 배정/);
 run("c=fixedCfg(12);c.assignments.p3='0-0'");assert.deepEqual(Array.from(run('promotionSnapshot(c).plans[0].groups')),[4,2,3,3]);
 run("c.assignments.p4='0-0'");assert.throws(()=>run('promotionSnapshot(c)'),/현재 1명/);
 run("c=fixedCfg(21);c.assignments.p0='1-0'");assert.throws(()=>run('promotionSnapshot(c)'));
 console.log('PASS fixed groups persist across draws; unequal fixed groups accepted; missing/invalid/underfilled groups rejected; split events stay separate');
 await run('preparePromotionSimulation(promotionSnapshot(fixedCfg(12))).then(x=>globalThis.ctx=x)');
 run("globalThis.manual={podiums:new Map(),rows:new Map(ctx.members.map(p=>[p.id,{win:0,runnerUp:0,third:0}]))};const random=rng(88);for(let i=0;i<1000;i++){const ev=promotionSimOnce(ctx,random).events[0],a=ev.win,b=ev.ranks.find(p=>p.rank===2).id;manual.rows.get(a).win++;manual.rows.get(b).runnerUp++;for(const t of ev.podiumThird){manual.rows.get(t).third++;const key=JSON.stringify([a,b,t]);manual.podiums.set(key,(manual.podiums.get(key)||0)+1)}}");
 const result=await run('runPromotionTrials(ctx,{trials:1000,rnd:rng(88)}).then(r=>globalThis.result=r)');
 assert.deepEqual(Array.from(result.eventStats[0].podiums),Array.from(run('manual.podiums')));
 for(const p of result.rows){const expected=run('manual.rows.get('+JSON.stringify(p.id)+')');assert.equal(p.win,expected.win);assert.equal(p.runnerUp,expected.runnerUp);assert.equal(p.third,expected.third);}
 assert.equal(result.rows.reduce((n,p)=>n+p.third,0),2000);
 assert.equal(result.rows.reduce((n,p)=>n+p.win,0),1000);
 assert.equal(result.rows.reduce((n,p)=>n+p.runnerUp,0),1000);
 const keys=Array.from(result.eventStats[0].podiums.keys()),pick=JSON.parse(keys[0]),answer=run('promotionPodiumChance(result,0,'+JSON.stringify(pick)+')');
 assert.equal(answer.hits,result.eventStats[0].podiums.get(keys[0]));assert.equal(answer.probability,answer.hits/1000);
 assert.equal(run("promotionPodiumChance(result,0,['p0','p0','p2'])"),null);
 assert.equal(run("promotionPodiumChance(result,0,['p0','p1','unknown'])"),null);
 assert.equal(run("promotionPodiumChance(result,0,['','',''])"),null);
 console.log('PASS ordered picks use observed joint tallies, both semifinal losers qualify, third-place totals 200%, duplicate/unknown guesses blocked');
 await run('preparePromotionSimulation(promotionSnapshot(fixedCfg(16))).then(x=>globalThis.ctx=x)');
 const out=run('promotionSimOnce(ctx,rng(10)).events[0]');
 assert.equal(out.promoted.length,3);assert.equal(out.podiumThird.length,2);
 assert(out.podiumThird.includes(out.ranks.find(x=>x.rank===4).id));
 console.log('PASS game shared third is independent of the assumed third promotion slot decider');
 await run('preparePromotionSimulation(promotionSnapshot(fixedCfg(21))).then(x=>globalThis.ctx=x)');
 const two=await run('runPromotionTrials(ctx,{trials:100,rnd:rng(9)}).then(r=>globalThis.result=r)');
 assert.equal(two.eventStats.length,2);
 for(const ev of two.eventStats){assert.equal([...ev.rows.values()].reduce((n,p)=>n+p.win,0),100);assert.equal([...ev.rows.values()].reduce((n,p)=>n+p.third,0),200);}
 assert.equal(run("promotionPodiumChance(result,0,['p0','p1','p20'])"),null);
 const snap=run('promotionSnapshot(fixedCfg(7))');await run('preparePromotionSimulation(promotionSnapshot(fixedCfg(7))).then(x=>globalThis.ctx=x)');
 const league=await run('runPromotionTrials(ctx,{trials:100,rnd:rng(9)})');assert.equal(league.rows.reduce((n,p)=>n+p.third,0),100);
 assert.equal(source,run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks})'));
 console.log('PASS per-event game isolation, full-league unique third, source records and ratings unchanged');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
