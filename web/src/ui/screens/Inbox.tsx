import React, { useState, useEffect } from 'react';
import { G, P } from '../../engine/state';
import { useNav, refresh, Modal } from '../common';
import { fmtDate, fmtMoney } from '../../engine/util';
import type { Msg } from '../../engine/types';
import { acceptContract } from '../../engine/board';
import { acceptCounter, respondToOffer, listPlayer } from '../../engine/transfers';
import { ContractModal, OfferModal } from './Deals';
import { fullName } from '../../engine/player';
import { takeOverClub } from '../../engine/game';

export function InboxScreen({ first }: { first?: boolean }) {
  const nav = useNav();
  const [sel, setSel] = useState<number | null>(nav.nav.params?.id ?? null);
  const [filter, setFilter] = useState<'all' | 'needs'>('all');
  useEffect(() => {
    if (first) {
      const m = G.inbox.find((x) => x.needs && !x.done) || G.inbox.find((x) => !x.read);
      if (m) setSel(m.id);
    }
  }, [first]);
  const msgs = G.inbox.filter((m) => filter === 'all' || (m.needs && !m.done));
  const cur = G.inbox.find((m) => m.id === sel);
  if (cur && !cur.read) { cur.read = true; }
  return (
    <div className="grid" style={{ gridTemplateColumns: cur ? 'minmax(0, 340px) minmax(0, 1fr)' : '1fr' }}>
      <div className="panel" style={{ alignSelf: 'start' }}>
        <div className="ph">Входящие
          <span className="r seg"><button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Все</button><button className={filter === 'needs' ? 'on' : ''} onClick={() => setFilter('needs')}>Требуют решения</button></span>
          <button className="btn sm" onClick={() => { G.inbox.forEach((m) => (m.read = true)); refresh(); }}>✓ Все прочитаны</button>
        </div>
        <div style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          {msgs.map((m) => (
            <div key={m.id} className={'msg' + (m.read ? '' : ' unread') + (m.needs && !m.done ? ' needs' : '')} onClick={() => setSel(m.id)} style={m.id === sel ? { background: 'var(--panel2)' } : undefined}>
              <div className={'dot' + (m.read ? ' read' : '')} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis"><b>{m.subj}</b></div>
                <div className="small muted ellipsis">{m.from} · {fmtDate(m.day)}</div>
              </div>
              {m.needs && !m.done && <span className="chip r">Решение</span>}
            </div>
          ))}
          {!msgs.length && <div className="pb muted">Сообщений нет</div>}
        </div>
      </div>
      {cur && <MessageView m={cur} onClose={() => setSel(null)} />}
    </div>
  );
}

function MessageView({ m, onClose }: { m: Msg; onClose: () => void }) {
  const nav = useNav();
  const [modal, setModal] = useState<React.ReactNode>(null);
  const [counter, setCounter] = useState<number>(0);
  const done = (text?: string) => { m.done = true; if (text) nav.toast(text); refresh(); };
  const d = m.data || {};
  let actions: React.ReactNode = null;
  if (m.needs && !m.done) {
    switch (d.type) {
      case 'mgrContract':
        actions = <><button className="btn primary" onClick={() => { acceptContract(d.wage, d.years); done('Контракт продлён!'); }}>Подписать</button><button className="btn" onClick={() => done('Вы отклонили предложение')}>Отказаться</button></>;
        break;
      case 'bidAccepted': {
        const bid = G.bids.find((b) => b.id === d.bid);
        actions = bid && bid.status === 'accepted' ? <><button className="btn primary" onClick={() => setModal(<ContractModal pid={bid.player} bidId={bid.id} onClose={() => { setModal(null); refresh(); }} />)}>Обсудить личные условия</button><button className="btn" onClick={() => { bid.status = 'cancelled'; done('Сделка отменена'); }}>Отказаться от сделки</button></> : <button className="btn" onClick={() => done()}>Закрыть</button>;
        break;
      }
      case 'bidCounter': {
        const bid = G.bids.find((b) => b.id === d.bid);
        actions = bid ? <>
          <button className="btn primary" onClick={() => { const r = acceptCounter(bid.id); done(typeof r === 'string' ? r : 'Предложение с новой суммой отправлено'); }}>Принять: {fmtMoney(bid.counter!)}</button>
          <button className="btn" onClick={() => setModal(<OfferModal pid={bid.player} initialFee={bid.counter} onClose={() => { setModal(null); done(); }} />)}>Новое предложение</button>
          <button className="btn" onClick={() => { bid.status = 'cancelled'; done('Переговоры прекращены'); }}>Отказаться</button>
        </> : null;
        break;
      }
      case 'offer': {
        const bid = G.bids.find((b) => b.id === d.bid);
        if (bid && bid.status === 'pending') {
          const cv = counter || Math.round(bid.fee * 1.3 / 100000) * 100000;
          actions = <>
            <button className="btn primary" onClick={() => done(respondToOffer(bid.id, 'accept'))}>Принять</button>
            <button className="btn" onClick={() => done(respondToOffer(bid.id, 'reject'))}>Отклонить</button>
            <div className="row" style={{ width: '100%' }}>
              <input className="input" value={cv.toLocaleString('ru-RU')} onChange={(e) => setCounter(parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} />
              <button className="btn gold" onClick={() => done(respondToOffer(bid.id, 'counter', cv))}>Запросить</button>
            </div>
          </>;
        } else actions = <button className="btn" onClick={() => done()}>Закрыть</button>;
        break;
      }
      case 'playtime': {
        const p = G.players[d.pid];
        actions = p ? <>
          <button className="btn primary" onClick={() => { p.morale = Math.min(100, p.morale + 12); p.unhappy = G.day; done(`Вы пообещали ${fullName(p)} больше игрового времени`); }}>Пообещать больше игрового времени</button>
          <button className="btn" onClick={() => { p.morale = Math.max(5, p.morale - 10); p.status = Math.min(4, p.status + 1); done('Вы понизили статус игрока'); }}>Понизить статус</button>
          <button className="btn" onClick={() => { listPlayer(p, 1); p.morale = Math.max(5, p.morale - 4); done('Игрок выставлен на трансфер'); }}>Выставить на трансфер</button>
        </> : <button className="btn" onClick={() => done()}>Закрыть</button>;
        break;
      }
      case 'jobOffer':
        actions = <><button className="btn primary" onClick={() => {
          if (G.user >= 0) { const h = G.mgr.history[G.mgr.history.length - 1]; if (h) h.to = G.day; G.clubs[G.user].mgr = 'Исполняющий обязанности'; }
          takeOverClub(d.club); done(`Вы возглавили «${G.clubs[d.club].name}»!`); nav.go('home');
        }}>Принять предложение</button><button className="btn" onClick={() => done('Предложение отклонено')}>Отклонить</button></>;
        break;
      default:
        actions = <button className="btn primary" onClick={() => { done(); if (m.kind === 'sacked') nav.go('jobs'); }}>Понятно</button>;
    }
  }
  const pid = d.pid ?? (d.bid != null ? G.bids.find((b) => b.id === d.bid)?.player : undefined);
  return (
    <div className="panel" style={{ alignSelf: 'start' }}>
      <div className="ph">{m.from}<span className="r small">{fmtDate(m.day)}</span><button className="btn sm" onClick={onClose}>✕</button></div>
      <div className="pb">
        <h2>{m.subj}</h2>
        <div className="msgbody">{m.body}</div>
        {pid != null && G.players[pid] && <div style={{ marginTop: 10 }}><button className="btn sm" onClick={() => nav.openPlayer(pid)}>👤 Профиль игрока</button></div>}
        {actions && <div className="row wrap" style={{ marginTop: 14 }}>{actions}</div>}
        {m.needs && m.done && <div className="small muted" style={{ marginTop: 10 }}>✓ Решение принято</div>}
      </div>
      {modal}
    </div>
  );
}
