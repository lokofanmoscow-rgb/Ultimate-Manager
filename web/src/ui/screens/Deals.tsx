import React, { useState } from 'react';
import { G, P } from '../../engine/state';
import { Modal, Flag, Crest, useNav, refresh, Stars } from '../common';
import { fmtMoney, fmtDate, plural } from '../../engine/util';
import { makeBid, startNegotiation, respondTerms, finalizeContract, Negotiation, windowOpen, loanEndDefault } from '../../engine/transfers';
import { askingPrice, fullName, age, STATUS_NAMES } from '../../engine/player';
import type { ContractTerms } from '../../engine/types';
import { roundWage } from '../../engine/attrs';
import { wageBill } from '../../engine/finance';

function Num({ value, onChange, step }: { value: number; onChange: (v: number) => void; step: number }) {
  return (
    <div className="row">
      <button className="btn sm" onClick={() => onChange(Math.max(0, value - step))}>−</button>
      <input className="input" style={{ textAlign: 'center' }} value={Math.round(value).toLocaleString('ru-RU')} onChange={(e) => onChange(parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} />
      <button className="btn sm" onClick={() => onChange(value + step)}>+</button>
    </div>
  );
}

function feeStep(v: number) {
  return v >= 20_000_000 ? 1_000_000 : v >= 5_000_000 ? 500_000 : v >= 1_000_000 ? 100_000 : 25_000;
}

/** Transfer / loan offer to another club */
export function OfferModal({ pid, onClose, initialFee, loan }: { pid: number; onClose: () => void; initialFee?: number; loan?: boolean }) {
  const nav = useNav();
  const p = P(pid);
  const club = G.clubs[G.user];
  const ask = askingPrice(p);
  const [kind, setKind] = useState<'transfer' | 'loan'>(loan ? 'loan' : 'transfer');
  const [fee, setFee] = useState(initialFee ?? Math.round(p.value * 0.9 / 50000) * 50000);
  const [instal, setInstal] = useState(1);
  const [sellOn, setSellOn] = useState(0);
  const [loanWage, setLoanWage] = useState(100);
  const [loanFee, setLoanFee] = useState(0);
  const [buyOpt, setBuyOpt] = useState(0);
  const free = p.club < 0;
  const submit = () => {
    const r = makeBid({ player: pid, kind: free ? 'free' : kind, fee: kind === 'loan' ? 0 : fee, instal, sellOn, loanWage, loanFee, loanUntil: loanEndDefault(), buyOpt: buyOpt || undefined });
    if (typeof r === 'string') { nav.toast(r); return; }
    nav.toast(free ? 'Агент игрока свяжется с вами.' : `Предложение отправлено в «${G.clubs[p.club].name}». Ответ придёт в течение 1–2 дней.`);
    refresh();
    onClose();
  };
  return (
    <Modal title={<span className="row"><Flag code={p.nat} /> {free ? 'Предложение контракта' : 'Предложение клубу'}: {fullName(p)}</span>} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Отмена</button><button className="btn primary" onClick={submit}>Отправить предложение</button></>}>
      {!free && (
        <div className="row" style={{ marginBottom: 10 }}>
          <Crest club={G.clubs[p.club]} size={28} />
          <div className="grow small">Клуб-владелец: <b>{G.clubs[p.club].name}</b><br /><span className="muted">Стоимость: {fmtMoney(p.value)} · Контракт до {fmtDate(p.cEnd)}{p.rc ? ` · Отступные ${fmtMoney(p.rc)}` : ''}</span></div>
        </div>
      )}
      {!windowOpen(club.country) && !free && <div className="chip y" style={{ marginBottom: 10 }}>Трансферное окно закрыто — переход оформится при его открытии</div>}
      {!free && (
        <div className="seg" style={{ marginBottom: 12 }}>
          <button className={kind === 'transfer' ? 'on' : ''} onClick={() => setKind('transfer')}>Трансфер</button>
          <button className={kind === 'loan' ? 'on' : ''} onClick={() => setKind('loan')}>Аренда</button>
        </div>
      )}
      {free ? <div className="muted">Игрок — свободный агент. Можно сразу перейти к переговорам о контракте.</div> : kind === 'transfer' ? (
        <>
          <div className="field"><label>Сумма трансфера (бюджет: {fmtMoney(club.fin.tBudget)})</label><Num value={fee} onChange={setFee} step={feeStep(fee)} /></div>
          <div className="small muted" style={{ marginTop: -6, marginBottom: 10 }}>Ориентир клуба: около {fmtMoney(ask)}</div>
          <div className="field"><label>Рассрочка</label><div className="seg">{[1, 2, 3, 4].map((n) => <button key={n} className={instal === n ? 'on' : ''} onClick={() => setInstal(n)}>{n === 1 ? 'Сразу' : `${n} ${plural(n, 'год', 'года', 'лет')}`}</button>)}</div></div>
          <div className="field"><label>Процент от следующей продажи: {sellOn}%</label><input type="range" min={0} max={30} step={5} value={sellOn} onChange={(e) => setSellOn(+e.target.value)} /></div>
        </>
      ) : (
        <>
          <div className="field"><label>Оплата зарплаты вашим клубом: {loanWage}% ({fmtMoney(p.wage * loanWage / 100)}/нед)</label><input type="range" min={0} max={100} step={5} value={loanWage} onChange={(e) => setLoanWage(+e.target.value)} /></div>
          <div className="field"><label>Плата за аренду</label><Num value={loanFee} onChange={setLoanFee} step={50000} /></div>
          <div className="field"><label>Опция выкупа (0 — без опции)</label><Num value={buyOpt} onChange={setBuyOpt} step={feeStep(buyOpt || 1_000_000)} /></div>
          <div className="small muted">Аренда до {fmtDate(loanEndDefault())}</div>
        </>
      )}
    </Modal>
  );
}

/** Contract negotiation with a player (transfer or renewal) */
export function ContractModal({ pid, bidId, renewal, onClose }: { pid: number; bidId: number; renewal?: boolean; onClose: () => void }) {
  const nav = useNav();
  const p = P(pid);
  const club = G.clubs[G.user];
  const [neg] = useState<Negotiation | { error: string }>(() => startNegotiation(pid, bidId, renewal));
  const [terms, setTerms] = useState<ContractTerms>(() => ('error' in neg ? { wage: 0, years: 3, bonus: 0, status: 2 } : { ...neg.demand, wage: roundWage(neg.demand.wage * 0.85) }));
  const [log, setLog] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  if ('error' in neg) {
    return <Modal title="Переговоры" onClose={onClose} footer={<button className="btn" onClick={onClose}>Закрыть</button>}><div>{neg.error}</div></Modal>;
  }
  const bid = G.bids.find((b) => b.id === bidId);
  const isLoan = bid?.kind === 'loan';
  const curBill = wageBill(club);
  const effWage = isLoan ? terms.wage * (bid!.loanWage ?? 100) / 100 : terms.wage;
  const overBudget = curBill - (renewal ? p.wage : 0) + effWage > club.fin.wBudget;
  const propose = () => {
    if (isLoan) {
      const msg = finalizeContract(neg, { ...terms, wage: p.wage, years: 1 });
      setLog((l) => [...l, msg]);
      setFinished(true);
      refresh();
      return;
    }
    if (overBudget) { nav.toast('Предложение превышает зарплатный бюджет клуба'); return; }
    const r = respondTerms(neg, terms);
    if (r.result === 'accept') {
      const msg = finalizeContract(neg, terms);
      setLog((l) => [...l, r.text, msg]);
      setFinished(true);
      if (bid) { const m = G.inbox.find((x) => x.data?.bid === bid.id && x.needs); if (m) m.done = true; }
    } else if (r.result === 'break') {
      setLog((l) => [...l, r.text]);
      setFinished(true);
      if (bid) { bid.status = 'collapsed'; const m = G.inbox.find((x) => x.data?.bid === bid.id && x.needs); if (m) m.done = true; }
    } else setLog((l) => [...l, r.text]);
    refresh();
  };
  return (
    <Modal title={<span className="row"><Flag code={p.nat} /> Контракт: {fullName(p)}</span>} onClose={onClose}
      footer={finished ? <button className="btn primary" onClick={onClose}>Готово</button> : <><button className="btn" onClick={onClose}>Прервать</button><button className="btn primary" onClick={propose}>{isLoan ? 'Подтвердить аренду' : 'Предложить'}</button></>}>
      <div className="row small" style={{ marginBottom: 8 }}>
        <span>Возраст: {age(p)}</span> · <Stars ca={p.ca} /> · <span>Сейчас: {fmtMoney(p.wage)}/нед</span>
      </div>
      {!isLoan && <div className="chip b" style={{ marginBottom: 10 }}>Требования агента: {fmtMoney(neg.demand.wage)}/нед, {neg.demand.years} {plural(neg.demand.years, 'год', 'года', 'лет')}, статус «{STATUS_NAMES[neg.demand.status]}»</div>}
      {isLoan ? (
        <div className="muted">Игрок согласен перейти в аренду. Ваш клуб оплачивает {bid!.loanWage}% зарплаты ({fmtMoney(p.wage * (bid!.loanWage ?? 100) / 100)}/нед).</div>
      ) : (
        <>
          <div className="field"><label>Зарплата в неделю</label><Num value={terms.wage} onChange={(v) => setTerms({ ...terms, wage: v })} step={terms.wage >= 50000 ? 5000 : terms.wage >= 5000 ? 500 : 50} /></div>
          <div className="field"><label>Срок контракта</label><div className="seg">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={terms.years === n ? 'on' : ''} onClick={() => setTerms({ ...terms, years: n })}>{n} {plural(n, 'год', 'года', 'лет')}</button>)}</div></div>
          <div className="field"><label>Статус в команде</label><div className="seg">{STATUS_NAMES.map((s, i) => <button key={i} className={terms.status === i ? 'on' : ''} onClick={() => setTerms({ ...terms, status: i })}>{s}</button>)}</div></div>
          <div className="field"><label>Бонус за подписание</label><Num value={terms.bonus} onChange={(v) => setTerms({ ...terms, bonus: v })} step={terms.bonus >= 1_000_000 ? 100_000 : 10_000} /></div>
          <div className="field"><label>Сумма отступных (0 — нет)</label><Num value={terms.rc || 0} onChange={(v) => setTerms({ ...terms, rc: v || undefined })} step={1_000_000} /></div>
          <div className="small muted">Агентские: {fmtMoney(neg.agentFee)} · Зарплатный бюджет: {fmtMoney(curBill)} / {fmtMoney(club.fin.wBudget)} в неделю {overBudget && <b className="bad">(превышение!)</b>}</div>
        </>
      )}
      {log.length > 0 && <div className="panel" style={{ marginTop: 10 }}><div className="pb small">{log.map((l, i) => <div key={i}>• {l}</div>)}</div></div>}
    </Modal>
  );
}

export function fmtTermsShort(t: ContractTerms) {
  return `${fmtMoney(t.wage)}/нед, ${t.years} г.`;
}
