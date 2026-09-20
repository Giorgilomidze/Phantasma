# LinkedIn mirror — file contract

The account page shows a client their LinkedIn profile **exactly as it is**
("mirror"). A rewritten version will be added later as a second column
`candidates.linkedin_improved` — same shape, so the page can show them side by side.
This file defines the mirror.

## Where
`D:\Web Development\Solve Assistant\Job Seek for candidates\<NNN Name date>\NNN II LinkedIn Audit.json`
(NNN + initials identical to `NNN II Job Shortlist.xlsx` in the same folder.)
Push with `python "D:\Web Development\Solve Phantasma web page development\supabase\sync_local.py" --only audits`
→ `candidates.linkedin_audit` (jsonb).

## Shape
```json
{
  "profile_url":  "linkedin.com/in/…",
  "retrieved_at": "2026-09-20",
  "sections": [
    { "section": "Headline",                  "text": "…" },
    { "section": "About",                     "text": "…" },
    { "section": "Experience",                "text": "…" },
    { "section": "Education",                 "text": "…" },
    { "section": "Licenses & certifications", "text": "…" },
    { "section": "Skills",                    "text": "…" },
    { "section": "Languages",                 "text": "…" },
    { "section": "Recommendations",           "text": "…" },
    { "section": "Projects",                  "text": "…" },
    { "section": "Volunteering",              "text": "…" }
  ]
}
```
No other keys (no score, no audited_at, no Photo & banner, no Activity).

## Rules
- Sections in this order; drop a section only if the profile has none.
- `text` is the profile wording **verbatim** — no summarising, no advice,
  no rephrasing, spelling mistakes included. Line breaks kept (`\n`).
  Expand every "…more" / "Show all" / "+N skills" first.
- Experience: one employer per block, blank line between blocks:
  `Company · Employment type · total duration`, then each role
  `Title` / `dates · duration` / `location · work mode` / description /
  `Skills: a, b, c`.
- Licenses & certifications: name / issuer / issued date / credential ID / skills.
- Skills: every skill, one per line, `Skill — N endorsements (linked role)`.
- Recommendations: full text and who wrote it, with their title.
- Empty string is allowed only if that section truly exists but has no text.

## Check before pushing
Giorgi Lomidze's file is the reference: ~15,000 characters, Experience ≈ 6,000,
Skills ≈ 6,000. A file under ~2,000 characters for a full profile is a retrieval
failure, not a short profile.

---

## Status — parked 20 Sep 2026

Stopped because LinkedIn retrieval is unreliable. State when parked:

- **Site:** the "LinkedIn audit" button is removed from `account.html` (comment
  marks the spot). `#linkedin-modal`, `paintAudit()` in `bootAccountPage`, and
  the `.li-audit*` styles are still in place; the JS only skips when the button
  is absent. **To resume:** put the button back —
  `<button class="btn btn-sm account__quiet" type="button" id="account-linkedin-btn" hidden>LinkedIn audit</button>`
  before the Change password button — and bump the cache version.
- **Cloud:** `candidates.linkedin_audit` jsonb exists (`0011`). Giorgi Lomidze's
  row holds a real text-shape mirror (~15k chars); 13 rows hold empty old-shape
  placeholders; Ani Gogitidze none. Harmless — nothing reads the column now.
- **Sync:** `sync_local.py --only audits` works and stays.

## Planned next step (agreed, not built)

1. Change this contract to a **structured** shape so the page can render the
   LinkedIn look (employer cards, roles with dates/location/mode, skill chips,
   certifications with credential IDs, skills with endorsement counts).
2. Rebuild `paintAudit()` to render it.
3. Add `candidates.linkedin_improved` (same shape). Modal gets two tabs —
   *As on LinkedIn* / *Suggested* — with changed fields highlighted.
4. Only then let the other session retrieve the 14 profiles; owner briefs the
   rewrite separately.
