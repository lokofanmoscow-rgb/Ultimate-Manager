import React, { useState } from 'react';
import { G } from '../../engine/state';
import { useNav, refresh, Crest, Bar, ClubName, Stars, Tabs, Flag } from '../common';
import { confText, boardRequest, generateVacancies, applyForJob, Vacancy } from '../../engine/board';
import { fmtDate, fmtMoney, ageAt } from '../../engine/util';
import { LEAGUE_DEF, NATION } from '../../data/nations';
import { takeOverClub } from '../../engine/game';
import { addMsg } from '../../engine/inbox';

export function ClubScreen() {
  const nav = useNav();
  const [tab, setTab] = useState('board');
  const [answer, setAnswer] = useState<string | null>(null);
  if (G.user < 0) return <JobsScreen />;
  const club = G.clubs[G.user];
  const b = G.board;
  const m = G.mgr;
  const req = (k: Parameters<typeof boardRequest>[0]) => { setAnswer(boardRequest(k)); refresh(); };
  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <Crest club={club} size={56} />
        <div className="grow"><h1 style={{ margin: 0 }}>{club.name}</h1><div className="muted small">{club.league ? LEAGUE_DEF[club.league].name : ''} · {club.stadium} ({club.cap} тыс. мест)</div></div>
      </div>
      <Tabs tabs={[['board', 'Совет директоров'], ['contract', 'Мой контракт'], ['info', 'О клубе'], ['history', 'Карьера тренера']]} value={tab} onChange={setTab} />
      {tab === 'board' && (
        <div className="grid g2">
          <div className="panel"><div className="ph">Доверие совета</div><div className="pb">
            <div className="row"><b className="grow">{confText(b.conf)}</b><b>{b.conf}%</b></div>
            <Bar v={b.conf} color={b.conf >= 55 ? 'var(--accent)' : b.conf >= 35 ? 'var(--orange)' : 'var(--red)'} />
            <div className="kv small" style={{ marginTop: 8 }}>
              <span>Результаты</span><span><Bar v={b.confM} /></span>
              <span>Финансы</span><span><Bar v={b.confF} /></span>
            </div>
            {b.ultimatum && <div className="chip r" style={{ marginTop: 10, whiteSpace: 'normal' }}>⚠ Ультиматум: {b.ultimatum.pts} очк. в {b.ultimatum.matches} матчах чемпионата. Сыграно {b.ultimatum.played}, набрано {b.ultimatum.got}.</div>}
          </div></div>
          <div className="panel"><div className="ph">Задачи на сезон</div><div className="pb">
            <div>🏟 {b.exp.leagueText}</div>
            <div>🏆 {b.exp.cup}</div>
            {b.exp.euro && <div>🌍 {b.exp.euro}</div>}
            <div>💰 {b.exp.finance}</div>
          </div></div>
          <div className="panel" style={{ gridColumn: '1 / -1' }}><div className="ph">Встреча с советом директоров</div><div className="pb">
            <div className="row wrap">
              <button className="btn" onClick={() => req('transfer')}>Увеличить трансферный бюджет</button>
              <button className="btn" onClick={() => req('wage')}>Увеличить зарплатный бюджет</button>
              <button className="btn" onClick={() => req('train')}>Улучшить тренировочную базу</button>
              <button className="btn" onClick={() => req('youth')}>Улучшить академию</button>
              <button className="btn" onClick={() => req('contract')}>Обсудить новый контракт</button>
            </div>
            {answer && <div className="chip b" style={{ marginTop: 10, whiteSpace: 'normal' }}>{answer}</div>}
          </div></div>
        </div>
      )}
      {tab === 'contract' && (
        <div className="panel"><div className="pb kv">
          <span>Тренер</span><span>{m.fn} {m.ln} <Flag code={m.nat} size={12} /></span>
          <span>Возраст</span><span>{ageAt(m.dob, G.day)}</span>
          <span>Репутация</span><span><Stars value={Math.max(0.5, Math.round(m.rep / 10) / 2)} /> ({m.rep}/100)</span>
          <span>Зарплата</span><span>{fmtMoney(m.wage)} в неделю</span>
          <span>Контракт до</span><span>{fmtDate(m.cEnd)}</span>
          <span>В клубе с</span><span>{fmtDate(m.joined)}</span>
          <span>Статистика</span><span>{m.record.p} матчей: {m.record.w}В {m.record.d}Н {m.record.l}П</span>
          <span>Трофеи</span><span>{m.trophies.length ? m.trophies.map((t) => `${t.name} (${t.season})`).join(', ') : '—'}</span>
          <span />
          <span><button className="btn danger" onClick={() => { if (confirm('Подать в отставку?')) { G.flags.lastClub = G.user; G.clubs[G.user].mgr = 'Исполняющий обязанности'; const h = G.mgr.history[G.mgr.history.length - 1]; if (h) h.to = G.day; G.user = -1; G.mgr.club = -1; G.sacked = true; G.flags.unemployedOk = true; generateVacancies(true); refresh(); nav.go('jobs'); } }}>Подать в отставку</button></span>
        </div></div>
      )}
      {tab === 'info' && (
        <div className="grid g2">
          <div className="panel"><div className="pb kv">
            <span>Страна</span><span><Flag code={club.country} size={12} /> {NATION[club.country]?.name}</span>
            <span>Репутация</span><span><Stars value={Math.max(0.5, Math.round(club.rep / 10) / 2)} /> ({club.rep})</span>
            <span>Стадион</span><span>{club.stadium}, {club.cap} тыс.</span>
            <span>Тренировочная база</span><span>{club.facT}/20</span>
            <span>Академия</span><span>{club.facY}/20</span>
            <span>Коэффициент УЕФА</span><span>{(club.coef.reduce((s, x) => s + x, 0) + (club.coefCur || 0)).toFixed(1)}</span>
          </div></div>
          <div className="panel"><div className="ph">Трофеи клуба (в игре)</div><div className="pb small">
            {Object.entries(G.honours).flatMap(([k, list]) => list.filter((h) => h.winner === club.id).map((h) => `${trophyName(k)} — ${h.season}`)).map((s, i) => <div key={i}>🏆 {s}</div>)}
          </div></div>
        </div>
      )}
      {tab === 'history' && (
        <div className="panel tscroll"><table className="t">
          <thead><tr><th>Клуб</th><th>Период</th><th className="num">И</th><th className="num">В</th><th className="num">Н</th><th className="num">П</th><th>Трофеи</th></tr></thead>
          <tbody>{m.history.slice().reverse().map((h, i) => (
            <tr key={i}><td><ClubName id={h.club} size={16} /></td><td className="small">{fmtDate(h.from)} — {h.to ? fmtDate(h.to) : 'н.в.'}</td><td className="num">{h.p}</td><td className="num">{h.w}</td><td className="num">{h.d}</td><td className="num">{h.l}</td><td className="small">{h.trophies.join(', ')}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

function trophyName(k: string) {
  if (LEAGUE_DEF[k]) return LEAGUE_DEF[k].name;
  if (k === 'UCL') return 'Лига чемпионов';
  if (k === 'UEL') return 'Лига Европы';
  if (k === 'UECL') return 'Лига конференций';
  if (k.endsWith(':cup')) return 'Кубок страны';
  if (k.endsWith(':lcup')) return 'Кубок лиги';
  return k;
}

export function JobsScreen() {
  const nav = useNav();
  const [msg, setMsg] = useState<string | null>(null);
  if (!G.flags.vacancies || !G.flags.vacancies.length) generateVacancies(true);
  const vac: Vacancy[] = G.flags.vacancies || [];
  const apply = (v: Vacancy) => {
    const c = G.clubs[v.club];
    if (G.flags.applied?.[v.club]) { setMsg('Вы уже подавали заявку в этот клуб.'); return; }
    (G.flags.applied ||= {})[v.club] = 1;
    if (applyForJob(v.club)) {
      if (G.user >= 0) { const h = G.mgr.history[G.mgr.history.length - 1]; if (h) h.to = G.day; G.clubs[G.user].mgr = 'Исполняющий обязанности'; }
      takeOverClub(v.club);
      G.flags.vacancies = (G.flags.vacancies || []).filter((x: Vacancy) => x.club !== v.club);
      G.flags.applied = {};
      G.flags.unemployedOk = false;
      addMsg({ from: 'Пресс-служба', subj: `Новый главный тренер «${c.name}»`, kind: 'news', body: `${G.mgr.fn} ${G.mgr.ln} назначен главным тренером «${c.name}».` });
      refresh();
      nav.go('home');
    } else {
      setMsg(`«${c.name}» выбрал другого кандидата.`);
      refresh();
    }
  };
  return (
    <div>
      <h1>Вакансии</h1>
      {G.user < 0 && <div className="chip y" style={{ marginBottom: 10, whiteSpace: 'normal' }}>Вы без работы. Подайте заявку в клуб — шанс зависит от вашей репутации ({G.mgr.rep}/100) и уровня клуба. Нажимайте «Продолжить», чтобы появлялись новые вакансии.</div>}
      {msg && <div className="chip b" style={{ marginBottom: 10 }}>{msg}</div>}
      <div className="panel tscroll"><table className="t">
        <thead><tr><th>Клуб</th><th>Лига</th><th>Репутация</th><th>Бюджет</th><th /></tr></thead>
        <tbody>{vac.map((v) => {
          const c = G.clubs[v.club];
          return (
            <tr key={v.club}>
              <td><ClubName id={c.id} size={18} /></td>
              <td className="small">{c.league ? LEAGUE_DEF[c.league].name : ''}</td>
              <td><Stars value={Math.max(0.5, Math.round(c.rep / 10) / 2)} /></td>
              <td>{fmtMoney(c.fin.tBudget)}</td>
              <td><button className="btn sm primary" onClick={() => apply(v)} disabled={!!G.flags.applied?.[v.club]}>Подать заявку</button></td>
            </tr>
          );
        })}</tbody>
      </table></div>
      {G.user < 0 && <button className="btn" onClick={() => { G.flags.unemployedOk = true; nav.go('home'); refresh(); }}>Продолжить без клуба</button>}
    </div>
  );
}
