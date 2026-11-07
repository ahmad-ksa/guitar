// رسومات توضيحية للفيديو (أشكال مبسطة مرسومة بالكود): أجزاء الجيتار، الجلسة،
// ترقيم الأصابع، مكان الضغط، مسك الريشة، ترقيم الأوتار، التاب، البِند
// كل دالة: (g, cx, cy, s, p) حيث p من 0 إلى 1 لتحريك الظهور
const C = { wood: '#8a5a33', wood2: '#5e3a1f', dark: '#2c1a10', line: '#f3ece3', acc: '#e0a145', root: '#e4573d', good: '#5fbf7a', bad: '#e0614f', muted: '#a99d8f', skin: '#d9a77c', skin2: '#b9835a' };
const FONT = n => `600 ${n}px "Noto Kufi Arabic", sans-serif`;

function label(g, text, x, y, tx, ty, p, color = C.acc) {
  if (p <= 0) return;
  g.save(); g.globalAlpha = Math.min(1, p);
  g.strokeStyle = color; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke();
  g.fillStyle = color; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
  g.font = FONT(30); g.fillStyle = C.line; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  const w = g.measureText(text).width + 30;
  g.fillStyle = 'rgba(20,16,12,.85)'; roundRect(g, tx - w / 2, ty - 26, w, 52, 14); g.fill();
  g.strokeStyle = color; g.lineWidth = 2; g.stroke();
  g.fillStyle = C.line; g.fillText(text, tx, ty + 2);
  g.restore();
}
export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const ease = t => t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
const seg = (p, a, b) => ease((p - a) / (b - a));

// جيتار أفقي: الرأس يسار، الجسم يمين
function guitar(g, x0, y0, W) {
  const H = W * 0.36;
  const bodyX = x0 + W * 0.62, cy = y0;
  // الجسم
  g.fillStyle = C.wood; g.strokeStyle = C.dark; g.lineWidth = 4;
  g.beginPath();
  g.ellipse(bodyX + W * 0.07, cy, W * 0.13, H * 0.42, 0, 0, 7);
  g.ellipse(bodyX + W * 0.26, cy, W * 0.15, H * 0.5, 0, 0, 7);
  g.fill();
  g.beginPath(); g.ellipse(bodyX + W * 0.07, cy, W * 0.13, H * 0.42, 0, 0, 7); g.stroke();
  g.beginPath(); g.ellipse(bodyX + W * 0.26, cy, W * 0.15, H * 0.5, 0, 0, 7); g.stroke();
  g.fillStyle = C.wood; g.beginPath(); g.ellipse(bodyX + W * 0.07, cy, W * 0.128, H * 0.415, 0, 0, 7); g.fill();
  // الفتحة والجسر
  g.fillStyle = '#140c06'; g.beginPath(); g.arc(bodyX + W * 0.13, cy, H * 0.17, 0, 7); g.fill();
  g.fillStyle = C.wood2; g.fillRect(bodyX + W * 0.3, cy - H * 0.17, W * 0.025, H * 0.34);
  // الزند
  g.fillStyle = '#3b2416'; g.fillRect(x0 + W * 0.14, cy - H * 0.09, W * 0.56, H * 0.18);
  g.strokeStyle = '#c9c2b8'; g.lineWidth = 2;
  for (let i = 0; i < 14; i++) { const fx = x0 + W * 0.15 + i * W * 0.038; g.beginPath(); g.moveTo(fx, cy - H * 0.09); g.lineTo(fx, cy + H * 0.09); g.stroke(); }
  // الرأس
  g.fillStyle = C.wood2; roundRect(g, x0, cy - H * 0.13, W * 0.14, H * 0.26, 10); g.fill();
  g.fillStyle = '#d8d0c4';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x0 + W * 0.03 + i * W * 0.04, cy - H * 0.17, 7, 0, 7); g.fill(); g.beginPath(); g.arc(x0 + W * 0.03 + i * W * 0.04, cy + H * 0.17, 7, 0, 7); g.fill(); }
  // الأوتار
  g.strokeStyle = '#efe6d6';
  for (let s = 0; s < 6; s++) { const y = cy - H * 0.07 + s * H * 0.028; g.lineWidth = 0.8 + s * 0.35; g.beginPath(); g.moveTo(x0 + W * 0.13, y); g.lineTo(bodyX + W * 0.315, y); g.stroke(); }
  return { head: [x0 + W * 0.07, cy], neck: [x0 + W * 0.4, cy], body: [bodyX + W * 0.26, cy + H * 0.3], hole: [bodyX + W * 0.13, cy], bridge: [bodyX + W * 0.31, cy], pegs: [x0 + W * 0.07, cy - H * 0.17], frets: [x0 + W * 0.3, cy - H * 0.09] };
}

const FIGS = {
  parts(g, W, H, p) {
    const k = guitar(g, 90, H * 0.47, W - 180);
    label(g, 'الرأس', ...k.head, k.head[0] + 40, H * 0.18, seg(p, 0.05, 0.2));
    label(g, 'مفاتيح الدوزان', ...k.pegs, k.pegs[0] + 140, H * 0.08, seg(p, 0.12, 0.27));
    label(g, 'الزند', ...k.neck, k.neck[0], H * 0.78, seg(p, 0.25, 0.4));
    label(g, 'الفرتات المعدنية', ...k.frets, k.frets[0] + 60, H * 0.13, seg(p, 0.35, 0.5));
    label(g, 'الجسم', ...k.body, k.body[0] - 30, H * 0.85, seg(p, 0.5, 0.65));
    label(g, 'الفتحة', ...k.hole, k.hole[0] - 40, H * 0.14, seg(p, 0.6, 0.75));
    label(g, 'الجسر', ...k.bridge, k.bridge[0] + 10, H * 0.2, seg(p, 0.7, 0.85));
  },
  strings(g, W, H, p) {
    const x0 = 160, x1 = W - 160, top = H * 0.2, gap = H * 0.11;
    const names = ['مي', 'لا', 'ري', 'صول', 'سي', 'مي'];
    g.fillStyle = '#3b2416'; roundRect(g, x0, top - 30, x1 - x0, gap * 5 + 60, 12); g.fill();
    for (let s = 0; s < 6; s++) {
      const y = top + (5 - s) * gap, a = seg(p, 0.08 + s * 0.12, 0.2 + s * 0.12);
      g.strokeStyle = '#efe6d6'; g.lineWidth = 1.5 + (5 - s) * 0.9; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      if (a > 0) {
        g.save(); g.globalAlpha = a;
        g.fillStyle = C.acc; g.beginPath(); g.arc(x0 - 60, y, 30, 0, 7); g.fill();
        g.fillStyle = '#1b1815'; g.font = FONT(30); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(6 - s), x0 - 60, y + 2);
        g.fillStyle = C.line; g.font = FONT(30); g.fillText(names[s], x1 + 70, y + 2);
        g.restore();
      }
    }
    g.fillStyle = C.muted; g.font = FONT(26); g.textAlign = 'center'; g.direction = 'rtl';
    g.fillText('الرفيع = 1 في الأعلى · الغليظ = 6 في الأسفل', W / 2, H * 0.9);
  },
  posture(g, W, H, p) {
    const cx = W * 0.42, base = H * 0.86;
    // كرسي
    g.strokeStyle = C.muted; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 120, base - 150); g.lineTo(cx + 60, base - 150); g.moveTo(cx - 110, base - 150); g.lineTo(cx - 110, base); g.moveTo(cx + 50, base - 150); g.lineTo(cx + 50, base); g.moveTo(cx - 120, base - 150); g.lineTo(cx - 120, base - 380); g.stroke();
    // جسم العازف
    g.strokeStyle = C.skin2; g.lineWidth = 34;
    g.beginPath(); g.moveTo(cx - 80, base - 170); g.lineTo(cx - 70, base - 390); g.stroke(); // ظهر مستقيم
    g.beginPath(); g.moveTo(cx - 80, base - 165); g.lineTo(cx + 70, base - 165); g.lineTo(cx + 80, base - 10); g.stroke(); // رجل
    g.fillStyle = C.skin; g.beginPath(); g.arc(cx - 66, base - 440, 42, 0, 7); g.fill();
    // الجيتار على الفخذ
    g.save(); g.translate(cx + 40, base - 250); g.rotate(-0.22);
    g.fillStyle = C.wood; g.beginPath(); g.ellipse(0, 0, 95, 120, 0, 0, 7); g.fill();
    g.fillStyle = '#140c06'; g.beginPath(); g.arc(-5, -30, 28, 0, 7); g.fill();
    g.fillStyle = '#3b2416'; g.fillRect(-14, -390, 28, 300);
    g.fillStyle = C.wood2; g.fillRect(-20, -450, 40, 70);
    g.restore();
    // ذراعان
    g.strokeStyle = C.skin2; g.lineWidth = 22;
    g.beginPath(); g.moveTo(cx - 70, base - 360); g.quadraticCurveTo(cx + 40, base - 330, cx + 50, base - 250); g.stroke();
    g.beginPath(); g.moveTo(cx - 72, base - 365); g.quadraticCurveTo(cx - 20, base - 470, cx + 80, base - 560); g.stroke();
    const tips = [['ظهر مستقيم', W * 0.75, H * 0.2], ['الجيتار ملاصق للبطن', W * 0.75, H * 0.42], ['الزند مائل للأعلى قليلاً', W * 0.75, H * 0.64]];
    tips.forEach(([t, x, y], i) => {
      const a = seg(p, 0.15 + i * 0.22, 0.32 + i * 0.22); if (a <= 0) return;
      g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(20,16,12,.85)'; roundRect(g, x - 210, y - 38, 420, 76, 18); g.fill();
      g.strokeStyle = C.good; g.lineWidth = 2.5; g.stroke();
      g.fillStyle = C.line; g.font = FONT(30); g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText('✓ ' + t, x, y + 2); g.restore();
    });
  },
  lefthand(g, W, H, p) {
    const cx = W * 0.4, cy = H * 0.6;
    // كف
    g.fillStyle = C.skin; g.strokeStyle = C.skin2; g.lineWidth = 4;
    roundRect(g, cx - 150, cy - 40, 300, 230, 70); g.fill(); g.stroke();
    // إبهام
    g.save(); g.translate(cx + 150, cy + 60); g.rotate(-0.7); roundRect(g, -30, -130, 60, 150, 30); g.fill(); g.stroke(); g.restore();
    // أصابع 1..4 (السبابة يمين الصورة قرب الإبهام)
    const fingers = [[cx + 95, 230, 'السبابة'], [cx + 30, 260, 'الوسطى'], [cx - 35, 245, 'البنصر'], [cx - 100, 200, 'الخنصر']];
    fingers.forEach(([x, len, nm], i) => {
      g.fillStyle = C.skin; roundRect(g, x - 28, cy - 40 - len, 56, len + 20, 28); g.fill(); g.stroke();
      const a = seg(p, 0.1 + i * 0.18, 0.25 + i * 0.18); if (a <= 0) return;
      g.save(); g.globalAlpha = a;
      g.fillStyle = C.acc; g.beginPath(); g.arc(x, cy - 40 - len - 40, 34, 0, 7); g.fill();
      g.fillStyle = '#1b1815'; g.font = FONT(36); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), x, cy - 40 - len - 38);
      g.restore();
    });
    const a = seg(p, 0.8, 0.95);
    if (a > 0) {
      g.save(); g.globalAlpha = a; g.fillStyle = C.line; g.font = FONT(30); g.textAlign = 'center'; g.direction = 'rtl';
      g.fillText('السبابة 1 · الوسطى 2 · البنصر 3 · الخنصر 4', W / 2, H * 0.93);
      g.fillStyle = C.muted; g.font = FONT(26); g.fillText('الإبهام خلف الزند ولا يأخذ رقماً', W * 0.78, H * 0.45); g.restore();
    }
  },
  press(g, W, H, p) {
    const y = H * 0.5, x0 = 120, x1 = W - 120;
    g.fillStyle = '#3b2416'; g.fillRect(x0, y - 70, x1 - x0, 140);
    const frets = [x0 + 260, x0 + 560, x0 + 860];
    g.fillStyle = '#d8d0c4'; frets.forEach(fx => g.fillRect(fx - 6, y - 70, 12, 140));
    g.strokeStyle = '#efe6d6'; g.lineWidth = 6; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    const finger = (x, ok, a) => {
      if (a <= 0) return;
      g.save(); g.globalAlpha = a;
      g.fillStyle = C.skin; g.strokeStyle = C.skin2; g.lineWidth = 4;
      roundRect(g, x - 34, y - 250, 68, 250, 34); g.fill(); g.stroke();
      g.fillStyle = ok ? C.good : C.bad; g.beginPath(); g.arc(x, y - 300, 36, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = FONT(40); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ok ? '✓' : '✗', x, y - 298);
      g.restore();
    };
    finger(frets[1] - 50, true, seg(p, 0.1, 0.3));
    finger(frets[0] - 150, false, seg(p, 0.4, 0.55));
    finger(frets[2], false, seg(p, 0.6, 0.75));
    const a = seg(p, 0.75, 0.9);
    if (a > 0) { g.save(); g.globalAlpha = a; g.fillStyle = C.line; g.font = FONT(30); g.textAlign = 'center'; g.direction = 'rtl'; g.fillText('اضغط قريباً من الفرت المعدني من خلفه، بطرف الإصبع', W / 2, H * 0.84); g.restore(); }
  },
  pick(g, W, H, p) {
    const cx = W * 0.45, cy = H * 0.52;
    g.fillStyle = C.skin; g.strokeStyle = C.skin2; g.lineWidth = 4;
    roundRect(g, cx - 220, cy - 60, 260, 120, 60); g.fill(); g.stroke(); // السبابة مثنية
    g.save(); g.translate(cx + 20, cy - 40); g.rotate(0.3); roundRect(g, -40, -40, 200, 70, 35); g.fill(); g.stroke(); g.restore(); // الإبهام
    const a = seg(p, 0.2, 0.4);
    g.save(); g.globalAlpha = a; g.fillStyle = C.acc;
    g.beginPath(); g.moveTo(cx + 70, cy - 10); g.quadraticCurveTo(cx + 170, cy + 10, cx + 110, cy + 120); g.quadraticCurveTo(cx + 40, cy + 40, cx + 70, cy - 10); g.fill(); g.restore();
    const b = seg(p, 0.5, 0.7);
    if (b > 0) {
      g.save(); g.globalAlpha = b; g.fillStyle = C.line; g.font = FONT(30); g.textAlign = 'center'; g.direction = 'rtl';
      g.fillText('الريشة بين الإبهام وجانب السبابة', W / 2, H * 0.85);
      g.fillStyle = C.muted; g.font = FONT(26); g.fillText('يبرز منها طرف صغير فقط', W / 2, H * 0.93); g.restore();
    }
  },
  tab(g, W, H, p) {
    const x0 = 200, x1 = W - 120, top = H * 0.2, gap = H * 0.1;
    g.strokeStyle = '#d8d0c4'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x0, top + i * gap); g.lineTo(x1, top + i * gap); g.stroke(); }
    g.fillStyle = C.muted; g.font = FONT(26); g.textAlign = 'center'; g.textBaseline = 'middle';
    ['1', '2', '3', '4', '5', '6'].forEach((n, i) => g.fillText(n, x0 - 50, top + i * gap));
    const notes = [[5, 0], [5, 2], [4, 3], [3, 2], [2, 0], [2, 2], [1, 3], [0, 0]];
    notes.forEach(([row, f], i) => {
      const a = seg(p, 0.1 + i * 0.08, 0.18 + i * 0.08); if (a <= 0) return;
      const x = x0 + 80 + i * (x1 - x0 - 160) / 7, y = top + row * gap;
      g.save(); g.globalAlpha = a; g.fillStyle = '#1b1815'; g.fillRect(x - 22, y - 22, 44, 44);
      g.fillStyle = C.acc; g.font = FONT(36); g.fillText(String(f), x, y + 2); g.restore();
    });
    g.fillStyle = C.line; g.font = FONT(28); g.direction = 'rtl'; g.fillText('الخط = وتر، والرقم = رقم الفرت (0 = مطلق)', W / 2, H * 0.86);
  },
  bend(g, W, H, p) {
    const y = H * 0.5, x0 = 150, x1 = W - 150;
    g.fillStyle = '#3b2416'; g.fillRect(x0, y - 120, x1 - x0, 240);
    g.fillStyle = '#d8d0c4'; [x0 + 300, x0 + 700].forEach(fx => g.fillRect(fx - 6, y - 120, 12, 240));
    const k = Math.sin(Math.min(1, p * 1.6) * Math.PI / 2) * 40;
    const fx = x0 + 640;
    g.strokeStyle = '#efe6d6'; g.lineWidth = 6; g.beginPath(); g.moveTo(x0, y); g.lineTo(fx, y - k); g.lineTo(x1, y); g.stroke();
    g.fillStyle = C.skin; g.strokeStyle = C.skin2; g.lineWidth = 4; roundRect(g, fx - 34, y - k, 68, 240, 34); g.fill(); g.stroke();
    g.strokeStyle = C.acc; g.lineWidth = 5; g.beginPath(); g.moveTo(fx + 70, y + 10); g.lineTo(fx + 70, y - 60); g.stroke();
    g.fillStyle = C.acc; g.beginPath(); g.moveTo(fx + 55, y - 55); g.lineTo(fx + 85, y - 55); g.lineTo(fx + 70, y - 80); g.fill();
    g.font = FONT(34); g.textAlign = 'center'; g.fillText('↑ ¼', fx + 140, y - 40);
    g.fillStyle = C.line; g.font = FONT(28); g.direction = 'rtl'; g.fillText('ادفع الوتر قليلاً جداً: ربع تون = بِند خفيف', W / 2, H * 0.9);
  },
};

export function drawFigure(g, name, W, H, p) { const f = FIGS[name]; if (f) { g.save(); f(g, W, H, p); g.restore(); return true; } return false; }

// اختيار رسم تلقائي من نص الخطوة (عندما لا يحدد الدرس رسماً)
export function figureFor(st) {
  if (st.fig) return st.fig;
  const t = st.say || '';
  if (/الرأس/.test(t) && /الجسم/.test(t)) return 'parts';
  if (/الوتر الرفيع في الأعلى|ترقم|تُرقّم/.test(t)) return 'strings';
  if (/الجلسة|ظهر مستقيم/.test(t)) return 'posture';
  if (/اضغط الوتر قريباً|قريباً من الفرت/.test(t)) return 'press';
  if (/الريشة/.test(t) && !st.ex) return 'pick';
  if (/التاب/.test(t) && !st.ex) return 'tab';
  if (/السبابة|الخنصر|ترقيم الأصابع|أرقام الأصابع/.test(t) && !st.ex) return 'lefthand';
  if (/بِند|ربع تون/.test(t) && !st.ex) return 'bend';
  return null;
}
