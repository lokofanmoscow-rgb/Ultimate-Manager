import type { Club, FinMonth } from './types';
import { G } from './state';
import { ymd } from './util';

export const INC_NAMES: Record<string, string> = {
  tv: 'Телеправа', com: 'Спонсоры и коммерция', gate: 'Билеты', prize: 'Призовые', transfer: 'Продажа игроков', other: 'Прочее',
};
export const EXP_NAMES: Record<string, string> = {
  wages: 'Зарплаты игроков', staff: 'Зарплаты персонала', transfer: 'Покупка игроков', upkeep: 'Содержание', bonus: 'Бонусы', facilities: 'Инфраструктура', other: 'Прочее',
};

function month(c: Club): FinMonth {
  const { y, m } = ymd(G.day);
  let cur = c.fin.months[c.fin.months.length - 1];
  if (!cur || cur.y !== y || cur.m !== m) {
    cur = { y, m, inc: {}, exp: {} };
    c.fin.months.push(cur);
    if (c.fin.months.length > 24) c.fin.months.shift();
  }
  return cur;
}

export function income(c: Club, kind: string, amount: number) {
  if (!amount) return;
  c.fin.balance += amount;
  if (c.id === G.user || c.fin.months.length) {
    const m = month(c);
    m.inc[kind] = (m.inc[kind] || 0) + amount;
  }
}
export function expense(c: Club, kind: string, amount: number) {
  if (!amount) return;
  c.fin.balance -= amount;
  if (c.id === G.user || c.fin.months.length) {
    const m = month(c);
    m.exp[kind] = (m.exp[kind] || 0) + amount;
  }
}

export function wageBill(c: Club): number {
  let w = 0;
  for (const id of c.players) {
    const p = G.players[id];
    if (!p) continue;
    if (p.loan && p.club === c.id) w += p.wage * (p.loan.wagePct / 100);
    else w += p.wage;
  }
  // players loaned out: parent pays remainder
  return Math.round(w);
}

export function loanedOutWages(c: Club): number {
  let w = 0;
  for (const p of G.players) {
    if (p && p.loan && p.loan.from === c.id) w += p.wage * (1 - p.loan.wagePct / 100);
  }
  return w;
}

export function staffBill(c: Club): number {
  let w = 0;
  for (const id of c.staff) w += G.staff[id]?.wage || 0;
  return w;
}

/** monthly processing for all clubs (1st day of month) */
export function monthlyFinances() {
  const loanOut = new Map<number, number>();
  for (const p of G.players) if (p && p.loan) loanOut.set(p.loan.from, (loanOut.get(p.loan.from) || 0) + p.wage * (1 - p.loan.wagePct / 100));
  for (const c of G.clubs) {
    const w = wageBill(c) + (loanOut.get(c.id) || 0);
    const weeks = 52 / 12;
    income(c, 'tv', Math.round(c.fin.tvYear / 12));
    income(c, 'com', Math.round(c.fin.comYear / 12));
    expense(c, 'wages', Math.round(w * weeks));
    if (c.id === G.user) {
      expense(c, 'staff', Math.round(staffBill(c) * weeks));
      expense(c, 'upkeep', Math.round((c.fin.tvYear + c.fin.comYear) * 0.035 / 12));
    } else {
      expense(c, 'staff', Math.round(w * weeks * 0.12));
      expense(c, 'upkeep', Math.round((c.fin.tvYear + c.fin.comYear) * 0.03 / 12));
    }
    if (c.fin.balance < 0) {
      // interest on overdraft
      expense(c, 'other', Math.round(-c.fin.balance * 0.006));
    }
  }
}

export function matchdayIncome(home: number, attendance: number) {
  const c = G.clubs[home];
  income(c, 'gate', Math.round(attendance * c.fin.ticket));
}

export function setSeasonBudgets(c: Club) {
  const bal = c.fin.balance;
  const rev = c.fin.tvYear + c.fin.comYear;
  c.fin.tBudget = Math.max(0, Math.round((bal * 0.4 + rev * (0.05 + (c.rep / 100) * 0.2)) / 100000) * 100000);
  if (bal < 0) c.fin.tBudget = 0;
  const wb = wageBill(c);
  c.fin.wBudget = Math.round(Math.max(wb * 1.04, Math.min(wb * 1.15, (rev * 0.7) / 52)));
}

export const PRIZE = {
  // UEFA per-match / per-round (approx, EUR)
  UCL: { start: 18_600_000, win: 2_100_000, draw: 700_000, KPO: 1_000_000, R16: 11_000_000, QF: 12_500_000, SF: 15_000_000, F: 18_500_000, W: 6_500_000, Q: 500_000 },
  UEL: { start: 4_300_000, win: 450_000, draw: 150_000, KPO: 300_000, R16: 1_750_000, QF: 2_500_000, SF: 3_500_000, F: 6_000_000, W: 4_000_000, Q: 300_000 },
  UECL: { start: 3_200_000, win: 400_000, draw: 133_000, KPO: 200_000, R16: 800_000, QF: 1_300_000, SF: 2_500_000, F: 4_000_000, W: 3_000_000, Q: 200_000 },
};
