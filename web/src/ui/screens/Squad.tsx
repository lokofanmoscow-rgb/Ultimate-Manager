import React, { useState } from 'react';
import { G } from '../../engine/state';
import { useNav, Flag, Stars, PosBadge, Bar, condColor, Tabs, Money } from '../common';
import { age, fullName, mainPos, seasonAvg } from '../../engine/player';
import { fmtDate, fmtMoney } from '../../engine/util';
import { POS_GROUP } from '../../engine/attrs';
import type { Player } from '../../engine/types';

const GROUP_ORDER: Record<string, number> = { G: 0, D: 1, M: 2, F: 3 };

export function SquadScreen() {
  const nav = useNav();
  const [tab, setTab] = useState('main');
  const [sort, setSort] = useState<string>('pos');
  const [flt, setFlt] = useState('all');
  if (G.user < 0) return <div className="muted">Нет клуба</div>;
  const club = G.clubs[G.user];
  let ps = club.players.map((id) => G.players[id]!).filter(Boolean);
  const loanedOut = G.players.filter((p) => p && p.loan && p.loan.from === G.user) as Player[];
  if (tab === 'loans') ps = loanedOut;
  if (flt !== 'all') ps = ps.filter((p) => POS_GROUP[mainPos(p)] === flt);
  const xi = new Set(club.sel?.lineup || []);
  const sorters: Record<string, (a: Player, b: Player) => number> = {
    pos: (a, b) => GROUP_ORDER[POS_GROUP[mainPos(a)]] - GROUP_ORDER[POS_GROUP[mainPos(b)]] || b.ca - a.ca,
    ca: (a, b) => b.ca - a.ca,
    age: (a, b) => age(a) - age(b),
    value: (a, b) => b.value - a.value,
    wage: (a, b) => b.wage - a.wage,
    cond: (a, b) => b.cond - a.cond,
    apps: (a, b) => (b.st.apps + b.st.sub) - (a.st.apps + a.st.sub),
    gls: (a, b) => b.st.gls - a.st.gls,
    rat: (a, b) => seasonAvg(b) - seasonAvg(a),
    contract: (a, b) => a.cEnd - b.cEnd,
  };
  ps.sort(sorters[sort] || sorters.pos);
  const Th = ({ k, children, num }: { k: string; children: React.ReactNode; num?: boolean }) => <th className={num ? 'num' : ''} style={{ cursor: 'pointer', color: sort === k ? '#fff' : undefined }} onClick={() => setSort(k)}>{children}</th>;
  const totalWage = club.players.reduce((s, id) => s + (G.players[id]?.wage || 0), 0);
  return (
    <div>
      <div className="row wrap" style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }} className="grow">Состав «{club.name}»</h1>
        <span className="chip">{club.players.length} игроков</span>
        <span className="chip">ФОТ: {fmtMoney(totalWage)}/нед</span>
      </div>
      <Tabs tabs={[['main', 'Игроки'], ['stats', 'Статистика'], ['contracts', 'Контракты'], ['loans', `В аренде (${loanedOut.length})`]]} value={tab} onChange={setTab} />
      <div className="seg" style={{ marginBottom: 8 }}>
        {[['all', 'Все'], ['G', 'Вратари'], ['D', 'Защитники'], ['M', 'Полузащитники'], ['F', 'Нападающие']].map(([k, l]) => <button key={k} className={flt === k ? 'on' : ''} onClick={() => setFlt(k)}>{l}</button>)}
      </div>
      <div className="panel tscroll">
        <table className="t">
          <thead>
            <tr>
              <Th k="pos">Поз</Th><th>#</th><th>Игрок</th><Th k="age" num>Возр</Th><Th k="ca">Уровень</Th>
              {tab === 'main' && <><Th k="cond">Форма</Th><th>Мор.</th><Th k="apps" num>Игры</Th><Th k="gls" num>Голы</Th><Th k="rat" num>Ср.</Th><Th k="value" num>Стоимость</Th></>}
              {tab === 'stats' && <><Th k="apps" num>Игры</Th><th className="num">Мин</th><Th k="gls" num>Голы</Th><th className="num">Пасы</th><th className="num">ЖК</th><th className="num">КК</th><th className="num">ЛИМ</th><Th k="rat" num>Ср.</Th></>}
              {(tab === 'contracts' || tab === 'loans') && <><Th k="wage" num>Зарплата</Th><Th k="contract">Контракт до</Th><th>Статус</th><Th k="value" num>Стоимость</Th><th>{tab === 'loans' ? 'Клуб' : 'Трансфер'}</th></>}
            </tr>
          </thead>
          <tbody>
            {ps.map((p) => (
              <tr key={p.id} className="click" onClick={() => nav.openPlayer(p.id)}>
                <td><PosBadge p={p} /></td>
                <td className="muted">{p.shirt || ''}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <Flag code={p.nat} size={12} />
                    <span>{fullName(p)}</span>
                    {xi.has(p.id) && <span className="chip g tiny">XI</span>}
                    {p.inj && p.inj.until > G.day && <span className="chip r tiny">🚑</span>}
                    {p.ban.some((b) => b > 0) && <span className="chip r tiny">дискв.</span>}
                    {p.listed === 1 && <span className="chip y tiny">ТР</span>}
                    {p.listed === 2 && <span className="chip y tiny">АР</span>}
                    {p.loan && p.club === G.user && <span className="chip b tiny">аренда</span>}
                  </div>
                </td>
                <td className="num">{age(p)}</td>
                <td><Stars ca={p.ca} /></td>
                {tab === 'main' && <>
                  <td style={{ width: 60 }}><Bar v={p.cond} color={condColor(p.cond)} /></td>
                  <td>{p.morale >= 70 ? '😀' : p.morale >= 50 ? '🙂' : p.morale >= 35 ? '😐' : '😠'}</td>
                  <td className="num">{p.st.apps}{p.st.sub ? `(${p.st.sub})` : ''}</td>
                  <td className="num">{p.st.gls}</td>
                  <td className="num">{seasonAvg(p) ? seasonAvg(p).toFixed(2) : '—'}</td>
                  <td className="num">{fmtMoney(p.value)}</td>
                </>}
                {tab === 'stats' && <>
                  <td className="num">{p.st.apps}{p.st.sub ? `(${p.st.sub})` : ''}</td>
                  <td className="num">{p.st.min}</td>
                  <td className="num">{p.st.gls}</td>
                  <td className="num">{p.st.ast}</td>
                  <td className="num">{p.st.yc}</td>
                  <td className="num">{p.st.rc}</td>
                  <td className="num">{p.st.potm}</td>
                  <td className="num">{seasonAvg(p) ? seasonAvg(p).toFixed(2) : '—'}</td>
                </>}
                {(tab === 'contracts' || tab === 'loans') && <>
                  <td className="num"><Money v={p.wage} /></td>
                  <td className={p.cEnd - G.day < 180 ? 'warn' : ''}>{fmtDate(p.cEnd)}</td>
                  <td className="small">{['Ключевой', 'Основа', 'Ротация', 'Запасной', 'Перспективный'][p.status]}</td>
                  <td className="num">{fmtMoney(p.value)}</td>
                  <td className="small">{tab === 'loans' ? G.clubs[p.club]?.name : p.listed === 1 ? 'В трансферном списке' : p.listed === 2 ? 'Доступен для аренды' : ''}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
