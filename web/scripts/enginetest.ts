import { generateWorld, startCareer } from '../src/engine/game';
import { G } from '../src/engine/state';
import { MatchEngine } from '../src/match/engine';
import { newFixture } from '../src/engine/comps';
import { dayOf } from '../src/engine/util';
await generateWorld(777);
const byName = (n: string) => G.clubs.find((c) => c.name === n)!.id;
const pairs = [['Зенит', 'Спартак Москва'], ['Манчестер Сити', 'Арсенал'], ['Реал Мадрид', 'Хетафе'], ['Бавария', 'Сандерленд'], ['Краснодар', 'Акрон']];
let totG = 0, totS = 0, totSOT = 0, totPA = 0, totPC = 0, totF = 0, totY = 0, totC = 0, n = 0, totXG = 0, totOff = 0;
const N = Number((globalThis as any).process.argv[2] || 20);
const t0 = Date.now();
for (let k = 0; k < N; k++) {
  const [h, a] = pairs[k % pairs.length];
  const f = newFixture('test', 'Тест', 1, G.day + 1, byName(h), byName(a));
  const e = new MatchEngine(f, -1);
  let guard = 0;
  while (!e.finished && guard++ < 200000) { e.step(); if (e.phase === 'halftime') e.resume(); }
  const s0 = e.teams[0].stats, s1 = e.teams[1].stats;
  totG += e.teams[0].score + e.teams[1].score; totS += s0.shots + s1.shots; totSOT += s0.sot + s1.sot; totPA += s0.pa + s1.pa; totPC += s0.pc + s1.pc;
  totF += s0.fouls + s1.fouls; totY += s0.yc + s1.yc; totC += s0.corners + s1.corners; totXG += s0.xg + s1.xg; totOff += s0.off + s1.off; n++;
  const r = e.toResult();
  console.log(`${h} ${e.teams[0].score}:${e.teams[1].score} ${a} | shots ${s0.shots}-${s1.shots} sot ${s0.sot}-${s1.sot} xg ${s0.xg.toFixed(1)}-${s1.xg.toFixed(1)} poss ${r.stats[0]}% pass ${s0.pc}/${s0.pa} ${s1.pc}/${s1.pa} fouls ${s0.fouls}-${s1.fouls} yc ${s0.yc}-${s1.yc} corners ${s0.corners}-${s1.corners} ticks ${e.tick}`);
}
console.log(`AVG per match: goals ${(totG/n).toFixed(2)} shots ${(totS/n).toFixed(1)} sot ${(totSOT/n).toFixed(1)} xg ${(totXG/n).toFixed(2)} passes ${(totPA/n).toFixed(0)} acc ${(totPC/totPA*100).toFixed(0)}% fouls ${(totF/n).toFixed(1)} yc ${(totY/n).toFixed(1)} corners ${(totC/n).toFixed(1)} offsides ${(totOff/n).toFixed(1)}; ms/match ${((Date.now()-t0)/n).toFixed(0)}`);
