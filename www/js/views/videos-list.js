// الدروس بالفيديو: كل الفيديوهات مرتبة بالأرقام للمتابعة درساً بعد درس
import { h } from '../ui.js';
import { LEVELS } from '../lessons/index.js';
import { openLessonVideo, watchedSet } from './lesson.js';

export function renderVideoList(app) {
  const list = [];
  LEVELS.forEach(lv => lv.units.forEach(u => u.lessons.forEach(l => list.push({ l, lv }))));
  app.append(h('div', { class: 'topbar' }, h('h1', {}, '🎬 الدروس بالفيديو')));
  const host = h('div');
  app.append(host);
  const play = i => {
    if (i < 0 || i >= list.length) return;
    openLessonVideo(list[i].l, {
      onEnded: () => { draw(); },
      onNext: i + 1 < list.length ? () => { draw(); play(i + 1); } : null,
      onPrev: i > 0 ? () => { draw(); play(i - 1); } : null,
    });
  };
  function draw() {
    const w = watchedSet();
    host.innerHTML = '';
    const next = list.findIndex(x => !w.has(x.l.id));
    host.append(h('div', { class: 'card', style: { marginBottom: '12px' } },
      h('p', { class: 'muted', style: { margin: '0 0 8px', fontSize: '.88rem' } }, `شاهدت ${w.size} من ${list.length} فيديو. كل فيديو يشتغل بدون إنترنت.`),
      next >= 0 ? h('button', { class: 'btn primary', style: { width: '100%' }, onclick: () => play(next) }, `▶ كمّل من الفيديو ${next + 1}: ${list[next].l.title}`) : h('b', {}, '✓ شاهدت كل الفيديوهات')));
    let lastLv = null;
    list.forEach((x, i) => {
      if (x.lv !== lastLv) { lastLv = x.lv; host.append(h('h3', { style: { margin: '16px 4px 8px', color: 'var(--accent)' } }, `المستوى ${x.lv.n}: ${x.lv.title}`)); }
      const seen = w.has(x.l.id);
      host.append(h('button', { class: 'vrow' + (seen ? ' seen' : ''), onclick: () => play(i) },
        h('span', { class: 'vnum' }, String(i + 1)),
        h('span', { class: 'vtitle' }, x.l.title),
        h('span', { class: 'vmark' }, seen ? '✓' : '▶')));
    });
  }
  draw();
}
