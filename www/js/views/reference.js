// المرجع والإعدادات
import { h, card, select, slider, toggle, toast } from '../ui.js';
import { GLOSSARY, MAQAMAT, MAQAM_CHARACTER, AJNAS, SCALES, CIRCLE_OF_FIFTHS, pcName, NOTE_LATIN, RHYTHMS, setNotation, diatonicChords, chordName } from '../theory.js';
import { Fretboard } from '../fretboard.js';
import { noteList, stepsText } from '../lessons/helpers.js';
import * as store from '../store.js';
import * as speech from '../speech.js';
import { setVolume } from '../audio.js';
import { setScreenTimeout, SCREEN_OPTIONS } from '../screen.js';

export function renderReference(app, sub) {
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'المرجع')));
  const tabs = [['glossary', 'المصطلحات'], ['maqamat', 'جدول المقامات'], ['scales', 'جدول السلالم'], ['circle', 'دائرة الخُمسات'], ['notes', 'نوتات الرقبة'], ['rhythms', 'الإيقاعات']];
  const cur = sub || 'glossary';
  app.append(h('div', { class: 'row', style: { marginBottom: '12px' } }, tabs.map(([k, l]) => h('a', { class: `btn small${k === cur ? ' on' : ''}`, href: `#/reference/${k}` }, l))));
  if (cur === 'glossary') {
    const q = h('input', { type: 'text', placeholder: 'ابحث…', style: { width: '100%', marginBottom: '10px' } });
    const list = h('div');
    const draw = () => { list.innerHTML = ''; GLOSSARY.filter(([t, d]) => !q.value || t.includes(q.value) || d.includes(q.value)).forEach(([t, d]) => list.append(h('div', { class: 'lesson-item' }, h('span', { class: 't' }, h('b', {}, t), h('small', {}, d))))); };
    q.addEventListener('input', draw); draw();
    app.append(card(null, q, list));
  } else if (cur === 'maqamat') {
    app.append(card('الأجناس', h('table', { class: 't' }, h('tr', {}, h('th', {}, 'الجنس'), h('th', {}, 'الأبعاد')),
      Object.values(AJNAS).map(j => h('tr', {}, h('td', {}, j.name), h('td', {}, stepsText(j.steps)))))));
    app.append(card('المقامات', h('table', { class: 't' }, h('tr', {}, h('th', {}, 'المقام'), h('th', {}, 'النوتات'), h('th', {}, '¼')),
      Object.entries(MAQAMAT).map(([k, m]) => h('tr', {}, h('td', {}, h('a', { href: `#/explore/maqam/${k}` }, m.name), h('div', { class: 'muted', style: { fontSize: '.75rem' } }, `${AJNAS[m.ajnas[0]].name} + ${AJNAS[m.ajnas[1]].name}`), h('div', { class: 'muted', style: { fontSize: '.75rem' } }, MAQAM_CHARACTER[k]?.mood || '')),
        h('td', {}, noteList(k, m.root, !!m.rootQuarter)), h('td', {}, m.quarter ? '✓' : ''))))));
  } else if (cur === 'scales') {
    app.append(card('السلالم (من دو)', h('table', { class: 't' }, h('tr', {}, h('th', {}, 'السلم'), h('th', {}, 'الدرجات')),
      Object.entries(SCALES).map(([k, s]) => h('tr', {}, h('td', {}, h('a', { href: `#/explore/scale/${k}` }, s.name), h('div', { class: 'muted ltr', style: { fontSize: '.75rem' } }, s.en)), h('td', { class: 'ltr' }, s.degrees.join(' ')))))));
  } else if (cur === 'circle') {
    app.append(card(null, circleSvg(), h('p', { class: 'muted', style: { fontSize: '.85rem' } }, 'الدائرة الخارجية: المفاتيح الكبيرة وعدد الدييز (#) أو البيمول (♭). الداخلية: النسبي الصغير. المفاتيح المتجاورة تشترك في 6 نوتات من 7.')));
  } else if (cur === 'notes') {
    const host = h('div');
    app.append(h('div', { class: 'stage' }, h('b', {}, 'كل النوتات الطبيعية حتى الفرت 15'), host));
    const fb = new Fretboard(host, { from: 0, to: 15 });
    const dots = [];
    const open = [40, 45, 50, 55, 59, 64];
    for (let s = 0; s < 6; s++) for (let f = 0; f <= 15; f++) { const m = open[s] + f; if ([0, 2, 4, 5, 7, 9, 11].includes(m % 12)) dots.push({ s, f, q: m * 2, kind: m % 12 === 0 ? 'root' : 'note', label: pcName(m % 12) }); }
    fb.setDots(dots);
  } else if (cur === 'rhythms') {
    app.append(card(null, h('table', { class: 't' }, h('tr', {}, h('th', {}, 'الإيقاع'), h('th', {}, 'الميزان'), h('th', {}, 'النمط')),
      Object.values(RHYTHMS).map(r => h('tr', {}, h('td', {}, r.name, h('div', { class: 'muted', style: { fontSize: '.75rem' } }, r.desc)), h('td', {}, r.meter), h('td', { class: 'ltr' }, r.pattern.replace(/D/g, 'دُم ').replace(/T/g, 'تَك ').replace(/k/g, 'ك ').replace(/\./g, '- ')))))),
      h('a', { class: 'btn', href: '#/rhythm' }, 'افتح مشغّل الإيقاعات'));
  }
}

function circleSvg() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-160 -160 320 320'); svg.setAttribute('direction', 'ltr'); svg.style.direction = 'ltr'; svg.setAttribute('class', 'circle-svg'); svg.style.width = '100%'; svg.style.maxWidth = '380px'; svg.style.display = 'block'; svg.style.margin = '0 auto';
  const add = (tag, a, txt) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; svg.appendChild(e); return e; };
  add('circle', { r: 150, fill: 'var(--card2)', stroke: 'var(--line)' });
  add('circle', { r: 98, fill: 'var(--bg2)', stroke: 'var(--line)' });
  const acc = ['', '1#', '2#', '3#', '4#', '5#', '6# / 6♭', '5♭', '4♭', '3♭', '2♭', '1♭'];
  const majors = ['C', 'G', 'D', 'A', 'E', 'B', 'F#/G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
  const minors = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'];
  CIRCLE_OF_FIFTHS.forEach((pc, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a), y = Math.sin(a);
    add('text', { x: x * 124, y: y * 124 + 5, 'text-anchor': 'middle', fill: i === 0 ? 'var(--accent)' : 'var(--text)', 'font-size': 15, 'font-weight': 700 }, majors[i]);
    add('text', { x: x * 124, y: y * 124 + 19, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 8.5 }, acc[i]);
    add('text', { x: x * 76, y: y * 76 + 4, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 11 }, minors[i]);
  });
  return svg;
}

export function renderSettings(app) {
  const s = store.settings();
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'الإعدادات')));
  app.append(card('مدة بقاء الشاشة مضاءة',
    h('p', { class: 'muted', style: { fontSize: '.85rem', marginTop: 0 } }, 'تبقى الشاشة مضاءة أثناء التمرين حتى تمر هذه المدة دون أن تلمسها. العزف والشرح يُحسبان نشاطاً، فلا تنطفئ الشاشة أثناء تشغيل الدرس.'),
    select(SCREEN_OPTIONS, s.screenMinutes ?? 15, v => { store.setSetting('screenMinutes', +v); setScreenTimeout(+v); toast('تم الحفظ'); }, { style: { width: '100%' } })));
  const voiceInfo = h('p', { class: 'muted', style: { fontSize: '.85rem' } });
  const testLine = 'مرحباً بك في أكاديمية الجيتار. هذا اختبار للصوت العربي.';
  setTimeout(() => { if (s.naturalVoice !== false && speech.hasRecorded(testLine)) voiceInfo.textContent = 'الصوت الطبيعي المسجّل مثبت ✓ (يعمل دون إنترنت)'; else speech.hasArabicVoice().then(ok => { voiceInfo.textContent = ok ? 'يُستخدم صوت النطق العربي في الجهاز ✓' : 'لم أجد صوتاً عربياً في الجهاز. ثبّت «اللغة العربية» من إعدادات تحويل النص إلى كلام في أندرويد.'; }); }, 400);
  app.append(card('الشرح الصوتي',
    toggle('تشغيل الشرح الصوتي بالعربي', s.speech, v => { store.setSetting('speech', v); speech.setEnabled(v); }),
    h('div', { style: { marginTop: '6px' } }, toggle('الصوت الطبيعي (صوت بشري مسجّل)', s.naturalVoice !== false, v => { store.setSetting('naturalVoice', v); speech.setRecorded(v); })),
    slider('سرعة الكلام', 0.6, 1.5, 0.05, s.speechRate, v => { store.setSetting('speechRate', v); speech.setRate(v); }, v => `${Math.round(v * 100)}%`),
    h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => speech.speak(testLine) }, 'اختبر الصوت'),
      h('button', { class: 'btn small', onclick: () => speech.openInstall() }, 'تثبيت أصوات النطق')),
    voiceInfo));
  app.append(card('العرض',
    h('label', { class: 'field' }, 'أسماء النوتات', select([{ value: 'ar', label: 'عربية (دو ري مي)' }, { value: 'latin', label: 'لاتينية (C D E)' }], s.notation, v => { store.setSetting('notation', v); setNotation(v); })),
    h('label', { class: 'field', style: { marginTop: '8px' } }, 'العرض الافتراضي على الرقبة', select([{ value: 'note', label: 'اسم النوتة' }, { value: 'degree', label: 'رقم الدرجة' }, { value: 'finger', label: 'رقم الإصبع' }], s.label, v => store.setSetting('label', v))),
    h('div', { style: { marginTop: '10px' } }, toggle('الوضع الفاتح', s.theme === 'light', v => { store.setSetting('theme', v ? 'light' : 'dark'); document.body.classList.toggle('light', v); }))));
  app.append(card('الصوت',
    slider('مستوى الصوت', 0, 1, 0.05, s.volume, v => { store.setSetting('volume', v); setVolume(v); }, v => `${Math.round(v * 100)}%`),
    toggle('المترونوم في التمارين افتراضياً', s.metronome, v => store.setSetting('metronome', v))));
  app.append(card('المنهج',
    toggle('فتح كل المستويات (لأصحاب الخبرة)', s.unlockAll, v => store.setSetting('unlockAll', v))));
  const dataBox = h('textarea', { placeholder: 'الصق هنا نص النسخة الاحتياطية ثم اضغط «استعادة»' });
  const copyText = async txt => {
    try { await navigator.clipboard.writeText(txt); return true; } catch (e) {
      dataBox.value = txt; dataBox.select(); try { return document.execCommand('copy'); } catch (e2) { return false; }
    }
  };
  app.append(card('البيانات',
    h('p', { class: 'muted', style: { fontSize: '.85rem' } }, 'النسخ الاحتياطي ينسخ تقدمك كنص. احفظه في الملاحظات أو أرسله لنفسك، ثم الصقه هنا للاستعادة على أي جهاز.'),
    h('div', { class: 'row', style: { marginBottom: '8px' } },
      h('button', { class: 'btn small', onclick: async () => { const ok = await copyText(store.exportData()); toast(ok ? 'نُسخ تقدمك. الصقه في مكان آمن.' : 'انسخ النص من المربع يدوياً.'); } }, 'نسخ احتياطي'),
      h('button', { class: 'btn small', onclick: () => { try { store.importData(dataBox.value.trim()); toast('تمت الاستعادة'); location.reload(); } catch (e) { toast('النص غير صالح'); } } }, 'استعادة'),
      h('button', { class: 'btn small', onclick: () => { if (confirm('حذف كل التقدم؟')) { store.resetAll(); location.reload(); } } }, 'مسح التقدم')),
    dataBox));
  app.append(card('عن التطبيق', h('p', { class: 'muted' }, 'أكاديمية الجيتار — منهج لجنة من عازف محترف ومايسترو ومدرس موسيقى، برمجة كاملة تعمل دون إنترنت. صوت الجيتار مولّد رقمياً بدقة ربع التون.')));
}
