const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep');
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

(async () => {
  const { ws, send } = await connect(await getPageWs());
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'https://www.band.us/band/9136101' });
    await sleep(3500);
    const data = await ev(send, `(() => {
      const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
      const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
      const inputs = [...document.querySelectorAll('input, textarea')].filter(visible).map((el, i) => ({
        i,
        tag: el.tagName,
        type: el.type || '',
        cls: el.className || '',
        name: el.name || '',
        placeholder: el.placeholder || '',
        value: el.value || '',
        aria: el.getAttribute('aria-label') || ''
      }));
      const buttons = [...document.querySelectorAll('button, a')].filter(visible).slice(0, 180).map((el, i) => ({
        i,
        tag: el.tagName,
        text: clean(el.innerText || el.textContent || ''),
        href: el.href || '',
        cls: el.className || '',
        aria: el.getAttribute('aria-label') || '',
        title: el.title || ''
      })).filter(x => x.text || x.href || x.aria || x.title);
      const body = clean(document.body.innerText || '').slice(0, 3000);
      return { url: location.href, title: document.title, inputs, buttons, body };
    })()`);
    fs.writeFileSync(path.join(outDir, 'ui-inspect.json'), JSON.stringify(data, null, 2), 'utf8');
    console.log(JSON.stringify(data, null, 2));
  } finally {
    ws.close();
  }
})().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
