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
   Also 6 Nov 2026 (supabase/0029, run by the owner): product details (photo,
   display name, English name, note for the picture AI; RPC
   ads_set_product_details), picture style groups (table ads_style_groups:
   FRAME, TAG, BG ... are data, managed in the tool), their options (table
   ads_styles) and the prompt template (table ads_picture_settings). 0029 holds
   no content: everything is typed in or imported in the tool. Until 0029 is
   run those calls fail with the i18n key sty.err.db; nothing else breaks.
   Everything else (campaign lists, posts, numbers) is still mock data. A post
   holds up to 6 products (productIds) and up to 10 pictures (imageIds).
   Campaign edits (updateCampaign, 7 Nov 2026) are mock in both modes too: the
   campaigns are sample data; the Meta update comes with live campaigns.
   9 Nov 2026 (supabase/0033, run by the owner): library folders (uploads,
   elements with a type, ai, products), tags, an Archive (archivedAt; deleted
   for good 30 days later, the server picks them, the browser removes the
   files), and a storage limit per person (ads_library_usage; the database
   refuses an upload over it). A picture chosen as a product photo moves to
   Products in the database (trigger), not here.
   In mock mode, library uploads live in memory only (gone on reload) and the
   stock sits in the demo state in localStorage.
   11 Nov 2026 (plan ADS-32...36): companies with a profile, team with roles, brands and the
   approvals board live in the demo state (state.ws) until the database update (ADS-37).
   No secrets belong in this file.
   ========================================================================= */
(function () {
  'use strict';

  var STORE_KEY = 'ads_mock_state_v2';   // v2: more sample data, 5 Nov 2026
  var MODE_KEY = 'ads_backend_mode'; // test page only since 14 Nov 2026: 'mock' | 'live' (default)
  var REVIEW_DELAY_MS = 15000; // mock "Meta review" takes 15 seconds

  /* ---- Image library and stock rules (the bucket and the RPC enforce them again) ---- */
  var IMG_BUCKET = 'ads-library';
  var IMG_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }; // mime -> file extension
  var IMG_EXTS = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  var IMG_MAX_MB = 10, IMG_MAX_FILES = 20, IMG_MAX_TITLE = 200;
  var IMG_FOLDERS = ['uploads', 'elements', 'ai', 'products']; // a picture's folder (0033); the Archive is archivedAt
  var ELEMENT_TYPES = ['price_tag', 'frame', 'background'];  // the Elements sub-folders (owner, 9 Nov 2026)
  var LIB_MB = 50;        // storage per person (live: ads_settings.library_mb, read through ads_library_usage)
  var ARCHIVE_DAYS = 30;  // archived pictures are deleted for good this many days after archiving
  var TAG_MAX = 20, TAG_LEN = 40; // tags per picture, characters per tag (the database applies the same rule)
  var STOCK_BATCH = 1000; // rows per ads_import_stock call (server limit)
  var POST_MAX_PRODUCTS = 6, POST_MAX_IMAGES = 10; // per post (the composer enforces them too)
  var CAMP_NAME_MAX = 80; // campaign name length (the wizard's and the edit window's fields stop there too)
  var PIC_ASPECTS = ['3:4', '4:5', '1:1', '9:16', '16:9', '4:3']; // the Edge Function's formats; 3:4 is the default
  var GROUP_KINDS = ['element', 'picture'];                         // how a group's reference pictures are stored
  var RESERVED_TOKENS = ['NAME', 'KA', 'TYPE', 'PRICE', 'TEXT', 'RULES']; // filled in by the platform

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
  var limitsNow = null; // spending limits getSettings() last handed to the UI (live: the owner's caps)

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
  // A real calendar day written as YYYY-MM-DD (2026-02-30 is not).
  function isDayKey(k) { return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && dayKey(parseKey(k)) === k; }
  function newId(prefix) { return prefix + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function lsGet() { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ } }
  function fetchJson(name) {
    return fetch('mock/' + name + '.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('mock/' + name + '.json ' + r.status);
      return r.json();
    });
  }

  /* ---- backend mode: one mode, real data (owner D-63 a, 14 Nov 2026) ----
     The sample data ("mock") is used only on Claude's local test page (campaigns/_harness.html sets
     window.__adsTestPage). On the site a value stored by an older version ("mock") is ignored. */
  var TEST_PAGE = window.__adsTestPage === true;
  function mode() {
    if (!TEST_PAGE) return 'live';
    try { return localStorage.getItem(MODE_KEY) === 'mock' ? 'mock' : 'live'; } catch (e) { return 'live'; }
  }
  function setMode(m) { if (!TEST_PAGE) return; try { localStorage.setItem(MODE_KEY, m === 'mock' ? 'mock' : 'live'); } catch (e) { /* ignore */ } }
  function isLive() { return mode() === 'live'; }

  /* ---- live backend ---- */
  // Reads ads_businesses + ads_settings (RLS applies: members only).
  function loadLive() {
    if (!client) return Promise.reject(new Error('no client'));
    return Promise.all([
      client.from('ads_businesses').select('id,name,page_id,instagram_id,ad_account_id,currency,timezone,active,about,goal,channels,tools,work_type,inbox_demo,created_at').order('created_at', { ascending: true }),
      client.from('ads_settings').select('max_daily_budget_minor,max_total_budget_minor,max_days,currency').eq('id', true).maybeSingle()
    ]).then(function (r) {
      if (r[0].error || r[1].error) throw new Error('live read failed');
      var rows = (r[0].data || []).filter(function (b) { return b.active; });
      var cap = r[1].data;
      if (!cap) throw new Error('no live caps');
      return {
        businesses: rows.map(liveCompany),
        limits: {
          minDailyBudget: 0.01, maxDailyBudget: cap.max_daily_budget_minor / 100,
          maxTotalBudget: cap.max_total_budget_minor / 100, maxDays: cap.max_days
        },
        currency: cap.currency
      };
    });
  }
  // A company row of ads_businesses (0039: profile columns; the Meta ad account may be missing) in the UI shape.
  function liveCompany(b) {
    return { id: b.id, name: b.name, currency: b.currency || null, pageId: b.page_id || null, instagramId: b.instagram_id || null, timezone: b.timezone || null,
      accounts: b.ad_account_id ? [{ id: b.ad_account_id, name: b.name + ' (' + b.ad_account_id + ')' }] : [],
      about: b.about || '', goal: b.goal || '', channels: b.channels || [], tools: b.tools || [], workType: b.work_type || '',
      inbox: !!b.inbox_demo, createdAt: b.created_at || null };
  }
  // Calls an Edge Function. Always resolves with the parsed JSON body, also for
  // error statuses ({ ok:false, error:{ code, message } }); rejects only when offline.
  function callFn(name, body) {
    if (!client) return Promise.reject(new Error('no client'));
    // Wrapped, so that even an error thrown at once becomes a rejection the screens can show.
    return Promise.resolve().then(function () { return client.functions.invoke(name, { body: body }); }).then(function (r) {
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
    var names = ['settings', 'products', 'images', 'insights', 'campaigns', 'posts', 'audit', 'workspace', 'goals-inbox'];
    ready = Promise.all(names.map(fetchJson)).then(function (d) {
      fixed = { settings: d[0], products: d[1], images: d[2], insights: d[3], workspace: d[7], extra: d[8] };
      var stored = lsGet();
      if (stored && stored.campaigns && stored.posts && stored.audit) {
        state = stored;
        if (!state.stock) state.stock = []; // demo states saved before 6 Nov 2026
        state.posts.forEach(normPost);      // ... and posts saved with one product / one picture
        if (!state.ws) { state.ws = seedWorkspace(d[7]); save(); } // ... and before the companies (11 Nov 2026)
        if (!state.ws.goals || !state.ws.inbox) { fillWorkspace(state.ws); save(); } // ... and before goals / messaging (13 Nov 2026)
      } else {
        state = { campaigns: seedCampaigns(d[4]), posts: seedPosts(d[5]), audit: seedAudit(d[6]), stock: [], ws: fillWorkspace(seedWorkspace(d[7])) };
        save();
      }
    });
    return ready;
  }
  // Posts hold lists since 6 Nov 2026: productId / imageId (old demo state, mock/posts.json)
  // become productIds / imageIds ([x] or []).
  function normPost(p) {
    if (!Array.isArray(p.productIds)) p.productIds = p.productId ? [p.productId] : [];
    if (!Array.isArray(p.imageIds)) p.imageIds = p.imageId ? [p.imageId] : [];
    delete p.productId; delete p.imageId;
    return p;
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
      return normPost(p);
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
  // Edit a campaign that is not running (ADS-19, 7 Nov 2026). changes: any of { name, dailyBudget,
  // days, startDate }; anything else (ad account, goal ...) stays. Checked again here, against the
  // limits the UI shows (live: the owner's caps, incl. the total); a refusal carries an i18n key
  // (e.key, e.vars). A start date that is not changed may lie in the past (the campaign ran before it
  // was paused); a new one must be today or later. Mock path in both modes: campaigns are sample data.
  // Resolves with the campaign (as getCampaign). A save with changes logs one campaign.edit entry
  // listing old -> new for every changed field; a save without changes logs nothing.
  function updateCampaign(id, changes) {
    var d = changes || {};
    return init().then(function () {
      settleReviews();
      var c = state.campaigns.filter(function (x) { return x.id === id; })[0];
      if (!c) throw codeError('ced.err.gone');
      if (c.status !== 'draft' && c.status !== 'paused') throw codeError('ced.err.status');
      var L = limitsNow || fixed.settings.limits;
      var n = {
        name: d.name === undefined ? c.name : String(d.name == null ? '' : d.name).trim(),
        dailyBudget: d.dailyBudget === undefined ? c.dailyBudget : Number(d.dailyBudget),
        days: d.days === undefined ? c.days : Number(d.days),
        startDate: d.startDate === undefined ? c.startDate : String(d.startDate == null ? '' : d.startDate)
      };
      if (!n.name) throw codeError('err.name');
      if (n.name.length > CAMP_NAME_MAX) throw codeError('ced.err.nameLong', { max: CAMP_NAME_MAX });
      if (!(n.dailyBudget >= L.minDailyBudget && n.dailyBudget <= L.maxDailyBudget)) throw codeError('ced.err.daily', { min: L.minDailyBudget, max: L.maxDailyBudget });
      if (!(n.days >= 1 && n.days <= L.maxDays && n.days % 1 === 0)) throw codeError('ced.err.days', { max: L.maxDays });
      if (L.maxTotalBudget != null && total(n) > L.maxTotalBudget + 1e-9) throw codeError('err.total', { total: L.maxTotalBudget });
      if (n.startDate !== c.startDate && !(isDayKey(n.startDate) && n.startDate >= dayKey(today()))) throw codeError('ced.err.start');
      var parts = [];
      if (n.name !== c.name) parts.push('name: "' + c.name + '" -> "' + n.name + '"');
      if (n.dailyBudget !== c.dailyBudget) parts.push('daily budget: ' + c.dailyBudget + ' -> ' + n.dailyBudget);
      if (n.days !== c.days) parts.push('days: ' + c.days + ' -> ' + n.days);
      if (n.startDate !== c.startDate) parts.push('start date: ' + c.startDate + ' -> ' + n.startDate);
      if (!parts.length) return wait(c);
      if (total(n) !== total(c)) parts.push('total: ' + total(c) + ' -> ' + total(n));
      c.name = n.name; c.dailyBudget = n.dailyBudget; c.days = n.days; c.startDate = n.startDate;
      audit('campaign.edit', 'campaign', c.id, parts.join(' | ') + ' | (' + c.status + ')');
      // A changed campaign needs a new approval (Approvals board, 11 Nov 2026).
      if (state.ws && state.ws.approvals[c.id]) { delete state.ws.approvals[c.id]; audit('campaign.approval_reset', 'campaign', c.id, 'changed after approval'); }
      save();
      return wait(c);
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
  // Ids without blanks and repeats, in the given order.
  function idList(v) {
    var out = [];
    (Array.isArray(v) ? v : []).forEach(function (x) { x = x == null ? '' : String(x); if (x && out.indexOf(x) === -1) out.push(x); });
    return out;
  }
  // Create or update a post. Only drafts can be edited.
  // d: { id?, business, caption, productIds: [] (max 6), imageIds: [] (max 10, order = order in the post) }
  function savePost(d, via) {
    return init().then(function () {
      var prods = idList(d.productIds), imgs = idList(d.imageIds);
      if (prods.length > POST_MAX_PRODUCTS) throw codeError('pp.max', { max: POST_MAX_PRODUCTS });
      if (imgs.length > POST_MAX_IMAGES) throw codeError('pp.img.max', { max: POST_MAX_IMAGES });
      var p = d.id ? state.posts.filter(function (x) { return x.id === d.id; })[0] : null;
      if (p) {
        if (p.status !== 'draft') throw new Error('only drafts can be edited');
        p.productIds = prods; p.caption = d.caption; p.imageIds = imgs; p.goalId = d.goalId || null;
        audit('post.saved', 'post', p.id, 'draft updated | ' + prods.length + ' product(s), ' + imgs.length + ' picture(s)');
      } else {
        p = { id: newId('post'), business: d.business, status: 'draft', productIds: prods, caption: d.caption, imageIds: imgs, goalId: d.goalId || null };
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

  /* ---- workspace: companies, team, brands, approvals (11 Nov 2026, plan ADS-32...36) ----
     The owner's "company entities": an agency's workspace holds several unrelated companies, each with
     its own settings. SAMPLE MODE ONLY for now: kept in the demo state (state.ws, localStorage) in both
     modes until the database update (ADS-37, plan workstreams\ads-companies-plan-2026-11-11.md).
     Live mode reads the companies from ads_businesses; adding / editing them, the team and brands
     answer with the key co.err.live there (brands: see listBrands). */
  var CHANNELS = ['facebook', 'instagram', 'messenger', 'whatsapp', 'youtube', 'tiktok', 'linkedin', 'x', 'threads', 'pinterest', 'telegram', 'gbp'];
  var WORK_TOOLS = ['monday', 'clickup', 'notion', 'trello', 'asana', 'slack', 'drive'];
  var WORK_TYPES = ['content', 'social', 'both'];
  var ROLES = ['viewer', 'approver', 'admin'];
  var CO_TEXT_MAX = 1000, BRAND_TEXT_MAX = 2000, BRAND_COLORS_MAX = 10, FEEDBACK_MAX = 1000;
  function only(list, allowed) { return idList(list).filter(function (x) { return allowed.indexOf(x) !== -1; }); }
  function textOf(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
  // One shape for every company, sample or live: { id, name, about, goal, channels, tools, workType,
  // inbox, accounts: [{ id, name }], currency, pageId, createdAt }.
  function companyItem(c) {
    return { id: c.id, name: c.name, about: c.about || '', goal: c.goal || '', channels: only(c.channels, CHANNELS),
      tools: only(c.tools, WORK_TOOLS), workType: WORK_TYPES.indexOf(c.workType) !== -1 ? c.workType : '', inbox: !!c.inbox,
      accounts: Array.isArray(c.accounts) ? c.accounts : [], currency: c.currency || null, pageId: c.pageId || null, createdAt: c.createdAt || null };
  }
  function seedWorkspace(w) {
    w = w || {};
    var now = Date.now();
    return {
      companies: fixed.settings.businesses.map(function (b) {
        return companyItem(Object.assign({ id: b.id, name: b.name, accounts: b.accounts }, (w.profiles || {})[b.id] || {}));
      }),
      skipped: false,
      members: (w.members || []).map(function (m) {
        return { id: m.id, email: m.email, role: m.role, companies: idList(m.companies), status: m.status, addedAt: new Date(now - (m.addedDaysAgo || 0) * 86400000).toISOString() };
      }),
      brands: (w.brands || []).map(function (b) {
        var x = Object.assign({}, b);
        x.feedback = (b.feedback || []).map(function (f) { return { id: f.id, ts: new Date(now - (f.daysAgo || 0) * 86400000).toISOString(), user: f.user, right: f.right || '', wrong: f.wrong || '' }; });
        x.updatedAt = new Date(now - 86400000).toISOString();
        x.sample = true; // sample brands stay out of live mode (the live Edelweiss is a real company)
        return x;
      }),
      approvals: {} // campaign id -> { state: 'approved' | 'sent_back', by, at, note }
    };
  }
  function companyById(id) { return state.ws.companies.filter(function (c) { return c.id === id; })[0] || null; }
  function sampleOnly() { return isLive() ? Promise.reject(codeError('co.err.live')) : null; }

  // Create (no id) or update a company. d: { id?, name, about, goal, channels, tools, workType, inbox }.
  function saveCompany(d) {
    d = d || {};
    if (isLive()) {
      return init().then(function () {
        return client.rpc('ads_save_company', { p_id: d.id || null, p_name: d.name || '', p_about: d.about || '', p_goal: d.goal || '',
          p_channels: only(d.channels, CHANNELS), p_tools: only(d.tools, WORK_TOOLS), p_work_type: d.workType || null, p_inbox: !!d.inbox });
      }).then(function (r) {
        if (r.error) throw rpcError(r.error, { name: textOf(d.name, 80) });
        var c = r.data;
        return companyItem(liveCompany({ id: c.id, name: c.name, about: c.about, goal: c.goal, channels: c.channels, tools: c.tools,
          work_type: c.work_type, inbox_demo: c.inbox_demo, ad_account_id: c.ad_account_id, currency: c.currency, page_id: c.page_id, created_at: c.created_at }));
      });
    }
    return init().then(function () {
      var name = textOf(d.name, 80).replace(/\s+/g, ' ');
      if (!name) throw codeError('co.err.name');
      var same = state.ws.companies.filter(function (c) { return c.id !== d.id && c.name.toLowerCase() === name.toLowerCase(); });
      if (same.length) throw codeError('co.err.taken', { name: name });
      var fields = { name: name, about: textOf(d.about, CO_TEXT_MAX), goal: textOf(d.goal, CO_TEXT_MAX), channels: only(d.channels, CHANNELS),
        tools: only(d.tools, WORK_TOOLS), workType: WORK_TYPES.indexOf(d.workType) !== -1 ? d.workType : '', inbox: !!d.inbox };
      var c = d.id ? companyById(d.id) : null;
      if (d.id && !c) throw codeError('co.err.gone');
      if (c) {
        Object.assign(c, fields);
        audit('company.updated', 'company', c.id, name);
      } else {
        // New ids never reuse a sample id, so old sample campaigns never reappear under a new company.
        c = companyItem(Object.assign({ id: newId('co'), accounts: [], createdAt: new Date().toISOString() }, fields));
        state.ws.companies.push(c);
        audit('company.created', 'company', c.id, name);
      }
      save();
      return wait(c);
    });
  }
  // First visit: "Skip for now" is remembered (the window does not come back by itself).
  function skipOnboarding() {
    return init().then(function () { state.ws.skipped = true; save(); return wait({ ok: true }); });
  }
  // Demo: the tool as a brand-new user sees it (no companies, no team, no brands, no stock).
  // "Reset demo data" brings the samples back.
  function startEmptyWorkspace() {
    return init().then(function () {
      state.ws.companies = []; state.ws.members = []; state.ws.brands = []; state.ws.approvals = {}; state.ws.skipped = false;
      state.stock = [];
      uploads.forEach(function (u) { try { URL.revokeObjectURL(u.url); } catch (e) { /* ignore */ } });
      uploads = [];
      audit('workspace.emptied', 'workspace', null, 'demo: start as a new user');
      save();
      return wait({ ok: true });
    });
  }

  // Team. The signed-in person is the workspace's Admin (creator). A member: { id, email, role
  // (viewer | approver | admin), companies: [] = internal (every company) or the chosen ids,
  // status (invited | active), addedAt, me }.
  function listMembers() {
    return init().then(function () {
      if (isLive()) {
        return client.rpc('ads_team').then(function (r) {
          if (r.error) throw rpcError(r.error);
          var t = r.data || {};
          return (t.members || []).map(function (m) {
            return { id: m.user_id, email: m.email || '', role: m.role, companies: m.all_companies ? [] : (m.companies || []), status: 'active', addedAt: m.added_at, me: !!m.me };
          }).concat((t.invites || []).map(function (i) {
            return { id: 'inv:' + i.id, email: i.email, role: i.role, companies: i.companies || [], status: 'invited', addedAt: i.invited_at, me: false };
          }));
        });
      }
      var me = { id: 'me', email: actor, role: 'admin', companies: [], status: 'active', addedAt: null, me: true };
      return wait([me].concat(state.ws.members));
    });
  }
  // Database answers (0039) as i18n keys the screens show. vars: extra text for the message.
  function rpcError(e, vars) {
    var m = String((e && e.message) || ''), k = null;
    if (/bad_email/.test(m)) k = 'team.err.email';
    else if (/bad_role/.test(m)) k = 'team.err.role';
    else if (/already_member/.test(m)) k = 'team.err.exists';
    else if (/last_admin/.test(m)) k = 'team.err.lastAdmin';
    else if (/unknown company/.test(m)) k = 'co.err.gone';
    else if (/unknown (member|invitation)/.test(m)) k = 'team.err.gone';
    else if (/name_required/.test(m)) k = 'co.err.name';
    else if (/name_taken/.test(m)) k = 'co.err.taken';
    else if (/not allowed/.test(m) || (e && e.code === '42501')) k = 'team.err.notAllowed';
    return k ? codeError(k, vars || {}) : new Error(m || 'request failed');
  }
  function liveRpc(name, args, vars) {
    return init().then(function () { return client.rpc(name, args); }).then(function (r) {
      if (r.error) throw rpcError(r.error, vars);
      return r.data;
    });
  }
  function checkMember(d, selfId) {
    var role = ROLES.indexOf(d.role) !== -1 ? d.role : null;
    if (!role) throw codeError('team.err.role');
    var cos = idList(d.companies);
    if (cos.some(function (id) { return !companyById(id); })) throw codeError('co.err.gone');
    return { role: role, companies: cos };
  }
  function inviteMember(d) {
    d = d || {};
    if (isLive()) {
      var em = textOf(d.email, 200).toLowerCase();
      return liveRpc('ads_invite', { p_email: em, p_role: d.role, p_companies: idList(d.companies) }, { email: em })
        .then(function (id) { return { id: 'inv:' + id, email: em, role: d.role, companies: idList(d.companies), status: 'invited' }; });
    }
    return init().then(function () {
      var email = textOf(d.email, 200).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw codeError('team.err.email');
      if (email === String(actor).toLowerCase() || state.ws.members.some(function (m) { return m.email === email; })) throw codeError('team.err.exists', { email: email });
      var v = checkMember(d);
      var m = { id: newId('m'), email: email, role: v.role, companies: v.companies, status: 'invited', addedAt: new Date().toISOString() };
      state.ws.members.push(m);
      audit('member.invited', 'member', m.id, email + ' | ' + v.role + ' | ' + (v.companies.length ? v.companies.join(', ') : 'all companies') + ' | (SAMPLE: no e-mail was sent)');
      save();
      return wait(m);
    });
  }
  function updateMember(id, d) {
    d = d || {};
    if (isLive()) {
      // An open invitation is changed by inviting the same e-mail again (the database replaces it).
      if (String(id).indexOf('inv:') === 0) return inviteMember(d);
      return liveRpc('ads_member_set', { p_user: id, p_role: d.role, p_companies: idList(d.companies) })
        .then(function () { return { id: id, email: d.email, role: d.role, companies: idList(d.companies) }; });
    }
    return init().then(function () {
      var m = state.ws.members.filter(function (x) { return x.id === id; })[0];
      if (!m) throw codeError('team.err.gone');
      var v = checkMember(d || {});
      m.role = v.role; m.companies = v.companies;
      audit('member.changed', 'member', m.id, m.email + ' | ' + v.role + ' | ' + (v.companies.length ? v.companies.join(', ') : 'all companies'));
      save();
      return wait(m);
    });
  }
  function removeMember(id) {
    if (isLive()) {
      return String(id).indexOf('inv:') === 0
        ? liveRpc('ads_invite_cancel', { p_id: String(id).slice(4) }).then(function () { return { ok: true }; })
        : liveRpc('ads_member_remove', { p_user: id }).then(function () { return { ok: true }; });
    }
    return init().then(function () {
      var i = state.ws.members.findIndex(function (x) { return x.id === id; });
      if (i === -1) throw codeError('team.err.gone');
      var m = state.ws.members.splice(i, 1)[0];
      audit('member.removed', 'member', m.id, m.email);
      save();
      return wait({ ok: true });
    });
  }

  // The signed-in person's role here: live from ads_my_access() (0039), sample mode = Admin of everything.
  // Resolves with { role, allCompanies, companies } (or null when live and not a member).
  function myAccess() {
    return init().then(function () {
      if (!isLive()) return { role: 'admin', allCompanies: true, companies: [] };
      return client.rpc('ads_my_access').then(function (r) {
        var a = r && !r.error && Array.isArray(r.data) ? r.data[0] : null;
        return a ? { role: a.role, allCompanies: !!a.all_companies, companies: a.companies || [] } : null;
      });
    });
  }
  // Invitations for the signed-in e-mail become memberships (0039). Never blocks the start.
  function acceptInvites() {
    if (!client) return Promise.resolve(0);
    return client.rpc('ads_accept_invites').then(function (r) { return r && !r.error ? r.data : 0; }, function () { return 0; });
  }

  // Post goals (13 Nov 2026, owner: D1 Sell, D2 Stock replenishment ...). The goal's description tells
  // the AI what the post is for; until the AI text exists (ADS-08) the goal's Georgian template fills
  // a draft. Kept in the demo state in BOTH modes until the database update; the screens say so.
  // Goal: { id ('D1'), name, name_ka, description, template_ka }.
  var GOAL_TEXT_MAX = 600;
  function fillWorkspace(ws) {
    var x = fixed.extra || {};
    if (!ws.goals) ws.goals = (x.goals || []).map(function (g) { return Object.assign({}, g); });
    if (!ws.inbox) {
      var now = Date.now();
      ws.inbox = (x.conversations || []).map(function (c) {
        return { id: c.id, business: c.business, channel: c.channel, name: c.name, status: c.status, unread: c.unread || 0, sample: true,
          at: new Date(now - (c.minutesAgo || 0) * 60000).toISOString(),
          messages: (c.messages || []).map(function (m) { return { from: m.from, text: m.text, at: new Date(now - (m.minutesAgo || 0) * 60000).toISOString() }; }) };
      });
    }
    return ws;
  }
  function listGoals() { return init().then(function () { return wait(state.ws.goals); }); }
  function saveGoal(d) {
    d = d || {};
    return init().then(function () {
      var name = textOf(d.name, 60).replace(/\s+/g, ' ');
      if (!name) throw codeError('goal.err.name');
      var fields = { name: name, name_ka: textOf(d.name_ka, 60), description: textOf(d.description, GOAL_TEXT_MAX), template_ka: textOf(d.template_ka, GOAL_TEXT_MAX) };
      if (!fields.description) throw codeError('goal.err.description');
      var g = d.id ? state.ws.goals.filter(function (x) { return x.id === d.id; })[0] : null;
      if (d.id && !g) throw codeError('goal.err.gone');
      if (g) { Object.assign(g, fields); audit('goal.updated', 'goal', g.id, name); }
      else {
        var n = 1;
        while (state.ws.goals.some(function (x) { return x.id === 'D' + n; })) n++;
        g = Object.assign({ id: 'D' + n }, fields);
        state.ws.goals.push(g);
        audit('goal.created', 'goal', g.id, name);
      }
      save();
      return wait(g);
    });
  }
  function deleteGoal(id) {
    return init().then(function () {
      var i = state.ws.goals.findIndex(function (x) { return x.id === id; });
      if (i === -1) throw codeError('goal.err.gone');
      audit('goal.deleted', 'goal', id, state.ws.goals[i].name);
      state.ws.goals.splice(i, 1);
      save();
      return wait({ ok: true });
    });
  }

  // Messaging (13 Nov 2026): Facebook Messenger, Instagram and WhatsApp conversations of a company.
  // SAMPLE conversations only: nothing is connected or sent yet (plan: research notes 13 Nov). Live mode
  // has no conversations until the channels are connected. Conversation: { id, business, channel
  // ('messenger' | 'instagram' | 'whatsapp'), name, status ('open' | 'done'), unread, at, messages: [{ from
  // ('them' | 'us'), text, at }] }.
  var MSG_MAX = 1000;
  function listConversations(b) {
    return init().then(function () {
      if (isLive()) return wait([]);
      return wait(state.ws.inbox.filter(function (c) { return !b || c.business === b; })
        .sort(function (x, y) { return Date.parse(y.at) - Date.parse(x.at); }));
    });
  }
  function convById(id) { return state.ws.inbox.filter(function (c) { return c.id === id; })[0] || null; }
  // Opening a conversation marks it read.
  function openConversation(id) {
    return init().then(function () {
      var c = convById(id); if (!c) throw codeError('msg.err.gone');
      if (c.unread) { c.unread = 0; save(); }
      return wait(c);
    });
  }
  function replyConversation(id, text) {
    var stop = sampleOnly(); if (stop) return stop;
    return init().then(function () {
      var c = convById(id); if (!c) throw codeError('msg.err.gone');
      var body = textOf(text, MSG_MAX);
      if (!body) throw codeError('msg.err.empty');
      var m = { from: 'us', text: body, at: new Date().toISOString(), sample: true };
      c.messages.push(m); c.at = m.at;
      audit('message.reply', 'conversation', c.id, c.channel + ' | ' + body.slice(0, 60) + ' | (SAMPLE: nothing was sent)');
      save();
      return wait(m);
    });
  }
  function setConversationStatus(id, status) {
    return init().then(function () {
      var c = convById(id); if (!c) throw codeError('msg.err.gone');
      c.status = status === 'done' ? 'done' : 'open';
      save();
      return wait(c);
    });
  }

  // Keys (13 Nov 2026, SQL 0043 + server function ads-connections): AI tools once for the agency (owner
  // D-64), Meta per company (D-46 / D-66). The browser never gets a key back: only the last 4 characters,
  // the status and what the test found. Live only. Row: { id, business_id (null = agency), provider,
  // secret_hint, info, status ('ok' | 'error'), status_message, checked_at }.
  function listConnections() {
    if (!isLive()) return Promise.resolve([]);
    return init().then(function () {
      return client.from('ads_connections').select('id,business_id,provider,secret_hint,info,status,status_message,checked_at,updated_at');
    }).then(function (r) {
      if (r.error) { var e = new Error(r.error.message || 'read failed'); e.key = 'key.err.db'; throw e; }
      return r.data || [];
    });
  }
  function connCall(body) {
    return callFn('ads-connections', body).then(function (r) {
      if (r && r.ok) return r;
      var e = new Error((r && r.error && r.error.message) || '');
      e.code = (r && r.error && r.error.code) || 'server';
      throw e;
    });
  }
  function saveConnection(provider, business, secret) { return connCall({ action: 'save', provider: provider, business_id: business || null, secret: secret }); }
  function testConnection(id) { return connCall({ action: 'test', id: id }); }
  function removeConnection(id) { return connCall({ action: 'remove', id: id }); }
  // The company's Facebook Page, Instagram account, ad account, currency, time zone (picked from the Meta test).
  function setCompanyMeta(b, m) {
    m = m || {};
    return liveRpc('ads_set_company_meta', { p_business: b, p_page_id: m.pageId || null, p_instagram_id: m.instagramId || null,
      p_ad_account_id: m.adAccountId || null, p_currency: m.currency || null, p_timezone: m.timezone || null });
  }

  // Audit log (13 Nov 2026): who did what, when. Live: table ads_audit (0020; 0039 rules: internal Admins see
  // their agency, everyone else their own rows). Sample mode: the demo state's list. Newest first, at most 300.
  // Row: { at, who, action, entity, entityId, ok, dryRun, payload }.
  function listAuditLog() {
    return init().then(function () {
      if (!isLive()) {
        return wait(state.audit.slice(0, 300).map(function (a) {
          return { at: a.ts, who: a.user, action: a.action, entity: a.entityType, entityId: a.entityId, ok: true, dryRun: false, payload: a.detail ? { detail: a.detail } : {} };
        }));
      }
      return client.from('ads_audit').select('id,at,actor_email,action,entity,entity_id,ok,dry_run,payload')
        .order('at', { ascending: false }).range(0, 299).then(function (r) {
          if (r.error) throw new Error(r.error.message || 'read failed');
          return (r.data || []).map(function (a) {
            return { at: a.at, who: a.actor_email || '', action: a.action, entity: a.entity || '', entityId: a.entity_id || '', ok: a.ok !== false, dryRun: !!a.dry_run, payload: a.payload || {} };
          });
        });
    });
  }

  // Brands (a company can have several). Kept in the demo state in BOTH modes until ADS-37, so the
  // owner can try them with the real company names; the page says so. b: a company id, or none = all.
  // Brand: { id, business, name, about, look, elements, feel, voice, colors: ['#RRGGBB'], feedback:
  // [{ id, ts, user, right, wrong }] newest first, updatedAt }.
  function listBrands(b) {
    return init().then(function () {
      return wait(state.ws.brands.filter(function (x) { return (!b || x.business === b) && !(x.sample && isLive()); }));
    });
  }
  function saveBrand(d) {
    d = d || {};
    return init().then(function () {
      var name = textOf(d.name, 80).replace(/\s+/g, ' ');
      if (!name) throw codeError('br.err.name');
      if (!d.business) throw codeError('br.err.company');
      var colors = idList((d.colors || []).map(function (c) { return String(c || '').trim().toUpperCase(); }))
        .filter(function (c) { return /^#[0-9A-F]{6}$/.test(c); }).slice(0, BRAND_COLORS_MAX);
      var fields = { business: d.business, name: name, about: textOf(d.about, BRAND_TEXT_MAX), look: textOf(d.look, BRAND_TEXT_MAX),
        elements: textOf(d.elements, BRAND_TEXT_MAX), feel: textOf(d.feel, BRAND_TEXT_MAX), voice: textOf(d.voice, BRAND_TEXT_MAX),
        colors: colors, updatedAt: new Date().toISOString() };
      var x = d.id ? state.ws.brands.filter(function (y) { return y.id === d.id; })[0] : null;
      if (d.id && !x) throw codeError('br.err.gone');
      if (x) { Object.assign(x, fields); audit('brand.updated', 'brand', x.id, name); }
      else { x = Object.assign({ id: newId('br'), feedback: [] }, fields); state.ws.brands.unshift(x); audit('brand.created', 'brand', x.id, name); }
      save();
      return wait(x);
    });
  }
  function deleteBrand(id) {
    return init().then(function () {
      var i = state.ws.brands.findIndex(function (x) { return x.id === id; });
      if (i === -1) throw codeError('br.err.gone');
      audit('brand.deleted', 'brand', id, state.ws.brands[i].name);
      state.ws.brands.splice(i, 1);
      save();
      return wait({ ok: true });
    });
  }
  // What felt right / wrong about a sample picture: kept on the brand, newest first.
  function addBrandFeedback(id, f) {
    f = f || {};
    return init().then(function () {
      var x = state.ws.brands.filter(function (y) { return y.id === id; })[0];
      if (!x) throw codeError('br.err.gone');
      var right = textOf(f.right, FEEDBACK_MAX), wrong = textOf(f.wrong, FEEDBACK_MAX);
      if (!right && !wrong) throw codeError('br.err.feedback');
      var item = { id: newId('bf'), ts: new Date().toISOString(), user: actor, right: right, wrong: wrong };
      x.feedback.unshift(item);
      audit('brand.feedback', 'brand', x.id, (right ? 'right: ' + right.slice(0, 60) : '') + (wrong ? ' | wrong: ' + wrong.slice(0, 60) : ''));
      save();
      return wait(item);
    });
  }

  // Approvals board: posts and campaigns of one company (or all) in three columns.
  // Posts: needs_approval = waiting, approved = approved, scheduled / published = running.
  // Campaigns: approval comes before switching on (spending): paused without approval = waiting,
  // paused + approved = approved, in Meta review / active = running.
  // Item: { kind, id, business, status, name, caption, imageIds, productIds, dailyBudget, days, when, approval }
  function listApprovals(f) {
    f = f || {};
    return init().then(function () {
      settleReviews();
      var out = { waiting: [], approved: [], running: [] };
      function mine(x) { return !f.business || x.business === f.business; }
      if (f.kind !== 'campaign') {
        state.posts.filter(mine).forEach(function (p) {
          var col = p.status === 'needs_approval' ? 'waiting' : p.status === 'approved' ? 'approved' : p.status === 'scheduled' || p.status === 'published' ? 'running' : null;
          if (col) out[col].push({ kind: 'post', id: p.id, business: p.business, status: p.status, caption: p.caption || '', imageIds: p.imageIds || [], productIds: p.productIds || [],
            when: p.publishedAt || p.scheduledAt || null, note: p.sentBackNote || '' });
        });
      }
      if (f.kind !== 'post') {
        state.campaigns.filter(mine).forEach(function (c) {
          var a = state.ws.approvals[c.id] || null;
          var col = c.status === 'paused' ? (a && a.state === 'approved' ? 'approved' : a && a.state === 'sent_back' ? null : 'waiting')
            : c.status === 'active' || c.status === 'in_review' ? 'running' : null;
          if (col) out[col].push({ kind: 'campaign', id: c.id, business: c.business, status: c.status, name: c.name, caption: c.caption || '', imageIds: c.imageIds || [],
            dailyBudget: c.dailyBudget, days: c.days, when: c.startDate || null, approval: a });
        });
      }
      return wait(out);
    });
  }
  function approveItem(kind, id) {
    if (kind === 'post') return movePost(id, 'approved');
    return init().then(function () {
      var c = state.campaigns.filter(function (x) { return x.id === id; })[0];
      if (!c) throw codeError('ap.err.gone');
      if (c.status !== 'paused') throw codeError('ap.err.status');
      state.ws.approvals[c.id] = { state: 'approved', by: actor, at: new Date().toISOString(), note: '' };
      audit('campaign.approved', 'campaign', c.id, c.name);
      save();
      return wait(c);
    });
  }
  // Back to the maker with a note (optional for posts, which go back to draft).
  function sendBack(kind, id, note) {
    note = textOf(note, FEEDBACK_MAX);
    if (kind === 'post') {
      return movePost(id, 'draft').then(function (p) {
        var x = state.posts.filter(function (y) { return y.id === id; })[0];
        if (x) { x.sentBackNote = note; if (note) audit('post.sent_back', 'post', id, note); save(); }
        return p;
      });
    }
    return init().then(function () {
      var c = state.campaigns.filter(function (x) { return x.id === id; })[0];
      if (!c) throw codeError('ap.err.gone');
      state.ws.approvals[c.id] = { state: 'sent_back', by: actor, at: new Date().toISOString(), note: note };
      audit('campaign.sent_back', 'campaign', c.id, note || '(no note)');
      save();
      return wait(c);
    });
  }

  /* ---- fixed lists ---- */
  function getSettings() {
    return init().then(function () {
      if (!isLive()) {
        limitsNow = fixed.settings.limits;
        var m = clone(fixed.settings);
        m.businesses = state.ws.companies.map(companyItem); // the sample workspace's companies (11 Nov 2026)
        m.onboarding = { skipped: !!state.ws.skipped };
        return wait(m);
      }
      return loadLive().then(function (live) {
        var s = clone(fixed.settings); // locations, forbidden words, caption limit stay from the mock file
        s.live = true; s.businesses = live.businesses.map(companyItem); s.currency = live.currency;
        s.onboarding = { skipped: true }; // live companies are made in the database until ADS-37
        Object.keys(live.limits).forEach(function (k) { s.limits[k] = live.limits[k]; });
        limitsNow = clone(s.limits); // updateCampaign checks against the same caps the UI shows
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
  //   width, height, createdAt, sample, and since 9 Nov 2026 (0033): folder ('uploads' | 'elements' |
  //   'ai' | 'products'), elementType ('price_tag' | 'frame' | 'background' | null; elements only),
  //   source ('upload' | 'ai'), tags ([] of lower-case words), archivedAt (ISO time or null: in the
  //   Archive, deleted for good ARCHIVE_DAYS later) }. The kind follows the folder. Sample images have
  //   no url: app.js draws them.
  var IMG_COLS = 'id,business_id,kind,title,path,mime,bytes,width,height,created_at,folder,element_type,source,tags,archived_at';
  function sampleImages(b) {
    return fixed.images.filter(function (p) { return !b || p.business === b; })
      .map(function (p) { return Object.assign({}, p, { kind: 'picture', sample: true, folder: 'uploads', elementType: null, source: 'upload', tags: [], archivedAt: null }); });
  }
  // d: folder / source for a row without the 0033 columns (the AI function's reply carries none).
  function liveImage(r, url, d) {
    d = d || {};
    var folder = IMG_FOLDERS.indexOf(r.folder) !== -1 ? r.folder : d.folder || (r.kind === 'element' ? 'elements' : 'uploads');
    return { id: r.id, business: r.business_id, kind: folder === 'elements' ? 'element' : 'picture', title: r.title, title_en: r.title, title_ka: r.title, url: url,
      mime: r.mime, bytes: r.bytes, width: r.width, height: r.height, createdAt: r.created_at, sample: false,
      folder: folder, elementType: folder === 'elements' && ELEMENT_TYPES.indexOf(r.element_type) !== -1 ? r.element_type : null,
      source: r.source === 'ai' || d.source === 'ai' ? 'ai' : 'upload', tags: Array.isArray(r.tags) ? r.tags.slice() : [], archivedAt: r.archived_at || null };
  }
  function liveImages(b) {
    if (!client) return Promise.reject(new Error('no client'));
    return purgeExpired().then(function () {
      return selectAll(function () {
        var q = client.from('ads_images').select(IMG_COLS);
        if (b) q = q.eq('business_id', b);
        return q.order('created_at', { ascending: false }).order('id', { ascending: true });
      });
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
  // The business's pictures (newest first), then the sample images. Archived pictures only with
  // opts.archived (the Library page; the start-up cache, so posts still show them): every picker
  // offers only pictures that are not archived.
  // opts.strict: a failed live read rejects (the Library page shows it). Without it the
  // pickers still get the samples, so a missing table never blocks the rest of the tool.
  function listImages(b, opts) {
    opts = opts || {};
    function keep(x) { return opts.archived || !x.archivedAt; }
    return init().then(function () {
      if (!isLive()) {
        purgeMock();
        return wait(uploads.filter(function (u) { return (!b || u.business === b) && keep(u); }).concat(sampleImages(b)));
      }
      return liveImages(b).catch(function (e) { if (opts.strict) throw e; return []; })
        .then(function (mine) { return mine.filter(keep).concat(sampleImages(b)); });
    });
  }
  // Archived pictures whose days are over: mock = this tab's uploads.
  function purgeMock() {
    var cut = Date.now() - ARCHIVE_DAYS * 86400000;
    uploads = uploads.filter(function (u) {
      if (!u.archivedAt || Date.parse(u.archivedAt) > cut) return true;
      try { URL.revokeObjectURL(u.url); } catch (e) { /* ignore */ }
      return false;
    });
  }
  // LIVE, at most every 10 minutes, never blocking the list: the server picks the pictures archived
  // more than ARCHIVE_DAYS ago (its own clock); their files go first, then the rows, so a failed file
  // removal leaves everything for the next try.
  var purgedAt = 0;
  function purgeExpired() {
    if (!client || Date.now() - purgedAt < 600000) return Promise.resolve();
    purgedAt = Date.now();
    return client.rpc('ads_images_expired').then(must).then(function (list) {
      list = Array.isArray(list) ? list : [];
      if (!list.length) return;
      return client.storage.from(IMG_BUCKET).remove(list.map(function (x) { return x.path; })).then(must).then(function () {
        var ids = list.map(function (x) { return x.id; });
        return client.from('ads_images').delete().in('id', ids).then(must).then(function () {
          auditLive('image.purge', 'image', null, { count: ids.length });
        });
      });
    }).catch(function () { /* tried again next time */ });
  }
  // Storage of the signed-in person in bytes: { used, limit }. Everything they stored counts, archived
  // pictures too until they are deleted. Mock: this tab's uploads against the default limit.
  function libraryUsage() {
    return init().then(function () {
      if (!isLive()) return wait({ used: mockUsed(), limit: LIB_MB * 1048576 });
      if (!client) throw new Error('no client');
      return client.rpc('ads_library_usage').then(must).then(function (r) {
        return { used: Number(r && r.used_bytes) || 0, limit: Number(r && r.limit_bytes) || LIB_MB * 1048576 };
      });
    });
  }
  function mockUsed() { return uploads.reduce(function (s, u) { return s + (u.bytes || 0); }, 0); }
  // The database refuses an upload over the limit (0033 trigger) -> i18n key.
  function storageErr(err) { return err && /storage_full/.test(String(err.message || '')) ? codeError('lf.err.full') : err; }
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
  // Where an upload goes. place: { folder, elementType, source } (0033), or the older 'picture' |
  // 'element' (= Uploads | Elements without a type).
  function placeOf(p) {
    if (p && typeof p === 'object') {
      var f = IMG_FOLDERS.indexOf(p.folder) !== -1 ? p.folder : 'uploads';
      return { folder: f, elementType: f === 'elements' && ELEMENT_TYPES.indexOf(p.elementType) !== -1 ? p.elementType : null, source: p.source === 'ai' ? 'ai' : 'upload' };
    }
    return { folder: p === 'element' ? 'elements' : 'uploads', elementType: null, source: 'upload' };
  }
  // Uploads one picture into a folder (see placeOf). opts.title (optional) replaces the file-name
  // title (product photos carry the product name). Resolves with the new library item.
  function uploadImage(b, file, place, opts) {
    return init().then(function () {
      var bad = checkImageFile(file);
      if (bad) throw codeError(bad.key, bad.vars);
      var pl = placeOf(place);
      var own = opts && opts.title ? String(opts.title).replace(/\s+/g, ' ').trim().slice(0, IMG_MAX_TITLE) : '';
      var mime = mimeOf(file), title = own || titleOf(file.name);
      return imageSize(file).then(function (dim) {
        if (isLive()) return uploadLive(b, file, pl, mime, title, dim);
        if (mockUsed() + file.size > LIB_MB * 1048576) throw codeError('lf.err.full');
        var im = { id: newId('img'), business: b, kind: pl.folder === 'elements' ? 'element' : 'picture', title: title, title_en: title, title_ka: title, url: URL.createObjectURL(file),
          mime: mime, bytes: file.size, width: dim.width, height: dim.height, createdAt: new Date().toISOString(), sample: false,
          folder: pl.folder, elementType: pl.elementType, source: pl.source, tags: [], archivedAt: null };
        uploads.unshift(im);
        audit('image.upload', 'image', im.id, title + ' | ' + pl.folder + (pl.elementType ? ' / ' + pl.elementType : '') + ' | ' + file.size + ' bytes | ' + dim.width + 'x' + dim.height + ' (MOCK: kept in this browser tab only)');
        save();
        return wait(im);
      });
    });
  }
  // LIVE: the file goes to the private bucket first (never overwriting), then the row. If the
  // row cannot be saved (also: storage full) the file is taken out again, so no orphan file stays.
  function uploadLive(b, file, pl, mime, title, dim) {
    if (!client) return Promise.reject(new Error('no client'));
    var path = b + '/' + newRequestId() + '.' + IMG_TYPES[mime];
    var bucket = client.storage.from(IMG_BUCKET);
    return bucket.upload(path, file, { contentType: mime, upsert: false, cacheControl: '3600' }).then(function (u) {
      must(u);
      return client.from('ads_images').insert({ business_id: b, kind: pl.folder === 'elements' ? 'element' : 'picture', title: title, path: path, mime: mime,
        bytes: file.size, width: dim.width, height: dim.height, folder: pl.folder, element_type: pl.elementType, source: pl.source })
        .select(IMG_COLS).single()
        .then(must)
        .catch(function (err) {
          err = storageErr(err);
          return bucket.remove([path]).then(function () { throw err; }, function () { throw err; });
        });
    }).then(function (row) {
      auditLive('image.upload', 'image', row.id, { business_id: b, title: title, folder: pl.folder, element_type: pl.elementType, bytes: file.size });
      return bucket.createSignedUrl(path, 3600).then(function (s) { return liveImage(row, (s.data && s.data.signedUrl) || ''); },
        function () { return liveImage(row, ''); }); // saved; the address comes with the next list
    });
  }
  function isSampleImage(id) { return fixed.images.some(function (x) { return x.id === id; }); }
  // A list in parts of n (the server takes a limited number of ids per call).
  function chunks(list, n) { var out = []; for (var i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; }
  // Deletes pictures for good: the rows first (that is what the tool shows), then their files, best
  // effort. Products and picture styles that used one lose it (the database clears the link).
  // Sample images are refused. Resolves { deleted }.
  function deleteImages(ids) {
    return init().then(function () {
      ids = idList(ids);
      if (!ids.length) return { deleted: 0 };
      if (ids.some(isSampleImage)) throw codeError('lib.err.sample');
      if (!isLive()) {
        var gone = uploads.filter(function (x) { return ids.indexOf(x.id) !== -1; });
        if (!gone.length) throw new Error('not found');
        uploads = uploads.filter(function (x) { return ids.indexOf(x.id) === -1; });
        gone.forEach(function (im) {
          try { URL.revokeObjectURL(im.url); } catch (e) { /* ignore */ }
          audit('image.delete', 'image', im.id, im.title + ' (MOCK)');
        });
        save();
        return wait({ deleted: gone.length });
      }
      if (!client) throw new Error('no client');
      var done = 0;
      return chunks(ids, 100).reduce(function (p, part) {
        return p.then(function () {
          return client.from('ads_images').delete().in('id', part).select('id,business_id,title,path').then(function (r) {
            var rows = must(r) || [];
            if (!rows.length) return;
            done += rows.length;
            auditLive('image.delete', 'image', rows.length === 1 ? rows[0].id : null,
              { business_id: rows[0].business_id, count: rows.length, titles: rows.slice(0, 20).map(function (x) { return x.title; }) });
            return client.storage.from(IMG_BUCKET).remove(rows.map(function (x) { return x.path; })).then(function () { /* ok */ }, function () { /* best effort */ });
          });
        });
      }, Promise.resolve()).then(function () {
        if (!done) throw new Error('not found');
        return { deleted: done };
      });
    });
  }
  function deleteImage(id) { return deleteImages([id]).then(function () { return { ok: true }; }); }
  // Archive (archive = true) or restore (false). An archived picture leaves its folder for the Archive
  // and is deleted for good ARCHIVE_DAYS later; restored, it is back in its folder. Resolves { changed }.
  function archiveImages(ids, archive) {
    return init().then(function () {
      ids = idList(ids);
      var on = !!archive;
      if (!ids.length) return { changed: 0 };
      if (ids.some(isSampleImage)) throw codeError('lib.err.sample');
      if (!isLive()) {
        var n = 0, now = new Date().toISOString();
        uploads.forEach(function (u) {
          if (ids.indexOf(u.id) === -1 || !!u.archivedAt === on) return;
          u.archivedAt = on ? now : null; n++;
          audit(on ? 'image.archive' : 'image.restore', 'image', u.id, u.title + ' (MOCK)');
        });
        save();
        return wait({ changed: n });
      }
      if (!client) throw new Error('no client');
      var changed = 0;
      return chunks(ids, 200).reduce(function (p, part) {
        return p.then(function () {
          return client.rpc('ads_images_archive', { p_ids: part, p_archive: on }).then(must).then(function (c) { changed += Number(c) || 0; });
        });
      }, Promise.resolve()).then(function () { return { changed: changed }; });
    });
  }
  // Tags: trimmed, single spaces, lower case, at most TAG_LEN characters, no repeats, at most TAG_MAX
  // per picture (the database applies the same rule).
  function cleanTags(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (x) {
      var s = String(x == null ? '' : x).replace(/\s+/g, ' ').trim().toLowerCase().slice(0, TAG_LEN).trim();
      if (s && out.indexOf(s) === -1 && out.length < TAG_MAX) out.push(s);
    });
    return out;
  }
  // Replaces one picture's tags. Resolves with the saved list.
  function setImageTags(id, tags) {
    return init().then(function () {
      if (isSampleImage(id)) throw codeError('lib.err.sample');
      var clean = cleanTags(tags);
      if (!isLive()) {
        var u = uploads.filter(function (x) { return x.id === id; })[0];
        if (!u) throw new Error('not found');
        u.tags = clean.slice();
        audit('image.tags', 'image', id, (clean.join(', ') || '-') + ' (MOCK)');
        save();
        return wait(clean);
      }
      if (!client) throw new Error('no client');
      return client.rpc('ads_image_set_tags', { p_id: id, p_tags: clean }).then(must).then(function (saved) { return Array.isArray(saved) ? saved : clean; });
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
    if (!isLive()) return Promise.reject(codeError('aimg.err.mock'));
    return callFn('ads-generate-image', { business_id: b, check: true }).then(fnResult);
  }
  // Is a picture maker's key accepted (maker: 'gemini' default, or 'openai')? { model } (a free call, nothing is made).
  function aiTest(b, maker) {
    if (!isLive()) return Promise.reject(codeError('aimg.err.mock'));
    return callFn('ads-generate-image', { business_id: b, test: true, provider: maker || 'gemini' }).then(fnResult);
  }
  // Makes one picture and saves it in the library. o: { prompt, aspect, quality, refs: [library image ids],
  // maker ('gemini' or 'openai', owner D-68 — the server's default is Gemini), title (optional library title) }.
  // Resolves { image (library item), remaining, limit }.
  function generateImage(b, o) {
    if (!isLive()) return Promise.reject(codeError('aimg.err.mock'));
    return callFn('ads-generate-image', { business_id: b, provider: o.maker || 'gemini', prompt: o.prompt, aspect_ratio: o.aspect, quality: o.quality, reference_ids: o.refs || [], title: o.title || undefined })
      .then(fnResult).then(function (r) {
        return { image: liveImage(r.image, r.image.url || '', { folder: 'ai', source: 'ai' }), remaining: r.remaining, limit: r.limit };
      });
  }

  /* ---- products and stock ---- */
  // Item: { id, business, name, name_en, name_ka (= name), quantity, price (sell price in GEL,
  //   or null), updatedAt, sample, and the details (0029): imageId (library picture or null),
  //   displayName (Georgian name on pictures and in posts; '' = the stock name), nameEn (English
  //   name for the picture AI), aiNote (short English description for the picture AI) }.
  // Sample products have no quantity and no details.
  function sampleProducts(b) {
    return fixed.products.filter(function (p) { return !b || p.business === b; })
      .map(function (p) {
        return Object.assign({}, p, { name: p.name_en, quantity: null, updatedAt: null, sample: true, imageId: null, displayName: '', nameEn: '', aiNote: '' });
      });
  }
  // s: { id, business, name, quantity, price, updatedAt, imageId, displayName, nameEn, aiNote }
  function stockItem(s) {
    return { id: s.id, business: s.business, name: s.name, name_en: s.name, name_ka: s.name, quantity: s.quantity, price: s.price, updatedAt: s.updatedAt,
      sample: false, imageId: s.imageId || null, displayName: s.displayName || '', nameEn: s.nameEn || '', aiNote: s.aiNote || '' };
  }
  // Same product = same name with spaces collapsed and case ignored (as in stock-import.js).
  function stockKey(name) { return String(name).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function liveProducts(b) {
    if (!client) return Promise.reject(new Error('no client'));
    return selectAll(function () {
      // '*': the detail columns of 0029 simply appear once it is run; before that they are missing.
      var q = client.from('ads_products').select('*');
      if (b) q = q.eq('business_id', b);
      return q.order('name', { ascending: true }).order('id', { ascending: true });
    }).then(function (rows) {
      return rows.map(function (r) {
        return stockItem({ id: r.id, business: r.business_id, name: r.name, quantity: r.quantity == null ? null : Number(r.quantity),
          price: r.sell_price == null ? null : Number(r.sell_price), updatedAt: r.updated_at,
          imageId: r.image_id, displayName: r.display_name, nameEn: r.name_en, aiNote: r.ai_note });
      });
    });
  }
  // The business's stock products (name order), then the sample products. opts.strict as in listImages.
  function listProducts(b, opts) {
    return init().then(function () {
      if (!isLive()) {
        var mine = state.stock.filter(function (s) { return !b || s.business === b; })
          .sort(function (x, y) { return x.name.localeCompare(y.name); })
          .map(stockItem);
        return wait(mine.concat(sampleProducts(b)));
      }
      return liveProducts(b).catch(function (e) { if (opts && opts.strict) throw e; return []; })
        .then(function (mine) { return mine.concat(sampleProducts(b)); });
    });
  }
  // One-line text, max length; empty -> null (the server clears the field).
  function cleanText(v, max) { var s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return s ? s.slice(0, max) : null; }
  // Photo and names of one stock product. d: { imageId, displayName, nameEn, aiNote }; null / empty clears.
  // Resolves with the saved values { imageId, displayName, nameEn, aiNote } ('' for an empty text).
  function setProductDetails(productId, d) {
    d = d || {};
    return init().then(function () {
      if (fixed.products.some(function (p) { return p.id === productId; })) throw codeError('pd.err.sample');
      var v = { imageId: d.imageId ? String(d.imageId) : null, displayName: cleanText(d.displayName, 200), nameEn: cleanText(d.nameEn, 200), aiNote: cleanText(d.aiNote, 500) };
      var out = { imageId: v.imageId, displayName: v.displayName || '', nameEn: v.nameEn || '', aiNote: v.aiNote || '' };
      if (!isLive()) {
        var s = state.stock.filter(function (x) { return x.id === productId; })[0];
        if (!s) throw new Error('not found');
        s.imageId = out.imageId; s.displayName = out.displayName; s.nameEn = out.nameEn; s.aiNote = out.aiNote;
        audit('product.details', 'product', s.id, s.name + ' | photo ' + (out.imageId ? 'set' : 'none') + (out.displayName ? ' | shown as ' + out.displayName : '') + ' (MOCK)');
        save();
        return wait(out);
      }
      if (!client) throw new Error('no client');
      return client.rpc('ads_set_product_details', { p_product: productId, p_image: v.imageId, p_display_name: v.displayName, p_name_en: v.nameEn, p_ai_note: v.aiNote })
        .then(function (r) { mustDb(r); return out; });
    });
  }

  /* ---- picture styles and the prompt template (live only; tables of supabase/0029) ---- */
  // Before 0029 is run the table / column / function is missing: Postgres 42P01 / 42703,
  // PostgREST PGRST202 / PGRST204 / PGRST205, or a message naming the missing object.
  var MISSING_DB = ['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'];
  function missingDb(err) {
    if (!err) return false;
    var m = String(err.message || '');
    return MISSING_DB.indexOf(String(err.code || '')) !== -1 ||
      /\b(relation|table|column|function)\b[^\n]*does not exist/i.test(m) || /could not find the [^\n]*schema cache/i.test(m);
  }
  // supabase-js error -> an Error; a missing 0029 object -> the key sty.err.db (translated by the UI).
  function dbError(err) { return missingDb(err) ? codeError('sty.err.db') : new Error((err && err.message) || 'request failed'); }
  function mustDb(r) { if (r.error) throw dbError(r.error); return r.data; }
  function liveOnly() {
    if (!isLive()) return Promise.reject(codeError('sty.mock'));
    if (!client) return Promise.reject(new Error('no client'));
    return null;
  }
  // Group item: { id, business, token ('FRAME', used as {FRAME} in the template), name, prefix (one capital
  //   letter of the option codes), nameColor (its options carry the colour of the name written on the
  //   picture; at most one group), pictureKind ('element' | 'picture': how its reference pictures are stored), sort }
  function groupItem(r) {
    return { id: r.id, business: r.business_id, token: r.token || '', name: r.name || '', prefix: r.prefix || '', nameColor: r.name_color === true,
      pictureKind: r.picture_kind === 'picture' ? 'picture' : 'element', sort: r.sort == null ? 0 : Number(r.sort) };
  }
  function listStyleGroups(b) {
    return liveOnly() || client.from('ads_style_groups').select('*').eq('business_id', b).then(mustDb).then(function (rows) {
      return (rows || []).map(groupItem).sort(function (x, y) { return (x.sort - y.sort) || x.token.localeCompare(y.token); });
    });
  }
  // Insert (no id: needs business, token, name, prefix) or update (id: only the fields given).
  // Resolves with the saved group item.
  function saveStyleGroup(g) {
    var stop = liveOnly(); if (stop) return stop;
    g = g || {};
    var row = {};
    if (g.token !== undefined) {
      row.token = String(g.token || '').trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9_]{0,19}$/.test(row.token)) return Promise.reject(codeError('sty.grp.err.token'));
      if (RESERVED_TOKENS.indexOf(row.token) !== -1) return Promise.reject(codeError('sty.grp.err.reserved', { token: row.token }));
    }
    if (g.name !== undefined) {
      row.name = String(g.name || '').replace(/\s+/g, ' ').trim().slice(0, 60); // 0029: max 60
      if (!row.name) return Promise.reject(codeError('sty.grp.err.name'));
    }
    if (g.prefix !== undefined) {
      row.prefix = String(g.prefix || '').trim().toUpperCase();
      if (!/^[A-Z]$/.test(row.prefix)) return Promise.reject(codeError('sty.grp.err.prefix'));
    }
    if (g.nameColor !== undefined) row.name_color = !!g.nameColor;
    if (g.pictureKind !== undefined) {
      if (GROUP_KINDS.indexOf(g.pictureKind) === -1) return Promise.reject(new Error('bad picture kind'));
      row.picture_kind = g.pictureKind;
    }
    if (g.sort !== undefined) row.sort = Math.round(Number(g.sort)) || 0;
    var q = g.id ? client.from('ads_style_groups').update(row).eq('id', g.id)
      : client.from('ads_style_groups').insert(Object.assign({ business_id: g.business }, row));
    return q.select('*').single().then(function (r) {
      if (r.error && r.error.code === '23505') throw codeError('sty.grp.err.taken');
      var saved = mustDb(r);
      auditLive(g.id ? 'style_group.update' : 'style_group.create', 'style_group', saved.id, { business_id: saved.business_id, token: saved.token, fields: Object.keys(row) });
      return groupItem(saved);
    });
  }
  // Deletes a group; the database deletes its options with it (their library pictures stay).
  function deleteStyleGroup(id) {
    return liveOnly() || client.from('ads_style_groups').delete().eq('id', id).select('id,business_id,token').then(mustDb).then(function (rows) {
      var r = (rows || [])[0];
      if (!r) throw new Error('not found');
      auditLive('style_group.delete', 'style_group', id, { business_id: r.business_id, token: r.token });
      return { ok: true };
    });
  }
  // Option item: { id, business, groupId, code ('F2'), name, prompt, imageId, textColor ('#rrggbb' or null;
  //   used in the name-colour group), active, sort }
  function styleItem(r) {
    return { id: r.id, business: r.business_id, groupId: r.group_id || null, code: r.code || '', name: r.name || '', prompt: r.prompt || '',
      imageId: r.image_id || null, textColor: r.text_color || null, active: r.active !== false, sort: r.sort == null ? 0 : Number(r.sort) };
  }
  function codeNo(code) { var m = /^[A-Za-z](\d{1,2})$/.exec(code || ''); return m ? parseInt(m[1], 10) : 0; }
  // Library items (with a signed address) for these ids, by id. A failed read gives {} (pictures are optional).
  function imagesById(ids) {
    if (!ids.length) return Promise.resolve({});
    return client.from('ads_images').select(IMG_COLS).in('id', ids).then(must).then(function (rows) {
      rows = rows || [];
      if (!rows.length) return {};
      return client.storage.from(IMG_BUCKET).createSignedUrls(rows.map(function (r) { return r.path; }), 3600).then(function (s) {
        var urls = {}, out = {};
        (must(s) || []).forEach(function (x) { if (x && x.signedUrl && !x.error) urls[x.path] = x.signedUrl; });
        rows.forEach(function (r) { out[r.id] = liveImage(r, urls[r.path] || ''); });
        return out;
      });
    }).catch(function () { return {}; });
  }
  // The business's options of all groups in their order (sort, then code); each also carries image: its
  // library item with a signed address (or null), for the UI's image cache.
  function listStyles(b) {
    return liveOnly() || client.from('ads_styles').select('*').eq('business_id', b).then(mustDb).then(function (rows) {
      var list = (rows || []).map(styleItem).sort(function (x, y) {
        return (x.sort - y.sort) || (codeNo(x.code) - codeNo(y.code)) || x.code.localeCompare(y.code);
      });
      var ids = idList(list.map(function (s) { return s.imageId; }));
      return imagesById(ids).then(function (imgs) {
        list.forEach(function (s) { s.image = (s.imageId && imgs[s.imageId]) || null; });
        return list;
      });
    });
  }
  // Insert (no id: needs business, groupId, code, name) or update (id: only the fields given).
  // Resolves with the saved option item.
  function saveStyle(s) {
    var stop = liveOnly(); if (stop) return stop;
    s = s || {};
    var row = {};
    if (s.groupId !== undefined) { if (!s.groupId) return Promise.reject(new Error('no group')); row.group_id = s.groupId; }
    if (s.code !== undefined) {
      row.code = String(s.code || '').trim().toUpperCase();
      if (!/^[A-Z]\d{1,2}$/.test(row.code)) return Promise.reject(codeError('sty.err.code'));
    }
    if (s.name !== undefined) row.name = String(s.name || '').replace(/\s+/g, ' ').trim().slice(0, 80); // 0029: max 80
    if (s.prompt !== undefined) row.prompt = String(s.prompt || '').trim();
    if (s.imageId !== undefined) row.image_id = s.imageId || null;
    if (s.textColor !== undefined) row.text_color = /^#[0-9a-f]{6}$/i.test(s.textColor || '') ? s.textColor : null;
    if (s.active !== undefined) row.active = !!s.active;
    if (s.sort !== undefined) row.sort = Math.round(Number(s.sort)) || 0;
    var q = s.id ? client.from('ads_styles').update(row).eq('id', s.id)
      : client.from('ads_styles').insert(Object.assign({ business_id: s.business }, row));
    return q.select('*').single().then(function (r) {
      if (r.error && r.error.code === '23505') throw codeError('sty.err.codeTaken', { code: row.code || s.code || '' });
      var saved = mustDb(r);
      auditLive(s.id ? 'style.update' : 'style.create', 'style', saved.id, { business_id: saved.business_id, code: saved.code, fields: Object.keys(row) });
      return styleItem(saved);
    });
  }
  function deleteStyle(id) {
    return liveOnly() || client.from('ads_styles').delete().eq('id', id).select('id,business_id,code').then(mustDb).then(function (rows) {
      var r = (rows || [])[0];
      if (!r) throw new Error('not found');
      auditLive('style.delete', 'style', id, { business_id: r.business_id, code: r.code });
      return { ok: true };
    });
  }
  // The business's prompt template: { template, rules, textAi, textOverlay, aspect } or null (none saved yet).
  function getPictureSettings(b) {
    return liveOnly() || client.from('ads_picture_settings').select('*').eq('business_id', b).maybeSingle().then(mustDb).then(function (r) {
      return r ? { template: r.template || '', rules: r.rules || '', textAi: r.text_ai || '', textOverlay: r.text_overlay || '', aspect: r.aspect || null } : null;
    });
  }
  function savePictureSettings(b, s) {
    var stop = liveOnly(); if (stop) return stop;
    s = s || {};
    var row = { business_id: b, template: String(s.template || ''), rules: String(s.rules || ''), text_ai: String(s.textAi || ''),
      text_overlay: String(s.textOverlay || ''), aspect: PIC_ASPECTS.indexOf(s.aspect) !== -1 ? s.aspect : '3:4' };
    return client.from('ads_picture_settings').upsert(row, { onConflict: 'business_id' }).select('*').single().then(mustDb).then(function (r) {
      auditLive('picture_settings.save', 'business', b, { aspect: r.aspect });
      return { template: r.template || '', rules: r.rules || '', textAi: r.text_ai || '', textOverlay: r.text_overlay || '', aspect: r.aspect || null };
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
    testPage: TEST_PAGE, metaHealth: metaHealth, listPagePosts: listPagePosts, newRequestId: newRequestId, createCampaignLive: createCampaignLive,
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
    // Library folders, Archive, tags, storage per person (9 Nov 2026, 0033)
    libraryRules: { folders: IMG_FOLDERS.slice(), elementTypes: ELEMENT_TYPES.slice(), archiveDays: ARCHIVE_DAYS, maxTags: TAG_MAX, tagLen: TAG_LEN, defaultMb: LIB_MB },
    libraryUsage: libraryUsage, deleteImages: deleteImages, archiveImages: archiveImages, setImageTags: setImageTags, cleanTags: cleanTags,
    // AI pictures with Gemini (6 Nov 2026, live only)
    aiImageStatus: aiImageStatus, aiTest: aiTest, generateImage: generateImage,
    // Posts with several products / pictures, product details, picture styles (6 Nov 2026, 0029)
    postRules: { maxProducts: POST_MAX_PRODUCTS, maxImages: POST_MAX_IMAGES }, pictureAspects: PIC_ASPECTS.slice(), reservedTokens: RESERVED_TOKENS.slice(),
    setProductDetails: setProductDetails,
    listStyleGroups: listStyleGroups, saveStyleGroup: saveStyleGroup, deleteStyleGroup: deleteStyleGroup,
    listStyles: listStyles, saveStyle: saveStyle, deleteStyle: deleteStyle,
    getPictureSettings: getPictureSettings, savePictureSettings: savePictureSettings,
    // Edit a campaign that is not running (ADS-19, 7 Nov 2026; mock in both modes)
    campaignRules: { maxName: CAMP_NAME_MAX }, updateCampaign: updateCampaign,
    // Companies, team, brands, approvals (11 Nov 2026, ADS-32...36; sample mode until ADS-37)
    workspaceRules: { channels: CHANNELS.slice(), tools: WORK_TOOLS.slice(), workTypes: WORK_TYPES.slice(), roles: ROLES.slice(),
      textMax: CO_TEXT_MAX, brandTextMax: BRAND_TEXT_MAX, brandColorsMax: BRAND_COLORS_MAX, feedbackMax: FEEDBACK_MAX },
    saveCompany: saveCompany, skipOnboarding: skipOnboarding, startEmptyWorkspace: startEmptyWorkspace,
    listMembers: listMembers, inviteMember: inviteMember, updateMember: updateMember, removeMember: removeMember,
    listBrands: listBrands, saveBrand: saveBrand, deleteBrand: deleteBrand, addBrandFeedback: addBrandFeedback,
    listApprovals: listApprovals, approveItem: approveItem, sendBack: sendBack,
    // Live team + companies (0039), post goals and Messaging (13 Nov 2026)
    myAccess: myAccess, acceptInvites: acceptInvites,
    goalRules: { textMax: GOAL_TEXT_MAX }, listGoals: listGoals, saveGoal: saveGoal, deleteGoal: deleteGoal,
    msgRules: { textMax: MSG_MAX }, listConversations: listConversations, openConversation: openConversation,
    replyConversation: replyConversation, setConversationStatus: setConversationStatus,
    // Keys (0043) and the audit log (13 Nov 2026)
    listConnections: listConnections, saveConnection: saveConnection, testConnection: testConnection,
    removeConnection: removeConnection, setCompanyMeta: setCompanyMeta, listAuditLog: listAuditLog
  };
})();
