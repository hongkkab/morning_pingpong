/* 성능 측정 — 데이터가 커졌을 때 어디가 얼마나 느려지는지 잰다.
   run-all에는 포함하지 않는 정보용 도구. 실행: node tests/perf-test.js */
const { createApp, loadFixture, setLeague } = require("./harness");

const ms = (fn, n = 1) => {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  return Math.round((performance.now() - t0) / n * 10) / 10;
};

(async () => {
  const app = loadFixture(await createApp());
  const S = app.S;
  const base = S.matches.slice();
  console.log(`현재 규모: 선수 ${S.players.length} · 경기 ${base.length}`);
  console.log(`  recompute(전체 재계산): ${ms(() => app.recompute(), 3)}ms`);
  console.log(`  render(랭킹 탭):        ${ms(() => { S.tab = "rank"; app.render(); }, 3)}ms`);
  console.log(`  render(기록 탭):        ${ms(() => { S.tab = "log"; app.render(); }, 3)}ms`);
  setLeague(app, "all");
  console.log(`  시즌 순위(standings):   ${ms(() => { S._mcache = {}; app.standings("2026-08", "skill"); }, 3)}ms`);

  /* 월 3,000~4,000경기 × 1년 ≈ 4만 경기 시나리오 */
  const SCALE = 15;
  S.matches = Array.from({ length: SCALE }, () => base.map(m => ({ ...m }))).flat();
  console.log(`\n${SCALE}배 규모 (경기 ${S.matches.length} ≈ 연간 예상):`);
  console.log(`  recompute(전체 재계산): ${ms(() => app.recompute(), 3)}ms`);
  console.log(`  render(랭킹 탭):        ${ms(() => { S.tab = "rank"; app.render(); }, 3)}ms`);
  console.log(`  render(기록 탭):        ${ms(() => { S.tab = "log"; app.render(); }, 3)}ms`);
  console.log(`  시즌 순위(standings):   ${ms(() => { S._mcache = {}; app.standings("2026-08", "skill"); }, 3)}ms`);

  S.matches = base; app.recompute();
})().catch(e => { console.error("실행 실패:", e); process.exit(1); });
