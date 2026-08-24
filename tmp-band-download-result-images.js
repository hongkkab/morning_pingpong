const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep', 'result-images');
fs.mkdirSync(outDir, { recursive: true });

const posts = [
  '926087882',
  '926087933',
  '926087969',
  '926088102',
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

async function openPost(send, post) {
  await send('Page.navigate', { url: `https://www.band.us/band/9136101/post/${post}` });
  await sleep(4000);
  for (let i = 0; i < 5; i++) {
    await ev(send, `(() => {
      const re = /\\uB354\\uBCF4\\uAE30|\\uC804\\uCCB4\\uBCF4\\uAE30/;
      [...document.querySelectorAll('button, a')].filter(b => re.test(b.innerText || b.textContent || '')).slice(0, 10).forEach(b => b.click());
      window.scrollBy(0, Math.max(600, window.innerHeight * 0.8));
    })()`).catch(() => {});
    await sleep(650);
  }
  await ev(send, 'window.scrollTo(0, 0)').catch(() => {});
  await sleep(500);
}

async function imageData(send, post) {
  return ev(send, `(() => {
    const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
    const imgs = [...document.images].map((img, i) => {
      const r = img.getBoundingClientRect();
      let node = img;
      let ctx = '';
      for (let k = 0; k < 6 && node && node.parentElement; k++) {
        node = node.parentElement;
        const t = clean(node.innerText || node.textContent || '');
        if (t.length > ctx.length && t.length < 2000) ctx = t;
      }
      return {
        i,
        src: img.currentSrc || img.src || '',
        w: img.naturalWidth || img.width || 0,
        h: img.naturalHeight || img.height || 0,
        alt: img.alt || '',
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        ctx: ctx.slice(0, 240)
      };
    }).filter(x => x.src && x.w >= 120 && x.h >= 120);
    return { post: ${JSON.stringify(post)}, url: location.href, title: document.title, body: clean(document.body.innerText || '').slice(0, 3000), images: imgs };
  })()`);
}

async function download(url, target) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://band.us/' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
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
    for (const post of posts) {
      await openPost(send, post);
      const data = await imageData(send, post);
      const postDir = path.join(outDir, post);
      fs.mkdirSync(postDir, { recursive: true });
      fs.writeFileSync(path.join(postDir, 'post.json'), JSON.stringify(data, null, 2), 'utf8');
      fs.writeFileSync(path.join(postDir, 'post.txt'), data.body || '', 'utf8');
      const downloads = [];
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        const extMatch = img.src.match(/\\.(jpe?g|png|webp)(?:[?#]|$)/i);
        const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
        const filename = `${String(i + 1).padStart(2, '0')}_${img.w}x${img.h}.${ext}`;
        const target = path.join(postDir, filename);
        try {
          const size = await download(img.src, target);
          downloads.push({ ...img, file: target, size });
        } catch (e) {
          downloads.push({ ...img, error: e.message || String(e) });
        }
      }
      fs.writeFileSync(path.join(postDir, 'images.json'), JSON.stringify(downloads, null, 2), 'utf8');
      summary.push({ post, url: data.url, title: data.title, imageCount: data.images.length, downloads: downloads.length, files: downloads.filter(x => x.file).map(x => x.file) });
      console.log(`${post}\timages=${data.images.length}\turl=${data.url}\t${data.title}`);
    }
  } finally {
    ws.close();
  }
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
})().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
