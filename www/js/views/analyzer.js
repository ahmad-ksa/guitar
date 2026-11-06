// محلل المقام: ارفع أغنية أو سجّل مقطعاً، فيحدد التطبيق المقام والقرار مع الدليل
import { h, card, slider, toast, icon } from '../ui.js';
import { getCtx, stopAll } from '../audio.js';
import { MAQAMAT, AJNAS, MAQAM_CHARACTER, spelledName, stepsToOffsets } from '../theory.js';
import { SR, tonicFromQ, trackPitch, analyzeFrames, FRAME, HOP } from '../maqam-analyzer.js';
import { ALL } from '../lessons/index.js';

let state = { worker: null, stream: null, proc: null, audio: null, url: null, live: null };
export function cleanup() {
  stopLive();
  if (state.worker) { state.worker.terminate(); state.worker = null; }
  stopRec();
  if (state.audio) { state.audio.pause(); state.audio = null; }
  if (state.url) { URL.revokeObjectURL(state.url); state.url = null; }
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
function tonicName(q) { const t = tonicFromQ(q); return spelledName((48 + t.pc) * 2 + (t.quarter ? 1 : 0), t.pc, 0); }
function lessonFor(id) { return ALL.find(l => l.title === MAQAMAT[id].name); }

export function renderAnalyzer(app) {
  cleanup();
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'محلل المقام')));
  app.append(h('p', { class: 'muted', style: { marginTop: '-6px' } }, 'ارفع أغنية أو جزءاً منها، أو سجّل من المايكروفون، وسيحدد التطبيق المقام والقرار ويشرح لك لماذا. التحليل يتم على جهازك دون إنترنت.'));

  const fileIn = h('input', { type: 'file', accept: 'audio/*,video/mp4,.mp3,.m4a,.wav,.ogg,.aac,.flac', style: { display: 'none' } });
  const recBtn = h('button', { class: 'btn' }, '🎙️ سجّل مقطعاً');
  const liveBtn = h('button', { class: 'btn' }, '📡 استمع مباشرة');
  const livePanel = h('div');
  const pickBtn = h('button', { class: 'btn primary', onclick: () => fileIn.click() }, '📁 اختر ملف أغنية');
  const status = h('div', { class: 'muted', style: { fontSize: '.88rem', marginTop: '8px' } });
  const editor = h('div');
  const results = h('div');
  app.append(card(null, h('div', { class: 'row' }, pickBtn, recBtn, liveBtn), fileIn, status), livePanel, editor, results,
    card('نصائح لأدق نتيجة', h('ul', { style: { margin: 0, paddingInlineStart: '18px' } },
      h('li', {}, 'اختر مقطعاً فيه غناء أو عزف منفرد واضح، 30 إلى 60 ثانية.'),
      h('li', {}, 'لأغنية على يوتيوب أو التلفزيون: شغّلها من جهاز آخر وقرّب الجوال، واستخدم «استمع مباشرة».'),
      h('li', {}, 'المذهب أو بداية الأغنية أفضل غالباً، لأن الأغنية قد تتحول لمقام آخر لاحقاً.'),
      h('li', {}, 'المقامات الشقيقة (البياتي والحسيني مثلاً) تختلف في الجنس الأعلى، فتحتاج مقطعاً يصعد إليه.'),
      h('li', {}, 'النتيجة تقدير آلي: استخدم الدليل بالسنت وأذنك لتأكيدها.'))));

  let decoded = null; // AudioBuffer
  liveBtn.addEventListener('click', () => {
    if (state.live) { stopLive(); liveBtn.textContent = '📡 استمع مباشرة'; return; }
    editor.innerHTML = ''; results.innerHTML = '';
    startLive(livePanel, status).then(ok => { if (ok) liveBtn.textContent = '■ أوقف الاستماع'; });
  });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    if (!f) return;
    if (state.live) { stopLive(); liveBtn.textContent = '📡 استمع مباشرة'; }
    livePanel.innerHTML = '';
    status.textContent = `جارٍ قراءة ${f.name}…`;
    results.innerHTML = '';
    try {
      const buf = await f.arrayBuffer();
      decoded = await getCtx().decodeAudioData(buf.slice(0));
      if (state.url) URL.revokeObjectURL(state.url);
      state.url = URL.createObjectURL(f);
      status.textContent = `${f.name} · ${fmt(decoded.duration)}`;
      showEditor();
    } catch (e) {
      status.textContent = 'تعذّر قراءة الملف. جرّب صيغة MP3 أو M4A أو WAV.';
    }
  });

  // تسجيل من المايكروفون
  let recording = false;
  recBtn.addEventListener('click', async () => {
    if (recording) { finishRec(); return; }
    try {
      const c = getCtx();
      state.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const src = c.createMediaStreamSource(state.stream);
      const proc = c.createScriptProcessor(4096, 1, 1);
      const chunks = [];
      let len = 0;
      const t0 = Date.now();
      proc.onaudioprocess = e => {
        const d = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(d)); len += d.length;
        const sec = (Date.now() - t0) / 1000;
        status.textContent = `● جارٍ التسجيل ${fmt(sec)} — اضغط «أوقف» عند الانتهاء (الحد 60 ثانية)`;
        if (sec >= 60) finishRec();
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
    } catch (e) { status.textContent = 'لا يمكن الوصول للمايكروفون. اسمح للتطبيق باستخدامه من إعدادات الجهاز.'; }
  });
  function finishRec() {
    if (!recording) return;
    recording = false;
    recBtn.textContent = '🎙️ سجّل من المايكروفون';
    stopRec();
    const { chunks, sr } = state.rec;
    const total = chunks.reduce((a, b) => a + b.length, 0);
    if (total < sr * 3) { status.textContent = 'التسجيل قصير جداً. سجّل 10 ثوانٍ على الأقل.'; return; }
    const ab = getCtx().createBuffer(1, total, sr);
    const d = ab.getChannelData(0);
    let o = 0; for (const ch of chunks) { d.set(ch, o); o += ch.length; }
    decoded = ab;
    state.url = null;
    status.textContent = `تسجيل · ${fmt(ab.duration)}`;
    showEditor();
  }

  function showEditor() {
    editor.innerHTML = '';
    const dur = decoded.duration;
    let start = 0;
    let len = Math.min(dur, 60);
    const preview = h('button', { class: 'btn small' }, '▶ استمع للمقطع');
    preview.addEventListener('click', () => {
      if (state.audio) { state.audio.pause(); state.audio = null; preview.textContent = '▶ استمع للمقطع'; return; }
      if (state.url) {
        const a = new Audio(state.url); a.currentTime = start; a.play(); state.audio = a; preview.textContent = '■ إيقاف';
        const stopAt = () => { if (a.currentTime >= start + len) { a.pause(); state.audio = null; preview.textContent = '▶ استمع للمقطع'; } else if (state.audio === a) requestAnimationFrame(stopAt); };
        requestAnimationFrame(stopAt);
      } else {
        const c = getCtx(); const s = c.createBufferSource(); s.buffer = decoded; s.connect(c.destination); s.start(0, start, len);
        state.audio = { pause: () => { try { s.stop(); } catch (e) {} } }; preview.textContent = '■ إيقاف';
        s.onended = () => { state.audio = null; preview.textContent = '▶ استمع للمقطع'; };
      }
    });
    const go = h('button', { class: 'btn primary', style: { width: '100%' } }, '🔍 حلّل المقام');
    go.addEventListener('click', () => run(start, len, go));
    const els = [];
    if (dur > 15) {
      els.push(slider('البداية', 0, Math.max(0, Math.floor(dur - 10)), 1, 0, v => { start = v; if (start + len > dur) len = dur - start; }, v => fmt(v)));
      els.push(slider('المدة', 10, Math.min(120, Math.floor(dur)), 1, Math.round(len), v => { len = Math.min(v, dur - start); }, v => `${v} ث`));
    }
    editor.append(card('المقطع المراد تحليله', ...els, h('div', { class: 'row', style: { margin: '8px 0' } }, preview), go));
  }

  async function run(start, len, btn) {
    btn.disabled = true;
    results.innerHTML = '';
    const bar = h('i', { style: { width: '0%' } });
    const label = h('div', { class: 'muted', style: { fontSize: '.85rem', marginTop: '6px' } }, 'تجهيز الصوت…');
    results.append(card('جارٍ التحليل', h('div', { class: 'bar' }, bar), label));
    try {
      // تحويل لقناة واحدة 11025Hz مع ترشيح يبرز منطقة اللحن
      const n = Math.ceil(len * SR);
      const off = new OfflineAudioContext(1, n, SR);
      const src = off.createBufferSource(); src.buffer = decoded;
      const hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
      const lp = off.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      src.connect(hp).connect(lp).connect(off.destination);
      src.start(0, start, len);
      const rendered = await off.startRendering();
      const x = new Float32Array(rendered.getChannelData(0));
      // تطبيع
      let peak = 0; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
      if (peak > 0) for (let i = 0; i < x.length; i++) x[i] /= peak;
      label.textContent = 'تتبع اللحن بدقة ربع التون…';
      const res = await new Promise((resolve, reject) => {
        if (state.worker) state.worker.terminate();
        const w = new Worker(new URL('../workers/maqam-worker.js', import.meta.url), { type: 'module' });
        state.worker = w;
        w.onmessage = e => {
          if (e.data.progress != null) { bar.style.width = `${Math.round(e.data.progress * 100)}%`; return; }
          w.terminate(); state.worker = null;
          if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data.result);
        };
        w.onerror = e => { w.terminate(); state.worker = null; reject(e); };
        w.postMessage({ x }, [x.buffer]);
      });
      results.innerHTML = '';
      showResults(res);
    } catch (e) {
      console.error(e);
      results.innerHTML = '';
      results.append(card(null, h('p', {}, 'تعذّر التحليل. جرّب مقطعاً آخر.')));
    }
    btn.disabled = false;
  }

  function showResults(res) {
    if (!res.ok) { results.append(card(null, h('p', {}, res.reason))); return; }
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
    results.append(h('p', { class: 'muted', style: { fontSize: '.78rem' } }, `تصحيح الدوزان: ${res.tuningOffset > 0 ? '+' : ''}${res.tuningOffset.toFixed(0)} سنت · نسبة اللحن الواضح: ${Math.round(res.voicedRatio * 100)}%`));
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

async function startLive(panel, status) {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
  catch (e) { status.textContent = 'لا يمكن الوصول للمايكروفون. اسمح للتطبيق باستخدامه من إعدادات الجهاز.'; return false; }
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
