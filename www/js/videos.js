// فيديوهات الدروس: بث من الإنترنت (مصدران مع إعادة المحاولة)، أو تحميلها للجهاز.
// التحميل يتم بإضافتَي Filesystem و FileTransfer (أصلية في أندرويد).
import { Capacitor, registerPlugin } from './vendor/capacitor-core.js';

// المصدر الأول: GitHub Pages (خوادم مختلفة)، الثاني: ملفات الإصدار
export const VIDEO_SOURCES = [
  'https://ahmad-ksa.github.io/guitar/videos/',
  'https://github.com/ahmad-ksa/guitar/releases/download/videos/',
];
const DIR = 'DATA', FOLDER = 'videos';
const KEY = 'ga.videos.downloaded', MKEY = 'ga.videos.manifest';
const native = () => Capacitor.isNativePlatform();
const sleep = ms => new Promise(r => setTimeout(r, ms));
let FS = null, FT = null;
const fs = () => FS || (FS = registerPlugin('Filesystem'));
const ft = () => FT || (FT = registerPlugin('FileTransfer'));

function loadSet() { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); } }
function saveSet(s) { try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch (e) {} }

export const canDownload = () => native();
export function isDownloaded(id) { return loadSet().has(id); }
export function downloadedCount() { return loadSet().size; }
export const urlsFor = id => VIDEO_SOURCES.map(b => b + encodeURIComponent(id) + '.mp4');

// قائمة الأحجام (للتأكد أن الملف المحمّل كامل وصحيح)
let manifest = null;
async function getManifest() {
  if (manifest) return manifest;
  try { manifest = JSON.parse(localStorage.getItem(MKEY) || 'null'); } catch (e) {}
  for (const base of VIDEO_SOURCES) {
    try {
      const r = await fetch(base + 'manifest.json', { cache: 'no-store' });
      if (r.ok) { manifest = await r.json(); try { localStorage.setItem(MKEY, JSON.stringify(manifest)); } catch (e) {} break; }
    } catch (e) {}
  }
  return manifest || {};
}

const localPath = id => `${FOLDER}/${id}.mp4`;

// روابط التشغيل بالترتيب: الملف المحلي أولاً إن وُجد، ثم مصادر الإنترنت
export async function videoSources(id) {
  const out = [];
  if (native() && isDownloaded(id)) {
    try {
      const { uri } = await fs().getUri({ directory: DIR, path: localPath(id) });
      await fs().stat({ path: uri });
      out.push({ src: Capacitor.convertFileSrc(uri), local: true });
    } catch (e) { const s = loadSet(); s.delete(id); saveSet(s); }
  }
  urlsFor(id).forEach(src => out.push({ src, local: false }));
  return out;
}

const inflight = new Map();
let listenerReady = null;
const progressCbs = new Map(); // url → cb
function ensureListener() {
  if (!listenerReady) listenerReady = ft().addListener('progress', p => {
    const cb = progressCbs.get(p.url);
    if (cb && p.lengthComputable && p.contentLength) cb(p.bytes / p.contentLength);
  });
  return listenerReady;
}

async function downloadOnce(url, partUri, onProgress) {
  progressCbs.set(url, onProgress);
  try { await ft().downloadFile({ url, path: partUri, progress: true, connectTimeout: 20000, readTimeout: 30000 }); }
  finally { progressCbs.delete(url); }
}

export function downloadVideo(id, onProgress = () => {}) {
  if (inflight.has(id)) return inflight.get(id);
  const job = (async () => {
    if (!native()) throw new Error('التحميل متاح في تطبيق الجوال فقط');
    try { await fs().mkdir({ directory: DIR, path: FOLDER, recursive: true }); } catch (e) {}
    const { uri: partUri } = await fs().getUri({ directory: DIR, path: localPath(id) + '.part' });
    await ensureListener();
    const want = (await getManifest())[id]?.size;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const url of urlsFor(id)) {
        try {
          await downloadOnce(url, partUri, onProgress);
          const st = await fs().stat({ path: partUri });
          const size = Number(st.size);
          if (want ? size !== want : size < 200000) throw new Error(`حجم غير صحيح ${size}`);
          try { await fs().deleteFile({ directory: DIR, path: localPath(id) }); } catch (e) {}
          await fs().rename({ from: localPath(id) + '.part', to: localPath(id), directory: DIR });
          const s = loadSet(); s.add(id); saveSet(s);
          return;
        } catch (e) {
          lastErr = e; console.warn('video download attempt failed', id, url, e && (e.code || e.message), e && e.httpStatus);
          try { await fs().deleteFile({ path: partUri }); } catch (er) {}
        }
      }
      await sleep(1500 * 2 ** attempt);
    }
    throw lastErr || new Error('download failed');
  })().finally(() => inflight.delete(id));
  inflight.set(id, job);
  return job;
}

export async function deleteVideo(id) {
  try { await fs().deleteFile({ directory: DIR, path: localPath(id) }); } catch (e) {}
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
      catch (e) { failed++; await sleep(2500); }
    }
    onStatus({ done, total: ids.length, finished: true, cancelled, failed });
  })();
  return () => { cancelled = true; };
}
