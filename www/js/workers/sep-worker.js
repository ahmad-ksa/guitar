// عزل صوت المغني في خيط منفصل
import { separateVocals } from '../spleeter.js';
self.onmessage = async e => {
  try {
    const { L, R } = e.data;
    const v = await separateVocals(L, R, p => self.postMessage({ progress: p }));
    if (!v) { self.postMessage({ vocals: null }); return; }
    self.postMessage({ vocals: v }, [v.buffer]);
  } catch (err) {
    self.postMessage({ error: String(err && err.stack || err) });
  }
};
