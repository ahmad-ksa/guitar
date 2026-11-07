// عزل صوت المغني عن الموسيقى داخل الجوال — نموذج Spleeter (Deezer, MIT)
// بصيغة ONNX من مشروع sherpa-onnx (Apache-2.0). نستعمل شبكة «الصوت» فقط
// ونحسب القناع منها، ثم نعيد بناء الصوت بتحويل فورييه العكسي.
export const SPL_SR = 44100;
const N = 4096, HOP = 1024, BINS = 1024, T = 512;

// ---------- FFT مركّب بطول 4096 (radix-2) ----------
const LOG = 12;
const rev = new Uint16Array(N);
for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < LOG; b++) r |= ((i >> b) & 1) << (LOG - 1 - b); rev[i] = r; }
const cosT = new Float32Array(N / 2), sinT = new Float32Array(N / 2);
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(2 * Math.PI * i / N); sinT[i] = Math.sin(2 * Math.PI * i / N); }
const WIN = new Float32Array(N);
for (let i = 0; i < N; i++) WIN[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); // hann دوري

function fft(re, im, inverse) {
  for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  const sgn = inverse ? 1 : -1;
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let s = 0; s < N; s += size) {
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = cosT[t], wi = sgn * sinT[t];
        const a = s + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
  }
}

let ortMod = null, session = null, loading = null;
function baseUrl() { return new URL('./', import.meta.url).href; }

// تحميل النموذج مرة واحدة. يرجع null إن تعذّر (نكمل بدون عزل)
export function loadSpleeter() {
  if (session) return Promise.resolve(session);
  if (!loading) loading = (async () => {
    try {
      const ort = await import('./vendor/ort/ort.wasm.min.js');
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = { mjs: baseUrl() + 'vendor/ort/ort-wasm-simd-threaded.js', wasm: baseUrl() + 'vendor/ort/ort-wasm-simd-threaded.wasm' };
      const buf = await (await fetch(new URL('../models/spleeter-vocals.onnx', import.meta.url))).arrayBuffer();
      session = await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      ortMod = ort;
      return session;
    } catch (e) { console.warn('spleeter load failed', e); loading = null; return null; }
  })();
  return loading;
}

// للاختبار في node: تمرير ort وجلسة جاهزة
export function useSession(ort, s) { ortMod = ort; session = s; }

// L و R بتردد 44100. يرجع صوت المغني (أحادي) بنفس الطول، أو null
export async function separateVocals(L, R, onProgress = () => {}, { mode = 'wiener', accSession = null } = {}) {
  const s = await loadSpleeter();
  if (!s) return null;
  R = R || L;
  const n = L.length;
  const frames = Math.max(1, Math.ceil(Math.max(0, n - N) / HOP) + 1);
  const blocks = Math.ceil(frames / T);
  const out = new Float32Array(n + N), wsum = new Float32Array(n + N);
  const re = new Float32Array(N), im = new Float32Array(N);
  const x = new Float32Array(2 * T * BINS);
  // نحفظ الطيف المركّب للقناتين (حتى BINS) لإعادة البناء
  const sLr = new Float32Array(T * BINS), sLi = new Float32Array(T * BINS), sRr = new Float32Array(T * BINS), sRi = new Float32Array(T * BINS);
  for (let bk = 0; bk < blocks; bk++) {
    x.fill(0); sLr.fill(0); sLi.fill(0); sRr.fill(0); sRi.fill(0);
    const f0 = bk * T, fCount = Math.min(T, frames - f0);
    let energy = 0;
    for (let t = 0; t < fCount; t++) {
      const off = (f0 + t) * HOP;
      for (let i = 0; i < N; i++) { const j = off + i; const w = WIN[i]; re[i] = j < n ? L[j] * w : 0; im[i] = j < n ? R[j] * w : 0; }
      fft(re, im, false);
      // فصل طيفي القناتين من FFT واحد: X_L = (Z_k + conj Z_{N-k})/2 ، X_R = (Z_k - conj Z_{N-k})/(2i)
      for (let k = 0; k < BINS; k++) {
        const nk = (N - k) & (N - 1);
        const ar = re[k], ai = im[k], br = re[nk], bi = -im[nk];
        const lr = (ar + br) / 2, li = (ai + bi) / 2;
        const rr = (ai - bi) / 2, ri = -(ar - br) / 2;
        const p = t * BINS + k;
        sLr[p] = lr; sLi[p] = li; sRr[p] = rr; sRi[p] = ri;
        const mL = Math.hypot(lr, li), mR = Math.hypot(rr, ri);
        x[p] = mL; x[T * BINS + p] = mR; energy += mL + mR;
      }
    }
    if (energy < 1e-3) { onProgress((bk + 1) / blocks); continue; } // صمت
    const res = await s.run({ x: new ortMod.Tensor('float32', x, [2, 1, T, BINS]) });
    const y = res.y.data;
    const ya = accSession ? (await accSession.run({ x: new ortMod.Tensor('float32', x, [2, 1, T, BINS]) })).y.data : null;
    for (let t = 0; t < fCount; t++) {
      re.fill(0); im.fill(0);
      for (let k = 0; k < BINS; k++) {
        const p = t * BINS + k;
        let mL, mR;
        const xl = x[p], xr = x[T * BINS + p], vl = y[p], vr = y[T * BINS + p];
        if (mode === 'mask') { mL = xl > 1e-9 ? vl / xl : 0; mR = xr > 1e-9 ? vr / xr : 0; }
        else { // Wiener: الموسيقى ≈ الكل − الصوت
          const al = ya ? ya[p] : Math.max(0, xl - vl), ar = ya ? ya[T * BINS + p] : Math.max(0, xr - vr);
          mL = (vl * vl + 5e-11) / (vl * vl + al * al + 1e-10); mR = (vr * vr + 5e-11) / (vr * vr + ar * ar + 1e-10);
        }
        // متوسط القناتين (أحادي)
        re[k] = (sLr[p] * mL + sRr[p] * mR) / 2; im[k] = (sLi[p] * mL + sRi[p] * mR) / 2;
      }
      for (let k = 1; k < BINS; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
      fft(re, im, true);
      const off = (f0 + t) * HOP;
      for (let i = 0; i < N; i++) { const w = WIN[i]; out[off + i] += re[i] / N * w; wsum[off + i] += w * w; }
    }
    onProgress((bk + 1) / blocks);
    await new Promise(r => setTimeout(r, 0));
  }
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = wsum[i] > 1e-3 ? out[i] / wsum[i] : 0;
  return v;
}
