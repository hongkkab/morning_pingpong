const assert=require('assert/strict');const{createApp}=require('./harness');
const plain=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const app=await createApp(),run=s=>app.eval(s);
 run(`S.meta=normalizeMeta({settings:{...DEFAULTS,autoCalib:true,confirmedOnly:false,handiElo:95,ptsPerBu:1,residualBu:50,calibEvery:50}}).meta;
 S.players=['a','b','c','d'].map((id,i)=>({id,name:id,bu:7+i,active:true}));S.matches=[];S.lg='all';
 function sampleGame(i,a='a',b='b'){return {id:'sample'+i,date:'2026-08-01',lg:'morning',aId:a,bId:b,winnerId:i%3?a:b,enteredAt:String(i).padStart(5,'0'),confirmedBy:[a,b]};}
 S.matches=Array.from({length:100},(_,i)=>sampleGame(i));recompute();`);
 const sample=run('calibrationSample()');assert(sample.info.weight<=8+1e-9);assert.equal(sample.info.cappedPairs,1);
 assert.equal(app.S.G.a,100);assert.equal(app.S.W.a+app.S.L.a,100);assert.equal(app.S._sorted.length,100);
 const weights=plain(run('[...calibrationSample().weights]'));
 run("S.matches.forEach(m=>m.winnerId=m.winnerId===m.aId?m.bId:m.aId)");assert.deepEqual(plain(run('[...calibrationSample().weights]')),weights);
 assert.equal(run('S._calibrationInfo.sufficient'),false);assert.equal(run('residualNow()'),50);
 console.log('PASS 반복 상대 보정 표본 최대 8경기 상당 / 승패·이변에 무관한 가중치 / 실제 100경기는 전부 Elo 반영 / 작은 표본 기본값 유지');
 run(`S.players[0].bu=7;S.players[0].buHist=[{date:'2026-08-10',from:10,bu:7}];S.players[1].bu=9;
 S.matches=[{...sampleGame(1),_expA:.2,handi:{toId:'a',pts:1}}];S._sorted=S.matches;`);
 let rows=plain(run('handiTable({raw:true})'));assert.equal(rows[0].d,1);assert.equal(rows[0].rate,1);assert.equal(rows[0].expAvg,.2);
 run("S.meta.rounds={'morning|r':{bu:{a:8}}};S.matches[0].rd='r'");rows=plain(run('handiTable({raw:true})'));assert.equal(rows[0].d,1);assert.equal(rows[0].rate,0);assert.equal(rows[0].expAvg,.8);
 console.log('PASS 승급 전 경기의 당시 부수 / 해당 회차 임시 부수 / 약한 선수의 실제 승률과 예상 방향 일치');
 const hash=run('calibMetaSig()');run("S.meta.rounds['morning|r'].bu.a=6");assert.notEqual(run('calibMetaSig()'),hash);
 const prefix=run('calibPrefixHash(1)');run("S.matches[0].bId='c'");assert.notEqual(run('calibPrefixHash(1)'),prefix);
 console.log('PASS 임시 부수·경기 참가자 변경 시 보정 캐시 무효화');
 run("S.meta.rounds={};S.players[0].buHist=[];S.players[0].bu=7;S.players[1].bu=10;S.matches=Array.from({length:12},(_,i)=>sampleGame(i));recompute()");
 assert(run('matchCardHTML(S._sorted[0]).includes("초기 예상")'));assert(run('matchCardHTML(S._sorted[0]).includes("경기 기록 부족")'));
 assert(!run('matchCardHTML(S._sorted[11]).includes("초기 예상")'));assert.equal(app.S._sorted[0]._gamesA,0);assert.equal(app.S._sorted[11]._gamesA,11);
 const {readFileSync}=require('fs');assert.equal(readFileSync('index.html','utf8'),readFileSync('table-tennis-elo.html','utf8'));
 console.log('PASS 경기 직전 표본 수에 따라 초기 예상 표시 / 이후 경기 수가 과거 표시에 섞이지 않음 / 두 진입 페이지 일치');
 process.exit(0);
})().catch(e=>{console.error(e.stack);process.exit(1)});
