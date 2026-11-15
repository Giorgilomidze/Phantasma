/* =========================================================================
   Ads Management - knowledge-import.js (15 Nov 2026, C4)
   Reads a file for the company information Claude uses in Messaging (Brands → "Information for Claude") and
   returns its plain text. Only the text is saved, never the file.
     - .txt / .csv: as they are (UTF-8).
     - Word (.docx) and PowerPoint (.pptx): the text inside their XML, taken out of the zip with the browser's own
       DecompressionStream (no library).
     - Excel (.xlsx / .xls): through SheetJS, the same pinned copy the stock import loads on first use.
   Pure functions, no UI and no data access: problems come back as i18n keys (app.js shows them); saving goes
   through AdsApi.addKnowledgeFile in api.js.
   ========================================================================= */
(function () {
  'use strict';

  var LIMITS = { mb: 10, chars: 100000, entryMb: 60 };
  var KINDS = { txt: 'txt', csv: 'csv', docx: 'docx', pptx: 'pptx', xlsx: 'xlsx', xls: 'xlsx' };

  function kindOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? KINDS[m[1].toLowerCase()] || null : null;
  }
  function fail(key) { var e = new Error(key); e.key = key; return e; }

  /* ---- 1. A small zip reader: the central directory, then the wanted entries (stored or deflated) ---- */
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function zipEntries(bytes) {
    var end = -1;
    for (var i = bytes.length - 22; i >= 0 && i >= bytes.length - 65557; i--) {
      if (u32(bytes, i) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw fail('kn.err.read');
    var count = u16(bytes, end + 10), p = u32(bytes, end + 16), list = [];
    for (var n = 0; n < count; n++) {
      if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) throw fail('kn.err.read');
      var nlen = u16(bytes, p + 28), xlen = u16(bytes, p + 30), clen = u16(bytes, p + 32);
      list.push({ name: new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen)), method: u16(bytes, p + 10),
        csize: u32(bytes, p + 20), usize: u32(bytes, p + 24), local: u32(bytes, p + 42) });
      p += 46 + nlen + xlen + clen;
    }
    return list;
  }
  function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(fail('kn.err.browser'));
    var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function entryText(bytes, e, inflate) {
    if (e.usize > LIMITS.entryMb * 1048576) return Promise.reject(fail('kn.err.read')); // no zip bombs
    var p = e.local;
    if (p + 30 > bytes.length || u32(bytes, p) !== 0x04034b50) return Promise.reject(fail('kn.err.read'));
    var start = p + 30 + u16(bytes, p + 26) + u16(bytes, p + 28);
    var raw = bytes.subarray(start, start + e.csize);
    var data = e.method === 0 ? Promise.resolve(raw) : e.method === 8 ? (inflate || inflateRaw)(raw) : Promise.reject(fail('kn.err.read'));
    return data.then(function (d) { return new TextDecoder().decode(d); });
  }

  /* ---- 2. Text out of the XML ---- */
  function decode(s) {
    return s.replace(/&#x([0-9a-f]+);/gi, function (_m, x) { return String.fromCodePoint(parseInt(x, 16)); })
      .replace(/&#([0-9]+);/g, function (_m, d) { return String.fromCodePoint(parseInt(d, 10)); })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  function tidy(s) {
    return s.split('\n').map(function (l) { return l.replace(/[ \t]+/g, ' ').trim(); }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function docxText(xml) {
    var s = xml.replace(/<w:(instrText|delText)\b[^>]*>[\s\S]*?<\/w:\1>/g, '')        // field codes, deleted text
      .replace(/<w:tab\/>/g, ' ').replace(/<w:br\/>/g, '\n')
      // a table row becomes one line: "cell | cell"
      .replace(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g, function (_m, inner) { return inner.replace(/<\/w:p>/g, ' ') + '\u0001'; })
      .replace(/<\/w:tr>/g, '\n').replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '');
    s = decode(s).replace(/\u0001\s*\n/g, '\n').replace(/\u0001/g, ' | ');
    return tidy(s);
  }
  function slideText(xml) {
    return tidy(decode(xml.replace(/<a:br\/>/g, '\n').replace(/<\/a:p>/g, '\n').replace(/<[^>]+>/g, '')));
  }

  function fromZip(bytes, kind, inflate) {
    var list = zipEntries(bytes);
    if (kind === 'docx') {
      var doc = list.filter(function (e) { return e.name === 'word/document.xml'; })[0];
      if (!doc) return Promise.reject(fail('kn.err.read'));
      return entryText(bytes, doc, inflate).then(docxText);
    }
    var slides = list.filter(function (e) { return /^ppt\/slides\/slide\d+\.xml$/.test(e.name); })
      .sort(function (a, b) { return parseInt(a.name.replace(/\D+/g, ''), 10) - parseInt(b.name.replace(/\D+/g, ''), 10); });
    if (!slides.length) return Promise.reject(fail('kn.err.read'));
    return Promise.all(slides.map(function (e) { return entryText(bytes, e, inflate).then(slideText); })).then(function (texts) {
      return texts.map(function (t, i) { return t ? 'Slide ' + (i + 1) + ':\n' + t : ''; }).filter(Boolean).join('\n\n');
    });
  }
  function fromExcel(buf) {
    var load = window.AdsStockImport && window.AdsStockImport.loadXlsx;
    if (!load) return Promise.reject(fail('kn.err.read'));
    return load().then(function (X) {
      var wb = X.read(new Uint8Array(buf), { type: 'array' });
      return wb.SheetNames.map(function (n) {
        var csv = X.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false }).trim();
        return csv ? 'Sheet: ' + n + '\n' + csv : '';
      }).filter(Boolean).join('\n\n');
    });
  }

  /* ---- 3. One file → { name, kind, bytes, text, cut } (cut = longer than the limit, only the start is kept) ---- */
  function read(file, opts) {
    opts = opts || {};
    var kind = kindOf(file && file.name);
    if (!kind) return Promise.reject(fail('kn.err.type'));
    if (!file.size) return Promise.reject(fail('kn.err.empty'));
    if (file.size > LIMITS.mb * 1048576) return Promise.reject(fail('kn.err.size'));
    var bufP = file.arrayBuffer ? file.arrayBuffer() : new Response(file).arrayBuffer();
    return bufP.then(function (buf) {
      if (kind === 'txt' || kind === 'csv') return tidy(new TextDecoder().decode(new Uint8Array(buf)).replace(/\r\n?/g, '\n'));
      if (kind === 'xlsx') return fromExcel(buf);
      return fromZip(new Uint8Array(buf), kind, opts.inflate);
    }).then(function (text) {
      if (!text) throw fail('kn.err.empty');
      var cut = text.length > LIMITS.chars;
      return { name: String(file.name).slice(0, 200), kind: kind, bytes: file.size, text: cut ? text.slice(0, LIMITS.chars) : text, cut: cut };
    }, function (e) { throw e && e.key ? e : fail('kn.err.read'); });
  }

  window.AdsKnowledgeImport = { read: read, kindOf: kindOf, limits: LIMITS, accept: '.txt,.csv,.docx,.pptx,.xlsx,.xls',
    _test: { zipEntries: zipEntries, docxText: docxText, slideText: slideText } };
})();
