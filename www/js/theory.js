// النظرية الموسيقية: النوتات، السلالم، المقامات، الأجناس، الكوردات، الإيقاعات
// كل المسافات بوحدة "ربع التون" (q). التون = 4، نصف التون = 2، ربع التون = 1.

export const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // MIDI: E2 A2 D3 G3 B3 E4 (الوتر 6 ← 1)
export const STRING_NAMES = ['6 (مي غليظ)', '5 (لا)', '4 (ري)', '3 (صول)', '2 (سي)', '1 (مي رفيع)'];

export const NOTE_LATIN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const NOTE_LATIN_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_ARABIC = ['دو', 'دو#', 'ري', 'مي♭', 'مي', 'فا', 'فا#', 'صول', 'لا♭', 'لا', 'سي♭', 'سي'];
// أسماء أنصاف البيمول (ربع تون تحت النوتة الطبيعية التالية)
const HALF_FLAT_LATIN = { 3: 'E½♭', 10: 'B½♭', 8: 'A½♭', 1: 'D½♭', 6: 'G½♭' };
const HALF_FLAT_AR = { 3: 'مي½♭', 10: 'سي½♭', 8: 'لا½♭', 1: 'ري½♭', 6: 'صول½♭' };

export const ROOTS = NOTE_LATIN.map((n, i) => ({ pc: i, latin: n, ar: NOTE_ARABIC[i] }));

let notation = 'ar';
export function setNotation(n) { notation = n; }
export function getNotation() { return notation; }

// اسم نوتة بدلالة الارتفاع بأرباع التون (q = midi*2 + ربع)
export function noteName(q, style = notation) {
  const midi = Math.floor(q / 2);
  const quarter = q % 2;
  const pc = ((midi % 12) + 12) % 12;
  if (!quarter) return style === 'ar' ? NOTE_ARABIC[pc] : NOTE_LATIN[pc];
  // ربع تون فوق pc = نصف بيمول للنوتة التالية
  const up = (pc + 1) % 12;
  const key = pc; // نصف بيمول يقع بين pc و pc+1
  if (style === 'ar') return HALF_FLAT_AR[key] || (NOTE_ARABIC[pc] + '+¼');
  return HALF_FLAT_LATIN[key] || (NOTE_LATIN[pc] + '+¼');
}

// تهجئة صحيحة حسب الدرجة: في الصبا صول♭ وليس فا#، وفي الحجازكار ري♭ وليس دو#
const LETTERS_LATIN = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTERS_AR = ['دو', 'ري', 'مي', 'فا', 'صول', 'لا', 'سي'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const ACC_LATIN = { '-4': '𝄫', '-3': '♭½', '-2': '♭', '-1': '½♭', 0: '', 1: '+¼', 2: '#', 3: '#¼', 4: '𝄪' };
export function spelledName(q, rootPc, deg, style = notation) {
  const rootLetter = LETTERS_LATIN.indexOf(NOTE_LATIN[rootPc][0]);
  const li = (rootLetter + deg) % 7;
  const pcq = ((q % 24) + 24) % 24; // ارتفاع داخل الأوكتاف بأرباع
  let diff = pcq - LETTER_PC[li] * 2;
  if (diff > 12) diff -= 24;
  if (diff < -12) diff += 24;
  if (Math.abs(diff) > 4) return noteName(q, style);
  const acc = style === 'ar' ? ACC_LATIN[diff].replace('𝄫', '♭♭').replace('𝄪', '##') : ACC_LATIN[diff];
  return (style === 'ar' ? LETTERS_AR[li] : LETTERS_LATIN[li]) + acc;
}

export function pcName(pc, style = notation) {
  return style === 'ar' ? NOTE_ARABIC[pc] : NOTE_LATIN[pc];
}

export function freqOfQ(q) { // q بأرباع التون، A4 = midi 69 = q 138
  return 440 * Math.pow(2, (q - 138) / 24);
}

// ===================== السلالم الغربية =====================
// steps: المسافات المتتالية بأرباع التون، مجموعها 24
export const SCALES = {
  major:        { name: 'السلم الكبير (أيونيان)', en: 'Major / Ionian', steps: [4,4,2,4,4,4,2], family: 'western', degrees: ['1','2','3','4','5','6','7'] },
  minor:        { name: 'الصغير الطبيعي (أيوليان)', en: 'Natural minor / Aeolian', steps: [4,2,4,4,2,4,4], family: 'western', degrees: ['1','2','b3','4','5','b6','b7'] },
  harmonicMinor:{ name: 'الصغير الهارموني', en: 'Harmonic minor', steps: [4,2,4,4,2,6,2], family: 'western', degrees: ['1','2','b3','4','5','b6','7'] },
  melodicMinor: { name: 'الصغير الميلودي', en: 'Melodic minor', steps: [4,2,4,4,4,4,2], family: 'western', degrees: ['1','2','b3','4','5','6','7'] },
  dorian:       { name: 'دوريان', en: 'Dorian', steps: [4,2,4,4,4,2,4], family: 'mode', degrees: ['1','2','b3','4','5','6','b7'] },
  phrygian:     { name: 'فريجيان', en: 'Phrygian', steps: [2,4,4,4,2,4,4], family: 'mode', degrees: ['1','b2','b3','4','5','b6','b7'] },
  lydian:       { name: 'ليديان', en: 'Lydian', steps: [4,4,4,2,4,4,2], family: 'mode', degrees: ['1','2','3','#4','5','6','7'] },
  mixolydian:   { name: 'ميكسوليديان', en: 'Mixolydian', steps: [4,4,2,4,4,2,4], family: 'mode', degrees: ['1','2','3','4','5','6','b7'] },
  locrian:      { name: 'لوكريان', en: 'Locrian', steps: [2,4,4,2,4,4,4], family: 'mode', degrees: ['1','b2','b3','4','b5','b6','b7'] },
  minorPent:    { name: 'البنتاتونيك الصغير', en: 'Minor pentatonic', steps: [6,4,4,6,4], family: 'pent', degrees: ['1','b3','4','5','b7'] },
  majorPent:    { name: 'البنتاتونيك الكبير', en: 'Major pentatonic', steps: [4,4,6,4,6], family: 'pent', degrees: ['1','2','3','5','6'] },
  blues:        { name: 'سلم البلوز', en: 'Blues', steps: [6,4,2,2,6,4], family: 'pent', degrees: ['1','b3','4','b5','5','b7'] },
  majorBlues:   { name: 'البلوز الكبير', en: 'Major blues', steps: [4,2,2,6,4,6], family: 'pent', degrees: ['1','2','b3','3','5','6'] },
  phrygianDom:  { name: 'فريجيان دومينانت', en: 'Phrygian dominant', steps: [2,6,2,4,2,4,4], family: 'special', degrees: ['1','b2','3','4','5','b6','b7'] },
  wholeTone:    { name: 'التوني الكامل', en: 'Whole tone', steps: [4,4,4,4,4,4], family: 'special', degrees: ['1','2','3','#4','#5','b7'] },
  dimHW:        { name: 'المنقوص (نصف–تون)', en: 'Diminished HW', steps: [2,4,2,4,2,4,2,4], family: 'special', degrees: ['1','b2','b3','3','#4','5','6','b7'] },
  dimWH:        { name: 'المنقوص (تون–نصف)', en: 'Diminished WH', steps: [4,2,4,2,4,2,4,2], family: 'special', degrees: ['1','2','b3','4','b5','b6','6','7'] },
  altered:      { name: 'المتبدل (Altered)', en: 'Altered', steps: [2,4,2,4,4,4,4], family: 'special', degrees: ['1','b2','#2','3','b5','#5','b7'] },
  lydianDom:    { name: 'ليديان دومينانت', en: 'Lydian dominant', steps: [4,4,4,2,4,2,4], family: 'special', degrees: ['1','2','3','#4','5','6','b7'] },
  chromatic:    { name: 'الكروماتيك', en: 'Chromatic', steps: [2,2,2,2,2,2,2,2,2,2,2,2], family: 'special', degrees: ['1','b2','2','b3','3','4','b5','5','b6','6','b7','7'] },
};

// ===================== الأجناس =====================
export const AJNAS = {
  ajam:     { name: 'جنس عجم', steps: [4,4,2], desc: 'ثلاثة أبعاد: تون، تون، نصف. صوت مشرق مثل بداية السلم الكبير.' },
  nahawand: { name: 'جنس نهاوند', steps: [4,2,4], desc: 'تون، نصف، تون. صوت حزين مثل بداية السلم الصغير.' },
  kurd:     { name: 'جنس كرد', steps: [2,4,4], desc: 'نصف، تون، تون. حزن شرقي هادئ.' },
  hijaz:    { name: 'جنس حجاز', steps: [2,6,2], desc: 'نصف، تون ونصف، نصف. أشهر صوت شرقي، فيه البعد الكبير بين الدرجتين 2 و3.' },
  rast:     { name: 'جنس راست', steps: [4,3,3], desc: 'تون، ثلاثة أرباع، ثلاثة أرباع. الدرجة الثالثة نصف بيمول: لا كبيرة ولا صغيرة.' },
  bayati:   { name: 'جنس بياتي', steps: [3,3,4], desc: 'ثلاثة أرباع، ثلاثة أرباع، تون. روح الموسيقى العربية الشعبية.' },
  sabaZamzam: { name: 'جنس صبا زمزمة', steps: [2,4,2], desc: 'نصف، تون، نصف. صبا بلا ربع تون، الرابعة ناقصة.' },
  saba:     { name: 'جنس صبا', steps: [3,3,2], desc: 'ثلاثة أرباع، ثلاثة أرباع، نصف. الرابعة ناقصة، صوت شجن عميق.' },
  sikah:    { name: 'جنس سيكاه', steps: [3,4], desc: 'ثلاثي يبدأ من نوتة نصف بيمول: ثلاثة أرباع ثم تون.' },
  nikriz:   { name: 'جنس نكريز', steps: [4,2,6,2], desc: 'خماسي: تون، نصف، تون ونصف، نصف.' },
};

// ===================== المقامات =====================
// root: القرار المعتاد (pc)، rootQ: إن كان القرار نفسه نصف بيمول
// asc/desc: المسافات صعوداً ونزولاً
export const MAQAMAT = {
  ajam:       { name: 'مقام العجم', family: 'عجم', root: 10, asc: [4,4,2,4,4,4,2], ajnas: ['ajam','ajam'], ghammaz: 4, quarter: false,
                desc: 'مماثل للسلم الكبير. قراره التقليدي سي♭ (عجم عشيران) وكثيراً ما يُعزف من دو أو فا. صوت فرح واحتفال.' },
  nahawand:   { name: 'مقام النهاوند', family: 'نهاوند', root: 0, asc: [4,2,4,4,2,6,2], dsc: [4,2,4,4,2,4,4], ajnas: ['nahawand','hijaz'], ghammaz: 4, quarter: false,
                desc: 'يقابل الصغير الهارموني صعوداً (الدرجة 7 مرفوعة) والصغير الطبيعي نزولاً. عاطفي ورومانسي.' },
  kurd:       { name: 'مقام الكرد', family: 'كرد', root: 2, asc: [2,4,4,4,2,4,4], ajnas: ['kurd','nahawand'], ghammaz: 3, quarter: false,
                desc: 'يقابل مود الفريجيان. يبدأ بنصف تون فيعطي حزناً شرقياً، وهو أساس كثير من الأغاني الحديثة.' },
  hijaz:      { name: 'مقام الحجاز', family: 'حجاز', root: 2, asc: [2,6,2,4,2,4,4], ajnas: ['hijaz','nahawand'], ghammaz: 3, quarter: false,
                desc: 'يقابل الفريجيان دومينانت. البعد الكبير بين الدرجتين 2 و3 هو بصمته. يُستخدم في الأذان والإنشاد والطرب.' },
  hijazkar:   { name: 'مقام الحجازكار', family: 'حجاز', root: 0, asc: [2,6,2,4,2,6,2], ajnas: ['hijaz','hijaz'], ghammaz: 4, quarter: false,
                desc: 'جنس حجاز على القرار وجنس حجاز على الخامسة. فخم ودرامي.' },
  nikriz:     { name: 'مقام النكريز', family: 'نهاوند', root: 0, asc: [4,2,6,2,4,2,4], ajnas: ['nikriz','nahawand'], ghammaz: 4, quarter: false,
                desc: 'جنس نكريز على القرار. يشبه الدوريان مع رابعة مرفوعة.' },
  nawaAthar:  { name: 'مقام نوا أثر', family: 'نهاوند', root: 0, asc: [4,2,6,2,2,6,2], ajnas: ['nikriz','hijaz'], ghammaz: 4, quarter: false,
                desc: 'نكريز على القرار وحجاز على الخامسة. لون غامض ومميز.' },
  rast:       { name: 'مقام الراست', family: 'راست', root: 0, asc: [4,3,3,4,4,3,3], dsc: [4,3,3,4,4,2,4], ajnas: ['rast','rast'], ghammaz: 4, quarter: true,
                desc: 'أبو المقامات. الثالثة والسابعة نصف بيمول. نزولاً تصبح السابعة بيمول كاملاً.' },
  suznak:     { name: 'مقام السوزناك', family: 'راست', root: 0, asc: [4,3,3,4,2,6,2], ajnas: ['rast','hijaz'], ghammaz: 4, quarter: true,
                desc: 'راست على القرار وحجاز على الخامسة.' },
  jiharkah:   { name: 'مقام الجهاركاه', family: 'عجم', root: 5, asc: [4,4,2,4,4,3,3], ajnas: ['ajam','rast'], ghammaz: 4, quarter: true,
                desc: 'قراره فا. عجم على القرار وراست على الخامسة.' },
  bayati:     { name: 'مقام البياتي', family: 'بياتي', root: 2, asc: [3,3,4,4,2,4,4], ajnas: ['bayati','nahawand'], ghammaz: 3, quarter: true,
                desc: 'أكثر المقامات انتشاراً في الأغنية العربية الشعبية. الدرجة الثانية نصف بيمول.' },
  husseini:   { name: 'مقام الحسيني', family: 'بياتي', root: 2, asc: [3,3,4,4,3,3,4], ajnas: ['bayati','bayati'], ghammaz: 4, quarter: true,
                desc: 'بياتي على القرار وبياتي على الخامسة. يتجه السير نحو الخامسة.' },
  bayatiShuri:{ name: 'مقام البياتي شوري', family: 'بياتي', root: 2, asc: [3,3,4,2,6,2,4], ajnas: ['bayati','hijaz'], ghammaz: 3, quarter: true,
                desc: 'بياتي على القرار وحجاز على الرابعة. شجن قوي.' },
  saba:       { name: 'مقام الصبا', family: 'صبا', root: 2, asc: [3,3,2,6,2,4,4], ajnas: ['saba','hijaz'], ghammaz: 2, quarter: true,
                desc: 'أكثر المقامات حزناً. الرابعة ناقصة (صول♭ من ري) وهي سر لونه.' },
  sabaZamzam: { name: 'مقام الصبا زمزمة', family: 'صبا', root: 2, asc: [2,4,2,6,2,4,4], ajnas: ['sabaZamzam','hijaz'], ghammaz: 2, quarter: false,
                desc: 'صبا بلا ربع تون: الثانية بيمول كامل. يُعزف على الجيتار مباشرة.' },
  sikah:      { name: 'مقام السيكاه', family: 'سيكاه', root: 3, rootQuarter: true, asc: [3,4,4,3,3,4,3], ajnas: ['sikah','rast'], ghammaz: 2, quarter: true,
                desc: 'قراره نفسه نصف بيمول (مي½♭). صوت روحاني يُسمع كثيراً في الإنشاد.' },
  huzam:      { name: 'مقام الهزام', family: 'سيكاه', root: 3, rootQuarter: true, asc: [3,4,2,6,2,4,3], ajnas: ['sikah','hijaz'], ghammaz: 2, quarter: true,
                desc: 'سيكاه على القرار وحجاز على الثالثة. شديد التعبير.' },
};

// يعيد مجموعة الدرجات (بأرباع التون من القرار) لسلم أو مقام
export function getScale(id) {
  if (SCALES[id]) return { id, ...SCALES[id], type: 'scale' };
  if (MAQAMAT[id]) return { id, ...MAQAMAT[id], steps: MAQAMAT[id].asc, type: 'maqam' };
  return null;
}

export function stepsToOffsets(steps) {
  const out = [0];
  let acc = 0;
  for (let i = 0; i < steps.length - 1; i++) { acc += steps[i]; out.push(acc); }
  return out;
}

export function scaleOffsets(id, dir = 'asc') {
  const s = getScale(id);
  if (!s) return [0];
  const steps = (dir === 'desc' && s.dsc) ? s.dsc : s.steps;
  return stepsToOffsets(steps);
}

// q الخاصة بقرار (pc مع ربع اختياري) في الأوكتاف المعطى
export function rootQ(pc, quarter = false, octaveMidi = 48) {
  return (octaveMidi + pc) * 2 + (quarter ? 1 : 0);
}

// اسم الدرجة لسلم: من التسميات المعرفة أو حساب تقريبي
export function degreeLabel(id, idx) {
  const s = getScale(id);
  if (s && s.degrees) return s.degrees[idx] ?? String(idx + 1);
  return String(idx + 1);
}

// ===================== الكوردات =====================
export const CHORD_TYPES = {
  maj:  { name: 'كبير', sym: '', iv: [0,4,7] },
  min:  { name: 'صغير', sym: 'm', iv: [0,3,7] },
  dim:  { name: 'ناقص', sym: '°', iv: [0,3,6] },
  aug:  { name: 'زائد', sym: '+', iv: [0,4,8] },
  sus2: { name: 'معلق 2', sym: 'sus2', iv: [0,2,7] },
  sus4: { name: 'معلق 4', sym: 'sus4', iv: [0,5,7] },
  pow:  { name: 'باور (خامسة)', sym: '5', iv: [0,7] },
  dom7: { name: 'سابعة دومينانت', sym: '7', iv: [0,4,7,10] },
  maj7: { name: 'سابعة كبيرة', sym: 'maj7', iv: [0,4,7,11] },
  min7: { name: 'سابعة صغيرة', sym: 'm7', iv: [0,3,7,10] },
  m7b5: { name: 'نصف ناقص', sym: 'm7b5', iv: [0,3,6,10] },
  dim7: { name: 'سابعة ناقصة', sym: '°7', iv: [0,3,6,9] },
  add9: { name: 'إضافة 9', sym: 'add9', iv: [0,4,7,14] },
  six:  { name: 'سادسة', sym: '6', iv: [0,4,7,9] },
  min6: { name: 'سادسة صغيرة', sym: 'm6', iv: [0,3,7,9] },
  dom9: { name: 'تاسعة', sym: '9', iv: [0,4,7,10,14] },
};

// أشكال الكوردات المفتوحة الشهيرة: frets من الوتر 6 إلى 1، -1 = لا يُعزف
export const OPEN_SHAPES = {
  'C':    { frets: [-1,3,2,0,1,0], fingers: [0,3,2,0,1,0] },
  'A':    { frets: [-1,0,2,2,2,0], fingers: [0,0,1,2,3,0] },
  'G':    { frets: [3,2,0,0,0,3], fingers: [2,1,0,0,0,3] },
  'E':    { frets: [0,2,2,1,0,0], fingers: [0,2,3,1,0,0] },
  'D':    { frets: [-1,-1,0,2,3,2], fingers: [0,0,0,1,3,2] },
  'Am':   { frets: [-1,0,2,2,1,0], fingers: [0,0,2,3,1,0] },
  'Em':   { frets: [0,2,2,0,0,0], fingers: [0,2,3,0,0,0] },
  'Dm':   { frets: [-1,-1,0,2,3,1], fingers: [0,0,0,2,3,1] },
  'A7':   { frets: [-1,0,2,0,2,0], fingers: [0,0,2,0,3,0] },
  'E7':   { frets: [0,2,0,1,0,0], fingers: [0,2,0,1,0,0] },
  'D7':   { frets: [-1,-1,0,2,1,2], fingers: [0,0,0,2,1,3] },
  'G7':   { frets: [3,2,0,0,0,1], fingers: [3,2,0,0,0,1] },
  'C7':   { frets: [-1,3,2,3,1,0], fingers: [0,3,2,4,1,0] },
  'B7':   { frets: [-1,2,1,2,0,2], fingers: [0,2,1,3,0,4] },
  'Am7':  { frets: [-1,0,2,0,1,0], fingers: [0,0,2,0,1,0] },
  'Em7':  { frets: [0,2,0,0,0,0], fingers: [0,2,0,0,0,0] },
  'Dm7':  { frets: [-1,-1,0,2,1,1], fingers: [0,0,0,2,1,1] },
  'Cmaj7':{ frets: [-1,3,2,0,0,0], fingers: [0,3,2,0,0,0] },
  'Fmaj7':{ frets: [-1,-1,3,2,1,0], fingers: [0,0,3,2,1,0] },
  'Amaj7':{ frets: [-1,0,2,1,2,0], fingers: [0,0,2,1,3,0] },
  'Dsus4':{ frets: [-1,-1,0,2,3,3], fingers: [0,0,0,1,3,4] },
  'Dsus2':{ frets: [-1,-1,0,2,3,0], fingers: [0,0,0,1,3,0] },
  'Asus4':{ frets: [-1,0,2,2,3,0], fingers: [0,0,1,2,3,0] },
  'Asus2':{ frets: [-1,0,2,2,0,0], fingers: [0,0,1,2,0,0] },
  'Esus4':{ frets: [0,2,2,2,0,0], fingers: [0,2,3,4,0,0] },
};

// أشكال متحركة (باريه): offsets نسبة لفرت القرار، root string
const MOVABLE = {
  E: { // القرار على الوتر 6
    maj:  [0,2,2,1,0,0], min: [0,2,2,0,0,0], dom7: [0,2,0,1,0,0], min7: [0,2,0,0,0,0],
    maj7: [0,-9,1,1,0,-9], sus4: [0,2,2,2,0,0], pow: [0,2,2,-9,-9,-9], m7b5: [0,-9,0,0,-1,-9],
    dim7: [0,-9,-1,0,-1,-9], six: [0,-9,-1,1,0,-9], min6: [0,-9,-1,0,0,-9], dim: [0,1,2,0,-9,-9],
    aug: [0,-9,2,1,1,-9], dom9: [0,-9,0,1,0,2], add9: [0,2,4,1,0,0], sus2: [0,2,4,4,0,0], m7: null,
  },
  A: { // القرار على الوتر 5
    maj:  [-9,0,2,2,2,0], min: [-9,0,2,2,1,0], dom7: [-9,0,2,0,2,0], min7: [-9,0,2,0,1,0],
    maj7: [-9,0,2,1,2,0], sus4: [-9,0,2,2,3,0], sus2: [-9,0,2,2,0,0], pow: [-9,0,2,2,-9,-9],
    m7b5: [-9,0,1,0,1,-9], dim7: [-9,0,1,-1,1,-9], six: [-9,0,2,2,2,2], min6: [-9,0,2,-1,1,0],
    dim: [-9,0,1,2,1,-9], aug: [-9,0,3,2,2,-9], dom9: [-9,0,-1,0,0,0], add9: [-9,0,2,4,2,0],
  },
};

const SHARP_KEYS_MAJOR = [7, 2, 9, 4, 11, 6];
// اسم الكورد بتهجئة تناسب المفتاح (دييز في مفاتيح الدييز)
export function chordNameInKey(pc, type, keyPc, mode = 'major') {
  const relMajor = mode === 'major' ? keyPc : (keyPc + 3) % 12;
  const names = SHARP_KEYS_MAJOR.includes(relMajor) ? NOTE_LATIN_SHARP : NOTE_LATIN;
  return names[pc] + (CHORD_TYPES[type]?.sym ?? '');
}

export function chordName(pc, type, style = notation) {
  return pcName(pc, style) + (CHORD_TYPES[type]?.sym ?? '');
}

export function chordNotes(pc, type) {
  return (CHORD_TYPES[type]?.iv || [0,4,7]).map(i => (pc + i) % 12);
}

// أصابع تقريبية لشكل متحرك
function guessFingers(frets) {
  const played = frets.filter(f => f > 0);
  if (!played.length) return frets.map(() => 0);
  const min = Math.min(...played);
  const barre = frets.filter(f => f === min).length >= 2 && min > 0;
  const fingers = frets.map(f => (f <= 0 ? 0 : 0));
  let next = barre ? 2 : 1;
  const order = frets.map((f, i) => ({ f, i })).filter(o => o.f > 0).sort((a, b) => a.f - b.f || a.i - b.i);
  for (const o of order) {
    if (barre && o.f === min) fingers[o.i] = 1;
    else fingers[o.i] = Math.min(4, next++);
  }
  return fingers;
}

// يعيد قائمة أشكال للكورد (مفتوح إن وجد + الأشكال المتحركة)
export function chordVoicings(pc, type) {
  const out = [];
  const nameLatin = NOTE_LATIN[pc] + (CHORD_TYPES[type]?.sym ?? '');
  const alt = NOTE_LATIN_SHARP[pc] + (CHORD_TYPES[type]?.sym ?? '');
  const openKey = OPEN_SHAPES[nameLatin] ? nameLatin : (OPEN_SHAPES[alt] ? alt : null);
  if (openKey) out.push({ label: 'مفتوح', ...OPEN_SHAPES[openKey], baseFret: 1 });
  for (const [shape, rootString] of [['E', 0], ['A', 1]]) {
    const off = MOVABLE[shape][type];
    if (!off) continue;
    let rootFret = ((pc - OPEN_STRINGS[rootString] % 12) + 12) % 12;
    if (rootFret === 0 && openKey) rootFret = 12;
    const minOff = Math.min(...off.filter(o => o > -9));
    if (rootFret + minOff < 0) rootFret += 12;
    const frets = off.map(o => (o <= -9 ? -1 : rootFret + o));
    if (frets.some(f => f > 17)) continue;
    out.push({ label: `شكل ${shape} (القرار على الوتر ${6 - rootString})`, frets, fingers: guessFingers(frets), baseFret: Math.max(1, Math.min(...frets.filter(f => f > 0))) });
  }
  return out;
}

// ===================== الهارموني =====================
export const ROMAN_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
export const ROMAN_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
export const DIATONIC_TYPES_MAJOR = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
export const DIATONIC_7TH_MAJOR = ['maj7', 'min7', 'min7', 'maj7', 'dom7', 'min7', 'm7b5'];
export const DIATONIC_TYPES_MINOR = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];
const MAJOR_OFF = [0, 2, 4, 5, 7, 9, 11];
const MINOR_OFF = [0, 2, 3, 5, 7, 8, 10];

export function diatonicChords(pc, mode = 'major', sevenths = false) {
  const off = mode === 'major' ? MAJOR_OFF : MINOR_OFF;
  const types = mode === 'major' ? (sevenths ? DIATONIC_7TH_MAJOR : DIATONIC_TYPES_MAJOR) : DIATONIC_TYPES_MINOR;
  const roman = mode === 'major' ? ROMAN_MAJOR : ROMAN_MINOR;
  return off.map((o, i) => ({ pc: (pc + o) % 12, type: types[i], roman: roman[i] }));
}

export const CIRCLE_OF_FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

// تحليل اسم كورد نصي مثل "F#m7" أو "Bb" أو "دو صغير"
const CHORD_RX = /^([A-G])([#b]?)(.*)$/;
const SUFFIX_MAP = [
  ['maj7', 'maj7'], ['maj9', 'maj7'], ['M7', 'maj7'], ['maj', 'maj'], ['m7b5', 'm7b5'], ['ø', 'm7b5'], ['dim7', 'dim7'], ['°7', 'dim7'],
  ['m7', 'min7'], ['min7', 'min7'], ['m6', 'min6'], ['add9', 'add9'], ['sus2', 'sus2'], ['sus4', 'sus4'], ['sus', 'sus4'],
  ['dim', 'dim'], ['°', 'dim'], ['aug', 'aug'], ['+', 'aug'], ['min', 'min'], ['m', 'min'],
  ['9', 'dom9'], ['7', 'dom7'], ['6', 'six'], ['5', 'pow'], ['', 'maj'],
];
export function parseChord(str) {
  const s = str.trim();
  const m = s.match(CHORD_RX);
  if (!m) return null;
  let pc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  if (m[2] === '#') pc = (pc + 1) % 12;
  if (m[2] === 'b') pc = (pc + 11) % 12;
  let rest = m[3];
  let bass = null;
  const slash = rest.indexOf('/');
  if (slash >= 0 && /^[A-G]/.test(rest.slice(slash + 1))) { bass = rest.slice(slash + 1); rest = rest.slice(0, slash); }
  for (const [suf, type] of SUFFIX_MAP) {
    if (rest === suf || (suf && rest.startsWith(suf) && suf.length > 0 && rest === suf)) return { pc, type, bass, raw: s };
  }
  // محاولة أكثر مرونة
  for (const [suf, type] of SUFFIX_MAP) if (suf && rest.startsWith(suf)) return { pc, type, bass, raw: s, extra: rest.slice(suf.length) };
  return { pc, type: 'maj', bass, raw: s, extra: rest };
}

export function transposeChordText(text, semis, preferFlats = true) {
  const names = preferFlats ? NOTE_LATIN : NOTE_LATIN_SHARP;
  // يغيّر رموز الكوردات فقط (لا الكلمات): حرف A–G يليه لاحقة كورد أو نهاية الكلمة
  return text.replace(/(^|[\s\[(|\/,])([A-G])([#b]?)(?=(?:m|maj|min|dim|aug|sus|add|M|ø|°|\+|\d|\/|\]|\)|\||,|\s|$))/g, (all, pre, l, acc) => {
    let pc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[l];
    if (acc === '#') pc++;
    if (acc === 'b') pc--;
    return pre + names[((pc + semis) % 12 + 12) % 12];
  });
}

// كشف المفتاح من قائمة كوردات
export function detectKey(chords) {
  const results = [];
  for (let k = 0; k < 12; k++) {
    for (const mode of ['major', 'minor']) {
      const dia = diatonicChords(k, mode);
      let score = 0;
      chords.forEach((c, i) => {
        const d = dia.findIndex(x => x.pc === c.pc);
        if (d >= 0) {
          const t = dia[d].type;
          const base = c.type === 'min' || c.type === 'min7' || c.type === 'min6' ? 'min' : (c.type === 'dim' || c.type === 'm7b5' ? 'dim' : 'maj');
          score += base === t ? 2 : 0.5;
          if (d === 0) score += (i === 0 || i === chords.length - 1) ? 2 : 0.7;
          if (d === 4 && mode === 'minor' && (c.type === 'maj' || c.type === 'dom7')) score += 1.5; // V في الصغير الهارموني
        } else score -= 1;
      });
      results.push({ pc: k, mode, score });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

// ===================== الإيقاعات =====================
// D = دُم، T = تَك، k = تَك خفيفة (زخرفة)، . = سكتة. كل خانة = subdivision
export const RHYTHMS = {
  maqsum:     { name: 'المقسوم', meter: '4/4', sub: 8, slot: 0.5, pattern: 'DT.TD.T.', desc: 'أشهر إيقاع في الأغنية العربية الحديثة.' },
  baladi:     { name: 'البلدي (المصمودي الصغير)', meter: '4/4', sub: 8, slot: 0.5, pattern: 'DD.TD.T.', desc: 'يبدأ بدُمّين، أثقل من المقسوم.' },
  saidi:      { name: 'الصعيدي', meter: '4/4', sub: 8, slot: 0.5, pattern: 'DT.DD.T.', desc: 'إيقاع صعيد مصر، دُمّان في الوسط.' },
  malfuf:     { name: 'الملفوف', meter: '2/4', sub: 8, slot: 0.25, pattern: 'D..T..T.', desc: 'سريع وراقص.' },
  wahda:      { name: 'الوحدة', meter: '4/4', sub: 8, slot: 0.5, pattern: 'D..T..T.', desc: 'دُم واحدة في البداية والباقي فراغ وزخارف.' },
  fox:        { name: 'الفوكس', meter: '4/4', sub: 4, slot: 1, pattern: 'DTDT', desc: 'دُم تَك متناوبة، بسيط ومستقيم.' },
  waltz:      { name: 'الفالس', meter: '3/4', sub: 3, slot: 1, pattern: 'DTT', desc: 'ثلاثي، دُم ثم تَكّان.' },
  masmudiKabir:{ name: 'المصمودي الكبير', meter: '8/4', sub: 8, slot: 1, pattern: 'DD.TD.T.', desc: 'إيقاع الطرب الكلاسيكي، كل خانة = ربع نوتة.', slow: true },
  samaiThaqil:{ name: 'السماعي الثقيل', meter: '10/8', sub: 10, slot: 0.5, pattern: 'D..T.DDT..', desc: 'إيقاع السماعيات الآلية، 10 نبضات.' },
};

// ===================== قاموس المصطلحات =====================
export const GLOSSARY = [
  ['الفرت (الدستان)', 'القطعة المعدنية على الزند. الانتقال فرتاً واحداً = نصف تون.'],
  ['التون', 'مسافة فرتين. نصف التون = فرت واحد. ربع التون = نصف فرت (يُعزف بالبِند على الجيتار).'],
  ['الفاصلة', 'المسافة بين نوتتين. الثالثة الكبيرة = 4 أنصاف، الصغيرة = 3، الخامسة التامة = 7.'],
  ['الأوكتاف', 'نفس النوتة بضعف التردد. على الجيتار: 12 فرتاً على نفس الوتر.'],
  ['السلم', 'مجموعة نوتات مرتبة بمسافات ثابتة تبدأ من قرار.'],
  ['القرار', 'النوتة الأساسية التي يستقر عليها السلم أو المقام. في الغرب تسمى Tonic.'],
  ['الغماز', 'الدرجة المهمة الثانية في المقام، وغالباً بداية الجنس الفرعي.'],
  ['الجنس', 'وحدة بناء المقام: 3 إلى 5 نوتات بمسافات محددة.'],
  ['المقام', 'نظام لحني عربي: أجناس + سير (طريقة حركة) + قفلات.'],
  ['السير', 'المسار المعتاد للحن داخل المقام: من أين يبدأ وأين يستقر وكيف ينزل.'],
  ['التقسيم', 'ارتجال حر بلا إيقاع يستعرض المقام.'],
  ['المود', 'السلم الكبير مبتدئاً من درجة أخرى، فيعطي لوناً مختلفاً.'],
  ['البنتاتونيك', 'سلم من خمس نوتات، الأسهل للارتجال.'],
  ['الكورد', 'ثلاث نوتات أو أكثر تُعزف معاً.'],
  ['الأربيج', 'نوتات الكورد معزوفة واحدة تلو الأخرى.'],
  ['الباريه', 'ضغط إصبع واحد على عدة أوتار في نفس الفرت.'],
  ['الكابو', 'أداة تُثبت على الزند لرفع كل الأوتار معاً.'],
  ['الترانسبوز', 'نقل الأغنية من مفتاح إلى آخر.'],
  ['الهامر-أون', 'إصدار نوتة بضرب الإصبع على الوتر دون ريشة.'],
  ['البُل-أوف', 'سحب الإصبع عن الوتر لإصدار النوتة الأدنى.'],
  ['البِند', 'دفع الوتر جانباً لرفع النوتة: ربع، نصف، أو تون.'],
  ['السلايد', 'انزلاق الإصبع من فرت لآخر دون رفعه.'],
  ['الفيبراتو', 'اهتزاز منتظم في النوتة يعطيها حياة.'],
  ['المترونوم', 'جهاز يعطي نبضاً ثابتاً، تقاس سرعته بالنبضة في الدقيقة (BPM).'],
  ['دُم / تَك', 'الضربة الغليظة / الضربة الحادة في الإيقاع العربي.'],
  ['السنت', 'وحدة دقيقة للمسافة: نصف التون = 100 سنت، ربع التون = 50 سنت.'],
  ['CAGED', 'نظام يربط الزند بخمسة أشكال كوردات مفتوحة: C A G E D.'],
  ['3NPS', 'ثلاث نوتات لكل وتر: طريقة لعزف السلالم السباعية بسرعة.'],
  ['الدومينانت', 'الدرجة الخامسة والكورد المبني عليها، يجذب نحو القرار.'],
  ['دائرة الخُمسات', 'ترتيب المفاتيح الاثني عشر بخامسات تامة، تكشف القرابة بين المفاتيح.'],
];
