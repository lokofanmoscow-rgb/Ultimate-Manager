// Player development, aging, retirement and youth intake.
import type { Club, Player } from './types';
import { G, R, P } from './state';
import { A, H, NUM_ATTRS, POS_W, posIndex, PosCode } from './attrs';
import { age, calcCAp, computePR, genPlayer, updateValue, fullName } from './player';
import { clamp, dayOf, ymd } from './util';
import { addMsg, addNews } from './inbox';
import { ASSOC, NATION } from '../data/nations';
import { assignShirts } from './world';

const FOCUS_ATTRS: Record<number, number[]> = {
  1: [A.FIN, A.OTB, A.DRI, A.TEC, A.FIR, A.CMP, A.LON],
  2: [A.TCK, A.MAR, A.POS, A.HEA, A.ANT, A.CNT, A.BRA],
  3: [A.DEC, A.ANT, A.POS, A.TEA, A.VIS, A.OTB, A.CNT],
  4: [A.PAC, A.ACC, A.STA, A.STR, A.AGI, A.BAL, A.JUM, A.NAT],
  5: [A.COR, A.FRE, A.PEN, A.CRO, A.LTH, A.HEA],
};
const PHYS: number[] = [A.PAC, A.ACC, A.STA, A.AGI, A.JUM, A.BAL, A.STR, A.NAT];

function mainPi(p: Player): number {
  let best = 0;
  for (let i = 0; i < 14; i++) if (p.pos[i] > p.pos[best]) best = i;
  return best;
}

export function developPlayer(p: Player, months = 1) {
  const a = age(p);
  let base: number;
  if (a <= 18) base = 1.0;
  else if (a <= 20) base = 0.8;
  else if (a <= 22) base = 0.55;
  else if (a <= 24) base = 0.32;
  else if (a <= 27) base = 0.1;
  else if (a <= 29) base = -0.08;
  else if (a <= 31) base = -0.35;
  else if (a <= 33) base = -0.7;
  else base = -1.15;
  const club = p.club >= 0 ? G.clubs[p.club] : null;
  let delta: number;
  if (base > 0) {
    const gap = Math.max(0, p.pa - p.ca);
    const gapF = clamp(gap / 30, 0, 1.6);
    const fac = club ? 0.75 + club.facT / 45 : 0.6;
    const prof = 0.75 + (p.hid[H.PROF] + p.a[A.DET]) / 80;
    const play = 0.7 + clamp(p.st.min / Math.max(1, monthsIntoSeason() * 300), 0, 1) * 0.6;
    let coach = 1;
    if (club && club.id === G.user) coach = 0.9 + coachingQuality(club) / 100 + (G.training.intensity === 2 ? 0.08 : G.training.intensity === 0 ? -0.06 : 0);
    delta = base * gapF * fac * prof * play * coach * months * R.range(0.6, 1.4);
  } else {
    delta = base * (1.25 - p.a[A.NAT] / 40) * months * R.range(0.6, 1.4);
  }
  p.devAcc += delta;
  const target = clamp(p.ca + Math.trunc(p.devAcc), 1, p.pa);
  if (Math.trunc(p.devAcc) !== 0) p.devAcc -= Math.trunc(p.devAcc);
  if (target === p.ca) return;
  const pi = mainPi(p);
  const w = POS_W[pi];
  const focus = club && club.id === G.user ? FOCUS_ATTRS[G.training.focus] : undefined;
  let guard = 0;
  if (target > p.ca) {
    while (calcCAp(p) < target && guard++ < 40) {
      const ws = p.a.map((v, i) => {
        if (v >= 20) return 0;
        if (pi !== 0 && i >= 36) return 0;
        let x = w[i] + 0.4;
        if (focus && focus.includes(i)) x += 2.5;
        if (a < 21 && PHYS.includes(i)) x += 1.2;
        if (i >= 14 && i < 28 && a > 23) x += 0.5;
        return x;
      });
      const i = R.weightedIndex(ws);
      p.a[i] = Math.min(20, p.a[i] + 1);
    }
  } else {
    while (calcCAp(p) > target && guard++ < 40) {
      const ws = p.a.map((v, i) => (v <= 1 ? 0 : (PHYS.includes(i) ? 3 : 0.4) + w[i] * 0.2));
      const i = R.weightedIndex(ws);
      p.a[i] = Math.max(1, p.a[i] - 1);
    }
  }
  p.ca = calcCAp(p);
  p.pr = computePR(p);
  // mental maturity with age
  if (a >= 24 && R.chance(0.05 * months)) {
    const i = R.pick([A.CMP, A.DEC, A.ANT, A.LDR, A.TEA]);
    if (p.a[i] < 20) p.a[i]++;
  }
}

function monthsIntoSeason() {
  const { m } = ymd(G.day);
  return clamp(m >= 7 ? m - 7 : m + 5, 1, 11);
}

export function coachingQuality(club: Club): number {
  let s = 0, n = 0;
  for (const id of club.staff) {
    const st = G.staff[id];
    if (!st) continue;
    if (st.role === 'COACH' || st.role === 'ASS' || st.role === 'FIT' || st.role === 'GKC') {
      s += (st.a[0] + st.a[1] + st.a[2] + st.a[5] + st.a[6]) / 5;
      n++;
    }
  }
  if (!n) return 5;
  return (s / n) * 5 * Math.min(1, n / 4); // 0..100
}

export function monthlyDevelopment() {
  for (const p of G.players) {
    if (!p || p.retired) continue;
    // long-term unattached players quit football
    if (p.club < 0 && G.day - (p.joined || 0) > 420 && !G.shortlist.includes(p.id)) { retirePlayer(p); continue; }
    developPlayer(p, 1);
    updateValue(p);
  }
}

/** June 30: retirements */
export function retirements() {
  for (const p of G.players) {
    if (!p) continue;
    const a = age(p);
    let prob = 0;
    if (a >= 40) prob = 1;
    else if (a >= 38) prob = 0.75;
    else if (a >= 36) prob = 0.45;
    else if (a >= 35) prob = 0.3;
    else if (a >= 34) prob = 0.16;
    else if (a >= 32 && p.ca < 90) prob = 0.1;
    if (a < 40) prob *= p.ca > 150 ? 0.25 : p.ca > 130 ? 0.55 : 1;
    if (p.club < 0 && a >= 30) prob += 0.45;
    if (p.club < 0 && p.ca < 75) prob += 0.5;
    if (p.club < 0 && G.day - (p.joined || 0) > 300) prob += 0.6;
    if (prob > 0 && R.chance(prob)) retirePlayer(p);
  }
}

export function retirePlayer(p: Player) {
  if (p.club >= 0) {
    const c = G.clubs[p.club];
    c.players = c.players.filter((x) => x !== p.id);
    if (p.club === G.user) addMsg({ from: 'Пресс-служба', subj: `${fullName(p)} завершил карьеру`, kind: 'news', body: `${fullName(p)} объявил о завершении профессиональной карьеры.` });
    else if (p.rep > 75) addNews(`${fullName(p)} (${G.clubs[p.club].name}) завершил карьеру`, 'retire');
  }
  if (p.loan) {
    const parent = G.clubs[p.loan.from];
    if (parent) parent.players = parent.players.filter((x) => x !== p.id);
  }
  G.players[p.id] = null;
  G.shortlist = G.shortlist.filter((x) => x !== p.id);
}

export function youthIntake() {
  const year = ymd(G.day).y;
  for (const c of G.clubs) {
    if (!c.league && !G.countries[c.country].pool.includes(c.id)) continue;
    const n = R.int(2, 3) + (c.facY >= 15 ? 1 : 0);
    const names: string[] = [];
    for (let i = 0; i < n; i++) {
      const pos: PosCode = R.pick(['GK', 'DC', 'DC', 'DL', 'DR', 'DM', 'MC', 'MC', 'AMC', 'AML', 'AMR', 'ST', 'ST'] as PosCode[]);
      const ageY = R.int(15, 17);
      const ca = clamp(Math.round(28 + c.rep * 0.33 + c.facY * 0.8 + R.gauss(0, 7)), 25, 110);
      let pa = clamp(Math.round(ca + R.range(25, 75) + (R.chance(0.02) ? 40 : 0) + c.facY), ca, 200);
      const nat = R.chance(0.9) ? c.country : R.pick(ASSOC[c.country].imports.split(',').filter((x) => NATION[x]));
      const p = genPlayer({ nat, pos, ca, pa, age: ageY, club: c.id, wageScale: Math.max(0.05, c.wageScale * 0.2), seasonYear: year, rep: c.rep * 0.5 });
      p.status = 4;
      p.cEnd = dayOf(year + 3, 6, 30);
      p.wage = Math.max(50, Math.round(p.wage * 0.4));
      updateValue(p);
      G.players[p.id] = p;
      c.players.push(p.id);
      names.push(`${p.fn} ${p.ln} (${pos}, ${ageY} лет)`);
    }
    assignShirts(c);
    if (c.id === G.user) addMsg({ from: 'Директор академии', subj: 'Новый набор в академию', kind: 'youth', important: true, body: `В академию клуба пришли новые воспитанники:\n\n${names.map((s) => '• ' + s).join('\n')}\n\nОни уже включены в состав клуба.` });
  }
}

export function weeklyMorale() {
  for (const c of G.clubs) {
    for (const id of c.players) {
      const p = G.players[id];
      if (!p) continue;
      // drift to 60
      p.morale += (62 - p.morale) * 0.04;
      // playing time vs status
      if (p.status <= 1 && p.lastGame != null && G.day - p.lastGame > 21 && !(p.inj && p.inj.until > G.day)) p.morale -= 2;
    }
  }
}

export function playingTimeComplaints() {
  if (G.user < 0) return;
  const c = G.clubs[G.user];
  for (const id of c.players) {
    const p = P(id);
    if (!p || p.loan) continue;
    if (p.status <= 1 && (p.lastGame == null || G.day - p.lastGame > 35) && !(p.inj && p.inj.until > G.day) && !p.unhappy) {
      p.unhappy = G.day;
      addMsg({ from: fullName(p), subj: 'Недоволен игровым временем', kind: 'player', needs: true, data: { type: 'playtime', pid: p.id },
        body: `${fullName(p)} хочет поговорить с вами: он считает, что заслуживает больше игрового времени в соответствии со своим статусом («${['Ключевой игрок', 'Игрок основы'][p.status]}»).` });
    }
  }
}
export { NUM_ATTRS, posIndex };
