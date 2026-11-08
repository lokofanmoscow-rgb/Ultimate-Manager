import React, { useState } from 'react';
import { G, P } from '../../engine/state';
import { useNav, refresh, Modal, Stars, Seg, Bar, condColor, PosBadge, Tabs } from '../common';
import { FORMATIONS, FORMATION_KEYS, autoPick, slotScore, pickTakers, MENTALITY, PASSING, TEMPO, WIDTH, DLINE, LOE, PRESS, TACKLE, CROSS, FOCUS, DRIBBLE, GKDIST, makeTactic } from '../../engine/tactics';
import { rolesFor, ROLE_BY_ID, DUTY_RU, DUTY_SHORT, POS_RU, roleRating } from '../../engine/attrs';
import { fullName, shortName, isAvailable } from '../../engine/player';
import type { Club, Selection, TeamInstr } from '../../engine/types';

export function ensureSelection(club: Club): Selection {
  if (!club.sel || club.sel.lineup.every((x) => !x) || club.sel.auto) {
    const s = autoPick(club, 0, { rotate: false });
    s.auto = club.sel?.auto ?? true;
    club.sel = { ...s, auto: true };
  }
  return club.sel;
}

export function TacticsScreen({ embedded }: { embedded?: boolean }) {
  const nav = useNav();
  const [tab, setTab] = useState('lineup');
  const [slot, setSlot] = useState<number | null>(null);
  const [roleSlot, setRoleSlot] = useState<number | null>(null);
  if (G.user < 0) return <div className="muted">Нет клуба</div>;
  const club = G.clubs[G.user];
  const sel = ensureSelection(club);
  const slots = FORMATIONS[club.tactic.formation];
  const fam = club.famil[club.tactic.formation] ?? 40;
  const setFormation = (f: string) => {
    const old = club.tactic;
    club.tactic = { ...makeTactic(f), ti: old.ti, name: old.name };
    club.famil[f] = club.famil[f] ?? 35;
    const s = autoPick(club, 0, { rotate: false });
    club.sel = { ...s, auto: false };
    refresh();
  };
  const assign = (si: number, pid: number) => {
    const cur = sel.lineup[si];
    const other = sel.lineup.indexOf(pid);
    if (other >= 0) sel.lineup[other] = cur;
    else {
      const bi = sel.subs.indexOf(pid);
      if (bi >= 0) { if (cur) sel.subs[bi] = cur; else sel.subs.splice(bi, 1); }
    }
    sel.lineup[si] = pid;
    sel.auto = false;
    pickTakers(sel);
    setSlot(null);
    refresh();
  };
  const toBench = (pid: number) => {
    if (sel.subs.includes(pid)) sel.subs = sel.subs.filter((x) => x !== pid);
    else if (sel.subs.length < 9 && !sel.lineup.includes(pid)) sel.subs.push(pid);
    sel.auto = false;
    refresh();
  };
  const all = club.players.map(P).filter(Boolean);
  const ti = club.tactic.ti;
  const setTI = (patch: Partial<TeamInstr>) => { club.tactic.ti = { ...ti, ...patch }; refresh(); };
  return (
    <div>
      {!embedded && <div className="row wrap" style={{ marginBottom: 8 }}>
        <h1 className="grow" style={{ margin: 0 }}>Тактика</h1>
        <select className="input" style={{ width: 'auto' }} value={club.tactic.formation} onChange={(e) => setFormation(e.target.value)}>
          {FORMATION_KEYS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button className="btn" onClick={() => { club.sel = { ...autoPick(club, 0, { rotate: true }), auto: false }; refresh(); nav.toast('Ассистент подобрал состав'); }}>🤖 Автоподбор</button>
        <label className="row small"><input type="checkbox" checked={sel.auto} onChange={(e) => { sel.auto = e.target.checked; refresh(); }} /> Ассистент выбирает состав</label>
      </div>}
      <div className="row small" style={{ marginBottom: 8 }}><span className="muted">Сыгранность схемы:</span><div style={{ width: 140 }}><Bar v={fam} /></div><span>{Math.round(fam)}%</span></div>
      <Tabs tabs={[['lineup', 'Состав и роли'], ['ti', 'Командные инструкции'], ['sp', 'Стандарты']]} value={tab} onChange={setTab} />
      {tab === 'lineup' && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 440px) minmax(0, 1fr)' }}>
          <div>
            <div className="pitch">
              <div className="ln" style={{ left: '20%', right: '20%', top: -2, height: '14%' }} />
              <div className="ln" style={{ left: '20%', right: '20%', bottom: -2, height: '14%' }} />
              <div className="ln" style={{ left: 0, right: 0, top: '50%', height: 0 }} />
              <div className="ln" style={{ left: '38%', width: '24%', top: '43%', height: '14%', borderRadius: '50%' }} />
              {slots.map((s, i) => {
                const pid = sel.lineup[i];
                const p = pid ? G.players[pid] : null;
                const role = ROLE_BY_ID[club.tactic.slots[i].role];
                const x = 50 + s.y * 42;
                const y = 94 - s.x * 105;
                return (
                  <div key={i} className={'pslot' + (slot === i ? ' sel' : '') + (p ? '' : ' empty')} style={{ left: `${x}%`, top: `${Math.max(6, Math.min(94, y))}%` }} onClick={() => setSlot(i)}>
                    <div className="shirt" style={{ background: s.pos === 'GK' ? '#e9b800' : club.c1, color: s.pos === 'GK' ? '#111' : club.c2 === '#ffffff' && club.c1 === '#ffffff' ? '#111' : club.c2 }}>{p ? p.shirt : '+'}</div>
                    <div className="nm">{p ? shortName(p) : POS_RU[s.pos]}</div>
                    <div className="rl" onClick={(e) => { e.stopPropagation(); setRoleSlot(i); }}>{role?.short} · {DUTY_SHORT[club.tactic.slots[i].duty]} ✎</div>
                    {p && <div style={{ width: 40, margin: '1px auto 0' }}><Bar v={p.cond} color={condColor(p.cond)} /></div>}
                  </div>
                );
              })}
            </div>
            <div className="small muted center" style={{ marginTop: 6 }}>Нажмите на игрока, чтобы заменить; на роль — чтобы изменить роль и задачу.</div>
          </div>
          <div className="panel">
            <div className="ph">Запасные ({sel.subs.length}/9)</div>
            <table className="t"><tbody>
              {all.filter((p) => !sel.lineup.includes(p.id)).sort((a, b) => (sel.subs.includes(b.id) ? 1 : 0) - (sel.subs.includes(a.id) ? 1 : 0) || b.ca - a.ca).map((p) => (
                <tr key={p.id} className={sel.subs.includes(p.id) ? 'me' : ''}>
                  <td><PosBadge p={p} /></td>
                  <td className="ellipsis" style={{ maxWidth: 170 }} onClick={() => nav.openPlayer(p.id)}>{fullName(p)} {!isAvailable(p, 0) && <span className="chip r tiny">недоступен</span>}</td>
                  <td><Stars ca={p.ca} /></td>
                  <td style={{ width: 50 }}><Bar v={p.cond} color={condColor(p.cond)} /></td>
                  <td><button className="btn sm" onClick={() => toBench(p.id)}>{sel.subs.includes(p.id) ? 'Убрать' : 'В запас'}</button></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}
      {tab === 'ti' && (
        <div className="grid g2">
          <div className="panel"><div className="ph">Общий настрой</div><div className="pb">
            <div className="field"><label>Менталитет: <b>{MENTALITY[ti.mentality]}</b></label><input type="range" min={0} max={6} value={ti.mentality} onChange={(e) => setTI({ mentality: +e.target.value })} /></div>
            <h3>С мячом</h3>
            <div className="field"><label>Длина передач</label><Seg options={PASSING} value={ti.passing} onChange={(v) => setTI({ passing: v })} /></div>
            <div className="field"><label>Темп</label><Seg options={TEMPO} value={ti.tempo} onChange={(v) => setTI({ tempo: v })} /></div>
            <div className="field"><label>Ширина атаки</label><Seg options={WIDTH} value={ti.width} onChange={(v) => setTI({ width: v })} /></div>
            <div className="field"><label>Направление атак</label><Seg options={FOCUS} value={ti.focus} onChange={(v) => setTI({ focus: v })} /></div>
            <div className="field"><label>Навесы</label><Seg options={CROSS} value={ti.cross} onChange={(v) => setTI({ cross: v })} /></div>
            <div className="field"><label>Дриблинг</label><Seg options={DRIBBLE} value={ti.dribble} onChange={(v) => setTI({ dribble: v })} /></div>
            <Toggle label="Розыгрыш от защиты" v={ti.playOut} on={(v) => setTI({ playOut: v })} />
            <Toggle label="Бить при любой возможности" v={ti.shootOnSight} on={(v) => setTI({ shootOnSight: v })} />
            <Toggle label="Заводить мяч в штрафную" v={ti.workIntoBox} on={(v) => setTI({ workIntoBox: v })} />
            <Toggle label="Тянуть время" v={ti.timeWaste} on={(v) => setTI({ timeWaste: v })} />
          </div></div>
          <div className="panel"><div className="ph">Без мяча и переходы</div><div className="pb">
            <div className="field"><label>Линия обороны</label><Seg options={DLINE} value={ti.dline} onChange={(v) => setTI({ dline: v })} /></div>
            <div className="field"><label>Линия прессинга</label><Seg options={LOE} value={ti.loe} onChange={(v) => setTI({ loe: v })} /></div>
            <div className="field"><label>Интенсивность прессинга</label><Seg options={PRESS} value={ti.press} onChange={(v) => setTI({ press: v })} /></div>
            <div className="field"><label>Отбор</label><Seg options={TACKLE} value={ti.tackle} onChange={(v) => setTI({ tackle: v })} /></div>
            <div className="field"><label>Ввод мяча вратарём</label><Seg options={GKDIST} value={ti.gkDist} onChange={(v) => setTI({ gkDist: v })} /></div>
            <Toggle label="Контратака после отбора" v={ti.counter} on={(v) => setTI({ counter: v })} />
            <Toggle label="Контрпрессинг после потери" v={ti.counterPress} on={(v) => setTI({ counterPress: v })} />
            <Toggle label="Ловить в офсайд" v={ti.offside} on={(v) => setTI({ offside: v })} />
            <hr />
            <div className="row wrap">
              <span className="muted small">Пресеты:</span>
              <button className="btn sm" onClick={() => setTI({ mentality: 5, tempo: 3, press: 3, loe: 2, dline: 3, counterPress: true, passing: 1 })}>Гегенпрессинг</button>
              <button className="btn sm" onClick={() => setTI({ mentality: 4, passing: 0, tempo: 1, playOut: true, workIntoBox: true, press: 2 })}>Тики-така</button>
              <button className="btn sm" onClick={() => setTI({ mentality: 1, passing: 3, tempo: 3, loe: 0, dline: 1, counter: true, press: 0 })}>Контратаки</button>
              <button className="btn sm" onClick={() => setTI({ mentality: 0, loe: 0, dline: 0, press: 0, tackle: 1, timeWaste: true })}>Автобус</button>
            </div>
          </div></div>
        </div>
      )}
      {tab === 'sp' && (
        <div className="panel"><div className="pb">
          {([['cap', 'Капитан'], ['pen', 'Пенальти'], ['fk', 'Штрафные'], ['crn', 'Угловые']] as const).map(([k, label]) => (
            <div className="field" key={k}><label>{label}</label>
              <select className="input" value={(sel as any)[k]} onChange={(e) => { (sel as any)[k] = +e.target.value; sel.auto = false; refresh(); }}>
                {sel.lineup.filter((x) => x).map((id) => <option key={id} value={id}>{fullName(P(id))}</option>)}
              </select>
            </div>
          ))}
        </div></div>
      )}
      {slot != null && (
        <Modal title={`Позиция: ${POS_RU[slots[slot].pos]}`} onClose={() => setSlot(null)}>
          <table className="t"><tbody>
            {all.map((p) => ({ p, s: slotScore(p, slots[slot], club.tactic.slots[slot].role) })).sort((a, b) => b.s - a.s).map(({ p, s }) => (
              <tr key={p.id} className={'click' + (sel.lineup[slot] === p.id ? ' me' : '')} onClick={() => assign(slot, p.id)}>
                <td><PosBadge p={p} /></td>
                <td>{fullName(p)} {sel.lineup.includes(p.id) && <span className="chip g tiny">XI</span>} {!isAvailable(p, 0) && <span className="chip r tiny">недоступен</span>}</td>
                <td><Stars value={Math.max(0.5, Math.min(5, Math.round(((s - 40) / 30) * 2) / 2))} /></td>
                <td style={{ width: 50 }}><Bar v={p.cond} color={condColor(p.cond)} /></td>
              </tr>
            ))}
          </tbody></table>
        </Modal>
      )}
      {roleSlot != null && (
        <Modal title={`Роль: ${POS_RU[slots[roleSlot].pos]}`} onClose={() => setRoleSlot(null)}>
          {rolesFor(slots[roleSlot].pos).map((r) => {
            const pid = sel.lineup[roleSlot];
            const suit = pid ? roleRating(P(pid).a, r) : 0;
            return (
              <div key={r.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="grow"><b>{r.name}</b><div className="tiny muted">Ключевые: {r.key.map((k) => ({ FIN: 'зав.', PAS: 'пас', TEC: 'тех.', DRI: 'дриб.', VIS: 'вид.', TCK: 'отб.', MAR: 'опека', POS: 'поз.', HEA: 'гол.', STR: 'сила', PAC: 'скор.', ACC: 'уск.', STA: 'вын.', WOR: 'раб.', CRO: 'нав.', OTB: 'б/м', ANT: 'предв.', CMP: 'хлад.', DEC: 'реш.', FIR: 'пр.кас.', JUM: 'прыг.', BRA: 'храбр.', TEA: 'ком.', AGG: 'агр.', CNT: 'конц.', FLA: 'имп.', LON: 'дал.уд.', BAL: 'равн.', AGI: 'лов.', REF: 'реак.', HAN: 'руки', ONE: '1на1', AER: 'выходы', CMD: 'шрф.', KIC: 'выбив.', RUS: 'выходы', LDR: 'лид.' } as any)[k] || k).join(', ')}</div></div>
                {pid ? <Stars value={Math.max(0.5, Math.min(5, Math.round((suit / 4) * 2) / 2))} /> : null}
                <div className="seg">
                  {r.duties.map((d) => (
                    <button key={d} className={club.tactic.slots[roleSlot].role === r.id && club.tactic.slots[roleSlot].duty === d ? 'on' : ''} onClick={() => { club.tactic.slots[roleSlot] = { role: r.id, duty: d }; refresh(); setRoleSlot(null); }}>{DUTY_RU[d]}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </Modal>
      )}
    </div>
  );
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return <label className="row" style={{ padding: '5px 0' }}><input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} /> {label}</label>;
}
