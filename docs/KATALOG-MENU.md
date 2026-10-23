# Katalog Menu — DKPPKB Sulbar Intelligence

Tangkapan layar diambil dari pratinjau lokal (`tools/pratinjau`) dengan **data contoh**, sudah memakai
gaya visual baru yang mengikuti video promosi (status hijau/oranye/merah, judul Space Grotesk, logo DK biru).
Angka di gambar bukan data riil.

## Peta menu

| Kelompok | Menu | Peran | Fungsi utama |
|---|---|---|---|
| — | Halaman awal | Publik | Pintu masuk: **Login** atau **Minta Data** tanpa akun; galeri dan kalender kegiatan |
| Utama | Beranda | Semua | Kepatuhan pengisian, 4 KPI status, indikator populer, peringkat bidang, tren bulanan, kalender pengisian, capaian per bidang, status kabupaten, catatan kritis, focal point |
| Indikator | Input Data | Admin, PIC | Isi realisasi per bulan, analisis, rekomendasi, unggah bukti |
| Indikator | Indikator Kesehatan | Semua | Daftar 25 indikator, target & pencapaian, capaian per periode, input target |
| Indikator | Monev SPBE | Semua | Level 1–5 per indikator SPBE per triwulan, tren, bukti |
| Indikator | Monev Kinerja | Semua | Tujuan/sasaran → program → IK, target, realisasi TW, bukti, unit PIC |
| Analisis | Capaian & Analitik | Semua | Rata-rata per bidang, distribusi status, per jenis (IKU/SPM), tren indikator |
| Layanan | Laporan Eksekutif | Admin, Pimpinan | Ringkasan eksekutif, unduh PDF, tarik data PDF/CSV per bidang/indikator |
| Layanan | Permintaan Data | Semua | Ajukan & tinjau permintaan, filter status, lampiran |
| Administrasi | Tambah Indikator | Admin | Indikator baru + katalog indikator kesehatan siap pakai |
| Administrasi | Kelola Pengguna | Admin | Akun, peran, PIC program, reset sandi, nonaktifkan |
| Administrasi | Sync Form | Admin | ETL spreadsheet sektoral → `db_clean`, log sinkronisasi |
| Lainnya | Pengaturan | Semua (konfigurasi: admin) | Ubah sandi, periode, cut-off, kabupaten, pengingat, logo |
| Lainnya | Panduan Pengguna | Semua | Tanya-jawab cara pakai |

Navigasi bawah di ponsel: Beranda · Indikator · Monev SPBE · Data · Menu.

## Celah fitur yang terlihat dari katalog

Bahan untuk `REKOMENDASI-FITUR.md`:

- **Permintaan Data** belum punya tombol cetak formulir, pelacakan status oleh publik, maupun statistik layanan.
- **Monev Kinerja** belum terhubung ke **anggaran** (pagu/realisasi keuangan), padahal itu dasar analisis "uang vs hasil".
- **Permasalahan & Rekomendasi** (di Beranda) belum bisa diubah menjadi **usulan kegiatan**.
- **Status Kabupaten** hanya berupa daftar; belum ada **peta** atau kartu skor per kabupaten.
- Beranda sangat panjang di ponsel (±10 layar). Sebaiknya bagian bawah dilipat ("Lihat selengkapnya").

## Tangkapan layar

### Halaman awal
![Halaman awal](tangkapan/00-awal.jpg)

### Beranda (desktop dan ponsel)
![Beranda](tangkapan/01-beranda.jpg)
![Beranda ponsel](tangkapan/hp-beranda.jpg)

### Input Data
![Input Data](tangkapan/02-inputdata.jpg)

### Indikator Kesehatan
![Indikator](tangkapan/03-indikator.jpg)

### Monev SPBE
![Monev SPBE](tangkapan/04-spbe.jpg)

### Monev Kinerja
![Monev Kinerja](tangkapan/05-monev.jpg)

### Capaian & Analitik
![Analitik](tangkapan/06-analitik.jpg)

### Laporan Eksekutif
![Laporan](tangkapan/07-laporan.jpg)

### Permintaan Data (desktop dan ponsel)
![Permintaan Data](tangkapan/08-permintaan.jpg)
![Permintaan Data ponsel](tangkapan/hp-permintaan.jpg)

### Tambah Indikator
![Tambah Indikator](tangkapan/09-tambahindikator.jpg)

### Kelola Pengguna
![Kelola Pengguna](tangkapan/10-pengguna.jpg)

### Sync Form
![Sync Form](tangkapan/11-syncform.jpg)

### Pengaturan
![Pengaturan](tangkapan/12-pengaturan.jpg)

### Panduan Pengguna
![Panduan](tangkapan/13-panduan.jpg)
