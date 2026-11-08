// Fast statistical match simulation for non-user matches + shared result application.
import type { Club, Fixture, Player, Selection } from './types';
import { G, R, P } from './state';
import { autoPick, teamRatings, compTypeOf, FORMATIONS } from './tactics';
import { A, H } from './attrs';
import { clamp } from './util';
import { tieAggBefore, isDecider } from './comps';
import { injuryName } from './player';

export interface SimResult {
  hg: number;
  ag: number;
  et?: boolean;
  ph?: number;
  pa?: number;
  events: number[]; // [minute, type, pid, side]
  ratings: [Map<number, number>, Map<number, number>];
  minutes: [Map<number, number>, Map<number, number>];
  stats: number[];
  potm?: number;
  injuries: { pid: number; name: string; days: number }[];
}

export function selectionFor(club: Club, f: Fixture): Selection {
  const ct = compTypeOf(f.comp);
  if (club.id === G.user && club.sel && !club.sel.auto) {
    // validate user selection (injured/banned players removed)
    const sel = club.sel;
    const ok = sel.lineup.every((id) => id && G.players[id] && G.players[id]!.club === club.id && !(G.players[id]!.inj && G.players[id]!.inj!.until > G.day) && G.players[id]!.ban[ct] === 0);
    if (ok) return sel;
  }
  const rotate = !(G.comps[f.comp]?.kind === 'euro' || G.comps[f.comp]?.kind === 'cup' && (f.stage.includes('Финал') || f.stage.includes('1/2')));
  return autoPick(club, ct, { rotate });
}

const EV = { GOAL: 1, OWN: 2, PEN: 3, YEL: 4, RED: 5, AST: 6, INJ: 7, SUB: 8 };
export { EV };

function pickWeighted(ids: number[], w: (p: Player) => number): number {
  const ws = ids.map((id) => Math.max(0.0001, w(P(id))));
  return ids[R.weightedIndex(ws)];
}

export function quickSim(f: Fixture): SimResult {
  const hc = G.clubs[f.home], ac = G.clubs[f.away];
  const hs = selectionFor(hc, f), as = selectionFor(ac, f);
  const hr = teamRatings(hc, hs), ar = teamRatings(ac, as);
  const homeAdv = f.neutral ? 1.0 : 1.12;
  const mH = hc.tactic.ti.mentality - 3, mA = ac.tactic.ti.mentality - 3;
  const k = 0.024;
  let lh = 1.28 * homeAdv * Math.exp(k * ((hr.att * 0.6 + hr.mid * 0.4) - (ar.def * 0.65 + ar.gk * 0.15 + ar.mid * 0.2)));
  let la = 1.28 / homeAdv * Math.exp(k * ((ar.att * 0.6 + ar.mid * 0.4) - (hr.def * 0.65 + hr.gk * 0.15 + hr.mid * 0.2)));
  lh *= 1 + mH * 0.05 + mA * 0.035;
  la *= 1 + mA * 0.05 + mH * 0.035;
  lh = clamp(lh, 0.12, 6);
  la = clamp(la, 0.12, 6);
  let hg = R.poisson(lh), ag = R.poisson(la);
  const res: SimResult = {
    hg, ag, events: [], ratings: [new Map(), new Map()], minutes: [new Map(), new Map()], stats: [], injuries: [],
  };
  const sides = [hs, as];
  // minutes / subs
  const subs: { out: number; in: number; min: number; side: number }[] = [];
  for (let s = 0; s < 2; s++) {
    const sel = sides[s];
    const xi = sel.lineup.filter((x) => x);
    xi.forEach((id) => res.minutes[s].set(id, 90));
    const nSubs = R.int(2, Math.min(5, sel.subs.length));
    const outs = xi.slice().filter((id) => P(id).pos[0] < 15).sort((a, b) => P(a).cond - P(b).cond).slice(0, nSubs);
    const bench = sel.subs.filter((id) => P(id).pos[0] < 15);
    outs.forEach((out, i) => {
      const inn = bench[i];
      if (!inn) return;
      const min = R.int(55, 88);
      subs.push({ out, in: inn, min, side: s });
      res.minutes[s].set(out, min);
      res.minutes[s].set(inn, 90 - min);
      res.events.push(min, EV.SUB, inn, s);
    });
  }
  const onPitch = (s: number, min: number) => {
    const ids: number[] = [];
    res.minutes[s].forEach((m, id) => {
      const sub = subs.find((x) => x.in === id);
      const off = subs.find((x) => x.out === id);
      if (sub) { if (min >= sub.min) ids.push(id); }
      else if (off) { if (min < off.min) ids.push(id); }
      else ids.push(id);
    });
    return ids;
  };
  // goals
  const goalTimes = (n: number) => Array.from({ length: n }, () => R.int(1, 93)).sort((a, b) => a - b);
  const goalsFor = [goalTimes(hg), goalTimes(ag)];
  const scorerW = (p: Player, s: number) => {
    const fam = p.pos;
    const isST = fam[13] >= 15 ? 3.2 : 0, isAM = (fam[10] >= 15 || fam[11] >= 15 || fam[12] >= 15) ? 1.8 : 0;
    const isM = (fam[7] >= 15 || fam[8] >= 15 || fam[9] >= 15 || fam[6] >= 15) ? 0.7 : 0;
    const isD = fam[0] >= 15 ? 0 : 0.18;
    const base = Math.max(isST, isAM, isM, isD);
    return base * (0.5 + p.a[A.FIN] / 20 + p.a[A.OTB] / 40) * (0.8 + p.a[A.HEA] / 60);
  };
  for (let s = 0; s < 2; s++) {
    for (const min of goalsFor[s]) {
      const ids = onPitch(s, min);
      if (!ids.length) continue;
      const r = R.next();
      if (r < 0.03) {
        const oppIds = onPitch(1 - s, min).filter((id) => P(id).pos[0] < 15);
        if (oppIds.length) res.events.push(min, EV.OWN, R.pick(oppIds), s);
        continue;
      }
      const isPen = r < 0.12;
      const sel = sides[s];
      let scorer: number;
      if (isPen && sel.pen && ids.includes(sel.pen)) scorer = sel.pen;
      else scorer = pickWeighted(ids, (p) => scorerW(p, s));
      res.events.push(min, isPen ? EV.PEN : EV.GOAL, scorer, s);
      if (!isPen && R.chance(0.72)) {
        const others = ids.filter((x) => x !== scorer && P(x).pos[0] < 15);
        if (others.length) {
          const ast = pickWeighted(others, (p) => 0.3 + p.a[A.PAS] / 20 + p.a[A.VIS] / 25 + p.a[A.CRO] / 30 + (p.pos[11] >= 15 || p.pos[10] >= 15 || p.pos[12] >= 15 ? 0.6 : 0));
          res.events.push(min, EV.AST, ast, s);
        }
      }
    }
  }
  // cards
  for (let s = 0; s < 2; s++) {
    const ny = R.poisson(1.9 * (0.8 + (s === 0 ? hc : ac).tactic.ti.tackle * 0.15));
    const ids = Array.from(res.minutes[s].keys()).filter((id) => P(id).pos[0] < 15);
    const yel = new Map<number, number>();
    for (let i = 0; i < ny && ids.length; i++) {
      const pid = pickWeighted(ids, (p) => 0.4 + p.a[A.AGG] / 20 + p.hid[H.DIRT] / 30 + (p.pos[2] >= 15 || p.pos[6] >= 15 ? 0.4 : 0));
      const c = (yel.get(pid) || 0) + 1;
      yel.set(pid, c);
      const min = R.int(5, 90);
      res.events.push(min, c >= 2 ? EV.RED : EV.YEL, pid, s);
    }
    if (R.chance(0.045) && ids.length) res.events.push(R.int(20, 88), EV.RED, R.pick(ids), s);
  }
  // injuries
  for (let s = 0; s < 2; s++) {
    if (R.chance(0.11)) {
      const ids = Array.from(res.minutes[s].keys());
      const pid = pickWeighted(ids, (p) => 0.5 + p.hid[H.INJP] / 10 + (100 - p.cond) / 40);
      const [name, days] = injuryName(R);
      res.injuries.push({ pid, name, days });
      res.events.push(R.int(5, 89), EV.INJ, pid, s);
    }
  }
  // knockout decider
  if (isDecider(f)) {
    const agg = tieAggBefore(f) || [0, 0];
    const th = hg + agg[0], ta = ag + agg[1];
    if (th === ta) {
      const comp = G.comps[f.comp];
      const et = comp.kind === 'cup' ? comp.meta?.et !== false : true;
      if (et) {
        res.et = true;
        const eh = R.poisson(lh / 3.3), ea = R.poisson(la / 3.3);
        for (let i = 0; i < eh; i++) { const ids = onPitch(0, 100); if (ids.length) res.events.push(R.int(91, 120), EV.GOAL, pickWeighted(ids, (p) => scorerW(p, 0)), 0); }
        for (let i = 0; i < ea; i++) { const ids = onPitch(1, 100); if (ids.length) res.events.push(R.int(91, 120), EV.GOAL, pickWeighted(ids, (p) => scorerW(p, 1)), 1); }
        hg += eh; ag += ea;
        res.hg = hg; res.ag = ag;
      }
      if (hg + agg[0] === ag + agg[1]) {
        const [ph, pa] = shootout(hs, as);
        res.ph = ph; res.pa = pa;
      }
    }
  }
  // stats
  const possH = clamp(Math.round(50 + (hr.mid - ar.mid) * 0.6 + (mH - mA) * 1.5 + R.gauss(0, 4)), 25, 75);
  const shotsH = Math.max(hg, Math.round(lh * 8 + R.gauss(0, 2.5))), shotsA = Math.max(ag, Math.round(la * 8 + R.gauss(0, 2.5)));
  const sotH = Math.max(hg, Math.min(shotsH, Math.round(shotsH * 0.38 + R.gauss(0, 1)))), sotA = Math.max(ag, Math.min(shotsA, Math.round(shotsA * 0.38 + R.gauss(0, 1))));
  res.stats = [possH, shotsH, shotsA, sotH, sotA, Math.round(lh * 100), Math.round(la * 100), R.int(1, 9), R.int(1, 8), R.int(6, 16), R.int(6, 16)];
  // ratings
  for (let s = 0; s < 2; s++) {
    const gf = s === 0 ? hg : ag, ga = s === 0 ? ag : hg;
    res.minutes[s].forEach((min, id) => {
      const p = P(id);
      let r = 6.55 + R.gauss(0, 0.42) + (gf > ga ? 0.3 : gf < ga ? -0.3 : 0);
      const isGK = p.pos[0] >= 15, isDef = p.pos[2] >= 15 || p.pos[1] >= 15 || p.pos[3] >= 15;
      if (isGK || isDef) r += ga === 0 ? 0.45 : -0.18 * ga;
      if (min < 30) r = 6.3 + (r - 6.55) * 0.5;
      res.ratings[s].set(id, r);
    });
  }
  for (let i = 0; i < res.events.length; i += 4) {
    const [, t, pid, s] = res.events.slice(i, i + 4);
    const m = res.ratings[s];
    if (!m.has(pid)) continue;
    if (t === EV.GOAL || t === EV.PEN) m.set(pid, m.get(pid)! + 0.95);
    if (t === EV.AST) m.set(pid, m.get(pid)! + 0.55);
    if (t === EV.RED) m.set(pid, m.get(pid)! - 1.2);
    if (t === EV.YEL) m.set(pid, m.get(pid)! - 0.15);
    if (t === EV.OWN) {
      const o = res.ratings[1 - s];
      if (o.has(pid)) o.set(pid, o.get(pid)! - 0.8);
    }
  }
  let best = -1, br = 0;
  for (let s = 0; s < 2; s++) res.ratings[s].forEach((r, id) => {
    const v = clamp(r, 3, 10);
    res.ratings[s].set(id, v);
    if (v > br) { br = v; best = id; }
  });
  res.potm = best;
  return res;
}

export function shootout(hs: Selection, as: Selection): [number, number] {
  const takers = (sel: Selection) => sel.lineup.filter((x) => x).map(P).sort((a, b) => (b.a[A.PEN] + b.a[A.CMP]) - (a.a[A.PEN] + a.a[A.CMP]));
  const gk = (sel: Selection) => P(sel.lineup[0]) || takers(sel)[10];
  const th = takers(hs), ta = takers(as);
  const gh = gk(hs), ga = gk(as);
  let h = 0, a = 0;
  const conv = (p: Player, g: Player) => clamp(0.74 + (p.a[A.PEN] - 12) * 0.012 + (p.a[A.CMP] - 12) * 0.006 - ((g?.a[A.REF] ?? 10) - 12) * 0.008, 0.45, 0.93);
  for (let i = 0; i < 5; i++) {
    if (R.chance(conv(th[i % th.length], ga))) h++;
    if (h > a + (5 - i)) break;
    if (R.chance(conv(ta[i % ta.length], gh))) a++;
    if (a > h + (4 - i) || h > a + (4 - i)) break;
  }
  let i = 5;
  while (h === a && i < 30) {
    const sh = R.chance(conv(th[i % th.length], ga)), sa = R.chance(conv(ta[i % ta.length], gh));
    if (sh) h++;
    if (sa) a++;
    i++;
  }
  return [h, a];
}
