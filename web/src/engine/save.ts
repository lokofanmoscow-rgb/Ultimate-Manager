// Save / load: compact serialization + gzip + IndexedDB slots.
import type { Game, Player } from './types';
import { G, setGame, rebuildIndexes, syncRng } from './state';
import { computePR } from './player';

const enc = (a: number[]) => String.fromCharCode(...a.map((v) => 48 + Math.max(0, Math.min(70, Math.round(v)))));
const dec = (s: string) => Array.from(s, (ch) => ch.charCodeAt(0) - 48);

const PKEYS = ['id', 'fn', 'ln', 'nat', 'dob', 'h', 'wt', 'fl', 'fr', 'pos', 'a', 'hid', 'ca', 'pa', 'club', 'loan', 'wage', 'cEnd', 'rc', 'value', 'rep', 'cond', 'sharp', 'morale', 'inj', 'ban', 'yc', 'form', 'st', 'hist', 'status', 'listed', 'shirt', 'real', 'retired', 'joined', 'unhappy', 'wantsOut', 'devAcc', 'lastGame', 'intl'] as const;
const STKEYS = ['apps', 'sub', 'gls', 'ast', 'rat', 'ratN', 'yc', 'rc', 'min', 'cs', 'potm'] as const;

function packPlayer(p: Player): any[] {
  return PKEYS.map((k) => {
    const v = (p as any)[k];
    if (k === 'pos' || k === 'a' || k === 'hid') return enc(v);
    if (k === 'st') return STKEYS.map((s) => (s === 'rat' ? Math.round(v[s] * 10) / 10 : v[s]));
    if (k === 'cond' || k === 'sharp' || k === 'morale') return Math.round(v);
    if (k === 'devAcc') return Math.round(v * 100) / 100;
    return v === undefined ? null : v;
  });
}
function unpackPlayer(arr: any[]): Player {
  const p: any = {};
  PKEYS.forEach((k, i) => {
    let v = arr[i];
    if (k === 'pos' || k === 'a' || k === 'hid') v = dec(v);
    else if (k === 'st') { const o: any = {}; STKEYS.forEach((s, j) => (o[s] = v[j])); v = o; }
    if (v !== null) p[k] = v;
  });
  return p as Player;
}

export function serialize(g: Game): string {
  syncRng();
  const { players, ...rest } = g;
  const packed = players.map((p) => (p ? packPlayer(p) : 0));
  // strip heavy data from old fixtures
  const fixtures: any = {};
  for (const k in rest.fixtures) {
    const f = rest.fixtures[k];
    if (f.played && f.home !== g.user && f.away !== g.user && f.day < g.day - 21) {
      const { ev, rh, ra, stats, ...lite } = f;
      fixtures[k] = lite;
    } else fixtures[k] = f;
  }
  return JSON.stringify({ ...rest, fixtures, players: packed, fxByDay: undefined });
}

export function deserialize(s: string): Game {
  const o = JSON.parse(s);
  o.players = o.players.map((x: any) => (x ? unpackPlayer(x) : null));
  const fb: Record<number, number[]> = {};
  for (const k in o.fixtures) {
    const f = o.fixtures[k];
    (fb[f.day] ||= []).push(f.id);
  }
  o.fxByDay = fb;
  return o as Game;
}

export function loadGame(g: Game) {
  setGame(g);
  for (const p of g.players) if (p) p.pr = computePR(p);
  rebuildIndexes();
}

async function gzip(text: string): Promise<Blob | string> {
  const CS = (globalThis as any).CompressionStream;
  if (!CS) return text;
  const stream = new Blob([text]).stream().pipeThrough(new CS('gzip'));
  return await new Response(stream).blob();
}
async function gunzip(data: Blob | string): Promise<string> {
  if (typeof data === 'string') return data;
  const DS = (globalThis as any).DecompressionStream;
  const stream = data.stream().pipeThrough(new DS('gzip'));
  return await new Response(stream).text();
}

// ---- IndexedDB ----
const DB = 'ultimate-manager';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('saves');
      r.result.createObjectStore('meta');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((d) => new Promise<T>((res, rej) => {
    const t = d.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

export interface SaveMeta { slot: string; name: string; club: string; date: number; saved: number; season: number; size: number }

export async function saveToSlot(slot: string): Promise<SaveMeta> {
  const text = serialize(G);
  const data = await gzip(text);
  await tx('saves', 'readwrite', (s) => s.put(data, slot));
  const meta: SaveMeta = {
    slot, name: G.mgr ? `${G.mgr.fn} ${G.mgr.ln}` : '—', club: G.user >= 0 ? G.clubs[G.user].name : 'Без клуба', date: G.day, saved: Date.now(), season: G.season,
    size: typeof data === 'string' ? data.length : data.size,
  };
  await tx('meta', 'readwrite', (s) => s.put(meta, slot));
  G.lastSaveSlot = slot;
  return meta;
}

export async function listSaves(): Promise<SaveMeta[]> {
  try {
    const all = await tx<SaveMeta[]>('meta', 'readonly', (s) => s.getAll() as IDBRequest<SaveMeta[]>);
    return all.sort((a, b) => b.saved - a.saved);
  } catch {
    return [];
  }
}

export async function loadFromSlot(slot: string): Promise<boolean> {
  const data = await tx<Blob | string>('saves', 'readonly', (s) => s.get(slot));
  if (!data) return false;
  const text = await gunzip(data);
  loadGame(deserialize(text));
  G.lastSaveSlot = slot;
  return true;
}

export async function deleteSlot(slot: string) {
  await tx('saves', 'readwrite', (s) => s.delete(slot));
  await tx('meta', 'readwrite', (s) => s.delete(slot));
}

export async function exportSave(): Promise<Blob> {
  const data = await gzip(serialize(G));
  return typeof data === 'string' ? new Blob([data]) : data;
}
