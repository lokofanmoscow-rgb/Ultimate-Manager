import type { PosCode, Duty } from './attrs';
import { posIndex, ROLE_BY_ID, roleRating } from './attrs';
import type { Club, Player, Selection, Tactic, TeamInstr } from './types';
import { G, P } from './state';
import { pr, isAvailable } from './player';

export interface Slot {
  pos: PosCode;
  x: number; // depth 0 (own goal) .. 1 (opp goal)
  y: number; // lateral -1 (left) .. 1 (right)
  role: string;
  duty: Duty;
}

const S = (pos: PosCode, x: number, y: number, role: string, duty: Duty): Slot => ({ pos, x, y, role, duty });
const GK = S('GK', 0.03, 0, 'GK', 'D');
const BACK4 = [S('DL', 0.22, -0.8, 'FB', 'S'), S('DC', 0.19, -0.28, 'CD', 'D'), S('DC', 0.19, 0.28, 'CD', 'D'), S('DR', 0.22, 0.8, 'FB', 'S')];
const BACK3 = [S('DC', 0.19, -0.42, 'CD', 'D'), S('DC', 0.17, 0, 'CD', 'D'), S('DC', 0.19, 0.42, 'CD', 'D')];
const BACK5 = [S('WBL', 0.3, -0.85, 'WB', 'S'), ...BACK3, S('WBR', 0.3, 0.85, 'WB', 'S')];

export const FORMATIONS: Record<string, Slot[]> = {
  '4-4-2': [GK, ...BACK4, S('ML', 0.47, -0.8, 'WM', 'S'), S('MC', 0.44, -0.25, 'CM', 'D'), S('MC', 0.44, 0.25, 'BBM', 'S'), S('MR', 0.47, 0.8, 'W', 'A'), S('ST', 0.77, -0.17, 'DLF', 'S'), S('ST', 0.79, 0.17, 'AF', 'A')],
  '4-3-3': [GK, ...BACK4, S('DM', 0.32, 0, 'DM', 'D'), S('MC', 0.45, -0.32, 'CM', 'S'), S('MC', 0.47, 0.32, 'BBM', 'S'), S('AML', 0.68, -0.78, 'IF', 'A'), S('AMR', 0.68, 0.78, 'W', 'A'), S('ST', 0.8, 0, 'AF', 'A')],
  '4-2-3-1': [GK, ...BACK4, S('DM', 0.33, -0.22, 'DLP', 'D'), S('DM', 0.33, 0.22, 'BWM', 'D'), S('AML', 0.65, -0.78, 'IF', 'S'), S('AMC', 0.62, 0, 'AM', 'A'), S('AMR', 0.65, 0.78, 'W', 'A'), S('ST', 0.8, 0, 'AF', 'A')],
  '4-1-4-1': [GK, ...BACK4, S('DM', 0.31, 0, 'A', 'D'), S('ML', 0.5, -0.8, 'W', 'S'), S('MC', 0.47, -0.27, 'CM', 'S'), S('MC', 0.47, 0.27, 'BBM', 'S'), S('MR', 0.5, 0.8, 'W', 'A'), S('ST', 0.79, 0, 'CF', 'A')],
  '4-4-1-1': [GK, ...BACK4, S('ML', 0.47, -0.8, 'WM', 'S'), S('MC', 0.44, -0.25, 'CM', 'D'), S('MC', 0.44, 0.25, 'CM', 'S'), S('MR', 0.47, 0.8, 'WM', 'A'), S('AMC', 0.64, 0, 'SS', 'A'), S('ST', 0.8, 0, 'TF', 'A')],
  '4-3-1-2': [GK, ...BACK4, S('DM', 0.32, 0, 'DM', 'D'), S('MC', 0.45, -0.32, 'CAR', 'S'), S('MC', 0.45, 0.32, 'MEZ', 'A'), S('AMC', 0.62, 0, 'AP', 'A'), S('ST', 0.79, -0.17, 'DLF', 'S'), S('ST', 0.8, 0.17, 'AF', 'A')],
  '4-3-2-1': [GK, ...BACK4, S('MC', 0.42, -0.35, 'CM', 'S'), S('MC', 0.4, 0, 'DLP', 'D'), S('MC', 0.42, 0.35, 'BBM', 'S'), S('AMC', 0.63, -0.25, 'SS', 'A'), S('AMC', 0.63, 0.25, 'AP', 'A'), S('ST', 0.8, 0, 'CF', 'A')],
  '4-5-1': [GK, ...BACK4, S('ML', 0.47, -0.82, 'WM', 'S'), S('MC', 0.44, -0.35, 'CM', 'S'), S('MC', 0.42, 0, 'DLP', 'D'), S('MC', 0.44, 0.35, 'BBM', 'S'), S('MR', 0.47, 0.82, 'WM', 'S'), S('ST', 0.78, 0, 'TF', 'S')],
  '4-2-2-2': [GK, ...BACK4, S('DM', 0.33, -0.22, 'DM', 'D'), S('DM', 0.33, 0.22, 'DLP', 'S'), S('AMC', 0.62, -0.42, 'AP', 'A'), S('AMC', 0.62, 0.42, 'IF', 'A'), S('ST', 0.8, -0.17, 'PF', 'S'), S('ST', 0.8, 0.17, 'AF', 'A')],
  '3-5-2': [GK, ...BACK3, S('WBL', 0.42, -0.85, 'WB', 'S'), S('DM', 0.33, 0, 'DM', 'D'), S('MC', 0.47, -0.3, 'MEZ', 'S'), S('MC', 0.47, 0.3, 'CM', 'S'), S('WBR', 0.42, 0.85, 'WB', 'A'), S('ST', 0.79, -0.17, 'DLF', 'S'), S('ST', 0.8, 0.17, 'AF', 'A')],
  '3-4-3': [GK, ...BACK3, S('ML', 0.45, -0.85, 'WM', 'S'), S('MC', 0.42, -0.25, 'CM', 'D'), S('MC', 0.42, 0.25, 'BBM', 'S'), S('MR', 0.45, 0.85, 'WM', 'S'), S('AML', 0.7, -0.6, 'IF', 'A'), S('AMR', 0.7, 0.6, 'IF', 'A'), S('ST', 0.8, 0, 'AF', 'A')],
  '3-4-2-1': [GK, ...BACK3, S('WBL', 0.42, -0.85, 'WB', 'S'), S('MC', 0.42, -0.22, 'DLP', 'D'), S('MC', 0.42, 0.22, 'BBM', 'S'), S('WBR', 0.42, 0.85, 'WB', 'S'), S('AMC', 0.64, -0.3, 'SS', 'A'), S('AMC', 0.64, 0.3, 'AP', 'A'), S('ST', 0.8, 0, 'CF', 'A')],
  '5-3-2': [GK, ...BACK5, S('MC', 0.44, -0.35, 'CM', 'S'), S('MC', 0.41, 0, 'DLP', 'D'), S('MC', 0.44, 0.35, 'BBM', 'S'), S('ST', 0.77, -0.17, 'TF', 'S'), S('ST', 0.78, 0.17, 'AF', 'A')],
  '5-4-1': [GK, ...BACK5, S('ML', 0.46, -0.78, 'WM', 'S'), S('MC', 0.43, -0.25, 'CM', 'D'), S('MC', 0.43, 0.25, 'CM', 'S'), S('MR', 0.46, 0.78, 'WM', 'S'), S('ST', 0.76, 0, 'TF', 'S')],
  '5-2-3': [GK, ...BACK5, S('MC', 0.42, -0.22, 'BWM', 'D'), S('MC', 0.42, 0.22, 'DLP', 'S'), S('AML', 0.68, -0.6, 'IF', 'A'), S('AMR', 0.68, 0.6, 'IF', 'A'), S('ST', 0.79, 0, 'AF', 'A')],
};
export const FORMATION_KEYS = Object.keys(FORMATIONS);

export const MENTALITY = ['Очень оборонительная', 'Оборонительная', 'Осторожная', 'Сбалансированная', 'Позитивная', 'Атакующая', 'Очень атакующая'];
export const PASSING = ['Гораздо короче', 'Короче', 'Стандартный', 'Более прямолинейный', 'Гораздо прямолинейнее'];
export const TEMPO = ['Гораздо ниже', 'Ниже', 'Стандартный', 'Выше', 'Гораздо выше'];
export const WIDTH = ['Очень узко', 'Узко', 'Стандартно', 'Широко', 'Очень широко'];
export const DLINE = ['Гораздо глубже', 'Глубже', 'Стандартная', 'Выше', 'Гораздо выше'];
export const LOE = ['Низкий блок', 'Средний блок', 'Высокий прессинг'];
export const PRESS = ['Реже', 'Стандартно', 'Чаще', 'Гораздо чаще'];
export const TACKLE = ['Не идти в подкаты', 'Стандартно', 'Жёсткий отбор'];
export const CROSS = ['Смешанные', 'Низом', 'Резкие', 'Навесные'];
export const FOCUS = ['Смешанно', 'Через левый фланг', 'Через центр', 'Через правый фланг'];
export const DRIBBLE = ['Меньше обводить', 'Стандартно', 'Больше обводить'];
export const GKDIST = ['Коротко защитникам', 'Смешанно', 'Длинно на нападающих'];

export function defaultTI(): TeamInstr {
  return {
    mentality: 3, passing: 2, tempo: 2, width: 2, dline: 2, loe: 1, press: 1, tackle: 1,
    counter: false, counterPress: false, offside: false, playOut: false, cross: 0, shootOnSight: false,
    workIntoBox: false, timeWaste: false, focus: 0, dribble: 1, gkDist: 1,
  };
}

export function makeTactic(formation: string, name = 'Тактика A'): Tactic {
  const f = FORMATIONS[formation];
  return { name, formation, slots: f.map((s) => ({ role: s.role, duty: s.duty })), ti: defaultTI() };
}

export function emptySelection(): Selection {
  return { lineup: new Array(11).fill(0), subs: [], cap: 0, pen: 0, fk: 0, crn: 0, auto: true };
}

/** player's effective score at a formation slot */
export function slotScore(p: Player, slot: Slot, roleId?: string): number {
  const r = pr(p)[posIndex(slot.pos)];
  const role = ROLE_BY_ID[roleId || slot.role];
  let s = r;
  if (role) s = r * 0.85 + roleRating(p.a, role) * 10 * 0.15;
  return s;
}

export function compTypeOf(compId: string): number {
  const c = G.comps[compId];
  if (!c) return 0;
  if (c.kind === 'league' || c.kind === 'po') return 0;
  if (c.kind === 'euro') return 2;
  return 1;
}

/** Pick best XI + bench. rotation: prefer fresh players. */
export function autoPick(club: Club, compType = 0, opts: { rotate?: boolean; benchSize?: number } = {}): Selection {
  const slots = FORMATIONS[club.tactic.formation];
  const avail = club.players.map(P).filter((p) => p && isAvailable(p, compType) && !(p.loan && p.club !== club.id));
  const score: number[][] = [];
  for (let si = 0; si < 11; si++) {
    score[si] = avail.map((p) => {
      let s = slotScore(p, slots[si], club.tactic.slots[si]?.role);
      const cf = p.cond >= 92 ? 1 : p.cond >= 80 ? 0.96 : p.cond >= 70 ? 0.88 : 0.75;
      s *= opts.rotate === false ? Math.max(cf, 0.9) : cf;
      if (slots[si].pos === 'GK' && p.pos[0] < 15) s *= 0.3;
      if (slots[si].pos !== 'GK' && p.pos[0] >= 15) s *= 0.25;
      return s;
    });
  }
  // greedy global assignment
  const pairs: [number, number, number][] = [];
  for (let si = 0; si < 11; si++) for (let pi = 0; pi < avail.length; pi++) pairs.push([score[si][pi], si, pi]);
  pairs.sort((a, b) => b[0] - a[0]);
  const lineup = new Array(11).fill(0);
  const usedS = new Set<number>(), usedP = new Set<number>();
  for (const [, si, pi] of pairs) {
    if (usedS.has(si) || usedP.has(pi)) continue;
    usedS.add(si);
    usedP.add(pi);
    lineup[si] = avail[pi].id;
    if (usedS.size === 11) break;
  }
  // bench: best remaining by best rating, ensure a GK
  const rest = avail.filter((_, i) => !usedP.has(i));
  rest.sort((a, b) => b.ca * (b.cond / 100) - a.ca * (a.cond / 100));
  const benchSize = opts.benchSize ?? 9;
  const subs: number[] = [];
  const gk = rest.find((p) => p.pos[0] >= 15);
  if (gk) subs.push(gk.id);
  for (const p of rest) {
    if (subs.length >= benchSize) break;
    if (!subs.includes(p.id) && !(p.pos[0] >= 15 && subs.length < benchSize - 1 && subs.filter((id) => P(id).pos[0] >= 15).length >= 1)) subs.push(p.id);
  }
  const sel: Selection = { lineup, subs, cap: 0, pen: 0, fk: 0, crn: 0, auto: true };
  pickTakers(sel);
  return sel;
}

export function pickTakers(sel: Selection) {
  const xi = sel.lineup.filter((x) => x).map(P);
  if (!xi.length) return;
  const best = (f: (p: Player) => number) => xi.reduce((a, b) => (f(b) > f(a) ? b : a)).id;
  if (!sel.cap || !sel.lineup.includes(sel.cap)) sel.cap = best((p) => p.hid[0] * 0 + p.a[22] * 2 + p.ca / 20 + (p.st.apps > 0 ? 1 : 0));
  if (!sel.pen || !sel.lineup.includes(sel.pen)) sel.pen = best((p) => p.a[11] * 2 + p.a[17] + p.a[3] * 0.5);
  if (!sel.fk || !sel.lineup.includes(sel.fk)) sel.fk = best((p) => p.a[5] * 2 + p.a[13] + p.a[7] * 0.5);
  if (!sel.crn || !sel.lineup.includes(sel.crn)) sel.crn = best((p) => p.a[0] * 2 + p.a[1] + p.a[13] * 0.5);
}

/** choose a formation that fits squad for AI clubs */
export function aiChooseFormation(club: Club, seed: number): string {
  const options = ['4-2-3-1', '4-3-3', '4-4-2', '4-1-4-1', '3-5-2', '4-4-1-1', '5-3-2', '3-4-2-1', '4-3-1-2', '5-4-1'];
  const weights = club.rep > 70 ? [30, 30, 8, 8, 8, 5, 2, 6, 3, 0] : club.rep > 45 ? [22, 18, 18, 10, 8, 8, 6, 4, 3, 3] : [14, 10, 30, 8, 6, 12, 8, 2, 2, 8];
  let tot = 0;
  for (const w of weights) tot += w;
  let r = (seed % 1000) / 1000 * tot;
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return '4-2-3-1';
}

/** team strength summary from selection */
export function teamRatings(club: Club, sel: Selection): { gk: number; def: number; mid: number; att: number; ovr: number } {
  const slots = FORMATIONS[club.tactic.formation];
  let gk = 0, d = 0, m = 0, a = 0, nd = 0, nm = 0, na = 0;
  const fam = (club.famil[club.tactic.formation] ?? 60) / 100;
  for (let i = 0; i < 11; i++) {
    const pid = sel.lineup[i];
    if (!pid && pid !== 0) continue;
    const p = G.players[pid];
    if (!p) continue;
    let r = slotScore(p, slots[i], club.tactic.slots[i]?.role);
    r *= 0.82 + 0.18 * (p.cond / 100);
    r *= 0.95 + 0.1 * (p.morale / 100);
    r *= 0.93 + 0.07 * fam;
    const g = slots[i].pos;
    if (g === 'GK') gk = r;
    else if (g === 'DC' || g === 'DL' || g === 'DR' || g === 'WBL' || g === 'WBR') { d += r; nd++; }
    else if (g === 'ST' || g === 'AML' || g === 'AMR' || g === 'AMC') { a += r; na++; }
    else { m += r; nm++; }
  }
  const def = nd ? d / nd : 50, mid = nm ? m / nm : def, att = na ? a / na : mid;
  const ovr = gk * 0.1 + def * 0.32 + mid * 0.3 + att * 0.28;
  return { gk: gk || 40, def, mid, att, ovr };
}
