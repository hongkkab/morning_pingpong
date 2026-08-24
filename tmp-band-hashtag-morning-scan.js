const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-morning-band-comments');
fs.mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getPageWs() {
  const pages = await fetch('http://127.0.0.1:9223/json/list').then(r => r.json());
  const page = pages.slice().reverse().find(p => p.type === 'page' && /band\.us/.test(p.url)) || pages.find(p => p.type === 'page');
  if (!page) throw new Error('No BAND page');
  return page.webSocketDebuggerUrl;
}
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
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
(async () => {
  const { ws, send } = await connect(await getPageWs());
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.navigate', { url: 'https://www.band.us/band/9136101/hashtag/%EB%AA%A8%EB%8B%9D%EC%A6%90%ED%83%81' });
    await sleep(4500);
    const snapshots = [];
    let prev = ''; let stable = 0;
    for (let i = 0; i < 30; i++) {
      const state = await ev(send, `(() => {
        const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
        const anchors = [...document.querySelectorAll('a[href*="/band/9136101/post/"]')];
        const rows = anchors.map(a => {
          const href = a.href.split('/comment/')[0];
          const m = href.match(/\\/post\\/(\\d+)/);
          if (!m) return null;
          let node = a;
          let best = clean(a.innerText || a.textContent || '');
          for (let i = 0; i < 10 && node && node.parentElement; i++) {
            node = node.parentElement;
            const text = clean(node.innerText || node.textContent || '');
            if (text.length > best.length && text.length < 9000) best = text;
            if (/\\d{4}\\uB144/.test(text) && text.length > 130) break;
          }
          return { post: m[1], href, text: best.slice(0, 3000) };
        }).filter(Boolean);
        return { y: window.scrollY, h: document.documentElement.scrollHeight, rows: [...new Map(rows.map(r => [r.post, r])).values()] };
      })()`);
      snapshots.push(state);
      const posts = [...new Set(snapshots.flatMap(s => s.rows.map(r => r.post)))];
      const sig = `${state.y}:${state.h}:${posts.join(',')}`;
      stable = sig === prev ? stable + 1 : 0;
      prev = sig;
      if (stable >= 5) break;
      await ev(send, `window.scrollBy(0, Math.max(1200, window.innerHeight * 1.4))`);
      await sleep(650);
    }
    const rows = [...new Map(snapshots.flatMap(s => s.rows).map(r => [r.post, r])).values()];
    fs.writeFileSync(path.join(outDir, 'hashtag_morning.json'), JSON.stringify(rows, null, 2), 'utf8');
    console.log('rows', rows.length);
    for (const r of rows.slice(0, 20)) console.log(`${r.post}\t${r.href}\t${r.text.slice(0, 800)}`);
  } finally { ws.close(); }
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
