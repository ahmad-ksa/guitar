// محلل المقام: ارفع أغنية أو سجّل مقطعاً، فيحدد التطبيق المقام والقرار مع الدليل
import { h, card, slider, toast, icon } from '../ui.js';
import { getCtx, stopAll } from '../audio.js';
import { MAQAMAT, AJNAS, spelledName, stepsToOffsets } from '../theory.js';
import { SR, tonicFromQ } from '../maqam-analyzer.js';
import { ALL } from '../lessons/index.js';

let state = { worker: null, stream: null, proc: null, audio: null, url: null };
export function cleanup() {
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
  const recBtn = h('button', { class: 'btn' }, '🎙️ سجّل من المايكروفون');
  const pickBtn = h('button', { class: 'btn primary', onclick: () => fileIn.click() }, '📁 اختر ملف أغنية');
  const status = h('div', { class: 'muted', style: { fontSize: '.88rem', marginTop: '8px' } });
  const editor = h('div');
  const results = h('div');
  app.append(card(null, h('div', { class: 'row' }, pickBtn, recBtn), fileIn, status), editor, results,
    card('نصائح لأدق نتيجة', h('ul', { style: { margin: 0, paddingInlineStart: '18px' } },
      h('li', {}, 'اختر مقطعاً فيه غناء أو عزف منفرد واضح، 30 إلى 60 ثانية.'),
      h('li', {}, 'المذهب أو بداية الأغنية أفضل غالباً، لأن الأغنية قد تتحول لمقام آخر لاحقاً.'),
      h('li', {}, 'المقامات الشقيقة (البياتي والحسيني مثلاً) تختلف في الجنس الأعلى، فتحتاج مقطعاً يصعد إليه.'),
      h('li', {}, 'النتيجة تقدير آلي: استخدم الدليل بالسنت وأذنك لتأكيدها.'))));

  let decoded = null; // AudioBuffer
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0];
    if (!f) return;
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
