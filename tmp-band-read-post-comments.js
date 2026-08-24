const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-morning-band-comments');
fs.mkdirSync(outDir, { recursive: true });

const post = process.argv[2] || '926088201';
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

async function expand(send) {
  for (let i = 0; i < 25; i++) {
    await ev(send, `(() => {
      const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
      const buttons = [...document.querySelectorAll('button, a')].filter(el => el.offsetParent !== null);
      const targets = buttons.filter(el => /더보기|댓글 더보기|이전 댓글|댓글을 더|답글|전체 댓글|펼치기/.test(clean(el.innerText || el.textContent || el.getAttribute('aria-label') || '')));
      for (const el of targets.slice(0, 20)) el.click();
      window.scrollBy(0, Math.max(900, window.innerHeight * 0.9));
      return { clicked: targets.length, y: window.scrollY, h: document.documentElement.scrollHeight };
    })()`).catch(() => {});
    await sleep(650);
  }
  await ev(send, `window.scrollTo(0, document.documentElement.scrollHeight)`);
  await sleep(1000);
}

async function collect(send) {
  return ev(send, `(() => {
    const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
    const comments = [...document.querySelectorAll('[class*="comment"], [class*="Comment"], li, article')].map((el, i) => {
      const text = clean(el.innerText || el.textContent || '');
      const cls = String(el.className || '');
      const rect = el.getBoundingClientRect();
      return { i, cls, text, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) };
    }).filter(x => x.text.length > 0 && x.text.length < 2500);
    const body = clean(document.body.innerText || '');
    return { url: location.href, title: document.title, body, comments };
  })()`);
}

(async () => {
  const { ws, send } = await connect(await getPageWs());
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: `https://band.us/band/9136101/post/${post}` });
    await sleep(5000);
    await expand(send);
    const data = await collect(send);
    fs.writeFileSync(path.join(outDir, `post_${post}_comments.json`), JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(path.join(outDir, `post_${post}_body.txt`), data.body, 'utf8');
    console.log('url', data.url);
    console.log('body length', data.body.length, 'commentish', data.comments.length);
    for (const c of data.comments.filter(c => /2026년 8월 1[45]일|어제|오늘|\\d+\\s*[:：]\\s*\\d+|승|패|게임|경기|부/.test(c.text)).slice(0, 80)) {
      console.log('---');
      console.log(c.text.slice(0, 1200));
    }
  } finally {
    ws.close();
  }
})().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
