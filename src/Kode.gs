/**
 * ============================================================
 * DKPPKB Sulbar Intelligence — Backend (Kode.gs)
 * Arsitektur SPA: doGet() hanya mengembalikan shell. Semua halaman
 * diambil lewat getPageContent() dan disuntikkan ke #app-container.
 * Data disimpan di Google Sheets (dibuat otomatis oleh setupAplikasi()).
 * ============================================================
 */

const APP_NAME = 'DKPPKB Sulbar Intelligence';
const TZ = 'Asia/Makassar';
// ID spreadsheet bawaan (bagian di antara /d/ dan /edit pada URL spreadsheet). Dipakai bila properti SPREADSHEET_ID belum diset.
const ID_SPREADSHEET_DEFAULT = '1F9OsgSpkS0kdJ78rn4ZGIXC4YuqE87LwgY1wv8428AE';
const SESI_DETIK = 21600; // 6 jam (batas maksimum CacheService)

const SHEET = {
  CONFIG: 'Config', BIDANG: 'Bidang', INDIKATOR: 'Indikator', ISIAN: 'Isian',
  USERS: 'Users', MASALAH: 'Masalah', PERMINTAAN: 'PermintaanData', LOG: 'Log', PROGRAM: 'Program', TARGET: 'Target', BUKTI: 'Bukti', MONEV: 'Monev'
};

const HEADERS = {
  Config: ['Kunci', 'Nilai'],
  Bidang: ['Nama', 'Ikon', 'Urutan'],
  Indikator: ['ID', 'Nama', 'Bidang', 'Jenis', 'Frekuensi', 'Satuan', 'Target', 'Arah', 'PIC', 'Aktif', 'Program', 'Keterangan'],
  Isian: ['IndikatorID', 'Tahun', 'Bulan', 'Realisasi', 'Status', 'KabTertunda', 'Catatan', 'DiisiOleh', 'DiisiPada', 'Analisis', 'Rekomendasi'],
  Users: ['Username', 'Nama', 'Role', 'Bidang', 'Email', 'Telepon', 'Salt', 'Hash', 'Aktif', 'Program', 'Indikator'],
  Masalah: ['ID', 'Tanggal', 'IndikatorID', 'Bidang', 'Permasalahan', 'Rekomendasi', 'Prioritas', 'Status', 'Penanggung', 'Tenggat', 'DibuatOleh'],
  PermintaanData: ['ID', 'Tanggal', 'Pemohon', 'Instansi', 'Kebutuhan', 'Format', 'Tenggat', 'Status', 'Catatan'],
  Log: ['Waktu', 'Jenis', 'Aktor', 'Deskripsi'],
  Program: ['ID', 'Nama', 'Bidang', 'Sub', 'Aktif'],
  Target: ['IndikatorID', 'Tahun', 'Periode', 'Target', 'DiubahOleh', 'DiubahPada'],
  Bukti: ['ID', 'IndikatorID', 'Tahun', 'Bulan', 'NamaFile', 'Tipe', 'Ukuran', 'FileId', 'Catatan', 'DiunggahOleh', 'DiunggahPada'],
  Monev: ['ID', 'Jenis', 'Tahun', 'Induk', 'TW', 'Teks', 'Angka', 'Satuan', 'Bidang', 'PIC', 'DibuatOleh', 'DibuatPada']
};
const ENUM_PERIODE_TARGET = ['TW1', 'TW2', 'TW3', 'TW4', 'SM1', 'SM2', 'TH'];

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_S = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const ENUM_JENIS = ['Kesehatan', 'IKU', 'SPM'];
const ENUM_FREK = ['Bulanan', 'Triwulan', 'Semester', 'Tahunan'];
const ENUM_ROLE = ['admin', 'pimpinan', 'pic'];
const DEFAULT_PWD = { admin: 'admin123', pimpinan: 'pimpinan123', pic: 'pic123' };

/* ---------------- Entry point tunggal ---------------- */

/** Entry point TUNGGAL. Tidak ada routing berbasis ?page= atau token di URL. */
function doGet(e) {
  if (e && e.parameter && e.parameter.fn === 'merek') return jsonOut_(apiMerek());
  const t = HtmlService.createTemplateFromFile('Index');
  t.logoUrl = logoAman_();
  const mk = merekAman_();
  t.namaApp = mk.nama; t.subApp = mk.sub;
  return t
    .evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------------- API JSON (dipakai tampilan statis, mis. GitHub Pages) ----------------
 * Klien statis mengirim POST text/plain berisi {"fn":"nama","args":[...]} ke URL web app.
 * Hanya fungsi pada daftar putih di bawah yang boleh dipanggil; otorisasi tetap lewat token sesi. */
const API_JSON_ = ['apiMerek', 'doLogin', 'doLogout', 'getPageContent', 'apiBootstrap', 'apiAmbilIsian', 'apiSimpanIsian', 'apiVerifikasi', 'apiKirimPengingat',
  'apiSimpanMasalah', 'apiUbahStatusMasalah', 'apiSimpanPermintaan', 'apiUbahStatusPermintaan', 'apiSimpanConfig', 'apiSimpanIndikator', 'apiSimpanProgram',
  'apiSimpanTarget', 'apiSimpanUser', 'apiResetPassword', 'apiUbahStatusUser', 'apiUbahPassword', 'apiExportPdf', 'apiDaftarBukti', 'apiUnggahBukti',
  'apiUnduhBukti', 'apiHapusBukti', 'apiTarikData', 'apiSimpanMonev', 'apiHapusMonev', 'apiUnggahBuktiMonev', 'apiUnduhBuktiMonev', 'apiHapusBuktiMonev'];

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj === undefined ? null : obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let hasil;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const nama = String(body.fn || '');
    if (API_JSON_.indexOf(nama) < 0 || typeof globalThis[nama] !== 'function') hasil = { success: false, expired: false, message: 'Fungsi tidak dikenal.' };
    else hasil = globalThis[nama].apply(null, (Array.isArray(body.args) ? body.args : []).slice(0, 8));
  } catch (err) {
    hasil = { success: false, expired: false, message: 'Permintaan tidak valid.' };
  }
  return jsonOut_(hasil);
}

/** Nama, subjudul, dan logo aplikasi untuk halaman login (tanpa sesi). */
function apiMerek() {
  return run_(() => { const m = merekAman_(); return { nama: m.nama, sub: m.sub, logo: logoAman_(), versi: 'monev-1', monev: !!PAGES_.monev }; });
}

/** URL logo resmi (opsional) dari Config. Hanya https. Gagal membaca = pakai logo bawaan. */
function logoAman_() {
  try {
    const r = readTable_(SHEET.CONFIG).find(x => x.Kunci === 'LogoUrl');
    return logoValid_(r ? String(r.Nilai || '').trim() : '') ? String(r.Nilai).trim() : '';
  } catch (e) { return ''; }
}
/** Logo sah: tautan https langsung, atau gambar kecil (data URI) hasil unggah dari Pengaturan. */
function logoValid_(u) {
  if (!u) return false;
  if (/^https:\/\/[^\s"'<>]+$/.test(u)) return u.length <= 600;
  return u.length <= 48000 && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(u);
}
/** Nama dan subjudul aplikasi dari Config (dipakai juga sebelum login). */
function merekAman_() {
  const d = { nama: 'DKPPKB Sulbar', sub: 'Intelligence' };
  try {
    const c = {};
    readTable_(SHEET.CONFIG).forEach(r => { c[r.Kunci] = String(r.Nilai || ''); });
    return { nama: (c.NamaApp || '').trim() || d.nama, sub: c.SubApp === undefined || c.SubApp === null || c.SubApp === '' ? d.sub : c.SubApp.trim() };
  } catch (e) { return d; }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ---------------- Util spreadsheet ---------------- */

var SS_MEMO_ = null;
function getSS_() {
  if (SS_MEMO_) return SS_MEMO_;
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || ID_SPREADSHEET_DEFAULT;
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet belum terhubung. Di editor Apps Script, jalankan fungsi setupAplikasi() sekali (atau setSpreadsheetId("ID_SPREADSHEET")), lalu deploy versi baru.');
  SS_MEMO_ = ss;
  return ss;
}

function fmtTanggal_(d) {
  const adaJam = d.getHours() !== 0 || d.getMinutes() !== 0;
  return Utilities.formatDate(d, TZ, adaJam ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
}

/* Cache baca-sheet: memo per eksekusi + CacheService lintas permintaan (dibatalkan tiap kali ada penulisan). */
var MEMO_ = {};
var CACHE_TTL_ = 900;
var CACHE_CHUNK_ = 40000;
function tanpaCache_(name) { return name === 'Log'; }
function bust_(name) {
  delete MEMO_[name];
  try {
    const c = CacheService.getScriptCache();
    const meta = c.get('tbl:' + name);
    const keys = ['tbl:' + name];
    if (meta) for (let i = 0; i < Number(meta); i++) keys.push('tbl:' + name + ':' + i);
    if (typeof c.removeAll === 'function') c.removeAll(keys); else keys.forEach(x => c.remove(x));
  } catch (e) { /* cache tidak boleh menggagalkan proses */ }
}
function cacheBaca_(name) {
  try {
    const c = CacheService.getScriptCache();
    const meta = c.get('tbl:' + name);
    if (!meta) return null;
    const n = Number(meta), keys = [];
    for (let i = 0; i < n; i++) keys.push('tbl:' + name + ':' + i);
    let got;
    if (typeof c.getAll === 'function') got = c.getAll(keys);
    else { got = {}; keys.forEach(x => { const v = c.get(x); if (v !== null) got[x] = v; }); }
    let s = '';
    for (let i = 0; i < n; i++) { const v = got[keys[i]]; if (v === undefined || v === null) return null; s += v; }
    return JSON.parse(s);
  } catch (e) { return null; }
}
function cacheTulis_(name, rows) {
  try {
    const s = JSON.stringify(rows);
    if (s.length > CACHE_CHUNK_ * 20) return;
    const c = CacheService.getScriptCache();
    const n = Math.max(1, Math.ceil(s.length / CACHE_CHUNK_)), put = {};
    for (let i = 0; i < n; i++) put['tbl:' + name + ':' + i] = s.slice(i * CACHE_CHUNK_, (i + 1) * CACHE_CHUNK_);
    put['tbl:' + name] = String(n);
    if (typeof c.putAll === 'function') c.putAll(put, CACHE_TTL_); else Object.keys(put).forEach(x => c.put(x, put[x], CACHE_TTL_));
  } catch (e) { /* abaikan */ }
}
function bacaSheet_(name) {
  const sh = getSS_().getSheetByName(name);
  if (!sh) return [];
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const h = v[0];
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const o = { _row: i + 1 };
    let kosong = true;
    for (let j = 0; j < h.length; j++) {
      let x = v[i][j];
      if (x instanceof Date) x = fmtTanggal_(x);
      if (x !== '' && x !== null) kosong = false;
      o[h[j]] = x;
    }
    if (!kosong) out.push(o);
  }
  return out;
}

/** Membaca sheet menjadi array objek. Date diubah ke string agar aman dikirim ke client. */
function readTable_(name) {
  if (MEMO_[name]) return MEMO_[name].slice();
  let rows = tanpaCache_(name) ? null : cacheBaca_(name);
  if (!rows) {
    rows = bacaSheet_(name);
    if (!tanpaCache_(name)) cacheTulis_(name, rows);
  }
  if (!tanpaCache_(name)) MEMO_[name] = rows;
  return rows.slice();
}

var SKEMA_OK_ = {};
/** Ambil sheet untuk ditulis. Membuat sheet bila belum ada dan menambah kolom baru di kanan bila skema bertambah (data lama aman). */
function sheetTulis_(name) {
  bust_(name);
  const ss = getSS_();
  let sh = ss.getSheetByName(name);
  const H = HEADERS[name];
  if (!sh) sh = ss.insertSheet(name);
  if (SKEMA_OK_[name]) return sh;
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, H.length).setValues([H]).setFontWeight('bold').setBackground('#e0f2fe');
    sh.setFrozenRows(1);
  } else {
    const cur = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    let n = cur.length;
    while (n > 0 && String(cur[n - 1]).trim() === '') n--;
    if (n < H.length) {
      if (sh.getMaxColumns() < H.length) sh.insertColumnsAfter(sh.getMaxColumns(), H.length - sh.getMaxColumns());
      sh.getRange(1, n + 1, 1, H.length - n).setValues([H.slice(n)]).setFontWeight('bold').setBackground('#e0f2fe');
    }
  }
  SKEMA_OK_[name] = true;
  return sh;
}

function appendRows_(name, rows) {
  if (!rows.length) return;
  const sh = sheetTulis_(name);
  const n = HEADERS[name].length;
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, n).setValues(rows.map(r => { const c = r.slice(0, n); while (c.length < n) c.push(''); return c; }));
  bust_(name);
}

function appendObj_(name, obj) {
  const sh = sheetTulis_(name);
  sh.appendRow(HEADERS[name].map(k => (obj[k] === undefined ? '' : obj[k])));
  bust_(name);
}

/** Update baris yang cocok, atau tambah baru. Dilindungi lock. */
function upsertRow_(name, matchFn, obj) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheetTulis_(name);
    const h = HEADERS[name];
    const vals = sh.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      const o = {};
      h.forEach((k, j) => { o[k] = vals[i][j]; });
      if (matchFn(o)) {
        sh.getRange(i + 1, 1, 1, h.length).setValues([h.map(k => (obj[k] !== undefined ? obj[k] : o[k]))]);
        return 'update';
      }
    }
    sh.appendRow(h.map(k => (obj[k] === undefined ? '' : obj[k])));
    return 'insert';
  } finally {
    bust_(name);
    lock.releaseLock();
  }
}

function catatLog_(jenis, aktor, deskripsi) {
  try {
    appendObj_(SHEET.LOG, { Waktu: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'), Jenis: jenis, Aktor: aktor, Deskripsi: deskripsi });
  } catch (e) { /* log tidak boleh menggagalkan proses utama */ }
}

function nowStr_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function bersih_(s, max) { return String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 500); }

/* ---------------- Konfigurasi ---------------- */

function getConfig_() {
  const c = {};
  readTable_(SHEET.CONFIG).forEach(r => { c[r.Kunci] = String(r.Nilai); });
  const n = new Date();
  return {
    Tahun: Number(c.Tahun) || Number(Utilities.formatDate(n, TZ, 'yyyy')),
    BulanAktif: Number(c.BulanAktif) || Number(Utilities.formatDate(n, TZ, 'M')),
    Cutoff: (c.Cutoff || '').slice(0, 10),
    NamaDinas: c.NamaDinas || 'Dinas Kesehatan, Pengendalian Penduduk dan Keluarga Berencana Provinsi Sulawesi Barat',
    Kabupaten: (c.Kabupaten || 'Majene,Mamasa,Mamuju,Mamuju Tengah,Pasangkayu,Polewali Mandar').split(',').map(s => s.trim()).filter(Boolean),
    LogoUrl: logoValid_(c.LogoUrl || '') ? c.LogoUrl : '',
    NamaApp: (c.NamaApp || '').trim() || 'DKPPKB Sulbar',
    SubApp: c.SubApp === undefined || c.SubApp === '' ? 'Intelligence' : String(c.SubApp).trim(),
    NamaAppSet: !!(c.NamaApp || '').trim(),
    BatasIsi: Math.min(28, Math.max(0, Number(c.BatasIsi) || 0)),
    PengingatAuto: c.PengingatAuto === 'Ya',
    PengingatHari: Math.min(14, Math.max(1, Number(c.PengingatHari) || 3))
  };
}

/* ---------------- Autentikasi & sesi ---------------- */

function hash_(salt, pwd) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pwd, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(d);
}

function buatSesi_(u) {
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('s_' + token, JSON.stringify({ u: u.Username, n: u.Nama, r: u.Role, b: u.Bidang, p: String(u.Program || ''), t: Date.now() }), SESI_DETIK);
  return token;
}

/** Validasi token. Melempar 'SESI_HABIS' bila tidak valid. */
function auth_(token, roles) {
  if (!token) throw new Error('SESI_HABIS');
  const raw = CacheService.getScriptCache().get('s_' + token);
  if (!raw) throw new Error('SESI_HABIS');
  const s = JSON.parse(raw);
  const cabut = Number(CacheService.getScriptCache().get('rev_' + s.u) || 0);
  if (cabut && cabut >= Number(s.t || 0)) { CacheService.getScriptCache().remove('s_' + token); throw new Error('SESI_HABIS'); }
  if (roles && roles.indexOf(s.r) < 0) throw new Error('Akses ditolak untuk peran Anda.');
  CacheService.getScriptCache().put('s_' + token, raw, SESI_DETIK);
  return { username: s.u, nama: s.n, role: s.r, bidang: s.b, program: s.p || '' };
}

function run_(fn) {
  try {
    const data = fn();
    return { success: true, data: data === undefined ? null : data };
  } catch (e) {
    const m = String((e && e.message) || e);
    return { success: false, message: m === 'SESI_HABIS' ? 'Sesi berakhir. Silakan masuk kembali.' : m, expired: m === 'SESI_HABIS' };
  }
}

function doLogin(username, password) {
  return run_(() => {
    username = bersih_(username, 60).toLowerCase();
    password = String(password || '');
    if (!username || !password) throw new Error('Isi nama pengguna dan kata sandi.');
    const cache = CacheService.getScriptCache();
    const kunci = 'gagal_' + username;
    if (Number(cache.get(kunci) || 0) >= 5) throw new Error('Terlalu banyak percobaan gagal. Coba lagi dalam 10 menit.');
    const u = readTable_(SHEET.USERS).find(x => String(x.Username).toLowerCase() === username);
    if (!u || String(u.Aktif).toLowerCase() === 'tidak' || hash_(String(u.Salt), password) !== String(u.Hash)) {
      cache.put(kunci, String(Number(cache.get(kunci) || 0) + 1), 600);
      catatLog_('login-gagal', username, 'Percobaan masuk gagal');
      throw new Error('Nama pengguna atau kata sandi salah.');
    }
    cache.remove(kunci);
    const token = buatSesi_(u);
    catatLog_('login', u.Username, 'Berhasil masuk');
    return { token: token };
  });
}

function doLogout(token) {
  return run_(() => { if (token) CacheService.getScriptCache().remove('s_' + token); return true; });
}

/** Data awal setelah login: pengguna, konfigurasi, menu, badge. */
function apiBootstrap(token) {
  return run_(() => {
    const user = auth_(token);
    const cfg = getConfig_();
    const u = readTable_(SHEET.USERS).find(x => x.Username === user.username) || {};
    const m = hitungModel_(cfg.Tahun, cfg.BulanAktif, { user: user });
    const tahunSet = {}; tahunSet[cfg.Tahun] = 1;
    readTable_(SHEET.ISIAN).forEach(r => { if (r.Tahun) tahunSet[Number(r.Tahun)] = 1; });
    const pwdDefault = !!(u.Salt && hash_(String(u.Salt), DEFAULT_PWD[user.role] || '') === String(u.Hash));
    return {
      user: { username: user.username, nama: user.nama, role: user.role, bidang: user.bidang, program: user.program },
      cfg: { tahun: cfg.Tahun, bulan: cfg.BulanAktif, namaDinas: cfg.NamaDinas, kabupaten: cfg.Kabupaten, logo: cfg.LogoUrl, namaApp: cfg.NamaApp, subApp: cfg.SubApp },
      tahunList: Object.keys(tahunSet).map(Number).sort((a, b) => b - a),
      bulanList: BULAN,
      badge: m.kpi.menunggak,
      passwordDefault: pwdDefault
    };
  });
}

/* ---------------- Perhitungan model ---------------- */

function dueMonths_(frek) {
  switch (frek) {
    case 'Triwulan': return [3, 6, 9, 12];
    case 'Semester': return [6, 12];
    case 'Tahunan': return [12];
    default: return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
}

function tierDari_(cap) {
  if (cap === null) return 'belum';
  if (cap >= 100) return 'tercapai';
  if (cap >= 80) return 'waspada';
  return 'kritis';
}

/** Batasi daftar indikator: PIC hanya melihat indikatornya sendiri; laporan boleh dipilih per bidang atau indikator. */
function saringInd_(list, s) {
  if (!s) return list;
  const bd = (s.bidang || []).map(String), ik = (s.indikator || []).map(String);
  return list.filter(i => {
    if (s.user && s.user.role === 'pic' && !bisaIsi_(s.user, i)) return false;
    if (bd.length && bd.indexOf(i.bidang) < 0) return false;
    if (ik.length && ik.indexOf(i.id) < 0) return false;
    return true;
  });
}

/** saring (opsional): { user, bidang: [], indikator: [] } */
function hitungModel_(tahun, bulan, saring) {
  const cfg = getConfig_();
  tahun = Number(tahun) || cfg.Tahun;
  bulan = Math.min(12, Math.max(1, Number(bulan) || cfg.BulanAktif));
  const users = {};
  const picProgram = {};
  const ikUser = {}, ikPic = {};
  readTable_(SHEET.USERS).forEach(u => {
    users[u.Username] = u;
    const aktifU = String(u.Aktif).toLowerCase() !== 'tidak';
    if (u.Role === 'pic' && u.Program && aktifU && !picProgram[u.Program]) picProgram[u.Program] = u;
    if (u.Role === 'pic' && aktifU) {
      const ids = parseIk_(u.Indikator);
      if (ids.length) { ikUser[u.Username] = ids; ids.forEach(id => { (ikPic[id] = ikPic[id] || []).push(String(u.Username)); }); }
    }
  });
  MODEL_IK_ = ikUser;
  const programRows = readTable_(SHEET.PROGRAM);
  const programNama = {};
  programRows.forEach(r => { programNama[String(r.ID)] = r; });
  const tgtMap = {};
  readTable_(SHEET.TARGET).forEach(r => {
    if (Number(r.Tahun) !== tahun || r.Target === '' || isNaN(Number(r.Target))) return;
    (tgtMap[String(r.IndikatorID)] = tgtMap[String(r.IndikatorID)] || {})[String(r.Periode)] = Number(r.Target);
  });
  const isian = {};
  readTable_(SHEET.ISIAN).forEach(r => {
    if (Number(r.Tahun) !== tahun) return;
    (isian[r.IndikatorID] = isian[r.IndikatorID] || {})[Number(r.Bulan)] = r;
  });
  const now = new Date();

  const buktiN = {};
  readTable_(SHEET.BUKTI).forEach(r => { const k = String(r.IndikatorID); buktiN[k] = (buktiN[k] || 0) + 1; });
  let ind = readTable_(SHEET.INDIKATOR)
    .filter(i => i.ID && String(i.Aktif).toLowerCase() !== 'tidak')
    .map(i => {
      const due = dueMonths_(i.Frekuensi);
      const rows = isian[i.ID] || {};
      const target = Number(i.Target) || 0;
      const arah = i.Arah === 'Turun' ? 'Turun' : 'Naik';
      const cells = [], series = [], missing = [];
      let wait = false, last = null;
      for (let b = 1; b <= 12; b++) {
        const r = rows[b];
        const isDue = due.indexOf(b) >= 0;
        const val = (r && r.Realisasi !== '' && r.Realisasi !== null && !isNaN(Number(r.Realisasi))) ? Number(r.Realisasi) : null;
        series.push(isDue ? val : null);
        let c;
        if (!isDue) c = 'na';
        else if (r && r.Status === 'Lengkap' && val !== null) c = 'ok';
        else if (r && r.Status === 'Menunggu Verifikasi' && val !== null) c = 'wait';
        else c = b <= bulan ? 'miss' : 'future';
        cells.push(c);
        if (isDue && b <= bulan) {
          if (c === 'miss') missing.push(b);
          if (c === 'wait') wait = true;
          if (c === 'ok' || c === 'wait') last = { b: b, v: val, r: r };
        }
      }
      const dueNow = due.filter(b => b <= bulan);
      let status = 'na';
      if (dueNow.length) status = missing.length ? 'menunggak' : (wait ? 'menunggu' : 'lengkap');
      const realisasi = last ? last.v : null;
      let capaian = null;
      if (realisasi !== null && target > 0) {
        capaian = arah === 'Naik' ? (realisasi / target) * 100 : (realisasi <= 0 ? 200 : (target / realisasi) * 100);
        capaian = Math.round(Math.min(capaian, 200) * 10) / 10;
      }
      const lastDue = dueNow.length ? dueNow[dueNow.length - 1] : null;
      const rowLastDue = lastDue ? rows[lastDue] : null;
      const kab = (rowLastDue && rowLastDue.KabTertunda) ? String(rowLastDue.KabTertunda).split(',').map(s => s.trim()).filter(Boolean) : [];
      let terlambat = 0;
      if (missing.length) {
        const akhir = new Date(tahun, missing[0], 0, 23, 59, 59);
        terlambat = Math.max(0, Math.floor((now - akhir) / 86400000));
      }
      const prog = programNama[String(i.Program || '')] || null;
      const ditugaskan = ikPic[String(i.ID)] || [];
      const pic = users[i.PIC] || (ditugaskan.length ? users[ditugaskan[0]] : null) || (prog ? picProgram[String(i.Program)] : null) || {};
      const upd = last && last.r ? last.r : (rowLastDue || null);
      return {
        id: String(i.ID), nama: String(i.Nama), bidang: String(i.Bidang), jenis: String(i.Jenis || 'Kesehatan'),
        frek: String(i.Frekuensi || 'Bulanan'), satuan: String(i.Satuan || ''), ket: ketDari_(i), target: target, arah: arah,
        pic: String(i.PIC || pic.Username || ''), pics: ditugaskan, program: String(i.Program || ''), programNama: prog ? String(prog.Nama) : '', sub: prog ? String(prog.Sub || '') : '', tgtP: tgtMap[String(i.ID)] || {}, nBukti: buktiN[String(i.ID)] || 0, picNama: pic.Nama ? String(pic.Nama) : '', picTelp: pic.Telepon ? String(pic.Telepon) : '', picEmail: pic.Email ? String(pic.Email) : '',
        due: due, cells: cells, series: series, missing: missing, status: status,
        realisasi: realisasi, realBulan: last ? last.b : null, capaian: capaian, tier: tierDari_(capaian),
        kab: kab, terlambat: terlambat,
        updOleh: upd ? String(upd.DiisiOleh || '') : '', updPada: upd ? String(upd.DiisiPada || '') : ''
      };
    });

  ind = saringInd_(ind, saring);
  const terbatas = !!(saring && ((saring.user && saring.user.role === 'pic') || (saring.bidang && saring.bidang.length) || (saring.indikator && saring.indikator.length)));

  const bidangRows = readTable_(SHEET.BIDANG).sort((a, b) => Number(a.Urutan) - Number(b.Urutan));
  const bidang = bidangRows.map(b => {
    const li = ind.filter(x => x.bidang === b.Nama);
    const wajib = li.filter(x => x.status !== 'na');
    const lengkap = wajib.filter(x => x.status === 'lengkap').length;
    const menunggu = wajib.filter(x => x.status === 'menunggu').length;
    const menunggak = wajib.filter(x => x.status === 'menunggak').length;
    const caps = li.filter(x => x.capaian !== null).map(x => Math.min(x.capaian, 100));
    return {
      nama: String(b.Nama), ikon: String(b.Ikon || 'domain'), total: li.length, wajib: wajib.length,
      lengkap: lengkap, menunggu: menunggu, menunggak: menunggak,
      pctInput: wajib.length ? Math.round(((lengkap + menunggu) / wajib.length) * 1000) / 10 : 100,
      capaian: caps.length ? Math.round((caps.reduce((a, c) => a + c, 0) / caps.length) * 10) / 10 : null
    };
  }).filter(b => !terbatas || b.total > 0);

  const wajibAll = ind.filter(x => x.status !== 'na');
  const kpi = {
    total: ind.length, wajib: wajibAll.length,
    lengkap: wajibAll.filter(x => x.status === 'lengkap').length,
    menunggu: wajibAll.filter(x => x.status === 'menunggu').length,
    menunggak: wajibAll.filter(x => x.status === 'menunggak').length,
    tercapai: ind.filter(x => x.tier === 'tercapai').length,
    waspada: ind.filter(x => x.tier === 'waspada').length,
    kritis: ind.filter(x => x.tier === 'kritis').length,
    belum: ind.filter(x => x.tier === 'belum').length
  };
  kpi.pctInput = kpi.wajib ? Math.round(((kpi.lengkap + kpi.menunggu) / kpi.wajib) * 1000) / 10 : 100;
  const capsAll = ind.filter(x => x.capaian !== null).map(x => Math.min(x.capaian, 100));
  kpi.rataCapaian = capsAll.length ? Math.round((capsAll.reduce((a, c) => a + c, 0) / capsAll.length) * 10) / 10 : null;

  const kab = cfg.Kabupaten.map(k => {
    const tertunda = wajibAll.filter(x => x.kab.some(n => n.toLowerCase() === k.toLowerCase())).length;
    const pct = wajibAll.length ? Math.round((1 - tertunda / wajibAll.length) * 1000) / 10 : 100;
    return { nama: k, tertunda: tertunda, pct: pct };
  });

  let cutoffHari = null;
  if (cfg.Cutoff) {
    const t = new Date(cfg.Cutoff + 'T23:59:59+08:00');
    if (!isNaN(t.getTime())) cutoffHari = Math.ceil((t - now) / 86400000);
  }

  const picMap = {};
  bidangRows.forEach(b => {
    const p = Object.keys(users).map(k => users[k]).find(u => u.Role === 'pic' && u.Bidang === b.Nama);
    if (p) picMap[b.Nama] = { nama: String(p.Nama), telp: String(p.Telepon || ''), email: String(p.Email || '') };
  });

  return {
    cfg: cfg, tahun: tahun, bulan: bulan,
    periodeLabel: BULAN[bulan - 1] + ' ' + tahun,
    triwulan: 'Triwulan ' + ['I', 'II', 'III', 'IV'][Math.ceil(bulan / 3) - 1],
    ind: ind, bidang: bidang, kpi: kpi, kab: kab, cutoffHari: cutoffHari, pic: picMap,
    program: programRows.filter(r => r.ID).map(r => ({
      id: String(r.ID), nama: String(r.Nama), bidang: String(r.Bidang), sub: String(r.Sub || ''), aktif: String(r.Aktif).toLowerCase() !== 'tidak',
      nInd: ind.filter(x => x.program === String(r.ID)).length,
      pics: Object.keys(users).map(k => users[k]).filter(u => u.Role === 'pic' && String(u.Program) === String(r.ID)).map(u => ({ username: String(u.Username), nama: String(u.Nama), aktif: String(u.Aktif).toLowerCase() !== 'tidak', nIk: parseIk_(u.Indikator).length, telepon: String(u.Telepon || ''), email: String(u.Email || '') }))
    })).filter(x => !terbatas || x.nInd > 0)
  };
}

/* ---------------- Aksi: isian & verifikasi ---------------- */

var MODEL_IK_ = {};
/** Daftar ID indikator dari sel "IK-001, IK-002" (unik, urutan dijaga). */
function parseIk_(v) {
  const seen = {}, out = [];
  String(v || '').split(/[,;\s]+/).forEach(x => { x = x.trim(); if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
  return out;
}

/** Admin boleh semua. PIC Program hanya indikator program/PIC-nya. PIC Bidang untuk seluruh indikator bidangnya. */
function bolehIsi_(user, ind) {
  if (user.role === 'admin') return true;
  if (user.role !== 'pic') return false;
  if (String(ind.PIC) === String(user.username)) return true;
  const me = readTable_(SHEET.USERS).find(u => String(u.Username) === String(user.username));
  const ik = parseIk_(me && me.Indikator);
  if (ik.length) return ik.indexOf(String(ind.ID)) >= 0;   // PIC dengan daftar indikator: hanya yang ditugaskan
  if (user.program) return String(ind.Program || '') === String(user.program);
  return String(ind.Bidang) === String(user.bidang);
}

/* ---------------- Isian provinsi: keterangan nilai (angka / persen / jumlah) ---------------- */

const KETERANGAN = ['angka', 'persen', 'jumlah'];
function ketDari_(i) {
  const k = String(i.Keterangan || '').toLowerCase();
  if (KETERANGAN.indexOf(k) >= 0) return k;
  return /%/.test(String(i.Satuan || '')) ? 'persen' : 'angka';
}

function apiAmbilIsian(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin', 'pic']);
    p = p || {};
    const cfg = getConfig_();
    const tahun = Number(p.tahun) || cfg.Tahun, bulan = Number(p.bulan);
    const ind = readTable_(SHEET.INDIKATOR).find(i => String(i.ID) === String(p.indikatorId));
    if (!ind) throw new Error('Indikator tidak ditemukan.');
    if (!bolehIsi_(user, ind)) throw new Error('Anda bukan penanggung jawab indikator ini.');
    const baris = readTable_(SHEET.ISIAN).find(o => String(o.IndikatorID) === String(ind.ID) && Number(o.Tahun) === tahun && Number(o.Bulan) === bulan) || {};
    return {
      keterangan: ketDari_(ind), satuan: String(ind.Satuan || ''),
      realisasi: baris.Realisasi === undefined || baris.Realisasi === '' ? null : Number(baris.Realisasi),
      analisis: String(baris.Analisis || ''), rekomendasi: String(baris.Rekomendasi || ''), catatan: String(baris.Catatan || '')
    };
  });
}

function apiSimpanIsian(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin', 'pic']);
    p = p || {};
    const cfg = getConfig_();
    const tahun = Number(p.tahun) || cfg.Tahun, bulan = Number(p.bulan);
    const ind = readTable_(SHEET.INDIKATOR).find(i => String(i.ID) === String(p.indikatorId));
    if (!ind) throw new Error('Indikator tidak ditemukan.');
    if (!bolehIsi_(user, ind)) throw new Error('Anda bukan penanggung jawab indikator ini.');
    if (!(bulan >= 1 && bulan <= 12) || dueMonths_(ind.Frekuensi).indexOf(bulan) < 0) throw new Error('Bulan tidak sesuai frekuensi pelaporan indikator.');
    const ket = KETERANGAN.indexOf(String(p.keterangan)) >= 0 ? String(p.keterangan) : ketDari_(ind);
    const real = Number(p.realisasi);
    if (p.realisasi === '' || p.realisasi === null || p.realisasi === undefined || !isFinite(real) || real < 0) throw new Error('Realisasi harus berupa angka nol atau lebih.');
    if (ket === 'persen' && real > 1000) throw new Error('Nilai persen terlalu besar. Periksa kembali isian Anda.');
    const kabValid = cfg.Kabupaten.map(x => x.toLowerCase());
    const kab = (Array.isArray(p.kabTertunda) ? p.kabTertunda : []).map(x => bersih_(x, 40)).filter(x => kabValid.indexOf(x.toLowerCase()) >= 0);
    const status = kab.length ? 'Belum' : (user.role === 'admin' ? 'Lengkap' : 'Menunggu Verifikasi');
    upsertRow_(SHEET.ISIAN, o => String(o.IndikatorID) === String(ind.ID) && Number(o.Tahun) === tahun && Number(o.Bulan) === bulan, {
      IndikatorID: ind.ID, Tahun: tahun, Bulan: bulan, Realisasi: real, Status: status,
      KabTertunda: kab.join(', '), Catatan: bersih_(p.catatan, 300), DiisiOleh: user.nama, DiisiPada: nowStr_(),
      Analisis: bersih_(p.analisis, 800), Rekomendasi: bersih_(p.rekomendasi, 800)
    });
    if (String(ind.Keterangan || '') !== ket) upsertRow_(SHEET.INDIKATOR, o => String(o.ID) === String(ind.ID), { Keterangan: ket });
    catatLog_('isian', user.username, 'Isian ' + ind.ID + ' ' + BULAN_S[bulan - 1] + ' ' + tahun + ' = ' + real + ' (' + status + ')');
    return { status: status };
  });
}

function apiVerifikasi(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin']);
    const tahun = Number(p.tahun), bulan = Number(p.bulan);
    const setuju = !!p.setuju;
    const hasil = upsertRow_(SHEET.ISIAN, o => String(o.IndikatorID) === String(p.indikatorId) && Number(o.Tahun) === tahun && Number(o.Bulan) === bulan, {
      Status: setuju ? 'Lengkap' : 'Belum', Catatan: setuju ? '' : bersih_(p.catatan || 'Dikembalikan untuk perbaikan', 300),
      DiisiPada: nowStr_()
    });
    if (hasil === 'insert') throw new Error('Data isian belum ada.');
    catatLog_('verifikasi', user.username, (setuju ? 'Menyetujui ' : 'Menolak ') + p.indikatorId + ' bulan ' + bulan);
    return true;
  });
}

function apiKirimPengingat(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin', 'pimpinan']);
    p = p || {};
    const m = hitungModel_(null, null);
    const ids = (Array.isArray(p.ids) ? p.ids : []).map(String);
    const target = m.ind.filter(i => ids.indexOf(i.id) >= 0 && i.status === 'menunggak');
    if (!target.length) throw new Error('Tidak ada indikator tertunggak yang dipilih.');
    const pesan = bersih_(p.pesan, 1000) || 'Mohon segera melengkapi isian indikator.';
    const perPic = {};
    target.forEach(i => {
      const k = i.pic || '(tanpa PIC)';
      (perPic[k] = perPic[k] || { nama: i.picNama || k, email: i.picEmail, telp: i.picTelp, daftar: [] }).daftar.push(i.id + ' — ' + i.nama);
    });
    let terkirim = 0;
    const tanpaEmail = [];
    const wa = [];
    const sisa = MailApp.getRemainingDailyQuota();
    Object.keys(perPic).forEach(k => {
      const x = perPic[k];
      const teks = pesan + '\n\nIndikator yang masih menunggak:\n- ' + x.daftar.join('\n- ');
      wa.push({ nama: x.nama, telp: x.telp, teks: teks });
      if (p.email && x.email && terkirim < sisa) {
        try {
          MailApp.sendEmail({ to: x.email, subject: (p.prioritas ? '[PRIORITAS] ' : '') + 'Pengingat pengisian data indikator — ' + m.periodeLabel, body: teks + '\n\nPesan otomatis dari ' + APP_NAME + '.' });
          terkirim++;
        } catch (e) { tanpaEmail.push(x.nama); }
      } else if (p.email) { tanpaEmail.push(x.nama); }
    });
    catatLog_('pengingat', user.username, 'Pengingat untuk ' + target.length + ' indikator ke ' + Object.keys(perPic).length + ' PIC (email terkirim: ' + terkirim + ')');
    return { indikator: target.length, pic: Object.keys(perPic).length, email: terkirim, tanpaEmail: tanpaEmail, wa: wa };
  });
}

/* ---------------- Batas pengisian & pengingat otomatis ---------------- */

/** Status batas pengisian relatif terhadap hari ini (null bila batas tidak diatur). */
function statusBatas_(cfg, tgl) {
  if (!cfg.BatasIsi) return null;
  const hari = Number(Utilities.formatDate(tgl || new Date(), TZ, 'd'));
  const sisa = cfg.BatasIsi - hari;
  return { batas: cfg.BatasIsi, sisa: sisa, terlambat: sisa < 0, hariIni: hari };
}

/** Pasang atau lepas pemicu harian (sekitar pukul 07.00 WITA). */
function aturPemicu_(aktif) {
  const ada = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'pengingatHarian');
  if (aktif && !ada.length) ScriptApp.newTrigger('pengingatHarian').timeBased().everyDays(1).atHour(7).inTimezone(TZ).create();
  if (!aktif) ada.forEach(t => ScriptApp.deleteTrigger(t));
}

/** Dijalankan pemicu harian: ingatkan PIC yang masih menunggak mendekati/lewat batas pengisian. */
function pengingatHarian() {
  const cfg = getConfig_();
  if (!cfg.PengingatAuto) return { dilewati: 'nonaktif' };
  const sb = statusBatas_(cfg);
  if (!sb || sb.sisa > cfg.PengingatHari || sb.sisa < -10) return { dilewati: 'di luar jendela' };
  const m = hitungModel_(null, null);
  const target = m.ind.filter(i => i.status === 'menunggak');
  if (!target.length) return { terkirim: 0, indikator: 0 };
  const perPic = {};
  target.forEach(i => {
    const kunci = i.pic || '(tanpa PIC)';
    (perPic[kunci] = perPic[kunci] || { nama: i.picNama || kunci, email: i.picEmail, daftar: [] }).daftar.push(i.id + ' - ' + i.nama);
  });
  const ket = sb.terlambat ? 'sudah lewat ' + (-sb.sisa) + ' hari dari batas tanggal ' + sb.batas : sb.sisa === 0 ? 'hari ini adalah batas pengisian (tanggal ' + sb.batas + ')' : 'batas pengisian tanggal ' + sb.batas + ' (' + sb.sisa + ' hari lagi)';
  let terkirim = 0;
  const tanpa = [];
  const kuota = MailApp.getRemainingDailyQuota();
  Object.keys(perPic).forEach(kunci => {
    const x = perPic[kunci];
    if (x.email && terkirim < kuota) {
      try {
        MailApp.sendEmail({ to: x.email, subject: (sb.terlambat ? '[TERLAMBAT] ' : '') + 'Pengingat pengisian indikator - ' + m.periodeLabel,
          body: 'Yth. ' + x.nama + ',\n\nPeriode ' + m.periodeLabel + ': ' + ket + '.\nIndikator yang belum diisi:\n- ' + x.daftar.join('\n- ') + '\n\nMohon segera melengkapi melalui menu Input Data.\n\nPesan otomatis dari ' + getConfig_().NamaApp + '.' });
        terkirim++;
      } catch (e) { tanpa.push(x.nama); }
    } else tanpa.push(x.nama);
  });
  // ringkasan untuk admin dan pimpinan
  const pengelola = readTable_(SHEET.USERS).filter(u => (u.Role === 'admin' || u.Role === 'pimpinan') && String(u.Aktif) !== 'Tidak' && u.Email);
  const ringkas = 'Periode ' + m.periodeLabel + ': ' + ket + '.\n' + target.length + ' indikator belum lengkap, ' + Object.keys(perPic).length + ' PIC.\n\n' +
    Object.keys(perPic).map(kunci => perPic[kunci].nama + ': ' + perPic[kunci].daftar.length + ' indikator').join('\n') +
    (tanpa.length ? '\n\nTanpa email / gagal kirim: ' + tanpa.join(', ') : '');
  pengelola.forEach(u => { try { MailApp.sendEmail({ to: String(u.Email), subject: 'Ringkasan pengingat pengisian - ' + m.periodeLabel, body: ringkas }); } catch (e) { /* abaikan */ } });
  catatLog_('pengingat', 'sistem', 'Pengingat otomatis: ' + target.length + ' indikator, email terkirim ' + terkirim);
  return { terkirim: terkirim, indikator: target.length, tanpaEmail: tanpa };
}

/* ---------------- Aksi: masalah & rekomendasi ---------------- */

function apiSimpanMasalah(token, p) {
  return run_(() => {
    const user = auth_(token);
    p = p || {};
    const masalah = bersih_(p.permasalahan, 1000);
    if (masalah.length < 5) throw new Error('Uraikan permasalahan minimal beberapa kata.');
    const prio = ['Tinggi', 'Sedang', 'Rendah'].indexOf(p.prioritas) >= 0 ? p.prioritas : 'Sedang';
    const bidangValid = readTable_(SHEET.BIDANG).map(b => String(b.Nama));
    const bidang = bidangValid.indexOf(p.bidang) >= 0 ? p.bidang : (user.bidang || '');
    if (user.role === 'pic' && bidang !== user.bidang) throw new Error('PIC hanya dapat menambah catatan untuk bidangnya sendiri.');
    if (user.role === 'pic' && p.indikatorId) {
      const rowI = indById_(p.indikatorId);
      if (!rowI || !bolehIsi_(user, rowI)) throw new Error('Catatan hanya dapat dikaitkan dengan indikator yang menjadi tanggung jawab Anda.');
    }
    const id = 'MS-' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss');
    appendObj_(SHEET.MASALAH, {
      ID: id, Tanggal: nowStr_(), IndikatorID: bersih_(p.indikatorId, 20), Bidang: bidang, Permasalahan: masalah,
      Rekomendasi: bersih_(p.rekomendasi, 1000), Prioritas: prio, Status: 'Terbuka',
      Penanggung: bersih_(p.penanggung, 80), Tenggat: bersih_(p.tenggat, 10), DibuatOleh: user.nama
    });
    catatLog_('masalah', user.username, 'Menambah catatan ' + id);
    return { id: id };
  });
}

function apiUbahStatusMasalah(token, id, status) {
  return run_(() => {
    const user = auth_(token);
    if (['Terbuka', 'Proses', 'Selesai'].indexOf(status) < 0) throw new Error('Status tidak valid.');
    const row = readTable_(SHEET.MASALAH).find(r => r.ID === id);
    if (!row) throw new Error('Catatan tidak ditemukan.');
    if (user.role === 'pic' && row.Bidang !== user.bidang) throw new Error('Bukan bidang Anda.');
    upsertRow_(SHEET.MASALAH, o => o.ID === id, { Status: status });
    catatLog_('masalah', user.username, id + ' → ' + status);
    return true;
  });
}

/* ---------------- Aksi: permintaan data ---------------- */

function apiSimpanPermintaan(token, p) {
  return run_(() => {
    const user = auth_(token);
    p = p || {};
    const keb = bersih_(p.kebutuhan, 1000);
    if (keb.length < 5) throw new Error('Uraikan data yang diminta.');
    const format = ['Excel', 'PDF', 'Dasbor', 'Lainnya'].indexOf(p.format) >= 0 ? p.format : 'Excel';
    const id = 'PD-' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss');
    appendObj_(SHEET.PERMINTAAN, {
      ID: id, Tanggal: nowStr_(), Pemohon: user.nama, Instansi: bersih_(p.instansi || user.bidang, 100),
      Kebutuhan: keb, Format: format, Tenggat: bersih_(p.tenggat, 10), Status: 'Baru', Catatan: ''
    });
    catatLog_('permintaan', user.username, 'Permintaan data ' + id);
    return { id: id };
  });
}

function apiUbahStatusPermintaan(token, id, status, catatan) {
  return run_(() => {
    const user = auth_(token, ['admin']);
    if (['Baru', 'Diproses', 'Selesai', 'Ditolak'].indexOf(status) < 0) throw new Error('Status tidak valid.');
    const hasil = upsertRow_(SHEET.PERMINTAAN, o => o.ID === id, { Status: status, Catatan: bersih_(catatan, 300) });
    if (hasil === 'insert') throw new Error('Permintaan tidak ditemukan.');
    catatLog_('permintaan', user.username, id + ' → ' + status);
    return true;
  });
}

/* ---------------- Aksi: pengaturan (admin) ---------------- */

function apiSimpanConfig(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin']);
    const tahun = Number(p.tahun), bulan = Number(p.bulan);
    if (!(tahun >= 2000 && tahun <= 2100)) throw new Error('Tahun tidak valid.');
    if (!(bulan >= 1 && bulan <= 12)) throw new Error('Bulan aktif harus 1–12.');
    if (p.cutoff && !/^\d{4}-\d{2}-\d{2}$/.test(p.cutoff)) throw new Error('Format batas cut-off harus yyyy-mm-dd.');
    const kab = String(p.kabupaten || '').split(',').map(s => bersih_(s, 40)).filter(Boolean);
    if (!kab.length) throw new Error('Isi minimal satu kabupaten.');
    let logo = bersih_(p.logoUrl, 600);
    if (logo && !/^https:\/\/[^\s"'<>]+$/.test(logo)) throw new Error('URL logo harus diawali https:// dan berupa tautan langsung ke gambar.');
    const data = String(p.logoData || '').trim();
    if (data) {
      if (!logoValid_(data)) throw new Error('Gambar logo tidak valid atau terlalu besar. Pakai PNG, JPG, atau WebP yang kecil.');
      logo = data;
    } else if (p.logoKeep && !logo) {
      const lama = readTable_(SHEET.CONFIG).find(x => x.Kunci === 'LogoUrl');
      logo = lama && logoValid_(String(lama.Nilai)) && /^data:/.test(String(lama.Nilai)) ? String(lama.Nilai) : '';
    }
    const set = { Tahun: tahun, BulanAktif: bulan, Cutoff: p.cutoff || '', NamaDinas: bersih_(p.namaDinas, 200), Kabupaten: kab.join(','), LogoUrl: logo };
    if (p.namaApp !== undefined) {
      const na = bersih_(p.namaApp, 40);
      if (!na) throw new Error('Nama aplikasi tidak boleh kosong.');
      set.NamaApp = na; set.SubApp = bersih_(p.subApp, 40);
    }
    if (p.batasIsi !== undefined) {
      const bi = Math.round(Number(p.batasIsi) || 0), ph = Math.round(Number(p.pengingatHari) || 3);
      if (bi < 0 || bi > 28) throw new Error('Batas pengisian harus tanggal 1–28 (kosongkan atau 0 bila tidak dipakai).');
      if (ph < 1 || ph > 14) throw new Error('Mulai mengingatkan 1–14 hari sebelum batas.');
      const minta = p.pengingatAuto === true || p.pengingatAuto === 'Ya';
      const auto = minta && bi > 0;
      if (minta && !bi) throw new Error('Isi tanggal batas pengisian untuk mengaktifkan pengingat otomatis.');
      set.BatasIsi = bi; set.PengingatHari = ph; set.PengingatAuto = auto ? 'Ya' : 'Tidak';
      try { aturPemicu_(auto); } catch (e) { throw new Error('Pengingat otomatis belum bisa dipasang: ' + e.message + ' Jalankan fungsi pengingatHarian sekali dari editor Apps Script untuk memberi izin, lalu coba lagi.'); }
    }
    Object.keys(set).forEach(k => upsertRow_(SHEET.CONFIG, o => o.Kunci === k, { Kunci: k, Nilai: String(set[k]) }));
    catatLog_('config', user.username, 'Konfigurasi diperbarui');
    return true;
  });
}

function apiSimpanIndikator(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin']);
    p = p || {};
    const semuaInd = readTable_(SHEET.INDIKATOR);
    let id = bersih_(p.id, 20);
    if (!id) {
      let mx = 0;
      semuaInd.forEach(x => { const mm = /^IK-(\d+)$/.exec(String(x.ID)); if (mm) mx = Math.max(mx, Number(mm[1])); });
      id = 'IK-' + String(mx + 1).padStart(3, '0');
    }
    if (!/^[A-Za-z0-9\-]{2,20}$/.test(id)) throw new Error('ID hanya huruf, angka, dan strip (2–20 karakter).');
    const nama = bersih_(p.nama, 200);
    if (p.baru) {
      if (semuaInd.some(x => String(x.ID) === id)) throw new Error('ID ' + id + ' sudah dipakai.');
      if (semuaInd.some(x => String(x.Bidang) === String(p.bidang) && String(x.Nama).trim().toLowerCase() === nama.toLowerCase())) throw new Error('Indikator "' + nama + '" sudah ada di bidang ' + p.bidang + '.');
    }
    if (nama.length < 3) throw new Error('Nama indikator terlalu pendek.');
    const bidangValid = readTable_(SHEET.BIDANG).map(b => String(b.Nama));
    if (bidangValid.indexOf(p.bidang) < 0) throw new Error('Bidang tidak dikenal.');
    if (ENUM_JENIS.indexOf(p.jenis) < 0 || ENUM_FREK.indexOf(p.frekuensi) < 0) throw new Error('Jenis atau frekuensi tidak valid.');
    const target = Number(p.target);
    if (!isFinite(target) || target < 0) throw new Error('Target harus berupa angka.');
    const pic = bersih_(p.pic, 60);
    if (pic && !readTable_(SHEET.USERS).some(u => u.Username === pic)) throw new Error('PIC tidak terdaftar sebagai pengguna.');
    const prog = bersih_(p.program, 20);
    if (prog) {
      const pr = readTable_(SHEET.PROGRAM).find(x => String(x.ID) === prog);
      if (!pr) throw new Error('Program tidak dikenal.');
      if (String(pr.Bidang) !== String(p.bidang)) throw new Error('Program "' + pr.Nama + '" berada di bidang ' + pr.Bidang + ', bukan ' + p.bidang + '.');
    }
    const hasil = upsertRow_(SHEET.INDIKATOR, o => String(o.ID) === id, {
      ID: id, Nama: nama, Bidang: p.bidang, Jenis: p.jenis, Frekuensi: p.frekuensi, Satuan: bersih_(p.satuan, 20),
      Target: target, Arah: p.arah === 'Turun' ? 'Turun' : 'Naik', PIC: pic, Aktif: p.aktif === false ? 'Tidak' : 'Ya', Program: prog
    });
    catatLog_('indikator', user.username, (hasil === 'insert' ? 'Menambah ' : 'Mengubah ') + id);
    return { hasil: hasil, id: id };
  });
}

/** Tambah / ubah program (unit di bawah bidang atau sub-bidang) beserta status aktifnya. */
function apiSimpanProgram(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin']);
    p = p || {};
    const nama = bersih_(p.nama, 100);
    if (nama.length < 3) throw new Error('Nama program terlalu pendek.');
    const bidangValid = readTable_(SHEET.BIDANG).map(b => String(b.Nama));
    if (bidangValid.indexOf(p.bidang) < 0) throw new Error('Pilih bidang untuk program ini.');
    const sub = bersih_(p.sub, 80);
    const semua = readTable_(SHEET.PROGRAM);
    let id = bersih_(p.id, 20);
    const baru = !id;
    if (baru) {
      let mx = 0;
      semua.forEach(r => { const n = Number(String(r.ID).replace(/\D/g, '')); if (n > mx) mx = n; });
      id = 'PG-' + ('00' + (mx + 1)).slice(-3);
    } else if (!semua.some(r => String(r.ID) === id)) throw new Error('Program tidak ditemukan.');
    if (semua.some(r => String(r.ID) !== id && String(r.Bidang) === p.bidang && String(r.Sub || '') === sub && String(r.Nama).toLowerCase() === nama.toLowerCase())) throw new Error('Program dengan nama itu sudah ada di bidang / sub-bidang yang sama.');
    upsertRow_(SHEET.PROGRAM, o => String(o.ID) === id, { ID: id, Nama: nama, Bidang: p.bidang, Sub: sub, Aktif: p.aktif === false ? 'Tidak' : 'Ya' });
    catatLog_('program', user.username, (baru ? 'Menambah program ' : 'Mengubah program ') + id + ' ' + nama);
    return { id: id };
  });
}

/**
 * Simpan target per periode (TW1–TW4, SM1–SM2, TH) untuk banyak indikator sekaligus.
 * items: [{id, periode, target}]; target kosong = hapus (kembali memakai target dasar).
 */
function apiSimpanTarget(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin']);
    p = p || {};
    const tahun = Number(p.tahun);
    if (!(tahun >= 2000 && tahun <= 2100)) throw new Error('Tahun tidak valid.');
    const items = Array.isArray(p.items) ? p.items : [];
    if (!items.length) throw new Error('Tidak ada perubahan untuk disimpan.');
    if (items.length > 700) throw new Error('Terlalu banyak perubahan sekaligus. Simpan bertahap.');
    const indOk = {};
    readTable_(SHEET.INDIKATOR).forEach(i => { indOk[String(i.ID)] = true; });
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const sh = sheetTulis_(SHEET.TARGET);
      const H = HEADERS.Target;
      const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getValues() : [];
      const peta = {}, urut = [];
      v.forEach(r => {
        if (r[0] === '' && r[1] === '') return;
        const k = r[0] + '|' + r[1] + '|' + r[2];
        if (!peta[k]) urut.push(k);
        peta[k] = r;
      });
      let ubah = 0, hapus = 0;
      const waktu = nowStr_();
      items.forEach(it => {
        const id = String(it.id || ''), per = String(it.periode || '');
        if (!indOk[id]) throw new Error('Indikator ' + id + ' tidak dikenal.');
        if (ENUM_PERIODE_TARGET.indexOf(per) < 0) throw new Error('Periode ' + per + ' tidak valid.');
        const k = id + '|' + tahun + '|' + per;
        if (it.target === '' || it.target === null || it.target === undefined) {
          if (peta[k]) { delete peta[k]; hapus++; }
          return;
        }
        const n = Number(it.target);
        if (!isFinite(n) || n < 0) throw new Error('Target ' + id + ' ' + per + ' harus berupa angka nol atau lebih.');
        if (!peta[k]) urut.push(k);
        peta[k] = [id, tahun, per, n, user.nama, waktu];
        ubah++;
      });
      const hasil = urut.filter(k => peta[k]).map(k => peta[k]);
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, H.length).clearContent();
      if (hasil.length) sh.getRange(2, 1, hasil.length, H.length).setValues(hasil);
      bust_(SHEET.TARGET);
      catatLog_('target', user.username, 'Target ' + tahun + ': ' + ubah + ' disimpan, ' + hapus + ' dihapus');
      return { disimpan: ubah, dihapus: hapus };
    } finally {
      lock.releaseLock();
    }
  });
}

/** Kata sandi acak (tanpa karakter yang mudah tertukar: 0/O, 1/l/I). */
function acakSandi_(n) {
  const set = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now(), Utilities.Charset.UTF_8);
  let out = '';
  for (let i = 0; i < (n || 10); i++) out += set.charAt((b[i] & 255) % set.length);
  return out.slice(0, -1) + '7'; // pastikan ada angka
}

/** Mencabut semua sesi aktif milik pengguna (dipakai saat dinonaktifkan atau sandi direset). */
function cabutSesi_(username) {
  CacheService.getScriptCache().put('rev_' + String(username).toLowerCase(), String(Date.now()), SESI_DETIK);
}

function jumlahAdminAktif_(kecuali) {
  return readTable_(SHEET.USERS).filter(u => u.Role === 'admin' && String(u.Aktif).toLowerCase() !== 'tidak' && String(u.Username).toLowerCase() !== String(kecuali || '').toLowerCase()).length;
}

/**
 * Tambah atau ubah pengguna (admin).
 * p.baru = true  -> membuat akun baru; ditolak bila nama pengguna sudah dipakai.
 * p.modeSandi = 'otomatis' -> server membuat kata sandi acak dan mengembalikannya sekali.
 */
function apiSimpanUser(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin']);
    p = p || {};
    const uname = bersih_(p.username, 40).toLowerCase();
    if (!/^[a-z0-9._\-]{3,40}$/.test(uname)) throw new Error('Nama pengguna: huruf kecil, angka, titik, strip (3–40).');
    if (ENUM_ROLE.indexOf(p.role) < 0) throw new Error('Peran tidak valid.');
    const ada = readTable_(SHEET.USERS).find(u => String(u.Username).toLowerCase() === uname);
    if (p.baru && ada) throw new Error('Nama pengguna "' + uname + '" sudah dipakai. Pilih nama lain.');
    if (!p.baru && !ada) throw new Error('Pengguna tidak ditemukan.');
    const bidangValid = readTable_(SHEET.BIDANG).map(b => String(b.Nama));
    const bidang = bersih_(p.bidang, 60);
    if (p.role === 'pic' && bidangValid.indexOf(bidang) < 0) throw new Error('PIC wajib memilih bidang.');
    if (bidang && bidangValid.indexOf(bidang) < 0) throw new Error('Bidang tidak dikenal.');
    const progId = p.role === 'pic' ? bersih_(p.program, 20) : '';
    if (progId) {
      const pr = readTable_(SHEET.PROGRAM).find(x => String(x.ID) === progId);
      if (!pr) throw new Error('Program tidak dikenal.');
      if (String(pr.Bidang) !== bidang) throw new Error('Program "' + pr.Nama + '" berada di bidang ' + pr.Bidang + '. Samakan bidang pengguna.');
    }
    let ikIds = [];
    if (p.role === 'pic') {
      ikIds = parseIk_(Array.isArray(p.indikator) ? p.indikator.join(',') : p.indikator);
      if (ikIds.length > 60) throw new Error('Maksimal 60 indikator per PIC.');
      const dataInd = readTable_(SHEET.INDIKATOR);
      ikIds.forEach(x => {
        const row = dataInd.find(r => String(r.ID) === x);
        if (!row) throw new Error('Indikator ' + x + ' tidak ditemukan.');
        if (String(row.Bidang) !== bidang) throw new Error('Indikator ' + x + ' milik bidang ' + row.Bidang + ', bukan ' + bidang + '.');
      });
    }
    const aktif = p.aktif !== false;
    const diri = uname === String(user.username).toLowerCase();
    if (diri && (!aktif || p.role !== 'admin')) throw new Error('Anda tidak dapat menonaktifkan atau menurunkan peran akun Anda sendiri.');
    if (ada && ada.Role === 'admin' && (p.role !== 'admin' || !aktif) && jumlahAdminAktif_(uname) < 1) throw new Error('Harus tersisa minimal satu administrator aktif.');
    const obj = {
      Username: uname, Nama: bersih_(p.nama, 100), Role: p.role, Bidang: p.role === 'pic' ? bidang : (bidang || ''),
      Email: bersih_(p.email, 120), Telepon: bersih_(p.telepon, 20).replace(/[^0-9+]/g, ''), Aktif: aktif ? 'Ya' : 'Tidak', Program: progId, Indikator: ikIds.join(', ')
    };
    if (!obj.Nama) throw new Error('Nama wajib diisi.');
    if (obj.Email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(obj.Email)) throw new Error('Format email tidak valid.');
    let sandi = '';
    if (p.baru) {
      if (p.modeSandi === 'manual') {
        sandi = String(p.password || '');
        if (sandi.length < 8) throw new Error('Kata sandi awal minimal 8 karakter.');
      } else sandi = acakSandi_(10);
    } else if (p.password) {
      sandi = String(p.password);
      if (sandi.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
    }
    if (sandi) { obj.Salt = Utilities.getUuid(); obj.Hash = hash_(obj.Salt, sandi); }
    upsertRow_(SHEET.USERS, o => String(o.Username).toLowerCase() === uname, obj);
    if (ada && (!aktif || sandi)) cabutSesi_(uname);
    catatLog_('user', user.username, (p.baru ? 'Menambah ' : 'Mengubah ') + uname + ' (' + p.role + ')');
    return { username: uname, nama: obj.Nama, telepon: obj.Telepon, baru: !!p.baru, password: p.baru && p.modeSandi !== 'manual' ? sandi : '' };
  });
}

/** Admin membuat kata sandi sementara baru untuk pengguna lain. Sesi lama pengguna itu dicabut. */
function apiResetPassword(token, username) {
  return run_(() => {
    const user = auth_(token, ['admin']);
    const uname = bersih_(username, 40).toLowerCase();
    if (uname === String(user.username).toLowerCase()) throw new Error('Untuk akun Anda sendiri, gunakan menu Pengaturan → Ubah Kata Sandi.');
    const u = readTable_(SHEET.USERS).find(x => String(x.Username).toLowerCase() === uname);
    if (!u) throw new Error('Pengguna tidak ditemukan.');
    const sandi = acakSandi_(10), salt = Utilities.getUuid();
    upsertRow_(SHEET.USERS, o => String(o.Username).toLowerCase() === uname, { Salt: salt, Hash: hash_(salt, sandi) });
    CacheService.getScriptCache().remove('gagal_' + uname);
    cabutSesi_(uname);
    catatLog_('user', user.username, 'Reset kata sandi ' + uname);
    return { username: uname, nama: String(u.Nama), telepon: String(u.Telepon || ''), password: sandi };
  });
}

/** Aktifkan / nonaktifkan akun. Akun tidak dihapus agar riwayat isian tetap tercatat. */
function apiUbahStatusUser(token, username, aktif) {
  return run_(() => {
    const user = auth_(token, ['admin']);
    const uname = bersih_(username, 40).toLowerCase();
    const u = readTable_(SHEET.USERS).find(x => String(x.Username).toLowerCase() === uname);
    if (!u) throw new Error('Pengguna tidak ditemukan.');
    if (!aktif) {
      if (uname === String(user.username).toLowerCase()) throw new Error('Anda tidak dapat menonaktifkan akun Anda sendiri.');
      if (u.Role === 'admin' && jumlahAdminAktif_(uname) < 1) throw new Error('Harus tersisa minimal satu administrator aktif.');
    }
    upsertRow_(SHEET.USERS, o => String(o.Username).toLowerCase() === uname, { Aktif: aktif ? 'Ya' : 'Tidak' });
    if (!aktif) cabutSesi_(uname);
    catatLog_('user', user.username, (aktif ? 'Mengaktifkan ' : 'Menonaktifkan ') + uname);
    return true;
  });
}

function apiUbahPassword(token, lama, baru) {
  return run_(() => {
    const user = auth_(token);
    if (String(baru || '').length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
    if (baru === lama) throw new Error('Kata sandi baru harus berbeda.');
    const u = readTable_(SHEET.USERS).find(x => x.Username === user.username);
    if (!u || hash_(String(u.Salt), String(lama)) !== String(u.Hash)) throw new Error('Kata sandi lama salah.');
    const salt = Utilities.getUuid();
    upsertRow_(SHEET.USERS, o => o.Username === user.username, { Salt: salt, Hash: hash_(salt, String(baru)) });
    catatLog_('password', user.username, 'Mengubah kata sandi');
    return true;
  });
}

function apiExportPdf(token, tahun, bulan) {
  return run_(() => {
    auth_(token, ['admin', 'pimpinan']);
    const m = hitungModel_(tahun, bulan);
    const blob = Utilities.newBlob(laporanPdfHtml_(m), 'text/html', 'laporan.html').getAs('application/pdf');
    return { nama: 'Ringkasan-Eksekutif-' + m.tahun + '-' + ('0' + m.bulan).slice(-2) + '.pdf', base64: Utilities.base64Encode(blob.getBytes()) };
  });
}

/* ---------------- Bukti indikator (dokumen di Google Drive) ---------------- */

const BUKTI_MAKS_BYTE = 8 * 1024 * 1024;
const BUKTI_MAKS_PER_IND = 40;
const BUKTI_TIPE = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv', txt: 'text/plain'
};

/** Folder penyimpanan bukti. Dibuat otomatis sekali; ID-nya disimpan di Config. */
function folderBukti_() {
  const r = readTable_(SHEET.CONFIG).find(x => x.Kunci === 'FolderBukti');
  if (r && r.Nilai) { try { return DriveApp.getFolderById(String(r.Nilai)); } catch (e) { /* folder hilang: buat baru */ } }
  const f = DriveApp.createFolder('Bukti Indikator DKPPKB Sulbar Intelligence');
  upsertRow_(SHEET.CONFIG, o => o.Kunci === 'FolderBukti', { Kunci: 'FolderBukti', Nilai: f.getId() });
  return f;
}

/** Jalankan SEKALI dari editor Apps Script setelah menempel kode terbaru, untuk memberi izin Google Drive. */
function otorisasiDrive() {
  return 'Izin Drive aktif. Folder bukti: ' + folderBukti_().getName();
}

function indById_(id) {
  return readTable_(SHEET.INDIKATOR).find(i => String(i.ID) === String(id));
}
/** Siapa boleh melihat bukti: admin, pimpinan, dan PIC yang bertanggung jawab atas indikator itu. */
function bolehLihatBukti_(user, ind) {
  return user.role === 'admin' || user.role === 'pimpinan' || (user.role === 'pic' && bolehIsi_(user, ind));
}
function infoBukti_(r, user, ind) {
  const sendiri = String(r.DiunggahOleh) === String(user.username);
  return {
    id: String(r.ID), nama: String(r.NamaFile), tipe: String(r.Tipe), ukuran: Number(r.Ukuran) || 0,
    tahun: Number(r.Tahun) || 0, bulan: Number(r.Bulan) || 0, catatan: String(r.Catatan || ''),
    oleh: String(r.DiunggahOleh), pada: String(r.DiunggahPada),
    bisaHapus: user.role === 'admin' || (user.role === 'pic' && sendiri && bolehIsi_(user, ind))
  };
}

function apiDaftarBukti(token, indikatorId) {
  return run_(() => {
    const user = auth_(token);
    const ind = indById_(indikatorId);
    if (!ind) throw new Error('Indikator tidak ditemukan.');
    if (!bolehLihatBukti_(user, ind)) throw new Error('Anda tidak memiliki akses ke bukti indikator ini.');
    const list = readTable_(SHEET.BUKTI).filter(r => String(r.IndikatorID) === String(ind.ID))
      .sort((a, b) => String(b.DiunggahPada).localeCompare(String(a.DiunggahPada)))
      .map(r => infoBukti_(r, user, ind));
    return { indikator: { id: String(ind.ID), nama: String(ind.Nama) }, daftar: list, bisaUnggah: user.role === 'admin' || (user.role === 'pic' && bolehIsi_(user, ind)), maksMB: BUKTI_MAKS_BYTE / 1048576 };
  });
}

function apiUnggahBukti(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin', 'pic']);
    p = p || {};
    const ind = indById_(p.indikatorId);
    if (!ind) throw new Error('Indikator tidak ditemukan.');
    if (!bolehIsi_(user, ind)) throw new Error('Anda bukan penanggung jawab indikator ini.');
    const asli = String(p.nama || '').replace(/[\\\/]/g, '_').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120);
    const ext = (asli.split('.').length > 1 ? asli.split('.').pop() : '').toLowerCase();
    if (!ext || !BUKTI_TIPE[ext]) throw new Error('Jenis file tidak didukung. Pakai PDF, gambar (JPG, PNG, WebP), Word, Excel, PowerPoint, CSV, atau TXT.');
    const b64 = String(p.base64 || '');
    if (!b64 || b64.length > BUKTI_MAKS_BYTE * 1.4) throw new Error('File kosong atau lebih besar dari ' + (BUKTI_MAKS_BYTE / 1048576) + ' MB.');
    const bytes = Utilities.base64Decode(b64);
    if (!bytes.length) throw new Error('File kosong.');
    if (bytes.length > BUKTI_MAKS_BYTE) throw new Error('File lebih besar dari ' + (BUKTI_MAKS_BYTE / 1048576) + ' MB.');
    const sudah = readTable_(SHEET.BUKTI).filter(r => String(r.IndikatorID) === String(ind.ID)).length;
    if (sudah >= BUKTI_MAKS_PER_IND) throw new Error('Satu indikator maksimal ' + BUKTI_MAKS_PER_IND + ' bukti. Hapus yang tidak terpakai.');
    const cfg = getConfig_();
    const bulan = Math.max(0, Math.min(12, Math.floor(Number(p.bulan)) || 0));
    const tahun = Number(p.tahun) || cfg.Tahun;
    const id = 'BK-' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 4);
    const blob = Utilities.newBlob(bytes, BUKTI_TIPE[ext], String(ind.ID) + '_' + id + '_' + asli);
    const file = folderBukti_().createFile(blob);
    appendObj_(SHEET.BUKTI, {
      ID: id, IndikatorID: String(ind.ID), Tahun: tahun, Bulan: bulan, NamaFile: asli, Tipe: ext, Ukuran: bytes.length,
      FileId: file.getId(), Catatan: bersih_(p.catatan, 300), DiunggahOleh: user.username, DiunggahPada: nowStr_()
    });
    catatLog_('bukti', user.username, 'Unggah bukti ' + id + ' untuk ' + ind.ID);
    return { id: id };
  });
}

function apiUnduhBukti(token, id) {
  return run_(() => {
    const user = auth_(token);
    const r = readTable_(SHEET.BUKTI).find(x => String(x.ID) === String(id));
    if (!r) throw new Error('Bukti tidak ditemukan.');
    const ind = indById_(r.IndikatorID);
    if (!ind || !bolehLihatBukti_(user, ind)) throw new Error('Anda tidak memiliki akses ke bukti ini.');
    let blob;
    try { blob = DriveApp.getFileById(String(r.FileId)).getBlob(); } catch (e) { throw new Error('File bukti tidak ditemukan di Google Drive. Mungkin sudah dihapus dari folder.'); }
    return { nama: String(r.NamaFile), mime: BUKTI_TIPE[String(r.Tipe)] || 'application/octet-stream', base64: Utilities.base64Encode(blob.getBytes()) };
  });
}

function apiHapusBukti(token, id) {
  return run_(() => {
    const user = auth_(token, ['admin', 'pic']);
    const r = readTable_(SHEET.BUKTI).find(x => String(x.ID) === String(id));
    if (!r) throw new Error('Bukti tidak ditemukan.');
    const ind = indById_(r.IndikatorID);
    const boleh = user.role === 'admin' || (ind && bolehIsi_(user, ind) && String(r.DiunggahOleh) === String(user.username));
    if (!boleh) throw new Error('Anda hanya dapat menghapus bukti yang Anda unggah sendiri.');
    sheetTulis_(SHEET.BUKTI).deleteRow(r._row);
    bust_(SHEET.BUKTI);
    try { DriveApp.getFileById(String(r.FileId)).setTrashed(true); } catch (e) { /* sudah hilang */ }
    catatLog_('bukti', user.username, 'Hapus bukti ' + r.ID);
    return true;
  });
}


/* ---------------- Monev Kinerja ----------------
 * Satu lembar "Monev" menampung semua sub-menu lewat kolom Jenis:
 *  sasaran    : Teks = Tujuan / Sasaran Program
 *  program    : Induk = ID sasaran, Teks = Program yang mendukung sasaran
 *  ik         : Induk = ID sasaran, Teks = Indikator Kinerja (IK) Tujuan Program, Satuan
 *  target     : Induk = ID IK, TW, Angka          (satu nilai per IK + tahun + TW)
 *  realisasi  : Induk = ID IK, TW, Angka          (satu nilai per IK + tahun + TW)
 *  unit       : Induk = ID IK, Bidang, PIC        (unit / PIC penanggung jawab IK)
 *  catatan    : Induk = ID IK, TW (opsional), Teks
 *  keterangan : Induk = ID IK, TW (opsional), Teks
 * Bukti dukung disimpan di lembar Bukti dengan IndikatorID "MV:<ID IK>" dan kolom Bulan berisi nomor TW (0 = umum). */
const MONEV_JENIS = ['sasaran', 'program', 'ik', 'target', 'realisasi', 'unit', 'catatan', 'keterangan'];
const MONEV_TW = ['TW1', 'TW2', 'TW3', 'TW4'];
const MONEV_SATUAN = ['%', 'Angka', 'Jumlah'];
const MONEV_AWAL = { sasaran: 'SP', program: 'PRG', ik: 'IKM' };

function monevIdBaru_(jenis) {
  const pre = MONEV_AWAL[jenis];
  if (pre) {
    let mx = 0;
    readTable_(SHEET.MONEV).filter(r => r.Jenis === jenis).forEach(r => { const n = Number(String(r.ID).replace(/\D/g, '')); if (n > mx) mx = n; });
    return pre + '-' + ('00' + (mx + 1)).slice(-3);
  }
  return 'MV-' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 4);
}

/** Admin boleh semua. PIC boleh mengisi realisasi, catatan, keterangan, dan bukti untuk IK yang unitnya (bidang atau PIC) miliknya. */
function monevBolehUbah_(user, jenis, ikId) {
  if (user.role === 'admin') return true;
  if (user.role !== 'pic') return false;
  if (['realisasi', 'catatan', 'keterangan', 'bukti'].indexOf(jenis) < 0) return false;
  return readTable_(SHEET.MONEV).some(r => r.Jenis === 'unit' && String(r.Induk) === String(ikId) && (String(r.PIC) === user.username || (!r.PIC && String(r.Bidang) === String(user.bidang))));
}

function monevAngka_(v, satuan) {
  const t = String(v === undefined || v === null ? '' : v).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || isNaN(Number(t))) throw new Error('Isi angka yang valid.');
  const n = Number(t);
  if (n < 0) throw new Error('Angka tidak boleh negatif.');
  if (satuan === '%' && n > 1000) throw new Error('Persen tidak boleh lebih dari 1000.');
  if (n > 1e12) throw new Error('Angka terlalu besar.');
  return Math.round(n * 1000) / 1000;
}

/** Tambah / ubah satu isi sub-menu Monev Kinerja. */
function apiSimpanMonev(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin', 'pic']);
    p = p || {};
    const jenis = String(p.jenis || '');
    if (MONEV_JENIS.indexOf(jenis) < 0) throw new Error('Jenis isian tidak dikenal.');
    const cfg = getConfig_();
    const tahun = Number(p.tahun) >= 2000 && Number(p.tahun) <= 2100 ? Number(p.tahun) : cfg.Tahun;
    const semua = readTable_(SHEET.MONEV);
    let id = bersih_(p.id, 40);
    const lama = id ? semua.find(r => String(r.ID) === id && r.Jenis === jenis) : null;
    if (id && !lama) throw new Error('Data tidak ditemukan.');
    const baris = { ID: id, Jenis: jenis, Tahun: lama ? lama.Tahun : tahun, Induk: '', TW: '', Teks: '', Angka: '', Satuan: '', Bidang: '', PIC: '', DibuatOleh: lama ? lama.DibuatOleh : user.username, DibuatPada: lama ? lama.DibuatPada : nowStr_() };
    let ikId = '';
    if (jenis === 'sasaran') {
      if (user.role !== 'admin') throw new Error('Hanya admin yang dapat mengelola sasaran program.');
      baris.Teks = bersih_(p.teks, 300);
      if (baris.Teks.length < 5) throw new Error('Tujuan / sasaran program terlalu pendek (minimal 5 huruf).');
    } else {
      ikId = bersih_(p.induk, 40);
      if (jenis === 'ik' || jenis === 'program') {
        if (user.role !== 'admin') throw new Error('Hanya admin yang dapat mengelola ' + (jenis === 'ik' ? 'indikator kinerja.' : 'program.'));
        if (!semua.some(r => r.Jenis === 'sasaran' && String(r.ID) === ikId)) throw new Error('Pilih tujuan / sasaran program terlebih dahulu.');
        baris.Induk = ikId;
        baris.Teks = bersih_(p.teks, 300);
        if (baris.Teks.length < 5) throw new Error('Nama ' + (jenis === 'ik' ? 'IK' : 'program') + ' terlalu pendek (minimal 5 huruf).');
        if (jenis === 'ik') baris.Satuan = MONEV_SATUAN.indexOf(p.satuan) >= 0 ? p.satuan : '%';
      } else {
        if (!semua.some(r => r.Jenis === 'ik' && String(r.ID) === ikId)) throw new Error('Pilih indikator kinerja (IK) terlebih dahulu.');
        if (!monevBolehUbah_(user, jenis, ikId)) throw new Error('Anda tidak berwenang mengubah ' + jenis + ' untuk IK ini.');
        baris.Induk = ikId;
        const ik = semua.find(r => r.Jenis === 'ik' && String(r.ID) === ikId);
        if (jenis === 'target' || jenis === 'realisasi') {
          if (MONEV_TW.indexOf(p.tw) < 0) throw new Error('Pilih triwulan (TW 1 sampai TW 4).');
          baris.TW = p.tw;
          baris.Angka = monevAngka_(p.angka, ik.Satuan);
          baris.Satuan = ik.Satuan;
          const dup = semua.find(r => r.Jenis === jenis && String(r.Induk) === ikId && Number(r.Tahun) === Number(baris.Tahun) && r.TW === p.tw);
          if (dup) { if (!id) { id = String(dup.ID); baris.ID = id; baris.DibuatOleh = dup.DibuatOleh; baris.DibuatPada = dup.DibuatPada; } else if (String(dup.ID) !== id) throw new Error('Nilai ' + p.tw + ' untuk IK ini sudah ada. Ubah dari daftar.'); }
        } else if (jenis === 'unit') {
          const bidangValid = readTable_(SHEET.BIDANG).map(b => String(b.Nama));
          if (bidangValid.indexOf(p.bidang) < 0) throw new Error('Pilih unit / bidang penanggung jawab.');
          baris.Bidang = p.bidang;
          const pic = bersih_(p.pic, 60).toLowerCase();
          if (pic) {
            const u = readTable_(SHEET.USERS).find(x => String(x.Username).toLowerCase() === pic && x.Role === 'pic' && String(x.Aktif).toLowerCase() !== 'tidak');
            if (!u) throw new Error('PIC tidak ditemukan atau tidak aktif.');
            baris.PIC = String(u.Username);
          }
          if (semua.some(r => r.Jenis === 'unit' && String(r.Induk) === ikId && String(r.ID) !== id && r.Bidang === baris.Bidang && String(r.PIC || '') === baris.PIC)) throw new Error('Unit / PIC itu sudah tercatat untuk IK ini.');
        } else { // catatan, keterangan
          baris.TW = MONEV_TW.indexOf(p.tw) >= 0 ? p.tw : '';
          baris.Teks = bersih_(p.teks, 1000);
          if (baris.Teks.length < 3) throw new Error('Isi minimal 3 huruf.');
          if (lama && user.role !== 'admin' && String(lama.DibuatOleh) !== user.username) throw new Error('Anda hanya dapat mengubah isian yang Anda buat sendiri.');
        }
      }
    }
    if (!id) { id = monevIdBaru_(jenis); baris.ID = id; }
    upsertRow_(SHEET.MONEV, o => String(o.ID) === id, baris);
    catatLog_('monev', user.username, (lama ? 'Mengubah ' : 'Menambah ') + jenis + ' ' + id);
    return { id: id };
  });
}

/** Hapus satu isi Monev. Menghapus sasaran harus mengosongkan IK-nya dulu; menghapus IK ikut menghapus isian dan bukti miliknya. */
function apiHapusMonev(token, id) {
  return run_(() => {
    const user = auth_(token, ['admin', 'pic']);
    id = bersih_(id, 40);
    const semua = readTable_(SHEET.MONEV);
    const r = semua.find(x => String(x.ID) === id);
    if (!r) throw new Error('Data tidak ditemukan.');
    if (r.Jenis === 'sasaran') {
      if (user.role !== 'admin') throw new Error('Hanya admin yang dapat menghapus sasaran program.');
      if (semua.some(x => x.Jenis === 'ik' && String(x.Induk) === id)) throw new Error('Hapus atau pindahkan dulu IK yang ada di bawah sasaran ini.');
    } else if (r.Jenis === 'ik' || r.Jenis === 'program') {
      if (user.role !== 'admin') throw new Error('Hanya admin yang dapat menghapus data ini.');
    } else {
      if (!monevBolehUbah_(user, r.Jenis, r.Induk)) throw new Error('Anda tidak berwenang menghapus data ini.');
      if ((r.Jenis === 'catatan' || r.Jenis === 'keterangan') && user.role !== 'admin' && String(r.DibuatOleh) !== user.username) throw new Error('Anda hanya dapat menghapus isian yang Anda buat sendiri.');
    }
    let hapus = [r];
    if (r.Jenis === 'sasaran') hapus = hapus.concat(semua.filter(x => x.Jenis === 'program' && String(x.Induk) === id));
    if (r.Jenis === 'ik') {
      hapus = hapus.concat(semua.filter(x => String(x.Induk) === id && x.Jenis !== 'ik'));
      const bukti = readTable_(SHEET.BUKTI).filter(b => String(b.IndikatorID) === 'MV:' + id);
      bukti.sort((a, b) => b._row - a._row).forEach(b => {
        sheetTulis_(SHEET.BUKTI).deleteRow(b._row);
        try { DriveApp.getFileById(String(b.FileId)).setTrashed(true); } catch (e) { /* sudah hilang */ }
      });
      bust_(SHEET.BUKTI);
    }
    hapus.sort((a, b) => b._row - a._row).forEach(x => sheetTulis_(SHEET.MONEV).deleteRow(x._row));
    bust_(SHEET.MONEV);
    catatLog_('monev', user.username, 'Hapus ' + r.Jenis + ' ' + id);
    return { dihapus: hapus.length };
  });
}

function monevIk_(id) {
  return readTable_(SHEET.MONEV).find(r => r.Jenis === 'ik' && String(r.ID) === String(id));
}

/** Unggah bukti dukung untuk satu IK Monev (opsional per triwulan). */
function apiUnggahBuktiMonev(token, p) {
  return run_(() => {
    const user = auth_(token, ['admin', 'pic']);
    p = p || {};
    const ik = monevIk_(p.ikId);
    if (!ik) throw new Error('Pilih indikator kinerja (IK) terlebih dahulu.');
    if (!monevBolehUbah_(user, 'bukti', ik.ID)) throw new Error('Anda bukan penanggung jawab IK ini.');
    const asli = String(p.nama || '').replace(/[\\\/]/g, '_').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120);
    const ext = (asli.split('.').length > 1 ? asli.split('.').pop() : '').toLowerCase();
    if (!ext || !BUKTI_TIPE[ext]) throw new Error('Jenis file tidak didukung. Pakai PDF, gambar (JPG, PNG, WebP), Word, Excel, PowerPoint, CSV, atau TXT.');
    const b64 = String(p.base64 || '');
    if (!b64 || b64.length > BUKTI_MAKS_BYTE * 1.4) throw new Error('File kosong atau lebih besar dari ' + (BUKTI_MAKS_BYTE / 1048576) + ' MB.');
    const bytes = Utilities.base64Decode(b64);
    if (!bytes.length) throw new Error('File kosong.');
    if (bytes.length > BUKTI_MAKS_BYTE) throw new Error('File lebih besar dari ' + (BUKTI_MAKS_BYTE / 1048576) + ' MB.');
    const kunci = 'MV:' + ik.ID;
    if (readTable_(SHEET.BUKTI).filter(r => String(r.IndikatorID) === kunci).length >= BUKTI_MAKS_PER_IND) throw new Error('Satu IK maksimal ' + BUKTI_MAKS_PER_IND + ' bukti. Hapus yang tidak terpakai.');
    const tw = MONEV_TW.indexOf(p.tw) >= 0 ? MONEV_TW.indexOf(p.tw) + 1 : 0;
    const tahun = Number(p.tahun) >= 2000 && Number(p.tahun) <= 2100 ? Number(p.tahun) : getConfig_().Tahun;
    const id = 'BK-' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 4);
    const file = folderBukti_().createFile(Utilities.newBlob(bytes, BUKTI_TIPE[ext], 'MONEV_' + ik.ID + '_' + id + '_' + asli));
    appendObj_(SHEET.BUKTI, { ID: id, IndikatorID: kunci, Tahun: tahun, Bulan: tw, NamaFile: asli, Tipe: ext, Ukuran: bytes.length, FileId: file.getId(), Catatan: bersih_(p.catatan, 300), DiunggahOleh: user.username, DiunggahPada: nowStr_() });
    catatLog_('bukti', user.username, 'Unggah bukti Monev ' + id + ' untuk ' + ik.ID);
    return { id: id };
  });
}

function apiUnduhBuktiMonev(token, id) {
  return run_(() => {
    auth_(token);
    const r = readTable_(SHEET.BUKTI).find(x => String(x.ID) === String(id) && String(x.IndikatorID).indexOf('MV:') === 0);
    if (!r) throw new Error('Bukti tidak ditemukan.');
    let blob;
    try { blob = DriveApp.getFileById(String(r.FileId)).getBlob(); } catch (e) { throw new Error('File bukti tidak ditemukan di Google Drive. Mungkin sudah dihapus dari folder.'); }
    return { nama: String(r.NamaFile), mime: BUKTI_TIPE[String(r.Tipe)] || 'application/octet-stream', base64: Utilities.base64Encode(blob.getBytes()) };
  });
}

function apiHapusBuktiMonev(token, id) {
  return run_(() => {
    const user = auth_(token, ['admin', 'pic']);
    const r = readTable_(SHEET.BUKTI).find(x => String(x.ID) === String(id) && String(x.IndikatorID).indexOf('MV:') === 0);
    if (!r) throw new Error('Bukti tidak ditemukan.');
    const boleh = user.role === 'admin' || (monevBolehUbah_(user, 'bukti', String(r.IndikatorID).slice(3)) && String(r.DiunggahOleh) === String(user.username));
    if (!boleh) throw new Error('Anda hanya dapat menghapus bukti yang Anda unggah sendiri.');
    sheetTulis_(SHEET.BUKTI).deleteRow(r._row);
    bust_(SHEET.BUKTI);
    try { DriveApp.getFileById(String(r.FileId)).setTrashed(true); } catch (e) { /* sudah hilang */ }
    catatLog_('bukti', user.username, 'Hapus bukti Monev ' + r.ID);
    return true;
  });
}

/* ---------------- Tarik / cetak data per bidang atau indikator ---------------- */

function csvSel_(v) {
  const t = String(v === null || v === undefined ? '' : v);
  return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}
function csvAngka_(v) {
  return v === null || v === undefined || v === '' ? '' : String(Math.round(Number(v) * 100) / 100).replace('.', ',');
}
function csvTarik_(m) {
  const SP = { lengkap: 'Lengkap', menunggu: 'Menunggu verifikasi', menunggak: 'Belum diisi', na: 'Belum jatuh tempo' };
  const baris = [['ID', 'Indikator', 'Bidang', 'Program', 'Jenis', 'Frekuensi', 'Satuan', 'Arah', 'Target'].concat(BULAN).concat(['Realisasi terakhir', 'Bulan terakhir', 'Capaian (%)', 'Kategori capaian', 'Status pengisian', 'PIC', 'Jumlah bukti'])];
  m.ind.forEach(i => {
    baris.push([i.id, i.nama, i.bidang, i.programNama, i.jenis, i.frek, i.satuan, i.arah, csvAngka_(i.target)]
      .concat(i.series.map(csvAngka_))
      .concat([csvAngka_(i.realisasi), i.realBulan ? BULAN[i.realBulan - 1] : '', csvAngka_(i.capaian), TIER_LABEL[i.tier] || '', SP[i.status] || '', i.picNama || i.pic || '', i.nBukti]));
  });
  return '﻿' + 'sep=;\r\n' + baris.map(r => r.map(csvSel_).join(';')).join('\r\n');
}

/** p: { tahun, bulan, bidang: [], indikator: [], format: 'pdf' | 'csv' } */
function apiTarikData(token, p) {
  return run_(() => {
    auth_(token, ['admin', 'pimpinan']);
    p = p || {};
    const bidangOk = readTable_(SHEET.BIDANG).map(b => String(b.Nama));
    const bd = (Array.isArray(p.bidang) ? p.bidang : []).map(String).filter(x => bidangOk.indexOf(x) >= 0);
    const ik = (Array.isArray(p.indikator) ? p.indikator : []).map(String).slice(0, 200);
    const m = hitungModel_(p.tahun, p.bulan, { bidang: bd, indikator: ik });
    if (!m.ind.length) throw new Error('Tidak ada indikator yang cocok dengan pilihan Anda.');
    const stamp = m.tahun + '-' + ('0' + m.bulan).slice(-2);
    if (p.format === 'csv') {
      return { nama: 'Data-Indikator-' + stamp + '.csv', mime: 'text/csv', jumlah: m.ind.length, base64: Utilities.base64Encode(Utilities.newBlob(csvTarik_(m), 'text/csv', 'x.csv').getBytes()) };
    }
    const blob = Utilities.newBlob(laporanPdfHtml_(m), 'text/html', 'laporan.html').getAs('application/pdf');
    return { nama: 'Data-Indikator-' + stamp + '.pdf', mime: 'application/pdf', jumlah: m.ind.length, base64: Utilities.base64Encode(blob.getBytes()) };
  });
}

/* ---------------- Setup & data contoh ---------------- */

/** Jalankan SEKALI dari editor Apps Script untuk membuat sheet dan data contoh. */
function setupAplikasi() {
  // Simpan ID spreadsheet agar web app (yang tidak punya "spreadsheet aktif") tetap bisa membukanya.
  const aktif = SpreadsheetApp.getActiveSpreadsheet();
  if (aktif) PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', aktif.getId());
  const ss = getSS_();
  Object.keys(HEADERS).forEach(n => bust_(n));
  Object.keys(HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold').setBackground('#e0f2fe');
      sh.setFrozenRows(1);
    }
    if (['Config', 'Bidang', 'Users', 'Masalah', 'PermintaanData', 'Log'].indexOf(name) >= 0) {
      sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), HEADERS[name].length).setNumberFormat('@');
    }
  });
  ['Sheet1', 'Lembar1'].forEach(n => {
    const d = ss.getSheetByName(n);
    if (d && d.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(d);
  });
  if (readTable_(SHEET.INDIKATOR).length === 0) seedData_();
  Object.keys(HEADERS).forEach(n => bust_(n));
  return 'Setup selesai. Akun awal: admin/admin123, pimpinan/pimpinan123, pic.<bidang>/pic123 — SEGERA ganti kata sandi.';
}

function seedData_() {
  const n = new Date();
  const tahun = Number(Utilities.formatDate(n, TZ, 'yyyy'));
  const bulan = Number(Utilities.formatDate(n, TZ, 'M'));
  const akhir = new Date(tahun, bulan, 0);
  appendRows_(SHEET.CONFIG, [
    ['Tahun', String(tahun)], ['BulanAktif', String(bulan)], ['Cutoff', Utilities.formatDate(akhir, TZ, 'yyyy-MM-dd')],
    ['NamaDinas', 'Dinas Kesehatan, Pengendalian Penduduk dan Keluarga Berencana Provinsi Sulawesi Barat'],
    ['Kabupaten', 'Majene,Mamasa,Mamuju,Mamuju Tengah,Pasangkayu,Polewali Mandar']
  ]);
  const bidang = [['Sekretariat', 'account_balance', 1], ['Kesprimkom', 'diversity_1', 2], ['P2KL', 'coronavirus', 3], ['Yankes', 'local_hospital', 4], ['Farmalkes', 'medication', 5], ['PP & KB', 'family_restroom', 6]];
  appendRows_(SHEET.BIDANG, bidang);
  const picDari = { 'Sekretariat': 'pic.sekretariat', 'Kesprimkom': 'pic.kesprimkom', 'P2KL': 'pic.p2kl', 'Yankes': 'pic.yankes', 'Farmalkes': 'pic.farmalkes', 'PP & KB': 'pic.ppkb' };
  const mk = (uname, nama, role, bd, pwd) => { const s = Utilities.getUuid(); return [uname, nama, role, bd, '', '', s, hash_(s, pwd), 'Ya', '', '']; };
  const users = [mk('admin', 'Administrator', 'admin', '', DEFAULT_PWD.admin), mk('pimpinan', 'Kepala Dinas', 'pimpinan', '', DEFAULT_PWD.pimpinan)];
  bidang.forEach(b => users.push(mk(picDari[b[0]], 'PIC ' + b[0], 'pic', b[0], DEFAULT_PWD.pic)));
  appendRows_(SHEET.USERS, users);

  // [ID, Nama, Bidang, Jenis, Frekuensi, Satuan, Target, Arah]
  const dat = [
    ['IK-001', 'Prevalensi Balita Stunting (e-PPGBM)', 'Kesprimkom', 'Kesehatan', 'Bulanan', '%', 14, 'Turun'],
    ['IK-002', 'Cakupan Kunjungan Ibu Hamil K6', 'Kesprimkom', 'SPM', 'Bulanan', '%', 85, 'Naik'],
    ['IK-003', 'Persalinan di Fasilitas Pelayanan Kesehatan', 'Kesprimkom', 'IKU', 'Bulanan', '%', 90, 'Naik'],
    ['IK-004', 'Cakupan Pelayanan Kesehatan Balita', 'Kesprimkom', 'SPM', 'Bulanan', '%', 90, 'Naik'],
    ['IK-005', 'Skrining Hipertensi Usia ≥ 15 Tahun', 'Kesprimkom', 'SPM', 'Bulanan', '%', 80, 'Naik'],
    ['IK-006', 'Treatment Coverage Tuberkulosis (TBC)', 'P2KL', 'IKU', 'Bulanan', '%', 90, 'Naik'],
    ['IK-007', 'Cakupan Imunisasi Dasar Lengkap (IDL) Bayi', 'P2KL', 'IKU', 'Bulanan', '%', 90, 'Naik'],
    ['IK-008', 'Penemuan Kasus Diare pada Balita', 'P2KL', 'Kesehatan', 'Bulanan', '%', 80, 'Naik'],
    ['IK-009', 'Skrining HIV pada Ibu Hamil', 'P2KL', 'SPM', 'Triwulan', '%', 95, 'Naik'],
    ['IK-010', 'Desa/Kelurahan Stop Buang Air Besar Sembarangan', 'P2KL', 'Kesehatan', 'Semester', '%', 70, 'Naik'],
    ['IK-011', 'Puskesmas Terakreditasi Paripurna/Utama', 'Yankes', 'IKU', 'Triwulan', '%', 75, 'Naik'],
    ['IK-012', 'Rumah Sakit Terakreditasi', 'Yankes', 'Kesehatan', 'Semester', '%', 100, 'Naik'],
    ['IK-013', 'Ketersediaan Dokter Spesialis Dasar di RSUD', 'Yankes', 'Kesehatan', 'Triwulan', '%', 85, 'Naik'],
    ['IK-014', 'Puskesmas dengan Tenaga Kesehatan Lengkap', 'Yankes', 'Kesehatan', 'Tahunan', '%', 70, 'Naik'],
    ['IK-015', 'Ketersediaan Obat Esensial di Puskesmas', 'Farmalkes', 'SPM', 'Bulanan', '%', 90, 'Naik'],
    ['IK-016', 'Ketersediaan Vaksin di Puskesmas', 'Farmalkes', 'Kesehatan', 'Bulanan', '%', 90, 'Naik'],
    ['IK-017', 'Fasyankes dengan Alat Kesehatan Sesuai Standar', 'Farmalkes', 'Kesehatan', 'Semester', '%', 75, 'Naik'],
    ['IK-018', 'Modern Contraceptive Prevalence Rate (mCPR)', 'PP & KB', 'IKU', 'Bulanan', '%', 62, 'Naik'],
    ['IK-019', 'Kebutuhan Ber-KB Belum Terpenuhi (Unmet Need)', 'PP & KB', 'Kesehatan', 'Bulanan', '%', 10, 'Turun'],
    ['IK-020', 'Angka Kelahiran Remaja (ASFR 15–19)', 'PP & KB', 'Kesehatan', 'Tahunan', 'per 1.000', 36, 'Turun'],
    ['IK-021', 'Akseptor KB Aktif Metode Jangka Panjang', 'PP & KB', 'Kesehatan', 'Bulanan', '%', 25, 'Naik'],
    ['IK-022', 'Pelayanan KB Pascapersalinan', 'PP & KB', 'SPM', 'Bulanan', '%', 70, 'Naik'],
    ['IK-023', 'Realisasi Serapan Anggaran', 'Sekretariat', 'IKU', 'Bulanan', '%', 90, 'Naik'],
    ['IK-024', 'Laporan Keuangan dan Aset Tepat Waktu', 'Sekretariat', 'Kesehatan', 'Bulanan', '%', 100, 'Naik'],
    ['IK-025', 'Nilai SAKIP Perangkat Daerah', 'Sekretariat', 'IKU', 'Tahunan', 'poin', 75, 'Naik']
  ];
  appendRows_(SHEET.INDIKATOR, dat.map(d => [d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], picDari[d[2]], 'Ya', '']));

  let s = 42;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const kabAll = ['Majene', 'Mamasa', 'Mamuju', 'Mamuju Tengah', 'Pasangkayu', 'Polewali Mandar'];
  const isian = [];
  const stamp = Utilities.formatDate(n, TZ, 'yyyy-MM-dd HH:mm');
  dat.forEach(d => {
    const due = dueMonths_(d[4]).filter(b => b <= bulan);
    due.forEach(b => {
      const turun = d[7] === 'Turun';
      const f = turun ? 0.85 + rnd() * 0.55 : 0.72 + rnd() * 0.4;
      const val = Math.round(d[6] * f * 10) / 10;
      let status = 'Lengkap', kab = '', v = val;
      if (b === bulan) {
        const r = rnd();
        if (r < 0.22) { status = 'Belum'; v = ''; kab = kabAll.filter(() => rnd() < 0.35).join(', '); }
        else if (r < 0.32) status = 'Menunggu Verifikasi';
      }
      isian.push([d[0], tahun, b, v, status, kab, '', 'PIC ' + d[2], stamp]);
    });
  });
  appendRows_(SHEET.ISIAN, isian);

  appendRows_(SHEET.MASALAH, [
    ['MS-SEED-1', stamp, 'IK-007', 'P2KL', 'Distribusi vaksin ke puskesmas pembantu di wilayah pegunungan terhambat cuaca dan kendala rantai dingin.', 'Optimalkan buffer stock di gudang provinsi dan koordinasikan armada cold-chain khusus bersama bidang terkait.', 'Tinggi', 'Terbuka', 'PIC P2KL', '', 'Administrator'],
    ['MS-SEED-2', stamp, 'IK-018', 'PP & KB', 'Pencatatan pelayanan KB dari fasilitas swasta belum terintegrasi ke sistem pelaporan.', 'Susun kesepakatan pelaporan dengan fasilitas swasta dan jadwalkan pendampingan input data.', 'Sedang', 'Proses', 'PIC PP & KB', '', 'Administrator']
  ]);
  appendRows_(SHEET.PERMINTAAN, [['PD-SEED-1', stamp, 'Bappeda Provinsi', 'Bappeda', 'Rekap capaian indikator SPM semester berjalan untuk bahan musrenbang.', 'Excel', '', 'Baru', '']]);
  catatLog_('setup', 'sistem', 'Data contoh dibuat');
}

/** Opsional: simpan ID spreadsheet bila skrip tidak terikat (standalone). */
function setSpreadsheetId(id) {
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
}

/** Diagnostik: jalankan dari editor untuk memeriksa pemasangan. Lihat hasilnya di Execution log. */
function cekInstalasi() {
  const hasil = [];
  hasil.push('getPageContent (Halaman.gs): ' + (typeof getPageContent === 'function' ? 'ADA' : 'TIDAK ADA -> tempel file Halaman.gs'));
  ['Index', 'Stylesheet', 'JavaScript'].forEach(n => {
    try { HtmlService.createHtmlOutputFromFile(n); hasil.push('File HTML ' + n + ': ADA'); }
    catch (e) { hasil.push('File HTML ' + n + ': TIDAK ADA -> buat file HTML bernama ' + n); }
  });
  try {
    const ss = getSS_();
    Object.keys(HEADERS).forEach(n => hasil.push('Sheet ' + n + ': ' + (ss.getSheetByName(n) ? 'ADA' : 'TIDAK ADA -> jalankan setupAplikasi')));
  } catch (e) { hasil.push('Spreadsheet: ' + e.message); }
  const teks = hasil.join('\n');
  Logger.log(teks);
  return teks;
}
