// أدوات ما بعد التحليل: «اعزف معي»، اللحن على الزند، المرافقة التلقائية
import { h, card, slider, toggle, select, toast } from '../ui.js';
import { getCtx, detectPitch, drum, droneStart, droneStop, stopAll } from '../audio.js';
import { MAQAMAT, RHYTHMS, OPEN_STRINGS, spelledName, stepsToOffsets, freqOfQ, ROOTS, pcName } from '../theory.js';
import { Fretboard } from '../fretboard.js';
import { allPositions } from '../exercises.js';
import { Player } from '../player.js';

const DEG = ['القرار', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة'];
let active = []; // دوال إيقاف
export function stopPracticeTools() { active.forEach(f => { try { f(); } catch (e) {} }); active = []; stopAll(); droneStop(); }

// الدرجات المسموحة (صعوداً ونزولاً) بالسنت من القرار
function maqamCents(id) {
  const m = MAQAMAT[id];
  const set = new Set(stepsToOffsets(m.asc).map(o => o * 50));
  if (m.dsc) stepsToOffsets(m.dsc).forEach(o => set.add(o * 50));
  return [...set].sort((a, b) => a - b);
}
function degIndex(id, c) {
  const asc = stepsToOffsets(MAQAMAT[id].asc).map(o => o * 50);
  let i = asc.indexOf(c);
  if (i < 0 && MAQAMAT[id].dsc) i = stepsToOffsets(MAQAMAT[id].dsc).map(o => o * 50).indexOf(c);
  return i;
}
function noteLabel(t, cRel, deg) {
  return spelledName((48 + t.pc) * 2 + (t.quarter ? 1 : 0) + Math.round(cRel / 50), t.pc, Math.max(0, deg));
}
const tq = q => ({ pc: Math.floor(q / 2) % 12, quarter: q % 2 === 1 });

// ===================== اعزف معي =====================
export function playAlong(host, ctx) {
  // ctx: { id, q, tuning }
  host.innerHTML = '';
  let id = ctx.id, q = ctx.q, tuning = ctx.tuning || 0;
  const sel = h('div', { class: 'row' },
    select(Object.entries(MAQAMAT).map(([k, v]) => ({ value: k, label: v.name })), id, v => { id = v; if (MAQAMAT[v].rootQuarter !== (q % 2 === 1)) q = MAQAMAT[v].root * 2 + (MAQAMAT[v].rootQuarter ? 1 : 0); redraw(); }),
    h('span', { class: 'muted' }, 'من'),
    select(ROOTS.map(r => ({ value: r.pc, label: pcName(r.pc) + (MAQAMAT[id].rootQuarter ? ' ½' : '') })), Math.floor(q / 2) % 12, v => { q = (+v) * 2 + (MAQAMAT[id].rootQuarter ? 1 : 0); redraw(); }));
  const big = h('div', { class: 'tuner-note' }, '—');
  const info = h('div', { class: 'tuner-hz' }, 'اضغط «ابدأ» واعزف على الجيتار');
  const needle = h('div', { class: 'needle' });
  const meter = h('div', { class: 'meter' }, h('div', { class: 'scale' }), needle, ...[-50, -25, 0, 25, 50].map(c => h('span', { class: 'tick', style: { left: `${50 + c}%` } }, c > 0 ? `+${c}` : c)));
  const stat = h('div', { class: 'row between', style: { fontSize: '.9rem' } });
  const fbHost = h('div', { style: { marginTop: '10px' } });
  const degRow = h('div', { class: 'row', style: { justifyContent: 'center', gap: '4px', marginTop: '8px' } });
  const btn = h('button', { class: 'btn primary', style: { width: '100%' } }, '🎸 ابدأ: اعزف وأنا أسمعك');
  host.append(card('اعزف معي', h('p', { class: 'muted', style: { fontSize: '.85rem' } }, 'اعزف على المقام، وسأقول لك هل نوتتك داخله، وكم تبعد بالسنت عن الدرجة الصحيحة. ربع التون يُقاس بدقة.'),
    sel, big, info, meter, stat, degRow, fbHost, btn));

  let fb = null, stats = { inS: 0, total: 0, hits: {} }, cents = [];
  function redraw() {
    cents = maqamCents(id);
    const t = tq(q);
    fbHost.innerHTML = '';
    fb = new Fretboard(fbHost, { from: 0, to: 12, tapToPlay: true });
    fb.setDots(allPositions(id, t.pc, 0, 12, { rootQuarter: t.quarter }).map(p => ({ ...p, kind: p.deg === 0 ? 'root' : (p.qt ? 'quarter' : 'note'), label: noteLabel(t, ((p.q - (48 + t.pc) * 2 - (t.quarter ? 1 : 0)) % 24 + 24) % 24 * 50, p.deg) })));
    degRow.innerHTML = '';
    stepsToOffsets(MAQAMAT[id].asc).forEach((o, i) => degRow.append(h('span', { class: 'pill', 'data-c': o * 50 }, noteLabel(t, o * 50, i))));
    stats = { inS: 0, total: 0, hits: {} };
    stat.innerHTML = '';
  }
  redraw();

  let stream = null, raf = 0, an = null, buf = null, smooth = null, lastFlash = 0, lastKey = '';
  async function start() {
    try {
      const c = getCtx();
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const src = c.createMediaStreamSource(stream);
      an = c.createAnalyser(); an.fftSize = 4096; src.connect(an);
      buf = new Float32Array(an.fftSize);
      btn.textContent = '■ أوقف';
      loop();
    } catch (e) { info.textContent = 'لا يمكن الوصول للمايكروفون. اسمح للتطبيق باستخدامه من إعدادات الجهاز.'; }
  }
  function stop() {
    cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; btn.textContent = '🎸 ابدأ: اعزف وأنا أسمعك';
  }
  active.push(stop);
  function loop() {
    an.getFloatTimeDomainData(buf);
    const r = detectPitch(buf, getCtx().sampleRate);
    if (r && r.freq > 70 && r.freq < 1400 && r.clarity > 0.85) {
      smooth = smooth && Math.abs(1200 * Math.log2(r.freq / smooth)) < 60 ? smooth * 0.7 + r.freq * 0.3 : r.freq;
      const abs = 1200 * Math.log2(smooth / 440) + 6900 - tuning;
      const rel = (((abs - q * 50) % 1200) + 1200) % 1200;
      // أقرب درجة في المقام
      let best = null;
      for (const c of [...cents, 1200]) { const d = rel - c; if (!best || Math.abs(d) < Math.abs(best.d)) best = { c: c % 1200, d }; }
      const inScale = Math.abs(best.d) <= 30;
      const t = tq(q);
      const deg = degIndex(id, best.c);
      big.textContent = noteLabel(t, best.c, deg);
      big.style.color = inScale ? 'var(--good)' : 'var(--bad)';
      info.textContent = inScale ? `${DEG[deg] || ''} — ${Math.abs(best.d) < 12 ? 'مضبوطة' : best.d > 0 ? 'أعلى قليلاً' : 'أخفض قليلاً'}` : 'خارج المقام';
      needle.style.left = `${50 + Math.max(-50, Math.min(50, best.d))}%`;
      meter.classList.toggle('ok', Math.abs(best.d) < 12);
      stats.total++; if (inScale) stats.inS++;
      if (inScale) stats.hits[best.c] = (stats.hits[best.c] || 0) + 1;
      degRow.querySelectorAll('.pill').forEach(p => p.classList.toggle('ok', !!stats.hits[+p.dataset.c]));
      if (stats.total % 10 === 0) stat.innerHTML = '', stat.append(h('span', {}, `داخل المقام: ${Math.round(100 * stats.inS / stats.total)}%`), h('span', { class: 'muted' }, `درجات عزفتها: ${Object.keys(stats.hits).length}/${stepsToOffsets(MAQAMAT[id].asc).length}`));
      // أضئ موضع النوتة على الزند (أقرب موضع للسابق)
      const now = performance.now();
      const key = Math.round(abs / 50);
      if (fb && (key !== lastKey || now - lastFlash > 400)) {
        lastKey = key; lastFlash = now;
        const qq = Math.round(abs / 50 + tuning / 50);
        for (let s = 0; s < 6; s++) {
          const fq = qq - OPEN_STRINGS[s] * 2;
          if (fq >= 0 && fq <= 24) { fb.flash({ s, f: Math.floor(fq / 2), qt: fq % 2 }, 0.3); break; }
        }
      }
    }
    raf = requestAnimationFrame(loop);
  }
  btn.addEventListener('click', () => (stream ? stop() : start()));
}

// ===================== اللحن على الزند =====================
// يحوّل نوتات اللحن إلى مواضع على الجيتار ويعزفها ببطء مع الإضاءة
export function melodyOnFretboard(host, res, best) {
  host.innerHTML = '';
  const notes = (res.notes || []).filter(n => n.d >= 0.1);
  if (notes.length < 4) { host.append(card(null, h('p', {}, 'لم أجد نوتات كافية لتحويلها إلى تمرين.'))); return; }
  // مدى الجيتار: انقل اللحن بالأوكتافات ليقع بين مي2 ومي5 تقريباً
  const qs = notes.map(n => Math.round(n.c / 50));
  const sorted = [...qs].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  let shift = 0;
  while (med + shift > 2 * 67) shift -= 24;
  while (med + shift < 2 * 52) shift += 24;
  // اختيار المواضع بأقل حركة لليد
  let hand = null;
  const pos = qs.map(q0 => {
    const q = q0 + shift;
    const cands = [];
    for (let s = 0; s < 6; s++) {
      const fq = q - OPEN_STRINGS[s] * 2;
      if (fq < 0 || fq > 34) continue;
      const f = Math.floor(fq / 2), qt = fq % 2;
      if (f === 0 && qt) continue;
      cands.push({ s, f, qt, q });
    }
    if (!cands.length) return null;
    if (hand == null) hand = Math.min(...cands.map(c => c.f)) + 1;
    const pick = cands.reduce((a, c) => (Math.abs(c.f - hand) + (c.f === 0 ? 0.5 : 0) < Math.abs(a.f - hand) + (a.f === 0 ? 0.5 : 0) ? c : a));
    if (pick.f > 0) hand = hand * 0.6 + pick.f * 0.4;
    return pick;
  });
  const t0 = notes[0].t;
  const events = [];
  notes.forEach((n, i) => { if (pos[i]) events.push({ ...pos[i], t: n.t - t0, d: Math.min(n.d, 2) }); });
  const frets = events.map(e => e.f);
  const from = Math.max(0, Math.min(...frets) - 1), to = Math.max(from + 7, Math.max(...frets) + 1);
  const t = tq(best.q);
  const fbh = h('div');
  let speed = 0.75;
  const player = new Player(null, { metronome: false, countIn: false });
  active.push(() => player.stop());
  const playBtn = h('button', { class: 'btn primary' }, '▶ اعزف اللحن');
  const tab = h('div', { class: 'ltr', style: { fontFamily: 'monospace', fontSize: '.78rem', whiteSpace: 'pre', overflowX: 'auto', background: 'var(--bg2)', padding: '8px', borderRadius: '8px', marginTop: '8px' } });
  host.append(card('اللحن على الزند', h('p', { class: 'muted', style: { fontSize: '.85rem' } }, `حوّلت ${events.length} نوتة من الأغنية إلى مواضع على الجيتار. اعزفها ببطء مع الإضاءة، ثم ارفع السرعة.`),
    fbh, slider('السرعة', 0.3, 1.2, 0.05, speed, v => { speed = v; }, v => `${Math.round(v * 100)}%`),
    h('div', { class: 'row' }, playBtn, h('button', { class: 'btn', onclick: () => player.stop() }, '■')), tab));
  const fb = new Fretboard(fbh, { from, to });
  const uniq = new Map();
  events.forEach(e => { const k = `${e.s}:${e.f}:${e.qt}`; if (!uniq.has(k)) uniq.set(k, e); });
  fb.setDots([...uniq.values()].map(e => {
    const rel = (((e.q * 50 - best.q * 50) % 1200) + 1200) % 1200;
    const d = degIndex(best.id, Math.round(rel / 50) * 50);
    return { ...e, kind: d === 0 ? 'root' : (e.qt ? 'quarter' : 'note'), label: noteLabel(t, Math.round(rel / 50) * 50, d) };
  }));
  player.setBoard(fb);
  playBtn.addEventListener('click', () => player.play({ events, beats: events[events.length - 1].t + 2 }, 60 * speed, { metronome: false, countIn: false }));
  // تاب نصي مبسط
  const lines = ['e', 'B', 'G', 'D', 'A', 'E'].map(n => n + '|');
  events.slice(0, 48).forEach(e => {
    for (let s = 0; s < 6; s++) {
      const li = 5 - s;
      const txt = s === e.s ? `${e.f}${e.qt ? '¼' : ''}` : '';
      lines[li] += (txt || '-').padEnd(4, '-');
    }
  });
  tab.textContent = lines.join('\n') + (events.length > 48 ? '\n…' : '');
}

// ===================== المرافقة التلقائية =====================
export function accompaniment(host, best, bpm0) {
  host.innerHTML = '';
  let bpm = Math.max(50, Math.min(180, bpm0 || 90));
  let rid = 'maqsum';
  let running = false, timer = null, next = 0, idx = 0;
  const t = tq(best.q);
  const btn = h('button', { class: 'btn primary', style: { width: '100%' } }, '▶ رافقني: درون + إيقاع');
  host.append(card('مرافقة للارتجال', h('p', { class: 'muted', style: { fontSize: '.85rem' } }, `درون على القرار ${noteLabel(t, 0, 0)} وإيقاع عربي، لتعزف وترتجل فوقهما على ${MAQAMAT[best.id].name}.`),
    select(Object.entries(RHYTHMS).map(([k, v]) => ({ value: k, label: `${v.name} (${v.meter})` })), rid, v => { rid = v; }),
    slider('السرعة', 50, 180, 1, bpm, v => { bpm = v; }, v => `${v} BPM`), btn));
  function stop() { running = false; clearInterval(timer); droneStop(); btn.textContent = '▶ رافقني: درون + إيقاع'; }
  active.push(stop);
  btn.addEventListener('click', () => {
    if (running) { stop(); return; }
    const c = getCtx();
    running = true; btn.textContent = '■ أوقف المرافقة';
    droneStart(freqOfQ((36 + t.pc) * 2 + (t.quarter ? 1 : 0)));
    next = c.currentTime + 0.1; idx = 0;
    timer = setInterval(() => {
      const r = RHYTHMS[rid];
      const slot = (60 / bpm) * r.slot;
      while (next < c.currentTime + 0.15) { const ch = r.pattern[idx % r.pattern.length]; if (ch !== '.') drum(ch, next, 0.7); next += slot; idx++; }
    }, 25);
  });
}
