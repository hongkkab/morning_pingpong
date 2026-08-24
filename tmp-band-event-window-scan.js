const fs = require('fs');
const path = require('path');
const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep');
fs.mkdirSync(outDir, {recursive:true});

const windows = [
  ['event_2026_0203', '2026. 02. 03.', '2026. 02. 12.'],
  ['event_2026_0303', '2026. 03. 03.', '2026. 03. 12.'],
  ['event_2026_0602', '2026. 06. 02.', '2026. 06. 12.'],
  ['feb_full_early', '2026. 02. 01.', '2026. 02. 18.'],
  ['mar_full_early', '2026. 03. 01.', '2026. 03. 20.'],
  ['jun_full_early', '2026. 06. 01.', '2026. 06. 15.'],
];

const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function getPageWs(){
  const pages=await fetch('http://127.0.0.1:9223/json/list').then(r=>r.json());
  const page=pages.find(p=>p.type==='page'&&/band\.us/.test(p.url))||pages.find(p=>p.type==='page');
  if(!page) throw new Error('No BAND page');
  return page.webSocketDebuggerUrl;
}
async function connect(wsUrl){
  const ws=new WebSocket(wsUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let id=0; const pending=new Map();
  ws.onmessage=ev=>{
    const msg=JSON.parse(ev.data);
    if(!msg.id||!pending.has(msg.id)) return;
    const p=pending.get(msg.id); pending.delete(msg.id);
    msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const callId=++id; pending.set(callId,{resolve,reject});
    ws.send(JSON.stringify({id:callId,method,params}));
  });
  return {ws,send};
}
async function ev(send, expression){
  const res=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result.value;
}
async function setRange(send,start,end){
  await send('Page.navigate',{url:'https://www.band.us/band/9136101/board/period-search'});
  await sleep(3500);
  const ok=await ev(send,`(() => {
    const inputs=[...document.querySelectorAll('input[placeholder="날짜 설정"], input._input')].filter(i=>i.offsetParent!==null).slice(0,2);
    if(inputs.length<2) return {ok:false, inputs:inputs.map(i=>i.value)};
    const set=(input,value)=>{
      const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
      d.set.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
    };
    set(inputs[0], ${JSON.stringify(start)});
    set(inputs[1], ${JSON.stringify(end)});
    const btn=[...document.querySelectorAll('button')].find(b=>/검색/.test(b.innerText||b.textContent||'') && /btnPeriodSearch|active|uButton/.test(b.className||''));
    if(!btn) return {ok:false, values:inputs.map(i=>i.value), reason:'no button'};
    btn.click();
    return {ok:true, values:inputs.map(i=>i.value)};
  })()`);
  if(!ok.ok) throw new Error(`range failed ${start}-${end}: ${JSON.stringify(ok)}`);
  await sleep(4200);
}
async function collect(send){
  return ev(send,`(() => {
    const clean=s=>(s||'').replace(/\\s+/g,' ').trim();
    const anchors=[...document.querySelectorAll('a[href*="/band/9136101/post/"]')];
    const cards=anchors.map(a=>{
      const href=a.href.split('/comment/')[0];
      const m=href.match(/\\/post\\/(\\d+)/);
      if(!m) return null;
      let node=a, best=clean(a.innerText||a.textContent||''), h1='';
      for(let i=0;i<10 && node && node.parentElement;i++){
        node=node.parentElement;
        const text=clean(node.innerText||node.textContent||'');
        if(text.length>best.length) best=text;
        const hh=node.querySelector&&node.querySelector('h1.gSrOnly');
        if(hh) h1=clean(hh.innerText||hh.textContent||'');
        if(text.length>250 && /읽음|글 옵션|표정짓기|댓글쓰기/.test(text)) break;
      }
      return {post:m[1], href, h1, text:best.slice(0,2500)};
    }).filter(Boolean);
    const posts=[...new Map(cards.map(c=>[c.post,c])).values()];
    const h1s=[...document.querySelectorAll('h1.gSrOnly')].map(h=>clean(h.innerText||h.textContent||''));
    return {url:location.href,title:document.title,y:window.scrollY,h:document.documentElement.scrollHeight,text:document.body.innerText,posts,h1s};
  })()`);
}
async function scanWindow(send,label,start,end){
  await setRange(send,start,end);
  let prev='', stable=0, state=await collect(send);
  for(let i=0;i<32;i++){
    await ev(send,`window.scrollBy(0, Math.max(900, window.innerHeight*1.2))`);
    await sleep(900);
    state=await collect(send);
    const sig=`${state.y}:${state.h}:${state.posts.map(p=>p.post).join(',')}`;
    stable = sig===prev ? stable+1 : 0;
    prev=sig;
    if(i%5===0) console.log(label,'scroll',i,'y',state.y,'h',state.h,'posts',state.posts.length);
    if(stable>=5) break;
  }
  fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify({label,start,end,...state},null,2), 'utf8');
  fs.writeFileSync(path.join(outDir, `${label}.txt`), state.text||'', 'utf8');
  console.log('DONE', label, state.posts.map(p=>p.post).join(','));
  return {label,start,end,posts:state.posts.map(p=>({post:p.post,href:p.href,h1:p.h1,preview:p.text.slice(0,700)})), h1s:state.h1s};
}
(async()=>{
  const {ws,send}=await connect(await getPageWs());
  const summary=[];
  try{
    await send('Page.enable'); await send('Runtime.enable');
    for(const [label,start,end] of windows) summary.push(await scanWindow(send,label,start,end));
  }finally{ws.close();}
  fs.writeFileSync(path.join(outDir,'event_window_summary.json'), JSON.stringify(summary,null,2), 'utf8');
})().catch(e=>{console.error(e.stack||e.message);process.exit(1);});
