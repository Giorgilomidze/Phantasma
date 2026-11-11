/* =========================================================================
   E-commerce automation (/ecommerce/) — C7 Ecommerce Platform, 10 Nov 2026.
   One IIFE, no build step (site rule). Routes in the hash: #/products, #/inventory,
   #/repeat, #/sales, #/finance, #/settings.
   Data: the ecom_* tables of supabase/0034 (read rules = members of the workspace);
   Amazon keys and syncing go through the Edge Function ecom-amazon only.
   Every text from the database is written with textContent (never innerHTML).
   1. Config  2. Helpers  3. Data  4. Shell  5. Data views  6. Settings
   7. Sync  8. Gate and boot
   ========================================================================= */
(function () {
  'use strict';

  /* 1. Config ------------------------------------------------------------- */
  // Same project and PUBLISHABLE key as ../script.js (publishable by design).
  var SUPABASE_URL = 'https://muumpjtpjnoxxdkhqtik.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_R6Ruxp1ehYAGVcFRqrM_Lg_n1ahoV8e';
  var FN = 'ecom-amazon';
  var TEST_NOTE = 'Test mode: at most 100 rows per data set and marketplace (your decision ED-05).';
  var MP = {
    ATVPDKIKX0DER: 'US', A2EUQ1WTGCTBG2: 'CA', A1AM78C64UM0Y8: 'MX', A2Q3Y263D00KWC: 'BR',
    A1F83G8C2ARO7P: 'UK', A1PA6795UKMFR9: 'DE', A13V1IB3VIYZZH: 'FR', APJ6JRA9NG5V4: 'IT', A1RKKUPIHCS9HS: 'ES',
    A1805IZSGTT6HS: 'NL', A2NODRKZP88ZB9: 'SE', A1C3SOZRARQ6R3: 'PL', AMEN7PMS3EDWL: 'BE', A33AVAJ2PDY3EV: 'TR',
    A28R8C7NBKEWEB: 'IE', ARBP9OOSHTCHU: 'EG', A17E79C6D8DWNP: 'SA', A2VIGQ35RCS4UG: 'AE', A21TJRUUN4KGV: 'IN',
    AE08WJ6YKNBMC: 'ZA', A1VC38T7YXB528: 'JP', A39IBJ37TRP1C6: 'AU', A19VAU5U5O7RUS: 'SG'
  };
  var REGIONS = [
    ['eu', 'Europe (UK, EU, Turkey, Middle East, India, Africa)'],
    ['na', 'North America (US, Canada, Mexico, Brazil)'],
    ['fe', 'Far East (Japan, Australia, Singapore)']
  ];
  var REGION_NAME = { eu: 'Europe', na: 'North America', fe: 'Far East' };
  var DATASET = { listings: 'Products (listings)', fba_inventory: 'FBA inventory', repeat_purchase: 'Repeat purchase', business: 'Business report', finances: 'Finance' };
  var STATUS = { queued: 'Waiting', running: 'Loading', waiting: 'Amazon is preparing', done: 'Done', no_data: 'No data', error: 'Error', cancelled: 'Stopped', ok: 'Keys work', new: 'New', disabled: 'Off' };
  var OPEN = { queued: 1, running: 1, waiting: 1 };

  var NAV = [
    { id: 'products', label: 'Products' },
    { id: 'inventory', label: 'FBA inventory' },
    { id: 'repeat', label: 'Repeat purchase' },
    { id: 'sales', label: 'Sales', soon: true },
    { id: 'finance', label: 'Finance', soon: true },
    { id: 'settings', label: 'Settings' }
  ];

  // Column helpers for the data views
  function mpCode(v) { return MP[v] || v || ''; }
  function fbaFbm(v) { if (!v) return ''; return /^AMAZON/i.test(v) ? 'FBA' : (v === 'DEFAULT' ? 'FBM' : v); }
  function inbound(r) { var n = (r.inbound_working || 0) + (r.inbound_shipped || 0) + (r.inbound_receiving || 0); return n || (r.inbound_working == null && r.inbound_shipped == null && r.inbound_receiving == null ? null : 0); }

  var VIEWS = {
    products: {
      title: 'Products', table: 'ecom_amz_listings', order: 'seller_sku',
      lede: 'Amazon\'s All Listings report: one row per SKU and marketplace. The base for product information.',
      cols: [
        { k: 'marketplace_id', t: 'Market', f: mpCode },
        { k: 'seller_sku', t: 'SKU', mono: true },
        { k: 'asin', t: 'ASIN', mono: true },
        { k: 'item_name', t: 'Title', wide: true },
        { k: 'price', t: 'Price', num: true },
        { k: 'currency', t: 'Cur.' },
        { k: 'quantity', t: 'Qty', num: true },
        { k: 'fulfillment_channel', t: 'Fulfilment', f: fbaFbm },
        { k: 'status', t: 'Status' },
        { k: 'open_date', t: 'Listed since' }
      ]
    },
    inventory: {
      title: 'FBA inventory', table: 'ecom_amz_fba_inventory', order: 'seller_sku',
      lede: 'Amazon\'s FBA stock per SKU (Inventory API), one snapshot per day.',
      cols: [
        { k: 'marketplace_id', t: 'Market', f: mpCode },
        { k: 'snapshot_date', t: 'Date' },
        { k: 'seller_sku', t: 'SKU', mono: true },
        { k: 'asin', t: 'ASIN', mono: true },
        { k: 'fnsku', t: 'FNSKU', mono: true },
        { k: 'product_name', t: 'Product', wide: true },
        { k: 'fulfillable', t: 'Available', num: true },
        { k: '_inbound', t: 'Inbound', num: true, calc: inbound },
        { k: 'reserved', t: 'Reserved', num: true },
        { k: 'unfulfillable', t: 'Unsellable', num: true },
        { k: 'researching', t: 'Researching', num: true },
        { k: 'total', t: 'Total', num: true }
      ],
      extra: ['inbound_working', 'inbound_shipped', 'inbound_receiving']
    },
    repeat: {
      title: 'Repeat purchase', table: 'ecom_amz_repeat_purchase', order: 'asin',
      lede: 'Brand Analytics: per ASIN and week (Sunday–Saturday) — orders, customers and how many came back.',
      cols: [
        { k: 'marketplace_id', t: 'Market', f: mpCode },
        { k: 'start_date', t: 'Week from' },
        { k: 'end_date', t: 'to' },
        { k: 'asin', t: 'ASIN', mono: true },
        { k: 'orders', t: 'Orders', num: true },
        { k: 'unique_customers', t: 'Customers', num: true },
        { k: 'repeat_customers_pct', t: 'Repeat customers %', num: true },
        { k: 'repeat_revenue', t: 'Repeat revenue', num: true },
        { k: 'currency', t: 'Cur.' },
        { k: 'repeat_revenue_pct', t: 'Repeat revenue %', num: true }
      ]
    }
  };

  var client = null, user = null, ws = null, conns = [], connId = null, started = false;
  var poll = { on: false, timer: null, last: null };

  /* 2. Helpers ------------------------------------------------------------ */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  function fmtNum(v, max) {
    if (v == null || v === '') return '';
    var n = Number(v);
    return isFinite(n) ? n.toLocaleString('en-GB', { maximumFractionDigits: max == null ? 2 : max }) : String(v);
  }
  function fmtTime(v) {
    if (!v) return '—';
    var d = new Date(v);
    return isNaN(d) ? String(v) : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function status(kind, text) { return h('span', { class: 'ecm-st ecm-st--' + kind, text: text || STATUS[kind] || kind }); }
  function toast(msg, kind) {
    var box = $('#ecm-toasts'); if (!box) return;
    var t = h('div', { class: 'ecm-toast' + (kind === 'act' ? ' ecm-toast--act' : ''), text: msg });
    box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, kind === 'act' ? 9000 : 5000);
  }
  // Pasted keys often carry spaces or quotes (an Excel cell can start with ').
  function cleanKey(v) {
    var s = String(v == null ? '' : v).trim();
    while (s.length > 1 && /^['"`]/.test(s)) s = s.slice(1).trim();
    while (s.length > 1 && /['"`]$/.test(s)) s = s.slice(0, -1).trim();
    return s;
  }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function csvDownload(name, head, rows) {
    var esc = function (v) { var s = v == null ? '' : String(v); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var lines = [head.map(esc).join(',')].concat(rows.map(function (r) { return r.map(esc).join(','); }));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* 3. Data --------------------------------------------------------------- */
  function rpc(name, args) {
    return client.rpc(name, args || {}).then(function (r) {
      if (r.error) throw new Error(r.error.message || 'error');
      return r.data;
    });
  }
  // The Edge Function; its own error text comes back in {error}.
  function callFn(body) {
    return client.functions.invoke(FN, { body: body }).then(function (r) {
      if (!r.error) return r.data;
      var ctx = r.error.context;
      if (ctx && typeof ctx.json === 'function') {
        return ctx.json().catch(function () { return {}; }).then(function (j) {
          throw new Error((j && j.error) || 'The server function is not reachable. Is ecom-amazon deployed?');
        });
      }
      throw new Error('The server function is not reachable. Is ecom-amazon deployed?');
    });
  }
  function isAdmin() { return !!ws && (ws.role === 'owner' || ws.role === 'admin'); }
  function current() { for (var i = 0; i < conns.length; i++) if (conns[i].id === connId) return conns[i]; return null; }
  function loadConnections() {
    return rpc('ecom_list_connections', { p_workspace: ws.id }).then(function (rows) {
      conns = (rows || []).filter(function (c) { return c.provider === 'amazon_sp_api'; });
      var saved = load('ecm_conn');
      if (!current()) connId = conns.some(function (c) { return c.id === saved; }) ? saved : (conns[0] ? conns[0].id : null);
      fillAccountSelect();
    });
  }
  function loadRows(view, conn) {
    var cfg = VIEWS[view];
    var cols = cfg.cols.filter(function (c) { return !c.calc; }).map(function (c) { return c.k; }).concat(cfg.extra || []);
    var all = [], page = 1000, cap = 5000;
    function next(from) {
      return client.from(cfg.table).select(cols.join(',')).eq('connection_id', conn.id).order(cfg.order)
        .range(from, from + page - 1).then(function (r) {
          if (r.error) throw new Error(r.error.message);
          all = all.concat(r.data || []);
          if ((r.data || []).length === page && all.length < cap) return next(from + page);
          return all;
        });
    }
    return next(0);
  }

  /* 4. Shell -------------------------------------------------------------- */
  function route() {
    var id = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
    if (!NAV.some(function (n) { return n.id === id; })) id = conns.length ? 'products' : 'settings';
    Array.prototype.forEach.call(document.querySelectorAll('.ecm-nav__link[data-id]'), function (a) {
      if (a.getAttribute('data-id') === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    closeNav();
    var main = $('#ecm-main');
    main.innerHTML = '';
    if (VIEWS[id]) viewData(id, main);
    else if (id === 'sales' || id === 'finance') viewSoon(id, main);
    else viewSettings(main);
    if (started) main.focus({ preventScroll: false });
  }
  function buildNav() {
    var ul = $('#ecm-nav'); ul.innerHTML = '';
    NAV.forEach(function (n) {
      ul.appendChild(h('li', null, h('a', { class: 'ecm-nav__link', href: '#/' + n.id, 'data-id': n.id }, [
        h('span', { text: n.label }), n.soon ? h('span', { class: 'ecm-nav__soon', text: 'next step' }) : null
      ])));
    });
  }
  function fillAccountSelect() {
    var sel = $('#ecm-account'); if (!sel) return;
    sel.innerHTML = '';
    if (!conns.length) { sel.appendChild(h('option', { value: '', text: 'No Amazon account yet' })); sel.disabled = true; return; }
    sel.disabled = false;
    conns.forEach(function (c) {
      sel.appendChild(h('option', { value: c.id, text: c.label + ' · ' + (c.account_type || '') + ' · ' + (REGION_NAME[c.region] || c.region || '') }));
    });
    sel.value = connId || '';
  }
  function openNav() { $('#ecm-app').classList.add('is-nav-open'); $('#ecm-scrim').hidden = false; $('#ecm-menu-btn').setAttribute('aria-expanded', 'true'); }
  function closeNav() { var app = $('#ecm-app'); if (!app) return; app.classList.remove('is-nav-open'); $('#ecm-scrim').hidden = true; $('#ecm-menu-btn').setAttribute('aria-expanded', 'false'); }
  function setTopOffset() { var bar = $('.ecm-topbar'); if (bar) document.documentElement.style.setProperty('--ecm-top', bar.offsetHeight + 'px'); }
  function wireShell() {
    $('#ecm-menu-btn').addEventListener('click', function () { if ($('#ecm-app').classList.contains('is-nav-open')) closeNav(); else openNav(); });
    $('#ecm-scrim').addEventListener('click', closeNav);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#ecm-app').classList.contains('is-nav-open')) { closeNav(); $('#ecm-menu-btn').focus(); } });
    $('#ecm-account').addEventListener('change', function () { connId = this.value || null; store('ecm_conn', connId || ''); route(); });
    $('#ecm-signout').addEventListener('click', function () {
      client.auth.signOut().then(function () { location.href = '../services.html'; }).catch(function () { location.reload(); });
    });
    window.addEventListener('hashchange', route);
    window.addEventListener('resize', setTopOffset);
    setTopOffset();
    wireFeedback();
  }
  // "Send feedback" opens the chat window on its Feedback view; without the window (career.js not loaded)
  // the e-mail link works as before. Career admins also get "Admin: messages" (all services arrive there).
  function wireFeedback() {
    var a = document.querySelector('[data-chat-open]');
    if (a) a.addEventListener('click', function (e) {
      if (!document.querySelector('.chat-dock:not([hidden])')) return;
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('phantasma:chat-open', { detail: { view: a.getAttribute('data-chat-open') } }));
    });
    client.rpc('is_career_admin').then(function (r) {
      if (!r || r.error || r.data !== true || !a || document.querySelector('.ecm-admin-link')) return;
      a.parentNode.insertBefore(h('a', { class: 'ecm-btn ecm-btn--ghost ecm-btn--small ecm-admin-link', href: '../admin.html#messages', text: 'Admin: messages' }), a);
    }, function () { /* not an admin, or offline: no link */ });
  }
  function header(main, title, lede) {
    main.appendChild(h('h1', { class: 'ecm-h1', text: title }));
    if (lede) main.appendChild(h('p', { class: 'ecm-lede', text: lede }));
  }
  function needAccount(main) {
    main.appendChild(h('div', { class: 'ecm-card ecm-empty' }, [
      h('p', { text: 'No Amazon account yet.' }),
      h('a', { class: 'ecm-btn ecm-btn--primary', href: '#/settings', text: isAdmin() ? 'Add an Amazon account' : 'Open Settings' })
    ]));
  }

  /* 5. Data views --------------------------------------------------------- */
  function viewData(id, main) {
    var cfg = VIEWS[id];
    header(main, cfg.title, cfg.lede);
    var conn = current();
    if (!conn) return needAccount(main);
    var box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' }));
    main.appendChild(box);
    loadRows(id, conn).then(function (rows) {
      box.innerHTML = '';
      if (!rows.length) {
        box.appendChild(h('div', { class: 'ecm-card ecm-empty' }, [
          h('p', { text: 'No data yet for ' + conn.label + '.' }),
          h('a', { class: 'ecm-btn ecm-btn--primary', href: '#/settings', text: 'Go to Settings → Sync now' })
        ]));
        return;
      }
      box.appendChild(dataTable(id, cfg, rows, conn));
      box.appendChild(h('p', { class: 'ecm-note', text: TEST_NOTE + (conn.last_sync_at ? ' Last sync: ' + fmtTime(conn.last_sync_at) + '.' : '') }));
    }).catch(function (e) {
      box.innerHTML = '';
      box.appendChild(h('p', { class: 'ecm-error', role: 'alert', text: 'Could not load the data: ' + e.message }));
    });
  }

  function cellValue(c, r) {
    var v = c.calc ? c.calc(r) : r[c.k];
    return c.f ? c.f(v) : v;
  }
  function dataTable(id, cfg, rows, conn) {
    var st = { mp: '', q: '', sort: null, dir: 1 };
    var mps = {};
    rows.forEach(function (r) { if (r.marketplace_id) mps[r.marketplace_id] = 1; });
    var mpSel = h('select', { class: 'ecm-input', id: 'ecm-f-mp-' + id, 'aria-label': 'Marketplace' }, [h('option', { value: '', text: 'All marketplaces' })]
      .concat(Object.keys(mps).sort(function (a, b) { return mpCode(a).localeCompare(mpCode(b)); }).map(function (m) { return h('option', { value: m, text: mpCode(m) }); })));
    var search = h('input', { class: 'ecm-input', type: 'search', placeholder: 'Search', 'aria-label': 'Search this table' });
    var count = h('span', { class: 'ecm-tools__count', 'aria-live': 'polite' });
    var csvBtn = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Download for Excel (CSV)' });
    var thead = h('thead'), tbody = h('tbody');
    var table = h('table', { class: 'ecm-table' }, [h('caption', { class: 'visually-hidden', text: cfg.title + ' of ' + conn.label }), thead, tbody]);
    var shown = [];

    function headRow() {
      thead.innerHTML = '';
      var tr = h('tr');
      cfg.cols.forEach(function (c) {
        var on = st.sort === c.k;
        var th = h('th', { scope: 'col', class: c.num ? 'is-num' : null, 'aria-sort': on ? (st.dir > 0 ? 'ascending' : 'descending') : 'none' });
        th.appendChild(h('button', { type: 'button', class: 'ecm-sort', onclick: function () {
          if (st.sort !== c.k) { st.sort = c.k; st.dir = 1; } else if (st.dir > 0) st.dir = -1; else { st.sort = null; st.dir = 1; }
          apply();
        } }, [c.t, h('span', { class: 'ecm-sort__arrow', 'aria-hidden': 'true', text: on ? (st.dir > 0 ? '▲' : '▼') : '↕' })]));
        tr.appendChild(th);
      });
      thead.appendChild(tr);
    }
    function apply() {
      var q = st.q.toLowerCase();
      shown = rows.filter(function (r) {
        if (st.mp && r.marketplace_id !== st.mp) return false;
        if (!q) return true;
        return cfg.cols.some(function (c) { var v = cellValue(c, r); return v != null && String(v).toLowerCase().indexOf(q) >= 0; });
      });
      if (st.sort) {
        var c = cfg.cols.filter(function (x) { return x.k === st.sort; })[0];
        shown.sort(function (a, b) {
          var x = cellValue(c, a), y = cellValue(c, b);
          if (x == null || x === '') return 1; if (y == null || y === '') return -1;   // empty values last
          return (c.num ? (Number(x) - Number(y)) : String(x).localeCompare(String(y), 'en', { numeric: true })) * st.dir;
        });
      }
      headRow();
      tbody.innerHTML = '';
      shown.slice(0, 2000).forEach(function (r) {
        var tr = h('tr');
        cfg.cols.forEach(function (c) {
          var v = cellValue(c, r);
          var cls = [c.num ? 'is-num' : '', c.wide ? 'is-wide' : '', c.mono ? 'ecm-mono' : ''].join(' ').trim() || null;
          tr.appendChild(h('td', { class: cls, text: c.num ? fmtNum(v) : (v == null ? '' : String(v)) }));
        });
        tbody.appendChild(tr);
      });
      count.textContent = 'Showing ' + shown.length + ' of ' + rows.length + (shown.length > 2000 ? ' (first 2,000 on screen; the download has all)' : '');
    }
    mpSel.addEventListener('change', function () { st.mp = this.value; apply(); });
    search.addEventListener('input', function () { st.q = this.value.trim(); apply(); });
    csvBtn.addEventListener('click', function () {
      csvDownload('ecommerce-' + id + '-' + new Date().toISOString().slice(0, 10) + '.csv',
        cfg.cols.map(function (c) { return c.t; }),
        shown.map(function (r) { return cfg.cols.map(function (c) { return cellValue(c, r); }); }));
    });
    apply();
    return h('div', null, [h('div', { class: 'ecm-tools' }, [mpSel, search, csvBtn, count]), h('div', { class: 'ecm-tablewrap' }, table)]);
  }

  function viewSoon(id, main) {
    var isSales = id === 'sales';
    header(main, isSales ? 'Sales' : 'Finance');
    main.appendChild(h('div', { class: 'ecm-card ecm-card--soft' }, [
      h('p', { text: 'Not in the test run (your decision ED-05, 10 Nov 2026).' }),
      h('p', { class: 'ecm-note', text: isSales
        ? 'Comes from Amazon\'s Business Report (sales and traffic per SKU and day; sales include VAT). The table is ready in the database; it fills in the next step.'
        : 'Comes from Amazon\'s financial events (order payments, refunds, fees). The table is ready in the database; it fills in the next step.' })
    ]));
  }

  /* 6. Settings ----------------------------------------------------------- */
  function viewSettings(main) {
    header(main, 'Settings', 'Amazon accounts, syncing, your team and the other connections.');
    var accCard = h('section', { class: 'ecm-card', 'aria-labelledby': 'ecm-acc-h' });
    var syncCard = h('section', { class: 'ecm-card', 'aria-labelledby': 'ecm-sync-h', id: 'ecm-sync' });
    var teamCard = h('section', { class: 'ecm-card', 'aria-labelledby': 'ecm-team-h' });
    var soonCard = h('section', { class: 'ecm-card ecm-card--soft', 'aria-labelledby': 'ecm-soon-h' });
    main.appendChild(accCard); main.appendChild(syncCard); main.appendChild(teamCard); main.appendChild(soonCard);
    renderAccounts(accCard);
    renderSync(syncCard);
    renderTeam(teamCard);
    renderSoon(soonCard);
  }

  function renderAccounts(card) {
    card.innerHTML = '';
    card.appendChild(h('h2', { class: 'ecm-h2', id: 'ecm-acc-h', text: 'Amazon accounts' }));
    var list = h('div', { class: 'ecm-accounts' });
    if (!conns.length) list.appendChild(h('p', { class: 'ecm-note', text: 'None yet. A workspace can hold several seller or vendor accounts.' }));
    conns.forEach(function (c) { list.appendChild(accountItem(c, card)); });
    card.appendChild(list);
    if (isAdmin()) {
      var formBox = h('div');
      var addBtn = h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary', 'aria-expanded': 'false', text: '+ Add Amazon account' });
      addBtn.addEventListener('click', function () {
        var open = addBtn.getAttribute('aria-expanded') === 'true';
        addBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
        formBox.innerHTML = '';
        if (!open) { formBox.appendChild(addForm(card, addBtn)); var f = formBox.querySelector('input'); if (f) f.focus(); }
      });
      card.appendChild(h('div', { class: 'ecm-row', style: 'margin-top: var(--space-4)' }, addBtn));
      card.appendChild(formBox);
      if (!conns.length) addBtn.click();
    } else {
      card.appendChild(h('p', { class: 'ecm-note', text: 'Only an owner or admin of this workspace can add or remove accounts.' }));
    }
  }

  function accountItem(c, card) {
    var mps = (c.marketplaces || []).map(function (m) { return m.country || mpCode(m.id); });
    var item = h('article', { class: 'ecm-account' + (c.id === connId ? ' is-current' : ''), 'aria-label': c.label });
    item.appendChild(h('div', { class: 'ecm-account__head' }, [
      h('span', { class: 'ecm-account__name', text: c.label }),
      status(c.status === 'ok' ? 'ok' : c.status, c.status === 'error' ? 'Keys failed' : null)
    ]));
    item.appendChild(h('div', { class: 'ecm-account__meta' }, [
      h('span', { text: (c.account_type === 'vendor' ? 'Vendor' : 'Seller') + ' · ' + (REGION_NAME[c.region] || c.region || '') }),
      h('span', { text: 'Keys …' + String(c.key_hint || '').replace(/^…/, '') }),
      h('span', { text: 'Checked ' + fmtTime(c.last_checked_at) }),
      h('span', { text: 'Last sync ' + fmtTime(c.last_sync_at) })
    ]));
    if (mps.length) item.appendChild(h('ul', { class: 'ecm-chips', 'aria-label': 'Marketplaces' }, mps.map(function (m) { return h('li', { class: 'ecm-chip', text: m }); })));
    if (c.status === 'error' && c.status_message) item.appendChild(h('p', { class: 'ecm-error', text: c.status_message }));
    var row = h('div', { class: 'ecm-row' });
    if (c.account_type === 'seller') {
      row.appendChild(h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary ecm-btn--small', text: 'Sync now (test)', onclick: function () { selectConn(c.id); startSync(); } }));
    }
    row.appendChild(h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Check keys', onclick: function (e) { checkKeys(c, e.currentTarget, card); } }));
    if (isAdmin()) {
      row.appendChild(h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Rename', onclick: function () { renameConn(c, card); } }));
      row.appendChild(h('button', { type: 'button', class: 'ecm-btn ecm-btn--danger ecm-btn--small', text: 'Remove', onclick: function () { removeConn(c, card); } }));
    }
    item.appendChild(row);
    return item;
  }

  function selectConn(id) { connId = id; store('ecm_conn', id); fillAccountSelect(); }

  function addForm(card, addBtn) {
    var err = h('p', { class: 'ecm-error', role: 'alert' });
    var name = h('input', { class: 'ecm-input', id: 'ecm-a-name', maxlength: '80', required: true, autocomplete: 'off', placeholder: 'e.g. SIRA Europe' });
    var seller = h('input', { type: 'radio', name: 'ecm-a-type', value: 'seller', checked: true });
    var vendor = h('input', { type: 'radio', name: 'ecm-a-type', value: 'vendor' });
    var region = h('select', { class: 'ecm-input', id: 'ecm-a-region' }, REGIONS.map(function (r) { return h('option', { value: r[0], text: r[1] }); }));
    var keyAttrs = function (id, type) { return { class: 'ecm-input ecm-mono', id: id, type: type, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', required: true, 'aria-describedby': id + '-hint' }; };
    var cid = h('input', keyAttrs('ecm-a-cid', 'text'));
    var sec = h('input', keyAttrs('ecm-a-sec', 'password'));
    var tok = h('input', keyAttrs('ecm-a-tok', 'password'));
    var go = h('button', { type: 'submit', class: 'ecm-btn ecm-btn--primary', text: 'Check with Amazon and save' });
    var cancel = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost', text: 'Cancel', onclick: function () { addBtn.click(); addBtn.focus(); } });
    function field(label, input, hintId, hint) {
      return h('div', { class: 'ecm-field' }, [h('label', { for: input.id, text: label }), input, hint ? h('span', { class: 'ecm-hint', id: hintId, text: hint }) : null]);
    }
    var form = h('form', { class: 'ecm-form ecm-card ecm-card--soft', style: 'margin-top: var(--space-4)', novalidate: true }, [
      h('h3', { class: 'ecm-h2', text: 'Add Amazon account' }),
      field('Name', name, null, null),
      h('div', { class: 'ecm-field' }, h('fieldset', null, [h('legend', { text: 'Account type' }), h('div', { class: 'ecm-radios' }, [
        h('label', null, [seller, 'Seller']), h('label', null, [vendor, 'Vendor (data later)'])])])),
      field('Region', region, null, null),
      field('LWA client ID', cid, 'ecm-a-cid-hint', 'Starts with amzn1.application-oa2-client.'),
      field('Client secret', sec, 'ecm-a-sec-hint', 'Starts with amzn1.oa2-cs.'),
      field('Refresh token', tok, 'ecm-a-tok-hint', 'Starts with Atzr|'),
      h('p', { class: 'ecm-note', text: 'Where to find them: Seller Central → Apps and Services → Develop Apps → your app (LWA credentials; Authorize → refresh token). We check them with Amazon first, then store them encrypted. Nobody can read them back here; only the last 4 characters are shown.' }),
      h('div', { class: 'ecm-row' }, [go, cancel]),
      err
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.textContent = '';
      var body = {
        action: 'connect', workspace_id: ws.id, label: name.value.trim(),
        account_type: vendor.checked ? 'vendor' : 'seller', region: region.value,
        client_id: cleanKey(cid.value), client_secret: cleanKey(sec.value), refresh_token: cleanKey(tok.value)
      };
      if (!body.label) { err.textContent = 'Give the account a name.'; name.focus(); return; }
      if (!body.client_id || !body.client_secret || !body.refresh_token) { err.textContent = 'All three keys are needed.'; return; }
      go.disabled = true; go.textContent = 'Checking with Amazon…';
      callFn(body).then(function (res) {
        cid.value = ''; sec.value = ''; tok.value = '';   // keys leave the page
        var n = (res.marketplaces || []).length;
        toast('Connected: ' + body.label + (n ? ' — ' + n + (n === 1 ? ' marketplace' : ' marketplaces') : '') + (res.note ? '. ' + res.note : ''));
        connId = res.connection_id; store('ecm_conn', connId);
        return loadConnections().then(function () { renderAccounts(card); var s = $('#ecm-sync'); if (s) renderSync(s); });
      }).catch(function (e2) {
        err.textContent = e2.message;
        go.disabled = false; go.textContent = 'Check with Amazon and save';
      });
    });
    return form;
  }

  function checkKeys(c, btn, card) {
    btn.disabled = true; btn.textContent = 'Checking…';
    callFn({ action: 'test', connection_id: c.id }).then(function (res) {
      toast(res.ok ? 'The keys of ' + c.label + ' work.' : 'Amazon refused the keys of ' + c.label + ': ' + res.error, res.ok ? null : 'act');
      return loadConnections().then(function () { renderAccounts(card); });
    }).catch(function (e) { toast(e.message, 'act'); btn.disabled = false; btn.textContent = 'Check keys'; });
  }
  function renameConn(c, card) {
    var v = window.prompt('New name for this account', c.label);
    if (v == null) return;
    rpc('ecom_rename_connection', { p_connection: c.id, p_label: v }).then(function () {
      return loadConnections().then(function () { renderAccounts(card); });
    }).catch(function (e) { toast(e.message, 'act'); });
  }
  function removeConn(c, card) {
    if (!window.confirm('Remove "' + c.label + '"? Its keys and every row loaded through it are deleted. This cannot be undone.')) return;
    rpc('ecom_delete_connection', { p_connection: c.id }).then(function () {
      toast('Removed ' + c.label + ' with its keys and data.');
      if (connId === c.id) connId = null;
      return loadConnections().then(function () { renderAccounts(card); var s = $('#ecm-sync'); if (s) renderSync(s); });
    }).catch(function (e) { toast(e.message, 'act'); });
  }

  function renderTeam(card) {
    card.innerHTML = '';
    card.appendChild(h('h2', { class: 'ecm-h2', id: 'ecm-team-h', text: 'Team' }));
    var box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' }));
    card.appendChild(box);
    rpc('ecom_list_members', { p_workspace: ws.id }).then(function (rows) {
      box.innerHTML = '';
      var tbody = h('tbody');
      (rows || []).forEach(function (m) {
        var tr = h('tr', null, [h('td', { text: m.email }), h('td', { text: m.role }), h('td', { text: fmtTime(m.added_at) })]);
        var td = h('td');
        if (isAdmin() && m.role !== 'owner') {
          td.appendChild(h('button', { type: 'button', class: 'ecm-btn ecm-btn--danger ecm-btn--small', text: 'Remove', onclick: function () {
            if (!window.confirm('Remove ' + m.email + ' from this workspace?')) return;
            rpc('ecom_remove_member', { p_workspace: ws.id, p_user: m.user_id }).then(function () { renderTeam(card); }).catch(function (e) { toast(e.message, 'act'); });
          } }));
        }
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
      box.appendChild(h('div', { class: 'ecm-tablewrap' }, h('table', { class: 'ecm-table' }, [
        h('caption', { class: 'visually-hidden', text: 'Members of this workspace' }),
        h('thead', null, h('tr', null, ['Email', 'Role', 'Added', ''].map(function (t) { return h('th', { scope: 'col', text: t }); }))),
        tbody
      ])));
      if (isAdmin()) {
        var email = h('input', { class: 'ecm-input', type: 'email', id: 'ecm-m-email', autocomplete: 'off', placeholder: 'name@example.com' });
        var role = h('select', { class: 'ecm-input', 'aria-label': 'Role' }, [h('option', { value: 'member', text: 'Member (sees data, can sync)' }), h('option', { value: 'admin', text: 'Admin (also accounts and team)' })]);
        var err = h('p', { class: 'ecm-error', role: 'alert' });
        var add = h('button', { type: 'submit', class: 'ecm-btn ecm-btn--ghost', text: 'Add to the team' });
        var form = h('form', { class: 'ecm-row', style: 'margin-top: var(--space-4)', novalidate: true }, [h('label', { class: 'visually-hidden', for: 'ecm-m-email', text: 'Email' }), email, role, add]);
        form.addEventListener('submit', function (e) {
          e.preventDefault(); err.textContent = '';
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { err.textContent = 'Type a valid email address.'; return; }
          add.disabled = true;
          rpc('ecom_add_member', { p_workspace: ws.id, p_email: email.value.trim(), p_role: role.value }).then(function () {
            toast('Added ' + email.value.trim() + '.'); renderTeam(card);
          }).catch(function (e2) { err.textContent = e2.message; add.disabled = false; });
        });
        box.appendChild(form);
        box.appendChild(err);
        box.appendChild(h('p', { class: 'ecm-note', text: 'The person must have signed in once on solvephantasma.com (for example with Google). Adding them also lets them into this service.' }));
      }
    }).catch(function (e) { box.innerHTML = ''; box.appendChild(h('p', { class: 'ecm-error', text: e.message })); });
  }

  function renderSoon(card) {
    card.innerHTML = '';
    card.appendChild(h('h2', { class: 'ecm-h2', id: 'ecm-soon-h', text: 'Other connections — coming soon' }));
    var items = [
      ['Shopify', 'Products, stock and orders of a Shopify store (read-only).'],
      ['Google Drive', 'Import a file into the platform or export a table to Drive.'],
      ['Slack', 'Tasks and messages from your Slack workspace.'],
      ['Notion', 'Tasks and pages from your Notion workspace.'],
      ['monday.com', 'Tasks and boards from monday.com.'],
      ['ClickUp', 'Tasks and lists from ClickUp.']
    ];
    card.appendChild(h('div', { class: 'ecm-soon' }, items.map(function (it) {
      return h('div', { class: 'ecm-soon__card' }, [
        h('span', { class: 'ecm-soon__name', text: it[0] }),
        h('span', { class: 'ecm-note', text: it[1] }),
        h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', 'aria-disabled': 'true', text: 'Coming soon',
          onclick: function () { toast(it[0] + ' comes in a later step.'); } })
      ]);
    })));
  }

  /* 7. Sync --------------------------------------------------------------- */
  function renderSync(card, data) {
    card.innerHTML = '';
    card.appendChild(h('h2', { class: 'ecm-h2', id: 'ecm-sync-h', text: 'Sync' }));
    var conn = current();
    if (!conn) { card.appendChild(h('p', { class: 'ecm-note', text: 'Add an Amazon account first.' })); return; }
    card.appendChild(h('p', { class: 'ecm-note', text: 'Account: ' + conn.label + '. ' + TEST_NOTE + ' Data sets in the test run: listings, FBA inventory, repeat purchase (last full week). Amazon prepares reports in a few minutes; you can leave this page and come back.' }));
    var jobs = data ? data.jobs : null;
    var open = (jobs || []).filter(function (j) { return OPEN[j.status]; }).length;
    var row = h('div', { class: 'ecm-row', style: 'margin: var(--space-3) 0' });
    if (conn.account_type === 'seller') {
      row.appendChild(h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary', text: open ? 'Syncing…' : 'Sync now (test)', disabled: !!open, onclick: startSync }));
      if (open) row.appendChild(h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost', text: 'Stop', onclick: stopSync }));
    } else {
      row.appendChild(h('p', { class: 'ecm-note', text: 'Vendor data comes in a later step (decision ED-10).' }));
    }
    card.appendChild(row);
    if (!jobs) {
      if (!poll.on) {
        // Show the latest run, and continue it if it is still open.
        client.from('ecom_sync_jobs').select('run_id').eq('connection_id', conn.id).order('created_at', { ascending: false }).limit(1).then(function (r) {
          if (r.error || !r.data || !r.data.length) return;
          return client.from('ecom_sync_jobs').select('id,dataset,marketplace_id,status,rows_written,message,updated_at,finished_at')
            .eq('connection_id', conn.id).eq('run_id', r.data[0].run_id).order('created_at').then(function (r2) {
              if (r2.error || current() !== conn) return;
              var d = { jobs: r2.data || [] };
              renderSync(card, d);
              if (d.jobs.some(function (j) { return OPEN[j.status]; })) runPoll();
            });
        });
      }
      return;
    }
    var done = jobs.length - open;
    var pct = jobs.length ? Math.round(done * 100 / jobs.length) : 0;
    card.appendChild(h('div', { class: 'ecm-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': 'Sync progress' },
      h('span', { style: 'width:' + pct + '%' })));
    card.appendChild(h('p', { class: 'ecm-note', 'aria-live': 'polite', text: done + ' of ' + jobs.length + ' finished' + (open ? '…' : '.') }));
    var tbody = h('tbody');
    jobs.forEach(function (j) {
      tbody.appendChild(h('tr', null, [
        h('td', { text: DATASET[j.dataset] || j.dataset }),
        h('td', { text: mpCode(j.marketplace_id) }),
        h('td', null, status(j.status)),
        h('td', { class: 'is-num', text: j.rows_written ? fmtNum(j.rows_written, 0) : '' }),
        h('td', { class: 'is-wide', text: j.message || '' }),
        h('td', { text: fmtTime(j.finished_at || j.updated_at) })
      ]));
    });
    card.appendChild(h('div', { class: 'ecm-tablewrap' }, h('table', { class: 'ecm-table' }, [
      h('caption', { class: 'visually-hidden', text: 'Jobs of the latest sync' }),
      h('thead', null, h('tr', null, ['Data set', 'Market', 'Status', 'Rows', 'Message', 'Time'].map(function (t, i) { return h('th', { scope: 'col', class: i === 3 ? 'is-num' : null, text: t }); }))),
      tbody
    ])));
  }
  function syncCard() { return $('#ecm-sync'); }
  function startSync() {
    var conn = current(); if (!conn) return;
    if (location.hash !== '#/settings') location.hash = '#/settings';
    callFn({ action: 'sync', connection_id: conn.id }).then(function (res) {
      if (res.already_running) toast('A sync of this account is already running.');
      var c = syncCard(); if (c) renderSync(c, res);
      runPoll();
    }).catch(function (e) { toast(e.message, 'act'); });
  }
  function stopSync() {
    var conn = current(); if (!conn) return;
    callFn({ action: 'cancel', connection_id: conn.id }).then(function (res) {
      poll.on = false; clearTimeout(poll.timer);
      var c = syncCard(); if (c) renderSync(c, res);
    }).catch(function (e) { toast(e.message, 'act'); });
  }
  // Calls "step" until no job is open; each call moves Amazon's reports on for up to ~35 s.
  function runPoll() {
    if (poll.on) return;
    poll.on = true;
    var conn = current();
    (function tick() {
      if (!poll.on || current() !== conn) { poll.on = false; return; }
      callFn({ action: 'step', connection_id: conn.id }).then(function (res) {
        var c = syncCard(); if (c && current() === conn) renderSync(c, res);
        var open = (res.jobs || []).some(function (j) { return OPEN[j.status]; });
        if (open) { poll.timer = setTimeout(tick, 5000); return; }
        poll.on = false;
        toast('Sync finished for ' + conn.label + '.');
        loadConnections().then(function () {
          var acc = $('[aria-labelledby="ecm-acc-h"]'); if (acc) renderAccounts(acc);
        });
      }).catch(function (e) {
        toast(e.message, 'act');
        poll.timer = setTimeout(tick, 15000);   // keep trying: the page may have lost the connection for a moment
      });
    })();
  }

  /* 8. Gate and boot ------------------------------------------------------ */
  function showGate(kind, detail) {
    $('#ecm-app').hidden = true;
    var g = $('#ecm-gate'); g.hidden = false; g.innerHTML = '';
    var text = {
      login: ['Please sign in', 'This service needs your Solve Phantasma login. Sign in on the Services page and open "E-commerce automation" again.'],
      denied: ['No access yet', 'This service is in a private test. Ask Phantasma to let your account in.'],
      error: ['Something went wrong', 'The page could not check your access. Try again in a moment.' + (detail ? ' (' + detail + ')' : '')]
    }[kind];
    var card = h('div', { class: 'ecm-card ecm-gate__card' }, [h('h1', { class: 'ecm-h1', text: text[0] }), h('p', { text: text[1] })]);
    if (kind === 'login') card.appendChild(h('a', { class: 'ecm-btn ecm-btn--primary', href: '../services.html', text: 'Go to the Services page' }));
    else if (kind === 'error') card.appendChild(h('button', { type: 'button', class: 'ecm-btn ecm-btn--primary', text: 'Try again', onclick: function () { location.reload(); } }));
    else card.appendChild(h('a', { class: 'ecm-btn ecm-btn--ghost', href: '../services.html', text: 'Back to the services' }));
    g.appendChild(card);
  }
  function start(session, boot) {
    if (started) return;
    user = session.user;
    ws = (boot.workspaces || [])[0];
    if (!ws) return showGate('error', 'no workspace');
    loadConnections().then(function () {
      started = true;
      $('#ecm-user').textContent = user.email || '';
      buildNav(); wireShell();
      $('#ecm-gate').hidden = true; $('#ecm-app').hidden = false;
      setTopOffset();
      route();
    }).catch(function (e) { showGate('error', e.message); });
  }
  function boot() {
    if (!window.supabase || !window.supabase.createClient) return showGate('error', 'library missing');   // fail closed
    try { client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch (e) { return showGate('error'); }
    // The website's Messages + Feedback window (../career.js, loaded after this file; 11 Nov 2026) reaches
    // Supabase through this client, as the job-search pages do through script.js and the tender pages through
    // their app.js. Set before career.js starts (its DOMContentLoaded listener runs after this one).
    var current = null;
    window.PhantasmaAuth = { db: function () { return client; }, session: function () { return current; } };
    client.auth.onAuthStateChange(function (ev, s) {
      current = s || null;
      document.dispatchEvent(new CustomEvent('phantasma:auth', { detail: { event: ev, session: current } }));
    });
    client.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      if (res.error) return showGate('error');
      if (!s) return showGate('login');
      // Invite-only while private (decision ED-02): the database says yes or no; fail closed.
      return rpc('ecom_bootstrap').then(function (b) {
        if (!b || b.access !== true) return showGate('denied');
        start(s, b);
      });
    }).catch(function (e) { showGate('error', e && e.message); });
    client.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT' && started) location.href = '../services.html'; });
    // A signed-in person without access (gate "No access") can still write to the team through the chat window.
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
