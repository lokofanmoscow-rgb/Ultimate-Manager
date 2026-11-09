import { generateWorld, startCareer, continueStep } from '../src/engine/game';
import { G } from '../src/engine/state';
import { quickSim } from '../src/engine/quicksim';
import { applyResult } from '../src/engine/results';
import { dayOf, fmtDate } from '../src/engine/util';
import { pendingDecisions } from '../src/engine/inbox';
import { applyPressAnswer } from '../src/engine/press';

await generateWorld(4242);
const c = G.clubs.find((x) => x.name === 'Локомотив Москва')!;
startCareer({ fn: 'И', ln: 'Т', nat: 'RUS', dob: dayOf(1985, 1, 1), rep: 40, exp: 2, badge: 2, style: 'balanced' } as any, c.id);
const end = dayOf(2026, 10, 15);
let matches = 0;
while (G.day < end) {
  const r = continueStep();
  if (r.stop === 'match') { applyResult(r.fx, quickSim(r.fx)); matches++; }
  else if (r.stop === 'inbox') for (const m of pendingDecisions()) m.done = true;
  // answer press conferences with random options
  for (const m of G.inbox) if (m.kind === 'press' && !m.done && m.data) {
    if ((globalThis as any).process?.env?.ANSWER) for (const q of m.data.qs) { const o = q.opts[Math.floor(Math.random() * q.opts.length)]; applyPressAnswer(m.data.fx, o.e); }
    m.done = true;
  }
}
const press = G.inbox.filter((m) => m.kind === 'press');
console.log('matches', matches, 'press', press.length, 'pre', press.filter((m) => m.data.pre).length);
for (const m of press.slice(0, 6)) { console.log('\n#', fmtDate(m.day), m.subj); for (const q of m.data.qs) console.log('  Q:', q.q, '|', q.opts.map((o: any) => o.t).join(' / ')); }
console.log('board conf', G.board.conf, 'avg morale', Math.round(c.players.map((id) => G.players[id]!.morale).reduce((a, b) => a + b, 0) / c.players.length));
