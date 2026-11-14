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
  // Who may open the tool is decided by the database (ads_roles, read through
  // the ads_is_member() function), also for sample data. RLS and the Edge
  // Functions check again on every live call.

  var api = AdsApi;
  // t() always offers {cur} (currency of the current business) to the strings.
  function t(key, vars) {
    vars = vars || {};
    if (vars.cur === undefined) vars.cur = curLabel();
    return AdsI18n.t(key, vars);
  }
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var client = null, user = null, started = false;
  var chatSession = null; // the session handed to ../career.js (the Messages + Feedback window)
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
  // Shop (product) prices are always lari, whatever currency the ad account uses.
  function gel(n) {
    if (n == null) return '-';
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'GEL' }).format(n);
  }
  function qty(n) { return n == null ? '-' : new Intl.NumberFormat(locale(), { maximumFractionDigits: 3 }).format(n); }
  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return num(n / 1024) + ' KB';
    return new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(n / 1048576) + ' MB';
  }
  // Price inside the Georgian template text, which already says "lari": 19.9 -> "19.90";
  // no price -> "___" so the user fills it in.
  function priceText(n) { return n == null ? '___' : (n % 1 ? n.toFixed(2) : String(n)); }
  // Product names compare with spaces collapsed and case ignored (as stock-import.js and api.js).
  function normName(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  // "Text with *bold* parts" -> text nodes and <strong>, so translations keep whole sentences.
  function rich(s) { return String(s).split('*').map(function (part, i) { return i % 2 ? h('strong', {}, part) : part; }); }
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

  /* Images: uploads carry their own address (url). The sample images are inline SVG
     placeholders, generated here (no image files). */
  function imageUri(img) {
    if (img.url) return img.url;
    if (!img.shape) return '';
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
  // Every image list app.js receives goes in here, so imageEl() knows the uploads too.
  function cacheImages(list) { (list || []).forEach(function (im) { imageCache[im.id] = im; }); return list; }
  function imageEl(id, cls) {
    var im = imageById(id), src = im ? imageUri(im) : '';
    if (!src) return h('div', { class: (cls || '') + ' ads-img-empty' }, t('common.noImage'));
    return h('img', { class: (cls || 'ads-img') + (im.kind === 'element' ? ' ads-img--element' : ''), src: src, alt: lname(im, 'title'),
      width: String(im.width || 400), height: String(im.height || 300), loading: 'lazy' });
  }

  /* Products in posts and pictures (6 Nov 2026): the display name wins over the stock name. */
  // Name shown in the tool (sample products in the UI language).
  function prodName(p) { return p.displayName || lname(p, 'name'); }
  // Georgian name written in posts and on pictures (= displayName || name for stock products).
  function kaName(p) { return p.displayName || p.name_ka || p.name; }
  // The product's own photo (a library upload in the image cache), or null.
  function photoOf(p) { var im = p && p.imageId ? imageById(p.imageId) : null; return im && !im.sample && imageUri(im) ? im : null; }
  // "First product +N" for lists; '' when the post has no product.
  function prodSummary(ids, byId) {
    var first = null;
    (ids || []).some(function (x) { first = byId[x] || null; return !!first; });
    if (!first) return '';
    return prodName(first) + (ids.length > 1 ? ' +' + (ids.length - 1) : '');
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
  // o.onAction(value) (optional): runs first when an action is clicked; the dialog stays open
  // while its promise runs and closes only when it does not answer false (e.g. a failed save).
  // An action's kind: 'danger', 'ghost' (secondary look) or primary (default).
  // o.onOpen(dlg, btns, close) (optional): btns = action buttons by value; close(value) closes from inside.
  function openDialog(o) {
    return new Promise(function (resolve) {
      var prev = document.activeElement, closed = false;
      var titleId = 'ads-dlg-' + Math.floor(Math.random() * 1e6);
      var btns = {};
      var foot = h('div', { class: 'ads-dialog__foot' });
      if (!o.noCancel) {
        foot.appendChild(h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { close(null); } }, t(o.cancelLabel || 'common.cancel')));
      }
      (o.actions || []).forEach(function (a) {
        var b = h('button', { type: 'button', class: 'ads-btn ' + (a.kind === 'danger' ? 'ads-btn--danger' : a.kind === 'ghost' ? 'ads-btn--ghost' : 'ads-btn--primary'), disabled: !!a.disabled, onclick: function () {
          if (!o.onAction) { close(a.value); return; }
          b.disabled = true;
          Promise.resolve(o.onAction(a.value)).then(function (ok) { b.disabled = false; if (ok !== false) close(a.value); },
            function () { b.disabled = false; });
        } }, a.label);
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
        if (closed) return;
        closed = true;
        dlg.close(); dlg.remove();
        if (prev && prev.focus && document.contains(prev)) prev.focus();
        resolve(v);
      }
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(null); });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) close(null); });
      document.body.appendChild(dlg);
      dlg.showModal();
      if (o.onOpen) o.onOpen(dlg, btns, close);
    });
  }
  // ---- live backend: plain-word dialogs for server answers ----
  function liveMode() { return api.isLive(); }
  // The server's company checks (go-live step 3, 14 Nov 2026), in the screen's language; '' for other codes.
  function companyErrText(code) {
    return code === 'not_allowed' ? t('srv.not_allowed') : code === 'no_meta_connection' ? t('srv.no_meta_connection') : '';
  }
  function srvErrorBody(err) {
    err = err || {};
    var code = err.code || 'server', kids = [];
    if (code === 'network') return h('p', {}, t('srv.network'));
    if (code === 'not_member' || code === 'no_token' || code === 'bad_token') return h('p', {}, t('srv.access'));
    if (companyErrText(code)) return h('p', {}, companyErrText(code));
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
      var kids = [], rows = [];
      if (r && r.error) return showSrvError(r.error);
      if (r.ad_account) {
        var a = r.ad_account;
        rows.push([t('health.account'), a.name + ' (' + a.id + ')'], [t('health.status'), a.status], [t('health.currency'), a.currency],
          [t('health.page'), r.page ? r.page.name + ' (' + r.page.id + ')' : t('health.none')],
          [t('health.mode'), r.live_mode ? t('health.liveOn') : t('health.dry')]);
      }
      // Whose Meta key answered: the company's own, or (Edelweiss only, until its key is stored) the old server key.
      if (r.token_source) rows.push([t('health.token'), r.token_source === 'company' ? t('health.tokenOwn') : t('health.tokenServer')]);
      if (rows.length) kids.push(kv(rows));
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
  function emptyState(titleKey, textKey, action, vars) {
    return h('div', { class: 'ads-empty' }, [h('h2', { class: 'ads-h2' }, t(titleKey)), h('p', {}, t(textKey, vars)), action || null]);
  }
  // Chip for things that are not a workflow status: image kind, sample, stock, connection.
  function pill(text, mod) {
    return h('span', { class: 'ads-chip ads-chip--' + mod }, [h('span', { class: 'ads-chip__dot', 'aria-hidden': 'true' }), text]);
  }
  // Placeholder for a later round: looks like a normal button (ghost, or danger outline for
  // deletes), stays focusable (aria-disabled) and carries a "Coming soon" chip. A click only
  // says so; nothing else happens. opts: { danger, small, describedBy }.
  function soonBtn(labelKey, opts) {
    opts = opts || {};
    return h('button', {
      type: 'button', 'aria-disabled': 'true', 'aria-describedby': opts.describedBy || null,
      class: 'ads-btn ads-soon ' + (opts.danger ? 'ads-btn--danger-ghost' : 'ads-btn--ghost') + (opts.small ? ' ads-btn--small' : ''),
      onclick: function () { toast(t('soon.toast'), 'info'); }
    }, [t(labelKey), h('span', { class: 'ads-soon__chip' }, t('soon.chip'))]);
  }
  // Plain-language reason of a failed call: api.js errors may carry an i18n key.
  function errText(e) { return e && e.key ? t(e.key, e.vars) : (e && e.message) || ''; }
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
  // Radio buttons in a fieldset. options: [[value, label key, description key or null]].
  function radioGroup(name, legendKey, options, value, onPick) {
    return h('fieldset', { class: 'ads-fieldset' }, [h('legend', { class: 'ads-label' }, t(legendKey))].concat(options.map(function (o) {
      var id = name + '-' + o[0];
      var r = h('input', { type: 'radio', name: name, id: id, value: o[0], checked: o[0] === value });
      r.addEventListener('change', function () { onPick(o[0]); });
      return h('label', { class: 'ads-option', for: id }, [r, h('span', {}, [h('strong', {}, t(o[1])), o[2] ? h('span', { class: 'ads-sub' }, t(o[2])) : null])]);
    })));
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
  // The daily chart is drawn at the real size of its frame (owner feedback 261111-0004, 11 Nov 2026: it
  // filled only part of the card): the width follows the card, the height fills the card when it stands
  // beside a taller one (wide screens) and otherwise follows the CSS minimum. One drawing unit = one
  // pixel, so the labels keep their size; redrawn whenever the frame changes size.
  function lineChart(series) {
    var L = 52, R = 48, T = 14, B = 30, MIN_W = 300, MIN_H = 200;
    var maxS = niceMax(Math.max.apply(null, series.map(function (s) { return s.spend; })));
    var maxM = niceMax(Math.max.apply(null, series.map(function (s) { return s.messages; })));
    var wrap = h('div', { class: 'ads-chart', tabindex: '0', role: 'region', 'aria-label': t('dash.chartAria') });
    var drawn = '', shown = false;
    function draw(W, H) {
      var iw = W - L - R, ih = H - T - B;
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
      wrap.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('dash.chartAria')) + '">' + g + xl +
        '<polyline points="' + pM + '" fill="none" stroke="#0e4f6b" stroke-width="2.5" stroke-dasharray="6 4"/>' +
        '<polyline points="' + pS + '" fill="none" stroke="#b8420a" stroke-width="2.5"/>' + dots + '</svg>';
    }
    // Fit to the frame; a phone narrower than MIN_W scrolls sideways (the frame is focusable for keyboards).
    // The observer also reports while the new view is still being built off-page: wait for it; stop only
    // once the chart has been on the page and left it (the view was replaced).
    function fit() {
      if (!document.contains(wrap)) { if (shown && ro) ro.disconnect(); return; }
      shown = true;
      var W = Math.max(MIN_W, Math.floor(wrap.clientWidth)), H = Math.max(MIN_H, Math.floor(wrap.clientHeight));
      if (W + 'x' + H === drawn) return;
      drawn = W + 'x' + H;
      draw(W, H);
    }
    var ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
    if (ro) {
      ro.observe(wrap);
      // First drawing right after the dashboard is on the page (the observer waits for the next painted
      // frame, which a background tab may not get); a view replaced meanwhile stops observing.
      setTimeout(function () { if (document.contains(wrap)) fit(); else ro.disconnect(); }, 0);
    } else { wrap.classList.add('ads-chart--static'); draw(640, 240); } // old browsers: the former fixed drawing, scaled
    var legend = h('p', { class: 'ads-chart__legend' }, [
      h('span', { class: 'ads-key ads-key--spend' }, t('dash.spendAxis')), h('span', { class: 'ads-key ads-key--msg' }, t('dash.msgAxis'))
    ]);
    var table = h('table', { class: 'ads-table' }, [
      h('thead', {}, h('tr', {}, [h('th', { scope: 'col' }, t('common.date')), h('th', { scope: 'col' }, t('col.spend')), h('th', { scope: 'col' }, t('col.messages'))])),
      h('tbody', {}, series.map(function (s) { return h('tr', {}, [h('td', {}, fmtDate(s.date)), h('td', {}, money(s.spend)), h('td', {}, num(s.messages))]); }))
    ]);
    return h('div', { class: 'ads-chartbox' }, [legend, wrap, h('details', { class: 'ads-details' }, [h('summary', {}, t('dash.viewTable')), h('div', { class: 'ads-tablewrap', tabindex: '0', role: 'region', 'aria-label': t('dash.viewTable') }, table)])]);
  }
  // Spend per campaign in the chosen period: thin horizontal bars, biggest first, the values as text
  // beside them (the bars only show the size). More than BARS_MAX campaigns: the rest is one "Other" row.
  // Same colour as the spend line of the daily chart. The campaigns table below is the table view.
  var BARS_MAX = 6;
  function spendBars(rows) {
    var list = rows.filter(function (c) { return c.spend > 0; }).sort(function (a, b) { return b.spend - a.spend; });
    if (!list.length) return h('p', { class: 'ads-note' }, t('dash.noSpend'));
    if (list.length > BARS_MAX) {
      var rest = list.slice(BARS_MAX - 1), add = function (k) { return rest.reduce(function (n, c) { return n + (c[k] || 0); }, 0); };
      list = list.slice(0, BARS_MAX - 1).concat([{ name: t('dash.otherCampaigns', { n: rest.length }), spend: add('spend'), messages: add('messages'), other: true }]);
    }
    var max = Math.max.apply(null, list.map(function (c) { return c.spend; }));
    return h('ul', { class: 'ads-bars' }, list.map(function (c) {
      var cpm = c.messages ? c.spend / c.messages : null;
      var facts = t('dash.barFacts', { messages: num(c.messages || 0), cpm: cpm == null ? '-' : money(cpm) });
      return h('li', { class: 'ads-bars__row' + (c.other ? ' ads-bars__row--other' : ''), title: c.name + ' - ' + money(c.spend) + ' - ' + facts }, [
        h('span', { class: 'ads-bars__name' }, c.name),
        h('span', { class: 'ads-bars__value' }, money(c.spend)),
        h('span', { class: 'ads-bars__track', 'aria-hidden': 'true' }, h('span', { class: 'ads-bars__bar', style: 'width:' + Math.max(0.5, c.spend / max * 100).toFixed(1) + '%' })),
        h('span', { class: 'ads-bars__facts' }, facts)
      ]);
    }));
  }

  /* ---------------------------------------------------------------------
     4. Router and shell
     --------------------------------------------------------------------- */
  var NAV = [
    ['dashboard', 'nav.dashboard', false], ['campaigns', 'nav.campaigns', false], ['posts', 'nav.posts', false], ['messaging', 'msg.nav', false], ['approvals', 'ap.nav', false],
    ['images', 'nav.images', false], ['styles', 'sty.nav', false], ['brands', 'br.nav', false], ['products', 'nav.products', false], ['rotation', 'nav.rotation', true],
    ['settings', 'nav.settings', false], ['audit', 'nav.audit', false]
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
    // No company yet (D-49): the Library and Settings work; the other pages offer "Create a company".
    var navItem = NAV.filter(function (n) { return n[0] === name; })[0];
    if (!hasCompany() && name !== 'images' && name !== 'settings') return viewNoCompany(navItem ? navItem[1] : 'nav.dashboard');
    if (name === 'campaigns' && parts[1] === 'new') return viewWizard(tok);
    if (name === 'campaigns') return viewCampaigns(tok);
    if (name === 'posts' && parts[1]) return viewComposer(tok, parts[1]);
    if (name === 'posts') return viewPosts(tok);
    if (name === 'images') return viewImages(tok);
    if (name === 'styles') return viewStyles(tok);
    if (name === 'products') return viewProducts(tok);
    if (name === 'settings') return viewSettings(tok);
    if (name === 'audit') return viewAudit(tok);
    if (name === 'approvals') return viewApprovals(tok);
    if (name === 'messaging') return viewMessaging(tok);
    if (name === 'brands') return viewBrands(tok);
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
      // The daily chart and, beside it, where the money went (one row on wide screens, stacked below 1400px).
      body.appendChild(h('div', { class: 'ads-dashrow' }, [
        h('section', { class: 'ads-card ads-card--fill', 'aria-labelledby': 'ads-d-chart' }, [h('h2', { class: 'ads-h2', id: 'ads-d-chart' }, t('dash.chartTitle')), lineChart(d.series)]),
        h('section', { class: 'ads-card', 'aria-labelledby': 'ads-d-bars' }, [h('h2', { class: 'ads-h2', id: 'ads-d-bars' }, t('dash.byCampaign')),
          h('p', { class: 'ads-chart__legend' }, t('dash.byCampaignNote', { n: dashRange })), spendBars(d.campaigns)])
      ]));
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
     6. Campaigns: list, row actions, switch-on (with Edit details), results
     --------------------------------------------------------------------- */
  var CAMP_STATUSES = ['draft', 'paused', 'in_review', 'active', 'rejected', 'ended'];
  var RUN_PICS = 4, RUN_CAP = 80; // switch-on window: pictures shown before "+N", characters of the post caption

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
    // Switch-on window (paused campaigns). Since 7 Nov 2026 (ADS-19, docs/specs/ads-campaign-edit-2026-11-07.md):
    // Edit details turns name, daily budget, days and start date into fields (ad account and goal stay).
    // Cancel goes back to the saved values, Save changes keeps them (api.updateCampaign checks again and
    // logs campaign.edit), Switch on saves first. The amount to type and the button always use the
    // current total. Below the details, read-only: the post, its products and the pictures it runs.
    function switchOn(c) {
      var L = settings.limits, maxName = api.campaignRules.maxName, risks = api.findRisks(c.caption);
      var editing = false, busy = false, changed = false, draft = null, errs = {}, f = {}, btns = {}, closeDlg = null;
      var input = h('input', { type: 'text', inputmode: 'decimal', id: 'ads-confirm-amt', class: 'ads-input', autocomplete: 'off', 'aria-describedby': 'ads-confirm-hint' });
      var typeLabel = h('label', { for: 'ads-confirm-amt', class: 'ads-label' }), typeHint = h('p', { class: 'ads-hint', id: 'ads-confirm-hint' });
      var editBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost ads-btn--small', onclick: startEdit }, t('ced.edit'));
      var detailBox = h('div', {}), saveStatus = h('p', { class: 'ads-hint ads-hint--warn ads-status', role: 'alert' });
      var runsBox = h('div', {}, [h('p', { class: 'visually-hidden' }, t('ced.loading')), skeleton(2)]);
      var body = h('div', {}, [
        h('p', { class: 'ads-warn' }, t('on.warn')),
        h('section', { class: 'ads-ced', 'aria-labelledby': 'ads-ced-h' }, [
          h('div', { class: 'ads-ced__head' }, [h('h3', { class: 'ads-h3', id: 'ads-ced-h' }, t('ced.details')), editBtn]), detailBox, saveStatus]),
        h('section', { class: 'ads-ced', 'aria-labelledby': 'ads-runs-h' }, [h('h3', { class: 'ads-h3', id: 'ads-runs-h' }, t('ced.runs')), runsBox]),
        risks.length ? h('p', { class: 'ads-warn' }, t('on.risk', { words: risks.map(function (r) { return r.word; }).join(', ') })) : null,
        typeLabel, input, typeHint
      ]);
      drawDetails();
      openDialog({
        title: t('on.title'), body: body, noCancel: true,
        actions: [{ label: t('common.cancel'), value: 'cancel', kind: 'ghost' }, { label: t('ced.save'), value: 'save', kind: 'ghost' },
          { label: t('on.confirm', { total: money(api.total(c)) }), value: 'on', disabled: true }],
        onOpen: function (dlg, b, close) {
          btns = b; closeDlg = close; btns.save.hidden = true;
          input.addEventListener('input', sync);
          sync(); input.focus(); loadRuns();
        },
        onAction: function (v) {
          if (busy) return false;
          if (v === 'cancel') { if (!editing) return true; stopEdit(); return false; } // while editing: back to the saved values
          if (v === 'on') return editing ? saveDraft() : true;                          // switching on saves first
          var was = dirty();
          return saveDraft().then(function (ok) { if (ok) { toast(t(was ? 'ced.saved' : 'ced.noChange')); stopEdit(); } return false; });
        }
      }).then(function (v) {
        if (v === 'on') move(c, 'in_review');
        else if (changed) load(); // saved edits show in the list
      });

      function vals() { return editing ? draft : c; } // the values the window shows now
      function curTotal() { var v = vals(); return isFinite(v.dailyBudget) && isFinite(v.days) ? api.total(v) : 0; }
      function hasErrs() { return Object.keys(errs).length > 0; }
      function dirty() {
        return !!draft && (draft.name.trim() !== c.name || draft.dailyBudget !== c.dailyBudget || draft.days !== c.days || draft.startDate !== c.startDate);
      }
      // Inline checks while typing; api.updateCampaign checks the same again. A start date that is not
      // changed may be in the past (the campaign ran before it was paused).
      function check(d) {
        var e = {}, nm = d.name.trim();
        if (!nm) e.name = t('err.name');
        else if (nm.length > maxName) e.name = t('ced.err.nameLong', { max: maxName });
        if (!(d.dailyBudget >= L.minDailyBudget && d.dailyBudget <= L.maxDailyBudget)) e.daily = t('ced.err.daily', { min: money(L.minDailyBudget), max: money(L.maxDailyBudget) });
        if (!(d.days >= 1 && d.days <= L.maxDays && d.days % 1 === 0)) e.days = t('ced.err.days', { max: L.maxDays });
        if (!e.daily && !e.days && L.maxTotalBudget != null && api.total(d) > L.maxTotalBudget + 1e-9) e.total = t('err.total', { total: money(L.maxTotalBudget) });
        if (d.startDate !== c.startDate && !(d.startDate && d.startDate >= dayKey(new Date()))) e.start = t('ced.err.start');
        return e;
      }
      // Live regions announce a change once: text is only replaced when it differs.
      function setText(el, s) { s = s || ''; if (el.textContent !== s) el.textContent = s; }
      // Brings the window up to date: errors, total, the amount to type and the buttons.
      function sync() {
        var tot = curTotal();
        errs = editing ? check(draft) : {};
        if (editing) {
          [['name', f.name], ['daily', f.daily], ['days', f.days], ['start', f.start]].forEach(function (x) {
            setText(f[x[0] + 'Err'], errs[x[0]]);
            if (errs[x[0]]) x[1].setAttribute('aria-invalid', 'true'); else x[1].removeAttribute('aria-invalid');
          });
          setText(f.totalErr, errs.total);
          setText(f.total, money(tot));
        }
        setText(typeLabel, t('on.type', { amount: String(tot) }));
        setText(typeHint, t('on.hint', { amount: String(tot) }));
        if (!btns.on) return;
        setText(btns.on, t('on.confirm', { total: money(tot) }));
        btns.save.disabled = busy || hasErrs();
        btns.on.disabled = busy || hasErrs() || parseFloat(input.value.replace(',', '.')) !== tot;
      }
      // View: the summary rows. Editing: name, daily budget, days and start date as fields; the ad account stays text.
      function drawDetails() {
        detailBox.innerHTML = ''; f = {};
        editBtn.hidden = editing;
        if (btns.save) btns.save.hidden = !editing;
        if (!editing) {
          detailBox.appendChild(kv([[t('wiz.name'), c.name], [t('wiz.account'), accountName(c.accountId)], [t('wiz.daily'), money(c.dailyBudget)],
            [t('wiz.days'), String(c.days)], [t('wiz.start'), fmtDate(c.startDate, true)], [t('wiz.total'), h('strong', {}, money(api.total(c)))]]));
          return;
        }
        f.name = h('input', { type: 'text', id: 'ads-ced-name', class: 'ads-input', value: draft.name, maxlength: String(maxName), autocomplete: 'off', 'aria-describedby': 'ads-ced-name-err' });
        f.daily = h('input', { type: 'number', id: 'ads-ced-daily', class: 'ads-input', value: String(draft.dailyBudget), min: String(L.minDailyBudget), max: String(L.maxDailyBudget),
          step: liveMode() ? '0.01' : '0.5', inputmode: 'decimal', 'aria-describedby': 'ads-ced-limits ads-ced-daily-err ads-ced-total-err' });
        f.days = h('input', { type: 'number', id: 'ads-ced-days', class: 'ads-input', value: String(draft.days), min: '1', max: String(L.maxDays), step: '1', inputmode: 'numeric',
          'aria-describedby': 'ads-ced-limits ads-ced-days-err ads-ced-total-err' });
        f.start = h('input', { type: 'date', id: 'ads-ced-start', class: 'ads-input', value: draft.startDate, min: dayKey(new Date()), 'aria-describedby': 'ads-ced-start-hint ads-ced-start-err' });
        ['name', 'daily', 'days', 'start', 'total'].forEach(function (k) { f[k + 'Err'] = h('p', { class: 'ads-hint ads-hint--warn ads-status', id: 'ads-ced-' + k + '-err', 'aria-live': 'polite' }); });
        f.total = h('strong', {}, money(curTotal()));
        f.name.addEventListener('input', function () { draft.name = f.name.value; sync(); });
        f.daily.addEventListener('input', function () { draft.dailyBudget = parseFloat(f.daily.value); sync(); });
        f.days.addEventListener('input', function () { draft.days = parseFloat(f.days.value); sync(); });
        f.start.addEventListener('input', function () { draft.startDate = f.start.value; sync(); });
        function withErr(el, err) { el.appendChild(err); return el; }
        append(detailBox, [
          withErr(field('wiz.name', f.name, null, 'ads-ced-name'), f.nameErr),
          kv([[t('wiz.account'), accountName(c.accountId)]]),
          h('p', { class: 'ads-note', id: 'ads-ced-limits' }, L.maxTotalBudget != null
            ? t('wiz.limitsLive', { max: money(L.maxDailyBudget), total: money(L.maxTotalBudget), days: L.maxDays })
            : t('wiz.limits', { min: money(L.minDailyBudget), max: money(L.maxDailyBudget), days: L.maxDays })),
          h('div', { class: 'ads-row' }, [withErr(field('wiz.daily', f.daily, null, 'ads-ced-daily'), f.dailyErr), withErr(field('wiz.days', f.days, null, 'ads-ced-days'), f.daysErr)]),
          withErr(field('wiz.start', f.start, t('ced.startHint'), 'ads-ced-start'), f.startErr),
          h('p', { class: 'ads-total', 'aria-live': 'polite', 'aria-atomic': 'true' }, [t('wiz.total') + ': ', f.total]), f.totalErr
        ]);
      }
      function startEdit() {
        if (busy) return;
        editing = true;
        draft = { name: c.name, dailyBudget: c.dailyBudget, days: c.days, startDate: c.startDate };
        saveStatus.textContent = '';
        drawDetails(); sync();
        f.name.focus();
      }
      // Leaves editing (Cancel or a save): the saved values show again.
      function stopEdit() {
        editing = false; draft = null;
        drawDetails(); sync();
        editBtn.focus();
      }
      // Saves the edited values. Resolves true when they are kept (also when nothing changed), else false.
      function saveDraft() {
        sync();
        if (hasErrs()) return Promise.resolve(false);
        if (!dirty()) return Promise.resolve(true);
        busy = true; saveStatus.textContent = ''; sync();
        return api.updateCampaign(c.id, { name: draft.name, dailyBudget: draft.dailyBudget, days: draft.days, startDate: draft.startDate }).then(function (r) {
          c.name = r.name; c.dailyBudget = r.dailyBudget; c.days = r.days; c.startDate = r.startDate;
          busy = false; changed = true;
          return true;
        }, function (e) {
          busy = false; saveStatus.textContent = t('toast.failed') + ' ' + errText(e); sync();
          return false;
        });
      }
      // What this campaign runs (read-only): its post (caption, status, a way to open it), the post's
      // products (photo, name, price, stock) and the campaign's own pictures.
      function loadRuns() {
        Promise.all([c.postId ? api.getPost(c.postId).catch(function () { return false; }) : null, api.listProducts(c.business), api.listImages(c.business)])
          .then(function (r) { cacheImages(r[2]); drawRuns(r[0], r[1]); }, function () {
            runsBox.innerHTML = '';
            runsBox.appendChild(h('p', { class: 'ads-note' }, t('ced.loadFail')));
          });
      }
      function drawRuns(post, products) {
        var byId = {}, ids = c.imageIds || [], more = ids.length - RUN_PICS, dl = h('dl', { class: 'ads-runs' });
        products.forEach(function (p) { byId[p.id] = p; });
        dl.appendChild(h('dt', {}, t('ced.post')));
        if (!post) dl.appendChild(h('dd', {}, t(post === false ? 'ced.postGone' : 'ced.noPost')));
        else {
          var pids = post.productIds || [];
          append(dl, [
            h('dd', { class: 'ads-runs__post' }, [
              h('span', { class: 'ads-runs__cap' }, clip(post.caption || t('posts.noCaption'), RUN_CAP)),
              chip(post.status),
              h('a', { class: 'ads-btn ads-btn--ghost ads-btn--small', href: '#/posts/' + post.id, onclick: function (e) {
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; // a new tab or window: this window stays
                e.preventDefault(); closeDlg(null); go('#/posts/' + post.id);
              } }, t('ced.openPost'))
            ]),
            h('dt', {}, t('ced.prods')),
            h('dd', {}, pids.length ? h('ul', { class: 'ads-runs__prods' }, pids.map(function (pid) { return prodRow(byId[pid]); })) : t('ced.noProds'))
          ]);
        }
        append(dl, [h('dt', {}, t('ced.pics')), h('dd', {}, ids.length ? h('div', { class: 'ads-imgrow' }, ids.slice(0, RUN_PICS).map(function (x) { return imageEl(x, 'ads-thumb ads-runs__thumb'); })
          .concat(more > 0 ? h('span', { class: 'ads-runs__more' }, ['+' + more, h('span', { class: 'visually-hidden' }, ' ' + t('pp.img.more'))]) : [])) : t('ced.noPics'))]);
        runsBox.innerHTML = '';
        runsBox.appendChild(dl);
      }
      // First n characters and "…" (an emoji is not cut in half).
      function clip(s, n) {
        if (s.length <= n) return s;
        var cut = n - 1, code = s.charCodeAt(cut - 1);
        if (code >= 0xD800 && code <= 0xDBFF) cut--;
        return s.slice(0, cut).trim() + '…';
      }
      // One product of the post: photo if any, name (display name first), price in lari, stock.
      function prodRow(p) {
        if (!p) return h('li', { class: 'ads-runs__prod' }, [h('span', { class: 'ads-runs__img', 'aria-hidden': 'true' }), h('span', { class: 'ads-runs__name' }, t('pp.unknown'))]);
        var ph = photoOf(p), meta = [];
        if (p.price != null) meta.push(gel(p.price));
        if (p.quantity === 0) meta.push(pill(t('stock.out'), 'out'));
        else if (p.quantity != null) meta.push(t('pp.qty', { n: qty(p.quantity) }));
        return h('li', { class: 'ads-runs__prod' }, [
          ph ? h('img', { class: 'ads-runs__img', src: imageUri(ph), alt: '', loading: 'lazy' }) : h('span', { class: 'ads-runs__img', 'aria-hidden': 'true' }),
          h('span', { class: 'ads-runs__text' }, [h('span', { class: 'ads-runs__name' }, prodName(p)),
            meta.length ? h('span', { class: 'ads-runs__meta' }, meta.reduce(function (a, m, k) { return a.concat(k ? [' · ', m] : [m]); }, [])) : null])
        ]);
      }
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
    // A company made in the tool has no ad account yet (connections per company come with ADS-39).
    if (!accounts(ctx.business).length) {
      return render(h('div', {}, [pageHead('wiz.title'), emptyState('co.noAccount.title', 'co.noAccount.text',
        h('a', { class: 'ads-btn ads-btn--primary', href: '#/settings' }, t('nav.settings')), { name: bizName(ctx.business) })]), 'wiz.title');
    }
    if (!wizard || wizard.business !== ctx.business) wizard = newWizard();
    var w = wizard, L = settings.limits, live = liveMode();
    var body = h('div', {}, skeleton(4));
    Promise.all([api.listPosts({ business: ctx.business }), api.listImages(ctx.business)]).then(function (res) {
      if (stale(tok)) return;
      draw(res[0], cacheImages(res[1]));
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
                h('p', {}, companyErrText(err && err.code) || (err && err.message) || t('wiz.posts.error')),
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
          if (chosen) { w.caption = chosen.caption; cap.value = chosen.caption; risk.update(chosen.caption); if (chosen.imageIds && chosen.imageIds.length) { w.imageIds = chosen.imageIds.slice(); draw(posts, images); } }
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
    var viewSw = h('div', { class: 'ads-chips', role: 'group', 'aria-label': t('posts.view') }, ['list', 'calendar', 'facebook'].map(function (v) {
      return h('button', { type: 'button', class: 'ads-filter', 'aria-pressed': String(postsView === v), onclick: function () { postsView = v; refresh(); } }, t('posts.' + v));
    }));
    render(h('div', {}, [pageHead('nav.posts', [h('a', { class: 'ads-btn ads-btn--primary', href: '#/posts/new', onclick: function () { composerPrefill = null; } }, t('posts.new'))]),
      h('div', { class: 'ads-filters' }, [viewSw, chipsBox]), body]), 'nav.posts');

    chipsBox.hidden = postsView === 'facebook';
    function load() {
      if (postsView === 'facebook') return fbPosts();
      Promise.all([api.listPosts({ business: ctx.business }), api.listProducts(ctx.business)]).then(function (res) {
        if (stale(tok)) return;
        var posts = res[0].filter(function (p) { return postsFilter === 'all' || p.status === postsFilter; });
        body.innerHTML = '';
        if (!posts.length) { body.appendChild(emptyState('posts.emptyTitle', 'posts.emptyText')); return; }
        body.appendChild(postsView === 'calendar' ? calendar(posts) : list(posts, res[1]));
      }).catch(function () { if (!stale(tok)) { body.innerHTML = ''; body.appendChild(errorState(load)); } });
    }
    // The company's Facebook Page posts as Facebook shows them (live: Edge Function ads-list-posts). Numbers
    // and campaign results come with the history import (plan ADS-46), then the AI can review them.
    function fbPosts() {
      body.innerHTML = '';
      if (!liveMode()) { body.appendChild(emptyState('posts.fb.mockTitle', 'posts.fb.mockText')); return; }
      body.appendChild(skeleton(3));
      api.listPagePosts(ctx.business).then(function (list) {
        if (stale(tok)) return;
        body.innerHTML = '';
        body.appendChild(h('p', { class: 'ads-note' }, t('posts.fb.note')));
        if (!list.length) { body.appendChild(emptyState('posts.fb.emptyTitle', 'posts.fb.emptyText')); return; }
        body.appendChild(h('ul', { class: 'ads-fbposts' }, list.map(function (x) {
          return h('li', { class: 'ads-fbpost' }, [
            x.picture ? h('img', { class: 'ads-fbpost__img', src: x.picture, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : h('span', { class: 'ads-fbpost__img ads-img-empty' }, t('common.noImage')),
            h('div', { class: 'ads-fbpost__body' }, [
              h('p', { class: 'ads-fbpost__text' }, x.message || t('posts.fb.noText')),
              h('p', { class: 'ads-sub' }, x.created_time ? fmtDateTime(x.created_time) : ''),
              x.permalink_url ? h('a', { class: 'ads-btn ads-btn--ghost ads-btn--small', href: x.permalink_url, target: '_blank', rel: 'noopener' }, t('posts.fb.open')) : null
            ])
          ]);
        })));
      }, function (e) {
        if (stale(tok)) return;
        body.innerHTML = '';
        var why = companyErrText(e && e.code) || (e && e.message) || '';
        body.appendChild(h('p', { class: 'ads-warn', role: 'alert' }, t('posts.fb.failed') + (why ? ' ' + why : '')));
      });
    }
    function list(posts, products) {
      var byId = {};
      products.forEach(function (x) { byId[x.id] = x; });
      return h('ul', { class: 'ads-postlist' }, posts.map(function (p) {
        var prods = prodSummary(p.productIds, byId), d = postDate(p);
        return h('li', { class: 'ads-postrow' }, [
          imageEl(p.imageIds[0], 'ads-thumb'),
          h('div', { class: 'ads-postrow__main' }, [
            h('a', { class: 'ads-link ads-postrow__cap', href: '#/posts/' + p.id, onclick: function () { composerPrefill = null; } }, p.caption || t('posts.noCaption')),
            h('span', { class: 'ads-sub' }, (prods ? prods + ' - ' : '') + (d ? fmtDateTime(d) : t('posts.noDate')))]),
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

  // Facebook-style preview: the first picture ("+N" when the post has more) and the first product.
  function postPreview(p, prods) {
    var biz = bizName(p.business), ids = p.imageIds || [], first = prods[0] || null;
    return h('div', { class: 'ads-fb' }, [
      h('div', { class: 'ads-fb__head' }, [h('span', { class: 'ads-fb__avatar', 'aria-hidden': 'true' }, biz.charAt(0)), h('span', {}, [h('strong', {}, biz), h('span', { class: 'ads-sub' }, t('prev.meta'))])]),
      h('p', { class: 'ads-fb__text' }, p.caption || t('prev.empty')),
      h('div', { class: 'ads-fb__media' }, [imageEl(ids[0], 'ads-fb__img'),
        ids.length > 1 ? h('span', { class: 'ads-fb__more' }, ['+' + (ids.length - 1), h('span', { class: 'visually-hidden' }, ' ' + t('pp.img.more'))]) : null]),
      first ? h('div', { class: 'ads-fb__prod' }, [h('span', {}, prodName(first) + (prods.length > 1 ? ' +' + (prods.length - 1) : '')),
        prods.length === 1 && first.price != null ? h('strong', {}, gel(first.price)) : null]) : null,
      h('div', { class: 'ads-fb__actions', 'aria-hidden': 'true' }, ['\u{1F44D} ' + t('prev.like'), t('prev.comment'), t('prev.share')])
    ]);
  }

  // "Georgian template" with the chosen products. One product: {product} and {price} filled in.
  // Several: the sentence(s) holding {product} / {price} become a list, one line per product:
  // "• name — price ₾" ("___" when there is no price).
  function fillTemplate(tpl, prods) {
    if (prods.length === 1) return tpl.replace('{product}', kaName(prods[0])).replace('{price}', priceText(prods[0].price));
    var list = prods.map(function (p) { return '• ' + kaName(p) + ' — ' + priceText(p.price) + ' ₾'; }).join('\n');
    var a = -1, z = -1;
    ['{product}', '{price}'].forEach(function (k) {
      var i = tpl.indexOf(k), j = tpl.lastIndexOf(k);
      if (i !== -1 && (a === -1 || i < a)) a = i;
      if (j !== -1 && j + k.length > z) z = j + k.length;
    });
    if (a === -1) return tpl + '\n' + list;
    var ends = '.!?', start = a, end = z;
    while (start > 0 && ends.indexOf(tpl.charAt(start - 1)) === -1) start--;
    while (end < tpl.length && ends.indexOf(tpl.charAt(end)) === -1) end++;
    if (end < tpl.length) end++; // the sentence's own full stop goes with it
    return [tpl.slice(0, start).trim(), list, tpl.slice(end).trim()].filter(Boolean).join('\n');
  }

  /* Composer pickers (6 Nov 2026). Products: chips for the chosen ones, a search box and at most
     PICK_SHOW matching products as checkboxes. The stock can hold thousands of rows, so a key press
     only filters a prepared list of names and draws at most PICK_SHOW rows. */
  var PICK_SHOW = 50;
  function productPicker(post, products, byId, editable, onChange) {
    var max = api.postRules.maxProducts, boxes = [], timer = null, q = null, status = null, list = null, keys = null;
    var chipList = h('ul', { class: 'ads-pp__chips', 'aria-label': t('pp.chosen') });
    var none = h('p', { class: 'ads-note ads-pp__none' }, t('pp.none'));
    var hint = h('p', { class: 'ads-hint', id: 'ads-pp-hint' });
    var fs = h('fieldset', { class: 'ads-fieldset ads-pp' }, [h('legend', { class: 'ads-label' }, t('pp.label')), none, chipList]);
    if (editable) {
      // One search text per product: stock, Georgian, English and display names.
      keys = products.map(function (p) { return normName([p.name, p.name_ka, p.name_en, p.displayName, p.nameEn].join('\u0001')); });
      q = h('input', { type: 'search', id: 'ads-pp-q', class: 'ads-input', placeholder: t('pp.search'), autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'ads-pp-hint', 'aria-controls': 'ads-pp-list' });
      status = h('p', { class: 'ads-note ads-status', 'aria-live': 'polite' });
      list = h('ul', { class: 'ads-pp__list', id: 'ads-pp-list', 'aria-label': t('pp.results') });
      q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(fill, 120); });
      append(fs, [hint, h('label', { class: 'visually-hidden', for: 'ads-pp-q' }, t('pp.search')), h('div', { class: 'ads-search' }, q), status, list]);
    }
    drawChips();
    if (editable) fill();
    return fs;

    function drawChips() {
      chipList.innerHTML = '';
      post.productIds.forEach(function (pid, i) {
        var p = byId[pid], name = p ? prodName(p) : t('pp.unknown');
        chipList.appendChild(h('li', { class: 'ads-pp__chip' }, [
          h('span', { class: 'ads-pp__chipname' }, name + (p && p.price != null ? ' — ' + gel(p.price) : '')),
          editable ? h('button', { type: 'button', class: 'ads-pp__x', 'aria-label': t('pp.remove', { name: name }), onclick: function () { toggle(pid, false); focusAfter(i); } }, '✕') : null
        ]));
      });
      none.hidden = !!post.productIds.length;
      chipList.hidden = !post.productIds.length;
      if (editable) hint.textContent = t('pp.count', { n: post.productIds.length, max: max }) + (post.productIds.length >= max ? ' ' + t('pp.full') : '');
    }
    // After a chip is removed: the next chip's button, else the search box.
    function focusAfter(i) {
      var b = chipList.querySelectorAll('.ads-pp__x');
      (b[Math.min(i, b.length - 1)] || q).focus();
    }
    function toggle(pid, on) {
      var i = post.productIds.indexOf(pid);
      if (on && i === -1) {
        if (post.productIds.length >= max) { toast(t('pp.max', { max: max }), 'act'); sync(); return; }
        post.productIds.push(pid);
      } else if (!on && i !== -1) post.productIds.splice(i, 1);
      drawChips(); sync(); onChange();
    }
    function sync() {
      var full = post.productIds.length >= max;
      boxes.forEach(function (cb) { cb.checked = post.productIds.indexOf(cb.value) !== -1; cb.disabled = full && !cb.checked; });
    }
    function fill() {
      var s = normName(q.value), hits = [];
      for (var i = 0; i < products.length; i++) if (!s || keys[i].indexOf(s) !== -1) hits.push(products[i]);
      list.innerHTML = ''; boxes = [];
      hits.slice(0, PICK_SHOW).forEach(function (p) { list.appendChild(option(p)); });
      list.hidden = !hits.length;
      status.textContent = !products.length ? t('comp.noProducts') : !hits.length ? t('pp.noMatch', { q: q.value.trim() })
        : hits.length > PICK_SHOW ? t('pp.showing', { shown: PICK_SHOW, n: num(hits.length) }) : '';
      sync();
    }
    function option(p) {
      var id = 'ads-pp-' + p.id, ph = photoOf(p), meta = [];
      var cb = h('input', { type: 'checkbox', id: id, value: p.id });
      cb.addEventListener('change', function () { toggle(p.id, cb.checked); });
      boxes.push(cb);
      if (p.price != null) meta.push(gel(p.price));
      if (p.quantity === 0) meta.push(pill(t('stock.out'), 'out'));
      else if (p.quantity != null) meta.push(t('pp.qty', { n: qty(p.quantity) }));
      return h('li', {}, h('label', { class: 'ads-pp__opt', for: id }, [
        cb,
        ph ? h('img', { class: 'ads-pp__img', src: imageUri(ph), alt: '', loading: 'lazy' }) : h('span', { class: 'ads-pp__img', 'aria-hidden': 'true' }),
        h('span', { class: 'ads-pp__text' }, [
          h('span', { class: 'ads-pp__name' }, prodName(p)),
          p.displayName && p.displayName !== p.name ? h('span', { class: 'ads-sub' }, p.name) : null,
          meta.length ? h('span', { class: 'ads-pp__meta' }, meta.reduce(function (a, m, k) { return a.concat(k ? [' · ', m] : [m]); }, [])) : null
        ])
      ]));
    }
  }
  // Pictures: checkboxes, at most maxImages; the order of ticking is the order in the post (shown as a number).
  function picturePicker(post, images, editable, onChange) {
    var max = api.postRules.maxImages, boxes = [];
    var hint = h('p', { class: 'ads-hint', id: 'ads-pi-hint' });
    var grid = h('div', { class: 'ads-imggrid' });
    var fs = h('fieldset', { class: 'ads-fieldset', disabled: !editable, 'aria-describedby': 'ads-pi-hint' }, [h('legend', { class: 'ads-label' }, t('wiz.images')), hint, grid]);
    function draw() {
      var known = {};
      grid.innerHTML = ''; boxes = [];
      images.forEach(function (im) { known[im.id] = true; add(im.id, lname(im, 'title')); });
      // Chosen pictures that are no longer in the library stay listed, so they can be unticked.
      post.imageIds.forEach(function (x) { if (!known[x]) add(x, t('pp.img.missing')); });
      sync();
    }
    function add(id, title) {
      var cb = h('input', { type: 'checkbox', id: 'ads-pimg-' + id, value: id });
      cb.addEventListener('change', function () { toggle(id, cb.checked); });
      var n = h('span', { class: 'ads-imgpick__n', 'aria-hidden': 'true' });
      boxes.push({ cb: cb, n: n });
      grid.appendChild(h('label', { class: 'ads-imgpick', for: 'ads-pimg-' + id }, [cb, n, imageEl(id, 'ads-imgpick__img'), h('span', { class: 'ads-imgpick__cap' }, title)]));
    }
    function toggle(id, on) {
      var i = post.imageIds.indexOf(id);
      if (on && i === -1) {
        if (post.imageIds.length >= max) { toast(t('pp.img.max', { max: max }), 'act'); sync(); return; }
        post.imageIds.push(id);
      } else if (!on && i !== -1) post.imageIds.splice(i, 1);
      sync(); onChange();
    }
    function sync() {
      var full = post.imageIds.length >= max;
      boxes.forEach(function (b) {
        var i = post.imageIds.indexOf(b.cb.value);
        b.cb.checked = i !== -1; b.cb.disabled = !editable || (full && i === -1);
        b.n.textContent = i === -1 ? '' : String(i + 1);
      });
      hint.textContent = t('pp.img.count', { n: post.imageIds.length, max: max });
    }
    draw();
    return { el: fs, redraw: draw };
  }

  function viewComposer(tok, id) {
    var isNew = id === 'new';
    var body = h('div', {}, skeleton(5));
    render(h('div', {}, [pageHead('comp.title', [h('a', { class: 'ads-btn ads-btn--ghost', href: '#/posts' }, t('comp.back'))]), body]), 'comp.title');
    Promise.all([isNew ? Promise.resolve(null) : api.getPost(id), api.listProducts(ctx.business), api.listImages(ctx.business)]).then(function (res) {
      if (stale(tok)) return;
      var post = res[0] || Object.assign({ id: null, business: ctx.business, status: 'draft', productIds: [], caption: '', imageIds: [] }, composerPrefill || {});
      post.productIds = (post.productIds || []).slice(); post.imageIds = (post.imageIds || []).slice();
      draw(post, res[1], cacheImages(res[2]));
      composerPrefill = null;
    }).catch(function () { if (!stale(tok)) { body.innerHTML = ''; body.appendChild(errorState(refresh)); } });

    function draw(post, products, images) {
      body.innerHTML = '';
      var editable = post.status === 'draft', soft = settings.limits.captionSoftLimit;
      var byId = {};
      products.forEach(function (x) { byId[x.id] = x; });
      var risk = riskBox(), prevBox = h('div', {}), count = h('p', { class: 'ads-hint', id: 'ads-p-count' });
      // Stock products may have no price; prices are lari. The generator lists the chosen products too.
      var prodPick = productPicker(post, products, byId, editable, function () { upd(); if (gen) gen.update(); });
      var imgPick = picturePicker(post, images, editable, upd);
      var gen = editable ? postPictureCard(tok, post, byId, addPictures) : null;
      var cap = h('textarea', { id: 'ads-p-caption', class: 'ads-input ads-textarea', rows: '6', 'aria-describedby': 'ads-p-count' }, post.caption);
      if (!editable) cap.disabled = true;
      cap.addEventListener('input', function () { post.caption = cap.value; upd(); });
      // Post goal (13 Nov 2026): the goal's Georgian template writes the draft today; the AI writes it later
      // from the goal's description (ADS-08 / plan ADS-45). The goal stays with the post.
      var goalHint = h('p', { class: 'ads-hint', id: 'ads-p-goal-hint' });
      var goalSel = select('ads-p-goal', [['', t('comp.goal.none')]].concat(goalsCache.map(function (g) { return [g.id, g.id + ' · ' + goalName(g)]; })), post.goalId || '', function (v) {
        post.goalId = v || null; showGoal(); upd();
      });
      goalSel.disabled = !editable;
      goalSel.setAttribute('aria-describedby', 'ads-p-goal-hint');
      function showGoal() {
        var g = goalsCache.filter(function (x) { return x.id === post.goalId; })[0];
        goalHint.textContent = g ? g.description : t('comp.goal.hint');
        tplBtn.textContent = t(g ? 'comp.goal.write' : 'comp.template');
      }
      var tplBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', disabled: !editable, onclick: function () {
        var chosen = curProducts(), list = chosen.length ? chosen : products.slice(0, 1);
        if (!list.length) { toast(t('comp.noProducts'), 'act'); return; }
        var goal = goalsCache.filter(function (x) { return x.id === post.goalId; })[0];
        var tpl = goal && goal.template_ka ? goal.template_ka : settings.georgianTemplates[Math.floor(Math.random() * settings.georgianTemplates.length)];
        var txt = fillTemplate(tpl, list);
        post.caption = (cap.value ? cap.value + '\n' : '') + txt; cap.value = post.caption; upd(); cap.focus();
      } }, t('comp.template'));
      showGoal();
      function curProducts() { return post.productIds.map(function (x) { return byId[x]; }).filter(Boolean); }
      // Finished post pictures join the post in product order, up to the limit. Returns how many fit.
      function addPictures(list) {
        var room = api.postRules.maxImages - post.imageIds.length, added = 0;
        list.forEach(function (im) {
          if (!images.some(function (x) { return x.id === im.id; })) images.unshift(im);
          if (added < room && post.imageIds.indexOf(im.id) === -1) { post.imageIds.push(im.id); added++; }
        });
        imgPick.redraw(); upd();
        return added;
      }
      function upd() {
        risk.update(post.caption);
        count.textContent = t('comp.count', { n: post.caption.length, max: soft });
        count.className = 'ads-hint' + (post.caption.length > soft ? ' ads-hint--warn' : '');
        prevBox.innerHTML = ''; prevBox.appendChild(postPreview(post, curProducts()));
      }
      // Dialog with the EXACT content, for Approve / Publish / Schedule.
      function contentDialog(titleKey, confirmKey, withDate) {
        var risks = api.findRisks(post.caption), dt = null, ack = null;
        var kids = [h('p', { class: 'ads-warn' }, t(titleKey + '.warn')), postPreview(post, curProducts()), h('p', { class: 'ads-total' }, t('comp.cost'))];
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
      function saveCurrent() { return api.savePost({ id: post.id, business: post.business, productIds: post.productIds, caption: post.caption, imageIds: post.imageIds, goalId: post.goalId || null }); }
      function guard() { if (!post.caption.trim()) { toast(t('err.caption'), 'act'); cap.focus(); return false; } return true; }
      function fail(e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); }
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
        prodPick, imgPick.el, gen ? gen.el : null,
        h('div', { class: 'ads-field' }, [h('label', { class: 'ads-label', for: 'ads-p-goal' }, t('comp.goal')), goalSel, goalHint]),
        h('div', { class: 'ads-field' }, [h('label', { class: 'ads-label', for: 'ads-p-caption' }, t('wiz.caption')), cap, count, tplBtn]),
        h('h3', { class: 'ads-h3' }, t('policy.title')), risk,
        h('div', { class: 'ads-btnrow' }, actions)
      ]);
      body.appendChild(h('div', { class: 'ads-compose' }, [form, h('div', { class: 'ads-card ads-compose__prev', 'aria-label': t('comp.preview') }, [h('h2', { class: 'ads-h2' }, t('comp.preview')), prevBox])]));
      upd();
    }
  }

  /* ---------------------------------------------------------------------
     8b. Post pictures with AI (live only, 6 Nov 2026). One picture per chosen product: its photo
         plus one option of every style group (Picture styles: e.g. a frame, a price tag, a
         background), made one after the other by ads-generate-image. In overlay mode the browser
         then writes the exact Georgian name on a copy, because Gemini misspells Georgian.
     --------------------------------------------------------------------- */
  var genLast = { picks: {}, mode: 'overlay', quality: 'standard' }; // picks: group id -> option id; the card opens with the last choices
  var genJob = null;  // a run in progress: { tok, n, total }. One at a time; it keeps going when the post is left.
  var genView = null; // the generator card on screen: { tok, status, refresh }
  var GEN_MAX_REFS = 6; // product photo + the chosen options' pictures (the Edge Function's limit)
  // After these errors the next products would fail the same way, so the run stops.
  var GEN_STOP = ['daily_limit', 'not_deployed', 'no_gemini_key', 'gemini_key', 'no_openai_key', 'openai_key', 'openai_verify', 'openai_quota',
    'not_member', 'not_allowed', 'no_token', 'bad_token', 'network'];
  var NAME_ZONE = 0.15, NAME_PAD = 0.06, NAME_COLOR = '#3E5C3A', NAME_FONT = '"Noto Sans Georgian", "Noto Sans", sans-serif';

  // The prompt for one product, exactly like the owner's Excel formula: the template, then every
  // group's {TOKEN} (group order) gets the chosen option's prompt, then {TEXT} and {RULES}, then
  // {NAME} {KA} {TYPE} {PRICE} (also inside those parts). Every occurrence, in this order.
  // ps: the prompt template; chosen: [{ group, option or null }] in group order.
  function assemblePrompt(ps, chosen, p, mode) {
    function all(s, token, value) { return s.split(token).join(value == null ? '' : String(value)); }
    var s = String(ps.template || '');
    chosen.forEach(function (c) { s = all(s, '{' + c.group.token + '}', c.option ? c.option.prompt : ''); });
    s = all(s, '{TEXT}', mode === 'ai' ? ps.textAi : ps.textOverlay);
    s = all(s, '{RULES}', ps.rules);
    s = all(s, '{NAME}', p.nameEn || p.displayName || p.name);
    s = all(s, '{KA}', kaName(p));
    s = all(s, '{TYPE}', p.aiNote || 'product package');
    s = all(s, '{PRICE}', priceText(p.price)); // whole number without decimals, else 2 decimals; ___ when none
    return s;
  }

  function genSync() {
    if (!genView || stale(genView.tok)) return;
    genView.status.textContent = genJob ? t('gen.progress', { n: genJob.n, total: genJob.total }) : '';
    genView.refresh();
  }

  // The card in the composer (drafts only). addPictures(list) puts finished pictures into the post.
  function postPictureCard(tok, post, byId, addPictures) {
    var card = h('section', { class: 'ads-gen', 'aria-labelledby': 'ads-gen-h' }, h('h3', { class: 'ads-h3 ads-gen__title', id: 'ads-gen-h' }, t('gen.title')));
    var out = { el: card, update: function () {} };
    if (!liveMode()) { card.appendChild(h('p', { class: 'ads-note' }, t('gen.mock'))); return out; }
    var inner = h('div', {}, h('p', { class: 'ads-note' }, t('gen.loading')));
    card.appendChild(inner);
    var ps = null, groups = [], styles = [], ready = false, noMaker = false;
    var prodList, makeBtn, status, promptBox, promptHint, promptLabel;
    Promise.all([api.getPictureSettings(post.business), api.listStyleGroups(post.business), api.listStyles(post.business)]).then(function (r) {
      if (stale(tok)) return;
      ps = r[0]; groups = r[1]; styles = r[2];
      cacheImages(styles.map(function (s) { return s.image; }).filter(Boolean));
      build();
    }).catch(function (e) {
      if (stale(tok)) return;
      inner.innerHTML = '';
      inner.appendChild(h('p', { class: 'ads-warn' }, errText(e) || t('common.errorText')));
    });
    out.update = function () { if (ready) refresh(); };
    return out;

    function build() {
      inner.innerHTML = '';
      if (!ps || !ps.template.trim()) {
        inner.appendChild(h('p', { class: 'ads-note' }, [t('gen.noTemplate') + ' ', h('a', { class: 'ads-link', href: '#/styles' }, t('gen.toStyles'))]));
        return;
      }
      // One select per group that has active options, in group order; the label is the group's name.
      var row = h('div', { class: 'ads-row ads-row--3' });
      groups.forEach(function (g, i) {
        var act = styles.filter(function (s) { return s.groupId === g.id && s.active; });
        if (!act.length) return;
        if (!act.some(function (s) { return s.id === genLast.picks[g.id]; })) genLast.picks[g.id] = act[0].id;
        var id = 'ads-gen-g' + i;
        row.appendChild(h('div', { class: 'ads-field' }, [h('label', { class: 'ads-label', for: id }, g.name),
          select(id, act.map(function (s) { return [s.id, s.code + ' — ' + s.name]; }), genLast.picks[g.id], function (v) { genLast.picks[g.id] = v; refresh(); })]));
      });
      var mode = radioGroup('ads-gen-mode', 'gen.text', [['overlay', 'gen.text.overlay', 'gen.text.overlay.d'], ['ai', 'gen.text.ai', 'gen.text.ai.d']],
        genLast.mode, function (v) { genLast.mode = v; refresh(); });
      var quality = radioGroup('ads-gen-q', 'aimg.quality', [['standard', 'aimg.q.standard', 'aimg.q.standard.d'], ['high', 'aimg.q.high', 'aimg.q.high.d']],
        genLast.quality, function (v) { genLast.quality = v; });
      // Picture maker (owner D-68): Gemini or ChatGPT; only makers with a working agency key can be chosen.
      genLast.maker = genLast.maker || lastMaker();
      var makers = makerField('ads-gen-mk', genLast.maker, function (m) { genLast.maker = m; });
      api.aiImageStatus(post.business).then(function (r) {
        if (stale(tok)) return;
        genLast.maker = makers.setReady(r.makers) || genLast.maker;
        noMaker = !makers.anyReady();
        if (noMaker) status.textContent = t('aimg.maker.none');
        refresh();
      }, function () { /* the server answers again when the pictures are made */ });
      prodList = h('ul', { class: 'ads-gen__prods', 'aria-labelledby': 'ads-gen-prods' });
      makeBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: run });
      status = h('p', { class: 'ads-note ads-status', 'aria-live': 'polite' });
      promptLabel = h('label', { class: 'ads-label', for: 'ads-gen-prompt' });
      promptBox = h('textarea', { id: 'ads-gen-prompt', class: 'ads-input ads-textarea ads-prompt', rows: '8', readonly: true, spellcheck: 'false', 'aria-describedby': 'ads-gen-prompt-n' });
      promptHint = h('p', { class: 'ads-hint', id: 'ads-gen-prompt-n' });
      append(inner, [
        h('p', { class: 'ads-note' }, t('gen.intro')), row, mode, makers, quality,
        h('p', { class: 'ads-label', id: 'ads-gen-prods' }, t('gen.prods')), prodList,
        h('div', { class: 'ads-btnrow' }, makeBtn), status,
        h('details', { class: 'ads-details ads-gen__prompt' }, [h('summary', {}, t('gen.showPrompt')), promptLabel, promptBox, promptHint,
          h('div', { class: 'ads-btnrow' }, h('button', { type: 'button', class: 'ads-btn ads-btn--ghost ads-btn--small', onclick: function () { copyText(promptBox); } }, t('gen.copy')))])
      ]);
      ready = true;
      genView = { tok: tok, status: status, refresh: refresh };
      genSync(); // a run that is still going (the post was left and opened again) shows its progress
      refresh();
    }
    // [{ group, option }] in group order; option is null for a group without active options.
    function picks() {
      var by = {};
      styles.forEach(function (s) { by[s.id] = s; });
      return groups.map(function (g) {
        var o = by[genLast.picks[g.id]];
        return { group: g, option: o && o.groupId === g.id && o.active ? o : null };
      });
    }
    function chosen() { return post.productIds.map(function (x) { return byId[x]; }).filter(Boolean); }
    function refresh() {
      var list = chosen(), ok = list.filter(photoOf), first = list[0];
      prodList.innerHTML = '';
      if (!list.length) prodList.appendChild(h('li', { class: 'ads-note' }, t('gen.noProducts')));
      list.forEach(function (p) {
        var ph = photoOf(p);
        prodList.appendChild(h('li', { class: 'ads-gen__prod' }, [
          ph ? h('img', { class: 'ads-gen__img', src: imageUri(ph), alt: '', loading: 'lazy' }) : h('span', { class: 'ads-gen__img', 'aria-hidden': 'true' }),
          h('span', { class: 'ads-gen__text' }, [h('span', { class: 'ads-gen__name' }, prodName(p)), ph ? null : h('span', { class: 'ads-sub ads-sub--act' }, t('gen.noPhoto'))])
        ]));
      });
      makeBtn.textContent = ok.length === 1 ? t('gen.makeOne') : t('gen.make', { n: ok.length });
      makeBtn.disabled = !ok.length || !!genJob || noMaker;
      promptLabel.textContent = first ? t('gen.promptFor', { name: prodName(first) }) : t('gen.showPrompt');
      promptBox.value = first ? assemblePrompt(ps, picks(), first, genLast.mode) : '';
      promptHint.textContent = first ? t('gen.chars', { n: num(promptBox.value.length) }) : t('gen.noProducts');
    }
    function run() {
      if (genJob) { toast(t('gen.busy'), 'act'); return; }
      var list = chosen().filter(photoOf);
      if (!list.length) return;
      var set = ps, pk = picks(), o = { mode: genLast.mode, quality: genLast.quality, aspect: ps.aspect || '3:4', maker: genLast.maker || lastMaker() };
      var made = [], failed = [], plain = [], notTried = [];
      genJob = { tok: tok, n: 1, total: list.length };
      toast(t('gen.started'));
      genSync();
      function step(i) {
        if (i >= list.length) return finish();
        genJob.n = i + 1; genSync();
        var p = list[i];
        return makePostPicture(post.business, set, pk, p, o).then(function (r) {
          made.push(r.image);
          if (r.plain) plain.push(prodName(p));
          return step(i + 1);
        }, function (e) {
          failed.push([prodName(p), aiErrText(e)]);
          if (e && (e.key || GEN_STOP.indexOf(e.code) !== -1)) { notTried = list.slice(i + 1).map(prodName); return finish(); }
          return step(i + 1);
        });
      }
      function finish() {
        var job = genJob, added = 0;
        genJob = null;
        if (made.length && !stale(job.tok)) added = addPictures(made);
        genSync();
        if (made.length && stale(job.tok)) toast(t('gen.left', { n: made.length }));
        else if (made.length) {
          toast(added === 1 ? t('gen.addedOne') : t('gen.added', { n: added }));
          if (added < made.length) toast(t('gen.full', { n: made.length - added, max: api.postRules.maxImages }), 'act');
        }
        if (failed.length || plain.length) genProblems(failed, plain, notTried, made.length);
      }
      step(0);
    }
  }
  // What did not work, per product, at the end of a run.
  function genProblems(failed, plain, notTried, made) {
    var kids = [];
    if (!made) kids.push(h('p', {}, h('strong', {}, t('gen.res.none'))));
    if (failed.length) {
      kids.push(h('p', {}, t('gen.res.failed')), h('ul', { class: 'ads-issues' }, failed.map(function (f) { return h('li', {}, [h('strong', {}, f[0] + ':'), ' ', f[1]]); })));
    }
    if (notTried.length) kids.push(h('p', {}, t('gen.res.stopped')), h('ul', { class: 'ads-issues ads-issues--watch' }, notTried.map(function (n) { return h('li', {}, n); })));
    if (plain.length) kids.push(h('p', {}, t('gen.res.overlay')), h('ul', { class: 'ads-issues ads-issues--watch' }, plain.map(function (n) { return h('li', {}, n); })));
    openDialog({ title: t('gen.res.title'), body: h('div', {}, kids), noCancel: true, actions: [{ label: t('common.close'), value: true }] });
  }
  // One post picture. chosen: [{ group, option }] (see picks()). Resolves { image: the picture for the
  // post, plain: true when the name could not be written (the AI picture is used then; it always stays
  // in the library too) }.
  function makePostPicture(biz, ps, chosen, p, o) {
    var refs = [], name = kaName(p), opts = chosen.filter(function (c) { return c.option; });
    // Reference pictures: the product photo, then the chosen options' pictures; a picture listed twice
    // is refused by the server, so each goes in once; at most GEN_MAX_REFS.
    [p.imageId].concat(opts.map(function (c) { return c.option.imageId; })).forEach(function (x) { if (x && refs.indexOf(x) === -1) refs.push(x); });
    var codes = opts.map(function (c) { return c.option.code; }).join('/') || '-';
    // The name is written in the colour of the chosen option of the name-colour group; without one
    // (the default) the colour follows the banner in the finished picture (see autoNameColor).
    var nc = opts.filter(function (c) { return c.group.nameColor; })[0];
    var color = nc && /^#[0-9a-f]{6}$/i.test(nc.option.textColor || '') ? nc.option.textColor : null;
    return roomForAi().then(function () {
      return api.generateImage(biz, { prompt: assemblePrompt(ps, chosen, p, o.mode), aspect: o.aspect, quality: o.quality, maker: o.maker, refs: refs.slice(0, GEN_MAX_REFS), title: 'Post: ' + name + ' · ' + codes });
    }).then(function (r) {
      cacheImages([r.image]);
      if (o.mode !== 'overlay') return { image: r.image, plain: false };
      return nameOnPicture(r.image, name, color).then(function (file) {
        return api.uploadImage(biz, file, { folder: 'ai', source: 'ai' }, { title: 'Post picture: ' + name });
      }).then(function (im) { cacheImages([im]); return { image: im, plain: false }; },
        function () { return { image: r.image, plain: true }; });
    });
  }
  // The AI picture with the name written in the NAME ZONE (top 15 % of the height, full width, 6 %
  // side padding): fetched as a blob, drawn on a canvas of the same size, saved as JPEG (0.92).
  function nameOnPicture(im, text, color) {
    if (!im.url) return Promise.reject(new Error('no address'));
    var font = document.fonts && document.fonts.load
      ? document.fonts.load('600 48px "Noto Sans Georgian"', text).catch(function () { return null; }) : Promise.resolve(null);
    return fetch(im.url).then(function (r) {
      if (!r.ok) throw new Error('fetch ' + r.status);
      return r.blob();
    }).then(function (blob) { return Promise.all([decodePicture(blob), font]); }).then(function (res) {
      var pic = res[0], c = document.createElement('canvas');
      c.width = pic.width; c.height = pic.height;
      var g = c.getContext('2d');
      g.drawImage(pic.source, 0, 0, pic.width, pic.height);
      pic.done();
      drawName(g, text, pic.width, pic.height, color || autoNameColor(g, pic.width, pic.height));
      return new Promise(function (resolve, reject) {
        c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('jpeg')); }, 'image/jpeg', 0.92);
      });
    }).then(function (blob) {
      return new File([blob], 'post-picture.jpg', { type: 'image/jpeg' });
    });
  }
  function decodePicture(blob) {
    if (window.createImageBitmap) {
      return createImageBitmap(blob).then(function (b) { return { source: b, width: b.width, height: b.height, done: function () { if (b.close) b.close(); } }; });
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, done: function () { URL.revokeObjectURL(url); } }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  // Automatic name colour: the average brightness of the NAME ZONE of the picture as made by the AI.
  // A dark banner (green or navy panel) gets white, a light one (off-white banner) the deep green.
  function autoNameColor(g, W, H) {
    try {
      var zoneH = Math.max(1, Math.round(H * NAME_ZONE)), d = g.getImageData(0, 0, W, zoneH).data, sum = 0, n = 0;
      for (var i = 0; i < d.length; i += 16) { sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; } // every 4th pixel
      return n && sum / n / 255 < 0.5 ? '#FFFFFF' : NAME_COLOR;
    } catch (e) { return NAME_COLOR; }
  }
  // The largest Noto Sans Georgian 600 size that fits the zone in at most 2 lines, centred, in the
  // frame's colour with a soft outline + shadow in a contrasting colour.
  function drawName(g, text, W, H, color) {
    var zoneH = H * NAME_ZONE, maxW = W * (1 - 2 * NAME_PAD), LH = 1.2;
    var words = String(text).replace(/\s+/g, ' ').trim().split(' ');
    function setFont(px) { g.font = '600 ' + px + 'px ' + NAME_FONT; }
    function wrap(px) { // greedy lines; null when one word alone is too wide
      setFont(px);
      var lines = [], line = '';
      for (var i = 0; i < words.length; i++) {
        var next = line ? line + ' ' + words[i] : words[i];
        if (g.measureText(next).width <= maxW) { line = next; continue; }
        if (!line) return null;
        lines.push(line); line = words[i];
        if (g.measureText(line).width > maxW) return null;
      }
      lines.push(line);
      return lines;
    }
    var lo = 8, hi = Math.max(8, Math.floor(zoneH / LH)), best = null;
    while (lo <= hi) {
      var mid = Math.floor((lo + hi) / 2), ls = wrap(mid);
      if (ls && ls.length <= 2 && ls.length * mid * LH <= zoneH) { best = { px: mid, lines: ls }; lo = mid + 1; } else hi = mid - 1;
    }
    if (!best) { // a very long name: two lines, squeezed to the width (fillText's maxWidth)
      var half = Math.ceil(words.length / 2);
      var two = words.length > 1 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [words[0]];
      best = { px: Math.max(8, Math.floor(zoneH / (two.length * LH))), lines: two };
    }
    var m = /^#?([0-9a-f]{6})$/i.exec(color || ''), n = parseInt(m ? m[1] : '3E5C3A', 16);
    var lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    var halo = lum < 0.55 ? 'rgba(255, 255, 255, 0.85)' : 'rgba(20, 33, 61, 0.7)';
    var lh = best.px * LH, top = (zoneH - best.lines.length * lh) / 2;
    setFont(best.px);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    best.lines.forEach(function (line, i) {
      var y = top + lh * (i + 0.5);
      g.save();
      g.shadowColor = halo; g.shadowBlur = best.px * 0.25;
      g.lineJoin = 'round'; g.lineWidth = Math.max(2, best.px * 0.12); g.strokeStyle = halo;
      g.strokeText(line, W / 2, y, maxW);
      g.restore();
      g.fillStyle = color; g.fillText(line, W / 2, y, maxW);
    });
  }
  // Copies a read-only text box: the clipboard API, else select + copy, else the user copies by hand.
  function copyText(ta) {
    function byHand() {
      var ok = false;
      ta.focus(); ta.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      toast(t(ok ? 'gen.copied' : 'gen.copyFail'), ok ? 'ok' : 'act');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { toast(t('gen.copied')); }, byHand);
    else byHand();
  }

  /* ---------------------------------------------------------------------
     9. Image Library (9 Nov 2026, owner request; supabase/0033). Pictures sit in folders, shown as
        tiles (the newest picture as the cover, name, number of pictures, size): Uploads, Elements,
        AI Generated, Products, Archive. A tile (or its shortcut button) opens the folder's pictures
        below the tiles; Elements first shows a line of small buttons for its sub-folders (Price Tag /
        Picture Frame / Picture Background). The tag filter sits right of the shortcuts. Edit ticks pictures to archive, restore or delete them (no Delete button on a card);
        a click on a picture opens its details (facts + tags). Each person may store up to 50 MB.
     --------------------------------------------------------------------- */
  var LIB_FOLDERS = ['uploads', 'elements', 'ai', 'products', 'archive']; // shortcut row + folder list, in order
  var LIB_AI_ROOM = 1.5 * 1048576; // free storage an AI picture needs (they are 0.3-0.7 MB, a post picture twice)
  var libCompany = 'auto'; // Company filter (11 Nov 2026, D-48): 'auto' = the top-bar company, a company id, 'shared' (no company) or 'all'
  var libFolder = 'all';  // shortcut: 'all' or one of LIB_FOLDERS
  var libSub = null;      // inside Elements: the element type on screen ('price_tag' ... 'none'), else null
  var libTags = [];       // tag filter: a picture shows when it has all of these
  var libEdit = false;    // Edit mode
  var libSel = {};        // ticked picture ids (Edit mode), kept across folders
  var libJob = null;  // upload in progress: { n, total }. It keeps going when the user leaves the page.
  var libView = null; // the Library view on screen: { tok, status, load }
  var aiJob = null;   // an AI picture being made: { business }. It also keeps going when the user leaves.

  // Shows the running upload or AI picture (if any) in the Library view that is on screen now.
  function libSync() {
    if (!libView || stale(libView.tok)) return;
    libView.status.textContent = libJob ? t('lib.progress', { n: libJob.n, total: libJob.total }) : aiJob ? t('aimg.working') : '';
  }
  function hasFiles(e) { var ty = e.dataTransfer && e.dataTransfer.types; return !!ty && [].indexOf.call(ty, 'Files') !== -1; }
  // The Company filter as list arguments: b for api.listImages (undefined = every company) and
  // shared = keep only pictures without a company. Without a company 'auto' means shared.
  function libScope() {
    var c = libCompany;
    if (c !== 'auto' && c !== 'shared' && c !== 'all' && !settings.businesses.some(function (b) { return b.id === c; })) c = libCompany = 'auto';
    if (c === 'auto') return hasCompany() ? { b: ctx.business, shared: false } : { b: undefined, shared: true };
    if (c === 'all') return { b: undefined, shared: false };
    if (c === 'shared') return { b: undefined, shared: true };
    return { b: c, shared: false };
  }
  // The company a new picture gets (upload, AI): the filtered company, else the top-bar company;
  // null = shared (sample mode only until ADS-37: the database needs a company today).
  function libTarget() {
    var sc = libScope();
    if (sc.b) return sc.b;
    if (sc.shared && !liveMode()) return null;
    return hasCompany() ? ctx.business : null;
  }
  function coName(id) { return id ? bizName(id) : t('lf.co.shared'); }
  // The folder a picture shows in: the Archive while archived, else its own.
  function libPlace(im) { return im.archivedAt ? 'archive' : im.folder || (im.kind === 'element' ? 'elements' : 'uploads'); }
  // "Elements › Price Tag", "AI Generated" ... (the picture's own folder, also while archived).
  function folderLabel(im) {
    var f = im.folder || 'uploads';
    return t('lf.f.' + f) + (f === 'elements' ? ' › ' + t('lf.el.' + (im.elementType || 'none')) : '');
  }
  // The day an archived picture is deleted for good.
  function purgeDay(im) { return new Date(Date.parse(im.archivedAt) + api.libraryRules.archiveDays * 86400000).toISOString(); }
  function countText(n) { return t(n === 1 ? 'lf.count1' : 'lf.count', { n: num(n) }); }
  // Folder / archive-box icon (inline SVG, hidden from screen readers); size in px, 20 by default.
  function folderIcon(archive, size) {
    var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    [['viewBox', '0 0 24 24'], ['width', String(size || 20)], ['height', String(size || 20)], ['aria-hidden', 'true'], ['focusable', 'false'], ['class', 'ads-ficon']]
      .forEach(function (a) { svg.setAttribute(a[0], a[1]); });
    p.setAttribute('d', archive ? 'M3 4.5h18v4H3zM5 8.5h14V20H5zM10 12h4'
      : 'M3 7a1.5 1.5 0 0 1 1.5-1.5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z');
    [['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.6'], ['stroke-linejoin', 'round'], ['stroke-linecap', 'round']]
      .forEach(function (a) { p.setAttribute(a[0], a[1]); });
    svg.appendChild(p);
    return svg;
  }
  // An AI picture needs free storage: the database refuses to save it when the storage is full, after
  // Gemini has already made (and charged for) it. Resolves when there is room; otherwise rejects with
  // the i18n key lf.err.fullAi. A failed usage read lets it through (the server checks anyway).
  function roomForAi() {
    return api.libraryUsage().then(function (u) {
      if (u.limit - u.used >= LIB_AI_ROOM) return;
      var e = new Error('storage full');
      e.key = 'lf.err.fullAi'; e.vars = { used: fmtBytes(u.used), limit: fmtBytes(u.limit) };
      throw e;
    }, function () { /* unknown: the server still checks */ });
  }
  // Library folder for a style group's pictures: frames, price tags and backgrounds are Elements of
  // that type; another group's pictures follow its "stored as" setting.
  var GROUP_ELEMENT = { FRAME: 'frame', TAG: 'price_tag', BG: 'background' };
  function groupPlace(g) {
    var ty = g && GROUP_ELEMENT[String(g.token || '').toUpperCase()];
    if (ty) return { folder: 'elements', elementType: ty };
    return { folder: g && g.pictureKind === 'element' ? 'elements' : 'uploads' };
  }

  function viewImages(tok) {
    var rules = api.imageRules, lr = api.libraryRules;
    var body = h('div', {}, skeleton(3));
    var status = h('p', { class: 'ads-note ads-status', 'aria-live': 'polite' });
    var storage = h('div', { class: 'ads-storage', hidden: true });
    var usage = null;   // { used, limit } of the signed-in person; null until known
    var all = [];       // the business's pictures (archived ones too), not the samples
    var samples = [];
    var ui = null;      // the parts built once (they keep focus while folders redraw)
    // The native file picker, opened by the Upload button (keyboard users) ...
    var picker = h('input', { type: 'file', multiple: true, accept: rules.accept, hidden: true });
    picker.addEventListener('change', function () { var f = [].slice.call(picker.files || []); picker.value = ''; if (f.length) choose(f); });
    var upBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function () { if (libJob) toast(t('lib.busy'), 'act'); else picker.click(); } }, t('lib.upload'));
    var editBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', 'aria-pressed': String(libEdit), onclick: function () { setEdit(!libEdit); } }, t(libEdit ? 'lf.editDone' : 'lf.edit'));
    // ... and a drop zone for files dragged from the computer.
    var drop = h('div', { class: 'ads-drop' }, [h('p', { class: 'ads-drop__title' }, t('lib.drop')), h('p', { class: 'ads-hint' }, t('lib.rules', { mb: rules.maxMb, max: rules.maxFiles }))]);
    var depth = 0; // dragenter / dragleave also fire for the zone's children
    drop.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); depth++; drop.classList.add('is-over'); });
    drop.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    drop.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove('is-over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); depth = 0; drop.classList.remove('is-over');
      var f = [].slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      if (!f.length) return;
      if (libJob) toast(t('lib.busy'), 'act'); else choose(f);
    });
    render(h('div', {}, [
      pageHead('nav.images', [upBtn, h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { openAiDialog(); } }, t('lib.ai')), editBtn, soonBtn('lib.drive')]),
      liveMode() ? null : h('p', { class: 'ads-warn' }, t('lib.mockNote')),
      libCompanyBar(),
      picker, drop, storage, status, body
    ]), 'nav.images');
    libView = { tok: tok, status: status, load: load };
    libSync();
    load();

    // focus: true = the page heading (the focused card is gone), 'bar' = the Edit bar (its button was
    // switched off while working), a picture id = that picture's card.
    function load(focus) {
      var sc = libScope();
      api.listImages(sc.b, { strict: true, archived: true }).then(function (list) {
        if (stale(tok)) return;
        cacheImages(list);
        if (sc.shared) list = list.filter(function (x) { return !x.sample && !x.business; });
        all = list.filter(function (x) { return !x.sample; });
        samples = list.filter(function (x) { return x.sample; });
        // Ticks of pictures that are gone, and tags nobody carries any more, are dropped.
        Object.keys(libSel).forEach(function (id) { if (!all.some(function (x) { return x.id === id; })) delete libSel[id]; });
        libTags = libTags.filter(function (tag) { return all.some(function (x) { return x.tags.indexOf(tag) !== -1; }); });
        draw();
        var el = focus === 'bar' ? $('.ads-editbar__count', main) : typeof focus === 'string' ? $('.ads-libitem__open[data-id="' + focus + '"]', main) : null;
        if (el) el.focus();
        else if (focus) { var hd = $('.ads-h1', main); if (hd) hd.focus(); }
      }).catch(function () { if (!stale(tok)) { ui = null; body.innerHTML = ''; body.appendChild(errorState(function () { load(); })); } });
      loadUsage();
    }
    function loadUsage() {
      api.libraryUsage().then(function (u) { if (!stale(tok)) { usage = u; drawUsage(); } },
        function () { usage = null; storage.hidden = true; });
    }
    function drawUsage() {
      var pct = Math.min(100, Math.round(usage.used * 100 / Math.max(1, usage.limit)));
      var fill = h('span', { class: 'ads-storage__fill' });
      fill.style.width = pct + '%';
      storage.innerHTML = '';
      storage.hidden = false;
      storage.className = 'ads-storage' + (pct >= 100 ? ' is-full' : pct >= 90 ? ' is-high' : '');
      append(storage, [
        h('span', { class: 'ads-storage__text' }, t('lf.storage', { used: fmtBytes(usage.used), limit: fmtBytes(usage.limit) })),
        h('span', { class: 'ads-storage__bar', 'aria-hidden': 'true' }, fill),
        pct >= 100 ? h('span', { class: 'ads-storage__warn' }, t('lf.storage.full')) : null
      ]);
    }

    // Company filter (D-48): on its own line, always visible (the folder row hides when nothing shows).
    function libCompanyBar() {
      var opts = [['auto', hasCompany() ? t('lf.co.auto', { name: bizName(ctx.business) }) : t('lf.co.autoNone')]];
      settings.businesses.forEach(function (b) { if (b.id !== ctx.business) opts.push([b.id, b.name]); });
      if (!liveMode()) opts.push(['shared', t('lf.co.shared')]);
      opts.push(['all', t('lf.co.all')]);
      var sel = select('ads-lib-co', opts, libCompany, function (v) { libCompany = v; libSel = {}; libFolder = 'all'; libSub = null; ui = null; load(); });
      return h('div', { class: 'ads-cofilter' }, [h('label', { class: 'ads-label', for: 'ads-lib-co' }, t('co.filter')), sel,
        h('p', { class: 'ads-hint' }, t(liveMode() ? 'lf.co.hintLive' : 'lf.co.hint'))]);
    }

    /* ---- the page: shortcut row + tag filter, active tags, Edit bar, folders, samples ---- */
    function draw() {
      if (!ui) build();
      ui.row.hidden = !all.length;
      ui.tags.redraw();
      ui.tags.label();
      syncChips(); // an upload may have opened another folder meanwhile
      fillFolders();
      ui.samples.innerHTML = '';
      if (samples.length) {
        ui.samples.appendChild(h('details', { class: 'ads-details ads-samples' }, [
          h('summary', {}, t('lib.samples', { n: samples.length })),
          h('p', { class: 'ads-note' }, t('lib.samplesNote')),
          h('ul', { class: 'ads-libgrid' }, samples.map(function (im) { return card(im, true); }))
        ]));
      }
    }
    function build() {
      // The shortcut buttons stay in place (and keep focus); only the box below them is redrawn.
      var chips = ['all'].concat(LIB_FOLDERS).map(function (k) {
        return h('button', { type: 'button', class: 'ads-filter', 'data-key': k, 'aria-pressed': String(k === libFolder), onclick: function () {
          libFolder = k; libSub = null; // All closes the open folder
          syncChips();
          fillFolders();
          reveal();
        } }, k === 'all' ? t('common.all') : t('lf.f.' + k));
      });
      var tags = tagFilter();
      ui = {
        row: h('div', { class: 'ads-libbar' }, [h('div', { class: 'ads-chips', role: 'group', 'aria-label': t('lf.show') }, chips), tags.el]),
        chips: chips,
        tags: tags,
        active: h('div', { class: 'ads-libtags', hidden: true }),
        bar: editBar(),
        box: h('div', { class: 'ads-folders' }),
        none: h('p', { class: 'ads-note', hidden: true }, t('lf.noMatch')),
        samples: h('div', {})
      };
      body.innerHTML = '';
      append(body, [ui.row, ui.active, ui.bar.el, ui.box, ui.none, ui.samples]);
    }
    // The pictures that carry every chosen tag.
    function matches(list) {
      if (!libTags.length) return list;
      return list.filter(function (im) { return libTags.every(function (tag) { return im.tags.indexOf(tag) !== -1; }); });
    }
    // The box: one tile per folder (the newest picture as the cover, name, count, size). The open
    // folder's pictures expand below the tiles; a folder with sub-folders shows a line of small
    // sub-folder buttons first, and a sub-folder's pictures expand below that line (owner, 9 Nov 2026).
    // focus: 'tile:<key>' or 'sub:<key>' = the control that was used, back in focus after the redraw.
    function fillFolders(focus) {
      var box = ui.box;
      box.innerHTML = '';
      ui.none.hidden = true;
      drawActive();
      if (!all.length) {
        box.appendChild(emptyState('lib.emptyTitle', 'lib.emptyText', null, { mb: rules.maxMb, max: rules.maxFiles }));
      } else {
        var shown = matches(all);
        // A tag filter keeps only the folders with a match (their counts are the matches).
        var list = LIB_FOLDERS.map(function (k) { return { key: k, items: inFolder(shown, k) }; })
          .filter(function (f) { return !libTags.length || f.items.length; });
        if (libFolder !== 'all' && !list.some(function (f) { return f.key === libFolder; })) { libFolder = 'all'; libSub = null; syncChips(); }
        if (!list.length) ui.none.hidden = false;
        else {
          box.appendChild(tiles(list));
          var open = list.filter(function (f) { return f.key === libFolder; })[0];
          if (open) box.appendChild(panel(open));
        }
      }
      ui.bar.update();
      var el = focus ? $('[data-focus="' + focus + '"]', box) : null;
      if (el) el.focus();
    }
    // A folder's pictures, newest first (the Archive: the last archived first).
    function inFolder(list, key) {
      var out = list.filter(function (im) { return libPlace(im) === key; });
      if (key === 'archive') out.sort(function (a, b) { return Date.parse(b.archivedAt) - Date.parse(a.archivedAt); });
      return out;
    }
    function metaText(items) {
      var bytes = items.reduce(function (s, im) { return s + (im.bytes || 0); }, 0);
      return countText(items.length) + (bytes ? ' · ' + fmtBytes(bytes) : '');
    }
    // Sub-folders of a folder (null: none). Today only Elements, one per element type; a folder that
    // gets sub-folders later is added here and works the same way.
    function subsOf(key, items) {
      if (key !== 'elements') return null;
      return lr.elementTypes.concat(items.some(function (im) { return !im.elementType; }) ? ['none'] : []);
    }
    function subItems(items, sub) { return items.filter(function (im) { return (im.elementType || 'none') === sub; }); }
    function subLabel(sub) { return t('lf.el.' + sub); }
    // A tile opens its folder below the tiles; a second click (or ✕) closes it again.
    function toggleFolder(key, focus) {
      libFolder = libFolder === key ? 'all' : key;
      libSub = null;
      syncChips();
      fillFolders(focus);
      reveal();
    }
    // The opened pictures come into view when they start below the screen (a phone shows the tiles in
    // several rows). Nothing moves when they are already in view.
    function reveal() {
      var p = $('.ads-fpanel', ui.box);
      if (!p || p.getBoundingClientRect().top < window.innerHeight - 160) return;
      var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      p.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
    }
    function tiles(list) {
      var panelId = 'ads-fpanel-' + tok;
      return h('ul', { class: 'ads-ftiles' }, list.map(function (f) {
        var archive = f.key === 'archive', open = f.key === libFolder;
        var newest = f.items[0], cover = newest ? imageEl(newest.id, 'ads-ftile__img') : null;
        if (cover && cover.tagName === 'IMG') cover.alt = '';
        else cover = h('span', { class: 'ads-ftile__empty' }, [folderIcon(archive, 40), f.items.length ? null : h('span', {}, t('lf.emptyFolder'))]);
        return h('li', {}, h('button', { type: 'button', class: 'ads-ftile', 'data-focus': 'tile:' + f.key, 'aria-expanded': String(open), 'aria-controls': open ? panelId : null,
          onclick: function () { toggleFolder(f.key, 'tile:' + f.key); } }, [
          h('span', { class: 'ads-ftile__cover' }, cover),
          h('span', { class: 'ads-ftile__body' }, [
            h('span', { class: 'ads-ftile__name' }, [folderIcon(archive), t('lf.f.' + f.key)]),
            h('span', { class: 'ads-ftile__meta' }, metaText(f.items))
          ])
        ]));
      }));
    }
    // The open folder below the tiles: its name, count and size, a close button, then its pictures
    // (or the line of sub-folders, and the chosen sub-folder's pictures below it).
    function panel(f) {
      var archive = f.key === 'archive', name = t('lf.f.' + f.key), subs = subsOf(f.key, f.items);
      var kids = [h('div', { class: 'ads-fhead' }, [
        h('h2', { class: 'ads-fhead__title' }, [folderIcon(archive, 24), name]),
        h('span', { class: 'ads-fhead__meta' }, metaText(f.items)),
        h('button', { type: 'button', class: 'ads-iconbtn ads-fpanel__close', 'aria-label': t('lf.close', { name: name }), onclick: function () { toggleFolder(f.key, 'tile:' + f.key); } }, '✕')
      ])];
      if (subs) {
        if (libSub && subs.indexOf(libSub) === -1) libSub = null;
        kids.push(h('div', { class: 'ads-subs', role: 'group', 'aria-label': t('lf.subs', { name: name }) },
          subs.filter(function (s) { return !libTags.length || subItems(f.items, s).length; }).map(function (s) {
            return h('button', { type: 'button', class: 'ads-subbtn', 'data-focus': 'sub:' + s, 'aria-pressed': String(libSub === s), onclick: function () {
              libSub = libSub === s ? null : s;
              fillFolders('sub:' + s);
            } }, [subLabel(s), h('span', { class: 'ads-subbtn__n' }, num(subItems(f.items, s).length))]);
          })));
        kids.push(libSub ? grid(subItems(f.items, libSub), 'lf.empty.type', { type: subLabel(libSub) }) : h('p', { class: 'ads-hint ads-fnote' }, t('lf.subsHint')));
      } else {
        if (archive && f.items.length) kids.push(h('p', { class: 'ads-hint ads-fnote' }, t('lf.archiveNote', { days: lr.archiveDays })));
        kids.push(grid(f.items, 'lf.empty.' + f.key, { days: lr.archiveDays }));
      }
      return h('section', { class: 'ads-fpanel', id: 'ads-fpanel-' + tok, 'aria-label': name }, kids);
    }
    function syncChips() { ui.chips.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-key') === libFolder)); }); }
    function grid(items, emptyKey, vars) {
      if (!items.length) return h('p', { class: 'ads-note ads-fnote' }, t(emptyKey, vars));
      return h('ul', { class: 'ads-libgrid' }, items.map(function (im) { return card(im); }));
    }
    // A picture: name on two lines at most (the whole name on hover and in the details). Edit mode:
    // the card is a tick box. Otherwise a click opens the details. noPick: samples are never ticked.
    function card(im, noPick) {
      var title = lname(im, 'title'), facts = [];
      if (im.bytes) facts.push(fmtBytes(im.bytes));
      if (im.width && im.height) facts.push(t('lib.dims', { w: im.width, h: im.height }));
      var img = imageEl(im.id, 'ads-libitem__img');
      if (img.tagName === 'IMG') img.alt = ''; // the name is said once, by the card
      var info = h('div', { class: 'ads-libitem__body' }, [
        libCompany === 'all' && !im.sample ? h('span', { class: 'ads-cotag' }, coName(im.business)) : null,
        facts.length ? h('span', { class: 'ads-sub' }, facts.join(' · ')) : null,
        im.archivedAt ? h('span', { class: 'ads-sub ads-sub--act' }, t('lf.deletesOn', { date: fmtDate(purgeDay(im)) }))
          : im.createdAt ? h('span', { class: 'ads-sub' }, fmtDateTime(im.createdAt)) : null
      ]);
      if (libEdit && !noPick) {
        var id = 'ads-sel-' + im.id;
        var cb = h('input', { type: 'checkbox', id: id, class: 'ads-libitem__check', checked: !!libSel[im.id] });
        cb.addEventListener('change', function () { if (cb.checked) libSel[im.id] = true; else delete libSel[im.id]; ui.bar.update(); });
        return h('li', { class: 'ads-libitem ads-libitem--pick' }, [
          h('label', { class: 'ads-libitem__open', for: id, title: title }, [cb, img, h('span', { class: 'ads-libitem__title' }, title)]), info]);
      }
      return h('li', { class: 'ads-libitem' }, [
        h('button', { type: 'button', class: 'ads-libitem__open', 'data-id': im.id, title: title, 'aria-label': t('lf.open', { name: title }), onclick: function () { openDetails(im); } },
          [img, h('span', { class: 'ads-libitem__title' }, title)]), info]);
    }

    /* ---- tag filter (right of the shortcut row) and the row of chosen tags ---- */
    function allTags() {
      var seen = {};
      all.forEach(function (im) { im.tags.forEach(function (tag) { seen[tag] = (seen[tag] || 0) + 1; }); });
      return seen;
    }
    function tagFilter() {
      var panelId = 'ads-tagpanel-' + tok;
      var btn = h('button', { type: 'button', class: 'ads-filter ads-tagfilter__btn', 'aria-expanded': 'false', 'aria-controls': panelId, onclick: function () {
        show(btn.getAttribute('aria-expanded') !== 'true');
      } });
      var list = h('div', { class: 'ads-tagfilter__list' });
      var clear = h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--ghost', onclick: function () { libTags = []; redraw(); changed(); btn.focus(); } }, t('lf.tags.clear'));
      var panel = h('div', { class: 'ads-tagfilter__panel', id: panelId, role: 'group', 'aria-label': t('lf.tags.filter'), hidden: true },
        [h('p', { class: 'ads-hint' }, t('lf.tags.hint')), list, clear]);
      var wrap = h('div', { class: 'ads-tagfilter' }, [btn, panel]);
      function show(on) {
        panel.hidden = !on;
        btn.setAttribute('aria-expanded', String(on));
        if (on) { redraw(); var f = panel.querySelector('input'); if (f) f.focus(); }
      }
      function redraw() {
        var counts = allTags(), names = Object.keys(counts).sort(function (a, b) { return a.localeCompare(b); });
        list.innerHTML = '';
        clear.hidden = !libTags.length;
        if (!names.length) { list.appendChild(h('p', { class: 'ads-note' }, t('lf.tags.noneYet'))); return; }
        list.appendChild(h('ul', { class: 'ads-tagfilter__opts' }, names.map(function (tag, i) {
          var id = panelId + '-' + i;
          var cb = h('input', { type: 'checkbox', id: id, checked: libTags.indexOf(tag) !== -1 });
          cb.addEventListener('change', function () {
            libTags = cb.checked ? libTags.concat(tag) : libTags.filter(function (x) { return x !== tag; });
            clear.hidden = !libTags.length;
            changed();
          });
          return h('li', {}, h('label', { class: 'ads-tagfilter__opt', for: id }, [cb, h('span', { class: 'ads-tagfilter__name' }, tag), h('span', { class: 'ads-sub' }, num(counts[tag]))]));
        })));
      }
      function label() {
        btn.textContent = libTags.length ? t('lf.tagsN', { n: libTags.length }) : t('lf.tags');
      }
      function changed() { label(); fillFolders(); }
      // Esc closes it (focus back on the button); so does a click outside. The listener goes when the page does.
      wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); e.stopPropagation(); show(false); btn.focus(); } });
      function outside(e) {
        if (!document.contains(wrap)) { document.removeEventListener('click', outside, true); return; }
        if (!panel.hidden && !wrap.contains(e.target)) show(false);
      }
      document.addEventListener('click', outside, true);
      return { el: wrap, redraw: redraw, label: label, changed: changed, btn: btn };
    }
    // "Filtered by tag: [sale ✕] [summer ✕]" under the row, while a tag filter is on.
    function drawActive() {
      var row = ui.active;
      row.innerHTML = '';
      row.hidden = !libTags.length;
      if (!libTags.length) return;
      append(row, [h('span', { class: 'ads-sub' }, t('lf.tags.active'))].concat(libTags.map(function (tag) {
        return h('button', { type: 'button', class: 'ads-tag', 'aria-label': t('lf.tags.removeF', { tag: tag }), onclick: function () {
          libTags = libTags.filter(function (x) { return x !== tag; });
          ui.tags.redraw(); ui.tags.changed();
          ui.tags.btn.focus();
        } }, [tag, h('span', { class: 'ads-tag__x', 'aria-hidden': 'true' }, '✕')]);
      })));
    }

    /* ---- Edit mode: tick pictures, then Archive / Restore / Delete ---- */
    function setEdit(on) {
      libEdit = !!on;
      if (!libEdit) libSel = {};
      editBtn.textContent = t(libEdit ? 'lf.editDone' : 'lf.edit');
      editBtn.setAttribute('aria-pressed', String(libEdit));
      if (ui) fillFolders();
    }
    function editBar() {
      var count = h('span', { class: 'ads-editbar__count', 'aria-live': 'polite', tabindex: '-1' });
      function small(key, kind, fn) {
        return h('button', { type: 'button', class: 'ads-btn ads-btn--small ' + (kind === 'danger' ? 'ads-btn--danger' : kind === 'ghost' ? 'ads-btn--ghost' : 'ads-btn--primary'), onclick: fn }, t(key));
      }
      var all1 = small('lf.selAll', 'ghost', function () {
        [].forEach.call(ui.box.querySelectorAll('.ads-libitem__check'), function (c) { c.checked = true; libSel[c.id.slice(8)] = true; });
        update();
      });
      var none1 = small('lf.selNone', 'ghost', function () {
        libSel = {};
        [].forEach.call(ui.box.querySelectorAll('.ads-libitem__check'), function (c) { c.checked = false; });
        update(); all1.focus();
      });
      var arch = small('lf.archive', 'primary', function () { act('archive'); });
      var rest = small('lf.restore', 'primary', function () { act('restore'); });
      var del = small('lf.delete', 'danger', function () { act('delete'); });
      var busy = false;
      var el = h('div', { class: 'ads-editbar', role: 'region', 'aria-label': t('lf.bar'), hidden: true },
        [count, h('div', { class: 'ads-editbar__tools' }, [all1, none1, arch, rest, del])]);
      function picked() { return all.filter(function (im) { return libSel[im.id]; }); }
      function update() {
        el.hidden = !libEdit;
        if (!libEdit) return;
        var sel = picked(), toArch = sel.filter(function (im) { return !im.archivedAt; }), toRest = sel.filter(function (im) { return im.archivedAt; });
        var boxes = ui.box.querySelectorAll('.ads-libitem__check').length; // none while folder tiles are shown
        count.textContent = sel.length ? t('lf.sel', { n: num(sel.length) }) : t(boxes ? 'lf.editHint' : 'lf.editTiles');
        none1.hidden = !sel.length;
        arch.textContent = t('lf.archive') + (toArch.length ? ' (' + num(toArch.length) + ')' : '');
        rest.textContent = t('lf.restore') + (toRest.length ? ' (' + num(toRest.length) + ')' : '');
        del.textContent = t('lf.delete') + (sel.length ? ' (' + num(sel.length) + ')' : '');
        arch.disabled = busy || !toArch.length;
        rest.disabled = busy || !toRest.length;
        del.disabled = busy || !sel.length;
        all1.disabled = busy || !boxes;
      }
      function act(what) {
        var sel = picked();
        if (what === 'delete') {
          var n = sel.length;
          confirmDialog({ title: t(n === 1 ? 'lf.del.title1' : 'lf.del.title', { n: num(n) }), message: t('lf.del.text'), confirmLabel: t('lf.del.confirm', { n: num(n) }), danger: true })
            .then(function (ok) {
              if (!ok) return;
              run(api.deleteImages(sel.map(function (im) { return im.id; })), function (r) {
                sel.forEach(function (im) { delete imageCache[im.id]; delete libSel[im.id]; });
                toast(t('lf.deletedN', { n: num(r.deleted) }));
                return true; // the ticked cards had focus: the heading takes it
              });
            });
          return;
        }
        var on = what === 'archive', list = sel.filter(function (im) { return !!im.archivedAt !== on; });
        run(api.archiveImages(list.map(function (im) { return im.id; }), on), function (r) {
          list.forEach(function (im) { delete libSel[im.id]; });
          if (on) toast(t('lf.archived', { n: num(r.changed), date: fmtDate(new Date(Date.now() + lr.archiveDays * 86400000).toISOString(), true) }));
          else toast(t('lf.restored', { n: num(r.changed) }));
          return false;
        });
      }
      function run(job, done) {
        busy = true; update();
        job.then(function (r) { busy = false; var head = done(r); if (!stale(tok)) load(head ? true : 'bar'); },
          function (e) { busy = false; update(); toast(t('toast.failed') + ' ' + errText(e), 'act'); });
      }
      return { el: el, update: update };
    }

    /* ---- details window: the picture, its facts and its tags ---- */
    function openDetails(im) {
      var title = lname(im, 'title'), tags = im.tags.slice(), changed = false, saving = false, src = imageUri(im);
      var big = src ? h('img', { class: 'ads-libdlg__img' + (im.kind === 'element' ? ' ads-img--element' : ''), src: src, alt: title })
        : h('div', { class: 'ads-libdlg__img ads-img-empty' }, t('common.noImage'));
      var size = [];
      if (im.bytes) size.push(fmtBytes(im.bytes));
      if (im.width && im.height) size.push(t('lib.dims', { w: im.width, h: im.height }));
      if (im.mime) size.push(String(im.mime).replace('image/', '').toUpperCase());
      var facts = [[t('lf.d.name'), title]];
      if (size.length) facts.push([t('lf.d.size'), size.join(' · ')]);
      facts.push([t('lf.d.source'), t('lf.src.' + (im.sample ? 'sample' : im.source === 'ai' ? 'ai' : 'upload'))]);
      facts.push([t('lf.d.company'), coName(im.business)]);
      if (!im.sample) facts.push([t('lf.d.folder'), im.archivedAt ? t('lf.d.from', { folder: folderLabel(im) }) : folderLabel(im)]);
      if (im.createdAt) facts.push([t('lf.d.added'), fmtDateTime(im.createdAt)]);
      if (im.archivedAt) facts.push([t('lf.d.archived'), t('lf.d.deletes', { date: fmtDate(purgeDay(im), true) })]);
      var list = h('ul', { class: 'ads-tags' }), note = h('p', { class: 'ads-hint', 'aria-live': 'polite' });
      var input = h('input', { type: 'text', id: 'ads-tag-new', class: 'ads-input', maxlength: '200', autocomplete: 'off', list: 'ads-tag-sugg', 'aria-describedby': 'ads-tag-new-hint' });
      var known = Object.keys(allTags()).sort(function (a, b) { return a.localeCompare(b); });
      var addBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: add }, t('lf.tags.add'));
      function drawTags() {
        list.innerHTML = '';
        if (!tags.length) { list.appendChild(h('li', { class: 'ads-hint' }, t('lf.tags.none'))); return; }
        tags.forEach(function (tag) {
          list.appendChild(h('li', {}, h('button', { type: 'button', class: 'ads-tag', 'aria-label': t('lf.tags.remove', { tag: tag }), onclick: function () {
            save(tags.filter(function (x) { return x !== tag; }));
          } }, [tag, h('span', { class: 'ads-tag__x', 'aria-hidden': 'true' }, '✕')])));
        });
      }
      function add() {
        var typed = input.value.split(',');
        var next = api.cleanTags(tags.concat(typed));
        if (next.length === tags.length) {
          var wanted = api.cleanTags(typed).filter(function (x) { return tags.indexOf(x) === -1; });
          note.textContent = wanted.length ? t('lf.tags.max', { max: lr.maxTags }) : '';
          input.value = ''; input.focus();
          return;
        }
        save(next);
      }
      function save(next) {
        if (saving) return;
        saving = true; addBtn.disabled = true; note.textContent = t('lf.tags.saving');
        api.setImageTags(im.id, next).then(function (saved) {
          tags = saved.slice(); im.tags = saved.slice(); changed = true; input.value = '';
          drawTags(); note.textContent = t('lf.tags.saved');
        }, function (e) { note.textContent = t('toast.failed') + ' ' + errText(e); }).then(function () {
          saving = false; addBtn.disabled = false; input.focus();
        });
      }
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      drawTags();
      var tagBox = im.sample ? h('p', { class: 'ads-note' }, t('lf.d.sample')) : h('div', { class: 'ads-libdlg__tags' }, [
        h('h3', { class: 'ads-h3' }, t('lf.tags.title')), list,
        h('label', { class: 'ads-label', for: 'ads-tag-new' }, t('lf.tags.addLabel')),
        h('div', { class: 'ads-libdlg__add' }, [input, addBtn]),
        h('datalist', { id: 'ads-tag-sugg' }, known.map(function (tag) { return h('option', { value: tag }); })),
        h('p', { class: 'ads-hint', id: 'ads-tag-new-hint' }, t('lf.tags.hintDlg', { max: lr.maxTags })), note]);
      openDialog({
        title: t('lf.dlg.title'), wide: true, cancelLabel: 'common.close',
        body: h('div', { class: 'ads-libdlg' }, [h('div', { class: 'ads-libdlg__media' }, big),
          h('div', { class: 'ads-libdlg__info' }, [kv(facts), im.url ? h('p', {}, h('a', { class: 'ads-link', href: im.url, target: '_blank', rel: 'noopener' }, t('lf.d.open'))) : null, tagBox])])
      }).then(function () { if (changed && !stale(tok)) load(im.id); });
    }

    /* ---- upload: the chosen files with "ready" or the reason, where to save them, then upload ---- */
    function choose(files) {
      (usage ? Promise.resolve(usage) : api.libraryUsage().then(null, function () { return null; })).then(function (u) {
        if (u && !stale(tok)) { usage = u; drawUsage(); }
        var free = u ? Math.max(0, u.limit - u.used) : Infinity;
        var list = files.map(function (f, i) {
          var problem = i >= rules.maxFiles ? { key: 'lib.err.tooMany', vars: { max: rules.maxFiles } } : api.checkImageFile(f);
          if (!problem && f.size > free) problem = { key: 'lf.dlg.noRoom', vars: { free: fmtBytes(free) } };
          if (!problem) free -= f.size;
          return { file: f, problem: problem };
        });
        var ok = list.filter(function (x) { return !x.problem; }).map(function (x) { return x.file; });
        // Opened from Elements (or one of its types) the window starts on Elements (and that type).
        var where = libFolder === 'elements' ? 'elements' : 'uploads', sendBtn = null;
        var type = where === 'elements' && libSub && libSub !== 'none' ? libSub : '';
        var typeSel = select('ads-up-type', [['', t('lf.dlg.typeChoose')]].concat(lr.elementTypes.map(function (ty) { return [ty, t('lf.el.' + ty)]; })), type, function (v) { type = v; upd(); });
        var typeField = field('lf.dlg.type', typeSel, null, 'ads-up-type');
        function upd() { typeField.hidden = where !== 'elements'; if (sendBtn) sendBtn.disabled = !ok.length || (where === 'elements' && !type); }
        var places = h('fieldset', { class: 'ads-fieldset' }, [h('legend', { class: 'ads-label' }, t('lf.dlg.where'))].concat(['uploads', 'elements'].map(function (k) {
          var r = h('input', { type: 'radio', name: 'ads-up-where', id: 'ads-up-' + k, value: k, checked: k === where });
          r.addEventListener('change', function () { where = k; upd(); });
          return h('label', { class: 'ads-option', for: 'ads-up-' + k }, [r, h('span', {}, [h('strong', {}, t('lf.f.' + k)), h('span', { class: 'ads-sub' }, t('lf.dlg.' + k + '.d'))])]);
        })));
        var fileList = h('ul', { class: 'ads-filelist' }, list.map(function (x) {
          return h('li', { class: 'ads-filelist__item' }, [
            h('span', { class: 'ads-filelist__name' }, x.file.name),
            h('span', { class: 'ads-filelist__size' }, fmtBytes(x.file.size)),
            h('span', { class: 'ads-filelist__state ads-filelist__state--' + (x.problem ? 'bad' : 'ok') }, x.problem ? t(x.problem.key, x.problem.vars) : t('lib.dlg.ok'))
          ]);
        }));
        var skipped = list.length - ok.length;
        upd();
        openDialog({
          title: t('lib.dlg.title'), wide: true,
          body: h('div', {}, [fileList, skipped && ok.length ? h('p', { class: 'ads-note' }, t('lib.dlg.skip', { n: skipped })) : null,
            ok.length ? places : h('p', { class: 'ads-warn' }, t('lib.dlg.none')), ok.length ? typeField : null]),
          actions: [{ label: t(ok.length === 1 ? 'lib.uploadOne' : 'lib.uploadN', { n: ok.length }), value: 'go', disabled: !ok.length }],
          onOpen: function (dlg, btns) { sendBtn = btns.go || null; upd(); }
        }).then(function (v) {
          if (v === 'go') upload(ok, where === 'elements' ? { folder: 'elements', elementType: type } : { folder: 'uploads' });
        });
      });
    }
    // One file after the other. The progress shows in whichever Library view is on screen.
    function upload(files, place) {
      var biz = libTarget(), done = 0, failed = [], full = false;
      libJob = { n: 1, total: files.length };
      function step(i) {
        if (i >= files.length) return finish();
        libJob.n = i + 1; libSync();
        return api.uploadImage(biz, files[i], place).then(function (im) { cacheImages([im]); done++; },
          function (e) { failed.push(files[i].name); if (e && e.key === 'lf.err.full') full = true; })
          .then(function () { return step(i + 1); });
      }
      function finish() {
        libJob = null; libSync();
        if (!failed.length) toast(t('lib.done', { n: done }));
        else toast(t('lib.doneFailed', { n: done, f: failed.length, names: failed.slice(0, 3).join(', ') + (failed.length > 3 ? ', …' : '') }), 'act');
        if (full) toast(t('lf.err.full'), 'act');
        // The folder the pictures went to opens, so the new ones are in view.
        libFolder = place.folder;
        libSub = place.folder === 'elements' ? place.elementType || 'none' : null;
        if (libView && !stale(libView.tok)) libView.load();
      }
      step(0);
    }
  }

  /* AI pictures (Gemini "Nano Banana", live backend only). The Edge Function ads-generate-image
     keeps the key, counts the daily limit and saves each picture straight into the library. */
  var AI_ASPECTS = ['1:1', '4:5', '9:16', '16:9'];
  var AI_MAX_REFS = 3;
  var aiLast = { prompt: '', aspect: '1:1', quality: 'standard', refs: [] }; // the form opens with the last choices

  // Picture makers (owner D-68, 14 Nov 2026): Claude is the brain; pictures come from Gemini or ChatGPT, chosen
  // per picture. The last choice is kept in this browser and used by both picture windows.
  var MAKERS = ['gemini', 'openai'];
  function lastMaker() { try { return localStorage.getItem('ads_ai_maker') === 'openai' ? 'openai' : 'gemini'; } catch (e) { return 'gemini'; } }
  function rememberMaker(m) { try { localStorage.setItem('ads_ai_maker', m); } catch (e) { /* ignore */ } }
  // A service's logo, small, for a label (logos.js).
  function logoMark(id) {
    var logo = (window.AdsLogos || {})[id], s = h('span', { class: 'ads-logo-sm', 'aria-hidden': 'true' });
    if (logo) s.innerHTML = '<svg viewBox="0 0 ' + logo[0] + ' ' + logo[1] + '" aria-hidden="true" focusable="false">' + logo[2] + '</svg>';
    return s;
  }
  // "Picture maker" choice with the makers' logos. setReady(ready) switches off makers without a working agency
  // key (ready = { gemini, openai } from the server; a server from before 14 Nov sends none = Gemini only) and
  // moves the choice to a ready maker; it returns the maker in use, or null when none is ready.
  function makerField(name, value, onPick) {
    var radios = {}, notes = {}, ready = { gemini: true, openai: true };
    var box = h('fieldset', { class: 'ads-fieldset ads-makers' }, [h('legend', { class: 'ads-label' }, t('aimg.maker'))].concat(MAKERS.map(function (m) {
      var id = name + '-' + m;
      radios[m] = h('input', { type: 'radio', name: name, id: id, value: m, checked: m === value, 'aria-describedby': id + '-d' });
      radios[m].addEventListener('change', function () { rememberMaker(m); onPick(m); });
      notes[m] = h('span', { class: 'ads-sub', id: id + '-d' }, t('aimg.maker.' + m + '.d'));
      return h('label', { class: 'ads-option ads-maker', for: id }, [radios[m], logoMark(m), h('span', {}, [h('strong', {}, t('aimg.maker.' + m)), notes[m]])]);
    })));
    box.setReady = function (r) {
      ready = r && typeof r === 'object' ? { gemini: !!r.gemini, openai: !!r.openai } : { gemini: true, openai: false };
      MAKERS.forEach(function (m) {
        radios[m].disabled = !ready[m];
        notes[m].textContent = t(ready[m] ? 'aimg.maker.' + m + '.d' : 'aimg.maker.off');
      });
      var cur = MAKERS.filter(function (m) { return radios[m].checked; })[0];
      if (cur && ready[cur]) return cur;
      var next = MAKERS.filter(function (m) { return ready[m]; })[0] || null;
      if (next) { radios[next].checked = true; onPick(next); }
      return next;
    };
    box.anyReady = function () { return ready.gemini || ready.openai; };
    box.isReady = function (m) { return !!ready[m]; };
    return box;
  }

  // Plain words for a failed AI call: known codes translated, otherwise the server's own English sentence.
  function aiErrText(e) {
    var c = e && e.code;
    if (e && e.key) return t(e.key, e.vars);
    if (c === 'network') return t('srv.network');
    if (c === 'not_member' || c === 'no_token' || c === 'bad_token') return t('srv.access');
    if (companyErrText(c)) return companyErrText(c);
    if (c === 'not_deployed') return t('aimg.err.notDeployed');
    if (c === 'daily_limit') return t('aimg.err.limit');
    if (c === 'no_gemini_key' || c === 'gemini_key') return t('aimg.err.key');
    if (c === 'no_openai_key' || c === 'openai_key') return t('aimg.err.keyOpenai');
    if (c === 'openai_verify') return t('aimg.err.verify');
    if (c === 'openai_quota') return t('aimg.err.quotaOpenai');
    return (e && e.message) || t('common.errorText');
  }
  // The form: description, format, quality, optional library pictures to start from.
  function openAiDialog() {
    if (!liveMode()) { toast(t('aimg.err.mock'), 'act'); return; }
    if (aiJob) { toast(t('aimg.busy'), 'act'); return; }
    var biz = libTarget(), remaining = null, go = null;
    var o = { prompt: aiLast.prompt, aspect: aiLast.aspect, quality: aiLast.quality, refs: aiLast.refs.slice(), maker: lastMaker() };
    var makers = makerField('ads-ai-mk', o.maker, function (m) { o.maker = m; upd(); });
    var quota = h('p', { class: 'ads-note', 'aria-live': 'polite' }, t('aimg.quota.loading'));
    var ta = h('textarea', { id: 'ads-ai-prompt', class: 'ads-input ads-textarea', rows: '5', maxlength: '2000', placeholder: t('aimg.prompt.ph'), 'aria-describedby': 'ads-ai-prompt-hint' });
    ta.value = o.prompt;
    ta.addEventListener('input', function () { o.prompt = ta.value; upd(); });
    var aspect = select('ads-ai-aspect', AI_ASPECTS.map(function (a) { return [a, t('aimg.aspect.' + a.replace(':', 'x'))]; }), o.aspect, function (v) { o.aspect = v; });
    var quality = h('fieldset', { class: 'ads-fieldset' }, [h('legend', { class: 'ads-label' }, t('aimg.quality'))].concat(['standard', 'high'].map(function (q) {
      var r = h('input', { type: 'radio', name: 'ads-ai-q', id: 'ads-ai-q-' + q, value: q, checked: q === o.quality });
      r.addEventListener('change', function () { o.quality = q; });
      return h('label', { class: 'ads-option', for: 'ads-ai-q-' + q }, [r, h('span', {}, [h('strong', {}, t('aimg.q.' + q)), h('span', { class: 'ads-sub' }, t('aimg.q.' + q + '.d'))])]);
    })));
    var refsBox = h('div', {}, h('p', { class: 'ads-note' }, t('aimg.loading')));
    function upd() { if (go) go.disabled = !(remaining > 0 && makers.isReady(o.maker) && o.prompt.replace(/\s+/g, ' ').trim().length >= 3); }

    // The business's own uploads can be a starting point (a product photo, the logo).
    api.listImages(biz).then(function (list) {
      var mine = list.filter(function (x) { return !x.sample && x.url; }), boxes = [];
      o.refs = o.refs.filter(function (id) { return mine.some(function (x) { return x.id === id; }); });
      refsBox.innerHTML = '';
      if (!mine.length) { refsBox.appendChild(h('p', { class: 'ads-note' }, t('aimg.refs.none'))); return; }
      function limit() { boxes.forEach(function (cb) { cb.disabled = !cb.checked && o.refs.length >= AI_MAX_REFS; }); }
      refsBox.appendChild(h('p', { class: 'ads-hint' }, t('aimg.refs.hint')));
      refsBox.appendChild(h('ul', { class: 'ads-aipicks' }, mine.map(function (im) {
        var id = 'ads-ai-ref-' + im.id;
        var cb = h('input', { type: 'checkbox', id: id, value: im.id, checked: o.refs.indexOf(im.id) !== -1 });
        cb.addEventListener('change', function () {
          o.refs = cb.checked ? o.refs.concat(im.id) : o.refs.filter(function (x) { return x !== im.id; });
          limit();
        });
        boxes.push(cb);
        return h('li', {}, h('label', { class: 'ads-aipick', for: id }, [cb, h('img', { src: im.url, alt: '', loading: 'lazy' }), h('span', { class: 'ads-aipick__name' }, im.title)]));
      })));
      limit();
    }).catch(function () { refsBox.innerHTML = ''; refsBox.appendChild(h('p', { class: 'ads-note' }, t('aimg.refs.none'))); });

    api.aiImageStatus(biz).then(function (r) {
      remaining = r.remaining;
      o.maker = makers.setReady(r.makers) || o.maker;
      quota.textContent = !makers.anyReady() ? t('aimg.maker.none') : r.remaining > 0 ? t('aimg.quota', { n: r.remaining, limit: r.limit }) : t('aimg.err.limit');
      if (r.remaining <= 0 || !makers.anyReady()) quota.className = 'ads-warn';
      upd();
    }).catch(function (e) { quota.textContent = aiErrText(e); quota.className = 'ads-warn'; });

    openDialog({
      title: t('aimg.title'), wide: true,
      body: h('div', {}, [quota, field('aimg.prompt', ta, t('aimg.prompt.hint'), 'ads-ai-prompt'), makers, field('aimg.aspect', aspect, null, 'ads-ai-aspect'), quality,
        h('fieldset', { class: 'ads-fieldset' }, [h('legend', { class: 'ads-label' }, t('aimg.refs', { max: AI_MAX_REFS })), refsBox])]),
      actions: [{ label: t('aimg.go'), value: 'go', disabled: true }],
      onOpen: function (dlg, btns) { go = btns.go; upd(); ta.focus(); }
    }).then(function (v) { if (v === 'go') runAi(biz, o); });
  }
  // Makes the picture in the background (10-30 s); the result opens wherever the user is by then.
  function runAi(biz, o) {
    aiLast = { prompt: o.prompt, aspect: o.aspect, quality: o.quality, refs: o.refs.slice() };
    rememberMaker(o.maker);
    aiJob = { business: biz }; libSync();
    toast(t('aimg.started'));
    roomForAi().then(function () { return api.generateImage(biz, o); }).then(function (r) {
      aiJob = null; libSync();
      cacheImages([r.image]);
      if (libView && !stale(libView.tok)) libView.load();
      showAiResult(r);
    }, function (e) {
      aiJob = null; libSync();
      openDialog({ title: t('aimg.err.title'), body: h('p', {}, aiErrText(e)), cancelLabel: 'common.close', actions: [{ label: t('aimg.edit'), value: 'edit' }] })
        .then(function (v) { if (v === 'edit') openAiDialog(); });
    });
  }
  // The picture is already saved; the user can keep it, delete it or make another.
  function showAiResult(r) {
    var im = r.image;
    openDialog({
      title: t('aimg.done.title'), wide: true,
      body: h('div', { class: 'ads-airesult' }, [
        h('img', { class: 'ads-airesult__img', src: im.url, alt: im.title, width: String(im.width || 1024), height: String(im.height || 1024) }),
        h('p', {}, t('aimg.done.saved')),
        h('p', { class: 'ads-note' }, t('aimg.quota', { n: r.remaining, limit: r.limit }))
      ]),
      cancelLabel: 'aimg.close',
      actions: [{ label: t('common.delete'), value: 'delete', kind: 'danger' }, { label: t('aimg.again'), value: 'again' }]
    }).then(function (v) {
      if (v === 'again') openAiDialog();
      if (v !== 'delete') return;
      api.deleteImage(im.id).then(function () {
        delete imageCache[im.id];
        toast(t('aimg.deleted'));
        if (libView && !stale(libView.tok)) libView.load();
      }).catch(function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); });
    });
  }
  // Settings: asks the server whether Gemini accepts the key (nothing is made, nothing is paid).
  function testGemini(btn) {
    btn.disabled = true;
    api.aiTest(ctx.business).then(function (r) { btn.disabled = false; toast(t('aimg.test.ok', { model: r.model })); },
      function (e) { btn.disabled = false; toast(aiErrText(e), 'act'); });
  }
  // "Choose from library": one of the business's own uploads (not the samples). Resolves with its id, or null.
  function chooseLibraryImage(biz, current) {
    return api.listImages(biz).then(function (list) {
      cacheImages(list);
      var mine = list.filter(function (x) { return !x.sample && x.url; }), useBtn = null;
      var pick = mine.some(function (x) { return x.id === current; }) ? current : '';
      var body = !mine.length ? h('p', { class: 'ads-note' }, t('pd.lib.none')) : h('ul', { class: 'ads-aipicks' }, mine.map(function (im) {
        var id = 'ads-lp-' + im.id;
        var r = h('input', { type: 'radio', name: 'ads-lp', id: id, value: im.id, checked: im.id === pick });
        r.addEventListener('change', function () { pick = im.id; if (useBtn) useBtn.disabled = false; });
        return h('li', {}, h('label', { class: 'ads-aipick', for: id, title: im.title }, [r, h('img', { src: im.url, alt: '', loading: 'lazy' }), h('span', { class: 'ads-aipick__name' }, im.title)]));
      }));
      return openDialog({
        title: t('pd.lib.title'), wide: true, body: body,
        actions: mine.length ? [{ label: t('pd.lib.use'), value: 'use', disabled: !pick }] : [],
        onOpen: function (dlg, btns) { useBtn = btns.use || null; }
      }).then(function (v) { return v === 'use' && pick ? pick : null; });
    });
  }

  /* ---------------------------------------------------------------------
     9b. Picture styles (live only, 6 Nov 2026): the prompt template, and groups of options (for
         example frames, price tags, backgrounds) that the post-picture generator combines with
         each product. The groups are data too (ads_style_groups): nothing is fixed in the
         database; the owner types them in or imports the Prompt Library workbook (Excel).
     --------------------------------------------------------------------- */
  var styJob = null;  // an import or bulk upload in progress: { key (i18n of the progress line), n, total }
  var styView = null; // the Picture styles view on screen: { tok, status }
  function stySync() {
    if (!styView || stale(styView.tok)) return;
    styView.status.textContent = styJob ? t(styJob.key, { n: styJob.n, total: styJob.total }) : '';
  }
  function styleNo(code) { var m = /^[A-Za-z](\d{1,2})$/.exec(code || ''); return m ? parseInt(m[1], 10) : 0; }
  function styleLabelAspect(a) { return a === '3:4' ? t('sty.aspect.3x4') : a === '4:3' ? t('sty.aspect.4x3') : t('aimg.aspect.' + a.replace(':', 'x')); }
  // Style codes compare by letter and number: "f02" = "F2". '' when it is not a code.
  function styleKey(code) {
    var m = /^([A-Za-z])(\d{1,2})$/.exec(String(code || '').trim());
    return m ? m[1].toUpperCase() + parseInt(m[2], 10) : '';
  }
  // A file named "F2 Arch Window.jpg" or "t1_round.png" belongs to option F2 / T1: a letter and 1-2
  // digits, then a space, "_", "-" or "."; case and leading zeros do not matter. '' when none.
  function fileStyleCode(name) {
    var m = /^([A-Za-z]\d{1,2})[ _.\-]/.exec(String(name || ''));
    return m ? styleKey(m[1]) : '';
  }
  // Token suggested from a group or sheet name: capitals, digits and _, starting with a letter, max 20.
  function tokenFrom(name) {
    return String(name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^[^A-Z]+/, '').slice(0, 20).replace(/_+$/, '');
  }
  // Letter for a group: the wished one when free, else the first free letter A-Z ('' when all are used).
  function freePrefix(groups, wish, self) {
    var used = groups.filter(function (g) { return g !== self; }).map(function (g) { return g.prefix; });
    wish = String(wish || '').toUpperCase();
    if (/^[A-Z]$/.test(wish) && used.indexOf(wish) === -1) return wish;
    for (var c = 65; c <= 90; c++) if (used.indexOf(String.fromCharCode(c)) === -1) return String.fromCharCode(c);
    return '';
  }
  // A group's fields checked before saving: '' when fine, else the reason. self: the group being edited.
  function groupProblem(groups, v, self) {
    var token = String(v.token || '').trim().toUpperCase(), prefix = String(v.prefix || '').trim().toUpperCase();
    if (!String(v.name || '').trim()) return t('sty.grp.err.name');
    if (!/^[A-Z][A-Z0-9_]{0,19}$/.test(token)) return t('sty.grp.err.token');
    if (api.reservedTokens.indexOf(token) !== -1) return t('sty.grp.err.reserved', { token: token });
    if (groups.some(function (g) { return g !== self && g.token === token; })) return t('sty.grp.err.tokenTaken', { token: token });
    if (!/^[A-Z]$/.test(prefix)) return t('sty.grp.err.prefix');
    if (groups.some(function (g) { return g !== self && g.prefix === prefix; })) return t('sty.grp.err.prefixTaken', { prefix: prefix });
    return '';
  }

  /* The owner's Prompt Library workbook: every sheet with the columns ID | Name | Prompt... becomes a
     group (Frames, PriceTags, Backgrounds have fixed tokens and letters), the sheet Settings holds the
     template texts in columns A (label) and B (text). Builder, Products and README are not read. */
  var LIB_KNOWN = { frames: ['FRAME', 'F', 'element', 'Frame'], pricetags: ['TAG', 'T', 'element', 'Price tag'], backgrounds: ['BG', 'B', 'picture', 'Background'] };
  var LIB_SKIP = ['products', 'builder', 'readme'];
  var LIB_SETTINGS = { 'master template': 'template', 'fixed rules': 'rules', 'text mode: ai writes': 'textAi', 'text mode: overlay': 'textOverlay' };
  var LIB_TPL_LABELS = { template: 'sty.tpl.master', rules: 'sty.tpl.rules', textAi: 'sty.tpl.textAi', textOverlay: 'sty.tpl.textOverlay' };
  function cellText(v) { return v == null ? '' : String(v).replace(/\r\n?/g, '\n').trim(); }
  // Columns of ID, Name and Prompt (a header that starts with "Prompt", e.g. "Prompt ({PRICE} filled automatically)").
  function libColumns(r) {
    var c = { id: -1, name: -1, prompt: -1 };
    (r || []).forEach(function (v, i) {
      var s = cellText(v).replace(/\s+/g, ' ').toLowerCase();
      if (s === 'id' && c.id === -1) c.id = i;
      else if (s === 'name' && c.name === -1) c.name = i;
      else if (/^prompt\b/.test(s) && c.prompt === -1) c.prompt = i;
    });
    return c.id !== -1 && c.name !== -1 && c.prompt !== -1 ? c : null;
  }
  // -> { groups: [{ sheet, token, name, prefix, pictureKind, options: [{ code, name, prompt }], skipped }],
  //      settings: { template, rules, textAi, textOverlay } (only those found) }
  function parsePromptLibrary(X, wb) {
    var out = { groups: [], settings: {} };
    wb.SheetNames.forEach(function (sheet) {
      var key = sheet.toLowerCase().replace(/[\s_\-]+/g, ''), ws = wb.Sheets[sheet];
      if (!ws || LIB_SKIP.indexOf(key) !== -1) return;
      var rows = X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false });
      if (key === 'settings') {
        rows.forEach(function (r) {
          var k = LIB_SETTINGS[cellText(r[0]).replace(/\s+/g, ' ').toLowerCase()];
          if (k && cellText(r[1])) out.settings[k] = cellText(r[1]);
        });
        return;
      }
      var head = -1, cols = null;
      for (var i = 0; i < Math.min(rows.length, 10) && !cols; i++) { cols = libColumns(rows[i]); head = i; }
      if (!cols) return;
      var byCode = {}, order = [], skipped = 0;
      rows.slice(head + 1).forEach(function (r) {
        var code = cellText(r[cols.id]).toUpperCase();
        if (!code) return;
        if (!/^[A-Z]\d{1,2}$/.test(code)) { skipped++; return; }
        if (!byCode[code]) order.push(code);
        byCode[code] = { code: code, name: cellText(r[cols.name]).replace(/\s+/g, ' '), prompt: cellText(r[cols.prompt]) };
      });
      if (!order.length) return;
      var known = LIB_KNOWN[key], token = known ? known[0] : tokenFrom(sheet);
      if (!/^[A-Z][A-Z0-9_]{0,19}$/.test(token) || api.reservedTokens.indexOf(token) !== -1) token = order[0].charAt(0) + '_GROUP';
      out.groups.push({ sheet: sheet, token: token, name: known ? known[3] : sheet, prefix: known ? known[1] : order[0].charAt(0),
        pictureKind: known ? known[2] : 'picture', options: order.map(function (c) { return byCode[c]; }), skipped: skipped });
    });
    return out;
  }

  // Picture styles belong to one company (ADS-36; shared styles need the database update ADS-37).
  // The Company filter shows another company's styles; it starts at the top-bar company and goes back
  // to it when the top-bar company changes.
  var styCompany = null;
  function styBiz() { return styCompany && settings.businesses.some(function (b) { return b.id === styCompany; }) ? styCompany : ctx.business; }
  function viewStyles(tok) {
    var live = liveMode(), rules = api.imageRules, ps = null, groups = [], styles = [], loaded = false, seq = 0;
    var cards = {};       // saved option id -> { setImage(id) }: the bulk upload links pictures through it
    var colorFields = []; // [{ groupId, el }]: an option's colour field shows only in the name-colour group
    var tokensHint = null, colourBox = null, groupsBox = null, noGroups = null, addGroupBtn = null;
    var body = h('div', {}, live ? skeleton(4) : null);
    var status = h('p', { class: 'ads-note ads-status', 'aria-live': 'polite' });
    var picker = h('input', { type: 'file', multiple: true, accept: rules.accept, hidden: true });
    picker.addEventListener('change', function () { var f = [].slice.call(picker.files || []); picker.value = ''; if (f.length) bulk(f); });
    var xls = h('input', { type: 'file', hidden: true, accept: '.xlsx,.xls,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet' });
    xls.addEventListener('change', function () { var f = xls.files && xls.files[0]; xls.value = ''; if (f) readLibrary(f); });
    function whenReady(fn) { return function () { if (styJob) toast(t('lib.busy'), 'act'); else if (loaded) fn(); }; }
    render(h('div', { class: 'ads-styles' }, [
      pageHead('sty.nav', live ? [
        h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: whenReady(function () { xls.click(); }) }, t('sty.imp')),
        h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: whenReady(function () { picker.click(); }) }, t('sty.bulk'))
      ] : []),
      h('p', { class: 'ads-note' }, t('sty.intro')),
      settings.businesses.length > 1 ? h('div', { class: 'ads-cofilter' }, [
        h('label', { class: 'ads-label', for: 'ads-sty-co' }, t('co.filter')),
        select('ads-sty-co', settings.businesses.map(function (b) { return [b.id, b.name + (b.id === ctx.business ? ' ' + t('co.filter.this') : '')]; }), styBiz(), function (v) {
          styCompany = v === ctx.business ? null : v; route();
        }),
        h('p', { class: 'ads-hint' }, t('sty.coHint'))]) : null,
      live ? null : h('p', { class: 'ads-warn' }, t('sty.mock')),
      picker, xls, status, body
    ]), 'sty.nav');
    if (!live) return;
    styView = { tok: tok, status: status };
    stySync();
    load();

    function load() {
      Promise.all([api.getPictureSettings(styBiz()), api.listStyleGroups(styBiz()), api.listStyles(styBiz())]).then(function (r) {
        if (stale(tok)) return;
        ps = r[0]; groups = r[1]; styles = r[2]; loaded = true;
        cacheImages(styles.map(function (s) { return s.image; }).filter(Boolean));
        draw();
      }).catch(function (e) {
        if (stale(tok)) return;
        loaded = false;
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'ads-warn', role: 'alert' }, [h('p', {}, errText(e) || t('common.errorText')),
          h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { body.innerHTML = ''; body.appendChild(skeleton(4)); load(); } }, t('common.retry'))]));
      });
    }
    function groupById(id) { return groups.filter(function (g) { return g.id === id; })[0] || null; }
    function draw() {
      body.innerHTML = ''; cards = {}; colorFields = [];
      tokensHint = h('p', { class: 'ads-hint ads-tokens' });
      colourBox = h('div', {});
      noGroups = h('p', { class: 'ads-note' }, t('sty.groups.none'));
      groupsBox = h('div', {}, noGroups);
      addGroupBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: addGroup }, t('sty.grp.add'));
      body.appendChild(templateCard());
      body.appendChild(colourBox);
      body.appendChild(groupsBox);
      body.appendChild(h('div', { class: 'ads-btnrow ads-addgroup' }, addGroupBtn));
      groups.forEach(function (g) { groupsBox.appendChild(groupSection(g)); });
      syncMeta();
    }
    // After a group change: the group tokens line, the name-colour choice, the colour fields, the empty note.
    function syncMeta() {
      tokensHint.textContent = t('sty.tpl.groupTokens', { groups: groups.length
        ? groups.map(function (g) { return '{' + g.token + '} ' + g.name; }).join(' · ') : t('sty.tpl.noGroups') });
      drawColour();
      syncColourFields();
      noGroups.hidden = !!groups.length;
    }
    function syncColourFields() {
      colorFields.forEach(function (c) { var g = groupById(c.groupId); c.el.hidden = !(g && g.nameColor); });
    }
    function templateCard() {
      var s = ps || { template: '', rules: '', textAi: '', textOverlay: '', aspect: '3:4' };
      // maxlength = the database limits (0029: template 8000, rules 4000, the two texts 2000)
      function box(id, key, rows, max) { return h('textarea', { id: id, class: 'ads-input ads-textarea', rows: String(rows), maxlength: String(max), spellcheck: 'false', lang: 'en' }, s[key] || ''); }
      var tpl = box('ads-sty-tpl', 'template', 10, 8000), rulesBox = box('ads-sty-rules', 'rules', 4, 4000), tAi = box('ads-sty-tai', 'textAi', 3, 2000), tOv = box('ads-sty-tov', 'textOverlay', 3, 2000);
      var aspects = api.pictureAspects;
      var aspect = select('ads-sty-aspect', aspects.map(function (a) { return [a, styleLabelAspect(a)]; }), aspects.indexOf(s.aspect) !== -1 ? s.aspect : '3:4', function () {});
      var save = h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function () {
        save.disabled = true;
        api.savePictureSettings(styBiz(), { template: tpl.value, rules: rulesBox.value, textAi: tAi.value, textOverlay: tOv.value, aspect: aspect.value })
          .then(function (r) { ps = r; toast(t('sty.tpl.saved')); }, function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); })
          .then(function () { save.disabled = false; });
      } }, t('sty.tpl.save'));
      return h('section', { class: 'ads-card', 'aria-labelledby': 'ads-sty-tpl-h' }, [
        h('h2', { class: 'ads-h2', id: 'ads-sty-tpl-h' }, t('sty.tpl')),
        h('p', { class: 'ads-hint ads-tokens' }, t('sty.tpl.tokens')), tokensHint,
        field('sty.tpl.master', tpl, null, 'ads-sty-tpl'), field('sty.tpl.rules', rulesBox, null, 'ads-sty-rules'),
        field('sty.tpl.textAi', tAi, null, 'ads-sty-tai'), field('sty.tpl.textOverlay', tOv, null, 'ads-sty-tov'),
        field('sty.tpl.aspect', aspect, null, 'ads-sty-aspect'),
        h('div', { class: 'ads-btnrow' }, save)
      ]);
    }
    // "Name colour on the picture comes from: <group>", one group at most.
    function drawColour() {
      colourBox.innerHTML = '';
      if (!groups.length) return;
      var cur = groups.filter(function (g) { return g.nameColor; })[0];
      var sel = select('ads-sty-nc', [['', t('sty.color.none')]].concat(groups.map(function (g) { return [g.id, g.name + ' {' + g.token + '}']; })), cur ? cur.id : '', function () {});
      sel.setAttribute('aria-describedby', 'ads-sty-nc-hint');
      var save = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { setNameColour(sel.value, save); } }, t('sty.color.save'));
      colourBox.appendChild(h('section', { class: 'ads-card', 'aria-labelledby': 'ads-sty-nc-h' }, [
        h('h2', { class: 'ads-h2', id: 'ads-sty-nc-h' }, t('sty.color.title')),
        field('sty.color.from', sel, t('sty.color.hint'), 'ads-sty-nc'),
        h('div', { class: 'ads-btnrow' }, save)
      ]));
    }
    // The old group is switched off first, then the new one on, so two are never on together.
    function setNameColour(id, btn) {
      btn.disabled = true;
      var steps = groups.filter(function (g) { return g.nameColor && g.id !== id; }).map(function (g) {
        return function () { return api.saveStyleGroup({ id: g.id, nameColor: false }).then(function () { g.nameColor = false; }); };
      });
      var on = id ? groupById(id) : null;
      if (on && !on.nameColor) steps.push(function () { return api.saveStyleGroup({ id: on.id, nameColor: true }).then(function () { on.nameColor = true; }); });
      steps.reduce(function (p, fn) { return p.then(fn); }, Promise.resolve())
        .then(function () { toast(t('sty.color.saved')); }, function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); })
        .then(function () { btn.disabled = false; if (!stale(tok)) syncColourFields(); });
    }
    // A group: heading + its token, letter and picture kind; "Edit group" (Save, Delete); its option cards.
    function groupSection(g) {
      var pre = 'ads-sty-g' + (++seq);
      var heading = h('h2', { class: 'ads-h2 ads-grouphead', id: pre + '-h', tabindex: '-1' }), meta = h('p', { class: 'ads-hint ads-grouphead__meta' });
      var grid = h('div', { class: 'ads-stylegrid' }), empty = h('p', { class: 'ads-note' }, t('sty.none'));
      var name = h('input', { type: 'text', id: pre + '-name', class: 'ads-input', value: g.name, maxlength: '60', autocomplete: 'off' });
      var token = h('input', { type: 'text', id: pre + '-token', class: 'ads-input ads-input--caps', value: g.token, maxlength: '20', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': pre + '-token-hint' });
      var prefix = h('input', { type: 'text', id: pre + '-prefix', class: 'ads-input ads-input--caps', value: g.prefix, maxlength: '1', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': pre + '-prefix-hint' });
      var kind = select(pre + '-kind', [['element', t('sty.grp.kind.element')], ['picture', t('sty.grp.kind.picture')]], g.pictureKind, function () {});
      var err = h('p', { class: 'ads-hint ads-hint--warn', role: 'alert' });
      var saveBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: save }, t('sty.grp.save'));
      var delBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--danger-ghost', onclick: del }, t('sty.grp.delete'));
      var addBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () {
        var sort = styles.reduce(function (a, s) { return s.groupId === g.id ? Math.max(a, s.sort) : a; }, 0) + 1;
        var s = { id: null, business: styBiz(), groupId: g.id, code: nextCode(g.prefix), name: '', prompt: '', imageId: null, textColor: null, active: true, sort: sort };
        styles.push(s);
        var card = styleCard(s, g, addBtn);
        grid.appendChild(card); empty.hidden = true;
        card.querySelectorAll('input[type=text]')[1].focus(); // the name (the code is filled in)
      } });
      var section = h('section', { class: 'ads-card', 'aria-labelledby': pre + '-h' }, [
        heading, meta,
        h('details', { class: 'ads-details ads-grouphead__edit' }, [h('summary', {}, t('sty.grp.edit')), h('div', { class: 'ads-grouphead__form' }, [
          h('div', { class: 'ads-row' }, [field('sty.grp.name', name, null, pre + '-name'), field('sty.grp.kind', kind, null, pre + '-kind')]),
          h('div', { class: 'ads-row' }, [field('sty.grp.token', token, t('sty.grp.token.hint'), pre + '-token'), field('sty.grp.prefix', prefix, t('sty.grp.prefix.hint'), pre + '-prefix')]),
          err, h('div', { class: 'ads-btnrow' }, [saveBtn, delBtn])
        ])]),
        empty, grid, h('div', { class: 'ads-btnrow' }, addBtn)
      ]);
      var mine = styles.filter(function (s) { return s.groupId === g.id; });
      mine.forEach(function (s) { grid.appendChild(styleCard(s, g, addBtn)); });
      empty.hidden = !!mine.length;
      head();
      return section;

      function head() {
        heading.textContent = g.name;
        meta.textContent = t('sty.grp.meta', { token: '{' + g.token + '}', prefix: g.prefix, kind: t('sty.grp.kindShort.' + g.pictureKind) });
        addBtn.textContent = t('sty.opt.add', { name: g.name });
      }
      function save() {
        var v = { name: name.value, token: token.value, prefix: prefix.value }, bad = groupProblem(groups, v, g);
        err.textContent = bad;
        if (bad) return;
        saveBtn.disabled = true;
        api.saveStyleGroup({ id: g.id, name: v.name, token: v.token, prefix: v.prefix, pictureKind: kind.value }).then(function (r) {
          Object.keys(r).forEach(function (k) { g[k] = r[k]; });
          name.value = g.name; token.value = g.token; prefix.value = g.prefix;
          head(); syncMeta();
          toast(t('sty.grp.saved', { name: g.name }));
        }, function (e) { err.textContent = errText(e); }).then(function () { saveBtn.disabled = false; });
      }
      function del() {
        var n = styles.filter(function (s) { return s.groupId === g.id && s.id; }).length;
        confirmDialog({ title: t('sty.grp.del.title'), message: t('sty.grp.del.text', { name: g.name, n: n }), confirmLabel: t('sty.grp.delete'), danger: true }).then(function (ok) {
          if (!ok) return;
          api.deleteStyleGroup(g.id).then(function () {
            groups.splice(groups.indexOf(g), 1);
            styles = styles.filter(function (s) { return s.groupId !== g.id; });
            section.remove(); syncMeta(); addGroupBtn.focus();
            toast(t('sty.grp.deleted', { name: g.name }));
          }, function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); });
        });
      }
    }
    // Next free code of a group: its letter + the highest number in use + 1 (F6 after F1-F5).
    function nextCode(letter) {
      var n = 0;
      styles.forEach(function (s) { if (String(s.code || '').charAt(0).toUpperCase() === letter) n = Math.max(n, styleNo(s.code)); });
      return letter + (n + 1);
    }
    // One option: code, name, reference picture, prompt, (name-colour group) colour, active; Save, Delete.
    // Picture changes of a saved option are saved at once; a new option keeps them until Save.
    function styleCard(s, g, addBtn) {
      var pre = 'ads-sty-o' + (++seq), imageId = s.imageId;
      var head = h('h3', { class: 'ads-style__title', id: pre + '-h' });
      var code = h('input', { type: 'text', id: pre + '-code', class: 'ads-input ads-input--caps', value: s.code, maxlength: '3', autocomplete: 'off', spellcheck: 'false' });
      var name = h('input', { type: 'text', id: pre + '-name', class: 'ads-input', value: s.name, maxlength: '80', autocomplete: 'off' });
      var prompt = h('textarea', { id: pre + '-prompt', class: 'ads-input ads-textarea', rows: '5', maxlength: '3000', spellcheck: 'false', lang: 'en' }, s.prompt);
      var color = h('input', { type: 'color', id: pre + '-color', class: 'ads-color', value: /^#[0-9a-f]{6}$/i.test(s.textColor || '') ? s.textColor.toLowerCase() : NAME_COLOR.toLowerCase() });
      var colorHex = h('span', { class: 'ads-color__hex', 'aria-hidden': 'true' }, color.value.toUpperCase());
      color.addEventListener('input', function () { colorHex.textContent = color.value.toUpperCase(); });
      // Ticked (the default): the colour follows the banner of each finished picture (white on dark, green on light).
      var auto = h('input', { type: 'checkbox', id: pre + '-auto', checked: !/^#[0-9a-f]{6}$/i.test(s.textColor || '') });
      function autoSync() { color.disabled = auto.checked; colorHex.hidden = auto.checked; }
      auto.addEventListener('change', autoSync); autoSync();
      var colorField = h('div', { class: 'ads-field' }, [h('label', { class: 'ads-label', for: pre + '-color' }, t('sty.color')),
        h('span', { class: 'ads-color__row' }, [h('label', { class: 'ads-option ads-option--inline', for: pre + '-auto' }, [auto, h('span', {}, t('sty.colorAuto'))]), color, colorHex])]);
      colorFields.push({ groupId: g.id, el: colorField });
      colorField.hidden = !g.nameColor;
      var active = h('input', { type: 'checkbox', id: pre + '-active', checked: s.active !== false });
      var pic = h('div', { class: 'ads-style__pic' });
      var file = h('input', { type: 'file', accept: api.imageRules.accept, hidden: true });
      var upBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--ghost', onclick: function () { file.click(); } }, t('sty.upload'));
      var chooseBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--ghost', onclick: function () {
        chooseLibraryImage(styBiz(), imageId).then(function (id) { if (id) setPicture(id); }, function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); });
      } }, t('sty.choose'));
      var removeBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--danger-ghost', onclick: function () { setPicture(null); upBtn.focus(); } }, t('sty.removePic'));
      var saveBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: saveCard }, t('sty.save'));
      var delBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--danger-ghost', onclick: del }, t('sty.delete'));
      file.addEventListener('change', function () {
        var f = file.files && file.files[0]; file.value = '';
        if (!f) return;
        var bad = api.checkImageFile(f);
        if (bad) { toast(f.name + ': ' + t(bad.key, bad.vars), 'act'); return; }
        upBtn.disabled = true;
        api.uploadImage(styBiz(), f, groupPlace(g)).then(function (im) { cacheImages([im]); setPicture(im.id); },
          function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); }).then(function () { upBtn.disabled = false; });
      });
      function title() { head.textContent = s.id ? s.code + ' — ' + s.name : t('sty.new'); }
      function drawPic() {
        pic.innerHTML = '';
        pic.appendChild(imageId && imageById(imageId) ? imageEl(imageId, 'ads-style__img') : h('div', { class: 'ads-style__img ads-img-empty' }, t(imageId ? 'common.noImage' : 'sty.noPic')));
        removeBtn.hidden = !imageId;
      }
      function setPicture(id) {
        imageId = id; drawPic();
        if (!s.id) return; // a new option: saved together with the rest
        api.saveStyle({ id: s.id, imageId: id }).then(function (r) { s.imageId = r.imageId; toast(t('sty.picSaved', { code: s.code })); },
          function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); });
      }
      function saveCard() {
        var c = code.value.trim().toUpperCase();
        if (!/^[A-Z]\d{1,2}$/.test(c)) { toast(t('sty.err.code'), 'act'); code.focus(); return; }
        if (styles.some(function (x) { return x !== s && x.id && styleKey(x.code) === styleKey(c); })) { toast(t('sty.err.codeTaken', { code: c }), 'act'); code.focus(); return; }
        if (!name.value.trim()) { toast(t('sty.err.name'), 'act'); name.focus(); return; }
        if (!prompt.value.trim()) { toast(t('sty.err.prompt'), 'act'); prompt.focus(); return; } // the database needs a prompt
        saveBtn.disabled = true;
        api.saveStyle({ id: s.id, business: styBiz(), groupId: g.id, code: c, name: name.value, prompt: prompt.value, imageId: imageId,
          textColor: g.nameColor ? (auto.checked ? null : color.value) : undefined, active: active.checked, sort: s.sort }).then(function (r) {
          var wasNew = !s.id;
          Object.keys(r).forEach(function (k) { s[k] = r[k]; });
          code.value = s.code; title();
          if (wasNew) cards[s.id] = link;
          toast(t('sty.saved', { code: s.code }));
        }, function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); }).then(function () { saveBtn.disabled = false; });
      }
      function del() {
        if (!s.id) { styles.splice(styles.indexOf(s), 1); card.remove(); addBtn.focus(); return; }
        confirmDialog({ title: t('sty.del.title'), message: t('sty.del.text', { code: s.code, name: s.name }), confirmLabel: t('sty.delete'), danger: true }).then(function (ok) {
          if (!ok) return;
          api.deleteStyle(s.id).then(function () {
            styles.splice(styles.indexOf(s), 1); delete cards[s.id];
            card.remove(); addBtn.focus();
            toast(t('sty.deleted', { code: s.code }));
          }, function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); });
        });
      }
      var card = h('article', { class: 'ads-style', 'aria-labelledby': pre + '-h' }, [
        head,
        h('div', { class: 'ads-style__picrow' }, [pic, h('div', { class: 'ads-style__picbtns' }, [upBtn, chooseBtn, removeBtn]), file]),
        h('div', { class: 'ads-row ads-row--code' }, [field('sty.code', code, null, pre + '-code'), field('sty.name', name, null, pre + '-name')]),
        field('sty.prompt', prompt, null, pre + '-prompt'),
        colorField,
        h('label', { class: 'ads-option ads-option--inline', for: pre + '-active' }, [active, h('span', {}, t('sty.active'))]),
        h('div', { class: 'ads-btnrow' }, [saveBtn, delBtn])
      ]);
      var link = { setImage: function (id) { imageId = id; s.imageId = id; drawPic(); } };
      if (s.id) cards[s.id] = link;
      title(); drawPic();
      return card;
    }
    // "Add a group": name; token suggested from the name in capitals; letter = the token's first letter
    // when free, else the first free letter; picture kind.
    function addGroup() {
      var name = h('input', { type: 'text', id: 'ads-sty-ng-name', class: 'ads-input', maxlength: '60', autocomplete: 'off', 'aria-describedby': 'ads-sty-ng-name-hint' });
      var token = h('input', { type: 'text', id: 'ads-sty-ng-token', class: 'ads-input ads-input--caps', maxlength: '20', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'ads-sty-ng-token-hint' });
      var prefix = h('input', { type: 'text', id: 'ads-sty-ng-prefix', class: 'ads-input ads-input--caps', maxlength: '1', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'ads-sty-ng-prefix-hint', value: freePrefix(groups, '') });
      var kind = select('ads-sty-ng-kind', [['element', t('sty.grp.kind.element')], ['picture', t('sty.grp.kind.picture')]], 'element', function () {});
      var err = h('p', { class: 'ads-hint ads-hint--warn', role: 'alert' });
      var tokenTyped = false, prefixTyped = false, created = null;
      name.addEventListener('input', function () {
        if (!tokenTyped) token.value = tokenFrom(name.value);
        if (!prefixTyped) prefix.value = freePrefix(groups, token.value.charAt(0));
      });
      token.addEventListener('input', function () { tokenTyped = true; if (!prefixTyped) prefix.value = freePrefix(groups, token.value.charAt(0)); });
      prefix.addEventListener('input', function () { prefixTyped = true; });
      openDialog({
        title: t('sty.grp.addTitle'),
        body: h('div', {}, [field('sty.grp.name', name, t('sty.grp.name.hint'), 'ads-sty-ng-name'), field('sty.grp.token', token, t('sty.grp.token.hint'), 'ads-sty-ng-token'),
          field('sty.grp.prefix', prefix, t('sty.grp.prefix.hint'), 'ads-sty-ng-prefix'), field('sty.grp.kind', kind, null, 'ads-sty-ng-kind'), err]),
        actions: [{ label: t('sty.grp.create'), value: 'add' }],
        onOpen: function () { name.focus(); },
        onAction: function () {
          var v = { name: name.value, token: token.value, prefix: prefix.value }, bad = groupProblem(groups, v, null);
          err.textContent = bad;
          if (bad) return false;
          var sort = groups.reduce(function (a, g) { return Math.max(a, g.sort); }, 0) + 1;
          return api.saveStyleGroup({ business: styBiz(), name: v.name, token: v.token, prefix: v.prefix, pictureKind: kind.value, nameColor: false, sort: sort })
            .then(function (g) { created = g; return true; }, function (e) { err.textContent = errText(e); return false; });
        }
      }).then(function () {
        if (!created || stale(tok)) return;
        groups.push(created);
        var sec = groupSection(created);
        groupsBox.appendChild(sec);
        syncMeta();
        toast(t('sty.grp.saved', { name: created.name }));
        $('.ads-grouphead', sec).focus();
      });
    }
    // Many files at once: each file whose name starts with a code goes to the library (as its group's
    // picture kind) and to that option.
    function bulk(files) {
      var byCode = {}, used = {};
      styles.forEach(function (s) { if (s.id && styleKey(s.code)) byCode[styleKey(s.code)] = s; });
      var list = files.map(function (f, i) {
        var code = fileStyleCode(f.name), s = code ? byCode[code] || null : null;
        var problem = i >= rules.maxFiles ? { key: 'lib.err.tooMany', vars: { max: rules.maxFiles } } : api.checkImageFile(f);
        var dup = !!(s && !problem && used[s.id]);
        if (s && !problem && !dup) used[s.id] = true;
        return { file: f, style: s, problem: problem, dup: dup };
      });
      var ok = list.filter(function (x) { return x.style && !x.problem && !x.dup; });
      var rows = h('ul', { class: 'ads-filelist' }, list.map(function (x) {
        var good = x.style && !x.problem && !x.dup;
        var text = x.problem ? t(x.problem.key, x.problem.vars) : !x.style ? t('sty.bulk.noMatch')
          : x.dup ? t('sty.bulk.dup', { code: x.style.code }) : t('sty.bulk.match', { code: x.style.code, name: x.style.name });
        return h('li', { class: 'ads-filelist__item' }, [h('span', { class: 'ads-filelist__name' }, x.file.name), h('span', { class: 'ads-filelist__size' }, fmtBytes(x.file.size)),
          h('span', { class: 'ads-filelist__state ads-filelist__state--' + (good ? 'ok' : 'bad') }, text)]);
      }));
      openDialog({
        title: t('sty.bulk.title'), wide: true,
        body: h('div', {}, [h('p', { class: 'ads-note' }, t('sty.bulk.intro')), rows, ok.length ? null : h('p', { class: 'ads-warn' }, t('sty.bulk.none'))]),
        actions: [{ label: t(ok.length === 1 ? 'lib.uploadOne' : 'lib.uploadN', { n: ok.length }), value: true, disabled: !ok.length }]
      }).then(function (yes) { if (yes) runBulk(ok); });
    }
    function runBulk(items) {
      var biz = styBiz(), done = 0, failed = [];
      styJob = { key: 'lib.progress', n: 1, total: items.length };
      function step(i) {
        if (i >= items.length) return finish();
        var x = items[i], g = groupById(x.style.groupId);
        styJob.n = i + 1; stySync();
        return api.uploadImage(biz, x.file, groupPlace(g)).then(function (im) {
          cacheImages([im]);
          return api.saveStyle({ id: x.style.id, imageId: im.id }).then(function () {
            x.style.imageId = im.id; done++;
            if (cards[x.style.id]) cards[x.style.id].setImage(im.id);
          });
        }).then(null, function () { failed.push(x.file.name); }).then(function () { return step(i + 1); });
      }
      function finish() {
        styJob = null; stySync();
        if (!failed.length) toast(t('sty.bulk.done', { n: done }));
        else toast(t('sty.bulk.failed', { n: done, f: failed.length, names: failed.slice(0, 3).join(', ') + (failed.length > 3 ? ', …' : '') }), 'act');
      }
      step(0);
    }
    // "Import from Prompt Library (Excel)": read, show what was found, then add / update (never delete).
    function readLibrary(file) {
      var SI = window.AdsStockImport;
      if (!/\.(xlsx|xls|ods)$/i.test(file.name || '')) { toast(t('sty.imp.err.type'), 'act'); return; }
      if (file.size > 10 * 1048576) { toast(t('stock.err.size', { mb: 10 }), 'act'); return; }
      if (!SI || !SI.loadXlsx) { toast(t('stock.err.load'), 'act'); return; }
      status.textContent = t('stock.reading');
      SI.loadXlsx().then(function (X) {
        return file.arrayBuffer().then(function (buf) {
          var wb;
          try { wb = X.read(new Uint8Array(buf), { type: 'array', cellFormula: false, cellHTML: false }); } catch (e) {
            var err = new Error('read'); err.key = /password|encrypt/i.test(String(e && e.message)) ? 'stock.err.password' : 'stock.err.read'; throw err;
          }
          return parsePromptLibrary(X, wb);
        });
      }).then(function (lib) {
        status.textContent = '';
        if (!stale(tok)) previewImport(lib, file);
      }, function (e) { status.textContent = ''; toast(e && e.key ? t(e.key, e.vars) : t('stock.err.read'), 'act'); });
    }
    function previewImport(lib, file) {
      var byToken = {}, byCode = {};
      groups.forEach(function (g) { byToken[g.token] = g; });
      styles.forEach(function (s) { if (s.id && styleKey(s.code)) byCode[styleKey(s.code)] = s; });
      var tplKeys = ['template', 'rules', 'textAi', 'textOverlay'].filter(function (k) { return lib.settings[k]; });
      var replace = h('input', { type: 'checkbox', id: 'ads-imp-tpl', checked: !ps || !String(ps.template || '').trim() });
      var nothing = !lib.groups.length && !tplKeys.length;
      var list = h('ul', { class: 'ads-filelist' }, lib.groups.map(function (gr) {
        var ex = byToken[gr.token], a = 0, b = 0;
        gr.options.forEach(function (o) { if (byCode[styleKey(o.code)]) b++; else a++; });
        return h('li', { class: 'ads-filelist__item' }, [
          h('span', { class: 'ads-filelist__name' }, gr.sheet + ' → {' + gr.token + '}'),
          h('span', { class: 'ads-filelist__size' }, ex ? t('sty.imp.existing', { name: ex.name }) : t('sty.imp.newGroup', { name: gr.name, prefix: freePrefix(groups, gr.prefix) })),
          h('span', { class: 'ads-filelist__state ads-filelist__state--ok' }, t('sty.imp.opts', { n: gr.options.length, a: a, b: b }) + (gr.skipped ? ' · ' + t('sty.imp.skipped', { n: gr.skipped }) : ''))
        ]);
      }));
      openDialog({
        title: t('sty.imp.title'), wide: true,
        body: h('div', {}, [
          h('p', { class: 'ads-note' }, t('sty.imp.intro')),
          kv([[t('stock.pv.file'), file.name]]),
          nothing ? h('p', { class: 'ads-warn' }, t('sty.imp.none')) : null,
          lib.groups.length ? h('h3', { class: 'ads-h3' }, t('sty.imp.groups', { n: lib.groups.length })) : null,
          lib.groups.length ? list : null,
          h('h3', { class: 'ads-h3' }, t('sty.tpl')),
          h('p', {}, tplKeys.length ? t('sty.imp.tpl', { list: tplKeys.map(function (k) { return t(LIB_TPL_LABELS[k]); }).join(', ') }) : t('sty.imp.noTpl')),
          tplKeys.length ? h('label', { class: 'ads-option ads-option--inline', for: 'ads-imp-tpl' }, [replace, h('span', {}, t('sty.imp.replace'))]) : null
        ]),
        actions: [{ label: t('sty.imp.go'), value: 'go', disabled: nothing }]
      }).then(function (v) { if (v === 'go' && !stale(tok)) runImport(lib, !!(tplKeys.length && replace.checked)); });
    }
    // Missing groups are created (by token), options added or updated by code, nothing is deleted.
    function runImport(lib, withTpl) {
      var biz = styBiz(), res = { groups: 0, added: 0, updated: 0, tpl: false, failed: [] }, byToken = {}, byCode = {};
      groups.forEach(function (g) { byToken[g.token] = g; });
      styles.forEach(function (s) { if (s.id && styleKey(s.code)) byCode[styleKey(s.code)] = s; });
      styJob = { key: 'sty.imp.progress', n: 0, total: lib.groups.reduce(function (a, gr) { return a + gr.options.length + 1; }, 0) + (withTpl ? 1 : 0) };
      function tick() { styJob.n++; stySync(); }
      var chain = Promise.resolve();
      lib.groups.forEach(function (gr) {
        var target = null;
        chain = chain.then(function () {
          tick();
          target = byToken[gr.token] || null;
          if (target) return null;
          var sort = groups.reduce(function (a, g) { return Math.max(a, g.sort); }, 0) + 1;
          return api.saveStyleGroup({ business: biz, name: gr.name, token: gr.token, prefix: freePrefix(groups, gr.prefix), pictureKind: gr.pictureKind, nameColor: false, sort: sort })
            .then(function (g) { groups.push(g); byToken[g.token] = g; target = g; res.groups++; },
              function (e) { res.failed.push(gr.sheet + ' (' + errText(e) + ')'); });
        });
        gr.options.forEach(function (o, i) {
          chain = chain.then(function () {
            tick();
            if (!target) return null; // the group could not be made: already listed
            var ex = byCode[styleKey(o.code)];
            var d = ex ? { id: ex.id, groupId: target.id, name: o.name || o.code, prompt: o.prompt, sort: i + 1 }
              : { business: biz, groupId: target.id, code: o.code, name: o.name || o.code, prompt: o.prompt, active: true, sort: i + 1 };
            return api.saveStyle(d).then(function (s) { if (ex) res.updated++; else { res.added++; byCode[styleKey(s.code)] = s; } },
              function () { res.failed.push(o.code); });
          });
        });
      });
      if (withTpl) {
        chain = chain.then(function () {
          tick();
          var cur = ps || {}, s = lib.settings;
          function pickText(k) { return s[k] != null ? s[k] : cur[k] || ''; }
          return api.savePictureSettings(biz, { template: pickText('template'), rules: pickText('rules'), textAi: pickText('textAi'), textOverlay: pickText('textOverlay'), aspect: cur.aspect || '3:4' })
            .then(function (r) { ps = r; res.tpl = true; }, function (e) { res.failed.push(t('sty.tpl') + ' (' + errText(e) + ')'); });
        });
      }
      chain.then(function () {
        styJob = null; stySync();
        toast(t('sty.imp.done', { g: res.groups, a: res.added, b: res.updated }) + (res.tpl ? ' ' + t('sty.imp.doneTpl') : ''));
        if (res.failed.length) toast(t('sty.imp.failed', { f: res.failed.length, names: res.failed.slice(0, 5).join(', ') + (res.failed.length > 5 ? ', …' : '') }), 'act');
        if (!stale(tok)) load();
      });
    }
  }

  /* ---------------------------------------------------------------------
     10. Products and stock: upload a stock file, check it, then save
     --------------------------------------------------------------------- */
  var stockQuery = '';
  var STOCK_SHOW = 200; // rows in the table; the search finds the others

  function viewProducts(tok) {
    var SI = window.AdsStockImport, busy = false, tplBusy = false;
    var current = []; // this business's stock products (no samples): "new" and "updated" are counted against it
    var body = h('div', {}, skeleton(4));
    var status = h('p', { class: 'ads-note ads-status', 'aria-live': 'polite' });
    var picker = h('input', { type: 'file', hidden: true,
      accept: '.xlsx,.xls,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet,text/csv' });
    picker.addEventListener('change', function () { var f = picker.files && picker.files[0]; picker.value = ''; if (f) readFile(f); });
    render(h('div', {}, [
      pageHead('nav.products', [
        h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function () { if (busy) toast(t('lib.busy'), 'act'); else picker.click(); } }, t('stock.upload')),
        h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: getTemplate }, t('stock.template')),
        soonBtn('stock.connect')
      ]),
      h('section', { class: 'ads-format', 'aria-labelledby': 'ads-s-fmt' }, [h('h2', { class: 'ads-h3', id: 'ads-s-fmt' }, t('stock.fmt.title')), h('p', {}, rich(t('stock.fmt')))]),
      picker, status, body
    ]), 'nav.products');
    load();

    function load() {
      // The library comes along for the product photos (a failed library read only hides them).
      Promise.all([api.listProducts(ctx.business, { strict: true }), api.listImages(ctx.business)]).then(function (r) {
        if (stale(tok)) return;
        cacheImages(r[1]);
        current = r[0].filter(function (p) { return !p.sample; });
        draw(r[0].filter(function (p) { return p.sample; }));
      }).catch(function () { if (!stale(tok)) { body.innerHTML = ''; body.appendChild(errorState(load)); } });
    }
    function draw(samples) {
      body.innerHTML = '';
      if (current.length) {
        var last = current.reduce(function (a, p) { return p.updatedAt && p.updatedAt > a ? p.updatedAt : a; }, '');
        var search = h('input', { type: 'search', id: 'ads-s-q', class: 'ads-input', value: stockQuery, placeholder: t('stock.search'), 'aria-label': t('stock.search'), autocomplete: 'off' });
        var count = h('p', { class: 'ads-note ads-status', 'aria-live': 'polite' }), table = h('div', {});
        var fill = function () {
          var q = normName(stockQuery);
          var hits = current.filter(function (p) { return !q || normName(p.name).indexOf(q) !== -1; });
          count.textContent = !hits.length ? t('stock.noMatch', { q: stockQuery.trim() })
            : hits.length > STOCK_SHOW ? t('stock.showing', { shown: num(STOCK_SHOW), n: num(hits.length) }) : '';
          table.innerHTML = '';
          if (hits.length) table.appendChild(stockTable(hits.slice(0, STOCK_SHOW)));
        };
        search.addEventListener('input', function () { stockQuery = search.value; fill(); });
        body.appendChild(h('p', { class: 'ads-note' }, t('stock.last', { date: last ? fmtDateTime(last) : '-', n: num(current.length) })));
        body.appendChild(h('div', { class: 'ads-search' }, search));
        body.appendChild(count); body.appendChild(table);
        fill();
      } else {
        body.appendChild(emptyState('stock.emptyTitle', 'stock.emptyText'));
      }
      if (samples.length) {
        body.appendChild(h('details', { class: 'ads-details ads-samples' }, [
          h('summary', {}, t('stock.samples', { n: samples.length })),
          h('div', { class: 'ads-tablewrap', tabindex: '0', role: 'region', 'aria-label': t('stock.samples', { n: samples.length }) }, h('table', { class: 'ads-table ads-table--stack' }, [
            h('thead', {}, h('tr', {}, [h('th', { scope: 'col' }, t('stock.col.name')), h('th', { scope: 'col' }, t('stock.col.price'))])),
            h('tbody', {}, samples.map(function (p) {
              return h('tr', {}, [h('td', { 'data-label': t('stock.col.name'), class: 'ads-wrap' }, lname(p, 'name')), h('td', { 'data-label': t('stock.col.price'), class: 'ads-num' }, gel(p.price))]);
            }))
          ]))
        ]));
      }
    }
    var COLS = ['pd.col.photo', 'stock.col.name', 'stock.col.qty', 'stock.col.price', 'stock.col.updated', 'col.actions'];
    function stockTable(rows) {
      return h('div', { class: 'ads-tablewrap', tabindex: '0', role: 'region', 'aria-label': t('nav.products') }, h('table', { class: 'ads-table ads-table--stack' }, [
        h('thead', {}, h('tr', {}, COLS.map(function (c) { return h('th', { scope: 'col' }, t(c)); }))),
        h('tbody', {}, rows.map(function (p) { return row(p); }))
      ]));
    }
    // One stock row: photo (or "Add photo"), names and details, quantity, price, updated, Details.
    function row(p) {
      var ph = photoOf(p), tr = null;
      tr = h('tr', {}, [
        h('td', { 'data-label': t(COLS[0]) }, ph
          ? h('img', { class: 'ads-pthumb', src: imageUri(ph), alt: t('pd.photoAlt', { name: p.name }), loading: 'lazy', width: '48', height: '48' })
          : h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--ghost', 'aria-label': t('pd.addPhotoAria', { name: p.name }), onclick: function () { details(p, tr, true); } }, t('pd.addPhoto'))),
        h('td', { 'data-label': t(COLS[1]), class: 'ads-wrap' }, h('span', { class: 'ads-pname' }, [
          h('span', {}, p.name),
          p.displayName ? h('span', { class: 'ads-sub' }, t('pd.on', { name: p.displayName })) : null,
          p.nameEn ? h('span', { class: 'ads-sub' }, t('pd.en', { name: p.nameEn })) : null,
          p.aiNote ? h('span', { class: 'ads-sub' }, t('pd.note', { note: p.aiNote })) : null
        ])),
        h('td', { 'data-label': t(COLS[2]), class: 'ads-num' }, h('span', {}, p.quantity === 0 ? [qty(0), ' ', pill(t('stock.out'), 'out')] : qty(p.quantity))),
        h('td', { 'data-label': t(COLS[3]), class: 'ads-num' }, gel(p.price)),
        h('td', { 'data-label': t(COLS[4]) }, p.updatedAt ? fmtDateTime(p.updatedAt) : '-'),
        h('td', { 'data-label': t(COLS[5]), class: 'ads-actions' }, h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--ghost',
          'aria-label': t('pd.detailsAria', { name: p.name }), onclick: function () { details(p, tr, false); } }, t('pd.details')))
      ]);
      return tr;
    }
    // Product details: photo (upload, choose from the library, remove), display name, English name,
    // description for the picture AI. Nothing is saved before Save; an uploaded photo is already in the library.
    function details(p, tr, photoFirst) {
      var biz = ctx.business, imageId = p.imageId || null, uploading = false, saveBtn = null;
      var photo = h('div', { class: 'ads-pd__photo' });
      var pstatus = h('p', { class: 'ads-note ads-status', 'aria-live': 'polite' });
      var saveStatus = h('p', { class: 'ads-hint ads-hint--warn', role: 'alert' });
      var file = h('input', { type: 'file', accept: api.imageRules.accept, hidden: true });
      var upBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--ghost', onclick: function () { if (!uploading) file.click(); } }, t('pd.upload'));
      var chooseBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--ghost', onclick: function () {
        chooseLibraryImage(biz, imageId).then(function (id) { if (id) { imageId = id; drawPhoto(); } }, function (e) { pstatus.textContent = t('toast.failed') + ' ' + errText(e); });
      } }, t('pd.choose'));
      var removeBtn = h('button', { type: 'button', class: 'ads-btn ads-btn--small ads-btn--danger-ghost', onclick: function () { imageId = null; drawPhoto(); upBtn.focus(); } }, t('pd.remove'));
      var dn = h('input', { type: 'text', id: 'ads-pd-dn', class: 'ads-input', value: p.displayName || '', maxlength: '200', autocomplete: 'off', placeholder: p.name, 'aria-describedby': 'ads-pd-dn-hint' });
      var en = h('input', { type: 'text', id: 'ads-pd-en', class: 'ads-input', value: p.nameEn || '', maxlength: '200', autocomplete: 'off', lang: 'en', 'aria-describedby': 'ads-pd-en-hint' });
      var note = h('textarea', { id: 'ads-pd-note', class: 'ads-input ads-textarea ads-textarea--short', rows: '3', maxlength: '500', lang: 'en', 'aria-describedby': 'ads-pd-note-hint' }, p.aiNote || '');
      file.addEventListener('change', function () {
        var f = file.files && file.files[0]; file.value = '';
        if (!f) return;
        var bad = api.checkImageFile(f);
        if (bad) { pstatus.textContent = f.name + ': ' + t(bad.key, bad.vars); return; }
        uploading = true; upBtn.disabled = true; if (saveBtn) saveBtn.disabled = true;
        pstatus.textContent = t('pd.uploading');
        api.uploadImage(biz, f, { folder: 'products' }, { title: p.name }).then(function (im) {
          cacheImages([im]); imageId = im.id; drawPhoto(); pstatus.textContent = t('pd.uploaded');
        }, function (e) { pstatus.textContent = t('toast.failed') + ' ' + errText(e); }).then(function () {
          uploading = false; upBtn.disabled = false; if (saveBtn) saveBtn.disabled = false;
        });
      });
      function drawPhoto() {
        var im = imageId ? imageById(imageId) : null;
        photo.innerHTML = '';
        photo.appendChild(im && imageUri(im) ? h('img', { class: 'ads-pd__img', src: imageUri(im), alt: t('pd.photoAlt', { name: p.name }) })
          : h('div', { class: 'ads-pd__img ads-img-empty' }, t(imageId ? 'common.noImage' : 'pd.noPhoto')));
        removeBtn.hidden = !imageId;
      }
      drawPhoto();
      openDialog({
        title: t('pd.title', { name: p.name }), wide: true,
        body: h('div', {}, [
          liveMode() ? null : h('p', { class: 'ads-warn' }, t('lib.mockNote')),
          h('h3', { class: 'ads-h3 ads-pd__h' }, t('pd.photo')),
          h('div', { class: 'ads-pd__row' }, [photo, h('div', { class: 'ads-pd__btns' }, [upBtn, chooseBtn, removeBtn])]), file,
          h('p', { class: 'ads-hint' }, t('pd.photoHint', { mb: api.imageRules.maxMb })), pstatus,
          field('pd.displayName', dn, t('pd.displayName.hint', { name: p.name }), 'ads-pd-dn'),
          field('pd.nameEn', en, t('pd.nameEn.hint'), 'ads-pd-en'),
          field('pd.aiNote', note, t('pd.aiNote.hint'), 'ads-pd-note'),
          saveStatus
        ]),
        actions: [{ label: t('pd.save'), value: 'save' }],
        onOpen: function (dlg, btns) { saveBtn = btns.save; (photoFirst ? upBtn : dn).focus(); },
        onAction: function () {
          if (uploading) return false;
          saveStatus.textContent = '';
          return api.setProductDetails(p.id, { imageId: imageId, displayName: dn.value, nameEn: en.value, aiNote: note.value }).then(function (r) {
            p.imageId = r.imageId; p.displayName = r.displayName; p.nameEn = r.nameEn; p.aiNote = r.aiNote;
            return true;
          }, function (e) { saveStatus.textContent = t('toast.failed') + ' ' + errText(e); return false; });
        }
      }).then(function (v) {
        if (v !== 'save') return;
        toast(t('pd.saved', { name: p.name }));
        if (stale(tok) || !tr.parentNode) return;
        var nr = row(p);
        tr.parentNode.replaceChild(nr, tr);
        nr.querySelector('.ads-actions button').focus();
      });
    }
    function getTemplate() {
      if (!SI) { toast(t('stock.err.load'), 'act'); return; }
      if (tplBusy) return;
      tplBusy = true;
      SI.template().then(function () { toast(t('stock.tplDone')); }, function (e) { toast(t(e && e.key ? e.key : 'stock.err.load'), 'act'); })
        .then(function () { tplBusy = false; });
    }
    function readFile(file) {
      if (!SI) { toast(t('stock.err.load'), 'act'); return; }
      busy = true; status.textContent = t('stock.reading');
      SI.read(file).then(function (res) {
        busy = false; status.textContent = '';
        if (stale(tok)) return;
        if (res.error) showFileError(file, res.error); else preview(file, res);
      }).catch(function (e) {
        busy = false; status.textContent = '';
        toast(e && e.key ? t(e.key, e.vars) : t('stock.err.read'), 'act');
      });
    }
    function showFileError(file, err) {
      openDialog({
        title: t('stock.err.title'), noCancel: true, actions: [{ label: t('common.close'), value: true }],
        body: h('div', {}, [h('p', {}, h('strong', {}, file.name)), h('p', {}, t(err.key, err.vars)), h('p', { class: 'ads-note' }, rich(t('stock.fmt')))])
      });
    }
    // What will happen, before anything is saved: the counts, every skipped row, the notes, the first rows.
    function preview(file, res) {
      var have = {}, inFile = {}, added = 0, changed = 0, ready = res.rows.length;
      current.forEach(function (p) { have[normName(p.name)] = true; });
      res.rows.forEach(function (r) { var k = normName(r.name); inFile[k] = true; if (have[k]) changed++; else added++; });
      var untouched = current.filter(function (p) { return !inFile[normName(p.name)]; }).length;
      function colName(c) { return c ? t('stock.pv.col', { title: c.title, letter: c.letter }) : t('stock.pv.noPriceCol'); }
      var box = h('div', {}, [
        kv([[t('stock.pv.file'), file.name], [t('stock.pv.sheet'), res.sheet], [t('stock.pv.header'), String(res.headerRow)],
          [t('stock.pv.columns'), [res.columns.name, res.columns.quantity, res.columns.price].map(colName).join(' · ')]]),
        h('p', { class: 'ads-total' }, t('stock.pv.summary', { n: num(res.totalRows), r: num(ready), a: num(added), b: num(changed), s: num(res.problems.length) })),
        untouched ? h('p', { class: 'ads-note' }, t('stock.pv.untouched', { m: num(untouched) })) : null,
        issues('stock.pv.problems', res.problems, 'act'),
        issues('stock.pv.notes', res.notes, 'watch'),
        ready ? firstRows(res.rows.slice(0, 10)) : h('p', { class: 'ads-warn' }, t('stock.pv.nothing'))
      ]);
      openDialog({
        title: t('stock.pv.title'), body: box, wide: true,
        actions: [{ label: t(ready === 1 ? 'stock.pv.importOne' : 'stock.pv.import', { n: num(ready) }), value: true, disabled: !ready }]
      }).then(function (yes) { if (yes) save(res.rows); });
    }
    // Row-numbered reasons (first 50, then "and N more").
    function issues(titleKey, list, mod) {
      if (!list.length) return null;
      var MAX = 50;
      var ul = h('ul', { class: 'ads-issues ads-issues--' + mod }, list.slice(0, MAX).map(function (p) {
        return h('li', {}, [h('strong', {}, t('stock.pv.row', { n: p.row })), ' ', t(p.key, p.vars)]);
      }));
      if (list.length > MAX) ul.appendChild(h('li', { class: 'ads-issues__more' }, t('stock.pv.more', { n: num(list.length - MAX) })));
      return h('div', {}, [h('h3', { class: 'ads-h3' }, t(titleKey, { n: num(list.length) })), ul]);
    }
    function firstRows(rows) {
      var cols = ['stock.pv.rowCol', 'stock.col.name', 'stock.col.qty', 'stock.col.price'];
      return h('div', {}, [
        h('h3', { class: 'ads-h3' }, t('stock.pv.first', { n: rows.length })),
        h('div', { class: 'ads-tablewrap', tabindex: '0', role: 'region', 'aria-label': t('stock.pv.first', { n: rows.length }) }, h('table', { class: 'ads-table ads-table--compact' }, [
          h('thead', {}, h('tr', {}, cols.map(function (c) { return h('th', { scope: 'col' }, t(c)); }))),
          h('tbody', {}, rows.map(function (r) {
            return h('tr', {}, [h('td', {}, String(r.row)), h('td', { class: 'ads-wrap' }, r.name), h('td', { class: 'ads-num' }, qty(r.quantity)), h('td', { class: 'ads-num' }, gel(r.sell_price))]);
          }))
        ]))
      ]);
    }
    function save(rows) {
      busy = true; status.textContent = t('stock.savingStart');
      api.importStock(ctx.business, rows.map(function (r) { return { name: r.name, quantity: r.quantity, sell_price: r.sell_price }; }), function (done, total) {
        status.textContent = t('stock.saving', { n: num(done), total: num(total) });
      }).then(function (r) {
        toast(t('stock.done', { a: num(r['new']), b: num(r.updated) }));
      }, function (e) {
        toast(e && e.saved ? t('stock.partial', { n: num(e.saved), total: num(e.total) }) : t('toast.failed') + ' ' + errText(e), 'act');
      }).then(function () {
        busy = false; status.textContent = '';
        if (!stale(tok)) load();
      });
    }
  }

  /* ---------------------------------------------------------------------
     11. Settings: what is real today, plus placeholders for later rounds
     --------------------------------------------------------------------- */
  // Connections and API keys, grouped (owner's list V-19), per company (D-46, 11 Nov 2026): every
  // company has its own; they will be kept in the advertising platform's own encrypted store, separate
  // from the other Phantasma services (owner, 11 Nov 2026: also Shopify / Amazon, if ads ever needs them).
  // Nothing is saved yet: every key field is disabled, so nobody pastes a real key into a box that does
  // not keep it. fields: [label key, input type]. connect: joined by signing in later, not by a key.
  // ch / tool: the first-visit ticks that mark a service "Chosen for this company" (listed first).
  var SERVICES = [
    ['social', [
      { id: 'meta', ch: ['facebook', 'instagram', 'messenger', 'threads'], fields: [['set.f.metaToken', 'password'], ['set.f.appId', 'text'], ['set.f.appSecret', 'password']] },
      { id: 'whatsapp', ch: ['whatsapp'], fields: [['set.f.phoneId', 'text'], ['set.f.wabaId', 'text'], ['set.f.accessToken', 'password']] },
      { id: 'tiktok', ch: ['tiktok'], fields: [['set.f.advertiserId', 'text'], ['set.f.accessToken', 'password']] },
      { id: 'youtube', ch: ['youtube'], connect: 'set.connectYoutube' },
      { id: 'linkedin', ch: ['linkedin'], fields: [['set.f.orgId', 'text'], ['set.f.accessToken', 'password']] },
      { id: 'x', ch: ['x'], connect: 'set.connectAccount' },
      { id: 'pinterest', ch: ['pinterest'], connect: 'set.connectAccount' },
      { id: 'telegram', ch: ['telegram'], fields: [['set.f.botToken', 'password']] },
      { id: 'gbp', ch: ['gbp'], connect: 'set.connectAccount' }
    ]],
    ['stores', [
      { id: 'shopify', fields: [['set.f.shopDomain', 'text'], ['set.f.accessToken', 'password']] },
      { id: 'amazon', fields: [['set.f.lwaClientId', 'text'], ['set.f.lwaSecret', 'password'], ['set.f.refreshToken', 'password']] },
      { id: 'woo', fields: [['set.f.siteUrl', 'url'], ['set.f.consumerKey', 'text'], ['set.f.consumerSecret', 'password']] }
    ]],
    ['tools', ['monday', 'clickup', 'notion', 'trello', 'asana', 'slack'].map(function (k) { return { id: k, tool: k, connect: 'set.connectAccount' }; })],
    ['analytics', [{ id: 'ga', fields: [['set.f.measurementId', 'text'], ['set.f.apiSecret', 'password']] }]],
    ['files', [
      { id: 'drive', tool: 'drive', connect: 'set.connectDrive' },
      { id: 'pos', fields: [['set.f.apiUrl', 'url'], ['set.f.apiKey', 'password']] }
    ]]
  ];

  // Settings icons (owner, 14 Nov 2026: "everything should have an icon" — ChatGPT was mistaken for Claude; then
  // "use official logos of each integration company"). The logos are in logos.js (window.AdsLogos, sources and
  // licences there); a service without a brand (the stock system) gets this plain box. Constant markup only.
  var SVC_PLAIN = '<path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8" fill="none" stroke="#5B6B7A" stroke-width="2" stroke-linejoin="round"/>';
  var SVC_BADGE = {
    ok: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 8.5l2.5 2.5L12 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 20 18" aria-hidden="true" focusable="false"><path class="ads-svcicon__tri" d="M10 1.5L19 16.5H1z" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 6.3v4.6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="13.7" r="1.15" fill="#fff"/></svg>'
  };
  // The icon of one service: its logo on a white square; a green tick (works) or a red warning sign (its key
  // failed the last test) at the corner.
  function svcIcon(id, state) {
    var logo = (window.AdsLogos || {})[id] || null;
    var img = h('span', { class: 'ads-svcicon__img' + (logo && logo[0] > 2 * logo[1] ? ' ads-svcicon__img--wide' : ''), 'aria-hidden': 'true' });
    img.innerHTML = logo ? '<svg viewBox="0 0 ' + logo[0] + ' ' + logo[1] + '" aria-hidden="true" focusable="false">' + logo[2] + '</svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + SVC_PLAIN + '</svg>';
    if (SVC_BADGE[state]) {
      var badge = h('span', { class: 'ads-svcicon__badge ads-svcicon__badge--' + state });
      badge.innerHTML = SVC_BADGE[state];
      img.appendChild(badge);
    }
    return img;
  }

  // AI tools: one key each for the whole agency, used for every company (owner D-64, 13 Nov 2026).
  var AI_SERVICES = [{ id: 'claude', fields: [['set.f.apiKey', 'password']] }, { id: 'gemini', fields: [['set.f.apiKey', 'password']] },
    { id: 'openai', fields: [['set.f.apiKey', 'password']] }];
  var KEY_LIVE = ['meta', 'claude', 'gemini', 'openai']; // keys that can be saved and tested today (0043 + ads-connections)
  // Which service a pasted key belongs to, from how it starts (same rule in the server function ads-connections):
  // Claude sk-ant-… (Admin keys sk-ant-admin…), ChatGPT sk-…, Gemini AIza…, Meta EAA…; null = unknown (the test decides).
  function keyKind(v) {
    if (/^sk-ant-admin/.test(v)) return 'claudeAdmin';
    if (/^sk-ant-/.test(v)) return 'claude';
    if (/^AIza/.test(v)) return 'gemini';
    if (/^sk-/.test(v)) return 'openai';
    if (/^EAA/.test(v)) return 'meta';
    return null;
  }
  var openKey = null; // the key row to open again after the page is drawn anew
  function viewSettings(tok) {
    // Live: the stored keys first (only their status, last 4 characters and what the test found).
    if (liveMode() && tok !== undefined && !viewSettings.loaded) {
      render(h('div', {}, [pageHead('nav.settings'), skeleton(4)]), 'nav.settings');
      api.listConnections().then(function (list) {
        if (stale(tok)) return;
        viewSettings.loaded = { list: list, err: null }; viewSettings(tok); viewSettings.loaded = null;
      }, function (e) {
        if (stale(tok)) return;
        viewSettings.loaded = { list: [], err: e }; viewSettings(tok); viewSettings.loaded = null;
      });
      return;
    }
    var keys = viewSettings.loaded || { list: [], err: null };
    var live = liveMode(), L = settings.limits;
    var biz = settings.businesses.filter(function (b) { return b.id === ctx.business; })[0] || settings.businesses[0] || null;
    function card(id, titleKey, kids, mod) {
      return h('section', { class: 'ads-card' + (mod ? ' ads-card--' + mod : ''), 'aria-labelledby': 'ads-set-' + id },
        [h('h2', { class: 'ads-h2', id: 'ads-set-' + id }, t(titleKey))].concat(kids));
    }
    function btns(list) { return h('div', { class: 'ads-btnrow' }, list); }
    function connOf(provider, business) {
      return keys.list.filter(function (c) { return c.provider === provider && (business ? c.business_id === business : !c.business_id); })[0] || null;
    }
    // A key that works today (live): Meta per company, AI tools for the agency. Opened, it shows the status,
    // what the test found, a field to paste a (new) key, Test again and Remove.
    function keyRow(s, business) {
      var c = connOf(s.id, business);
      var canEdit = !!access && access.role === 'admin' && (business ? true : access.allCompanies);
      // The old server key still works: Gemini for the agency; Meta only for Edelweiss with its Page (the server
      // functions' rule since go-live step 3, 14 Nov 2026 — every other company needs its own token).
      var legacy = !c && ((s.id === 'meta' && biz && biz.id === 'edelweiss' && biz.pageId) || s.id === 'gemini');
      var st = c ? (c.status === 'ok' ? pill(t('key.st.ok', { hint: c.secret_hint || '' }), 'on') : pill(t('key.st.error'), 'out'))
        : legacy ? pill(t('set.st.server'), 'on') : pill(t('set.st.none'), 'off');
      var kids = [h('p', { class: 'ads-note' }, t('set.use.' + s.id))];
      if (c) {
        kids.push(h('p', { class: 'ads-sub' }, t('key.checked', { when: c.checked_at ? fmtDateTime(c.checked_at) : '—' })));
        if (c.status !== 'ok' && c.status_message) kids.push(h('p', { class: 'ads-warn' }, c.status_message));
        if (s.id === 'meta' && c.status === 'ok') kids.push(metaFound(c, business));
        else if (c.info && c.info.models != null) kids.push(h('p', { class: 'ads-sub' }, t('key.models', { n: c.info.models })));
      } else if (legacy) kids.push(h('p', { class: 'ads-hint' }, t(s.id === 'meta' ? 'key.legacyMeta' : 'key.legacyGemini')));
      if (canEdit) {
        var inId = 'ads-key-' + s.id + (business ? '-' + business : '');
        var input = h('input', { type: 'password', id: inId, class: 'ads-input', autocomplete: 'off', spellcheck: 'false', placeholder: t(c ? 'key.replacePh' : 'key.pastePh') });
        var msg = h('p', { class: 'ads-hint', 'aria-live': 'polite' });
        // A key that was not saved: a clearly visible warning, a toast, and an empty field (14 Nov 2026: a grey
        // line under a still-filled field looked like "saved").
        var notSaved = function (text) {
          input.value = ''; msg.className = 'ads-warn'; msg.textContent = text; toast(t('key.notSaved'), 'act');
        };
        var saveB = h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function () {
          var v = input.value.trim();
          msg.className = 'ads-hint';
          if (!v) { msg.textContent = t('key.empty'); input.focus(); return; }
          // A key of another service (e.g. a Claude key in the ChatGPT row) is refused here, before it goes anywhere.
          var kind = keyKind(v);
          if (kind === 'claudeAdmin') { notSaved(t('key.claudeAdmin')); return; }
          if (kind && kind !== s.id) { notSaved(t('key.wrongKind', { kind: t('set.svc.' + kind), row: t('set.svc.' + s.id) })); return; }
          saveB.disabled = true; msg.textContent = t('key.testing');
          api.saveConnection(s.id, business, v).then(function () {
            input.value = ''; toast(t('key.saved', { name: t('set.svc.' + s.id) }), 'info'); openKey = s.id; refresh();
          }, function (e) {
            saveB.disabled = false;
            notSaved(e && e.code === 'claude_workspace' ? t('key.claudeWorkspace') : t('key.failed') + (e && e.message ? ' ' + e.message : ''));
          });
        } }, t(c ? 'key.replace' : 'key.saveTest'));
        kids.push(field(c ? 'key.newKey' : 'key.key', input, null, inId), msg);
        var bl = [saveB];
        if (c) {
          bl.push(h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function (ev) {
            var b = ev.currentTarget; b.disabled = true;
            api.testConnection(c.id).then(function () { toast(t('key.testOk'), 'info'); openKey = s.id; refresh(); },
              function (e) { toast(t('key.failed') + (e && e.message ? ' ' + e.message : ''), 'act'); openKey = s.id; refresh(); });
          } }, t('key.test')));
          bl.push(h('button', { type: 'button', class: 'ads-btn ads-btn--danger-ghost', onclick: function () {
            confirmDialog({ title: t('key.remove'), message: t('key.removeQ', { name: t('set.svc.' + s.id) }), confirmLabel: t('key.removeYes'), danger: true }).then(function (yes) {
              if (!yes) return;
              api.removeConnection(c.id).then(function () { toast(t('key.removed'), 'info'); refresh(); },
                function (e) { toast(t('toast.failed') + (e && e.message ? ' ' + e.message : ''), 'act'); });
            });
          } }, t('key.remove')));
        }
        if (legacy && s.id === 'meta') bl.push(h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function (e) { testMetaConnection(e.currentTarget); } }, t('health.btn')));
        if (legacy && s.id === 'gemini') bl.push(h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function (e) { testGemini(e.currentTarget); } }, t('aimg.test.btn')));
        kids.push(btns(bl));
      } else kids.push(h('p', { class: 'ads-hint' }, t(business ? 'key.onlyAdmins' : 'key.onlyAgencyAdmins')));
      // For its icon tile (svcTiles): works / problem / not connected, the status chip and what opens below.
      return { id: s.id, state: c ? (c.status === 'ok' ? 'ok' : 'warn') : legacy ? 'ok' : 'none', pill: st,
        chosen: !!business && chosen(s), body: kids };
    }
    // What a Meta token reaches, and "Use for <company>": the Page (with its Instagram) and the ad account.
    function metaFound(c, business) {
      var info = c.info || {}, pages = info.pages || [], accts = info.ad_accounts || [];
      var box = h('div', { class: 'ads-keyfound' }, [h('p', { class: 'ads-sub' }, t('key.meta.owner', { name: (info.owner && info.owner.name) || '—' }))]);
      if (!pages.length && !accts.length) { box.appendChild(h('p', { class: 'ads-warn' }, t('key.meta.nothing'))); return box; }
      var cur = settings.businesses.filter(function (b) { return b.id === business; })[0] || {};
      var curAcct = cur.accounts && cur.accounts[0] ? cur.accounts[0].id : '';
      // Preselect what the company uses now when the token reaches it, else the first thing the token reaches
      // (never an empty choice by accident: that would clear the company's Page or ad account).
      var has = function (list, id) { return !!id && list.some(function (x) { return x.id === id; }); };
      var pageSel = select('ads-meta-page-' + business, [['', t('key.meta.noPage')]].concat(pages.map(function (x) {
        return [x.id, x.name + (x.instagram ? ' · Instagram @' + x.instagram : '')];
      })), has(pages, cur.pageId) ? cur.pageId : (pages[0] ? pages[0].id : ''), function () {});
      var acctSel = select('ads-meta-acct-' + business, [['', t('key.meta.noAcct')]].concat(accts.map(function (x) {
        return [x.id, x.name + ' (' + x.id + (x.currency ? ', ' + x.currency : '') + ')'];
      })), has(accts, curAcct) ? curAcct : (accts[0] ? accts[0].id : ''), function () {});
      var canUse = !!access && access.role === 'admin';
      var use = h('button', { type: 'button', class: 'ads-btn ads-btn--primary', disabled: !canUse, onclick: function () {
        var pg = pages.filter(function (x) { return x.id === pageSel.value; })[0] || null;
        var ac = accts.filter(function (x) { return x.id === acctSel.value; })[0] || null;
        // Replacing a Page or ad account the company already uses needs a yes first.
        var replaces = (cur.pageId && cur.pageId !== (pg ? pg.id : null)) || (curAcct && curAcct !== (ac ? ac.id : null));
        (replaces ? confirmDialog({ title: t('key.meta.replaceTitle'), message: t('key.meta.replaceQ', { name: bizName(business) }), confirmLabel: t('key.meta.replaceYes') }) : Promise.resolve(true)).then(function (yes) {
          if (!yes) return;
          use.disabled = true;
          api.setCompanyMeta(business, { pageId: pg ? pg.id : null, instagramId: pg ? pg.instagram_id : null, adAccountId: ac ? ac.id : null,
            currency: ac ? ac.currency : null, timezone: ac ? ac.timezone : null }).then(function () {
            toast(t('key.meta.used', { name: bizName(business) }), 'info'); openKey = 'meta'; return companiesChanged(null);
          }, function (e) { use.disabled = false; toast(t('toast.failed') + ' ' + errText(e), 'act'); });
        });
      } }, t('key.meta.use', { name: bizName(business) }));
      append(box, [field('key.meta.page', pageSel, null, pageSel.id), field('key.meta.acct', acctSel, null, acctSel.id), btns([use])]);
      if (info.pages_error) box.appendChild(h('p', { class: 'ads-hint' }, t('key.meta.pagesErr') + ' ' + info.pages_error));
      if (info.ad_accounts_error) box.appendChild(h('p', { class: 'ads-hint' }, t('key.meta.acctErr') + ' ' + info.ad_accounts_error));
      return box;
    }
    // One service: a closed row (name + status chip); opened, it shows what it is for, the key fields and the buttons.
    function service(s, business) {
      if (live && KEY_LIVE.indexOf(s.id) !== -1) return keyRow(s, business);
      var onServer = live && (s.id === 'meta' || s.id === 'gemini'); // live mode: these keys already sit in the server's secrets
      var kids = [h('p', { class: 'ads-note' }, t('set.use.' + s.id))];
      (s.fields || []).forEach(function (f, i) {
        var id = 'ads-key-' + s.id + '-' + i;
        kids.push(field(f[0], h('input', { type: f[1], id: id, class: 'ads-input', disabled: true, autocomplete: 'off', spellcheck: 'false',
          placeholder: t(onServer ? 'set.keyServer' : 'set.keyPh') }), null, id));
      });
      var b = s.connect ? [soonBtn(s.connect)] : [soonBtn('set.save'), soonBtn('set.remove', { danger: true })];
      if (s.id === 'meta') {
        b.push(live ? h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function (e) { testMetaConnection(e.currentTarget); } }, t('health.btn')) : soonBtn('health.btn'));
      }
      if (s.id === 'gemini') {
        b.push(live ? h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function (e) { testGemini(e.currentTarget); } }, t('aimg.test.btn')) : soonBtn('aimg.test.btn'));
      }
      kids.push(btns(b));
      return { id: s.id, state: onServer ? 'ok' : 'soon', pill: pill(t(onServer ? 'set.st.server' : 'set.st.none'), onServer ? 'on' : 'off'),
        chosen: chosen(s), body: kids };
    }
    // Services as a row of icon tiles; a click opens that service in the panel below the row (one at a time),
    // a second click, Close or Esc closes it. gid: the row's id; list: what keyRow() / service() return.
    function svcTiles(gid, list) {
      var panel = h('div', { class: 'ads-svcpanel', id: 'ads-svcpanel-' + gid, role: 'region', hidden: true });
      var tiles = [];
      function close(back) {
        tiles.forEach(function (x) { x.setAttribute('aria-expanded', 'false'); });
        panel.hidden = true; panel.innerHTML = '';
        if (back) back.focus();
      }
      function open(it, tile) {
        close(null);
        tile.setAttribute('aria-expanded', 'true');
        panel.setAttribute('aria-labelledby', tile.id);
        append(panel, [h('div', { class: 'ads-svcpanel__head' }, [
          h('h3', { class: 'ads-h3' }, t('set.svc.' + it.id)), it.chosen ? pill(t('set.chosen'), 'picture') : null, it.pill,
          h('button', { type: 'button', class: 'ads-btn ads-btn--ghost ads-btn--small ads-svcpanel__close', onclick: function () { close(tile); } }, t('common.close'))
        ])].concat(it.body));
        panel.hidden = false;
      }
      panel.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var tile = tiles.filter(function (x) { return x.getAttribute('aria-expanded') === 'true'; })[0];
        e.stopPropagation(); close(tile || null);
      });
      list.forEach(function (it) {
        var tile = h('button', { type: 'button', class: 'ads-svcicon ads-svcicon--' + it.state, id: 'ads-svctile-' + gid + '-' + it.id,
          'aria-expanded': 'false', 'aria-controls': panel.id }, [
          svcIcon(it.id, it.state),
          h('span', { class: 'ads-svcicon__name' }, t('set.svc.' + it.id)),
          it.state === 'soon' ? h('span', { class: 'ads-svcicon__soon', 'aria-hidden': 'true' }, t('set.tile.soon')) : null,
          h('span', { class: 'visually-hidden' }, ', ' + t(it.state === 'soon' ? 'set.tile.soonLong' : 'set.tile.' + it.state))
        ]);
        tile.addEventListener('click', function () { if (tile.getAttribute('aria-expanded') === 'true') close(null); else open(it, tile); });
        tiles.push(tile);
        if (openKey === it.id) open(it, tile);
      });
      return [h('div', { class: 'ads-svcgrid' }, tiles), panel];
    }
    // The services ticked for this company (channels and work tools) come first in their group.
    function chosen(s) {
      return !!biz && ((s.ch || []).some(function (c) { return biz.channels.indexOf(c) !== -1; }) || (!!s.tool && biz.tools.indexOf(s.tool) !== -1));
    }
    var conn = [h('p', {}, t('set.conn.intro')), h('p', { class: 'ads-warn' }, t('set.conn.security'))];
    SERVICES.forEach(function (g) {
      var list = g[1].filter(chosen).concat(g[1].filter(function (s) { return !chosen(s); }));
      conn.push(h('h3', { class: 'ads-h3 ads-svcgroup' }, t('set.grp.' + g[0])));
      conn = conn.concat(svcTiles(g[0], list.map(function (s) { return service(s, biz ? biz.id : null); })));
    });
    var ai = [h('p', {}, t('key.ai.intro')), h('p', { class: 'ads-warn' }, t('set.conn.security')),
      keys.err ? h('p', { class: 'ads-warn' }, t('key.err.db')) : null].concat(
      svcTiles('ai', AI_SERVICES.map(function (s) { return service(s, null); })));
    if (keys.err) conn.splice(2, 0, h('p', { class: 'ads-warn' }, t('key.err.db')));
    var notify = h('fieldset', { class: 'ads-fieldset', disabled: true }, [h('legend', { class: 'visually-hidden' }, t('set.notify'))].concat(['rejected', 'daily', 'lowStock', 'weekly'].map(function (k) {
      var id = 'ads-set-n-' + k;
      return h('label', { class: 'ads-option ads-option--off', for: id }, [h('input', { type: 'checkbox', id: id, disabled: true }), h('span', {}, t('set.n.' + k))]);
    })));
    var danger = [['export', false], ['delHistory', true], ['delLibrary', true], ['delProducts', true], ['delAccount', true]].map(function (d) {
      var id = 'ads-set-d-' + d[0];
      return h('div', { class: 'ads-dz' }, [h('p', { class: 'ads-dz__text', id: id }, t('set.' + d[0] + '.d')), soonBtn('set.' + d[0], { danger: d[1], describedBy: id })]);
    });
    render(h('div', { class: 'ads-settings' }, [
      pageHead('nav.settings'),
      h('p', { class: 'ads-note' }, t('set.intro')),
      card('account', 'set.account', [h('p', {}, t('set.signedIn', { email: user ? user.email : '' })), btns([soonBtn('set.changePassword'), soonBtn('set.signOutAll')])]),
      card('companies', 'co.title', companiesCard()),
      card('ai', 'key.ai.title', ai),
      biz ? h('section', { class: 'ads-card', 'aria-labelledby': 'ads-set-conn' },
        [h('h2', { class: 'ads-h2', id: 'ads-set-conn' }, t('set.connFor', { name: biz.name })), h('p', { class: 'ads-note' }, t('set.conn.perCompany'))].concat(conn)) : null,
      card('limits', 'set.limits', [
        h('p', { class: 'ads-note' }, t(live ? 'set.lim.live' : 'set.lim.mock')),
        kv([[t('set.lim.daily'), money(L.maxDailyBudget)],
          [t('set.lim.total'), L.maxTotalBudget != null ? money(L.maxTotalBudget) : t('set.lim.derived', { total: money(L.maxDailyBudget * L.maxDays) })],
          [t('set.lim.days'), t('set.lim.daysN', { n: L.maxDays })]]),
        btns([soonBtn('set.lim.change')])
      ]),
      card('team', 'set.team', teamCard()),
      card('goals', 'goal.title', goalsCard()),
      card('notify', 'set.notify', [h('p', { class: 'ads-note' }, t('set.notify.note')), notify]),
      card('data', 'set.data', [h('p', { class: 'ads-note' }, t('set.data.note'))].concat(danger), 'danger')
    ]), 'nav.settings');
    openKey = null;
  }

  /* ---------------------------------------------------------------------
     12. AI Assistant (mock replies; never acts by itself)
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
        else { composerPrefill = { caption: p.caption, productIds: (p.productIds || []).slice(), imageIds: (p.imageIds || []).slice() }; go('#/posts/new'); }
      } }, t('tool.edit')) : null
    ]);
    card.appendChild(bar);
    return card;
  }
  function reply(q) {
    var s = q.toLowerCase();
    var has = function (re) { return re.test(s); };
    var biz = ctx.business;
    if (!hasCompany()) return Promise.resolve({ role: 'bot', text: t('co.first.text') }); // nothing to act on yet (D-49)
    if (has(/pause|stop|შეაჩერ|გააჩერ/)) {
      return api.listCampaigns({ business: biz, status: 'active' }).then(function (rows) {
        if (!rows.length) return { role: 'bot', text: t('ai.noActive') };
        return { role: 'bot', text: t('ai.pause'), tool: { kind: 'pause_campaign', params: { id: rows[0].id, name: rows[0].name } } };
      });
    }
    if (has(/post|caption|write|draft|პოსტ|ტექსტ/)) {
      return Promise.all([api.listProducts(biz), api.listImages(biz)]).then(function (r) {
        cacheImages(r[1]);
        // Prefer a product with a price (stock rows may have none); no product at all -> a plain caption.
        var prod = r[0].filter(function (x) { return x.price != null; })[0] || r[0][0] || null;
        var caption = !prod ? t('ai.campaignCaption') : AdsI18n.lang() === 'ka'
          ? fillTemplate(settings.georgianTemplates[0], [prod]) : t('ai.postCaption', { product: prod.displayName || prod.name_en });
        return { role: 'bot', text: t('ai.post'), tool: { kind: 'create_post', params: { business: biz, productIds: prod ? [prod.id] : [], caption: caption, imageIds: r[1][0] ? [r[1][0].id] : [] } } };
      });
    }
    if (has(/campaign|ad\b|ads\b|advert|კამპან|რეკლამ/)) {
      if (!biz || !accounts(biz).length) return Promise.resolve({ role: 'bot', text: t('co.noAccountAi') }); // a new company has no ad account yet
      return api.listImages(biz).then(function (imgs) {
        cacheImages(imgs);
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
     12b. Companies, team, approvals board, brands (11 Nov 2026, the owner's voice notes; plan
          D:\Web Development\Phantasma Library\workstreams\ads-companies-plan-2026-11-11.md, ADS-32...36).
          An agency's workspace holds several unrelated companies, each with its own settings.
          SAMPLE MODE until the database update (ADS-37): live mode reads the companies from the
          database but cannot add or change them, nor the team, here yet; brands and the board use
          the demo state in both modes (the pages say so).
     --------------------------------------------------------------------- */
  // Ticks in a fieldset. options: [[value, label]]. The fieldset gets .values() = the ticked values.
  function checkGroup(name, legendKey, options, values, hintKey) {
    var boxes = [];
    var fs = h('fieldset', { class: 'ads-fieldset' }, [h('legend', { class: 'ads-label' }, t(legendKey)),
      hintKey ? h('p', { class: 'ads-hint' }, t(hintKey)) : null,
      h('div', { class: 'ads-checks' }, options.map(function (o) {
        var id = name + '-' + o[0];
        var cb = h('input', { type: 'checkbox', id: id, value: o[0], checked: (values || []).indexOf(o[0]) !== -1 });
        boxes.push(cb);
        return h('label', { class: 'ads-option', for: id }, [cb, h('span', {}, o[1])]);
      }))]);
    fs.values = function () { return boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); };
    return fs;
  }
  function formError() { return h('p', { class: 'ads-warn', role: 'alert', hidden: true }); }
  function showFormError(el, e) { el.textContent = errText(e) || t('toast.failed'); el.hidden = false; }
  function textArea(id, value, max, rows) {
    var a = h('textarea', { id: id, class: 'ads-input ads-textarea', maxlength: String(max), rows: String(rows || 3) });
    a.value = value || '';
    return a;
  }
  function hasCompany() { return !!(ctx.business && settings.businesses.some(function (b) { return b.id === ctx.business; })); }

  // The company form in three parts: the first-visit window shows one part per step, Settings all of
  // them. c: the company or null. Returns { parts, name (input), read() }.
  function companyForm(c) {
    var R = api.workspaceRules;
    c = c || { name: '', about: '', goal: '', channels: [], tools: [], workType: '', inbox: false };
    var name = h('input', { type: 'text', id: 'ads-co-name', class: 'ads-input', maxlength: '80', autocomplete: 'organization', value: c.name || '' });
    var about = textArea('ads-co-about', c.about, R.textMax), goal = textArea('ads-co-goal', c.goal, R.textMax);
    var channels = checkGroup('ads-co-ch', 'co.channels', R.channels.map(function (k) { return [k, t('ch.' + k)]; }), c.channels, 'co.channels.hint');
    var tools = checkGroup('ads-co-tl', 'co.tools', R.tools.map(function (k) { return [k, t('tool.' + k)]; }), c.tools, 'co.tools.hint');
    var work = c.workType || 'both';
    var inbox = h('input', { type: 'checkbox', id: 'ads-co-inbox', checked: !!c.inbox });
    return {
      name: name,
      parts: [
        h('div', { class: 'ads-coform__part' }, [
          field('co.name', name, null, 'ads-co-name'),
          field('co.about', about, t('co.about.hint'), 'ads-co-about'),
          field('co.goal', goal, t('co.goal.hint'), 'ads-co-goal')
        ]),
        h('div', { class: 'ads-coform__part' }, [channels]),
        h('div', { class: 'ads-coform__part' }, [
          radioGroup('ads-co-wt', 'co.work', R.workTypes.map(function (k) { return [k, 'co.wt.' + k, 'co.wt.' + k + '.d']; }), work, function (v) { work = v; }),
          tools,
          h('fieldset', { class: 'ads-fieldset' }, [h('legend', { class: 'ads-label' }, t('co.inboxLegend')),
            h('label', { class: 'ads-option', for: 'ads-co-inbox' }, [inbox, h('span', {}, [h('strong', {}, t('co.inbox')), h('span', { class: 'ads-sub' }, t('co.inbox.d'))])])])
        ])
      ],
      read: function () {
        return { name: name.value, about: about.value, goal: goal.value, channels: channels.values(), tools: tools.values(), workType: work, inbox: inbox.checked };
      }
    };
  }
  // After a company was added or changed: settings again, then the top bar and the view.
  // switchTo: a new company becomes the one selected in the top bar.
  function companiesChanged(switchTo) {
    return api.getSettings().then(function (s) {
      settings = s;
      if (switchTo) { ctx.business = switchTo; ctx.account = 'all'; campAccount = 'all'; wizard = null; saveCtx(); }
      buildTopbar(); firstRender = 'focus'; refresh();
    });
  }
  function switchCompany(id) {
    ctx.business = id; ctx.account = 'all'; campAccount = 'all'; wizard = null; styCompany = null;
    saveCtx(); buildTopbar(); firstRender = 'focus'; refresh();
    toast(t('co.switched', { name: bizName(id) }), 'info');
  }
  // Settings → Add / Edit company, and "+ Add company" in the top bar. Resolves with the saved company or null.
  function companyDialog(c) {
    var f = companyForm(c), saved = null, err = formError();
    return openDialog({
      title: c ? t('co.editTitle', { name: c.name }) : t('co.addTitle'), wide: true,
      body: h('div', { class: 'ads-coform' }, [f.parts[0], h('h3', { class: 'ads-h3' }, t('co.step.channels')), f.parts[1],
        h('h3', { class: 'ads-h3' }, t('co.step.work')), f.parts[2], err]),
      actions: [{ value: 'save', label: t(c ? 'co.save' : 'co.create') }],
      onAction: function () {
        err.hidden = true;
        var d = f.read(); if (c) d.id = c.id;
        return api.saveCompany(d).then(function (co) {
          saved = co;
          toast(t(c ? 'co.saved' : 'co.created', { name: co.name }), 'info');
          return companiesChanged(c ? null : co.id);
        }, function (e) { showFormError(err, e); if (e.key === 'co.err.name' || e.key === 'co.err.taken') f.name.focus(); return false; });
      },
      onOpen: function () { f.name.focus(); }
    }).then(function () { return saved; });
  }
  // First visit without a company (owner, 11 Nov 2026): three short steps. "Skip for now" (or closing
  // the window) opens the empty tool and is remembered; Settings → Companies shows the same form.
  function openOnboarding() {
    var f = companyForm(null), step = 0, done = false, closeIt = null, busy = false;
    var keys = ['co.step.about', 'co.step.channels', 'co.step.work'];
    var count = h('p', { class: 'ads-onb__count', 'aria-live': 'polite' });
    var panel = h('div', { class: 'ads-onb__panel' }), err = formError();
    var back = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { show(step - 1); } }, t('common.back'));
    var next = h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: forward }, t('common.next'));
    var skip = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { if (closeIt) closeIt(null); } }, t('onb.skip'));
    function show(i) {
      step = i; err.hidden = true;
      panel.innerHTML = ''; panel.appendChild(f.parts[i]);
      count.textContent = t('onb.stepOf', { n: i + 1, total: keys.length, name: t(keys[i]) });
      back.hidden = i === 0;
      next.textContent = t(i === keys.length - 1 ? 'onb.create' : 'common.next');
      var first = $('input, textarea', panel); if (first) first.focus();
    }
    function forward() {
      if (busy) return;
      if (step === 0 && !f.name.value.trim()) { showFormError(err, { key: 'co.err.name' }); f.name.focus(); return; }
      if (step < keys.length - 1) { show(step + 1); return; }
      busy = true; next.disabled = true;
      api.saveCompany(f.read()).then(function (co) {
        done = true;
        if (closeIt) closeIt('done');
        toast(t('onb.created', { name: co.name }), 'info');
        return companiesChanged(co.id);
      }, function (e) {
        busy = false; next.disabled = false;
        showFormError(err, e);
        if (e.key === 'co.err.name' || e.key === 'co.err.taken') { show(0); showFormError(err, e); f.name.focus(); }
      });
    }
    return openDialog({
      title: t('onb.title'), wide: true, noCancel: true,
      body: h('div', { class: 'ads-onb' }, [h('p', {}, t('onb.intro')), count, panel, err,
        h('div', { class: 'ads-onb__nav' }, [skip, h('span', { class: 'ads-onb__gap' }), back, next])]),
      onOpen: function (dlg, btns, close) { closeIt = close; show(0); }
    }).then(function () {
      if (done) return;
      return api.skipOnboarding().then(function () {
        settings.onboarding = { skipped: true };
        toast(t('onb.skipped'), 'info');
      });
    });
  }
  // Pages that need a company, while there is none (D-49): one way out, "Create a company".
  function viewNoCompany(titleKey) {
    render(h('div', {}, [pageHead(titleKey), emptyState('co.first.title', 'co.first.text',
      h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function () { companyDialog(null); } }, t('co.add')))]), titleKey);
  }

  /* ---- Settings: the Companies card and the Team card ---- */
  function companiesCard() {
    var live = liveMode(), list = settings.businesses;
    var items = list.length ? h('ul', { class: 'ads-colist' }, list.map(function (c) {
      var cur = c.id === ctx.business;
      return h('li', { class: 'ads-colist__item' + (cur ? ' is-current' : '') }, [
        h('div', { class: 'ads-colist__head' }, [h('strong', { class: 'ads-colist__name' }, c.name), cur ? pill(t('co.current'), 'on') : null]),
        c.about ? h('p', { class: 'ads-colist__about' }, c.about) : null,
        kv([[t('co.k.channels'), c.channels.length ? c.channels.map(function (k) { return t('ch.' + k); }).join(', ') : t('co.none.dash')],
          [t('co.k.work'), c.workType ? t('co.wt.' + c.workType) : t('co.none.dash')],
          [t('set.biz.accounts'), c.accounts.length ? c.accounts.map(function (a) { return a.name; }).join(', ') : t('co.noAccounts')]]),
        h('div', { class: 'ads-btnrow' }, [
          h('button', { type: 'button', class: 'ads-btn ads-btn--ghost ads-btn--small', onclick: function () { companyDialog(c); } }, t('co.edit')),
          cur ? null : h('button', { type: 'button', class: 'ads-btn ads-btn--ghost ads-btn--small', onclick: function () { switchCompany(c.id); } }, t('co.switch'))
        ])
      ]);
    })) : h('p', {}, t('co.none.text'));
    return [h('p', { class: 'ads-note' }, t(live ? 'co.live' : 'co.note')), items,
      h('div', { class: 'ads-btnrow' }, [h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function () { companyDialog(null); } }, t('co.add'))])];
  }
  function roleOptions() { return api.workspaceRules.roles.map(function (r) { return [r, 'role.' + r, 'role.' + r + '.d']; }); }
  // Invite (m = null) or change a member's role and companies. Resolves true when saved.
  function memberDialog(m) {
    var ok = false, role = m ? m.role : 'viewer', err = formError();
    var email = h('input', { type: 'email', id: 'ads-tm-email', class: 'ads-input', maxlength: '200', autocomplete: 'off', spellcheck: 'false', value: m ? m.email : '', disabled: !!m });
    var cos = settings.businesses.length
      ? checkGroup('ads-tm-co', 'team.companies', settings.businesses.map(function (b) { return [b.id, b.name]; }), m ? m.companies : [], 'team.companies.hint')
      : h('p', { class: 'ads-note' }, t('team.noCos'));
    return openDialog({
      title: m ? t('team.changeTitle', { email: m.email }) : t('team.inviteTitle'), wide: true,
      body: h('div', { class: 'ads-coform' }, [field('team.email', email, m ? null : t('team.email.hint'), 'ads-tm-email'),
        radioGroup('ads-tm-role', 'team.role', roleOptions(), role, function (v) { role = v; }), cos, err]),
      actions: [{ value: 'save', label: t(m ? 'team.save' : 'team.send') }],
      onAction: function () {
        err.hidden = true;
        var d = { email: email.value, role: role, companies: cos.values ? cos.values() : [] };
        return (m ? api.updateMember(m.id, d) : api.inviteMember(d)).then(function (x) {
          ok = true;
          toast(t(m ? 'team.saved' : liveMode() ? 'team.sentLive' : 'team.sentSample', { email: x.email || email.value }), 'info');
        }, function (e) { showFormError(err, e); if (!m) email.focus(); return false; });
      },
      onOpen: function () { if (!m) email.focus(); }
    }).then(function () { return ok; });
  }
  function teamCard() {
    var live = liveMode(), box = h('div', {}, skeleton(2));
    var invite = h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function () { memberDialog(null).then(function (ok) { if (ok) load(); }); } }, t('team.invite'));
    function scope(m) { return m.companies.length ? m.companies.map(bizName).join(', ') : t('team.allCos'); }
    function load() {
      api.listMembers().then(draw, function (e) {
        box.innerHTML = '';
        // Only Admins for all companies manage the team (0039); others see a plain note.
        if (e && e.key === 'team.err.notAllowed') { invite.hidden = true; box.appendChild(h('p', { class: 'ads-note' }, t('team.onlyAdmins'))); return; }
        box.appendChild(errorState(load));
      });
    }
    function draw(list) {
      box.innerHTML = '';
      box.appendChild(h('ul', { class: 'ads-team' }, list.map(function (m) {
        return h('li', { class: 'ads-team__row' }, [
          h('div', { class: 'ads-team__who' }, [h('strong', { class: 'ads-team__mail' }, m.email + (m.me ? ' ' + t('team.you') : '')),
            h('span', { class: 'ads-sub' }, t(m.companies.length ? 'team.scopeSome' : 'team.scopeAll', { list: scope(m) }))]),
          h('div', { class: 'ads-team__tags' }, [pill(t('role.' + m.role), 'role-' + m.role), m.status === 'invited' ? pill(t('team.invited'), 'off') : null]),
          m.me ? null : h('div', { class: 'ads-team__acts' }, [
            h('button', { type: 'button', class: 'ads-btn ads-btn--ghost ads-btn--small', onclick: function () { memberDialog(m).then(function (ok) { if (ok) load(); }); } }, t('team.change')),
            h('button', { type: 'button', class: 'ads-btn ads-btn--danger-ghost ads-btn--small', onclick: function () {
              confirmDialog({ title: t(m.status === 'invited' ? 'team.cancelInvite' : 'team.remove'), message: t('team.removeQ', { email: m.email }), confirmLabel: t('team.removeYes'), danger: true }).then(function (yes) {
                if (!yes) return;
                api.removeMember(m.id).then(function () { toast(t('team.removed', { email: m.email }), 'info'); load(); }, function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); });
              });
            } }, t(m.status === 'invited' ? 'team.cancelInvite' : 'team.remove'))
          ])
        ]);
      })));
    }
    load();
    return [h('p', { class: 'ads-note' }, t(live ? 'team.live' : 'team.note')), box,
      h('details', { class: 'ads-details' }, [h('summary', {}, t('team.rolesTitle')),
        kv(roleOptions().map(function (r) { return [t(r[1]), t(r[2])]; }))]),
      h('div', { class: 'ads-btnrow' }, [invite])];
  }

  /* ---- Approvals board (D-52): Waiting for approval / Approved / Running, posts and campaigns ---- */
  var apKind = 'all';
  var access = null;     // { role, allCompanies, companies } of the signed-in person (live: ads_my_access, 0039)
  var goalsCache = [];   // post goals, loaded at start and after edits in Settings
  function viewApprovals(tok) {
    var body = h('div', {}, skeleton(3));
    var kinds = ['all', 'post', 'campaign'].map(function (k) {
      return h('button', { type: 'button', class: 'ads-filter', 'aria-pressed': String(k === apKind), onclick: function () {
        apKind = k;
        kinds.forEach(function (b, i) { b.setAttribute('aria-pressed', String(['all', 'post', 'campaign'][i] === apKind)); });
        load();
      } }, t('ap.kind.' + k));
    });
    render(h('div', {}, [
      pageHead('ap.nav'),
      h('p', { class: 'ads-note' }, t('ap.intro', { name: bizName(ctx.business) })),
      liveMode() ? h('p', { class: 'ads-warn' }, t('ap.sample')) : null,
      h('div', { class: 'ads-chips', role: 'group', 'aria-label': t('ap.show') }, kinds),
      body
    ]), 'ap.nav');
    load();
    function load(focusCol) {
      api.listApprovals({ business: ctx.business, kind: apKind === 'all' ? null : apKind }).then(function (r) {
        if (stale(tok)) return;
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'ads-board' }, ['waiting', 'approved', 'running'].map(function (col) {
          var items = r[col];
          return h('section', { class: 'ads-board__col ads-board__col--' + col, 'aria-labelledby': 'ads-ap-' + col }, [
            h('h2', { class: 'ads-board__title', id: 'ads-ap-' + col, tabindex: '-1' }, [t('ap.col.' + col), h('span', { class: 'ads-board__n' }, num(items.length))]),
            items.length ? h('ul', { class: 'ads-board__list' }, items.map(function (it) { return card(it, col); })) : h('p', { class: 'ads-note' }, t('ap.empty.' + col))
          ]);
        })));
        if (focusCol) { var hd = $('#ads-ap-' + focusCol, main); if (hd) hd.focus(); }
      }, function () { if (!stale(tok)) { body.innerHTML = ''; body.appendChild(errorState(function () { load(); })); } });
    }
    function card(it, col) {
      var title = it.kind === 'campaign' ? it.name : it.caption ? (it.caption.length > 110 ? it.caption.slice(0, 110) + '…' : it.caption) : t('ap.noCaption');
      var meta = it.kind === 'campaign' ? t('ap.budget', { daily: money(it.dailyBudget), days: it.days, total: money(api.total(it)) })
        : it.when ? t(it.status === 'published' ? 'ap.publishedAt' : 'ap.scheduledAt', { when: fmtDateTime(it.when) }) : '';
      var acts = [h('a', { class: 'ads-btn ads-btn--ghost ads-btn--small', href: it.kind === 'post' ? '#/posts/' + it.id : '#/campaigns' }, t('ap.open'))];
      if (col === 'waiting') {
        acts.unshift(h('button', { type: 'button', class: 'ads-btn ads-btn--primary ads-btn--small', onclick: function () {
          api.approveItem(it.kind, it.id).then(function () { toast(t('ap.approvedToast', { name: title }), 'info'); load('approved'); },
            function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); });
        } }, t('ap.approve')),
        h('button', { type: 'button', class: 'ads-btn ads-btn--ghost ads-btn--small', onclick: function () { sendBackDialog(it, title).then(function (ok) { if (ok) load('waiting'); }); } }, t('ap.sendBack')));
      }
      var img = it.imageIds && it.imageIds[0] ? imageEl(it.imageIds[0], 'ads-board__img') : null;
      if (img && img.tagName === 'IMG') img.alt = '';
      return h('li', { class: 'ads-board__card' }, [
        img,
        h('div', { class: 'ads-board__body' }, [
          h('div', { class: 'ads-board__top' }, [pill(t('ap.one.' + it.kind), it.kind === 'post' ? 'picture' : 'element'), chip(it.status)]),
          h('p', { class: 'ads-board__name' }, title),
          meta ? h('p', { class: 'ads-sub' }, meta) : null,
          it.approval && it.approval.state === 'approved' ? h('p', { class: 'ads-sub' }, t('ap.by', { who: it.approval.by, when: fmtDateTime(it.approval.at) })) : null,
          h('div', { class: 'ads-btnrow ads-btnrow--tight' }, acts)
        ])
      ]);
    }
  }
  function sendBackDialog(it, title) {
    var note = textArea('ads-ap-note', '', api.workspaceRules.feedbackMax, 3), ok = false;
    return openDialog({
      title: t('ap.sendBackTitle'),
      body: h('div', {}, [h('p', {}, rich(t('ap.sendBackText', { name: title }))), field('ap.note', note, t('ap.note.hint'), 'ads-ap-note')]),
      actions: [{ value: 'send', label: t('ap.sendBack') }],
      onAction: function () {
        return api.sendBack(it.kind, it.id, note.value).then(function () { ok = true; toast(t('ap.sentBackToast'), 'info'); },
          function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); return false; });
      },
      onOpen: function () { note.focus(); }
    }).then(function () { return ok; });
  }

  /* ---- Brands (D-53): a company can have several; sample picture + feedback ---- */
  function viewBrands(tok) {
    var body = h('div', {}, skeleton(2));
    var add = h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function () { brandDialog(null).then(function (b) { if (b) load(b.id); }); } }, t('br.new'));
    render(h('div', {}, [
      pageHead('br.nav', [add]),
      h('p', { class: 'ads-note' }, t('br.intro', { name: bizName(ctx.business) })),
      liveMode() ? h('p', { class: 'ads-warn' }, t('br.sample')) : null,
      body
    ]), 'br.nav');
    load();
    function load(focusId) {
      api.listBrands(ctx.business).then(function (list) {
        if (stale(tok)) return;
        body.innerHTML = '';
        if (!list.length) { body.appendChild(emptyState('br.none.title', 'br.none.text', null, { name: bizName(ctx.business) })); return; }
        body.appendChild(h('ul', { class: 'ads-brands' }, list.map(card)));
        var el = focusId ? $('.ads-brand__open[data-id="' + focusId + '"]', main) : null;
        if (el) el.focus();
      }, function () { if (!stale(tok)) { body.innerHTML = ''; body.appendChild(errorState(function () { load(); })); } });
    }
    function card(b) {
      return h('li', { class: 'ads-brand' }, [
        swatches(b.colors),
        h('h2', { class: 'ads-h2 ads-brand__name' }, b.name),
        b.about ? h('p', { class: 'ads-brand__about' }, b.about) : null,
        kv([[t('br.k.feel'), b.feel || t('co.none.dash')], [t('br.k.voice'), b.voice || t('co.none.dash')]]),
        h('p', { class: 'ads-sub' }, t(b.feedback.length === 1 ? 'br.fb1' : 'br.fbN', { n: b.feedback.length }) + ' · ' + t('br.updated', { when: fmtDate(b.updatedAt) })),
        h('div', { class: 'ads-btnrow ads-btnrow--tight' }, [
          h('button', { type: 'button', class: 'ads-btn ads-btn--primary ads-btn--small ads-brand__open', 'data-id': b.id, onclick: function () { brandDialog(b).then(function (x) { load(x ? x.id : b.id); }); } }, t('br.open')),
          h('button', { type: 'button', class: 'ads-btn ads-btn--danger-ghost ads-btn--small', onclick: function () {
            confirmDialog({ title: t('br.delete'), message: t('br.deleteQ', { name: b.name }), confirmLabel: t('br.deleteYes'), danger: true }).then(function (yes) {
              if (!yes) return;
              api.deleteBrand(b.id).then(function () { toast(t('br.deleted', { name: b.name }), 'info'); load(); }, function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); });
            });
          } }, t('br.delete'))
        ])
      ]);
    }
  }
  function swatches(colors) {
    return h('div', { class: 'ads-swatches', 'aria-hidden': 'true' }, (colors || []).map(function (c) {
      var s = h('span', { class: 'ads-swatch' }); s.style.background = c; return s;
    }));
  }
  // Placeholder for the AI sample picture (owner: "placeholders for now"): a mood card drawn from the
  // brand's colours and name. Returns an <img> (data URL) with a plain description.
  function brandMoodCard(b) {
    var cv = document.createElement('canvas'), W = 640, H = 400;
    cv.width = W; cv.height = H;
    var x = cv.getContext('2d'), cols = (b.colors && b.colors.length) ? b.colors : ['#EFECE6', '#14213D'];
    x.fillStyle = cols[0]; x.fillRect(0, 0, W, H);
    cols.slice(1).forEach(function (c, i) { x.fillStyle = c; x.fillRect(W - (i + 1) * 70, 0, 56, H); });
    var rgb = parseInt(cols[0].slice(1), 16), lum = ((rgb >> 16) * 299 + ((rgb >> 8) & 255) * 587 + (rgb & 255) * 114) / 1000;
    x.fillStyle = lum > 150 ? '#14213D' : '#FFFFFF';
    x.font = '600 40px Georgia, serif'; x.fillText(String(b.name || '').slice(0, 24), 40, 190);
    x.font = '400 22px sans-serif'; x.fillText(String(b.feel || '').slice(0, 44), 40, 236);
    x.font = '500 16px sans-serif'; x.fillText(t('br.pic.stamp'), 40, H - 32);
    return h('img', { class: 'ads-brand__pic', src: cv.toDataURL('image/png'), alt: t('br.pic.alt', { name: b.name }) });
  }
  // A brand: the texts, colours, files (placeholders), and the sample picture with feedback.
  // Resolves with the saved brand (or the brand as it was) or null.
  function brandDialog(b) {
    var R = api.workspaceRules, saved = null, err = formError();
    var biz = b ? b.business : ctx.business;
    var company = select('ads-br-co', settings.businesses.map(function (x) { return [x.id, x.name]; }), biz, function (v) { biz = v; });
    var name = h('input', { type: 'text', id: 'ads-br-name', class: 'ads-input', maxlength: '80', autocomplete: 'off', value: b ? b.name : '' });
    var texts = {};
    ['about', 'look', 'elements', 'feel', 'voice'].forEach(function (k) { texts[k] = textArea('ads-br-' + k, b ? b[k] : '', R.brandTextMax, k === 'about' ? 3 : 2); });
    // Colours: a colour picker + its hex code per row; up to R.brandColorsMax.
    var colors = (b ? b.colors : []).slice(), colBox = h('div', { class: 'ads-colors' });
    var addCol = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost ads-btn--small', onclick: function () { colors.push('#F26B1D'); drawColors(colors.length - 1); } }, t('br.color.add'));
    function drawColors(focusIdx) {
      colBox.innerHTML = '';
      colors.forEach(function (c, i) {
        var pick = h('input', { type: 'color', class: 'ads-color__pick', value: c.toLowerCase(), 'aria-label': t('br.color.pick', { n: i + 1 }) });
        var hex = h('input', { type: 'text', class: 'ads-input ads-color__hex', maxlength: '7', value: c, spellcheck: 'false', 'aria-label': t('br.color.hex', { n: i + 1 }) });
        pick.addEventListener('input', function () { colors[i] = pick.value.toUpperCase(); hex.value = colors[i]; });
        hex.addEventListener('change', function () {
          var v = hex.value.trim().toUpperCase(); if (v && v[0] !== '#') v = '#' + v;
          if (/^#[0-9A-F]{6}$/.test(v)) { colors[i] = v; pick.value = v.toLowerCase(); hex.value = v; } else hex.value = colors[i];
        });
        colBox.appendChild(h('div', { class: 'ads-color' }, [pick, hex,
          h('button', { type: 'button', class: 'ads-iconbtn', 'aria-label': t('br.color.remove', { n: i + 1 }), onclick: function () { colors.splice(i, 1); drawColors(); addCol.focus(); } }, '✕')]));
        if (focusIdx === i) hex.focus();
      });
      addCol.hidden = colors.length >= R.brandColorsMax;
    }
    drawColors();
    // Sample picture + feedback (needs a saved brand).
    var sample = h('div', { class: 'ads-brand__sample' });
    function drawSample(cur) {
      sample.innerHTML = '';
      if (!cur) { sample.appendChild(h('p', { class: 'ads-note' }, t('br.pic.saveFirst'))); return; }
      var picBox = h('div', { class: 'ads-brand__picbox' }, h('p', { class: 'ads-note' }, t('br.pic.none')));
      var right = textArea('ads-br-right', '', R.feedbackMax, 2), wrong = textArea('ads-br-wrong', '', R.feedbackMax, 2), fbErr = formError();
      var list = h('ul', { class: 'ads-fblist' });
      function drawList() {
        list.innerHTML = '';
        if (!cur.feedback.length) { list.appendChild(h('li', { class: 'ads-hint' }, t('br.fb.none'))); return; }
        cur.feedback.forEach(function (f) {
          list.appendChild(h('li', { class: 'ads-fblist__item' }, [
            h('p', { class: 'ads-sub' }, t('br.fb.meta', { who: f.user, when: fmtDateTime(f.ts) })),
            f.right ? h('p', {}, [h('strong', {}, t('br.fb.right') + ': '), f.right]) : null,
            f.wrong ? h('p', {}, [h('strong', {}, t('br.fb.wrong') + ': '), f.wrong]) : null
          ]));
        });
      }
      drawList();
      append(sample, [
        h('p', { class: 'ads-note' }, t('br.pic.note')),
        h('div', { class: 'ads-btnrow ads-btnrow--tight' }, [
          h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { picBox.innerHTML = ''; picBox.appendChild(brandMoodCard(readBrand(cur))); } }, t('br.pic.make'))
        ]),
        picBox,
        field('br.fb.right', right, null, 'ads-br-right'),
        field('br.fb.wrong', wrong, null, 'ads-br-wrong'),
        fbErr,
        h('div', { class: 'ads-btnrow ads-btnrow--tight' }, [h('button', { type: 'button', class: 'ads-btn ads-btn--primary ads-btn--small', onclick: function () {
          fbErr.hidden = true;
          api.addBrandFeedback(cur.id, { right: right.value, wrong: wrong.value }).then(function (item) {
            cur.feedback.unshift(item); right.value = ''; wrong.value = ''; drawList();
            toast(t('br.fb.saved'), 'info');
          }, function (e) { showFormError(fbErr, e); right.focus(); });
        } }, t('br.fb.save'))]),
        h('h4', { class: 'ads-label' }, t('br.fb.list')),
        list
      ]);
    }
    function readBrand(cur) {
      var d = { id: cur ? cur.id : undefined, business: biz, name: name.value, colors: colors.slice() };
      Object.keys(texts).forEach(function (k) { d[k] = texts[k].value; });
      return d;
    }
    drawSample(b);
    return openDialog({
      title: b ? t('br.editTitle', { name: b.name }) : t('br.newTitle'), wide: true, cancelLabel: 'common.close',
      body: h('div', { class: 'ads-coform' }, [
        h('div', { class: 'ads-row' }, [field('br.f.name', name, null, 'ads-br-name'), field('br.f.company', company, null, 'ads-br-co')]),
        field('br.f.about', texts.about, t('br.f.about.hint'), 'ads-br-about'),
        field('br.f.look', texts.look, t('br.f.look.hint'), 'ads-br-look'),
        field('br.f.elements', texts.elements, null, 'ads-br-elements'),
        field('br.f.feel', texts.feel, t('br.f.feel.hint'), 'ads-br-feel'),
        field('br.f.voice', texts.voice, t('br.f.voice.hint'), 'ads-br-voice'),
        h('fieldset', { class: 'ads-fieldset' }, [h('legend', { class: 'ads-label' }, t('br.f.colors')), h('p', { class: 'ads-hint' }, t('br.f.colors.hint')), colBox, addCol]),
        h('fieldset', { class: 'ads-fieldset' }, [h('legend', { class: 'ads-label' }, t('br.f.files')), h('p', { class: 'ads-hint' }, t('br.f.files.hint')),
          h('div', { class: 'ads-btnrow ads-btnrow--tight' }, [soonBtn('br.f.files.add', { small: true }), soonBtn('br.f.art.add', { small: true })])]),
        err,
        h('h3', { class: 'ads-h3' }, t('br.pic.title')),
        sample
      ]),
      actions: [{ value: 'save', label: t('br.save') }],
      onAction: function () {
        err.hidden = true;
        return api.saveBrand(readBrand(saved || b)).then(function (x) {
          var first = !saved && !b;
          saved = x;
          toast(t('br.saved', { name: x.name }), 'info');
          if (first) { drawSample(x); return false; } // a new brand stays open for its sample picture
        }, function (e) { showFormError(err, e); if (e.key === 'br.err.name') name.focus(); return false; });
      },
      onOpen: function () { name.focus(); }
    }).then(function () { return saved || b || null; });
  }

  /* ---- Post goals (13 Nov 2026, owner): what a post is for; the AI writes the text from it later ---- */
  function goalName(g) { return AdsI18n.lang() === 'ka' && g.name_ka ? g.name_ka : g.name; }
  function goalsCard() {
    var box = h('div', {});
    function draw() {
      box.innerHTML = '';
      if (!goalsCache.length) box.appendChild(h('p', { class: 'ads-note' }, t('goal.none')));
      else {
        box.appendChild(h('ul', { class: 'ads-goals' }, goalsCache.map(function (g) {
          return h('li', { class: 'ads-goal' }, [
            h('div', { class: 'ads-goal__head' }, [h('span', { class: 'ads-goal__code' }, g.id), h('strong', {}, goalName(g))]),
            h('p', { class: 'ads-goal__text' }, g.description),
            h('div', { class: 'ads-btnrow ads-btnrow--tight' }, [
              h('button', { type: 'button', class: 'ads-btn ads-btn--ghost ads-btn--small', onclick: function () { goalDialog(g).then(function (x) { if (x) reload(); }); } }, t('goal.edit')),
              h('button', { type: 'button', class: 'ads-btn ads-btn--danger-ghost ads-btn--small', onclick: function () {
                confirmDialog({ title: t('goal.delete'), message: t('goal.deleteQ', { name: g.id + ' · ' + goalName(g) }), confirmLabel: t('goal.deleteYes'), danger: true }).then(function (yes) {
                  if (!yes) return;
                  api.deleteGoal(g.id).then(reload, function (e) { toast(t('toast.failed') + ' ' + errText(e), 'act'); });
                });
              } }, t('goal.delete'))
            ])
          ]);
        })));
      }
    }
    function reload() { return api.listGoals().then(function (list) { goalsCache = list; draw(); }); }
    draw();
    return [h('p', { class: 'ads-note' }, t('goal.intro')), liveMode() ? h('p', { class: 'ads-warn' }, t('goal.sample')) : null, box,
      h('div', { class: 'ads-btnrow' }, [h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function () { goalDialog(null).then(function (x) { if (x) reload(); }); } }, t('goal.add'))])];
  }
  function goalDialog(g) {
    var R = api.goalRules, saved = null, err = formError();
    var name = h('input', { type: 'text', id: 'ads-goal-name', class: 'ads-input', maxlength: '60', value: g ? g.name : '' });
    var nameKa = h('input', { type: 'text', id: 'ads-goal-ka', class: 'ads-input', maxlength: '60', value: g ? g.name_ka || '' : '' });
    var desc = textArea('ads-goal-desc', g ? g.description : '', R.textMax, 3), tpl = textArea('ads-goal-tpl', g ? g.template_ka || '' : '', R.textMax, 3);
    return openDialog({
      title: g ? t('goal.editTitle', { code: g.id }) : t('goal.addTitle'), wide: true,
      body: h('div', { class: 'ads-coform' }, [
        h('div', { class: 'ads-row' }, [field('goal.f.name', name, null, 'ads-goal-name'), field('goal.f.nameKa', nameKa, null, 'ads-goal-ka')]),
        field('goal.f.desc', desc, t('goal.f.desc.hint'), 'ads-goal-desc'),
        field('goal.f.tpl', tpl, t('goal.f.tpl.hint'), 'ads-goal-tpl'),
        err]),
      actions: [{ value: 'save', label: t('goal.save') }],
      onAction: function () {
        err.hidden = true;
        return api.saveGoal({ id: g ? g.id : null, name: name.value, name_ka: nameKa.value, description: desc.value, template_ka: tpl.value })
          .then(function (x) { saved = x; toast(t('goal.saved', { code: x.id }), 'info'); }, function (e) { showFormError(err, e); return false; });
      },
      onOpen: function () { name.focus(); }
    }).then(function () { return saved; });
  }

  /* ---- Messaging (13 Nov 2026, owner): Facebook Messenger, Instagram and WhatsApp in one place.
         SAMPLE conversations until the channels are connected (plan ADS-43 / ADS-44; research notes
         docs\research\ads-messaging-history-2026-11-13.md, ads-whatsapp-2026-11-13.md). ---- */
  var MSG_CHANNELS = ['messenger', 'instagram', 'whatsapp'];
  var msgChannel = 'all', msgStatus = 'open', msgOpen = null;
  function viewMessaging(tok) {
    var live = liveMode(), cache = [];
    var listBox = h('div', { class: 'ads-inbox__list', 'aria-label': t('msg.list') });
    var threadBox = h('div', { class: 'ads-inbox__thread', 'aria-live': 'polite' });
    function chipRow(keys, cur, label, onPick) {
      var btns = keys.map(function (k) {
        return h('button', { type: 'button', class: 'ads-filter', 'aria-pressed': String(k === cur()), onclick: function () {
          onPick(k); btns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(keys[i] === cur())); }); drawList();
        } }, label(k));
      });
      return btns;
    }
    var chanBtns = chipRow(['all'].concat(MSG_CHANNELS), function () { return msgChannel; },
      function (k) { return k === 'all' ? t('common.all') : t('msg.ch.' + k); }, function (k) { msgChannel = k; });
    var statBtns = chipRow(['open', 'done', 'all'], function () { return msgStatus; },
      function (k) { return t('msg.st.' + k); }, function (k) { msgStatus = k; });
    var cards = h('div', { class: 'ads-msgch' }, MSG_CHANNELS.map(function (k) {
      return h('div', { class: 'ads-msgch__card' }, [
        h('div', { class: 'ads-msgch__head' }, [h('strong', {}, t('msg.ch.' + k)), pill(t('msg.notConnected'), 'off')]),
        h('p', { class: 'ads-sub' }, t('msg.how.' + k)),
        soonBtn('msg.connect', { small: true })
      ]);
    }));
    render(h('div', {}, [
      pageHead('msg.nav'),
      h('p', { class: 'ads-note' }, t('msg.intro', { name: bizName(ctx.business) })),
      h('p', { class: 'ads-warn' }, t(live ? 'msg.liveNote' : 'msg.sampleNote')),
      cards,
      h('div', { class: 'ads-filters' }, [
        h('div', { class: 'ads-chips', role: 'group', 'aria-label': t('msg.channel') }, chanBtns),
        h('div', { class: 'ads-chips', role: 'group', 'aria-label': t('msg.status') }, statBtns)]),
      h('div', { class: 'ads-inbox' }, [listBox, threadBox])
    ]), 'msg.nav');
    load();
    function load() {
      api.listConversations(ctx.business).then(function (list) {
        if (stale(tok)) return;
        cache = list;
        drawList();
        if (msgOpen && cache.some(function (c) { return c.id === msgOpen; })) openThread(msgOpen); else drawEmptyThread();
      }, function () { if (!stale(tok)) { listBox.innerHTML = ''; listBox.appendChild(errorState(load)); } });
    }
    function shown() {
      return cache.filter(function (c) {
        return (msgChannel === 'all' || c.channel === msgChannel) && (msgStatus === 'all' || c.status === msgStatus);
      });
    }
    function drawList() {
      var list = shown();
      listBox.innerHTML = '';
      if (!list.length) { listBox.appendChild(h('p', { class: 'ads-note' }, t(live ? 'msg.none.live' : 'msg.none'))); return; }
      listBox.appendChild(h('ul', { class: 'ads-inbox__items' }, list.map(function (c) {
        var last = c.messages[c.messages.length - 1] || { text: '', from: 'them' };
        return h('li', {}, h('button', { type: 'button', class: 'ads-inbox__item' + (c.id === msgOpen ? ' is-open' : ''), 'aria-current': c.id === msgOpen ? 'true' : null,
          onclick: function () { msgOpen = c.id; drawList(); openThread(c.id); } }, [
          h('span', { class: 'ads-inbox__top' }, [h('strong', { class: 'ads-inbox__name' }, c.name),
            c.unread ? h('span', { class: 'ads-inbox__unread', title: t('msg.unread', { n: c.unread }) }, String(c.unread)) : null]),
          h('span', { class: 'ads-inbox__meta' }, [pill(t('msg.ch.' + c.channel), 'ch-' + c.channel), h('span', { class: 'ads-sub' }, fmtDateTime(c.at))]),
          h('span', { class: 'ads-inbox__last' }, (last.from === 'us' ? t('msg.you') + ': ' : '') + last.text)
        ]));
      })));
    }
    function drawEmptyThread() {
      threadBox.innerHTML = '';
      threadBox.appendChild(h('p', { class: 'ads-note ads-inbox__pick' }, t(cache.length ? 'msg.pick' : live ? 'msg.none.live' : 'msg.none')));
    }
    function openThread(id) {
      api.openConversation(id).then(function (c) {
        if (stale(tok)) return;
        cache.forEach(function (x) { if (x.id === id) x.unread = 0; });
        drawList();
        threadBox.innerHTML = '';
        var msgs = h('ol', { class: 'ads-thread' }, c.messages.map(bubble));
        var box = textArea('ads-msg-reply', '', api.msgRules.textMax, 3);
        var send = h('button', { type: 'button', class: 'ads-btn ads-btn--primary', onclick: function () {
          send.disabled = true;
          api.replyConversation(c.id, box.value).then(function (m) {
            send.disabled = false;
            if (stale(tok)) return;
            msgs.appendChild(bubble(m)); box.value = ''; box.focus();
            cache.forEach(function (x) { if (x.id === c.id) { x.messages.push(m); x.at = m.at; } });
            drawList();
            toast(t('msg.sentSample'), 'info');
          }, function (e) { send.disabled = false; toast(errText(e) || t('toast.failed'), 'act'); });
        } }, t('msg.send'));
        var done = h('button', { type: 'button', class: 'ads-btn ads-btn--ghost ads-btn--small', onclick: function () {
          api.setConversationStatus(c.id, c.status === 'done' ? 'open' : 'done').then(function () { load(); });
        } }, t(c.status === 'done' ? 'msg.reopen' : 'msg.done'));
        append(threadBox, [
          h('div', { class: 'ads-thread__head' }, [h('h2', { class: 'ads-h2' }, c.name), pill(t('msg.ch.' + c.channel), 'ch-' + c.channel), done]),
          msgs,
          h('div', { class: 'ads-thread__reply' }, [h('label', { class: 'ads-label', for: 'ads-msg-reply' }, t('msg.reply')), box,
            h('p', { class: 'ads-hint' }, t('msg.window')), h('div', { class: 'ads-btnrow ads-btnrow--tight' }, [send])])
        ]);
      }, function () { drawEmptyThread(); });
    }
    function bubble(m) {
      return h('li', { class: 'ads-bubble ads-bubble--' + (m.from === 'us' ? 'us' : 'them') }, [
        h('p', { class: 'ads-bubble__text' }, m.text),
        h('span', { class: 'ads-bubble__at' }, fmtDateTime(m.at) + (m.sample ? ' · ' + t('msg.notSent') : ''))
      ]);
    }
  }

  /* ---- Audit log (13 Nov 2026): who did what, when. The database records every change since 6 Nov
         (ads_audit); internal Admins see their agency's entries, everyone else their own. ---- */
  var AUDIT_GROUPS = [['all', null], ['pictures', /^(image|picture_settings|style|style_group|aimg)\./], ['products', /^(stock|product)\./],
    ['campaigns', /^campaign\./], ['posts', /^(post|goal|brand)\./], ['team', /^(member|company|connection|workspace)\./]];
  var auditGroup = 'all';
  function auditLabel(a) {
    var k = 'audit.a.' + a.replace(/[^a-z_.]/gi, '');
    var v = t(k);
    return v === k ? a : v;
  }
  // A short, readable line from the details (never more than ~140 characters).
  function auditDetails(r) {
    var p = r.payload || {}, parts = [];
    if (p.detail) parts.push(String(p.detail));
    ['name', 'email', 'role', 'provider', 'title', 'rows', 'new', 'updated', 'changed', 'count', 'note', 'error'].forEach(function (k) {
      if (p[k] != null && p[k] !== '' && typeof p[k] !== 'object') parts.push(k + ': ' + p[k]);
    });
    if (Array.isArray(p.companies) && p.companies.length) parts.push(t('audit.companies', { list: p.companies.map(bizName).join(', ') }));
    var line = parts.join(' · ');
    return line.length > 140 ? line.slice(0, 139) + '…' : line;
  }
  function viewAudit(tok) {
    var body = h('div', {}, skeleton(4)), rows = [], q = '';
    var search = h('input', { type: 'search', id: 'ads-audit-q', class: 'ads-input', placeholder: t('audit.search'), oninput: function () { q = search.value.trim().toLowerCase(); draw(); } });
    var groupBtns = AUDIT_GROUPS.map(function (g) {
      return h('button', { type: 'button', class: 'ads-filter', 'aria-pressed': String(g[0] === auditGroup), onclick: function () {
        auditGroup = g[0];
        groupBtns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(AUDIT_GROUPS[i][0] === auditGroup)); });
        draw();
      } }, t('audit.g.' + g[0]));
    });
    render(h('div', {}, [
      pageHead('nav.audit', [h('button', { type: 'button', class: 'ads-btn ads-btn--ghost', onclick: function () { load(); } }, t('common.refresh'))]),
      h('p', { class: 'ads-note' }, t(liveMode() ? 'audit.intro' : 'audit.introSample')),
      h('div', { class: 'ads-filters' }, [h('div', { class: 'ads-chips', role: 'group', 'aria-label': t('audit.show') }, groupBtns),
        h('div', { class: 'ads-field ads-audit__search' }, [h('label', { class: 'visually-hidden', for: 'ads-audit-q' }, t('audit.search')), search])]),
      body
    ]), 'nav.audit');
    load();
    function load() {
      api.listAuditLog().then(function (list) { if (stale(tok)) return; rows = list; draw(); },
        function () { if (!stale(tok)) { body.innerHTML = ''; body.appendChild(errorState(function () { load(); })); } });
    }
    function draw() {
      var re = AUDIT_GROUPS.filter(function (g) { return g[0] === auditGroup; })[0][1];
      var list = rows.filter(function (r) {
        if (re && !re.test(r.action)) return false;
        if (!q) return true;
        return (r.who + ' ' + r.action + ' ' + auditLabel(r.action) + ' ' + auditDetails(r)).toLowerCase().indexOf(q) !== -1;
      });
      body.innerHTML = '';
      if (!list.length) { body.appendChild(h('p', { class: 'ads-note' }, t(rows.length ? 'audit.noMatch' : 'audit.none'))); return; }
      body.appendChild(h('p', { class: 'ads-sub' }, t('audit.count', { n: list.length, total: rows.length })));
      body.appendChild(h('div', { class: 'ads-tablewrap' }, h('table', { class: 'ads-table ads-audit' }, [
        h('thead', {}, h('tr', {}, ['audit.when', 'audit.who', 'audit.what', 'audit.company', 'audit.details'].map(function (k) { return h('th', { scope: 'col' }, t(k)); }))),
        h('tbody', {}, list.map(function (r) {
          var p = r.payload || {}, biz = p.business_id || (r.entity === 'business' || r.entity === 'company' ? r.entityId : '');
          return h('tr', { class: r.ok ? null : 'is-failed' }, [
            h('td', { class: 'ads-audit__when' }, fmtDateTime(r.at)),
            h('td', {}, r.who || '—'),
            h('td', {}, [auditLabel(r.action), r.dryRun ? ' ' : null, r.dryRun ? pill(t('audit.dry'), 'off') : null, r.ok ? null : ' ', r.ok ? null : pill(t('audit.failed'), 'out')]),
            h('td', {}, biz ? bizName(biz) : '—'),
            h('td', { class: 'ads-audit__details' }, auditDetails(r) || '—')
          ]);
        }))
      ])));
    }
  }

  /* ---------------------------------------------------------------------
     13. Top bar, language, user menu
     --------------------------------------------------------------------- */
  function syncSideToggle() {
    var b = $('#ads-side-toggle'); if (!b) return;
    var open = !document.documentElement.classList.contains('ads-side-collapsed');
    b.setAttribute('aria-expanded', String(open));
    b.setAttribute('aria-label', t(open ? 'top.sideCollapse' : 'top.sideExpand'));
  }
  function buildTopbar() {
    syncSideToggle();
    var biz = $('#ads-biz'), acc = $('#ads-account'), live = liveMode();
    // Viewers and Approvers see their role next to the mode badge (the database refuses what they may not do).
    var rp = $('#ads-role');
    if (!rp) { rp = h('span', { id: 'ads-role', class: 'ads-badge ads-badge--role' }); $('#ads-badge').insertAdjacentElement('afterend', rp); }
    rp.hidden = !access || access.role === 'admin';
    rp.textContent = access && access.role !== 'admin' ? t('role.badge.' + access.role) : '';
    biz.innerHTML = '';
    if (!settings.businesses.length) biz.appendChild(h('option', { value: '' }, t('co.noneYet')));
    settings.businesses.forEach(function (b) { biz.appendChild(h('option', { value: b.id }, b.name)); });
    if (!access || (access.role === 'admin' && access.allCompanies)) biz.appendChild(h('option', { value: '__add' }, t('co.addOption')));
    biz.value = ctx.business || '';
    fillAccounts();
    $('#ads-user-email').textContent = user ? user.email : '';
    var bd = $('#ads-badge');
    $('#ads-newuser').hidden = live; // demo of the first visit: sample mode only
    bd.textContent = t(live ? 'top.badge.live' : 'top.badge.mock');
    bd.classList.toggle('ads-badge--live', live);
    $('#ads-mode').textContent = t(live ? 'menu.modeMock' : 'menu.modeLive');
    // One mode since 14 Nov 2026 (owner D-63 a): the sample switch and "Reset demo data" exist only on
    // Claude's local test page.
    $('#ads-mode').hidden = !api.testPage;
    $('#ads-reset').hidden = !api.testPage;
    $('#ads-lang').textContent = AdsI18n.lang() === 'en' ? 'ქართული' : 'English';
    function fillAccounts() {
      acc.innerHTML = '';
      acc.appendChild(h('option', { value: 'all' }, t('common.allAccounts')));
      accounts(ctx.business).forEach(function (a) { acc.appendChild(h('option', { value: a.id }, a.name)); });
      acc.value = ctx.account;
    }
    buildTopbar.fillAccounts = fillAccounts;
  }
  // "Send feedback" (top bar) opens the website's chat window on its Feedback view; without the window
  // (../career.js missing or signed out) the e-mail link works. Career admins also get "Admin: messages":
  // messages and feedback of every service arrive there, this tool's tagged "Ads".
  function wireFeedback() {
    var a = $('#ads-feedback');
    if (!a) return;
    a.addEventListener('click', function (e) {
      if (!document.querySelector('.chat-dock:not([hidden])')) return;
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('phantasma:chat-open', { detail: { view: 'feedback' } }));
    });
    client.rpc('is_career_admin').then(function (r) {
      if (!r || r.error || r.data !== true || $('#ads-admin-msgs')) return;
      a.parentNode.insertBefore(h('a', { id: 'ads-admin-msgs', class: 'ads-btn ads-btn--ghost ads-btn--small', href: '../admin.html#messages', 'data-i18n': 'top.adminMsgs' }, t('top.adminMsgs')), a);
    }, function () { /* not an admin, or offline: no link */ });
  }
  function saveCtx() { try { localStorage.setItem('ads_ctx', JSON.stringify(ctx)); } catch (e) { /* ignore */ } }
  function loadCtx() {
    try { var c = JSON.parse(localStorage.getItem('ads_ctx')); if (c && c.business) { ctx.business = c.business; ctx.account = c.account || 'all'; } } catch (e) { /* ignore */ }
    if (!settings.businesses.some(function (b) { return b.id === ctx.business; })) ctx = { business: settings.businesses.length ? settings.businesses[0].id : null, account: 'all' };
    if (ctx.account !== 'all' && !accounts(ctx.business).some(function (a) { return a.id === ctx.account; })) ctx.account = 'all';
  }
  function wireShell() {
    $('#ads-biz').addEventListener('change', function (e) {
      if (e.target.value === '__add') { e.target.value = ctx.business || ''; companyDialog(null); return; }
      if (!e.target.value) return;
      ctx.business = e.target.value; ctx.account = 'all'; campAccount = 'all'; wizard = null; styCompany = null; saveCtx(); buildTopbar.fillAccounts(); firstRender = 'focus'; refresh();
    });
    $('#ads-newuser').addEventListener('click', function () {
      $('#ads-user-menu').hidden = true; $('#ads-user-btn').setAttribute('aria-expanded', 'false');
      confirmDialog({ title: t('menu.newUser'), message: t('menu.newUser.text'), confirmLabel: t('menu.newUser.yes') }).then(function (ok) {
        if (!ok) return;
        api.startEmptyWorkspace().then(function () { location.reload(); });
      });
    });
    $('#ads-account').addEventListener('change', function (e) { ctx.account = e.target.value; campAccount = 'all'; saveCtx(); refresh(); });
    $('#ads-lang').addEventListener('click', function () {
      AdsI18n.setLang(AdsI18n.lang() === 'en' ? 'ka' : 'en');
      AdsI18n.apply(document); buildNav(); buildTopbar(); buildAssistant(); route();
      $('#ads-lang').focus();
    });
    $('#ads-menu-btn').addEventListener('click', function () { openDrawer(sidebar, this); });
    $('#ads-side-toggle').addEventListener('click', function () {
      var collapse = !document.documentElement.classList.contains('ads-side-collapsed');
      document.documentElement.classList.toggle('ads-side-collapsed', collapse);
      try { localStorage.setItem('ads_side', collapse ? 'collapsed' : 'open'); } catch (e) { /* ignore */ }
      syncSideToggle();
    });
    syncSideToggle();
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
        if (!ok) return;
        // The demo uploads are gone too: rebuild the image cache from scratch.
        api.resetDemo().then(function () { return api.listImages(undefined, { archived: true }); }).then(function (list) {
          imageCache = {}; cacheImages(list); toast(t('reset.done')); refresh();
        });
      });
    });
    // A file dropped outside a drop zone must not open in this tab (the tool would be left).
    ['dragover', 'drop'].forEach(function (type) {
      document.addEventListener(type, function (e) {
        var dt = e.dataTransfer;
        if (!dt || [].indexOf.call(dt.types || [], 'Files') === -1 || (e.target.closest && e.target.closest('.ads-drop'))) return;
        e.preventDefault();
        if (type === 'dragover') dt.dropEffect = 'none';
      });
    });
    window.addEventListener('hashchange', function () { firstRender = 'focus'; route(); });
  }

  /* ---------------------------------------------------------------------
     14. Gate and boot
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
  function start(session) {
    if (started) return;
    started = true;
    user = session.user;
    api.setActor(user.email, user.id);
    // One mode since 14 Nov 2026 (owner D-63 a): when the real data cannot be read (offline, server asleep) the
    // tool says so and offers Retry (gate "error" below). It no longer falls back to sample data: that switched
    // a browser to invented companies and people for good ("Breeze", "nino.sample@example.com").
    var settingsP = api.getSettings();
    // Archived pictures too, so posts that use one still show it until it is deleted.
    Promise.all([settingsP, api.listImages(undefined, { archived: true }), api.myAccess().catch(function () { return null; }), api.listGoals()]).then(function (r) {
      settings = r[0];
      cacheImages(r[1]);
      access = r[2] || { role: 'admin', allCompanies: true, companies: [] };
      goalsCache = r[3] || [];
      main = $('#ads-main'); shell = $('#ads-shell'); scrim = $('#ads-scrim'); toastBox = $('#ads-toasts'); sidebar = $('#ads-sidebar'); assistant = $('#ads-assistant');
      loadCtx(); buildNav(); buildTopbar(); buildAssistant(); wireShell(); wireFeedback();
      $('#ads-gate').hidden = true; $('#ads-app').hidden = false;
      route();
      if (!liveMode() && !settings.businesses.length && !(settings.onboarding && settings.onboarding.skipped)) openOnboarding();
    }).catch(function () { started = false; showGate('error'); });
  }
  function boot() {
    AdsI18n.apply(document);
    $('#ads-app').hidden = true;
    if (!window.supabase || !window.supabase.createClient) return showGate('error'); // fail closed
    try { client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch (e) { return showGate('error'); }
    api.setClient(client); // same session as the gate; api.js sends its access token to the Edge Functions
    // The website's Messages + Feedback window (../career.js, loaded after this file; 11 Nov 2026) reaches
    // Supabase through this client, as on the job-search, tender and e-commerce pages. Set before career.js
    // starts (its DOMContentLoaded listener runs after this one). <body data-chat="ads"> names the service.
    window.PhantasmaAuth = { db: function () { return client; }, session: function () { return chatSession; } };
    client.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      if (res.error) return showGate('error');
      if (!s) return showGate('login');
      // Members only (fail closed): signed-in people without a role see "No access". Invitations for this
      // e-mail become memberships first (0039); every role gets in (Viewers see, Admins change).
      return api.acceptInvites().then(function () { return client.rpc('ads_has_access'); }).then(function (m) {
        if (m.error) return showGate('error');
        if (m.data !== true) return showGate('denied');
        start(s);
      });
    }).catch(function () { showGate('error'); });
    client.auth.onAuthStateChange(function (ev, s) {
      chatSession = s || null;
      document.dispatchEvent(new CustomEvent('phantasma:auth', { detail: { event: ev, session: chatSession } }));
      if (ev === 'SIGNED_OUT' && started) location.reload();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
