// Site check — opens the public pages in Chrome (headless) at the owner's laptop width (1535 px),
// a big screen (1920 px) and a phone (375 px), and reports problems in one line.
// Layout standard: Phantasma Library\workstreams\website-details.md § Layout standard (owner, 18 Nov 2026).
//
// Run from the website folder:   node --experimental-websocket --no-warnings tests/site-check.mjs
// Exit code 0 = all fine, 1 = problems (details in tests/last-report.txt). The pre-push hook
// (tests/pre-push, copied to .git/hooks/pre-push) runs it before every push that changes pages,
// styles, script or pictures. No packages needed: it talks to the installed Chrome directly.

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPORT = path.join(ROOT, 'tests', 'last-report.txt');
const PORT = 8123;
const DEBUG_PORT = 9339;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// Public pages (the logged-in pages and the tools come later, with a test account).
const PAGES = ['index.html', 'index.ka.html', 'blog.html', 'services.html', 'services.ka.html',
  'projects.html', 'projects.ka.html', 'terms.html', 'terms.ka.html', 'privacy.html',
  'privacy.ka.html', 'landing.html'];
const SIZES = [
  { name: 'laptop 1535', width: 1535, height: 864, standard: true },
  { name: 'desktop 1920', width: 1920, height: 1080 },
  { name: 'phone 375', width: 375, height: 812, mobile: true },
];
// Limits at 1535 px (the owner's laptop). Raise one only with the owner's OK.
const LIMITS = { maxFont: 40, maxControl: 52, maxGap: 120 };
// Analytics and ads are not loaded during the check (no fake visits in Google Analytics).
const BLOCK = ['*googletagmanager.com*', '*google-analytics.com*', '*doubleclick.net*',
  '*googleadservices.com*', '*googlesyndication.com*'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- 1. a small file server for the website folder -------------------------------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2' };
const missing = new Set();
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    missing.add(p);
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

// ---- 2. Chrome DevTools Protocol over Node's WebSocket ---------------------------------
class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.ready = new Promise((ok, bad) => { this.ws.onopen = ok; this.ws.onerror = bad; });
    this.ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id) {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        m.error ? p.bad(new Error(m.error.message)) : p.ok(m.result);
      } else {
        (this.handlers.get(m.method) || []).forEach(f => f(m.params));
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, bad) => this.pending.set(id, { ok, bad }));
  }
  on(method, f) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(f);
  }
  once(method, ms) {
    return new Promise((ok, bad) => {
      const t = setTimeout(() => bad(new Error('timeout waiting for ' + method)), ms);
      const f = p => {
        clearTimeout(t);
        this.handlers.set(method, this.handlers.get(method).filter(x => x !== f));
        ok(p);
      };
      this.on(method, f);
    });
  }
}

async function getJson(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Chrome did not start (' + url + ')');
}

// ---- 3. what is measured inside each page (runs in the browser) ------------------------
function inPage(limits) {
  const out = { overflow: document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth : 0 };
  const same = u => { try { const x = new URL(u, location.href); return x.origin === location.origin ? x.pathname : null; } catch { return null; } };
  out.links = [...new Set([...document.querySelectorAll('a[href]')].map(a => same(a.getAttribute('href'))).filter(Boolean))];
  const imgs = new Set();
  document.querySelectorAll('img').forEach(i => {
    if (i.getAttribute('src')) imgs.add(same(i.getAttribute('src')));
    (i.getAttribute('srcset') || '').split(',').forEach(c => { const u = c.trim().split(/\s+/)[0]; if (u) imgs.add(same(u)); });
  });
  out.images = [...imgs].filter(Boolean);
  if (!limits) return out;

  const describe = e => e.tagName.toLowerCase()
    + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
    + ' "' + (e.textContent || e.getAttribute('alt') || e.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40) + '"';
  const shown = e => {
    const r = e.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    const s = getComputedStyle(e);
    return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0;
  };
  // the fixed parts (cookie banner, dialogs) and the sticky page header are not page content
  const pinned = e => { for (let x = e; x && x !== document.body; x = x.parentElement) { if (x.id === 'site-header' || getComputedStyle(x).position === 'fixed') return true; } return false; };

  let maxFont = { px: 0, what: '' }, maxControl = { px: 0, what: '' };
  const items = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (e.closest('.visually-hidden, template, dialog:not([open]), [hidden]')) continue;
    if (!shown(e) || pinned(e)) continue;
    const text = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const media = /^(IMG|SVG|CANVAS|VIDEO|INPUT|SELECT|TEXTAREA|BUTTON|IFRAME)$/i.test(e.tagName);
    if (text) {
      const px = parseFloat(getComputedStyle(e).fontSize);
      if (px > maxFont.px) maxFont = { px: Math.round(px), what: describe(e) };
    }
    // controls = buttons and fields; clickable cards (case reel, pricing toggles) are not controls
    if (e.matches('.btn, select, input:not([type=hidden]):not([type=checkbox]):not([type=radio])') || (e.tagName === 'BUTTON' && !/card|toggle|tile|reel|dot|arrow/i.test(e.className))) {
      const h = Math.round(e.getBoundingClientRect().height);
      if (h > maxControl.px) maxControl = { px: h, what: describe(e) };
    }
    // boxes with their own background or border (cards, placeholders, rules) count as content too,
    // so the check measures empty page background only; whole sections (600 px+) do not count
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    const boxed = r.height < 600 && (!/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor) || parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0);
    if (text || media || boxed) items.push([r.top + scrollY, r.bottom + scrollY, e]);
  }
  // Biggest empty band between two pieces of content (the sticky header counts as the start).
  items.sort((a, b) => a[0] - b[0]);
  const header = document.querySelector('#site-header');
  let bottom = header ? header.getBoundingClientRect().bottom + scrollY : 0, last = header, maxGap = { px: 0, above: '', below: '' };
  for (const [top, bot, e] of items) {
    if (top - bottom > maxGap.px) maxGap = { px: Math.round(top - bottom), above: last ? describe(last) : 'top of page', below: describe(e) };
    if (bot > bottom) { bottom = bot; last = e; }
  }
  return Object.assign(out, { maxFont, maxControl, maxGap });
}

// ---- 4. the run -------------------------------------------------------------------------
const started = Date.now();
const problems = [];
const lines = [];
let chrome, profile;
try {
  if (typeof WebSocket === 'undefined') throw new Error('run with: node --experimental-websocket --no-warnings tests/site-check.mjs');
  if (!fs.existsSync(CHROME)) throw new Error('Chrome not found at ' + CHROME + ' (set CHROME_PATH)');
  await new Promise(ok => server.listen(PORT, '127.0.0.1', ok));
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'site-check-'));
  chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--mute-audio', 'about:blank'],
    { stdio: 'ignore' });
  await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
  const target = (await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).find(t => t.type === 'page');
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.ready;

  let errors = [];
  cdp.on('Runtime.exceptionThrown', p => errors.push('script error: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0]));
  cdp.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') errors.push('console error: ' + p.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 160)); });
  cdp.on('Log.entryAdded', p => {
    const e = p.entry;
    if (e.level === 'error' && !/ERR_BLOCKED_BY_CLIENT/.test(e.text) && !(e.url || '').includes(':' + PORT + '/')) errors.push('browser: ' + e.text.slice(0, 160) + (e.url ? ' (' + e.url.slice(0, 80) + ')' : ''));
  });
  for (const m of ['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable']) await cdp.send(m);
  await cdp.send('Network.setBlockedURLs', { urls: BLOCK });

  const linked = new Map();
  for (const size of SIZES) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: !!size.mobile });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: !!size.mobile, maxTouchPoints: size.mobile ? 5 : 1 });
    for (const page of PAGES) {
      errors = [];
      missing.clear();
      const loaded = cdp.once('Page.loadEventFired', 30000);
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page}` });
      await loaded;
      await sleep(900);
      const { result } = await cdp.send('Runtime.evaluate', { expression: `(${inPage})(${JSON.stringify(size.standard ? LIMITS : null)})`, returnByValue: true });
      const r = result.value;
      const where = `${page} @ ${size.name}`;
      if (r.overflow) problems.push(`${where}: the page scrolls sideways (${r.overflow} px wide)`);
      [...new Set(errors)].forEach(e => problems.push(`${where}: ${e}`));
      [...missing].forEach(m => problems.push(`${where}: file not found ${m}`));
      if (size.standard) {
        if (r.maxFont.px > LIMITS.maxFont) problems.push(`${where}: text too big, ${r.maxFont.px} px (limit ${LIMITS.maxFont}): ${r.maxFont.what}`);
        if (r.maxControl.px > LIMITS.maxControl) problems.push(`${where}: button or field too tall, ${r.maxControl.px} px (limit ${LIMITS.maxControl}): ${r.maxControl.what}`);
        if (r.maxGap.px > LIMITS.maxGap) problems.push(`${where}: empty band of ${r.maxGap.px} px (limit ${LIMITS.maxGap}) between ${r.maxGap.above} and ${r.maxGap.below}`);
        lines.push(`${page}: biggest text ${r.maxFont.px} px, tallest control ${r.maxControl.px} px, biggest empty band ${r.maxGap.px} px`);
      }
      for (const u of [...r.links, ...r.images]) if (!linked.has(u)) linked.set(u, page);
    }
  }
  // every local link and picture must exist
  for (const [u, page] of linked) {
    const res = await fetch(`http://127.0.0.1:${PORT}${u}`); // already URL-encoded by the browser
    if (res.status !== 200) problems.push(`${page}: link or picture points to a missing file: ${u}`);
  }
  // every page that loads styles.css / script.js uses the same ?v= value
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !f.startsWith('_')).concat(['campaigns/index.html', 'ecommerce/index.html']);
  for (const kind of ['styles.css', 'script.js']) {
    const seen = new Map();
    for (const f of files) {
      const m = fs.readFileSync(path.join(ROOT, f), 'utf8').match(new RegExp(kind.replace('.', '\\.') + '\\?v=([^"\'&]+)'));
      if (m) seen.set(f, m[1]);
    }
    const values = [...new Set(seen.values())];
    if (values.length > 1) problems.push(`${kind}: pages use different ?v= values (${[...seen].map(([f, v]) => f + ' ' + v).join(', ')})`);
  }
} catch (e) {
  problems.push('the check itself failed: ' + e.message);
} finally {
  try { chrome && chrome.kill(); } catch { /* already gone */ }
  server.close();
  await sleep(300);
  try { profile && fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file */ }
}

const secs = Math.round((Date.now() - started) / 1000);
const summary = problems.length
  ? `Site check: ${problems.length} problem(s) on ${PAGES.length} pages × ${SIZES.length} sizes (${secs} s) — see tests/last-report.txt`
  : `Site check: all fine — ${PAGES.length} pages × ${SIZES.length} sizes (${secs} s)`;
fs.writeFileSync(REPORT, [summary, '', ...problems.map(p => '- ' + p), '', 'Measured at 1535 px:', ...lines.map(l => '  ' + l), ''].join('\n'));
console.log(summary);
problems.slice(0, 12).forEach(p => console.log('  - ' + p));
process.exit(problems.length ? 1 : 0);
