/* =========================================================================
   PHANTASMA — career.js
   Career service (Personal Career Strategist): the admin panel and the chat
   between each client and the Phantasma team. Loaded after script.js on
   account.html, preferences.html and admin.html only.

     1. Helpers         — dates, sorting, badges, session watcher
     2. Chat component  — one conversation: history, composer, edit/delete,
                          emoji. Used by the client window AND the admin pane.
     3. Client | Admin  — the switch on account.html (admins only)
     4. Client chat     — round "Messages" button + floating window
                          (account.html, preferences.html; signed in only)
     5. Admin panel     — admin.html: Clients / Messages / Admins tabs

   Supabase is reached through the client script.js already holds
   (window.PhantasmaAuth, set at the end of script.js). Backend contract:
   supabase/0024-career-admin-chat.sql and
   supabase/functions/career-admin-invite/index.ts. The database checks every
   call itself (RLS + is_career_admin()), so what this file shows or hides is
   convenience, not security. Message text only ever goes in via textContent.
   ========================================================================= */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A phone keyboard has no Shift key: on touch-only devices Enter makes a
  // new line and the round send button sends. With a real keyboard Enter sends.
  const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ---------------------------------------------------------------------
     1. Helpers
     --------------------------------------------------------------------- */
  const db = () => (window.PhantasmaAuth ? window.PhantasmaAuth.db() : null);

  // Await a Supabase call; a thrown network error comes back as { error } too.
  async function call(query) {
    try { return await query; } catch (error) { return { data: null, error }; }
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // Small stroke icons on a 24px grid, built as SVG nodes (no markup strings).
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    chat: ['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'],
    send: ['M22 2 11 13', 'M22 2 15 22 11 13 2 9z'],
    smile: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z', 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01', 'M15 9h.01'],
    expand: ['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7', 'M3 21l7-7'],
    collapse: ['M4 14h6v6', 'M20 10h-6V4', 'M14 10l7-7', 'M3 21l7-7'],
    close: ['M18 6 6 18', 'M6 6l12 12'],
  };
  function icon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    [['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'],
     ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true'], ['focusable', 'false']]
      .forEach(([k, v]) => svg.setAttribute(k, v));
    ICONS[name].forEach((d) => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  // Dates. A bare 'YYYY-MM-DD' (date column) is a local day, not UTC midnight.
  function toDate(v) {
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
    return isNaN(d) ? null : d;
  }
  const fmtDate = (v) => { const d = toDate(v); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
  const fmtTime = (v) => { const d = toDate(v); return d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''; };
  const fmtDateTime = (v) => (toDate(v) ? fmtDate(v) + ', ' + fmtTime(v) : '—');
  const stamp = (v) => { const d = toDate(v); return d ? d.getTime() : null; };
  const dayKey = (v) => { const d = toDate(v); return d ? d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate() : ''; };
  function dayLabel(v) {
    const now = new Date();
    if (dayKey(v) === dayKey(now)) return 'Today';
    if (dayKey(v) === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Yesterday';
    return toDate(v).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Sorting, same rules as the account tables: empty values last both ways.
  const isEmptyVal = (v) => v == null || v === '' || (typeof v === 'number' && isNaN(v));
  function compare(a, b, dir) {
    const ea = isEmptyVal(a), eb = isEmptyVal(b);
    if (ea || eb) return ea === eb ? 0 : (ea ? 1 : -1);
    const c = typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), ['ka', 'en'], { numeric: true, sensitivity: 'base' });
    return dir === 'desc' ? -c : c;
  }
  const nextDir = (dir) => (dir === 'asc' ? 'desc' : dir === 'desc' ? 'none' : 'asc');

  // Unread count in a red pill, plus " unread" for screen readers.
  function paintBadge(badge, n) {
    if (!badge) return;
    badge.replaceChildren();
    badge.hidden = !(n > 0);
    if (!(n > 0)) return;
    badge.appendChild(document.createTextNode(n > 99 ? '99+' : String(n)));
    badge.appendChild(el('span', 'visually-hidden', ' unread'));
  }

  // Calls fn(session) once per signed-in user, and with null on sign-out.
  // script.js fires phantasma:auth on every auth event (token refreshes
  // included, hence the user-id check); getSession() covers an event that
  // fired before this file was ready.
  function watchSession(fn) {
    let current;                                   // undefined until the first call
    const take = (s) => {
      const id = s && s.user ? s.user.id : null;
      if (id === current) return;
      current = id;
      fn(s || null);
    };
    document.addEventListener('phantasma:auth', (e) => take(e.detail && e.detail.session));
    const sb = db();
    if (sb) sb.auth.getSession().then(({ data }) => take(data && data.session), () => {});
  }

  // is_career_admin(), asked once per signed-in user (cleared on self-removal).
  const adminCache = {};
  function checkAdmin(session) {
    const id = session.user.id;
    if (!adminCache[id]) {
      adminCache[id] = call(db().rpc('is_career_admin')).then(({ data, error }) => {
        if (error) { delete adminCache[id]; throw error; }
        return data === true;
      });
    }
    return adminCache[id];
  }

  // Keep the chat button and window above the cookie banner while it shows
  // (the banner sits on top of everything at the bottom of the screen).
  function liftAboveCookieBanner(dock) {
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;
    const set = () => dock.style.setProperty('--chat-lift', banner.hidden ? '0px' : banner.offsetHeight + 'px');
    set();
    new MutationObserver(set).observe(banner, { attributes: true, attributeFilter: ['hidden'] });
    if (window.ResizeObserver) new ResizeObserver(set).observe(banner);
  }

  /* ---------------------------------------------------------------------
     2. Chat component
     One conversation = the chat_messages rows of one client_id. A client
     sees only their own (RLS); an admin opens any client's. Own messages
     (sender_id = me) can be edited and deleted; a deleted row keeps its
     place with an empty body and shows "Message deleted".
     createChat(host, opts) draws history + composer into `host`:
       opts.isAdmin     admin pane: the team (from_admin) is on the right
       opts.me()        signed-in user id
       opts.otherName() the client's name (admin pane)
       opts.isActive()  true while the conversation is on screen → mark read
       opts.onRead()    after messages were marked read (refresh badges)
       opts.emptyText   shown when the conversation has no messages yet
       opts.pickText    shown while no conversation is open (admin pane)
     Returns { open(clientId|null), apply(row), sync(), markReadSoon(),
               reveal(), focus() }.
     --------------------------------------------------------------------- */
  const MSG_COLS = 'id, client_id, sender_id, from_admin, body, created_at, edited_at, deleted_at, read_at';
  const HISTORY = 300;                             // newest N messages per conversation
  const MAX_LEN = 4000;                            // chat_messages.body limit
  const EMOJIS = [
    ['😀', 'Grinning face'], ['😂', 'Tears of joy'], ['😊', 'Smiling face'], ['🙂', 'Slight smile'],
    ['😉', 'Wink'], ['😍', 'Heart eyes'], ['😎', 'Cool'], ['🤔', 'Thinking'],
    ['😅', 'Relieved laugh'], ['😮', 'Surprised'], ['😢', 'Sad'], ['🙏', 'Thank you'],
    ['👍', 'Thumbs up'], ['👎', 'Thumbs down'], ['👏', 'Applause'], ['🙌', 'Hooray'],
    ['💪', 'Strong'], ['👋', 'Wave'], ['🎉', 'Celebration'], ['❤️', 'Heart'],
    ['🔥', 'Fire'], ['⭐', 'Star'], ['✅', 'Done'], ['❌', 'No'],
  ];
  const EMOJI_COLS = 6;                            // grid width, for the arrow keys
  const enterSends = (e) => e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && !touchOnly;
  let chatCount = 0;

  function createChat(host, opts) {
    const n = ++chatCount;
    const rows = new Map();                        // id -> row of the open conversation
    let clientId = null;
    let loaded = false;                            // history has arrived for clientId
    let loadToken = 0;
    let editing = null;                            // { id, ta, saving } while editing a message
    let sending = false;
    let readTimer = null;

    const mine = (r) => r.sender_id === opts.me();
    // Right-hand side: a client's own messages; for admins the whole team.
    const rightSide = (r) => (opts.isAdmin ? r.from_admin : !r.from_admin);
    // From the other side (what "unread" counts).
    const incoming = (r) => (opts.isAdmin ? !r.from_admin : r.from_admin);
    function whoOf(r) {
      if (mine(r)) return 'You';
      if (opts.isAdmin) return r.from_admin ? 'Another admin' : opts.otherName();
      return 'Phantasma team';
    }
    const order = (a, b) => (stamp(a.created_at) - stamp(b.created_at)) || (a.id - b.id);
    const sorted = () => Array.from(rows.values()).sort(order);

    // ---- DOM
    const root = el('div', 'chat');
    const empty = el('p', 'chat__empty');
    const log = el('ol', 'chat__log');
    log.tabIndex = 0;                              // scrollable with the keyboard
    log.setAttribute('aria-label', 'Messages');
    log.hidden = true;
    const live = el('p', 'visually-hidden');       // announces new incoming messages
    live.setAttribute('aria-live', 'polite');

    const form = el('form', 'chat__composer');
    form.noValidate = true;
    const emojiBtn = el('button', 'chat__icon-btn');
    emojiBtn.type = 'button';
    emojiBtn.title = 'Emoji';
    emojiBtn.setAttribute('aria-label', 'Insert emoji');
    emojiBtn.setAttribute('aria-expanded', 'false');
    emojiBtn.setAttribute('aria-controls', 'chat-emoji-' + n);
    emojiBtn.appendChild(icon('smile'));
    const grid = el('div', 'chat-emoji');
    grid.id = 'chat-emoji-' + n;
    grid.hidden = true;
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Emoji');
    EMOJIS.forEach(([ch, name]) => {
      const b = el('button', 'chat-emoji__btn', ch);
      b.type = 'button';
      b.title = name;
      b.setAttribute('aria-label', name);
      grid.appendChild(b);
    });
    const label = el('label', 'visually-hidden', 'Your message');
    label.htmlFor = 'chat-input-' + n;
    const input = el('textarea', 'chat__input');
    input.id = 'chat-input-' + n;
    input.rows = 1;
    input.maxLength = MAX_LEN;
    input.placeholder = 'Write a message…';
    const sendBtn = el('button', 'chat__send');
    sendBtn.type = 'submit';
    sendBtn.title = 'Send';
    sendBtn.setAttribute('aria-label', 'Send');
    sendBtn.appendChild(icon('send'));
    const status = el('p', 'chat__status');
    status.setAttribute('role', 'status');
    status.hidden = true;
    form.append(emojiBtn, grid, label, input, sendBtn, status);
    if (!touchOnly) form.appendChild(el('p', 'chat__hint', 'Enter sends · Shift+Enter adds a new line'));
    root.append(empty, log, live, form);
    host.appendChild(root);

    function say(text) {
      status.textContent = text || '';
      status.hidden = !text;
    }
    function announce(text) {
      live.textContent = text.length > 160 ? text.slice(0, 160) + '…' : text;
    }
    function autosize(ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight + 2, 160) + 'px';   // +2: the 1px borders
    }
    const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    const toEnd = () => { log.scrollTop = log.scrollHeight; };
    function showList() {
      log.hidden = !rows.size;
      empty.hidden = rows.size > 0;
    }

    // ---- drawing
    function dayItem(v) {
      const li = el('li', 'chat__day');
      li.appendChild(el('span', null, dayLabel(v)));
      return li;
    }
    // A visible name starts every run of messages from someone other than me.
    const startsRun = (r, prev) => !mine(r) &&
      (!prev || prev.sender_id !== r.sender_id || dayKey(prev.created_at) !== dayKey(r.created_at));

    // (Re)fill one message <li>. showWho: visible name above the bubble.
    function fillItem(li, r, showWho) {
      li.className = 'chat-msg' + (rightSide(r) ? ' chat-msg--right' : '') + (r.deleted_at ? ' is-deleted' : '');
      li.dataset.who = showWho ? '1' : '';
      li.replaceChildren();
      if (showWho) {
        const who = el('p', 'chat-msg__who', whoOf(r));
        who.setAttribute('aria-hidden', 'true');   // the bubble says it for screen readers
        li.appendChild(who);
      }
      const bubble = el('div', 'chat-msg__bubble');
      bubble.appendChild(el('span', 'visually-hidden', whoOf(r) + ': '));
      bubble.appendChild(el('p', 'chat-msg__text', r.deleted_at ? 'Message deleted' : r.body));
      const meta = el('p', 'chat-msg__meta');
      const time = el('time', null, fmtTime(r.created_at));
      time.dateTime = r.created_at;
      time.title = fmtDateTime(r.created_at);
      meta.appendChild(time);
      if (r.edited_at && !r.deleted_at) {
        const ed = el('span', 'chat-msg__edited', 'edited');
        ed.title = 'Edited ' + fmtDateTime(r.edited_at);
        meta.appendChild(ed);
      }
      bubble.appendChild(meta);
      li.appendChild(bubble);
      if (mine(r) && !r.deleted_at) {
        const at = fmtTime(r.created_at);
        const acts = el('div', 'chat-msg__actions');
        const edit = el('button', 'chat-msg__act', 'Edit');
        edit.type = 'button';
        edit.dataset.act = 'edit';
        edit.setAttribute('aria-label', 'Edit your message from ' + at);
        const del = el('button', 'chat-msg__act', 'Delete');
        del.type = 'button';
        del.dataset.act = 'delete';
        del.setAttribute('aria-label', 'Delete your message from ' + at);
        acts.append(edit, del);
        li.appendChild(acts);
      }
    }

    function appendRow(r, prev) {
      if (!prev || dayKey(prev.created_at) !== dayKey(r.created_at)) log.appendChild(dayItem(r.created_at));
      const li = el('li');
      li.dataset.id = String(r.id);
      fillItem(li, r, startsRun(r, prev));
      log.appendChild(li);
    }

    // Whole list (history load, or a message that arrived out of order).
    // An open editor survives with its draft.
    function renderAll() {
      const draft = editing ? { id: editing.id, text: editing.ta.value } : null;
      editing = null;
      log.replaceChildren();
      let prev = null;
      sorted().forEach((r) => { appendRow(r, prev); prev = r; });
      showList();
      if (draft) startEdit(draft.id, draft.text);
    }

    const itemOf = (id) => log.querySelector('li[data-id="' + id + '"]');

    // Redraw one message in place; focus stays on its button when it still exists.
    function refill(r) {
      const li = itemOf(r.id);
      if (!li) return;
      const act = li.contains(document.activeElement) && document.activeElement.dataset.act;
      fillItem(li, r, li.dataset.who === '1');
      if (act) (li.querySelector('[data-act="' + act + '"]') || input).focus();
    }

    // ---- data in: a row from realtime, a send, or sync(). Rows of other
    // conversations are ignored.
    function apply(r) {
      if (!r || r.id == null || !clientId || r.client_id !== clientId) return;
      const old = rows.get(r.id);
      const row = Object.assign({}, old, r);
      rows.set(r.id, row);
      if (!loaded) return;                         // drawn when the history arrives
      if (old) {
        const changed = old.body !== row.body || old.edited_at !== row.edited_at || old.deleted_at !== row.deleted_at;
        if (!changed) return;                      // e.g. only read_at moved
        if (editing && editing.id === row.id) {
          if (!row.deleted_at) return;             // keep the open editor; Save writes over it
          editing = null;                          // deleted elsewhere: drop the editor
        }
        refill(row);
        return;
      }
      const stick = nearBottom() || mine(row);
      const list = sorted();
      const i = list.indexOf(row);
      if (i === list.length - 1) appendRow(row, list[i - 1] || null);
      else renderAll();
      showList();
      if (stick) toEnd();
      if (incoming(row) && !row.deleted_at) {
        announce('New message from ' + whoOf(row) + ': ' + row.body);
        markReadSoon();
      }
    }

    function fetchHistory(id) {
      return call(db().from('chat_messages').select(MSG_COLS)
        .eq('client_id', id).order('created_at', { ascending: false }).limit(HISTORY));
    }

    // Open a conversation (null = none). Clears the composer so a draft
    // never goes to the wrong client.
    async function open(id) {
      const token = ++loadToken;
      editing = null;
      clientId = id || null;
      loaded = false;
      rows.clear();
      log.replaceChildren();
      setEmoji(false);
      say('');
      input.value = '';
      autosize(input);
      form.hidden = !clientId;
      log.hidden = true;
      empty.hidden = false;
      if (!clientId) { empty.textContent = opts.pickText || ''; return; }
      empty.textContent = 'Loading messages…';
      const { data, error } = await fetchHistory(clientId);
      if (token !== loadToken) return;             // another conversation was opened meanwhile
      if (error) { empty.textContent = 'Could not load the messages. Please try again later.'; return; }
      (data || []).forEach((r) => { if (!rows.has(r.id)) rows.set(r.id, r); });
      loaded = true;
      empty.textContent = opts.emptyText;
      renderAll();
      toEnd();
      markReadSoon();
    }

    // Catch up after the browser tab was in the background (realtime can miss events).
    async function sync() {
      if (!clientId || !loaded) return;
      const id = clientId;
      const { data, error } = await fetchHistory(id);
      if (error || id !== clientId || !loaded) return;
      (data || []).slice().reverse().forEach(apply);
    }

    // ---- read receipts: only while the conversation is on screen
    function markReadSoon() {
      clearTimeout(readTimer);
      readTimer = setTimeout(markRead, 400);
    }
    async function markRead() {
      if (!clientId || !loaded || document.visibilityState !== 'visible' || !opts.isActive()) return;
      const pending = sorted().filter((r) => incoming(r) && !r.read_at && !r.deleted_at);
      if (!pending.length) return;
      const id = clientId;
      const { error } = await call(db().rpc('chat_mark_read', { p_client: opts.isAdmin ? id : null }));
      if (error) return;
      const now = new Date().toISOString();
      pending.forEach((r) => { if (!r.read_at) r.read_at = now; });
      if (opts.onRead) opts.onRead(id);
    }

    // ---- send
    async function send() {
      const body = input.value.trim();
      if (sending || !clientId) return;
      if (!body) { input.focus(); return; }
      sending = true;
      sendBtn.setAttribute('aria-disabled', 'true');
      say('');
      const { data, error } = await call(db().rpc('chat_send', { p_client: opts.isAdmin ? clientId : null, p_body: body }));
      sending = false;
      sendBtn.removeAttribute('aria-disabled');
      if (error) {
        say(/too many/i.test(error.message || '')
          ? 'That is a lot of messages in one minute. Please wait a moment.'
          : 'Could not send. Please try again.');
        return;
      }
      input.value = '';
      autosize(input);
      apply(Array.isArray(data) ? data[0] : data);
      input.focus();
    }
    form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
    input.addEventListener('keydown', (e) => { if (enterSends(e)) { e.preventDefault(); send(); } });
    input.addEventListener('input', () => autosize(input));

    // ---- edit (inline, Save / Cancel) and delete (after a confirm) — own messages only
    function startEdit(id, draft) {
      const r = rows.get(id);
      const li = itemOf(id);
      if (!r || !li || r.deleted_at || !mine(r)) return;
      if (editing) stopEdit(false);
      say('');
      const f = el('form', 'chat-edit');
      f.noValidate = true;
      const ta = el('textarea', 'chat__input chat-edit__input');
      ta.value = draft != null ? draft : r.body;
      ta.maxLength = MAX_LEN;
      ta.rows = 2;
      ta.setAttribute('aria-label', 'Edit your message');
      const btns = el('div', 'chat-edit__actions');
      const save = el('button', 'chat-edit__btn chat-edit__btn--save', 'Save');
      save.type = 'submit';
      const cancel = el('button', 'chat-edit__btn', 'Cancel');
      cancel.type = 'button';
      btns.append(save, cancel);
      f.append(ta, btns);
      li.querySelector('.chat-msg__bubble').hidden = true;
      const acts = li.querySelector('.chat-msg__actions');
      if (acts) acts.hidden = true;
      li.classList.add('is-editing');
      li.appendChild(f);
      editing = { id, ta, saving: false };
      cancel.addEventListener('click', () => stopEdit(true));
      f.addEventListener('submit', (e) => { e.preventDefault(); saveEdit(); });
      ta.addEventListener('input', () => autosize(ta));
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stopEdit(true); }
        else if (enterSends(e)) { e.preventDefault(); saveEdit(); }
      });
      autosize(ta);
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }

    function stopEdit(refocus) {
      if (!editing) return;
      const id = editing.id;
      editing = null;
      const r = rows.get(id);
      const li = itemOf(id);
      if (!r || !li) return;
      fillItem(li, r, li.dataset.who === '1');     // also removes the editor
      if (refocus) (li.querySelector('[data-act="edit"]') || input).focus();
    }

    async function saveEdit() {
      if (!editing || editing.saving) return;
      const cur = editing;
      const body = cur.ta.value.trim();
      const r = rows.get(cur.id);
      if (!body) { say('A message cannot be empty. Use Delete to remove it.'); cur.ta.focus(); return; }
      if (r && body === r.body) { stopEdit(true); return; }
      cur.saving = true;
      const { error } = await call(db().rpc('chat_edit', { p_id: cur.id, p_body: body }));
      cur.saving = false;
      if (error) { say('Could not save the change. Please try again.'); return; }
      say('');
      const row = Object.assign({}, rows.get(cur.id), { body: body.slice(0, MAX_LEN), edited_at: new Date().toISOString() });
      rows.set(cur.id, row);
      if (editing === cur) stopEdit(true);
      else refill(row);
    }

    async function remove(id) {
      if (!window.confirm('Delete this message? This cannot be undone.')) return;
      const { error } = await call(db().rpc('chat_delete', { p_id: id }));
      if (error) { say('Could not delete the message. Please try again.'); return; }
      const row = Object.assign({}, rows.get(id), { body: '', deleted_at: new Date().toISOString() });
      rows.set(id, row);
      refill(row);                                 // its buttons are gone → focus moves to the composer
    }

    log.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b || !log.contains(b)) return;
      const id = Number(b.closest('li[data-id]').dataset.id);
      if (b.dataset.act === 'edit') startEdit(id);
      else remove(id);
    });

    // ---- emoji grid: inserts at the caret; arrows move, Esc closes
    function setEmoji(open, refocus) {
      grid.hidden = !open;
      emojiBtn.setAttribute('aria-expanded', String(open));
      if (open) grid.firstChild.focus();
      else if (refocus) emojiBtn.focus();
    }
    // The textarea keeps its caret position while it is not focused.
    function insertEmoji(ch) {
      const end = input.value.length;
      const s = typeof input.selectionStart === 'number' ? input.selectionStart : end;
      const t = typeof input.selectionEnd === 'number' ? input.selectionEnd : end;
      if (input.value.length - (t - s) + ch.length <= MAX_LEN) input.setRangeText(ch, s, t, 'end');
      autosize(input);
      input.focus();
    }
    emojiBtn.addEventListener('click', () => setEmoji(grid.hidden));
    grid.addEventListener('mousedown', (e) => e.preventDefault());   // a click must not steal focus first
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('.chat-emoji__btn');
      if (!b) return;
      setEmoji(false);
      insertEmoji(b.textContent);
    });
    grid.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEmoji(false, true); return; }
      const items = Array.from(grid.children);
      const i = items.indexOf(document.activeElement);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + EMOJI_COLS, ArrowUp: i - EMOJI_COLS, Home: 0, End: items.length - 1 }[e.key];
      if (to == null) return;
      e.preventDefault();
      if (to >= 0 && to < items.length) items[to].focus();
    });
    // Close when focus moves on (Tab) or on a click anywhere else.
    form.addEventListener('focusout', (e) => {
      const to = e.relatedTarget;
      if (!grid.hidden && to && !grid.contains(to) && to !== emojiBtn) setEmoji(false);
    });
    document.addEventListener('click', (e) => {
      if (!grid.hidden && !grid.contains(e.target) && !emojiBtn.contains(e.target)) setEmoji(false);
    });

    return {
      open,
      apply,
      sync,
      markReadSoon,
      // Back on screen (window reopened, tab selected): newest at the bottom, then mark read.
      reveal() { if (loaded) toEnd(); markReadSoon(); },
      focus() { if (!form.hidden) input.focus(); },
    };
  }

  /* ---------------------------------------------------------------------
     3. Client | Admin switch (account.html). Hidden for everyone except
     career-service admins, after login. admin.html carries the same switch;
     bootAdminPanel shows it there.
     --------------------------------------------------------------------- */
  function bootRoleSwitch() {
    const sw = document.getElementById('role-switch');
    if (!sw || document.getElementById('admin') || !db()) return;
    let uid = null;
    watchSession((s) => {
      sw.hidden = true;
      uid = s ? s.user.id : null;
      if (!s) return;
      checkAdmin(s).then((yes) => { if (uid === s.user.id) sw.hidden = !yes; }, () => {});
    });
  }

  /* ---------------------------------------------------------------------
     4. Client chat window (account.html, preferences.html; signed in only).
     A round Messages button bottom-right with the unread count; it opens a
     floating window (about 360×520, expandable; near full screen on phones).
     History loads on first open; realtime keeps the badge and the window
     live; messages are marked read only while the window is open.
     --------------------------------------------------------------------- */
  function bootClientChat() {
    if (!document.getElementById('account') && !document.getElementById('preferences')) return;
    if (!db()) return;                             // supabase-js did not load

    let me = null;
    let channel = null;
    let opened = false;                            // history loaded for `me`
    let unreadTimer = null;

    // ---- DOM, built once and kept hidden while signed out
    const dock = el('div', 'chat-dock');
    dock.hidden = true;
    const fab = el('button', 'chat-fab');
    fab.type = 'button';
    fab.title = 'Messages';
    fab.setAttribute('aria-controls', 'chat-panel');
    fab.setAttribute('aria-expanded', 'false');
    fab.appendChild(icon('chat'));
    const badge = el('span', 'chat-badge');
    badge.hidden = true;
    badge.setAttribute('aria-hidden', 'true');     // the button's label carries the count
    fab.appendChild(badge);

    const panel = el('section', 'chat-panel');
    panel.id = 'chat-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'chat-panel-title');
    const head = el('div', 'chat-panel__head');
    const title = el('h2', 'chat-panel__title', 'Messages — Phantasma team');
    title.id = 'chat-panel-title';
    const sizeBtn = el('button', 'chat-panel__btn chat-panel__size');
    sizeBtn.type = 'button';
    const closeBtn = el('button', 'chat-panel__btn');
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.setAttribute('aria-label', 'Close messages');
    closeBtn.appendChild(icon('close'));
    head.append(title, sizeBtn, closeBtn);
    panel.appendChild(head);
    dock.append(fab, panel);

    const chat = createChat(panel, {
      isAdmin: false,
      me: () => me,
      isActive: () => !panel.hidden,
      onRead: () => refreshUnreadSoon(),
      emptyText: 'No messages yet. Ask the Phantasma team anything about your service — replies appear here.',
    });
    document.body.appendChild(dock);
    liftAboveCookieBanner(dock);

    function paintSize(big) {
      panel.classList.toggle('is-expanded', big);
      const text = big ? 'Collapse window' : 'Expand window';
      sizeBtn.title = text;
      sizeBtn.setAttribute('aria-label', text);
      sizeBtn.replaceChildren(icon(big ? 'collapse' : 'expand'));
    }
    paintSize(false);
    sizeBtn.addEventListener('click', () => paintSize(!panel.classList.contains('is-expanded')));

    function openPanel() {
      panel.hidden = false;
      fab.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => panel.classList.add('is-open'));
      if (!opened) { opened = true; chat.open(me); } else chat.reveal();
      chat.focus();
    }
    function closePanel(refocus) {
      panel.classList.remove('is-open');
      panel.hidden = true;
      fab.setAttribute('aria-expanded', 'false');
      if (refocus) fab.focus();
    }
    fab.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel(false)));
    closeBtn.addEventListener('click', () => closePanel(true));
    // Esc closes (the emoji grid and the inline editor catch their own Esc first).
    // Stopped here so it does not also close a table panel on the page.
    dock.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || panel.hidden) return;
      e.preventDefault();
      e.stopPropagation();
      closePanel(true);
    });

    // ---- unread badge: chat_unread() = admin replies not yet read
    function paintFab(count) {
      paintBadge(badge, count);
      fab.setAttribute('aria-label', count > 0 ? 'Messages, ' + count + ' unread' : 'Messages');
    }
    async function refreshUnread() {
      if (!me) return;
      const who = me;
      const { data, error } = await call(db().rpc('chat_unread'));
      if (!error && who === me) paintFab(Number(data) || 0);
    }
    function refreshUnreadSoon() {
      clearTimeout(unreadTimer);
      unreadTimer = setTimeout(refreshUnread, 300);
    }

    // ---- realtime: this client's conversation only
    function listen() {
      channel = db().channel('career-chat-' + me)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'chat_messages', filter: 'client_id=eq.' + me },
          (p) => { if (p.new) chat.apply(p.new); refreshUnreadSoon(); })
        .subscribe();
    }
    function stopListening() {
      if (channel) { db().removeChannel(channel); channel = null; }
    }

    watchSession((s) => {
      stopListening();
      closePanel(false);
      me = s ? s.user.id : null;
      opened = false;
      chat.open(null);
      dock.hidden = !s;
      document.body.classList.toggle('has-chat', !!s);
      paintFab(0);
      if (!s) return;
      refreshUnread();
      listen();
    });

    document.addEventListener('visibilitychange', () => {
      if (!me || document.visibilityState !== 'visible') return;
      refreshUnreadSoon();
      if (opened) chat.sync();
      if (!panel.hidden) chat.markReadSoon();
    });
  }

  /* ---------------------------------------------------------------------
     5. Admin panel (admin.html). Signed out → Log in prompt; signed in but
     not an admin → "No access"; admins → three tabs:
       Clients  — every account: plan, searches, LinkedIn, CV, preferences
                  filled, unread (opens that client's chat), dates. Search
                  box + sortable headers (same look as the account tables).
       Messages — conversation list (newest first, unread counts) + chat pane.
       Admins   — the list with Remove, and Add admin (invitation email).
     One realtime channel without a filter keeps all of it live.
     --------------------------------------------------------------------- */
  function bootAdminPanel() {
    const root = document.getElementById('admin');
    if (!root) return;
    const $ = (sel) => root.querySelector(sel);
    const signedOut = $('#admin-signed-out');
    const checking  = $('#admin-checking');
    const denied    = $('#admin-denied');
    const deniedTxt = $('#admin-denied-text');
    const panel     = $('#admin-panel');
    const roleSw    = $('#role-switch');
    const who       = $('#admin-who');
    const whoEmail  = $('#admin-email');
    if (!db()) return;                             // supabase-js did not load: the Log in prompt stays

    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const tab = (name) => tabs.find((t) => t.dataset.tab === name) || null;
    const tabBadge = $('#admin-unread');

    let session = null;
    let gen = 0;                                   // bumps on every sign-in / sign-out
    let me = null;                                 // { id, email (lower case) }
    let clients = [];                              // career_admin_clients() rows
    let openId = null;                             // conversation in the Messages pane
    let channel = null;
    let refreshTimer = null;
    const clientOf = (id) => clients.find((c) => c.user_id === id) || null;
    const nameOf = (c) => (c && (c.full_name || c.email)) || 'Client';
    const note = (p, kind, text) => { p.textContent = text || ''; p.dataset.kind = kind || ''; p.hidden = !text; };

    // ---- Messages: conversation list + one chat pane
    const convList  = $('#conv-list');
    const convEmpty = $('#conv-empty');
    const pane      = $('#admin-chat-pane');
    const paneTitle = $('#admin-chat-title');
    const paneSub   = $('#admin-chat-sub');
    const chat = createChat($('#admin-chat-body'), {
      isAdmin: true,
      me: () => (me ? me.id : null),
      otherName: () => nameOf(clientOf(openId)),
      isActive: () => !panel.hidden && tab('messages').getAttribute('aria-selected') === 'true',
      onRead: () => refreshSoon(),
      emptyText: 'No messages with this client yet. Write the first one below.',
      pickText: 'Choose a conversation to read and reply.',
    });

    // ---- tabs (ARIA tabs: arrows / Home / End move; the selected tab is the Tab stop)
    function selectTab(t, focus) {
      tabs.forEach((x) => {
        const on = x === t;
        x.setAttribute('aria-selected', String(on));
        x.tabIndex = on ? 0 : -1;
        document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) t.focus();
      if (history.replaceState) history.replaceState(null, '', '#' + t.dataset.tab);
      if (t.dataset.tab === 'messages') chat.reveal();
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => selectTab(t, false));
      t.addEventListener('keydown', (e) => {
        const to = { ArrowRight: i + 1, ArrowLeft: i - 1 + tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
        if (to == null) return;
        e.preventDefault();
        selectTab(tabs[to % tabs.length], true);
      });
    });

    // ---- Clients: every account with plan and progress
    const search   = $('#client-search');
    const countEl  = $('#client-count');
    const tableBox = $('#clients-table');
    const COLS = [
      { text: 'Client',      sort: (c) => (c.full_name || c.email || '').toLowerCase() },
      { text: 'Plan',        sort: (c) => c.plan_code || null },
      { text: 'Searches',    sort: (c) => Number(c.runs) || 0,
        title: 'Search runs (weekly shortlists delivered). Below: vacancies matched, confirmed by the client (ticked or already sent) and sent' },
      { text: 'LinkedIn',    sort: (c) => (c.linkedin_connected ? 2 : c.linkedin_link ? 1 : 0),
        title: 'Signed in = the client logs in with LinkedIn, so the profile is confirmed as theirs; Link added = only a profile link typed in Profile details' },
      { text: 'CV',          sort: (c) => (c.has_cv ? 1 : 0) },
      { text: 'Preferences', sort: (c) => Number(c.prefs_pct) || 0, title: 'Share of the preferences questionnaire filled in' },
      { text: 'Unread',      sort: (c) => Number(c.unread) || 0 },
      { text: 'Signed up',   sort: (c) => stamp(c.signed_up) },
      { text: 'Last login',  sort: (c) => stamp(c.last_sign_in) },
    ];
    let sortCol = -1, sortDir = 'none';            // asc → desc → original order, like the account tables
    let tbody = null;
    const ths = [];

    function buildTable() {
      const t = el('table', 'account-table account-table--clients');
      t.appendChild(el('caption', 'visually-hidden', 'Career-service accounts'));
      const hr = t.createTHead().insertRow();
      COLS.forEach((col, i) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.setAttribute('aria-sort', 'none');
        if (col.title) th.title = col.title;
        const b = el('button', 't-sort', col.text);
        b.type = 'button';
        const arrow = el('span', 't-sort__arrow');
        arrow.setAttribute('aria-hidden', 'true');
        b.appendChild(arrow);
        b.addEventListener('click', () => {
          sortDir = sortCol === i ? nextDir(sortDir) : 'asc';
          sortCol = sortDir === 'none' ? -1 : i;
          renderRows();
        });
        th.appendChild(b);
        hr.appendChild(th);
        ths[i] = th;
      });
      tbody = t.createTBody();
      tableBox.replaceChildren(t);
    }

    function clientRow(c) {
      const tr = document.createElement('tr');
      const name = tr.insertCell();
      name.className = 't-wrap';
      name.appendChild(el('span', 'admin-client', c.full_name || c.email || '—'));
      if (c.full_name && c.email) name.appendChild(el('span', 't-sub', c.email));

      const plan = tr.insertCell();
      if (c.plan_code) {
        plan.appendChild(el('span', null, c.plan_code));
        const sub = [c.plan_status, c.plan_ends ? 'ends ' + fmtDate(c.plan_ends) : ''].filter(Boolean).join(' · ');
        if (sub) plan.appendChild(el('span', 't-sub', sub));
      } else {
        plan.textContent = '—';
      }

      // Searches + the funnel for this client (0026): matched → confirmed (ticked or sent) → sent
      const runs = tr.insertCell();
      runs.appendChild(el('span', null, String(Number(c.runs) || 0)));
      runs.appendChild(el('span', 't-sub', (Number(c.matched) || 0) + ' matched'));
      runs.appendChild(el('span', 't-sub', (Number(c.confirmed) || 0) + ' confirmed · ' + (Number(c.sent) || 0) + ' sent'));

      const li = tr.insertCell();
      li.textContent = c.linkedin_connected ? 'Signed in' : c.linkedin_link ? 'Link added' : '—';
      if (c.linkedin_connected) li.title = 'Logs in with LinkedIn: the profile is confirmed as theirs';
      else if (c.linkedin_link) li.title = 'Only typed a LinkedIn link in Profile details; not confirmed by a LinkedIn sign-in';
      tr.insertCell().textContent = c.has_cv ? 'Yes' : '—';

      // Preferences filled: number + slim bar
      const pct = Math.max(0, Math.min(100, Number(c.prefs_pct) || 0));
      const wrap = el('span', 'pct');
      wrap.appendChild(el('span', 'pct__num', pct + '%'));
      const bar = el('span', 'pct__bar');
      bar.setAttribute('aria-hidden', 'true');
      const fill = el('span', 'pct__fill');
      fill.style.setProperty('--pct', pct + '%');
      bar.appendChild(fill);
      wrap.appendChild(bar);
      tr.insertCell().appendChild(wrap);

      // Unread: opens this client's chat (also with nothing unread, to write first)
      const unread = Number(c.unread) || 0;
      const b = el('button', 'admin-chat-btn', 'Chat');
      b.type = 'button';
      b.dataset.chat = c.user_id;
      b.dataset.focusKey = 'chat:' + c.user_id;
      b.setAttribute('aria-label', 'Chat with ' + nameOf(c) + (unread ? ', ' + unread + ' unread' : ''));
      if (unread) {
        const badge = el('span', 'chat-badge');
        paintBadge(badge, unread);
        b.appendChild(badge);
      }
      tr.insertCell().appendChild(b);

      tr.insertCell().textContent = fmtDate(c.signed_up);
      tr.insertCell().textContent = fmtDateTime(c.last_sign_in);
      return tr;
    }

    // Rebuilt on load, search, sort and live refresh; keyboard focus on a
    // Chat button survives the rebuild.
    function renderRows() {
      if (!tbody) buildTable();
      const q = search.value.trim().toLowerCase();
      const hit = (c) => !q || [c.full_name, c.email, c.plan_code].some((v) => v && String(v).toLowerCase().indexOf(q) !== -1);
      const key = sortCol < 0 ? null : COLS[sortCol].sort;
      const shown = clients.map((c, idx) => ({ c, idx })).filter((x) => hit(x.c))
        .sort((a, b) => (key ? compare(key(a.c), key(b.c), sortDir) : 0) || a.idx - b.idx);
      const keep = tbody.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
      tbody.replaceChildren();
      shown.forEach((x) => tbody.appendChild(clientRow(x.c)));
      if (!shown.length) {
        const td = tbody.insertRow().insertCell();
        td.colSpan = COLS.length;
        td.className = 'admin-none';
        td.textContent = clients.length ? 'No account matches this search.' : 'No accounts yet.';
      }
      ths.forEach((th, i) => th.setAttribute('aria-sort', i === sortCol ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'));
      countEl.textContent = q
        ? 'Showing ' + shown.length + ' of ' + clients.length
        : clients.length + (clients.length === 1 ? ' account' : ' accounts');
      if (keep) {
        const f = tbody.querySelector('[data-focus-key="' + keep + '"]');
        if (f) f.focus();
      }
    }
    search.addEventListener('input', renderRows);
    tableBox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-chat]');
      if (b) openConversation(b.dataset.chat, true);
    });

    // ---- conversation list: clients with messages, newest first (an opened
    // conversation without messages yet sits on top)
    const whenShort = (v) => (dayKey(v) === dayKey(new Date())
      ? fmtTime(v)
      : toDate(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));

    function paintConversations() {
      const last = (c) => (c.last_message_at ? stamp(c.last_message_at) : Number.MAX_SAFE_INTEGER);
      const list = clients.filter((c) => c.last_message_at || c.user_id === openId)
        .sort((a, b) => last(b) - last(a));
      const keep = convList.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
      convList.replaceChildren();
      list.forEach((c) => {
        const li = el('li');
        const b = el('button', 'conv');
        b.type = 'button';
        b.dataset.chat = c.user_id;
        b.dataset.focusKey = 'conv:' + c.user_id;
        if (c.user_id === openId) b.setAttribute('aria-current', 'true');
        const top = el('span', 'conv__top');
        top.appendChild(el('span', 'conv__name', nameOf(c)));
        top.appendChild(el('span', 'conv__time', c.last_message_at ? whenShort(c.last_message_at) : 'New'));
        b.appendChild(top);
        if (c.full_name && c.email) b.appendChild(el('span', 'conv__email', c.email));
        const unread = Number(c.unread) || 0;
        if (unread) {
          const badge = el('span', 'chat-badge');
          paintBadge(badge, unread);
          b.appendChild(badge);
        }
        li.appendChild(b);
        convList.appendChild(li);
      });
      convEmpty.hidden = list.length > 0;
      if (keep) {
        const f = convList.querySelector('[data-focus-key="' + keep + '"]');
        if (f) f.focus();
      }
    }

    function paintPane() {
      const c = clientOf(openId);
      paneTitle.textContent = openId ? nameOf(c) : 'Choose a conversation';
      paneSub.textContent = c && c.full_name && c.email ? c.email : '';
      paneSub.hidden = !paneSub.textContent;
    }

    // From the Clients table (focus → composer) or the conversation list.
    function openConversation(id, focusComposer) {
      if (id !== openId) {
        openId = id;
        chat.open(id);
      }
      selectTab(tab('messages'), false);
      paintPane();
      paintConversations();
      if (focusComposer) chat.focus();
      else if (window.matchMedia('(max-width: 767px)').matches) {
        // Stacked on phones: bring the chat into view under the list.
        pane.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }
    convList.addEventListener('click', (e) => {
      const b = e.target.closest('[data-chat]');
      if (b) openConversation(b.dataset.chat, false);
    });

    // ---- data: clients + unread total (also after every realtime event)
    async function loadClients() {
      const g = gen;
      const [list, total] = await Promise.all([
        call(db().rpc('career_admin_clients')),
        call(db().rpc('career_admin_unread')),
      ]);
      if (g !== gen) return;                       // signed out / switched meanwhile
      if (list.error) {
        if (list.error.code === '42501') { showDenied(); return; }   // no longer an admin
        if (!clients.length) tableBox.replaceChildren(el('p', 'account__hint', 'Could not load the accounts. Please reload the page.'));
        return;
      }
      clients = list.data || [];
      renderRows();
      paintConversations();
      paintPane();
      const sum = clients.reduce((acc, c) => acc + (Number(c.unread) || 0), 0);
      paintBadge(tabBadge, total.error ? sum : Number(total.data) || 0);
    }
    function refreshSoon() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(loadClients, 500);
    }

    // ---- live: one channel for all conversations (RLS lets admins read every row)
    function listen() {
      stopListening();
      channel = db().channel('career-admin-chat')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (p) => {
          if (p.new) chat.apply(p.new);
          refreshSoon();
        })
        .subscribe();
    }
    function stopListening() {
      if (channel) { db().removeChannel(channel); channel = null; }
    }

    // ---- Admins: list with Remove, and Add admin (career-admin-invite emails the link)
    const adminsBox  = $('#admins-table');
    const adminsNote = $('#admins-status');
    const adminsH    = $('#admins-h');
    const addForm    = $('#admin-add');
    const addInput   = $('#admin-add-email');
    const addBtn     = $('#admin-add-btn');
    const addNote    = $('#admin-add-status');
    const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;   // same check as the invite function

    async function loadAdmins() {
      const g = gen;
      const { data, error } = await call(db().rpc('career_admin_list'));
      if (g !== gen) return;
      if (error) {
        adminsBox.replaceChildren(el('p', 'account__hint', 'Could not load the admin list. Please reload the page.'));
        return;
      }
      const t = el('table', 'account-table account-table--admins');
      t.appendChild(el('caption', 'visually-hidden', 'Career-service admins'));
      const hr = t.createTHead().insertRow();
      ['Email', 'Added by', 'Added', 'Remove'].forEach((h, i) => {
        const th = document.createElement('th');
        th.scope = 'col';
        if (i === 3) th.appendChild(el('span', 'visually-hidden', h));
        else th.textContent = h;
        hr.appendChild(th);
      });
      const tb = t.createTBody();
      (data || []).forEach((a) => {
        const tr = tb.insertRow();
        const mail = tr.insertCell();
        mail.className = 't-wrap';
        mail.textContent = a.email;
        if (me && a.email === me.email) mail.appendChild(el('span', 't-sub', 'You'));
        tr.insertCell().textContent = a.added_by || '—';
        tr.insertCell().textContent = fmtDate(a.added_at);
        const b = el('button', 'btn btn-sm account__quiet account__delete', 'Remove');
        b.type = 'button';
        b.dataset.remove = a.email;
        b.setAttribute('aria-label', 'Remove ' + a.email);
        tr.insertCell().appendChild(b);
      });
      adminsBox.replaceChildren(t);
    }

    adminsBox.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-remove]');
      if (!b || !me) return;
      const email = b.dataset.remove;
      const self = email === me.email;
      if (!window.confirm(self
        ? 'Remove yourself as an admin? You will lose access to this page.'
        : 'Remove ' + email + ' as an admin?')) return;
      b.disabled = true;
      note(adminsNote, 'busy', 'Removing…');
      const { error } = await call(db().rpc('career_admin_remove', { p_email: email }));
      if (error) {
        b.disabled = false;
        b.focus();
        note(adminsNote, 'error', /last admin/i.test(error.message || '')
          ? 'The last admin cannot be removed. Add another admin first.'
          : 'Could not remove ' + email + '. Please try again.');
        return;
      }
      note(adminsNote, 'ok', email + ' is no longer an admin.');
      if (self) { delete adminCache[me.id]; enter(session); return; }   // shows "No access" now
      await loadAdmins();
      adminsH.focus();
    });

    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (addBtn.getAttribute('aria-disabled') === 'true') return;
      const email = addInput.value.trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 254) {
        note(addNote, 'error', 'Enter a valid email address.');
        addInput.focus();
        return;
      }
      addBtn.setAttribute('aria-disabled', 'true');
      note(addNote, 'busy', 'Adding…');
      // functions.invoke sends the signed-in user's token (Authorization) and
      // the publishable key (apikey), JSON body — as the function expects.
      const { data, error } = await call(db().functions.invoke('career-admin-invite', { body: { email } }));
      addBtn.removeAttribute('aria-disabled');
      if (error || !data || !data.ok) {
        let msg = (data && data.error && data.error.message) || 'Could not add the admin. Please try again.';
        try {
          const body = error && error.context && typeof error.context.json === 'function' && await error.context.json();
          if (body && body.error && body.error.message) msg = body.error.message;
        } catch (_e) { /* keep the plain message */ }
        note(addNote, 'error', msg);
        return;
      }
      note(addNote, 'ok', !data.added ? 'Already an admin.'
        : data.emailed ? 'Added — invitation email sent.'
        : 'Added — but the invitation email could not be sent. Send them the link yourself: https://solvephantasma.com/admin.html');
      addInput.value = '';
      loadAdmins();
    });

    // ---- who is looking: signed out / not an admin / admin
    function showDenied(text) {
      stopListening();
      checking.hidden = true;
      panel.hidden = true;
      roleSw.hidden = true;
      deniedTxt.textContent = text || 'No access. This page is only for the career-service admins.';
      denied.hidden = false;
    }

    async function enter(s) {
      session = s;
      const g = ++gen;
      stopListening();
      clearTimeout(refreshTimer);
      me = s ? { id: s.user.id, email: (s.user.email || '').toLowerCase() } : null;
      clients = [];
      openId = null;
      tbody = null;
      chat.open(null);
      signedOut.hidden = !!s;
      who.hidden = !s;
      whoEmail.textContent = s ? s.user.email || '' : '';
      panel.hidden = true;
      denied.hidden = true;
      roleSw.hidden = true;
      checking.hidden = !s;
      if (!s) return;
      let ok = false;
      try {
        ok = await checkAdmin(s);
      } catch (_e) {
        if (g === gen) showDenied('Could not check your access. Please reload the page.');
        return;
      }
      if (g !== gen) return;
      checking.hidden = true;
      if (!ok) { showDenied(); return; }
      panel.hidden = false;
      roleSw.hidden = false;
      tableBox.replaceChildren(el('p', 'account__hint', 'Loading accounts…'));
      adminsBox.replaceChildren(el('p', 'account__hint', 'Loading…'));
      paintPane();
      paintConversations();
      selectTab(tab(location.hash.slice(1)) || tab('clients'), false);
      loadClients();
      loadAdmins();
      listen();
    }
    watchSession(enter);

    document.addEventListener('visibilitychange', () => {
      if (!me || panel.hidden || document.visibilityState !== 'visible') return;
      refreshSoon();
      chat.sync();
      chat.markReadSoon();
    });
  }

  function init() {
    if (!window.PhantasmaAuth) return;             // script.js missing or older than this file
    bootRoleSwitch();
    bootAdminPanel();
    bootClientChat();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
