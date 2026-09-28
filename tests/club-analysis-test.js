const {createApp}=require('./harness');
const assert=require('assert/strict');
(async()=>{
 const app=await createApp();
 app.eval(`
  S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false,confirmedOnly:true,legacyBefore:'1900-01-01',leagues:[{id:'daily',name:'일상'},{id:'cup',name:'대회',cup:true}],defLeague:'daily'},rounds:{}}).meta;
  S.players='abcdefg'.split('').map(id=>({id,name:id,bu:9,active:id!=='d'}));
  const m=(id,date,aId,bId,winnerId,extra={})=>({id,date,aId,bId,winnerId,lg:'daily',enteredAt:date+'T10:00:00Z',confirmedBy:[aId,bId],...extra});
  S.matches=[m('old','2026-06-01','a','d','d'),m('p1','2026-07-01','a','b','a'),m('p2','2026-07-13','b','c','c'),m('p3','2026-07-13','e','f','e'),m('after-cut','2026-07-14','a','d','a'),
    m('c1','2026-08-01','a','b','b',{aSets:2,bSets:3,_expA:.4,handi:{toId:'b',pts:2}}),m('c2','2026-08-10','a','b','a',{_expA:.2}),m('c3','2026-08-13','c','d','c',{aSets:3,bSets:0,_expA:null}),m('c4','2026-08-13','a','c','a',{aSets:1,bSets:0,_expA:.55}),m('c5','2026-08-03','a','e','e',{lg:'cup',_expA:.8}),m('c6','2026-08-09','d','g','g',{_expA:NaN}),
    m('future','2026-08-14','a','b','a'),m('void','2026-08-12','a','b','a',{void:true}),m('pending','2026-08-12','a','b','a',{confirmedBy:[]}),m('missing-player','2026-08-12','a','z','a'),m('bad-winner','2026-08-12','a','b','c'),m('bad-score','2026-08-12','a','b','a',{aSets:1,bSets:1}),m('bad-date','2026-02-30','a','b','a')];
  S.lg='all';S.ratingsReady=true;S._ratingScope='all';S._ratingDate=today();S.tracks={skill:{H:{},R:{}},form:{H:{},R:{}}};
 `);
 const before=app.eval('JSON.stringify({matches:S.matches,tracks:S.tracks,players:S.players})');
 let x=app.eval("buildClubOverview('2026-08','all')");
 assert.equal(x.window.start,'2026-08-01');assert.equal(x.window.end,'2026-08-13');assert.equal(x.window.previous.start,'2026-07-01');assert.equal(x.window.previous.end,'2026-07-13');
 assert.equal(x.current.list.length,6);assert.equal(x.previous.list.length,3);assert.equal(x.current.people.size,6);assert.equal(x.current.dates.size,5);
 const ids=a=>Array.from(a).sort();
 assert.deepEqual(ids(x.cohorts.retained),['a','b','c','e']);assert.deepEqual(ids(x.cohorts.first),['g']);assert.deepEqual(ids(x.cohorts.returning),['d']);assert.deepEqual(ids(x.cohorts.absent),['f']);
 assert.equal(x.byLeague.reduce((s,l)=>s+l.list.length,0),6);assert.equal(x.byLeague[0].people.size,5);assert.equal(x.pairs.length,5);assert.equal(x.pairs[0].list.length,2);assert.equal(x.pairs[0].aw,1);assert.equal(x.medianOpponents,1.5);
 assert.equal(x.current.people.get('d').g,2,'inactive players historical participation is included');
 assert.equal(x.conditions.predictions.length,4);assert.equal(x.conditions.balanced.length,2);assert.equal(x.conditions.upsets.length,2);assert.equal(x.conditions.scored.length,2);assert.equal(x.conditions.close.length,1);assert.equal(x.conditions.handicap.length,1);assert.equal(x.conditions.receivedWins,1);
 assert.deepEqual(Array.from(x.months,b=>[b.key,b.g]),[['2026-03',0],['2026-04',0],['2026-05',0],['2026-06',1],['2026-07',4],['2026-08',6]]);
 console.log('PASS exact calendar comparison · accepted records only · distinct participation/cohorts · match conditions and denominators');
 x=app.eval("buildClubOverview('2026-08','cup')");assert.equal(x.current.list.length,1);assert.equal(x.previous.list.length,0);assert.deepEqual(ids(x.cohorts.first),['a','e']);assert.equal(x.conditions.predictions.length,0,'other scope predictions cannot be reused');
 app.eval("S._ratingDate='2026-08-12'");assert.equal(app.eval("buildClubOverview('2026-08','all').conditions.predictions.length"),0);app.eval("S._ratingDate=today()");
 x=app.eval("buildClubOverview('2026-05','all')");assert.equal(x.current.list.length,0);assert.equal(x.window.period,'2026-05');assert.equal(x.months.at(-1).g,0);assert.equal(x.medianOpponents,null);
 x=app.eval("buildClubOverview('all','all')");assert.equal(x.current.list.length,11);assert.equal(x.window.previous,null);
 x=app.eval("buildClubOverview('2026','all')");assert.equal(x.current.list.length,11);assert.equal(x.window.previous.start,'2025-01-01');assert.equal(x.window.previous.end,'2025-08-13');assert.equal(x.months.length,8);
 const window=(p,d)=>app.eval('clubPeriodWindow('+JSON.stringify(p)+','+JSON.stringify(d)+')');
 assert.equal(window('2026-07','2026-08-13').previous.end,'2026-06-30');assert.equal(window('2026-03','2026-03-31').previous.end,'2026-02-28');assert.equal(window('2024-03','2024-03-30').previous.end,'2024-02-29');assert.equal(window('2024','2024-02-29').previous.end,'2023-02-28');assert.equal(window('2025','2026-08-13').previous.end,'2024-12-31');assert.equal(window('2026-01','2026-01-03').previous.end,'2025-12-03');assert.equal(window('bad','2026-08-13').period,'2026-08');
 assert.equal(before,app.eval('JSON.stringify({matches:S.matches,tracks:S.tracks,players:S.players})'));
 console.log('PASS league isolation · stale Elo exclusion · empty months · leap days/year transitions · source data unchanged');
 // An edit with the same count must immediately update every derived value; no count-only cache.
 app.eval("S.matches.find(m=>m.id==='c2').winnerId='b'");
 assert.equal(app.eval("buildClubOverview('2026-08').current.people.get('a').w"),1);
 assert.equal(app.eval("buildClubOverview('2026-08').conditions.upsets.length"),1);
 app.eval("S.matches.find(m=>m.id==='c2').void=true");assert.equal(app.eval("buildClubOverview('2026-08').current.list.length"),5);
 app.eval("S.matches.find(m=>m.id==='pending').confirmedBy=['a','b']");assert.equal(app.eval("buildClubOverview('2026-08').current.list.length"),6);
 const html=app.eval("clubOverviewHTML(buildClubOverview('2026-05'))");assert(!/NaN|Infinity/.test(html));assert(html.includes('확인된 경기가 없습니다'));assert(html.includes('집계 기준 확인'));
 const participants=app.eval("clubParticipantsHTML(buildClubOverview('2026-08'),'d')");assert(participants.includes('data-club-player="d"'));assert(!participants.includes('data-club-player="a"'));
 const absent=app.eval("clubParticipantsHTML(buildClubOverview('2026-08'),'','games',12,'absent')");assert(absent.includes('data-club-player="f"'));assert(absent.includes('비교 기간의 기록'));
 console.log('PASS in-place correction/void/confirmation updates · participant filtering · empty-state rendering');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
