// محرك الصوت: وتر مقطوف (Karplus-Strong) + طبلة (دُم/تَك) + مترونوم
// يدعم أرباع التون بدقة لأن التردد يُحسب مباشرة.

let ctx = null;
let master = null;
let comp = null;
const cache = new Map();
const active = new Set();

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function now() { return getCtx().currentTime; }

export function setVolume(v) { getCtx(); master.gain.value = v; }

// إنشاء صوت وتر بطول period صحيح ثم تصحيح الطبقة بـ playbackRate
function pluckBuffer(freq, bright = 0.5) {
  const c = getCtx();
  const sr = c.sampleRate;
  const N = Math.max(2, Math.floor(sr / freq));
  const key = N + ':' + bright.toFixed(2);
  if (cache.has(key)) return { buf: cache.get(key), rate: (freq * N) / sr };
  const dur = Math.min(3.2, 1.2 + 260 / freq);
  const len = Math.floor(sr * dur);
  const buf = c.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  // ضجيج أولي مُرشَّح (يحدد لمعان الصوت)
  let last = 0;
  const lp = 0.35 + bright * 0.6;
  for (let i = 0; i < N; i++) {
    const r = Math.random() * 2 - 1;
    last = last + lp * (r - last);
    d[i] = last;
  }
  // إزالة المكون المستمر
  let mean = 0; for (let i = 0; i < N; i++) mean += d[i]; mean /= N;
  for (let i = 0; i < N; i++) d[i] -= mean;
  const decay = 0.996 + Math.min(0.0035, freq / 200000);
  for (let i = N; i < len; i++) {
    d[i] = decay * 0.5 * (d[i - N] + d[i - N + 1 < i ? i - N + 1 : i - N]);
  }
  // تطبيع
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < len; i++) d[i] /= peak;
  cache.set(key, buf);
  return { buf, rate: (freq * N) / sr };
}

// عزف نوتة. when = وقت AudioContext. bendFrom: تردد البداية لعزف البِند
export function pluck(freq, when = 0, opts = {}) {
  const c = getCtx();
  const t = Math.max(when || c.currentTime, c.currentTime);
  const { gain = 0.6, dur = 1.6, bright = 0.55, bendFrom = null, bendTime = 0.12, pan = 0 } = opts;
  const { buf, rate } = pluckBuffer(bendFrom || freq, bright);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.setValueAtTime(rate, t);
  if (bendFrom) {
    const target = rate * (freq / bendFrom);
    src.playbackRate.setValueAtTime(rate, t + 0.05);
    src.playbackRate.linearRampToValueAtTime(target, t + 0.05 + bendTime);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.setValueAtTime(gain, t + Math.max(0.01, dur - 0.08));
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  // جسم الجيتار: رنين خفيف
  const body = c.createBiquadFilter();
  body.type = 'peaking'; body.frequency.value = 220; body.Q.value = 1.2; body.gain.value = 4;
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass'; tone.frequency.value = 5200;
  let node = src.connect(body).connect(tone).connect(g);
  if (c.createStereoPanner && pan) {
    const p = c.createStereoPanner(); p.pan.value = pan; node = node.connect(p);
  }
  node.connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
  active.add(src);
  src.onended = () => active.delete(src);
  return src;
}

// عزف كورد (strum): freqs من الوتر الغليظ للرفيع
export function strum(freqs, when = 0, opts = {}) {
  const { down = true, spread = 0.028, gain = 0.45, dur = 2.2 } = opts;
  const list = down ? freqs : [...freqs].reverse();
  list.forEach((f, i) => pluck(f, (when || now()) + i * spread, { gain, dur, bright: 0.5, pan: (i - 2.5) * 0.06 }));
}

// ===== الطبلة =====
let noiseBuf = null;
function noise() {
  const c = getCtx();
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

export function drum(kind, when = 0, gainMul = 1) {
  const c = getCtx();
  const t = Math.max(when || c.currentTime, c.currentTime);
  if (kind === 'D') { // دُم
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.22);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.95 * gainMul, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.6);
    active.add(o); o.onended = () => active.delete(o);
  } else { // تَك أو k خفيفة
    const s = c.createBufferSource();
    s.buffer = noise();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = kind === 'k' ? 4200 : 3200; bp.Q.value = 1.4;
    const g = c.createGain();
    const v = (kind === 'k' ? 0.35 : 0.8) * gainMul;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'k' ? 0.05 : 0.09));
    s.connect(bp).connect(g).connect(master);
    s.start(t); s.stop(t + 0.12);
    const o = c.createOscillator(); const og = c.createGain();
    o.frequency.value = 820; og.gain.setValueAtTime(0.25 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(og).connect(master); o.start(t); o.stop(t + 0.05);
    active.add(s); s.onended = () => active.delete(s);
  }
}

export function click(when = 0, accent = false) {
  const c = getCtx();
  const t = Math.max(when || c.currentTime, c.currentTime);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = accent ? 1760 : 1180;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(accent ? 0.35 : 0.2, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 0.05);
}

// نغمة ممتدة (درون) للتمرين على المقامات
let droneNodes = null;
export function droneStart(freq) {
  droneStop();
  const c = getCtx();
  const g = c.createGain();
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(0.12, c.currentTime + 0.6);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const oscs = [1, 2, 1.5].map((m, i) => {
    const o = c.createOscillator();
    o.type = i === 0 ? 'sawtooth' : 'triangle';
    o.frequency.value = freq * m * (i === 0 ? 0.5 : 0.5);
    const og = c.createGain(); og.gain.value = [0.6, 0.35, 0.25][i];
    o.connect(og).connect(lp);
    o.start();
    return o;
  });
  lp.connect(g).connect(master);
  droneNodes = { g, oscs };
}
export function droneStop() {
  if (!droneNodes) return;
  const c = getCtx();
  const { g, oscs } = droneNodes;
  g.gain.cancelScheduledValues(c.currentTime);
  g.gain.setValueAtTime(g.gain.value, c.currentTime);
  g.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
  oscs.forEach(o => o.stop(c.currentTime + 0.35));
  droneNodes = null;
}

export function stopAll() {
  for (const s of active) { try { s.stop(); } catch (e) {} }
  active.clear();
  droneStop();
}

// ===== كشف طبقة الصوت من المايكروفون (خوارزمية YIN مبسطة) =====
export function detectPitch(buf, sr) {
  const size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.008) return null;
  const maxTau = Math.min(Math.floor(sr / 60), Math.floor(size / 2));
  const minTau = Math.floor(sr / 1400);
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let s = 0;
    for (let i = 0; i < size - maxTau; i++) { const x = buf[i] - buf[i + tau]; s += x * x; }
    d[tau] = s;
  }
  // cumulative mean normalized difference
  let run = 0; d[0] = 1;
  for (let tau = 1; tau <= maxTau; tau++) { run += d[tau]; d[tau] = d[tau] * tau / (run || 1); }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < 0.12) { while (t + 1 <= maxTau && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau < 0) return null;
  // استيفاء قطع مكافئ
  const x0 = tau > 1 ? d[tau - 1] : d[tau];
  const x2 = tau < maxTau ? d[tau + 1] : d[tau];
  const denom = 2 * (2 * d[tau] - x2 - x0);
  const better = denom ? tau + (x2 - x0) / denom : tau;
  return { freq: sr / better, clarity: 1 - d[tau], rms };
}
