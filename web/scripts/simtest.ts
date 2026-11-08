import { generateWorld, startCareer, continueStep, processDay } from '../src/engine/game';
import { G } from '../src/engine/state';
import { quickSim } from '../src/engine/quicksim';
import { applyResult } from '../src/engine/results';
import { standings } from '../src/engine/comps';
import { fmtDate, dayOf } from '../src/engine/util';
import { pendingDecisions } from '../src/engine/inbox';
import { lpStandings } from '../src/engine/euro';

const t0 = Date.now();
await generateWorld(12345);
console.log('world generated in', Date.now() - t0, 'ms; players', G.players.length, 'clubs', G.clubs.length, 'date', fmtDate(G.day));
const zen = G.clubs.find((c) => c.name === 'Зенит')!;
startCareer({ fn: 'Иван', ln: 'Тестов', nat: 'RUS', dob: dayOf(1985, 1, 1), rep: 40, exp: 2, badge: 2, style: 'balanced' } as any, zen.id);
const t1 = Date.now();
const endDay = dayOf(2027, 7, 2);
let matches = 0;
while (G.day < endDay) {
  const r = continueStep();
  if (r.stop === 'match') {
    const res = quickSim(r.fx);
    applyResult(r.fx, res);
    matches++;
  } else if (r.stop === 'inbox') {
    for (const m of pendingDecisions()) m.done = true;
  } else if (r.stop === 'sacked') {
    console.log('SACKED on', fmtDate(G.day));
    G.flags.unemployedOk = true;
  }
}
console.log('season simulated in', Date.now() - t1, 'ms; user matches', matches);
for (const key of ['L:RUS1:2026', 'L:ENG1:2026', 'L:ESP1:2026', 'L:GER1:2026', 'L:SCO1:2026', 'L:BEL1:2026', 'L:NOR1:2027']) {
  const c = G.comps[key];
  if (!c) { console.log('missing', key); continue; }
  const st = standings(c).slice(0, 4).map((id) => `${G.clubs[id].name} ${c.table![id].pts}`);
  console.log(key, c.done ? 'DONE' : 'not done', st.join(', '));
}
for (const id in G.comps) {
  const c = G.comps[id];
  if ((c.kind === 'cup' || c.kind === 'euro' || c.kind === 'super') && ['RUS', 'ENG', 'GER', undefined].includes(c.country as any)) {
    console.log(id, c.done ? 'winner: ' + G.clubs[c.winner!]?.name : 'NOT DONE', c.rounds?.map((r) => r.name + (r.done ? '' : '*')).join(' | '));
  }
}
const ucl = G.comps['E:UCL:2026'];
if (ucl?.lp) console.log('UCL LP top8', lpStandings(ucl).slice(0, 8).map((id) => G.clubs[id].name).join(', '));
// goals average
let goals = 0, n = 0, hw = 0, dr = 0;
for (const k in G.fixtures) { const f = G.fixtures[k]; if (f.played) { goals += f.hg + f.ag; n++; if (f.hg > f.ag) hw++; else if (f.hg === f.ag) dr++; } }
console.log('fixtures kept', n, 'avg goals', (goals / n).toFixed(2), 'home win', (hw / n).toFixed(2), 'draw', (dr / n).toFixed(2));
console.log('transfers', G.transfers.length, G.transfers.slice(0, 8).map((t) => `${t.name}: ${G.clubs[t.from]?.name ?? 'free'} -> ${G.clubs[t.to].name} ${t.fee}`).join('\n'));
console.log('news', G.news.slice(0, 10).map((n) => n.text).join('\n'));
console.log('user club', G.clubs[zen.id].name, 'balance', G.clubs[zen.id].fin.balance, 'board conf', G.board.conf, 'league', G.clubs[zen.id].league);
console.log('mgr', JSON.stringify(G.mgr.record), 'trophies', G.mgr.trophies.map((t) => t.name));
import { serialize, deserialize } from '../src/engine/save';
const t2 = Date.now();
const json = serialize(G);
const back = deserialize(json);
const gz = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
console.log('serialize+deserialize ms', Date.now() - t2, 'compact', (json.length/1e6).toFixed(1), 'MB gz', (gz.size/1e6).toFixed(2), 'MB players back', back.players.length, back.players[5]?.a?.length);

console.log('save size', (json.length / 1e6).toFixed(1), 'MB');
