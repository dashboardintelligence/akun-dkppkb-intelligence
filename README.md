# DKPPKB Sulbar Intelligence

Dasbor eksekutif indikator kesehatan Dinas Kesehatan, Pengendalian Penduduk dan KB Provinsi Sulawesi Barat.
Berjalan di Google Apps Script (data di Google Sheets, berkas bukti di Google Drive).

## Struktur
- `src/` — seluruh kode Apps Script (`Kode.gs`, `Halaman.gs`, `Index.html`, `Stylesheet.html`, `JavaScript.html`, `Latar.html`, `appsscript.json`)
- `docs/` — panduan deploy, kode sematan Blogger, rekomendasi fitur (`REKOMENDASI-FITUR.md`) dan contoh formulir cetak
- `.github/workflows/deploy.yml` — dorong otomatis ke Apps Script (opsional)

## Dua cara menjalankan tampilan
1. **Dilayani Apps Script / disematkan di Blogger** (cara awal): URL web app Apps Script langsung menampilkan aplikasi.
2. **Tampilan statis di GitHub Pages** (folder `web/`): halaman dilayani GitHub, data dan logika tetap di Apps Script lewat API JSON (`doPost`).
   Keduanya memakai kode yang sama di `src/`; `web/build.js` hanya merakitnya menjadi `web/dist/`.

### Memasang tampilan statis
1. Deploy Apps Script terbaru (`Kode.gs` sudah memuat `doPost`): Deploy > Kelola deployment > **Versi baru**, akses **Siapa saja**. Salin URL berakhiran `/exec`.
2. Di GitHub: Settings > Secrets and variables > Actions > tab **Variables** > New variable: `API_URL` = URL tadi.
   (Atau tulis URL di `web/config.js`.)
3. Settings > Pages > Source = **GitHub Actions**.
4. Push ke `main` (atau Actions > "Terbitkan ke GitHub Pages" > Run workflow). Alamat situs muncul di ringkasan job.
5. Uji lokal: `API_URL=https://script.google.com/macros/s/XXXX/exec node web/build.js && npx serve web/dist`.

Catatan: GitHub Pages untuk repo **private** butuh paket berbayar (Pro/Team). Pada paket gratis, repo harus publik;
tampilan statis tidak berisi rahasia (data tetap di balik login), tetapi `src/Kode.gs` memuat sandi awal contoh,
jadi sebaiknya kode Apps Script tetap di repo private dan folder `web/` diterbitkan dari repo publik terpisah.

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
