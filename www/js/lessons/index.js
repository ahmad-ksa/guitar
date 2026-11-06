import l1 from './l1.js';
import l2 from './l2.js';
import l3 from './l3.js';
import l4 from './l4.js';
import l5 from './l5.js';

export const LEVELS = [l1, l2, l3, l4, l5];

// فهرس مسطح للدروس مع الموضع
export const ALL = [];
for (const lv of LEVELS) {
  lv.units.forEach((u, ui) => u.lessons.forEach(ls => { ls.level = lv.n; ls.unit = u.title; ALL.push(ls); }));
  lv.exam.id = `exam-${lv.n}`;
  lv.exam.level = lv.n;
}

export function lessonById(id) { return ALL.find(l => l.id === id); }
export function nextLesson(id) { const i = ALL.findIndex(l => l.id === id); return i >= 0 ? ALL[i + 1] : null; }
export function prevLesson(id) { const i = ALL.findIndex(l => l.id === id); return i > 0 ? ALL[i - 1] : null; }
export function levelLessons(n) { return ALL.filter(l => l.level === n); }
export const TOTAL = ALL.length;
