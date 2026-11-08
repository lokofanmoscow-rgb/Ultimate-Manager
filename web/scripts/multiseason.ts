import { generateWorld, startCareer, continueStep } from '../src/engine/game';
import { G } from '../src/engine/state';
import { quickSim } from '../src/engine/quicksim';
import { applyResult } from '../src/engine/results';
import { standings } from '../src/engine/comps';
import { fmtDate, dayOf } from '../src/engine/util';
import { pendingDecisions } from '../src/engine/inbox';
import { serialize, deserialize, loadGame } from '../src/engine/save';
import { LEAGUE_DEF } from '../src/data/nations';

await generateWorld(4242);
const club = G.clubs.find((c) => c.name === 'Локомотив Москва')!;
startCareer({ fn: 'Тест', ln: 'Тестов', nat: 'RUS', dob: dayOf(1980, 1, 1), rep: 50, exp: 2, badge: 3, style: 'x' } as any, club.id);
const t0 = Date.now();
for (const year of [2027, 2028, 2029]) {
  const end = dayOf(year, 7, 2);
  while (G.day < end) {
    const r = continueStep();
    if (r.stop === 'match') applyResult(r.fx, quickSim(r.fx));
    else if (r.stop === 'inbox') for (const m of pendingDecisions()) m.done = true;
    else if (r.stop === 'sacked') { console.log('SACKED', fmtDate(G.day)); G.flags.unemployedOk = true; }
  }
  const s = year - 1;
  console.log(`=== season ${s}/${year} done at ${fmtDate(G.day)} (${Date.now() - t0} ms), players ${G.players.filter(Boolean).length}, fixtures ${Object.keys(G.fixtures).length}, comps ${Object.keys(G.comps).length}`);
  for (const id of [`L:RUS1:${s}`, `L:ENG1:${s}`, `L:ENG2:${s}`, `L:GER1:${s}`, `L:NOR1:${year - 1}`]) {
    const c = G.comps[id];
    if (!c) { console.log('  missing', id); continue; }
    console.log(' ', id, c.done ? 'done' : 'NOT DONE', standings(c).slice(0, 3).map((x) => G.clubs[x].name).join(', '), '| last:', standings(c).slice(-2).map((x) => G.clubs[x].name).join(', '));
  }
  for (const code of ['UCL', 'UEL', 'UECL']) {
    const c = G.comps[`E:${code}:${s}`];
    console.log(' ', code, c ? (c.done ? 'winner ' + G.clubs[c.winner!].name : 'NOT DONE phase ' + c.meta.phase) : 'missing');
  }
  const cup = G.comps[`C:RUS:${s}`];
  console.log('  Russian Cup', cup?.done ? G.clubs[cup.winner!].name : 'not done', cup?.rounds?.map((r) => r.name).join(' > '));
  console.log('  RPL now:', G.clubs.filter((c) => c.league === 'RUS1').length, 'clubs; ENG1', G.clubs.filter((c) => c.league === 'ENG1').length, 'ENG5', G.clubs.filter((c) => c.league === 'ENG5').length, 'RUS3', G.clubs.filter((c) => c.league === 'RUS3').length);
  const rank = Object.values(G.countries).sort((a, b) => a.rank - b.rank).slice(0, 12).map((c) => `${c.code}:${c.coef.reduce((x, y) => x + y, 0).toFixed(1)}`);
  console.log('  assoc rank', rank.join(' '));
  console.log('  user', G.user >= 0 ? G.clubs[G.user].name : 'unemployed', 'board', G.board.conf, 'mgr', JSON.stringify(G.mgr.record), 'trophies', G.mgr.trophies.map((t) => t.name).join(', '));
  console.log('  transfers', G.transfers.length, 'free agents', G.players.filter((p) => p && p.club < 0).length);
  // roundtrip save
  const txt = serialize(G);
  loadGame(deserialize(txt));
  console.log('  save MB', (txt.length / 1e6).toFixed(1));
}
// sanity: every league has correct size
for (const id in LEAGUE_DEF) {
  const n = G.clubs.filter((c) => c.league === id).length;
  if (n !== LEAGUE_DEF[id].size) console.log('SIZE MISMATCH', id, n, LEAGUE_DEF[id].size);
}
