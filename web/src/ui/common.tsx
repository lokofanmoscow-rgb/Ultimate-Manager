import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { G, onChange, emit } from '../engine/state';
import type { Club, Player } from '../engine/types';
import { NATION } from '../data/nations';
import { stars as starsOf, POS, POS_RU, POS_GROUP, PosCode } from '../engine/attrs';
import { fmtMoney } from '../engine/util';
import { mainPos, age } from '../engine/player';

// ---------- state hooks ----------
export function useGame() {
  const [, setV] = useState(0);
  useEffect(() => { const off = onChange(() => setV((v) => v + 1)); return () => { off(); }; }, []);
  return G;
}
export const refresh = emit;

// ---------- navigation ----------
export interface NavState { page: string; params?: any }
interface NavCtx { nav: NavState; go: (page: string, params?: any) => void; back: () => void; openPlayer: (id: number) => void; openClub: (id: number) => void; toast: (s: string) => void }
export const Nav = createContext<NavCtx>(null as any);
export const useNav = () => useContext(Nav);

// ---------- crest ----------
function initials(name: string): string {
  const words = name.replace(/[«»"]/g, '').split(/[\s-]+/).filter((w) => w && !/^\d+$/.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

export function Crest({ club, size = 32 }: { club: Club | undefined; size?: number }) {
  if (!club) return <span style={{ width: size, height: size, display: 'inline-block' }} />;
  const c1 = club.c1, c2 = club.c2;
  const txt = initials(club.short || club.name);
  const id = `cr${club.id}`;
  const shape = club.crest;
  const paths = [
    'M50 4 L92 16 L88 62 Q80 86 50 98 Q20 86 12 62 L8 16 Z',
    'M50 3 A47 47 0 1 1 49.9 3 Z',
    'M10 8 H90 V58 Q90 84 50 98 Q10 84 10 58 Z',
    'M50 3 L95 50 L50 97 L5 50 Z',
    'M27 4 H73 L96 50 L73 96 H27 L4 50 Z',
    'M50 3 L94 22 V54 Q92 82 50 98 Q8 82 6 54 V22 Z',
    'M8 6 H92 V70 L50 98 L8 70 Z',
    'M50 3 A47 47 0 1 1 49.9 3 Z',
  ];
  const d = paths[shape % paths.length];
  const textCol = luminance(c1) > 0.6 ? '#111' : '#fff';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flex: `0 0 ${size}px` }}>
      <defs>
        <clipPath id={id}><path d={d} /></clipPath>
      </defs>
      <path d={d} fill={c1} stroke={c2} strokeWidth="6" />
      <g clipPath={`url(#${id})`}>
        {club.kit === 's' && [20, 44, 68].map((x) => <rect key={x} x={x} y="0" width="12" height="100" fill={c2} opacity=".85" />)}
        {club.kit === 'h' && [28, 56].map((y) => <rect key={y} x="0" y={y} width="100" height="12" fill={c2} opacity=".85" />)}
        {club.kit === 'q' && <rect x="50" y="0" width="50" height="100" fill={c2} opacity=".85" />}
        {club.kit === 'x' && <path d="M-10 20 L20 -10 L110 80 L80 110 Z" fill={c2} opacity=".85" />}
        {shape === 7 && <circle cx="50" cy="50" r="33" fill="none" stroke={c2} strokeWidth="5" />}
        {shape === 1 && <circle cx="50" cy="50" r="36" fill="none" stroke={c2} strokeWidth="3" opacity=".8" />}
      </g>
      <text x="50" y={txt.length > 2 ? 62 : 64} textAnchor="middle" fontSize={txt.length > 2 ? 28 : 36} fontWeight="900" fill={club.kit && club.kit !== '' ? textOn(c1) : textCol} stroke={club.kit ? c1 : 'none'} strokeWidth={club.kit ? 3 : 0} paintOrder="stroke" fontFamily="Arial, sans-serif">{txt}</text>
    </svg>
  );
}
function textOn(c: string) { return luminance(c) > 0.6 ? '#111' : '#fff'; }
export function luminance(hex: string) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ---------- flag ----------
export function Flag({ code, size = 18 }: { code: string; size?: number }) {
  const n = NATION[code];
  const w = size * 1.5, h = size;
  if (!n) return <span className="chip tiny">{code}</span>;
  const [type, cols] = n.flag.split(':');
  const c = cols.split(',').map((x) => '#' + x);
  let body: ReactNode;
  if (type === 'h') body = c.map((col, i) => <rect key={i} x="0" y={(i * 60) / c.length} width="90" height={60 / c.length + 0.5} fill={col} />);
  else if (type === 'v') body = c.map((col, i) => <rect key={i} x={(i * 90) / c.length} y="0" width={90 / c.length + 0.5} height="60" fill={col} />);
  else if (type === 'c') body = <><rect width="90" height="60" fill={c[0]} /><rect x="38" width="14" height="60" fill={c[1]} /><rect y="23" width="90" height="14" fill={c[1]} /></>;
  else if (type === 'n') body = <><rect width="90" height="60" fill={c[0]} /><rect x="26" width="12" height="60" fill={c[1]} /><rect y="24" width="90" height="12" fill={c[1]} /></>;
  else if (type === 'n2') body = <><rect width="90" height="60" fill={c[0]} /><rect x="23" width="18" height="60" fill={c[1]} /><rect y="21" width="90" height="18" fill={c[1]} /><rect x="28" width="8" height="60" fill={c[2]} /><rect y="26" width="90" height="8" fill={c[2]} /></>;
  else if (type === 'x') body = <><rect width="90" height="60" fill={c[0]} /><path d="M0 0 L90 60 M90 0 L0 60" stroke={c[1]} strokeWidth="10" /></>;
  else if (type === 'q') body = <><rect width="90" height="60" fill={c[0]} /><rect x="45" width="45" height="30" fill={c[1]} /><rect y="30" width="45" height="30" fill={c[1]} /></>;
  else body = <><rect width="90" height="60" fill={c[0]} /><circle cx="45" cy="30" r="15" fill={c[1]} /></>;
  return (
    <svg width={w} height={h} viewBox="0 0 90 60" style={{ borderRadius: 2, flex: `0 0 ${w}px`, boxShadow: '0 0 0 1px rgba(255,255,255,.15)' }}>
      <title>{n.name}</title>
      {body}
    </svg>
  );
}

// ---------- misc ----------
export function Stars({ ca, value }: { ca?: number; value?: number }) {
  const s = value ?? starsOf(ca ?? 0);
  const full = Math.floor(s), half = s - full >= 0.5;
  return (
    <span className="stars">
      {'★'.repeat(full)}
      {half ? '⯪' : ''}
      <span className="e">{'★'.repeat(Math.max(0, 5 - full - (half ? 1 : 0)))}</span>
    </span>
  );
}

export function attrClass(v: number) {
  return v >= 18 ? 'a6' : v >= 15 ? 'a5' : v >= 12 ? 'a4' : v >= 9 ? 'a3' : v >= 6 ? 'a2' : 'a1';
}
export function AttrVal({ v, masked }: { v: number; masked?: number }) {
  if (masked) {
    const lo = Math.max(1, v - masked), hi = Math.min(20, v + masked);
    return <span className={'attr ' + attrClass(v)} style={{ opacity: 0.85 }}>{lo}-{hi}</span>;
  }
  return <span className={'attr ' + attrClass(v)}>{v}</span>;
}

export function PosBadge({ p }: { p: Player }) {
  const mp = mainPos(p);
  return <span className={'pos ' + POS_GROUP[mp]}>{POS_RU[mp]}</span>;
}
export function posList(p: Player): string {
  return POS.filter((_, i) => p.pos[i] >= 15).map((x) => POS_RU[x as PosCode]).join(', ');
}

export function Money({ v }: { v: number }) {
  return <span className={v < 0 ? 'bad' : ''}>{fmtMoney(v)}</span>;
}

export function Form({ s }: { s: string }) {
  return <span className="form">{s.split('').map((ch, i) => <span key={i} className={ch}>{ch}</span>)}</span>;
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={'modal' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="mh"><div className="grow">{title}</div><button className="iconbtn" onClick={onClose}>✕</button></div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="tabs">
      {tabs.map(([k, label]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>)}
    </div>
  );
}

export function Seg({ options, value, onChange }: { options: string[]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="seg">
      {options.map((o, i) => <button key={i} className={value === i ? 'on' : ''} onClick={() => onChange(i)}>{o}</button>)}
    </div>
  );
}

export function ClubName({ id, crest = true, size = 20 }: { id: number; crest?: boolean; size?: number }) {
  const nav = useNav();
  const c = G.clubs[id];
  if (!c) return <span>—</span>;
  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); nav.openClub(id); }}>
      {crest && <Crest club={c} size={size} />}
      <span className="ellipsis">{c.name}</span>
    </span>
  );
}

export function PlayerName({ id }: { id: number }) {
  const nav = useNav();
  const p = G.players[id];
  if (!p) return <span className="muted">—</span>;
  return <span style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); nav.openPlayer(id); }}>{p.fn ? `${p.fn} ${p.ln}` : p.ln}</span>;
}

export function ageOf(p: Player) {
  return age(p);
}

export function Bar({ v, max = 100, color }: { v: number; max?: number; color?: string }) {
  return <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} /></div>;
}

export function condColor(c: number) {
  return c >= 90 ? 'var(--accent)' : c >= 75 ? '#a3e635' : c >= 60 ? 'var(--orange)' : 'var(--red)';
}
export function moraleText(m: number) {
  return m >= 85 ? 'Превосходная' : m >= 70 ? 'Очень хорошая' : m >= 55 ? 'Хорошая' : m >= 40 ? 'Нормальная' : m >= 25 ? 'Плохая' : 'Ужасная';
}
