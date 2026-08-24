const fs = require('fs');
const path = require('path');
const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep');
const postDir = path.join(outDir, 'posts');
fs.mkdirSync(postDir, {recursive:true});
const ids = [
  '926087887','926087888','926087889','926087890','926087891','926087892','926087893','926087894','926087895','926087896',
  '926087938','926087939','926087940','926087941','926087942','926087943','926087944','926087945','926087946','926087947',
  '926087957','926087958','926087959','926087960','926087961','926087962','926087963','926087964','926087965','926087966',
  '926088101','926088102','926088103','926088104','926088105','926088106','926088107','926088108','926088109','926088110','926088111','926088112','926088113'
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
async function scanPost(send, post){
  await send('Page.navigate',{url:`https://www.band.us/band/9136101/post/${post}`});
  await sleep(3000);
  for(let i=0;i<3;i++){
    await ev(send,`(() => {
      [...document.querySelectorAll('button')].filter(b=>/더보기/.test(b.innerText||b.textContent||'')).slice(0,8).forEach(b=>b.click());
      window.scrollBy(0, window.innerHeight*0.6);
    })()`).catch(()=>{});
    await sleep(700);
  }
  await ev(send,`window.scrollTo(0,0)`).catch(()=>{});
  await sleep(250);
  const data=await ev(send,`(() => {
    const clean=s=>(s||'').replace(/\\s+/g,' ').trim();
    const images=[...document.images].map(img=>({src:img.currentSrc||img.src||'', w:img.naturalWidth||img.width||0, h:img.naturalHeight||img.height||0, alt:img.alt||''}))
      .filter(x=>x.src&&x.w>=120&&x.h>=120);
    const h1=[...document.querySelectorAll('h1.gSrOnly')].map(h=>clean(h.innerText||h.textContent||''));
    return {post:${JSON.stringify(post)}, url:location.href, title:document.title, h1, text:document.body.innerText||'', images};
  })()`);
  fs.writeFileSync(path.join(postDir, `${post}.json`), JSON.stringify(data,null,2), 'utf8');
  fs.writeFileSync(path.join(postDir, `${post}.txt`), data.text||'', 'utf8');
  const t=(data.text||'').replace(/\s+/g,' ');
  const hit=/빨리\s*모이|빨리모이|최강전|2팀 단체전|2개조|토너먼트|오뚜기|풀리그/.test(t);
  console.log(post, hit?'HIT':'-', 'images', data.images.length, data.title);
  return {post, hit, title:data.title, h1:data.h1, imageCount:data.images.length, preview:t.slice(0,1200)};
}
(async()=>{
  const {ws,send}=await connect(await getPageWs());
  const summary=[];
  try{
    await send('Page.enable'); await send('Runtime.enable');
    for(let i=0;i<ids.length;i++){
      console.log('SCAN', i+1, '/', ids.length, ids[i]);
      try{ summary.push(await scanPost(send, ids[i])); }
      catch(e){ summary.push({post:ids[i], error:e.message||String(e)}); console.log(ids[i], 'ERR', e.message||String(e)); }
    }
  }finally{ws.close();}
  fs.writeFileSync(path.join(outDir,'bulk_post_summary.json'), JSON.stringify(summary,null,2), 'utf8');
})().catch(e=>{console.error(e.stack||e.message);process.exit(1);});
