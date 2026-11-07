// عزل صوت المغني في خيط منفصل. يبقى العامل حياً لمعالجة الأغنية على دفعات
// ويرجع الصوت المعزول بتردد 22050 (النموذج لا ينتج شيئاً فوق 11 كيلوهرتز)
import { separateVocals } from '../spleeter.js';
self.onmessage = async e => {
  const { L, R, id } = e.data;
  try {
    const v = await separateVocals(L, R, p => self.postMessage({ id, progress: p }));
    if (!v) { self.postMessage({ id, vocals: null }); return; }
    const out = new Float32Array(Math.ceil(v.length / 2));
    for (let i = 0; i < out.length; i++) out[i] = v[2 * i];
    self.postMessage({ id, vocals: out }, [out.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack || err) });
  }
};
