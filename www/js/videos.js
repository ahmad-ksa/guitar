// فيديوهات الدروس: بث من الإنترنت، أو تحميلها للجهاز ومشاهدتها بدون إنترنت.
// التحميل يتم بإضافتَي Filesystem و FileTransfer (أصلية في أندرويد).
import { Capacitor, registerPlugin } from './vendor/capacitor-core.js';

export const VIDEO_BASE = 'https://github.com/ahmad-ksa/guitar/releases/download/videos/';
const DIR = 'DATA', FOLDER = 'videos';
const KEY = 'ga.videos.downloaded';
const native = () => Capacitor.isNativePlatform();
let FS = null, FT = null;
const fs = () => FS || (FS = registerPlugin('Filesystem'));
const ft = () => FT || (FT = registerPlugin('FileTransfer'));

function loadSet() { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); } }
function saveSet(s) { try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch (e) {} }

export const canDownload = () => native();
export function isDownloaded(id) { return loadSet().has(id); }
export function downloadedCount() { return loadSet().size; }
export const remoteUrl = id => VIDEO_BASE + encodeURIComponent(id) + '.mp4';

// رابط التشغيل: الملف المحلي إن وُجد، وإلا البث
export async function videoSrc(id) {
  if (native() && isDownloaded(id)) {
    try {
      const { uri } = await fs().getUri({ directory: DIR, path: `${FOLDER}/${id}.mp4` });
      await fs().stat({ path: uri });
      return Capacitor.convertFileSrc(uri);
    } catch (e) { const s = loadSet(); s.delete(id); saveSet(s); }
  }
  return remoteUrl(id);
}

let progressHandle = null, progressCb = null;
async function ensureListener() {
  if (progressHandle) return;
  progressHandle = await ft().addListener('progress', p => { if (progressCb && p.lengthComputable && p.contentLength) progressCb(p.bytes / p.contentLength); });
}

export async function downloadVideo(id, onProgress = () => {}) {
  if (!native()) throw new Error('التحميل متاح في تطبيق الجوال فقط');
  try { await fs().mkdir({ directory: DIR, path: FOLDER, recursive: true }); } catch (e) {}
  const { uri } = await fs().getUri({ directory: DIR, path: `${FOLDER}/${id}.mp4` });
  await ensureListener();
  progressCb = onProgress;
  try {
    await ft().downloadFile({ url: remoteUrl(id), path: uri, progress: true });
  } finally { progressCb = null; }
  const s = loadSet(); s.add(id); saveSet(s);
}

export async function deleteVideo(id) {
  try { await fs().deleteFile({ directory: DIR, path: `${FOLDER}/${id}.mp4` }); } catch (e) {}
  const s = loadSet(); s.delete(id); saveSet(s);
}

export async function deleteAllVideos() {
  try { await fs().rmdir({ directory: DIR, path: FOLDER, recursive: true }); } catch (e) {}
  saveSet(new Set());
}

// تحميل كل الفيديوهات بالتتابع؛ يرجع دالة للإلغاء
export function downloadAll(ids, onStatus) {
  let cancelled = false;
  (async () => {
    const todo = ids.filter(id => !isDownloaded(id));
    let done = ids.length - todo.length, failed = 0;
    for (const id of todo) {
      if (cancelled) break;
      onStatus({ done, total: ids.length, current: id, frac: 0, failed });
      try { await downloadVideo(id, f => onStatus({ done, total: ids.length, current: id, frac: f, failed })); done++; }
      catch (e) { failed++; console.warn('video download failed', id, e); }
    }
    onStatus({ done, total: ids.length, finished: true, cancelled, failed });
  })();
  return () => { cancelled = true; };
}
