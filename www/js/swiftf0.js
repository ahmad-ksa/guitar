// SwiftF0 (MIT, github.com/lars76/swift-f0): نموذج صغير (135KB) لتتبع الطبقة بدقة السنت
// يعمل عبر onnxruntime-web (MIT) بخيط واحد. مدخلاته: صوت أحادي 16kHz، ومخرجاته طبقة وثقة لكل 256 عينة (16ms).
// إن تعذّر التحميل تعود الدوال null ويستخدم التطبيق خوارزمية YIN.

export const SF_SR = 16000;
export const SF_HOP = 256;
const FMIN = 46.875, FMAX = 2093.75;
const WINDOW_FRAMES = 1875, LEFT = 11, LOOKAHEAD = 10;

let sessionP = null;
let ortRef = null;

function baseUrl() {
  // يعمل من الصفحة ومن الـ Worker
  return new URL('./', import.meta.url).href; // .../js/
}

export function loadSwiftF0() {
  if (sessionP) return sessionP;
  sessionP = (async () => {
    try {
      const ort = await import('./vendor/ort/ort.wasm.min.js');
      ortRef = ort;
      ort.env.wasm.numThreads = 1;
      // ملفات .js بدل .mjs لأن خادم Capacitor قد لا يعرف نوع .mjs
      ort.env.wasm.wasmPaths = { mjs: baseUrl() + 'vendor/ort/ort-wasm-simd-threaded.js', wasm: baseUrl() + 'vendor/ort/ort-wasm-simd-threaded.wasm' };
      ort.env.logLevel = 'error';
      const modelUrl = new URL('../models/swiftf0.onnx', import.meta.url).href;
      const buf = await (await fetch(modelUrl)).arrayBuffer();
      return await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    } catch (e) {
      console.warn('SwiftF0 unavailable, falling back to YIN', e);
      return null;
    }
  })();
  return sessionP;
}

async function runWindow(session, audio) {
  const ort = ortRef;
  const feeds = {
    audio: new ort.Tensor('float32', audio, [1, audio.length]),
    fmin: new ort.Tensor('float32', new Float32Array([FMIN]), []),
    fmax: new ort.Tensor('float32', new Float32Array([FMAX]), []),
  };
  const out = await session.run(feeds);
  return { pitch: out.pitch.data, conf: out.confidence.data };
}

// تحليل كامل لمقطع 16kHz. يعيد { pitch: Float32Array(Hz), conf: Float32Array } لكل إطار 16ms
export async function detect(x, onProgress) {
  const session = await loadSwiftF0();
  if (!session) return null;
  const n = Math.max(1, Math.floor(x.length / SF_HOP));
  const pitch = new Float32Array(n), conf = new Float32Array(n);
  for (let start = 0; start < n; start += WINDOW_FRAMES) {
    const end = Math.min(start + WINDOW_FRAMES, n);
    const left = Math.max(0, start - LEFT);
    const a0 = left * SF_HOP;
    const a1 = end < n ? Math.min(x.length, (end + LOOKAHEAD) * SF_HOP) : x.length;
    const win = x.subarray(a0, a1);
    if (win.length < 2048) break;
    const r = await runWindow(session, new Float32Array(win));
    for (let i = start; i < end; i++) {
      const j = i - left;
      if (j < r.pitch.length) { pitch[i] = r.pitch[j]; conf[i] = r.conf[j]; }
    }
    if (onProgress) onProgress(end / n);
  }
  // إطارات صامتة رقمياً: ثقة صفر (كما في المكتبة الأصلية)
  for (let i = 0; i < n; i++) {
    let pk = 0;
    for (let k = i * SF_HOP; k < Math.min(x.length, (i + 1) * SF_HOP); k++) pk = Math.max(pk, Math.abs(x[k]));
    if (pk < 1e-3) conf[i] = 0;
  }
  return { pitch, conf };
}

// تتبع آني من المايكروفون: يُغذّى بصوت 16kHz ويعيد آخر طبقة موثوقة
export class LivePitch {
  constructor() {
    this.buf = new Float32Array(SF_SR * 2);
    this.len = 0;
    this.busy = false;
    this.last = null;
  }
  push(samples16k) {
    const n = samples16k.length;
    if (this.len + n > this.buf.length) {
      const keep = Math.min(this.len, this.buf.length - n);
      this.buf.copyWithin(0, this.len - keep, this.len);
      this.len = keep;
    }
    this.buf.set(samples16k, this.len);
    this.len += n;
  }
  // يحلل آخر ~0.35 ثانية ويعيد طبقة الإطار الذي اكتمل سياقه (يسبق النهاية بـ 10 إطارات)
  async estimate() {
    if (this.busy) return this.last;
    const session = await loadSwiftF0();
    if (!session) return null;
    const need = 22 * SF_HOP;
    if (this.len < need) return null;
    this.busy = true;
    try {
      const win = this.buf.slice(this.len - need, this.len);
      let pk = 0; for (const v of win) pk = Math.max(pk, Math.abs(v));
      if (pk < 2e-3) { this.last = { freq: null, conf: 0 }; return this.last; }
      const r = await runWindow(session, win);
      const i = Math.max(0, r.pitch.length - 1 - LOOKAHEAD);
      this.last = { freq: r.pitch[i], conf: r.conf[i] };
      return this.last;
    } finally { this.busy = false; }
  }
}

// محوّل عينات بأي معدل إلى 16kHz (متوسط بسيط يمنع التشوه)
export function makeResampler(srcRate) {
  const ratio = srcRate / SF_SR;
  let phase = 0;
  return input => {
    const out = [];
    while (phase + ratio <= input.length) {
      const a = Math.floor(phase), b = Math.min(input.length, Math.max(a + 1, Math.floor(phase + ratio)));
      let s = 0; for (let i = a; i < b; i++) s += input[i];
      out.push(s / (b - a));
      phase += ratio;
    }
    phase -= input.length;
    return Float32Array.from(out);
  };
}
