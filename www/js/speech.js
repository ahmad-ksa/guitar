// الشرح الصوتي العربي: محرك النطق في أندرويد (عبر Capacitor) مع بديل المتصفح
import { Capacitor, registerPlugin } from './vendor/capacitor-core.js';

let rate = 1.0;
let enabled = true;
let nativeTTS = null;
let webVoice = null;
let speakingToken = 0;
let cancelCurrent = null; // يحل وعد النطق الجاري عند الإيقاف

export function setRate(r) { rate = r; }
export function setEnabled(v) { enabled = v; if (!v) stop(); }
export function isEnabled() { return enabled; }

function initNative() {
  if (nativeTTS !== null) return nativeTTS;
  try {
    nativeTTS = Capacitor.isNativePlatform() ? registerPlugin('TextToSpeech') : false;
  } catch (e) { nativeTTS = false; }
  return nativeTTS;
}

export function isNative() { try { return Capacitor.isNativePlatform(); } catch (e) { return false; } }

function pickWebVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  webVoice = voices.find(v => /^ar[-_]SA/i.test(v.lang)) || voices.find(v => /^ar/i.test(v.lang)) || null;
  return webVoice;
}
if ('speechSynthesis' in window) {
  pickWebVoice();
  speechSynthesis.onvoiceschanged = pickWebVoice;
}

// تنظيف النص للنطق: إزالة رموز لا تُقرأ جيداً
function clean(text) {
  return text
    .replace(/\s*\([A-Za-z0-9#♭½°+\-–\/ ,]+\)/g, '')
    .replace(/½♭/g, ' نصف بيمول')
    .replace(/♭/g, ' بيمول')
    .replace(/#/g, ' دييز')
    .replace(/[*_`]/g, '')
    .replace(/→|←/g, ' ثم ')
    .replace(/\bBPM\b/gi, 'نبضة في الدقيقة');
}

// هل يوجد محرك نطق يعمل؟ (يُستخدم لحساب مدة عرض النص في وضع المشاهدة)
export function canSpeak() {
  if (!enabled) return false;
  if (initNative()) return true;
  return 'speechSynthesis' in window && !!(webVoice || pickWebVoice());
}

// يعيد true إن اكتمل النطق، وfalse إن أُلغي أو تعذّر
export async function speak(text) {
  if (cancelCurrent) cancelCurrent();
  const token = ++speakingToken;
  if (!enabled || !text) return false;
  const t = clean(text);
  const cancelled = new Promise(r => { cancelCurrent = () => r('cancel'); });
  const tts = initNative();
  if (tts) {
    const attempt = lang => tts.speak({ text: t, lang, rate, pitch: 1.0, volume: 1.0, category: 'playback', queueStrategy: 0 });
    try {
      let r;
      try { r = await Promise.race([attempt('ar-SA').then(() => 'done'), cancelled]); }
      catch (e1) {
        if (token !== speakingToken) return false;
        r = await Promise.race([attempt('ar').then(() => 'done'), cancelled]);
      }
      return r === 'done' && token === speakingToken;
    } catch (e) {
      console.warn('native TTS failed', e);
      return false;
    }
  }
  if (!('speechSynthesis' in window)) return false;
  const p = new Promise(resolve => {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'ar-SA';
      if (webVoice || pickWebVoice()) u.voice = webVoice;
      u.rate = rate;
      const guard = setTimeout(() => resolve('done'), Math.max(4000, t.length * 140 / rate));
      u.onend = () => { clearTimeout(guard); resolve('done'); };
      u.onerror = () => { clearTimeout(guard); resolve('error'); };
      speechSynthesis.speak(u);
    } catch (e) { resolve('error'); }
  });
  const r = await Promise.race([p, cancelled]);
  return r === 'done' && token === speakingToken;
}

export async function stop() {
  speakingToken++;
  if (cancelCurrent) { cancelCurrent(); cancelCurrent = null; }
  const tts = initNative();
  if (tts) { try { await tts.stop(); } catch (e) {} }
  if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch (e) {} }
}

export async function hasArabicVoice() {
  const tts = initNative();
  if (tts) {
    try {
      const r = await tts.getSupportedLanguages();
      return (r.languages || []).some(l => /^ar/i.test(l));
    } catch (e) { return true; }
  }
  return !!pickWebVoice();
}

export async function openInstall() {
  const tts = initNative();
  if (tts) { try { await tts.openInstall(); } catch (e) {} }
}
