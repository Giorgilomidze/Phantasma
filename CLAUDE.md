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

---

## 3. File map

| File | Role |
|---|---|
| `index.html` | Main site (500 lines) |
| `landing.html` | Paid-ads landing page — hero / approach / booking only |
| `blog.html` | Case-studies page: 7 hand-written articles, sticky sidebar, scroll-spy |
| `script.js` | All behaviour + the `CASES` data (1354 lines) |
| `styles.css` | All styles, numbered sections (2313 lines) |
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
| `bootCaseReel()` | Infinite auto-scrolling carousel, 4 visible, 5s interval, arrows + dots |
| `Lightbox` | Module (IIFE) — 6-slide case-study viewer with keyboard nav |
| `bootApproachStrip()` | Scroll-driven progress through the 5 approach stations |
| `bootCalendly()` | Lazy-loads Calendly on click of `#calendly-placeholder` |
| `bootImageZoom()` | Click-to-zoom on case images |
| `bootCookieBanner()` | GDPR banner + Google consent-mode update |

`init()` runs on `DOMContentLoaded`. **All three pages load the same
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

The consent-mode `<head>` block is duplicated across all three HTML files. If
you change it, change it in all three.

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

Still open — both blocked on information only the owner has:

1. **GA4 measurement ID missing.** The placeholder comment sits in **all three**
   pages, not just `index.html`: `index.html:99`, `landing.html:56`,
   `blog.html:58`. When the ID arrives, add
   `gtag('config', 'G-XXXXXXXXXX')` in all three, behind the existing
   consent-mode gate.
2. **Footer LinkedIn link is `href="#"`** — `index.html:431`. Only dead link on
   the site.

Closed:

3. ~~Suspected swapped reel thumbnails.~~ **Confirmed and fixed.** They *were*
   reversed. Verified against the artwork itself: "Slider Thumbnail 3 - Warehouse
   forecasting" depicts a sales forecast at 98% accuracy, 12k SKU segmentation
   and a golden-record panel → that is `demand-forecasting`. "Slider Thumbnail 6
   - Failed project transformation" depicts "THE MONOLITH", PHP, a
   microservices-oriented cloud architecture and Azure DevOps CI/CD → that is
   `monolith-recovery`. Swapped accordingly. Note the filenames are misleading:
   **thumbnail numbers do not correspond to case order.** Check the image, not
   the name. (Similar pharmacy/IoT swap was fixed in `8380b38`.)
4. ~~ClickUp API token not git-ignored.~~ **Fixed** — `.claude/settings.local.json`
   is now in the repo `.gitignore`. It had been ignored only via the machine's
   *global* gitignore, which protected this checkout but would not protect a
   clone or a collaborator. The token is still plaintext in that file, so keep
   the ignore rule in place. `.claude/settings.json` is safe to commit.
5. ~~Untracked scratch dirs clutter `git status`.~~ **Fixed** — `Fantasma OLD/`
   (39 MB) and `Miscelanous trash/` (4.1 MB) are now git-ignored.
6. ~~Dead CSS and vestigial `CASES` keys.~~ **Fixed** — removed section 10
   (Bento: `.work*`, `.bento*`, `.tile*`), the dead half of section 12
   (`.stack*`, `.chip__dot`), and the three orphaned `@media` blocks that
   targeted them; plus the write-only `area` / `tileSize` keys from all 7 `CASES`
   entries. 275 lines out of `styles.css`, 14 out of `script.js`. **`.chips` and
   `.chip` were kept — they are live** (see section 5).

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
