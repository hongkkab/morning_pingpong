/* 승률·Elo 일치 회귀 검증. 외부 저장소 없이 실제 앱 함수를 실행한다. */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {createApp, loadFixture, setLeague} = require('./harness');

(async () => {
  const app = await createApp();
  const run = fn => app.eval('(' + fn.toString() + ')()');
  const near = (a, b) => assert.ok(Math.abs(a-b)<1e-10, `${a} != ${b}`);
  app.eval(`
    function resetProbabilityTest(over={}){
      S.meta={settings:{...DEFAULTS,autoCalib:false,residualBu:0,handiElo:100,ptsPerBu:1,
        kNew:20,kMid:20,kBase:20,repeatN0:0,shrinkC:6,poolCeilingBu:0,
        confirmedOnly:false,movOn:false,...over}};
      S.lg='all'; S._calib=null; S._mcache={};
      S.players=['A','B','C'].map(id=>({id,name:id,bu:10,active:true}));
      S.matches=[];
      recompute();
    }
    function probabilityMatch(id, over={}){
      return {id,date:'2026-08-01',enteredAt:'2026-08-01T00:00:'+String(id).padStart(2,'0')+'Z',
        aId:'A',bId:'B',winnerId:'A',lg:'morning',void:false,confirmedBy:['A','B'],...over};
    }
  `);

  const capped = run(function(){
    resetProbabilityTest();
    S.matches=Array.from({length:20},(_,i)=>probabilityMatch(i)); recompute();
    const draw=drawOnce({ids:['A','B','C'],useHandi:false,format:'league'});
    const a=draw.league.find(p=>p.id==='A'),b=draw.league.find(p=>p.id==='B');
    const sim=simWinProb(a,b,false),now=expNow('A','B',null),fair=fairHandi('A','B').exp;
    const raw=rawRate('A','skill'),shown=rateOf('A','skill');
    const last=probabilityMatch(20,{exp:0.99}); S.matches.push(last); recompute();
    const prey=nemesisPrey('A').prey.find(x=>x.oid==='B');
    return {sim,now,fair,raw,shown,drawRating:a.r,engine:last._expA,display:expOf(last),gain:last._sA,
      preyExp:prey&&prey.exp,engineTotal:S._sorted.reduce((sum,m)=>sum+m._expA,0)};
  });
  assert.ok(capped.raw>capped.shown+50);
  near(capped.drawRating,capped.raw);
  for(const value of [capped.now,capped.fair,capped.engine,capped.display]) near(value,capped.sim);
  near(capped.gain,20*(1-capped.display));
  near(capped.preyExp,capped.engineTotal);
  console.log('PASS 점수 상한·신뢰 보정이 있어도 시뮬레이터·상대 분석·실제 증감 승률 일치');

  const wins = run(function(){
    return [9,10,11].map(bu=>{
      resetProbabilityTest({handiElo:400*Math.log10(4),handiOn:false});
      S.players[0].bu=bu===11?10:bu; S.players[1].bu=bu===11?9:10;
      const m=probabilityMatch(0); S.matches=[m]; recompute();
      return {p:expOf(m),gain:m._sA};
    });
  });
  [0.8,0.5,0.2].forEach((p,i)=>{near(wins[i].p,p);near(wins[i].gain,[4,10,16][i]);});
  console.log('PASS 같은 K에서 승률 80%·50%·20% 승리 시 +4·+10·+16점');

  const handicap = run(function(){
    const cases=[];
    for(const handiOn of [true,false]) for(const useHandi of [true,false]) for(const he of [0,40]){
      resetProbabilityTest({handiOn,leagues:[{id:'morning',name:'기본'},
        {id:'custom',name:'별도',rules:{ptsPerBu:2,maxHandi:3,lowBu:10,lowMaxHandi:5,handiElo:he}}]});
      S.players[0].bu=7; S.lg='custom'; recompute();
      const d=drawOnce({ids:['A','B','C'],useHandi,format:'league'});
      const a=d.league.find(p=>p.id==='A'),b=d.league.find(p=>p.id==='B');
      const hd=useHandi?handiForMatch('A','B','2026-08-01','custom'):null;
      const p=simWinProb(a,b,useHandi),reverse=simWinProb(b,a,useHandi);
      const now=expNow('A','B',hd),fair=useHandi?fairHandi('A','B').exp:null;
      S.lg='all'; const explicit=expNow('A','B',hd,'custom'); S.lg='custom';
      const m=probabilityMatch(0,{lg:'custom',handi:hd}); S.matches=[m];recompute();
      cases.push({p,reverse,now,fair,explicit,engine:m._expA,gain:m._sA,pts:hd&&hd.pts,handiOn,useHandi,he});
    }
    return cases;
  });
  for(const x of handicap){
    const expected=1/(1+10**((-300+(x.handiOn&&x.useHandi?5*x.he:0))/400));
    near(x.p,expected);near(x.p+x.reverse,1);
    for(const v of [x.now,x.explicit,x.engine]) near(v,expected);
    if(x.fair!=null) near(x.fair,expected);
    if(x.useHandi) assert.equal(x.pts,5);
    near(x.gain,20*(1-expected));
  }
  console.log('PASS 리그별 핸디 환산·상한·0점 환산·보정 끔·노핸디·양쪽 대칭');

  const history = run(function(){
    resetProbabilityTest();
    const first=probabilityMatch(0,{exp:.99}),second=probabilityMatch(1,{exp:.99});
    S.matches=[first,second];recompute();
    const sequential=[expOf(first),expOf(second)];
    const before=expOf(first);
    S.matches.push(probabilityMatch(2,{date:'2026-07-31',winnerId:'B',exp:.01}));recompute();
    const backfilled=expOf(first);
    S.matches[2].date='2026-08-02';recompute();
    const moved=expOf(first);
    S.meta.settings.kNew=40; S.meta.settings.kMid=40; S.meta.settings.kBase=40; recompute();
    const changed=expOf(second),changedGain=second._sA;
    S.meta.settings.confirmedOnly=true; S.meta.settings.legacyBefore='';
    first.confirmedBy=[]; recompute();const pending=expOf(first),pendingDelta=first._sA;
    first.confirmedBy=['A','B'];first.lg='custom';S.lg='morning';recompute();
    const otherLeague=expOf(first),otherDelta=first._sA;
    S.lg='all';recompute();const restored=expOf(first);
    S.players=S.players.filter(p=>p.id!=='B');recompute();const missing=expOf(first);
    return {sequential,before,backfilled,moved,changed,changedGain,pending,pendingDelta,
      otherLeague,otherDelta,restored,missing,stored:first.exp};
  });
  near(history.sequential[0],.5); assert.ok(history.sequential[1]>.5);
  assert.ok(history.backfilled<history.before);near(history.moved,.5);
  assert.ok(history.changed>history.sequential[1]);near(history.changedGain,40*(1-history.changed));
  assert.equal(history.pending,null);assert.equal(history.pendingDelta,undefined);
  assert.equal(history.otherLeague,null);assert.equal(history.otherDelta,undefined);
  assert.ok(history.restored!=null);assert.equal(history.missing,null);assert.equal(history.stored,.99);
  console.log('PASS 묶음·과거 입력·날짜 변경·규칙 변경·리그 전환·미확인 경기에서 낡은 예상값 배제');

  loadFixture(app); setLeague(app,'all');
  const actual=run(function(){
    const ms=S._sorted.filter(m=>m._expA!=null);
    const stale=ms.filter(m=>m.exp!=null&&Math.abs(m.exp-m._expA)>.05);
    return {count:ms.length,stale:stale.length,mismatch:ms.filter(m=>expOf(m)!==m._expA).length,
      sample:stale.slice(0,3).map(m=>({date:m.date,saved:m.exp,shown:expOf(m),engine:m._expA}))};
  });
  assert.ok(actual.count>12000);assert.ok(actual.stale>1000);assert.equal(actual.mismatch,0);
  assert.equal(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','table-tennis-elo.html'),'utf8'));
  console.log(`PASS 실제 ${actual.count}경기 표시 승률 = Elo 반영 승률; 낡은 저장값 ${actual.stale}건 무시; 두 HTML 일치`);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
