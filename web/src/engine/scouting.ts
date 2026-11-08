import type { Player } from './types';
import { G, R } from './state';
import { addMsg } from './inbox';
import { fullName, age } from './player';
import { scoutJudging } from './staff';
import { stars, POS_RU } from './attrs';
import { mainPos } from './player';
import { fmtMoney, clamp } from './util';

export function knowledge(p: Player): number {
  if (G.user < 0) return 100;
  if (p.club === G.user) return 100;
  if (G.scouted[p.id]) return G.scouted[p.id];
  const uc = G.clubs[G.user];
  const pc = p.club >= 0 ? G.clubs[p.club] : null;
  if (pc && pc.league && pc.league === uc.league) return 85;
  if (pc && pc.country === uc.country) return 65;
  if (p.rep >= 72) return 65;
  return 40;
}

export function assignScout(pid: number): string {
  if (G.scoutTasks.some((t) => t.id === pid)) return 'Скаут уже наблюдает за этим игроком.';
  const scouts = G.user >= 0 ? G.clubs[G.user].staff.filter((id) => G.staff[id]?.role === 'SCOUT').length : 0;
  if (G.scoutTasks.length >= Math.max(2, scouts * 3)) return 'Все скауты заняты. Наймите больше скаутов или дождитесь отчётов.';
  G.scoutTasks.push({ id: pid, target: 'player', until: G.day + R.int(5, 10) });
  return 'Скаут отправлен. Отчёт будет готов через несколько дней.';
}

export function dailyScouting() {
  if (G.user < 0 || !G.scoutTasks.length) return;
  const ready = G.scoutTasks.filter((t) => t.until <= G.day);
  G.scoutTasks = G.scoutTasks.filter((t) => t.until > G.day);
  const judge = scoutJudging();
  for (const t of ready) {
    const p = G.players[t.id];
    if (!p) continue;
    G.scouted[p.id] = 100;
    const err = (20 - judge) * 1.2;
    const caEst = clamp(p.ca + R.gauss(0, err), 1, 200);
    const paEst = clamp(p.pa + R.gauss(0, err * 1.5), caEst, 200);
    const club = G.clubs[G.user];
    const starters = club.players.map((id) => G.players[id]!).filter(Boolean).sort((a, b) => b.ca - a.ca);
    const ref = starters[10]?.ca ?? 100;
    const verdict = caEst >= ref + 10 ? 'A — значительно усилит основу' : caEst >= ref ? 'B — уровень основного состава' : paEst >= ref + 5 && age(p) <= 21 ? 'B — перспективный, может вырасти в игрока основы' : caEst >= ref - 12 ? 'C — игрок ротации' : 'D — не подходит';
    addMsg({
      from: 'Скаутский отдел', subj: `Отчёт скаута: ${fullName(p)}`, kind: 'scout', data: { pid: p.id },
      body: `${fullName(p)} (${POS_RU[mainPos(p)]}, ${age(p)} лет)\n\nТекущий уровень: ${'★'.repeat(Math.floor(stars(caEst)))}${stars(caEst) % 1 ? '½' : ''}\nПотенциал: ${'★'.repeat(Math.floor(stars(paEst)))}${stars(paEst) % 1 ? '½' : ''}\nОценка стоимости: ${fmtMoney(p.value)}\n\nРекомендация: ${verdict}.`,
    });
  }
}
