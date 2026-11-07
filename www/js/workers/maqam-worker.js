// يشغّل تحليل المقام في خيط منفصل حتى لا تتجمد الواجهة
// يستخدم SwiftF0 لتتبع اللحن إن توفر، وإلا خوارزمية YIN.
// إذا وصل صوت المغني المعزول (xv) ندمجه مع الأغنية الأصلية.
import { trackPitch, analyzeFrames, deepAnalyzeFrames, framesFromSwift, mergeVocalFrames, SR } from '../maqam-analyzer.js';
import { detect } from '../swiftf0.js';

self.onmessage = async e => {
  try {
    const { x, x16, xv, xv16, deep } = e.data;
    const progress = p => self.postMessage({ progress: p });
    const both = !!(xv && xv16);
    let frames = null, engine = 'yin', vocalShare = null, mixFrames = null;
    if (x16) {
      const sf = await detect(x16, p => progress(p * (both ? 0.47 : 0.95)));
      if (sf) {
        frames = mixFrames = framesFromSwift(x, sf); engine = 'swiftf0';
        if (both) {
          const sv = await detect(xv16, p => progress(0.47 + p * 0.48));
          if (sv) { frames = mergeVocalFrames(framesFromSwift(xv, sv), frames); vocalShare = frames.vocalShare; }
        }
      }
    }
    if (!frames) frames = trackPitch(both ? xv : x, SR, progress);
    // اختيار الأوضح: صوت المغني المعزول أو الأغنية الأصلية
    // (العزل ممتاز مع الغناء، لكنه قد يشوّه العزف الآلي البحت)
    let vocalsUsed = false;
    if (mixFrames && frames !== mixFrames) {
      const light = { timeline: false, bpm: false };
      const a = analyzeFrames(frames, light), b = analyzeFrames(mixFrames, light);
      const pa = a.ok ? a.ranking[0].prob : -1, pb = b.ok ? b.ranking[0].prob : -1;
      if (pa >= pb) vocalsUsed = true; else frames = mixFrames;
    }
    const res = deep ? deepAnalyzeFrames(frames) : analyzeFrames(frames);
    res.engine = engine;
    if (vocalShare != null) { res.vocalsTried = true; if (vocalsUsed) res.vocalShare = vocalShare; }
    self.postMessage({ result: res });
  } catch (err) {
    self.postMessage({ error: String(err && err.stack || err) });
  }
};
