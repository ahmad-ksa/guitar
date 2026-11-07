// مرجع الأغاني: كل ما حللته مصنفاً حسب الفنان، مع بحث يتجاهل الهمزات والتاء المربوطة والمسافات
import { h, card, askText, toast } from '../ui.js';
import * as store from '../store.js';
import { MAQAMAT } from '../theory.js';
import { normalizeAr, matches } from '../arabic-search.js';
import { tonicName } from './analyzer.js';

const UNKNOWN = 'فنان غير محدد';
const artistKeyOf = name => normalizeAr(name) || ('_' + name);

export function artistsList() {
  const map = new Map();
  for (const s of store.songs()) {
    const name = (s.artist || '').trim() || UNKNOWN;
    const k = normalizeAr(name) || ('_' + name);
    if (!map.has(k)) map.set(k, { name, songs: [] });
    map.get(k).songs.push(s);
  }
  return [...map.values()].sort((a, b) => (a.name === UNKNOWN) - (b.name === UNKNOWN) || a.name.localeCompare(b.name, 'ar'));
}

// يعيد الاسم بالكتابة المحفوظة إن كان الفنان موجوداً (أنغام = انغام)
export function canonicalArtist(name) {
  const k = normalizeAr(name);
  const hit = store.songs().find(s => s.artist && normalizeAr(s.artist) === k);
  return hit ? hit.artist : name.trim();
}

function songRow(s) {
  const m = MAQAMAT[s.maqam];
  return h('a', { class: 'lesson-item', href: `#/analyzer/song/${s.id}` },
    h('span', { class: 'st' }, '♪'),
    h('span', { class: 't' }, h('b', {}, h('bdi', {}, s.name || 'أغنية')),
      h('small', {}, [m ? m.name : '', s.q != null ? `من ${tonicName(s.q)}` : '', s.bpm ? `\u2066${s.bpm} BPM\u2069` : '', s.date ? `\u2066${s.date}\u2069` : ""].filter(Boolean).join(' · ')),
      s.note ? h('small', {}, s.note) : null));
}

export function renderSongbook(app, artistKey) {
  const all = store.songs();
  app.append(h('div', { class: 'topbar' },
    artistKey ? h('button', { class: 'back', onclick: () => { location.hash = '#/songbook'; } }, '→') : null,
    h('h1', {}, 'مرجع الأغاني'), h('span', { class: 'pill' }, `${all.length} أغنية`)));

  if (artistKey) {
    let key = artistKey;
    try { key = decodeURIComponent(artistKey); } catch (e) {}
    const a = artistsList().find(x => artistKeyOf(x.name) === key);
    if (!a) { app.append(card(null, h('p', {}, 'لا توجد أغانٍ لهذا الفنان.'))); return; }
    const rename = h('button', { class: 'btn small' }, '✎ تعديل الاسم');
    rename.addEventListener('click', async () => {
      const v = await askText({ title: 'اسم الفنان', value: a.name === UNKNOWN ? '' : a.name, skipLabel: 'إلغاء' });
      if (!v) return;
      const canon = canonicalArtist(v);
      a.songs.forEach(s => store.updateSong(s.id, { artist: canon }));
      location.hash = `#/songbook/${encodeURIComponent(artistKeyOf(canon))}`;
    });
    const maqams = {};
    a.songs.forEach(s => { if (s.maqam) maqams[s.maqam] = (maqams[s.maqam] || 0) + 1; });
    app.append(h('section', { class: 'card hl' },
      h('div', { class: 'artist-head' }, h('div', { class: 'artist-av' }, a.name[0]), h('div', { style: { flex: 1 } }, h('h2', { style: { margin: 0 } }, a.name), h('div', { class: 'muted' }, `${a.songs.length} أغنية`)), rename),
      Object.keys(maqams).length ? h('div', { class: 'row', style: { marginTop: '8px' } }, Object.entries(maqams).sort((x, y) => y[1] - x[1]).map(([id, n]) => h('span', { class: 'pill' }, `${(MAQAMAT[id]?.name ?? id).replace('مقام ', '')} ×${n}`))) : null));
    app.append(card(null, ...a.songs.map(songRow)));
    return;
  }

  const q = h('input', { type: 'text', placeholder: 'ابحث باسم الفنان أو الأغنية أو المقام…', style: { width: '100%' } });
  const out = h('div');
  app.append(card(null, q, h('div', { class: 'muted', style: { fontSize: '.78rem', marginTop: '6px' } }, 'البحث لا يفرّق بين أ وا وإ، ولا بين ة وه، ولا بين ى وي، ويتجاهل المسافات: «عبد الله» = «عبدالله».')), out);
  if (!all.length) {
    out.append(card(null, h('p', {}, 'المرجع فارغ. حلّل أغنية في محلل المقام، وسيطلب منك اسم المغني واسم الأغنية لتُحفظ هنا.'), h('a', { class: 'btn primary', href: '#/analyzer' }, '🔍 افتح محلل المقام')));
    return;
  }
  function draw() {
    out.innerHTML = '';
    const term = q.value;
    if (!normalizeAr(term)) {
      out.append(card('الفنانون', ...artistsList().map(a => h('a', { class: 'lesson-item', href: `#/songbook/${encodeURIComponent(artistKeyOf(a.name))}` },
        h('span', { class: 'artist-av', style: { width: '32px', height: '32px' } }, a.name[0]),
        h('span', { class: 't' }, h('b', {}, h('bdi', {}, a.name)), h('small', {}, `${a.songs.length} أغنية`))))));
      out.append(card('أحدث الأغاني', ...all.slice(0, 10).map(songRow)));
      return;
    }
    const arts = artistsList().filter(a => matches(a.name, term));
    const songs = all.filter(s => matches(s.name, term) || matches(s.artist, term) || (s.maqam && matches(MAQAMAT[s.maqam]?.name ?? s.maqam, term)) || matches(s.note, term));
    if (arts.length) out.append(card('فنانون', ...arts.map(a => h('a', { class: 'lesson-item', href: `#/songbook/${encodeURIComponent(artistKeyOf(a.name))}` },
      h('span', { class: 'artist-av', style: { width: '32px', height: '32px' } }, a.name[0]), h('span', { class: 't' }, h('b', {}, h('bdi', {}, a.name)), h('small', {}, `${a.songs.length} أغنية`))))));
    out.append(card(`أغانٍ (${songs.length})`, ...(songs.length ? songs.map(s => h('div', {}, songRow(s), h('div', { class: 'muted', style: { fontSize: '.75rem', marginTop: '-6px', paddingInlineStart: '38px' } }, s.artist || UNKNOWN))) : [h('p', { class: 'muted' }, 'لا نتائج.')])));
  }
  q.addEventListener('input', draw);
  draw();
}
