// Procedural stadium audio (no asset files): crowd ambience, roars, referee whistle.
export class StadiumSound {
  ctx: AudioContext | null = null;
  crowd: GainNode | null = null;
  master: GainNode | null = null;
  base = 0.1;
  enabled = true;
  unbind: (() => void) | null = null;

  start() {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const ctx = this.ctx!;
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? 1 : 0;
      this.master.connect(ctx.destination);
      // brown-ish noise buffer
      const len = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.2 + w * 0.04;
        }
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      this.crowd = ctx.createGain();
      this.crowd.gain.value = this.base;
      src.connect(lp).connect(this.crowd).connect(this.master);
      src.start();
      const kick = () => this.resume();
      window.addEventListener('pointerdown', kick, { passive: true });
      this.unbind = () => window.removeEventListener('pointerdown', kick);
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
  }

  swell(level: number, dur: number) {
    if (!this.ctx || !this.crowd) return;
    const t = this.ctx.currentTime;
    const g = this.crowd.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(level, t + 0.25);
    g.linearRampToValueAtTime(this.base, t + dur);
  }

  lastWhistle = 0;
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  whistle(times = 1, long = false) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    if (ctx.currentTime - this.lastWhistle < 0.6) return;
    this.lastWhistle = ctx.currentTime;
    for (let k = 0; k < times; k++) {
      const t = ctx.currentTime + k * (long ? 0.7 : 0.35);
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 2900;
      lfo.frequency.value = 38;
      lfoG.gain.value = 160;
      lfo.connect(lfoG).connect(o.frequency);
      const d = long ? 0.55 : 0.22;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.02);
      g.gain.setValueAtTime(0.06, t + d - 0.05);
      g.gain.linearRampToValueAtTime(0, t + d);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2900;
      o.connect(bp).connect(g).connect(this.master);
      o.start(t); lfo.start(t);
      o.stop(t + d + 0.02); lfo.stop(t + d + 0.02);
    }
  }

  onEvent(type: string, imp: number) {
    if (!this.enabled) return;
    if (type === 'goal') { this.swell(0.75, 5); this.whistle(1); }
    else if (type === 'ht' || type === 'et') this.whistle(2, true);
    else if (type === 'ft') { this.whistle(3, true); this.swell(0.35, 3); }
    else if (type === 'kickoff') this.whistle(1);
    else if (type === 'foul' || type === 'yellow' || type === 'red' || type === 'penalty' || type === 'offside') { this.whistle(1); if (type !== 'foul') this.swell(0.3, 2); }
    else if (type === 'post' || type === 'save' || (type === 'miss' && imp >= 2)) this.swell(0.42, 2.5);
    else if (type === 'shot') this.swell(0.22, 1.5);
  }

  stop() {
    this.unbind?.();
    this.unbind = null;
    try { this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
  }
}
