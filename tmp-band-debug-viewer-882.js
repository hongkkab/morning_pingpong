const fs = require('fs');
const path = require('path');
const outDir = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '.', 'Temp', 'codex-quickmeet-band-deep');
fs.mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getPageWs(){const pages=await fetch('http://127.0.0.1:9223/json/list').then(r=>r.json());const page=pages.find(p=>p.type==='page'&&/band\.us/.test(p.url))||pages.find(p=>p.type==='page');if(!page)throw new Error('No BAND page');return page.webSocketDebuggerUrl;}
async function connect(wsUrl){const ws=new WebSocket(wsUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});let id=0;const pending=new Map();ws.onmessage=ev=>{const msg=JSON.parse(ev.data);if(!msg.id||!pending.has(msg.id))return;const item=pending.get(msg.id);pending.delete(msg.id);msg.error?item.reject(new Error(JSON.stringify(msg.error))):item.resolve(msg.result);};const send=(method,params={})=>new Promise((resolve,reject)=>{const callId=++id;pending.set(callId,{resolve,reject});ws.send(JSON.stringify({id:callId,method,params}));});return{ws,send};}
async function ev(send,expression){const res=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(res.exceptionDetails)throw new Error(JSON.stringify(res.exceptionDetails));return res.result.value;}
(async()=>{
  const {ws,send}=await connect(await getPageWs());
  try{
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.navigate',{url:'https://www.band.us/band/9136101/board/period-search'});
    await sleep(3500);
    await ev(send,`(() => {const inputs=[...document.querySelectorAll('input._input')].filter(i=>i.offsetParent!==null).slice(0,2);const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(inputs[0],'2026. 01. 29.');setter.call(inputs[1],'2026. 02. 08.');inputs.forEach(i=>{i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));});document.querySelector('button._btnPeriodSearch').click();})()`);
    await sleep(4500);
    await ev(send,`(() => {const link=[...document.querySelectorAll('a[href*="/band/9136101/post/926087882"]')].find(a=>a.offsetParent!==null);const card=link.closest('article.cContentsCard');card.scrollIntoView({block:'center'});(card.querySelector('button.moreMedia, .moreMedia')||card.querySelector('button.collageImage, .collageImage')).click();})()`);
    await sleep(1800);
    const data=await ev(send,`(() => {
      const clean=s=>(s||'').replace(/\\s+/g,' ').trim();
      const visible=el=>{const st=getComputedStyle(el);const r=el.getBoundingClientRect();return st.visibility!=='hidden'&&st.display!=='none'&&r.width>20&&r.height>20&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;};
      const imgs=[...document.images].filter(visible).map((img,i)=>{const r=img.getBoundingClientRect();let chain=[],node=img;for(let k=0;k<8&&node;k++,node=node.parentElement){const st=getComputedStyle(node);chain.push({tag:node.tagName,cls:node.className||'',z:st.zIndex,pos:st.position,op:st.opacity});}return {i,src:img.currentSrc||img.src||'',w:img.naturalWidth||img.width||0,h:img.naturalHeight||img.height||0,rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},cls:img.className||'',chain};});
      const buttons=[...document.querySelectorAll('button,a')].filter(visible).map((b,i)=>{const r=b.getBoundingClientRect();return {i,text:clean(b.innerText||b.textContent||''),cls:b.className||'',aria:b.getAttribute('aria-label')||'',rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};}).filter(x=>x.text||x.aria||x.cls);
      return {url:location.href,title:document.title,imgs,buttons:buttons.slice(-120)};
    })()`);
    fs.writeFileSync(path.join(outDir,'debug-viewer-882.json'),JSON.stringify(data,null,2),'utf8');
    console.log(JSON.stringify(data,null,2));
  } finally { ws.close(); }
})().catch(e=>{console.error(e.stack||e.message);process.exit(1);});
