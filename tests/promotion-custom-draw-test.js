const assert=require('assert/strict'),{createApp}=require('./harness');
(async()=>{
 const app=await createApp(),run=s=>app.eval(s);
 run("S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false,confirmedOnly:true,legacyBefore:''},rounds:{}}).meta;S.lg='all';S.players=Array.from({length:40},(_,i)=>({id:'p'+i,name:'선수'+i,bu:10,active:true}));S.matches=[];recompute();function rng(seed=7){let s=seed;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}};function customCfg(groups=[4,4,4,4,3,3,3,3],advances=groups.map(()=>2)){const ids=S.players.slice(0,groups.reduce((a,b)=>a+b,0)).map(p=>p.id),assignments={};let i=0;groups.forEach((n,g)=>{for(let j=0;j<n;j++)assignments[ids[i++]]='0-'+g});const c={ids,division:'rookie',drawMode:'fixed',assignments,thirdPlace:'shared',entries:{},slots:[],bestOf:3,formatMode:'custom',customFormat:{groups,advances},bracketMode:'fixed'};c.brackets=[promotionDefaultBracket(promotionPlansFor(c)[0])];return c};globalThis.c=customCfg();c.brackets=[PROMOTION_ROOKIE_28_SLOTS.slice()]");
 const source=run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks,G:S.G})');
 const snap=run('promotionSnapshot(c)');assert.equal(snap.plans.length,1);assert.equal(snap.plans[0].n,28);assert.equal(snap.plans[0].knockout,16);assert.deepEqual(Array.from(snap.plans[0].groups),[4,4,4,4,3,3,3,3]);
 const slots=['0:1','6:2','1:2','7:1','4:1','2:2','5:2','3:1','2:1','4:2','3:2','5:1','6:1','0:2','7:2','1:1'];assert.deepEqual(Array.from(snap.plans[0].bracket),slots);
 await run('preparePromotionSimulation(promotionSnapshot(c)).then(x=>globalThis.ctx=x)');
 for(let i=0;i<80;i++){
  const ev=run('promotionSimOnce(ctx,rng('+i+')).events[0]');
  assert.deepEqual(Array.from(ev.slots),slots.map(ref=>{const [g,r]=ref.split(':').map(Number);return ev.groups[g][r-1].id}));
  assert.equal(ev.log.filter(m=>m.stage==='16강').length,8);assert.equal(ev.log.filter(m=>m.stage==='8강').length,4);assert.equal(ev.log.filter(m=>m.stage==='4강').length,2);assert.equal(ev.log.filter(m=>m.stage==='결승').length,1);
  const first=ev.log.filter(m=>m.stage==='16강');for(let m=0;m<8;m++)assert.deepEqual([first[m].a,first[m].b],Array.from(ev.slots.slice(m*2,m*2+2)));
  const final=ev.log.find(m=>m.stage==='결승');assert(ev.slots.slice(0,8).includes(final.a));assert(ev.slots.slice(8).includes(final.b));assert.equal(ev.podiumThird.length,2);assert.equal(ev.promoted.length,4);
 }
 const r=await run('runPromotionTrials(ctx,{trials:1000,rnd:rng(11)})');assert.equal(r.eventStats.length,1);for(const [key,total]of [['win',1000],['runnerUp',1000],['third',2000],['promote',4000],['qualified',16000]])assert.equal(r.rows.reduce((a,b)=>a+b[key],0),total);
 console.log('PASS supplied 28-player groups and all 16 exact slots; adjacent winners advance within halves; one event, 16/8/4/final, two shared thirds; probability totals');
 for(const [setup,pattern]of [["c.ids.pop()",/정원/],["c.brackets[0][0]='6:2'",/중복/],["c.brackets[0][0]=''",/모든 자리/],["c.brackets[0][0]='8:1'",/중복/],["c.assignments.p0='0-7'",/현재/],["c.customFormat.advances[0]=5",/진출 인원/],["c.customFormat.groups[0]=21",/40명/]]){
  run('c=customCfg();'+setup);assert.throws(()=>run('promotionSnapshot(c)'),pattern);
 }
 for(const [groups,advances]of [[[3,4,5],[1,2,2]],[[2,2],[1,1]],[[2,3],[1,2]],[[4,4,4,4,4,4,4,4],[4,4,4,4,4,4,4,4]],[[5,3,4],[2,1,3]]]){
  run('c=customCfg('+JSON.stringify(groups)+','+JSON.stringify(advances)+')');await run('preparePromotionSimulation(promotionSnapshot(c)).then(x=>globalThis.ctx=x)');
  for(let j=0;j<8;j++){const ev=run('promotionSimOnce(ctx,rng('+j+')).events[0]');assert.equal(new Set(ev.qualified).size,advances.reduce((a,b)=>a+b));assert.equal(ev.promoted.length,Math.min(4,ev.qualified.length));assert.equal(ev.log.filter(m=>m.stage==='결승').length,1);}
 }
 run("c=customCfg([3,4,5],[1,2,2]);c.brackets[0]=['bye','bye','0:1','1:1','1:2','2:1','2:2','bye']");assert.throws(()=>run('promotionSnapshot(c)'),/부전승/);
 run("c=customCfg();c.drawMode='random'");await run('preparePromotionSimulation(promotionSnapshot(c)).then(x=>globalThis.ctx=x)');assert.equal(run('promotionSimOnce(ctx,rng()).events.length'),1);
 console.log('PASS custom unequal sizes/advancement, two/three/five/six/32 qualifiers, byes, random groups; invalid references/counts/duplicates blocked');
 run("c=customCfg();c.ids[0]='sim-guest:test';c.guests={'sim-guest:test':{id:'sim-guest:test',name:'임시',bu:11,active:true}};c.assignments['sim-guest:test']='0-0'");const guest=run('promotionSnapshot(c).members[0]');assert.equal(guest.r,run('baseFor(11)'));assert.equal(guest.g,0);assert.equal(guest.guest,true);await run('preparePromotionSimulation(promotionSnapshot(c)).then(x=>globalThis.ctx=x)');await run('runPromotionTrials(ctx,{trials:20,rnd:rng()})');
 assert.equal(source,run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks,G:S.G})'));
 console.log('PASS guest explicitly uses common division initial Elo; real players, matches, Elo and metadata unchanged');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
