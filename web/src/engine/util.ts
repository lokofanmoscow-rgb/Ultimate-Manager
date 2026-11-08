// Generic helpers: seeded RNG, dates, math.

export class RNG {
  s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  next(): number {
    // mulberry32
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  range(a: number, b: number): number {
    return a + this.next() * (b - a);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  gauss(mean = 0, sd = 1): number {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    let tot = 0;
    for (const w of weights) tot += Math.max(0, w);
    let r = this.next() * tot;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  weightedIndex(weights: readonly number[]): number {
    let tot = 0;
    for (const w of weights) tot += Math.max(0, w);
    let r = this.next() * tot;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }
  poisson(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > L && k < 30);
    return k - 1;
  }
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- Dates: day number = days since 2000-01-01 (UTC) ----
const MS_DAY = 86400000;
const EPOCH = Date.UTC(2000, 0, 1);

export function dayOf(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / MS_DAY);
}
export function ymd(day: number): { y: number; m: number; d: number } {
  const dt = new Date(EPOCH + day * MS_DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
/** 0 = Monday ... 6 = Sunday */
export function weekday(day: number): number {
  return (day + 5) % 7;
}
/** nearest day to `day` having weekday wd (0=Mon) */
export function nearestWeekday(day: number, wd: number): number {
  const cur = weekday(day);
  let diff = wd - cur;
  if (diff > 3) diff -= 7;
  if (diff < -3) diff += 7;
  return day + diff;
}
export function nextWeekday(day: number, wd: number): number {
  const cur = weekday(day);
  let diff = (wd - cur + 7) % 7;
  return day + diff;
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WD_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

export function fmtDate(day: number, withWd = false): string {
  const { y, m, d } = ymd(day);
  return (withWd ? WD[weekday(day)] + ', ' : '') + `${d} ${MONTHS_GEN[m - 1]} ${y}`;
}
export function fmtDateShort(day: number): string {
  const { y, m, d } = ymd(day);
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${String(y).slice(2)}`;
}
export function fmtDM(day: number): string {
  const { m, d } = ymd(day);
  return `${d} ${MONTHS_GEN[m - 1].slice(0, 3)}`;
}
export function monthName(m: number) {
  return MONTHS_NOM[m - 1];
}
export function weekdayName(day: number) {
  return WD_FULL[weekday(day)];
}
export function wdShort(day: number) {
  return WD[weekday(day)];
}

export function ageAt(dob: number, day: number): number {
  const a = ymd(dob), b = ymd(day);
  let age = b.y - a.y;
  if (b.m < a.m || (b.m === a.m && b.d < a.d)) age--;
  return age;
}

export function fmtMoney(v: number, short = true): string {
  const neg = v < 0;
  v = Math.abs(v);
  let s: string;
  if (!short) s = Math.round(v).toLocaleString('ru-RU') + ' €';
  else if (v >= 1e9) s = (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' млрд €';
  else if (v >= 1e6) s = (v / 1e6).toFixed(v >= 1e8 ? 0 : v >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + ' млн €';
  else if (v >= 1e3) s = Math.round(v / 1e3) + ' тыс. €';
  else s = Math.round(v) + ' €';
  return (neg ? '−' : '') + s;
}

export function plural(n: number, one: string, few: string, many: string) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

export function sum(a: number[]) {
  let s = 0;
  for (const x of a) s += x;
  return s;
}
export function avg(a: number[]) {
  return a.length ? sum(a) / a.length : 0;
}
