#!/usr/bin/env node
/* Merakit tampilan statis (GitHub Pages) dari berkas di ../src.
 * Pemakaian:  node web/build.js          -> web/dist
 * Opsional :  API_URL=https://script.google.com/macros/s/XXXX/exec node web/build.js */
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src'), OUT = path.join(__dirname, 'dist');
const rd = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const unwrap = (s, tag) => s.replace(new RegExp('^\\s*<' + tag + '[^>]*>'), '').replace(new RegExp('</' + tag + '>\\s*$'), '').trim() + '\n';

let html = rd('Index.html')
  .replace(/\s*<base target="_top">/, '')
  .replace(/data-logo="<\?= logoUrl \?>"/, 'data-logo=""')
  .replace(/data-nama="<\?= namaApp \?>"/, 'data-nama="DKPPKB Sulbar"')
  .replace(/data-sub="<\?= subApp \?>"/, 'data-sub="Intelligence"')
  .replace(/<\?!= include\('Stylesheet'\) \?>/, () => '<link rel="stylesheet" href="style.css">')
  .replace(/<\?!= include\('Latar'\) \?>/, () => '<link rel="stylesheet" href="latar.css">')
  .replace(/<\?!= include\('JavaScript'\) \?>/, () => '<script src="config.js"></script>\n  <script src="app.js"></script>');
if (/<\?/.test(html)) throw new Error('Masih ada tag template di Index.html');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'style.css'), unwrap(rd('Stylesheet.html'), 'style'));
fs.writeFileSync(path.join(OUT, 'latar.css'), unwrap(rd('Latar.html'), 'style'));
fs.writeFileSync(path.join(OUT, 'app.js'), unwrap(rd('JavaScript.html'), 'script'));
let cfg = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');
if (process.env.API_URL) {
  if (!/^https:\/\/script\.google\.com\/[^\s"'<>]+$/.test(process.env.API_URL)) throw new Error('API_URL tidak valid');
  cfg = 'window.DKPPKB_API = ' + JSON.stringify(process.env.API_URL) + ';\n';
}
fs.writeFileSync(path.join(OUT, 'config.js'), cfg);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log('Selesai: ' + OUT + ' (' + fs.readdirSync(OUT).join(', ') + ')');
