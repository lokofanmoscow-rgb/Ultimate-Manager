import React, { useMemo, useState } from 'react';
import { G } from '../../engine/state';
import { useNav, Flag, Stars, PosBadge, Tabs, ClubName, refresh } from '../common';
import { age, fullName, mainPos, askingPrice } from '../../engine/player';
import { POS_GROUP, POS, POS_RU } from '../../engine/attrs';
import { fmtMoney, fmtDate } from '../../engine/util';
import { knowledge } from '../../engine/scouting';
import { windowOpen, nextWindowDay } from '../../engine/transfers';
import { ASSOCS, NATION } from '../../data/nations';
import type { Player } from '../../engine/types';
import { stars as starsOf } from '../../engine/attrs';

export function TransfersScreen({ tab: initTab }: { tab?: string }) {
  const [tab, setTab] = useState(initTab || 'search');
  if (G.user < 0) return <div className="muted">Нет клуба</div>;
  const club = G.clubs[G.user];
  const open = windowOpen(club.country);
  return (
    <div>
      <div className="row wrap" style={{ marginBottom: 8 }}>
        <h1 className="grow" style={{ margin: 0 }}>Трансферы</h1>
        <span className={'chip ' + (open ? 'g' : 'y')}>{open ? 'Окно открыто' : `Окно закрыто (откроется ${fmtDate(nextWindowDay(club.country))})`}</span>
        <span className="chip">Бюджет: {fmtMoney(club.fin.tBudget)}</span>
      </div>
      <Tabs tabs={[['search', 'Поиск игроков'], ['short', `Шорт-лист (${G.shortlist.length})`], ['bids', 'Переговоры'], ['market', 'Трансферный рынок'], ['history', 'История трансферов']]} value={tab} onChange={setTab} />
      {tab === 'search' && <Search />}
      {tab === 'short' && <PlayerTable list={G.shortlist.map((id) => G.players[id]!).filter(Boolean)} />}
      {tab === 'bids' && <Bids />}
      {tab === 'market' && <PlayerTable list={(G.players.filter((p) => p && p.club >= 0 && p.club !== G.user && p.listed) as Player[]).sort((a, b) => b.ca - a.ca).slice(0, 150)} />}
      {tab === 'history' && <History />}
    </div>
  );
}

function Search() {
  const [pos, setPos] = useState('all');
  const [country, setCountry] = useState('all');
  const [ageMax, setAgeMax] = useState(40);
  const [ageMin, setAgeMin] = useState(15);
  const [maxValue, setMaxValue] = useState(0);
  const [minStars, setMinStars] = useState(0);
  const [free, setFree] = useState(false);
  const [name, setName] = useState('');
  const [nat, setNat] = useState('all');
  const [expiring, setExpiring] = useState(false);
  const [listedOnly, setListedOnly] = useState(false);
  const res = useMemo(() => {
    const out: Player[] = [];
    const nm = name.trim().toLowerCase();
    for (const p of G.players) {
      if (!p || p.club === G.user) continue;
      if (free && p.club >= 0) continue;
      if (pos !== 'all') {
        if (pos.length === 1) { if (POS_GROUP[mainPos(p)] !== pos) continue; }
        else if (p.pos[POS.indexOf(pos as any)] < 15) continue;
      }
      if (country !== 'all' && (p.club < 0 || G.clubs[p.club].country !== country)) continue;
      if (nat !== 'all' && p.nat !== nat) continue;
      const a = age(p);
      if (a > ageMax || a < ageMin) continue;
      if (maxValue && p.value > maxValue) continue;
      if (minStars && starsOf(p.ca) < minStars) continue;
      if (expiring && p.cEnd - G.day > 183) continue;
      if (listedOnly && !p.listed) continue;
      if (nm && !(`${p.fn} ${p.ln}`.toLowerCase().includes(nm))) continue;
      out.push(p);
      if (out.length > 3000) break;
    }
    return out.sort((a, b) => b.ca - a.ca).slice(0, 200);
  }, [pos, country, ageMax, ageMin, maxValue, minStars, free, name, nat, expiring, listedOnly]);
  return (
    <div>
      <div className="panel"><div className="pb">
        <div className="grid g3">
          <div className="field"><label>Имя</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Поиск по имени" /></div>
          <div className="field"><label>Позиция</label>
            <select className="input" value={pos} onChange={(e) => setPos(e.target.value)}>
              <option value="all">Любая</option><option value="G">Вратари</option><option value="D">Защитники</option><option value="M">Полузащитники</option><option value="F">Нападающие</option>
              {POS.map((p) => <option key={p} value={p}>{POS_RU[p]}</option>)}
            </select>
          </div>
          <div className="field"><label>Страна клуба</label>
            <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="all">Любая</option>
              {ASSOCS.map((a) => <option key={a.code} value={a.code}>{NATION[a.code]?.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Гражданство</label>
            <select className="input" value={nat} onChange={(e) => setNat(e.target.value)}>
              <option value="all">Любое</option>
              {Object.values(NATION).sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((n) => <option key={n.code} value={n.code}>{n.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Возраст: {ageMin}–{ageMax}</label><div className="row"><input type="range" min={15} max={40} value={ageMin} onChange={(e) => setAgeMin(Math.min(+e.target.value, ageMax))} /><input type="range" min={15} max={40} value={ageMax} onChange={(e) => setAgeMax(Math.max(+e.target.value, ageMin))} /></div></div>
          <div className="field"><label>Макс. стоимость</label>
            <select className="input" value={maxValue} onChange={(e) => setMaxValue(+e.target.value)}>
              {[0, 250000, 1e6, 3e6, 5e6, 10e6, 20e6, 40e6, 80e6].map((v) => <option key={v} value={v}>{v ? fmtMoney(v) : 'Любая'}</option>)}
            </select>
          </div>
          <div className="field"><label>Мин. уровень</label>
            <select className="input" value={minStars} onChange={(e) => setMinStars(+e.target.value)}>
              {[0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5].map((v) => <option key={v} value={v}>{v ? `${v}★` : 'Любой'}</option>)}
            </select>
          </div>
        </div>
        <div className="row wrap">
          <label className="row small"><input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> Только свободные агенты</label>
          <label className="row small"><input type="checkbox" checked={expiring} onChange={(e) => setExpiring(e.target.checked)} /> Истекает контракт (&lt;6 мес)</label>
          <label className="row small"><input type="checkbox" checked={listedOnly} onChange={(e) => setListedOnly(e.target.checked)} /> Выставлены на трансфер/аренду</label>
        </div>
      </div></div>
      <PlayerTable list={res} />
    </div>
  );
}

export function PlayerTable({ list }: { list: Player[] }) {
  const nav = useNav();
  return (
    <div className="panel tscroll">
      <table className="t">
        <thead><tr><th>Поз</th><th>Игрок</th><th>Возр</th><th>Клуб</th><th>Уровень</th><th>Потенциал</th><th className="num">Стоимость</th><th>Контракт</th></tr></thead>
        <tbody>
          {list.map((p) => {
            const k = knowledge(p);
            return (
              <tr key={p.id} className="click" onClick={() => nav.openPlayer(p.id)}>
                <td><PosBadge p={p} /></td>
                <td><span className="row"><Flag code={p.nat} size={12} />{fullName(p)} {p.listed ? <span className="chip y tiny">{p.listed === 1 ? 'ТР' : 'АР'}</span> : null}</span></td>
                <td>{age(p)}</td>
                <td>{p.club >= 0 ? <ClubName id={p.club} size={16} /> : <span className="muted">Свободный</span>}</td>
                <td><Stars ca={p.ca} /></td>
                <td>{k >= 80 ? <Stars ca={p.pa} /> : <span className="muted small">?</span>}</td>
                <td className="num">{fmtMoney(p.value)}</td>
                <td className="small">{fmtDate(p.cEnd)}</td>
              </tr>
            );
          })}
          {!list.length && <tr><td colSpan={8} className="muted">Игроков не найдено</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const STATUS_RU: Record<string, string> = { pending: 'Ожидает ответа', accepted: 'Принято клубом', rejected: 'Отклонено', countered: 'Встречное предложение', contract: 'Ожидает оформления', done: 'Завершено', cancelled: 'Отменено', collapsed: 'Сорвалось' };

function Bids() {
  const nav = useNav();
  const bids = G.bids.filter((b) => b.buyer === G.user || b.seller === G.user).slice().reverse();
  return (
    <div className="panel tscroll"><table className="t">
      <thead><tr><th>Игрок</th><th>Тип</th><th>Сторона</th><th>Клуб</th><th className="num">Сумма</th><th>Статус</th><th /></tr></thead>
      <tbody>
        {bids.map((b) => {
          const p = G.players[b.player];
          return (
            <tr key={b.id}>
              <td>{p ? <span style={{ cursor: 'pointer' }} onClick={() => nav.openPlayer(p.id)}>{fullName(p)}</span> : '—'}</td>
              <td>{b.kind === 'loan' ? 'Аренда' : b.kind === 'free' ? 'Свободный' : 'Трансфер'}</td>
              <td>{b.buyer === G.user ? 'Покупка' : 'Продажа'}</td>
              <td>{b.buyer === G.user ? (b.seller >= 0 ? <ClubName id={b.seller} size={16} /> : '—') : <ClubName id={b.buyer} size={16} />}</td>
              <td className="num">{b.kind === 'loan' ? `${b.loanWage}% зарплаты` : fmtMoney(b.fee)}</td>
              <td className="small">{STATUS_RU[b.status]}{b.status === 'contract' && b.completeDay ? ` (${fmtDate(b.completeDay)})` : ''}</td>
              <td>{['pending', 'countered', 'accepted'].includes(b.status) && b.buyer === G.user && <button className="btn sm" onClick={() => { b.status = 'cancelled'; refresh(); }}>Отозвать</button>}</td>
            </tr>
          );
        })}
        {!bids.length && <tr><td colSpan={7} className="muted">Переговоров пока нет</td></tr>}
      </tbody>
    </table></div>
  );
}

function History() {
  const nav = useNav();
  const [mine, setMine] = useState(false);
  const list = G.transfers.filter((t) => !mine || t.from === G.user || t.to === G.user).slice(0, 200);
  return (
    <div>
      <label className="row small" style={{ marginBottom: 8 }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Только мой клуб</label>
      <div className="panel tscroll"><table className="t">
        <thead><tr><th>Дата</th><th>Игрок</th><th>Откуда</th><th>Куда</th><th className="num">Сумма</th></tr></thead>
        <tbody>
          {list.map((t, i) => (
            <tr key={i}>
              <td className="small">{fmtDate(t.day)}</td>
              <td><span style={{ cursor: 'pointer' }} onClick={() => G.players[t.player] && nav.openPlayer(t.player)}>{t.name}</span></td>
              <td>{t.from >= 0 ? <ClubName id={t.from} size={16} /> : <span className="muted">свободный агент</span>}</td>
              <td><ClubName id={t.to} size={16} /></td>
              <td className="num">{t.loan ? 'аренда' : t.fee > 0 ? fmtMoney(t.fee) : 'бесплатно'}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
