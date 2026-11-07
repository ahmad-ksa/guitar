// نقطة الدخول: الموجّه والتنقل
import { h, icon } from './ui.js';
import { Capacitor, registerPlugin } from './vendor/capacitor-core.js';
import * as store from './store.js';
import * as speech from './speech.js';
import { setNotation } from './theory.js';
import { setVolume, getCtx } from './audio.js';
import { renderHome, renderLevels, renderLevel, renderProgress, renderCommittee, toolsGrid } from './views/main.js';
import { renderLesson, cleanup as cleanLesson, pause as pauseLesson } from './views/lesson.js';
import { renderExplore, renderChords, cleanup as cleanExplore } from './views/explore.js';
import { renderTuner, renderRhythm, renderEar, renderSongs, cleanup as cleanTools, pause as pauseTools } from './views/tools.js';
import { renderReference, renderSettings } from './views/reference.js';
import { renderAnalyzer, cleanup as cleanAnalyzer } from './views/analyzer.js';
import { renderSongbook } from './views/songbook.js';
import { setScreenTimeout, activity } from './screen.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');

const s = store.settings();
setNotation(s.notation);
speech.setRate(s.speechRate);
speech.setEnabled(s.speech);
speech.setRecorded(s.naturalVoice !== false);
setScreenTimeout(s.screenMinutes ?? 15);
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, activity, { passive: true }));
if (s.theme === 'light') document.body.classList.add('light');

const NAV = [['#/', 'home', 'الرئيسية'], ['#/levels', 'book', 'الدروس'], ['#/tools', 'tools', 'الأدوات'], ['#/reference', 'ref', 'المرجع'], ['#/settings', 'gear', 'الإعدادات']];
function drawNav(path) {
  nav.innerHTML = '';
  for (const [href, ic, label] of NAV) {
    const on = href === '#/' ? path === '' : path.startsWith(href.slice(2).split('/')[0]) || (href === '#/levels' && /^(level|lesson|exam)/.test(path)) || (href === '#/tools' && /^(explore|chords|tuner|rhythm|ear|songs|progress|analyzer|songbook)/.test(path));
    nav.append(h('a', { href, class: on ? 'on' : '' }, icon(ic), label));
  }
}

function route() {
  cleanLesson(); cleanExplore(); cleanTools(); cleanAnalyzer();
  const path = location.hash.replace(/^#\/?/, '');
  const [p0, p1, p2, p3] = path.split('/');
  app.innerHTML = '';
  window.scrollTo(0, 0);
  drawNav(path);
  try {
    switch (p0) {
      case '': renderHome(app); break;
      case 'levels': renderLevels(app); break;
      case 'level': renderLevel(app, p1); break;
      case 'lesson': renderLesson(app, p1); break;
      case 'exam': renderLesson(app, p1, true); break;
      case 'tools': app.append(h('div', { class: 'topbar' }, h('h1', {}, 'الأدوات'))); app.append(toolsGrid()); break;
      case 'explore': renderExplore(app, p1 ? { kind: p1, id: p2, root: p3 } : {}); break;
      case 'chords': renderChords(app); break;
      case 'tuner': renderTuner(app); break;
      case 'rhythm': renderRhythm(app); break;
      case 'ear': renderEar(app); break;
      case 'songs': renderSongs(app); break;
      case 'analyzer': renderAnalyzer(app, p1 === 'song' ? p2 : null); break;
      case 'songbook': renderSongbook(app, p1); break;
      case 'reference': renderReference(app, p1); break;
      case 'settings': renderSettings(app); break;
      case 'progress': renderProgress(app); break;
      case 'committee': renderCommittee(app); break;
      default: renderHome(app);
    }
  } catch (e) {
    console.error(e);
    app.append(h('div', { class: 'card' }, h('h3', {}, 'حدث خطأ'), h('pre', { class: 'ltr', style: { whiteSpace: 'pre-wrap', fontSize: '.75rem' } }, String(e.stack || e))));
  }
}

window.addEventListener('hashchange', route);
// فتح سياق الصوت عند أول لمسة (شرط المتصفحات)
const unlock = () => { getCtx(); setVolume(store.settings().volume); window.removeEventListener('pointerdown', unlock); };
window.addEventListener('pointerdown', unlock);
document.addEventListener('visibilitychange', () => { if (document.hidden) { speech.stop(); pauseLesson(); pauseTools(); cleanExplore(); } });

// زر الرجوع في أندرويد: يرجع للصفحة السابقة، ويخرج فقط من الرئيسية
try {
  if (Capacitor.isNativePlatform()) {
    const AppPlugin = registerPlugin('App');
    AppPlugin.addListener('backButton', () => {
      const path = location.hash.replace(/^#\/?/, '');
      if (path === '') AppPlugin.exitApp();
      else if (history.length > 1) history.back();
      else location.hash = '#/';
    });
  }
} catch (e) { console.warn(e); }
route();
