const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep', 'media-926087882');
fs.mkdirSync(outDir, { recursive: true });

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
async function download(url, target) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://www.band.us/' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(target, bytes);
  return bytes.length;
}
(async () => {
  const { ws, send } = await connect(await getPageWs());
  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.navigate', { url: 'https://www.band.us/band/9136101/board/period-search' });
    await sleep(3500);
    await ev(send, `(() => {
      const inputs = [...document.querySelectorAll('input._input')].filter(i => i.offsetParent !== null).slice(0, 2);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(inputs[0], '2026. 01. 29.'); setter.call(inputs[1], '2026. 02. 08.');
      inputs.forEach(i => { i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
      document.querySelector('button._btnPeriodSearch').click();
    })()`);
    await sleep(4500);
    const clicked = await ev(send, `(() => {
      const link = [...document.querySelectorAll('a[href*="/band/9136101/post/926087882"]')].find(a => a.offsetParent !== null);
      const card = link.closest('article.cContentsCard');
      card.scrollIntoView({ block: 'center' });
      const btn = card.querySelector('button.moreMedia, .moreMedia');
      if (!btn) return { ok: false, reason: 'no moreMedia' };
      btn.click();
      return { ok: true, text: btn.innerText || btn.textContent || '', cls: btn.className || '' };
    })()`);
    console.log('clicked', JSON.stringify(clicked));
    await sleep(3000);
    for (let i = 0; i < 10; i++) {
      await ev(send, `(() => { const right = [...document.querySelectorAll('button, a')].find(b => /\\uB2E4\\uC74C|next|Next|\\u203A|\\u232A/.test((b.innerText || b.textContent || '') + ' ' + (b.className || '') + ' ' + (b.getAttribute('aria-label') || ''))); if (right) right.click(); })()`).catch(() => {});
      await sleep(250);
    }
    const data = await ev(send, `(() => {
      const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
      const imgs = [...document.images].map((img, i) => ({ i, src: img.currentSrc || img.src || '', w: img.naturalWidth || img.width || 0, h: img.naturalHeight || img.height || 0, alt: img.alt || '' }))
        .filter(x => x.src && x.w >= 120 && x.h >= 120);
      const buttons = [...document.querySelectorAll('button, a')].map((b, i) => ({ i, text: clean(b.innerText || b.textContent || ''), cls: b.className || '', aria: b.getAttribute('aria-label') || '' })).filter(x => x.text || x.aria || x.cls).slice(-120);
      return { url: location.href, title: document.title, body: clean(document.body.innerText || '').slice(0, 2500), images: imgs, buttons };
    })()`);
    fs.writeFileSync(path.join(outDir, 'media.json'), JSON.stringify(data, null, 2), 'utf8');
    const files = [];
    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i];
      const ext = (img.src.match(/\\.(jpe?g|png|webp)(?:[?#]|$)/i)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
      const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}_${img.w}x${img.h}.${ext}`);
      try {
        const size = await download(img.src, file);
        files.push({ ...img, file, size });
      } catch (e) {
        files.push({ ...img, error: e.message || String(e) });
      }
    }
    fs.writeFileSync(path.join(outDir, 'images.json'), JSON.stringify(files, null, 2), 'utf8');
    console.log(`images=${files.length}`);
    files.filter(x => x.file).forEach(x => console.log(`${path.basename(x.file)} ${x.size}`));
  } finally { ws.close(); }
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
