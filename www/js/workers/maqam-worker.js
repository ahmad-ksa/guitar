// يشغّل تحليل المقام في خيط منفصل حتى لا تتجمد الواجهة
import { analyze, SR } from '../maqam-analyzer.js';
self.onmessage = e => {
  try {
    const res = analyze(e.data.x, SR, p => self.postMessage({ progress: p }));
    self.postMessage({ result: res });
  } catch (err) {
    self.postMessage({ error: String(err && err.stack || err) });
  }
};
