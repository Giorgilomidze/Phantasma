# Personal Career Strategist — design brief for Stitch

Design a standalone website for **Personal Career Strategist**, a managed
job-search service in Georgia (the country). It is spinning out of the
Phantasma consultancy site (solvephantasma.com/projects.html) into its own
brand and domain (working name: hrdetective.solvephantasma.com).

Produce: a marketing landing page, a pricing section, a sign-in flow, and a
logged-in client dashboard. Desktop and mobile. English first, Georgian as a
second language with a visible language switch.

---

## 1. The business in one paragraph

Looking for a job is a full-time job. Listings are spread across a dozen
sites, half are filled by the time you find them, and every serious
application wants a CV rewritten for that role. Personal Career Strategist
does the legwork: **once a week, for four weeks**, we sweep the whole Georgian
job market (jobs.ge, hr.ge, TBC Bank and Bank of Georgia career feeds, more
sources on higher tiers), shortlist the ~15 vacancies that genuinely fit the
client, rewrite the CV and motivation letters where needed, and send the
applications the client approves. The client gets a running, numbers-first
report of everything found, sent and answered. **Nothing is sent without the
client's explicit go-ahead.**

Positioning: quiet, evidence-first, no hype. Every claim is a number from
real work. The service is run by one operator with a data pipeline behind it,
not a recruitment agency.

## 2. Who it is for

Mid-level and senior professionals in Georgia who are employed but looking:
sales managers, finance and internal audit, data/BI, marketing, logistics,
hospitality management. Age 28–45, LinkedIn-active, busy, sceptical of
agencies. They pay a small fixed fee and want to see work being done.

Second audience later: Georgians abroad looking to return.

## 3. What the client buys (pricing)

Three tiers, each a **four-week service, paid once** (no auto-renew), in GEL
via Keepz payment links:

| Tier | Price | What's in it |
|---|---|---|
| **Detective** | ₾10 | Job-market research on your behalf. An Excel file of every matching vacancy: company, role, description, link to the original posting. You send your CV and whatever background you're comfortable sharing. |
| **Essential** | ₾50 | Research across 5 HR and job-board sources. A modern, professionally written CV. Motivation letters where the vacancy needs one. Full reporting on every application sent and its progress. |
| **Advanced** | ₾80 | Everything in Essential, plus a CV tailored to each individual vacancy, and 4 additional sources — 9 in total. |

Footnote that must appear: prices in GEL, one-off charge, nothing renews
automatically, applications are only sent with the client's approval.

## 4. The proof (live numbers we can show)

The marketing page should carry a live "funnel" of what the operation has
done so far — these come from a JSON file and change weekly:

- Vacancies tracked: 6,103
- Companies searched: 2,239
- Profiles researched: 358
- Job markets investigated (candidates): 12
- Leads sent: 0 (honest; service is new)

Design it as a descending funnel of bands, widest at the top. Zero must still
render as a visible band. There is also a small "Updated 12 September 2026"
line.

## 5. How the service runs (for an "How it works" section)

1. **Brief** — client signs in, tells us target titles, minimum salary,
   locations, working language, uploads a CV.
2. **Weekly run** — we sweep every source, score every live vacancy against
   the brief, and shortlist the top 15 with a one-line "why it matches".
3. **Approve** — client marks each shortlisted vacancy *Interested* / *Not for
   me* in their dashboard.
4. **Send** — we write/tailor the CV and letter and submit. Every send is
   logged with its outcome: sent → applied → interview → offer / rejected /
   no reply.
5. **Report** — the dashboard counts everything; the client never has to ask
   "what happened".

## 6. The client dashboard (logged-in)

This exists today and works; redesign it, don't reinvent the data.

**Header:** signed-in email, Sign out.

**KPI tiles**, in a horizontal band of eight square cards (8 across on
desktop, 4 on tablet, 2 on phone). Each is a button; clicking opens **one**
detail panel under the row (clicking another tile swaps the panel):

| Tile | Value example | Panel shows |
|---|---|---|
| Weekly runs | 1 / 4 | run number, date, vacancies shortlisted that week |
| Vacancies processed | 15 | week, rank, company, position (link), why it matches, source, deadline |
| Companies reviewed | 9 | company, how many vacancies shortlisted |
| Selected for you | 0 | same as processed, only rows the operator marked to process |
| Applications sent | 0 | company, position, sent date, outcome, last update |
| Interviews | 0 | same, filtered |
| Offers | 0 | same, filtered |
| Last shortlist | 15 Sept 2026 | (not clickable) |

Numbers count up on load with a short stagger. Empty state when no run has
happened yet: "Your first shortlist is being prepared — the counters fill in
after the first weekly run."

**Below the tiles:** a short explanation ("Four weeks, one run a week…") and,
later, the brief form (target titles, min salary, locations, language, CV
upload), plan status and payment history.

## 7. Sign-in

Magic link by email or "Continue with Google". No passwords. Opens as a modal
from a **Log in** button in the header; after sign-in the button becomes
**Account**. "Pay now" on a pricing card asks for sign-in first, then opens
the payment page in a new tab.

## 8. Visual direction

Carry the parent brand's warmth but let this feel like its own product:

- Warm light palette: background `#f9f3eb`, surface `#f1e6d4`, ink `#2a221a`,
  accent terracotta `#c87651`, hairline rule `#dccfbf`. No dark mode.
- Type: **Fraunces** (display, soft optical sizes) + **General Sans** (body).
  Georgian pages use Noto Serif/Sans Georgian; never uppercase Georgian text.
- Tiles and panels read as *inlays*: surface fill, 1px rule border, faint
  inner shadow, small radius (4px). Cards larger radius (12px).
- Understated motion: fades and 8px rises, 200–360ms, staggered; respects
  reduced-motion.
- Tone of copy: plain, specific, short sentences. Numbers over adjectives.
  Example lines already in use: "Tangible solutions for abstract problems."
  / "We turn manual operations into measured systems." / "Nothing is sent
  without your explicit go-ahead."

## 9. Pages to design

1. **Home / landing** — hero with one-line promise + "See plans" and "Log in";
   how it works (5 steps); live funnel; pricing (3 cards, Pay now); FAQ
   (approval, one-off payment, data privacy, how long, what sources);
   footer with Facebook / LinkedIn / Instagram, email, language switch.
2. **Pricing** (can be a section of 1).
3. **Sign-in modal** (Google + email link, sent/error states).
4. **Dashboard** — tiles + panel, empty state and populated state.
5. **Brief / profile form** (for a later phase; a simple single-column form).
6. **Mobile** versions of 1 and 4.

## 10. Constraints

- Static site + Supabase backend; no heavy web-app chrome, no sidebars.
- Must work at 360px wide with 16px side gutters; tables scroll horizontally
  inside their own container, the page never scrolls sideways.
- Accessibility: visible focus rings, `aria-expanded` on tiles, one modal
  with focus trap, contrast AA on the warm palette.
- Georgian labels are ~40% wider than English — leave room in nav and tiles.
