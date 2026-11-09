// Press conferences (pre- and post-match): answers affect morale, board confidence and expectations.
import type { Fixture, Player } from './types';
import { G, R, IDX } from './state';
import { addMsg } from './inbox';
import { fullName } from './player';
import { recalcConf } from './board';
import { clamp, plural } from './util';
import { expense } from './finance';
import { avgRating } from './results';
import { H } from './attrs';

export interface PressFx { team?: number; pid?: number; pm?: number; conf?: number; tone?: number; fine?: number }
export interface PressOpt { t: string; e: PressFx }
export interface PressQ { by: string; q: string; opts: PressOpt[] }

const OUTLETS = ['«Спортивный вестник»', '«Футбольное обозрение»', 'телеканал «Спорт-24»', 'портал «Гол!»', '«Вечерняя газета»', 'радио «Стадион»', '«Еженедельник Футбол»'];
const FIRST = ['Андрей', 'Мария', 'Игорь', 'Елена', 'Сергей', 'Ольга', 'Дмитрий', 'Наталья', 'Павел', 'Ирина', 'Константин', 'Юлия'];
const LAST = ['Соколов', 'Иванова', 'Гусев', 'Орлова', 'Ковалёв', 'Белова', 'Зайцев', 'Морозова', 'Фёдоров', 'Лебедева', 'Тихонов', 'Кузнецова'];
function reporter() {
  const i = R.int(0, FIRST.length - 1);
  return `${FIRST[i]} ${LAST[i]}, ${R.pick(OUTLETS)}`;
}

// city derbies (clubs sharing the first word of a city / known rivalries)
const DERBIES: string[][] = [
  ['Спартак Москва', 'ЦСКА', 'Динамо Москва', 'Локомотив Москва', 'Торпедо Москва', 'Родина Москва'],
  ['Зенит', 'Спартак Москва'], ['Краснодар', 'Ростов'], ['Рубин', 'Крылья Советов'],
  ['Реал Мадрид', 'Атлетико Мадрид', 'Барселона'], ['Барселона', 'Эспаньол'], ['Севилья', 'Реал Бетис'],
  ['Манчестер Юнайтед', 'Манчестер Сити', 'Ливерпуль'], ['Ливерпуль', 'Эвертон'], ['Арсенал', 'Тоттенхэм', 'Челси'],
  ['Интер', 'Милан', 'Ювентус'], ['Рома', 'Лацио'], ['Бавария', 'Боруссия Дортмунд'], ['Шальке 04', 'Боруссия Дортмунд'],
  ['ПСЖ', 'Марсель'], ['Селтик', 'Рейнджерс'], ['Бенфика', 'Спортинг', 'Порту'], ['Галатасарай', 'Фенербахче', 'Бешикташ'],
  ['Аякс', 'Фейеноорд', 'ПСВ'], ['Олимпиакос', 'Панатинаикос'], ['Црвена Звезда', 'Партизан'], ['Динамо Загреб', 'Хайдук Сплит'],
  ['Шахтёр Донецк', 'Динамо Киев'], ['Славия Прага', 'Спарта Прага'], ['Рапид Вена', 'Аустрия Вена'],
];
export function isDerby(a: string, b: string) {
  return DERBIES.some((g) => g.includes(a) && g.includes(b));
}

/** morale change with diminishing returns near the top */
function bump(p: Player, d: number) {
  const k = d > 0 ? 0.45 * clamp((100 - p.morale) / 40, 0, 1) : 0.8;
  p.morale = clamp(p.morale + d * k, 5, 100);
}

function squad(): Player[] {
  return G.clubs[G.user].players.map((id) => G.players[id]!).filter((p) => p && !p.loan);
}
function recentForm(clubId: number, n: number): number[] {
  return (IDX.clubFx.get(clubId) || []).map((id) => G.fixtures[id]).filter((x) => x && x.played).sort((a, b) => b.day - a.day).slice(0, n)
    .map((x) => { const h = x.home === clubId; const gf = h ? x.hg : x.ag, ga = h ? x.ag : x.hg; return gf > ga ? 3 : gf === ga ? 1 : 0; });
}

function expectQ(f: Fixture): PressQ {
  const me = G.clubs[G.user];
  const oppId = f.home === G.user ? f.away : f.home;
  const opp = G.clubs[oppId];
  const diff = me.rep - opp.rep + (f.neutral ? 0 : f.home === G.user ? 4 : -4);
  if (diff > 6) return {
    by: reporter(), q: `«${me.name}» — явный фаворит матча с командой «${opp.name}». Рассчитываете на уверенную победу?`,
    opts: [
      { t: 'Мы обязаны побеждать в таких матчах', e: { team: 2, tone: 1 } },
      { t: 'Лёгких матчей не бывает, мы уважаем соперника', e: { team: 1, tone: 0 } },
      { t: 'Нужна предельная концентрация — расслабляться нельзя', e: { team: 1, tone: 0 } },
    ],
  };
  if (diff < -6) return {
    by: reporter(), q: `Фаворитом матча считается «${opp.name}». Есть ли у вашей команды шансы?`,
    opts: [
      { t: 'Мы никого не боимся и играем на победу', e: { team: 3, tone: 1 } },
      { t: 'Мы аутсайдеры, но постараемся удивить', e: { team: 1, tone: -1 } },
      { t: 'Будем действовать от обороны и ловить свой шанс', e: { team: -1, tone: -1 } },
    ],
  };
  return {
    by: reporter(), q: `Как оцениваете шансы в матче с командой «${opp.name}»?`,
    opts: [
      { t: 'Мы сильнее и докажем это на поле', e: { team: 2, tone: 1 } },
      { t: 'Шансы равны, всё решат детали', e: { team: 1, tone: 0 } },
      { t: 'Соперник очень опасен, будет тяжело', e: { team: -1, tone: -1 } },
    ],
  };
}

function playerQ(post: boolean, f?: Fixture): PressQ | null {
  const ps = squad();
  if (!ps.length) return null;
  // post-match: player of the match or sent-off player
  if (post && f) {
    const red = f.ev ? (() => { for (let i = 0; i < f.ev.length; i += 4) if (f.ev[i + 1] === 5) { const p = G.players[f.ev[i + 2]]; if (p && p.club === G.user) return p; } return null; })() : null;
    if (red && R.chance(0.8)) return {
      by: reporter(), q: `${fullName(red)} получил красную карточку. Он подвёл команду?`,
      opts: [
        { t: 'Он ошибся, но такое бывает. Мы его поддержим', e: { pid: red.id, pm: 5 } },
        { t: 'Да, это недопустимо — он подвёл партнёров', e: { pid: red.id, pm: -8, team: 1 } },
        { t: 'Обсудим это внутри коллектива', e: { pid: red.id, pm: 1 } },
      ],
    };
    const potm = f.potm != null ? G.players[f.potm] : null;
    if (potm && potm.club === G.user && R.chance(0.7)) return {
      by: reporter(), q: `${fullName(potm)} стал лучшим игроком матча. Ваша оценка его игры?`,
      opts: [
        { t: 'Великолепная игра, он заслужил похвалу', e: { pid: potm.id, pm: 7 } },
        { t: 'Хорошо, но он способен на большее', e: { pid: potm.id, pm: -2, team: 1 } },
        { t: 'Не хочу выделять кого-то — это заслуга команды', e: { team: 2 } },
      ],
    };
  }
  const regulars = ps.filter((p) => p.st.apps >= 4);
  const inForm = regulars.filter((p) => avgRating(p) >= 7.1).sort((a, b) => avgRating(b) - avgRating(a))[0];
  const outForm = regulars.filter((p) => avgRating(p) > 0 && avgRating(p) < 6.5 && p.status <= 1).sort((a, b) => avgRating(a) - avgRating(b))[0];
  const star = ps.slice().sort((a, b) => b.value - a.value)[0];
  const roll = R.next();
  if (outForm && roll < 0.35) return {
    by: reporter(), q: `${fullName(outForm)} в последнее время не блещет. Сохраните ему место в составе?`,
    opts: [
      { t: 'Полностью ему доверяю — форма вернётся', e: { pid: outForm.id, pm: 6 } },
      { t: 'Ему нужно прибавлять, иначе место займут другие', e: { pid: outForm.id, pm: outForm.hid[H.PROF] >= 14 ? 3 : -5, team: 1 } },
      { t: 'Место в составе нужно заслуживать каждый день', e: { pid: outForm.id, pm: -2, team: 1 } },
    ],
  };
  if (inForm && roll < 0.7) return {
    by: reporter(), q: `${fullName(inForm)} в отличной форме. Что можете сказать о нём?`,
    opts: [
      { t: 'Он один из ключевых игроков, я очень доволен', e: { pid: inForm.id, pm: 6 } },
      { t: 'Хорошо, но расслабляться ему рано', e: { pid: inForm.id, pm: -1 } },
      { t: 'Не люблю выделять отдельных игроков', e: { team: 1 } },
    ],
  };
  if (star) {
    const suitors = G.clubs.filter((c) => c.rep > G.clubs[G.user].rep + 4 && c.country !== G.clubs[G.user].country);
    const z = suitors.length ? R.pick(suitors) : null;
    if (z) return {
      by: reporter(), q: `${fullName(star)}: по слухам, им интересуется «${z.name}». Игрок продаётся?`,
      opts: [
        { t: 'Он не продаётся — он важен для нас', e: { pid: star.id, pm: star.wantsOut ? -6 : 5 } },
        { t: 'У каждого игрока есть цена', e: { pid: star.id, pm: star.wantsOut ? 4 : -6 } },
        { t: 'Я не комментирую слухи', e: {} },
      ],
    };
  }
  return null;
}

function contextQ(f: Fixture, post: boolean): PressQ | null {
  const me = G.clubs[G.user];
  const oppId = f.home === G.user ? f.away : f.home;
  const opp = G.clubs[oppId];
  const form = recentForm(G.user, 4);
  const comp = G.comps[f.comp];
  if (!post && isDerby(me.name, opp.name)) return {
    by: reporter(), q: `Впереди дерби — матч с командой «${opp.name}». Что он значит для вас?`,
    opts: [
      { t: 'Это больше, чем три очка. Мы сыграем ради болельщиков', e: { team: 3, tone: 1 } },
      { t: 'Это просто очередной матч чемпионата', e: { team: -1 } },
      { t: 'Эмоции нужно оставить за кромкой поля', e: { team: 1 } },
    ],
  };
  if (G.board.ultimatum) return {
    by: reporter(), q: 'Совет директоров поставил вам ультиматум. Вы чувствуете давление?',
    opts: [
      { t: 'Я уверен в команде — мы выполним требования', e: { team: 2, conf: 1 } },
      { t: 'Давление есть всегда, это часть профессии', e: { team: 1 } },
      { t: 'Мне нечего доказывать руководству', e: { conf: -3, team: 1 } },
    ],
  };
  if (!post && form.length >= 3 && form.slice(0, 3).every((x) => x < 3)) return {
    by: reporter(), q: `Команда не побеждает ${form.filter((x, i) => i < 4 && x < 3).length} ${plural(3, 'матч', 'матча', 'матчей')} подряд. Ваше положение под угрозой?`,
    opts: [
      { t: 'Я верю в игроков — результаты придут', e: { team: 2 } },
      { t: 'Игроки должны взять на себя ответственность', e: { team: -3, conf: 1 } },
      { t: 'Ответственность за результаты лежит на мне', e: { team: 1, conf: 1 } },
    ],
  };
  if (!post && form.length >= 4 && form.every((x) => x === 3)) return {
    by: reporter(), q: 'Ваша команда выдала победную серию. В чём секрет успеха?',
    opts: [
      { t: 'Это заслуга игроков, они великолепны', e: { team: 3 } },
      { t: 'Мы просто следуем плану', e: { team: 1 } },
      { t: 'Рано радоваться, ничего ещё не выиграно', e: { team: 1, tone: 0 } },
    ],
  };
  if (!post && comp?.kind === 'euro') return {
    by: reporter(), q: `Насколько важен для вас этот турнир — ${comp.name}?`,
    opts: [
      { t: 'Мы хотим пройти как можно дальше', e: { team: 2, conf: 0.5, tone: 1 } },
      { t: 'Каждый матч в Европе — ценный опыт', e: { team: 1 } },
      { t: 'Приоритет для нас — чемпионат', e: { team: -1, conf: -0.5 } },
    ],
  };
  if (!post && comp?.kind === 'cup') return {
    by: reporter(), q: `Будете ли вы ротировать состав в кубковом матче с командой «${opp.name}»?`,
    opts: [
      { t: 'Кубок — реальный шанс на трофей, выставим сильнейших', e: { team: 1, tone: 1 } },
      { t: 'Шанс получат те, кто мало играл', e: { team: 1 } },
      { t: 'Посмотрим по состоянию игроков', e: {} },
    ],
  };
  return null;
}

function resultQ(f: Fixture): PressQ {
  const isHome = f.home === G.user;
  const gf = isHome ? f.hg : f.ag, ga = isHome ? f.ag : f.hg;
  const opp = G.clubs[isHome ? f.away : f.home];
  if (gf > ga) {
    if (gf - ga >= 3) return {
      by: reporter(), q: `Разгромная победа над командой «${opp.name}» — ${gf}:${ga}. Можно говорить о больших целях?`,
      opts: [
        { t: 'Мы показали свой уровень — цели самые высокие', e: { team: 2, conf: 0.5 } },
        { t: 'Это всего лишь три очка, впереди много работы', e: { team: 1 } },
        { t: 'Я горжусь игроками, они выполнили всё идеально', e: { team: 3 } },
      ],
    };
    return {
      by: reporter(), q: `Победа над командой «${opp.name}». Довольны игрой?`,
      opts: [
        { t: 'Игроки выполнили установку — я горжусь ими', e: { team: 3 } },
        { t: 'Результат хороший, но играть мы можем лучше', e: { team: -1, conf: 0.3 } },
        { t: 'Главное — очки, остальное неважно', e: { team: 1 } },
      ],
    };
  }
  if (gf === ga) return {
    by: reporter(), q: `Ничья с командой «${opp.name}» — справедливый результат?`,
    opts: [
      { t: 'Довольны очком — соперник был хорош', e: { team: 1 } },
      { t: 'Мы заслуживали большего', e: { team: 1, conf: 0.3 } },
      { t: 'Игроки должны были дожимать соперника', e: { team: -3 } },
    ],
  };
  return {
    by: reporter(), q: `Поражение от команды «${opp.name}» (${gf}:${ga}). Что пошло не так?`,
    opts: [
      { t: 'Ответственность за поражение на мне', e: { team: 2, conf: 0.5 } },
      { t: 'Игроки сыграли ниже своего уровня', e: { team: -4 } },
      { t: 'Судейство серьёзно повлияло на результат', e: { team: 1, fine: 1 } },
      { t: 'Соперник сегодня был сильнее', e: {} },
    ],
  };
}

export function preMatchPress(f: Fixture) {
  if (G.user < 0 || G.sacked) return;
  const comp = G.comps[f.comp];
  const opp = G.clubs[f.home === G.user ? f.away : f.home];
  const important = comp?.kind === 'euro' || (comp?.kind === 'cup' && f.tie != null) || isDerby(G.clubs[G.user].name, opp.name) || !!G.board.ultimatum;
  if (!important && !R.chance(0.45)) return;
  const qs: PressQ[] = [expectQ(f)];
  const c = contextQ(f, false); if (c) qs.push(c);
  const p = playerQ(false); if (p) qs.push(p);
  addMsg({
    from: 'Пресс-служба клуба', subj: `Предматчевая пресс-конференция: ${opp.name}`, kind: 'press',
    body: `Журналисты ждут вас на пресс-конференции перед матчем с командой «${opp.name}». Ответы повлияют на настрой игроков и ожидания руководства.\n\nМожно отправить вместо себя ассистента — тогда он ответит нейтрально.`,
    data: { type: 'press', fx: f.id, pre: true, qs, exp: f.day },
  });
}

export function postMatchPress(f: Fixture) {
  if (G.user < 0 || G.sacked) return;
  const comp = G.comps[f.comp];
  if (comp?.kind === 'super' && !R.chance(0.3)) return;
  if (!R.chance(0.6)) return;
  const qs: PressQ[] = [resultQ(f)];
  const p = playerQ(true, f); if (p) qs.push(p);
  const c = contextQ(f, true); if (c && qs.length < 3) qs.push(c);
  const opp = G.clubs[f.home === G.user ? f.away : f.home];
  addMsg({
    from: 'Пресс-служба клуба', subj: `Послематчевая пресс-конференция: ${opp.name}`, kind: 'press',
    body: `Журналисты хотят услышать ваши комментарии после матча с командой «${opp.name}» (${G.clubs[f.home].name} ${f.hg}:${f.ag} ${G.clubs[f.away].name}).`,
    data: { type: 'press', fx: f.id, pre: false, qs, exp: G.day + 2 },
  });
}

/** apply one answer; returns human-readable reaction lines */
export function applyPressAnswer(fxId: number, e: PressFx): string[] {
  const out: string[] = [];
  if (e.team) {
    for (const p of squad()) bump(p, e.team);
    out.push(e.team > 0 ? (e.team >= 3 ? 'Игроки воодушевлены вашими словами' : 'Игрокам понравились ваши слова') : 'Игроки недовольны вашими словами');
  }
  if (e.pid != null && e.pm) {
    const p = G.players[e.pid];
    if (p && p.club === G.user) {
      bump(p, e.pm);
      out.push(`${fullName(p)}: ${e.pm > 0 ? 'доволен вашими словами' : 'расстроен вашими словами'}`);
    }
  }
  if (e.conf) {
    G.board.confM = clamp(G.board.confM + e.conf, 0, 100);
    recalcConf();
    out.push(e.conf > 0 ? 'Руководству понравилась ваша позиция' : 'Руководство недовольно вашими высказываниями');
  }
  if (e.tone != null && e.tone !== 0) {
    const f = G.fixtures[fxId];
    if (f && !f.played) { (f as any).pt = e.tone; out.push(e.tone > 0 ? 'Вы подняли ставки перед матчем' : 'Вы сняли давление с команды'); }
  }
  if (e.fine && R.chance(0.4)) {
    const club = G.clubs[G.user];
    const amt = Math.round((10000 + club.rep * 600) / 1000) * 1000;
    expense(club, 'Штрафы', amt);
    addMsg({ from: 'Федерация футбола', subj: 'Штраф за высказывания о судействе', kind: 'board', body: `Контрольно-дисциплинарный комитет оштрафовал вас на ${amt.toLocaleString('ru-RU')} € за публичную критику судейства.` });
    out.push('Федерация оштрафовала вас за критику судей');
  }
  if (!out.length) out.push('Нейтральная реакция');
  return out;
}

/** effect of pre-match statements once the result is known */
export function pressAftermath(f: Fixture, pts: number): number {
  const tone = (f as any).pt as number | undefined;
  if (!tone) return 0;
  let dConf = 0;
  if (tone > 0) {
    const d = pts === 3 ? 2 : pts === 0 ? -3 : -1;
    for (const p of squad()) bump(p, d);
    dConf = pts === 0 ? -1 : pts === 3 ? 0.5 : 0;
  } else {
    if (pts === 3) for (const p of squad()) bump(p, 2);
    dConf = pts === 0 ? 0.6 : 0;
  }
  return dConf;
}

/** close press conferences that are no longer relevant */
export function expirePress() {
  for (const m of G.inbox) {
    if (m.kind !== 'press' || m.done) continue;
    const d = m.data || {};
    const f = G.fixtures[d.fx];
    if (G.day > d.exp || (d.pre && (!f || f.played))) { m.done = true; m.read = true; }
  }
}
