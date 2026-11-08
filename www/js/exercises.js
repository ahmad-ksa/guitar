// مولّد التمارين: يحوّل وصفاً مختصراً إلى نوتات على الرقبة وتسلسل زمني للعزف
import { OPEN_STRINGS, getScale, scaleOffsets, noteName, spelledName, chordVoicings, degreeLabel, parseChord } from './theory.js';

const openQ = s => OPEN_STRINGS[s] * 2;

function pos(s, q) {
  const fq = q - openQ(s);
  return { s, f: Math.floor(fq / 2), qt: fq % 2 ? 1 : 0, q };
}

// كل نوتات السلم في مدى واسع مع رقم الدرجة
function scaleTones(scaleId, rootPc, rootQuarter = false, dir = 'asc') {
  const off = scaleOffsets(scaleId, dir);
  const base = (36 + rootPc) * 2 + (rootQuarter ? 1 : 0); // C2 منطقة
  const out = [];
  for (let oct = -1; oct < 6; oct++) {
    off.forEach((o, i) => out.push({ q: base + oct * 24 + o, deg: i }));
  }
  return out.sort((a, b) => a.q - b.q);
}

// المقام على وتر واحد (العزف الأفقي): من القرار إلى جوابه على نفس الوتر
// يرجع { up, down, top } ؛ down تستخدم سلم النزول إن وُجد
export function stringPattern(scaleId, rootPc, s, { rootQuarter = false, maxFret = 22 } = {}) {
  const len = scaleOffsets(scaleId).length;
  const onStr = dir => scaleTones(scaleId, rootPc, rootQuarter, dir).map(t => ({ ...pos(s, t.q), deg: t.deg })).filter(p => p.f >= 0 && !(p.f === 0 && p.qt));
  const asc = onStr('asc');
  const r = asc.findIndex(p => p.deg === 0);
  if (r < 0) return null;
  const up = asc.slice(r, r + len + 1);
  const lo = up[0].q, hi = up[up.length - 1].q;
  const down = onStr('desc').filter(p => p.q >= lo && p.q <= hi).reverse();
  return { up, down, top: Math.max(...up.map(p => p.f)), fits: up.length === len + 1 && hi - openQ(s) <= maxFret * 2 + 1 };
}

// نمط "عدد ثابت من النوتات لكل وتر" — يعطي صناديق البنتاتونيك و3NPS
export function npsPattern(scaleId, rootPc, { nps = 3, box = 0, rootQuarter = false } = {}) {
  const tones = scaleTones(scaleId, rootPc, rootQuarter);
  const len = scaleOffsets(scaleId).length;
  // ابحث عن أول قرار على الوتر 6 بفرت >= 0
  let startIdx = tones.findIndex(t => t.deg === 0 && t.q >= openQ(0));
  startIdx += box;
  for (let attempt = 0; attempt < 3; attempt++) {
    const out = [];
    let idx = startIdx;
    for (let s = 0; s < 6; s++) {
      for (let k = 0; k < nps; k++) {
        const t = tones[idx++];
        if (!t) break;
        out.push({ ...pos(s, t.q), deg: t.deg });
      }
    }
    const minF = Math.min(...out.map(p => p.f));
    const maxF = Math.max(...out.map(p => p.f));
    if (minF < 0) { startIdx += len; continue; }
    if (minF > 12 && startIdx - len >= 0) { startIdx -= len; continue; }
    if (maxF > 22) { startIdx -= len; continue; }
    return out;
  }
  return [];
}

// كل نوتات السلم داخل نافذة فرتات، مرتبة صعوداً، دون تكرار الطبقة
export function windowPattern(scaleId, rootPc, from, to, { rootQuarter = false, dir = 'asc' } = {}) {
  const tones = scaleTones(scaleId, rootPc, rootQuarter, dir);
  const set = new Map(tones.map(t => [t.q, t.deg]));
  const out = [];
  let last = -1;
  for (let s = 0; s < 6; s++) {
    for (let fq = from * 2; fq <= to * 2 + 1; fq++) {
      const q = openQ(s) + fq;
      if (!set.has(q) || q <= last) continue;
      // تجنب ربع التون على الفرت 0 (لا يمكن البِند على وتر مفتوح بسهولة)
      const p = pos(s, q);
      if (p.f < 0) continue;
      if (p.f === 0 && p.qt) { // ربع تون فوق وتر مفتوح: ضعه على الوتر الأغلظ إن أمكن
        if (s > 0) { const alt = pos(s - 1, q); if (alt.f <= to + 1) { out.push({ ...alt, deg: set.get(q) }); last = q; } }
        continue;
      }
      // إن كانت النوتة أسهل على الوتر التالي (أبعد من 4 فرتات عن البداية) اتركها له
      if (s < 5 && p.f - from > 4 && openQ(s + 1) + from * 2 <= q) continue;
      out.push({ ...p, deg: set.get(q) });
      last = q;
    }
  }
  return out;
}

// كل مواضع السلم على الرقبة (للعرض في المستكشف)
export function allPositions(scaleId, rootPc, from = 0, to = 15, { rootQuarter = false, dir = 'asc' } = {}) {
  const tones = scaleTones(scaleId, rootPc, rootQuarter, dir);
  const set = new Map(tones.map(t => [t.q, t.deg]));
  const out = [];
  for (let s = 0; s < 6; s++) {
    for (let fq = from * 2; fq <= to * 2 + 1; fq++) {
      const q = openQ(s) + fq;
      if (set.has(q)) { const p = pos(s, q); if (!(p.f === 0 && p.qt)) out.push({ ...p, deg: set.get(q) }); }
    }
  }
  return out;
}

// أرقام الأصابع لموضع
export function assignFingers(positions) {
  const fretted = positions.filter(p => p.f > 0);
  if (!fretted.length) return positions.map(p => ({ ...p, finger: 0 }));
  const min = Math.min(...fretted.map(p => p.f));
  const max = Math.max(...fretted.map(p => p.f));
  return positions.map(p => {
    if (p.f === 0) return { ...p, finger: 0 };
    if (max - min <= 3) return { ...p, finger: p.f - min + 1 };
    // امتداد: حسب موقع النوتة على وترها
    const same = positions.filter(o => o.s === p.s && o.f > 0).map(o => o.f);
    const lo = Math.min(...same), hi = Math.max(...same);
    if (p.f === lo) return { ...p, finger: 1 };
    if (p.f === hi) return { ...p, finger: hi - lo >= 4 ? 4 : Math.min(4, hi - lo + 1) };
    return { ...p, finger: p.f - lo <= 1 ? 2 : 3 };
  });
}

export function labelFor(p, mode, scaleId, rootPc) {
  if (mode === 'degree') return p.deg != null ? degreeLabel(scaleId, p.deg) : '';
  if (mode === 'finger') return p.finger != null ? (p.finger || 'م') : '';
  if (mode === 'none') return '';
  if (p.deg != null && rootPc != null && scaleId && scaleOffsets(scaleId).length === 7) return spelledName(p.q, rootPc, p.deg);
  return noteName(p.q);
}

// تحويل مواضع إلى تسلسل زمني
function toEvents(positions, sub = 1, dir = 'up') {
  let seq = positions;
  if (dir === 'down') seq = [...positions].reverse();
  if (dir === 'updown') seq = [...positions, ...[...positions].reverse().slice(1)];
  return seq.map((p, i) => ({ ...p, t: i / sub, d: 1 / sub }));
}

// تتابعات: مجموعات (في ثلاثيات، رباعيات)، أو فواصل
function sequenceEvents(positions, group = 3, sub = 2, kind = 'groups') {
  const seq = [];
  if (kind === 'thirds') {
    for (let i = 0; i + 2 < positions.length; i++) seq.push(positions[i], positions[i + 2]);
  } else {
    for (let i = 0; i + group <= positions.length; i++) for (let k = 0; k < group; k++) seq.push(positions[i + k]);
  }
  return seq.map((p, i) => ({ ...p, t: i / sub, d: 1 / sub }));
}

// اختيار شكل كورد
export function pickVoicing(pc, type, prefer = 'open') {
  const v = chordVoicings(pc, type);
  if (!v.length) return null;
  if (prefer === 'open') return v[0];
  if (prefer === 'E') return v.find(x => x.label.includes('E')) || v[0];
  if (prefer === 'A') return v.find(x => x.label.includes('A')) || v[0];
  return v[0];
}

function chordPositions(voicing) {
  return voicing.frets.map((f, s) => (f < 0 ? null : { s, f, qt: 0, q: (OPEN_STRINGS[s] + f) * 2, finger: voicing.fingers?.[s] || 0 })).filter(Boolean);
}

// أنماط الضرب: D = تحت، U = فوق، - = سكتة. كل خانة = ثُمن
export const STRUM_PATTERNS = {
  whole: 'D-------',
  quarters: 'D-D-D-D-',
  basic: 'D-D-DUDU',
  pop: 'D-DU-UDU',
  ballad: 'D---DUDU',
  rock: 'DDDDDDDD',
  waltz: 'D-D-D-',
};

function chordStrumEvents(voicing, beats = 4, pattern = 'quarters', startT = 0, chordLabel = '') {
  const pat = STRUM_PATTERNS[pattern] || pattern;
  const ev = [];
  const slots = Math.round(beats * 2);
  const ps = chordPositions(voicing);
  for (let i = 0; i < slots; i++) {
    const c = pat[i % pat.length];
    if (c === 'D' || c === 'U') ev.push({ kind: 'strum', down: c === 'D', chord: ps, voicing, label: chordLabel, t: startT + i / 2, d: 0.5 });
  }
  return ev;
}

function arpEvents(voicing, order = 'up', sub = 2, startT = 0, beats = 4, chordLabel = '') {
  let ps = chordPositions(voicing);
  if (order === 'down') ps = ps.reverse();
  if (order === 'updown') ps = [...ps, ...[...ps].reverse().slice(1, -1)];
  const ev = [];
  const total = Math.round(beats * sub);
  for (let i = 0; i < total; i++) ev.push({ ...ps[i % ps.length], t: startT + i / sub, d: 1 / sub, voicing, label: chordLabel });
  return ev;
}

// ========== نقطة الدخول: بناء تمرين من وصف ==========
// يعيد { events, dots, from, to, scaleId, bpm, sub, beats }
export function buildExercise(spec = {}) {
  const t = spec.type;
  const label = spec.label || 'note';
  let positions = [];
  let events = [];
  let extraDots = [];
  const scaleId = spec.scale;
  const rootPc = spec.root ?? 0;
  const rq = spec.rootQuarter ?? (getScale(scaleId)?.rootQuarter || false);

  if (t === 'nps') {
    positions = npsPattern(scaleId, rootPc, { nps: spec.nps || 3, box: spec.box || 0, rootQuarter: rq });
  } else if (t === 'window' || t === 'scale') {
    positions = windowPattern(scaleId, rootPc, spec.from ?? 0, spec.to ?? 4, { rootQuarter: rq });
    if (spec.octaves === 1) {
      const r = positions.findIndex(p => p.deg === 0);
      const r2 = positions.findIndex((p, i) => i > r && p.deg === 0);
      if (r >= 0 && r2 > r) positions = positions.slice(r, r2 + 1);
    }
  } else if (t === 'notes') {
    positions = spec.notes.map(n => {
      const [s, f, qt = 0, extra = {}] = Array.isArray(n) ? n : [n.s, n.f, n.qt, n];
      return { s, f, qt, q: (OPEN_STRINGS[s] + f) * 2 + qt, ...extra };
    });
  } else if (t === 'maqamString') { // مقام على وتر واحد صعوداً ونزولاً
    const sp = stringPattern(scaleId, rootPc, spec.string ?? 5, { rootQuarter: rq });
    positions = sp ? [...sp.up, ...sp.down.slice(1)].map(p => ({ ...p, dur: spec.dur || 0.5 })) : [];
  } else if (t === 'string') { // نوتات وتر واحد
    const s = spec.string;
    const nat = [0, 2, 4, 5, 7, 9, 11];
    for (let f = 0; f <= (spec.to ?? 12); f++) {
      const pc = (OPEN_STRINGS[s] + f) % 12;
      if (spec.naturalOnly === false || nat.includes(pc)) positions.push({ s, f, qt: 0, q: (OPEN_STRINGS[s] + f) * 2 });
    }
  } else if (t === 'chromatic') {
    const start = spec.fret ?? 1;
    const fingers = spec.fingers || [1, 2, 3, 4];
    const strings = spec.strings || [0, 1, 2, 3, 4, 5];
    for (const s of strings) for (const fi of fingers) positions.push({ s, f: start + fi - 1, qt: 0, q: (OPEN_STRINGS[s] + start + fi - 1) * 2, finger: fi });
    if (spec.dir === 'updown') {
      const down = [];
      for (const s of [...strings].reverse()) for (const fi of [...fingers].reverse()) down.push({ s, f: start + fi - 1, qt: 0, q: (OPEN_STRINGS[s] + start + fi - 1) * 2, finger: fi });
      positions = [...positions, ...down.slice(1)];
      spec = { ...spec, dir: 'up' };
    }
  } else if (t === 'chord' || t === 'progression' || t === 'arp') {
    const chords = (spec.chords || [spec.chord]).map(c => (typeof c === 'string' ? parseChord(c) : c));
    let T = 0;
    const beats = spec.beats || 4;
    for (const c of chords) {
      const v = spec.voicing || pickVoicing(c.pc, c.type, spec.prefer || 'open');
      if (!v) continue;
      const lbl = c.raw || '';
      if (t === 'arp') events.push(...arpEvents(v, spec.order || 'up', spec.sub || 2, T, beats, lbl));
      else events.push(...chordStrumEvents(v, beats, spec.pattern || 'quarters', T, lbl));
      T += beats;
      if (chords.length === 1) extraDots = chordPositions(v).map(p => ({ ...p, kind: 'chord', label: p.finger || (p.f === 0 ? 'م' : '') }));
    }
    const first = chords[0] && (spec.voicing || pickVoicing(chords[0].pc, chords[0].type, spec.prefer || 'open'));
    if (!extraDots.length && first) extraDots = chordPositions(first).map(p => ({ ...p, kind: 'chord', label: p.finger || '' }));
    return finalize({ events, dots: extraDots, spec, beats: T });
  } else if (t === 'bend') {
    const { s, f, amount = 2 } = spec; // amount بأرباع التون
    const q0 = (OPEN_STRINGS[s] + f) * 2;
    events = [
      { s, f, qt: 0, q: q0 + amount, t: 0, d: 2, bendFrom: q0, label: '↑' },
      { s, f: f + Math.floor(amount / 2), qt: amount % 2, q: q0 + amount, t: 2.5, d: 1.5, label: 'هدف' },
    ];
    const dots = [{ s, f, qt: 0, q: q0, kind: 'root', label: noteName(q0) }];
    dots.push({ s, f: f + Math.floor(amount / 2), qt: amount % 2, q: q0 + amount, kind: 'ghost', label: noteName(q0 + amount) });
    return finalize({ events, dots, spec, beats: 4 });
  } else if (t === 'all') {
    // كل المواضع للعرض، والعزف = الصناديق متتالية صعوداً
    const all = allPositions(scaleId, rootPc, 0, spec.to ?? 17, { rootQuarter: rq });
    const len = scaleOffsets(scaleId).length;
    const nps = len === 5 ? 2 : 3;
    let T = 0;
    const sub = spec.sub || 2;
    const seen = [];
    for (let b = 0; b < len; b++) {
      const box = npsPattern(scaleId, rootPc, { nps, box: b, rootQuarter: rq });
      seen.push(box);
    }
    seen.sort((a, b) => Math.min(...a.map(p => p.f)) - Math.min(...b.map(p => p.f)));
    for (const box of seen) for (const p of box) { events.push({ ...p, t: T, d: 1 / sub }); T += 1 / sub; }
    const dots = all.map(p => ({ ...p, kind: p.deg === 0 ? 'root' : (p.qt ? 'quarter' : 'note'), label: labelFor(p, label === 'finger' ? 'degree' : label, scaleId, rootPc) }));
    return finalize({ events, dots, spec: { ...spec, view: spec.view || [0, spec.to ?? 17] }, beats: T });
  } else if (t === 'drone') {
    // درون + السلم: يعزف القرار ثم السلم
    positions = windowPattern(scaleId, rootPc, spec.from ?? 0, spec.to ?? 5, { rootQuarter: rq });
  }

  if (spec.label === 'finger' || spec.fingers !== false) positions = assignFingers(positions);
  const sub = spec.sub || 1;
  if (!events.length) {
    if (spec.seq === 'threes') events = sequenceEvents(positions, 3, sub);
    else if (spec.seq === 'fours') events = sequenceEvents(positions, 4, sub);
    else if (spec.seq === 'thirds') events = sequenceEvents(positions, 2, sub, 'thirds');
    else if ((t === 'notes' || t === 'maqamString') && positions.some(p => p.dur)) {
      let T = 0;
      events = positions.map(p => { const e = { ...p, t: T, d: p.dur }; T += p.dur; return e; });
    } else events = toEvents(positions, sub, spec.dir || (t === 'notes' ? 'up' : 'updown'));
  }
  const dots = positions.map(p => ({
    ...p,
    kind: p.deg === 0 ? 'root' : (p.qt ? 'quarter' : 'note'),
    label: labelFor(p, label, scaleId, rootPc),
  }));
  const beats = events.length ? Math.max(...events.map(e => e.t + e.d)) : 4;
  return finalize({ events, dots, spec, beats });
}

function finalize({ events, dots, spec, beats }) {
  const frets = [...dots, ...events.flatMap(e => e.chord || [e])].map(p => p.f).filter(f => f != null);
  let from = spec.view?.[0];
  let to = spec.view?.[1];
  if (from == null) {
    const mn = frets.length ? Math.min(...frets) : 0, mx = frets.length ? Math.max(...frets) : 0;
    if (spec.full) { from = 0; to = Math.max(15, mx + 1); }
    else if (mn <= 3) { from = 0; to = Math.max(mx + 1, 7); }
    else { from = mn - 2; to = Math.min(22, Math.max(mx + 1, from + 7)); }
  }
  return { events, dots, from, to, beats, bpm: spec.bpm || 70, spec };
}
