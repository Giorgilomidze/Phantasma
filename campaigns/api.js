/* =========================================================================
   Ads Management - api.js
   The ONLY file that touches data. Every function is async and returns
   plain JSON. In round 1 the data is MOCK: it is read from campaigns/mock/*.json
   and edits live in memory + localStorage so the demo feels real.
   Later, only this file changes (fetch() calls to a server). The UI never
   reads localStorage or the mock files directly.
   LIVE backend (opt-in, switch in the user menu, kept in localStorage
   'ads_backend_mode'): businesses + spending caps are read from the tables
   ads_businesses / ads_settings, and two Supabase Edge Functions are called with
   the signed-in user's session token (the supabase client from ads.js):
   ads-meta-health and ads-create-campaign. The Meta token never reaches the
   browser. While the server secret ADS_LIVE is off, create-campaign is a DRY RUN.
   Since 6 Nov 2026 the live backend also keeps the image library (private
   bucket ads-library + table ads_images) and the product stock (table
   ads_products, written only through the RPC ads_import_stock).
   Everything else (campaign lists, posts, numbers) is still mock data.
   In mock mode, library uploads live in memory only (gone on reload) and the
   stock sits in the demo state in localStorage.
   No secrets belong in this file.
   ========================================================================= */
(function () {
  'use strict';

  var STORE_KEY = 'ads_mock_state_v2';   // v2: more sample data, 5 Nov 2026
  var MODE_KEY = 'ads_backend_mode'; // 'mock' (default) | 'live'
  var REVIEW_DELAY_MS = 15000; // mock "Meta review" takes 15 seconds

  /* ---- Image library and stock rules (the bucket and the RPC enforce them again) ---- */
  var IMG_BUCKET = 'ads-library';
  var IMG_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }; // mime -> file extension
  var IMG_EXTS = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  var IMG_MAX_MB = 10, IMG_MAX_FILES = 20, IMG_MAX_TITLE = 200;
  var STOCK_BATCH = 1000; // rows per ads_import_stock call (server limit)

  /* ---- State machines (one definition, used by the UI and by this file) ---- */
  var FLOW = {
    campaign: {
      draft: ['paused'],
      paused: ['in_review', 'ended'],
      in_review: ['active', 'rejected', 'paused'],
      active: ['paused', 'ended'],
      rejected: ['paused'],
      ended: []
    },
    post: {
      draft: ['needs_approval'],
      needs_approval: ['approved', 'draft'],
      approved: ['scheduled', 'published', 'draft'],
      scheduled: ['published', 'approved'],
      published: []
    }
  };

  var state = null;     // { campaigns, posts, audit, stock }
  var fixed = null;     // { settings, products, images, insights }
  var actor = 'unknown';
  var actorId = null;   // auth user id: live audit rows must carry it
  var client = null;    // supabase client, handed over by ads.js (same session as the gate)
  var uploads = [];     // mock-mode library uploads, newest first: in memory only (object URLs)

  /* ---- small helpers ---- */
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function wait(v) {
    return new Promise(function (res) { setTimeout(function () { res(clone(v)); }, 90); });
  }
  function dayKey(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function parseKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function newId(prefix) { return prefix + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function lsGet() { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ } }
  function fetchJson(name) {
    return fetch('mock/' + name + '.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('mock/' + name + '.json ' + r.status);
      return r.json();
    });
  }

  /* ---- backend mode (mock | live) ---- */
  function mode() { try { return localStorage.getItem(MODE_KEY) === 'live' ? 'live' : 'mock'; } catch (e) { return 'mock'; } }
  function setMode(m) { try { localStorage.setItem(MODE_KEY, m === 'live' ? 'live' : 'mock'); } catch (e) { /* private mode: stays mock */ } }
  function isLive() { return mode() === 'live'; }

  /* ---- live backend ---- */
  // Reads ads_businesses + ads_settings (RLS applies: members only).
  function loadLive() {
    if (!client) return Promise.reject(new Error('no client'));
    return Promise.all([
      client.from('ads_businesses').select('id,name,page_id,ad_account_id,currency,active').order('created_at', { ascending: true }),
      client.from('ads_settings').select('max_daily_budget_minor,max_total_budget_minor,max_days,currency').eq('id', true).maybeSingle()
    ]).then(function (r) {
      if (r[0].error || r[1].error) throw new Error('live read failed');
      var rows = (r[0].data || []).filter(function (b) { return b.active; });
      var cap = r[1].data;
      if (!rows.length || !cap) throw new Error('no live businesses or caps');
      return {
        businesses: rows.map(function (b) {
          return { id: b.id, name: b.name, currency: b.currency, pageId: b.page_id,
            accounts: [{ id: b.ad_account_id, name: b.name + ' (' + b.ad_account_id + ')' }] };
        }),
        limits: {
          minDailyBudget: 0.01, maxDailyBudget: cap.max_daily_budget_minor / 100,
          maxTotalBudget: cap.max_total_budget_minor / 100, maxDays: cap.max_days
        },
        currency: cap.currency
      };
    });
  }
  // Calls an Edge Function. Always resolves with the parsed JSON body, also for
  // error statuses ({ ok:false, error:{ code, message } }); rejects only when offline.
  function callFn(name, body) {
    if (!client) return Promise.reject(new Error('no client'));
    return client.functions.invoke(name, { body: body }).then(function (r) {
      if (!r.error) return r.data;
      var res = r.error.context;
      if (res && typeof res.json === 'function') {
        return res.json().catch(function () { return { ok: false, error: { code: 'server', message: '' } }; });
      }
      return { ok: false, error: { code: 'network', message: '' } };
    });
  }
  function metaHealth(businessId) { return callFn('ads-meta-health', { business_id: businessId }); }
  // Published posts of the business's Facebook Page, newest first (live only; mock has none).
  // Resolves with [{ id, message, created_time, permalink_url, picture }]; rejects with the
  // server's plain-language message (empty string when the server could not be reached).
  function listPagePosts(businessId) {
    if (!isLive()) return Promise.resolve([]);
    return callFn('ads-list-posts', { business_id: businessId }).then(function (r) {
      if (r && r.ok && Array.isArray(r.posts)) return r.posts;
      var e = new Error((r && r.error && r.error.message) || '');
      e.code = (r && r.error && r.error.code) || 'server';
      throw e;
    });
  }
  function newRequestId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var x = Array.prototype.map.call(b, function (n) { return (n < 16 ? '0' : '') + n.toString(16); }).join('');
    return x.slice(0, 8) + '-' + x.slice(8, 12) + '-' + x.slice(12, 16) + '-' + x.slice(16, 20) + '-' + x.slice(20);
  }
  // d: { requestId, business, name, goal, dailyBudget (major units), days, postObjectId, ageMin, ageMax }
  // The server recomputes the total and enforces the caps; nothing here is trusted.
  function createCampaignLive(d) {
    return callFn('ads-create-campaign', {
      client_request_id: d.requestId, business_id: d.business, name: d.name, goal: d.goal,
      post_object_id: d.postObjectId, daily_budget_minor: Math.round(d.dailyBudget * 100), days: d.days,
      countries: ['GE'], age_min: d.ageMin, age_max: d.ageMax
    });
  }

  /* ---- load ---- */
  var ready = null;
  function init() {
    if (ready) return ready;
    var names = ['settings', 'products', 'images', 'insights', 'campaigns', 'posts', 'audit'];
    ready = Promise.all(names.map(fetchJson)).then(function (d) {
      fixed = { settings: d[0], products: d[1], images: d[2], insights: d[3] };
      var stored = lsGet();
      if (stored && stored.campaigns && stored.posts && stored.audit) {
        state = stored;
        if (!state.stock) state.stock = []; // demo states saved before 6 Nov 2026
      } else {
        state = { campaigns: seedCampaigns(d[4]), posts: seedPosts(d[5]), audit: seedAudit(d[6]), stock: [] };
        save();
      }
    });
    return ready;
  }
  function seedCampaigns(list) {
    var t = today();
    return list.map(function (c) {
      c.startDate = dayKey(addDays(t, c.startOffset));
      c.statusAt = new Date().toISOString();
      delete c.startOffset;
      if (c.status === 'in_review') c.reviewAt = Date.now() + REVIEW_DELAY_MS;
      return c;
    });
  }
  function seedPosts(list) {
    var t = today();
    return list.map(function (p) {
      if (p.dateOffset !== null) {
        var iso = addDays(t, p.dateOffset).toISOString();
        if (p.status === 'published') p.publishedAt = iso; else p.scheduledAt = iso;
      }
      delete p.dateOffset;
      return p;
    });
  }
  function seedAudit(list) {
    var now = Date.now();
    return list.map(function (a) { a.ts = new Date(now - a.daysAgo * 86400000).toISOString(); delete a.daysAgo; return a; });
  }

  /* ---- audit: every mutating call below goes through here ---- */
  function audit(action, type, id, detail) {
    state.audit.unshift({ id: newId('au'), ts: new Date().toISOString(), user: actor, action: action, entityType: type, entityId: id, detail: detail || '' });
    if (state.audit.length > 500) state.audit.length = 500;
  }

  /* ---- policy check: forbidden words come from settings.json ---- */
  function findRisks(text) {
    var out = [], low = String(text || '').toLowerCase();
    (fixed.settings.forbiddenWords || []).forEach(function (w) {
      var from = 0, i;
      while ((i = low.indexOf(w.word.toLowerCase(), from)) !== -1) {
        out.push({ word: w.word, start: i, end: i + w.word.length, en: w.en, ka: w.ka });
        from = i + w.word.length;
      }
    });
    return out.sort(function (a, b) { return a.start - b.start; });
  }

  /* ---- campaigns ---- */
  function settleReviews() {
    var changed = false;
    state.campaigns.forEach(function (c) {
      if (c.status === 'in_review' && c.reviewAt && c.reviewAt <= Date.now()) {
        var risks = findRisks(c.caption);
        c.status = risks.length ? 'rejected' : 'active';
        c.statusAt = new Date().toISOString();
        if (risks.length) c.rejectReason = 'Caption contains a claim that is not allowed: ' + risks[0].word + '.';
        delete c.reviewAt;
        audit('campaign.review_' + c.status, 'campaign', c.id, '(MOCK review result)');
        changed = true;
      }
    });
    if (changed) save();
  }
  function total(c) { return Math.round(c.dailyBudget * c.days * 100) / 100; }

  function listCampaigns(f) {
    f = f || {};
    return init().then(function () {
      settleReviews();
      var q = (f.q || '').toLowerCase();
      var rows = state.campaigns.filter(function (c) {
        return (!f.business || c.business === f.business) &&
          (!f.account || f.account === 'all' || c.accountId === f.account) &&
          (!f.status || f.status === 'all' || c.status === f.status) &&
          (!q || c.name.toLowerCase().indexOf(q) !== -1);
      }).map(function (c) {
        var r = runTotals(c, 9999);
        return Object.assign({}, c, { spend: r.spend, messages: r.messages }); // copy: do not store totals in state
      });
      return wait(rows);
    });
  }
  function getCampaign(id) {
    return init().then(function () {
      settleReviews();
      var c = state.campaigns.filter(function (x) { return x.id === id; })[0];
      if (!c) throw new Error('not found');
      return wait(c);
    });
  }
  function createCampaign(d, via) {
    return init().then(function () {
      var s = fixed.settings.limits;
      if (!(d.dailyBudget >= s.minDailyBudget && d.dailyBudget <= s.maxDailyBudget)) throw new Error('budget out of range');
      if (!(d.days >= 1 && d.days <= s.maxDays)) throw new Error('days out of range');
      // New campaigns are ALWAYS created paused. Nothing is spent until "Switch on".
      var c = {
        id: newId('c'), business: d.business, accountId: d.accountId, name: d.name, goal: d.goal,
        status: 'paused', dailyBudget: d.dailyBudget, days: d.days, startDate: d.startDate || dayKey(today()),
        audience: d.audience, caption: d.caption || '', postId: d.postId || null, imageIds: d.imageIds || [],
        statusAt: new Date().toISOString()
      };
      state.campaigns.unshift(c);
      audit('campaign.created', 'campaign', c.id, c.name + ' | ' + c.dailyBudget + ' GEL/day x ' + c.days + ' = ' + total(c) + ' GEL (paused)' + (via ? ' | via ' + via : ''));
      save();
      return wait(c);
    });
  }
  function moveCampaign(id, to, via) {
    return init().then(function () {
      var c = state.campaigns.filter(function (x) { return x.id === id; })[0];
      if (!c) throw new Error('not found');
      if (FLOW.campaign[c.status].indexOf(to) === -1) throw new Error('illegal transition ' + c.status + ' -> ' + to);
      var from = c.status;
      c.status = to; c.statusAt = new Date().toISOString();
      if (to === 'in_review') { c.reviewAt = Date.now() + REVIEW_DELAY_MS; delete c.rejectReason; }
      audit('campaign.' + to, 'campaign', c.id, from + ' -> ' + to + (to === 'in_review' ? ' | total ' + total(c) + ' GEL confirmed' : '') + (via ? ' | via ' + via : ''));
      save();
      return wait(c);
    });
  }
  function duplicateCampaign(id) {
    return init().then(function () {
      var c = state.campaigns.filter(function (x) { return x.id === id; })[0];
      if (!c) throw new Error('not found');
      var n = clone(c);
      n.id = newId('c'); n.name = c.name + ' (copy)'; n.status = 'draft'; n.startDate = dayKey(today());
      n.statusAt = new Date().toISOString();
      delete n.reviewAt; delete n.rejectReason;
      state.campaigns.unshift(n);
      audit('campaign.duplicated', 'campaign', n.id, 'from ' + c.id);
      save();
      return wait(n);
    });
  }

  /* ---- fake insights: deterministic per campaign + day ---- */
  function noise(id, i) {
    var h = 0, s = id + ':' + i;
    for (var k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0;
    return 0.75 + (h % 1000) / 1000 * 0.5;
  }
  function dayStats(c, date) {
    if (['active', 'paused', 'ended'].indexOf(c.status) === -1) return null;
    var start = parseKey(c.startDate), end = addDays(start, c.days - 1), t = today();
    if (date < start || date > end || date > t) return null;
    if (c.status === 'paused' && date >= t) return null;
    var ins = fixed.insights.campaigns[c.id] || { reachPerDay: c.dailyBudget * 180, messagesPerDay: c.dailyBudget * 0.6 };
    var n = noise(c.id, dayKey(date));
    return { spend: c.dailyBudget * 0.92 * n, reach: Math.round(ins.reachPerDay * n), messages: Math.round(ins.messagesPerDay * noise(c.id, 'm' + dayKey(date))) };
  }
  function runTotals(c, rangeDays) {
    var t = today(), sum = { spend: 0, reach: 0, messages: 0 };
    for (var i = 0; i < Math.min(rangeDays, 120); i++) {
      var s = dayStats(c, addDays(t, -i));
      if (s) { sum.spend += s.spend; sum.reach += s.reach; sum.messages += s.messages; }
    }
    sum.spend = Math.round(sum.spend * 100) / 100;
    return sum;
  }
  function getDashboard(f) {
    return init().then(function () {
      settleReviews();
      var days = f.range || 30, t = today();
      var cs = state.campaigns.filter(function (c) {
        return (!f.business || c.business === f.business) && (!f.account || f.account === 'all' || c.accountId === f.account);
      });
      var series = [], k = { spend: 0, reach: 0, messages: 0 };
      for (var i = days - 1; i >= 0; i--) {
        var d = addDays(t, -i), row = { date: dayKey(d), spend: 0, messages: 0 };
        cs.forEach(function (c) {
          var s = dayStats(c, d);
          if (s) { row.spend += s.spend; row.messages += s.messages; k.reach += s.reach; }
        });
        row.spend = Math.round(row.spend * 100) / 100;
        k.spend += row.spend; k.messages += row.messages;
        series.push(row);
      }
      var rows = cs.map(function (c) {
        var r = runTotals(c, days);
        return { id: c.id, name: c.name, status: c.status, spend: r.spend, messages: r.messages };
      }).filter(function (r) { return r.spend > 0 || r.status === 'active'; });
      var alerts = fixed.insights.alerts.filter(function (a) { return !f.business || a.business === f.business; });
      return wait({
        kpis: {
          spend: Math.round(k.spend * 100) / 100, reach: k.reach, messages: k.messages,
          costPerMessage: k.messages ? Math.round(k.spend / k.messages * 100) / 100 : null,
          activeCampaigns: cs.filter(function (c) { return c.status === 'active'; }).length
        },
        series: series, campaigns: rows, alerts: alerts, updatedAt: new Date().toISOString()
      });
    });
  }
  function getResults(id) {
    return init().then(function () {
      var c = state.campaigns.filter(function (x) { return x.id === id; })[0];
      if (!c) throw new Error('not found');
      var t = today(), series = [], tot = { spend: 0, reach: 0, messages: 0 };
      for (var i = 0; i < 30; i++) {
        var d = addDays(t, -(29 - i)), s = dayStats(c, d);
        series.push({ date: dayKey(d), spend: s ? Math.round(s.spend * 100) / 100 : 0, messages: s ? s.messages : 0 });
        if (s) { tot.spend += s.spend; tot.reach += s.reach; tot.messages += s.messages; }
      }
      tot.spend = Math.round(tot.spend * 100) / 100;
      tot.costPerMessage = tot.messages ? Math.round(tot.spend / tot.messages * 100) / 100 : null;
      return wait({ campaign: c, totals: tot, series: series });
    });
  }

  /* ---- posts ---- */
  function listPosts(f) {
    f = f || {};
    return init().then(function () {
      return wait(state.posts.filter(function (p) { return !f.business || p.business === f.business; }));
    });
  }
  function getPost(id) {
    return init().then(function () {
      var p = state.posts.filter(function (x) { return x.id === id; })[0];
      if (!p) throw new Error('not found');
      return wait(p);
    });
  }
  // Create or update a post. Only drafts can be edited.
  function savePost(d, via) {
    return init().then(function () {
      var p = d.id ? state.posts.filter(function (x) { return x.id === d.id; })[0] : null;
      if (p) {
        if (p.status !== 'draft') throw new Error('only drafts can be edited');
        p.productId = d.productId || null; p.caption = d.caption; p.imageId = d.imageId || null;
        audit('post.saved', 'post', p.id, 'draft updated');
      } else {
        p = { id: newId('post'), business: d.business, status: 'draft', productId: d.productId || null, caption: d.caption, imageId: d.imageId || null };
        state.posts.unshift(p);
        audit('post.created', 'post', p.id, 'draft created' + (via ? ' | via ' + via : ''));
      }
      save();
      return wait(p);
    });
  }
  function movePost(id, to, extra) {
    return init().then(function () {
      var p = state.posts.filter(function (x) { return x.id === id; })[0];
      if (!p) throw new Error('not found');
      if (FLOW.post[p.status].indexOf(to) === -1) throw new Error('illegal transition ' + p.status + ' -> ' + to);
      var from = p.status, detail = from + ' -> ' + to;
      if (to === 'scheduled') {
        if (!extra || !extra.scheduledAt) throw new Error('date required');
        p.scheduledAt = extra.scheduledAt; detail += ' | ' + extra.scheduledAt;
      }
      if (to === 'published') { p.publishedAt = new Date().toISOString(); delete p.scheduledAt; detail += ' | (MOCK: nothing was really posted)'; }
      if (to === 'approved' || to === 'draft') delete p.scheduledAt;
      p.status = to;
      audit('post.' + to, 'post', p.id, detail);
      save();
      return wait(p);
    });
  }
  function deletePost(id) {
    return init().then(function () {
      var i = state.posts.findIndex(function (x) { return x.id === id; });
      if (i === -1) throw new Error('not found');
      if (state.posts[i].status === 'published') throw new Error('published posts cannot be deleted here');
      state.posts.splice(i, 1);
      audit('post.deleted', 'post', id, '');
      save();
      return wait({ ok: true });
    });
  }

  /* ---- fixed lists ---- */
  function getSettings() {
    return init().then(function () {
      if (!isLive()) return wait(fixed.settings);
      return loadLive().then(function (live) {
        var s = clone(fixed.settings); // locations, forbidden words, caption limit stay from the mock file
        s.live = true; s.businesses = live.businesses; s.currency = live.currency;
        Object.keys(live.limits).forEach(function (k) { s.limits[k] = live.limits[k]; });
        return s;
      });
    });
  }
  function listAudit() { return init().then(function () { return wait(state.audit); }); }
  function resetDemo() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    uploads.forEach(function (u) { try { URL.revokeObjectURL(u.url); } catch (e) { /* ignore */ } });
    uploads = [];
    ready = null;
    return init();
  }

  /* ---- live helpers for the library and the stock ---- */
  // supabase-js answers { data, error }; an error becomes a rejection.
  function must(r) { if (r.error) throw new Error(r.error.message || 'request failed'); return r.data; }
  // Every row of a query, 1000 per call (the API returns at most 1000 rows at a time).
  // build() makes a fresh query each time: a query runs only once.
  function selectAll(build) {
    var out = [], size = 1000;
    function page(from) {
      return build().range(from, from + size - 1).then(function (r) {
        var rows = must(r) || [];
        out = out.concat(rows);
        return rows.length === size && out.length < 100000 ? page(from + size) : out;
      });
    }
    return page(0);
  }
  // Best-effort audit row for library actions (insert-only table). A failure is ignored.
  function auditLive(action, entity, entityId, payload) {
    if (!client || !actorId) return;
    try {
      client.from('ads_audit').insert({ actor: actorId, actor_email: actor, action: action, entity: entity, entity_id: entityId, ok: true, payload: payload || null })
        .then(function () { /* ignore */ }, function () { /* ignore */ });
    } catch (e) { /* ignore */ }
  }
  // Error with an i18n key (e.key, e.vars) the UI can translate.
  function codeError(key, vars) { var e = new Error(key); e.key = key; e.vars = vars || {}; return e; }

  /* ---- image library ---- */
  // Item: { id, business, kind ('picture' | 'element'), title, title_en, title_ka, url, mime, bytes,
  //   width, height, createdAt, sample }. Sample images have no url: app.js draws them.
  function sampleImages(b) {
    return fixed.images.filter(function (p) { return !b || p.business === b; })
      .map(function (p) { return Object.assign({}, p, { kind: 'picture', sample: true }); });
  }
  function liveImage(r, url) {
    return { id: r.id, business: r.business_id, kind: r.kind, title: r.title, title_en: r.title, title_ka: r.title, url: url,
      mime: r.mime, bytes: r.bytes, width: r.width, height: r.height, createdAt: r.created_at, sample: false };
  }
  function liveImages(b) {
    if (!client) return Promise.reject(new Error('no client'));
    return selectAll(function () {
      var q = client.from('ads_images').select('id,business_id,kind,title,path,mime,bytes,width,height,created_at');
      if (b) q = q.eq('business_id', b);
      return q.order('created_at', { ascending: false }).order('id', { ascending: true });
    }).then(function (rows) {
      if (!rows.length) return [];
      // The bucket is private: one call signs every address, valid for an hour.
      return client.storage.from(IMG_BUCKET).createSignedUrls(rows.map(function (r) { return r.path; }), 3600).then(function (s) {
        var urls = {};
        (must(s) || []).forEach(function (x) { if (x && x.signedUrl && !x.error) urls[x.path] = x.signedUrl; });
        return rows.map(function (r) { return liveImage(r, urls[r.path] || ''); });
      });
    });
  }
  // The business's uploads (newest first), then the sample images.
  // opts.strict: a failed live read rejects (the Library page shows it). Without it the
  // pickers still get the samples, so a missing table never blocks the rest of the tool.
  function listImages(b, opts) {
    return init().then(function () {
      if (!isLive()) return wait(uploads.filter(function (u) { return !b || u.business === b; }).concat(sampleImages(b)));
      return liveImages(b).catch(function (e) { if (opts && opts.strict) throw e; return []; })
        .then(function (mine) { return mine.concat(sampleImages(b)); });
    });
  }
  function mimeOf(file) {
    var type = String(file.type || '').toLowerCase(), m = /\.([a-z0-9]+)$/i.exec(file.name || '');
    return type || (m && IMG_EXTS[m[1].toLowerCase()]) || '';
  }
  // Checks one picked file against the library rules: null = fine, else { key, vars } (i18n key
  // of the reason). Used by the upload dialog, and again by uploadImage.
  function checkImageFile(file) {
    var type = mimeOf(file);
    if (/\.(heic|heif)$/i.test(file.name || '') || /^image\/hei[cf]/.test(type)) return { key: 'lib.err.heic' };
    if (!IMG_TYPES[type]) return { key: 'lib.err.type' };
    if (file.size > IMG_MAX_MB * 1048576) return { key: 'lib.err.size', vars: { mb: IMG_MAX_MB } };
    if (!file.size) return { key: 'lib.err.empty' };
    return null;
  }
  // Pixel size, read in the browser before upload (this also proves the file is a readable picture).
  function imageSize(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); resolve({ width: im.naturalWidth, height: im.naturalHeight }); };
      im.onerror = function () { URL.revokeObjectURL(url); reject(codeError('lib.err.decode')); };
      im.src = url;
    });
  }
  // Title = file name without its extension, max 200 characters.
  function titleOf(name) { return String(name || '').replace(/\.[^.]*$/, '').replace(/\s+/g, ' ').trim().slice(0, IMG_MAX_TITLE) || 'image'; }
  // Uploads one picture. kind: 'picture' | 'element'. Resolves with the new library item.
  function uploadImage(b, file, kind) {
    return init().then(function () {
      var bad = checkImageFile(file);
      if (bad) throw codeError(bad.key, bad.vars);
      if (kind !== 'picture' && kind !== 'element') throw new Error('bad kind');
      var mime = mimeOf(file), title = titleOf(file.name);
      return imageSize(file).then(function (dim) {
        if (isLive()) return uploadLive(b, file, kind, mime, title, dim);
        var im = { id: newId('img'), business: b, kind: kind, title: title, title_en: title, title_ka: title, url: URL.createObjectURL(file),
          mime: mime, bytes: file.size, width: dim.width, height: dim.height, createdAt: new Date().toISOString(), sample: false };
        uploads.unshift(im);
        audit('image.upload', 'image', im.id, title + ' | ' + kind + ' | ' + file.size + ' bytes | ' + dim.width + 'x' + dim.height + ' (MOCK: kept in this browser tab only)');
        save();
        return wait(im);
      });
    });
  }
  // LIVE: the file goes to the private bucket first (never overwriting), then the row. If the
  // row cannot be saved the file is taken out again, so no orphan file stays behind.
  function uploadLive(b, file, kind, mime, title, dim) {
    if (!client) return Promise.reject(new Error('no client'));
    var path = b + '/' + newRequestId() + '.' + IMG_TYPES[mime];
    var bucket = client.storage.from(IMG_BUCKET);
    return bucket.upload(path, file, { contentType: mime, upsert: false, cacheControl: '3600' }).then(function (u) {
      must(u);
      return client.from('ads_images').insert({ business_id: b, kind: kind, title: title, path: path, mime: mime, bytes: file.size, width: dim.width, height: dim.height })
        .select('id,business_id,kind,title,path,mime,bytes,width,height,created_at').single()
        .then(must)
        .catch(function (err) {
          return bucket.remove([path]).then(function () { throw err; }, function () { throw err; });
        });
    }).then(function (row) {
      auditLive('image.upload', 'image', row.id, { business_id: b, title: title, kind: kind, bytes: file.size });
      return bucket.createSignedUrl(path, 3600).then(function (s) { return liveImage(row, (s.data && s.data.signedUrl) || ''); },
        function () { return liveImage(row, ''); }); // saved; the address comes with the next list
    });
  }
  // Deletes one upload. Sample images are refused.
  function deleteImage(id) {
    return init().then(function () {
      if (fixed.images.some(function (x) { return x.id === id; })) throw codeError('lib.err.sample');
      if (!isLive()) {
        var i = uploads.findIndex(function (x) { return x.id === id; });
        if (i === -1) throw new Error('not found');
        var im = uploads.splice(i, 1)[0];
        try { URL.revokeObjectURL(im.url); } catch (e) { /* ignore */ }
        audit('image.delete', 'image', id, im.title + ' (MOCK)');
        save();
        return wait({ ok: true });
      }
      if (!client) throw new Error('no client');
      // The row first (that is what the tool shows), then the file, best effort.
      return client.from('ads_images').delete().eq('id', id).select('id,business_id,title,path').then(function (r) {
        var row = (must(r) || [])[0];
        if (!row) throw new Error('not found');
        auditLive('image.delete', 'image', id, { business_id: row.business_id, title: row.title });
        return client.storage.from(IMG_BUCKET).remove([row.path]).then(function () { return { ok: true }; }, function () { return { ok: true }; });
      });
    });
  }

  /* ---- AI pictures: Gemini through the Edge Function ads-generate-image (live only) ---- */
  // The function keeps the key, checks the daily limit and saves the picture in the library.
  // Edge Function reply -> the reply, or an Error with the server's code and plain-English message.
  function fnResult(r) {
    if (r && r.ok) return r;
    var err = (r && r.error) || {};
    var e = new Error(err.message || (r && (r.message || r.msg)) || '');
    // A function that is not deployed yet answers with the gateway's { code: 'NOT_FOUND' }.
    e.code = err.code || (r && r.code === 'NOT_FOUND' ? 'not_deployed' : 'server');
    throw e;
  }
  // Today's limit: { remaining, limit, qualities }.
  function aiImageStatus(b) {
    if (!isLive()) return Promise.reject(codeError('ai.err.mock'));
    return callFn('ads-generate-image', { business_id: b, check: true }).then(fnResult);
  }
  // Is the Gemini key accepted? { model } (a free call to Google, nothing is made).
  function aiTest(b) {
    if (!isLive()) return Promise.reject(codeError('ai.err.mock'));
    return callFn('ads-generate-image', { business_id: b, test: true }).then(fnResult);
  }
  // Makes one picture and saves it in the library. o: { prompt, aspect, quality, refs: [library image ids] }.
  // Resolves { image (library item), remaining, limit }.
  function generateImage(b, o) {
    if (!isLive()) return Promise.reject(codeError('ai.err.mock'));
    return callFn('ads-generate-image', { business_id: b, prompt: o.prompt, aspect_ratio: o.aspect, quality: o.quality, reference_ids: o.refs || [] })
      .then(fnResult).then(function (r) {
        return { image: liveImage(r.image, r.image.url || ''), remaining: r.remaining, limit: r.limit };
      });
  }

  /* ---- products and stock ---- */
  // Item: { id, business, name, name_en, name_ka (= name), quantity, price (sell price in GEL,
  //   or null), updatedAt, sample }. Sample products have no quantity.
  function sampleProducts(b) {
    return fixed.products.filter(function (p) { return !b || p.business === b; })
      .map(function (p) { return Object.assign({}, p, { name: p.name_en, quantity: null, updatedAt: null, sample: true }); });
  }
  function stockItem(id, b, name, quantity, price, at) {
    return { id: id, business: b, name: name, name_en: name, name_ka: name, quantity: quantity, price: price, updatedAt: at, sample: false };
  }
  // Same product = same name with spaces collapsed and case ignored (as in stock-import.js).
  function stockKey(name) { return String(name).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function liveProducts(b) {
    if (!client) return Promise.reject(new Error('no client'));
    return selectAll(function () {
      var q = client.from('ads_products').select('id,business_id,name,quantity,sell_price,updated_at');
      if (b) q = q.eq('business_id', b);
      return q.order('name', { ascending: true }).order('id', { ascending: true });
    }).then(function (rows) {
      return rows.map(function (r) {
        return stockItem(r.id, r.business_id, r.name, r.quantity == null ? null : Number(r.quantity), r.sell_price == null ? null : Number(r.sell_price), r.updated_at);
      });
    });
  }
  // The business's stock products (name order), then the sample products. opts.strict as in listImages.
  function listProducts(b, opts) {
    return init().then(function () {
      if (!isLive()) {
        var mine = state.stock.filter(function (s) { return !b || s.business === b; })
          .sort(function (x, y) { return x.name.localeCompare(y.name); })
          .map(function (s) { return stockItem(s.id, s.business, s.name, s.quantity, s.price, s.updatedAt); });
        return wait(mine.concat(sampleProducts(b)));
      }
      return liveProducts(b).catch(function (e) { if (opts && opts.strict) throw e; return []; })
        .then(function (mine) { return mine.concat(sampleProducts(b)); });
    });
  }
  // rows: [{ name, quantity, sell_price|null }], already checked by stock-import.js.
  // New names are added; known names get the new quantity, and the new price when the row has
  // one (null keeps the old price). Products not in the file stay as they are.
  // Resolves { new, updated }. onProgress(done, total) is optional.
  function importStock(b, rows, onProgress) {
    return init().then(function () {
      var clean = rows.map(function (r) {
        var name = String(r.name == null ? '' : r.name).replace(/\s+/g, ' ').trim();
        var q = Number(r.quantity), p = r.sell_price == null ? null : Number(r.sell_price);
        if (!name || name.length > 300 || !isFinite(q) || q < 0 || (p !== null && (!isFinite(p) || p < 0))) throw new Error('bad stock row: ' + name);
        return { name: name, quantity: q, sell_price: p };
      });
      if (isLive()) return importLive(b, clean, onProgress);
      var now = new Date().toISOString(), known = {}, added = 0, changed = 0;
      state.stock.forEach(function (s) { if (s.business === b) known[stockKey(s.name)] = s; });
      clean.forEach(function (r) {
        var s = known[stockKey(r.name)];
        if (s) {
          s.quantity = r.quantity; if (r.sell_price !== null) s.price = r.sell_price; s.updatedAt = now; changed++;
        } else {
          s = { id: newId('sp'), business: b, name: r.name, quantity: r.quantity, price: r.sell_price, updatedAt: now };
          state.stock.push(s); known[stockKey(r.name)] = s; added++;
        }
      });
      audit('stock.import', 'product', b, added + ' new, ' + changed + ' updated, ' + clean.length + ' rows (MOCK)');
      save();
      if (onProgress) onProgress(clean.length, clean.length);
      return wait({ 'new': added, updated: changed });
    });
  }
  // LIVE: the RPC in batches of 1000 (it writes the audit row itself). When a batch fails the
  // error tells how many rows were saved before it (error.saved, error.total).
  function importLive(b, rows, onProgress) {
    if (!client) return Promise.reject(new Error('no client'));
    var sum = { 'new': 0, updated: 0 }, done = 0;
    function next() {
      if (done >= rows.length) return sum;
      var batch = rows.slice(done, done + STOCK_BATCH);
      return client.rpc('ads_import_stock', { p_business: b, p_rows: batch }).then(function (r) {
        if (r.error) throw new Error(r.error.message || 'import failed');
        var d = (Array.isArray(r.data) ? r.data[0] : r.data) || {};
        sum['new'] += Number(d['new']) || 0; sum.updated += Number(d.updated) || 0;
        done += batch.length;
        if (onProgress) onProgress(done, rows.length);
        return next();
      }).catch(function (err) {
        if (err.saved == null) { err.saved = done; err.total = rows.length; }
        throw err;
      });
    }
    return Promise.resolve().then(next);
  }

  window.AdsApi = {
    FLOW: FLOW,
    setActor: function (email, id) { actor = email || 'unknown'; actorId = id || null; },
    setClient: function (c) { client = c; },
    mode: mode, setMode: setMode, isLive: isLive,
    metaHealth: metaHealth, listPagePosts: listPagePosts, newRequestId: newRequestId, createCampaignLive: createCampaignLive,
    canMove: function (kind, from, to) { return FLOW[kind][from].indexOf(to) !== -1; },
    findRisks: findRisks, total: total,
    init: init, getSettings: getSettings, listProducts: listProducts, listImages: listImages,
    listCampaigns: listCampaigns, getCampaign: getCampaign, createCampaign: createCampaign,
    moveCampaign: moveCampaign, duplicateCampaign: duplicateCampaign, getResults: getResults,
    getDashboard: getDashboard, listPosts: listPosts, getPost: getPost, savePost: savePost,
    movePost: movePost, deletePost: deletePost, listAudit: listAudit, resetDemo: resetDemo,
    // Image library + stock (6 Nov 2026)
    imageRules: { accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp', maxMb: IMG_MAX_MB, maxFiles: IMG_MAX_FILES },
    checkImageFile: checkImageFile, uploadImage: uploadImage, deleteImage: deleteImage, importStock: importStock,
    // AI pictures with Gemini (6 Nov 2026, live only)
    aiImageStatus: aiImageStatus, aiTest: aiTest, generateImage: generateImage
  };
})();
