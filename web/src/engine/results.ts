// Apply a simulated result to the world (tables, stats, players, finances, coefficients).
import type { Fixture, Player } from './types';
import { G, R, P } from './state';
import { EV, type SimResult } from './quicksim';
import { applyToTable } from './comps';
import { compTypeOf } from './tactics';
import { addEuroPoints } from './coef';
import { matchdayIncome, income, PRIZE } from './finance';
import { A, H } from './attrs';
import { clamp, fmtDate } from './util';
import { boardAfterMatch } from './board';
import { addMsg } from './inbox';
import { fullName } from './player';

export function applyResult(f: Fixture, res: SimResult) {
  f.hg = res.hg;
  f.ag = res.ag;
  f.played = true;
  if (res.et) f.et = 1;
  if (res.ph != null) { f.ph = res.ph; f.pa = res.pa; }
  f.ev = res.events;
  f.stats = res.stats;
  f.potm = res.potm;
  const comp = G.comps[f.comp];
  const ct = compTypeOf(f.comp);
  const isUser = f.home === G.user || f.away === G.user;
  if (isUser || G.clubs[f.home].rep > 70 || G.clubs[f.away].rep > 70 || comp?.kind !== 'league') {
    f.rh = []; f.ra = [];
    res.ratings[0].forEach((r, id) => f.rh!.push(id, Math.round(r * 10)));
    res.ratings[1].forEach((r, id) => f.ra!.push(id, Math.round(r * 10)));
  }
  // attendance
  const hc = G.clubs[f.home], ac = G.clubs[f.away];
  const importance = comp?.kind === 'euro' ? 0.2 : comp?.kind === 'cup' ? 0.05 : 0;
  const occ = clamp(0.5 + hc.rep / 250 + ac.rep / 500 + importance + R.gauss(0, 0.05), 0.25, 1);
  f.att = Math.round(hc.cap * 1000 * occ);
  if (!f.neutral) matchdayIncome(f.home, f.att);
  // tables
  if (comp) {
    if (comp.kind === 'league' && comp.table) applyToTable(comp.table, f);
    if (comp.kind === 'euro') {
      if (comp.lp && f.grp === -1) {
        applyToTable(comp.lp.table, f);
        comp.meta.lpLeft = Math.max(0, (comp.meta.lpLeft || 1) - 1);
      }
      const q = !comp.lp || f.grp !== -1 ? (comp.meta.phase === 'Q' ? 0.5 : 1) : 1;
      const pz = (PRIZE as any)[comp.def];
      const hp = f.hg > f.ag ? 2 : f.hg === f.ag ? 1 : 0, ap = f.ag > f.hg ? 2 : f.hg === f.ag ? 1 : 0;
      addEuroPoints(f.home, hp * q);
      addEuroPoints(f.away, ap * q);
      if (comp.meta.phase !== 'Q') {
        if (hp === 2) income(hc, 'prize', pz.win); else if (hp === 1) income(hc, 'prize', pz.draw);
        if (ap === 2) income(ac, 'prize', pz.win); else if (ap === 1) income(ac, 'prize', pz.draw);
      }
    }
  }
  // ban decrement for players who missed this match
  for (const cid of [f.home, f.away]) {
    for (const pid of G.clubs[cid].players) {
      const p = G.players[pid];
      if (p && p.ban[ct] > 0 && !res.minutes[0].has(pid) && !res.minutes[1].has(pid)) p.ban[ct]--;
    }
  }
  // players
  const yellowsThis = new Map<number, number>();
  for (let s = 0; s < 2; s++) {
    const gf = s === 0 ? f.hg : f.ag, ga = s === 0 ? f.ag : f.hg;
    const startersSet = new Set<number>();
    res.minutes[s].forEach((min, pid) => {
      const p = P(pid);
      if (!p) return;
      const isSub = res.events.some((_, i) => i % 4 === 0 && res.events[i + 1] === EV.SUB && res.events[i + 2] === pid);
      if (!isSub) startersSet.add(pid);
      if (isSub) p.st.sub++; else p.st.apps++;
      p.st.min += min;
      const r = res.ratings[s].get(pid) ?? 6.5;
      p.st.rat += r;
      p.st.ratN++;
      p.form.push(Math.round(r * 10) / 10);
      if (p.form.length > 5) p.form.shift();
      p.lastGame = G.day;
      if (ga === 0 && min >= 60 && (p.pos[0] >= 15)) p.st.cs++;
      // condition / sharpness
      const sta = p.a[A.STA], nat = p.a[A.NAT];
      const drop = (min / 90) * (20 + (20 - sta) * 0.75 + (20 - nat) * 0.25 + (G.clubs[s === 0 ? f.home : f.away].tactic.ti.press * 2.5));
      p.cond = clamp(p.cond - drop, 25, 100);
      p.sharp = clamp(p.sharp + min / 9, 0, 100);
      // morale
      const res3 = gf > ga ? 1 : gf === ga ? 0 : -1;
      p.morale = clamp(p.morale + res3 * 3 + (r - 6.6) * 2, 5, 100);
      const sc = comp?.scorers;
      if (sc) { const row = (sc[pid] ||= [0, 0, 0]); row[2]++; }
    });
  }
  for (let i = 0; i < res.events.length; i += 4) {
    const t = res.events[i + 1], pid = res.events[i + 2], s = res.events[i + 3];
    const p = P(pid);
    if (!p) continue;
    const sc = comp?.scorers;
    if (t === EV.GOAL || t === EV.PEN) { p.st.gls++; if (sc) (sc[pid] ||= [0, 0, 0])[0]++; }
    else if (t === EV.AST) { p.st.ast++; if (sc) (sc[pid] ||= [0, 0, 0])[1]++; }
    else if (t === EV.YEL) {
      p.st.yc++;
      yellowsThis.set(pid, (yellowsThis.get(pid) || 0) + 1);
      p.yc[ct]++;
      const limit = ct === 0 ? 5 : 3;
      if (p.yc[ct] % limit === 0) {
        p.ban[ct] += 1;
        if (p.club === G.user) addMsg({ from: 'Ассистент', subj: `${fullName(p)} пропустит следующий матч`, kind: 'ban', body: `${fullName(p)} получил ${p.yc[ct]}-ю жёлтую карточку и пропустит следующий матч турнира.` });
      }
    } else if (t === EV.RED) {
      p.st.rc++;
      const second = (yellowsThis.get(pid) || 0) >= 1;
      const games = second ? 1 : R.chance(0.7) ? 3 : 2;
      p.ban[ct] += games;
      p.morale = clamp(p.morale - 8, 5, 100);
      if (p.club === G.user) addMsg({ from: 'Ассистент', subj: `${fullName(p)} дисквалифицирован`, kind: 'ban', body: `${fullName(p)} удалён с поля и пропустит ${games} ${games === 1 ? 'матч' : 'матча'}.` });
    }
    void s;
  }
  for (const inj of res.injuries) {
    const p = P(inj.pid);
    if (!p) continue;
    const physio = G.clubs[p.club]?.facT ?? 10;
    const days = Math.max(2, Math.round(inj.days * (1.15 - physio / 60) * (0.85 + p.hid[H.INJP] / 60)));
    p.inj = { name: inj.name, until: G.day + days };
    p.cond = Math.min(p.cond, 60);
    if (p.club === G.user) addMsg({ from: 'Медицинский штаб', subj: `Травма: ${fullName(p)}`, kind: 'injury', important: days > 20, body: `${fullName(p)} получил травму «${inj.name}» в матче против «${G.clubs[p.club === f.home ? f.away : f.home].name}». Ориентировочный срок восстановления: ${days} дн. (до ${fmtDate(G.day + days)}).` });
  }
  if (res.potm) { const p = P(res.potm); if (p) p.st.potm++; }
  if (isUser && G.user >= 0) boardAfterMatch(f);
}

/** daily recovery for all players */
export function dailyRecovery() {
  const d = G.day;
  const intensity = G.training.intensity;
  for (const p of G.players) {
    if (!p) continue;
    if (p.cond < 100) {
      let rec = 8 + p.a[A.NAT] * 0.32;
      if (p.club === G.user) rec *= intensity === 0 ? 1.15 : intensity === 2 ? 0.88 : 1;
      p.cond = Math.min(100, p.cond + rec);
    }
    if (p.lastGame != null && d - p.lastGame > 7 && p.sharp > 30) p.sharp -= 0.6;
    if (p.inj && p.inj.until <= d) {
      p.inj = undefined;
      p.cond = Math.min(p.cond, 85);
      if (p.club === G.user) addMsg({ from: 'Медицинский штаб', subj: `${fullName(p)} восстановился`, kind: 'injury', body: `${fullName(p)} полностью восстановился после травмы и готов играть.` });
    }
  }
}

export function avgRating(p: Player) {
  return p.st.ratN ? p.st.rat / p.st.ratN : 0;
}
