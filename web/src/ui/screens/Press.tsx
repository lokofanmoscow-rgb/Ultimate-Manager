import React, { useState } from 'react';
import { G } from '../../engine/state';
import { Modal, refresh } from '../common';
import type { Msg } from '../../engine/types';
import { applyPressAnswer, type PressQ } from '../../engine/press';

/** pending (unanswered, still relevant) pre-match conference for a fixture */
export function pendingPress(fxId: number): Msg | undefined {
  return G.inbox.find((m) => m.kind === 'press' && !m.done && m.data?.fx === fxId && m.data?.pre);
}

export function PressModal({ m, onClose }: { m: Msg; onClose: () => void }) {
  const qs: PressQ[] = m.data?.qs || [];
  const [i, setI] = useState(0);
  const [log, setLog] = useState<{ q: string; a: string; r: string[] }[]>([]);
  const finished = i >= qs.length;
  const answer = (k: number) => {
    const q = qs[i];
    const o = q.opts[k];
    const r = applyPressAnswer(m.data.fx, o.e);
    setLog([...log, { q: q.q, a: o.t, r }]);
    setI(i + 1);
    if (i + 1 >= qs.length) { m.done = true; m.read = true; refresh(); }
  };
  const close = () => { onClose(); refresh(); };
  return (
    <Modal title={<>🎤 {m.subj}</>} onClose={close} footer={finished ? <button className="btn primary" onClick={close}>Завершить</button> : <span className="small muted">Вопрос {i + 1} из {qs.length}</span>}>
      {log.map((l, k) => (
        <div key={k} className="press-done">
          <div className="small muted">{l.q}</div>
          <div><b>— {l.a}</b></div>
          <div className="small">{l.r.map((x, j) => <span key={j} className="chip" style={{ marginRight: 4 }}>{x}</span>)}</div>
        </div>
      ))}
      {!finished && (
        <div className="press-q">
          <div className="small muted">{qs[i].by}</div>
          <div className="press-text">«{qs[i].q}»</div>
          <div className="col" style={{ gap: 6, marginTop: 10 }}>
            {qs[i].opts.map((o, k) => <button key={k} className="btn press-opt" onClick={() => answer(k)}>{o.t}</button>)}
          </div>
        </div>
      )}
      {finished && <div className="small muted" style={{ marginTop: 8 }}>Пресс-конференция завершена.</div>}
    </Modal>
  );
}
