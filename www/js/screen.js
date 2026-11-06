// إبقاء الشاشة مضاءة: تبقى مضاءة حتى تمر المدة المختارة دون لمس
import { Capacitor, registerPlugin } from './vendor/capacitor-core.js';

let minutes = 0;      // 0 = حسب إعدادات الجهاز، -1 = دائماً أثناء فتح التطبيق
let timer = null;
let awake = false;
let plugin = null;
let webLock = null;

function getPlugin() {
  if (plugin !== null) return plugin;
  try { plugin = Capacitor.isNativePlatform() ? registerPlugin('KeepAwake') : false; } catch (e) { plugin = false; }
  return plugin;
}

async function setAwake(on) {
  if (on === awake) return;
  awake = on;
  const p = getPlugin();
  try {
    if (p) { await (on ? p.keepAwake() : p.allowSleep()); return; }
    if ('wakeLock' in navigator) {
      if (on) webLock = await navigator.wakeLock.request('screen');
      else if (webLock) { await webLock.release(); webLock = null; }
    }
  } catch (e) { awake = !on ? awake : false; }
}

// يُستدعى عند كل لمسة أو تشغيل صوت
export function activity() {
  if (minutes === 0) return;
  setAwake(true);
  clearTimeout(timer);
  if (minutes > 0) timer = setTimeout(() => setAwake(false), minutes * 60000);
}

export function setScreenTimeout(m) {
  minutes = +m;
  clearTimeout(timer);
  if (minutes === 0) setAwake(false);
  else activity();
}

export const SCREEN_OPTIONS = [
  { value: 0, label: 'حسب إعدادات الجهاز' },
  { value: 5, label: '5 دقائق' },
  { value: 10, label: '10 دقائق' },
  { value: 15, label: '15 دقيقة' },
  { value: 30, label: '30 دقيقة' },
  { value: 60, label: 'ساعة' },
  { value: -1, label: 'دائماً أثناء فتح التطبيق' },
];

// عند الرجوع للتطبيق يعاد طلب القفل (المتصفح يلغيه عند الإخفاء)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && minutes !== 0) { awake = false; activity(); }
});
