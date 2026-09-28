/* Reproduce monthly out-of-time calibration evaluation using the real app.
 Usage: node tests/calibration-eval.js <snapshot.json> <baseline-git-ref>
 Snapshot: {meta,players,matches}. No network access, no production mutations.
 Player history/rules use the supplied current snapshot; this is replay, not
 archived pre-match predictions. Do not select parameters on reported test months. */
const fs=require('fs'),cp=require('child_process'),{createApp}=require('./harness');
const [snapshotPath,baselineRef]=process.argv.slice(2);
if(!snapshotPath||!baselineRef){console.error('Usage: node tests/calibration-eval.js <snapshot.json> <baseline-git-ref>');process.exit(2)}
const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
const list=x=>(Array.isArray(x)?x:Object.values(x||{})).filter(Boolean),clone=x=>JSON.parse(JSON.stringify(x));
const stats=rows=>{let b=0,ll=0,hits=0;for(const m of rows){const y=m.winnerId?+(m.winnerId===m.aId):+(m.aSets>m.bSets),p=m._expA,q=Math.max(1e-9,Math.min(1-1e-9,p));b+=(p-y)**2;ll-=y*Math.log(q)+(1-y)*Math.log(1-q);hits+=p===.5?.5:(p>.5)===(y===1)?1:0;}return{n:rows.length,brier:b/rows.length,logLoss:ll/rows.length,accuracy:hits/rows.length}};
(async()=>{
 const baselineHtml=cp.execFileSync('git',['show',baselineRef+':index.html'],{encoding:'utf8',maxBuffer:3000000}),matches=list(snapshot.matches),maxDate=matches.map(m=>m.date).sort().at(-1),now=Date.parse(maxDate+'T12:00:00+09:00');
 const result=[];
 for(const [label,html]of [['baseline',baselineHtml],['current',undefined]]){
  const app=await createApp({html,now});
  for(const [from,to] of [['2026-07-01','2026-08-01'],['2026-08-01','2026-09-01'],['2026-09-01','2026-10-01']]){
   app.S.meta=clone(snapshot.meta);app.S.players=clone(list(snapshot.players));app.S.matches=clone(matches.filter(m=>m.date<from));app.S.lg='all';app.recompute();const residual=app.S._calib,trainingN=app.S._sorted.length;
   app.S.meta.settings={...app.S.meta.settings,autoCalib:false,residualBu:residual};app.S.matches=clone(matches.filter(m=>m.date<to));app.recompute();
   const rows=app.S._sorted.filter(m=>m.date>=from),row={label,from,to,residual,trainingN,...stats(rows)};result.push(row);console.log(JSON.stringify(row));
  }
 }
 console.log(JSON.stringify({replay:true,currentHistoryAndRules:true,baselineRef,result}));process.exit(0);
})().catch(e=>{console.error(e.stack);process.exit(1)});
