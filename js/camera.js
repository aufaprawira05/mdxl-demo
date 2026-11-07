import { icon, esc, toast } from './ui.js';

const MAX_SIDE = 1600;

// ---------- Lokasi ----------
export function getPosition(timeout = 12000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 }
    );
  });
}

// Alamat dari koordinat (OpenStreetMap Nominatim, gratis — cukup untuk demo)
export async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id&zoom=18`);
    if (!r.ok) throw new Error();
    const j = await r.json();
    const a = j.address || {};
    const city = a.city || a.town || a.regency || a.county || a.municipality || a.state_district || a.state || '';
    const street = [a.road, a.house_number].filter(Boolean).join(' ');
    const area = [a.village || a.suburb || a.neighbourhood, a.city_district || a.subdistrict].filter(Boolean).join(', ');
    const address = [street, area].filter(Boolean).join(', ') || (j.display_name || '').split(',').slice(0, 3).join(',');
    return { address, city };
  } catch {
    return { address: 'Alamat tidak tersedia', city: '' };
  }
}

// ---------- Kamera dengan watermark ----------
export function openCamera() {
  return new Promise((resolve) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Kamera tidak didukung di browser ini. Gunakan Pilih dari Album.', 'error');
      return resolve(null);
    }
    let facing = 'environment';
    let stream = null;
    let geo = null;
    let place = { address: 'Mencari alamat…', city: '' };

    const el = document.createElement('div');
    el.className = 'cam';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Kamera');
    el.innerHTML = `
      <video playsinline autoplay muted></video>
      <div class="cam-top">
        <button data-act="close" aria-label="Tutup kamera">${icon.x()}</button>
        <button data-act="flip" aria-label="Ganti kamera depan/belakang">${icon.flip()}</button>
      </div>
      <div class="cam-info">Mengambil lokasi…</div>
      <div class="cam-bar"><button class="shutter" data-act="shoot" aria-label="Ambil foto"></button></div>`;
    document.body.appendChild(el);
    const video = el.querySelector('video');
    const info = el.querySelector('.cam-info');

    const updateInfo = () => {
      const now = new Date();
      info.innerHTML = `${esc(fmtLong(now))}<br>${geo ? `Lat ${geo.lat.toFixed(6)} · Long ${geo.lng.toFixed(6)}` : 'Lokasi belum didapat'}<br>${esc(place.address)}${place.city ? '<br>' + esc(place.city) : ''}`;
    };
    const clock = setInterval(updateInfo, 1000);

    const start = async () => {
      stream?.getTracks().forEach((t) => t.stop());
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        video.srcObject = stream;
        video.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
      } catch (e) {
        toast('Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser.', 'error');
        finish(null);
      }
    };
    const finish = (blob) => {
      clearInterval(clock);
      stream?.getTracks().forEach((t) => t.stop());
      el.remove();
      resolve(blob);
    };

    getPosition().then(async (p) => {
      geo = p;
      if (p) place = await reverseGeocode(p.lat, p.lng);
      else place = { address: 'Lokasi tidak aktif', city: '' };
      updateInfo();
    });
    updateInfo();
    start();

    el.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'close') finish(null);
      if (act === 'flip') { facing = facing === 'environment' ? 'user' : 'environment'; start(); }
      if (act === 'shoot') {
        if (!video.videoWidth) return;
        const blob = await captureWithWatermark(video, facing === 'user', geo, place);
        finish(blob);
      }
    });
  });
}

function fmtLong(d) {
  const tgl = d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${tgl} · ${jam} ${tzLabel()}`;
}
function tzLabel() {
  const off = -new Date().getTimezoneOffset() / 60;
  return { 7: 'WIB', 8: 'WITA', 9: 'WIT' }[off] || `GMT${off >= 0 ? '+' : ''}${off}`;
}

async function captureWithWatermark(video, mirror, geo, place) {
  const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const now = new Date();
  const lines = [
    now.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
    now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' ' + tzLabel(),
    geo ? `Lat ${geo.lat.toFixed(6)}  Long ${geo.lng.toFixed(6)}` : 'Lokasi tidak tersedia',
    ...wrap(ctx, place.address || '', w * 0.86, Math.round(w / 38)),
    place.city || '',
    'MDXL Mobile',
  ].filter(Boolean);

  const fs = Math.max(14, Math.round(w / 38));
  ctx.font = `600 ${fs}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const lh = Math.round(fs * 1.35);
  const pad = Math.round(fs * 0.8);
  const boxH = lines.length * lh + pad * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, h - boxH, w, boxH);
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';
  lines.forEach((t, i) => {
    ctx.font = `${i === 1 ? 800 : 600} ${i === 1 ? Math.round(fs * 1.3) : fs}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.fillText(t, pad, h - boxH + pad + i * lh);
  });
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
}

function wrap(ctx, text, maxW, fs) {
  ctx.font = `600 ${fs}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const words = text.split(' ');
  const out = [];
  let line = '';
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (ctx.measureText(test).width > maxW && line) { out.push(line); line = wd; } else line = test;
  }
  if (line) out.push(line);
  return out.slice(0, 2);
}

// ---------- Album / file ----------
export function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.onchange = () => resolve(inp.files?.[0] || null);
    inp.click();
  });
}

// Foto dari album: diupload apa adanya (tanpa watermark), hanya diperkecil agar ringan
export async function pickImage(maxMB = 5) {
  const f = await pickFile('image/png,image/jpeg,image/jpg');
  if (!f) return null;
  if (!/image\/(png|jpe?g)/.test(f.type)) { toast('Format foto harus PNG/JPG/JPEG.', 'error'); return null; }
  const blob = await shrink(f);
  if (blob.size > maxMB * 1024 * 1024) { toast(`Ukuran foto maksimal ${maxMB} MB.`, 'error'); return null; }
  return blob;
}

async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  } catch {
    return file;
  }
}
