// Attributes, positions, roles and ability calculations (FM-style 1..20 scale).

export const A = {
  // technical
  COR: 0, CRO: 1, DRI: 2, FIN: 3, FIR: 4, FRE: 5, HEA: 6, LON: 7, LTH: 8, MAR: 9, PAS: 10, PEN: 11, TCK: 12, TEC: 13,
  // mental
  AGG: 14, ANT: 15, BRA: 16, CMP: 17, CNT: 18, DEC: 19, DET: 20, FLA: 21, LDR: 22, OTB: 23, POS: 24, TEA: 25, VIS: 26, WOR: 27,
  // physical
  ACC: 28, AGI: 29, BAL: 30, JUM: 31, NAT: 32, PAC: 33, STA: 34, STR: 35,
  // goalkeeping
  AER: 36, CMD: 37, COM: 38, ECC: 39, HAN: 40, KIC: 41, ONE: 42, REF: 43, RUS: 44, PUN: 45, THR: 46,
} as const;
export const NUM_ATTRS = 47;

export const ATTR_NAMES: string[] = [
  'Угловые', 'Навесы', 'Дриблинг', 'Завершение', 'Первое касание', 'Штрафные', 'Игра головой', 'Дальние удары', 'Вбрасывание аутов', 'Опека', 'Пас', 'Пенальти', 'Отбор', 'Техника',
  'Агрессивность', 'Предвидение', 'Храбрость', 'Хладнокровие', 'Концентрация', 'Принятие решений', 'Решительность', 'Импровизация', 'Лидерство', 'Игра без мяча', 'Выбор позиции', 'Командная игра', 'Видение поля', 'Работоспособность',
  'Ускорение', 'Ловкость', 'Равновесие', 'Прыгучесть', 'Природная физ. форма', 'Скорость', 'Выносливость', 'Сила',
  'Игра на выходах', 'Руководство штрафной', 'Коммуникация', 'Эксцентричность', 'Игра руками', 'Выбивание', 'Игра один на один', 'Реакция', 'Склонность к выходам', 'Склонность отбивать', 'Ввод мяча рукой',
];
export const ATTR_SHORT: string[] = [
  'Угл', 'Нав', 'Дрб', 'Зав', 'ПрК', 'Штр', 'Гол', 'ДлУ', 'Аут', 'Опк', 'Пас', 'Пен', 'Отб', 'Тех',
  'Агр', 'Прд', 'Хрб', 'Хлд', 'Кнц', 'Реш', 'Рсл', 'Имп', 'Лид', 'БзМ', 'Поз', 'Ком', 'Вид', 'Раб',
  'Уск', 'Лов', 'Рав', 'Прж', 'ПФФ', 'Скр', 'Вын', 'Сил',
  'Вых', 'РШт', 'Кмм', 'Экс', 'Рук', 'Выб', '1н1', 'Реа', 'СкВ', 'СкО', 'Ввд',
];
export const TECH_IDX = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
export const MENT_IDX = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
export const PHYS_IDX = [28, 29, 30, 31, 32, 33, 34, 35];
export const GK_IDX = [36, 37, 38, 39, 40, 41, 42, 4, 10, 43, 44, 45, 46]; // FM shows First Touch + Passing in GK block

export const H = { CONS: 0, IMPM: 1, INJP: 2, VERS: 3, DIRT: 4, ADAP: 5, AMB: 6, CONT: 7, LOY: 8, PRES: 9, PROF: 10, SPORT: 11, TEMP: 12 } as const;
export const HID_NAMES = ['Стабильность', 'Важные матчи', 'Предрасп. к травмам', 'Универсальность', 'Грязная игра', 'Адаптивность', 'Амбиции', 'Скандальность', 'Лояльность', 'Стрессоустойчивость', 'Профессионализм', 'Спортивное поведение', 'Темперамент'];

export type PosCode = 'GK' | 'DL' | 'DC' | 'DR' | 'WBL' | 'WBR' | 'DM' | 'ML' | 'MC' | 'MR' | 'AML' | 'AMC' | 'AMR' | 'ST';
export const POS: PosCode[] = ['GK', 'DL', 'DC', 'DR', 'WBL', 'WBR', 'DM', 'ML', 'MC', 'MR', 'AML', 'AMC', 'AMR', 'ST'];
export const POS_RU: Record<PosCode, string> = {
  GK: 'ВРТ', DL: 'ЗЛ', DC: 'ЦЗ', DR: 'ЗП', WBL: 'ФЛ', WBR: 'ФП', DM: 'ОП', ML: 'ПЛ', MC: 'ЦП', MR: 'ПП', AML: 'АПЛ', AMC: 'АПЦ', AMR: 'АПП', ST: 'НАП',
};
export const POS_FULL_RU: Record<PosCode, string> = {
  GK: 'Вратарь', DL: 'Защитник (левый)', DC: 'Защитник (центр.)', DR: 'Защитник (правый)', WBL: 'Вингбэк (левый)', WBR: 'Вингбэк (правый)',
  DM: 'Опорный полузащитник', ML: 'Полузащитник (левый)', MC: 'Полузащитник (центр.)', MR: 'Полузащитник (правый)',
  AML: 'Атак. полузащитник (левый)', AMC: 'Атак. полузащитник (центр.)', AMR: 'Атак. полузащитник (правый)', ST: 'Нападающий',
};
export const posIndex = (p: PosCode) => POS.indexOf(p);

// position groups for squad display / generation
export const POS_GROUP: Record<PosCode, 'G' | 'D' | 'M' | 'F'> = {
  GK: 'G', DL: 'D', DC: 'D', DR: 'D', WBL: 'D', WBR: 'D', DM: 'M', ML: 'M', MC: 'M', MR: 'M', AML: 'M', AMC: 'M', AMR: 'M', ST: 'F',
};

// --- position weights (importance of each attribute) ---
type W = Partial<Record<keyof typeof A, number>>;
const WEIGHTS: Record<PosCode, W> = {
  GK: { AER: 3, CMD: 2.5, COM: 2, HAN: 4, KIC: 1.5, ONE: 3, REF: 5, RUS: 1, THR: 1, PAS: 0.6, FIR: 0.6, ANT: 2, CMP: 2, CNT: 2.5, DEC: 2, POS: 3.5, AGI: 3, JUM: 1, ACC: 1, BRA: 1 },
  DC: { HEA: 4, MAR: 4, TCK: 4, POS: 4, ANT: 3, CMP: 2, CNT: 3, DEC: 2.5, BRA: 2, JUM: 3, STR: 3, PAC: 2, ACC: 1.5, PAS: 1.2, FIR: 1, TEC: 0.6, AGG: 1, TEA: 1, WOR: 1, BAL: 1, AGI: 1, STA: 1 },
  DL: { TCK: 3, MAR: 3, POS: 3, CRO: 2, PAS: 1.5, DRI: 1, FIR: 1, TEC: 1, ANT: 2, CNT: 2, DEC: 2, TEA: 2, WOR: 2.5, OTB: 1, ACC: 3, PAC: 3, STA: 3, AGI: 1.5, BAL: 1, STR: 1, HEA: 1, JUM: 1 },
  DR: {},
  WBL: { CRO: 3, DRI: 2, PAS: 2, TCK: 2, MAR: 1.5, FIR: 1.5, TEC: 2, OTB: 2, TEA: 2, WOR: 3, DEC: 2, ANT: 1.5, POS: 1.5, ACC: 3, PAC: 3, STA: 4, AGI: 2, BAL: 1 },
  WBR: {},
  DM: { TCK: 4, MAR: 2, PAS: 3, FIR: 2, TEC: 1.5, ANT: 3, POS: 4, DEC: 3, CMP: 2, CNT: 3, TEA: 3, WOR: 3, VIS: 1.5, AGG: 1, BRA: 1, STR: 2, STA: 2, ACC: 1, PAC: 1, BAL: 1, HEA: 1, JUM: 1 },
  MC: { PAS: 4, FIR: 3, TEC: 3, VIS: 3, DEC: 4, CMP: 3, ANT: 2, OTB: 2, TEA: 3, WOR: 2, TCK: 2, LON: 1.5, DRI: 1.5, STA: 2, ACC: 1.5, AGI: 1.5, BAL: 1.5, PAC: 1, POS: 1.5, CNT: 1.5, FLA: 1 },
  ML: { CRO: 3, DRI: 3, PAS: 2.5, FIR: 2, TEC: 2.5, OTB: 2, DEC: 2, WOR: 2, TEA: 2, VIS: 1.5, ACC: 3.5, PAC: 3.5, STA: 3, AGI: 2, BAL: 1, FLA: 1 },
  MR: {},
  AMC: { PAS: 3.5, FIR: 3, TEC: 4, VIS: 4, DRI: 3, LON: 2, FIN: 2, DEC: 3, CMP: 3, OTB: 3, FLA: 2.5, ANT: 2, ACC: 2, AGI: 2.5, BAL: 2, PAC: 1.5 },
  AML: { DRI: 4, CRO: 2.5, FIN: 2.5, FIR: 3, TEC: 3, PAS: 2, OTB: 3, FLA: 2.5, DEC: 2, CMP: 2, VIS: 1.5, ANT: 1.5, ACC: 4, PAC: 4, AGI: 3, BAL: 2, STA: 1.5, LON: 1 },
  AMR: {},
  ST: { FIN: 5, FIR: 3, HEA: 2.5, TEC: 2.5, DRI: 2, OTB: 4, CMP: 3.5, ANT: 3, DEC: 2, ACC: 3.5, PAC: 3, STR: 2, JUM: 1.5, AGI: 1.5, BAL: 1.5, LON: 1, PAS: 1, TEA: 1, WOR: 1 },
};
WEIGHTS.DR = WEIGHTS.DL;
WEIGHTS.WBR = WEIGHTS.WBL;
WEIGHTS.MR = WEIGHTS.ML;
WEIGHTS.AMR = WEIGHTS.AML;

/** dense weight vectors for each position */
export const POS_W: number[][] = POS.map((p) => {
  const v = new Array(NUM_ATTRS).fill(0);
  const w = WEIGHTS[p];
  for (const k in w) v[(A as any)[k]] = (w as any)[k];
  return v;
});
const POS_WSUM = POS_W.map((v) => v.reduce((s, x) => s + x, 0));

/** raw ability for a position, 1..20 scale */
export function posRaw(a: number[], pi: number): number {
  const w = POS_W[pi];
  let s = 0;
  for (let i = 0; i < NUM_ATTRS; i++) if (w[i]) s += w[i] * a[i];
  return s / POS_WSUM[pi];
}

export function famFactor(f: number): number {
  // familiarity 0..20 -> effectiveness multiplier
  if (f >= 18) return 1;
  if (f >= 15) return 0.96;
  if (f >= 12) return 0.91;
  if (f >= 9) return 0.84;
  if (f >= 5) return 0.75;
  return 0.62;
}

/** CA on 1..200 scale for a position (with familiarity penalty) */
export function posRating(a: number[], fam: number[], pi: number): number {
  return posRaw(a, pi) * 10 * famFactor(fam[pi] ?? 0);
}

export function bestPos(a: number[], fam: number[]): { pi: number; r: number } {
  let best = 0, br = -1;
  for (let i = 0; i < POS.length; i++) {
    if ((fam[i] ?? 0) < 15) continue;
    const r = posRaw(a, i) * 10;
    if (r > br) {
      br = r;
      best = i;
    }
  }
  if (br < 0) {
    for (let i = 0; i < POS.length; i++) {
      const r = posRating(a, fam, i);
      if (r > br) { br = r; best = i; }
    }
  }
  return { pi: best, r: br };
}

export function calcCA(a: number[], fam: number[]): number {
  return Math.round(bestPos(a, fam).r);
}

export function stars(ca: number): number {
  // absolute scale: 200 -> 5 stars
  const s = (ca - 40) / 30; // 40 -> 0, 190 -> 5
  return Math.max(0.5, Math.min(5, Math.round(s * 2) / 2));
}

// --- Roles (FM-like) ---
export type Duty = 'D' | 'S' | 'A';
export interface RoleDef {
  id: string;
  name: string;
  short: string;
  pos: PosCode[];
  duties: Duty[];
  key: (keyof typeof A)[];
  // behaviour parameters (engine)
  fwd: number; // extra forward push in possession (-1..1)
  inside: number; // tendency to drift inside (0..1)
  dribble: number; // 0..1
  cross: number;
  shoot: number;
  through: number;
  roam: number;
  hold: number; // stays back / holds position
  run: number; // runs in behind
  press: number;
  drop: number; // drops deep to receive
}
const R = (id: string, name: string, short: string, pos: PosCode[], duties: Duty[], key: (keyof typeof A)[], b: Partial<RoleDef> = {}): RoleDef => ({
  id, name, short, pos, duties, key,
  fwd: 0, inside: 0, dribble: 0.3, cross: 0.3, shoot: 0.3, through: 0.3, roam: 0.2, hold: 0.3, run: 0.2, press: 0.5, drop: 0, ...b,
});

export const ROLES: RoleDef[] = [
  R('GK', 'Вратарь', 'В', ['GK'], ['D'], ['REF', 'HAN', 'ONE', 'AER', 'CMD', 'POS'], { hold: 1, press: 0 }),
  R('SK', 'Вратарь-чистильщик', 'ВЧ', ['GK'], ['D', 'S', 'A'], ['REF', 'ONE', 'RUS', 'KIC', 'PAS', 'ANT', 'ACC'], { hold: 0.7, fwd: 0.3, press: 0 }),
  R('CD', 'Центральный защитник', 'ЦЗ', ['DC'], ['D', 'S'], ['HEA', 'MAR', 'TCK', 'POS', 'STR', 'JUM'], { hold: 1, dribble: 0.05, cross: 0, shoot: 0.05, through: 0.05, press: 0.4 }),
  R('BPD', 'Защитник диспетчер', 'ЗД', ['DC'], ['D', 'S'], ['PAS', 'CMP', 'VIS', 'HEA', 'MAR', 'TCK'], { hold: 1, dribble: 0.1, cross: 0, shoot: 0.05, through: 0.35, press: 0.4 }),
  R('NCB', 'Простой защитник', 'ПЗ', ['DC'], ['D'], ['HEA', 'MAR', 'TCK', 'STR', 'BRA'], { hold: 1, dribble: 0, cross: 0, shoot: 0.02, through: 0, press: 0.4 }),
  R('LIB', 'Либеро', 'ЛИБ', ['DC'], ['D', 'S'], ['PAS', 'DRI', 'VIS', 'TCK', 'ANT', 'CMP'], { hold: 0.7, fwd: 0.2, dribble: 0.4, through: 0.4 }),
  R('FB', 'Крайний защитник', 'КЗ', ['DL', 'DR'], ['D', 'S', 'A'], ['TCK', 'MAR', 'POS', 'CRO', 'WOR', 'STA'], { fwd: 0.35, cross: 0.5, dribble: 0.2, hold: 0.5 }),
  R('WB', 'Вингбэк', 'ВБ', ['DL', 'DR', 'WBL', 'WBR'], ['D', 'S', 'A'], ['CRO', 'DRI', 'STA', 'WOR', 'TCK', 'PAC'], { fwd: 0.6, cross: 0.65, dribble: 0.4, hold: 0.2 }),
  R('IWB', 'Инвертированный вингбэк', 'ИВБ', ['DL', 'DR', 'WBL', 'WBR'], ['D', 'S', 'A'], ['PAS', 'FIR', 'DEC', 'TEC', 'TCK', 'POS'], { fwd: 0.3, inside: 0.8, cross: 0.15, through: 0.4, hold: 0.4 }),
  R('NFB', 'Простой крайний защитник', 'ПКЗ', ['DL', 'DR'], ['D'], ['TCK', 'MAR', 'HEA', 'STR', 'POS'], { fwd: 0, cross: 0.1, dribble: 0.05, hold: 1 }),
  R('CWB', 'Полный вингбэк', 'ПВБ', ['WBL', 'WBR'], ['S', 'A'], ['CRO', 'DRI', 'TEC', 'STA', 'OTB', 'FLA'], { fwd: 0.85, cross: 0.7, dribble: 0.55, hold: 0 }),
  R('DM', 'Опорный полузащитник', 'ОП', ['DM'], ['D', 'S'], ['TCK', 'POS', 'ANT', 'TEA', 'CNT', 'PAS'], { hold: 0.8, through: 0.2, shoot: 0.1 }),
  R('A', 'Якорь', 'ЯК', ['DM'], ['D'], ['TCK', 'POS', 'MAR', 'ANT', 'CNT', 'STR'], { hold: 1, through: 0.1, shoot: 0.05, dribble: 0.05 }),
  R('HB', 'Полу-защитник', 'ПЗЩ', ['DM'], ['D'], ['POS', 'TCK', 'PAS', 'ANT', 'CMP', 'TEA'], { hold: 1, fwd: -0.5, through: 0.2, shoot: 0.05 }),
  R('DLP', 'Глубинный плеймейкер', 'ГП', ['DM', 'MC'], ['D', 'S'], ['PAS', 'VIS', 'TEC', 'FIR', 'DEC', 'CMP'], { hold: 0.7, through: 0.6, shoot: 0.15, drop: 0.3 }),
  R('REG', 'Режиссёр', 'РЕЖ', ['DM'], ['S'], ['PAS', 'VIS', 'TEC', 'FLA', 'DEC', 'FIR'], { hold: 0.5, through: 0.7, roam: 0.5, dribble: 0.3 }),
  R('BWM', 'Полузащитник-разрушитель', 'РЗР', ['DM', 'MC'], ['D', 'S'], ['TCK', 'AGG', 'WOR', 'STA', 'TEA', 'ANT'], { press: 1, hold: 0.5, through: 0.1, shoot: 0.1 }),
  R('RPM', 'Свободный плеймейкер', 'СП', ['DM', 'MC'], ['S'], ['PAS', 'VIS', 'DRI', 'FIR', 'OTB', 'STA'], { roam: 0.8, through: 0.6, dribble: 0.4, fwd: 0.3 }),
  R('VOL', 'Сегундо воланте', 'СВ', ['DM'], ['S', 'A'], ['FIN', 'LON', 'OTB', 'STA', 'TCK', 'PAS'], { fwd: 0.5, run: 0.5, shoot: 0.5, hold: 0.2 }),
  R('CM', 'Центральный полузащитник', 'ЦП', ['MC'], ['D', 'S', 'A'], ['PAS', 'DEC', 'TEA', 'FIR', 'TCK', 'TEC'], { fwd: 0.15, through: 0.35, shoot: 0.3 }),
  R('BBM', 'Box-to-box', 'БТБ', ['MC'], ['S'], ['STA', 'WOR', 'PAS', 'TCK', 'OTB', 'LON'], { fwd: 0.45, run: 0.5, shoot: 0.45, press: 0.7, hold: 0.2 }),
  R('AP', 'Атакующий плеймейкер', 'АП', ['MC', 'AMC', 'ML', 'MR', 'AML', 'AMR'], ['S', 'A'], ['PAS', 'VIS', 'TEC', 'FIR', 'DEC', 'FLA'], { fwd: 0.4, through: 0.8, dribble: 0.45, shoot: 0.35, roam: 0.4 }),
  R('MEZ', 'Медзала', 'МЕД', ['MC'], ['S', 'A'], ['DRI', 'PAS', 'TEC', 'OTB', 'VIS', 'ACC'], { fwd: 0.5, inside: -0.4, dribble: 0.55, run: 0.45, shoot: 0.4, hold: 0.1 }),
  R('CAR', 'Каррилеро', 'КАР', ['MC'], ['S'], ['TCK', 'TEA', 'POS', 'STA', 'PAS', 'WOR'], { fwd: 0.05, inside: -0.3, hold: 0.6, through: 0.2 }),
  R('WM', 'Крайний полузащитник', 'КП', ['ML', 'MR'], ['D', 'S', 'A'], ['CRO', 'PAS', 'WOR', 'STA', 'TEA', 'TCK'], { fwd: 0.2, cross: 0.6, dribble: 0.35, hold: 0.3 }),
  R('W', 'Вингер', 'ВНГ', ['ML', 'MR', 'AML', 'AMR'], ['S', 'A'], ['CRO', 'DRI', 'PAC', 'ACC', 'TEC', 'AGI'], { fwd: 0.6, cross: 0.85, dribble: 0.7, shoot: 0.25, hold: 0 }),
  R('DW', 'Оборонительный вингер', 'ОВ', ['ML', 'MR'], ['D', 'S'], ['WOR', 'TCK', 'STA', 'CRO', 'TEA', 'POS'], { fwd: 0.1, cross: 0.5, press: 0.8, hold: 0.5 }),
  R('WP', 'Фланговый плеймейкер', 'ФП', ['ML', 'MR', 'AML', 'AMR'], ['S', 'A'], ['PAS', 'VIS', 'TEC', 'FIR', 'DRI', 'DEC'], { fwd: 0.35, inside: 0.6, through: 0.7, cross: 0.3, dribble: 0.45 }),
  R('IW', 'Инвертированный вингер', 'ИВН', ['ML', 'MR', 'AML', 'AMR'], ['S', 'A'], ['DRI', 'PAS', 'TEC', 'CRO', 'ACC', 'VIS'], { fwd: 0.45, inside: 0.55, dribble: 0.6, cross: 0.45, shoot: 0.4, through: 0.45 }),
  R('IF', 'Инсайд-форвард', 'ИФ', ['AML', 'AMR'], ['S', 'A'], ['DRI', 'FIN', 'OTB', 'ACC', 'TEC', 'CMP'], { fwd: 0.75, inside: 0.85, dribble: 0.75, cross: 0.15, shoot: 0.75, run: 0.6 }),
  R('RMD', 'Раумдойтер', 'РАУ', ['AML', 'AMR'], ['A'], ['OTB', 'ANT', 'FIN', 'CMP', 'CNT', 'BAL'], { fwd: 0.85, inside: 0.6, dribble: 0.3, shoot: 0.7, run: 0.85, cross: 0.1 }),
  R('WTF', 'Фланговый таргетмен', 'ФТ', ['AML', 'AMR'], ['S', 'A'], ['HEA', 'JUM', 'STR', 'BRA', 'FIN', 'BAL'], { fwd: 0.7, inside: 0.3, dribble: 0.2, cross: 0.3, shoot: 0.5, hold: 0 }),
  R('AM', 'Атакующий полузащитник', 'АПЗ', ['AMC'], ['S', 'A'], ['PAS', 'TEC', 'FIR', 'OTB', 'LON', 'DEC'], { fwd: 0.5, through: 0.55, dribble: 0.5, shoot: 0.5, run: 0.35 }),
  R('SS', 'Теневой нападающий', 'ТН', ['AMC'], ['A'], ['OTB', 'FIN', 'ANT', 'CMP', 'ACC', 'DRI'], { fwd: 0.8, run: 0.8, shoot: 0.7, dribble: 0.45, through: 0.2 }),
  R('ENG', 'Энганче', 'ЭНГ', ['AMC'], ['S'], ['PAS', 'VIS', 'TEC', 'FIR', 'CMP', 'FLA'], { fwd: 0.3, through: 0.85, dribble: 0.35, shoot: 0.3, press: 0.15, roam: 0.3 }),
  R('T', 'Трекуартиста', 'ТРК', ['AMC', 'ST'], ['A'], ['PAS', 'VIS', 'TEC', 'FIR', 'DRI', 'FLA', 'CMP'], { fwd: 0.5, through: 0.8, dribble: 0.6, shoot: 0.55, press: 0.1, roam: 0.7, drop: 0.3 }),
  R('AF', 'Выдвинутый форвард', 'ВФ', ['ST'], ['A'], ['FIN', 'OTB', 'ACC', 'PAC', 'DRI', 'CMP'], { fwd: 1, run: 0.9, shoot: 0.8, dribble: 0.5, through: 0.15, hold: 0 }),
  R('CF', 'Универсальный форвард', 'УФ', ['ST'], ['S', 'A'], ['FIN', 'FIR', 'HEA', 'PAS', 'TEC', 'OTB', 'STR'], { fwd: 0.8, run: 0.55, shoot: 0.75, dribble: 0.5, through: 0.4, drop: 0.2 }),
  R('DLF', 'Оттянутый форвард', 'ОФ', ['ST'], ['S', 'A'], ['PAS', 'FIR', 'TEC', 'VIS', 'CMP', 'TEA'], { fwd: 0.55, run: 0.25, shoot: 0.55, through: 0.6, drop: 0.6 }),
  R('F9', 'Ложная девятка', 'ЛД', ['ST'], ['S'], ['PAS', 'VIS', 'DRI', 'FIR', 'TEC', 'OTB'], { fwd: 0.4, run: 0.15, shoot: 0.5, through: 0.75, dribble: 0.6, drop: 0.85, roam: 0.5 }),
  R('P', 'Таранный нападающий-«шакал»', 'ШАК', ['ST'], ['A'], ['FIN', 'OTB', 'ANT', 'CMP', 'HEA', 'ACC'], { fwd: 1, run: 0.85, shoot: 0.95, dribble: 0.2, through: 0.05, press: 0.2, hold: 0 }),
  R('PF', 'Прессингующий форвард', 'ПФ', ['ST'], ['D', 'S', 'A'], ['WOR', 'STA', 'AGG', 'TEA', 'ACC', 'FIN'], { fwd: 0.75, run: 0.6, shoot: 0.6, press: 1, dribble: 0.35 }),
  R('TF', 'Таргетмен', 'ТМ', ['ST'], ['S', 'A'], ['HEA', 'JUM', 'STR', 'BRA', 'FIN', 'BAL'], { fwd: 0.85, run: 0.2, shoot: 0.7, dribble: 0.15, through: 0.25, hold: 0 }),
];
export const ROLE_BY_ID: Record<string, RoleDef> = Object.fromEntries(ROLES.map((r) => [r.id, r]));
export const DUTY_RU: Record<Duty, string> = { D: 'Оборона', S: 'Поддержка', A: 'Атака' };
export const DUTY_SHORT: Record<Duty, string> = { D: 'Об', S: 'Пд', A: 'Ат' };

export function rolesFor(pos: PosCode): RoleDef[] {
  return ROLES.filter((r) => r.pos.includes(pos));
}

/** role suitability 0..20 */
export function roleRating(a: number[], role: RoleDef): number {
  let s = 0;
  for (const k of role.key) s += a[(A as any)[k]];
  return s / role.key.length;
}

// --- Market value / wages ---
export function baseValue(ca: number, pa: number, age: number, leagueMult: number, contractYearsLeft: number, rep = 50): number {
  let v = 10_000_000 * Math.exp(0.062 * (ca - 140));
  let af = 1;
  if (age <= 18) af = 0.75 + Math.max(0, pa - ca) / 45;
  else if (age <= 21) af = 0.9 + Math.max(0, pa - ca) / 55;
  else if (age <= 24) af = 1.05 + Math.max(0, pa - ca) / 90;
  else if (age <= 27) af = 1.0;
  else if (age === 28) af = 0.88;
  else if (age === 29) af = 0.75;
  else if (age === 30) af = 0.6;
  else if (age === 31) af = 0.46;
  else if (age === 32) af = 0.34;
  else if (age === 33) af = 0.24;
  else af = 0.14;
  v *= af;
  v *= 0.75 + 0.25 * leagueMult;
  if (contractYearsLeft < 0.5) v *= 0.45;
  else if (contractYearsLeft < 1) v *= 0.65;
  else if (contractYearsLeft < 2) v *= 0.85;
  v *= 0.85 + rep / 330;
  if (v < 1000) v = 0;
  return roundValue(v);
}
export function roundValue(v: number): number {
  if (v >= 10_000_000) return Math.round(v / 500_000) * 500_000;
  if (v >= 1_000_000) return Math.round(v / 50_000) * 50_000;
  if (v >= 100_000) return Math.round(v / 5_000) * 5_000;
  return Math.round(v / 500) * 500;
}

/** expected weekly wage for a player of ability `ca` at a club with wage scale */
export function expectedWage(ca: number, age: number, wageScale: number): number {
  let w = 22000 * Math.exp(0.056 * (ca - 140)) * wageScale;
  if (age <= 19) w *= 0.45;
  else if (age <= 21) w *= 0.7;
  else if (age >= 33) w *= 0.8;
  w = Math.max(w, 150 * Math.max(0.25, wageScale));
  return roundWage(w);
}
export function roundWage(w: number): number {
  if (w >= 100000) return Math.round(w / 5000) * 5000;
  if (w >= 10000) return Math.round(w / 500) * 500;
  if (w >= 1000) return Math.round(w / 50) * 50;
  return Math.round(w / 10) * 10;
}
