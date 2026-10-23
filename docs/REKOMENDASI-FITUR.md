# Rekomendasi Fitur — DKPPKB Sulbar Intelligence

Disusun dari pembacaan kode di `src/` (Oktober 2026). Semua saran memperhitungkan batasan
**Google Apps Script + Google Spreadsheet** sebagai basis data.

Aplikasi sekarang sudah punya: Beranda, Indikator, Capaian & Analitik, Monitoring Pengisian,
Input Data, Monev Kinerja, Monev SPBE, Permasalahan & Rekomendasi, Laporan Eksekutif (PDF),
Permintaan Data (publik + internal, lampiran), Kalender, Galeri, Sync Form sektoral,
Kelola Pengguna, Pengaturan, Panduan. Jadi rekomendasi di bawah fokus pada **pelengkap**,
bukan membangun ulang.

---

## A. Prinsip agar aplikasi tetap ringan (wajib dibaca dulu)

Batasan Apps Script yang perlu diingat:

| Batasan | Angka kira-kira | Akibatnya |
|---|---|---|
| Waktu eksekusi per panggilan | 6 menit | Proses berat (rekap tahunan, PDF besar) harus dipecah |
| Ukuran satu entri CacheService | 100 KB, kedaluwarsa maks. 6 jam | Sudah ditangani dengan potongan 40 KB di `cacheTulis_` |
| Pemicu (trigger) harian | ±90 menit total/hari (akun gratis) | Jangan jadwalkan pemicu tiap 5 menit |
| Email | ±100/hari (akun gratis) | Pengingat massal harus diringkas |
| Spreadsheet | 10 juta sel | Sheet `Log` dan `Isian` yang terus tumbuh perlu diarsipkan |

Tujuh aturan praktis:

1. **Baca sheet sekali, simpan di cache.** Pola `readTable_` + `CacheService` yang sudah ada sudah benar.
   Setiap fitur baru wajib memakai `readTable_`, jangan `getRange().getValue()` per sel di dalam perulangan.
2. **Tulis secara massal.** Pakai `setValues()` satu kali untuk banyak baris (seperti `appendRows_`), bukan `appendRow` berulang.
3. **Jangan hitung model penuh untuk halaman yang tidak memerlukannya.**
   Saat ini `getPageContent` selalu memanggil `hitungModel_` (membaca 7+ sheet) bahkan untuk halaman
   Permintaan Data, Kalender, Pengguna, atau Panduan. Tambahkan penanda `butuhModel: false` di `PAGES_`
   untuk halaman-halaman itu → halaman tersebut akan terbuka jauh lebih cepat. **Ini perbaikan dengan dampak terbesar.**
4. **Arsipkan data lama setahun sekali.** Pindahkan isi sheet `Log` (dan `Isian` tahun < tahun-2) ke
   spreadsheet arsip terpisah lewat fungsi `arsipTahunan()` yang dijalankan manual tiap Januari.
5. **Simpan hasil olahan, bukan hanya data mentah.** Untuk rekap yang berat (mis. tren 5 tahun),
   buat sheet `Rekap` yang diisi pemicu malam hari; halaman cukup membaca sheet kecil itu.
6. **Berkas ke Google Drive, bukan ke sel.** Sudah diterapkan (bukti, lampiran, galeri). Pertahankan.
7. **Grafik digambar di browser dengan SVG/CSS** (seperti `miniBatang_`, `donut_`), jangan memuat pustaka
   grafik besar. Bila perlu pustaka, pilih yang kecil (mis. Chart.js ±70 KB) dan muat hanya di halaman Analitik.

---

## B. Fitur yang direkomendasikan (urut prioritas)

Label beban: 🟢 ringan · 🟡 sedang · 🔴 berat (perlu sheet rekap / pemicu)

### Prioritas 1 — langsung terasa manfaatnya

| # | Fitur | Manfaat | Beban | Catatan teknis |
|---|---|---|---|---|
| 1 | **Formulir Permintaan Data siap cetak** (lihat bagian C) | Bukti resmi, bisa diparaf & diarsip, tertib administrasi | 🟢 | Dicetak dari browser (`window.print()`), tanpa server |
| 2 | **Lacak status permintaan oleh publik** (masukkan nomor PD-xxx) | Pemohon tak perlu menelepon admin | 🟢 | Fungsi `apiCekPermintaanPublik(id, kontak)` — cocokkan ID + 4 digit akhir kontak agar aman |
| 3 | **Notifikasi email ke pemohon saat status berubah** | Layanan publik lebih profesional | 🟢 | `MailApp.sendEmail` di `apiUbahStatusPermintaan`, hanya bila kontak berupa email |
| 4 | **Statistik layanan data** (jumlah permintaan/bulan, rata-rata waktu selesai, % tepat waktu) | Bahan laporan kinerja & SPBE (indikator layanan data) | 🟢 | Hitung dari sheet `PermintaanData` yang kecil |
| 5 | **Halaman ringan** (aturan A.3) | Semua halaman non-dasbor lebih cepat | 🟢 | Ubah `PAGES_` + `getPageContent` |
| 6 | **Ekspor Excel/CSV per halaman** | Pimpinan & perencana bisa olah lanjut | 🟢 | Pola `apiTarikData` (CSV) sudah ada; perluas ke tabel lain |

### Prioritas 2 — memperkuat perencanaan & penganggaran

| # | Fitur | Manfaat | Beban | Catatan teknis |
|---|---|---|---|---|
| 7 | **Peta capaian per kabupaten** (6 kabupaten Sulbar) | Melihat ketimpangan wilayah sekilas | 🟡 | SVG peta sederhana disimpan statis; warna dari capaian. Tanpa Google Maps |
| 8 | **Kartu skor kabupaten** (ranking indikator per kab.) | Dasar usulan intervensi/lokus | 🟡 | Butuh kolom realisasi per kabupaten (sudah ada `KabTertunda`, perlu detail angka) |
| 9 | **Keterkaitan indikator ↔ program/kegiatan/anggaran** (sheet `Anggaran`: pagu, realisasi keuangan) | Analisis "uang vs hasil": serapan anggaran dibanding capaian kinerja | 🟡 | Sesuai tugas Subbag Keuangan & Aset; satu sheet baru, isi per triwulan |
| 10 | **Peringatan dini otomatis** (indikator turun 2 bulan berturut / kritis) | Masalah terdeteksi sebelum akhir tahun | 🟡 | Hitung saat pemicu harian yang sudah ada (`pengingatHarian`), bukan saat halaman dibuka |
| 11 | **Draf usulan kegiatan** dari Permasalahan & Rekomendasi | Jembatan langsung analisis data → usulan Renja/RKA | 🟢 | Tombol "Jadikan usulan" yang menyalin masalah ke sheet `Usulan` (judul, lokus, perkiraan biaya, indikator sasaran) |
| 12 | **Laporan triwulan otomatis (PDF)** format resmi | Mempercepat pelaporan ke Bappeda/Kemendagri | 🟡 | Pola `apiExportPdf` sudah ada; tambah template triwulan |

### Prioritas 3 — tata kelola & kenyamanan

| # | Fitur | Manfaat | Beban |
|---|---|---|---|
| 13 | **Riwayat perubahan per data** ("siapa mengubah apa") di layar | Audit & akuntabilitas | 🟢 (sheet `Log` sudah ada; tampilkan saja per indikator) |
| 14 | **Katalog data / metadata** (definisi, sumber, frekuensi, PIC tiap indikator) | Mendukung Satu Data Indonesia | 🟢 |
| 15 | **Pengumuman / papan informasi** di beranda | Komunikasi internal tanpa grup WA | 🟢 |
| 16 | **Mode luring sederhana** (draf isian tersimpan di browser bila sinyal putus) | Membantu PIC di daerah sinyal lemah | 🟢 (`localStorage`) |
| 17 | **Inventaris aset sederhana** (BMD: kode, kondisi, lokasi, foto) | Sesuai tugas Subbag Aset | 🟡 (modul terpisah, sebaiknya spreadsheet sendiri) |

Saran saya: **jangan tambah semuanya**. Kerjakan nomor 1, 5, 2, 4 terlebih dulu (semua 🟢),
lalu nomor 9 dan 11 karena paling terkait dengan tujuan Anda: analisis data sebagai dasar usulan kegiatan.

---

## C. Formulir Permintaan Data yang bisa dicetak

Contoh tampilannya ada di **`docs/contoh-formulir-permintaan-data.html`** — buka berkas itu
di browser, lalu tekan **Ctrl+P** untuk melihat hasil cetak A4.

Isi formulir yang disarankan:

1. **Kop surat** dinas (logo Pemprov Sulbar, nama dinas, alamat, telepon, email).
2. **Judul & nomor**: "FORMULIR PERMINTAAN DATA" + nomor `PD-…` (sudah dibuat otomatis oleh sistem).
3. **Identitas pemohon**: nama, instansi, kontak, sumber (publik/internal), tanggal pengajuan.
4. **Rincian permintaan**: data yang diminta, format, tujuan penggunaan, batas waktu.
5. **Hasil tinjauan**: status, catatan admin, ditinjau oleh, tanggal.
6. **Pernyataan penggunaan data** (data hanya untuk tujuan yang disebutkan, mencantumkan sumber).
7. **Kolom tanda tangan**: Pemohon, Petugas Layanan Data, Mengetahui Kepala Subbagian / Kepala Dinas.
8. **Bagian tanda terima** yang bisa digunting (untuk pemohon).

Cara memasangnya di aplikasi (ringan, tanpa beban server):

- Di modal "Buka" permintaan (`openPmt` di `JavaScript.html`) tambahkan tombol **Cetak Formulir**.
- Tombol itu membuka jendela baru berisi HTML formulir yang diisi dari data `d` yang **sudah ada di browser**,
  lalu memanggil `window.print()`. Tidak ada panggilan ke server sama sekali.
- Kop surat (nama dinas, alamat, nama pejabat penanda tangan) diambil dari sheet `Config`,
  sehingga bisa diubah dari menu Pengaturan tanpa mengubah kode.
- Opsional: tombol "Simpan PDF ke Drive" memakai pola `apiExportPdf` bila arsip digital diperlukan
  (ini 🟡 karena konversi PDF memakan waktu server ±2–4 detik).

---

## D. Rekomendasi desain antarmuka

Desain sekarang sudah baik (palet biru-oranye, font Figtree, mode gelap, kartu membulat,
navigasi bawah untuk ponsel). Saran penyempurnaan:

> **Sudah diterapkan (Oktober 2026):** gaya visual mengikuti video promosi — status hijau/oranye/merah,
> judul Space Grotesk, sudut kartu 20px, lambang DK biru, kartu KPI 2 kolom di ponsel. Lihat `KATALOG-MENU.md`.

### D.1 Identitas visual pemerintahan
- **Kurangi radius kartu** dari `2rem` menjadi `16px`. Radius besar terasa "aplikasi konsumen";
  radius sedang terasa lebih formal dan muat lebih banyak data.
- Tetapkan **satu warna utama** (biru) untuk aksi, **oranye hanya untuk peringatan/aksi penting**.
  Sekarang tombol "Permintaan Data" memakai `btn-alert` oranye — sebaiknya biru, simpan oranye untuk status Kritis.
- Tambahkan **logo Pemprov Sulbar + nama dinas** di kepala laporan cetak dan PDF.

### D.2 Dasbor eksekutif (untuk pimpinan)
- Baris atas: **4 kartu KPI saja** (Capaian rata-rata, Indikator Kritis, Kepatuhan Pengisian, Permintaan Data Baru).
  Lebih dari 4 membuat mata pimpinan tidak tahu mana yang penting.
- Setiap kartu KPI: angka besar, perubahan dibanding bulan lalu (▲/▼), dan garis tren kecil (sparkline).
- Di bawahnya: **"3 hal yang perlu perhatian bulan ini"** — daftar otomatis indikator terburuk.

### D.3 Tabel & formulir
- Tabel panjang: kepala tabel tetap (`position: sticky`), angka rata kanan, dan kolom status berwarna.
- Formulir: label di atas kolom, contoh isian di placeholder, pesan kesalahan tepat di bawah kolom.
- Tombol utama selalu di kanan bawah formulir, tombol batal di sebelah kirinya (ghost).

### D.4 Ponsel
- Target sentuh minimal 44 px (sudah diterapkan di `.seg-btn`, terapkan juga ke tombol kecil `btn-sm`).
- Tabel lebar di ponsel diubah menjadi kartu bertumpuk.

### D.5 Cetak
- Perluas `@media print` di `Stylesheet.html`: latar putih, tanpa bayangan, ukuran A4,
  `page-break-inside: avoid` untuk kartu, dan kop dinas tampil hanya saat cetak.

---

## E. Langkah berikutnya yang disarankan

1. Tentukan 3–4 fitur dari bagian B yang ingin dikerjakan lebih dulu.
2. Minta Claude mengerjakan satu fitur per sesi (lebih mudah diuji dan dibatalkan bila ada masalah).
3. Uji di salinan spreadsheet (bukan data asli) sebelum membuat "Versi baru" deployment.
4. Untuk belajar: mulai dari membaca `Kode.gs` bagian `readTable_` dan `appendObj_` —
   itu pola "SQL sederhana" ala Spreadsheet, jembatan yang baik sebelum belajar SQL sungguhan.
