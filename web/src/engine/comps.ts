// Leagues, domestic cups, super cups and play-offs.
import type { Comp, Fixture, Row, Tie } from './types';
import { G, R, addFxIndex, IDX, removeFxIndex } from './state';
import { ASSOC, LEAGUE_DEF, LeagueDef, CupDef } from '../data/nations';
import { SeasonFrame, leagueDays, cupDays, seasonFrame, uefaWeekDays, inRanges } from './calendar';
import { nearestWeekday, weekday, nextWeekday } from './util';

// ---------- fixtures ----------
export function newFixture(comp: string, stage: string, rnd: number, day: number, home: number, away: number, extra: Partial<Fixture> = {}): Fixture {
  if (day <= G.day) day = G.day + 1;
  const f: Fixture = { id: G.nid.fx++, comp, stage, rnd, day, home, away, hg: 0, ag: 0, played: false, ...extra };
  G.fixtures[f.id] = f;
  (G.fxByDay[day] ||= []).push(f.id);
  addFxIndex(f);
  return f;
}

export function moveFixture(f: Fixture, day: number) {
  const arr = G.fxByDay[f.day];
  if (arr) {
    const i = arr.indexOf(f.id);
    if (i >= 0) arr.splice(i, 1);
  }
  f.day = day;
  (G.fxByDay[day] ||= []).push(f.id);
}

export function deleteFixture(f: Fixture) {
  const arr = G.fxByDay[f.day];
  if (arr) {
    const i = arr.indexOf(f.id);
    if (i >= 0) arr.splice(i, 1);
  }
  removeFxIndex(f);
  delete G.fixtures[f.id];
}

function clubBusy(club: number, day: number, except: number): Fixture | null {
  const ids = IDX.clubFx.get(club);
  if (!ids) return null;
  for (const id of ids) {
    if (id === except) continue;
    const o = G.fixtures[id];
    if (o && !o.played && Math.abs(o.day - day) <= 1) return o;
  }
  return null;
}

/** make sure `f` doesn't clash (±1 day) with other fixtures of its clubs. If fixed, move the others. */
export function resolveClash(f: Fixture, fixed: boolean) {
  for (let guard = 0; guard < 6; guard++) {
    const clash = clubBusy(f.home, f.day, f.id) || clubBusy(f.away, f.day, f.id);
    if (!clash) return;
    const mover = fixed ? clash : f;
    const otherDay = fixed ? f.day : clash.day;
    const cands = [2, -2, 3, -3, 4, 5, -4, 6, 7];
    let moved = false;
    for (const dlt of cands) {
      const nd = (fixed ? mover.day : mover.day) + dlt;
      if (nd <= G.day) continue;
      if (Math.abs(nd - otherDay) <= 1) continue;
      if (!clubBusy(mover.home, nd, mover.id) && !clubBusy(mover.away, nd, mover.id)) {
        moveFixture(mover, nd);
        moved = true;
        break;
      }
    }
    if (!moved) return;
  }
}

// ---------- tables ----------
export const newRow = (club: number): Row => ({ club, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: '' });

export function applyToTable(table: Record<number, Row>, f: Fixture) {
  const h = table[f.home], a = table[f.away];
  if (!h || !a) return;
  h.p++; a.p++;
  h.gf += f.hg; h.ga += f.ag; a.gf += f.ag; a.ga += f.hg;
  if (f.hg > f.ag) { h.w++; a.l++; h.pts += 3; h.form = (h.form + 'В').slice(-5); a.form = (a.form + 'П').slice(-5); }
  else if (f.hg < f.ag) { a.w++; h.l++; a.pts += 3; h.form = (h.form + 'П').slice(-5); a.form = (a.form + 'В').slice(-5); }
  else { h.d++; a.d++; h.pts++; a.pts++; h.form = (h.form + 'Н').slice(-5); a.form = (a.form + 'Н').slice(-5); }
}

const H2H = new Set(['ESP', 'ITA', 'RUS', 'TUR', 'GRE', 'POR', 'CYP', 'SRB', 'UKR', 'BLR', 'KAZ']);

export function sortRows(comp: Comp, ids: number[], table: Record<number, Row>): number[] {
  const useH2H = comp.country ? H2H.has(comp.country) : false;
  const arr = ids.slice();
  arr.sort((x, y) => {
    const a = table[x], b = table[y];
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (useH2H) {
      const hh = h2h(comp.id, x, y);
      if (hh !== 0) return hh;
    }
    const gd = b.gf - b.ga - (a.gf - a.ga);
    if (gd !== 0) return gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (b.w !== a.w) return b.w - a.w;
    return G.clubs[y].rep - G.clubs[x].rep;
  });
  return arr;
}

function h2h(compId: string, x: number, y: number): number {
  const ids = IDX.clubFx.get(x) || [];
  let px = 0, py = 0, gx = 0, gy = 0;
  for (const id of ids) {
    const f = G.fixtures[id];
    if (!f || !f.played || f.comp !== compId) continue;
    if (f.home === x && f.away === y) { gx += f.hg; gy += f.ag; if (f.hg > f.ag) px += 3; else if (f.hg < f.ag) py += 3; else { px++; py++; } }
    else if (f.home === y && f.away === x) { gx += f.ag; gy += f.hg; if (f.ag > f.hg) px += 3; else if (f.ag < f.hg) py += 3; else { px++; py++; } }
  }
  if (py !== px) return py - px;
  return (gy - gx) - 0;
}

/** current ordering of a league (groups concatenated) */
export function standings(comp: Comp): number[] {
  if (!comp.table) return [];
  if (comp.groups && comp.groups.length > 1 && (comp.stage ?? 1) >= 2) {
    const out: number[] = [];
    for (const g of comp.groups) out.push(...sortRows(comp, g, comp.table));
    return out;
  }
  return sortRows(comp, comp.clubs, comp.table);
}

// ---------- round robin ----------
export function roundRobin(teams: number[], legs: number): [number, number][][] {
  const t = teams.slice();
  if (t.length % 2) t.push(-1);
  const n = t.length;
  const base: [number, number][][] = [];
  const arr = t.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a < 0 || b < 0) continue;
      const flip = i === 0 ? r % 2 === 1 : (i + r) % 2 === 1;
      pairs.push(flip ? [b, a] : [a, b]);
    }
    base.push(pairs);
    // rotate all but first
    arr.splice(1, 0, arr.pop()!);
  }
  const rounds: [number, number][][] = [];
  for (let l = 0; l < legs; l++) {
    for (const r of base) rounds.push(l % 2 === 0 ? r.map((p) => [p[0], p[1]] as [number, number]) : r.map((p) => [p[1], p[0]] as [number, number]));
  }
  return rounds;
}

// ---------- league format ----------
export interface Stages {
  legs1: number;
  split?: { sizes: number[]; legs: number[]; carry: 'F' | 'H' | 'h' };
}
export function parseFmt(fmt: string): Stages {
  const [a, b] = fmt.split('|');
  const st: Stages = { legs1: parseInt(a.replace('rr', ''), 10) };
  if (b) {
    const [s, l, c] = b.slice(1).split(':');
    st.split = { sizes: s.split(',').map(Number), legs: l.split(',').map(Number), carry: c as any };
  }
  return st;
}
function rrRounds(n: number, legs: number) {
  return legs * (n % 2 ? n : n - 1);
}

export function createLeague(ld: LeagueDef, season: number, clubs: number[], frame: SeasonFrame): Comp {
  const st = parseFmt(ld.fmt);
  const n = clubs.length;
  const r1 = rrRounds(n, st.legs1);
  let r2 = 0;
  if (st.split) st.split.sizes.forEach((s, i) => (r2 = Math.max(r2, rrRounds(s, st.split!.legs[i] ?? 1))));
  const avoid = uefaWeekDays(ASSOC[ld.country].cal === 'AS' ? season : season - 1);
  const days = leagueDays(frame, r1 + r2, avoid);
  const id = `L:${ld.id}:${season}`;
  const comp: Comp = {
    id, kind: 'league', def: ld.id, name: ld.name, short: ld.name, country: ld.country, tier: ld.tier, season,
    clubs: clubs.slice(), done: false, stage: 1, table: {}, totalRounds: r1 + r2, roundDays: days, scorers: {},
    meta: { r1, r2 },
  };
  for (const c of clubs) comp.table![c] = newRow(c);
  G.comps[id] = comp;
  const order = R.shuffle(clubs.slice());
  const rounds = roundRobin(order, st.legs1);
  rounds.forEach((pairs, ri) => {
    for (const [h, a] of pairs) newFixture(id, `Тур ${ri + 1}`, ri + 1, days[ri], h, a);
  });
  return comp;
}

/** called after fixtures of a league are played */
export function checkLeague(comp: Comp) {
  if (comp.done) return;
  const ids = (IDX.clubFx.get(comp.clubs[0]) || []).concat(IDX.clubFx.get(comp.clubs[1]) || []);
  // quick check: any unplayed fixture of this comp?
  for (const c of comp.clubs) {
    for (const id of IDX.clubFx.get(c) || []) {
      const f = G.fixtures[id];
      if (f && f.comp === comp.id && !f.played) return;
    }
  }
  void ids;
  const ld = LEAGUE_DEF[comp.def];
  const st = parseFmt(ld.fmt);
  if (comp.stage === 1 && st.split) {
    // split
    const order = standings(comp);
    const groups: number[][] = [];
    let k = 0;
    for (const s of st.split.sizes) {
      groups.push(order.slice(k, k + s));
      k += s;
    }
    if (k < order.length) groups[groups.length - 1].push(...order.slice(k));
    comp.groups = groups;
    comp.stage = 2;
    if (st.split.carry !== 'F') {
      for (const c of comp.clubs) {
        const row = comp.table![c];
        const half = st.split.carry === 'H' ? Math.ceil(row.pts / 2) : Math.floor(row.pts / 2);
        row.ded = (row.ded || 0) + (row.pts - half);
        row.pts = half;
      }
    }
    const r1 = comp.meta.r1;
    groups.forEach((g, gi) => {
      const rounds = roundRobin(g, st.split!.legs[gi] ?? 1);
      rounds.forEach((pairs, ri) => {
        const day = comp.roundDays![r1 + ri] ?? comp.roundDays![comp.roundDays!.length - 1] + 7 * (ri + 1);
        for (const [h, a] of pairs) {
          const f = newFixture(comp.id, `Тур ${r1 + ri + 1}`, r1 + ri + 1, Math.max(day, G.day + 1), h, a, { grp: gi });
          resolveClash(f, false);
        }
      });
    });
    return;
  }
  comp.done = true;
  const order = standings(comp);
  comp.winner = order[0];
  comp.runnerUp = order[1];
  comp.meta.final = order;
  onLeagueDone(comp);
}

// ---------- play-offs (promotion / relegation) ----------
function onLeagueDone(comp: Comp) {
  const ld = LEAGUE_DEF[comp.def];
  const order: number[] = comp.meta.final;
  const endDay = Math.max(G.day, comp.roundDays![comp.roundDays!.length - 1]);
  if (ld.upPO) {
    const [rng, sl, fl] = ld.upPO.split(':');
    const [p1, p2] = rng.split('-').map(Number);
    const teams = order.slice(p1 - 1, p2);
    if (teams.length === 4) {
      const semiLegs = parseInt(sl, 10) as 1 | 2;
      const finalLegs = parseInt(fl, 10) as 1 | 2;
      const neutral = fl.includes('N');
      const id = `PO:${ld.id}:${comp.season}:up`;
      const po: Comp = {
        id, kind: 'po', def: ld.id, name: `${ld.name}: плей-офф за повышение`, short: 'Плей-офф', country: ld.country, tier: ld.tier,
        season: comp.season, clubs: teams, done: false, ties: [], scorers: {},
        rounds: [
          { name: '1/2 финала', days: semiLegs === 2 ? [endDay + 4, endDay + 7] : [endDay + 4], done: false, drawn: true, legs: semiLegs },
          { name: 'Финал', days: finalLegs === 2 ? [endDay + 11, endDay + 14] : [endDay + 12], done: false, drawn: false, legs: finalLegs },
        ],
        meta: { type: 'up', league: ld.id, neutralFinal: neutral },
      };
      G.comps[id] = po;
      // semis: 3v6, 4v5 ; lower placed hosts first leg (2 legs) or higher hosts (1 leg)
      const pairs: [number, number][] = [[teams[0], teams[3]], [teams[1], teams[2]]];
      for (const [hi, lo] of pairs) {
        const tie = makeTie(po, 0, '1/2 финала', semiLegs === 2 ? lo : hi, semiLegs === 2 ? hi : lo, semiLegs, false);
        po.ties!.push(tie);
      }
    }
  }
  // relegation play-offs vs lower league (created when both done)
  tryRelegationPO(comp.country!, comp.season);
}

export function tryRelegationPO(country: string, season: number) {
  const a = ASSOC[country];
  for (const ld of a.leagues) {
    if (!ld.rpo) continue;
    const up = G.comps[`L:${ld.id}:${season}`];
    const lowDef = a.leagues.find((l) => l.tier === ld.tier + 1);
    if (!lowDef) continue;
    const low = G.comps[`L:${lowDef.id}:${season}`];
    if (!up || !low || !up.done || !low.done) continue;
    const id = `PO:${ld.id}:${season}:rel`;
    if (G.comps[id]) continue;
    const endDay = Math.max(G.day, up.roundDays![up.roundDays!.length - 1], low.roundDays![low.roundDays!.length - 1]);
    const pairs = ld.rpo.split(',').map((s) => {
      const [x, legs] = s.split(':');
      const [u, l] = x.split('v').map(Number);
      return { u: up.meta.final[u - 1], l: low.meta.final[l - 1], legs: parseInt(legs, 10) as 1 | 2 };
    });
    const po: Comp = {
      id, kind: 'po', def: ld.id, name: `${ld.name}: стыковые матчи`, short: 'Стыки', country, tier: ld.tier, season,
      clubs: pairs.flatMap((p) => [p.u, p.l]), done: false, ties: [], scorers: {},
      rounds: [{ name: 'Стыковые матчи', days: [endDay + 4, endDay + 8], done: false, drawn: true, legs: 2 }],
      meta: { type: 'rel', upper: ld.id, lower: lowDef.id },
    };
    G.comps[id] = po;
    for (const p of pairs) po.ties!.push(makeTie(po, 0, 'Стыковые матчи', p.l, p.u, p.legs, false));
  }
}

// ---------- ties ----------
export function makeTie(comp: Comp, ri: number, round: string, a: number, b: number, legs: 1 | 2, neutral: boolean, extra: Partial<Tie> = {}): Tie {
  const rd = comp.rounds![ri];
  const tie: Tie = { id: G.nid.tie++, round, ri, a, b, legs, fx: [], neutral, ...extra };
  const fixedEuro = comp.kind === 'euro';
  const f1 = newFixture(comp.id, round, ri + 1, rd.days[0], a, b, { tie: tie.id, leg: 1, ...(neutral && legs === 1 ? { neutral: 1 } : {}) });
  tie.fx.push(f1.id);
  resolveClash(f1, fixedEuro);
  if (legs === 2) {
    const f2 = newFixture(comp.id, round, ri + 1, rd.days[1] ?? rd.days[0] + 7, b, a, { tie: tie.id, leg: 2 });
    tie.fx.push(f2.id);
    resolveClash(f2, fixedEuro);
  }
  return tie;
}

export function findTie(comp: Comp, tieId: number): Tie | undefined {
  return comp.ties?.find((t) => t.id === tieId);
}

/** aggregate before given leg (for ET decisions): returns goals of fixture's home and away in previous legs */
export function tieAggBefore(f: Fixture): [number, number] | null {
  if (f.tie == null) return null;
  const comp = G.comps[f.comp];
  const tie = comp && findTie(comp, f.tie);
  if (!tie) return null;
  let h = 0, a = 0;
  for (const id of tie.fx) {
    if (id === f.id) continue;
    const o = G.fixtures[id];
    if (!o || !o.played) continue;
    if (o.home === f.home) { h += o.hg; a += o.ag; } else { h += o.ag; a += o.hg; }
  }
  return [h, a];
}

/** is this fixture the deciding (last) leg of a knockout tie */
export function isDecider(f: Fixture): boolean {
  if (f.tie == null) return false;
  const comp = G.comps[f.comp];
  const tie = comp && findTie(comp, f.tie);
  if (!tie) return false;
  return tie.fx[tie.fx.length - 1] === f.id;
}

export function tieWinner(tie: Tie): number | undefined {
  const last = G.fixtures[tie.fx[tie.fx.length - 1]];
  if (!last || !last.played) return undefined;
  let ga = 0, gb = 0;
  for (const id of tie.fx) {
    const f = G.fixtures[id];
    if (f.home === tie.a) { ga += f.hg; gb += f.ag; } else { ga += f.ag; gb += f.hg; }
  }
  if (ga > gb) return tie.a;
  if (gb > ga) return tie.b;
  if (last.ph != null && last.pa != null) return last.ph > last.pa ? last.home : last.away;
  return R.chance(0.5) ? tie.a : tie.b;
}

// ---------- domestic cups ----------
function strength(c: number): number {
  const cl = G.clubs[c];
  const tier = cl.league ? LEAGUE_DEF[cl.league]?.tier ?? 9 : 9;
  return (10 - tier) * 1000 + cl.rep;
}

interface RoundPlan { entrants: number[]; winners: number }

function produce(groups: number[][], W: number): RoundPlan[] {
  if (W <= 0) return [];
  const g = groups[groups.length - 1];
  const rest = groups.slice(0, -1);
  const restN = rest.reduce((s, x) => s + x.length, 0);
  if (!rest.length) {
    const n = g.length;
    if (n <= W) return [{ entrants: g, winners: n }];
    if (n <= 2 * W) return [{ entrants: g, winners: W }];
    const wPrev = n - 2 * W;
    if (2 * wPrev <= n) {
      const sorted = g.slice().sort((a, b) => strength(b) - strength(a));
      const late = sorted.slice(0, n - 2 * wPrev), early = sorted.slice(n - 2 * wPrev);
      return [{ entrants: early, winners: wPrev }, { entrants: late, winners: W }];
    }
    return [...produce([g], 2 * W), { entrants: [], winners: W }];
  }
  const n = g.length;
  const w = 2 * W - n;
  if (w <= 0) {
    const merged = [...rest.slice(0, -1), [...rest[rest.length - 1], ...g]];
    return produce(merged, W);
  }
  if (restN <= w) return [{ entrants: [...rest.flat(), ...g], winners: W }];
  return [...produce(rest, w), { entrants: g, winners: W }];
}

export function planCup(groups: number[][]): { pre: RoundPlan[]; B: number; first: number[] } {
  groups = groups.filter((g) => g.length);
  const total = groups.reduce((s, x) => s + x.length, 0);
  let B = 1;
  while (B * 2 <= total) B *= 2;
  const top = groups[groups.length - 1];
  let pre: RoundPlan[] = [];
  let first: number[] = [];
  if (groups.length === 1) {
    if (top.length > B) pre = produce([top], B);
    else first = top;
  } else if (top.length < B) {
    pre = produce(groups.slice(0, -1), B - top.length);
    first = top;
  } else {
    pre = produce(groups, B);
  }
  // remove pass-through rounds (no matches): push entrants into next round
  const out: RoundPlan[] = [];
  let carry: number[] = [];
  for (let i = 0; i < pre.length; i++) {
    const prevW = out.length ? out[out.length - 1].winners : 0;
    const ent = [...carry, ...pre[i].entrants];
    carry = [];
    if (prevW + ent.length <= pre[i].winners) {
      // no matches in this round
      if (out.length) out[out.length - 1].winners += 0;
      carry = ent;
      if (out.length) { /* previous winners pass on */ }
      continue;
    }
    out.push({ entrants: ent, winners: pre[i].winners });
  }
  first = [...carry, ...first];
  return { pre: out, B, first };
}

export function roundName(size: number, idx: number, preCount: number): string {
  const names: Record<number, string> = { 2: 'Финал', 4: '1/2 финала', 8: '1/4 финала', 16: '1/8 финала', 32: '1/16 финала', 64: '1/32 финала', 128: '1/64 финала', 256: '1/128 финала' };
  if (names[size] && idx >= preCount) return names[size];
  return preCount > 1 ? `${idx + 1}-й раунд` : 'Предварительный раунд';
}

export function clubsOfTier(country: string, tier: number): number[] {
  const ld = ASSOC[country].leagues.find((l) => l.tier === tier);
  if (!ld) return [];
  return G.clubs.filter((c) => c.league === ld.id).map((c) => c.id);
}

function resolveEntry(country: string, spec: number | string): number[] {
  if (spec === 0) return G.countries[country].pool.slice();
  if (typeof spec === 'number') return clubsOfTier(country, spec);
  // 'T1:1-8'
  if (/^\d+$/.test(spec)) return clubsOfTier(country, parseInt(spec, 10));
  const m = /^T(\d+):(\d+)-(\d+)$/.exec(spec);
  if (m) {
    const tier = parseInt(m[1], 10);
    const order = lastOrder(country, tier);
    return order.slice(parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }
  return [];
}

/** last completed season order of a tier (fallback: by reputation) */
export function lastOrder(country: string, tier: number): number[] {
  const cur = clubsOfTier(country, tier);
  const lf = G.countries[country].lastFinal;
  const prev = lf?.table?.[tier - 1] || [];
  const inPrev = prev.filter((c) => cur.includes(c));
  const rest = cur.filter((c) => !inPrev.includes(c)).sort((a, b) => G.clubs[b].rep - G.clubs[a].rep);
  return [...inPrev, ...rest];
}

export function createCup(country: string, def: CupDef, season: number, frame: SeasonFrame, kind: 'cup' | 'lcup'): Comp | null {
  const groups = def.e.map((grp) => Array.from(new Set(grp.flatMap((s) => resolveEntry(country, s)))));
  const all = Array.from(new Set(groups.flat()));
  if (all.length < 4) return null;
  const { pre, B, first } = planCup(groups);
  const sizes: { entrants: number[]; size: number }[] = [];
  let prevW = 0;
  for (const p of pre) {
    sizes.push({ entrants: p.entrants, size: prevW + p.entrants.length });
    prevW = p.winners;
  }
  sizes.push({ entrants: first, size: B });
  for (let s = B / 2; s >= 2; s /= 2) sizes.push({ entrants: [], size: s });
  const finalDay = nearestWeekday(frame.end + (kind === 'cup' ? 7 : -56), 5);
  const avoid = uefaWeekDays(ASSOC[country].cal === 'AS' ? season : season - 1);
  const nDates = sizes.length - 1 + (def.sf === 2 ? 1 : 0);
  const days = cupDays(frame, nDates, finalDay, avoid);
  const id = `${kind === 'cup' ? 'C' : 'LC'}:${country}:${season}`;
  const comp: Comp = {
    id, kind: 'cup', def: kind, name: def.name, short: def.name, country, season, clubs: all, done: false, ties: [], rounds: [], scorers: {},
    meta: { lh: def.lh, et: def.et, sf: def.sf },
  };
  let di = 0;
  sizes.forEach((p, i) => {
    const isSemi = i === sizes.length - 2;
    const isFinal = i === sizes.length - 1;
    const legs: 1 | 2 = isSemi && def.sf === 2 ? 2 : 1;
    let rd: number[];
    if (isFinal) rd = [finalDay];
    else if (legs === 2) { rd = [days[di] ?? finalDay - 28, days[di + 1] ?? finalDay - 14]; di += 2; }
    else { rd = [days[di] ?? finalDay - (sizes.length - i) * 14]; di++; }
    comp.rounds!.push({ name: roundName(p.size, i, pre.length), days: rd, done: false, drawn: false, entrants: p.entrants, size: p.size, legs });
  });
  G.comps[id] = comp;
  drawCupRound(comp, 0);
  return comp;
}

export function drawCupRound(comp: Comp, ri: number) {
  const rd = comp.rounds![ri];
  if (rd.drawn) return;
  rd.drawn = true;
  let teams = rd.entrants!.slice();
  if (ri > 0) {
    for (const t of comp.ties!.filter((t) => t.ri === ri - 1)) if (t.winner != null) teams.push(t.winner);
  }
  const winners = ri < comp.rounds!.length - 1 ? comp.rounds![ri + 1].size! - comp.rounds![ri + 1].entrants!.length : 1;
  let matches = teams.length - winners;
  if (matches <= 0) {
    // everyone advances (bye round)
    rd.done = true;
    comp.meta.byes = (comp.meta.byes || {});
    comp.meta.byes[ri] = teams;
    for (const t of teams) comp.ties!.push({ id: G.nid.tie++, round: rd.name, ri, a: t, b: -1, legs: 1, fx: [], winner: t });
    if (ri + 1 < comp.rounds!.length) drawCupRound(comp, ri + 1);
    return;
  }
  const sorted = teams.slice().sort((a, b) => strength(b) - strength(a));
  const byes = sorted.slice(0, teams.length - 2 * matches);
  const playing = R.shuffle(sorted.slice(teams.length - 2 * matches));
  for (const t of byes) comp.ties!.push({ id: G.nid.tie++, round: rd.name, ri, a: t, b: -1, legs: 1, fx: [], winner: t });
  const isFinal = ri === comp.rounds!.length - 1;
  for (let i = 0; i < playing.length; i += 2) {
    let h = playing[i], a = playing[i + 1];
    if (comp.meta.lh && !isFinal && rd.legs === 1) {
      if (strength(h) - (strength(h) % 1000) < strength(a) - (strength(a) % 1000)) [h, a] = [a, h];
      else if (Math.floor(strength(h) / 1000) > Math.floor(strength(a) / 1000)) [h, a] = [a, h];
    }
    comp.ties!.push(makeTie(comp, ri, rd.name, h, a, rd.legs, isFinal));
  }
}

/** after fixtures played: progress knockout comps */
export function checkKnockout(comp: Comp) {
  if (comp.done || !comp.rounds) return;
  for (let ri = 0; ri < comp.rounds.length; ri++) {
    const rd = comp.rounds[ri];
    if (!rd.drawn || rd.done) continue;
    const ties = comp.ties!.filter((t) => t.ri === ri);
    let all = true;
    for (const t of ties) {
      if (t.winner != null) continue;
      const w = tieWinner(t);
      if (w == null) { all = false; continue; }
      t.winner = w;
    }
    if (!all) continue;
    rd.done = true;
    if (ri + 1 < comp.rounds.length) {
      if (comp.kind === 'po') drawPORound(comp, ri + 1);
      else if (comp.kind === 'euro') continue; // euro handled in euro.ts
      else drawCupRound(comp, ri + 1);
    } else {
      comp.done = true;
      const fin = ties.find((t) => t.b >= 0) || ties[0];
      comp.winner = fin.winner;
      comp.runnerUp = fin.winner === fin.a ? fin.b : fin.a;
    }
  }
}

function drawPORound(comp: Comp, ri: number) {
  const rd = comp.rounds![ri];
  if (rd.drawn) return;
  rd.drawn = true;
  const prev = comp.ties!.filter((t) => t.ri === ri - 1).map((t) => t.winner!);
  if (prev.length === 2) {
    const neutral = !!comp.meta.neutralFinal && rd.legs === 1;
    comp.ties!.push(makeTie(comp, ri, rd.name, prev[0], prev[1], rd.legs, neutral));
  }
}

// ---------- super cups ----------
export function createSuperCup(country: string, season: number, teams: number[], day: number, four: boolean): Comp | null {
  teams = teams.filter((t, i) => t != null && t >= 0 && teams.indexOf(t) === i);
  if (teams.length < 2) return null;
  const id = `S:${country}:${season}`;
  const n = four && teams.length >= 4 ? 4 : 2;
  const comp: Comp = {
    id, kind: 'super', def: 'super', name: `Суперкубок ${countryGen(country)}`, short: 'Суперкубок', country, season,
    clubs: teams.slice(0, n), done: false, ties: [], rounds: [], scorers: {}, meta: {},
  };
  if (n === 4) {
    comp.rounds!.push({ name: '1/2 финала', days: [day], done: false, drawn: true, legs: 1, entrants: [], size: 4 });
    comp.rounds!.push({ name: 'Финал', days: [day + 3], done: false, drawn: false, legs: 1, entrants: [], size: 2 });
    G.comps[id] = comp;
    comp.ties!.push(makeTie(comp, 0, '1/2 финала', teams[0], teams[3], 1, true));
    comp.ties!.push(makeTie(comp, 0, '1/2 финала', teams[1], teams[2], 1, true));
  } else {
    comp.rounds!.push({ name: 'Финал', days: [day], done: false, drawn: true, legs: 1, entrants: [], size: 2 });
    G.comps[id] = comp;
    comp.ties!.push(makeTie(comp, 0, 'Финал', teams[0], teams[1], 1, true));
  }
  return comp;
}

const GEN: Record<string, string> = {
  ENG: 'Англии', ESP: 'Испании', ITA: 'Италии', GER: 'Германии', FRA: 'Франции', RUS: 'России', NED: 'Нидерландов', POR: 'Португалии', BEL: 'Бельгии', TUR: 'Турции',
  ISR: 'Израиля', CYP: 'Кипра', CRO: 'Хорватии', ROU: 'Румынии', BUL: 'Болгарии', MDA: 'Молдавии', KAZ: 'Казахстана', ARM: 'Армении', GEO: 'Грузии', ALB: 'Албании', BLR: 'Беларуси', POL: 'Польши', UKR: 'Украины',
};
export function countryGen(c: string) {
  return GEN[c] || c;
}

export function frameFor(country: string, label: number) {
  return seasonFrame(ASSOC[country], label);
}

export { inRanges, weekday, nextWeekday };
