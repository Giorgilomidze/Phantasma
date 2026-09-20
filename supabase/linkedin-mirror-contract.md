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
