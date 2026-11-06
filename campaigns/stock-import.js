/* =========================================================================
   Ads Management - stock-import.js
   Reads a stock file in the browser and checks every row BEFORE anything is
   saved: Excel (.xlsx, .xls), OpenDocument (.ods) or CSV. Required in every
   row: product name and quantity. Optional: sell price (GEL).
   Pure functions, no UI and no data access: problems come back as i18n keys
   (app.js translates and shows them); saving goes through
   AdsApi.importStock in api.js.
   SheetJS (free community edition, pinned version + integrity hash) is
   loaded from its CDN on first use only, never on page load.
   ========================================================================= */
(function () {
  'use strict';

  var XLSX_SRC = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  var XLSX_SRI = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';
  var LIMITS = { rows: 20000, mb: 10, headerRows: 10, name: 300 };
  var TYPES = ['xlsx', 'xls', 'ods', 'csv'];

  /* ---- 1. SheetJS, loaded once on first use ---- */
  var libP = null;
  function loadLib() {
    if (window.XLSX && window.XLSX.read) return Promise.resolve(window.XLSX);
    if (libP) return libP;
    libP = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = XLSX_SRC; s.integrity = XLSX_SRI; s.crossOrigin = 'anonymous';
      s.onload = function () { if (window.XLSX && window.XLSX.read) resolve(window.XLSX); else failed(); };
      s.onerror = failed;
      function failed() {
        libP = null; s.remove(); // the next try loads it again
        reject(keyError('stock.err.load'));
      }
      document.head.appendChild(s);
    });
    return libP;
  }
  function keyError(key, vars) { var e = new Error(key); e.key = key; e.vars = vars || {}; return e; }
  function fail(key, vars) { return { error: { key: key, vars: vars || {} } }; }

  /* ---- 2. Column names ---- */
  var ALIASES = {
    name: ['product name', 'product', 'name', 'item', 'item name', 'პროდუქტის დასახელება', 'პროდუქტის სახელი', 'პროდუქტი',
      'დასახელება', 'სახელი', 'наименование', 'товар', 'название'],
    quantity: ['quantity', 'qty', 'stock', 'in stock', 'amount', 'count', 'რაოდენობა', 'ნაშთი', 'მარაგი', 'количество', 'остаток', 'кол-во'],
    price: ['product sell price', 'sell price', 'selling price', 'sale price', 'retail price', 'price', 'გასაყიდი ფასი',
      'გასაყ. ფასი', 'გასაყ ფასი', // the pharmacy's own stock report (6 Nov 2026)
      'საცალო ფასი', 'ფასი', 'цена', 'цена продажи', 'розничная цена']
  };
  // "Sell price (GEL):" -> "sell price": lower-case, anything in brackets, * and : dropped, spaces collapsed.
  function headKey(v) {
    return String(v).toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, ' ').replace(/[*:]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function roleOf(v) {
    var k = headKey(v);
    return Object.keys(ALIASES).filter(function (role) { return ALIASES[role].indexOf(k) !== -1; })[0] || null;
  }
  // Which column holds what in one row: { name: { c, title }, quantity: {...}, price: {...} }.
  // The first matching column wins.
  function columnsIn(cells) {
    var out = {};
    Object.keys(cells).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) {
      var role = roleOf(cells[c]);
      if (role && !out[role]) out[role] = { c: c, title: text(cells[c]) };
    });
    return out;
  }

  /* ---- 3. Cell values ---- */
  var SPACES = /[\s​﻿]+/g; // \s includes the non-breaking space
  function isBlank(v) { return v == null || String(v).replace(SPACES, '') === ''; }
  function text(v) { return String(v).replace(SPACES, ' ').trim(); }
  // Same product = same key: spaces collapsed, case ignored.
  function nameKey(v) { return text(v).toLowerCase(); }
  function shown(v) { var s = text(v); return s.length > 40 ? s.slice(0, 39) + '…' : s; }
  // Number from a cell. Text is cleaned first: spaces and currency marks (₾, GEL, ლარი, ლ, $)
  // removed; a comma alone is a decimal comma (19,90); with both marks the last one is the
  // decimal mark (1.234,50 / 1,234.50); the same mark more than once groups thousands.
  // NaN when it is not a number.
  function toNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (typeof v !== 'string') return NaN;
    var s = v.replace(SPACES, '').replace(/₾|gel|ლარი|ლ|\$/gi, '');
    var c = s.lastIndexOf(','), d = s.lastIndexOf('.');
    if (c !== -1 && d !== -1) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (c !== -1) s = s.indexOf(',') === c ? s.replace(',', '.') : s.replace(/,/g, '');
    else if (d !== -1 && s.indexOf('.') !== d) s = s.replace(/\./g, '');
    return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? parseFloat(s) : NaN;
  }

  /* ---- 4. Reading the file ---- */
  function extOf(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
  function bytesOf(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsArrayBuffer(file);
    });
  }
  // CSV text: strict UTF-8, else Windows Cyrillic (older Excel "CSV" exports). UTF-16 when it starts with a byte-order mark.
  function csvText(buf) {
    var b = new Uint8Array(buf);
    if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b);
    if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return new TextDecoder('windows-1251').decode(b); }
  }
  // Every non-empty cell of a sheet by row: { r: { c: value } }, r and c from 0. Only cells that
  // exist are visited, so a sheet whose used range is huge costs nothing extra.
  function cellsByRow(X, ws) {
    var rows = {};
    function add(r, c, cell) {
      if (!cell) return;
      var v = cell.t === 'e' ? (cell.w || '#ERROR') : cell.v; // error cells: keep the text (#N/A), not the code
      if (isBlank(v)) return;
      (rows[r] = rows[r] || {})[c] = v;
    }
    if (ws['!data']) {
      ws['!data'].forEach(function (row, r) { (row || []).forEach(function (cell, c) { add(r, c, cell); }); });
    } else {
      Object.keys(ws).forEach(function (ref) {
        if (ref.charAt(0) === '!') return;
        var a = X.utils.decode_cell(ref);
        add(a.r, a.c, ws[ref]);
      });
    }
    return rows;
  }
  function parse(X, wb) {
    var sheet = null, rows = null;
    for (var i = 0; i < wb.SheetNames.length && !sheet; i++) {
      var ws = wb.Sheets[wb.SheetNames[i]];
      var cells = ws ? cellsByRow(X, ws) : {};
      if (Object.keys(cells).length) { sheet = wb.SheetNames[i]; rows = cells; }
    }
    if (!sheet) return fail('stock.err.empty');
    var order = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
    // Column names: the first of the first 10 rows that names both a product and a quantity column.
    var head = null;
    for (var k = 0; k < Math.min(LIMITS.headerRows, order.length) && !head; k++) {
      var found = columnsIn(rows[order[k]]);
      if (found.name && found.quantity) head = { at: k, r: order[k], cols: found };
    }
    if (!head) return fail('stock.err.noHeader', { sheet: sheet });
    var data = order.slice(head.at + 1); // rows with content after the column names
    if (!data.length) return fail('stock.err.noRows', { sheet: sheet });
    if (data.length > LIMITS.rows) return fail('stock.err.tooMany', { n: data.length, max: LIMITS.rows });

    var cols = head.cols, ready = [], problems = [], notes = [], seen = {};
    data.forEach(function (r) {
      var cells = rows[r], row = r + 1; // Excel numbers rows from 1
      var rawName = cells[cols.name.c], rawQty = cells[cols.quantity.c], rawPrice = cols.price ? cells[cols.price.c] : null;
      function bad(key, vars) { problems.push({ row: row, key: key, vars: vars || {} }); }
      if (isBlank(rawName) && isBlank(rawQty)) return bad('stock.p.bothEmpty');
      if (isBlank(rawName)) return bad('stock.p.nameEmpty');
      if (isBlank(rawQty)) return bad('stock.p.qtyEmpty');
      var name = text(rawName);
      if (name.length > LIMITS.name) return bad('stock.p.nameLong', { max: LIMITS.name });
      var q = toNumber(rawQty);
      if (isNaN(q)) return bad('stock.p.qtyNaN', { value: shown(rawQty) });
      if (q < 0) return bad('stock.p.qtyNeg', { value: shown(rawQty) });
      var key = nameKey(name);
      // A bad price never blocks the row: it is imported without one, with a note.
      var price = null;
      if (cols.price && !isBlank(rawPrice)) {
        var p = toNumber(rawPrice);
        if (isNaN(p)) notes.push({ row: row, key: 'stock.n.priceNaN', vars: { value: shown(rawPrice) } });
        else if (p < 0) notes.push({ row: row, key: 'stock.n.priceNeg', vars: { value: shown(rawPrice) } });
        else price = Math.round(p * 100) / 100;
      }
      // The same product again: stock reports list every batch on its own row, so the
      // quantities are added up. The first price stays; a different one gets a note.
      var first = seen[key];
      if (first) {
        first.quantity = Math.round((first.quantity + q) * 1000) / 1000;
        if (price !== null && first.sell_price === null) first.sell_price = price;
        else if (price !== null && price !== first.sell_price) notes.push({ row: row, key: 'stock.n.priceDiff', vars: { n: first.row, value: price } });
        notes.push({ row: row, key: 'stock.n.merged', vars: { n: first.row } });
        return;
      }
      seen[key] = { row: row, name: name, quantity: Math.round(q * 1000) / 1000, sell_price: price };
      ready.push(seen[key]);
    });
    function col(x) { return x ? { letter: X.utils.encode_col(x.c), title: x.title } : null; }
    return {
      sheet: sheet, headerRow: head.r + 1,
      columns: { name: col(cols.name), quantity: col(cols.quantity), price: col(cols.price) },
      rows: ready, problems: problems, notes: notes, totalRows: data.length
    };
  }

  // Reads and checks a stock file. Resolves with
  //   { sheet, headerRow, columns: { name, quantity, price|null } (each { letter, title }),
  //     rows: [{ row, name, quantity, sell_price|null }], problems: [{ row, key, vars }],
  //     notes: [{ row, key, vars }], totalRows }
  // or with { error: { key, vars } } when the file cannot be used at all.
  // Rejects (error.key 'stock.err.load') only when SheetJS cannot be loaded.
  function read(file) {
    var ext = extOf(file && file.name);
    if (TYPES.indexOf(ext) === -1) return Promise.resolve(fail('stock.err.type'));
    if (file.size > LIMITS.mb * 1048576) return Promise.resolve(fail('stock.err.size', { mb: LIMITS.mb }));
    if (!file.size) return Promise.resolve(fail('stock.err.empty'));
    return loadLib().then(function (X) {
      return bytesOf(file).then(function (buf) {
        var wb;
        try {
          // CSV: every cell stays text (raw), so "19,90" is not misread; numbers are cleaned above.
          wb = ext === 'csv' ? X.read(csvText(buf), { type: 'string', raw: true })
            : X.read(new Uint8Array(buf), { type: 'array', cellFormula: false, cellHTML: false });
        } catch (e) {
          return fail(/password|encrypt/i.test(String(e && e.message)) ? 'stock.err.password' : 'stock.err.read');
        }
        return parse(X, wb);
      }, function () { return fail('stock.err.read'); });
    });
  }

  // Downloads phantasma-stock-template.xlsx: sheet "Stock" (column names + one example row) and
  // sheet "How to fill" (the rules in English and Georgian, texts from i18n.js).
  // The free SheetJS edition cannot write bold text, so the column names are plain.
  var TPL_KEYS = ['stock.tpl.title', 'stock.tpl.r1', 'stock.tpl.r2', 'stock.tpl.r3', 'stock.tpl.r4', 'stock.tpl.r5', 'stock.tpl.r6', 'stock.tpl.r7'];
  function template() {
    return loadLib().then(function (X) {
      var dict = (window.AdsI18n && window.AdsI18n.dict) || { en: {}, ka: {} };
      var stock = X.utils.aoa_to_sheet([
        ['Product name', 'Quantity', 'Sell price (GEL)'],
        ['Example product - delete this row', 12, 19.9]
      ]);
      stock['!cols'] = [{ wch: 42 }, { wch: 12 }, { wch: 18 }];
      stock.C2.z = '0.00'; // shows 19.90
      var how = X.utils.aoa_to_sheet(TPL_KEYS.map(function (k) { return [dict.en[k] || '', dict.ka[k] || dict.en[k] || '']; }));
      how['!cols'] = [{ wch: 100 }, { wch: 100 }];
      var wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, stock, 'Stock');
      X.utils.book_append_sheet(wb, how, 'How to fill');
      X.writeFile(wb, 'phantasma-stock-template.xlsx', { compression: true });
    });
  }

  window.AdsStockImport = { read: read, template: template, toNumber: toNumber, limits: { rows: LIMITS.rows, mb: LIMITS.mb } };
})();
