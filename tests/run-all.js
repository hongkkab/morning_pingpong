/* 전체 테스트 실행: node tests/run-all.js */
const { spawnSync } = require("child_process");
const path = require("path");
const files = ["rank-test.js", "golden-test.js", "ui-smoke-test.js"];
let failed = 0;
for (const f of files) {
  console.log(`\n━━━ ${f} ━━━`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: "inherit" });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n❌ ${failed}개 파일 실패` : "\n✅ 전체 통과");
process.exit(failed ? 1 : 0);
