// محلل المقامات: تتبع اللحن → تصحيح الدوزان → القرار → مطابقة قوالب المقامات بأرباع التون
// وحدة نقية بلا DOM: تعمل في Web Worker وفي Node للاختبار.
import { MAQAMAT, AJNAS, stepsToOffsets } from './theory.js';

export const SR = 11025;           // معدل العينات للتحليل
export const FRAME = 1024, HOP = 256; // ~93ms نافذة، ~23ms خطوة
const FMIN = 70, FMAX = 1400;
const BINS = 120;                  // 10 سنت لكل خانة في الأوكتاف

// ===== تتبع الطبقة (YIN) =====
export function trackPitch(x, sr = SR, onProgress) {
  const maxTau = Math.floor(sr / FMIN), minTau = Math.floor(sr / FMAX);
  const W = FRAME;
  const d = new Float32Array(maxTau + 1);
  const out = [];
  const total = Math.floor((x.length - W - maxTau) / HOP);
  for (let k = 0; k < total; k++) {
    const off = k * HOP;
    let rms = 0;
    for (let i = 0; i < W; i++) { const v = x[off + i]; rms += v * v; }
    rms = Math.sqrt(rms / W);
    let cents = null, clarity = 0;
    if (rms > 0.004) {
      for (let tau = minTau; tau <= maxTau; tau++) {
        let s = 0;
        for (let i = 0; i < W; i++) { const v = x[off + i] - x[off + i + tau]; s += v * v; }
        d[tau] = s;
      }
      // CMND
      let run = 0;
      for (let tau = 1; tau < minTau; tau++) {
        let s = 0; for (let i = 0; i < W; i += 4) { const v = x[off + i] - x[off + i + tau]; s += v * v; } d[tau] = s * 4;
      }
      let best = -1;
      for (let tau = 1; tau <= maxTau; tau++) {
        run += d[tau];
        const v = d[tau] * tau / (run || 1);
        d[tau] = v;
      }
      for (let tau = minTau; tau <= maxTau; tau++) {
        if (d[tau] < 0.18) { while (tau + 1 <= maxTau && d[tau + 1] < d[tau]) tau++; best = tau; break; }
      }
      if (best > 0) {
        const a = d[best - 1] ?? d[best], b = d[best], c = d[best + 1] ?? d[best];
        const den = 2 * (2 * b - c - a);
        const t = den ? best + (c - a) / den : best;
        const f = sr / t;
        clarity = 1 - b;
        if (f >= FMIN && f <= FMAX) cents = 1200 * Math.log2(f / 440) + 6900; // 0 = C-1، كل 1200 = أوكتاف، 100 = نصف تون
      }
    }
    out.push({ t: off / sr, cents, clarity, rms });
    if (onProgress && k % 200 === 0) onProgress(k / total);
  }
  return out;
}

// ===== تنعيم: إزالة القفزات الأوكتافية العابرة =====
function cleanFrames(frames) {
  const v = frames.map(f => (f.cents != null && f.clarity > 0.75 ? f.cents : null));
  // مرشح وسيط على 5 إطارات
  const out = v.map((c, i) => {
    if (c == null) return null;
    const win = v.slice(Math.max(0, i - 2), i + 3).filter(x => x != null);
    if (win.length < 3) return null;
    const s = [...win].sort((a, b) => a - b);
    const med = s[Math.floor(s.length / 2)];
    return Math.abs(c - med) < 60 ? c : null;
  });
  return out;
}

// ===== تصحيح الدوزان: إزاحة عامة بحيث تقع النوتات على شبكة ربع التون =====
function tuningOffset(cents) {
  let sx = 0, sy = 0;
  for (const c of cents) { if (c == null) continue; const a = (2 * Math.PI * (((c % 50) + 50) % 50)) / 50; sx += Math.cos(a); sy += Math.sin(a); }
  let off = (Math.atan2(sy, sx) / (2 * Math.PI)) * 50;
  if (off > 25) off -= 50;
  if (off < -25) off += 50;
  return off;
}

// ===== النوتات (مقاطع ثابتة) لاكتشاف نهايات الجمل =====
function segmentNotes(cents, hopSec) {
  const notes = [];
  let cur = null;
  for (let i = 0; i < cents.length; i++) {
    const c = cents[i];
    if (c != null && cur && Math.abs(c - cur.c) < 40) { cur.sum += c; cur.n++; cur.c = cur.sum / cur.n; cur.end = i; continue; }
    if (cur && cur.n >= 4) notes.push(cur);
    cur = c != null ? { c, sum: c, n: 1, start: i, end: i } : null;
  }
  if (cur && cur.n >= 4) notes.push(cur);
  notes.forEach((n, k) => {
    const next = notes[k + 1];
    n.dur = n.n * hopSec;
    n.gapAfter = next ? (next.start - n.end) * hopSec : 1;
  });
  return notes;
}

// ===== قوالب المقامات =====
function gauss(d, s) { return Math.exp(-(d * d) / (2 * s * s)); }
function circDist(a, b) { let d = Math.abs(a - b) % 1200; return d > 600 ? 1200 - d : d; }

const MAQAM_IDS = Object.keys(MAQAMAT);
const TEMPLATES = {};
for (const id of MAQAM_IDS) {
  const m = MAQAMAT[id];
  const asc = stepsToOffsets(m.asc).map(o => o * 50);
  const dsc = m.dsc ? stepsToOffsets(m.dsc).map(o => o * 50) : [];
  const degs = asc.map((c, i) => ({ c, w: i === 0 ? 1.4 : (i === m.ghammaz ? 1.15 : 1), deg: i }));
  dsc.forEach((c, i) => { if (!asc.includes(c)) degs.push({ c, w: 0.6, deg: i, alt: true }); });
  TEMPLATES[id] = degs;
}

function histogram(cents, weights) {
  const h = new Float64Array(BINS);
  cents.forEach((c, i) => {
    if (c == null) return;
    const pc = ((c % 1200) + 1200) % 1200;
    const w = weights ? weights[i] : 1;
    // توزيع على الخانتين المجاورتين
    const x = pc / 10, b0 = Math.floor(x) % BINS, f = x - Math.floor(x);
    h[b0] += w * (1 - f); h[(b0 + 1) % BINS] += w * f;
  });
  const s = h.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < BINS; i++) h[i] /= s;
  // تنعيم خفيف
  const g = new Float64Array(BINS);
  for (let i = 0; i < BINS; i++) for (let k = -2; k <= 2; k++) g[i] += h[(i + k + BINS) % BINS] * [0.1, 0.2, 0.4, 0.2, 0.1][k + 2];
  return g;
}

// قيمة المدرّج قرب موضع (سنت داخل الأوكتاف)
function massNear(h, c, sigma = 22) {
  let s = 0;
  for (let i = 0; i < BINS; i++) s += h[i] * gauss(circDist(i * 10, c), sigma);
  return s;
}

function scoreMaqam(h, finals, tonicC, id, low = null) {
  const T = TEMPLATES[id];
  let inS = 0;
  for (const d of T) inS += d.w * massNear(h, tonicC + d.c);
  // طاقة خارج المقام
  let outS = 0;
  for (let i = 0; i < BINS; i++) {
    const c = i * 10;
    let near = 0;
    for (const d of T) near = Math.max(near, gauss(circDist(c, tonicC + d.c), 32));
    outS += h[i] * (1 - near);
  }
  const tonicPrior = 2.2 * massNear(finals, tonicC, 25) + 0.6 * massNear(h, tonicC, 25);
  // القرار يقع عادة في الجزء المنخفض من مدى اللحن (قرب المئين العشرين)
  let rangePrior = 0;
  if (low != null) {
    const k = Math.round((low - tonicC) / 1200);
    const dist = Math.abs(low - (tonicC + 1200 * k));
    rangePrior = 0.8 * gauss(dist, 250);
  }
  return inS / 2.2 - 1.6 * outS + tonicPrior + rangePrior;
}

// ===== التحليل الكامل =====
export function analyzeFrames(frames, opts = {}) {
  const hopSec = HOP / SR;
  const raw = cleanFrames(frames);
  const voiced = raw.filter(c => c != null).length;
  if (voiced < 40) return { ok: false, reason: 'لم أجد لحناً واضحاً في المقطع. جرّب جزءاً فيه غناء أو عزف منفرد واضح.' };
  const off = tuningOffset(raw);
  const cents = raw.map(c => (c == null ? null : c - off));
  const notes = segmentNotes(cents, hopSec);
  const h = histogram(cents);
  // مدرّج نهايات الجمل: النوتات الطويلة أو التي يليها صمت
  const fc = [], fw = [];
  notes.forEach((n, k) => {
    const isEnd = n.gapAfter >= 0.2 || k === notes.length - 1;
    const w = (isEnd ? 1 : 0.05) * Math.min(2, n.dur) + (n.dur > 0.6 ? 0.4 * n.dur : 0);
    fc.push(n.c); fw.push(w);
  });
  const finals = histogram(fc.length ? fc : cents, fc.length ? fw : null);

  const sortedC = cents.filter(c => c != null).sort((a, b) => a - b);
  const low = sortedC[Math.floor(sortedC.length * 0.15)];
  const results = [];
  for (let q = 0; q < 24; q++) {
    const tonicC = q * 50;
    for (const id of MAQAM_IDS) {
      const m = MAQAMAT[id];
      // القرار نصف بيمول مسموح فقط للمقامات التي قرارها كذلك، والعكس
      const isQ = q % 2 === 1;
      if (isQ !== !!m.rootQuarter) continue;
      results.push({ id, q, score: scoreMaqam(h, finals, tonicC, id, low) });
    }
  }
  results.sort((a, b) => b.score - a.score);
  // احتمالات (softmax)
  const top = results.slice(0, 40);
  const T = 0.045;
  const mx = top[0].score;
  const ex = top.map(r => Math.exp((r.score - mx) / T));
  const sum = ex.reduce((a, b) => a + b, 0);
  top.forEach((r, i) => { r.prob = ex[i] / sum; });
  // دمج: لا تكرر نفس المقام بقرارات مختلفة في القائمة
  const seen = new Set();
  const ranking = [];
  for (const r of top) { const k = r.id; if (seen.has(k)) continue; seen.add(k); ranking.push(r); if (ranking.length >= 5) break; }

  const best = ranking[0];
  const evidence = TEMPLATES[best.id].filter(d => !d.alt).map(d => {
    const target = best.q * 50 + d.c;
    // أعلى قمة قرب الموضع المتوقع ±60 سنت
    let bestC = null, bestV = 0;
    for (let i = 0; i < BINS; i++) {
      const c = i * 10;
      if (circDist(c, target) <= 60 && h[i] > bestV) { bestV = h[i]; bestC = c; }
    }
    const measured = bestC == null ? null : ((bestC - best.q * 50 + 1200) % 1200);
    return { deg: d.deg, expected: d.c, measured, strength: bestV };
  });

  // خط زمني: نوافذ 12 ثانية بخطوة 6
  const timeline = [];
  if (opts.timeline !== false) {
    const win = Math.round(15 / hopSec), step = Math.round(7.5 / hopSec);
    for (let s = 0; s + win / 2 < cents.length; s += step) {
      const seg = cents.slice(s, s + win);
      if (seg.filter(c => c != null).length < 60) continue;
      const hs = histogram(seg);
      const ns = segmentNotes(seg, hopSec);
      const fs = histogram(ns.length ? ns.map(n => n.c) : seg, ns.length ? ns.map((n, k) => ((n.gapAfter >= 0.2 || k === ns.length - 1) ? 1 : 0.05) * Math.min(2, n.dur)) : null);
      const sc2 = seg.filter(c => c != null).sort((a, b) => a - b);
      const lowS = sc2[Math.floor(sc2.length * 0.15)];
      let b = null;
      for (let q = 0; q < 24; q++) for (const id of MAQAM_IDS) {
        if ((q % 2 === 1) !== !!MAQAMAT[id].rootQuarter) continue;
        const sc = scoreMaqam(hs, fs, q * 50, id, lowS);
        if (!b || sc > b.score) b = { id, q, score: sc };
      }
      // لا نعلن تحويلاً إلا إذا تفوّق المقام الجديد بوضوح على المقام العام في هذه النافذة
      const g = scoreMaqam(hs, fs, best.q * 50, best.id, lowS);
      const keep = b.score - g < 0.15;
      timeline.push({ start: s * hopSec, end: Math.min(cents.length, s + win) * hopSec, id: keep ? best.id : b.id, q: keep ? best.q : b.q });
    }
  }

  return {
    ok: true,
    tuningOffset: off,
    voicedRatio: voiced / frames.length,
    duration: frames.length * hopSec,
    histogram: Array.from(h),
    ranking,
    evidence,
    timeline,
    notesCount: notes.length,
    // نوتات اللحن (مصححة الدوزان) لتحويلها إلى تمرين
    notes: notes.filter(n => n.dur >= 0.09).slice(0, 400).map(n => ({ t: +(n.start * hopSec).toFixed(3), c: +n.c.toFixed(1), d: +n.dur.toFixed(3) })),
    bpm: opts.bpm === false ? null : estimateBpm(frames),
  };
}

// ===== التحليل العميق: تقسيم الأغنية كاملة إلى أقسام مقامية =====
// نوافذ 10 ثوانٍ بخطوة 5، ثم مسار Viterbi يفضّل الاستمرار على نفس المقام ويعاقب التبديل
export function deepAnalyzeFrames(frames) {
  const base = analyzeFrames(frames, { timeline: false });
  if (!base.ok) return base;
  const hopSec = HOP / SR;
  const raw = cleanFrames(frames);
  const cents = raw.map(c => (c == null ? null : c - base.tuningOffset));
  const main = base.ranking[0];
  const mainKey = main.id + ':' + main.q;
  const win = Math.round(10 / hopSec), step = Math.round(5 / hopSec);
  const W = [];
  for (let s = 0; s < cents.length; s += step) {
    const seg = cents.slice(s, s + win);
    const voiced = seg.filter(c => c != null);
    const w = { start: s * hopSec, end: Math.min(cents.length, s + win) * hopSec, scores: null };
    if (voiced.length >= 80) {
      const hs = histogram(seg);
      const ns = segmentNotes(seg, hopSec);
      const fs = histogram(ns.length ? ns.map(n => n.c) : seg, ns.length ? ns.map((n, k) => ((n.gapAfter >= 0.2 || k === ns.length - 1) ? 1 : 0.05) * Math.min(2, n.dur)) : null);
      const srt = [...voiced].sort((a, b) => a - b);
      const low = srt[Math.floor(srt.length * 0.15)];
      const sc = new Map();
      for (let q = 0; q < 24; q++) for (const id of MAQAM_IDS) {
        if ((q % 2 === 1) !== !!MAQAMAT[id].rootQuarter) continue;
        sc.set(id + ':' + q, scoreMaqam(hs, fs, q * 50, id, low));
      }
      w.scores = sc;
    }
    W.push(w);
    if (s + win >= cents.length) break;
  }
  // المرشحون: أفضل 3 في كل نافذة + المقام العام
  const cand = new Set([mainKey]);
  W.forEach(w => { if (w.scores) [...w.scores].sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([k]) => cand.add(k)); });
  const C = [...cand];
  const SWITCH = 0.22, MAIN_BIAS = 0.04;
  const em = (w, k) => (w.scores ? w.scores.get(k) + (k === mainKey ? MAIN_BIAS : 0) : (k === mainKey ? 0.01 : 0));
  let prev = C.map(k => em(W[0], k));
  const back = [];
  for (let t = 1; t < W.length; t++) {
    const cur = [], bp = [];
    for (let j = 0; j < C.length; j++) {
      let best = -Infinity, arg = 0;
      for (let i = 0; i < C.length; i++) { const v = prev[i] - (i === j ? 0 : SWITCH); if (v > best) { best = v; arg = i; } }
      cur.push(best + em(W[t], C[j])); bp.push(arg);
    }
    back.push(bp); prev = cur;
  }
  let k = prev.indexOf(Math.max(...prev));
  const path = [k];
  for (let t = back.length - 1; t >= 0; t--) { k = back[t][k]; path.unshift(k); }
  // دمج النوافذ المتتالية في أقسام
  let segs = [];
  W.forEach((w, t) => {
    const key = C[path[t]];
    const last = segs[segs.length - 1];
    const mid = (w.start + w.end) / 2;
    if (last && last.key === key) { last.end = mid; last.n++; last.voicedN += w.scores ? 1 : 0; last.probSum += probOf(w, key); }
    else segs.push({ key, start: t === 0 ? 0 : (w.start + (W[t - 1].end)) / 2, end: mid, n: 1, voicedN: w.scores ? 1 : 0, probSum: probOf(w, key) });
  });
  if (segs.length) { segs[0].start = 0; segs[segs.length - 1].end = W[W.length - 1].end; for (let i = 1; i < segs.length; i++) segs[i].start = segs[i - 1].end; }
  // الأقسام القصيرة جداً (أقل من 15 ثانية) تُدمج مع ما قبلها
  for (let i = 1; i < segs.length; i++) {
    if (segs[i].end - segs[i].start < 15 && segs.length > 1) {
      segs[i - 1].end = segs[i].end; segs[i - 1].n += segs[i].n; segs[i - 1].voicedN += segs[i].voicedN; segs[i - 1].probSum += segs[i].probSum;
      segs.splice(i, 1); i--;
      if (i > 0 && segs[i] && segs[i - 1].key === segs[i].key) { segs[i - 1].end = segs[i].end; segs[i - 1].n += segs[i].n; segs[i - 1].voicedN += segs[i].voicedN; segs[i - 1].probSum += segs[i].probSum; segs.splice(i, 1); i--; }
    }
  }
  // تدقيق حدود الأقسام: أول نافذة يتفوق فيها المقام الجديد على السابق قرب الحد
  for (let i = 1; i < segs.length; i++) {
    const A = segs[i - 1].key, B = segs[i].key, bnd = segs[i].start;
    let found = null;
    for (const w of W) {
      const mid = (w.start + w.end) / 2;
      if (!w.scores || mid < bnd - 25 || mid > bnd + 10) continue;
      if (w.scores.get(B) > w.scores.get(A)) { found = mid - 2.5; break; }
    }
    if (found != null && found > segs[i - 1].start + 5 && found < segs[i].end - 5) { segs[i - 1].end = found; segs[i].start = found; }
  }
  const segments = segs.map(sg => {
    const [id, q] = sg.key.split(':');
    return { start: +sg.start.toFixed(1), end: +sg.end.toFixed(1), id, q: +q, conf: sg.voicedN ? +(sg.probSum / sg.voicedN).toFixed(2) : 0, voiced: sg.voicedN / sg.n };
  });
  // المقام الرئيسي = الأطول زمناً
  const dur = {};
  segments.forEach(sg => { const kk = sg.id + ':' + sg.q; dur[kk] = (dur[kk] || 0) + (sg.end - sg.start); });
  const mainSeg = Object.entries(dur).sort((a, b) => b[1] - a[1])[0][0].split(':');
  return { ...base, deep: { main: { id: mainSeg[0], q: +mainSeg[1] }, segments, distinct: Object.keys(dur).length, durationByMaqam: dur, total: W.length ? W[W.length - 1].end : 0 } };
}
function probOf(w, key) {
  if (!w.scores) return 0;
  const arr = [...w.scores.values()];
  const mx = Math.max(...arr);
  let sum = 0; for (const v of arr) sum += Math.exp((v - mx) / 0.045);
  return Math.exp((w.scores.get(key) - mx) / 0.045) / sum;
}

// ===== سرعة الإيقاع (BPM) تقريبية من غلاف الطاقة =====
export function estimateBpm(frames) {
  const hop = HOP / SR;
  const e = frames.map(f => Math.log(1e-4 + f.rms));
  const on = e.map((v, i) => (i ? Math.max(0, v - e[i - 1]) : 0));
  const mean = on.reduce((a, b) => a + b, 0) / (on.length || 1);
  const o = on.map(v => v - mean);
  if (o.length < 200) return null;
  let best = null;
  for (let bpm = 60; bpm <= 190; bpm += 0.5) {
    const lag = 60 / bpm / hop;
    let s = 0, n = 0;
    for (let i = 0; i + lag * 2 < o.length; i++) {
      const a = o[Math.round(i + lag)], b = o[Math.round(i + 2 * lag)];
      s += o[i] * a + 0.5 * o[i] * b; n++;
    }
    s /= n || 1;
    // تفضيل خفيف للسرعات المعتادة حول 100
    s *= Math.exp(-Math.pow(Math.log2(bpm / 105), 2) / 1.2);
    if (!best || s > best.s) best = { bpm, s };
  }
  return best && best.s > 0 ? Math.round(best.bpm) : null;
}

// اسم القرار من رقم ربع التون (0 = دو)
export function tonicFromQ(q) { return { pc: Math.floor(q / 2) % 12, quarter: q % 2 === 1 }; }

export function analyze(x, sr = SR, onProgress) {
  const frames = trackPitch(x, sr, onProgress);
  return analyzeFrames(frames);
}

export function deepAnalyze(x, sr = SR, onProgress) {
  const frames = trackPitch(x, sr, onProgress);
  return deepAnalyzeFrames(frames);
}

export { MAQAM_IDS, AJNAS };
