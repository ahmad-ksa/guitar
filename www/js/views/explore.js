// مستكشف السلالم والمقامات + مكتبة الكوردات
import { h, select, slider, toggle, card } from '../ui.js';
import { Fretboard, chordDiagram, voicingFreqs } from '../fretboard.js';
import { allPositions, windowPattern, npsPattern, labelFor, assignFingers } from '../exercises.js';
import { SCALES, MAQAMAT, ROOTS, getScale, scaleOffsets, CHORD_TYPES, chordVoicings, chordName, chordNotes, pcName, noteName, rootQ, diatonicChords, spelledName } from '../theory.js';
import { Player } from '../player.js';
import { strum, pluck, droneStart, droneStop } from '../audio.js';
import { freqOfQ } from '../theory.js';
import * as store from '../store.js';
import { stepsText } from '../lessons/helpers.js';

let player = null;
export function cleanup() { if (player) player.stop(); droneStop(); }

export function renderExplore(app, params = {}) {
  cleanup();
  const st = { kind: params.kind || 'scale', id: params.id || 'major', root: params.root != null ? +params.root : 0, label: store.settings().label || 'note', view: 'all', box: 0, bpm: 90, drone: false };
  if (MAQAMAT[st.id]) { st.kind = 'maqam'; if (params.root == null) st.root = MAQAMAT[st.id].root; }
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'مستكشف السلالم والمقامات')));
  const controls = card(null);
  const info = card(null);
  const boardHost = h('div', { class: 'stage' });
  app.append(controls, boardHost, info);
  let board = null;
  player = new Player(null, { metronome: false, countIn: false });

  const scaleOpts = () => (st.kind === 'scale'
    ? Object.entries(SCALES).map(([k, v]) => ({ value: k, label: v.name }))
    : Object.entries(MAQAMAT).map(([k, v]) => ({ value: k, label: v.name + (v.quarter ? ' ¼' : '') })));

  function rq() { return st.kind === 'maqam' ? !!MAQAMAT[st.id].rootQuarter : false; }

  function positions() {
    const n = scaleOffsets(st.id).length;
    if (st.view === 'all') return allPositions(st.id, st.root, 0, 15, { rootQuarter: rq() });
    if (st.view === 'box') return npsPattern(st.id, st.root, { nps: n === 5 ? 2 : 3, box: st.box, rootQuarter: rq() });
    // موضع: نافذة حول القرار على الوتر 5 أو 6
    const r6 = ((st.root - 4) % 12 + 12) % 12;
    const from = Math.max(0, (r6 === 0 ? 0 : r6) - 1);
    return windowPattern(st.id, st.root, from, from + 4, { rootQuarter: rq() });
  }

  function draw() {
    controls.innerHTML = '';
    const kindSeg = h('div', { class: 'seg' }, [['scale', 'سلالم غربية'], ['maqam', 'مقامات عربية']].map(([k, l]) =>
      h('button', { class: st.kind === k ? 'on' : '', onclick: () => { st.kind = k; st.id = k === 'scale' ? 'major' : 'bayati'; st.root = k === 'scale' ? 0 : MAQAMAT.bayati.root; st.box = 0; draw(); } }, l)));
    const sSel = select(scaleOpts(), st.id, v => { st.id = v; if (st.kind === 'maqam') st.root = MAQAMAT[v].root; st.box = 0; draw(); });
    const rSel = select(ROOTS.map(r => ({ value: r.pc, label: rq() && r.pc === st.root ? pcName(r.pc) + ' ½' : pcName(r.pc) })), st.root, v => { st.root = +v; draw(); });
    const viewSeg = h('div', { class: 'seg' }, [['all', 'الزند كاملاً'], ['pos', 'موضع'], ['box', 'صناديق']].map(([k, l]) =>
      h('button', { class: st.view === k ? 'on' : '', onclick: () => { st.view = k; draw(); } }, l)));
    const labSeg = h('div', { class: 'seg' }, [['note', 'النوتة'], ['degree', 'الدرجة'], ['finger', 'الإصبع']].map(([k, l]) =>
      h('button', { class: st.label === k ? 'on' : '', onclick: () => { st.label = k; draw(); } }, l)));
    controls.append(h('div', { class: 'row' }, kindSeg), h('div', { class: 'row', style: { marginTop: '8px' } }, sSel, h('span', { class: 'muted' }, 'من'), rSel),
      h('div', { class: 'row', style: { marginTop: '8px' } }, viewSeg, labSeg));
    if (st.view === 'box') {
      const n = scaleOffsets(st.id).length;
      controls.append(h('div', { class: 'row', style: { marginTop: '8px' } }, h('span', { class: 'muted' }, 'الصندوق:'),
        h('div', { class: 'seg' }, [...Array(n)].map((_, i) => h('button', { class: st.box === i ? 'on' : '', onclick: () => { st.box = i; draw(); } }, i + 1)))));
    }

    let ps = positions();
    if (st.label === 'finger') ps = assignFingers(ps);
    const from = st.view === 'all' ? 0 : Math.max(0, Math.min(...ps.map(p => p.f)) - 1);
    const to = st.view === 'all' ? 15 : Math.max(from + 6, Math.max(...ps.map(p => p.f)) + 1);
    boardHost.innerHTML = '';
    const bh = h('div');
    boardHost.append(bh);
    board = new Fretboard(bh, { from, to });
    board.setDots(ps.map(p => ({ ...p, kind: p.deg === 0 ? 'root' : (p.qt ? 'quarter' : 'note'), label: st.label === 'finger' && st.view === 'all' ? labelFor(p, 'degree', st.id) : labelFor(p, st.label, st.id, st.root) })));
    player.setBoard(board);
    const playBtn = h('button', { class: 'btn primary' }, '▶ اعزف');
    playBtn.addEventListener('click', async () => {
      const seq = st.view === 'all' ? windowPattern(st.id, st.root, Math.max(0, from), Math.max(0, from) + 4, { rootQuarter: rq() }) : ps;
      const sorted = [...seq].sort((a, b) => a.q - b.q);
      const uniq = sorted.filter((p, i) => i === 0 || p.q !== sorted[i - 1].q);
      const up = st.view === 'all' ? (() => { const r = uniq.findIndex(p => p.deg === 0); return uniq.slice(Math.max(0, r), r + scaleOffsets(st.id).length + 1); })() : uniq;
      const evs = [...up, ...[...up].reverse().slice(1)].map((p, i) => ({ ...p, t: i / 2, d: 0.5 }));
      await player.play({ events: evs, beats: evs.length / 2 + 1 }, st.bpm, { metronome: false, countIn: false, drone: st.drone ? rootQ(st.root, rq(), 38) : null });
    });
    boardHost.append(h('div', { class: 'row', style: { marginTop: '10px' } }, playBtn, h('button', { class: 'btn', onclick: () => player.stop() }, '■'),
      toggle('درون القرار', st.drone, v => { st.drone = v; }),
    ), slider('السرعة', 40, 200, 1, st.bpm, v => { st.bpm = v; }, v => `${v} BPM`),
    h('p', { class: 'muted', style: { fontSize: '.8rem', margin: '6px 0 0' } }, 'اضغط على أي نقطة في الزند لسماعها. اسحب الزند يميناً ويساراً لرؤية بقية الفرتات.'));

    // معلومات
    info.innerHTML = '';
    const sc = getScale(st.id);
    const off = scaleOffsets(st.id);
    const base = (48 + st.root) * 2 + (rq() ? 1 : 0);
    const names = off.map((o, i) => (off.length === 7 ? spelledName(base + o, st.root, i) : noteName(base + o)));
    info.append(h('h3', {}, `${sc.name} من ${names[0]}`));
    if (sc.desc) info.append(h('p', {}, sc.desc));
    info.append(h('table', { class: 't' },
      h('tr', {}, h('th', {}, 'النوتات'), h('td', {}, names.join('، '))),
      h('tr', {}, h('th', {}, 'المسافات'), h('td', {}, stepsText(sc.steps || sc.asc))),
      sc.degrees ? h('tr', {}, h('th', {}, 'الدرجات'), h('td', { class: 'ltr' }, sc.degrees.join('  '))) : null,
      sc.en ? h('tr', {}, h('th', {}, 'بالإنجليزية'), h('td', { class: 'ltr' }, sc.en)) : null,
      sc.dsc ? h('tr', {}, h('th', {}, 'نزولاً'), h('td', {}, stepsText(sc.dsc))) : null,
    ));
    if (st.id === 'major' || st.id === 'minor') {
      const dia = diatonicChords(st.root, st.id === 'major' ? 'major' : 'minor');
      info.append(h('h3', { style: { marginTop: '12px' } }, 'كوردات السلم'),
        h('div', { class: 'row' }, dia.map(c => h('button', { class: 'btn small', onclick: () => { const v = chordVoicings(c.pc, c.type)[0]; if (v) strum(voicingFreqs(v)); } }, h('span', { class: 'ltr' }, `${c.roman} ${chordName(c.pc, c.type, 'latin')}`)))));
    }
  }
  draw();
}

export function renderChords(app, params = {}) {
  cleanup();
  const st = { root: params.root != null ? +params.root : 0, type: params.type || 'maj' };
  app.append(h('div', { class: 'topbar' }, h('h1', {}, 'مكتبة الكوردات')));
  const ctl = card(null);
  const out = h('div');
  app.append(ctl, out);
  function draw() {
    ctl.innerHTML = '';
    ctl.append(h('div', { class: 'row' },
      select(ROOTS.map(r => ({ value: r.pc, label: `${r.ar} (${r.latin})` })), st.root, v => { st.root = +v; draw(); }),
      select(Object.entries(CHORD_TYPES).map(([k, v]) => ({ value: k, label: `${v.name} ${v.sym ? '(' + v.sym + ')' : ''}` })), st.type, v => { st.type = v; draw(); })));
    const notes = chordNotes(st.root, st.type);
    ctl.append(h('p', { style: { margin: '8px 0 0' } }, h('b', { class: 'ltr' }, chordName(st.root, st.type, 'latin')), ' = ', notes.map(n => pcName(n)).join('، '),
      h('span', { class: 'muted' }, `  (الفواصل: ${CHORD_TYPES[st.type].iv.join('، ')} نصف تون)`)));
    out.innerHTML = '';
    const vs = chordVoicings(st.root, st.type);
    if (!vs.length) { out.append(card(null, h('p', {}, 'لا يوجد شكل جاهز لهذا الكورد.'))); return; }
    const grid = h('div', { class: 'chords-grid' });
    vs.forEach(v => {
      const c = h('div', { class: 'chord-card' }, chordDiagram(v, chordName(st.root, st.type, 'latin')), h('small', {}, v.label));
      c.addEventListener('click', () => strum(voicingFreqs(v)));
      grid.append(c);
    });
    out.append(card('الأشكال (اضغط للاستماع)', grid));
    // على الزند
    const fbh = h('div');
    out.append(h('div', { class: 'stage' }, h('b', {}, 'نوتات الكورد على الزند كاملاً'), fbh));
    const fb = new Fretboard(fbh, { from: 0, to: 15 });
    const dots = [];
    for (let s = 0; s < 6; s++) for (let f = 0; f <= 15; f++) {
      const pc = ([40, 45, 50, 55, 59, 64][s] + f) % 12;
      const idx = notes.indexOf(pc);
      if (idx >= 0) dots.push({ s, f, q: ([40, 45, 50, 55, 59, 64][s] + f) * 2, kind: idx === 0 ? 'root' : 'chord', label: ['1', '3', '5', '7', '9'][idx] && CHORD_TYPES[st.type].iv[idx] != null ? ivLabel(CHORD_TYPES[st.type].iv[idx]) : '' });
    }
    fb.setDots(dots);
  }
  draw();
}
function ivLabel(iv) { return { 0: '1', 2: '2', 3: 'b3', 4: '3', 5: '4', 6: 'b5', 7: '5', 8: '#5', 9: '6', 10: 'b7', 11: '7', 14: '9' }[iv] || ''; }
