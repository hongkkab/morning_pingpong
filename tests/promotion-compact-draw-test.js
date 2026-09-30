const assert=require('assert/strict'),{createApp}=require('./harness');
(async()=>{
 const app=await createApp(),run=s=>app.eval(s);
 run("S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false,confirmedOnly:true,legacyBefore:''},rounds:{}}).meta;S.lg='all';S.players=Array.from({length:40},(_,i)=>({id:'p'+i,name:'선수'+i,bu:10,active:true}));S.matches=[];recompute();function rng(seed=7){let s=seed;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}};function photoCfg(groups){const ids=S.players.slice(0,groups.reduce((a,b)=>a+b,0)).map(p=>p.id),assignments={};let i=0;groups.forEach((n,g)=>{for(let j=0;j<n;j++)assignments[ids[i++]]='0-'+g});return {ids,division:'rookie',drawMode:'fixed',assignments,thirdPlace:'shared',entries:{},slots:[4],bestOf:3,formatMode:'custom',customFormat:{groups,advances:Array(6).fill(3)},bracketMode:'fixed',brackets:[PROMOTION_ROOKIE_18_SLOTS.slice()]}}");
 const source=run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks})');
 const visible=['0:1','5:3','3:3','2:2','1:2','4:1','5:2','0:3','3:1','2:1','1:3','4:2','5:1','0:2','3:2','2:3','4:3','1:1'];
 assert.deepEqual(Array.from(run("PROMOTION_ROOKIE_18_SLOTS.filter(x=>x!=='bye')")),visible);
 const layout=run('promotionBracketLayout(PROMOTION_ROOKIE_18_SLOTS)');assert.deepEqual(Array.from(layout.halves,h=>h.leaves.length),[9,9]);assert.deepEqual(Array.from(layout.halves.flatMap(h=>h.leaves),l=>l.number),Array.from({length:18},(_,i)=>i+1));
 assert.deepEqual(Array.from(layout.halves.flatMap(h=>h.leaves),l=>l.ref),visible);
 assert.deepEqual(Array.from(layout.halves.flatMap(h=>h.matches).filter(m=>m.round===32),m=>m.slot),[2,28]);assert.equal(layout.halves.flatMap(h=>h.matches).length,16);
 for(const groups of [Array(6).fill(3),[5,5,5,5,4,4],Array(6).fill(5)]){
  run('globalThis.c=photoCfg('+JSON.stringify(groups)+')');await run('preparePromotionSimulation(promotionSnapshot(c)).then(x=>globalThis.ctx=x)');
  for(let i=0;i<40;i++){
   const ev=run('promotionSimOnce(ctx,rng('+i+')).events[0]'),g=ev.groups,first=ev.log.filter(m=>m.stage==='32강'),sixteen=ev.log.filter(m=>m.stage==='16강');
   assert.equal(ev.qualified.length,18);assert.equal(ev.slots.length,32);assert.equal(ev.log.length,17);assert.equal(ev.podiumThird.length,2);
   assert.deepEqual(Array.from(first,m=>[m.a,m.b]),[[g[5][2].id,g[3][2].id],[g[2][2].id,g[4][2].id]]);
   assert.deepEqual(Array.from(sixteen,m=>[m.a,m.b]),[[g[0][0].id,first[0].win],[g[2][1].id,g[1][1].id],[g[4][0].id,g[5][1].id],[g[0][2].id,g[3][0].id],[g[2][0].id,g[1][2].id],[g[4][1].id,g[5][0].id],[g[0][1].id,g[3][1].id],[first[1].win,g[1][0].id]]);
   const eight=ev.log.filter(m=>m.stage==='8강'),four=ev.log.filter(m=>m.stage==='4강'),final=ev.log.find(m=>m.stage==='결승');
   for(let j=0;j<4;j++)assert.deepEqual([eight[j].a,eight[j].b],[sixteen[2*j].win,sixteen[2*j+1].win]);for(let j=0;j<2;j++)assert.deepEqual([four[j].a,four[j].b],[eight[2*j].win,eight[2*j+1].win]);assert.deepEqual([final.a,final.b],[four[0].win,four[1].win]);
   assert.deepEqual(Array.from(ev.slots).filter(Boolean),visible.map(ref=>{const [group,rank]=ref.split(':').map(Number);return g[group][rank-1].id}));
  }
 }
 console.log('PASS photo positions 1–18, exactly two preliminary matches, all eight round-of-16 pairings and every route to final, mixed 3/4/5 group sizes');
 const result=await run('runPromotionTrials(ctx,{trials:1000,rnd:rng(19)})');for(const [key,total]of [['win',1000],['runnerUp',1000],['third',2000],['qualified',18000]])assert.equal(result.rows.reduce((n,p)=>n+p[key],0),total);
 // Compact rendering must never change slots, routes or probability input.
 const before=run('JSON.stringify(c.brackets)');const compact=run('promotionBracketEditorHTML(c,promotionPlansFor(c))');assert.equal((compact.match(/data-ps-slot=/g)||[]).length,18);assert.equal((compact.match(/data-ps-position=/g)||[]).length,18);assert(!compact.includes('value="bye"'));
 run("c.bracketView='slots'");const raw=run('promotionBracketEditorHTML(c,promotionPlansFor(c))');assert.equal((raw.match(/data-ps-slot=/g)||[]).length,32);assert(raw.includes('value="bye"'));assert.equal(before,run('JSON.stringify(c.brackets)'));
 for(let n=2;n<=40;n++){
  const slots=run('promotionDefaultBracket({groups:['+n+'],advances:['+n+'],knockout:'+n+'})');run('globalThis.layoutSlots='+JSON.stringify(slots));const tree=run('promotionBracketLayout(layoutSlots)');assert.equal(tree.halves.flatMap(h=>h.leaves).length,n);assert.equal(tree.halves.flatMap(h=>h.matches).length,n-2);assert(tree.halves.flatMap(h=>h.leaves).every(l=>Number.isFinite(l.y)));
 }
 assert.equal(source,run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks})'));
 console.log('PASS compact/raw editors retain the same bracket; all 2–40 qualifier trees have every entrant and exactly the played matches; probability totals and real data unchanged');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
