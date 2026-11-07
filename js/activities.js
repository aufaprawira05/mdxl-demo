import { sb, state, ACTIVITY_CATEGORIES, catByLabel, OBJEKTIF, TOPIK, KATEGORI_PRODUK, PIC_SUPPORT, STATUS_TOPIK, PRIORITAS, uploadFile } from './db.js';
import {
  render, esc, icon, header, toast, busy, go, today, fmtDate, fmtDateTime, refNo, bucketOf, tabsBar, stepperBar,
  emptyState, skeleton, successModal, confirmModal, openSheet, sheetHeader, setFieldError, selectOptions, loader,
} from './ui.js';
import { openCamera, pickImage, pickFile, getPosition } from './camera.js';

const TABS = [['hari-ini', 'Hari Ini'], ['akan-datang', 'Akan Datang'], ['telah-lalu', 'Telah Lalu']];
const STEPS = ['Informasi', 'Daftar Hadir', 'Topik', 'Evidence', 'Selesai'];

const statusChip = (s) => ({
  belum: '<span class="chip danger">Belum Dimulai</span>',
  proses: '<span class="chip blue">Dalam Proses</span>',
  selesai: '<span class="chip green">Selesai</span>',
}[s]);

// =====================================================================
// Daftar Activities
// =====================================================================
export async function renderList(_, q) {
  const tab = TABS.some(([k]) => k === q.tab) ? q.tab : 'hari-ini';
  const el = render(`
  <div class="screen">
    ${header('Activities', '/home', { right: `<button class="icon-btn red" id="sbtn" aria-label="Cari activities" aria-expanded="false">${icon.search()}</button>` })}
    ${tabsBar('/activities', tab, TABS)}
    <div class="content">
      <div id="sbox" hidden><label class="search">${icon.search(18)}<input id="q" placeholder="Cari no. referensi, kategori, lokasi" aria-label="Cari activities"></label></div>
      <div id="list" class="stack-8" style="gap:12px">${skeleton()}</div>
    </div>
    <div class="bottom-bar"><a class="btn btn-primary" href="#/activities/new">${icon.plus()} Buat Meeting Baru</a></div>
  </div>`);

  const { data, error } = await sb.from('activities').select('*').eq('user_id', state.user.id);
  if (error) throw error;
  let rows = data.filter((a) => bucketOf(a.meeting_date) === tab);
  rows.sort((a, b) => tab === 'akan-datang'
    ? a.meeting_date.localeCompare(b.meeting_date)
    : b.meeting_date.localeCompare(a.meeting_date) || b.created_at.localeCompare(a.created_at));

  const list = el.querySelector('#list');
  const draw = (term = '') => {
    const t = term.toLowerCase();
    const shown = rows.filter((a) => !t || [a.ref_no, a.category, a.location].some((v) => v.toLowerCase().includes(t)));
    list.innerHTML = shown.length ? shown.map(card).join('') : emptyState(term ? 'Tidak ditemukan' : 'Belum ada meeting',
      term ? 'Coba kata kunci lain.' : tab === 'hari-ini' ? 'Buat meeting baru untuk hari ini.' : '');
  };
  draw();

  el.querySelector('#sbtn').onclick = (e) => {
    const box = el.querySelector('#sbox');
    box.hidden = !box.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!box.hidden));
    if (!box.hidden) el.querySelector('#q').focus();
  };
  el.querySelector('#q').oninput = (e) => draw(e.target.value);
  list.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    const ok = await confirmModal('Hapus meeting?', 'Data meeting ini akan dihapus permanen.', 'Hapus');
    if (!ok) return;
    busy(del, async () => {
      const { error } = await sb.from('activities').delete().eq('id', del.dataset.del);
      if (error) throw error;
      rows = rows.filter((r) => r.id !== del.dataset.del);
      draw(el.querySelector('#q').value);
      toast('Meeting dihapus.');
    });
  });
}

function card(a) {
  const late = a.status !== 'selesai' && a.meeting_date < today();
  let action;
  if (a.status === 'selesai') action = `<a class="btn btn-soft btn-sm" href="#/activity/${a.id}">Lihat Detail</a>`;
  else if (a.status === 'proses') action = `<a class="btn btn-primary btn-sm" href="#/activity/${a.id}">Lanjut Pengisian</a>`;
  else if (a.meeting_date <= today()) action = `<a class="btn btn-primary btn-sm" href="#/activity/${a.id}">Mulai</a>`;
  else action = `<a class="btn btn-soft btn-sm" href="#/activity/${a.id}">Lihat Jadwal</a>`;
  return `<article class="card">
    <div class="card-top"><span class="ref">${esc(a.ref_no)}</span>
      ${a.status !== 'selesai' ? `<button class="icon-btn red" data-del="${a.id}" aria-label="Hapus ${esc(a.ref_no)}">${icon.trash()}</button>` : ''}</div>
    <dl class="kv">
      <dt>Tanggal Meeting</dt><dd>${fmtDate(a.meeting_date)}</dd>
      <dt>Kategori</dt><dd>${esc(a.category)}</dd>
      <dt>Lokasi</dt><dd>${esc(a.location)}</dd>
      <dt>Status</dt><dd style="display:flex;gap:6px;flex-wrap:wrap">${statusChip(a.status)}${late ? '<span class="chip amber">Terlambat</span>' : ''}</dd>
    </dl>
    <div class="card-foot"><span class="tag red">${esc(a.tipe)}</span>${action}</div>
  </article>`;
}

// =====================================================================
// Buat Meeting Baru
// =====================================================================
export function renderNew() {
  const el = render(`
  <div class="screen">
    ${header('Buat Meeting Baru', '/activities')}
    <form class="content white" id="f" novalidate>
      <div class="field"><label for="category">Kategori Aktivitas <span class="req">*</span></label>
        <select class="select" id="category" name="category">${selectOptions(ACTIVITY_CATEGORIES.map((c) => c.label), '', 'Pilih kategori aktivitas')}</select></div>
      <div class="field"><label for="peserta">Kategori Peserta <span class="req">*</span></label>
        <select class="select" id="peserta" name="peserta">${selectOptions(['Internal', 'Eksternal'], '', 'Pilih kategori peserta')}</select></div>
      <div class="field"><label for="objektif">Objektif <span class="req">*</span></label>
        <select class="select" id="objektif" name="objektif">${selectOptions(OBJEKTIF, '', 'Pilih objektif')}</select></div>
      <div class="field"><label for="meeting_date">Tanggal Meeting <span class="req">*</span></label>
        <input class="input" type="date" id="meeting_date" name="meeting_date" min="${today()}"></div>
      <div class="field"><label for="location">Lokasi Meeting <span class="req">*</span></label>
        <input class="input" id="location" name="location" maxlength="200" placeholder="Contoh: Kantor SIG Surabaya"></div>
    </form>
    <div class="bottom-bar"><button class="btn btn-primary" id="save">Simpan</button></div>
  </div>`);
  const f = el.querySelector('#f');
  el.querySelector('#save').onclick = (e) => {
    const v = Object.fromEntries(new FormData(f));
    const errs = {
      category: !v.category && 'Pilih kategori aktivitas.',
      peserta: !v.peserta && 'Pilih kategori peserta.',
      objektif: !v.objektif && 'Pilih objektif.',
      meeting_date: (!v.meeting_date && 'Pilih tanggal meeting.') || (v.meeting_date < today() && 'Tanggal tidak boleh sebelum hari ini.'),
      location: (!v.location.trim() || v.location.trim().length < 3) && 'Isi lokasi minimal 3 huruf.',
    };
    Object.entries(errs).forEach(([k, m]) => setFieldError(f, k, m));
    if (Object.values(errs).some(Boolean)) return toast('Lengkapi data yang ditandai merah.', 'error');
    busy(e.currentTarget, async () => {
      const cat = catByLabel(v.category);
      const { error } = await sb.from('activities').insert({
        ref_no: refNo(cat.prefix), category: cat.label, tipe: cat.tipe, peserta: v.peserta,
        objektif: v.objektif, meeting_date: v.meeting_date, location: v.location.trim(),
      });
      if (error) throw error;
      await successModal('Jadwal meeting berhasil dibuat.');
      go('/activities?tab=' + bucketOf(v.meeting_date));
    });
  };
}

// =====================================================================
// Detail / Mulai / Pengisian
// =====================================================================
export async function renderDetail(id) {
  render(`<div class="screen">${header('Memuat…', '/activities')}<div class="content">${skeleton(2)}</div></div>`);
  const [a, at, tp] = await Promise.all([
    sb.from('activities').select('*').eq('id', id).maybeSingle(),
    sb.from('activity_attendees').select('*').eq('activity_id', id).order('created_at'),
    sb.from('activity_topics').select('*').eq('activity_id', id).order('created_at'),
  ]);
  for (const r of [a, at, tp]) if (r.error) throw r.error;
  if (!a.data) { toast('Meeting tidak ditemukan.', 'error'); return go('/activities'); }
  const ctx = { act: a.data, attendees: at.data, topics: tp.data };
  if (ctx.act.status === 'belum') return renderStart(ctx);
  if (ctx.act.status === 'selesai') return renderDone(ctx);
  return renderStep(ctx, ctx.act.step || 1);
}

function backTab(act) { return '/activities?tab=' + bucketOf(act.meeting_date); }

function renderStart(ctx) {
  const a = ctx.act;
  const future = a.meeting_date > today();
  const el = render(`
  <div class="screen">
    ${header(future ? 'Jadwal Meeting' : 'Mulai', backTab(a))}
    <div class="content white">
      ${future ? `<div class="banner blue">${icon.info()}<span>Meeting ini dijadwalkan ${fmtDate(a.meeting_date)}. Tombol Mulai aktif pada hari H.</span></div>` : ''}
      <dl class="kv" style="grid-template-columns:1fr;gap:2px 0">
        ${kvBlock('No. Referensi', a.ref_no)}${kvBlock('Tanggal Meeting', fmtDate(a.meeting_date))}
        ${kvBlock('Kategori Aktivitas', a.category)}${kvBlock('Kategori Peserta', a.peserta)}
        ${kvBlock('Objektif', a.objektif)}${kvBlock('Lokasi', a.location)}
      </dl>
      ${future ? '' : `<div class="banner blue" id="gps">${icon.pin(20)}<span>Mencari lokasi Anda…</span></div>`}
    </div>
    ${future ? '' : '<div class="bottom-bar"><button class="btn btn-primary" id="start">Mulai</button></div>'}
  </div>`);
  if (future) return;
  let pos = null;
  getPosition().then((p) => {
    pos = p;
    el.querySelector('#gps span').textContent = p ? `Lokasi tercatat: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : 'Lokasi tidak terdeteksi. Aktifkan GPS dan izin lokasi browser.';
  });
  el.querySelector('#start').onclick = (e) => busy(e.currentTarget, async () => {
    if (!pos) pos = await getPosition(8000);
    if (!pos && !(await confirmModal('Lokasi tidak terdeteksi', 'Lanjutkan tanpa koordinat lokasi?', 'Lanjutkan'))) return;
    const patch = { status: 'proses', step: 1, started_at: new Date().toISOString(), start_lat: pos?.lat ?? null, start_lng: pos?.lng ?? null };
    const { error } = await sb.from('activities').update(patch).eq('id', a.id);
    if (error) throw error;
    Object.assign(a, patch);
    await successModal('Activities berhasil dimulai.', 'Lanjut Pengisian');
    renderStep(ctx, 1);
  });
}

const kvBlock = (k, v) => `<dt style="margin-top:10px">${esc(k)}</dt><dd style="font-size:15px">${esc(v ?? '-')}</dd>`;

async function saveStep(ctx, step) {
  if (ctx.act.step === step) return;
  const { error } = await sb.from('activities').update({ step }).eq('id', ctx.act.id);
  if (error) throw error;
  ctx.act.step = step;
}

function stepShell(ctx, step, body, { next = true, nextLabel = 'Selanjutnya', top = '' } = {}) {
  const a = ctx.act;
  return render(`
  <div class="screen">
    ${header(a.category, backTab(a), { sub: a.ref_no, right: `<button class="icon-btn" id="copy" aria-label="Salin no. referensi">${icon.file()}</button>` })}
    ${stepperBar(STEPS, step, Math.max(step, a.step))}
    <div class="content">${top}${body}</div>
    <div class="bottom-bar">
      ${step > 1 ? '<button class="btn btn-soft" id="prev">Sebelumnya</button>' : ''}
      ${next ? `<button class="btn btn-primary" id="next">${esc(nextLabel)}</button>` : ''}
    </div>
  </div>`);
}

function bindNav(el, ctx, step, validate, onFinish) {
  el.querySelector('#copy').onclick = () => navigator.clipboard?.writeText(ctx.act.ref_no).then(() => toast('No. referensi disalin.'));
  el.querySelector('#prev')?.addEventListener('click', (e) => busy(e.currentTarget, async () => { await saveStep(ctx, step - 1); renderStep(ctx, step - 1); }));
  el.querySelector('#next')?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const msg = validate?.();
    if (msg) return toast(msg, 'error');
    if (onFinish) return onFinish();
    await saveStep(ctx, step + 1);
    renderStep(ctx, step + 1);
  }));
}

function renderStep(ctx, step) {
  const a = ctx.act;
  if (step === 1) {
    const el = stepShell(ctx, 1, `<div class="card"><dl class="kv" style="grid-template-columns:1fr;gap:2px 0">
      ${kvBlock('No. Referensi', a.ref_no)}${kvBlock('Tanggal Meeting', fmtDate(a.meeting_date))}${kvBlock('Kategori Aktivitas', a.category)}
      ${kvBlock('Tipe Aktivitas', a.tipe)}${kvBlock('Lokasi', a.location)}${kvBlock('Mulai', fmtDateTime(a.started_at))}
      ${kvBlock('Latitude', a.start_lat ?? '-')}${kvBlock('Longitude', a.start_lng ?? '-')}</dl></div>`);
    return bindNav(el, ctx, 1);
  }
  if (step === 2) return stepAttendees(ctx);
  if (step === 3) return stepTopics(ctx);
  if (step === 4) return stepEvidence(ctx);
  return stepFinish(ctx);
}

// ---------- Langkah 2: Daftar Hadir ----------
function attendeeCard(p, editable) {
  return `<article class="card" style="flex-direction:row;align-items:center">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
      <span class="card-title">${esc(p.name)}</span>
      <span class="card-sub">${esc(p.jabatan)}</span>
      <span class="card-sub">${esc(p.kategori === 'Pegawai SIG' ? 'SIG' : 'Eksternal')} · ${esc(p.phone)}</span>
    </div>
    ${editable ? `<button class="icon-btn red" data-edit="${p.id}" aria-label="Ubah ${esc(p.name)}">${icon.edit()}</button>
      <button class="icon-btn red" data-del="${p.id}" aria-label="Hapus ${esc(p.name)}">${icon.trash(20)}</button>` : ''}
  </article>`;
}

function stepAttendees(ctx) {
  const body = `
    <button class="btn btn-outline btn-block" id="add">${icon.plus()} Tambah Daftar Hadir</button>
    ${ctx.attendees.length ? ctx.attendees.map((p) => attendeeCard(p, true)).join('') : emptyState('Belum ada peserta', 'Tambahkan semua orang yang hadir, termasuk Anda.')}`;
  const el = stepShell(ctx, 2, body);
  bindNav(el, ctx, 2, () => !ctx.attendees.length && 'Tambahkan minimal 1 peserta.');
  el.querySelector('#add').onclick = () => attendeeForm(ctx);
  el.querySelector('.content').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) attendeeForm(ctx, ctx.attendees.find((p) => p.id === ed.dataset.edit));
    if (del) {
      const p = ctx.attendees.find((x) => x.id === del.dataset.del);
      if (ctx.topics.some((t) => t.pic === p.name)) return toast('Peserta ini dipakai sebagai PIC di topik. Ubah topiknya dulu.', 'error');
      if (!(await confirmModal('Hapus peserta?', `${p.name} akan dihapus dari daftar hadir.`, 'Hapus'))) return;
      busy(del, async () => {
        const { error } = await sb.from('activity_attendees').delete().eq('id', p.id);
        if (error) throw error;
        ctx.attendees = ctx.attendees.filter((x) => x.id !== p.id);
        stepAttendees(ctx);
      });
    }
  });
}

function attendeeForm(ctx, existing) {
  const p = existing || { kategori: 'Pegawai SIG', name: '', jabatan: '', email: '', phone: '' };
  const phoneLocal = (p.phone || '').replace(/^\+?62/, '');
  const { el, close } = openSheet(`
    ${sheetHeader(existing ? 'Ubah Daftar Hadir' : 'Tambah Daftar Hadir')}
    <form class="content white" id="f" novalidate>
      <div class="field"><label for="kategori">Kategori Peserta <span class="req">*</span></label>
        <select class="select" id="kategori" name="kategori">${selectOptions(['Pegawai SIG', 'Eksternal'], p.kategori)}</select></div>
      <div class="field"><label for="name">Nama <span class="req">*</span></label>
        <div style="display:flex;gap:8px"><input class="input" id="name" name="name" value="${esc(p.name)}" maxlength="120" placeholder="Masukkan nama">
        <button type="button" class="btn btn-soft" id="pick" style="flex:0 0 auto" aria-label="Pilih dari daftar pegawai SIG">${icon.users(22)}</button></div>
        <span class="hint" id="pickhint">Pilih dari daftar pegawai SIG lewat tombol di samping.</span></div>
      <div class="field"><label for="jabatan">Jabatan <span class="req">*</span></label>
        <input class="input" id="jabatan" name="jabatan" value="${esc(p.jabatan)}" maxlength="120" placeholder="Masukkan jabatan"></div>
      <div class="field"><label for="email">Email <span class="req">*</span></label>
        <input class="input" id="email" name="email" type="email" value="${esc(p.email)}" maxlength="120" placeholder="nama@perusahaan.com"></div>
      <div class="field"><label for="phone">Nomor Telepon <span class="req">*</span></label>
        <div class="input-group"><span class="addon">+62</span><input class="input" id="phone" name="phone" inputmode="numeric" value="${esc(phoneLocal)}" maxlength="13" placeholder="81234567890"></div></div>
    </form>
    <div class="bottom-bar"><button class="btn btn-primary" id="save">Simpan</button></div>`);
  const f = el.querySelector('#f');
  const sigFields = ['name', 'jabatan', 'email', 'phone'];
  const applyMode = () => {
    const sig = f.elements['kategori'].value === 'Pegawai SIG';
    sigFields.forEach((n) => (f.elements[n].readOnly = sig));
    el.querySelector('#pick').hidden = !sig;
    el.querySelector('#pickhint').hidden = !sig;
  };
  f.elements['kategori'].onchange = () => { sigFields.forEach((n) => (f.elements[n].value = '')); applyMode(); };
  applyMode();
  el.querySelector('#pick').onclick = () => employeePicker((emp) => {
    f.elements['name'].value = emp.name; f.elements['jabatan'].value = emp.jabatan; f.elements['email'].value = emp.email;
    f.elements['phone'].value = emp.phone.replace(/^0/, '').replace(/^\+?62/, '');
  });
  f.elements['phone'].oninput = (e) => (e.target.value = e.target.value.replace(/\D/g, '').replace(/^0+/, ''));
  el.querySelector('#save').onclick = (e) => {
    const v = Object.fromEntries(new FormData(f));
    const errs = {
      name: !v.name.trim() && (f.elements['kategori'].value === 'Pegawai SIG' ? 'Pilih pegawai dari daftar.' : 'Isi nama.'),
      jabatan: !v.jabatan.trim() && 'Isi jabatan.',
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()) && 'Format email tidak valid.',
      phone: !/^8\d{7,12}$/.test(v.phone) && 'Nomor diawali 8, 8–13 digit.',
    };
    Object.entries(errs).forEach(([k, m]) => setFieldError(f, k, m));
    if (Object.values(errs).some(Boolean)) return;
    const email = v.email.trim().toLowerCase();
    if (ctx.attendees.some((x) => x.email.toLowerCase() === email && x.id !== existing?.id)) return toast('Peserta dengan email ini sudah ada di daftar hadir.', 'error');
    busy(e.currentTarget, async () => {
      const row = { kategori: v.kategori, name: v.name.trim(), jabatan: v.jabatan.trim(), email, phone: '+62' + v.phone };
      if (existing) {
        const { data, error } = await sb.from('activity_attendees').update(row).eq('id', existing.id).select().single();
        if (error) throw error;
        if (existing.name !== row.name) await sb.from('activity_topics').update({ pic: row.name }).eq('activity_id', ctx.act.id).eq('pic', existing.name);
        ctx.topics.forEach((t) => { if (t.pic === existing.name) t.pic = row.name; });
        ctx.attendees = ctx.attendees.map((x) => (x.id === existing.id ? data : x));
      } else {
        const { data, error } = await sb.from('activity_attendees').insert({ ...row, activity_id: ctx.act.id }).select().single();
        if (error) throw error;
        ctx.attendees.push(data);
      }
      close();
      await successModal(existing ? 'Peserta berhasil diubah.' : 'Peserta berhasil ditambahkan.', 'Tutup');
      stepAttendees(ctx);
    });
  };
}

async function employeePicker(onPick) {
  const { el, close } = openSheet(`
    ${sheetHeader('Daftar Pegawai SIG')}
    <div class="content">
      <label class="search">${icon.search(18)}<input id="q" placeholder="Cari nama atau jabatan" aria-label="Cari pegawai"></label>
      <div class="row-between"><span class="muted">Ketuk nama untuk memilih</span><b id="cnt"></b></div>
      <div id="list" class="stack-8">${skeleton(3)}</div>
    </div>`);
  const { data, error } = await sb.from('employees').select('*').order('name');
  if (error) { close(); throw error; }
  const draw = (t = '') => {
    const s = data.filter((x) => !t || (x.name + ' ' + x.jabatan).toLowerCase().includes(t.toLowerCase()));
    el.querySelector('#cnt').textContent = `${s.length} pegawai`;
    el.querySelector('#list').innerHTML = s.map((x) => `<button class="card list-btn" data-id="${x.id}">
      <span style="color:var(--red);font-weight:700;font-size:13px">${esc(x.jabatan)}</span>
      <span class="card-title">${esc(x.name)}</span><span class="card-sub">${esc(x.email)} · ${esc(x.phone)}</span></button>`).join('') || emptyState('Pegawai tidak ditemukan');
  };
  draw();
  el.querySelector('#q').oninput = (e) => draw(e.target.value);
  el.querySelector('#list').onclick = (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    onPick(data.find((x) => String(x.id) === b.dataset.id));
    close();
  };
}

// ---------- Langkah 3: Topik ----------
function topicCard(t, editable) {
  const st = { Pending: 'grey', 'In Progress': 'blue', Completed: 'green' }[t.status];
  return `<article class="card">
    <div class="card-top"><span class="card-title">${esc(t.topik)}</span><span class="chip ${st}">${esc(t.status)}</span></div>
    <div class="grid2">
      <span><small>Kategori Produk</small><b>${esc(t.kategori_produk)}</b></span>
      <span><small>Prioritas</small><b>${esc(t.prioritas)}</b></span>
      <span><small>PIC</small><b>${esc(t.pic)}</b></span>
      <span><small>PIC Support</small><b>${esc(t.pic_support)}</b></span>
      <span><small>Tenggat</small><b>${fmtDate(t.tenggat)}</b></span>
    </div>
    <div class="stack-8" style="font-size:13px"><div><small class="muted">Kasus/Kondisi</small><div>${esc(t.kasus)}</div></div>
    <div><small class="muted">Solusi/Tindakan</small><div>${esc(t.solusi)}</div></div>
    ${t.catatan ? `<div><small class="muted">Catatan</small><div>${esc(t.catatan)}</div></div>` : ''}</div>
    ${editable ? `<div class="card-foot"><button class="btn btn-soft btn-sm" data-del="${t.id}">Hapus</button><button class="btn btn-outline btn-sm" data-edit="${t.id}">Ubah</button></div>` : ''}
  </article>`;
}

function stepTopics(ctx) {
  const body = `
    <button class="btn btn-outline btn-block" id="add">${icon.plus()} Tambah Topik</button>
    ${ctx.topics.length ? ctx.topics.map((t) => topicCard(t, true)).join('') : emptyState('Belum ada topik', 'Catat topik yang dibahas dalam meeting.')}`;
  const el = stepShell(ctx, 3, body);
  bindNav(el, ctx, 3, () => !ctx.topics.length && 'Tambahkan minimal 1 topik.');
  el.querySelector('#add').onclick = () => topicForm(ctx);
  el.querySelector('.content').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) topicForm(ctx, ctx.topics.find((t) => t.id === ed.dataset.edit));
    if (del) {
      if (!(await confirmModal('Hapus topik?', 'Topik ini akan dihapus.', 'Hapus'))) return;
      busy(del, async () => {
        const { error } = await sb.from('activity_topics').delete().eq('id', del.dataset.del);
        if (error) throw error;
        ctx.topics = ctx.topics.filter((t) => t.id !== del.dataset.del);
        stepTopics(ctx);
      });
    }
  });
}

function topicForm(ctx, existing) {
  const t = existing || {};
  const ta = (name, label, val, req = true) => `<div class="field"><label for="${name}">${label}${req ? ' <span class="req">*</span>' : ''}</label>
    <textarea class="textarea" id="${name}" name="${name}" maxlength="1000" placeholder="Masukkan ${label.toLowerCase()}">${esc(val || '')}</textarea>
    <span class="counter" data-count="${name}">${(val || '').length}/1000</span></div>`;
  const sel = (name, label, list, val) => `<div class="field"><label for="${name}">${label} <span class="req">*</span></label>
    <select class="select" id="${name}" name="${name}">${selectOptions(list, val, 'Pilih ' + label.toLowerCase())}</select></div>`;
  const { el, close } = openSheet(`
    ${sheetHeader(existing ? 'Ubah Topik' : 'Tambah Topik')}
    <form class="content white" id="f" novalidate>
      ${sel('topik', 'Topik', TOPIK, t.topik)}
      ${sel('kategori_produk', 'Kategori Produk', KATEGORI_PRODUK, t.kategori_produk)}
      ${ta('kasus', 'Kasus/Kondisi', t.kasus)}
      ${ta('solusi', 'Solusi/Tindakan', t.solusi)}
      ${sel('pic_support', 'PIC Support', PIC_SUPPORT, t.pic_support)}
      ${sel('pic', 'PIC', ctx.attendees.map((p) => p.name), t.pic)}
      ${sel('status', 'Status', STATUS_TOPIK, t.status)}
      <div class="field"><label for="tenggat">Tenggat Waktu <span class="req">*</span></label>
        <input class="input" type="date" id="tenggat" name="tenggat" min="${ctx.act.meeting_date}" value="${esc(t.tenggat || '')}"></div>
      ${sel('prioritas', 'Level Prioritas', PRIORITAS, t.prioritas)}
      ${ta('catatan', 'Catatan', t.catatan, false)}
    </form>
    <div class="bottom-bar"><button class="btn btn-primary" id="save">Simpan</button></div>`);
  const f = el.querySelector('#f');
  f.addEventListener('input', (e) => {
    const c = el.querySelector(`[data-count="${e.target.name}"]`);
    if (c) c.textContent = `${e.target.value.length}/1000`;
  });
  el.querySelector('#save').onclick = (e) => {
    const v = Object.fromEntries(new FormData(f));
    const errs = {};
    ['topik', 'kategori_produk', 'pic_support', 'pic', 'status', 'prioritas'].forEach((k) => (errs[k] = !v[k] && 'Wajib dipilih.'));
    errs.kasus = v.kasus.trim().length < 5 && 'Isi minimal 5 karakter.';
    errs.solusi = v.solusi.trim().length < 5 && 'Isi minimal 5 karakter.';
    errs.tenggat = (!v.tenggat && 'Pilih tenggat waktu.') || (v.tenggat < ctx.act.meeting_date && 'Tenggat tidak boleh sebelum tanggal meeting.');
    Object.entries(errs).forEach(([k, m]) => setFieldError(f, k, m));
    if (Object.values(errs).some(Boolean)) return toast('Lengkapi data yang ditandai merah.', 'error');
    busy(e.currentTarget, async () => {
      const row = { ...v, kasus: v.kasus.trim(), solusi: v.solusi.trim(), catatan: v.catatan.trim() || null };
      if (existing) {
        const { data, error } = await sb.from('activity_topics').update(row).eq('id', existing.id).select().single();
        if (error) throw error;
        ctx.topics = ctx.topics.map((x) => (x.id === existing.id ? data : x));
      } else {
        const { data, error } = await sb.from('activity_topics').insert({ ...row, activity_id: ctx.act.id }).select().single();
        if (error) throw error;
        ctx.topics.push(data);
      }
      close();
      await successModal(existing ? 'Topik berhasil diubah.' : 'Topik berhasil ditambahkan.', 'Tutup');
      stepTopics(ctx);
    });
  };
}

// ---------- Langkah 4: Evidence ----------
function stepEvidence(ctx) {
  const a = ctx.act;
  const body = `
    <div class="field"><span class="label">Dokumentasi meeting (PNG/JPG/JPEG) <span class="req">*</span></span>
      <div class="upload">
        ${a.evidence_photo ? `<img src="${esc(a.evidence_photo)}" alt="Foto dokumentasi meeting">` : '<span class="muted">Maksimal 1 foto (5 MB). Foto dari kamera otomatis diberi tanggal, jam, dan lokasi.</span>'}
        <div class="btns"><button class="btn btn-primary btn-sm" id="cam">${icon.camera()} ${a.evidence_photo ? 'Foto ulang' : 'Ambil foto'}</button>
        <button class="btn btn-soft btn-sm" id="alb">${icon.image()} Pilih dari album</button></div>
      </div></div>
    <div class="field"><span class="label">Dokumen lainnya (PDF/PNG/JPG/JPEG)</span>
      <div class="upload">
        ${a.evidence_doc ? `<a href="${esc(a.evidence_doc)}" target="_blank" rel="noopener" style="font-weight:700">${icon.file()} ${esc(a.evidence_doc_name || 'Dokumen')}</a>` : '<span class="muted">Opsional. Maksimal 1 file (10 MB).</span>'}
        <div class="btns"><button class="btn btn-soft btn-sm" id="doc">${icon.file()} ${a.evidence_doc ? 'Ganti file' : 'Pilih file'}</button>
        ${a.evidence_doc ? '<button class="btn btn-soft btn-sm" id="rmdoc">Hapus</button>' : ''}</div>
      </div></div>`;
  const el = stepShell(ctx, 4, body);
  bindNav(el, ctx, 4, () => !a.evidence_photo && 'Upload foto dokumentasi meeting dulu.');
  const savePhoto = async (blob) => {
    if (!blob) return;
    loader(true);
    try {
      const url = await uploadFile(blob, 'activities', 'jpg');
      const { error } = await sb.from('activities').update({ evidence_photo: url }).eq('id', a.id);
      if (error) throw error;
      a.evidence_photo = url;
      toast('Foto tersimpan.');
      stepEvidence(ctx);
    } finally { loader(false); }
  };
  el.querySelector('#cam').onclick = (e) => busy(e.currentTarget, async () => savePhoto(await openCamera()));
  el.querySelector('#alb').onclick = (e) => busy(e.currentTarget, async () => savePhoto(await pickImage(5)));
  el.querySelector('#doc').onclick = (e) => busy(e.currentTarget, async () => {
    const f = await pickFile('application/pdf,image/png,image/jpeg');
    if (!f) return;
    if (!/pdf|png|jpe?g/i.test(f.type)) return toast('Format harus PDF/PNG/JPG/JPEG.', 'error');
    if (f.size > 10 * 1024 * 1024) return toast('Ukuran file maksimal 10 MB.', 'error');
    loader(true);
    try {
      const ext = f.type.includes('pdf') ? 'pdf' : f.type.includes('png') ? 'png' : 'jpg';
      const url = await uploadFile(f, 'activities', ext);
      const { error } = await sb.from('activities').update({ evidence_doc: url, evidence_doc_name: f.name }).eq('id', a.id);
      if (error) throw error;
      Object.assign(a, { evidence_doc: url, evidence_doc_name: f.name });
      stepEvidence(ctx);
    } finally { loader(false); }
  });
  el.querySelector('#rmdoc')?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const { error } = await sb.from('activities').update({ evidence_doc: null, evidence_doc_name: null }).eq('id', a.id);
    if (error) throw error;
    Object.assign(a, { evidence_doc: null, evidence_doc_name: null });
    stepEvidence(ctx);
  }));
}

// ---------- Langkah 5: Selesai ----------
function stepFinish(ctx) {
  const a = ctx.act;
  const body = `<div class="empty" style="padding-top:24px">
      <div class="art" style="background:#DDF6D9;color:#12A112">${icon.check(48)}</div>
      <b>Semua data telah terisi.</b>
      <span>${ctx.attendees.length} peserta · ${ctx.topics.length} topik · foto dokumentasi${a.evidence_doc ? ' · 1 dokumen' : ''}</span>
      <span>Pastikan data yang diinput sudah benar sebelum menyelesaikan.</span>
    </div>`;
  const el = stepShell(ctx, 5, body, { nextLabel: 'Selesai' });
  bindNav(el, ctx, 5, () => {
    if (!ctx.attendees.length) return 'Daftar hadir masih kosong.';
    if (!ctx.topics.length) return 'Topik masih kosong.';
    if (!a.evidence_photo) return 'Foto dokumentasi belum diupload.';
  }, async () => {
    const { error } = await sb.from('activities').update({ status: 'selesai', finished_at: new Date().toISOString(), step: 5 }).eq('id', a.id);
    if (error) throw error;
    await successModal('Berhasil menyelesaikan Activities.', 'Tutup');
    go(backTab(a));
  });
}

// ---------- Detail (sudah selesai) ----------
function renderDone(ctx) {
  const a = ctx.act;
  render(`
  <div class="screen">
    ${header(a.category, backTab(a), { sub: a.ref_no })}
    <div class="content">
      <div class="card"><div class="card-top"><b>Informasi</b>${statusChip('selesai')}</div>
        <dl class="kv">
          <dt>Tanggal</dt><dd>${fmtDate(a.meeting_date)}</dd><dt>Tipe</dt><dd>${esc(a.tipe)}</dd>
          <dt>Peserta</dt><dd>${esc(a.peserta)}</dd><dt>Objektif</dt><dd>${esc(a.objektif)}</dd>
          <dt>Lokasi</dt><dd>${esc(a.location)}</dd><dt>Mulai</dt><dd>${fmtDateTime(a.started_at)}</dd>
          <dt>Selesai</dt><dd>${fmtDateTime(a.finished_at)}</dd>
          <dt>Koordinat</dt><dd>${a.start_lat != null ? `${a.start_lat.toFixed(6)}, ${a.start_lng.toFixed(6)}` : '-'}</dd>
        </dl></div>
      <div class="section-head"><h2>Daftar Hadir (${ctx.attendees.length})</h2></div>
      ${ctx.attendees.map((p) => attendeeCard(p, false)).join('')}
      <div class="section-head"><h2>Topik (${ctx.topics.length})</h2></div>
      ${ctx.topics.map((t) => topicCard(t, false)).join('')}
      <div class="section-head"><h2>Evidence</h2></div>
      <div class="upload">${a.evidence_photo ? `<img src="${esc(a.evidence_photo)}" alt="Foto dokumentasi meeting">` : '<span class="muted">Tidak ada foto</span>'}
      ${a.evidence_doc ? `<a href="${esc(a.evidence_doc)}" target="_blank" rel="noopener" style="font-weight:700">${icon.file()} ${esc(a.evidence_doc_name || 'Dokumen')}</a>` : ''}</div>
    </div>
  </div>`);
}
