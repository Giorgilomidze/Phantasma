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
  var DATASET = { listings: 'Products (listings)', fba_inventory: 'FBA inventory', inventory_ledger: 'Stock development (ledger)', repeat_purchase: 'Repeat purchase', business: 'Business report', finances: 'Finance' };
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
  // "EU" = the Pan-European FBA stock, stored once for DE FR IT ES NL SE PL BE (owner decision ED-14, 11 Nov 2026)
  function mpCode(v) { return v === 'EU' ? 'EU pool' : (MP[v] || v || ''); }
  function fbaFbm(v) { if (!v) return ''; return /^AMAZON/i.test(v) ? 'FBA' : (v === 'DEFAULT' ? 'FBM' : v); }
  // Amazon gives repeat-purchase shares as fractions (0.0122 = 1.22 %), shown as percent
  function pct100(v) { return v == null ? null : Math.round(v * 10000) / 100; }
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
      lede: 'Amazon\'s FBA stock per SKU (Inventory API), one snapshot per day. The shared European stock (DE, FR, IT, ES, NL, SE, PL, BE) shows once as "EU pool"; UK and other countries have their own.',
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
        { k: 'repeat_customers_pct', t: 'Repeat customers %', num: true, f: pct100 },
        { k: 'repeat_revenue', t: 'Repeat revenue', num: true },
        { k: 'currency', t: 'Cur.' },
        { k: 'repeat_revenue_pct', t: 'Repeat revenue %', num: true, f: pct100 }
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
  // Since 11 Nov 2026 (owner: "more visuals — date-based trends, KPI totals, date filters; stock development"):
  // each view has one filter bar (marketplace + date range) that drives its KPI tiles, charts and table.
  // Totals come from ecom_amz_stats (supabase/0036): the server function adds up Amazon's WHOLE files there,
  // while the row tables keep a test sample of ≤ 100 rows (ED-05). Without 0036 the views count the sample.
  var statsCache = {};
  function loadStats(conn, force) {
    if (!force && statsCache[conn.id]) return statsCache[conn.id];
    var all = [], page = 1000;
    function next(from) {
      return client.from('ecom_amz_stats').select('marketplace_id,dataset,period_start,period_end,dim,metrics')
        .eq('connection_id', conn.id).order('period_start').range(from, from + page - 1).then(function (r) {
          if (r.error) return null;                       // table missing (0036 not run): fall back to the sample
          all = all.concat(r.data || []);
          return (r.data || []).length === page && all.length < 20000 ? next(from + page) : all;
        });
    }
    statsCache[conn.id] = next(0).catch(function () { return null; });
    return statsCache[conn.id];
  }

  function uniq(a) { var s = {}, out = []; a.forEach(function (x) { if (x != null && !s[x]) { s[x] = 1; out.push(x); } }); return out; }
  function fmtInt(v) { return v == null ? '—' : Number(v).toLocaleString('en-GB', { maximumFractionDigits: 0 }); }
  function fmtShort(v) {
    var a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(Math.round(v * 100) / 100);
  }
  function pctOf(a, b) { return b ? (a * 100 / b).toFixed(1) + ' %' : '—'; }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtMonth(m) { var p = String(m).split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0].slice(2); }
  function fmtDay(d) { var p = String(d).split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1]; }
  function isoDay(dt) { return dt.toISOString().slice(0, 10); }
  // Listing open dates come as "2019-05-02 …", "02.05.2019 …" or "02/05/2019" (EU reports day-first) → "2019-05-02"
  function dateOfListing(v) {
    var s = String(v || '').trim(), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s);
    if (!m) return null;
    var a = +m[1], b = +m[2], mon = b > 12 ? a : b, day = b > 12 ? b : a;
    return m[3] + '-' + String(mon).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }
  // The newest period per marketplace of one data set (dim '').
  function latestBy(stats, ds) {
    var best = {};
    (stats || []).forEach(function (s) {
      if (s.dataset !== ds || s.dim) return;
      var b = best[s.marketplace_id];
      if (!b || s.period_end > b.period_end) best[s.marketplace_id] = s;
    });
    return Object.keys(best).map(function (k) { return best[k]; });
  }
  function moneyBy(map) {
    var keys = Object.keys(map).filter(function (c) { return map[c]; });
    return keys.length ? keys.map(function (c) { return fmtInt(map[c]) + ' ' + (c === 'null' ? '' : c); }).join(' · ') : '—';
  }

  // ---- filter bar: marketplace (+ an optional extra select) and a date range with presets
  function filterBar(opts, onChange) {
    var st = { mp: '', from: '', to: '' };
    var mpSel = h('select', { class: 'ecm-input', 'aria-label': opts.mpLabel || 'Marketplace' },
      [h('option', { value: '', text: opts.allLabel || 'All marketplaces' })].concat(opts.mps.slice().sort(function (a, b) {
        return mpCode(a).localeCompare(mpCode(b));
      }).map(function (m) { return h('option', { value: m, text: mpCode(m) }); })));
    var from = h('input', { class: 'ecm-input', type: 'date', 'aria-label': 'From date' });
    var to = h('input', { class: 'ecm-input', type: 'date', 'aria-label': 'To date' });
    var presetBtns = [];
    function setPreset(days) {
      if (days) { var end = new Date(); st.to = ''; st.from = isoDay(new Date(end.getTime() - (days - 1) * 86400000)); }
      else { st.from = ''; st.to = ''; }
      from.value = st.from; to.value = st.to;
      presetBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-days') === String(days || ''))); });
      onChange();
    }
    (opts.presets || [[7, '7 days'], [30, '30 days'], [90, '90 days'], ['', 'All']]).forEach(function (p) {
      var b = h('button', { type: 'button', class: 'ecm-chip-btn', 'data-days': String(p[0]), 'aria-pressed': String(p[0] === ''), text: p[1],
        onclick: function () { setPreset(p[0]); } });
      presetBtns.push(b);
    });
    mpSel.addEventListener('change', function () { st.mp = this.value; onChange(); });
    function typed() {
      st.from = from.value; st.to = to.value;
      presetBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      onChange();
    }
    from.addEventListener('change', typed);
    to.addEventListener('change', typed);
    var el = h('div', { class: 'ecm-filters', role: 'group', 'aria-label': 'Filters' }, [
      h('div', { class: 'ecm-filters__group' }, [mpSel].concat(opts.extra || [])),
      h('div', { class: 'ecm-filters__group' }, [h('span', { class: 'ecm-filters__label', text: opts.dateLabel || 'Dates' }), from,
        h('span', { class: 'ecm-filters__label', 'aria-hidden': 'true', text: '–' }), to].concat(presetBtns))
    ]);
    return {
      el: el,
      mpOk: function (m) { return !st.mp || m === st.mp; },
      dateOk: function (d) { if (!d) return !st.from && !st.to; return (!st.from || d >= st.from) && (!st.to || d <= st.to); },
      monthOk: function (m) { return (!st.from || m >= st.from.slice(0, 7)) && (!st.to || m <= st.to.slice(0, 7)); },
      state: st
    };
  }

  // ---- KPI tiles
  function kpiRow(items) {
    return h('div', { class: 'ecm-kpis' }, items.map(function (k) {
      return h('div', { class: 'ecm-kpi' + (k.tone ? ' ecm-kpi--' + k.tone : '') }, [
        h('span', { class: 'ecm-kpi__label', text: k.label }),
        h('span', { class: 'ecm-kpi__value', text: k.value }),
        k.hint ? h('span', { class: 'ecm-kpi__hint', text: k.hint }) : null
      ]);
    }));
  }

  // ---- charts: plain SVG (no library), bars and / or lines over one x axis; a "Show the numbers" table under each
  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, text) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
    if (text != null) el.textContent = text;
    return el;
  }
  function niceStep(range, n) {
    var raw = range / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function chart(cfg) {
    var W = 760, H = cfg.height || 230, L = 56, R = 12, T = 10, B = 28;
    var labels = cfg.labels, n = labels.length, xf = cfg.xFmt || String, tf = cfg.tipFmt || function (v) { return fmtNum(v, 0); };
    var vals = [];
    cfg.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null && isFinite(v)) vals.push(v); }); });
    // zoom: the axis spans the data only (stock levels), otherwise it includes 0 (bars, counts)
    var lo = Math.min.apply(null, cfg.zoom && vals.length ? vals : vals.concat([0]));
    var hi = Math.max.apply(null, cfg.zoom && vals.length ? vals : vals.concat([0]));
    if (hi === lo) { hi = lo + 1; if (cfg.zoom) lo = lo - 1; }
    var step = niceStep(hi - lo, 4);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    var band = (W - L - R) / Math.max(1, n);
    var X = function (i) { return L + band * (i + 0.5); };
    var Y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ecm-chart__svg', role: 'img', 'aria-label': cfg.title });
    for (var v = lo; v <= hi + step / 2; v += step) {
      svg.appendChild(sv('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: Math.abs(v) < step / 1e6 ? 'ecm-chart__zero' : 'ecm-chart__grid' }));
      svg.appendChild(sv('text', { x: L - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'ecm-chart__tick' }, (cfg.yFmt || fmtShort)(v)));
    }
    var every = Math.max(1, Math.ceil(n / 8));
    labels.forEach(function (lab, i) {
      // every n-th label, and the last one only when it does not crowd the one before
      var lastFits = i === n - 1 && (n - 1) % every >= Math.ceil(every / 2);
      if (i % every && !lastFits) return;
      svg.appendChild(sv('text', { x: X(i), y: H - 8, 'text-anchor': 'middle', class: 'ecm-chart__tick' }, xf(lab)));
    });
    var bars = cfg.series.filter(function (s) { return s.kind === 'bar'; });
    var bw = Math.max(2, Math.min(28, band * 0.8 / Math.max(1, bars.length)));
    bars.forEach(function (s, k) {
      s.values.forEach(function (val, i) {
        if (val == null || !isFinite(val) || !val) return;
        var x0 = X(i) - (bw * bars.length) / 2 + k * bw, y0 = Y(Math.max(0, val)), y1 = Y(Math.min(0, val));
        var r = sv('rect', { x: x0.toFixed(1), y: y0.toFixed(1), width: Math.max(1, bw - 1).toFixed(1), height: Math.max(1, y1 - y0).toFixed(1),
          style: 'fill:' + s.color, class: 'ecm-chart__bar' });
        r.appendChild(sv('title', null, s.name + ' · ' + xf(labels[i]) + ': ' + tf(val)));
        svg.appendChild(r);
      });
    });
    cfg.series.filter(function (s) { return s.kind !== 'bar'; }).forEach(function (s) {
      var d = '', pen = false;
      s.values.forEach(function (val, i) {
        if (val == null || !isFinite(val)) { pen = false; return; }
        d += (pen ? ' L ' : ' M ') + X(i).toFixed(1) + ' ' + Y(val).toFixed(1);
        pen = true;
      });
      if (d) svg.appendChild(sv('path', { d: d.trim(), class: 'ecm-chart__line', style: 'fill:none;stroke:' + s.color + ';stroke-width:' + (s.width || 2.5) }));
      if (n <= 60) s.values.forEach(function (val, i) {
        if (val == null || !isFinite(val)) return;
        var c = sv('circle', { cx: X(i).toFixed(1), cy: Y(val).toFixed(1), r: n > 31 ? 2 : 3, style: 'fill:' + s.color });
        c.appendChild(sv('title', null, s.name + ' · ' + xf(labels[i]) + ': ' + tf(val)));
        svg.appendChild(c);
      });
    });
    var legend = h('ul', { class: 'ecm-legend' }, cfg.series.map(function (s) {
      return h('li', null, [h('span', { class: 'ecm-legend__dot', style: 'background:' + s.color, 'aria-hidden': 'true' }), s.name]);
    }));
    var tbl = h('table', { class: 'ecm-table' }, [
      h('thead', null, h('tr', null, [h('th', { scope: 'col', text: cfg.xName || 'Date' })].concat(cfg.series.map(function (s) {
        return h('th', { scope: 'col', class: 'is-num', text: s.name }); })))),
      h('tbody', null, labels.map(function (lab, i) {
        return h('tr', null, [h('td', { text: xf(lab) })].concat(cfg.series.map(function (s) {
          var val = s.values[i]; return h('td', { class: 'is-num', text: val == null ? '' : tf(val) }); })));
      }))
    ]);
    return h('figure', { class: 'ecm-chart' }, [
      h('figcaption', { class: 'ecm-chart__title', text: cfg.title }),
      cfg.note ? h('p', { class: 'ecm-note', text: cfg.note }) : null,
      legend, n ? svg : h('p', { class: 'ecm-note', text: 'No data in this range.' }),
      n ? h('details', { class: 'ecm-chart__data' }, [h('summary', { text: 'Show the numbers' }), h('div', { class: 'ecm-tablewrap' }, tbl)]) : null
    ]);
  }
  // Every month (or day) between the first and the last key, so gaps show as zero.
  function fillMonths(keys) {
    if (!keys.length) return [];
    var out = [], p = keys[0].split('-'), y = +p[0], m = +p[1], last = keys[keys.length - 1];
    for (var k = 0; k < 600; k++) {
      var key = y + '-' + String(m).padStart(2, '0');
      out.push(key);
      if (key >= last) break;
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  function loadingBox(main) { var box = h('div', null, h('p', { class: 'ecm-note', text: 'Loading…' })); main.appendChild(box); return box; }
  function emptyData(box, conn) {
    box.appendChild(h('div', { class: 'ecm-card ecm-empty' }, [
      h('p', { text: 'No data yet for ' + conn.label + '.' }),
      h('a', { class: 'ecm-btn ecm-btn--primary', href: '#/settings', text: 'Go to Settings → Sync now' })
    ]));
  }
  function sampleNote(stats) {
    return stats ? null : h('p', { class: 'ecm-note', text: 'The tiles and charts count the loaded test sample (≤ 100 rows per marketplace). Totals of Amazon\'s whole files appear after the next sync (needs supabase/0036).' });
  }
  function viewFailed(box, e) {
    box.innerHTML = '';
    box.appendChild(h('p', { class: 'ecm-error', role: 'alert', text: 'Could not load the data: ' + e.message }));
  }

  function viewData(id, main) {
    var cfg = VIEWS[id];
    header(main, cfg.title, cfg.lede);
    var conn = current();
    if (!conn) return needAccount(main);
    var box = loadingBox(main);
    Promise.all([loadRows(id, conn), loadStats(conn)]).then(function (res) {
      box.innerHTML = '';
      var rows = res[0], stats = res[1];
      if (!rows.length && !(stats && stats.length)) return emptyData(box, conn);
      ({ products: viewProducts, inventory: viewInventory, repeat: viewRepeat })[id](box, cfg, rows, stats, conn);
      box.appendChild(h('p', { class: 'ecm-note', text: TEST_NOTE + (conn.last_sync_at ? ' Last sync: ' + fmtTime(conn.last_sync_at) + '.' : '') }));
    }).catch(function (e) { viewFailed(box, e); });
  }

  // ---- Products: listing totals, new listings per month, the listings table
  function viewProducts(box, cfg, rows, stats, conn) {
    var ls = latestBy(stats, 'listings');
    var mps = uniq(rows.map(function (r) { return r.marketplace_id; }).concat(ls.map(function (s) { return s.marketplace_id; })));
    var kpiBox = h('div'), chartBox = h('div', { class: 'ecm-charts' });
    var bar = filterBar({ mps: mps, dateLabel: 'Listed', presets: [[30, '30 days'], [365, '12 months'], ['', 'All']] }, render);
    var tbl = dataTable('products', cfg, rows, conn, function (r) {
      return bar.mpOk(r.marketplace_id) && bar.dateOk(dateOfListing(r.open_date));
    });
    box.append(bar.el, kpiBox, chartBox, h('h2', { class: 'ecm-h2 ecm-section-h', text: 'Listings (test sample: up to 100 per marketplace)' }), tbl.el);
    var note = sampleNote(stats);
    if (note) box.insertBefore(note, kpiBox);
    function render() {
      var sel = ls.filter(function (s) { return bar.mpOk(s.marketplace_id); });
      var m = { skus: 0, active: 0, inactive: 0, incomplete: 0, fba: 0, fbm: 0 }, opened = {};
      if (sel.length) {
        sel.forEach(function (s) {
          Object.keys(m).forEach(function (k) { m[k] += s.metrics[k] || 0; });
          var o = s.metrics.opened || {};
          Object.keys(o).forEach(function (k) { opened[k] = (opened[k] || 0) + o[k]; });
        });
      } else {
        rows.forEach(function (r) {
          if (!bar.mpOk(r.marketplace_id)) return;
          m.skus++;
          var w = /^(activ|aktiv|actif|attiv)/i.test(r.status || '') ? 'active' : /^(inactiv|inaktiv|inattiv)/i.test(r.status || '') ? 'inactive' : 'incomplete';
          m[w]++;
          if (/^AMAZON/i.test(r.fulfillment_channel || '')) m.fba++; else if (r.fulfillment_channel) m.fbm++;
          var d = dateOfListing(r.open_date);
          if (d) opened[d.slice(0, 7)] = (opened[d.slice(0, 7)] || 0) + 1;
        });
      }
      var months = fillMonths(Object.keys(opened).sort()).filter(bar.monthOk);
      var inRange = months.reduce(function (a, k) { return a + (opened[k] || 0); }, 0);
      kpiBox.replaceChildren(kpiRow([
        { label: 'SKUs listed', value: fmtInt(m.skus), hint: sel.length ? 'all of Amazon\'s report' : 'loaded sample' },
        { label: 'Active', value: fmtInt(m.active), hint: pctOf(m.active, m.skus), tone: 'up' },
        { label: 'Inactive', value: fmtInt(m.inactive), hint: pctOf(m.inactive, m.skus) },
        { label: 'Incomplete', value: fmtInt(m.incomplete), hint: pctOf(m.incomplete, m.skus), tone: m.incomplete ? 'down' : null },
        { label: 'FBA share', value: pctOf(m.fba, m.fba + m.fbm), hint: fmtInt(m.fba) + ' FBA · ' + fmtInt(m.fbm) + ' FBM' },
        { label: 'Listed in the date range', value: fmtInt(inRange), hint: months.length ? fmtMonth(months[0]) + ' – ' + fmtMonth(months[months.length - 1]) : 'no dates' }
      ]));
      chartBox.replaceChildren(chart({ title: 'New listings per month', xName: 'Month', labels: months, xFmt: fmtMonth,
        series: [{ name: 'Listings opened', values: months.map(function (k) { return opened[k] || 0; }), color: 'var(--partner)', kind: 'bar' }] }));
      tbl.refresh();
    }
    render();
  }

  // ---- FBA inventory: stock now, stock development (Inventory Ledger), movement per SKU, the snapshot table
  var SKU_MOVES = {
    title: 'Stock movement per SKU',
    cols: [
      { k: 'marketplace_id', t: 'Pool', f: mpCode },
      { k: 'sku', t: 'SKU', mono: true },
      { k: 'asin', t: 'ASIN', mono: true },
      { k: 'title', t: 'Title', wide: true },
      { k: 'start', t: 'Start', num: true },
      { k: 'end', t: 'End', num: true },
      { k: '_chg', t: 'Change', num: true, calc: function (r) { return (r.end || 0) - (r.start || 0); } },
      { k: 'receipts', t: 'Received', num: true },
      { k: '_ship', t: 'Shipped', num: true, calc: function (r) { return -(r.shipments || 0); } },
      { k: 'returns', t: 'Returns', num: true },
      { k: 'lost_damaged', t: 'Lost / damaged', num: true }
    ]
  };
  function viewInventory(box, cfg, rows, stats, conn) {
    var fbaNow = latestBy(stats, 'fba_inventory');
    var stock = (stats || []).filter(function (s) { return s.dataset === 'stock'; });
    var skuAll = (stats || []).filter(function (s) { return s.dataset === 'stock_sku'; });
    var lastWin = skuAll.reduce(function (a, s) { return s.period_end > a ? s.period_end : a; }, '');
    var skuRows = skuAll.filter(function (s) { return s.period_end === lastWin; }).map(function (s) {
      return Object.assign({ marketplace_id: s.marketplace_id, sku: s.dim, window: s.period_start + ' – ' + s.period_end }, s.metrics);
    });
    var pools = uniq(rows.map(function (r) { return r.marketplace_id; }).concat(fbaNow.map(function (s) { return s.marketplace_id; }),
      stock.map(function (s) { return s.marketplace_id; })));
    var locs = uniq(stock.map(function (s) { return s.dim.split('|')[0]; })).sort();
    var locSel = h('select', { class: 'ecm-input', 'aria-label': 'Warehouse country' },
      [h('option', { value: '', text: 'All warehouse countries' })].concat(locs.map(function (l) { return h('option', { value: l, text: 'Warehouses in ' + l }); })));
    var bar = filterBar({ mps: pools, allLabel: 'All pools', mpLabel: 'Stock pool', extra: [locSel], dateLabel: 'Days' }, render);
    locSel.addEventListener('change', render);
    var nowBox = h('div'), devHead = h('h2', { class: 'ecm-h2 ecm-section-h', text: 'Stock development' }), devKpis = h('div'), devCharts = h('div', { class: 'ecm-charts' });
    var moveTbl = dataTable('skumoves', SKU_MOVES, skuRows, conn, function (r) { return bar.mpOk(r.marketplace_id); });
    var snapTbl = dataTable('inventory', cfg, rows, conn, function (r) { return bar.mpOk(r.marketplace_id) && bar.dateOk(r.snapshot_date); });
    box.append(bar.el);
    var note = sampleNote(stats);
    if (note) box.appendChild(note);
    box.append(h('h2', { class: 'ecm-h2', text: 'Stock now' }), nowBox, devHead, devKpis, devCharts,
      h('h2', { class: 'ecm-h2 ecm-section-h', text: 'Stock movement per SKU' + (lastWin ? ' (' + fmtDay(skuRows.length ? skuRows[0].window.slice(0, 10) : lastWin) + ' – ' + fmtDay(lastWin) + ', most shipped first)' : '') }),
      skuRows.length ? moveTbl.el : h('p', { class: 'ecm-note', text: 'Comes with the next sync (Amazon\'s Inventory Ledger).' }),
      h('h2', { class: 'ecm-h2 ecm-section-h', text: 'FBA stock per SKU (latest snapshot, test sample)' }), snapTbl.el);
    function render() {
      // 1. stock now: the newest snapshot totals per pool (all SKUs), else the sample
      var cur = fbaNow.filter(function (s) { return bar.mpOk(s.marketplace_id); });
      var t = { skus: 0, fulfillable: 0, inbound: 0, reserved: 0, unfulfillable: 0, total: 0 };
      if (cur.length) cur.forEach(function (s) { Object.keys(t).forEach(function (k) { t[k] += s.metrics[k] || 0; }); });
      else rows.forEach(function (r) {
        if (!bar.mpOk(r.marketplace_id)) return;
        t.skus++; t.fulfillable += r.fulfillable || 0; t.inbound += inbound(r) || 0; t.reserved += r.reserved || 0;
        t.unfulfillable += r.unfulfillable || 0; t.total += r.total || 0;
      });
      var snapDay = cur.reduce(function (a, s) { return s.period_end > a ? s.period_end : a; }, '');
      nowBox.replaceChildren(kpiRow([
        { label: 'SKUs in FBA', value: fmtInt(t.skus), hint: cur.length ? 'snapshot ' + fmtDay(snapDay) : 'loaded sample' },
        { label: 'Available', value: fmtInt(t.fulfillable), hint: pctOf(t.fulfillable, t.total) + ' of total', tone: 'up' },
        { label: 'Inbound', value: fmtInt(t.inbound), hint: 'on the way to Amazon' },
        { label: 'Reserved', value: fmtInt(t.reserved), hint: 'orders, transfers, checks' },
        { label: 'Unsellable', value: fmtInt(t.unfulfillable), tone: t.unfulfillable ? 'down' : null },
        { label: 'Total units', value: fmtInt(t.total) }
      ]));
      // 2. stock development: per day, filtered by pool, warehouse country and dates
      var loc = locSel.value;
      var st = stock.filter(function (s) {
        return bar.mpOk(s.marketplace_id) && (!loc || s.dim.indexOf(loc + '|') === 0) && bar.dateOk(s.period_start);
      });
      if (!stock.length) {
        devKpis.replaceChildren(h('p', { class: 'ecm-note', text: 'The daily stock curve comes from Amazon\'s Inventory Ledger with the next sync (needs supabase/0036 and the updated server function).' }));
        devCharts.replaceChildren();
      } else {
        var days = uniq(st.map(function (s) { return s.period_start; })).sort();
        var by = {};
        days.forEach(function (d) { by[d] = { sellStart: 0, sell: 0, unsell: 0, rec: 0, ship: 0, ret: 0, loss: 0 }; });
        st.forEach(function (s) {
          var d = by[s.period_start], m = s.metrics;
          if (/\|SELLABLE$/.test(s.dim)) { d.sell += m.end || 0; d.sellStart += m.start || 0; } else d.unsell += m.end || 0;
          d.rec += m.receipts || 0; d.ship += m.shipments || 0; d.ret += m.returns || 0;
          d.loss += (m.lost || 0) + (m.damaged || 0) + (m.disposed || 0);
        });
        var first = days.length ? by[days[0]].sellStart : 0, last = days.length ? by[days[days.length - 1]].sell : 0;
        var sum = function (k) { return days.reduce(function (a, d) { return a + by[d][k]; }, 0); };
        var chg = last - first;
        devKpis.replaceChildren(kpiRow([
          { label: 'Sellable at the start', value: fmtInt(first), hint: days.length ? fmtDay(days[0]) : '' },
          { label: 'Sellable at the end', value: fmtInt(last), hint: days.length ? fmtDay(days[days.length - 1]) : '' },
          { label: 'Change', value: (chg > 0 ? '+' : '') + fmtInt(chg), hint: first ? (chg >= 0 ? '+' : '') + (chg * 100 / first).toFixed(1) + ' %' : '', tone: chg > 0 ? 'up' : chg < 0 ? 'down' : null },
          { label: 'Received', value: fmtInt(sum('rec')), hint: days.length + ' days' },
          { label: 'Shipped to customers', value: fmtInt(-sum('ship')) },
          { label: 'Customer returns', value: fmtInt(sum('ret')) },
          { label: 'Lost / damaged / disposed', value: fmtInt(Math.abs(sum('loss'))), tone: sum('loss') ? 'down' : null }
        ]));
        devCharts.replaceChildren(
          chart({ title: 'Sellable units in stock at the end of each day', labels: days, xFmt: fmtDay, zoom: true,
            note: 'The axis starts near the lowest level, so small changes show.',
            series: [{ name: 'Sellable units', values: days.map(function (d) { return by[d].sell; }), color: 'var(--partner)' }] }),
          chart({ title: 'Daily movements', labels: days, xFmt: fmtDay,
            series: [{ name: 'Received', values: days.map(function (d) { return by[d].rec; }), color: 'var(--ok)', kind: 'bar' },
                     { name: 'Shipped', values: days.map(function (d) { return by[d].ship; }), color: 'var(--accent)', kind: 'bar' },
                     { name: 'Returns', values: days.map(function (d) { return by[d].ret; }), color: 'var(--watch)', kind: 'bar' }] })
        );
      }
      moveTbl.refresh();
      snapTbl.refresh();
    }
    render();
  }

  // ---- Repeat purchase: week totals (all ASINs), weekly trend, the ASIN table
  function viewRepeat(box, cfg, rows, stats, conn) {
    var wk = (stats || []).filter(function (s) { return s.dataset === 'repeat_purchase' && !s.dim; });
    var mps = uniq(rows.map(function (r) { return r.marketplace_id; }).concat(wk.map(function (s) { return s.marketplace_id; })));
    var kpiBox = h('div'), chartBox = h('div', { class: 'ecm-charts' });
    var bar = filterBar({ mps: mps, dateLabel: 'Weeks from', presets: [[28, '4 weeks'], [91, '13 weeks'], ['', 'All']] }, render);
    var tbl = dataTable('repeat', cfg, rows, conn, function (r) { return bar.mpOk(r.marketplace_id) && bar.dateOk(r.start_date); });
    box.append(bar.el);
    var note = sampleNote(stats && wk.length ? stats : null);
    if (note) box.appendChild(note);
    box.append(kpiBox, chartBox, h('h2', { class: 'ecm-h2 ecm-section-h', text: 'Per ASIN (test sample: up to 100 per marketplace and week)' }), tbl.el);
    function render() {
      var weeks = {};
      var add = function (w, mp, o, uc, rc, rev, cur) {
        var x = weeks[w] || (weeks[w] = { orders: 0, uc: 0, rc: 0, rev: {} });
        x.orders += o; x.uc += uc; x.rc += rc; x.rev[cur] = (x.rev[cur] || 0) + rev;
      };
      if (wk.length) {
        wk.forEach(function (s) {
          if (!bar.mpOk(s.marketplace_id) || !bar.dateOk(s.period_start)) return;
          var m = s.metrics;
          add(s.period_start, s.marketplace_id, m.orders || 0, m.unique_customers || 0, m.repeat_customers || 0, m.repeat_revenue || 0, m.currency);
        });
      } else {
        rows.forEach(function (r) {
          if (!bar.mpOk(r.marketplace_id) || !bar.dateOk(r.start_date)) return;
          add(r.start_date, r.marketplace_id, r.orders || 0, r.unique_customers || 0, (r.unique_customers || 0) * (r.repeat_customers_pct || 0), r.repeat_revenue || 0, r.currency);
        });
      }
      var keys = Object.keys(weeks).sort();
      var tot = { orders: 0, uc: 0, rc: 0, rev: {} };
      keys.forEach(function (k) {
        var x = weeks[k]; tot.orders += x.orders; tot.uc += x.uc; tot.rc += x.rc;
        Object.keys(x.rev).forEach(function (c) { tot.rev[c] = (tot.rev[c] || 0) + x.rev[c]; });
      });
      kpiBox.replaceChildren(kpiRow([
        { label: 'Orders', value: fmtInt(tot.orders), hint: keys.length + (keys.length === 1 ? ' week' : ' weeks') },
        { label: 'Customers', value: fmtInt(tot.uc), hint: 'unique per ASIN, added up' },
        { label: 'Repeat customers', value: fmtInt(Math.round(tot.rc)), hint: pctOf(tot.rc, tot.uc) + ' of customers', tone: 'up' },
        { label: 'Repeat revenue', value: moneyBy(tot.rev) },
        { label: 'Orders per customer', value: tot.uc ? (tot.orders / tot.uc).toFixed(2) : '—' }
      ]));
      chartBox.replaceChildren(
        chart({ title: 'Orders per week', xName: 'Week from', labels: keys, xFmt: fmtDay,
          series: [{ name: 'Orders', values: keys.map(function (k) { return weeks[k].orders; }), color: 'var(--partner)', kind: 'bar' }] }),
        chart({ title: 'Repeat customers, % of customers', xName: 'Week from', labels: keys, xFmt: fmtDay,
          yFmt: function (v) { return Math.round(v * 10) / 10 + ' %'; }, tipFmt: function (v) { return v.toFixed(2) + ' %'; },
          series: [{ name: 'Repeat customers %', values: keys.map(function (k) { return weeks[k].uc ? weeks[k].rc * 100 / weeks[k].uc : null; }), color: 'var(--ok)' }] })
      );
      tbl.refresh();
    }
    render();
  }

  function cellValue(c, r) {
    var v = c.calc ? c.calc(r) : r[c.k];
    return c.f ? c.f(v) : v;
  }
  // The table under a view: search, sort, CSV. `outer(row)` = the view's filter bar (marketplace + dates).
  function dataTable(id, cfg, rows, conn, outer) {
    var st = { q: '', sort: null, dir: 1 };
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
        if (outer && !outer(r)) return false;
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
    search.addEventListener('input', function () { st.q = this.value.trim(); apply(); });
    csvBtn.addEventListener('click', function () {
      csvDownload('ecommerce-' + id + '-' + new Date().toISOString().slice(0, 10) + '.csv',
        cfg.cols.map(function (c) { return c.t; }),
        shown.map(function (r) { return cfg.cols.map(function (c) { return cellValue(c, r); }); }));
    });
    apply();
    return { el: h('div', null, [h('div', { class: 'ecm-tools' }, [search, csvBtn, count]), h('div', { class: 'ecm-tablewrap' }, table)]), refresh: apply };
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
        statsCache = {};
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
