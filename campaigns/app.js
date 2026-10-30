/* =========================================================================
   Ads Management - ads.js
   UI, routing (hash: #/dashboard, #/campaigns, #/posts ...) and the login gate.
   All data goes through window.AdsApi (api.js). All text goes through
   window.AdsI18n (i18n.js). Single IIFE, no modules, as script.js.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     0. Gate constants
     --------------------------------------------------------------------- */
  // Same project and PUBLISHABLE key as ../script.js (publishable by design).
  var SUPABASE_URL = 'https://muumpjtpjnoxxdkhqtik.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_R6Ruxp1ehYAGVcFRqrM_Lg_n1ahoV8e';
  // Empty = any signed-in user may open the tool while the data is MOCK.
  // This check runs in the browser, so it is cosmetic only. Real data later
  // needs a server-side check (RLS / edge function), not this list.
  var ALLOWED_EMAILS = [];

  var api = AdsApi;
  // t() always offers {cur} (currency of the current business) to the strings.
  function t(key, vars) {
    vars = vars || {};
    if (vars.cur === undefined) vars.cur = curLabel();
    return AdsI18n.t(key, vars);
  }
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var client = null, user = null, started = false;
  var settings = null;
  var ctx = { business: 'edelweiss', account: 'all' };
  var viewTok = 0, viewTimer = null, firstRender = true;
  var main, shell, scrim, toastBox, sidebar, assistant;
  var dashRange = 30, campFilter = 'all', campAccount = 'all', campQuery = '';
  var postsView = 'list', postsFilter = 'all', calMonth = null;
  var wizard = null, composerPrefill = null;
  var chat = [];

  /* ---------------------------------------------------------------------
     1. Tiny helpers
     --------------------------------------------------------------------- */
  function append(e, kids) {
    [].concat(kids == null ? [] : kids).forEach(function (k) {
      if (k == null || k === false) return;
      e.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    });
  }
  // h('div', {class:'x', onclick:fn}, [children])
  function h(tag, a, kids) {
    var e = document.createElement(tag);
    Object.keys(a || {}).forEach(function (k) {
      var v = a[k];
      if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    });
    append(e, kids);
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function locale() { return AdsI18n.lang() === 'ka' ? 'ka-GE' : 'en-GB'; }
  // Currency of the selected business: live = from ads_businesses (USD for Edelweiss), mock = GEL.
  function curCode() {
    var b = settings && settings.businesses.filter(function (x) { return x.id === ctx.business; })[0];
    return (b && b.currency) || (settings && settings.currency) || 'GEL';
  }
  function curLabel() {
    var c = curCode();
    return c === 'GEL' && AdsI18n.lang() === 'ka' ? 'ლარი' : c;
  }
  function currencyNote() { return curCode() === 'GEL' ? t('common.currencyNote') : t('common.currencyNoteOther'); }
  function money(n) {
    if (n == null) return '-';
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: curCode() }).format(n);
  }
  function num(n) { return new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(n); }
  function fmtDate(iso, long) {
    var d = iso.length === 10 ? new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) : new Date(iso);
    return d.toLocaleDateString(locale(), long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' });
  }
  function fmtDateTime(iso) {
    return new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function dayKey(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function lname(o, base) { return o[base + '_' + AdsI18n.lang()] || o[base + '_en']; }
  function bizName(id) { var b = settings.businesses.filter(function (x) { return x.id === id; })[0]; return b ? b.name : id; }
  function accounts(biz) { var b = settings.businesses.filter(function (x) { return x.id === biz; })[0]; return b ? b.accounts : []; }
  function accountName(id) {
    var n = id;
    settings.businesses.forEach(function (b) { b.accounts.forEach(function (a) { if (a.id === id) n = a.name; }); });
    return n;
  }
  function locName(id) { var l = settings.locations.filter(function (x) { return x.id === id; })[0]; return l ? l[AdsI18n.lang()] : id; }
  function stale(tok) { return tok !== viewTok; }

  /* Placeholder images: inline SVG, generated here (no image files). */
  function imageUri(img) {
    var shapes = {
      mountain: '<path d="M0 300L120 130L200 220L280 100L400 300Z" fill="' + img.c2 + '" opacity=".85"/>',
      circle: '<circle cx="200" cy="140" r="80" fill="' + img.c2 + '" opacity=".85"/>',
      wave: '<path d="M0 190Q50 150 100 190T200 190T300 190T400 190V300H0Z" fill="' + img.c2 + '" opacity=".85"/>'
    };
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="' + img.c1 + '"/>' +
      (shapes[img.shape] || '') + '<rect x="0" y="264" width="400" height="36" fill="#14213d" opacity=".75"/>' +
      '<text x="12" y="288" font-size="15" fill="#ffffff" font-family="sans-serif">MOCK IMAGE</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  var imageCache = {};
  function imageById(id) { return imageCache[id] || null; }
  function imageEl(id, cls) {
    var im = imageById(id);
    if (!im) return h('div', { class: (cls || '') + ' ads-img-empty' }, t('common.noImage'));
    return h('img', { class: cls || 'ads-img', src: imageUri(im), alt: lname(im, 'title'), width: '400', height: '300', loading: 'lazy' });
  }

  /* ---------------------------------------------------------------------
     2. Toasts, dialogs, drawers
     --------------------------------------------------------------------- */
  function toast(msg, kind) {
    var el = h('div', { class: 'ads-toast ads-toast--' + (kind || 'ok') }, msg);
    toastBox.appendChild(el);
    setTimeout(function () { el.remove(); }, 6000);
  }

  // Native <dialog> + showModal(): browser traps focus and inerts the page.
  // We store and restore focus ourselves. Resolves with the clicked action's
  // value, or null on Cancel / Esc / backdrop click.
  function openDialog(o) {
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var titleId = 'ads-dlg-' + Math.floor(Math.random() * 1e6);
      var btns = {};
      var foot = h('div', { class: 'ads-dialog__foot' });
      if (!o.noCancel) {
        foot.appendChild(h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { close(null); } }, t(o.cancelLabel || 'common.cancel')));
      }
      (o.actions || []).forEach(function (a) {
        var b = h('button', { type: 'button', class: 'ads-btn ' + (a.kind === 'danger' ? 'ads-btn--danger' : 'ads-btn--primary'), disabled: !!a.disabled, onclick: function () { close(a.value); } }, a.label);
        btns[a.value] = b;
        foot.appendChild(b);
      });
      var dlg = h('dialog', { class: 'ads-dialog' + (o.wide ? ' ads-dialog--wide' : ''), 'aria-labelledby': titleId }, [
        h('div', { class: 'ads-dialog__head' }, [
          h('h2', { class: 'ads-h2', id: titleId }, o.title),
          h('button', { type: 'button', class: 'ads-iconbtn', 'aria-label': t('common.close'), onclick: function () { close(null); } }, '✕')
        ]),
        h('div', { class: 'ads-dialog__body' }, o.body),
        foot
      ]);
      function close(v) {
        dlg.close(); dlg.remove();
        if (prev && prev.focus && document.contains(prev)) prev.focus();
        resolve(v);
      }
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(null); });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) close(null); });
      document.body.appendChild(dlg);
      dlg.showModal();
      if (o.onOpen) o.onOpen(dlg, btns);
    });
  }
  // ---- live backend: plain-word dialogs for server answers ----
  function liveMode() { return api.isLive(); }
  function srvErrorBody(err) {
    err = err || {};
    var code = err.code || 'server', kids = [];
    if (code === 'network') return h('p', {}, t('srv.network'));
    if (code === 'not_member' || code === 'no_token' || code === 'bad_token') return h('p', {}, t('srv.access'));
    var known = ['over_daily_cap', 'over_total_cap', 'over_days_cap', 'meta_error', 'in_progress'].indexOf(code) !== -1;
    kids.push(h('p', {}, h('strong', {}, known ? t('srv.' + code) : t('srv.default'))));
    // The server sends its own plain-English sentence (amounts, Meta wording). Shown as is; not translated.
    if (err.message) kids.push(h('p', {}, err.message));
    if (err.step) kids.push(h('p', { class: 'ads-note' }, t('res.step') + ': ' + err.step));
    if (code === 'meta_error') kids.push(h('p', { class: 'ads-note' }, t('srv.hint')));
    return h('div', {}, kids);
  }
  function showSrvError(err) {
    return openDialog({ title: t('srv.title'), body: srvErrorBody(err), noCancel: true, actions: [{ label: t('common.close'), value: true }] });
  }
  function showCreateResult(res) {
    var dry = res.dry_run !== false, kids = [];
    kids.push(h('p', { class: dry ? 'ads-warn' : 'ads-note' }, dry ? t('res.dry.text') : t('res.live.text')));
    var rows = [];
    if (res.ad_account_id) rows.push([t('res.account'), res.ad_account_id]);
    if (res.api_version) rows.push([t('res.api'), res.api_version]);
    if (res.total_minor != null && res.currency) {
      rows.push([t('res.total'), new Intl.NumberFormat(locale(), { style: 'currency', currency: res.currency }).format(res.total_minor / 100)]);
    }
    if (!dry && res.meta_ids) {
      rows.push([t('res.ids'), ['campaign', 'adset', 'creative', 'ad'].map(function (k) { return k + ': ' + (res.meta_ids[k] || '-'); }).join(' | ')]);
    }
    if (rows.length) kids.push(kv(rows));
    if (dry && res.payloads) {
      kids.push(h('h3', { class: 'ads-h3' }, t('res.payloads')));
      ['campaign', 'adset', 'creative', 'ad'].forEach(function (k) {
        if (!res.payloads[k]) return;
        kids.push(h('details', { open: true }, [h('summary', {}, t('res.p.' + k)), h('pre', { class: 'ads-code' }, JSON.stringify(res.payloads[k], null, 2))]));
      });
    }
    return openDialog({ title: dry ? t('res.dry.title') : t('res.live.title'), body: h('div', {}, kids), wide: true, noCancel: true, actions: [{ label: t('common.close'), value: true }] });
  }
  function testMetaConnection(btn) {
    btn.disabled = true;
    var biz = ctx.business;
    api.metaHealth(biz).then(function (r) {
      btn.disabled = false;
      var kids = [];
      if (r && r.error) return showSrvError(r.error);
      if (r.ad_account) {
        var a = r.ad_account;
        kids.push(kv([[t('health.account'), a.name + ' (' + a.id + ')'], [t('health.status'), a.status], [t('health.currency'), a.currency],
          [t('health.page'), r.page ? r.page.name + ' (' + r.page.id + ')' : t('health.none')],
          [t('health.mode'), r.live_mode ? t('health.liveOn') : t('health.dry')]]));
      }
      if (r.ok) kids.unshift(h('p', {}, h('strong', {}, t('health.okText'))));
      if (r.problems && r.problems.length) {
        kids.push(h('p', { class: 'ads-warn' }, [h('strong', {}, t('health.problems') + ': '), h('ul', {}, r.problems.map(function (x) { return h('li', {}, x); }))]));
      }
      return openDialog({ title: t('health.title') + ' - ' + bizName(biz), body: h('div', {}, kids), noCancel: true, actions: [{ label: t('common.close'), value: true }] });
    }).catch(function () { btn.disabled = false; showSrvError({ code: 'network' }); });
  }

  function confirmDialog(o) {
    return openDialog({
      title: o.title, body: h('p', {}, o.message),
      actions: [{ label: o.confirmLabel, value: true, kind: o.danger ? 'danger' : 'primary' }]
    });
  }

  // Drawers (sidebar on phones, AI assistant): focus trap, Esc, focus restore.
  var activeDrawer = null;
  function focusables(c) {
    return [].slice.call(c.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      .filter(function (e) { return e.offsetParent !== null; });
  }
  function drawerKey(e) {
    if (!activeDrawer) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables(activeDrawer.el);
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!activeDrawer.el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function openDrawer(el, opener, focusEl) {
    if (activeDrawer) closeDrawer(true);
    activeDrawer = { el: el, opener: opener };
    el.classList.add('is-open');
    scrim.hidden = false;
    document.body.classList.add('ads-locked');
    if (el === assistant) shell.inert = true;
    if (opener) opener.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', drawerKey);
    (focusEl || focusables(el)[0] || el).focus();
  }
  function closeDrawer(noRestore) {
    if (!activeDrawer) return;
    var d = activeDrawer; activeDrawer = null;
    d.el.classList.remove('is-open');
    scrim.hidden = true;
    document.body.classList.remove('ads-locked');
    shell.inert = false;
    document.removeEventListener('keydown', drawerKey);
    if (d.opener) { d.opener.setAttribute('aria-expanded', 'false'); if (!noRestore) d.opener.focus(); }
  }

  /* ---------------------------------------------------------------------
     3. Shared UI pieces
     --------------------------------------------------------------------- */
  function chip(status) {
    return h('span', { class: 'ads-chip ads-chip--' + status }, [h('span', { class: 'ads-chip__dot', 'aria-hidden': 'true' }), t('status.' + status)]);
  }
  function skeleton(rows) {
    var w = h('div', { class: 'ads-skel', 'aria-hidden': 'true' });
    for (var i = 0; i < (rows || 3); i++) w.appendChild(h('div', { class: 'ads-skel__bar' }));
    return w;
  }
  function emptyState(titleKey, textKey, action) {
    return h('div', { class: 'ads-empty' }, [h('h2', { class: 'ads-h2' }, t(titleKey)), h('p', {}, t(textKey)), action || null]);
  }
  function errorState(retry) {
    return h('div', { class: 'ads-empty', role: 'alert' }, [
      h('h2', { class: 'ads-h2' }, t('common.errorTitle')), h('p', {}, t('common.errorText')),
      h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: retry }, t('common.retry'))
    ]);
  }
  function pageHead(titleKey, tools) {
    return h('div', { class: 'ads-pagehead' }, [h('h1', { class: 'ads-h1', tabindex: '-1' }, t(titleKey)), h('div', { class: 'ads-pagehead__tools' }, tools)]);
  }
  function chips(keys, current, labelFn, onPick, aria) {
    return h('div', { class: 'ads-chips', role: 'group', 'aria-label': aria }, keys.map(function (k) {
      return h('button', { type: 'button', class: 'ads-filter', 'aria-pressed': String(k === current), onclick: function () { onPick(k); } }, labelFn(k));
    }));
  }
  function field(labelKey, control, hint, id) {
    return h('div', { class: 'ads-field' }, [
      h('label', { for: id, class: 'ads-label' }, t(labelKey)), control,
      hint ? h('p', { class: 'ads-hint', id: id + '-hint' }, hint) : null
    ]);
  }
  function select(id, opts, value, onchange) {
    var s = h('select', { id: id, class: 'ads-input', onchange: function () { onchange(s.value); } },
      opts.map(function (o) { return h('option', { value: o[0] }, o[1]); }));
    s.value = value;
    return s;
  }
  function kv(rows) {
    var dl = h('dl', { class: 'ads-kv' });
    rows.forEach(function (r) { dl.appendChild(h('dt', {}, r[0])); dl.appendChild(h('dd', {}, r[1])); });
    return dl;
  }

  // Highlights risky words and says why. Returns a node; call update(text).
  function riskBox() {
    var box = h('div', { class: 'ads-risk', 'aria-live': 'polite' });
    box.update = function (text) {
      var risks = api.findRisks(text), html = '', pos = 0, used = [];
      risks.forEach(function (r) {
        if (r.start < pos) return;
        html += esc(text.slice(pos, r.start)) + '<mark class="ads-mark">' + esc(text.slice(r.start, r.end)) + '</mark>';
        pos = r.end; used.push(r);
      });
      html += esc(text.slice(pos));
      box.innerHTML = '';
      box.dataset.count = String(used.length);
      if (!used.length) { box.appendChild(h('p', { class: 'ads-risk__ok' }, t('policy.ok'))); return; }
      box.appendChild(h('p', { class: 'ads-risk__title' }, t('policy.found', { n: used.length })));
      var txt = h('p', { class: 'ads-risk__text' }); txt.innerHTML = html;
      box.appendChild(txt);
      var ul = h('ul', { class: 'ads-risk__list' });
      used.forEach(function (r) { ul.appendChild(h('li', {}, [h('mark', { class: 'ads-mark' }, r.word), ' - ', r[AdsI18n.lang()] || r.en])); });
      box.appendChild(ul);
    };
    box.update('');
    return box;
  }

  /* Line chart: spend (solid) and messages (dashed), two axes, inline SVG. */
  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  function lineChart(series) {
    var W = 640, H = 240, L = 52, R = 48, T = 14, B = 30, iw = W - L - R, ih = H - T - B;
    var maxS = niceMax(Math.max.apply(null, series.map(function (s) { return s.spend; })));
    var maxM = niceMax(Math.max.apply(null, series.map(function (s) { return s.messages; })));
    function x(i) { return L + (series.length > 1 ? i * iw / (series.length - 1) : iw / 2); }
    function y(v, m) { return T + ih - v / m * ih; }
    var g = '';
    for (var i = 0; i <= 4; i++) {
      var gy = T + ih - i * ih / 4;
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" stroke="#ddd8cf"/>' +
        '<text x="' + (L - 6) + '" y="' + (gy + 4) + '" text-anchor="end" class="ads-chart__tick">' + Math.round(maxS * i / 4 * 10) / 10 + '</text>' +
        '<text x="' + (W - R + 6) + '" y="' + (gy + 4) + '" class="ads-chart__tick">' + Math.round(maxM * i / 4 * 10) / 10 + '</text>';
    }
    var pS = series.map(function (s, k) { return x(k).toFixed(1) + ',' + y(s.spend, maxS).toFixed(1); }).join(' ');
    var pM = series.map(function (s, k) { return x(k).toFixed(1) + ',' + y(s.messages, maxM).toFixed(1); }).join(' ');
    var xl = [0, Math.floor((series.length - 1) / 2), series.length - 1].map(function (k, n) {
      return '<text x="' + x(k) + '" y="' + (H - 8) + '" text-anchor="' + (n === 0 ? 'start' : n === 2 ? 'end' : 'middle') + '" class="ads-chart__tick">' + esc(fmtDate(series[k].date)) + '</text>';
    }).join('');
    var dots = series.length <= 31 ? series.map(function (s, k) {
      return '<circle cx="' + x(k).toFixed(1) + '" cy="' + y(s.spend, maxS).toFixed(1) + '" r="2.5" fill="#b8420a"><title>' + esc(fmtDate(s.date) + ': ' + money(s.spend) + ', ' + s.messages) + '</title></circle>';
    }).join('') : '';
    var wrap = h('div', { class: 'ads-chart', tabindex: '0', role: 'region', 'aria-label': t('dash.chartAria') });
    wrap.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('dash.chartAria')) + '">' + g + xl +
      '<polyline points="' + pM + '" fill="none" stroke="#0e4f6b" stroke-width="2.5" stroke-dasharray="6 4"/>' +
      '<polyline points="' + pS + '" fill="none" stroke="#b8420a" stroke-width="2.5"/>' + dots + '</svg>';
    var legend = h('p', { class: 'ads-chart__legend' }, [
      h('span', { class: 'ads-key ads-key--spend' }, t('dash.spendAxis')), h('span', { class: 'ads-key ads-key--msg' }, t('dash.msgAxis'))
    ]);
    var table = h('table', { class: 'ads-table' }, [
      h('thead', {}, h('tr', {}, [h('th', { scope: 'col' }, t('common.date')), h('th', { scope: 'col' }, t('col.spend')), h('th', { scope: 'col' }, t('col.messages'))])),
      h('tbody', {}, series.map(function (s) { return h('tr', {}, [h('td', {}, fmtDate(s.date)), h('td', {}, money(s.spend)), h('td', {}, num(s.messages))]); }))
    ]);
    return h('div', {}, [legend, wrap, h('details', { class: 'ads-details' }, [h('summary', {}, t('dash.viewTable')), h('div', { class: 'ads-tablewrap', tabindex: '0', role: 'region', 'aria-label': t('dash.viewTable') }, table)])]);
  }

  /* ---------------------------------------------------------------------
     4. Router and shell
     --------------------------------------------------------------------- */
  var NAV = [
    ['dashboard', 'nav.dashboard', false], ['campaigns', 'nav.campaigns', false], ['posts', 'nav.posts', false],
    ['images', 'nav.images', true], ['products', 'nav.products', true], ['rotation', 'nav.rotation', true],
    ['settings', 'nav.settings', true], ['audit', 'nav.audit', true]
  ];
  function buildNav() {
    var ul = $('#ads-nav-list');
    ul.innerHTML = '';
    NAV.forEach(function (n) {
      ul.appendChild(h('li', {}, h('a', { href: '#/' + n[0], class: 'ads-nav__link', 'data-route': n[0] }, [t(n[1]), n[2] ? h('span', { class: 'ads-nav__soon' }, t('common.soon')) : null])));
    });
  }
  function render(node, titleKey) {
    main.innerHTML = '';
    main.appendChild(node);
    document.title = t(titleKey) + ' - ' + t('app.name');
    if (firstRender === 'focus') { var hd = $('.ads-h1', main); if (hd) hd.focus({ preventScroll: true }); }
    firstRender = false;
  }
  function route() {
    viewTok++; clearTimeout(viewTimer);
    closeDrawer(true);
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var name = parts[0] || 'dashboard';
    [].forEach.call(document.querySelectorAll('.ads-nav__link'), function (a) {
      if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var tok = viewTok;
    main.scrollTop = 0; window.scrollTo(0, 0);
    if (name === 'campaigns' && parts[1] === 'new') return viewWizard(tok);
    if (name === 'campaigns') return viewCampaigns(tok);
    if (name === 'posts' && parts[1]) return viewComposer(tok, parts[1]);
    if (name === 'posts') return viewPosts(tok);
    var soon = NAV.filter(function (n) { return n[0] === name && n[2]; })[0];
    if (soon) {
      return render(h('div', {}, [pageHead(soon[1]), emptyState('soon.title', 'soon.text', h('a', { class: 'ads-btn ads-btn--primary', href: '#/dashboard' }, t('nav.dashboard')))]), soon[1]);
    }
    viewDashboard(tok);
  }
  function go(hash) { firstRender = 'focus'; if (location.hash === hash) route(); else location.hash = hash; }
  function refresh() { route(); } // re-render current view (language / business change)

  /* ---------------------------------------------------------------------
     5. Dashboard
     --------------------------------------------------------------------- */
  function viewDashboard(tok) {
    var body = h('div', {}, skeleton(5));
    var tools = [
      h('div', { class: 'ads-chips', role: 'group', 'aria-label': t('dash.range') }, [7, 30, 90].map(function (d) {
        return h('button', { type: 'button', class: 'ads-filter', 'aria-pressed': String(d === dashRange), onclick: function () { dashRange = d; refresh(); } }, t('dash.days', { n: d }));
      })),
      h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { toast(t('dash.refreshed')); refresh(); } }, t('common.refresh'))
    ];
    if (liveMode()) tools.push(h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function (e) { testMetaConnection(e.currentTarget); } }, t('health.btn')));
    render(h('div', {}, [pageHead('nav.dashboard', tools), h('p', { class: 'ads-note' }, currencyNote()), liveMode() ? h('p', { class: 'ads-warn' }, t('mode.liveNote')) : null, body]), 'nav.dashboard');
    api.getDashboard({ range: dashRange, business: ctx.business, account: ctx.account }).then(function (d) {
      if (stale(tok)) return;
      body.innerHTML = '';
      var k = d.kpis;
      var cards = [['col.spend', money(k.spend)], ['dash.reach', num(k.reach)], ['col.messages', num(k.messages)], ['col.cpm', money(k.costPerMessage)], ['dash.active', num(k.activeCampaigns)]];
      body.appendChild(h('ul', { class: 'ads-kpis' }, cards.map(function (c) {
        return h('li', { class: 'ads-kpi' }, [h('span', { class: 'ads-kpi__label' }, t(c[0])), h('span', { class: 'ads-kpi__value' }, c[1])]);
      })));
      body.appendChild(h('p', { class: 'ads-note' }, t('dash.updated', { time: new Date(d.updatedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }), n: dashRange })));
      body.appendChild(h('section', { class: 'ads-card', 'aria-labelledby': 'ads-d-chart' }, [h('h2', { class: 'ads-h2', id: 'ads-d-chart' }, t('dash.chartTitle')), lineChart(d.series)]));
      var tbody = h('tbody', {}, d.campaigns.map(function (c) {
        var cpm = c.messages ? c.spend / c.messages : null;
        return h('tr', {}, [
          h('td', { 'data-label': t('col.name') }, h('a', { href: '#/campaigns', class: 'ads-link' }, c.name)),
          h('td', { 'data-label': t('col.status') }, chip(c.status)),
          h('td', { 'data-label': t('col.spend') }, money(c.spend)), h('td', { 'data-label': t('col.messages') }, num(c.messages)), h('td', { 'data-label': t('col.cpm') }, money(cpm))
        ]);
      }));
      var tbl = h('table', { class: 'ads-table ads-table--stack' }, [
        h('thead', {}, h('tr', {}, ['col.name', 'col.status', 'col.spend', 'col.messages', 'col.cpm'].map(function (c) { return h('th', { scope: 'col' }, t(c)); }))), tbody]);
      body.appendChild(h('section', { class: 'ads-card', 'aria-labelledby': 'ads-d-camps' }, [
        h('h2', { class: 'ads-h2', id: 'ads-d-camps' }, t('dash.campaigns')),
        d.campaigns.length ? h('div', { class: 'ads-tablewrap', tabindex: '0', role: 'region', 'aria-label': t('dash.campaigns') }, tbl) : h('p', {}, t('dash.noCampaigns'))
      ]));
      body.appendChild(h('section', { class: 'ads-card', 'aria-labelledby': 'ads-d-alerts' }, [
        h('h2', { class: 'ads-h2', id: 'ads-d-alerts' }, t('dash.alerts')),
        d.alerts.length ? h('ul', { class: 'ads-alerts' }, d.alerts.map(function (a) {
          return h('li', { class: 'ads-alert ads-alert--' + a.level }, [h('strong', {}, t('alert.' + a.level) + ': '), a[AdsI18n.lang()] || a.en]);
        })) : h('p', {}, t('dash.noAlerts'))
      ]));
    }).catch(function () { if (!stale(tok)) { body.innerHTML = ''; body.appendChild(errorState(refresh)); } });
  }

  /* ---------------------------------------------------------------------
     6. Campaigns: list, row actions, switch-on, results
     --------------------------------------------------------------------- */
  var CAMP_STATUSES = ['draft', 'paused', 'in_review', 'active', 'rejected', 'ended'];

  function viewCampaigns(tok) {
    var body = h('div', {}, skeleton(4));
    var search = h('input', { type: 'search', id: 'ads-c-q', class: 'ads-input', value: campQuery, placeholder: t('camp.search'), 'aria-label': t('camp.search') });
    var acct = select('ads-c-acct', [['all', t('common.allAccounts')]].concat(accounts(ctx.business).map(function (a) { return [a.id, a.name]; })), campAccount, function (v) { campAccount = v; load(); });
    acct.setAttribute('aria-label', t('top.account'));
    var chipsBox = h('div', {});
    function drawChips() {
      chipsBox.innerHTML = '';
      chipsBox.appendChild(chips(['all'].concat(CAMP_STATUSES), campFilter, function (k) { return k === 'all' ? t('common.all') : t('status.' + k); }, function (k) { campFilter = k; drawChips(); load(); }, t('camp.statusFilter')));
    }
    drawChips();
    search.addEventListener('input', function () { campQuery = search.value; load(); });
    render(h('div', {}, [
      pageHead('nav.campaigns', [h('a', { class: 'ads-btn ads-btn--primary', href: '#/campaigns/new', onclick: function () { wizard = null; } }, t('camp.new'))]),
      h('p', { class: 'ads-note' }, currencyNote()),
      h('div', { class: 'ads-filters' }, [chipsBox, h('div', { class: 'ads-filters__row' }, [acct, search])]), body]), 'nav.campaigns');

    function load() {
      api.listCampaigns({ business: ctx.business, account: campAccount, status: campFilter, q: campQuery }).then(function (rows) {
        if (stale(tok)) return;
        body.innerHTML = '';
        if (!rows.length) { body.appendChild(emptyState('camp.emptyTitle', 'camp.emptyText')); return; }
        var tbl = h('table', { class: 'ads-table ads-table--stack' }, [
          h('thead', {}, h('tr', {}, ['col.name', 'col.status', 'col.budget', 'col.spend', 'col.messages', 'col.cpm', 'col.actions'].map(function (c) { return h('th', { scope: 'col' }, t(c)); }))),
          h('tbody', {}, rows.map(row))]);
        body.appendChild(h('div', { class: 'ads-tablewrap', tabindex: '0', role: 'region', 'aria-label': t('nav.campaigns') }, tbl));
        // The mock "Meta review" finishes after 15 s: poll while any row is in review.
        clearTimeout(viewTimer);
        if (rows.some(function (r) { return r.status === 'in_review'; })) viewTimer = setTimeout(function () { if (!stale(tok)) load(); }, 4000);
      }).catch(function () { if (!stale(tok)) { body.innerHTML = ''; body.appendChild(errorState(load)); } });
    }
    function act(label, fn, kind) { return h('button', { type: 'button', class: 'ads-btn ads-btn--small ' + (kind || 'ads-btn--ghost'), onclick: fn }, label); }
    function row(c) {
      var cpm = c.messages ? c.spend / c.messages : null, a = [];
      if (c.status === 'active') a.push(act(t('act.pause'), function () { move(c, 'paused'); }));
      if (c.status === 'draft') a.push(act(t('act.toPaused'), function () { move(c, 'paused'); }));
      if (c.status === 'rejected') a.push(act(t('act.toPaused'), function () { move(c, 'paused'); }));
      if (c.status === 'paused') a.push(act(t('act.switchOn'), function () { switchOn(c); }, 'ads-btn--primary'));
      if (c.status === 'paused' || c.status === 'active') a.push(act(t('act.end'), function () { endIt(c); }));
      a.push(act(t('act.duplicate'), function () { api.duplicateCampaign(c.id).then(function () { toast(t('toast.duplicated')); load(); }).catch(fail); }));
      a.push(act(t('act.results'), function () { showResults(c); }));
      return h('tr', {}, [
        h('td', { 'data-label': t('col.name') }, [h('strong', {}, c.name), h('span', { class: 'ads-sub' }, accountName(c.accountId) + ' - ' + t('goal.' + c.goal)),
          c.status === 'rejected' && c.rejectReason ? h('span', { class: 'ads-sub ads-sub--act' }, c.rejectReason) : null]),
        h('td', { 'data-label': t('col.status') }, chip(c.status)),
        h('td', { 'data-label': t('col.budget') }, [money(c.dailyBudget) + t('common.perDay'), h('span', { class: 'ads-sub' }, t('camp.totalShort', { total: money(api.total(c)), days: c.days }))]),
        h('td', { 'data-label': t('col.spend') }, money(c.spend)), h('td', { 'data-label': t('col.messages') }, num(c.messages)), h('td', { 'data-label': t('col.cpm') }, money(cpm)),
        h('td', { 'data-label': t('col.actions'), class: 'ads-actions' }, a)
      ]);
    }
    function fail(e) { toast(t('toast.failed') + ' ' + (e && e.message ? e.message : ''), 'act'); load(); }
    function move(c, to) { api.moveCampaign(c.id, to).then(function () { toast(t('toast.campaign.' + to, { name: c.name })); load(); }).catch(fail); }
    function endIt(c) {
      confirmDialog({ title: t('end.title'), message: t('end.text', { name: c.name }), confirmLabel: t('act.end'), danger: true }).then(function (ok) { if (ok) move(c, 'ended'); });
    }
    function switchOn(c) {
      var total = api.total(c), risks = api.findRisks(c.caption);
      var input = h('input', { type: 'text', inputmode: 'decimal', id: 'ads-confirm-amt', class: 'ads-input', autocomplete: 'off', 'aria-describedby': 'ads-confirm-hint' });
      var body = h('div', {}, [
        h('p', { class: 'ads-warn' }, t('on.warn')),
        kv([[t('wiz.name'), c.name], [t('wiz.account'), accountName(c.accountId)], [t('wiz.daily'), money(c.dailyBudget)], [t('wiz.days'), String(c.days)], [t('wiz.start'), fmtDate(c.startDate, true)], [t('wiz.total'), h('strong', {}, money(total))]]),
        risks.length ? h('p', { class: 'ads-warn' }, t('on.risk', { words: risks.map(function (r) { return r.word; }).join(', ') })) : null,
        h('label', { for: 'ads-confirm-amt', class: 'ads-label' }, t('on.type', { amount: String(total) })),
        input, h('p', { class: 'ads-hint', id: 'ads-confirm-hint' }, t('on.hint', { amount: String(total) }))
      ]);
      openDialog({
        title: t('on.title'), body: body, actions: [{ label: t('on.confirm', { total: money(total) }), value: true, disabled: true }],
        onOpen: function (dlg, btns) {
          input.addEventListener('input', function () { btns[true].disabled = parseFloat(input.value.replace(',', '.')) !== total; });
          input.focus();
        }
      }).then(function (ok) { if (ok) move(c, 'in_review'); });
    }
    function showResults(c) {
      var body = h('div', {}, skeleton(3));
      openDialog({ title: t('res.title', { name: c.name }), body: body, wide: true, noCancel: true, actions: [{ label: t('common.close'), value: 'x' }] });
      api.getResults(c.id).then(function (r) {
        body.innerHTML = '';
        body.appendChild(h('p', { class: 'ads-note' }, t('res.note')));
        body.appendChild(h('ul', { class: 'ads-kpis ads-kpis--small' }, [['col.spend', money(r.totals.spend)], ['dash.reach', num(r.totals.reach)], ['col.messages', num(r.totals.messages)], ['col.cpm', money(r.totals.costPerMessage)]].map(function (k) {
          return h('li', { class: 'ads-kpi' }, [h('span', { class: 'ads-kpi__label' }, t(k[0])), h('span', { class: 'ads-kpi__value' }, k[1])]);
        })));
        if (r.totals.spend === 0) body.appendChild(h('p', {}, t('res.none')));
        else body.appendChild(lineChart(r.series));
      }).catch(function () { body.innerHTML = ''; body.appendChild(h('p', { role: 'alert' }, t('common.errorText'))); });
    }
    load();
  }

  /* ---------------------------------------------------------------------
     7. Campaign wizard (5 steps)
     --------------------------------------------------------------------- */
  function newWizard(prefill) {
    var accs = accounts(ctx.business);
    var w = {
      step: 1, name: '', goal: 'messages', accountId: ctx.account !== 'all' ? ctx.account : (accs[0] ? accs[0].id : ''),
      location: 'tbilisi', ageMin: 25, ageMax: 55, gender: 'all', dailyBudget: 2, days: 5, startDate: dayKey(new Date()),
      postId: '', imageIds: [], caption: '', business: ctx.business, postObjectId: '', requestId: ''
    };
    if (liveMode() && settings.limits.maxDailyBudget < w.dailyBudget) w.dailyBudget = settings.limits.maxDailyBudget;
    Object.keys(prefill || {}).forEach(function (k) { w[k] = prefill[k]; });
    return w;
  }
  function viewWizard(tok) {
    if (!wizard || wizard.business !== ctx.business) wizard = newWizard();
    var w = wizard, L = settings.limits, live = liveMode();
    var body = h('div', {}, skeleton(4));
    Promise.all([api.listPosts({ business: ctx.business }), api.listImages(ctx.business)]).then(function (res) {
      if (stale(tok)) return;
      draw(res[0], res[1]);
    }).catch(function () { if (!stale(tok)) { body.innerHTML = ''; body.appendChild(errorState(refresh)); } });
    render(h('div', {}, [pageHead('wiz.title', [h('a', { class: 'ads-btn ads-btn--ghost', href: '#/campaigns', onclick: function () { wizard = null; } }, t('common.cancel'))]), h('p', { class: 'ads-note' }, currencyNote()), body]), 'wiz.title');

    function draw(posts, images) {
      body.innerHTML = '';
      var steps = ['wiz.s1', 'wiz.s2', 'wiz.s3', 'wiz.s4', 'wiz.s5'];
      body.appendChild(h('ol', { class: 'ads-steps', 'aria-label': t('wiz.steps') }, steps.map(function (s, i) {
        return h('li', { class: 'ads-steps__item' + (i + 1 === w.step ? ' is-current' : i + 1 < w.step ? ' is-done' : ''), 'aria-current': i + 1 === w.step ? 'step' : null },
          [h('span', { class: 'ads-steps__n' }, String(i + 1)), h('span', { class: 'ads-steps__label' }, t(s))]);
      })));
      var errBox = h('div', { class: 'ads-errors', role: 'alert' });
      var panel = h('section', { class: 'ads-card', 'aria-labelledby': 'ads-w-h' }, h('h2', { class: 'ads-h2', id: 'ads-w-h', tabindex: '-1' }, t('wiz.s' + w.step)));
      var steppers = { 1: s1, 2: s2, 3: s3, 4: s4, 5: s5 };
      steppers[w.step](panel, errBox);
      body.appendChild(panel); body.appendChild(errBox);
      var nav = h('div', { class: 'ads-wiznav' }, [
        w.step > 1 ? h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { w.step--; draw(posts, images); focusHead(); } }, t('common.back')) : h('span'),
        w.step < 5 ? h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: next }, t('common.next'))
          : h('button', { type: 'button', class: 'ads-btn ads-btn--primary', id: 'ads-w-create', onclick: create }, t('wiz.create'))
      ]);
      body.appendChild(nav);

      function focusHead() { var e = $('#ads-w-h'); if (e) e.focus(); }
      function next() {
        var errs = validate(w.step);
        errBox.innerHTML = '';
        if (errs.length) {
          errBox.appendChild(h('ul', {}, errs.map(function (e) { return h('li', {}, t(e[1], e[2])); })));
          var f = document.getElementById(errs[0][0]); if (f) f.focus();
          return;
        }
        w.step++; draw(posts, images); focusHead();
      }
      function validate(step) {
        var e = [];
        if (step === 1) { if (!w.name.trim()) e.push(['ads-w-name', 'err.name']); if (!w.accountId) e.push(['ads-w-account', 'err.account']); }
        if (step === 2) { if (!(w.ageMin >= 18 && w.ageMax <= 65 && w.ageMin <= w.ageMax)) e.push(['ads-w-agemin', 'err.age']); }
        if (step === 3) {
          if (!(w.dailyBudget >= L.minDailyBudget && w.dailyBudget <= L.maxDailyBudget)) e.push(['ads-w-daily', 'err.budget']);
          if (!(w.days >= 1 && w.days <= L.maxDays && w.days % 1 === 0)) e.push(['ads-w-days', 'err.days']);
          if (live && w.dailyBudget * w.days > L.maxTotalBudget + 1e-9) e.push(['ads-w-daily', 'err.total', { total: money(L.maxTotalBudget) }]);
        }
        if (step === 4 && live) { if (!/^\d+_\d+$/.test(w.postObjectId.trim())) e.push(['ads-w-posts', 'err.postObj']); }
        else if (step === 4) { if (!w.postId && !w.imageIds.length) e.push(['ads-w-post', 'err.creative']); if (!w.caption.trim()) e.push(['ads-w-caption', 'err.caption']); }
        return e;
      }
      // LIVE: the server validates, applies the caps and (while ADS_LIVE is off) only answers with a DRY RUN.
      function createLive(btn) {
        if (!w.requestId) w.requestId = api.newRequestId(); // kept, so a retry of the same form is idempotent
        api.createCampaignLive({
          requestId: w.requestId, business: w.business, name: w.name.trim(), goal: w.goal, dailyBudget: w.dailyBudget, days: w.days,
          postObjectId: w.postObjectId.trim(), ageMin: w.ageMin, ageMax: w.ageMax
        }).then(function (res) {
          btn.disabled = false;
          if (res && res.ok) {
            var done = showCreateResult(res);
            if (res.dry_run === false) done.then(function () { wizard = null; go('#/campaigns'); });
            return done;
          }
          return showSrvError(res && res.error);
        }).catch(function () { btn.disabled = false; showSrvError({ code: 'network' }); });
      }
      function create() {
        var btn = $('#ads-w-create'); btn.disabled = true;
        if (live) return createLive(btn);
        api.createCampaign({
          business: ctx.business, accountId: w.accountId, name: w.name.trim(), goal: w.goal, dailyBudget: w.dailyBudget, days: w.days, startDate: w.startDate,
          audience: { location: w.location, ageMin: w.ageMin, ageMax: w.ageMax, gender: w.gender }, caption: w.caption, postId: w.postId || null, imageIds: w.imageIds
        }).then(function () {
          wizard = null; toast(t('toast.created')); go('#/campaigns');
        }).catch(function (e) { btn.disabled = false; toast(t('toast.failed') + ' ' + e.message, 'act'); });
      }

      function numInput(id, key, min, max, step) {
        var i = h('input', { type: 'number', id: id, class: 'ads-input', value: String(w[key]), min: min, max: max, step: step || 1, inputmode: 'decimal' });
        i.addEventListener('input', function () { w[key] = parseFloat(i.value); updateTotal(); });
        return i;
      }
      function updateTotal() { var n = $('#ads-w-total'); if (n) n.textContent = money((w.dailyBudget || 0) * (w.days || 0)); }

      function s1(p) {
        var name = h('input', { type: 'text', id: 'ads-w-name', class: 'ads-input', value: w.name, maxlength: '80', autocomplete: 'off' });
        name.addEventListener('input', function () { w.name = name.value; });
        p.appendChild(field('wiz.name', name, null, 'ads-w-name'));
        p.appendChild(field('wiz.account', select('ads-w-account', accounts(ctx.business).map(function (a) { return [a.id, a.name]; }), w.accountId, function (v) { w.accountId = v; }), null, 'ads-w-account'));
        var fs = h('fieldset', { class: 'ads-fieldset' }, h('legend', { class: 'ads-label' }, t('wiz.goal')));
        ['messages', 'traffic', 'engagement'].forEach(function (g) {
          var r = h('input', { type: 'radio', name: 'ads-goal', id: 'ads-goal-' + g, value: g, checked: w.goal === g });
          r.addEventListener('change', function () { w.goal = g; });
          fs.appendChild(h('label', { class: 'ads-option', for: 'ads-goal-' + g }, [r, h('span', {}, [h('strong', {}, t('goal.' + g)), h('span', { class: 'ads-sub' }, t('goal.' + g + '.d'))])]));
        });
        p.appendChild(fs);
      }
      function s2(p) {
        p.appendChild(field('wiz.location', select('ads-w-loc', settings.locations.map(function (l) { return [l.id, l[AdsI18n.lang()]]; }), w.location, function (v) { w.location = v; }), null, 'ads-w-loc'));
        p.appendChild(h('div', { class: 'ads-row' }, [field('wiz.ageMin', numInput('ads-w-agemin', 'ageMin', 18, 65), null, 'ads-w-agemin'), field('wiz.ageMax', numInput('ads-w-agemax', 'ageMax', 18, 65), null, 'ads-w-agemax')]));
        var fs = h('fieldset', { class: 'ads-fieldset' }, h('legend', { class: 'ads-label' }, t('wiz.gender')));
        ['all', 'women', 'men'].forEach(function (g) {
          var r = h('input', { type: 'radio', name: 'ads-gender', id: 'ads-gender-' + g, value: g, checked: w.gender === g });
          r.addEventListener('change', function () { w.gender = g; });
          fs.appendChild(h('label', { class: 'ads-option ads-option--inline', for: 'ads-gender-' + g }, [r, h('span', {}, t('gender.' + g))]));
        });
        p.appendChild(fs);
      }
      function s3(p) {
        p.appendChild(h('p', { class: 'ads-note' }, live
          ? t('wiz.limitsLive', { max: money(L.maxDailyBudget), total: money(L.maxTotalBudget), days: L.maxDays })
          : t('wiz.limits', { min: money(L.minDailyBudget), max: money(L.maxDailyBudget), days: L.maxDays })));
        p.appendChild(h('div', { class: 'ads-row' }, [
          field('wiz.daily', numInput('ads-w-daily', 'dailyBudget', L.minDailyBudget, L.maxDailyBudget, live ? 0.01 : 0.5), t('wiz.dailyHint'), 'ads-w-daily'),
          field('wiz.days', numInput('ads-w-days', 'days', 1, L.maxDays), null, 'ads-w-days')]));
        var date = h('input', { type: 'date', id: 'ads-w-start', class: 'ads-input', value: w.startDate, min: dayKey(new Date()) });
        date.addEventListener('input', function () { if (date.value) w.startDate = date.value; });
        if (!live) p.appendChild(field('wiz.start', date, null, 'ads-w-start')); // live: the server starts it an hour after creation
        p.appendChild(h('p', { class: 'ads-total' }, [t('wiz.total') + ': ', h('strong', { id: 'ads-w-total' }, money(w.dailyBudget * w.days))]));
      }
      function s4(p) {
        if (live) {
          // The server builds the ad from an EXISTING Page post, so the post id is the creative.
          // Choose from the Page's published posts; the pasted-id input below stays as a fallback.
          // Both write the same value, w.postObjectId, so ads-create-campaign gets it as before.
          var po = h('input', { type: 'text', id: 'ads-w-postobj', class: 'ads-input', value: w.postObjectId, autocomplete: 'off', inputmode: 'numeric', 'aria-describedby': 'ads-w-postobj-hint' });
          var group = h('div', { class: 'ads-postlist', id: 'ads-w-posts', role: 'radiogroup', 'aria-labelledby': 'ads-w-posts-label', tabindex: '-1' });
          var status = h('div', { class: 'ads-postlist__status', 'aria-live': 'polite' });
          var more = h('details', { class: 'ads-postlist__paste' }, [h('summary', {}, t('wiz.posts.paste')), field('wiz.postObj', po, t('wiz.postObjHint'), 'ads-w-postobj')]);
          if (w.postObjectId) more.open = true;
          po.addEventListener('input', function () {
            w.postObjectId = po.value;
            Array.prototype.forEach.call(group.querySelectorAll('input[type=radio]'), function (r) { r.checked = r.value === po.value.trim(); });
          });
          function load() {
            group.innerHTML = '';
            status.innerHTML = '';
            status.appendChild(h('span', { class: 'visually-hidden' }, t('wiz.posts.loading')));
            group.appendChild(skeleton(3));
            api.listPagePosts(w.business).then(function (list) {
              group.innerHTML = ''; status.innerHTML = '';
              if (!list.length) { status.appendChild(h('p', { class: 'ads-note' }, t('wiz.posts.empty'))); more.open = true; return; }
              list.forEach(function (x, i) {
                var first = String(x.message || '').split(/\r?\n/)[0].trim() || t('wiz.posts.noText');
                var rid = 'ads-w-post-' + i;
                var r = h('input', { type: 'radio', name: 'ads-w-post-pick', id: rid, value: x.id, checked: w.postObjectId.trim() === x.id, 'aria-labelledby': rid + '-msg', 'aria-describedby': rid + '-date' });
                r.addEventListener('change', function () { w.postObjectId = x.id; po.value = x.id; });
                group.appendChild(h('label', { class: 'ads-option ads-postpick', for: rid }, [
                  r,
                  x.picture ? h('img', { class: 'ads-postpick__img', src: x.picture, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : h('span', { class: 'ads-postpick__img', 'aria-hidden': 'true' }),
                  h('span', { class: 'ads-postpick__text' }, [
                    h('span', { class: 'ads-postpick__msg', id: rid + '-msg' }, first),
                    h('span', { class: 'ads-postpick__date', id: rid + '-date' }, x.created_time ? fmtDate(x.created_time, true) : '')
                  ])
                ]));
              });
            }).catch(function (err) {
              group.innerHTML = ''; status.innerHTML = '';
              more.open = true;
              status.appendChild(h('div', { class: 'ads-warn', role: 'alert' }, [
                h('p', {}, (err && err.message) || t('wiz.posts.error')),
                h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: load }, t('wiz.posts.retry'))
              ]));
            });
          }
          p.appendChild(h('div', { class: 'ads-field' }, [h('span', { class: 'ads-label', id: 'ads-w-posts-label' }, t('wiz.posts.label')), group, status]));
          p.appendChild(more);
          load();
          return;
        }
        var risk = riskBox();
        var cap = h('textarea', { id: 'ads-w-caption', class: 'ads-input ads-textarea', rows: '4' }, w.caption);
        cap.addEventListener('input', function () { w.caption = cap.value; risk.update(cap.value); });
        var eligible = posts.filter(function (x) { return ['approved', 'scheduled', 'published'].indexOf(x.status) !== -1; });
        var postSel = select('ads-w-post', [['', t('wiz.noPost')]].concat(eligible.map(function (x) { return [x.id, x.caption.slice(0, 50) + ' (' + t('status.' + x.status) + ')']; })), w.postId, function (v) {
          w.postId = v;
          var chosen = eligible.filter(function (x) { return x.id === v; })[0];
          if (chosen) { w.caption = chosen.caption; cap.value = chosen.caption; risk.update(chosen.caption); if (chosen.imageId) { w.imageIds = [chosen.imageId]; draw(posts, images); } }
        });
        p.appendChild(field('wiz.post', postSel, t('wiz.postHint'), 'ads-w-post'));
        var fs = h('fieldset', { class: 'ads-fieldset' }, [h('legend', { class: 'ads-label' }, t('wiz.images')), h('div', { class: 'ads-imggrid' }, images.map(function (im) {
          var cb = h('input', { type: 'checkbox', id: 'ads-wimg-' + im.id, checked: w.imageIds.indexOf(im.id) !== -1 });
          cb.addEventListener('change', function () { w.imageIds = cb.checked ? w.imageIds.concat(im.id) : w.imageIds.filter(function (x) { return x !== im.id; }); });
          return h('label', { class: 'ads-imgpick', for: 'ads-wimg-' + im.id }, [cb, imageEl(im.id, 'ads-imgpick__img'), h('span', { class: 'ads-imgpick__cap' }, lname(im, 'title'))]);
        }))]);
        p.appendChild(fs);
        p.appendChild(field('wiz.caption', cap, null, 'ads-w-caption'));
        p.appendChild(h('h3', { class: 'ads-h3' }, t('policy.title')));
        p.appendChild(risk); risk.update(w.caption);
      }
      function s5(p) {
        if (live) {
          p.appendChild(kv([
            [t('wiz.name'), w.name], [t('wiz.account'), accountName(w.accountId)], [t('wiz.goal'), t('goal.' + w.goal)],
            [t('wiz.location'), locName('georgia')], [t('wiz.age'), w.ageMin + ' - ' + w.ageMax],
            [t('wiz.daily'), money(w.dailyBudget)], [t('wiz.days'), String(w.days)], [t('wiz.postObj'), w.postObjectId.trim()]
          ]));
          p.appendChild(h('p', { class: 'ads-total' }, [t('wiz.totalCost') + ': ', h('strong', {}, money(w.dailyBudget * w.days))]));
          p.appendChild(h('p', { class: 'ads-note' }, t('wiz.liveNote')));
          p.appendChild(h('p', { class: 'ads-note' }, t('wiz.pausedNote')));
          return;
        }
        var acc = accountName(w.accountId), total = w.dailyBudget * w.days, risks = api.findRisks(w.caption);
        var imgs = h('div', { class: 'ads-imgrow' }, w.imageIds.map(function (i) { return imageEl(i, 'ads-thumb'); }));
        p.appendChild(kv([
          [t('wiz.name'), w.name], [t('wiz.account'), acc], [t('wiz.goal'), t('goal.' + w.goal)],
          [t('wiz.location'), locName(w.location)], [t('wiz.age'), w.ageMin + ' - ' + w.ageMax], [t('wiz.gender'), t('gender.' + w.gender)],
          [t('wiz.daily'), money(w.dailyBudget)], [t('wiz.days'), String(w.days)], [t('wiz.start'), fmtDate(w.startDate, true)],
          [t('wiz.post'), w.postId ? (posts.filter(function (x) { return x.id === w.postId; })[0] || { caption: w.postId }).caption : t('wiz.noPost')],
          [t('wiz.caption'), w.caption], [t('wiz.images'), w.imageIds.length ? imgs : t('common.noImage')]
        ]));
        p.appendChild(h('p', { class: 'ads-total' }, [t('wiz.totalCost') + ': ', h('strong', {}, money(total))]));
        p.appendChild(h('h3', { class: 'ads-h3' }, t('policy.title')));
        var rb = riskBox(); rb.update(w.caption); p.appendChild(rb);
        if (risks.length) p.appendChild(h('p', { class: 'ads-warn' }, t('wiz.riskWarn')));
        p.appendChild(h('p', { class: 'ads-note' }, t('wiz.pausedNote')));
      }
    }
  }

  /* ---------------------------------------------------------------------
     8. Posts: list, calendar, composer
     --------------------------------------------------------------------- */
  var POST_STATUSES = ['draft', 'needs_approval', 'approved', 'scheduled', 'published'];
  function postDate(p) { return p.scheduledAt || p.publishedAt || null; }

  function viewPosts(tok) {
    var body = h('div', {}, skeleton(4));
    var chipsBox = h('div', {});
    function drawChips() {
      chipsBox.innerHTML = '';
      chipsBox.appendChild(chips(['all'].concat(POST_STATUSES), postsFilter, function (k) { return k === 'all' ? t('common.all') : t('status.' + k); }, function (k) { postsFilter = k; drawChips(); load(); }, t('camp.statusFilter')));
    }
    drawChips();
    var viewSw = h('div', { class: 'ads-chips', role: 'group', 'aria-label': t('posts.view') }, ['list', 'calendar'].map(function (v) {
      return h('button', { type: 'button', class: 'ads-filter', 'aria-pressed': String(postsView === v), onclick: function () { postsView = v; refresh(); } }, t('posts.' + v));
    }));
    render(h('div', {}, [pageHead('nav.posts', [h('a', { class: 'ads-btn ads-btn--primary', href: '#/posts/new', onclick: function () { composerPrefill = null; } }, t('posts.new'))]),
      h('div', { class: 'ads-filters' }, [viewSw, chipsBox]), body]), 'nav.posts');

    function load() {
      Promise.all([api.listPosts({ business: ctx.business }), api.listProducts(ctx.business)]).then(function (res) {
        if (stale(tok)) return;
        var posts = res[0].filter(function (p) { return postsFilter === 'all' || p.status === postsFilter; });
        body.innerHTML = '';
        if (!posts.length) { body.appendChild(emptyState('posts.emptyTitle', 'posts.emptyText')); return; }
        body.appendChild(postsView === 'calendar' ? calendar(posts) : list(posts, res[1]));
      }).catch(function () { if (!stale(tok)) { body.innerHTML = ''; body.appendChild(errorState(load)); } });
    }
    function list(posts, products) {
      return h('ul', { class: 'ads-postlist' }, posts.map(function (p) {
        var prod = products.filter(function (x) { return x.id === p.productId; })[0], d = postDate(p);
        return h('li', { class: 'ads-postrow' }, [
          imageEl(p.imageId, 'ads-thumb'),
          h('div', { class: 'ads-postrow__main' }, [
            h('a', { class: 'ads-link ads-postrow__cap', href: '#/posts/' + p.id, onclick: function () { composerPrefill = null; } }, p.caption || t('posts.noCaption')),
            h('span', { class: 'ads-sub' }, (prod ? lname(prod, 'name') + ' - ' : '') + (d ? fmtDateTime(d) : t('posts.noDate')))]),
          chip(p.status)
        ]);
      }));
    }
    function calendar(posts) {
      var now = new Date();
      if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      var first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
      var lead = (first.getDay() + 6) % 7; // Monday first
      var daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      var byDay = {}, undated = [];
      posts.forEach(function (p) { var d = postDate(p); if (!d) { undated.push(p); return; } var k = dayKey(new Date(d)); (byDay[k] = byDay[k] || []).push(p); });
      var grid = h('div', { class: 'ads-cal__grid', role: 'grid', 'aria-label': first.toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) });
      var wk = h('div', { class: 'ads-cal__week', role: 'row' });
      for (var i = 0; i < 7; i++) wk.appendChild(h('div', { class: 'ads-cal__dow', role: 'columnheader' }, new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: 'short' })));
      grid.appendChild(wk);
      var cells = [];
      for (var b = 0; b < lead; b++) cells.push(h('div', { class: 'ads-cal__cell ads-cal__cell--blank', role: 'gridcell' }));
      for (var d = 1; d <= daysIn; d++) {
        var key = dayKey(new Date(first.getFullYear(), first.getMonth(), d));
        cells.push(h('div', { class: 'ads-cal__cell' + (key === dayKey(now) ? ' is-today' : ''), role: 'gridcell' }, [
          h('span', { class: 'ads-cal__num' }, String(d)),
          (byDay[key] || []).map(function (p) { return h('a', { class: 'ads-cal__post ads-cal__post--' + p.status, href: '#/posts/' + p.id, title: t('status.' + p.status) + ': ' + p.caption }, [h('span', { class: 'ads-cal__st' }, t('status.' + p.status)), ' ', p.caption.slice(0, 24)]); })
        ]));
      }
      for (var r = 0; r < cells.length; r += 7) grid.appendChild(h('div', { class: 'ads-cal__week', role: 'row' }, cells.slice(r, r + 7)));
      function shift(n) { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1); load(); }
      return h('div', {}, [
        h('div', { class: 'ads-cal__bar' }, [
          h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { shift(-1); } }, t('cal.prev')),
          h('strong', { 'aria-live': 'polite' }, first.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })),
          h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { calMonth = null; load(); } }, t('cal.today')),
          h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { shift(1); } }, t('cal.next'))]),
        h('div', { class: 'ads-cal', tabindex: '0', role: 'region', 'aria-label': t('posts.calendar') }, grid),
        undated.length ? h('section', { class: 'ads-card' }, [h('h2', { class: 'ads-h2' }, t('cal.undated')), h('ul', {}, undated.map(function (p) {
          return h('li', {}, [chip(p.status), ' ', h('a', { class: 'ads-link', href: '#/posts/' + p.id }, p.caption)]);
        }))]) : null
      ]);
    }
    load();
  }

  function postPreview(p, prod) {
    var biz = bizName(p.business);
    return h('div', { class: 'ads-fb' }, [
      h('div', { class: 'ads-fb__head' }, [h('span', { class: 'ads-fb__avatar', 'aria-hidden': 'true' }, biz.charAt(0)), h('span', {}, [h('strong', {}, biz), h('span', { class: 'ads-sub' }, t('prev.meta'))])]),
      h('p', { class: 'ads-fb__text' }, p.caption || t('prev.empty')),
      imageEl(p.imageId, 'ads-fb__img'),
      prod ? h('div', { class: 'ads-fb__prod' }, [h('span', {}, lname(prod, 'name')), h('strong', {}, money(prod.price))]) : null,
      h('div', { class: 'ads-fb__actions', 'aria-hidden': 'true' }, ['\u{1F44D} ' + t('prev.like'), t('prev.comment'), t('prev.share')])
    ]);
  }

  function viewComposer(tok, id) {
    var isNew = id === 'new';
    var body = h('div', {}, skeleton(5));
    render(h('div', {}, [pageHead('comp.title', [h('a', { class: 'ads-btn ads-btn--ghost', href: '#/posts' }, t('comp.back'))]), body]), 'comp.title');
    Promise.all([isNew ? Promise.resolve(null) : api.getPost(id), api.listProducts(ctx.business), api.listImages(ctx.business)]).then(function (res) {
      if (stale(tok)) return;
      draw(res[0] || Object.assign({ id: null, business: ctx.business, status: 'draft', productId: '', caption: '', imageId: '' }, composerPrefill || {}), res[1], res[2]);
      composerPrefill = null;
    }).catch(function () { if (!stale(tok)) { body.innerHTML = ''; body.appendChild(errorState(refresh)); } });

    function draw(post, products, images) {
      body.innerHTML = '';
      var editable = post.status === 'draft', soft = settings.limits.captionSoftLimit;
      var risk = riskBox(), prevBox = h('div', {}), count = h('p', { class: 'ads-hint', id: 'ads-p-count' });
      var prodSel = select('ads-p-prod', [['', t('comp.noProduct')]].concat(products.map(function (x) { return [x.id, lname(x, 'name') + ' - ' + money(x.price)]; })), post.productId || '', function (v) { post.productId = v; upd(); });
      var cap = h('textarea', { id: 'ads-p-caption', class: 'ads-input ads-textarea', rows: '6', 'aria-describedby': 'ads-p-count' }, post.caption);
      if (!editable) { prodSel.disabled = true; cap.disabled = true; }
      cap.addEventListener('input', function () { post.caption = cap.value; upd(); });
      var tplBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', disabled: !editable, onclick: function () {
        var prod = products.filter(function (x) { return x.id === post.productId; })[0] || products[0];
        var tpl = settings.georgianTemplates[Math.floor(Math.random() * settings.georgianTemplates.length)];
        var txt = tpl.replace('{product}', prod.name_ka).replace('{price}', String(prod.price));
        post.caption = (cap.value ? cap.value + '\n' : '') + txt; cap.value = post.caption; upd(); cap.focus();
      } }, t('comp.template'));
      var pickers = h('fieldset', { class: 'ads-fieldset', disabled: !editable }, [h('legend', { class: 'ads-label' }, t('wiz.images')), h('div', { class: 'ads-imggrid' }, images.map(function (im) {
        var r = h('input', { type: 'radio', name: 'ads-p-img', id: 'ads-pimg-' + im.id, checked: post.imageId === im.id });
        r.addEventListener('change', function () { post.imageId = im.id; upd(); });
        return h('label', { class: 'ads-imgpick', for: 'ads-pimg-' + im.id }, [r, imageEl(im.id, 'ads-imgpick__img'), h('span', { class: 'ads-imgpick__cap' }, lname(im, 'title'))]);
      }))]);
      function curProduct() { return products.filter(function (x) { return x.id === post.productId; })[0] || null; }
      function upd() {
        risk.update(post.caption);
        count.textContent = t('comp.count', { n: post.caption.length, max: soft });
        count.className = 'ads-hint' + (post.caption.length > soft ? ' ads-hint--warn' : '');
        prevBox.innerHTML = ''; prevBox.appendChild(postPreview(post, curProduct()));
      }
      // Dialog with the EXACT content, for Approve / Publish / Schedule.
      function contentDialog(titleKey, confirmKey, withDate) {
        var risks = api.findRisks(post.caption), dt = null, ack = null;
        var kids = [h('p', { class: 'ads-warn' }, t(titleKey + '.warn')), postPreview(post, curProduct()), h('p', { class: 'ads-total' }, t('comp.cost'))];
        if (withDate) {
          var d = new Date(Date.now() + 86400000); d.setHours(10, 0, 0, 0);
          var pad = function (n) { return (n < 10 ? '0' : '') + n; };
          var local = function (x) { return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()) + 'T' + pad(x.getHours()) + ':' + pad(x.getMinutes()); };
          dt = h('input', { type: 'datetime-local', id: 'ads-p-when', class: 'ads-input', value: local(d), min: local(new Date()) });
          kids.push(h('label', { class: 'ads-label', for: 'ads-p-when' }, t('comp.when')), dt);
        }
        if (risks.length) {
          ack = h('input', { type: 'checkbox', id: 'ads-p-ack' });
          kids.push(h('p', { class: 'ads-warn' }, t('comp.riskWarn', { words: risks.map(function (r) { return r.word; }).join(', ') })), h('label', { class: 'ads-option ads-option--inline', for: 'ads-p-ack' }, [ack, h('span', {}, t('comp.ack'))]));
        }
        return openDialog({
          title: t(titleKey), body: h('div', {}, kids), wide: true, actions: [{ label: t(confirmKey), value: true, disabled: !!risks.length }],
          onOpen: function (dlg, btns) {
            if (ack) ack.addEventListener('change', function () { btns[true].disabled = !ack.checked; });
          }
        }).then(function (ok) { return ok ? (dt ? { scheduledAt: new Date(dt.value).toISOString() } : {}) : null; });
      }
      function saveCurrent() { return api.savePost({ id: post.id, business: post.business, productId: post.productId, caption: post.caption, imageId: post.imageId }); }
      function guard() { if (!post.caption.trim()) { toast(t('err.caption'), 'act'); cap.focus(); return false; } return true; }
      function fail(e) { toast(t('toast.failed') + ' ' + e.message, 'act'); }
      function moveTo(to, extra, msg) { return api.movePost(post.id, to, extra).then(function () { toast(t(msg)); go('#/posts/' + post.id); }).catch(fail); }

      var actions = [];
      function btn(label, fn, kind) { actions.push(h('button', { type: 'button', class: 'ads-btn ' + (kind || 'ads-btn--ghost'), onclick: fn }, t(label))); }
      if (post.status === 'draft') {
        btn('comp.save', function () { if (!guard()) return; saveCurrent().then(function (p) { toast(t('toast.saved')); if (!post.id) go('#/posts/' + p.id); else refresh(); }).catch(fail); });
        btn('comp.send', function () { if (!guard()) return; saveCurrent().then(function (p) { return api.movePost(p.id, 'needs_approval').then(function () { toast(t('toast.post.needs_approval')); go('#/posts/' + p.id); }); }).catch(fail); }, 'ads-btn--primary');
      }
      if (post.status === 'needs_approval') btn('comp.approve', function () { contentDialog('dlg.approve', 'comp.approve').then(function (r) { if (r) moveTo('approved', null, 'toast.post.approved'); }); }, 'ads-btn--primary');
      if (post.status === 'approved') btn('comp.schedule', function () { contentDialog('dlg.schedule', 'comp.schedule', true).then(function (r) { if (r) moveTo('scheduled', r, 'toast.post.scheduled'); }); });
      if (post.status === 'approved' || post.status === 'scheduled') btn('comp.publish', function () { contentDialog('dlg.publish', 'comp.publish').then(function (r) { if (r) moveTo('published', null, 'toast.post.published'); }); }, 'ads-btn--primary');
      if (post.status === 'needs_approval' || post.status === 'approved') btn('comp.toDraft', function () { moveTo('draft', null, 'toast.post.draft'); });
      if (post.status === 'scheduled') btn('comp.unschedule', function () { moveTo('approved', null, 'toast.post.approved'); });
      if (post.id && post.status !== 'published') btn('comp.delete', function () {
        confirmDialog({ title: t('del.title'), message: t('del.text'), confirmLabel: t('comp.delete'), danger: true }).then(function (ok) {
          if (ok) api.deletePost(post.id).then(function () { toast(t('toast.deleted')); go('#/posts'); }).catch(fail);
        });
      }, 'ads-btn--danger-ghost');

      var form = h('div', { class: 'ads-card' }, [
        h('p', {}, [t('col.status') + ': ', chip(post.status)]),
        editable ? null : h('p', { class: 'ads-note' }, t('comp.locked')),
        field('comp.product', prodSel, null, 'ads-p-prod'), pickers,
        h('div', { class: 'ads-field' }, [h('label', { class: 'ads-label', for: 'ads-p-caption' }, t('wiz.caption')), cap, count, tplBtn]),
        h('h3', { class: 'ads-h3' }, t('policy.title')), risk,
        h('div', { class: 'ads-btnrow' }, actions)
      ]);
      body.appendChild(h('div', { class: 'ads-compose' }, [form, h('div', { class: 'ads-card ads-compose__prev', 'aria-label': t('comp.preview') }, [h('h2', { class: 'ads-h2' }, t('comp.preview')), prevBox])]));
      upd();
    }
  }

  /* ---------------------------------------------------------------------
     9. AI Assistant (mock replies; never acts by itself)
     --------------------------------------------------------------------- */
  function chatLog() { return $('#ads-chat-log'); }
  function addMsg(m) { chat.push(m); drawChat(); }
  function drawChat() {
    var log = chatLog(); if (!log) return;
    log.innerHTML = '';
    if (!chat.length) log.appendChild(h('p', { class: 'ads-note' }, t('ai.hello')));
    chat.forEach(function (m) {
      var el = h('div', { class: 'ads-msg ads-msg--' + m.role }, [h('p', {}, m.text)]);
      if (m.tool) el.appendChild(toolCard(m));
      log.appendChild(el);
    });
    log.scrollTop = log.scrollHeight;
  }
  function toolCard(m) {
    var tl = m.tool, p = tl.params, card = h('div', { class: 'ads-tool' });
    var rows;
    if (tl.kind === 'create_campaign') {
      card.appendChild(h('strong', {}, t('tool.createCampaign', { daily: money(p.dailyBudget), days: p.days })));
      rows = [[t('wiz.name'), p.name], [t('wiz.goal'), t('goal.' + p.goal)], [t('wiz.location'), locName(p.audience.location)], [t('wiz.total'), h('strong', {}, money(p.dailyBudget * p.days))]];
    } else if (tl.kind === 'create_post') {
      card.appendChild(h('strong', {}, t('tool.createPost')));
      rows = [[t('wiz.caption'), p.caption], [t('comp.cost'), t('tool.free')]];
    } else {
      card.appendChild(h('strong', {}, t('tool.pause', { name: p.name })));
      rows = [[t('col.status'), t('status.active') + ' > ' + t('status.paused')]];
    }
    card.appendChild(kv(rows));
    if (tl.kind === 'create_campaign') card.appendChild(h('p', { class: 'ads-note' }, t('tool.pausedNote')));
    if (tl.state) { card.appendChild(h('p', { class: 'ads-tool__state' }, t('tool.state.' + tl.state))); return card; }
    function done(state, toastKey) { tl.state = state; if (toastKey) toast(t(toastKey)); drawChat(); }
    var bar = h('div', { class: 'ads-btnrow' }, [
      h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--primary', onclick: function () {
        var job = tl.kind === 'create_campaign' ? api.createCampaign(p, 'assistant')
          : tl.kind === 'create_post' ? api.savePost(p, 'assistant') : api.moveCampaign(p.id, 'paused', 'assistant');
        job.then(function () { done('approved', 'tool.done'); }).catch(function (e) { toast(t('toast.failed') + ' ' + e.message, 'act'); });
      } }, t('tool.approve')),
      h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--ghost', onclick: function () { done('rejected'); } }, t('tool.reject')),
      tl.kind !== 'pause_campaign' ? h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--ghost', onclick: function () {
        tl.state = 'edited'; drawChat(); closeDrawer(true);
        if (tl.kind === 'create_campaign') { wizard = newWizard({ name: p.name, goal: p.goal, accountId: p.accountId, dailyBudget: p.dailyBudget, days: p.days, location: p.audience.location, caption: p.caption, imageIds: p.imageIds }); go('#/campaigns/new'); }
        else { composerPrefill = { caption: p.caption, productId: p.productId || '', imageId: p.imageId || '' }; go('#/posts/new'); }
      } }, t('tool.edit')) : null
    ]);
    card.appendChild(bar);
    return card;
  }
  function reply(q) {
    var s = q.toLowerCase();
    var has = function (re) { return re.test(s); };
    var biz = ctx.business;
    if (has(/pause|stop|შეაჩერ|გააჩერ/)) {
      return api.listCampaigns({ business: biz, status: 'active' }).then(function (rows) {
        if (!rows.length) return { role: 'bot', text: t('ai.noActive') };
        return { role: 'bot', text: t('ai.pause'), tool: { kind: 'pause_campaign', params: { id: rows[0].id, name: rows[0].name } } };
      });
    }
    if (has(/post|caption|write|draft|პოსტ|ტექსტ/)) {
      return Promise.all([api.listProducts(biz), api.listImages(biz)]).then(function (r) {
        var prod = r[0][0], caption = AdsI18n.lang() === 'ka'
          ? settings.georgianTemplates[0].replace('{product}', prod.name_ka).replace('{price}', String(prod.price)) : t('ai.postCaption', { product: prod.name_en });
        return { role: 'bot', text: t('ai.post'), tool: { kind: 'create_post', params: { business: biz, productId: prod.id, caption: caption, imageId: r[1][0] ? r[1][0].id : '' } } };
      });
    }
    if (has(/campaign|ad\b|ads\b|advert|კამპან|რეკლამ/)) {
      return api.listImages(biz).then(function (imgs) {
        var accs = accounts(biz);
        return { role: 'bot', text: t('ai.campaign'), tool: { kind: 'create_campaign', params: {
          business: biz, accountId: ctx.account !== 'all' ? ctx.account : accs[0].id, name: t('ai.campaignName', { biz: bizName(biz) }), goal: 'messages', dailyBudget: 2, days: 5,
          audience: { location: 'tbilisi', ageMin: 25, ageMax: 55, gender: 'all' }, caption: t('ai.campaignCaption'), imageIds: imgs[0] ? [imgs[0].id] : [] } } };
      });
    }
    if (has(/how|week|perform|result|spend|როგორ|კვირ|შედეგ/)) {
      return api.getDashboard({ range: 7, business: biz, account: 'all' }).then(function (d) {
        return { role: 'bot', text: t('ai.stats', { spend: money(d.kpis.spend), msgs: num(d.kpis.messages), cpm: money(d.kpis.costPerMessage), active: d.kpis.activeCampaigns }) };
      });
    }
    return Promise.resolve({ role: 'bot', text: t('ai.fallback') });
  }
  function ask(q) {
    q = q.trim(); if (!q) return;
    addMsg({ role: 'user', text: q });
    setTimeout(function () {
      reply(q).then(addMsg).catch(function () { addMsg({ role: 'bot', text: t('common.errorText') }); });
    }, 450);
  }
  function buildAssistant() {
    assistant.innerHTML = '';
    var input = h('input', { type: 'text', id: 'ads-chat-in', class: 'ads-input', autocomplete: 'off', 'aria-label': t('ai.input'), placeholder: t('ai.input') });
    assistant.appendChild(h('div', { class: 'ads-drawer__head' }, [
      h('h2', { class: 'ads-h2', id: 'ads-ai-title' }, t('ai.title')),
      h('button', { type: 'button', class: 'ads-iconbtn', 'aria-label': t('common.close'), onclick: function () { closeDrawer(); } }, '✕')]));
    assistant.appendChild(h('p', { class: 'ads-note ads-ai__note' }, t('ai.note')));
    assistant.appendChild(h('div', { id: 'ads-chat-log', class: 'ads-chat', role: 'log', 'aria-live': 'polite', tabindex: '0', 'aria-label': t('ai.title') }));
    assistant.appendChild(h('div', { class: 'ads-chips ads-chips--wrap' }, ['ai.chip1', 'ai.chip2', 'ai.chip3', 'ai.chip4'].map(function (k) {
      return h('button', { type: 'button', class: 'ads-filter', onclick: function () { ask(t(k)); } }, t(k));
    })));
    assistant.appendChild(h('form', { class: 'ads-chatform', onsubmit: function (e) { e.preventDefault(); ask(input.value); input.value = ''; } }, [input, h('button', { type: 'submit', class: 'ads-btn ads-btn--primary' }, t('ai.send'))]));
    drawChat();
  }

  /* ---------------------------------------------------------------------
     10. Top bar, language, user menu
     --------------------------------------------------------------------- */
  function buildTopbar() {
    var biz = $('#ads-biz'), acc = $('#ads-account');
    biz.innerHTML = '';
    settings.businesses.forEach(function (b) { biz.appendChild(h('option', { value: b.id }, b.name)); });
    biz.value = ctx.business;
    fillAccounts();
    $('#ads-user-email').textContent = user ? user.email : '';
    var live = liveMode(), bd = $('#ads-badge');
    bd.textContent = t(live ? 'top.badge.live' : 'top.badge.mock');
    bd.classList.toggle('ads-badge--live', live);
    $('#ads-mode').textContent = t(live ? 'menu.modeMock' : 'menu.modeLive');
    $('#ads-lang').textContent = AdsI18n.lang() === 'en' ? 'ქართული' : 'English';
    function fillAccounts() {
      acc.innerHTML = '';
      acc.appendChild(h('option', { value: 'all' }, t('common.allAccounts')));
      accounts(ctx.business).forEach(function (a) { acc.appendChild(h('option', { value: a.id }, a.name)); });
      acc.value = ctx.account;
    }
    buildTopbar.fillAccounts = fillAccounts;
  }
  function saveCtx() { try { localStorage.setItem('ads_ctx', JSON.stringify(ctx)); } catch (e) { /* ignore */ } }
  function loadCtx() {
    try { var c = JSON.parse(localStorage.getItem('ads_ctx')); if (c && c.business) { ctx.business = c.business; ctx.account = c.account || 'all'; } } catch (e) { /* ignore */ }
    if (!settings.businesses.some(function (b) { return b.id === ctx.business; })) ctx = { business: settings.businesses[0].id, account: 'all' };
    if (ctx.account !== 'all' && !accounts(ctx.business).some(function (a) { return a.id === ctx.account; })) ctx.account = 'all';
  }
  function wireShell() {
    $('#ads-biz').addEventListener('change', function (e) {
      ctx.business = e.target.value; ctx.account = 'all'; campAccount = 'all'; wizard = null; saveCtx(); buildTopbar.fillAccounts(); firstRender = 'focus'; refresh();
    });
    $('#ads-account').addEventListener('change', function (e) { ctx.account = e.target.value; campAccount = 'all'; saveCtx(); refresh(); });
    $('#ads-lang').addEventListener('click', function () {
      AdsI18n.setLang(AdsI18n.lang() === 'en' ? 'ka' : 'en');
      AdsI18n.apply(document); buildNav(); buildTopbar(); buildAssistant(); route();
      $('#ads-lang').focus();
    });
    $('#ads-menu-btn').addEventListener('click', function () { openDrawer(sidebar, this); });
    $('#ads-ai-btn').addEventListener('click', function () { openDrawer(assistant, this, $('#ads-chat-in')); });
    scrim.addEventListener('click', function () { closeDrawer(); });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (e) { if (e.matches && activeDrawer && activeDrawer.el === sidebar) closeDrawer(true); });
    // User menu
    var ub = $('#ads-user-btn'), um = $('#ads-user-menu');
    function menu(open) { um.hidden = !open; ub.setAttribute('aria-expanded', String(open)); }
    ub.addEventListener('click', function () { menu(um.hidden); });
    document.addEventListener('click', function (e) { if (!um.hidden && !um.contains(e.target) && !ub.contains(e.target)) menu(false); });
    um.addEventListener('keydown', function (e) { if (e.key === 'Escape') { menu(false); ub.focus(); } });
    $('#ads-signout').addEventListener('click', function () {
      client.auth.signOut().then(function () { location.reload(); }).catch(function () { location.reload(); });
    });
    $('#ads-mode').addEventListener('click', function () {
      menu(false);
      var toLive = !liveMode(), k = toLive ? 'mode.toLive' : 'mode.toMock';
      confirmDialog({ title: t(k + '.title'), message: t(k + '.text'), confirmLabel: t(k + '.confirm') }).then(function (ok) {
        if (!ok) return;
        api.setMode(toLive ? 'live' : 'mock');
        location.reload(); // businesses, limits and currency are loaded once at start
      });
    });
    $('#ads-reset').addEventListener('click', function () {
      menu(false);
      confirmDialog({ title: t('reset.title'), message: t('reset.text'), confirmLabel: t('reset.confirm'), danger: true }).then(function (ok) {
        if (ok) api.resetDemo().then(function () { toast(t('reset.done')); refresh(); });
      });
    });
    window.addEventListener('hashchange', function () { firstRender = 'focus'; route(); });
  }

  /* ---------------------------------------------------------------------
     11. Gate and boot
     --------------------------------------------------------------------- */
  function showGate(kind) {
    $('#ads-app').hidden = true;
    var g = $('#ads-gate'); g.hidden = false;
    g.innerHTML = '';
    var card = h('div', { class: 'ads-gatecard' }, [h('h1', { class: 'ads-h1' }, t('gate.' + kind + '.title')), h('p', {}, t('gate.' + kind + '.text'))]);
    if (kind === 'login') card.appendChild(h('a', { class: 'ads-btn ads-btn--primary', href: '../account.html' }, t('gate.login')));
    else if (kind === 'error') card.appendChild(h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function () { location.reload(); } }, t('common.retry')));
    else card.appendChild(h('a', { class: 'ads-btn ads-btn--ghost', href: '../index.html' }, t('menu.back')));
    g.appendChild(card);
  }
  function allowed(email) {
    if (!ALLOWED_EMAILS.length) return true;
    return !!email && ALLOWED_EMAILS.map(function (e) { return e.toLowerCase(); }).indexOf(email.toLowerCase()) !== -1;
  }
  function start(session) {
    if (started) return;
    started = true;
    user = session.user;
    api.setActor(user.email);
    var liveFailed = false;
    // If the live read fails (not a member, offline) fall back to mock instead of locking the tool.
    var settingsP = api.getSettings().catch(function (e) {
      if (!api.isLive()) throw e;
      api.setMode('mock'); liveFailed = true;
      return api.getSettings();
    });
    Promise.all([settingsP, api.listImages()]).then(function (r) {
      settings = r[0];
      r[1].forEach(function (im) { imageCache[im.id] = im; });
      main = $('#ads-main'); shell = $('#ads-shell'); scrim = $('#ads-scrim'); toastBox = $('#ads-toasts'); sidebar = $('#ads-sidebar'); assistant = $('#ads-assistant');
      loadCtx(); buildNav(); buildTopbar(); buildAssistant(); wireShell();
      $('#ads-gate').hidden = true; $('#ads-app').hidden = false;
      route();
      if (liveFailed) toast(t('mode.liveFailed'), 'act');
    }).catch(function () { started = false; showGate('error'); });
  }
  function boot() {
    AdsI18n.apply(document);
    $('#ads-app').hidden = true;
    if (!window.supabase || !window.supabase.createClient) return showGate('error'); // fail closed
    try { client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch (e) { return showGate('error'); }
    api.setClient(client); // same session as the gate; api.js sends its access token to the Edge Functions
    client.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      if (res.error) return showGate('error');
      if (!s) return showGate('login');
      if (!allowed(s.user.email)) return showGate('denied');
      start(s);
    }).catch(function () { showGate('error'); });
    client.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT' && started) location.reload(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
