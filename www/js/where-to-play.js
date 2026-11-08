// «من وين أعزف؟»: نفس صندوق المقام اللي في الدرس، منقولاً لقرار الأغنية.
// نأخذ شكل الصندوق من درس المقام (وتر القرار ومدى الفرتات حوله) ونحرّكه.
import { h, card } from './ui.js';
import { Fretboard } from './fretboard.js';
import { Player } from './player.js';
import { buildExercise } from './exercises.js';
import { MAQAMAT, OPEN_STRINGS, noteName } from './theory.js';
import { ALL } from './lessons/index.js';

const STRING_NAME = ['السادس (الغليظ)', 'الخامس', 'الرابع', 'الثالث', 'الثاني', 'الأول (الرفيع)'];

export function lessonBox(maqamId) {
  const ls = ALL.find(l => l.title === MAQAMAT[maqamId]?.name);
  const st = ls && ls.steps.find(s => s.ex && s.ex.type === 'window');
  if (!st) return null;
  const ex = buildExercise({ ...st.ex });
  const root = ex.dots.filter(d => d.kind === 'root').sort((a, b) => a.s - b.s)[0];
  if (!root) return null;
  return { lesson: ls, s: root.s, fret: root.f, qt: !!root.qt, fromOff: st.ex.from - root.f, toOff: st.ex.to - root.f };
}

// tonicQ: ارتفاع القرار بأرباع التون (مثل نتيجة المحلل)
export function whereToPlay(maqamId, tonicQ) {
  const box = lessonBox(maqamId);
  if (!box) return null;
  const pc = Math.floor(tonicQ / 2) % 12, quarter = tonicQ % 2 === 1;
  const rel = (((pc * 2 + (quarter ? 1 : 0)) - OPEN_STRINGS[box.s] * 2) % 24 + 24) % 24;
  let fret = Math.floor(rel / 2);
  const qt = rel % 2 === 1;
  if (fret + box.fromOff < 1) fret += 12; // نتجنب الأوتار المطلقة حتى يبقى الشكل نفسه
  const from = fret + box.fromOff, to = fret + box.toOff;
  const ex = buildExercise({ type: 'window', scale: maqamId, root: pc, rootQuarter: quarter, from, to, label: 'note', dir: 'updown', bpm: 80 });
  return { ...box, fret, qt, from, to, ex, pc, quarter, sameAsLesson: fret === box.fret || fret === box.fret + 12 };
}

export function whereToPlayCard(maqamId, tonicQ) {
  const w = whereToPlay(maqamId, tonicQ);
  if (!w) return null;
  const name = MAQAMAT[maqamId].name.replace('مقام ', '');
  const fretTxt = `الفرت ${w.fret}${w.qt ? ' مع ربع تون (بِند خفيف)' : ''}`;
  const host = h('div', { style: { marginTop: '8px' } });
  const fb = new Fretboard(host, { from: Math.max(0, w.from - 1), to: w.to + 1 });
  fb.setDots(w.ex.dots);
  const player = new Player(fb, { metronome: false, countIn: false });
  let playing = false;
  const btn = h('button', { class: 'btn small' }, '▶ اسمع الصندوق');
  btn.addEventListener('click', async () => {
    if (playing) { player.stop(); return; }
    playing = true; btn.textContent = '■ إيقاف';
    await player.play(w.ex, 90, {});
    playing = false; btn.textContent = '▶ اسمع الصندوق';
  });
  const fromLesson = w.sameAsLesson ? 'نفس المكان اللي في الدرس.' : `نفس شكل الدرس بالضبط، بس حرّكه من الفرت ${lessonBox(maqamId).fret} إلى الفرت ${w.fret}.`;
  return card(null,
    h('h3', { style: { margin: '0 0 6px' } }, '🎸 من وين تعزف مع هذي الأغنية؟'),
    h('p', { style: { fontSize: '1.05rem', margin: '0 0 4px' } }, 'حط إصبعك على ', h('b', {}, fretTxt), ' في ', h('b', {}, `الوتر ${STRING_NAME[w.s]}`), '، واعزف ', h('b', {}, `صندوق ${name}`), '.'),
    h('p', { class: 'muted', style: { fontSize: '.85rem', margin: 0 } }, `القرار هنا ${noteName(tonicQ)} (النقطة الحمراء). ${fromLesson}`),
    host,
    h('div', { class: 'row', style: { marginTop: '6px' } }, btn, h('a', { class: 'btn small', href: `#/lesson/${w.lesson.id}` }, '📘 درس الصندوق')));
}
