import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, LOGIN_EMAIL_DOMAIN } from './config.js';

export const configured = !SUPABASE_URL.includes('XXXX') && !SUPABASE_ANON_KEY.includes('PASTE');
export const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true } }) : null;

export const state = { user: null, profile: null };

// ---------- Konstanta ----------
export const ROLE_LABEL = { gm: 'General Manager', sm: 'Senior Manager', sales: 'Sales' };

export const ACTIVITY_CATEGORIES = [
  { code: 'MMR', label: 'Monthly Meeting (Retail)', prefix: 'MM', tipe: 'retail' },
  { code: 'MMP', label: 'Monthly Meeting (Project)', prefix: 'MMP', tipe: 'project' },
  { code: 'MB', label: 'Morning Briefing', prefix: 'MB', tipe: 'retail' },
  { code: 'WMP', label: 'Weekly Meeting (Project)', prefix: 'WMP', tipe: 'project' },
  { code: 'WPDR', label: 'Weekly Performance Dialogue (Retail)', prefix: 'WPD', tipe: 'retail' },
  { code: 'WPDP', label: 'Weekly Performance Dialogue (Project)', prefix: 'WPDP', tipe: 'project' },
];
export const catByLabel = (label) => ACTIVITY_CATEGORIES.find((c) => c.label === label);

export const OBJEKTIF = ['Membina Hubungan', 'Memperbaiki Margin', 'Memperbaiki Volume', 'Menangani Keluhan Pelanggan', 'Pembaharuan Data Pelanggan', 'Penagihan'];
export const TOPIK = ['Achievement Last Month', 'Channel Management', 'Distributor Performance', 'Market Update'];
export const KATEGORI_PRODUK = ['Semen', 'Mortar', 'Besi', 'Baja Ringan', 'Genteng'];
export const PIC_SUPPORT = ['Pricing', 'Market Intelligence', 'Brand Management'];
export const STATUS_TOPIK = ['Pending', 'In Progress', 'Completed'];
export const PRIORITAS = ['Low', 'Medium', 'High'];
export const MODA = ['CIF - Cost, Insurance, and Freight', 'FRC - Franco', 'FAS - Free Alongside Ship'];
export const HARGA_MIN = 500000;
export const HARGA_MAX = 8000000;

export const KELUHAN = [
  { key: 'kualitas', label: 'Kualitas', qty: true, items: ['Kemasan Jumbo Bag Tidak Kuat', 'Kemasan Jumbo Bag Rusak Saat Diterima', 'Tidak Sesuai Spesifikasi', 'Waktu Pengikatan Tidak Normal (Terlalu Cepat)', 'Waktu Pengikatan Tidak Normal (Terlalu Lambat)', 'Retak Setelah Aplikasi', 'Produk Tidak Sesuai Spesifikasi', 'Produk Menggumpal / Membatu', 'Warna Produk Tidak Normal', 'Kekuatan Produk Rendah', 'Produk Terkontaminasi', 'Kantong Produk Tidak Kuat / Rusak / Pecah'] },
  { key: 'daya_saing', label: 'Daya Saing', items: ['TOP Kurang Lama', 'Harga Tidak Bersaing dengan Kompetitor', 'Hadiah Program Penjualan Belum Dicairkan', 'Tata cara pemesanan sulit', 'Program Penjualan Tidak Menarik', 'Tidak Ada / Kurangnya Program', 'Harga Tidak Kompetitif'] },
  { key: 'pengiriman', label: 'Pengiriman', items: ['Pengiriman Terlambat', 'Jumlah Barang Tidak Sesuai Pesanan / Kurang', 'Sulit Melacak Posisi Truk', 'Produk Terlambat Datang'] },
  { key: 'pelayanan', label: 'Pelayanan', items: ['Pemesanan Sulit', 'Layanan keluhan sulit diakses', 'Stok tidak tersedia di plant tertentu', 'Prosedur pembayaran rumit', 'Sulit Mengajukan Komplain'] },
  { key: 'aplikasi', label: 'Aplikasi', items: ['Masalah Kualitas Agregat', 'Tercemar Air Saat Pencampuran', 'Kesalahan dalam Cara Aplikasi Produk'] },
  { key: 'operasional', label: 'Operasional', items: ['Penataan Palet Tidak Rapi / Tidak Standar', 'Berat Produk Tidak Sesuai / Kurang'] },
];

export const PROGRAM_TYPES = ['Jumlah Poin', 'Wisata', 'Potongan Harga'];

// ---------- Auth ----------
export function toEmail(username) {
  const u = username.trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${LOGIN_EMAIL_DOMAIN}`;
}

export async function loadProfile() {
  const { data: { session } } = await sb.auth.getSession();
  state.user = session?.user ?? null;
  state.profile = null;
  if (!state.user) return null;
  const { data, error } = await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
  if (error) throw error;
  state.profile = data;
  return data;
}

export const isManager = () => ['sm', 'gm'].includes(state.profile?.role);

// ---------- Upload ke Storage ----------
export async function uploadFile(blob, folder, ext) {
  const path = `${state.user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from('evidence').upload(path, blob, { contentType: blob.type || undefined, upsert: false });
  if (error) throw error;
  return sb.storage.from('evidence').getPublicUrl(path).data.publicUrl;
}

// ---------- KPI bulan berjalan ----------
export async function loadKpi() {
  const role = state.profile.role;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const [t, a, v] = await Promise.all([
    sb.from('kpi_targets').select('*').eq('role', role).order('sort'),
    sb.from('activities').select('category').eq('user_id', state.user.id).eq('status', 'selesai').gte('finished_at', start).lt('finished_at', end),
    sb.from('visits').select('kind').eq('user_id', state.user.id).eq('status', 'selesai').gte('finished_at', start).lt('finished_at', end),
  ]);
  for (const r of [t, a, v]) if (r.error) throw r.error;
  const count = {};
  for (const row of a.data) {
    const c = catByLabel(row.category);
    if (c) count[c.code] = (count[c.code] || 0) + 1;
  }
  for (const row of v.data) {
    const code = row.kind === 'toko' ? 'VT' : 'VP';
    count[code] = (count[code] || 0) + 1;
  }
  return t.data.map((k) => ({ ...k, done: count[k.code] || 0 }));
}
