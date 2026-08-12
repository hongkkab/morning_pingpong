/* 테스트 하네스 — index.html의 앱 스크립트 전체를 Node 안에서 띄운다.
   브라우저 전용 API(document, localStorage 등)는 가짜로 채우고,
   Firebase 설정 블록은 일부러 빼서 완전히 오프라인으로 돈다.
   날짜는 2026-08-13 정오(KST)로 고정 — 테스트가 언제 돌아도 같은 결과. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const NOW = new Date("2026-08-13T12:00:00+09:00").getTime();

function mkDoc() {
  const cache = new Map();
  const mkEl = () => {
    const el = {
      style: {}, dataset: {}, value: "", innerHTML: "", textContent: "", checked: false,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {}, removeEventListener() {},
      appendChild() { return el; }, removeChild() {}, remove() {}, insertBefore() {},
      setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
      focus() {}, blur() {}, click() {}, select() {}, closest() { return null; },
      scrollIntoView() {}, scrollTo() {},
      querySelector(s) { return doc.querySelector(s); }, querySelectorAll() { return []; },
      getContext() { return new Proxy({}, { get: (t, k) => (k === "canvas" ? el : () => ({})) }); },
      getBoundingClientRect() { return { top: 0, left: 0, right: 360, bottom: 640, width: 360, height: 640 }; },
      tagName: "DIV", parentElement: null, firstChild: null, children: [],
      offsetWidth: 360, offsetHeight: 640, scrollHeight: 0, scrollTop: 0,
    };
    return el;
  };
  const doc = {
    title: "", body: mkEl(), documentElement: mkEl(),
    activeElement: { tagName: "BODY" },
    querySelector(s) { if (!cache.has(s)) cache.set(s, mkEl()); return cache.get(s); },
    querySelectorAll() { return []; },
    getElementById(id) { return doc.querySelector("#" + id); },
    createElement() { return mkEl(); },
    createTextNode() { return {}; },
    addEventListener() {}, removeEventListener() {},
  };
  return doc;
}

async function createApp() {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const app = blocks[blocks.length - 1]; // 마지막 블록이 앱 본문 (앞은 Firebase 설정)

  const doc = mkDoc();
  const store = new Map();
  const sandbox = {
    document: doc, console,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
      clear: () => store.clear(),
    },
    navigator: { userAgent: "node-test", onLine: false, clipboard: { writeText: async () => {} } },
    location: { href: "http://localhost/", hash: "", search: "", origin: "http://localhost", reload() {} },
    history: { pushState() {}, replaceState() {}, back() {} },
    screen: { width: 390, height: 844 },
    devicePixelRatio: 2, scrollY: 0, innerWidth: 390, innerHeight: 844,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    scrollTo() {}, open() { return null; },
    alert() {}, confirm() { return true; }, prompt() { return null; },
    fetch: () => Promise.reject(new Error("test: no network")),
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    requestAnimationFrame: cb => setTimeout(cb, 0), cancelAnimationFrame: clearTimeout,
    crypto: require("crypto").webcrypto,
    TextEncoder, TextDecoder, URL, URLSearchParams,
    Blob: class { constructor() {} }, File: class {}, FileReader: class { readAsDataURL() {} },
    Image: class { constructor() { this.onload = null; } },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    performance,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);

  /* 시계 고정 — 인자 없는 new Date()와 Date.now()가 항상 2026-08-13 정오를 가리킨다 */
  vm.runInContext(
    "const __RD__=Date;" +
    "Date=class extends __RD__{constructor(...a){if(a.length)super(...a);else super(" + NOW + ");}" +
    "static now(){return " + NOW + ";}};",
    ctx, { filename: "freeze-date.js" });

  vm.runInContext(app, ctx, { filename: "app.js" });
  await new Promise(r => setTimeout(r, 300)); // 부팅 IIFE(오프라인 경로)가 가라앉을 때까지

  const api = vm.runInContext(
    "({S, DEFAULTS, recompute, render, tabList, P, ranked, standings, seasons," +
    " monthStand, bestSeasons, crossTable, roundStanding, roundsOf, roundGroups," +
    " lgRecord, leagues, tieOrder, st})",
    ctx, { filename: "expose.js" });
  api.doc = doc;
  api.eval = code => vm.runInContext(code, ctx);
  return api;
}

/* 실데이터 픽스처(2026-08-13에 받은 Firebase 스냅샷)를 S에 싣는다 */
function loadFixture(api) {
  const fx = k => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", k + ".json"), "utf8"));
  const meta = fx("meta");
  meta.settings = Object.assign({}, api.DEFAULTS, meta.settings || {});
  api.S.meta = meta;
  const players = fx("players");
  api.S.players = (Array.isArray(players) ? players : Object.values(players)).filter(Boolean);
  api.S.matches = Object.values(fx("matches")).filter(Boolean);
  api.recompute();
  api.S.ready = true;
  return api;
}

/* 리그를 바꿀 때는 캐시를 비우고 다시 계산한다 (앱에서 칩 전환과 같은 효과) */
function setLeague(api, lg) {
  api.S.lg = lg;
  api.S._mcache = {};
  api.recompute();
}

module.exports = { createApp, loadFixture, setLeague, NOW };
