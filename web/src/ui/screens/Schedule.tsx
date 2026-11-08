import React, { useState } from 'react';
import { G, IDX } from '../../engine/state';
import { useNav, ClubName, Modal, Crest, PlayerName } from '../common';
import { fmtDate, wdShort } from '../../engine/util';
import type { Fixture } from '../../engine/types';
import { EV } from '../../engine/quicksim';

export function ScheduleScreen() {
  const [fx, setFx] = useState<Fixture | null>(null);
  if (G.user < 0) return <div className="muted">Нет клуба</div>;
  const list = (IDX.clubFx.get(G.user) || []).map((id) => G.fixtures[id]).filter(Boolean).sort((a, b) => a.day - b.day);
  return (
    <div>
      <h1>Расписание матчей</h1>
      <div className="panel tscroll"><table className="t">
        <thead><tr><th>Дата</th><th>Турнир</th><th>Соперник</th><th>Д/Г</th><th>Счёт</th></tr></thead>
        <tbody>
          {list.map((f) => {
            const home = f.home === G.user;
            const opp = home ? f.away : f.home;
            const comp = G.comps[f.comp];
            let cls = '';
            if (f.played) {
              const gf = home ? f.hg : f.ag, ga = home ? f.ag : f.hg;
              cls = gf > ga || (gf === ga && f.ph != null && (home ? f.ph > f.pa! : f.pa! > f.ph)) ? 'ok' : gf < ga || f.ph != null ? 'bad' : '';
            }
            return (
              <tr key={f.id} className={'click' + (f.day === G.day ? ' me' : '')} onClick={() => f.played && setFx(f)}>
                <td className="small nowrap">{wdShort(f.day)} {fmtDate(f.day)}</td>
                <td className="small">{comp?.short || comp?.name} <span className="muted">· {f.stage}</span></td>
                <td><ClubName id={opp} size={16} /></td>
                <td>{f.neutral ? 'Н' : home ? 'Д' : 'Г'}</td>
                <td className={cls}><b>{f.played ? `${f.hg}:${f.ag}${f.et ? ' д.в.' : ''}${f.ph != null ? ` (пен. ${f.ph}:${f.pa})` : ''}` : '—'}</b></td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      {fx && <MatchReport f={fx} onClose={() => setFx(null)} />}
    </div>
  );
}

export function MatchReport({ f, onClose }: { f: Fixture; onClose: () => void }) {
  const ev = f.ev || [];
  const rows: { min: number; t: number; pid: number; s: number }[] = [];
  for (let i = 0; i < ev.length; i += 4) rows.push({ min: ev[i], t: ev[i + 1], pid: ev[i + 2], s: ev[i + 3] });
  rows.sort((a, b) => a.min - b.min);
  const icon: Record<number, string> = { [EV.GOAL]: '⚽', [EV.PEN]: '⚽ (пен.)', [EV.OWN]: '⚽ (автогол)', [EV.YEL]: '🟨', [EV.RED]: '🟥', [EV.INJ]: '🚑', [EV.AST]: '👟', [EV.SUB]: '🔄' };
  const ratings = (arr?: number[]) => {
    const out: [number, number][] = [];
    if (arr) for (let i = 0; i < arr.length; i += 2) out.push([arr[i], arr[i + 1] / 10]);
    return out.sort((a, b) => b[1] - a[1]);
  };
  const st = f.stats;
  return (
    <Modal title={`${G.comps[f.comp]?.name || ''} · ${f.stage}`} onClose={onClose}>
      <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
        <div className="col center" style={{ alignItems: 'center', width: 110 }}><Crest club={G.clubs[f.home]} size={44} /><div className="small">{G.clubs[f.home].name}</div></div>
        <div className="scoreline">{f.hg}:{f.ag}</div>
        <div className="col center" style={{ alignItems: 'center', width: 110 }}><Crest club={G.clubs[f.away]} size={44} /><div className="small">{G.clubs[f.away].name}</div></div>
      </div>
      {f.ph != null && <div className="center small">Серия пенальти {f.ph}:{f.pa}</div>}
      <div className="center small muted">{fmtDate(f.day)}{f.att ? ` · Зрителей: ${f.att.toLocaleString('ru-RU')}` : ''}</div>
      <hr />
      {rows.filter((r) => r.t !== EV.SUB && r.t !== EV.AST).map((r, i) => (
        <div key={i} className="row small" style={{ justifyContent: r.s === 0 ? 'flex-start' : 'flex-end' }}>
          <span className="muted">{r.min}'</span> {icon[r.t]} <PlayerName id={r.pid} />
        </div>
      ))}
      {st && st.length > 0 && <>
        <hr />
        <div className="kv small" style={{ gridTemplateColumns: '1fr auto 1fr', textAlign: 'center' }}>
          <span>{st[0]}%</span><span className="muted">Владение</span><span>{100 - st[0]}%</span>
          <span>{st[1]}</span><span className="muted">Удары</span><span>{st[2]}</span>
          <span>{st[3]}</span><span className="muted">В створ</span><span>{st[4]}</span>
          <span>{(st[5] / 100).toFixed(2)}</span><span className="muted">xG</span><span>{(st[6] / 100).toFixed(2)}</span>
        </div>
      </>}
      {(f.rh || f.ra) && <>
        <hr />
        <div className="grid g2 small">
          {[f.rh, f.ra].map((arr, k) => <div key={k}>{ratings(arr).map(([pid, r]) => <div key={pid} className="row"><span className="grow"><PlayerName id={pid} /></span><b>{r.toFixed(1)}</b></div>)}</div>)}
        </div>
      </>}
    </Modal>
  );
}
