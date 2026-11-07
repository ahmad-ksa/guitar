// تطبيع النص العربي للبحث: الهمزات، التاء المربوطة/الهاء، الألف المقصورة، التشكيل، المسافات
export function normalizeAr(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[ً-ٰٟۖ-ۭ]/g, '') // التشكيل
    .replace(/ـ/g, '')                               // التطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-_.،,'"«»()]+/g, '');                   // المسافات والفواصل: «عبد الله» = «عبدالله»
}

export function matches(text, query) {
  const q = normalizeAr(query);
  if (!q) return true;
  return normalizeAr(text).includes(q);
}
