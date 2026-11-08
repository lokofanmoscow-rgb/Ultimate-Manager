import React, { useState } from 'react';
import { G } from '../../engine/state';
import { useNav, Crest, Seg, refresh, Stars } from '../common';
import { TacticsScreen, ensureSelection } from './Tactics';
import { fmtDate } from '../../engine/util';
import { teamRatings, autoPick } from '../../engine/tactics';
import { standings } from '../../engine/comps';
import { leagueComp } from '../../engine/board';
import { compName } from './Home';
import { isAvailable } from '../../engine/player';
import { compTypeOf } from '../../engine/tactics';

export const MODES = ['Полный матч', 'Расширенные моменты', 'Ключевые моменты', 'Только текст'];

export function PreMatch({ fxId, onStart }: { fxId: number; onStart: (mode: number) => void }) {
  const nav = useNav();
  const f = G.fixtures[fxId];
  const [mode, setMode] = useState(G.settings.mode);
  if (!f) return null;
  const club = G.clubs[G.user];
  const oppId = f.home === G.user ? f.away : f.home;
  const opp = G.clubs[oppId];
  const sel = ensureSelection(club);
  const ct = compTypeOf(f.comp);
  const unavailable = sel.lineup.filter((id) => !id || !G.players[id] || !isAvailable(G.players[id]!, ct) || G.players[id]!.club !== G.user);
  const oppSel = autoPick(opp, ct, { rotate: false });
  const r1 = teamRatings(club, sel), r2 = teamRatings(opp, oppSel);
  const lc = leagueComp(opp);
  const oppPos = lc ? standings(lc).indexOf(oppId) + 1 : 0;
  const start = () => {
    if (unavailable.length) {
      if (!confirm('В составе есть недоступные игроки. Ассистент заменит их. Продолжить?')) return;
      club.sel = { ...autoPick(club, ct, { rotate: false }), auto: false };
    }
    G.settings.mode = mode;
    refresh();
    onStart(mode);
  };
  return (
    <div>
      <div className="panel"><div className="pb">
        <div className="center small muted">{compName(f)} · {f.stage} · {fmtDate(f.day)} · {f.neutral ? 'нейтральное поле' : G.clubs[f.home].stadium}</div>
        <div className="row" style={{ justifyContent: 'center', gap: 20, margin: '10px 0' }}>
          <div className="col center" style={{ alignItems: 'center', width: 140 }}><Crest club={G.clubs[f.home]} size={64} /><b>{G.clubs[f.home].name}</b></div>
          <div className="big">VS</div>
          <div className="col center" style={{ alignItems: 'center', width: 140 }}><Crest club={G.clubs[f.away]} size={64} /><b>{G.clubs[f.away].name}</b></div>
        </div>
        <div className="grid g2 small">
          <div className="kv">
            <span>Сила атаки</span><span><Stars value={Math.max(0.5, Math.min(5, Math.round(((r1.att - 40) / 30) * 2) / 2))} /></span>
            <span>Сила обороны</span><span><Stars value={Math.max(0.5, Math.min(5, Math.round(((r1.def - 40) / 30) * 2) / 2))} /></span>
          </div>
          <div className="kv">
            <span>Соперник: атака</span><span><Stars value={Math.max(0.5, Math.min(5, Math.round(((r2.att - 40) / 30) * 2) / 2))} /></span>
            <span>Соперник: оборона</span><span><Stars value={Math.max(0.5, Math.min(5, Math.round(((r2.def - 40) / 30) * 2) / 2))} /></span>
            <span>Схема соперника</span><span>{opp.tactic.formation}{oppPos ? ` · ${oppPos}-е место` : ''}</span>
          </div>
        </div>
        <hr />
        <div className="field"><label>Режим просмотра</label><Seg options={MODES} value={mode} onChange={setMode} /></div>
        {unavailable.length > 0 && <div className="chip r" style={{ marginBottom: 8 }}>В стартовом составе есть травмированные/дисквалифицированные игроки</div>}
        <div className="row"><div className="grow" /><button className="continue mday" onClick={start}>⚽ Начать матч</button></div>
      </div></div>
      <TacticsScreen embedded />
    </div>
  );
}
