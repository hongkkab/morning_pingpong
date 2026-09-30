const assert=require('assert/strict'),{createApp}=require('./harness');
(async()=>{
 const app=await createApp(),run=s=>app.eval(s);
 run(`function resetRegistration(){
  delete CFG.firebase;S.players=[{id:'admin',name:'관리자',bu:10,role:'admin',active:true},{id:'member',name:'기존선수',bu:10,role:'member',active:true,aliases:['별명']},{id:'inactive',name:'휴면선수',bu:11,role:'member',active:false}];S.me=S.players[0];S.lg='all';S.matches=[{id:'g',date:'2026-08-12',lg:'morning',aId:'admin',bId:'member',winnerId:'admin',confirmedBy:['admin','member']}];S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:false},rounds:{}}).meta;recompute();globalThis.remote=clean(S.players);globalThis.writes=0;FB={connected:true,transact:async(path,fn)=>{if(path!=='players')return [];const next=fn(clean(remote));remote=next;writes++;return clean(remote)},set:async()=>true};}
 resetRegistration();`);
 const original=run('JSON.stringify({matches:S.matches,meta:S.meta,rates:[rawRate("admin","skill"),rawRate("member","skill")]})');
 run('S.me=null');assert.equal((await run("promotionRegisterParticipants([{id:'member'}])"))[0].id,'member');assert.equal(run('writes'),0);
 await assert.rejects(()=>run("promotionRegisterParticipants([{name:'신규',bu:11}])"),/관리자/);assert.equal(run('writes'),0);
 run("S.me=P('member')");await assert.rejects(()=>run("promotionRegisterParticipants([{name:'신규',bu:11}])"),/관리자/);
 run("S.me=P('admin')");
 for(const [rows,pattern]of [[[{name:'기존 선수',bu:10}],/이미 등록/],[[{name:'별명',bu:10}],/이미 등록/],[[{name:'휴면선수',bu:10}],/활동 상태/],[[{name:'',bu:10}],/이름/],[[{name:'새선수',bu:12}],/부수/],[[{name:'새선수',bu:10},{name:'새 선수',bu:11}],/중복/],[[{id:'member'},{id:'member'}],/같은 회원/],[[{id:'missing'}],/명단이 변경/]])await assert.rejects(()=>run('promotionRegisterParticipants('+JSON.stringify(rows)+')'),pattern);
 assert.equal(run('writes'),0);
 console.log('PASS public existing-player selection is read-only; admin-only registration; names/aliases/inactive names, invalid divisions and duplicate links blocked');
 const result=await run("promotionRegisterParticipants([{id:'member'},{name:'김정훈A',bu:10},{name:'김정훈B',bu:11}])");assert.equal(run('writes'),1);assert.equal(run('S.players.length'),5);assert.equal(result[0].id,'member');assert.notEqual(result[1].id,result[2].id);assert.equal(result[1].role,'member');assert.equal(result[2].addedBy,'admin');assert.equal(result[2].bu,11);assert(!result[2].id.startsWith('sim-guest:'));
 assert.equal(run('JSON.stringify({matches:S.matches,meta:S.meta,rates:[rawRate("admin","skill"),rawRate("member","skill")]})'),original);
 assert.equal(run('S.G['+JSON.stringify(result[2].id)+']||0'),0);assert.equal(run('rawRate('+JSON.stringify(result[2].id)+',"skill")'),run('baseFor(11)'));
 await assert.rejects(()=>run("promotionRegisterParticipants([{name:'김정훈A',bu:10}])"),/이미 등록/);assert.equal(run('writes'),1);
 run('S.players=clean(remote);recompute()');assert.equal(run('roster().filter(p=>p.name.startsWith("김정훈")).length'),2);
 console.log('PASS mixed existing/new batch saves once, A/B stay distinct, persistent real IDs, zero games and initial Elo; existing ratings and matches unchanged');
 run("resetRegistration();globalThis.before=JSON.stringify(S.players);FB.transact=async()=>{throw Error('저장 실패')}");await assert.rejects(()=>run("promotionRegisterParticipants([{name:'한명',bu:10},{name:'두명',bu:11}])"),/저장 실패/);assert.equal(run('JSON.stringify(S.players)'),run('before'));assert.equal(run('writes'),0);
 run("resetRegistration();CFG.firebase={databaseURL:'configured'};FB.connected=false");await assert.rejects(()=>run("promotionRegisterParticipants([{name:'신규',bu:10}])"),/공유 저장소/);assert.equal(run('writes'),0);
 run("resetRegistration();FB.transact=async(path,fn)=>{if(path!=='players')return [];fn(clean(remote));remote.push({id:'concurrent',name:'동시선수',bu:10,active:true});const next=fn(clean(remote));writes++;return next}");await assert.rejects(()=>run("promotionRegisterParticipants([{name:'먼저',bu:11},{name:'동시선수',bu:10}])"),/이미 등록/);assert.equal(run('writes'),0);assert(!run('remote.some(p=>p.name==="먼저")'));assert.equal(run('S.players.length'),3);
 run("resetRegistration();remote[0].role='member'");await assert.rejects(()=>run("promotionRegisterParticipants([{name:'신규',bu:10}])"),/관리자 권한/);assert.equal(run('writes'),0);
 console.log('PASS failed/disconnected saves preserve inputs and players; concurrent duplicate and revoked admin abort entire batch before commit');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
