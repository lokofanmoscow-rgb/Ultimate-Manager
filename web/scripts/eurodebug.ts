import { generateWorld } from '../src/engine/game';
import { G } from '../src/engine/state';
import { fmtDate } from '../src/engine/util';
await generateWorld(12345);
for (const code of ['UCL','UEL','UECL']) {
  const c = G.comps[`E:${code}:2026`];
  console.log(code, 'clubs', c.clubs.length, 'direct', c.meta.direct.length, 'paths', JSON.stringify(c.meta.paths), 'expDrop', JSON.stringify(c.meta.expDrop));
  for (const k in c.meta.qual) console.log('  qual', k, c.meta.qual[k].length);
  console.log('  drawn', JSON.stringify(c.meta.drawn), 'rounds', c.rounds!.map(r=>r.path+':'+r.days.map(d=>fmtDate(d)).join('/')).join(' ; '));
}
