from pathlib import Path
from datetime import datetime
import shutil, re

root = Path('C:/Users/hek72/Downloads/모닝')
path = root / 'table-tennis-elo.html'
s = path.read_text(encoding='utf-8')
backup = root / f"backup-{datetime.now().strftime('%Y-%m-%d-%H%M%S')}-before-private-reviews.html"
shutil.copy2(path, backup)

def sub_once(pattern, repl, text, flags=0):
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit('missing regex target: '+pattern[:180])
    return out

def rep_once(text, old, new):
    if old not in text:
        raise SystemExit('missing target: '+old[:180])
    return text.replace(old, new, 1)

s = sub_once(
    r"const app = A\.initializeApp\(c\);\n    try\{ await U\.signInAnonymously\(U\.getAuth\(app\)\); \}catch\(e\)\{ /\*.*?\*/ \}\n    const db = D\.getDatabase\(app\), storage = G \? G\.getStorage\(app\) : null, base = 'clubs/'\+CLUB;\n    return \{\n      storage,\n      storageApi:G,",
    """const app = A.initializeApp(c);
    const auth = U.getAuth(app);
    try{
      await new Promise(resolve=>{
        let done=false, unsub=null;
        const finish=()=>{ if(done) return; done=true; try{ if(unsub) unsub(); }catch(e){} resolve(); };
        try{ unsub=U.onAuthStateChanged(auth, finish); }catch(e){ finish(); }
        setTimeout(finish, 1200);
      });
      if(!auth.currentUser) await U.signInAnonymously(auth);
    }catch(e){ /* 익명 로그인 미사용이면 그대로 진행 */ }
    const db = D.getDatabase(app), storage = G ? G.getStorage(app) : null, base = 'clubs/'+CLUB;
    const privateBase = ()=>{
      const u = auth.currentUser && auth.currentUser.uid;
      if(!u) throw new Error('private auth unavailable');
      return base+'/privateReviews/'+u;
    };
    return {
      auth,
      authApi:U,
      storage,
      storageApi:G,
      uid(){ return auth.currentUser && auth.currentUser.uid; },
      email(){ return auth.currentUser && auth.currentUser.email; },""",
    s
)

s = rep_once(s,
"""      async del(pth){ await D.remove(D.ref(db, base+'/'+pth)); return true; },
      async keys(pth){ const snap = await D.get(D.ref(db, base+'/'+pth)); return snap.exists()? Object.keys(snap.val()) : []; },""",
"""      async del(pth){ await D.remove(D.ref(db, base+'/'+pth)); return true; },
      async pget(pth){ const snap = await D.get(D.ref(db, privateBase()+'/'+pth)); return snap.exists()? snap.val() : null; },
      async pset(pth,v){ await D.set(D.ref(db, privateBase()+'/'+pth), clean(v)); return true; },
      async pdel(pth){ await D.remove(D.ref(db, privateBase()+'/'+pth)); return true; },
      async keys(pth){ const snap = await D.get(D.ref(db, base+'/'+pth)); return snap.exists()? Object.keys(snap.val()) : []; },""")

s = rep_once(s,
"""            G:{}, W:{}, L:{}, HH:{}, period:null, showFrozenRank:false,
            cardPhotos:{}, cardPhotoLoading:{},
            ready:false, busy:false, connecting:true };""",
"""            G:{}, W:{}, L:{}, HH:{}, period:null, showFrozenRank:false,
            cardPhotos:{}, cardPhotoLoading:{},
            privateReviews:{}, privateReviewState:'idle', privateReviewMsg:'',
            ready:false, busy:false, connecting:true };""")

helpers = r'''
function privateEmailFor(pid){ return `${safeFbKey(pid).toLowerCase()}@morning-pingpong.local`; }
function privatePassword(pin){ return `ttlog-${pin}`; }
function privateAuthReady(pid){ return !!(FB && FB.email && FB.email()===privateEmailFor(pid)); }
function privateAuthText(){
  if(!FB) return 'Firebase 연결이 필요합니다.';
  if(!S.me) return '로그인이 필요합니다.';
  if(privateAuthReady(S.me.id)) return '';
  return S.privateReviewMsg || '비공개 복기를 보려면 PIN으로 다시 로그인해야 합니다.';
}
function authErrText(e){
  const code=String(e&&e.code||'');
  if(code.includes('operation-not-allowed')) return 'Firebase Auth에서 이메일/비밀번호 로그인을 켜야 합니다.';
  if(code.includes('wrong-password') || code.includes('invalid-credential')) return '비공개 복기 계정 PIN이 맞지 않습니다. PIN 변경 후에는 같은 PIN으로 다시 로그인해야 합니다.';
  if(code.includes('email-already-in-use')) return '이미 만들어진 비공개 복기 계정입니다. 현재 PIN으로 로그인할 수 없습니다.';
  return e && (e.message||String(e)) || '비공개 인증에 실패했습니다.';
}
async function activatePrivateAuth(pid, pin){
  S.privateReviewMsg='';
  if(!FB || !FB.auth || !FB.authApi){ S.privateReviewState='locked'; S.privateReviewMsg='Firebase 연결이 필요합니다.'; return false; }
  if(!/^\d{4}$/.test(String(pin||''))){ S.privateReviewState='locked'; S.privateReviewMsg='PIN 4자리로 다시 로그인해야 합니다.'; return false; }
  const email=privateEmailFor(pid), pass=privatePassword(pin);
  try{
    if(FB.email && FB.email()===email){ S.privateReviewState='ready'; return true; }
    await FB.authApi.signInWithEmailAndPassword(FB.auth, email, pass);
    S.privateReviewState='ready'; return true;
  }catch(e){
    const code=String(e&&e.code||'');
    if(code.includes('user-not-found') || code.includes('invalid-credential')){
      try{
        await FB.authApi.createUserWithEmailAndPassword(FB.auth, email, pass);
        S.privateReviewState='ready'; return true;
      }catch(e2){ S.privateReviewState='locked'; S.privateReviewMsg=authErrText(e2); return false; }
    }
    S.privateReviewState='locked'; S.privateReviewMsg=authErrText(e); return false;
  }
}
async function resetPrivateAuth(){
  if(!FB || !FB.auth || !FB.authApi) return;
  try{ await FB.authApi.signOut(FB.auth); }catch(e){}
  try{ await FB.authApi.signInAnonymously(FB.auth); }catch(e){}
  S.privateReviews={}; S.privateReviewState='idle'; S.privateReviewMsg='';
}
async function loadPrivateReviews(){
  if(!S.me){ S.privateReviews={}; return false; }
  if(!privateAuthReady(S.me.id)){ S.privateReviews={}; S.privateReviewState='locked'; return false; }
  S.privateReviewState='loading';
  try{
    const v=await FB.pget('reviews');
    S.privateReviews = v && typeof v==='object' ? v : {};
    S.privateReviewState='ready'; S.privateReviewMsg=''; return true;
  }catch(e){ S.privateReviews={}; S.privateReviewState='locked'; S.privateReviewMsg=authErrText(e); return false; }
}
function reviewOf(mid){ return (S.privateReviews||{})[safeFbKey(mid)] || null; }
function reviewMatchLabel(m){
  if(!m) return '';
  const me=S.me&&S.me.id, opp=m.aId===me?m.bId:m.aId;
  const won=winnerOf(m)===me;
  return `${dateLabel(m.date)} · ${esc(nameOf(opp))}전 · ${won?'승':'패'}`;
}
function reviewListHTML(pid){
  const mine=(S._sorted||[]).filter(m=>!m.void && (m.aId===pid||m.bId===pid)).slice().reverse();
  const rows=mine.map(m=>{
    const r=reviewOf(m.id), opp=m.aId===pid?m.bId:m.aId;
    return `<button class="dayrow" data-review="${m.id}"><span class="dl">${dateLabel(m.date)} · ${esc(nameOf(opp))}</span>
      <span class="dn">${winnerOf(m)===pid?'승':'패'}${r?' <span class="mine">복기</span>':''}</span><span class="dg">›</span></button>`;
  }).join('');
  return `<div class="card"><div class="secttl" style="margin:0 0 8px">비공개 복기</div>
    <p class="tiny dim" style="margin:0 0 10px">복기는 Firebase의 개인 저장소에 따로 저장됩니다. 보안 규칙 적용 후에는 작성자 계정만 읽고 쓸 수 있습니다.</p>
    ${privateAuthReady(pid)?(rows||'<div class="empty">아직 내 경기 기록이 없습니다.</div>'):`<div class="empty">${esc(privateAuthText())}<br>로그아웃 후 PIN으로 다시 로그인하면 연결을 다시 시도합니다.</div>`}
  </div>`;
}
async function saveReviewFor(mid, data){
  if(!S.me) return false;
  if(!privateAuthReady(S.me.id)) return false;
  const key=safeFbKey(mid), now=new Date().toISOString();
  const prev=reviewOf(mid)||{};
  const rec={...prev, ...data, matchId:mid, ownerPlayerId:S.me.id, updatedAt:now, createdAt:prev.createdAt||now, v:1};
  await FB.pset('reviews/'+key, rec);
  S.privateReviews={...(S.privateReviews||{}), [key]:rec};
  return true;
}
async function deleteReviewFor(mid){
  if(!S.me || !privateAuthReady(S.me.id)) return false;
  const key=safeFbKey(mid);
  await FB.pdel('reviews/'+key);
  const next={...(S.privateReviews||{})}; delete next[key]; S.privateReviews=next;
  return true;
}
function reviewSheet(mid){
  const m=(S.matches||[]).find(x=>x.id===mid);
  if(!m || !S.me || (m.aId!==S.me.id && m.bId!==S.me.id)) return toast('내 경기만 복기할 수 있습니다.',1);
  if(!privateAuthReady(S.me.id)) return errorSheet('비공개 복기를 열 수 없습니다', privateAuthText());
  const r=reviewOf(mid)||{};
  const sh=sheet('경기 복기', `<p class="tiny dim">${reviewMatchLabel(m)}</p>
    <div class="field" style="margin-top:12px"><label>잘 된 점</label><textarea id="rvGood" style="height:74px" placeholder="예: 리시브를 짧게 잘 뒀다">${esc(r.good||'')}</textarea></div>
    <div class="field"><label>아쉬운 점</label><textarea id="rvBad" style="height:74px" placeholder="예: 백 쪽 긴 공에 늦었다">${esc(r.bad||'')}</textarea></div>
    <div class="field"><label>다음 목표</label><textarea id="rvNext" style="height:64px" placeholder="예: 같은 상대에게는 백 깊게 먼저 보내기">${esc(r.next||'')}</textarea></div>
    <div class="field"><label>태그</label><input id="rvTags" value="${esc((r.tags||[]).join(', '))}" placeholder="리시브, 서브, 백핸드"></div>
    <div class="row"><button class="btn" id="rvSave" style="flex:1">저장</button>${r.createdAt?'<button class="btn ghost" id="rvDel" style="flex:1">삭제</button>':''}</div>
    <p class="tiny dim" style="margin:9px 2px 0">이 내용은 공용 경기 기록에 섞이지 않고 현재 비공개 계정 저장소에만 저장됩니다.</p>`);
  $('#rvSave').onclick=async()=>{
    const tags=($('#rvTags').value||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,8);
    try{
      await saveReviewFor(mid,{date:m.date, lg:lgOf(m), oppId:m.aId===S.me.id?m.bId:m.aId, result:winnerOf(m)===S.me.id?'W':'L',
        good:$('#rvGood').value.trim(), bad:$('#rvBad').value.trim(), next:$('#rvNext').value.trim(), tags});
      sh.remove(); softRender(); toast('복기를 저장했습니다.');
    }catch(e){ errorSheet('저장하지 못했습니다', authErrText(e)); }
  };
  if($('#rvDel')) $('#rvDel').onclick=async()=>{
    if(!confirm('이 복기를 삭제할까요?')) return;
    try{ await deleteReviewFor(mid); sh.remove(); softRender(); toast('복기를 삭제했습니다.'); }
    catch(e){ errorSheet('삭제하지 못했습니다', authErrText(e)); }
  };
}
'''
s = rep_once(s, "function trackVisit(force){", helpers + "\nfunction trackVisit(force){")

s = rep_once(s,
"S.me=P(id); await sSet(KEY.session,{playerId:id, at:Date.now()},false); S.tab='rank'; render();",
"S.me=P(id); await activatePrivateAuth(id,pin); await loadPrivateReviews(); await sSet(KEY.session,{playerId:id, at:Date.now()},false); S.tab='rank'; render();")

s = rep_once(s,
"S.me=P(p.id); await sSet(KEY.session,{playerId:p.id, at:Date.now()},false);",
"S.me=P(p.id); await activatePrivateAuth(p.id,pin); await loadPrivateReviews(); await sSet(KEY.session,{playerId:p.id, at:Date.now()},false);")

s = rep_once(s,
"      ${canDel?`<button class=\"btn ghost sm\" data-date=\"${m.id}\">",
"      ${mine?`<button class=\"btn ghost sm\" data-review=\"${m.id}\">${reviewOf(m.id)?'복기 보기':'복기'}</button>`:''}\n      ${canDel?`<button class=\"btn ghost sm\" data-date=\"${m.id}\">")

s = rep_once(s,
"  document.querySelectorAll('[data-ok]').forEach(b=>b.onclick=async()=>{",
"  document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>reviewSheet(b.dataset.review));\n  document.querySelectorAll('[data-ok]').forEach(b=>b.onclick=async()=>{")

s = rep_once(s,
"const mt=S.meTab==='set'?'set':'rec';",
"const mt=S.meTab==='set'?'set':(S.meTab==='review'?'review':'rec');")

s = rep_once(s,
"""  const bodyHTML = mt==='rec'
    ? withLeagueView('all', ()=>playerCardHTML(p.id,{detailLg}))
    : `<div class="card">""",
"""  const bodyHTML = mt==='rec'
    ? withLeagueView('all', ()=>playerCardHTML(p.id,{detailLg}))
    : mt==='review'
    ? reviewListHTML(p.id)
    : `<div class="card">""")

s = rep_once(s,
"      <button data-metab=\"set\" class=\"${mt==='set'?'on':''}\">",
"      <button data-metab=\"review\" class=\"${mt==='review'?'on':''}\">복기</button>\n      <button data-metab=\"set\" class=\"${mt==='set'?'on':''}\">")

s = rep_once(s,
"if($('#eOut')) $('#eOut').onclick=async()=>{ await sDel(KEY.session,false); S.me=null; render(); };",
"if($('#eOut')) $('#eOut').onclick=async()=>{ await sDel(KEY.session,false); S.me=null; await resetPrivateAuth(); render(); };")

s = rep_once(s,
"if(p && p.active!==false){ S.me=p; sSet(KEY.session,{playerId:p.id, at:Date.now()},false); }",
"if(p && p.active!==false){ S.me=p; await loadPrivateReviews(); sSet(KEY.session,{playerId:p.id, at:Date.now()},false); }")

path.write_text(s, encoding='utf-8', newline='\n')
(root/'index.html').write_text(s, encoding='utf-8', newline='\n')
print('updated', path)
print('backup', backup)
