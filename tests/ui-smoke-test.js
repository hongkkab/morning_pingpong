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
