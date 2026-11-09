// Manager-player conversations (FM-style): praise, criticism, playing time.
import type { Player } from './types';
import { G, R } from './state';
import { H } from './attrs';
import { clamp } from './util';
import { fullName } from './player';

export const TALKS = ['Похвалить за игру', 'Раскритиковать игру', 'Обсудить игровое время', 'Попросить больше отдачи на тренировках'];

export function talkToPlayer(p: Player, kind: number): string {
  const key = `talk${p.id}`;
  const last = G.flags[key] || -999;
  if (G.day - last < 14) return `${fullName(p)}: «Мы же недавно разговаривали, тренер».`;
  G.flags[key] = G.day;
  const form = p.form.length ? p.form.reduce((s, x) => s + x, 0) / p.form.length : 6.6;
  const temp = p.hid[H.TEMP], prof = p.hid[H.PROF], pres = p.hid[H.PRES];
  let d = 0, text = '';
  if (kind === 0) {
    if (form >= 7) { d = 8; text = 'благодарен за похвалу и полон уверенности'; }
    else if (form >= 6.5) { d = 4; text = 'рад услышать добрые слова'; }
    else { d = -3; text = 'удивлён похвалой — он сам недоволен своей игрой'; }
  } else if (kind === 1) {
    if (form < 6.5) {
      if (prof >= 13 || pres >= 13) { d = 5; text = 'признаёт критику и обещает исправиться'; }
      else if (temp <= 8) { d = -10; text = 'воспринял критику в штыки'; }
      else { d = -2; text = 'не очень доволен, но принял ваши слова к сведению'; }
    } else { d = -9; text = 'считает критику несправедливой — он играет хорошо'; }
  } else if (kind === 2) {
    if (p.status <= 1 && (p.lastGame == null || G.day - p.lastGame > 20)) { d = 6; p.unhappy = undefined; text = 'доволен, что вы пообещали ему больше игрового времени'; }
    else if (p.status >= 3) { d = 2; text = 'понимает свою роль в команде'; }
    else { d = 1; text = 'доволен своим игровым временем'; }
  } else {
    if (prof >= 12) { d = 3; text = 'обещает работать ещё усерднее'; p.devAcc += 0.3; }
    else if (temp <= 8) { d = -6; text = 'раздражён вашими претензиями'; }
    else { d = -1; text = 'без энтузиазма воспринял ваши слова'; }
  }
  d += R.int(-1, 1);
  p.morale = clamp(p.morale + d, 5, 100);
  const mood = d >= 4 ? '😀' : d >= 0 ? '🙂' : d >= -5 ? '😐' : '😠';
  return `${mood} ${fullName(p)} ${text}.`;
}
