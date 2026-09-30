const assert=require('assert/strict'),{createApp}=require('./harness');
(async()=>{
 const app=await createApp(),run=s=>app.eval(s);
 run("S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false,confirmedOnly:true,legacyBefore:''},rounds:{}}).meta;S.lg='all';S.players=Array.from({length:40},(_,i)=>({id:'p'+i,name:'선수'+i,bu:10,active:true}));S.matches=[];recompute();function rng(seed=7){let s=seed;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}};function freeCfg(groups,slots){const ids=S.players.slice(0,groups.reduce((a,b)=>a+b,0)).map(p=>p.id),assignments={};let i=0;groups.forEach((n,g)=>{for(let j=0;j<n;j++)assignments[ids[i++]]='0-'+g});return {ids,freeFormat:true,division:'rookie',drawMode:'fixed',assignments,thirdPlace:'shared',entries:{},slots:[],bestOf:3,formatMode:'custom',customFormat:{groups,advances:groups},bracketMode:'fixed',bracketSize:slots.length,brackets:[slots]}}");
 const source=run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks})');
 // Selected ranks are the actual qualifiers, not an implied top-N rule.
 run("globalThis.c=freeCfg([5,4,3,1,0,2],['0:3','2:2','1:4','5:1']);");
 const snap=run('promotionSnapshot(c)');assert.equal(snap.plans[0].knockout,4);assert.deepEqual(Array.from(snap.plans[0].groups),[5,4,3,1,0,2]);
 await run('preparePromotionSimulation(promotionSnapshot(c)).then(x=>globalThis.ctx=x)');
 for(let i=0;i<60;i++){const ev=run('promotionSimOnce(ctx,rng('+i+')).events[0]');assert.equal(ev.log.length,3);assert.deepEqual(Array.from(ev.qualified),[ev.groups[0][2].id,ev.groups[2][1].id,ev.groups[1][3].id,ev.groups[5][0].id]);assert.equal(ev.podiumThird.length,2);}
 const r=await run('runPromotionTrials(ctx,{trials:1000,rnd:rng(19)})');for(const [key,total]of [['win',1000],['third',2000],['qualified',4000]])assert.equal(r.rows.reduce((n,p)=>n+p[key],0),total);
 console.log('PASS any selected group rank qualifies; unequal, single-player and unused groups; exact four-player bracket and probability totals');
 // A full single group is also legal; changing a roster never changes group count.
 run("c=freeCfg([12],['0:1','0:4','0:2','0:3']);c.assignments={}");assert.equal(run('promotionSnapshot(c).plans[0].groups[0]'),12);
 run("c=freeCfg([5,5,5,5,4,4],PROMOTION_ROOKIE_18_SLOTS.slice())");await run('preparePromotionSimulation(promotionSnapshot(c)).then(x=>globalThis.ctx=x)');const e=run('promotionSimOnce(ctx,rng()).events[0]');assert.equal(e.qualified.length,18);assert.equal(e.log.length,17);assert.equal(e.slots.filter(x=>!x).length,14);
 run("c.ids.push('p28');c.assignments.p28='0-0'");assert.deepEqual(Array.from(run('promotionSnapshot(c).plans[0].groups')),[6,5,5,5,4,4]);assert.equal(run('c.customFormat.groups.length'),6);assert.equal(run('c.brackets[0].length'),32);
 for(const [setup,pattern]of [["c.brackets[0][0]='0:99'",/1조 99위/],["c.brackets[0][0]='5:3'",/중복/],["c.brackets[0][0]='bye'",/빈자리끼리/],["delete c.assignments.p0",/조를 배정/],["c.brackets[0]=Array(32).fill('bye')",/두 자리/]]){run('c=freeCfg([5,5,5,5,4,4],PROMOTION_ROOKIE_18_SLOTS.slice());'+setup);assert.throws(()=>run('promotionSnapshot(c)'),pattern);}
 assert.equal(source,run('JSON.stringify({players:S.players,matches:S.matches,meta:S.meta,tracks:S.tracks})'));
 console.log('PASS user-provided 18-person draw, one group, roster-independent group count, duplicate/nonexistent ranks and structurally empty matches rejected; real data unchanged');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
