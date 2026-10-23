const { chromium } = require('playwright');
const P = process.argv[2], OUT = process.argv[3], W = +process.argv[4] || 1280, H = +process.argv[5] || 900, only = process.argv[6];
const MENU = ['beranda','inputdata','indikator','spbe','monev','analitik','laporan','permintaan','tambahindikator','pengguna','syncform','pengaturan','panduan'];
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = []; pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + P + '/index.html'); await pg.waitForTimeout(800);
  await pg.screenshot({ path: OUT + '/00-awal.png' });
  await pg.click('[data-land="login"]'); await pg.fill('#login-user', 'admin'); await pg.fill('#login-pass', 'admin123'); await pg.click('#login-btn');
  await pg.waitForSelector('#app-container .page-head, #app-container .hero', { timeout: 15000 });
  for (const [i, m] of MENU.entries()) {
    if (only && only.split(',').indexOf(m) < 0) continue;
    await pg.evaluate(id => { const el = document.querySelector('.nav-item[data-nav="' + id + '"]') || document.querySelector('[data-nav="' + id + '"]'); el && el.click(); }, m);
    await pg.waitForTimeout(900);
    await pg.screenshot({ path: OUT + '/' + String(i + 1).padStart(2, '0') + '-' + m + '.png', fullPage: true });
  }
  console.log('errors:', errs.slice(0, 10).join('\n') || 'none');
  await b.close();
})();
