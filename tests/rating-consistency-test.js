const assert=require('assert/strict');
const {createApp}=require('./harness');
const plain=x=>JSON.parse(JSON.stringify(x));
(async()=>{
  const app=await createApp(),run=s=>app.eval(s);
  run(`
    S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false,confirmedOnly:false,handiOn:false,shrinkC:30,poolCeilingBu:0,
      kNew:20,kMid:20,kBase:20,repeatN0:0,provisional:2,leagues:[{id:'morning',name:'모닝'},{id:'other',name:'별도'}]}}).meta;
    S.players=['a','b','c'].map(id=>({id,name:id,bu:10,active:true}));
    S.lg='all';S.mode='skill';S.period=null;S.tab='rank';S.ready=true;
    const game=(n,extra={})=>({id:'g'+String(n).padStart(3,'0'),date:'2026-08-13',enteredAt:'2026-08-13T01:00:'+String(n%60).padStart(2,'0')+'Z',
      aId:'a',bId:'b',winnerId:'a',lg:'morning',...extra});
    S.matches=Array.from({length:12},(_,i)=>game(i,i<2?{date:'2026-08-12'}:{}));recompute();
  `);
  const before=run("rateOf('a','skill')");
  assert(before>run("capOf('a','skill')"));
  assert.equal(before,run("rawRate('a','skill')"));
  assert.equal(before,run("standings('all','skill').find(x=>x.p.id==='a').r"));
  assert.equal(before,run("S.peak.skill.a.r"));
  assert(run("standings('2026-08','skill').find(x=>x.p.id==='a').r")<before);
  run("viewRank()");assert.equal(app.S.period,'all');
  assert(app.doc.querySelector('#view').innerHTML.includes('통산 Elo 랭킹'));
  assert(run("cardHTML('a','all','skill')").includes('통산 Elo'));
  assert(run("cardHTML('a','all','skill')").includes('>'+Math.round(before)+'</text>'));
  run("applyMatches([game(12,{winnerId:'b'})])");
  const after=run("rateOf('a','skill')"),delta=run("S.matches.find(x=>x.id==='g012')._sA");
  assert.equal(after,before+delta);
  assert.equal(after,run("S.tracks.skill.H.a.at(-1).r"));
  assert.equal(before,run("S.peak.skill.a.r"));
  assert.equal(after,run("matchElo(S.matches.find(x=>x.id==='g012'),'a').after"));
  assert.equal(Math.round(after),Math.round(before)+run("matchElo(S.matches.find(x=>x.id==='g012'),'a').shownDelta"));
  assert.equal(Math.round(after)-Math.round(run("standingsAt('2026-08-12','all','skill').find(x=>x.p.id==='a').r")),run("rankDateComparison('a').scoreDelta"));
  const card=run("matchCardHTML(S.matches.find(x=>x.id==='g012'))");
  assert(card.includes('경기 직후'));assert(card.includes('<b>'+Math.round(after)+'</b>'));
  const values=run("JSON.stringify(S.matches.map(m=>[m._sA,m._sB,m._fA,m._fB,m._rA,m._rB]))");
  run("standings('2026-08','form');standings('2026-08','skill')");
  assert.equal(values,run("JSON.stringify(S.matches.map(m=>[m._sA,m._sB,m._fA,m._fB,m._rA,m._rB]))"),'season view must not overwrite cumulative game values');
  run("applyMatches([game(12,{winnerId:'a',rev:2})])");assert(run("rateOf('a','skill')")>before);
  run("applyMatches([game(12,{void:true,rev:3})])");assert.equal(run("rateOf('a','skill')"),before);
  console.log('PASS 저장·수정·삭제 즉시 반영 · 랭킹/카드/경기 직후/그래프/최고점 동일 · 시즌 조회 원본 보존');

  // Same dataset, different visits and analysis filters must yield identical ratings.
  const source={meta:plain(app.S.meta),players:plain(app.S.players)};
  source.meta.settings.autoCalib=true;source.meta.settings.calibEvery=20;source.meta.settings.handiOn=true;
  source.players[1].bu=8;
  source.matches=Array.from({length:65},(_,i)=>({id:'cal'+String(i).padStart(3,'0'),date:i<42?'2026-07-10':'2026-08-10',enteredAt:String(i).padStart(3,'0'),aId:'a',bId:'b',winnerId:i%3?'a':'b',lg:'morning',handi:{toId:'a',pts:2}}));
  const fresh=await createApp(),warm=await createApp();
  for(const a of [fresh,warm]){a.S.meta=plain(source.meta);a.S.players=plain(source.players);a.S.lg='all';}
  warm.S.matches=plain(source.matches.slice(0,61));warm.recompute();
  warm.eval("clubPer='2026-08'");warm.S.matches=plain(source.matches);warm.recompute();
  fresh.S.matches=plain(source.matches);fresh.recompute();
  assert.equal(warm.S._calib,fresh.S._calib);assert.deepEqual(plain(warm.S.tracks),plain(fresh.S.tracks));
  warm.eval("localDel('tt:calib');clubPer='2026-08'");warm.recompute();
  assert.equal(warm.S._calib,fresh.S._calib);assert.deepEqual(plain(warm.S.tracks),plain(fresh.S.tracks));
  assert.equal(warm.S.G.a,65,'games past calibration boundary still count immediately');
  // Past edits invalidate the cached calibration even with unchanged record count.
  warm.S.matches[0].winnerId='b';warm.S.matches[0].rev=2;warm.recompute();
  fresh.S.matches=plain(warm.S.matches);fresh.eval("localDel('tt:calib')");fresh.recompute();
  assert.deepEqual(plain(warm.S.tracks),plain(fresh.S.tracks));
  fresh.S.matches.forEach(m=>m.enteredAt=m.date+'T00:00:00Z');fresh.recompute();const ordered=plain(fresh.S.tracks);fresh.S.matches.reverse();fresh.recompute();assert.deepEqual(plain(fresh.S.tracks),ordered,'same timestamps use stable match IDs');
  console.log('PASS 기기 캐시·방문 시점·분석 기간과 무관한 동일 점수 · 보정 경계 밖 새 경기 즉시 반영 · 과거 수정');

  // Do not accept a delta response missing even one game. Network failure is not deletion.
  run(`
    S.tab='rank';S.matches=[game(0)];recompute();localSet(SYNC_KEY,{lastKey:'old'});
    const metaCopy=S.meta,playersCopy=S.players;
    sGet=async key=>key===KEY.meta?metaCopy:key===KEY.players?playersCopy:null;
    FB={changesAfter:async()=>[],get:async path=>path==='sig'?{n:2}:null};
  `);
  assert.equal(await run('loadDelta()'),false);
  run("FB.get=async path=>path==='sig'?{n:0}:null");assert.equal(await run('loadDelta()'),false);
  run("FB.changesAfter=async()=>[{key:'new',id:'g000',op:'set'}];FB.get=async path=>{if(path==='sig')return {n:1};throw Error('offline')}");
  assert.equal(await run('loadDelta()'),false);assert.equal(app.S.matches.length,1);
  console.log('PASS 1건/전체 삭제 차이도 전체 동기화 · 읽기 실패 시 기존 경기 보존');

  // Controlled timers exercise dropped refreshes without connecting to production.
  run(`
    const oldQuery=document.querySelector.bind(document);let maskOpen=false;
    document.querySelector=selector=>selector==='.mask'?(maskOpen?{}:null):oldQuery(selector);
    let jobs=new Map(),nextTimer=0,refreshes=0,failNext=false,remoteSignal,resolveRefresh;
    setTimeout=fn=>{jobs.set(++nextTimer,fn);return nextTimer};clearTimeout=id=>jobs.delete(id);
    async function tick(){const next=jobs.entries().next().value;if(!next)throw Error('No timer');jobs.delete(next[0]);await next[1]();}
    FB={watch:fn=>remoteSignal=fn};S.busy=false;document.activeElement={tagName:'BODY'};
    loadFresh=async()=>{refreshes++;if(failNext){failNext=false;throw Error('offline')};if(resolveRefresh===true)await new Promise(r=>resolveRefresh=r);return true;};
    softRender=()=>{};watchRemote();remoteSignal({by:CLIENT});
  `);
  await run('tick()');assert.equal(run('refreshes'),1,'initial snapshot catches subscribe race');
  run("remoteSignal({by:'other'});document.activeElement={tagName:'INPUT'}");await run('tick()');assert.equal(run('refreshes'),1);assert.equal(run('jobs.size'),1);
  run("document.activeElement={tagName:'BODY'};maskOpen=true");await run('tick()');assert.equal(run('refreshes'),1);
  run('maskOpen=false;S.busy=true');await run('tick()');assert.equal(run('refreshes'),1);
  run('S.busy=false');await run('tick()');assert.equal(run('refreshes'),2);
  run("remoteSignal({by:CLIENT})");assert.equal(run('jobs.size'),0);
  run("failNext=true;remoteSignal({by:'other'})");await run('tick()');assert.equal(run('jobs.size'),1);await run('tick()');assert.equal(run('refreshes'),4);
  run("resolveRefresh=true;remoteSignal({by:'other'})");const inflight=run('tick()');
  run("remoteSignal({by:'other'});resolveRefresh()");await inflight;run('resolveRefresh=null');await run('tick()');assert.equal(run('refreshes'),6);
  assert.equal(run('jobs.size'),0);
  console.log('PASS 검색/팝업/저장 중 갱신 보류 후 반영 · 초기 구독 틈 · 실패 재시도 · 동시 변경 보존 · 자기 쓰기 중복 제외');
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
