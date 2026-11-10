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
 * Local preview (python app\build_demo.py --local, folder preview_demo\): <html data-mode="local">.
 * Then the JSON comes from local-data/ next to the pages (fetch, so it needs http://, not file://),
 * there is no sign-in, and the test page my-company.html exists. The website build never sets the flag.
 *
 * Rules kept here: facts only (counts, sums, dates, prices; no scores or labels about companies);
 * every tender links to its original record; documents link to the state's copy; text from the
 * data goes into the page with textContent, never as HTML. Every widget fed by optional data
 * (enrichment, supplier widgets) is left out when its data is missing, so older JSON keeps working.
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
  const LOCAL = document.documentElement.getAttribute('data-mode') === 'local';   // laptop preview only
  const LOCAL_DATA = 'local-data/';

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
  const NFQ = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });          // quantities
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
    if (t <= Date.now()) return 'closed';
    const ge = (ms) => Math.floor((ms + 4 * 3600e3) / 864e5);   // calendar day in Georgian time (UTC+4)
    const days = ge(t) - ge(Date.now());
    if (days === 0) return 'closes today';
    if (days === 1) return 'closes tomorrow';
    return 'closes in ' + plural(days, 'day');
  }
  /** ' · 23 days to bid' (announcement to deadline, calendar days), '' when a date is missing */
  function toBid(announced, deadline) {
    const a = deadlineMs(announced);
    const d = deadlineMs(deadline);
    if (a === null || d === null || d < a) return '';
    const ge = (ms) => Math.floor((ms + 4 * 3600e3) / 864e5);
    return ' · ' + plural(ge(d) - ge(a), 'day') + ' to bid';
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
    if (!cache[path] && LOCAL) {               // local preview: the files next to the pages
      cache[path] = fetch(LOCAL_DATA + path, { cache: 'no-cache' }).then((res) => {
        if (!res.ok) {
          const err = new Error('HTTP ' + res.status + ' for ' + LOCAL_DATA + path);
          err.status = res.status;
          throw err;
        }
        return res.json();
      });
    }
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
  const TL = { tags: {}, details: {}, stages: {} };   // English for requirement tags (summary.json labels)
  function lookups(S) {
    S.categories.forEach((c) => { L.cat[c.k] = c; });
    S.statuses.forEach((x, i) => { L.status[x.k] = x; L.order[x.k] = i; });
    S.procedures.forEach((x) => { L.proc[x.k] = x; });
    if (S.labels) Object.keys(TL).forEach((k) => { TL[k] = S.labels[k] || {}; });
  }
  /** A requirement tag [tag, detail, value, stage(s)] -> 'Certificate · ISO 9001', 'Lab test' ... */
  function tagText(g) {
    if (g[0] === 'standard' && g[1] === 'regulation') return 'Regulation' + (g[2] ? ' · ' + g[2] : '');
    const name = TL.tags[g[0]] || String(g[0] || '').replace(/_/g, ' ');
    const det = g[1] ? TL.details[g[1]] || g[1] : '';
    if (g[2]) return name + (det && (g[0] === 'guarantee' || g[0] === 'experience') ? ' (' + det + ')' : '') + ' · ' + g[2];
    return det ? name + ' · ' + det : name;
  }
  function stageText(st) {
    return (Array.isArray(st) ? st : st ? [st] : []).map((x) => TL.stages[x] || x).join(', ');
  }
  function tagChip(g) {
    const stage = stageText(g[3]);
    return h('span', { class: 'chip chip--tag', title: stage ? 'Asked ' + stage : null }, tagText(g));
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
  function section(title, kids, cls, anchor) {
    const id = nextId('s');
    return h('section', { class: 'block ' + (cls || ''), id: anchor || null, 'aria-labelledby': id }, [h('h2', { id: id, text: title }), kids]);
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
    if (LOCAL) {
      add(APP, h('div', { class: 'note' }, [
        h('p', { text: 'The local data could not be read.' }),
        h('p', { class: 'small', text: location.protocol === 'file:'
          ? 'Open the preview through a local web server: python -m http.server 8765 -d preview_demo, then http://localhost:8765/.'
          : 'Run python app\\build_demo.py --local again, then reload.' }),
        h('p', { class: 'small muted', text: String((err && err.message) || err) }),
      ]));
      return;
    }
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

  /** A small legend: [[swatch node, text]] */
  function legend(items) {
    return h('p', { class: 'legend' }, items.map((x) => h('span', { class: 'legend__i' }, [x[0], x[1]])));
  }
  function swatch(kind) {
    const svg = s('svg', { class: 'legend__s', width: 18, height: 12, 'aria-hidden': 'true', focusable: 'false' });
    if (kind === 'low') svg.appendChild(s('circle', { class: 'db-low', cx: 9, cy: 6, r: 5 }));
    else if (kind === 'avg') svg.appendChild(s('circle', { class: 'db-avg', cx: 9, cy: 6, r: 4.5 }));
    else if (kind === 'ref') svg.appendChild(s('line', { class: 'db-ref', x1: 9, x2: 9, y1: 0, y2: 12 }));
    else if (kind === 'busy' || kind === 'week') svg.appendChild(s('rect', { class: 'tl-week' + (kind === 'busy' ? ' tl-week--busy' : ''), x: 4, y: 1, width: 10, height: 10 }));
    else svg.appendChild(s('rect', { class: 'tl-bar' + (kind === 'contract' ? ' tl-bar--contract' : ''), x: 1, y: 2, width: 16, height: 8, rx: 2, ry: 2 }));
    return svg;
  }

  /**
   * Two values per row on one shared "% of the estimate" scale: the lowest offer (dot) and the average
   * offer (ring), joined by a line; the dashed line is 100% = the estimate. Positions are percentages,
   * so the rows need no redraw. rows: [{label (text or node), lang, low, avg, text, sub, href, tip}]
   */
  function dumbbell(box, rows) {
    const vals = [];
    rows.forEach((r) => { [r.low, r.avg].forEach((v) => { if (isNum(v)) vals.push(v); }); });
    if (!vals.length) return;
    const lo = Math.min(80, Math.floor(Math.min.apply(null, vals) / 10) * 10);
    const hi = Math.max(100, Math.ceil(Math.max.apply(null, vals) / 10) * 10);
    const x = (v) => (5 + ((v - lo) / (hi - lo)) * 90).toFixed(2) + '%';
    const ol = h('ol', { class: 'bars dumbbell' });
    rows.forEach((r) => {
      const track = s('svg', { class: 'dumbbell__track', width: '100%', height: 16, 'aria-hidden': 'true', focusable: 'false' });
      track.appendChild(s('line', { class: 'db-ref', x1: x(100), x2: x(100), y1: 0, y2: 16 }));
      if (isNum(r.low) && isNum(r.avg)) track.appendChild(s('line', { class: 'db-span', x1: x(r.low), x2: x(r.avg), y1: 8, y2: 8 }));
      if (isNum(r.avg)) track.appendChild(s('circle', { class: 'db-avg', cx: x(r.avg), cy: 8, r: 4.5 }));
      if (isNum(r.low)) track.appendChild(s('circle', { class: 'db-low', cx: x(r.low), cy: 8, r: 5 }));
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
    const step = hi - lo <= 60 ? 10 : hi - lo <= 120 ? 20 : 50;
    const ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    if (ticks.indexOf(100) < 0) ticks.push(100);
    const axis = s('svg', { class: 'dumbbell__axis', width: '100%', height: 18, 'aria-hidden': 'true', focusable: 'false' });
    ticks.forEach((v) => axis.appendChild(s('text', { class: 'ch-tick', x: x(v), y: 13, 'text-anchor': 'middle' }, v + '%')));
    box.appendChild(axis);
  }

  /* Days and weeks for the obligations timeline: whole days since 1 Jan 1970 (UTC), weeks Monday to
     Sunday (1 Jan 1970 was a Thursday, so week w starts on day 7w - 3) */
  const DAY_MS = 864e5;
  function dayNo(iso) {
    const p = String(iso || '').slice(0, 10).split('-');
    return Math.floor(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])) / DAY_MS);
  }
  const isoDay = (d) => new Date(d * DAY_MS).toISOString().slice(0, 10);
  const weekOf = (d) => Math.floor((d + 3) / 7);
  const weekStart = (w) => w * 7 - 3;
  /** How many windows run in each week: {first, last, n: {week: count}, max} */
  function weekLoad(list) {
    const n = {};
    let first = Infinity;
    let last = -Infinity;
    let max = 0;
    list.forEach((o) => {
      const a = weekOf(o.s);
      const b = weekOf(o.e);
      first = Math.min(first, a);
      last = Math.max(last, b);
      for (let w = a; w <= b; w += 1) {
        n[w] = (n[w] || 0) + 1;
        if (n[w] > max) max = n[w];
      }
    });
    return { first: first, last: last, n: n, max: max };
  }

  /**
   * Obligations timeline. list: [{s, e (day numbers), kind, no (tender page or null), aria, tip}].
   * Top strip: one column per week, its height = windows running that week; weeks with 2 or more are
   * orange (and shaded behind the bars). Below: one bar per window, packed into rows; bars link to the
   * tender. With more than 40 rows only the strip is drawn (the table view lists every window).
   */
  function timeline(box, list, wl) {
    const lanes = [];
    list.slice().sort((a, b) => a.s - b.s || a.e - b.e).forEach((o) => {
      let i = lanes.findIndex((end) => end < o.s);
      if (i < 0) { i = lanes.length; lanes.push(o.e); } else lanes[i] = o.e;
      o.lane = i;
    });
    const withBars = lanes.length <= 40;
    const bh = lanes.length <= 12 ? 12 : 7;
    const gap = lanes.length <= 12 ? 5 : 3;
    let lastW = 0;
    function draw() {
      if (!document.body.contains(box)) return false;
      const W = Math.floor(box.clientWidth || box.getBoundingClientRect().width) || (lastW ? 0 : 560);
      if (!W || W === lastW) return true;
      lastW = W;
      clear(box);
      const d0 = weekStart(wl.first);
      const d1 = weekStart(wl.last + 1);
      const X = (d) => ((d - d0) / (d1 - d0)) * W;
      const PAD = 16;                                  // label row for "today"
      const SH = 40;                                   // the week strip, below PAD
      const top = PAD + SH + 10;                       // first bar row
      const lanesH = withBars ? lanes.length * (bh + gap) : 0;
      const H = top + lanesH + 34;                     // + month and year labels
      const svg = s('svg', { class: 'chart tl', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': 'Obligations timeline, ' + day(isoDay(d0)) + ' to ' + day(isoDay(d1 - 1)) });
      // months: grid lines and labels (the year under January and under the first label)
      let y = new Date(d0 * DAY_MS).getUTCFullYear();
      let m = new Date(d0 * DAY_MS).getUTCMonth();
      let lastX = -Infinity;
      for (;;) {
        const d = Math.floor(Date.UTC(y, m, 1) / DAY_MS);
        if (d > d1) break;
        if (d >= d0) {
          const gx = Math.round(X(d)) + 0.5;
          svg.appendChild(s('line', { class: 'ch-grid', x1: gx, x2: gx, y1: PAD, y2: top + lanesH }));
          if (gx - lastX >= 30 && gx < W - 22) {
            svg.appendChild(s('text', { class: 'ch-xl', x: gx + 3, y: top + lanesH + 15 }, MONTHS[m]));
            if (m === 0 || lastX === -Infinity) svg.appendChild(s('text', { class: 'ch-xs', x: gx + 3, y: top + lanesH + 29 }, String(y)));
            lastX = gx;
          }
        }
        m += 1;
        if (m === 12) { m = 0; y += 1; }
      }
      // weeks: shading behind the bars and the strip on top
      for (let w = wl.first; w <= wl.last; w += 1) {
        const c = wl.n[w] || 0;
        if (!c) continue;
        const x0 = X(weekStart(w));
        const bw = Math.max(1, X(weekStart(w + 1)) - x0 - (W / (wl.last - wl.first + 1) > 4 ? 1 : 0));
        if (c >= 2 && withBars) svg.appendChild(s('rect', { class: 'tl-busy', x: x0, y: top - 5, width: bw, height: lanesH + 5 }));
        const hh = Math.max(3, (c / wl.max) * (SH - 6));
        svg.appendChild(s('rect', { class: 'tl-week' + (c >= 2 ? ' tl-week--busy' : ''), x: x0, y: PAD + SH - hh, width: bw, height: hh }));
      }
      svg.appendChild(s('line', { class: 'ch-base', x1: 0, x2: W, y1: PAD + SH + 0.5, y2: PAD + SH + 0.5 }));
      if (withBars) {
        list.forEach((o) => {
          const x0 = X(o.s);
          const rect = s('rect', { class: 'tl-bar' + (o.kind === 'contract' ? ' tl-bar--contract' : ''), x: x0, y: top + o.lane * (bh + gap), width: Math.max(2, X(o.e + 1) - x0), height: bh, rx: 2, ry: 2 });
          const g = o.no ? s('a', { href: tenderUrl(o.no), class: 'tl-item', 'aria-label': o.aria }, rect) : s('g', { class: 'tl-item' }, rect);
          tip(g, o.tip);
          svg.appendChild(g);
        });
      }
      const today = Math.floor(Date.now() / DAY_MS);
      if (today >= d0 && today < d1) {
        const tx = Math.round(X(today)) + 0.5;
        svg.appendChild(s('line', { class: 'tl-today', x1: tx, x2: tx, y1: PAD - 3, y2: top + lanesH }));
        svg.appendChild(s('text', { class: 'ch-xs tl-today__t', x: tx + (tx > W - 40 ? -3 : 3), y: 11, 'text-anchor': tx > W - 40 ? 'end' : 'start' }, 'today'));
      }
      box.appendChild(svg);
      return true;
    }
    draw();
    redraws.push(draw);
    if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(box);
    if (window.requestAnimationFrame) requestAnimationFrame(() => draw());   // the box is attached by then
    return withBars;
  }

  /** A table with "show more" and, where a column has sort, sortable headers */
  function pagedTable(box, cols, rows, caption, limit, sort) {
    const st = { sort: sort ? sort[0] : null, dir: sort ? sort[1] : 'asc', limit: limit, step: 100, caption: caption };
    function render(o) {
      const x = o || {};
      dataTable(box, cols, rows, Object.assign({}, st, { focusSort: x.focusSort, focusRow: x.focusRow }), (ch) => {
        if (ch.sort) { st.sort = ch.sort; st.dir = ch.dir; }
        if (ch.limit) st.limit = ch.limit;
        render(ch);
      });
    }
    render();
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
      let turn = 0;
      function show() {
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === key())));
        const mine = ++turn;
        if (!sideOn()) {
          clear(body);
          redraws = [];
          dashboard(body, S, key());
          return;
        }
        // left filter on: count the dashboard in the browser from the tender list (loaded only now)
        Promise.all([load('tenders.json'), load('buyers.json'), load('companies.json')]).then((res) => {
          if (mine !== turn) return;
          const k = key();
          const rows = res[0].rows.filter((r) => (k === 'all' || r.c === k) && sideMatch((r.k || '').split(' '), r.p));
          clear(body);
          redraws = [];
          dashboard(body, S, k, viewFromRows(rows, S, byId(res[1].rows), byId(res[2].rows)));
        }).catch(fail);
      }
      mountSide(S, show);
      show();
      window.addEventListener('hashchange', () => { state = readHash(); show(); });
    });
  }

  /** Vx: a view counted in the browser for the left filter (viewFromRows); else the built view of k */
  function dashboard(body, S, k, Vx) {
    const V = Vx || S.views[k];
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

    // Market comparison: offers against the estimate, the winning discount, bidders per tender
    // rows: [key, label, tenders with offers, lowest %, average %, discount %, its tenders, bidders, its tenders]
    if (V.market && V.market.rows && V.market.rows.length) {
      const M = V.market;
      const isCat = M.by === 'category';
      const name = (x) => (isCat ? catLabel(x[0]) : x[0] + ' ' + (x[1] || ''));
      const c = card('Market comparison', 'Offers as a share of the buyer\'s estimate, averaged over the tenders with offers (GEL). 100% = the estimate.' + (isCat ? '' : ' By main CPV class.'));
      dumbbell(c.body, M.rows.map((x) => ({
        label: isCat ? catLabel(x[0]) : h('span', null, [x[0] + ' ', ka(x[1])]),
        low: x[3], avg: x[4], text: 'lowest ' + pct(x[3]) + ' · average ' + pct(x[4]),
        sub: plural(x[2], 'tender') + ' with offers' + (isNum(x[7]) ? ' · ' + one(x[7]) + ' bidders per tender' : '') +
          (isNum(x[5]) ? ' · average discount ' + pct(x[5]) : ''),
        href: listUrl(isCat ? { cat: x[0] } : withBase({ cpv: x[0] })),
        tip: [name(x), 'Lowest offer: ' + pct(x[3]) + ' of the estimate', 'Average offer: ' + pct(x[4]) + ' of the estimate',
          isNum(x[5]) ? 'Average discount: ' + pct(x[5]) + ' (' + plural(x[6], 'tender') + ')' : 'Average discount: not known yet',
          isNum(x[7]) ? one(x[7]) + ' bidders per tender (' + plural(x[8], 'tender') + ')' : ''].filter(Boolean),
      })));
      c.body.appendChild(legend([[swatch('low'), 'lowest offer'], [swatch('avg'), 'average offer'], [swatch('ref'), '100% = the estimate']]));
      c.el.appendChild(para('Average discount = how far the winning price was below the estimate: the contract value on the results tab, else the winner\'s last offer (consolidated CON tenders left out). Bidders per tender counts every tender with bidding closed, also those without bids.', 'card__foot muted small'));
      c.el.appendChild(tableView([{ label: isCat ? 'Category' : 'CPV class' }, { label: 'Tenders with offers', num: true },
        { label: 'Lowest offer, % of estimate', num: true }, { label: 'Average offer, % of estimate', num: true },
        { label: 'Average discount', num: true }, { label: 'Bidders per tender', num: true }],
      M.rows.map((x) => [isCat ? catLabel(x[0]) : [x[0] + ' ', ka(x[1])], int(x[2]), pct(x[3]), pct(x[4]),
        isNum(x[5]) ? pct(x[5]) + ' (' + int(x[6]) + ')' : DASH, isNum(x[7]) ? one(x[7]) + ' (' + int(x[8]) + ')' : DASH])));
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

    // Most-demanded items (price tables): rows [name, unit, tenders, GEL value, quantity]
    if (V.items && ((V.items.count && V.items.count.length) || (V.items.value && V.items.value.length))) {
      const I = V.items;
      const c = card('Most-demanded items', 'Lines of the buyers\' price tables in ' + plural(I.tenders, 'tender') + ', grouped by item name and unit.');
      const label = (x) => h('span', null, [ka(x[0]), x[1] ? h('span', { class: 'bars__sub' }, ['unit: ', ka(x[1])]) : null]);
      const amount = (x) => (isNum(x[4]) ? ' · ' + NFQ.format(x[4]) + (x[1] ? ' ' + x[1] : '') : '');
      if (I.count && I.count.length) {
        c.body.appendChild(h('h3', { class: 'card__h3', text: 'By number of tenders' }));
        bars(c.body, I.count.map((x) => ({ label: label(x), value: x[2], text: plural(x[2], 'tender') + amount(x),
          tip: [{ text: x[0], lang: 'ka' }, plural(x[2], 'tender') + amount(x), isNum(x[3]) ? short(x[3]) + ' in ceiling totals' : ''].filter(Boolean) })));
      }
      if (I.value && I.value.length) {
        c.body.appendChild(h('h3', { class: 'card__h3', text: 'By value' }));
        bars(c.body, I.value.map((x) => ({ label: label(x), value: x[3], text: short(x[3]) + ' · ' + plural(x[2], 'tender'),
          tip: [{ text: x[0], lang: 'ka' }, short(x[3]) + ' in ceiling totals', plural(x[2], 'tender')] })));
      }
      c.el.appendChild(para('Value = the buyers\' ceiling or estimated totals in GEL (unit price × quantity where the total is blank); a price table filled by the bidders has no prices.', 'card__foot muted small'));
      c.el.appendChild(tableView([{ label: 'Item' }, { label: 'Unit' }, { label: 'Tenders', num: true }, { label: 'Quantity', num: true }, { label: 'Value', num: true }],
        (I.count || []).concat((I.value || []).filter((x) => !(I.count || []).some((y) => y[0] === x[0] && y[1] === x[1])))
          .map((x) => [ka(x[0]), x[1] ? ka(x[1]) : DASH, int(x[2]), isNum(x[4]) ? NFQ.format(x[4]) : DASH, lari(x[3])])));
      grid.appendChild(c.el);
    }

    // Requirement tags: what tenders ask suppliers to prove (rows [tag, detail, value, tenders])
    if (V.tags && V.tags.n) {
      const G = V.tags;
      const c = card('What tenders ask suppliers to prove', 'Requirement tags read from the documentation of ' + plural(G.n, 'tender') + ', each counted once per tender.');
      const share = (n) => plural(n, 'tender') + ' (' + Math.round((n / G.n) * 100) + '%)';
      const kindOf = (x) => (x[1] ? (TL.details[x[1]] || x[1]).replace(/^./, (ch) => ch.toUpperCase()) + ' certificate' : 'Certificate');
      [['cert', 'Certificates', (x) => x[2] || kindOf(x) + ' (no code named)'],
        ['test', 'Tests and checks', (x) => TL.tags[x[0]] || x[0]],
        ['std', 'Standards', (x) => x[2] || DASH]].forEach((grp) => {
        const rows = G[grp[0]] || [];
        if (!rows.length) return;
        c.body.appendChild(h('h3', { class: 'card__h3', text: grp[1] }));
        bars(c.body, rows.map((x) => ({ label: grp[2](x), value: x[3], text: share(x[3]), tip: [grp[2](x), share(x[3])] })));
      });
      c.el.appendChild(para('Read automatically from the tender documents; always check the originals.', 'card__foot muted small'));
      c.el.appendChild(tableView([{ label: 'Group' }, { label: 'Tag' }, { label: 'Tenders', num: true }],
        [].concat.apply([], [['cert', 'Certificates'], ['test', 'Tests and checks'], ['std', 'Standards']].map((grp) =>
          (G[grp[0]] || []).map((x) => [grp[1], tagText(x), int(x[3])])))));
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
        r._hay = [r.no, r.t, r._bn, r._w.join(' '), (r.bi || []).map((b) => (C[b[0]] ? C[b[0]].name : '')).join(' '), r.k].join(' ').toLowerCase();
        r._so = L.order[r.s] === undefined ? 99 : L.order[r.s];
      });

      const buyers = res[2].rows.filter((b) => b.n > 0).sort((a, b) => a.name.localeCompare(b.name, 'ka'));
      const sorts = [['a', 'desc', 'Newest first'], ['a', 'asc', 'Oldest first'], ['d', 'asc', 'Deadline, soonest first'],
        ['v', 'desc', 'Highest estimated value'], ['v', 'asc', 'Lowest estimated value'], ['n', 'desc', 'Most bidders'],
        ['n', 'asc', 'Fewest bidders'], ['no', 'asc', 'Number']];
      const q = h('input', { type: 'search', name: 'q', autocomplete: 'off', spellcheck: 'false', placeholder: 'Number, title, buyer, bidder, winner or CPV code' });
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
      let shown = [];
      clear(APP);
      add(APP, [details, chips, h('div', { class: 'listbar__end' }, [summary, csvButton('tenders', () => cols, () => shown)]), tableBox]);

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
          if (sideOn() && !sideMatch((r.k || '').split(' '), r.p)) return false;      // the left filter
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
        { key: 'watch', label: 'Watch', cls: 'watchcol', noCsv: true, cell: (r) => watchButton(r.no, r.s, true) || h('span', { class: 'muted', title: 'Finished tenders cannot be watched', text: DASH }) },
        { key: 'no', label: 'Number', first: 'asc', cls: 'nowrap', sort: (r) => r.no, cell: (r) => h('a', { href: tenderUrl(r.no), text: r.no }) },
        { key: 't', label: 'Title', first: 'asc', cls: 'wide', sort: (r) => r.t, cell: (r) => [ka(r.t), r.rq ? h('span', { class: 'tag tag--req', title: plural(r.rq[0], 'requirement item') + ', ' + int(r.rq[1]) + ' must be proven', text: 'requirements' }) : null] },
        { key: 'b', label: 'Buyer', first: 'asc', cls: 'wide', sort: (r) => r._bn, cell: (r) => (r.b ? h('a', { href: buyerUrl(r.b) }, ka(r._bn)) : DASH) },
        { key: 'c', label: 'Category', first: 'asc', sort: (r) => catLabel(r.c), cell: (r) => catLabel(r.c) },
        { key: 'v', label: 'Estimated value', num: true, first: 'desc', sort: (r) => r.v, cell: (r) => (isNum(r.v) ? lari(r.v) : isNum(r.vo) ? money(r.vo, r.cur) : DASH) },
        { key: 's', label: 'Status', first: 'asc', sort: (r) => r._so, csv: (r) => statusText(r.s), cell: (r) => statusNode(r.s) },
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
        shown = dataTable(tableBox, cols, list, { sort: f.sort || 'a', dir: f.dir || 'desc', limit: limit, caption: 'Tenders', focusSort: o.focusSort, focusRow: o.focusRow }, (ch) => {
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
      mountSide(S, () => { limit = 100; render(); });
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
        t.cx ? h('a', { class: 'tag tag--cx tag--cx' + t.cx.level, href: '#requirements', title: 'How this is scored: see Requirements' }, 'Requirements: ' + t.cx.label) : null,
      ]),
      h('div', { class: 'actions' }, [
        h('a', { class: 'btn btn--primary', href: t.src, rel: 'noopener', target: '_blank' }, 'Open the original record'),
        h('a', { class: 'btn btn--ghost', href: mail }, 'Ask Phantasma to source this'),
        watchButton(t.no, t.status.k),
      ]),
      h('p', { class: 'small muted' }, ['The original record is on tenders.procurement.gov.ge (opens in a new tab). The button next to it e-mails Phantasma about this tender.']),
    ]);

    // Key facts
    const facts = [
      ['Buyer', t.buyer.id ? h('a', { href: buyerUrl(t.buyer.id) }, ka(t.buyer.name)) : DASH],
      ['Estimated value', [money(t.value, t.currency), t.vat ? h('span', { class: 'muted' }, [' · ', t.vat.en || '', t.vat.en ? ' (' : '', ka(t.vat.ka), t.vat.en ? ')' : '']) : null]],
      ['Announced', dayTime(t.announced)],
      ['Bidding opens', dayTime(t.opens)],
      ['Bid deadline', [dayTime(t.deadline), t.deadline ? h('span', { class: 'muted', text: ' · ' + (open ? closesIn(t.deadline) : 'closed') + toBid(t.announced, t.deadline) }) : null]],
      ['Procedure', [t.proc.k + (t.proc.en ? ' · ' + t.proc.en : ''), t.proc.ka ? h('span', { class: 'muted' }, [' (', ka(t.proc.ka), ')']) : null]],
      ['Status', [statusNode(t.status.k), t.status.en ? h('span', { class: 'muted' }, [' (', ka(t.status.ka), ')']) : null]],
      ['Category', [catLabel(t.cat), t.main ? h('span', { class: 'muted' }, [' · ', ka(t.main)]) : null]],
      ['CPV codes', t.cpv.length ? h('ul', { class: 'plain' }, t.cpv.map((c) => h('li', null, [c[0], c[1] ? ' · ' : '', c[1] ? ka(c[1]) : null]))) : DASH],
    ];
    t.facts.forEach((f) => facts.push([f[0], ka(f[1])]));
    if (t.desc) facts.push(['Additional information', ka(t.desc, 'pre')]);
    APP.appendChild(section('Key facts', h('dl', { class: 'facts panel' }, facts.map((f) => [h('dt', { text: f[0] }), h('dd', null, f[1])]))));

    // Deadlines: delivery / service / contract terms as written, and the windows they give signed contracts
    if (t.deadlines && ((t.deadlines.terms || []).length || (t.deadlines.windows || []).length)) {
      APP.appendChild(section('Deadlines', deadlinesBox(t.deadlines)));
    }

    // Bids
    const bidsBox = h('div');
    if (t.bids.length) {
      const low = t.bids.filter((b) => isNum(b.last)).sort((a, b) => a.last - b.last)[0];
      bidsBox.appendChild(h('p', { class: 'summary' }, [plural(t.bids.length, 'bidder'), low ? ' · lowest last offer ' + money(low.last) + (isNum(low.disc) ? ' (' + pct(low.disc) + ' below the estimate)' : '') : '']));
      const box = h('div');
      dataTable(box, [
        { key: 'c', label: 'Bidder', cls: 'wide', cell: (b) => [h('a', { href: companyUrl(b.c) }, ka(b.name)), b.won ? h('span', { class: 'tag tag--won', text: 'winner' }) : null,
          b.dq ? h('span', { class: 'tag', title: 'Disqualified (bids tab); the reason, when published, is under "Winner and contracts"', text: 'disqualified' }) : null] },
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

    // Requirements: complexity and tags (when computed), "must be proven" first, then every item by clause
    const rq = h('div');
    if (t.cx) {
      const cx = t.cx;
      rq.appendChild(h('div', { class: 'panel cx' }, [
        h('p', { class: 'cx__head' }, [
          h('span', { class: 'tag tag--cx tag--cx' + cx.level, text: 'Requirements complexity: ' + cx.label }),
          isNum(cx.points) ? h('span', { class: 'muted', text: ' ' + plural(cx.points, 'point') }) : null,
        ]),
        cx.reasons && cx.reasons.length ? h('p', null, ['Scored here: ', cx.reasons.join(' · ')]) : null,
        h('p', { class: 'small muted', text: (cx.rule_short || 'Points for each kind of proof the tender asks for (lab tests, expertise, certificates, standards …), counted once.') +
          ' It describes this tender\'s requirements, never a company.' }),
        cx.rule ? h('details', { class: 'tableview' }, [h('summary', { text: 'The full rule' }), h('p', { class: 'small', text: cx.rule })]) : null,
      ]));
    }
    if (t.req) {
      rq.appendChild(h('p', null, [plural(t.req.n, 'item') + ' read from the tender documentation; ', h('strong', { text: int(t.req.proving.length) + ' must be proven' }), ' (lab tests, expertise, certificates, inspections, samples). Read automatically: always check the originals.']));
      if (t.req.tags && t.req.tags.length) {
        rq.appendChild(h('div', { class: 'reqtags' }, [h('h3', { text: 'What this tender asks suppliers to hold or prove' }), h('p', null, t.req.tags.map(tagChip))]));
      }
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
    APP.appendChild(section('Requirements', rq, null, 'requirements'));

    // What it usually costs: this tender's price-table lines with other buyers' unit prices for the same item
    if (t.prices && t.prices.rows && t.prices.rows.length) APP.appendChild(section('What it usually costs', pricesBox(t.prices)));

    // Similar past tenders: same buyer first, then the closest CPV match
    if (t.similar && t.similar.length) APP.appendChild(section('Similar past tenders', similarBox(t)));

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
    const tags = r.tags || [];
    const shown = tags.map((g) => g[2]).filter(Boolean);       // a code shown as a tag is not repeated below
    const std = r.std.filter((x) => shown.indexOf(x) < 0);
    return h('div', { class: 'req' }, [
      withClause ? h('span', { class: 'req__ref', text: 'Clause ' + (r.ref || DASH) }) : null,
      h('span', { class: 'req__kind', text: r.kind_en || '' }),
      tags.length ? h('span', { class: 'req__tags' }, tags.map(tagChip)) : null,
      r.lead ? h('div', { class: 'req__lead' }, ['Lead line: ', ka(r.lead)]) : null,
      h('div', { class: 'req__text' }, ka(r.text)),
      (std.length || r.bodies.length || r.regs.length) ? h('div', null, [
        std.map((x) => chip(x)), r.bodies.map((x) => chip(ka(x), null, 'chip--body')), r.regs.map((x) => chip(x)),
      ]) : null,
    ]);
  }

  const OB_KIND = { delivery: 'Delivery', service: 'Service or works', contract: 'Contract in force', warranty: 'Warranty' };
  const OB_BASIS = { stated: 'dates printed on the contract', absolute: 'the tender\'s own end date', relative: 'contract date + the tender\'s term' };
  /* How the term was found (deadlines.confidence, README "Enrichment contract") */
  function confText(c) {
    if (!isNum(c)) return '';
    return c >= 0.85 ? 'the term as stated' : c >= 0.65 ? 'picked out of a longer clause'
      : c >= 0.45 ? 'from the contract draft: check it' : 'a schedule word without a date: check it';
  }
  function termText(d) {
    const extra = d.term && isNum(d.days) && !/calendar day/.test(d.term) ? ' (' + plural(d.days, 'calendar day') + ')' : '';
    if (d.start && d.end) return day(d.start) + ' to ' + day(d.end);
    if (d.end) return 'until ' + day(d.end) + (d.term ? '; ' + d.term + extra : '');
    if (d.start) return 'from ' + day(d.start) + (d.term ? '; ' + d.term + extra : '');
    return d.term ? d.term + extra : 'see the text as written';
  }

  /** Deadlines block of a tender page: {terms: [...], windows: [...], windows_n} (build_demo.py deadlines_json) */
  function deadlinesBox(D) {
    const box = h('div');
    const terms = D.terms || [];
    if (terms.length) {
      box.appendChild(h('ul', { class: 'terms' }, terms.map((d) => h('li', { class: 'panel' }, [
        h('p', { class: 'terms__head' }, [h('strong', { text: d.kind_en + ': ' }), termText(d)]),
        d.schedule || d.period ? h('p', { class: 'small' }, ['Schedule: ', d.schedule || '', d.schedule && d.period ? ', ' : '', d.period ? ka(d.period) : null]) : null,
        d.text ? h('blockquote', { class: 'terms__text' }, ka(d.text)) : null,
        h('p', { class: 'small muted' }, ['As written in ', d.from_ka ? ka(d.from) : d.from || 'the documentation', confText(d.conf) ? ' · ' + confText(d.conf) : '']),
      ]))));
    }
    const wins = D.windows || [];
    if (wins.length) {
      box.appendChild(h('h3', { text: 'Windows of the signed contracts' }));
      box.appendChild(h('ul', { class: 'plain terms__windows' }, wins.slice(0, 5).map((w) => h('li', null, [
        w.c ? h('a', { href: companyUrl(w.c) }, ka(w.cn || w.c)) : w.cn ? ka(w.cn) : 'Supplier',
        w.reg ? [' · contract ', ka(w.reg)] : null, w.date ? ' of ' + day(w.date) : null, ': ',
        h('strong', { text: (OB_KIND[w.kind] || w.kind) + ' ' + day(w.start) + ' to ' + day(w.end) }),
        h('span', { class: 'muted small', text: ' (' + (w.basis_en || OB_BASIS[w.basis] || w.basis) + ')' }),
      ]))));
      if ((D.windows_n || wins.length) > 5) box.appendChild(para('And ' + plural((D.windows_n || wins.length) - 5, 'more contract') + '; see the suppliers\' pages.', 'small muted'));
    }
    box.appendChild(para('Read automatically from the record and its documents; always check the original.', 'small muted'));
    return box;
  }

  /** "What it usually costs": rows [item, unit, quantity, this tender's unit price, price kind,
      other tenders' lowest, median, highest, tenders] */
  function pricesBox(P) {
    const box = h('div');
    const cur = P.cur || 'GEL';
    box.appendChild(h('p', null, [plural(P.n, 'line') + ' in this tender\'s price table' + ((P.files || []).length > 1 ? 's' : '') + '; ',
      h('strong', { text: int(P.compared) + ' with unit prices for the same item in other tenders' }), ' (same name and unit).']));
    const tb = h('div');
    box.appendChild(tb);
    pagedTable(tb, [
      { key: 'i', label: 'Item', cls: 'wide', first: 'asc', sort: (r) => r[0], cell: (r) => ka(r[0]) },
      { key: 'u', label: 'Unit', sort: null, cell: (r) => (r[1] ? ka(r[1]) : DASH) },
      { key: 'q', label: 'Quantity', num: true, first: 'desc', sort: (r) => r[2], cell: (r) => (isNum(r[2]) ? NFQ.format(r[2]) : DASH) },
      { key: 'p', label: 'This tender', num: true, first: 'desc', sort: (r) => r[3], cell: (r) => (isNum(r[3]) ? [money(r[3], cur), r[4] === 'ceiling' ? h('span', { class: 'muted small', text: ' ceiling' }) : null] : DASH) },
      { key: 'r', label: 'Other tenders: lowest to highest', num: true, first: 'desc', sort: (r) => r[5], cell: (r) => (isNum(r[5]) ? (r[5] === r[7] ? money(r[5], cur) : money(r[5], cur) + ' to ' + money(r[7], cur)) : DASH) },
      { key: 'm', label: 'Median', num: true, first: 'desc', sort: (r) => r[6], cell: (r) => money(r[6], cur) },
      { key: 'n', label: 'Tenders', num: true, first: 'desc', sort: (r) => r[8] || null, cell: (r) => (r[8] ? int(r[8]) : DASH) },
    ], P.rows, 'Price table lines', 50, P.compared ? ['n', 'desc'] : null);    // compared lines first
    const files = P.files || [];
    box.appendChild(h('p', { class: 'small muted' }, ['Unit prices are the ceiling or estimated prices buyers wrote in their price tables, not offers. ',
      files.length ? ['Price table: ', files.map((f, i) => [i ? ', ' : '', h('a', { href: f.url, rel: 'noopener', target: '_blank', lang: 'ka', text: f.name })]), ' (the state\'s copy).'] : null]));
    return box;
  }

  /** "Similar past tenders" of a tender page (build_demo.py similar_json) */
  const MATCH = ['same category', 'same CPV class', 'shared CPV code', 'same main CPV code'];
  function similarBox(t) {
    const rows = t.similar;
    const box = h('div');
    const discs = rows.map((r) => r.disc).filter(isNum).sort((a, b) => a - b);
    const mid = discs.length ? (discs.length % 2 ? discs[(discs.length - 1) / 2] : (discs[discs.length / 2 - 1] + discs[discs.length / 2]) / 2) : null;
    const ns = rows.map((r) => r.n).filter(isNum);
    const same = rows.filter((r) => r.sb).length;
    box.appendChild(h('p', { class: 'summary' }, [plural(rows.length, 'tender'),
      same ? ' (' + int(same) + ' of the same buyer)' : '',
      isNum(mid) ? ' · lowest offers a median ' + pct(mid) + ' below the estimate' : '',
      ns.length ? ' · ' + one(ns.reduce((a, b) => a + b, 0) / ns.length) + ' bidders on average' : '']));
    const tb = h('div');
    dataTable(tb, [
      { key: 'no', label: 'Tender', cls: 'wide', cell: (r) => [h('a', { href: tenderUrl(r.no), text: r.no }), ' ', ka(r.t),
        h('span', { class: 'muted small', text: ' · ' + (MATCH[r.m] || '') }), r.sb ? h('span', { class: 'tag tag--req', text: 'same buyer' }) : null] },
      { key: 'b', label: 'Buyer', cls: 'wide', cell: (r) => (r.b ? h('a', { href: buyerUrl(r.b) }, ka(r.bn)) : DASH) },
      { key: 'v', label: 'Estimated value', num: true, cell: (r) => money(r.v, r.cur) },
      { key: 'l', label: 'Lowest offer', num: true, cell: (r) => money(r.low, r.cur) },
      { key: 'a', label: 'Average offer', num: true, cell: (r) => money(r.avg, r.cur) },
      { key: 'd', label: 'Lowest below the estimate', num: true, cell: (r) => pct(r.disc) },
      { key: 'n', label: 'Bidders', num: true, cell: (r) => int(r.n) },
      { key: 'w', label: 'Winner', cls: 'wide', cell: (r) => (r.w ? [h('a', { href: companyUrl(r.w[0]) }, ka(r.w[1])), isNum(r.w[2]) ? h('span', { class: 'muted small', text: ' · ' + short(r.w[2]) }) : null,
        r.wn > 1 ? h('span', { class: 'muted small', text: ' +' + (r.wn - 1) + ' more' }) : null] : h('span', { class: 'muted', text: 'not known yet' })) },
      { key: 'c', label: 'Bidding closed', cell: (r) => day(r.d) },
    ], rows, { caption: 'Similar past tenders' });
    box.appendChild(tb);
    box.appendChild(para('Past = bidding closed before this tender\'s deadline. Order: the same buyer first, then the closest CPV match (main code, a shared code, the same class, the same category), newest first. Offers are the last offers on each tender\'s bids tab; the winner\'s value is the contract value where it is published.', 'small muted'));
    return box;
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
    let shown = rows;                              // the list as shown (filtered + sorted), for the download
    const bar = h('div', { class: 'listbar__end' });
    if (summary.parentNode) summary.parentNode.replaceChild(bar, summary);
    add(bar, [summary, csvButton(String(caption || 'list').toLowerCase(), () => cols, () => shown)]);
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
      shown = dataTable(box, cols, list, { sort: state.sort || defSort, dir: state.dir || defDir, limit: limit, caption: caption, focusSort: opts.focusSort, focusRow: opts.focusRow }, (ch) => {
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
      // Obligations over time (contracts won: delivery / service windows, else the contract dates)
      const obs = obligationsBox(c.ob, B);
      if (obs) APP.appendChild(section('Obligations over time', obs));
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

  /**
   * Obligations timeline of a company page. ob: [[contract no, tender page or null, buyer page or null,
   * start, end, kind, basis, GEL value, tender number as text, buyer name without a page]]
   * (build_demo.py obligation_rows). Facts only: dates of the contracts it won, no score.
   */
  function obligationsBox(ob, B) {
    const list = (ob || []).map((o) => {
      const x = { reg: o[0], no: o[1], b: o[2], start: o[3], end: o[4], kind: o[5], basis: o[6], v: o[7], tn: o[8] || o[1],
        bn: o[9] || (o[2] && B[o[2]] ? B[o[2]].name : null), s: dayNo(o[3]), e: dayNo(o[4]) };
      const what = (OB_KIND[x.kind] || x.kind) + ': ' + day(x.start) + ' to ' + day(x.end);
      x.aria = 'Contract ' + (x.reg || x.tn || '') + ', ' + what;
      x.tip = [x.reg || x.tn || 'Contract', x.bn ? { text: x.bn, lang: 'ka' } : '', what, 'From ' + (OB_BASIS[x.basis] || x.basis), isNum(x.v) ? short(x.v) : ''].filter(Boolean);
      return x;
    }).filter((x) => isFinite(x.s) && isFinite(x.e) && x.e >= x.s);
    if (!list.length) return null;
    const wl = weekLoad(list);
    const busy = Object.keys(wl.n).map(Number).filter((w) => wl.n[w] >= 2).sort((a, b) => a - b);
    let peak = null;
    busy.forEach((w) => { if (peak === null || wl.n[w] > wl.n[peak]) peak = w; });
    const box = h('div');
    box.appendChild(h('p', { class: 'summary' }, [plural(list.length, 'contract window'), ' · ',
      busy.length ? plural(busy.length, 'week') + ' with 2 or more running at once (most: ' + int(wl.n[peak]) + ', week of ' + day(isoDay(weekStart(peak))) + ')' : 'no week with 2 or more at once']));
    const chart = h('div', { class: 'tl-box' });
    box.appendChild(chart);
    const withBars = timeline(chart, list, wl);
    const hasContract = list.some((x) => x.kind === 'contract');
    box.appendChild(legend([withBars ? [swatch('bar'), 'delivery or service window'] : null,
      withBars && hasContract ? [swatch('contract'), 'contract in force (no delivery term known)'] : null,
      [swatch('week'), 'week with 1 running'], [swatch('busy'), 'week with 2 or more at once']].filter(Boolean)));
    const orphans = list.filter((x) => !x.no).length;
    box.appendChild(para('Top strip: how many windows run in each week. ' +
      (withBars ? 'Below it, one bar per contract won: ' : 'Too many overlap to draw one bar each; "Show as table" lists every contract. Each window is ') +
      'the delivery or service window where the contract or the tender states one, otherwise the contract\'s validity.' +
      (orphans ? ' ' + plural(orphans, 'contract') + ' under consolidated tenders announced before this demo\'s window ' + (orphans === 1 ? 'has' : 'have') + ' no tender page here.' : '') +
      ' Dates as published; facts only, no score.', 'small muted'));
    const rows = list.slice().sort((a, b) => a.s - b.s || a.e - b.e);
    box.appendChild(tableView([{ label: 'Contract' }, { label: 'Tender' }, { label: 'Buyer' }, { label: 'From' }, { label: 'To' }, { label: 'What' }, { label: 'Dates from' }, { label: 'Value', num: true }],
      rows.map((x) => [x.reg ? ka(x.reg) : DASH, x.no ? h('a', { href: tenderUrl(x.no), text: x.no }) : x.tn || DASH,
        x.b && B[x.b] ? h('a', { href: buyerUrl(x.b) }, ka(x.bn)) : x.bn ? ka(x.bn) : DASH, day(x.start), day(x.end),
        OB_KIND[x.kind] || x.kind, OB_BASIS[x.basis] || x.basis, lari(x.v)])));
    if (busy.length) {
      box.appendChild(h('details', { class: 'tableview' }, [
        h('summary', { text: 'Weeks with 2 or more at once (' + int(busy.length) + ')' }),
        h('p', { class: 'small' }, busy.map((w, i) => (i ? ', ' : '') + day(isoDay(weekStart(w))) + ' (' + wl.n[w] + ')').join('')),
      ]));
    }
    return box;
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

  /* ------------------------------------------------------------------ my company (local preview only) */

  const CODE_TAGS = ['certificate', 'standard', 'licence', 'building_class'];   // the value is a code or class
  function refLinks(refs, titles) {
    return refs.map((no, i) => [i ? ', ' : '', h('a', { href: tenderUrl(no), text: no, title: (titles && titles[no]) || null })]);
  }

  /* The gap analysis of a test company (app/my_company.py; my_company.json exists only in the local
     preview): its history, the tags of the tenders it won, and for every open tender in its
     categories what is asked and whether its certificates or past wins cover it. */
  function pageMyCompany() {
    if (!LOCAL) {
      notFound('This test page exists only in the local preview.');
      return Promise.resolve();
    }
    return Promise.all([load('summary.json'), load('my_company.json')]).then((res) => {
      const S = res[0];
      const M = res[1];
      lookups(S);
      const co = M.company;
      setTitle(['My company (test): ', ka(co.name)], 'My company');
      setLead([co.how === 'set' ? 'Set with app\\my_company.py' + (co.set_at ? ' on ' + day(local10(co.set_at)) : '') + '. '
        : 'No company set yet, so this shows the company with the most wins. ',
      'Change it with python app\\my_company.py --set <company id> (the id in a company page\'s address), add certificates with --cert "ISO 9001", then run python app\\build_demo.py --local again.']);
      clear(APP);
      const open = M.open.filter((o) => isOpen(o.d));
      add(APP, h('dl', { class: 'kpis' }, [
        kpi('Tenders entered', int(M.kpi.e), 'with a bid on record'),
        kpi('Won', int(M.kpi.w), 'contracts on record'),
        kpi('Value won', M.kpi.wv === null ? DASH : short(M.kpi.wv), 'contract value, GEL'),
        kpi('Your certificates', int(M.certs.length), 'in the test profile'),
        kpi('Open tenders', int(open.length), 'in your categories'),
        kpi('With requirement tags', int(open.filter((o) => o.tagged).length), 'of those open tenders'),
      ]));
      APP.appendChild(h('div', { class: 'actions' }, [h('a', { class: 'btn btn--ghost btn--small', href: companyUrl(co.id), text: 'The company\'s public page' })]));

      APP.appendChild(section('Your certificates', M.certs.length ? h('p', null, M.certs.map((x) => chip(x)))
        : para(['None in the test profile yet. Add one: ', h('code', { text: 'python app\\my_company.py --cert "ISO 9001"' })])));

      // Open tenders in its categories: what is asked, covered or missing
      const ob = h('div');
      if (!M.tags_ready) ob.appendChild(para('Requirement tags are not computed yet (app\\run_enrich.py), so nothing can be compared. The open tenders are listed; their gaps show after the next data run.', 'note'));
      if (!open.length) ob.appendChild(para('No tender in your categories is open for bids right now.'));
      open.forEach((o) => {
        const id = nextId('o');
        const gaps = o.need.filter((n) => n.how === 'gap').length;
        const card2 = h('article', { class: 'panel need-card', 'aria-labelledby': id }, [
          h('h3', { id: id, class: 'need-card__title' }, h('a', { href: tenderUrl(o.no) }, [o.no + ' · ', ka(o.t)])),
          h('p', { class: 'small muted' }, [o.b ? h('a', { href: buyerUrl(o.b) }, ka(o.bn)) : null, o.b ? ' · ' : '', isNum(o.v) ? lari(o.v) + ' estimated · ' : '',
            h('strong', { text: closesIn(o.d) }), ' (' + dayTime(o.d) + ')', o.src ? [' · ', h('a', { href: o.src, rel: 'noopener', target: '_blank', text: 'original record' })] : null]),
          o.cx ? h('p', null, h('span', { class: 'tag tag--cx tag--cx' + o.cx[0], text: 'Requirements: ' + o.cx[1] })) : null,
        ]);
        if (!o.tagged) {
          card2.appendChild(para(o.read ? 'Requirements read; tags not computed yet.' : 'Requirements not read yet: the documents come in a later data run.', 'small muted'));
        } else if (!o.need.length) {
          card2.appendChild(para('Nothing to hold or prove was found in its requirements (guarantees and warranty aside).', 'small'));
        } else {
          card2.appendChild(h('p', { class: 'need__sum' }, [plural(o.need.length, 'thing') + ' to hold or prove · ', h('strong', { text: plural(gaps, 'gap') }), ' · ' + int(o.need.length - gaps) + ' covered']));
          card2.appendChild(h('ul', { class: 'need' }, o.need.map((n) => h('li', { class: 'need__i need__i--' + (n.how === 'gap' ? 'gap' : 'ok') }, [
            h('span', { class: 'need__mark', 'aria-hidden': 'true', text: n.how === 'gap' ? '✕' : '✓' }),
            h('span', { class: 'need__body' }, [
              h('span', { class: 'visually-hidden', text: n.how === 'gap' ? 'Gap. ' : 'Covered. ' }),
              'Required: ', h('strong', { text: tagText(n.g) }), stageText(n.g[3]) ? h('span', { class: 'muted', text: ' (' + stageText(n.g[3]) + ')' }) : null, '. ',
              n.how === 'gap' ? (CODE_TAGS.indexOf(n.g[0]) >= 0 && n.g[2] ? 'Not in your certificates and not in any tender you won.' : 'Not asked in any tender you won.')
                : n.how === 'cert' ? ['In your certificates: ', h('strong', { text: n.cert }), '.', n.refs.length ? [' Also asked in tenders you won: ', refLinks(n.refs, M.titles), n.more ? ' and ' + n.more + ' more' : '', '.'] : null]
                  : ['Asked in tenders you won; reuse from ', refLinks(n.refs, M.titles), n.more ? ' and ' + n.more + ' more' : '', '.'],
            ]),
          ]))));
        }
        ob.appendChild(card2);
      });
      APP.appendChild(section('Open tenders in your categories (' + int(open.length) + ')', ob));

      // Tags of the tenders it won
      const wt = h('div');
      if (!M.tags_ready) wt.appendChild(para('Shown once requirement tags are computed.'));
      else if (!M.won_tags.length) wt.appendChild(para('None of the tenders won so far has requirement tags yet (documents not read, or nothing to prove).'));
      else {
        wt.appendChild(h('ul', { class: 'wontags' }, M.won_tags.map((w) => h('li', null, [tagChip(w.g), ' ',
          h('span', { class: 'small' }, ['in ' + plural(w.refs.length, 'won tender') + ': ', refLinks(w.refs.slice(0, 12), M.titles), w.refs.length > 12 ? ' and ' + (w.refs.length - 12) + ' more' : ''])]))));
      }
      APP.appendChild(section('What the tenders you won asked for', wt));

      // History: every tender entered
      const hb = h('div');
      if (M.history.length) {
        pagedTable(hb, [
          { key: 'no', label: 'Number', first: 'asc', sort: (r) => r[0], cell: (r) => h('a', { href: tenderUrl(r[0]), text: r[0] }) },
          { key: 't', label: 'Title', cls: 'wide', sort: null, cell: (r) => ka(r[1]) },
          { key: 'b', label: 'Buyer', cls: 'wide', sort: null, cell: (r) => (r[2] ? h('a', { href: buyerUrl(r[2]) }, ka(r[3])) : DASH) },
          { key: 'v', label: 'Estimated value', num: true, first: 'desc', sort: (r) => r[4], cell: (r) => lari(r[4]) },
          { key: 'o', label: 'Your last offer', num: true, first: 'desc', sort: (r) => r[5], cell: (r) => money(r[5]) },
          { key: 'd', label: 'Below the estimate', num: true, first: 'desc', sort: (r) => r[6], cell: (r) => pct(r[6]) },
          { key: 'r', label: 'Result', first: 'asc', sort: (r) => r[7], cell: (r) => (r[7] === 'won' ? h('span', { class: 'tag tag--won', text: 'won' + (isNum(r[8]) ? ' · ' + short(r[8]) : '') })
            : r[7] === 'other' ? 'another company won' : h('span', { class: 'muted', text: WINNER_HINT[r[7]] || DASH })) },
          { key: 'g', label: 'Tags read', sort: null, cell: (r) => (r[10] ? 'yes' : h('span', { class: 'muted', text: 'not yet' })) },
          { key: 'a', label: 'Announced', first: 'desc', sort: (r) => r[9], cell: (r) => day(r[9]) },
        ], M.history, 'Tenders entered', 50, null);
      } else {
        hb.appendChild(para('No tender entered on record.'));
      }
      APP.appendChild(section('Your history: tenders entered (' + int(M.history.length) + ')', hb));
      APP.appendChild(para('Test page, local only. Certificate and standard codes match exactly (ISO 9001:2015 counts as ISO 9001); other requirements match by kind. Read automatically: check the originals.', 'small muted'));
    });
  }
  /** '2026-11-08T09:12:00+00:00' -> '2026-11-08' in Georgian time (falls back to the first 10 characters) */
  function local10(ts) {
    const t = Date.parse(ts);
    return isNaN(t) ? String(ts || '').slice(0, 10) : new Date(t + 4 * 3600e3).toISOString().slice(0, 10);
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

  /* ------------------------------------------------------------------ the bell (10 Nov 2026) */
  // Owner, 10 Nov: "an alert system; for starting an internal notification: a bell with two tabs. Watchlist:
  // a tender I tick that is not finished yet, notified on any change or update. Bid opening: newly
  // announced tenders that interest me." First version: kept in this browser (localStorage) and compared
  // with alerts.json, i.e. with what each tender looked like at the last data upload.
  const WATCH_KEY = 'tp_watch_v1';
  const ALERT_KEY = 'tp_alert_v1';
  function stored(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return v && typeof v === 'object' ? v : fallback;
    } catch (e) { return fallback; }
  }
  function keep(key, v) {
    try {
      if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v));
    } catch (e) { /* private window: this page only */ }
    document.dispatchEvent(new CustomEvent('tp:bell'));
  }
  const watched = () => stored(WATCH_KEY, {});
  const interests = () => stored(ALERT_KEY, null);
  let AL = null;
  // alerts.json rows: [no, title, status, deadline, bidders, lowest offer, winners, contract value, estimated
  // value, announced, category, codes, procedure, buyer]
  function alerts() {
    if (AL) return Promise.resolve(AL);
    return load('alerts.json').then((x) => {
      AL = x;
      AL.by = {};
      x.rows.forEach((r) => { AL.by[r[0]] = r; });
      return AL;
    });
  }
  const FINISHED = ['contract', 'negative', 'failed', 'terminated'];
  const isFinished = (k) => ((AL && AL.finished) || FINISHED).indexOf(k) >= 0;
  const snapOf = (r) => ({ s: r[2], d: r[3], n: r[4], low: r[5], w: r[6], cv: r[7], v: r[8] });
  function changes(snap, r) {
    const out = [];
    if (!snap || !r) return out;
    if (snap.s !== r[2]) out.push('Status: ' + statusText(snap.s) + ' → ' + statusText(r[2]));
    if (snap.d !== r[3]) out.push('Bid deadline: ' + (snap.d ? dayTime(snap.d) : DASH) + ' → ' + (r[3] ? dayTime(r[3]) : DASH));
    if (snap.n !== r[4] && isNum(r[4])) out.push(isNum(snap.n) ? 'Bidders: ' + snap.n + ' → ' + r[4] : 'Bids opened: ' + plural(r[4], 'bidder'));
    if (snap.low !== r[5] && isNum(r[5])) out.push('Lowest offer: ' + money(r[5]));
    if (snap.w !== r[6] && r[6]) out.push('Winner: ' + r[6]);
    if (snap.cv !== r[7] && isNum(r[7])) out.push('Contract: ' + money(r[7]));
    if (snap.v !== r[8] && isNum(r[8]) && isNum(snap.v)) out.push('Estimated value: ' + lari(snap.v) + ' → ' + lari(r[8]));
    return out;
  }
  function setWatch(no, on) {
    return alerts().then((A) => {
      const W = watched();
      if (on && A.by[no]) W[no] = { at: new Date().toISOString(), snap: snapOf(A.by[no]) };
      else delete W[no];
      keep(WATCH_KEY, W);
    });
  }
  /** ☆ / ★ for a tender that is not finished (small: in the Tenders list; else a button on the tender page) */
  function watchButton(no, statusKey, small) {
    if (isFinished(statusKey) && !watched()[no]) return null;
    const b = h('button', { type: 'button', class: small ? 'watch watch--small' : 'btn btn--ghost watch' });
    const paint = () => {
      const on = !!watched()[no];
      b.setAttribute('aria-pressed', String(on));
      b.title = on ? 'Watching: the bell tells you when this tender changes. Click to stop.' : 'Watch this tender: the bell tells you when its status, deadline, bids, winner or contract changes';
      b.textContent = small ? (on ? '★' : '☆') : (on ? '★ Watching' : '☆ Watch');
      if (small) b.setAttribute('aria-label', (on ? 'Stop watching ' : 'Watch ') + no);
    };
    paint();
    b.addEventListener('click', (e) => {
      e.preventDefault();
      b.disabled = true;
      setWatch(no, !watched()[no]).then(() => { b.disabled = false; paint(); }, () => { b.disabled = false; });
    });
    if (!small) document.addEventListener('tp:bell', paint);
    return b;
  }
  function interestMatch(I, r) {
    if (I.types && I.types.length && I.types.indexOf(r[12]) < 0) return false;
    const codes = (r[11] || '').split(' ');
    if (I.codes && I.codes.length && !codes.some((c) => I.codes.some((p) => c.indexOf(p) === 0))) return false;
    return true;
  }
  const openMatches = (A, I) => A.rows.filter((r) => r[3] && isOpen(r[3]) && interestMatch(I, r));
  const interestText = (I) => [I.types.join(', '), I.codes.map((p) => p.padEnd(8, '0')).join(', ')].filter(Boolean).join(' · ');
  /** Alerts for new tenders like the left filter; what is open now is the baseline, later ones are new */
  function setInterests(codes, types) {
    return alerts().then((A) => {
      const I = { codes: codes.slice(), types: types.slice(), at: new Date().toISOString(), seen: [] };
      I.seen = openMatches(A, I).map((r) => r[0]);
      keep(ALERT_KEY, I);
    });
  }
  function bellCounts(A) {
    const W = watched();
    const I = interests();
    return [Object.keys(W).filter((no) => changes(W[no].snap, A.by[no]).length).length,
      I ? openMatches(A, I).filter((r) => I.seen.indexOf(r[0]) < 0).length : 0];
  }
  function bellIcon() {
    const svg = s('svg', { viewBox: '0 0 24 24', width: '20', height: '20', 'aria-hidden': 'true', focusable: 'false', class: 'bell__i' });
    svg.appendChild(s('path', { fill: 'currentColor', d: 'M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6v-5a7 7 0 0 0-5.25-6.78V3.5a1.75 1.75 0 0 0-3.5 0v.72A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2z' }));
    return svg;
  }
  function mountBell() {
    const head = document.querySelector('.site-head .wrap');
    if (!head || document.querySelector('.bellbox')) return;
    const badge = h('span', { class: 'bell__n', hidden: '' });
    const btn = h('button', { type: 'button', class: 'bell', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-label': 'Notifications' }, [bellIcon(), badge]);
    const panel = h('div', { class: 'bellpanel', role: 'dialog', 'aria-label': 'Notifications', tabindex: '-1', hidden: '' });
    const box = h('div', { class: 'bellbox' }, [btn, panel]);
    head.insertBefore(box, head.querySelector('.stamp'));
    let tab = 'watch';
    function badgeUpdate() {
      if (!Object.keys(watched()).length && !interests()) {
        badge.hidden = true;
        btn.setAttribute('aria-label', 'Notifications');
        return;
      }
      alerts().then((A) => {
        const c = bellCounts(A);
        const n = c[0] + c[1];
        badge.hidden = !n;
        badge.textContent = n > 99 ? '99+' : String(n);
        btn.setAttribute('aria-label', 'Notifications' + (n ? ': ' + n + ' new' : ''));
      }).catch(() => {});
    }
    function watchTab(A, body) {
      const W = watched();
      const nos = Object.keys(W).sort((a, b) => (changes(W[b].snap, A.by[b]).length ? 1 : 0) - (changes(W[a].snap, A.by[a]).length ? 1 : 0) || (W[b].at > W[a].at ? 1 : -1));
      if (!nos.length) {
        add(body, para('No tender watched yet. Press ☆ in the "Watch" column of Tenders, or "☆ Watch" on a tender page (tenders that are not finished); the bell then tells you when its status, deadline, bids, winner or contract changes.', 'small muted'));
        return;
      }
      add(body, h('ul', { class: 'bell__list' }, nos.map((no) => {
        const r = A.by[no];
        const ch = changes(W[no].snap, r);
        return h('li', { class: 'bell__item' + (ch.length ? ' is-new' : '') }, [
          h('p', { class: 'bell__top' }, [h('a', { href: tenderUrl(no), class: 'bell__no', text: no }), ch.length ? h('span', { class: 'tag tag--won', text: 'changed' }) : null]),
          r ? h('span', { class: 'bell__t' }, ka(r[1])) : null,
          h('span', { class: 'bell__meta' }, r ? [statusText(r[2]), r[3] ? ' · deadline ' + dayTime(r[3]) : ''] : 'No longer in the data'),
          ch.length ? h('ul', { class: 'bell__changes' }, ch.map((x) => h('li', { text: x }))) : null,
          h('p', { class: 'bell__acts' }, [
            ch.length && r ? h('button', { type: 'button', class: 'linkish small', text: 'Mark as seen', on: { click: () => { const W2 = watched(); if (W2[no]) { W2[no].snap = snapOf(r); keep(WATCH_KEY, W2); } } } }) : null,
            h('button', { type: 'button', class: 'linkish small', text: 'Stop watching', on: { click: () => { const W2 = watched(); delete W2[no]; keep(WATCH_KEY, W2); } } }),
          ]),
        ]);
      })));
      if (nos.some((no) => changes(W[no].snap, A.by[no]).length)) {
        add(body, h('p', { class: 'bell__all' }, h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Mark all as seen', on: { click: () => {
          const W2 = watched();
          Object.keys(W2).forEach((no) => { if (A.by[no]) W2[no].snap = snapOf(A.by[no]); });
          keep(WATCH_KEY, W2);
        } } })));
      }
    }
    function openTab(A, body) {
      const I = interests();
      if (!I) {
        add(body, para('Choose tender types or codes in the left panel (Dashboard, Tenders or Products on a wide screen) and press "Alert me about new tenders like this". Tenders that match and open for bids then show here; the new ones are counted on the bell.', 'small muted'));
        return;
      }
      const rows = openMatches(A, I).sort((a, b) => (a[3] < b[3] ? -1 : 1));
      add(body, h('p', { class: 'small' }, ['Alerts for: ', h('strong', { text: interestText(I) }), ' ',
        h('button', { type: 'button', class: 'linkish small', text: 'stop', on: { click: () => keep(ALERT_KEY, null) } })]));
      if (!rows.length) {
        add(body, para('No tender that matches is open for bids right now.', 'small muted'));
        return;
      }
      add(body, h('ul', { class: 'bell__list' }, rows.slice(0, 100).map((r) => {
        const fresh = I.seen.indexOf(r[0]) < 0;
        return h('li', { class: 'bell__item' + (fresh ? ' is-new' : '') }, [
          h('p', { class: 'bell__top' }, [h('a', { href: tenderUrl(r[0]), class: 'bell__no', text: r[0] }), h('span', { class: 'muted small', text: ' ' + (r[12] || '') }),
            fresh ? h('span', { class: 'tag tag--open', text: 'new' }) : null]),
          h('span', { class: 'bell__t' }, ka(r[1])),
          h('span', { class: 'bell__meta' }, [r[13] ? ka(r[13]) : null, r[13] ? ' · ' : '', closesIn(r[3]) + (isNum(r[8]) ? ' · ' + lari(r[8]) : '')]),
        ]);
      })));
      if (rows.some((r) => I.seen.indexOf(r[0]) < 0)) {
        add(body, h('p', { class: 'bell__all' }, h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Mark all as seen', on: { click: () => {
          const I2 = interests();
          if (I2) { I2.seen = Array.from(new Set(I2.seen.concat(rows.map((r) => r[0])))); keep(ALERT_KEY, I2); }
        } } })));
      }
    }
    function render() {
      clear(panel);
      panel.appendChild(h('p', { class: 'loading', text: 'Loading…' }));
      alerts().then((A) => {
        const c = bellCounts(A);
        clear(panel);
        const tabs = h('div', { class: 'bellpanel__tabs', role: 'tablist' }, [['watch', 'Watchlist', c[0]], ['open', 'Bid opening', c[1]]].map((x) =>
          h('button', { type: 'button', role: 'tab', class: 'bellpanel__tab', 'aria-selected': String(tab === x[0]),
            on: { click: () => { tab = x[0]; render(); } } }, [x[1], x[2] ? h('span', { class: 'bell__n bell__n--in', text: String(x[2]) }) : null])));
        const body = h('div', { class: 'bellpanel__body', role: 'tabpanel' });
        add(panel, [tabs, body]);
        if (tab === 'watch') watchTab(A, body); else openTab(A, body);
        add(body, para('Kept in this browser. Checked against the data uploaded on ' + day(A.made) + '.', 'small muted bell__foot'));
      }).catch((err) => {
        clear(panel);
        panel.appendChild(para('The alerts could not be loaded (' + ((err && err.message) || err) + ').', 'small'));
      });
    }
    function openPanel() {
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      render();
      panel.focus();
    }
    function closePanel() {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
    btn.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) { closePanel(); btn.focus(); }
    });
    document.addEventListener('click', (e) => {   // a click elsewhere closes it (a re-drawn button inside does not)
      if (!panel.hidden && document.contains(e.target) && !box.contains(e.target)) closePanel();
    });
    document.addEventListener('tp:bell', () => { badgeUpdate(); if (!panel.hidden) render(); });
    window.addEventListener('storage', (e) => {
      if (e.key === WATCH_KEY || e.key === ALERT_KEY) { badgeUpdate(); if (!panel.hidden) render(); }
    });
    badgeUpdate();
  }

  /* ------------------------------------------------------------------ left filter (10 Nov 2026) */
  // Owner, 10 Nov: "a left side filter, frozen while the page scrolls: codes and sub codes, and the type
  // of the tender (NAT, SPA, B2B, CON, GEO, DEP ...)". A sticky panel left of the content on wide screens
  // (CSS: from 1360 px), on the Dashboard, Tenders and Products. One choice for the whole demo, kept in
  // this browser (localStorage). Codes are prefixes: '391' = 39100000 and everything under it.
  const SIDE_KEY = 'tp_side_v1';
  const side = { codes: [], types: [] };
  function sideLoad() {
    try {
      const o = JSON.parse(localStorage.getItem(SIDE_KEY) || '{}');
      side.codes = Array.isArray(o.codes) ? o.codes.filter((c) => /^\d{2,8}$/.test(c)) : [];
      side.types = Array.isArray(o.types) ? o.types.filter((c) => /^[A-Z0-9]{2,6}$/.test(c)) : [];
    } catch (e) { side.codes = []; side.types = []; }
  }
  function sideSave() {
    try { localStorage.setItem(SIDE_KEY, JSON.stringify(side)); } catch (e) { /* private window: this page only */ }
    document.dispatchEvent(new CustomEvent('tp:side'));
  }
  const sideOn = () => side.codes.length > 0 || side.types.length > 0;
  /** codes: the tender's 8-digit codes; type: NAT, SPA ... */
  function sideMatch(codes, type) {
    if (side.types.length && side.types.indexOf(type) < 0) return false;
    if (side.codes.length && !(codes || []).some((c) => side.codes.some((p) => String(c).indexOf(p) === 0))) return false;
    return true;
  }
  function sideSummary() {
    if (!sideOn()) return 'All tenders';
    return [side.types.length ? side.types.join(', ') : null,
      side.codes.length ? side.codes.map((p) => p.padEnd(8, '0')).slice(0, 3).join(', ') + (side.codes.length > 3 ? ' +' + (side.codes.length - 3) : '') : null]
      .filter(Boolean).join(' · ');
  }
  function mountSide(S, onChange) {
    sideLoad();
    const main = document.getElementById('main');
    if (!main || !S.codes) return;
    const nodes = S.codes;                                   // [prefix, name, tenders], sorted
    const have = new Set(nodes.map((x) => x[0]));
    const kids = {};
    const roots = [];
    nodes.forEach((x) => {
      let p = x[0].slice(0, -1);
      while (p.length >= 3 && !have.has(p)) p = p.slice(0, -1);
      if (p.length >= 3) (kids[p] = kids[p] || []).push(x); else roots.push(x);
    });
    roots.sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]));   // the big categories first
    const sum = h('p', { class: 'side__sum' });
    const clearBtn = h('button', { type: 'button', class: 'linkish small', text: 'Clear', on: { click: () => { side.codes = []; side.types = []; sideSave(); } } });
    const find = h('input', { type: 'search', class: 'side__find', placeholder: 'Find a code or a word', 'aria-label': 'Find a code or a word', autocomplete: 'off', spellcheck: 'false' });
    const tree = h('div', { class: 'side__tree' });
    function toggleCode(p, on) {
      side.codes = side.codes.filter((c) => c !== p);
      if (on) side.codes.push(p);
      sideSave();
    }
    function row(x, withKids) {
      const p = x[0];
      const box = h('input', { type: 'checkbox', 'data-p': p, on: { change: (e) => toggleCode(p, e.target.checked) } });
      box.checked = side.codes.indexOf(p) >= 0;
      const label = h('label', { class: 'side__label' }, [box, h('span', { class: 'side__code', text: p.padEnd(8, '0') }),
        x[1] ? h('span', { class: 'side__name', lang: 'ka', text: x[1] }) : null, h('span', { class: 'side__n', text: int(x[2]) })]);
      if (!withKids || !kids[p]) return h('div', { class: 'side__row' }, [h('span', { class: 'side__gap' }), label]);
      const box2 = h('div', { class: 'side__kids', hidden: '' });
      const btn = h('button', { type: 'button', class: 'side__tog', 'aria-expanded': 'false', 'aria-label': 'Show the codes under ' + p.padEnd(8, '0'), text: '▸' });
      let drawn = false;
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        if (open && !drawn) { add(box2, kids[p].map((y) => row(y, true))); drawn = true; }
        btn.setAttribute('aria-expanded', String(open));
        btn.textContent = open ? '▾' : '▸';
        box2.hidden = !open;
      });
      const wrap = h('div', { class: 'side__branch' }, [h('div', { class: 'side__row' }, [btn, label]), box2]);
      if (side.codes.some((c) => c !== p && c.indexOf(p) === 0)) btn.click();   // a chosen code below: open
      return wrap;
    }
    function drawTree() {
      clear(tree);
      const q = find.value.trim().toLowerCase();
      if (!q) { add(tree, roots.map((x) => row(x, true))); return; }
      const digits = q.replace(/\D/g, '');
      const hits = nodes.filter((x) => (digits && /^\d+$/.test(q) ? x[0].padEnd(8, '0').indexOf(digits) === 0 || x[0].indexOf(digits.replace(/0+$/, '')) === 0
        : (x[1] || '').toLowerCase().indexOf(q) >= 0)).slice(0, 80);
      add(tree, hits.length ? hits.map((x) => row(x, false)) : h('p', { class: 'small muted', text: 'No code matches.' }));
    }
    const types = h('div', { class: 'side__types' }, (S.procedures || []).map((x) => {
      const box = h('input', { type: 'checkbox', on: { change: (e) => {
        side.types = side.types.filter((t) => t !== x.k);
        if (e.target.checked) side.types.push(x.k);
        sideSave();
      } } });
      box.checked = side.types.indexOf(x.k) >= 0;
      return h('label', { class: 'side__label side__type', title: procText(x.k) }, [box, h('span', { class: 'side__code', text: x.k }), h('span', { class: 'side__n', text: int(x.n) })]);
    }));
    const alertLine = h('div', { class: 'side__alert' });   // the bell's "Bid opening" interests
    function paintAlert() {                                   // always visible, so it can be found (owner, 10 Nov)
      clear(alertLine);
      const I = interests();
      const key = (c, t) => JSON.stringify([c.slice().sort(), t.slice().sort()]);
      const same = I && key(I.codes, I.types) === key(side.codes, side.types);
      alertLine.appendChild(h('p', { class: 'side__alerthead' }, [bellIcon(), 'Bid opening alerts']));
      if (!I || !same) {
        alertLine.appendChild(h('p', { class: 'small muted', text: sideOn()
          ? 'The bell will count new tenders like this filter:'
          : 'Tick a tender type or a code below, then press the button: the bell counts new tenders that match.' }));
        const btn = h('button', { type: 'button', class: 'btn btn--ghost btn--small side__alertbtn', text: 'Alert me about new tenders like this',
          on: { click: () => setInterests(side.codes, side.types) } });
        if (!sideOn()) btn.disabled = true;
        alertLine.appendChild(btn);
      }
      if (I) {
        alertLine.appendChild(h('p', { class: 'small muted' }, [same ? 'On for this filter. ' : 'On for: ' + interestText(I) + '. ',
          h('button', { type: 'button', class: 'linkish small', text: 'stop', on: { click: () => keep(ALERT_KEY, null) } })]));
      }
    }
    document.addEventListener('tp:bell', paintAlert);
    const aside = h('aside', { class: 'side', 'aria-label': 'Filter by tender type and code' }, [
      h('div', { class: 'side__head' }, [h('h2', { class: 'side__title', text: 'Filter' }), clearBtn]), sum, alertLine,
      h('h3', { class: 'side__h', text: 'Tender type' }), types,
      h('h3', { class: 'side__h', text: 'Codes and sub-codes' }), find, tree,
    ]);
    const note = h('p', { class: 'side-note', hidden: '' });   // narrow screens: the panel is hidden, say so
    const col = h('div', { class: 'side-main' });             // the page's own content, right of the panel
    while (main.firstChild) col.appendChild(main.firstChild);
    main.appendChild(aside);
    main.appendChild(col);
    col.insertBefore(note, APP);
    main.classList.add('with-side');
    document.body.classList.add('has-side');
    function paint() {
      sum.textContent = sideSummary();
      clearBtn.hidden = !sideOn();
      paintAlert();
      clear(note);
      note.hidden = !sideOn();
      if (sideOn()) {
        add(note, ['Filtered (left panel, wide screens): ' + sideSummary() + ' ', h('button', { type: 'button', class: 'linkish', text: 'clear', on: { click: () => { side.codes = []; side.types = []; sideSave(); } } })]);
      }
      [].forEach.call(types.querySelectorAll('input'), (b, i) => { b.checked = side.types.indexOf(S.procedures[i].k) >= 0; });
      [].forEach.call(tree.querySelectorAll('input[data-p]'), (b) => { b.checked = side.codes.indexOf(b.getAttribute('data-p')) >= 0; });
    }
    find.addEventListener('input', debounce(drawTree, 150));
    document.addEventListener('tp:side', () => { paint(); onChange(); });
    window.addEventListener('storage', (e) => { if (e.key === SIDE_KEY) { sideLoad(); paint(); onChange(); } });   // another tab
    drawTree();
    paint();
  }

  /** The dashboard view (as build_demo.py view_json makes it) counted from tender list rows, for the left
      filter: KPIs, months, categories, codes, statuses, procedures, top buyers and companies, open tenders.
      The market comparison, most-demanded items and requirement tags need data the list does not carry,
      so a filtered dashboard leaves them out. */
  function viewFromRows(rows, S, B, C) {
    const months = S.views.all.months.map((m) => m[0]);
    const pm = {};
    months.forEach((m) => { pm[m] = [0, 0]; });
    const inc = (o, k, n) => { o[k] = (o[k] || 0) + n; };
    const buyers = new Set();
    const comps = new Set();
    const cats = {}, catv = {}, cpv = {}, cpvv = {}, st = {}, stv = {}, pr = {}, prv = {}, bn = {}, bv = {}, wonV = {}, wonN = {}, ent = {};
    const awarded = new Set(S.awarded || []);
    const names = {};
    (S.codes || []).forEach((x) => { names[x[0].padEnd(8, '0')] = x[1]; });
    let value = 0, otherCur = 0, nsum = 0, nn = 0, wsum = 0, wany = false, wonTenders = 0, decided = 0, covered = 0, outside = 0;
    rows.forEach((r) => {
      const v = isNum(r.v) ? r.v : 0;
      value += v;
      if (!isNum(r.v) && isNum(r.vo)) otherCur += 1;
      if (r.b) { buyers.add(r.b); inc(bn, r.b, 1); inc(bv, r.b, v); }
      (r.bi || []).forEach((b) => { comps.add(b[0]); inc(ent, b[0], 1); });
      const won = r.w && r.w.length;
      (r.w || []).forEach((w) => {
        comps.add(w[0]);
        inc(wonN, w[0], 1);
        if (isNum(w[1])) { inc(wonV, w[0], w[1]); wsum += w[1]; wany = true; }
      });
      if (won) { wonTenders += 1; covered += 1; }
      if (won || awarded.has(r.s)) decided += 1;
      if (isNum(r.n)) { nsum += r.n; nn += 1; }
      const m = r.a ? r.a.slice(0, 7) : null;
      if (m && pm[m]) { pm[m][0] += 1; pm[m][1] += v; } else outside += 1;
      inc(cats, r.c, 1); inc(catv, r.c, v);
      inc(cpv, r.mc || '?', 1); inc(cpvv, r.mc || '?', v);
      inc(st, r.s, 1); inc(stv, r.s, v);
      inc(pr, r.p, 1); inc(prv, r.p, v);
    });
    const r2 = (x) => Math.round(x * 100) / 100;
    const enough = decided > 0 && covered / decided >= (S.winner_coverage || 0.5);
    const cn = (k) => (C[k] ? C[k].name : k);
    let companies = { by: null, rows: [] };
    if (wany && enough) {
      companies = { by: 'value', rows: Object.keys(wonV).sort((a, b) => wonV[b] - wonV[a] || wonN[b] - wonN[a]).slice(0, 10).map((k) => [k, cn(k), wonN[k], r2(wonV[k])]) };
    } else if (Object.keys(wonN).length && enough) {
      companies = { by: 'wins', rows: Object.keys(wonN).sort((a, b) => wonN[b] - wonN[a]).slice(0, 10).map((k) => [k, cn(k), wonN[k], null]) };
    } else if (Object.keys(ent).length) {
      companies = { by: 'entered', rows: Object.keys(ent).sort((a, b) => ent[b] - ent[a]).slice(0, 10).map((k) => [k, cn(k), ent[k], null]) };
    }
    const order = S.categories.map((c) => c.k);
    const stOrder = S.statuses.map((x) => x.k);
    const cpvKeys = Object.keys(cpv).sort((a, b) => cpv[b] - cpv[a] || cpvv[b] - cpvv[a]);
    return {
      kpi: {
        tenders: rows.length, value: r2(value), buyers: buyers.size, companies: comps.size,
        avg_bidders: nn ? Math.round(nsum / nn * 10) / 10 : null, avg_bidders_n: nn,
        won_value: wany ? r2(wsum) : null, won_n: wonTenders, contracts: wonTenders, other_cur: otherCur, other_cur_contracts: 0,
      },
      months: months.map((m) => [m, pm[m][0], r2(pm[m][1])]),
      months_outside: outside,
      cats: order.filter((k) => cats[k]).map((k) => [k, cats[k], r2(catv[k])]),
      cpv: cpvKeys.slice(0, 10).map((k) => [k, names[k] || '', cpv[k], r2(cpvv[k])]),
      cpv_more: Math.max(0, cpvKeys.length - 10),
      status: Object.keys(st).sort((a, b) => stOrder.indexOf(a) - stOrder.indexOf(b)).map((k) => [k, st[k], r2(stv[k])]),
      proc: Object.keys(pr).sort((a, b) => pr[b] - pr[a] || a.localeCompare(b)).map((k) => [k, pr[k], r2(prv[k])]),
      buyers: Object.keys(bv).sort((a, b) => bv[b] - bv[a] || bn[b] - bn[a]).slice(0, 10).map((k) => [k, B[k] ? B[k].name : k, bn[k], r2(bv[k])]),
      companies: companies,
      winners_known: [covered, decided],
      open: rows.filter((r) => r.d && isOpen(r.d)).sort((a, b) => (a.d < b.d ? -1 : 1)).slice(0, 60)
        .map((r) => [r.no, r.t, r.b, B[r.b] ? B[r.b].name : null, r.d, isNum(r.v) ? r.v : null]),
    };
  }

  /* ------------------------------------------------------------------ products (TEN-10, 9 Nov 2026) */

  // products.json rows: [no, seller key, seller, offer date, product as written, spec, maker, unit, quantity,
  // unit price as written, without VAT, with VAT, won, verified, product key]; tenders: no -> [procedure,
  // category, codes, buyer key, buyer name, announced]
  const VERIFIED = {
    last: 'The table adds up to the bidder\'s last offer',
    first: 'The table adds up to the bidder\'s first offer (it lowered the price later)',
    lots: 'All its files together add up to the bid',
  };
  function median(a) {
    if (!a.length) return null;
    const x = a.slice().sort((p, q) => p - q);
    const m = x.length >> 1;
    return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2;
  }
  /** A CSV file for Excel (UTF-8 with BOM, so Georgian opens correctly) */
  function csvDownload(name, head, rows) {
    const esc = (v) => {
      const t = v === null || v === undefined ? '' : String(v);
      return /[",;\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    const text = '﻿' + [head].concat(rows).map((r) => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  /** "Download for Excel" for a list: the columns as shown, each as its csv(row) or sort value (full,
      unformatted), else the cell's text; the rows filtered and sorted as on screen, all of them (not only
      the first 100). 10 Nov 2026. */
  function csvButton(name, getCols, getRows) {
    const text = (c, r) => {
      const d = h('div', null, c.cell(r));
      return d.textContent.replace(/\s+/g, ' ').trim();
    };
    return h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Download for Excel (CSV)', on: { click: () => {
      const cols = getCols().filter((c) => !c.noCsv);
      csvDownload(name + '-' + new Date().toISOString().slice(0, 10) + '.csv', cols.map((c) => c.label),
        getRows().map((r) => cols.map((c) => (c.csv ? c.csv(r) : c.sort ? c.sort(r) : text(c, r)))));
    } } });
  }

  function pageProducts() {
    return Promise.all([load('summary.json'), load('products.json')]).then((res) => {
      const S = res[0];
      const P = res[1];
      lookups(S);
      const T = P.tenders || {};
      const all = P.rows.map((r) => {
        const t = T[r[0]] || [];
        return {
          no: r[0], sk: r[1], sn: r[2], d: r[3], n: r[4], sp: r[5], mk: r[6], u: r[7], q: r[8], p: r[9], ex: r[10], inc: r[11],
          w: r[12], v: r[13], k: r[14], pt: t[0], c: t[1], codes: t[2] || [], bk: t[3], bn: t[4],
          hay: (r[4] + ' ' + (r[5] || '')).toLowerCase(), sh: (r[2] || '').toLowerCase(), bh: (t[4] || '').toLowerCase(),
        };
      });
      const procs = Array.from(new Set(all.map((x) => x.pt).filter(Boolean))).sort();
      const cats = Array.from(new Set(all.map((x) => x.c).filter(Boolean)));
      const views = h('div', { class: 'switch', role: 'group', 'aria-label': 'View' });
      const form = h('form', { class: 'filters__grid filters__grid--products', role: 'search', on: { submit: (e) => e.preventDefault() } }, [
        field('Product', h('input', { type: 'search', name: 'q', autocomplete: 'off', spellcheck: 'false' }), 'field--grow'),
        field('Seller', h('input', { type: 'search', name: 's', autocomplete: 'off', spellcheck: 'false' })),
        field('Buyer', h('input', { type: 'search', name: 'b', autocomplete: 'off', spellcheck: 'false' })),
        field('Category', select('c', [['', 'All categories']].concat(cats.map((k) => [k, catLabel(k)])))),
        field('Code starts with', h('input', { type: 'text', name: 'code', inputmode: 'numeric', autocomplete: 'off', size: 9 })),
        field('Tender type', select('pt', [['', 'All types']].concat(procs.map((k) => [k, k])))),
        field('Offered', select('dd', [['', 'Any time'], ['40', 'Last 40 days'], ['90', 'Last 3 months'], ['180', 'Last 6 months']])),
        field('Prices', select('vat', [['', 'Without VAT'], ['inc', 'With VAT']])),
        check('Won only', 'w'),
        check('Verified only', 'v'),
      ]);
      const chipBox = h('p', { class: 'small' });
      const summary = h('p', { class: 'summary', 'aria-live': 'polite' });
      const dl = h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Download for Excel (CSV)' });
      const box = h('div');
      const st = P.stats || {};
      // folded on phones (ten filters would push the results a screen down), open on wider screens
      const filters = h('details', { class: 'filters', open: window.matchMedia('(min-width: 640px)').matches ? '' : null },
        [h('summary', null, 'Filters'), form]);
      clear(APP);
      add(APP, [views, filters, para('Prices are as the bidders wrote them; "without VAT" and "with VAT" use the tender\'s VAT clause (18%). ' +
        'Verified: the bidder\'s table adds up to its bid on the bids tab — ' + int(st.verified) + ' of ' + int(st.tables) + ' tables so far. ' +
        'Product groups are simple for now (same name, size and unit).', 'small muted'), chipBox, h('p', { class: 'listbar__end' }, [summary, ' ', dl]), box]);
      let state = {};
      let limit = 100;
      const VIEW = [['products', 'Products'], ['offers', 'Offers']];
      VIEW.forEach((v) => views.appendChild(h('button', {
        type: 'button', class: 'switch__b', 'data-v': v[0], text: v[1],
        on: { click: () => { state.view = v[0] === 'products' ? undefined : v[0]; state.sort = undefined; state.dir = undefined; limit = 100; render(); } },
      })));
      const F = form.elements;
      function fromHash() {
        state = readHash();
        ['q', 's', 'b', 'code'].forEach((k) => { F[k].value = state[k] || ''; });
        ['c', 'pt', 'dd', 'vat'].forEach((k) => setControl(F[k], state[k] || ''));
        F.w.checked = state.w === '1';
        F.v.checked = state.v === '1';
      }
      const price = (x) => (state.vat === 'inc' ? x.inc : x.ex) !== null && (state.vat === 'inc' ? x.inc : x.ex) !== undefined
        ? (state.vat === 'inc' ? x.inc : x.ex) : x.p;
      function filtered() {
        const words = (state.q || '').toLowerCase().split(/\s+/).filter(Boolean);
        const sw = (state.s || '').toLowerCase().split(/\s+/).filter(Boolean);
        const bw = (state.b || '').toLowerCase().split(/\s+/).filter(Boolean);
        const code = (state.code || '').replace(/\D/g, '').replace(/0+$/, '');
        const since = state.dd ? new Date(Date.now() - Number(state.dd) * DAY_MS).toISOString().slice(0, 10) : '';
        return all.filter((x) => (!state.k || x.k === state.k) && (!sideOn() || sideMatch(x.codes, x.pt))
          && words.every((w) => x.hay.indexOf(w) >= 0) && sw.every((w) => x.sh.indexOf(w) >= 0) && bw.every((w) => x.bh.indexOf(w) >= 0)
          && (!state.c || x.c === state.c) && (!state.pt || x.pt === state.pt)
          && (!code || x.codes.some((c) => String(c).indexOf(code) === 0))
          && (!since || (x.d && x.d >= since)) && (state.w !== '1' || x.w) && (state.v !== '1' || x.v));
      }
      function groups(list) {
        const m = new Map();
        list.forEach((x) => {
          let g = m.get(x.k);
          if (!g) { g = { k: x.k, names: {}, u: x.u, n: 0, prices: [], won: [], sellers: new Set(), buyers: new Set(), last: '' }; m.set(x.k, g); }
          g.names[x.n] = (g.names[x.n] || 0) + 1;
          g.n += 1;
          const p = price(x);
          if (isNum(p)) { g.prices.push(p); if (x.w) g.won.push(p); }
          if (x.sn) g.sellers.add(x.sn);
          if (x.bn) g.buyers.add(x.bn);
          if (x.d && x.d > g.last) g.last = x.d;
        });
        return Array.from(m.values()).map((g) => {
          g.name = Object.keys(g.names).sort((a, b) => g.names[b] - g.names[a])[0];
          g.min = g.prices.length ? Math.min.apply(null, g.prices) : null;
          g.max = g.prices.length ? Math.max.apply(null, g.prices) : null;
          g.med = median(g.prices);
          g.wmin = g.won.length ? Math.min.apply(null, g.won) : null;
          g.wmax = g.won.length ? Math.max.apply(null, g.won) : null;
          return g;
        });
      }
      const gel = (n) => (isNum(n) ? '₾' + NF2.format(n) : DASH);
      const range = (a, b) => (isNum(a) ? (a === b ? gel(a) : gel(a) + ' – ' + gel(b)) : DASH);
      const COLS_P = [
        { key: 'name', label: 'Product', cls: 'wide', first: 'asc', sort: (g) => g.name, cell: (g) => h('button', {
          type: 'button', class: 'linkish', title: 'Show its offers', on: { click: () => { state.k = g.k; state.view = 'offers'; state.sort = undefined; limit = 100; render(); } },
        }, ka(g.name)) },
        { key: 'u', label: 'Unit', sort: (g) => g.u, cell: (g) => (g.u ? ka(g.u) : DASH) },
        { key: 'n', label: 'Offers', num: true, first: 'desc', sort: (g) => g.n, cell: (g) => int(g.n) },
        { key: 'min', label: 'Lowest', num: true, first: 'asc', sort: (g) => g.min, cell: (g) => gel(g.min) },
        { key: 'med', label: 'Typical (median)', num: true, first: 'asc', sort: (g) => g.med, cell: (g) => gel(g.med) },
        { key: 'max', label: 'Highest', num: true, first: 'desc', sort: (g) => g.max, cell: (g) => gel(g.max) },
        { key: 'won', label: 'Winning', num: true, first: 'asc', sort: (g) => g.wmin, cell: (g) => range(g.wmin, g.wmax) },
        { key: 'sel', label: 'Sellers', num: true, first: 'desc', sort: (g) => g.sellers.size, cell: (g) => int(g.sellers.size) },
        { key: 'buy', label: 'Buyers', num: true, first: 'desc', sort: (g) => g.buyers.size, cell: (g) => int(g.buyers.size) },
        { key: 'last', label: 'Last offer', first: 'desc', sort: (g) => g.last, cell: (g) => (g.last ? day(g.last) : DASH) },
      ];
      const COLS_O = [
        { key: 'd', label: 'Offered', first: 'desc', sort: (x) => x.d, cell: (x) => (x.d ? day(x.d) : DASH) },
        { key: 'n', label: 'Product as written', cls: 'wide', first: 'asc', sort: (x) => x.n,
          cell: (x) => [ka(x.n), x.sp ? h('span', { class: 'muted small block' }, ka(x.sp)) : null] },
        { key: 'q', label: 'Quantity', num: true, first: 'desc', sort: (x) => x.q, cell: (x) => (isNum(x.q) ? NFQ.format(x.q) + (x.u ? ' ' : '') : DASH) + (x.u || '') },
        { key: 'p', label: 'Unit price', num: true, first: 'asc', sort: (x) => price(x), cell: (x) => gel(price(x)) },
        { key: 's', label: 'Seller', first: 'asc', sort: (x) => x.sn, cell: (x) => (x.sk ? h('a', { href: companyUrl(x.sk) }, ka(x.sn)) : x.sn ? ka(x.sn) : DASH) },
        { key: 'w', label: 'Won', first: 'desc', sort: (x) => x.w, cell: (x) => (x.w ? h('span', { class: 'ok', text: '✓ won' }) : '') },
        { key: 'v', label: 'Verified', first: 'desc', sort: (x) => (x.v ? 1 : 0), cell: (x) => (x.v ? h('span', { class: 'ok', title: VERIFIED[x.v] || '', text: '✓' }) : h('span', { class: 'muted', title: 'The table does not add up to the bid', text: 'no' })) },
        { key: 'mk', label: 'Maker / country', sort: (x) => x.mk, cell: (x) => (x.mk ? ka(x.mk) : DASH) },
        { key: 'b', label: 'Buyer', first: 'asc', sort: (x) => x.bn, cell: (x) => (x.bk ? h('a', { href: buyerUrl(x.bk) }, ka(x.bn || x.bk)) : DASH) },
        { key: 't', label: 'Tender', first: 'desc', sort: (x) => x.no, cell: (x) => [h('a', { href: tenderUrl(x.no), text: x.no }), x.pt ? h('span', { class: 'muted small', text: ' ' + x.pt }) : null] },
      ];
      function render(o) {
        setHash(state);
        const offers = state.view === 'offers';
        [].forEach.call(views.children, (b) => b.setAttribute('aria-pressed', String((b.getAttribute('data-v') === 'offers') === offers)));
        const list = filtered();
        const G = groups(list);
        clear(chipBox);
        if (state.k) {
          const g = G[0];
          add(chipBox, ['Product: ', g ? ka(g.name) : state.k, ' ', h('button', { type: 'button', class: 'linkish', text: 'show all products',
            on: { click: () => { state.k = undefined; limit = 100; render(); } } })]);
        }
        const sellers = new Set(list.map((x) => x.sn).filter(Boolean));
        const ver = list.filter((x) => x.v).length;
        clear(summary);
        add(summary, [plural(list.length, 'offer', 'offers'), ' · ', plural(G.length, 'product', 'products'), ' · ',
          plural(sellers.size, 'seller', 'sellers'), ' · ', (list.length ? Math.round(100 * ver / list.length) : 0) + '% from verified tables']);
        const cols = offers ? COLS_O : COLS_P;
        const defSort = offers ? 'd' : 'n';
        const defDir = (cols.find((c) => c.key === (state.sort || defSort)) || {}).first || 'desc';
        const opts = o || {};
        dataTable(box, cols, offers ? list : G, { sort: state.sort || defSort, dir: state.dir || defDir, limit: limit, caption: offers ? 'Offers' : 'Products', focusSort: opts.focusSort, focusRow: opts.focusRow }, (ch) => {
          if (ch.sort) { state.sort = ch.sort; state.dir = ch.dir; }
          if (ch.limit) limit = ch.limit;
          render(ch);
        });
        if (!list.length) box.appendChild(para('Nothing matches these filters.', 'note'));
        dl.onclick = () => {
          const stamp = new Date().toISOString().slice(0, 10);
          if (offers) {
            csvDownload('offers-' + stamp + '.csv', ['Offered', 'Tender', 'Type', 'Category', 'Buyer', 'Seller', 'Product as written', 'Spec', 'Maker / country',
              'Unit', 'Quantity', 'Unit price as written', 'Without VAT', 'With VAT', 'Won', 'Verified'],
            list.map((x) => [x.d, x.no, x.pt, catLabel(x.c), x.bn, x.sn, x.n, x.sp, x.mk, x.u, x.q, x.p, x.ex, x.inc, x.w ? 'yes' : '', x.v ? 'yes (' + x.v + ')' : 'no']));
          } else {
            csvDownload('products-' + stamp + '.csv', ['Product', 'Unit', 'Offers', 'Lowest', 'Typical (median)', 'Highest', 'Winning lowest', 'Winning highest',
              'Sellers', 'Buyers', 'Last offer', 'Prices'],
            G.map((g) => [g.name, g.u, g.n, g.min, g.med, g.max, g.wmin, g.wmax, g.sellers.size, g.buyers.size, g.last, state.vat === 'inc' ? 'with VAT' : 'without VAT']));
          }
        };
      }
      const onInput = debounce(() => {
        ['q', 's', 'b', 'code'].forEach((k) => { state[k] = F[k].value.trim() || undefined; });
        limit = 100;
        render();
      }, 200);
      ['q', 's', 'b', 'code'].forEach((k) => F[k].addEventListener('input', onInput));
      ['c', 'pt', 'dd', 'vat'].forEach((k) => F[k].addEventListener('change', () => { state[k] = F[k].value || undefined; limit = 100; render(); }));
      ['w', 'v'].forEach((k) => F[k].addEventListener('change', () => { state[k] = F[k].checked ? '1' : undefined; limit = 100; render(); }));
      window.addEventListener('hashchange', () => { fromHash(); limit = 100; render(); });
      mountSide(S, () => { limit = 100; render(); });
      fromHash();
      render();
    }, (err) => {
      if (err && [400, 403, 404].indexOf(err.status) >= 0 && LOCAL) throw new Error('No products.json yet: run app\\run_bidprices.py, then build_demo.py --local.');
      throw err;
    });
  }

  /* ------------------------------------------------------------------ start */

  const PAGES = {
    dashboard: pageDashboard, tenders: pageTenders, tender: pageTender, companies: pageCompanies,
    company: pageCompany, buyers: pageBuyers, buyer: pageBuyer, mycompany: pageMyCompany, products: pageProducts,
  };
  function boot() {
    const run = PAGES[PAGE];
    if (!run || !APP) return;
    if (LOCAL) {                                // laptop preview: local files, no sign-in
      mountBell();
      load('summary.json').then(dates, () => {});
      Promise.resolve().then(run).catch(fail);
      return;
    }
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
      mountBell();
      load('summary.json').then(dates, () => {});   // a failed download is reported by the page itself
      return run();
    }).catch(fail);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
