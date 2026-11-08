import { generateWorld } from '../src/engine/game';
import { G } from '../src/engine/state';
import { MatchEngine } from '../src/match/engine';
import { newFixture } from '../src/engine/comps';
await generateWorld(777);
const byName = (n: string) => G.clubs.find((c) => c.name === n)!.id;
const f = newFixture('test', 'Тест', 1, G.day + 1, byName('Зенит'), byName('Спартак Москва'));
const e = new MatchEngine(f, -1);
const orig = e.doShot.bind(e);
const dists: number[] = [];
let samples = 0;
(e as any).doShot = (o: any, kind: any) => {
  const gx = e.goalX(o.side);
  const d = Math.hypot(gx - o.x, o.y - 34);
  const defs = e.onPitch(1 - o.side).filter((q) => Math.abs(q.x - gx) < Math.abs(o.x - gx));
  const gk = e.onPitch(1 - o.side).find((q) => q.isGK)!;
  if (samples++ < 12) console.log(`t=${e.minuteStr()} ${kind} shooter ${o.name} side ${o.side} at (${o.x.toFixed(1)},${o.y.toFixed(1)}) dist ${d.toFixed(1)} defsBetween ${defs.length} gk at (${gk.x.toFixed(1)},${gk.y.toFixed(1)}) dir ${e.dir(o.side)} phase ${e.phase}`);
  dists.push(d);
  return orig(o, kind);
};
let guard = 0;
let snap = 0;
while (!e.finished && guard++ < 200000) {
  e.step(); if (e.phase === 'halftime') e.resume();
  if (e.tick === 3000) {
    console.log('--- snapshot at tick 3000, ball', e.ball.x.toFixed(1), e.ball.y.toFixed(1), 'owner side', e.ball.owner >= 0 ? e.ps[e.ball.owner].side : -1, 'possSide', e.possSide);
    for (const p of e.onPitch()) console.log(`  side ${p.side} ${p.pos.padEnd(4)} (${p.x.toFixed(1)},${p.y.toFixed(1)}) -> (${p.tx.toFixed(1)},${p.ty.toFixed(1)}) cond ${p.cond.toFixed(2)}`);
  }
}
dists.sort((a, b) => a - b);
console.log('shots', dists.length, 'median dist', dists[Math.floor(dists.length / 2)]?.toFixed(1), 'score', e.teams[0].score, e.teams[1].score);
const counts: Record<string, number> = {};
for (const ev of e.events) counts[ev.type] = (counts[ev.type] || 0) + 1;
console.log(counts);
