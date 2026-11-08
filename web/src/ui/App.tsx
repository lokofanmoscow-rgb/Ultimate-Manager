import React, { useEffect, useRef, useState } from 'react';
import { G } from '../engine/state';
import { Nav, NavState, Crest, useGame, refresh } from './common';
import { continueStep, nextUserFixture } from '../engine/game';
import { pendingDecisions } from '../engine/inbox';
import { fmtDate, weekdayName } from '../engine/util';
import { saveToSlot } from '../engine/save';
import { StartScreen, NewGameScreen } from './screens/Start';
import { HomeScreen } from './screens/Home';
import { InboxScreen } from './screens/Inbox';
import { SquadScreen } from './screens/Squad';
import { PlayerScreen } from './screens/PlayerView';
import { TacticsScreen } from './screens/Tactics';
import { TrainingScreen, StaffScreen } from './screens/StaffTraining';
import { TransfersScreen } from './screens/Transfers';
import { FinancesScreen } from './screens/Finances';
import { ScheduleScreen } from './screens/Schedule';
import { CompetitionsScreen } from './screens/Competitions';
import { ClubScreen, JobsScreen } from './screens/Club';
import { WorldScreen, ClubView } from './screens/World';
import { MenuScreen } from './screens/Menu';
import { PreMatch } from './screens/PreMatch';
import { MatchScreen } from '../match/MatchScreen';

const NAV_ITEMS: [string, string, string][] = [
  ['home', '🏠', 'Главная'],
  ['inbox', '✉️', 'Входящие'],
  ['squad', '👥', 'Состав'],
  ['tactics', '📋', 'Тактика'],
  ['training', '🏃', 'Тренировки'],
  ['staff', '🧑‍💼', 'Персонал'],
  ['transfers', '🔁', 'Трансферы'],
  ['finances', '💰', 'Финансы'],
  ['schedule', '📅', 'Расписание'],
  ['comps', '🏆', 'Турниры'],
  ['club', '🏟️', 'Клуб'],
  ['world', '🌍', 'Мир футбола'],
  ['menu', '💾', 'Меню'],
];

export default function App() {
  const [mode, setMode] = useState<'start' | 'new' | 'game'>('start');
  if (mode === 'start') return <StartScreen onNew={() => setMode('new')} onLoaded={() => setMode('game')} />;
  if (mode === 'new') return <NewGameScreen onDone={() => setMode('game')} onCancel={() => setMode('start')} />;
  return <GameShell onExit={() => setMode('start')} />;
}

function GameShell({ onExit }: { onExit: () => void }) {
  useGame();
  const [stack, setStack] = useState<NavState[]>([{ page: 'home' }]);
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toastText, setToast] = useState<string | null>(null);
  const stopRef = useRef(false);
  const nav = stack[stack.length - 1];
  const go = (page: string, params?: any) => { setStack((s) => [...s.slice(-30), { page, params }]); setDrawer(false); };
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const toast = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2600); };
  const ctx = { nav, go, back, openPlayer: (id: number) => go('player', { id }), openClub: (id: number) => go('clubview', { id }), toast };

  useEffect(() => {
    (window as any).__umBack = () => {
      if (drawer) { setDrawer(false); return true; }
      const ev = new CustomEvent('um-back', { cancelable: true });
      if (!window.dispatchEvent(ev)) return true;
      if (stack.length > 1 && nav.page !== 'match') { back(); return true; }
      return false;
    };
  });

  useEffect(() => {
    const club = G.user >= 0 ? G.clubs[G.user] : null;
    document.documentElement.style.setProperty('--club1', club ? club.c1 : '#1f6f4a');
    document.documentElement.style.setProperty('--club2', club ? club.c2 : '#ffffff');
  }, [G.user]);

  const doContinue = async () => {
    if (busy) { stopRef.current = true; return; }
    if (nav.page === 'prematch' || nav.page === 'match') return;
    setBusy(true);
    stopRef.current = false;
    let daysPassed = 0;
    try {
      for (let i = 0; i < 400; i++) {
        const r = continueStep();
        if (r.stop === 'none') { daysPassed++; refresh(); }
        if (r.stop === 'match') { go('prematch', { fx: r.fx.id }); break; }
        if (r.stop === 'inbox') { go('inbox', { first: true }); break; }
        if (r.stop === 'sacked') { go('jobs'); break; }
        if (stopRef.current) break;
        await new Promise((res) => setTimeout(res, 16));
      }
    } finally {
      setBusy(false);
      refresh();
      if (daysPassed >= 7 && G.settings.autosave && G.day % 14 === 0) saveToSlot('autosave').catch(() => {});
    }
  };

  const pending = pendingDecisions().length;
  const unread = G.inbox.filter((m) => !m.read).length;
  const club = G.user >= 0 ? G.clubs[G.user] : null;
  const nf = nextUserFixture();
  const matchToday = nf && nf.day === G.day;

  if (nav.page === 'match') {
    return (
      <Nav.Provider value={ctx}>
        <MatchScreen fxId={nav.params.fx} mode={nav.params.mode} onDone={() => { setStack([{ page: 'home' }]); if (G.settings.autosave) saveToSlot('autosave').catch(() => {}); }} />
      </Nav.Provider>
    );
  }

  const Side = ({ cls }: { cls: string }) => (
    <div className={cls}>
      {NAV_ITEMS.map(([k, ic, label]) => (
        <button key={k} className={nav.page === k ? 'on' : ''} onClick={() => { setStack([{ page: k }]); setDrawer(false); }}>
          <span className="ic">{ic}</span>{label}
          {k === 'inbox' && (pending || unread) ? <span className="badge">{pending || unread}</span> : null}
        </button>
      ))}
      {G.user < 0 && <button onClick={() => { setStack([{ page: 'jobs' }]); setDrawer(false); }}><span className="ic">📄</span>Вакансии</button>}
      <button onClick={onExit}><span className="ic">⏏️</span>Выход в меню</button>
    </div>
  );

  let content: React.ReactNode;
  switch (nav.page) {
    case 'home': content = <HomeScreen />; break;
    case 'inbox': content = <InboxScreen first={nav.params?.first} />; break;
    case 'squad': content = <SquadScreen />; break;
    case 'player': content = <PlayerScreen id={nav.params.id} />; break;
    case 'tactics': content = <TacticsScreen />; break;
    case 'training': content = <TrainingScreen />; break;
    case 'staff': content = <StaffScreen />; break;
    case 'transfers': content = <TransfersScreen tab={nav.params?.tab} />; break;
    case 'finances': content = <FinancesScreen />; break;
    case 'schedule': content = <ScheduleScreen />; break;
    case 'comps': content = <CompetitionsScreen compId={nav.params?.comp} />; break;
    case 'club': content = <ClubScreen />; break;
    case 'jobs': content = <JobsScreen />; break;
    case 'world': content = <WorldScreen />; break;
    case 'clubview': content = <ClubView id={nav.params.id} />; break;
    case 'menu': content = <MenuScreen onExit={onExit} />; break;
    case 'prematch': content = <PreMatch fxId={nav.params.fx} onStart={(mode: number) => go('match', { fx: nav.params.fx, mode })} />; break;
    default: content = <HomeScreen />;
  }

  return (
    <Nav.Provider value={ctx}>
      <div className="app">
        <div className="topbar">
          <button className="iconbtn burger" onClick={() => setDrawer(true)}>☰</button>
          {stack.length > 1 && <button className="iconbtn" onClick={back}>←</button>}
          {club && <Crest club={club} size={34} />}
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="title">{club ? club.name : 'Без клуба'}</div>
            <div className="sub">{fmtDate(G.day)}, {weekdayName(G.day)}</div>
          </div>
          <button className={'continue' + (busy ? ' busy' : '') + (matchToday ? ' mday' : '')} onClick={doContinue}>
            {busy ? '⏸ Стоп' : matchToday ? '⚽ Матч' : pending ? `✉ Решения (${pending})` : 'Продолжить ▶'}
          </button>
        </div>
        <div className="body">
          <Side cls="side desktop" />
          <div className="main">{content}</div>
        </div>
        {drawer && <><div className="drawer-bg" onClick={() => setDrawer(false)} /><Side cls="drawer side" /></>}
        {toastText && <div className="toast">{toastText}</div>}
      </div>
    </Nav.Provider>
  );
}
