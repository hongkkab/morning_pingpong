/* 특성화(golden master) 테스트 — 실데이터 픽스처로 핵심 계산을 전부 돌려
   tests/golden.json 과 비교한다. 계산 로직을 리팩토링해도 결과가 그대로면 통과.
   실행:  node tests/golden-test.js            (비교)
         node tests/golden-test.js --update   (의도된 변경 후 기준값 갱신) */
const fs = require("fs");
const path = require("path");
const { createApp, loadFixture, setLeague } = require("./harness");

const GOLDEN = path.join(__dirname, "golden.json");
const UPDATE = process.argv.includes("--update");

(async () => {
  const app = loadFixture(await createApp());
  const S = app.S;
  const name = id => { const p = app.P(id); return p ? p.name : String(id); };
  const out = {};

  /* 1) 기본 집계 */
  out.counts = { players: S.players.length, matches: S.matches.length };

  /* 2) 리그별 × 트랙별 통산 랭킹 / 시즌 순위 */
  const lgs = ["all", ...app.leagues().map(x => x.id)];
  out.ranked = {}; out.standings = {}; out.seasons = {};
  for (const lg of lgs) {
    setLeague(app, lg);
    out.seasons[lg] = app.seasons();
    for (const mode of ["skill", "form"]) {
      out.ranked[lg + "|" + mode] = app.ranked(mode)
        .map(r => ({ n: r.p.name, r: Math.round(r.r), g: r.g, w: r.w, l: r.l }));
      for (const ym of out.seasons[lg]) {
        out.standings[lg + "|" + mode + "|" + ym] = app.standings(ym, mode)
          .map(r => ({ n: r.p.name, r: Math.round(r.r), g: r.g, w: r.w, l: r.l }));
      }
    }
  }

  /* 3) 시즌 최고 퍼포먼스 */
  setLeague(app, "all");
  out.bestSeasons = {};
  for (const mode of ["skill", "form"])
    out.bestSeasons[mode] = app.bestSeasons(mode).map(x => ({ ym: x.ym, n: x.p.name, r: x.r, g: x.g }));

  /* 4) 회차별 대진표 순위 + 통산성적 (리그마다) */
  out.rounds = {}; out.lgRecord = {};
  for (const lg of app.leagues().map(x => x.id)) {
    out.rounds[lg] = {};
    for (const rd of app.roundsOf(lg)) {
      const t = app.crossTable(lg, rd);
      out.rounds[lg][rd] = {
        order: t.order.map(name),
        rec: t.order.map(id => t.rec[id].w + "-" + t.rec[id].l + " " + t.rec[id].sw + ":" + t.rec[id].sl),
        standing: app.roundStanding(lg, rd).map(name),
      };
    }
    out.lgRecord[lg] = app.lgRecord(lg).list
      .map(b => ({ n: name(b.id), rounds: b.n, podium: b.podium, avg: +b.avg.toFixed(3), beat: b.beat, topBu: b.topBu }));
  }

  /* ---- 비교 또는 갱신 ---- */
  if (UPDATE || !fs.existsSync(GOLDEN)) {
    fs.writeFileSync(GOLDEN, JSON.stringify(out, null, 1));
    console.log((fs.existsSync(GOLDEN) ? "✅ 기준값 저장: " : "") + GOLDEN);
    console.log(`요약: 선수 ${out.counts.players} · 경기 ${out.counts.matches} · 스냅샷 키 ${Object.keys(out.standings).length + Object.keys(out.ranked).length}개`);
    return;
  }
  const golden = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
  const diffs = [];
  (function walk(a, b, p) {
    if (diffs.length > 20) return;
    if (typeof a !== typeof b) { diffs.push(`${p}: 타입 ${typeof a} → ${typeof b}`); return; }
    if (a && typeof a === "object") {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b || {})]))
        walk(a[k], (b || {})[k], p + "." + k);
      return;
    }
    if (a !== b) diffs.push(`${p}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  })(golden, out, "");
  if (diffs.length) {
    console.log(`❌ 기준값과 다른 곳 ${diffs.length}개${diffs.length > 20 ? "+" : ""}:`);
    diffs.slice(0, 20).forEach(d => console.log("  " + d));
    console.log("의도된 변경이면: node tests/golden-test.js --update");
    process.exit(1);
  }
  console.log(`✅ golden 일치 — 선수 ${out.counts.players} · 경기 ${out.counts.matches} · 리그 ${app.leagues().length}개 · 회차 ${Object.values(out.rounds).reduce((n, o) => n + Object.keys(o).length, 0)}개 전 구간`);
})().catch(e => { console.error("❌ 실행 실패:", e); process.exit(1); });
