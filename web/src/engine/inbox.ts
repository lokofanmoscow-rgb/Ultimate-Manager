import type { Msg } from './types';
import { G } from './state';

export function addMsg(m: Omit<Msg, 'id' | 'day' | 'read'> & { day?: number }): Msg {
  const msg: Msg = { id: G.nid.msg++, day: m.day ?? G.day, read: false, ...m } as Msg;
  if (G.user < 0 && !m.kind.startsWith('job')) return msg;
  G.inbox.unshift(msg);
  if (G.inbox.length > 400) {
    // drop old read messages
    const keep = G.inbox.filter((x, i) => i < 250 || !x.read || (x.needs && !x.done));
    G.inbox = keep.slice(0, 400);
  }
  return msg;
}

export function addNews(text: string, kind = 'news') {
  G.news.unshift({ day: G.day, text, kind });
  if (G.news.length > 300) G.news.length = 300;
}

export function pendingDecisions(): Msg[] {
  return G.inbox.filter((m) => m.needs && !m.done);
}
