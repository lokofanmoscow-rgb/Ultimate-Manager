import React, { useEffect, useState } from 'react';
import { G } from '../../engine/state';
import { generateWorld, startCareer } from '../../engine/game';
import { listSaves, loadFromSlot, deleteSlot, SaveMeta } from '../../engine/save';
import { NATIONS, ASSOCS, LEAGUE_DEF } from '../../data/nations';
import { Crest, Flag, Stars, Money } from '../common';
import { dayOf, fmtDate, fmtMoney } from '../../engine/util';
import { expectedPosition } from '../../engine/board';
import { fullName, mainPos } from '../../engine/player';
import { POS_RU } from '../../engine/attrs';

export function StartScreen({ onNew, onLoaded }: { onNew: () => void; onLoaded: () => void }) {
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [showLoad, setShowLoad] = useState(false);
  useEffect(() => { listSaves().then(setSaves); }, []);
  const load = async (slot: string) => {
    setLoading(slot);
    try {
      const ok = await loadFromSlot(slot);
      if (ok) onLoaded();
    } catch (e) {
      alert('Не удалось загрузить сохранение: ' + e);
    }
    setLoading(null);
  };
  if (loading) return <div className="loading"><div className="spinner" /><div>Загрузка сохранения...</div></div>;
  return (
    <div className="start">
      <div className="card">
        <div className="logo">ULTIMATE MANAGER</div>
        <div className="muted" style={{ marginBottom: 20 }}>Футбольный менеджер · Все лиги УЕФА · Сезон 2026/27</div>
        <button className="btn primary" onClick={onNew}>⚽ Новая карьера</button>
        <button className="btn" onClick={() => setShowLoad(!showLoad)} disabled={!saves.length}>📂 Загрузить игру {saves.length ? `(${saves.length})` : ''}</button>
        {saves.length > 0 && !showLoad && (
          <button className="btn gold" onClick={() => load(saves[0].slot)}>▶ Продолжить: {saves[0].club}, {fmtDate(saves[0].date)}</button>
        )}
        {showLoad && (
          <div className="panel" style={{ marginTop: 12, textAlign: 'left' }}>
            {saves.map((s) => (
              <div key={s.slot} className="msg" onClick={() => load(s.slot)}>
                <div className="grow">
                  <div><b>{s.slot === 'autosave' ? 'Автосохранение' : `Слот ${s.slot.replace('slot', '')}`}</b> — {s.club}</div>
                  <div className="small muted">{s.name} · {fmtDate(s.date)} · сохранено {new Date(s.saved).toLocaleString('ru-RU')}</div>
                </div>
                <button className="btn sm danger" onClick={async (e) => { e.stopPropagation(); if (confirm('Удалить сохранение?')) { await deleteSlot(s.slot); setSaves(await listSaves()); } }}>🗑</button>
              </div>
            ))}
          </div>
        )}
        <div className="small muted" style={{ marginTop: 24 }}>Версия 0.1 · Данные игроков и клубов приблизительные</div>
      </div>
    </div>
  );
}

const EXPERIENCE = ['Нет опыта', 'Любительский футбол', 'Полупрофессионал', 'Профессиональный игрок', 'Игрок сборной'];
const BADGES = ['Без лицензии', 'Лицензия C', 'Лицензия B', 'Лицензия A', 'Лицензия Pro'];
const STYLES = ['Сбалансированный', 'Атакующий', 'Оборонительный', 'Контратакующий', 'Владение мячом', 'Прессинг'];

export function NewGameScreen({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const [fn, setFn] = useState('');
  const [ln, setLn] = useState('');
  const [nat, setNat] = useState('RUS');
  const [ageY, setAge] = useState(38);
  const [exp, setExp] = useState(2);
  const [badge, setBadge] = useState(3);
  const [style, setStyle] = useState(0);
  const [progress, setProgress] = useState(0);
  const [country, setCountry] = useState('RUS');
  const [league, setLeague] = useState('RUS1');
  const [club, setClub] = useState<number | null>(null);
  const [, setV] = useState(0);

  const startGen = async () => {
    setStep(1);
    await new Promise((r) => setTimeout(r, 50));
    await generateWorld((Date.now() & 0x7fffffff) ^ 0x5bd1e995, async (p) => {
      setProgress(p);
      await new Promise((r) => setTimeout(r, 0));
    });
    setStep(2);
    setV((v) => v + 1);
  };

  if (step === 0) {
    const ok = fn.trim() && ln.trim();
    return (
      <div className="start">
        <div className="card" style={{ textAlign: 'left', width: 'min(560px, 100%)' }}>
          <h1>Новый тренер</h1>
          <div className="grid g2">
            <div className="field"><label>Имя</label><input className="input" value={fn} onChange={(e) => setFn(e.target.value)} placeholder="Иван" /></div>
            <div className="field"><label>Фамилия</label><input className="input" value={ln} onChange={(e) => setLn(e.target.value)} placeholder="Петров" /></div>
            <div className="field"><label>Национальность</label>
              <select className="input" value={nat} onChange={(e) => setNat(e.target.value)}>
                {NATIONS.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((n) => <option key={n.code} value={n.code}>{n.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Возраст: {ageY}</label><input type="range" min={25} max={72} value={ageY} onChange={(e) => setAge(+e.target.value)} /></div>
            <div className="field"><label>Игровая карьера</label>
              <select className="input" value={exp} onChange={(e) => setExp(+e.target.value)}>{EXPERIENCE.map((x, i) => <option key={i} value={i}>{x}</option>)}</select>
            </div>
            <div className="field"><label>Тренерская лицензия</label>
              <select className="input" value={badge} onChange={(e) => setBadge(+e.target.value)}>{BADGES.map((x, i) => <option key={i} value={i}>{x}</option>)}</select>
            </div>
            <div className="field"><label>Тренерский стиль</label>
              <select className="input" value={style} onChange={(e) => setStyle(+e.target.value)}>{STYLES.map((x, i) => <option key={i} value={i}>{x}</option>)}</select>
            </div>
            <div className="field"><label>Стартовая репутация</label><div className="row"><Stars value={Math.round((15 + exp * 6 + badge * 6) / 20 * 2) / 2} /><span className="muted small">{15 + exp * 6 + badge * 6}/100</span></div></div>
          </div>
          <div className="small muted">Репутация влияет на ожидания совета директоров и на то, какие клубы будут готовы вас нанять в будущем. Начать можно с любого клуба.</div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={onCancel}>Назад</button>
            <div className="grow" />
            <button className="btn primary" disabled={!ok} onClick={startGen}>Создать мир →</button>
          </div>
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="loading">
        <div className="spinner" />
        <div>Генерация футбольного мира: {ASSOCS.length} стран, 1200+ клубов, 35 000 игроков...</div>
        <div style={{ width: 280 }}><div className="bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div></div>
      </div>
    );
  }
  // step 2: choose club
  const assoc = ASSOCS.find((a) => a.code === country)!;
  const clubs = G.clubs.filter((c) => c.league === league).sort((a, b) => b.rep - a.rep);
  const sel = club != null ? G.clubs[club] : null;
  const finish = () => {
    if (club == null) return;
    startCareer({ fn: fn.trim(), ln: ln.trim(), nat, dob: dayOf(2026 - ageY, 3, 15), rep: 15 + exp * 6 + badge * 6, exp, badge, style: STYLES[style] }, club);
    onDone();
  };
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="topbar"><div className="title grow">Выберите клуб</div><button className="continue" disabled={club == null} onClick={finish}>Начать карьеру ▶</button></div>
      <div className="body">
        <div className="side" style={{ width: 190, flex: '0 0 190px' }}>
          {ASSOCS.slice().sort((a, b) => a.rank - b.rank).map((a) => (
            <button key={a.code} className={country === a.code ? 'on' : ''} onClick={() => { setCountry(a.code); setLeague(a.leagues[0].id); setClub(null); }}>
              <Flag code={a.code} size={14} /><span className="ellipsis">{NATIONS.find((n) => n.code === a.code)?.name}</span>
            </button>
          ))}
        </div>
        <div className="main">
          <div className="tabs">
            {assoc.leagues.map((l) => <button key={l.id} className={league === l.id ? 'on' : ''} onClick={() => { setLeague(l.id); setClub(null); }}>{l.name}</button>)}
          </div>
          <div className="grid" style={{ gridTemplateColumns: sel ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr' }}>
            <div className="cardlist" style={{ alignContent: 'start' }}>
              {clubs.map((c) => (
                <div key={c.id} className={'clubcard' + (club === c.id ? ' on' : '')} onClick={() => setClub(c.id)}>
                  <Crest club={c} size={36} />
                  <div className="grow">
                    <div className="ellipsis"><b>{c.name}</b></div>
                    <div className="row small muted"><Stars value={Math.max(0.5, Math.round(c.rep / 10) / 2)} /> · {fmtMoney(c.fin.tBudget)}</div>
                  </div>
                </div>
              ))}
            </div>
            {sel && <ClubPreview id={sel.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClubPreview({ id }: { id: number }) {
  const c = G.clubs[id];
  const players = c.players.map((pid) => G.players[pid]!).filter(Boolean).sort((a, b) => b.ca - a.ca);
  const ld = c.league ? LEAGUE_DEF[c.league] : null;
  const pos = expectedPosition(c);
  return (
    <div className="panel" style={{ alignSelf: 'start', position: 'sticky', top: 0 }}>
      <div className="pb">
        <div className="row"><Crest club={c} size={56} /><div><h2 style={{ margin: 0 }}>{c.name}</h2><div className="muted small">{ld?.name} · {c.stadium} ({c.cap} тыс.)</div></div></div>
        <hr />
        <div className="kv">
          <span>Репутация</span><span><Stars value={Math.max(0.5, Math.round(c.rep / 10) / 2)} /></span>
          <span>Прогноз</span><span>{pos}-е место</span>
          <span>Баланс</span><span><Money v={c.fin.balance} /></span>
          <span>Трансферы</span><span>{fmtMoney(c.fin.tBudget)}</span>
          <span>Зарплаты</span><span>{fmtMoney(c.fin.wBudget)}/нед</span>
          <span>База / академия</span><span>{c.facT}/20 · {c.facY}/20</span>
          <span>Игроков</span><span>{players.length}</span>
        </div>
        <hr />
        <h3>Лучшие игроки</h3>
        <table className="t"><tbody>
          {players.slice(0, 8).map((p) => (
            <tr key={p.id}><td><Flag code={p.nat} size={12} /></td><td className="ellipsis" style={{ maxWidth: 160 }}>{fullName(p)}</td><td>{POS_RU[mainPos(p)]}</td><td><Stars ca={p.ca} /></td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}
