/* UI 스모크 테스트 — 모든 탭 × 리그 조합에서 render()가 예외 없이
   의미 있는 HTML을 내놓는지 확인한다. (내용 검증은 golden-test 몫) */
const { createApp, loadFixture, setLeague } = require("./harness");

(async () => {
  const app = loadFixture(await createApp());
  const S = app.S;
  /* 관리자로 로그인한 상태처럼 — 관리 탭까지 그려보기 위해 */
  S.me = S.players.find(p => p.role === "admin") || S.players[0];

  const view = app.doc.querySelector("#view");
  const tabs = app.eval("tabList()").map(t => Array.isArray(t) ? t[0] : (t.id || t));
  console.log("탭:", tabs.join(", "));
  let failed = 0;
  const rosterText = "A조 @조대우 @권주홍 @방정제\nB조 @송제훈 @백종훈 @김지현";
  const rosterOrder = app.eval(`parseRoster(${JSON.stringify(rosterText)}, "quickmeet").list.map(x=>P(x.id).name+"@"+x.g)`);
  const rosterOk = JSON.stringify(rosterOrder) === JSON.stringify([
    "조대우@A", "권주홍@A", "방정제@A", "송제훈@B", "백종훈@B", "김지현@B"
  ]);
  if (!rosterOk) failed++;
  console.log(`${rosterOk ? "✅" : "❌"} 조별 명단 붙여넣기 순서 유지`);

  const rankFilterOk = app.eval(`
    (() => {
      const oldLg = S.lg, oldTab = S.tab;
      try {
        S.lg = 'all'; S.tab = 'rank';
        recompute(); viewRank();
        const h = document.querySelector('#view').innerHTML || '';
        return h.includes('id="pickLg"')
          && h.includes('id="pickBu"')
          && h.includes('id="modeInfo"')
          && h.includes(MODES.skill.note);
      } finally {
        S.lg = oldLg; S.tab = oldTab; recompute();
      }
    })()
  `);
  if (!rankFilterOk) failed++;
  console.log(`${rankFilterOk ? "✅" : "❌"} 랭킹 리그·부수 선택 버튼·기준 설명 렌더링`);

  const frozenRankOk = app.eval(`
    (() => {
      const oldLg = S.lg, oldTab = S.tab, oldPeriod = S.period, oldMode = S.mode, oldBu = S.bu, oldRq = S.rq, oldShow = S.showFrozenRank;
      try {
        S.lg = 'all';
        S.tab = 'rank';
        S.period = 'all';
        S.mode = 'skill';
        S.bu = null;
        S.rq = '';
        S.showFrozenRank = false;
        recompute();
        viewRank();
        const target = ranked('skill').find(r =>
          (S.G[r.p.id] || 0) >= (st().provisional || 0) && idleDays(r.p.id) >= 30);
        if (!target) return true;
        const active = ranked('skill').find(r =>
          (S.G[r.p.id] || 0) >= (st().provisional || 0) && (idleDays(r.p.id) == null || idleDays(r.p.id) < 30));
        const id = target.p.id;
        const idle = idleDays(target.p.id);
        const oldR = S.tracks.skill.R[id], oldCap = S.cap && S.cap.skill ? S.cap.skill[id] : undefined;
        S.tracks.skill.R[id] = 99999;
        if (S.cap && S.cap.skill) S.cap.skill[id] = 99999;
        viewRank();
        const h = document.querySelector('#view').innerHTML || '';
        const allNoticeOk = h.includes('id="rkFrozenNotice"')
          && h.includes('id="rkFrozenToggle"')
          && h.includes('목록 보기')
          && h.includes('동결 포함 순위');
        S.period = monthOfNow();
        viewRank();
        const hn = document.querySelector('#view').innerHTML || '';
        const noticeOk = hn.includes('id="rkFrozenNotice"')
          && hn.includes('현재 통산 동결')
          && hn.includes(target.p.name);
        S.period = 'all';
        const firstPid = (h.match(/data-pid="([^"]+)"/) || [])[1];
        const marker = \`data-pid="\${id}"\`;
        const pos = h.indexOf(marker);
        const open = pos >= 0 ? h.lastIndexOf('<button class="rk ', pos) : -1;
        const close = open >= 0 ? h.indexOf('>', open) : -1;
        const cls = open >= 0 && close >= 0 ? h.slice(open, close) : '';
        S.showFrozenRank = true;
        S.period = 'all';
        viewRank();
        const hi = document.querySelector('#view').innerHTML || '';
        const ipos = hi.indexOf(marker);
        const iopen = ipos >= 0 ? hi.lastIndexOf('<button class="rk ', ipos) : -1;
        const iclose = iopen >= 0 ? hi.indexOf('>', iopen) : -1;
        const icls = iopen >= 0 && iclose >= 0 ? hi.slice(iopen, iclose) : '';
        const includeOk = hi.includes('id="rkFrozenToggle"')
          && hi.includes('checked')
          && icls.includes('frozen')
          && !icls.includes('unranked')
          && hi.includes('동결 포함 · 마지막 경기 ' + idle + '일 전');
        S.showFrozenRank = false;
        let seasonOk = true;
        const lastMonth = (S.LAST[id] || '').slice(0, 7);
        if (lastMonth && seasons().includes(lastMonth)) {
          S.period = lastMonth;
          viewRank();
          const hs = document.querySelector('#view').innerHTML || '';
          seasonOk = hs.includes(marker) && !hs.includes('랭킹 동결 ·');
          S.period = 'all';
        }
        if (oldR === undefined) delete S.tracks.skill.R[id]; else S.tracks.skill.R[id] = oldR;
        if (S.cap && S.cap.skill) {
          if (oldCap === undefined) delete S.cap.skill[id]; else S.cap.skill[id] = oldCap;
        }
        return h.includes('frozen')
          && h.includes('랭킹 동결 · ' + idle + '일')
          && h.includes('점수상 1위')
          && h.includes('랭킹 동결로 순위 제외')
          && h.includes('마지막 경기 ' + idle + '일 전')
          && noticeOk
          && allNoticeOk
          && includeOk
          && cls.includes('unranked')
          && cls.includes('frozen')
          && !/\\bmd[123]\\b/.test(cls)
          && (!active || firstPid !== id)
          && seasonOk
          && !h.includes('opacity:.5');
      } finally {
        S.lg = oldLg; S.tab = oldTab; S.period = oldPeriod; S.mode = oldMode; S.bu = oldBu; S.rq = oldRq; S.showFrozenRank = oldShow;
        recompute(); render();
      }
    })()
  `);
  if (!frozenRankOk) failed++;
  console.log(`${frozenRankOk ? "✅" : "❌"} 랭킹 장기 미출석 얼음 표시`);

  const deltaSyncOk = await app.eval(`
    (async () => {
      const oldFB = FB, oldMatches = S.matches.slice(), oldSync = localGet(SYNC_KEY);
      try {
        const a = S.players[0].id, b = S.players[1].id;
        const kept = {id:'sync_keep', date:'2026-08-01', aId:a, bId:b, winnerId:a, aSets:2, bSets:0,
          confirmedBy:[a,b], status:'confirmed', enteredAt:'2026-08-01T00:00:00.000Z'};
        const del = {...kept, id:'sync_del'};
        const add = {...kept, id:'sync_add', winnerId:b, aSets:0, bSets:2, rev:2};
        S.matches = [kept, del];
        recompute();
        localSet(SYNC_KEY, {lastKey:'0001'});
        FB = {
          get: async p => p === 'meta' ? S.meta : p === 'players' ? S.players
            : p === FBM + '/sync_add' ? add : null,
          changesAfter: async key => [
            {key:'0002', id:'sync_del', op:'del'},
            {key:'0003', id:'sync_add', op:'set'}
          ].filter(x => x.key > key)
        };
        const ok = await loadDelta();
        const ids = S.matches.map(m => m.id).sort();
        const sync = localGet(SYNC_KEY);
        return ok && ids.includes('sync_keep') && ids.includes('sync_add') && !ids.includes('sync_del')
          && sync && sync.lastKey === '0003';
      } finally {
        FB = oldFB;
        S.matches = oldMatches;
        if(oldSync) localSet(SYNC_KEY, oldSync); else localDel(SYNC_KEY);
        recompute();
      }
    })()
  `);
  if (!deltaSyncOk) failed++;
  console.log(`${deltaSyncOk ? "✅" : "❌"} Firebase 변경분 동기화`);

  const yearlySeasonOk = app.eval(`
    (() => {
      const oldLg = S.lg, oldTab = S.tab, oldPeriod = S.period;
      try {
        const regular = ['all', ...leagues().filter(x => !x.cup).map(x => x.id)]
          .find(lg => yearSeasons(lg).length && monthSeasons(lg).length);
        if (!regular) return true;
        S.lg = regular;
        S.tab = 'rank';
        S.period = 'all';
        recompute();
        viewRank();
        const h0 = document.querySelector('#view').innerHTML || '';
        const y = latestYearSeason(regular);
        const m = latestMonthSeason(regular);
        if (!h0.includes('data-per="' + y + '"') || !h0.includes('data-per="' + m + '"')) return false;
        S.period = y;
        viewRank();
        const hy = document.querySelector('#view').innerHTML || '';
        S.period = m;
        viewRank();
        const hm = document.querySelector('#view').innerHTML || '';
        const yr = standings(y, 'skill').filter(r => r.g > 0).reduce((n, r) => n + r.g, 0);
        const mr = standings(m, 'skill').filter(r => r.g > 0).reduce((n, r) => n + r.g, 0);
        return seasons(regular).includes(y)
          && seasons(regular).includes(m)
          && hy.includes(seasonLabel(y) + ' 시즌')
          && hy.includes('data-per="' + m + '"')
          && hm.includes('id="rankMonthSel"')
          && hm.includes('class="selectbox center"')
          && hm.includes('<option value="' + m + '" selected>')
          && yr >= mr;
      } finally {
        S.lg = oldLg; S.tab = oldTab; S.period = oldPeriod; recompute(); render();
      }
    })()
  `);
  if (!yearlySeasonOk) failed++;
  console.log(`${yearlySeasonOk ? "✅" : "❌"} 날짜형 리그 연도 시즌 렌더링`);

  const homeLogoOk = app.eval(`
    (() => {
      const oldTab = S.tab, oldLast = _lastTab;
      try {
        S.tab = 'stat';
        _lastTab = 'stat';
        goRankHome();
        const h = document.querySelector('#view').innerHTML || '';
        return S.tab === 'rank' && h.includes('<h2>랭킹</h2>');
      } finally {
        S.tab = oldTab; _lastTab = oldLast; render();
      }
    })()
  `);
  if (!homeLogoOk) failed++;
  console.log(`${homeLogoOk ? "✅" : "❌"} 상단 로고 클릭 랭킹 이동`);

  const bracketCalcOk = app.eval(`
    (() => {
      const ids = S.players.slice(0, 16).map(p => p.id);
      const brk = blankBracket();
      ids.forEach((id, i) => brk.main[i] = id);
      brk.low = [ids[13], ids[14], ids[15], ids[11]];
      [0,2,4,6,8,10,12,14].forEach((idx, k) => brk.win['m16_' + k] = ids[idx]);
      [0,4,8,12].forEach((idx, k) => brk.win['mq_' + k] = ids[idx]);
      [0,8].forEach((idx, k) => brk.win['ms_' + k] = ids[idx]);
      brk.win.mf_0 = ids[0];
      brk.win.l4_0 = ids[13];
      brk.win.l4_1 = ids[15];
      brk.win.lf_0 = ids[15];
      const bd = bracketData(brk);
      const rd = roundOf('2026-08-14', 'quickmeet');
      const order = roundStanding('quickmeet', rd, [
        {id:'s1', lg:'quickmeet', date:'2026-08-14', aId:ids[0], bId:ids[4], winnerId:ids[0], br:{kind:'semi', bracket:'main', order:13}},
        {id:'s2', lg:'quickmeet', date:'2026-08-14', aId:ids[8], bId:ids[12], winnerId:ids[8], br:{kind:'semi', bracket:'main', order:14}},
        {id:'f1', lg:'quickmeet', date:'2026-08-14', aId:ids[0], bId:ids[8], winnerId:ids[0], br:{kind:'final', bracket:'main', order:15}},
        {id:'l1', lg:'quickmeet', date:'2026-08-14', aId:ids[15], bId:ids[13], winnerId:ids[15], br:{kind:'lowfinal', bracket:'low', order:103}}
      ], P);
      return bd.r16[0].a === ids[0] && bd.r16[0].b === ids[1]
        && bd.summary.first === ids[0] && bd.summary.second === ids[8]
        && bd.summary.thirds[0] === ids[4] && bd.summary.thirds[1] === ids[12]
        && bd.summary.lowFirst === ids[15]
        && JSON.stringify(order.slice(0, 5)) === JSON.stringify([ids[0], ids[8], ids[4], ids[12], ids[15]]);
    })()
  `);
  if (!bracketCalcOk) failed++;
  console.log(`${bracketCalcOk ? "✅" : "❌"} 빨리모이 16강·하위4강 브래킷 순위 계산`);

  const bracketUiOk = app.eval(`
    (() => {
      const r = parseRoster(${JSON.stringify(rosterText)}, 'quickmeet');
      const rd = roundOf('2026-08-14', 'quickmeet');
      gridE = {lg:'quickmeet', date:'2026-08-14', _rd:rd, ids:r.list.map(x=>x.id),
        grp:{}, tbu:{}, hb:{}, res:{}, q:'', step:'grid', tab:'BR', rfmt:'leagueko',
        br:[], brk:blankBracket()};
      r.list.forEach(x => gridE.grp[x.id] = x.g);
      viewAddGrid('quickmeet');
      const h = document.querySelector('#view').innerHTML || '';
      return h.includes('data-bslot="main|0"') && h.includes('id="gBrOrder"') && h.includes('하위 4강')
        && !h.includes('<summary>표 붙여넣기</summary>');
    })()
  `);
  if (!bracketUiOk) failed++;
  console.log(`${bracketUiOk ? "✅" : "❌"} 빨리모이 브래킷 입력 UI 렌더링`);

  const addRoundSelectOk = app.eval(`
    (() => {
      const oldGrid = gridE, oldTab = S.tab, oldAdd = S.addLg;
      try {
        const date = '2026-08-14', rd = roundOf(date, 'quickmeet');
        gridE = {lg:'quickmeet', date, _rd:rd, ids:[], grp:{}, tbu:{}, hb:{},
          res:{}, q:'', step:'who', tab:'A', rfmt:'leagueko', br:[], brk:blankBracket(), sets:{x:'stale'}, wins:{x:'stale'}};
        S.tab = 'add'; S.addLg = 'quickmeet';
        viewAddGrid('quickmeet');
        const h = document.querySelector('#view').innerHTML || '';
        const sel = document.querySelector('#gRdSel');
        const before = gridE.date;
        const next = Array.from(h.matchAll(/<option value="([^"]+)"/g)).map(m => m[1]).find(v => v && v !== before);
        if (!h.includes('id="gRdSel" class="selectbox center"') || h.includes('rdselect') || h.includes('id="gRdPick"') || !sel || !next) return false;
        if (h.includes('<summary>표 붙여넣기</summary>') || !h.includes('<summary>명단 붙여넣기</summary>')) return false;
        if (!h.includes('placeholder="A조: 김민수, 이지훈') || !h.includes('B조: 박민재')) return false;
        if (!h.includes('data-gsort="freq"') || !h.includes('참여 많은 순')) return false;
        gridE.sets = {x:'stale'};
        gridE.wins = {x:'stale'};
        sel.value = next;
        sel.onchange();
        return gridE.date === next && roundOf(gridE.date, 'quickmeet') === roundOf(next, 'quickmeet')
          && Object.keys(gridE.sets || {}).length === 0
          && Object.keys(gridE.wins || {}).length === 0;
      } finally {
        gridE = oldGrid; S.tab = oldTab; S.addLg = oldAdd; render();
      }
    })()
  `);
  if (!addRoundSelectOk) failed++;
  console.log(`${addRoundSelectOk ? "✅" : "❌"} 경기 입력 회차 드롭다운 렌더링·선택`);

  const cupWeekdayOk = app.eval(`
    (() => {
      const old = S.meta.settings.leagues;
      try {
        S.meta.settings.leagues = [...old,
          {id:'rookie_tmp', name:'루키리그', cup:true, fmt:'groupko'},
          {id:'jeom_tmp', name:'점사모', cup:true, fmt:'league'}];
        return weekDateOf('2026-08-08', 'quickmeet') === '2026-08-04'
          && weekDateOf('2026-08-08', 'rookie_tmp') === '2026-08-06'
          && weekDateOf('2026-08-08', 'jeom_tmp') === '2026-08-07'
          && roundOf(weekDateOf('2026-08-08', 'rookie_tmp'), 'rookie_tmp') === roundOf('2026-08-08', 'rookie_tmp');
      } finally {
        S.meta.settings.leagues = old;
      }
    })()
  `);
  if (!cupWeekdayOk) failed++;
  console.log(`${cupWeekdayOk ? "✅" : "❌"} 대회형 리그별 운영 요일 계산`);

  const gridPasteVisibilityOk = app.eval(`
    (() => {
      const old = S.meta.settings.leagues;
      try {
        S.meta.settings.leagues = [...old,
          {id:'super_tmp', name:'슈퍼리그', cup:true, fmt:'league'},
          {id:'rookie_tmp', name:'루키리그', cup:true, fmt:'leagueko'}];
        return gridTablePasteEnabled('lgmsplh4km')
          && !gridTablePasteEnabled('quickmeet')
          && !gridTablePasteEnabled('super_tmp')
          && !gridTablePasteEnabled('rookie_tmp');
      } finally {
        S.meta.settings.leagues = old;
      }
    })()
  `);
  if (!gridPasteVisibilityOk) failed++;
  console.log(`${gridPasteVisibilityOk ? "✅" : "❌"} 표 붙여넣기 리그별 표시 제한`);

  const gridParticipantSortOk = app.eval(`
    (() => {
      const oldGrid = gridE;
      try {
        const lg = 'lgmsplh4km';
        const rows = S.players.filter(p => lgEligible(lg,p))
          .map(p => ({p, n:gridParticipantCount(lg,p.id)}));
        const hot = rows.filter(x => x.n > 0).sort((a,b)=>b.n-a.n)[0];
        const cold = rows.find(x => x.n === 0);
        if(!hot || !cold) return true;
        gridE = {lg, date:'2026-08-14', ids:[], grp:{}, tbu:{}, hb:{}, res:{}, q:'', step:'who', tab:'A', gsort:'freq'};
        const h = gridWhoListHTML([cold.p, hot.p], lg);
        return h.includes('기존 참여 많은 순')
          && h.includes(hot.n + '회')
          && h.indexOf(hot.p.name) < h.indexOf(cold.p.name);
      } finally {
        gridE = oldGrid;
      }
    })()
  `);
  if (!gridParticipantSortOk) failed++;
  console.log(`${gridParticipantSortOk ? "✅" : "❌"} 대회형 참가자 참여 많은 순 정렬`);

  const bracketAnalysisOk = app.eval(`
    (() => {
      const oldMatches = S.matches.slice();
      const oldRounds = {...((S.meta && S.meta.rounds) || {})};
      const oldLg = S.lg, oldTab = S.tab, oldStat = S.statTab, oldClubTab = clubTab, oldCupLg = cupLg, oldCupRd = cupRd;
      try {
        const ids = S.players.slice(0, 8).map(p => p.id);
        const date = '2026-08-14', rd = roundOf(date, 'quickmeet');
        const brk = blankBracket();
        ids.forEach((id, i) => brk.main[i] = id);
        brk.low = [ids[4], ids[5], ids[6], ids[7]];
        brk.win = {m16_0:ids[0], m16_1:ids[2], m16_2:ids[4], m16_3:ids[6],
          mq_0:ids[0], mq_1:ids[4], ms_0:ids[0], l4_0:ids[4], l4_1:ids[6], lf_0:ids[6]};
        const grp = {};
        ids.forEach((id, i) => grp[id] = i < 4 ? 'A' : 'B');
        S.meta.rounds = {...oldRounds, [rdKey('quickmeet', rd)]:{fmt:'leagueko', ord:ids, grp, brk}};
        const mk = (id, node, kind, order, a, b, w, bracket='main') => ({
          id, lg:'quickmeet', date, aId:a, bId:b, winnerId:w,
          aSets:w===a?2:0, bSets:w===b?2:0,
          br:{node, kind, bracket, order, label:brKindName(kind)}, void:false
        });
        S.matches = oldMatches.concat([
          mk('tb1','m16_0','round16',1,ids[0],ids[1],ids[0]),
          mk('tb2','m16_1','round16',2,ids[2],ids[3],ids[2]),
          mk('tb3','m16_2','round16',3,ids[4],ids[5],ids[4]),
          mk('tb4','m16_3','round16',4,ids[6],ids[7],ids[6]),
          mk('tb5','mq_0','quarter',9,ids[0],ids[2],ids[0]),
          mk('tb6','mq_1','quarter',10,ids[4],ids[6],ids[4]),
          mk('tb7','ms_0','semi',13,ids[0],ids[4],ids[0]),
          mk('tb8','l4_0','lowsemi',101,ids[4],ids[5],ids[4],'low'),
          mk('tb9','l4_1','lowsemi',102,ids[6],ids[7],ids[6],'low'),
          mk('tb10','lf_0','lowfinal',103,ids[4],ids[6],ids[6],'low')
        ]);
        recompute();
        S.lg = 'quickmeet'; S.tab = 'stat'; S.statTab = 'club'; clubTab = 'round'; cupLg = 'quickmeet'; cupRd = rd;
        clubSheet(document.querySelector('#statBox'));
        const h = document.querySelector('#statBox').innerHTML || '';
        const ok1 = h.includes('조 순위') && !h.includes('A조 순위')
          && h.includes('cupbrx') && h.includes('하위 4강') && h.includes('cupbr-p win') && h.includes('cupres')
          && !h.includes('data-clg=');
        S.meta.rounds = {...oldRounds, [rdKey('quickmeet', rd)]:{fmt:'leagueko', ord:ids.slice(0,2), grp:{}}};
        S.matches = oldMatches.concat([mk('tf1','mf_0','final',15,ids[0],ids[1],ids[0])]);
        recompute(); clubSheet(document.querySelector('#statBox'));
        const h2 = document.querySelector('#statBox').innerHTML || '';
        const ok2 = h2.includes('cupbr-p win') && h2.includes(nameOf(ids[0])) && h2.includes('최종 순위');
        return ok1 && ok2;
      } finally {
        S.matches = oldMatches;
        S.meta.rounds = oldRounds;
        S.lg = oldLg; S.tab = oldTab; S.statTab = oldStat; clubTab = oldClubTab; cupLg = oldCupLg; cupRd = oldCupRd;
        recompute();
      }
    })()
  `);
  if (!bracketAnalysisOk) failed++;
  console.log(`${bracketAnalysisOk ? "✅" : "❌"} 빨리모이 분석 탭 조 순위·브래킷 렌더링`);

  const quickmeetTitleOk = app.eval(`
    (() => {
      const oldMatches = S.matches.slice();
      const oldRounds = {...((S.meta && S.meta.rounds) || {})};
      const oldLg = S.lg, oldTab = S.tab, oldPeriod = S.period;
      try {
        const ids = S.players.slice(0, 8).map(p => p.id);
        const date = '2026-08-14', rd = roundOf(date, 'quickmeet');
        const brk = blankBracket();
        ids.forEach((id, i) => brk.main[i] = id);
        const grp = {};
        ids.forEach((id, i) => grp[id] = i < 4 ? 'A' : 'B');
        S.meta.rounds = {...oldRounds, [rdKey('quickmeet', rd)]:{fmt:'leagueko', ord:ids, grp, brk}};
        const gm = (id, a, b, w) => ({
          id, lg:'quickmeet', date, aId:a, bId:b, winnerId:w,
          aSets:w===a?2:0, bSets:w===b?2:0, void:false
        });
        const mk = (id, node, kind, order, a, b, w, bracket='main') => ({
          id, lg:'quickmeet', date, aId:a, bId:b, winnerId:w,
          aSets:w===a?2:0, bSets:w===b?2:0,
          br:{node, kind, bracket, order, label:brKindName(kind)}, void:false
        });
        S.matches = oldMatches.filter(m => lgOf(m) !== 'quickmeet').concat([
          gm('qg1',ids[0],ids[1],ids[0]), gm('qg2',ids[0],ids[2],ids[0]), gm('qg3',ids[0],ids[3],ids[0]),
          gm('qg4',ids[1],ids[2],ids[1]), gm('qg5',ids[1],ids[3],ids[1]), gm('qg6',ids[2],ids[3],ids[2]),
          gm('qg7',ids[4],ids[5],ids[4]), gm('qg8',ids[4],ids[6],ids[4]), gm('qg9',ids[4],ids[7],ids[4]),
          gm('qg10',ids[5],ids[6],ids[5]), gm('qg11',ids[5],ids[7],ids[5]), gm('qg12',ids[6],ids[7],ids[6]),
          mk('qt1','m16_0','round16',1,ids[0],ids[7],ids[0]),
          mk('qt2','m16_1','round16',2,ids[2],ids[5],ids[2]),
          mk('qt3','m16_2','round16',3,ids[4],ids[1],ids[4]),
          mk('qt4','m16_3','round16',4,ids[6],ids[3],ids[6]),
          mk('qt5','mq_0','quarter',9,ids[0],ids[2],ids[2]),
          mk('qt6','mq_1','quarter',10,ids[4],ids[6],ids[6]),
          mk('qt7','ms_0','semi',13,ids[2],ids[6],ids[2]),
          mk('qt8','mf_0','final',15,ids[2],ids[6],ids[2])
        ]);
        recompute();
        S.lg = 'quickmeet'; S.tab = 'rank'; S.period = '2026';
        const t = playerTitles('2026', 'skill');
        const has = (pid) => (t[pid] || []).some(x => titleKey(x[0]) === '토너먼트체질');
        return has(ids[2]) && !has(ids[0]) && !has(ids[6]);
      } finally {
        S.matches = oldMatches;
        S.meta.rounds = oldRounds;
        S.lg = oldLg; S.tab = oldTab; S.period = oldPeriod;
        recompute();
      }
    })()
  `);
  if (!quickmeetTitleOk) failed++;
  console.log(`${quickmeetTitleOk ? "✅" : "❌"} 빨리모이 조별 대비 토너먼트체질 칭호`);

  const addDraftResetOk = app.eval(`
    (() => {
      const oldMatches = S.matches.slice();
      const oldRounds = {...((S.meta && S.meta.rounds) || {})};
      const oldGrid = gridE, oldBulk = bulk, oldTab = S.tab, oldLast = _lastTab, oldAdd = S.addLg;
      const oldHide = localGet('tt:hideSavedRoundNotice');
      try {
        localDel('tt:hideSavedRoundNotice');
        const ids = S.players.slice(0, 4).map(p => p.id);
        const date = '2026-08-14', rd = roundOf(date, 'quickmeet');
        gridE = {lg:'quickmeet', date, _rd:rd, ids:ids.slice(), grp:{}, tbu:{}, hb:{},
          res:{}, q:'홍', step:'grid', tab:'A', rfmt:'leagueko', br:[], brk:blankBracket(),
          paste:'A조 @홍길동', sets:{}};
        bulk = {date, meId:ids[0], picks:{[ids[1]]:{r:'W', n:1}}, q:'홍'};
        S.tab = 'rank'; _lastTab = 'add'; render();
        const leftCleared = gridE === null && bulk === null;

        S.meta.rounds = {...oldRounds, [rdKey('quickmeet', rd)]:{
          fmt:'leagueko', ord:ids, grp:{[ids[0]]:'A', [ids[1]]:'A', [ids[2]]:'B', [ids[3]]:'B'}, brk:blankBracket()
        }};
        S.tab = 'add'; S.addLg = 'quickmeet'; _lastTab = 'rank'; render();
        const h = document.querySelector('#view').innerHTML || '';
        const fresh = gridE && gridE.ids.length === 0 && h.includes('id="gLoadSaved"') && h.includes('id="gHideSavedNotice"');
        const hide = document.querySelector('#gHideSavedNotice');
        if(hide && hide.onclick) hide.onclick();
        const hidden = !((document.querySelector('#view').innerHTML || '').includes('id="gLoadSaved"'));
        localDel('tt:hideSavedRoundNotice');
        gridE.loadSaved=false; gridE._rd=null; viewAddGrid('quickmeet');
        const btn = document.querySelector('#gLoadSaved');
        if(btn && btn.onclick) btn.onclick();
        const loaded = gridE && gridE.ids.length === ids.length && gridE.grp[ids[2]] === 'B';
        return leftCleared && fresh && hidden && loaded;
      } finally {
        S.matches = oldMatches;
        S.meta.rounds = oldRounds;
        gridE = oldGrid; bulk = oldBulk; S.tab = oldTab; _lastTab = oldLast; S.addLg = oldAdd;
        if(oldHide) localSet('tt:hideSavedRoundNotice', oldHide); else localDel('tt:hideSavedRoundNotice');
        recompute(); render();
      }
    })()
  `);
  if (!addDraftResetOk) failed++;
  console.log(`${addDraftResetOk ? "✅" : "❌"} 경기 입력 임시 상태 초기화·수동 불러오기`);

  const gridSavedEditOk = app.eval(`
    (() => {
      const oldMatches = S.matches, oldRounds = S.meta.rounds, oldGrid = gridE;
      const oldTab = S.tab, oldAdd = S.addLg, oldLg = S.lg;
      try {
        const ids = S.players.slice(0, 6).map(p => p.id);
        const date = '2026-08-04', rd = roundOf(date, 'quickmeet');
        const brk = blankBracket();
        brk.main[0] = ids[0]; brk.main[1] = ids[1]; brk.win.m16_0 = ids[0];
        S.meta.rounds = {...(oldRounds || {}), [rdKey('quickmeet', rd)]: {
          fmt: 'leagueko',
          ord: ids.slice(0, 4),
          grp: {[ids[0]]:'A', [ids[1]]:'A', [ids[2]]:'A', [ids[3]]:'A'},
          brk
        }};
        S.matches = [
          {id:'ge1', lg:'quickmeet', date, rd, aId:ids[0], bId:ids[1], winnerId:ids[0],
            aSets:2, bSets:1, status:'confirmed', confirmedBy:[ids[0],ids[1]], void:false},
          {id:'ge2', lg:'quickmeet', date, rd, aId:ids[0], bId:ids[3], winnerId:ids[3],
            status:'confirmed', confirmedBy:[ids[0],ids[3]], void:false},
          {id:'geb1', lg:'quickmeet', date, rd, aId:ids[0], bId:ids[1], winnerId:ids[0],
            br:{node:'m16_0', kind:'round16', bracket:'main', order:1},
            status:'confirmed', confirmedBy:[ids[0],ids[1]], void:false}
        ];
        gridE = {lg:'quickmeet', date, ids:[], grp:{}, tbu:{}, hb:{}, res:{}, q:'',
          step:'grid', tab:'A', rfmt:null, br:[], brk:blankBracket(), sets:{}, wins:{},
          editSaved:true, loadSaved:true};
        viewAddGrid('quickmeet');
        const h = document.querySelector('#view').innerHTML || '';
        const gk = (a,b) => a < b ? a + '|' + b : b + '|' + a;
        const loadedScore = gridE.sets[gk(ids[0], ids[1])][ids[0]] === 2
          && gridE.sets[gk(ids[0], ids[1])][ids[1]] === 1;
        const winnerOnlyKept = gridE.wins[gk(ids[0], ids[3])] === ids[3]
          && gridE.sets[gk(ids[0], ids[3])] == null;
        gridE.step = 'who';
        viewAddGrid('quickmeet');
        const hasReplacePanel = (document.querySelector('#view').innerHTML || '').includes('data-greplace=');
        const replacement = ids[4];
        gridReplacePlayer(ids[0], replacement);
        const movedScore = gridE.sets[gk(replacement, ids[1])][replacement] === 2
          && gridE.sets[gk(replacement, ids[1])][ids[1]] === 1;
        const movedWin = gridE.wins[gk(replacement, ids[3])] === ids[3]
          && gridE.sets[gk(replacement, ids[3])] == null;
        const movedBracket = gridE.brk.main[0] === replacement && gridE.brk.win.m16_0 === replacement;
        const rows = gridRowsFromList('quickmeet', rd, [
          {a:replacement, b:ids[1], w:replacement, sa:2, sb:0},
          {a:replacement, b:ids[3], w:ids[3], sa:null, sb:null}
        ]);
        const noSetRow = rows.find(x => x.aId === replacement && x.bId === ids[3]);
        const bracketNull = bracketData(gridE.brk).matches.some(x =>
          x.br && x.br.node === 'm16_0' && x.sa == null && x.sb == null);
        return loadedScore && winnerOnlyKept && hasReplacePanel
          && movedScore && movedWin && movedBracket && bracketNull
          && rows.length === 2 && rows[0].winnerId === replacement
          && noSetRow && noSetRow.aSets == null && noSetRow.bSets == null;
      } finally {
        S.matches = oldMatches; S.meta.rounds = oldRounds; gridE = oldGrid;
        S.tab = oldTab; S.addLg = oldAdd; S.lg = oldLg;
        recompute(); render();
      }
    })()
  `);
  if (!gridSavedEditOk) failed++;
  console.log(`${gridSavedEditOk ? "✅" : "❌"} 저장된 회차 수정 모드 세트·승자·참가자 교체`);
  const meAlwaysAllOk = app.eval(`
    (() => {
      const oldLg = S.lg, oldTab = S.tab, oldMe = S.me, oldPv = S.pvTab, oldMeLg = S.meLg;
      try {
        const ids = leagues().map(x => x.id);
        const playedOf = p => new Set(S.matches
          .filter(m => !m.void && (m.aId === p.id || m.bId === p.id))
          .map(lgOf));
        const target = S.players.find(p => {
          const played = playedOf(p);
          return played.size > 0 && played.size < ids.length;
        }) || S.players.find(p => playedOf(p).size > 0) || S.players[0];
        const played = [...playedOf(target)];
        const omitted = ids.find(x => !played.includes(x));
        const startLg = omitted || (ids.includes('quickmeet') ? 'quickmeet' : (ids[0] || 'all'));
        const pickLg = played[0] || 'all';
        S.me = target;
        S.lg = startLg;
        S.meLg = omitted || '없는리그';
        S.tab = 'me';
        S.pvTab = 'season';
        recompute();
        render();
        const h = document.querySelector('#view').innerHTML || '';
        const sel = document.querySelector('#meLgScope');
        if (sel) {
          sel.value = pickLg;
          sel.onchange({target: sel});
        }
        const h2 = document.querySelector('#view').innerHTML || '';
        return S.lg === startLg
          && S.meLg === pickLg
          && h.includes('내 정보')
          && h.includes('통산 기록')
          && h.includes('리그별 내 성적')
          && h.includes('lgstat-grid')
          && !h.includes('ctb lgr')
          && h.includes('상세 분석 범위')
          && h.includes('id="meLgScope" class="selectbox compact me-scope"')
          && h.includes('시즌별·최근 추이·상대 분석·경기 기록')
          && (!omitted || !h.includes(\`<option value="\${omitted}"\`))
          && !h2.includes(lgName(pickLg) + ' 통산')
          && h2.includes(\`value="\${pickLg}" selected\`);
      } finally {
        S.lg = oldLg; S.tab = oldTab; S.me = oldMe; S.pvTab = oldPv; S.meLg = oldMeLg;
        recompute(); render();
      }
    })()
  `);
  if (!meAlwaysAllOk) failed++;
  console.log(`${meAlwaysAllOk ? "✅" : "❌"} 내정보 통합 기준·상세 분석 리그 선택`);

  const logLeagueScopeOk = app.eval(`
    (() => {
      const oldLg = S.lg, oldTab = S.tab, oldDay = viewLog.day, oldMonth = viewLog.month;
      const oldRd = viewLog.rd, oldInit = viewLog.init;
      try {
        const cup = leagues().find(x => x.cup && S.matches.some(m => !m.void && lgOf(m) === x.id));
        const regular = leagues().find(x => !x.cup && S.matches.some(m => !m.void && lgOf(m) === x.id));
        if (!cup || !regular) return true;
        S.tab = 'log';
        S.lg = 'all';
        viewLog.day = '1900-01-01';
        viewLog.month = '1900-01';
        viewLog.rd = '없는회차';
        viewLog.init = 1;
        recompute();
        render();
        const allHtml = document.querySelector('#view').innerHTML || '';
        if (!allHtml.includes(\`data-lg="\${cup.id}"\`) || !allHtml.includes(\`data-lg="\${regular.id}"\`)) return false;

        chooseLeague(cup.id);
        const cupHtml = document.querySelector('#view').innerHTML || '';
        const cupOk = S.lg === cup.id
          && cupHtml.includes('data-lrdsel')
          && cupHtml.includes('class="selectbox center"')
          && viewLog.day == null
          && viewLog.month == null
          && viewLog.rd;

        viewLog.day = '1900-01-01';
        viewLog.month = '1900-01';
        viewLog.rd = '없는회차';
        viewLog.init = 1;
        chooseLeague(regular.id);
        const regDays = [...new Set(S.matches
          .filter(m => !m.void && lgOf(m) === regular.id)
          .map(m => m.date))].sort();
        const regHtml = document.querySelector('#view').innerHTML || '';
        return cupOk
          && S.lg === regular.id
          && (!viewLog.day || regDays.includes(viewLog.day))
          && regHtml.includes('달력에서 날짜 고르기');
      } finally {
        S.lg = oldLg; S.tab = oldTab; viewLog.day = oldDay; viewLog.month = oldMonth; viewLog.rd = oldRd;
        if (oldInit === undefined) delete viewLog.init; else viewLog.init = oldInit;
        recompute(); render();
      }
    })()
  `);
  if (!logLeagueScopeOk) failed++;
  console.log(`${logLeagueScopeOk ? "✅" : "❌"} 경기기록 리그 전환·날짜 범위`);

  const visitStatsOk = await app.eval(`
    (async () => {
      const oldVisits = await sGet(KEY.visits);
      const oldMe = S.me, oldTab = S.tab, oldAllow = S._allowVisitTrack;
      try {
        S._allowVisitTrack = true;
        S.ready = true;
        S.me = S.players[0];
        S.tab = 'rank';
        await trackVisit(true);
        S.tab = 'stat';
        await trackVisit(true);
        const v = await sGet(KEY.visits);
        const d = v && v.daily && v.daily[today()];
        const visitors = d && d.visitors || {};
        const rows = Object.values(visitors);
        const member = v && v.members && v.members[S.players[0].id];
        const html = visitStatsHTML(v);
        return rows.some(r => r.tabs && r.tabs.rank && r.tabs.stat)
          && member && member.lastSeenAt
          && html.includes('방문 통계') && html.includes('IP, 기기 정보');
      } finally {
        if (oldVisits) await sSet(KEY.visits, oldVisits);
        else await sDel(KEY.visits);
        S.me = oldMe; S.tab = oldTab; S._allowVisitTrack = oldAllow;
      }
    })()
  `);
  if (!visitStatsOk) failed++;
  console.log(`${visitStatsOk ? "✅" : "❌"} 방문 통계 저장·관리자 표시`);

  const freezeOk = await app.eval(`
    (async () => {
      const oldMatches = S.matches.map(m => ({...m}));
      const oldBusy = S.busy, oldTab = S.tab, oldAdm = S.admTab, oldInfo = S.freezeInfo;
      try {
        const ids = S.matches.filter(m => !m.void && P(m.aId) && P(m.bId)).slice(0, 3).map(m => m.id);
        S.matches = S.matches.map(m => ids.includes(m.id)
          ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'exp'))
          : m);
        recompute();
        S.tab = 'admin'; S.admTab = 'rating'; render();
        await doFreeze(false);
        const fixed = ids.every(id => {
          const m = S.matches.find(x => x.id === id);
          return m && m.exp != null;
        });
        const h = document.querySelector('#view').innerHTML || '';
        return fixed && S.freezeInfo && S.freezeInfo.title.includes('완료')
          && h.includes('예상 승률 고정 완료');
      } finally {
        S.matches = oldMatches;
        S.busy = oldBusy; S.tab = oldTab; S.admTab = oldAdm; S.freezeInfo = oldInfo;
        recompute();
      }
    })()
  `);
  if (!freezeOk) failed++;
  console.log(`${freezeOk ? "✅" : "❌"} 예상 승률 시간순 고정 동작·상태 표시`);

  /* 승급 이력 — 발효일 이전엔 승급 전 부수, 이후엔 현재 부수. 승급 여정 카드 렌더 */
  const buHistOk = app.eval(`
    (() => {
      const p = S.players.find(x => (S.G[x.id] || 0) > 0) || S.players[0];
      const old = p.buHist;
      try {
        p.buHist = [{ date: '2026-04-16', ev: '2026-04-15', from: p.bu + 1, bu: p.bu, via: '루키리그 승급전' }];
        const before = buOnDate(p.id, '2026-03-01');
        const after = buOnDate(p.id, '2026-05-01');
        const html = buHistHTML(p.id);
        return before === p.bu + 1 && after === p.bu
          && html.includes('승급 여정') && html.includes('루키리그 승급전')
          && html.includes((p.bu + 1) + '→' + p.bu);
      } finally { if (old) p.buHist = old; else delete p.buHist; }
    })()
  `);
  if (!buHistOk) failed++;
  console.log(`${buHistOk ? "✅" : "❌"} 승급 이력(buHist) 시점 부수·승급 여정 카드`);

  /* 분석 이변 → 그 경기 날짜의 기록 화면으로 점프 */
  const gomaOk = app.eval(`
    (() => {
      const oldLg = S.lg, oldTab = S.tab, oldStatTab = S.statTab, oldCt = clubTab, oldPer = clubPer;
      const oldDay = viewLog.day, oldMonth = viewLog.month, oldF = viewLog.filter, oldInit = viewLog.init;
      try {
        S.lg = 'all'; S.tab = 'stat'; S.statTab = 'club'; clubTab = 'month'; clubPer = 'all';
        recompute(); render();
        const h = document.querySelector('#statBox').innerHTML || '';
        const mid = (h.match(/data-goma="([^"]+)"/) || [])[1];
        if (!mid) return true;              // 픽스처에 이변이 없으면 통과
        const m = S.matches.find(x => x.id === mid);
        gotoMatch(mid);
        const hl = document.querySelector('#view').innerHTML || '';
        return S.tab === 'log' && viewLog.day === m.date
          && hl.includes('data-exp="' + mid + '"');
      } finally {
        S.lg = oldLg; S.tab = oldTab; S.statTab = oldStatTab; clubTab = oldCt; clubPer = oldPer;
        viewLog.day = oldDay; viewLog.month = oldMonth; viewLog.filter = oldF; viewLog.init = oldInit;
        recompute(); render();
      }
    })()
  `);
  if (!gomaOk) failed++;
  console.log(`${gomaOk ? "✅" : "❌"} 분석 이변 → 경기 기록 점프`);

  /* 클럽 진단 — 부수 조합별 핸디 히트맵 렌더 */
  const pairMapOk = app.eval(`
    (() => {
      const oldLg = S.lg, oldTab = S.tab, oldStatTab = S.statTab, oldCt = clubTab;
      try {
        S.lg = 'all'; S.tab = 'stat'; S.statTab = 'club'; clubTab = 'diag';
        recompute(); render();
        const h = document.querySelector('#statBox').innerHTML || '';
        return h.includes('부수 조합별') && h.includes('class="hmap"')
          && h.includes('1부수 위 상대');
      } finally {
        S.lg = oldLg; S.tab = oldTab; S.statTab = oldStatTab; clubTab = oldCt;
        recompute(); render();
      }
    })()
  `);
  if (!pairMapOk) failed++;
  console.log(`${pairMapOk ? "✅" : "❌"} 부수 조합별 핸디 히트맵 렌더`);

  /* 주간 리캡 — 분석>기록 상단, 복사 텍스트 준비 */
  const recapOk = app.eval(`
    (() => {
      const oldLg = S.lg, oldTab = S.tab, oldStatTab = S.statTab, oldCt = clubTab;
      try {
        S.lg = 'all'; S.tab = 'stat'; S.statTab = 'club'; clubTab = 'month';
        recompute(); render();
        const h = document.querySelector('#statBox').innerHTML || '';
        return h.includes('이번 주 리캡') && h.includes('data-recapcopy')
          && typeof S._recapTxt === 'string' && S._recapTxt.includes('주간 리캡');
      } finally {
        S.lg = oldLg; S.tab = oldTab; S.statTab = oldStatTab; clubTab = oldCt;
        recompute(); render();
      }
    })()
  `);
  if (!recapOk) failed++;
  console.log(`${recapOk ? "✅" : "❌"} 주간 리캡 카드·복사 텍스트`);

  /* 랭킹 설명 시트 — 부수별 출발점·이동 규칙·베타 안내 (sheet를 가로채 내용만 확인) */
  const modeSheetOk = app.eval(`
    (() => {
      let cap = '';
      const old = sheet;
      try {
        sheet = (t, h) => { cap = h; return { remove(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; };
        modeSheet();
        return cap.includes('점수는 어디서 출발하나') && cap.includes('점수는 어떻게 움직이나')
          && cap.includes('베타 운영 기간') && cap.includes(String(Math.round(baseFor(BU_MAX))))
          && cap.includes('똑같이 출발')
          && cap.includes('핸디 덕을 본 만큼 빼고');
      } finally { sheet = old; }
    })()
  `);
  if (!modeSheetOk) failed++;
  console.log(`${modeSheetOk ? "✅" : "❌"} 랭킹 설명 시트 (출발점·규칙·베타)`);

  for (const lg of ["all", ...app.leagues().map(x => x.id)]) {
    setLeague(app, lg);
    for (const tab of tabs) {
      S.tab = tab;
      try {
        app.render();
        /* 분석 탭은 껍데기만 #view에 그리고 내용은 #statBox에 채운다 */
        let len = (view.innerHTML || "").length;
        if (tab === "stat") len = (app.doc.querySelector("#statBox").innerHTML || "").length;
        const ok = len > 100;
        if (!ok) failed++;
        console.log(`${ok ? "✅" : "❌"} lg=${lg} tab=${tab} (${len}자)`);
      } catch (e) {
        failed++;
        console.log(`❌ lg=${lg} tab=${tab}: ${e.message}`);
      }
    }
    /* 분석 > 대회 시뮬레이터 서브탭 */
    try {
      S.tab = "stat"; S.statTab = "sim"; app.render();
      const len = (app.doc.querySelector("#statBox").innerHTML || "").length;
      const ok = len > 100;
      if (!ok) failed++;
      console.log(`${ok ? "✅" : "❌"} lg=${lg} tab=stat/sim (${len}자)`);
    } catch (e) { failed++; console.log(`❌ lg=${lg} tab=stat/sim: ${e.message}`); }
    S.statTab = "club";
  }
  /* 비로그인(게스트) 화면도 한 바퀴 */
  S.me = null; S.tab = "rank"; setLeague(app, "all");
  try { app.render(); console.log(`✅ 게스트 rank (${(view.innerHTML || "").length}자)`); }
  catch (e) { failed++; console.log("❌ 게스트 rank: " + e.message); }

  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("❌ 실행 실패:", e); process.exit(1); });
