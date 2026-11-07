// يشغّل تحليل المقام في خيط منفصل حتى لا تتجمد الواجهة
// يستخدم SwiftF0 لتتبع اللحن إن توفر، وإلا خوارزمية YIN
import { trackPitch, analyzeFrames, deepAnalyzeFrames, framesFromSwift, SR } from '../maqam-analyzer.js';
import { detect } from '../swiftf0.js';

self.onmessage = async e => {
  try {
    const { x, x16, deep } = e.data;
    const progress = p => self.postMessage({ progress: p });
    let frames = null, engine = 'yin';
    if (x16) {
      const sf = await detect(x16, p => progress(p * 0.95));
      if (sf) { frames = framesFromSwift(x, sf); engine = 'swiftf0'; }
    }
    if (!frames) frames = trackPitch(x, SR, progress);
    const res = deep ? deepAnalyzeFrames(frames) : analyzeFrames(frames);
    res.engine = engine;
    self.postMessage({ result: res });
  } catch (err) {
    self.postMessage({ error: String(err && err.stack || err) });
  }
};
