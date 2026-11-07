// ---------- Helper umum tampilan ----------
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function render(html) {
  const el = document.getElementById('app');
  el.innerHTML = html;
  window.scrollTo(0, 0);
  return el;
}

export function go(path) {
  if (location.hash === '#' + path) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = path;
}

// ---------- Ikon (stroke SVG) ----------
const svg = (d, size = 22, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icon = {
  back: (s) => svg('<path d="M15 18l-6-6 6-6"/>', s),
  chevron: (s = 18) => svg('<path d="M9 6l6 6-6 6"/>', s),
  search: (s) => svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', s),
  plus: (s = 20) => svg('<path d="M12 5v14M5 12h14"/>', s, 2.4),
  trash: (s = 22) => svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', s),
  edit: (s = 20) => svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>', s),
  camera: (s = 20) => svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', s),
  image: (s = 20) => svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>', s),
  file: (s = 20) => svg('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>', s),
  pin: (s = 22) => svg('<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>', s),
  check: (s = 36) => svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>', s, 2.4),
  x: (s = 22) => svg('<path d="M6 6l12 12M18 6L6 18"/>', s),
  flip: (s = 22) => svg('<path d="M4 7h11l-3-3M20 17H9l3 3"/>', s),
  history: (s = 24) => svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>', s),
  users: (s = 24) => svg('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5"/><path d="M15 15c3 0 6 1.5 6 4"/>', s),
  home: (s = 22) => svg('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>', s),
  user: (s = 22) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>', s),
  info: (s = 20) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', s),
  revisit: (s = 20) => svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>', s, 2.2),
  doc: (s = 40) => svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>', s),
  logout: (s = 20) => svg('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', s),
};

export function header(title, backHref, { right = '', sub = '' } = {}) {
  return `<header class="hdr">
    ${backHref ? `<a class="icon-btn" href="#${backHref}" aria-label="Kembali">${icon.back()}</a>` : '<span style="width:8px"></span>'}
    <h1>${esc(title)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</h1>
    ${right || '<span style="width:44px"></span>'}
  </header>`;
}

export function emptyState(title, text = '') {
  return `<div class="empty"><div class="art">${icon.doc(44)}</div><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</div>`;
}

export function skeleton(n = 3) {
  return Array.from({ length: n }, () => '<div class="skeleton"></div>').join('');
}

// ---------- Toast / loader / modal ----------
let toastTimer;
export function toast(msg, type = 'info') {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3200);
}

export function loader(on) {
  let el = document.getElementById('loader');
  if (on && !el) {
    el = document.createElement('div');
    el.id = 'loader';
    el.className = 'loader';
    el.innerHTML = '<div class="spinner" role="progressbar" aria-label="Memuat"></div>';
    document.body.appendChild(el);
  } else if (!on && el) el.remove();
}

export function successModal(message, buttonLabel = 'Selesai', title = 'Berhasil') {
  return new Promise((resolve) => {
    const bd = document.createElement('div');
    bd.className = 'backdrop';
    bd.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <div class="ok-ic">${icon.check(40)}</div>
      <h2 id="m-title">${esc(title)}</h2><p>${esc(message)}</p>
      <div class="actions"><button class="btn btn-success">${esc(buttonLabel)}</button></div></div>`;
    document.body.appendChild(bd);
    const b = bd.querySelector('button');
    b.focus();
    b.onclick = () => { bd.remove(); resolve(); };
  });
}

export function confirmModal(title, message, okLabel = 'Ya, lanjutkan', cancelLabel = 'Batal') {
  return new Promise((resolve) => {
    const bd = document.createElement('div');
    bd.className = 'backdrop';
    bd.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <div class="warn-ic">${icon.info(36)}</div>
      <h2 id="m-title">${esc(title)}</h2><p>${esc(message)}</p>
      <div class="actions"><button class="btn btn-soft" data-v="0">${esc(cancelLabel)}</button><button class="btn btn-primary" data-v="1">${esc(okLabel)}</button></div></div>`;
    document.body.appendChild(bd);
    bd.querySelector('[data-v="1"]').focus();
    bd.querySelectorAll('button').forEach((b) => (b.onclick = () => { bd.remove(); resolve(b.dataset.v === '1'); }));
  });
}

// Layar penuh di atas layar aktif (form tambah, picker, dll)
export function openSheet(html) {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = html;
  document.getElementById('overlay-root').appendChild(el);
  document.body.style.overflow = 'hidden';
  const close = () => {
    el.remove();
    if (!document.querySelector('.sheet')) document.body.style.overflow = '';
  };
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); close(); }));
  return { el, close };
}

export function sheetHeader(title) {
  return `<header class="hdr"><button class="icon-btn" data-close aria-label="Tutup">${icon.back()}</button><h1>${esc(title)}</h1><span style="width:44px"></span></header>`;
}

// Jalankan aksi async dengan tombol non-aktif sementara
export async function busy(btn, fn) {
  if (btn?.classList.contains('busy')) return;
  btn?.classList.add('busy');
  try { return await fn(); }
  catch (e) { console.error(e); toast(errorText(e), 'error'); }
  finally { btn?.classList.remove('busy'); }
}

export function errorText(e) {
  const m = e?.message || String(e);
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Tidak ada koneksi internet. Coba lagi.';
  if (/row-level security/i.test(m)) return 'Akses ditolak oleh aturan database.';
  return m;
}

// ---------- Format ----------
const pad = (n) => String(n).padStart(2, '0');
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fmtDate(v) {
  if (!v) return '-';
  const [y, m, d] = String(v).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
export function fmtDateTime(v) {
  if (!v) return '-';
  const d = new Date(v);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export function monthName(d = new Date()) {
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}
export function rupiah(n) {
  if (n === null || n === undefined || n === '') return '-';
  return 'Rp' + Number(n).toLocaleString('id-ID');
}
export function num(n) {
  return Number(n ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
export function refNo(prefix) {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let r = '';
  const buf = crypto.getRandomValues(new Uint8Array(10));
  for (const b of buf) r += chars[b % chars.length];
  return `${prefix}${ymd}${r}`;
}

// Bagian tanggal: hari ini / akan datang / telah lalu
export function bucketOf(dateStr) {
  const t = today();
  if (dateStr === t) return 'hari-ini';
  return dateStr > t ? 'akan-datang' : 'telah-lalu';
}

export function tabsBar(base, current, items) {
  return `<nav class="tabs" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))" aria-label="Kategori">
    ${items.map(([key, label]) => `<a href="#${base}?tab=${key}" ${key === current ? 'aria-current="page"' : ''}>${esc(label)}</a>`).join('')}
  </nav>`;
}

export function stepperBar(labels, current, maxReached) {
  return `<div class="stepper" style="grid-template-columns:repeat(${labels.length},minmax(0,1fr))" aria-label="Langkah pengisian">
    ${labels.map((l, i) => {
      const n = i + 1;
      const cls = n === current ? 'cur' : n <= maxReached ? 'done' : '';
      return `<div class="st ${cls}" ${n === current ? 'aria-current="step"' : ''}><i></i><span>${esc(l)}</span></div>`;
    }).join('')}
  </div>`;
}

// Validasi sederhana form: kembalikan daftar error per field
export function setFieldError(form, name, msg) {
  const field = form.querySelector(`[name="${name}"]`)?.closest('.field');
  if (!field) return;
  field.classList.toggle('invalid', !!msg);
  let e = field.querySelector('.err');
  if (msg) {
    if (!e) { e = document.createElement('span'); e.className = 'err'; field.appendChild(e); }
    e.textContent = msg;
  } else if (e) e.remove();
}

export function selectOptions(list, selected, placeholder) {
  return (placeholder ? `<option value="">${esc(placeholder)}</option>` : '') +
    list.map((o) => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('');
}
