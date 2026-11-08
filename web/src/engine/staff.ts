import type { Club, Staff, StaffRole } from './types';
import { G, R } from './state';
import { randomName } from './player';
import { clamp, dayOf, ymd } from './util';
import { ASSOC, NATION } from '../data/nations';
import { roundWage } from './attrs';

export const STAFF_ROLES: Record<StaffRole, string> = {
  ASS: 'Ассистент главного тренера', COACH: 'Тренер', GKC: 'Тренер вратарей', FIT: 'Тренер по физподготовке', SCOUT: 'Скаут', PHYSIO: 'Физиотерапевт', ANALYST: 'Аналитик', YOUTH: 'Тренер молодёжи',
};
export const STAFF_ATTRS = ['Атака', 'Оборона', 'Физподготовка', 'Вратари', 'Психология', 'Тактика', 'Техника', 'Работа с молодёжью', 'Адаптивность', 'Решительность', 'Дисциплина', 'Управление людьми', 'Мотивация', 'Оценка способностей', 'Оценка потенциала', 'Тактические знания', 'Физиотерапия', 'Спортивная наука'];

const ROLE_KEYS: Record<StaffRole, number[]> = {
  ASS: [5, 15, 11, 12, 0, 1], COACH: [0, 1, 6, 5, 4], GKC: [3, 4, 6], FIT: [2, 17, 12], SCOUT: [13, 14, 15, 8], PHYSIO: [16, 17], ANALYST: [15, 5, 13], YOUTH: [7, 6, 4, 14],
};

export function genStaff(role: StaffRole, quality: number, nat: string, club: number): Staff {
  const [fn, ln] = randomName(nat, R);
  const a = new Array(18).fill(0).map(() => clamp(Math.round(quality * 0.6 + R.gauss(0, 3)), 1, 20));
  for (const k of ROLE_KEYS[role]) a[k] = clamp(Math.round(quality + R.gauss(0, 2.2)), 1, 20);
  const y = ymd(G.day).y;
  const s: Staff = {
    id: G.nid.s++, fn, ln, nat, dob: dayOf(y - R.int(30, 64), R.int(1, 12), R.int(1, 28)), role, club,
    wage: roundWage(150 + quality * quality * 18 * R.range(0.8, 1.2)), cEnd: dayOf(y + R.int(1, 3), 6, 30), a, rep: clamp(Math.round(quality * 4.5 + R.gauss(0, 6)), 1, 100),
  };
  G.staff[s.id] = s;
  return s;
}

export function staffQualityFor(club: Club) {
  return clamp(Math.round(club.rep / 6 + 2), 4, 18);
}

export function ensureClubStaff(club: Club) {
  if (club.staff.length) return;
  const q = staffQualityFor(club);
  const nat = club.country;
  const plan: StaffRole[] = ['ASS', 'COACH', 'COACH', 'GKC', 'FIT', 'SCOUT', 'SCOUT', 'PHYSIO', 'ANALYST', 'YOUTH'];
  const n = club.rep >= 70 ? plan.length : club.rep >= 45 ? 7 : 5;
  for (const r of plan.slice(0, n)) {
    const s = genStaff(r, clamp(q + R.int(-2, 2), 1, 20), R.chance(0.8) ? nat : R.pick(Object.keys(NATION)), club.id);
    club.staff.push(s.id);
  }
}

export function ensureFreeStaff() {
  const free = G.staff.filter((s) => s && s.club < 0).length;
  const roles: StaffRole[] = ['ASS', 'COACH', 'GKC', 'FIT', 'SCOUT', 'PHYSIO', 'ANALYST', 'YOUTH'];
  const nats = Object.keys(ASSOC);
  for (let i = free; i < 120; i++) genStaff(R.pick(roles), R.int(5, 19), R.pick(nats), -1);
}

export function hireStaff(id: number): string {
  const s = G.staff[id]!;
  const club = G.clubs[G.user];
  if (club.staff.length >= 20) return 'Штат персонала заполнен (максимум 20 человек).';
  s.club = club.id;
  s.cEnd = dayOf(ymd(G.day).y + 2, 6, 30);
  club.staff.push(s.id);
  return `${s.fn} ${s.ln} принят на должность «${STAFF_ROLES[s.role]}».`;
}

export function fireStaff(id: number): string {
  const s = G.staff[id]!;
  const club = G.clubs[G.user];
  const weeks = Math.max(0, (s.cEnd - G.day) / 7);
  club.fin.balance -= Math.round(s.wage * weeks * 0.5);
  club.staff = club.staff.filter((x) => x !== id);
  s.club = -1;
  return `${s.fn} ${s.ln} уволен. Компенсация выплачена.`;
}

export function staffRating(s: Staff): number {
  const keys = ROLE_KEYS[s.role];
  return keys.reduce((t, k) => t + s.a[k], 0) / keys.length;
}

/** best scout judging ability (for player knowledge) */
export function scoutJudging(): number {
  const club = G.clubs[G.user];
  if (!club) return 10;
  let best = 8;
  for (const id of club.staff) {
    const s = G.staff[id];
    if (s && (s.role === 'SCOUT' || s.role === 'ASS' || s.role === 'ANALYST')) best = Math.max(best, (s.a[13] + s.a[14]) / 2);
  }
  return best;
}

export function physioQuality(club: Club): number {
  let best = 6;
  for (const id of club.staff) {
    const s = G.staff[id];
    if (s && s.role === 'PHYSIO') best = Math.max(best, s.a[16]);
  }
  return best;
}
