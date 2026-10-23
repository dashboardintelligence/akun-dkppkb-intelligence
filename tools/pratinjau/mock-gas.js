/* Simulasi layanan Google Apps Script di browser, khusus pratinjau lokal. */
(function () {
  var TZ = 'Asia/Makassar';
  function sha256(bytes) {
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var l = bytes.length, m = bytes.slice(); m.push(0x80); while (m.length % 64 !== 56) m.push(0);
    var bl = l * 8; for (var i = 7; i >= 0; i--) m.push(i > 3 ? 0 : (bl >>> (i * 8)) & 255);
    var w = new Array(64);
    for (var o = 0; o < m.length; o += 64) {
      for (i = 0; i < 16; i++) w[i] = (m[o+i*4] << 24) | (m[o+i*4+1] << 16) | (m[o+i*4+2] << 8) | m[o+i*4+3];
      for (i = 16; i < 64; i++) { var a0 = w[i-15], a1 = w[i-2]; var s0 = ((a0>>>7)|(a0<<25))^((a0>>>18)|(a0<<14))^(a0>>>3); var s1 = ((a1>>>17)|(a1<<15))^((a1>>>19)|(a1<<13))^(a1>>>10); w[i] = (w[i-16]+s0+w[i-7]+s1)|0; }
      var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
      for (i = 0; i < 64; i++) { var S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)); var ch=(e&f)^(~e&g); var t1=(h+S1+ch+K[i]+w[i])|0; var S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)); var mj=(a&b)^(a&c)^(b&c); var t2=(S0+mj)|0; h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0; }
      H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0;
    }
    var out = []; H.forEach(function (x) { out.push((x>>>24)&255,(x>>>16)&255,(x>>>8)&255,x&255); }); return out;
  }
  function utf8(s) { return Array.from(new TextEncoder().encode(String(s))); }
  function fmt(d, tz, p) {
    d = d instanceof Date ? d : new Date(d);
    var parts = {}; new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      .formatToParts(d).forEach(function (x) { parts[x.type] = x.value; });
    if (parts.hour === '24') parts.hour = '00';
    return p.replace(/yyyy|yy|MM|M|dd|d|HH|mm|ss/g, function (t) {
      return { yyyy: parts.year, yy: parts.year.slice(2), MM: parts.month, M: String(+parts.month), dd: parts.day, d: String(+parts.day), HH: parts.hour, mm: parts.minute, ss: parts.second }[t];
    });
  }
  function Sheet(name) { this.name = name; this.data = []; }
  Sheet.prototype = {
    getName: function () { return this.name; },
    getLastRow: function () { return this.data.length; },
    getLastColumn: function () { return this.data.reduce(function (m, r) { return Math.max(m, r.length); }, 0); },
    getMaxColumns: function () { return Math.max(26, this.getLastColumn()); },
    getMaxRows: function () { return Math.max(1000, this.data.length); },
    insertColumnsAfter: function () { return this; }, setFrozenRows: function () { return this; },
    appendRow: function (r) { this.data.push(r.slice()); return this; },
    getDataRange: function () { return this.getRange(1, 1, Math.max(1, this.data.length), Math.max(1, this.getLastColumn())); },
    deleteRow: function (i) { this.data.splice(i - 1, 1); },
    getRange: function (r, c, nr, nc) {
      var sh = this; nr = nr || 1; nc = nc || 1;
      var rg = {
        getValues: function () { var o = []; for (var i = 0; i < nr; i++) { var row = sh.data[r - 1 + i] || []; var x = []; for (var j = 0; j < nc; j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
        getValue: function () { return rg.getValues()[0][0]; },
        setValues: function (v) { for (var i = 0; i < v.length; i++) { var k = r - 1 + i; while (sh.data.length <= k) sh.data.push([]); for (var j = 0; j < v[i].length; j++) sh.data[k][c - 1 + j] = v[i][j]; } return rg; },
        setValue: function (v) { return rg.setValues([[v]]); },
        setFontWeight: function () { return rg; }, setBackground: function () { return rg; }, setNumberFormat: function () { return rg; }, clearContent: function () { return rg; }
      };
      return rg;
    }
  };
  var SS = { sheets: {}, getId: function () { return 'pratinjau'; },
    getSheetByName: function (n) { return this.sheets[n] || null; },
    insertSheet: function (n) { return (this.sheets[n] = new Sheet(n)); },
    deleteSheet: function (s) { delete this.sheets[s.name]; },
    getSheets: function () { var s = this.sheets; return Object.keys(s).map(function (k) { return s[k]; }); } };
  var store = {};
  var cache = { get: function (k) { return k in store ? store[k] : null; }, put: function (k, v) { store[k] = String(v); },
    getAll: function (ks) { var o = {}; ks.forEach(function (k) { if (k in store) o[k] = store[k]; }); return o; },
    putAll: function (o) { Object.keys(o).forEach(function (k) { store[k] = String(o[k]); }); },
    remove: function (k) { delete store[k]; }, removeAll: function (ks) { ks.forEach(function (k) { delete store[k]; }); } };
  var props = {};
  var P = { getProperty: function (k) { return k in props ? props[k] : null; }, setProperty: function (k, v) { props[k] = String(v); return P; },
    deleteProperty: function (k) { delete props[k]; return P; }, getProperties: function () { return Object.assign({}, props); } };
  window.SpreadsheetApp = { openById: function () { return SS; }, getActiveSpreadsheet: function () { return SS; } };
  window.CacheService = { getScriptCache: function () { return cache; } };
  window.PropertiesService = { getScriptProperties: function () { return P; } };
  window.LockService = { getScriptLock: function () { return { waitLock: function () {}, tryLock: function () { return true; }, releaseLock: function () {} }; } };
  window.MailApp = { getRemainingDailyQuota: function () { return 100; }, sendEmail: function () {} };
  window.ScriptApp = { getProjectTriggers: function () { return []; } };
  window.DriveApp = { getFileById: function () { throw new Error('Drive tidak tersedia di pratinjau'); }, createFolder: function () { return { getId: function () { return 'folder'; }, createFile: function () { throw new Error('Drive tidak tersedia di pratinjau'); } }; }, getFolderById: function () { return window.DriveApp.createFolder(); } };
  window.Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: function (alg, s) { return sha256(utf8(s)); },
    base64Encode: function (b) { if (typeof b === 'string') b = utf8(b); return btoa(String.fromCharCode.apply(null, b.map(function (x) { return x & 255; }))); },
    base64Decode: function (s) { return Array.from(atob(s), function (c) { return c.charCodeAt(0); }); },
    getUuid: function () { return crypto.randomUUID(); },
    formatDate: fmt, sleep: function () {},
    newBlob: function () { return { getAs: function () { return { getBytes: function () { return []; } }; }, getBytes: function () { return []; } }; }
  };
  window.Logger = { log: function () {} };
  window.google = { script: { run: (function mk(ok, fail) {
    return new Proxy({}, { get: function (_, k) {
      if (k === 'withSuccessHandler') return function (f) { return mk(f, fail); };
      if (k === 'withFailureHandler') return function (f) { return mk(ok, f); };
      if (typeof window[k] !== 'function') return undefined;
      return function () { var a = arguments; setTimeout(function () { try { var r = window[k].apply(null, a); ok && ok(JSON.parse(JSON.stringify(r === undefined ? null : r))); } catch (e) { console.error(e); fail && fail(e); } }, 30); };
    } });
  })() } };
})();
