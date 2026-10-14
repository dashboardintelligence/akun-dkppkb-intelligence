# DKPPKB Sulbar Intelligence

Dasbor eksekutif indikator kesehatan Dinas Kesehatan, Pengendalian Penduduk dan KB Provinsi Sulawesi Barat.
Berjalan di Google Apps Script (data di Google Sheets, berkas bukti di Google Drive).

## Struktur
- `src/` — seluruh kode Apps Script (`Kode.gs`, `Halaman.gs`, `Index.html`, `Stylesheet.html`, `JavaScript.html`, `Latar.html`, `appsscript.json`)
- `docs/` — panduan deploy dan kode sematan Blogger
- `.github/workflows/deploy.yml` — dorong otomatis ke Apps Script (opsional)

## Alur kerja
1. Sekali saja: `npm i -g @google/clasp`, lalu `clasp login`.
2. Salin `.clasp.json.example` menjadi `.clasp.json`, isi `scriptId` (Apps Script > Setelan Proyek > ID skrip).
3. Ambil kode terbaru dari Apps Script bila ada perubahan manual di editor: `clasp pull`.
4. Ubah kode di `src/`, lalu `clasp push`.
5. Di editor Apps Script: Deploy > Kelola deployment > Edit > **Versi baru**.
6. `git add . && git commit -m "..." && git push`.

## Setelah memasang versi ini
- Jalankan fungsi `otorisasiDrive` sekali (izin Drive untuk unggah bukti).
- Jalankan fungsi `pengingatHarian` sekali bila memakai pengingat otomatis (izin pemicu dan email).

## Keamanan
- Repo ini sebaiknya **private**. Jangan commit ID spreadsheet, kata sandi, `.clasprc.json`, atau data asli.
- Ganti kata sandi akun bawaan (`admin`, `pimpinan`, `pic.*`) setelah setup pertama.
