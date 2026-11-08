// رسم رقبة الجيتار التفاعلي (SVG) ومخططات الكوردات
import { OPEN_STRINGS, noteName, freqOfQ } from './theory.js';
import { pluck } from './audio.js';

const NS = 'http://www.w3.org/2000/svg';
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export function posKey(p) { return `${p.s}:${p.f}:${p.qt ? 1 : 0}`; }
export function qOf(s, f, qt = 0) { return (OPEN_STRINGS[s] + f) * 2 + (qt ? 1 : 0); }

export class Fretboard {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = Object.assign({ from: 0, to: 15, fretW: 56, gap: 30, tapToPlay: true, compact: false }, opts);
    this.dots = new Map();
    this.build();
  }

  build() {
    const { from, to, fretW, gap } = this.opts;
    const n = to - from;
    const left = from === 0 ? 40 : 22;
    const top = 22;
    const width = left + n * fretW + 16;
    const height = top + gap * 5 + 34;
    this.geom = { left, top, width, height };
    this.container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'fb-wrap';
    wrap.dir = 'ltr';
    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: 'fretboard', role: 'img', 'aria-label': 'رقبة الجيتار', preserveAspectRatio: 'xMinYMid meet' });
    svg.style.width = '100%';
    svg.style.minWidth = `${Math.round(width * 0.72)}px`;
    svg.style.maxWidth = `${Math.round(width * 1.25)}px`;
    this.svg = svg;
    // الخشب
    el('rect', { x: left, y: top - 10, width: n * fretW, height: gap * 5 + 20, rx: 4, class: 'fb-wood' }, svg);
    // العلامات
    for (let f = from + 1; f <= to; f++) {
      const cx = this.fx(f);
      if (INLAYS.includes(f)) el('circle', { cx, cy: top + gap * 2.5, r: 6, class: 'fb-inlay' }, svg);
      if (f === 12 || f === 24) {
        el('circle', { cx, cy: top + gap * 1.5, r: 6, class: 'fb-inlay' }, svg);
        el('circle', { cx, cy: top + gap * 3.5, r: 6, class: 'fb-inlay' }, svg);
      }
    }
    // الفرتات
    for (let f = from; f <= to; f++) {
      const x = left + (f - from) * fretW;
      el('line', { x1: x, y1: top - 10, x2: x, y2: top + gap * 5 + 10, class: f === 0 ? 'fb-nut' : 'fb-fret' }, svg);
    }
    for (let f = from + 1; f <= to; f++) {
      const t = el('text', { x: this.fx(f), y: top + gap * 5 + 28, class: 'fb-num' }, svg);
      t.textContent = f;
    }
    // الأوتار (الرفيع في الأعلى كما في التاب)
    for (let s = 0; s < 6; s++) {
      const y = this.sy(s);
      el('line', { x1: from === 0 ? left - 30 : left, y1: y, x2: left + n * fretW, y2: y, class: 'fb-string', 'stroke-width': 0.8 + (5 - s) * 0.38 }, svg);
    }
    // طبقة النقر
    if (this.opts.tapToPlay) {
      svg.addEventListener('pointerdown', ev => this.onTap(ev));
    }
    this.dotLayer = el('g', { class: 'fb-dots' }, svg);
    this.fxLayer = el('g', { class: 'fb-fx' }, svg);
    wrap.appendChild(svg);
    this.container.appendChild(wrap);
    this.wrap = wrap;
  }

  sy(s) { return this.geom.top + (5 - s) * this.opts.gap; }
  fx(f) {
    const { from, fretW } = this.opts;
    if (f === 0) return this.geom.left - 18;
    return this.geom.left + (f - from - 0.5) * fretW;
  }

  onTap(ev) {
    const pt = this.svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(this.svg.getScreenCTM().inverse());
    const s = Math.round(5 - (p.y - this.geom.top) / this.opts.gap);
    if (s < 0 || s > 5) return;
    let f;
    if (p.x < this.geom.left) f = this.opts.from === 0 ? 0 : this.opts.from;
    else f = this.opts.from + Math.floor((p.x - this.geom.left) / this.opts.fretW) + 1;
    if (f > this.opts.to) return;
    // إن كان هناك نقطة ربع تون في هذا الموقع اعزفها
    const qtDot = this.dots.get(posKey({ s, f, qt: 1 }));
    const qt = qtDot && !this.dots.get(posKey({ s, f, qt: 0 })) ? 1 : 0;
    const q = qOf(s, f, qt);
    pluck(freqOfQ(q), 0, { gain: 0.6 });
    this.flash({ s, f, qt });
    if (this.opts.onTap) this.opts.onTap({ s, f, qt, q });
  }

  clear() { this.dotLayer.innerHTML = ''; this.dots.clear(); }

  // dots: [{s,f,qt,label,kind:'root'|'note'|'quarter'|'ghost'|'chord'}]
  setDots(dots) {
    this.clear();
    for (const d of dots) this.addDot(d);
  }

  addDot(d) {
    if (d.f > this.opts.to || (this.opts.from > 0 ? d.f <= this.opts.from : d.f < 0)) return;
    const g = el('g', { class: `fb-dot ${d.kind || 'note'}${d.qt ? ' qt' : ''}` }, this.dotLayer);
    const cx = this.fx(d.f) + (d.qt ? 8 : 0);
    const cy = this.sy(d.s);
    el('circle', { cx, cy, r: this.opts.compact ? 11 : 13 }, g);
    if (d.label != null) {
      const t = el('text', { x: cx, y: cy + 4.5, class: 'fb-dot-label' }, g);
      let lb = String(d.label);
      if (d.qt) lb = lb.replace('½♭', '').replace('+¼', '');
      t.textContent = lb;
      if (lb.length > 3) t.setAttribute('font-size', '8.5');
      else if (lb.length > 2) t.setAttribute('font-size', '10');
    }
    if (d.qt) {
      const a = el('text', { x: cx + 12, y: cy - 10, class: 'fb-qt-mark' }, g);
      a.textContent = '↑¼';
    }
    this.dots.set(posKey(d), g);
    return g;
  }

  // إضاءة نوتة أثناء العزف
  flash(p, dur = 0.35, label) {
    const cx = this.fx(p.f) + (p.qt ? 8 : 0);
    const cy = this.sy(p.s);
    const existing = this.dots.get(posKey(p));
    if (existing) {
      existing.classList.add('on');
      setTimeout(() => existing.classList.remove('on'), Math.max(120, dur * 1000));
    } else {
      const g = el('g', { class: 'fb-dot temp on' }, this.fxLayer);
      el('circle', { cx, cy, r: 13 }, g);
      const t = el('text', { x: cx, y: cy + 4.5, class: 'fb-dot-label' }, g);
      t.textContent = label ?? noteName(qOf(p.s, p.f, p.qt));
      setTimeout(() => g.remove(), Math.max(200, dur * 1000));
    }
    const ring = el('circle', { cx, cy, r: 14, class: 'fb-ring' }, this.fxLayer);
    setTimeout(() => ring.remove(), 600);
    this.scrollTo(p.f);
  }

  scrollTo(f) {
    const w = this.wrap;
    if (!w || w.scrollWidth <= w.clientWidth) return;
    const x = this.fx(f);
    const scale = w.scrollWidth / this.geom.width;
    const target = x * scale - w.clientWidth / 2;
    if (Math.abs(w.scrollLeft - target) > w.clientWidth * 0.3) w.scrollTo({ left: target, behavior: 'smooth' });
  }

  // إظهار مسار (خطوط بين النوتات بالترتيب) لتوضيح اتجاه التمرين
  drawPath(seq) {
    const old = this.svg.querySelector('.fb-path'); if (old) old.remove();
    if (!seq || seq.length < 2) return;
    const pts = seq.map(p => `${this.fx(p.f) + (p.qt ? 8 : 0)},${this.sy(p.s)}`).join(' ');
    const pl = el('polyline', { points: pts, class: 'fb-path' });
    this.svg.insertBefore(pl, this.dotLayer);
  }
}

// ===== مخطط الكورد العمودي =====
export function chordDiagram(voicing, title) {
  const W = 120, H = 150, left = 18, top = 30, sw = 17, fh = 22;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chord-svg', width: W, height: H, direction: 'ltr' });
  const played = voicing.frets.filter(f => f > 0);
  const maxF = played.length ? Math.max(...played) : 0;
  const minF = played.length ? Math.min(...played) : 1;
  const base = maxF <= 5 ? 1 : (voicing.baseFret || minF);
  if (title) { const t = el('text', { x: W / 2, y: 13, class: 'cd-title' }, svg); t.textContent = title; }
  for (let i = 0; i < 6; i++) el('line', { x1: left + i * sw, y1: top, x2: left + i * sw, y2: top + fh * 5, class: 'cd-line' }, svg);
  for (let j = 0; j <= 5; j++) el('line', { x1: left, y1: top + j * fh, x2: left + 5 * sw, y2: top + j * fh, class: j === 0 && base === 1 ? 'cd-nut' : 'cd-line' }, svg);
  if (base > 1) { const t = el('text', { x: left + 5 * sw + 6, y: top + fh * 0.7, class: 'cd-base' }, svg); t.textContent = base; }
  // باريه
  const fingers = voicing.fingers || [];
  const ones = voicing.frets.map((f, i) => ({ f, i, fin: fingers[i] })).filter(o => o.fin === 1 && o.f > 0);
  if (ones.length >= 2) {
    const fr = ones[0].f; const a = Math.min(...ones.map(o => o.i)); const b = Math.max(...ones.map(o => o.i));
    const y = top + (fr - base + 0.5) * fh;
    el('rect', { x: left + a * sw - 7, y: y - 7, width: (b - a) * sw + 14, height: 14, rx: 7, class: 'cd-barre' }, svg);
  }
  voicing.frets.forEach((f, i) => {
    const x = left + i * sw;
    if (f < 0) { const t = el('text', { x, y: top - 6, class: 'cd-x' }, svg); t.textContent = '×'; }
    else if (f === 0) el('circle', { cx: x, cy: top - 10, r: 4, class: 'cd-open' }, svg);
    else {
      const y = top + (f - base + 0.5) * fh;
      el('circle', { cx: x, cy: y, r: 7, class: 'cd-dot' }, svg);
      if (fingers[i]) { const t = el('text', { x, y: y + 3.5, class: 'cd-fin' }, svg); t.textContent = fingers[i]; }
    }
  });
  return svg;
}

export function voicingFreqs(voicing) {
  return voicing.frets.map((f, s) => (f < 0 ? null : freqOfQ((OPEN_STRINGS[s] + f) * 2))).filter(Boolean);
}
