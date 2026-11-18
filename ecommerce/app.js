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
  var DATASET = { listings: 'Products (listings)', fba_inventory: 'FBA inventory', inventory_ledger: 'Stock development (ledger)', repeat_purchase: 'Repeat purchase', business: 'Business report', finances: 'Finance transactions', catalog: 'Product monitor', reviews: 'Review topics' };
  var STATUS = { queued: 'Waiting', running: 'Loading', waiting: 'Amazon is preparing', done: 'Done', no_data: 'No data', error: 'Error', cancelled: 'Stopped', ok: 'Keys work', new: 'New', disabled: 'Off' };
  var OPEN = { queued: 1, running: 1, waiting: 1 };

  // A group ({ children }) opens / closes in the menu; its pages are routed like the others (#/pim-products …).
  var NAV = [
    { id: 'products', label: 'Products' },
    { id: 'inventory', label: 'FBA inventory' },
    { id: 'repeat', label: 'Repeat purchase' },
    { id: 'sales', label: 'Sales' },
    { id: 'finance', label: 'Finance' },
    { id: 'monitor', label: 'Product monitor' },
    { id: 'pim', label: 'PIM', children: [   // owner, 18 Nov 2026: product information (pim.js)
      { id: 'pim-products', label: 'Products' },
      { id: 'pim-manufacturers', label: 'Manufacturers' },
      { id: 'pim-brands', label: 'Brands' },
      { id: 'pim-sellers', label: 'Sellers' },
      { id: 'pim-images', label: 'Image library' }
    ] },
    { id: 'settings', label: 'Settings' }
  ];
  var NAV_FLAT = [];
  NAV.forEach(function (n) { if (n.children) n.children.forEach(function (c) { NAV_FLAT.push(c); }); else NAV_FLAT.push(n); });
  var ROUTES = {};   // id → function (main): pages registered by pim.js (window.EcomApp.route) and app.js

  // Column helpers for the data views
  // "EU" = the Pan-European FBA stock, stored once for DE FR IT ES NL SE PL BE (owner decision ED-14, 11 Nov 2026)
  // "ALL" = finance transactions without a marketplace (account fees, subscriptions)
  function mpCode(v) { return v === 'EU' ? 'EU pool' : v === 'ALL' ? 'Account-wide' : (MP[v] || v || ''); }
  // "2026-10-20T10:05:00+00:00" → "2026-10-20 10:05" (sorts as text)
  function isoMinute(v) { return v ? String(v).slice(0, 16).replace('T', ' ') : ''; }
  var FIN_STATUS = { RELEASED: 'Released', DEFERRED: 'Deferred', DEFERRED_RELEASED: 'Deferred, now released' };
  function finStatus(v) { return v ? (FIN_STATUS[v] || v) : ''; }
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
    },
    // Owner, 11 Nov 2026: "Sales - lets make it business report", "finance - will be finance transactions"
    sales: {
      title: 'Sales', table: 'ecom_amz_business_asin', order: ['-period_end', 'marketplace_id', 'child_asin', 'sku'],
      sort: 'ordered_sales', sortDir: -1,
      lede: 'Amazon\'s Business Report (sales and traffic): totals per day and marketplace, and per SKU for the whole period. Sales = ordered product sales as Amazon reports them, VAT included.',
      cols: [
        { k: 'marketplace_id', t: 'Market', f: mpCode },
        { k: 'sku', t: 'SKU', mono: true },
        { k: 'child_asin', t: 'ASIN', mono: true },
        { k: 'parent_asin', t: 'Parent ASIN', mono: true },
        { k: 'ordered_sales', t: 'Sales', num: true },
        { k: 'currency', t: 'Cur.' },
        { k: 'units_ordered', t: 'Units', num: true },
        { k: 'total_order_items', t: 'Order items', num: true },
        { k: 'sessions', t: 'Sessions', num: true },
        { k: 'page_views', t: 'Page views', num: true },
        { k: 'unit_session_pct', t: 'Conversion %', num: true },
        { k: 'buy_box_pct', t: 'Buy Box %', num: true }
      ],
      extra: ['period_start', 'period_end'],
      daily: { table: 'ecom_amz_business_daily', order: ['day', 'marketplace_id'],
               cols: ['marketplace_id', 'day', 'currency', 'ordered_sales', 'units_ordered', 'total_order_items', 'units_refunded',
                      'sessions', 'page_views', 'buy_box_pct'].map(function (k) { return { k: k }; }) }
    },
    finance: {
      title: 'Finance', table: 'ecom_amz_finance_events', order: ['-posted_at', 'id'],
      lede: 'Amazon\'s finance transactions: order payments, refunds, fees, reimbursements and more, as posted to the account. Amounts are in each marketplace\'s currency.',
      cols: [
        { k: 'posted_at', t: 'Posted (UTC)', f: isoMinute },
        { k: 'marketplace', t: 'Market' },
        { k: 'event_type', t: 'Type' },
        { k: 'status', t: 'Status', sel: 'status:raw->>transactionStatus', f: finStatus },
        { k: 'order_id', t: 'Order', mono: true },
        { k: 'sku', t: 'SKU', mono: true },
        { k: 'quantity', t: 'Qty', num: true },
        { k: 'principal', t: 'Sales part', num: true },
        { k: 'amount', t: 'Net', num: true },
        { k: 'currency', t: 'Cur.' }
      ],
      extra: ['mp_id:raw->marketplaceDetails->>marketplaceId']
    }
  };

  var client = null, user = null, ws = null, conns = [], connId = null, started = false;
  var poll = { on: false, timer: null, last: null };
  var syncPage = 0;   // page of the sync job list (PAGE_ROWS per page)

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
  // view = a VIEWS key or a config ({table, cols, order}); order = a column or a list, "-col" = newest / largest first
  function loadRows(view, conn) {
    var cfg = typeof view === 'string' ? VIEWS[view] : view;
    var cols = cfg.cols.filter(function (c) { return !c.calc; }).map(function (c) { return c.sel || c.k; }).concat(cfg.extra || []);
    var all = [], page = 1000, cap = 5000;
    function next(from) {
      var q = client.from(cfg.table).select(cols.join(',')).eq('connection_id', conn.id);
      (Array.isArray(cfg.order) ? cfg.order : [cfg.order]).forEach(function (o) {
        var desc = o.charAt(0) === '-';
        q = q.order(desc ? o.slice(1) : o, { ascending: !desc, nullsFirst: false });
      });
      return q.range(from, from + page - 1).then(function (r) {
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
    var id = (location.hash.replace(/^#\/?/, '') || '').split('?')[0].split('/')[0];
    if (!NAV_FLAT.some(function (n) { return n.id === id; })) id = conns.length ? 'products' : 'settings';
    Array.prototype.forEach.call(document.querySelectorAll('.ecm-nav__link[data-id]'), function (a) {
      if (a.getAttribute('data-id') === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    NAV.forEach(function (g) {   // the group of the open page stays open
      if (g.children && g.children.some(function (c) { return c.id === id; })) setGroup(g.id, true);
    });
    closeNav();
    var main = $('#ecm-main');
    main.innerHTML = '';
    if (VIEWS[id]) viewData(id, main);
    else if (ROUTES[id]) ROUTES[id](main);
    else if (id !== 'settings') { header(main, 'Loading…'); }
    else viewSettings(main);
    if (started) main.focus({ preventScroll: false });
  }
  function navLink(n) {
    return h('a', { class: 'ecm-nav__link', href: '#/' + n.id, 'data-id': n.id }, [
      h('span', { text: n.label }), n.soon ? h('span', { class: 'ecm-nav__soon', text: 'next step' }) : null
    ]);
  }
  function setGroup(gid, open) {
    var btn = document.querySelector('.ecm-nav__group[data-group="' + gid + '"]');
    if (!btn) return;
    btn.setAttribute('aria-expanded', String(!!open));
    var sub = document.getElementById('ecm-nav-' + gid);
    if (sub) sub.hidden = !open;
    store('ecm_nav_' + gid, open ? '1' : '');
  }
  function buildNav() {
    var ul = $('#ecm-nav'); ul.innerHTML = '';
    NAV.forEach(function (n) {
      if (!n.children) { ul.appendChild(h('li', null, navLink(n))); return; }
      var btn = h('button', { type: 'button', class: 'ecm-nav__link ecm-nav__group', 'data-group': n.id, 'aria-expanded': 'false',
        'aria-controls': 'ecm-nav-' + n.id }, [h('span', { text: n.label }), h('span', { class: 'ecm-nav__chev', 'aria-hidden': 'true', text: '▸' })]);
      var sub = h('ul', { class: 'ecm-nav ecm-nav--sub', id: 'ecm-nav-' + n.id, hidden: true }, n.children.map(function (c) { return h('li', null, navLink(c)); }));
      btn.addEventListener('click', function () { setGroup(n.id, btn.getAttribute('aria-expanded') !== 'true'); });
      ul.appendChild(h('li', null, [btn, sub]));
      if (load('ecm_nav_' + n.id)) setGroup(n.id, true);
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
      // opts.endDay: count back from the newest day of the data (the business report ends 2 days ago), else from today
      if (days) { var end = opts.endDay ? new Date(opts.endDay + 'T12:00:00Z') : new Date(); st.to = ''; st.from = isoDay(new Date(end.getTime() - (days - 1) * 86400000)); }
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
    var nbody = h('tbody');
    var tbl = h('table', { class: 'ecm-table' }, [
      h('thead', null, h('tr', null, [h('th', { scope: 'col', text: cfg.xName || 'Date' })].concat(cfg.series.map(function (s) {
        return h('th', { scope: 'col', class: 'is-num', text: s.name }); })))),
      nbody
    ]);
    function numberRows(page) {   // "Show the numbers": 30 rows per page, like every table
      nbody.innerHTML = '';
      for (var i = page * PAGE_ROWS; i < Math.min(n, (page + 1) * PAGE_ROWS); i++) {
        nbody.appendChild(h('tr', null, [h('td', { text: xf(labels[i]) })].concat(cfg.series.map(function (s) {
          var val = s.values[i]; return h('td', { class: 'is-num', text: val == null ? '' : tf(val) }); }))));
      }
    }
    var npager = pagerBar(numberRows);
    npager.set(n, 0);
    numberRows(0);
    return h('figure', { class: 'ecm-chart' }, [
      h('figcaption', { class: 'ecm-chart__title', text: cfg.title }),
      cfg.note ? h('p', { class: 'ecm-note', text: cfg.note }) : null,
      legend, n ? svg : h('p', { class: 'ecm-note', text: 'No data in this range.' }),
      n ? h('details', { class: 'ecm-chart__data' }, [h('summary', { text: 'Show the numbers' }), h('div', { class: 'ecm-tablewrap' }, tbl), npager.el]) : null
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
    Promise.all([loadRows(id, conn), loadStats(conn), cfg.daily ? loadRows(cfg.daily, conn) : []]).then(function (res) {
      box.innerHTML = '';
      var rows = res[0], stats = res[1], daily = res[2];
      var own = id === 'sales' ? daily.length > 0
              : id === 'finance' ? (stats || []).some(function (s) { return s.dataset === 'finance'; })
              : !!(stats && stats.length);
      if (!rows.length && !own) return emptyData(box, conn);
      ({ products: viewProducts, inventory: viewInventory, repeat: viewRepeat, sales: viewSales, finance: viewFinance })[id](box, cfg, rows, stats, conn, daily);
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
  // Amazon's Inventory Ledger covers every warehouse of the account (stored once as "ALL" since 11 Nov 2026); a
  // warehouse country belongs to a stock pool: GB → UK, TR / SA / AE their own, the rest (DE, PL, CZ, SK …) → EU pool.
  var LOC_POOL = { GB: 'A1F83G8C2ARO7P', TR: 'A33AVAJ2PDY3EV', SA: 'A17E79C6D8DWNP', AE: 'A2VIGQ35RCS4UG' };
  function stockPool(s) { return s.marketplace_id === 'ALL' ? (LOC_POOL[s.dim.split('|')[0]] || 'EU') : s.marketplace_id; }
  function viewInventory(box, cfg, rows, stats, conn) {
    var fbaNow = latestBy(stats, 'fba_inventory');
    var stock = (stats || []).filter(function (s) { return s.dataset === 'stock'; });
    var skuAll = (stats || []).filter(function (s) { return s.dataset === 'stock_sku'; });
    var lastWin = skuAll.reduce(function (a, s) { return s.period_end > a ? s.period_end : a; }, '');
    var skuRows = skuAll.filter(function (s) { return s.period_end === lastWin; }).map(function (s) {
      return Object.assign({ marketplace_id: s.marketplace_id, sku: s.dim, window: s.period_start + ' – ' + s.period_end }, s.metrics);
    });
    var pools = uniq(rows.map(function (r) { return r.marketplace_id; }).concat(fbaNow.map(function (s) { return s.marketplace_id; }),
      stock.map(stockPool)));
    var locs = uniq(stock.map(function (s) { return s.dim.split('|')[0]; })).sort();
    var locSel = h('select', { class: 'ecm-input', 'aria-label': 'Warehouse country' },
      [h('option', { value: '', text: 'All warehouse countries' })].concat(locs.map(function (l) { return h('option', { value: l, text: 'Warehouses in ' + l }); })));
    var bar = filterBar({ mps: pools, allLabel: 'All pools', mpLabel: 'Stock pool', extra: [locSel], dateLabel: 'Days' }, render);
    locSel.addEventListener('change', render);
    var nowBox = h('div'), devHead = h('h2', { class: 'ecm-h2 ecm-section-h', text: 'Stock development' }), devKpis = h('div'), devCharts = h('div', { class: 'ecm-charts' });
    var moveTbl = dataTable('skumoves', SKU_MOVES, skuRows, conn, function (r) { return r.marketplace_id === 'ALL' || bar.mpOk(r.marketplace_id); });
    var snapTbl = dataTable('inventory', cfg, rows, conn, function (r) { return bar.mpOk(r.marketplace_id) && bar.dateOk(r.snapshot_date); });
    box.append(bar.el);
    var note = sampleNote(stats);
    if (note) box.appendChild(note);
    box.append(h('h2', { class: 'ecm-h2', text: 'Stock now' }), nowBox, devHead, devKpis, devCharts,
      h('h2', { class: 'ecm-h2 ecm-section-h', text: 'Stock movement per SKU' + (lastWin ? ' (all warehouses, ' + fmtDay(skuRows.length ? skuRows[0].window.slice(0, 10) : lastWin) + ' – ' + fmtDay(lastWin) + ', most shipped first)' : '') }),
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
      // Amazon lists every SKU the account ever had, in every pool (same list): the largest list, not the sum
      var listed = cur.reduce(function (a, s) { return Math.max(a, s.metrics.skus_all || 0); }, 0);
      nowBox.replaceChildren(kpiRow([
        { label: 'SKUs with FBA stock', value: fmtInt(t.skus), hint: cur.length ? (listed ? 'of ' + fmtInt(listed) + ' Amazon lists · ' : '') + 'snapshot ' + fmtDay(snapDay) : 'loaded sample' },
        { label: 'Available', value: fmtInt(t.fulfillable), hint: pctOf(t.fulfillable, t.total) + ' of total', tone: 'up' },
        { label: 'Inbound', value: fmtInt(t.inbound), hint: 'on the way to Amazon' },
        { label: 'Reserved', value: fmtInt(t.reserved), hint: 'orders, transfers, checks' },
        { label: 'Unsellable', value: fmtInt(t.unfulfillable), tone: t.unfulfillable ? 'down' : null },
        { label: 'Total units', value: fmtInt(t.total) }
      ]));
      // 2. stock development: per day, filtered by pool, warehouse country and dates
      var loc = locSel.value;
      var st = stock.filter(function (s) {
        return bar.mpOk(stockPool(s)) && (!loc || s.dim.indexOf(loc + '|') === 0) && bar.dateOk(s.period_start);
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

  // ---- Product monitor (owner, 18 Nov 2026): the live Amazon content of the watched products (Catalog Items + offers),
  //      "changed X ago" per field, Buy Box and other sellers, the change history, review topics, PIM comparison.
  //      Data: ecom_amz_catalog (latest version), ecom_amz_catalog_changes (only changed values), ecom_amz_reviews (0047).
  var AMZ_HOST = { A1PA6795UKMFR9: 'amazon.de', A13V1IB3VIYZZH: 'amazon.fr', APJ6JRA9NG5V4: 'amazon.it', A1RKKUPIHCS9HS: 'amazon.es',
    A1805IZSGTT6HS: 'amazon.nl', A2NODRKZP88ZB9: 'amazon.se', A1C3SOZRARQ6R3: 'amazon.pl', AMEN7PMS3EDWL: 'amazon.com.be',
    A1F83G8C2ARO7P: 'amazon.co.uk', A33AVAJ2PDY3EV: 'amazon.com.tr', A17E79C6D8DWNP: 'amazon.sa', ATVPDKIKX0DER: 'amazon.com' };
  var FIELD_NAME = { title: 'Title', brand: 'Brand', manufacturer: 'Manufacturer', bullets: 'Bullets', description: 'Description',
    images: 'Pictures', browse: 'Category', buybox_seller: 'Buy Box seller', sellers: 'Sellers' };
  function shortVal(v) {
    if (v == null || v === '') return '—';
    if (Array.isArray(v)) return v.length + (v.length === 1 ? ' item' : ' items') + (v.length ? ': ' + v.map(function (x) { return String(x).slice(0, 40); }).join(' | ').slice(0, 160) : '');
    return String(v).length > 160 ? String(v).slice(0, 160) + '…' : String(v);
  }
  function viewMonitor(main) {
    header(main, 'Product monitor');
    var conn = current();
    if (!conn) return needAccount(main);
    var box = loadingBox(main);
    var cat = { table: 'ecom_amz_catalog', order: ['marketplace_id', 'asin'], cols: ['marketplace_id', 'asin', 'data', 'field_changed_at', 'versions', 'first_seen_at', 'checked_at', 'changed_at'].map(function (k) { return { k: k }; }) };
    var since = new Date(Date.now() - 30 * 86400000).toISOString();
    Promise.all([
      loadRows(cat, conn),
      client.from('ecom_amz_catalog_changes').select('asin,marketplace_id,field,detected_at').eq('connection_id', conn.id).gte('detected_at', since)
        .order('detected_at', { ascending: false }).limit(5000).then(function (r) { return r.data || []; }),
      client.from('ecom_amz_reviews').select('asin,marketplace_id,item_name,date_start,date_end,positive,negative,fetched_at').eq('connection_id', conn.id).then(function (r) { return r.data || []; }),
      client.from('ecom_products').select('id,asin,title,bullets,content').eq('workspace_id', ws.id).not('asin', 'is', null).then(function (r) { return r.data || []; }),
      client.from('ecom_sellers').select('name,amazon_seller_id').eq('workspace_id', ws.id).not('amazon_seller_id', 'is', null).then(function (r) { return r.data || []; })
    ]).then(function (res) {
      box.innerHTML = '';
      var rows = res[0], changes = res[1], reviews = {}, pim = {}, names = {};
      res[2].forEach(function (r) { reviews[r.marketplace_id + '|' + r.asin] = r; });
      res[3].forEach(function (p) { pim[p.asin] = p; });
      res[4].forEach(function (s) { names[s.amazon_seller_id] = s.name; });
      if (!rows.length) {
        box.appendChild(h('div', { class: 'ecm-card ecm-empty' }, [h('p', { text: 'No products watched yet. The product monitor fills with the next sync (needs supabase/0047 and the updated server function).' }),
          h('a', { class: 'ecm-btn ecm-btn--primary', href: '#/settings', text: 'Go to Settings → Sync now' })]));
        return;
      }
      rows.sort(function (a, b) { return (b.changed_at || '') < (a.changed_at || '') ? -1 : (b.changed_at || '') > (a.changed_at || '') ? 1 : 0; });   // newest change first
      var own = conn.settings && conn.settings.seller_id;
      function seller(id) { return !id ? '—' : (own && id === own) ? 'Us' : (names[id] || id); }
      // our Buy Box: our seller id (saved on the account) or Amazon's MyOffer mark
      function bbOurs(d) { return d.buybox_ours === true || (!!own && d.buybox_seller === own); }
      rows.forEach(function (r) {
        var d = r.data || {}, f = r.field_changed_at || {};
        r._title = d.title; r._bullets = (d.bullets || []).length; r._pics = (d.images || []).length;
        r._bb = bbOurs(d) ? 'Us' : seller(d.buybox_seller);
        r._offers = d.offers; r._sellers = (d.sellers || []).length;
        var fields = Object.keys(f).sort(function (a, b) { return f[b] < f[a] ? -1 : 1; });
        r._changed = r.changed_at ? ago(r.changed_at) + ' · ' + fields.slice(0, 3).map(function (k) { return FIELD_NAME[k] || k; }).join(', ') : 'no change yet';
        r._checked = ago(r.checked_at);
        var p = pim[r.asin];
        r._pim = !p ? '—' : (p.title || '') === (d.title || '') && JSON.stringify(p.bullets || []) === JSON.stringify(d.bullets || []) ? 'same' : 'differs';
        r._rev = reviews[r.marketplace_id + '|' + r.asin] ? 'yes' : '';
      });
      var bbSel = h('select', { class: 'ecm-input', 'aria-label': 'Buy Box' }, [['', 'Any Buy Box'], ['us', 'Buy Box: us'], ['other', 'Buy Box: another seller'], ['none', 'No Buy Box']]
        .map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      var bar = filterBar({ mps: uniq(rows.map(function (r) { return r.marketplace_id; })), dateLabel: 'Changed', extra: [bbSel],
                            presets: [[1, '24 h'], [7, '7 days'], [30, '30 days'], ['', 'All']] }, render);
      bbSel.addEventListener('change', render);
      function keep(r) {
        var d = r.data || {}, b = bbSel.value;
        if (!bar.mpOk(r.marketplace_id) || !bar.dateOk(r.changed_at ? r.changed_at.slice(0, 10) : null)) return false;
        if (b === 'us') return bbOurs(d);
        if (b === 'other') return !!d.buybox_seller && !bbOurs(d);
        if (b === 'none') return !d.buybox_seller;
        return true;
      }
      var kpiBox = h('div'), detail = h('section', { class: 'ecm-card ecm-monitor__detail', hidden: true, 'aria-label': 'Product details' });
      var cfg = { title: 'Watched products', cols: [
        { k: 'marketplace_id', t: 'Market', f: mpCode }, { k: 'asin', t: 'ASIN', mono: true }, { k: '_title', t: 'Title (live on Amazon)', wide: true },
        { k: '_bullets', t: 'Bullets', num: true }, { k: '_pics', t: 'Pictures', num: true }, { k: '_bb', t: 'Buy Box' }, { k: '_offers', t: 'Offers', num: true },
        { k: '_changed', t: 'Last change' }, { k: '_checked', t: 'Checked' }, { k: '_pim', t: 'PIM' }, { k: '_rev', t: 'Reviews' }],
        onRow: function (r) { showDetail(r); } };
      var tbl = dataTable('monitor', cfg, rows, conn, keep);
      box.append(bar.el, kpiBox, tbl.el, detail);
      function render() {
        var sel = rows.filter(keep), wk = Date.now() - 7 * 86400000;
        var last = rows.reduce(function (a, r) { return r.checked_at > a ? r.checked_at : a; }, '');
        kpiBox.replaceChildren(kpiRow([
          { label: 'Products watched', value: fmtInt(sel.length), hint: 'last check ' + ago(last) },
          { label: 'Changed in 7 days', value: fmtInt(sel.filter(function (r) { return r.changed_at && Date.parse(r.changed_at) > wk; }).length), hint: 'content or sellers', tone: 'down' },
          { label: 'Field changes, 30 days', value: fmtInt(changes.filter(function (c) { return bar.mpOk(c.marketplace_id); }).length), hint: 'only the changed values are kept' },
          { label: 'Buy Box with another seller', value: fmtInt(sel.filter(function (r) { var d = r.data || {}; return d.buybox_seller && !bbOurs(d); }).length), tone: 'down' },
          { label: 'Several sellers', value: fmtInt(sel.filter(function (r) { return (r.data && r.data.sellers || []).length > 1; }).length), hint: 'more than one offer' },
          { label: 'Review topics', value: fmtInt(sel.filter(function (r) { return r._rev; }).length), hint: 'products with review data' }
        ]));
        tbl.refresh();
      }
      render();

      function showDetail(r) {
        var d = r.data || {}, f = r.field_changed_at || {}, host = AMZ_HOST[r.marketplace_id] || 'amazon.de';
        detail.hidden = false;
        detail.replaceChildren(h('div', { class: 'ecm-row' }, [h('h2', { class: 'ecm-h2', text: mpCode(r.marketplace_id) + ' · ' + r.asin }),
          h('a', { class: 'ecm-btn ecm-btn--ghost ecm-btn--small', href: 'https://www.' + host + '/dp/' + r.asin, target: '_blank', rel: 'noopener', text: 'Open on Amazon' }),
          h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Close', onclick: function () { detail.hidden = true; } })]));
        var badge = function (k) { return f[k] ? h('span', { class: 'ecm-badge', text: 'changed ' + ago(f[k]) }) : null; };
        var line = function (label, k, val) { return h('div', { class: 'ecm-kv' }, [h('span', { class: 'ecm-kv__k', text: label }), h('span', { class: 'ecm-kv__v', text: val == null || val === '' ? '—' : String(val) }), badge(k)]); };
        detail.appendChild(h('div', { class: 'ecm-kvs' }, [
          line('Title', 'title', d.title), line('Brand', 'brand', d.brand), line('Manufacturer', 'manufacturer', d.manufacturer), line('Category', 'browse', d.browse),
          line('Buy Box', 'buybox_seller', bbOurs(d) ? 'Us' + (d.buybox_price != null ? ' · ' + fmtNum(d.buybox_price) : '') : seller(d.buybox_seller) + (d.buybox_price != null ? ' · ' + fmtNum(d.buybox_price) : '')),
          line('Sellers', 'sellers', (d.sellers || []).map(seller).join(', ') + (d.offers != null ? ' · ' + d.offers + ' offers' : '')),
          line('Sales rank', null, d.sales_rank != null ? '#' + fmtInt(d.sales_rank) + (d.rank_group ? ' in ' + d.rank_group : '') : null),
          line('First seen / checked', null, fmtTime(r.first_seen_at) + ' / ' + fmtTime(r.checked_at) + ' · version ' + (r.versions || 1))]));
        detail.appendChild(h('h3', { class: 'ecm-h3', text: 'Bullets' })); if (f.bullets) detail.lastChild.appendChild(badge('bullets'));
        detail.appendChild(h('ol', { class: 'ecm-bullets' }, (d.bullets || []).map(function (b) { return h('li', { text: b }); })));
        if (d.description) detail.appendChild(h('details', null, [h('summary', { text: 'Description' }), h('p', { class: 'ecm-note', text: d.description })]));
        var pics = h('div', { class: 'ecm-thumbs' }, (d.image_links || []).map(function (u, i) {
          return h('a', { href: u, target: '_blank', rel: 'noopener' }, h('img', { src: u, alt: 'Picture ' + (i + 1), loading: 'lazy' })); }));
        detail.append(h('h3', { class: 'ecm-h3', text: 'Pictures (' + (d.images || []).length + ')' }), pics);
        if (f.images) detail.insertBefore(badge('images'), pics);
        // PIM comparison
        var p = pim[r.asin];
        if (p) {
          var same = function (a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); };
          detail.appendChild(h('h3', { class: 'ecm-h3', text: 'PIM product #' + p.id + ' compared' }));
          detail.appendChild(h('ul', { class: 'ecm-compare' }, [
            h('li', { class: same(p.title, d.title) ? 'is-same' : 'is-diff', text: 'Title: ' + (same(p.title, d.title) ? 'same' : 'differs — PIM: ' + shortVal(p.title)) }),
            h('li', { class: same(p.bullets, d.bullets) ? 'is-same' : 'is-diff', text: 'Bullets: ' + (same(p.bullets, d.bullets) ? 'same' : 'differ — PIM has ' + (p.bullets || []).length + ', Amazon ' + (d.bullets || []).length) }),
            h('li', { class: same(p.content, d.description) ? 'is-same' : 'is-diff', text: 'Description: ' + (same(p.content, d.description) ? 'same' : 'differs') })]));
        }
        // change history (only the changed values)
        var hist = h('div', null, h('p', { class: 'ecm-note', text: 'Loading the changes…' }));
        detail.append(h('h3', { class: 'ecm-h3', text: 'Changes' }), hist);
        client.from('ecom_amz_catalog_changes').select('field,old_value,new_value,detected_at').eq('connection_id', conn.id).eq('marketplace_id', r.marketplace_id)
          .eq('asin', r.asin).order('detected_at', { ascending: false }).limit(200).then(function (res2) {
            var list = res2.data || [];
            hist.replaceChildren(list.length ? dataTable('monitor-history', { title: 'Changes', cols: [
              { k: 'detected_at', t: 'When', f: isoMinute }, { k: 'field', t: 'Field', f: function (v) { return FIELD_NAME[v] || v; } },
              { k: 'old_value', t: 'Before', f: shortVal, wide: true }, { k: 'new_value', t: 'After', f: shortVal, wide: true }] }, list, conn).el
              : h('p', { class: 'ecm-note', text: 'No change since this product was first seen (' + fmtTime(r.first_seen_at) + ').' }));
          });
        // review topics
        var rv = reviews[r.marketplace_id + '|' + r.asin];
        detail.appendChild(h('h3', { class: 'ecm-h3', text: 'Review topics' + (rv && rv.date_start ? ' (' + fmtDay(rv.date_start) + ' – ' + fmtDay(rv.date_end) + ', from Amazon)' : '') }));
        if (!rv) detail.appendChild(h('p', { class: 'ecm-note', text: 'No review topics for this product yet (the first sync reads 10 random products).' }));
        else ['positive', 'negative'].forEach(function (kind) {
          var list = rv[kind] || [];
          detail.appendChild(h('p', { class: 'ecm-h4', text: (kind === 'positive' ? 'Liked' : 'Disliked') + ' (' + list.length + ')' }));
          detail.appendChild(h('ul', { class: 'ecm-topics' }, list.map(function (t) {
            var m = t.asinMetrics || {};
            return h('li', null, [h('strong', { text: t.topic }), h('span', { class: 'ecm-note', text: ' · ' + (m.numberOfMentions != null ? m.numberOfMentions + ' mentions' : '') +
              (m.occurrencePercentage != null ? ' · ' + m.occurrencePercentage + ' % of reviews' : '') + (m.starRatingImpact != null ? ' · star impact ' + m.starRatingImpact : '') }),
              (t.reviewSnippets || []).length ? h('ul', { class: 'ecm-snippets' }, t.reviewSnippets.map(function (s) { return h('li', { text: '“' + s + '”' }); })) : null]);
          })));
        });
        detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }).catch(function (e) {
      viewFailed(box, /does not exist|schema cache/i.test(e.message) ? new Error('the product monitor tables are not there yet: run supabase/0047-ecom-pim.sql in Supabase (SQL Editor)') : e);
    });
  }
  ROUTES.monitor = viewMonitor;

  function cellValue(c, r) {
    var v = c.calc ? c.calc(r) : r[c.k];
    return c.f ? c.f(v) : v;
  }
  // ---- Tables show 20 rows at a time (owner: 30 on 16 Nov 2026, 20 on 18 Nov).
  //      Search, sorting and the CSV download still cover every row. onGo(page) draws the rows of that page.
  var PAGE_ROWS = 20;
  function pagerBar(onGo) {
    var st = { page: 0, total: 0 };
    var prev = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: '‹ Previous' });
    var next = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Next ›' });
    var info = h('span', { class: 'ecm-pager__info', 'aria-live': 'polite' });
    var el = h('div', { class: 'ecm-pager', role: 'navigation', 'aria-label': 'Table pages' }, [prev, info, next]);
    function pages() { return Math.max(1, Math.ceil(st.total / PAGE_ROWS)); }
    function paint() {
      var from = st.page * PAGE_ROWS + 1, to = Math.min(st.total, (st.page + 1) * PAGE_ROWS);
      info.textContent = 'Rows ' + fmtInt(from) + '–' + fmtInt(to) + ' of ' + fmtInt(st.total) + ' · page ' + (st.page + 1) + ' of ' + pages();
      prev.disabled = st.page === 0;
      next.disabled = st.page >= pages() - 1;
      el.hidden = st.total <= PAGE_ROWS;
    }
    function go(p) { st.page = p; paint(); onGo(p); }
    prev.addEventListener('click', function () { if (st.page > 0) go(st.page - 1); });
    next.addEventListener('click', function () { if (st.page < pages() - 1) go(st.page + 1); });
    return {
      el: el,
      set: function (total, page) { st.total = total; st.page = Math.min(Math.max(0, page || 0), pages() - 1); paint(); },
      page: function () { return st.page; }
    };
  }
  // The table under a view: search, sort, CSV. `outer(row)` = the view's filter bar (marketplace + dates).
  function dataTable(id, cfg, rows, conn, outer) {
    var st = { q: '', sort: cfg.sort || null, dir: cfg.sortDir || 1 };
    var search = h('input', { class: 'ecm-input', type: 'search', placeholder: 'Search', 'aria-label': 'Search this table' });
    var count = h('span', { class: 'ecm-tools__count', 'aria-live': 'polite' });
    var csvBtn = h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Download for Excel (CSV)' });
    var thead = h('thead'), tbody = h('tbody');
    var table = h('table', { class: 'ecm-table' }, [h('caption', { class: 'visually-hidden', text: cfg.title + ' of ' + conn.label }), thead, tbody]);
    var shown = [];
    var pager = pagerBar(drawRows);

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
      if (cfg.onRow) tr.appendChild(h('th', { scope: 'col' }, h('span', { class: 'visually-hidden', text: 'Open' })));
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
      pager.set(shown.length, 0);   // every search, sort or filter change starts at page 1
      drawRows();
      count.textContent = 'Showing ' + fmtInt(shown.length) + ' of ' + fmtInt(rows.length) +
        (shown.length > PAGE_ROWS ? ' · ' + PAGE_ROWS + ' per page; the download has all' : '');
    }
    function drawRows() {
      tbody.innerHTML = '';
      var start = pager.page() * PAGE_ROWS;
      shown.slice(start, start + PAGE_ROWS).forEach(function (r) {
        var tr = h('tr');
        cfg.cols.forEach(function (c) {
          var v = cellValue(c, r);
          var cls = [c.num ? 'is-num' : '', c.wide ? 'is-wide' : '', c.mono ? 'ecm-mono' : ''].join(' ').trim() || null;
          tr.appendChild(h('td', { class: cls, text: c.num ? fmtNum(v) : (v == null ? '' : String(v)) }));
        });
        // cfg.onRow(row): a small "Open" button at the end of each row (PIM lists, product monitor)
        if (cfg.onRow) tr.appendChild(h('td', null, h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small',
          text: cfg.onRowLabel || 'Open', onclick: function () { cfg.onRow(r); } })));
        tbody.appendChild(tr);
      });
    }
    search.addEventListener('input', function () { st.q = this.value.trim(); apply(); });
    csvBtn.addEventListener('click', function () {
      csvDownload('ecommerce-' + id + '-' + new Date().toISOString().slice(0, 10) + '.csv',
        cfg.cols.map(function (c) { return c.t; }),
        shown.map(function (r) { return cfg.cols.map(function (c) { return cellValue(c, r); }); }));
    });
    apply();
    return { el: h('div', null, [h('div', { class: 'ecm-tools' }, [search, csvBtn, count]), h('div', { class: 'ecm-tablewrap' }, table), pager.el]), refresh: apply };
  }

  // ---- money in several currencies: never added together. The main currency (largest amount, or the one the
  //      charts use) is the tile's value; the others go into the hint.
  function curOrder(map) {
    return Object.keys(map).filter(function (c) { return map[c]; }).sort(function (a, b) { return Math.abs(map[b]) - Math.abs(map[a]); });
  }
  function moneyKpi(label, map, hint, main, tone) {
    var keys = curOrder(map);
    if (!main || !map[main]) main = keys[0];
    var rest = keys.filter(function (c) { return c !== main; }).map(function (c) { return fmtInt(map[c]) + ' ' + c; });
    return { label: label, value: main ? fmtInt(map[main]) + ' ' + main : '—', tone: tone,
             hint: (rest.length ? 'also ' + rest.join(' · ') + (hint ? ' · ' : '') : '') + (hint || '') };
  }
  function otherCurNote(curs, main) {
    var o = curs.filter(function (c) { return c !== main; });
    return o.length ? 'Amounts in ' + o.join(', ') + ' are not in this chart (another currency); choose that marketplace in the filter to see them.' : null;
  }
  // Every day from the first to the last key, so days without data show as zero.
  function fillDays(keys) {
    if (!keys.length) return [];
    var out = [], t = Date.parse(keys[0] + 'T12:00:00Z'), last = keys[keys.length - 1];
    for (var k = 0; k < 800; k++) { var d = isoDay(new Date(t + k * 86400000)); out.push(d); if (d >= last) break; }
    return out;
  }
  function add(map, key, v) { map[key] = (map[key] || 0) + (Number(v) || 0); }
  var pctFmt = function (v) { return Math.round(v * 10) / 10 + ' %'; };
  var pct2Fmt = function (v) { return v.toFixed(2) + ' %'; };

  // ---- Sales = Amazon's Business Report: daily totals per marketplace (all days), the SKU table of the latest period
  function viewSales(box, cfg, rows, stats, conn, daily) {
    var latest = {};
    rows.forEach(function (r) { if (!latest[r.marketplace_id] || r.period_end > latest[r.marketplace_id]) latest[r.marketplace_id] = r.period_end; });
    var skuRows = rows.filter(function (r) { return r.period_end === latest[r.marketplace_id]; });
    var pEnd = skuRows.reduce(function (a, r) { return r.period_end > a ? r.period_end : a; }, '');
    var pStart = (skuRows.filter(function (r) { return r.period_end === pEnd; })[0] || {}).period_start;
    var lastDay = daily.reduce(function (a, r) { return r.day > a ? r.day : a; }, '');
    var mps = uniq(daily.map(function (r) { return r.marketplace_id; }).concat(skuRows.map(function (r) { return r.marketplace_id; })));
    var kpiBox = h('div'), chartBox = h('div', { class: 'ecm-charts' });
    var bar = filterBar({ mps: mps, dateLabel: 'Days', endDay: lastDay || null,
                          presets: [[7, '7 days'], [14, '14 days'], [30, '30 days'], ['', 'All']] }, render);
    var tbl = dataTable('sales', cfg, skuRows, conn, function (r) { return bar.mpOk(r.marketplace_id); });
    box.append(bar.el, kpiBox, chartBox,
      h('h2', { class: 'ecm-h2 ecm-section-h', text: 'Per SKU' + (pStart ? ' (' + fmtDay(pStart) + ' – ' + fmtDay(pEnd) + '; test mode: the 100 best-selling per marketplace)' : '') }),
      skuRows.length ? tbl.el : h('p', { class: 'ecm-note', text: 'Comes with the next sync.' }));
    function render() {
      var d = daily.filter(function (r) { return bar.mpOk(r.marketplace_id) && bar.dateOk(r.day); });
      var days = uniq(d.map(function (r) { return r.day; })).sort();
      var by = {}, tot = { sales: {}, units: 0, items: 0, refunded: 0, sessions: 0, views: 0, bbw: 0, bbv: 0 };
      days.forEach(function (k) { by[k] = { sales: {}, units: 0, refunded: 0, sessions: 0 }; });
      d.forEach(function (r) {
        var x = by[r.day], cur = r.currency || '';
        add(x.sales, cur, r.ordered_sales); add(tot.sales, cur, r.ordered_sales);
        x.units += r.units_ordered || 0; x.refunded += r.units_refunded || 0; x.sessions += r.sessions || 0;
        tot.units += r.units_ordered || 0; tot.items += r.total_order_items || 0; tot.refunded += r.units_refunded || 0;
        tot.sessions += r.sessions || 0; tot.views += r.page_views || 0;
        if (r.buy_box_pct != null && r.page_views) { tot.bbw += r.buy_box_pct * r.page_views; tot.bbv += r.page_views; }
      });
      var curs = curOrder(tot.sales), main = curs[0] || '';
      kpiBox.replaceChildren(kpiRow([
        moneyKpi('Ordered sales', tot.sales, days.length ? fmtDay(days[0]) + ' – ' + fmtDay(days[days.length - 1]) + ', VAT incl.' : 'no days', main),
        { label: 'Units ordered', value: fmtInt(tot.units), hint: fmtInt(tot.items) + ' order items' },
        { label: 'Sessions', value: fmtInt(tot.sessions), hint: fmtInt(tot.views) + ' page views' },
        { label: 'Conversion', value: pctOf(tot.units, tot.sessions), hint: 'units ordered per session', tone: 'up' },
        { label: 'Buy Box', value: tot.bbv ? (tot.bbw / tot.bbv).toFixed(1) + ' %' : '—', hint: 'share of page views' },
        { label: 'Units refunded', value: fmtInt(tot.refunded), hint: pctOf(tot.refunded, tot.units) + ' of units ordered', tone: tot.refunded ? 'down' : null }
      ]));
      chartBox.replaceChildren(
        chart({ title: 'Ordered sales per day' + (main ? ' (' + main + ')' : ''), labels: days, xFmt: fmtDay, note: otherCurNote(curs, main),
          tipFmt: function (v) { return fmtNum(v, 2) + ' ' + main; },
          series: [{ name: 'Sales', values: days.map(function (k) { return by[k].sales[main] || 0; }), color: 'var(--partner)', kind: 'bar' }] }),
        chart({ title: 'Units per day', labels: days, xFmt: fmtDay,
          series: [{ name: 'Units ordered', values: days.map(function (k) { return by[k].units; }), color: 'var(--accent)', kind: 'bar' },
                   { name: 'Units refunded', values: days.map(function (k) { return by[k].refunded; }), color: 'var(--act)', kind: 'bar' }] }),
        chart({ title: 'Sessions per day', labels: days, xFmt: fmtDay,
          series: [{ name: 'Sessions', values: days.map(function (k) { return by[k].sessions; }), color: 'var(--partner)' }] }),
        chart({ title: 'Conversion per day (units ordered per session)', labels: days, xFmt: fmtDay, yFmt: pctFmt, tipFmt: pct2Fmt,
          series: [{ name: 'Conversion %', values: days.map(function (k) { return by[k].sessions ? by[k].units * 100 / by[k].sessions : null; }), color: 'var(--ok)' }] })
      );
      tbl.refresh();
    }
    render();
  }

  // ---- Finance = Amazon's finance transactions: totals of ALL transactions per day, marketplace, type and currency
  //      (ecom_amz_stats, dataset "finance"), and the sample of single transactions
  var FIN_TYPES = {
    title: 'Totals per transaction type',
    cols: [
      { k: 'type', t: 'Type' },
      { k: 'currency', t: 'Cur.' },
      { k: 'count', t: 'Transactions', num: true },
      { k: 'sales', t: 'Sales', num: true },
      { k: 'expenses', t: 'Fees and costs', num: true },
      { k: 'refunded_sales', t: 'Refunded sales', num: true },
      { k: 'refunded_expenses', t: 'Fees refunded', num: true },
      { k: 'other', t: 'Other', num: true },
      { k: 'total', t: 'Net', num: true },
      { k: 'deferred', t: 'Held back', num: true }
    ]
  };
  // Transfer = payout to the bank, DebtRecovery = charge to the seller's card: money moving, no income. They stay
  // out of net, sales and the charts (the server books their amounts as "other"); payouts get their own tile.
  var FIN_MOVES = { Transfer: 1, DebtRecovery: 1 };
  function viewFinance(box, cfg, rows, stats, conn) {
    var fin = (stats || []).filter(function (s) { return s.dataset === 'finance'; });
    var mps = uniq(fin.map(function (s) { return s.marketplace_id; }).concat(rows.map(function (r) { return r.mp_id || 'ALL'; })));
    var kpiBox = h('div'), chartBox = h('div', { class: 'ecm-charts' }), typeBox = h('div');
    var bar = filterBar({ mps: mps, dateLabel: 'Posted', presets: [[7, '7 days'], [30, '30 days'], ['', 'All']] }, render);
    var tbl = dataTable('finance', cfg, rows, conn, function (r) { return bar.mpOk(r.mp_id || 'ALL') && bar.dateOk(String(r.posted_at || '').slice(0, 10)); });
    box.append(bar.el);
    if (!fin.length) box.appendChild(h('p', { class: 'ecm-note', text: 'The totals of all transactions appear after the next sync (needs supabase/0036).' }));
    box.append(kpiBox, chartBox, h('h2', { class: 'ecm-h2 ecm-section-h', text: 'Totals per transaction type' }), typeBox,
      h('h2', { class: 'ecm-h2 ecm-section-h', text: 'Transactions (test sample: the newest 100 Amazon sent)' }), tbl.el);
    var TYPE_KEYS = ['count', 'sales', 'expenses', 'refunded_sales', 'refunded_expenses', 'other', 'total', 'deferred'];
    function render() {
      var tot = { total: {}, sales: {}, fees: {}, refunds: {}, deferred: {}, payout: {}, count: 0 }, days = {}, types = {};
      fin.forEach(function (s) {
        if (!bar.mpOk(s.marketplace_id) || !bar.dateOk(s.period_start)) return;
        var m = s.metrics, cur = m.currency || '', type = s.dim.split('|')[0];
        var t = types[type + '|' + cur] || (types[type + '|' + cur] = { type: type, currency: cur });
        TYPE_KEYS.forEach(function (k) { t[k] = (t[k] || 0) + (m[k] || 0); });
        if (FIN_MOVES[type]) { if (type === 'Transfer') add(tot.payout, cur, m.total); return; }
        var refunds = (m.refunded_sales || 0) + (m.refunded_expenses || 0);
        add(tot.total, cur, m.total); add(tot.sales, cur, m.sales); add(tot.fees, cur, m.expenses);
        add(tot.refunds, cur, refunds); add(tot.deferred, cur, m.deferred);
        tot.count += m.count || 0;
        var dd = days[s.period_start] || (days[s.period_start] = {});
        var dc = dd[cur] || (dd[cur] = { total: 0, sales: 0, fees: 0, refunds: 0 });
        dc.total += m.total || 0; dc.sales += m.sales || 0; dc.fees += m.expenses || 0; dc.refunds += refunds;
      });
      var curs = curOrder(tot.sales).concat(curOrder(tot.total)).filter(function (c, i, a) { return a.indexOf(c) === i; });
      var main = curs[0] || '';
      var dk = fillDays(Object.keys(days).sort());
      var dv = function (k, f) { return (days[k] && days[k][main] && days[k][main][f]) || 0; };
      kpiBox.replaceChildren(kpiRow([
        moneyKpi('Net', tot.total, 'earned in this range, before payouts', main),
        moneyKpi('Sales', tot.sales, 'charged to customers, plus reimbursements', main, 'up'),
        moneyKpi('Fees and costs', tot.fees, 'charged by Amazon', main, 'down'),
        moneyKpi('Refunds', tot.refunds, 'refunded sales less fees returned', main),
        { label: 'Transactions', value: fmtInt(tot.count), hint: dk.length ? fmtDay(dk[0]) + ' – ' + fmtDay(dk[dk.length - 1]) : 'none in this range' },
        moneyKpi('Held back', tot.deferred, 'deferred: Amazon pays it out later (as of the last sync)', main),
        moneyKpi('Paid out to your bank', tot.payout, 'payouts in this range; not income', main)
      ]));
      chartBox.replaceChildren(
        chart({ title: 'Net per day' + (main ? ' (' + main + ')' : ''), labels: dk, xFmt: fmtDay, note: otherCurNote(curs, main),
          tipFmt: function (v) { return fmtNum(v, 2) + ' ' + main; },
          series: [{ name: 'Net', values: dk.map(function (k) { return dv(k, 'total'); }), color: 'var(--partner)', kind: 'bar' }] }),
        chart({ title: 'Sales, fees and refunds per day' + (main ? ' (' + main + ')' : ''), labels: dk, xFmt: fmtDay,
          tipFmt: function (v) { return fmtNum(v, 2) + ' ' + main; },
          series: [{ name: 'Sales', values: dk.map(function (k) { return dv(k, 'sales'); }), color: 'var(--ok)', kind: 'bar' },
                   { name: 'Fees and costs', values: dk.map(function (k) { return dv(k, 'fees'); }), color: 'var(--accent)', kind: 'bar' },
                   { name: 'Refunds', values: dk.map(function (k) { return dv(k, 'refunds'); }), color: 'var(--act)', kind: 'bar' }] })
      );
      // money movements (payouts) last; types with only release records of earlier money (count 0) left out
      var typeRows = Object.keys(types).map(function (k) {
        var t = types[k];
        TYPE_KEYS.forEach(function (f) { if (f !== 'count') t[f] = Math.round(t[f] * 100) / 100; });
        return t;
      }).filter(function (t) { return t.count; }).sort(function (a, b) {
        return (FIN_MOVES[a.type] ? 1 : 0) - (FIN_MOVES[b.type] ? 1 : 0) || Math.abs(b.total) - Math.abs(a.total);
      });
      typeBox.replaceChildren(typeRows.length ? dataTable('finance-types', FIN_TYPES, typeRows, conn, null).el
                                              : h('p', { class: 'ecm-note', text: 'No transactions in this range.' }));
      tbl.refresh();
    }
    render();
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
    // invitations (supabase/0042, 12 Nov 2026): people added before their first sign-in; without 0042 the list is empty
    Promise.all([rpc('ecom_list_members', { p_workspace: ws.id }),
                 rpc('ecom_list_invites', { p_workspace: ws.id }).catch(function () { return []; })]).then(function (res) {
      var rows = res[0], invites = res[1] || [];
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
      invites.forEach(function (iv) {
        var td = h('td');
        if (isAdmin()) {
          td.appendChild(h('button', { type: 'button', class: 'ecm-btn ecm-btn--ghost ecm-btn--small', text: 'Cancel', onclick: function () {
            if (!window.confirm('Cancel the invitation for ' + iv.email + '?')) return;
            rpc('ecom_cancel_invite', { p_workspace: ws.id, p_email: iv.email }).then(function () { renderTeam(card); }).catch(function (e) { toast(e.message, 'act'); });
          } }));
        }
        tbody.appendChild(h('tr', null, [h('td', { text: iv.email }), h('td', { text: iv.role + ' · invited, joins at the first sign-in' }),
          h('td', { text: fmtTime(iv.invited_at) }), td]));
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
          var mail = email.value.trim();
          rpc('ecom_add_member', { p_workspace: ws.id, p_email: mail, p_role: role.value }).then(function (id) {
            toast(id ? 'Added ' + mail + '.' : 'Invited ' + mail + ': they join this workspace at their first sign-in.'); renderTeam(card);
          }).catch(function (e2) { err.textContent = e2.message; add.disabled = false; });
        });
        box.appendChild(form);
        box.appendChild(err);
        box.appendChild(h('p', { class: 'ecm-note', text: 'Someone who has not signed in yet is invited: at their first sign-in on solvephantasma.com (for example with Google) they join this workspace. Adding or inviting someone also lets them into this service.' }));
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
    card.appendChild(h('p', { class: 'ecm-note', text: 'Account: ' + conn.label + '. ' + TEST_NOTE + ' Data sets in the test run: FBA stock and stock development (30 days), business report (30 days), finance transactions (30 days), listings, repeat purchase (last 4 full weeks), product monitor (live content and offers of the 100 best-selling products per marketplace), review topics (10 products). Amazon prepares reports in a few minutes; you can leave this page and come back.' }));
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
    // PAGE_ROWS jobs per page; the page is kept while the list refreshes every few seconds during a sync
    function jobRows(page) {
      syncPage = page;
      tbody.innerHTML = '';
      jobs.slice(page * PAGE_ROWS, (page + 1) * PAGE_ROWS).forEach(function (j) {
        tbody.appendChild(h('tr', null, [
          h('td', { text: DATASET[j.dataset] || j.dataset }),
          h('td', { text: j.marketplace_id ? mpCode(j.marketplace_id) : 'All' }),
          h('td', null, status(j.status)),
          h('td', { class: 'is-num', text: j.rows_written ? fmtNum(j.rows_written, 0) : '' }),
          h('td', { class: 'is-wide', text: j.message || '' }),
          h('td', { text: fmtTime(j.finished_at || j.updated_at) })
        ]));
      });
    }
    var jpager = pagerBar(jobRows);
    jpager.set(jobs.length, syncPage);
    jobRows(jpager.page());
    card.appendChild(h('div', { class: 'ecm-tablewrap' }, h('table', { class: 'ecm-table' }, [
      h('caption', { class: 'visually-hidden', text: 'Jobs of the latest sync' }),
      h('thead', null, h('tr', null, ['Data set', 'Market', 'Status', 'Rows', 'Message', 'Time'].map(function (t, i) { return h('th', { scope: 'col', class: i === 3 ? 'is-num' : null, text: t }); }))),
      tbody
    ])));
    card.appendChild(jpager.el);
  }
  function syncCard() { return $('#ecm-sync'); }
  function startSync() {
    var conn = current(); if (!conn) return;
    syncPage = 0;
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
  /* 9. For pim.js (PIM, image library, A+ content; 18 Nov 2026): this page's helpers and the route registry ------ */
  function invoke(name, body) {   // any Edge Function of this service; its own error text comes back in {error}
    return client.functions.invoke(name, { body: body }).then(function (r) {
      if (!r.error) return r.data;
      var ctx = r.error.context;
      if (ctx && typeof ctx.json === 'function') {
        return ctx.json().catch(function () { return {}; }).then(function (j) {
          var er = j && j.error;   // {error: "text"} or {ok: false, error: {code, message}}
          if (j && j.code === 'NOT_FOUND') er = 'The server function ' + name + ' is not deployed yet.';
          throw new Error((er && er.message) || (typeof er === 'string' && er) || 'The server function ' + name + ' is not reachable.');
        });
      }
      throw new Error('The server function ' + name + ' is not reachable.');
    });
  }
  // "5 min ago", "3 h ago", "2 days ago" (product monitor: "changed X ago")
  function ago(v) {
    if (!v) return '—';
    var s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
    if (s < 90) return 'just now';
    if (s < 5400) return Math.round(s / 60) + ' min ago';
    if (s < 129600) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' days ago';
  }
  window.EcomApp = {
    h: h, $: $, toast: toast, store: store, load: load, rpc: rpc, invoke: invoke, header: header, ago: ago,
    client: function () { return client; }, ws: function () { return ws; }, user: function () { return user; },
    conn: function () { return current(); }, conns: function () { return conns; }, isAdmin: isAdmin,
    dataTable: dataTable, pagerBar: pagerBar, PAGE_ROWS: PAGE_ROWS, csvDownload: csvDownload,
    fmtInt: fmtInt, fmtNum: fmtNum, fmtTime: fmtTime, fmtDay: fmtDay, mpCode: mpCode, isoMinute: isoMinute,
    // pim.js registers its pages here; an open page of that id is drawn again at once
    route: function (id, fn) { ROUTES[id] = fn; if (started && location.hash.replace(/^#\/?/, '').split('/')[0] === id) route(); },
    go: function () { route(); }
  };

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
