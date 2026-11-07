import { sb, state, configured, loadProfile, loadKpi, toEmail, ROLE_LABEL } from './db.js';
import { render, esc, icon, header, toast, busy, go, monthName, errorText } from './ui.js';
import * as A from './activities.js';
import * as V from './visits.js';

const routes = [
  [/^\/login$/, renderLogin, true],
  [/^\/home$/, renderHome],
  [/^\/profile$/, renderProfile],
  [/^\/activities$/, A.renderList],
  [/^\/activities\/new$/, A.renderNew],
  [/^\/activity\/([\w-]+)$/, A.renderDetail],
  [/^\/visits$/, V.renderList],
  [/^\/visits\/new$/, V.renderNew],
  [/^\/visit\/([\w-]+)$/, V.renderDetail],
  [/^\/outlet\/([\w-]+)$/, V.renderOutlet],
];

async function router() {
  const raw = location.hash.slice(1) || '/home';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const [re, fn, isPublic] of routes) {
    const m = path.match(re);
    if (!m) continue;
    if (!isPublic && !state.profile) return go('/login');
    if (isPublic && state.profile) return go('/home');
    try { await fn(m[1], query); }
    catch (e) { console.error(e); toast(errorText(e), 'error'); }
    return;
  }
  go('/home');
}

// ---------- Login ----------
function renderLogin() {
  const el = render(`
  <div class="login">
    <div class="top"><b>MDexcellent</b><span>powered by SIG · versi demo</span></div>
    <form novalidate>
      <h1>Selamat Datang</h1>
      <p>Masuk dengan akun MDXL Anda.</p>
      <div class="field"><label for="u">Username</label>
        <input class="input" id="u" name="u" autocomplete="username" autocapitalize="none" required placeholder="contoh: gm.derivatives"></div>
      <div class="field"><label for="p">Kata sandi</label>
        <div class="input-group"><input class="input" id="p" name="p" type="password" autocomplete="current-password" required>
        <button type="button" class="icon-btn" id="eye" aria-label="Tampilkan kata sandi"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
      <div class="row-between">
        <label class="check-row" style="padding:0"><input type="checkbox" id="remember" checked> Ingat saya</label>
        <button type="button" class="link-btn" id="forgot">Lupa kata sandi?</button>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Masuk</button>
    </form>
  </div>`);
  const eye = el.querySelector('#eye');
  eye.onclick = () => { const p = el.querySelector('#p'); p.type = p.type === 'password' ? 'text' : 'password'; };
  el.querySelector('#forgot').onclick = () => toast('Hubungi admin MDXL untuk mengatur ulang kata sandi.');
  el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    const u = el.querySelector('#u').value.trim();
    const p = el.querySelector('#p').value;
    if (!u || !p) return toast('Isi username dan kata sandi.', 'error');
    busy(e.submitter, async () => {
      const { error } = await sb.auth.signInWithPassword({ email: toEmail(u), password: p });
      if (error) throw new Error(/invalid/i.test(error.message) ? 'Username atau kata sandi salah.' : error.message);
      localStorage.setItem('mdxl_remember', el.querySelector('#remember').checked ? '1' : '0');
      sessionStorage.setItem('mdxl_active', '1');
      const prof = await loadProfile();
      if (!prof) { await sb.auth.signOut(); throw new Error('Akun belum punya profil. Jalankan 03_users.sql di Supabase.'); }
      go('/home');
    });
  };
}

// ---------- Beranda ----------
async function renderHome() {
  const p = state.profile;
  const el = render(`
  <div class="screen">
    <section class="home-hero">
      <div class="brand"><b>MDexcellent</b><span class="role">${esc(ROLE_LABEL[p.role])}</span></div>
      <div><div style="font-size:13px">Selamat datang,</div><div style="font-size:18px;font-weight:700">${esc(p.full_name)}</div></div>
    </section>
    <nav class="home-menu" aria-label="Menu utama">
      <a href="#/activities"><span class="ic">${icon.users()}</span>Activities</a>
      <a href="#/visits"><span class="ic">${icon.pin(24)}</span>Visit</a>
      <a href="#/visits?tab=riwayat"><span class="ic">${icon.history()}</span>Riwayat</a>
    </nav>
    <div class="content">
      <div class="section-head"><h2>Performance Board</h2><span>${esc(monthName())}</span></div>
      <div id="kpi" class="stack-8"><div class="skeleton" style="height:48px"></div><div class="skeleton" style="height:48px"></div><div class="skeleton" style="height:48px"></div></div>
    </div>
    ${navbar('home')}
  </div>`);
  const kpi = await loadKpi();
  el.querySelector('#kpi').innerHTML = kpi.length ? kpi.map((k) => {
    const pct = Math.min(100, Math.round((k.done / k.target) * 100));
    return `<div class="kpi" role="group" aria-label="${esc(k.label)}">
      <div class="row"><span>${esc(k.label)}</span><span>${k.done} / ${k.target}</span></div>
      <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i class="${pct >= 100 ? 'done' : ''}" style="width:${pct}%"></i></div>
    </div>`;
  }).join('') : '<p class="muted">Target KPI belum diatur untuk role ini.</p>';
}

function navbar(cur) {
  return `<nav class="navbar" aria-label="Navigasi bawah">
    <a href="#/home" ${cur === 'home' ? 'aria-current="page"' : ''}>${icon.home()}Beranda</a>
    <a href="#/profile" ${cur === 'profile' ? 'aria-current="page"' : ''}>${icon.user()}Profil</a>
  </nav>`;
}

// ---------- Profil ----------
function renderProfile() {
  const p = state.profile;
  const el = render(`
  <div class="screen">
    ${header('Profil', null)}
    <div class="content">
      <div class="card">
        <div class="card-title" style="font-size:18px">${esc(p.full_name)}</div>
        <dl class="kv">
          <dt>Username</dt><dd>${esc(p.username)}</dd>
          <dt>Role</dt><dd>${esc(ROLE_LABEL[p.role])}</dd>
          <dt>Jabatan</dt><dd>${esc(p.jabatan || '-')}</dd>
          <dt>Wilayah</dt><dd>${esc(p.role === 'sales' ? p.area || '-' : 'Semua wilayah')}</dd>
          <dt>Email</dt><dd style="word-break:break-all">${esc(state.user.email)}</dd>
        </dl>
      </div>
      <button class="btn btn-outline btn-block" id="logout">${icon.logout()} Keluar</button>
    </div>
    ${navbar('profile')}
  </div>`);
  el.querySelector('#logout').onclick = async () => {
    await sb.auth.signOut();
    state.profile = null; state.user = null;
    go('/login');
  };
}

// ---------- Mulai ----------
async function boot() {
  if (!configured) {
    render(`<div class="content"><h1>Konfigurasi belum diisi</h1><p>Buka <b>app/js/config.js</b>, isi <b>SUPABASE_URL</b> dan <b>SUPABASE_ANON_KEY</b>, lalu deploy ulang.</p></div>`);
    return;
  }
  // "Ingat saya" tidak dicentang: sesi berakhir saat browser/tab ditutup
  if (localStorage.getItem('mdxl_remember') === '0' && !sessionStorage.getItem('mdxl_active')) {
    await sb.auth.signOut();
  }
  try { await loadProfile(); } catch (e) { console.error(e); }
  window.addEventListener('hashchange', router);
  router();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

boot();
