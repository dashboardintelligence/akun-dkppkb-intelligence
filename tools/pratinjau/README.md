# Pratinjau lokal (tanpa deploy)

Menjalankan seluruh aplikasi di browser dengan **data contoh** (dari `seedData_`), tanpa Google Sheets.
Layanan Apps Script (SpreadsheetApp, CacheService, dll.) disimulasikan oleh `mock-gas.js`.
Unggah berkas, email, dan PDF tidak berfungsi di pratinjau.

```
node tools/pratinjau/build.js src tools/pratinjau      # merakit tools/pratinjau/index.html
# buka tools/pratinjau/index.html di browser, masuk dengan admin / admin123
```

Foto semua menu otomatis (butuh Playwright):

```
node tools/pratinjau/foto.js "$PWD/tools/pratinjau" "$PWD/docs/tangkapan" 1280 900   # desktop
node tools/pratinjau/foto.js "$PWD/tools/pratinjau" /tmp/hp 390 844 beranda,permintaan   # ponsel
```

`index.html` dan `server.js` hasil rakitan tidak perlu di-commit (sudah di `.gitignore`).
