const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-morning-band-comments');
fs.mkdirSync(outDir, { recursive: true });
const post = process.argv[2] || '926088201';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getPageWs() {
  const pages = await fetch('http://127.0.0.1:9223/json/list').then(r => r.json());
  const page = pages.find(p => p.type === 'page' && /band\.us/.test(p.url)) || pages.find(p => p.type === 'page');
  if (!page) throw new Error('No BAND page');
  return page.webSocketDebuggerUrl;
}
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const item = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? item.reject(new Error(JSON.stringify(msg.error))) : item.resolve(msg.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    ws.send(JSON.stringify({ id: callId, method, params }));
  });
  return { ws, send };
}
async function ev(send, expression) {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result.value;
}
async function setRange(send) {
  await send('Page.navigate', { url: 'https://www.band.us/band/9136101/board/period-search' });
  await sleep(3000);
  const ok = await ev(send, `(() => {
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const inputs = [...document.querySelectorAll('input')].filter(visible).filter(i => /\\d{4}/.test(i.value || '') || /\\uB0A0\\uC9DC|date/i.test(i.placeholder || i.className || '')).slice(0, 2);
    if (inputs.length < 2) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inputs[0], '2026. 08. 13.');
    setter.call(inputs[1], '2026. 08. 13.');
    for (const input of inputs) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btn = document.querySelector('button._btnPeriodSearch') || [...document.querySelectorAll('button')].find(b => /검색/.test(b.innerText || b.textContent || ''));
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  if (!ok) throw new Error('range failed');
  await sleep(4000);
}
async function openComment(send) {
  for (let i = 0; i < 25; i++) {
    const found = await ev(send, `(() => {
      const link = [...document.querySelectorAll('a[href*="/band/9136101/post/${post}"]')].find(a => a.offsetParent !== null);
      if (!link) { window.scrollBy(0, 900); return false; }
      const card = link.closest('article.cContentsCard') || link.closest('article') || link.parentElement;
      card.scrollIntoView({ block: 'center' });
      const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
      for (const b of [...card.querySelectorAll('button._btnMore, button._commentCountBtn, button._commentToggleBtn, a._commentCountBtn, a._commentToggleBtn')]) {
        if (b.offsetParent !== null) b.click();
      }
      const more = [...card.querySelectorAll('button, a')].filter(b => b.offsetParent !== null && /이전 댓글|댓글 더보기|더보기/.test(clean(b.innerText || b.textContent || '')));
      for (const b of more) b.click();
      return true;
    })()`);
    if (found) break;
    await sleep(500);
  }
  await sleep(2000);
}
async function collect(send) {
  return ev(send, `(() => {
    const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
    const link = [...document.querySelectorAll('a[href*="/band/9136101/post/${post}"]')].find(a => a.offsetParent !== null);
    const card = link && (link.closest('article.cContentsCard') || link.closest('article') || link.parentElement);
    if (!card) return { ok: false, reason: 'no card' };
    const names = [...card.querySelectorAll('.nameWrap')];
    const rows = names.map((nameEl, i) => {
      const ancestors = [];
      let node = nameEl;
      for (let d = 0; d < 8 && node; d++, node = node.parentElement) {
        ancestors.push({
          depth: d,
          tag: node.tagName,
          cls: String(node.className || ''),
          text: clean(node.innerText || node.textContent || '').slice(0, 1500),
        });
      }
      return { i, name: clean(nameEl.innerText || nameEl.textContent || ''), ancestors };
    });
    const all = [...card.querySelectorAll('*')].map((el, i) => ({
      i,
      tag: el.tagName,
      cls: String(el.className || ''),
      text: clean(el.innerText || el.textContent || '').slice(0, 1200),
    })).filter(x => x.text && x.text.length < 1000 && /오전|오후|시간 전|분 전|\\d+\\s*[:：]\\s*\\d+|승|패|@/.test(x.text));
    return { ok: true, cardText: clean(card.innerText || card.textContent || '').slice(0, 8000), rows, all };
  })()`);
}
(async () => {
  const { ws, send } = await connect(await getPageWs());
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await setRange(send);
    await openComment(send);
    const data = await collect(send);
    fs.writeFileSync(path.join(outDir, `post_${post}_comment_nodes.json`), JSON.stringify(data, null, 2), 'utf8');
    console.log('ok', data.ok, 'rows', data.rows?.length, 'all', data.all?.length);
    console.log('CARD');
    console.log(data.cardText);
    console.log('ROWS');
    for (const row of data.rows || []) {
      console.log('NAME', row.name);
      for (const a of row.ancestors) console.log(a.depth, a.tag, a.cls.slice(0, 80), '=>', a.text);
      console.log('---');
    }
  } finally {
    ws.close();
  }
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
