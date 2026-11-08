// مولّدات الدروس المتكررة (المودات، الصناديق، المقامات) لتوحيد الأسلوب
import { MAQAMAT, AJNAS, SCALES, NOTE_ARABIC, stepsToOffsets, noteName, spelledName, OPEN_STRINGS } from '../theory.js';
import { windowPattern } from '../exercises.js';

export const AR = NOTE_ARABIC;

// يبني جملة لحنية من أرقام درجات (0 = القرار، 7 = الأوكتاف، سالب = تحت القرار)
// degrees: [[deg, beats], ...]
export function phrase(scaleId, root, from, to, degrees, opts = {}) {
  const ps = windowPattern(scaleId, root, from, to, opts);
  const r = ps.findIndex(p => p.deg === 0);
  const notes = [];
  for (const [d, beats] of degrees) {
    const p = ps[r + d];
    if (!p) continue;
    notes.push([p.s, p.f, p.qt, { dur: beats, deg: p.deg }]);
  }
  return { type: 'notes', notes, scale: scaleId, root, label: 'note' };
}

// أسماء نوتات المقام بالعربي
export function noteList(scaleId, root, rootQuarter = false, dir = 'asc') {
  const s = MAQAMAT[scaleId] || SCALES[scaleId];
  const steps = dir === 'desc' && s.dsc ? s.dsc : (s.asc || s.steps);
  const off = stepsToOffsets(steps);
  const base = (48 + root) * 2 + (rootQuarter ? 1 : 0);
  return [...off, 24].map((o, i) => (off.length === 7 ? spelledName(base + o, root, i % 7, 'ar') : noteName(base + o, 'ar'))).join('، ');
}

const stepWord = q => ({ 1: 'ربع تون', 2: 'نصف تون', 3: 'ثلاثة أرباع التون', 4: 'تون', 6: 'تون ونصف' }[q] || `${q / 4} تون`);
export function stepsText(steps) { return steps.map(stepWord).join('، '); }

// ======== درس صندوق بنتاتونيك ========
export function pentBoxLesson(n, extra = {}) {
  const tips = [
    'هذا هو الصندوق الأشهر. القرار تحت إصبعك الأول على الوتر السادس والرابع والأول.',
    'يبدأ من الدرجة الثالثة المخفوضة. لاحظ كيف يلتصق بالصندوق الأول من جهة اليمين.',
    'يبدأ من الرابعة. على الوتر الثاني تتحرك النوتات فرتاً واحداً لأن دوزان وتر سي مختلف.',
    'يبدأ من الخامسة، وهو صندوق مريح للبِند على الوترين الثاني والثالث.',
    'يبدأ من السابعة المخفوضة، ويُغلق الدائرة ليعود بك إلى الصندوق الأول بعد أوكتاف.',
  ];
  return {
    id: `2-0${n}`,
    title: `البنتاتونيك الصغير: الصندوق ${n}`,
    goal: `تعزف الصندوق ${n} من لا الصغير صعوداً ونزولاً دون النظر، وتعرف مكان القرار فيه.`,
    minutes: 20,
    voices: {
      pro: tips[n - 1],
      maestro: 'الصناديق الخمسة ليست خمسة سلالم، بل نفس النوتات الخمس (لا، دو، ري، مي، صول) موزعة على مناطق الرقبة.',
      teacher: 'احفظ الصندوق بالأصابع أولاً ثم قل اسم كل قرار تمر عليه بصوت عالٍ.',
    },
    steps: [
      { say: `انظر إلى الصندوق ${n}. النقاط الملونة بلون مختلف هي القرار: نوتة لا. ${tips[n - 1]}`, ex: { type: 'nps', scale: 'minorPent', root: 9, nps: 2, box: n - 1, label: 'degree', dir: 'up', sub: 2, bpm: 70 } },
      { say: 'الآن بأرقام الأصابع. نوتتان على كل وتر. اعزف ببطء، ريشة تحت ثم فوق بالتبادل.', ex: { type: 'nps', scale: 'minorPent', root: 9, nps: 2, box: n - 1, label: 'finger', dir: 'updown', sub: 2, bpm: 70 } },
      { say: 'وأخيراً بأسماء النوتات. ردد الاسم مع كل نوتة، فهذا ما يحول الشكل إلى معرفة.', ex: { type: 'nps', scale: 'minorPent', root: 9, nps: 2, box: n - 1, label: 'note', dir: 'updown', sub: 2, bpm: 80 } },
    ],
    practice: { ex: { type: 'nps', scale: 'minorPent', root: 9, nps: 2, box: n - 1, label: 'finger', dir: 'updown', sub: 2 }, bpm: 60, target: 120 },
    quiz: [
      { q: `كم نوتة على كل وتر في صناديق البنتاتونيك؟`, o: ['نوتة واحدة', 'نوتتان', 'ثلاث نوتات'], a: 1, e: 'البنتاتونيك خمس نوتات، وكل صندوق يضع نوتتين على كل وتر.' },
      { q: 'نوتات لا الصغير البنتاتونيك هي:', o: ['لا، دو، ري، مي، صول', 'لا، سي، دو، ري، مي', 'لا، دو#، مي، فا#، صول'], a: 0, e: 'الدرجات: 1، الثالثة المخفوضة، 4، 5، السابعة المخفوضة.' },
    ],
    checks: ['أعزف الصندوق صعوداً ونزولاً دون أخطاء على 80 نبضة', 'أعرف مكان كل قرار داخل الصندوق', 'أستطيع الارتجال قليلاً داخل الصندوق'],
    ...extra,
  };
}

// ======== درس مود ========
const MODE_INFO = {
  ionian:     { id: 'major',      deg: 1, char: 'الرابعة والسابعة الكبيرة', chord: 'maj7', feel: 'مشرق ومستقر', where: 'البوب وأغاني الفرح', root: 0, tip: 'هو السلم الكبير نفسه، ونقطة المقارنة لكل المودات.' },
  dorian:     { id: 'dorian',     deg: 2, char: 'السادسة الكبيرة فوق ثالثة صغيرة', chord: 'm7', feel: 'صغير لكنه دافئ وغير حزين', where: 'الفانك والجاز والروك', root: 2, tip: 'جرب العزف على كوردي Dm7 ثم G مرة بعد مرة: هذا صوت الدوريان.' },
  phrygian:   { id: 'phrygian',   deg: 3, char: 'الثانية المخفوضة', chord: 'm', feel: 'قاتم وشرقي', where: 'الفلامنكو والميتال، ويقابل مقام الكرد', root: 4, tip: 'النصف تون بين القرار والثانية هو كل شيء هنا.' },
  lydian:     { id: 'lydian',     deg: 4, char: 'الرابعة المرفوعة', chord: 'maj7#11', feel: 'حالم ومعلق', where: 'موسيقى الأفلام', root: 5, tip: 'اعزف على كوردي F ثم G فوق باص فا لتسمع الطفو.' },
  mixolydian: { id: 'mixolydian', deg: 5, char: 'السابعة المخفوضة فوق ثالثة كبيرة', chord: '7', feel: 'كبير بلمسة بلوز', where: 'الروك والكانتري والفولك', root: 7, tip: 'تقدم G ثم F ثم C ثم G يعطيك صوت الميكسوليديان فوراً.' },
  aeolian:    { id: 'minor',      deg: 6, char: 'السادسة المخفوضة', chord: 'm7', feel: 'حزين', where: 'البالاد والروك، ويقارب النهاوند نزولاً', root: 9, tip: 'هو السلم الصغير الطبيعي. تقدم Am ثم F ثم G يكشف لونه.' },
  locrian:    { id: 'locrian',    deg: 7, char: 'الخامسة المخفوضة', chord: 'm7b5', feel: 'متوتر وغير مستقر', where: 'الميتال الثقيل والجاز', root: 11, tip: 'نادر الاستعمال لأن قراره نفسه غير مستقر.' },
};
export const MODE_AR = { ionian: 'أيونيان', dorian: 'دوريان', phrygian: 'فريجيان', lydian: 'ليديان', mixolydian: 'ميكسوليديان', aeolian: 'أيوليان', locrian: 'لوكريان' };

export function modeLesson(key, idx) {
  const m = MODE_INFO[key];
  const name = MODE_AR[key];
  const sc = SCALES[m.id];
  const r = m.root;
  const ordinal = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة'][m.deg - 1];
  const win = [[2, 6], [4, 8], [6, 10], [0, 4], [2, 6], [4, 8], [6, 10]][idx];
  return {
    id: `3-0${idx + 2}`,
    title: `مود ${name}`,
    goal: `تسمع لون ${name} وتعرف نوتته المميزة (${m.char}) وترتجل عليه فوق درون.`,
    minutes: 25,
    voices: {
      maestro: `${name} هو السلم الكبير مبتدئاً من الدرجة ${ordinal}. لونه ${m.feel}، ونوتته المميزة: ${m.char}. يُستخدم في ${m.where}.`,
      pro: m.tip,
      teacher: 'لا تفكر فيه كسلم دو الكبير من مكان آخر. اعزفه فوق القرار الخاص به ليظهر لونه الحقيقي.',
    },
    steps: [
      { say: `مود ${name} من ${AR[r]}: نفس نوتات دو الكبير، لكن القرار الآن ${AR[r]}. المسافات: ${stepsText(sc.steps)}.`, ex: { type: 'window', scale: m.id, root: r, from: win[0], to: win[1], label: 'degree', dir: 'up', sub: 2, bpm: 70 } },
      { say: `استمع إلى النوتة المميزة: ${m.char}. سأعزف السلم فوق درون ${AR[r]} حتى تسمع اللون.`, ex: { type: 'window', scale: m.id, root: r, from: win[0], to: win[1], label: 'note', dir: 'updown', sub: 2, bpm: 80 }, drone: true },
      { say: `الآن نفس المود من قرار لا لتقارنه بغيره: كل المودات من نفس القرار تكشف الفرق.`, ex: { type: 'nps', scale: m.id, root: 9, nps: 3, box: 0, label: 'degree', dir: 'updown', sub: 3, bpm: 70 }, drone: true },
    ],
    practice: { ex: { type: 'nps', scale: m.id, root: 9, nps: 3, box: 0, label: 'finger', dir: 'updown', sub: 3 }, bpm: 60, target: 110, drone: true },
    quiz: [
      { q: `${name} يبدأ من أي درجة في السلم الكبير؟`, o: ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة'], a: m.deg - 1, e: `${name} = الدرجة ${ordinal}.` },
      { q: `ما النوتة المميزة لمود ${name}؟`, o: shuffleFixed([m.char, ...Object.values(MODE_INFO).filter(x => x !== m).slice(0, 2).map(x => x.char)], m.deg), a: null, e: `المميز في ${name}: ${m.char}.` },
    ].map(q => (q.a == null ? { ...q, a: q.o.indexOf(m.char) } : q)),
    checks: [`أعزف ${name} من قرارين مختلفين`, 'أسمع النوتة المميزة فوق الدرون', `أرتجل دقيقة على ${name}`],
  };
}

function shuffleFixed(arr, seed) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = (seed * 7 + i * 3) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// صعود بالسلم الصاعد ونزول بالنازل (للمقامات التي تتغير نزولاً)
function ascDescEx(id, r, win, rq) {
  const up = phrase(id, r, win[0], win[1], [0, 1, 2, 3, 4, 5, 6, 7].map(d => [d, 0.5]), { rootQuarter: rq });
  const down = phrase(id, r, win[0], win[1], [6, 5, 4, 3, 2, 1, 0].map(d => [d, d === 0 ? 1.5 : 0.5]), { rootQuarter: rq, dir: 'desc' });
  return { type: 'notes', notes: [...up.notes, ...down.notes], scale: id, root: r, label: 'note', bpm: 80 };
}

// ======== درس مقام ========
// win: نافذة الفرتات التي فيها القرار مع نوتات تحته
export function maqamLesson(id, lessonId, win, extra = {}) {
  const m = MAQAMAT[id];
  const r = m.root;
  const rq = !!m.rootQuarter;
  const j1 = AJNAS[m.ajnas[0]];
  const j2 = AJNAS[m.ajnas[1]];
  const gIdx = m.ghammaz; // رقم الدرجة (من 0)
  const asc = noteList(id, r, rq, 'asc');
  const desc = m.dsc ? noteList(id, r, rq, 'desc') : null;
  const ghName = spelledName((48 + r) * 2 + (rq ? 1 : 0) + stepsToOffsets(m.asc)[gIdx], r, gIdx, 'ar');
  const rootName = spelledName((48 + r) * 2 + (rq ? 1 : 0), r, 0, 'ar');
  const q = m.quarter;
  const baseEx = { scale: id, root: r, rootQuarter: rq, from: win[0], to: win[1] };
  const j1len = j1.steps.length; // عدد الأبعاد
  const steps = [
    { say: `${m.name}. ${m.desc}`, ex: { ...baseEx, type: 'window', label: 'note', dir: 'up', sub: 2, bpm: 70 } },
    { say: `يبدأ المقام بـ${j1.name} على القرار ${rootName}: ${j1.desc}`, ex: phrase(id, r, win[0], win[1], [...Array(j1len + 1)].map((_, i) => [i, 1]).concat([[j1len - 1, 1], [0, 2]]), { rootQuarter: rq }) },
    { say: `ثم ${j2.name} يبدأ من الغماز ${ghName}. الغماز هو النوتة التي يرتكز عليها اللحن في منتصف السير.`, ex: phrase(id, r, win[0], win[1], [[gIdx, 1], [gIdx + 1, 1], [gIdx + 2, 1], [Math.min(7, gIdx + 3), 1], [gIdx, 2]], { rootQuarter: rq }) },
    { say: `المقام كاملاً صعوداً: ${asc}.` + (desc ? ` ونزولاً يتغير: ${desc}.` : ''), ex: m.dsc ? ascDescEx(id, r, win, rq) : { ...baseEx, type: 'window', label: 'degree', dir: 'updown', sub: 2, bpm: 80 } },
    { say: 'جملة سير قصيرة: صعود إلى الغماز، استقرار، ثم نزول هادئ إلى القرار. استمع للقفلة في النهاية.', ex: phrase(id, r, win[0], win[1], [[0, 1], [1, 0.5], [2, 0.5], [gIdx, 2], [gIdx + 1, 0.5], [gIdx, 0.5], [gIdx - 1, 1], [2, 1], [1, 1], [0, 3]], { rootQuarter: rq }), drone: true },
  ];
  if (q) steps.splice(1, 0, {
    say: 'في هذا المقام ربع تون. النقاط البرتقالية عليها سهم: اضغط الفرت المكتوب ثم ادفع الوتر قليلاً جداً حتى ترتفع النوتة ربع تون، واستعن بالدوزان لترى 50 سنت.',
    ex: { ...baseEx, type: 'window', label: 'note', dir: 'up', sub: 1, bpm: 60 },
  });
  return {
    id: lessonId,
    title: m.name,
    goal: `تعزف ${m.name} بجنسيه وسيره، وتميزه بالسمع عن المقامات القريبة منه.`,
    minutes: 30,
    voices: {
      maestro: `${m.name} = ${j1.name} على القرار + ${j2.name} على الدرجة ${m.ghammaz + 1}. ${extra.maestro || ''}`.trim(),
      pro: extra.pro || (q ? 'ربع التون على الجيتار يحتاج أذناً قبل الأصابع. ابدأ بغناء النوتة ثم ابحث عنها بالبِند.' : 'هذا المقام يُعزف مباشرة على الجيتار دون بِند، فركّز على الإحساس والزخرفة.'),
      teacher: extra.teacher || 'اعزف المقام فوق الدرون كل يوم أسبوعاً كاملاً، ثم اختبر نفسك في تدريب الأذن.',
    },
    steps,
    practice: { ex: { ...baseEx, type: 'window', label: 'finger', dir: 'updown', sub: 2 }, bpm: 60, target: 110, drone: true, rhythm: extra.rhythm || 'maqsum' },
    quiz: [
      { q: `ما الجنس الأساسي في ${m.name}؟`, o: uniq([j1.name, 'جنس عجم', 'جنس حجاز', 'جنس بياتي', 'جنس راست']).slice(0, 4), a: 0, e: `${m.name} يبدأ بـ${j1.name}.` },
      { q: `على أي درجة يقع الغماز؟`, o: ['الثانية', 'الثالثة', 'الرابعة', 'الخامسة'], a: m.ghammaz - 1, e: `الغماز في ${m.name} على الدرجة ${m.ghammaz + 1} (${ghName}).` },
      { q: `هل يحتوي ${m.name} على ربع تون؟`, o: ['نعم', 'لا'], a: q ? 0 : 1, e: q ? 'نعم، ولذلك نحتاج البِند أو جيتاراً خاصاً.' : 'لا، يُعزف على الجيتار العادي مباشرة.' },
    ],
    checks: [`أعزف ${m.name} صعوداً ونزولاً`, 'أعزف جملة السير وأنتهي بقفلة على القرار', q ? 'أصل لربع التون بالبِند بدقة ±15 سنت في الدوزان' : 'أضيف زخرفة شرقية على الأقل', `أميز ${m.name} بالسمع في تدريب الأذن`],
  };
}
function uniq(a) { return [...new Set(a)]; }

// جنس على وتر/نافذة: يعزف نوتات الجنس فقط
export function jinsEx(jinsId, root, from, to, rq = false) {
  const j = AJNAS[jinsId];
  const off = stepsToOffsets([...j.steps, 0]);
  // ابحث عن القرار في النافذة على الوتر 5 أو 4
  const notes = [];
  for (let s = 0; s < 6 && !notes.length; s++) {
    for (let f = from; f <= to; f++) {
      if (((OPEN_STRINGS[s] + f) - root) % 12 === 0 && OPEN_STRINGS[s] + f >= 45) {
        let q = (OPEN_STRINGS[s] + f) * 2 + (rq ? 1 : 0);
        const list = off.map(o => q + o);
        // وزّع على الأوتار
        let ss = s;
        for (const qq of list) {
          while (ss < 5 && (qq - OPEN_STRINGS[ss] * 2) / 2 > f + 4) ss++;
          const fq = qq - OPEN_STRINGS[ss] * 2;
          notes.push([ss, Math.floor(fq / 2), fq % 2, { dur: 1 }]);
        }
        break;
      }
    }
  }
  const back = [...notes].reverse().slice(1).map(n => [n[0], n[1], n[2], { dur: n === notes[0] ? 2 : 1 }]);
  return { type: 'notes', notes: [...notes, ...back], label: 'note' };
}
