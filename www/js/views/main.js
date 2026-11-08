// الرئيسية، المستويات، قائمة دروس المستوى، التقدم، اللجنة
import { h, icon, card } from '../ui.js';
import * as store from '../store.js';
import { LEVELS, ALL, TOTAL, lessonById, levelLessons } from '../lessons/index.js';

function levelProgress(n) {
  const ls = levelLessons(n);
  const done = ls.filter(l => store.isDone(l.id)).length;
  return { done, total: ls.length, pct: ls.length ? Math.round(100 * done / ls.length) : 0 };
}

export function isUnlocked(n) {
  if (n === 1 || store.settings().unlockAll) return true;
  return store.examPassed(n - 1);
}

export function renderHome(app) {
  const p = store.progress();
  const doneCount = Object.keys(p.done).length;
  const last = p.last && lessonById(p.last);
  const next = last ? (store.isDone(last.id) ? ALL[ALL.indexOf(last) + 1] || last : last) : ALL[0];
  app.append(h('div', { class: 'hero' },
    h('h1', {}, 'أكاديمية الجيتار'),
    h('p', { style: { opacity: '.85', margin: 0 } }, 'السلالم والمقامات من المبتدئ إلى عزف أي أغنية، بإشراف لجنة: عازف محترف، مايسترو، ومدرس موسيقى.'),
    h('div', { class: 'stat' },
      h('div', {}, h('b', {}, `${doneCount}/${TOTAL}`), 'درس منجز'),
      h('div', {}, h('b', {}, p.minutes), 'دقيقة تمرين'),
      h('div', {}, h('b', {}, store.streak()), 'أيام متتالية'))));
  if (next) {
    app.append(h('a', { class: 'card hl', href: `#/lesson/${next.id}`, style: { display: 'block', color: 'inherit' } },
      h('div', { class: 'muted', style: { fontSize: '.8rem' } }, last ? 'تابع من حيث توقفت' : 'ابدأ رحلتك'),
      h('h2', { style: { margin: '2px 0' } }, next.title),
      h('div', { class: 'muted', style: { fontSize: '.85rem' } }, `المستوى ${next.level} · ${next.unit}`),
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('span', { class: 'btn primary small' }, icon('play'), 'افتح الدرس'))));
  }
  app.append(h('a', { class: 'card', href: '#/analyzer', style: { display: 'flex', gap: '12px', alignItems: 'center', color: 'inherit' } },
    h('span', { style: { fontSize: '2rem' } }, '🔍'),
    h('div', {}, h('b', {}, 'محلل المقام — جديد'), h('div', { class: 'muted', style: { fontSize: '.85rem' } }, 'ارفع أغنية أو جزءاً منها، واعرف مقامها وقرارها مع الدليل.'))));
  app.append(h('h2', {}, 'المستويات'));
  for (const lv of LEVELS) app.append(levelCard(lv));
  app.append(h('h2', { style: { marginTop: '18px' } }, 'الأدوات'));
  app.append(toolsGrid());
  app.append(h('a', { class: 'card', href: '#/committee', style: { display: 'block', color: 'inherit', marginTop: '12px' } },
    h('h3', {}, 'محضر اللجنة'), h('p', { class: 'muted', style: { margin: 0 } }, 'كيف نظّم العازف والمايسترو والمدرس هذا البرنامج، ولماذا.')));
}

function levelCard(lv) {
  const pr = levelProgress(lv.n);
  const open = isUnlocked(lv.n);
  return h('a', { class: 'card level', href: open ? `#/level/${lv.n}` : `#/level/${lv.n}` },
    h('div', { class: 'num' }, open ? lv.n : icon('lock')),
    h('div', { style: { flex: 1 } },
      h('div', { class: 'row between' }, h('b', {}, lv.title), h('span', { class: 'pill' }, lv.months)),
      h('div', { class: 'muted', style: { fontSize: '.85rem', margin: '2px 0 6px' } }, lv.desc),
      h('div', { class: 'bar' }, h('i', { style: { width: `${pr.pct}%` } })),
      h('div', { class: 'muted', style: { fontSize: '.75rem', marginTop: '3px' } }, `${pr.done} من ${pr.total} درس`, store.examPassed(lv.n) ? ' · اجتزت الاختبار ✓' : '')));
}

export function toolsGrid() {
  const tools = [
    ['#/videos', '🎬', 'الدروس بالفيديو', 'كل الفيديوهات بالترتيب'],
    ['#/analyzer', '🔍', 'محلل المقام', 'ارفع أغنية واعرف مقامها'],
    ['#/songbook', '📒', 'مرجع الأغاني', 'أغانيك حسب الفنان مع البحث'],
    ['#/explore', '🗺️', 'مستكشف السلالم والمقامات', 'أي سلم أو مقام على الرقبة'],
    ['#/chords', '🎹', 'مكتبة الكوردات', 'كل الأنواع لكل القرارات'],
    ['#/tuner', '🎯', 'الدوزان', 'بالمايكروفون مع السنت'],
    ['#/rhythm', '🥁', 'المترونوم والإيقاعات', 'مقسوم، بلدي، سماعي…'],
    ['#/ear', '👂', 'تدريب الأذن', 'فواصل، كوردات، مقامات'],
    ['#/songs', '🎵', 'أدوات الأغاني', 'المفتاح، النقل، الكابو'],
    ['#/reference', '📚', 'المرجع', 'المصطلحات والجداول'],
    ['#/progress', '📈', 'تقدمي', 'الدروس والدقائق'],
  ];
  return h('div', { class: 'grid' }, tools.map(([href, e, t, d]) => h('a', { class: 'tile', href }, h('span', { class: 'big' }, e), h('b', {}, t), h('small', {}, d))));
}

export function renderLevels(app) {
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'الدروس')));
  for (const lv of LEVELS) app.append(levelCard(lv));
}

export function renderLevel(app, n) {
  const lv = LEVELS.find(l => l.n === +n);
  if (!lv) return;
  app.append(h('div', { class: 'topbar' }, h('button', { class: 'back', onclick: () => { location.hash = '#/levels'; } }, '→'), h('h1', {}, `المستوى ${lv.n}: ${lv.title}`)));
  if (!isUnlocked(lv.n)) {
    app.append(card(null, h('p', {}, `هذا المستوى مقفل حتى تجتاز اختبار المستوى ${lv.n - 1}. قاعدة المدرس: لا ننتقل قبل إتقان ما قبله.`),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: `#/exam/${lv.n - 1}` }, 'اذهب للاختبار'),
        h('button', { class: 'btn', onclick: () => { store.setSetting('unlockAll', true); location.reload(); } }, 'عندي خبرة: افتح كل المستويات'))));
  }
  app.append(h('p', { class: 'muted' }, lv.desc));
  lv.units.forEach((u, ui) => {
    const c = card(`${ui + 1}. ${u.title}`);
    u.lessons.forEach(ls => {
      const done = store.isDone(ls.id);
      const hasQ = store.progress().quiz[ls.id];
      c.append(h('a', { class: `lesson-item${done ? ' done' : ''}`, href: `#/lesson/${ls.id}` },
        h('span', { class: 'st' }, done ? '✓' : ls.id.split('-')[1]),
        h('span', { class: 't' }, ls.title, h('small', {}, ls.goal)),
        hasQ ? h('span', { class: 'pill' }, `${hasQ}%`) : null));
    });
    app.append(c);
  });
  app.append(h('a', { class: 'card hl', href: `#/exam/${lv.n}`, style: { display: 'block', color: 'inherit' } },
    h('h3', {}, lv.exam.title), h('p', { class: 'muted', style: { margin: 0 } }, store.examPassed(lv.n) ? 'اجتزته ✓' : 'اختبار عملي ونظري لفتح المستوى التالي.')));
}

export function renderProgress(app) {
  const p = store.progress();
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'تقدمي')));
  app.append(card(null, h('div', { class: 'stat' },
    h('div', {}, h('b', {}, `${Object.keys(p.done).length}/${TOTAL}`), 'درس'),
    h('div', {}, h('b', {}, p.minutes), 'دقيقة'),
    h('div', {}, h('b', {}, store.streak()), 'يوم متتالٍ'))));
  // آخر 14 يوماً
  const days = [];
  const d = new Date();
  for (let i = 13; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); const k = x.toISOString().slice(0, 10); days.push([k, p.days[k] || 0]); }
  const max = Math.max(30, ...days.map(x => x[1]));
  app.append(card('دقائق التمرين: آخر 14 يوماً', h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '110px', direction: 'ltr' } },
    days.map(([k, v]) => h('div', { title: `${k}: ${v} د`, style: { flex: 1, height: `${Math.max(3, 100 * v / max)}%`, background: v ? 'var(--accent)' : 'var(--line)', borderRadius: '4px 4px 0 0' } }))),
    h('div', { class: 'muted', style: { fontSize: '.78rem', marginTop: '6px' } }, 'روتين اللجنة: 60 دقيقة يومياً = 10 إحماء، 15 جديد، 10 مراجعة، 10 أذن، 15 أغنية.')));
  for (const lv of LEVELS) {
    const ls = levelLessons(lv.n);
    const done = ls.filter(l => store.isDone(l.id)).length;
    app.append(card(`المستوى ${lv.n}: ${lv.title}`, h('div', { class: 'bar' }, h('i', { style: { width: `${100 * done / ls.length}%` } })),
      h('div', { class: 'muted', style: { fontSize: '.8rem', marginTop: '4px' } }, `${done} من ${ls.length}`, store.examPassed(lv.n) ? ' · الاختبار ✓' : '')));
  }
  const bests = Object.entries(p.bestBpm);
  if (bests.length) app.append(card('أعلى سرعة نظيفة', h('table', { class: 't' }, h('tr', {}, h('th', {}, 'الدرس'), h('th', {}, 'BPM')),
    bests.map(([id, b]) => h('tr', {}, h('td', {}, lessonById(id)?.title || id), h('td', {}, b))))));
}

export function renderCommittee(app) {
  app.append(h('div', { class: 'topbar' }, h('button', { class: 'back', onclick: () => history.back() }, '→'), h('h1', {}, 'محضر اللجنة')));
  const members = [
    ['🎸', 'العازف المحترف', 'الرقبة والتقنية وأشكال الأصابع وما يحدث فعلياً تحت اليد.', 'السلم ليس ورقة، بل خريطة تحت أصابعك. إذا لم تره على الرقبة كاملةً فأنت لا تعرفه.'],
    ['🎼', 'المايسترو', 'النظرية والهارموني والمقامات وربط كل سلم بالكوردات والأذن.', 'كل كورد يولد من سلم، وكل لحن يسكن مقاماً. من لا يفهم هذا يحفظ الأغاني ولا يعزفها.'],
    ['📘', 'مدرس الموسيقى', 'ترتيب المنهج والتدرج والاختبارات وأسلوب الشرح.', 'المبتدئ يحتاج أن يسمع ويرى ويعزف في نفس الدقيقة. ولا ننتقل لمستوى قبل إتقان ما قبله.'],
    ['💻', 'المبرمج', 'حوّل قرارات الثلاثة إلى هذا التطبيق.', 'ما لا يُقاس لا يتحسن: لذلك يسجل التطبيق سرعتك ودقائقك ونتائجك.'],
  ];
  for (const [e, n, role, q] of members) app.append(h('div', { class: 'voice', style: { marginBottom: '8px' } }, h('div', { class: 'av' }, e), h('div', {}, h('b', {}, n), h('p', {}, role), h('p', { class: 'muted' }, `«${q}»`))));
  app.append(card('بنية كل درس',
    h('ol', {}, ['الهدف: ماذا ستستطيع بعد الدرس', 'الشرح المسموع بالعربي والنص ظاهر', 'العرض المتحرك على الرقبة مع صوت الجيتار', 'التمرين مع المترونوم من البطيء للسريع', 'اختبار قصير', 'قائمة إتقان قبل الانتقال'].map(x => h('li', {}, x)))));
  app.append(card('قواعد اللجنة',
    h('ol', {}, ['كل سلم يُتعلم بالأصابع والأذن والعقل معاً', 'لا يُحفظ سلم دون عزف لحن عليه في نفس الأسبوع', 'المترونوم إلزامي: +5 نبضات بعد 3 محاولات نظيفة', 'الأذن تُدرَّب 10 دقائق يومياً من أول يوم', 'كل مستوى ينتهي باختبار عبور عملي'].map(x => h('li', {}, x)))));
  app.append(card('المنهج',
    h('table', { class: 't' }, h('tr', {}, h('th', {}, 'المستوى'), h('th', {}, 'المدة'), h('th', {}, 'المحاور')),
      LEVELS.map(l => h('tr', {}, h('td', {}, `${l.n}. ${l.title}`), h('td', {}, l.months), h('td', {}, l.desc))))));
  app.append(card('منهجية عزف أي أغنية',
    h('ol', {}, ['استمع 3 مرات دون جيتار وحدد الأجزاء والإيقاع', 'أوجد القرار', 'حدد اللون: كبير، صغير، أو مقام', 'اكتب كوردات السلم السبعة', 'استخرج التقدم من الباص', 'التقط اللحن جملة جملة', 'انقل لمفتاح يناسب الصوت', 'أضف بصمتك: مقدمة أو لازمة أو تقسيم'].map(x => h('li', {}, x)))));
  app.append(card('ملاحظة المبرمج عن الفيديو',
    h('p', {}, 'الشرح في هذا الإصدار عرض متحرك متزامن مع صوت الجيتار وشرح عربي مسموع، ويمكن إبطاؤه وإعادته وتغيير طريقة عرض النوتات. «وضع المشاهدة» يشغّل الدرس كاملاً تلقائياً كالفيديو. التطبيق مصمم لاستقبال مقاطع فيديو مصورة لكل درس في إصدارات لاحقة.')));
}
