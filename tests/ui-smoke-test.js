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
