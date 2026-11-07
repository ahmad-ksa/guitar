// أدوات بناء الواجهة
export function h(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function select(options, value, onChange, attrs = {}) {
  const s = h('select', attrs, options.map(o => h('option', { value: o.value, selected: String(o.value) === String(value) ? true : null }, o.label)));
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

export function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

// تحويل نص بسيط (سطر جديد، **غامق**) إلى عناصر
export function rich(text) {
  const div = h('div', { class: 'rich' });
  for (const para of String(text).split(/\n\n+/)) {
    const p = h('p');
    const lines = para.split('\n');
    lines.forEach((line, i) => {
      line.split(/(\*\*[^*]+\*\*)/).forEach(part => {
        if (part.startsWith('**') && part.endsWith('**')) p.appendChild(h('strong', {}, part.slice(2, -2)));
        else if (part) p.appendChild(document.createTextNode(part));
      });
      if (i < lines.length - 1) p.appendChild(h('br'));
    });
    div.appendChild(p);
  }
  return div;
}

export function slider(label, min, max, step, value, onInput, fmt = v => v) {
  const out = h('output', {}, fmt(value));
  const inp = h('input', { type: 'range', min, max, step, value });
  inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); onInput(+inp.value); });
  return h('label', { class: 'slider' }, h('span', {}, label), inp, out);
}

export function toggle(label, value, onChange) {
  const inp = h('input', { type: 'checkbox', checked: value ? true : null });
  inp.addEventListener('change', () => onChange(inp.checked));
  return h('label', { class: 'toggle' }, inp, h('span', { class: 'sw' }), h('span', {}, label));
}

export function card(title, ...children) {
  return h('section', { class: 'card' }, title ? h('h3', {}, title) : null, ...children);
}

export function icon(name) {
  const paths = {
    home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z',
    book: 'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h6z',
    tools: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
    ref: 'M4 5h16M4 10h16M4 15h10M4 20h7',
    gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.5 4l2-1.5-2-3.5-2.4.8a7 7 0 0 0-1.7-1L16 4h-4l-.4 2.8a7 7 0 0 0-1.7 1l-2.4-.8-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-.8a7 7 0 0 0 1.7 1L12 20h4l.4-2.8a7 7 0 0 0 1.7-1l2.4.8 2-3.5-2-1.5a7 7 0 0 0 0-2z',
    play: 'M7 4l13 8-13 8z',
    stop: 'M6 6h12v12H6z',
    next: 'M5 4l10 8-10 8zM17 4h2v16h-2z',
    prev: 'M19 4L9 12l10 8zM5 4h2v16H5z',
    speak: 'M4 9h4l5-4v14l-5-4H4zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14',
    check: 'M4 12l5 5L20 6',
    lock: 'M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5z',
    film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ic');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', paths[name] || '');
  svg.appendChild(p);
  return svg;
}

// نافذة إدخال نص بأزرار «موافق» و«تخطي»، مع اقتراحات اختيارية
export function askText({ title, placeholder = '', value = '', suggestions = [], okLabel = 'موافق', skipLabel = 'تخطي' }) {
  return new Promise(resolve => {
    const listId = 'dl' + Math.random().toString(36).slice(2);
    const input = h('input', { type: 'text', value, placeholder, list: suggestions.length ? listId : null, style: { width: '100%', fontSize: '1.05rem' } });
    const dl = suggestions.length ? h('datalist', { id: listId }, suggestions.map(x => h('option', { value: x }))) : null;
    const close = v => { overlay.remove(); resolve(v); };
    const ok = h('button', { class: 'btn primary', onclick: () => close(input.value.trim()) }, okLabel);
    const skip = h('button', { class: 'btn', onclick: () => close(null) }, skipLabel);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') close(input.value.trim()); });
    const box = h('div', { class: 'modal' }, h('h3', { style: { marginTop: 0 } }, title), input, dl, h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } }, skip, ok));
    const overlay = h('div', { class: 'overlay' }, box);
    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 50);
  });
}
