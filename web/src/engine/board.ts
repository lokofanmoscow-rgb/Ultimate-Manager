// Board of directors: objectives, confidence, ultimatums, sacking, contract.
import type { Board, Club, Fixture } from './types';
import { G, R } from './state';
import { addMsg, addNews } from './inbox';
import { clamp, fmtMoney, dayOf, ymd, plural } from './util';
import { LEAGUE_DEF, ASSOC } from '../data/nations';
import { standings } from './comps';
import { expectedWage, roundWage } from './attrs';

export function defaultBoard(): Board {
  return { conf: 60, confM: 60, confF: 60, exp: { league: 10, leagueText: '', cup: '', euro: '', finance: 'Не уходить в минус' }, history: [], meetings: 0 };
}

function leagueComp(club: Club) {
  if (!club.league) return null;
  const ct = G.countries[club.country];
  const label = ASSOC[club.country].cal === 'AS' ? G.season : ymd(G.day).y;
  return G.comps[`L:${club.league}:${label}`] || G.comps[`L:${club.league}:${ct.curSeason}`] || null;
}
export { leagueComp };

/** expected league position from reputation ranking */
export function expectedPosition(club: Club): number {
  const lc = leagueComp(club);
  const ids = lc ? lc.clubs : G.clubs.filter((c) => c.league === club.league).map((c) => c.id);
  const sorted = ids.slice().sort((a, b) => G.clubs[b].rep - G.clubs[a].rep);
  return sorted.indexOf(club.id) + 1;
}

export function setObjectives() {
  if (G.user < 0) return;
  const club = G.clubs[G.user];
  const ld = club.league ? LEAGUE_DEF[club.league] : null;
  const n = ld ? ld.size : 20;
  const pos = expectedPosition(club);
  let target: number, text: string;
  const promoSpots = ld ? ld.up + (ld.upPO ? 1 : 0) : 0;
  if (pos === 1) { target = 1; text = ld?.tier === 1 ? 'Выиграть чемпионат' : 'Выиграть лигу и выйти в высший дивизион'; }
  else if (pos <= 3) { target = Math.max(2, pos); text = ld?.tier === 1 ? `Бороться за чемпионство (место не ниже ${target}-го)` : `Выход в дивизион выше (не ниже ${Math.max(promoSpots, 2)}-го места)`; if (ld?.tier !== 1) target = Math.max(promoSpots, 2); }
  else if (pos <= Math.ceil(n * 0.3)) { target = pos + 1; text = ld?.tier === 1 ? `Попасть в еврокубковую зону (не ниже ${target}-го места)` : `Попасть в зону плей-офф (не ниже ${target}-го места)`; }
  else if (pos <= Math.ceil(n * 0.6)) { target = pos + 2; text = `Финишировать в середине таблицы (не ниже ${target}-го места)`; }
  else { target = n - (ld?.down ?? 2) - (ld?.rpo ? 1 : 0); text = `Избежать вылета (не ниже ${target}-го места)`; }
  const cupText = club.rep >= 70 ? 'Дойти до полуфинала кубка' : club.rep >= 50 ? 'Дойти до 1/4 финала кубка' : 'Выступить достойно в кубке';
  const inEuro = ['UCL', 'UEL', 'UECL'].find((e) => G.comps[`E:${e}:${G.season}`]?.clubs.includes(club.id));
  const euroText = inEuro ? (inEuro === 'UCL' && club.rep >= 85 ? 'Выйти в 1/4 финала Лиги чемпионов' : 'Выйти из общего этапа еврокубка') : '';
  G.board.exp = { league: target, leagueText: text, cup: cupText, euro: euroText, finance: 'Не допускать отрицательного баланса' };
  G.board.ultimatum = undefined;
  G.board.warned = false;
  addMsg({
    from: 'Совет директоров', subj: 'Задачи на сезон', kind: 'board', important: true,
    body: `Совет директоров определил задачи на сезон:\n\n• Чемпионат: ${text}\n• Кубок: ${cupText}${euroText ? `\n• Еврокубки: ${euroText}` : ''}\n• Финансы: не допускать отрицательного баланса\n\nТрансферный бюджет: ${fmtMoney(club.fin.tBudget)}\nЗарплатный бюджет: ${fmtMoney(club.fin.wBudget)} в неделю`,
  });
}

function expPts(club: Club, opp: Club, home: boolean): number {
  const x = (club.rep - opp.rep + (home ? 4 : -4)) / 14;
  const t = Math.tanh(x);
  const pw = clamp(0.42 + 0.38 * t, 0.05, 0.9);
  const pd = clamp(0.27 - 0.08 * Math.abs(t), 0.08, 0.3);
  return 3 * pw + pd;
}

export function boardAfterMatch(f: Fixture) {
  if (G.user < 0 || G.sacked) return;
  const club = G.clubs[G.user];
  const isHome = f.home === club.id;
  const opp = G.clubs[isHome ? f.away : f.home];
  const gf = isHome ? f.hg : f.ag, ga = isHome ? f.ag : f.hg;
  const pts = gf > ga ? 3 : gf === ga ? 1 : 0;
  const comp = G.comps[f.comp];
  const e = expPts(club, opp, isHome && !f.neutral);
  let k = comp?.kind === 'league' ? 2.2 : comp?.kind === 'euro' ? 1.4 : 1.2;
  if (comp?.kind === 'super') k = 0.5;
  let d = (pts - e) * k;
  // knockout elimination
  if ((comp?.kind === 'cup' || comp?.kind === 'euro') && f.tie != null && f.played) {
    const tie = comp.ties?.find((t) => t.id === f.tie);
    if (tie && tie.fx[tie.fx.length - 1] === f.id) {
      const won = (f.ph != null ? (isHome ? f.ph > f.pa! : f.pa! > f.ph) : null);
      void won;
    }
  }
  G.board.confM = clamp(G.board.confM + d, 0, 100);
  recalcConf();
  G.mgr.record.p++;
  if (pts === 3) G.mgr.record.w++; else if (pts === 1) G.mgr.record.d++; else G.mgr.record.l++;
  const h = G.mgr.history[G.mgr.history.length - 1];
  if (h) { h.p++; if (pts === 3) h.w++; else if (pts === 1) h.d++; else h.l++; }
  // ultimatum tracking (league matches only)
  const u = G.board.ultimatum;
  if (u && comp?.kind === 'league') {
    u.played++;
    u.got += pts;
    if (u.got >= u.pts) {
      G.board.ultimatum = undefined;
      G.board.confM = Math.max(G.board.confM, 48);
      recalcConf();
      addMsg({ from: 'Совет директоров', subj: 'Требование выполнено', kind: 'board', important: true, body: `Совет директоров доволен тем, как команда отреагировала на критику: набрано ${u.got} ${plural(u.got, 'очко', 'очка', 'очков')} в ${u.played} ${plural(u.played, 'матче', 'матчах', 'матчах')}. Продолжайте в том же духе.` });
    } else if (u.played >= u.matches) {
      sackManager(`Команда набрала лишь ${u.got} ${plural(u.got, 'очко', 'очка', 'очков')} из необходимых ${u.pts} за ${u.matches} ${plural(u.matches, 'матч', 'матча', 'матчей')}.`);
      return;
    }
  }
  if (G.board.conf < 9 && !G.board.ultimatum) {
    sackManager('Совет директоров потерял доверие к главному тренеру из-за неудовлетворительных результатов.');
    return;
  }
  if (G.board.conf < 27 && !G.board.ultimatum && comp?.kind === 'league') issueUltimatum();
  else if (G.board.conf < 38 && !G.board.warned) {
    G.board.warned = true;
    addMsg({ from: 'Совет директоров', subj: 'Встреча с советом директоров', kind: 'board', important: true, needs: true, body: 'Совет директоров обеспокоен последними результатами команды. Нам нужно увидеть улучшения в ближайших матчах. Мы рассчитываем, что вы исправите ситуацию.', data: { type: 'warning' } });
  }
}

export function recalcConf() {
  G.board.conf = Math.round(clamp(G.board.confM * 0.8 + G.board.confF * 0.2, 0, 100));
}

function issueUltimatum() {
  const club = G.clubs[G.user];
  const lc = leagueComp(club);
  if (!lc) return;
  const remaining = Object.values(G.fixtures).filter((f) => f.comp === lc.id && !f.played && (f.home === club.id || f.away === club.id)).length;
  const n = Math.min(5, remaining);
  if (n < 2) return;
  const pos = expectedPosition(club);
  const rate = pos <= 3 ? 2.0 : pos <= 8 ? 1.6 : 1.2;
  const need = Math.max(n, Math.round(n * rate));
  G.board.ultimatum = { from: G.day, matches: n, pts: need, played: 0, got: 0, fxStart: 0 };
  addMsg({
    from: 'Совет директоров', subj: 'Ультиматум совета директоров', kind: 'board', important: true, needs: true, data: { type: 'ultimatum' },
    body: `Совет директоров крайне недоволен результатами команды. Мы приняли решение: в ближайших ${n} ${plural(n, 'матче', 'матчах', 'матчах')} чемпионата команда должна набрать не менее ${need} ${plural(need, 'очка', 'очков', 'очков')}. В противном случае мы будем вынуждены расторгнуть с вами контракт.`,
  });
}

export function sackManager(reason: string) {
  const club = G.clubs[G.user];
  addMsg({ from: 'Совет директоров', subj: 'Вы уволены', kind: 'sacked', important: true, needs: true, body: `${reason}\n\nСовет директоров клуба «${club.name}» принял решение освободить вас от должности главного тренера. Благодарим за проделанную работу.\n\nВы можете искать новую работу в разделе «Вакансии».` });
  addNews(`«${club.name}» уволил главного тренера ${G.mgr.fn} ${G.mgr.ln}`, 'sack');
  const h = G.mgr.history[G.mgr.history.length - 1];
  if (h) h.to = G.day;
  G.mgr.rep = clamp(G.mgr.rep - 6, 1, 100);
  G.mgr.club = -1;
  G.sacked = true;
  club.mgr = 'Исполняющий обязанности';
  G.user = -1;
  G.flags.lastClub = club.id;
  generateVacancies(true);
}

export function monthlyBoard() {
  if (G.user < 0) return;
  const club = G.clubs[G.user];
  // finances component
  const bal = club.fin.balance;
  if (bal < 0) G.board.confF = clamp(G.board.confF - 6, 0, 100);
  else G.board.confF = clamp(G.board.confF + 2, 0, 100);
  // league position vs expectation
  const lc = leagueComp(club);
  if (lc && lc.table && !lc.done) {
    const played = lc.table[club.id]?.p ?? 0;
    if (played >= 6) {
      const pos = standings(lc).indexOf(club.id) + 1;
      const target = G.board.exp.league;
      const d = clamp((target - pos) * 0.9, -6, 5);
      G.board.confM = clamp(G.board.confM + d, 0, 100);
    }
  }
  recalcConf();
  // contract expiring soon -> renewal talk
  if (G.mgr.cEnd - G.day < 200 && G.mgr.cEnd - G.day > 150 && G.board.conf >= 55 && !G.flags.renewOffered) offerContract();
}

export function offerContract() {
  const club = G.clubs[G.user];
  G.flags.renewOffered = true;
  const wage = roundWage(G.mgr.wage * R.range(1.05, 1.3));
  const years = R.int(2, 3);
  addMsg({
    from: 'Совет директоров', subj: 'Предложение нового контракта', kind: 'contract', important: true, needs: true,
    data: { type: 'mgrContract', wage, years },
    body: `Совет директоров доволен вашей работой и предлагает продлить контракт:\n\n• Зарплата: ${fmtMoney(wage)} в неделю\n• Срок: ${years} ${plural(years, 'год', 'года', 'лет')}\n\nПринять предложение?`,
  });
  void club;
}

export function acceptContract(wage: number, years: number) {
  G.mgr.wage = wage;
  const { y } = ymd(G.day);
  G.mgr.cEnd = dayOf(y + years, 6, 30);
  G.board.confM = clamp(G.board.confM + 3, 0, 100);
  recalcConf();
  G.flags.renewOffered = false;
}

/** end of season evaluation for user club */
export function seasonReview(finalPos: number, relegated: boolean, promoted: boolean, champion: boolean) {
  if (G.user < 0) return;
  const target = G.board.exp.league;
  let text: string;
  if (champion || promoted) {
    G.board.confM = clamp(G.board.confM + 22, 0, 100);
    G.mgr.rep = clamp(G.mgr.rep + (champion ? 6 : 4), 1, 100);
    text = champion ? 'Совет директоров в восторге: команда стала чемпионом!' : 'Совет директоров доволен: команда добилась повышения в классе!';
  } else if (finalPos <= target) {
    G.board.confM = clamp(G.board.confM + 10, 0, 100);
    G.mgr.rep = clamp(G.mgr.rep + 2, 1, 100);
    text = `Задача на сезон выполнена (${finalPos}-е место при задаче не ниже ${target}-го).`;
  } else if (finalPos <= target + 3 && !relegated) {
    G.board.confM = clamp(G.board.confM - 8, 0, 100);
    text = `Задача на сезон не выполнена (${finalPos}-е место при задаче не ниже ${target}-го). Совет ожидает большего в новом сезоне.`;
  } else {
    sackManager(relegated ? 'Команда покинула дивизион.' : `Команда заняла лишь ${finalPos}-е место при задаче не ниже ${target}-го.`);
    return;
  }
  recalcConf();
  addMsg({ from: 'Совет директоров', subj: 'Итоги сезона', kind: 'board', important: true, body: `${text}\n\nТекущее доверие совета: ${G.board.conf}%.` });
  maybeJobOffer();
  if (G.mgr.cEnd - G.day < 400 && G.board.conf >= 50) offerContract();
  else if (G.mgr.cEnd - G.day < 30) {
    // contract runs out and board doesn't extend
    if (G.board.conf < 50) sackManager('Совет директоров не стал продлевать истекающий контракт.');
  }
}

export function maybeJobOffer() {
  if (G.user < 0 || !R.chance(0.35)) return;
  const uc = G.clubs[G.user];
  const cands = G.clubs.filter((c) => c.league && c.id !== G.user && c.rep > uc.rep + 2 && c.rep <= G.mgr.rep + 18 && c.rep <= uc.rep + 20);
  if (!cands.length) return;
  const c = R.pick(cands);
  addMsg({ from: c.name, subj: `Предложение работы от «${c.name}»`, kind: 'job', important: true, needs: true, data: { type: 'jobOffer', club: c.id },
    body: `Руководство «${c.name}» впечатлено вашей работой и предлагает вам возглавить команду. Зарплата будет выше текущей. Хотите принять предложение?` });
}

export function checkManagerContract() {
  if (G.user < 0 || G.day < G.mgr.cEnd) return;
  if (G.board.conf >= 55) {
    acceptContract(G.mgr.wage, 1);
    addMsg({ from: 'Совет директоров', subj: 'Контракт продлён на год', kind: 'contract', important: true, body: 'Срок вашего контракта истёк, и совет директоров автоматически продлил его ещё на один год на прежних условиях.' });
  } else {
    sackManager('Срок вашего контракта истёк, и совет директоров решил не продлевать его.');
  }
}

export interface Vacancy { club: number; until: number }

export function generateVacancies(force = false) {
  const cur: Vacancy[] = (G.flags.vacancies || []).filter((v: Vacancy) => v.until > G.day && G.clubs[v.club].id !== G.user);
  if (cur.length < 12 || force) {
    const rep = G.mgr.rep;
    const cands = G.clubs.filter((c) => c.league && Math.abs(c.rep - rep) < 22 && c.id !== G.user && !cur.some((v) => v.club === c.id));
    R.shuffle(cands);
    for (const c of cands.slice(0, 14 - cur.length)) cur.push({ club: c.id, until: G.day + R.int(20, 60) });
  }
  G.flags.vacancies = cur;
}

export function applyForJob(clubId: number): boolean {
  const c = G.clubs[clubId];
  const p = clamp(0.5 + (G.mgr.rep - c.rep + 6) / 18, 0.05, 0.95);
  return R.chance(p);
}

export function managerStartWage(club: Club) {
  return roundWage(expectedWage(138, 40, club.wageScale) * (0.6 + G.mgr.rep / 120));
}

export function boardRequest(kind: 'transfer' | 'wage' | 'train' | 'youth' | 'contract'): string {
  const club = G.clubs[G.user];
  if (G.board.lastReq && G.day - G.board.lastReq < 30) return 'Совет директоров недавно рассматривал ваши запросы. Повторите позже.';
  G.board.lastReq = G.day;
  G.board.meetings++;
  const conf = G.board.conf;
  const rich = club.fin.balance > (club.fin.tvYear + club.fin.comYear) * 0.15;
  if (kind === 'transfer') {
    if (conf >= 55 && rich) {
      const add = Math.round((club.fin.balance * 0.15) / 100000) * 100000;
      club.fin.tBudget += add;
      return `Совет директоров согласился увеличить трансферный бюджет на ${fmtMoney(add)}.`;
    }
    G.board.confM = clamp(G.board.confM - 1, 0, 100);
    recalcConf();
    return 'Совет директоров отклонил запрос: финансовое положение клуба не позволяет увеличить бюджет.';
  }
  if (kind === 'wage') {
    if (conf >= 55 && rich) {
      const add = Math.round(club.fin.wBudget * 0.08);
      club.fin.wBudget += add;
      return `Совет директоров увеличил зарплатный бюджет на ${fmtMoney(add)} в неделю.`;
    }
    return 'Совет директоров не готов увеличивать зарплатный бюджет.';
  }
  if (kind === 'train' || kind === 'youth') {
    const cur = kind === 'train' ? club.facT : club.facY;
    if (cur >= 20) return 'Инфраструктура уже на максимальном уровне.';
    const cost = Math.round((club.fin.tvYear + club.fin.comYear) * 0.06 * (1 + cur / 10));
    if (conf >= 60 && club.fin.balance > cost * 1.5) {
      club.fin.balance -= cost;
      if (kind === 'train') club.facT++; else club.facY++;
      return `Совет директоров одобрил улучшение ${kind === 'train' ? 'тренировочной базы' : 'академии'} (стоимость ${fmtMoney(cost)}). Работы завершены.`;
    }
    return `Совет директоров отклонил запрос: стоимость улучшения (${fmtMoney(cost)}) слишком высока на данный момент.`;
  }
  if (kind === 'contract') {
    if (conf >= 65) { G.flags.renewOffered = false; offerContract(); return 'Совет директоров готов обсудить новый контракт — проверьте входящие.'; }
    return 'Совет директоров считает, что говорить о новом контракте пока рано.';
  }
  return '';
}

export function confText(c: number): string {
  if (c >= 85) return 'Восторг';
  if (c >= 70) return 'Очень доволен';
  if (c >= 55) return 'Доволен';
  if (c >= 40) return 'Удовлетворён';
  if (c >= 25) return 'Недоволен';
  return 'Крайне недоволен';
}
