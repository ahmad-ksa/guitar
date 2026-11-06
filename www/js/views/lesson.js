// صفحة الدرس: الهدف، أصوات اللجنة، الخطوات المشروحة صوتياً مع العرض المتحرك، التمرين، الاختبار، قائمة الإتقان
import { h, rich, slider, toggle, toast, icon } from '../ui.js';
import { Fretboard, chordDiagram } from '../fretboard.js';
import { buildExercise, labelFor } from '../exercises.js';
import { Player } from '../player.js';
import * as speech from '../speech.js';
import * as store from '../store.js';
import { lessonById, nextLesson, prevLesson, LEVELS } from '../lessons/index.js';
import { RHYTHMS, getScale, rootQ } from '../theory.js';
import { stopAll } from '../audio.js';

const AVATARS = { pro: ['🎸', 'العازف المحترف'], maestro: ['🎼', 'المايسترو'], teacher: ['📘', 'مدرس الموسيقى'] };

// جلسة الصفحة الحالية: تُلغى عند المغادرة، وتُوقف مؤقتاً عند خروج التطبيق للخلفية
let session = null;
export function cleanup() {
  if (session) { session.aborted = true; session.halt(); session = null; }
  speech.stop();
  stopAll();
}
export function pause() {
  if (session) session.halt();
  speech.stop();
  stopAll();
}

function legend(hasQuarter) {
  return h('div', { class: 'legend' },
    h('span', {}, h('i', { style: { background: 'var(--root)' } }), 'القرار'),
    h('span', {}, h('i', { style: { background: 'var(--note)' } }), 'نوتة'),
    hasQuarter ? h('span', {}, h('i', { style: { background: 'var(--quarter)' } }), 'نصف بيمول: ربع تون فوق الفرت (↑¼ بِند خفيف)') : null,
    h('span', {}, h('i', { style: { background: 'var(--chord)' } }), 'كورد'),
  );
}

function droneFor(ex) {
  const sp = ex.spec || {};
  const sc = getScale(sp.scale);
  if (sp.root == null) return null;
  return rootQ(sp.root, sp.rootQuarter ?? sc?.rootQuarter ?? false, 36);
}

export function renderLesson(app, id, isExam = false) {
  cleanup();
  const lesson = isExam ? LEVELS.find(l => l.n === +id)?.exam : lessonById(id);
  if (!lesson) { app.append(h('p', {}, 'الدرس غير موجود.')); return; }
  if (!isExam) store.setLast(lesson.id);
  store.resetPractice();
  const s = store.settings();

  const lid = lesson.id;
  const levelN = isExam ? +id : lesson.level;
  app.append(h('div', { class: 'topbar' },
    h('button', { class: 'back', onclick: () => { location.hash = `#/level/${levelN}`; } }, '→ رجوع'),
    h('h1', {}, lesson.title),
    lesson.minutes ? h('span', { class: 'pill' }, `${lesson.minutes} د`) : null,
  ));
  if (!isExam) app.append(h('div', { class: 'muted', style: { fontSize: '.85rem', marginTop: '-8px', marginBottom: '10px' } }, `المستوى ${lesson.level} · ${lesson.unit}`));
  if (lesson.goal) app.append(h('div', { class: 'goal' }, h('b', {}, 'الهدف: '), lesson.goal));

  // أصوات اللجنة
  if (lesson.voices) {
    app.append(h('div', { class: 'voices' }, Object.entries(lesson.voices).filter(([, v]) => v).map(([k, v]) =>
      h('div', { class: 'voice' }, h('div', { class: 'av' }, AVATARS[k][0]), h('div', {}, h('b', {}, AVATARS[k][1]), h('p', {}, v))))));
  }

  // ===== المسرح: الخطوات =====
  const steps = lesson.steps || [];
  let board = null;
  const player = new Player(null, { metronome: false, countIn: false });
  const sess = { aborted: false, playToken: 0, halts: [] };
  sess.halt = () => { sess.playToken++; sess.halts.forEach(f => f()); player.stop(); };
  session = sess;
  let stepIdx = 0;
  let watching = false;
  let labelMode = null; // null = حسب الخطوة

  if (steps.length) {
    const stage = h('section', { class: 'stage' });
    const head = h('div', { class: 'row between' }, h('b', {}, 'الشرح'), h('span', { class: 'muted', style: { fontSize: '.85rem' } }));
    const sub = h('div', { class: 'subtitle' });
    const boardHost = h('div');
    const extraHost = h('div');
    const legendHost = h('div');
    const dots = h('div', { class: 'stepdots' });
    const watchBanner = h('div', { class: 'watch-banner', style: { display: 'none' } }, h('span', { class: 'rec' }), 'وضع المشاهدة: الدرس يعمل تلقائياً');
    const seg = h('div', { class: 'seg' }, [['auto', 'تلقائي'], ['note', 'النوتة'], ['degree', 'الدرجة'], ['finger', 'الإصبع']].map(([k, l]) =>
      h('button', { class: k === 'auto' ? 'on' : '', onclick: e => { labelMode = k === 'auto' ? null : k; seg.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.target.classList.add('on'); showStep(stepIdx, false); } }, l)));
    const tempoRow = h('div');
    let tempoMul = 1;
    tempoRow.append(slider('سرعة العرض', 0.5, 1.5, 0.1, 1, v => { tempoMul = v; }, v => `${Math.round(v * 100)}%`));

    const btnPrev = h('button', { class: 'btn small', onclick: () => go(stepIdx - 1) }, icon('prev'));
    const btnNext = h('button', { class: 'btn small', onclick: () => go(stepIdx + 1) }, icon('next'));
    const btnPlay = h('button', { class: 'btn primary', onclick: () => playStep(stepIdx) }, icon('play'), 'اشرح ووضّح');
    const btnWatch = h('button', { class: 'btn', onclick: () => { if (watching) { stopWatch(); sess.playToken++; player.stop(); speech.stop(); sub.classList.remove('speaking'); } else watchAll(); } }, icon('film'), 'وضع المشاهدة');
    const btnStop = h('button', { class: 'btn small', onclick: () => { sess.halt(); speech.stop(); } }, icon('stop'));

    stage.append(head, watchBanner, sub, h('div', { class: 'row', style: { marginBottom: '8px' } }, seg), boardHost, legendHost, extraHost,
      h('div', { class: 'stepnav', style: { marginTop: '10px' } }, btnPrev, dots, btnNext),
      h('div', { class: 'row', style: { marginTop: '10px' } }, btnPlay, btnWatch, btnStop),
      tempoRow);
    app.append(stage);

    const seen = new Set();
    function renderDots() {
      dots.innerHTML = '';
      steps.forEach((_, i) => dots.append(h('i', { class: i === stepIdx ? 'on' : (seen.has(i) ? 'seen' : '') })));
      head.lastChild.textContent = `خطوة ${stepIdx + 1} من ${steps.length}`;
      btnPrev.disabled = stepIdx === 0;
      btnNext.disabled = stepIdx === steps.length - 1;
    }

    function exFor(i) {
      const st = steps[i];
      if (!st.ex) return null;
      const spec = { ...st.ex };
      if (labelMode) spec.label = labelMode;
      const ex = buildExercise(spec);
      if (st.beats) ex.beats = Math.max(ex.beats, st.beats);
      return ex;
    }

    function showStep(i, scroll = true) {
      stepIdx = i;
      seen.add(i);
      const st = steps[i];
      sub.innerHTML = '';
      sub.append(rich(st.say));
      renderDots();
      extraHost.innerHTML = '';
      const ex = exFor(i);
      if (ex && (ex.dots.length || ex.events.length)) {
        if (!board || board.opts.from !== ex.from || board.opts.to !== ex.to) {
          board = new Fretboard(boardHost, { from: ex.from, to: ex.to });
        }
        board.setDots(ex.dots);
        player.setBoard(board);
        boardHost.style.display = '';
        legendHost.innerHTML = '';
        legendHost.append(legend(ex.dots.some(d => d.qt)));
        // مخطط الكورد للكورد الواحد
        const sp = st.ex;
        if ((sp.type === 'chord') && ex.events[0]?.voicing) extraHost.append(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } }, chordDiagram(ex.events[0].voicing, ex.events[0].label)));
        if (st.ex.type === 'progression' || (st.ex.type === 'arp' && st.ex.chords)) {
          const seenV = new Map();
          ex.events.forEach(e => { if (e.voicing && !seenV.has(e.label)) seenV.set(e.label, e.voicing); });
          if (seenV.size) extraHost.append(h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px', gap: '4px' } }, [...seenV].map(([l, v]) => chordDiagram(v, l))));
        }
      } else if (st.rhythm) {
        boardHost.style.display = 'none';
        legendHost.innerHTML = '';
        extraHost.append(rhythmStrip(st.rhythm));
      } else {
        boardHost.style.display = ex ? '' : 'none';
        legendHost.innerHTML = '';
        if (!ex && board) boardHost.style.display = 'none';
      }
      if (st.rhythm && ex && ex.events.length) extraHost.append(rhythmStrip(st.rhythm));
      if (scroll) stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function go(i) {
      if (i < 0 || i >= steps.length) return;
      sess.playToken++; player.stop(); speech.stop(); sub.classList.remove('speaking');
      showStep(i);
    }

    async function playStep(i, auto = false) {
      const st = steps[i];
      const my = ++sess.playToken;
      player.stop();
      sub.classList.add('speaking');
      const t0 = Date.now();
      const spoke = await speech.speak(st.say);
      // بدون صوت: أعطِ وقتاً كافياً لقراءة النص
      if (!spoke && my === sess.playToken && !sess.aborted) {
        const need = Math.max(2500, st.say.length * 65) - (Date.now() - t0);
        if (need > 0) await new Promise(r => setTimeout(r, need));
      }
      if (my === sess.playToken) sub.classList.remove('speaking');
      if (my !== sess.playToken || sess.aborted) return false;
      if (auto && !watching) return false;
      const ex = exFor(i);
      if (ex && (ex.events.length || st.rhythm)) {
        const rh = st.rhythm ? RHYTHMS[st.rhythm] : null;
        const bpm = Math.round((ex.bpm || 70) * tempoMul);
        if (my !== sess.playToken || sess.aborted) return false;
        const ok = await player.play(ex, bpm, {
          metronome: false, countIn: false,
          drone: st.drone ? droneFor(ex) : null,
          rhythm: rh ? { pattern: rh.pattern, slot: rh.slot } : null,
        });
        return ok;
      }
      return true;
    }

    async function watchAll() {
      watching = true;
      watchBanner.style.display = '';
      btnWatch.classList.add('on');
      for (let i = stepIdx; i < steps.length && watching && !sess.aborted; i++) {
        showStep(i, false);
        const ok = await playStep(i, true);
        if (!watching || ok === false || sess.aborted) break;
        await new Promise(r => setTimeout(r, 700));
      }
      stopWatch();
    }
    sess.halts.push(() => { stopWatch(); sub.classList.remove('speaking'); });
    function stopWatch() { watching = false; watchBanner.style.display = 'none'; btnWatch.classList.remove('on'); }

    showStep(0, false);
  }

  // ===== التمرين =====
  if (lesson.practice) {
    const pr = lesson.practice;
    let bpm = Math.max(pr.bpm || 60, 40);
    let metro = s.metronome;
    let loop = true;
    let autoUp = false;
    let cleanCount = 0;
    const ex = buildExercise({ ...pr.ex, label: pr.ex.label || s.label });
    const sec = h('section', { class: 'stage' });
    const host = h('div');
    sec.append(h('div', { class: 'row between' }, h('b', {}, 'التمرين'), h('span', { class: 'pill' }, `الهدف ${pr.target} نبضة`)));
    if (pr.free) sec.append(h('p', { class: 'muted', style: { fontSize: '.88rem' } }, 'تمرين حر: شغّل المرافقة وارتجل فوقها.'));
    sec.append(host);
    const fb = new Fretboard(host, { from: ex.from, to: ex.to });
    fb.setDots(ex.dots);
    const pp = new Player(fb, {});
    const bestEl = h('span', { class: 'pill ok' }, `أفضل سرعة: ${store.best(lid) || '—'}`);
    const bpmSlider = slider('السرعة', 40, 200, 1, bpm, v => { bpm = v; }, v => `${v} BPM`);
    const playBtn = h('button', { class: 'btn primary' }, icon('play'), 'ابدأ');
    let running = false;
    const rh = pr.rhythm ? RHYTHMS[pr.rhythm] : null;
    async function run() {
      running = true;
      playBtn.innerHTML = ''; playBtn.append(icon('stop'), 'أوقف');
      while (running && !sess.aborted) {
        const ok = await pp.play(ex, bpm, {
          metronome: metro, countIn: true,
          drone: pr.drone ? droneFor(ex) : null,
          rhythm: rh ? { pattern: rh.pattern, slot: rh.slot } : null,
        });
        store.tickPractice();
        if (!ok || !loop) break;
        if (autoUp) { cleanCount++; if (cleanCount % 3 === 0 && bpm < 200) { bpm = Math.min(200, bpm + 5); bpmSlider.querySelector('input').value = bpm; bpmSlider.querySelector('output').textContent = `${bpm} BPM`; toast(`السرعة ${bpm}`); } }
      }
      running = false;
      playBtn.innerHTML = ''; playBtn.append(icon('play'), 'ابدأ');
    }
    playBtn.addEventListener('click', () => { if (running) { running = false; pp.stop(); } else run(); });
    const recBtn = h('button', { class: 'btn' }, icon('check'), 'عزفته نظيفاً بهذه السرعة');
    recBtn.addEventListener('click', () => {
      if (store.setBest(lid, bpm)) { bestEl.textContent = `أفضل سرعة: ${bpm}`; toast(bpm >= pr.target ? 'ممتاز! وصلت للهدف 🎉' : 'سُجّلت. ارفع 5 نبضات في المرة القادمة.'); }
      else toast('سجلك الأفضل أعلى من هذا.');
    });
    sec.append(bpmSlider,
      h('div', { class: 'row', style: { margin: '6px 0' } },
        toggle('المترونوم', metro, v => { metro = v; }), toggle('تكرار', loop, v => { loop = v; }), toggle('رفع السرعة تلقائياً', autoUp, v => { autoUp = v; })),
      h('div', { class: 'row' }, playBtn, recBtn, bestEl));
    app.append(sec);
    sess.halts.push(() => { running = false; pp.stop(); });
  }

  if (lesson.link) app.append(h('a', { class: 'btn', href: lesson.link.route, style: { marginBottom: '12px', width: '100%' } }, lesson.link.label));

  // ===== الاختبار =====
  if (lesson.quiz && lesson.quiz.length) {
    const qsec = h('section', { class: 'card' }, h('h3', {}, isExam ? 'أسئلة الاختبار' : 'اختبر فهمك'));
    let answered = 0, right = 0;
    const scoreEl = h('div', { class: 'muted' });
    lesson.quiz.forEach((q0, qi) => {
      const q = shuffleQuiz(q0);
      const box = h('div', { class: 'quiz-q' }, h('div', {}, h('b', {}, `${qi + 1}. `), q.q));
      const opts = h('div', { class: 'opts' });
      const exEl = h('div', { class: 'ex' });
      let done = false;
      q.o.forEach((o, oi) => {
        const b = h('button', {}, o);
        b.addEventListener('click', () => {
          if (done) return;
          done = true; answered++;
          if (oi === q.a) { b.classList.add('right'); right++; }
          else { b.classList.add('wrong'); opts.children[q.a].classList.add('right'); }
          exEl.textContent = q.e || '';
          scoreEl.textContent = `النتيجة: ${right} من ${lesson.quiz.length}`;
          if (answered === lesson.quiz.length) store.setQuiz(lid, Math.round(100 * right / lesson.quiz.length));
        });
        opts.append(b);
      });
      box.append(opts, exEl);
      qsec.append(box);
    });
    qsec.append(scoreEl);
    app.append(qsec);
  }

  // ===== قائمة الإتقان =====
  if (lesson.checks && lesson.checks.length) {
    const ck = store.checks(lid);
    const csec = h('section', { class: 'card checklist' }, h('h3', {}, isExam ? 'شروط العبور' : 'قائمة الإتقان'));
    lesson.checks.forEach((c, i) => {
      const inp = h('input', { type: 'checkbox', checked: ck[i] ? true : null });
      inp.addEventListener('change', () => store.setCheck(lid, i, inp.checked));
      csec.append(h('label', {}, inp, h('span', {}, c)));
    });
    app.append(csec);
  }

  // ===== الإنهاء والتنقل =====
  const doneBtn = h('button', { class: 'btn primary', style: { width: '100%' } }, icon('check'), isExam ? 'اجتزت الاختبار' : (store.isDone(lid) ? 'تم إنهاء الدرس ✓' : 'أنهيت الدرس'));
  doneBtn.addEventListener('click', () => {
    if (isExam) {
      const ck = store.checks(lid);
      const allChecked = lesson.checks.every((_, i) => ck[i]);
      if (!allChecked) { toast('علّم على كل شروط العبور أولاً.'); return; }
      store.setExam(levelN, true);
      toast('مبروك! فُتح المستوى التالي 🎉');
      location.hash = '#/levels';
      return;
    }
    store.markDone(lid);
    store.tickPractice();
    const nx = nextLesson(lid);
    toast('أحسنت!');
    if (nx && nx.level === lesson.level) location.hash = `#/lesson/${nx.id}`;
    else location.hash = `#/exam/${lesson.level}`;
  });
  app.append(doneBtn);
  if (!isExam) {
    const pv = prevLesson(lid), nx = nextLesson(lid);
    app.append(h('div', { class: 'row between', style: { marginTop: '10px' } },
      pv ? h('a', { class: 'btn small', href: `#/lesson/${pv.id}` }, `→ ${pv.title}`) : h('span'),
      nx ? h('a', { class: 'btn small', href: `#/lesson/${nx.id}` }, `${nx.title} ←`) : h('span')));
  }
}

// خلط الخيارات بترتيب ثابت لكل سؤال (إلا القوائم المرتبة بطبيعتها)
const ORDERED = /^(نعم|لا|الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|\d+)$/;
function shuffleQuiz(q) {
  if (q.o.length < 3 || q.o.every(o => ORDERED.test(o))) return q;
  let seed = [...q.q].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const idx = q.o.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { seed = (seed * 1103515245 + 12345) >>> 0; const j = seed % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { ...q, o: idx.map(i => q.o[i]), a: idx.indexOf(q.a) };
}

export function rhythmStrip(id) {
  const r = RHYTHMS[id];
  if (!r) return h('div');
  return h('div', { class: 'card', style: { marginTop: '8px' } },
    h('div', { class: 'row between' }, h('b', {}, `إيقاع ${r.name}`), h('span', { class: 'pill' }, r.meter)),
    h('div', { class: 'beats' }, [...r.pattern].map(c => h('div', { class: `beat ${c === '.' ? '' : c}` }, c === 'D' ? 'دُم' : c === 'T' ? 'تَك' : c === 'k' ? 'ك' : '·'))),
    h('div', { class: 'muted', style: { fontSize: '.85rem' } }, r.desc));
}
