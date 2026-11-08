// World generation: clubs, squads, finances.
import type { Club, Game, Player, Country } from './types';
import { ASSOCS, ASSOC, COLORS, LeagueDef, NATION } from '../data/nations';
import { CLUBS1 } from '../data/clubs1';
import { CLUBS2 } from '../data/clubs2';
import { CLUBS3 } from '../data/clubs3';
import { STARS } from '../data/stars';
import { G, R, setGame } from './state';
import { genPlayer, computePR, updateValue } from './player';
import type { PosCode } from './attrs';
import { POS_GROUP } from './attrs';
import { clamp, dayOf, hashStr, RNG } from './util';
import { makeTactic, emptySelection, aiChooseFormation } from './tactics';
import { defaultBoard } from './board';

const CLUB_DATA: Record<string, string> = { ...CLUBS1, ...CLUBS2, ...CLUBS3 };

export const START_YEAR = 2026;

function parseLines(key: string): { name: string; cc: string; rep?: number; cap?: number; stadium?: string }[] {
  const raw = CLUB_DATA[key];
  if (!raw) return [];
  return raw.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, cc, rep, cap, stadium] = l.split('|');
    return { name, cc: cc || 'wk', rep: rep ? parseFloat(rep) : undefined, cap: cap ? parseFloat(cap) : undefined, stadium };
  });
}

function shortName(name: string): string {
  const words = name.split(/[\s-]+/);
  if (name.length <= 12) return name;
  return words.reduce((a, b) => (b.length > a.length ? b : a), '');
}

export function tierFactor(tier: number) {
  return [1, 1, 0.5, 0.25, 0.12, 0.06][tier] ?? 0.05;
}

export function wageScaleFor(country: string, tier: number, rep: number): number {
  const w = ASSOC[country]?.wealth ?? 0.02;
  return Math.max(0.05, w * tierFactor(tier) * (0.3 + Math.pow(rep / 100, 1.5) * 1.2));
}

const BONUS: Record<string, number> = { ENG1: 12, ENG2: 6, ENG3: 3, ESP1: 6, GER1: 6, ITA1: 6, FRA1: 3, ESP2: 2, GER2: 2, ITA2: 1 };
export function starterCA(rep: number, leagueId: string | null): number {
  return clamp(28 + 1.45 * rep + (leagueId ? BONUS[leagueId] || 0 : 0), 42, 168);
}

// squad template (position, role tier: 0 starter, 1 rotation, 2 backup, 3 youth)
const TEMPLATE: [PosCode, number][] = [
  ['GK', 0], ['DL', 0], ['DC', 0], ['DC', 0], ['DR', 0], ['DM', 0], ['MC', 0], ['MC', 0], ['AML', 0], ['AMR', 0], ['ST', 0],
  ['GK', 2], ['DC', 1], ['DL', 1], ['DR', 1], ['MC', 1], ['AMC', 1], ['ML', 1], ['ST', 1],
  ['DC', 2], ['DM', 2], ['MR', 2], ['GK', 3], ['ST', 2], ['MC', 3], ['DC', 3],
];

function genSquad(club: Club, leagueId: string | null, foreign: number) {
  const a = ASSOC[club.country];
  const imports = a.imports.split(',').filter((c) => NATION[c]);
  const sCA = starterCA(club.rep, leagueId);
  const stars = (STARS[club.name] || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const template = TEMPLATE.slice(0, leagueId && leagueId.endsWith('1') ? 26 : 24);
  const used = new Array(template.length).fill(false);
  // real players
  for (const line of stars) {
    const [name, pos, by, nat, ca, pa] = line.split(';');
    const parts = name.split(' ');
    const ln = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
    const fn = parts.length > 1 ? parts[0] : '';
    const p = genPlayer({
      nat: NATION[nat] ? nat : club.country, pos: pos as PosCode, ca: parseInt(ca, 10), pa: pa ? parseInt(pa, 10) : undefined,
      age: START_YEAR - parseInt(by, 10), birthYear: parseInt(by, 10), club: club.id, wageScale: club.wageScale, seasonYear: START_YEAR,
      fn, ln, real: true, rep: club.rep,
    });
    // calibrate CA precisely for real players: genPlayer recalculates; keep target if close
    addPlayer(club, p);
    // consume a template slot of the same group
    const grp = POS_GROUP[pos as PosCode];
    let k = template.findIndex((t, i) => !used[i] && POS_GROUP[t[0]] === grp);
    if (k < 0) k = template.findIndex((t, i) => !used[i] && t[1] >= 2);
    if (k >= 0) used[k] = true;
  }
  template.forEach(([pos, tierR], i) => {
    if (used[i]) return;
    let ca: number, age: number;
    if (tierR === 0) { ca = sCA + R.gauss(0, 5); age = R.int(21, 32); }
    else if (tierR === 1) { ca = sCA - 8 + R.gauss(0, 5); age = R.int(19, 33); }
    else if (tierR === 2) { ca = sCA - 17 + R.gauss(0, 6); age = R.int(18, 34); }
    else { ca = sCA - 32 + R.gauss(0, 6); age = R.int(16, 19); }
    if (age >= 31) ca -= (age - 30) * 1.5;
    ca = clamp(Math.round(ca), 25, 180);
    const isForeign = R.chance(foreign);
    const nat = isForeign && imports.length ? imports[R.weightedIndex(imports.map((_, j) => 1 / (1 + j * 0.12)))] : club.country;
    const p = genPlayer({ nat, pos, ca, age, club: club.id, wageScale: club.wageScale, seasonYear: START_YEAR, rep: club.rep });
    if (tierR === 3) p.status = 4;
    addPlayer(club, p);
  });
  assignSquadStatus(club);
  assignShirts(club);
}

function addPlayer(club: Club, p: Player) {
  G.players[p.id] = p;
  club.players.push(p.id);
}

export function assignSquadStatus(club: Club) {
  const ps = club.players.map((id) => G.players[id]!).filter(Boolean).sort((a, b) => b.ca - a.ca);
  ps.forEach((p, i) => {
    if (p.status === 4 && p.ca < (ps[10]?.ca ?? 0) - 15) return;
    p.status = i < 4 ? 0 : i < 13 ? 1 : i < 19 ? 2 : 3;
  });
}

export function assignShirts(club: Club) {
  const used = new Set<number>();
  const ps = club.players.map((id) => G.players[id]!).filter(Boolean);
  for (const p of ps) if (p.shirt && !used.has(p.shirt)) used.add(p.shirt); else p.shirt = 0;
  const pref: Record<string, number[]> = { G: [1, 12, 13, 31, 41], D: [2, 3, 4, 5, 6, 15, 23, 24, 26, 33], M: [8, 6, 10, 14, 16, 17, 18, 20, 21, 22, 7, 11, 25], F: [9, 7, 11, 19, 27, 29, 30, 99] };
  for (const p of ps.sort((a, b) => b.ca - a.ca)) {
    if (p.shirt) continue;
    const g = p.pos[0] >= 15 ? 'G' : p.pos[13] >= 15 ? 'F' : (p.pos[2] >= 15 || p.pos[1] >= 15 || p.pos[3] >= 15) ? 'D' : 'M';
    let n = pref[g].find((x) => !used.has(x));
    if (!n) { n = 2; while (used.has(n)) n++; }
    p.shirt = n;
    used.add(n);
  }
}

export function setupFinances(club: Club, tier: number) {
  const wages = club.players.reduce((s, id) => s + (G.players[id]?.wage || 0), 0);
  const annualW = wages * 52;
  const revenue = annualW / R.range(0.55, 0.7);
  const ticketShare = 0.18;
  const homeGames = 19;
  const occ = 0.8;
  let ticket = (revenue * ticketShare) / Math.max(1, homeGames * club.cap * 1000 * occ);
  ticket = clamp(ticket, 3, 110);
  const matchday = ticket * homeGames * club.cap * 1000 * occ;
  const rest = Math.max(revenue - matchday, revenue * 0.4);
  club.fin = {
    balance: Math.round(revenue * R.range(0.08, 0.35) * (club.rep > 80 ? 1.6 : 1)),
    tBudget: 0,
    wBudget: Math.round(wages * R.range(1.03, 1.12)),
    tvYear: Math.round(rest * 0.58),
    comYear: Math.round(rest * 0.42),
    ticket: Math.round(ticket * 10) / 10,
    months: [],
    debt: 0,
  };
  club.fin.tBudget = Math.round(Math.max(0, club.fin.balance * R.range(0.25, 0.55)) / 100000) * 100000;
  void tier;
}

export function newCountry(code: string, rank: number, pts: number): Country {
  const per = pts / 5;
  return {
    code, rank, coef: [0, 1, 2, 3, 4].map(() => Math.round(per * R.range(0.75, 1.25) * 1000) / 1000),
    lastFinal: null, seasons: {}, curSeason: 0, pool: [],
  };
}

export function createWorld(seed: number): Game {
  const g: Game = {
    v: 1, seed, rng: seed, day: dayOf(START_YEAR, 1, 20), startDay: dayOf(START_YEAR, 7, 1), season: START_YEAR - 1, user: -1,
    mgr: null as any, board: defaultBoard(), clubs: [], players: [null], staff: [null], countries: {}, comps: {}, fixtures: {}, fxByDay: {},
    inbox: [], news: [], bids: [], transfers: [], honours: {}, nid: { p: 1, s: 1, fx: 1, msg: 1, bid: 1, tie: 1 }, euroHolders: {},
    training: { focus: 0, intensity: 1 }, settings: { mode: 1, speed: 2, cam: 0, autosave: true }, shortlist: [], scouted: {}, scoutTasks: [], flags: {},
  };
  setGame(g);
  for (const a of ASSOCS) g.countries[a.code] = newCountry(a.code, a.rank, a.pts);
  // clubs
  for (const a of ASSOCS) {
    for (const ld of a.leagues) {
      const lines = parseLines(ld.id);
      const n = lines.length;
      lines.forEach((l, i) => makeClub(a.code, ld, l, i, n));
    }
    const pool = parseLines(`${a.code}_P`);
    pool.forEach((l, i) => {
      const c = makeClub(a.code, null, l, i, pool.length);
      g.countries[a.code].pool.push(c.id);
    });
  }
  // squads & finances
  for (const c of g.clubs) {
    const ld = c.league ? ASSOCS.find((a) => a.code === c.country)!.leagues.find((l) => l.id === c.league)! : null;
    genSquad(c, c.league, ld ? ld.foreign : 0.05);
    setupFinances(c, ld?.tier ?? 6);
  }
  for (const p of g.players) if (p) { p.pr = computePR(p); updateValue(p); }
  // initial "last season" tables by reputation with noise
  for (const a of ASSOCS) {
    const ct = g.countries[a.code];
    const tables: number[][] = [];
    for (const ld of a.leagues) {
      const ids = g.clubs.filter((c) => c.league === ld.id).map((c) => c.id);
      ids.sort((x, y) => g.clubs[y].rep + R.gauss(0, 4) - (g.clubs[x].rep + R.gauss(0, 4)));
      tables.push(ids);
    }
    const top = tables[0] || [];
    const cupW = top[Math.min(top.length - 1, Math.floor(Math.abs(R.gauss(0, 2.5))))];
    ct.lastFinal = { season: START_YEAR - 1, table: tables, cupWinner: cupW };
  }
  // initial euro holders (2025/26 season, approximation)
  const byName = (n: string) => g.clubs.find((c) => c.name === n)?.id;
  g.euroHolders = { UCL: byName('ПСЖ'), UEL: byName('Тоттенхэм'), UECL: byName('Челси') };
  return g;
}

function makeClub(country: string, ld: LeagueDef | null, l: { name: string; cc: string; rep?: number; cap?: number; stadium?: string }, i: number, n: number): Club {
  const rr = ld ? ld.rep : ([Math.max(10, (ASSOC[country].leagues[ASSOC[country].leagues.length - 1].rep[1]) - 2), 8] as [number, number]);
  const rep = l.rep ?? Math.round(rr[0] - ((rr[0] - rr[1]) * i) / Math.max(1, n - 1) + R.gauss(0, 1.5));
  const cc = l.cc;
  const c1 = COLORS[cc[0]] || '#ffffff', c2 = COLORS[cc[1]] || '#111111';
  const kit = cc[2] || '';
  const tier = ld ? ld.tier : 6;
  const cap = l.cap ?? Math.max(1, Math.round(rep * rep / 160 + R.range(0, 4)));
  const id = G.clubs.length;
  const club: Club = {
    id, name: l.name, short: shortName(l.name), country, c1, c2, kit, crest: hashStr(l.name) % 8,
    rep: clamp(rep, 1, 100), league: ld ? ld.id : null, cap, stadium: l.stadium || `Стадион «${shortName(l.name)}»`, city: '',
    facT: clamp(Math.round(rep / 5.5 + R.gauss(0, 1.5)), 1, 20), facY: clamp(Math.round(rep / 5.5 + R.gauss(0, 2)), 1, 20),
    fin: null as any, players: [], staff: [], tactic: makeTactic('4-2-3-1'), sel: emptySelection(), mgr: '',
    coef: [0, 0, 0, 0, 0], famil: {}, wageScale: wageScaleFor(country, tier, rep),
  };
  const f = aiChooseFormation(club, hashStr(l.name + 'f'));
  club.tactic = makeTactic(f);
  club.famil[f] = 85;
  const rng = new RNG(hashStr(l.name));
  const fnPool = ['А.', 'В.', 'Д.', 'Е.', 'И.', 'К.', 'Л.', 'М.', 'Н.', 'О.', 'П.', 'Р.', 'С.', 'Т.', 'Ф.', 'Ю.'];
  club.mgr = `${rng.pick(fnPool)} ${['Петров', 'Миллер', 'Гарсия', 'Росси', 'Мартен', 'Новак', 'Ковач', 'Йылмаз', 'Хансен', 'Смит', 'Шмидт', 'Перейра', 'Иванов', 'Попеску', 'Папас'][rng.int(0, 14)]}`;
  // initial coefficient by reputation
  const tot = Math.pow(Math.max(0, rep - 45), 1.6) / 6;
  club.coef = [0, 1, 2, 3, 4].map(() => Math.round((tot / 5) * rng.range(0.6, 1.4) * 1000) / 1000);
  G.clubs.push(club);
  return club;
}

export function playerById(id: number) {
  return G.players[id];
}
export { dayOf };
