import { dayOf, nearestWeekday, weekday, nextWeekday } from './util';
import type { AssocDef } from '../data/nations';

const md = (s: string) => [parseInt(s.slice(0, 2), 10), parseInt(s.slice(2, 4), 10)];

/** International breaks (no league matches) for a European season starting in year y */
export function intlBreaks(y: number): [number, number][] {
  return [
    [dayOf(y, 9, 1), dayOf(y, 9, 9)],
    [dayOf(y, 10, 6), dayOf(y, 10, 14)],
    [dayOf(y, 11, 10), dayOf(y, 11, 18)],
    [dayOf(y + 1, 3, 23), dayOf(y + 1, 3, 31)],
    [dayOf(y + 1, 6, 1), dayOf(y + 1, 6, 10)],
    // for calendar-year leagues in year y+1
    [dayOf(y, 6, 1), dayOf(y, 6, 10)],
    [dayOf(y, 3, 23), dayOf(y, 3, 31)],
  ];
}

export function inRanges(d: number, ranges: [number, number][]) {
  for (const [a, b] of ranges) if (d >= a && d <= b) return true;
  return false;
}

export interface SeasonFrame {
  start: number;
  end: number;
  blocked: [number, number][];
  year: number; // label year
}

/** season frame for a country: AS seasons labelled by start year, CY by calendar year */
export function seasonFrame(a: AssocDef, label: number): SeasonFrame {
  const [sm, sd] = md(a.start);
  const [em, ed] = md(a.end);
  let start: number, end: number;
  const blocked: [number, number][] = [];
  if (a.cal === 'AS') {
    start = nearestWeekday(dayOf(label, sm, sd), 5);
    end = nearestWeekday(dayOf(label + 1, em, ed), 5);
    blocked.push(...intlBreaks(label));
    if (a.winter) {
      const [wm1, wd1] = md(a.winter[0]);
      const [wm2, wd2] = md(a.winter[1]);
      blocked.push([dayOf(label, wm1, wd1), dayOf(wm2 < wm1 ? label + 1 : label, wm2, wd2)]);
    }
    // christmas: allow boxing day in ENG; block 24-25 Dec everywhere
    blocked.push([dayOf(label, 12, 24), dayOf(label, 12, 25)]);
  } else {
    start = nearestWeekday(dayOf(label, sm, sd), 5);
    end = nearestWeekday(dayOf(label, em, ed), 5);
    blocked.push(...intlBreaks(label - 1), ...intlBreaks(label));
  }
  return { start, end, blocked, year: label };
}

/** pick n match days (weekends first, then midweek) inside frame */
export function leagueDays(frame: SeasonFrame, n: number, avoid: Set<number> = new Set()): number[] {
  const sats: number[] = [];
  for (let d = nextWeekday(frame.start, 5); d <= frame.end; d += 7) {
    if (!inRanges(d, frame.blocked)) sats.push(d);
  }
  let days: number[];
  if (sats.length >= n) {
    // spread evenly, keep first and last
    days = [];
    for (let i = 0; i < n; i++) days.push(sats[Math.round((i * (sats.length - 1)) / Math.max(1, n - 1))]);
    days = Array.from(new Set(days));
    let k = 0;
    while (days.length < n && k < sats.length) {
      if (!days.includes(sats[k])) days.push(sats[k]);
      k++;
    }
  } else {
    days = sats.slice();
    const need = n - sats.length;
    const mids: number[] = [];
    for (let d = nextWeekday(frame.start + 3, 2); d <= frame.end - 3; d += 7) {
      if (!inRanges(d, frame.blocked) && !avoid.has(d)) mids.push(d);
    }
    // prefer midweeks that are not UEFA weeks (avoid set), spread evenly
    for (let i = 0; i < need && mids.length; i++) {
      const idx = Math.round((i + 0.5) * (mids.length / need));
      days.push(mids[Math.min(mids.length - 1, idx)]);
    }
    days = Array.from(new Set(days));
    let extra = nextWeekday(frame.start, 1);
    while (days.length < n) {
      if (!days.includes(extra) && !inRanges(extra, frame.blocked)) days.push(extra);
      extra += 1;
    }
  }
  days.sort((a, b) => a - b);
  return days.slice(0, n);
}

/** midweek dates for cup rounds spread across a season */
export function cupDays(frame: SeasonFrame, n: number, finalDay: number, avoid: Set<number>): number[] {
  const mids: number[] = [];
  for (let d = nextWeekday(frame.start + 10, 2); d < finalDay - 10; d += 7) {
    if (!inRanges(d, frame.blocked) && !avoid.has(d)) mids.push(d);
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(mids[Math.min(mids.length - 1, Math.round((i * (mids.length - 1)) / Math.max(1, n)))] ?? frame.start + 20 + i * 21);
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

/** UEFA calendar for season starting year y */
export function uefaDays(y: number) {
  const wed = (m: number, d: number, yy = y) => nearestWeekday(dayOf(yy, m, d), 2);
  const thu = (m: number, d: number, yy = y) => nearestWeekday(dayOf(yy, m, d), 3);
  const tue = (m: number, d: number, yy = y) => nearestWeekday(dayOf(yy, m, d), 1);
  return {
    UCL: {
      Q1: [tue(7, 8), tue(7, 15)], Q2: [tue(7, 22), tue(7, 29)], Q3: [tue(8, 5), tue(8, 12)], PO: [tue(8, 19), tue(8, 26)],
      LP: [wed(9, 17), wed(10, 1), wed(10, 22), wed(11, 5), wed(11, 26), wed(12, 10), wed(1, 21, y + 1), wed(1, 28, y + 1)],
      KPO: [wed(2, 18, y + 1), wed(2, 25, y + 1)], R16: [wed(3, 11, y + 1), wed(3, 18, y + 1)], QF: [wed(4, 8, y + 1), wed(4, 15, y + 1)],
      SF: [wed(4, 29, y + 1), wed(5, 6, y + 1)], F: [nearestWeekday(dayOf(y + 1, 5, 30), 5)],
    },
    UEL: {
      Q1: [thu(7, 10), thu(7, 17)], Q2: [thu(7, 24), thu(7, 31)], Q3: [thu(8, 7), thu(8, 14)], PO: [thu(8, 21), thu(8, 28)],
      LP: [thu(9, 25), thu(10, 2), thu(10, 23), thu(11, 6), thu(11, 27), thu(12, 11), thu(1, 22, y + 1), thu(1, 29, y + 1)],
      KPO: [thu(2, 19, y + 1), thu(2, 26, y + 1)], R16: [thu(3, 12, y + 1), thu(3, 19, y + 1)], QF: [thu(4, 9, y + 1), thu(4, 16, y + 1)],
      SF: [thu(4, 30, y + 1), thu(5, 7, y + 1)], F: [wed(5, 20, y + 1)],
    },
    UECL: {
      Q1: [thu(7, 10), thu(7, 17)], Q2: [thu(7, 24), thu(7, 31)], Q3: [thu(8, 7), thu(8, 14)], PO: [thu(8, 21), thu(8, 28)],
      LP: [thu(10, 2), thu(10, 23), thu(11, 6), thu(11, 27), thu(12, 11), thu(12, 18)],
      KPO: [thu(2, 19, y + 1), thu(2, 26, y + 1)], R16: [thu(3, 12, y + 1), thu(3, 19, y + 1)], QF: [thu(4, 9, y + 1), thu(4, 16, y + 1)],
      SF: [thu(4, 30, y + 1), thu(5, 7, y + 1)], F: [wed(5, 27, y + 1)],
    },
  };
}

/** set of all UEFA match days (for avoiding midweek clashes) */
export function uefaWeekDays(y: number): Set<number> {
  const u = uefaDays(y);
  const s = new Set<number>();
  for (const comp of Object.values(u)) for (const arr of Object.values(comp)) for (const d of arr) {
    for (let k = -2; k <= 2; k++) s.add(d + k);
  }
  return s;
}

export function isWeekend(d: number) {
  const w = weekday(d);
  return w >= 5;
}
