# Panduan Pemasangan — DKPPKB Sulbar Intelligence

## 1. Buat proyek Apps Script
1. Buat **Google Spreadsheet** kosong (nama bebas, mis. "Basis Data DKPPKB Intelligence").
2. Menu **Ekstensi → Apps Script**.
3. Buat file persis seperti ini (isi dari file yang diberikan):
   - `Kode.gs`, `Halaman.gs` (jenis Script)
   - `Index`, `Stylesheet`, `JavaScript` (jenis HTML — tanpa ekstensi `.html` saat memberi nama)
   - `appsscript.json`: Project Settings → centang *Show "appsscript.json" manifest file*, lalu tempel isinya.

## 2. Inisialisasi data
1. Di editor, pilih fungsi **setupAplikasi** → Run → izinkan otorisasi (Spreadsheet & Gmail untuk pengingat).
2. Sheet dibuat otomatis + data contoh (25 indikator, 6 bidang, 8 akun).
3. Akun awal (SEGERA ganti kata sandi): `admin/admin123`, `pimpinan/pimpinan123`, `pic.p2kl/pic123` dst.
4. Ganti data contoh dengan data riil lewat sheet **Indikator**, **Users**, **Bidang** atau menu Pengaturan di aplikasi.
   Hapus baris sheet `Isian` contoh sebelum dipakai resmi.

Penting: jalankan setupAplikasi **dari editor** (bukan dari web app); fungsi ini menyimpan ID spreadsheet. Setelah kode diubah, buat **New deployment/versi baru**.

Jika proyek dibuat dari script.google.com (bukan dari dalam Spreadsheet), jalankan `setSpreadsheetId('ID_SPREADSHEET')` sekali.

## 3. Deploy sebagai web app
Deploy → **New deployment** → Web app → Execute as **Me**, Who has access **Anyone** → Deploy → salin URL `/exec`.
**Setiap perubahan kode butuh New version/deployment baru** agar terlihat di URL yang sama.

## 4. Pasang di Blogger (iframe)
Lihat `blogger-embed.html`. Ganti `URL_EXEC_ANDA`, tempel di tab HTML pada Halaman/Entri Blogger.

## 5. Mengisi dan memakai
- Bulan aktif, tahun, cut-off, daftar kabupaten: menu **Pengaturan** (admin).
- PIC mengisi lewat kalender di **Monitoring Pengisian**; admin menyetujui di Antrean Verifikasi.
- Isi **Email** dan **Telepon** tiap PIC agar pengingat email/WhatsApp berfungsi.

## Catatan teknis
- Token sesi hanya di memori browser (tanpa parameter URL). Sesi 6 jam; refresh halaman = login ulang.
- Kata sandi disimpan sebagai hash SHA-256 + salt; 5 kali gagal → terkunci 10 menit.
- Kuota email Google: ±100/hari (akun gratis).
- Status: Tercapai ≥100%, Waspada 80–99%, Kritis <80%. Indikator "Turun" (stunting dll.) dihitung target ÷ realisasi.
