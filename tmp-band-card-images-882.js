const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep', 'card-images-926087882');
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

async function setRange(send) {
  await send('Page.navigate', { url: 'https://www.band.us/band/9136101/board/period-search' });
  await sleep(3500);
  const ok = await ev(send, `(() => {
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const inputs = [...document.querySelectorAll('input._input')].filter(visible).slice(0, 2);
    if (inputs.length < 2) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inputs[0], '2026. 01. 29.');
    setter.call(inputs[1], '2026. 02. 08.');
    for (const input of inputs) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.querySelector('button._btnPeriodSearch').click();
    return true;
  })()`);
  if (!ok) throw new Error('range failed');
  await sleep(4500);
}

async function expandCard(send) {
  for (let pass = 0; pass < 4; pass++) {
    const ok = await ev(send, `(() => {
      const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
      const link = [...document.querySelectorAll('a[href*="/band/9136101/post/926087882"]')].find(a => a.offsetParent !== null);
      if (!link) return { ok: false, reason: 'no link' };
      const card = link.closest('article.cContentsCard') || link.closest('article') || link.closest('.cCard') || link.parentElement;
      card.scrollIntoView({ block: 'center' });
      const re = /\\uB354\\uBCF4\\uAE30|\\uC804\\uCCB4\\uBCF4\\uAE30/;
      [...card.querySelectorAll('button, a')].filter(b => re.test(b.innerText || b.textContent || '')).forEach(b => b.click());
      return { ok: true, text: clean(card.innerText || card.textContent || '').slice(0, 600), imgs: card.querySelectorAll('img').length };
    })()`);
    await sleep(800);
    if (pass === 3) console.log(JSON.stringify(ok));
  }
}

async function grab(send) {
  return ev(send, `(() => {
    const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
    const link = [...document.querySelectorAll('a[href*="/band/9136101/post/926087882"]')].find(a => a.offsetParent !== null);
    const card = link.closest('article.cContentsCard') || link.closest('article') || link.closest('.cCard') || link.parentElement;
    const images = [...card.querySelectorAll('img')].map((img, i) => ({ i, src: img.currentSrc || img.src || '', w: img.naturalWidth || img.width || 0, h: img.naturalHeight || img.height || 0, alt: img.alt || '' }))
      .filter(x => x.src && x.w >= 100 && x.h >= 100);
    return { url: location.href, title: document.title, text: clean(card.innerText || card.textContent || '').slice(0, 2500), images };
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
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await setRange(send);
    await expandCard(send);
    const data = await grab(send);
    fs.writeFileSync(path.join(outDir, 'card.json'), JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(path.join(outDir, 'card.txt'), data.text || '', 'utf8');
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
    console.log(`images=${data.images.length}`);
    files.filter(x => x.file).forEach(x => console.log(`${path.basename(x.file)} ${x.size}`));
  } finally {
    ws.close();
  }
})().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
