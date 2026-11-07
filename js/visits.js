import { sb, state, isManager, MODA, HARGA_MIN, HARGA_MAX, KELUHAN, PROGRAM_TYPES, uploadFile } from './db.js';
import {
  render, esc, icon, header, toast, busy, go, today, fmtDate, fmtDateTime, refNo, bucketOf, tabsBar, stepperBar,
  emptyState, skeleton, successModal, confirmModal, openSheet, sheetHeader, setFieldError, selectOptions, loader, rupiah, num,
} from './ui.js';
import { openCamera, pickImage, getPosition } from './camera.js';

const TABS = [['hari-ini', 'Hari Ini'], ['akan-datang', 'Akan Datang'], ['telah-lalu', 'Telah Lalu'], ['riwayat', 'Riwayat']];
const STEPS = ['Foto', 'Produk', 'Keluhan', 'Promosi', 'Konfirmasi'];
const KIND = {
  toko: { label: 'Toko', visit: 'Market Visit (Toko)', fill: 'Pengisian Market Visit', prefix: 'MV', idLabel: 'ID Toko', nameLabel: 'Nama Toko' },
  project: { label: 'Project', visit: 'Visitasi (Project)', fill: 'Pengisian Visitasi Project', prefix: 'PV', idLabel: 'ID Project', nameLabel: 'Nama Project' },
};
const statusChip = (s) => ({
  belum: '<span class="chip danger">Belum Check In</span>',
  proses: '<span class="chip blue">Dalam Proses</span>',
  selesai: '<span class="chip green">Selesai</span>',
}[s]);
const codeOrPending = (o) => (o.code ? esc(o.code) : '<span class="chip amber">Menunggu ID</span>');
const digits = (v) => String(v ?? '').replace(/\D/g, '');

let PRODUCTS = null;
async function getProducts() {
  if (PRODUCTS) return PRODUCTS;
  const { data, error } = await sb.from('products').select('*').order('produsen').order('merek');
  if (error) throw error;
  PRODUCTS = data;
  return data;
}

// =====================================================================
// Daftar Visit
// =====================================================================
export async function renderList(_, q) {
  const tab = TABS.some(([k]) => k === q.tab) ? q.tab : 'hari-ini';
  if (tab === 'riwayat') return renderRiwayat();
  const el = render(`
  <div class="screen">
    ${header('Visit', '/home', { right: `<button class="icon-btn red" id="sbtn" aria-label="Cari visit" aria-expanded="false">${icon.search()}</button>` })}
    ${tabsBar('/visits', tab, TABS)}
    <div class="content">
      <div id="sbox" hidden><label class="search">${icon.search(18)}<input id="q" placeholder="Cari no. visit, nama, atau ID" aria-label="Cari visit"></label></div>
      <div id="list" class="stack-8" style="gap:12px">${skeleton()}</div>
    </div>
    <div class="bottom-bar"><a class="btn btn-primary" href="#/visits/new">${icon.plus()} Buat Visit Baru</a></div>
  </div>`);
  const { data, error } = await sb.from('visits').select('*, outlet:outlets(*)').eq('user_id', state.user.id);
  if (error) throw error;
  let rows = data.filter((v) => bucketOf(v.visit_date) === tab);
  rows.sort((a, b) => tab === 'akan-datang' ? a.visit_date.localeCompare(b.visit_date) : b.visit_date.localeCompare(a.visit_date) || b.created_at.localeCompare(a.created_at));
  const list = el.querySelector('#list');
  const draw = (t = '') => {
    t = t.toLowerCase();
    const s = rows.filter((v) => !t || [v.ref_no, v.outlet.name, v.outlet.code || ''].some((x) => x.toLowerCase().includes(t)));
    list.innerHTML = s.length ? s.map(visitCard).join('') : emptyState(t ? 'Tidak ditemukan' : 'Belum ada visit', t ? 'Coba kata kunci lain.' : '');
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
    if (!(await confirmModal('Hapus visit?', 'Data visit ini akan dihapus permanen.', 'Hapus'))) return;
    busy(del, async () => {
      const { error } = await sb.from('visits').delete().eq('id', del.dataset.del);
      if (error) throw error;
      rows = rows.filter((r) => r.id !== del.dataset.del);
      draw(el.querySelector('#q').value);
      toast('Visit dihapus.');
    });
  });
}

function visitCard(v) {
  const o = v.outlet;
  const k = KIND[v.kind];
  const late = v.status !== 'selesai' && v.visit_date < today();
  let action;
  if (v.status === 'selesai') action = `<a class="btn btn-soft btn-sm" href="#/visit/${v.id}">Lihat Detail</a>`;
  else if (v.status === 'proses') action = `<a class="btn btn-primary btn-sm" href="#/visit/${v.id}">Lanjut Pengisian</a>`;
  else if (v.visit_date <= today()) action = `<a class="btn btn-primary btn-sm" href="#/visit/${v.id}">Check In</a>`;
  else action = `<a class="btn btn-soft btn-sm" href="#/visit/${v.id}">Lihat Jadwal</a>`;
  return `<article class="card">
    <div class="card-top"><span class="ref">${esc(v.ref_no)}</span><b style="font-size:13px">${fmtDate(v.visit_date)}</b></div>
    <dl class="kv">
      <dt>${k.idLabel}</dt><dd>${codeOrPending(o)}</dd>
      <dt>${k.nameLabel}</dt><dd>${esc(o.name)}</dd>
      <dt>Distributor</dt><dd>${esc(o.distributor || '-')}</dd>
      <dt>Status</dt><dd style="display:flex;gap:6px;flex-wrap:wrap">${statusChip(v.status)}${v.is_revisit ? '<span class="chip blue">Revisit</span>' : ''}${late ? '<span class="chip amber">Terlambat</span>' : ''}</dd>
    </dl>
    <div class="card-foot">
      ${v.status !== 'selesai' ? `<button class="icon-btn red" data-del="${v.id}" aria-label="Hapus ${esc(v.ref_no)}">${icon.trash()}</button>` : `<span class="tag red">${k.label.toLowerCase()}</span>`}
      ${action}
    </div>
  </article>`;
}

// =====================================================================
// Riwayat (per toko/project)
// =====================================================================
async function renderRiwayat() {
  const el = render(`
  <div class="screen">
    ${header('Visit', '/home')}
    ${tabsBar('/visits', 'riwayat', TABS)}
    <div class="content">
      <label class="search">${icon.search(18)}<input id="q" placeholder="Cari toko atau project" aria-label="Cari riwayat"></label>
      <div class="pill-row" role="group" aria-label="Filter jenis">
        <button class="pill" data-f="" aria-pressed="true">Semua</button>
        <button class="pill" data-f="toko" aria-pressed="false">Toko</button>
        <button class="pill" data-f="project" aria-pressed="false">Project</button>
      </div>
      <div id="list" class="stack-8">${skeleton()}</div>
    </div>
  </div>`);
  const { data, error } = await sb.from('visits').select('outlet_id, visit_date, outlet:outlets(*)').eq('status', 'selesai').order('visit_date', { ascending: false }).limit(2000);
  if (error) throw error;
  const map = new Map();
  for (const v of data) {
    if (!v.outlet) continue;
    const g = map.get(v.outlet_id) || { outlet: v.outlet, count: 0, last: v.visit_date };
    g.count++;
    map.set(v.outlet_id, g);
  }
  const groups = [...map.values()];
  let filter = '';
  const draw = () => {
    const t = el.querySelector('#q').value.toLowerCase();
    const s = groups.filter((g) => (!filter || g.outlet.kind === filter) && (!t || (g.outlet.name + ' ' + (g.outlet.code || '')).toLowerCase().includes(t)));
    el.querySelector('#list').innerHTML = s.length ? s.map((g) => `
      <a class="card list-btn" href="#/outlet/${g.outlet.id}" style="flex-direction:row;align-items:center;gap:12px">
        <span style="width:48px;height:48px;border-radius:10px;background:var(--red-tint);color:var(--red);display:flex;align-items:center;justify-content:center;flex-shrink:0">${g.outlet.kind === 'toko' ? icon.pin() : icon.doc(24)}</span>
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
          <span class="card-title" style="font-size:14px">${esc(g.outlet.name)}</span>
          <span class="card-sub">${KIND[g.outlet.kind].label} · ${g.outlet.code ? 'ID ' + esc(g.outlet.code) : 'Menunggu ID'} · ${esc(g.outlet.city || g.outlet.area || '')}</span>
          <span style="font-size:12px;font-weight:600;color:var(--ink-2)">${g.count} visit · terakhir ${fmtDate(g.last)}</span>
        </span>${icon.chevron()}
      </a>`).join('') : emptyState('Belum ada riwayat', 'Riwayat muncul setelah visit diselesaikan.');
  };
  draw();
  el.querySelector('#q').oninput = draw;
  el.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => {
    filter = b.dataset.f;
    el.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
}

// =====================================================================
// Buat Visit Baru
// =====================================================================
export function renderNew() {
  let kind = 'toko';
  let outlet = null;
  const el = render(`
  <div class="screen">
    ${header('Buat Visit Baru', '/visits')}
    <form class="content white" id="f" novalidate>
      <div class="field"><span class="label">Kategori Visit <span class="req">*</span></span>
        <div class="seg" role="group" aria-label="Kategori visit">
          <button type="button" data-k="toko" aria-pressed="true">Market Visit (Toko)</button>
          <button type="button" data-k="project" aria-pressed="false">Visitasi (Project)</button>
        </div></div>
      <div class="field" id="outlet-field"><span class="label" id="ol-label">Toko <span class="req">*</span></span><div id="picked"></div></div>
      <div class="field"><label for="visit_date">Tanggal <span class="req">*</span></label>
        <input class="input" type="date" id="visit_date" name="visit_date" min="${today()}" value="${today()}"></div>
      <div class="field"><label for="note">Catatan</label>
        <textarea class="textarea" id="note" name="note" maxlength="1000" placeholder="Catatan visit (opsional)"></textarea>
        <span class="counter" id="cnt">0/1000</span></div>
    </form>
    <div class="bottom-bar"><button class="btn btn-primary" id="save">Buat Visit</button></div>
  </div>`);
  const f = el.querySelector('#f');
  const drawPicked = () => {
    el.querySelector('#ol-label').innerHTML = `${KIND[kind].label} <span class="req">*</span>`;
    el.querySelector('#picked').innerHTML = outlet ? `
      <div class="card" style="gap:6px">
        <div class="card-top"><span class="card-title" style="font-size:14px">${esc(outlet.name)}</span><button type="button" class="link-btn" id="pick">Ganti</button></div>
        <span class="card-sub">${KIND[kind].idLabel}: ${codeOrPending(outlet)}</span>
        <span class="card-sub">${esc(outlet.address || '-')}</span>
      </div>` : `<button type="button" class="btn btn-outline btn-block" id="pick">${icon.search(18)} Pilih ${KIND[kind].label}</button>`;
    el.querySelector('#pick').onclick = () => outletPicker(kind, (o) => { outlet = o; setFieldError(f, 'visit_date', null); drawPicked(); });
  };
  drawPicked();
  el.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
    if (kind === b.dataset.k) return;
    kind = b.dataset.k; outlet = null;
    el.querySelectorAll('[data-k]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    drawPicked();
  }));
  f.elements['note'].oninput = (e) => (el.querySelector('#cnt').textContent = `${e.target.value.length}/1000`);
  el.querySelector('#save').onclick = (e) => {
    const date = f.elements['visit_date'].value;
    if (!outlet) return toast(`Pilih ${KIND[kind].label.toLowerCase()} dulu.`, 'error');
    const dErr = (!date && 'Pilih tanggal.') || (date < today() && 'Tanggal tidak boleh sebelum hari ini.');
    setFieldError(f, 'visit_date', dErr);
    if (dErr) return;
    busy(e.currentTarget, async () => {
      const v = await createVisit(outlet, date, f.elements['note'].value.trim());
      if (!v) return;
      await successModal(v.is_revisit ? 'Revisit berhasil dibuat. Isian akan terisi dari visit terakhir.' : 'Visit berhasil dibuat.');
      go('/visits?tab=' + bucketOf(date));
    });
  };
}

// Membuat visit; jika toko/project pernah di-visit, isian produk disalin dari visit terakhir (revisit)
async function createVisit(outlet, date, note) {
  const dup = await sb.from('visits').select('id').eq('user_id', state.user.id).eq('outlet_id', outlet.id).eq('visit_date', date).neq('status', 'selesai').limit(1);
  if (dup.error) throw dup.error;
  if (dup.data.length) {
    toast('Sudah ada visit yang belum selesai untuk tempat & tanggal ini.', 'error');
    go('/visit/' + dup.data[0].id);
    return null;
  }
  const prev = await sb.from('visits').select('id, visit_date').eq('outlet_id', outlet.id).eq('status', 'selesai')
    .order('finished_at', { ascending: false }).limit(1).maybeSingle();
  if (prev.error) throw prev.error;
  const { data: v, error } = await sb.from('visits').insert({
    ref_no: refNo(KIND[outlet.kind].prefix), outlet_id: outlet.id, kind: outlet.kind, visit_date: date,
    note: note || null, is_revisit: !!prev.data, prev_visit_id: prev.data?.id ?? null,
  }).select().single();
  if (error) throw error;
  if (prev.data) {
    const pp = await sb.from('visit_products').select('*').eq('visit_id', prev.data.id);
    if (pp.error) throw pp.error;
    if (pp.data.length) {
      const rows = pp.data.map((p) => {
        const snap = { product_id: p.product_id, volume: p.volume, moda: p.moda, harga_jual: p.harga_jual, harga_beli: p.harga_beli, stok: p.stok, top_hari: p.top_hari, keluhan: p.keluhan, promosi: p.promosi };
        return { ...snap, visit_id: v.id, prev_snapshot: snap };
      });
      const ins = await sb.from('visit_products').insert(rows);
      if (ins.error) throw ins.error;
    }
  }
  return v;
}

function outletPicker(kind, onPick) {
  const k = KIND[kind];
  const { el, close } = openSheet(`
    ${sheetHeader('Pilih ' + k.label)}
    <div class="content">
      <button class="btn btn-outline btn-block" id="new" style="border-style:dashed;background:var(--red-soft)">${icon.plus()} Tambah ${k.label} Baru</button>
      <label class="search">${icon.search(18)}<input id="q" placeholder="Cari nama, ID, atau alamat" aria-label="Cari ${k.label.toLowerCase()}"></label>
      <div class="row-between" style="font-size:12px"><span class="muted">${isManager() ? 'Wilayah: semua area' : 'Wilayah: ' + esc(state.profile.area || '-')}</span><b id="cnt"></b></div>
      <div id="list" class="stack-8">${skeleton(3)}</div>
    </div>`);
  let timer;
  const load = async (term = '') => {
    let qy = sb.from('outlets').select('*', { count: 'exact' }).eq('kind', kind).order('status', { ascending: false }).order('name').limit(50);
    const t = term.trim().replace(/[%,()]/g, ' ');
    if (t) qy = qy.or(`name.ilike.%${t}%,code.ilike.%${t}%,address.ilike.%${t}%`);
    const { data, error, count } = await qy;
    if (error) return toast(error.message, 'error');
    el.querySelector('#cnt').textContent = `${num(count)} ${k.label.toLowerCase()}`;
    const ids = data.map((o) => o.id);
    const last = {};
    if (ids.length) {
      const vv = await sb.from('visits').select('outlet_id, visit_date').in('outlet_id', ids).eq('status', 'selesai');
      (vv.data || []).forEach((r) => { if (!last[r.outlet_id] || r.visit_date > last[r.outlet_id]) last[r.outlet_id] = r.visit_date; });
    }
    el.querySelector('#list').innerHTML = data.length ? data.map((o) => `
      <button class="card list-btn" data-id="${o.id}" style="gap:6px">
        <span class="card-top" style="align-items:flex-start"><span class="card-title" style="font-size:14px">${esc(o.name)}</span>
          ${o.status === 'pending' ? '<span class="chip amber">Menunggu ID</span>' : last[o.id] ? `<span class="chip blue">Visit terakhir ${fmtDate(last[o.id])}</span>` : ''}</span>
        <span class="card-sub">${o.code ? k.idLabel + ' ' + esc(o.code) + ' · ' : ''}${esc(o.address || '-')}</span>
        <span style="display:flex;gap:6px;flex-wrap:wrap">${o.area ? `<span class="tag">${esc(o.area)}</span>` : ''}${o.city ? `<span class="tag">${esc(o.city)}</span>` : ''}</span>
      </button>`).join('') : emptyState(`${k.label} tidak ditemukan`, `Gunakan "Tambah ${k.label} Baru" jika belum terdaftar.`);
    el.querySelector('#list').onclick = (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      onPick(data.find((o) => o.id === b.dataset.id));
      close();
    };
  };
  load();
  el.querySelector('#q').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => load(e.target.value), 300); };
  el.querySelector('#new').onclick = () => newOutletForm(kind, (o) => { onPick(o); close(); });
}

function newOutletForm(kind, onDone) {
  const k = KIND[kind];
  const { el, close } = openSheet(`
    ${sheetHeader('Tambah ' + k.label + ' Baru')}
    <form class="content white" id="f" novalidate>
      <div class="banner blue">${icon.info()}<span>${k.label} bisa langsung di-visit hari ini. Permintaan ${k.idLabel} dikirim ke admin dan statusnya <b>Menunggu ID</b> sampai diproses.</span></div>
      <div class="field"><label for="name">${k.nameLabel} <span class="req">*</span></label>
        <input class="input" id="name" name="name" maxlength="150" placeholder="Contoh: ${kind === 'toko' ? 'TB. Sinar Jaya' : 'Perumahan Griya Asri Tahap 2'}"></div>
      <div class="field"><label for="address">Alamat <span class="req">*</span></label>
        <textarea class="textarea" id="address" name="address" maxlength="300" placeholder="Nama jalan, nomor, kelurahan/kecamatan, kota"></textarea></div>
    </form>
    <div class="bottom-bar"><button class="btn btn-primary" id="save">Simpan &amp; Pilih</button></div>`);
  const f = el.querySelector('#f');
  el.querySelector('#save').onclick = (e) => {
    const name = f.elements['name'].value.trim();
    const address = f.elements['address'].value.trim();
    setFieldError(f, 'name', name.length < 3 && 'Isi minimal 3 huruf.');
    setFieldError(f, 'address', address.length < 10 && 'Isi alamat lengkap (minimal 10 huruf).');
    if (name.length < 3 || address.length < 10) return;
    busy(e.currentTarget, async () => {
      const { data, error } = await sb.from('outlets').insert({
        kind, name: name.toUpperCase(), address: address.toUpperCase(), area: state.profile.area,
        status: 'pending', requested_by: state.user.id, code: null,
      }).select().single();
      if (error) throw error;
      close();
      toast(`${k.label} baru tersimpan. Menunggu ID dari admin.`);
      onDone(data);
    });
  };
}

// =====================================================================
// Detail / Check In / Pengisian
// =====================================================================
export async function renderDetail(id) {
  render(`<div class="screen">${header('Memuat…', '/visits')}<div class="content">${skeleton(2)}</div></div>`);
  const { data: v, error } = await sb.from('visits').select('*, outlet:outlets(*), items:visit_products(*, product:products(*))').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!v) { toast('Visit tidak ditemukan.', 'error'); return go('/visits'); }
  v.items.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const ctx = { v, prevDate: null, mine: v.user_id === state.user.id };
  if (v.prev_visit_id) {
    const p = await sb.from('visits').select('visit_date').eq('id', v.prev_visit_id).maybeSingle();
    ctx.prevDate = p.data?.visit_date || null;
  }
  if (v.status === 'selesai' || !ctx.mine) return renderDone(ctx);
  if (v.status === 'belum') return renderCheckIn(ctx);
  return renderStep(ctx, v.step || 1);
}

const backTab = (v) => '/visits?tab=' + bucketOf(v.visit_date);
const kvBlock = (k, val) => `<dt style="margin-top:10px">${esc(k)}</dt><dd style="font-size:15px">${val}</dd>`;

function renderCheckIn(ctx) {
  const v = ctx.v;
  const o = v.outlet;
  const k = KIND[v.kind];
  const future = v.visit_date > today();
  const el = render(`
  <div class="screen">
    ${header(future ? 'Jadwal Visit' : 'Check In', backTab(v))}
    <div class="content white">
      ${future ? `<div class="banner blue">${icon.info()}<span>Visit dijadwalkan ${fmtDate(v.visit_date)}. Check In aktif pada hari H.</span></div>` : ''}
      ${v.is_revisit ? `<div class="banner blue">${icon.revisit()}<span>Ini revisit. Isian produk akan terisi dari visit ${fmtDate(ctx.prevDate)}.</span></div>` : ''}
      <dl class="kv" style="grid-template-columns:1fr;gap:2px 0">
        ${kvBlock('No. Visit', esc(v.ref_no))}${kvBlock('Tanggal Visit', fmtDate(v.visit_date))}${kvBlock('Kategori Visit', k.visit)}
        ${kvBlock(k.nameLabel, esc(o.name))}${kvBlock(k.idLabel, codeOrPending(o))}${kvBlock('Distributor', esc(o.distributor || '-'))}
        ${kvBlock('Catatan', esc(v.note || '-'))}
      </dl>
      ${future ? '' : `<div class="banner blue" id="gps">${icon.pin(20)}<span>Mencari lokasi Anda…</span></div>`}
    </div>
    ${future ? '' : '<div class="bottom-bar"><button class="btn btn-primary" id="go">Check In</button></div>'}
  </div>`);
  if (future) return;
  let pos = null;
  getPosition().then((p) => {
    pos = p;
    el.querySelector('#gps span').textContent = p ? `Lokasi tercatat: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}` : 'Lokasi tidak terdeteksi. Aktifkan GPS dan izin lokasi browser.';
  });
  el.querySelector('#go').onclick = (e) => busy(e.currentTarget, async () => {
    if (!pos) pos = await getPosition(8000);
    if (!pos && !(await confirmModal('Lokasi tidak terdeteksi', 'Lanjutkan check in tanpa koordinat?', 'Lanjutkan'))) return;
    const patch = { status: 'proses', step: 1, checkin_at: new Date().toISOString(), lat: pos?.lat ?? null, lng: pos?.lng ?? null };
    const { error } = await sb.from('visits').update(patch).eq('id', v.id);
    if (error) throw error;
    Object.assign(v, patch);
    await successModal('Check in berhasil.', 'Lanjut Pengisian');
    renderStep(ctx, 1);
  });
}

async function saveStep(ctx, step) {
  if (ctx.v.step === step) return;
  const { error } = await sb.from('visits').update({ step }).eq('id', ctx.v.id);
  if (error) throw error;
  ctx.v.step = step;
}

function infoCard(v) {
  const o = v.outlet;
  const k = KIND[v.kind];
  return `<div class="card" style="gap:6px">
    <div class="card-top"><span class="ref">${esc(v.ref_no)}</span><b style="font-size:13px">${fmtDate(v.visit_date)}</b></div>
    <span class="card-title" style="font-size:14px">${esc(o.name)}</span>
    <span class="card-sub">${k.idLabel}: ${codeOrPending(o)}</span>
    <span class="card-sub">Check in: ${v.lat != null ? `${v.lat.toFixed(6)}, ${v.lng.toFixed(6)}` : 'tanpa koordinat'} · ${fmtDateTime(v.checkin_at)}</span>
  </div>`;
}

function stepShell(ctx, step, body, { nextLabel = 'Selanjutnya', banner = true } = {}) {
  const v = ctx.v;
  const rev = banner && v.is_revisit && step >= 2 && step <= 4
    ? `<div class="banner blue">${icon.revisit()}<span>Diisi otomatis dari visit <b>${fmtDate(ctx.prevDate)}</b>. Cek dan ubah yang berbeda saja.</span></div>` : '';
  return render(`
  <div class="screen">
    ${header(KIND[v.kind].fill, backTab(v), { sub: v.outlet.name, right: `<button class="icon-btn" id="copy" aria-label="Salin no. visit">${icon.file()}</button>` })}
    ${stepperBar(STEPS, step, Math.max(step, v.step))}
    <div class="content">${step === 1 ? infoCard(v) : ''}${rev}${body}</div>
    <div class="bottom-bar">
      ${step > 1 ? '<button class="btn btn-soft" id="prev">Sebelumnya</button>' : ''}
      <button class="btn btn-primary" id="next">${esc(nextLabel)}</button>
    </div>
  </div>`);
}

function bindNav(el, ctx, step, validate, onFinish) {
  el.querySelector('#copy').onclick = () => navigator.clipboard?.writeText(ctx.v.ref_no).then(() => toast('No. visit disalin.'));
  el.querySelector('#prev')?.addEventListener('click', (e) => busy(e.currentTarget, async () => { await saveStep(ctx, step - 1); renderStep(ctx, step - 1); }));
  el.querySelector('#next').addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const msg = validate?.();
    if (msg) return toast(msg, 'error');
    if (onFinish) return onFinish();
    await saveStep(ctx, step + 1);
    renderStep(ctx, step + 1);
  }));
}

function renderStep(ctx, step) {
  if (step === 1) return stepFoto(ctx);
  if (step === 2) return stepProduk(ctx);
  if (step === 3) return stepKeluhan(ctx);
  if (step === 4) return stepPromosi(ctx);
  return stepKonfirmasi(ctx);
}

// ---------- 1. Foto ----------
function stepFoto(ctx) {
  const v = ctx.v;
  const label = v.kind === 'toko' ? 'Foto bersama owner' : 'Foto bersama PIC project';
  const el = stepShell(ctx, 1, `
    <div class="field"><span class="label">${label} <span class="req">*</span></span>
      <div class="upload">
        ${v.photo_url ? `<img src="${esc(v.photo_url)}" alt="${label}">` : '<span class="muted">Maksimal 1 foto (5 MB). Foto dari kamera otomatis diberi tanggal, jam, dan lokasi.</span>'}
        <div class="btns"><button class="btn btn-primary btn-sm" id="cam">${icon.camera()} ${v.photo_url ? 'Foto ulang' : 'Ambil foto'}</button>
        <button class="btn btn-soft btn-sm" id="alb">${icon.image()} Pilih dari album</button></div>
      </div></div>`);
  bindNav(el, ctx, 1, () => !v.photo_url && 'Upload foto dulu.');
  const save = async (blob) => {
    if (!blob) return;
    loader(true);
    try {
      const url = await uploadFile(blob, 'visits', 'jpg');
      const { error } = await sb.from('visits').update({ photo_url: url }).eq('id', v.id);
      if (error) throw error;
      v.photo_url = url;
      toast('Foto tersimpan.');
      stepFoto(ctx);
    } finally { loader(false); }
  };
  el.querySelector('#cam').onclick = (e) => busy(e.currentTarget, async () => save(await openCamera()));
  el.querySelector('#alb').onclick = (e) => busy(e.currentTarget, async () => save(await pickImage(5)));
}

// ---------- 2. Produk ----------
const FIELDS = ['product_id', 'volume', 'moda', 'harga_jual', 'harga_beli', 'stok', 'top_hari'];
function changeState(it) {
  if (!ctxIsRevisit(it)) return null;
  if (!it.prev_snapshot) return 'baru';
  return FIELDS.some((f) => Number(it[f]) !== Number(it.prev_snapshot[f]) && String(it[f]) !== String(it.prev_snapshot[f])) ? 'diubah' : 'sama';
}
let currentRevisit = false;
const ctxIsRevisit = () => currentRevisit;

function prevVal(it, f, fmt) {
  const p = it.prev_snapshot;
  if (!p || String(p[f]) === String(it[f]) || Number(p[f]) === Number(it[f])) return '';
  return `<span class="strike">${esc(fmt(p[f]))}</span>`;
}

function productCard(it, editable) {
  const st = changeState(it);
  const chip = { baru: '<span class="chip green">Baru</span>', diubah: '<span class="chip amber">Diubah</span>', sama: '<span class="chip grey">Sama</span>' }[st] || '';
  const ton = (x) => `${num(x)} Ton`;
  return `<article class="card ${st === 'diubah' ? 'changed' : ''}">
    <div class="card-top" style="align-items:flex-start">
      <span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:11px;font-weight:700;color:var(--muted)">${esc(it.product.produsen)} · ${esc(it.product.tipe)}</span>
      <span class="card-title" style="font-size:14px">${esc(it.product.merek)}</span></span>${chip}
    </div>
    <div class="grid2">
      <span><small>Volume/bulan</small><b>${ton(it.volume)}${prevVal(it, 'volume', num)}</b></span>
      <span><small>Stok saat ini</small><b>${ton(it.stok)}${prevVal(it, 'stok', num)}</b></span>
      <span><small>Harga jual /ton</small><b>${rupiah(it.harga_jual)}${prevVal(it, 'harga_jual', rupiah)}</b></span>
      <span><small>Harga beli /ton</small><b>${rupiah(it.harga_beli)}${prevVal(it, 'harga_beli', rupiah)}</b></span>
      <span><small>Moda kirim</small><b>${esc(it.moda.split(' - ')[0])}</b></span>
      <span><small>TOP</small><b>${it.top_hari} hari${prevVal(it, 'top_hari', (x) => x)}</b></span>
    </div>
    ${editable ? `<div class="card-foot"><button class="btn btn-soft btn-sm" data-del="${it.id}">Hapus</button><button class="btn btn-outline btn-sm" data-edit="${it.id}">Ubah</button></div>` : ''}
  </article>`;
}

function stepProduk(ctx) {
  currentRevisit = ctx.v.is_revisit;
  const items = ctx.v.items;
  const totVol = items.reduce((s, i) => s + Number(i.volume), 0);
  const totStok = items.reduce((s, i) => s + Number(i.stok), 0);
  const el = stepShell(ctx, 2, `
    <div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <div><small>Total volume/bulan</small><b>${num(totVol)} Ton</b></div>
      <div><small>Total stok saat ini</small><b>${num(totStok)} Ton</b></div>
    </div>
    <button class="btn btn-outline btn-block" id="add">${icon.plus()} Tambah Produk</button>
    ${items.length ? items.map((i) => productCard(i, true)).join('') : emptyState('Belum ada produk', 'Tambahkan produk yang dijual (SIG maupun kompetitor).')}`);
  bindNav(el, ctx, 2, () => !items.length && 'Tambahkan minimal 1 produk.');
  el.querySelector('#add').onclick = () => productForm(ctx);
  el.querySelector('.content').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) productForm(ctx, items.find((i) => i.id === ed.dataset.edit));
    if (del) {
      if (!(await confirmModal('Hapus produk?', 'Produk beserta isian keluhan & promosinya akan dihapus.', 'Hapus'))) return;
      busy(del, async () => {
        const { error } = await sb.from('visit_products').delete().eq('id', del.dataset.del);
        if (error) throw error;
        ctx.v.items = items.filter((i) => i.id !== del.dataset.del);
        stepProduk(ctx);
      });
    }
  });
}

async function productForm(ctx, existing) {
  const products = await getProducts();
  const produsen = [...new Set(products.map((p) => p.produsen))];
  const it = existing || {};
  const cur = existing ? products.find((p) => p.id === existing.product_id) : null;
  const money = (x) => (x ? Number(x).toLocaleString('id-ID') : '');
  const { el, close } = openSheet(`
    ${sheetHeader(existing ? 'Ubah Produk' : 'Tambah Produk')}
    <form class="content white" id="f" novalidate>
      <div class="field"><label for="produsen">Produsen <span class="req">*</span></label>
        <select class="select" id="produsen" name="produsen">${selectOptions(produsen, cur?.produsen, 'Pilih produsen')}</select></div>
      <div class="field"><label for="product_id">Merek/Kemasan <span class="req">*</span></label>
        <select class="select" id="product_id" name="product_id"></select></div>
      <div class="field"><label for="tipe">Tipe Produk</label><input class="input" id="tipe" readonly placeholder="Terisi otomatis"></div>
      <div class="field"><label for="volume">Volume Penjualan/Bulan <span class="req">*</span></label>
        <div class="input-group"><input class="input" id="volume" name="volume" inputmode="decimal" value="${esc(it.volume ?? '')}" placeholder="0"><span class="addon">Ton</span></div></div>
      <div class="field"><label for="moda">Moda Pengiriman <span class="req">*</span></label>
        <select class="select" id="moda" name="moda">${selectOptions(MODA, it.moda, 'Pilih moda pengiriman')}</select></div>
      <div class="field"><label for="harga_jual">Harga Jual <span class="req">*</span></label>
        <div class="input-group"><span class="addon">Rp</span><input class="input" id="harga_jual" name="harga_jual" inputmode="numeric" data-money value="${money(it.harga_jual)}" placeholder="0"><span class="addon">/Ton</span></div>
        <span class="hint">Rp500.000 – Rp8.000.000 per ton</span></div>
      <div class="field"><label for="harga_beli">Harga Beli (termasuk pajak) <span class="req">*</span></label>
        <div class="input-group"><span class="addon">Rp</span><input class="input" id="harga_beli" name="harga_beli" inputmode="numeric" data-money value="${money(it.harga_beli)}" placeholder="0"><span class="addon">/Ton</span></div>
        <span class="hint">Rp500.000 – Rp8.000.000 per ton</span></div>
      <div class="field"><label for="stok">Stok Saat Ini <span class="req">*</span></label>
        <div class="input-group"><input class="input" id="stok" name="stok" inputmode="decimal" value="${esc(it.stok ?? '')}" placeholder="0"><span class="addon">Ton</span></div></div>
      <div class="field"><label for="top_hari">Term of Payment <span class="req">*</span></label>
        <div class="input-group"><input class="input" id="top_hari" name="top_hari" inputmode="numeric" value="${esc(it.top_hari ?? '')}" placeholder="0"><span class="addon">Hari</span></div>
        <span class="hint">0 – 100 hari</span></div>
    </form>
    <div class="bottom-bar"><button class="btn btn-primary" id="save">Simpan</button></div>`);
  const f = el.querySelector('#f');
  const F = (n) => f.elements[n];
  const fillMerek = (keep) => {
    const list = products.filter((p) => p.produsen === F('produsen').value);
    F('product_id').innerHTML = selectOptions(list.map((p) => [p.id, p.merek]), keep, F('produsen').value ? 'Pilih merek/kemasan' : 'Pilih produsen dulu');
    F('product_id').disabled = !F('produsen').value;
    setTipe();
  };
  const setTipe = () => { el.querySelector('#tipe').value = products.find((p) => String(p.id) === F('product_id').value)?.tipe || ''; };
  F('produsen').onchange = () => fillMerek('');
  F('product_id').onchange = setTipe;
  fillMerek(cur?.id);
  f.querySelectorAll('[data-money]').forEach((i) => (i.oninput = () => { const d = digits(i.value).slice(0, 10); i.value = d ? Number(d).toLocaleString('id-ID') : ''; }));
  F('top_hari').oninput = (e) => (e.target.value = digits(e.target.value).slice(0, 3));
  ['volume', 'stok'].forEach((n) => (F(n).oninput = (e) => (e.target.value = e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))));

  el.querySelector('#save').onclick = (e) => {
    const pid = Number(F('product_id').value);
    const vol = parseFloat(F('volume').value);
    const stok = parseFloat(F('stok').value);
    const hj = Number(digits(F('harga_jual').value));
    const hb = Number(digits(F('harga_beli').value));
    const top = F('top_hari').value === '' ? NaN : Number(F('top_hari').value);
    const range = (x) => !x ? 'Wajib diisi.' : (x < HARGA_MIN || x > HARGA_MAX) ? 'Harus di antara Rp500.000 – Rp8.000.000.' : null;
    const errs = {
      produsen: !F('produsen').value && 'Pilih produsen.',
      product_id: !pid && 'Pilih merek/kemasan.',
      volume: (!(vol > 0)) && 'Isi volume lebih dari 0.',
      moda: !F('moda').value && 'Pilih moda pengiriman.',
      harga_jual: range(hj),
      harga_beli: range(hb),
      stok: (!(stok >= 0) || F('stok').value === '') && 'Isi stok (boleh 0).',
      top_hari: (!(top >= 0 && top <= 100) || !Number.isInteger(top)) && 'Isi 0 – 100 hari.',
    };
    Object.entries(errs).forEach(([k, m]) => setFieldError(f, k, m));
    if (Object.values(errs).some(Boolean)) return toast('Periksa isian yang ditandai merah.', 'error');
    if (ctx.v.items.some((i) => i.product_id === pid && i.id !== existing?.id)) return toast('Produk ini sudah ada di daftar. Ubah yang sudah ada.', 'error');
    busy(e.currentTarget, async () => {
      const row = { product_id: pid, volume: vol, moda: F('moda').value, harga_jual: hj, harga_beli: hb, stok, top_hari: top };
      const sel = '*, product:products(*)';
      if (existing) {
        const { data, error } = await sb.from('visit_products').update(row).eq('id', existing.id).select(sel).single();
        if (error) throw error;
        ctx.v.items = ctx.v.items.map((i) => (i.id === existing.id ? data : i));
      } else {
        const { data, error } = await sb.from('visit_products').insert({ ...row, visit_id: ctx.v.id }).select(sel).single();
        if (error) throw error;
        ctx.v.items.push(data);
      }
      close();
      toast(existing ? 'Produk diubah.' : 'Produk ditambahkan.');
      stepProduk(ctx);
    });
  };
}

// ---------- 3. Keluhan ----------
function keluhanCount(k) {
  if (!k || k.none) return 0;
  return Object.values(k.items || {}).reduce((s, g) => s + Object.keys(g).length, 0) + (k.deskripsi ? 1 : 0);
}
function keluhanChip(k) {
  if (!k) return '<span class="chip blue">Belum Diisi</span>';
  if (k.none) return '<span class="chip green">Tidak Ada Keluhan</span>';
  return `<span class="chip amber">Ada Keluhan (${keluhanCount(k)})</span>`;
}
function itemRow(it, chip) {
  return `<button class="card list-btn" data-id="${it.id}" style="flex-direction:row;align-items:center;gap:12px">
    <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
      <span style="font-size:11px;font-weight:700;color:var(--muted)">${esc(it.product.produsen)} · ${esc(it.product.tipe)}</span>
      <span class="card-title" style="font-size:14px">${esc(it.product.merek)}</span>
      <span>${chip}</span>
    </span>${icon.chevron()}</button>`;
}

function stepKeluhan(ctx) {
  const items = ctx.v.items;
  const el = stepShell(ctx, 3, `<p class="muted" style="margin:0">Ketuk setiap produk lalu isi ada atau tidaknya keluhan.</p>
    ${items.map((i) => itemRow(i, keluhanChip(i.keluhan))).join('')}`);
  bindNav(el, ctx, 3, () => items.some((i) => !i.keluhan) && 'Semua produk wajib diisi keluhannya (ada/tidak ada).');
  el.querySelector('.content').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) keluhanForm(ctx, items.find((i) => i.id === b.dataset.id));
  });
}

function keluhanForm(ctx, it) {
  const k = it.keluhan || { none: false, items: {}, deskripsi: '' };
  const has = (cat, item) => k.items?.[cat]?.[item] !== undefined;
  const { el, close } = openSheet(`
    ${sheetHeader('Isi Keluhan')}
    <div class="content white">
      <div class="card" style="gap:2px"><span style="font-size:11px;font-weight:700;color:var(--muted)">${esc(it.product.produsen)}</span><span class="card-title" style="font-size:14px">${esc(it.product.merek)}</span></div>
      <label class="switch-row"><span class="switch"><input type="checkbox" id="none" ${k.none ? 'checked' : ''}><span></span></span><b>Tidak ada keluhan</b></label>
      <div id="cats">
        ${KELUHAN.map((g) => `<div class="group-title">${esc(g.label)}</div>
          ${g.items.map((item, i) => `<div>
            <label class="check-row"><input type="checkbox" data-cat="${esc(g.label)}" data-item="${esc(item)}" ${has(g.label, item) ? 'checked' : ''}> ${esc(item)}</label>
            ${g.qty ? `<div class="input-group" data-qty-for="${g.key}-${i}" style="margin:0 0 8px 32px" ${has(g.label, item) ? '' : 'hidden'}>
              <input class="input" inputmode="numeric" aria-label="Jumlah zak untuk ${esc(item)}" data-qty="${esc(item)}" value="${esc(has(g.label, item) ? k.items[g.label][item] : '')}" placeholder="Jumlah"><span class="addon">Zak</span></div>` : ''}
          </div>`).join('')}`).join('')}
        <div class="group-title">Deskripsi Lainnya</div>
        <label class="check-row"><input type="checkbox" id="desc-on" ${k.deskripsi ? 'checked' : ''}> Deskripsi lainnya</label>
        <textarea class="textarea" id="desc" maxlength="1000" placeholder="Tulis keluhan lainnya" ${k.deskripsi ? '' : 'hidden'}>${esc(k.deskripsi || '')}</textarea>
      </div>
    </div>
    <div class="bottom-bar"><button class="btn btn-primary" id="save">Simpan</button></div>`);
  const cats = el.querySelector('#cats');
  const sync = () => (cats.hidden = el.querySelector('#none').checked);
  el.querySelector('#none').onchange = sync;
  sync();
  cats.addEventListener('change', (e) => {
    const cb = e.target;
    if (cb.id === 'desc-on') { el.querySelector('#desc').hidden = !cb.checked; if (cb.checked) el.querySelector('#desc').focus(); return; }
    const box = cb.closest('div')?.querySelector('[data-qty-for]');
    if (box) { box.hidden = !cb.checked; if (cb.checked) box.querySelector('input').focus(); }
  });
  cats.addEventListener('input', (e) => { if (e.target.dataset.qty !== undefined) e.target.value = digits(e.target.value).slice(0, 6); });
  el.querySelector('#save').onclick = (e) => {
    let val;
    if (el.querySelector('#none').checked) val = { none: true };
    else {
      const items = {};
      let bad = null;
      cats.querySelectorAll('input[data-cat]:checked').forEach((cb) => {
        const qtyInput = cb.closest('div').querySelector('[data-qty]');
        let v = true;
        if (qtyInput) {
          v = Number(qtyInput.value);
          if (!(v > 0)) bad = `Isi jumlah zak untuk "${cb.dataset.item}".`;
        }
        (items[cb.dataset.cat] ||= {})[cb.dataset.item] = v;
      });
      const descOn = el.querySelector('#desc-on').checked;
      const desc = el.querySelector('#desc').value.trim();
      if (descOn && !desc) bad = 'Tulis deskripsi keluhan lainnya.';
      if (bad) return toast(bad, 'error');
      if (!Object.keys(items).length && !desc) return toast('Pilih minimal 1 keluhan, atau aktifkan "Tidak ada keluhan".', 'error');
      val = { none: false, items, deskripsi: descOn ? desc : '' };
    }
    busy(e.currentTarget, async () => {
      const { error } = await sb.from('visit_products').update({ keluhan: val }).eq('id', it.id);
      if (error) throw error;
      it.keluhan = val;
      close();
      toast('Keluhan tersimpan.');
      stepKeluhan(ctx);
    });
  };
}

// ---------- 4. Promosi ----------
function promosiChip(p) {
  if (!p) return '<span class="chip blue">Belum Diisi</span>';
  if (p.none) return '<span class="chip green">Tidak Ada Promosi</span>';
  return `<span class="chip amber">${p.programs.length} Program</span>`;
}

function stepPromosi(ctx) {
  const items = ctx.v.items;
  const el = stepShell(ctx, 4, `<p class="muted" style="margin:0">Ketuk setiap produk lalu isi program promosinya, atau tandai tidak ada promosi.</p>
    ${items.map((i) => itemRow(i, promosiChip(i.promosi))).join('')}`);
  bindNav(el, ctx, 4, () => items.some((i) => !i.promosi) && 'Semua produk wajib diisi promosinya (ada/tidak ada).');
  el.querySelector('.content').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) promosiForm(ctx, items.find((i) => i.id === b.dataset.id));
  });
}

function programSummary(pg) {
  const val = pg.jenis === 'Jumlah Poin' ? `${num(pg.poin)} poin` : pg.jenis === 'Wisata' ? `${esc(pg.jenis_wisata)}: ${esc(pg.wisata)}` : `Potongan ${rupiah(pg.potongan)}`;
  return `${val} setiap pembelian ${num(pg.setiap)} ton · ${fmtDate(pg.mulai)} – ${fmtDate(pg.selesai)}`;
}

function promosiForm(ctx, it) {
  const draft = it.promosi ? JSON.parse(JSON.stringify(it.promosi)) : { none: false, programs: [] };
  draft.programs ||= [];
  const { el, close } = openSheet(`
    ${sheetHeader('Isi Promosi')}
    <div class="content white">
      <div class="card" style="gap:2px"><span style="font-size:11px;font-weight:700;color:var(--muted)">${esc(it.product.produsen)} · ${esc(it.product.tipe)}</span><span class="card-title" style="font-size:14px">${esc(it.product.merek)}</span></div>
      <label class="switch-row"><span class="switch"><input type="checkbox" id="none" ${draft.none ? 'checked' : ''}><span></span></span><b>Tidak ada promosi</b></label>
      <div id="progs" class="stack-8"></div>
    </div>
    <div class="bottom-bar"><button class="btn btn-primary" id="save">Simpan</button></div>`);
  const progs = el.querySelector('#progs');
  const draw = () => {
    progs.hidden = el.querySelector('#none').checked;
    progs.innerHTML = `<div class="row-between"><b>Program</b><button class="btn btn-primary btn-sm" id="addp">${icon.plus(16)} Tambah Program</button></div>
      ${draft.programs.length ? draft.programs.map((pg, i) => `<article class="card" style="gap:6px">
        <div class="card-top"><span class="chip red">${esc(pg.jenis)}</span><button class="icon-btn red" data-rm="${i}" aria-label="Hapus program ${esc(pg.nama)}">${icon.trash(20)}</button></div>
        <span class="card-title" style="font-size:14px">${esc(pg.nama)}</span><span class="card-sub">${programSummary(pg)}</span></article>`).join('')
        : emptyState('Belum ada program')}`;
    progs.querySelector('#addp').onclick = () => programForm((pg) => { draft.programs.push(pg); draw(); });
  };
  draw();
  el.querySelector('#none').onchange = draw;
  progs.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { draft.programs.splice(Number(rm.dataset.rm), 1); draw(); }
  });
  el.querySelector('#save').onclick = (e) => {
    const none = el.querySelector('#none').checked;
    if (!none && !draft.programs.length) return toast('Tambah minimal 1 program, atau aktifkan "Tidak ada promosi".', 'error');
    const val = none ? { none: true } : { none: false, programs: draft.programs };
    busy(e.currentTarget, async () => {
      const { error } = await sb.from('visit_products').update({ promosi: val }).eq('id', it.id);
      if (error) throw error;
      it.promosi = val;
      close();
      toast('Promosi tersimpan.');
      stepPromosi(ctx);
    });
  };
}

function programForm(onSave) {
  const { el, close } = openSheet(`
    ${sheetHeader('Tambah Program')}
    <form class="content white" id="f" novalidate>
      <div class="field"><label for="jenis">Jenis Program <span class="req">*</span></label>
        <select class="select" id="jenis" name="jenis">${selectOptions(PROGRAM_TYPES, '', 'Pilih jenis program')}</select></div>
      <div id="wisata-type" class="field" hidden><label for="jenis_wisata">Jenis Wisata <span class="req">*</span></label>
        <select class="select" id="jenis_wisata" name="jenis_wisata">${selectOptions(['Luar Negeri', 'Dalam Negeri'], '', 'Pilih jenis wisata')}</select></div>
      <div class="field"><label for="nama">Nama &amp; Deskripsi Program <span class="req">*</span></label>
        <input class="input" id="nama" name="nama" maxlength="200" placeholder="Masukkan nama program"></div>
      <div class="field"><label for="mulai">Tanggal Mulai <span class="req">*</span></label><input class="input" type="date" id="mulai" name="mulai"></div>
      <div class="field"><label for="selesai">Tanggal Selesai <span class="req">*</span></label><input class="input" type="date" id="selesai" name="selesai"></div>
      <div id="f-poin" class="field" hidden><label for="poin">Jumlah Poin <span class="req">*</span></label>
        <input class="input" id="poin" name="poin" inputmode="numeric" placeholder="Masukkan jumlah poin"></div>
      <div id="f-wisata" class="field" hidden><label for="wisata">Wisata <span class="req">*</span></label>
        <input class="input" id="wisata" name="wisata" maxlength="150" placeholder="Contoh: Bali 3 hari 2 malam"></div>
      <div id="f-potongan" class="field" hidden><label for="potongan">Potongan Harga <span class="req">*</span></label>
        <div class="input-group"><span class="addon">Rp</span><input class="input" id="potongan" name="potongan" inputmode="numeric" placeholder="Masukkan potongan harga"></div></div>
      <div class="field"><label for="setiap">Setiap Pembelian <span class="req">*</span></label>
        <div class="input-group"><input class="input" id="setiap" name="setiap" inputmode="decimal" placeholder="Masukkan setiap pembelian"><span class="addon">Ton</span></div></div>
    </form>
    <div class="bottom-bar"><button class="btn btn-primary" id="save">Simpan</button></div>`);
  const f = el.querySelector('#f');
  const F = (n) => f.elements[n];
  const mode = () => {
    const j = F('jenis').value;
    el.querySelector('#wisata-type').hidden = j !== 'Wisata';
    el.querySelector('#f-wisata').hidden = j !== 'Wisata';
    el.querySelector('#f-poin').hidden = j !== 'Jumlah Poin';
    el.querySelector('#f-potongan').hidden = j !== 'Potongan Harga';
  };
  F('jenis').onchange = mode;
  F('poin').oninput = (e) => (e.target.value = digits(e.target.value).slice(0, 9));
  F('potongan').oninput = (e) => { const d = digits(e.target.value).slice(0, 10); e.target.value = d ? Number(d).toLocaleString('id-ID') : ''; };
  F('setiap').oninput = (e) => (e.target.value = e.target.value.replace(',', '.').replace(/[^\d.]/g, ''));
  el.querySelector('#save').onclick = () => {
    const j = F('jenis').value;
    const pg = { jenis: j, nama: F('nama').value.trim(), mulai: F('mulai').value, selesai: F('selesai').value, setiap: parseFloat(F('setiap').value) };
    const errs = {
      jenis: !j && 'Pilih jenis program.',
      nama: pg.nama.length < 3 && 'Isi minimal 3 huruf.',
      mulai: !pg.mulai && 'Pilih tanggal mulai.',
      selesai: (!pg.selesai && 'Pilih tanggal selesai.') || (pg.mulai && pg.selesai < pg.mulai && 'Tidak boleh sebelum tanggal mulai.'),
      setiap: !(pg.setiap > 0) && 'Isi lebih dari 0.',
    };
    if (j === 'Jumlah Poin') { pg.poin = Number(F('poin').value); errs.poin = !(pg.poin > 0) && 'Isi jumlah poin.'; }
    if (j === 'Wisata') {
      pg.jenis_wisata = F('jenis_wisata').value; pg.wisata = F('wisata').value.trim();
      errs.jenis_wisata = !pg.jenis_wisata && 'Pilih jenis wisata.';
      errs.wisata = !pg.wisata && 'Isi tujuan wisata.';
    }
    if (j === 'Potongan Harga') { pg.potongan = Number(digits(F('potongan').value)); errs.potongan = !(pg.potongan > 0) && 'Isi potongan harga.'; }
    Object.entries(errs).forEach(([k, m]) => setFieldError(f, k, m));
    if (Object.values(errs).some(Boolean)) return toast('Lengkapi data yang ditandai merah.', 'error');
    onSave(pg);
    close();
  };
}

// ---------- 5. Konfirmasi ----------
function reviewHtml(ctx) {
  const v = ctx.v;
  currentRevisit = v.is_revisit;
  return `
    ${infoCard(v)}
    <div class="section-head"><h2>Foto</h2></div>
    <div class="upload">${v.photo_url ? `<img src="${esc(v.photo_url)}" alt="Foto visit">` : '<span class="muted">Tidak ada foto</span>'}</div>
    <div class="section-head"><h2>Produk (${v.items.length})</h2></div>
    ${v.items.map((it) => `${productCard(it, false)}
      <div class="card" style="gap:6px;margin-top:-6px">
        <div class="row-between"><b style="font-size:13px">Keluhan</b>${keluhanChip(it.keluhan)}</div>
        ${it.keluhan && !it.keluhan.none ? `<ul style="margin:0;padding-left:18px;font-size:13px">${Object.entries(it.keluhan.items || {}).flatMap(([cat, g]) => Object.entries(g).map(([item, q]) => `<li>${esc(cat)}: ${esc(item)}${q !== true ? ` (${num(q)} zak)` : ''}</li>`)).join('')}${it.keluhan.deskripsi ? `<li>Lainnya: ${esc(it.keluhan.deskripsi)}</li>` : ''}</ul>` : ''}
        <div class="row-between"><b style="font-size:13px">Promosi</b>${promosiChip(it.promosi)}</div>
        ${it.promosi && !it.promosi.none ? `<ul style="margin:0;padding-left:18px;font-size:13px">${it.promosi.programs.map((pg) => `<li><b>${esc(pg.jenis)}</b> – ${esc(pg.nama)}: ${programSummary(pg)}</li>`).join('')}</ul>` : ''}
      </div>`).join('')}`;
}

function stepKonfirmasi(ctx) {
  const v = ctx.v;
  const el = stepShell(ctx, 5, `<div class="banner blue">${icon.info()}<span>Periksa kembali semua isian. Setelah diselesaikan, data tidak bisa diubah.</span></div>${reviewHtml(ctx)}`, { nextLabel: 'Selesai', banner: false });
  bindNav(el, ctx, 5, () => {
    if (!v.photo_url) return 'Foto belum diupload.';
    if (!v.items.length) return 'Produk masih kosong.';
    if (v.items.some((i) => !i.keluhan)) return 'Masih ada keluhan yang belum diisi.';
    if (v.items.some((i) => !i.promosi)) return 'Masih ada promosi yang belum diisi.';
  }, async () => {
    const { error } = await sb.from('visits').update({ status: 'selesai', step: 5, finished_at: new Date().toISOString() }).eq('id', v.id);
    if (error) throw error;
    await successModal(v.kind === 'toko' ? 'Market visit berhasil diselesaikan.' : 'Visitasi project berhasil diselesaikan.', 'Tutup');
    go(backTab(v));
  });
}

function renderDone(ctx) {
  const v = ctx.v;
  render(`
  <div class="screen">
    ${header(KIND[v.kind].visit, ctx.mine ? backTab(v) : '/outlet/' + v.outlet_id, { sub: v.ref_no })}
    <div class="content">
      <div class="row-between">${statusChip(v.status)}${v.is_revisit ? `<span class="chip blue">Revisit dari ${fmtDate(ctx.prevDate)}</span>` : ''}</div>
      ${v.note ? `<div class="card"><small class="muted">Catatan</small><div>${esc(v.note)}</div></div>` : ''}
      ${reviewHtml(ctx)}
      <a class="btn btn-outline btn-block" href="#/outlet/${v.outlet_id}">${icon.history(20)} Riwayat ${KIND[v.kind].label.toLowerCase()} ini</a>
    </div>
  </div>`);
}

// =====================================================================
// Riwayat satu toko/project + Revisit
// =====================================================================
export async function renderOutlet(id) {
  render(`<div class="screen">${header('Riwayat', '/visits?tab=riwayat')}<div class="content">${skeleton(3)}</div></div>`);
  const [o, vs] = await Promise.all([
    sb.from('outlets').select('*').eq('id', id).maybeSingle(),
    sb.from('visits').select('*, items:visit_products(volume, keluhan, promosi)').eq('outlet_id', id).eq('status', 'selesai').order('visit_date', { ascending: false }).order('finished_at', { ascending: false }),
  ]);
  if (o.error) throw o.error;
  if (vs.error) throw vs.error;
  if (!o.data) { toast('Data tidak ditemukan atau di luar wilayah Anda.', 'error'); return go('/visits?tab=riwayat'); }
  const outlet = o.data;
  const k = KIND[outlet.kind];
  const visits = vs.data;
  const uids = [...new Set(visits.map((v) => v.user_id))];
  const names = {};
  if (uids.length) {
    const pr = await sb.from('profiles').select('id, full_name').in('id', uids);
    (pr.data || []).forEach((p) => (names[p.id] = p.full_name));
  }
  const last = visits[0];
  const lastVol = last ? last.items.reduce((s, i) => s + Number(i.volume), 0) : 0;
  const lastKel = last ? last.items.reduce((s, i) => s + keluhanCount(i.keluhan), 0) : 0;

  const el = render(`
  <div class="screen">
    ${header('Riwayat ' + k.label, '/visits?tab=riwayat')}
    <div class="content">
      <div class="card">
        <span class="card-title" style="font-size:18px">${esc(outlet.name)}</span>
        <span class="card-sub">${k.idLabel}: ${codeOrPending(outlet)}</span>
        <span class="card-sub">${esc(outlet.address || '-')}${outlet.city ? ', ' + esc(outlet.city) : ''}</span>
        <div class="stats">
          <div><small>Total visit</small><b>${visits.length}</b></div>
          <div><small>Volume/bln</small><b>${num(lastVol)} Ton</b></div>
          <div><small>Keluhan terakhir</small><b>${lastKel}</b></div>
        </div>
      </div>
      <div class="section-head"><h2>Timeline Visit</h2></div>
      ${visits.length ? visits.map((v, i) => {
        const kel = v.items.reduce((s, it) => s + keluhanCount(it.keluhan), 0);
        const pro = v.items.reduce((s, it) => s + (it.promosi && !it.promosi.none ? it.promosi.programs.length : 0), 0);
        return `<div class="tl"><div class="rail"><span class="dot ${i === 0 ? 'cur' : ''}"></span><span class="line"></span></div>
          <a class="card list-btn" href="#/visit/${v.id}">
            <div class="card-top"><b>${fmtDate(v.visit_date)}</b><span class="chip grey">${v.is_revisit ? 'Revisit' : 'Visit pertama'}</span></div>
            <div class="thumbs">${v.photo_url ? `<img src="${esc(v.photo_url)}" alt="Foto visit ${fmtDate(v.visit_date)}" loading="lazy">` : '<span class="ph">Tanpa foto</span>'}</div>
            <span style="font-size:13px;color:var(--ink-2)">${v.items.length} produk · ${kel ? kel + ' keluhan' : 'tidak ada keluhan'} · ${pro ? pro + ' program promosi' : 'tidak ada promosi'}</span>
            <span class="card-sub">oleh ${esc(names[v.user_id] || '-')}</span>
          </a></div>`;
      }).join('') : emptyState('Belum ada visit yang selesai')}
    </div>
    <div class="bottom-bar" style="flex-direction:column;gap:6px">
      <button class="btn btn-primary" id="rv">${icon.revisit()} ${visits.length ? 'Revisit' : 'Visit'} ${k.label} Ini</button>
      ${last ? `<span class="hint" style="text-align:center">Isian otomatis dari visit ${fmtDate(last.visit_date)}, tinggal ubah yang berbeda</span>` : ''}
    </div>
  </div>`);
  el.querySelector('#rv').onclick = (e) => busy(e.currentTarget, async () => {
    const open = await sb.from('visits').select('id').eq('user_id', state.user.id).eq('outlet_id', outlet.id).neq('status', 'selesai').order('visit_date', { ascending: false }).limit(1);
    if (open.error) throw open.error;
    if (open.data.length) {
      toast('Masih ada visit yang belum selesai untuk tempat ini. Lanjutkan yang itu dulu.');
      return go('/visit/' + open.data[0].id);
    }
    const v = await createVisit(outlet, today(), 'Revisit');
    if (v) go('/visit/' + v.id);
  });
}
