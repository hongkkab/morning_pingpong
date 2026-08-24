const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep');
fs.mkdirSync(outDir, { recursive: true });

const windows = [
  ['quickmeet_feb03', '2026. 01. 29.', '2026. 02. 08.'],
  ['quickmeet_mar03', '2026. 02. 26.', '2026. 03. 09.'],
  ['quickmeet_mar17', '2026. 03. 17.', '2026. 03. 25.'],
  ['quickmeet_jun02', '2026. 05. 28.', '2026. 06. 10.'],
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getPageWs() {
  const pages = await fetch('http://127.0.0.1:9223/json/list').then(r => r.json());
  const page = pages.find(p => p.type === 'page' && /band\.us/.test(p.url)) || pages.find(p => p.type === 'page');
  if (!page) throw new Error('No BAND page');
  return page.webSocketDebuggerUrl;
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
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

async function setRange(send, start, end) {
  await send('Page.navigate', { url: 'https://www.band.us/band/9136101/board/period-search' });
  await sleep(3500);
  const ok = await ev(send, `(() => {
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const inputs = [...document.querySelectorAll('input')].filter(visible).filter(i => /\\d{4}/.test(i.value || '') || /\\uB0A0\\uC9DC|date/i.test(i.placeholder || i.className || '')).slice(0, 2);
    if (inputs.length < 2) return { ok: false, reason: 'no date inputs', inputs: [...document.querySelectorAll('input')].map(i => ({ cls: i.className, ph: i.placeholder, value: i.value })) };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inputs[0], ${JSON.stringify(start)});
    setter.call(inputs[1], ${JSON.stringify(end)});
    for (const input of inputs) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btn = document.querySelector('button._btnPeriodSearch') || [...document.querySelectorAll('button')].find(b => /\\uAC80\\uC0C9/.test(b.innerText || b.textContent || '') && /PeriodSearch|uButton/.test(b.className || ''));
    if (!btn) return { ok: false, reason: 'no search button', values: inputs.map(i => i.value) };
    btn.click();
    return { ok: true, values: inputs.map(i => i.value) };
  })()`);
  if (!ok.ok) throw new Error(`set range failed ${start}-${end}: ${JSON.stringify(ok)}`);
  await sleep(4500);
}

async function collect(send) {
  return ev(send, `(() => {
    const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
    const anchors = [...document.querySelectorAll('a[href*="/band/9136101/post/"]')];
    const rows = anchors.map(a => {
      const href = a.href.split('/comment/')[0];
      const m = href.match(/\\/post\\/(\\d+)/);
      if (!m) return null;
      let node = a;
      let best = clean(a.innerText || a.textContent || '');
      for (let i = 0; i < 9 && node && node.parentElement; i++) {
        node = node.parentElement;
        const text = clean(node.innerText || node.textContent || '');
        if (text.length > best.length && text.length < 6000) best = text;
        if (/\\d{4}\\uB144/.test(text) && text.length > 130) break;
      }
      return { post: m[1], href, text: best.slice(0, 1800) };
    }).filter(Boolean);
    const dedup = [...new Map(rows.map(r => [r.post, r])).values()];
    return { url: location.href, title: document.title, y: window.scrollY, h: document.documentElement.scrollHeight, rows: dedup, body: clean(document.body.innerText || '').slice(0, 3000) };
  })()`);
}

async function scanWindow(send, label, start, end) {
  await setRange(send, start, end);
  const snapshots = [];
  let previous = '';
  let stable = 0;
  for (let i = 0; i < 80; i++) {
    const state = await collect(send);
    snapshots.push(state);
    const posts = [...new Set(snapshots.flatMap(s => s.rows.map(r => r.post)))];
    console.log(`${label}\tscroll=${i}\ty=${state.y}\th=${state.h}\tposts=${posts.join(',')}`);
    const sig = `${state.y}:${state.h}:${posts.join(',')}`;
    stable = sig === previous ? stable + 1 : 0;
    previous = sig;
    if (stable >= 8) break;
    await ev(send, `window.scrollBy(0, Math.max(1000, window.innerHeight * 1.35))`);
    await sleep(900);
  }
  const rows = [...new Map(snapshots.flatMap(s => s.rows).map(r => [r.post, r])).values()];
  fs.writeFileSync(path.join(outDir, `${label}_period.json`), JSON.stringify({ label, start, end, rows, snapshots: snapshots.map(s => ({ y: s.y, h: s.h, posts: s.rows.map(r => r.post) })) }, null, 2), 'utf8');
  return { label, start, end, rows };
}

(async () => {
  const { ws, send } = await connect(await getPageWs());
  const all = [];
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    for (const [label, start, end] of windows) {
      const result = await scanWindow(send, label, start, end);
      all.push(result);
      console.log('WINDOW_RESULT', label, result.rows.length);
      for (const r of result.rows) console.log(`${label}\t${r.post}\t${r.text.slice(0, 450)}`);
    }
  } finally {
    ws.close();
  }
  fs.writeFileSync(path.join(outDir, 'targeted_period_summary.json'), JSON.stringify(all, null, 2), 'utf8');
})().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
