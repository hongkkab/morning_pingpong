const fs = require('fs');
const path = require('path');

const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-morning-band-comments');
fs.mkdirSync(outDir, { recursive: true });

const post = process.argv[2] || '926088201';
const startDate = process.argv[3] || '2026. 08. 13.';
const endDate = process.argv[4] || startDate;
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
    const inputs = [...document.querySelectorAll('input')].filter(visible).filter(i => /\\d{4}/.test(i.value || '') || /\\uB0A0\\uC9DC|date/i.test(i.placeholder || i.className || '')).slice(0, 2);
    if (inputs.length < 2) return { ok: false, reason: 'no date inputs' };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inputs[0], ${JSON.stringify(start)});
    setter.call(inputs[1], ${JSON.stringify(end)});
    for (const input of inputs) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const btn = document.querySelector('button._btnPeriodSearch') || [...document.querySelectorAll('button')].find(b => /\\uAC80\\uC0C9/.test(b.innerText || b.textContent || '') && /PeriodSearch|uButton/.test(b.className || ''));
    if (!btn) return { ok: false, reason: 'no search button' };
    btn.click();
    return { ok: true };
  })()`);
  if (!ok.ok) throw new Error(JSON.stringify(ok));
  await sleep(4500);
}

async function ensurePost(send) {
  for (let i = 0; i < 30; i++) {
    const found = await ev(send, `(() => {
      const link = [...document.querySelectorAll('a[href*="/band/9136101/post/${post}"]')].find(a => a.offsetParent !== null);
      if (!link) {
        window.scrollBy(0, Math.max(1000, window.innerHeight * 1.2));
        return false;
      }
      const card = link.closest('article.cContentsCard') || link.closest('article') || link.parentElement;
      card.scrollIntoView({ block: 'center' });
      return true;
    })()`);
    if (found) return true;
    await sleep(700);
  }
  return false;
}

async function expandCard(send) {
  for (let i = 0; i < 4; i++) {
    const result = await ev(send, `(() => {
      const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
      const link = [...document.querySelectorAll('a[href*="/band/9136101/post/${post}"]')].find(a => a.offsetParent !== null);
      if (!link) return { ok: false, reason: 'no link' };
      const card = link.closest('article.cContentsCard') || link.closest('article') || link.parentElement;
      card.scrollIntoView({ block: 'center' });
      const els = [...card.querySelectorAll('button, a')].filter(el => el.offsetParent !== null);
      const labels = els.map((el, idx) => ({ idx, text: clean(el.innerText || el.textContent || el.getAttribute('aria-label') || ''), cls: String(el.className || ''), href: el.href || '' }));
      const targets = els.filter(el => {
        const t = clean(el.innerText || el.textContent || el.getAttribute('aria-label') || '');
        const cls = String(el.className || '');
        if (/수정|쓰기|답글쓰기|표정/.test(t)) return false;
        return /_btnMore|_commentCountBtn|_commentToggleBtn/.test(cls) || /댓글\\d+|댓글접기|댓글펼치기|이전 댓글|댓글 더보기/.test(t);
      });
      for (const el of targets.slice(0, 20)) el.click();
      return { ok: true, clicked: targets.length, labels, text: clean(card.innerText || card.textContent || '').slice(0, 5000) };
    })()`);
    fs.writeFileSync(path.join(outDir, `post_${post}_card_expand_${i}.json`), JSON.stringify(result, null, 2), 'utf8');
    await sleep(900);
  }
}

async function collect(send) {
  return ev(send, `(() => {
    const clean = s => (s || '').replace(/\\s+/g, ' ').trim();
    const link = [...document.querySelectorAll('a[href*="/band/9136101/post/${post}"]')].find(a => a.offsetParent !== null);
    const card = link && (link.closest('article.cContentsCard') || link.closest('article') || link.parentElement);
    const text = card ? clean(card.innerText || card.textContent || '') : '';
    const labels = card ? [...card.querySelectorAll('button, a, [role="button"]')].filter(el => el.offsetParent !== null).map((el, idx) => ({
      idx,
      text: clean(el.innerText || el.textContent || el.getAttribute('aria-label') || ''),
      cls: String(el.className || ''),
      href: el.href || '',
    })) : [];
    const commentish = card ? [...card.querySelectorAll('[class*="comment"], [class*="Comment"], li, div')].map((el, idx) => {
      const t = clean(el.innerText || el.textContent || '');
      const cls = String(el.className || '');
      return { idx, cls, text: t };
    }).filter(x => x.text.length > 0 && x.text.length < 2500 && /댓글|2026년 8월|오전|오후|\\d+\\s*[:：]\\s*\\d+|승|패|부/.test(x.text)) : [];
    return { url: location.href, title: document.title, text, labels, commentish };
  })()`);
}

(async () => {
  const { ws, send } = await connect(await getPageWs());
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await setRange(send, startDate, endDate);
    const found = await ensurePost(send);
    if (!found) throw new Error('post not found in search results');
    await expandCard(send);
    const data = await collect(send);
    fs.writeFileSync(path.join(outDir, `post_${post}_card_comments.json`), JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(path.join(outDir, `post_${post}_card_text.txt`), data.text, 'utf8');
    console.log('card text length', data.text.length, 'labels', data.labels.length, 'commentish', data.commentish.length);
    console.log('TEXT');
    console.log(data.text.slice(0, 8000));
    console.log('LABELS');
    for (const l of data.labels.slice(0, 80)) console.log(`${l.idx}\t${l.text}\t${l.cls}\t${l.href}`);
    console.log('COMMENTISH');
    for (const c of data.commentish.slice(0, 120)) {
      console.log('---');
      console.log(c.text);
    }
  } finally {
    ws.close();
  }
})().catch(e => {
  console.error(e.stack || e.message);
  process.exit(1);
});
