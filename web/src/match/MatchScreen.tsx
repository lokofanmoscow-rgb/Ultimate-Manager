import React, { useEffect, useRef, useState } from 'react';
import { G, P } from '../engine/state';
import { MatchEngine, TICK, MEvent, shownRating } from './engine';
import { Match3D, kitFor } from './Match3D';
import { Crest, Seg, Bar, condColor, refresh } from '../ui/common';
import { applyResult } from '../engine/results';
import { progressComp } from '../engine/game';
import { MENTALITY, PASSING, TEMPO, WIDTH, DLINE, LOE, PRESS, TACKLE, FORMATION_KEYS, FORMATIONS, makeTactic } from '../engine/tactics';
import { fullName } from '../engine/player';
import { POS_RU } from '../engine/attrs';
import type { Tactic } from '../engine/types';
import './match.css';

const MODES = ['Полный матч', 'Расширенные', 'Ключевые', 'Текст'];
const SPEEDS = [1, 2, 4, 8, 16];
const CAMS = ['ТВ', 'Сверху', 'Ворота', 'Близко'];

interface Seg { a: number; b: number }

export function MatchScreen({ fxId, mode: initMode, onDone }: { fxId: number; mode: number; onDone: () => void }) {
  const fx = G.fixtures[fxId];
  const userSide = fx.home === G.user ? 0 : 1;
  const engRef = useRef<MatchEngine | null>(null);
  if (!engRef.current) engRef.current = new MatchEngine(fx, userSide);
  const eng = engRef.current;
  const containerRef = useRef<HTMLDivElement>(null);
  const r3d = useRef<Match3D | null>(null);
  const snaps = useRef(new Map<number, Float32Array>());
  const pt = useRef(0);
  const [mode, setMode] = useState(initMode);
  const modeRef = useRef(initMode);
  const [speedIdx, setSpeedIdx] = useState(1);
  const speedRef = useRef(2);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [panel, setPanel] = useState<string | null>(null);
  const [, setFrame] = useState(0);
  const [ff, setFf] = useState(false);
  const [cam, setCam] = useState(0);
  const [stage, setStage] = useState<'play' | 'ht' | 'ft'>('play');
  const stageRef = useRef<'play' | 'ht' | 'ft'>('play');
  const handled = useRef(new Set<number>());
  const [toast, setToast] = useState<string | null>(null);
  const finishedRef = useRef(false);

  const setPausedBoth = (v: boolean) => { pausedRef.current = v; setPaused(v); };
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { speedRef.current = SPEEDS[speedIdx]; }, [speedIdx]);

  // 3D init
  useEffect(() => {
    if (mode === 3 || !containerRef.current) return;
    if (!r3d.current) {
      const h = G.clubs[fx.home], a = G.clubs[fx.away];
      const k1 = kitFor(h), k2 = kitFor(a, { c1: k1.shirt, c2: k1.shirt2 });
      k2.gk = '#ff7a1a';
      r3d.current = new Match3D(containerRef.current, [k1, k2], h.c1);
      r3d.current.camMode = cam;
      r3d.current.snapCamera();
    }
    return () => {};
  }, [mode === 3]);
  useEffect(() => () => { r3d.current?.dispose(); r3d.current = null; }, []);
  useEffect(() => { if (r3d.current) r3d.current.camMode = cam; }, [cam]);
  useEffect(() => {
    (window as any).__umMatchBack = () => { if (panel) { setPanel(null); return true; } setPausedBoth(!pausedRef.current); return true; };
    const h = (e: Event) => { e.preventDefault(); (window as any).__umMatchBack(); };
    window.addEventListener('um-back', h);
    return () => window.removeEventListener('um-back', h);
  }, [panel]);

  const snapshot = () => {
    const ps = eng.ps;
    const arr = new Float32Array(4 + ps.length * 5);
    arr[0] = eng.ball.x; arr[1] = eng.ball.y; arr[2] = eng.ball.z; arr[3] = eng.ball.owner;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const o = 4 + i * 5;
      if (!p.on || p.sentOff) { arr[o] = NaN; continue; }
      arr[o] = p.x; arr[o + 1] = p.y; arr[o + 2] = p.vx; arr[o + 3] = p.vy; arr[o + 4] = p.act;
    }
    snaps.current.set(eng.tick, arr);
    snaps.current.delete(eng.tick - 3000);
  };

  const segments = (): Seg[] => {
    const m = modeRef.current;
    if (m === 0) return [];
    const out: Seg[] = [];
    for (const e of eng.events) {
      if (m === 1 && e.imp < 1) continue;
      if (m === 2 && e.imp < 2) continue;
      if (m === 3) continue;
      if (['added', 'kickoff', 'sub', 'tactic', 'ht', 'ft', 'pens', 'pens_end', 'et'].includes(e.type)) continue;
      const goal = e.type === 'goal';
      const pre = goal ? 140 : m === 1 ? 110 : 90;
      const post = goal ? 70 : 35;
      out.push({ a: e.tick - pre, b: e.tick + post });
    }
    out.sort((x, y) => x.a - y.a);
    const merged: Seg[] = [];
    for (const s of out) {
      const l = merged[merged.length - 1];
      if (l && s.a <= l.b) l.b = Math.max(l.b, s.b); else merged.push({ ...s });
    }
    return merged;
  };

  // main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    snapshot();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const m = modeRef.current;
      if (!pausedRef.current && stageRef.current === 'play') {
        // run engine ahead
        const lead = m === 3 ? 60 : 240;
        let steps = 0;
        while (eng.tick < pt.current + lead && !eng.finished && eng.phase !== 'halftime' && steps < 4000) {
          eng.step();
          if (m !== 3) snapshot();
          steps++;
        }
        // advance playback
        let inSeg = m === 0;
        let nextStart = Infinity;
        if (m === 1 || m === 2) {
          for (const s of segments()) {
            if (pt.current >= s.a && pt.current < s.b) { inSeg = true; break; }
            if (s.a > pt.current) { nextStart = Math.min(nextStart, s.a); }
          }
        }
        let adv: number;
        if (m === 3) adv = dt * 2400;
        else if (inSeg) adv = dt * 10 * speedRef.current;
        else adv = dt * 2200;
        let target = pt.current + adv;
        if (!inSeg && m !== 3) target = Math.min(target, nextStart);
        target = Math.min(target, eng.tick);
        pt.current = target;
        setFf(!inSeg);
        // event triggers at playback time
        for (const e of eng.events) {
          if (e.tick > pt.current || handled.current.has(e.tick * 100 + e.type.length)) continue;
          if (e.type === 'goal' || e.type === 'red' || e.type === 'injury') {
            handled.current.add(e.tick * 100 + e.type.length);
            if (e.type === 'injury' && e.side === userSide) { setPausedBoth(true); setPanel('subs'); setToast('Травма! Сделайте замену.'); }
            if (e.type === 'red' && e.side === userSide) { setToast('Удаление! Перестройте тактику.'); }
          }
        }
        // halftime / fulltime
        if (eng.phase === 'halftime' && pt.current >= eng.tick - 0.5) { stageRef.current = 'ht'; setStage('ht'); }
        if (eng.finished && pt.current >= eng.tick - 0.5 && !finishedRef.current) { finishedRef.current = true; stageRef.current = 'ft'; setStage('ft'); }
      }
      // render
      if (r3d.current && m !== 3) {
        const t0 = Math.floor(pt.current), t1 = t0 + 1;
        const a = snaps.current.get(t0) || snaps.current.get(eng.tick), b = snaps.current.get(t1) || a;
        if (a && b) {
          const f = pt.current - t0;
          const list: any[] = [];
          for (let i = 0; i < eng.ps.length; i++) {
            const o = 4 + i * 5;
            if (o >= a.length) break;
            const ax = a[o];
            const p = eng.ps[i];
            const vis = !isNaN(ax);
            const bx = o < b.length && !isNaN(b[o]) ? b[o] : ax;
            const by = o < b.length && !isNaN(b[o]) ? b[o + 1] : a[o + 1];
            list.push({
              info: { idx: i, side: p.side, shirt: p.shirt, isGK: p.isGK, name: p.name },
              x: ax + (bx - ax) * f, y: a[o + 1] + (by - a[o + 1]) * f, vx: a[o + 2], vy: a[o + 3], act: a[o + 4], visible: vis,
            });
          }
          r3d.current.update(list, { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, z: a[2] + (b[2] - a[2]) * f }, dt);
        }
      }
      setFrame((x) => (x + 1) % 1000000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- derived display ----
  const shownEvents = eng.events.filter((e) => e.tick <= pt.current);
  const score = (() => {
    let h = 0, a = 0;
    for (const e of shownEvents) if (e.type === 'goal') { if (e.side === 0) h++; else a++; }
    return [h, a];
  })();
  const lastEv = shownEvents.slice(-4).reverse();
  const curMinute = (() => {
    // find minute at playback time from events/ticks
    const halfTicks = eng.half;
    void halfTicks;
    const e = shownEvents[shownEvents.length - 1];
    return e ? e.min : '1';
  })();
  const clockText = (() => {
    const t = pt.current;
    // approximate clock: use engine half starts
    const sec = estimateClock(eng, t);
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  })();
  void curMinute;
  const home = G.clubs[fx.home], away = G.clubs[fx.away];
  const holder = (() => {
    const a = snaps.current.get(Math.floor(pt.current));
    if (!a) return null;
    const o = a[3];
    if (o < 0 || !eng.ps[o]) return null;
    return eng.ps[o];
  })();

  const finish = () => {
    const res = eng.toResult();
    applyResult(fx, res);
    progressComp(G.comps[fx.comp]);
    // apply in-game condition
    for (const p of eng.ps) {
      const pl = G.players[p.pid];
      if (pl && (p.side === userSide)) pl.cond = Math.round(Math.min(pl.cond, p.cond * 100));
    }
    G.pendingMatch = undefined;
    refresh();
    onDone();
  };

  const teamTalk = (kind: number) => {
    const diff = score[userSide] - score[1 - userSide];
    for (const p of eng.onPitch(userSide)) {
      const pl = P(p.pid);
      let d = 0;
      if (kind === 0) d = diff >= 0 ? 3 : 1;
      if (kind === 1) d = diff < 0 ? 5 : -2;
      if (kind === 2) d = diff > 0 ? 6 : -3;
      if (kind === 3) d = diff < 0 ? (pl.hid[9] > 12 ? 6 : -4) : -6;
      pl.morale = Math.max(5, Math.min(100, pl.morale + d));
      const mf = 1 + d * 0.004;
      for (let i = 14; i < 28; i++) p.a[i] *= mf;
    }
    setToast(['Игроки спокойно восприняли ваши слова', 'Вы потребовали от команды большего', 'Вы похвалили игроков', 'Вы раскритиковали игроков'][kind]);
  };

  return (
    <div className="match">
      <div className="scorebar">
        <div className="tm right"><span className="ellipsis">{home.name}</span><Crest club={home} size={30} /></div>
        <div className="score">
          <div className="sc">{score[0]} : {score[1]}</div>
          <div className="clk">{clockText}{eng.shootout && stage === 'ft' ? ` · пен. ${eng.shootout.h}:${eng.shootout.a}` : ''}</div>
        </div>
        <div className="tm"><Crest club={away} size={30} /><span className="ellipsis">{away.name}</span></div>
      </div>
      <div className="view" ref={containerRef}>
        {mode === 3 && <TextView eng={eng} events={shownEvents} score={score} />}
        {mode !== 3 && ff && stage === 'play' && <div className="ff">⏩ {clockText}</div>}
        {mode !== 3 && !ff && holder && <div className="holder">{holder.shirt}. {holder.name}</div>}
        {paused && stage === 'play' && <div className="pausebig" onClick={() => setPausedBoth(false)}>⏸ Пауза — нажмите, чтобы продолжить</div>}
        {toast && <div className="mtoast" onAnimationEnd={() => setToast(null)}>{toast}</div>}
      </div>
      <div className="feed">
        {lastEv.map((e, i) => <div key={i} className={'fl imp' + e.imp + (i === 0 ? ' cur' : '')}><b>{e.min}'</b> {e.text}</div>)}
      </div>
      <div className="mctl">
        <button className="mb" onClick={() => setPausedBoth(!paused)}>{paused ? '▶' : '⏸'}</button>
        <button className="mb" onClick={() => setSpeedIdx((speedIdx + 1) % SPEEDS.length)}>{SPEEDS[speedIdx]}x</button>
        <select className="mb" value={mode} onChange={(e) => setMode(+e.target.value)}>{MODES.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
        {mode !== 3 && <button className="mb" onClick={() => setCam((cam + 1) % CAMS.length)}>🎥 {CAMS[cam]}</button>}
        {mode !== 3 && <button className="mb" onClick={() => { if (r3d.current) r3d.current.zoom = r3d.current.zoom > 0.75 ? r3d.current.zoom - 0.2 : 1.4; }}>🔍</button>}
        <div style={{ flex: 1 }} />
        <button className="mb" onClick={() => { setPanel(panel === 'tac' ? null : 'tac'); }}>📋 Тактика</button>
        <button className="mb" onClick={() => { setPanel(panel === 'subs' ? null : 'subs'); }}>🔄 Замены ({eng.teams[userSide].subsLeft})</button>
        <button className="mb" onClick={() => setPanel(panel === 'stats' ? null : 'stats')}>📊</button>
      </div>
      {panel === 'tac' && <TacticPanel eng={eng} side={userSide} onClose={() => setPanel(null)} />}
      {panel === 'subs' && <SubsPanel eng={eng} side={userSide} onClose={() => setPanel(null)} />}
      {panel === 'stats' && <StatsPanel eng={eng} onClose={() => setPanel(null)} />}
      {stage === 'ht' && (
        <div className="overlay">
          <div className="ovbox">
            <h2>{eng.half === 2 ? 'Конец основного времени' : 'Перерыв'} · {eng.teams[0].score}:{eng.teams[1].score}</h2>
            <StatsTable eng={eng} />
            <div className="small muted" style={{ margin: '8px 0 4px' }}>Установка на {eng.half === 1 ? 'второй тайм' : 'продолжение'}:</div>
            <div className="row wrap">
              {['Спокойно', 'Требовать большего', 'Похвалить', 'Раскритиковать'].map((t, i) => <button key={i} className="btn sm" onClick={() => teamTalk(i)}>{t}</button>)}
            </div>
            <div className="row wrap" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => setPanel('tac')}>📋 Тактика</button>
              <button className="btn" onClick={() => setPanel('subs')}>🔄 Замены</button>
              <div className="grow" />
              <button className="btn primary" onClick={() => { eng.resume(); stageRef.current = 'play'; setStage('play'); setPanel(null); }}>Продолжить ▶</button>
            </div>
          </div>
        </div>
      )}
      {stage === 'ft' && (
        <div className="overlay">
          <div className="ovbox">
            <h2>Финальный свисток</h2>
            <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
              <Crest club={home} size={44} /><div className="scoreline">{eng.teams[0].score}:{eng.teams[1].score}</div><Crest club={away} size={44} />
            </div>
            {eng.shootout && <div className="center">Серия пенальти: {eng.shootout.h}:{eng.shootout.a}</div>}
            <StatsTable eng={eng} />
            <Ratings eng={eng} />
            <div className="row" style={{ marginTop: 10 }}><div className="grow" /><button className="btn primary" onClick={finish}>Завершить матч</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function estimateClock(eng: MatchEngine, t: number): number {
  // reconstruct clock from event ticks: find last kickoff event before t
  let base = 0, startTick = 0;
  let halfIdx = 0;
  for (const e of eng.events) {
    if (e.tick > t) break;
    if (e.type === 'kickoff') { startTick = e.tick; base = [0, 0, 2700, 5400, 6300][++halfIdx] ?? 0; }
  }
  return base + (t - startTick) * TICK;
}

function TextView({ eng, events, score }: { eng: MatchEngine; events: MEvent[]; score: number[] }) {
  const list = events.filter((e) => e.imp >= 1 || e.type === 'flavor').slice(-34).reverse();
  return (
    <div className="textview">
      <div className="bigscore">{score[0]} : {score[1]}</div>
      {list.map((e, i) => <div key={i} className={'fl imp' + e.imp}><b>{e.min}'</b> {e.text}</div>)}
      {void eng}
    </div>
  );
}

function StatsTable({ eng }: { eng: MatchEngine }) {
  const a = eng.teams[0].stats, b = eng.teams[1].stats;
  const tp = a.poss + b.poss || 1;
  const rows: [string, number | string, number | string][] = [
    ['Владение', Math.round((a.poss / tp) * 100) + '%', Math.round((b.poss / tp) * 100) + '%'],
    ['Удары', a.shots, b.shots], ['В створ', a.sot, b.sot], ['xG', a.xg.toFixed(2), b.xg.toFixed(2)],
    ['Передачи', `${a.pc}/${a.pa}`, `${b.pc}/${b.pa}`], ['Угловые', a.corners, b.corners], ['Фолы', a.fouls, b.fouls],
    ['Офсайды', a.off, b.off], ['Жёлтые', a.yc, b.yc], ['Красные', a.rc, b.rc],
  ];
  return (
    <table className="t small"><tbody>
      {rows.map(([n, x, y]) => <tr key={n}><td className="right" style={{ width: '35%' }}><b>{x}</b></td><td className="center muted">{n}</td><td style={{ width: '35%' }}><b>{y}</b></td></tr>)}
    </tbody></table>
  );
}

function Ratings({ eng }: { eng: MatchEngine }) {
  const res = eng.toResult();
  return (
    <div className="grid g2 small" style={{ marginTop: 8 }}>
      {[0, 1].map((s) => (
        <div key={s}>
          {Array.from(res.ratings[s].entries()).sort((x, y) => y[1] - x[1]).map(([pid, r]) => (
            <div key={pid} className="row"><span className="grow ellipsis">{fullName(P(pid))}{res.potm === pid ? ' ⭐' : ''}</span><b className={r >= 7.5 ? 'ok' : r < 6 ? 'bad' : ''}>{r.toFixed(1)}</b></div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatsPanel({ eng, onClose }: { eng: MatchEngine; onClose: () => void }) {
  return (
    <div className="mpanel">
      <div className="mph"><b>Статистика</b><button className="iconbtn" onClick={onClose}>✕</button></div>
      <StatsTable eng={eng} />
      <h3 style={{ marginTop: 10 }}>Оценки (текущие)</h3>
      {[0, 1].map((s) => (
        <div key={s} style={{ marginBottom: 8 }}>
          <div className="small muted">{eng.teams[s].club.name}</div>
          {eng.onPitch(s).sort((a, b) => b.rating - a.rating).map((p) => (
            <div key={p.i} className="row small"><span className="grow ellipsis">{p.shirt}. {p.name}</span><span style={{ width: 50 }}><Bar v={p.cond * 100} color={condColor(p.cond * 100)} /></span><b>{shownRating(p.rating).toFixed(1)}</b></div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SubsPanel({ eng, side, onClose }: { eng: MatchEngine; side: number; onClose: () => void }) {
  const [out, setOut] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const t = eng.teams[side];
  const on = eng.onPitch(side);
  const bench = eng.bench[side].map((id) => G.players[id]).filter(Boolean) as any[];
  return (
    <div className="mpanel">
      <div className="mph"><b>Замены (осталось {t.subsLeft})</b><button className="iconbtn" onClick={onClose}>✕</button></div>
      {msg && <div className="chip b">{msg}</div>}
      <div className="small muted">1) Выберите игрока на поле</div>
      {on.map((p) => (
        <div key={p.i} className={'subrow' + (out === p.pid ? ' sel' : '')} onClick={() => setOut(p.pid)}>
          <span className="pos D" style={{ minWidth: 30 }}>{POS_RU[p.pos]}</span>
          <span className="grow ellipsis">{p.shirt}. {p.name}{p.injured ? ' 🚑' : ''}{p.yellow ? ' 🟨' : ''}</span>
          <span style={{ width: 50 }}><Bar v={p.cond * 100} color={condColor(p.cond * 100)} /></span>
          <b>{shownRating(p.rating).toFixed(1)}</b>
        </div>
      ))}
      <div className="small muted" style={{ marginTop: 6 }}>2) Выберите, кто выйдет</div>
      {bench.map((p) => (
        <div key={p.id} className="subrow" onClick={() => {
          if (out == null) { setMsg('Сначала выберите игрока на поле'); return; }
          const r = eng.makeSub(side, out, p.id);
          setMsg(r || `${p.ln} выходит на поле`);
          setOut(null);
        }}>
          <span className="grow ellipsis">{p.shirt}. {fullName(p)}</span>
          <span className="small muted">{p.pos.map((v: number, i: number) => (v >= 15 ? POS_RU[['GK', 'DL', 'DC', 'DR', 'WBL', 'WBR', 'DM', 'ML', 'MC', 'MR', 'AML', 'AMC', 'AMR', 'ST'][i] as keyof typeof POS_RU] : null)).filter(Boolean).slice(0, 2).join('/')}</span>
        </div>
      ))}
    </div>
  );
}

function TacticPanel({ eng, side, onClose }: { eng: MatchEngine; side: number; onClose: () => void }) {
  const [tac, setTac] = useState<Tactic>(() => JSON.parse(JSON.stringify(eng.teams[side].tactic)));
  const ti = tac.ti;
  const set = (patch: Partial<typeof ti>) => setTac({ ...tac, ti: { ...ti, ...patch } });
  const apply = () => { eng.setTactic(side, tac); onClose(); };
  return (
    <div className="mpanel">
      <div className="mph"><b>Тактика</b><button className="iconbtn" onClick={onClose}>✕</button></div>
      <div className="field"><label>Схема</label>
        <select className="input" value={tac.formation} onChange={(e) => { const nt = makeTactic(e.target.value); setTac({ ...nt, ti }); }}>
          {FORMATION_KEYS.map((f) => <option key={f}>{f}</option>)}
        </select>
      </div>
      <div className="field"><label>Менталитет: {MENTALITY[ti.mentality]}</label><input type="range" min={0} max={6} value={ti.mentality} onChange={(e) => set({ mentality: +e.target.value })} /></div>
      <div className="field"><label>Пас</label><Seg options={PASSING} value={ti.passing} onChange={(v) => set({ passing: v })} /></div>
      <div className="field"><label>Темп</label><Seg options={TEMPO} value={ti.tempo} onChange={(v) => set({ tempo: v })} /></div>
      <div className="field"><label>Ширина</label><Seg options={WIDTH} value={ti.width} onChange={(v) => set({ width: v })} /></div>
      <div className="field"><label>Линия обороны</label><Seg options={DLINE} value={ti.dline} onChange={(v) => set({ dline: v })} /></div>
      <div className="field"><label>Линия прессинга</label><Seg options={LOE} value={ti.loe} onChange={(v) => set({ loe: v })} /></div>
      <div className="field"><label>Прессинг</label><Seg options={PRESS} value={ti.press} onChange={(v) => set({ press: v })} /></div>
      <div className="field"><label>Отбор</label><Seg options={TACKLE} value={ti.tackle} onChange={(v) => set({ tackle: v })} /></div>
      <label className="row small"><input type="checkbox" checked={ti.shootOnSight} onChange={(e) => set({ shootOnSight: e.target.checked })} /> Бить при любой возможности</label>
      <label className="row small"><input type="checkbox" checked={ti.counter} onChange={(e) => set({ counter: e.target.checked })} /> Контратаки</label>
      <label className="row small"><input type="checkbox" checked={ti.timeWaste} onChange={(e) => set({ timeWaste: e.target.checked })} /> Тянуть время</label>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={() => set({ mentality: 6, tempo: 4, press: 3, dline: 4, loe: 2 })}>Всё в атаку!</button>
        <button className="btn sm" onClick={() => set({ mentality: 0, tempo: 0, press: 0, dline: 0, loe: 0, timeWaste: true })}>Удержать счёт</button>
        <div className="grow" />
        <button className="btn primary" onClick={apply}>Применить</button>
      </div>
      {void FORMATIONS}
    </div>
  );
}
