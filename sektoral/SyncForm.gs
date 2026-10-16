/**
 * SYNC FORM — ETL mini untuk spreadsheet "Data Sektoral DKPPKB".
 * Tempel seluruh isi file ini ke Apps Script spreadsheet tersebut (Ekstensi > Apps Script),
 * Simpan, lalu jalankan sekali fungsi `pasangPemicu` (menu "Sync Form" > "Pasang pemicu otomatis").
 *
 * Alur:  EXTRACT  baca sheet tabel 2.1, 2.2, ... (judul, header bertingkat, baris kabupaten) dan "Reviu Daftar Data"
 *        TRANSFORM rapikan tanggal (YYYY-MM-DD), spasi, angka (1.234 -> 1234), salah ketik (mis. "Tatap" -> "Tetap"),
 *                  lalu ubah tabel lebar menjadi baris panjang (unpivot)
 *        LOAD     tulis ke sheet `db_clean` (data tabel), `db_katalog` (daftar data), `db_log` (riwayat)
 *
 * Sheet sumber TIDAK diubah. Semua keluaran ada di sheet berawalan "db_".
 */

const SF = {
  OUT_DATA: 'db_clean',
  OUT_KATALOG: 'db_katalog',
  OUT_LOG: 'db_log',
  SHEET_KATALOG: 'Reviu Daftar Data',
  TABEL_RE: /^\d+\.\d+$/,            // nama sheet tabel: 2.1, 2.2, ...
  LOG_MAKS: 500,
  HEAD_DATA: ['kode_tabel', 'nama_data', 'kabupaten', 'tahun', 'kategori', 'nilai', 'catatan', 'diperbarui'],
  HEAD_KATALOG: ['no', 'nama_data_eksisting', 'nama_data_reviu', 'jadwal_pemutakhiran', 'jadwal_rilis', 'id_prioritas', 'hak_akses', 'sumber_referensi', 'tagging_arsitektur', 'status_reviu', 'catatan', 'produsen', 'diperbarui'],
  HEAD_LOG: ['waktu', 'aksi', 'sheet', 'baris', 'keterangan'],
  KAB: ['Majene', 'Polewali Mandar', 'Mamasa', 'Mamuju', 'Pasangkayu', 'Mamuju Tengah', 'Sulawesi Barat'],
  STATUS: ['Tetap', 'Ditambah', 'Diperbaiki', 'Dihapus'],
  JADWAL: ['Bulanan', 'Triwulan', 'Semester', 'Tahunan'],
  AKSES: ['Terbuka', 'Terbatas', 'Tertutup'],
  BULAN: ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember']
};

/* ============ TRANSFORM: fungsi murni (mudah diuji) ============ */

/** Rapikan teks: ganti NBSP/tab/baris baru, pangkas, satukan spasi ganda. */
function sfTeks_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return sfTanggal_(v);
  return String(v).replace(/[   ]/g, ' ').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Tanggal -> YYYY-MM-DD. Menerima Date, dd/mm/yyyy, dd-mm-yyyy, yyyy/mm/dd, "5 Maret 2025". Selain itu dikembalikan apa adanya. */
function sfTanggal_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    const p = n => (n < 10 ? '0' : '') + n;
    return v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate());
  }
  const s = String(v === null || v === undefined ? '' : v).trim();
  let m = /^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/.exec(s);
  let d, mo, y;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
  else if ((m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(s))) { const k = SF.BULAN.indexOf(m[2].toLowerCase()); if (k < 0) return s; d = +m[1]; mo = k + 1; y = +m[3]; }
  else return s;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return s;
  const p2 = n => (n < 10 ? '0' : '') + n;
  return y + '-' + p2(mo) + '-' + p2(d);
}
function sfPunyaTanggal_(s) { return /^(\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})$/.test(String(s).trim()); }

/** Jarak edit (Levenshtein) untuk memperbaiki salah ketik. */
function sfJarak_(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const d = [];
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Cocokkan teks ke daftar baku. Mengembalikan {nilai, diperbaiki}. Tidak dikenal -> nilai asli. */
function sfBaku_(teks, daftar, maks) {
  const t = sfTeks_(teks);
  if (!t) return { nilai: '', diperbaiki: false };
  const lo = t.toLowerCase();
  for (let i = 0; i < daftar.length; i++) if (daftar[i].toLowerCase() === lo) return { nilai: daftar[i], diperbaiki: daftar[i] !== t };
  let best = null, bd = 99;
  daftar.forEach(x => { const j = sfJarak_(t, x); if (j < bd) { bd = j; best = x; } });
  if (best && bd <= (maks === undefined ? 2 : maks) && t.length >= 4) return { nilai: best, diperbaiki: true };
  return { nilai: t, diperbaiki: false, tidakDikenal: true };
}

/** Angka gaya Indonesia: "1.689" -> 1689, "12,5" -> 12.5, " 3 " -> 3. desimal=true: titik dianggap pemisah desimal. Bukan angka -> null. */
function sfAngka_(v, desimal) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = sfTeks_(v).replace(/\s/g, '').replace(/\*+$/, '').replace(/%$/, '');
  if (!s || s === '-' || s === '–' || s === '—') return null;
  let n;
  if (!desimal && /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) n = Number(s.replace(/\./g, '').replace(',', '.'));
  else if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) n = Number(s.replace(/\./g, '').replace(',', '.'));
  else if (/^-?\d+,\d+$/.test(s)) n = Number(s.replace(',', '.'));
  else if (/^-?\d+(\.\d+)?$/.test(s)) n = Number(s);
  else return null;
  return isFinite(n) ? n : null;
}

function sfKabupaten_(v) {
  const t = sfTeks_(v);
  if (!t) return '';
  if (/sulawesi\s*barat|provinsi|^total$|^jumlah$/i.test(t)) return 'Sulawesi Barat';
  const r = sfBaku_(t, SF.KAB, 2);
  return r.nilai;
}

/** Buang rentang tahun di ujung judul: "Jumlah RS ... Sulawesi Barat, 2020-2024" -> "Jumlah RS ... Sulawesi Barat". */
function sfJudulBersih_(t) {
  return sfTeks_(t).replace(/\s*[,(]?\s*\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\s*\)?\s*$/, '').replace(/\s*,\s*(19|20)\d{2}\s*$/, '').replace(/\s*,\s*$/, '').trim();
}

/**
 * EXTRACT + TRANSFORM satu sheet tabel.
 * values: array 2 dimensi (getValues). Mengembalikan {kode, nama, baris:[[kode,nama,kab,tahun,kategori,nilai,catatan]], peringatan:[]}.
 * Hanya blok tabel PERTAMA yang dibaca (blok kedua pada sheet adalah salinan revisi).
 */
function sfParseTabel_(values, namaSheet) {
  const out = { kode: namaSheet, nama: '', baris: [], peringatan: [] };
  const R = values.map(r => r.map(c => c));
  const s = (r, c) => sfTeks_((R[r] || [])[c]);
  let iJudul = -1;
  for (let i = 0; i < R.length; i++) if (s(i, 0).toLowerCase() === 'tabel') { iJudul = i; break; }
  if (iJudul >= 0) { out.kode = s(iJudul, 1) || namaSheet; out.nama = sfJudulBersih_(s(iJudul, 2)); }
  else out.peringatan.push('Baris judul "Tabel" tidak ditemukan');
  let iHead = -1;
  for (let i = Math.max(iJudul, 0); i < R.length; i++) if (s(i, 0).toLowerCase() === 'no') { iHead = i; break; }
  if (iHead < 0) { out.peringatan.push('Header "No" tidak ditemukan'); return out; }
  let iNo = -1;
  for (let i = iHead + 1; i < Math.min(R.length, iHead + 8); i++) {
    if (s(i, 0) === '1' && s(i, 1) === '2') { iNo = i; break; }
  }
  if (iNo < 0) { out.peringatan.push('Baris penomoran kolom (1,2,3...) tidak ditemukan, sheet dilewati'); return out; }

  // kolom label = kolom sebelum kolom data pertama. Kolom data pertama = kolom pertama pada baris penomoran bernilai >= 3
  let c0 = 2;
  for (let c = 0; c < (R[iNo] || []).length; c++) { const n = Number(s(iNo, c)); if (n >= 3) { c0 = c; break; } }
  let lebar = 0;
  for (let i = iHead; i <= iNo; i++) lebar = Math.max(lebar, (R[i] || []).length);

  // header bertingkat: isi ke kanan (sel gabungan) pada baris atas, lalu ambil bagian tahun & kategori tiap kolom
  const kol = [];
  const baris = [];
  for (let i = iHead; i < iNo; i++) {
    const row = [];
    let last = '';
    for (let c = 0; c < lebar; c++) {
      const t = s(i, c);
      if (c < c0) { row.push(''); continue; }
      if (t) last = t;
      row.push(i < iNo - 1 ? last : t);          // sel gabungan diisi ke kanan hanya pada baris atas; baris paling bawah apa adanya
    }
    baris.push(row);
  }
  for (let c = c0; c < lebar; c++) {
    let tahun = '';
    const bag = [];
    baris.forEach(row => {
      const t = row[c];
      if (!t) return;
      const my = /^(?:\D*)((?:19|20)\d{2})\D*$/.exec(t);
      if (my && !tahun) { tahun = my[1]; return; }
      if (/^tahun$/i.test(t)) return;
      if (bag.indexOf(t) < 0) bag.push(t);
    });
    // header satu baris yang berisi tahun saja: sudah masuk "tahun"
    kol.push({ c: c, tahun: tahun, kategori: bag.join(' · ') || 'Total' });
  }

  let nBaris = 0;
  for (let i = iNo + 1; i < R.length; i++) {
    const a = s(i, 0);
    if (/^sumber/i.test(a)) break;
    const kosong = (R[i] || []).every(x => sfTeks_(x) === '');
    if (kosong) break;
    let label = sfTeks_((R[i] || [])[1]);
    if (!label && a && !/^\d+$/.test(a)) label = a;          // baris total ditulis di kolom A ("Sulawesi Barat")
    if (!label) continue;
    const kab = sfKabupaten_(label);
    nBaris++;
    kol.forEach(k => {
      const mentah = (R[i] || [])[k.c];
      const teks = sfTeks_(mentah);
      if (teks === '') return;
      const desimal = /persen|rasio|angka|%|rate|prevalens|insiden|proporsi/i.test(k.kategori);
      const n = sfAngka_(mentah, desimal);
      if (n === null) {
        if (/^[-–—]+$/.test(teks)) return;
        out.baris.push([out.kode, out.nama, kab, k.tahun, k.kategori, '', 'Teks asli: ' + teks]);
        return;
      }
      out.baris.push([out.kode, out.nama, kab, k.tahun, k.kategori, n, '']);
    });
  }
  if (!nBaris) out.peringatan.push('Tidak ada baris data (kabupaten) di bawah header');
  return out;
}

/** EXTRACT + TRANSFORM "Reviu Daftar Data" -> baris katalog. */
function sfParseKatalog_(values) {
  const R = values;
  const s = (r, c) => sfTeks_((R[r] || [])[c]);
  const out = { baris: [], peringatan: [], diperbaiki: 0 };
  let iH = -1;
  for (let i = 0; i < R.length; i++) {
    const baris = (R[i] || []).map(sfTeks_).join('|').toLowerCase();
    if (/nama data/.test(baris) && /status reviu/.test(baris)) { iH = i; break; }
  }
  if (iH < 0) { out.peringatan.push('Header katalog (Nama Data / Status Reviu) tidak ditemukan'); return out; }
  const idx = {};
  const pola = { produsen: /produsen/i, no: /^no\.?$/i, eksisting: /eksisting/i, reviu: /hasil reviu/i, jadwal: /pemutakhiran/i, rilis: /rilis/i, idp: /^id\b/i, akses: /akses/i, sumber: /sumber/i, tagging: /tagging/i, status: /status reviu/i, catatan: /catatan/i };
  (R[iH] || []).forEach((h, c) => { const t = sfTeks_(h); Object.keys(pola).forEach(k => { if (idx[k] === undefined && pola[k].test(t)) idx[k] = c; }); });
  const g = (r, k) => (idx[k] === undefined ? '' : (R[r] || [])[idx[k]]);
  let produsen = '', no = '', eks = '';
  for (let i = iH + 1; i < R.length; i++) {
    const sel = (R[i] || []).map(sfTeks_).filter(Boolean);
    if (!sel.length) continue;
    if (sel.length >= 5 && sel.every(x => /^\d{1,2}$/.test(x))) continue;       // baris penomoran kolom
    const p = sfTeks_(g(i, 'produsen')); if (p) produsen = p;
    const n = sfTeks_(g(i, 'no')); if (n) { no = n; eks = ''; }
    const e = sfTeks_(g(i, 'eksisting')); if (e) eks = e;
    const reviu = sfTeks_(g(i, 'reviu'));
    if (!eks && !reviu) continue;
    const j = sfBaku_(g(i, 'jadwal'), SF.JADWAL, 2), st = sfBaku_(g(i, 'status'), SF.STATUS, 2), ak = sfBaku_(g(i, 'akses'), SF.AKSES, 2);
    [j, st, ak].forEach(x => { if (x.diperbaiki) out.diperbaiki++; });
    const rilis = sfTanggal_(g(i, 'rilis'));
    out.baris.push([no, eks, reviu || eks, j.nilai, rilis, sfTeks_(g(i, 'idp')), ak.nilai, sfTeks_(g(i, 'sumber')), sfTeks_(g(i, 'tagging')), st.nilai, sfTeks_(g(i, 'catatan')), produsen]);
    if (st.tidakDikenal) out.peringatan.push('Status reviu tidak dikenal pada no. ' + no + ': "' + st.nilai + '"');
  }
  return out;
}

/* ============ LOAD: akses spreadsheet ============ */

function sfSheetData_(ss, nama, header) {
  let sh = ss.getSheetByName(nama);
  if (!sh) sh = ss.insertSheet(nama);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#e0f2fe');
    sh.setFrozenRows(1);
  }
  return sh;
}
function sfStempel_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss'); }

function sfLog_(ss, aksi, sheet, baris, ket) {
  try {
    const sh = sfSheetData_(ss, SF.OUT_LOG, SF.HEAD_LOG);
    sh.appendRow([sfStempel_(), aksi, sheet || '', baris === undefined ? '' : baris, ket || '']);
    const n = sh.getLastRow();
    if (n > SF.LOG_MAKS + 1) sh.deleteRows(2, n - SF.LOG_MAKS - 1);
  } catch (e) { /* log tidak boleh menggagalkan sinkron */ }
}

function sfDaftarTabel_(ss) { return ss.getSheets().map(s => s.getName()).filter(n => SF.TABEL_RE.test(n)); }

function sfTulisKatalog_(ss) {
  const sh = ss.getSheetByName(SF.SHEET_KATALOG);
  if (!sh) { sfLog_(ss, 'PERINGATAN', SF.SHEET_KATALOG, 0, 'Sheet katalog tidak ditemukan'); return 0; }
  const hasil = sfParseKatalog_(sh.getDataRange().getValues());
  const out = sfSheetData_(ss, SF.OUT_KATALOG, SF.HEAD_KATALOG);
  if (out.getLastRow() > 1) out.getRange(2, 1, out.getLastRow() - 1, SF.HEAD_KATALOG.length).clearContent();
  const st = sfStempel_();
  if (hasil.baris.length) out.getRange(2, 1, hasil.baris.length, SF.HEAD_KATALOG.length).setValues(hasil.baris.map(r => r.concat([st])));
  sfLog_(ss, 'KATALOG', SF.SHEET_KATALOG, hasil.baris.length, hasil.diperbaiki + ' isian dibakukan' + (hasil.peringatan.length ? '; ' + hasil.peringatan.join('; ') : ''));
  return hasil.baris.length;
}

/** Hitung sidik jari isi sheet agar hanya sheet yang berubah yang diproses ulang. */
function sfSidik_(values) {
  const raw = JSON.stringify(values);
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);
  return b.map(x => ((x < 0 ? x + 256 : x) + 256).toString(16).slice(1)).join('');
}

/**
 * Sinkron data tabel. nama = nama sheet tertentu, atau kosong = semua sheet tabel.
 * semua=true memaksa memproses ulang walau isi tidak berubah.
 */
function sfSinkronTabel_(ss, nama, semua) {
  const props = PropertiesService.getScriptProperties();
  const sheets = nama ? [nama] : sfDaftarTabel_(ss);
  const out = sfSheetData_(ss, SF.OUT_DATA, SF.HEAD_DATA);
  const nCols = SF.HEAD_DATA.length;
  const st = sfStempel_();
  let lama = out.getLastRow() > 1 ? out.getRange(2, 1, out.getLastRow() - 1, nCols).getValues() : [];
  let diproses = 0, baris = 0, dilewati = 0;
  const kodeUbah = {}, baru = [];
  sheets.forEach(n => {
    const sh = ss.getSheetByName(n);
    if (!sh) return;
    const vals = sh.getDataRange().getValues();
    const h = sfSidik_(vals);
    if (!semua && props.getProperty('h_' + n) === h) { dilewati++; return; }
    const r = sfParseTabel_(vals, n);
    kodeUbah[r.kode] = true; kodeUbah['@' + n] = true;
    r.baris.forEach(b => baru.push(b.concat([st])));
    props.setProperty('h_' + n, h);
    diproses++; baris += r.baris.length;
    sfLog_(ss, 'TABEL', n, r.baris.length, r.peringatan.length ? r.peringatan.join('; ') : 'OK');
  });
  if (!diproses) return { diproses: 0, dilewati: dilewati, baris: 0 };
  if (!nama && semua) lama = [];                       // bangun ulang total
  else lama = lama.filter(r => !kodeUbah[String(r[0])]);
  const gabung = lama.concat(baru);
  if (out.getLastRow() > 1) out.getRange(2, 1, out.getLastRow() - 1, nCols).clearContent();
  if (gabung.length) out.getRange(2, 1, gabung.length, nCols).setValues(gabung);
  return { diproses: diproses, dilewati: dilewati, baris: baris, total: gabung.length };
}

/* ============ Titik masuk (menu, pemicu) ============ */

/** Bangun ulang SEMUA keluaran dari nol. */
function sinkronSemua() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { sfLog_(ss, 'LEWAT', '', 0, 'Sinkron lain sedang berjalan'); return; }
  try {
    const t = sfSinkronTabel_(ss, '', true);
    const k = sfTulisKatalog_(ss);
    sfLog_(ss, 'SEMUA', '', t.baris, t.diproses + ' tabel, ' + k + ' baris katalog');
    try { SpreadsheetApp.getActive().toast(t.diproses + ' tabel dan ' + k + ' baris katalog disinkronkan.', 'Sync Form', 6); } catch (e) { /* tanpa UI */ }
  } finally { lock.releaseLock(); }
}

/** Hanya sheet yang isinya berubah sejak sinkron terakhir (dipakai pemicu perubahan dan harian). */
function sinkronPerubahan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const t = sfSinkronTabel_(ss, '', false);
    const k = sfCekKatalog_(ss);
    if (t.diproses || k) sfLog_(ss, 'OTOMATIS', '', t.baris, t.diproses + ' tabel berubah' + (k ? ', katalog diperbarui' : ''));
  } finally { lock.releaseLock(); }
}
function sfCekKatalog_(ss) {
  const sh = ss.getSheetByName(SF.SHEET_KATALOG);
  if (!sh) return false;
  const props = PropertiesService.getScriptProperties();
  const h = sfSidik_(sh.getDataRange().getValues());
  if (props.getProperty('h_katalog') === h) return false;
  sfTulisKatalog_(ss);
  props.setProperty('h_katalog', h);
  return true;
}

/** Pemicu "saat diedit": hanya memproses sheet yang diedit. */
function pemicuEdit(e) {
  try {
    if (!e || !e.range) return;
    const ss = e.source || SpreadsheetApp.getActiveSpreadsheet();
    const n = e.range.getSheet().getName();
    if (n.indexOf('db_') === 0) return;
    if (SF.TABEL_RE.test(n)) {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(15000)) return;
      try { const t = sfSinkronTabel_(ss, n, false); if (t.diproses) sfLog_(ss, 'EDIT', n, t.baris, 'Disinkronkan otomatis'); } finally { lock.releaseLock(); }
    } else if (n === SF.SHEET_KATALOG) {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(15000)) return;
      try { sfCekKatalog_(ss); } finally { lock.releaseLock(); }
    }
  } catch (err) {
    try { sfLog_(SpreadsheetApp.getActiveSpreadsheet(), 'ERROR', '', 0, String(err && err.message || err)); } catch (e2) { /* diam */ }
  }
}
/** Pemicu "saat struktur berubah" (baris/kolom ditambah, sheet baru). */
function pemicuUbah(e) {
  try {
    if (e && e.changeType && ['EDIT', 'OTHER', 'FORMAT'].indexOf(e.changeType) >= 0) return;   // EDIT ditangani pemicuEdit
    sinkronPerubahan();
  } catch (err) {
    try { sfLog_(SpreadsheetApp.getActiveSpreadsheet(), 'ERROR', '', 0, String(err && err.message || err)); } catch (e2) { /* diam */ }
  }
}

/** Pasang pemicu otomatis (jalankan sekali). Aman dijalankan ulang: pemicu lama dibersihkan dulu. */
function pasangPemicu() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  hapusPemicu(true);
  ScriptApp.newTrigger('pemicuEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('pemicuUbah').forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger('sinkronPerubahan').timeBased().everyDays(1).atHour(2).create();
  sfLog_(ss, 'PEMICU', '', 3, 'Pemicu otomatis dipasang (edit, perubahan struktur, harian 02.00)');
  try { SpreadsheetApp.getActive().toast('Pemicu otomatis dipasang.', 'Sync Form', 5); } catch (e) { /* tanpa UI */ }
}
function hapusPemicu(diam) {
  const daftar = ['pemicuEdit', 'pemicuUbah', 'sinkronPerubahan'];
  ScriptApp.getProjectTriggers().forEach(t => { if (daftar.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  if (!diam) { try { SpreadsheetApp.getActive().toast('Pemicu otomatis dihapus.', 'Sync Form', 5); } catch (e) { /* tanpa UI */ } }
}
function sinkronSheetIni() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const n = ss.getActiveSheet().getName();
  if (SF.TABEL_RE.test(n)) {
    const t = sfSinkronTabel_(ss, n, true);
    sfLog_(ss, 'MANUAL', n, t.baris, 'Sinkron sheet aktif');
    SpreadsheetApp.getActive().toast('Sheet ' + n + ': ' + t.baris + ' baris.', 'Sync Form', 5);
  } else if (n === SF.SHEET_KATALOG) { sfTulisKatalog_(ss); SpreadsheetApp.getActive().toast('Katalog disinkronkan.', 'Sync Form', 5); }
  else SpreadsheetApp.getActive().toast('Sheet "' + n + '" bukan sheet tabel (2.1, 2.2, ...) atau katalog.', 'Sync Form', 6);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Sync Form')
    .addItem('Sinkronkan semua sekarang', 'sinkronSemua')
    .addItem('Sinkronkan sheet yang sedang dibuka', 'sinkronSheetIni')
    .addSeparator()
    .addItem('Pasang pemicu otomatis', 'pasangPemicu')
    .addItem('Hapus pemicu otomatis', 'hapusPemicu')
    .addToUi();
}
