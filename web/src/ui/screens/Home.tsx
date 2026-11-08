import React from 'react';
import { G, IDX } from '../../engine/state';
import { useNav, Crest, ClubName, Form, Bar } from '../common';
import { nextUserFixture } from '../../engine/game';
import { fmtDate, wdShort } from '../../engine/util';
import { leagueComp, confText } from '../../engine/board';
import { standings } from '../../engine/comps';
import { fullName } from '../../engine/player';
import type { Fixture } from '../../engine/types';

export function compName(f: Fixture) {
  const c = G.comps[f.comp];
  return c ? c.name : '';
}

export function HomeScreen() {
  const nav = useNav();
  if (G.user < 0) {
    return (
      <div className="panel"><div className="pb">
        <h2>Вы сейчас без работы</h2>
        <p className="muted">Найдите новый клуб в разделе «Вакансии».</p>
        <button className="btn primary" onClick={() => nav.go('jobs')}>Открыть вакансии</button>
      </div></div>
    );
  }
  const club = G.clubs[G.user];
  const nf = nextUserFixture();
  const lc = leagueComp(club);
  const order = lc ? standings(lc) : [];
  const myPos = order.indexOf(club.id);
  const from = Math.max(0, Math.min(order.length - 7, myPos - 3));
  const injured = club.players.map((id) => G.players[id]!).filter((p) => p && p.inj && p.inj.until > G.day);
  const banned = club.players.map((id) => G.players[id]!).filter((p) => p && p.ban.some((b) => b > 0));
  const mine = (IDX.clubFx.get(G.user) || []).map((id) => G.fixtures[id]).filter(Boolean) as Fixture[];
  const recent = mine.filter((f) => f.played).sort((a, b) => b.day - a.day).slice(0, 5);
  const upcoming = mine.filter((f) => !f.played).sort((a, b) => a.day - b.day).slice(0, 5);
  return (
    <div className="grid g2">
      <div>
        <div className="panel">
          <div className="ph">Следующий матч</div>
          <div className="pb">
            {nf ? (
              <div className="col" style={{ alignItems: 'center', gap: 8 }}>
                <div className="small muted">{compName(nf)} · {nf.stage}</div>
                <div className="row" style={{ gap: 18, justifyContent: 'center' }}>
                  <div className="col center" style={{ alignItems: 'center', width: 120 }}><Crest club={G.clubs[nf.home]} size={56} /><div className="small ellipsis" style={{ maxWidth: 120 }}>{G.clubs[nf.home].name}</div></div>
                  <div className="big">VS</div>
                  <div className="col center" style={{ alignItems: 'center', width: 120 }}><Crest club={G.clubs[nf.away]} size={56} /><div className="small ellipsis" style={{ maxWidth: 120 }}>{G.clubs[nf.away].name}</div></div>
                </div>
                <div className="small">{wdShort(nf.day)}, {fmtDate(nf.day)} {nf.day === G.day ? <b className="bad">— сегодня!</b> : <span className="muted">(через {nf.day - G.day} дн.)</span>}</div>
                <div className="row"><button className="btn sm" onClick={() => nav.go('tactics')}>📋 Тактика и состав</button><button className="btn sm" onClick={() => nav.go('clubview', { id: nf.home === G.user ? nf.away : nf.home })}>🔍 Соперник</button></div>
              </div>
            ) : <div className="muted">Нет запланированных матчей</div>}
          </div>
        </div>
        <div className="panel">
          <div className="ph">Ближайшие матчи<span className="r"><button className="btn sm" onClick={() => nav.go('schedule')}>Все</button></span></div>
          <div className="pb">
            {upcoming.length ? upcoming.map((f) => (
              <div key={f.id} className="row small" style={{ padding: '3px 0' }}>
                <span className="muted nowrap" style={{ width: 64 }}>{fmtDate(f.day).replace(/ \d{4}$/, '')}</span>
                <span className="grow ellipsis"><ClubName id={f.home === G.user ? f.away : f.home} size={16} /> <span className="muted">({f.neutral ? 'Н' : f.home === G.user ? 'Д' : 'Г'})</span></span>
                <span className="muted ellipsis" style={{ maxWidth: 140 }}>{G.comps[f.comp]?.short}</span>
              </div>
            )) : <div className="muted">Нет матчей</div>}
          </div>
        </div>
        <div className="panel">
          <div className="ph">Последние результаты</div>
          <div className="pb">
            {recent.length ? recent.map((f) => {
              const home = f.home === G.user;
              const gf = home ? f.hg : f.ag, ga = home ? f.ag : f.hg;
              const res = gf > ga ? 'В' : gf < ga ? 'П' : f.ph != null ? ((home ? f.ph > f.pa! : f.pa! > f.ph) ? 'В' : 'П') : 'Н';
              return (
                <div key={f.id} className="row" style={{ padding: '4px 0' }}>
                  <Form s={res} />
                  <span className="small muted nowrap">{fmtDate(f.day).replace(/ \d{4}$/, '')}</span>
                  <span className="grow ellipsis"><ClubName id={home ? f.away : f.home} size={16} /></span>
                  <b>{f.hg}:{f.ag}{f.ph != null ? ` (пен. ${f.ph}:${f.pa})` : ''}</b>
                </div>
              );
            }) : <div className="muted">Сезон ещё не начался</div>}
          </div>
        </div>
        <div className="panel">
          <div className="ph">Совет директоров</div>
          <div className="pb">
            <div className="row"><span className="grow">Доверие: <b>{confText(G.board.conf)}</b></span><b>{G.board.conf}%</b></div>
            <Bar v={G.board.conf} color={G.board.conf >= 55 ? 'var(--accent)' : G.board.conf >= 35 ? 'var(--orange)' : 'var(--red)'} />
            <div className="small muted" style={{ marginTop: 6 }}>{G.board.exp.leagueText}</div>
            {G.board.ultimatum && <div className="small bad" style={{ marginTop: 6 }}>⚠ Ультиматум: набрать {G.board.ultimatum.pts} очк. в {G.board.ultimatum.matches} матчах (набрано {G.board.ultimatum.got} из {G.board.ultimatum.played} матчей)</div>}
          </div>
        </div>
      </div>
      <div>
        {lc && (
          <div className="panel">
            <div className="ph">{lc.name}<span className="r"><button className="btn sm" onClick={() => nav.go('comps', { comp: lc.id })}>Полностью</button></span></div>
            <table className="t"><thead><tr><th>#</th><th>Клуб</th><th className="num">И</th><th className="num">РМ</th><th className="num">О</th></tr></thead><tbody>
              {order.slice(from, from + 7).map((cid, i) => {
                const r = lc.table![cid];
                return <tr key={cid} className={cid === G.user ? 'me' : ''}><td>{from + i + 1}</td><td><ClubName id={cid} size={16} /></td><td className="num">{r.p}</td><td className="num">{r.gf - r.ga}</td><td className="num"><b>{r.pts}</b></td></tr>;
              })}
            </tbody></table>
          </div>
        )}
        <div className="panel">
          <div className="ph">Входящие<span className="r"><button className="btn sm" onClick={() => nav.go('inbox')}>Все</button></span></div>
          {G.inbox.slice(0, 5).map((m) => (
            <div key={m.id} className={'msg' + (m.read ? '' : ' unread') + (m.needs && !m.done ? ' needs' : '')} onClick={() => nav.go('inbox', { id: m.id })}>
              <div className={'dot' + (m.read ? ' read' : '')} />
              <div className="grow"><div className="ellipsis"><b>{m.subj}</b></div><div className="small muted">{m.from} · {fmtDate(m.day)}</div></div>
            </div>
          ))}
        </div>
        {(injured.length > 0 || banned.length > 0) && (
          <div className="panel">
            <div className="ph">Лазарет и дисквалификации</div>
            <div className="pb small">
              {injured.map((p) => <div key={p.id}>🚑 {fullName(p)} — {p.inj!.name} (до {fmtDate(p.inj!.until)})</div>)}
              {banned.map((p) => <div key={p.id}>🟥 {fullName(p)} — дисквалификация</div>)}
            </div>
          </div>
        )}
        <div className="panel">
          <div className="ph">Новости футбола</div>
          <div className="pb small">
            {G.news.slice(0, 10).map((n, i) => <div key={i} style={{ padding: '3px 0' }}><span className="muted">{fmtDate(n.day).replace(/ \d{4}$/, '')}</span> · {n.text}</div>)}
            {!G.news.length && <div className="muted">Пока новостей нет</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
