# CLAUDE.md — Phantasma website

Context file for Claude Code. Read this first; it is the durable memory of this
project so a lost conversation does not mean a lost context.

---

## 1. What this is

Static marketing site for **Phantasma**, a boutique data-engineering / cloud
transformation consultancy targeting mid-market teams.

| | |
|---|---|
| Live domain | `https://solvephantasma.com` (see `CNAME`) |
| Hosting | GitHub Pages, served from `main` branch root |
| Repo | `Giorgilomidze/Phantasma` |
| Contact email on site | `consult@solvephantasma.com` |
| Tagline | "Tangible solutions for abstract problems." |
| Positioning line | "We turn manual operations into measured systems." |

Brand voice: understated, evidence-first, no hype. Every claim on the site is
backed by a number from a real engagement. **Never invent metrics.** If a number
is needed and not already in the repo, ask.

---

## 2. Stack — deliberately minimal

- Vanilla HTML + CSS + JS. **No framework, no bundler, no build step.**
- `script.js` is a single IIFE. No modules, no imports.
- CSS is one hand-authored file with numbered sections. No preprocessor.
- Only npm dependency is `sharp`, used solely by `convert-images.js`.
- Fonts loaded from CDN: **Fraunces** (display, Google Fonts) and
  **General Sans** (body, Fontshare).

Do not introduce a framework, bundler, TypeScript, or CSS preprocessor without
being asked. Editing the files directly *is* the workflow.

### Local preview

No dev server is configured. Open the `.html` files directly, or run any static
server from the repo root, e.g. `python -m http.server 8000`.

### Deploy

`git push` to `main`. GitHub Pages publishes automatically. There is no CI.

**Cache-busting:** every page links `styles.css?v=YYYYMMDDx` and
`script.js?v=YYYYMMDDx`. **Bump the value in all six HTML files whenever CSS
or JS changes**, or browsers (and Pages' 10-min cache) keep the old file:
`sed -i -E 's#(styles\.css|script\.js)\?v=[^"]*#?v=NEW#' *.html`.

---

## 3. File map

| File | Role |
|---|---|
| `index.html` | Main site (500 lines) |
| `landing.html` | Paid-ads landing page — hero / approach / booking only |
| `blog.html` | Case-studies page: 7 hand-written articles, sticky sidebar, scroll-spy |
| `projects.html` | "Personal Career Strategist" service page — 3 pricing tiers, Keepz **Pay now** links |
| `projects.ka.html` | **Georgian translation of `projects.html`.** Same markup, translated text, `lang="ka"`, loads Noto Sans/Serif Georgian. **Any copy or price change on `projects.html` must be mirrored here by hand.** Header carries a `.lang-switch` (inline-SVG GB/GE flags) and both pages link each other with `hreflang`. |
| `account.html` | Client dashboard (EN only). Signed-out: Log in prompt. Signed-in: email/Sign out + 8 KPI tiles from `get_my_stats()`. `noindex`, disallowed in `robots.txt`. |
| `supabase/` | **Not the schema.** `README.md` (run order + table contract), `0001-drop-site-v1.sql`, `0002-site-additions.sql`. The schema lives in `D:\Web Development\Solve Assistant\supabase\schema.sql`. |
| `data/kpis.json` | **Live KPI numbers for the projects-page funnel.** Owner overwrites it and pushes; both projects pages fetch it at load (`cache: no-store`). Only the `funnel[]` array is rendered — stage count, order and labels come from the file. Live URL `https://solvephantasma.com/data/kpis.json`. |
| `script.js` | All behaviour + the `CASES` data (~1500 lines) |
| `styles.css` | All styles, numbered sections (~2500 lines) |
| `convert-images.js` | One-off `sharp` script, PNG/JPG to WebP at quality 82 |
| `favicon.svg`, `CNAME`, `robots.txt`, `sitemap.xml` | Site plumbing |
| `images/` | Source PNG/JPG **and** the WebP the site actually references |
| `Fantasma OLD/`, `Miscelanous trash/` | Scratch dirs, now git-ignored. Ignore them. |

`.gitignore` excludes `node_modules/`, `package.json`, `package-lock.json`,
`convert-images.js` — i.e. the build tooling is intentionally local-only and
not published to Pages — plus `.claude/settings.local.json` (holds a plaintext
API token, see §9) and the two scratch dirs.

---

## 4. script.js architecture

Single IIFE. Order of contents:

1. `prefersReducedMotion` — checked throughout; every animation must respect it.
2. **`CASES`** — array of 7 case-study objects, lines ~14-486. This is the
   single source of truth for the case reel *and* the lightbox.
3. Boot functions, all called from `init()` at the bottom:

| Function | What it does |
|---|---|
| `bootHeroReveal()` | Per-line hero text reveal, then triggers `triggerCountUp()` |
| `triggerCountUp()` | Animates `[data-count-to]` KPI numbers (cubic ease-out, staggered 60ms) |
| `bootHeader()` | Adds scrolled state to `#site-header` past 80px |
| `bootNavToggle()` | Hamburger menu, **≤1023px on every page**. `.is-open` on `#site-header`; Esc closes + refocuses button; link click / outside tap closes. Labels from `data-label-open/close` on the button (Georgian page supplies its own). Its `matchMedia('(max-width: 1023px)')` must match the CSS breakpoint. |
| `bootKpiFunnel()` | Projects pages only. Fetches `data/kpis.json`, renders `funnel[]` as `.kpi-band`s. Width `28 + 72·log10(v+1)/log10(max+1)` % so 0 is still a 28% band. Colour via `--mix` custom prop → `color-mix(in oklch, --surface, --accent)`; text flips to `--bg` at mix ≥ 60%. Lede / "updated" / "unavailable" strings come from `data-*` on `#kpi-funnel-lede`; Georgian dates use a hardcoded month array (browsers ship no `ka` locale). Fetch failure → "Live figures unavailable", no bands. |
| `bootCaseReel()` | Infinite auto-scrolling carousel, 4 visible, 5s interval, arrows + dots |
| `Lightbox` | Module (IIFE) — 6-slide case-study viewer with keyboard nav |
| `bootApproachStrip()` | Scroll-driven progress through the 5 approach stations |
| `Auth` | Module. supabase-js client (`SUPABASE_URL` / publishable key constants), magic-link + Google sign-in, `requestSubscription(plan)` (inserts a `pending` row), `loadStats()`. Syncs every `.js-auth` link (Log in ↔ Account, labels from `data-label-*`) and fires `phantasma:auth`. Skips silently when `window.supabase` is absent (landing). |
| `bootAuthModal()` | `#auth-modal` on index/blog/projects/projects.ka/account. Esc / backdrop / ✕ close, focus restore, `body.is-locked`. Also intercepts `[data-tier]` Pay now buttons: signed out → opens modal; signed in → `requestSubscription` then Keepz opens. |
| `bootAccountPage()` | `account.html` only. Fills `[data-stat]` tiles, staggered reveal via `.stat-grid.is-in`, then `triggerCountUp()`. No `candidates` row → zeros + "first shortlist is being prepared". |
| `bootCalendly()` | Lazy-loads Calendly on click of `#calendly-placeholder` |
| `bootImageZoom()` | Click-to-zoom on case images |
| `bootCookieBanner()` | GDPR banner + Google consent-mode update |

`init()` runs on `DOMContentLoaded`. **All pages (index, landing, blog, projects, projects.ka, account) load the same
`script.js`**, so every boot function must guard against elements that do not
exist on the current page (`if (!el) return;`). Several past bugs were exactly
this — see commits `a2fec02` and `ca88b9c`.

> Note: `index.html` loads `script.js` with `defer`; `landing.html` and
> `blog.html` load it without. Harmless today because of the `readyState`
> check at the bottom, but keep it in mind.

### Shape of a CASES entry

```js
{
  slug: 'ecommerce-cost-engine',       // stable id, used by Lightbox.open(slug)
  industry: 'E-commerce',
  title: 'E-commerce Cost Engine',
  outcome: '...',                      // one-line summary
  kpiNum: '93.7%', kpiLabel: 'labor reduction',
  heroMetric: { kind, value, label, foil },
  situation: { prose, scale: [{num, label}, ...] },
  built: {
    rows: [[{label}, {arrow:true}, ...]],                    // architecture diagram
    image:     { src: './images/case1-built.webp', alt },    // lightbox slide
    thumbnail: { src: './images/Slider Thumbnail 1 - ....webp', alt }, // reel tile
  },
  impact: { ... },
  stack: ['Azure Data Factory', ...],
  engagement: { duration, tco, summary },
  fullText: [ ... ],                   // paragraphs for the final slide
}
```

**`thumbnail` is nested inside `built`** — the reel reads
`c.built.thumbnail.src`, not `c.thumbnail.src`. This has been miswired twice
(commits `fad2bde`, `75f00b3`).

The 7 slugs, in order:
`ecommerce-cost-engine`, `mining-operational-intelligence`,
`monolith-recovery`, `precision-viticulture`, `pharmacy-digitalisation`,
`demand-forecasting`, `water-utility-predictive-ops`.

### Lightbox slides

Fixed 6-slide sequence, labels in `SLIDE_LABELS`:
`Cover`, `The Situation`, `What we built`, `Impact`, `Stack & Engagement`,
`Full Case Study`.
Keyboard: arrow keys change slide, `[` / `]` change case, `Esc` closes.

---

## 5. styles.css conventions

- **Single warm-light theme. No dark mode in v1.** Do not add one unasked.
- Colours are authored in `oklch()` with a hex fallback block under
  `@supports not (color: oklch(...))`. **If you change a colour token, change
  both places.** Tokens carry a `--*-rgb` twin for the same reason.
- Palette: `--bg` `#f9f3eb`, `--surface` `#f1e6d4`, `--ink` `#2a221a`,
  `--accent` `#c87651` (terracotta), `--rule` `#dccfbf`.
- Spacing is a **strict 4px scale**, `--space-1` through `--space-10`. Use the
  tokens; do not hardcode pixel values.
- Type is fluid `clamp()` tokens: `--type-hero`, `--type-h2`, `--type-body`, etc.
- Layout container: `.page-grid`, width `--content-max` = `min(1480px, 94vw)`.
- Naming is loose BEM: `block__element`, `--modifier`, state as `.is-*`.
- File is organised into numbered comment-banner sections. Add new styles in the
  matching section, not at the bottom. Two quirks in the numbering: **there is no
  section 10** — it was "Selected Work / Bento", deleted as dead code once the
  bento grid was removed, and the remaining sections were *not* renumbered to
  keep the diff small. And **two sections are both numbered 16** (Booking widget,
  Footer). Section 12 is now "Chips (lightbox stack slide)" — only `.chips`,
  `.chip` and `.chip:hover` survive there; they are live, used by the lightbox
  "Stack & Engagement" slide via `class="slide-stack__chips chips"`. Do not
  delete them on the assumption the old Stack & Industries section is dead.
- Section 20 is `Responsive`, 21 is `Reduced motion`. Every animation needs a
  `prefers-reduced-motion` answer, in CSS or via the JS flag.
- **Header breakpoints.** Inline nav ≥1024px; hamburger ≤1023px (own `@media`
  block just before the 767 block). Pages carrying the language switch use
  `.site-header__row--lang` (4 columns; on ≤1023 the header CTA is hidden and
  the switch shows flags only; 1024–1199 also flags-only with tighter nav).
  Georgian nav labels are ~40% wider — `html[lang="ka"]` rules shrink them.
- **`.lang-switch`** — segmented toggle (cream pill, active segment
  `--accent` bg + `--bg` text, same as `.btn-primary`). Flags are inline SVG
  (emoji flags don't render on Windows). Only on `projects*.html`.
- **`html[lang="ka"]`** overrides `--font-display/--font-body` to Noto
  Serif/Sans Georgian (loaded only by `projects.ka.html`) and sets
  `text-transform: none` everywhere — uppercase maps Mkhedruli to Mtavruli.
- Section 26 is Auth: `.auth-modal*`, `.js-auth[data-state="in"]` (outlined Account
  look), `.site-nav__auth` (nav-panel Log in, shown ≤1023 only), and the account
  page `.account*` / `.stat-grid` / `.stat` tiles (8 → 4 → 2 columns at 1199 / 599).
- Section 25 is the Projects page: `.project-*`, `.pricing-*`, `.kpi-*`.
  `.project-section--split` puts prose in 7 columns and `.project-funnel`
  in the right 5; stacks ≤1023px.

---

## 6. Analytics, consent, and third parties

- **Google Ads** tag `AW-18182297582` is live on all three pages, with a
  conversion event `AW-18182297582/4NM8CKTh37EcEO6v_91D`.
- Google **consent mode** defaults everything to `denied` in an inline script in
  `<head>`, before the gtag loader. Consent is stored in `localStorage` under
  `phantasma_cookie_consent` (`accepted` or `declined`), and the banner is
  `#cookie-banner`.
- **GA4 is not wired up yet** — placeholder comment at `index.html:99` waiting
  for a measurement ID.
- **Calendly**: `https://calendly.com/lomiddze/30min`, constant `CALENDLY_URL`
  in `script.js`. Deliberately lazy-loaded so no third-party request fires
  before the user asks. Its height is pinned to avoid an internal scrollbar
  (commits `96ff2f8`, `3c00b15`) — do not "fix" that by removing the height.

- **Keepz (payments)** — merchant dashboard `app.keepz.me`, settles to the
  owner's TBC Individual-Entrepreneur account. The three **Pay now** buttons on
  `projects.html` / `projects.ka.html` are fixed-amount Keepz payment links,
  used as the *direct* `app.keepz.me/pay?…productId=…` URL (the
  `tiny.keepz.me` short links are tinyurl redirects — don't use them).
  Detective ₾10 `productId=150bec12…`, Essential ₾50 `f51bd2a4…`, Advanced
  ₾80 `04216b80…`. **All three links expire 31-12-2026** — recreate in Keepz
  → Payment links and update both HTML files. Payments are one-off (no
  recurring). The Keepz REST API needs server-side RSA/AES encryption and a
  callback URL, so it is impossible from GitHub Pages — that is the Supabase
  Edge Function job when the backend exists.

- **Supabase (accounts)** — project `Phantasma`, `https://muumpjtpjnoxxdkhqtik.supabase.co`,
  eu-central-1, free tier (pauses after 7 idle days — move to Pro before real
  clients). Auth: Email magic link + Google (Cloud project `phantasma-508619`,
  OAuth client under `lomiddze@gmail.com`). Redirect URLs must include
  `https://solvephantasma.com/*` and `http://localhost:8000/*`. Publishable key
  is in `script.js` by design; the secret/service_role key never leaves
  Supabase. supabase-js 2.58.0 UMD from jsDelivr, loaded before `script.js` on
  every page except `landing.html`. Schema and RLS are owned by the Solve
  Assistant repo — see `supabase/README.md`. Header CTA is now **Log in /
  Account** on all pages except `landing.html` (kept "Book a call").

The consent-mode `<head>` block is duplicated across **all six** HTML files. If
you change it, change it in all of them.

---

## 7. SEO

- Per-page: canonical link, Open Graph, Twitter card. OG image is
  `images/Social Sharing Image - 1.png` (1200x630).
- `index.html` has a **JSON-LD `ProfessionalService`** block in `<head>`.
- `index.html` ends with a `.visually-hidden` `<section>` containing the full
  text of all 7 case studies, so Google can index content that otherwise only
  exists inside the JS-driven lightbox. **If you edit case copy in `CASES`,
  update this block too** — they are maintained by hand, in parallel.
- `robots.txt` disallows `/landing.html` (paid-traffic page, kept out of the
  index). `sitemap.xml` lists only `/` and `/blog.html`.
- `blog.html` articles use ids of the form `case-<slug>`.

---

## 8. Images

Site markup always references **`.webp`**. Sources stay in `images/` alongside.

To add or re-encode an image: drop the source in `images/`, add its filename to
the `images` array in `convert-images.js`, then `node convert-images.js`. It
writes a sibling `.webp` at quality 82 and logs the size delta. Past conversion
averaged ~90% reduction.

Two image roles, easily confused:

- `Slider Thumbnail N - *.webp` — the case reel tiles
- `caseN-built.webp` — the "What we built" lightbox slide

There are also `.docx` case descriptions in `images/` — source material for
the copy, not used by the site.

---

## 9. Known open items

Still open — need information or a decision from the owner:

1. **GA4 measurement ID missing.** Placeholder comment in all five pages
   (`index.html:99`, `landing.html:56`, `blog.html:58`, both `projects*.html`
   ~line 58). Add `gtag('config', 'G-XXXXXXXXXX')` behind the consent gate.
2. **Footer LinkedIn link is `href="#"`** — `index.html:431`.
3. **Owner to verify in Keepz (not a site change):** each of the three payment
   links should be **მრავალჯერადი (multi-use)**, not one-time; commission
   type Receiver vs Sender is a pricing choice; and add one **additional
   field** shown to the payer (type "მომხმარებლის აიდი" or Email, prefilled
   value `your@email.com`) so payments can be matched to a person. Last
   screenshot seen (12 Sep 2026) still showed one-time + Sender on the ₾10 link.
4. **Georgian copy review.** `projects.ka.html` was machine-translated by
   Claude; the owner (native speaker) has not yet proofread it. Tier names
   used: დეტექტივი / ძირითადი / გაფართოებული.
5. **`career.solvephantasma.com`** — owner wants this subdomain. Recommended:
   GoDaddy → DNS → **Forwarding** tab → subdomain `career` → 301 to
   `https://solvephantasma.com/projects.html` (no CNAME; GitHub Pages serves
   one custom domain per repo). Not yet done as of 12 Sep 2026.
6. **Pre-existing:** `index.html` scrolls ~28px sideways on phones because
   the case reel's slides extend past the viewport (`.case-reel__slide`).
   Present before any of this work; not investigated.
7. **Payments identity.** Login exists (15 Sep 2026). Pay now now writes a
   `pending` `subscriptions` row for the signed-in user before Keepz opens, so
   the owner matches Keepz dashboard payments by time/amount and sets the row
   `active` by hand. Automated Keepz callback via Edge Function still not
   started.
8. **Schema gaps to fix in Solve Assistant `schema.sql`** (reported 15 Sep
   2026, not changed from here): `candidates` and `shortlists` update policies
   are row-level only — add column grants so clients can write only the intake
   columns / `client_decision`. Move the `advanced` plan seed from
   `0002-site-additions.sql` into `schema.sql`.
9. **Georgian `account.html`** not built; `projects.ka.html` links to the English one.
10. **Supabase built-in email** is rate-limited (few/hour) — set SMTP
    (Resend or Workspace) before real sign-ups. Privacy-policy page still
    missing; Google/LinkedIn consent screens want a URL. LinkedIn provider not
    set up (needs a Company Page).

Closed (12 Sep 2026): reel thumbnails swap fixed; `.gitignore` covers the
ClickUp token file and scratch dirs; dead CSS section 10 and half of 12
removed (`.chips`/`.chip` are live — keep them); mobile hamburger nav added;
hero `nowrap` clipping fixed; Keepz Pay now buttons; Detective tier; Georgian
page + language toggle; KPI funnel (right column beside Overview).

Uncommitted in the working tree: `.claude/settings.json` (unrelated
harness settings, left alone deliberately).

---

## 10. Working agreements

- Match the surrounding code. This codebase is plain, commented, and
  hand-maintained; keep it that way.
- Keep changes small and commit them with a specific, plain-language subject
  line. Look at `git log` for the established tone — e.g. *"Fix reel thumbnail
  path — use c.built.thumbnail"*.
- Accessibility is already invested in: `aria-labelledby` on every section,
  `aria-live` regions, focus management and focus restore in the lightbox,
  `.visually-hidden` for screen-reader-only content. Do not regress it.
- Content changes that touch a case study usually need edits in **three**
  places: `CASES` in `script.js`, the hidden SEO block in `index.html`, and the
  article in `blog.html`.
- Commit or push only when asked.
