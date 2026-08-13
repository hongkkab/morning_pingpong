/* 순위 알고리즘 회귀 테스트 — index.html에서 함수를 그대로 뽑아 실행한다.
   실행: node tests/rank-test.js  (실패 시 종료 코드 1) */
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let failed = 0;
const check = (name, ok) => { console.log((ok ? "✅" : "❌") + " " + name); if (!ok) failed++; };

/* ---- 문법 검사: 인라인 <script> 블록 ---- */
const { execFileSync } = require("child_process");
const os = require("os");
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
scripts.forEach((s, i) => {
  const f = path.join(os.tmpdir(), `tt-block${i}.js`);
  fs.writeFileSync(f, s);
  try { execFileSync(process.execPath, ["--check", f]); check(`script${i} 문법`, true); }
  catch (e) { check(`script${i} 문법`, false); console.log(String(e.stderr || e)); }
});

/* ---- 함수 원문 추출 (중괄호 짝 맞추기) ---- */
function extract(name) {
  const start = html.indexOf("function " + name);
  if (start < 0) throw new Error(name + " not found");
  let i = html.indexOf("{", start), depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  throw new Error("brace mismatch in " + name);
}
const srcTie = extract("tieOrder");
const srcLive = extract("liveRank");
const srcCross = extract("crossTable");
const srcGridStand = extract("gridStandHTML");

/* ---- 데이터: '26년 32주차 점사모 (10승 3자 순환 동률이 있는 실제 회차) ---- */
const names = ["김현석","선승원","조이태","신원일","진병학","송제훈","서호철","양희진","이중배","김상웅","이현수","정창근","정재규","박효원","서순자"];
const bus   = [8,8,7,6,5,8,4,7,7,5,8,6,5,6,9];
const grid = [
  ["-",0,1,0,2,2,1,0,1,2,1,"X",0,0,1],
  [2,"-",2,2,2,2,1,2,0,0,2,2,1,2,2],
  [2,1,"-",2,0,0,1,0,2,2,2,2,1,0,"X"],
  [2,1,0,"-",0,2,2,2,0,2,0,2,1,"X",2],
  [1,0,2,2,"-",1,2,2,2,2,2,2,2,2,0],
  [1,0,2,0,2,"-",1,2,1,"X",2,2,1,0,1],
  [2,2,2,0,0,2,"-",0,2,0,2,2,2,2,2],
  [2,0,2,0,1,0,2,"-",2,0,"X",2,2,1,2],
  [2,2,0,2,1,2,0,1,"-",2,"X","X",0,2,2],
  [1,2,0,0,0,"X",2,2,1,"-",2,2,"X",2,0],
  [2,0,0,2,0,0,0,"X","X",1,"-",1,2,0,0],
  ["X",0,0,1,0,1,0,0,"X",0,2,"-",0,2,2],
  [2,2,2,2,1,2,1,0,2,"X",1,2,"-",2,2],
  [2,0,2,"X",0,2,1,2,0,0,2,0,0,"-",2],
  [2,1,"X",0,2,2,0,0,1,2,2,1,0,1,"-"],
];
const id = i => "p" + i;
const pf = pid => ({ bu: bus[+pid.slice(1)] });
function buildMatches(g) {
  const ms = [];
  for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) {
    const va = g[a][b], vb = g[b][a];
    if (va === "X" || va === "-" || vb === "X" || vb === "-") continue;
    ms.push({ aId: id(a), bId: id(b), aSets: va, bSets: vb,
              winnerId: va > vb ? id(a) : id(b) });
  }
  return ms;
}

/* ---- 1) crossTable — 전역(S·P) 없이 인자만으로 ---- */
const fnCross = new Function("S", "P", "lgOf", "rdOf", "winnerOf", "all", "pf",
  srcTie + ";" + srcCross + "; return crossTable('L','R',null,all,pf);");
const t = fnCross(undefined, undefined, () => "L", () => "R", m => m.winnerId,
  buildMatches(grid), pf);
console.log("\n[crossTable 순위 — 전역 없이 실행]");
t.order.forEach((p, k) => console.log(`${k + 1}. ${names[+p.slice(1)]}(${t.rec[p].w}-${t.rec[p].l})`));
const top3 = t.order.slice(0, 3).map(p => names[+p.slice(1)]).join(",");
check("전역 스텁 없이 동작 (인자화)", true);
check("10승 3자 순환 동률: 진병학→서호철→선승원", top3 === "진병학,서호철,선승원");

/* ---- 2) gridStandHTML(입력 중 순위표) — 저장 기록과 같은 순서인가 ---- */
const ids = names.map((_, i) => id(i));
const getR = (a, b) => {
  const va = grid[+a.slice(1)][+b.slice(1)], vb = grid[+b.slice(1)][+a.slice(1)];
  if (va === "X" || va === "-" || vb === "X" || vb === "-") return null;
  return va > vb ? a : b;
};
const setOf = (a, b) => {
  const va = grid[+a.slice(1)][+b.slice(1)], vb = grid[+b.slice(1)][+a.slice(1)];
  if (va === "X" || vb === "X") return "-";
  return { [a]: va, [b]: vb };
};
const fnGrid = new Function("P", "esc", "nameOf", "gridE", "groups", "inGroup", "getR", "useGrp", "setOf",
  srcTie + ";" + srcLive + ";" + srcGridStand + "; return gridStandHTML(groups, inGroup, getR, useGrp, setOf);");
const htmlOut = fnGrid(pf, s => s, p => p, { tbu: {} }, ["A"], () => ids, getR, false, setOf);
const gridOrder = [...htmlOut.matchAll(/data-psheet="(p\d+)"/g)].map(x => x[1]);
check("입력 중 순위표 = 저장 기록 순위 (전 구간 일치)",
  JSON.stringify(gridOrder) === JSON.stringify(t.order));

process.exit(failed ? 1 : 0);
