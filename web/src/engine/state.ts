import type { Game, Player, Club, Fixture } from './types';
import { RNG } from './util';

// Global game state (singleton). ES module live bindings keep importers in sync.
export let G: Game = null as any;
export const R = new RNG(1);

// transient indexes (not saved)
export const IDX = {
  clubFx: new Map<number, number[]>(), // club -> fixture ids (current season)
  natPlayers: new Map<string, number[]>(),
};

export function setGame(g: Game) {
  G = g;
  R.s = g.rng >>> 0;
}

export function syncRng() {
  if (G) G.rng = R.s;
}

export const P = (id: number): Player => G.players[id] as Player;
export const C = (id: number): Club => G.clubs[id];
export const FX = (id: number): Fixture => G.fixtures[id];

export function rebuildIndexes() {
  IDX.clubFx.clear();
  for (const k in G.fixtures) {
    const f = G.fixtures[k];
    addFxIndex(f);
  }
}
export function addFxIndex(f: Fixture) {
  for (const c of [f.home, f.away]) {
    let a = IDX.clubFx.get(c);
    if (!a) IDX.clubFx.set(c, (a = []));
    a.push(f.id);
  }
}
export function removeFxIndex(f: Fixture) {
  for (const c of [f.home, f.away]) {
    const a = IDX.clubFx.get(c);
    if (a) {
      const i = a.indexOf(f.id);
      if (i >= 0) a.splice(i, 1);
    }
  }
}

// event bus for UI refresh
type Listener = () => void;
const listeners = new Set<Listener>();
export function onChange(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function emit() {
  for (const l of listeners) l();
}
