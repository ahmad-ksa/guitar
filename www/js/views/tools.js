// الأدوات: الدوزان، المترونوم والإيقاعات، تدريب الأذن، أدوات الأغاني
import { h, select, slider, toggle, card, toast } from '../ui.js';
import { getCtx, detectPitch, pluck, strum, click, drum, droneStop, stopAll } from '../audio.js';
import { OPEN_STRINGS, noteName, freqOfQ, RHYTHMS, MAQAMAT, SCALES, ROOTS, CHORD_TYPES, chordNotes, parseChord, detectKey, transposeChordText, diatonicChords, chordName, chordNameInKey, pcName, scaleOffsets, NOTE_LATIN } from '../theory.js';
import { windowPattern } from '../exercises.js';
import { Player } from '../player.js';

let stopper = null;
let pageGen = 0; // يتغير عند مغادرة الصفحة لإلغاء المؤقتات المعلقة
export function cleanup() { pageGen++; if (stopper) { stopper(); stopper = null; } stopAll(); droneStop(); }
export function pause() { if (stopper) stopper(); stopAll(); droneStop(); }

// ================= الدوزان =================
export function renderTuner(app) {
  cleanup();
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'الدوزان')));
  const noteEl = h('div', { class: 'tuner-note' }, '—');
  const hzEl = h('div', { class: 'tuner-hz' }, 'اضغط «ابدأ» واسمح بالمايكروفون');
  const needle = h('div', { class: 'needle' });
  const meter = h('div', { class: 'meter' }, h('div', { class: 'scale' }), needle,
    ...[-50, -25, 0, 25, 50].map(c => h('span', { class: 'tick', style: { left: `${50 + c}%` } }, c > 0 ? `+${c}` : c)));
  let quarterMode = false;
  const centsEl = h('div', { class: 'tuner-hz' });
  const btn = h('button', { class: 'btn primary', style: { width: '100%' } }, 'ابدأ الدوزان');
  const strs = h('div', { class: 'strings-row' }, OPEN_STRINGS.map((m, s) => h('button', { class: 'btn small', onclick: () => pluck(freqOfQ(m * 2), 0, { dur: 2.5 }) }, `${6 - s}: ${noteName(m * 2)}`)));
  app.append(card(null, noteEl, hzEl, meter, centsEl, h('div', { class: 'row', style: { justifyContent: 'center', marginBottom: '10px' } },
    toggle('وضع ربع التون (للمقامات)', false, v => { quarterMode = v; })), btn),
  card('نغمات مرجعية للأوتار المفتوحة', strs, h('p', { class: 'muted', style: { fontSize: '.82rem', margin: '8px 0 0' } }, 'في وضع ربع التون يقيس الدوزان أقرب ربع تون، فتستطيع التحقق من نوتات مثل مي½♭ وسي½♭ عند البِند الربعي (الهدف ±15 سنت).')));

  let stream = null, raf = 0, an = null, buf = null, smooth = null;
  async function start() {
    try {
      const c = getCtx();
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const src = c.createMediaStreamSource(stream);
      an = c.createAnalyser(); an.fftSize = 4096;
      src.connect(an);
      buf = new Float32Array(an.fftSize);
      btn.textContent = 'إيقاف';
      loop();
    } catch (e) {
      hzEl.textContent = 'لا يمكن الوصول للمايكروفون. اسمح للتطبيق باستخدامه من إعدادات الجهاز.';
    }
  }
  function stop() {
    cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; btn.textContent = 'ابدأ الدوزان';
  }
  function loop() {
    an.getFloatTimeDomainData(buf);
    const r = detectPitch(buf, getCtx().sampleRate);
    if (r && r.freq > 60 && r.freq < 1400) {
      smooth = smooth ? smooth * 0.75 + r.freq * 0.25 : r.freq;
      const qExact = 138 + 24 * Math.log2(smooth / 440); // بأرباع التون
      const step = quarterMode ? 1 : 2;
      const qNear = Math.round(qExact / step) * step;
      const cents = (qExact - qNear) * 50;
      noteEl.textContent = noteName(qNear);
      hzEl.textContent = `${smooth.toFixed(1)} Hz`;
      centsEl.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(0)} سنت`;
      const clamped = Math.max(-50, Math.min(50, cents));
      needle.style.left = `${50 + clamped}%`;
      meter.classList.toggle('ok', Math.abs(cents) < 5);
    }
    raf = requestAnimationFrame(loop);
  }
  btn.addEventListener('click', () => (stream ? stop() : start()));
  stopper = stop;
}

// ================= المترونوم والإيقاعات =================
export function renderRhythm(app) {
  cleanup();
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'المترونوم والإيقاعات العربية')));
  const st = { id: 'maqsum', bpm: 90, running: false, metro: false };
  const strip = h('div', { class: 'beats' });
  const desc = h('p', { class: 'muted' });
  const sel = select([{ value: 'metronome', label: 'مترونوم فقط' }, ...Object.entries(RHYTHMS).map(([k, v]) => ({ value: k, label: `${v.name} (${v.meter})` }))], st.id, v => { st.id = v; drawStrip(); });
  const btn = h('button', { class: 'btn primary', style: { width: '100%' } }, '▶ تشغيل');
  const tapTimes = [];
  const tapBtn = h('button', { class: 'btn' }, 'انقر للسرعة');
  const bpmSl = slider('السرعة', 30, 240, 1, st.bpm, v => { st.bpm = v; }, v => `${v} BPM`);
  tapBtn.addEventListener('click', () => {
    const t = performance.now();
    if (tapTimes.length && t - tapTimes[tapTimes.length - 1] > 2000) tapTimes.length = 0;
    tapTimes.push(t); if (tapTimes.length > 5) tapTimes.shift();
    if (tapTimes.length >= 2) {
      const avg = (tapTimes[tapTimes.length - 1] - tapTimes[0]) / (tapTimes.length - 1);
      st.bpm = Math.max(30, Math.min(240, Math.round(60000 / avg))); bpmSl.querySelector('input').value = st.bpm; bpmSl.querySelector('output').textContent = `${st.bpm} BPM`;
    }
  });
  app.append(card(null, sel, strip, desc, bpmSl, h('div', { class: 'row', style: { marginBottom: '10px' } }, tapBtn, toggle('أضف نقرة المترونوم', false, v => { st.metro = v; })), btn),
    card('كيف تقرأ الإيقاع؟', h('p', {}, 'دُم: ضربة غليظة في منتصف الطبلة. تَك: ضربة حادة على الحافة. النقطة: سكتة. اضغط على أي خانة لتغييرها وصنع إيقاعك الخاص.')));
  let pattern = '';
  function drawStrip() {
    strip.innerHTML = '';
    if (st.id === 'metronome') { pattern = 'DTTT'; desc.textContent = 'نقرة قوية في أول كل مازورة.'; }
    else { pattern = RHYTHMS[st.id].pattern; desc.textContent = RHYTHMS[st.id].desc; }
    [...pattern].forEach((c, i) => {
      const b = h('div', { class: `beat ${c === '.' ? '' : c}` }, c === 'D' ? 'دُم' : c === 'T' ? 'تَك' : c === 'k' ? 'ك' : '·');
      b.addEventListener('click', () => {
        const cycle = { D: 'T', T: 'k', k: '.', '.': 'D' };
        pattern = pattern.slice(0, i) + cycle[pattern[i]] + pattern.slice(i + 1);
        const nc = pattern[i]; b.className = `beat ${nc === '.' ? '' : nc}`; b.textContent = nc === 'D' ? 'دُم' : nc === 'T' ? 'تَك' : nc === 'k' ? 'ك' : '·';
      });
      strip.append(b);
    });
  }
  drawStrip();
  let timer = null, nextT = 0, idx = 0;
  function schedule() {
    const c = getCtx();
    const slotBeats = st.id === 'metronome' ? 1 : RHYTHMS[st.id].slot;
    const slot = (60 / st.bpm) * slotBeats;
    while (nextT < c.currentTime + 0.12) {
      const i = idx % pattern.length;
      const ch = pattern[i];
      if (st.id === 'metronome') click(nextT, i === 0);
      else {
        if (ch !== '.') drum(ch, nextT);
        if (st.metro && (idx * slotBeats) % 1 === 0) click(nextT, i === 0);
      }
      const d = (nextT - c.currentTime) * 1000;
      setTimeout(() => { strip.querySelectorAll('.beat').forEach((b, k) => b.classList.toggle('now', k === i)); }, Math.max(0, d));
      nextT += slot; idx++;
    }
  }
  function start() { const c = getCtx(); nextT = c.currentTime + 0.1; idx = 0; timer = setInterval(schedule, 25); btn.textContent = '■ إيقاف'; st.running = true; }
  function stop() { clearInterval(timer); timer = null; btn.textContent = '▶ تشغيل'; st.running = false; strip.querySelectorAll('.beat').forEach(b => b.classList.remove('now')); }
  btn.addEventListener('click', () => (st.running ? stop() : start()));
  stopper = stop;
}

// ================= تدريب الأذن =================
const INTERVALS = [
  [1, 'نصف تون'], [2, 'تون'], [3, 'ثالثة صغيرة'], [4, 'ثالثة كبيرة'], [5, 'رابعة تامة'], [6, 'تريتون'], [7, 'خامسة تامة'],
  [8, 'سادسة صغيرة'], [9, 'سادسة كبيرة'], [10, 'سابعة صغيرة'], [11, 'سابعة كبيرة'], [12, 'أوكتاف'],
];
const EAR_MAQAMAT = ['ajam', 'nahawand', 'kurd', 'hijaz', 'rast', 'bayati', 'saba', 'sikah'];
export function renderEar(app) {
  cleanup();
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'تدريب الأذن')));
  const st = { mode: 'interval', level: 1, right: 0, total: 0, answer: null, playFn: null };
  const modeSeg = h('div', { class: 'seg' });
  const body = card(null);
  const score = h('div', { class: 'score' });
  app.append(card(null, modeSeg), body);
  const modes = [['interval', 'الفواصل'], ['chord', 'نوع الكورد'], ['maqam', 'تمييز المقام'], ['note', 'إيجاد النوتة']];
  function drawModes() {
    modeSeg.innerHTML = '';
    modes.forEach(([k, l]) => modeSeg.append(h('button', { class: st.mode === k ? 'on' : '', onclick: () => { st.mode = k; st.right = 0; st.total = 0; drawModes(); newQ(); } }, l)));
  }
  const player = new Player(null, { metronome: false, countIn: false });
  const gen = pageGen;
  stopper = () => player.stop();

  function newQ() {
    body.innerHTML = '';
    const fb = h('div', { class: 'ear-big' });
    const grid = h('div', { class: 'answer-grid' });
    let options = [];
    const baseMidi = 45 + Math.floor(Math.random() * 12);
    if (st.mode === 'interval') {
      const pool = st.level === 1 ? INTERVALS.filter(i => [2, 3, 4, 5, 7, 12].includes(i[0])) : INTERVALS;
      const [iv, name] = pool[Math.floor(Math.random() * pool.length)];
      st.answer = name; options = pool.map(p => p[1]);
      st.playFn = () => { const c = getCtx(); pluck(freqOfQ(baseMidi * 2), c.currentTime + 0.05); pluck(freqOfQ((baseMidi + iv) * 2), c.currentTime + 0.9); };
      fb.textContent = 'ما المسافة بين النوتتين؟';
    } else if (st.mode === 'chord') {
      const pool = st.level === 1 ? ['maj', 'min'] : ['maj', 'min', 'dim', 'aug', 'dom7', 'maj7', 'min7', 'sus4'];
      const t = pool[Math.floor(Math.random() * pool.length)];
      st.answer = CHORD_TYPES[t].name; options = pool.map(p => CHORD_TYPES[p].name);
      st.playFn = () => { const iv = CHORD_TYPES[t].iv; strum(iv.map(i => freqOfQ((baseMidi + i) * 2)), 0, { spread: 0.05 }); };
      fb.textContent = 'ما نوع الكورد؟';
    } else if (st.mode === 'maqam') {
      const pool = st.level === 1 ? ['ajam', 'nahawand', 'hijaz', 'bayati'] : EAR_MAQAMAT;
      const m = pool[Math.floor(Math.random() * pool.length)];
      st.answer = MAQAMAT[m].name; options = pool.map(p => MAQAMAT[p].name);
      st.playFn = () => {
        const mm = MAQAMAT[m];
        const off = scaleOffsets(m);
        const base = (50 + ((mm.root - 2 + 12) % 12)) * 2 + (mm.rootQuarter ? 1 : 0);
        const seq = [0, 1, 2, 3, 4, 3, 2, 1, 0].map(d => base + off[d]);
        const c = getCtx();
        seq.forEach((q, i) => pluck(freqOfQ(q), c.currentTime + 0.05 + i * 0.42, { dur: 0.9 }));
      };
      fb.textContent = 'أي مقام تسمع؟ (أول خمس درجات من المقام صعوداً ونزولاً)';
    } else {
      const pcs = [0, 2, 4, 5, 7, 9, 11];
      const pc = pcs[Math.floor(Math.random() * pcs.length)];
      st.answer = pcName(pc); options = pcs.map(p => pcName(p));
      st.playFn = () => { const c = getCtx(); pluck(freqOfQ(96), c.currentTime + 0.05, { dur: 1 }); pluck(freqOfQ((48 + pc) * 2), c.currentTime + 1.1, { dur: 1.5 }); };
      fb.textContent = 'النوتة الأولى «دو» للمرجع. ما اسم النوتة الثانية؟';
    }
    const play = h('button', { class: 'btn primary', style: { width: '100%', marginBottom: '10px' }, onclick: () => st.playFn() }, '▶ استمع (أو أعد)');
    const result = h('div', { class: 'ear-big' });
    let answered = false;
    [...new Set(options)].forEach(o => {
      const b = h('button', { class: 'btn' }, o);
      b.addEventListener('click', () => {
        if (answered) return;
        answered = true; st.total++;
        if (o === st.answer) { st.right++; b.style.borderColor = 'var(--good)'; result.textContent = 'صحيح ✓'; }
        else { b.style.borderColor = 'var(--bad)'; result.textContent = `الإجابة: ${st.answer}`; }
        score.textContent = `${st.right} / ${st.total}`;
        setTimeout(() => { if (gen === pageGen) newQ(); }, 1300);
      });
      grid.append(b);
    });
    const lvl = h('div', { class: 'seg' }, [[1, 'سهل'], [2, 'متقدم']].map(([k, l]) => h('button', { class: st.level === k ? 'on' : '', onclick: () => { st.level = k; newQ(); } }, l)));
    body.append(h('div', { class: 'row between' }, lvl, score), fb, play, grid, result);
    score.textContent = `${st.right} / ${st.total}`;
    setTimeout(() => { if (gen === pageGen) st.playFn(); }, 300);
  }
  drawModes();
  newQ();
}

// ================= أدوات الأغاني =================
export function renderSongs(app) {
  cleanup();
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'أدوات الأغاني')));

  // كاشف المفتاح
  const keyIn = h('input', { type: 'text', placeholder: 'مثال: Am F C G', style: { width: '100%', direction: 'ltr' } });
  const keyOut = h('div');
  const keyBtn = h('button', { class: 'btn primary' }, 'اكشف المفتاح');
  keyBtn.addEventListener('click', () => {
    const chords = keyIn.value.split(/[\s,|\-]+/).filter(Boolean).map(parseChord).filter(Boolean);
    keyOut.innerHTML = '';
    if (!chords.length) { keyOut.textContent = 'اكتب الكوردات بالحروف اللاتينية.'; return; }
    const res = detectKey(chords).slice(0, 3);
    res.forEach((r, i) => {
      const dia = diatonicChords(r.pc, r.mode);
      const romans = chords.map(c => { const d = dia.findIndex(x => x.pc === c.pc); return d >= 0 ? dia[d].roman : '?'; });
      keyOut.append(h('div', { class: i === 0 ? 'card hl' : 'card' },
        h('b', {}, `${pcName(r.pc)} ${r.mode === 'major' ? 'الكبير' : 'الصغير'}`), h('span', { class: 'muted' }, i === 0 ? '  (الأرجح)' : ''),
        h('div', { class: 'ltr', style: { marginTop: '4px' } }, romans.join(' – ')),
        h('div', { class: 'muted ltr', style: { fontSize: '.82rem' } }, 'Diatonic: ' + dia.map(d => chordNameInKey(d.pc, d.type, r.pc, r.mode)).join(' '))));
    });
  });
  app.append(card('كاشف المفتاح من الكوردات', h('p', { class: 'muted', style: { fontSize: '.85rem' } }, 'اكتب كوردات الأغنية، وسأقترح المفتاح والأرقام الرومانية.'), keyIn, h('div', { class: 'row', style: { marginTop: '8px' } }, keyBtn), keyOut));

  // محوّل المفتاح
  const trIn = h('textarea', { placeholder: 'الصق الكوردات هنا، مثال:\nG  D  Em  C\nAm  F  C  G' });
  const trOut = h('textarea', { readonly: true });
  let semis = 0;
  const lab = h('b', {}, '0');
  const flats = { v: true };
  function upd() { trOut.value = transposeChordText(trIn.value, semis, flats.v); lab.textContent = semis > 0 ? `+${semis}` : semis; }
  trIn.addEventListener('input', upd);
  app.append(card('محوّل المفتاح', trIn,
    h('div', { class: 'row', style: { margin: '8px 0' } }, h('button', { class: 'btn', onclick: () => { semis--; upd(); } }, '− نصف تون'), lab, h('button', { class: 'btn', onclick: () => { semis++; upd(); } }, '+ نصف تون'),
      toggle('بيمول بدل دييز', true, v => { flats.v = v; upd(); })), trOut));

  // حاسبة الكابو
  const capoOut = h('div');
  const st = { target: 9, shapes: 'all' };
  function capo() {
    capoOut.innerHTML = '';
    const shapes = [['C', 0], ['A', 9], ['G', 7], ['E', 4], ['D', 2], ['Am', 9, 'm'], ['Em', 4, 'm'], ['Dm', 2, 'm']];
    const rows = shapes.map(([n, pc, m]) => [n, ((st.target - pc) % 12 + 12) % 12, m]).filter(r => r[1] <= 9).sort((a, b) => a[1] - b[1]);
    capoOut.append(h('table', { class: 't' }, h('tr', {}, h('th', {}, 'أشكال'), h('th', {}, 'الكابو على الفرت'), h('th', {}, 'النتيجة')),
      rows.map(([n, f, m]) => h('tr', {}, h('td', { class: 'ltr' }, n), h('td', {}, f === 0 ? 'بدون كابو' : f), h('td', { class: 'ltr' }, NOTE_LATIN[st.target] + (m ? 'm' : ''))))));
  }
  app.append(card('حاسبة الكابو', h('div', { class: 'row' }, h('span', {}, 'المفتاح المطلوب:'), select(ROOTS.map(r => ({ value: r.pc, label: `${r.ar} (\u2066${r.latin}\u2069)` })), st.target, v => { st.target = +v; capo(); })), capoOut));
  capo();

  // كوردات أي مفتاح
  const dOut = h('div');
  const ks = { pc: 7, mode: 'major', sev: false };
  function dia() {
    dOut.innerHTML = '';
    const ch = diatonicChords(ks.pc, ks.mode, ks.sev && ks.mode === 'major');
    dOut.append(h('table', { class: 't' }, h('tr', {}, ch.map(c => h('th', { class: 'ltr' }, c.roman))), h('tr', {}, ch.map(c => h('td', { class: 'ltr' }, chordNameInKey(c.pc, c.type, ks.pc, ks.mode))))));
  }
  app.append(card('كوردات المفتاح (أرقام الدرجات)', h('div', { class: 'row' },
    select(ROOTS.map(r => ({ value: r.pc, label: r.ar })), ks.pc, v => { ks.pc = +v; dia(); }),
    select([{ value: 'major', label: 'كبير' }, { value: 'minor', label: 'صغير' }], ks.mode, v => { ks.mode = v; dia(); }),
    toggle('كوردات السابعة', false, v => { ks.sev = v; dia(); })), dOut));
  dia();

  app.append(card('منهجية اللجنة: 8 خطوات لأي أغنية',
    h('ol', {}, ['استمع 3 مرات دون جيتار', 'أوجد القرار (غنِّ آخر نوتة)', 'حدد اللون: الثانية والثالثة فوق القرار', 'اكتب كوردات السلم السبعة (الجدول أعلاه)', 'استخرج التقدم من الباص', 'التقط اللحن جملة جملة', 'انقل لمفتاح الصوت (المحوّل أعلاه)', 'أضف مقدمة أو لازمة أو تقسيماً'].map(x => h('li', {}, x)))));
}
