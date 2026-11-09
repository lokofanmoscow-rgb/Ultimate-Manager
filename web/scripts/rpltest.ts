import { generateWorld } from '../src/engine/game';
import { G } from '../src/engine/state';
import { fmtDate } from '../src/engine/util';
import { fullName } from '../src/engine/player';

await generateWorld(777);
console.log('date', fmtDate(G.day));
const ru = G.countries['RUS'];
console.log('lastFinal RUS1:', ru.lastFinal!.table[0].map((id) => G.clubs[id].name).join(', '));
console.log('cup winner:', ru.lastFinal!.cupWinner != null ? G.clubs[ru.lastFinal!.cupWinner].name : '-');
for (const lg of ['RUS1', 'RUS2']) console.log(lg, G.clubs.filter((c) => c.league === lg).map((c) => c.name).join(', '));
for (const n of ['Локомотив Москва', 'Зенит', 'Балтика']) {
  const c = G.clubs.find((x) => x.name === n)!;
  const ps = c.players.map((id) => G.players[id]!).sort((a, b) => b.ca - a.ca);
  console.log(`\n${n}: ${ps.length} players, real ${ps.filter((p) => p.real).length}`);
  console.log(ps.slice(0, 30).map((p) => `${fullName(p)} ${2026 - Math.floor(p.dob / 365.25) - 2000} ${p.ca}/${p.pa}`).join(' | '));
}
