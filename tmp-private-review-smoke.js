const {createApp, loadFixture} = require('./tests/harness');
(async()=>{
  const api = loadFixture(await createApp());
  api.S.me = api.S.players[0];
  api.S.privateReviews = {};
  api.S.privateReviewState = 'locked';
  api.S.privateReviewMsg = 'test locked';
  api.eval("S.meTab='review'; viewMe();");
  const html = api.doc.querySelector('#view').innerHTML;
  if(!html.includes('data-metab="review"')) throw new Error('review tab missing');
  if(!html.includes('비공개 복기')) throw new Error('review list missing');
  const m = api.S.matches.find(x=>!x.void && (x.aId===api.S.me.id || x.bId===api.S.me.id));
  if(!m) throw new Error('no match for smoke');
  const card = api.eval(`matchCardHTML(S.matches.find(x=>x.id==='${m.id}'))`);
  if(!card.includes('data-review=')) throw new Error('review button missing');
  console.log('private review smoke ok');
})().catch(e=>{ console.error(e); process.exit(1); });
