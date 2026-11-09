// Nations, UEFA associations, league formats and cup formats.

export interface NationDef {
  code: string;
  name: string;
  flag: string; // e.g. 'h:fff,0039a6,d52b1e'
  pool: string; // name pool key
}

export interface LeagueDef {
  id: string;
  country: string;
  tier: number;
  name: string;
  size: number;
  fmt: string; // 'rr2' | 'rr2|s6:2:F' ...
  up: number; // auto promoted
  upPO?: string; // '3-6:2:1N' (positions:semisLegs:finalLegs[N=neutral])
  down: number; // auto relegated
  rpo?: string; // '16v3:2' relegation playoffs vs lower league
  rep: [number, number];
  foreign: number; // share of foreign players
}

export interface CupDef {
  name: string;
  e: (number | string)[][]; // entry groups: tiers (number), 0 = pool clubs, 'T1:1-8' = tier1 positions 1..8
  sf: 1 | 2; // semi-final legs
  et: boolean; // extra time
  lh: boolean; // lower division club hosts
}

export interface AssocDef {
  code: string;
  rank: number;
  pts: number;
  cal: 'AS' | 'CY';
  wealth: number;
  start: string; // MMDD league start
  end: string; // MMDD league end
  winter?: [string, string];
  sup: 0 | 2 | 4; // super cup teams
  leagues: LeagueDef[];
  cup: CupDef;
  lcup?: CupDef; // league cup
  imports: string;
  euroPO?: boolean;
}

const N = (code: string, name: string, flag: string, pool: string): NationDef => ({ code, name, flag, pool });

export const NATIONS: NationDef[] = [
  N('ENG', 'Англия', 'c:ffffff,ce1124', 'en'),
  N('ITA', 'Италия', 'v:009246,ffffff,ce2b37', 'it'),
  N('ESP', 'Испания', 'h:aa151b,f1bf00,f1bf00,aa151b', 'es'),
  N('GER', 'Германия', 'h:111111,dd0000,ffce00', 'de'),
  N('FRA', 'Франция', 'v:0055a4,ffffff,ef4135', 'fr'),
  N('NED', 'Нидерланды', 'h:ae1c28,ffffff,21468b', 'nl'),
  N('POR', 'Португалия', 'v:006600,ff0000,ff0000', 'pt'),
  N('BEL', 'Бельгия', 'v:111111,fdda24,ef3340', 'nl'),
  N('TUR', 'Турция', 'd:e30a17,ffffff', 'tr'),
  N('RUS', 'Россия', 'h:ffffff,0039a6,d52b1e', 'ru'),
  N('CZE', 'Чехия', 'h:ffffff,d7141a', 'cz'),
  N('GRE', 'Греция', 'h:0d5eaf,ffffff,0d5eaf,ffffff,0d5eaf', 'gr'),
  N('NOR', 'Норвегия', 'n2:ba0c2f,ffffff,00205b', 'sc'),
  N('POL', 'Польша', 'h:ffffff,dc143c', 'pl'),
  N('DEN', 'Дания', 'n:c8102e,ffffff', 'sc'),
  N('AUT', 'Австрия', 'h:ed2939,ffffff,ed2939', 'de'),
  N('SUI', 'Швейцария', 'c:d52b1e,ffffff', 'de'),
  N('SCO', 'Шотландия', 'x:0065bd,ffffff', 'en'),
  N('SWE', 'Швеция', 'n:006aa7,fecc00', 'sc'),
  N('ISR', 'Израиль', 'h:ffffff,0038b8,ffffff', 'he'),
  N('CYP', 'Кипр', 'd:ffffff,d57800', 'gr'),
  N('CRO', 'Хорватия', 'h:ff0000,ffffff,171796', 'yu'),
  N('SRB', 'Сербия', 'h:c6363c,0c4076,ffffff', 'yu'),
  N('HUN', 'Венгрия', 'h:ce2939,ffffff,477050', 'hu'),
  N('UKR', 'Украина', 'h:0057b7,ffd700', 'ua'),
  N('SVN', 'Словения', 'h:ffffff,005ce5,ed1c24', 'yu'),
  N('ROU', 'Румыния', 'v:002b7f,fcd116,ce1126', 'ro'),
  N('SVK', 'Словакия', 'h:ffffff,0b4ea2,ee1c25', 'cz'),
  N('AZE', 'Азербайджан', 'h:00b5e2,ef3340,509e2f', 'az'),
  N('BUL', 'Болгария', 'h:ffffff,00966e,d62612', 'bg'),
  N('MDA', 'Молдавия', 'v:0046ae,ffd200,cc092f', 'ro'),
  N('IRL', 'Ирландия', 'v:169b62,ffffff,ff883e', 'en'),
  N('KAZ', 'Казахстан', 'd:00afca,fec50c', 'kz'),
  N('ISL', 'Исландия', 'n2:02529c,ffffff,dc1e35', 'sc'),
  N('ARM', 'Армения', 'h:d90012,0033a0,f2a800', 'hy'),
  N('BIH', 'Босния и Герцеговина', 'h:002395,fecb00', 'yu'),
  N('LVA', 'Латвия', 'h:9e3039,ffffff,9e3039', 'ba'),
  N('FIN', 'Финляндия', 'n:ffffff,003580', 'fi'),
  N('FRO', 'Фарерские острова', 'n2:ffffff,0065bd,ef303e', 'sc'),
  N('KOS', 'Косово', 'd:244aa5,d0a650', 'sq'),
  N('LTU', 'Литва', 'h:fdb913,006a44,c1272d', 'ba'),
  N('MLT', 'Мальта', 'v:ffffff,cf142b', 'mt'),
  N('NIR', 'Северная Ирландия', 'c:ffffff,c8102e', 'en'),
  N('GEO', 'Грузия', 'c:ffffff,ff0000', 'ka'),
  N('LUX', 'Люксембург', 'h:ed2939,ffffff,00a1de', 'fr'),
  N('ALB', 'Албания', 'd:e41e20,111111', 'sq'),
  N('MKD', 'Северная Македония', 'd:d20000,ffe600', 'bg'),
  N('BLR', 'Беларусь', 'h:c8313e,c8313e,4aa657', 'ru'),
  N('EST', 'Эстония', 'h:0072ce,111111,ffffff', 'fi'),
  N('WAL', 'Уэльс', 'h:ffffff,00ab39', 'en'),
  N('MNE', 'Черногория', 'd:c40308,d4af37', 'yu'),
  N('GIB', 'Гибралтар', 'h:ffffff,da000c', 'en'),
  N('AND', 'Андорра', 'v:10069f,fedf00,d0103a', 'es'),
  N('SMR', 'Сан-Марино', 'h:ffffff,5eb6e4', 'it'),
  // non-UEFA
  N('BRA', 'Бразилия', 'd:009c3b,ffdf00', 'br'),
  N('ARG', 'Аргентина', 'h:74acdf,ffffff,74acdf', 'la'),
  N('URU', 'Уругвай', 'h:ffffff,0038a8,ffffff,0038a8', 'la'),
  N('COL', 'Колумбия', 'h:fcd116,fcd116,003893,ce1126', 'la'),
  N('CHI', 'Чили', 'h:ffffff,d52b1e', 'la'),
  N('PAR', 'Парагвай', 'h:d52b1e,ffffff,0038a8', 'la'),
  N('MEX', 'Мексика', 'v:006847,ffffff,ce1126', 'la'),
  N('VEN', 'Венесуэла', 'h:ffcc00,00247d,cf142b', 'la'),
  N('ECU', 'Эквадор', 'h:ffd100,ffd100,034ea2,ef3340', 'la'),
  N('PER', 'Перу', 'v:d91023,ffffff,d91023', 'la'),
  N('USA', 'США', 'h:b22234,ffffff,b22234,ffffff,3c3b6e', 'en'),
  N('CAN', 'Канада', 'v:d80621,ffffff,d80621', 'en'),
  N('AUS', 'Австралия', 'd:00008b,ffffff', 'en'),
  N('JPN', 'Япония', 'd:ffffff,bc002d', 'jp'),
  N('KOR', 'Южная Корея', 'd:ffffff,cd2e3a', 'kr'),
  N('NGA', 'Нигерия', 'v:008751,ffffff,008751', 'af'),
  N('GHA', 'Гана', 'h:ce1126,fcd116,006b3f', 'af'),
  N('SEN', 'Сенегал', 'v:00853f,fdef42,e31b23', 'fa'),
  N('CIV', "Кот-д'Ивуар", 'v:f77f00,ffffff,009e60', 'fa'),
  N('MLI', 'Мали', 'v:14b53a,fcd116,ce1126', 'fa'),
  N('CMR', 'Камерун', 'v:007a5e,ce1126,fcd116', 'fa'),
  N('GUI', 'Гвинея', 'v:ce1126,fcd116,009460', 'fa'),
  N('MAR', 'Марокко', 'd:c1272d,006233', 'ar'),
  N('ALG', 'Алжир', 'v:006233,ffffff', 'ar'),
  N('TUN', 'Тунис', 'd:e70013,ffffff', 'ar'),
  N('EGY', 'Египет', 'h:ce1126,ffffff,111111', 'ar'),
  N('CPV', 'Кабо-Верде', 'h:003893,ffffff,cf2027,003893', 'pt'),
  N('COD', 'ДР Конго', 'd:007fff,ce1021', 'fa'),
  N('ANG', 'Ангола', 'h:cc092f,111111', 'pt'),
  N('UZB', 'Узбекистан', 'h:0099b5,ffffff,1eb53a', 'uz'),
  N('IRN', 'Иран', 'h:239f40,ffffff,da0000', 'ir'),
  N('CRC', 'Коста-Рика', 'h:002b7f,ffffff,ce1126,ffffff,002b7f', 'la'),
  N('NZL', 'Новая Зеландия', 'd:00247d,cc142b', 'en'),
  N('GAB', 'Габон', 'h:009e60,fcd116,3a75c4', 'fa'),
  N('BFA', 'Буркина-Фасо', 'h:ef2b2d,009e49', 'fa'),
  N('JAM', 'Ямайка', 'x:009b3a,fed100', 'en'),
  N('PAN', 'Панама', 'q:ffffff,da121a', 'la'),
  N('HON', 'Гондурас', 'h:0073cf,ffffff,0073cf', 'la'),
  N('BOL', 'Боливия', 'h:d52b1e,f9e300,007934', 'la'),
  N('HAI', 'Гаити', 'h:00209f,d21034', 'fa'),
  N('NIG', 'Нигер', 'h:e05206,ffffff,0db02b', 'fa'),
  N('TJK', 'Таджикистан', 'h:cc0000,ffffff,006600', 'uz'),
  N('TKM', 'Туркменистан', 'v:00843d,00843d', 'uz'),
];
export const NATION: Record<string, NationDef> = Object.fromEntries(NATIONS.map((n) => [n.code, n]));

// ---- league helper ----
const L = (country: string, tier: number, name: string, size: number, fmt: string, up: number, down: number, rep: [number, number], foreign: number, extra: Partial<LeagueDef> = {}): LeagueDef => ({
  id: country + tier, country, tier, name, size, fmt, up, down, rep, foreign, ...extra,
});
const CUP = (name: string, e: (number | string)[][], sf: 1 | 2 = 1, et = true, lh = false): CupDef => ({ name, e, sf, et, lh });

export const ASSOCS: AssocDef[] = [
  {
    code: 'ENG', rank: 1, pts: 115, cal: 'AS', wealth: 1.4, start: '0815', end: '0524', sup: 2,
    leagues: [
      L('ENG', 1, 'Премьер-лига', 20, 'rr2', 0, 3, [92, 64], 0.65),
      L('ENG', 2, 'Чемпионшип', 24, 'rr2', 2, 3, [62, 46], 0.4, { upPO: '3-6:2:1N' }),
      L('ENG', 3, 'Лига 1', 24, 'rr2', 2, 4, [48, 34], 0.25, { upPO: '3-6:2:1N' }),
      L('ENG', 4, 'Лига 2', 24, 'rr2', 3, 2, [36, 24], 0.2, { upPO: '4-7:2:1N' }),
      L('ENG', 5, 'Национальная лига', 24, 'rr2', 1, 2, [26, 14], 0.1, { upPO: '3-6:1:1N' }),
    ],
    cup: CUP('Кубок Англии', [[3, 4, 5, 0], [1, 2]], 1, true, false),
    lcup: CUP('Кубок английской лиги', [[2, 3, 4], [1]], 2, false, false),
    imports: 'FRA,ESP,POR,BRA,NED,BEL,GER,ARG,IRL,SCO,WAL,NGA,GHA,SEN,CIV,DEN,NOR,SWE,USA,JPN,KOR,COL,URU,ITA,CRO,SUI,MAR,EGY,CMR,MLI,AUS,JPN,ECU,POL,CZE,SRB,UKR',
  },
  {
    code: 'ITA', rank: 2, pts: 98, cal: 'AS', wealth: 0.55, start: '0823', end: '0524', sup: 4,
    leagues: [
      L('ITA', 1, 'Серия A', 20, 'rr2', 0, 3, [90, 58], 0.6),
      L('ITA', 2, 'Серия B', 20, 'rr2', 2, 3, [58, 40], 0.3, { upPO: '3-6:2:2' }),
    ],
    cup: CUP('Кубок Италии', [['2', 'T1:9-20', 0], ['T1:1-8']], 2, true, false),
    imports: 'ARG,BRA,FRA,ESP,POR,NED,BEL,SRB,CRO,SVN,POL,DEN,SWE,NGA,SEN,CIV,MAR,ALG,URU,COL,PAR,GER,SUI,AUT,ALB,KOS,GRE,ROU,USA,JPN,UKR,GEO',
  },
  {
    code: 'ESP', rank: 3, pts: 92, cal: 'AS', wealth: 0.62, start: '0815', end: '0524', sup: 4,
    leagues: [
      L('ESP', 1, 'Ла Лига', 20, 'rr2', 0, 3, [95, 60], 0.38),
      L('ESP', 2, 'Сегунда', 22, 'rr2', 2, 4, [60, 42], 0.2, { upPO: '3-6:2:2' }),
    ],
    cup: CUP('Кубок Испании', [[2, 0], [1]], 2, true, true),
    imports: 'ARG,BRA,FRA,POR,URU,COL,MEX,MAR,NED,BEL,GER,ITA,CRO,SRB,SEN,CIV,GHA,NGA,JPN,KOR,VEN,ECU,PAR,CHI,USA,DEN,NOR,SWE,ALG,GEO',
  },
  {
    code: 'GER', rank: 4, pts: 88, cal: 'AS', wealth: 0.62, start: '0822', end: '0516', winter: ['1221', '0109'], sup: 2,
    leagues: [
      L('GER', 1, 'Бундеслига', 18, 'rr2', 0, 2, [94, 60], 0.55, { rpo: '16v3:2' }),
      L('GER', 2, 'Вторая Бундеслига', 18, 'rr2', 2, 2, [70, 48], 0.3, { rpo: '16v3:2' }),
      L('GER', 3, 'Третья лига', 20, 'rr2', 2, 4, [50, 34], 0.15),
    ],
    cup: CUP('Кубок Германии', [[1, 2, 3, 0]], 1, true, true),
    imports: 'AUT,SUI,NED,BEL,FRA,DEN,POL,CZE,CRO,SRB,BIH,TUR,KOS,JPN,KOR,USA,BRA,ARG,NGA,GHA,CIV,SEN,MLI,ENG,ESP,POR,ITA,HUN,SVN,NOR,SWE,UKR,GEO,CAN',
  },
  {
    code: 'FRA', rank: 5, pts: 72, cal: 'AS', wealth: 0.45, start: '0815', end: '0516', winter: ['1222', '0102'], sup: 2,
    leagues: [
      L('FRA', 1, 'Лига 1', 18, 'rr2', 0, 2, [92, 58], 0.45, { rpo: '16v3:2' }),
      L('FRA', 2, 'Лига 2', 18, 'rr2', 2, 3, [60, 40], 0.22),
    ],
    cup: CUP('Кубок Франции', [[2, 0], [1]], 1, false, true),
    imports: 'SEN,CIV,MLI,CMR,GUI,MAR,ALG,TUN,COD,BEL,POR,BRA,ARG,ESP,ITA,GER,NED,SUI,DEN,NOR,CPV,GHA,NGA,JPN,KOR,USA,CRO,SRB,ANG',
  },
  {
    code: 'NED', rank: 6, pts: 66, cal: 'AS', wealth: 0.25, start: '0808', end: '0517', winter: ['1222', '0110'], sup: 2,
    leagues: [
      L('NED', 1, 'Эредивизи', 18, 'rr2', 0, 2, [82, 50], 0.42, { rpo: '16v3:2' }),
      L('NED', 2, 'Эрстедивизи', 16, 'rr2', 2, 0, [52, 36], 0.25),
    ],
    cup: CUP('Кубок Нидерландов', [[2], [1]], 1, true, true),
    imports: 'BEL,GER,DEN,NOR,SWE,BRA,ARG,MAR,GHA,NGA,CIV,SEN,JPN,KOR,USA,MEX,CZE,POL,SRB,CRO,AUT,SUI,ENG,FRA,ESP,POR,ISL,FIN,CPV',
  },
  {
    code: 'POR', rank: 7, pts: 63, cal: 'AS', wealth: 0.25, start: '0808', end: '0517', sup: 2,
    leagues: [
      L('POR', 1, 'Лига Португалии', 18, 'rr2', 0, 2, [84, 52], 0.55, { rpo: '16v3:2' }),
      L('POR', 2, 'Лига 2 Португалии', 18, 'rr2', 2, 2, [52, 36], 0.35),
    ],
    cup: CUP('Кубок Португалии', [[2, 0], [1]], 2, true, true),
    imports: 'BRA,ARG,URU,COL,ESP,CPV,ANG,SEN,CIV,MLI,NGA,GHA,MEX,VEN,PAR,ECU,FRA,BEL,NED,SRB,CRO,UKR,JPN,KOR,USA,MAR,ALG,GUI,COD,DEN,SWE,NOR',
  },
  {
    code: 'BEL', rank: 8, pts: 57, cal: 'AS', wealth: 0.2, start: '0725', end: '0525', winter: ['1224', '0110'], sup: 2,
    leagues: [
      L('BEL', 1, 'Про-лига', 16, 'rr2|s6,6,4:2,2,2:H', 0, 2, [78, 50], 0.55),
      L('BEL', 2, 'Челленджер Про-лига', 16, 'rr2', 2, 0, [50, 34], 0.35),
    ],
    cup: CUP('Кубок Бельгии', [[2], [1]], 2, true, true),
    imports: 'NED,FRA,GER,DEN,NOR,SWE,ISL,JPN,KOR,NGA,GHA,CIV,SEN,MLI,COD,CMR,MAR,BRA,ARG,COL,ESP,POR,SRB,CRO,UKR,USA,CAN,GEO,ISR,AUT,SUI',
  },
  {
    code: 'TUR', rank: 9, pts: 48, cal: 'AS', wealth: 0.4, start: '0808', end: '0524', winter: ['1229', '0112'], sup: 2,
    leagues: [
      L('TUR', 1, 'Суперлига', 18, 'rr2', 0, 3, [82, 52], 0.5),
      L('TUR', 2, 'Первая лига Турции', 20, 'rr2', 2, 4, [52, 36], 0.3, { upPO: '3-6:1:1N' }),
    ],
    cup: CUP('Кубок Турции', [[2], [1]], 2, true, true),
    imports: 'BRA,ARG,POR,ESP,FRA,NED,BEL,GER,SRB,CRO,BIH,MKD,ALB,KOS,AZE,GEO,NGA,GHA,CIV,SEN,MLI,CMR,MAR,ALG,TUN,COL,URU,POL,CZE,NOR,DEN,SWE,ITA,UKR,ENG,USA,KOR,JPN',
  },
  {
    code: 'RUS', rank: 10, pts: 47, cal: 'AS', wealth: 0.62, start: '0719', end: '0530', winter: ['1208', '0228'], sup: 2,
    leagues: [
      L('RUS', 1, 'Российская Премьер-лига', 16, 'rr2', 0, 2, [78, 54], 0.4, { rpo: '13v4:2,14v3:2' }),
      L('RUS', 2, 'Первая лига', 18, 'rr2', 2, 3, [52, 38], 0.12),
      L('RUS', 3, 'Вторая лига', 18, 'rr2', 3, 2, [38, 26], 0.04),
    ],
    cup: CUP('Кубок России', [[3], [2], [1]], 1, true, true),
    imports: 'BRA,ARG,COL,SRB,CRO,BLR,ARM,GEO,KAZ,UZB,AZE,MKD,MNE,BIH,SVN,POR,ESP,URU,PAR,VEN,ECU,CHI,PER,NGA,CIV,CMR,GHA,SEN,MLI,GUI,MAR,ALG,IRN,KOR,JPN,CPV,ANG,COD',
  },
  {
    code: 'CZE', rank: 11, pts: 46, cal: 'AS', wealth: 0.1, start: '0718', end: '0524', winter: ['1215', '0131'], sup: 0,
    leagues: [
      L('CZE', 1, 'Чешская лига', 16, 'rr2|s6,10:2,1:F', 0, 2, [72, 44], 0.3),
      L('CZE', 2, 'Чешская национальная лига', 16, 'rr2', 2, 0, [44, 30], 0.1),
    ],
    cup: CUP('Кубок Чехии', [[2], [1]], 1, false, true),
    imports: 'SVK,UKR,POL,CRO,SRB,BIH,NGA,GHA,CIV,SEN,MLI,BRA,ARG,AUT,GER,SVN,HUN,ROU,KOS,ALB,GEO,CMR',
  },
  {
    code: 'GRE', rank: 12, pts: 43, cal: 'AS', wealth: 0.15, start: '0822', end: '0517', sup: 0,
    leagues: [L('GRE', 1, 'Суперлига Греции', 14, 'rr2|s4,4,6:2,2,2:F', 0, 0, [76, 48], 0.6)],
    cup: CUP('Кубок Греции', [[1]], 2, true, false),
    imports: 'POR,ESP,ARG,BRA,SRB,CRO,BIH,MKD,ALB,CYP,BUL,ROU,POL,NOR,SWE,DEN,NED,BEL,FRA,ITA,GER,NGA,GHA,CIV,SEN,MLI,MAR,ALG,TUN,URU,COL,PAR,URU,ECU,USA',
  },
  {
    code: 'NOR', rank: 13, pts: 40, cal: 'CY', wealth: 0.1, start: '0329', end: '1129', sup: 0,
    leagues: [
      L('NOR', 1, 'Элитсерия', 16, 'rr2', 0, 2, [66, 44], 0.25, { rpo: '14v3:2' }),
      L('NOR', 2, 'ОБОС-лига', 16, 'rr2', 2, 0, [46, 30], 0.12),
    ],
    cup: CUP('Кубок Норвегии', [[2], [1]], 1, true, true),
    imports: 'SWE,DEN,ISL,FIN,FRO,NGA,GHA,SEN,CIV,USA,BRA,COL,NED,BEL,GER,ENG,SCO,IRL,POL,CZE,SRB,KOS,ALB',
  },
  {
    code: 'POL', rank: 14, pts: 39, cal: 'AS', wealth: 0.12, start: '0718', end: '0524', winter: ['1215', '0130'], sup: 2,
    leagues: [
      L('POL', 1, 'Экстракласа', 18, 'rr2', 0, 3, [66, 46], 0.4),
      L('POL', 2, 'Первая лига Польши', 18, 'rr2', 2, 3, [48, 32], 0.15, { upPO: '3-6:1:1' }),
    ],
    cup: CUP('Кубок Польши', [[2], [1]], 1, true, true),
    imports: 'ESP,POR,SVK,CZE,UKR,BLR,LTU,LVA,SRB,CRO,BIH,SVN,MKD,GEO,NOR,SWE,DEN,FIN,NED,BEL,GER,AUT,BRA,ARG,COL,NGA,GHA,SEN,CIV,MLI,GRE,CYP,ISR',
  },
  {
    code: 'DEN', rank: 15, pts: 37, cal: 'AS', wealth: 0.12, start: '0718', end: '0524', winter: ['1208', '0215'], sup: 0,
    leagues: [
      L('DEN', 1, 'Суперлига Дании', 12, 'rr2|s6,6:2,2:F', 0, 2, [68, 44], 0.35),
      L('DEN', 2, 'Первый дивизион Дании', 12, 'rr2|s6,6:2,2:F', 2, 0, [46, 30], 0.15),
    ],
    cup: CUP('Кубок Дании', [[2], [1]], 2, true, true),
    imports: 'NOR,SWE,ISL,FIN,FRO,GER,NED,BEL,NGA,GHA,SEN,CIV,USA,BRA,COL,ARG,POL,CZE,SRB,CRO,SVN,JPN,KOR,AUS,ENG,SCO,IRL',
  },
  {
    code: 'AUT', rank: 16, pts: 36, cal: 'AS', wealth: 0.13, start: '0725', end: '0524', winter: ['1215', '0207'], sup: 0,
    leagues: [
      L('AUT', 1, 'Бундеслига Австрии', 12, 'rr2|s6,6:2,2:h', 0, 1, [74, 46], 0.4),
      L('AUT', 2, 'Вторая лига Австрии', 16, 'rr2', 1, 0, [46, 28], 0.15),
    ],
    cup: CUP('Кубок Австрии', [[2], [1]], 1, true, true),
    imports: 'GER,SUI,HUN,CZE,SVK,SVN,CRO,SRB,BIH,KOS,ALB,DEN,NOR,SWE,FRA,BEL,NED,NGA,GHA,CIV,SEN,MLI,BRA,ARG,JPN,KOR,USA,CAN,ISR',
  },
  {
    code: 'SUI', rank: 17, pts: 35, cal: 'AS', wealth: 0.15, start: '0725', end: '0523', winter: ['1221', '0124'], sup: 0,
    leagues: [
      L('SUI', 1, 'Суперлига Швейцарии', 12, 'rr3|s6,6:1,1:F', 0, 1, [70, 48], 0.42, { rpo: '11v2:2' }),
      L('SUI', 2, 'Челлендж-лига', 10, 'rr4', 1, 0, [48, 32], 0.25),
    ],
    cup: CUP('Кубок Швейцарии', [[2], [1]], 1, true, true),
    imports: 'GER,AUT,FRA,ITA,KOS,ALB,MKD,SRB,CRO,BIH,POR,ESP,NED,BEL,DEN,NOR,SWE,ISL,NGA,GHA,CIV,SEN,MLI,CMR,COD,BRA,ARG,JPN,KOR,USA',
  },
  {
    code: 'SCO', rank: 18, pts: 34, cal: 'AS', wealth: 0.15, start: '0802', end: '0516', winter: ['0103', '0117'], sup: 0,
    leagues: [
      L('SCO', 1, 'Премьершип', 12, 'rr3|s6,6:1,1:F', 0, 1, [78, 50], 0.45, { rpo: '11v2:2' }),
      L('SCO', 2, 'Чемпионшип Шотландии', 10, 'rr4', 1, 1, [50, 36], 0.15, { rpo: '9v2:2' }),
      L('SCO', 3, 'Лига 1 Шотландии', 10, 'rr4', 1, 1, [38, 26], 0.08, { rpo: '9v2:2' }),
      L('SCO', 4, 'Лига 2 Шотландии', 10, 'rr4', 1, 0, [28, 16], 0.05),
    ],
    cup: CUP('Кубок Шотландии', [[3, 4], [1, 2]], 1, true, false),
    imports: 'ENG,IRL,NIR,WAL,AUS,USA,CAN,JPN,KOR,NED,BEL,GER,DEN,NOR,SWE,ISL,FIN,POL,CZE,SRB,CRO,NGA,GHA,CIV,SEN,FRA,POR,ESP,BRA,COL',
  },
  {
    code: 'SWE', rank: 19, pts: 33, cal: 'CY', wealth: 0.1, start: '0329', end: '1108', sup: 0,
    leagues: [
      L('SWE', 1, 'Аллсвенскан', 16, 'rr2', 0, 2, [66, 44], 0.25, { rpo: '14v3:2' }),
      L('SWE', 2, 'Суперэттан', 16, 'rr2', 2, 0, [46, 30], 0.12),
    ],
    cup: CUP('Кубок Швеции', [[2], [1]], 1, true, true),
    imports: 'NOR,DEN,ISL,FIN,FRO,GER,NED,BEL,NGA,GHA,SEN,CIV,USA,BRA,COL,ARG,POL,CZE,SRB,BIH,KOS,ALB,ENG,SCO,IRL',
  },
  {
    code: 'ISR', rank: 20, pts: 31, cal: 'AS', wealth: 0.08, start: '0822', end: '0524', sup: 2,
    leagues: [L('ISR', 1, 'Премьер-лига Израиля', 14, 'rr2|s6,8:2,1:F', 0, 0, [62, 40], 0.3)],
    cup: CUP('Кубок Израиля', [[1]], 2, true, false),
    imports: 'POR,ESP,BRA,ARG,COL,SRB,CRO,BIH,MKD,ALB,ROU,BUL,POL,CZE,NGA,GHA,CIV,SEN,MLI,CMR,FRA,BEL,NED,GER,AUT,USA,UKR,GEO',
  },
  {
    code: 'CYP', rank: 21, pts: 30, cal: 'AS', wealth: 0.08, start: '0822', end: '0517', sup: 2,
    leagues: [L('CYP', 1, 'Первый дивизион Кипра', 14, 'rr2|s6,8:2,1:F', 0, 0, [60, 36], 0.65)],
    cup: CUP('Кубок Кипра', [[1]], 2, true, false),
    imports: 'GRE,POR,ESP,BRA,ARG,SRB,CRO,BIH,MKD,ALB,ROU,BUL,POL,CZE,SVK,NGA,GHA,CIV,SEN,MLI,CMR,FRA,BEL,NED,NOR,SWE,ISL,GEO,ISR',
  },
  {
    code: 'CRO', rank: 22, pts: 29, cal: 'AS', wealth: 0.08, start: '0725', end: '0524', winter: ['1220', '0125'], sup: 2,
    leagues: [
      L('CRO', 1, 'Хорватская лига', 10, 'rr4', 0, 1, [70, 44], 0.35),
      L('CRO', 2, 'Первая лига Хорватии', 10, 'rr4', 1, 0, [44, 28], 0.1),
    ],
    cup: CUP('Кубок Хорватии', [[2], [1]], 1, true, true),
    imports: 'BIH,SRB,SVN,MNE,MKD,ALB,KOS,AUT,GER,HUN,SVK,CZE,POL,UKR,NGA,GHA,CIV,SEN,BRA,ARG,COL,ESP,POR,FRA,ITA,JPN,KOR',
  },
  {
    code: 'SRB', rank: 23, pts: 28, cal: 'AS', wealth: 0.07, start: '0718', end: '0524', winter: ['1215', '0201'], sup: 0,
    leagues: [L('SRB', 1, 'Суперлига Сербии', 16, 'rr2|s8,8:1,1:F', 0, 0, [72, 40], 0.25)],
    cup: CUP('Кубок Сербии', [[1]], 1, false, true),
    imports: 'BIH,MNE,MKD,CRO,SVN,BUL,ROU,HUN,GHA,NGA,CIV,SEN,MLI,CMR,GUI,BRA,ARG,COL,URU,JPN,UKR,RUS,BLR,ALB',
  },
  {
    code: 'HUN', rank: 24, pts: 27, cal: 'AS', wealth: 0.08, start: '0725', end: '0517', winter: ['1215', '0131'], sup: 0,
    leagues: [L('HUN', 1, 'НБ I', 12, 'rr3', 0, 0, [70, 42], 0.35)],
    cup: CUP('Кубок Венгрии', [[1]], 1, true, true),
    imports: 'SRB,CRO,BIH,SVK,ROU,UKR,AUT,GER,NED,BEL,NOR,DEN,FIN,ISL,NGA,GHA,CIV,SEN,MLI,BRA,ARG,ESP,POR,FRA,ISR,MKD,ALB,KOS',
  },
  {
    code: 'UKR', rank: 25, pts: 26, cal: 'AS', wealth: 0.12, start: '0801', end: '0531', winter: ['1210', '0225'], sup: 0,
    leagues: [
      L('UKR', 1, 'Премьер-лига Украины', 16, 'rr2', 0, 2, [72, 44], 0.2, { rpo: '13v4:2,14v3:2' }),
      L('UKR', 2, 'Первая лига Украины', 16, 'rr2', 2, 0, [44, 28], 0.05),
    ],
    cup: CUP('Кубок Украины', [[2], [1]], 1, true, true),
    imports: 'BRA,ARG,COL,NGA,GHA,CIV,SEN,MLI,GUI,GEO,MDA,LTU,LVA,EST,POL,CZE,SVK,CRO,SRB,BIH,ESP,POR,FRA',
  },
  {
    code: 'SVN', rank: 26, pts: 25, cal: 'AS', wealth: 0.04, start: '0718', end: '0524', winter: ['1215', '0201'], sup: 0,
    leagues: [L('SVN', 1, 'ПрваЛига', 10, 'rr4', 0, 0, [56, 36], 0.35)],
    cup: CUP('Кубок Словении', [[1]], 1, true, true),
    imports: 'CRO,BIH,SRB,MNE,MKD,KOS,ALB,AUT,HUN,ITA,GER,NGA,GHA,CIV,SEN,BRA,ARG,FRA,ESP,POR,JPN',
  },
  {
    code: 'ROU', rank: 27, pts: 24, cal: 'AS', wealth: 0.07, start: '0711', end: '0524', winter: ['1222', '0115'], sup: 2,
    leagues: [L('ROU', 1, 'Суперлига Румынии', 16, 'rr2|s6,10:2,1:H', 0, 0, [66, 40], 0.3)],
    cup: CUP('Кубок Румынии', [[1]], 2, true, true),
    imports: 'MDA,SRB,CRO,BIH,MKD,ALB,BUL,HUN,UKR,POR,ESP,FRA,BEL,NED,BRA,ARG,COL,NGA,GHA,CIV,SEN,MLI,CMR,ITA,GER,GRE,CYP',
  },
  {
    code: 'SVK', rank: 28, pts: 23, cal: 'AS', wealth: 0.05, start: '0725', end: '0524', winter: ['1215', '0207'], sup: 0,
    leagues: [L('SVK', 1, 'Нике-лига', 12, 'rr2|s6,6:2,2:F', 0, 0, [62, 40], 0.3)],
    cup: CUP('Кубок Словакии', [[1]], 1, true, true),
    imports: 'CZE,HUN,POL,UKR,SRB,CRO,BIH,SVN,AUT,NGA,GHA,CIV,SEN,BRA,ARG,COL,ESP,POR,KOS,ALB,MKD',
  },
  {
    code: 'AZE', rank: 29, pts: 22, cal: 'AS', wealth: 0.06, start: '0808', end: '0524', winter: ['1222', '0125'], sup: 0,
    leagues: [L('AZE', 1, 'Премьер-лига Азербайджана', 12, 'rr3', 0, 0, [64, 38], 0.4)],
    cup: CUP('Кубок Азербайджана', [[1]], 2, true, false),
    imports: 'BRA,ARG,COL,POR,ESP,GEO,UKR,SRB,CRO,BIH,MKD,ALB,KOS,BUL,ROU,NGA,GHA,CIV,SEN,MLI,FRA,BEL,NED,MDA,TUR',
  },
  {
    code: 'BUL', rank: 30, pts: 21, cal: 'AS', wealth: 0.05, start: '0718', end: '0524', winter: ['1215', '0207'], sup: 2,
    leagues: [L('BUL', 1, 'Первая лига Болгарии', 16, 'rr2|s4,4,8:2,1,1:F', 0, 0, [62, 38], 0.35)],
    cup: CUP('Кубок Болгарии', [[1]], 2, true, true),
    imports: 'BRA,ARG,COL,POR,ESP,FRA,NED,BEL,MKD,SRB,CRO,BIH,ROU,GRE,CYP,UKR,NGA,GHA,CIV,SEN,MLI,CMR,CPV,ANG,VEN',
  },
  {
    code: 'MDA', rank: 31, pts: 20, cal: 'AS', wealth: 0.03, start: '0718', end: '0524', winter: ['1201', '0301'], sup: 2,
    leagues: [L('MDA', 1, 'Суперлига Молдавии', 8, 'rr4', 0, 0, [56, 34], 0.3)],
    cup: CUP('Кубок Молдавии', [[1]], 2, true, false),
    imports: 'ROU,UKR,BRA,COL,NGA,GHA,CIV,SEN,MLI,CMR,SRB,BUL,GEO,BLR,RUS',
  },
  {
    code: 'IRL', rank: 32, pts: 19, cal: 'CY', wealth: 0.04, start: '0214', end: '1031', sup: 0,
    leagues: [L('IRL', 1, 'Премьер-дивизион Ирландии', 10, 'rr4', 0, 0, [50, 36], 0.15)],
    cup: CUP('Кубок Ирландии', [[1]], 1, true, false),
    imports: 'ENG,SCO,NIR,WAL,USA,CAN,AUS,NGA,GHA,FRA,NED,BEL',
  },
  {
    code: 'KAZ', rank: 33, pts: 18.5, cal: 'CY', wealth: 0.06, start: '0301', end: '1102', sup: 2,
    leagues: [L('KAZ', 1, 'Премьер-лига Казахстана', 14, 'rr2', 0, 0, [52, 34], 0.35)],
    cup: CUP('Кубок Казахстана', [[1]], 2, true, false),
    imports: 'RUS,BLR,UKR,GEO,ARM,AZE,UZB,SRB,CRO,BIH,MNE,MKD,BRA,ARG,COL,NGA,GHA,CIV,SEN,MLI,LTU,LVA,EST',
  },
  {
    code: 'ISL', rank: 34, pts: 18, cal: 'CY', wealth: 0.03, start: '0405', end: '1026', sup: 0,
    leagues: [L('ISL', 1, 'Бесте-дейлд', 12, 'rr2|s6,6:1,1:F', 0, 0, [44, 30], 0.2)],
    cup: CUP('Кубок Исландии', [[1]], 1, true, false),
    imports: 'DEN,NOR,SWE,FRO,FIN,ENG,SCO,IRL,USA,NED,ESP,SRB,CRO',
  },
  {
    code: 'ARM', rank: 35, pts: 17, cal: 'AS', wealth: 0.03, start: '0801', end: '0531', winter: ['1201', '0301'], sup: 2,
    leagues: [L('ARM', 1, 'Премьер-лига Армении', 10, 'rr4', 0, 0, [44, 30], 0.45)],
    cup: CUP('Кубок Армении', [[1]], 2, true, false),
    imports: 'RUS,UKR,BLR,GEO,BRA,ARG,COL,SRB,CRO,BIH,MNE,NGA,GHA,CIV,SEN,MLI,CMR,ESP,POR,FRA',
  },
  {
    code: 'BIH', rank: 36, pts: 16.5, cal: 'AS', wealth: 0.03, start: '0725', end: '0524', winter: ['1215', '0215'], sup: 0,
    leagues: [L('BIH', 1, 'Премьер-лига Боснии', 10, 'rr4', 0, 0, [48, 32], 0.2)],
    cup: CUP('Кубок Боснии', [[1]], 2, true, false),
    imports: 'SRB,CRO,MNE,MKD,SVN,ALB,KOS,BRA,NGA,GHA,CIV,SEN,JPN',
  },
  {
    code: 'LVA', rank: 37, pts: 16, cal: 'CY', wealth: 0.03, start: '0301', end: '1108', sup: 0,
    leagues: [L('LVA', 1, 'Вирслига', 10, 'rr4', 0, 0, [46, 30], 0.4)],
    cup: CUP('Кубок Латвии', [[1]], 1, true, false),
    imports: 'LTU,EST,UKR,BLR,RUS,GEO,BRA,COL,NGA,GHA,CIV,SEN,JPN,ESP,POR,SRB',
  },
  {
    code: 'FIN', rank: 38, pts: 15.5, cal: 'CY', wealth: 0.03, start: '0405', end: '1102', sup: 0,
    leagues: [L('FIN', 1, 'Вейккауслига', 12, 'rr2|s6,6:2,2:F', 0, 0, [48, 32], 0.3)],
    cup: CUP('Кубок Финляндии', [[1]], 1, true, false),
    imports: 'SWE,NOR,DEN,EST,ISL,ENG,SCO,IRL,USA,NGA,GHA,SEN,CIV,BRA,NED,SRB',
  },
  {
    code: 'FRO', rank: 39, pts: 15, cal: 'CY', wealth: 0.02, start: '0301', end: '1026', sup: 0,
    leagues: [L('FRO', 1, 'Премьер-лига Фарер', 10, 'rr3', 0, 0, [40, 26], 0.15)],
    cup: CUP('Кубок Фарерских островов', [[1]], 1, true, false),
    imports: 'DEN,ISL,NOR,SWE,SRB,NGA,BRA',
  },
  {
    code: 'KOS', rank: 40, pts: 14, cal: 'AS', wealth: 0.02, start: '0808', end: '0531', winter: ['1201', '0221'], sup: 0,
    leagues: [L('KOS', 1, 'Суперлига Косово', 10, 'rr4', 0, 0, [38, 28], 0.15)],
    cup: CUP('Кубок Косово', [[1]], 2, true, false),
    imports: 'ALB,MKD,MNE,CRO,NGA,GHA,BRA,SUI,GER',
  },
  {
    code: 'LTU', rank: 41, pts: 13.5, cal: 'CY', wealth: 0.02, start: '0301', end: '1108', sup: 0,
    leagues: [L('LTU', 1, 'А Лига', 10, 'rr4', 0, 0, [42, 28], 0.35)],
    cup: CUP('Кубок Литвы', [[1]], 1, true, false),
    imports: 'LVA,EST,UKR,BLR,POL,GEO,BRA,NGA,GHA,CIV,SEN,ESP,POR,SRB,JPN',
  },
  {
    code: 'MLT', rank: 42, pts: 13, cal: 'AS', wealth: 0.02, start: '0822', end: '0503', sup: 0,
    leagues: [L('MLT', 1, 'Премьер-лига Мальты', 12, 'rr2|s6,6:2,2:F', 0, 0, [36, 22], 0.4)],
    cup: CUP('Кубок Мальты', [[1]], 1, true, false),
    imports: 'ITA,SRB,MNE,BRA,ARG,COL,URU,NGA,GHA,SEN,ESP,POR,ENG,MKD',
  },
  {
    code: 'NIR', rank: 43, pts: 12.5, cal: 'AS', wealth: 0.02, start: '0808', end: '0425', sup: 0,
    leagues: [L('NIR', 1, 'Премьершип Северной Ирландии', 12, 'rr3|s6,6:1,1:F', 0, 0, [38, 24], 0.15)],
    cup: CUP('Кубок Северной Ирландии', [[1]], 1, true, false),
    imports: 'ENG,SCO,IRL,WAL,USA,CAN,NGA',
  },
  {
    code: 'GEO', rank: 44, pts: 12, cal: 'CY', wealth: 0.02, start: '0301', end: '1130', sup: 2,
    leagues: [L('GEO', 1, 'Эровнули-лига', 10, 'rr4', 0, 0, [40, 28], 0.25)],
    cup: CUP('Кубок Грузии', [[1]], 2, true, false),
    imports: 'UKR,ARM,AZE,RUS,BLR,BRA,NGA,GHA,CIV,SEN,SRB,CRO',
  },
  {
    code: 'LUX', rank: 45, pts: 11.5, cal: 'AS', wealth: 0.02, start: '0808', end: '0524', winter: ['1215', '0215'], sup: 0,
    leagues: [L('LUX', 1, 'Национальный дивизион', 16, 'rr2', 0, 0, [34, 22], 0.45)],
    cup: CUP('Кубок Люксембурга', [[1]], 1, true, false),
    imports: 'FRA,BEL,GER,POR,CPV,ITA,NED,MNE,BIH,SRB,NGA,SEN,CIV,MLI,CMR',
  },
  {
    code: 'ALB', rank: 46, pts: 11, cal: 'AS', wealth: 0.02, start: '0822', end: '0524', sup: 2,
    leagues: [L('ALB', 1, 'Суперлига Албании', 10, 'rr4', 0, 0, [38, 28], 0.3)],
    cup: CUP('Кубок Албании', [[1]], 2, true, false),
    imports: 'KOS,MKD,MNE,ITA,BRA,NGA,GHA,CIV,SEN,SRB,CRO,GRE',
  },
  {
    code: 'MKD', rank: 47, pts: 10.5, cal: 'AS', wealth: 0.02, start: '0808', end: '0524', winter: ['1215', '0215'], sup: 0,
    leagues: [L('MKD', 1, 'Первая лига Македонии', 12, 'rr3', 0, 0, [36, 26], 0.25)],
    cup: CUP('Кубок Северной Македонии', [[1]], 2, true, false),
    imports: 'SRB,ALB,KOS,BUL,MNE,CRO,BIH,BRA,NGA,GHA',
  },
  {
    code: 'BLR', rank: 48, pts: 10, cal: 'CY', wealth: 0.03, start: '0315', end: '1130', sup: 2,
    leagues: [L('BLR', 1, 'Высшая лига Беларуси', 16, 'rr2', 0, 0, [46, 30], 0.2)],
    cup: CUP('Кубок Беларуси', [[1]], 2, true, false),
    imports: 'RUS,UKR,LTU,LVA,ARM,GEO,SRB,BRA,NGA,GHA,CIV,SEN,MLI,CMR',
  },
  {
    code: 'EST', rank: 49, pts: 9, cal: 'CY', wealth: 0.02, start: '0301', end: '1108', sup: 0,
    leagues: [L('EST', 1, 'Мейстрилига', 10, 'rr4', 0, 0, [38, 26], 0.25)],
    cup: CUP('Кубок Эстонии', [[1]], 1, true, false),
    imports: 'FIN,LVA,LTU,UKR,RUS,BRA,NGA,GHA,SEN,JPN',
  },
  {
    code: 'WAL', rank: 50, pts: 8.5, cal: 'AS', wealth: 0.02, start: '0808', end: '0425', sup: 0,
    leagues: [L('WAL', 1, 'Камри Премьер', 12, 'rr2|s6,6:2,2:F', 0, 0, [40, 22], 0.2)],
    cup: CUP('Кубок Уэльса', [[1]], 1, true, false),
    imports: 'ENG,SCO,IRL,NIR',
  },
  {
    code: 'MNE', rank: 51, pts: 8, cal: 'AS', wealth: 0.02, start: '0801', end: '0524', winter: ['1215', '0215'], sup: 0,
    leagues: [L('MNE', 1, 'Первая лига Черногории', 10, 'rr4', 0, 0, [36, 26], 0.2)],
    cup: CUP('Кубок Черногории', [[1]], 2, true, false),
    imports: 'SRB,BIH,CRO,MKD,ALB,KOS,NGA,GHA,BRA,JPN',
  },
  {
    code: 'GIB', rank: 52, pts: 7, cal: 'AS', wealth: 0.01, start: '0912', end: '0510', sup: 0,
    leagues: [L('GIB', 1, 'Национальная лига Гибралтара', 10, 'rr2', 0, 0, [32, 16], 0.6)],
    cup: CUP('Кубок Гибралтара', [[1]], 1, true, false),
    imports: 'ESP,ENG,POR,ITA,ARG,BRA,MAR,NGA,SCO,IRL',
  },
  {
    code: 'AND', rank: 53, pts: 6, cal: 'AS', wealth: 0.01, start: '0912', end: '0510', sup: 0,
    leagues: [L('AND', 1, 'Примера Дивизио', 8, 'rr3', 0, 0, [24, 14], 0.6)],
    cup: CUP('Кубок Андорры', [[1]], 1, true, false),
    imports: 'ESP,POR,FRA,ARG,URU,BRA,MAR',
  },
  {
    code: 'SMR', rank: 54, pts: 4, cal: 'AS', wealth: 0.01, start: '0912', end: '0510', sup: 0,
    leagues: [L('SMR', 1, 'Чемпионат Сан-Марино', 16, 'rr1|s8,8:1,1:F', 0, 0, [18, 10], 0.4)],
    cup: CUP('Кубок Сан-Марино', [[1]], 1, true, false),
    imports: 'ITA',
  },
];
export const ASSOC: Record<string, AssocDef> = Object.fromEntries(ASSOCS.map((a) => [a.code, a]));
export const LEAGUE_DEF: Record<string, LeagueDef> = {};
for (const a of ASSOCS) for (const l of a.leagues) LEAGUE_DEF[l.id] = l;

export const COLORS: Record<string, string> = {
  w: '#ffffff', k: '#16181c', r: '#d0202e', b: '#1f4fbf', n: '#152a66', s: '#79bdef', g: '#16894a', y: '#f6d21a',
  o: '#f27a1a', p: '#5d2d8f', m: '#7d1d3b', a: '#9ea4ab', z: '#c9a227', c: '#109a9a', l: '#9ccc3a', e: '#0d5a30',
  h: '#6a4426', i: '#ef5aa0', d: '#a3003f', v: '#2a3fa0',
};
