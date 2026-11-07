// تطبيع النص العربي للبحث: الهمزات، التاء المربوطة/الهاء، الألف المقصورة، التشكيل، المسافات
export function normalizeAr(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ی/g, 'ي').replace(/ک/g, 'ك').replace(/ھ/g, 'ه')
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6F0))
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
