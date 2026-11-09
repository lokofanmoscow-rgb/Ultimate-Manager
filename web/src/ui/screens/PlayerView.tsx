import React, { useState } from 'react';
import { G } from '../../engine/state';
import { useNav, Flag, Crest, Stars, AttrVal, refresh, Tabs, ClubName, Bar, condColor, moraleText, posList } from '../common';
import { age, fullName, mainPos, seasonAvg, STATUS_NAMES, askingPrice } from '../../engine/player';
import { ATTR_NAMES, A, POS, POS_RU, POS_FULL_RU, PosCode, HID_NAMES, H, stars as starsOf } from '../../engine/attrs';
import { fmtDate, fmtMoney, plural } from '../../engine/util';
import { NATION } from '../../data/nations';
import { OfferModal, ContractModal } from './Deals';
import { listPlayer, releasePlayer } from '../../engine/transfers';
import { knowledge, assignScout } from '../../engine/scouting';
import { TALKS, talkToPlayer } from '../../engine/talk';

const TECH: number[] = [A.COR, A.CRO, A.DRI, A.FIN, A.FIR, A.FRE, A.HEA, A.LON, A.LTH, A.MAR, A.PAS, A.PEN, A.TCK, A.TEC];
const MENT: number[] = [A.AGG, A.ANT, A.BRA, A.CMP, A.CNT, A.DEC, A.DET, A.FLA, A.LDR, A.OTB, A.POS, A.TEA, A.VIS, A.WOR];
const PHYS: number[] = [A.ACC, A.AGI, A.BAL, A.JUM, A.NAT, A.PAC, A.STA, A.STR];
const GKA: number[] = [A.AER, A.CMD, A.COM, A.ECC, A.FIR, A.HAN, A.KIC, A.ONE, A.PAS, A.PUN, A.REF, A.RUS, A.THR];

// pitch coordinates for position map
const PMAP: Record<PosCode, [number, number]> = {
  GK: [50, 92], DL: [14, 74], DC: [50, 76], DR: [86, 74], WBL: [12, 58], WBR: [88, 58], DM: [50, 62], ML: [14, 44], MC: [50, 47], MR: [86, 44],
  AML: [16, 26], AMC: [50, 30], AMR: [84, 26], ST: [50, 12],
};

export function PlayerScreen({ id }: { id: number }) {
  const nav = useNav();
  const [tab, setTab] = useState('attrs');
  const [modal, setModal] = useState<React.ReactNode>(null);
  const p = G.players[id];
  if (!p) return <div className="muted">Игрок завершил карьеру</div>;
  const own = p.club === G.user && !p.loan;
  const onLoanHere = p.club === G.user && !!p.loan;
  const k = knowledge(p);
  const mask = k >= 80 ? 0 : k >= 60 ? 1 : 3;
  const isGK = p.pos[0] >= 15;
  const club = p.club >= 0 ? G.clubs[p.club] : null;
  const inShort = G.shortlist.includes(p.id);
  const scouting = G.scoutTasks.some((t) => t.id === p.id);
  const AttrGroup = ({ title, list }: { title: string; list: number[] }) => (
    <div className="ag">
      <h3>{title}</h3>
      {list.map((i) => <div key={i} className="ar"><span>{ATTR_NAMES[i]}</span><AttrVal v={p.a[i]} masked={mask} /></div>)}
    </div>
  );
  return (
    <div>
      <div className="panel">
        <div className="pb">
          <div className="row wrap" style={{ gap: 14 }}>
            <div className="col center" style={{ alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, background: club ? club.c1 : '#334', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: club ? (parseInt(club.c1.slice(1, 3), 16) > 180 ? '#111' : '#fff') : '#fff', border: `3px solid ${club ? club.c2 : '#556'}` }}>{p.shirt || '?'}</div>
            </div>
            <div className="grow" style={{ minWidth: 200 }}>
              <h1 style={{ marginBottom: 2 }}>{fullName(p)}</h1>
              <div className="row wrap small" style={{ gap: 8 }}>
                <Flag code={p.nat} /> {NATION[p.nat]?.name} · {age(p)} {plural(age(p), 'год', 'года', 'лет')} ({fmtDate(p.dob)}) · {p.h} см · {p.wt} кг
              </div>
              <div className="row wrap small" style={{ gap: 8, marginTop: 4 }}>
                {club ? <ClubName id={club.id} /> : <span className="chip">Свободный агент</span>}
                {p.loan && <span className="chip b">в аренде из «{G.clubs[p.loan.from].name}» до {fmtDate(p.loan.until)}</span>}
                <span className="muted">{posList(p) || POS_RU[mainPos(p)]}</span>
              </div>
            </div>
            <div className="kv" style={{ minWidth: 220 }}>
              <span>Уровень</span><span><Stars ca={p.ca} /> {k >= 80 && <span className="muted small">({p.ca})</span>}</span>
              <span>Потенциал</span><span>{k >= 80 ? <><Stars value={starsOf(p.pa)} /> <span className="muted small">({p.pa})</span></> : <span className="muted">нужен отчёт скаута</span>}</span>
              <span>Стоимость</span><span>{fmtMoney(p.value)}</span>
              <span>Зарплата</span><span>{fmtMoney(p.wage)}/нед</span>
              <span>Контракт</span><span>до {fmtDate(p.cEnd)}</span>
              <span>Нога</span><span>{p.fl >= 18 && p.fr >= 18 ? 'Обе' : p.fl > p.fr ? 'Левая' : 'Правая'}{(p.fl >= 14 && p.fr >= 14 && !(p.fl >= 18 && p.fr >= 18)) ? ' (хорошо обеими)' : ''}</span>
            </div>
          </div>
          <div className="row wrap" style={{ marginTop: 12 }}>
            {own && <>
              <button className="btn primary" onClick={() => setModal(<ContractModal pid={p.id} bidId={-1} renewal onClose={() => { setModal(null); refresh(); }} />)}>✍️ Продлить контракт</button>
              <button className="btn" onClick={() => { listPlayer(p, p.listed === 1 ? 0 : 1); refresh(); nav.toast(p.listed === 1 ? 'Выставлен на трансфер' : 'Снят с трансфера'); }}>{p.listed === 1 ? 'Снять с трансфера' : 'На трансфер'}</button>
              <button className="btn" onClick={() => { listPlayer(p, p.listed === 2 ? 0 : 2); refresh(); nav.toast(p.listed === 2 ? 'Доступен для аренды' : 'Снят с аренды'); }}>{p.listed === 2 ? 'Снять с аренды' : 'Отдать в аренду'}</button>
              <select className="input" style={{ width: 'auto' }} value={p.status} onChange={(e) => { p.status = +e.target.value; refresh(); }}>{STATUS_NAMES.map((s, i) => <option key={i} value={i}>{s}</option>)}</select>
              <select className="input" style={{ width: 'auto' }} value="" onChange={(e) => { if (e.target.value !== '') { nav.toast(talkToPlayer(p, +e.target.value)); refresh(); } }}>
                <option value="">💬 Поговорить...</option>
                {TALKS.map((t, i) => <option key={i} value={i}>{t}</option>)}
              </select>
              <button className="btn danger" onClick={() => { const cost = Math.round(p.wage * Math.max(0, (p.cEnd - G.day) / 7) * 0.6); if (confirm(`Расторгнуть контракт? Компенсация: ${fmtMoney(cost)}`)) { releasePlayer(p, true); refresh(); nav.back(); } }}>Расторгнуть</button>
            </>}
            {!own && !onLoanHere && G.user >= 0 && <>
              <button className="btn primary" onClick={() => setModal(<OfferModal pid={p.id} onClose={() => setModal(null)} />)}>{p.club < 0 ? '✍️ Предложить контракт' : '💶 Сделать предложение'}</button>
              {p.club >= 0 && <button className="btn" onClick={() => setModal(<OfferModal pid={p.id} loan onClose={() => setModal(null)} />)}>🔄 Аренда</button>}
              <button className="btn" onClick={() => { if (inShort) G.shortlist = G.shortlist.filter((x) => x !== p.id); else G.shortlist.push(p.id); refresh(); }}>{inShort ? '★ В шорт-листе' : '☆ В шорт-лист'}</button>
              {k < 100 && <button className="btn" disabled={scouting} onClick={() => { nav.toast(assignScout(p.id)); refresh(); }}>{scouting ? '🔭 Скаут работает' : '🔭 Отправить скаута'}</button>}
              {p.club >= 0 && <span className="small muted">Запрашиваемая сумма: ~{fmtMoney(askingPrice(p))}</span>}
            </>}
          </div>
        </div>
      </div>
      <Tabs tabs={[['attrs', 'Характеристики'], ['stats', 'Статистика'], ['career', 'Карьера'], ['info', 'Личность и форма']]} value={tab} onChange={setTab} />
      {tab === 'attrs' && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 220px' }}>
          <div className="panel"><div className="pb">
            {mask > 0 && <div className="chip y" style={{ marginBottom: 8 }}>Знания об игроке неполные ({k}%) — характеристики показаны диапазоном. Отправьте скаута.</div>}
            <div className="attrs">
              {isGK ? <AttrGroup title="Вратарские" list={GKA} /> : <AttrGroup title="Технические" list={TECH} />}
              <AttrGroup title="Ментальные" list={MENT} />
              <AttrGroup title="Физические" list={PHYS} />
            </div>
          </div></div>
          <div className="panel"><div className="ph">Позиции</div><div className="pb">
            <div className="pitch" style={{ maxWidth: 200 }}>
              {POS.map((pos, i) => {
                const f = p.pos[i];
                if (f < 5) return null;
                const [x, y] = PMAP[pos];
                const col = f >= 18 ? '#22c55e' : f >= 15 ? '#86efac' : f >= 10 ? '#facc15' : '#f97316';
                return <div key={pos} title={`${POS_FULL_RU[pos]}: ${f}`} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', width: 26, height: 26, borderRadius: '50%', background: col, border: '2px solid #fff', fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111' }}>{POS_RU[pos]}</div>;
              })}
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>Зелёный — естественная позиция, жёлтый — знакомая.</div>
          </div></div>
        </div>
      )}
      {tab === 'stats' && (
        <div className="panel"><div className="pb">
          <div className="kv">
            <span>Матчи</span><span>{p.st.apps} {p.st.sub ? `(+${p.st.sub} выходов на замену)` : ''}</span>
            <span>Минуты</span><span>{p.st.min}</span>
            <span>Голы</span><span>{p.st.gls}</span>
            <span>Голевые передачи</span><span>{p.st.ast}</span>
            <span>Сухие матчи</span><span>{p.st.cs}</span>
            <span>Жёлтые / красные</span><span>{p.st.yc} / {p.st.rc}</span>
            <span>Лучший игрок матча</span><span>{p.st.potm}</span>
            <span>Средняя оценка</span><span>{seasonAvg(p) ? seasonAvg(p).toFixed(2) : '—'}</span>
            <span>Последние оценки</span><span>{p.form.map((x) => x.toFixed(1)).join(' · ') || '—'}</span>
          </div>
        </div></div>
      )}
      {tab === 'career' && (
        <div className="panel tscroll"><table className="t">
          <thead><tr><th>Сезон</th><th>Клуб</th><th className="num">Игры</th><th className="num">Голы</th><th className="num">Пасы</th><th className="num">Ср.</th></tr></thead>
          <tbody>
            <tr><td>{G.season}/{(G.season + 1) % 100}</td><td>{club ? <ClubName id={club.id} size={16} /> : '—'}</td><td className="num">{p.st.apps + p.st.sub}</td><td className="num">{p.st.gls}</td><td className="num">{p.st.ast}</td><td className="num">{seasonAvg(p) ? seasonAvg(p).toFixed(2) : '—'}</td></tr>
            {p.hist.slice().reverse().map((h, i) => (
              <tr key={i}><td>{h.s}/{(h.s + 1) % 100}</td><td>{h.club >= 0 ? <ClubName id={h.club} size={16} /> : '—'} {h.loan ? <span className="chip tiny">аренда</span> : null}</td><td className="num">{h.apps}</td><td className="num">{h.gls}</td><td className="num">{h.ast}</td><td className="num">{h.rat ? h.rat.toFixed(2) : '—'}</td></tr>
            ))}
          </tbody>
        </table></div>
      )}
      {tab === 'info' && (
        <div className="grid g2">
          <div className="panel"><div className="ph">Состояние</div><div className="pb">
            <div className="kv">
              <span>Физ. готовность</span><span style={{ width: 120 }}><Bar v={p.cond} color={condColor(p.cond)} /></span>
              <span>Игровая форма</span><span style={{ width: 120 }}><Bar v={p.sharp} /></span>
              <span>Мораль</span><span>{moraleText(p.morale)}</span>
              <span>Травма</span><span>{p.inj && p.inj.until > G.day ? `${p.inj.name} (до ${fmtDate(p.inj.until)})` : 'Нет'}</span>
              <span>Статус</span><span>{STATUS_NAMES[p.status]}</span>
              <span>Репутация</span><span>{p.rep}/100</span>
            </div>
          </div></div>
          <div className="panel"><div className="ph">Личность</div><div className="pb">
            {k >= 80 ? (
              <div className="kv">
                {[H.PROF, H.AMB, H.LOY, H.PRES, H.TEMP, H.CONS, H.IMPM, H.INJP].map((i) => <React.Fragment key={i}><span>{HID_NAMES[i]}</span><span>{descr(p.hid[i], i === H.INJP)}</span></React.Fragment>)}
              </div>
            ) : <div className="muted">Требуется отчёт скаута.</div>}
          </div></div>
        </div>
      )}
      {modal}
    </div>
  );
}

function descr(v: number, inverse = false) {
  const x = inverse ? 21 - v : v;
  return x >= 17 ? 'Очень высокая' : x >= 13 ? 'Высокая' : x >= 9 ? 'Средняя' : x >= 5 ? 'Низкая' : 'Очень низкая';
}
