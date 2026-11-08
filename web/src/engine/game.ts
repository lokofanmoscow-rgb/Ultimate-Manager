// Main game loop: daily processing, calendar events, season transitions, career management.
import type { Comp, Fixture, Manager } from './types';
import { G, R, P, IDX, rebuildIndexes, syncRng } from './state';
import { createWorld, START_YEAR, wageScaleFor, assignShirts, assignSquadStatus, tierFactor } from './world';
import { ASSOCS, ASSOC, LEAGUE_DEF } from '../data/nations';
import { dayOf, ymd, weekday, fmtMoney, clamp, fmtDate, plural } from './util';
import { createLeague, createCup, createSuperCup, checkLeague, checkKnockout, frameFor, standings, tryRelegationPO, countryGen } from './comps';
import { createEuroSeason, checkEuro, checkEuroTimers, euroCompsOfSeason, EURO_NAMES } from './euro';
import { quickSim } from './quicksim';
import { applyResult, dailyRecovery } from './results';
import { monthlyFinances, setSeasonBudgets, income } from './finance';
import { monthlyDevelopment, retirements, youthIntake, weeklyMorale, playingTimeComplaints } from './dev';
import { dailyTransfers, contractExpiry, contractReminders, sackAiManagers, windowOpen } from './transfers';
import { setObjectives, monthlyBoard, seasonReview, generateVacancies, managerStartWage, defaultBoard } from './board';
import { addMsg, addNews, pendingDecisions } from './inbox';
import { rolloverCoefficients } from './coef';
import { ensureClubStaff, ensureFreeStaff } from './staff';
import { dailyScouting } from './scouting';
import { computePR, updateValue, fullName } from './player';
import { emptyStats } from './types';
import { emptySelection } from './tactics';

export const CY = (code: string) => ASSOC[code]?.cal === 'CY';

// ---------- world bootstrap ----------
export async function generateWorld(seed: number, progress?: (p: number, text: string) => void | Promise<void>) {
  createWorld(seed);
  rebuildIndexes();
  morningEvents();
  const end = dayOf(START_YEAR, 7, 1);
  const total = end - G.day;
  let i = 0;
  while (G.day < end) {
    processDay();
    i++;
    if (progress && i % 10 === 0) await progress(i / total, 'Симуляция начала года...');
  }
  ensureFreeStaff();
  syncRng();
}

export function startCareer(m: Omit<Manager, 'club' | 'wage' | 'cEnd' | 'joined' | 'record' | 'history' | 'trophies'>, clubId: number) {
  G.mgr = { ...m, club: -1, wage: 0, cEnd: 0, joined: G.day, record: { p: 0, w: 0, d: 0, l: 0 }, history: [], trophies: [] };
  takeOverClub(clubId, true);
  G.startDay = G.day;
  addMsg({ from: 'Ассистент', subj: 'Добро пожаловать!', kind: 'welcome', important: false, body: welcomeText() });
}

function welcomeText() {
  const c = G.clubs[G.user];
  return `Здравствуйте, ${G.mgr.fn}!\n\nРад приветствовать вас на посту главного тренера «${c.name}». Я подготовил всё необходимое:\n\n• Раздел «Состав» — список игроков и их характеристики.\n• «Тактика» — схема, роли и командные инструкции.\n• «Трансферы» — поиск игроков, предложения и аренды.\n• «Финансы» и «Клуб» — бюджет, задачи совета директоров, контракт.\n\nНажимайте «Продолжить», чтобы двигаться по календарю. Игра остановится, когда потребуется ваше решение или наступит день матча.`;
}

export function takeOverClub(clubId: number, first = false) {
  const club = G.clubs[clubId];
  G.user = clubId;
  G.sacked = false;
  G.mgr.club = clubId;
  G.mgr.joined = G.day;
  G.mgr.wage = managerStartWage(club);
  const { y, m } = ymd(G.day);
  G.mgr.cEnd = dayOf(y + R.int(2, 3) + (m >= 7 ? 1 : 0), 6, 30);
  G.mgr.history.push({ club: clubId, from: G.day, p: 0, w: 0, d: 0, l: 0, trophies: [] });
  G.board = defaultBoard();
  G.board.confM = 60 + Math.round((G.mgr.rep - club.rep) / 4);
  G.board.conf = G.board.confM;
  club.mgr = `${G.mgr.fn} ${G.mgr.ln}`;
  club.sel = emptySelection();
  ensureClubStaff(club);
  setSeasonBudgets(club);
  setObjectives();
  G.flags.vacancies = [];
  if (!first) addMsg({ from: 'Совет директоров', subj: `Добро пожаловать в «${club.name}»`, kind: 'welcome', body: `Совет директоров «${club.name}» рад приветствовать нового главного тренера. Контракт до ${fmtDate(G.mgr.cEnd)}, зарплата ${fmtMoney(G.mgr.wage)} в неделю.` });
}

// ---------- daily processing ----------
export function userFixtureToday(): Fixture | null {
  if (G.user < 0) return null;
  const ids = IDX.clubFx.get(G.user) || [];
  for (const id of ids) {
    const f = G.fixtures[id];
    if (f && f.day === G.day && !f.played) return f;
  }
  return null;
}

export function nextUserFixture(): Fixture | null {
  if (G.user < 0) return null;
  let best: Fixture | null = null;
  for (const id of IDX.clubFx.get(G.user) || []) {
    const f = G.fixtures[id];
    if (f && !f.played && (!best || f.day < best.day)) best = f;
  }
  return best;
}

export function processDay() {
  const D = G.day;
  const ids = (G.fxByDay[D] || []).slice();
  const touched = new Set<string>();
  for (const id of ids) {
    const f = G.fixtures[id];
    if (!f) continue;
    if (!f.played) {
      if (G.user >= 0 && (f.home === G.user || f.away === G.user)) continue;
      const res = quickSim(f);
      applyResult(f, res);
    }
    touched.add(f.comp);
  }
  for (const cid of touched) progressComp(G.comps[cid]);
  dailyRecovery();
  dailyTransfers();
  dailyScouting();
  checkEuroTimers();
  G.day++;
  morningEvents();
}

export function progressComp(comp: Comp | undefined) {
  if (!comp) return;
  const wasDone = comp.done;
  if (comp.kind === 'league') checkLeague(comp);
  else if (comp.kind === 'euro') checkEuro(comp);
  else checkKnockout(comp);
  if (comp.kind === 'po' && comp.done && !wasDone) tryRelegationPO(comp.country!, comp.season);
  if (comp.done && !wasDone) onCompDone(comp);
}

function onCompDone(comp: Comp) {
  const w = comp.winner;
  if (w == null) return;
  const wc = G.clubs[w];
  if (comp.kind === 'league') {
    addNews(`«${wc.name}» — победитель турнира «${comp.name}» сезона ${seasonLabel(comp)}`, 'champion');
  } else if (comp.kind === 'cup') {
    (G.flags.cupWin ||= {})[`${comp.country}:${comp.def}`] = { season: comp.season, winner: w, runner: comp.runnerUp };
    income(wc, 'prize', Math.round((wc.fin.tvYear + wc.fin.comYear) * 0.03));
    wc.rep = clamp(wc.rep + 1, 1, 100);
    addNews(`«${wc.name}» выиграл ${comp.name}!`, 'cup');
  } else if (comp.kind === 'euro') {
    (G.honours[comp.def] ||= []).push({ season: comp.season, winner: w, runner: comp.runnerUp });
    addNews(`«${wc.name}» — победитель турнира «${comp.name}» ${comp.season}/${(comp.season + 1) % 100}!`, 'euro');
    wc.rep = clamp(wc.rep + (comp.def === 'UCL' ? 3 : 2), 1, 100);
  } else if (comp.kind === 'super') {
    (G.honours[`${comp.country}:super`] ||= []).push({ season: comp.season, winner: w, runner: comp.runnerUp });
    addNews(`«${wc.name}» завоевал ${comp.name}`, 'cup');
  }
  if (w === G.user && comp.kind !== 'po') {
    const name = comp.kind === 'league' ? comp.name : comp.name;
    G.mgr.trophies.push({ name, season: comp.season, club: w });
    const h = G.mgr.history[G.mgr.history.length - 1];
    if (h) h.trophies.push(name);
    G.mgr.rep = clamp(G.mgr.rep + (comp.kind === 'euro' ? 8 : comp.kind === 'league' ? 5 : 2), 1, 100);
    addMsg({ from: 'Совет директоров', subj: `Трофей: ${name}!`, kind: 'trophy', important: true, body: `Поздравляем! «${wc.name}» под вашим руководством выиграл турнир «${name}». Это историческое достижение для клуба!` });
  }
}

export function seasonLabel(comp: Comp) {
  if (comp.country && CY(comp.country)) return `${comp.season}`;
  return `${comp.season}/${String((comp.season + 1) % 100).padStart(2, '0')}`;
}

// ---------- calendar events ----------
export function morningEvents() {
  const D = G.day;
  const { y, m, d } = ymd(D);
  const md = m * 100 + d;
  if (d === 1) {
    monthlyFinances();
    monthlyDevelopment();
    monthlyBoard();
    playingTimeComplaints();
    sackAiManagers();
    if (G.user < 0 && G.mgr) generateVacancies();
    checkInsolvency();
  }
  if (weekday(D) === 0) {
    weeklyMorale();
    contractReminders();
    if (G.user >= 0) {
      const uc = G.clubs[G.user];
      const f = uc.tactic.formation;
      uc.famil[f] = Math.min(100, (uc.famil[f] ?? 40) + (G.training.focus === 3 ? 6 : 3.5));
      for (const k in uc.famil) if (k !== f) uc.famil[k] = Math.max(20, uc.famil[k] - 0.5);
    }
  }
  if (G.user >= 0) windowMessages();
  if (md === 201) for (const a of ASSOCS) if (a.cal === 'CY') startCountrySeason(a.code, y);
  if (md === 315) youthIntake();
  if (md === 610) for (const a of ASSOCS) if (a.cal === 'AS') endCountrySeason(a.code, y - 1);
  if (md === 614) {
    if (G.comps[`E:UCL:${y - 1}`]) {
      for (const c of euroCompsOfSeason(y - 1)) {
        if (c.winner != null) {
          if (c.def === 'UCL') G.euroHolders.UCL = c.winner;
          if (c.def === 'UEL') G.euroHolders.UEL = c.winner;
          if (c.def === 'UECL') G.euroHolders.UECL = c.winner;
        }
      }
      rolloverCoefficients();
    }
  }
  if (md === 615) createEuroSeason(y);
  if (md === 630 && G.day > G.startDay) {
    contractExpiry();
    retirements();
  }
  if (md === 701) newEuropeanSeason(y);
  if (md === 1210) for (const a of ASSOCS) if (a.cal === 'CY') endCountrySeason(a.code, y);
}

function windowMessages() {
  const c = G.clubs[G.user];
  const open = windowOpen(c.country), was = windowOpen(c.country, G.day - 1);
  if (open && !was) addMsg({ from: 'Спортивный директор', subj: 'Трансферное окно открыто', kind: 'window', body: 'Трансферное окно открылось. Теперь можно регистрировать новых игроков.' });
  if (!open && was) addMsg({ from: 'Спортивный директор', subj: 'Трансферное окно закрыто', kind: 'window', important: true, body: 'Трансферное окно закрылось. До следующего окна можно подписывать только свободных агентов.' });
}

function checkInsolvency() {
  for (const c of G.clubs) {
    if (c.fin.balance < -(c.fin.tvYear + c.fin.comYear) * 0.6 && c.id !== G.user) {
      // emergency: owner injection
      c.fin.balance = Math.round((c.fin.tvYear + c.fin.comYear) * 0.1);
    }
  }
}

function newEuropeanSeason(y: number) {
  G.season = y;
  // archive season stats
  for (const p of G.players) {
    if (!p) continue;
    if (p.st.apps + p.st.sub > 0) {
      p.hist.push({ s: y - 1, club: p.club, apps: p.st.apps + p.st.sub, gls: p.st.gls, ast: p.st.ast, rat: p.st.ratN ? Math.round((p.st.rat / p.st.ratN) * 100) / 100 : 0, ...(p.loan ? { loan: 1 as const } : {}) });
      if (p.hist.length > 20) p.hist.shift();
    }
    p.st = emptyStats();
    p.yc = [0, 0, 0];
    p.ban = [0, 0, Math.min(p.ban[2], 1)];
    p.unhappy = undefined;
  }
  for (const a of ASSOCS) if (a.cal === 'AS') startCountrySeason(a.code, y);
  // budgets for all clubs
  for (const c of G.clubs) {
    setSeasonBudgets(c);
    if (c.id !== G.user) {
      assignSquadStatus(c);
      trimSquad(c);
    }
  }
  // cleanup old fixtures (keep user's)
  cleanupFixtures(y);
  if (G.user >= 0) {
    setObjectives();
    G.flags.renewOffered = false;
  }
  ensureFreeStaff();
}

function trimSquad(c: typeof G.clubs[number]) {
  if (c.players.length <= 30) return;
  const ps = c.players.map(P).filter(Boolean).sort((a, b) => a.ca - b.ca);
  const extra = ps.slice(0, c.players.length - 28);
  for (const p of extra) {
    if (p.loan) continue;
    c.players = c.players.filter((x) => x !== p.id);
    p.club = -1;
  }
}

function cleanupFixtures(y: number) {
  const keep = new Set<number>();
  for (const k in G.fixtures) {
    const f = G.fixtures[k];
    if (!f.played) keep.add(f.id);
    else if (f.home === G.user || f.away === G.user) keep.add(f.id);
    else if (f.day >= G.day - 120) keep.add(f.id);
  }
  for (const k in G.fixtures) {
    const f = G.fixtures[k];
    if (!keep.has(f.id)) {
      delete G.fixtures[k];
    }
  }
  const fb: Record<number, number[]> = {};
  for (const k in G.fixtures) {
    const f = G.fixtures[k];
    (fb[f.day] ||= []).push(f.id);
  }
  G.fxByDay = fb;
  // drop finished comps older than a season
  for (const id in G.comps) {
    const c = G.comps[id];
    if (c.done && c.season < y - 1) delete G.comps[id];
  }
  rebuildIndexes();
  void y;
}

// ---------- country seasons ----------
export function startCountrySeason(code: string, label: number) {
  const a = ASSOC[code];
  const ct = G.countries[code];
  const frame = frameFor(code, label);
  for (const ld of a.leagues) {
    const clubs = G.clubs.filter((c) => c.league === ld.id).map((c) => c.id);
    if (clubs.length < 4) continue;
    createLeague(ld, label, clubs, frame);
    ct.seasons[ld.id] = label;
  }
  createCup(code, a.cup, label, frame, 'cup');
  if (a.lcup) createCup(code, a.lcup, label, frame, 'lcup');
  if (a.sup) {
    const lf = ct.lastFinal;
    const top = lf?.table?.[0] || [];
    const cw = lf?.cupWinner;
    const teams: number[] = [];
    if (top[0] != null) teams.push(top[0]);
    if (a.sup === 4) {
      if (top[1] != null) teams.push(top[1]);
      if (cw != null && !teams.includes(cw)) teams.push(cw);
      const cr = lf as any;
      if (cr?.cupRunner != null && !teams.includes(cr.cupRunner)) teams.push(cr.cupRunner);
      for (const t of top) if (teams.length < 4 && !teams.includes(t)) teams.push(t);
      createSuperCup(code, label, teams, dayOf(label + (a.cal === 'AS' ? 1 : 0), 1, 8), true);
    } else {
      if (cw != null && cw !== top[0]) teams.push(cw);
      else if (top[1] != null) teams.push(top[1]);
      const day = Math.max(G.day + 1, frame.start - 7);
      createSuperCup(code, label, teams, day, false);
    }
  }
  ct.curSeason = label;
}

export function endCountrySeason(code: string, label: number) {
  const a = ASSOC[code];
  const ct = G.countries[code];
  const comps = Object.values(G.comps).filter((c) => c.country === code && c.season === label);
  if (!comps.some((c) => c.kind === 'league')) return;
  // finish any pending fixtures
  for (let guard = 0; guard < 8; guard++) {
    const pending = Object.values(G.fixtures).filter((f) => !f.played && G.comps[f.comp]?.country === code && G.comps[f.comp]?.season === label);
    if (!pending.length) break;
    for (const f of pending) {
      const res = quickSim(f);
      applyResult(f, res);
    }
    for (const c of comps) progressComp(c);
    tryRelegationPO(code, label);
    for (const c of Object.values(G.comps).filter((c) => c.country === code && c.season === label && c.kind === 'po')) progressComp(c);
  }
  const orders: number[][] = [];
  for (const ld of a.leagues) {
    const lc = G.comps[`L:${ld.id}:${label}`];
    orders.push(lc ? (lc.meta.final || standings(lc)) : []);
  }
  // promotion / relegation
  const moves = new Map<number, string | null>();
  for (let t = 0; t < a.leagues.length; t++) {
    const ld = a.leagues[t];
    const order = orders[t];
    if (!order.length) continue;
    const lower = a.leagues[t + 1];
    const lowerOrder = orders[t + 1] || [];
    if (lower && lowerOrder.length) {
      const relegated = order.slice(order.length - ld.down);
      const promoted = lowerOrder.slice(0, lower.up);
      const po = G.comps[`PO:${lower.id}:${label}:up`];
      if (lower.upPO && po?.winner != null) promoted.push(po.winner);
      const rpo = G.comps[`PO:${ld.id}:${label}:rel`];
      if (rpo?.ties) {
        for (const tie of rpo.ties) {
          if (tie.winner == null) continue;
          // tie.a = lower team, tie.b = upper team
          if (tie.winner === tie.a) { relegated.push(tie.b); promoted.push(tie.a); }
        }
      }
      if (relegated.length === promoted.length) {
        for (const c of relegated) moves.set(c, lower.id);
        for (const c of promoted) moves.set(c, ld.id);
      }
    } else if (!lower && ld.down > 0) {
      // lowest tier: swap with pool
      const relegated = order.slice(order.length - ld.down);
      const pool = ct.pool.slice().sort((x, y) => G.clubs[y].rep + R.range(0, 8) - G.clubs[x].rep);
      const up = pool.slice(0, relegated.length);
      if (up.length === relegated.length) {
        for (const c of relegated) moves.set(c, null);
        for (const c of up) moves.set(c, ld.id);
      }
    }
  }
  // record honours
  a.leagues.forEach((ld, t) => {
    const order = orders[t];
    if (!order.length) return;
    (G.honours[ld.id] ||= []).push({ season: label, winner: order[0], runner: order[1] });
  });
  const cw = G.flags.cupWin?.[`${code}:cup`];
  if (cw && cw.season === label) (G.honours[`${code}:cup`] ||= []).push({ season: label, winner: cw.winner, runner: cw.runner });
  const lcw = G.flags.cupWin?.[`${code}:lcup`];
  if (lcw && lcw.season === label) (G.honours[`${code}:lcup`] ||= []).push({ season: label, winner: lcw.winner, runner: lcw.runner });
  // league prize / merit money & reputation
  a.leagues.forEach((ld, t) => {
    const order = orders[t];
    order.forEach((cid, i) => {
      const c = G.clubs[cid];
      const merit = Math.round(c.fin.tvYear * 0.12 * (order.length - i) / order.length);
      income(c, 'prize', merit);
      if (i === 0) c.rep = clamp(c.rep + 2, 1, 100);
    });
  });
  // apply moves
  for (const [cid, lid] of moves) {
    const c = G.clubs[cid];
    const oldTier = c.league ? LEAGUE_DEF[c.league].tier : 6;
    const newTier = lid ? LEAGUE_DEF[lid].tier : 6;
    c.league = lid;
    if (lid === null) { if (!ct.pool.includes(cid)) ct.pool.push(cid); }
    else ct.pool = ct.pool.filter((x) => x !== cid);
    c.rep = clamp(c.rep + (newTier < oldTier ? 3 : -3), 1, 100);
    const f = Math.pow(tierFactor(newTier) / tierFactor(oldTier), 0.7);
    c.fin.tvYear = Math.round(c.fin.tvYear * f);
    c.fin.comYear = Math.round(c.fin.comYear * Math.pow(f, 0.5));
    c.wageScale = wageScaleFor(code, newTier, c.rep);
    if (newTier < oldTier) addNews(`«${c.name}» повышается в классе: ${lid ? LEAGUE_DEF[lid].name : ''}`, 'promo');
    else addNews(`«${c.name}» покидает ${LEAGUE_DEF[a.leagues[oldTier - 1].id].name}`, 'releg');
  }
  ct.lastFinal = { season: label, table: orders, cupWinner: cw?.season === label ? cw.winner : ct.lastFinal?.cupWinner, cupRunner: cw?.season === label ? cw.runner : undefined };
  // user review
  if (G.user >= 0 && G.clubs[G.user].country === code) {
    const uc = G.clubs[G.user];
    let pos = 0, tierIdx = -1;
    orders.forEach((o, t) => { const i = o.indexOf(uc.id); if (i >= 0) { pos = i + 1; tierIdx = t; } });
    if (pos > 0) {
      const mv = moves.get(uc.id);
      const relegated = mv !== undefined && (mv === null || LEAGUE_DEF[mv].tier > tierIdx + 1);
      const promoted = mv !== undefined && mv !== null && LEAGUE_DEF[mv].tier < tierIdx + 1;
      seasonReview(pos, relegated, promoted, pos === 1);
    }
  }
}

// ---------- continue ----------
export type StopReason = { stop: 'match'; fx: Fixture } | { stop: 'inbox' } | { stop: 'none' } | { stop: 'sacked' };

/** advance one day (or stop). Returns stop reason or 'none' if a day passed */
export function continueStep(): StopReason {
  if (pendingDecisions().length) return { stop: 'inbox' };
  if (G.sacked && G.user < 0 && !G.flags.unemployedOk) return { stop: 'sacked' };
  const uf = userFixtureToday();
  if (uf) { G.pendingMatch = uf.id; return { stop: 'match', fx: uf }; }
  const before = G.inbox.length ? G.inbox[0].id : 0;
  processDay();
  const fresh = G.inbox.filter((m) => m.id > before && (m.important || m.needs));
  if (fresh.length) return { stop: 'inbox' };
  return { stop: 'none' };
}

export function daysUntilNextUserMatch(): number {
  const f = nextUserFixture();
  return f ? f.day - G.day : 999;
}

export { emptySelection, computePR, updateValue, fullName, EURO_NAMES, countryGen, plural, assignShirts };
