/* Tender Portal demo (solvephantasma.com/tenders/) - one file, no framework; one library: supabase-js
 * (loaded before this file, as on the website).
 *
 * Every page is a static shell written by app/build_demo.py; <body data-page="..."> names the view.
 * Signed out, this file shows only a sign-in gate (Google's own button). Signed in, it downloads the
 * JSON from the private Supabase Storage bucket 'tender-demo' (readable by signed-in users only:
 * supabase/tender-demo-storage.sql; uploaded by app/publish_demo.py) and fills #app. The pages are
 * on the website's origin, so the website's login is this login. Charts are inline SVG drawn here.
 * Source: D:\Web Development\Tender Portal\app\demo\app.js (the copy in tenders/ is generated).
 *
 * Rules kept here: facts only (counts, sums, dates, prices; no scores or labels about companies);
 * every tender links to its original record; documents link to the state's copy; text from the
 * data goes into the page with textContent, never as HTML.
 */
(function () {
  'use strict';

  const PAGE = document.body.getAttribute('data-page') || '';
  const APP = document.getElementById('app');
  const TITLE = document.getElementById('title');
  const LEAD = document.getElementById('lead');
  const SVGNS = 'http://www.w3.org/2000/svg';
  const MAIL = 'consult@solvephantasma.com';
  const DASH = '–';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* Login and data: the website's Supabase project (same constants as the website's script.js). The
     publishable key and the Google client id are public by design; the data is protected by the
     bucket's policy, not by this file. */
  const SUPABASE_URL = 'https://muumpjtpjnoxxdkhqtik.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_R6Ruxp1ehYAGVcFRqrM_Lg_n1ahoV8e';
  const BUCKET = 'tender-demo';
  const GOOGLE_CLIENT_ID = '396544181713-ecijt1nf7u1qs4tej5n51vh7p4uu7m66.apps.googleusercontent.com';
  const OTHER_LOGIN = '../services.html';     // the website's own login dialog (email, LinkedIn)
  let sb = null;                              // the supabase-js client, made in boot()

  /* ------------------------------------------------------------------ DOM helpers */

  function setProps(n, props) {
    if (!props) return;
    Object.keys(props).forEach((k) => {
      const v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = String(v);
      else if (k === 'on') Object.keys(v).forEach((e) => n.addEventListener(e, v[e]));
      else n.setAttribute(k, v === true ? '' : String(v));
    });
  }
  function add(n, kids) {
    if (kids === null || kids === undefined || kids === false) return n;
    (Array.isArray(kids) ? kids : [kids]).forEach((c) => {
      if (c === null || c === undefined || c === false || c === '') return;
      if (Array.isArray(c)) add(n, c);
      else n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return n;
  }
  /** HTML element: h('a', {href, class, text, on: {click}}, children) */
  function h(tag, props, kids) {
    const n = document.createElement(tag);
    setProps(n, props);
    return add(n, kids);
  }
  /** SVG element */
  function s(tag, props, kids) {
    const n = document.createElementNS(SVGNS, tag);
    setProps(n, props);
    return add(n, kids);
  }
  function clear(n) {
    while (n.firstChild) n.removeChild(n.firstChild);
    return n;
  }
  /** Georgian content as published, in a lang="ka" span */
  function ka(text, cls) {
    return h('span', { lang: 'ka', class: cls, text: text === null || text === undefined ? '' : text });
  }
  let uid = 0;
  function nextId(prefix) {
    uid += 1;
    return (prefix || 'x') + uid;
  }

  /* ------------------------------------------------------------------ formats */

  const NF0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
  const NF1 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const NF2 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isNum = (n) => typeof n === 'number' && isFinite(n);
  const int = (n) => (isNum(n) ? NF0.format(n) : DASH);
  const one = (n) => (isNum(n) ? NF1.format(n) : DASH);
  const lari = (n) => (isNum(n) ? '₾' + NF0.format(Math.round(n)) : DASH);
  function money(n, cur) {
    if (!isNum(n)) return DASH;
    return !cur || cur === 'GEL' ? '₾' + NF2.format(n) : NF2.format(n) + ' ' + cur;
  }
  /** 18234567 -> '₾18.2M' */
  function short(n, sign) {
    if (!isNum(n)) return DASH;
    const pre = sign === undefined ? '₾' : sign;
    const a = Math.abs(n);
    let v;
    let u;
    if (a >= 1e9) { v = n / 1e9; u = 'B'; } else if (a >= 1e6) { v = n / 1e6; u = 'M'; } else if (a >= 1e4) { v = n / 1e3; u = 'K'; } else return pre + NF0.format(Math.round(n));
    return pre + (Math.abs(v) >= 100 ? NF0.format(v) : NF1.format(v).replace(/\.0$/, '')) + u;
  }
  const pct = (n) => (isNum(n) ? NF1.format(n) + '%' : DASH);
  function plural(n, word, many) {
    return int(n) + ' ' + (n === 1 ? word : many || word + 's');
  }
  function day(iso) {
    if (!iso) return DASH;
    const p = iso.slice(0, 10).split('-');
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }
  function dayTime(iso) {
    if (!iso) return DASH;
    return day(iso) + (iso.length > 10 ? ', ' + iso.slice(11, 16) : '');
  }
  function monthName(ym) {
    return MONTHS[Number(ym.slice(5, 7)) - 1] + ' ' + ym.slice(0, 4);
  }
  function monthEnd(ym) {
    const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
    return ym + '-' + String(d).padStart(2, '0');
  }
  /** Deadlines are Georgian time (UTC+4) */
  function deadlineMs(iso) {
    if (!iso) return null;
    const t = Date.parse(iso.length > 10 ? iso.slice(0, 16) + ':00+04:00' : iso + 'T23:59:00+04:00');
    return isNaN(t) ? null : t;
  }
  function isOpen(iso) {
    const t = deadlineMs(iso);
    return t !== null && t > Date.now();
  }
  function closesIn(iso) {
    const t = deadlineMs(iso);
    if (t === null) return '';
    const days = Math.floor((t - Date.now()) / 864e5);
    if (days < 0) return 'closed';
    if (days === 0) return 'closes today';
    return 'closes in ' + plural(days, 'day');
  }
  function discount(est, offer) {
    return isNum(est) && est > 0 && isNum(offer) ? Math.round(((est - offer) / est) * 1000) / 10 : null;
  }

  /* ------------------------------------------------------------------ data, links, state */

  /* One JSON file from the private bucket, downloaded with the visitor's login (once per page).
     A failed download rejects with err.status = the HTTP status. Storage answers 400 both for a
     file that is missing and for one the bucket's policy hides from this account. */
  const cache = {};
  function load(path) {
    if (!cache[path]) {
      cache[path] = sb.storage.from(BUCKET).download(path).then((res) => {
        if (res.error) {
          const e = res.error;
          const status = Number(e.status || (e.originalError && e.originalError.status) || e.statusCode) || 0;
          const err = new Error((status ? 'HTTP ' + status : e.message || 'Error') + ' for ' + path);
          err.status = status;
          throw err;
        }
        return res.data.text();
      }).then((text) => JSON.parse(text));
    }
    return cache[path];
  }
  /* 400 / 403 (404 too, should Storage ever answer that way): this account may not read the data */
  const noAccess = (err) => !!err && [400, 403, 404].indexOf(err.status) >= 0;
  function byId(rows) {
    const m = {};
    rows.forEach((r) => { m[r.id] = r; });
    return m;
  }

  function readHash() {
    const o = {};
    new URLSearchParams(location.hash.replace(/^#/, '')).forEach((v, k) => {
      if (v !== '') o[k] = v;
    });
    return o;
  }
  function hashOf(o) {
    const p = new URLSearchParams();
    Object.keys(o).forEach((k) => {
      if (o[k] !== undefined && o[k] !== null && o[k] !== '') p.set(k, o[k]);
    });
    const q = p.toString();
    return q ? '#' + q : '';
  }
  /** Keep the state in the address bar without adding history entries */
  function setHash(o) {
    const x = hashOf(o);
    if (x === location.hash || (x === '' && location.hash === '')) return;
    history.replaceState(null, '', location.pathname + location.search + x);
  }
  const tenderUrl = (no) => 'tender.html?no=' + encodeURIComponent(no);
  const companyUrl = (id) => 'company.html?id=' + encodeURIComponent(id);
  const buyerUrl = (id) => 'buyer.html?id=' + encodeURIComponent(id);
  const listUrl = (o) => 'tenders.html' + hashOf(o || {});
  const param = (name) => new URLSearchParams(location.search).get(name) || '';

  /* Lookups from summary.json (labels of categories, statuses, procedures) */
  const L = { cat: {}, status: {}, proc: {}, order: {} };
  function lookups(S) {
    S.categories.forEach((c) => { L.cat[c.k] = c; });
    S.statuses.forEach((x, i) => { L.status[x.k] = x; L.order[x.k] = i; });
    S.procedures.forEach((x) => { L.proc[x.k] = x; });
  }
  const catLabel = (k) => (L.cat[k] ? L.cat[k].label : k === 'other' ? 'Other categories' : k || DASH);
  function statusText(k) {
    const x = L.status[k];
    return x ? x.en || x.ka : k;
  }
  /** Status in English (the Georgian original as a tooltip); unknown ones in Georgian */
  function statusNode(k) {
    const x = L.status[k];
    if (!x) return k || DASH;
    return x.en ? h('span', { title: x.ka || null, text: x.en }) : ka(x.ka);
  }
  function procText(k) {
    const x = L.proc[k];
    return x && x.en ? k + ' · ' + x.en : k;
  }

  /* ------------------------------------------------------------------ small building blocks */

  function setTitle(parts, docTitle) {
    clear(TITLE);
    add(TITLE, parts);
    document.title = docTitle + ' · Tender Portal demo · Phantasma';
  }
  function setLead(kids) {
    if (!LEAD) return;
    clear(LEAD);
    add(LEAD, kids);
    LEAD.hidden = !kids;
  }
  function section(title, kids, cls) {
    const id = nextId('s');
    return h('section', { class: 'block ' + (cls || ''), 'aria-labelledby': id }, [h('h2', { id: id, text: title }), kids]);
  }
  function card(title, sub, cls) {
    const id = nextId('c');
    const body = h('div', { class: 'card__body' });
    const el = h('section', { class: 'card ' + (cls || ''), 'aria-labelledby': id }, [
      h('h2', { id: id, class: 'card__title', text: title }),
      sub ? h('p', { class: 'card__sub', text: sub }) : null,
      body,
    ]);
    return { el: el, body: body };
  }
  function para(text, cls) {
    return h('p', { class: cls || 'muted' }, text);
  }
  function kpi(label, value, sub) {
    return h('div', { class: 'kpi' }, [
      h('dt', { text: label }),
      h('dd', { class: 'kpi__value', text: value }),
      sub ? h('dd', { class: 'kpi__sub', text: sub }) : null,
    ]);
  }
  function chip(content, href, cls) {
    return href ? h('a', { class: 'chip ' + (cls || ''), href: href }, content) : h('span', { class: 'chip ' + (cls || '') }, content);
  }
  function unknown(text) {
    return h('span', { class: 'muted', title: text || 'not known yet' }, [DASH, h('span', { class: 'visually-hidden', text: ' ' + (text || 'not known yet') })]);
  }
  function fail(err) {
    console.error(err); // eslint-disable-line no-console
    clear(APP);
    if (noAccess(err)) {
      add(APP, h('div', { class: 'note' }, [
        h('p', { text: 'Your account doesn\'t have access yet.' }),
        h('p', { class: 'small' }, ['Questions? Write to ', h('a', { href: 'mailto:' + MAIL, text: MAIL }), '.']),
      ]));
      return;
    }
    add(APP, h('div', { class: 'note' }, [
      h('p', { text: 'The data could not be loaded. Reload the page, or try again later.' }),
      h('p', { class: 'small muted', text: String((err && err.message) || err) }),
    ]));
  }
  function notFound(text) {
    setTitle('Not found', 'Not found');
    clear(APP);
    add(APP, h('div', { class: 'note' }, [
      h('p', { text: text }),
      h('p', null, [h('a', { href: 'tenders.html', text: 'All tenders' }), ' · ', h('a', { href: 'companies.html', text: 'Companies' }), ' · ', h('a', { href: 'buyers.html', text: 'Buyers' })]),
    ]));
  }

  /* Tooltip: one element, filled with textContent; it repeats what labels and tables already say */
  let tipEl = null;
  function hideTip() {
    if (tipEl) tipEl.style.display = 'none';
  }
  function tip(node, lines) {
    function show(e) {
      if (!tipEl) {
        tipEl = h('div', { class: 'tip', 'aria-hidden': 'true' });
        document.body.appendChild(tipEl);
      }
      clear(tipEl);
      lines.forEach((l, i) => {
        const o = typeof l === 'object' ? l : { text: l };
        tipEl.appendChild(h(i ? 'span' : 'strong', { text: o.text, lang: o.lang || null }));
      });
      tipEl.style.display = 'block';
      const r = tipEl.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      const byPointer = e && e.type === 'pointermove';
      let x = byPointer ? e.clientX + 14 : box.left;
      let y = byPointer ? e.clientY + 16 : box.bottom + 8;
      x = Math.max(8, Math.min(x, window.innerWidth - r.width - 8));
      if (y + r.height > window.innerHeight - 8) y = Math.max(8, (byPointer ? e.clientY : box.top) - r.height - 12);
      tipEl.style.left = Math.round(x) + 'px';
      tipEl.style.top = Math.round(y) + 'px';
    }
    node.addEventListener('pointermove', show);
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', show);
    node.addEventListener('blur', hideTip);
  }
  window.addEventListener('scroll', hideTip, { passive: true });

  /* Charts redraw at their new width after a resize */
  let redraws = [];
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { redraws = redraws.filter((f) => f()); }, 150);
  });

  /* ------------------------------------------------------------------ charts (inline SVG) */

  function niceMax(v) {
    if (!(v > 0)) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  }
  /** Column with a 4px rounded top, square at the baseline */
  function colPath(x, y, w, hh) {
    const r = Math.min(4, w / 2, hh);
    return 'M' + x + ',' + (y + hh) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + hh) + 'Z';
  }

  /**
   * Column chart, one series. pts: [{label, sub, value, href, aria, tip}]
   * o: {fmt (axis and label format), label (accessible name), integer}
   * The tallest column carries its value; the axis, tooltips and the table view carry the rest.
   */
  function columns(box, pts, o) {
    let lastW = 0;
    function draw() {
      if (!document.body.contains(box)) return false;
      const W = Math.floor(box.clientWidth || box.getBoundingClientRect().width) || (lastW ? 0 : 560);
      if (!W || W === lastW) return true;
      lastW = W;
      clear(box);
      const H = 216;
      const T = 24;
      const B = 40;
      const LW = o.axis || 50;
      const R = 4;
      const pw = Math.max(40, W - LW - R);
      const ph = H - T - B;
      let max = 0;
      let maxI = -1;
      pts.forEach((p, i) => { if (p.value > max) { max = p.value; maxI = i; } });
      const top = niceMax(max);
      const svg = s('svg', { class: 'chart', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': o.label });
      let ticks = [0, top / 2, top];
      if (o.integer && top / 2 !== Math.round(top / 2)) ticks = [0, top];
      ticks.forEach((t) => {
        const y = Math.round(T + ph - (t / top) * ph) + 0.5;
        svg.appendChild(s('line', { class: t ? 'ch-grid' : 'ch-base', x1: LW, x2: W - R, y1: y, y2: y }));
        svg.appendChild(s('text', { class: 'ch-tick', x: LW - 8, y: y + 4, 'text-anchor': 'end' }, o.fmt(t)));
      });
      const band = pw / pts.length;
      const bw = Math.max(3, Math.min(24, band * 0.62));
      const every = Math.max(1, Math.ceil(pts.length / Math.max(1, Math.floor(pw / 42))));
      pts.forEach((p, i) => {
        const x0 = LW + i * band;
        const cx = x0 + band / 2;
        const hh = p.value > 0 ? Math.max(2, (p.value / top) * ph) : 0;
        const g = p.href && p.value > 0 ? s('a', { href: p.href, class: 'col', 'aria-label': p.aria }) : s('g', { class: 'col' });
        g.appendChild(s('rect', { class: 'ch-hit', x: x0, y: T, width: band, height: ph }));
        if (hh) g.appendChild(s('path', { class: 'ch-mark', d: colPath(cx - bw / 2, T + ph - hh, bw, hh) }));
        if (i === maxI && max > 0) {
          const lx = Math.max(LW + 18, Math.min(cx, W - R - 22));
          g.appendChild(s('text', { class: 'ch-val', x: lx, y: T + ph - hh - 7, 'text-anchor': 'middle' }, o.fmt(p.value)));
        }
        if (i % every === 0) {
          g.appendChild(s('text', { class: 'ch-xl', x: cx, y: T + ph + 17, 'text-anchor': 'middle' }, p.label));
          if (p.sub) g.appendChild(s('text', { class: 'ch-xs', x: cx, y: T + ph + 32, 'text-anchor': 'middle' }, p.sub));
        }
        if (p.tip) tip(g, p.tip);
        svg.appendChild(g);
      });
      box.appendChild(svg);
      return true;
    }
    draw();
    redraws.push(draw);
    if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(box); // also when a hidden tab becomes visible
  }

  /**
   * Ranked horizontal bars: label and value on one line, the bar below it (wraps on phones).
   * rows: [{label (text or node), lang, sub, value, text, href, tip}]; every row is a link when it has href.
   */
  function bars(box, rows) {
    let max = 0;
    rows.forEach((r) => { if (r.value > max) max = r.value; });
    const ol = h('ol', { class: 'bars' });
    rows.forEach((r) => {
      const w = r.value > 0 && max > 0 ? Math.max(1.5, (r.value / max) * 100) : 0;
      const track = s('svg', { class: 'bars__track', width: '100%', height: 10, 'aria-hidden': 'true', focusable: 'false' });
      if (w) {
        track.appendChild(s('rect', { class: 'ch-mark', x: 0, y: 0, width: w.toFixed(2) + '%', height: 10, rx: 4, ry: 4 }));
        if (w >= 3) track.appendChild(s('rect', { class: 'ch-mark', x: 0, y: 0, width: 4, height: 10 })); // square start
      }
      const label = typeof r.label === 'object' ? r.label : r.lang ? ka(r.label) : r.label;
      const kids = [
        h('span', { class: 'bars__label' }, [label, r.sub ? h('span', { class: 'bars__sub', text: r.sub }) : null]),
        h('span', { class: 'bars__value', text: r.text }),
        track,
      ];
      const row = r.href ? h('a', { class: 'bars__row', href: r.href }, kids) : h('div', { class: 'bars__row' }, kids);
      if (r.tip) tip(row, r.tip);
      ol.appendChild(h('li', null, row));
    });
    box.appendChild(ol);
  }

  /** "Show as table": the accessible twin of a chart */
  function tableView(cols, rows) {
    return h('details', { class: 'tableview' }, [
      h('summary', { text: 'Show as table' }),
      h('div', { class: 'tablewrap' }, h('table', { class: 'dt dt--small' }, [
        h('thead', null, h('tr', null, cols.map((c) => h('th', { scope: 'col', class: c.num ? 'num' : null, text: c.label })))),
        h('tbody', null, rows.map((r) => h('tr', null, r.map((v, i) => h('td', { class: cols[i].num ? 'num' : null }, v))))),
      ])),
    ]);
  }

  /* ------------------------------------------------------------------ sortable table */

  function compare(get, dir) {
    const m = dir === 'asc' ? 1 : -1;
    return (a, b) => {
      const x = get(a);
      const y = get(b);
      const xe = x === null || x === undefined || x === '';
      const ye = y === null || y === undefined || y === '';
      if (xe || ye) return xe === ye ? 0 : xe ? 1 : -1; // empty values last, either direction
      if (typeof x === 'string') return m * x.localeCompare(y, 'ka');
      return m * (x - y);
    };
  }

  /**
   * cols: [{key, label, num, cls, sort: row -> value, first: 'asc'|'desc', cell: row -> node(s)}]
   * st: {sort, dir, limit, step, caption}; onChange({sort, dir} | {limit}) re-renders.
   * On phones the rows turn into cards (td data-label), so cell content sits in one wrapper.
   */
  function dataTable(box, cols, rows, st, onChange) {
    clear(box);
    const col = cols.find((c) => c.key === st.sort && c.sort);
    const list = col ? rows.slice().sort(compare(col.sort, st.dir)) : rows;
    const shown = st.limit ? list.slice(0, st.limit) : list;
    const head = h('tr', null, cols.map((c) => {
      const th = h('th', { scope: 'col', class: c.num ? 'num' : null });
      if (c.sort && onChange) {
        const on = st.sort === c.key;
        th.setAttribute('aria-sort', on ? (st.dir === 'asc' ? 'ascending' : 'descending') : 'none');
        th.appendChild(h('button', {
          type: 'button', class: 'sort' + (on ? ' is-on' : ''), 'data-key': c.key,
          on: { click: () => onChange({ sort: c.key, dir: on ? (st.dir === 'asc' ? 'desc' : 'asc') : c.first || 'asc', focusSort: c.key }) },
        }, [c.label, h('span', { class: 'sort__i', 'aria-hidden': 'true', text: on ? (st.dir === 'asc' ? '▲' : '▼') : '↕' })]));
      } else {
        th.textContent = c.label;
      }
      return th;
    }));
    const body = h('tbody', null, shown.map((r) => h('tr', null, cols.map((c) =>
      h('td', { class: [c.num ? 'num' : '', c.cls || ''].join(' ').trim() || null, 'data-label': c.label }, h('div', { class: 'cell' }, c.cell(r)))))));
    box.appendChild(h('div', { class: 'tablewrap tablewrap--cards' }, h('table', { class: 'dt' }, [
      st.caption ? h('caption', { class: 'visually-hidden', text: st.caption }) : null, h('thead', null, head), body])));
    if (st.limit && list.length > st.limit) {
      const step = st.step || 100;
      box.appendChild(h('p', { class: 'more' }, [
        h('button', { type: 'button', class: 'btn btn--ghost btn--small', on: { click: () => onChange({ limit: st.limit + step, focusRow: st.limit }) } },
          'Show ' + Math.min(step, list.length - st.limit) + ' more'),
        h('span', { class: 'muted small', text: ' Showing ' + int(st.limit) + ' of ' + int(list.length) }),
      ]));
    }
    if (st.focusSort) {
      const b = box.querySelector('button.sort[data-key="' + st.focusSort + '"]');
      if (b) b.focus();
    }
    if (st.focusRow !== undefined) {
      const a = box.querySelectorAll('tbody tr')[st.focusRow];
      const link = a && a.querySelector('a');
      if (link) link.focus();
    }
    return list;
  }

  /* ------------------------------------------------------------------ form controls */

  function field(label, control, cls) {
    const id = nextId('f');
    control.id = id;
    return h('div', { class: 'field ' + (cls || '') }, [h('label', { for: id, text: label }), control]);
  }
  function check(label, name) {
    const id = nextId('f');
    return h('div', { class: 'field field--check' }, [h('input', { type: 'checkbox', id: id, name: name }), h('label', { for: id, text: label })]);
  }
  /** options: [[value, text, lang]] */
  function select(name, options) {
    return h('select', { name: name }, options.map((o) => h('option', { value: o[0], lang: o[2] || null, text: o[1] })));
  }
  function setControl(el, value) {
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value === undefined || value === null ? '' : value;
    if (el.tagName === 'SELECT' && el.value !== String(value || '')) el.value = ''; // unknown value -> "any"
  }
  function debounce(fn, ms) {
    let t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }
  /** "Search" + "Sort by" form for the companies and buyers lists */
  function listForm(searchLabel, sorts) {
    const form = h('form', { class: 'listbar', role: 'search', on: { submit: (e) => e.preventDefault() } }, [
      field(searchLabel, h('input', { type: 'search', name: 'q', autocomplete: 'off', spellcheck: 'false' }), 'field--grow'),
      field('Sort by', select('sort', sorts.map((x) => [x[0] + ':' + x[1], x[2]]))),
    ]);
    return form;
  }

  /* ------------------------------------------------------------------ dashboard */

  function pageDashboard() {
    return load('summary.json').then((S) => {
      lookups(S);
      const views = [['all', 'All categories']].concat(S.categories.filter((c) => S.views[c.k]).map((c) => [c.k, c.label]));
      let state = readHash();
      const key = () => (S.views[state.cat] ? state.cat : 'all');
      const buttons = views.map((v) => h('button', {
        type: 'button', class: 'switch__b', 'aria-pressed': 'false', 'data-view': v[0],
        on: { click: () => { state = v[0] === 'all' ? {} : { cat: v[0] }; setHash(state); show(); } },
      }, [v[1], h('span', { class: 'switch__n', text: int(S.views[v[0]].kpi.tenders) })]));
      const body = h('div', { class: 'dash' });
      const note = h('p', { class: 'demo-note' }, [
        h('strong', { text: 'Demo data' }),
        h('span', { text: plural(S.views.all.kpi.tenders, 'tender') + ' collected on ' + day(S.collected) + '; full data comes later. Every figure here is computed from these tenders only.' }),
      ]);
      clear(APP);
      add(APP, [note, h('div', { class: 'switch', role: 'group', 'aria-label': 'Category' }, buttons), body]);
      function show() {
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === key())));
        clear(body);
        redraws = [];
        dashboard(body, S, key());
      }
      show();
      window.addEventListener('hashchange', () => { state = readHash(); show(); });
    });
  }

  function dashboard(body, S, k) {
    const V = S.views[k];
    const K = V.kpi;
    const base = k === 'all' ? {} : { cat: k };
    const withBase = (o) => Object.assign({}, base, o);
    const known = V.winners_known || [0, 0];

    add(body, h('dl', { class: 'kpis' }, [
      kpi('Tenders', int(K.tenders), S.period ? 'announced ' + day(S.period[0]) + ' to ' + day(S.period[1]) : null),
      kpi('Estimated value', short(K.value), 'sum of the buyers\' estimates in GEL' +
        (K.other_cur ? '; ' + plural(K.other_cur, 'tender') + ' in other currencies not included' : '')),
      kpi('Buyers', int(K.buyers), 'public bodies announcing or signing'),
      kpi('Companies', S.has.bids ? int(K.companies) : DASH, S.has.bids ? 'that bid or won' : 'bids not collected yet'),
      kpi('Average bidders', isNum(K.avg_bidders) ? one(K.avg_bidders) : DASH,
        isNum(K.avg_bidders) ? 'per tender, over ' + plural(K.avg_bidders_n, 'tender') + ' with bidding closed' : 'not collected yet'),
      kpi('Contracts won', isNum(K.won_value) ? short(K.won_value) : DASH,
        isNum(K.won_value) ? 'GEL, on ' + plural(K.won_n, 'tender') + '; winners known for ' + int(known[0]) + ' of ' + int(known[1]) + ' decided' +
          (K.other_cur_contracts ? '; ' + plural(K.other_cur_contracts, 'contract') + ' in other currencies not included' : '') : 'not collected yet'),
    ]));

    const grid = h('div', { class: 'grid' });
    body.appendChild(grid);

    // Tenders and value by month (two charts: one measure each, no second axis)
    if (V.months.length) {
      const outside = V.months_outside ? plural(V.months_outside, 'tender') + ' announced outside these months ' + (V.months_outside === 1 ? 'is' : 'are') + ' in the list, not in this chart.' : null;
      [['Tenders by month', 1, int, true], ['Estimated value by month', 2, (n) => short(n), false]].forEach((m) => {
        const c = card(m[0], 'By announcement date. Click a month to see its tenders.', 'card--month');
        columns(c.body, V.months.map((x, i) => ({
          label: MONTHS[Number(x[0].slice(5, 7)) - 1],
          sub: i === 0 || x[0].slice(5, 7) === '01' ? x[0].slice(0, 4) : '',
          value: x[m[1]],
          href: listUrl(withBase({ from: x[0] + '-01', to: monthEnd(x[0]) })),
          aria: monthName(x[0]) + ': ' + plural(x[1], 'tender') + ', ' + short(x[2]) + ' estimated',
          tip: [monthName(x[0]), plural(x[1], 'tender'), short(x[2]) + ' estimated'],
        })), { fmt: m[2], integer: m[3], label: m[0] });
        if (outside) c.el.appendChild(para(outside, 'card__foot muted small'));
        c.el.appendChild(tableView([{ label: 'Month' }, { label: 'Tenders', num: true }, { label: 'Estimated value', num: true }],
          V.months.map((x) => [monthName(x[0]), int(x[1]), lari(x[2])])));
        grid.appendChild(c.el);
      });
    }

    // By category (all view) or by main CPV class (one category)
    if (k === 'all' && V.cats.length) {
      const c = card('By category', 'Tenders per category, with their estimated value.');
      bars(c.body, V.cats.map((x) => ({
        label: catLabel(x[0]), value: x[1], text: plural(x[1], 'tender') + ' · ' + short(x[2]),
        href: listUrl({ cat: x[0] }), tip: [catLabel(x[0]), plural(x[1], 'tender'), short(x[2]) + ' estimated'],
      })));
      c.el.appendChild(tableView([{ label: 'Category' }, { label: 'Tenders', num: true }, { label: 'Estimated value', num: true }],
        V.cats.map((x) => [catLabel(x[0]), int(x[1]), lari(x[2])])));
      grid.appendChild(c.el);
    } else if (V.cpv.length) {
      const c = card('By CPV class', 'The main classifier code of each tender' + (V.cpv_more ? '; the 10 largest of ' + int(V.cpv.length + V.cpv_more) + ' classes.' : '.'));
      bars(c.body, V.cpv.map((x) => ({
        label: h('span', null, [x[0] + ' ', ka(x[1])]), value: x[2], text: plural(x[2], 'tender') + ' · ' + short(x[3]),
        href: listUrl(withBase({ cpv: x[0] })), tip: [x[0], { text: x[1], lang: 'ka' }, plural(x[2], 'tender'), short(x[3]) + ' estimated'],
      })));
      c.el.appendChild(tableView([{ label: 'CPV class' }, { label: 'Tenders', num: true }, { label: 'Estimated value', num: true }],
        V.cpv.map((x) => [[x[0] + ' ', ka(x[1])], int(x[2]), lari(x[3])])));
      grid.appendChild(c.el);
    }

    // By status (lifecycle order)
    if (V.status.length) {
      const c = card('By status', 'Where each tender stood when it was collected.');
      bars(c.body, V.status.map((x) => {
        const st = L.status[x[0]] || {};
        return {
          label: st.en || st.ka || x[0], lang: st.en ? null : 'ka', sub: st.en ? null : null, value: x[1],
          text: plural(x[1], 'tender') + ' · ' + short(x[2]), href: listUrl(withBase({ status: x[0] })),
          tip: [st.en || st.ka || x[0], { text: st.ka || '', lang: 'ka' }, plural(x[1], 'tender')],
        };
      }));
      c.el.appendChild(tableView([{ label: 'Status' }, { label: 'As published' }, { label: 'Tenders', num: true }, { label: 'Estimated value', num: true }],
        V.status.map((x) => { const st = L.status[x[0]] || {}; return [st.en || DASH, ka(st.ka || ''), int(x[1]), lari(x[2])]; })));
      grid.appendChild(c.el);
    }

    // Top buyers by estimated value
    if (V.buyers.length) {
      const c = card('Top 10 buyers by estimated value', 'Public bodies with the largest tenders in this view.');
      bars(c.body, V.buyers.map((x) => ({
        label: x[1], lang: 'ka', value: x[3], text: short(x[3]) + ' · ' + plural(x[2], 'tender'),
        href: listUrl(withBase({ buyer: x[0] })), tip: [{ text: x[1], lang: 'ka' }, short(x[3]) + ' estimated', plural(x[2], 'tender')],
      })));
      c.el.appendChild(h('p', { class: 'card__foot' }, h('a', { href: 'buyers.html', text: 'All buyers' })));
      c.el.appendChild(tableView([{ label: 'Buyer' }, { label: 'Tenders', num: true }, { label: 'Estimated value', num: true }],
        V.buyers.map((x) => [h('a', { href: buyerUrl(x[0]) }, ka(x[1])), int(x[2]), lari(x[3])])));
      grid.appendChild(c.el);
    }

    // Top companies: by value won, by wins, or (while winners are still being collected) by tenders entered
    const TC = V.companies || { by: null, rows: [] };
    if (TC.by && TC.rows.length) {
      const titles = { value: 'Top 10 companies by value won', wins: 'Top 10 companies by wins', entered: 'Most active bidders' };
      const subs = {
        value: 'Contract value won in this view (GEL).',
        wins: 'Tenders won in this view.',
        entered: 'Tenders entered. Winners are known for ' + int(known[0]) + ' of ' + int(known[1]) + ' decided tenders so far, too few to rank by wins.',
      };
      const c = card(titles[TC.by], subs[TC.by]);
      bars(c.body, TC.rows.map((x) => ({
        label: x[1], lang: 'ka',
        value: TC.by === 'value' ? x[3] : x[2],
        text: TC.by === 'value' ? short(x[3]) + ' · ' + plural(x[2], 'win') : TC.by === 'wins' ? plural(x[2], 'win') : plural(x[2], 'tender'),
        href: listUrl(withBase(TC.by === 'entered' ? { company: x[0] } : { company: x[0], won: '1' })),
        tip: [{ text: x[1], lang: 'ka' }, TC.by === 'value' ? short(x[3]) + ' won' : '', TC.by === 'entered' ? plural(x[2], 'tender') + ' entered' : plural(x[2], 'win')].filter(Boolean),
      })));
      c.el.appendChild(h('p', { class: 'card__foot' }, h('a', { href: 'companies.html', text: 'All companies' })));
      c.el.appendChild(tableView([{ label: 'Company' }, { label: TC.by === 'entered' ? 'Tenders entered' : 'Wins', num: true }, { label: 'Value won', num: true }],
        TC.rows.map((x) => [h('a', { href: companyUrl(x[0]) }, ka(x[1])), int(x[2]), x[3] === null ? DASH : lari(x[3])])));
      grid.appendChild(c.el);
    } else {
      const c = card('Companies', null);
      c.body.appendChild(para('Bids and winners are not collected yet for this view.'));
      grid.appendChild(c.el);
    }

    // By procedure type
    if (V.proc.length) {
      const c = card('By procedure type', 'How the tenders are run.');
      bars(c.body, V.proc.map((x) => ({
        label: procText(x[0]), value: x[1], text: plural(x[1], 'tender') + ' · ' + short(x[2]),
        href: listUrl(withBase({ proc: x[0] })), tip: [procText(x[0]), { text: (L.proc[x[0]] || {}).ka || '', lang: 'ka' }, plural(x[1], 'tender')],
      })));
      c.el.appendChild(tableView([{ label: 'Procedure' }, { label: 'Tenders', num: true }, { label: 'Estimated value', num: true }],
        V.proc.map((x) => [procText(x[0]), int(x[1]), lari(x[2])])));
      grid.appendChild(c.el);
    }

    // Open for bids now (deadline still ahead on the visitor's clock)
    const open = V.open.filter((x) => isOpen(x[4]));
    const c = card('Open for bids', open.length ? plural(open.length, 'tender') + ' with the deadline still ahead, soonest first.' : null, 'card--open');
    if (open.length) {
      c.body.appendChild(h('ul', { class: 'openlist' }, open.slice(0, 6).map((x) => h('li', null, [
        h('a', { class: 'openlist__title', href: tenderUrl(x[0]) }, [x[0] + ' · ', ka(x[1])]),
        h('span', { class: 'openlist__meta' }, [ka(x[3]), ' · ', short(x[5]), ' · ', h('strong', { text: closesIn(x[4]) }), ' (' + dayTime(x[4]) + ')']),
      ]))));
      c.el.appendChild(h('p', { class: 'card__foot' }, h('a', { href: listUrl(withBase({ open: '1', sort: 'd', dir: 'asc' })), text: 'All open tenders' })));
    } else {
      c.body.appendChild(para('No tender in this data is still open for bids. The data was collected on ' + day(S.collected) + '.'));
    }
    grid.appendChild(c.el);
  }

  /* ------------------------------------------------------------------ tender list */

  const LIST_KEYS = ['q', 'cat', 'status', 'proc', 'buyer', 'vmin', 'vmax', 'from', 'to', 'bidders', 'open', 'req', 'company', 'won', 'cpv', 'sort', 'dir'];
  const WINNER_HINT = { 'not-yet': 'not decided yet', none: 'no winner', 'no-contract': 'no contract yet', 'not-collected': 'not collected yet' };

  function pageTenders() {
    return Promise.all([load('summary.json'), load('tenders.json'), load('buyers.json'), load('companies.json')]).then((res) => {
      const S = res[0];
      const rows = res[1].rows;
      const B = byId(res[2].rows);
      const C = byId(res[3].rows);
      lookups(S);
      rows.forEach((r) => {
        r._bn = B[r.b] ? B[r.b].name : '';
        r._w = (r.w || []).map((w) => (C[w[0]] ? C[w[0]].name : w[0]));
        r._hay = [r.no, r.t, r._bn, r._w.join(' '), r.k].join(' ').toLowerCase();
        r._so = L.order[r.s] === undefined ? 99 : L.order[r.s];
      });

      const buyers = res[2].rows.filter((b) => b.n > 0).sort((a, b) => a.name.localeCompare(b.name, 'ka'));
      const sorts = [['a', 'desc', 'Newest first'], ['a', 'asc', 'Oldest first'], ['d', 'asc', 'Deadline, soonest first'],
        ['v', 'desc', 'Highest estimated value'], ['v', 'asc', 'Lowest estimated value'], ['n', 'desc', 'Most bidders'],
        ['n', 'asc', 'Fewest bidders'], ['no', 'asc', 'Number']];
      const q = h('input', { type: 'search', name: 'q', autocomplete: 'off', spellcheck: 'false', placeholder: 'Number, title, buyer, winner or CPV code' });
      const num = (name, ph) => h('input', { type: 'number', name: name, min: '0', step: '1', inputmode: 'numeric', placeholder: ph });
      const date = (name) => h('input', { type: 'date', name: name, min: S.period ? S.period[0] : null, max: S.period ? S.period[1] : null });
      const sortSel = select('sort', sorts.map((x) => [x[0] + ':' + x[1], x[2]]));
      const form = h('form', { class: 'filters__grid', role: 'search', 'aria-label': 'Filter tenders', on: { submit: (e) => e.preventDefault() } }, [
        field('Search', q, 'field--search'),
        field('Category', select('cat', [['', 'All categories']].concat(S.categories.filter((c) => c.n).map((c) => [c.k, c.label + ' (' + int(c.n) + ')'])))),
        field('Status', select('status', [['', 'Any status']].concat(S.statuses.map((x) => [x.k, (x.en || x.ka) + ' (' + int(x.n) + ')', x.en ? null : 'ka'])))),
        field('Procedure', select('proc', [['', 'Any procedure']].concat(S.procedures.map((x) => [x.k, procText(x.k) + ' (' + int(x.n) + ')'])))),
        field('Buyer', select('buyer', [['', 'Any buyer']].concat(buyers.map((b) => [b.id, b.name + ' (' + int(b.n) + ')', 'ka']))), 'field--buyer'),
        field('Estimated value from (GEL)', num('vmin', '0')),
        field('Estimated value up to (GEL)', num('vmax', 'any')),
        field('Announced from', date('from')),
        field('Announced up to', date('to')),
        field('Bidders', select('bidders', [['', 'Any number'], ['1', '1 (single bidder)'], ['2', '2'], ['3', '3'], ['4+', '4 or more'], ['0', 'None'], ['unknown', 'Not known yet']])),
        field('Sort by', sortSel),
        h('div', { class: 'field field--checks' }, [check('Open for bids now', 'open'), check('Requirements read', 'req')]),
        h('div', { class: 'field field--reset' }, h('button', { type: 'reset', class: 'btn btn--ghost btn--small', text: 'Clear filters' })),
      ]);
      const count = h('span', { class: 'filters__count' });
      const details = h('details', { class: 'filters' }, [h('summary', null, ['Filters', count]), form]);
      if (window.matchMedia('(min-width: 761px)').matches) details.open = true;
      const chips = h('div', { class: 'chips', 'aria-live': 'polite' });
      const summary = h('p', { class: 'summary', 'aria-live': 'polite' });
      const tableBox = h('div');
      clear(APP);
      add(APP, [details, chips, summary, tableBox]);

      let state = {};
      let limit = 100;
      const el = (name) => form.elements[name];

      function fromHash() {
        state = readHash();
        ['q', 'cat', 'status', 'proc', 'buyer', 'vmin', 'vmax', 'from', 'to', 'bidders'].forEach((k) => setControl(el(k), state[k]));
        el('open').checked = state.open === '1';
        el('req').checked = state.req === '1';
        syncSort();
      }
      function syncSort() {
        const v = (state.sort || 'a') + ':' + (state.dir || 'desc');
        if (![].some.call(sortSel.options, (o) => o.value === v)) {
          const col = cols.find((c) => c.key === state.sort);
          sortSel.appendChild(h('option', { value: v, text: (col ? col.label : state.sort) + (state.dir === 'asc' ? ', ascending' : ', descending') }));
        }
        sortSel.value = v;
      }
      function fromForm() {
        const f = {};
        ['q', 'cat', 'status', 'proc', 'buyer', 'vmin', 'vmax', 'from', 'to', 'bidders'].forEach((k) => {
          const v = String(el(k).value || '').trim();
          if (v) f[k] = v;
        });
        if (el('open').checked) f.open = '1';
        if (el('req').checked) f.req = '1';
        ['company', 'won', 'cpv'].forEach((k) => { if (state[k]) f[k] = state[k]; });
        const sv = sortSel.value.split(':');
        if (sv[0] && sortSel.value !== 'a:desc') { f.sort = sv[0]; f.dir = sv[1]; }
        state = f;
      }
      function filter(f) {
        const words = (f.q || '').toLowerCase().split(/\s+/).filter(Boolean);
        const vmin = f.vmin ? Number(f.vmin) : null;
        const vmax = f.vmax ? Number(f.vmax) : null;
        return rows.filter((r) => {
          if (f.cat && r.c !== f.cat) return false;
          if (f.status && r.s !== f.status) return false;
          if (f.proc && r.p !== f.proc) return false;
          if (f.buyer && r.b !== f.buyer) return false;
          if (f.cpv && r.mc !== f.cpv) return false;
          if (vmin !== null && !(r.v >= vmin)) return false;
          if (vmax !== null && !(r.v <= vmax)) return false;
          if (f.from && !(r.a && r.a >= f.from)) return false;
          if (f.to && !(r.a && r.a <= f.to)) return false;
          if (f.bidders) {
            if (f.bidders === 'unknown') { if (r.n !== null && r.n !== undefined) return false; } else if (r.n === null || r.n === undefined) return false;
            else if (f.bidders === '4+') { if (r.n < 4) return false; } else if (r.n !== Number(f.bidders)) return false;
          }
          if (f.open && !isOpen(r.d)) return false;
          if (f.req && !r.rq) return false;
          if (f.company) {
            const won = (r.w || []).some((w) => w[0] === f.company);
            if (f.won === '1' ? !won : !(won || (r.bi || []).some((b) => b[0] === f.company))) return false;
          }
          for (let i = 0; i < words.length; i += 1) if (r._hay.indexOf(words[i]) < 0) return false;
          return true;
        });
      }
      function winnerCell(r) {
        if (r.w && r.w.length) {
          return [h('a', { href: companyUrl(r.w[0][0]) }, ka(r._w[0])), r.w.length > 1 ? h('span', { class: 'muted small', text: ' +' + (r.w.length - 1) + ' more' }) : null];
        }
        return h('span', { class: 'muted', text: WINNER_HINT[r.wh] || DASH });
      }
      const cols = [
        { key: 'no', label: 'Number', first: 'asc', sort: (r) => r.no, cell: (r) => h('a', { href: tenderUrl(r.no), text: r.no }) },
        { key: 't', label: 'Title', first: 'asc', cls: 'wide', sort: (r) => r.t, cell: (r) => [ka(r.t), r.rq ? h('span', { class: 'tag tag--req', title: plural(r.rq[0], 'requirement item') + ', ' + int(r.rq[1]) + ' must be proven', text: 'requirements' }) : null] },
        { key: 'b', label: 'Buyer', first: 'asc', cls: 'wide', sort: (r) => r._bn, cell: (r) => (r.b ? h('a', { href: buyerUrl(r.b) }, ka(r._bn)) : DASH) },
        { key: 'c', label: 'Category', first: 'asc', sort: (r) => catLabel(r.c), cell: (r) => catLabel(r.c) },
        { key: 'v', label: 'Estimated value', num: true, first: 'desc', sort: (r) => r.v, cell: (r) => (isNum(r.v) ? lari(r.v) : isNum(r.vo) ? money(r.vo, r.cur) : DASH) },
        { key: 's', label: 'Status', first: 'asc', sort: (r) => r._so, cell: (r) => statusNode(r.s) },
        { key: 'a', label: 'Announced', first: 'desc', sort: (r) => r.a, cell: (r) => day(r.a) },
        { key: 'd', label: 'Deadline', first: 'asc', sort: (r) => r.d, cell: (r) => [day(r.d), isOpen(r.d) ? h('span', { class: 'tag tag--open', text: 'open' }) : null] },
        { key: 'n', label: 'Bidders', num: true, first: 'desc', sort: (r) => r.n, cell: (r) => (isNum(r.n) ? int(r.n) : unknown()) },
        { key: 'w', label: 'Winner', first: 'asc', cls: 'wide', sort: (r) => r._w[0] || null, cell: winnerCell },
      ];
      function render(opts) {
        const f = state;
        setHash(f);
        const list = filter(f);
        let sum = 0;
        let nb = 0;
        let cnt = 0;
        list.forEach((r) => {
          sum += isNum(r.v) ? r.v : 0;
          if (isNum(r.n)) { nb += r.n; cnt += 1; }
        });
        clear(summary);
        add(summary, [plural(list.length, 'tender'), ' · ', short(sum) + ' estimated', cnt ? ' · average ' + one(nb / cnt) + ' bidders' : '']);
        const active = Object.keys(f).filter((k2) => ['sort', 'dir', 'won'].indexOf(k2) < 0).length;
        count.textContent = active ? ' (' + active + ' active)' : '';
        clear(chips);
        if (f.company) {
          const name = C[f.company] ? C[f.company].name : f.company;
          chips.appendChild(h('span', { class: 'chip chip--filter' }, [
            f.won === '1' ? 'Won by ' : 'Company: ', h('a', { href: companyUrl(f.company) }, ka(name)), f.won === '1' ? '' : ' (bid or won)',
            h('button', { type: 'button', class: 'chip__x', 'aria-label': 'Remove the company filter', text: '×', on: { click: () => { delete state.company; delete state.won; limit = 100; render(); } } }),
          ]));
        }
        if (f.cpv) {
          chips.appendChild(h('span', { class: 'chip chip--filter' }, [
            'CPV class ' + f.cpv,
            h('button', { type: 'button', class: 'chip__x', 'aria-label': 'Remove the CPV class filter', text: '×', on: { click: () => { delete state.cpv; limit = 100; render(); } } }),
          ]));
        }
        const o = opts || {};
        dataTable(tableBox, cols, list, { sort: f.sort || 'a', dir: f.dir || 'desc', limit: limit, caption: 'Tenders', focusSort: o.focusSort, focusRow: o.focusRow }, (ch) => {
          if (ch.sort) { state.sort = ch.sort; state.dir = ch.dir; syncSort(); }
          if (ch.limit) limit = ch.limit;
          render(ch);
        });
        if (!list.length) tableBox.appendChild(para('No tender matches these filters.', 'note'));
      }
      const onChange = () => { fromForm(); limit = 100; render(); };
      form.addEventListener('change', onChange);
      q.addEventListener('input', debounce(onChange, 160));
      form.addEventListener('reset', () => setTimeout(() => { state = {}; fromHash.call(null); fromForm(); state = {}; sortSel.value = 'a:desc'; limit = 100; render(); }, 0));
      window.addEventListener('hashchange', () => { fromHash(); limit = 100; render(); });
      fromHash();
      render();
    });
  }

  /* ------------------------------------------------------------------ one tender */

  function pageTender() {
    const no = param('no').toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(no)) {
      notFound('The address has no tender number. Pick a tender from the list.');
      return Promise.resolve();
    }
    // Both downloads start at once. Storage gives the same 400 for "no such file" and "no access",
    // so summary.json decides: readable means the account has access and the tender is missing.
    const one = load('t/' + no + '.json');
    one.catch(() => {});                       // handled below, once summary.json has answered
    return load('summary.json').then((S) => one.then((t) => {
      lookups(S);
      renderTender(t, S);
    }, (err) => {
      if (noAccess(err)) notFound('Tender ' + no + ' is not in this demo.');
      else throw err;
    }));
  }

  function renderTender(t, S) {
    setTitle([t.no + ': ', ka(t.title)], t.no);
    setLead(null);
    clear(APP);
    const mail = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Source this: ' + t.no) +
      '&body=' + encodeURIComponent('Tender ' + t.no + '\n' + t.src + '\n\nWhat I need:\n');
    const open = isOpen(t.deadline);
    add(APP, [
      h('p', { class: 'badges' }, [
        h('span', { class: 'status' }, statusNode(t.status.k)),
        open ? h('span', { class: 'tag tag--open', text: 'open for bids' }) : null,
        h('a', { class: 'chip', href: listUrl({ cat: t.cat }) }, catLabel(t.cat)),
        h('span', { class: 'chip' }, t.proc.k),
      ]),
      h('div', { class: 'actions' }, [
        h('a', { class: 'btn btn--primary', href: t.src, rel: 'noopener', target: '_blank' }, 'Open the original record'),
        h('a', { class: 'btn btn--ghost', href: mail }, 'Ask Phantasma to source this'),
      ]),
      h('p', { class: 'small muted' }, ['The original record is on tenders.procurement.gov.ge (opens in a new tab). The button next to it e-mails Phantasma about this tender.']),
    ]);

    // Key facts
    const facts = [
      ['Buyer', t.buyer.id ? h('a', { href: buyerUrl(t.buyer.id) }, ka(t.buyer.name)) : DASH],
      ['Estimated value', [money(t.value, t.currency), t.vat ? h('span', { class: 'muted' }, [' · ', t.vat.en || '', t.vat.en ? ' (' : '', ka(t.vat.ka), t.vat.en ? ')' : '']) : null]],
      ['Announced', dayTime(t.announced)],
      ['Bidding opens', dayTime(t.opens)],
      ['Bid deadline', [dayTime(t.deadline), t.deadline ? h('span', { class: 'muted', text: ' · ' + (open ? closesIn(t.deadline) : 'closed') }) : null]],
      ['Procedure', [t.proc.k + (t.proc.en ? ' · ' + t.proc.en : ''), t.proc.ka ? h('span', { class: 'muted' }, [' (', ka(t.proc.ka), ')']) : null]],
      ['Status', [statusNode(t.status.k), t.status.en ? h('span', { class: 'muted' }, [' (', ka(t.status.ka), ')']) : null]],
      ['Category', [catLabel(t.cat), t.main ? h('span', { class: 'muted' }, [' · ', ka(t.main)]) : null]],
      ['CPV codes', t.cpv.length ? h('ul', { class: 'plain' }, t.cpv.map((c) => h('li', null, [c[0], c[1] ? ' · ' : '', c[1] ? ka(c[1]) : null]))) : DASH],
    ];
    t.facts.forEach((f) => facts.push([f[0], ka(f[1])]));
    if (t.desc) facts.push(['Additional information', ka(t.desc, 'pre')]);
    APP.appendChild(section('Key facts', h('dl', { class: 'facts panel' }, facts.map((f) => [h('dt', { text: f[0] }), h('dd', null, f[1])]))));

    // Bids
    const bidsBox = h('div');
    if (t.bids.length) {
      const low = t.bids.filter((b) => isNum(b.last)).sort((a, b) => a.last - b.last)[0];
      bidsBox.appendChild(h('p', { class: 'summary' }, [plural(t.bids.length, 'bidder'), low ? ' · lowest last offer ' + money(low.last) + (isNum(low.disc) ? ' (' + pct(low.disc) + ' below the estimate)' : '') : '']));
      const box = h('div');
      dataTable(box, [
        { key: 'c', label: 'Bidder', cls: 'wide', cell: (b) => [h('a', { href: companyUrl(b.c) }, ka(b.name)), b.won ? h('span', { class: 'tag tag--won', text: 'winner' }) : null] },
        { key: 'f', label: 'First offer', num: true, cell: (b) => money(b.first) },
        { key: 'l', label: 'Last offer', num: true, cell: (b) => money(b.last) },
        { key: 'd', label: 'Below the estimate', num: true, cell: (b) => pct(b.disc) },
        { key: 'o', label: 'Offers', num: true, cell: (b) => int(b.count) },
        { key: 't', label: 'Last offer at', cell: (b) => dayTime(b.last_at) },
      ], t.bids, { caption: 'Bids' });
      bidsBox.appendChild(box);
      bidsBox.appendChild(para('"Below the estimate" = (estimated value − last offer) ÷ estimated value. Facts from the bids tab of the original record.', 'small muted'));
    } else if (!t.closed) {
      bidsBox.appendChild(para('Bids are not shown before the deadline (' + dayTime(t.deadline) + ').'));
    } else if (!t.bids_fetched) {
      bidsBox.appendChild(para('Bids not collected yet.'));
    } else {
      bidsBox.appendChild(para('No bids were placed.'));
    }
    APP.appendChild(section('Bids', bidsBox));

    // Winner and contracts
    const win = h('div');
    const total = t.contracts.reduce((a, c) => a + (isNum(c.value) && (!c.cur || c.cur === 'GEL') ? c.value : 0), 0);
    if (t.deal_source === 'contracts') {
      win.appendChild(h('p', { class: 'summary' }, [plural(t.contracts.length, 'contract') + ' signed under this consolidated tender so far', total ? ' · ' + money(total) : '', ' · ' + plural(t.winners.length, 'supplier')]));
      const box = h('div');
      dataTable(box, [
        { key: 'r', label: 'Registration no.', cell: (c) => c.reg || DASH },
        { key: 'b', label: 'Buyer', cls: 'wide', cell: (c) => (c.b ? h('a', { href: buyerUrl(c.b) }, ka(c.bn)) : DASH) },
        { key: 'c', label: 'Supplier', cls: 'wide', cell: (c) => h('a', { href: companyUrl(c.c) }, ka(c.cn)) },
        { key: 'v', label: 'Value', num: true, cell: (c) => money(c.value, c.cur) },
        { key: 'd', label: 'Signed', cell: (c) => day(c.date) },
        { key: 'p', label: 'In force', cell: (c) => (Array.isArray(c.validity) ? day(c.validity[0]) + ' to ' + day(c.validity[1]) : c.validity ? ka(c.validity) : DASH) },
        { key: 's', label: 'Contract status', cell: (c) => (c.status_en ? h('span', { title: c.status || null, text: c.status_en }) : c.status ? ka(c.status) : DASH) },
      ], t.contracts, { caption: 'Contracts' });
      win.appendChild(box);
      win.appendChild(para('Contracts come from the CON module of the state site; each buyer signs its own contract with the winning supplier.', 'small muted'));
    } else if (t.contracts.length) {
      t.contracts.forEach((c) => {
        win.appendChild(h('div', { class: 'panel panel--accent' }, [
          h('p', { class: 'winner' }, ['Winner: ', h('a', { href: companyUrl(c.c) }, ka(c.cn))]),
          h('dl', { class: 'facts' }, [
            c.reg ? [h('dt', { text: 'Contract no.' }), h('dd', null, ka(c.reg))] : null,
            isNum(c.value) ? [h('dt', { text: 'Contract value' }), h('dd', { text: money(c.value, c.cur) + (isNum(c.value) && isNum(t.value) && (!c.cur || c.cur === 'GEL') ? ' (' + pct(discount(t.value, c.value)) + ' below the estimate)' : '') })] : null,
            c.date ? [h('dt', { text: 'Signed' }), h('dd', { text: day(c.date) })] : null,
            Array.isArray(c.validity) ? [h('dt', { text: 'In force' }), h('dd', { text: day(c.validity[0]) + ' to ' + day(c.validity[1]) })] : null,
            c.file ? [h('dt', { text: 'Contract file' }), h('dd', null, h('a', { href: c.file, rel: 'noopener', target: '_blank', text: 'The state\'s copy' }))] : null,
          ]),
        ]));
      });
      win.appendChild(para('From the results tab of the original record.', 'small muted'));
    } else if (t.winners && t.winners.length) {
      t.winners.forEach((w) => win.appendChild(h('p', { class: 'winner' }, ['Winner: ', h('a', { href: companyUrl(w.c) }, ka(w.name)), isNum(w.value) ? ' · ' + money(w.value) : ''])));
    } else {
      const why = {
        'not-yet': 'No winner yet: the tender is at "' + statusText(t.status.k) + '".',
        none: 'This tender ended without a winner ("' + statusText(t.status.k) + '").',
        'no-contract': 'The results tab has no contract published yet.',
        'not-collected': 'The winner is not collected yet; see the original record.',
      };
      win.appendChild(para(why[t.winner_hint] || 'No winner recorded.'));
    }
    if (t.notes && t.notes.length) {
      win.appendChild(h('h3', { text: 'Notes on the results tab' }));
      win.appendChild(h('ul', { class: 'notes' }, t.notes.map((n) => h('li', null, [
        n.at ? h('span', { class: 'muted', text: dayTime(n.at) + ' · ' }) : null, n.party ? ka(n.party, 'strong') : null, n.party ? ': ' : '', ka(n.note),
      ]))));
    }
    APP.appendChild(section('Winner and contracts', win));

    // Requirements: "must be proven" first, then every item by clause
    const rq = h('div');
    if (t.req) {
      rq.appendChild(h('p', null, [plural(t.req.n, 'item') + ' read from the tender documentation; ', h('strong', { text: int(t.req.proving.length) + ' must be proven' }), ' (lab tests, expertise, certificates, inspections, samples). Read automatically: always check the originals.']));
      const prove = h('div', { class: 'panel panel--accent' }, [h('h3', { text: 'Must be proven' })]);
      if (t.req.proving.length) t.req.proving.forEach((r) => prove.appendChild(reqItem(r, true)));
      else prove.appendChild(para('No item of a proving kind was found.'));
      rq.appendChild(prove);
      rq.appendChild(h('h3', { text: 'All requirements by clause' }));
      t.req.groups.forEach((g) => {
        const d = h('details', { class: 'clause' }, [
          h('summary', null, [
            'Clause ' + (g.ref || DASH) + ' (' + g.items.length + ') ',
            h('span', { class: 'muted small' }, ['from ', g.from_ka ? ka(g.from) : g.from]),
            g.title ? [' · ', ka(g.title)] : null,
          ]),
        ]);
        let filled = false;
        d.addEventListener('toggle', () => { // fill on first open: some tenders have hundreds of items
          if (filled || !d.open) return;
          filled = true;
          d.appendChild(h('div', null, g.items.map((r) => reqItem(r, false))));
        });
        rq.appendChild(d);
      });
    } else {
      rq.appendChild(para('Requirements are not read yet for this tender. They come from the tender documentation, which the portal reads in a later data run.'));
    }
    APP.appendChild(section('Requirements', rq));

    // Documents: links to the state's copy only
    const docs = h('div');
    if (t.docs.length) {
      docs.appendChild(para('Links open the state\'s own copy on tenders.procurement.gov.ge.', 'small muted'));
      docs.appendChild(h('ul', { class: 'docs' }, t.docs.map((d) => h('li', null, [
        h('a', { href: d.url, rel: 'noopener', target: '_blank', lang: 'ka', text: d.name }),
        h('span', { class: 'muted small', text: ' · ' + d.tab + (d.date ? ', ' + day(d.date) : '') + (d.old ? ', replaced by a newer upload' : '') }),
      ]))));
    } else {
      docs.appendChild(para('No documents listed yet.'));
    }
    APP.appendChild(section('Documents', docs));
    APP.appendChild(para(['Facts from the original record, collected on ' + dayTime(t.seen) + ' (Georgian time). ', h('a', { href: t.src, rel: 'noopener', target: '_blank', text: 'Check the original' }), '.'], 'small muted'));
  }

  function reqItem(r, withClause) {
    return h('div', { class: 'req' }, [
      withClause ? h('span', { class: 'req__ref', text: 'Clause ' + (r.ref || DASH) }) : null,
      h('span', { class: 'req__kind', text: r.kind_en || '' }),
      r.lead ? h('div', { class: 'req__lead' }, ['Lead line: ', ka(r.lead)]) : null,
      h('div', { class: 'req__text' }, ka(r.text)),
      (r.std.length || r.bodies.length || r.regs.length) ? h('div', null, [
        r.std.map((x) => chip(x)), r.bodies.map((x) => chip(ka(x), null, 'chip--body')), r.regs.map((x) => chip(x)),
      ]) : null,
    ]);
  }

  /* ------------------------------------------------------------------ companies */

  function pageCompanies() {
    return Promise.all([load('summary.json'), load('companies.json')]).then((res) => {
      const S = res[0];
      const rows = res[1].rows;
      lookups(S);
      rows.forEach((r) => { r._hay = [r.name, (r.alt || []).join(' '), r.pid || ''].join(' ').toLowerCase(); });
      const known = S.views.all.winners_known || [0, 0];
      const sorts = [['wv', 'desc', 'Value won'], ['w', 'desc', 'Tenders won'], ['e', 'desc', 'Tenders entered'], ['disc', 'desc', 'Average discount'], ['name', 'asc', 'Name']];
      const form = listForm('Search companies', sorts);
      const summary = h('p', { class: 'summary', 'aria-live': 'polite' });
      const box = h('div');
      clear(APP);
      add(APP, [form, para('Winners are known for ' + int(known[0]) + ' of ' + int(known[1]) + ' decided tenders so far; "won" counts only those.', 'small muted'), summary, box]);
      const cols = [
        { key: 'name', label: 'Company', first: 'asc', cls: 'wide', sort: (r) => r.name, cell: (r) => [h('a', { href: companyUrl(r.id) }, ka(r.name)), r.alt && r.alt.length ? h('span', { class: 'muted small', text: ' +' + r.alt.length + ' spelling' + (r.alt.length > 1 ? 's' : '') }) : null] },
        { key: 'e', label: 'Tenders entered', num: true, first: 'desc', sort: (r) => r.e, cell: (r) => int(r.e) },
        { key: 'w', label: 'Won', num: true, first: 'desc', sort: (r) => r.w, cell: (r) => int(r.w) },
        { key: 'wv', label: 'Value won', num: true, first: 'desc', sort: (r) => r.wv, cell: (r) => lari(r.wv) },
        { key: 'disc', label: 'Average discount', num: true, first: 'desc', sort: (r) => r.disc, cell: (r) => pct(r.disc) },
        { key: 'cats', label: 'Categories', sort: null, cell: (r) => r.cats.map((c) => catLabel(c[0])).join(', ') || DASH },
        { key: 'buyers', label: 'Buyers', num: true, first: 'desc', sort: (r) => r.buyers.length, cell: (r) => int(r.buyers.length) },
      ];
      listPage(form, summary, box, rows, cols, 'wv', (list) => {
        const won = list.filter((r) => r.w > 0);
        return [plural(list.length, 'company', 'companies'), ' · ', plural(won.length, 'with a win', 'with a win'), ' · ', short(list.reduce((a, r) => a + (r.wv || 0), 0)) + ' won'];
      }, 'Companies');
    });
  }

  /** Search + sort + "show more" for the companies and buyers lists; state in the URL hash */
  function listPage(form, summary, box, rows, cols, defSort, summarize, caption) {
    const q = form.elements.q;
    const sortSel = form.elements.sort;
    let state = {};
    let limit = 100;
    const defDir = (cols.find((c) => c.key === defSort) || {}).first || 'desc';
    function syncSort() {
      const v = (state.sort || defSort) + ':' + (state.dir || defDir);
      if (![].some.call(sortSel.options, (o) => o.value === v)) {
        const col = cols.find((c) => c.key === state.sort);
        sortSel.appendChild(h('option', { value: v, text: (col ? col.label : state.sort) + (state.dir === 'asc' ? ', ascending' : ', descending') }));
      }
      sortSel.value = v;
    }
    function fromHash() {
      state = readHash();
      q.value = state.q || '';
      syncSort();
    }
    function render(o) {
      setHash(state);
      const words = (state.q || '').toLowerCase().split(/\s+/).filter(Boolean);
      const list = rows.filter((r) => words.every((w) => r._hay.indexOf(w) >= 0));
      clear(summary);
      add(summary, summarize(list));
      const opts = o || {};
      dataTable(box, cols, list, { sort: state.sort || defSort, dir: state.dir || defDir, limit: limit, caption: caption, focusSort: opts.focusSort, focusRow: opts.focusRow }, (ch) => {
        if (ch.sort) { state.sort = ch.sort; state.dir = ch.dir; syncSort(); }
        if (ch.limit) limit = ch.limit;
        render(ch);
      });
      if (!list.length) box.appendChild(para('Nothing matches this search.', 'note'));
    }
    q.addEventListener('input', debounce(() => { state.q = q.value.trim() || undefined; limit = 100; render(); }, 160));
    sortSel.addEventListener('change', () => { const v = sortSel.value.split(':'); state.sort = v[0]; state.dir = v[1]; render(); });
    window.addEventListener('hashchange', () => { fromHash(); limit = 100; render(); });
    fromHash();
    render();
  }

  function pageCompany() {
    const id = param('id');
    if (!/^[a-z][a-z0-9]{1,40}$/.test(id)) {
      notFound('The address has no company id. Pick a company from the list.');
      return Promise.resolve();
    }
    return Promise.all([load('summary.json'), load('companies.json'), load('tenders.json'), load('buyers.json')]).then((res) => {
      const S = res[0];
      lookups(S);
      const c = res[1].rows.find((r) => r.id === id);
      if (!c) { notFound('This company is not in the demo data.'); return; }
      const B = byId(res[3].rows);
      const known = S.views.all.winners_known || [0, 0];
      setTitle(ka(c.name), c.name);
      setLead([
        c.pid ? 'Profile id on the state site: ' + c.pid + '. ' : 'Known by name only (no profile id in the records). ',
        c.alt && c.alt.length ? ['Also written as: ', c.alt.map((a, i) => [i ? ', ' : '', ka(a)]), '.'] : null,
      ]);
      clear(APP);
      add(APP, h('dl', { class: 'kpis' }, [
        kpi('Tenders entered', int(c.e), 'with a bid on record'),
        kpi('Won', int(c.w), 'winners known for ' + int(known[0]) + ' of ' + int(known[1]) + ' decided tenders'),
        kpi('Value won', c.wv === null ? DASH : short(c.wv), c.wv === null ? 'no contract value on record' : 'contract value, GEL'),
        kpi('Average discount', pct(c.disc), c.dn ? 'last offer below the estimate, over ' + plural(c.dn, 'bid') : 'no bid with an estimate'),
        kpi('Buyers', int(c.buyers.length), 'bid to or signed with'),
        kpi('Active', c.first ? day(c.first) : DASH, c.last && c.last !== c.first ? 'to ' + day(c.last) + ' (announcement dates)' : 'announcement date'),
      ]));
      APP.appendChild(h('div', { class: 'actions' }, [h('a', { class: 'btn btn--ghost btn--small', href: listUrl({ company: id }), text: 'Open these tenders in the list' })]));
      if (c.cats.length) {
        APP.appendChild(section('Categories', h('p', null, c.cats.map((x) => chip(catLabel(x[0]) + ' · ' + int(x[1]), listUrl({ company: id, cat: x[0] }))))));
      }
      // Their tenders
      const mine = res[2].rows.filter((r) => (r.bi || []).some((b) => b[0] === id) || (r.w || []).some((w) => w[0] === id));
      mine.forEach((r) => {
        const bid = (r.bi || []).find((b) => b[0] === id);
        r._offer = bid ? bid[1] : null;
        r._disc = bid ? discount(r.v, bid[1]) : null;
        const w = (r.w || []).find((x) => x[0] === id);
        r._won = !!w;
        r._wv = w ? w[1] : null;
        r._bn = B[r.b] ? B[r.b].name : '';
      });
      const tb = h('div');
      dataTable(tb, [
        { key: 'no', label: 'Number', cell: (r) => h('a', { href: tenderUrl(r.no), text: r.no }) },
        { key: 't', label: 'Title', cls: 'wide', cell: (r) => ka(r.t) },
        { key: 'b', label: 'Buyer', cls: 'wide', cell: (r) => (r.b ? h('a', { href: buyerUrl(r.b) }, ka(r._bn)) : DASH) },
        { key: 'v', label: 'Estimated value', num: true, cell: (r) => lari(r.v) },
        { key: 'o', label: 'Their last offer', num: true, cell: (r) => (isNum(r._offer) ? money(r._offer) : DASH) },
        { key: 'd', label: 'Below the estimate', num: true, cell: (r) => pct(r._disc) },
        { key: 'n', label: 'Bidders', num: true, cell: (r) => (isNum(r.n) ? int(r.n) : unknown()) },
        { key: 'r', label: 'Result', cell: (r) => (r._won ? h('span', { class: 'tag tag--won', text: 'won' + (isNum(r._wv) ? ' · ' + short(r._wv) : '') }) : r.w && r.w.length ? 'another company won' : h('span', { class: 'muted', text: WINNER_HINT[r.wh] || DASH })) },
        { key: 'a', label: 'Announced', cell: (r) => day(r.a) },
      ], mine, { caption: 'Tenders of this company' });
      APP.appendChild(section('Tenders (' + int(mine.length) + ')', tb));
      // Buyers
      if (c.buyers.length) {
        APP.appendChild(section('Buyers', h('ul', { class: 'cols' }, c.buyers.slice(0, 40).map((b) => h('li', null, [
          h('a', { href: buyerUrl(b[0]) }, ka(B[b[0]] ? B[b[0]].name : b[0])),
          h('span', { class: 'muted small', text: ' · ' + [b[1] ? plural(b[1], 'tender') : '', b[2] ? plural(b[2], 'contract') : ''].filter(Boolean).join(', ') }),
        ])))));
      }
      // Contracts
      if (c.ct.length) {
        const cb = h('div');
        dataTable(cb, [
          { key: 'r', label: 'Contract', cell: (x) => ka(x[0]) },
          { key: 't', label: 'Tender', cell: (x) => h('a', { href: tenderUrl(x[1]), text: x[1] }) },
          { key: 'b', label: 'Buyer', cls: 'wide', cell: (x) => (x[2] ? h('a', { href: buyerUrl(x[2]) }, ka(B[x[2]] ? B[x[2]].name : x[2])) : DASH) },
          { key: 'v', label: 'Value', num: true, cell: (x) => money(x[3], x[5]) },
          { key: 'd', label: 'Signed', cell: (x) => day(x[4]) },
        ], c.ct, { caption: 'Contracts' });
        APP.appendChild(section('Contracts (' + int(c.ct.length) + ')', cb));
      }
      APP.appendChild(para('Facts from public records: counts, sums and dates. No scores or ratings.', 'small muted'));
    });
  }

  /* ------------------------------------------------------------------ buyers */

  function pageBuyers() {
    return Promise.all([load('summary.json'), load('buyers.json')]).then((res) => {
      const S = res[0];
      const rows = res[1].rows;
      lookups(S);
      rows.forEach((r) => { r._hay = [r.name, r.pid || ''].join(' ').toLowerCase(); });
      const sorts = [['n', 'desc', 'Tenders'], ['v', 'desc', 'Estimated value'], ['cvl', 'desc', 'Contract value'], ['cn', 'desc', 'Contracts'], ['name', 'asc', 'Name']];
      const form = listForm('Search buyers', sorts);
      const summary = h('p', { class: 'summary', 'aria-live': 'polite' });
      const box = h('div');
      clear(APP);
      add(APP, [form, summary, box]);
      const cols = [
        { key: 'name', label: 'Buyer', first: 'asc', cls: 'wide', sort: (r) => r.name, cell: (r) => h('a', { href: buyerUrl(r.id) }, ka(r.name)) },
        { key: 'n', label: 'Tenders', num: true, first: 'desc', sort: (r) => r.n, cell: (r) => int(r.n) },
        { key: 'v', label: 'Estimated value', num: true, first: 'desc', sort: (r) => r.v, cell: (r) => lari(r.v) },
        { key: 'cn', label: 'Contracts', num: true, first: 'desc', sort: (r) => r.cn, cell: (r) => int(r.cn) },
        { key: 'cvl', label: 'Contract value', num: true, first: 'desc', sort: (r) => r.cvl, cell: (r) => lari(r.cvl) },
        { key: 'sup', label: 'Suppliers', num: true, first: 'desc', sort: (r) => r.sup.length, cell: (r) => int(r.sup.length) },
        { key: 'ab', label: 'Average bidders', num: true, first: 'desc', sort: (r) => r.ab, cell: (r) => one(r.ab) },
      ];
      listPage(form, summary, box, rows, cols, 'n', (list) => [
        plural(list.length, 'buyer'), ' · ', short(list.reduce((a, r) => a + (r.v || 0), 0)) + ' estimated', ' · ',
        short(list.reduce((a, r) => a + (r.cvl || 0), 0)) + ' in contracts',
      ], 'Buyers');
    });
  }

  function pageBuyer() {
    const id = param('id');
    if (!/^[a-z][a-z0-9]{1,40}$/.test(id)) {
      notFound('The address has no buyer id. Pick a buyer from the list.');
      return Promise.resolve();
    }
    return Promise.all([load('summary.json'), load('buyers.json'), load('tenders.json'), load('companies.json')]).then((res) => {
      const S = res[0];
      lookups(S);
      const b = res[1].rows.find((r) => r.id === id);
      if (!b) { notFound('This buyer is not in the demo data.'); return; }
      const C = byId(res[3].rows);
      setTitle(ka(b.name), b.name);
      setLead(b.pid ? 'Profile id on the state site: ' + b.pid + '.' : null);
      clear(APP);
      add(APP, h('dl', { class: 'kpis' }, [
        kpi('Tenders announced', int(b.n), b.n ? null : 'signs contracts under consolidated tenders'),
        kpi('Estimated value', short(b.v), 'of its tenders'),
        kpi('Contracts signed', int(b.cn), b.cn ? null : 'none on record'),
        kpi('Contract value', short(b.cvl), 'GEL, contracts on record'),
        kpi('Suppliers', int(b.sup.length), 'companies with a contract'),
        kpi('Average bidders', one(b.ab), b.abn ? 'over ' + plural(b.abn, 'tender') + ' with bidding closed' : 'not known yet'),
      ]));
      if (b.n) APP.appendChild(h('div', { class: 'actions' }, [h('a', { class: 'btn btn--ghost btn--small', href: listUrl({ buyer: id }), text: 'Open these tenders in the list' })]));
      if (b.cats.length) {
        APP.appendChild(section('Categories', h('p', null, b.cats.map((x) => chip(catLabel(x[0]) + ' · ' + int(x[1]), listUrl({ buyer: id, cat: x[0] }))))));
      }
      const mine = res[2].rows.filter((r) => r.b === id);
      if (mine.length) {
        mine.forEach((r) => { r._w = (r.w || []).map((w) => (C[w[0]] ? C[w[0]].name : w[0])); });
        const tb = h('div');
        dataTable(tb, [
          { key: 'no', label: 'Number', cell: (r) => h('a', { href: tenderUrl(r.no), text: r.no }) },
          { key: 't', label: 'Title', cls: 'wide', cell: (r) => ka(r.t) },
          { key: 'c', label: 'Category', cell: (r) => catLabel(r.c) },
          { key: 'v', label: 'Estimated value', num: true, cell: (r) => lari(r.v) },
          { key: 's', label: 'Status', cell: (r) => statusNode(r.s) },
          { key: 'n', label: 'Bidders', num: true, cell: (r) => (isNum(r.n) ? int(r.n) : unknown()) },
          { key: 'w', label: 'Winner', cls: 'wide', cell: (r) => (r.w && r.w.length ? h('a', { href: companyUrl(r.w[0][0]) }, ka(r._w[0])) : h('span', { class: 'muted', text: WINNER_HINT[r.wh] || DASH })) },
          { key: 'a', label: 'Announced', cell: (r) => day(r.a) },
        ], mine, { caption: 'Tenders of this buyer' });
        APP.appendChild(section('Tenders (' + int(mine.length) + ')', tb));
      }
      if (b.sup.length) {
        const sb = h('div');
        dataTable(sb, [
          { key: 'c', label: 'Supplier', cls: 'wide', cell: (x) => h('a', { href: companyUrl(x[0]) }, ka(C[x[0]] ? C[x[0]].name : x[0])) },
          { key: 'n', label: 'Contracts', num: true, cell: (x) => int(x[1]) },
          { key: 'v', label: 'Value', num: true, cell: (x) => lari(x[2]) },
        ], b.sup, { caption: 'Suppliers' });
        APP.appendChild(section('Suppliers (' + int(b.sup.length) + ')', sb));
      }
      if (b.ct.length) {
        const cb = h('div');
        dataTable(cb, [
          { key: 'r', label: 'Contract', cell: (x) => ka(x[0]) },
          { key: 't', label: 'Tender', cell: (x) => h('a', { href: tenderUrl(x[1]), text: x[1] }) },
          { key: 'c', label: 'Supplier', cls: 'wide', cell: (x) => (x[2] ? h('a', { href: companyUrl(x[2]) }, ka(C[x[2]] ? C[x[2]].name : x[2])) : DASH) },
          { key: 'v', label: 'Value', num: true, cell: (x) => money(x[3], x[5]) },
          { key: 'd', label: 'Signed', cell: (x) => day(x[4]) },
        ], b.ct, { caption: 'Contracts' });
        APP.appendChild(section('Contracts (' + int(b.ct.length) + ')', cb));
      }
      APP.appendChild(para('Facts from public records: counts, sums and dates.', 'small muted'));
    });
  }

  /* ------------------------------------------------------------------ sign-in */

  /* Google's own button (Google Identity Services), the same flow as the website's script.js: the
     button hands over a signed ID token and Supabase signs the visitor in on this page. The raw
     nonce goes to Supabase, its SHA-256 (hex) to Google. Google only shows the button on origins
     listed for this client id (https://solvephantasma.com; localhost only if added there). */
  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = 'https://accounts.google.com/gsi/client';
      el.async = true;
      el.onload = resolve;
      el.onerror = () => reject(new Error('the Google sign-in script did not load'));
      document.head.appendChild(el);
    });
  }
  function googleNonce() {
    return Promise.resolve().then(() => {
      const raw = btoa(String.fromCharCode.apply(null, crypto.getRandomValues(new Uint8Array(32))));
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)).then((buf) => ({
        raw: raw,
        hashed: Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join(''),
      }));
    });
  }

  /* Signed out: only the gate. Nothing is downloaded. */
  function gate() {
    document.body.classList.add('is-gated');   // hides the page links (app.css)
    setTitle('Sign in to see the Tender Portal demo', 'Sign in');
    setLead(null);
    const slot = h('div', { class: 'gate__google' });
    const msg = h('p', { class: 'gate__msg small', role: 'status' });
    clear(APP);
    add(APP, h('div', { class: 'gate' }, [
      h('p', { text: 'The Tender Portal demo is for signed-in users. Sign in with your Google account to see it.' }),
      slot,
      msg,
      h('p', { class: 'small' }, h('a', { href: OTHER_LOGIN, text: 'Other ways to sign in (email, LinkedIn)' })),
    ]));
    Promise.all([loadGis(), googleNonce()]).then((res) => {
      const nonce = res[1];
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        nonce: nonce.hashed,
        callback: (answer) => {
          msg.textContent = 'Signing you in…';
          sb.auth.signInWithIdToken({ provider: 'google', token: answer.credential, nonce: nonce.raw }).then((out) => {
            if (out.error) throw out.error;
            location.reload();                 // signed in: the same page, now with the data
          }).catch((err) => {
            console.error(err); // eslint-disable-line no-console
            msg.textContent = 'Signing in did not work. Try again, or use another way to sign in.';
          });
        },
      });
      window.google.accounts.id.renderButton(slot, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular',
        text: 'signin_with', logo_alignment: 'center', locale: 'en',
        width: Math.max(200, Math.min(400, slot.offsetWidth || 320)),   // Google allows 200-400 px
      });
    }).catch((err) => {
      console.error(err); // eslint-disable-line no-console
      msg.textContent = 'Google sign-in could not be loaded (a browser extension may block it). Reload the page, or use another way to sign in.';
    });
  }

  /* Signed in: the account's email and "Sign out" in the demo bar */
  function userBar(user) {
    const links = document.querySelector('.demo-bar__links');
    if (!links) return;
    const out = h('button', { type: 'button', class: 'demo-bar__out', text: 'Sign out' });
    out.addEventListener('click', () => {
      out.disabled = true;
      sb.auth.signOut().catch(() => null).then(() => location.reload());
    });
    add(links, h('span', { class: 'demo-bar__user' }, [
      h('span', { class: 'demo-bar__email', text: (user && user.email) || 'Signed in' }), out,
    ]));
  }

  /* The dates in the header and footer come from summary.json: the static pages carry no data */
  function dates(S) {
    const stamp = document.getElementById('stamp');
    if (stamp && S.collected) {
      clear(stamp);
      add(stamp, ['Data collected on ', h('time', { datetime: S.collected, text: day(S.collected) })]);
      stamp.hidden = false;
    }
    const foot = document.getElementById('dates');
    if (foot) foot.textContent = ' Data collected on ' + day(S.collected) + '. Built ' + day(S.built) + '.';
  }

  /* ------------------------------------------------------------------ start */

  const PAGES = {
    dashboard: pageDashboard, tenders: pageTenders, tender: pageTender, companies: pageCompanies,
    company: pageCompany, buyers: pageBuyers, buyer: pageBuyer,
  };
  function boot() {
    const run = PAGES[PAGE];
    if (!run || !APP) return;
    if (!window.supabase || !window.supabase.createClient) {
      fail(new Error('The sign-in library (supabase-js) did not load.'));
      return;
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    sb.auth.getSession().then((res) => {
      const session = res && res.data && res.data.session;
      if (!session) {
        gate();
        return null;
      }
      userBar(session.user);
      load('summary.json').then(dates, () => {});   // a failed download is reported by the page itself
      return run();
    }).catch(fail);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
