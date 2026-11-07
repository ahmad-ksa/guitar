// يشغّل تحليل المقام في خيط منفصل حتى لا تتجمد الواجهة
import { analyze, deepAnalyze, SR } from '../maqam-analyzer.js';
self.onmessage = e => {
  try {
    const fn = e.data.deep ? deepAnalyze : analyze;
    const res = fn(e.data.x, SR, p => self.postMessage({ progress: p }));
    self.postMessage({ result: res });
  } catch (err) {
    self.postMessage({ error: String(err && err.stack || err) });
  }
};
