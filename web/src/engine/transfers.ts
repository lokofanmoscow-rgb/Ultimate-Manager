// Transfers, loans, contracts and AI market activity.
import type { Bid, Club, ContractTerms, Player } from './types';
import { G, R, P } from './state';
import { age, askingPrice, fullName, updateValue, posGroup } from './player';
import { expectedWage, roundWage, A, H } from './attrs';
import { addMsg, addNews } from './inbox';
import { clamp, dayOf, fmtMoney, ymd, fmtDate, plural } from './util';
import { income, expense, wageBill } from './finance';
import { assignShirts, assignSquadStatus } from './world';
import { emptySelection } from './tactics';

// ---------- windows ----------
export function windowOpen(country: string, day = G.day): boolean {
  const { y, m, d } = ymd(day);
  void y;
  const md = m * 100 + d;
  if (country === 'RUS') return (md >= 615 && md <= 910) || (md >= 125 && md <= 222);
  const cy = ['NOR', 'SWE', 'FIN', 'ISL', 'IRL', 'LTU', 'LVA', 'EST', 'BLR', 'KAZ', 'FRO', 'GEO'].includes(country);
  if (cy) return (md >= 101 && md <= 331) || (md >= 701 && md <= 831);
  return (md >= 610 && md <= 901) || (md >= 101 && md <= 202);
}

export function nextWindowDay(country: string): number {
  let d = G.day;
  for (let i = 0; i < 370; i++, d++) if (windowOpen(country, d)) return d;
  return G.day;
}

// ---------- contracts ----------
export function demandWage(p: Player, club: Club): number {
  const base = expectedWage(p.ca, age(p), club.wageScale);
  const cur = p.wage;
  const amb = p.hid[H.AMB] / 20;
  let w = Math.max(base, cur * (1.05 + amb * 0.15));
  if (p.club >= 0 && G.clubs[p.club].rep > club.rep + 5) w *= 1.25;
  return roundWage(w);
}

export function interestedInMove(p: Player, buyer: Club): { ok: boolean; reason?: string } {
  if (p.club < 0) return { ok: true };
  const cur = G.clubs[p.club];
  const diff = buyer.rep - cur.rep;
  if (p.real && p.ca > 165 && diff < -5) return { ok: false, reason: 'Игрок не заинтересован в переходе в клуб такого уровня.' };
  if (diff < -18 && p.hid[H.AMB] > 10) return { ok: false, reason: 'Игрок считает, что ваш клуб недостаточно амбициозен для него.' };
  if (diff < -28) return { ok: false, reason: 'Игрок не рассматривает переход в клуб более низкого уровня.' };
  return { ok: true };
}

export interface Negotiation {
  bidId: number;
  pid: number;
  demand: ContractTerms;
  patience: number;
  rounds: number;
  agentFee: number;
  renewal?: boolean;
}

export function startNegotiation(pid: number, bidId: number, renewal = false): Negotiation | { error: string } {
  const p = P(pid);
  const club = G.clubs[G.user];
  if (!renewal) {
    const int = interestedInMove(p, club);
    if (!int.ok) return { error: int.reason! };
  } else if (p.wantsOut && p.hid[H.LOY] < 12) return { error: `${fullName(p)} не хочет продлевать контракт с клубом.` };
  const a = age(p);
  const years = a >= 32 ? 1 : a >= 29 ? 2 : a <= 21 ? 5 : 4;
  const wage = demandWage(p, club) * (renewal ? 0.95 + (p.status <= 1 ? 0.1 : 0) : 1);
  const bid = G.bids.find((b) => b.id === bidId);
  const agentFee = bid && bid.kind === 'free' ? Math.round(wage * 12) : Math.round((bid?.fee || 0) * 0.04 + wage * 3);
  return {
    bidId, pid, renewal, rounds: 0, patience: 3 + Math.round(p.hid[H.ADAP] / 8),
    demand: { wage: roundWage(wage), years, bonus: Math.round(wage * (bid?.kind === 'free' ? 20 : 6) / 1000) * 1000, status: Math.min(p.status, a <= 20 ? 3 : 2), agent: agentFee },
    agentFee,
  };
}

/** player's response to offered terms */
export function respondTerms(n: Negotiation, offer: ContractTerms): { result: 'accept' | 'counter' | 'break'; text: string } {
  const p = P(n.pid);
  n.rounds++;
  const statusFactor = [0.88, 0.95, 1, 1.07, 1.12][offer.status] ?? 1;
  const yearsPref = n.demand.years;
  const yearsFactor = 1 + Math.abs(offer.years - yearsPref) * 0.025;
  const need = n.demand.wage * statusFactor * yearsFactor - offer.bonus / 52 / Math.max(1, offer.years) * 0.5;
  const ratio = offer.wage / need;
  if (offer.status > n.demand.status + 1 && p.ca > 120) {
    n.patience--;
    if (n.patience <= 0) return { result: 'break', text: `Агент ${fullName(p)} прервал переговоры: игрок не согласен на такую роль в команде.` };
    return { result: 'counter', text: 'Игрок рассчитывает на более значимую роль в команде.' };
  }
  if (ratio >= 0.97) return { result: 'accept', text: `${fullName(p)} согласен на предложенные условия!` };
  n.patience--;
  if (n.patience <= 0 || ratio < 0.6) return { result: 'break', text: `Агент ${fullName(p)} прервал переговоры: предложение слишком далеко от ожиданий.` };
  // counter: meet halfway slightly
  n.demand.wage = roundWage(Math.max(offer.wage * 1.04, n.demand.wage * 0.96));
  return { result: 'counter', text: `Агент требует зарплату не ниже ${fmtMoney(n.demand.wage)} в неделю.` };
}

export function finalizeContract(n: Negotiation, terms: ContractTerms): string {
  const p = P(n.pid);
  const club = G.clubs[G.user];
  const { y } = ymd(G.day);
  if (n.renewal) {
    p.wage = terms.wage;
    p.cEnd = dayOf(y + terms.years + (ymd(G.day).m >= 7 ? 1 : 0), 6, 30);
    p.status = terms.status;
    p.rc = terms.rc;
    expense(club, 'bonus', terms.bonus + (terms.agent || 0));
    p.morale = clamp(p.morale + 10, 0, 100);
    p.wantsOut = undefined;
    updateValue(p);
    return `${fullName(p)} подписал новый контракт до ${fmtDate(p.cEnd)}.`;
  }
  const bid = G.bids.find((b) => b.id === n.bidId)!;
  bid.terms = terms;
  bid.status = 'contract';
  const country = club.country;
  if (windowOpen(country) || bid.kind === 'free') {
    completeBid(bid);
    return `Трансфер завершён: ${fullName(p)} присоединился к клубу!`;
  }
  bid.completeDay = nextWindowDay(country);
  return `Соглашение достигнуто. Переход ${fullName(p)} будет оформлен при открытии трансферного окна (${fmtDate(bid.completeDay)}).`;
}

// ---------- bids ----------
export function makeBid(o: { player: number; kind: Bid['kind']; fee: number; sellOn?: number; instal?: number; loanWage?: number; loanUntil?: number; loanFee?: number; buyOpt?: number }): Bid | string {
  const p = P(o.player);
  const club = G.clubs[G.user];
  if (p.club === G.user) return 'Это ваш игрок.';
  const cost = o.kind === 'loan' ? o.loanFee || 0 : o.instal && o.instal > 1 ? o.fee / o.instal : o.fee;
  if (cost > club.fin.tBudget) return `Недостаточно средств в трансферном бюджете (${fmtMoney(club.fin.tBudget)}).`;
  const existing = G.bids.find((b) => b.player === o.player && b.buyer === G.user && ['pending', 'accepted', 'countered'].includes(b.status));
  if (existing) existing.status = 'cancelled';
  const bid: Bid = {
    id: G.nid.bid++, player: o.player, buyer: G.user, seller: p.club, kind: p.club < 0 ? 'free' : o.kind, fee: o.fee, sellOn: o.sellOn, instal: o.instal,
    loanWage: o.loanWage, loanUntil: o.loanUntil, loanFee: o.loanFee, buyOpt: o.buyOpt,
    status: 'pending', respond: G.day + (p.club < 0 ? 0 : R.int(1, 2)), rounds: (existing?.rounds || 0) + 1, user: 'buy',
  };
  G.bids.push(bid);
  return bid;
}

function evaluateUserBid(b: Bid) {
  const p = G.players[b.player];
  if (!p || p.club !== b.seller) { b.status = 'collapsed'; return; }
  const seller = G.clubs[b.seller];
  const buyer = G.clubs[b.buyer];
  const ask = askingPrice(p);
  const name = fullName(p);
  if (b.kind === 'loan') {
    const ok = p.status >= 2 && (b.loanWage || 0) >= (age(p) <= 21 ? 40 : 70) && buyer.rep >= seller.rep - 35;
    if (ok) {
      b.status = 'accepted';
      addMsg({ from: seller.name, subj: `Аренда ${name}: предложение принято`, kind: 'transfer', important: true, needs: true, data: { type: 'bidAccepted', bid: b.id },
        body: `«${seller.name}» согласен отдать ${name} в аренду на предложенных условиях. Теперь необходимо согласовать личные условия с игроком.` });
    } else {
      b.status = 'rejected';
      addMsg({ from: seller.name, subj: `Аренда ${name}: отказ`, kind: 'transfer', body: p.status < 2 ? `«${seller.name}» не намерен расставаться с ключевым игроком.` : `«${seller.name}» отклонил предложение: требуется более высокая доля оплаты зарплаты (не менее ${age(p) <= 21 ? 40 : 70}%).` });
    }
    return;
  }
  const rcHit = p.rc && b.fee >= p.rc;
  const untouchable = p.status === 0 && seller.rep >= 75 && b.fee < ask * 1.4 && !rcHit;
  if (rcHit || (!untouchable && b.fee >= ask * (b.instal && b.instal > 1 ? 1.08 : 1))) {
    b.status = 'accepted';
    addMsg({ from: seller.name, subj: `Трансфер ${name}: предложение принято`, kind: 'transfer', important: true, needs: true, data: { type: 'bidAccepted', bid: b.id },
      body: `${rcHit ? 'Сумма отступных в контракте выплачена. ' : ''}«${seller.name}» принял предложение ${fmtMoney(b.fee)} за ${name}. Теперь нужно договориться с игроком о личных условиях.` });
  } else if (!untouchable && b.fee >= ask * 0.7 && b.rounds < 4) {
    b.status = 'countered';
    b.counter = Math.round(Math.max(ask, (ask + b.fee) / 2 + ask * 0.05 * (3 - b.rounds)) / 50000) * 50000;
    addMsg({ from: seller.name, subj: `Трансфер ${name}: встречное предложение`, kind: 'transfer', important: true, needs: true, data: { type: 'bidCounter', bid: b.id },
      body: `«${seller.name}» отклонил предложение ${fmtMoney(b.fee)}, но готов продать ${name} за ${fmtMoney(b.counter)}.` });
  } else {
    b.status = 'rejected';
    addMsg({ from: seller.name, subj: `Трансфер ${name}: отказ`, kind: 'transfer',
      body: untouchable ? `«${seller.name}» заявил, что ${name} не продаётся.` : `«${seller.name}» отклонил предложение ${fmtMoney(b.fee)} за ${name} как недостаточное.` });
  }
}

export function acceptCounter(bidId: number): Bid | string {
  const b = G.bids.find((x) => x.id === bidId);
  if (!b || b.status !== 'countered') return 'Предложение недействительно.';
  return makeBid({ player: b.player, kind: b.kind, fee: b.counter!, sellOn: b.sellOn, instal: b.instal });
}

export function completeBid(b: Bid) {
  const p = G.players[b.player];
  if (!p) { b.status = 'collapsed'; return; }
  const buyer = G.clubs[b.buyer];
  const seller = b.seller >= 0 ? G.clubs[b.seller] : null;
  const terms = b.terms;
  const { y, m } = ymd(G.day);
  if (b.kind === 'loan') {
    if (seller) seller.players = seller.players.filter((x) => x !== p.id);
    buyer.players.push(p.id);
    p.loan = { from: b.seller, until: b.loanUntil || dayOf(m >= 7 ? y + 1 : y, 6, 30), wagePct: b.loanWage ?? 100, buy: b.buyOpt };
    p.club = buyer.id;
    if (b.loanFee) { expense(buyer, 'transfer', b.loanFee); buyer.fin.tBudget -= b.loanFee; if (seller) income(seller, 'transfer', b.loanFee); }
  } else {
    if (seller) {
      seller.players = seller.players.filter((x) => x !== p.id);
      const instal = b.instal && b.instal > 1 ? b.instal : 1;
      const first = Math.round(b.fee / instal);
      income(seller, 'transfer', first);
      expense(buyer, 'transfer', first);
      buyer.fin.tBudget -= first;
      if (instal > 1) {
        (G.flags.instalments ||= []).push({ from: buyer.id, to: seller.id, amount: first, left: instal - 1, next: G.day + 365 });
      }
      if (seller.id !== G.user) seller.fin.tBudget += Math.round(first * 0.5);
    }
    if (p.loan) {
      const parent = G.clubs[p.loan.from];
      parent.players = parent.players.filter((x) => x !== p.id);
      p.loan = undefined;
    }
    buyer.players.push(p.id);
    p.club = buyer.id;
    if (terms) {
      p.wage = terms.wage;
      p.cEnd = dayOf(y + terms.years + (m >= 7 ? 1 : 0), 6, 30);
      p.status = terms.status;
      p.rc = terms.rc;
      expense(buyer, 'bonus', terms.bonus + (terms.agent || 0));
    } else {
      p.wage = roundWage(Math.max(p.wage, expectedWage(p.ca, age(p), buyer.wageScale)));
      p.cEnd = dayOf(y + R.int(2, 5) + (m >= 7 ? 1 : 0), 6, 30);
    }
  }
  p.joined = G.day;
  p.listed = undefined;
  p.wantsOut = undefined;
  p.unhappy = undefined;
  p.shirt = 0;
  p.morale = clamp(p.morale + 8, 0, 100);
  b.status = 'done';
  assignShirts(buyer);
  if (buyer.id !== G.user) assignSquadStatus(buyer);
  if (seller && seller.id === G.user) cleanSelection(seller);
  updateValue(p);
  G.transfers.unshift({ day: G.day, player: p.id, from: b.seller, to: b.buyer, fee: b.kind === 'loan' ? -1 : b.fee, loan: b.kind === 'loan', name: fullName(p) });
  if (G.transfers.length > 600) G.transfers.length = 600;
  const feeText = b.kind === 'loan' ? 'аренда' : b.kind === 'free' || !b.fee ? 'свободный агент' : fmtMoney(b.fee);
  if (buyer.id === G.user || seller?.id === G.user) {
    addMsg({ from: 'Спортивный директор', subj: `${b.kind === 'loan' ? 'Аренда' : 'Трансфер'}: ${fullName(p)}`, kind: 'transfer', important: true,
      body: `${fullName(p)} ${buyer.id === G.user ? `переходит в ваш клуб из «${seller ? seller.name : 'свободных агентов'}»` : `покидает клуб и переходит в «${buyer.name}»`} (${feeText}).` });
  }
  if (b.fee >= 15_000_000 || (p.rep > 70 && b.kind !== 'loan')) addNews(`${fullName(p)}: ${seller ? seller.name : 'свободный агент'} → ${buyer.name} (${feeText})`, 'transfer');
}

export function cleanSelection(c: Club) {
  if (!c.sel) return;
  c.sel.lineup = c.sel.lineup.map((id) => (id && c.players.includes(id) ? id : 0));
  c.sel.subs = c.sel.subs.filter((id) => c.players.includes(id));
  if (c.sel.lineup.some((x) => !x)) c.sel.auto = true;
}

// ---------- AI bids for user players ----------
function aiBidForUserPlayers() {
  if (G.user < 0) return;
  const uc = G.clubs[G.user];
  if (!windowOpen(uc.country)) return;
  if (!R.chance(0.05) || G.day - G.startDay < 10) return;
  const cands = uc.players.map(P).filter((p) => p && !p.loan && (p.listed === 1 || p.ca > 110 || R.chance(0.1)));
  if (!cands.length) return;
  const p = R.pick(cands);
  const buyers = G.clubs.filter((c) => c.id !== uc.id && c.league && windowOpen(c.country) && (p.listed === 2 ? c.rep < uc.rep && c.rep >= uc.rep - 30 : c.rep >= uc.rep - 10 && c.rep <= uc.rep + 25 && c.fin.tBudget > p.value * 0.8));
  if (!buyers.length) return;
  const buyer = R.pick(buyers);
  if (G.bids.some((b) => b.player === p.id && b.buyer === buyer.id && ['pending', 'accepted', 'countered'].includes(b.status))) return;
  if (p.listed === 2) {
    const lw = R.int(5, 10) * 10;
    const bid: Bid = { id: G.nid.bid++, player: p.id, buyer: buyer.id, seller: uc.id, kind: 'loan', fee: 0, loanWage: lw, loanUntil: loanEndDefault(), status: 'pending', respond: G.day + 5, rounds: 1, user: 'sell' };
    G.bids.push(bid);
    addMsg({ from: buyer.name, subj: `Аренда ${fullName(p)}`, kind: 'offer', important: true, needs: true, data: { type: 'offer', bid: bid.id },
      body: `«${buyer.name}» хочет взять ${fullName(p)} в аренду до ${fmtDate(bid.loanUntil!)} и готов оплачивать ${lw}% его зарплаты.` });
    return;
  }
  const fee = Math.round(p.value * R.range(0.75, p.listed === 1 ? 1.15 : 1.3) / 50000) * 50000;
  if (fee <= 0) return;
  const bid: Bid = { id: G.nid.bid++, player: p.id, buyer: buyer.id, seller: uc.id, kind: 'transfer', fee, status: 'pending', respond: G.day + 5, rounds: 1, user: 'sell' };
  G.bids.push(bid);
  addMsg({ from: buyer.name, subj: `Предложение по ${fullName(p)}`, kind: 'offer', important: true, needs: true, data: { type: 'offer', bid: bid.id },
    body: `«${buyer.name}» предлагает ${fmtMoney(fee)} за ${fullName(p)}.\n\nРыночная стоимость игрока: ${fmtMoney(p.value)}. Контракт до ${fmtDate(p.cEnd)}.` });
}

export function respondToOffer(bidId: number, action: 'accept' | 'reject' | 'counter', ask?: number): string {
  const b = G.bids.find((x) => x.id === bidId);
  if (!b || b.status !== 'pending') return 'Предложение уже недействительно.';
  const p = P(b.player);
  const buyer = G.clubs[b.buyer];
  if (action === 'reject') { b.status = 'rejected'; return `Предложение «${buyer.name}» отклонено.`; }
  if (b.kind === 'loan') {
    if (action !== 'accept') { b.status = 'rejected'; return 'Предложение об аренде отклонено.'; }
    if (windowOpen(G.clubs[b.buyer].country)) { completeBid(b); return `${fullName(p)} отправлен в аренду в «${buyer.name}».`; }
    b.status = 'contract';
    b.completeDay = nextWindowDay(G.clubs[b.buyer].country);
    return `Аренда согласована, оформление ${fmtDate(b.completeDay)}.`;
  }
  if (action === 'counter') {
    const max = p.value * R.range(1.15, 1.5);
    if (ask! <= max && buyer.fin.tBudget >= ask! * 0.8) {
      b.fee = ask!;
      action = 'accept';
    } else {
      b.status = 'rejected';
      return `«${buyer.name}» не готов платить ${fmtMoney(ask!)} и прекратил переговоры.`;
    }
  }
  // player decides
  const willing = buyer.rep >= G.clubs[b.seller].rep - 8 || p.wantsOut || R.chance(0.35);
  if (!willing) { b.status = 'collapsed'; return `${fullName(p)} отказался от перехода в «${buyer.name}».`; }
  if (windowOpen(G.clubs[b.buyer].country)) { completeBid(b); return `${fullName(p)} продан в «${buyer.name}» за ${fmtMoney(b.fee)}.`; }
  b.status = 'contract';
  b.completeDay = nextWindowDay(G.clubs[b.buyer].country);
  return `Сделка согласована. ${fullName(p)} перейдёт в «${buyer.name}» ${fmtDate(b.completeDay)}.`;
}

// ---------- AI market ----------
function squadNeeds(c: Club): ('G' | 'D' | 'M' | 'F')[] {
  const counts: Record<string, number> = { G: 0, D: 0, M: 0, F: 0 };
  for (const id of c.players) {
    const p = G.players[id];
    if (p) counts[posGroup(p)]++;
  }
  const needs: ('G' | 'D' | 'M' | 'F')[] = [];
  if (counts.G < 3) needs.push('G');
  if (counts.D < 8) needs.push('D');
  if (counts.M < 8) needs.push('M');
  if (counts.F < 4) needs.push('F');
  if (!needs.length) needs.push(R.pick(['D', 'M', 'F'] as const));
  return needs;
}

let groupIdx: Record<string, number[]> | null = null;
let groupIdxDay = -1;
function buildGroupIdx() {
  if (groupIdxDay === G.day && groupIdx) return groupIdx;
  const idx: Record<string, number[]> = { G: [], D: [], M: [], F: [] };
  for (const p of G.players) {
    if (!p || p.loan || p.club === G.user) continue;
    idx[posGroup(p)].push(p.id);
  }
  groupIdx = idx;
  groupIdxDay = G.day;
  return idx;
}

function aiTransferAttempt(c: Club) {
  if (c.id === G.user || !c.league) return;
  const need = R.pick(squadNeeds(c));
  const ps = c.players.map((id) => G.players[id]!).filter(Boolean).sort((a, b) => b.ca - a.ca);
  const ref = ps[Math.min(10, ps.length - 1)]?.ca ?? 80;
  const top = ps[0]?.ca ?? 100;
  const budget = c.fin.tBudget;
  const wb = c.fin.wBudget - wageBill(c);
  if (c.players.length >= 30) return;
  // sample candidates
  let best: Player | null = null, bestScore = 0;
  const pool = buildGroupIdx()[need];
  for (let k = 0; k < 140; k++) {
    const p = G.players[pool[R.int(0, pool.length - 1)]];
    if (!p || p.club === c.id || p.loan || p.retired) continue;
    if (p.ca < ref - 3 || p.ca > top + 14) continue;
    const a = age(p);
    if (a > 31 || a < 18) continue;
    const sellerRep = p.club >= 0 ? G.clubs[p.club].rep : 0;
    if (p.club >= 0 && sellerRep > c.rep + 14) continue;
    if (p.club === G.user) continue;
    const price = p.club < 0 ? 0 : askingPrice(p);
    if (price > budget) continue;
    const wage = expectedWage(p.ca, a, c.wageScale);
    if (wage > wb + 500 && c.players.length > 22) continue;
    const score = (p.ca - ref) + (p.pa - p.ca) * 0.2 - price / Math.max(1e6, budget) * 5 + R.range(0, 3);
    if (score > bestScore) { best = p; bestScore = score; }
  }
  if (!best) return;
  const fee = best.club < 0 ? 0 : askingPrice(best);
  if (best.club >= 0) {
    const seller = G.clubs[best.club];
    if (!interestedInMove(best, c).ok) return;
    // seller needs replacement capacity
    if (seller.players.length <= 18) return;
    void seller;
  }
  const bid: Bid = { id: G.nid.bid++, player: best.id, buyer: c.id, seller: best.club, kind: best.club < 0 ? 'free' : 'transfer', fee, status: 'accepted', respond: G.day, rounds: 1, user: 'none' };
  completeBid(bid);
  c.fin.tBudget = Math.max(0, c.fin.tBudget - 0);
}

function aiFreeAgentSignings() {
  // clubs with thin squads sign free agents
  const free = G.players.filter((p) => p && p.club < 0) as Player[];
  if (!free.length) return;
  for (const c of G.clubs) {
    if (c.id === G.user || !c.league || c.players.length >= 20) continue;
    if (!R.chance(0.3)) continue;
    const ref = starterRef(c);
    const cands = free.filter((p) => p.club < 0 && p.ca >= ref - 25 && p.ca <= ref + 10 && age(p) <= 33);
    if (!cands.length) continue;
    const p = R.pick(cands);
    const bid: Bid = { id: G.nid.bid++, player: p.id, buyer: c.id, seller: -1, kind: 'free', fee: 0, status: 'accepted', respond: G.day, rounds: 1, user: 'none' };
    completeBid(bid);
  }
}

function starterRef(c: Club) {
  const ps = c.players.map((id) => G.players[id]!).filter(Boolean).sort((a, b) => b.ca - a.ca);
  return ps[Math.min(10, ps.length - 1)]?.ca ?? 70;
}

function aiLoans() {
  if (!R.chance(0.3)) return;
  const c = R.pick(G.clubs.filter((x) => x.rep >= 65 && x.id !== G.user));
  if (!c) return;
  const young = c.players.map(P).filter((p) => p && !p.loan && age(p) <= 21 && p.status >= 3 && p.ca >= 70);
  if (!young.length) return;
  const p = R.pick(young);
  const dest = G.clubs.filter((x) => x.league && x.id !== G.user && x.rep < c.rep - 10 && x.rep > c.rep - 40 && starterRef(x) <= p.ca + 5 && x.players.length < 28);
  if (!dest.length) return;
  const d = R.pick(dest);
  const { y, m } = ymd(G.day);
  const bid: Bid = { id: G.nid.bid++, player: p.id, buyer: d.id, seller: c.id, kind: 'loan', fee: 0, loanWage: R.int(50, 100), loanUntil: dayOf(m >= 7 ? y + 1 : y, 6, 30), status: 'accepted', respond: G.day, rounds: 1, user: 'none' };
  completeBid(bid);
}

/** daily transfer-market processing */
export function dailyTransfers() {
  // user bids responses
  for (const b of G.bids) {
    if (b.user === 'buy' && b.status === 'pending' && b.respond <= G.day) {
      if (b.kind === 'free' || b.seller < 0) {
        b.status = 'accepted';
        addMsg({ from: 'Агент игрока', subj: `Свободный агент: ${fullName(P(b.player))}`, kind: 'transfer', needs: true, important: true, data: { type: 'bidAccepted', bid: b.id }, body: `Агент ${fullName(P(b.player))} готов обсудить личные условия контракта.` });
      } else evaluateUserBid(b);
    }
    if (b.status === 'contract' && b.completeDay && b.completeDay <= G.day) completeBid(b);
    if (b.user === 'sell' && b.status === 'pending' && b.respond < G.day - 7) b.status = 'cancelled';
  }
  if (G.bids.length > 200) G.bids = G.bids.filter((b) => ['pending', 'accepted', 'countered', 'contract'].includes(b.status) || b.id > G.nid.bid - 100);
  // AI market in windows
  const anyOpen = windowOpen('ENG') || windowOpen('RUS') || windowOpen('NOR');
  if (anyOpen) {
    const n = Math.round(G.clubs.length * 0.02);
    for (let i = 0; i < n; i++) {
      const c = G.clubs[R.int(0, G.clubs.length - 1)];
      if (windowOpen(c.country)) aiTransferAttempt(c);
    }
    if (R.chance(0.25)) aiFreeAgentSignings();
    aiLoans();
    aiBidForUserPlayers();
  }
  // installments
  const inst = G.flags.instalments as any[] | undefined;
  if (inst && inst.length) {
    for (const it of inst) {
      if (it.left > 0 && it.next <= G.day) {
        expense(G.clubs[it.from], 'transfer', it.amount);
        income(G.clubs[it.to], 'transfer', it.amount);
        it.left--;
        it.next += 365;
      }
    }
    G.flags.instalments = inst.filter((x) => x.left > 0);
  }
}

/** June 30: contracts expire, loans end */
export function contractExpiry() {
  for (const p of G.players) {
    if (!p) continue;
    if (p.loan && p.loan.until <= G.day + 1) endLoan(p);
  }
  for (const p of G.players) {
    if (!p || p.club < 0) continue;
    if (p.cEnd > G.day + 1) continue;
    const c = G.clubs[p.club];
    if (c.id !== G.user) {
      const ref = starterRef(c);
      const a = age(p);
      if (p.ca >= ref - 12 && a <= 32 && R.chance(0.75)) {
        p.cEnd = dayOf(ymd(G.day).y + R.int(1, 3), 6, 30);
        p.wage = roundWage(p.wage * R.range(1.0, 1.25));
        continue;
      }
    }
    releasePlayer(p, false);
  }
}

export function endLoan(p: Player) {
  const loan = p.loan!;
  const cur = G.clubs[p.club];
  cur.players = cur.players.filter((x) => x !== p.id);
  if (cur.id === G.user) cleanSelection(cur);
  const parent = G.clubs[loan.from];
  p.club = parent.id;
  p.loan = undefined;
  if (!parent.players.includes(p.id)) parent.players.push(p.id);
  p.shirt = 0;
  assignShirts(parent);
  if (parent.id === G.user) addMsg({ from: 'Спортивный директор', subj: `${fullName(p)} вернулся из аренды`, kind: 'transfer', body: `${fullName(p)} вернулся из аренды в «${cur.name}». Сыграно матчей: ${p.st.apps + p.st.sub}, голов: ${p.st.gls}.` });
}

export function releasePlayer(p: Player, byUser: boolean) {
  const c = G.clubs[p.club];
  if (byUser) {
    const left = Math.max(0, (p.cEnd - G.day) / 7);
    expense(c, 'wages', Math.round(p.wage * left * 0.6));
  }
  c.players = c.players.filter((x) => x !== p.id);
  if (c.id === G.user) {
    cleanSelection(c);
    if (!byUser) addMsg({ from: 'Спортивный директор', subj: `${fullName(p)} покинул клуб`, kind: 'transfer', body: `Контракт ${fullName(p)} истёк, игрок покинул клуб на правах свободного агента.` });
  }
  p.club = -1;
  p.listed = undefined;
  p.status = 2;
  p.joined = G.day;
  p.wage = roundWage(p.wage * 0.8);
}

/** expiring contract reminders for user */
export function contractReminders() {
  if (G.user < 0) return;
  const c = G.clubs[G.user];
  for (const id of c.players) {
    const p = P(id);
    if (!p || p.loan) continue;
    const left = p.cEnd - G.day;
    if (left > 0 && left <= 180 && !G.flags[`rem${p.id}_${p.cEnd}`]) {
      G.flags[`rem${p.id}_${p.cEnd}`] = 1;
      addMsg({ from: 'Спортивный директор', subj: `Истекает контракт: ${fullName(p)}`, kind: 'contract', data: { type: 'expiring', pid: p.id },
        body: `Контракт ${fullName(p)} истекает ${fmtDate(p.cEnd)}. Если вы хотите сохранить игрока, предложите ему новый контракт (Профиль игрока → «Продлить контракт»).` });
    }
  }
}

export function sackAiManagers() {
  // occasional AI manager changes create vacancies
  for (const c of G.clubs) {
    if (c.id === G.user || !c.league) continue;
    if (R.chance(0.004)) c.mgr = `${R.pick(['А.', 'Б.', 'В.', 'Г.', 'Д.', 'Е.', 'Ж.', 'З.', 'И.', 'К.', 'Л.', 'М.'])} ${R.pick(['Новак', 'Мюллер', 'Росси', 'Лопес', 'Петров', 'Смирнов', 'Коваль', 'Дюбуа', 'Йенсен', 'Ферро'])}`;
  }
}

export function listPlayer(p: Player, kind: 0 | 1 | 2) {
  p.listed = kind || undefined;
}

export function squadSizeOK(c: Club) {
  return c.players.length;
}

export function loanEndDefault(): number {
  const { y, m } = ymd(G.day);
  return dayOf(m >= 7 ? y + 1 : y, 6, 30);
}

export { plural, emptySelection, A };
