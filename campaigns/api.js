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
   Everything else (campaign lists, posts, numbers) is still mock data.
   No secrets belong in this file.
   ========================================================================= */
(function () {
  'use strict';

  var STORE_KEY = 'ads_mock_state_v1';
  var MODE_KEY = 'ads_backend_mode'; // 'mock' (default) | 'live'
  var REVIEW_DELAY_MS = 15000; // mock "Meta review" takes 15 seconds

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

  var state = null;     // { campaigns, posts, audit }
  var fixed = null;     // { settings, products, images, insights }
  var actor = 'unknown';
  var client = null;    // supabase client, handed over by ads.js (same session as the gate)

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
      } else {
        state = { campaigns: seedCampaigns(d[4]), posts: seedPosts(d[5]), audit: seedAudit(d[6]) };
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
  function listProducts(b) { return init().then(function () { return wait(fixed.products.filter(function (p) { return !b || p.business === b; })); }); }
  function listImages(b) { return init().then(function () { return wait(fixed.images.filter(function (p) { return !b || p.business === b; })); }); }
  function listAudit() { return init().then(function () { return wait(state.audit); }); }
  function resetDemo() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    ready = null;
    return init();
  }

  window.AdsApi = {
    FLOW: FLOW,
    setActor: function (e) { actor = e || 'unknown'; },
    setClient: function (c) { client = c; },
    mode: mode, setMode: setMode, isLive: isLive,
    metaHealth: metaHealth, listPagePosts: listPagePosts, newRequestId: newRequestId, createCampaignLive: createCampaignLive,
    canMove: function (kind, from, to) { return FLOW[kind][from].indexOf(to) !== -1; },
    findRisks: findRisks, total: total,
    init: init, getSettings: getSettings, listProducts: listProducts, listImages: listImages,
    listCampaigns: listCampaigns, getCampaign: getCampaign, createCampaign: createCampaign,
    moveCampaign: moveCampaign, duplicateCampaign: duplicateCampaign, getResults: getResults,
    getDashboard: getDashboard, listPosts: listPosts, getPost: getPost, savePost: savePost,
    movePost: movePost, deletePost: deletePost, listAudit: listAudit, resetDemo: resetDemo
  };
})();
