// UEFA coefficients (club & association)
import { G } from './state';

export function clubCoef(id: number): number {
  const c = G.clubs[id];
  if (!c) return 0;
  const own = c.coef.reduce((s, x) => s + x, 0) + (c.coefCur || 0);
  const assoc = G.countries[c.country]?.coef.reduce((s, x) => s + x, 0) ?? 0;
  return Math.max(own, assoc * 0.2) + c.rep / 1000;
}

export function assocCoef(code: string): number {
  return G.countries[code]?.coef.reduce((s, x) => s + x, 0) ?? 0;
}

/** add points for a euro match result */
export function addEuroPoints(club: number, pts: number) {
  const c = G.clubs[club];
  if (!c) return;
  c.coefCur = (c.coefCur || 0) + pts;
  const ap = (G.flags.assocPts ||= {});
  const rec = (ap[c.country] ||= { pts: 0, clubs: [] as number[] });
  rec.pts += pts;
  if (!rec.clubs.includes(club)) rec.clubs.push(club);
}

/** season rollover: finalize association points and shift arrays */
export function rolloverCoefficients() {
  const ap = G.flags.assocPts || {};
  for (const code in G.countries) {
    const ct = G.countries[code];
    const rec = ap[code];
    const pts = rec && rec.clubs.length ? rec.pts / rec.clubs.length : 0;
    ct.coef.shift();
    ct.coef.push(Math.round(pts * 1000) / 1000);
  }
  for (const c of G.clubs) {
    c.coef.shift();
    c.coef.push(Math.round((c.coefCur || 0) * 1000) / 1000);
    c.coefCur = 0;
  }
  G.flags.assocPts = {};
  // re-rank
  const order = Object.values(G.countries).sort((a, b) => b.coef.reduce((s, x) => s + x, 0) - a.coef.reduce((s, x) => s + x, 0));
  order.forEach((c, i) => (c.rank = i + 1));
}
