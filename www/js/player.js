// مشغل التمارين: يزامن صوت الجيتار مع إضاءة الزند والمترونوم
import { getCtx, pluck, click, stopAll, drum, droneStart, droneStop } from './audio.js';
import { freqOfQ } from './theory.js';

export class Player {
  constructor(board, opts = {}) {
    this.board = board;
    this.opts = Object.assign({ metronome: true, countIn: true, loop: false }, opts);
    this.timers = [];
    this.playing = false;
    this.onStep = null;
    this.onEnd = null;
  }

  setBoard(b) { this.board = b; }

  stop() {
    this.playing = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    stopAll();
    droneStop();
    if (this._resolve) { const r = this._resolve; this._resolve = null; r(false); }
  }

  // يعيد Promise تنتهي عند انتهاء العزف (أو الإيقاف)
  play(ex, bpm = ex.bpm || 70, opts = {}) {
    this.stop();
    const o = Object.assign({}, this.opts, opts);
    const c = getCtx();
    this.playing = true;
    const spb = 60 / bpm;
    let start = c.currentTime + 0.15;
    const beatsIn = o.countIn ? 4 : 0;
    if (o.countIn) for (let i = 0; i < 4; i++) click(start + i * spb, i === 0);
    if (o.drone != null) droneStart(freqOfQ(o.drone));
    const body = start + beatsIn * spb;
    const total = Math.max(1, Math.ceil(ex.beats));
    if (o.metronome) for (let b = 0; b < total; b++) click(body + b * spb, b % 4 === 0);
    if (o.rhythm) {
      const { pattern, slot: slotBeats = 0.5 } = o.rhythm;
      const slot = spb * slotBeats; // طول الخانة بالنبضات
      const slots = Math.ceil(total / slotBeats);
      for (let i = 0; i < slots; i++) { const ch = pattern[i % pattern.length]; if (ch !== '.') drum(ch, body + i * slot, 0.6); }
    }
    ex.events.forEach((e, i) => {
      const when = body + e.t * spb;
      const dur = Math.max(0.25, Math.min(2.4, e.d * spb * 1.6));
      if (e.kind === 'strum') {
        const freqs = e.chord.map(p => freqOfQ(p.q));
        const list = e.down ? freqs : [...freqs].reverse();
        list.forEach((f, k) => pluck(f, when + k * 0.022, { gain: e.down ? 0.42 : 0.3, dur: Math.max(0.6, e.d * spb * 2.2) }));
      } else {
        pluck(freqOfQ(e.q), when, { gain: 0.62, dur, bendFrom: e.bendFrom != null ? freqOfQ(e.bendFrom) : null, bendTime: Math.min(0.4, e.d * spb * 0.4) });
      }
      const delay = (when - c.currentTime) * 1000;
      this.timers.push(setTimeout(() => {
        if (!this.playing) return;
        if (e.kind === 'strum') e.chord.forEach(p => this.board?.flash(p, Math.min(0.5, e.d * spb)));
        else this.board?.flash(e, Math.max(0.18, e.d * spb * 0.9));
        this.onStep && this.onStep(i, e);
      }, Math.max(0, delay)));
    });
    const endMs = (body + total * spb - c.currentTime) * 1000 + 250;
    return new Promise(resolve => {
      this.timers.push(setTimeout(() => {
        if (!this.playing) return resolve(false);
        this._resolve = null;
        droneStop();
        if (o.loop) { this._resolve = null; this.play(ex, o.nextBpm ? o.nextBpm(bpm) : bpm, { ...opts, countIn: false }).then(resolve); return; }
        this.playing = false;
        this.onEnd && this.onEnd();
        resolve(true);
      }, endMs));
      this._resolve = resolve;
    });
  }
}
