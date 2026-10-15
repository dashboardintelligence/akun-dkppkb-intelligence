/**
 * ============================================================
 * Halaman.gs — Pembangun HTML tiap halaman (dirender di server).
 * getPageContent(token, page, params) -> {success, html, title, redirect, message}
 * Semua teks dari data DIESCAPE lewat esc_().
 * ============================================================
 */

/* ---------------- Util tampilan ---------------- */

function esc_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function num_(n, d) {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
  d = d === undefined ? 1 : d;
  const k = Math.pow(10, d);
  return String(Math.round(Number(n) * k) / k).replace('.', ',');
}
function pct_(n) { return n === null || n === undefined ? '—' : num_(n, 1) + '%'; }
function val_(v, satuan) {
  if (v === null || v === undefined) return '—';
  return num_(v, 1) + (satuan === '%' ? '%' : (satuan ? ' ' + satuan : ''));
}
function ic_(name, cls) { return '<span class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + esc_(name) + '</span>'; }
function tglId_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  return Number(m[3]) + ' ' + BULAN_S[Number(m[2]) - 1] + ' ' + m[1] + (String(s).length > 10 ? ' · ' + String(s).slice(11, 16) : '');
}
function waLink_(telp) {
  let d = String(telp || '').replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.charAt(0) === '0') d = '62' + d.slice(1);
  return 'https://wa.me/' + d;
}

const TIER_LABEL = { tercapai: 'Tercapai', waspada: 'Waspada', kritis: 'Kritis', belum: 'Belum ada data' };
const TIER_CLS = { tercapai: 'ok', waspada: 'warn', kritis: 'crit', belum: 'mute' };
const STAT_LABEL = { lengkap: 'Lengkap', menunggu: 'Menunggu verifikasi', menunggak: 'Tertunggak', na: 'Tidak wajib' };
const STAT_CLS = { lengkap: 'ok', menunggu: 'info', menunggak: 'crit', na: 'mute' };

function chip_(cls, text, pip) {
  return '<span class="chip chip-' + cls + '">' + (pip ? '<i class="pip"></i>' : '') + esc_(text) + '</span>';
}
function tierChip_(t) { return chip_(TIER_CLS[t], TIER_LABEL[t], t === 'tercapai'); }
function bar_(pct, tier) {
  const w = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const c = tier ? TIER_CLS[tier] : (pct !== null && pct >= 100 ? 'ok' : (pct !== null && pct >= 80 ? 'warn' : 'crit'));
  return '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + num_(w, 0) + '"><i class="b-' + c + '" style="width:' + w + '%"></i></div>';
}
function pageHead_(judul, sub, aksi) {
  return '<div class="page-head"><div><h1 class="h1">' + esc_(judul) + '</h1>' + (sub ? '<p class="muted">' + esc_(sub) + '</p>' : '') + '</div>' + (aksi ? '<div class="page-actions">' + aksi + '</div>' : '') + '</div>';
}
function kosong_(teks, ikon) {
  return '<div class="empty">' + ic_(ikon || 'inbox') + '<p>' + esc_(teks) + '</p></div>';
}
function field_(label, name, type, value, extra) {
  extra = extra || '';
  const id = 'f_' + name + '_' + Math.floor(Math.random() * 1e6);
  if (type === 'textarea') return '<div class="field"><label for="' + id + '">' + esc_(label) + '</label><textarea class="input input-area" id="' + id + '" name="' + name + '" ' + extra + '>' + esc_(value) + '</textarea></div>';
  return '<div class="field"><label for="' + id + '">' + esc_(label) + '</label><input class="input" id="' + id + '" name="' + name + '" type="' + type + '" value="' + esc_(value) + '" ' + extra + '></div>';
}
function select_(label, name, opts, value, extra) {
  const id = 'f_' + name + '_' + Math.floor(Math.random() * 1e6);
  return '<div class="field"><label for="' + id + '">' + esc_(label) + '</label><select class="input" id="' + id + '" name="' + name + '" ' + (extra || '') + '>' +
    opts.map(o => { const v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o; return '<option value="' + esc_(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc_(t) + '</option>'; }).join('') + '</select></div>';
}
function filterSel_(label, key, opts, value) {
  return '<label class="fsel"><span class="sr">' + esc_(label) + '</span><select class="input input-sm f-param" data-param="' + key + '" aria-label="' + esc_(label) + '">' +
    opts.map(o => '<option value="' + esc_(o.v) + '"' + (String(o.v) === String(value || '') ? ' selected' : '') + '>' + esc_(o.t) + '</option>').join('') + '</select></label>';
}

function bisaIsi_(user, i) {
  if (user.role === 'admin') return true;
  if (user.role !== 'pic') return false;
  if (i.pic === user.username) return true;
  const ik = (MODEL_IK_ || {})[user.username];
  if (ik && ik.length) return ik.indexOf(i.id) >= 0;      // PIC dengan daftar indikator: hanya yang ditugaskan
  if (user.program) return i.program === user.program;   // PIC Program: hanya indikator programnya
  return i.bidang === user.bidang;                        // PIC Bidang: seluruh indikator bidangnya
}

function isianMap_(tahun) {
  const mp = {};
  readTable_(SHEET.ISIAN).forEach(r => { if (Number(r.Tahun) === tahun) mp[r.IndikatorID + '|' + Number(r.Bulan)] = r; });
  return mp;
}
function isiAttr_(i, b, ctx) {
  const r = ctx.isian[i.id + '|' + b] || {};
  const v = i.series[b - 1];
  return 'data-act="isian" data-id="' + esc_(i.id) + '" data-bulan="' + b + '" data-nama="' + esc_(i.nama) + '" data-satuan="' + esc_(i.satuan) +
    '" data-real="' + esc_(v === null || v === undefined ? '' : v) + '" data-kab="' + esc_(r.KabTertunda || '') + '" data-cat="' + esc_(r.Catatan || '') + '"';
}

/* ---------------- Grafik SVG ---------------- */

function trend_(ind, besar) {
  const W = 560, H = besar ? 210 : 40, pl = besar ? 38 : 2, pr = 8, pt = besar ? 12 : 4, pb = besar ? 24 : 4;
  const nilai = ind.series.filter(v => v !== null);
  const mx = (Math.max(ind.target, nilai.length ? Math.max.apply(null, nilai) : 0) * 1.18) || 1;
  const x = i => pl + (W - pl - pr) * i / 11;
  const y = v => pt + (H - pt - pb) * (1 - v / mx);
  let g = '';
  if (besar) {
    [0, 0.5, 1].forEach(f => {
      const v = mx * f / 1.18 * 1.18;
      g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="gt">' + num_(v, 0) + '</text>';
    });
    for (let i = 0; i < 12; i++) g += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle" class="gt">' + BULAN_S[i] + '</text>';
  }
  g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(ind.target) + '" y2="' + y(ind.target) + '" class="gtarget"/>';
  const pts = [];
  ind.series.forEach((v, i) => { if (v !== null) pts.push([x(i), y(v), v, i]); });
  if (pts.length > 1) g += '<polyline class="gline" points="' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"/>';
  pts.forEach(p => { g += '<circle class="gdot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (besar ? 4.5 : 2.5) + '"><title>' + BULAN[p[3]] + ': ' + num_(p[2], 1) + '</title></circle>'; });
  return '<svg class="' + (besar ? 'trend' : 'spark') + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="' + (besar ? 'xMidYMid meet' : 'none') + '" role="img" aria-label="Tren ' + esc_(ind.nama) + '">' + g + '</svg>';
}

function donut_(kpi) {
  const t = kpi.tercapai + kpi.waspada + kpi.kritis;
  if (!t) return '<div class="donut donut-empty"><span>—</span></div>';
  const a = kpi.tercapai / t * 360, b = a + kpi.waspada / t * 360;
  return '<div class="donut" style="background:conic-gradient(var(--ok) 0 ' + a + 'deg,var(--warn) ' + a + 'deg ' + b + 'deg,var(--crit) ' + b + 'deg 360deg)" role="img" aria-label="Distribusi status capaian"><span>' + t + '<small>dinilai</small></span></div>';
}

/* ---------------- Komponen bersama ---------------- */

function kpiCard_(label, nilai, sub, cls, ikon, nav) {
  return '<' + (nav ? 'button type="button" data-nav="indikator" data-params=\'' + esc_(JSON.stringify(nav)) + '\'' : 'div') + ' class="card kpi kpi-' + cls + '">' +
    '<div class="kpi-top"><span class="kpi-label">' + esc_(label) + '</span>' + ic_(ikon) + '</div>' +
    '<div class="kpi-num">' + esc_(nilai) + '</div><div class="kpi-sub">' + esc_(sub) + '</div></' + (nav ? 'button' : 'div') + '>';
}

function indRow_(i, user, ctx) {
  const dari = i.frek + ' · target ' + (i.arah === 'Turun' ? '≤ ' : '≥ ') + val_(i.target, i.satuan);
  return '<article class="card ind-row" data-act="detail" tabindex="0" role="button" aria-label="Detail ' + esc_(i.nama) + '">' +
    '<div class="ir-main"><div class="ir-id">' + esc_(i.id) + ' · ' + esc_(i.bidang) + '</div><h3 class="ir-name">' + esc_(i.nama) + '</h3>' +
    '<div class="ir-meta">' + chip_('info', i.jenis) + '<span class="muted sm">' + esc_(dari) + '</span></div></div>' +
    '<div class="ir-val"><div class="ir-real">' + esc_(val_(i.realisasi, i.satuan)) + '</div><div class="muted sm">' + (i.realBulan ? 'per ' + BULAN[i.realBulan - 1] : 'belum ada isian') + '</div></div>' +
    '<div class="ir-cap"><div class="ir-cap-top"><b>' + esc_(pct_(i.capaian)) + '</b>' + tierChip_(i.tier) + '</div>' + bar_(i.capaian, i.tier === 'belum' ? null : i.tier) + '</div>' +
    '<div class="ir-spark">' + trend_(i, false) + '</div>' +
    '<div class="detail-src" hidden>' + detail_(i, user, ctx) + '</div></article>';
}

function buktiBtn_(i) {
  return '<button type="button" class="btn btn-ghost btn-sm" data-act="bukti" data-id="' + esc_(i.id) + '" data-nama="' + esc_(i.nama) + '">' + ic_('attach_file') + 'Bukti' + (i.nBukti ? ' (' + i.nBukti + ')' : '') + '</button>';
}

function rincianKab_(i, ctx) {
  const isi = ((ctx.notePer || {})[i.id] || []).slice();
  if (!isi.length) return '';
  isi.sort((a, b) => Number(a.Bulan) - Number(b.Bulan));
  return '<h4 class="h4">Analisis masalah &amp; rekomendasi</h4><div class="stack">' + isi.map(r =>
    '<div class="note-ar"><b>' + BULAN[Number(r.Bulan) - 1] + '</b>' +
    (r.Analisis ? '<p><span class="muted sm">Analisis masalah</span><br>' + esc_(r.Analisis) + '</p>' : '') +
    (r.Rekomendasi ? '<p><span class="muted sm">Rekomendasi</span><br>' + esc_(r.Rekomendasi) + '</p>' : '') + '</div>').join('') + '</div>';
}

function detail_(i, user, ctx) {
  const wa = waLink_(i.picTelp);
  let tbl = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Bulan</th><th class="r">Realisasi</th><th>Status</th><th></th></tr></thead><tbody>';
  i.due.forEach(b => {
    const r = ctx.isian[i.id + '|' + b];
    const c = i.cells[b - 1];
    const lbl = c === 'ok' ? chip_('ok', 'Lengkap') : c === 'wait' ? chip_('info', 'Menunggu verifikasi') : c === 'miss' ? chip_('crit', 'Belum diisi') : chip_('mute', 'Belum jatuh tempo');
    tbl += '<tr><td>' + BULAN[b - 1] + '</td><td class="r">' + esc_(val_(i.series[b - 1], i.satuan)) + '</td><td>' + lbl + '</td><td class="r">' +
      ((c === 'miss' || c === 'ok' || c === 'wait') && bisaIsi_(user, i) ? '<button type="button" class="btn btn-ghost btn-sm" ' + isiAttr_(i, b, ctx) + '>' + (c === 'miss' ? 'Isi' : 'Ubah') + '</button>' : '') + '</td></tr>';
  });
  tbl += '</tbody></table></div>';
  return '<div class="detail">' +
    '<div class="detail-chips">' + chip_('info', i.jenis) + chip_('mute', i.bidang) + chip_('mute', i.frek) + tierChip_(i.tier) + '</div>' +
    '<div class="detail-grid"><div><span class="muted sm">Target</span><b>' + (i.arah === 'Turun' ? '≤ ' : '≥ ') + esc_(val_(i.target, i.satuan)) + '</b></div>' +
    '<div><span class="muted sm">Realisasi terakhir</span><b>' + esc_(val_(i.realisasi, i.satuan)) + '</b></div>' +
    '<div><span class="muted sm">Capaian</span><b>' + esc_(pct_(i.capaian)) + '</b></div></div>' +
    '<h4 class="h4">Tren ' + (ctx.tahun) + '</h4>' + trend_(i, true) +
    '<div class="legend"><span><i class="lg lg-line"></i>Realisasi</span><span><i class="lg lg-target"></i>Target</span></div>' +
    '<h4 class="h4">Riwayat pelaporan</h4>' + tbl + rincianKab_(i, ctx) +
    '<h4 class="h4">Penanggung jawab</h4><div class="pic-line"><div class="avatar">' + esc_((i.picNama || '?').charAt(0)) + '</div><div><b>' + esc_(i.picNama || 'Belum ditetapkan') + '</b><div class="muted sm">' + esc_(i.bidang) + '</div></div>' +
    (i.picTelp ? '<a class="btn btn-ghost btn-sm" href="tel:' + esc_(i.picTelp) + '">Telepon</a>' : '') +
    (wa ? '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc_(wa) + '">WhatsApp</a>' : '') + '</div>' +
    '<div class="detail-actions">' + buktiBtn_(i) + '<button type="button" class="btn btn-primary" data-act="prefill-masalah" data-ind="' + esc_(i.id) + '" data-bidang="' + esc_(i.bidang) + '">' + ic_('add_comment') + 'Catat permasalahan</button></div></div>';
}

function indikatorFilter_(m, params, nama, extraTier) {
  const bopts = [{ v: '', t: 'Semua bidang' }].concat(m.bidang.map(b => ({ v: b.nama, t: b.nama })));
  const topts = [{ v: '', t: 'Semua status' }, { v: 'tercapai', t: 'Tercapai' }, { v: 'waspada', t: 'Waspada' }, { v: 'kritis', t: 'Kritis' }, { v: 'belum', t: 'Belum ada data' }];
  return '<div class="filters card card-flat">' +
    '<label class="search"><span class="sr">Cari indikator</span>' + ic_('search') + '<input type="search" class="input input-search f-param" data-param="q" value="' + esc_(params.q || '') + '" placeholder="Cari nama atau ID indikator" maxlength="60"></label>' +
    filterSel_('Bidang', 'bidang', bopts, params.bidang) + filterSel_('Status capaian', 'tier', topts, params.tier) + '</div>';
}

function filterInd_(m, params, jenis) {
  const q = String(params.q || '').toLowerCase().trim();
  return m.ind.filter(i =>
    (!jenis || i.jenis === jenis) && (!params.bidang || i.bidang === params.bidang) && (!params.tier || i.tier === params.tier) &&
    (!q || i.nama.toLowerCase().indexOf(q) >= 0 || i.id.toLowerCase().indexOf(q) >= 0));
}

/* ---------------- Halaman: Beranda ---------------- */

function pageBeranda_(m, user, params, ctx) {
  const k = m.kpi;
  const cut = m.cutoffHari === null ? '' : (m.cutoffHari >= 0 ? chip_(m.cutoffHari <= 3 ? 'warn' : 'info', 'Cut-off H-' + m.cutoffHari) : chip_('crit', 'Melewati cut-off ' + Math.abs(m.cutoffHari) + ' hari'));
  let h = pageHead_('Beranda Eksekutif', 'Ringkasan capaian dan kepatuhan pelaporan — ' + m.periodeLabel, '');
  h += '<section class="card hero" aria-label="Kepatuhan pengisian"><div class="hero-l"><div class="hero-top">' + chip_('info', m.triwulan + ' ' + m.tahun) + cut + '</div>' +
    '<h2 class="hero-title">Kepatuhan Pengisian Data</h2><p class="hero-sub">Indikator wajib lapor sampai ' + esc_(m.periodeLabel) + ' yang sudah terinput.</p>' +
    '<div class="hero-pct">' + esc_(num_(k.pctInput, 1)) + '<small>%</small></div>' + bar_(k.pctInput, k.pctInput >= 100 ? 'tercapai' : (k.pctInput >= 80 ? 'waspada' : 'kritis')) +
    '<div class="hero-stats"><span><b>' + (k.lengkap + k.menunggu) + '</b> dari ' + k.wajib + ' indikator masuk</span><span><b>' + k.menunggu + '</b> menunggu verifikasi</span><span><b>' + k.menunggak + '</b> tertunggak</span></div></div>' +
    '<div class="hero-r"><button type="button" class="btn btn-primary" data-nav="monitoring">' + ic_('fact_check') + 'Buka Monitoring</button></div></section>';

  h += '<section class="grid g4" aria-label="Ringkasan status">' +
    kpiCard_('Total Indikator', String(k.total), 'Aktif dipantau', 'info', 'monitoring', {}) +
    kpiCard_('Tercapai', String(k.tercapai), k.total ? num_(k.tercapai / k.total * 100, 0) + '% dari total' : '—', 'ok', 'task_alt', { tier: 'tercapai' }) +
    kpiCard_('Waspada', String(k.waspada), 'Capaian 80–99%', 'warn', 'warning', { tier: 'waspada' }) +
    kpiCard_('Kritis', String(k.kritis), 'Capaian di bawah 80%', 'crit', 'error', { tier: 'kritis' }) + '</section>';

  h += '<h2 class="h2">Capaian per Bidang</h2><section class="grid g3">';
  h += m.bidang.map(b => '<button type="button" class="card bidang" data-nav="indikator" data-params=\'' + esc_(JSON.stringify({ bidang: b.nama })) + '\'>' +
    '<div class="bidang-top"><span class="bidang-ic">' + ic_(b.ikon) + '</span><div><h3 class="h3">' + esc_(b.nama) + '</h3><span class="muted sm">' + b.total + ' indikator</span></div></div>' +
    '<div class="bidang-row"><span>Capaian</span><b>' + esc_(pct_(b.capaian)) + '</b></div>' + bar_(b.capaian) +
    '<div class="bidang-row"><span>Pengisian</span><b>' + esc_(pct_(b.pctInput)) + '</b></div>' + bar_(b.pctInput) +
    (b.menunggak ? '<div class="bidang-foot">' + chip_('crit', b.menunggak + ' tertunggak') + '</div>' : '<div class="bidang-foot">' + chip_('ok', 'Pengisian tertib', true) + '</div>') + '</button>').join('');
  h += '</section>';

  const perhatian = m.ind.filter(i => i.capaian !== null).sort((a, b) => a.capaian - b.capaian).slice(0, 6);
  h += '<div class="grid g-main"><section class="card card-pad"><div class="sec-top"><h2 class="h2 flat">Indikator Perhatian Utama</h2><button type="button" class="btn btn-ghost btn-sm" data-nav="indikator">Lihat semua</button></div>';
  h += perhatian.length ? '<div class="stack">' + perhatian.map(i =>
    '<div class="att"><div class="att-main"><b>' + esc_(i.nama) + '</b><span class="muted sm">' + esc_(i.bidang) + ' · ' + esc_(i.frek) + '</span></div>' +
    '<div class="att-val"><b>' + esc_(val_(i.realisasi, i.satuan)) + '</b><span class="muted sm">target ' + (i.arah === 'Turun' ? '≤ ' : '≥ ') + esc_(val_(i.target, i.satuan)) + '</span></div>' +
    '<div class="att-cap">' + tierChip_(i.tier) + bar_(i.capaian, i.tier) + '</div></div>').join('') + '</div>' : kosong_('Belum ada data capaian untuk periode ini.', 'monitoring');
  h += '</section>';

  h += '<aside class="stack-lg"><section class="card card-pad"><h2 class="h2 flat">Rata-rata Provinsi</h2><div class="avg-row">' + donut_(k) +
    '<div><div class="avg-num">' + esc_(pct_(k.rataCapaian)) + '</div><div class="muted sm">rata-rata capaian (dibatasi 100% per indikator)</div></div></div>' +
    '<ul class="legend-list"><li><i class="dot d-ok"></i>Tercapai <b>' + k.tercapai + '</b></li><li><i class="dot d-warn"></i>Waspada <b>' + k.waspada + '</b></li><li><i class="dot d-crit"></i>Kritis <b>' + k.kritis + '</b></li></ul></section>';
  h += '<section class="card card-pad"><h2 class="h2 flat">Status Kabupaten</h2><div class="stack">' + m.kab.map(x =>
    '<div class="kab"><div class="kab-top"><span>' + esc_(x.nama) + '</span>' + (x.tertunda ? chip_('warn', x.tertunda + ' tertunda') : chip_('ok', 'Lengkap')) + '</div>' + bar_(x.pct) + '</div>').join('') + '</div></section></aside></div>';

  const ms = readTable_(SHEET.MASALAH).filter(x => x.Status !== 'Selesai').sort((a, b) => ({ Tinggi: 0, Sedang: 1, Rendah: 2 }[a.Prioritas] - { Tinggi: 0, Sedang: 1, Rendah: 2 }[b.Prioritas])).slice(0, 3);
  h += '<div class="grid g2"><section class="card card-pad"><div class="sec-top"><h2 class="h2 flat">Catatan Kritis &amp; Solusi</h2><button type="button" class="btn btn-ghost btn-sm" data-nav="rekomendasi">Kelola</button></div>';
  h += ms.length ? '<div class="stack">' + ms.map(x => '<div class="note note-' + (x.Prioritas === 'Tinggi' ? 'crit' : 'warn') + '"><div class="note-top">' + chip_(x.Prioritas === 'Tinggi' ? 'crit' : 'warn', 'Prioritas ' + x.Prioritas) + '<span class="muted sm">' + esc_(x.Bidang) + '</span></div><p>' + esc_(x.Permasalahan) + '</p>' +
    (x.Rekomendasi ? '<p class="note-sol">' + ic_('lightbulb') + '<span>' + esc_(x.Rekomendasi) + '</span></p>' : '') + '</div>').join('') + '</div>' : kosong_('Tidak ada permasalahan terbuka.', 'verified');
  h += '</section><section class="card card-pad"><h2 class="h2 flat">Focal Point Bidang</h2><div class="stack">' + m.bidang.map(b => {
    const p = m.pic[b.nama]; if (!p) return '';
    const wa = waLink_(p.telp);
    return '<div class="pic-line"><div class="avatar">' + esc_(p.nama.charAt(0)) + '</div><div class="grow"><b>' + esc_(p.nama) + '</b><div class="muted sm">' + esc_(b.nama) + '</div></div>' +
      (p.telp ? '<a class="icon-btn" aria-label="Telepon ' + esc_(p.nama) + '" href="tel:' + esc_(p.telp) + '">' + ic_('call') + '</a>' : '') +
      (wa ? '<a class="icon-btn" aria-label="WhatsApp ' + esc_(p.nama) + '" target="_blank" rel="noopener" href="' + esc_(wa) + '">' + ic_('chat') + '</a>' : '') + '</div>';
  }).join('') + '</div></section></div>';

  h += '<section class="cta-row"><button type="button" class="btn btn-alert" data-nav="permintaan">' + ic_('upload_file') + 'Permintaan Data</button>' +
    (user.role !== 'pic' ? '<button type="button" class="btn btn-primary" data-nav="laporan">' + ic_('description') + 'Laporan Eksekutif</button>' : '') +
    (user.role === 'admin' ? '<button type="button" class="btn btn-ghost" data-nav="pengguna" data-params=\'{"tambah":1}\'>' + ic_('person_add') + 'Tambah Pengguna</button>' : '') + '</section>';
  return h;
}

/* ---------------- Halaman: Daftar indikator (Kesehatan / IKU / SPM) ---------------- */

/* ---------------- Halaman: Daftar indikator + Target & Periode Capaian ---------------- */

const VIEW_IND = [
  { id: 'daftar', label: 'Daftar', icon: 'view_list' },
  { id: 'target', label: 'Target & Pencapaian', icon: 'track_changes' },
  { id: 'periode', label: 'Periode Capaian', icon: 'calendar_month' },
  { id: 'inputtarget', label: 'Input Target', icon: 'edit_note', admin: true }
];
const TIPE_PERIODE = [
  { id: 'bulanan', label: 'Bulanan' }, { id: 'triwulan', label: 'Triwulan' },
  { id: 'semester', label: 'Semester' }, { id: 'tahunan', label: 'Tahunan' }
];
const ACUAN_TARGET = [
  { id: 'triwulan', label: 'Triwulan' }, { id: 'semester', label: 'Semester' }, { id: 'tahunan', label: 'Tahunan' }
];
const KUNCI_LABEL = { TW1: 'TW I', TW2: 'TW II', TW3: 'TW III', TW4: 'TW IV', SM1: 'Sem I', SM2: 'Sem II', TH: 'Tahunan' };

/** Rumus capaian: sama dengan hitungModel_ (Naik: realisasi÷target, Turun: target÷realisasi, maks 200). */
function hitungCap_(real, target, arah) {
  if (real === null || real === undefined || !(target > 0)) return null;
  const c = arah === 'Turun' ? (real <= 0 ? 200 : (target / real) * 100) : (real / target) * 100;
  return Math.round(Math.min(c, 200) * 10) / 10;
}

function daftarPeriode_(tipe, tahun) {
  if (tipe === 'triwulan') return [1, 2, 3, 4].map(k => ({ tipe: tipe, k: k, lbl: 'TW ' + ['I', 'II', 'III', 'IV'][k - 1], sub: BULAN_S[(k - 1) * 3] + '–' + BULAN_S[k * 3 - 1], s: (k - 1) * 3 + 1, e: k * 3 }));
  if (tipe === 'semester') return [1, 2].map(k => ({ tipe: tipe, k: k, lbl: 'Semester ' + ['I', 'II'][k - 1], sub: BULAN_S[(k - 1) * 6] + '–' + BULAN_S[k * 6 - 1], s: (k - 1) * 6 + 1, e: k * 6 }));
  if (tipe === 'tahunan') return [{ tipe: tipe, k: 1, lbl: 'Tahun ' + tahun, sub: 'Jan–Des', s: 1, e: 12 }];
  return BULAN_S.map((n, k) => ({ tipe: 'bulanan', k: k + 1, lbl: n, sub: '', s: k + 1, e: k + 1 }));
}

function kunciTarget_(per) {
  if (per.tipe === 'triwulan') return 'TW' + per.k;
  if (per.tipe === 'semester') return 'SM' + per.k;
  if (per.tipe === 'tahunan') return 'TH';
  return 'TW' + Math.ceil(per.k / 3);   // kolom bulanan memakai target triwulan yang memuat bulan itu
}
/** Target yang berlaku: target periode bila diisi, kalau tidak target dasar indikator. */
function targetPer_(i, per) {
  const key = kunciTarget_(per), v = i.tgtP ? i.tgtP[key] : undefined;
  return v === undefined ? { v: i.target, dari: 'dasar', key: key } : { v: v, dari: key, key: key };
}

/** Capaian satu indikator pada satu periode: memakai isian valid (Lengkap / Menunggu) terakhir di dalam periode, sampai bulan aktif. */
function capPeriode_(i, per, bulan) {
  const due = i.due.filter(b => b >= per.s && b <= per.e);
  if (!due.length) return { st: 'na' };
  const sd = due.filter(b => b <= bulan);
  if (!sd.length) return { st: 'future' };
  let last = null;
  sd.forEach(b => { const c = i.cells[b - 1]; if ((c === 'ok' || c === 'wait') && i.series[b - 1] !== null) last = b; });
  if (last === null) return { st: 'miss' };
  const tg = targetPer_(i, per);
  const real = i.series[last - 1], cap = hitungCap_(real, tg.v, i.arah);
  return { st: 'ok', real: real, cap: cap, tier: tierDari_(cap), bln: last, jalan: per.e > bulan, tg: tg };
}

function tabsInd_(rute, params, kunci, daftar, aktif, ekstra) {
  const dasar = {};
  ['q', 'bidang', 'tier', 'periode', 'acuan'].forEach(k => { if (params[k]) dasar[k] = params[k]; });
  return daftar.map(d => {
    const pr = Object.assign({}, dasar, ekstra || {}); pr[kunci] = d.id;
    return '<button type="button" class="seg-btn' + (d.id === aktif ? ' is-on' : '') + '" data-nav="' + rute + '" data-params=\'' + esc_(JSON.stringify(pr)) + '\'' + (d.id === aktif ? ' aria-current="true"' : '') + '>' + (d.icon ? ic_(d.icon) : '') + '<span>' + esc_(d.label) + '</span></button>';
  }).join('');
}

function selisih_(real, tgt, arah, satuan) {
  if (real === null || real === undefined) return { teks: '—', cls: 'mute' };
  const d = arah === 'Turun' ? tgt - real : real - tgt;
  const rd = Math.round(d * 10) / 10;
  return { teks: (rd > 0 ? '+' : rd < 0 ? '−' : '') + num_(Math.abs(rd), 1) + (satuan === '%' ? ' poin' : (satuan ? ' ' + satuan : '')), cls: rd >= 0 ? 'ok' : 'crit' };
}

function viewTarget_(list, m, params, rute, user) {
  const acuan = ACUAN_TARGET.some(a => a.id === params.acuan) ? params.acuan : 'triwulan';
  const per = daftarPeriode_(acuan, m.tahun).filter(p => m.bulan >= p.s && m.bulan <= p.e)[0];
  const baris = list.map(i => ({ i: i, c: capPeriode_(i, per, m.bulan), tg: targetPer_(i, per) }));
  const ok = baris.filter(x => x.c.st === 'ok');
  const n = t => ok.filter(x => x.c.tier === t).length;
  baris.sort((a, b) => (a.c.st === 'ok' ? (a.c.cap === null ? 998 : a.c.cap) : 999) - (b.c.st === 'ok' ? (b.c.cap === null ? 998 : b.c.cap) : 999));
  let h = '<div class="seg seg-sub" role="group" aria-label="Acuan target">' + tabsInd_(rute, params, 'acuan', ACUAN_TARGET, acuan, { view: 'target' }) + '</div>';
  h += '<div class="grid g4">' +
    kpiCard_('Tercapai', n('tercapai'), 'Capaian ≥ 100%', 'ok', 'task_alt') + kpiCard_('Waspada', n('waspada'), 'Capaian 80–99%', 'warn', 'warning') +
    kpiCard_('Kritis', n('kritis'), 'Capaian di bawah 80%', 'crit', 'error') + kpiCard_('Belum dinilai', baris.length - ok.length, 'Belum ada isian pada periode ini', 'info', 'hourglass_empty') + '</div>';
  h += '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">Target ' + esc_(per.lbl) + ' dan realisasi berjalan</h2>' +
    '<p class="muted sm">Periode acuan: ' + esc_(per.lbl) + ' (' + esc_(per.sub) + '). Realisasi adalah isian terakhir di periode ini sampai ' + esc_(m.periodeLabel) + '. Bila target periode belum diisi, dipakai target dasar indikator.' +
    (user.role === 'admin' ? ' Admin dapat mengisinya di tab <b>Input Target</b>.' : '') + '</p></div></div>';
  if (!baris.length) return h + kosong_('Tidak ada indikator yang cocok dengan filter.', 'search_off') + '</section>';
  h += '<div class="tbl-wrap"><table class="tbl tbl-target"><thead><tr><th>Indikator</th><th class="r">Target ' + esc_(per.lbl) + '</th><th class="r">Realisasi</th><th class="r">Selisih</th><th>Capaian</th><th>Status</th></tr></thead><tbody>';
  baris.forEach(x => {
    const i = x.i, c = x.c, tg = x.tg;
    const tgTxt = (i.arah === 'Turun' ? '≤ ' : '≥ ') + val_(tg.v, i.satuan);
    const sumber = tg.dari === 'dasar' ? '<span class="muted sm blok">target dasar</span>' : '<span class="sm blok sumber-tgt">' + esc_(KUNCI_LABEL[tg.dari]) + '</span>';
    h += '<tr><td><b class="heat-name">' + esc_(i.nama) + '</b><span class="muted sm">' + esc_(i.id) + ' · ' + esc_(i.bidang) + (i.programNama ? ' · ' + esc_(i.programNama) : '') + ' · ' + esc_(i.frek) + '</span></td>' +
      '<td class="r nowrap">' + esc_(tgTxt) + sumber + '</td>';
    if (c.st === 'ok') {
      const sl = selisih_(c.real, tg.v, i.arah, i.satuan);
      h += '<td class="r"><b>' + esc_(val_(c.real, i.satuan)) + '</b><span class="muted sm blok">per ' + BULAN[c.bln - 1] + '</span></td>' +
        '<td class="r"><span class="sel sel-' + sl.cls + '">' + esc_(sl.teks) + '</span></td>' +
        '<td class="cap-cell"><b>' + esc_(pct_(c.cap)) + '</b>' + bar_(c.cap, c.tier === 'belum' ? null : c.tier) + '</td><td>' + tierChip_(c.tier) + '</td></tr>';
    } else {
      const ket = c.st === 'miss' ? chip_('crit', 'Belum diisi') : c.st === 'future' ? chip_('mute', 'Belum jatuh tempo') : chip_('mute', 'Tidak ada pelaporan di periode ini');
      h += '<td class="r">—</td><td class="r">—</td><td class="cap-cell">—</td><td>' + ket + '</td></tr>';
    }
  });
  return h + '</tbody></table></div><p class="muted sm top-gap">Arah target: indikator berarah ↑ makin tinggi makin baik (≥), berarah ↓ makin rendah makin baik (≤). Selisih hijau berarti sudah memenuhi target.</p></section>';
}

function viewInputTarget_(list, m, params) {
  const cols = ['TW1', 'TW2', 'TW3', 'TW4', 'SM1', 'SM2', 'TH'];
  let h = '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">Input target ' + m.tahun + '</h2>' +
    '<p class="muted sm">Isi target per triwulan, semester, dan tahunan. Kosongkan kotak agar indikator memakai <b>target dasar</b> (angka abu-abu di dalam kotak). Tahun mengikuti pilihan di bilah atas; hanya kotak yang Anda ubah yang disimpan.</p></div></div>';
  if (!list.length) return h + kosong_('Tidak ada indikator yang cocok dengan filter.', 'search_off') + '</section>';
  h += '<form id="form-target" data-tahun="' + m.tahun + '" novalidate><div class="tbl-wrap"><table class="tbl heat tbl-input"><thead><tr><th class="sticky">Indikator</th><th class="r">Dasar</th>' +
    cols.map(k => '<th class="c">' + esc_(KUNCI_LABEL[k]) + '</th>').join('') + '</tr></thead><tbody>';
  list.forEach(i => {
    h += '<tr><td class="sticky"><b class="heat-name">' + esc_(i.nama) + '</b><span class="muted sm">' + esc_(i.id) + ' · ' + esc_(i.arah === 'Turun' ? '≤' : '≥') + ' · ' + esc_(i.satuan || '—') + '</span></td>' +
      '<td class="r nowrap">' + esc_(num_(i.target)) + '</td>' +
      cols.map(k => {
        const v = i.tgtP && i.tgtP[k] !== undefined ? i.tgtP[k] : '';
        return '<td class="c"><label class="sr" for="t_' + esc_(i.id) + '_' + k + '">Target ' + esc_(KUNCI_LABEL[k]) + ' ' + esc_(i.id) + '</label>' +
          '<input class="input input-sm tgt-in" id="t_' + esc_(i.id) + '_' + k + '" type="number" inputmode="decimal" step="any" min="0" data-id="' + esc_(i.id) + '" data-per="' + k + '" data-orig="' + esc_(v) + '" value="' + esc_(v) + '" placeholder="' + esc_(num_(i.target)) + '"></td>';
      }).join('') + '</tr>';
  });
  h += '</tbody></table></div><div class="form-actions"><button class="btn btn-primary" type="submit">' + ic_('save') + 'Simpan Target</button>' +
    '<button type="button" class="btn btn-ghost" data-act="reload">Batalkan perubahan</button><span class="muted sm" id="tgt-info" aria-live="polite"></span></div><p class="form-msg" role="alert"></p></form></section>';
  return h;
}

function viewPeriode_(list, m, params, rute) {
  const tipe = TIPE_PERIODE.some(t => t.id === params.periode) ? params.periode : 'triwulan';
  const per = daftarPeriode_(tipe, m.tahun);
  const sekarang = k => m.bulan >= per[k].s && m.bulan <= per[k].e;
  let h = '<div class="seg seg-sub" role="group" aria-label="Jenis periode">' + tabsInd_(rute, params, 'periode', TIPE_PERIODE, tipe, { view: 'periode' }) + '</div>';
  h += '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">Capaian per periode ' + esc_(TIPE_PERIODE.filter(t => t.id === tipe)[0].label.toLowerCase()) + ' — ' + m.tahun + '</h2>' +
    '<p class="muted sm">Tiap sel menunjukkan capaian terhadap target periode itu dan realisasi terakhir di dalamnya. Periode yang sedang berjalan ditandai, nilainya dihitung sampai ' + esc_(m.periodeLabel) + '. Target periode yang belum diisi memakai target dasar' + (tipe === 'bulanan' ? '; kolom bulanan memakai target triwulan yang memuat bulan itu' : '') + '.</p></div></div>';
  if (!list.length) return h + kosong_('Tidak ada indikator yang cocok dengan filter.', 'search_off') + '</section>';
  const hasil = list.map(i => per.map(p => capPeriode_(i, p, m.bulan)));
  h += '<div class="tbl-wrap"><table class="tbl heat tbl-periode"><thead><tr><th class="sticky">Indikator</th><th class="r">Target dasar</th>' +
    per.map((p, k) => '<th class="c' + (sekarang(k) ? ' now' : '') + '">' + esc_(p.lbl) + (p.sub ? '<small class="blok">' + esc_(p.sub) + '</small>' : '') + (sekarang(k) ? '<small class="blok now-tag">berjalan</small>' : '') + '</th>').join('') + '</tr></thead><tbody>';
  list.forEach((i, r) => {
    h += '<tr><td class="sticky"><b class="heat-name">' + esc_(i.nama) + '</b><span class="muted sm">' + esc_(i.id) + ' · ' + esc_(i.frek) + '</span></td>' +
      '<td class="r nowrap">' + (i.arah === 'Turun' ? '≤ ' : '≥ ') + esc_(val_(i.target, i.satuan)) + '</td>';
    hasil[r].forEach((c, k) => {
      const now = sekarang(k) ? ' now' : '';
      if (c.st === 'ok') {
        const tgl = c.tg.dari === 'dasar' ? '' : 'target ' + KUNCI_LABEL[c.tg.dari] + ' ' + val_(c.tg.v, i.satuan);
        h += '<td class="c pcell pc-' + c.tier + now + '" title="' + esc_(TIER_LABEL[c.tier] + ' — realisasi ' + val_(c.real, i.satuan) + ' (' + BULAN[c.bln - 1] + ')' + (tgl ? ' · ' + tgl : '')) + '"><b>' + esc_(pct_(c.cap)) + '</b><small class="blok">' + esc_(val_(c.real, i.satuan)) + '</small>' +
          (c.tg.dari !== 'dasar' ? '<small class="blok sumber-tgt">tgt ' + esc_(num_(c.tg.v)) + '</small>' : '') + (c.jalan ? '<small class="blok jalan">s.d. ' + BULAN_S[c.bln - 1] + '</small>' : '') + '</td>';
      } else if (c.st === 'miss') h += '<td class="c pcell pc-miss' + now + '"><b>Belum diisi</b></td>';
      else if (c.st === 'future') h += '<td class="c pcell pc-future' + now + '">Belum jatuh tempo</td>';
      else h += '<td class="c pcell pc-na' + now + '">—</td>';
    });
    h += '</tr>';
  });
  h += '</tbody><tfoot><tr><th class="sticky">Rata-rata capaian</th><th></th>' + per.map((p, k) => {
    const caps = hasil.map(x => x[k]).filter(c => c.st === 'ok' && c.cap !== null).map(c => Math.min(c.cap, 100));
    const tot = hasil.map(x => x[k]).filter(c => c.st === 'ok' || c.st === 'miss').length;
    const ok = hasil.map(x => x[k]).filter(c => c.st === 'ok' && c.tier === 'tercapai').length;
    return '<th class="c' + (sekarang(k) ? ' now' : '') + '">' + (caps.length ? esc_(pct_(Math.round(caps.reduce((a, c) => a + c, 0) / caps.length * 10) / 10)) : '—') + '<small class="blok">' + ok + ' dari ' + tot + ' tercapai</small></th>';
  }).join('') + '</tr></tfoot></table></div>';
  h += '<div class="legend top-gap"><span><i class="dot d-ok"></i>Tercapai ≥ 100%</span><span><i class="dot d-warn"></i>Waspada 80–99%</span><span><i class="dot d-crit"></i>Kritis &lt; 80%</span><span><i class="dot d-mute"></i>Belum diisi / belum jatuh tempo / tidak wajib</span></div></section>';
  return h;
}

function pageIndikatorGen_(judul, sub, jenis, m, user, params, ctx, rute) {
  rute = rute || 'indikator';
  const adm = user.role === 'admin';
  const tabs = VIEW_IND.filter(v => !v.admin || adm);
  const view = tabs.some(v => v.id === params.view) ? params.view : 'daftar';
  const list = filterInd_(m, params, jenis);
  let h = pageHead_(judul, sub, '<span class="chip chip-info">' + list.length + ' indikator</span>');
  h += '<div class="seg seg-main" role="group" aria-label="Tampilan indikator">' + tabsInd_(rute, params, 'view', tabs, view) + '</div>';
  h += indikatorFilter_(m, params);
  if (view === 'target') return h + viewTarget_(list, m, params, rute, user);
  if (view === 'inputtarget') return h + viewInputTarget_(list, m, params);
  if (view === 'periode') return h + viewPeriode_(list, m, params, rute);
  h += list.length ? '<div class="stack">' + list.map(i => indRow_(i, user, ctx)).join('') + '</div>' : kosong_('Tidak ada indikator yang cocok dengan filter.', 'search_off');
  return h;
}
function pageIndikator_(m, u, p, c) { return pageIndikatorGen_('Indikator Kesehatan', 'Seluruh indikator yang dipantau Dinas — lihat daftar, pencapaian terhadap target, atau capaian per periode.', '', m, u, p, c, 'indikator'); }
function pageIku_(m, u, p, c) { return pageIndikatorGen_('Indikator Kinerja Utama (IKU)', 'Indikator kinerja utama perangkat daerah.', 'IKU', m, u, p, c, 'iku'); }

/* ---------------- Halaman: Capaian & Analitik ---------------- */

function pageAnalitik_(m, user, params, ctx) {
  const k = m.kpi;
  let h = pageHead_('Capaian & Analitik', 'Perbandingan capaian lintas bidang, jenis indikator, dan tren — ' + m.periodeLabel, '');
  h += '<div class="grid g2"><section class="card card-pad"><h2 class="h2 flat">Capaian Rata-rata per Bidang</h2><div class="stack">' +
    m.bidang.map(b => '<div class="hbar"><div class="hbar-top"><span>' + esc_(b.nama) + '</span><b>' + esc_(pct_(b.capaian)) + '</b></div>' + bar_(b.capaian) + '</div>').join('') + '</div></section>';
  const jenis = ['IKU', 'SPM', 'Kesehatan'].map(j => {
    const li = m.ind.filter(i => i.jenis === j && i.capaian !== null).map(i => Math.min(i.capaian, 100));
    return { j: j, n: m.ind.filter(i => i.jenis === j).length, avg: li.length ? Math.round(li.reduce((a, c) => a + c, 0) / li.length * 10) / 10 : null };
  });
  h += '<section class="card card-pad"><h2 class="h2 flat">Distribusi &amp; Jenis Indikator</h2><div class="avg-row">' + donut_(k) + '<ul class="legend-list"><li><i class="dot d-ok"></i>Tercapai <b>' + k.tercapai + '</b></li><li><i class="dot d-warn"></i>Waspada <b>' + k.waspada + '</b></li><li><i class="dot d-crit"></i>Kritis <b>' + k.kritis + '</b></li><li><i class="dot d-mute"></i>Belum ada data <b>' + k.belum + '</b></li></ul></div>' +
    '<div class="stack top-gap">' + jenis.map(x => '<div class="hbar"><div class="hbar-top"><span>' + esc_(x.j) + ' <span class="muted sm">(' + x.n + ')</span></span><b>' + esc_(pct_(x.avg)) + '</b></div>' + bar_(x.avg) + '</div>').join('') + '</div></section></div>';

  const pilih = m.ind.find(i => i.id === params.ind) || m.ind[0];
  h += '<section class="card card-pad"><div class="sec-top"><h2 class="h2 flat">Tren Indikator</h2>' +
    filterSel_('Pilih indikator', 'ind', m.ind.map(i => ({ v: i.id, t: i.id + ' — ' + i.nama.slice(0, 60) })), pilih ? pilih.id : '') + '</div>';
  if (pilih) {
    h += '<div class="trend-meta">' + tierChip_(pilih.tier) + '<span class="muted sm">Target ' + (pilih.arah === 'Turun' ? '≤ ' : '≥ ') + esc_(val_(pilih.target, pilih.satuan)) + ' · Realisasi ' + esc_(val_(pilih.realisasi, pilih.satuan)) + '</span></div>' + trend_(pilih, true) +
      '<div class="legend"><span><i class="lg lg-line"></i>Realisasi</span><span><i class="lg lg-target"></i>Target</span></div>';
  } else h += kosong_('Belum ada indikator.');
  h += '</section>';

  const urut = m.ind.filter(i => i.capaian !== null).sort((a, b) => b.capaian - a.capaian);
  const lis = a => a.length ? '<div class="stack">' + a.map(i => '<div class="att att-sm"><div class="att-main"><b>' + esc_(i.nama) + '</b><span class="muted sm">' + esc_(i.bidang) + '</span></div><div class="att-cap">' + chip_(TIER_CLS[i.tier], pct_(i.capaian)) + '</div></div>').join('') + '</div>' : kosong_('Belum ada data.');
  h += '<div class="grid g2"><section class="card card-pad"><h2 class="h2 flat">Capaian Tertinggi</h2>' + lis(urut.slice(0, 5)) + '</section>' +
    '<section class="card card-pad"><h2 class="h2 flat">Perlu Intervensi</h2>' + lis(urut.slice(-5).reverse()) + '</section></div>';
  return h;
}

/* ---------------- Halaman: Monitoring Pengisian ---------------- */

/** Pembagian tugas: indikator apa yang diinput tiap PIC dan status isiannya periode ini. Terlihat oleh semua peran. */
function seksiTugasPic_(m, params) {
  const users = readTable_(SHEET.USERS).filter(u => u.Role === 'pic' && String(u.Aktif).toLowerCase() !== 'tidak');
  const fb = String(params.bidang || '');
  const progNama = {};
  m.program.forEach(p => { progNama[p.id] = p; });
  const dari = u => ({ role: 'pic', username: String(u.Username), program: String(u.Program || ''), bidang: String(u.Bidang) });
  const tercakup = {};
  users.forEach(u => { const me = dari(u); m.ind.forEach(i => { if (bisaIsi_(me, i)) tercakup[i.id] = true; }); });
  const tanpaPic = m.ind.filter(i => (!fb || i.bidang === fb) && !tercakup[i.id]);
  const KLS = { lengkap: 'ok', menunggu: 'info', menunggak: 'crit' };
  const LBL = { lengkap: 'Lengkap', menunggu: 'Menunggu verifikasi', menunggak: 'Belum diisi', na: 'Belum jatuh tempo' };
  const rows = users.filter(u => !fb || String(u.Bidang) === fb).map(u => {
    const me = dari(u);
    const li = m.ind.filter(i => bisaIsi_(me, i));
    const wajib = li.filter(i => i.status !== 'na');
    const ok = wajib.filter(i => i.status === 'lengkap' || i.status === 'menunggu').length;
    const tg = wajib.filter(i => i.status === 'menunggak').length;
    const ik = parseIk_(u.Indikator);
    const pg = progNama[String(u.Program || '')];
    const cakupan = ik.length ? 'Ditugaskan ' + ik.length + ' indikator' : (u.Program ? 'Semua indikator program' + (pg ? ' ' + pg.nama : '') : 'Semua indikator bidang');
    return { u: u, li: li, wajib: wajib.length, ok: ok, tg: tg, cakupan: cakupan, pct: wajib.length ? Math.round(ok / wajib.length * 1000) / 10 : null, prog: pg };
  }).sort((a, b) => b.tg - a.tg || String(a.u.Nama).localeCompare(String(b.u.Nama)));

  let h = '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">Pembagian Tugas PIC</h2><p class="muted sm">Indikator yang diinput tiap PIC dan status isiannya periode ini. Tekan baris untuk melihat daftarnya.</p></div>' +
    chip_(tanpaPic.length ? 'warn' : 'ok', tanpaPic.length ? tanpaPic.length + ' indikator belum ada PIC' : 'Semua indikator punya PIC') + '</div>';
  if (tanpaPic.length) h += '<div class="pt-warn">' + ic_('person_off') + '<div><b>Belum ada PIC yang bisa mengisi:</b> ' + esc_(tanpaPic.slice(0, 6).map(i => i.id).join(', ')) + (tanpaPic.length > 6 ? ' dan ' + (tanpaPic.length - 6) + ' lainnya' : '') + '. Tetapkan di Kelola Pengguna.</div></div>';
  if (!rows.length) return h + kosong_('Belum ada PIC aktif' + (fb ? ' di bidang ' + fb : '') + '.', 'person_off') + '</section>';
  h += '<div class="stack">' + rows.map(r => {
    const u = r.u;
    return '<details class="pic-task"><summary><span class="avatar">' + esc_(String(u.Nama || u.Username).charAt(0).toUpperCase()) + '</span>' +
      '<span class="pt-who"><b>' + esc_(u.Nama) + '</b><span class="muted sm">@' + esc_(u.Username) + ' · ' + esc_(u.Bidang) + '</span></span>' +
      '<span class="pt-scope">' + chip_(u.Program || parseIk_(u.Indikator).length ? 'info' : 'mute', u.Program || parseIk_(u.Indikator).length ? 'PIC Program' : 'PIC Bidang') + '<span class="muted sm">' + esc_(r.cakupan) + '</span></span>' +
      '<span class="pt-prog">' + bar_(r.pct) + '<span class="muted sm">' + r.ok + ' dari ' + r.wajib + ' terinput</span></span>' +
      '<span class="pt-end">' + (r.tg ? chip_('crit', r.tg + ' tertunggak') : chip_('ok', r.wajib ? 'Tertib' : 'Belum ada tagihan')) + '</span></summary>' +
      '<div class="pt-list">' + (r.li.length ? r.li.map(i => '<span class="chip chip-' + (KLS[i.status] || 'mute') + ' pt-ind" title="' + esc_(i.nama + ' · ' + (LBL[i.status] || '') + ' · ' + i.frek) + '"><b>' + esc_(i.id) + '</b> ' + esc_(i.nama) + '</span>').join('') : '<span class="muted sm">Tidak ada indikator yang cocok dengan cakupan PIC ini.</span>') + '</div></details>';
  }).join('') + '</div></section>';
  return h;
}

function pageMonitoring_(m, user, params, ctx) {
  const k = m.kpi;
  const adm = user.role === 'admin', bisaKirim = user.role === 'admin' || user.role === 'pimpinan';
  let h = pageHead_('Monitoring Pengisian', 'Kelengkapan isian indikator per bidang dan bulan — ' + m.periodeLabel, bisaKirim ? '<button type="button" class="btn btn-alert" data-act="remind-open">' + ic_('notifications_active') + 'Kirim Pengingat</button>' : '');

  h += '<section class="grid g4">' + kpiCard_('Terinput', pct_(k.pctInput), (k.lengkap + k.menunggu) + ' dari ' + k.wajib + ' indikator wajib', k.pctInput >= 90 ? 'ok' : 'warn', 'fact_check') +
    kpiCard_('Lengkap', String(k.lengkap), 'Sudah terverifikasi', 'ok', 'verified') + kpiCard_('Menunggu Verifikasi', String(k.menunggu), 'Perlu persetujuan admin', 'info', 'hourglass_top') +
    kpiCard_('Tertunggak', String(k.menunggak), 'Belum diisi', 'crit', 'report') + '</section>';

  h += '<section class="card card-pad"><h2 class="h2 flat">Kepatuhan Bidang</h2><div class="grid g3">' + m.bidang.map(b =>
    '<div class="comp"><div class="comp-top"><b>' + esc_(b.nama) + '</b><span>' + esc_(pct_(b.pctInput)) + '</span></div>' + bar_(b.pctInput) + '<div class="muted sm">' + b.lengkap + ' lengkap · ' + b.menunggu + ' verifikasi · ' + b.menunggak + ' tertunggak</div></div>').join('') + '</div></section>';

  if (user.role !== 'pic') h += seksiTugasPic_(m, params);

  const bopts = [{ v: '', t: 'Semua bidang' }].concat(m.bidang.map(b => ({ v: b.nama, t: b.nama })));
  const hl = m.ind.filter(i => !params.bidang || i.bidang === params.bidang);
  h += '<section class="card card-pad"><div class="sec-top"><h2 class="h2 flat">Kalender Kelengkapan ' + m.tahun + '</h2>' + filterSel_('Bidang', 'bidang', bopts, params.bidang) + '</div>' +
    '<div class="legend legend-heat"><span><i class="hc hc-ok"></i>Lengkap</span><span><i class="hc hc-wait"></i>Menunggu verifikasi</span><span><i class="hc hc-miss"></i>Belum diisi</span><span><i class="hc hc-future"></i>Belum jatuh tempo</span><span><i class="hc hc-na"></i>Tidak wajib</span></div>' +
    '<div class="tbl-wrap"><table class="tbl heat"><thead><tr><th class="sticky">Indikator</th>' + BULAN_S.map(b => '<th class="c">' + b + '</th>').join('') + '</tr></thead><tbody>' +
    hl.map(i => '<tr><th class="sticky" scope="row"><span class="heat-name">' + esc_(i.nama) + '</span><span class="muted sm">' + esc_(i.id) + ' · ' + esc_(i.frek) + '</span></th>' +
      i.cells.map((c, idx) => {
        const b = idx + 1, lbl = { ok: 'Lengkap', wait: 'Menunggu verifikasi', miss: 'Belum diisi', future: 'Belum jatuh tempo', na: 'Tidak wajib' }[c];
        const bisa = bisaIsi_(user, i) && (c === 'miss' || c === 'ok' || c === 'wait');
        return '<td class="c">' + (bisa ? '<button type="button" class="hc hc-' + c + ' hc-btn" aria-label="' + esc_(i.nama + ' ' + BULAN[idx] + ': ' + lbl + '. Klik untuk mengisi') + '" ' + isiAttr_(i, b, ctx) + '></button>'
          : '<span class="hc hc-' + c + '" role="img" aria-label="' + esc_(BULAN[idx] + ': ' + lbl) + '"></span>') + '</td>';
      }).join('') + '</tr>').join('') + '</tbody></table></div></section>';

  const tung = m.ind.filter(i => i.status === 'menunggak').sort((a, b) => b.terlambat - a.terlambat);
  h += '<section class="card card-pad"><div class="sec-top"><h2 class="h2 flat">Tunggakan Mendesak</h2>' + chip_(tung.length ? 'crit' : 'ok', tung.length + ' indikator') + '</div>';
  h += tung.length ? '<div class="stack">' + tung.map(i =>
    '<div class="tung">' + (bisaKirim ? '<label class="chk"><input type="checkbox" class="chk-remind" value="' + esc_(i.id) + '" aria-label="Pilih ' + esc_(i.nama) + '"><span class="chk-box"></span></label>' : '') +
    '<div class="tung-main"><b>' + esc_(i.nama) + '</b><span class="muted sm">' + esc_(i.id) + ' · ' + esc_(i.bidang) + ' · PIC: ' + esc_(i.picNama || '—') + '</span>' +
    (i.kab.length ? '<span class="muted sm">Kabupaten tertunda: ' + esc_(i.kab.join(', ')) + '</span>' : '') + '</div>' +
    '<div class="tung-end">' + chip_(i.terlambat > 14 ? 'crit' : 'warn', i.terlambat ? 'Terlambat ' + i.terlambat + ' hari' : 'Jatuh tempo bulan ini') +
    (bisaIsi_(user, i) ? '<button type="button" class="btn btn-ghost btn-sm" ' + isiAttr_(i, i.missing[0], ctx) + '>Isi</button>' : '') + '</div></div>').join('') + '</div>' : kosong_('Tidak ada tunggakan. Pengisian tertib.', 'verified');
  h += '</section>';

  if (adm) {
    const wait = [];
    m.ind.forEach(i => i.cells.forEach((c, idx) => { if (c === 'wait') wait.push({ i: i, b: idx + 1 }); }));
    h += '<section class="card card-pad"><div class="sec-top"><h2 class="h2 flat">Antrean Verifikasi</h2>' + chip_(wait.length ? 'info' : 'ok', wait.length + ' menunggu') + '</div>';
    h += wait.length ? '<div class="stack">' + wait.map(w => {
      const r = ctx.isian[w.i.id + '|' + w.b] || {};
      return '<div class="tung"><div class="tung-main"><b>' + esc_(w.i.nama) + '</b><span class="muted sm">' + BULAN[w.b - 1] + ' · ' + esc_(val_(w.i.series[w.b - 1], w.i.satuan)) + ' · diisi ' + esc_(r.DiisiOleh || '—') + ' (' + esc_(tglId_(r.DiisiPada)) + ')</span></div>' +
        '<div class="tung-end"><button type="button" class="btn btn-primary btn-sm" data-act="verif" data-id="' + esc_(w.i.id) + '" data-bulan="' + w.b + '" data-setuju="1">Setujui</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="verif" data-id="' + esc_(w.i.id) + '" data-bulan="' + w.b + '" data-setuju="0">Kembalikan</button></div></div>';
    }).join('') + '</div>' : kosong_('Tidak ada isian yang menunggu verifikasi.', 'task_alt');
    h += '</section>';
  }

  const nm = {}; m.ind.forEach(i => { nm[i.id] = i.nama; });
  const log = Object.keys(ctx.isian).map(x => ctx.isian[x]).filter(r => r.DiisiPada).sort((a, b) => String(b.DiisiPada).localeCompare(String(a.DiisiPada))).slice(0, 8);
  h += '<section class="card card-pad"><h2 class="h2 flat">Log Update Terbaru</h2>';
  h += log.length ? '<ul class="timeline">' + log.map(r => '<li><i class="dot d-info"></i><div><b>' + esc_(nm[r.IndikatorID] || r.IndikatorID) + '</b><div class="muted sm">' + BULAN[Number(r.Bulan) - 1] + ' · ' + esc_(r.DiisiOleh) + ' · ' + esc_(tglId_(r.DiisiPada)) + ' · ' + esc_(r.Status) + '</div></div></li>').join('') + '</ul>' : kosong_('Belum ada aktivitas pengisian.', 'history');
  h += '</section>';
  return h;
}

/* ---------------- Halaman: Permasalahan & Rekomendasi ---------------- */

function pageRekomendasi_(m, user, params, ctx) {
  const idDiLihat = {};
  m.ind.forEach(i => { idDiLihat[i.id] = true; });
  const semua = readTable_(SHEET.MASALAH).filter(x => user.role !== 'pic' || (x.IndikatorID ? idDiLihat[String(x.IndikatorID)] : String(x.DibuatOleh) === String(user.nama)));
  const fs = params.status || '';
  const list = semua.filter(x => !fs || x.Status === fs).sort((a, b) => String(b.Tanggal).localeCompare(String(a.Tanggal)));
  const bidangOpts = m.bidang.map(b => b.nama);
  let h = pageHead_('Permasalahan & Rekomendasi', 'Catat hambatan, tindak lanjut, dan usulan kegiatan sebagai bahan perencanaan.', '<button type="button" class="btn btn-primary" data-act="toggle-form" data-target="form-masalah-card">' + ic_('add') + 'Catatan Baru</button>');

  h += '<section class="card card-pad form-card" id="form-masalah-card" hidden><h2 class="h2 flat">Catatan Baru</h2><form id="form-masalah" data-api="apiSimpanMasalah" novalidate>' +
    '<div class="form-grid">' + select_('Bidang', 'bidang', bidangOpts, user.bidang || bidangOpts[0]) +
    select_('Indikator terkait (opsional)', 'indikatorId', [{ v: '', t: '— Tidak spesifik —' }].concat(m.ind.map(i => ({ v: i.id, t: i.id + ' — ' + i.nama.slice(0, 70) }))), '') +
    select_('Prioritas', 'prioritas', ['Tinggi', 'Sedang', 'Rendah'], 'Sedang') + field_('Penanggung jawab tindak lanjut', 'penanggung', 'text', '', 'maxlength="80"') +
    field_('Tenggat (opsional)', 'tenggat', 'date', '') + '</div>' +
    field_('Permasalahan', 'permasalahan', 'textarea', '', 'required maxlength="1000" rows="3"') +
    field_('Rekomendasi / usulan kegiatan', 'rekomendasi', 'textarea', '', 'maxlength="1000" rows="3"') +
    '<div class="form-actions"><button class="btn btn-primary" type="submit">Simpan Catatan</button><button class="btn btn-ghost" type="button" data-act="toggle-form" data-target="form-masalah-card">Batal</button></div><p class="form-msg" role="alert"></p></form></section>';

  const terbuka = {}; semua.filter(x => x.Status !== 'Selesai').forEach(x => { if (x.IndikatorID) terbuka[x.IndikatorID] = 1; });
  const saran = m.ind.filter(i => i.tier === 'kritis' && !terbuka[i.id]).slice(0, 4);
  if (saran.length) {
    h += '<section class="card card-pad"><h2 class="h2 flat">Saran Otomatis</h2><p class="muted sm">Indikator berstatus Kritis yang belum memiliki catatan terbuka.</p><div class="stack">' + saran.map(i =>
      '<div class="tung"><div class="tung-main"><b>' + esc_(i.nama) + '</b><span class="muted sm">' + esc_(i.bidang) + ' · capaian ' + esc_(pct_(i.capaian)) + ' (realisasi ' + esc_(val_(i.realisasi, i.satuan)) + ' vs target ' + esc_(val_(i.target, i.satuan)) + ')</span></div>' +
      '<div class="tung-end"><button type="button" class="btn btn-alert btn-sm" data-act="prefill-masalah" data-ind="' + esc_(i.id) + '" data-bidang="' + esc_(i.bidang) + '">Buat catatan</button></div></div>').join('') + '</div></section>';
  }

  h += '<div class="filters card card-flat">' + filterSel_('Status', 'status', [{ v: '', t: 'Semua status' }, { v: 'Terbuka', t: 'Terbuka' }, { v: 'Proses', t: 'Proses' }, { v: 'Selesai', t: 'Selesai' }], fs) + '<span class="chip chip-info">' + list.length + ' catatan</span></div>';
  h += list.length ? '<div class="stack">' + list.map(x => {
    const bisa = user.role === 'admin' || (user.role === 'pic' && x.Bidang === user.bidang);
    return '<article class="card card-pad note note-' + (x.Prioritas === 'Tinggi' ? 'crit' : x.Prioritas === 'Sedang' ? 'warn' : 'info') + '">' +
      '<div class="note-top">' + chip_(x.Prioritas === 'Tinggi' ? 'crit' : x.Prioritas === 'Sedang' ? 'warn' : 'info', 'Prioritas ' + x.Prioritas) + chip_(x.Status === 'Selesai' ? 'ok' : x.Status === 'Proses' ? 'info' : 'mute', x.Status) +
      '<span class="muted sm">' + esc_(x.Bidang) + (x.IndikatorID ? ' · ' + esc_(x.IndikatorID) : '') + ' · ' + esc_(tglId_(x.Tanggal)) + '</span></div>' +
      '<p>' + esc_(x.Permasalahan) + '</p>' + (x.Rekomendasi ? '<p class="note-sol">' + ic_('lightbulb') + '<span>' + esc_(x.Rekomendasi) + '</span></p>' : '') +
      '<div class="muted sm">Dibuat oleh ' + esc_(x.DibuatOleh) + (x.Penanggung ? ' · Penanggung jawab: ' + esc_(x.Penanggung) : '') + (x.Tenggat ? ' · Tenggat ' + esc_(tglId_(x.Tenggat)) : '') + '</div>' +
      (bisa ? '<div class="note-actions">' + ['Terbuka', 'Proses', 'Selesai'].filter(s => s !== x.Status).map(s => '<button type="button" class="btn btn-ghost btn-sm" data-act="masalah-status" data-id="' + esc_(x.ID) + '" data-status="' + s + '">Tandai ' + s + '</button>').join('') + '</div>' : '') + '</article>';
  }).join('') + '</div>' : kosong_('Belum ada catatan pada filter ini.', 'forum');
  return h;
}

/* ---------------- Halaman: Laporan Eksekutif ---------------- */

const RPT_CSS = '.rpt{font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:12px;line-height:1.5}.rpt h1{font-size:20px;margin:0 0 2px}.rpt h2{font-size:14px;margin:18px 0 6px;color:#0284c7;border-bottom:1px solid #e2e8f0;padding-bottom:3px}.rpt table{width:100%;border-collapse:collapse}.rpt th,.rpt td{border:1px solid #e2e8f0;padding:4px 6px;text-align:left;vertical-align:top}.rpt th{background:#e0f2fe}.rpt .r{text-align:right}.rpt .sm{color:#475569;font-size:11px}.rpt .ok{color:#059669;font-weight:bold}.rpt .warn{color:#ea580c;font-weight:bold}.rpt .crit{color:#dc2626;font-weight:bold}.rpt .kp{display:inline-block;border:1px solid #e2e8f0;padding:6px 12px;margin:0 6px 6px 0}.rpt .kp b{font-size:18px;display:block}';

function laporanBody_(m) {
  const k = m.kpi;
  const cls = t => ({ tercapai: 'ok', waspada: 'warn', kritis: 'crit', belum: '' }[t]);
  const ms = readTable_(SHEET.MASALAH).filter(x => x.Status !== 'Selesai');
  let h = '<div class="rpt"><h1>Ringkasan Eksekutif Indikator Kesehatan</h1><div class="sm">' + esc_(m.cfg.NamaDinas) + '<br>Periode: ' + esc_(m.periodeLabel) + ' · Dicetak ' + esc_(nowStr_()) + '</div>';
  h += '<h2>1. Ringkasan</h2><div><span class="kp"><b>' + k.total + '</b>Total indikator</span><span class="kp"><b class="ok">' + k.tercapai + '</b>Tercapai</span><span class="kp"><b class="warn">' + k.waspada + '</b>Waspada</span><span class="kp"><b class="crit">' + k.kritis + '</b>Kritis</span><span class="kp"><b>' + esc_(pct_(k.pctInput)) + '</b>Kepatuhan pengisian</span><span class="kp"><b>' + esc_(pct_(k.rataCapaian)) + '</b>Rata-rata capaian</span></div>';
  h += '<h2>2. Capaian dan Kepatuhan per Bidang</h2><table><tr><th>Bidang</th><th class="r">Indikator</th><th class="r">Capaian</th><th class="r">Pengisian</th><th class="r">Tertunggak</th></tr>' +
    m.bidang.map(b => '<tr><td>' + esc_(b.nama) + '</td><td class="r">' + b.total + '</td><td class="r">' + esc_(pct_(b.capaian)) + '</td><td class="r">' + esc_(pct_(b.pctInput)) + '</td><td class="r">' + b.menunggak + '</td></tr>').join('') + '</table>';
  h += '<h2>3. Rincian Indikator</h2><table><tr><th>ID</th><th>Indikator</th><th>Bidang</th><th class="r">Target</th><th class="r">Realisasi</th><th class="r">Capaian</th><th>Status</th></tr>' +
    m.ind.map(i => '<tr><td>' + esc_(i.id) + '</td><td>' + esc_(i.nama) + '</td><td>' + esc_(i.bidang) + '</td><td class="r">' + esc_(val_(i.target, i.satuan)) + '</td><td class="r">' + esc_(val_(i.realisasi, i.satuan)) + '</td><td class="r">' + esc_(pct_(i.capaian)) + '</td><td class="' + cls(i.tier) + '">' + esc_(TIER_LABEL[i.tier]) + '</td></tr>').join('') + '</table>';
  h += '<h2>4. Permasalahan dan Rekomendasi</h2>';
  h += ms.length ? '<table><tr><th>Bidang</th><th>Prioritas</th><th>Permasalahan</th><th>Rekomendasi</th><th>Status</th></tr>' + ms.map(x => '<tr><td>' + esc_(x.Bidang) + '</td><td>' + esc_(x.Prioritas) + '</td><td>' + esc_(x.Permasalahan) + '</td><td>' + esc_(x.Rekomendasi) + '</td><td>' + esc_(x.Status) + '</td></tr>').join('') + '</table>' : '<p class="sm">Tidak ada permasalahan terbuka.</p>';
  h += '<p class="sm">Catatan: capaian = realisasi ÷ target (indikator berarah turun: target ÷ realisasi). Tercapai ≥ 100%, Waspada 80–99%, Kritis &lt; 80%.</p></div>';
  return h;
}
function laporanPdfHtml_(m) {
  return '<html><head><meta charset="utf-8"><style>' + RPT_CSS + 'body{margin:24px}</style></head><body>' + laporanBody_(m) + '</body></html>';
}
function formTarik_(m) {
  const nPer = {};
  m.ind.forEach(i => { nPer[i.bidang] = (nPer[i.bidang] || 0) + 1; });
  return '<section class="card card-pad" id="tarik-data"><div class="sec-top"><div><h2 class="h2 flat">Tarik Data</h2><p class="muted sm">Pilih bidang atau indikator tertentu, lalu unduh sebagai PDF atau CSV (Excel). Periode mengikuti pilihan di bagian atas: ' + esc_(m.periodeLabel) + '.</p></div></div>' +
    '<form id="form-tarik" novalidate><div class="tk-grid">' +
    '<fieldset class="tk-col"><legend>Bidang <span class="muted sm">(kosong = semua)</span></legend><div class="tk-box">' +
    m.bidang.map(b => '<label class="ik-item"><input type="checkbox" name="tk-bidang" value="' + esc_(b.nama) + '"><span><b>' + esc_(b.nama) + '</b> <em>' + (nPer[b.nama] || 0) + ' indikator</em></span></label>').join('') + '</div></fieldset>' +
    '<fieldset class="tk-col"><legend>Indikator <span class="muted sm">(kosong = semua dari bidang terpilih)</span></legend>' +
    '<div class="ik-tools"><button type="button" class="btn btn-ghost btn-sm" data-act="tk-all">Pilih semua yang tampil</button><button type="button" class="btn btn-ghost btn-sm" data-act="tk-none">Kosongkan</button></div>' +
    '<div class="tk-box">' + m.ind.map(i => '<label class="ik-item" data-bidang="' + esc_(i.bidang) + '"><input type="checkbox" name="tk-ik" value="' + esc_(i.id) + '"><span><b>' + esc_(i.id) + '</b> ' + esc_(i.nama) + ' <em>' + esc_(i.bidang) + '</em></span></label>').join('') + '</div></fieldset></div>' +
    '<p class="muted sm" data-tk-info></p>' +
    '<div class="form-actions"><button type="button" class="btn btn-primary" data-act="tarik" data-format="pdf">' + ic_('picture_as_pdf') + 'Unduh PDF</button>' +
    '<button type="button" class="btn btn-ghost" data-act="tarik" data-format="csv">' + ic_('table_view') + 'Unduh CSV (Excel)</button></div><p class="form-msg" role="alert"></p></form></section>';
}

function pageLaporan_(m, user) {
  return pageHead_('Laporan Eksekutif', 'Pratinjau ringkasan untuk pimpinan. Unduh seluruhnya, atau tarik data per bidang dan indikator.', '<button type="button" class="btn btn-primary" data-act="pdf">' + ic_('download') + 'Unduh PDF Lengkap</button>') +
    formTarik_(m) +
    '<section class="card card-pad"><style>' + RPT_CSS + '</style>' + laporanBody_(m) + '</section>';
}

/* ---------------- Halaman: Input Data (per indikator, sesuai tanggung jawab PIC) ---------------- */

function pageInputData_(m, user, params, ctx) {
  const adm = user.role === 'admin';
  const fb = adm ? String(params.bidang || '') : '';
  const fs = String(params.status || '');
  const q = String(params.q || '').toLowerCase().trim();
  const semua = m.ind.filter(i => bisaIsi_(user, i));
  const perlu = i => i.cells.indexOf('miss') >= 0;
  const menunggu = i => i.cells.indexOf('wait') >= 0;
  let li = semua.filter(i => (!fb || i.bidang === fb) && (!q || (i.id + ' ' + i.nama + ' ' + i.programNama).toLowerCase().indexOf(q) >= 0));
  if (fs === 'perlu') li = li.filter(perlu);
  else if (fs === 'menunggu') li = li.filter(menunggu);
  li.sort((a, b) => a.bidang.localeCompare(b.bidang) || a.programNama.localeCompare(b.programNama) || a.id.localeCompare(b.id));

  let h = pageHead_('Input Data', adm ? 'Isi realisasi per indikator untuk semua bidang. Tekan bulan untuk mengisi.' : 'Isi realisasi untuk indikator yang menjadi tanggung jawab Anda. Tekan bulan untuk mengisi.', '');
  const sb = statusBatas_(m.cfg), nPerlu = semua.filter(perlu).length;
  if (sb && nPerlu) {
    const tone = sb.terlambat ? 'crit' : sb.sisa <= 3 ? 'warn' : 'info';
    const teks = sb.terlambat ? 'Batas pengisian (tanggal ' + sb.batas + ') sudah lewat ' + (-sb.sisa) + ' hari.' : sb.sisa === 0 ? 'Hari ini batas pengisian (tanggal ' + sb.batas + ').' : 'Batas pengisian tanggal ' + sb.batas + ', ' + sb.sisa + ' hari lagi.';
    h += '<div class="batas-bar batas-' + tone + '" role="status"><b>' + esc_(teks) + '</b> ' + nPerlu + ' indikator masih ada bulan yang belum diisi.</div>';
  }
  h += '<section class="grid g4">' + kpiCard_('Indikator saya', String(semua.length), adm ? 'Seluruh indikator aktif' : 'Hanya yang ditugaskan kepada Anda', 'info', 'rule') +
    kpiCard_('Perlu diisi', String(semua.filter(perlu).length), 'Ada bulan belum diisi', semua.some(perlu) ? 'crit' : 'ok', 'edit_note') +
    kpiCard_('Menunggu verifikasi', String(semua.filter(menunggu).length), 'Menunggu persetujuan admin', 'info', 'hourglass_top') +
    kpiCard_('Lengkap', String(semua.filter(i => i.status === 'lengkap').length), 'Seluruh bulan jatuh tempo terisi', 'ok', 'verified') + '</section>';
  h += '<div class="filters card card-flat"><label class="search"><span class="sr">Cari indikator</span>' + ic_('search') + '<input type="search" class="input input-search f-param" data-param="q" value="' + esc_(params.q || '') + '" placeholder="Cari nama, ID, atau program" maxlength="60"></label>' +
    filterSel_('Status', 'status', [{ v: '', t: 'Semua indikator' }, { v: 'perlu', t: 'Perlu diisi' }, { v: 'menunggu', t: 'Menunggu verifikasi' }], fs) +
    (adm ? filterSel_('Bidang', 'bidang', [{ v: '', t: 'Semua bidang' }].concat(m.bidang.map(b => ({ v: b.nama, t: b.nama }))), fb) : '') + '</div>';
  h += '<div class="legend legend-heat"><span><i class="hc hc-ok"></i>Lengkap</span><span><i class="hc hc-wait"></i>Menunggu verifikasi</span><span><i class="hc hc-miss"></i>Belum diisi</span><span><i class="hc hc-future"></i>Belum jatuh tempo</span></div>';
  if (!li.length) return h + '<section class="card card-pad">' + kosong_(semua.length ? 'Tidak ada indikator yang cocok dengan filter.' : 'Belum ada indikator yang ditugaskan kepada Anda. Hubungi admin.', 'inbox') + '</section>';
  h += '<div class="im-grid">' + li.map(i => {
    const lbl = { ok: 'Lengkap', wait: 'Menunggu verifikasi', miss: 'Belum diisi', future: 'Belum jatuh tempo', na: 'Tidak wajib' };
    const strip = i.due.map(b => {
      const c = i.cells[b - 1], nama = BULAN_S[b - 1];
      return (c === 'miss' || c === 'ok' || c === 'wait')
        ? '<button type="button" class="im-m im-' + c + '" ' + isiAttr_(i, b, ctx) + ' aria-label="' + esc_(i.nama + ' ' + BULAN[b - 1] + ': ' + lbl[c] + '. Tekan untuk mengisi') + '">' + nama + '</button>'
        : '<span class="im-m im-future" aria-label="' + esc_(BULAN[b - 1] + ': ' + (lbl[c] || '')) + '">' + nama + '</span>';
    }).join('');
    return '<article class="card card-pad im-card"><div class="im-top"><div class="im-id"><div class="ir-id">' + esc_(i.id) + ' · ' + esc_(i.bidang) + (i.programNama ? ' · ' + esc_(i.programNama) : '') + '</div>' +
      '<h3 class="ir-name">' + esc_(i.nama) + '</h3><div class="muted sm">' + esc_(i.frek) + ' · target ' + (i.arah === 'Turun' ? '≤ ' : '≥ ') + esc_(val_(i.target, i.satuan)) + '</div></div>' +
      '<div class="im-end">' + tierChip_(i.tier) + buktiBtn_(i) + '</div></div>' +
      '<div class="muted sm">Realisasi terakhir <b>' + esc_(val_(i.realisasi, i.satuan)) + '</b>' + (i.realBulan ? ' per ' + BULAN[i.realBulan - 1] : '') + ' · capaian ' + esc_(pct_(i.capaian)) + '</div>' +
      '<div class="im-strip" role="group" aria-label="Bulan pelaporan">' + strip + '</div></article>';
  }).join('') + '</div>';
  return h;
}

/* ---------------- Halaman: Permintaan Data ---------------- */

function pagePermintaan_(m, user) {
  const all = readTable_(SHEET.PERMINTAAN).sort((a, b) => String(b.Tanggal).localeCompare(String(a.Tanggal)));
  const list = user.role === 'admin' ? all : all.filter(x => x.Pemohon === user.nama);
  let h = pageHead_('Permintaan Data', 'Ajukan kebutuhan data untuk perencanaan, laporan, atau koordinasi lintas instansi.', '');
  h += '<section class="card card-pad"><h2 class="h2 flat">Ajukan Permintaan</h2><form id="form-permintaan" data-api="apiSimpanPermintaan" novalidate><div class="form-grid">' +
    field_('Instansi / unit pemohon', 'instansi', 'text', user.bidang || '', 'maxlength="100"') + select_('Format yang diinginkan', 'format', ['Excel', 'PDF', 'Dasbor', 'Lainnya'], 'Excel') + field_('Dibutuhkan paling lambat (opsional)', 'tenggat', 'date', '') + '</div>' +
    field_('Data yang dibutuhkan', 'kebutuhan', 'textarea', '', 'required maxlength="1000" rows="3" placeholder="Contoh: capaian imunisasi dasar lengkap per kabupaten semester I"') +
    '<div class="form-actions"><button class="btn btn-alert" type="submit">Kirim Permintaan</button></div><p class="form-msg" role="alert"></p></form></section>';
  h += '<section class="card card-pad"><div class="sec-top"><h2 class="h2 flat">' + (user.role === 'admin' ? 'Semua Permintaan' : 'Permintaan Saya') + '</h2>' + chip_('info', list.length + ' permintaan') + '</div>';
  h += list.length ? '<div class="stack">' + list.map(x => '<div class="tung"><div class="tung-main"><b>' + esc_(x.Kebutuhan) + '</b><span class="muted sm">' + esc_(x.ID) + ' · ' + esc_(x.Pemohon) + ' (' + esc_(x.Instansi) + ') · ' + esc_(tglId_(x.Tanggal)) + ' · ' + esc_(x.Format) + (x.Tenggat ? ' · paling lambat ' + esc_(tglId_(x.Tenggat)) : '') + '</span>' + (x.Catatan ? '<span class="muted sm">Catatan: ' + esc_(x.Catatan) + '</span>' : '') + '</div>' +
    '<div class="tung-end">' + chip_({ Baru: 'warn', Diproses: 'info', Selesai: 'ok', Ditolak: 'crit' }[x.Status] || 'mute', x.Status) +
    (user.role === 'admin' ? ['Diproses', 'Selesai', 'Ditolak'].filter(s => s !== x.Status).map(s => '<button type="button" class="btn btn-ghost btn-sm" data-act="permintaan-status" data-id="' + esc_(x.ID) + '" data-status="' + s + '">' + s + '</button>').join('') : '') + '</div></div>').join('') + '</div>' : kosong_('Belum ada permintaan.', 'inbox');
  return h + '</section>';
}

/* ---------------- Halaman: Pengaturan ---------------- */

const EMBLEM_SVG_ = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="13.2" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4"/><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff"/></svg>';

function pagePengaturan_(m, user, params, ctx) {
  let h = pageHead_('Pengaturan', 'Akun' + (user.role === 'admin' ? ', periode pelaporan, indikator, dan pengguna.' : ' Anda.'), '');
  h += '<section class="card card-pad"><h2 class="h2 flat">Ubah Kata Sandi</h2><form id="form-pwd" data-api="apiUbahPassword" novalidate><div class="form-grid">' +
    field_('Kata sandi lama', 'lama', 'password', '', 'required autocomplete="current-password"') + field_('Kata sandi baru (min. 8 karakter)', 'baru', 'password', '', 'required minlength="8" autocomplete="new-password"') +
    field_('Ulangi kata sandi baru', 'ulang', 'password', '', 'required autocomplete="new-password"') + '</div>' +
    '<div class="form-actions"><button class="btn btn-primary" type="submit">Simpan Kata Sandi</button></div><p class="form-msg" role="alert"></p></form></section>';
  if (user.role !== 'admin') return h;

  const c = m.cfg;
  h += '<section class="card card-pad"><h2 class="h2 flat">Periode &amp; Konfigurasi</h2><form id="form-config" data-api="apiSimpanConfig" novalidate><div class="form-grid">' +
    field_('Tahun pelaporan', 'tahun', 'number', c.Tahun, 'min="2000" max="2100" required') + select_('Bulan aktif', 'bulan', BULAN.map((b, i) => ({ v: i + 1, t: b })), c.BulanAktif) +
    field_('Batas cut-off', 'cutoff', 'date', c.Cutoff) + field_('Daftar kabupaten (pisahkan koma)', 'kabupaten', 'text', c.Kabupaten.join(', '), 'required') + '</div>' +
    field_('Nama perangkat daerah', 'namaDinas', 'text', c.NamaDinas, 'maxlength="200"') +
    '<h3 class="h3 sub-h">Batas Pengisian &amp; Pengingat</h3><div class="form-grid">' +
    field_('Batas pengisian tiap bulan (tanggal 1–28, kosongkan bila tidak dipakai)', 'batasIsi', 'number', c.BatasIsi || '', 'min="0" max="28"') +
    select_('Pengingat email otomatis', 'pengingatAuto', ['Ya', 'Tidak'], c.PengingatAuto ? 'Ya' : 'Tidak') +
    field_('Mulai mengingatkan (hari sebelum batas)', 'pengingatHari', 'number', c.PengingatHari || 3, 'min="1" max="14"') + '</div>' +
    '<p class="muted sm">Setiap pagi sistem mengirim email ke PIC yang indikatornya belum lengkap, mulai beberapa hari sebelum batas hingga 10 hari setelahnya. Admin dan pimpinan menerima ringkasannya. PIC tanpa email tidak bisa dikirimi.</p>' +
    '<h3 class="h3 sub-h">Identitas Aplikasi</h3><div class="form-grid">' +
    field_('Nama aplikasi', 'namaApp', 'text', c.NamaApp, 'required maxlength="40" autocomplete="off"') + field_('Subjudul (boleh dikosongkan)', 'subApp', 'text', c.SubApp, 'maxlength="40" autocomplete="off"') + '</div>' +
    '<div class="logo-ed"><div class="logo-prev" id="logo-prev" data-default="' + esc_(EMBLEM_SVG_) + '">' + (c.LogoUrl ? '<img src="' + esc_(c.LogoUrl) + '" alt="Logo saat ini" referrerpolicy="no-referrer">' : EMBLEM_SVG_) + '</div>' +
    '<div class="logo-ctl"><div class="row-actions"><input type="file" id="logo-file" accept="image/png,image/jpeg,image/webp" hidden><button type="button" class="btn btn-ghost btn-sm" data-act="logo-pilih">' + ic_('upload') + 'Unggah logo</button><button type="button" class="btn btn-ghost btn-sm" data-act="logo-hapus">Pakai logo bawaan</button></div>' +
    '<span class="muted sm" id="logo-info">PNG, JPG, atau WebP. Gambar otomatis diperkecil (maks. 256 px). Logo juga menjadi ikon tab browser.</span></div></div>' +
    '<input type="hidden" name="logoData" value=""><input type="hidden" name="logoKeep" value="' + (/^data:/.test(c.LogoUrl || '') ? '1' : '') + '">' +
    field_('Atau URL logo (opsional, https://…, tautan langsung ke gambar)', 'logoUrl', 'url', /^https:/.test(c.LogoUrl || '') ? c.LogoUrl : '', 'maxlength="600" placeholder="https://…/logo.png"') +
    '<div class="form-actions"><button class="btn btn-primary" type="submit">Simpan Konfigurasi</button></div><p class="form-msg" role="alert"></p></form></section>';

  const users = readTable_(SHEET.USERS);
  const allInd = readTable_(SHEET.INDIKATOR);
  h += '<section class="card card-pad"><div class="sec-top"><h2 class="h2 flat">Indikator</h2><button type="button" class="btn btn-ghost btn-sm" data-act="edit-ind" data-json="{}">' + ic_('add') + 'Tambah</button></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Indikator</th><th>Bidang</th><th>Jenis</th><th>Frekuensi</th><th>Program</th><th class="r">Target</th><th></th></tr></thead><tbody>' +
    allInd.map(i => '<tr><td>' + esc_(i.ID) + '</td><td>' + esc_(i.Nama) + (String(i.Aktif).toLowerCase() === 'tidak' ? ' ' + chip_('mute', 'Nonaktif') : '') + '</td><td>' + esc_(i.Bidang) + '</td><td>' + esc_(i.Jenis) + '</td><td>' + esc_(i.Frekuensi) + '</td><td>' + (esc_((m.program.filter(p => p.id === String(i.Program))[0] || {}).nama) || '<span class="muted">—</span>') + '</td><td class="r">' + esc_(num_(i.Target)) + ' ' + esc_(i.Satuan) + '</td>' +
      '<td class="r"><button type="button" class="btn btn-ghost btn-sm" data-act="edit-ind" data-json="' + esc_(JSON.stringify({ id: i.ID, nama: i.Nama, bidang: i.Bidang, jenis: i.Jenis, frekuensi: i.Frekuensi, satuan: i.Satuan, target: i.Target, arah: i.Arah, pic: i.PIC, program: i.Program || '', aktif: String(i.Aktif).toLowerCase() !== 'tidak' })) + '">Ubah</button></td></tr>').join('') + '</tbody></table></div>' +
    '<form id="form-indikator" class="form-card sub-form" data-api="apiSimpanIndikator" hidden novalidate><h3 class="h3">Form Indikator</h3><div class="form-grid">' +
    field_('ID', 'id', 'text', '', 'required maxlength="20"') + select_('Bidang', 'bidang', m.bidang.map(b => b.nama), '') + select_('Jenis', 'jenis', ENUM_JENIS, 'Kesehatan') + select_('Frekuensi', 'frekuensi', ENUM_FREK, 'Bulanan') +
    field_('Satuan', 'satuan', 'text', '%', 'maxlength="20"') + field_('Target', 'target', 'number', '', 'step="any" min="0" required') + select_('Arah target', 'arah', [{ v: 'Naik', t: 'Naik (semakin tinggi semakin baik)' }, { v: 'Turun', t: 'Turun (semakin rendah semakin baik)' }], 'Naik') +
    select_('PIC', 'pic', [{ v: '', t: '— Belum ditetapkan —' }].concat(users.filter(u => u.Role === 'pic').map(u => ({ v: u.Username, t: u.Nama }))), '') +
    select_('Program (opsional)', 'program', [{ v: '', t: '— Tanpa program —' }].concat(m.program.filter(p => p.aktif).map(p => ({ v: p.id, t: p.nama + ' (' + p.bidang + ')' }))), '') +
    select_('Status', 'aktif', [{ v: 'true', t: 'Aktif' }, { v: 'false', t: 'Nonaktif' }], 'true') + '</div>' +
    field_('Nama indikator', 'nama', 'text', '', 'required maxlength="200"') +
    '<div class="form-actions"><button class="btn btn-primary" type="submit">Simpan Indikator</button><button type="button" class="btn btn-ghost" data-act="toggle-form" data-target="form-indikator">Tutup</button></div><p class="form-msg" role="alert"></p></form></section>';

  h += '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">Pengguna</h2><p class="muted sm">Tambah akun, atur ulang kata sandi, dan nonaktifkan pengguna di menu khusus.</p></div>' +
    '<button type="button" class="btn btn-primary btn-sm" data-nav="pengguna">' + ic_('group') + 'Kelola Pengguna</button></div></section>';

  const log = readTable_(SHEET.LOG).slice(-12).reverse();
  h += '<section class="card card-pad"><h2 class="h2 flat">Log Aktivitas</h2>' + (log.length ? '<ul class="timeline">' + log.map(l => '<li><i class="dot d-info"></i><div><b>' + esc_(l.Jenis) + '</b> · ' + esc_(l.Aktor) + '<div class="muted sm">' + esc_(l.Deskripsi) + ' · ' + esc_(String(l.Waktu).slice(0, 16)) + '</div></div></li>').join('') + '</ul>' : kosong_('Belum ada log.')) + '</section>';
  return h;
}

/* ---------------- Halaman: Kelola Pengguna (admin) ---------------- */

function pagePengguna_(m, user, params) {
  const users = readTable_(SHEET.USERS);
  const aktifBool = u => String(u.Aktif).toLowerCase() !== 'tidak';
  const tab = params.tab === 'program' ? 'program' : 'pengguna';
  const progNama = {};
  m.program.forEach(p => { progNama[p.id] = p; });
  const bopts = [{ v: '', t: '— Pilih bidang —' }].concat(m.bidang.map(b => ({ v: b.nama, t: b.nama })));

  let h = pageHead_('Kelola Pengguna', tab === 'program' ? 'Atur program di bawah bidang atau sub-bidang, lalu tetapkan PIC yang mengisi indikator program itu.' : 'Tambah akun baru, ubah peran dan bidang, atur ulang kata sandi, atau nonaktifkan pengguna.',
    tab === 'program'
      ? '<button type="button" class="btn btn-ghost" data-act="user-form" data-json=\'{"role":"pic"}\'>' + ic_('person_add') + 'Tambah PIC Program</button><button type="button" class="btn btn-primary" data-act="program-form" data-json="{}">' + ic_('add') + 'Tambah Program</button>'
      : '<button type="button" class="btn btn-primary" data-act="user-form" data-json="{}">' + ic_('person_add') + 'Tambah Pengguna</button>');
  h += '<div class="seg seg-main" role="group" aria-label="Bagian">' +
    [{ id: 'pengguna', label: 'Pengguna', icon: 'group' }, { id: 'program', label: 'PIC Program', icon: 'account_tree' }].map(t =>
      '<button type="button" class="seg-btn' + (t.id === tab ? ' is-on' : '') + '" data-nav="pengguna" data-params=\'{"tab":"' + t.id + '"}\'' + (t.id === tab ? ' aria-current="true"' : '') + '>' + ic_(t.icon) + '<span>' + t.label + '</span></button>').join('') + '</div>';

  if (tab === 'program') h += tabProgram_(m, users, params, aktifBool); else h += tabPengguna_(m, users, params, user, aktifBool, progNama);

  // Templat formulir (dipakai JavaScript untuk membuka modal)
  const progOpts = m.program.filter(p => p.aktif).map(p => '<option value="' + esc_(p.id) + '" data-bidang="' + esc_(p.bidang) + '">' + esc_(p.nama + (p.sub ? ' — ' + p.sub : '') + ' (' + p.bidang + ')') + '</option>').join('');
  h += '<template id="tpl-user-form"><form id="form-user-modal" novalidate><div class="form-grid">' +
    field_('Nama lengkap', 'nama', 'text', '', 'required maxlength="100" autocomplete="off"') +
    field_('Nama pengguna (untuk masuk)', 'username', 'text', '', 'required maxlength="40" autocomplete="off" autocapitalize="none" pattern="[a-z0-9._\\-]{3,40}"') +
    select_('Peran', 'role', [{ v: 'pic', t: 'PIC — mengisi indikator (bidang atau program)' }, { v: 'pimpinan', t: 'Pimpinan — melihat dan mengingatkan' }, { v: 'admin', t: 'Administrator — kelola semua data' }], 'pic') +
    '<div data-bidang-wrap>' + select_('Bidang', 'bidang', bopts, '') + '</div>' +
    '<div data-program-wrap class="field"><label for="f_program_x">Program (opsional)</label><select class="input" id="f_program_x" name="program"><option value="">— Seluruh bidang (PIC Bidang) —</option>' + progOpts + '</select>' +
    '<span class="muted sm">Pilih program agar PIC hanya mengisi indikator program itu. Kosongkan untuk PIC seluruh bidang.</span></div>' +
    '<div data-ik-wrap class="field ik-field"><label>Indikator yang diinput <span class="muted sm" data-ik-info></span></label>' +
    '<div class="ik-tools"><button type="button" class="btn btn-ghost btn-sm" data-act="ik-prog" data-ik-prog hidden>Pilih indikator program ini</button><button type="button" class="btn btn-ghost btn-sm" data-act="ik-all">Pilih semua</button><button type="button" class="btn btn-ghost btn-sm" data-act="ik-none">Kosongkan</button></div>' +
    '<div class="ik-box">' + m.ind.map(i => '<label class="ik-item" data-bidang="' + esc_(i.bidang) + '" data-program="' + esc_(i.program) + '"><input type="checkbox" name="ik" value="' + esc_(i.id) + '"><span><b>' + esc_(i.id) + '</b> ' + esc_(i.nama) + (i.programNama ? ' <em>' + esc_(i.programNama) + '</em>' : '') + '</span></label>').join('') + '</div>' +
    '<span class="muted sm">Bila ada yang dipilih, PIC ini hanya mengisi indikator tersebut. Kosongkan untuk memakai cakupan program atau seluruh bidang.</span></div>' +
    field_('Email', 'email', 'email', '', 'maxlength="120" autocomplete="off"') +
    field_('Telepon / WhatsApp', 'telepon', 'tel', '', 'maxlength="20" autocomplete="off"') +
    select_('Status akun', 'aktif', [{ v: 'true', t: 'Aktif' }, { v: 'false', t: 'Nonaktif' }], 'true') +
    '<div data-sandi-baru>' + select_('Kata sandi awal', 'modeSandi', [{ v: 'otomatis', t: 'Buat otomatis (disarankan)' }, { v: 'manual', t: 'Saya tentukan sendiri' }], 'otomatis') + '</div>' +
    '</div><div data-sandi-manual hidden>' + field_('Kata sandi (minimal 8 karakter)', 'password', 'password', '', 'minlength="8" autocomplete="new-password"') + '</div>' +
    '<div data-sandi-ubah hidden>' + field_('Kata sandi baru (kosongkan jika tidak diubah)', 'passwordUbah', 'password', '', 'minlength="8" autocomplete="new-password"') + '</div>' +
    '<div class="form-actions"><button class="btn btn-primary" type="submit">Simpan Pengguna</button><button type="button" class="btn btn-ghost" data-act="close-modal">Batal</button></div><p class="form-msg" role="alert"></p></form></template>';
  h += '<template id="tpl-program-form"><form id="form-program-modal" novalidate><input type="hidden" name="id"><div class="form-grid">' +
    field_('Nama program', 'nama', 'text', '', 'required maxlength="100" autocomplete="off"') +
    select_('Bidang', 'bidang', bopts, '', 'required') +
    field_('Sub-bidang / seksi (opsional)', 'sub', 'text', '', 'maxlength="80" autocomplete="off" placeholder="mis. Seksi Gizi dan KIA"') +
    select_('Status', 'aktif', [{ v: 'true', t: 'Aktif' }, { v: 'false', t: 'Nonaktif' }], 'true') + '</div>' +
    '<div class="form-actions"><button class="btn btn-primary" type="submit">Simpan Program</button><button type="button" class="btn btn-ghost" data-act="close-modal">Batal</button></div><p class="form-msg" role="alert"></p></form></template>';
  return h;
}

/** Katalog indikator kesehatan yang umum dipakai. [nama, bidang, jenis, frekuensi, satuan, target, arah] */
const KATALOG_IND_ = [
  ['Angka Kematian Ibu (AKI)', 'Kesprimkom', 'IKU', 'Tahunan', 'per 100.000 KH', 189, 'Turun'],
  ['Angka Kematian Bayi (AKB)', 'Kesprimkom', 'IKU', 'Tahunan', 'per 1.000 KH', 16, 'Turun'],
  ['Cakupan ASI Eksklusif Bayi < 6 Bulan', 'Kesprimkom', 'Kesehatan', 'Bulanan', '%', 80, 'Naik'],
  ['Cakupan Kunjungan Neonatal Pertama (KN1)', 'Kesprimkom', 'SPM', 'Bulanan', '%', 90, 'Naik'],
  ['Ibu Hamil KEK Mendapat Makanan Tambahan', 'Kesprimkom', 'Kesehatan', 'Bulanan', '%', 90, 'Naik'],
  ['Remaja Putri Mendapat Tablet Tambah Darah', 'Kesprimkom', 'Kesehatan', 'Semester', '%', 80, 'Naik'],
  ['Prevalensi Balita Wasting', 'Kesprimkom', 'Kesehatan', 'Semester', '%', 7, 'Turun'],
  ['Angka Keberhasilan Pengobatan TBC', 'P2KL', 'Kesehatan', 'Triwulan', '%', 90, 'Naik'],
  ['Pelayanan Kesehatan Penderita Hipertensi', 'P2KL', 'SPM', 'Bulanan', '%', 80, 'Naik'],
  ['Pelayanan Kesehatan Penderita Diabetes Melitus', 'P2KL', 'SPM', 'Bulanan', '%', 90, 'Naik'],
  ['Pelayanan Kesehatan Orang dengan Gangguan Jiwa Berat', 'P2KL', 'SPM', 'Bulanan', '%', 100, 'Naik'],
  ['Pengobatan ODHIV Antiretroviral (ARV)', 'P2KL', 'Kesehatan', 'Triwulan', '%', 90, 'Naik'],
  ['Kabupaten/Kota Eliminasi Malaria', 'P2KL', 'Kesehatan', 'Tahunan', '%', 50, 'Naik'],
  ['Angka Kesakitan Demam Berdarah Dengue (DBD)', 'P2KL', 'Kesehatan', 'Bulanan', 'per 100.000', 49, 'Turun'],
  ['Pelayanan Kesehatan Orang Terduga TBC', 'Yankes', 'SPM', 'Bulanan', '%', 100, 'Naik'],
  ['Fasyankes Terintegrasi SATUSEHAT', 'Yankes', 'Kesehatan', 'Triwulan', '%', 80, 'Naik'],
  ['Puskesmas Mampu PONED', 'Yankes', 'Kesehatan', 'Semester', '%', 60, 'Naik'],
  ['Rujukan Terintegrasi melalui SISRUTE', 'Yankes', 'Kesehatan', 'Triwulan', '%', 80, 'Naik'],
  ['Rumah Sakit dengan Layanan Unggulan Terstandar', 'Yankes', 'Kesehatan', 'Tahunan', '%', 60, 'Naik'],
  ['Puskesmas dengan Apoteker', 'Farmalkes', 'Kesehatan', 'Semester', '%', 70, 'Naik'],
  ['Sarana Distribusi Farmasi Memenuhi Syarat', 'Farmalkes', 'Kesehatan', 'Tahunan', '%', 80, 'Naik'],
  ['Alat Kesehatan Puskesmas Terkalibrasi', 'Farmalkes', 'Kesehatan', 'Tahunan', '%', 75, 'Naik'],
  ['Ketersediaan Reagen Laboratorium TBC dan HIV', 'Farmalkes', 'Kesehatan', 'Triwulan', '%', 90, 'Naik'],
  ['Total Fertility Rate (TFR)', 'PP & KB', 'IKU', 'Tahunan', 'anak per WUS', 2.1, 'Turun'],
  ['Laju Pertumbuhan Penduduk', 'PP & KB', 'Kesehatan', 'Tahunan', '%', 1.4, 'Turun'],
  ['Keluarga Berisiko Stunting Mendapat Pendampingan', 'PP & KB', 'Kesehatan', 'Bulanan', '%', 80, 'Naik'],
  ['Kampung KB Aktif', 'PP & KB', 'Kesehatan', 'Semester', '%', 70, 'Naik'],
  ['Pegawai Mengikuti Pengembangan Kompetensi', 'Sekretariat', 'Kesehatan', 'Tahunan', '%', 60, 'Naik'],
  ['Indeks Kepuasan Masyarakat (IKM)', 'Sekretariat', 'Kesehatan', 'Tahunan', 'poin', 85, 'Naik'],
  ['Pengelolaan Barang Milik Daerah Tertib', 'Sekretariat', 'Kesehatan', 'Semester', '%', 100, 'Naik']
];

function pageTambahIndikator_(m, user, params) {
  const ada = {};
  m.ind.forEach(i => { ada[i.bidang + '|' + i.nama.trim().toLowerCase()] = true; });
  const users = readTable_(SHEET.USERS).filter(u => u.Role === 'pic');
  const fb = String(params.bidang || '');
  const nBaru = KATALOG_IND_.filter(k => !ada[k[1] + '|' + k[0].toLowerCase()]).length;
  let h = pageHead_('Tambah Indikator', 'Tambahkan indikator kesehatan baru. Pilih dari katalog atau isi sendiri; kode dibuat otomatis.', '');
  h += '<section class="card card-pad"><div class="sec-top"><h2 class="h2 flat">Indikator baru</h2><span class="muted sm" id="ik-baru-info">' + m.ind.length + ' indikator terdaftar</span></div>' +
    '<form id="form-ind-baru" data-api="apiSimpanIndikator" novalidate><input type="hidden" name="baru" value="1"><div class="form-grid">' +
    field_('Nama indikator', 'nama', 'text', '', 'required maxlength="200" autocomplete="off"') +
    select_('Bidang', 'bidang', m.bidang.map(b => b.nama), fb || (m.bidang[0] || {}).nama) +
    select_('Jenis', 'jenis', ENUM_JENIS, 'Kesehatan') + select_('Frekuensi pelaporan', 'frekuensi', ENUM_FREK, 'Bulanan') +
    field_('Satuan', 'satuan', 'text', '%', 'maxlength="20"') + field_('Target dasar', 'target', 'number', '', 'step="any" min="0" required') +
    select_('Arah target', 'arah', [{ v: 'Naik', t: 'Naik (semakin tinggi semakin baik)' }, { v: 'Turun', t: 'Turun (semakin rendah semakin baik)' }], 'Naik') +
    '<div class="field"><label for="ib_program">Program (opsional)</label><select class="input" id="ib_program" name="program"><option value="">— Tanpa program —</option>' +
    m.program.filter(p => p.aktif).map(p => '<option value="' + esc_(p.id) + '" data-bidang="' + esc_(p.bidang) + '">' + esc_(p.nama + (p.sub ? ' — ' + p.sub : '')) + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="ib_pic">PIC (opsional)</label><select class="input" id="ib_pic" name="pic"><option value="">— Belum ditetapkan —</option>' +
    users.map(u => '<option value="' + esc_(u.Username) + '" data-bidang="' + esc_(u.Bidang) + '">' + esc_(u.Nama) + (u.Program ? ' (PIC Program)' : '') + '</option>').join('') + '</select></div>' +
    '</div><div class="form-actions"><button class="btn btn-primary" type="submit">Simpan Indikator</button><button type="button" class="btn btn-ghost" data-act="ind-baru-reset">Kosongkan form</button></div><p class="form-msg" role="alert"></p></form></section>';

  h += '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">Katalog indikator kesehatan</h2><p class="muted sm">' + nBaru + ' dari ' + KATALOG_IND_.length + ' belum ada di daftar Anda. Tekan Pakai untuk mengisi formulir di atas, lalu sesuaikan target.</p></div></div>';
  h += '<div class="filters card card-flat">' + filterSel_('Bidang', 'bidang', [{ v: '', t: 'Semua bidang' }].concat(m.bidang.map(b => ({ v: b.nama, t: b.nama }))), fb) + '</div>';
  const items = KATALOG_IND_.filter(k => !fb || k[1] === fb);
  h += '<div class="katalog">' + (items.length ? items.map(k => {
    const sudah = !!ada[k[1] + '|' + k[0].toLowerCase()];
    const dj = esc_(JSON.stringify({ nama: k[0], bidang: k[1], jenis: k[2], frekuensi: k[3], satuan: k[4], target: k[5], arah: k[6] }));
    return '<div class="kat-item' + (sudah ? ' is-ada' : '') + '"><div class="kat-main"><b>' + esc_(k[0]) + '</b><span class="muted sm">' + esc_(k[1]) + ' · ' + esc_(k[2]) + ' · ' + esc_(k[3]) + ' · target ' + (k[6] === 'Turun' ? '≤ ' : '≥ ') + esc_(k[5]) + ' ' + esc_(k[4]) + '</span></div>' +
      (sudah ? chip_('ok', 'Sudah ada') : '<button type="button" class="btn btn-ghost btn-sm" data-act="ind-pakai" data-json="' + dj + '">' + ic_('add') + 'Pakai</button>') + '</div>';
  }).join('') : kosong_('Tidak ada indikator katalog untuk bidang ini.', 'rule')) + '</div></section>';

  const baru = m.ind.slice(-8).reverse();
  h += '<section class="card card-pad"><h2 class="h2 flat">Terakhir ditambahkan</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Indikator</th><th>Bidang</th><th>Frekuensi</th><th class="r">Target</th><th>Diinput oleh</th></tr></thead><tbody>' +
    baru.map(i => '<tr><td>' + esc_(i.id) + '</td><td>' + esc_(i.nama) + '</td><td>' + esc_(i.bidang) + '</td><td>' + esc_(i.frek) + '</td><td class="r">' + esc_(i.target) + ' ' + esc_(i.satuan) + '</td><td class="sm">' + (i.pics.length ? esc_(i.pics.join(', ')) : (esc_(i.picNama || i.pic) || '<span class="muted">—</span>')) + '</td></tr>').join('') + '</tbody></table></div></section>';
  return h;
}

/** Ringkasan indikator yang diinput seorang PIC (untuk tabel pengguna). */
function ikRingkas_(u, m) {
  if (u.Role !== 'pic') return '';
  const ids = parseIk_(u.Indikator);
  if (!ids.length) return '<span class="muted sm blok">Semua indikator ' + (u.Program ? 'program' : 'bidang') + '</span>';
  const nama = {};
  m.ind.forEach(i => { nama[i.id] = i.nama; });
  return '<span class="blok sm" title="' + esc_(ids.map(x => x + ' ' + (nama[x] || '')).join('\n')) + '">Menginput <b>' + ids.length + ' indikator</b>: ' + esc_(ids.slice(0, 3).join(', ')) + (ids.length > 3 ? ' +' + (ids.length - 3) : '') + '</span>';
}

function tabPengguna_(m, users, params, user, aktifBool, progNama) {
  const picCount = {};
  m.ind.forEach(i => { if (i.pic) picCount[i.pic] = (picCount[i.pic] || 0) + 1; });
  const ROLE_T = { admin: 'Administrator', pimpinan: 'Pimpinan', pic: 'PIC Bidang' };
  const ROLE_C = { admin: 'info', pimpinan: 'warn', pic: 'ok' };
  const q = String(params.q || '').toLowerCase().trim();
  const fr = String(params.role || ''), fs = String(params.status || '');
  const list = users.filter(u =>
    (!q || [u.Username, u.Nama, u.Bidang, u.Email, (progNama[u.Program] || {}).nama].join(' ').toLowerCase().indexOf(q) >= 0) &&
    (!fr || u.Role === fr) && (!fs || (fs === 'aktif' ? aktifBool(u) : !aktifBool(u))));
  const n = r => users.filter(u => u.Role === r).length;
  const nProg = users.filter(u => u.Role === 'pic' && u.Program).length;
  let h = '<div class="grid g4">' +
    kpiCard_('Total pengguna', users.length, users.filter(aktifBool).length + ' aktif', 'info', 'group') +
    kpiCard_('Administrator', n('admin'), 'Kelola data & pengguna', 'info', 'admin_panel_settings') +
    kpiCard_('Pimpinan', n('pimpinan'), 'Melihat & mengingatkan', 'warn', 'badge') +
    kpiCard_('PIC', n('pic'), nProg + ' PIC Program · ' + (n('pic') - nProg) + ' PIC Bidang', 'ok', 'edit_note') + '</div>';
  h += '<div class="filters card card-flat">' +
    '<label class="search"><span class="sr">Cari pengguna</span>' + ic_('search') + '<input type="search" class="input input-search f-param" data-param="q" value="' + esc_(params.q || '') + '" placeholder="Cari nama, pengguna, bidang, program, email" maxlength="60"></label>' +
    filterSel_('Peran', 'role', [{ v: '', t: 'Semua peran' }, { v: 'admin', t: 'Administrator' }, { v: 'pimpinan', t: 'Pimpinan' }, { v: 'pic', t: 'PIC' }], fr) +
    filterSel_('Status', 'status', [{ v: '', t: 'Semua status' }, { v: 'aktif', t: 'Aktif' }, { v: 'nonaktif', t: 'Nonaktif' }], fs) + '</div>';
  if (!list.length) return h + '<section class="card card-pad">' + kosong_('Tidak ada pengguna yang cocok dengan filter.', 'person_search') + '</section>';
  return h + '<section class="card card-pad"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pengguna</th><th>Peran</th><th>Bidang / Program</th><th>Kontak</th><th>Status</th><th class="r">Aksi</th></tr></thead><tbody>' +
    list.map(u => {
      const aktif = aktifBool(u), diri = String(u.Username).toLowerCase() === String(user.username).toLowerCase();
      const pg = u.Program ? progNama[u.Program] : null;
      const dj = esc_(JSON.stringify({ username: u.Username, nama: u.Nama, role: u.Role, bidang: u.Bidang, program: u.Program || '', indikator: parseIk_(u.Indikator), email: u.Email, telepon: u.Telepon, aktif: aktif }));
      const nm = esc_(u.Nama || u.Username), un = esc_(u.Username);
      const roleLbl = u.Role === 'pic' && (u.Program || parseIk_(u.Indikator).length) ? 'PIC Program' : (ROLE_T[u.Role] || u.Role);
      return '<tr><td><div class="pic-line"><span class="avatar">' + esc_(String(u.Nama || u.Username).charAt(0).toUpperCase()) + '</span><div><b>' + esc_(u.Nama) + (diri ? ' ' + chip_('info', 'Anda') : '') + '</b><div class="muted sm">@' + un + (picCount[u.Username] ? ' · ' + picCount[u.Username] + ' indikator' : '') + '</div></div></div></td>' +
        '<td>' + chip_(ROLE_C[u.Role] || 'mute', roleLbl) + '</td><td>' + (esc_(u.Bidang) || '<span class="muted">—</span>') + (pg ? '<span class="muted sm blok">' + esc_(pg.nama) + (pg.sub ? ' · ' + esc_(pg.sub) : '') + '</span>' : '') + ikRingkas_(u, m) + '</td>' +
        '<td class="sm">' + (u.Email ? esc_(u.Email) + '<br>' : '') + (u.Telepon ? esc_(u.Telepon) : (u.Email ? '' : '<span class="muted">—</span>')) + '</td>' +
        '<td>' + (aktif ? chip_('ok', 'Aktif') : chip_('mute', 'Nonaktif')) + '</td>' +
        '<td class="r"><div class="row-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="user-form" data-json="' + dj + '">Ubah</button>' +
        (diri ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-act="user-reset" data-username="' + un + '" data-nama="' + nm + '">Reset sandi</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-act="user-status" data-username="' + un + '" data-nama="' + nm + '" data-aktif="' + (aktif ? 'false' : 'true') + '">' + (aktif ? 'Nonaktifkan' : 'Aktifkan') + '</button>') +
        '</div></td></tr>';
    }).join('') + '</tbody></table></div></section>';
}

function tabProgram_(m, users, params, aktifBool) {
  const fb = String(params.bidang || '');
  const semua = m.program;
  const tanpaPic = semua.filter(p => p.aktif && !p.pics.some(x => x.aktif)).length;
  const tanpaProg = m.ind.filter(i => !i.program).length;
  let h = '<div class="grid g4">' +
    kpiCard_('Program', semua.length, semua.filter(p => p.aktif).length + ' aktif', 'info', 'account_tree') +
    kpiCard_('Punya PIC', semua.filter(p => p.aktif).length - tanpaPic, 'Program aktif dengan PIC', 'ok', 'how_to_reg') +
    kpiCard_('Belum ada PIC', tanpaPic, 'Perlu ditetapkan', tanpaPic ? 'warn' : 'ok', 'person_off') +
    kpiCard_('Indikator tanpa program', tanpaProg, 'Diatur di Pengaturan → Indikator', 'info', 'rule') + '</div>';
  h += '<div class="filters card card-flat">' + filterSel_('Bidang', 'bidang', [{ v: '', t: 'Semua bidang' }].concat(m.bidang.map(b => ({ v: b.nama, t: b.nama }))), fb) + '</div>';
  const grup = m.bidang.filter(b => !fb || b.nama === fb);
  let ada = false;
  grup.forEach(b => {
    const li = semua.filter(p => p.bidang === b.nama);
    if (!li.length && fb !== b.nama) return;
    ada = true;
    h += '<section class="card card-pad"><div class="sec-top"><h2 class="h2 flat">' + esc_(b.nama) + '</h2>' + chip_('info', li.length + ' program') + '</div>';
    if (!li.length) h += kosong_('Belum ada program di bidang ini.', 'account_tree');
    else h += '<div class="stack">' + li.map(p => {
      const dj = esc_(JSON.stringify({ id: p.id, nama: p.nama, bidang: p.bidang, sub: p.sub, aktif: p.aktif }));
      const pj = esc_(JSON.stringify({ role: 'pic', bidang: p.bidang, program: p.id }));
      return '<div class="tung"><div class="tung-main"><b>' + esc_(p.nama) + (p.aktif ? '' : ' ' + chip_('mute', 'Nonaktif')) + '</b>' +
        '<span class="muted sm">' + esc_(p.id) + (p.sub ? ' · ' + esc_(p.sub) : '') + ' · ' + p.nInd + ' indikator</span>' +
        '<div class="chips-row">' + (p.pics.length ? p.pics.map(x => '<span class="chip ' + (x.aktif ? 'chip-ok' : 'chip-mute') + '" title="@' + esc_(x.username) + (x.nIk ? ' · menginput ' + x.nIk + ' indikator' : '') + '">' + esc_(x.nama) + (x.nIk ? ' · ' + x.nIk + ' ind.' : '') + '</span>').join('') : chip_('crit', 'Belum ada PIC')) + '</div></div>' +
        '<div class="tung-end"><button type="button" class="btn btn-ghost btn-sm" data-act="user-form" data-json="' + pj + '">' + ic_('person_add') + 'Tambah PIC</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="program-form" data-json="' + dj + '">Ubah</button></div></div>';
    }).join('') + '</div>';
    h += '</section>';
  });
  if (!ada) h += '<section class="card card-pad">' + kosong_('Belum ada program. Klik “Tambah Program” untuk memulai.', 'account_tree') + '</section>';
  h += '<p class="muted sm">Cara kerja: PIC Bidang mengisi seluruh indikator bidangnya. PIC Program hanya mengisi indikator yang ditautkan ke programnya (tautan diatur di <b>Pengaturan → Indikator → Program</b>).</p>';
  return h;
}

/* ---------------- Halaman: Panduan ---------------- */

function pagePanduan_(m, user) {
  const q = (t, a) => '<details class="faq"><summary>' + esc_(t) + '</summary><div>' + a + '</div></details>';
  return pageHead_('Panduan Pengguna', 'Cara memakai ' + APP_NAME + '.', '') +
    '<section class="card card-pad">' +
    q('Bagaimana capaian dan status dihitung?', '<p>Capaian = realisasi ÷ target × 100%. Untuk indikator yang berarah <b>turun</b> (misalnya stunting), capaian = target ÷ realisasi. Status: <b>Tercapai</b> ≥ 100%, <b>Waspada</b> 80–99%, <b>Kritis</b> &lt; 80%.</p>') +
    q('Siapa yang boleh mengisi data?', '<p>PIC mengisi indikator bidangnya; isian PIC berstatus <i>Menunggu verifikasi</i> sampai disetujui admin. Isian admin langsung berstatus Lengkap. Pimpinan hanya melihat dan mengirim pengingat.</p>') +
    q('Cara mengisi data indikator', '<ol><li>Buka <b>Monitoring Pengisian</b>.</li><li>Klik sel bulan pada kalender (atau tombol <b>Isi</b> pada daftar tunggakan).</li><li>Masukkan realisasi, tandai kabupaten yang datanya belum masuk bila ada, lalu simpan.</li></ol>') +
    q('Apa arti "Kepatuhan pengisian"?', '<p>Persentase indikator wajib lapor (sesuai frekuensi dan bulan aktif) yang sudah terinput, termasuk yang menunggu verifikasi.</p>') +
    q('Mengganti periode', '<p>Gunakan pilihan tahun dan bulan di bagian atas. Admin menetapkan <b>bulan aktif</b> dan batas cut-off di menu Pengaturan.</p>') +
    q('Mengirim pengingat', '<p>Di Monitoring Pengisian, centang indikator tertunggak lalu klik <b>Kirim Pengingat</b>. Email dikirim ke PIC yang mempunyai alamat email; untuk WhatsApp, aplikasi menyiapkan tautan pesan.</p>') +
    (user.role === 'admin' ? q('Menambah pengguna baru', '<ol><li>Buka menu <b>Kelola Pengguna</b>, klik <b>Tambah Pengguna</b>.</li><li>Isi nama, nama pengguna, peran, dan (untuk PIC) bidangnya.</li><li>Biarkan kata sandi <b>dibuat otomatis</b>, lalu simpan. Kata sandi sementara muncul <b>sekali</b>: salin atau kirim lewat WhatsApp kepada pengguna.</li><li>Minta pengguna masuk lalu menggantinya di menu Pengaturan.</li></ol><p>Akun tidak dihapus; gunakan <b>Nonaktifkan</b> agar riwayat isian tetap tercatat. Lupa kata sandi? Klik <b>Reset sandi</b>.</p>') : '') +
    q('Keamanan', '<p>Ganti kata sandi awal segera di menu Pengaturan. Sesi berakhir otomatis setelah 6 jam; keluar dengan tombol Keluar pada menu pengguna.</p>') + '</section>';
}

/* ---------------- Halaman: Monev Kinerja ---------------- */

const MONEV_VIEW_ = [
  { id: 'program', label: 'Program', icon: 'account_tree' },
  { id: 'ik', label: 'IK Tujuan Program', icon: 'rule' },
  { id: 'target', label: 'Target', icon: 'track_changes' },
  { id: 'realisasi', label: 'Realisasi', icon: 'fact_check' },
  { id: 'bukti', label: 'Bukti Dukung', icon: 'upload_file' },
  { id: 'unit', label: 'Unit PIC', icon: 'group' },
  { id: 'catatan', label: 'Catatan', icon: 'edit_note' },
  { id: 'keterangan', label: 'Keterangan', icon: 'description' }
];
const MONEV_TWTAB_ = [{ id: 'TW1', label: 'TW 1' }, { id: 'TW2', label: 'TW 2' }, { id: 'TW3', label: 'TW 3' }, { id: 'TW4', label: 'TW 4' }];

function monevModel_(tahun) {
  const rows = readTable_(SHEET.MONEV);
  const sasaran = rows.filter(r => r.Jenis === 'sasaran').sort((a, b) => String(a.ID).localeCompare(String(b.ID)));
  const urut = {}; sasaran.forEach((r, i) => { urut[String(r.ID)] = i; });
  const ik = rows.filter(r => r.Jenis === 'ik').map(r => ({ id: String(r.ID), sasaranId: String(r.Induk), nama: String(r.Teks), satuan: String(r.Satuan || '%') }))
    .sort((a, b) => ((urut[a.sasaranId] === undefined ? 999 : urut[a.sasaranId]) - (urut[b.sasaranId] === undefined ? 999 : urut[b.sasaranId])) || a.id.localeCompare(b.id));
  const angka = { target: {}, realisasi: {} };
  rows.forEach(r => { if ((r.Jenis === 'target' || r.Jenis === 'realisasi') && Number(r.Tahun) === tahun) angka[r.Jenis][String(r.Induk) + '|' + r.TW] = { id: String(r.ID), v: Number(r.Angka) }; });
  const program = rows.filter(r => r.Jenis === 'program').sort((a, b) => String(a.ID).localeCompare(String(b.ID)));
  const unit = {}, catatan = [], keterangan = [];
  rows.forEach(r => {
    if (r.Jenis === 'unit') (unit[String(r.Induk)] = unit[String(r.Induk)] || []).push(r);
    else if (r.Jenis === 'catatan' && Number(r.Tahun) === tahun) catatan.push(r);
    else if (r.Jenis === 'keterangan' && Number(r.Tahun) === tahun) keterangan.push(r);
  });
  const urutBaru = (a, b) => String(b.DibuatPada).localeCompare(String(a.DibuatPada));
  catatan.sort(urutBaru); keterangan.sort(urutBaru);
  const bukti = readTable_(SHEET.BUKTI).filter(b => String(b.IndikatorID).indexOf('MV:') === 0 && Number(b.Tahun) === tahun);
  return { rows: rows, sasaran: sasaran, program: program, ik: ik, ikMap: ik.reduce((o, i) => { o[i.id] = i; return o; }, {}), sasaranMap: sasaran.reduce((o, r) => { o[String(r.ID)] = String(r.Teks); return o; }, {}), angka: angka, unit: unit, catatan: catatan, keterangan: keterangan, bukti: bukti };
}

function mvBtn_(label, jenis, data, ikon, cls) {
  data = Object.assign({ jenis: jenis }, data || {});
  return '<button type="button" class="btn ' + (cls || 'btn-primary') + ' btn-sm" data-act="monev-form" data-json="' + esc_(JSON.stringify(data)) + '">' + (ikon ? ic_(ikon) : '') + esc_(label) + '</button>';
}
function mvHapus_(id, label) {
  return '<button type="button" class="btn btn-ghost btn-sm" data-act="monev-hapus" data-id="' + esc_(id) + '">' + esc_(label || 'Hapus') + '</button>';
}
function mvIkLabel_(mm, i) { return (mm.sasaranMap[i.sasaranId] ? String(mm.sasaranMap[i.sasaranId]).slice(0, 40) + ' › ' : '') + i.nama; }
function mvUnitChips_(mm, ikId) {
  const u = mm.unit[ikId] || [];
  return u.length ? u.map(x => chip_('info', String(x.Bidang) + (x.PIC ? ' · ' + x.PIC : ''))).join(' ') : chip_('mute', 'Belum ada unit PIC');
}

function monevMeta_(mm, user) {
  const picUsers = readTable_(SHEET.USERS).filter(u => u.Role === 'pic' && String(u.Aktif).toLowerCase() !== 'tidak').map(u => ({ v: String(u.Username), t: String(u.Nama), b: String(u.Bidang || '') }));
  return '<div id="monev-meta" hidden data-json="' + esc_(JSON.stringify({
    sasaran: mm.sasaran.map(r => ({ v: String(r.ID), t: String(r.Teks).slice(0, 90) })),
    ik: mm.ik.map(i => ({ v: i.id, t: mvIkLabel_(mm, i), s: i.satuan, bb: monevBolehUbah_(user, 'realisasi', i.id) })),
    bidang: readTable_(SHEET.BIDANG).map(b => String(b.Nama)),
    pic: picUsers
  })) + '"></div>';
}

function viewMonevDaftar_(mm, user) {
  const adm = user.role === 'admin';
  let h = '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">Tujuan / Sasaran Program</h2><p class="muted sm">Pilih satu sasaran untuk membuka Program, IK, Target, Realisasi, Bukti Dukung, Unit PIC, Catatan, dan Keterangannya.</p></div>' +
    (adm ? mvBtn_('Tambah Sasaran', 'sasaran', {}, 'add_circle') : '') + '</div>';
  if (!mm.sasaran.length) return h + kosong_(adm ? 'Belum ada sasaran program. Klik “Tambah Sasaran” untuk memulai.' : 'Belum ada sasaran program.', 'flag') + '</section>';
  h += '<div class="stack">' + mm.sasaran.map((r, n) => {
    const id = String(r.ID), ikS = mm.ik.filter(i => i.sasaranId === id);
    const jmlP = mm.program.filter(p => String(p.Induk) === id).length;
    const jmlB = mm.bukti.filter(b => ikS.some(i => 'MV:' + i.id === String(b.IndikatorID))).length;
    return '<div class="tung"><div class="tung-main"><b>' + (n + 1) + '. ' + esc_(r.Teks) + '</b><div class="chips-row">' +
      chip_('info', jmlP + ' program') + ' ' + chip_('info', ikS.length + ' IK') + ' ' + chip_('mute', jmlB + ' bukti') + '</div></div>' +
      '<div class="tung-end">' + '<button type="button" class="btn btn-primary btn-sm" data-nav="monev" data-params=\'' + esc_(JSON.stringify({ sasaran: id })) + '\'>Buka' + ic_('chevron_right') + '</button>' +
      (adm ? mvBtn_('Ubah', 'sasaran', { id: id, teks: String(r.Teks) }, '', 'btn-ghost') + mvHapus_(r.ID) : '') + '</div></div>';
  }).join('') + '</div></section>';
  return h;
}

function viewMonevProgram_(mm, user) {
  const adm = user.role === 'admin', sr = mm.sasaran[0];
  let h = '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">Program</h2><p class="muted sm">Program yang dijalankan untuk mencapai sasaran ini.</p></div>' +
    (adm ? mvBtn_('Tambah Program', 'program', { induk: String(sr.ID) }, 'add_circle') : '') + '</div>';
  if (!mm.program.length) return h + kosong_(adm ? 'Belum ada program. Klik “Tambah Program” untuk memulai.' : 'Belum ada program.', 'account_tree') + '</section>';
  h += '<div class="stack">' + mm.program.map((p, n) => '<div class="tung"><div class="tung-main"><b>' + (n + 1) + '. ' + esc_(p.Teks) + '</b><span class="muted sm">' + esc_(p.ID) + '</span></div>' +
    '<div class="tung-end">' + (adm ? mvBtn_('Ubah', 'program', { id: String(p.ID), induk: String(sr.ID), teks: String(p.Teks) }, '', 'btn-ghost') + mvHapus_(p.ID) : '') + '</div></div>').join('') + '</div></section>';
  return h;
}

function viewMonevIk_(mm, user) {
  const adm = user.role === 'admin';
  let h = '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">Indikator Kinerja (IK) Tujuan Program</h2><p class="muted sm">Ukuran keberhasilan setiap sasaran program, lengkap dengan satuan dan unit PIC.</p></div>' +
    (adm && mm.sasaran.length ? mvBtn_('Tambah IK', 'ik', { induk: mm.sasaran.length === 1 ? String(mm.sasaran[0].ID) : '' }, 'add_circle') : '') + '</div>';
  if (!mm.sasaran.length) return h + kosong_('Tambahkan sasaran program terlebih dahulu di sub-menu “Tujuan / Sasaran Program”.', 'flag') + '</section>';
  if (!mm.ik.length) return h + kosong_(adm ? 'Belum ada IK. Klik “Tambah IK” untuk memulai.' : 'Belum ada IK.', 'rule') + '</section>';
  mm.sasaran.forEach(sr => {
    const li = mm.ik.filter(i => i.sasaranId === String(sr.ID));
    if (!li.length) return;
    h += '<h3 class="h3">' + esc_(sr.Teks) + '</h3><div class="stack">' + li.map(i =>
      '<div class="tung"><div class="tung-main"><b>' + esc_(i.nama) + '</b><span class="muted sm">' + esc_(i.id) + ' · satuan ' + esc_(i.satuan) + '</span><div class="chips-row">' + mvUnitChips_(mm, i.id) + '</div></div>' +
      '<div class="tung-end">' + (adm ? mvBtn_('Ubah', 'ik', { id: i.id, induk: i.sasaranId, teks: i.nama, satuan: i.satuan }, '', 'btn-ghost') + mvHapus_(i.id) : '') + '</div></div>').join('') + '</div>';
  });
  const tanpa = mm.ik.filter(i => !mm.sasaranMap[i.sasaranId]);
  if (tanpa.length) h += '<h3 class="h3">Tanpa sasaran</h3><div class="stack">' + tanpa.map(i => '<div class="tung"><div class="tung-main"><b>' + esc_(i.nama) + '</b></div><div class="tung-end">' + (adm ? mvBtn_('Ubah', 'ik', { id: i.id, induk: '', teks: i.nama, satuan: i.satuan }, '', 'btn-ghost') + mvHapus_(i.id) : '') + '</div></div>').join('') + '</div>';
  return h + '</section>';
}

function viewMonevAngka_(mm, user, params, rute, jenis, tw) {
  const adm = user.role === 'admin';
  const labelJ = jenis === 'target' ? 'Target' : 'Realisasi';
  let h = '<div class="seg seg-sub" role="group" aria-label="Triwulan">' + tabsInd_(rute, params, 'tw', MONEV_TWTAB_, tw, { view: jenis, sasaran: params.sasaran }) + '</div>';
  const bolehTambah = adm || (jenis === 'realisasi' && user.role === 'pic');
  h += '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">' + labelJ + ' ' + esc_(tw.replace('TW', 'Triwulan ')) + ' — ' + mm.tahun + '</h2>' +
    '<p class="muted sm">' + (jenis === 'target' ? 'Target tiap IK pada triwulan ini. Hanya admin yang dapat mengisi atau mengubahnya.' : 'Realisasi tiap IK pada triwulan ini. Admin dan PIC unit penanggung jawab dapat mengisinya; capaian dihitung terhadap target triwulan yang sama.') + '</p></div>' +
    (bolehTambah && mm.ik.length ? mvBtn_('Tambah ' + labelJ, jenis, { tw: tw }, 'add_circle') : '') + '</div>';
  if (!mm.ik.length) return h + kosong_('Belum ada IK. Tambahkan dulu di tab “IK Tujuan Program”.', 'rule') + '</section>';
  h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Indikator kinerja</th>' + (jenis === 'realisasi' ? '<th class="r">Target ' + esc_(tw) + '</th>' : '') + '<th class="r">' + labelJ + ' ' + esc_(tw) + '</th>' + (jenis === 'realisasi' ? '<th>Capaian</th>' : '') + '<th></th></tr></thead><tbody>';
  mm.ik.forEach(i => {
    const a = mm.angka[jenis][i.id + '|' + tw], tg = mm.angka.target[i.id + '|' + tw];
    const boleh = monevBolehUbah_(user, jenis, i.id);
    let cap = null, tier = 'belum';
    if (jenis === 'realisasi' && a && tg) { cap = hitungCap_(a.v, tg.v, 'Naik'); tier = tierDari_(cap); }
    h += '<tr><td><b class="heat-name">' + esc_(i.nama) + '</b><span class="muted sm">' + esc_(i.id) + ' · ' + esc_(mm.sasaranMap[i.sasaranId] || '') + '</span></td>' +
      (jenis === 'realisasi' ? '<td class="r nowrap">' + (tg ? esc_(val_(tg.v, i.satuan === '%' ? '%' : '')) : '—') + '</td>' : '') +
      '<td class="r nowrap">' + (a ? '<b>' + esc_(val_(a.v, i.satuan === '%' ? '%' : '')) + '</b>' : '<span class="muted">Belum diisi</span>') + '</td>' +
      (jenis === 'realisasi' ? '<td class="cap-cell">' + (cap === null ? '—' : '<b>' + esc_(pct_(cap)) + '</b>' + bar_(cap, tier)) + '</td>' : '') +
      '<td class="r nowrap">' + (boleh ? (a ? mvBtn_('Ubah', jenis, { id: a.id, induk: i.id, tw: tw, angka: a.v }, '', 'btn-ghost') + mvHapus_(a.id) : mvBtn_('Isi', jenis, { induk: i.id, tw: tw }, '', 'btn-ghost')) : '') + '</td></tr>';
  });
  return h + '</tbody></table></div></section>';
}

function viewMonevBukti_(mm, user) {
  const adm = user.role === 'admin';
  const bisaMana = mm.ik.filter(i => monevBolehUbah_(user, 'bukti', i.id));
  let h = '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">Bukti Dukung — ' + mm.tahun + '</h2><p class="muted sm">Unggah dokumen pendukung capaian tiap IK (PDF, gambar, Word, Excel, PowerPoint, CSV, TXT; maksimal 8 MB per berkas). Tersimpan di Google Drive.</p></div>' +
    (bisaMana.length ? '<button type="button" class="btn btn-primary btn-sm" data-act="mbukti-form" data-json="' + esc_(JSON.stringify({})) + '">' + ic_('upload_file') + 'Unggah Bukti</button>' : '') + '</div>';
  if (!mm.ik.length) return h + kosong_('Belum ada IK. Tambahkan dulu di tab “IK Tujuan Program”.', 'rule') + '</section>';
  h += '<div class="stack">' + mm.ik.map(i => {
    const li = mm.bukti.filter(b => String(b.IndikatorID) === 'MV:' + i.id).sort((a, b) => String(b.DiunggahPada).localeCompare(String(a.DiunggahPada)));
    const boleh = monevBolehUbah_(user, 'bukti', i.id);
    return '<div class="tung"><div class="tung-main"><b>' + esc_(i.nama) + '</b><span class="muted sm">' + esc_(i.id) + ' · ' + li.length + ' berkas</span>' +
      (li.length ? '<ul class="bk-list">' + li.map(b => {
        const hapusOk = adm || (boleh && String(b.DiunggahOleh) === user.username);
        return '<li class="bk-item"><span class="bk-ext">' + esc_(b.Tipe) + '</span><div class="bk-main"><b>' + esc_(b.NamaFile) + '</b><span class="muted sm">' + (Number(b.Bulan) ? 'TW ' + Number(b.Bulan) : 'Umum') + ' · ' + esc_(b.DiunggahOleh) + ' · ' + esc_(b.DiunggahPada) + '</span>' + (b.Catatan ? '<span class="sm">' + esc_(b.Catatan) + '</span>' : '') + '</div>' +
          '<div class="bk-act"><button type="button" class="btn btn-ghost btn-sm" data-act="mbukti-unduh" data-id="' + esc_(b.ID) + '">Unduh</button>' + (hapusOk ? '<button type="button" class="btn btn-ghost btn-sm" data-act="mbukti-hapus" data-id="' + esc_(b.ID) + '">Hapus</button>' : '') + '</div></li>';
      }).join('') + '</ul>' : '') + '</div>' +
      '<div class="tung-end">' + (boleh ? '<button type="button" class="btn btn-ghost btn-sm" data-act="mbukti-form" data-json="' + esc_(JSON.stringify({ ikId: i.id })) + '">' + ic_('upload_file') + 'Unggah</button>' : '') + '</div></div>';
  }).join('') + '</div></section>';
  return h;
}

function viewMonevUnit_(mm, user) {
  const adm = user.role === 'admin';
  let h = '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">Unit PIC</h2><p class="muted sm">Unit / bidang dan PIC penanggung jawab tiap IK. PIC hanya dapat mengisi realisasi, catatan, keterangan, dan bukti untuk IK milik unitnya.</p></div>' +
    (adm && mm.ik.length ? mvBtn_('Tambah Unit PIC', 'unit', {}, 'add_circle') : '') + '</div>';
  if (!mm.ik.length) return h + kosong_('Belum ada IK. Tambahkan dulu di tab “IK Tujuan Program”.', 'rule') + '</section>';
  h += '<div class="stack">' + mm.ik.map(i => {
    const u = mm.unit[i.id] || [];
    return '<div class="tung"><div class="tung-main"><b>' + esc_(i.nama) + '</b><span class="muted sm">' + esc_(i.id) + '</span><div class="chips-row">' +
      (u.length ? u.map(x => '<span class="chip chip-info">' + esc_(x.Bidang) + (x.PIC ? ' · ' + esc_(x.PIC) : '') + (adm ? ' <button type="button" class="chip-x" data-act="monev-hapus" data-id="' + esc_(x.ID) + '" aria-label="Hapus unit ' + esc_(x.Bidang) + '">×</button>' : '') + '</span>').join('') : chip_('crit', 'Belum ada unit PIC')) + '</div></div>' +
      '<div class="tung-end">' + (adm ? mvBtn_('Tambah Unit', 'unit', { induk: i.id }, '', 'btn-ghost') : '') + '</div></div>';
  }).join('') + '</div></section>';
  return h;
}

function viewMonevTeks_(mm, user, jenis) {
  const adm = user.role === 'admin';
  const judul = jenis === 'catatan' ? 'Catatan' : 'Keterangan';
  const list = jenis === 'catatan' ? mm.catatan : mm.keterangan;
  const bisaTambah = mm.ik.some(i => monevBolehUbah_(user, jenis, i.id));
  let h = '<section class="card card-pad"><div class="sec-top"><div><h2 class="h2 flat">' + judul + ' — ' + mm.tahun + '</h2><p class="muted sm">' + (jenis === 'catatan' ? 'Catatan pelaksanaan, kendala, atau tindak lanjut tiap IK.' : 'Keterangan tambahan yang menjelaskan target atau capaian tiap IK.') + ' Dapat dikaitkan ke triwulan tertentu.</p></div>' +
    (bisaTambah ? mvBtn_('Tambah ' + judul, jenis, {}, 'add_circle') : '') + '</div>';
  if (!mm.ik.length) return h + kosong_('Belum ada IK. Tambahkan dulu di tab “IK Tujuan Program”.', 'rule') + '</section>';
  if (!list.length) return h + kosong_('Belum ada ' + judul.toLowerCase() + '.', 'edit_note') + '</section>';
  h += '<div class="stack">' + list.map(r => {
    const i = mm.ikMap[String(r.Induk)];
    const boleh = monevBolehUbah_(user, jenis, r.Induk) && (adm || String(r.DibuatOleh) === user.username);
    return '<div class="tung"><div class="tung-main"><b>' + esc_(i ? i.nama : r.Induk) + '</b>' + '<span class="blok">' + esc_(r.Teks) + '</span><span class="muted sm">' + (r.TW ? esc_(String(r.TW).replace('TW', 'TW ')) + ' · ' : '') + esc_(r.DibuatOleh) + ' · ' + esc_(tglId_(r.DibuatPada)) + '</span></div>' +
      '<div class="tung-end">' + (boleh ? mvBtn_('Ubah', jenis, { id: String(r.ID), induk: String(r.Induk), tw: String(r.TW || ''), teks: String(r.Teks) }, '', 'btn-ghost') + mvHapus_(r.ID) : '') + '</div></div>';
  }).join('') + '</div></section>';
  return h;
}

function pageMonev_(m, user, params, ctx) {
  const all = monevModel_(m.tahun);
  all.tahun = m.tahun;
  const sr = params.sasaran ? all.sasaran.find(r => String(r.ID) === String(params.sasaran)) : null;
  if (!sr) {
    return pageHead_('Monev Kinerja', 'Pemantauan dan evaluasi kinerja per tujuan / sasaran program.', '<span class="chip chip-info">' + all.sasaran.length + ' sasaran</span>') +
      monevMeta_(all, user) + viewMonevDaftar_(all, user);
  }
  const sid = String(sr.ID), ikS = all.ik.filter(i => i.sasaranId === sid), ids = ikS.map(i => i.id);
  const mm = Object.assign({}, all, {
    sasaran: [sr], ik: ikS, program: all.program.filter(p => String(p.Induk) === sid),
    catatan: all.catatan.filter(r => ids.indexOf(String(r.Induk)) >= 0), keterangan: all.keterangan.filter(r => ids.indexOf(String(r.Induk)) >= 0),
    bukti: all.bukti.filter(b => ids.some(x => 'MV:' + x === String(b.IndikatorID)))
  });
  const view = MONEV_VIEW_.some(v => v.id === params.view) ? params.view : 'program';
  const tw = MONEV_TWTAB_.some(t => t.id === params.tw) ? params.tw : 'TW' + Math.ceil(m.bulan / 3);
  let h = '<nav class="crumb" aria-label="Navigasi"><button type="button" class="btn btn-ghost btn-sm" data-nav="monev" data-params="{}">' + ic_('arrow_back') + 'Semua sasaran</button></nav>';
  h += pageHead_(sr.Teks, 'Tujuan / Sasaran Program · ' + sid, '<span class="chip chip-info">' + ikS.length + ' IK</span>');
  h += '<div class="seg seg-main" role="group" aria-label="Isi sasaran program">' + tabsInd_('monev', params, 'view', MONEV_VIEW_, view, { sasaran: sid }) + '</div>';
  h += monevMeta_(mm, user);
  if (user.role === 'pic' && !ikS.some(i => monevBolehUbah_(user, 'realisasi', i.id))) h += '<div class="card card-flat card-pad muted sm">Belum ada IK pada sasaran ini yang ditugaskan ke unit atau akun Anda. Hubungi admin untuk menetapkan Unit PIC.</div>';
  if (view === 'program') return h + viewMonevProgram_(mm, user);
  if (view === 'ik') return h + viewMonevIk_(mm, user);
  if (view === 'target' || view === 'realisasi') return h + viewMonevAngka_(mm, user, params, 'monev', view, tw);
  if (view === 'bukti') return h + viewMonevBukti_(mm, user);
  if (view === 'unit') return h + viewMonevUnit_(mm, user);
  return h + viewMonevTeks_(mm, user, view);
}

/* ---------------- Router halaman ---------------- */

const PAGES_ = {
  beranda: { fn: pageBeranda_, title: 'Beranda' },
  inputdata: { fn: pageInputData_, title: 'Input Data', roles: ['admin', 'pic'] },
  indikator: { fn: pageIndikator_, title: 'Indikator Kesehatan' },
  iku: { fn: pageIku_, title: 'IKU' },
  monev: { fn: pageMonev_, title: 'Monev Kinerja' },
  analitik: { fn: pageAnalitik_, title: 'Capaian & Analitik' },
  monitoring: { fn: pageMonitoring_, title: 'Monitoring Pengisian' },
  rekomendasi: { fn: pageRekomendasi_, title: 'Permasalahan & Rekomendasi' },
  laporan: { fn: pageLaporan_, title: 'Laporan Eksekutif', roles: ['admin', 'pimpinan'] },
  permintaan: { fn: pagePermintaan_, title: 'Permintaan Data' },
  tambahindikator: { fn: pageTambahIndikator_, title: 'Tambah Indikator', roles: ['admin'] },
  pengguna: { fn: pagePengguna_, title: 'Kelola Pengguna', roles: ['admin'] },
  pengaturan: { fn: pagePengaturan_, title: 'Pengaturan' },
  panduan: { fn: pagePanduan_, title: 'Panduan Pengguna' }
};

/** Dipanggil client lewat google.script.run. Mengembalikan {success, html, title, redirect, message}. */
function getPageContent(token, page, params) {
  try {
    const user = auth_(token);
    params = params || {};
    const def = PAGES_[page];
    if (!def) return { success: true, redirect: 'beranda', message: 'Halaman tidak ditemukan.' };
    if (def.roles && def.roles.indexOf(user.role) < 0) return { success: true, redirect: 'beranda', message: 'Anda tidak memiliki akses ke halaman tersebut.' };
    const m = hitungModel_(params.tahun, params.bulan, { user: user });
    const ctx = { tahun: m.tahun, isian: isianMap_(m.tahun), notePer: {} };
    Object.keys(ctx.isian).forEach(k => { const r = ctx.isian[k]; if (r.Analisis || r.Rekomendasi) (ctx.notePer[String(r.IndikatorID)] = ctx.notePer[String(r.IndikatorID)] || []).push(r); });
    return { success: true, html: def.fn(m, user, params, ctx), title: def.title };
  } catch (e) {
    const s = String((e && e.message) || e);
    return { success: false, expired: s === 'SESI_HABIS', message: s === 'SESI_HABIS' ? 'Sesi berakhir. Silakan masuk kembali.' : 'Gagal memuat halaman: ' + s };
  }
}
