// Detailed match engine: 22 agents, ball physics, decisions, set pieces, commentary.
import type { Club, Fixture, Player, Selection, Tactic } from '../engine/types';
import { G, R, P } from '../engine/state';
import { A, H, ROLE_BY_ID, RoleDef, PosCode, Duty } from '../engine/attrs';
import { FORMATIONS, Slot, autoPick, compTypeOf, teamRatings } from '../engine/tactics';
import { clamp } from '../engine/util';
import { EV, type SimResult } from '../engine/quicksim';
import { shortName, injuryName } from '../engine/player';
import { tieAggBefore, isDecider } from '../engine/comps';

export const PW = 105, PH = 68, TICK = 0.1;
const GOAL_W = 7.32, GOAL_Y1 = 34 - GOAL_W / 2, GOAL_Y2 = 34 + GOAL_W / 2;

export interface MP {
  i: number; pid: number; side: 0 | 1; slot: number; on: boolean;
  pos: PosCode; role: RoleDef; duty: Duty; isGK: boolean;
  a: number[]; hid: number[];
  x: number; y: number; vx: number; vy: number; tx: number; ty: number;
  cond: number; yellow: number; sentOff: boolean; injured: boolean;
  delay: number; stun: number; act: number; actT: number;
  shirt: number; name: string;
  rating: number; st: { pa: number; pc: number; sh: number; sot: number; g: number; as: number; tk: number; int: number; sv: number; kp: number; fo: number; min0: number; min1: number };
}

export interface MEvent { tick: number; min: string; type: string; side: number; pid: number; text: string; imp: number }

interface Team {
  club: Club; side: 0 | 1; tactic: Tactic; sel: Selection; subsLeft: number; subsUsed: number;
  shape: Slot[]; ai: boolean; score: number; pens: number;
  stats: { poss: number; shots: number; sot: number; xg: number; corners: number; fouls: number; yc: number; rc: number; off: number; pa: number; pc: number };
  lastAi: number;
}

const ACT = { NONE: 0, KICK: 1, DIVE_L: 2, DIVE_R: 3, CELEB: 4, FALL: 5, HEAD: 6, THROW: 7 };
export { ACT };

const rnd = () => R.next();
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export class MatchEngine {
  fx: Fixture;
  teams: [Team, Team];
  ps: MP[] = [];
  bench: [number[], number[]] = [[], []];
  tick = 0;
  half = 1; // 1,2 (3,4 extra time)
  halfStartTick = 0;
  halfLen = 2700; // seconds
  added = 0;
  phase: 'play' | 'dead' | 'halftime' | 'fulltime' | 'penalties' = 'dead';
  ball = { x: 52.5, y: 34, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, flight: false, fx: 0, fy: 0, ft: 0, fdur: 0, fkind: 0, receiver: -1, sx: 0, sy: 0, peak: 0, lastSide: 0, lastTouch: -1 };
  restart: { type: string; side: number; x: number; y: number; at: number; taker: number } | null = null;
  possSide = 0;
  events: MEvent[] = [];
  evs: number[] = []; // compact for results
  knockout: { agg: [number, number] | null; et: boolean } = { agg: null, et: true };
  shootout: { h: number; a: number; kicks: number; log: string[] } | null = null;
  finished = false;
  injuriesPending: { pid: number; name: string; days: number }[] = [];
  userSide: number;
  pauseReq: string | null = null;
  shapeTimer = 0;
  expShots: [number, number] = [12, 12];
  rawXg: [number, number] = [0, 0];
  lastShotTick = -100;
  assistCand: number = -1;

  constructor(fx: Fixture, userSide: number) {
    this.fx = fx;
    this.userSide = userSide;
    const ct = compTypeOf(fx.comp);
    const mk = (cid: number, side: 0 | 1): Team => {
      const club = G.clubs[cid];
      let sel: Selection;
      if (cid === G.user && club.sel && !club.sel.auto && club.sel.lineup.every((id) => id && G.players[id])) sel = { ...club.sel, lineup: club.sel.lineup.slice(), subs: club.sel.subs.slice() };
      else sel = autoPick(club, ct, { rotate: false });
      return {
        club, side, tactic: JSON.parse(JSON.stringify(club.tactic)), sel, subsLeft: 5, subsUsed: 0, shape: FORMATIONS[club.tactic.formation], ai: cid !== G.user,
        score: 0, pens: 0, stats: { poss: 0, shots: 0, sot: 0, xg: 0, corners: 0, fouls: 0, yc: 0, rc: 0, off: 0, pa: 0, pc: 0 }, lastAi: 0,
      };
    };
    this.teams = [mk(fx.home, 0), mk(fx.away, 1)];
    for (const t of this.teams) {
      t.sel.lineup.forEach((pid, slot) => this.addPlayer(t, pid, slot));
      this.bench[t.side] = t.sel.subs.slice();
    }
    if (isDecider(fx)) {
      this.knockout.agg = tieAggBefore(fx) || [0, 0];
      const comp = G.comps[fx.comp];
      this.knockout.et = comp.kind === 'cup' ? comp.meta?.et !== false : true;
    }
    // expected chance volume (same model as quick sim) used to keep the engine statistically realistic
    const hr = teamRatings(this.teams[0].club, this.teams[0].sel), ar = teamRatings(this.teams[1].club, this.teams[1].sel);
    const homeAdv = fx.neutral ? 1 : 1.12, k = 0.024;
    const lh = 1.28 * homeAdv * Math.exp(k * ((hr.att * 0.6 + hr.mid * 0.4) - (ar.def * 0.65 + ar.gk * 0.15 + ar.mid * 0.2)));
    const la = (1.28 / homeAdv) * Math.exp(k * ((ar.att * 0.6 + ar.mid * 0.4) - (hr.def * 0.65 + hr.gk * 0.15 + hr.mid * 0.2)));
    this.expShots = [clamp(lh / 0.12, 4, 24), clamp(la / 0.12, 4, 24)];
    for (const t of this.teams) {
      if (!t.ai) continue;
      const me = t.side === 0 ? hr.ovr : ar.ovr, them = t.side === 0 ? ar.ovr : hr.ovr;
      const d = me - them + (t.side === 0 && !fx.neutral ? 3 : 0);
      const ti = t.tactic.ti;
      if (d > 8) { ti.mentality = Math.max(ti.mentality, 4); ti.press = Math.max(ti.press, 2); ti.loe = 2; ti.dline = Math.max(ti.dline, 3); }
      else if (d < -8) { ti.mentality = Math.min(ti.mentality, 2); ti.loe = 0; ti.dline = Math.min(ti.dline, 1); ti.counter = true; }
    }
    this.setupKickoff(0);
    this.event('kickoff', -1, -1, `Матч начался! ${this.teams[0].club.name} — ${this.teams[1].club.name}`, 1);
  }

  addPlayer(t: Team, pid: number, slot: number): MP {
    const p = P(pid);
    const s = t.shape[slot];
    const r = ROLE_BY_ID[t.tactic.slots[slot]?.role] || ROLE_BY_ID[s.role];
    const mp: MP = {
      i: this.ps.length, pid, side: t.side, slot, on: true, pos: s.pos, role: r, duty: t.tactic.slots[slot]?.duty || s.duty, isGK: s.pos === 'GK',
      a: p.a.slice(), hid: p.hid, x: 52.5, y: 34, vx: 0, vy: 0, tx: 52.5, ty: 34, cond: p.cond / 100, yellow: 0, sentOff: false, injured: false,
      delay: 0, stun: 0, act: 0, actT: 0, shirt: p.shirt, name: shortName(p), rating: 6.2,
      st: { pa: 0, pc: 0, sh: 0, sot: 0, g: 0, as: 0, tk: 0, int: 0, sv: 0, kp: 0, fo: 0, min0: this.tick, min1: -1 },
    };
    // morale & form affect effective attributes slightly
    const mf = 0.97 + (p.morale / 100) * 0.06;
    const fam = (t.club.famil[t.tactic.formation] ?? 60) / 100;
    const ff = 0.95 + fam * 0.05;
    for (let i = 0; i < mp.a.length; i++) mp.a[i] = mp.a[i] * mf * (i >= 14 && i < 28 ? ff : 1);
    // position familiarity penalty
    const famPos = p.pos[['GK', 'DL', 'DC', 'DR', 'WBL', 'WBR', 'DM', 'ML', 'MC', 'MR', 'AML', 'AMC', 'AMR', 'ST'].indexOf(s.pos)] ?? 10;
    if (famPos < 15) for (let i = 0; i < 28; i++) mp.a[i] *= 0.82 + famPos * 0.012;
    this.ps.push(mp);
    return mp;
  }

  // ---------- helpers ----------
  pace(side: number): number {
    const frac = clamp(this.clockSec() / (this.half >= 3 ? 7200 : 5400), 0.02, 1.3);
    const ms = this.half <= 2 ? frac : frac;
    return (this.team(side).stats.shots + 1) / (this.expShots[side] * ms + 1);
  }
  tight(attSide: number): number {
    return clamp(0.55 + 0.5 * this.pace(attSide), 0.75, 1.8);
  }
  dir(side: number): number {
    const firstHalfDir = side === 0 ? 1 : -1;
    return this.half % 2 === 1 ? firstHalfDir : -firstHalfDir;
  }
  prog(side: number, x: number) { return this.dir(side) > 0 ? x : PW - x; }
  fromProg(side: number, p: number) { return this.dir(side) > 0 ? p : PW - p; }
  goalX(side: number) { return this.dir(side) > 0 ? PW : 0; } // goal the side attacks
  ownGoalX(side: number) { return this.dir(side) > 0 ? 0 : PW; }
  onPitch(side?: number) { return this.ps.filter((p) => p.on && !p.sentOff && (side == null || p.side === side)); }
  team(side: number) { return this.teams[side]; }
  eff(p: MP, i: number) {
    const v = p.a[i];
    if (i >= 28 && i < 36) return v * (0.65 + 0.35 * p.cond);
    return v * (0.85 + 0.15 * p.cond);
  }
  speed(p: MP) { return (5.6 + this.eff(p, A.PAC) * 0.18) * (p.isGK ? 0.85 : 1); }
  clockSec() { return (this.tick - this.halfStartTick) * TICK + (this.half === 1 ? 0 : this.half === 2 ? 2700 : this.half === 3 ? 5400 : 6300); }
  minuteStr(): string {
    const s = this.clockSec();
    const base = this.half === 1 ? 2700 : this.half === 2 ? 5400 : this.half === 3 ? 6300 : 7200;
    if (s > base) return `${Math.floor(base / 60)}+${Math.floor((s - base) / 60) + 1}`;
    return `${Math.floor(s / 60) + 1}`;
  }
  minute(): number { return Math.min(Math.floor(this.clockSec() / 60) + 1, this.half <= 2 ? 90 + 9 : 120 + 5); }

  event(type: string, side: number, pid: number, text: string, imp: number) {
    this.events.push({ tick: this.tick, min: this.minuteStr(), type, side, pid, text, imp });
  }
  rec(t: number, pid: number, side: number) {
    this.evs.push(this.minute(), t, pid, side);
  }

  // ---------- setup ----------
  setupKickoff(side: number) {
    this.ball = { ...this.ball, x: 52.5, y: 34, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, flight: false, receiver: -1 };
    for (const p of this.onPitch()) {
      const s = this.team(p.side).shape[p.slot];
      const depth = Math.min(s.x, 0.48) * 50;
      p.x = p.tx = this.fromProg(p.side, depth);
      p.y = p.ty = 34 + s.y * 28 * (this.dir(p.side) > 0 ? -1 : 1);
      p.vx = p.vy = 0;
    }
    // two forwards near the ball
    const fw = this.onPitch(side).filter((p) => !p.isGK).sort((a, b) => this.prog(side, b.x) - this.prog(side, a.x));
    if (fw[0]) { fw[0].x = 52.5 - this.dir(side) * 0.6; fw[0].y = 34; }
    if (fw[1]) { fw[1].x = 52.5 - this.dir(side) * 1.2; fw[1].y = 37; }
    this.restart = { type: 'kickoff', side, x: 52.5, y: 34, at: this.tick + 15, taker: fw[0]?.i ?? -1 };
    this.phase = 'dead';
    this.possSide = side;
  }

  // ---------- main step ----------
  step() {
    if (this.finished || this.phase === 'halftime' || this.phase === 'fulltime') return;
    if (this.phase === 'penalties') { this.stepShootout(); return; }
    this.tick++;
    const secs = (this.tick - this.halfStartTick) * TICK;
    // fatigue & minutes
    for (const p of this.ps) {
      if (!p.on || p.sentOff) continue;
      const sp = Math.hypot(p.vx, p.vy);
      const sta = p.a[A.STA];
      p.cond = Math.max(0.2, p.cond - TICK * 0.0000475 * (0.55 + sp / 4.5) * (1.55 - sta / 22) * (1 + this.team(p.side).tactic.ti.press * 0.06));
      if (p.stun > 0) p.stun -= TICK;
      if (p.actT > 0) { p.actT -= TICK; if (p.actT <= 0) p.act = 0; }
    }
    // end of half
    if (this.phase === 'play' || this.phase === 'dead') {
      const len = this.half <= 2 ? 2700 : 900;
      if (secs >= len + this.added && (this.phase === 'dead' || this.ball.owner >= 0 || !this.ball.flight)) {
        if (this.phase !== 'dead' || !this.restart || this.restart.type !== 'kickoff' || secs >= len + this.added + 20) {
          this.endHalf();
          return;
        }
      }
      if (secs >= len - 60 && secs < len - 59.9 && this.added === 0) {
        this.added = Math.round(60 * (1 + R.int(0, this.half === 2 ? 5 : 3)));
        if (this.half <= 2) this.event('added', -1, -1, `Добавлено ${Math.round(this.added / 60)} мин.`, 0);
      }
    }
    // possession stat
    if (this.ball.owner >= 0) this.team(this.ps[this.ball.owner].side).stats.poss++;
    else if (this.ball.flight && this.ball.lastSide != null) this.team(this.ball.lastSide).stats.poss++;
    // AI tactical updates
    if (this.tick % 600 === 0) this.aiManage();
    if (this.phase === 'dead') this.stepDead();
    else this.stepPlay();
    this.movePlayers();
  }

  endHalf() {
    if (this.half === 1) {
      this.phase = 'halftime';
      this.event('ht', -1, -1, `Перерыв. Счёт ${this.teams[0].score}:${this.teams[1].score}`, 2);
      return;
    }
    const decide = this.knockout.agg;
    if (this.half === 2 || this.half === 4) {
      if (decide) {
        const th = this.teams[0].score + decide[0], ta = this.teams[1].score + decide[1];
        if (th === ta) {
          if (this.half === 2 && this.knockout.et) { this.phase = 'halftime'; this.event('et', -1, -1, 'Основное время завершено вничью. Будет назначено дополнительное время!', 3); return; }
          this.startShootout();
          return;
        }
      }
      this.finish();
      return;
    }
    if (this.half === 3) { this.phase = 'halftime'; this.event('ht', -1, -1, 'Перерыв в дополнительное время', 1); }
  }

  resume() {
    if (this.phase !== 'halftime') return;
    this.half++;
    this.halfStartTick = this.tick;
    this.added = 0;
    this.setupKickoff(this.half % 2 === 0 ? 1 : 0);
    this.event('kickoff', -1, -1, this.half === 2 ? 'Начался второй тайм!' : this.half === 3 ? 'Начался первый дополнительный тайм!' : 'Начался второй дополнительный тайм!', 1);
  }

  finish() {
    this.phase = 'fulltime';
    this.finished = true;
    for (const p of this.ps) if (p.on && p.st.min1 < 0) p.st.min1 = this.tick;
    this.event('ft', -1, -1, `Финальный свисток! ${this.teams[0].club.name} ${this.teams[0].score}:${this.teams[1].score} ${this.teams[1].club.name}`, 3);
  }

  // ---------- shootout ----------
  startShootout() {
    this.phase = 'penalties';
    this.shootout = { h: 0, a: 0, kicks: 0, log: [] };
    this.event('pens', -1, -1, 'Серия послематчевых пенальти!', 3);
    this.ball.owner = -1;
    for (const p of this.onPitch()) {
      if (p.isGK) continue;
      p.tx = 52.5 + (p.side === 0 ? -1 : 1) * 2;
      p.ty = 34 + (p.slot - 5) * 1.2;
    }
  }
  stepShootout() {
    this.tick++;
    this.movePlayers();
    const so = this.shootout!;
    if (this.tick % 45 !== 0) return;
    const side = so.kicks % 2;
    const n = Math.floor(so.kicks / 2);
    const takers = this.onPitch(side).filter((p) => !p.isGK).sort((a, b) => (b.a[A.PEN] + b.a[A.CMP]) - (a.a[A.PEN] + a.a[A.CMP]));
    const gk = this.onPitch(1 - side).find((p) => p.isGK) || this.onPitch(1 - side)[0];
    const tk = takers[n % Math.max(1, takers.length)];
    if (!tk) { this.finish(); return; }
    const pr = clamp(0.75 + (this.eff(tk, A.PEN) - 12) * 0.012 + (this.eff(tk, A.CMP) - 12) * 0.006 - ((gk ? this.eff(gk, A.REF) : 10) - 12) * 0.008, 0.45, 0.93);
    const goal = rnd() < pr;
    if (goal) { if (side === 0) so.h++; else so.a++; }
    so.kicks++;
    const gx = this.goalX(0);
    this.ball = { ...this.ball, x: gx - 11 * Math.sign(gx - 52.5 || 1), y: 34, z: 0, owner: -1, flight: false };
    tk.x = this.ball.x - Math.sign(gx - 52.5 || 1) * 1; tk.y = 34; tk.act = ACT.KICK; tk.actT = 0.4;
    if (gk) { gk.x = gx; gk.y = 34; gk.act = goal ? (rnd() < 0.5 ? ACT.DIVE_L : ACT.DIVE_R) : ACT.DIVE_L; gk.actT = 1; }
    this.ball.x = gx; this.ball.y = 34 + (rnd() - 0.5) * 6; this.ball.z = 0.4 + rnd();
    this.event('pen_so', side, tk.pid, `${tk.name} (${this.team(side).club.short}) — ${goal ? 'забивает!' : 'не забивает!'} (${so.h}:${so.a})`, 2);
    // decide
    const kh = Math.ceil(so.kicks / 2), ka = Math.floor(so.kicks / 2);
    const remH = Math.max(0, 5 - kh), remA = Math.max(0, 5 - ka);
    if (so.kicks <= 10) {
      if (so.h > so.a + remA || so.a > so.h + remH) this.endShootout();
    } else if (so.kicks % 2 === 0 && so.h !== so.a) this.endShootout();
  }
  endShootout() {
    const so = this.shootout!;
    this.teams[0].pens = so.h;
    this.teams[1].pens = so.a;
    this.event('pens_end', -1, -1, `Серия пенальти завершена: ${so.h}:${so.a}. Побеждает ${so.h > so.a ? this.teams[0].club.name : this.teams[1].club.name}!`, 3);
    this.finish();
  }

  // ---------- dead ball & restarts ----------
  stepDead() {
    const r = this.restart;
    if (!r) { this.phase = 'play'; return; }
    this.computeShapes(true);
    // taker walks to ball
    const tk = this.ps[r.taker];
    if (tk && tk.on) { tk.tx = r.x - this.dir(r.side) * (r.type === 'corner' ? 0.5 : 0.8); tk.ty = r.y; }
    if (r.type !== 'kickoff_after' || this.tick >= r.at - 20) { this.ball.x = r.x; this.ball.y = r.y; this.ball.z = 0; this.ball.vx = this.ball.vy = this.ball.vz = 0; }
    if (this.tick >= r.at) {
      this.restart = null;
      this.phase = 'play';
      if (!tk || !tk.on || tk.sentOff) { this.ball.owner = this.nearest(r.side, r.x, r.y)?.i ?? -1; return; }
      tk.x = r.x - this.dir(r.side) * 0.6; tk.y = r.y;
      this.ball.owner = tk.i;
      this.ball.lastSide = r.side;
      tk.delay = 0;
      this.possSide = r.side;
      if (r.type === 'corner') this.doCross(tk, true);
      else if (r.type === 'penalty') this.doShot(tk, 'pen');
      else if (r.type === 'fk_direct') this.doShot(tk, 'fk');
      else if (r.type === 'fk_cross') this.doCross(tk, true);
      else if (r.type === 'goalkick') this.goalKick(tk);
      else if (r.type === 'throw') { tk.act = ACT.THROW; tk.actT = 0.5; this.decide(tk, true); }
      else this.decide(tk, true);
    }
  }

  setRestart(type: string, side: number, x: number, y: number, delaySec: number, takerPref?: MP) {
    x = clamp(x, 0, PW); y = clamp(y, 0, PH);
    let taker = takerPref;
    const sel = this.team(side).sel;
    const byPid = (pid: number) => this.ps.find((p) => p.pid === pid && p.on && !p.sentOff);
    if (!taker) {
      if (type === 'corner' || type === 'fk_cross') taker = byPid(sel.crn) || byPid(sel.fk);
      else if (type === 'fk_direct') taker = byPid(sel.fk);
      else if (type === 'penalty') taker = byPid(sel.pen);
      else if (type === 'goalkick') taker = this.onPitch(side).find((p) => p.isGK);
    }
    if (!taker) taker = this.nearest(side, x, y, true);
    this.restart = { type, side, x, y, at: this.tick + Math.round(delaySec / TICK), taker: taker ? taker.i : -1 };
    this.phase = 'dead';
    this.ball.owner = -1;
    this.ball.flight = false;
    this.ball.x = x; this.ball.y = y; this.ball.z = 0;
    this.possSide = side;
  }

  nearest(side: number, x: number, y: number, outfield = false): MP | undefined {
    let best: MP | undefined, bd = 1e9;
    for (const p of this.onPitch(side)) {
      if (outfield && p.isGK) continue;
      if (p.stun > 0.5) continue;
      const d = dist(p.x, p.y, x, y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ---------- open play ----------
  stepPlay() {
    const b = this.ball;
    this.shapeTimer -= 1;
    if (this.shapeTimer <= 0) { this.computeShapes(false); this.shapeTimer = 4; }
    if (b.flight) {
      b.ft += TICK;
      const f = Math.min(1, b.ft / b.fdur);
      b.x = b.sx + (b.fx - b.sx) * f;
      b.y = b.sy + (b.fy - b.sy) * f;
      b.z = b.peak * 4 * f * (1 - f) + (b.fkind === 3 ? b.vz * f : 0);
      if (b.fkind === 3) b.z = Math.max(0, b.z);
      if (f >= 1) this.arrive();
      return;
    }
    if (b.owner < 0) {
      // loose ball: nearest players race
      let best: MP | undefined, bt = 1e9;
      for (const p of this.onPitch()) {
        if (p.stun > 0) continue;
        const t = dist(p.x, p.y, b.x, b.y) / this.speed(p) + (p.isGK && !this.inBox(p.side, b.x, b.y, true) ? 5 : 0);
        if (t < bt) { bt = t; best = p; }
        p.tx = b.x; p.ty = b.y;
      }
      // only nearest 2 per team chase
      for (const side of [0, 1]) {
        const chasers = this.onPitch(side).sort((p1, p2) => dist(p1.x, p1.y, b.x, b.y) - dist(p2.x, p2.y, b.x, b.y));
        chasers.slice(2).forEach((p) => this.applyShapeTarget(p));
      }
      b.x += b.vx * TICK; b.y += b.vy * TICK;
      b.vx *= 0.94; b.vy *= 0.94;
      if (this.checkOut()) return;
      if (best && dist(best.x, best.y, b.x, b.y) < 0.9) this.gainPossession(best, 'loose');
      return;
    }
    const o = this.ps[b.owner];
    if (!o.on || o.sentOff) { b.owner = -1; return; }
    // ball at feet
    const fdx = o.vx, fdy = o.vy;
    const sp = Math.hypot(fdx, fdy) || 1;
    b.x = o.x + (fdx / sp) * 0.45; b.y = o.y + (fdy / sp) * 0.45; b.z = 0;
    if (this.checkOut()) return;
    this.pressureAndTackles(o);
    if (b.owner !== o.i) return;
    o.delay -= TICK;
    if (o.delay > 0.2 && !(o as any).dribbling) {
      // defender closing in front: act now
      for (const q of this.onPitch(1 - o.side)) {
        if (q.isGK) continue;
        if (dist(q.x, q.y, o.x, o.y) < 2.6 && this.prog(o.side, q.x) > this.prog(o.side, o.x)) { o.delay = 0; break; }
      }
    }
    if (o.delay <= 0) { (o as any).dribbling = false; this.decide(o, false); }
  }

  inBox(side: number, x: number, y: number, own: boolean): boolean {
    const p = own ? this.prog(side, x) : PW - this.prog(side, x);
    return p <= 16.5 && Math.abs(y - 34) <= 20.16;
  }

  checkOut(): boolean {
    const b = this.ball;
    if (b.x >= 0 && b.x <= PW && b.y >= 0 && b.y <= PH) return false;
    const lastSide = b.lastSide;
    if (b.y < 0 || b.y > PH) {
      this.setRestart('throw', 1 - lastSide, clamp(b.x, 1, PW - 1), b.y < 0 ? 0 : PH, 3);
      return true;
    }
    // byline
    const atX = b.x < 0 ? 0 : PW;
    const defSide = this.ownGoalX(0) === atX ? 0 : 1; // side defending this goal
    if (lastSide === defSide) {
      const att = 1 - defSide;
      this.team(att).stats.corners++;
      this.setRestart('corner', att, atX, b.y < 34 ? 0.5 : PH - 0.5, 4);
      this.event('corner', att, -1, `Угловой у ворот «${this.team(defSide).club.name}»`, 1);
    } else {
      this.setRestart('goalkick', defSide, atX === 0 ? 5.5 : PW - 5.5, 34 + (b.y < 34 ? -9 : 9), 4);
    }
    return true;
  }

  gainPossession(p: MP, how: string) {
    const prevSide = this.possSide;
    this.ball.owner = p.i;
    this.ball.flight = false;
    this.ball.lastSide = p.side;
    this.ball.lastTouch = p.i;
    this.possSide = p.side;
    p.delay = 0.95 + R.range(0, 0.8) + (20 - this.eff(p, A.FIR)) * 0.02 - (this.team(p.side).tactic.ti.tempo - 2) * 0.12;
    if (prevSide !== p.side) {
      this.assistCand = -1;
      if (how === 'loose' && !p.isGK) { p.st.int++; p.rating += 0.03; }
      // counter-press / counter flags handled via shapes
    }
  }

  // ---------- decisions ----------
  threat(side: number, x: number, y: number): number {
    const p = this.prog(side, x);
    const dg = Math.hypot(PW - p, (y - 34) * 1.3);
    return clamp(Math.exp(-dg / 16) * 0.9 + (p / PW) * 0.12, 0, 1);
  }

  xg(side: number, x: number, y: number, header = false): number {
    const gx = this.goalX(side);
    const d = Math.hypot(gx - x, y - 34);
    const lat = Math.abs(y - 34);
    const a1 = Math.atan2(GOAL_Y2 - y, Math.abs(gx - x)), a2 = Math.atan2(GOAL_Y1 - y, Math.abs(gx - x));
    const ang = Math.abs(a1 - a2);
    let v = 0.5 * Math.exp(-0.13 * d) * clamp(ang / 0.65, 0.25, 1.1);
    if (lat > 18) v *= 0.5;
    if (header) v *= 0.55;
    return clamp(v, 0.005, 0.85);
  }

  pressureOn(p: MP): number {
    let m = 99;
    for (const q of this.onPitch(1 - p.side)) m = Math.min(m, dist(p.x, p.y, q.x, q.y));
    return m;
  }

  decide(o: MP, setPiece: boolean) {
    const side = o.side;
    const t = this.team(side);
    const ti = t.tactic.ti;
    const opp = this.onPitch(1 - side);
    const mates = this.onPitch(side).filter((m) => m !== o);
    const pr = this.pressureOn(o);
    const myProg = this.prog(side, o.x);
    const dec = this.eff(o, A.DEC), vis = this.eff(o, A.VIS), pas = this.eff(o, A.PAS), tec = this.eff(o, A.TEC);
    const options: { v: number; kind: string; m?: MP; tx?: number; ty?: number }[] = [];
    // shoot
    const gx = this.goalX(side);
    const dGoal = Math.hypot(gx - o.x, o.y - 34);
    if (dGoal < 32 && !setPiece && !o.isGK) {
      const xgv = this.xg(side, o.x, o.y) * (pr < 1.5 ? 0.6 : pr < 3 ? 0.85 : 1.1);
      const longOk = dGoal > 22 ? this.eff(o, A.LON) >= 12 || ti.shootOnSight : true;
      const pc = this.pace(side);
      if (xgv >= 0.022 && longOk && (pc < 0.95 || xgv > 0.3)) {
        let w = 0.05 + xgv * 4.5 * (0.6 + o.role.shoot) * (ti.shootOnSight ? 1.4 : 1) * (ti.workIntoBox && dGoal > 18 ? 0.5 : 1) * (1 + (ti.mentality - 3) * 0.05);
        if (dGoal > 22) w *= 0.35 + this.eff(o, A.LON) / 30;
        options.push({ v: w, kind: 'shoot' });
      }
    }
    // passes
    const maxRange = 22 + pas * 2.2 + (ti.passing - 2) * 4;
    for (const m of mates) {
      const d = dist(o.x, o.y, m.x, m.y);
      if (d < 4 || d > maxRange) continue;
      if (m.isGK && (pr > 4 || myProg > 40)) continue;
      const gain = this.prog(side, m.x) - myProg;
      let risk = 0;
      for (const q of opp) {
        const seg = segDist(o.x, o.y, m.x, m.y, q.x, q.y);
        if (seg.t < 0.05) continue;
        const r = clamp((2.6 + d * 0.035 - seg.d) / 2.2, 0, 1) * (0.35 + 0.65 * seg.t);
        risk = Math.max(risk, r);
      }
      const rP = this.pressureOn(m);
      const lofted = d > 32 || risk > 0.55;
      const acc = clamp(0.97 - d * (0.004 + (20 - pas) * 0.0007) - (pr < 2 ? 0.08 : 0), 0.4, 0.98);
      let s = (1 - risk * 0.95) * acc * (rP < 2 ? 0.85 : 1);
      if (lofted) s = clamp(0.3 + (rP - 1.5) * 0.09 + (pas - 10) * 0.015, 0.12, 0.8) * acc;
      const thr = this.threat(side, m.x, m.y);
      const dirW = 0.012 * (1 + (ti.passing - 2) * 0.35);
      let v = s * (0.3 + thr * 1.3 + gain * dirW) - (1 - s) * (0.35 + (1 - myProg / PW) * 0.4);
      if (gain < -5) v -= 0.05 * (ti.passing >= 3 ? 1.5 : 0.6);
      if (ti.playOut && myProg < 35 && d < 22) v += 0.05;
      if (ti.focus === 1 && this.lat(side, m.y) < -0.3) v += 0.04;
      if (ti.focus === 3 && this.lat(side, m.y) > 0.3) v += 0.04;
      if (ti.focus === 2 && Math.abs(m.y - 34) < 12) v += 0.04;
      options.push({ v, kind: lofted ? 'lpass' : 'pass', m });
      // through ball into space
      if (gain > 4 && m.role.run > 0.3 && this.prog(side, m.x) > 55 && vis > 8) {
        const lead = 6 + m.role.run * 6;
        const tx = this.fromProg(side, Math.min(PW - 3, this.prog(side, m.x) + lead)), ty = m.y + (34 - m.y) * 0.15;
        const offs = this.isOffside(side, m.x);
        let risk2 = 0;
        for (const q of opp) risk2 = Math.max(risk2, clamp((5 - dist(q.x, q.y, tx, ty)) / 5, 0, 1));
        const s2 = clamp(0.25 + vis / 40 + pas / 40 - risk2 * 0.5, 0.1, 0.85) * (offs ? 0.2 : 1);
        const v2 = s2 * (0.25 + this.threat(side, tx, ty) * 2.0) - (1 - s2) * 0.2 + o.role.through * 0.08;
        options.push({ v: v2, kind: 'through', m, tx, ty });
      }
    }
    // cross
    const wide = Math.abs(o.y - 34) > 16;
    if (wide && myProg > 72 && !o.isGK) {
      const inBox = mates.filter((m) => this.inBox(1 - side, m.x, m.y, true) || (PW - this.prog(side, m.x) < 18 && Math.abs(m.y - 34) < 14));
      if (inBox.length) {
        const v = 0.2 + inBox.length * 0.08 + o.role.cross * 0.25 + (this.eff(o, A.CRO) - 10) * 0.012;
        options.push({ v, kind: 'cross' });
      }
    }
    // dribble / carry
    if (!o.isGK) {
      let ahead = 99;
      const fx = this.dir(side);
      for (const q of opp) {
        const dx = (q.x - o.x) * fx, dy = q.y - o.y;
        if (dx > 0 && Math.abs(dy) < dx + 3) ahead = Math.min(ahead, Math.hypot(dx, dy));
      }
      const carryGain = Math.min(8, ahead - 2);
      const drib = this.eff(o, A.DRI);
      if (ahead > 5) options.push({ v: 0.12 + this.threat(side, o.x + fx * carryGain, o.y) * 1.4 + (ti.dribble - 1) * 0.04, kind: 'carry' });
      else {
        const pBeat = clamp(0.3 + (drib - 10) * 0.03 + (this.eff(o, A.AGI) - 10) * 0.01, 0.1, 0.8);
        options.push({ v: pBeat * (0.15 + this.threat(side, o.x + fx * 6, o.y) * 1.8) - (1 - pBeat) * 0.25 + o.role.dribble * 0.08 + (ti.dribble - 1) * 0.05, kind: 'dribble' });
      }
    }
    // clear
    if (myProg < 22 && pr < 3) options.push({ v: 0.12 + (ti.passing >= 3 ? 0.05 : 0), kind: 'clear' });
    if (!options.length) options.push({ v: 0.1, kind: 'carry' });
    // choose (softmax)
    const T = 0.05 + ((20 - dec) / 20) * 0.11 + this.eff(o, A.FLA) * 0.002;
    const mx = Math.max(...options.map((x) => x.v));
    const ws = options.map((x) => Math.exp((x.v - mx) / T));
    const ch = options[R.weightedIndex(ws)];
    const tempo = ti.tempo;
    o.delay = clamp(1.55 - (tempo - 2) * 0.18 + (20 - dec) * 0.02 + R.range(0, 0.9), 0.6, 2.8);
    void tec;
    switch (ch.kind) {
      case 'shoot': this.doShot(o, 'open'); break;
      case 'pass': case 'lpass': this.doPass(o, ch.m!, ch.kind === 'lpass'); break;
      case 'through': this.doThrough(o, ch.m!, ch.tx!, ch.ty!); break;
      case 'cross': this.doCross(o, false); break;
      case 'clear': this.doClear(o); break;
      case 'dribble': this.carry(o, true); break;
      default: this.carry(o, false);
    }
  }

  lat(side: number, y: number) {
    // lateral relative to attacking direction: -1 left .. 1 right
    return ((y - 34) / 34) * (this.dir(side) > 0 ? -1 : 1);
  }

  isOffside(side: number, x: number): boolean {
    const p = this.prog(side, x);
    if (p <= 52.5) return false;
    const defs = this.onPitch(1 - side).map((q) => this.prog(side, q.x)).sort((a, b) => b - a);
    const second = defs[1] ?? PW;
    const bp = this.prog(side, this.ball.x);
    return p > second + 1.0 && p > bp;
  }

  carry(o: MP, takeOn: boolean) {
    const side = o.side;
    const fx = this.dir(side);
    let ty = o.y;
    if (Math.abs(o.y - 34) > 20 && this.prog(side, o.x) > 70 && o.role.inside > 0.3) ty = o.y + (34 - o.y) * 0.35;
    if (Math.abs(o.y - 34) < 10) ty = o.y + (R.next() - 0.5) * 10;
    o.tx = clamp(o.x + fx * (takeOn ? 7 : 10), 2, PW - 2);
    o.ty = clamp(ty, 2, PH - 2);
    o.delay = takeOn ? 0.9 : 0.8 + R.range(0, 0.6);
    (o as any).dribbling = takeOn;
    if (takeOn) {
      const def = this.onPitch(1 - side).sort((a, b) => dist(a.x, a.y, o.x, o.y) - dist(b.x, b.y, o.x, o.y))[0];
      if (def && dist(def.x, def.y, o.x, o.y) < 3) this.duel(o, def, true);
    }
  }

  kickTo(o: MP, tx: number, ty: number, speed: number, peak: number, kind: number, receiver: number) {
    const b = this.ball;
    b.owner = -1;
    b.flight = true;
    b.sx = b.x; b.sy = b.y;
    b.fx = tx; b.fy = ty;
    const d = dist(b.x, b.y, tx, ty);
    b.fdur = Math.max(0.25, d / speed);
    b.ft = 0;
    b.peak = peak;
    b.fkind = kind;
    b.receiver = receiver;
    b.lastSide = o.side;
    b.lastTouch = o.i;
    o.act = ACT.KICK;
    o.actT = 0.35;
    o.tx = o.x; o.ty = o.y;
  }

  passError(o: MP, d: number, lofted: boolean): number {
    const pr = this.pressureOn(o);
    const pas = this.eff(o, A.PAS), tec = this.eff(o, A.TEC);
    return d * (0.025 + (20 - (pas * 0.7 + tec * 0.3)) * 0.0045) * (pr < 1.5 ? 1.6 : pr < 3 ? 1.2 : 1) * (lofted ? 1.25 : 1);
  }

  doPass(o: MP, m: MP, lofted: boolean) {
    const t = this.team(o.side);
    const d = dist(o.x, o.y, m.x, m.y);
    const speed = lofted ? clamp(14 + d * 0.18, 16, 26) : clamp(9 + d * 0.38, 11, 24);
    const lead = Math.min(1.2, d / speed);
    let tx = m.x + m.vx * lead, ty = m.y + m.vy * lead;
    const err = this.passError(o, d, lofted);
    tx += R.gauss(0, err * 0.7); ty += R.gauss(0, err * 0.7);
    t.stats.pa++;
    o.st.pa++;
    // offside check
    if (this.isOffside(o.side, m.x) && rnd() < 0.55) {
      this.team(o.side).stats.off++;
      this.event('offside', o.side, m.pid, `${m.name} в офсайде`, 1);
      this.setRestart('fk', 1 - o.side, m.x, m.y, 3);
      return;
    }
    this.kickTo(o, tx, ty, speed, lofted ? clamp(d * 0.12, 2.5, 9) : 0, lofted ? 2 : 1, m.i);
    this.resolveInterception(o, lofted);
    this.assistCand = o.i;
    m.tx = tx; m.ty = ty;
  }

  doThrough(o: MP, m: MP, tx: number, ty: number) {
    const d = dist(o.x, o.y, tx, ty);
    const err = this.passError(o, d, false) * 0.8;
    tx += R.gauss(0, err); ty += R.gauss(0, err);
    this.team(o.side).stats.pa++;
    o.st.pa++;
    if (this.isOffside(o.side, m.x) && rnd() < 0.6) {
      this.team(o.side).stats.off++;
      this.event('offside', o.side, m.pid, `${m.name} убегает к воротам, но фиксируется офсайд`, 1);
      this.setRestart('fk', 1 - o.side, m.x, m.y, 3);
      return;
    }
    const lofted = d > 28;
    this.kickTo(o, tx, ty, lofted ? 20 : 17, lofted ? 3 : 0, lofted ? 2 : 1, m.i);
    this.resolveInterception(o, lofted);
    this.assistCand = o.i;
    m.tx = tx; m.ty = ty;
    o.st.kp += 0;
  }

  resolveInterception(o: MP, lofted: boolean) {
    const b = this.ball;
    if (lofted) {
      const rcv = b.receiver >= 0 ? this.ps[b.receiver] : null;
      let best: MP | null = null, bs = -1e9;
      for (const q of this.onPitch(1 - o.side)) {
        const dq = dist(q.x, q.y, b.fx, b.fy);
        const reach = dq / (this.speed(q) * 0.9) < b.fdur + 0.2;
        if (!reach || dq > 7) continue;
        if (q.isGK && !this.inBox(q.side, b.fx, b.fy, true)) continue;
        const sc = (this.eff(q, A.HEA) + this.eff(q, A.JUM) + this.eff(q, A.ANT) + (q.isGK ? this.eff(q, A.AER) * 1.5 : 0)) * R.range(0.7, 1.3) - dq * 2.2;
        if (sc > bs) { bs = sc; best = q; }
      }
      if (best && rcv) {
        const dr = dist(rcv.x, rcv.y, b.fx, b.fy);
        const rs = (this.eff(rcv, A.HEA) + this.eff(rcv, A.JUM) + this.eff(rcv, A.FIR) + this.eff(rcv, A.STR) * 0.5) * R.range(0.7, 1.3) - dr * 2.2 + 4;
        if (bs > rs) { b.receiver = best.i; best.tx = b.fx; best.ty = b.fy; }
      } else if (best && !rcv) { b.receiver = best.i; best.tx = b.fx; best.ty = b.fy; }
      return;
    }
    const T = b.fdur;
    const tProg = this.prog(o.side, b.fx);
    const tg = this.tight(o.side);
    const pressF = (() => { const ti2 = this.team(1 - o.side).tactic.ti; return 1 + (ti2.press - 1) * 0.12 + (ti2.loe - 1) * (tProg < 50 ? 0.15 : 0); })();
    const pq = clamp(1 + (12 - (this.eff(o, A.PAS) * 0.7 + this.eff(o, A.TEC) * 0.3)) * 0.05, 0.6, 1.6);
    const zoneF = (this.inBox(1 - o.side, b.fx, b.fy, true) ? 1.6 * tg : tProg >= 70 ? 1.2 * Math.sqrt(tg) : tProg >= 50 ? 0.95 : 0.75) * pressF * pq;
    let best: { q: MP; f: number } | null = null;
    for (const q of this.onPitch(1 - o.side)) {
      if (q.stun > 0) continue;
      const qs = this.speed(q) * 0.85;
      const react = 0.5 - this.eff(q, A.ANT) * 0.01;
      for (let f = lofted ? 0.88 : 0.18; f <= 1.0001; f += lofted ? 0.06 : 0.1) {
        const px = b.sx + (b.fx - b.sx) * f, py = b.sy + (b.fy - b.sy) * f;
        const tb = f * T;
        const tq = dist(q.x, q.y, px, py) / qs + react;
        if (tq < tb) {
          let p = clamp(0.2 + (tb - tq) * 0.55 + (this.eff(q, A.ANT) + this.eff(q, A.POS) - 20) * 0.012, 0, 0.8);
          if (q.isGK && !this.inBox(q.side, px, py, true)) p = 0;
          if (lofted) p *= q.isGK ? 1.0 : 0.65 * (0.6 + (this.eff(q, A.HEA) + this.eff(q, A.JUM)) / 40);
          p = Math.min(0.92, p * zoneF);
          if (rnd() < p && (!best || f < best.f)) best = { q, f };
          break;
        }
      }
    }
    if (best) {
      b.fx = b.sx + (b.fx - b.sx) * best.f;
      b.fy = b.sy + (b.fy - b.sy) * best.f;
      b.fdur *= best.f;
      b.receiver = best.q.i;
      best.q.tx = b.fx; best.q.ty = b.fy;
    }
  }

  arrive() {
    const b = this.ball;
    b.flight = false;
    if (b.fkind === 3 || b.fkind === 5) return; // shots & crosses handled separately
    const rcv = b.receiver >= 0 ? this.ps[b.receiver] : null;
    if (rcv && rcv.on && !rcv.sentOff && dist(rcv.x, rcv.y, b.x, b.y) < (rcv.side === b.lastSide ? 3.5 : 2.8)) {
      const passer = b.lastTouch >= 0 ? this.ps[b.lastTouch] : null;
      if (rcv.side === b.lastSide) {
        // controlled?
        const pr = this.pressureOn(rcv);
        const pc = clamp(0.95 + (this.eff(rcv, A.FIR) - 10) * 0.008 - (pr < 1.2 ? 0.1 : 0) - (b.fkind === 2 ? 0.05 : 0), 0.6, 0.99);
        if (rnd() < pc) {
          if (passer) { passer.st.pc++; this.team(passer.side).stats.pc++; passer.rating += 0.012; }
          this.gainPossession(rcv, 'pass');
          return;
        }
        // poor touch
        b.vx = R.gauss(0, 3); b.vy = R.gauss(0, 3);
        b.owner = -1;
        return;
      }
      // interception
      if (rcv.isGK) { rcv.st.sv += 0; }
      rcv.st.int++;
      rcv.rating += 0.06;
      if (passer) passer.rating -= 0.03;
      this.gainPossession(rcv, 'int');
      return;
    }
    // nobody reached: loose
    b.owner = -1;
    b.vx = (b.fx - b.sx) / Math.max(0.3, b.fdur) * 0.25;
    b.vy = (b.fy - b.sy) / Math.max(0.3, b.fdur) * 0.25;
    this.checkOut();
  }

  doCross(o: MP, setPiece: boolean) {
    const side = o.side;
    const gx = this.goalX(side);
    const ti = this.team(side).tactic.ti;
    const near = rnd() < 0.45;
    const fx = gx - this.dir(side) * (near ? 6 : R.range(8, 12));
    const fy = 34 + (o.y < 34 ? -1 : 1) * (near ? -2 : 2) + R.gauss(0, 3) * (o.y < 34 ? 1 : -1);
    const cro = setPiece ? (this.eff(o, A.COR) + this.eff(o, A.CRO)) / 2 : this.eff(o, A.CRO);
    const err = 3.2 - cro * 0.11;
    const tx = fx + R.gauss(0, err), ty = fy + R.gauss(0, err);
    this.team(side).stats.pa++;
    o.st.pa++;
    const low = ti.cross === 1;
    this.kickTo(o, tx, ty, low ? 22 : 19, low ? 0.6 : ti.cross === 3 ? 6 : 3.5, 4, -1);
    this.ball.fkind = 5; // cross
    this.assistCand = o.i;
    // attackers attack the ball
    const atts = this.onPitch(side).filter((m) => !m.isGK && m !== o).sort((a, b) => dist(a.x, a.y, tx, ty) - dist(b.x, b.y, tx, ty)).slice(0, 3);
    atts.forEach((m, k) => { m.tx = tx + R.gauss(0, 1.5 + k); m.ty = ty + R.gauss(0, 1.5 + k); });
    this.pendingCross = { side, tx, ty, crosser: o.i, setPiece };
  }
  pendingCross: { side: number; tx: number; ty: number; crosser: number; setPiece: boolean } | null = null;

  resolveCross() {
    const pc = this.pendingCross!;
    this.pendingCross = null;
    const side = pc.side;
    const b = this.ball;
    const cand = (s: number) => this.onPitch(s).filter((m) => dist(m.x, m.y, b.x, b.y) < 4.5).map((m) => ({ m, s: (this.eff(m, A.HEA) * 0.9 + this.eff(m, A.JUM) * 1.1 + this.eff(m, A.BRA) * 0.4 + this.eff(m, A.STR) * 0.4 + (P(m.pid).h - 180) * 0.15) * R.range(0.65, 1.35) - dist(m.x, m.y, b.x, b.y) * 2.5 }));
    const att = cand(side).sort((a, b) => b.s - a.s)[0];
    const defs = cand(1 - side).sort((a, b) => b.s - a.s);
    const gk = this.onPitch(1 - side).find((m) => m.isGK);
    // GK claim
    if (gk && dist(gk.x, gk.y, b.x, b.y) < 6 && this.inBox(1 - side, b.x, b.y, true)) {
      const claim = clamp(0.35 + (this.eff(gk, A.AER) + this.eff(gk, A.CMD) - 20) * 0.03, 0.1, 0.8);
      if (rnd() < claim) {
        gk.x = b.x; gk.y = b.y;
        this.gainPossession(gk, 'claim');
        gk.delay = 1.5;
        this.event('claim', 1 - side, gk.pid, `${gk.name} уверенно забирает мяч на выходе`, 0);
        return;
      }
    }
    const def = defs[0];
    if (att && (!def || att.s > def.s)) {
      // header / volley
      const m = att.m;
      m.x = b.x; m.y = b.y;
      if (dist(b.x, b.y, this.goalX(side), 34) < 16) { this.doShot(m, 'header'); return; }
      this.gainPossession(m, 'cross');
      return;
    }
    if (def) {
      const m = def.m;
      m.x = b.x; m.y = b.y; m.act = ACT.HEAD; m.actT = 0.4;
      m.rating += 0.05;
      if (rnd() < 0.32) {
        this.team(side).stats.corners++;
        this.event('corner', side, -1, `${m.name} выносит мяч на угловой`, 1);
        this.setRestart('corner', side, this.goalX(side), b.y < 34 ? 0.5 : PH - 0.5, 4);
        return;
      }
      // clearance
      this.ball.owner = m.i;
      this.ball.lastSide = m.side;
      this.doClear(m);
      return;
    }
    this.ball.owner = -1;
    b.vx = R.gauss(0, 4); b.vy = R.gauss(0, 4);
  }

  doClear(o: MP) {
    const side = o.side;
    const tx = this.fromProg(side, clamp(this.prog(side, o.x) + R.range(25, 45), 10, 95));
    const ty = clamp(o.y + R.gauss(0, 15), 3, PH - 3);
    this.kickTo(o, tx, ty, 22, R.range(5, 12), 2, -1);
    o.rating += 0.02;
    // nearest player to landing gets it
    let best: MP | undefined, bt = 1e9;
    for (const p of this.onPitch()) {
      const t = dist(p.x, p.y, tx, ty) / this.speed(p);
      if (t < bt) { bt = t; best = p; }
    }
    if (best) { this.ball.receiver = best.i; best.tx = tx; best.ty = ty; }
  }

  goalKick(gk: MP) {
    const ti = this.team(gk.side).tactic.ti;
    const short = ti.gkDist === 0 || (ti.gkDist === 1 && rnd() < 0.5) || ti.playOut;
    if (short) {
      const defs = this.onPitch(gk.side).filter((m) => !m.isGK && this.prog(gk.side, m.x) < 30);
      const m = defs.sort((a, b) => this.pressureOn(b) - this.pressureOn(a))[0];
      if (m) { this.doPass(gk, m, false); return; }
    }
    const fw = this.onPitch(gk.side).filter((m) => !m.isGK).sort((a, b) => this.prog(gk.side, b.x) - this.prog(gk.side, a.x))[R.int(0, 2)];
    if (fw) this.doPass(gk, fw, true);
    else this.doClear(gk);
  }

  doShot(o: MP, kind: 'open' | 'header' | 'fk' | 'pen') {
    const side = o.side;
    const t = this.team(side);
    const gx = this.goalX(side);
    const gk = this.onPitch(1 - side).find((m) => m.isGK);
    let xgv = kind === 'pen' ? 0.76 : kind === 'fk' ? 0.055 : this.xg(side, o.x, o.y, kind === 'header');
    const pr = this.pressureOn(o);
    if (kind === 'open') xgv *= pr < 1.2 ? 0.6 : pr < 2.5 ? 0.82 : 1.08;
    // one-on-one bonus
    if (kind === 'open') {
      const between = this.onPitch(1 - side).filter((q) => !q.isGK && this.prog(side, q.x) > this.prog(side, o.x)).length;
      if (between === 0 && dist(o.x, o.y, gx, 34) < 18) xgv *= 1.45;
    }
    t.stats.shots++;
    this.rawXg[side] += xgv;
    // calibrate chance quality so that conversion stays realistic (~11%) while keeping relative quality
    const scale = kind === 'pen' ? 1 : clamp((0.105 * t.stats.shots) / Math.max(0.05, this.rawXg[side]), 0.12, 1.25);
    if (kind !== 'pen') xgv *= scale;
    t.stats.xg += xgv;
    o.st.sh++;
    const fin = kind === 'header' ? (this.eff(o, A.HEA) * 0.7 + this.eff(o, A.JUM) * 0.3) : kind === 'fk' ? this.eff(o, A.FRE) : kind === 'pen' ? this.eff(o, A.PEN) : (this.eff(o, A.FIN) * 0.6 + this.eff(o, A.TEC) * 0.2 + this.eff(o, A.CMP) * 0.2);
    const gkq = gk ? (this.eff(gk, A.REF) * 0.4 + this.eff(gk, A.ONE) * 0.2 + this.eff(gk, A.HAN) * 0.15 + this.eff(gk, A.POS) * 0.25) : 5;
    const imp = 1 + (o.hid[H.IMPM] - 10) * 0.005;
    let pGoal = clamp(0.78 * xgv * (1 + (fin - 12) * 0.05) * (1 - (gkq - 12) * 0.035) * imp, 0.005, 0.9);
    if (kind === 'pen') pGoal = clamp(0.76 + (fin - 12) * 0.012 - (gkq - 12) * 0.008, 0.5, 0.93);
    const r = rnd();
    let outcome: 'goal' | 'save' | 'miss' | 'block' | 'post';
    const blockers = kind === 'open' ? this.onPitch(1 - side).filter((q) => !q.isGK && segDist(o.x, o.y, gx, 34, q.x, q.y).d < 1.0 && segDist(o.x, o.y, gx, 34, q.x, q.y).t < 0.5) : [];
    if (blockers.length && rnd() < 0.45) outcome = 'block';
    else if (r < pGoal) outcome = 'goal';
    else {
      const onT = kind === 'pen' ? 0.6 : clamp(0.25 + (fin - 10) * 0.015, 0.15, 0.48);
      const r2 = rnd();
      outcome = r2 < onT ? 'save' : r2 < onT + 0.04 ? 'post' : 'miss';
    }
    // ball flight visuals
    const gy = outcome === 'goal' ? 34 + R.range(-3.2, 3.2) : outcome === 'save' ? (gk ? clamp(gk.y + R.gauss(0, 1.2), GOAL_Y1 + 0.3, GOAL_Y2 - 0.3) : 34) : outcome === 'post' ? (rnd() < 0.5 ? GOAL_Y1 : GOAL_Y2) : 34 + (rnd() < 0.5 ? -1 : 1) * R.range(4.2, 8);
    const gz = outcome === 'miss' && rnd() < 0.4 ? R.range(2.6, 4) : R.range(0.2, 2.1);
    const tx = outcome === 'block' && blockers[0] ? blockers[0].x : gx;
    const ty = outcome === 'block' && blockers[0] ? blockers[0].y : gy;
    this.kickTo(o, tx, ty, kind === 'header' ? 15 : 27, 0, 3, -1);
    this.ball.vz = gz;
    this.ball.peak = kind === 'header' ? 0.6 : 0.4;
    if (kind === 'header') { o.act = ACT.HEAD; o.actT = 0.5; }
    this.pendingShot = { o: o.i, outcome, kind, xg: xgv, gk: gk?.i ?? -1, blocker: blockers[0]?.i ?? -1 };
    this.lastShotTick = this.tick;
    if (gk && (outcome === 'save' || outcome === 'goal')) {
      gk.act = gy < gk.y ? (this.dir(1 - side) > 0 ? ACT.DIVE_R : ACT.DIVE_L) : (this.dir(1 - side) > 0 ? ACT.DIVE_L : ACT.DIVE_R);
      gk.actT = 1.2;
      gk.tx = gx; gk.ty = gy;
    }
    const kindTxt = kind === 'header' ? 'бьёт головой' : kind === 'fk' ? 'исполняет штрафной' : kind === 'pen' ? 'подходит к мячу... ' : dist(o.x, o.y, gx, 34) > 22 ? 'наносит дальний удар' : 'бьёт по воротам';
    this.event('shot', side, o.pid, `${o.name} ${kindTxt}`, kind === 'pen' ? 2 : xgv > 0.2 ? 2 : 1);
  }
  pendingShot: { o: number; outcome: string; kind: string; xg: number; gk: number; blocker: number } | null = null;

  resolveShot() {
    const s = this.pendingShot!;
    this.pendingShot = null;
    const o = this.ps[s.o];
    const side = o.side;
    const t = this.team(side);
    const gk = s.gk >= 0 ? this.ps[s.gk] : null;
    const name = o.name;
    if (s.outcome === 'goal') {
      t.score++;
      t.stats.sot++;
      o.st.sot++; o.st.g++;
      o.rating += 1.0;
      const isPen = s.kind === 'pen';
      this.rec(isPen ? EV.PEN : EV.GOAL, o.pid, side);
      let astTxt = '';
      if (!isPen && this.assistCand >= 0 && this.assistCand !== o.i && this.ps[this.assistCand].side === side && s.kind !== 'fk') {
        const a = this.ps[this.assistCand];
        a.st.as++; a.rating += 0.55;
        this.rec(EV.AST, a.pid, side);
        astTxt = ` Голевая передача: ${a.name}.`;
      }
      if (gk) gk.rating -= 0.25;
      for (const d of this.onPitch(1 - side)) if (!d.isGK && this.prog(1 - side, d.x) < 35) d.rating -= 0.06;
      const sc = `${this.teams[0].score}:${this.teams[1].score}`;
      this.event('goal', side, o.pid, `ГОООЛ! ${name} (${t.club.short}) ${isPen ? 'реализует пенальти' : s.kind === 'header' ? 'забивает головой' : s.kind === 'fk' ? 'забивает со штрафного' : 'забивает'}! ${sc}.${astTxt}`, 3);
      o.act = ACT.CELEB; o.actT = 6;
      const bx = this.goalX(side) + this.dir(side) * 1.2, by = this.ball.y;
      this.setRestart('kickoff', 1 - side, 52.5, 34, 12);
      this.restart!.type = 'kickoff_after';
      this.ball.x = bx; this.ball.y = clamp(by, GOAL_Y1 + 0.5, GOAL_Y2 - 0.5); this.ball.z = 0.3;
      this.celebrating = { side, until: this.tick + 70, scorer: o.i };
      this.added += 30;
      return;
    }
    if (s.outcome === 'save' && gk) {
      t.stats.sot++;
      o.st.sot++;
      o.rating += 0.1;
      gk.st.sv++;
      gk.rating += 0.22 + s.xg * 0.8;
      const hold = clamp(0.45 + (this.eff(gk, A.HAN) - 10) * 0.04, 0.15, 0.85);
      if (rnd() < hold || s.kind === 'pen') {
        this.event('save', 1 - side, gk.pid, s.kind === 'pen' ? `${gk.name} ОТРАЖАЕТ ПЕНАЛЬТИ!` : `${gk.name} забирает мяч намертво`, s.xg > 0.2 ? 2 : 1);
        this.ball.x = gk.x; this.ball.y = gk.y;
        if (s.kind === 'pen' && rnd() < 0.4) { this.ball.owner = -1; this.ball.vx = R.gauss(0, 5); this.ball.vy = R.gauss(0, 5); return; }
        this.gainPossession(gk, 'save');
        gk.delay = 2.0;
        return;
      }
      this.event('save', 1 - side, gk.pid, `${gk.name} отбивает удар!`, s.xg > 0.2 ? 2 : 1);
      if (rnd() < 0.45) {
        this.team(side).stats.corners++;
        this.setRestart('corner', side, this.goalX(side), this.ball.y < 34 ? 0.5 : PH - 0.5, 4);
        return;
      }
      // rebound
      this.ball.owner = -1;
      this.ball.flight = false;
      this.ball.x = this.goalX(side) - this.dir(side) * R.range(5, 12);
      this.ball.y = 34 + R.gauss(0, 7);
      this.ball.vx = 0; this.ball.vy = 0;
      return;
    }
    if (s.outcome === 'block') {
      const bl = s.blocker >= 0 ? this.ps[s.blocker] : null;
      if (bl) { bl.rating += 0.08; this.event('block', bl.side, bl.pid, `Удар ${name} заблокирован — ${bl.name}`, 1); }
      if (rnd() < 0.35) {
        this.team(side).stats.corners++;
        this.setRestart('corner', side, this.goalX(side), rnd() < 0.5 ? 0.5 : PH - 0.5, 4);
        return;
      }
      this.ball.owner = -1;
      this.ball.flight = false;
      this.ball.vx = R.gauss(0, 6); this.ball.vy = R.gauss(0, 6);
      return;
    }
    if (s.outcome === 'post') {
      this.event('post', side, o.pid, `Штанга! ${name} был в сантиметрах от гола!`, 2);
      this.ball.owner = -1;
      this.ball.flight = false;
      this.ball.x = this.goalX(side) - this.dir(side) * 2;
      this.ball.vx = -this.dir(side) * R.range(4, 10); this.ball.vy = R.gauss(0, 5);
      return;
    }
    // miss
    o.rating -= 0.04;
    this.event('miss', side, o.pid, s.xg > 0.25 ? `${name} не попадает в ворота с выгодной позиции!` : `${name} — мимо ворот`, s.xg > 0.25 ? 2 : 1);
    const gkSide = 1 - side;
    this.setRestart('goalkick', gkSide, this.goalX(side) === 0 ? 5.5 : PW - 5.5, 34 + (this.ball.y < 34 ? -9 : 9), 5);
  }
  celebrating: { side: number; until: number; scorer: number } | null = null;

  // ---------- duels & tackles ----------
  pressureAndTackles(o: MP) {
    const ti = this.team(1 - o.side).tactic.ti;
    for (const d of this.onPitch(1 - o.side)) {
      if (d.stun > 0) continue;
      const dd = dist(d.x, d.y, o.x, o.y);
      if (d.isGK) {
        // goalkeeper smothers / closes down
        if (dd < 1.6 && this.inBox(d.side, o.x, o.y, true) && rnd() < 0.5 * TICK * 10 * clamp(0.3 + this.eff(d, A.ONE) / 30, 0.3, 0.95)) {
          if (rnd() < clamp(0.35 + (this.eff(d, A.ONE) + this.eff(d, A.RUS) - this.eff(o, A.DRI) - this.eff(o, A.CMP)) * 0.02, 0.15, 0.8)) { d.st.sv++; d.rating += 0.2; this.gainPossession(d, 'smother'); this.event('save', d.side, d.pid, `${d.name} бросается в ноги ${o.name} и забирает мяч`, 2); return; }
        }
        continue;
      }
      // goal-side contact => immediate take-on duel
      const front = this.prog(o.side, d.x) > this.prog(o.side, o.x) - 0.3;
      if (front && dd < 1.35 && (o as any).dribbling && (this.tick - ((d as any).lastDuel || -99)) > 15) {
        (d as any).lastDuel = this.tick;
        this.duel(o, d, true);
        return;
      }
      if (dd > 1.7) continue;
      const rate = (0.35 + this.eff(d, A.AGG) / 50 + ti.tackle * 0.12 + ti.press * 0.06) * TICK;
      if (rnd() < rate) { this.duel(o, d, false); return; }
    }
  }

  duel(o: MP, d: MP, attacking: boolean) {
    const ti = this.team(d.side).tactic.ti;
    const att = this.eff(o, A.DRI) * 1.0 + this.eff(o, A.AGI) * 0.35 + this.eff(o, A.BAL) * 0.35 + this.eff(o, A.TEC) * 0.25 + this.eff(o, A.STR) * 0.2 + (attacking ? 2 : 0);
    const dz = this.prog(d.side, d.x);
    const def = this.eff(d, A.TCK) * 1.0 + this.eff(d, A.ANT) * 0.4 + this.eff(d, A.POS) * 0.3 + this.eff(d, A.STR) * 0.3 + this.eff(d, A.AGG) * 0.15 + (dz < 18 ? 3 : dz < 35 ? 1.5 : 0) + (dz < 40 ? (this.tight(o.side) - 1) * 5 : 0);
    const pWin = clamp(0.5 + (def - att) * 0.022 + (ti.tackle - 1) * 0.04, 0.12, 0.88);
    let pFoul = clamp(0.028 + (this.eff(d, A.AGG) - 10) * 0.003 + (d.hid[H.DIRT] - 8) * 0.003 + (ti.tackle === 2 ? 0.03 : ti.tackle === 0 ? -0.02 : 0), 0.01, 0.2);
    if (this.inBox(d.side, o.x, o.y, true)) pFoul *= 0.14;
    const r = rnd();
    if (r < pFoul) { this.foul(d, o); return; }
    if (rnd() < pWin) {
      d.st.tk++;
      d.rating += 0.07;
      o.rating -= 0.03;
      if (rnd() < 0.6) this.gainPossession(d, 'tackle');
      else { this.ball.owner = -1; this.ball.vx = R.gauss(0, 4); this.ball.vy = R.gauss(0, 4); }
      if (rnd() < 0.00035 + (20 - this.eff(o, A.BAL)) * 0.00002 + Math.max(0, o.hid[H.INJP] - 8) * 0.00003 + (1 - o.cond) * 0.0006) this.injure(o);
    } else {
      d.stun = attacking ? 1.3 : 1.0;
      d.act = ACT.FALL;
      d.actT = 0.8;
      o.rating += 0.05;
      o.delay = Math.min(o.delay, 0.3);
    }
  }

  foul(d: MP, o: MP) {
    const t = this.team(d.side);
    t.stats.fouls++;
    d.st.fo++;
    d.rating -= 0.05;
    o.act = ACT.FALL; o.actT = 1.2;
    const inBox = this.inBox(d.side, o.x, o.y, true);
    const lastMan = this.onPitch(d.side).filter((q) => !q.isGK && this.prog(o.side, q.x) > this.prog(o.side, o.x)).length === 0 && this.prog(o.side, o.x) > 60;
    let card = 0;
    const r = rnd();
    if (lastMan && r < 0.55) card = 2;
    else if (r < 0.21 + (t.tactic.ti.tackle === 2 ? 0.06 : 0) + (lastMan ? 0.3 : 0)) card = 1;
    else if (r > 0.996) card = 2;
    if (card === 1) {
      d.yellow++;
      t.stats.yc++;
      this.rec(EV.YEL, d.pid, d.side);
      d.rating -= 0.3;
      if (d.yellow >= 2) { this.sendOff(d, 'вторая жёлтая'); }
      else this.event('yellow', d.side, d.pid, `Жёлтая карточка: ${d.name} (${t.club.short})`, 2);
    } else if (card === 2) {
      this.sendOff(d, 'прямая красная');
    } else this.event('foul', d.side, d.pid, `${d.name} фолит на ${o.name}`, 0);
    if (rnd() < 0.0025) this.injure(o);
    if (inBox) {
      this.event('penalty', o.side, o.pid, `ПЕНАЛЬТИ! ${d.name} сбивает ${o.name} в штрафной!`, 3);
      this.setRestart('penalty', o.side, this.fromProg(o.side, PW - 11), 34, 6);
      this.positionPenalty(o.side);
      return;
    }
    const dg = dist(o.x, o.y, this.goalX(o.side), 34);
    const prog = this.prog(o.side, o.x);
    if (dg < 32 && Math.abs(o.y - 34) < 18) this.setRestart('fk_direct', o.side, o.x, o.y, 6);
    else if (prog > 70) this.setRestart('fk_cross', o.side, o.x, o.y, 6);
    else this.setRestart('fk', o.side, o.x, o.y, 3);
  }

  positionPenalty(side: number) {
    for (const p of this.onPitch()) {
      if (p.isGK && p.side !== side) continue;
      p.tx = this.fromProg(side, PW - 22 + R.range(-2, 2));
      p.ty = 34 + R.range(-12, 12);
    }
  }

  sendOff(d: MP, why: string) {
    const t = this.team(d.side);
    d.sentOff = true;
    d.on = false;
    d.st.min1 = this.tick;
    t.stats.rc++;
    this.rec(EV.RED, d.pid, d.side);
    d.rating -= 1.5;
    this.event('red', d.side, d.pid, `КРАСНАЯ КАРТОЧКА! ${d.name} (${t.club.short}) удалён — ${why}!`, 3);
    if (this.ball.owner === d.i) this.ball.owner = -1;
    if (d.isGK) {
      // outfield replaces gk (AI uses sub if possible)
      const rep = this.onPitch(d.side).sort((a, b) => a.a[A.HAN] - b.a[A.HAN])[0];
      if (rep) { rep.isGK = true; rep.pos = 'GK'; }
    }
    if (d.side === this.userSide) this.pauseReq = 'red';
  }

  injure(p: MP) {
    if (p.injured) return;
    p.injured = true;
    const [name, days] = injuryName(R);
    this.injuriesPending.push({ pid: p.pid, name, days });
    this.rec(EV.INJ, p.pid, p.side);
    this.event('injury', p.side, p.pid, `${p.name} получает травму и не может продолжать игру`, 2);
    p.cond = Math.min(p.cond, 0.5);
    if (p.side === this.userSide) this.pauseReq = 'injury';
    else this.aiSubFor(p);
  }

  // ---------- shapes & movement ----------
  computeShapes(dead: boolean) {
    const b = this.ball;
    for (const side of [0, 1] as const) {
      const t = this.team(side);
      const ti = t.tactic.ti;
      const inPos = this.possSide === side;
      const bp = this.prog(side, b.x);
      const oppLine = (() => {
        const defs = this.onPitch(1 - side).filter((q) => !q.isGK).map((q) => this.prog(side, q.x)).sort((a, c) => c - a);
        return defs[0] ?? 90;
      })();
      const ment = ti.mentality - 3;
      let DL: number, L: number;
      if (inPos) {
        DL = clamp(bp - 34 + ment * 2.5, 14 + ti.dline * 2, 56);
        L = clamp(oppLine - 1 - DL, 26, 52);
      } else {
        const maxDL = [28, 34, 40, 46, 52][ti.dline];
        DL = clamp(bp - 25 + (ti.dline - 2) * 4 + (ti.loe - 1) * 4, 9, maxDL);
        L = 30 + (ti.loe - 1) * 3 - (ti.dline < 2 ? 2 : 0);
      }
      const width = inPos ? 25 + ti.width * 2.6 : 21;
      for (const p of this.onPitch(side)) {
        if (b.flight && b.receiver === p.i && !dead) continue;
        if (p.isGK) { this.gkTarget(p, inPos); continue; }
        const s = t.shape[p.slot];
        let depth = DL + ((s.x - 0.19) / (0.8 - 0.19)) * L;
        let lat = s.y;
        if (inPos) {
          const dutyF = p.duty === 'A' ? 1 : p.duty === 'S' ? 0.55 : 0.15;
          depth += p.role.fwd * dutyF * 9 - p.role.drop * 6;
          if (bp > 65) lat *= 1 - p.role.inside * 0.45;
          if (p.role.run > 0.5 && bp > 55) depth = Math.max(depth, oppLine - 0.5);
          depth = Math.min(depth, oppLine - 0.6);
        } else {
          lat *= 0.8;
        }
        if (dead && this.restart) {
          const r = this.restart;
          if (r.type === 'corner' || r.type === 'fk_cross') {
            const att = r.side === side;
            const box = PW - 9;
            if (att && (p.pos === 'DC' || p.pos === 'ST' || p.a[A.HEA] >= 13) && s.x > 0.1) { depth = box + R.range(-3, 3); lat = R.range(-0.25, 0.25); }
            else if (!att && s.x < 0.6) { depth = 3 + R.range(0, 8); lat = R.range(-0.3, 0.3); }
          } else if (r.type === 'kickoff' || r.type === 'kickoff_after') {
            depth = Math.min(depth, 50);
          }
        }
        const yy = 34 + lat * width * (this.dir(side) > 0 ? -1 : 1) + (b.y - 34) * (inPos ? 0.18 : 0.42);
        p.tx = this.fromProg(side, clamp(depth, 2, PW - 2));
        p.ty = clamp(yy, 1.5, PH - 1.5);
        (p as any).baseTx = p.tx; (p as any).baseTy = p.ty;
      }
      // pressing: nearest players to ball carrier
      if (!inPos && !dead && b.owner >= 0) {
        const carrier = this.ps[b.owner];
        const zone = [14, 20, 28, 36][ti.press] + (ti.counterPress && this.tick - (this.lastLoss[side] || 0) < 50 ? 12 : 0);
        const lineOk = this.prog(side, carrier.x) > 105 - ([45, 62, 85][ti.loe]);
        const n = ti.press >= 2 ? 2 : 1;
        const near = this.onPitch(side).filter((q) => !q.isGK).sort((a, c) => dist(a.x, a.y, carrier.x, carrier.y) - dist(c.x, c.y, carrier.x, carrier.y)).slice(0, n);
        const gx0 = this.ownGoalX(side);
        for (const q of near) {
          if (dist(q.x, q.y, carrier.x, carrier.y) < zone && (lineOk || dist(q.x, q.y, carrier.x, carrier.y) < 10)) {
            q.tx = carrier.x + (gx0 - carrier.x) * 0.06;
            q.ty = carrier.y + (34 - carrier.y) * 0.06;
            (q as any).engaged = this.tick;
          }
        }
        // goal-side defenders step up to a carrier entering their zone
        const engageR = 8 + ti.press * 1.5;
        let engaged = 0;
        const cands = this.onPitch(side).filter((q) => !q.isGK && !near.includes(q)).sort((a, c) => dist(a.x, a.y, carrier.x, carrier.y) - dist(c.x, c.y, carrier.x, carrier.y));
        for (const q of cands) {
          if (engaged >= 2) break;
          const dq = dist(q.x, q.y, carrier.x, carrier.y);
          if (dq > engageR) break;
          if (this.prog(side, q.x) > this.prog(side, carrier.x) + 1) continue; // not goal-side
          const k = Math.min(1, 1.2 / Math.max(1.2, dq));
          q.tx = carrier.x + (gx0 - carrier.x) / Math.max(1, Math.hypot(gx0 - carrier.x, 34 - carrier.y)) * 1.1;
          q.ty = carrier.y + (34 - carrier.y) / Math.max(1, Math.hypot(gx0 - carrier.x, 34 - carrier.y)) * 1.1;
          void k;
          engaged++;
        }
        // marking: defenders track nearby attackers goal-side
        for (const q of this.onPitch(side).filter((x) => !x.isGK && x.pos !== 'ST')) {
          let tgt: MP | null = null, bd = 9;
          for (const a of this.onPitch(1 - side)) {
            if (a.isGK) continue;
            const dd = dist(a.x, a.y, q.tx, q.ty);
            if (dd < bd) { bd = dd; tgt = a; }
          }
          if (tgt && q.st) {
            const gx = this.ownGoalX(side);
            const mk = 0.45 + this.eff(q, A.MAR) / 60;
            q.tx = q.tx * (1 - mk) + (tgt.x + (gx - tgt.x) * 0.08) * mk;
            q.ty = q.ty * (1 - mk) + tgt.y * mk;
          }
        }
      }
      // support: off-ball runs for attackers when team has ball
      if (inPos && !dead && b.owner >= 0) {
        const carrier = this.ps[b.owner];
        if (carrier.side === side) {
          for (const q of this.onPitch(side)) {
            if (q === carrier || q.isGK) continue;
            if (q.role.run > 0.4 && R.next() < 0.02 * (1 + this.eff(q, A.OTB) / 20)) {
              (q as any).runUntil = this.tick + 25;
            }
            if ((q as any).runUntil > this.tick) {
              const dp = Math.min(PW - 4, this.prog(side, q.x) + 10);
              q.tx = this.fromProg(side, dp);
            }
          }
        }
      }
    }
    if (this.celebrating && this.tick < this.celebrating.until) {
      const sc = this.ps[this.celebrating.scorer];
      const cx = this.goalX(sc.side) - this.dir(sc.side) * 3, cy = sc.y < 34 ? 2 : PH - 2;
      sc.tx = cx; sc.ty = cy;
      for (const q of this.onPitch(sc.side)) if (q !== sc && !q.isGK && dist(q.x, q.y, sc.x, sc.y) < 30) { q.tx = cx + R.gauss(0, 1.5); q.ty = cy + R.gauss(0, 1.5); }
    }
  }
  lastLoss: Record<number, number> = {};

  applyShapeTarget(p: MP) {
    const bx = (p as any).baseTx, by = (p as any).baseTy;
    if (bx != null) { p.tx = bx; p.ty = by; }
  }

  gkTarget(p: MP, inPos: boolean) {
    const side = p.side;
    const gx = this.ownGoalX(side);
    const b = this.ball;
    const bd = dist(b.x, b.y, gx, 34);
    const sweeper = p.role.id === 'SK';
    let off = inPos ? (sweeper ? 16 : 10) : clamp(bd * 0.12, 1, sweeper ? 9 : 5);
    if (bd < 20 && !inPos) off = clamp(bd * 0.18, 0.8, 4);
    const ang = Math.atan2(b.y - 34, (b.x - gx) || 0.001);
    p.tx = gx + Math.cos(ang) * off * 1.0;
    p.ty = 34 + Math.sin(ang) * off * 0.6 + (b.y - 34) * 0.08;
    p.tx = clamp(p.tx, gx === 0 ? 0.3 : PW - 18, gx === 0 ? 18 : PW - 0.3);
    p.ty = clamp(p.ty, GOAL_Y1 - 4, GOAL_Y2 + 4);
  }

  movePlayers() {
    const owner = this.ball.owner;
    for (const p of this.ps) {
      if (!p.on || p.sentOff) continue;
      if (p.stun > 0.3 || p.act === ACT.FALL) { p.vx *= 0.8; p.vy *= 0.8; p.x += p.vx * TICK; p.y += p.vy * TICK; continue; }
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const vmax = this.speed(p) * (p.i === owner ? 0.68 : d > 7 ? 1 : d > 2.5 ? 0.62 : 0.35) * (this.phase === 'dead' ? 0.6 : 1);
      let tvx = 0, tvy = 0;
      if (d > 0.15) { tvx = (dx / d) * Math.min(vmax, d * 1.8); tvy = (dy / d) * Math.min(vmax, d * 1.8); }
      const acc = (2.6 + this.eff(p, A.ACC) * 0.17) * TICK;
      const ddx = tvx - p.vx, ddy = tvy - p.vy;
      const dl = Math.hypot(ddx, ddy);
      if (dl > acc) { p.vx += (ddx / dl) * acc; p.vy += (ddy / dl) * acc; } else { p.vx = tvx; p.vy = tvy; }
      p.x = clamp(p.x + p.vx * TICK, -2, PW + 2);
      p.y = clamp(p.y + p.vy * TICK, -2, PH + 2);
    }
    // pending resolutions when ball arrives
    if (this.ball.flight === false && this.pendingShot) this.resolveShot();
    if (this.ball.flight === false && this.pendingCross) this.resolveCross();
  }

  // ---------- substitutions & management ----------
  makeSub(side: number, outPid: number, inPid: number): string | null {
    const t = this.team(side);
    if (t.subsLeft <= 0) return 'Лимит замен исчерпан';
    const out = this.ps.find((p) => p.pid === outPid && p.on && p.side === side);
    if (!out) return 'Игрок не на поле';
    if (!this.bench[side].includes(inPid)) return 'Игрок не в запасе';
    const slot = out.slot;
    out.on = false;
    out.st.min1 = this.tick;
    const np = this.addPlayer(t, inPid, slot);
    np.x = out.x < 52.5 ? out.x : out.x; np.y = out.y < 34 ? 0 : PH;
    np.x = out.x; np.y = out.y;
    np.isGK = out.isGK || t.shape[slot].pos === 'GK';
    np.st.min0 = this.tick;
    this.bench[side] = this.bench[side].filter((x) => x !== inPid);
    t.subsLeft--;
    t.subsUsed++;
    if (this.ball.owner === out.i) this.ball.owner = np.i;
    this.rec(EV.SUB, inPid, side);
    this.event('sub', side, inPid, `Замена в «${t.club.short}»: ${np.name} вместо ${out.name}`, 1);
    return null;
  }

  setTactic(side: number, tac: Tactic) {
    const t = this.team(side);
    const formChanged = tac.formation !== t.tactic.formation;
    t.tactic = JSON.parse(JSON.stringify(tac));
    t.shape = FORMATIONS[tac.formation];
    for (const p of this.onPitch(side)) {
      const s = t.shape[p.slot];
      p.pos = s.pos;
      p.role = ROLE_BY_ID[tac.slots[p.slot].role] || ROLE_BY_ID[s.role];
      p.duty = tac.slots[p.slot].duty;
      p.isGK = s.pos === 'GK';
    }
    if (formChanged) this.event('tactic', side, -1, `«${t.club.short}» меняет схему на ${tac.formation}`, 1);
  }

  swapSlots(side: number, a: number, b: number) {
    const pa = this.onPitch(side).find((p) => p.slot === a), pb = this.onPitch(side).find((p) => p.slot === b);
    if (pa) pa.slot = b;
    if (pb) pb.slot = a;
    this.setTactic(side, this.team(side).tactic);
  }

  aiSubFor(p: MP) {
    const t = this.team(p.side);
    if (!t.ai && p.side === this.userSide) return;
    if (t.subsLeft <= 0) return;
    const cand = this.bench[p.side].map(P).filter((x) => x && !(x.inj && x.inj.until > G.day));
    const want = p.isGK ? cand.filter((x) => x.pos[0] >= 15) : cand.filter((x) => x.pos[0] < 15);
    const best = want.sort((a, b) => b.ca - a.ca)[0];
    if (best) this.makeSub(p.side, p.pid, best.id);
  }

  aiManage() {
    const min = this.minute();
    for (const t of this.teams) {
      if (!t.ai) continue;
      const side = t.side;
      const diff = t.score - this.teams[1 - side].score + (this.knockout.agg ? (side === 0 ? this.knockout.agg[0] - this.knockout.agg[1] : this.knockout.agg[1] - this.knockout.agg[0]) : 0);
      const ti = t.tactic.ti;
      if (min >= 60) {
        if (diff < 0) ti.mentality = Math.min(6, Math.max(ti.mentality, 4 + (min >= 80 ? 1 : 0)));
        else if (diff > 0 && min >= 75) ti.mentality = Math.min(ti.mentality, 2);
      }
      // subs
      if (min >= 55 && t.subsLeft > 0 && this.tick - t.lastAi > 600) {
        const tired = this.onPitch(side).filter((p) => !p.isGK && p.cond < 0.72).sort((a, b) => a.cond - b.cond)[0];
        const fallback = min >= 70 ? this.onPitch(side).filter((p) => !p.isGK).sort((a, b) => a.rating - b.rating)[0] : undefined;
        const out = tired || (min >= 75 && t.subsLeft > 2 ? fallback : undefined);
        if (out) {
          const cand = this.bench[side].map(P).filter((x) => x && x.pos[0] < 15);
          const posIdx = ['GK', 'DL', 'DC', 'DR', 'WBL', 'WBR', 'DM', 'ML', 'MC', 'MR', 'AML', 'AMC', 'AMR', 'ST'].indexOf(out.pos);
          const best = cand.sort((a, b) => (b.pos[posIdx] >= 15 ? 20 : 0) + b.ca / 10 - ((a.pos[posIdx] >= 15 ? 20 : 0) + a.ca / 10))[0];
          if (best) { this.makeSub(side, out.pid, best.id); t.lastAi = this.tick; }
        }
      }
    }
  }

  // ---------- results ----------
  toResult(): SimResult {
    const res: SimResult = {
      hg: this.teams[0].score, ag: this.teams[1].score, events: this.evs.slice(), ratings: [new Map(), new Map()], minutes: [new Map(), new Map()], stats: [], injuries: this.injuriesPending.slice(),
    };
    if (this.half >= 3) res.et = true;
    if (this.shootout) { res.ph = this.shootout.h; res.pa = this.shootout.a; }
    const totalTicks = Math.max(1, this.tick);
    let best = -1, br = 0;
    for (const p of this.ps) {
      const s = p.side;
      const end = p.st.min1 >= 0 ? p.st.min1 : this.tick;
      const mins = Math.max(1, Math.round(((end - p.st.min0) / totalTicks) * (this.half >= 3 ? 120 : 90)));
      res.minutes[s].set(p.pid, mins);
      const tm = this.teams[s], ot = this.teams[1 - s];
      let r = shownRating(p.rating) + (tm.score > ot.score ? 0.25 : tm.score < ot.score ? -0.2 : 0);
      if (p.isGK || p.pos.startsWith('D') || p.pos.startsWith('WB')) r += ot.score === 0 ? 0.4 : 0;
      if (mins < 20) r = 6.2 + (r - 6.2) * 0.4;
      r = clamp(r, 3, 10);
      res.ratings[s].set(p.pid, r);
      if (r > br) { br = r; best = p.pid; }
    }
    res.potm = best;
    const tp = this.teams[0].stats.poss + this.teams[1].stats.poss || 1;
    const s0 = this.teams[0].stats, s1 = this.teams[1].stats;
    res.stats = [Math.round((s0.poss / tp) * 100), s0.shots, s1.shots, s0.sot, s1.sot, Math.round(s0.xg * 100), Math.round(s1.xg * 100), s0.corners, s1.corners, s0.fouls, s1.fouls];
    return res;
  }
}

export function shownRating(raw: number) {
  return clamp(6.4 + Math.tanh((raw - 6.2) / 6) * 3.1, 3, 10);
}

// util: distance from point to segment with param t
function segDist(ax: number, ay: number, bx: number, by: number, px: number, py: number): { d: number; t: number } {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = clamp(t, 0, 1);
  return { d: Math.hypot(ax + t * dx - px, ay + t * dy - py), t };
}

