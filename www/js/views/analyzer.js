// محلل المقام: ارفع أغنية أو سجّل مقطعاً، فيحدد التطبيق المقام والقرار مع الدليل
import { h, card, slider, toast, icon, askText, toggle } from '../ui.js';
import { canonicalArtist, artistsList } from './songbook.js';
import { getCtx, stopAll } from '../audio.js';
import { MAQAMAT, AJNAS, MAQAM_CHARACTER, spelledName, stepsToOffsets } from '../theory.js';
import { SR, tonicFromQ, trackPitch, analyzeFrames, FRAME, HOP } from '../maqam-analyzer.js';
import { ALL } from '../lessons/index.js';
import * as store from '../store.js';
import { activity } from '../screen.js';
import { playAlong, melodyOnFretboard, accompaniment, stopPracticeTools, songTrainer } from './practice-tools.js';

let state = { worker: null, stream: null, proc: null, audio: null, url: null, live: null };
let gen = 0; // يتغير عند مغادرة الصفحة لإلغاء أي عمل معلّق
export function cleanup() {
  gen++;
  stopLive();
  stopPracticeTools();
  if (state.worker) { state.worker.terminate(); state.worker = null; }
  stopRec();
  if (state.audio) { state.audio.pause(); state.audio = null; }
  if (state.url) { URL.revokeObjectURL(state.url); state.url = null; }
  state.vocals = null;
}
// تشغيل عامل (Worker) وانتظار نتيجته، مع تقدّم
function inWorker(path, msg, transfer, onProgress) {
  return new Promise((resolve, reject) => {
    if (state.worker) state.worker.terminate();
    const w = new Worker(new URL(path, import.meta.url), { type: 'module' });
    state.worker = w;
    w.onmessage = e => {
      if (e.data.progress != null) { onProgress(e.data.progress); return; }
      w.terminate(); if (state.worker === w) state.worker = null;
      if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data);
    };
    w.onerror = e => { w.terminate(); if (state.worker === w) state.worker = null; reject(e); };
    w.postMessage(msg, transfer);
  });
}
function stopRec() {
  if (state.proc) { try { state.proc.disconnect(); } catch (e) {} state.proc = null; }
  if (state.stream) { state.stream.getTracks().forEach(t => t.stop()); state.stream = null; }
}

const DEG_NAMES = ['القرار', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة'];
const ORD = ['القرار', 'ثانية', 'ثالثة', 'رابعة', 'خامسة', 'سادسة', 'سابعة'];
const REF = [0, 200, 400, 500, 700, 900, 1100];
function intervalWord(c, deg) {
  if (deg === 0) return 'القرار';
  const d = c - REF[deg];
  const perfect = deg === 3 || deg === 4;
  const q = perfect
    ? { '-100': 'ناقصة', '-50': 'ناقصة ربعاً', 0: 'تامة', 50: 'زائدة ربعاً', 100: 'زائدة' }[d]
    : { '-200': 'ناقصة', '-100': 'صغيرة', '-50': 'نصف بيمول', 0: 'كبيرة', 100: 'زائدة' }[d];
  return `${ORD[deg]} ${q || ''}`.trim();
}
export function tonicName(q) { const t = tonicFromQ(q); return spelledName((48 + t.pc) * 2 + (t.quarter ? 1 : 0), t.pc, 0); }
function lessonFor(id) { return ALL.find(l => l.title === MAQAMAT[id].name); }

export function renderAnalyzer(app, openSongId = null) {
  cleanup();
  const myGen = gen;
  const alive = () => myGen === gen;
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'محلل المقام')));
  app.append(h('p', { class: 'muted', style: { marginTop: '-6px' } }, 'ارفع أغنية أو جزءاً منها، أو سجّل من المايكروفون، وسيحدد التطبيق المقام والقرار ويشرح لك لماذا. التحليل يتم على جهازك دون إنترنت.'));

  const fileIn = h('input', { type: 'file', accept: 'audio/*,video/mp4,.mp3,.m4a,.wav,.ogg,.aac,.flac', style: { display: 'none' } });
  const recBtn = h('button', { class: 'btn' }, '🎙️ سجّل مقطعاً');
  const liveBtn = h('button', { class: 'btn' }, '📡 استمع مباشرة');
  const livePanel = h('div');
  const playHost = h('div');
  const notebook = h('div');
  const soloBtn = h('button', { class: 'btn small' }, '🎸 اعزف معي على مقام أختاره');
  soloBtn.addEventListener('click', () => { stopPracticeTools(); playAlong(playHost, { id: 'bayati', q: 4, tuning: 0 }); playHost.scrollIntoView({ behavior: 'smooth' }); });
  const pickBtn = h('button', { class: 'btn primary', onclick: () => fileIn.click() }, '📁 اختر ملف أغنية');
  const status = h('div', { class: 'muted', style: { fontSize: '.88rem', marginTop: '8px' } });
  const editor = h('div');
  const results = h('div');
  // التحليل العميق: يتطلب رفع الأغنية كاملة
  const deepIn = h('input', { type: 'file', accept: 'audio/*,video/mp4,.mp3,.m4a,.wav,.ogg,.aac,.flac', style: { display: 'none' } });
  const deepCard = h('section', { class: 'card', style: { borderColor: 'var(--chord)' } },
    h('h3', { style: { color: 'var(--chord)' } }, '🧠 تحليل عميق للأغنية كاملة'),
    h('p', { class: 'muted', style: { fontSize: '.86rem' } }, 'ارفع الأغنية كاملة، وسأقسمها إلى أقسام: متى بدأ كل مقام، ومتى تحولت الأغنية لمقام آخر، ومتى رجعت. وإذا كانت على مقام واحد سأخبرك.'),
    h('button', { class: 'btn', style: { width: '100%', borderColor: 'var(--chord)' }, onclick: () => deepIn.click() }, '📁 ارفع الأغنية للتحليل العميق'), deepIn);
  const isoT = h('div', { style: { marginTop: '10px' } },
    toggle('🎤 اعزل صوت المغني عن الموسيقى قبل التحليل', store.settings().isolateVocals !== false, v => store.setSetting('isolateVocals', v)),
    h('div', { class: 'muted', style: { fontSize: '.78rem', marginTop: '2px' } }, 'أدق بكثير مع الأغاني المغنّاة، لكنه أبطأ (تقريباً ثانية إلى 3 ثوانٍ لكل 12 ثانية من الأغنية).'));
  app.append(card(null, h('div', { class: 'row' }, pickBtn, recBtn, liveBtn), h('div', { class: 'row', style: { marginTop: '8px' } }, soloBtn), isoT, fileIn, status), deepCard, playHost, livePanel, editor, results, notebook,
    card('نصائح لأدق نتيجة', h('ul', { style: { margin: 0, paddingInlineStart: '18px' } },
      h('li', {}, 'اختر مقطعاً فيه غناء أو عزف منفرد واضح، دقيقة إلى 3 دقائق.'),
      h('li', {}, 'لأغنية على يوتيوب أو التلفزيون: شغّلها من جهاز آخر وقرّب الجوال، واستخدم «استمع مباشرة».'),
      h('li', {}, 'المذهب أو بداية الأغنية أفضل غالباً، لأن الأغنية قد تتحول لمقام آخر لاحقاً.'),
      h('li', {}, 'المقامات الشقيقة (البياتي والحسيني مثلاً) تختلف في الجنس الأعلى، فتحتاج مقطعاً يصعد إليه.'),
      h('li', {}, 'النتيجة تقدير آلي: استخدم الدليل بالسنت وأذنك لتأكيدها.'))));

  let decoded = null; // AudioBuffer
  let currentName = '';
  drawNotebook();
  function drawNotebook() {
    notebook.innerHTML = '';
    const list = store.songs();
    if (!list.length) return;
    notebook.append(h('a', { class: 'card', href: '#/songbook', style: { display: 'flex', gap: '12px', alignItems: 'center', color: 'inherit' } },
      h('span', { style: { fontSize: '1.8rem' } }, '📒'),
      h('div', { style: { flex: 1 } }, h('b', {}, `مرجع الأغاني (${list.length})`),
        h('div', { class: 'muted', style: { fontSize: '.82rem' } }, list.slice(0, 3).map(x => `${x.name || 'أغنية'}${x.artist ? ' — ' + x.artist : ''}`).join(' · ')))));
  }
  liveBtn.addEventListener('click', () => {
    if (state.live) { stopLive(); liveBtn.textContent = '📡 استمع مباشرة'; return; }
    editor.innerHTML = ''; results.innerHTML = '';
    liveBtn.disabled = true;
    startLive(livePanel, status, alive).then(ok => { liveBtn.disabled = false; if (ok) { liveBtn.textContent = '■ أوقف الاستماع'; livePanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  });
  deepIn.addEventListener('change', async () => {
    const f = deepIn.files[0];
    deepIn.value = '';
    if (!f) return;
    if (!checkFile(f)) return;
    discardRec();
    if (state.live) { stopLive(); liveBtn.textContent = '📡 استمع مباشرة'; }
    livePanel.innerHTML = ''; editor.innerHTML = ''; results.innerHTML = '';
    currentName = f.name.replace(/\.[^.]+$/, '');
    status.textContent = `جارٍ قراءة ${f.name}…`;
    try {
      const buf = await f.arrayBuffer();
      decoded = await getCtx().decodeAudioData(buf);
      if (!alive()) return;
      if (state.url) URL.revokeObjectURL(state.url);
      state.url = URL.createObjectURL(f);
      const len = Math.min(decoded.duration, 480);
      status.textContent = `${f.name} · ${fmt(decoded.duration)}${decoded.duration > 480 ? ' (سأحلل أول 8 دقائق)' : ''}`;
      run(0, len, h('button'), true);
    } catch (e) { status.textContent = 'تعذّر قراءة الملف. جرّب صيغة MP3 أو M4A أو WAV.'; }
  });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    fileIn.value = '';
    if (!f) return;
    if (!checkFile(f)) return;
    discardRec();
    if (state.live) { stopLive(); liveBtn.textContent = '📡 استمع مباشرة'; }
    livePanel.innerHTML = '';
    currentName = f.name.replace(/\.[^.]+$/, '');
    status.textContent = `جارٍ قراءة ${f.name}…`;
    results.innerHTML = '';
    try {
      const buf = await f.arrayBuffer();
      decoded = await getCtx().decodeAudioData(buf);
      if (!alive()) return;
      if (state.url) URL.revokeObjectURL(state.url);
      state.url = URL.createObjectURL(f);
      status.textContent = `${f.name} · ${fmt(decoded.duration)}`;
      showEditor();
    } catch (e) {
      status.textContent = 'تعذّر قراءة الملف. جرّب صيغة MP3 أو M4A أو WAV.';
    }
  });

  function checkFile(f) {
    if (f.size > 80 * 1024 * 1024) { status.textContent = 'الملف كبير جداً (أكثر من 80 ميجا). اختر ملفاً أصغر أو مقطعاً من الأغنية.'; return false; }
    return true;
  }
  function discardRec() {
    if (!recording) return;
    recording = false; stopRec();
    recBtn.textContent = '🎙️ سجّل مقطعاً';
  }
  state.onHide = () => { if (recording) finishRec(); };

  // تسجيل من المايكروفون
  let recording = false;
  let recPending = false;
  recBtn.addEventListener('click', async () => {
    if (recording) { finishRec(); return; }
    if (recPending) return;
    if (state.worker) { state.worker.terminate(); state.worker = null; }
    recPending = true; recBtn.disabled = true;
    try {
      const c = getCtx();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      recPending = false; recBtn.disabled = false;
      if (!alive()) { stream.getTracks().forEach(t => t.stop()); return; }
      state.stream = stream;
      const src = c.createMediaStreamSource(state.stream);
      const proc = c.createScriptProcessor(4096, 1, 1);
      const chunks = [];
      let len = 0;
      const t0 = Date.now();
      proc.onaudioprocess = e => {
        const d = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(d)); len += d.length;
        const sec = (Date.now() - t0) / 1000;
        status.textContent = `● جارٍ التسجيل ${fmt(sec)} — اضغط «أوقف» عند الانتهاء (الحد 3 دقائق)`;
        if (sec >= 180) finishRec();
      };
      const mute = c.createGain(); mute.gain.value = 0;
      src.connect(proc); proc.connect(mute); mute.connect(c.destination);
      state.proc = proc;
      state.rec = { chunks, get len() { return len; }, sr: c.sampleRate };
      recording = true;
      recBtn.textContent = '■ أوقف التسجيل';
      if (state.live) { stopLive(); liveBtn.textContent = '📡 استمع مباشرة'; }
      livePanel.innerHTML = '';
      results.innerHTML = ''; editor.innerHTML = '';
    } catch (e) { recPending = false; recBtn.disabled = false; status.textContent = 'لا يمكن الوصول للمايكروفون. اسمح للتطبيق باستخدامه من إعدادات الجهاز.'; }
  });
  function finishRec() {
    if (!recording) return;
    recording = false;
    recBtn.textContent = '🎙️ سجّل مقطعاً';
    stopRec();
    const { chunks, sr } = state.rec;
    const total = chunks.reduce((a, b) => a + b.length, 0);
    if (total < sr * 5) { status.textContent = 'التسجيل قصير جداً. سجّل 10 ثوانٍ على الأقل.'; return; }
    const ab = getCtx().createBuffer(1, total, sr);
    const d = ab.getChannelData(0);
    let o = 0; for (const ch of chunks) { d.set(ch, o); o += ch.length; }
    decoded = ab;
    currentName = 'تسجيل ' + new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    if (state.url) { URL.revokeObjectURL(state.url); state.url = null; }
    status.textContent = `تسجيل · ${fmt(ab.duration)} — جارٍ التحليل مباشرة…`;
    const go = showEditor(Math.min(ab.duration, 180));
    run(0, Math.min(ab.duration, 180), go); // تحليل فوري للتسجيل كاملاً
  }

  function showEditor(initialLen = null) {
    editor.innerHTML = '';
    const dur = decoded.duration;
    let start = 0;
    let chosen = initialLen || Math.min(dur, 60);
    const effLen = () => Math.max(1, Math.min(chosen, dur - start));
    const preview = h('button', { class: 'btn small' }, '▶ استمع للمقطع');
    preview.addEventListener('click', () => {
      if (state.audio) { state.audio.pause(); state.audio = null; preview.textContent = '▶ استمع للمقطع'; return; }
      if (state.url) {
        const a = new Audio(state.url); a.currentTime = start; a.play(); state.audio = a; preview.textContent = '■ إيقاف';
        const stopAt = () => { if (a.currentTime >= start + effLen()) { a.pause(); state.audio = null; preview.textContent = '▶ استمع للمقطع'; } else if (state.audio === a) requestAnimationFrame(stopAt); };
        requestAnimationFrame(stopAt);
      } else {
        const c = getCtx(); const s = c.createBufferSource(); s.buffer = decoded; s.connect(c.destination); s.start(0, start, effLen());
        state.audio = { pause: () => { try { s.stop(); } catch (e) {} } }; preview.textContent = '■ إيقاف';
        s.onended = () => { state.audio = null; preview.textContent = '▶ استمع للمقطع'; };
      }
    });
    const go = h('button', { class: 'btn primary', style: { width: '100%' } }, '🔍 حلّل المقام');
    go.addEventListener('click', () => run(start, effLen(), go));
    const els = [];
    if (dur > 15) {
      els.push(slider('البداية', 0, Math.max(0, Math.floor(dur - 10)), 1, 0, v => { start = v; }, v => fmt(v)));
      els.push(slider('المدة', 10, Math.min(180, Math.floor(dur)), 1, Math.round(chosen), v => { chosen = v; }, v => `${v} ث`));
    }
    editor.append(card('المقطع المراد تحليله', ...els, h('div', { class: 'row', style: { margin: '8px 0' } }, preview), go));
    return go;
  }

  async function run(start, len, btn, deep = false) {
    btn.disabled = true;
    results.innerHTML = '';
    const bar = h('i', { style: { width: '0%' } });
    const label = h('div', { class: 'muted', style: { fontSize: '.85rem', marginTop: '6px' } }, 'تجهيز الصوت…');
    results.append(card('جارٍ التحليل', h('div', { class: 'bar' }, bar), label));
    try {
      const setP = (p0, p1) => p => { bar.style.width = `${Math.round((p0 + p * (p1 - p0)) * 100)}%`; };
      // 1) عزل صوت المغني (اختياري، الإعداد مفعّل افتراضياً)
      let vocals = null;
      state.vocals = null;
      if (store.settings().isolateVocals !== false) {
        label.textContent = '🎤 عزل صوت المغني عن الموسيقى… (أبطأ خطوة)';
        const off44 = new OfflineAudioContext(2, Math.ceil(len * 44100), 44100);
        const s44 = off44.createBufferSource(); s44.buffer = decoded; s44.connect(off44.destination); s44.start(0, start, len);
        const r44 = await off44.startRendering();
        if (!alive()) return;
        const L = new Float32Array(r44.getChannelData(0)), R = new Float32Array(r44.getChannelData(1));
        const v = await inWorker('../workers/sep-worker.js', { L, R }, [L.buffer, R.buffer], setP(0, 0.6)).catch(e => { console.warn(e); return null; });
        if (!alive()) return;
        if (v && v.vocals) {
          vocals = getCtx().createBuffer(1, v.vocals.length, 44100);
          vocals.copyToChannel(v.vocals, 0);
          state.vocals = vocals;
        }
      }
      // 2) تحويل لقناة واحدة 11025Hz (YIN) و16kHz (SwiftF0)
      const prep = async (buf, offset) => {
        const off = new OfflineAudioContext(1, Math.ceil(len * SR), SR);
        const src = off.createBufferSource(); src.buffer = buf;
        const hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
        const lp = off.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
        src.connect(hp).connect(lp).connect(off.destination);
        src.start(0, offset, len);
        const x = new Float32Array((await off.startRendering()).getChannelData(0));
        const off16 = new OfflineAudioContext(1, Math.ceil(len * 16000), 16000);
        const src16 = off16.createBufferSource(); src16.buffer = buf;
        const hp16 = off16.createBiquadFilter(); hp16.type = 'highpass'; hp16.frequency.value = 80;
        src16.connect(hp16).connect(off16.destination);
        src16.start(0, offset, len);
        const x16 = new Float32Array((await off16.startRendering()).getChannelData(0));
        for (const y of [x, x16]) { let pk = 0; for (let i = 0; i < y.length; i++) pk = Math.max(pk, Math.abs(y[i])); if (pk > 0) for (let i = 0; i < y.length; i++) y[i] /= pk; }
        return { x, x16 };
      };
      const mix = await prep(decoded, start);
      if (!alive()) return;
      const msg = { x: mix.x, x16: mix.x16, deep }, tr = [mix.x.buffer, mix.x16.buffer];
      if (vocals) { const vv = await prep(vocals, 0); msg.xv = vv.x; msg.xv16 = vv.x16; tr.push(vv.x.buffer, vv.x16.buffer); }
      if (!alive()) return;
      label.textContent = 'تتبع اللحن بدقة ربع التون…';
      const res = (await inWorker('../workers/maqam-worker.js', msg, tr, setP(vocals ? 0.6 : 0, 1))).result;
      if (!alive()) return;
      results.innerHTML = '';
      if (res.ok) res.startOffset = start;
      if (deep && res.ok && res.deep) showDeep(res);
      showResults(res);
    } catch (e) {
      console.error(e);
      results.innerHTML = '';
      results.append(card(null, h('p', {}, 'تعذّر التحليل. جرّب مقطعاً آخر.')));
    }
    btn.disabled = false;
  }

  if (openSongId) {
    const sng = store.songById(openSongId);
    if (sng) setTimeout(() => { if (sng.res.deep) showDeep(sng.res); showResults(sng.res, sng); }, 0);
  }
  function showDeep(res) {
    const D = res.deep;
    const keyOf = sg => sg.id + ':' + sg.q;
    const colors = ['var(--accent)', 'var(--chord)', 'var(--root)', 'var(--quarter)', '#8f7ae0', '#5aa7d9', '#d0d07a'];
    const keys = [...new Set(D.segments.map(keyOf))];
    const mainKey = D.main.id + ':' + D.main.q;
    keys.sort((a, b) => (b === mainKey) - (a === mainKey));
    const color = k => colors[keys.indexOf(k) % colors.length];
    const label = k => { const [id, q] = k.split(':'); return `${MAQAMAT[id].name} من ${tonicName(+q)}`; };
    const total = D.total || D.segments[D.segments.length - 1].end;
    const summary = D.distinct === 1
      ? `الأغنية على مقام واحد من البداية للنهاية: ${label(mainKey)}.`
      : (() => {
        const nm = D.distinct === 2 ? 'مقامين' : `${D.distinct} مقامات`;
        const t = D.segments.length - 1;
        const tw = t === 1 ? 'تحويل واحد' : t === 2 ? 'تحويلان' : `${t} تحويلات`;
        return `سمعت ${nm} في الأغنية. المقام الأساسي ${label(mainKey)}، وفيها ${tw}.`;
      })();
    // الشريط الزمني
    const bar = h('div', { style: { display: 'flex', height: '34px', borderRadius: '8px', overflow: 'hidden', direction: 'ltr', marginTop: '10px' } },
      D.segments.map(sg => h('div', { title: `${fmt(sg.start)}–${fmt(sg.end)}`, style: { width: `${100 * (sg.end - sg.start) / total}%`, background: color(keyOf(sg)), opacity: sg.voiced < 0.2 ? 0.45 : 1, borderInlineEnd: '1px solid var(--bg)' } })));
    const ticks = h('div', { style: { position: 'relative', height: '16px', direction: 'ltr', fontSize: '.7rem', color: 'var(--muted)' } });
    for (let m = 0; m <= total; m += total > 300 ? 60 : 30) ticks.append(h('span', { style: { position: 'absolute', left: `${100 * m / total}%`, transform: 'translateX(-50%)' } }, fmt(m)));
    // الأحداث
    const rows = D.segments.map((sg, i) => {
      const k = keyOf(sg);
      const prevKeys = D.segments.slice(0, i).map(keyOf);
      const what = i === 0 ? 'البداية على' : (k === mainKey ? (prevKeys.includes(k) ? 'رجعت إلى' : 'دخلت') : (prevKeys.includes(k) ? 'رجعت مرة أخرى إلى' : 'تحولت إلى'));
      const play = h('button', { class: 'btn small deep-play' }, '▶');
      play.addEventListener('click', () => {
        const wasMe = state.audio && state.audio.__btn === play;
        if (state.audio) { state.audio.pause(); state.audio = null; }
        results.querySelectorAll('.deep-play').forEach(b => { b.textContent = '▶'; });
        if (wasMe || !state.url) return; // الضغطة الثانية توقف التشغيل
        const a = new Audio(state.url); a.__btn = play; a.currentTime = sg.start; a.play(); state.audio = a;
        play.textContent = '■';
        const done = () => { if (state.audio === a) { a.pause(); state.audio = null; } play.textContent = '▶'; };
        a.onended = done;
        const stopAt = () => { if (state.audio !== a) return; if (a.currentTime >= sg.end) done(); else requestAnimationFrame(stopAt); };
        requestAnimationFrame(stopAt);
      });
      if (!state.url) play.disabled = true;
      return h('div', { class: 'lesson-item' },
        h('span', { class: 'st', style: { background: color(k), borderColor: color(k), color: '#1a1208', fontWeight: 800 } }, i + 1),
        h('span', { class: 't' },
          h('b', {}, `${fmt(sg.start)} — ${what} ${label(k)}`),
          h('small', {}, `حتى ${fmt(sg.end)} · ${Math.round(sg.end - sg.start)} ثانية${k === mainKey ? ' · المقام الأساسي' : ''}${sg.voiced < 0.2 ? ' · قسم موسيقي بلا لحن واضح' : ''}`)),
        h('span', { class: `pill${sg.conf >= 0.6 ? ' ok' : ''}` }, `${Math.round(sg.conf * 100)}%`),
        play);
    });
    results.append(h('section', { class: 'card hl', style: { borderColor: 'var(--chord)' } },
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, '🧠 التحليل العميق'), h('span', { class: 'pill' }, fmt(total))),
      h('h2', { style: { margin: '6px 0' } }, summary),
      bar, ticks,
      h('div', { class: 'legend', style: { marginTop: '6px' } }, keys.map(k => h('span', {}, h('i', { style: { background: color(k) } }), label(k)))),
      h('div', { style: { marginTop: '10px' } }, rows),
      h('p', { class: 'muted', style: { fontSize: '.78rem', marginTop: '8px' } }, 'أوقات التحويل تقريبية (±10 ثوانٍ تقريباً). التحويلات غالباً تكون في الكوبليه أو الموال، والعودة للمقام الأساسي في المذهب. اضغط ▶ لسماع أي قسم.')));
  }

  function showResults(res, saved = null) {
    if (!res.ok) { results.append(card(null, h('p', {}, res.reason))); return; }
    stopPracticeTools();
    const b = res.ranking[0];
    const m = MAQAMAT[b.id];
    const conf = Math.round(b.prob * 100);
    const t = tonicFromQ(b.q);
    const verdict = conf >= 70 ? 'نتيجة واضحة' : conf >= 45 ? 'نتيجة مرجّحة' : 'نتيجة غير محسومة';
    const ls = lessonFor(b.id);
    results.append(h('section', { class: 'card hl' },
      h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'المقام الأرجح'), h('span', { class: `pill${conf >= 70 ? ' ok' : ''}` }, `${verdict} · ${conf}%`)),
      h('h1', { style: { margin: '4px 0' } }, m.name),
      h('p', { style: { margin: '0 0 6px' } }, `القرار: `, h('b', {}, tonicName(b.q)), ` · ${AJNAS[m.ajnas[0]].name} + ${AJNAS[m.ajnas[1]].name}`),
      h('p', { class: 'muted', style: { fontSize: '.9rem' } }, m.desc),
      h('div', { class: 'row', style: { fontSize: '.88rem' } },
        MAQAM_CHARACTER[b.id] ? h('span', {}, h('b', {}, 'الطابع: '), MAQAM_CHARACTER[b.id].mood) : null,
        res.bpm ? h('span', { class: 'pill' }, `BPM ≈ ${res.bpm}`) : null),
      MAQAM_CHARACTER[b.id] ? h('div', { class: 'muted', style: { fontSize: '.82rem', marginTop: '4px' } }, 'يتحول عادة إلى: ' + MAQAM_CHARACTER[b.id].mods.map(k => MAQAMAT[k].name.replace('مقام ', '')).join('، ')) : null,
      conf < 45 ? h('p', { style: { fontSize: '.88rem', color: 'var(--quarter)' } }, 'المقامات المرشحة متقاربة. جرّب مقطعاً أطول يصعد فيه اللحن للجنس الأعلى، أو قارن بالدليل أدناه.') : null,
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('a', { class: 'btn primary small', href: `#/explore/maqam/${b.id}/${t.pc}` }, '🗺️ اعزفه على الزند'),
        ls ? h('a', { class: 'btn small', href: `#/lesson/${ls.id}` }, '📘 درس المقام') : null)));

    // المرشحون
    results.append(card('المقامات المرشحة', ...res.ranking.map(r => h('div', { style: { margin: '6px 0' } },
      h('div', { class: 'row between' }, h('span', {}, `${MAQAMAT[r.id].name} من ${tonicName(r.q)}`), h('span', { class: 'muted' }, `${Math.round(r.prob * 100)}%`)),
      h('div', { class: 'bar' }, h('i', { style: { width: `${Math.max(2, r.prob * 100)}%` } }))))));

    // الدليل
    const rows = res.evidence.map(e => {
      const name = e.measured != null ? spelledName((48 + t.pc) * 2 + (t.quarter ? 1 : 0) + Math.round(e.measured / 50), t.pc, e.deg) : '—';
      const diff = e.measured != null ? e.measured - e.expected : null;
      const ok = diff != null && Math.abs(diff) <= 25 && e.strength > 0.004;
      return h('tr', {},
        h('td', {}, DEG_NAMES[e.deg]),
        h('td', {}, name),
        h('td', { class: 'ltr' }, e.measured != null ? `${e.measured}` : '—'),
        h('td', {}, intervalWord(e.expected, e.deg)),
        h('td', {}, ok ? '✓' : (e.strength <= 0.004 ? 'لم تُسمع' : '≈')));
    });
    results.append(card('الدليل: أين وقعت الدرجات (بالسنت فوق القرار)',
      h('table', { class: 't' }, h('tr', {}, h('th', {}, 'الدرجة'), h('th', {}, 'النوتة'), h('th', {}, 'سنت'), h('th', {}, 'المتوقع'), h('th', {}, '')), rows),
      h('p', { class: 'muted', style: { fontSize: '.82rem', marginTop: '8px' } }, 'نصف التون = 100 سنت، وربع التون = 50. مثلاً ثانية عند 150 تعني نصف بيمول (بياتي، صبا)، وعند 100 تعني كرد أو حجاز.'),
      histogramSvg(res.histogram, b)));

    // الخط الزمني
    if (res.timeline.length > 1) {
      const colors = ['var(--accent)', 'var(--chord)', 'var(--root)', 'var(--quarter)', '#8f7ae0', '#5aa7d9'];
      const ids = [...new Set(res.timeline.map(s => s.id + ':' + s.q))];
      results.append(card('المقام عبر الزمن (للكشف عن التحويلات)',
        h('div', { style: { display: 'flex', height: '26px', borderRadius: '6px', overflow: 'hidden', direction: 'ltr' } },
          res.timeline.map((s, i) => h('div', { title: `${fmt(s.start)}`, style: { flex: 1, background: colors[ids.indexOf(s.id + ':' + s.q) % colors.length] } }))),
        h('div', { class: 'legend', style: { marginTop: '8px' } }, ids.map((k, i) => { const [id, q] = k.split(':'); return h('span', {}, h('i', { style: { background: colors[i % colors.length] } }), `${MAQAMAT[id].name} (${tonicName(+q)})`); })),
        h('p', { class: 'muted', style: { fontSize: '.8rem', marginTop: '6px' } }, 'كل خانة نافذة 15 ثانية. تغيّر اللون يعني تحويلاً مقامياً محتملاً.')));
    }
    // حوّل وتدرّب
    const toolHost = h('div');
    const tbtn = (label, fn) => h('button', { class: 'btn', onclick: () => { stopPracticeTools(); fn(); toolHost.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, label);
    let savedEntry = saved;
    const saveBtn = h('button', { class: 'btn' });
    const savedLine = h('div', { class: 'muted', style: { fontSize: '.85rem', marginTop: '8px' } });
    let refreshSaved = () => {
      saveBtn.textContent = savedEntry ? '✎ تعديل الاسم' : '💾 احفظ في المرجع';
      savedLine.textContent = savedEntry ? `محفوظة في المرجع: ${savedEntry.name || 'أغنية'} — ${savedEntry.artist || 'فنان غير محدد'}` : '';
    };
    async function askAndSave() {
      const artists = artistsList().map(a => a.name).filter(n => n !== 'فنان غير محدد');
      const artist = await askText({ title: '🎤 اسم المغني', placeholder: 'مثال: محمد عبده', value: savedEntry?.artist || '', suggestions: artists });
      if (artist === null && !savedEntry) { toast('لم تُحفظ. تقدر تحفظها من زر «احفظ في المرجع».'); return; }
      const name = await askText({ title: '🎵 اسم الأغنية', placeholder: 'اكتب اسم الأغنية', value: savedEntry?.name || (currentName.startsWith('تسجيل') ? '' : currentName) });
      const fields = { artist: artist ? canonicalArtist(artist) : (savedEntry?.artist || ''), name: name || savedEntry?.name || currentName || 'أغنية' };
      if (savedEntry) { store.updateSong(savedEntry.id, fields); Object.assign(savedEntry, fields); toast('تم التعديل'); }
      else { savedEntry = store.addSong({ ...fields, note: '', maqam: b.id, q: b.q, bpm: res.bpm, res }); toast('حُفظت في مرجع الأغاني'); }
      refreshSaved(); drawNotebook();
    }
    saveBtn.addEventListener('click', askAndSave);
    const delBtn = h('button', { class: 'btn small', onclick: () => { if (savedEntry && confirm('حذف الأغنية من المرجع؟')) { store.removeSong(savedEntry.id); savedEntry = null; refreshSaved(); drawNotebook(); delBtn.style.display = 'none'; toast('حُذفت'); } } }, '🗑️');
    delBtn.style.display = saved ? '' : 'none';
    const _refresh = refreshSaved;
    refreshSaved = () => { _refresh(); delBtn.style.display = savedEntry ? '' : 'none'; };
    refreshSaved();
    results.append(card('حوّل الأغنية إلى تدريب',
      h('div', { class: 'row' },
        tbtn('🎸 اعزف معي', () => playAlong(toolHost, { id: b.id, q: b.q, tuning: res.tuningOffset })),
        res.notes && res.notes.length ? tbtn('🎯 درّبني على اللحن', () => songTrainer(toolHost, res, b, saved ? null : state.url)) : null,
        res.notes && res.notes.length ? tbtn('🎼 اللحن على الزند', () => melodyOnFretboard(toolHost, res, b)) : null,
        tbtn('🥁 رافقني', () => accompaniment(toolHost, b, res.bpm)),
        saveBtn, delBtn), savedLine), toolHost);
    if (state.vocals && !saved) {
      const vb = state.vocals;
      const vbtn = h('button', { class: 'btn small' }, '🎤 اسمع صوت المغني المعزول');
      vbtn.addEventListener('click', () => {
        const mine = state.audio && state.audio.__vb;
        if (state.audio) { state.audio.pause(); state.audio = null; }
        vbtn.textContent = '🎤 اسمع صوت المغني المعزول';
        if (mine) return;
        const c = getCtx(); const s = c.createBufferSource(); s.buffer = vb; s.connect(c.destination); s.start();
        state.audio = { __vb: true, pause: () => { try { s.stop(); } catch (e) {} } }; vbtn.textContent = '■ إيقاف';
        s.onended = () => { if (state.audio && state.audio.__vb) state.audio = null; vbtn.textContent = '🎤 اسمع صوت المغني المعزول'; };
      });
      const vs = res.vocalShare;
      const share = vs == null ? (res.vocalsTried ? ' لكن الأغنية الأصلية أعطت نتيجة أوضح هنا (غالباً عزف آلي بلا غناء)، فاعتمدناها.' : '') : vs > 0.97 ? ' اعتمد التحليل على صوت المغني بالكامل.' : vs < 0.03 ? ' لم نسمع غناءً واضحاً، فاعتمد التحليل على الموسيقى نفسها.' : ` اعتمد التحليل على صوت المغني في ${Math.round(vs * 100)}% من اللحن، والباقي من الموسيقى (لزمات وتقاسيم).`;
      results.append(card(null, h('div', { class: 'muted', style: { fontSize: '.85rem', marginBottom: '6px' } }, `عزلنا صوت المغني عن الموسيقى.${share}`), vbtn));
    }
    results.append(h('p', { class: 'muted', style: { fontSize: '.78rem' } }, `تصحيح الدوزان: ${res.tuningOffset > 0 ? '+' : ''}${res.tuningOffset.toFixed(0)} سنت · نسبة اللحن الواضح: ${Math.round(res.voicedRatio * 100)}% · محرك التتبع: ${res.engine === 'swiftf0' ? 'SwiftF0' : 'YIN'}${res.vocalShare != null ? ' + عزل الصوت (Spleeter)' : ''}`));
    if (saved) results.prepend(h('div', { class: 'muted', style: { marginBottom: '6px' } }, `من المرجع: ${saved.name || ''}${saved.artist ? ' — ' + saved.artist : ''}`));
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // بعد تحليل جديد: اسأل عن المغني ثم الأغنية واحفظ
    if (!saved) setTimeout(() => { if (alive() && !document.hidden) askAndSave(); }, 700);
  }
}

function histogramSvg(hist, best) {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 360, H = 130, padB = 22;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('direction', 'ltr');
  svg.style.width = '100%'; svg.style.marginTop = '10px';
  const add = (tag, a, txt) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; svg.appendChild(e); return e; };
  const shift = best.q * 5; // خانات 10 سنت
  const rot = hist.map((_, i) => hist[(i + shift) % hist.length]);
  const mx = Math.max(...rot) || 1;
  const bw = W / rot.length;
  const offs = stepsToOffsets(MAQAMAT[best.id].asc).map(o => o * 50);
  offs.forEach(c => add('rect', { x: (c / 10) * bw - 1, y: 0, width: bw + 2, height: H - padB, fill: 'var(--accent)', opacity: 0.12 }));
  rot.forEach((v, i) => add('rect', { x: i * bw, y: (H - padB) * (1 - v / mx), width: bw * 0.9, height: (H - padB) * (v / mx), fill: 'var(--note)' }));
  [0, 200, 400, 600, 800, 1000].forEach(c => add('text', { x: (c / 10) * bw, y: H - 6, fill: 'var(--muted)', 'font-size': 9 }, c));
  return svg;
}

function fmt(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }


// ================= الاستماع المباشر =================
function stopLive() {
  const L = state.live;
  if (!L) return;
  clearInterval(L.timer); clearInterval(L.timer2);
  try { L.proc.disconnect(); } catch (e) {}
  L.stream.getTracks().forEach(t => t.stop());
  state.live = null;
}

async function startLive(panel, status, alive = () => true) {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
  catch (e) { status.textContent = 'لا يمكن الوصول للمايكروفون. اسمح للتطبيق باستخدامه من إعدادات الجهاز.'; return false; }
  if (!alive()) { stream.getTracks().forEach(t => t.stop()); return false; }
  const c = getCtx();
  const src = c.createMediaStreamSource(stream);
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  const proc = c.createScriptProcessor(2048, 1, 1);
  const mute = c.createGain(); mute.gain.value = 0;
  src.connect(hp).connect(lp).connect(proc); proc.connect(mute); mute.connect(c.destination);
  const CAP = SR * 40;
  const L = { stream, proc, buf: new Float32Array(CAP), len: 0, done: 0, frames: [], t0: c.currentTime, shown: null, pending: null, gain: 1 };
  state.live = L;
  const ratio = c.sampleRate / SR;
  let phase = 0;
  proc.onaudioprocess = e => {
    const d = e.inputBuffer.getChannelData(0);
    // إعادة أخذ العينات إلى 11025 بالمتوسط
    const out = [];
    while (phase + ratio <= d.length) {
      const a = Math.floor(phase), b = Math.min(d.length, Math.floor(phase + ratio));
      let s = 0; for (let i = a; i < b; i++) s += d[i];
      out.push(s / Math.max(1, b - a));
      phase += ratio;
    }
    phase -= d.length;
    if (L.len + out.length > CAP) { // أبقِ آخر 20 ثانية
      const keep = SR * 20, cut = L.len - keep;
      L.buf.copyWithin(0, cut, L.len); L.len = keep; L.done = Math.max(0, L.done - cut);
    }
    // تكبير تلقائي بسيط
    let pk = 0; for (const v of out) pk = Math.max(pk, Math.abs(v));
    if (pk > 0) L.gain = Math.min(50, 0.95 * L.gain + 0.05 * (0.5 / pk));
    for (const v of out) L.buf[L.len++] = v * L.gain;
  };

  // الواجهة
  panel.innerHTML = '';
  const name = h('h1', { style: { margin: '2px 0' } }, 'أستمع…');
  const sub = h('div', { class: 'muted' }, 'شغّل الأغنية قرب الجوال');
  const conf = h('span', { class: 'pill' }, '—');
  const bpmEl = h('span', { class: 'pill' }, 'BPM —');
  const mood = h('div', { class: 'muted', style: { fontSize: '.85rem' } });
  const canvas = h('canvas', { style: { width: '100%', height: '200px', display: 'block', background: 'var(--bg2)', borderRadius: '10px', marginTop: '10px' } });
  const histHost = h('div');
  const links = h('div', { class: 'row', style: { marginTop: '8px' } });
  panel.append(h('section', { class: 'card hl' },
    h('div', { class: 'row between' }, h('span', { class: 'row' }, h('span', { class: 'rec' }), h('span', { class: 'muted' }, 'استماع مباشر')), h('span', { class: 'row' }, bpmEl, conf)),
    name, sub, mood, canvas, histHost, links,
    h('p', { class: 'muted', style: { fontSize: '.78rem', margin: '8px 0 0' } }, 'الخطوط الأفقية = درجات المقام المكتشف. النقاط = اللحن الذي يسمعه التطبيق الآن.')));
  status.textContent = '';

  // تتبع الطبقة دورياً
  const need = FRAME + Math.floor(SR / 70) + 2;
  L.timer = setInterval(() => {
    if (L.len - L.done < need + HOP * 4) return;
    const seg = L.buf.subarray(L.done, L.len);
    const fr = trackPitch(seg);
    const tBase = L.frames.length ? L.frames[L.frames.length - 1].t + HOP / SR : 0;
    fr.forEach((f, i) => { f.t = tBase + i * HOP / SR; });
    L.frames.push(...fr);
    L.done += fr.length * HOP;
    const maxF = Math.round(25 / (HOP / SR));
    if (L.frames.length > maxF) L.frames.splice(0, L.frames.length - maxF);
    draw();
  }, 200);

  // تحليل المقام كل ثانية ونصف
  L.timer2 = setInterval(() => {
    activity();
    if (L.frames.length < 200) return;
    const res = analyzeFrames(L.frames, { timeline: false });
    if (!res.ok) { sub.textContent = 'لم أسمع لحناً واضحاً بعد… قرّب الجوال من مصدر الصوت'; return; }
    const b = res.ranking[0];
    const key = b.id + ':' + b.q;
    // ثبات العرض: لا نغيّر المقام إلا إذا تكرر مرتين
    if (L.shown && key !== L.shown.key) {
      if (!L.pending || L.pending !== key) { L.pending = key; return; }
    }
    L.pending = null;
    L.shown = { key, b, res };
    const m = MAQAMAT[b.id];
    name.textContent = m.name;
    sub.textContent = `القرار: ${tonicName(b.q)}`;
    conf.textContent = `${Math.round(b.prob * 100)}%`;
    conf.className = `pill${b.prob >= 0.7 ? ' ok' : ''}`;
    bpmEl.textContent = res.bpm ? `BPM ≈ ${res.bpm}` : 'BPM —';
    mood.textContent = MAQAM_CHARACTER[b.id] ? `الطابع: ${MAQAM_CHARACTER[b.id].mood}` : '';
    histHost.innerHTML = ''; histHost.append(histogramSvg(res.histogram, b));
    links.innerHTML = '';
    const ls = lessonFor(b.id);
    links.append(h('a', { class: 'btn primary small', href: `#/explore/maqam/${b.id}/${tonicFromQ(b.q).pc}` }, '🗺️ على الزند'), ls ? h('a', { class: 'btn small', href: `#/lesson/${ls.id}` }, '📘 الدرس') : null);
  }, 1500);

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W) return;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.body);
    const fr = L.frames;
    if (!fr.length) return;
    const tEnd = fr[fr.length - 1].t, span = 12;
    const vis = fr.filter(f => f.t > tEnd - span && f.cents != null && f.clarity > 0.75);
    if (!vis.length) return;
    const sorted = vis.map(f => f.cents).sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    const lo = mid - 900, hi = mid + 900;
    const y = c => H - ((c - lo) / (hi - lo)) * H;
    // خطوط درجات المقام
    if (L.shown) {
      const { b, res } = L.shown;
      const t = tonicFromQ(b.q);
      const offs = stepsToOffsets(MAQAMAT[b.id].asc).map(o => o * 50);
      const tonicAbs = b.q * 50 + res.tuningOffset;
      g.font = '10px system-ui'; g.textAlign = 'left';
      for (let oct = Math.floor((lo - tonicAbs) / 1200) - 1; oct <= Math.ceil((hi - tonicAbs) / 1200) + 1; oct++) {
        offs.forEach((o, i) => {
          const c = tonicAbs + oct * 1200 + o;
          if (c < lo || c > hi) return;
          g.strokeStyle = i === 0 ? css.getPropertyValue('--root') : 'rgba(200,180,150,.25)';
          g.lineWidth = i === 0 ? 1.5 : 1;
          g.beginPath(); g.moveTo(0, y(c)); g.lineTo(W, y(c)); g.stroke();
          g.fillStyle = 'rgba(200,180,150,.7)';
          g.fillText(spelledName((48 + t.pc) * 2 + (t.quarter ? 1 : 0) + o / 50, t.pc, i), 4, y(c) - 2);
        });
      }
    }
    g.fillStyle = css.getPropertyValue('--accent');
    for (const f of vis) {
      const x = W - ((tEnd - f.t) / span) * W;
      g.fillRect(x - 1.5, y(f.cents) - 1.5, 3, 3);
    }
  }
  return true;
}

// إيقاف مؤقت عند خروج التطبيق للخلفية: يوقف الاستماع والأدوات والمعاينة دون إلغاء الصفحة
export function pauseAnalyzer() {
  stopLive();
  stopPracticeTools();
  if (state.audio) { state.audio.pause(); state.audio = null; }
  if (state.onHide) state.onHide();
}
