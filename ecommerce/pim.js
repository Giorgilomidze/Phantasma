/* =========================================================================
   PIM — product information for E-commerce automation (/ecommerce/). C7 Ecommerce Platform, 18 Nov 2026.
   Owner: "Create section PIM … Products, Manufacturers, Brands, Sellers … each product with A+ content and several
   versions … the image library like the advertising module (bulk uploads, Gemini and ChatGPT pictures) … deliver
   the MVP and I will improve after."
   Data: the PIM tables of supabase/0047 (members of the workspace read and write them; RLS); pictures in the private
   bucket ecom-library at <workspace id>/<file>; AI pictures through the Edge Function ecom-generate-image.
   Uses window.EcomApp (app.js: helpers, tables, route registry). One IIFE, no build step; every text from the
   database is written with textContent.
   1. Helpers  2. Manufacturers / brands / sellers  3. Image library, upload, AI, picker  4. Products
   5. Product editor  6. A+ content  7. Routes
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

  /* 2. Manufacturers / brands / sellers ----------------------------------- */
  var F_NAME = { k: 'name', t: 'Name', req: true, max: 200 };
  var F_ALT = { k: 'alt_name', t: 'Alternative name', max: 200 };
  var F_STATUS = { k: 'status', t: 'Status', opts: [['active', 'Active'], ['inactive', 'Inactive']] };
  var C_ID = { k: 'id', t: 'ID', num: true }, C_CREATED = { k: 'created_at', t: 'Created', f: A.isoMinute }, C_UPDATED = { k: 'updated_at', t: 'Updated', f: A.isoMinute };
  var ENT = {
    'pim-manufacturers': { table: 'ecom_manufacturers', title: 'Manufacturers', one: 'manufacturer',
      fields: [F_NAME, F_ALT, F_STATUS],
      cols: [C_ID, { k: 'name', t: 'Name', wide: true }, { k: 'alt_name', t: 'Alternative name' }, { k: '_brands', t: 'Brands', num: true },
             { k: 'status', t: 'Status' }, C_CREATED, C_UPDATED] },
    'pim-brands': { table: 'ecom_brands', title: 'Brands', one: 'brand',
      fields: [{ k: 'manufacturer_id', t: 'Manufacturer', req: true, ref: true }, F_NAME, F_ALT, F_STATUS],
      cols: [C_ID, { k: '_manufacturer', t: 'Manufacturer' }, { k: 'name', t: 'Name', wide: true }, { k: 'alt_name', t: 'Alternative name' },
             { k: 'status', t: 'Status' }, C_CREATED, C_UPDATED] },
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
    var qy = sb().from('ecom_images').select('id,path,title,tags,source,prompt,mime,bytes,width,height,created_at,archived_at')
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
    if (urlCache[img.path]) pic.src = urlCache[img.path];
    var t = h(opts && opts.onPick ? 'button' : 'button', { type: 'button', class: 'pim-tile' + (opts && opts.on ? ' is-on' : '') + (img.archived_at ? ' is-archived' : ''),
      'aria-pressed': opts && opts.onPick ? String(!!opts.on) : null, title: img.title || '',
      onclick: function () { if (opts && opts.onPick) opts.onPick(img, t); else if (opts && opts.onOpen) opts.onOpen(img); } }, [
      pic, h('span', { class: 'pim-tile__name', text: img.title || ('#' + img.id) }),
      h('span', { class: 'pim-tile__meta', text: '#' + img.id + ' · ' + kb(img.bytes) + (img.source !== 'upload' ? ' · ' + (img.source === 'openai' ? 'ChatGPT' : 'Gemini') : '') + (img.archived_at ? ' · archived' : '') })]);
    return t;
  }
  // A grid of pictures with search, source filter and 20 per page
  function imageGrid(all, opts) {
    var st = { q: '', src: '' }, shown = [];
    var search = h('input', { class: 'ecm-input', type: 'search', placeholder: 'Search name or tag', 'aria-label': 'Search pictures' });
    var src = h('select', { class: 'ecm-input', 'aria-label': 'Source' }, [['', 'All pictures'], ['upload', 'Uploads'], ['gemini', 'Gemini'], ['openai', 'ChatGPT']]
      .concat(opts.archived ? [['archived', 'Archived']] : []).map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    var count = h('span', { class: 'ecm-tools__count', 'aria-live': 'polite' });
    var grid = h('div', { class: 'pim-grid' });
    var pager = A.pagerBar(draw);
    function apply() {
      var qq = st.q.toLowerCase();
      shown = all.filter(function (i) {
        if (st.src === 'archived') { if (!i.archived_at) return false; } else if (i.archived_at && opts.archived) return false;
        if (st.src && st.src !== 'archived' && i.source !== st.src) return false;
        return !qq || (i.title || '').toLowerCase().indexOf(qq) >= 0 || (i.tags || []).some(function (t) { return t.indexOf(qq) >= 0; });
      });
      pager.set(shown.length, 0);
      count.textContent = A.fmtInt(shown.length) + (shown.length === 1 ? ' picture' : ' pictures');
      draw();
    }
    function draw() {
      var page = shown.slice(pager.page() * A.PAGE_ROWS, (pager.page() + 1) * A.PAGE_ROWS);
      grid.innerHTML = '';
      if (!page.length) { grid.appendChild(h('p', { class: 'ecm-note', text: all.length ? 'No picture matches.' : 'No pictures yet. Upload some or make them with AI.' })); return; }
      signed(page.map(function (i) { return i.path; })).then(function () {
        grid.innerHTML = '';
        page.forEach(function (i) { grid.appendChild(tile(i, { on: opts.isOn ? opts.isOn(i) : false, onPick: opts.onPick, onOpen: opts.onOpen })); });
      });
    }
    search.addEventListener('input', function () { st.q = this.value.trim(); apply(); });
    src.addEventListener('change', function () { st.src = this.value; apply(); });
    apply();
    return { el: h('div', null, [h('div', { class: 'ecm-tools' }, [search, src].concat(opts.tools || []).concat([count])), grid, pager.el]), refresh: apply,
             set: function (list) { all = list; apply(); } };
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
    var grid = null;
    function reload() {
      loadImages({ archived: true }).then(function (all) {
        var used = all.reduce(function (a, i) { return a + (i.bytes || 0); }, 0);
        usage.textContent = 'Used ' + kb(used) + ' of 500 MB · PNG, JPEG or WebP up to 10 MB, 50 per upload; you can also drop files here';
        if (!grid) { box.innerHTML = ''; grid = imageGrid(all, { archived: true, onOpen: function (i) { imageDetails(i, reload); } }); box.appendChild(grid.el); }
        else grid.set(all);
      }).catch(function (e) { errorBox(box, e); });
    }
    reload();
  }

  function imageDetails(img, done) {
    var title = control({ k: 'title', max: 200 }, img.title), tags = control({ k: 'tags', max: 400 }, (img.tags || []).join(', '));
    var pic = h('img', { class: 'pim-detail__img', alt: img.title || 'picture' });
    signed([img.path]).then(function () { pic.src = urlCache[img.path] || ''; });
    var used = h('p', { class: 'pim-hint', text: 'Checking where it is used…' });
    q(sb().from('ecom_products').select('id,title,sku').eq('workspace_id', A.ws().id).contains('image_ids', [img.id])).then(function (rows) {
      used.textContent = rows.length ? 'Used by ' + rows.length + ' product' + (rows.length === 1 ? '' : 's') + ': ' + rows.slice(0, 5).map(function (r) { return '#' + r.id + ' ' + (r.title || r.sku || ''); }).join(', ') : 'Not used by a product.';
    }).catch(function () { used.textContent = ''; });
    var err = h('p', { class: 'ecm-error', role: 'alert' });
    var body = h('div', { class: 'pim-detail' }, [pic, h('div', { class: 'pim-form' }, [
      fieldRow({ t: 'Name' }, title), fieldRow({ t: 'Tags (comma separated)' }, tags),
      h('p', { class: 'pim-hint pim-field--wide', text: '#' + img.id + ' · ' + (img.width ? img.width + ' × ' + img.height + ' px · ' : '') + kb(img.bytes) + ' · ' +
        (img.source === 'upload' ? 'uploaded' : 'made with ' + (img.source === 'openai' ? 'ChatGPT' : 'Gemini')) + ' · ' + A.fmtTime(img.created_at) }),
      img.prompt ? h('p', { class: 'pim-hint pim-field--wide', text: 'Prompt: ' + img.prompt }) : null, used, err])]);
    var save = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: 'Save' });
    var arch = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: img.archived_at ? 'Restore' : 'Archive' });
    var del = h('button', { type: 'button', class: 'ecm-btn ecm-btn--danger ecm-btn--small', text: 'Delete' });
    var open = h('a', { class: 'ecm-btn ecm-btn--ghost ecm-btn--small', href: '#', target: '_blank', rel: 'noopener', text: 'Open full size' });
    signed([img.path]).then(function () { open.href = urlCache[img.path] || '#'; });
    var d = dialog('Picture', body, [del, arch, open, save], true);
    save.addEventListener('click', function () {
      var t = tags.value.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean).slice(0, 20);
      q(sb().from('ecom_images').update({ title: title.value.trim() || null, tags: t }).eq('id', img.id)).then(function () { d.close(); A.toast('Saved.'); done(); })
        .catch(function (e) { err.textContent = e.message; });
    });
    arch.addEventListener('click', function () {
      q(sb().from('ecom_images').update({ archived_at: img.archived_at ? null : new Date().toISOString() }).eq('id', img.id)).then(function () { d.close(); done(); })
        .catch(function (e) { err.textContent = e.message; });
    });
    del.addEventListener('click', function () {
      if (!window.confirm('Delete this picture for good? Products that use it lose it.')) return;
      q(sb().from('ecom_images').delete().eq('id', img.id)).then(function () {
        sb().storage.from(BUCKET).remove([img.path]);
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
          pickImages({ max: 3, selected: refs, title: 'Reference pictures' }, function (ids) { refs = ids; refLine.textContent = ids.length ? ids.map(function (x) { return '#' + x; }).join(', ') : 'none'; });
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
    function load() {
      loadImages().then(function (all) {
        if (!grid) {
          box.innerHTML = '';
          grid = imageGrid(all, { tools: fileButton('Upload', function (files) { uploadFiles(files, line, function (ids) {
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

  /* 4. Products ------------------------------------------------------------ */
  var P_COLS = [C_ID, { k: 'parent_id', t: 'Parent', num: true }, { k: 'sku', t: 'SKU', mono: true }, { k: 'asin', t: 'ASIN', mono: true },
    { k: 'gtin', t: 'GTIN / EAN', mono: true }, { k: 'pzn', t: 'PZN', mono: true }, { k: 'title', t: 'Title', wide: true }, { k: '_brand', t: 'Brand' },
    { k: 'logistics', t: 'Logistics' }, { k: '_pics', t: 'Pictures', num: true }, { k: '_aplus', t: 'A+ versions', num: true }, { k: 'status', t: 'Status' }, C_UPDATED];

  function route(main) {
    var parts = location.hash.replace(/^#\/?/, '').split('/');   // pim-products / <id> / aplus / <version id>
    if (parts[1] && parts[2] === 'aplus' && parts[3]) return renderAplus(main, parseInt(parts[1], 10), parseInt(parts[3], 10));
    if (parts[1]) return renderProduct(main, parts[1] === 'new' ? null : parseInt(parts[1], 10));
    renderProducts(main);
  }

  function renderProducts(main) {
    A.header(main, 'Products');
    var w = wsOr(main); if (!w) return;
    var box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' }));
    main.append(h('div', { class: 'ecm-tools' }, [h('a', { class: 'ecm-btn ecm-btn--primary ecm-btn--small', href: '#/pim-products/new', text: '+ New product' })]), box);
    Promise.all([
      q(sb().from('ecom_products').select('id,parent_id,brand_id,sku,asin,gtin,pzn,title,logistics,image_ids,status,updated_at').eq('workspace_id', w.id).order('id', { ascending: false })),
      q(sb().from('ecom_brands').select('id,name').eq('workspace_id', w.id)),
      q(sb().from('ecom_aplus').select('product_id').eq('workspace_id', w.id))
    ]).then(function (res) {
      var brands = {}, ap = {};
      res[1].forEach(function (b) { brands[b.id] = b.name; });
      res[2].forEach(function (a) { ap[a.product_id] = (ap[a.product_id] || 0) + 1; });
      res[0].forEach(function (r) { r._brand = brands[r.brand_id] || ''; r._pics = (r.image_ids || []).length; r._aplus = ap[r.id] || 0; });
      box.innerHTML = '';
      box.appendChild(A.dataTable('pim-products', { title: 'Products', cols: P_COLS, onRow: function (r) { go('#/pim-products/' + r.id); } }, res[0], { label: w.name }).el);
    }).catch(function (e) { errorBox(box, e); });
  }

  /* 5. Product editor ------------------------------------------------------ */
  var PF = {
    sku: { k: 'sku', t: 'SKU', max: 100 },
    asin: { k: 'asin', t: 'ASIN', max: 10, upper: true, re: /^[A-Z0-9]{10}$/, reMsg: '10 letters or digits' },
    gtin: { k: 'gtin', t: 'GTIN / EAN', max: 14, re: /^[0-9]{8,14}$/, reMsg: '8 to 14 digits' },
    pzn: { k: 'pzn', t: 'PZN', max: 8, re: /^[0-9]{7,8}$/, reMsg: '7 or 8 digits' },
    title: { k: 'title', t: 'Title', max: 500, wide: true },
    content: { k: 'content', t: 'Content (description)', area: true, rows: 5, max: 10000, wide: true },
    details: { k: 'details', t: 'Details', area: true, rows: 3, max: 10000, wide: true },
    width_mm: { k: 'width_mm', t: 'Width (mm)', type: 'number', step: '0.1' },
    length_mm: { k: 'length_mm', t: 'Length (mm)', type: 'number', step: '0.1' },
    depth_mm: { k: 'depth_mm', t: 'Depth (mm)', type: 'number', step: '0.1' },
    weight_g: { k: 'weight_g', t: 'Weight (g)', type: 'number', step: '0.1' },
    logistics: { k: 'logistics', t: 'Logistics', opts: [['', '—'], ['FBA', 'FBA'], ['FBM', 'FBM']] },
    status: F_STATUS
  };
  var BULLETS = 5;

  function renderProduct(main, id) {
    var w = wsOr(main); if (!w) return;
    main.appendChild(h('a', { class: 'pim-back', href: '#/pim-products', text: '← Products' }));
    A.header(main, id ? 'Product #' + id : 'New product');
    var box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' }));
    main.appendChild(box);
    Promise.all([
      id ? q(sb().from('ecom_products').select('*').eq('id', id).maybeSingle()) : Promise.resolve(null),
      q(sb().from('ecom_brands').select('id,name,manufacturer_id').eq('workspace_id', w.id).order('name')),
      q(sb().from('ecom_manufacturers').select('id,name').eq('workspace_id', w.id)),
      q(sb().from('ecom_products').select('id,sku,title').eq('workspace_id', w.id).order('id', { ascending: false }).limit(1000)),
      id ? q(sb().from('ecom_aplus').select('id,version,name,locale,status,modules,updated_at').eq('product_id', id).order('version', { ascending: false })) : Promise.resolve([])
    ]).then(function (res) {
      var p = res[0], brands = res[1], mans = {}, others = res[3].filter(function (x) { return x.id !== id; }), versions = res[4];
      if (id && !p) { box.innerHTML = ''; box.appendChild(h('p', { class: 'ecm-error', text: 'This product does not exist (any more).' })); return; }
      res[2].forEach(function (m) { mans[m.id] = m.name; });
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
      var brand = h('select', { class: 'ecm-input', id: 'pim-brand' }, [h('option', { value: '', text: '— none —' })].concat(brands.map(function (b) {
        return h('option', { value: String(b.id), text: b.name + ' · ' + (mans[b.manufacturer_id] || 'manufacturer #' + b.manufacturer_id) }); })));
      brand.value = p.brand_id ? String(p.brand_id) : '';
      var ident = sect('Identification', ['sku', 'asin', 'gtin', 'pzn', 'logistics', 'status']);
      ident.querySelector('.pim-form').prepend(fieldRow({ t: 'Brand (and its manufacturer)' }, brand));
      ident.querySelector('.pim-form').prepend(fieldRow({ t: 'Parent product' }, parent));
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
        q(sb().from('ecom_images').select('id,path,title').in('id', pics)).then(function (rows) {
          var by = {}; rows.forEach(function (r) { by[r.id] = r; });
          return signed(rows.map(function (r) { return r.path; })).then(function () {
            slots.innerHTML = '';
            pics.forEach(function (pid, i) {
              var r = by[pid];
              slots.appendChild(h('div', { class: 'pim-slot' }, [
                r ? h('img', { src: urlCache[r.path] || '', alt: r.title || 'picture', class: 'pim-slot__img' }) : h('span', { class: 'pim-hint', text: 'missing #' + pid }),
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
      box.append(ident, sect('Content', ['title', 'content', 'details']), bulletBox, sect('Size and weight', ['width_mm', 'length_mm', 'depth_mm', 'weight_g']), picBox,
        h('div', { class: 'ecm-row pim-actions' }, [save, del, err].filter(Boolean)),
        id ? h('p', { class: 'pim-hint', text: 'ID ' + id + ' · created ' + A.fmtTime(p.created_at) + ' · updated ' + A.fmtTime(p.updated_at) }) : null);
      save.addEventListener('click', function () {
        var v = {}, msg = '';
        Object.keys(ctrls).forEach(function (k) { var x = readValue(PF[k], ctrls[k]); msg = msg || checkValue(PF[k], x); v[k] = x; });
        if (msg) { err.textContent = msg; return; }
        v.parent_id = parent.value ? parseInt(parent.value, 10) : null;
        v.brand_id = brand.value ? parseInt(brand.value, 10) : null;
        v.bullets = bullets.map(function (b) { return b.value.trim(); }).filter(Boolean);
        v.image_ids = pics.slice(0, 5);
        v.status = v.status || 'active';
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
      if (id) box.appendChild(aplusPanel(w, id, versions));
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

  function aplusPanel(w, pid, versions) {
    var cols = [{ k: 'version', t: 'Version', num: true }, { k: 'name', t: 'Name', wide: true }, { k: 'locale', t: 'Language' }, { k: 'status', t: 'Status' },
                { k: '_mods', t: 'Modules', num: true }, { k: 'updated_at', t: 'Updated', f: A.isoMinute }];
    versions.forEach(function (v) { v._mods = (v.modules || []).length; });
    function create(from) {
      var row = { workspace_id: w.id, product_id: pid, name: from ? from.name : 'A+ content', locale: from ? from.locale : 'de-DE', modules: from ? from.modules : [] };
      q(sb().from('ecom_aplus').insert(row).select('id,version').single()).then(function (r) {
        A.toast('Version ' + r.version + ' created.'); go('#/pim-products/' + pid + '/aplus/' + r.id);
      }).catch(function (e) { A.toast(e.message, 'act'); });
    }
    return h('fieldset', { class: 'pim-section' }, [h('legend', { text: 'A+ content (versions)' }),
      h('div', { class: 'ecm-tools' }, [h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: '+ New A+ version', onclick: function () { create(null); } }),
        versions.length ? h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Copy the newest as a new version', onclick: function () { create(versions[0]); } }) : null]),
      versions.length ? A.dataTable('aplus-' + pid, { title: 'A+ versions', cols: cols, onRow: function (r) { go('#/pim-products/' + pid + '/aplus/' + r.id); } }, versions, { label: 'product ' + pid }).el
                      : h('p', { class: 'pim-hint', text: 'No A+ content yet. A version holds up to 7 of Amazon\'s standard modules; make several versions and keep the one you submit.' })]);
  }

  function renderAplus(main, pid, vid) {
    var w = wsOr(main); if (!w) return;
    main.appendChild(h('a', { class: 'pim-back', href: '#/pim-products/' + pid, text: '← Product #' + pid }));
    var box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' }));
    main.appendChild(box);
    Promise.all([q(sb().from('ecom_aplus').select('*').eq('id', vid).maybeSingle()), q(sb().from('ecom_products').select('id,title,sku,asin').eq('id', pid).maybeSingle())]).then(function (res) {
      var v = res[0], p = res[1] || {};
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
        var ids = []; mods.forEach(function (m) { (m.blocks || []).forEach(function (b) { if (b.image_id) ids.push(b.image_id); }); });
        var draw = function (paths) {
          preview.innerHTML = '';
          preview.appendChild(h('p', { class: 'pim-hint', text: 'Preview (simplified)' }));
          if (!mods.length) preview.appendChild(h('p', { class: 'pim-hint', text: 'Add a module on the left.' }));
          mods.forEach(function (m) {
            var M = MODS[m.type] || MODS.text, el = h('section', { class: 'pim-pv pim-pv--' + m.type + (m.side === 'right' ? ' is-right' : '') });
            if (m.headline) el.appendChild(h('h3', { class: 'pim-pv__h', text: m.headline }));
            if (m.subheadline) el.appendChild(h('p', { class: 'pim-pv__sub', text: m.subheadline }));
            var grid = h('div', { class: 'pim-pv__blocks' });
            (m.blocks || []).forEach(function (b) {
              var src = b.image_id && paths[b.image_id] ? urlCache[paths[b.image_id]] : null;
              grid.appendChild(h('div', { class: 'pim-pv__block' }, [M.img ? (src ? h('img', { src: src, alt: b.headline || '' }) : h('div', { class: 'pim-pv__ph', text: M.img })) : null,
                b.headline ? h('strong', { text: b.headline }) : null, b.body ? h('p', { text: b.body }) : null]));
            });
            el.appendChild(grid);
            if (m.rows) el.appendChild(h('table', { class: 'ecm-table' }, h('tbody', null, m.rows.filter(function (r) { return r.name || r.value; }).map(function (r) {
              return h('tr', null, [h('th', { scope: 'row', text: r.name }), h('td', { text: r.value })]); }))));
            preview.appendChild(el);
          });
        };
        if (!ids.length) { draw({}); return; }
        q(sb().from('ecom_images').select('id,path').in('id', ids)).then(function (rows) {
          var paths = {}; rows.forEach(function (r) { paths[r.id] = r.path; });
          return signed(rows.map(function (r) { return r.path; })).then(function () { draw(paths); });
        }).catch(function () { draw({}); });
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
