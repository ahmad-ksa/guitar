// الشرح الصوتي العربي: محرك النطق في أندرويد (عبر Capacitor) مع بديل المتصفح

let rate = 1.0;
let enabled = true;
let nativeTTS = null;
let webVoice = null;
let speakingToken = 0;

export function setRate(r) { rate = r; }
export function setEnabled(v) { enabled = v; if (!v) stop(); }
export function isEnabled() { return enabled; }

function initNative() {
  if (nativeTTS !== null) return nativeTTS;
  try {
    const C = window.Capacitor;
    if (C && C.isNativePlatform && C.isNativePlatform() && C.registerPlugin) {
      nativeTTS = C.registerPlugin('TextToSpeech');
    } else nativeTTS = false;
  } catch (e) { nativeTTS = false; }
  return nativeTTS;
}

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

export async function speak(text) {
  const token = ++speakingToken;
  if (!enabled || !text) return;
  const t = clean(text);
  const tts = initNative();
  if (tts) {
    try {
      try {
        await tts.speak({ text: t, lang: 'ar-SA', rate, pitch: 1.0, volume: 1.0, category: 'playback' });
      } catch (e1) {
        if (token !== speakingToken) return;
        await tts.speak({ text: t, lang: 'ar', rate, pitch: 1.0, volume: 1.0, category: 'playback' });
      }
      return;
    } catch (e) {
      console.warn('native TTS failed', e);
    }
  }
  if (!('speechSynthesis' in window)) return;
  return new Promise(resolve => {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'ar-SA';
      if (webVoice || pickWebVoice()) u.voice = webVoice;
      u.rate = rate;
      const done = () => resolve();
      u.onend = done; u.onerror = done;
      // حماية من تعليق بعض المتصفحات
      const guard = setTimeout(done, Math.max(4000, t.length * 140 / rate));
      u.onend = () => { clearTimeout(guard); done(); };
      speechSynthesis.speak(u);
      if (token !== speakingToken) { speechSynthesis.cancel(); done(); }
    } catch (e) { resolve(); }
  });
}

export async function stop() {
  speakingToken++;
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
  if (tts && tts.openInstall) { try { await tts.openInstall(); } catch (e) {} }
}
