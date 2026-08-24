const fs = require('fs');
const path = require('path');

const baseDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep', 'viewer-media');
fs.mkdirSync(baseDir, { recursive: true });

const targets = [
  { post: '926087840', start: '2026. 01. 08.', end: '2026. 01. 14.' },
  { post: '926087882', start: '2026. 01. 29.', end: '2026. 02. 08.' },
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
async function openViewer(send, post) {
  const opened = await ev(send, `(() => {
    const link = [...document.querySelectorAll('a[href*="/band/9136101/post/${post}"]')].find(a => a.offsetParent !== null);
    if (!link) return { ok: false, reason: 'no link' };
    const card = link.closest('article.cContentsCard') || link.closest('article');
    card.scrollIntoView({ block: 'center' });
    const mediaButton = card.querySelector('button.moreMedia, .moreMedia') || [...card.querySelectorAll('button.collageImage, .collageImage')][0];
    if (!mediaButton) return { ok: false, reason: 'no media button', text: card.innerText.slice(0, 500) };
    mediaButton.click();
    return { ok: true, cls: mediaButton.className || '', text: mediaButton.innerText || mediaButton.textContent || '' };
  })()`);
  if (!opened.ok) throw new Error(`openViewer ${post}: ${JSON.stringify(opened)}`);
  await sleep(1800);
}
async function visibleViewerImage(send) {
  return ev(send, `(() => {
    const sec = document.querySelector('section.lyPhotoViewer') || document.querySelector('[class*="PhotoViewer"]');
    const wrap = sec && (sec.querySelector('.mediaWrap') || sec.querySelector('.photoContent') || sec);
    if (!wrap) return { url: location.href, title: document.title, imgs: [], buttons: [] };
    const urls = [];
    const addUrl = value => {
      const s = String(value || '');
      const re = /https?:\\/\\/[^"')\\s]+/g;
      let m;
      while ((m = re.exec(s))) urls.push(m[0]);
    };
    [...wrap.querySelectorAll('*')].forEach(el => {
      addUrl(el.src);
      addUrl(el.href);
      addUrl(getComputedStyle(el).backgroundImage);
      for (const a of el.attributes || []) addUrl(a.value);
    });
    const page = {
      current: (sec.querySelector('.thisNum') && sec.querySelector('.thisNum').textContent || '').trim(),
      total: (sec.querySelector('.totalNum') && sec.querySelector('.totalNum').textContent || '').trim()
    };
    const imgs = [...new Set(urls)]
      .filter(u => /coresos-phinf|phinf|pstatic/.test(u) && !/type=s75/.test(u))
      .map((src, i) => ({ i, src, w: 0, h: 0, rect: { x: 0, y: 0, w: 0, h: 0 }, page }));
    const buttons = [...sec.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => ({ text: (b.innerText || b.textContent || '').trim(), cls: b.className || '', aria: b.getAttribute('aria-label') || '' })).slice(-80);
    return { url: location.href, title: document.title, imgs, buttons };
  })()`);
}
async function clickNext(send) {
  await ev(send, `(() => {
    const btn = document.querySelector('button.btnNext') || [...document.querySelectorAll('button, a')].find(b => /\\uB2E4\\uC74C\\s*\\uC0AC\\uC9C4|\\uB2E4\\uC74C|next/i.test((b.innerText || b.textContent || '') + ' ' + (b.className || '') + ' ' + (b.getAttribute('aria-label') || '')));
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(550);
}
async function download(url, target) {
  const clean = url.replace(/\?.*$/, '');
  const candidates = [clean, url];
  let lastError = null;
  for (const u of candidates) {
    try {
      const res = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://www.band.us/' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(target, bytes);
      return { url: u, size: bytes.length };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
(async () => {
  const { ws, send } = await connect(await getPageWs());
  const summary = [];
  try {
    await send('Page.enable'); await send('Runtime.enable');
    for (const target of targets) {
      await setRange(send, target.start, target.end);
      await openViewer(send, target.post);
      const seen = new Map();
      for (let i = 0; i < 35; i++) {
        const state = await visibleViewerImage(send);
        for (const img of state.imgs) {
          if (!seen.has(img.src)) {
            seen.set(img.src, { ...img, step: i });
            const page = img.page ? `${img.page.current}/${img.page.total}` : '';
            console.log(`${target.post}\tstep=${i}\tpage=${page}\t${img.src.slice(0, 110)}`);
          }
        }
        await clickNext(send);
      }
      const postDir = path.join(baseDir, target.post);
      fs.mkdirSync(postDir, { recursive: true });
      const rows = [...seen.values()];
      const files = [];
      for (let i = 0; i < rows.length; i++) {
        const img = rows[i];
        const ext = (img.src.match(/\\.(jpe?g|png|webp)(?:[?#]|$)/i)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
        const file = path.join(postDir, `${String(i + 1).padStart(2, '0')}_${img.w}x${img.h}.${ext}`);
        try {
          const info = await download(img.src, file);
          files.push({ ...img, file, downloadUrl: info.url, size: info.size });
        } catch (e) {
          files.push({ ...img, error: e.message || String(e) });
        }
      }
      fs.writeFileSync(path.join(postDir, 'images.json'), JSON.stringify(files, null, 2), 'utf8');
      summary.push({ post: target.post, count: rows.length, files: files.filter(x => x.file).map(x => x.file) });
    }
  } finally {
    ws.close();
  }
  fs.writeFileSync(path.join(baseDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
