const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep');
fs.mkdirSync(outDir, { recursive: true });

const keyword = '\uBE68\uB9AC\uBAA8\uC774';
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

async function doSearch(send) {
  await send('Page.navigate', { url: 'https://www.band.us/band/9136101/post' });
  await sleep(3500);
  const ok = await ev(send, `(() => {
    const input = document.querySelector('input._searchTxt');
    if (!input) return { ok: false, reason: 'no input' };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(keyword)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
    const btn = document.querySelector('button.search') || [...document.querySelectorAll('button')].find(b => /\\uAC80\\uC0C9/.test(b.innerText || b.textContent || ''));
    if (!btn) return { ok: false, reason: 'no button', value: input.value };
    btn.click();
    return { ok: true, value: input.value };
  })()`);
  if (!ok.ok) throw new Error(`search failed: ${JSON.stringify(ok)}`);
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
      for (let i = 0; i < 8 && node && node.parentElement; i++) {
        node = node.parentElement;
        const text = clean(node.innerText || node.textContent || '');
        if (text.length > best.length && text.length < 5000) best = text;
        if (/\\d{4}\\uB144/.test(text) && text.length > 120) break;
      }
      return { post: m[1], href, text: best.slice(0, 1500) };
    }).filter(Boolean);
    const dedup = [...new Map(rows.map(r => [r.post, r])).values()];
    return { url: location.href, title: document.title, y: window.scrollY, h: document.documentElement.scrollHeight, rows: dedup, body: clean(document.body.innerText || '').slice(0, 5000) };
  })()`);
}

(async () => {
  const { ws, send } = await connect(await getPageWs());
  const snapshots = [];
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await doSearch(send);
    let previous = '';
    let stable = 0;
    for (let i = 0; i < 80; i++) {
      const state = await collect(send);
      snapshots.push(state);
      const posts = [...new Set(snapshots.flatMap(s => s.rows.map(r => r.post)))];
      console.log(`scroll=${i}\ty=${state.y}\th=${state.h}\tposts=${posts.length}\t${posts.slice(0, 20).join(',')}`);
      const sig = `${state.y}:${state.h}:${posts.join(',')}`;
      stable = sig === previous ? stable + 1 : 0;
      previous = sig;
      if (stable >= 6) break;
      await ev(send, `window.scrollBy(0, Math.max(800, window.innerHeight * 1.25))`);
      await sleep(900);
    }
  } finally {
    ws.close();
  }
  const rows = [...new Map(snapshots.flatMap(s => s.rows).map(r => [r.post, r])).values()];
  const result = { keyword, count: rows.length, rows, snapshots: snapshots.map(s => ({ url: s.url, title: s.title, y: s.y, h: s.h, posts: s.rows.map(r => r.post) })) };
  fs.writeFileSync(path.join(outDir, 'keyword_search_quickmeet.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log('RESULT', rows.length);
  for (const r of rows) console.log(`${r.post}\t${r.text.slice(0, 500)}`);
})().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
