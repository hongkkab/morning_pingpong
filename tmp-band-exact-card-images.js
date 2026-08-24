const fs = require('fs');
const path = require('path');

const baseDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep', 'exact-card-images');
fs.mkdirSync(baseDir, { recursive: true });

const targets = [
  { post: '926087840', start: '2026. 01. 08.', end: '2026. 01. 14.' },
  { post: '926087933', start: '2026. 02. 26.', end: '2026. 03. 09.' },
  { post: '926087969', start: '2026. 03. 17.', end: '2026. 03. 25.' },
  { post: '926088002', start: '2026. 04. 09.', end: '2026. 04. 15.' },
  { post: '926088077', start: '2026. 05. 21.', end: '2026. 05. 27.' },
  { post: '926088102', start: '2026. 05. 28.', end: '2026. 06. 10.' },
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
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => { const msg = JSON.parse(ev.data); if (!msg.id || !pending.has(msg.id)) return; const item = pending.get(msg.id); pending.delete(msg.id); msg.error ? item.reject(new Error(JSON.stringify(msg.error))) : item.resolve(msg.result); };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const callId = ++id; pending.set(callId, { resolve, reject }); ws.send(JSON.stringify({ id: callId, method, params })); });
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
    const inputs = [...document.querySelectorAll('input._input')].filter(i => i.offsetParent !== null).slice(0, 2);
    if (inputs.length < 2) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inputs[0], ${JSON.stringify(start)});
    setter.call(inputs[1], ${JSON.stringify(end)});
    inputs.forEach(i => { i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
    const btn = document.querySelector('button._btnPeriodSearch');
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  if (!ok) throw new Error('setRange failed');
  await sleep(4500);
}
async function expandText(send, post) {
  for (let i = 0; i < 4; i++) {
    await ev(send, `(() => {
      const link = [...document.querySelectorAll('a[href*="/band/9136101/post/${post}"]')].find(a => a.offsetParent !== null);
      if (!link) return false;
      const card = link.closest('article.cContentsCard') || link.closest('article');
      card.scrollIntoView({ block: 'center' });
      [...card.querySelectorAll('button._btnMore, button')].filter(b => /\\uB354\\uBCF4\\uAE30|\\.\\.\\./.test(b.innerText || b.textContent || '')).forEach(b => b.click());
      return true;
    })()`).catch(() => {});
    await sleep(550);
  }
}
async function ensurePostVisible(send, post) {
  for (let i = 0; i < 45; i++) {
    const found = await ev(send, `(() => {
      const link = [...document.querySelectorAll('a[href*="/band/9136101/post/${post}"]')].find(a => a.offsetParent !== null);
      if (!link) {
        window.scrollBy(0, Math.max(1000, window.innerHeight * 1.25));
        return false;
      }
      const card = link.closest('article.cContentsCard') || link.closest('article');
      if (card) card.scrollIntoView({ block: 'center' });
      return true;
    })()`);
    if (found) return true;
    await sleep(650);
  }
  return false;
}
async function grabCard(send, post) {
  return ev(send, `(() => {
    const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
    const link = [...document.querySelectorAll('a[href*="/band/9136101/post/${post}"]')].find(a => a.offsetParent !== null);
    if (!link) return { ok: false, reason: 'no link' };
    const card = link.closest('article.cContentsCard') || link.closest('article');
    const images = [...card.querySelectorAll('img')].map((img, i) => ({ i, src: img.currentSrc || img.src || '', w: img.naturalWidth || img.width || 0, h: img.naturalHeight || img.height || 0, alt: img.alt || '' })).filter(x => x.src && x.w >= 120 && x.h >= 120);
    const buttons = [...card.querySelectorAll('button, a')].map((b, i) => ({ i, text: clean(b.innerText || b.textContent || ''), cls: b.className || '', href: b.href || '' }));
    return { ok: true, text: clean(card.innerText || card.textContent || '').slice(0, 5000), images, buttons };
  })()`);
}
async function download(url, target) {
  const clean = url.replace(/\?.*$/, '');
  const candidates = [clean, url];
  let err = null;
  for (const u of candidates) {
    try {
      const res = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://www.band.us/' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(target, bytes);
      return { url: u, size: bytes.length };
    } catch (e) {
      err = e;
    }
  }
  throw err;
}
(async () => {
  const { ws, send } = await connect(await getPageWs());
  const summary = [];
  try {
    await send('Page.enable'); await send('Runtime.enable');
    for (const target of targets) {
      await setRange(send, target.start, target.end);
      await ensurePostVisible(send, target.post);
      await expandText(send, target.post);
      const data = await grabCard(send, target.post);
      const dir = path.join(baseDir, target.post);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'card.json'), JSON.stringify(data, null, 2), 'utf8');
      fs.writeFileSync(path.join(dir, 'card.txt'), data.text || '', 'utf8');
      const files = [];
      for (let i = 0; i < (data.images || []).length; i++) {
        const img = data.images[i];
        const ext = (img.src.match(/\\.(jpe?g|png|webp)(?:[?#]|$)/i)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
        const file = path.join(dir, `${String(i + 1).padStart(2, '0')}_${img.w}x${img.h}.${ext}`);
        try {
          const info = await download(img.src, file);
          files.push({ ...img, file, downloadUrl: info.url, size: info.size });
        } catch (e) {
          files.push({ ...img, error: e.message || String(e) });
        }
      }
      fs.writeFileSync(path.join(dir, 'images.json'), JSON.stringify(files, null, 2), 'utf8');
      summary.push({ post: target.post, ok: data.ok, images: files.length, text: (data.text || '').slice(0, 250), files: files.filter(x => x.file).map(x => x.file) });
      console.log(`${target.post}\tok=${data.ok}\timages=${files.length}\t${(data.text || '').slice(0, 200)}`);
    }
  } finally { ws.close(); }
  fs.writeFileSync(path.join(baseDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
