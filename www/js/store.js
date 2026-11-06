// حفظ التقدم والإعدادات على الجهاز
const KEY = 'guitar-academy-v1';

const defaults = {
  settings: { notation: 'ar', speech: true, naturalVoice: true, speechRate: 1.0, label: 'note', volume: 0.9, unlockAll: false, metronome: true, theme: 'dark' },
  progress: { done: {}, quiz: {}, bestBpm: {}, checks: {}, minutes: 0, days: {}, last: null, exams: {} },
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(defaults);
    const s = JSON.parse(raw);
    return {
      settings: { ...clone(defaults.settings), ...(s.settings || {}) },
      progress: { ...clone(defaults.progress), ...(s.progress || {}) },
    };
  } catch (e) { return clone(defaults); }
}

export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
export function settings() { return state.settings; }
export function progress() { return state.progress; }
export function setSetting(k, v) { state.settings[k] = v; save(); }

export function markDone(id) { state.progress.done[id] = Date.now(); state.progress.last = id; save(); }
export function isDone(id) { return !!state.progress.done[id]; }
export function setLast(id) { state.progress.last = id; save(); }
export function setQuiz(id, score) { state.progress.quiz[id] = Math.max(score, state.progress.quiz[id] || 0); save(); }
export function setBest(id, bpm) { if (bpm > (state.progress.bestBpm[id] || 0)) { state.progress.bestBpm[id] = bpm; save(); return true; } return false; }
export function best(id) { return state.progress.bestBpm[id] || 0; }
export function setCheck(id, i, v) { const c = state.progress.checks[id] || {}; c[i] = v; state.progress.checks[id] = c; save(); }
export function checks(id) { return state.progress.checks[id] || {}; }
export function setExam(level, v) { state.progress.exams[level] = v; save(); }
export function examPassed(level) { return !!state.progress.exams[level]; }

let sessionStart = Date.now();
export function tickPractice() {
  const mins = (Date.now() - sessionStart) / 60000;
  if (mins >= 1) {
    state.progress.minutes += Math.floor(mins);
    const day = new Date().toISOString().slice(0, 10);
    state.progress.days[day] = (state.progress.days[day] || 0) + Math.floor(mins);
    sessionStart = Date.now();
    save();
  }
}
export function resetPractice() { sessionStart = Date.now(); }

export function streak() {
  const days = state.progress.days;
  let n = 0;
  const d = new Date();
  for (;;) {
    const k = d.toISOString().slice(0, 10);
    if (days[k]) { n++; d.setDate(d.getDate() - 1); } else break;
  }
  return n;
}

export function resetAll() { state = clone(defaults); save(); }
export function exportData() { return JSON.stringify(state); }
export function importData(json) { const s = JSON.parse(json); state = { settings: { ...clone(defaults.settings), ...s.settings }, progress: { ...clone(defaults.progress), ...s.progress } }; save(); }
