const {createApp}=require('./harness');
const assert=require('assert/strict');
const fs=require('fs');
const plain=value=>JSON.parse(JSON.stringify(value));
(async()=>{
  const app=await createApp(),reference=await createApp(),run=code=>app.eval(code);
  run(`
    S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false,shrinkC:12,poolCeilingBu:0.5,provisional:2,confirmedOnly:true,legacyBefore:'1900-01-01',leagues:[{id:'morning',name:'모닝'},{id:'other',name:'다른 리그'}]}}).meta;
    S.players=['a','b','c','new','frozen','promoted','empty'].map((id,i)=>({id,name:'선수'+id,bu:id==='promoted'?7:8,active:true,...(id==='promoted'?{buHist:[{date:'2026-08-10',from:8,bu:7}]}:{})}));
    const make=(id,date,aId='a',bId='b',extra={})=>({id,date,aId,bId,winnerId:aId,lg:'morning',confirmedBy:[aId,bId],enteredAt:date+'T10:00:00Z',...extra});
    S.matches=[make('old1','2026-07-14','frozen','b'),make('old2','2026-07-14','frozen','c'),make('july','2026-07-31'),
      make('week-edge','2026-08-06'),make('week-start','2026-08-07'),make('promotion-old','2026-08-08','promoted','a'),make('promotion-old2','2026-08-08','promoted','b'),
      make('promotion-new','2026-08-11','promoted','a'),make('new1','2026-08-12','new','a'),make('yesterday','2026-08-12'),
      make('today1','2026-08-13','a','b',{winnerId:'b'}),make('today2','2026-08-13','a','c'),make('new2','2026-08-13','new','c'),
      make('other','2026-08-13','a','b',{lg:'other'}),make('missing-player','2026-08-13','a','unknown'),make('pending','2026-08-13','a','b',{confirmedBy:[]}),make('void','2026-08-13','a','b',{void:true}),make('future','2026-08-14')];
    S.lg='all';S.bu=null;S.mode='skill';S.ready=true;S.connecting=false;recompute();
  `);
  assert.equal(run("rankDateComparison('a').cutoff"),'2026-08-12');
  assert.deepEqual(plain(run("rankDateComparison('a').matches.map(m=>m.id)")),['today1','today2','other']);
  assert.equal(run("rankDateComparison('a').wins"),2);
  const week=plain(run("rankDateComparison('a','all','skill',null,false,7)"));
  assert.equal(week.cutoff,'2026-08-06');assert(!week.matches.some(m=>['week-edge','future','pending','void'].includes(m.id)));assert(week.matches.some(m=>m.id==='week-start'));
  console.log('PASS 기본 어제 · 1주일 전 · 종료일 경계 · 미래/미확인/삭제 경기 제외');

  // Independent replay of only the cutoff records, with fixed rules. Covers capped and
  // shrunk displayed scores, seasons, leagues, and effective promotion dates.
  const original={meta:plain(app.S.meta),players:plain(app.S.players),matches:plain(app.S.matches)};
  for(const league of ['all','morning','other']){
    app.S.lg=league;app.recompute();
    for(const date of ['2026-08-06','2026-08-12','2026-08-13']){
      reference.S.meta=plain(original.meta);reference.S.lg=league;
      reference.S.players=original.players.map(p=>({...p,bu:run(`buOnDate('${p.id}','${date}')`),buHist:(p.buHist||[]).filter(x=>x.date<=date)}));
      reference.S.matches=plain(original.matches.filter(m=>m.date<=date));reference.recompute();
      for(const period of ['all','2026','2026-08'])for(const mode of ['skill','form']){
        const actual=plain(run(`standingsAt('${date}','${period}','${mode}')`));
        const expected=plain(reference.standings(period,mode,date));
        assert.deepEqual(actual.map(r=>[r.p.id,r.g,r.w,r.l]),expected.map(r=>[r.p.id,r.g,r.w,r.l]),`${league}/${date}/${period}/${mode} records/order`);
        actual.forEach((r,i)=>assert(Math.abs(r.r-expected[i].r)<1e-8,`${league}/${date}/${period}/${mode}/${r.p.id} score`));
        const before=JSON.stringify(app.S.matches);run(`rankDateComparison('a','${period}','${mode}',null,false,7)`);assert.equal(JSON.stringify(app.S.matches),before,'comparison must not mutate live matches');
      }
    }
  }
  console.log('PASS 날짜별 독립 재계산과 일치: 리그 3종 × 날짜 3개 × 통산/연도/월 × 실력/핸디전 · 부수 변경 · 원본 보존');
  app.S.lg='all';app.recompute();
  assert.equal(run("rankDateComparison('frozen').previous.status"),'ranked');
  assert.equal(run("rankDateComparison('frozen').current.status"),'frozen');
  assert.equal(run("rankDateComparison('frozen','all','skill',null,true).current.status"),'ranked');
  assert.equal(run("rankDateComparison('new').previous.status"),'provisional');
  assert.equal(run("rankDateComparison('new').current.status"),'ranked');
  assert(run("dateChangesHTML(rankDateComparison('new'))").includes('순위 진입'));
  assert.equal(run("rankDateComparison('empty').scoreDelta"),null);
  assert.equal(run("rankDateComparison('a','2026-09').rankDelta"),null);
  assert.equal(run("rankDateComparison('a','2026-07').matches.length"),0);
  assert.equal(run("rankDateComparison('a','2026-07').scoreDelta"),0);
  assert.equal(run("rankDateComparison('promoted','all','skill',8,false,7).current.status"),'filtered');
  assert.equal(run("rankDateComparison('promoted','all','skill',8,false,7).rankDelta"),null);
  run("S.meta.settings.leagues[0].buMin=8;S.lg='morning';recompute();");
  assert.equal(run("rankDateComparison('promoted','all','skill',null,false,7).current.status"),'ineligible');
  assert.equal(run("rankDateComparison('a').matches.length"),2);
  console.log('PASS 과거 날짜 기준 동결 · 경기 수 충족 시 순위 진입 · 기록 없음 · 종료 시즌 · 부수/참가 자격 필터');
  run("const originalGet=localStorage.getItem,originalSet=localStorage.setItem;localStorage.getItem=()=>{throw Error('blocked')};localStorage.setItem=()=>{throw Error('blocked')};");
  assert(run("dateChangesHTML(rankDateComparison('a'))").includes('2026-08-12 종료 시점'));
  run("localStorage.getItem=originalGet;localStorage.setItem=originalSet;S.rankCompareDays=7;");
  assert.equal(run("rankDateComparison('a').days"),7);
  const previousScore=run("rankDateComparison('a').previous.score");
  run("S.matches.find(m=>m.id==='week-edge').winnerId='b';recompute();");
  assert.notEqual(run("rankDateComparison('a').previous.score"),previousScore);
  const source=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
  assert(!/rankNeighborhood|rankVisitSnapshot|내 주변 순위|지난 방문 이후|rankListScope/.test(source));
  assert.equal(source,fs.readFileSync(require('path').join(__dirname,'..','table-tennis-elo.html'),'utf8'));
  console.log('PASS 첫 방문/저장 차단에서도 바로 비교 · 기간 전환 · 과거 경기 수정 시 캐시 갱신 · 이전 기능 제거 · 진입 파일 일치');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
