import React, { useState } from 'react';
import { G, IDX } from '../../engine/state';
import { useNav, Crest, Flag, Stars, Tabs, PosBadge, Bar, condColor } from '../common';
import { ASSOCS, NATION, LEAGUE_DEF } from '../../data/nations';
import { age, fullName, seasonAvg } from '../../engine/player';
import { fmtMoney, fmtDate } from '../../engine/util';
import { standings } from '../../engine/comps';
import { leagueComp } from '../../engine/board';
import { FORMATIONS } from '../../engine/tactics';
import { assocCoef } from '../../engine/coef';
import { knowledge } from '../../engine/scouting';

export function WorldScreen() {
  const nav = useNav();
  const [country, setCountry] = useState(G.user >= 0 ? G.clubs[G.user].country : 'ENG');
  const [tab, setTab] = useState('clubs');
  const a = ASSOCS.find((x) => x.code === country)!;
  const rank = Object.values(G.countries).sort((x, y) => x.rank - y.rank);
  return (
    <div>
      <h1>Мир футбола</h1>
      <Tabs tabs={[['clubs', 'Клубы по странам'], ['rank', 'Рейтинг ассоциаций УЕФА']]} value={tab} onChange={setTab} />
      {tab === 'clubs' && <>
        <select className="input" style={{ width: 'auto', marginBottom: 10 }} value={country} onChange={(e) => setCountry(e.target.value)}>
          {ASSOCS.map((x) => <option key={x.code} value={x.code}>{NATION[x.code]?.name}</option>)}
        </select>
        {a.leagues.map((ld) => (
          <div className="panel" key={ld.id}>
            <div className="ph">{ld.name}</div>
            <div className="pb cardlist">
              {G.clubs.filter((c) => c.league === ld.id).sort((x, y) => y.rep - x.rep).map((c) => (
                <div key={c.id} className="clubcard" onClick={() => nav.openClub(c.id)}>
                  <Crest club={c} size={30} />
                  <div className="grow ellipsis">{c.name}<div className="tiny muted"><Stars value={Math.max(0.5, Math.round(c.rep / 10) / 2)} /></div></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </>}
      {tab === 'rank' && (
        <div className="panel tscroll"><table className="t">
          <thead><tr><th>#</th><th>Ассоциация</th><th className="num">Сезоны (5 лет)</th><th className="num">Итого</th></tr></thead>
          <tbody>{rank.map((c) => (
            <tr key={c.code} className={G.user >= 0 && G.clubs[G.user].country === c.code ? 'me' : ''}>
              <td>{c.rank}</td><td><span className="row"><Flag code={c.code} size={12} />{NATION[c.code]?.name}</span></td>
              <td className="num small muted">{c.coef.map((x) => x.toFixed(1)).join(' · ')}</td><td className="num"><b>{assocCoef(c.code).toFixed(2)}</b></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

export function ClubView({ id }: { id: number }) {
  const nav = useNav();
  const [tab, setTab] = useState('squad');
  const c = G.clubs[id];
  if (!c) return null;
  const ps = c.players.map((pid) => G.players[pid]!).filter(Boolean).sort((a, b) => b.ca - a.ca);
  const lc = leagueComp(c);
  const pos = lc ? standings(lc).indexOf(c.id) + 1 : 0;
  const fx = (IDX.clubFx.get(id) || []).map((fid) => G.fixtures[fid]).filter(Boolean).sort((a, b) => a.day - b.day);
  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <Crest club={c} size={64} />
        <div className="grow">
          <h1 style={{ margin: 0 }}>{c.name}</h1>
          <div className="small muted"><Flag code={c.country} size={12} /> {c.league ? LEAGUE_DEF[c.league].name : 'Низшие лиги'}{pos ? ` · ${pos}-е место` : ''} · {c.stadium}</div>
          <div className="small">Тренер: {c.mgr} · Схема: {c.tactic.formation} · <Stars value={Math.max(0.5, Math.round(c.rep / 10) / 2)} /></div>
        </div>
      </div>
      <Tabs tabs={[['squad', 'Состав'], ['fixtures', 'Матчи'], ['info', 'Информация']]} value={tab} onChange={setTab} />
      {tab === 'squad' && (
        <div className="panel tscroll"><table className="t">
          <thead><tr><th>Поз</th><th>Игрок</th><th>Возр</th><th>Уровень</th><th className="num">Игры</th><th className="num">Голы</th><th className="num">Ср.</th><th className="num">Стоимость</th><th>Контракт</th></tr></thead>
          <tbody>{ps.map((p) => (
            <tr key={p.id} className="click" onClick={() => nav.openPlayer(p.id)}>
              <td><PosBadge p={p} /></td>
              <td><span className="row"><Flag code={p.nat} size={12} />{fullName(p)} {p.listed ? <span className="chip y tiny">{p.listed === 1 ? 'ТР' : 'АР'}</span> : null} {p.inj && p.inj.until > G.day ? <span className="chip r tiny">🚑</span> : null}</span></td>
              <td>{age(p)}</td><td><Stars ca={p.ca} /></td>
              <td className="num">{p.st.apps + p.st.sub}</td><td className="num">{p.st.gls}</td><td className="num">{seasonAvg(p) ? seasonAvg(p).toFixed(2) : '—'}</td>
              <td className="num">{knowledge(p) >= 60 ? fmtMoney(p.value) : '?'}</td><td className="small">{fmtDate(p.cEnd)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {tab === 'fixtures' && (
        <div className="panel tscroll"><table className="t"><tbody>
          {fx.map((f) => (
            <tr key={f.id}><td className="small muted">{fmtDate(f.day)}</td><td className="small">{G.comps[f.comp]?.short}</td><td className="right">{G.clubs[f.home].name}</td><td className="center"><b>{f.played ? `${f.hg}:${f.ag}` : '—'}</b></td><td>{G.clubs[f.away].name}</td></tr>
          ))}
        </tbody></table></div>
      )}
      {tab === 'info' && (
        <div className="panel"><div className="pb kv">
          <span>Стадион</span><span>{c.stadium} ({c.cap} тыс.)</span>
          <span>Баланс</span><span>{fmtMoney(c.fin.balance)}</span>
          <span>Трансферный бюджет</span><span>{fmtMoney(c.fin.tBudget)}</span>
          <span>База / академия</span><span>{c.facT}/20 · {c.facY}/20</span>
          <span>Коэффициент УЕФА</span><span>{(c.coef.reduce((s, x) => s + x, 0) + (c.coefCur || 0)).toFixed(1)}</span>
          <span>Игроков</span><span>{ps.length}</span>
        </div></div>
      )}
    </div>
  );
}
export { FORMATIONS, Bar, condColor };
