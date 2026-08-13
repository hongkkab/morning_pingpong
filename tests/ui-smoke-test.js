/* UI 스모크 테스트 — 모든 탭 × 리그 조합에서 render()가 예외 없이
   의미 있는 HTML을 내놓는지 확인한다. (내용 검증은 golden-test 몫) */
const { createApp, loadFixture, setLeague } = require("./harness");

(async () => {
  const app = loadFixture(await createApp());
  const S = app.S;
  /* 관리자로 로그인한 상태처럼 — 관리 탭까지 그려보기 위해 */
  S.me = S.players.find(p => p.role === "admin") || S.players[0];

  const view = app.doc.querySelector("#view");
  const tabs = app.eval("tabList()").map(t => Array.isArray(t) ? t[0] : (t.id || t));
  console.log("탭:", tabs.join(", "));
  let failed = 0;
  const rosterText = "A조 @조대우 @권주홍 @방정제\nB조 @송제훈 @백종훈 @김지현";
  const rosterOrder = app.eval(`parseRoster(${JSON.stringify(rosterText)}, "quickmeet").list.map(x=>P(x.id).name+"@"+x.g)`);
  const rosterOk = JSON.stringify(rosterOrder) === JSON.stringify([
    "조대우@A", "권주홍@A", "방정제@A", "송제훈@B", "백종훈@B", "김지현@B"
  ]);
  if (!rosterOk) failed++;
  console.log(`${rosterOk ? "✅" : "❌"} 조별 명단 붙여넣기 순서 유지`);

  const rankFilterOk = app.eval(`
    (() => {
      const oldLg = S.lg, oldTab = S.tab;
      try {
        S.lg = 'all'; S.tab = 'rank';
        recompute(); viewRank();
        const h = document.querySelector('#view').innerHTML || '';
        return h.includes('id="rankLgSel"')
          && h.includes('lgbar bubar')
          && h.includes('<option value="all" selected>통합</option>')
          && !h.includes('data-lg="morning"');
      } finally {
        S.lg = oldLg; S.tab = oldTab; recompute();
      }
    })()
  `);
  if (!rankFilterOk) failed++;
  console.log(`${rankFilterOk ? "✅" : "❌"} 랭킹 리그 드롭다운·부수 필터 렌더링`);

  const bracketCalcOk = app.eval(`
    (() => {
      const ids = S.players.slice(0, 16).map(p => p.id);
      const brk = blankBracket();
      ids.forEach((id, i) => brk.main[i] = id);
      brk.low = [ids[13], ids[14], ids[15], ids[11]];
      [0,2,4,6,8,10,12,14].forEach((idx, k) => brk.win['m16_' + k] = ids[idx]);
      [0,4,8,12].forEach((idx, k) => brk.win['mq_' + k] = ids[idx]);
      [0,8].forEach((idx, k) => brk.win['ms_' + k] = ids[idx]);
      brk.win.mf_0 = ids[0];
      brk.win.l4_0 = ids[13];
      brk.win.l4_1 = ids[15];
      brk.win.lf_0 = ids[15];
      const bd = bracketData(brk);
      const rd = roundOf('2026-08-14', 'quickmeet');
      const order = roundStanding('quickmeet', rd, [
        {id:'s1', lg:'quickmeet', date:'2026-08-14', aId:ids[0], bId:ids[4], winnerId:ids[0], br:{kind:'semi', bracket:'main', order:13}},
        {id:'s2', lg:'quickmeet', date:'2026-08-14', aId:ids[8], bId:ids[12], winnerId:ids[8], br:{kind:'semi', bracket:'main', order:14}},
        {id:'f1', lg:'quickmeet', date:'2026-08-14', aId:ids[0], bId:ids[8], winnerId:ids[0], br:{kind:'final', bracket:'main', order:15}},
        {id:'l1', lg:'quickmeet', date:'2026-08-14', aId:ids[15], bId:ids[13], winnerId:ids[15], br:{kind:'lowfinal', bracket:'low', order:103}}
      ], P);
      return bd.r16[0].a === ids[0] && bd.r16[0].b === ids[1]
        && bd.summary.first === ids[0] && bd.summary.second === ids[8]
        && bd.summary.thirds[0] === ids[4] && bd.summary.thirds[1] === ids[12]
        && bd.summary.lowFirst === ids[15]
        && JSON.stringify(order.slice(0, 5)) === JSON.stringify([ids[0], ids[8], ids[4], ids[12], ids[15]]);
    })()
  `);
  if (!bracketCalcOk) failed++;
  console.log(`${bracketCalcOk ? "✅" : "❌"} 빨리모이 16강·하위4강 브래킷 순위 계산`);

  const bracketUiOk = app.eval(`
    (() => {
      const r = parseRoster(${JSON.stringify(rosterText)}, 'quickmeet');
      const rd = roundOf('2026-08-14', 'quickmeet');
      gridE = {lg:'quickmeet', date:'2026-08-14', _rd:rd, ids:r.list.map(x=>x.id),
        grp:{}, tbu:{}, hb:{}, res:{}, q:'', step:'grid', tab:'BR', rfmt:'leagueko',
        br:[], brk:blankBracket()};
      r.list.forEach(x => gridE.grp[x.id] = x.g);
      viewAddGrid('quickmeet');
      const h = document.querySelector('#view').innerHTML || '';
      return h.includes('data-bslot="main|0"') && h.includes('id="gBrOrder"') && h.includes('하위 4강');
    })()
  `);
  if (!bracketUiOk) failed++;
  console.log(`${bracketUiOk ? "✅" : "❌"} 빨리모이 브래킷 입력 UI 렌더링`);

  const bracketAnalysisOk = app.eval(`
    (() => {
      const oldMatches = S.matches.slice();
      const oldRounds = {...((S.meta && S.meta.rounds) || {})};
      const oldLg = S.lg, oldTab = S.tab, oldStat = S.statTab, oldClubTab = clubTab, oldCupLg = cupLg, oldCupRd = cupRd;
      try {
        const ids = S.players.slice(0, 8).map(p => p.id);
        const date = '2026-08-14', rd = roundOf(date, 'quickmeet');
        const brk = blankBracket();
        ids.forEach((id, i) => brk.main[i] = id);
        brk.low = [ids[4], ids[5], ids[6], ids[7]];
        brk.win = {m16_0:ids[0], m16_1:ids[2], m16_2:ids[4], m16_3:ids[6],
          mq_0:ids[0], mq_1:ids[4], ms_0:ids[0], l4_0:ids[4], l4_1:ids[6], lf_0:ids[6]};
        const grp = {};
        ids.forEach((id, i) => grp[id] = i < 4 ? 'A' : 'B');
        S.meta.rounds = {...oldRounds, [rdKey('quickmeet', rd)]:{fmt:'leagueko', ord:ids, grp, brk}};
        const mk = (id, node, kind, order, a, b, w, bracket='main') => ({
          id, lg:'quickmeet', date, aId:a, bId:b, winnerId:w,
          aSets:w===a?2:0, bSets:w===b?2:0,
          br:{node, kind, bracket, order, label:brKindName(kind)}, void:false
        });
        S.matches = oldMatches.concat([
          mk('tb1','m16_0','round16',1,ids[0],ids[1],ids[0]),
          mk('tb2','m16_1','round16',2,ids[2],ids[3],ids[2]),
          mk('tb3','m16_2','round16',3,ids[4],ids[5],ids[4]),
          mk('tb4','m16_3','round16',4,ids[6],ids[7],ids[6]),
          mk('tb5','mq_0','quarter',9,ids[0],ids[2],ids[0]),
          mk('tb6','mq_1','quarter',10,ids[4],ids[6],ids[4]),
          mk('tb7','ms_0','semi',13,ids[0],ids[4],ids[0]),
          mk('tb8','l4_0','lowsemi',101,ids[4],ids[5],ids[4],'low'),
          mk('tb9','l4_1','lowsemi',102,ids[6],ids[7],ids[6],'low'),
          mk('tb10','lf_0','lowfinal',103,ids[4],ids[6],ids[6],'low')
        ]);
        recompute();
        S.lg = 'quickmeet'; S.tab = 'stat'; S.statTab = 'club'; clubTab = 'round'; cupLg = 'quickmeet'; cupRd = rd;
        clubSheet(document.querySelector('#statBox'));
        const h = document.querySelector('#statBox').innerHTML || '';
        const ok1 = h.includes('조 순위') && !h.includes('A조 순위')
          && h.includes('cupbrx') && h.includes('하위 4강') && h.includes('cupbr-p win') && h.includes('cupres');
        S.meta.rounds = {...oldRounds, [rdKey('quickmeet', rd)]:{fmt:'leagueko', ord:ids.slice(0,2), grp:{}}};
        S.matches = oldMatches.concat([mk('tf1','mf_0','final',15,ids[0],ids[1],ids[0])]);
        recompute(); clubSheet(document.querySelector('#statBox'));
        const h2 = document.querySelector('#statBox').innerHTML || '';
        const ok2 = h2.includes('cupbr-p win') && h2.includes(nameOf(ids[0])) && h2.includes('최종 순위');
        return ok1 && ok2;
      } finally {
        S.matches = oldMatches;
        S.meta.rounds = oldRounds;
        S.lg = oldLg; S.tab = oldTab; S.statTab = oldStat; clubTab = oldClubTab; cupLg = oldCupLg; cupRd = oldCupRd;
        recompute();
      }
    })()
  `);
  if (!bracketAnalysisOk) failed++;
  console.log(`${bracketAnalysisOk ? "✅" : "❌"} 빨리모이 분석 탭 조 순위·브래킷 렌더링`);

  const quickmeetTitleOk = app.eval(`
    (() => {
      const oldMatches = S.matches.slice();
      const oldRounds = {...((S.meta && S.meta.rounds) || {})};
      const oldLg = S.lg, oldTab = S.tab, oldPeriod = S.period;
      try {
        const ids = S.players.slice(0, 8).map(p => p.id);
        const date = '2026-08-14', rd = roundOf(date, 'quickmeet');
        const brk = blankBracket();
        ids.forEach((id, i) => brk.main[i] = id);
        const grp = {};
        ids.forEach((id, i) => grp[id] = i < 4 ? 'A' : 'B');
        S.meta.rounds = {...oldRounds, [rdKey('quickmeet', rd)]:{fmt:'leagueko', ord:ids, grp, brk}};
        const gm = (id, a, b, w) => ({
          id, lg:'quickmeet', date, aId:a, bId:b, winnerId:w,
          aSets:w===a?2:0, bSets:w===b?2:0, void:false
        });
        const mk = (id, node, kind, order, a, b, w, bracket='main') => ({
          id, lg:'quickmeet', date, aId:a, bId:b, winnerId:w,
          aSets:w===a?2:0, bSets:w===b?2:0,
          br:{node, kind, bracket, order, label:brKindName(kind)}, void:false
        });
        S.matches = oldMatches.filter(m => lgOf(m) !== 'quickmeet').concat([
          gm('qg1',ids[0],ids[1],ids[0]), gm('qg2',ids[0],ids[2],ids[0]), gm('qg3',ids[0],ids[3],ids[0]),
          gm('qg4',ids[1],ids[2],ids[1]), gm('qg5',ids[1],ids[3],ids[1]), gm('qg6',ids[2],ids[3],ids[2]),
          gm('qg7',ids[4],ids[5],ids[4]), gm('qg8',ids[4],ids[6],ids[4]), gm('qg9',ids[4],ids[7],ids[4]),
          gm('qg10',ids[5],ids[6],ids[5]), gm('qg11',ids[5],ids[7],ids[5]), gm('qg12',ids[6],ids[7],ids[6]),
          mk('qt1','m16_0','round16',1,ids[0],ids[7],ids[0]),
          mk('qt2','m16_1','round16',2,ids[2],ids[5],ids[2]),
          mk('qt3','m16_2','round16',3,ids[4],ids[1],ids[4]),
          mk('qt4','m16_3','round16',4,ids[6],ids[3],ids[6]),
          mk('qt5','mq_0','quarter',9,ids[0],ids[2],ids[2]),
          mk('qt6','mq_1','quarter',10,ids[4],ids[6],ids[6]),
          mk('qt7','ms_0','semi',13,ids[2],ids[6],ids[2]),
          mk('qt8','mf_0','final',15,ids[2],ids[6],ids[2])
        ]);
        recompute();
        S.lg = 'quickmeet'; S.tab = 'rank'; S.period = '2026';
        const t = playerTitles('2026', 'skill');
        return (t[ids[2]] || []).some(x => x[0] === '토너먼트체질')
          && !(t[ids[0]] || []).some(x => x[0] === '토너먼트체질')
          && !(t[ids[6]] || []).some(x => x[0] === '토너먼트체질');
      } finally {
        S.matches = oldMatches;
        S.meta.rounds = oldRounds;
        S.lg = oldLg; S.tab = oldTab; S.period = oldPeriod;
        recompute();
      }
    })()
  `);
  if (!quickmeetTitleOk) failed++;
  console.log(`${quickmeetTitleOk ? "✅" : "❌"} 빨리모이 조별 대비 토너먼트체질 칭호`);

  const addDraftResetOk = app.eval(`
    (() => {
      const oldMatches = S.matches.slice();
      const oldRounds = {...((S.meta && S.meta.rounds) || {})};
      const oldGrid = gridE, oldBulk = bulk, oldTab = S.tab, oldLast = _lastTab, oldAdd = S.addLg;
      try {
        const ids = S.players.slice(0, 4).map(p => p.id);
        const date = '2026-08-14', rd = roundOf(date, 'quickmeet');
        gridE = {lg:'quickmeet', date, _rd:rd, ids:ids.slice(), grp:{}, tbu:{}, hb:{},
          res:{}, q:'홍', step:'grid', tab:'A', rfmt:'leagueko', br:[], brk:blankBracket(),
          paste:'A조 @홍길동', sets:{}};
        bulk = {date, meId:ids[0], picks:{[ids[1]]:{r:'W', n:1}}, q:'홍'};
        S.tab = 'rank'; _lastTab = 'add'; render();
        const leftCleared = gridE === null && bulk === null;

        S.meta.rounds = {...oldRounds, [rdKey('quickmeet', rd)]:{
          fmt:'leagueko', ord:ids, grp:{[ids[0]]:'A', [ids[1]]:'A', [ids[2]]:'B', [ids[3]]:'B'}, brk:blankBracket()
        }};
        S.tab = 'add'; S.addLg = 'quickmeet'; _lastTab = 'rank'; render();
        const h = document.querySelector('#view').innerHTML || '';
        const fresh = gridE && gridE.ids.length === 0 && h.includes('저장된 회차 불러오기');
        const btn = document.querySelector('#gLoadSaved');
        if(btn && btn.onclick) btn.onclick();
        const loaded = gridE && gridE.ids.length === ids.length && gridE.grp[ids[2]] === 'B';
        return leftCleared && fresh && loaded;
      } finally {
        S.matches = oldMatches;
        S.meta.rounds = oldRounds;
        gridE = oldGrid; bulk = oldBulk; S.tab = oldTab; _lastTab = oldLast; S.addLg = oldAdd;
        recompute(); render();
      }
    })()
  `);
  if (!addDraftResetOk) failed++;
  console.log(`${addDraftResetOk ? "✅" : "❌"} 경기 입력 임시 상태 초기화·수동 불러오기`);

  const visitStatsOk = await app.eval(`
    (async () => {
      const oldVisits = await sGet(KEY.visits);
      const oldMe = S.me, oldTab = S.tab, oldAllow = S._allowVisitTrack;
      try {
        S._allowVisitTrack = true;
        S.ready = true;
        S.me = S.players[0];
        S.tab = 'rank';
        await trackVisit(true);
        S.tab = 'stat';
        await trackVisit(true);
        const v = await sGet(KEY.visits);
        const d = v && v.daily && v.daily[today()];
        const visitors = d && d.visitors || {};
        const rows = Object.values(visitors);
        const member = v && v.members && v.members[S.players[0].id];
        const html = visitStatsHTML(v);
        return rows.some(r => r.tabs && r.tabs.rank && r.tabs.stat)
          && member && member.lastSeenAt
          && html.includes('방문 통계') && html.includes('IP, 기기 정보');
      } finally {
        if (oldVisits) await sSet(KEY.visits, oldVisits);
        else await sDel(KEY.visits);
        S.me = oldMe; S.tab = oldTab; S._allowVisitTrack = oldAllow;
      }
    })()
  `);
  if (!visitStatsOk) failed++;
  console.log(`${visitStatsOk ? "✅" : "❌"} 방문 통계 저장·관리자 표시`);

  const freezeOk = await app.eval(`
    (async () => {
      const oldMatches = S.matches.map(m => ({...m}));
      const oldBusy = S.busy, oldTab = S.tab, oldAdm = S.admTab, oldInfo = S.freezeInfo;
      try {
        const ids = S.matches.filter(m => !m.void && P(m.aId) && P(m.bId)).slice(0, 3).map(m => m.id);
        S.matches = S.matches.map(m => ids.includes(m.id)
          ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'exp'))
          : m);
        recompute();
        S.tab = 'admin'; S.admTab = 'rating'; render();
        await doFreeze(false);
        const fixed = ids.every(id => {
          const m = S.matches.find(x => x.id === id);
          return m && m.exp != null;
        });
        const h = document.querySelector('#view').innerHTML || '';
        return fixed && S.freezeInfo && S.freezeInfo.title.includes('완료')
          && h.includes('예상 승률 고정 완료');
      } finally {
        S.matches = oldMatches;
        S.busy = oldBusy; S.tab = oldTab; S.admTab = oldAdm; S.freezeInfo = oldInfo;
        recompute();
      }
    })()
  `);
  if (!freezeOk) failed++;
  console.log(`${freezeOk ? "✅" : "❌"} 예상 승률 시간순 고정 동작·상태 표시`);

  for (const lg of ["all", ...app.leagues().map(x => x.id)]) {
    setLeague(app, lg);
    for (const tab of tabs) {
      S.tab = tab;
      try {
        app.render();
        /* 분석 탭은 껍데기만 #view에 그리고 내용은 #statBox에 채운다 */
        let len = (view.innerHTML || "").length;
        if (tab === "stat") len = (app.doc.querySelector("#statBox").innerHTML || "").length;
        const ok = len > 100;
        if (!ok) failed++;
        console.log(`${ok ? "✅" : "❌"} lg=${lg} tab=${tab} (${len}자)`);
      } catch (e) {
        failed++;
        console.log(`❌ lg=${lg} tab=${tab}: ${e.message}`);
      }
    }
    /* 분석 > 대회 시뮬레이터 서브탭 */
    try {
      S.tab = "stat"; S.statTab = "sim"; app.render();
      const len = (app.doc.querySelector("#statBox").innerHTML || "").length;
      const ok = len > 100;
      if (!ok) failed++;
      console.log(`${ok ? "✅" : "❌"} lg=${lg} tab=stat/sim (${len}자)`);
    } catch (e) { failed++; console.log(`❌ lg=${lg} tab=stat/sim: ${e.message}`); }
    S.statTab = "club";
  }
  /* 비로그인(게스트) 화면도 한 바퀴 */
  S.me = null; S.tab = "rank"; setLeague(app, "all");
  try { app.render(); console.log(`✅ 게스트 rank (${(view.innerHTML || "").length}자)`); }
  catch (e) { failed++; console.log("❌ 게스트 rank: " + e.message); }

  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("❌ 실행 실패:", e); process.exit(1); });
