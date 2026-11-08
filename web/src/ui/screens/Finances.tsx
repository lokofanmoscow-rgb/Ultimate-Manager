import React, { useState } from 'react';
import { G } from '../../engine/state';
import { refresh, Money, useNav } from '../common';
import { fmtMoney, monthName } from '../../engine/util';
import { INC_NAMES, EXP_NAMES, wageBill, staffBill } from '../../engine/finance';

export function FinancesScreen() {
  const nav = useNav();
  const [shift, setShift] = useState(0);
  if (G.user < 0) return <div className="muted">Нет клуба</div>;
  const club = G.clubs[G.user];
  const f = club.fin;
  const wb = wageBill(club);
  const months = f.months.slice(-12);
  const maxV = Math.max(1, ...months.map((m) => Math.max(sum(m.inc), sum(m.exp))));
  const total = (key: 'inc' | 'exp') => {
    const r: Record<string, number> = {};
    for (const m of months) for (const k in m[key]) r[k] = (r[k] || 0) + m[key][k];
    return r;
  };
  const inc = total('inc'), exp = total('exp');
  // budget adjustment: 1 weekly wage unit ≈ 40 transfer units
  const RATE = 40;
  const apply = () => {
    if (!shift) return;
    if (shift > 0) {
      const cost = shift * RATE;
      if (cost > f.tBudget) { nav.toast('Недостаточно трансферного бюджета'); return; }
      f.tBudget -= cost; f.wBudget += shift;
    } else {
      if (f.wBudget + shift < wb) { nav.toast('Зарплатный бюджет не может быть ниже текущих зарплат'); return; }
      f.wBudget += shift; f.tBudget += -shift * RATE;
    }
    setShift(0);
    refresh();
  };
  return (
    <div>
      <h1>Финансы</h1>
      <div className="grid g3">
        <div className="panel"><div className="ph">Баланс</div><div className="pb"><div className="big"><Money v={f.balance} /></div><div className="small muted">Годовой доход от ТВ: {fmtMoney(f.tvYear)}<br />Коммерция: {fmtMoney(f.comYear)}<br />Цена билета: {f.ticket} €</div></div></div>
        <div className="panel"><div className="ph">Трансферный бюджет</div><div className="pb"><div className="big">{fmtMoney(f.tBudget)}</div></div></div>
        <div className="panel"><div className="ph">Зарплаты</div><div className="pb"><div className="big">{fmtMoney(wb)}<span className="small muted"> / {fmtMoney(f.wBudget)} в нед.</span></div><div className="small muted">Персонал: {fmtMoney(staffBill(club))}/нед</div></div></div>
      </div>
      <div className="panel"><div className="ph">Перераспределение бюджетов</div><div className="pb">
        <div className="field"><label>{shift >= 0 ? `+${fmtMoney(shift)}/нед к зарплатам ← ${fmtMoney(shift * RATE)} из трансферов` : `${fmtMoney(-shift)}/нед из зарплат → +${fmtMoney(-shift * RATE)} к трансферам`}</label>
          <input type="range" min={-Math.round(Math.max(0, f.wBudget - wb))} max={Math.round(f.tBudget / RATE)} step={Math.max(10, Math.round(f.wBudget / 200))} value={shift} onChange={(e) => setShift(+e.target.value)} />
        </div>
        <button className="btn primary" disabled={!shift} onClick={apply}>Применить</button>
      </div></div>
      <div className="panel"><div className="ph">Доходы и расходы по месяцам</div><div className="pb">
        <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 160, overflowX: 'auto' }}>
          {months.map((m, i) => (
            <div key={i} className="col" style={{ alignItems: 'center', gap: 2, minWidth: 34 }}>
              <div className="row" style={{ alignItems: 'flex-end', gap: 2, height: 130 }}>
                <div style={{ width: 12, height: `${(sum(m.inc) / maxV) * 130}px`, background: 'var(--accent)', borderRadius: 2 }} title={fmtMoney(sum(m.inc))} />
                <div style={{ width: 12, height: `${(sum(m.exp) / maxV) * 130}px`, background: 'var(--red)', borderRadius: 2 }} title={fmtMoney(sum(m.exp))} />
              </div>
              <div className="tiny muted">{monthName(m.m).slice(0, 3)}</div>
            </div>
          ))}
          {!months.length && <div className="muted">Данные появятся через месяц</div>}
        </div>
      </div></div>
      <div className="grid g2">
        <div className="panel"><div className="ph">Доходы (12 мес.)</div><div className="pb kv">{Object.entries(inc).map(([k, v]) => <React.Fragment key={k}><span>{INC_NAMES[k] || k}</span><span className="ok">{fmtMoney(v)}</span></React.Fragment>)}</div></div>
        <div className="panel"><div className="ph">Расходы (12 мес.)</div><div className="pb kv">{Object.entries(exp).map(([k, v]) => <React.Fragment key={k}><span>{EXP_NAMES[k] || k}</span><span className="bad">{fmtMoney(v)}</span></React.Fragment>)}</div></div>
      </div>
    </div>
  );
}
function sum(o: Record<string, number>) {
  let s = 0;
  for (const k in o) s += o[k];
  return s;
}
