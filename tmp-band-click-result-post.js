const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep', 'clicked-result-posts');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { post: '926087882', start: '2026. 01. 29.', end: '2026. 02. 08.' },
  { post: '926087933', start: '2026. 02. 26.', end: '2026. 03. 09.' },
  { post: '926087969', start: '2026. 03. 17.', end: '2026. 03. 25.' },
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
    const inputs = [...document.querySelectorAll('input._input')].filter(visible).slice(0, 2);
    if (inputs.length < 2) return { ok: false, reason: 'no date inputs' };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inputs[0], ${JSON.stringify(start)});
    setter.call(inputs[1], ${JSON.stringify(end)});
    for (const input of inputs) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btn = document.querySelector('button._btnPeriodSearch');
    if (!btn) return { ok: false, reason: 'no period button', values: inputs.map(i => i.value) };
    btn.click();
    return { ok: true, values: inputs.map(i => i.value) };
  })()`);
  if (!ok.ok) throw new Error(`range failed: ${JSON.stringify(ok)}`);
  await sleep(4500);
}

async function clickPost(send, post) {
  const found = await ev(send, `(() => {
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const anchors = [...document.querySelectorAll('a[href*="/band/9136101/post/${post}"]')].filter(visible);
    const a = anchors.find(x => (x.innerText || x.textContent || '').trim()) || anchors[0];
    if (!a) return { ok: false, count: 0, url: location.href, body: document.body.innerText.slice(0, 1000) };
    a.scrollIntoView({ block: 'center' });
    a.click();
    return { ok: true, count: anchors.length, text: (a.innerText || a.textContent || '').trim(), href: a.href };
  })()`);
  if (!found.ok) throw new Error(`post link not found ${post}: ${JSON.stringify(found)}`);
  await sleep(4000);
  return found;
}

async function expand(send) {
  for (let i = 0; i < 6; i++) {
    await ev(send, `(() => {
      const re = /\\uB354\\uBCF4\\uAE30|\\uC804\\uCCB4\\uBCF4\\uAE30/;
      [...document.querySelectorAll('button, a')].filter(b => re.test(b.innerText || b.textContent || '')).slice(0, 12).forEach(b => b.click());
      window.scrollBy(0, Math.max(600, window.innerHeight * 0.8));
    })()`).catch(() => {});
    await sleep(600);
  }
  await ev(send, 'window.scrollTo(0, 0)').catch(() => {});
  await sleep(500);
}

async function grab(send, post) {
  return ev(send, `(() => {
    const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
    const images = [...document.images].map((img, i) => {
      const r = img.getBoundingClientRect();
      return { i, src: img.currentSrc || img.src || '', w: img.naturalWidth || img.width || 0, h: img.naturalHeight || img.height || 0, alt: img.alt || '', rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
    }).filter(x => x.src && x.w >= 120 && x.h >= 120);
    return { post: ${JSON.stringify(post)}, url: location.href, title: document.title, body: clean(document.body.innerText || '').slice(0, 5000), images };
  })()`);
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
  const summary = [];
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    for (const target of targets) {
      await setRange(send, target.start, target.end);
      const clicked = await clickPost(send, target.post);
      await expand(send);
      const data = await grab(send, target.post);
      const postDir = path.join(outDir, target.post);
      fs.mkdirSync(postDir, { recursive: true });
      fs.writeFileSync(path.join(postDir, 'post.json'), JSON.stringify({ clicked, ...data }, null, 2), 'utf8');
      fs.writeFileSync(path.join(postDir, 'post.txt'), data.body || '', 'utf8');
      const files = [];
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        const ext = (img.src.match(/\\.(jpe?g|png|webp)(?:[?#]|$)/i)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
        const file = path.join(postDir, `${String(i + 1).padStart(2, '0')}_${img.w}x${img.h}.${ext}`);
        try {
          const size = await download(img.src, file);
          files.push({ ...img, file, size });
        } catch (e) {
          files.push({ ...img, error: e.message || String(e) });
        }
      }
      fs.writeFileSync(path.join(postDir, 'images.json'), JSON.stringify(files, null, 2), 'utf8');
      summary.push({ post: target.post, url: data.url, title: data.title, imageCount: data.images.length, files: files.filter(x => x.file).map(x => x.file) });
      console.log(`${target.post}\timages=${data.images.length}\turl=${data.url}\t${data.title}`);
    }
  } finally {
    ws.close();
  }
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
})().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
