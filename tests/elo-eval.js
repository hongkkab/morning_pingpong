/* Elo 규칙 평가 도구 — 전체 경기를 시간순 재생하며 각 변형의 예측력을 잰다.
   기준: Brier 점수(낮을수록 좋음)와 로그손실. 엔진이 경기 직전 계산한 _expA를 쓰므로
   각 예측은 그 시점까지의 정보만 반영한다. (예외: residual 상수는 전 구간 고정 —
   변형끼리 같은 조건이라 비교는 공정하다.)
   실행: node tests/elo-eval.js */
const { createApp, loadFixture } = require("./harness");

/* 모든 변형의 공통 기반 — 자동 보정을 끄고 residual을 고정해 비교 조건을 맞춘다 */
const BASE = { autoCalib: false, residualBu: 108, movOn: false };

const VARIANTS = [
  { label: "현행 (K40/28/20·반감기30·반복5)", over: {} },
  { label: "반감기 90일", over: { kHalfLife: 90 } },
  { label: "반감기 180일", over: { kHalfLife: 180 } },
  { label: "반감기 365일", over: { kHalfLife: 365 } },
  { label: "K기본 14 (더 안정)", over: { kBase: 14 } },
  { label: "K기본 26 (더 민감)", over: { kBase: 26 } },
  { label: "신인 K 60", over: { kNew: 60 } },
  { label: "반복 감쇠 끔", over: { repeatN0: 0 } },
  { label: "반복 감쇠 10 (느슨)", over: { repeatN0: 10 } },
  { label: "잔여 격차 60", over: { residualBu: 60 } },
  { label: "잔여 격차 150", over: { residualBu: 150 } },
  { label: "핸디 환산 80", over: { handiElo: 80 } },
  { label: "핸디 환산 110", over: { handiElo: 110 } },
  { label: "조합A: K26+신인60+잔여60+핸디80", over: { kBase: 26, kNew: 60, residualBu: 60, handiElo: 80 } },
  { label: "조합B: 조합A+반복감쇠 끔", over: { kBase: 26, kNew: 60, residualBu: 60, handiElo: 80, repeatN0: 0 } },
  { label: "조합C: K26+신인60만", over: { kBase: 26, kNew: 60 } },
  { label: "MOV: 세트 폭 반영(대회 경기만)", over: { movOn: true } },
  { label: "MOV + 조합C", over: { movOn: true, kBase: 26, kNew: 60 } },
];

(async () => {
  const results = [];
  for (const v of VARIANTS) {
    const app = loadFixture(await createApp());
    const r = JSON.parse(app.eval(`(()=>{
      S.meta.settings = { ...S.meta.settings, ...${JSON.stringify(BASE)}, ...${JSON.stringify(v.over)} };
      S.lg='all';
      recompute();
      let n=0, brier=0, ll=0;
      for(const m of S._sorted){
        const e=m._expA;
        if(e==null || e<=0.001 || e>=0.999) continue;
        const y = winnerOf(m)===m.aId ? 1 : 0;
        brier += (y-e)*(y-e);
        ll    += -(y*Math.log(e)+(1-y)*Math.log(1-e));
        n++;
      }
      return JSON.stringify({ n, brier: brier/n, ll: ll/n });
    })()`));
    results.push({ label: v.label, ...r });
    console.log("측정:", v.label, "Brier", r.brier.toFixed(5));
  }

  /* 참고 기준선 — 엔진 없이 */
  const app = loadFixture(await createApp());
  const refs = JSON.parse(app.eval(`(()=>{
    S.meta.settings = { ...S.meta.settings, ...${JSON.stringify(BASE)} };
    S.lg='all'; recompute();
    let n=0, b50=0, bs=0, l50=0, ls=0;
    for(const m of S._sorted){
      if(m._expA==null) continue;
      const A=P(m.aId), B=P(m.bId); if(!A||!B) continue;
      const y = winnerOf(m)===m.aId ? 1 : 0;
      /* 부수 기준값 + 핸디만으로 예측 (경기 시점 부수) */
      let ea = baseFor(buOnDate(m.aId,m.date)), eb = baseFor(buOnDate(m.bId,m.date));
      if(m.handi && m.handi.pts>0){
        const he = st().handiElo || 0;
        if(m.handi.toId===m.aId) ea += m.handi.pts*he; else eb += m.handi.pts*he;
      }
      const es = Math.min(.999, Math.max(.001, 1/(1+Math.pow(10,(eb-ea)/400))));
      b50 += (y-0.5)*(y-0.5);  l50 += Math.log(2);
      bs  += (y-es)*(y-es);    ls  += -(y*Math.log(es)+(1-y)*Math.log(1-es));
      n++;
    }
    return JSON.stringify({ n,
      null50: { brier: b50/n, ll: l50/n },
      static: { brier: bs/n,  ll: ls/n } });
  })()`));

  console.log("\n===== 결과 (경기 " + results[0].n + "판, Brier 낮을수록 좋음) =====");
  console.log(("고정 50% (기준선)").padEnd(30) + " Brier " + refs.null50.brier.toFixed(5) + "  로그손실 " + refs.null50.ll.toFixed(5));
  console.log(("부수 기준값+핸디만").padEnd(30) + " Brier " + refs.static.brier.toFixed(5) + "  로그손실 " + refs.static.ll.toFixed(5));
  const base = results[0];
  results.slice().sort((a, b) => a.brier - b.brier).forEach(r => {
    const d = ((r.brier - base.brier) / base.brier * 100);
    console.log(r.label.padEnd(30) + " Brier " + r.brier.toFixed(5) + "  로그손실 " + r.ll.toFixed(5)
      + "  (현행 대비 " + (d >= 0 ? "+" : "") + d.toFixed(2) + "%)");
  });
  process.exit(0);
})().catch(e => { console.error("실패:", e); process.exit(1); });
