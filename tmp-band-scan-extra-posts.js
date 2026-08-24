const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep');
const postDir = path.join(outDir, 'posts-extra');
fs.mkdirSync(postDir, { recursive: true });

const ranges = [
  [926087876, 926087886],
  [926087897, 926087937],
  [926088089, 926088102],
];
const ids = ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i)));

const terms = [
  /\uBE68\uB9AC\s*\uBAA8\uC774/u,
  /\uBE68\uB9AC\uBAA8\uC774/u,
  /\uCD5C\uAC15\uC804/u,
  /\uB2E8\uCCB4\uC804/u,
  /\uC624\uB69C\uAE30/u,
  /\uD480\uB9AC\uADF8/u,
  /\uACB0\uACFC/u,
  /\uD6C4\uAE30/u,
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

async function scanPost(send, post) {
  await send('Page.navigate', { url: `https://www.band.us/band/9136101/post/${post}` });
  await sleep(2800);
  for (let i = 0; i < 4; i++) {
    await ev(send, `(() => {
      const more = /\\uB354\\uBCF4\\uAE30|\\uC804\\uCCB4\\uBCF4\\uAE30/;
      [...document.querySelectorAll('button, a')].filter(b => more.test(b.innerText || b.textContent || '')).slice(0, 8).forEach(b => b.click());
      window.scrollBy(0, Math.max(500, window.innerHeight * 0.7));
    })()`).catch(() => {});
    await sleep(500);
  }
  const data = await ev(send, `(() => {
    const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
    const images = [...document.images]
      .map(img => ({ src: img.currentSrc || img.src || '', w: img.naturalWidth || img.width || 0, h: img.naturalHeight || img.height || 0, alt: img.alt || '' }))
      .filter(x => x.src && x.w >= 120 && x.h >= 120);
    const article = [...document.querySelectorAll('article, [class*="post"], [class*="Post"], [class*="content"], [class*="Content"]')]
      .map(n => clean(n.innerText || n.textContent || ''))
      .sort((a, b) => b.length - a.length)[0] || clean(document.body.innerText || '');
    return { post: ${JSON.stringify(post)}, url: location.href, title: document.title, text: document.body.innerText || '', article, images };
  })()`);
  fs.writeFileSync(path.join(postDir, `${post}.json`), JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(path.join(postDir, `${post}.txt`), data.text || '', 'utf8');
  const haystack = `${data.title}\n${data.article}\n${data.text}`;
  const hit = terms.some(re => re.test(haystack));
  const preview = (data.article || data.text || '').replace(/\s+/g, ' ').slice(0, 360);
  console.log(`${post}\t${hit ? 'HIT' : '-'}\timg=${data.images.length}\t${data.title}\t${preview}`);
  return { post, hit, title: data.title, imageCount: data.images.length, preview };
}

(async () => {
  const { ws, send } = await connect(await getPageWs());
  const summary = [];
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    for (let i = 0; i < ids.length; i++) {
      console.log(`SCAN ${i + 1}/${ids.length} ${ids[i]}`);
      try {
        summary.push(await scanPost(send, ids[i]));
      } catch (e) {
        console.log(`${ids[i]}\tERR\t${e.message || String(e)}`);
        summary.push({ post: ids[i], error: e.message || String(e) });
      }
    }
  } finally {
    ws.close();
  }
  fs.writeFileSync(path.join(outDir, 'extra_post_summary.json'), JSON.stringify(summary, null, 2), 'utf8');
})().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
