import { generateWorld } from '../src/engine/game';
import { G } from '../src/engine/state';
import { MatchEngine } from '../src/match/engine';
import { newFixture } from '../src/engine/comps';
await generateWorld(777);
const byName = (n: string) => G.clubs.find((c) => c.name === n)!.id;
const cnt: Record<string, number> = {};
const inc = (k: string) => (cnt[k] = (cnt[k] || 0) + 1);
for (let k = 0; k < 4; k++) {
  const f = newFixture('test', 'Тест', 1, G.day + 1, byName('Манчестер Сити'), byName('Арсенал'));
  const e: any = new MatchEngine(f, -1);
  const origArrive = e.arrive.bind(e);
  e.arrive = () => {
    const b = e.ball;
    const kind = b.fkind;
    const rcv = b.receiver >= 0 ? e.ps[b.receiver] : null;
    const tag = kind === 1 ? 'ground' : kind === 2 ? 'lofted' : kind === 5 ? 'cross' : 'k' + kind;
    if (kind === 3 || kind === 5) { inc(tag + ':handled'); return origArrive(); }
    if (!rcv) inc(tag + ':noReceiver');
    else if (rcv.side !== b.lastSide) inc(tag + ':intercepted');
    else {
      const d = Math.hypot(rcv.x - b.x, rcv.y - b.y);
      if (d >= 3.5) inc(tag + ':tooFar');
      else inc(tag + ':reached');
    }
    const ownerBefore = e.ball.owner;
    origArrive();
    void ownerBefore;
  };
  const origGain = e.gainPossession.bind(e);
  e.gainPossession = (p: any, how: string) => { inc('gain:' + how); return origGain(p, how); };
  const origDuel = e.duel.bind(e);
  e.duel = (o: any, d: any, att: boolean) => { inc(att ? 'duel:takeon' : 'duel:tackle'); return origDuel(o, d, att); };
  const origDecide = e.decide.bind(e);
  e.decide = (o: any, sp: boolean) => { inc('decide'); return origDecide(o, sp); };
  let g = 0;
  while (!e.finished && g++ < 100000) { e.step(); if (e.phase === 'halftime') e.resume(); }
}
console.log(Object.entries(cnt).sort().map(([k, v]) => `${k}: ${(v / 4).toFixed(0)}`).join('\n'));
