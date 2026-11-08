import React, { useState } from 'react';
import { G } from '../../engine/state';
import { useNav, refresh, Flag, Stars, Tabs, Seg, Modal, AttrVal, Bar } from '../common';
import { STAFF_ROLES, STAFF_ATTRS, staffRating, hireStaff, fireStaff } from '../../engine/staff';
import { coachingQuality } from '../../engine/dev';
import { fmtMoney, fmtDate, ageAt } from '../../engine/util';
import type { Staff } from '../../engine/types';

const FOCUS = ['Сбалансированно', 'Атака', 'Оборона', 'Тактика', 'Физподготовка', 'Стандарты'];
const FOCUS_DESC = [
  'Равномерное развитие всех навыков в зависимости от позиции игрока.',
  'Завершение, игра без мяча, дриблинг, техника, дальние удары.',
  'Отбор, опека, выбор позиции, игра головой, концентрация.',
  'Решения, предвидение, командная игра, видение поля. Быстрее растёт сыгранность схемы.',
  'Скорость, ускорение, выносливость, сила, ловкость. Выше риск травм.',
  'Угловые, штрафные, пенальти, навесы.',
];

export function TrainingScreen() {
  if (G.user < 0) return <div className="muted">Нет клуба</div>;
  const club = G.clubs[G.user];
  const cq = coachingQuality(club);
  return (
    <div>
      <h1>Тренировки</h1>
      <div className="grid g2">
        <div className="panel"><div className="ph">Фокус тренировок</div><div className="pb">
          <Seg options={FOCUS} value={G.training.focus} onChange={(v) => { G.training.focus = v; refresh(); }} />
          <p className="small muted">{FOCUS_DESC[G.training.focus]}</p>
          <hr />
          <div className="field"><label>Интенсивность</label><Seg options={['Низкая', 'Средняя', 'Высокая']} value={G.training.intensity} onChange={(v) => { G.training.intensity = v; refresh(); }} /></div>
          <p className="small muted">Высокая интенсивность ускоряет развитие, но игроки медленнее восстанавливаются и чаще травмируются. Низкая — быстрое восстановление перед плотным календарём.</p>
        </div></div>
        <div className="panel"><div className="ph">Условия</div><div className="pb">
          <div className="kv">
            <span>Тренировочная база</span><span><Bar v={club.facT} max={20} /> {club.facT}/20</span>
            <span>Академия</span><span><Bar v={club.facY} max={20} /> {club.facY}/20</span>
            <span>Качество тренеров</span><span><Bar v={cq} /> {Math.round(cq)}%</span>
          </div>
          <p className="small muted">Развитие игроков зависит от возраста, потенциала, игровой практики, профессионализма, качества тренеров и базы. Молодые игроки растут быстрее, после 30 лет начинается спад физических качеств.</p>
        </div></div>
      </div>
    </div>
  );
}

export function StaffScreen() {
  const nav = useNav();
  const [tab, setTab] = useState('mine');
  const [view, setView] = useState<Staff | null>(null);
  const [role, setRole] = useState<string>('all');
  if (G.user < 0) return <div className="muted">Нет клуба</div>;
  const club = G.clubs[G.user];
  const list = (tab === 'mine' ? club.staff.map((id) => G.staff[id]!) : (G.staff.filter((s) => s && s.club < 0) as Staff[])).filter((s) => s && (role === 'all' || s.role === role));
  list.sort((a, b) => a.role.localeCompare(b.role) || staffRating(b) - staffRating(a));
  return (
    <div>
      <h1>Персонал</h1>
      <Tabs tabs={[['mine', `Штаб клуба (${club.staff.length})`], ['market', 'Свободные специалисты']]} value={tab} onChange={setTab} />
      <div className="seg" style={{ marginBottom: 8 }}>
        <button className={role === 'all' ? 'on' : ''} onClick={() => setRole('all')}>Все</button>
        {Object.entries(STAFF_ROLES).map(([k, v]) => <button key={k} className={role === k ? 'on' : ''} onClick={() => setRole(k)}>{v}</button>)}
      </div>
      <div className="panel tscroll"><table className="t">
        <thead><tr><th>Имя</th><th>Должность</th><th>Возраст</th><th>Уровень</th><th className="num">Зарплата</th><th>Контракт</th><th /></tr></thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id} className="click" onClick={() => setView(s)}>
              <td><span className="row"><Flag code={s.nat} size={12} />{s.fn} {s.ln}</span></td>
              <td className="small">{STAFF_ROLES[s.role]}</td>
              <td>{ageAt(s.dob, G.day)}</td>
              <td><Stars value={Math.max(0.5, Math.min(5, Math.round(staffRating(s) / 4 * 2) / 2))} /></td>
              <td className="num">{fmtMoney(s.wage)}/нед</td>
              <td className="small">{s.club >= 0 ? fmtDate(s.cEnd) : '—'}</td>
              <td>
                {tab === 'market' ? <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); nav.toast(hireStaff(s.id)); refresh(); }}>Нанять</button>
                  : <button className="btn sm danger" onClick={(e) => { e.stopPropagation(); if (confirm('Уволить сотрудника?')) { nav.toast(fireStaff(s.id)); refresh(); } }}>Уволить</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {view && (
        <Modal title={`${view.fn} ${view.ln} — ${STAFF_ROLES[view.role]}`} onClose={() => setView(null)}>
          <div className="attrs">
            {[[0, 8, 'Тренерские'], [8, 13, 'Ментальные'], [13, 18, 'Знания и медицина']].map(([a, b, t]) => (
              <div className="ag" key={t as string}><h3>{t}</h3>
                {STAFF_ATTRS.slice(a as number, b as number).map((n, i) => <div className="ar" key={n}><span>{n}</span><AttrVal v={view.a[(a as number) + i]} /></div>)}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
