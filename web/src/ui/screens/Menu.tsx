import React, { useEffect, useState } from 'react';
import { G } from '../../engine/state';
import { useNav, refresh, Seg } from '../common';
import { saveToSlot, listSaves, loadFromSlot, deleteSlot, SaveMeta } from '../../engine/save';
import { fmtDate } from '../../engine/util';

const SLOTS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5'];

export function MenuScreen({ onExit }: { onExit: () => void }) {
  const nav = useNav();
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const reload = () => listSaves().then(setSaves);
  useEffect(() => { reload(); }, []);
  const save = async (slot: string) => {
    setBusy('Сохранение...');
    try { await saveToSlot(slot); nav.toast('Игра сохранена'); } catch (e) { nav.toast('Ошибка сохранения: ' + e); }
    setBusy(null);
    reload();
  };
  const load = async (slot: string) => {
    if (!confirm('Загрузить игру? Несохранённый прогресс будет потерян.')) return;
    setBusy('Загрузка...');
    try { await loadFromSlot(slot); refresh(); nav.go('home'); } catch (e) { nav.toast('Ошибка загрузки: ' + e); }
    setBusy(null);
  };
  return (
    <div>
      <h1>Меню</h1>
      {busy && <div className="chip b" style={{ marginBottom: 10 }}>{busy}</div>}
      <div className="panel"><div className="ph">Слоты сохранений</div>
        <table className="t"><tbody>
          {[...SLOTS, 'autosave'].map((slot) => {
            const m = saves.find((s) => s.slot === slot);
            return (
              <tr key={slot}>
                <td><b>{slot === 'autosave' ? 'Автосохранение' : `Слот ${slot.slice(4)}`}</b></td>
                <td className="small">{m ? `${m.club} · ${fmtDate(m.date)} · ${(m.size / 1e6).toFixed(1)} МБ` : <span className="muted">пусто</span>}</td>
                <td className="right nowrap">
                  {slot !== 'autosave' && <button className="btn sm primary" disabled={!!busy} onClick={() => save(slot)}>Сохранить</button>}{' '}
                  {m && <button className="btn sm" disabled={!!busy} onClick={() => load(slot)}>Загрузить</button>}{' '}
                  {m && <button className="btn sm danger" disabled={!!busy} onClick={async () => { if (confirm('Удалить?')) { await deleteSlot(slot); reload(); } }}>🗑</button>}
                </td>
              </tr>
            );
          })}
        </tbody></table>
      </div>
      <div className="panel"><div className="ph">Настройки</div><div className="pb">
        <div className="field"><label>Режим просмотра матча по умолчанию</label>
          <Seg options={['Полный матч', 'Расширенные моменты', 'Ключевые моменты', 'Только текст']} value={G.settings.mode} onChange={(v) => { G.settings.mode = v; refresh(); }} />
        </div>
        <label className="row"><input type="checkbox" checked={G.settings.autosave} onChange={(e) => { G.settings.autosave = e.target.checked; refresh(); }} /> Автосохранение после матчей</label>
      </div></div>
      <div className="panel"><div className="ph">Об игре</div><div className="pb small">
        <p><b>Ultimate Manager</b> — футбольный менеджер со всеми лигами УЕФА (54 ассоциации, включая РПЛ с участием в еврокубках), низшими дивизионами, национальными кубками (Кубок России — в классическом формате плей-офф, клубы РПЛ стартуют с 1/16 финала) и еврокубками в формате 2024+.</p>
        <p className="muted">Составы и рейтинги игроков приблизительные: ключевые игроки топ-клубов реальные, остальные сгенерированы. Эмблемы стилизованы.</p>
        <button className="btn" onClick={onExit}>Выйти в главное меню</button>
      </div></div>
    </div>
  );
}
