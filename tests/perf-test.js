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
  /* 재보정 = 저장된 보정을 지우고 처음부터 수렴 (50경기마다 · 과거 수정 시)
     평상시 저장 = 새 경기 1개 추가 후 재계산 (보정 재사용 경로) */
  const recal = () => { app.eval("localSet('tt:calib',{})"); app.recompute(); };
  /* 평상시 저장 = 오늘 경기 하나가 목록 맨 끝에 붙는다 (과거는 그대로 → 보정 재사용) */
  const newMatch = src => ({ ...src[src.length - 1], id: "m_perf_new",
    date: "2026-08-13", enteredAt: "2026-08-13T23:59:59.000Z" });
  const save1 = () => { S.matches = [...base, newMatch(base)]; app.recompute(); };
  console.log(`현재 규모: 선수 ${S.players.length} · 경기 ${base.length}`);
  console.log(`  재보정 포함 재계산:     ${ms(recal, 2)}ms  (50경기마다 1번)`);
  console.log(`  평상시 저장(경기 1개):  ${ms(save1, 3)}ms`);
  S.matches = base;
  console.log(`  render(랭킹 탭):        ${ms(() => { S.tab = "rank"; app.render(); }, 3)}ms`);
  console.log(`  render(기록 탭):        ${ms(() => { S.tab = "log"; app.render(); }, 3)}ms`);
  setLeague(app, "all");
  console.log(`  시즌 순위(standings):   ${ms(() => { S._mcache = {}; app.standings("2026-08", "skill"); }, 3)}ms`);

  /* 월 3,000~4,000경기 × 1년 ≈ 4만 경기 시나리오 */
  const SCALE = 15;
  S.matches = Array.from({ length: SCALE }, () => base.map(m => ({ ...m }))).flat();
  const big = S.matches.slice();
  const save1big = () => { S.matches = [...big, newMatch(big)]; app.recompute(); };
  console.log(`\n${SCALE}배 규모 (경기 ${S.matches.length} ≈ 연간 예상):`);
  console.log(`  재보정 포함 재계산:     ${ms(recal, 2)}ms  (50경기마다 1번)`);
  console.log(`  평상시 저장(경기 1개):  ${ms(save1big, 3)}ms`);
  S.matches = big;
  console.log(`  render(랭킹 탭):        ${ms(() => { S.tab = "rank"; app.render(); }, 3)}ms`);
  console.log(`  render(기록 탭):        ${ms(() => { S.tab = "log"; app.render(); }, 3)}ms`);
  console.log(`  시즌 순위(standings):   ${ms(() => { S._mcache = {}; app.standings("2026-08", "skill"); }, 3)}ms`);

  S.matches = base; app.recompute();
})().catch(e => { console.error("실행 실패:", e); process.exit(1); });
