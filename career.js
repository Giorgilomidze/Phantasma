/* =========================================================================
   PHANTASMA — career.js
   Career service (Personal Career Strategist): the admin panel and the chat
   between each client and the Phantasma team. Loaded after script.js on
   account.html, preferences.html and admin.html; since 11 Nov 2026 also on
   the Tender Portal pages (tenders/*.html, <body data-chat="tenders">), which
   hand over their own Supabase client as window.PhantasmaAuth.

     1. Helpers         — dates, sorting, badges, session watcher
     1b. Files          — pictures and documents in chat + feedback (11 Nov 2026)
     2. Chat component  — one conversation: history, composer, edit/delete,
                          emoji, files. Used by the client window AND the admin pane.
     2b. Feedback       — the Feedback view of the client window (7 Nov 2026)
     3. Client | Admin  — the switch on account.html (admins only)
     4. Client chat     — round button + floating window with the switch
                          Messages | Feedback (account.html, preferences.html,
                          the tender pages; signed in only)
     5. Admin panel     — admin.html: Clients / Messages / Feedback / Admins tabs

   Supabase is reached through the client script.js already holds
   (window.PhantasmaAuth, set at the end of script.js). Backend contract:
   supabase/0024-career-admin-chat.sql,
   supabase/functions/career-admin-invite/index.ts, (feedback)
   supabase/0030-start-matching-feedback.sql and (files + the service a
   message came from) supabase/0035-chat-files-service.sql. The database
   checks every call itself (RLS + is_career_admin()), so what this file shows
   or hides is convenience, not security. Message text only ever goes in via
   textContent. Until 0030 is run, the feedback parts only say they are not
   available yet; until 0035 is run, everything works as before and the
   paper-clip button says sending files is not switched on yet.
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
    clip: ['M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'],
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

  // Unread count in a red pill, plus " unread" (or `word`) for screen readers.
  function paintBadge(badge, n, word) {
    if (!badge) return;
    badge.replaceChildren();
    badge.hidden = !(n > 0);
    if (!(n > 0)) return;
    badge.appendChild(document.createTextNode(n > 99 ? '99+' : String(n)));
    badge.appendChild(el('span', 'visually-hidden', ' ' + (word || 'unread')));
  }

  // PostgREST's answer for a table / function that is not there yet
  // (a migration not run): the new parts then say "not available yet".
  const isMissing = (err) => !!err && (['42P01', '42883', 'PGRST202', 'PGRST205'].indexOf(err.code) !== -1
    || /does not exist|schema cache|could not find/i.test(err.message || ''));

  // The Georgian calendar day of a moment (Asia/Tbilisi): the daily feedback
  // limit counts by it, as the server does. Only compared for equality.
  let tbilisiFmt = null;
  function tbilisiDay(v) {
    const d = v instanceof Date ? v : toDate(v);
    if (!d) return '';
    try {
      tbilisiFmt = tbilisiFmt || new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit' });
      return tbilisiFmt.format(d);
    } catch (_e) {
      return new Date(d.getTime() + 4 * 3600000).toISOString().slice(0, 10);   // UTC+4, no summer time
    }
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

  // Which service this page belongs to (11 Nov 2026): the job-search pages say
  // nothing ('career'); the Tender Portal pages carry <body data-chat="tenders">.
  // Stored with every message and feedback request (0035), so the admin panel
  // can tell them apart. One conversation per person across the services.
  const SERVICE = (document.body && document.body.getAttribute('data-chat')) || 'career';
  const SERVICE_NAMES = { career: 'Job search', tenders: 'Tenders' };
  const serviceName = (k) => SERVICE_NAMES[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : '');
  function serviceTag(k) {
    const t = el('span', 'chat-svc', serviceName(k));
    t.dataset.service = k || '';
    return t;
  }

  /* ---------------------------------------------------------------------
     1b. Files (11 Nov 2026, supabase/0035): pictures and documents in the
     chat and in feedback. Private bucket chat-files, path <client id>/<file>
     (a reply from the team goes into the client's folder). At most 5 files of
     10 MB at once: pictures, PDF, Word, Excel, PowerPoint, text and CSV.
     Pictures show as thumbnails (signed links, an hour), other files as a
     chip with name and size; a click asks for a fresh signed link: pictures
     and PDFs open in a new tab, the rest downloads under its own name.
     createPicker(say, text) = the paper-clip button, a hidden file input and
     the tray of chosen files (with ✕); pasted and dropped files go in too.
     --------------------------------------------------------------------- */
  const FILES_BUCKET = 'chat-files';
  const FILES_MAX = 5;
  const FILE_MB = 10;
  const FILE_TYPES = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain', csv: 'text/csv',
  };
  const FILE_ACCEPT = Object.keys(FILE_TYPES).map((x) => '.' + x).join(',');
  const FILES_OFF = 'Sending files is not switched on yet. Please try again later.';
  const extOf = (name) => { const m = /\.([a-z0-9]{1,5})$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; };
  const isPicture = (f) => /^image\//.test((f && f.type) || '');
  // The files of a message / request row ([] before 0035, and once deleted).
  const filesOf = (r) => (r && !r.deleted_at && Array.isArray(r.attachments) ? r.attachments : []);
  function fmtSize(n) {
    if (!(n >= 0)) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
  }
  // The type the bucket allows, from the file name (browsers report CSV and
  // some Office files differently); '' = not allowed.
  function typeOf(file) {
    const byExt = FILE_TYPES[extOf(file.name)];
    if (byExt) return byExt;
    const k = Object.keys(FILE_TYPES).find((x) => FILE_TYPES[x] === file.type);
    return k ? FILE_TYPES[k] : '';
  }

  // Is 0035 run (columns service + attachments, bucket chat-files)? Asked once
  // per page; a network hiccup is asked again next time. filesOn: null = not
  // known yet, then true / false.
  let filesOn = null;
  let filesAsk = null;
  function hasFiles() {
    if (!filesAsk) {
      filesAsk = call(db().from('chat_messages').select('id, service, attachments').limit(1)).then(({ error }) => {
        if (error && (error.code === '42703' || /does not exist/i.test(error.message || ''))) filesOn = false;
        else if (error && (!error.code || error.code === '42501')) { filesAsk = null; return filesOn !== false; }
        else filesOn = true;
        return filesOn;
      });
    }
    return filesAsk;
  }

  // Storage key: <folder>/<time>-<random>-<name in plain letters>. The real
  // name (Georgian too) is kept in the message row.
  function storageKey(folder, name) {
    const ext = extOf(name);
    const base = String(name || '').replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/_+/g, '_').replace(/^[_.-]+|[_.-]+$/g, '').slice(0, 60) || 'file';
    const t = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    return folder + '/' + t + '-' + Math.random().toString(36).slice(2, 8) + '-' + base + (ext ? '.' + ext : '');
  }
  // Uploads the chosen files into `folder`; on a failure removes what went up and throws.
  async function uploadFiles(folder, picked) {
    const done = [];
    for (let i = 0; i < picked.length; i += 1) {
      const f = picked[i];
      const path = storageKey(folder, f.name);
      const { error } = await call(db().storage.from(FILES_BUCKET).upload(path, f.file, { contentType: f.type, upsert: false }));
      if (error) { removeFiles(done.map((d) => d.path)); throw error; }
      done.push({ path, name: f.name.slice(0, 200), type: f.type, size: f.file.size });
    }
    return done;
  }
  function removeFiles(paths) {
    if (paths && paths.length) call(db().storage.from(FILES_BUCKET).remove(paths));
  }
  function uploadError(err) {
    const m = String((err && (err.message || err.error)) || '');
    if (/size|large|exceed/i.test(m)) return 'A file is larger than ' + FILE_MB + ' MB.';
    if (/mime|type/i.test(m)) return 'This kind of file cannot be sent.';
    return 'The file could not be uploaded. Please try again.';
  }

  // Thumbnails: signed links for an hour, kept per path.
  const signedThumbs = new Map();                  // path -> { url, until }
  async function thumbUrls(paths) {
    const now = Date.now();
    const need = paths.filter((p) => !(signedThumbs.has(p) && signedThumbs.get(p).until > now + 60000));
    if (need.length) {
      const { data } = await call(db().storage.from(FILES_BUCKET).createSignedUrls(need, 3600));
      (data || []).forEach((d) => { if (d && d.path && d.signedUrl) signedThumbs.set(d.path, { url: d.signedUrl, until: now + 3500000 }); });
    }
    return paths.map((p) => (signedThumbs.get(p) || {}).url || null);
  }
  // Gives the pictures under `root` that wait for an address their signed link.
  function fillThumbs(root) {
    const imgs = Array.from(root.querySelectorAll('img.chat-file__img[data-pending]'));
    if (!imgs.length) return;
    imgs.forEach((img) => img.removeAttribute('data-pending'));
    thumbUrls(imgs.map((img) => img.dataset.path)).then((urls) => {
      imgs.forEach((img, i) => {
        if (urls[i]) img.src = urls[i];
        else img.closest('.chat-file').classList.add('is-broken');
      });
    });
  }

  // The files of one message or request: thumbnails for pictures, a chip for the rest.
  function filesBlock(list) {
    const box = el('ul', 'chat-files');
    box.setAttribute('aria-label', list.length === 1 ? 'Attached file' : 'Attached files');
    list.forEach((f) => {
      const li = el('li');
      const pic = isPicture(f);
      const a = el('a', 'chat-file' + (pic ? ' chat-file--pic' : ''));
      a.href = '#';
      a.dataset.path = f.path;
      a.dataset.name = f.name || '';
      if (pic || f.type === 'application/pdf') a.dataset.inline = '1';
      if (pic) {
        const img = el('img', 'chat-file__img');
        img.alt = f.name || 'Picture';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.dataset.path = f.path;
        img.dataset.pending = '1';
        a.appendChild(img);
        a.title = 'Open ' + (f.name || 'the picture');
      } else {
        a.appendChild(el('span', 'chat-file__ext', (extOf(f.name) || 'file').toUpperCase()));
        const txt = el('span', 'chat-file__txt');
        txt.appendChild(el('span', 'chat-file__name', f.name || 'File'));
        if (f.size) txt.appendChild(el('span', 'chat-file__size', fmtSize(f.size)));
        a.appendChild(txt);
        a.title = (a.dataset.inline ? 'Open ' : 'Download ') + (f.name || 'the file');
      }
      li.appendChild(a);
      box.appendChild(li);
    });
    return box;
  }

  // A click on a file: a fresh signed link (10 minutes). The new tab opens
  // inside the click (so no pop-up blocker) and goes to the file once the link is there.
  async function openFile(a) {
    const inline = a.dataset.inline === '1';
    const w = inline ? window.open('', '_blank') : null;
    if (w) { try { w.opener = null; } catch (_e) { /* not allowed: fine */ } }
    const { data, error } = await call(db().storage.from(FILES_BUCKET)
      .createSignedUrl(a.dataset.path, 600, inline ? undefined : { download: a.dataset.name || true }));
    if (error || !data || !data.signedUrl) {
      if (w) w.close();
      a.classList.add('is-broken');
      a.title = 'This file could not be opened. It may have been removed.';
      return;
    }
    if (w) { w.location.href = data.signedUrl; return; }
    const t = document.createElement('a');
    t.href = data.signedUrl;
    t.rel = 'noopener';
    document.body.appendChild(t);
    t.click();
    t.remove();
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest ? e.target.closest('a.chat-file[data-path]') : null;
    if (!a) return;
    e.preventDefault();
    openFile(a);
  });

  // A pasted picture (a screenshot) becomes a file; text with a picture (from
  // Word, a web page) pastes as text.
  function pastedFiles(e) {
    const dt = e.clipboardData;
    if (!dt || !dt.files || !dt.files.length || dt.getData('text/plain')) return [];
    return Array.from(dt.files);
  }

  let pickerCount = 0;
  function createPicker(say, text) {
    const n = ++pickerCount;
    let picked = [];                               // [{ file, name, type, url }]
    const btn = el('button', text ? 'fb__attach' : 'chat__icon-btn chat__attach');
    btn.type = 'button';
    btn.title = 'Attach pictures or files (up to ' + FILES_MAX + ', ' + FILE_MB + ' MB each)';
    btn.appendChild(icon('clip'));
    if (text) btn.appendChild(el('span', null, text));
    else btn.setAttribute('aria-label', 'Attach pictures or files');
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = FILE_ACCEPT;
    input.hidden = true;
    input.tabIndex = -1;
    input.id = 'chat-file-' + n;
    const tray = el('ul', 'chat-tray');
    tray.setAttribute('aria-label', 'Files to send');
    tray.hidden = true;

    function paint() {
      tray.replaceChildren();
      picked.forEach((p, i) => {
        const li = el('li', 'chat-tray__item');
        if (p.url) {
          const img = el('img', 'chat-tray__thumb');
          img.src = p.url;
          img.alt = '';
          li.appendChild(img);
        } else {
          li.appendChild(el('span', 'chat-file__ext', (extOf(p.name) || 'file').toUpperCase()));
        }
        li.appendChild(el('span', 'chat-tray__name', p.name));
        li.appendChild(el('span', 'chat-tray__size', fmtSize(p.file.size)));
        const x = el('button', 'chat-tray__x');
        x.type = 'button';
        x.dataset.i = String(i);
        x.title = 'Remove';
        x.setAttribute('aria-label', 'Remove ' + p.name);
        x.appendChild(icon('close'));
        li.appendChild(x);
        tray.appendChild(li);
      });
      tray.hidden = !picked.length;
    }
    function add(list, pasted) {
      if (filesOn === false) { say(FILES_OFF); return; }
      const refused = [];
      Array.from(list || []).forEach((file) => {
        const type = typeOf(file);
        let name = file.name || 'file';
        if (pasted && /^image\.[a-z]+$/i.test(name)) {
          name = 'Picture ' + new Date().toTimeString().slice(0, 8).replace(/:/g, '.') + '.' + (extOf(name) || 'png');
        }
        if (!type) refused.push(name + ': this kind of file cannot be sent');
        else if (!file.size) refused.push(name + ': the file is empty');
        else if (file.size > FILE_MB * 1048576) refused.push(name + ': larger than ' + FILE_MB + ' MB');
        else if (picked.length >= FILES_MAX) refused.push(name + ': at most ' + FILES_MAX + ' files at once');
        else picked.push({ file, name, type, url: /^image\//.test(type) && window.URL ? URL.createObjectURL(file) : '' });
      });
      say(refused.join(' · '));
      paint();
    }
    function clear() {
      picked.forEach((p) => { if (p.url) URL.revokeObjectURL(p.url); });
      picked = [];
      input.value = '';
      paint();
    }
    btn.addEventListener('click', () => {
      if (filesOn === false) { say(FILES_OFF); return; }
      input.click();
    });
    input.addEventListener('change', () => { add(input.files); input.value = ''; });
    tray.addEventListener('click', (e) => {
      const x = e.target.closest('.chat-tray__x');
      if (!x || x.disabled) return;
      const i = Number(x.dataset.i);
      const p = picked[i];
      if (p && p.url) URL.revokeObjectURL(p.url);
      picked.splice(i, 1);
      paint();
      const next = tray.querySelector('.chat-tray__x[data-i="' + Math.min(i, picked.length - 1) + '"]');
      (next || btn).focus();
    });

    // Files dropped anywhere on `zone`.
    function dropZone(zone) {
      let depth = 0;
      const withFiles = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') !== -1;
      zone.addEventListener('dragenter', (e) => {
        if (!withFiles(e)) return;
        e.preventDefault();
        depth += 1;
        zone.classList.add('is-dropping');
      });
      zone.addEventListener('dragover', (e) => { if (withFiles(e)) e.preventDefault(); });
      zone.addEventListener('dragleave', () => {
        depth = Math.max(0, depth - 1);
        if (!depth) zone.classList.remove('is-dropping');
      });
      zone.addEventListener('drop', (e) => {
        if (!withFiles(e)) return;
        e.preventDefault();
        depth = 0;
        zone.classList.remove('is-dropping');
        add(e.dataTransfer.files);
      });
    }

    return {
      btn,
      input,
      tray,
      add,
      clear,
      dropZone,
      files: () => picked.slice(),
      setBusy(on) {
        btn.disabled = on;
        tray.querySelectorAll('button').forEach((b) => { b.disabled = on; });
      },
    };
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
     Files (section 1b): the paper-clip next to the emoji button, pasted
     pictures and files dropped on the conversation go into a tray above the
     message box; Send uploads them into the client's folder first. In the
     admin pane every client message shows the service it came from.
     --------------------------------------------------------------------- */
  const MSG_COLS = 'id, client_id, sender_id, from_admin, body, created_at, edited_at, deleted_at, read_at';
  const MSG_COLS_FILES = MSG_COLS + ', service, attachments';   // after 0035
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
    const picker = createPicker(say);
    form.append(emojiBtn, picker.btn, grid, picker.tray, label, input, sendBtn, picker.input, status);
    if (!touchOnly) form.appendChild(el('p', 'chat__hint', 'Enter sends · Shift+Enter adds a new line · paste or drop pictures and files'));
    root.append(empty, log, live, form);
    host.appendChild(root);
    picker.dropZone(root);
    input.addEventListener('paste', (e) => {
      const files = pastedFiles(e);
      if (!files.length) return;
      e.preventDefault();
      picker.add(files, true);
    });

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
      const files = filesOf(r);
      if (r.deleted_at || r.body || !files.length) {
        bubble.appendChild(el('p', 'chat-msg__text', r.deleted_at ? 'Message deleted' : r.body));
      }
      if (files.length) bubble.appendChild(filesBlock(files));
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
      // Admin pane: where the client wrote from (job search, tenders …).
      if (opts.isAdmin && !r.from_admin && r.service) meta.appendChild(serviceTag(r.service));
      bubble.appendChild(meta);
      li.appendChild(bubble);
      if (files.length) fillThumbs(li);
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
        const changed = old.body !== row.body || old.edited_at !== row.edited_at || old.deleted_at !== row.deleted_at
          || filesOf(old).length !== filesOf(row).length;
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
        const n = filesOf(row).length;
        announce('New message from ' + whoOf(row) + ': ' + (row.body || (n === 1 ? 'a file' : n + ' files')));
        markReadSoon();
      }
    }

    async function fetchHistory(id) {
      const cols = (await hasFiles()) ? MSG_COLS_FILES : MSG_COLS;
      return call(db().from('chat_messages').select(cols)
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
      picker.clear();
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

    // ---- send: files go up first (into the client's folder), then the message
    // that lists them; if the message fails, the uploaded files are removed again.
    async function send() {
      const body = input.value.trim();
      const picked = picker.files();
      if (sending || !clientId) return;
      if (!body && !picked.length) { input.focus(); return; }
      const id = clientId;
      sending = true;
      sendBtn.setAttribute('aria-disabled', 'true');
      picker.setBusy(true);
      say(picked.length ? (picked.length === 1 ? 'Sending the file…' : 'Sending ' + picked.length + ' files…') : '');
      const done = (text) => {
        sending = false;
        sendBtn.removeAttribute('aria-disabled');
        picker.setBusy(false);
        say(text);
      };
      let files = [];
      if (picked.length) {
        if (!(await hasFiles())) { done(FILES_OFF); return; }
        try {
          files = await uploadFiles(id, picked);
        } catch (err) {
          done(uploadError(err));
          return;
        }
      }
      const args = { p_client: opts.isAdmin ? id : null, p_body: body };
      if (filesOn) {                               // 0035 run: the service and the files go along
        args.p_service = opts.isAdmin ? null : SERVICE;
        args.p_attachments = files;
      }
      const { data, error } = await call(db().rpc('chat_send', args));
      if (error) {
        removeFiles(files.map((f) => f.path));
        const m = String(error.message || '');
        done(/too many messages/i.test(m) ? 'That is a lot of messages in one minute. Please wait a moment.'
          : /bad_file|too_many_files/.test(m) ? 'The files could not be attached. Please try again.'
          : 'Could not send. Please try again.');
        return;
      }
      done('');
      if (id !== clientId) return;                 // another conversation was opened meanwhile
      input.value = '';
      autosize(input);
      picker.clear();
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
      if (!body && !filesOf(r).length) { say('A message cannot be empty. Use Delete to remove it.'); cur.ta.focus(); return; }
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
      removeFiles(filesOf(rows.get(id)).map((f) => f.path));   // own uploads: the bucket lets the sender remove them
      const row = Object.assign({}, rows.get(id), { body: '', attachments: [], deleted_at: new Date().toISOString() });
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
     2b. Feedback component (7 Nov 2026, D-30 version 1): the Feedback view
     of the client window. What it is about (Feedback / Feature request /
     Problem with the platform; at least one), a message of at most 500
     characters with a counter, Send; at most 3 a day, counted by the
     Georgian day. Since 11 Nov 2026 (0035) up to 5 pictures or files go
     along (section 1b), and the service the page belongs to. send_feedback()
     checks all of it again. Below, the person's own requests, newest first,
     as chat bubbles: types, text, files, date, status, and the team's note
     when there is one. Until 0030 is run the view only says it is not
     available yet.
     createFeedback(host) draws into `host` and returns
       { open(userId|null), show(), focus() }:
       open  — set / clear the person (nothing is loaded yet)
       show  — the view came on screen: (re)load the person's requests
     --------------------------------------------------------------------- */
  const FB_KINDS = [['feedback', 'Feedback'], ['feature', 'Feature request'], ['problem', 'Problem with the platform']];
  const FB_STATUS = [['new', 'New'], ['reviewed', 'Reviewed'], ['planned', 'Planned'], ['done', 'Done'], ['wont_do', "Won't do"]];
  const toMap = (pairs) => pairs.reduce((o, [k, v]) => { o[k] = v; return o; }, {});
  const FB_KIND_TEXT = toMap(FB_KINDS);
  const FB_STATUS_TEXT = toMap(FB_STATUS);
  const fbKinds = (list) => (list || []).map((k) => FB_KIND_TEXT[k] || k).join(', ');
  const FB_MAX = 500;                              // feedback.message limit
  const FB_PER_DAY = 3;                            // per Georgian day
  const FB_COLS = 'id, kinds, message, status, admin_note, created_at';
  const FB_COLS_FILES = FB_COLS + ', service, attachments';   // after 0035
  const FB_OFF = 'Feedback is not available yet. Please try again later.';
  let fbCount = 0;

  function createFeedback(host) {
    const n = ++fbCount;
    let uid = null;
    let rows = null;                               // own requests, newest first; null = not loaded
    let loadToken = 0;
    let sending = false;

    // ---- DOM
    const root = el('div', 'fb');
    const off = el('p', 'fb__off', FB_OFF);
    off.hidden = true;
    const form = el('form', 'fb__form');
    form.noValidate = true;
    const kinds = el('fieldset', 'fb__kinds');
    kinds.appendChild(el('legend', 'fb__legend', 'What is it about? Tick one or more.'));
    const chips = el('div', 'fb__chips');
    const boxes = FB_KINDS.map(([value, text]) => {
      const lab = el('label', 'fb-kind');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = 'kind';
      cb.value = value;
      lab.append(cb, el('span', null, text));
      chips.appendChild(lab);
      return cb;
    });
    kinds.appendChild(chips);
    const label = el('label', 'fb__label', 'Your message');
    label.htmlFor = 'fb-text-' + n;
    const ta = el('textarea', 'chat__input fb__text');
    ta.id = 'fb-text-' + n;
    ta.rows = 4;
    ta.maxLength = FB_MAX;
    const bar = el('div', 'fb__bar');
    const counter = el('span', 'fb__counter');
    counter.id = 'fb-counter-' + n;
    const left = el('span', 'fb__left');
    left.id = 'fb-left-' + n;
    left.hidden = true;
    ta.setAttribute('aria-describedby', counter.id + ' ' + left.id);
    const sendBtn = el('button', 'btn btn-primary btn-sm fb__send', 'Send');
    sendBtn.type = 'submit';
    bar.append(counter, left, sendBtn);
    const status = el('p', 'fb__status');
    status.setAttribute('role', 'status');
    status.hidden = true;
    // Files: a text button under the message, the tray of chosen files under it.
    const picker = createPicker((text) => say(text ? 'error' : '', text), 'Add pictures or files');
    const fileRow = el('div', 'fb__files');
    fileRow.append(picker.btn, el('span', 'fb__files-hint', 'Up to ' + FILES_MAX + ', ' + FILE_MB + ' MB each. You can also paste a screenshot.'));
    form.append(kinds, label, ta, fileRow, picker.tray, picker.input, bar, status);
    picker.dropZone(form);
    ta.addEventListener('paste', (e) => {
      const files = pastedFiles(e);
      if (!files.length) return;
      e.preventDefault();
      picker.add(files, true);
    });
    const listH = el('h3', 'fb__h', 'Your requests');
    listH.id = 'fb-h-' + n;
    const empty = el('p', 'fb__empty');
    const list = el('ol', 'fb__list');
    list.setAttribute('aria-labelledby', listH.id);
    list.hidden = true;
    root.append(off, form, listH, empty, list);
    host.appendChild(root);

    function say(kind, text) {
      status.textContent = text || '';
      status.dataset.kind = kind || '';
      status.hidden = !text;
    }
    function paintCounter() {
      const len = ta.value.length;
      counter.textContent = len + ' / ' + FB_MAX;
      counter.classList.toggle('is-full', len >= FB_MAX);
    }
    // Requests left today; null while the person's list is unknown.
    function leftToday() {
      if (!rows) return null;
      const today = tbilisiDay(new Date());
      return Math.max(0, FB_PER_DAY - rows.filter((r) => tbilisiDay(r.created_at) === today).length);
    }
    function paintLeft() {
      const k = leftToday();
      left.hidden = k == null;
      left.textContent = k == null ? '' : k + ' of ' + FB_PER_DAY + ' left today';
      if (sending || k === 0) sendBtn.setAttribute('aria-disabled', 'true');
      else sendBtn.removeAttribute('aria-disabled');
    }
    // 0030 not run: the note instead of the form and the list.
    function setOff(on) {
      off.hidden = !on;
      form.hidden = on;
      listH.hidden = on;
      if (on) { empty.hidden = true; list.hidden = true; }
    }

    // One request: the person's own bubble on the right (as in the chat),
    // the team's note as a reply on the left.
    function itemFor(r, manyServices) {
      const li = el('li', 'fb-item');
      const own = el('div', 'chat-msg chat-msg--right');
      const bubble = el('div', 'chat-msg__bubble');
      bubble.appendChild(el('p', 'fb-item__kinds', fbKinds(r.kinds)));
      bubble.appendChild(el('p', 'chat-msg__text', r.message));
      const files = filesOf(r);
      if (files.length) bubble.appendChild(filesBlock(files));
      const meta = el('p', 'chat-msg__meta');
      const time = el('time', null, fmtDateTime(r.created_at));
      time.dateTime = r.created_at;
      meta.appendChild(time);
      if (manyServices && r.service) meta.appendChild(serviceTag(r.service));   // sent from job search and tenders
      const st = el('span', 'fb-status');
      st.dataset.status = r.status || '';
      st.appendChild(el('span', 'visually-hidden', 'Status: '));
      st.appendChild(document.createTextNode(FB_STATUS_TEXT[r.status] || r.status || ''));
      meta.appendChild(st);
      bubble.appendChild(meta);
      own.appendChild(bubble);
      li.appendChild(own);
      if (r.admin_note) {
        const reply = el('div', 'chat-msg');
        reply.appendChild(el('p', 'chat-msg__who', 'Phantasma team'));
        const b = el('div', 'chat-msg__bubble');
        b.appendChild(el('p', 'chat-msg__text', r.admin_note));
        reply.appendChild(b);
        li.appendChild(reply);
      }
      return li;
    }
    function renderList() {
      list.replaceChildren();
      const many = new Set((rows || []).map((r) => r.service || 'career')).size > 1;
      (rows || []).forEach((r) => list.appendChild(itemFor(r, many)));
      fillThumbs(list);
      list.hidden = !(rows && rows.length);
      empty.hidden = !list.hidden;
      if (rows && !rows.length) empty.textContent = 'Nothing sent yet. Your requests and our answers appear here.';
    }

    async function load() {
      if (!uid) return;
      const token = ++loadToken;
      const who = uid;
      if (!rows) { empty.textContent = 'Loading…'; empty.hidden = false; list.hidden = true; }
      // Admins may read everyone's rows (RLS), so the filter is needed here.
      const cols = (await hasFiles()) ? FB_COLS_FILES : FB_COLS;
      if (token !== loadToken || who !== uid) return;
      const { data, error } = await call(db().from('feedback').select(cols)
        .eq('user_id', who).order('created_at', { ascending: false }).limit(50));
      if (token !== loadToken || who !== uid) return;
      if (error) {
        if (isMissing(error)) { setOff(true); return; }
        if (!rows) empty.textContent = 'Could not load your requests. Please try again later.';
        return;
      }
      setOff(false);
      rows = data || [];
      renderList();
      paintLeft();
    }

    async function send() {
      if (sending || !uid) return;
      const picked = boxes.filter((b) => b.checked).map((b) => b.value);
      const text = ta.value.trim();
      const chosen = picker.files();
      if (leftToday() === 0) { say('error', 'You have sent ' + FB_PER_DAY + ' today. You can send more tomorrow.'); return; }
      if (!picked.length) { say('error', 'Tick at least one: Feedback, Feature request or Problem with the platform.'); boxes[0].focus(); return; }
      if (!text) { say('error', 'Please write your message first.'); ta.focus(); return; }
      if (text.length > FB_MAX) { say('error', 'Please keep it to ' + FB_MAX + ' characters.'); ta.focus(); return; }
      const who = uid;
      sending = true;
      sendBtn.setAttribute('aria-disabled', 'true');
      picker.setBusy(true);
      say('busy', chosen.length ? 'Sending, with ' + (chosen.length === 1 ? 'the file' : chosen.length + ' files') + '…' : 'Sending…');
      const stop = (text2) => {
        sending = false;
        picker.setBusy(false);
        say('error', text2);
        paintLeft();
      };
      // Files first, into the person's own folder (removed again if the request fails).
      let files = [];
      if (chosen.length) {
        if (!(await hasFiles())) { if (who === uid) stop(FILES_OFF); return; }
        try {
          files = await uploadFiles(who, chosen);
        } catch (err) {
          if (who === uid) stop(uploadError(err));
          return;
        }
      }
      const args = { p_kinds: picked, p_message: text };
      if (filesOn) { args.p_service = SERVICE; args.p_attachments = files; }
      const { data, error } = await call(db().rpc('send_feedback', args));
      if (error) removeFiles(files.map((f) => f.path));
      if (who !== uid) return;                     // signed out meanwhile
      sending = false;
      picker.setBusy(false);
      if (error) {
        const m = String(error.message || '');
        say('error', /daily_limit/.test(m) ? 'You have sent ' + FB_PER_DAY + ' today. You can send more tomorrow.'
          : /too_long/.test(m) ? 'Please keep it to ' + FB_MAX + ' characters.'
          : /no_kind/.test(m) ? 'Tick at least one: Feedback, Feature request or Problem with the platform.'
          : /not_signed_in/.test(m) ? 'Please log in again.'
          : /bad_file|too_many_files/.test(m) ? 'The files could not be attached. Please try again.'
          : isMissing(error) ? FB_OFF
          : 'Could not send. Please try again.');
        if (/daily_limit/.test(m)) load();         // e.g. sent from another device: recount
        paintLeft();
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      ta.value = '';
      boxes.forEach((b) => { b.checked = false; });
      picker.clear();
      paintCounter();
      if (rows && row && row.id != null) {
        if (!rows.some((r) => r.id === row.id)) rows.unshift(row);
        renderList();
      } else {
        load();                                    // the list was not there: fetch it now
      }
      paintLeft();
      say('ok', 'Thank you, sent. You can follow it below.');
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
    ta.addEventListener('input', paintCounter);
    // A fix (or a new message) clears the last answer, but not "Sending…".
    form.addEventListener('input', () => { if (status.dataset.kind !== 'busy') say('', ''); });
    paintCounter();

    return {
      open(id) {
        uid = id || null;
        rows = null;
        ++loadToken;
        sending = false;
        ta.value = '';
        boxes.forEach((b) => { b.checked = false; });
        picker.clear();
        picker.setBusy(false);
        paintCounter();
        say('', '');
        setOff(false);
        list.replaceChildren();
        list.hidden = true;
        empty.textContent = '';
        empty.hidden = true;
        paintLeft();
      },
      show() { load(); },
      focus() { if (!form.hidden) boxes[0].focus(); },
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
     A round button bottom-right with the unread count; it opens a floating
     window (about 360×520, expandable; near full screen on phones). Since
     7 Nov 2026 (D-30) the window has switch toggles at the top, one view at
     a time: Messages (the chat) | Feedback (section 2b). Emails and Support
     come later as more entries in VIEWS. History loads on first open;
     realtime keeps the badge and the window live; messages are marked read
     only while the Messages view is on screen. Since 11 Nov 2026 also on the
     tender pages (<body data-chat="tenders">); any page can open the window
     on a view with  document.dispatchEvent(new CustomEvent('phantasma:chat-open',
     { detail: { view: 'feedback' } }))  (the tender pages' "Send feedback").
     --------------------------------------------------------------------- */
  function bootClientChat() {
    if (!document.getElementById('account') && !document.getElementById('preferences')
        && !document.body.hasAttribute('data-chat')) return;
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
    fab.title = 'Messages and feedback';
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
    const title = el('h2', 'chat-panel__title', 'Phantasma team');
    title.id = 'chat-panel-title';
    const sizeBtn = el('button', 'chat-panel__btn chat-panel__size');
    sizeBtn.type = 'button';
    const closeBtn = el('button', 'chat-panel__btn');
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.setAttribute('aria-label', 'Close the window');
    closeBtn.appendChild(icon('close'));
    head.append(title, sizeBtn, closeBtn);

    // Switch toggles (ARIA tabs, the segmented look of the Client | Admin
    // switch) on a second line of the head; one view per entry.
    const VIEWS = [
      { key: 'messages', label: 'Messages' },
      { key: 'feedback', label: 'Feedback' },
    ];
    const tabsBar = el('div', 'chat-panel__tabs');
    const tabList = el('div', 'chat-switch');
    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', 'Show');
    const views = {};
    const tabBtns = VIEWS.map((v) => {
      const b = el('button', 'chat-switch__btn', v.label);
      b.type = 'button';
      b.id = 'chat-tab-' + v.key;
      b.dataset.view = v.key;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'chat-view-' + v.key);
      tabList.appendChild(b);
      const box = el('div', 'chat-view');
      box.id = 'chat-view-' + v.key;
      box.setAttribute('role', 'tabpanel');
      box.setAttribute('aria-labelledby', b.id);
      views[v.key] = box;
      return b;
    });
    tabsBar.appendChild(tabList);
    head.appendChild(tabsBar);
    panel.appendChild(head);
    VIEWS.forEach((v) => panel.appendChild(views[v.key]));
    dock.append(fab, panel);

    let view = 'messages';                         // the view on screen
    const chat = createChat(views.messages, {
      isAdmin: false,
      me: () => me,
      isActive: () => !panel.hidden && view === 'messages',
      onRead: () => refreshUnreadSoon(),
      emptyText: SERVICE === 'tenders'
        ? 'No messages yet. Tell the Phantasma team what works for you in the Tender Portal and what should be better, or ask anything — replies appear here.'
        : 'No messages yet. Ask the Phantasma team anything about your service — replies appear here.',
    });
    const feedback = createFeedback(views.feedback);
    document.body.appendChild(dock);
    liftAboveCookieBanner(dock);

    // Show one view; while the window is open it also reveals the chat
    // (newest at the bottom, mark read) or reloads the feedback list.
    function showView(key, focusTab) {
      view = key;
      tabBtns.forEach((b) => {
        const on = b.dataset.view === key;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        views[b.dataset.view].hidden = !on;
        if (on && focusTab) b.focus();
      });
      if (panel.hidden) return;
      if (key === 'messages') chat.reveal();
      else feedback.show();
    }
    tabBtns.forEach((b, i) => {
      b.addEventListener('click', () => showView(b.dataset.view, false));
      b.addEventListener('keydown', (e) => {
        const to = { ArrowRight: i + 1, ArrowLeft: i - 1 + tabBtns.length, Home: 0, End: tabBtns.length - 1 }[e.key];
        if (to == null) return;
        e.preventDefault();
        showView(tabBtns[to % tabBtns.length].dataset.view, true);
      });
    });
    showView('messages', false);

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
      if (!opened) { opened = true; chat.open(me); }
      showView(view, false);
      (view === 'messages' ? chat : feedback).focus();
    }
    function closePanel(refocus) {
      panel.classList.remove('is-open');
      panel.hidden = true;
      fab.setAttribute('aria-expanded', 'false');
      if (refocus) fab.focus();
    }
    fab.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel(false)));
    closeBtn.addEventListener('click', () => closePanel(true));
    // Opened from elsewhere on the page (signed in only), on the view asked for.
    document.addEventListener('phantasma:chat-open', (e) => {
      if (!me) return;
      const want = e.detail && views[e.detail.view] ? e.detail.view : view;
      if (panel.hidden) { view = want; openPanel(); } else showView(want, false);
      (want === 'messages' ? chat : feedback).focus();
    });
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
      fab.setAttribute('aria-label', count > 0 ? 'Messages and feedback, ' + count + ' unread' : 'Messages and feedback');
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
      feedback.open(me);                           // its list loads when the view is shown
      showView('messages', false);
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
      if (!panel.hidden) chat.markReadSoon();      // only while the Messages view shows (isActive)
      if (!panel.hidden && view === 'feedback') feedback.show();   // a status or note may have changed
    });
  }

  /* ---------------------------------------------------------------------
     5. Admin panel (admin.html). Signed out → Log in prompt; signed in but
     not an admin → "No access"; admins → four tabs:
       Clients  — every account: plan, searches, LinkedIn, CV, preferences
                  filled, unread (opens that client's chat), dates. Search
                  box + sortable headers (same look as the account tables).
       Messages — conversation list (newest first, unread counts) + chat pane.
       Feedback — every feedback request (7 Nov 2026, 0030): filter by
                  status; per request a status, a note the client sees, Save.
       Admins   — the list with Remove, and Add admin (invitation email).
     Since 11 Nov 2026 (0035) every person who writes from any page lands here
     (job search and the Tender Portal): conversations and requests carry a
     service tag (Job search / Tenders) and can be filtered by it; files show
     in the pane and on the request cards, and a reply can carry files too.
     One realtime channel without a filter keeps the chat parts live; the
     feedback list reloads when its tab is opened and when the page is back
     on screen (it is not in the realtime publication).
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
    let clientsReady = false;                      // the first clients list has arrived
    let openId = null;                             // conversation in the Messages pane
    let channel = null;
    let refreshTimer = null;
    const clientOf = (id) => clients.find((c) => c.user_id === id) || null;
    const nameOf = (c) => (c && (c.full_name || c.email)) || 'Client';
    const note = (p, kind, text) => { p.textContent = text || ''; p.dataset.kind = kind || ''; p.hidden = !text; };

    // ---- Messages: conversation list + one chat pane
    const convList  = $('#conv-list');
    const convEmpty = $('#conv-empty');
    const convFilter = $('#conv-filter');          // All services / Job search / Tenders (0035)
    let svcBy = {};                                // user id -> services they wrote from
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
      if (t.dataset.tab === 'feedback') loadFeedback();
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
      { text: 'Plan',        sort: (c) => ('plan_current' in c ? (c.plan_current ? planSort(c.plan_code) || 99 : null) : c.plan_code || null) },
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

    // ---- a client's preference answers (career_admin_preferences, 0027), compact, under the row.
    // Question texts and groups come from preferences.html itself, so they never drift.
    let prefLabels = null;
    function loadPrefLabels() {
      if (!prefLabels) {
        prefLabels = fetch('./preferences.html', { cache: 'no-cache' })
          .then((r) => r.text())
          .then((html) => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const label = {}, groups = [];
            let cur = null;
            doc.querySelectorAll('.pref-group__title, .pref-q__label[for]').forEach((n) => {
              if (n.classList.contains('pref-group__title')) {
                cur = { title: n.textContent.trim(), ids: [] };
                groups.push(cur);
              } else {
                const id = n.getAttribute('for');
                label[id] = n.textContent.trim();
                if (cur) cur.ids.push(id);
              }
            });
            return { groups, label };
          })
          .catch(() => ({ groups: [], label: {} }));
      }
      return prefLabels;
    }

    function fmtAnswer(v) {
      if (Array.isArray(v)) return v.map(fmtAnswer).filter(Boolean).join(', ');
      if (v && typeof v === 'object') {
        return Object.entries(v).map(([k, x]) => { const a = fmtAnswer(x); return a ? k + ': ' + a : ''; }).filter(Boolean).join('; ');
      }
      return v == null ? '' : String(v).trim();
    }

    function togglePrefs(tr, btn, c) {
      const open = btn.getAttribute('aria-expanded') === 'true';
      const next = tr.nextElementSibling;
      if (next && next.classList.contains('admin-prefs-row')) next.remove();
      btn.setAttribute('aria-expanded', String(!open));
      if (open) return;
      const row = document.createElement('tr');
      row.className = 'admin-prefs-row';
      const td = row.insertCell();
      td.colSpan = COLS.length;
      const box = el('div', 'admin-prefs', 'Loading…');
      box.id = 'prefs-' + c.user_id;
      box.setAttribute('aria-live', 'polite');
      btn.setAttribute('aria-controls', box.id);
      td.appendChild(box);
      tr.after(row);
      Promise.all([call(db().rpc('career_admin_preferences', { p_user: c.user_id })), loadPrefLabels()])
        .then(([res, labels]) => paintPrefs(box, res, labels));
    }

    function paintPrefs(box, res, labels) {
      box.replaceChildren();
      if (!res || res.error) { box.textContent = 'Could not load the answers. Please try again.'; return; }
      const p = res.data;
      if (!p) { box.textContent = 'No preferences saved yet.'; return; }
      const answers = p.answers || {};
      if (p.updated_at) box.appendChild(el('p', 'admin-prefs__meta', 'Last saved ' + fmtDate(p.updated_at)));
      const grid = el('div', 'admin-prefs__groups');
      function section(title, items) {
        if (!items.length) return;
        const s = el('section', 'admin-prefs__group');
        s.appendChild(el('h4', 'admin-prefs__title', title));
        const dl = document.createElement('dl');
        items.forEach(([q, a]) => { dl.appendChild(el('dt', null, q)); dl.appendChild(el('dd', null, a)); });
        s.appendChild(dl);
        grid.appendChild(s);
      }
      const seen = new Set();
      const salary = (p.salary_min != null || p.salary_max != null)
        ? [p.salary_min, p.salary_max].map((n) => (n == null ? '…' : Number(n).toLocaleString('en-GB'))).join(' – ') + (p.currency ? ' ' + p.currency : '')
        : '';
      labels.groups.forEach((g, i) => {
        const items = [];
        if (i === 0 && salary) items.push(['Salary range', salary]);
        g.ids.forEach((id) => {
          seen.add(id);
          const a = fmtAnswer(answers[id]);
          if (a) items.push([labels.label[id] || id, a]);
        });
        section(g.title, items);
      });
      // Anything the page no longer asks (or a page that failed to load): show it by its key
      const rest = Object.keys(answers).filter((k) => !seen.has(k)).map((k) => [labels.label[k] || k, fmtAnswer(answers[k])]).filter((x) => x[1]);
      if (!labels.groups.length && salary) rest.unshift(['Salary range', salary]);
      section(labels.groups.length ? 'Other answers' : 'Answers', rest);
      if (!grid.childElementCount) { box.appendChild(el('p', null, 'No answers filled in yet.')); return; }
      box.appendChild(grid);
    }

    // ---- Plans (owner, 9 Nov 2026; supabase/0032): the plan in each row is a
    // button that opens a small menu: Detective / Essential / Advanced / No plan.
    // The database decides (career_admin_set_plan): a new plan runs four weeks
    // from today, a change keeps the end date, and a plan the client PAID for
    // never goes below the paid plan and cannot be removed. The menu greys out
    // those choices so the admin sees the rule before choosing. Rows from
    // before 0032 (no plan_current column) keep the plain text.
    const planNote = $('#client-plan-status');
    let plans = null;                              // [{ code, name, sort }], the public plans table
    let plansLoading = null;
    function loadPlans() {
      if (plans) return Promise.resolve(plans);
      if (!plansLoading) {
        plansLoading = call(db().from('plans').select('code, name, sort').eq('is_active', true).order('sort'))
          .then((res) => {
            plansLoading = null;
            if (!res.error && res.data && res.data.length) plans = res.data;
            return plans;
          });
      }
      return plansLoading;
    }
    const planOf   = (code) => (plans || []).find((p) => p.code === code) || null;
    const planName = (code) => (planOf(code) ? planOf(code).name : code || '');
    const planSort = (code) => (planOf(code) ? Number(planOf(code).sort) || 0 : 0);

    function planCell(td, c) {
      const cur = !!c.plan_current;
      const label = cur ? c.plan_name || c.plan_code : 'No plan';
      const b = el('button', 'admin-plan-btn', label);
      b.type = 'button';
      b.dataset.plan = cur ? c.plan_code : 'none';
      b.dataset.focusKey = 'plan:' + c.user_id;
      b.setAttribute('aria-haspopup', 'menu');
      b.setAttribute('aria-controls', 'plan-menu-list');
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-label', 'Plan of ' + nameOf(c) + ': ' + (cur ? label : 'no plan') + '. Change the plan');
      const chev = el('span', 'admin-plan-btn__chev');
      chev.setAttribute('aria-hidden', 'true');
      b.appendChild(chev);
      b.addEventListener('click', () => openPlanMenu(b, c));
      td.appendChild(b);
      let sub = '';
      if (cur) {
        const paid = !c.plan_paid_code ? 'assigned'
          : c.plan_paid_code === c.plan_code ? 'paid' : 'paid ' + (planName(c.plan_paid_code) || c.plan_paid_code);
        sub = 'until ' + fmtDate(c.plan_ends) + ' · ' + paid;
      } else if (c.plan_code) {             // the last one: ended, cancelled, or a Pay now not finished
        const how = c.plan_status === 'active' && c.plan_ends ? 'ended ' + fmtDate(c.plan_ends) : c.plan_status;
        sub = (c.plan_name || c.plan_code) + (how ? ' · ' + how : '');
      }
      if (sub) td.appendChild(el('span', 't-sub', sub));
    }

    // One menu for the whole table, fixed on top (the table wrap scrolls sideways
    // on phones and would clip it). Heading + role="menu" list + a note on the rule.
    const planMenu = el('div', 'plan-menu');
    planMenu.hidden = true;
    const planHead = el('p', 'plan-menu__head');
    planHead.id = 'plan-menu-head';
    const planList = el('div', 'plan-menu__list');
    planList.id = 'plan-menu-list';
    planList.setAttribute('role', 'menu');
    planList.setAttribute('aria-labelledby', 'plan-menu-head');
    planList.setAttribute('aria-describedby', 'plan-menu-note');
    const planTip = el('p', 'plan-menu__note');
    planTip.id = 'plan-menu-note';
    planMenu.append(planHead, planList, planTip);
    document.body.appendChild(planMenu);
    let planFor = null;                            // { btn, c } while the menu is open
    let planBusy = false;

    function placePlanMenu() {
      if (!planFor) return;
      const EDGE = 8;
      const r = planFor.btn.getBoundingClientRect();
      planMenu.style.left = '0px';                 // measure at full width
      planMenu.style.top = '0px';
      const w = planMenu.offsetWidth, h = planMenu.offsetHeight;
      let top = r.bottom + 4;
      if (top + h > window.innerHeight - EDGE) top = Math.max(EDGE, r.top - 4 - h);
      planMenu.style.left = Math.max(EDGE, Math.min(r.left, window.innerWidth - w - EDGE)) + 'px';
      planMenu.style.top = top + 'px';
    }

    function fillPlanMenu(c) {
      planHead.textContent = 'Plan for ' + nameOf(c);
      planList.replaceChildren();
      planTip.dataset.kind = '';
      if (!plans) { planTip.textContent = 'Could not load the plans. Please try again.'; planTip.dataset.kind = 'error'; return; }
      const cur = c.plan_current ? c.plan_code : null;
      const paid = c.plan_current ? c.plan_paid_code : null;
      const item = (code, text) => {
        const b = el('button', 'plan-menu__item', text);
        b.type = 'button';
        b.tabIndex = -1;
        b.setAttribute('role', 'menuitemradio');
        b.setAttribute('aria-checked', String(code === cur));
        if (paid && (code === null || planSort(code) < planSort(paid))) b.setAttribute('aria-disabled', 'true');
        b.addEventListener('click', () => { if (b.getAttribute('aria-disabled') !== 'true') choosePlan(code); });
        planList.appendChild(b);
      };
      plans.forEach((p) => item(p.code, p.name));
      const sep = el('div', 'plan-menu__rule');
      sep.setAttribute('role', 'separator');
      planList.appendChild(sep);
      item(null, 'No plan');
      planTip.textContent = paid
        ? 'Paid for ' + planName(paid) + ': it can go up, or back to ' + planName(paid) + ', not lower.'
        : cur ? 'A change keeps the end date (' + fmtDate(c.plan_ends) + ').' : 'A new plan runs four weeks from today.';
    }

    async function openPlanMenu(btn, c) {
      if (planFor && planFor.btn === btn) { closePlanMenu(true); return; }
      closePlanMenu(false);
      planFor = { btn, c };
      btn.setAttribute('aria-expanded', 'true');
      planHead.textContent = 'Plan for ' + nameOf(c);
      planList.replaceChildren();
      planTip.textContent = 'Loading plans…';
      planTip.dataset.kind = '';
      planMenu.hidden = false;
      placePlanMenu();
      await loadPlans();
      if (!planFor || planFor.btn !== btn) return;          // closed meanwhile
      fillPlanMenu(planFor.c);
      placePlanMenu();
      const items = Array.from(planList.querySelectorAll('.plan-menu__item'));
      const first = items.find((b) => b.getAttribute('aria-checked') === 'true') || items[0];
      if (first) first.focus();
    }

    function closePlanMenu(focusBtn) {
      if (!planFor) return;
      const { btn } = planFor;
      planFor = null;
      planMenu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn && btn.isConnected) btn.focus();
    }

    async function choosePlan(code) {
      if (!planFor || planBusy) return;
      const { c } = planFor;
      const cur = c.plan_current ? c.plan_code : null;
      if (code === cur) { closePlanMenu(true); return; }
      planBusy = true;
      planMenu.setAttribute('aria-busy', 'true');
      planTip.textContent = 'Saving…';
      const res = await call(db().rpc('career_admin_set_plan', { p_user: c.user_id, p_plan: code }));
      planBusy = false;
      planMenu.removeAttribute('aria-busy');
      closePlanMenu(true);
      const who = nameOf(c);
      if (res.error) {
        if (res.error.code === '42501') { showDenied(); return; }          // no longer an admin
        note(planNote, 'error', res.error.code === 'PGRST202'
          ? 'Changing plans needs the database update 0032 first.'
          : 'Could not change the plan of ' + who + '. Please try again.');
        return;
      }
      const r = res.data || {};
      const text = {
        assigned:  who + ' now has ' + planName(r.plan) + ' until ' + fmtDate(r.ends_at) + '.',
        changed:   who + ': ' + planName(cur) + ' → ' + planName(r.plan) + ', until ' + fmtDate(r.ends_at) + '.',
        removed:   who + ': plan removed.',
        unchanged: who + ': no change.',
        refused:   'Not changed: ' + who + ' paid for ' + planName(r.paid_plan) + ', so the plan cannot go lower.',
      }[r.result] || who + ': saved.';
      note(planNote, r.result === 'refused' ? 'error' : 'ok', text);
      loadClients();
    }

    // Arrows / Home / End move through the items; Esc closes and returns to the
    // plan button; Tab closes and moves on from it. A click elsewhere, scrolling
    // or resizing closes it.
    planMenu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePlanMenu(true); return; }
      if (e.key === 'Tab') { closePlanMenu(true); return; }
      const items = Array.from(planList.querySelectorAll('.plan-menu__item'));
      const i = items.indexOf(document.activeElement);
      const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
      if (to === undefined || !items.length) return;
      e.preventDefault();
      items[(to + items.length) % items.length].focus();
    });
    document.addEventListener('click', (e) => {
      if (planFor && !planMenu.contains(e.target) && !planFor.btn.contains(e.target)) closePlanMenu(false);
    });
    window.addEventListener('resize', () => closePlanMenu(false));
    window.addEventListener('scroll', (e) => {
      if (planFor && !planMenu.contains(e.target)) closePlanMenu(false);
    }, { passive: true, capture: true });

    function clientRow(c) {
      const tr = document.createElement('tr');
      const name = tr.insertCell();
      name.className = 't-wrap';
      name.appendChild(el('span', 'admin-client', c.full_name || c.email || '—'));
      if (c.full_name && c.email) name.appendChild(el('span', 't-sub', c.email));

      const plan = tr.insertCell();
      if ('plan_current' in c) {
        planCell(plan, c);                         // 0032: a button that opens the plan menu
      } else if (c.plan_code) {
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
      // A button: opens this client's answers in a compact row under theirs (0027)
      const pb = el('button', 'admin-prefs-btn');
      pb.type = 'button';
      pb.setAttribute('aria-expanded', 'false');
      pb.setAttribute('aria-label', 'Preferences ' + pct + '% filled: show the answers of ' + nameOf(c));
      pb.appendChild(wrap);
      // Arrow (owner, 9 Nov 2026: "it is a button, it's not intuitive"): right when
      // closed, down when the answers are open, like the account tables' row arrows.
      const pchev = el('span', 't-toggle__chev');
      pchev.setAttribute('aria-hidden', 'true');
      pb.appendChild(pchev);
      pb.addEventListener('click', () => togglePrefs(tr, pb, c));
      tr.insertCell().appendChild(pb);

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
      // An open plan menu stays with its client's new button; refilled only when
      // that client's plan changed meanwhile (another admin).
      if (planFor) {
        const id = planFor.c.user_id;
        const nb = tbody.querySelector('[data-focus-key="plan:' + id + '"]');
        if (!nb) { closePlanMenu(false); return; }
        const fresh = clientOf(id) || planFor.c;
        const same = fresh.plan_current === planFor.c.plan_current && fresh.plan_code === planFor.c.plan_code
          && fresh.plan_paid_code === planFor.c.plan_paid_code;
        planFor.btn = nb;
        planFor.c = fresh;
        nb.setAttribute('aria-expanded', 'true');
        if (!same && !planBusy && plans) {
          const had = planMenu.contains(document.activeElement);
          fillPlanMenu(fresh);
          const f = planList.querySelector('[aria-checked="true"]') || planList.querySelector('.plan-menu__item');
          if (had && f) f.focus();
        }
        placePlanMenu();
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
      const pick = convFilter ? convFilter.value : 'all';
      const fits = (c) => pick === 'all' || c.user_id === openId || (svcBy[c.user_id] || []).indexOf(pick) !== -1;
      const list = clients.filter((c) => (c.last_message_at || c.user_id === openId) && fits(c))
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
        const svcs = svcBy[c.user_id] || [];
        if (svcs.length) {
          const tags = el('span', 'conv__svc');
          svcs.forEach((s) => tags.appendChild(serviceTag(s)));
          b.appendChild(tags);
        }
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
      convEmpty.textContent = pick !== 'all' && clients.some((c) => c.last_message_at)
        ? 'No conversation from ' + serviceName(pick) + ' yet.'
        : 'No messages yet. To write first, open Chat for a client on the Clients tab.';
      if (keep) {
        const f = convList.querySelector('[data-focus-key="' + keep + '"]');
        if (f) f.focus();
      }
    }
    if (convFilter) convFilter.addEventListener('change', paintConversations);

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
      const [list, total, svcs] = await Promise.all([
        call(db().rpc('career_admin_clients')),
        call(db().rpc('career_admin_unread')),
        hasFiles().then((yes) => (yes ? call(db().rpc('chat_admin_services')) : { data: null })),
      ]);
      if (g !== gen) return;                       // signed out / switched meanwhile
      if (list.error) {
        if (list.error.code === '42501') { showDenied(); return; }   // no longer an admin
        if (!clients.length) tableBox.replaceChildren(el('p', 'account__hint', 'Could not load the accounts. Please reload the page.'));
        return;
      }
      if (svcs && svcs.data) {
        svcBy = {};
        svcs.data.forEach((s) => { svcBy[s.client_id] = s.services || []; });
      }
      clients = list.data || [];
      renderRows();
      paintConversations();
      paintPane();
      const sum = clients.reduce((acc, c) => acc + (Number(c.unread) || 0), 0);
      paintBadge(tabBadge, total.error ? sum : Number(total.data) || 0);
      // The feedback list may have arrived first: give it the names once.
      if (!clientsReady) { clientsReady = true; if (fbRows) paintFeedback(); }
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

    // ---- Feedback (7 Nov 2026, D-30): every request sent from the Feedback
    // view of the client window (table feedback, supabase/0030; RLS lets
    // admins read all rows and change status + admin_note). Newest first,
    // filter by status; one card per request (who, when, types, text) with a
    // status select, a note the client sees under their request, and Save.
    // Names and emails come from the Clients list, keyed by user id. Edits
    // not saved yet are kept in fbDraft, so a reload never eats a note.
    const fbBox    = $('#fb-list');
    const fbFilter = $('#fb-filter');
    const fbSvc    = $('#fb-service');             // All services / Job search / Tenders (0035)
    const fbCount  = $('#fb-count');
    const fbBadge  = $('#admin-fb-new');
    let fbRows = null;                             // null = not loaded (or 0030 not run)
    let fbSig = '';                                // what is painted, to skip needless repaints
    const fbDraft = new Map();                     // id -> { status, note } edited, not saved
    const fbSigOf = (list) => list.map((f) => f.id + ':' + f.status + ':' + (f.updated_at || '')).join(',');
    const paintFbBadge = () => paintBadge(fbBadge, fbRows ? fbRows.filter((f) => f.status === 'new').length : 0, 'new');

    async function loadFeedback() {
      if (!fbBox) return;
      const g = gen;
      const cols = 'id, user_id, kinds, message, status, admin_note, created_at, updated_at'
        + ((await hasFiles()) ? ', service, attachments' : '');
      if (g !== gen) return;
      const { data, error } = await call(db().from('feedback')
        .select(cols)
        .order('created_at', { ascending: false }).limit(500));
      if (g !== gen) return;
      if (error) {
        if (fbRows) return;                        // keep what is on screen
        fbBox.replaceChildren(el('p', 'account__hint', isMissing(error)
          ? 'Feedback is not set up on the server yet (supabase/0030).'
          : 'Could not load the feedback. Please reload the page.'));
        fbCount.textContent = '';
        return;
      }
      fbRows = data || [];
      const sig = fbSigOf(fbRows);
      if (sig !== fbSig) { fbSig = sig; paintFeedback(); }
      paintFbBadge();
    }

    function fbItem(f) {
      const c = clientOf(f.user_id);
      const d = fbDraft.get(f.id);
      const li = el('li', 'fb-admin__item');
      li.dataset.status = f.status;
      const info = el('div', 'fb-admin__info');
      const whoP = el('p', 'fb-admin__who');
      whoP.appendChild(el('span', 'admin-client', c ? nameOf(c) : clientsReady ? 'Unknown account' : '…'));
      if (c && c.full_name && c.email) whoP.appendChild(el('span', 'fb-admin__email', c.email));
      info.appendChild(whoP);
      const meta = el('p', 'fb-admin__meta');
      const time = el('time', null, fmtDateTime(f.created_at));
      time.dateTime = f.created_at;
      meta.append(time, document.createTextNode(' · ' + fbKinds(f.kinds)));
      if (f.service) meta.append(document.createTextNode(' '), serviceTag(f.service));
      info.appendChild(meta);
      info.appendChild(el('p', 'fb-admin__text', f.message));
      const files = filesOf(f);
      if (files.length) info.appendChild(filesBlock(files));

      const form = el('form', 'fb-admin__edit');
      form.noValidate = true;
      form.dataset.fb = String(f.id);
      const sl = el('label', 'fb-admin__label', 'Status');
      sl.htmlFor = 'fb-st-' + f.id;
      const sel = el('select', 't-filter__select fb-admin__select');
      sel.id = sl.htmlFor;
      sel.dataset.focusKey = 'st:' + f.id;
      FB_STATUS.forEach(([v, t]) => { const o = el('option', null, t); o.value = v; sel.appendChild(o); });
      sel.value = d ? d.status : f.status;
      const nl = el('label', 'fb-admin__label', 'Note to the client ');
      nl.htmlFor = 'fb-note-' + f.id;
      nl.appendChild(el('small', null, '(shown under their request)'));
      const ta = el('textarea', 'auth-modal__input fb-admin__note');
      ta.id = nl.htmlFor;
      ta.rows = 2;
      ta.maxLength = 1000;                          // feedback.admin_note limit
      ta.dataset.focusKey = 'note:' + f.id;
      ta.value = d ? d.note : (f.admin_note || '');
      const actions = el('div', 'fb-admin__actions');
      const save = el('button', 'btn btn-primary btn-sm', 'Save');
      save.type = 'submit';
      save.dataset.focusKey = 'save:' + f.id;
      save.setAttribute('aria-label', 'Save status and note for the request from ' + (c ? nameOf(c) : 'this account'));
      const st = el('p', 'account-form__status');
      st.setAttribute('role', 'status');
      st.hidden = true;
      actions.append(save, st);
      form.append(sl, sel, nl, ta, actions);
      li.append(info, form);
      return li;
    }

    // Rebuilt on load (when something changed), on the filter, and once when
    // the names arrive; keyboard focus survives the rebuild.
    function paintFeedback() {
      if (!fbBox || !fbRows) return;
      const pick = fbFilter.value;
      const svc = fbSvc ? fbSvc.value : 'all';
      const shown = fbRows.filter((f) => (pick === 'all' || f.status === pick)
        && (svc === 'all' || (f.service || 'career') === svc));
      const keep = fbBox.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
      if (shown.length) {
        const list = el('ol', 'fb-admin');
        list.setAttribute('aria-label', 'Feedback requests');
        shown.forEach((f) => list.appendChild(fbItem(f)));
        fbBox.replaceChildren(list);
        fillThumbs(list);
      } else {
        fbBox.replaceChildren(el('p', 'account__hint', fbRows.length ? 'No requests match this choice.' : 'No feedback yet.'));
      }
      fbCount.textContent = pick === 'all' && svc === 'all'
        ? fbRows.length + (fbRows.length === 1 ? ' request' : ' requests')
        : 'Showing ' + shown.length + ' of ' + fbRows.length;
      if (keep) {
        const f = fbBox.querySelector('[data-focus-key="' + keep + '"]');
        if (f) f.focus();
      }
    }

    if (fbBox) {
      fbFilter.addEventListener('change', paintFeedback);
      if (fbSvc) fbSvc.addEventListener('change', paintFeedback);
      const keepDraft = (e) => {
        const f = e.target.closest('form[data-fb]');
        if (f) fbDraft.set(Number(f.dataset.fb), { status: f.querySelector('select').value, note: f.querySelector('textarea').value });
      };
      fbBox.addEventListener('input', keepDraft);
      fbBox.addEventListener('change', keepDraft);
      fbBox.addEventListener('submit', async (e) => {
        const f = e.target.closest('form[data-fb]');
        if (!f) return;
        e.preventDefault();
        const id = Number(f.dataset.fb);
        const btn = f.querySelector('button[type="submit"]');
        const st = f.querySelector('.account-form__status');
        if (btn.getAttribute('aria-disabled') === 'true') return;
        const status = f.querySelector('select').value;
        const text = f.querySelector('textarea').value.trim();
        btn.setAttribute('aria-disabled', 'true');
        note(st, 'busy', 'Saving…');
        // .select() returns the changed row: an empty answer means nothing was saved.
        const { data, error } = await call(db().from('feedback')
          .update({ status, admin_note: text || null }).eq('id', id)
          .select('id, status, admin_note, updated_at'));
        btn.removeAttribute('aria-disabled');
        if (error || !data || !data.length) { note(st, 'error', 'Could not save. Please try again.'); return; }
        // The card stays as it is (with "Saved."); the next load repaints the
        // list, so the status filter applies to it again then.
        const row = fbRows && fbRows.find((x) => x.id === id);
        if (row) Object.assign(row, data[0]);
        fbDraft.delete(id);
        f.closest('.fb-admin__item').dataset.status = status;
        note(st, 'ok', 'Saved.');
        paintFbBadge();
      });
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
      closePlanMenu(false);
      note(planNote, '', '');
      clients = [];
      clientsReady = false;
      openId = null;
      svcBy = {};
      tbody = null;
      fbRows = null;
      fbSig = '';
      fbDraft.clear();
      paintBadge(fbBadge, 0);
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
      if (fbBox) { fbBox.replaceChildren(el('p', 'account__hint', 'Loading…')); fbCount.textContent = ''; }
      paintPane();
      paintConversations();
      const start = tab(location.hash.slice(1)) || tab('clients');
      selectTab(start, false);                     // the Feedback tab loads its list itself
      loadClients();
      loadAdmins();
      if (start.dataset.tab !== 'feedback') loadFeedback();   // for the "new" count on its tab
      listen();
    }
    watchSession(enter);

    document.addEventListener('visibilitychange', () => {
      if (!me || panel.hidden || document.visibilityState !== 'visible') return;
      refreshSoon();
      chat.sync();
      chat.markReadSoon();
      loadFeedback();
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
