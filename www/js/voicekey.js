// مشترك بين التطبيق وسكربت توليد الأصوات: تنظيف النص ومفتاح ملف الصوت
export function cleanForSpeech(text) {
  return String(text)
    .replace(/\s*\([A-Za-z0-9#♭½°+\-–\/ ,]+\)/g, '')
    .replace(/½♭/g, ' نصف بيمول')
    .replace(/♭/g, ' بيمول')
    .replace(/#/g, ' دييز')
    .replace(/[*_`«»]/g, '')
    .replace(/→|←/g, ' ثم ')
    .replace(/\bBPM\b/gi, 'نبضة في الدقيقة')
    .replace(/\s+/g, ' ')
    .trim();
}

// بصمة 64-بت (FNV-1a مزدوج) لاسم ملف الصوت
export function voiceKey(text) {
  const t = cleanForSpeech(text);
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    h2 = (h2 ^ (h2 >>> 15)) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
