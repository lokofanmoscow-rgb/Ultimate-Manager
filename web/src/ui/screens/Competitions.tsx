import React, { useState } from 'react';
import { G } from '../../engine/state';
import { useNav, ClubName, Tabs, Form, Flag, PlayerName } from '../common';
import { standings } from '../../engine/comps';
import { lpStandings } from '../../engine/euro';
import { LEAGUE_DEF, ASSOCS, NATION } from '../../data/nations';
import { fmtDate } from '../../engine/util';
import type { Comp, Fixture } from '../../engine/types';
import { MatchReport } from './Schedule';
import { seasonLabel } from '../../engine/game';

function userComps(): Comp[] {
  if (G.user < 0) return [];
  return Object.values(G.comps).filter((c) => c.clubs.includes(G.user) && !(c.done && c.season < G.season)).sort((a, b) => order(a) - order(b));
}
const order = (c: Comp) => ({ league: 0, cup: 1, euro: 2, super: 3, po: 4 } as any)[c.kind] ?? 5;

export function CompetitionsScreen({ compId }: { compId?: string }) {
  const [cid, setCid] = useState<string | null>(compId || userComps()[0]?.id || null);
  const [country, setCountry] = useState<string>(G.user >= 0 ? G.clubs[G.user].country : 'ENG');
  const comp = cid ? G.comps[cid] : null;
  const countryComps = Object.values(G.comps).filter((c) => c.country === country && c.kind !== 'po').sort((a, b) => b.season - a.season || order(a) - order(b) || (a.tier ?? 0) - (b.tier ?? 0));
  const euro = Object.values(G.comps).filter((c) => c.kind === 'euro').sort((a, b) => b.season - a.season);
  return (
    <div>
      <div className="row wrap" style={{ marginBottom: 8, gap: 6 }}>
        {userComps().map((c) => <button key={c.id} className={'btn sm' + (cid === c.id ? ' on' : '')} onClick={() => setCid(c.id)}>{c.name}</button>)}
      </div>
      <div className="row wrap" style={{ marginBottom: 8, gap: 6 }}>
        <select className="input" style={{ width: 'auto' }} value={country} onChange={(e) => setCountry(e.target.value)}>
          {ASSOCS.map((a) => <option key={a.code} value={a.code}>{NATION[a.code]?.name}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={cid || ''} onChange={(e) => setCid(e.target.value)}>
          <option value="">— турнир —</option>
          {countryComps.map((c) => <option key={c.id} value={c.id}>{c.name} {seasonLabel(c)}</option>)}
          {euro.map((c) => <option key={c.id} value={c.id}>{c.name} {c.season}/{(c.season + 1) % 100}</option>)}
        </select>
      </div>
      {comp ? <CompView comp={comp} /> : <div className="muted">Выберите турнир</div>}
    </div>
  );
}

function CompView({ comp }: { comp: Comp }) {
  const [tab, setTab] = useState(comp.kind === 'league' ? 'table' : comp.kind === 'euro' ? (comp.lp ? 'lp' : 'rounds') : 'rounds');
  const tabs: [string, string][] = [];
  if (comp.kind === 'league') tabs.push(['table', 'Таблица'], ['fixtures', 'Матчи']);
  if (comp.kind === 'euro' && comp.lp) tabs.push(['lp', 'Общий этап']);
  if (comp.kind !== 'league') tabs.push(['rounds', 'Сетка и матчи']);
  tabs.push(['scorers', 'Бомбардиры'], ['honours', 'Победители']);
  return (
    <div>
      <h1>{comp.name} <span className="muted small">{comp.kind === 'euro' ? `${comp.season}/${(comp.season + 1) % 100}` : seasonLabel(comp)}</span></h1>
      {comp.done && comp.winner != null && <div className="chip g" style={{ marginBottom: 8 }}>🏆 Победитель: {G.clubs[comp.winner].name}</div>}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'table' && <LeagueTable comp={comp} />}
      {tab === 'fixtures' && <LeagueFixtures comp={comp} />}
      {tab === 'lp' && comp.lp && <LPTable comp={comp} />}
      {tab === 'rounds' && <Rounds comp={comp} />}
      {tab === 'scorers' && <Scorers comp={comp} />}
      {tab === 'honours' && <Honours comp={comp} />}
    </div>
  );
}

function zones(comp: Comp, n: number): string[] {
  const ld = LEAGUE_DEF[comp.def];
  const z = new Array(n).fill('');
  if (!ld) return z;
  if (ld.tier === 1) {
    const r = G.countries[ld.country].rank;
    const cl = r <= 4 ? 4 : r <= 6 ? 3 : r <= 15 ? 2 : 1;
    const el = r <= 6 ? 1 : r <= 15 ? 1 : 0;
    const ecl = r <= 15 ? 1 : 2;
    let i = 0;
    for (let k = 0; k < cl; k++) z[i++] = 'zone-cl';
    for (let k = 0; k < el; k++) z[i++] = 'zone-el';
    for (let k = 0; k < ecl; k++) z[i++] = 'zone-ecl';
  } else {
    for (let k = 0; k < ld.up; k++) z[k] = 'zone-up';
    if (ld.upPO) { const [a, b] = ld.upPO.split(':')[0].split('-').map(Number); for (let k = a - 1; k < b; k++) z[k] = 'zone-po'; }
  }
  for (let k = 0; k < ld.down; k++) z[n - 1 - k] = 'zone-down';
  if (ld.rpo) for (const s of ld.rpo.split(',')) { const u = parseInt(s.split('v')[0], 10); z[u - 1] = 'zone-po'; }
  return z;
}

function LeagueTable({ comp }: { comp: Comp }) {
  const order = standings(comp);
  const z = zones(comp, order.length);
  const t = comp.table!;
  let groupStart = new Set<number>();
  if (comp.groups && comp.stage === 2) { let k = 0; for (const g of comp.groups) { groupStart.add(k); k += g.length; } }
  return (
    <div className="panel tscroll">
      <table className="t">
        <thead><tr><th>#</th><th>Клуб</th><th className="num">И</th><th className="num">В</th><th className="num">Н</th><th className="num">П</th><th className="num">Мячи</th><th className="num">РМ</th><th className="num">О</th><th>Форма</th></tr></thead>
        <tbody>
          {order.map((cid, i) => {
            const r = t[cid];
            return (
              <tr key={cid} className={(cid === G.user ? 'me ' : '') + z[i]} style={groupStart.has(i) && i > 0 ? { borderTop: '2px solid var(--gold)' } : undefined}>
                <td>{i + 1}</td><td><ClubName id={cid} size={18} /></td>
                <td className="num">{r.p}</td><td className="num">{r.w}</td><td className="num">{r.d}</td><td className="num">{r.l}</td>
                <td className="num">{r.gf}:{r.ga}</td><td className="num">{r.gf - r.ga}</td><td className="num"><b>{r.pts}</b>{r.ded ? <span className="tiny muted"> (−{r.ded})</span> : null}</td>
                <td><Form s={r.form} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="pb tiny muted">Синий — Лига чемпионов, оранжевый — Лига Европы, зелёный — Лига конференций/повышение, фиолетовый — плей-офф/стыки, красный — вылет.{comp.groups ? ' После разделения команды играют в своих группах.' : ''}</div>
    </div>
  );
}

function FixtureRow({ f, onOpen }: { f: Fixture; onOpen: (f: Fixture) => void }) {
  return (
    <tr className={'click' + (f.home === G.user || f.away === G.user ? ' me' : '')} onClick={() => f.played && onOpen(f)}>
      <td className="small nowrap muted">{fmtDate(f.day).replace(/ \d{4}$/, '')}</td>
      <td className="right"><ClubName id={f.home} size={16} /></td>
      <td className="center nowrap"><b>{f.played ? `${f.hg}:${f.ag}` : '—'}</b>{f.ph != null ? <span className="tiny muted"> (п. {f.ph}:{f.pa})</span> : null}{f.et ? <span className="tiny muted"> д.в.</span> : null}</td>
      <td><ClubName id={f.away} size={16} /></td>
    </tr>
  );
}

function LeagueFixtures({ comp }: { comp: Comp }) {
  const all = (Object.values(G.fixtures) as Fixture[]).filter((f) => f.comp === comp.id);
  const rounds = Array.from(new Set(all.map((f) => f.rnd))).sort((a, b) => a - b);
  const cur = all.filter((f) => !f.played).sort((a, b) => a.day - b.day)[0]?.rnd ?? rounds[rounds.length - 1];
  const [rnd, setRnd] = useState(cur || 1);
  const [fx, setFx] = useState<Fixture | null>(null);
  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn sm" onClick={() => setRnd(Math.max(rounds[0] ?? 1, rnd - 1))}>←</button>
        <b>Тур {rnd}</b>
        <button className="btn sm" onClick={() => setRnd(Math.min(rounds[rounds.length - 1] ?? 1, rnd + 1))}>→</button>
      </div>
      <div className="panel tscroll"><table className="t"><tbody>
        {all.filter((f) => f.rnd === rnd).sort((a, b) => a.day - b.day).map((f) => <FixtureRow key={f.id} f={f} onOpen={setFx} />)}
      </tbody></table></div>
      {fx && <MatchReport f={fx} onClose={() => setFx(null)} />}
    </div>
  );
}

function LPTable({ comp }: { comp: Comp }) {
  const order = lpStandings(comp);
  const t = comp.lp!.table;
  return (
    <div className="panel tscroll"><table className="t">
      <thead><tr><th>#</th><th>Клуб</th><th className="num">И</th><th className="num">В</th><th className="num">Н</th><th className="num">П</th><th className="num">Мячи</th><th className="num">О</th></tr></thead>
      <tbody>
        {order.map((cid, i) => {
          const r = t[cid];
          return (
            <tr key={cid} className={(cid === G.user ? 'me ' : '') + (i < 8 ? 'zone-cl' : i < 24 ? 'zone-el' : 'zone-down')}>
              <td>{i + 1}</td><td><span className="row"><Flag code={G.clubs[cid].country} size={11} /><ClubName id={cid} size={16} /></span></td>
              <td className="num">{r.p}</td><td className="num">{r.w}</td><td className="num">{r.d}</td><td className="num">{r.l}</td><td className="num">{r.gf}:{r.ga}</td><td className="num"><b>{r.pts}</b></td>
            </tr>
          );
        })}
      </tbody>
    </table><div className="pb tiny muted">1–8 места — сразу в 1/8 финала, 9–24 — стыковые матчи плей-офф, 25–36 — выбывают.</div></div>
  );
}

function Rounds({ comp }: { comp: Comp }) {
  const [fx, setFx] = useState<Fixture | null>(null);
  const rounds = (comp.rounds || []).filter((r) => r.drawn);
  const lpFx = comp.kind === 'euro' && comp.lp ? (Object.values(G.fixtures) as Fixture[]).filter((f) => f.comp === comp.id && f.grp === -1 && (f.home === G.user || f.away === G.user)) : [];
  return (
    <div>
      {lpFx.length > 0 && (
        <div className="panel"><div className="ph">Мои матчи общего этапа</div><table className="t"><tbody>{lpFx.sort((a, b) => a.day - b.day).map((f) => <FixtureRow key={f.id} f={f} onOpen={setFx} />)}</tbody></table></div>
      )}
      {rounds.slice().reverse().map((r, ri) => {
        const ties = (comp.ties || []).filter((t) => t.round === r.name && t.b >= 0);
        const byes = (comp.ties || []).filter((t) => t.round === r.name && t.b < 0).length;
        return (
          <div key={ri} className="panel">
            <div className="ph">{r.name}<span className="r small">{r.days.map((d) => fmtDate(d).replace(/ \d{4}$/, '')).join(' / ')}{byes ? ` · ${byes} без игры` : ''}</span></div>
            <div className="tscroll"><table className="t"><tbody>
              {ties.map((t) => (
                <React.Fragment key={t.id}>
                  {t.fx.map((id) => G.fixtures[id]).filter(Boolean).map((f) => <FixtureRow key={f.id} f={f} onOpen={setFx} />)}
                  {t.legs === 2 && t.winner != null && <tr><td colSpan={4} className="tiny muted center">Проходит: {G.clubs[t.winner].name}</td></tr>}
                </React.Fragment>
              ))}
              {!ties.length && <tr><td className="muted">Матчей нет</td></tr>}
            </tbody></table></div>
          </div>
        );
      })}
      {!rounds.length && <div className="muted">Жеребьёвка ещё не проводилась</div>}
      {fx && <MatchReport f={fx} onClose={() => setFx(null)} />}
    </div>
  );
}

function Scorers({ comp }: { comp: Comp }) {
  const nav = useNav();
  const list = Object.entries(comp.scorers).map(([pid, v]) => ({ pid: +pid, g: v[0], a: v[1], apps: v[2] })).filter((x) => x.g > 0 || x.a > 0).sort((a, b) => b.g - a.g || b.a - a.a).slice(0, 30);
  return (
    <div className="panel tscroll"><table className="t">
      <thead><tr><th>#</th><th>Игрок</th><th>Клуб</th><th className="num">Голы</th><th className="num">Пасы</th><th className="num">Игры</th></tr></thead>
      <tbody>{list.map((x, i) => {
        const p = G.players[x.pid];
        return <tr key={x.pid} className="click" onClick={() => p && nav.openPlayer(x.pid)}><td>{i + 1}</td><td><PlayerName id={x.pid} /></td><td>{p && p.club >= 0 ? <ClubName id={p.club} size={16} /> : '—'}</td><td className="num"><b>{x.g}</b></td><td className="num">{x.a}</td><td className="num">{x.apps}</td></tr>;
      })}</tbody>
    </table></div>
  );
}

function Honours({ comp }: { comp: Comp }) {
  const key = comp.kind === 'league' ? comp.def : comp.kind === 'cup' ? `${comp.country}:${comp.def}` : comp.def;
  const list = (G.honours[key] || []).slice().reverse();
  return (
    <div className="panel"><table className="t"><tbody>
      {list.map((h, i) => <tr key={i}><td>{h.season}</td><td>🏆 <ClubName id={h.winner} size={16} /></td><td className="muted small">{h.runner != null ? G.clubs[h.runner]?.name : ''}</td></tr>)}
      {!list.length && <tr><td className="muted">История появится после завершения сезона</td></tr>}
    </tbody></table></div>
  );
}
