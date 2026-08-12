/* Firebase RTDB에서 최신 클럽 데이터를 받아 tests/fixtures/에 저장한다.
   실행: node tests/fetch-fixture.js  (특성화 테스트의 기준 데이터 갱신용) */
const fs = require("fs");
const path = require("path");
const BASE = "https://morning-pingpong-default-rtdb.asia-southeast1.firebasedatabase.app/clubs/morning";
const OUT = path.join(__dirname, "fixtures");
fs.mkdirSync(OUT, { recursive: true });

/* 공개 저장소에 올라가는 파일이므로 계산에 안 쓰는 민감 필드는 뺀다 */
function sanitize(k, data) {
  if (k !== "players") return data;
  const strip = p => {
    if (!p) return p;
    const { pinHash, cardImg, bio, rubber, grip, sex, ...rest } = p;
    return rest;
  };
  return Array.isArray(data) ? data.map(strip)
       : Object.fromEntries(Object.entries(data).map(([i, p]) => [i, strip(p)]));
}

(async () => {
  for (const k of ["players", "meta", "matches"]) {
    const res = await fetch(`${BASE}/${k}.json`);
    if (!res.ok) throw new Error(`${k}: HTTP ${res.status}`);
    const text = JSON.stringify(sanitize(k, await res.json()));
    fs.writeFileSync(path.join(OUT, `${k}.json`), text);
    console.log(`${k}: ${text.length} bytes`);
  }
})();
