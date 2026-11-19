/* =========================================================================
   PIM — product information for E-commerce automation (/ecommerce/). C7 Ecommerce Platform, 18 Nov 2026.
   Owner: "Create section PIM … Products, Manufacturers, Brands, Sellers … each product with A+ content and several
   versions … the image library like the advertising module (bulk uploads, Gemini and ChatGPT pictures) … deliver
   the MVP and I will improve after."
   Data: the PIM tables of supabase/0047 (members of the workspace read and write them; RLS); pictures in the private
   bucket ecom-library at <workspace id>/<file>; AI pictures through the Edge Function ecom-generate-image.
   Uses window.EcomApp (app.js: helpers, tables, route registry). One IIFE, no build step; every text from the
   database is written with textContent.
   1. Helpers  2. Manufacturers / brands / sellers  3. Image library, upload, AI, picker  4. Products (list with
   quick edit, search with filters, Sync with Amazon, products from the Amazon listings or from Excel; 18 Nov 2026,
   SQL 0048)  5. Product editor  6. A+ content  7. Routes
   ========================================================================= */
(function () {
  'use strict';
  var A = window.EcomApp;
  if (!A) return;
  var h = A.h;
  var BUCKET = 'ecom-library';
  var MISSING = 'The PIM tables are not there yet: run supabase/0047-ecom-pim.sql in Supabase (SQL Editor).';
  var TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

  /* 1. Helpers ------------------------------------------------------------ */
  function sb() { return A.client(); }
  function fail(e) {
    var m = (e && (e.message || e.error_description || e.error)) || String(e);
    if (e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|Could not find the .* column/i.test(m)))
      return new Error('This page needs supabase/0048-ecom-pim-sync.sql: run it in Supabase (SQL Editor).');
    if (e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|Bucket not found/i.test(m))) return new Error(MISSING);
    if (e && e.code === '23505') return new Error('This name or SKU exists already in this workspace.');
    if (e && e.code === '23503') return new Error('Still in use: ' + (/brands/.test(m) ? 'this manufacturer has brands.' : 'other records point to it.'));
    if (e && e.code === '23514') return new Error('A value is not allowed (' + m + ').');
    if (/storage_full/.test(m)) return new Error('The image library of this workspace is full (500 MB).');
    return new Error(m);
  }
  function q(p) { return p.then(function (r) { if (r.error) throw fail(r.error); return r.data; }); }
  function wsOr(main) {
    var w = A.ws();
    if (!w) main.appendChild(h('p', { class: 'ecm-note', text: 'No workspace.' }));
    return w;
  }
  function errorBox(box, e) { box.innerHTML = ''; box.appendChild(h('p', { class: 'ecm-error', role: 'alert', text: e.message })); }
  function uuid() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function kb(b) { return b == null ? '' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB'; }
  function go(hash) { if (location.hash === hash) A.go(); else location.hash = hash; }
  function norm(v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' '); }
  // Small line icons, drawn here (inline SVG; owner, 20 Nov 2026): pencil = edit, eye = open, smile arrow = Amazon
  var ICON = {
    pencil: ['M4 20h4L19 9l-4-4L4 16v4z', 'M13.5 6.5l4 4'],
    eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    amazon: ['M3 12.5c5.2 3.8 12.8 3.8 18 0', 'M17.4 10.6l3.6 1.9-1.9 3.4']
  };
  function icon(name, cls) {
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    [['viewBox', '0 0 24 24'], ['width', '16'], ['height', '16'], ['aria-hidden', 'true'], ['focusable', 'false'], ['class', 'pim-ico' + (cls ? ' ' + cls : '')]]
      .forEach(function (a) { svg.setAttribute(a[0], a[1]); });
    ICON[name].forEach(function (d) {
      var path = document.createElementNS(NS, 'path');
      [['d', d], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']]
        .forEach(function (a) { path.setAttribute(a[0], a[1]); });
      svg.appendChild(path);
    });
    return svg;
  }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  // Every row of a query (the database gives at most 1000 per request); make() builds the query again per page
  function pageAll(make) {
    var out = [];
    return (function step(from) {
      return q(make().range(from, from + 999)).then(function (rows) { out = out.concat(rows || []); return rows && rows.length === 1000 ? step(from + 1000) : out; });
    })(0);
  }
  // fn(item, i) for every item, n at a time; fn handles its own errors
  function pool(items, n, fn) {
    var next = 0, run = [];
    function worker() { if (next >= items.length) return Promise.resolve(); var i = next++; return Promise.resolve(fn(items[i], i)).then(worker); }
    for (var k = 0; k < Math.min(n, items.length); k++) run.push(worker());
    return Promise.all(run);
  }

  // A modal window (native <dialog>: Esc and the ✕ close it; focus stays inside)
  function dialog(title, body, actions, wide) {
    var dlg = h('dialog', { class: 'ecm-dialog' + (wide ? ' ecm-dialog--wide' : ''), 'aria-label': title });
    function close() { if (dlg.open) dlg.close(); }
    dlg.appendChild(h('div', { class: 'ecm-dialog__head' }, [h('h2', { class: 'ecm-h2', text: title }),
      h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', 'aria-label': 'Close', text: '✕', onclick: close })]));
    dlg.appendChild(h('div', { class: 'ecm-dialog__body' }, body));
    if (actions && actions.length) dlg.appendChild(h('div', { class: 'ecm-dialog__foot' }, actions));
    dlg.addEventListener('close', function () { dlg.remove(); });
    document.body.appendChild(dlg);
    dlg.showModal();
    return { el: dlg, close: close };
  }

  // Form fields: { k, t, req, max, type, opts, area, rows, hint, upper, wide }
  var seq = 0;
  function control(f, value) {
    var id = 'pim-f-' + f.k + '-' + (++seq), el;
    if (f.opts) {
      el = h('select', { class: 'ecm-input', id: id }, f.opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      el.value = value == null ? f.opts[0][0] : String(value);
    } else if (f.area) {
      el = h('textarea', { class: 'ecm-input pim-area', id: id, rows: String(f.rows || 4), maxlength: f.max ? String(f.max) : null });
      el.value = value == null ? '' : String(value);
    } else {
      // numbers as text with a decimal keyboard: "45,5" and "45.5" both work (a number field would drop the comma)
      el = h('input', { class: 'ecm-input', id: id, type: 'text', maxlength: f.max ? String(f.max) : (f.type === 'number' ? '12' : null),
        inputmode: f.type === 'number' ? 'decimal' : null, autocomplete: 'off' });
      el.value = value == null ? '' : String(value);
    }
    return el;
  }
  function fieldRow(f, el) {
    return h('div', { class: 'pim-field' + (f.wide ? ' pim-field--wide' : '') }, [
      h('label', { for: el.id, text: f.t + (f.req ? ' *' : '') }), el, f.hint ? h('span', { class: 'pim-hint', text: f.hint }) : null]);
  }
  function readValue(f, el) {
    var v = String(el.value == null ? '' : el.value).trim();
    if (v === '') return null;
    if (f.ref) return parseInt(v, 10);
    if (f.type === 'number') { var n = parseFloat(v.replace(',', '.')); return isFinite(n) ? n : NaN; }
    return f.upper ? v.toUpperCase().replace(/\s+/g, '') : v;
  }
  function checkValue(f, v) {
    if (f.req && (v == null || v === '')) return f.t + ' is required.';
    if (typeof v === 'number' && isNaN(v)) return f.t + ': type a number.';
    if (v != null && f.re && !f.re.test(String(v))) return f.t + ': ' + f.reMsg;
    return '';
  }

  // Signed links for private pictures (1 hour), cached per path
  var urlCache = {};
  function signed(paths) {
    var need = paths.filter(function (p) { return p && !urlCache[p]; });
    if (!need.length) return Promise.resolve(urlCache);
    return sb().storage.from(BUCKET).createSignedUrls(need, 3600).then(function (r) {
      ((r && r.data) || []).forEach(function (x) { if (x && x.path && x.signedUrl) urlCache[x.path] = x.signedUrl; });
      return urlCache;
    });
  }
  // Amazon pictures are links (0048), not files: shown straight from Amazon, smaller through Amazon's size suffix
  var AMZ_IMG = /^https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9._%+-]+$/;
  var SOURCE = { upload: 'uploaded', gemini: 'Gemini', openai: 'ChatGPT', amazon: 'Amazon' };
  function amzSized(url, px) { return px ? String(url).replace(/(\.[A-Za-z]+)$/, '._SL' + px + '_$1') : url; }
  function imgSrc(i, px) { return !i ? '' : i.url ? amzSized(i.url, px) : (urlCache[i.path] || ''); }
  function signRows(rows) { return signed(rows.filter(function (i) { return i && i.path; }).map(function (i) { return i.path; })); }

  /* 2. Manufacturers / brands / sellers ----------------------------------- */
  var F_NAME = { k: 'name', t: 'Name', req: true, max: 200 };
  var F_STATUS = { k: 'status', t: 'Status', opts: [['active', 'Active'], ['inactive', 'Inactive']] };
  var C_ID = { k: 'id', t: 'ID', num: true }, C_CREATED = { k: 'created_at', t: 'Created', f: A.isoMinute }, C_UPDATED = { k: 'updated_at', t: 'Updated', f: A.isoMinute };
  var ENT = {
    // Manufacturers (owner, 19 Nov 2026): a short name, shown in every list, dropdown and filter, and the full (legal)
    // name, kept in the column alt_name
    'pim-manufacturers': { table: 'ecom_manufacturers', title: 'Manufacturers', one: 'manufacturer',
      fields: [{ k: 'name', t: 'Short name', req: true, max: 60, hint: 'Shown in lists, dropdowns and filters' },
               { k: 'alt_name', t: 'Full name', max: 200, hint: 'The legal name, e.g. Orthomol pharmazeutische Vertriebs GmbH' }, F_STATUS],
      cols: [C_ID, { k: 'name', t: 'Short name' }, { k: 'alt_name', t: 'Full name', wide: true }, { k: '_brands', t: 'Brands', num: true },
             { k: 'status', t: 'Status' }, C_CREATED, C_UPDATED] },
    // Brands: no alternative name (owner, 19 Nov 2026)
    'pim-brands': { table: 'ecom_brands', title: 'Brands', one: 'brand',
      fields: [{ k: 'manufacturer_id', t: 'Manufacturer', req: true, ref: true }, F_NAME, F_STATUS],
      cols: [C_ID, { k: '_manufacturer', t: 'Manufacturer' }, { k: 'name', t: 'Name', wide: true }, { k: 'status', t: 'Status' }, C_CREATED, C_UPDATED] },
    'pim-sellers': { table: 'ecom_sellers', title: 'Sellers', one: 'seller',
      fields: [F_NAME, { k: 'seller_type', t: 'Type', opts: [['seller', 'Seller'], ['vendor', 'Vendor']] }, F_STATUS,
               { k: 'amazon_seller_id', t: 'Amazon seller ID', max: 20, upper: true, re: /^[A-Z0-9]{8,20}$/, reMsg: '8 to 20 letters or digits',
                 hint: 'Optional: the product monitor then shows this name instead of the id.' }],
      cols: [C_ID, { k: 'name', t: 'Seller name', wide: true }, { k: 'seller_type', t: 'Type' }, { k: 'status', t: 'Status' },
             { k: 'amazon_seller_id', t: 'Amazon seller ID', mono: true }, C_CREATED, C_UPDATED] }
  };

  function renderEntity(id, main) {
    var E = ENT[id];
    A.header(main, E.title);
    var w = wsOr(main); if (!w) return;
    var bar = h('div', { class: 'ecm-tools' }), box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' }));
    main.append(bar, box);
    var loads = [q(sb().from(E.table).select('*').eq('workspace_id', w.id).order('id', { ascending: false }))];
    if (id === 'pim-brands') loads.push(q(sb().from('ecom_manufacturers').select('id,name,status').eq('workspace_id', w.id).order('name')));
    if (id === 'pim-manufacturers') loads.push(q(sb().from('ecom_brands').select('manufacturer_id').eq('workspace_id', w.id)));
    function reload() { main.innerHTML = ''; renderEntity(id, main); }
    Promise.all(loads).then(function (res) {
      var rows = res[0] || [], other = res[1] || [];
      if (id === 'pim-manufacturers') {
        var n = {}; other.forEach(function (b) { n[b.manufacturer_id] = (n[b.manufacturer_id] || 0) + 1; });
        rows.forEach(function (r) { r._brands = n[r.id] || 0; });
      }
      if (id === 'pim-brands') {
        var m = {}; other.forEach(function (x) { m[x.id] = x.name; });
        rows.forEach(function (r) { r._manufacturer = m[r.manufacturer_id] || '#' + r.manufacturer_id; });
      }
      box.innerHTML = '';
      bar.appendChild(h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: '+ New ' + E.one,
        disabled: id === 'pim-brands' && !other.length, onclick: function () { editEntity(id, null, other, reload); } }));
      if (id === 'pim-brands' && !other.length) bar.appendChild(h('span', { class: 'ecm-note', text: 'Create a manufacturer first: every brand belongs to one.' }));
      box.appendChild(A.dataTable(id, { title: E.title, cols: E.cols, onRow: function (r) { editEntity(id, r, other, reload); }, onRowLabel: 'Edit' },
        rows, { label: w.name }).el);
    }).catch(function (e) { errorBox(box, e); });
  }

  function editEntity(id, row, other, done) {
    var E = ENT[id], ctrls = {}, body = h('div', { class: 'pim-form' });
    E.fields.forEach(function (f) {
      var el;
      if (f.ref) {
        el = h('select', { class: 'ecm-input', id: 'pim-f-' + f.k + '-' + (++seq) }, [h('option', { value: '', text: 'Choose a manufacturer' })].concat(
          other.map(function (m) { return h('option', { value: String(m.id), text: m.name + ' (ID ' + m.id + ')' + (m.status === 'inactive' ? ' · inactive' : '') }); })));
        if (row) el.value = String(row[f.k]);
      } else el = control(f, row ? row[f.k] : null);
      ctrls[f.k] = el;
      body.appendChild(fieldRow(f, el));
    });
    if (row) body.appendChild(h('p', { class: 'pim-hint pim-field--wide', text: 'ID ' + row.id + ' · created ' + A.fmtTime(row.created_at) + ' · updated ' + A.fmtTime(row.updated_at) }));
    var err = h('p', { class: 'ecm-error pim-field--wide', role: 'alert' });
    body.appendChild(err);
    var save = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: row ? 'Save' : 'Create' });
    var del = row ? h('button', { type: 'button', class: 'ecm-btn ecm-btn--danger ecm-btn--small', text: 'Delete' }) : null;
    var d = dialog((row ? 'Edit ' : 'New ') + E.one, body, [del, save].filter(Boolean));
    save.addEventListener('click', function () {
      var v = {}, msg = '';
      E.fields.forEach(function (f) { var x = readValue(f, ctrls[f.k]); msg = msg || checkValue(f, x); v[f.k] = x; });
      if (msg) { err.textContent = msg; return; }
      save.disabled = true; err.textContent = '';
      var p = row ? sb().from(E.table).update(v).eq('id', row.id) : sb().from(E.table).insert(Object.assign({ workspace_id: A.ws().id }, v));
      q(p).then(function () { d.close(); A.toast((row ? 'Saved ' : 'Created ') + E.one + ' ' + v.name + '.'); done(); })
        .catch(function (e) { err.textContent = e.message; save.disabled = false; });
    });
    if (del) del.addEventListener('click', function () {
      if (!window.confirm('Delete ' + E.one + ' "' + row.name + '"?')) return;
      q(sb().from(E.table).delete().eq('id', row.id)).then(function () { d.close(); A.toast('Deleted.'); done(); })
        .catch(function (e) { err.textContent = e.message; });
    });
  }

  /* 3. Image library, upload, AI pictures, picker ------------------------- */
  function loadImages(opts) {
    var w = A.ws();
    var qy = sb().from('ecom_images').select('id,path,url,title,tags,source,prompt,mime,bytes,width,height,created_at,archived_at')
      .eq('workspace_id', w.id).order('id', { ascending: false }).limit(1000);
    if (!(opts && opts.archived)) qy = qy.is('archived_at', null);
    return q(qy);
  }
  function dims(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { ok({ w: im.naturalWidth, h: im.naturalHeight }); URL.revokeObjectURL(url); };
      im.onerror = function () { URL.revokeObjectURL(url); bad(new Error('not a readable picture')); };
      im.src = url;
    });
  }
  function guessMime(name) { var e = String(name).toLowerCase().split('.').pop(); return e === 'png' ? 'image/png' : (e === 'jpg' || e === 'jpeg') ? 'image/jpeg' : e === 'webp' ? 'image/webp' : ''; }
  // Bulk upload: up to 50 pictures per go, each PNG / JPEG / WebP ≤ 10 MB; file first, then its row (the file is
  // removed again if the row is refused, e.g. library full)
  function uploadFiles(files, line, done) {
    var list = Array.prototype.slice.call(files || []), w = A.ws(), ids = [], bad = [];
    if (!list.length) return;
    if (list.length > 50) { bad.push((list.length - 50) + ' more files: at most 50 per upload'); list = list.slice(0, 50); }
    (function next(i) {
      if (i >= list.length) {
        line.textContent = ids.length + ' of ' + list.length + ' pictures uploaded' + (bad.length ? '. Not uploaded: ' + bad.join('; ') : '.');
        done(ids);
        return;
      }
      line.textContent = 'Uploading ' + (i + 1) + ' of ' + list.length + '…';
      var f = list[i], mime = TYPES[f.type] ? f.type : guessMime(f.name);
      if (!TYPES[mime]) { bad.push(f.name + ' (not PNG, JPEG or WebP)'); next(i + 1); return; }
      if (f.size > 10485760) { bad.push(f.name + ' (over 10 MB)'); next(i + 1); return; }
      if (!f.size) { bad.push(f.name + ' (empty)'); next(i + 1); return; }
      var path = w.id + '/' + uuid() + '.' + TYPES[mime];
      dims(f).then(function (d) {
        return sb().storage.from(BUCKET).upload(path, f, { contentType: mime, upsert: false, cacheControl: '3600' }).then(function (r) {
          if (r.error) throw fail(r.error);
          return q(sb().from('ecom_images').insert({ workspace_id: w.id, path: path, title: f.name.replace(/\.[^.]+$/, '').slice(0, 200), source: 'upload',
            mime: mime, bytes: f.size, width: d.w, height: d.h }).select('id').single()).then(function (row) { ids.push(row.id); }, function (e) {
            sb().storage.from(BUCKET).remove([path]);
            throw e;
          });
        });
      }).catch(function (e) { bad.push(f.name + ' (' + e.message + ')'); }).then(function () { next(i + 1); });
    })(0);
  }
  function fileButton(label, onFiles) {
    var input = h('input', { type: 'file', multiple: true, accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp', hidden: true });
    input.addEventListener('change', function () { onFiles(input.files); input.value = ''; });
    return [h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: label, onclick: function () { input.click(); } }), input];
  }

  function tile(img, opts) {
    var pic = h('img', { alt: img.title || 'picture', loading: 'lazy', class: 'pim-tile__img' });
    if (imgSrc(img, 320)) pic.src = imgSrc(img, 320);
    var t = h(opts && opts.onPick ? 'button' : 'button', { type: 'button', class: 'pim-tile' + (opts && opts.on ? ' is-on' : '') + (img.archived_at ? ' is-archived' : ''),
      'aria-pressed': opts && opts.onPick ? String(!!opts.on) : null, title: img.title || '',
      onclick: function () { if (opts && opts.onPick) opts.onPick(img, t); else if (opts && opts.onOpen) opts.onOpen(img); } }, [
      pic, h('span', { class: 'pim-tile__name', text: img.title || ('#' + img.id) }),
      h('span', { class: 'pim-tile__meta', text: '#' + img.id + ' · ' + (img.url ? 'link' : kb(img.bytes)) + (img.source !== 'upload' ? ' · ' + (SOURCE[img.source] || img.source) : '') + (img.archived_at ? ' · archived' : '') })]);
    return t;
  }
  // Pictures and the products that use them (owner, 19 Nov 2026): the search finds pictures by their products'
  // manufacturer, brand, name, ASIN and SKU, and by tags; Amazon pictures carry their ASIN as a tag
  var IKINDS = { maker: 'Manufacturer', brand: 'Brand', name: 'Product name', asin: 'ASIN', sku: 'SKU', tag: 'Tag', text: 'Contains' };
  var IFX_HINT = 'Search or filter: manufacturer, brand, product name, ASIN, SKU, tag';
  function imageIndex(pctx, all) {
    var x = { makers: pctx ? pctx.makers : [], brands: pctx ? pctx.brands : [], rows: pctx ? pctx.rows : [], byImage: {}, tags: [] }, seen = {};
    x.rows.forEach(function (p) { (p.image_ids || []).forEach(function (id) { (x.byImage[id] = x.byImage[id] || []).push(p); }); });
    all.forEach(function (i) {
      (i.tags || []).forEach(function (t) { if (!seen[t]) { seen[t] = 1; x.tags.push(t); } });
      i._all = norm([i.id, i.title, (i.tags || []).join(' '), SOURCE[i.source] || i.source].concat((x.byImage[i.id] || []).map(function (p) {
        var m = p.manufacturer_id ? byId(x.makers, p.manufacturer_id) : null;
        return [p.id, p.sku, p.asin, p.title, nameOf(x.brands, p.brand_id), m ? m.name + ' ' + (m.alt_name || '') : ''].join(' ');
      })).join(' '));
    });
    x.tags.sort();
    return x;
  }
  function matchesImage(i, chips, x) {
    var by = {}, prods = x.byImage[i.id] || [];
    chips.forEach(function (c) { (by[c.kind] = by[c.kind] || []).push(c); });
    return Object.keys(by).every(function (kind) {
      var list = by[kind];
      if (kind === 'text') return list.every(function (c) { return (i._all || '').indexOf(norm(c.value)) >= 0; });
      if (kind === 'tag') return list.some(function (c) { return (i.tags || []).indexOf(c.value) >= 0; });
      return list.some(function (c) {
        if (kind === 'asin' && (i.tags || []).indexOf(String(c.value).toLowerCase()) >= 0) return true;
        return prods.some(function (p) {
          return kind === 'maker' ? p.manufacturer_id === c.value : kind === 'brand' ? p.brand_id === c.value : kind === 'name' ? p.title === c.value
            : kind === 'asin' ? p.asin === c.value : p.sku === c.value;
        });
      });
    });
  }
  function suggestImages(x, text) {
    var t = norm(text), out = [], used = x.rows.filter(function (p) { return (p.image_ids || []).length; });
    function hit(s) { return !t || norm(s).indexOf(t) >= 0; }
    function take(kind, list, max) { list.slice(0, max).forEach(function (o) { out.push({ kind: kind, value: o.value, label: o.label }); }); }
    function uniq(key) {
      var seen = {}, list = [];
      used.forEach(function (p) { var v = p[key]; if (v && !seen[v] && hit(v)) { seen[v] = 1; list.push({ value: v, label: v.length > 80 ? v.slice(0, 79) + '…' : v }); } });
      return list;
    }
    if (t) out.push({ kind: 'text', value: String(text).trim(), label: 'Search everywhere for "' + String(text).trim() + '"' });
    take('maker', x.makers.filter(function (m) { return hit(m.name) || (m.alt_name && hit(m.alt_name)); }).map(function (m) { return { value: m.id, label: m.name }; }), t ? 5 : 6);
    take('brand', x.brands.filter(function (b) { return hit(b.name); }).map(function (b) { return { value: b.id, label: b.name }; }), t ? 5 : 6);
    if (t) { take('name', uniq('title'), 5); take('asin', uniq('asin'), 5); take('sku', uniq('sku'), 5); }
    take('tag', x.tags.filter(hit).map(function (g) { return { value: g, label: g }; }), t ? 6 : 10);
    return out;
  }
  // A grid of pictures: search with filters, the source as one row of buttons (owner, 19 Nov 2026), 20 per page
  function imageGrid(all, opts) {
    var st = { chips: [], src: '' }, shown = [], x = imageIndex(opts.pctx, all);
    var fx = filterBox({ kinds: IKINDS, hint: IFX_HINT, label: 'Search or filter pictures', suggest: function (t) { return suggestImages(x, t); },
                         onChange: function (chips) { st.chips = chips; apply(); } });
    var SRC = [['', 'All'], ['upload', 'Uploads'], ['gemini', 'Gemini'], ['openai', 'ChatGPT'], ['amazon', 'Amazon']].concat(opts.archived ? [['archived', 'Archived']] : []);
    var seg = h('div', { class: 'pim-seg', role: 'group', 'aria-label': 'Pictures from' });
    SRC.forEach(function (o) {
      seg.appendChild(h('button', { type: 'button', class: 'pim-seg__btn', 'data-src': o[0], 'aria-pressed': String(o[0] === st.src), text: o[1], onclick: function () {
        st.src = o[0];
        Array.prototype.forEach.call(seg.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-src') === st.src)); });
        apply();
      } }));
    });
    var count = h('span', { class: 'ecm-tools__count', 'aria-live': 'polite' });
    var grid = h('div', { class: 'pim-grid' });
    var pager = A.pagerBar(draw);
    function apply() {
      shown = all.filter(function (i) {
        if (st.src === 'archived') { if (!i.archived_at) return false; } else if (i.archived_at && opts.archived) return false;
        if (st.src && st.src !== 'archived' && i.source !== st.src) return false;
        return matchesImage(i, st.chips, x);
      });
      pager.set(shown.length, 0);
      count.textContent = A.fmtInt(shown.length) + (shown.length === 1 ? ' picture' : ' pictures');
      draw();
    }
    function draw() {
      var page = shown.slice(pager.page() * A.PAGE_ROWS, (pager.page() + 1) * A.PAGE_ROWS);
      grid.innerHTML = '';
      if (!page.length) { grid.appendChild(h('p', { class: 'ecm-note', text: all.length ? 'No picture matches.' : 'No pictures yet. Upload some or make them with AI.' })); return; }
      signRows(page).then(function () {
        grid.innerHTML = '';
        page.forEach(function (i) { grid.appendChild(tile(i, { on: opts.isOn ? opts.isOn(i) : false, onPick: opts.onPick, onOpen: opts.onOpen })); });
      });
    }
    apply();
    return { el: h('div', null, [h('div', { class: 'ecm-tools pim-tools' }, [fx.el, seg].concat(opts.tools || []).concat([count])), grid, pager.el]), refresh: apply,
             set: function (list) { all = list; x = imageIndex(opts.pctx, all); apply(); }, tags: function () { return x.tags.slice(); } };
  }

  function renderImages(main) {
    A.header(main, 'Image library');
    var w = wsOr(main); if (!w) return;
    var line = h('p', { class: 'ecm-note', 'aria-live': 'polite' });
    var box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' }));
    var usage = h('span', { class: 'ecm-note' });
    main.append(h('div', { class: 'ecm-tools' }, fileButton('Upload pictures', function (files) { uploadFiles(files, line, reload); }).concat([
      h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Make with AI', onclick: function () { aiDialog(reload); } }), usage])), line, box);
    // drag and drop anywhere on the page
    main.addEventListener('dragover', function (e) { e.preventDefault(); });
    main.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files, line, reload); });
    var grid = null, pctxP = pimData(w).catch(function () { return null; });   // the products, for the search (the library works without them)
    function reload() {
      Promise.all([loadImages({ archived: true }), pctxP]).then(function (res) {
        var all = res[0], used = all.reduce(function (a, i) { return a + (i.bytes || 0); }, 0);
        usage.textContent = 'Used ' + kb(used) + ' of 500 MB · PNG, JPEG or WebP up to 10 MB, 50 per upload; you can also drop files here';
        if (!grid) {
          box.innerHTML = '';
          grid = imageGrid(all, { archived: true, pctx: res[1], onOpen: function (i) { imageDetails(i, reload, grid.tags()); } });
          box.appendChild(grid.el);
        } else grid.set(all);
      }).catch(function (e) { errorBox(box, e); });
    }
    reload();
  }

  // Tags of one picture (owner, 19 Nov 2026: several tags): the tags already in the library to click on, or a new one
  function tagPicker(current, known) {
    var sel = (current || []).slice(), chosen = h('div', { class: 'pim-tags', 'aria-live': 'polite' }), more = h('div', { class: 'pim-tags' });
    var input = h('input', { class: 'ecm-input', type: 'text', maxlength: '40', placeholder: 'New tag, then Enter', 'aria-label': 'New tag', autocomplete: 'off' });
    function add(t) { t = norm(t).slice(0, 40); if (t && sel.indexOf(t) < 0 && sel.length < 20) sel.push(t); paint(); }
    function paint() {
      chosen.innerHTML = ''; more.innerHTML = '';
      if (!sel.length) chosen.appendChild(h('span', { class: 'pim-hint', text: 'No tags yet.' }));
      sel.forEach(function (t, i) {
        chosen.appendChild(h('span', { class: 'pim-fx__chip' }, [h('span', { text: t }),
          h('button', { type: 'button', text: '×', 'aria-label': 'Remove tag ' + t, onclick: function () { sel.splice(i, 1); paint(); } })]));
      });
      known.filter(function (t) { return sel.indexOf(t) < 0; }).slice(0, 40).forEach(function (t) {
        more.appendChild(h('button', { type: 'button', class: 'pim-tagbtn', text: '+ ' + t, 'aria-label': 'Add tag ' + t, onclick: function () { add(t); } }));
      });
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input.value); input.value = ''; } });
    paint();
    return { el: h('div', { class: 'pim-tagpick' }, [chosen, input, known.length ? h('span', { class: 'pim-label', text: 'Tags in the library — click to add:' }) : null, more]),
             value: function () { if (input.value.trim()) { add(input.value); input.value = ''; } return sel.slice(); } };
  }

  function imageDetails(img, done, known) {
    var title = control({ k: 'title', max: 200 }, img.title), tags = tagPicker(img.tags, known || []);
    var pic = h('img', { class: 'pim-detail__img', alt: img.title || 'picture' });
    signRows([img]).then(function () { pic.src = imgSrc(img, 1000); });
    var used = h('p', { class: 'pim-hint', text: 'Checking where it is used…' });
    q(sb().from('ecom_products').select('id,title,sku').eq('workspace_id', A.ws().id).contains('image_ids', [img.id])).then(function (rows) {
      used.textContent = rows.length ? 'Used by ' + rows.length + ' product' + (rows.length === 1 ? '' : 's') + ': ' + rows.slice(0, 5).map(function (r) { return '#' + r.id + ' ' + (r.title || r.sku || ''); }).join(', ') : 'Not used by a product.';
    }).catch(function () { used.textContent = ''; });
    var err = h('p', { class: 'ecm-error', role: 'alert' });
    var body = h('div', { class: 'pim-detail' }, [pic, h('div', { class: 'pim-form' }, [
      fieldRow({ t: 'Name', wide: true }, title), h('div', { class: 'pim-field pim-field--wide' }, [h('span', { class: 'pim-label', text: 'Tags' }), tags.el]),
      h('p', { class: 'pim-hint pim-field--wide', text: '#' + img.id + ' · ' + (img.width ? img.width + ' × ' + img.height + ' px · ' : '') +
        (img.url ? 'from Amazon (a link: it uses no storage)' : kb(img.bytes) + ' · ' + (img.source === 'upload' ? 'uploaded' : 'made with ' + (SOURCE[img.source] || img.source))) +
        ' · ' + A.fmtTime(img.created_at) }),
      img.prompt ? h('p', { class: 'pim-hint pim-field--wide', text: 'Prompt: ' + img.prompt }) : null, used, err])]);
    var save = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: 'Save' });
    var arch = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: img.archived_at ? 'Restore' : 'Archive' });
    var del = h('button', { type: 'button', class: 'ecm-btn ecm-btn--danger ecm-btn--small', text: 'Delete' });
    var open = h('a', { class: 'ecm-btn ecm-btn--ghost ecm-btn--small', href: '#', target: '_blank', rel: 'noopener', text: 'Open full size' });
    signRows([img]).then(function () { open.href = img.url || urlCache[img.path] || '#'; });
    var d = dialog('Picture', body, [del, arch, open, save], true);
    save.addEventListener('click', function () {
      q(sb().from('ecom_images').update({ title: title.value.trim() || null, tags: tags.value() }).eq('id', img.id)).then(function () { d.close(); A.toast('Saved.'); done(); })
        .catch(function (e) { err.textContent = e.message; });
    });
    arch.addEventListener('click', function () {
      q(sb().from('ecom_images').update({ archived_at: img.archived_at ? null : new Date().toISOString() }).eq('id', img.id)).then(function () { d.close(); done(); })
        .catch(function (e) { err.textContent = e.message; });
    });
    del.addEventListener('click', function () {
      if (!window.confirm('Delete this picture for good? Products that use it lose it.')) return;
      q(sb().from('ecom_images').delete().eq('id', img.id)).then(function () {
        if (img.path) sb().storage.from(BUCKET).remove([img.path]);
        d.close(); A.toast('Deleted.'); done();
      }).catch(function (e) { err.textContent = e.message; });
    });
  }

  // AI pictures: Gemini or ChatGPT, through the Edge Function (30 per workspace and day by default)
  function aiDialog(done) {
    var w = A.ws(), refs = [];
    var prompt = control({ k: 'prompt', area: true, rows: 5, max: 8000 }, '');
    var provider = control({ k: 'provider', opts: [['gemini', 'Gemini'], ['openai', 'ChatGPT']] });
    var quality = control({ k: 'quality', opts: [['standard', 'Standard'], ['high', 'High quality (slower)']] });
    var aspect = control({ k: 'aspect', opts: [['1:1', 'Square 1:1'], ['4:5', 'Portrait 4:5'], ['3:4', 'Portrait 3:4'], ['9:16', 'Tall 9:16'], ['4:3', 'Landscape 4:3'], ['16:9', 'Wide 16:9']] });
    var title = control({ k: 'title', max: 200 }, '');
    var info = h('p', { class: 'pim-hint pim-field--wide', text: 'Checking today\'s limit…' });
    var refLine = h('span', { class: 'pim-hint', text: 'none' });
    var err = h('p', { class: 'ecm-error pim-field--wide', role: 'alert' });
    var body = h('div', { class: 'pim-form' }, [
      h('div', { class: 'pim-field pim-field--wide' }, [h('label', { for: prompt.id, text: 'Describe the picture *' }), prompt]),
      fieldRow({ t: 'Made by' }, provider), fieldRow({ t: 'Quality' }, quality), fieldRow({ t: 'Shape' }, aspect), fieldRow({ t: 'Name (optional)' }, title),
      h('div', { class: 'pim-field pim-field--wide' }, [h('span', { class: 'pim-label', text: 'Reference pictures (up to 3)' }), h('div', { class: 'ecm-row' }, [
        h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Choose…', onclick: function () {
          pickImages({ max: 3, selected: refs, title: 'Reference pictures (your own files; Amazon links cannot be sent to the AI)', filesOnly: true }, function (ids) { refs = ids; refLine.textContent = ids.length ? ids.map(function (x) { return '#' + x; }).join(', ') : 'none'; });
        } }), refLine])]), info, err]);
    var make = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: 'Make the picture' });
    var d = dialog('Make a picture with AI', body, [make], true);
    A.invoke('ecom-generate-image', { workspace_id: w.id, check: true }).then(function (r) {
      info.textContent = r.remaining + ' of ' + r.limit + ' AI pictures left today in this workspace · Gemini ' + (r.makers.gemini ? 'ready' : 'not set up') +
        ' · ChatGPT ' + (r.makers.openai ? 'ready' : 'not set up');
    }).catch(function (e) { info.textContent = e.message; });
    make.addEventListener('click', function () {
      var p = prompt.value.trim();
      if (p.length < 3) { err.textContent = 'Describe the picture first.'; return; }
      make.disabled = true; err.textContent = ''; make.textContent = 'Making… (up to 2 minutes)';
      A.invoke('ecom-generate-image', { workspace_id: w.id, prompt: p, provider: provider.value, quality: quality.value, aspect_ratio: aspect.value,
                                        reference_ids: refs, title: title.value.trim() }).then(function (r) {
        d.close(); A.toast('Picture made (' + r.remaining + ' left today).'); done(r.image);
      }).catch(function (e) { err.textContent = e.message; make.disabled = false; make.textContent = 'Make the picture'; });
    });
  }

  // Choose pictures from the library (order = the order of clicking); upload inside the picker too
  function pickImages(opts, cb) {
    var sel = (opts.selected || []).slice(), line = h('p', { class: 'pim-hint', 'aria-live': 'polite' });
    var head = h('p', { class: 'pim-hint' });
    function paint() { head.textContent = sel.length + ' of ' + opts.max + ' chosen' + (sel.length ? ': ' + sel.map(function (x) { return '#' + x; }).join(', ') : '') + ' — click a picture to add or remove it.'; }
    var box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' }));
    var grid = null;
    var pctxP = pimData(A.ws()).catch(function () { return null; });
    function load() {
      Promise.all([loadImages(), pctxP]).then(function (res) {
        var all = res[0];
        if (opts.filesOnly) all = all.filter(function (i) { return !i.url; });
        if (!grid) {
          box.innerHTML = '';
          grid = imageGrid(all, { pctx: res[1], tools: fileButton('Upload', function (files) { uploadFiles(files, line, function (ids) {
              ids.forEach(function (x) { if (sel.length < opts.max) sel.push(x); }); paint(); load(); }); }),
            isOn: function (i) { return sel.indexOf(i.id) >= 0; },
            onPick: function (i, el) {
              var k = sel.indexOf(i.id);
              if (k >= 0) sel.splice(k, 1); else if (sel.length < opts.max) sel.push(i.id); else { A.toast('At most ' + opts.max + '.', 'act'); return; }
              el.classList.toggle('is-on', sel.indexOf(i.id) >= 0); el.setAttribute('aria-pressed', String(sel.indexOf(i.id) >= 0)); paint();
            } });
          box.appendChild(grid.el);
        } else grid.set(all);
      }).catch(function (e) { errorBox(box, e); });
    }
    paint(); load();
    var ok = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: 'Use these' });
    var d = dialog(opts.title || 'Choose pictures', h('div', null, [head, line, box]), [ok], true);
    ok.addEventListener('click', function () { d.close(); cb(sel.slice()); });
  }

  /* 4. Products ------------------------------------------------------------
     Owner, 18 Nov 2026: "edit … directly from PIM, no need to open the product … update SKU, ASIN, GTIN / EAN, brand,
     manufacturer … fulfillment logistics selectable"; "search bar a bit longer … several different filters …
     multiselect: Manufacturer, Brand, Logistics, SKU, ASIN, Product name"; "Sync with Amazon … fill in the information
     about the product"; "upload products from Excel"; "Shopify … coming soon"; "create all products from the merchant
     listings". 4a list + quick edit · 4b search with filters · 4c Sync with Amazon · 4d products from the Amazon
     listings · 4e Excel upload, template and download */
  var BULLETS = 5;   // bullets per product on the page (the database allows 10)
  var LOGI = [['', '—'], ['FBA', 'FBA'], ['FBM', 'FBM']];
  var LIST_SEL = 'id,parent_id,brand_id,manufacturer_id,sku,asin,gtin,pzn,title,logistics,image_ids,status,updated_at,amazon_marketplace,amazon_synced_at';
  var L_COLS = [{ k: 'id', t: 'ID', num: true }, { k: 'parent_id', t: 'Parent', num: true },
    { k: 'sku', t: 'SKU', mono: true, ed: 'sku' }, { k: 'asin', t: 'ASIN', mono: true, ed: 'asin' }, { k: 'gtin', t: 'GTIN / EAN', mono: true, ed: 'gtin' },
    { k: 'pzn', t: 'PZN', mono: true }, { k: 'title', t: 'Product name', wide: true },
    { k: '_maker', t: 'Manufacturer', ed: 'maker' }, { k: '_brand', t: 'Brand', ed: 'brand' }, { k: 'logistics', t: 'Logistics', ed: 'logistics' },
    { k: '_bbp', t: 'Buy Box', num: true, pct: true, tip: true },
    { k: '_pics', t: 'Pictures', num: true }, { k: '_aplus', t: 'A+', num: true }, { k: 'status', t: 'Status' }, { k: 'updated_at', t: 'Updated', f: A.isoMinute }];
  var busy = false;   // one import or bulk fill at a time

  function route(main) {
    var parts = location.hash.replace(/^#\/?/, '').split('/');   // pim-products / <id> / aplus / <version id>
    if (parts[1] && parts[2] === 'aplus' && parts[3]) return renderAplus(main, parseInt(parts[1], 10), parseInt(parts[3], 10));
    if (parts[1]) return renderProduct(main, parts[1] === 'new' ? null : parseInt(parts[1], 10));
    renderProducts(main);
  }

  // 4a. The page's data: products (light columns), brands, manufacturers, A+ counts --------------------------
  function pimData(w) {
    return Promise.all([
      pageAll(function () { return sb().from('ecom_products').select(LIST_SEL).eq('workspace_id', w.id).order('id', { ascending: false }); }),
      q(sb().from('ecom_brands').select('id,name,alt_name,manufacturer_id').eq('workspace_id', w.id).order('name')),
      q(sb().from('ecom_manufacturers').select('id,name,alt_name').eq('workspace_id', w.id).order('name')),
      pageAll(function () { return sb().from('ecom_aplus').select('product_id').eq('workspace_id', w.id).order('id'); }),
      buyBoxData(amzMp())
    ]).then(function (res) {
      var ctx = { w: w, rows: res[0], brands: res[1], makers: res[2], ap: {}, made: { makers: [], brands: [] }, bb: res[4] };
      res[3].forEach(function (a) { ctx.ap[a.product_id] = (ctx.ap[a.product_id] || 0) + 1; });
      ctx.rows.forEach(function (r) { derive(ctx, r); });
      return ctx;
    });
  }
  // Buy Box per product (owner, 20 Nov 2026: "latest buybox % if available"): the featured-offer share of the newest
  // Business Report of the marketplace chosen on the page (30 days), by SKU, else by ASIN (the row with most sessions)
  function buyBoxData(mp) {
    var c = amzConn();
    if (!c || !mp) return Promise.resolve(null);
    return q(sb().from('ecom_amz_business_asin').select('sku,child_asin,buy_box_pct,sessions,period_start,period_end').eq('connection_id', c.id)
      .eq('marketplace_id', mp).order('period_end', { ascending: false }).limit(1000)).then(function (rows) {
      var out = { mp: mp, bySku: {}, byAsin: {}, start: rows.length ? rows[0].period_start : null, end: rows.length ? rows[0].period_end : null };
      rows.forEach(function (r) {
        if (r.period_end !== out.end || r.buy_box_pct == null) return;
        if (r.sku) out.bySku[r.sku] = r;
        var cur = out.byAsin[r.child_asin];
        if (!cur || (r.sessions || 0) > (cur.sessions || 0)) out.byAsin[r.child_asin] = r;
      });
      return out;
    }).catch(function () { return null; });
  }
  function buyBoxOf(bb, p) { var r = bb ? (p.sku && bb.bySku[p.sku]) || (p.asin && bb.byAsin[p.asin]) : null; return r ? Number(r.buy_box_pct) : null; }
  function buyBoxTip(bb) {
    return bb && bb.end ? 'Buy Box (featured offer) share on ' + mpLabel(bb.mp) + ', Business Report ' + A.fmtDay(bb.start) + ' – ' + A.fmtDay(bb.end)
                        : 'Buy Box: no Business Report for this marketplace yet (Settings → Sync)';
  }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function nameOf(list, id) { var x = id ? byId(list, id) : null; return x ? x.name : ''; }
  // A manufacturer or brand by name: name or alternative name, any capitals and spaces
  function findByName(list, name) {
    var n = norm(name);
    if (!n) return null;
    for (var i = 0; i < list.length; i++) if (norm(list[i].name) === n || (list[i].alt_name && norm(list[i].alt_name) === n)) return list[i];
    return null;
  }
  function derive(ctx, r) {
    r._brand = nameOf(ctx.brands, r.brand_id); r._maker = nameOf(ctx.makers, r.manufacturer_id);
    r._pics = (r.image_ids || []).length; r._aplus = ctx.ap[r.id] || 0; r._bbp = buyBoxOf(ctx.bb, r);
    r._all = norm([r.id, r.sku, r.asin, r.gtin, r.pzn, r.title, r._maker, r._brand, r.logistics, r.status].join(' '));
    return r;
  }
  function replaceRow(ctx, row) {
    for (var i = 0; i < ctx.rows.length; i++) if (ctx.rows[i].id === row.id) { ctx.rows[i] = derive(ctx, row); return ctx.rows[i]; }
    ctx.rows.unshift(derive(ctx, row));
    return row;
  }
  // A manufacturer's short name from its full (legal) name (owner, 19 Nov 2026: short names everywhere): the brand's
  // name when the full name starts with it (Orthomol pharmazeutische Vertriebs GmbH + brand Orthomol → Orthomol), else
  // the name without legal form, country and trade words (Apomedica Pharmazeutische Produkte GmbH, Deutschland →
  // Apomedica). It can be changed under Manufacturers.
  var LEGAL_W = 'gmbh gesmbh ag kgaa kg ohg se ug ek ltd limited plc inc llc corp corporation co sa sas sarl spa srl bv nv a/s ab oy'.split(' ');
  var TRADE_W = ('pharmazeutische pharmazeutischer pharmazeutika pharma pharmaceutical pharmaceuticals produkte products product vertrieb vertriebs ' +
    'vertriebsgesellschaft handelsgesellschaft deutschland germany europe international holding group gruppe company').split(' ');
  function shortMaker(full, brand) {
    var f = String(full || '').replace(/\s+/g, ' ').trim();
    if (brand && norm(f).indexOf(norm(brand)) === 0) return String(brand).trim();
    var words = f.split(',')[0].split(' ').filter(function (t) {
      var k = t.toLowerCase().replace(/[.()]/g, '');
      return k && LEGAL_W.indexOf(k) < 0 && TRADE_W.indexOf(k) < 0;
    });
    while (words.length && /^[&+\-–]$/.test(words[words.length - 1])) words.pop();
    var s = words.join(' ').trim() || f;
    return s.length > 40 ? s.split(' ')[0] : s;
  }
  // The manufacturer of that name: its short or full name, any capitals, or the short name the full name gives
  function findMaker(list, name, brand, full) {
    return findByName(list, name) || (full ? findByName(list, full) : null) || findByName(list, shortMaker(name, brand));
  }
  // The existing manufacturer / brand of that name, or a new one: a long legal name becomes the full name and gets a
  // short name; a new brand gets the named manufacturer, or one of its own name (a brand cannot exist without one)
  function ensureMaker(ctx, name, brand, full) {
    var given = String(name || '').replace(/\s+/g, ' ').trim(), hit = findMaker(ctx.makers, given, brand, full);
    if (hit) return Promise.resolve(hit);
    var short = full ? given : shortMaker(given, brand), long = full || (short !== given ? given : '');
    return q(sb().from('ecom_manufacturers').insert({ workspace_id: ctx.w.id, name: short.slice(0, 200), alt_name: long ? long.slice(0, 200) : null }).select('id,name,alt_name').single())
      .then(function (m) { ctx.makers.push(m); ctx.made.makers.push(m.name); return m; });
  }
  function ensureBrand(ctx, name, makerName, makerFull) {
    var hit = findByName(ctx.brands, name);
    if (hit) return Promise.resolve(hit);
    return ensureMaker(ctx, makerName || name, name, makerFull).then(function (m) {
      return q(sb().from('ecom_brands').insert({ workspace_id: ctx.w.id, manufacturer_id: m.id, name: String(name).trim().slice(0, 200) })
        .select('id,name,alt_name,manufacturer_id').single()).then(function (b) { ctx.brands.push(b); ctx.made.brands.push(b.name); return b; });
    });
  }
  // A new product row with every column named (a bulk insert needs the same columns in every row)
  function blankRow(ctx) {
    return { workspace_id: ctx.w.id, sku: null, asin: null, gtin: null, pzn: null, title: null, content: null, details: null, logistics: null,
             width_mm: null, length_mm: null, depth_mm: null, weight_g: null, bullets: [], brand_id: null, manufacturer_id: null, status: 'active' };
  }

  function renderProducts(main) {
    A.header(main, 'Products', 'Edit changes SKU, ASIN, EAN, brand, manufacturer and logistics right in the row; Open shows the whole product with its A+ content. ' +
      'Sync with Amazon fills a product from Amazon\'s catalog; you see what changes before it is saved.');
    var w = wsOr(main); if (!w) return;
    var conn = amzConn(), ctx = null;
    var line = h('p', { class: 'pim-progress', 'aria-live': 'polite' });
    var box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' }));
    var excelIn = h('input', { type: 'file', hidden: true, accept: '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv' });
    excelIn.addEventListener('change', function () { var f = excelIn.files[0]; excelIn.value = ''; if (f && ctx) excelImport(ctx, f, line, reload); });
    var noAmz = 'Connect an Amazon account first (Settings).';
    var mpBox = null;
    if (conn) {
      var mpSel = h('select', { class: 'ecm-input pim-mp', id: 'pim-mp' }, conn.marketplaces.map(function (m) { return h('option', { value: m.id, text: mpLabel(m.id) }); }));
      mpSel.value = amzMp();
      mpSel.addEventListener('change', function () { A.store('ecm_pim_mp', mpSel.value); reload(); });   // Buy Box of that marketplace
      mpBox = h('label', { class: 'pim-mpwrap', for: 'pim-mp', title: 'Sync with Amazon and the Amazon imports read the catalog of this marketplace (its language)' },
        [h('span', { text: 'Amazon' }), mpSel]);
    }
    main.append(h('div', { class: 'ecm-tools pim-bar' }, [
      h('a', { class: 'ecm-btn ecm-btn--primary ecm-btn--small', href: '#/pim-products/new', text: '+ New product' }),
      h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Create from Amazon listings', disabled: !conn,
        title: conn ? 'One product per SKU of the Amazon account ' + conn.label + ' (its All Listings report)' : noAmz,
        onclick: function () { if (ctx) listingsDialog(ctx, line, reload); } }),
      h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Upload Excel', title: 'Excel (.xlsx) or CSV: new SKUs are added, known SKUs updated',
        onclick: function () { if (busy) A.toast('An import is still running.', 'act'); else excelIn.click(); } }), excelIn,
      h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Excel template', title: 'The column names Upload Excel reads, with one example row',
        onclick: function () { excelTemplate().catch(function (e) { A.toast(e.message, 'act'); }); } }),
      h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', disabled: true, title: 'Coming soon' },
        ['Sync with Shopify', h('span', { class: 'pim-soon', text: 'Coming soon' })]),
      mpBox || h('span', { class: 'pim-hint', text: 'Sync with Amazon: ' + noAmz })]), line, box);
    function reload() {
      return pimData(w).then(function (c) { ctx = c; box.innerHTML = ''; box.appendChild(productList(ctx).el); }).catch(function (e) { errorBox(box, e); });
    }
    reload();
  }

  // The list: search with filters, sorting, 20 rows per page, quick edit in the row, Open, Sync with Amazon
  function productList(ctx) {
    var st = { chips: [], sort: null, dir: 1, edit: null, shown: [] };
    var thead = h('thead'), tbody = h('tbody');
    var table = h('table', { class: 'ecm-table pim-list' }, [h('caption', { class: 'visually-hidden', text: 'Products of ' + ctx.w.name }), thead, tbody]);
    var count = h('span', { class: 'ecm-tools__count', 'aria-live': 'polite' });
    var pager = A.pagerBar(draw);
    var fx = filterBox({ kinds: KINDS, hint: FX_HINT, label: 'Search or filter products', suggest: function (t) { return suggest(ctx, t); },
                         onChange: function (chips) { st.chips = chips; apply(); } });
    var csv = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Download for Excel (CSV)', title: 'The products shown, with every field; Upload Excel reads this file back' });
    csv.addEventListener('click', function () { exportCsv(ctx, st.shown, csv); });
    function cls(c) { return [c.num ? 'is-num' : '', c.wide ? 'is-wide' : '', c.mono ? 'ecm-mono' : ''].join(' ').trim(); }
    function cellText(c, r) { var v = r[c.k]; if (c.f) v = c.f(v); return v == null || v === '' ? '' : c.pct ? A.fmtNum(v, 1) + ' %' : c.num ? A.fmtInt(v) : String(v); }
    function head() {
      thead.innerHTML = '';
      var tr = h('tr', null, h('th', { scope: 'col', class: 'pim-act pim-act--l' }, h('span', { class: 'visually-hidden', text: 'Edit or open' })));
      L_COLS.forEach(function (c) {
        var on = st.sort === c.k;
        tr.appendChild(h('th', { scope: 'col', class: c.num ? 'is-num' : null, title: c.tip ? buyBoxTip(ctx.bb) : null, 'aria-sort': on ? (st.dir > 0 ? 'ascending' : 'descending') : 'none' },
          h('button', { type: 'button', class: 'ecm-sort', onclick: function () {
            if (st.sort !== c.k) { st.sort = c.k; st.dir = 1; } else if (st.dir > 0) st.dir = -1; else { st.sort = null; st.dir = 1; }
            apply();
          } }, [c.t, h('span', { class: 'ecm-sort__arrow', 'aria-hidden': 'true', text: on ? (st.dir > 0 ? '▲' : '▼') : '↕' })])));
      });
      tr.appendChild(h('th', { scope: 'col', class: 'pim-act' }, h('span', { class: 'visually-hidden', text: 'Sync with Amazon' })));
      thead.appendChild(tr);
    }
    function apply(keep) {
      st.shown = ctx.rows.filter(function (r) { return matches(r, st.chips); });
      if (st.sort) {
        var c = L_COLS.filter(function (x) { return x.k === st.sort; })[0];
        st.shown.sort(function (a, b) {
          var x = a[c.k], y = b[c.k];
          if (x == null || x === '') return 1; if (y == null || y === '') return -1;   // empty values last
          return (c.num ? Number(x) - Number(y) : String(x).localeCompare(String(y), 'en', { numeric: true })) * st.dir;
        });
      }
      head();
      pager.set(st.shown.length, keep ? pager.page() : 0);
      draw();
      count.textContent = 'Showing ' + A.fmtInt(st.shown.length) + ' of ' + A.fmtInt(ctx.rows.length) +
        (st.shown.length > A.PAGE_ROWS ? ' · ' + A.PAGE_ROWS + ' per page; the download has all' : '');
    }
    function draw() {
      tbody.innerHTML = '';
      var start = pager.page() * A.PAGE_ROWS, page = st.shown.slice(start, start + A.PAGE_ROWS);
      if (!page.length) {
        tbody.appendChild(h('tr', null, h('td', { colspan: String(L_COLS.length + 2), class: 'pim-empty', text: ctx.rows.length ? 'No product matches these filters.'
          : 'No products yet: add one, upload an Excel file or create them from your Amazon listings.' })));
        return;
      }
      page.forEach(function (r) { tbody.appendChild(st.edit === r.id ? editRow(r) : viewRow(r)); });
    }
    function leaveEdit(id) {
      st.edit = null; draw();
      var b = tbody.querySelector('[data-edit="' + id + '"]'); if (b) b.focus();
    }
    // the product name in one line; the whole name on hover (owner, 19 Nov 2026)
    function cell(c, r) {
      var t = cellText(c, r);
      return c.wide ? h('td', { class: cls(c) }, h('span', { class: 'pim-1line', title: t, text: t })) : h('td', { class: cls(c), text: t, title: c.tip ? buyBoxTip(ctx.bb) : null });
    }
    function viewRow(r) {
      var tr = h('tr', null, h('td', { class: 'pim-act pim-act--l' }, h('span', { class: 'pim-act__in' }, [
        h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small pim-iconbtn', 'data-edit': String(r.id), 'aria-label': 'Edit product ' + r.id + ' in this row',
          title: 'Click to edit product elements', onclick: function () { st.edit = r.id; draw(); var el = tbody.querySelector('tr.is-editing input'); if (el) el.focus(); } }, icon('pencil')),
        h('a', { class: 'ecm-btn ecm-btn--ghost ecm-btn--small pim-iconbtn', href: '#/pim-products/' + r.id, 'aria-label': 'Open product ' + r.id,
          title: 'Open the product details' }, icon('eye'))])));
      L_COLS.forEach(function (c) { tr.appendChild(cell(c, r)); });
      tr.appendChild(h('td', { class: 'pim-act' }, syncButton(r, null).el));
      return tr;
    }
    // "Sync with Amazon" of one row: from the saved ASIN / EAN, or from what is typed in the quick edit
    function syncButton(r, typed) {
      var b = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small pim-syncbtn', 'aria-label': 'Sync product ' + r.id + ' with Amazon' });
      function label(text) { b.replaceChildren(icon('amazon', 'pim-ico--amazon'), h('span', { text: text || 'Sync' })); }
      label();
      function has() { var t = typed ? typed() : r; return !!(t.asin || t.gtin); }
      function state() {
        b.disabled = !amzConn() || !has();
        b.title = !amzConn() ? 'Sync with Amazon: connect an Amazon account first (Settings).' : !has() ? 'Sync with Amazon: add an ASIN (or an EAN) first.'
          : 'Sync with Amazon: fills this product from Amazon\'s catalog on ' + mpLabel(amzMp()) + ', by its ASIN (or by its EAN when it has no ASIN). ' +
            'You see what Amazon has beside what the product has and tick what to take; nothing changes before you save.' +
            (r.amazon_synced_at ? ' Last time: ' + A.ago(r.amazon_synced_at) + '.' : '');
      }
      state();
      b.addEventListener('click', function () {
        var t = typed ? typed() : null;
        if (t && t.error) { A.toast(t.error, 'act'); return; }
        if (t) delete t.error;
        b.disabled = true; label('Asking…');
        syncOne(ctx, r, t, function (row) {
          replaceRow(ctx, row); st.edit = null; apply(true);
          A.toast('Product #' + row.id + ' filled from Amazon ' + A.mpCode(row.amazon_marketplace) + ' and saved.');
        }).catch(function (e) { A.toast(e.message, 'act'); })
          .then(function () { if (b.isConnected) { label(); state(); } });
      });
      return { el: b, state: state };
    }
    // Quick edit: SKU, ASIN, GTIN / EAN, manufacturer, brand, logistics in the row (Enter saves, Esc cancels)
    function editRow(r) {
      var tr = h('tr', { class: 'is-editing' });
      function inp(v, max, label, extra) {
        var el = h('input', Object.assign({ class: 'ecm-input', type: 'text', maxlength: String(max), autocomplete: 'off', 'aria-label': label + ' of product ' + r.id }, extra || {}));
        el.value = v == null ? '' : String(v);
        return el;
      }
      function sel(opts, v, label) {
        var el = h('select', { class: 'ecm-input', 'aria-label': label + ' of product ' + r.id }, opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
        el.value = v == null ? '' : String(v);
        return el;
      }
      var c = {
        sku: inp(r.sku, 100, 'SKU'), asin: inp(r.asin, 10, 'ASIN', { class: 'ecm-input ecm-mono' }), gtin: inp(r.gtin, 14, 'GTIN / EAN', { inputmode: 'numeric', class: 'ecm-input ecm-mono' }),
        maker: sel([['', '— none —']].concat(ctx.makers.map(function (m) { return [String(m.id), m.name]; })), r.manufacturer_id, 'Manufacturer'),
        brand: sel([['', '— none —']].concat(ctx.brands.map(function (b) { return [String(b.id), b.name]; })), r.brand_id, 'Brand'),
        logistics: sel(LOGI, r.logistics || '', 'Logistics')
      };
      // a brand brings its manufacturer; without a brand the manufacturer is chosen on its own (0048)
      function brandLink() {
        var b = c.brand.value ? byId(ctx.brands, parseInt(c.brand.value, 10)) : null;
        if (b) c.maker.value = String(b.manufacturer_id);
        c.maker.disabled = !!b;
        c.maker.title = b ? 'Comes with the brand ' + b.name : '';
      }
      c.brand.addEventListener('change', brandLink); brandLink();
      function typed() {
        var v = { sku: c.sku.value.trim() || null, asin: c.asin.value.trim().toUpperCase().replace(/\s+/g, '') || null, gtin: c.gtin.value.replace(/\s+/g, '') || null,
                  brand_id: c.brand.value ? parseInt(c.brand.value, 10) : null, manufacturer_id: c.maker.value ? parseInt(c.maker.value, 10) : null,
                  logistics: c.logistics.value || null };
        if (v.asin && !/^[A-Z0-9]{10}$/.test(v.asin)) v.error = 'ASIN: 10 letters or digits.';
        else if (v.gtin && !/^[0-9]{8,14}$/.test(v.gtin)) v.error = 'GTIN / EAN: 8 to 14 digits.';
        return v;
      }
      var save = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: 'Save' });
      var cancel = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Cancel' });
      var sy = syncButton(r, typed);
      c.asin.addEventListener('input', sy.state); c.gtin.addEventListener('input', sy.state);
      function doSave() {
        var v = typed();
        if (v.error) { A.toast(v.error, 'act'); return; }
        delete v.error;
        save.disabled = true;
        q(sb().from('ecom_products').update(v).eq('id', r.id).select(LIST_SEL).single()).then(function (row) {
          replaceRow(ctx, row); A.toast('Saved product #' + row.id + '.'); st.edit = null; apply(true);
          var b = tbody.querySelector('[data-edit="' + row.id + '"]'); if (b) b.focus();
        }).catch(function (e) { save.disabled = false; A.toast(e.message, 'act'); });
      }
      save.addEventListener('click', doSave);
      cancel.addEventListener('click', function () { leaveEdit(r.id); });
      tr.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); doSave(); }
        else if (e.key === 'Escape') { e.preventDefault(); leaveEdit(r.id); }
      });
      tr.appendChild(h('td', { class: 'pim-act pim-act--l' }, h('span', { class: 'pim-act__in' }, [save, cancel])));
      L_COLS.forEach(function (col) { tr.appendChild(col.ed ? h('td', { class: (cls(col) + ' is-edit').trim() }, c[col.ed]) : cell(col, r)); });
      tr.appendChild(h('td', { class: 'pim-act' }, sy.el));
      return tr;
    }
    apply();
    return { el: h('div', null, [h('div', { class: 'ecm-tools pim-tools' }, [fx.el, csv, count]), h('div', { class: 'ecm-tablewrap' }, table), pager.el]) };
  }

  // 4b. Search with filters: one long field; typing (or a click into it) offers manufacturers, brands, logistics,
  // SKUs, ASINs and product names; each choice becomes a chip, several at once. Chips of one kind = any of them,
  // of different kinds = all of them; "Search everywhere" looks in every column. ----------------------------------
  var KINDS = { maker: 'Manufacturer', brand: 'Brand', logistics: 'Logistics', sku: 'SKU', asin: 'ASIN', name: 'Product name', text: 'Contains' };
  var FX_HINT = 'Search or filter: manufacturer, brand, logistics, SKU, ASIN, product name';
  function matches(r, chips) {
    var by = {};
    chips.forEach(function (c) { (by[c.kind] = by[c.kind] || []).push(c); });
    return Object.keys(by).every(function (kind) {
      var list = by[kind];
      if (kind === 'text') return list.every(function (c) { return r._all.indexOf(norm(c.value)) >= 0; });
      return list.some(function (c) {
        if (kind === 'maker') return r.manufacturer_id === c.value;
        if (kind === 'brand') return r.brand_id === c.value;
        if (kind === 'logistics') return (r.logistics || '') === c.value;
        if (kind === 'sku') return r.sku === c.value;
        if (kind === 'asin') return r.asin === c.value;
        return r.title === c.value;   // name
      });
    });
  }
  function suggest(ctx, text) {
    var t = norm(text), out = [];
    function hit(s) { return !t || norm(s).indexOf(t) >= 0; }
    function take(kind, list, max) { list.slice(0, max).forEach(function (x) { out.push({ kind: kind, value: x.value, label: x.label }); }); }
    function uniq(key) {
      var seen = {}, list = [];
      ctx.rows.forEach(function (r) { var v = r[key]; if (v && !seen[v] && hit(v)) { seen[v] = 1; list.push({ value: v, label: v.length > 80 ? v.slice(0, 79) + '…' : v }); } });
      return list;
    }
    if (t) out.push({ kind: 'text', value: String(text).trim(), label: 'Search everywhere for "' + String(text).trim() + '"' });
    take('maker', ctx.makers.filter(function (m) { return hit(m.name) || (m.alt_name && hit(m.alt_name)); }).map(function (m) { return { value: m.id, label: m.name }; }), t ? 5 : 8);
    take('brand', ctx.brands.filter(function (b) { return hit(b.name) || (b.alt_name && hit(b.alt_name)); }).map(function (b) { return { value: b.id, label: b.name }; }), t ? 5 : 8);
    take('logistics', [{ value: 'FBA', label: 'FBA' }, { value: 'FBM', label: 'FBM' }, { value: '', label: 'none' }].filter(function (x) { return hit(x.label); }), 3);
    if (t) { take('sku', uniq('sku'), 5); take('asin', uniq('asin'), 5); take('name', uniq('title'), 5); }
    return out;
  }
  // cfg: kinds (labels), hint (grey text), label, suggest(text) → [{kind, value, label}], onChange(chips)
  function filterBox(cfg) {
    var chips = [], opts = [], active = -1, listId = 'pim-fx-' + (++seq);
    var input = h('input', { class: 'pim-fx__input', type: 'text', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': listId, 'aria-autocomplete': 'list',
      autocomplete: 'off', placeholder: cfg.hint, 'aria-label': cfg.label });
    var chipBox = h('span', { class: 'pim-fx__chips' });
    var list = h('ul', { class: 'pim-fx__list', id: listId, role: 'listbox', 'aria-label': 'Filters', hidden: true });
    var clear = h('button', { type: 'button', class: 'pim-fx__clear', 'aria-label': 'Remove all filters', text: '✕', hidden: true });
    var box = h('div', { class: 'pim-fx' }, [chipBox, input, clear, list]);
    function keyOf(c) { return c.kind + ':' + c.value; }
    function changed() { paintChips(); cfg.onChange(chips.slice()); }
    function paintChips() {
      chipBox.innerHTML = '';
      chips.forEach(function (c, i) {
        chipBox.appendChild(h('span', { class: 'pim-fx__chip' }, [h('span', { text: cfg.kinds[c.kind] + ': ' + c.label }),
          h('button', { type: 'button', text: '×', 'aria-label': 'Remove filter ' + cfg.kinds[c.kind] + ' ' + c.label,
            onclick: function () { chips.splice(i, 1); changed(); input.focus(); } })]));
      });
      clear.hidden = !chips.length;
      input.placeholder = chips.length ? 'Add another filter…' : cfg.hint;
    }
    function add(o) {
      var c = { kind: o.kind, value: o.value, label: o.kind === 'text' ? o.value : o.label };
      if (!chips.some(function (x) { return keyOf(x) === keyOf(c); })) chips.push(c);
      input.value = ''; close(); changed();
    }
    function open() {
      opts = cfg.suggest(input.value); active = -1; list.innerHTML = '';
      var last = null;
      opts.forEach(function (o, i) {
        if (o.kind !== last && o.kind !== 'text') list.appendChild(h('li', { class: 'pim-fx__group', role: 'presentation', text: cfg.kinds[o.kind] }));
        last = o.kind;
        list.appendChild(h('li', { id: listId + '-' + i, role: 'option', class: 'pim-fx__opt', 'aria-selected': 'false', text: o.label,
          onmousedown: function (e) { e.preventDefault(); add(o); } }));
      });
      list.hidden = !opts.length;
      input.setAttribute('aria-expanded', String(!!opts.length));
      input.removeAttribute('aria-activedescendant');
    }
    function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; }
    function move(d) {
      if (list.hidden || !opts.length) return;
      active = (active + d + opts.length) % opts.length;
      Array.prototype.forEach.call(list.querySelectorAll('[role=option]'), function (el, i) {
        el.setAttribute('aria-selected', String(i === active)); el.classList.toggle('is-active', i === active);
        if (i === active) el.scrollIntoView({ block: 'nearest' });
      });
      input.setAttribute('aria-activedescendant', listId + '-' + active);
    }
    input.addEventListener('input', open);
    input.addEventListener('focus', open);
    input.addEventListener('blur', function () { setTimeout(close, 150); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0) add(opts[active]); else if (input.value.trim()) add({ kind: 'text', value: input.value.trim() }); }
      else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); close(); }
      else if (e.key === 'Backspace' && !input.value && chips.length) { chips.pop(); changed(); }
    });
    clear.addEventListener('click', function () { chips = []; changed(); input.focus(); });
    box.addEventListener('mousedown', function (e) { if (e.target === box || e.target === chipBox) { e.preventDefault(); input.focus(); } });
    return { el: box };
  }

  // 4c. Sync with Amazon: Amazon's catalog content (server function ecom-amazon, action catalog_lookup; read-only) is
  // shown beside the product; the ticked rows are saved. The marketplace (= language) is chosen on the page. ------
  function amzConn() { var c = A.conn(); return c && (c.marketplaces || []).length ? c : null; }
  function amzMp() {
    var c = amzConn(); if (!c) return null;
    var ids = c.marketplaces.map(function (m) { return m.id; }), saved = A.load('ecm_pim_mp');
    return ids.indexOf(saved) >= 0 ? saved : ids.indexOf('A1PA6795UKMFR9') >= 0 ? 'A1PA6795UKMFR9' : ids[0];
  }
  function mpLabel(id) { var host = A.amzHost ? A.amzHost(id) : ''; return A.mpCode(id) + (host ? ' · ' + host : ''); }
  function codeType(v) { return /^[0-9]{12}$/.test(v) ? 'UPC' : /^[0-9]{14}$/.test(v) ? 'GTIN' : 'EAN'; }
  function lookup(ids, type) {
    var c = amzConn();
    if (!c) return Promise.reject(new Error('Connect an Amazon account first (Settings).'));
    return A.invoke('ecom-amazon', { action: 'catalog_lookup', connection_id: c.id, marketplace_id: amzMp(), ids: ids, id_type: type || 'ASIN' });
  }
  function dimsText(a) { return a.some(function (x) { return x != null; }) ? a.map(function (x) { return x == null ? '?' : A.fmtNum(x, 1); }).join(' × ') + ' mm' : ''; }
  // The rows of the comparison. on = ticked at first: empty fields and changed texts; brand, manufacturer, EAN, size,
  // weight and pictures only when the product has none yet (they are often kept on purpose)
  function amazonPlan(ctx, p, it, extra) {
    var rows = [];
    function add(key, label, now, next, on, view) { rows.push({ key: key, label: label, now: now, next: next, on: on, view: view }); }
    var bl = (it.bullets || []).slice(0, BULLETS), pics = p.image_ids || [];
    if (it.asin && it.asin !== p.asin) add('asin', 'ASIN', p.asin, it.asin, true);
    if (it.name && it.name !== p.title) add('title', 'Product name', p.title, it.name, true);
    if (it.description && it.description !== p.content) add('content', 'Content (description)', p.content, it.description, true);
    if (bl.length && JSON.stringify(bl) !== JSON.stringify(p.bullets || [])) add('bullets', 'Bullets', p.bullets || [], bl, true);
    if (it.gtin && it.gtin !== p.gtin) add('gtin', 'GTIN / EAN', p.gtin, it.gtin, !p.gtin);
    // brand and manufacturer by name; a new manufacturer gets a short name (its full name is kept too)
    var mkName = it.manufacturer || it.brand, mkShort = mkName ? shortMaker(mkName, it.brand) : '', mkFull = mkShort !== mkName ? '; full name ' + mkName : '';
    if (it.brand) {
      var b = findByName(ctx.brands, it.brand), bm = findMaker(ctx.makers, mkName, it.brand);
      if (!b || b.id !== p.brand_id) add('brand', 'Brand', nameOf(ctx.brands, p.brand_id), b ? b.name + ' (' + nameOf(ctx.makers, b.manufacturer_id) + ')'
        : it.brand + ' (new; manufacturer ' + (bm ? bm.name : mkShort + ', new' + mkFull) + ')', !p.brand_id);
    }
    if (it.manufacturer) {
      var m = findMaker(ctx.makers, it.manufacturer, it.brand);
      if (!m || m.id !== p.manufacturer_id) add('maker', 'Manufacturer', nameOf(ctx.makers, p.manufacturer_id), m ? m.name : mkShort + ' (new' + mkFull + ')', !p.manufacturer_id && !p.brand_id);
    }
    var dNow = [p.width_mm, p.length_mm, p.depth_mm], dNew = [it.width_mm, it.length_mm, it.depth_mm];
    if (dimsText(dNew) && dimsText(dNew) !== dimsText(dNow)) add('size', 'Size (width × length × depth)', dimsText(dNow),
      dimsText(dNew) + (it.size_from === 'package' ? ' — package size (Amazon has no product size)' : ''), !dimsText(dNow));
    if (it.weight_g != null && Number(it.weight_g) !== Number(p.weight_g)) add('weight', 'Weight', p.weight_g == null ? '' : A.fmtNum(p.weight_g, 1) + ' g',
      A.fmtNum(it.weight_g, 1) + ' g' + (it.weight_from === 'package' ? ' — with the package' : ''), p.weight_g == null);
    if ((it.images || []).length) add('images', 'Pictures (up to 5)', pics.length ? pics.length + (pics.length === 1 ? ' picture' : ' pictures') : '', null, !pics.length, function () {
      return h('div', { class: 'pim-amz__pics' }, it.images.slice(0, 5).map(function (i) { return h('img', { src: amzSized(i.url, 120), alt: i.slot + ' picture on Amazon', loading: 'lazy' }); })
        .concat(it.images.length > 5 ? [h('span', { class: 'pim-hint', text: '+' + (it.images.length - 5) + ' more on Amazon; the first 5 are kept' })] : []));
    });
    if (extra.parent && extra.parent.id !== p.parent_id) add('parent', 'Parent product', p.parent_id ? '#' + p.parent_id : '',
      '#' + extra.parent.id + ' ' + (extra.parent.title || extra.parent.sku || '') + ' (ASIN ' + it.parent_asin + ')', !p.parent_id);
    if (extra.logistics && extra.logistics !== p.logistics) add('logistics', 'Logistics (from your Amazon listing)', p.logistics, extra.logistics, !p.logistics);
    return rows;
  }
  // Parent (a PIM product with Amazon's parent ASIN) and logistics (FBA / FBM of the SKU's Amazon listing)
  function amazonExtra(ctx, p, it) {
    var out = {};
    if (it.parent_asin) out.parent = ctx.rows.filter(function (r) { return r.asin === it.parent_asin && r.id !== p.id; })[0] || null;
    var c = amzConn();
    if (!p.sku || !c) return Promise.resolve(out);
    return q(sb().from('ecom_amz_listings').select('marketplace_id,fulfillment_channel').eq('connection_id', c.id).eq('seller_sku', p.sku).limit(20)).then(function (ls) {
      var mp = amzMp(), l = ls.filter(function (x) { return x.marketplace_id === mp; })[0] || ls[0];
      if (l && l.fulfillment_channel) out.logistics = /^AMAZON/i.test(l.fulfillment_channel) ? 'FBA' : 'FBM';
      return out;
    }).catch(function () { return out; });
  }
  function amazonDialog(ctx, p, it, extra, okText, onApply) {
    var plan = amazonPlan(ctx, p, it, extra), boxes = {};
    var head = h('p', { class: 'pim-hint', text: 'Amazon ' + mpLabel(amzMp()) + ' · ASIN ' + it.asin + (it.category ? ' · ' + it.category : '') +
      (it.matches > 1 ? ' · ' + it.matches + ' Amazon products carry this code; the first is shown' : '') });
    if (!plan.length) {
      dialog('Sync with Amazon', [head, h('p', { class: 'ecm-note', text: 'This product already has everything Amazon shows for it.' })], []);
      return;
    }
    function view(v) {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) return h('span', { class: 'pim-hint', text: 'empty' });
      if (Array.isArray(v)) return h('ol', { class: 'pim-amz__list' }, v.map(function (x) { return h('li', { text: String(x) }); }));
      return h('span', { class: 'pim-amz__text', text: String(v) });
    }
    var rowsEl = h('div', { class: 'pim-amz' }, plan.map(function (r) {
      var id = 'pim-amz-' + r.key + '-' + (++seq), cb = boxes[r.key] = h('input', { type: 'checkbox', id: id });
      cb.checked = r.on;
      return h('div', { class: 'pim-amz__row' }, [h('div', { class: 'pim-amz__pick' }, [cb, h('label', { for: id, text: r.label })]),
        h('div', null, [h('span', { class: 'pim-amz__tag', text: 'Now' }), view(r.now)]),
        h('div', null, [h('span', { class: 'pim-amz__tag', text: 'Amazon' }), r.view ? r.view() : view(r.next)])]);
    }));
    // a brand brings its manufacturer: with the brand ticked, the manufacturer row is not needed
    if (boxes.brand && boxes.maker) {
      var link = function () { boxes.maker.disabled = boxes.brand.checked; if (boxes.brand.checked) boxes.maker.checked = false; };
      boxes.brand.addEventListener('change', link); link();
    }
    var err = h('p', { class: 'ecm-error', role: 'alert' });
    var all = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Tick all' });
    var ok = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: okText });
    var d = dialog('Sync with Amazon — product' + (p.id ? ' #' + p.id : ''), [head, h('p', { class: 'pim-hint', text: 'Ticked rows are taken from Amazon; the others stay as they are.' }), rowsEl, err], [all, ok], true);
    all.addEventListener('click', function () { Object.keys(boxes).forEach(function (k) { if (k !== 'maker' || !boxes.brand) boxes[k].checked = true; }); if (boxes.brand && boxes.maker) { boxes.maker.checked = false; boxes.maker.disabled = true; } });
    ok.addEventListener('click', function () {
      var chosen = {};
      Object.keys(boxes).forEach(function (k) { if (boxes[k].checked && !boxes[k].disabled) chosen[k] = true; });
      if (!Object.keys(chosen).length) { err.textContent = 'Tick at least one row.'; return; }
      ok.disabled = true; err.textContent = ''; ok.textContent = 'Saving…';
      Promise.resolve(onApply(chosen)).then(function () { d.close(); }, function (e) { err.textContent = e.message; ok.disabled = false; ok.textContent = okText; });
    });
  }
  // Amazon's pictures as library rows (links; 0048): the ones already there are reused; ids in Amazon's order
  function ensureAmazonImages(ctx, asin, imgs, again) {
    var list = (imgs || []).filter(function (i) { return i && AMZ_IMG.test(i.url || ''); }).slice(0, 5);
    if (!list.length) return Promise.resolve([]);
    var urls = list.map(function (i) { return i.url; });
    return q(sb().from('ecom_images').select('id,url').eq('workspace_id', ctx.w.id).in('url', urls)).then(function (have) {
      var by = {};
      have.forEach(function (r) { by[r.url] = r.id; });
      var add = list.filter(function (i) { return !by[i.url]; }).map(function (i) {
        var ext = String(i.url.split('.').pop()).toLowerCase();
        return { workspace_id: ctx.w.id, url: i.url, source: 'amazon', title: (asin + ' ' + (i.slot || '')).trim(), tags: ['amazon', String(asin).toLowerCase()],
                 width: i.width || null, height: i.height || null, mime: ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : null };
      });
      if (!add.length) return urls.map(function (u) { return by[u]; });
      return q(sb().from('ecom_images').insert(add).select('id,url')).then(function (made) {
        made.forEach(function (r) { by[r.url] = r.id; });
        return urls.map(function (u) { return by[u]; }).filter(Boolean);
      });
    }).catch(function (e) {
      if (!again && /exists already/.test(e.message)) return ensureAmazonImages(ctx, asin, imgs, true);   // added at the same moment by another product
      throw e;
    });
  }
  // The values to save for the ticked rows (new manufacturer, brand and picture rows are made here)
  function amazonPatch(ctx, p, it, chosen, extra) {
    var v = {};
    if (chosen.asin) v.asin = it.asin;
    if (chosen.title) v.title = it.name.slice(0, 500);
    if (chosen.content) v.content = it.description.slice(0, 10000);
    if (chosen.bullets) v.bullets = it.bullets.slice(0, BULLETS).map(function (b) { return b.slice(0, 1000); });
    if (chosen.gtin) v.gtin = it.gtin;
    if (chosen.size) { v.width_mm = it.width_mm; v.length_mm = it.length_mm; v.depth_mm = it.depth_mm; }
    if (chosen.weight) v.weight_g = it.weight_g;
    if (chosen.parent && extra.parent) v.parent_id = extra.parent.id;
    if (chosen.logistics && extra.logistics) v.logistics = extra.logistics;
    v.amazon_marketplace = amzMp(); v.amazon_synced_at = new Date().toISOString();
    var chain = Promise.resolve();
    if (chosen.brand) chain = chain.then(function () { return ensureBrand(ctx, it.brand, it.manufacturer).then(function (b) { v.brand_id = b.id; v.manufacturer_id = b.manufacturer_id; }); });
    else if (chosen.maker) chain = chain.then(function () { return ensureMaker(ctx, it.manufacturer, it.brand).then(function (m) { v.manufacturer_id = m.id; }); });
    if (chosen.images) chain = chain.then(function () { return ensureAmazonImages(ctx, it.asin, it.images).then(function (ids) { if (ids.length) v.image_ids = ids; }); });
    return chain.then(function () { return v; });
  }
  // One product from the list: ask Amazon, show the comparison, save the ticked rows (with the quick edit's values)
  function syncOne(ctx, p, typed, onSaved) {
    var base = Object.assign({}, p, typed || {}), code = base.asin || base.gtin;
    return lookup([code], base.asin ? 'ASIN' : codeType(base.gtin)).then(function (res) {
      var it = res.items && res.items[0];
      if (!it || !it.found) { A.toast('Amazon ' + mpLabel(amzMp()) + ' has no product with ' + (base.asin ? 'ASIN ' : 'EAN ') + code + '.', 'act'); return; }
      return amazonExtra(ctx, base, it).then(function (extra) {
        amazonDialog(ctx, base, it, extra, 'Save to the product', function (chosen) {
          return amazonPatch(ctx, base, it, chosen, extra).then(function (v) {
            return q(sb().from('ecom_products').update(Object.assign({}, typed || {}, v)).eq('id', p.id).select(LIST_SEL).single());
          }).then(onSaved);
        });
      });
    });
  }
  // After an import: Amazon's catalog for every new product with an ASIN (else its EAN), 20 per call, empty fields
  // only; manufacturers and brands Amazon names are made once, one after the other
  function fillMany(ctx, prods, line) {
    var withAsin = prods.filter(function (p) { return p.asin; }), withCode = prods.filter(function (p) { return !p.asin && p.gtin; }), batches = [];
    for (var i = 0; i < withAsin.length; i += 20) batches.push({ type: 'ASIN', list: withAsin.slice(i, i + 20) });
    ['EAN', 'UPC', 'GTIN'].forEach(function (t) {
      var l = withCode.filter(function (p) { return codeType(p.gtin) === t; });
      for (var j = 0; j < l.length; j += 20) batches.push({ type: t, list: l.slice(j, j + 20) });
    });
    var st = { total: withAsin.length + withCode.length, done: 0, filled: 0, missing: 0, failed: 0, error: '' };
    function show() { line.textContent = 'Filling from Amazon ' + mpLabel(amzMp()) + '… ' + A.fmtInt(st.done) + ' of ' + A.fmtInt(st.total) + ' products'; }
    show();
    return batches.reduce(function (chain, bt, bi) {
      return chain.then(function () { return bi ? wait(600) : null; }).then(function () {   // Amazon allows about 2 catalog calls a second
        return lookup(bt.list.map(function (p) { return bt.type === 'ASIN' ? p.asin : p.gtin; }), bt.type).then(function (res) {
          var found = {};
          (res.items || []).forEach(function (it) { if (it.found) found[it.id] = it; });
          var work = bt.list.map(function (p) { return { p: p, it: found[bt.type === 'ASIN' ? p.asin : p.gtin] }; }).filter(function (x) { return x.it; });
          st.missing += bt.list.length - work.length; st.done += bt.list.length - work.length;
          return work.reduce(function (c2, x) {
            return c2.then(function () {
              x.extra = { parent: x.it.parent_asin ? ctx.rows.filter(function (r) { return r.asin === x.it.parent_asin && r.id !== x.p.id; })[0] || null : null };
              x.chosen = {};
              amazonPlan(ctx, x.p, x.it, x.extra).forEach(function (r) { if (r.now == null || r.now === '' || (Array.isArray(r.now) && !r.now.length)) x.chosen[r.key] = true; });
              if (x.chosen.brand) { delete x.chosen.maker; return ensureBrand(ctx, x.it.brand, x.it.manufacturer); }
              if (x.chosen.maker) return ensureMaker(ctx, x.it.manufacturer, x.it.brand);
            }).catch(function () { x.chosen = {}; });
          }, Promise.resolve()).then(function () {
            return pool(work, 4, function (x) {
              return (Object.keys(x.chosen).length ? amazonPatch(ctx, x.p, x.it, x.chosen, x.extra).then(function (v) {
                return q(sb().from('ecom_products').update(v).eq('id', x.p.id).select(LIST_SEL).single());
              }).then(function (row) { replaceRow(ctx, row); st.filled++; }) : Promise.resolve())
                .catch(function () { st.failed++; }).then(function () { st.done++; show(); });
            });
          });
        }, function (e) { st.failed += bt.list.length; st.done += bt.list.length; st.error = e.message; show(); });
      });
    }, Promise.resolve()).then(function () { return st; });
  }

  // 4d. Products from the Amazon listings (the All Listings report of the account chosen at the top; test mode keeps
  // up to 100 SKUs per marketplace): one product per SKU with SKU, ASIN, name, EAN and logistics -----------------
  function plural(n, one, many) { return A.fmtInt(n) + ' ' + (n === 1 ? one : many); }
  function madeText(ctx) {
    var m = ctx.made.makers.length, b = ctx.made.brands.length;
    return m || b ? ' New: ' + [m ? plural(m, 'manufacturer', 'manufacturers') : '', b ? plural(b, 'brand', 'brands') : ''].filter(Boolean).join(', ') + '.' : '';
  }
  function fromListings(ls, mp) {
    var order = [mp, amzMp(), 'A1PA6795UKMFR9', 'A1F83G8C2ARO7P'].filter(Boolean), by = {};
    function rank(m) { var i = order.indexOf(m); return i < 0 ? 99 : i; }
    ls.filter(function (l) { return !mp || l.marketplace_id === mp; }).sort(function (a, b) { return rank(a.marketplace_id) - rank(b.marketplace_id); }).forEach(function (l) {
      var sku = String(l.seller_sku || '').trim();
      if (!sku || sku.length > 100) return;
      var p = by[sku] || (by[sku] = { sku: sku });
      if (!p.asin && /^[A-Z0-9]{10}$/.test(l.asin || '')) p.asin = l.asin;
      if (!p.title && l.item_name) p.title = String(l.item_name).trim().slice(0, 500);
      var code = String(l.product_id || '').trim();
      if (!p.gtin && (l.product_id_type === '4' || l.product_id_type === '3') && /^[0-9]{8,14}$/.test(code)) p.gtin = code;
      if (!p.logistics && l.fulfillment_channel) p.logistics = /^AMAZON/i.test(l.fulfillment_channel) ? 'FBA' : 'FBM';
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }
  function listingsDialog(ctx, line, done) {
    var c = amzConn();
    if (!c) return;
    if (busy) { A.toast('An import is still running.', 'act'); return; }
    var body = h('div', { class: 'pim-import' }, h('p', { class: 'ecm-note', text: 'Reading the listings of ' + c.label + '…' }));
    var go2 = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: 'Create products', disabled: true });
    var d = dialog('Create products from your Amazon listings', body, [go2], true);
    pageAll(function () {
      return sb().from('ecom_amz_listings').select('marketplace_id,seller_sku,asin,item_name,fulfillment_channel,product_id,product_id_type')
        .eq('connection_id', c.id).eq('is_active', true).order('seller_sku');
    }).then(function (ls) {
      body.innerHTML = '';
      if (!ls.length) { body.appendChild(h('p', { class: 'ecm-note', text: 'No listings stored for ' + c.label + ' yet: run Sync in Settings first (it reads Amazon\'s All Listings report).' })); return; }
      var have = {}, perMp = {}, all = {};
      ctx.rows.forEach(function (p) { if (p.sku) have[p.sku] = 1; });
      ls.forEach(function (l) { (perMp[l.marketplace_id] = perMp[l.marketplace_id] || {})[l.seller_sku] = 1; all[l.seller_sku] = 1; });
      var mpSel = h('select', { class: 'ecm-input', id: 'pim-ls-mp' }, [h('option', { value: '', text: 'All marketplaces (' + A.fmtInt(Object.keys(all).length) + ' SKUs)' })].concat(
        Object.keys(perMp).sort(function (a, b) { return A.mpCode(a).localeCompare(A.mpCode(b)); }).map(function (m) {
          return h('option', { value: m, text: mpLabel(m) + ' (' + A.fmtInt(Object.keys(perMp[m]).length) + ' SKUs)' }); })));
      var fill = h('input', { type: 'checkbox', id: 'pim-ls-fill' });
      fill.checked = true;
      var info = h('p', { class: 'pim-hint' });
      var items = [];
      function plan() {
        var list = fromListings(ls, mpSel.value);
        items = list.filter(function (p) { return !have[p.sku]; });
        info.textContent = A.fmtInt(list.length) + ' SKUs: ' + A.fmtInt(items.length) + ' new' + (list.length > items.length ? ', ' + A.fmtInt(list.length - items.length) + ' already in PIM (left as they are)' : '') +
          '. Each new product gets SKU, ASIN, product name, EAN and logistics (FBA / FBM) from the listing' + (mpSel.value ? '' : '; the name in the language of ' + A.mpCode(amzMp()) + ' when the SKU is there') + '.';
        go2.disabled = !items.length;
        go2.textContent = items.length ? 'Create ' + A.fmtInt(items.length) + ' products' : 'Nothing new';
      }
      mpSel.addEventListener('change', plan);
      body.append(h('div', { class: 'pim-form' }, [fieldRow({ t: 'Listings of' }, mpSel)]), info,
        h('p', { class: 'pim-check' }, [fill, h('label', { for: 'pim-ls-fill', text: ' Then fill them from Amazon ' + mpLabel(amzMp()) + ': brand, manufacturer, bullets, description, size, weight and 5 pictures (empty fields only; about a minute per 300 products)' })]),
        h('p', { class: 'pim-hint', text: 'Test mode: the listings hold up to 100 SKUs per marketplace; all of them once test mode ends.' }));
      plan();
      go2.addEventListener('click', function () {
        if (busy) return;
        busy = true; d.close(); ctx.made = { makers: [], brands: [] };
        var rows = items.map(function (p) { return Object.assign(blankRow(ctx), p); }), made = [], parts = [];
        for (var i = 0; i < rows.length; i += 100) parts.push(rows.slice(i, i + 100));
        parts.reduce(function (chain, part) {
          return chain.then(function () {
            line.textContent = 'Creating products… ' + A.fmtInt(made.length) + ' of ' + A.fmtInt(rows.length);
            return q(sb().from('ecom_products').insert(part).select(LIST_SEL)).then(function (r) { made = made.concat(r); r.forEach(function (x) { replaceRow(ctx, x); }); });
          });
        }, Promise.resolve()).then(function () {
          return fill.checked && made.length ? fillMany(ctx, made, line) : null;
        }).then(function (st) {
          var msg = 'Created ' + A.fmtInt(made.length) + ' products from the Amazon listings.' + (st ? ' Filled from Amazon ' + A.mpCode(amzMp()) + ': ' + A.fmtInt(st.filled) +
            (st.missing ? ' · not found there: ' + A.fmtInt(st.missing) : '') + (st.failed ? ' · failed: ' + A.fmtInt(st.failed) + (st.error ? ' (' + st.error + ')' : '') : '') + '.' : '') +
            madeText(ctx);
          busy = false; line.textContent = msg; A.toast(msg); done();
        }).catch(function (e) { busy = false; line.textContent = 'Stopped after ' + A.fmtInt(made.length) + ' products: ' + e.message; A.toast(e.message, 'act'); done(); });
      });
    }).catch(function (e) { errorBox(body, e); });
  }

  // 4e. Excel: upload (new SKUs are created, known IDs / SKUs updated; empty cells keep what is there), template,
  // download. Excel files are read with SheetJS (the Ads tool's pinned copy, loaded on first use only); CSV without.
  var XLSX_SRC = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  var XLSX_SRI = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';
  var xlsxP = null;
  function loadXlsx() {
    if (window.XLSX && window.XLSX.read) return Promise.resolve(window.XLSX);
    if (xlsxP) return xlsxP;
    xlsxP = new Promise(function (ok, bad) {
      var s = document.createElement('script');
      s.src = XLSX_SRC; s.integrity = XLSX_SRI; s.crossOrigin = 'anonymous';
      s.onload = function () { if (window.XLSX && window.XLSX.read) ok(window.XLSX); else failed(); };
      s.onerror = failed;
      function failed() { xlsxP = null; s.remove(); bad(new Error('The Excel reader could not be loaded. Check the connection, or save the file as CSV.')); }
      document.head.appendChild(s);
    });
    return xlsxP;
  }
  var X_HEAD = ['ID', 'Parent SKU', 'SKU', 'ASIN', 'GTIN / EAN', 'PZN', 'Product name', 'Content', 'Details', 'Manufacturer', 'Manufacturer full name', 'Brand', 'Logistics',
    'Width (mm)', 'Length (mm)', 'Depth (mm)', 'Weight (g)', 'Bullet 1', 'Bullet 2', 'Bullet 3', 'Bullet 4', 'Bullet 5', 'Status'];
  // Column names (any capitals; words in brackets, * : _ - ignored), English, German and Amazon's report names
  function hk(v) { return String(v == null ? '' : v).toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/[*:_-]/g, ' ').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim(); }
  var X_ALIAS = {
    id: ['id', 'product id', 'pim id'], parent: ['parent sku', 'parent', 'parent id'],
    sku: ['sku', 'seller sku', 'merchant sku', 'item sku', 'artikelnummer', 'article number'], asin: ['asin', 'asin1'],
    gtin: ['gtin/ean', 'gtin', 'ean', 'ean/gtin', 'gtin ean', 'ean code', 'barcode', 'upc'], pzn: ['pzn'],
    title: ['product name', 'name', 'title', 'item name', 'product title', 'produktname', 'artikelname', 'bezeichnung'],
    content: ['content', 'description', 'product description', 'beschreibung'], details: ['details'],
    maker: ['manufacturer', 'manufacturer short name', 'hersteller', 'maker'], brand: ['brand', 'marke'],
    makerFull: ['manufacturer full name', 'manufacturer legal name', 'full manufacturer name', 'hersteller vollständiger name', 'hersteller firmenname'],
    logistics: ['logistics', 'fulfillment', 'fulfilment', 'fulfillment channel', 'fba/fbm', 'versand'],
    width_mm: ['width', 'width mm', 'breite'], length_mm: ['length', 'length mm', 'länge', 'laenge'],
    depth_mm: ['depth', 'depth mm', 'height', 'height mm', 'höhe', 'hoehe', 'tiefe'], weight_g: ['weight', 'weight g', 'weight in grams', 'gewicht'],
    status: ['status']
  };
  for (var bi = 1; bi <= BULLETS; bi++) X_ALIAS['b' + bi] = ['bullet ' + bi, 'bullet point ' + bi, 'bullet' + bi, 'bulletpoint ' + bi];
  var ROLE_OF = {};
  Object.keys(X_ALIAS).forEach(function (role) { X_ALIAS[role].forEach(function (a) { ROLE_OF[hk(a)] = role; }); });
  var X_LABEL = { width_mm: 'Width', length_mm: 'Length', depth_mm: 'Depth', weight_g: 'Weight' };

  function parseCsv(text) {
    text = String(text).replace(/^﻿/, '');
    var first = text.split(/\r?\n/, 1)[0] || '', count = function (ch) { return first.split(ch).length; };
    var delim = count(';') > count(',') && count(';') >= count('\t') ? ';' : count('\t') > count(',') ? '\t' : ',';
    var rows = [], row = [], cell = '', quoted = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch; }
      else if (ch === '"') quoted = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function readSheet(file) {
    var name = String(file.name || '');
    if (file.size > 10485760) return Promise.reject(new Error('The file is larger than 10 MB.'));
    if (/\.csv$/i.test(name) || /csv/.test(file.type || '')) return file.text().then(function (t) { return { rows: parseCsv(t), sheet: 'CSV' }; });
    if (!/\.(xlsx|xlsm|xls|ods)$/i.test(name)) return Promise.reject(new Error('Choose an Excel file (.xlsx) or a CSV file.'));
    return Promise.all([loadXlsx(), file.arrayBuffer()]).then(function (res) {
      var X = res[0], wb = X.read(new Uint8Array(res[1]), { type: 'array' });
      for (var i = 0; i < wb.SheetNames.length; i++) {   // the first sheet with data
        var rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[i]], { header: 1, raw: true, defval: '', blankrows: false });
        if (rows.length) return { rows: rows, sheet: wb.SheetNames[i] };
      }
      return { rows: [], sheet: wb.SheetNames[0] || '' };
    });
  }
  // The header row: the first of the first 10 rows that names at least 2 known columns
  function mapHeader(rows) {
    for (var i = 0; i < Math.min(10, rows.length); i++) {
      var map = {}, used = [], other = [];
      (rows[i] || []).forEach(function (cell, ci) {
        var t = String(cell == null ? '' : cell).trim(), role = ROLE_OF[hk(t)];
        if (!t) return;
        if (role && map[role] == null) { map[role] = ci; used.push(t); } else other.push(t);
      });
      if (Object.keys(map).length >= 2) return { row: i, map: map, used: used, other: other };
    }
    return null;
  }
  function cellStr(v) { return v == null ? '' : String(v).trim(); }
  function numIn(v) {
    if (v === '' || v == null) return null;
    if (typeof v === 'number') return v;
    var n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : NaN;
  }
  function codeIn(v, pad) {
    if (v === '' || v == null) return null;
    var s = typeof v === 'number' ? String(Math.round(v)) : String(v).replace(/[\s-]/g, '');
    if (pad && /^[0-9]+$/.test(s) && s.length < pad) s = ('00000000000000' + s).slice(-pad);   // Excel drops leading zeros of numbers
    return s;
  }
  function readRecords(rows, hd) {
    var out = [], seen = {};
    for (var i = hd.row + 1; i < rows.length; i++) {
      var row = rows[i] || [];
      if (row.every(function (x) { return x === '' || x == null; })) continue;
      var get = function (role) { var ci = hd.map[role]; return ci == null ? '' : row[ci]; };
      var e = [], r = { line: i + 1 };
      var id = numIn(get('id'));
      r.id = id != null && !isNaN(id) && id > 0 && Math.round(id) === id ? id : null;
      r.sku = cellStr(get('sku')) || null;
      if (r.sku && r.sku.length > 100) e.push('SKU longer than 100 characters');
      r.asin = cellStr(get('asin')).toUpperCase().replace(/\s+/g, '') || null;
      if (r.asin && !/^[A-Z0-9]{10}$/.test(r.asin)) e.push('ASIN must be 10 letters or digits');
      var g = get('gtin');
      if (/e\+/i.test(String(g))) e.push('GTIN / EAN ' + g + ' was shortened by Excel: format that column as text');
      else { r.gtin = codeIn(g); if (r.gtin && !/^[0-9]{8,14}$/.test(r.gtin)) e.push('GTIN / EAN must be 8 to 14 digits'); }
      var pz = get('pzn');
      r.pzn = codeIn(pz, typeof pz === 'number' ? 8 : 0);
      if (r.pzn && !/^[0-9]{7,8}$/.test(r.pzn)) e.push('PZN must be 7 or 8 digits');
      var TL = { title: 'Product name', maker: 'Manufacturer', makerFull: 'Manufacturer full name', content: 'Content', details: 'Details', brand: 'Brand' };
      [['title', 500], ['content', 10000], ['details', 10000], ['maker', 200], ['makerFull', 200], ['brand', 200]].forEach(function (x) {
        r[x[0]] = cellStr(get(x[0])) || null;
        if (r[x[0]] && r[x[0]].length > x[1]) e.push(TL[x[0]] + ' longer than ' + x[1] + ' characters');
      });
      var lg = cellStr(get('logistics')).toUpperCase();
      r.logistics = !lg ? null : /^(FBA|AMAZON)/.test(lg) ? 'FBA' : /^(FBM|DEFAULT|MERCHANT|MFN)/.test(lg) ? 'FBM' : (e.push('Logistics must be FBA or FBM'), null);
      ['width_mm', 'length_mm', 'depth_mm', 'weight_g'].forEach(function (k) {
        var n = numIn(get(k));
        if (n != null && (isNaN(n) || n < 0)) { e.push(X_LABEL[k] + ' must be a number'); n = null; }
        r[k] = n == null ? null : Math.round(n * 10) / 10;
      });
      var sv = norm(get('status'));
      r.status = !sv ? null : /^(active|aktiv)$/.test(sv) ? 'active' : /^(inactive|inaktiv)$/.test(sv) ? 'inactive' : (e.push('Status must be active or inactive'), null);
      var bl = [];
      for (var b = 1; b <= BULLETS; b++) { var t = cellStr(get('b' + b)); if (t) bl.push(t.slice(0, 1000)); }
      r.bullets = bl.length ? bl : null;
      r.parent = cellStr(get('parent')) || null;
      if (!r.id && !r.sku && !r.asin && !r.title) e.push('no ID, SKU, ASIN or product name');
      if (r.sku) { if (seen[r.sku]) e.push('SKU ' + r.sku + ' is also in row ' + seen[r.sku]); else seen[r.sku] = r.line; }
      r.errors = e;
      out.push(r);
    }
    return out;
  }
  // Which row updates which product (by ID, else SKU, else a unique ASIN); which manufacturers and brands are new
  function importPlan(ctx, recs) {
    var bySku = {}, byAsin = {}, plan = { create: [], update: [], skip: [], makers: {}, brands: {} };
    ctx.rows.forEach(function (p) { if (p.sku) bySku[p.sku] = p; if (p.asin) (byAsin[p.asin] = byAsin[p.asin] || []).push(p); });
    recs.forEach(function (r) {
      if (r.errors.length) { plan.skip.push(r); return; }
      r.target = (r.id && byId(ctx.rows, r.id)) || (r.sku && bySku[r.sku]) || (!r.sku && r.asin && byAsin[r.asin] && byAsin[r.asin].length === 1 ? byAsin[r.asin][0] : null);
      var mk = r.maker || r.makerFull;
      if (r.brand && !findByName(ctx.brands, r.brand)) {
        plan.brands[norm(r.brand)] = { name: r.brand, maker: mk || r.brand, full: r.makerFull };
        if (!findMaker(ctx.makers, mk || r.brand, r.brand, r.makerFull)) plan.makers[norm(mk || r.brand)] = { name: mk || r.brand, brand: r.brand, full: r.makerFull };
      } else if (mk && !findMaker(ctx.makers, mk, r.brand, r.makerFull)) plan.makers[norm(mk)] = { name: mk, brand: r.brand, full: r.makerFull };
      (r.target ? plan.update : plan.create).push(r);
    });
    return plan;
  }
  // The filled cells of one row as product values (a brand brings its manufacturer)
  function recValues(ctx, r) {
    var v = {};
    ['sku', 'asin', 'gtin', 'pzn', 'title', 'content', 'details', 'logistics', 'width_mm', 'length_mm', 'depth_mm', 'weight_g', 'status'].forEach(function (k) { if (r[k] != null) v[k] = r[k]; });
    if (r.bullets) v.bullets = r.bullets;
    var mk = r.maker || r.makerFull, b = r.brand ? findByName(ctx.brands, r.brand) : null, m = mk ? findMaker(ctx.makers, mk, r.brand, r.makerFull) : null;
    if (b) { v.brand_id = b.id; v.manufacturer_id = b.manufacturer_id; } else if (m) v.manufacturer_id = m.id;
    return v;
  }
  function runImport(ctx, plan, line) {
    var res = { created: 0, updated: 0, failed: [] }, chain = Promise.resolve();
    Object.keys(plan.makers).forEach(function (k) { var m = plan.makers[k]; chain = chain.then(function () { return ensureMaker(ctx, m.name, m.brand, m.full); }); });
    Object.keys(plan.brands).forEach(function (k) { var b = plan.brands[k]; chain = chain.then(function () { return ensureBrand(ctx, b.name, b.maker, b.full); }); });
    // new products, 100 per request; if one row is refused, that part again one by one to find it
    chain = chain.then(function () {
      var parts = [];
      for (var i = 0; i < plan.create.length; i += 100) parts.push(plan.create.slice(i, i + 100));
      return parts.reduce(function (c, recs) {
        return c.then(function () {
          line.textContent = 'Creating products… ' + A.fmtInt(res.created) + ' of ' + A.fmtInt(plan.create.length);
          var rows = recs.map(function (r) { return Object.assign(blankRow(ctx), recValues(ctx, r)); });
          return q(sb().from('ecom_products').insert(rows).select(LIST_SEL)).then(function (made) {
            var bySku = {};
            made.forEach(function (m) { replaceRow(ctx, m); if (m.sku) bySku[m.sku] = m; });
            recs.forEach(function (r, i) { r.target = (r.sku && bySku[r.sku]) || made[i]; });
            res.created += made.length;
          }, function () {
            return pool(recs, 4, function (r, i) {
              return q(sb().from('ecom_products').insert(rows[i]).select(LIST_SEL).single()).then(function (m) { replaceRow(ctx, m); r.target = m; res.created++; },
                function (e) { res.failed.push('Row ' + r.line + ': ' + e.message); });
            });
          });
        });
      }, Promise.resolve());
    });
    // known products: only the filled cells
    chain = chain.then(function () {
      var n = 0;
      return pool(plan.update, 4, function (r) {
        var v = recValues(ctx, r);
        return (Object.keys(v).length ? q(sb().from('ecom_products').update(v).eq('id', r.target.id).select(LIST_SEL).single()).then(function (row) { replaceRow(ctx, row); res.updated++; },
          function (e) { res.failed.push('Row ' + r.line + ': ' + e.message); }) : Promise.resolve())
          .then(function () { n++; line.textContent = 'Updating products… ' + A.fmtInt(n) + ' of ' + A.fmtInt(plan.update.length); });
      });
    });
    // parents last (by SKU, or by ID), when every product exists
    chain = chain.then(function () {
      return pool(plan.create.concat(plan.update).filter(function (r) { return r.parent && r.target; }), 4, function (r) {
        var par = (/^[0-9]+$/.test(r.parent) ? byId(ctx.rows, parseInt(r.parent, 10)) : null) || ctx.rows.filter(function (p) { return p.sku === r.parent; })[0];
        if (!par || par.id === r.target.id) { res.failed.push('Row ' + r.line + ': parent ' + r.parent + ' not found'); return; }
        return q(sb().from('ecom_products').update({ parent_id: par.id }).eq('id', r.target.id).select(LIST_SEL).single()).then(function (row) { replaceRow(ctx, row); },
          function (e) { res.failed.push('Row ' + r.line + ': ' + e.message); });
      });
    });
    return chain.then(function () { return res; });
  }
  function excelImport(ctx, file, line, done) {
    if (busy) { A.toast('An import is still running.', 'act'); return; }
    line.textContent = 'Reading ' + file.name + '…';
    readSheet(file).then(function (sh) {
      line.textContent = '';
      var hd = mapHeader(sh.rows);
      if (!hd) throw new Error('No column names found in ' + file.name + ': the first row should name the columns (SKU, ASIN, Product name …). The Excel template shows them.');
      var recs = readRecords(sh.rows, hd), plan = importPlan(ctx, recs);
      var makers = Object.keys(plan.makers).map(function (k) { var m = plan.makers[k]; return m.full ? m.name : shortMaker(m.name, m.brand); }),
          brands = Object.keys(plan.brands).map(function (k) { return plan.brands[k].name; });
      var few = function (list) { return list.slice(0, 6).join(', ') + (list.length > 6 ? ' …' : ''); };
      var n = plan.create.length + plan.update.length;
      var go2 = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: n ? 'Import ' + A.fmtInt(n) + ' products' : 'Nothing to import', disabled: !n });
      var d = dialog('Upload Excel — check before saving', h('div', { class: 'pim-import' }, [
        h('p', { class: 'pim-hint', text: file.name + (sh.sheet && sh.sheet !== 'CSV' ? ' · sheet "' + sh.sheet + '"' : '') + ' · ' + A.fmtInt(recs.length) + ' rows · column names in row ' + (hd.row + 1) }),
        h('ul', null, [
          h('li', { text: 'New products: ' + A.fmtInt(plan.create.length) }),
          h('li', { text: 'Products updated (same ID or SKU): ' + A.fmtInt(plan.update.length) + ' — empty cells keep what is there; filled bullet cells replace the product\'s bullets' }),
          makers.length ? h('li', { text: 'New manufacturers: ' + makers.length + ' (' + few(makers) + ')' }) : null,
          brands.length ? h('li', { text: 'New brands: ' + brands.length + ' (' + few(brands) + ')' }) : null,
          plan.skip.length ? h('li', { class: 'is-bad', text: 'Rows left out: ' + A.fmtInt(plan.skip.length) }) : null]),
        plan.skip.length ? h('ul', { class: 'pim-import__bad' }, plan.skip.slice(0, 20).map(function (r) { return h('li', { text: 'Row ' + r.line + ': ' + r.errors.join('; ') }); })
          .concat(plan.skip.length > 20 ? [h('li', { text: '… and ' + (plan.skip.length - 20) + ' more' })] : [])) : null,
        h('p', { class: 'pim-hint', text: 'Columns read: ' + hd.used.join(', ') + (hd.other.length ? ' · not read: ' + hd.other.slice(0, 12).join(', ') : '') })]), [go2], true);
      go2.addEventListener('click', function () {
        if (busy) return;
        busy = true; d.close(); ctx.made = { makers: [], brands: [] };
        runImport(ctx, plan, line).then(function (res) {
          var msg = 'Excel upload: ' + A.fmtInt(res.created) + ' created, ' + A.fmtInt(res.updated) + ' updated' +
            (res.failed.length ? ', ' + res.failed.length + ' refused (' + res.failed.slice(0, 3).join('; ') + (res.failed.length > 3 ? ' …' : '') + ')' : '') + '.' + madeText(ctx);
          busy = false; line.textContent = msg; A.toast(msg, res.failed.length ? 'act' : null); done();
        }).catch(function (e) { busy = false; line.textContent = 'The upload stopped: ' + e.message; A.toast(e.message, 'act'); done(); });
      });
    }).catch(function (e) { line.textContent = ''; A.toast(e.message, 'act'); });
  }
  function excelTemplate() {
    return loadXlsx().then(function (X) {
      var ex = ['', '', 'SKU-1001', 'B0EXAMPLE1', '4012345678901', '', 'Example product name', 'Description; several lines are fine', '', 'Example Pharma',
        'Example Pharma Vertriebs GmbH', 'Example Brand', 'FBA', 68, 133, 68, 340, 'First bullet', 'Second bullet', '', '', '', 'active'];
      var ws = X.utils.aoa_to_sheet([X_HEAD, ex]);
      ws['!cols'] = X_HEAD.map(function (t) { return { wch: Math.max(10, t.length + 2) }; });
      var wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, ws, 'Products');
      X.writeFile(wb, 'pim-products-template.xlsx', { compression: true });
    });
  }
  // Download: the products shown (filters and order kept) with every field, in the columns Upload Excel reads
  function exportCsv(ctx, shown, btn) {
    btn.disabled = true;
    pageAll(function () { return sb().from('ecom_products').select('*').eq('workspace_id', ctx.w.id).order('id', { ascending: false }); }).then(function (all) {
      var by = {};
      all.forEach(function (p) { by[p.id] = p; });
      A.csvDownload('pim-products-' + new Date().toISOString().slice(0, 10) + '.csv', X_HEAD, shown.map(function (r) { return by[r.id]; }).filter(Boolean).map(function (p) {
        var par = p.parent_id ? byId(ctx.rows, p.parent_id) : null, b = p.bullets || [];
        var mk = p.manufacturer_id ? byId(ctx.makers, p.manufacturer_id) : null;
        return [p.id, par ? par.sku || '' : '', p.sku, p.asin, p.gtin, p.pzn, p.title, p.content, p.details, mk ? mk.name : '', mk ? mk.alt_name || '' : '', nameOf(ctx.brands, p.brand_id),
          p.logistics, p.width_mm, p.length_mm, p.depth_mm, p.weight_g, b[0], b[1], b[2], b[3], b[4], p.status];
      }));
    }).catch(function (e) { A.toast(e.message, 'act'); }).then(function () { btn.disabled = false; });
  }

  // 4f. Keywords per product (owner, 20 Nov 2026: "keywords … per page … the rate to existing product content - and
  // bullets"). Amazon's search terms of the product (Brand Analytics → Search Query Performance, data set
  // search_queries, table ecom_amz_search_queries) against the product's own text: are all words of a term in the
  // name, the bullets, the description? A term counts by the square root of its weekly searches, so one very big term
  // does not decide alone. Words match also in longer forms and inside compound words (kapsel → kapseln, nacken →
  // nackenwärmer). The rating follows the form while you type. ----------------------------------------------------
  var KW_STOP = ('für fur mit und oder der die das den dem des ein eine einer eines einem im in am an auf aus bei zu zum zur von vom ohne ' +
    'pour avec et le la les de du des un une per con e il lo gli di da para y el los las del for with and or the a an of on to by from without').split(' ');
  function kwTokens(s) { return norm(s).replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(function (t) { return t && KW_STOP.indexOf(t) < 0; }); }
  function kwHas(words, t) {
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w === t) return true;
      if (t.length >= 4 && w.indexOf(t) === 0) return true;                                        // kapsel → kapseln
      if (w.length >= 4 && t.indexOf(w) === 0 && t.length - w.length <= 2) return true;            // kapseln → kapsel
      if (t.length >= 5 && w.indexOf(t) > 0) return true;                                          // nacken → wärmenacken
    }
    return false;
  }
  function kwCover(term, words) { var ts = kwTokens(term); return ts.length ? ts.filter(function (t) { return kwHas(words, t); }).length / ts.length : 0; }
  // a term naming another brand or manufacturer of the PIM (not the product's own): Amazon does not allow other brands'
  // names in a listing, so it is neither suggested nor counted
  function kwOther(term, others) {
    var t = ' ' + kwTokens(term).join(' ') + ' ';
    return (others || []).some(function (b) { return b && t.indexOf(' ' + b + ' ') >= 0; });
  }
  function kwRate(rows, text, others) {
    var W = { title: kwTokens(text.title), content: kwTokens(text.content), bullets: (text.bullets || []).map(kwTokens) };
    W.bulletsAll = [].concat.apply([], W.bullets);
    W.all = W.title.concat(W.bulletsAll, W.content);
    var tot = 0, sum = { score: 0, title: 0, bullets: 0, content: 0 }, perBullet = W.bullets.map(function () { return { w: 0, terms: [] }; });
    var terms = rows.map(function (r) {
      var w = Math.sqrt(Math.max(1, r.query_volume || 0));
      if (kwOther(r.search_query, others)) return { r: r, w: w, other: true, title: false, bullets: false, content: false, part: 0 };
      var inT = kwCover(r.search_query, W.title) === 1, inB = kwCover(r.search_query, W.bulletsAll) === 1, inC = kwCover(r.search_query, W.content) === 1;
      var part = kwCover(r.search_query, W.all);
      tot += w;
      sum.score += w * (inT ? 1 : inB ? 0.8 : inC ? 0.5 : part * 0.3);
      if (inT) sum.title += w; if (inB) sum.bullets += w; if (inC) sum.content += w;
      W.bullets.forEach(function (bw, i) { if (bw.length && kwCover(r.search_query, bw) === 1) { perBullet[i].w += w; perBullet[i].terms.push(r.search_query); } });
      return { r: r, w: w, title: inT, bullets: inB, content: inC, part: part };
    });
    function pc(x) { return tot ? Math.round(100 * x / tot) : 0; }
    return { terms: terms, score: pc(sum.score), title: pc(sum.title), bullets: pc(sum.bullets), content: pc(sum.content),
             perBullet: perBullet.map(function (b, i) { return { n: i + 1, empty: !W.bullets[i].length, score: pc(b.w), terms: b.terms }; }),
             missing: terms.filter(function (t) { return !t.other && !t.title && !t.bullets; }).sort(function (a, b) { return b.w - a.w; }).slice(0, 8) };
  }
  // The keyword sync of one marketplace from the product page (the same jobs as Settings → Sync), followed to the end
  function keywordSync(c, mp, line) {
    return A.invoke('ecom-amazon', { action: 'sync', connection_id: c.id, datasets: ['search_queries'], marketplaces: [mp] }).then(function (r) {
      if (r.already_running && !(r.jobs || []).some(function (j) { return j.dataset === 'search_queries'; }))
        throw new Error('Another sync is running (Settings → Sync); try again when it has finished.');
      var t0 = Date.now();
      return (function step() {
        return wait(5000).then(function () { return A.invoke('ecom-amazon', { action: 'step', connection_id: c.id }); }).then(function (s) {
          var jobs = s.jobs || [], open = jobs.filter(function (j) { return /queued|running|waiting/.test(j.status); });
          if (!open.length) return jobs.filter(function (j) { return j.dataset === 'search_queries'; });
          line.textContent = 'Amazon is preparing the search terms of ' + mpLabel(mp) + '… ' + Math.round((Date.now() - t0) / 1000) + ' s (usually 1 to 3 minutes)';
          if (Date.now() - t0 > 10 * 60000) throw new Error('Amazon has not finished after 10 minutes; Settings → Sync shows how far it is.');
          return step();
        });
      })();
    });
  }
  function keywordPanel(p, getText, others) {
    var c = amzConn(), mp = amzMp(), rows = [], period = null, busyKw = false;
    var body = h('div'), line = h('p', { class: 'pim-hint', 'aria-live': 'polite' });
    var el = h('fieldset', { class: 'pim-section pim-kw' }, [h('legend', { text: 'Keywords' }), body, line]);
    var mark = function (on, part) { return on ? h('span', { class: 'pim-kw__yes', title: 'all words', text: '✓' }) : part >= 0.5 ? h('span', { class: 'pim-kw__part', title: 'some words', text: '◐' }) : h('span', { class: 'pim-kw__no', title: 'missing', text: '–' }); };
    function getNewest() {
      if (busyKw || !c) return;
      busyKw = true; paint();
      keywordSync(c, mp, line).then(function (jobs) {
        var bad = jobs.filter(function (j) { return j.status === 'error'; })[0];
        line.textContent = bad ? 'Amazon: ' + bad.message : jobs.length ? (jobs[0].message || '') : '';
        return load();
      }).catch(function (e) { line.textContent = e.message; }).then(function () { busyKw = false; paint(); });
    }
    function load() {
      if (!c || !p.asin) { paint(); return Promise.resolve(); }
      return q(sb().from('ecom_amz_search_queries').select('search_query,query_score,query_volume,click_share,purchase_share,impression_share,period_start,period_end')
        .eq('connection_id', c.id).eq('marketplace_id', mp).eq('asin', p.asin).order('period_end', { ascending: false }).order('query_score', { ascending: true }).limit(200))
        .then(function (r) {
          period = r.length ? { start: r[0].period_start, end: r[0].period_end } : null;
          rows = r.filter(function (x) { return period && x.period_end === period.end; });
          paint();
        }).catch(function (e) { rows = []; period = null; body.replaceChildren(h('p', { class: 'pim-hint', text: /0049|not there|schema cache|does not exist/i.test(e.message) ? 'The keywords need supabase/0049-ecom-search-queries.sql (Supabase → SQL Editor).' : e.message })); });
    }
    function paint() {
      body.innerHTML = '';
      var newest = c ? h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: busyKw ? 'Asking Amazon…' : 'Get the newest from Amazon', disabled: busyKw,
        title: 'Brand Analytics → Search Query Performance of ' + mpLabel(mp) + ' for the PIM products (the last full week)', onclick: getNewest }) : null;
      if (!p.asin) { body.appendChild(h('p', { class: 'pim-hint', text: 'Add an ASIN to see what customers search for this product.' })); return; }
      if (!c) { body.appendChild(h('p', { class: 'pim-hint', text: 'Connect an Amazon account (Settings) to see the search terms.' })); return; }
      if (!rows.length) {
        body.append(h('p', { class: 'pim-hint', text: 'No search terms yet for ASIN ' + p.asin + ' on ' + mpLabel(mp) + '. Amazon gives them for products of brands in your Brand Registry.' }), h('div', { class: 'ecm-row' }, newest));
        return;
      }
      var R = kwRate(rows, getText(), others);
      body.append(
        h('div', { class: 'pim-kw__head' }, [h('span', { class: 'pim-hint', text: mpLabel(mp) + ' · week ' + A.fmtDay(period.start) + ' – ' + A.fmtDay(period.end) + ' · the ' + rows.length +
          ' most important search terms (test mode)' }), newest]),
        h('div', { class: 'pim-kw__score' }, [
          h('span', { class: 'pim-kw__big pim-kw__big--' + (R.score >= 70 ? 'ok' : R.score >= 40 ? 'mid' : 'low'), text: String(R.score) }),
          h('div', null, [h('strong', { text: 'Keyword score' }), h('span', { class: 'pim-hint', text: ' of 100 · name ' + R.title + ' % · bullets ' + R.bullets + ' % · description ' + R.content + ' %' }),
            h('p', { class: 'pim-hint', text: 'How much of what customers search (by searches) the text below covers; it changes while you edit.' })])]),
        R.missing.length ? h('div', { class: 'pim-kw__missing' }, [h('span', { class: 'pim-label', text: 'Worth adding to the name or bullets — only what describes this product, no other brands:' }),
          h('div', { class: 'pim-tags' }, R.missing.map(function (t) { return h('span', { class: 'pim-fx__chip pim-kw__chip', title: A.fmtInt(t.r.query_volume) + ' searches in the week' },
            h('span', { text: t.r.search_query + ' · ' + A.fmtInt(t.r.query_volume) })); }))]) : h('p', { class: 'pim-hint', text: 'Every search term is in the name or the bullets.' }),
        h('div', { class: 'pim-kw__bullets' }, R.perBullet.map(function (b) {
          return h('div', { class: 'pim-kw__bullet' }, [h('span', { class: 'pim-kw__bn', text: 'Bullet ' + b.n }),
            h('span', { class: 'pim-kw__bar', role: 'img', 'aria-label': b.score + ' %' }, h('span', { style: 'width:' + b.score + '%' })),
            h('span', { class: 'pim-kw__bs', text: b.empty ? 'empty' : b.score + ' %' }),
            h('span', { class: 'pim-hint pim-kw__bt', text: b.terms.slice(0, 5).join(' · ') + (b.terms.length > 5 ? ' …' : '') })]);
        })),
        h('details', { class: 'pim-kw__all' }, [h('summary', { text: 'All ' + rows.length + ' search terms' }),
          h('div', { class: 'ecm-tablewrap' }, h('table', { class: 'ecm-table' }, [
            h('thead', null, h('tr', null, [['#', 1], ['Search term', 0], ['Searches', 1], ['Your clicks', 1], ['Your purchases', 1], ['Name', 0], ['Bullets', 0], ['Description', 0]].map(function (x) {
              return h('th', { scope: 'col', class: x[1] ? 'is-num' : null, text: x[0] }); }))),
            h('tbody', null, R.terms.map(function (t) {
              var pc = function (v) { return v == null ? '' : A.fmtNum(v, 1) + ' %'; };
              return h('tr', { class: t.other ? 'is-other' : null }, [h('td', { class: 'is-num', text: String(t.r.query_score || '') }),
                h('td', { class: 'is-wide', text: t.r.search_query + (t.other ? ' (other brand: not counted)' : '') }),
                h('td', { class: 'is-num', text: A.fmtInt(t.r.query_volume) }), h('td', { class: 'is-num', text: pc(t.r.click_share) }), h('td', { class: 'is-num', text: pc(t.r.purchase_share) }),
                h('td', null, mark(t.title, 0)), h('td', null, mark(t.bullets, 0)), h('td', null, mark(t.content, t.part))]);
            }))]))]));
    }
    var timer = null;
    load();
    return { el: el, refresh: function () { clearTimeout(timer); timer = setTimeout(function () { if (rows.length) paint(); }, 250); } };
  }

  /* 5. Product editor ------------------------------------------------------ */
  var PF = {
    sku: { k: 'sku', t: 'SKU', max: 100 },
    asin: { k: 'asin', t: 'ASIN', max: 10, upper: true, re: /^[A-Z0-9]{10}$/, reMsg: '10 letters or digits' },
    gtin: { k: 'gtin', t: 'GTIN / EAN', max: 14, re: /^[0-9]{8,14}$/, reMsg: '8 to 14 digits' },
    pzn: { k: 'pzn', t: 'PZN', max: 8, re: /^[0-9]{7,8}$/, reMsg: '7 or 8 digits' },
    title: { k: 'title', t: 'Product name', max: 500, wide: true },
    content: { k: 'content', t: 'Content (description)', area: true, rows: 5, max: 10000, wide: true },
    details: { k: 'details', t: 'Details', area: true, rows: 3, max: 10000, wide: true },
    width_mm: { k: 'width_mm', t: 'Width (mm)', type: 'number', step: '0.1' },
    length_mm: { k: 'length_mm', t: 'Length (mm)', type: 'number', step: '0.1' },
    depth_mm: { k: 'depth_mm', t: 'Depth (mm)', type: 'number', step: '0.1' },
    weight_g: { k: 'weight_g', t: 'Weight (g)', type: 'number', step: '0.1' },
    logistics: { k: 'logistics', t: 'Logistics', opts: [['', '—'], ['FBA', 'FBA'], ['FBM', 'FBM']] },
    status: F_STATUS
  };

  function renderProduct(main, id) {
    var w = wsOr(main); if (!w) return;
    main.appendChild(h('a', { class: 'pim-back', href: '#/pim-products', text: '← Products' }));
    A.header(main, id ? 'Product #' + id : 'New product');
    var box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' }));
    main.appendChild(box);
    Promise.all([
      id ? q(sb().from('ecom_products').select('*').eq('id', id).maybeSingle()) : Promise.resolve(null),
      q(sb().from('ecom_brands').select('id,name,alt_name,manufacturer_id').eq('workspace_id', w.id).order('name')),
      q(sb().from('ecom_manufacturers').select('id,name,alt_name').eq('workspace_id', w.id).order('name')),
      pageAll(function () { return sb().from('ecom_products').select('id,sku,title,asin').eq('workspace_id', w.id).order('id', { ascending: false }); }),
      id ? q(sb().from('ecom_aplus').select('id,version,name,locale,status,modules,updated_at').eq('product_id', id).order('version', { ascending: false })) : Promise.resolve([]),
      buyBoxData(amzMp())
    ]).then(function (res) {
      var p = res[0], others = res[3].filter(function (x) { return x.id !== id; }), versions = res[4];
      if (id && !p) { box.innerHTML = ''; box.appendChild(h('p', { class: 'ecm-error', text: 'This product does not exist (any more).' })); return; }
      // the same shape as the list's data, for Sync with Amazon (new manufacturers / brands land in these lists)
      var ectx = { w: w, rows: others, brands: res[1], makers: res[2], ap: {}, made: { makers: [], brands: [] } };
      p = p || { status: 'active', bullets: [], image_ids: [] };
      box.innerHTML = '';
      var ctrls = {}, err = h('p', { class: 'ecm-error', role: 'alert' });
      function sect(title, keys) {
        return h('fieldset', { class: 'pim-section' }, [h('legend', { text: title })].concat([h('div', { class: 'pim-form' }, keys.map(function (k) {
          var el = ctrls[k] = control(PF[k], p[k]); return fieldRow(PF[k], el); }))]));
      }
      // identity: parent, brand + the plain fields
      var parent = h('select', { class: 'ecm-input', id: 'pim-parent' }, [h('option', { value: '', text: '— none —' })].concat(others.map(function (o) {
        return h('option', { value: String(o.id), text: '#' + o.id + ' ' + (o.title || o.sku || '') }); })));
      parent.value = p.parent_id ? String(p.parent_id) : '';
      // brand and manufacturer (0048): a brand brings its manufacturer; without a brand the manufacturer is chosen alone
      var brand = h('select', { class: 'ecm-input', id: 'pim-brand' }), maker = h('select', { class: 'ecm-input', id: 'pim-maker' });
      function fillOpts() {
        var bv = brand.value, mv = maker.value;
        brand.innerHTML = ''; maker.innerHTML = '';
        brand.appendChild(h('option', { value: '', text: '— none —' })); maker.appendChild(h('option', { value: '', text: '— none —' }));
        ectx.brands.forEach(function (b) { brand.appendChild(h('option', { value: String(b.id), text: b.name + ' · ' + (nameOf(ectx.makers, b.manufacturer_id) || 'manufacturer #' + b.manufacturer_id) })); });
        ectx.makers.forEach(function (m) { maker.appendChild(h('option', { value: String(m.id), text: m.name })); });
        brand.value = bv; maker.value = mv;
      }
      function brandLink() {
        var b = brand.value ? byId(ectx.brands, parseInt(brand.value, 10)) : null;
        if (b) maker.value = String(b.manufacturer_id);
        maker.disabled = !!b;
        maker.title = b ? 'Comes with the brand ' + b.name : '';
      }
      fillOpts();
      brand.value = p.brand_id ? String(p.brand_id) : '';
      maker.value = p.manufacturer_id ? String(p.manufacturer_id) : '';
      brand.addEventListener('change', brandLink); brandLink();
      var ident = sect('Identification', ['sku', 'asin', 'gtin', 'pzn', 'logistics', 'status']);
      ident.querySelector('.pim-form').prepend(fieldRow({ t: 'Manufacturer', hint: 'With a brand: the brand\'s manufacturer' }, maker));
      ident.querySelector('.pim-form').prepend(fieldRow({ t: 'Brand' }, brand));
      ident.querySelector('.pim-form').prepend(fieldRow({ t: 'Parent product' }, parent));
      // Sync with Amazon: fills the form from Amazon's catalog (nothing is saved before Save)
      var amzHint = h('span', { class: 'pim-hint', text: p.amazon_synced_at ? 'Last filled from Amazon ' + A.mpCode(p.amazon_marketplace) + ' ' + A.ago(p.amazon_synced_at) + '.'
        : 'Fills this product from Amazon\'s catalog by its ASIN (or EAN); you see the changes first.' });
      var amzBtn = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Sync with Amazon' }), pendingAmz = null;
      function amzState() {
        var has = !!(ctrls.asin.value.trim() || ctrls.gtin.value.trim());
        amzBtn.disabled = !amzConn() || !has;
        amzBtn.title = !amzConn() ? 'Connect an Amazon account first (Settings).' : !has ? 'Type an ASIN (or an EAN) first.' : 'Fill from Amazon ' + mpLabel(amzMp());
      }
      ctrls.asin.addEventListener('input', amzState); ctrls.gtin.addEventListener('input', amzState); amzState();
      function formNow() {
        var v = { id: id, image_ids: pics.slice(), bullets: bullets.map(function (b) { return b.value.trim(); }).filter(Boolean),
                  brand_id: brand.value ? parseInt(brand.value, 10) : null, manufacturer_id: maker.value ? parseInt(maker.value, 10) : null, parent_id: parent.value ? parseInt(parent.value, 10) : null };
        Object.keys(ctrls).forEach(function (k) { var x = readValue(PF[k], ctrls[k]); v[k] = typeof x === 'number' && isNaN(x) ? null : x; });
        if (v.asin && !PF.asin.re.test(v.asin)) v.error = 'ASIN: 10 letters or digits.';
        else if (v.gtin && !PF.gtin.re.test(v.gtin)) v.error = 'GTIN / EAN: 8 to 14 digits.';
        return v;
      }
      function fillForm(v) {
        ['asin', 'title', 'content', 'gtin', 'width_mm', 'length_mm', 'depth_mm', 'weight_g', 'logistics'].forEach(function (k) { if (k in v && ctrls[k]) ctrls[k].value = v[k] == null ? '' : String(v[k]); });
        if (v.bullets) bullets.forEach(function (el, i) { el.value = v.bullets[i] || ''; });
        if ('brand_id' in v || 'manufacturer_id' in v) {
          fillOpts();
          if ('brand_id' in v) brand.value = String(v.brand_id);
          if (v.manufacturer_id) maker.value = String(v.manufacturer_id);
          brandLink();
        }
        if (v.image_ids) { pics = v.image_ids.slice(0, 5); paintPics(); }
        if (v.parent_id) parent.value = String(v.parent_id);
        pendingAmz = { amazon_marketplace: v.amazon_marketplace, amazon_synced_at: v.amazon_synced_at };
        amzHint.textContent = 'Filled from Amazon ' + A.mpCode(v.amazon_marketplace) + ': check the fields, then press Save.';
        amzState();
      }
      amzBtn.addEventListener('click', function () {
        var cur = formNow();
        if (cur.error) { err.textContent = cur.error; return; }
        var code = cur.asin || cur.gtin;
        amzBtn.disabled = true; amzBtn.textContent = 'Asking Amazon…'; err.textContent = '';
        lookup([code], cur.asin ? 'ASIN' : codeType(cur.gtin)).then(function (res) {
          var it = res.items && res.items[0];
          if (!it || !it.found) { err.textContent = 'Amazon ' + mpLabel(amzMp()) + ' has no product with ' + (cur.asin ? 'ASIN ' : 'EAN ') + code + '.'; return; }
          return amazonExtra(ectx, cur, it).then(function (extra) {
            amazonDialog(ectx, cur, it, extra, 'Fill the form', function (chosen) { return amazonPatch(ectx, cur, it, chosen, extra).then(fillForm); });
          });
        }).catch(function (e) { err.textContent = e.message; }).then(function () { amzBtn.textContent = 'Sync with Amazon'; amzState(); });
      });
      var bbv = id ? buyBoxOf(res[5], p) : null;
      var amzBar = h('div', { class: 'pim-amzbar' }, [amzBtn, amzHint, id ? h('span', { class: 'pim-bb', title: buyBoxTip(res[5]),
        text: 'Buy Box ' + (bbv == null ? '— (not in the Business Report)' : A.fmtNum(bbv, 1) + ' %') + ' · ' + mpLabel(amzMp()) }) : null]);
      // bullets
      var bullets = [];
      var bulletBox = h('fieldset', { class: 'pim-section' }, [h('legend', { text: 'Bullets' }), h('div', { class: 'pim-form' }, (function () {
        var out = [];
        for (var i = 0; i < BULLETS; i++) {
          var el = control({ k: 'bullet' + i, max: 500 }, (p.bullets || [])[i] || '');
          bullets.push(el); out.push(fieldRow({ t: 'Bullet ' + (i + 1), wide: true }, el));
        }
        return out;
      })())]);
      // pictures: up to 5, from the library
      var pics = (p.image_ids || []).slice();
      var slots = h('div', { class: 'pim-slots' });
      function paintPics() {
        slots.innerHTML = '';
        if (!pics.length) { slots.appendChild(h('p', { class: 'pim-hint', text: 'No pictures yet.' })); return; }
        q(sb().from('ecom_images').select('id,path,url,title').in('id', pics)).then(function (rows) {
          var by = {}; rows.forEach(function (r) { by[r.id] = r; });
          return signRows(rows).then(function () {
            slots.innerHTML = '';
            pics.forEach(function (pid, i) {
              var r = by[pid];
              slots.appendChild(h('div', { class: 'pim-slot' }, [
                r ? h('img', { src: imgSrc(r, 320), alt: r.title || 'picture', class: 'pim-slot__img' }) : h('span', { class: 'pim-hint', text: 'missing #' + pid }),
                h('span', { class: 'pim-hint', text: (i === 0 ? 'Main · ' : '') + '#' + pid }),
                h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Remove', onclick: function () { pics.splice(i, 1); paintPics(); } })]));
            });
          });
        }).catch(function (e) { slots.textContent = e.message; });
      }
      var picBox = h('fieldset', { class: 'pim-section' }, [h('legend', { text: 'Pictures (up to 5; the first is the main picture)' }), slots,
        h('div', { class: 'ecm-row' }, [h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Choose from the library…', onclick: function () {
          pickImages({ max: 5, selected: pics, title: 'Product pictures' }, function (ids) { pics = ids; paintPics(); }); } })])]);
      paintPics();
      var save = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: id ? 'Save' : 'Create product' });
      var del = id ? h('button', { type: 'button', class: 'ecm-btn ecm-btn--danger ecm-btn--small', text: 'Delete product' }) : null;
      var contentBox = sect('Content', ['title', 'content', 'details']);
      var others = ectx.brands.filter(function (b) { return b.id !== p.brand_id; }).map(function (b) { return b.name; })
        .concat(ectx.makers.filter(function (m) { return m.id !== p.manufacturer_id; }).map(function (m) { return m.name; }))
        .map(function (n) { return kwTokens(n).join(' '); }).filter(function (n) { return n && kwTokens(nameOf(ectx.brands, p.brand_id) + ' ' + nameOf(ectx.makers, p.manufacturer_id)).join(' ').indexOf(n) < 0; });
      var kw = id ? keywordPanel(p, function () { return { title: ctrls.title.value, content: ctrls.content.value, bullets: bullets.map(function (b) { return b.value; }) }; }, others) : null;
      if (kw) [ctrls.title, ctrls.content].concat(bullets).forEach(function (el) { el.addEventListener('input', kw.refresh); });
      box.append.apply(box, [amzBar, ident, contentBox, bulletBox, kw ? kw.el : null, sect('Size and weight', ['width_mm', 'length_mm', 'depth_mm', 'weight_g']), picBox,
        h('div', { class: 'ecm-row pim-actions' }, [save, del, err].filter(Boolean)),
        id ? h('p', { class: 'pim-hint', text: 'ID ' + id + ' · created ' + A.fmtTime(p.created_at) + ' · updated ' + A.fmtTime(p.updated_at) }) : null].filter(Boolean));
      save.addEventListener('click', function () {
        var v = {}, msg = '';
        Object.keys(ctrls).forEach(function (k) { var x = readValue(PF[k], ctrls[k]); msg = msg || checkValue(PF[k], x); v[k] = x; });
        if (msg) { err.textContent = msg; return; }
        v.parent_id = parent.value ? parseInt(parent.value, 10) : null;
        v.brand_id = brand.value ? parseInt(brand.value, 10) : null;
        v.manufacturer_id = maker.value ? parseInt(maker.value, 10) : null;   // the database takes the brand's when a brand is set
        v.bullets = bullets.map(function (b) { return b.value.trim(); }).filter(Boolean);
        v.image_ids = pics.slice(0, 5);
        v.status = v.status || 'active';
        if (pendingAmz) Object.assign(v, pendingAmz);
        save.disabled = true; err.textContent = '';
        var call = id ? sb().from('ecom_products').update(v).eq('id', id).select('id').single()
                      : sb().from('ecom_products').insert(Object.assign({ workspace_id: w.id }, v)).select('id').single();
        q(call).then(function (row) { A.toast(id ? 'Saved.' : 'Product created.'); go('#/pim-products/' + row.id); })
          .catch(function (e) { err.textContent = e.message; save.disabled = false; });
      });
      if (del) del.addEventListener('click', function () {
        if (!window.confirm('Delete product #' + id + ' with all its A+ versions?')) return;
        q(sb().from('ecom_products').delete().eq('id', id)).then(function () { A.toast('Deleted.'); go('#/pim-products'); })
          .catch(function (e) { err.textContent = e.message; });
      });
      if (id) box.appendChild(aplusPanel(w, id, versions, p));
    }).catch(function (e) { errorBox(box, e); });
  }

  /* 6. A+ content ---------------------------------------------------------- */
  // Amazon's standard A+ modules used here (aplusContent 2020-11-01; picture sizes = Amazon's minimum crops, text limits
  // = Amazon's: headline 150 / 160, body 6000 / 1000 / 5000, tech specs 4 to 16 rows, name 30, value 500; ≤ 7 modules)
  var MODS = {
    header: { name: 'Header picture with text', amazon: 'STANDARD_HEADER_IMAGE_TEXT', img: '970 × 600 px', blocks: 1, sub: true, body: 6000 },
    single: { name: 'Picture beside text', amazon: 'STANDARD_SINGLE_SIDE_IMAGE', img: '300 × 300 px', blocks: 1, side: true, body: 1000 },
    three: { name: 'Three pictures with text', amazon: 'STANDARD_THREE_IMAGE_TEXT', img: '300 × 300 px', blocks: 3, body: 1000 },
    four: { name: 'Four pictures with text', amazon: 'STANDARD_FOUR_IMAGE_TEXT', img: '220 × 200 px', blocks: 4, body: 1000 },
    text: { name: 'Text only', amazon: 'STANDARD_TEXT', img: null, blocks: 1, body: 5000 },
    specs: { name: 'Technical specifications (4 to 16 rows)', amazon: 'STANDARD_TECH_SPECS', img: null, blocks: 0, specs: 16 }
  };
  var LOCALES = [['de-DE', 'German'], ['en-GB', 'English (UK)'], ['fr-FR', 'French'], ['it-IT', 'Italian'], ['es-ES', 'Spanish'], ['nl-NL', 'Dutch'], ['sv-SE', 'Swedish'], ['pl-PL', 'Polish'], ['tr-TR', 'Turkish'], ['ar-AE', 'Arabic']];
  var A_STATUS = [['draft', 'Draft'], ['ready', 'Ready'], ['submitted', 'Submitted to Amazon'], ['approved', 'Approved'], ['rejected', 'Rejected']];

  function newModule(type) {
    var m = { type: type, headline: '' };
    if (type === 'specs') { m.rows = [{ name: '', value: '' }]; return m; }
    m.blocks = [];
    for (var i = 0; i < MODS[type].blocks; i++) m.blocks.push({ image_id: null, headline: '', body: '' });
    if (type === 'header') m.subheadline = '';
    if (type === 'single') m.side = 'left';
    return m;
  }

  // A first A+ draft from the product (owner, 19 Nov 2026): header picture with the name, brand and description; the
  // bullets on 3 or 4 pictures ("Benefit: text" becomes headline + text); technical data when there are 4 values
  function splitBullet(t) {
    var s = String(t || ''), m = /^(.{3,60}?)\s*[:–—]\s+(.+)$/.exec(s) || /^(.{3,60}?)\s+-\s+(.+)$/.exec(s);
    return m ? { h: m[1].slice(0, 160), b: m[2].slice(0, 1000) } : { h: '', b: s.slice(0, 1000) };
  }
  function starterModules(p, brandName, makerName) {
    var mods = [], pics = p.image_ids || [], bl = p.bullets || [];
    var hd = newModule('header');
    hd.headline = (p.title || '').slice(0, 150); hd.subheadline = (brandName || '').slice(0, 150);
    hd.blocks[0].image_id = pics[0] || null; hd.blocks[0].body = (p.content || bl.join('\n')).slice(0, 6000);
    mods.push(hd);
    if (bl.length) {
      var grid = newModule(bl.length >= 4 ? 'four' : 'three');
      grid.blocks.forEach(function (b, i) { var x = splitBullet(bl[i]); b.image_id = pics[i + 1] || null; b.headline = x.h; b.body = x.b; });
      mods.push(grid);
    }
    var size = [p.width_mm, p.length_mm, p.depth_mm].some(function (x) { return x != null; }) ? [p.width_mm, p.length_mm, p.depth_mm].map(function (x) { return x == null ? '?' : A.fmtNum(x, 1); }).join(' × ') + ' mm' : '';
    var rows = [['Brand', brandName], ['Manufacturer', makerName], ['EAN', p.gtin], ['PZN', p.pzn], ['ASIN', p.asin], ['Size (W × L × D)', size],
      ['Weight', p.weight_g != null ? A.fmtNum(p.weight_g, 1) + ' g' : '']].filter(function (r) { return r[1]; });
    if (rows.length >= 4) {
      var sp = newModule('specs');
      sp.headline = 'Technical data'; sp.rows = rows.map(function (r) { return { name: r[0].slice(0, 30), value: String(r[1]).slice(0, 500) }; });
      mods.push(sp);
    }
    return mods;
  }

  // The simplified preview of one version made here (the editor and the A+ section's Preview)
  function ownPreview(target, mods, emptyText) {
    var ids = [];
    mods.forEach(function (m) { (m.blocks || []).forEach(function (b) { if (b.image_id) ids.push(b.image_id); }); });
    function draw(pics) {
      target.innerHTML = '';
      if (!mods.length) target.appendChild(h('p', { class: 'pim-hint', text: emptyText || 'This version is empty.' }));
      mods.forEach(function (m) {
        var M = MODS[m.type] || MODS.text, el = h('section', { class: 'pim-pv pim-pv--' + m.type + (m.side === 'right' ? ' is-right' : '') });
        if (m.headline) el.appendChild(h('h3', { class: 'pim-pv__h', text: m.headline }));
        if (m.subheadline) el.appendChild(h('p', { class: 'pim-pv__sub', text: m.subheadline }));
        var grid = h('div', { class: 'pim-pv__blocks' });
        (m.blocks || []).forEach(function (b) {
          var src = b.image_id && pics[b.image_id] ? imgSrc(pics[b.image_id], 1000) : null;
          grid.appendChild(h('div', { class: 'pim-pv__block' }, [M.img ? (src ? h('img', { src: src, alt: b.headline || '' }) : h('div', { class: 'pim-pv__ph', text: M.img })) : null,
            b.headline ? h('strong', { text: b.headline }) : null, b.body ? h('p', { text: b.body }) : null]));
        });
        el.appendChild(grid);
        if (m.rows) el.appendChild(h('table', { class: 'ecm-table' }, h('tbody', null, m.rows.filter(function (r) { return r.name || r.value; }).map(function (r) {
          return h('tr', null, [h('th', { scope: 'row', text: r.name }), h('td', { text: r.value })]); }))));
        target.appendChild(el);
      });
    }
    if (!ids.length) { draw({}); return; }
    q(sb().from('ecom_images').select('id,path,url').in('id', ids)).then(function (rows) {
      var by = {}; rows.forEach(function (r) { by[r.id] = r; });
      return signRows(rows).then(function () { draw(by); });
    }).catch(function () { draw({}); });
  }

  // Amazon's A+ as Amazon shows it (owner, 19 Nov 2026: "make A+ content viewable … preview it in the A+ section"): the
  // documents of the product's ASIN from ecom-amazon (aplus_get; only those this account made), standard and premium
  // modules and the Brand Story, pictures straight from Amazon's media server. A simplified, read-only view.
  function apImg(o, cls) {
    if (!o || !o.uploadDestinationId) return null;
    // the crop size reserves the picture's space before it arrives (no jumping while it loads)
    var sz = o.imageCropSpecification && o.imageCropSpecification.size, wd = sz && sz.width && sz.width.value, ht = sz && sz.height && sz.height.value;
    return h('img', { class: cls || 'apv-img', src: 'https://m.media-amazon.com/images/S/' + o.uploadDestinationId, loading: 'lazy',
      width: wd ? String(wd) : null, height: ht ? String(ht) : null, alt: o.altText && o.altText !== 'aplus content image' ? o.altText : '' });
  }
  function apTxt(o) {
    if (!o) return '';
    if (typeof o.value === 'string') return o.value;
    return (o.textList || []).map(function (t) { return (t && t.value) || ''; }).filter(Boolean).join('\n');
  }
  function apText(o, tag, cls) { var t = apTxt(o); return t ? h(tag || 'p', { class: cls || 'apv-p', text: t }) : null; }
  function apBody(m) {
    var k = Object.keys(m || {}).filter(function (x) { return x !== 'contentModuleType' && m[x] && typeof m[x] === 'object'; })[0];
    return k ? m[k] : {};
  }
  function apKind(doc) {
    if (/brand ?story/i.test(doc.content_type || '')) return 'Brand Story';
    return (doc.modules || []).some(function (m) { return /^PREMIUM_/.test(m.contentModuleType || ''); }) ? 'Premium A+ content' : 'A+ content';
  }
  function apCard(img, title, asin, mp) {
    var host = A.amzHost ? A.amzHost(mp) : '';
    return h('div', { class: 'apv-card' }, [apImg(img, 'apv-card__img'), title ? h('span', { class: 'apv-card__t', text: title }) : null,
      asin ? (host ? h('a', { class: 'apv-card__a', href: 'https://www.' + host + '/dp/' + encodeURIComponent(asin), target: '_blank', rel: 'noopener', text: asin })
                   : h('span', { class: 'apv-card__a', text: asin })) : null]);
  }
  // any other module (Amazon's standard modules): headlines, texts, pictures and blocks in their order
  function apGeneric(o, el, key) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(function (x) { apGeneric(x, el, key); }); return; }
    if (o.uploadDestinationId) { el.appendChild(apImg(o)); return; }
    var head = /headline|title|navtext/i.test(key || '');
    if (typeof o.value === 'string') { if (o.value) el.appendChild(h(head ? 'h4' : 'p', { class: head ? 'apv-h' : 'apv-p', text: o.value })); return; }
    if (Array.isArray(o.textList)) { var t = apTxt(o); if (t) el.appendChild(h('p', { class: 'apv-p', text: t })); return; }
    var keys = Object.keys(o).filter(function (k) { return k !== 'imageCropSpecification' && k !== 'decoratorSet' && !(k === 'mobileImage' && o.desktopImage); });
    var multi = keys.filter(function (k) { return /^block\d+$/.test(k); }).length > 1, box = h('div', { class: 'apv-group' }), row = null;
    keys.forEach(function (k) {
      if (multi && /^block\d+$/.test(k)) {
        if (!row) { row = h('div', { class: 'apv-row' }); box.appendChild(row); }
        var col = h('div', { class: 'apv-col' }); apGeneric(o[k], col, k); row.appendChild(col);
      } else apGeneric(o[k], box, k);
    });
    if (box.childNodes.length) el.appendChild(box);
  }
  function apModule(m, mp) {
    var t = m.contentModuleType || '', b = apBody(m), el = h('section', { class: 'apv-mod', 'data-type': t });
    function add(x) { if (x) el.appendChild(x); }
    if (b.carouselCards) {   // a carousel: its tabs and one card at a time
      var cards = b.carouselCards.map(apBody), stage = h('div', { class: 'apv-stage' }), nav = h('div', { class: 'apv-nav', role: 'tablist' });
      var show = function (i) {
        var c = cards[i] || {};
        stage.replaceChildren();
        [apImg(c.desktopImage || c.image || c.backgroundImage, 'apv-wide'), apText(c.headline, 'h4', 'apv-h'), apText(c.body || c.description)].forEach(function (x) { if (x) stage.appendChild(x); });
        Array.prototype.forEach.call(nav.children, function (bt, j) { bt.setAttribute('aria-selected', String(j === i)); });
      };
      cards.forEach(function (c, i) { nav.appendChild(h('button', { type: 'button', role: 'tab', class: 'apv-nav__btn', text: apTxt(c.navText) || String(i + 1), onclick: function () { show(i); } })); });
      add(apText(b.headline, 'h4', 'apv-h')); add(nav); add(stage); show(0);
    } else if (b.faqs) {
      add(apText(b.headline, 'h4', 'apv-h'));
      b.faqs.forEach(function (f) { var x = apBody(f); add(h('details', { class: 'apv-faq' }, [h('summary', { text: apTxt(x.question) }), apText(x.answer)])); });
    } else if (b.comparisonProducts || b.asinImages) {
      add(apText(b.headline || b.title, 'h4', 'apv-h'));
      add(h('div', { class: 'apv-cards' }, (b.comparisonProducts || b.asinImages).map(function (c) {
        var x = apBody(c); return apCard(x.desktopImage || x.productImage || x.image, apTxt(x.productTitle), apTxt(x.productAsin), mp); })));
    } else if (b.specificationList) {
      add(apText(b.headline, 'h4', 'apv-h'));
      add(h('table', { class: 'ecm-table apv-specs' }, h('tbody', null, b.specificationList.map(function (s) {
        return h('tr', null, [h('th', { scope: 'row', text: apTxt(s.label) }), h('td', { text: apTxt(s.description) })]); }))));
    } else if (b.desktopImage && !b.headline && !b.description && !b.body) {
      add(apImg(b.desktopImage, 'apv-wide'));
    } else apGeneric(b, el, '');
    return el;
  }
  function apDocument(doc, mp) {
    return h('div', { class: 'apv' + (/brand ?story/i.test(doc.content_type || '') ? ' apv--story' : '') }, (doc.modules || []).map(function (m) { return apModule(m, mp); }));
  }

  // The A+ section of a product (owner, 19 Nov 2026): the A+ that is on Amazon for its ASIN (read-only) and the
  // versions made here — each with a Preview
  function aplusPanel(w, pid, versions, p) {
    var c = amzConn(), mp = amzMp();
    function create(from) {
      var row = { workspace_id: w.id, product_id: pid, name: from ? from.name : 'A+ content', locale: from ? from.locale : 'de-DE', modules: from ? from.modules : [] };
      q(sb().from('ecom_aplus').insert(row).select('id,version').single()).then(function (r) {
        A.toast('Version ' + r.version + ' created.'); go('#/pim-products/' + pid + '/aplus/' + r.id);
      }).catch(function (e) { A.toast(e.message, 'act'); });
    }
    function previewOwn(v) {
      var body = h('div', { class: 'pim-aplus__preview pim-aplus__preview--dlg' });
      var open = h('a', { class: 'ecm-btn ecm-btn--ghost ecm-btn--small', href: '#/pim-products/' + pid + '/aplus/' + v.id, text: 'Open in the editor' });
      var d = dialog('A+ version ' + v.version + ' — preview', [h('p', { class: 'pim-hint', text: (v.name || 'A+ content') + ' · ' + v.locale + ' · ' + v.status + ' · ' +
        (v.modules || []).length + ' modules · simplified preview' }), body], [open], true);
      open.addEventListener('click', function () { d.close(); });
      ownPreview(body, v.modules || [], 'This version is empty: open it in the editor and fill it with the product\'s data.');
    }
    function previewAmazon(doc) {
      dialog((doc.name || apKind(doc)) + ' — on Amazon', [h('p', { class: 'pim-hint', text: apKind(doc) + ' · ' + String(doc.status || '').toLowerCase() + ' · ' + doc.locale +
        (doc.updated ? ' · updated ' + A.fmtTime(doc.updated) : '') + ' · as on ' + (A.amzHost ? A.amzHost(mp) : 'Amazon') + ', simplified' }), apDocument(doc, mp)], [], true);
    }
    var amz = h('div', { class: 'pim-amzaplus', 'aria-live': 'polite' });
    function loadAmazon() {
      if (!p || !p.asin) { amz.replaceChildren(h('p', { class: 'pim-hint', text: 'Add an ASIN to see the A+ that is on Amazon for this product.' })); return; }
      if (!c) { amz.replaceChildren(h('p', { class: 'pim-hint', text: 'Connect an Amazon account (Settings) to see the A+ that is on Amazon.' })); return; }
      amz.replaceChildren(h('p', { class: 'pim-hint', text: 'Looking for the A+ of ASIN ' + p.asin + ' on Amazon ' + mpLabel(mp) + '…' }));
      A.invoke('ecom-amazon', { action: 'aplus_get', connection_id: c.id, marketplace_id: mp, asin: p.asin }).then(function (r) {
        amz.innerHTML = '';
        if (!r.documents.length) {
          amz.appendChild(h('p', { class: 'pim-hint', text: 'No A+ on Amazon ' + mpLabel(mp) + ' for ASIN ' + p.asin + ' from this account (Amazon does not give out A+ made by another brand owner).' }));
          return;
        }
        r.documents.forEach(function (doc) {
          amz.appendChild(h('div', { class: 'pim-amzdoc' }, [h('div', { class: 'pim-amzdoc__t' }, [h('strong', { text: doc.name || apKind(doc) }),
            h('span', { class: 'pim-hint', text: apKind(doc) + ' · ' + String(doc.status || '').toLowerCase() + ' · ' + (doc.modules || []).length + ' modules · ' + doc.locale +
              (doc.updated ? ' · updated ' + A.fmtTime(doc.updated) : '') })]),
            h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: 'Preview', 'aria-label': 'Preview ' + (doc.name || apKind(doc)), onclick: function () { previewAmazon(doc); } })]));
        });
      }).catch(function (e) {
        amz.replaceChildren(h('p', { class: 'pim-hint', text: /unknown action/i.test(e.message) ? 'To see the A+ that is on Amazon, the server function ecom-amazon needs its update (paste it in Supabase once).'
          : 'The A+ on Amazon could not be read: ' + e.message }), h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Try again', onclick: loadAmazon }));
      });
    }
    loadAmazon();
    var list = versions.length ? h('div', { class: 'ecm-tablewrap' }, h('table', { class: 'ecm-table' }, [
      h('caption', { class: 'visually-hidden', text: 'A+ versions of product ' + pid }),
      h('thead', null, h('tr', null, ['Version', 'Name', 'Language', 'Status', 'Modules', 'Updated', ''].map(function (t, i) {
        return h('th', { scope: 'col', class: i === 0 || i === 4 ? 'is-num' : null }, t ? t : h('span', { class: 'visually-hidden', text: 'Actions' })); }))),
      h('tbody', null, versions.map(function (v) {
        return h('tr', null, [h('td', { class: 'is-num', text: String(v.version) }), h('td', { text: v.name || '' }), h('td', { text: v.locale || '' }), h('td', { text: v.status || '' }),
          h('td', { class: 'is-num', text: String((v.modules || []).length) }), h('td', { text: A.isoMinute(v.updated_at) }),
          h('td', null, h('span', { class: 'pim-act__in' }, [
            h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Preview', 'aria-label': 'Preview A+ version ' + v.version, onclick: function () { previewOwn(v); } }),
            h('a', { class: 'ecm-btn ecm-btn--ghost ecm-btn--small', href: '#/pim-products/' + pid + '/aplus/' + v.id, text: 'Open', 'aria-label': 'Open A+ version ' + v.version })]))]);
      }))])) : h('p', { class: 'pim-hint', text: 'No versions made here yet. A version holds up to 7 of Amazon\'s standard modules; make several and keep the one you submit.' });
    return h('fieldset', { class: 'pim-section' }, [h('legend', { text: 'A+ content' }),
      h('div', { class: 'pim-aplus__head' }, [h('h3', { class: 'ecm-h3', text: 'On Amazon ' + (mp ? mpLabel(mp) : '') }),
        h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Reload', onclick: loadAmazon })]), amz,
      h('div', { class: 'pim-aplus__head' }, [h('h3', { class: 'ecm-h3', text: 'Versions made here' }),
        h('span', { class: 'pim-act__in' }, [h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: '+ New A+ version', onclick: function () { create(null); } }),
          versions.length ? h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Copy the newest as a new version', onclick: function () { create(versions[0]); } }) : null])]),
      list]);
  }

  function renderAplus(main, pid, vid) {
    var w = wsOr(main); if (!w) return;
    main.appendChild(h('a', { class: 'pim-back', href: '#/pim-products/' + pid, text: '← Product #' + pid }));
    var box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' }));
    main.appendChild(box);
    Promise.all([q(sb().from('ecom_aplus').select('*').eq('id', vid).maybeSingle()),
      q(sb().from('ecom_products').select('id,title,sku,asin,content,bullets,image_ids,gtin,pzn,width_mm,length_mm,depth_mm,weight_g,brand_id,manufacturer_id').eq('id', pid).maybeSingle()),
      q(sb().from('ecom_brands').select('id,name').eq('workspace_id', w.id)), q(sb().from('ecom_manufacturers').select('id,name').eq('workspace_id', w.id))]).then(function (res) {
      var v = res[0], p = res[1] || {}, brandName = nameOf(res[2] || [], p.brand_id), makerName = nameOf(res[3] || [], p.manufacturer_id);
      if (!v) { box.innerHTML = ''; box.appendChild(h('p', { class: 'ecm-error', text: 'This A+ version does not exist (any more).' })); return; }
      box.innerHTML = '';
      main.insertBefore(h('h1', { class: 'ecm-h1', text: 'A+ content · version ' + v.version }), box);
      var mods = JSON.parse(JSON.stringify(v.modules || []));
      var name = control({ k: 'aname', max: 100 }, v.name), locale = control({ k: 'alocale', opts: LOCALES }, v.locale), status = control({ k: 'astatus', opts: A_STATUS }, v.status);
      var note = control({ k: 'anote', max: 2000 }, v.note);
      var editor = h('div', { class: 'pim-aplus__edit' }), preview = h('div', { class: 'pim-aplus__preview', 'aria-label': 'Preview' });
      var err = h('p', { class: 'ecm-error', role: 'alert' });
      function txt(val, max, on, rows) {
        var el = rows ? h('textarea', { class: 'ecm-input pim-area', rows: String(rows), maxlength: String(max) }) : h('input', { class: 'ecm-input', maxlength: String(max) });
        el.value = val || ''; el.addEventListener('input', function () { on(el.value); paintPreview(); }); return el;
      }
      function picButton(block) {
        var b = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: block.image_id ? 'Picture #' + block.image_id : 'Choose picture…' });
        b.addEventListener('click', function () {
          pickImages({ max: 1, selected: block.image_id ? [block.image_id] : [], title: 'A+ picture' }, function (ids) { block.image_id = ids[0] || null; paintEditor(); paintPreview(); });
        });
        return b;
      }
      function paintEditor() {
        editor.innerHTML = '';
        // an empty version (owner, 19 Nov 2026: "not shown on preview"): a first draft from the product in one click
        if (!mods.length) editor.appendChild(h('div', { class: 'pim-module pim-module--empty' }, [
          h('p', { class: 'pim-hint', text: 'This version is empty: it has no modules yet. Fill it with this product\'s data (name, description, bullets, pictures, technical data) and change what you like, or add modules one by one below.' }),
          h('div', { class: 'ecm-row' }, h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: 'Fill with the product\'s data', onclick: function () {
            mods = starterModules(p, brandName, makerName); paintEditor(); paintPreview();
            A.toast('Filled with the product\'s data. Press "Save version ' + v.version + '" to keep it.');
          } }))]));
        mods.forEach(function (m, i) {
          var M = MODS[m.type] || MODS.text;
          var kids = [h('div', { class: 'pim-module__head' }, [h('strong', { text: (i + 1) + '. ' + M.name }), h('span', { class: 'pim-hint', text: M.amazon + (M.img ? ' · pictures ' + M.img : '') }),
            h('span', { class: 'ecm-row' }, [
              h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: '↑', 'aria-label': 'Move up', disabled: i === 0, onclick: function () { mods.splice(i - 1, 0, mods.splice(i, 1)[0]); paintEditor(); paintPreview(); } }),
              h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: '↓', 'aria-label': 'Move down', disabled: i === mods.length - 1, onclick: function () { mods.splice(i + 1, 0, mods.splice(i, 1)[0]); paintEditor(); paintPreview(); } }),
              h('button', { type: 'button', class: 'ecm-btn ecm-btn--danger ecm-btn--small', text: 'Remove', onclick: function () { mods.splice(i, 1); paintEditor(); paintPreview(); } })])])];
          kids.push(h('label', { class: 'pim-label', text: 'Headline' }), txt(m.headline, 150, function (x) { m.headline = x; }));
          if (m.type === 'header') kids.push(h('label', { class: 'pim-label', text: 'Subheadline' }), txt(m.subheadline, 150, function (x) { m.subheadline = x; }));
          if (m.type === 'single') {
            var side = control({ k: 'side' + i, opts: [['left', 'Picture left'], ['right', 'Picture right']] }, m.side);
            side.addEventListener('change', function () { m.side = side.value; paintPreview(); });
            kids.push(side);
          }
          (m.blocks || []).forEach(function (b, j) {
            var row = [];
            if (M.img) row.push(picButton(b));
            if (M.blocks > 1) row.push(h('label', { class: 'pim-label', text: 'Block ' + (j + 1) + ' headline' }), txt(b.headline, 160, function (x) { b.headline = x; }));
            row.push(h('label', { class: 'pim-label', text: M.blocks > 1 ? 'Block ' + (j + 1) + ' text' : 'Text' }), txt(b.body, M.body, function (x) { b.body = x; }, 3));
            kids.push(h('div', { class: 'pim-block' }, row));
          });
          if (m.type === 'specs') {
            m.rows.forEach(function (r, j) {
              kids.push(h('div', { class: 'pim-spec' }, [txt(r.name, 30, function (x) { r.name = x; }), txt(r.value, 500, function (x) { r.value = x; }),
                h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: '✕', 'aria-label': 'Remove row', onclick: function () { m.rows.splice(j, 1); paintEditor(); paintPreview(); } })]));
            });
            if (m.rows.length < 16) kids.push(h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: '+ Row', onclick: function () { m.rows.push({ name: '', value: '' }); paintEditor(); } }));
          }
          editor.appendChild(h('div', { class: 'pim-module' }, kids));
        });
        if (mods.length < 7) {
          var type = control({ k: 'newmod', opts: Object.keys(MODS).map(function (k) { return [k, MODS[k].name]; }) });
          editor.appendChild(h('div', { class: 'ecm-row pim-module--add' }, [type, h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: '+ Add module',
            onclick: function () { mods.push(newModule(type.value)); paintEditor(); paintPreview(); } })]));
        } else editor.appendChild(h('p', { class: 'pim-hint', text: 'An A+ document holds at most 7 modules.' }));
      }
      function paintPreview() {
        var body = h('div');
        preview.replaceChildren(h('p', { class: 'pim-hint', text: 'Preview (simplified)' }), body);
        ownPreview(body, mods, 'This version is empty. Fill it with the product\'s data, or add a module on the left.');
      }
      function values() { return { name: name.value.trim() || 'A+ content', locale: locale.value, status: status.value, note: note.value.trim() || null, modules: mods }; }
      var save = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: 'Save version ' + v.version });
      var copy = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Save as a new version' });
      var json = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Download for Amazon (JSON)' });
      var del = h('button', { type: 'button', class: 'ecm-btn ecm-btn--danger ecm-btn--small', text: 'Delete version' });
      save.addEventListener('click', function () {
        q(sb().from('ecom_aplus').update(values()).eq('id', vid)).then(function () { A.toast('Version ' + v.version + ' saved.'); }).catch(function (e) { err.textContent = e.message; });
      });
      copy.addEventListener('click', function () {
        q(sb().from('ecom_aplus').insert(Object.assign({ workspace_id: w.id, product_id: pid }, values(), { status: 'draft' })).select('id,version').single())
          .then(function (r) { A.toast('Saved as version ' + r.version + '.'); go('#/pim-products/' + pid + '/aplus/' + r.id); }).catch(function (e) { err.textContent = e.message; });
      });
      json.addEventListener('click', function () { downloadAmazonJson(values(), p, v.version); });
      del.addEventListener('click', function () {
        if (!window.confirm('Delete A+ version ' + v.version + '?')) return;
        q(sb().from('ecom_aplus').delete().eq('id', vid)).then(function () { A.toast('Deleted.'); go('#/pim-products/' + pid); }).catch(function (e) { err.textContent = e.message; });
      });
      box.append(h('p', { class: 'pim-hint', text: 'Product #' + pid + ' · ' + (p.title || p.sku || '') + (p.asin ? ' · ASIN ' + p.asin : '') }),
        h('div', { class: 'pim-form' }, [fieldRow({ t: 'Name' }, name), fieldRow({ t: 'Language' }, locale), fieldRow({ t: 'Status' }, status), fieldRow({ t: 'Note' }, note)]),
        h('div', { class: 'ecm-row pim-actions' }, [save, copy, json, del, err]),
        h('div', { class: 'pim-aplus' }, [editor, preview]),
        h('p', { class: 'pim-hint', text: 'Sending to Amazon comes in a later step: the A+ Content API (create the document, link the ASIN, submit for approval; pictures go through Amazon\'s upload). Until then use the JSON download or copy the texts.' }));
      paintEditor(); paintPreview();
    }).catch(function (e) { errorBox(box, e); });
  }

  // Amazon's A+ content document (aplusContent 2020-11-01) as a draft; pictures are named by their library id and
  // replaced by Amazon upload ids when the document is sent (next step)
  function downloadAmazonJson(v, p, version) {
    var T = function (s) { return { value: s || '', decoratorSet: [] }; };
    var img = function (b, size) {
      var wh = (size || '300 × 300').split(' × ').map(function (x) { return parseInt(x, 10); });
      return { uploadDestinationId: b.image_id ? 'LIBRARY-' + b.image_id : '', altText: b.headline || '',
               imageCropSpecification: { size: { width: { value: wh[0], units: 'pixels' }, height: { value: wh[1], units: 'pixels' } } } };
    };
    var mods = v.modules.map(function (m) {
      var M = MODS[m.type] || MODS.text, b0 = (m.blocks || [])[0] || {};
      var key = M.amazon.toLowerCase().replace(/_([a-z])/g, function (x, c) { return c.toUpperCase(); });
      var body = {};
      if (m.type === 'header') body = { headline: T(m.headline), block: { image: img(b0, '970 × 600'), headline: T(m.subheadline), body: { textList: [T(b0.body)] } } };
      else if (m.type === 'single') body = { imagePositionType: m.side === 'right' ? 'RIGHT' : 'LEFT', block: { image: img(b0), headline: T(m.headline), body: { textList: [T(b0.body)] } } };
      else if (m.type === 'three' || m.type === 'four') {
        body = { headline: T(m.headline) };
        m.blocks.forEach(function (b, i) { body['block' + (i + 1)] = { image: img(b, M.img), headline: T(b.headline), body: { textList: [T(b.body)] } }; });
      } else if (m.type === 'text') body = { headline: T(m.headline), body: { textList: [T(b0.body)] } };
      else if (m.type === 'specs') body = { headline: T(m.headline), specificationList: m.rows.filter(function (r) { return r.name || r.value; }).map(function (r) {
        return { label: T(r.name), description: { textList: [T(r.value)] } }; }), tableCount: 1 };
      var o = { contentModuleType: M.amazon }; o[key] = body; return o;
    });
    var doc = { contentDocument: { name: v.name, contentType: 'EBC', locale: v.locale, contentModuleList: mods },
                _phantasma: { product: { id: p.id, sku: p.sku || null, asin: p.asin || null }, version: version, note: 'Pictures: LIBRARY-<id> = picture id in the image library.' } };
    var blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    var a = h('a', { href: URL.createObjectURL(blob), download: 'aplus-product-' + p.id + '-v' + version + '.json' });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* 7. Routes -------------------------------------------------------------- */
  A.route('pim-products', route);
  A.route('pim-manufacturers', function (main) { renderEntity('pim-manufacturers', main); });
  A.route('pim-brands', function (main) { renderEntity('pim-brands', main); });
  A.route('pim-sellers', function (main) { renderEntity('pim-sellers', main); });
  A.route('pim-images', renderImages);
  window.EcomPim = { pickImages: pickImages, signed: signed };   // for the product monitor (app.js)
})();
