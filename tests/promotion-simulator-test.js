const assert=require('assert/strict'),fs=require('fs'),{createApp}=require('./harness');
(async()=>{
 const app=await createApp(),run=s=>app.eval(s),near=(a,b,e=1e-9)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
 run(`S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false,confirmedOnly:true,legacyBefore:'',handiOn:true,handiElo:95},rounds:{}}).meta;S.lg='all';S.players=Array.from({length:40},(_,i)=>({id:'p'+i,name:'선수'+String(i).padStart(2,'0'),bu:9,active:true}));S.matches=[];recompute();function rng(seed=7){let s=seed;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}function config(n=12,extra={}){return {division:'challenge',ids:S.players.slice(0,n).map(p=>p.id),entries:{},slots:[],bestOf:3,...extra};}`);
 const expected={2:[0,1,[2]],7:[0,1,[7]],8:[6,1,[4,4]],9:[6,1,[5,4]],10:[6,1,[5,5]],11:[6,1,[6,5]],12:[8,2,[3,3,3,3]],15:[8,2,[4,4,4,3]],16:[8,3,[4,4,4,4]],19:[8,3,[5,5,5,4]],20:[8,4,[5,5,5,5]]};
 for(const [n,e]of Object.entries(expected)){const p=run(`promotionPlan(${n})`)[0];assert.equal(p.knockout,e[0]);assert.equal(p.promote,e[1]);assert.deepEqual(Array.from(p.groups),e[2]);}
 assert.deepEqual(Array.from(run('promotionPlan(21)'),p=>[p.n,p.promote]),[[21,4]]);assert.deepEqual(Array.from(run('promotionPlan(23)'),p=>[p.n,p.promote]),[[23,4]]);assert.deepEqual(Array.from(run('promotionPlan(40)'),p=>[p.n,p.promote]),[[40,4]]);
 assert.throws(()=>run('promotionPlan(1)'));assert.throws(()=>run('promotionPlan(41)'));assert.throws(()=>run('promotionPlan(12,[9])'));assert.equal(run('promotionPlan(12,[3])[0].promote'),3);
 console.log('PASS all format/quota boundaries, balanced groups, one event over 20, operator override and input limits');
 const probs=run(`(()=>{const out=[];for(const division of ['rookie','challenge','legend'])for(const bestOf of [3,5])for(const diff of [-500,0,500]){const a={id:'a',bu:division==='rookie'?10:2,r:1500+diff},b={id:'b',bu:division==='rookie'?11:8,r:1500};const pair=promotionPair(a,b,{division,bestOf});out.push({division,bestOf,diff,exp:pair.exp,actual:promotionMatchProb(pair.out.filter(x=>x.a>x.b).reduce((s,x)=>s+x.w,0),bestOf),sum:pair.out.reduce((s,x)=>s+x.w,0),handi:pair.handi?.pts||0});}return out;})()`);
 for(const p of probs){near(p.sum,1);near(p.actual,p.exp);assert.equal(p.handi,p.division==='rookie'?1:p.division==='legend'?4:0);}
 assert.equal(run("promotionHandicap({id:'a',bu:10},{id:'b',bu:10},'rookie')"),null);
 near(run("promotionPair({id:'a',bu:10,r:1200},{id:'b',bu:11,r:1100},{division:'rookie',bestOf:3}).exp"),run("eloExpectation(1200,1100,'a','b',{toId:'b',pts:1},'promotion').expA"));
 console.log('PASS shared Elo match probability preserved through set/point model; rookie +1, legend max4, no handicap elsewhere');
 const original=run('JSON.stringify({matches:S.matches,players:S.players,meta:S.meta,tracks:S.tracks,G:S.G})');
 for(const n of [2,7,8,11,12,15,16,19,20,21,23,40]){
  await run('preparePromotionSimulation(promotionSnapshot(config('+n+'))).then(x=>globalThis.testCtx=x)');
  const d=run('promotionSimOnce(testCtx,rng(91))');
  assert.equal(d.events.reduce((v,e)=>v+e.plan.n,0),n);
  for(const e of d.events){assert.equal(new Set(e.promoted).size,e.plan.promote);assert.equal(new Set(e.qualified).size,e.plan.knockout||e.plan.n);assert.equal(new Set(e.groups.flat().map(p=>p.id)).size,e.plan.n);
   if(e.plan.knockout===6){assert.equal(e.slots.filter(x=>!x).length,2);const leaders=e.groups.map(g=>g[0].id);for(const id of leaders){const at=e.slots.indexOf(id);assert.equal(e.slots[at^1],null);}assert.notEqual(Math.floor(e.slots.indexOf(leaders[0])/4),Math.floor(e.slots.indexOf(leaders[1])/4));}
   if(e.plan.knockout)assert.equal(e.log.filter(m=>m.stage==='3위전').length,e.plan.promote===3?1:0);
   for(const m of e.log){assert.equal(Math.max(m.as,m.bs),2);assert(m.ap>=0&&m.bp>=0);assert.notEqual(m.a,m.b);}
  }
  const r=await run('runPromotionTrials(testCtx,{trials:100,rnd:rng(2)})');
  assert.equal(r.rows.reduce((v,p)=>v+p.win,0),100*d.events.length);
  assert.equal(r.rows.reduce((v,p)=>v+p.promote,0),100*d.events.reduce((v,e)=>v+e.plan.promote,0));
 }
 assert.equal(original,run('JSON.stringify({matches:S.matches,players:S.players,meta:S.meta,tracks:S.tracks,G:S.G})'));
 console.log('PASS valid draws, seed byes, third-place decision, quotas conserved, source records/rankings never mutated');
 await run('preparePromotionSimulation(promotionSnapshot(config(8))).then(x=>globalThis.testCtx=x)');
 const equal=await run('runPromotionTrials(testCtx,{trials:10000,rnd:rng(31)})');
 for(const r of equal.rows)assert(Math.abs(r.win/10000-1/8)<.02,'equal entrants remain exchangeable');
 assert.equal(run('promotionOdds(2500,5000)'), '2.00배');assert.equal(run('promotionOdds(0,5000)'),'—');assert(run('promotionInterval(0,5000)[1]')>0);assert(run('promotionInterval(5000,5000)[0]')<1);
 const cancelled=await run('runPromotionTrials(testCtx,{trials:5000,cancel:()=>globalThis.stopTrials,progress:()=>{globalThis.stopTrials=true}})');assert.equal(cancelled,null);
 console.log('PASS equal-skill probabilities, inverse probability odds, nonzero uncertainty at extremes and cancellable batches');
 run("S.players[0].bu=10;S.players[1].bu=11;recompute()");
 assert.throws(()=>run('promotionSnapshot(config(2))'));
 const special=run("promotionSnapshot(config(2,{entries:{p0:{bu:9,special:true},p1:{bu:9,birth:1970}}}))");assert.equal(special.members[0].special,true);assert.equal(special.members[1].r,run("rawRate('p1','skill')"));
 assert.equal(run("promotionOutcome({bu:9,special:true},'challenge')"),'승급 시 8부 · 탈락 시 10부');assert(run("promotionOutcome({bu:11},'rookie')").includes('차주 챌린지 9부'));
 run("S.matches=[{id:'good',date:'2026-08-12',lg:'morning',aId:'p0',bId:'p1',winnerId:'p0',confirmedBy:['p0','p1']},{id:'void',date:'2026-08-12',aId:'p0',bId:'p1',winnerId:'p0',void:true},{id:'future',date:'2026-08-15',aId:'p0',bId:'p1',winnerId:'p0',confirmedBy:['p0','p1']},{id:'pending',date:'2026-08-12',aId:'p0',bId:'p1',winnerId:'p0',confirmedBy:[]}];recompute()");
 const snap=run("promotionSnapshot(config(2,{division:'rookie'}))");assert.equal(snap.members[0].g,1);assert.equal(snap.members[1].g,1);assert.equal(snap.members[0].r,run("rawRate('p0','skill')"));
 console.log('PASS division validation, temporary special entry, unchanged Elo, confirmed-only evidence counts');
 const order=run("promotionLeagueOrder([{id:'a',bu:9},{id:'b',bu:9},{id:'c',bu:9}],[{a:'a',b:'b',win:'a',lose:'b',as:2,bs:0,ap:22,bp:10},{a:'b',b:'c',win:'b',lose:'c',as:2,bs:1,ap:31,bp:28},{a:'c',b:'a',win:'c',lose:'a',as:2,bs:1,ap:30,bp:26}],rng())");assert.deepEqual(Array.from(order,p=>p.id),['a','c','b']);
 const byPoints=run("promotionLeagueOrder([{id:'a',bu:9},{id:'b',bu:9},{id:'c',bu:9}],[{a:'a',b:'b',win:'a',lose:'b',as:2,bs:1,ap:33,bp:21},{a:'b',b:'c',win:'b',lose:'c',as:2,bs:1,ap:30,bp:29},{a:'c',b:'a',win:'c',lose:'a',as:2,bs:1,ap:28,bp:27}],rng())");assert.deepEqual(Array.from(byPoints,p=>p.id),['a','c','b']);
 console.log('PASS three-way circular ties use mutual set difference then point ratio, not an unstable pairwise sort');
 assert(fs.readFileSync('index.html','utf8')===fs.readFileSync('table-tennis-elo.html','utf8'));
 console.log('PASS both entry HTML files identical');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
