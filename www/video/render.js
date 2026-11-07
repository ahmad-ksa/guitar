// محرك فيديو الدروس: يبني مشاهد الفيديو من محتوى الدرس (الشرح المسموع، الزند المتحرك،
// الرسومات، الترجمة) ويرسم أي لحظة t على لوحة 1280×720، ويولّد شريط الصوت كاملاً.
// يستخدمه سكربت tools/render-videos.mjs لإنتاج ملفات MP4.
import { lessonById, LEVELS } from '../js/lessons/index.js';
import { buildExercise } from '../js/exercises.js';
import { RHYTHMS, OPEN_STRINGS, freqOfQ, getScale, rootQ, noteName } from '../js/theory.js';
import { cleanForSpeech, voiceKey } from '../js/voicekey.js';
import { renderOffline, pluck, drum } from '../js/audio.js';
import { drawFigure, figureFor, roundRect } from './figures.js';
import { OUTRO } from './texts.js';

export const W = 1280, H = 720, FPS = 24;
const C = { bg: '#12100e', bg2: '#1b1815', card: '#221e1a', line: '#3a332c', text: '#f3ece3', muted: '#a99d8f', acc: '#e0a145', acc2: '#c4732e', root: '#e4573d', note: '#e9dcc7', quarter: '#f08c2b', chord: '#6fb38a', good: '#5fbf7a', wood1: '#3b2416', wood2: '#2c1a10' };
const FONT = (n, w = 600) => `${w} ${n}px "Noto Kufi Arabic", sans-serif`;
const ROLE = { maestro: ['🎼', 'المايسترو'], pro: ['🎸', 'العازف المحترف'], teacher: ['👨‍🏫', 'المعلّم'] };

const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
let audioCache = new Map();

async function voice(text) {
  const t = cleanForSpeech(text || '');
  if (!t) return null;
  const id = voiceKey(text);
  if (audioCache.has(id)) return audioCache.get(id);
  let buf = null;
  try {
    const r = await fetch(`../audio/voice/${id}.mp3`);
    if (r.ok) buf = await new OfflineAudioContext(1, 1, 32000).decodeAudioData(await r.arrayBuffer());
  } catch (e) {}
  const v = { id, text: t, buf, dur: buf ? buf.duration : Math.max(2.5, t.length / 13) };
  audioCache.set(id, v);
  return v;
}

function droneQ(ex, st) {
  if (!st.drone) return null;
  const sp = ex.spec || {};
  if (sp.root == null) return null;
  const sc = getScale(sp.scale);
  return rootQ(sp.root, sp.rootQuarter ?? sc?.rootQuarter ?? false, 36);
}

// ===== بناء المشاهد =====
export async function buildScenes(lessonId) {
  const L = lessonById(lessonId);
  if (!L) throw new Error('no lesson ' + lessonId);
  const scenes = [];
  let t = 0;
  const push = s => { s.t0 = t; t += s.dur; scenes.push(s); };
  const gv = await voice(L.goal);
  push({ kind: 'intro', L, v: gv, dur: Math.max(5, (gv ? gv.dur : 0) + 2.2), vAt: 1.2 });
  const steps = L.steps || [];
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    const v = await voice(st.say);
    let ex = null;
    if (st.ex) { ex = buildExercise({ ...st.ex }); if (st.beats) ex.beats = Math.max(ex.beats, st.beats); }
    const rh = st.rhythm ? RHYTHMS[st.rhythm] : null;
    let demo = 0, bpm = ex ? (ex.bpm || 70) : 70, events = [];
    if (ex && (ex.events.length || rh)) {
      const spb = 60 / bpm;
      const maxBeats = Math.max(4, Math.floor(24 / spb)); // حتى 24 ثانية عزف
      events = ex.events.filter(e => e.t < maxBeats);
      const beats = Math.min(Math.ceil(ex.beats), maxBeats);
      demo = beats * spb + 1.2;
    }
    const narr = v ? v.dur : 0;
    push({ kind: 'step', L, i, n: steps.length, st, v, ex, events, bpm, rh, fig: figureFor(st), narr, demoAt: 0.6 + narr + 0.5, demo, drone: ex ? droneQ(ex, st) : null, vAt: 0.6, dur: 0.6 + narr + 0.5 + demo + 0.6 });
  }
  for (const role of ['maestro', 'pro', 'teacher']) {
    const txt = L.voices && L.voices[role];
    if (!txt) continue;
    const v = await voice(txt);
    push({ kind: 'tip', L, role, text: txt, v, vAt: 0.8, dur: (v ? v.dur : 3) + 1.8 });
  }
  const ov = await voice(OUTRO);
  push({ kind: 'outro', L, v: ov, vAt: 1.0, dur: Math.max(6, (ov ? ov.dur : 3) + 2.5) });
  return { scenes, duration: t, lesson: L };
}

// ===== الصوت =====
export async function renderAudio(plan, sr = 32000) {
  const buf = await renderOffline(plan.duration + 0.5, sr, (c, master) => {
    for (const s of plan.scenes) {
      if (s.v && s.v.buf) {
        const src = c.createBufferSource(); src.buffer = s.v.buf;
        const g = c.createGain(); g.gain.value = 1.0; src.connect(g).connect(c.destination);
        src.start(s.t0 + s.vAt);
      }
      if (s.kind === 'step' && s.demo) {
        const spb = 60 / s.bpm, body = s.t0 + s.demoAt;
        for (const e of s.events) {
          const when = body + e.t * spb;
          if (e.kind === 'strum') {
            const fr = e.chord.map(p => freqOfQ(p.q)); const list = e.down ? fr : [...fr].reverse();
            list.forEach((f, k) => pluck(f, when + k * 0.022, { gain: e.down ? 0.42 : 0.3, dur: Math.max(0.6, e.d * spb * 2.2) }));
          } else pluck(freqOfQ(e.q), when, { gain: 0.62, dur: Math.max(0.25, Math.min(2.4, e.d * spb * 1.6)), bendFrom: e.bendFrom != null ? freqOfQ(e.bendFrom) : null, bendTime: Math.min(0.4, e.d * spb * 0.4) });
        }
        if (s.rh) {
          const slot = spb * s.rh.slot, n = Math.round((s.demo - 1.2) / slot);
          for (let k = 0; k < n; k++) { const ch = s.rh.pattern[k % s.rh.pattern.length]; if (ch !== '.') drum(ch, body + k * slot, 0.6); }
        }
        if (s.drone != null) {
          const f = freqOfQ(s.drone), end = body + s.demo - 0.4;
          const g = c.createGain(); g.gain.setValueAtTime(0, body); g.gain.linearRampToValueAtTime(0.1, body + 0.6); g.gain.setValueAtTime(0.1, end - 0.4); g.gain.linearRampToValueAtTime(0, end);
          const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g).connect(master);
          [[1, 'sawtooth', 0.6], [2, 'triangle', 0.35], [1.5, 'triangle', 0.25]].forEach(([m, type, gg]) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f * m * 0.5; const og = c.createGain(); og.gain.value = gg; o.connect(og).connect(lp); o.start(body); o.stop(end + 0.1); });
        }
      }
    }
  });
  return buf;
}

export function wavBase64(buf) {
  const x = buf.getChannelData(0), sr = buf.sampleRate, n = x.length;
  const b = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) b.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, sr, true); b.setUint32(28, sr * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, 'data'); b.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) b.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), true);
  const u8 = new Uint8Array(b.buffer); let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

// ===== الرسم =====
function txt(g, s, x, y, size, color = C.text, align = 'center', weight = 600) {
  g.font = FONT(size, weight); g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(s, x, y);
}
function wrap(g, s, maxW, size, weight = 600) {
  g.font = FONT(size, weight); g.direction = 'rtl';
  const words = s.split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { const tr = cur ? cur + ' ' + w : w; if (g.measureText(tr).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tr; }
  if (cur) lines.push(cur);
  return lines;
}
function background(g, t) {
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#1d1814'); gr.addColorStop(1, '#0f0d0b'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // خطوط أوتار خافتة متحركة
  g.save(); g.globalAlpha = 0.06; g.strokeStyle = C.acc;
  for (let i = 0; i < 6; i++) { g.lineWidth = 1 + i * 0.5; g.beginPath(); const y = 120 + i * 95; for (let x = 0; x <= W; x += 40) { const yy = y + Math.sin(x / 140 + t * 0.8 + i) * 6; x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); }
  g.restore();
}
function header(g, L, sub) {
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, 64);
  txt(g, L.title, W - 30, 33, 26, C.text, 'right', 700);
  if (sub) { g.font = FONT(20); const w = g.measureText(sub).width + 30; g.fillStyle = C.acc; roundRect(g, 24, 16, w, 34, 17); g.fill(); txt(g, sub, 24 + w / 2, 34, 20, '#1b1815'); }
  txt(g, 'أكاديمية الجيتار', W / 2, 33, 18, C.muted);
}
// ترجمة: تقسيم النص إلى مقاطع بحسب الطول وتوقيتها على مدة الصوت
function subtitle(g, v, local) {
  if (!v || local < 0 || local > v.dur + 0.3) return;
  const parts = v.text.split(/(?<=[.،؛:!؟?])\s+/).flatMap(p => { if (p.length <= 90) return [p]; const w = p.split(' '); const out = []; let c = ''; for (const x of w) { if ((c + ' ' + x).length > 80 && c) { out.push(c); c = x; } else c = c ? c + ' ' + x : x; } if (c) out.push(c); return out; });
  const total = parts.reduce((a, p) => a + p.length, 0);
  let acc = 0, cur = parts[parts.length - 1];
  for (const p of parts) { const end = (acc + p.length) / total * v.dur; if (local <= end) { cur = p; break; } acc += p.length; }
  const lines = wrap(g, cur, W - 200, 30);
  const hh = lines.length * 46 + 26, y0 = H - 30 - hh;
  g.fillStyle = 'rgba(8,6,4,.78)'; roundRect(g, 70, y0, W - 140, hh, 16); g.fill();
  lines.forEach((ln, i) => txt(g, ln, W / 2, y0 + 36 + i * 46, 30, '#fff'));
}

// زند على اللوحة
function fretboard(g, ex, active, t, appear) {
  const from = ex.from, to = ex.to, n = to - from;
  const left = from === 0 ? 110 : 70, right = 40, top = 150, gap = Math.min(58, 300 / 5);
  const fretW = (W - left - right) / n;
  const sy = s => top + (5 - s) * gap;
  const fx = f => f === 0 ? left - 40 : left + (f - from - 0.5) * fretW;
  g.fillStyle = C.wood1; g.fillRect(left, top - 18, n * fretW, gap * 5 + 36);
  const INL = [3, 5, 7, 9, 15, 17, 19, 21];
  g.fillStyle = 'rgba(255,255,255,.18)';
  for (let f = from + 1; f <= to; f++) { if (INL.includes(f)) { g.beginPath(); g.arc(fx(f), top + gap * 2.5, 9, 0, 7); g.fill(); } if (f === 12) { g.beginPath(); g.arc(fx(f), top + gap * 1.5, 9, 0, 7); g.arc(fx(f), top + gap * 3.5, 9, 0, 7); g.fill(); } }
  for (let f = from; f <= to; f++) { const x = left + (f - from) * fretW; g.fillStyle = f === 0 ? '#e9e2d6' : '#b9b2a6'; g.fillRect(x - (f === 0 ? 5 : 2), top - 18, f === 0 ? 10 : 4, gap * 5 + 36); }
  for (let f = from + 1; f <= to; f++) txt(g, String(f), fx(f), top + gap * 5 + 44, 20, C.muted);
  for (let s = 0; s < 6; s++) { g.strokeStyle = '#efe6d6'; g.lineWidth = 1.2 + (5 - s) * 0.55; g.beginPath(); g.moveTo(from === 0 ? left - 60 : left, sy(s)); g.lineTo(left + n * fretW, sy(s)); g.stroke(); }
  // أرقام الأوتار
  for (let s = 0; s < 6; s++) txt(g, String(6 - s), from === 0 ? left - 92 : 30, sy(s), 18, C.muted);
  const dots = ex.dots.filter(d => d.f <= to && (from > 0 ? d.f > from : d.f >= 0));
  dots.forEach((d, k) => {
    const a = ease(appear * dots.length - k * 0.8);
    if (a <= 0) return;
    const cx = fx(d.f) + (d.qt ? 12 : 0), cy = sy(d.s), on = active.get(`${d.s}:${d.f}:${d.qt ? 1 : 0}`);
    const r = 21 * (0.6 + 0.4 * a) * (on ? 1.18 : 1);
    if (on) { g.save(); g.globalAlpha = 0.5 * on; g.fillStyle = C.acc; g.beginPath(); g.arc(cx, cy, r + 14, 0, 7); g.fill(); g.restore(); }
    g.save(); g.globalAlpha = a;
    g.fillStyle = on ? '#ffd27a' : d.kind === 'root' ? C.root : d.qt ? C.quarter : d.kind === 'chord' ? C.chord : C.note;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    if (d.label != null) { let lb = String(d.label); if (d.qt) lb = lb.replace('½♭', '').replace('+¼', ''); txt(g, lb, cx, cy + 1, lb.length > 3 ? 13 : lb.length > 2 ? 16 : 19, d.kind === 'root' || d.qt ? '#fff' : '#1b1815', 'center', 700); }
    if (d.qt) txt(g, '↑¼', cx + 22, cy - 22, 15, C.quarter);
    g.restore();
  });
  // نوتات غير موجودة كنقاط (مثل الأوتار المطلقة في الكورد)
  for (const [k, on] of active) {
    const [s, f, qt] = k.split(':').map(Number);
    if (dots.some(d => d.s === s && d.f === f && !!d.qt === !!qt)) continue;
    const cx = fx(f) + (qt ? 12 : 0), cy = sy(s);
    g.save(); g.globalAlpha = on; g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(cx, cy, 22, 0, 7); g.fill();
    txt(g, noteName((OPEN_STRINGS[s] + f) * 2 + (qt ? 1 : 0)), cx, cy + 1, 15, '#1b1815', 'center', 700); g.restore();
  }
}

function activeAt(s, local) {
  const m = new Map();
  if (!s.demo) return m;
  const spb = 60 / s.bpm, tt = local - s.demoAt;
  if (tt < 0) return m;
  for (const e of s.events) {
    const st = e.t * spb, d = Math.max(0.2, e.d * spb * 0.95);
    if (tt >= st && tt <= st + d) {
      const a = 1 - Math.max(0, (tt - st) / d - 0.6) / 0.4;
      (e.kind === 'strum' ? e.chord : [e]).forEach(p => m.set(`${p.s}:${p.f}:${p.qt ? 1 : 0}`, a));
    }
  }
  return m;
}

function rhythmStrip(g, rh, s, local) {
  const pat = rh.pattern, n = pat.length, w = 70, x0 = W / 2 - n * w / 2, y = 520;
  const spb = 60 / s.bpm, slot = spb * rh.slot, tt = local - s.demoAt;
  const cur = tt >= 0 && s.demo ? Math.floor(tt / slot) % n : -1;
  txt(g, `إيقاع ${rh.name}`, W / 2, y - 40, 24, C.acc);
  for (let i = 0; i < n; i++) {
    const ch = pat[n - 1 - i]; const idx = n - 1 - i; // من اليمين لليسار
    const x = x0 + i * w;
    g.fillStyle = idx === cur ? C.acc : ch === 'D' ? '#5a3a22' : ch === 'T' ? '#3a332c' : '#221e1a';
    roundRect(g, x + 4, y, w - 8, 64, 10); g.fill();
    txt(g, ch === 'D' ? 'دُم' : ch === 'T' ? 'تَك' : '·', x + w / 2, y + 33, 22, idx === cur ? '#1b1815' : C.text);
  }
}

export function drawAt(g, plan, t) {
  const s = plan.scenes.find(x => t >= x.t0 && t < x.t0 + x.dur) || plan.scenes[plan.scenes.length - 1];
  const local = t - s.t0;
  background(g, t);
  const fadeIn = ease(local / 0.5), fadeOut = ease((s.dur - local) / 0.4);
  g.save(); g.globalAlpha = Math.min(fadeIn, fadeOut);
  const L = s.L;
  if (s.kind === 'intro') {
    const lvl = `المستوى ${L.level}${L.unit ? ' · ' + L.unit : ''}`;
    txt(g, lvl, W / 2, 190, 28, C.acc);
    const a = ease(local / 1.0);
    g.save(); g.globalAlpha = a; g.translate(0, (1 - a) * 30);
    wrap(g, L.title, W - 200, 60, 800).forEach((ln, i) => txt(g, ln, W / 2, 285 + i * 80, 60, C.text, 'center', 800));
    g.restore();
    const b = ease((local - 0.8) / 0.8);
    if (b > 0 && L.goal) { g.save(); g.globalAlpha = b; wrap(g, '🎯 ' + L.goal, W - 260, 30).forEach((ln, i) => txt(g, ln, W / 2, 440 + i * 48, 30, C.muted)); g.restore(); }
    if (L.minutes) txt(g, `⏱ ${L.minutes} دقيقة`, W / 2, 600, 22, C.muted);
  } else if (s.kind === 'step') {
    header(g, L, `الخطوة ${s.i + 1} من ${s.n}`);
    if (s.ex && (s.ex.dots.length || s.events.length)) {
      const appear = Math.min(1, local / Math.max(1.2, Math.min(4, s.narr * 0.6)));
      fretboard(g, s.ex, activeAt(s, local), t, appear);
      if (s.demo && local >= s.demoAt - 0.2) txt(g, '🎧 استمع وشاهد', W / 2, 100, 24, C.acc);
      if (s.rh) rhythmStrip(g, s.rh, s, local);
      if (s.ex.dots.some(d => d.qt)) txt(g, 'النقطة البرتقالية ↑¼ = ربع تون (بِند خفيف)', W / 2, 560, 22, C.quarter, 'center');
    } else if (s.rh) {
      rhythmStrip(g, s.rh, s, local);
    } else if (s.fig) {
      g.save(); g.translate(0, 70); g.scale(1, (H - 220) / H);
      drawFigure(g, s.fig, W, H, Math.min(1, local / Math.max(2, s.narr)));
      g.restore();
    } else {
      // بطاقة نص كبيرة لأهم جملة
      const first = (s.st.say || '').split(/(?<=[.؟!])\s+/)[0];
      const lines = wrap(g, first, W - 300, 40, 700);
      const a = ease(local / 0.8);
      g.save(); g.globalAlpha = a;
      g.fillStyle = C.card; roundRect(g, 120, 140, W - 240, 60 + lines.length * 62, 24); g.fill();
      g.strokeStyle = C.acc; g.lineWidth = 3; g.stroke();
      lines.forEach((ln, i) => txt(g, ln, W / 2, 195 + i * 62, 40, C.text, 'center', 700));
      g.restore();
    }
    subtitle(g, s.v, local - s.vAt);
  } else if (s.kind === 'tip') {
    header(g, L, 'نصيحة اللجنة');
    const [emo, name] = ROLE[s.role];
    const a = ease(local / 0.7);
    g.save(); g.globalAlpha = a;
    g.fillStyle = C.card; g.beginPath(); g.arc(W / 2, 220, 90, 0, 7); g.fill(); g.strokeStyle = C.acc; g.lineWidth = 4; g.stroke();
    g.font = '96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emo, W / 2, 226);
    txt(g, name, W / 2, 350, 34, C.acc, 'center', 700);
    wrap(g, '«' + s.text + '»', W - 280, 30).slice(0, 4).forEach((ln, i) => txt(g, ln, W / 2, 420 + i * 48, 30, C.text));
    g.restore();
  } else if (s.kind === 'outro') {
    txt(g, '✅ بعد هذا الدرس تقدر:', W / 2, 150, 40, C.acc, 'center', 800);
    (L.checks || []).slice(0, 5).forEach((c, i) => { const a = ease((local - 0.5 - i * 0.5) / 0.5); if (a <= 0) return; g.save(); g.globalAlpha = a; txt(g, '• ' + c, W / 2, 240 + i * 62, 32); g.restore(); });
    txt(g, 'جرّب بنفسك في التطبيق 🎸', W / 2, 600, 30, C.muted);
  }
  g.restore();
  // شريط التقدم
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, H - 6, W, 6);
  g.fillStyle = C.acc; g.fillRect(W - W * (t / plan.duration), H - 6, W * (t / plan.duration), 6);
}

// ===== واجهة لسكربت التصدير =====
let plan = null, ctx2d = null;
window.videoPrepare = async id => {
  await document.fonts.load(FONT(30)); await document.fonts.load(FONT(30, 800)); await document.fonts.ready;
  audioCache = new Map();
  plan = await buildScenes(id);
  const cv = document.getElementById('cv'); ctx2d = cv.getContext('2d');
  return { duration: plan.duration, fps: FPS, scenes: plan.scenes.length, missingVoice: plan.scenes.filter(s => s.v && !s.v.buf).length };
};
window.videoFrame = t => { drawAt(ctx2d, plan, t); };
window.videoAudio = async () => wavBase64(await renderAudio(plan));
