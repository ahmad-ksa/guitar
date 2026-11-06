// الشرح الصوتي العربي: محرك النطق في أندرويد (عبر Capacitor) مع بديل المتصفح
import { Capacitor, registerPlugin } from './vendor/capacitor-core.js';
import { cleanForSpeech, voiceKey } from './voicekey.js';

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

const clean = cleanForSpeech;

// ===== الأصوات الطبيعية المسجلة مسبقاً (صوت عصبي) =====
let voiceIndex = null;
const voiceReady = fetch('audio/voice/index.json').then(r => (r.ok ? r.json() : [])).then(l => { voiceIndex = new Set(l); }).catch(() => { voiceIndex = new Set(); });
let currentAudio = null;
let useRecorded = true;
export function setRecorded(v) { useRecorded = v; }
export function hasRecorded(text) { return !!(voiceIndex && voiceIndex.has(voiceKey(text))); }

function playRecorded(id, cancelled) {
  return new Promise(resolve => {
    const a = new Audio(`audio/voice/${id}.mp3`);
    currentAudio = a;
    a.playbackRate = rate;
    try { a.preservesPitch = true; } catch (e) {}
    a.onended = () => resolve('done');
    a.onerror = () => resolve('error');
    a.play().catch(() => resolve('error'));
    cancelled.then(() => { a.pause(); resolve('cancel'); });
  });
}

// هل يوجد محرك نطق يعمل؟ (يُستخدم لحساب مدة عرض النص في وضع المشاهدة)
export function canSpeak() {
  if (!enabled) return false;
  if (useRecorded && voiceIndex && voiceIndex.size) return true;
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
  if (useRecorded) {
    if (!voiceIndex) await Promise.race([voiceReady, cancelled]);
    if (token !== speakingToken) return false;
    const id = voiceKey(text);
    if (voiceIndex && voiceIndex.has(id)) {
      const r = await playRecorded(id, cancelled);
      if (r === 'done') return token === speakingToken;
      if (r === 'cancel' || token !== speakingToken) return false;
      // خطأ في التشغيل: انتقل لمحرك النطق
    }
  }
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
  if (currentAudio) { try { currentAudio.pause(); } catch (e) {} currentAudio = null; }
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
