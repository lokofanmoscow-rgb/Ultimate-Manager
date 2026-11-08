// UEFA club competitions: Champions League, Europa League, Conference League (2024+ format).
import type { Comp, Row, Tie } from './types';
import { G, R } from './state';
import { ASSOCS, ASSOC } from '../data/nations';
import { uefaDays } from './calendar';
import { makeTie, newRow, applyToTable, sortRows, newFixture, resolveClash, tieWinner, lastOrder } from './comps';
import { clubCoef } from './coef';

export const EURO_NAMES: Record<string, string> = { UCL: 'Лига чемпионов', UEL: 'Лига Европы', UECL: 'Лига конференций' };
const ROUND_NAMES: Record<string, string> = {
  Q0: 'Предварительный раунд', Q1: '1-й квалификационный раунд', Q2: '2-й квалификационный раунд', Q3: '3-й квалификационный раунд', PO: 'Раунд плей-офф',
  LP: 'Общий этап', KPO: 'Стыковые матчи плей-офф', R16: '1/8 финала', QF: '1/4 финала', SF: '1/2 финала', F: 'Финал',
};
const QROUNDS = ['Q0', 'Q1', 'Q2', 'Q3', 'PO'];

/** association ranking order (codes) */
export function assocRanking(): string[] {
  return Object.values(G.countries)
    .filter((c) => ASSOC[c.code])
    .sort((a, b) => b.coef.reduce((s, x) => s + x, 0) - a.coef.reduce((s, x) => s + x, 0))
    .map((c) => c.code);
}

interface Entry { club: number; comp: 'UCL' | 'UEL' | 'UECL'; stage: 'LP' | 'Q'; path: 'CP' | 'LP' | 'MP'; prio: number }

/** Build list of entries for season y from last completed seasons. */
function buildEntries(y: number): Entry[] {
  const rank = assocRanking();
  const entries: Entry[] = [];
  const taken = new Set<number>();
  const add = (club: number | undefined, comp: Entry['comp'], stage: Entry['stage'], path: Entry['path'], prio: number) => {
    if (club == null || club < 0 || taken.has(club)) return false;
    taken.add(club);
    entries.push({ club, comp, stage, path, prio });
    return true;
  };
  // title holders
  const h = G.euroHolders;
  if (h.UCL != null) add(h.UCL, 'UCL', 'LP', 'LP', 0);
  if (h.UEL != null) add(h.UEL, 'UCL', 'LP', 'LP', 0);
  if (h.UECL != null) add(h.UECL, 'UEL', 'LP', 'LP', 0);
  // EPS: two best associations of previous season -> 5th place in UCL LP
  const eps = new Set(rank.slice().sort((a, b) => (G.countries[b].coef[4] ?? 0) - (G.countries[a].coef[4] ?? 0)).slice(0, 2));
  rank.forEach((code, i) => {
    const r = i + 1;
    const order = lastOrder(code, 1);
    const cupW = G.countries[code].lastFinal?.cupWinner;
    let pos = 0; // pointer in league order
    const next = () => {
      while (pos < order.length && taken.has(order[pos])) pos++;
      return order[pos++];
    };
    const prio = r * 10;
    // UCL
    const champ = order[0];
    if (r <= 10) add(champ, 'UCL', 'LP', 'LP', prio); else add(champ, 'UCL', 'Q', 'CP', prio);
    pos = 1;
    if (r <= 6) add(next(), 'UCL', 'LP', 'LP', prio + 1); else if (r <= 15) add(next(), 'UCL', 'Q', 'LP', prio + 1);
    if (r <= 5) add(next(), 'UCL', 'LP', 'LP', prio + 2); else if (r <= 7) add(next(), 'UCL', 'Q', 'LP', prio + 2);
    if (r <= 4) add(next(), 'UCL', 'LP', 'LP', prio + 3);
    if (eps.has(code)) add(next(), 'UCL', 'LP', 'LP', prio + 4);
    // cup winner
    let cw = cupW;
    if (cw == null || taken.has(cw) || !order.includes(cw) && G.clubs[cw]?.country !== code) cw = undefined;
    if (r <= 6) { if (!add(cw, 'UEL', 'LP', 'LP', prio + 5)) add(next(), 'UEL', 'LP', 'LP', prio + 5); }
    else if (r <= 16) { if (!add(cw, 'UEL', 'Q', 'MP', prio + 5)) add(next(), 'UEL', 'Q', 'MP', prio + 5); }
    else { if (!add(cw, 'UECL', 'Q', 'MP', prio + 5)) add(next(), 'UECL', 'Q', 'MP', prio + 5); }
    // league places to UEL / UECL
    if (r <= 4) { add(next(), 'UEL', 'LP', 'LP', prio + 6); add(next(), 'UECL', 'Q', 'MP', prio + 7); }
    else if (r <= 6) { add(next(), 'UEL', 'LP', 'LP', prio + 6); add(next(), 'UECL', 'Q', 'MP', prio + 7); }
    else if (r <= 11) { add(next(), 'UEL', 'Q', 'MP', prio + 6); add(next(), 'UECL', 'Q', 'MP', prio + 7); }
    else if (r <= 15) { add(next(), 'UEL', 'Q', 'MP', prio + 6); add(next(), 'UECL', 'Q', 'MP', prio + 7); }
    else if (r <= 33) { add(next(), 'UECL', 'Q', 'MP', prio + 6); add(next(), 'UECL', 'Q', 'MP', prio + 7); }
    else { add(next(), 'UECL', 'Q', 'MP', prio + 6); if (r <= 50) add(next(), 'UECL', 'Q', 'MP', prio + 7); }
  });
  return entries;
}

/** solve entry rounds so that the bracket produces exactly T qualifiers without byes */
function solveRounds(nEntrants: number, T: number, droppers: Record<string, number>, maxRounds = 5): { rounds: string[]; x: Record<string, number> } | null {
  for (let nr = 1; nr <= maxRounds; nr++) {
    const rounds = QROUNDS.slice(QROUNDS.length - nr);
    if (Object.keys(droppers).some((r) => droppers[r] > 0 && r !== 'LP' && !rounds.includes(r))) continue;
    // coefficients c_r = 2^(r-1)-1 for r=1..nr, K = 2^nr*T - sum 2^(r-1) d_r - n
    let K = Math.pow(2, nr) * T - nEntrants;
    rounds.forEach((rd, i) => (K -= Math.pow(2, i) * (droppers[rd] || 0)));
    if (K < 0) continue;
    const x: Record<string, number> = {};
    let rem = K;
    for (let i = nr - 1; i >= 1; i--) {
      const c = Math.pow(2, i) - 1;
      const cap = i === nr - 1 ? T : nEntrants;
      x[rounds[i]] = Math.min(Math.floor(rem / c), cap);
      rem -= x[rounds[i]] * c;
    }
    if (rem !== 0) continue;
    let sumLater = 0;
    for (let i = 1; i < nr; i++) sumLater += x[rounds[i]];
    x[rounds[0]] = nEntrants - sumLater;
    if (x[rounds[0]] < 0) continue;
    if (x[rounds[0]] > 72 && nr < maxRounds) continue;
    // verify non-negative winners and even sizes
    let need = 2 * T;
    let ok = true;
    for (let i = nr - 1; i >= 0; i--) {
      const w = need - (droppers[rounds[i]] || 0) - x[rounds[i]];
      if (i === 0) { if (w !== 0) ok = false; break; }
      if (w < 0) { ok = false; break; }
      need = 2 * w;
    }
    if (ok) return { rounds, x };
  }
  return null;
}

function compId(code: string, y: number) {
  return `E:${code}:${y}`;
}

/** create UEFA comps for season y (called mid-June) */
export function createEuroSeason(y: number) {
  const entries = buildEntries(y);
  const days = uefaDays(y);
  for (const code of ['UCL', 'UEL', 'UECL'] as const) {
    const comp: Comp = {
      id: compId(code, y), kind: 'euro', def: code, name: EURO_NAMES[code], short: code, season: y, clubs: [], done: false,
      ties: [], rounds: [], scorers: {},
      meta: { direct: [] as number[], qual: {} as Record<string, number[]>, drop: {} as Record<string, number[]>, lpDays: (days as any)[code].LP, phase: 'Q' },
    };
    for (const e of entries.filter((e) => e.comp === code)) {
      comp.clubs.push(e.club);
      if (e.stage === 'LP') comp.meta.direct.push(e.club);
    }
    G.comps[comp.id] = comp;
  }
  planQualifying(y, entries);
}

const LOSER_ROUTE: Record<string, Record<string, [string, string]>> = {
  // comp -> `${path}:${round}` -> [targetComp, targetRound]
  UCL: { 'CP:Q1': ['UECL', 'Q2'], 'CP:Q2': ['UEL', 'Q3'], 'CP:Q3': ['UEL', 'PO'], 'CP:PO': ['UEL', 'LP'], 'LP:Q2': ['UEL', 'Q3'], 'LP:Q3': ['UEL', 'LP'], 'LP:PO': ['UEL', 'LP'], 'CP:Q0': ['UECL', 'Q1'] },
  UEL: { 'MP:Q1': ['UECL', 'Q2'], 'MP:Q2': ['UECL', 'Q3'], 'MP:Q3': ['UECL', 'PO'], 'MP:PO': ['UECL', 'LP'], 'MP:Q0': ['UECL', 'Q1'] },
  UECL: {},
};

function planQualifying(y: number, entries: Entry[]) {
  const ucl = G.comps[compId('UCL', y)], uel = G.comps[compId('UEL', y)], uecl = G.comps[compId('UECL', y)];
  const paths: { comp: Comp; path: 'CP' | 'LP' | 'MP'; ents: number[]; T: number }[] = [];
  const directUCL = ucl.meta.direct.length;
  const uclCP = entries.filter((e) => e.comp === 'UCL' && e.stage === 'Q' && e.path === 'CP').map((e) => e.club);
  const uclLP = entries.filter((e) => e.comp === 'UCL' && e.stage === 'Q' && e.path === 'LP').map((e) => e.club);
  const tLP = Math.min(2, Math.floor(uclLP.length / 2));
  const tCP = Math.max(0, 36 - directUCL - tLP);
  paths.push({ comp: ucl, path: 'CP', ents: uclCP, T: Math.min(tCP, Math.floor(uclCP.length / 2)) });
  paths.push({ comp: ucl, path: 'LP', ents: uclLP, T: tLP });
  // plan UCL first
  const dropCount: Record<string, Record<string, number>> = { UEL: {}, UECL: {} };
  const plans: Record<string, any> = {};
  for (const p of paths) {
    const sol = solveRounds(p.ents.length, p.T, {}) || { rounds: ['PO'], x: { PO: p.ents.length } };
    plans[`${p.comp.def}:${p.path}`] = { ...sol, T: p.T, ents: sortByCoef(p.ents) };
    // losers per round
    let need = 2 * p.T;
    const sizes: Record<string, number> = {};
    for (let i = sol.rounds.length - 1; i >= 0; i--) {
      sizes[sol.rounds[i]] = need;
      need = 2 * (need - sol.x[sol.rounds[i]]);
    }
    for (const rd of sol.rounds) {
      const route = LOSER_ROUTE.UCL[`${p.path}:${rd}`];
      if (route) dropCount[route[0]][route[1]] = (dropCount[route[0]][route[1]] || 0) + sizes[rd] / 2;
    }
  }
  // UEL
  const uelQ = entries.filter((e) => e.comp === 'UEL' && e.stage === 'Q').map((e) => e.club);
  const uelLPdrop = dropCount.UEL.LP || 0;
  const tUEL = Math.max(0, 36 - uel.meta.direct.length - uelLPdrop);
  const solUEL = solveRounds(uelQ.length, tUEL, dropCount.UEL) || solveRounds(uelQ.length, tUEL, {}) || { rounds: ['PO'], x: { PO: uelQ.length } };
  plans['UEL:MP'] = { ...solUEL, T: tUEL, ents: sortByCoef(uelQ) };
  {
    let need = 2 * tUEL;
    const sizes: Record<string, number> = {};
    for (let i = solUEL.rounds.length - 1; i >= 0; i--) {
      sizes[solUEL.rounds[i]] = need;
      need = 2 * (need - solUEL.x[solUEL.rounds[i]] - (dropCount.UEL[solUEL.rounds[i]] || 0));
    }
    for (const rd of solUEL.rounds) {
      const route = LOSER_ROUTE.UEL[`MP:${rd}`];
      if (route) dropCount[route[0]][route[1]] = (dropCount[route[0]][route[1]] || 0) + sizes[rd] / 2;
    }
  }
  const ueclQ = entries.filter((e) => e.comp === 'UECL').map((e) => e.club);
  const ueclLPdrop = dropCount.UECL.LP || 0;
  const tUECL = Math.max(0, 36 - uecl.meta.direct.length - ueclLPdrop);
  const solUECL = solveRounds(ueclQ.length, tUECL, dropCount.UECL) || solveRounds(ueclQ.length, tUECL, {}) || { rounds: ['PO'], x: { PO: ueclQ.length } };
  plans['UECL:MP'] = { ...solUECL, T: tUECL, ents: sortByCoef(ueclQ) };

  // assign entrants: strongest enter latest
  for (const key of Object.keys(plans)) {
    const [code, path] = key.split(':');
    const comp = G.comps[compId(code, y)];
    const pl = plans[key];
    const ents: number[] = pl.ents.slice();
    for (let i = pl.rounds.length - 1; i >= 0; i--) {
      const rd = pl.rounds[i];
      const k = pl.x[rd] || 0;
      const take = ents.splice(0, k);
      (comp.meta.qual[`${path}:${rd}`] ||= []).push(...take);
    }
    comp.meta.paths = comp.meta.paths || {};
    comp.meta.paths[path] = { rounds: pl.rounds, T: pl.T };
  }
  // create rounds in comps (Q rounds) and draw the first available ones
  const days = uefaDays(y);
  for (const code of ['UCL', 'UEL', 'UECL']) {
    const comp = G.comps[compId(code, y)];
    const roundsUsed = new Set<string>();
    for (const path of Object.keys(comp.meta.paths || {})) for (const rd of comp.meta.paths[path].rounds) roundsUsed.add(rd);
    for (const rd of QROUNDS) {
      if (!roundsUsed.has(rd)) continue;
      const d = (days as any)[code][rd === 'Q0' ? 'Q1' : rd] as number[];
      const dd = rd === 'Q0' ? [d[0] - 14, d[0] - 11] : d;
      comp.rounds!.push({ name: ROUND_NAMES[rd], days: dd, done: false, drawn: false, legs: 2, path: rd });
    }
    comp.meta.dropIn = {};
  }
  computeExpectedDrops(y);
  for (const code of ['UCL', 'UEL', 'UECL']) tryDrawQualifying(G.comps[compId(code, y)]);
}

function sortByCoef(ids: number[]): number[] {
  return ids.slice().sort((a, b) => clubCoef(b) - clubCoef(a));
}

function roundIndex(comp: Comp, rd: string) {
  return comp.rounds!.findIndex((r) => r.path === rd);
}

/** draw any qualifying round whose participants are all known */
export function tryDrawQualifying(comp: Comp) {
  if (!comp.meta.paths) return;
  for (const path of Object.keys(comp.meta.paths)) {
    const pr: string[] = comp.meta.paths[path].rounds;
    for (let i = 0; i < pr.length; i++) {
      const rd = pr[i];
      const ri = roundIndex(comp, rd);
      if (ri < 0) continue;
      const key = `${path}:${rd}`;
      if (comp.meta.drawn?.[key]) continue;
      // previous round of this path done?
      let teams: number[] = (comp.meta.qual[key] || []).slice();
      if (i > 0) {
        const prevKey = `${path}:${pr[i - 1]}`;
        if (!comp.meta.drawn?.[prevKey]) break;
        const prevTies = comp.ties!.filter((t) => t.path === prevKey);
        if (prevTies.some((t) => t.winner == null)) break;
        teams.push(...prevTies.map((t) => t.winner!));
      }
      // droppers expected?
      const expected = comp.meta.expDrop?.[rd] || 0;
      const got = (comp.meta.dropIn[rd] || []) as number[];
      if (got.length < expected) break;
      if (path === 'MP' || path === 'CP') teams.push(...got.filter((c: number) => !teams.includes(c)));
      comp.meta.dropIn[rd] = [];
      drawPairs(comp, ri, key, teams);
      (comp.meta.drawn ||= {})[key] = true;
    }
  }
}

function drawPairs(comp: Comp, ri: number, key: string, teams: number[]) {
  const rd = comp.rounds![ri];
  rd.drawn = true;
  if (teams.length % 2 === 1) {
    // safety: give the strongest a bye
    const s = sortByCoef(teams);
    const bye = s[0];
    teams = s.slice(1);
    comp.ties!.push({ id: G.nid.tie++, round: rd.name, ri, a: bye, b: -1, legs: 2, fx: [], winner: bye, path: key });
  }
  const sorted = sortByCoef(teams);
  const half = sorted.length / 2;
  const seeded = R.shuffle(sorted.slice(0, half));
  const unseeded = R.shuffle(sorted.slice(half));
  // avoid same association
  for (let i = 0; i < seeded.length; i++) {
    if (G.clubs[seeded[i]].country === G.clubs[unseeded[i]].country) {
      for (let j = 0; j < unseeded.length; j++) {
        if (j !== i && G.clubs[seeded[i]].country !== G.clubs[unseeded[j]].country && G.clubs[seeded[j]].country !== G.clubs[unseeded[i]].country) {
          [unseeded[i], unseeded[j]] = [unseeded[j], unseeded[i]];
          break;
        }
      }
    }
  }
  for (let i = 0; i < seeded.length; i++) {
    const first = R.chance(0.5);
    const t = makeTie(comp, ri, rd.name, first ? seeded[i] : unseeded[i], first ? unseeded[i] : seeded[i], 2, false, { path: key });
    comp.ties!.push(t);
  }
}

/** called after matches: progress euro competitions */
export function checkEuro(comp: Comp) {
  if (comp.done) return;
  const y = comp.season;
  // resolve tie winners
  for (const t of comp.ties!) {
    if (t.winner != null || t.b < 0) continue;
    const w = tieWinner(t);
    if (w != null) {
      t.winner = w;
      onTieDecided(comp, t);
    }
  }
  if (comp.meta.phase === 'Q') {
    tryDrawQualifying(comp);
    // all paths finished?
    let finished = true;
    for (const path of Object.keys(comp.meta.paths || {})) {
      const pr: string[] = comp.meta.paths[path].rounds;
      const last = `${path}:${pr[pr.length - 1]}`;
      if (!comp.meta.drawn?.[last]) { finished = false; break; }
      if (comp.ties!.filter((t) => t.path === last).some((t) => t.winner == null)) { finished = false; break; }
    }
    if (finished && G.day >= (comp.meta.lpDays[0] - 20)) startLeaguePhase(comp);
    else if (finished) comp.meta.qDone = true;
  } else if (comp.meta.phase === 'LP') {
    if (comp.meta.lpLeft > 0) return;
    startKnockout(comp);
  } else if (comp.meta.phase === 'KO') {
    progressKO(comp);
  }
}

function onTieDecided(comp: Comp, t: Tie) {
  if (!t.path) return;
  const [path, rd] = t.path.split(':');
  const route = LOSER_ROUTE[comp.def]?.[`${path}:${rd}`];
  if (!route) return;
  const loser = t.winner === t.a ? t.b : t.a;
  if (loser < 0) return;
  const target = G.comps[compId(route[0], comp.season)];
  if (!target) return;
  if (!target.clubs.includes(loser)) target.clubs.push(loser);
  if (route[1] === 'LP') {
    target.meta.direct.push(loser);
  } else {
    (target.meta.dropIn[route[1]] ||= []).push(loser);
    tryDrawQualifying(target);
  }
}

/** set expected droppers for each comp (once qualifying plans are known) */
export function computeExpectedDrops(y: number) {
  for (const code of ['UEL', 'UECL']) {
    const comp = G.comps[compId(code, y)];
    if (!comp) continue;
    comp.meta.expDrop = {};
  }
  for (const code of ['UCL', 'UEL']) {
    const comp = G.comps[compId(code, y)];
    if (!comp?.meta.paths) continue;
    for (const path of Object.keys(comp.meta.paths)) {
      const { rounds, T } = comp.meta.paths[path];
      let need = 2 * T;
      const sizes: Record<string, number> = {};
      for (let i = rounds.length - 1; i >= 0; i--) {
        sizes[rounds[i]] = need;
        const x = (comp.meta.qual[`${path}:${rounds[i]}`] || []).length;
        const d = comp.meta.expDrop?.[rounds[i]] || 0;
        need = 2 * (need - x - d);
      }
      for (const rd of rounds) {
        const route = LOSER_ROUTE[code][`${path}:${rd}`];
        if (route && route[1] !== 'LP') {
          const tgt = G.comps[compId(route[0], y)];
          tgt.meta.expDrop[route[1]] = (tgt.meta.expDrop[route[1]] || 0) + sizes[rd] / 2;
        }
      }
    }
  }
}

// ---------- league phase ----------
function startLeaguePhase(comp: Comp) {
  if (comp.meta.phase !== 'Q') return;
  comp.meta.phase = 'LP';
  const quals: number[] = [];
  for (const path of Object.keys(comp.meta.paths || {})) {
    const pr: string[] = comp.meta.paths[path].rounds;
    const last = `${path}:${pr[pr.length - 1]}`;
    for (const t of comp.ties!.filter((t) => t.path === last)) if (t.winner != null) quals.push(t.winner);
  }
  let teams = Array.from(new Set([...comp.meta.direct, ...quals]));
  // fit to 36
  if (teams.length > 36) teams = sortByCoef(teams).slice(0, 36);
  if (teams.length < 36) {
    const losers = comp.ties!.filter((t) => t.path?.endsWith(':PO') && t.winner != null).map((t) => (t.winner === t.a ? t.b : t.a)).filter((c) => c >= 0 && !teams.includes(c));
    for (const c of sortByCoef(losers)) if (teams.length < 36) teams.push(c);
    const pool = sortByCoef(comp.clubs.filter((c) => !teams.includes(c)));
    for (const c of pool) if (teams.length < 36) teams.push(c);
  }
  const holder = comp.def === 'UCL' ? G.euroHolders.UCL : comp.def === 'UEL' ? G.euroHolders.UEL : G.euroHolders.UECL;
  const sorted = sortByCoef(teams);
  if (holder != null && sorted.includes(holder)) {
    sorted.splice(sorted.indexOf(holder), 1);
    sorted.unshift(holder);
  }
  const nPots = comp.def === 'UECL' ? 6 : 4;
  const potSize = 36 / nPots;
  const pots: number[][] = [];
  for (let i = 0; i < nPots; i++) pots.push(sorted.slice(i * potSize, (i + 1) * potSize));
  const table: Record<number, Row> = {};
  for (const t of sorted) table[t] = newRow(t);
  comp.lp = { teams: sorted, pots, md: 0, table };
  const matches = drawLeaguePhase(pots, comp.def === 'UECL');
  const days: number[] = comp.meta.lpDays;
  const sched = scheduleMatchdays(matches, days.length, sorted);
  comp.meta.lpLeft = 0;
  sched.forEach((mdMatches, mi) => {
    for (const [h, a] of mdMatches) {
      const f = newFixture(comp.id, ROUND_NAMES.LP, mi + 1, days[mi], h, a, { grp: -1 });
      resolveClash(f, true);
      comp.meta.lpLeft++;
    }
  });
}

function drawLeaguePhase(pots: number[][], conference: boolean): [number, number][] {
  for (let attempt = 0; attempt < 400; attempt++) {
    const res = tryDrawLP(pots, conference);
    if (res) return res;
  }
  // fallback: ignore association constraint
  return tryDrawLP(pots, conference, true)!;
}

function tryDrawLP(pots: number[][], conference: boolean, relax = false): [number, number][] | null {
  const matches: [number, number][] = [];
  const opp = new Map<number, Set<number>>();
  const cnt = new Map<number, Record<string, number>>();
  const ok = (a: number, b: number) => {
    if (a === b) return false;
    if (opp.get(a)?.has(b)) return false;
    if (relax) return true;
    const ca = G.clubs[a].country, cb = G.clubs[b].country;
    if (ca === cb) return false;
    if ((cnt.get(a)?.[cb] || 0) >= 2 || (cnt.get(b)?.[ca] || 0) >= 2) return false;
    return true;
  };
  const link = (h: number, a: number) => {
    matches.push([h, a]);
    if (!opp.has(h)) opp.set(h, new Set());
    if (!opp.has(a)) opp.set(a, new Set());
    opp.get(h)!.add(a);
    opp.get(a)!.add(h);
    const ch = cnt.get(h) || {}; ch[G.clubs[a].country] = (ch[G.clubs[a].country] || 0) + 1; cnt.set(h, ch);
    const ca = cnt.get(a) || {}; ca[G.clubs[h].country] = (ca[G.clubs[h].country] || 0) + 1; cnt.set(a, ca);
  };
  const P = pots.length;
  if (!conference) {
    for (let i = 0; i < P; i++) {
      for (let j = i; j < P; j++) {
        const A = pots[i], B = pots[j];
        if (i === j) {
          // derangement without 2-cycles: a hosts sigma(a)
          let found = false;
          for (let t = 0; t < 60 && !found; t++) {
            const perm = R.shuffle(A.slice());
            // cycle through permutation order: perm[k] hosts perm[k+1]
            let good = true;
            for (let k = 0; k < perm.length; k++) if (!ok(perm[k], perm[(k + 1) % perm.length])) { good = false; break; }
            if (good) {
              for (let k = 0; k < perm.length; k++) link(perm[k], perm[(k + 1) % perm.length]);
              found = true;
            }
          }
          if (!found) return null;
        } else {
          let found = false;
          for (let t = 0; t < 80 && !found; t++) {
            const p1 = R.shuffle(B.slice()), p2 = R.shuffle(B.slice());
            let good = true;
            for (let k = 0; k < A.length; k++) {
              if (p1[k] === p2[k] || !ok(A[k], p1[k]) || !ok(A[k], p2[k])) { good = false; break; }
            }
            if (good) {
              for (let k = 0; k < A.length; k++) { link(A[k], p1[k]); link(p2[k], A[k]); }
              found = true;
            }
          }
          if (!found) return null;
        }
      }
    }
  } else {
    // one opponent from each pot (6 pots of 6)
    const edges: [number, number][] = [];
    for (let i = 0; i < P; i++) {
      for (let j = i; j < P; j++) {
        const A = pots[i], B = pots[j];
        let found = false;
        for (let t = 0; t < 80 && !found; t++) {
          if (i === j) {
            const perm = R.shuffle(A.slice());
            let good = true;
            for (let k = 0; k < perm.length; k += 2) if (!ok(perm[k], perm[k + 1])) { good = false; break; }
            if (good) { for (let k = 0; k < perm.length; k += 2) { link(perm[k], perm[k + 1]); edges.push([perm[k], perm[k + 1]]); matches.pop(); } found = true; }
          } else {
            const p1 = R.shuffle(B.slice());
            let good = true;
            for (let k = 0; k < A.length; k++) if (!ok(A[k], p1[k])) { good = false; break; }
            if (good) { for (let k = 0; k < A.length; k++) { link(A[k], p1[k]); edges.push([A[k], p1[k]]); matches.pop(); } found = true; }
          }
        }
        if (!found) return null;
      }
    }
    // orient edges: each team 3 home 3 away (Euler orientation on 6-regular graph)
    return orientEuler(edges);
  }
  return matches;
}

function orientEuler(edges: [number, number][]): [number, number][] {
  const adj = new Map<number, { to: number; e: number }[]>();
  edges.forEach(([a, b], i) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, e: i });
    adj.get(b)!.push({ to: a, e: i });
  });
  const used = new Array(edges.length).fill(false);
  const out: [number, number][] = [];
  for (const start of adj.keys()) {
    const stack = [start];
    while (stack.length) {
      const v = stack[stack.length - 1];
      const lst = adj.get(v)!;
      let moved = false;
      while (lst.length) {
        const { to, e } = lst.pop()!;
        if (used[e]) continue;
        used[e] = true;
        out.push([v, to]);
        stack.push(to);
        moved = true;
        break;
      }
      if (!moved) stack.pop();
    }
  }
  return out;
}

/** assign each match to a matchday so every team plays once per matchday */
function scheduleMatchdays(matches: [number, number][], nMD: number, teams: number[]): [number, number][][] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const order = R.shuffle(matches.slice());
    const busy = new Map<number, Set<number>>();
    teams.forEach((t) => busy.set(t, new Set()));
    const md: [number, number][][] = Array.from({ length: nMD }, () => []);
    const assign = (k: number): boolean => {
      if (k === order.length) return true;
      const [h, a] = order[k];
      const start = R.int(0, nMD - 1);
      for (let s = 0; s < nMD; s++) {
        const d = (start + s) % nMD;
        if (busy.get(h)!.has(d) || busy.get(a)!.has(d)) continue;
        busy.get(h)!.add(d); busy.get(a)!.add(d); md[d].push([h, a]);
        if (assign(k + 1)) return true;
        busy.get(h)!.delete(d); busy.get(a)!.delete(d); md[d].pop();
        if (++steps > 20000) return false;
      }
      return false;
    };
    let steps = 0;
    if (assign(0)) return md;
  }
  // fallback: greedy (may create a few duplicate days)
  const md: [number, number][][] = Array.from({ length: nMD }, () => []);
  matches.forEach((m, i) => md[i % nMD].push(m));
  return md;
}

export function lpStandings(comp: Comp): number[] {
  if (!comp.lp) return [];
  return sortRows(comp, comp.lp.teams, comp.lp.table);
}

export function applyEuroLP(comp: Comp, f: { home: number; away: number; hg: number; ag: number } & any) {
  if (comp.lp) applyToTable(comp.lp.table, f);
}

// ---------- knockout ----------
function startKnockout(comp: Comp) {
  comp.meta.phase = 'KO';
  const order = lpStandings(comp);
  comp.meta.lpFinal = order;
  const days = (uefaDays(comp.season) as any)[comp.def];
  const pos = (i: number) => order[i - 1];
  // KPO: (9/10 v 23/24), (11/12 v 21/22), (13/14 v 19/20), (15/16 v 17/18)
  comp.rounds!.push({ name: ROUND_NAMES.KPO, days: days.KPO, done: false, drawn: true, legs: 2, path: 'KPO' });
  comp.rounds!.push({ name: ROUND_NAMES.R16, days: days.R16, done: false, drawn: false, legs: 2, path: 'R16' });
  comp.rounds!.push({ name: ROUND_NAMES.QF, days: days.QF, done: false, drawn: false, legs: 2, path: 'QF' });
  comp.rounds!.push({ name: ROUND_NAMES.SF, days: days.SF, done: false, drawn: false, legs: 2, path: 'SF' });
  comp.rounds!.push({ name: ROUND_NAMES.F, days: days.F, done: false, drawn: false, legs: 1, path: 'F' });
  const ri = roundIndex(comp, 'KPO');
  // explicit bracket
  const s = (a: number, b: number) => (R.chance(0.5) ? [pos(a), pos(b)] : [pos(b), pos(a)]);
  const top = [s(9, 10), s(11, 12), s(13, 14), s(15, 16)];
  const bot = [s(23, 24), s(21, 22), s(19, 20), s(17, 18)];
  comp.meta.bracket = { kpo: [] as number[] };
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < 2; j++) {
      const hi = top[k][j], lo = bot[k][j];
      if (hi == null || lo == null) continue;
      const t = makeTie(comp, ri, ROUND_NAMES.KPO, lo, hi, 2, false, { path: 'KPO' });
      comp.ties!.push(t);
      comp.meta.bracket.kpo.push(t.id);
    }
  }
  // R16 slots: seeds 1..8 paired with KPO winners: (1/2) v (15/16 v 17/18), (3/4) v (13/14 v 19/20), (5/6) v (11/12 v 21/22), (7/8) v (9/10 v 23/24)
  comp.meta.r16seed = [s(1, 2), s(3, 4), s(5, 6), s(7, 8)];
}

function progressKO(comp: Comp) {
  const order = ['KPO', 'R16', 'QF', 'SF', 'F'];
  for (let k = 0; k < order.length; k++) {
    const rd = order[k];
    const ri = roundIndex(comp, rd);
    const r = comp.rounds![ri];
    if (!r.drawn || r.done) continue;
    const ties = comp.ties!.filter((t) => t.path === rd);
    if (!ties.length || ties.some((t) => t.winner == null)) return;
    r.done = true;
    if (rd === 'F') {
      comp.done = true;
      comp.winner = ties[0].winner;
      comp.runnerUp = ties[0].winner === ties[0].a ? ties[0].b : ties[0].a;
      return;
    }
    const next = order[k + 1];
    const nri = roundIndex(comp, next);
    const nr = comp.rounds![nri];
    nr.drawn = true;
    if (rd === 'KPO') {
      // kpo ties order: k=0..3 (pairs j=0,1). bracket slot mapping
      const kt = comp.meta.bracket.kpo.map((id: number) => comp.ties!.find((t) => t.id === id)!);
      // kt[0],kt[1] from 9/10 v 23/24 ; kt[2],kt[3] from 11/12 ; kt[4],kt[5] 13/14 ; kt[6],kt[7] 15/16
      const seeds = comp.meta.r16seed;
      const map = [[seeds[0], [kt[6], kt[7]]], [seeds[1], [kt[4], kt[5]]], [seeds[2], [kt[2], kt[3]]], [seeds[3], [kt[0], kt[1]]]] as any[];
      const r16: Tie[] = [];
      for (const [sd, kts] of map) {
        const ws = R.shuffle([kts[0]?.winner, kts[1]?.winner].filter((x: any) => x != null));
        for (let j = 0; j < 2; j++) {
          if (sd[j] == null || ws[j] == null) continue;
          const t = makeTie(comp, nri, nr.name, ws[j], sd[j], 2, false, { path: 'R16' });
          comp.ties!.push(t);
          r16.push(t);
        }
      }
      comp.meta.bracket.r16 = r16.map((t) => t.id);
    } else {
      const prevIds: number[] = rd === 'R16' ? comp.meta.bracket.r16 : comp.meta.bracket[rd.toLowerCase()];
      const prev = (prevIds || ties.map((t) => t.id)).map((id) => comp.ties!.find((t) => t.id === id)!);
      const nt: Tie[] = [];
      for (let i = 0; i + 1 < prev.length; i += 2) {
        const a = prev[i].winner!, b = prev[i + 1].winner!;
        const legs = next === 'F' ? 1 : 2;
        const first = R.chance(0.5);
        const t = makeTie(comp, nri, nr.name, first ? a : b, first ? b : a, legs as 1 | 2, next === 'F', { path: next });
        comp.ties!.push(t);
        nt.push(t);
      }
      comp.meta.bracket[next.toLowerCase()] = nt.map((t) => t.id);
    }
    return;
  }
}

export function euroCompsOfSeason(y: number): Comp[] {
  return ['UCL', 'UEL', 'UECL'].map((c) => G.comps[compId(c, y)]).filter(Boolean);
}

export function checkEuroTimers() {
  // start league phase on the scheduled date even if checks didn't trigger
  for (const y of [G.season, G.season + 1]) for (const comp of euroCompsOfSeason(y)) {
    if (comp.meta.phase === 'Q') {
      tryDrawQualifying(comp);
      for (const rd of comp.rounds!) {
        if (rd.drawn && !rd.done) {
          const ts = comp.ties!.filter((t) => t.round === rd.name);
          if (ts.length && ts.every((t) => t.winner != null)) rd.done = true;
        }
      }
    }
    if (comp.meta.phase === 'Q' && comp.meta.qDone && G.day >= comp.meta.lpDays[0] - 20) startLeaguePhase(comp);
  }
}

export { ASSOCS };
