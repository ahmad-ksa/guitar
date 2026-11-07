// أدوات ما بعد التحليل: «اعزف معي»، اللحن على الزند، المرافقة التلقائية
import { h, card, slider, toggle, select, toast } from '../ui.js';
import { getCtx, detectPitch, drum, droneStart, droneStop, stopAll } from '../audio.js';
import { MAQAMAT, RHYTHMS, OPEN_STRINGS, spelledName, stepsToOffsets, freqOfQ, ROOTS, pcName } from '../theory.js';
import { Fretboard } from '../fretboard.js';
import { allPositions } from '../exercises.js';
import { Player } from '../player.js';
import { activity } from '../screen.js';
import { LivePitch, makeResampler, loadSwiftF0 } from '../swiftf0.js';

// مصدر طبقة المايكروفون: SwiftF0 (أدق مع الأوتار والتوافقيات) مع YIN احتياطياً
export function micPitchSource(c, stream) {
  const src = c.createMediaStreamSource(stream);
  const an = c.createAnalyser(); an.fftSize = 4096; src.connect(an);
  const buf = new Float32Array(an.fftSize);
  const live = new LivePitch();
  const rs = makeResampler(c.sampleRate);
  const proc = c.createScriptProcessor(1024, 1, 1);
  const mute = c.createGain(); mute.gain.value = 0;
  src.connect(proc); proc.connect(mute); mute.connect(c.destination);
  proc.onaudioprocess = e => live.push(rs(e.inputBuffer.getChannelData(0)));
  let sfOk = null, latest = null, stamp = 0;
  loadSwiftF0().then(sess => { sfOk = !!sess; });
  const timer = setInterval(async () => {
    if (!sfOk) return;
    const r = await live.estimate();
    if (r) { latest = r; stamp = performance.now(); }
  }, 40);
  return {
    engine: () => (sfOk ? 'SwiftF0' : 'YIN'),
    read() {
      if (sfOk && latest && performance.now() - stamp < 250) {
        if (!latest.freq || latest.conf < 0.5) return null;
        return { freq: latest.freq, clarity: 0.86 + 0.14 * latest.conf };
      }
      an.getFloatTimeDomainData(buf);
      return detectPitch(buf, c.sampleRate);
    },
    stop() { clearInterval(timer); try { proc.disconnect(); src.disconnect(); } catch (e) {} },
  };
}

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

  let stream = null, raf = 0, mic = null, smooth = null, lastFlash = 0, lastKey = '';
  let pending = false, dead = false;
  async function start() {
    if (pending) return;
    pending = true; btn.disabled = true;
    try {
      const c = getCtx();
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      pending = false; btn.disabled = false;
      if (dead || !host.isConnected) { st.getTracks().forEach(t => t.stop()); return; }
      stream = st;
      mic = micPitchSource(c, stream);
      btn.textContent = '■ أوقف';
      loop();
    } catch (e) { pending = false; btn.disabled = false; info.textContent = 'لا يمكن الوصول للمايكروفون. اسمح للتطبيق باستخدامه من إعدادات الجهاز.'; }
  }
  function stop() {
    cancelAnimationFrame(raf);
    if (mic) { mic.stop(); mic = null; }
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; btn.textContent = '🎸 ابدأ: اعزف وأنا أسمعك';
  }
  active.push(() => { dead = true; stop(); });
  function loop() {
    const r = mic.read();
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
      if (stats.total % 120 === 0) activity();
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
// يحوّل نوتات اللحن إلى مواضع على الجيتار بأقل حركة لليد (t نسبي لأول نوتة، t0 = زمن أول نوتة في المقطع)
export function mapMelody(res) {
  const notes = (res.notes || []).filter(n => n.d >= 0.1);
  if (notes.length < 4) return null;
  const qs = notes.map(n => Math.round(n.c / 50));
  const sorted = [...qs].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  let shift = 0;
  while (med + shift > 2 * 67) shift -= 24;
  while (med + shift < 2 * 52) shift += 24;
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
  notes.forEach((n, i) => { if (pos[i]) events.push({ ...pos[i], t: n.t - t0, d: Math.min(n.d, 2), src: n.t }); });
  return { events, t0 };
}

function dotLabel(e, best) {
  const t = tq(best.q);
  const rel = Math.round((((e.q * 50 - best.q * 50) % 1200) + 1200) % 1200 / 50) * 50;
  const d = degIndex(best.id, rel);
  return { kind: d === 0 ? 'root' : (e.qt ? 'quarter' : 'note'), label: noteLabel(t, rel, d) };
}

export function melodyOnFretboard(host, res, best) {
  host.innerHTML = '';
  const mm = mapMelody(res);
  if (!mm) { host.append(card(null, h('p', {}, 'لم أجد نوتات كافية لتحويلها إلى تمرين.'))); return; }
  const events = mm.events;
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
      if (next < c.currentTime) next = c.currentTime + 0.05;
      while (next < c.currentTime + 0.15) { const ch = r.pattern[idx % r.pattern.length]; if (ch !== '.') drum(ch, next, 0.7); next += slot; idx++; }
    }, 25);
  });
}

// ===================== مدرّب لحن الأغنية =====================
// يقسم اللحن إلى جمل: اسمع الأصل ← شاهد على الزند ← اعزف أنت، والتطبيق ينتظرك على كل نوتة
export function songTrainer(host, res, best, audioUrl = null) {
  host.innerHTML = '';
  const mm = mapMelody(res);
  if (!mm) { host.append(card(null, h('p', {}, 'لم أجد لحناً واضحاً كافياً لبناء تدريب. جرّب مقطعاً فيه غناء أو عزف منفرد واضح.'))); return; }
  const ev = mm.events;
  // تقسيم إلى جمل: عند سكتة أطول من 0.35 ث أو بعد 10 نوتات
  const phrases = [];
  let cur = [];
  ev.forEach((e, i) => {
    cur.push(e);
    const next = ev[i + 1];
    const gap = next ? next.t - (e.t + e.d) : 1;
    if (gap > 0.35 || cur.length >= 10 || !next) { phrases.push(cur); cur = []; }
  });
  // دمج الجمل القصيرة جداً مع التي قبلها
  for (let i = 1; i < phrases.length; i++) if (phrases[i].length < 3 && phrases[i - 1].length + phrases[i].length <= 12) { phrases[i - 1].push(...phrases[i]); phrases.splice(i, 1); i--; }
  const offset = res.startOffset || 0;
  let pi = 0, speed = 0.7, labelMode = 'order';
  const scores = phrases.map(() => null);
  const player = new Player(null, { metronome: false, countIn: false });
  let audio = null;
  const stopAudio = () => { if (audio) { audio.pause(); audio = null; } };

  const title = h('div', { class: 'row between' });
  const dots = h('div', { class: 'stepdots', style: { margin: '6px 0' } });
  const fbh = h('div');
  const msg = h('div', { class: 'subtitle' });
  const seq = h('div', { class: 'row', style: { gap: '4px', direction: 'ltr', justifyContent: 'center', margin: '6px 0' } });
  const listenOrig = h('button', { class: 'btn' }, '🎧 اسمع من الأغنية');
  const listenGtr = h('button', { class: 'btn' }, '🎸 بصوت الجيتار');
  const yourTurn = h('button', { class: 'btn primary' }, '🎤 دورك: اعزفها');
  const prevB = h('button', { class: 'btn small' }, '→ السابقة');
  const nextB = h('button', { class: 'btn small' }, 'التالية ←');
  const labSeg = h('div', { class: 'seg' }, [['order', 'الترتيب'], ['note', 'النوتة']].map(([k, l]) =>
    h('button', { class: k === labelMode ? 'on' : '', onclick: e => { labelMode = k; labSeg.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.target.classList.add('on'); draw(); } }, l)));
  host.append(card('🎯 تدريب على لحن الأغنية',
    h('p', { class: 'muted', style: { fontSize: '.85rem' } }, `قسّمت اللحن إلى ${phrases.length === 1 ? 'جملة واحدة' : phrases.length === 2 ? 'جملتين' : phrases.length <= 10 ? phrases.length + ' جمل' : phrases.length + ' جملة'}. لكل جملة: اسمعها، شاهدها على الزند، ثم اعزفها وأنا أنتظرك على كل نوتة.`),
    title, dots, msg, h('div', { class: 'row' }, labSeg), fbh, seq,
    slider('سرعة العرض', 0.3, 1.2, 0.05, speed, v => { speed = v; }, v => `${Math.round(v * 100)}%`),
    h('div', { class: 'row' }, listenOrig, listenGtr), h('div', { class: 'row', style: { marginTop: '8px' } }, yourTurn),
    h('div', { class: 'row between', style: { marginTop: '10px' } }, prevB, nextB)));
  if (!audioUrl) { listenOrig.disabled = true; listenOrig.title = 'متاح عند رفع ملف'; }

  let fb = null;
  function draw() {
    stopListen(); player.stop(); stopAudio();
    const ph = phrases[pi];
    title.innerHTML = '';
    title.append(h('b', {}, `الجملة ${pi + 1} من ${phrases.length}`), h('span', { class: 'muted' }, `${ph.length} نوتات`));
    dots.innerHTML = '';
    phrases.forEach((_, i) => dots.append(h('i', { class: i === pi ? 'on' : (scores[i] != null ? 'seen' : '') })));
    msg.textContent = scores[pi] != null ? `نتيجتك السابقة في هذه الجملة: ${scores[pi]}%` : 'ابدأ بالاستماع، ثم اضغط «دورك».';
    const frets = ph.map(e => e.f);
    const from = Math.max(0, Math.min(...frets) - 1), to = Math.max(from + 6, Math.max(...frets) + 1);
    fbh.innerHTML = '';
    fb = new Fretboard(fbh, { from, to });
    const seen = new Map();
    ph.forEach((e, i) => { const k = `${e.s}:${e.f}:${e.qt}`; if (!seen.has(k)) seen.set(k, { e, order: [] }); seen.get(k).order.push(i + 1); });
    fb.setDots([...seen.values()].map(({ e, order }) => ({ ...e, ...dotLabel(e, best), ...(labelMode === 'order' ? { label: order.slice(0, 2).join('،') } : {}) })));
    player.setBoard(fb);
    seq.innerHTML = '';
    ph.forEach((e, i) => seq.append(h('span', { class: 'pill', 'data-i': i }, dotLabel(e, best).label)));
    prevB.disabled = pi === 0; nextB.disabled = pi === phrases.length - 1;
  }
  listenGtr.addEventListener('click', () => {
    stopListen(); stopAudio();
    const ph = phrases[pi]; const t0 = ph[0].t;
    player.play({ events: ph.map(e => ({ ...e, t: e.t - t0 })), beats: ph[ph.length - 1].t - t0 + ph[ph.length - 1].d + 0.5 }, 60 * speed, { metronome: false, countIn: false });
  });
  listenOrig.addEventListener('click', () => {
    if (!audioUrl) return;
    stopListen(); player.stop(); stopAudio();
    const ph = phrases[pi];
    const a0 = offset + ph[0].src - 0.15, a1 = offset + ph[ph.length - 1].src + ph[ph.length - 1].d + 0.3;
    const a = new Audio(audioUrl); audio = a;
    a.currentTime = Math.max(0, a0);
    try { a.preservesPitch = true; } catch (e) {}
    a.playbackRate = Math.max(0.5, speed);
    a.play();
    const tick = () => { if (audio !== a) return; if (a.currentTime >= a1) { stopAudio(); } else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  prevB.addEventListener('click', () => { if (pi > 0) { pi--; draw(); } });
  nextB.addEventListener('click', () => { if (pi < phrases.length - 1) { pi++; draw(); } });

  // ===== وضع «دورك»: ينتظر كل نوتة =====
  let stream = null, raf = 0, tmic = null;
  function stopListen() {
    cancelAnimationFrame(raf);
    if (tmic) { tmic.stop(); tmic = null; }
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; yourTurn.textContent = '🎤 دورك: اعزفها';
    fbh.querySelectorAll('.fb-dot.target').forEach(d => d.classList.remove('target'));
  }
  active.push(() => { stopListen(); player.stop(); stopAudio(); });
  yourTurn.addEventListener('click', async () => {
    if (stream) { stopListen(); return; }
    if (yourTurn.disabled) return;
    player.stop(); stopAudio();
    yourTurn.disabled = true;
    try {
      const c = getCtx();
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      yourTurn.disabled = false;
      if (!host.isConnected) { st.getTracks().forEach(t => t.stop()); return; }
      stream = st;
      tmic = micPitchSource(c, stream);
    } catch (e) { yourTurn.disabled = false; msg.textContent = 'لا يمكن الوصول للمايكروفون. اسمح للتطبيق باستخدامه من إعدادات الجهاز.'; return; }
    yourTurn.textContent = '■ أوقف';
    const ph = phrases[pi];
    let k = 0, misses = 0, firstTry = 0, missedThis = false, stableQ = null, stableSince = 0, lastJudged = null;
    const pills = seq.querySelectorAll('.pill');
    const markTarget = () => {
      fbh.querySelectorAll('.fb-dot.target').forEach(d => d.classList.remove('target'));
      const e = ph[k]; if (!e) return;
      const g = fb.dots.get(`${e.s}:${e.f}:${e.qt ? 1 : 0}`); if (g) g.classList.add('target');
      pills.forEach((p, i) => { p.style.outline = i === k ? '2px solid var(--accent)' : ''; });
      msg.textContent = `اعزف النوتة ${k + 1}: ${dotLabel(e, best).label} — الوتر ${6 - e.s}، الفرت ${e.f}${e.qt ? ' مع بِند ربع تون' : ''}`;
    };
    markTarget();
    const loop = () => {
      const r = tmic.read();
      const now = performance.now();
      if (r && r.clarity > 0.85 && r.freq > 70 && r.freq < 1400) {
        const cents = 1200 * Math.log2(r.freq / 440) + 6900;
        const qn = Math.round(cents / 50);
        if (stableQ === null || Math.abs(qn - stableQ) > 0) { stableQ = qn; stableSince = now; }
        if (now - stableSince > 110 && lastJudged !== stableQ) {
          lastJudged = stableQ;
          const e = ph[k];
          const diff = (((cents - e.q * 50) % 1200) + 1200) % 1200; // يقبل الأوكتاف الآخر
          const d = diff > 600 ? diff - 1200 : diff;
          if (Math.abs(d) <= 40) {
            pills[k].classList.add('ok');
            fb.flash(e, 0.3);
            if (!missedThis) firstTry++;
            k++; missedThis = false;
            activity();
            if (k >= ph.length) {
              const score = Math.round(100 * firstTry / ph.length);
              scores[pi] = Math.max(score, scores[pi] || 0);
              stopListen();
              msg.textContent = score >= 90 ? `ممتاز! 🎉 عزفت الجملة بدقة ${score}%` : score >= 60 ? `جيد! دقتك ${score}%. أعدها مرة لتثبيتها.` : `دقتك ${score}%. اسمعها مرة أخرى ببطء ثم أعد المحاولة.`;
              dots.children[pi].className = 'seen';
              if (pi < phrases.length - 1) msg.append(h('div', { style: { marginTop: '6px' } }, h('button', { class: 'btn small primary', onclick: () => { pi++; draw(); } }, 'الجملة التالية ←')));
              else msg.append(h('div', { style: { marginTop: '6px' } }, `أنهيت كل الجمل! متوسط دقتك ${Math.round(scores.reduce((a, b) => a + (b || 0), 0) / phrases.length)}%.`));
              return;
            }
            markTarget();
          } else {
            misses++; missedThis = true;
            pills[k].style.borderColor = 'var(--bad)';
            msg.textContent = `هذه ليست النوتة المطلوبة. المطلوب: ${dotLabel(e, best).label} — الوتر ${6 - e.s}، الفرت ${e.f}${e.qt ? ' مع بِند ربع تون' : ''}`;
          }
        }
      } else if (!r) { stableQ = null; lastJudged = null; }
      raf = requestAnimationFrame(loop);
    };
    loop();
  });
  draw();
}
