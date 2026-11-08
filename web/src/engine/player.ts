import { A, H, NUM_ATTRS, POS, POS_W, PosCode, posIndex, posRaw, famFactor, bestPos, baseValue, expectedWage, roundWage, POS_GROUP } from './attrs';
import type { Player } from './types';
import { emptyStats } from './types';
import { RNG, clamp, dayOf, ageAt, ymd } from './util';
import { NATION } from '../data/nations';
import { NAME_POOLS } from '../data/names';
import { G, R } from './state';

const poolCache: Record<string, [string[], string[]]> = {};
function pool(key: string): [string[], string[]] {
  if (!poolCache[key]) {
    const p = NAME_POOLS[key] || NAME_POOLS.en;
    poolCache[key] = [p[0].split(/\s+/).map((s) => s.replace(/_/g, ' ')), p[1].split(/\s+/).map((s) => s.replace(/_/g, ' '))];
  }
  return poolCache[key];
}

export function randomName(nat: string, rng: RNG): [string, string] {
  const n = NATION[nat];
  const [f, l] = pool(n ? n.pool : 'en');
  let fn = rng.pick(f);
  let ln = rng.pick(l);
  if (n && n.pool === 'br' && rng.chance(0.25)) {
    // Brazilian mononyms are common
    return ['', fn + (rng.chance(0.4) ? 'нью' : '')];
  }
  return [fn, ln];
}

// position relations for secondary familiarity
const REL: Record<PosCode, [PosCode, number][]> = {
  GK: [],
  DC: [['DM', 9], ['DR', 8], ['DL', 7]],
  DL: [['WBL', 16], ['DC', 9], ['ML', 10], ['DR', 6]],
  DR: [['WBR', 16], ['DC', 9], ['MR', 10], ['DL', 6]],
  WBL: [['DL', 15], ['ML', 13], ['AML', 8]],
  WBR: [['DR', 15], ['MR', 13], ['AMR', 8]],
  DM: [['MC', 15], ['DC', 9]],
  MC: [['DM', 13], ['AMC', 12], ['ML', 7], ['MR', 7]],
  ML: [['AML', 15], ['MC', 9], ['WBL', 10], ['MR', 8]],
  MR: [['AMR', 15], ['MC', 9], ['WBR', 10], ['ML', 8]],
  AMC: [['MC', 13], ['ST', 11], ['AML', 9], ['AMR', 9]],
  AML: [['ML', 15], ['AMR', 11], ['ST', 10], ['AMC', 9]],
  AMR: [['MR', 15], ['AML', 11], ['ST', 10], ['AMC', 9]],
  ST: [['AMC', 10], ['AML', 7], ['AMR', 7]],
};

export function makeFamiliarity(pos: PosCode, rng: RNG): number[] {
  const f = new Array(14).fill(0);
  f[posIndex(pos)] = 20;
  for (const [p, v] of REL[pos]) {
    const val = clamp(Math.round(v + rng.gauss(0, 3)), 1, 19);
    if (rng.chance(0.75)) f[posIndex(p)] = val;
  }
  if (pos !== 'GK') for (let i = 1; i < 14; i++) if (!f[i]) f[i] = rng.chance(0.15) ? rng.int(2, 9) : rng.int(1, 3);
  return f;
}

/** generate an attribute set for position with target CA */
export function genAttrs(pos: PosCode, ca: number, age: number, rng: RNG, style?: string): number[] {
  const pi = posIndex(pos);
  const w = POS_W[pi];
  const m = ca / 10;
  const a = new Array(NUM_ATTRS).fill(0);
  const isGK = pos === 'GK';
  for (let i = 0; i < NUM_ATTRS; i++) {
    let v: number;
    const isGkAttr = i >= 36;
    if (isGK) {
      if (isGkAttr || w[i] > 0) v = m + (w[i] / 5) * 2.2 + rng.gauss(0, 1.4);
      else if (i < 14) v = Math.min(m * 0.5, 9) + rng.gauss(0, 1.5);
      else if (i < 28) v = m - 1.5 + rng.gauss(0, 2.2);
      else v = m - 2 + rng.gauss(0, 2);
    } else {
      if (isGkAttr) v = rng.int(1, 4);
      else if (w[i] > 0) v = m + 0.4 + (w[i] / 5) * 2.2 + rng.gauss(0, 1.5);
      else if (i < 14) v = m - 3 + rng.gauss(0, 2.3);
      else if (i < 28) v = m - 1.2 + rng.gauss(0, 2.3);
      else v = m - 1 + rng.gauss(0, 2.2);
    }
    a[i] = v;
  }
  // age adjustments
  if (age < 20) {
    a[A.STR] -= 2 + (20 - age) * 0.6;
    a[A.STA] -= 1;
    a[A.CMP] -= 1;
    a[A.DEC] -= 1;
  } else if (age > 29) {
    const d = (age - 29) * 0.55;
    a[A.PAC] -= d;
    a[A.ACC] -= d;
    a[A.AGI] -= d * 0.6;
    a[A.STA] -= d * 0.5;
    a[A.CMP] += 1;
    a[A.DEC] += 1;
    a[A.ANT] += 1;
  }
  if (style === 'tall') {
    a[A.HEA] += 2; a[A.JUM] += 3; a[A.STR] += 2; a[A.PAC] -= 1;
  } else if (style === 'fast') {
    a[A.PAC] += 3; a[A.ACC] += 3; a[A.STR] -= 1;
  }
  // set pieces specialists randomly
  if (!isGK && rng.chance(0.08)) { a[A.FRE] += 5; a[A.COR] += 4; }
  if (!isGK && rng.chance(0.06)) { a[A.PEN] += 4; }
  if (!isGK && rng.chance(0.04)) { a[A.LTH] += 8; }
  // calibrate to target CA
  for (let it = 0; it < 6; it++) {
    for (let i = 0; i < NUM_ATTRS; i++) a[i] = clamp(a[i], 1, 20);
    const cur = posRaw(a, pi) * 10;
    const diff = (ca - cur) / 10;
    if (Math.abs(diff) < 0.05) break;
    for (let i = 0; i < NUM_ATTRS; i++) {
      if (w[i] > 0) a[i] += diff * 1.05;
      else if (!(isGK ? false : i >= 36)) a[i] += diff * 0.5;
    }
  }
  for (let i = 0; i < NUM_ATTRS; i++) a[i] = clamp(Math.round(a[i]), 1, 20);
  return a;
}

export function genHidden(rng: RNG): number[] {
  const h = new Array(13).fill(0).map(() => clamp(Math.round(rng.gauss(11.5, 3.6)), 1, 20));
  h[H.INJP] = clamp(Math.round(rng.gauss(8, 3.5)), 1, 20);
  h[H.DIRT] = clamp(Math.round(rng.gauss(7, 3.5)), 1, 20);
  h[H.CONT] = clamp(Math.round(rng.gauss(7, 3.5)), 1, 20);
  return h;
}

export interface GenOpts {
  nat: string;
  pos: PosCode;
  ca: number;
  pa?: number;
  age: number;
  club: number;
  wageScale: number;
  seasonYear: number;
  fn?: string;
  ln?: string;
  real?: boolean;
  birthYear?: number;
  rep?: number;
}

export function heightFor(pos: PosCode, rng: RNG): number {
  const base: Record<string, number> = { GK: 190, DC: 187, DL: 178, DR: 178, WBL: 177, WBR: 177, DM: 182, MC: 179, ML: 176, MR: 176, AMC: 177, AML: 175, AMR: 175, ST: 183 };
  return Math.round(clamp(rng.gauss(base[pos], 5.5), 160, 204));
}

export function genPlayer(o: GenOpts): Player {
  const rng = R;
  const id = G.nid.p++;
  const [fn, ln] = o.ln ? [o.fn || '', o.ln] : randomName(o.nat, rng);
  const by = o.birthYear ?? o.seasonYear - o.age;
  const dob = dayOf(by, rng.int(1, 12), rng.int(1, 28));
  const age = ageAt(dob, dayOf(o.seasonYear, 7, 1));
  const h = heightFor(o.pos, rng);
  const left = o.pos.endsWith('L') ? rng.chance(0.6) : rng.chance(0.2);
  const both = rng.chance(0.06);
  const strong = 20, weak = both ? rng.int(14, 18) : rng.int(3, 10);
  const style = h >= 190 ? 'tall' : rng.chance(0.15) ? 'fast' : undefined;
  const a = genAttrs(o.pos, o.ca, age, rng, style);
  const pos = makeFamiliarity(o.pos, rng);
  let pa = o.pa ?? potentialFor(o.ca, age, rng);
  pa = Math.max(pa, o.ca);
  const p: Player = {
    id, fn, ln, nat: o.nat, dob, h, wt: Math.round(h - 105 + rng.gauss(0, 4)),
    fl: left ? strong : weak, fr: left ? weak : strong,
    pos, a, hid: genHidden(rng), ca: o.ca, pa, club: o.club,
    wage: 0, cEnd: 0, value: 0, rep: 0,
    cond: 100, sharp: 70 + rng.int(0, 25), morale: 65 + rng.int(0, 20),
    ban: [0, 0, 0], yc: [0, 0, 0], form: [], st: emptyStats(), hist: [], status: 2, shirt: 0, joined: G.day, devAcc: 0,
  };
  if (o.real) p.real = 1;
  p.ca = calcCAp(p);
  p.rep = clamp(Math.round((o.rep ?? 40) * 0.5 + (p.ca - 60) * 0.42), 1, 100);
  p.wage = roundWage(expectedWage(p.ca, age, o.wageScale) * rng.range(0.8, 1.2));
  const yrs = age >= 32 ? rng.int(1, 2) : age <= 20 ? rng.int(2, 5) : rng.int(1, 5);
  p.cEnd = dayOf(o.seasonYear + yrs, 6, 30);
  p.pr = computePR(p);
  return p;
}

export function potentialFor(ca: number, age: number, rng: RNG): number {
  let gap = 0;
  if (age <= 17) gap = rng.range(25, 75);
  else if (age <= 19) gap = rng.range(15, 60);
  else if (age <= 21) gap = rng.range(8, 40);
  else if (age <= 23) gap = rng.range(3, 22);
  else if (age <= 26) gap = rng.range(0, 10);
  else gap = rng.range(0, 3);
  if (rng.chance(0.03) && age <= 20) gap += 30;
  return clamp(Math.round(ca + gap), ca, 200);
}

// ---- cached position ratings (transient) ----
declare module './types' {
  interface Player {
    pr?: number[];
  }
}
export function computePR(p: Player): number[] {
  const r = new Array(14);
  for (let i = 0; i < 14; i++) r[i] = Math.round(posRaw(p.a, i) * 10 * famFactor(p.pos[i] ?? 0) * 10) / 10;
  return r;
}
export function pr(p: Player): number[] {
  if (!p.pr) p.pr = computePR(p);
  return p.pr;
}
export function calcCAp(p: Player): number {
  return Math.round(bestPos(p.a, p.pos).r);
}
export function mainPos(p: Player): PosCode {
  const r = pr(p);
  let best = 0;
  for (let i = 1; i < 14; i++) if (r[i] > r[best] && p.pos[i] >= 15) best = i;
  if (p.pos[best] < 15) {
    for (let i = 0; i < 14; i++) if (p.pos[i] === 20) return POS[i];
  }
  return POS[best];
}
export function posGroup(p: Player) {
  return POS_GROUP[mainPos(p)];
}
export function age(p: Player): number {
  return ageAt(p.dob, G.day);
}
export function fullName(p: Player): string {
  return p.fn ? `${p.fn} ${p.ln}` : p.ln;
}
export function shortName(p: Player): string {
  return p.fn ? `${p.fn[0]}. ${p.ln}` : p.ln;
}

export function leagueMult(clubId: number): number {
  if (clubId < 0) return 0.5;
  const c = G.clubs[clubId];
  return clamp(c.wageScale, 0.1, 1.6);
}

export function updateValue(p: Player) {
  const yrs = (p.cEnd - G.day) / 365;
  const lm = p.club >= 0 ? clamp(0.4 + G.clubs[p.club].rep / 110, 0.4, 1.3) : 0.6;
  p.value = baseValue(p.ca, p.pa, age(p), lm, yrs, p.rep);
}

/** asking price of selling club */
export function askingPrice(p: Player): number {
  if (p.club < 0) return 0;
  const yrs = (p.cEnd - G.day) / 365;
  let m = 1.25;
  if (p.status <= 1) m = 1.6;
  if (p.listed === 1) m = 0.95;
  if (yrs < 1) m *= 0.75;
  if (p.wantsOut) m *= 0.85;
  let price = p.value * m;
  if (p.rc && p.rc < price) price = p.rc;
  return Math.max(0, Math.round(price / 50000) * 50000);
}

export function isAvailable(p: Player, compType: number): boolean {
  if (p.inj && p.inj.until > G.day) return false;
  if (p.ban[compType] > 0) return false;
  return true;
}

export function seasonAvg(p: Player): number {
  return p.st.ratN ? p.st.rat / p.st.ratN : 0;
}

export function injuryName(rng: RNG): [string, number] {
  const list: [string, number, number][] = [
    ['Ушиб', 3, 10], ['Растяжение мышц бедра', 10, 28], ['Повреждение подколенного сухожилия', 14, 45], ['Растяжение связок голеностопа', 10, 35],
    ['Травма паха', 10, 30], ['Повреждение икроножной мышцы', 12, 35], ['Травма колена', 20, 60], ['Перелом плюсневой кости', 50, 90],
    ['Разрыв крестообразных связок', 180, 280], ['Сотрясение мозга', 7, 14], ['Травма спины', 7, 21], ['Вывих плеча', 21, 45], ['Болезнь (вирус)', 3, 8],
  ];
  const wts = [30, 22, 12, 14, 8, 10, 5, 2, 1, 3, 6, 2, 10];
  const i = rng.weightedIndex(wts);
  return [list[i][0], rng.int(list[i][1], list[i][2])];
}

export const STATUS_NAMES = ['Ключевой игрок', 'Игрок основы', 'Ротация', 'Запасной', 'Перспективный'];

export function birthYear(p: Player) {
  return ymd(p.dob).y;
}
