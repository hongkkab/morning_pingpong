const fs = require('fs');
const path = require('path');
const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep');
fs.mkdirSync(outDir, {recursive: true});
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPageWs(){
  const pages = await fetch('http://127.0.0.1:9223/json/list').then(r=>r.json());
  const page = pages.find(p=>p.type==='page' && /band\.us/.test(p.url)) || pages.find(p=>p.type==='page');
  if(!page) throw new Error('No BAND page');
  return page.webSocketDebuggerUrl;
}
async function connect(wsUrl){
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve,reject)=>{ ws.onopen=resolve; ws.onerror=reject; });
  let id=0; const pending=new Map();
  ws.onmessage = ev => {
    const msg=JSON.parse(ev.data);
    if(!msg.id || !pending.has(msg.id)) return;
    const p=pending.get(msg.id); pending.delete(msg.id);
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const callId=++id; pending.set(callId,{resolve,reject});
    ws.send(JSON.stringify({id:callId,method,params}));
  });
  return {ws,send};
}
async function ev(send, expression){
  const res = await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result.value;
}
(async()=>{
  const {ws,send}=await connect(await getPageWs());
  try{
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.navigate',{url:'https://www.band.us/band/9136101/board/period-search'});
    await sleep(3500);
    const data = await ev(send, `(() => {
      const clean=s=>(s||'').replace(/\\s+/g,' ').trim();
      const els=[...document.querySelectorAll('body, body *')].map((el,i)=>{
        const st=getComputedStyle(el), r=el.getBoundingClientRect();
        const overY=st.overflowY;
        return {
          i, tag:el.tagName, id:el.id||'', cls:String(el.className||'').slice(0,120),
          text:clean(el.innerText||el.textContent||'').slice(0,90),
          top:Math.round(r.top), left:Math.round(r.left), w:Math.round(r.width), h:Math.round(r.height),
          scrollTop:el.scrollTop, scrollHeight:el.scrollHeight, clientHeight:el.clientHeight,
          overY
        };
      }).filter(x=>x.scrollHeight>x.clientHeight+20 || ['auto','scroll'].includes(x.overY))
        .sort((a,b)=>(b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight)).slice(0,80);
      return {url:location.href, title:document.title, bodyH:document.body.scrollHeight, docH:document.documentElement.scrollHeight, y:window.scrollY, els};
    })()`);
    fs.writeFileSync(path.join(outDir,'scroll_inspect.json'), JSON.stringify(data,null,2), 'utf8');
    console.log(JSON.stringify(data,null,2));
  }finally{ ws.close(); }
})().catch(e=>{ console.error(e.stack||e.message); process.exit(1); });
