const assert=require('assert/strict');
const {createApp}=require('./harness');
const plain=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const app=await createApp(),run=s=>app.eval(s);
 run(`
   function resetAudit(){
     FB=null;delete CFG.firebase;S.players=['a','b','c'].map(id=>({id,name:id,bu:10,active:true,role:id==='a'?'admin':'member'}));S.me=S.players[0];
     S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false,confirmedOnly:false,baseRating:1500,handiElo:95,residualBu:0,ptsPerBu:1,
       kNew:20,kMid:20,kBase:20,repeatN0:0,provisional:1,leagues:[{id:'morning',name:'모닝'},{id:'other',name:'별도',cup:true}]},rounds:{}}).meta;
     S.matches=[];S.lg='all';S.tab='rank';S.ready=true;S.busy=false;recompute();
   }
   function auditGame(id='g',extra={}){return {id,date:'2026-08-12',lg:'morning',aId:'a',bId:'b',winnerId:'a',confirmedBy:['a','b'],rev:1,enteredAt:'2026-08-12T01:00:00Z',...extra};}
   resetAudit();S.matches=[auditGame()];recompute();
 `);
 const baseline=run('dataSig()');
 run(`let writeCount=0;const readMeta=clean(S.meta),readPlayers=clean(S.players),readMatches=Object.fromEntries(S.matches.map(m=>[m.id,cacheMatch(m)]));
   FB={get:async path=>{if(path==='meta')throw Error('failed read');return path==='sig'?{t:1}:path==='players'?readPlayers:readMatches;},set:async()=>{writeCount++}};`);
 assert.equal(await run('loadFresh()'),false);assert.equal(run('dataSig()'),baseline);assert.equal(run('writeCount'),0);assert.equal(app.S.stale,true);
 run("let signalCounter=0;FB.get=async path=>path==='sig'?{t:++signalCounter}:path==='meta'?readMeta:path==='players'?readPlayers:readMatches");
 assert.equal(await run('loadFresh()'),false);assert.equal(run('dataSig()'),baseline);
 run("FB.get=async path=>clean(path==='sig'?{t:1}:path==='meta'?readMeta:path==='players'?readPlayers:readMatches)");
 assert.equal(await run('loadFresh()'),true);assert.equal(app.S.stale,false);assert.equal(run('writeCount'),0);
 // Full refresh must include edits with older changelog keys and unchanged rev/count.
 run("readMatches.g.winnerId='b';localSet(SYNC_KEY,{lastKey:'9999999999999_future'});S._sig=dataSig()");
 assert.equal(await run('loadFresh()'),true);assert.notEqual(run('dataSig()'),run('S._sig'));assert.equal(app.S.matches[0].winnerId,'b');
 console.log('PASS 읽기 실패·일관되지 않은 스냅샷에서 기존 데이터 보존 / 자동 초기화 쓰기 0 / 변경 시각·rev와 무관한 최신 동기화');

 run("resetAudit();S.matches=[auditGame()];recompute();FB=null;CFG.firebase={databaseURL:'configured'}");
 const offline=run('dataSig()');
 assert.equal(await run("pushMatches([auditGame('new')])"),false);assert.equal(await run("sSet(KEY.meta,{})"),false);
 assert.equal(await run("deleteMatchById('g')"),false);assert.equal(run('dataSig()'),offline);
 run('delete CFG.firebase');
 run("FB={get:async()=>{throw Error('offline')},set:async()=>{writeCount++}};");
 assert.equal(await run("savePlayers(map=>map.get('a').name='changed',{light:true})"),false);assert.equal(app.S.players[0].name,'a');
 run("FB={get:async()=>clean(S.players),set:async()=>{throw Error('denied')}}");
 assert.equal(await run("savePlayers(map=>map.get('a').name='changed',{light:true})"),false);assert.equal(app.S.players[0].name,'a');
 run(`let remotePlayers=clean(S.players);remotePlayers[1].name='other-device';
   FB={transact:async(path,fn)=>{fn(clean(S.players));remotePlayers=fn(remotePlayers);return clean(remotePlayers)},set:async()=>true};`);
 assert.equal(await run("savePlayers(map=>map.get('a').name='mine')"),true);assert.equal(app.S.players[0].name,'mine');assert.equal(app.S.players[1].name,'other-device');
 console.log('PASS 연결 실패 시 저장/삭제 성공 오표시 차단 / 선수 저장 실패 원본 보존 / 동시 선수 변경 재시도 보존');

 run(`resetAudit();let atomicPatches=[];FB={patchRoot:async patch=>{atomicPatches.push(clean(patch));throw Error('reject')}};
    gridE={lg:'other',date:'2026-08-07',ids:['a','b'],grp:{a:'A',b:'B'},tbu:{a:9},hb:{},rfmt:'team',teamKind:'ab',step:'grid',sets:{},wins:{}};`);
 const metaBefore=JSON.stringify(app.S.meta);
 assert.equal(await run("saveRdMeta('other','2026-W32',{a:9},{},{fmt:'team'})"),false);assert.equal(JSON.stringify(app.S.meta),metaBefore);
 const failure=await run("saveGrid('other','2026-W32',[{a:'a',b:'b',w:'a',sa:2,sb:1}])");
 assert.equal(failure,false);assert.equal(app.S.matches.length,0);assert.equal(run('gridE.ids.length'),2);
 run('atomicPatches=[];FB.patchRoot=async patch=>{atomicPatches.push(clean(patch))}');
 assert.equal(await run("saveGrid('other','2026-W32',[{a:'a',b:'b',w:'a',sa:2,sb:1}])"),true);
 assert.equal(run('atomicPatches.length'),1);assert.equal(app.S.matches.length,1);assert.equal(run("rdBu('other','2026-W32','a')"),9);
 assert(run("Object.keys(atomicPatches[0]).some(k=>k.startsWith('matches/'))"));assert(run("Object.keys(atomicPatches[0]).includes('meta/rounds/other|2026-W32')"));
 assert(!run("'meta' in atomicPatches[0]"));assert(!Object.keys(plain(app.S.matches[0])).filter(k=>k[0]==='_').some(k=>run("JSON.stringify(atomicPatches[0])").includes('"'+k+'":')));
 console.log('PASS 경기+임시 부수+팀 편성 한 번에 저장 / 실패 시 전부 미반영·입력 유지 / 다른 회차 덮어쓰기 없음 / 계산 필드 저장 안 함');

 run(`resetAudit();let remote={players:clean(S.players),meta:clean(S.meta),matches:{old:auditGame('old',{date:'2026-06-01'})}},restores=0;
   FB={get:async path=>clean(remote[path]),patchRoot:async patch=>{restores++;remote=nestedPatch(remote,clean(patch));},set:async()=>true};
   const backup={club:CLUB,players:clean(S.players),meta:clean(S.meta),matches:[auditGame('july',{date:'2026-07-01',_rA:9999}),auditGame('aug',{date:'2026-08-01'})]};`);
 assert.equal(await run('applyBackup(backup)'),true);assert.equal(run('restores'),1);assert.deepEqual(Object.keys(plain(run('remote.matches'))).sort(),['aug','july']);
 assert.equal(app.S.matches.length,2);assert.equal(run('remote.matches.july._rA'),undefined);
 const restored=run('dataSig()');
 run("FB.patchRoot=async()=>{throw Error('denied')};backup.matches=[auditGame('replacement')]");
 assert.equal(await run('applyBackup(backup)'),false);assert.equal(run('dataSig()'),restored);
 assert.throws(()=>run('validateBackup({...backup,matches:[auditGame(),auditGame()]})'),/중복/);
 assert.throws(()=>run("validateBackup({...backup,matches:[auditGame('x',{winnerId:'c'})]})"),/승자/);
 console.log('PASS 여러 월 백업 전체 복원·낡은 기록 제거 / 서버 단일 저장 / 실패 시 유지 / 잘못된 백업 차단');

 run("resetAudit();mem.set('s:'+KEY.players,JSON.stringify(S.players));S.matches=[auditGame('other',{lg:'other'})];recompute()");
 const planned=await run("planAndSave('2026-08-12','a',{b:{r:'W',n:1}},'morning')");assert.equal(planned.created,1);assert.equal(planned.skipped,0);assert.equal(app.S.matches.length,2);
 run("S.meta.settings.confirmedOnly=true;S.meta.settings.legacyBefore='2026-01-01'");
 assert.equal(run("isConfirmed(auditGame('bad',{confirmedBy:['a','a']}))"),false);
 assert.equal(run("isConfirmed(auditGame('bad',{confirmedBy:['a','c']}))"),false);
 assert.equal(run("isConfirmed(auditGame('bad',{confirmedBy:['a','b']}))"),true);
 assert.equal(run("isConfirmed(auditGame('bad',{confirmedBy:[],enteredAt:''}))"),false);
 assert.equal(run("validDate('2026-02-30')"),false);assert.equal(run("validDate('2024-02-29')"),true);
 run("resetAudit();S.matches=[auditGame('ok'),auditGame('future',{date:'2026-08-14'}),auditGame('self',{bId:'a'}),auditGame('missing',{bId:'gone'}),auditGame('sets',{aSets:0,bSets:2}),auditGame('invalid-date',{date:'2026-02-30'})];recompute()");
 assert.deepEqual(Array.from(run('S._sorted.map(m=>m.id)')),['ok']);assert.deepEqual(Array.from(run('publicResultMatches().map(m=>m.id)')),['ok']);
 assert.equal(await run("commitMatch(auditGame('future',{date:'2026-08-14'}))"),false);
 console.log('PASS 리그별 중복 분리 / 양쪽 선수만 확인 인정 / 윤년·잘못된 날짜 / 미래·잘못된 경기 집계 및 저장 제외');

 run(`resetAudit();S.matches=[auditGame('remove')];recompute();let deletionCalls=0;let deletionData={players:clean(S.players),matches:Object.fromEntries(S.matches.map(m=>[m.id,cacheMatch(m)]))};
   FB={get:async path=>clean(deletionData[path]),patchRoot:async patch=>{deletionCalls++;throw Error('denied')}};`);
 const deletionBefore=run('dataSig()');assert.equal(await run("deletePlayerAtomic('b')"),-1);assert.equal(run('dataSig()'),deletionBefore);
 run('FB.patchRoot=async patch=>{deletionCalls++;deletionData=nestedPatch(deletionData,clean(patch));}');
 assert.equal(await run("deletePlayerAtomic('b')"),1);assert.equal(app.S.matches.length,0);assert(!app.S.players.some(p=>p.id==='b'));assert.equal(await run("deletePlayerAtomic('a')"),-1);
 run(`resetAudit();S.matches=[auditGame('move',{lg:'other',date:'2026-08-07',rd:'2026-W32'})];S.meta.rounds['other|2026-W32']={bu:{a:9},hb:{},date:'2026-08-07'};recompute();
   let movedPatch;FB={patchRoot:async patch=>{movedPatch=clean(patch)}};`);
 assert.equal(await run("moveRoundAtomic('other','2026-W32','2026-08-12','2026-W33')"),true);
 assert.equal(app.S.matches[0].date,'2026-08-12');assert.equal(run("rdMeta('other','2026-W32')"),null);assert.equal(run("rdBu('other','2026-W33','a')"),9);
 assert(run("Object.keys(movedPatch).includes('matches/move')"));assert.equal(run("movedPatch['meta/rounds/other|2026-W32']"),null);
 assert.equal(await run("moveRoundAtomic('other','2026-W33','2026-08-14','2026-W33')"),false);
 console.log('PASS 선수+경기 동시 삭제·실패 보존·마지막 관리자 보호 / 날짜+회차 동시 이동·미래 이동 차단');

 run("resetAudit();S.matches=[auditGame('one'),auditGame('two')];recompute();let metaPatch;FB={patchRoot:async()=>{throw Error('denied')}}");
 const priorMeta=JSON.stringify(app.S.meta),priorMatches=JSON.stringify(app.S.matches);
 assert.equal(await run("saveMetaFields({'settings/kBase':44,directory:'new'})"),false);assert.equal(JSON.stringify(app.S.meta),priorMeta);
 assert.equal(await run("mergeDuplicateMatches(S.matches[0],S.matches[1])"),false);assert.equal(JSON.stringify(app.S.matches),priorMatches);
 run("FB.patchRoot=async patch=>{metaPatch=clean(patch)}");
 assert.equal(await run("saveMetaFields({'settings/kBase':44})"),true);assert.equal(app.S.meta.settings.kBase,44);assert.equal(run("'meta' in metaPatch"),false);assert.equal(run("'meta/settings' in metaPatch"),false);
 assert.equal(await run("mergeDuplicateMatches(S.matches[0],S.matches[1])"),true);assert.equal(app.S.matches.length,1);assert.equal(run("metaPatch['matches/two']"),null);assert(run("metaPatch['matches/one']"));
 assert(run("settingsProblem({...st(),kBase:-1})"));assert(run("settingsProblem({...st(),bestOf:4})"));
 console.log('PASS 설정 실패 원본 보존·변경 필드만 저장 / 중복 병합 한 번에 저장 / 잘못된 계산 규칙 차단');
 run("resetAudit();const sdkBefore=loadSDK;let connectionCallback,serverWrites=0;CFG.firebase={databaseURL:'mock'};loadSDK=async()=>[{initializeApp:()=>({})},{getDatabase:()=>({}),ref:(db,path)=>path,onValue:(ref,fn)=>{connectionCallback=fn;queueMicrotask(()=>fn({val:()=>true}))},get:async()=>({exists:()=>true,val:()=>({cached:true})}),set:async()=>{serverWrites++}},{getAuth:()=>({currentUser:{uid:'mock'}}),onAuthStateChanged:(auth,fn)=>{fn();return()=>{}}},null];");
 const connection=await run('initFirebase()');assert.equal(connection.connected,true);assert.deepEqual(plain(await connection.get('players')),{cached:true});
 run('connectionCallback({val:()=>false})');assert.equal(connection.connected,false);await assert.rejects(()=>connection.get('players'),/연결/);await assert.rejects(()=>connection.set('players',[]),/연결/);assert.equal(run('serverWrites'),0);
 run('connectionCallback({val:()=>true})');assert.equal(connection.connected,true);run('loadSDK=sdkBefore;delete CFG.firebase');
 run("resetAudit();const accountData={sig:{t:1},meta:clean(S.meta),players:clean(S.players),matches:{}};accountData.players[0].active=false;FB={get:async key=>clean(accountData[key])};");
 assert.equal(await run('loadFresh()'),true);assert.equal(app.S.me,null);const accountSig=run('dataSig()');run("accountData.players.push({id:'broken'})");assert.equal(await run('loadFresh()'),false);assert.equal(run('dataSig()'),accountSig);
 console.log('PASS 서버 연결 끊김 시 SDK 캐시를 최신으로 취급하지 않음·쓰기 차단 / 비활성 계정 로그인 해제 / 손상된 선수 목록 미반영');

 // IndexedDB request success is not a transaction commit.
 run("let fakeTransaction,fakeRequest;window.indexedDB={open:()=>{const request={result:{transaction:()=>fakeTransaction,close:()=>{}}};queueMicrotask(()=>request.onsuccess());return request}};fakeRequest={result:'saved'};fakeTransaction={objectStore:()=>({put:()=>fakeRequest}),error:null};let cacheSettled=false;const pendingCache=idbSet('test',{}).then(()=>{cacheSettled=true;return true},()=>{cacheSettled=true;return false});");
 await new Promise(resolve=>setTimeout(resolve,0));run('fakeRequest.onsuccess()');await new Promise(resolve=>setTimeout(resolve,0));assert.equal(run('cacheSettled'),false);
 run('fakeTransaction.onabort()');assert.equal(await run('pendingCache'),false);
 run('delete window.indexedDB');console.log('PASS 캐시 요청 성공 뒤 트랜잭션 중단 시 저장 성공 처리하지 않음');

 // Independent mathematical oracle: fixed K, no repeat decay, no calibration.
 run("resetAudit();S.players[0].bu=8;S.players[1].bu=9;");
 let seed=441;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const games=Array.from({length:300},(_,i)=>{const a=Math.floor(random()*3),b=(a+1+Math.floor(random()*2))%3,ids=['a','b','c'];return{id:'math'+String(i).padStart(3,'0'),date:'2026-08-12',enteredAt:String(i).padStart(4,'0'),aId:ids[a],bId:ids[b],winnerId:ids[random()<.57?a:b],lg:'morning',handi:i%3?{toId:ids[b],pts:2}:null};});
 app.S.matches=plain(games);app.recompute();
 for(const mode of ['skill','form']){
   const r=mode==='skill'?{a:1690,b:1595,c:1500}:{a:1500,b:1500,c:1500};
   for(const m of games){let ea=r[m.aId],eb=r[m.bId];if(mode==='skill'&&m.handi){if(m.handi.toId===m.aId)ea+=190;else eb+=190}const p=1/(1+10**((eb-ea)/400)),d=20*((m.winnerId===m.aId?1:0)-p);r[m.aId]+=d;r[m.bId]-=d;
     if(mode==='skill'){const actual=app.S.matches.find(x=>x.id===m.id);assert(Math.abs(actual._expA-p)<1e-10);assert(Math.abs(actual._sA-d)<1e-10);}
   }
   for(const id of Object.keys(r))assert(Math.abs(run(`rateOf('${id}','${mode}')`)-r[id])<1e-9);
 }
 const ratings=plain(app.S.tracks);app.S.matches=games.map(m=>({...m,aId:m.bId,bId:m.aId}));app.recompute();
 for(const mode of ['skill','form'])for(const id of ['a','b','c'])assert(Math.abs(app.S.tracks[mode].R[id]-ratings[mode].R[id])<1e-9);
 assert.equal(Object.values(app.S.G).reduce((a,b)=>a+b),600);assert.equal(Object.values(app.S.W).reduce((a,b)=>a+b),300);assert.equal(Object.values(app.S.L).reduce((a,b)=>a+b),300);
 console.log('PASS 독립 수학식으로 300경기 Elo·확률·양쪽 증감 대조 / A·B 뒤집기 대칭 / 전체 승패·경기 수 보존');
 process.exit(0);
})().catch(e=>{console.error(e.stack);process.exit(1)});
