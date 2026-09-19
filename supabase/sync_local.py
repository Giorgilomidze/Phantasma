r"""
One-way sync: local Solve Assistant data  ->  Supabase (project Phantasma).

Reads
  * D:\Web Development\SQLite Databases\vacancies.db          (read-only, WAL-safe)
  * D:\Web Development\Solve Assistant\Job Seek for candidates\
        NNN Name YYYY-MM-DD\NNN II Job Shortlist.xlsx           (opened, never saved)

Writes (upserts) to Supabase, in dependency order:
  industries -> companies -> vacancies -> candidates -> shortlists -> sends
  -> workbooks (the .xlsx files themselves, to Storage bucket `shortlists`)

Rules baked in:
  * Uses the service_role key, so RLS is bypassed. The key comes from .env
    (SUPABASE_SERVICE_ROLE_KEY=...) next to the repo root; never commit it.
  * Never overwrites site-owned columns:
      candidates: account_id (only set when NULL), cv_url, target_titles,
                  min_salary, locations, work_language
      shortlists: client_decision
    PostgREST "merge-duplicates" updates only the columns we send, so simply
    not sending them is enough.
  * candidates.status: local values (lead|client) are allowed in the cloud
    since 0003; a candidate with an email is promoted to 'client'.
  * Everything else is a 1:1 mirror: industries, companies, company_aliases,
    function_keywords, runs, vacancies, prospects (LinkedIn register),
    candidates (+ workbook Notes tab), shortlists (+ why_matches, salary),
    sends.
  * Shortlist rows are matched to vacancies by the Apply hyperlink URL, then by
    (title, posted_at). Unmatched rows are reported, not written.

Usage
  python supabase/sync_local.py            # full sync
  python supabase/sync_local.py --dry-run  # read everything, write nothing
  python supabase/sync_local.py --only shortlists,candidates
"""

import argparse
import glob
import json
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request

import openpyxl

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb  # noqa: E402  (.env, service key)

SUPABASE_URL = sb.SUPABASE_URL
PROSPECTS_XLSX = r"D:\Web Development\Solve Assistant\Linkedin profiles.xlsx"
DB_PATH = r"D:\Web Development\SQLite Databases\vacancies.db"
SHORTLIST_GLOB = r"D:\Web Development\Solve Assistant\Job Seek for candidates\*\* Job Shortlist.xlsx"
BATCH = 500

ALLOWED_CANDIDATE_STATUS = {"lead", "prospect", "client", "paused", "churned"}
TABLES_IN_ORDER = ["industries", "companies", "company_aliases", "function_keywords", "runs",
                   "vacancies", "prospects", "candidates", "shortlists", "sends", "workbooks", "audits"]


# ---------------------------------------------------------------- helpers

class Rest:
    def __init__(self, key, dry_run):
        self.key = key
        self.dry_run = dry_run

    def _req(self, method, path, body=None, prefer=None, params=None):
        url = f"{SUPABASE_URL}/rest/v1/{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                text = resp.read().decode("utf-8")
                return json.loads(text) if text else None
        except urllib.error.HTTPError as e:
            sys.exit(f"{method} {path} -> {e.code}: {e.read().decode('utf-8', 'replace')[:600]}")

    def select(self, table, columns, extra=None):
        """Page through a table with the service key (no RLS)."""
        rows, offset = [], 0
        while True:
            params = {"select": columns, "offset": offset, "limit": 1000}
            if extra:
                params.update(extra)
            page = self._req("GET", table, params=params) or []
            rows.extend(page)
            if len(page) < 1000:
                return rows
            offset += 1000

    def upsert(self, table, rows, on_conflict):
        if not rows:
            print(f"  {table:<12} nothing to send")
            return
        if self.dry_run:
            print(f"  {table:<12} would upsert {len(rows)} rows (dry run)")
            return
        for i in range(0, len(rows), BATCH):
            self._req(
                "POST", table, body=rows[i:i + BATCH],
                prefer="resolution=merge-duplicates,return=minimal",
                params={"on_conflict": on_conflict},
            )
        print(f"  {table:<12} upserted {len(rows)} rows")


def workbooks():
    """Every shortlist workbook, skipping Excel's ~$ lock files (workbook open)."""
    return sorted(p for p in glob.glob(SHORTLIST_GLOB) if not os.path.basename(p).startswith("~$"))


def linkedin_slug(url):
    """'https://www.linkedin.com/in/Giorgi-Lomidze-00425972/' -> 'giorgi-lomidze-00425972'"""
    if not url:
        return None
    m = re.search(r"linkedin\.com/in/([^/?#]+)", url, re.I)
    return m.group(1).strip().lower() if m else None


def rows_of(con, sql, args=()):
    return [dict(r) for r in con.execute(sql, args)]


# ---------------------------------------------------------------- sync steps

def sync_industries(con, rest):
    rows = rows_of(con, "select name, sort from industries")
    rest.upsert("industries", rows, "name")


def sync_companies(con, rest):
    cols = ["name", "name_ka", "legal_name_ka", "id_code", "industry", "description", "website",
            "linkedin_url", "logo_url", "hq_city", "size_band", "founded_year", "employees",
            "vacancy_functions", "is_target_employer", "source_slug", "notes", "profiled_at", "created_at"]
    rows = []
    for r in rows_of(con, "select * from companies"):
        row = {"local_id": r["id"]}
        for c in cols:
            row[c] = r.get(c)
        if row["id_code"] is not None and not re.fullmatch(r"[0-9]{9}", str(row["id_code"])):
            row["id_code"] = None
        if row["is_target_employer"] not in ("yes", "no", "unknown"):
            row["is_target_employer"] = "unknown"
        rows.append(row)
    rest.upsert("companies", rows, "local_id")


def company_map(rest):
    """cloud companies: local_id -> id"""
    return {r["local_id"]: r["id"] for r in rest.select("companies", "id,local_id") if r["local_id"] is not None}


def sync_vacancies(con, rest, cmap):
    cols = ["source", "source_id", "url", "title", "title_en", "company_raw", "location", "function",
            "seniority", "description", "salary_text", "language", "posted_at", "deadline_at",
            "first_seen", "last_seen", "last_checked", "status", "dedup_key", "client_slug"]
    rows, missing_company = [], 0
    for r in rows_of(con, "select * from vacancies"):
        row = {"local_id": r["id"]}
        for c in cols:
            row[c] = r.get(c)
        if row["status"] not in ("live", "expired", "gone", "unknown"):
            row["status"] = "unknown"
        cid = r.get("company_id")
        row["company_id"] = cmap.get(cid) if cid is not None else None
        if cid is not None and row["company_id"] is None:
            missing_company += 1
        rows.append(row)
    if missing_company:
        print(f"  note: {missing_company} vacancies reference a company not in the cloud (company_id left NULL)")
    rest.upsert("vacancies", rows, "local_id")


def vacancy_map(rest):
    """cloud vacancies: local_id -> id, and url -> id"""
    by_local, by_url = {}, {}
    for r in rest.select("vacancies", "id,local_id,url"):
        if r["local_id"] is not None:
            by_local[r["local_id"]] = r["id"]
        by_url[r["url"]] = r["id"]
    return by_local, by_url


def sync_candidates(con, rest):
    prof = rest.select("profiles", "id,email,linkedin_url,cv_path")
    cv_by_profile = {p["id"]: p.get("cv_path") for p in prof}
    profiles = {p["email"].lower(): p["id"] for p in prof if p.get("email")}
    # LinkedIn slug (the part after /in/) -> profile id, from what clients typed
    by_slug = {}
    for p in prof:
        sl = linkedin_slug(p.get("linkedin_url"))
        if sl:
            by_slug[sl] = p["id"]
    existing = {c["slug"]: c for c in rest.select("candidates", "slug,account_id,status")}
    cols = ["name", "headline", "function", "seniority", "started_at", "sheet_no", "profile_url",
            "company_current", "folder", "match_rules", "notes"]
    notes = read_workbook_notes()
    rows, linked, unlinked = [], [], []
    for r in rows_of(con, "select * from candidates"):
        row = {"slug": r["slug"]}
        for c in cols:
            row[c] = r.get(c)
        email = (r.get("email") or "").strip().lower()
        status = r.get("status")
        if email:
            status = "client"
        elif status not in ALLOWED_CANDIDATE_STATUS:
            status = "prospect"
        row["status"] = status
        row["email"] = email or None
        row["workbook_notes"] = notes.get(r.get("folder"))
        # link the login once; never clobber a link the site already made.
        # (PostgREST bulk upserts need identical keys on every row, so the
        # column is always sent — with the existing value when there is one.)
        prev = existing.get(r["slug"]) or {}
        row["account_id"] = prev.get("account_id")
        if not row["account_id"]:
            sl = linkedin_slug(r.get("profile_url")) or r["slug"].lower()
            if email and email in profiles:
                row["account_id"] = profiles[email]
                linked.append(f"{r['slug']} -> {email}")
            elif sl in by_slug:
                row["account_id"] = by_slug[sl]
                linked.append(f"{r['slug']} -> linkedin.com/in/{sl}")
            elif email:
                unlinked.append(f"{r['slug']} ({email} has not signed in yet)")
        # the CV the client uploaded on the site, once the login is linked
        if row["account_id"] and cv_by_profile.get(row["account_id"]):
            row["cv_url"] = cv_by_profile[row["account_id"]]
        rows.append(row)
    # PostgREST bulk rows must share keys: give every row the cv_url key,
    # keeping the cloud's current value where the site has nothing.
    cur_cv = {c["slug"]: c.get("cv_url") for c in rest.select("candidates", "slug,cv_url")}
    for row in rows:
        row.setdefault("cv_url", cur_cv.get(row["slug"]))
    rest.upsert("candidates", rows, "slug")
    for line in linked:
        print(f"  linked  {line}")
    for line in unlinked:
        print(f"  waiting {line}")


def sync_company_aliases(con, rest, cmap):
    rows, skipped = [], 0
    for r in rows_of(con, "select alias, company_id, raw from company_aliases"):
        cid = cmap.get(r["company_id"])
        if cid is None:
            skipped += 1
            continue
        rows.append({"alias": r["alias"], "company_id": cid, "raw": r["raw"]})
    if skipped:
        print(f"  note: {skipped} aliases skipped (company not in cloud)")
    rest.upsert("company_aliases", rows, "alias")


def sync_function_keywords(con, rest):
    rows = rows_of(con, "select function, keyword, weight from function_keywords")
    rest.upsert("function_keywords", rows, "function,keyword")


def sync_runs(con, rest):
    rows = rows_of(con, "select source, started, finished, found, new_rows, errors from runs")
    rest.upsert("runs", rows, "source,started")


def sync_prospects(rest):
    """Linkedin profiles.xlsx -> prospects. Header on row 4, data from row 5."""
    ws = openpyxl.load_workbook(PROSPECTS_XLSX, read_only=True)["Prospects"]
    cols = ["process", "no", "name", "headline", "company", "function", "seniority", "credentials",
            "headline_score", "headline_band", "profile_weakness", "pitch_angle", "priority",
            "profile_url", "source", "date_added", "email"]
    rows = []
    for r in ws.iter_rows(min_row=5, values_only=True):
        if r[1] is None or r[2] is None:
            continue
        row = dict(zip(cols, r[:len(cols)]))
        row["no"] = int(row["no"])
        row["process"] = str(row["process"]).strip().title() if row["process"] not in (None, "") else None
        row["headline_score"] = int(row["headline_score"]) if row["headline_score"] not in (None, "") else None
        for k in ("date_added", "email", "profile_url"):
            row[k] = str(row[k]).strip() if row[k] not in (None, "") else None
        rows.append(row)
    rest.upsert("prospects", rows, "no")


def read_workbook_notes():
    """The Notes tab of every shortlist workbook -> {folder: {label: text}}."""
    out = {}
    for path in workbooks():
        folder = os.path.basename(os.path.dirname(path))
        wb = openpyxl.load_workbook(path, read_only=True)
        if "Notes" not in wb.sheetnames:
            continue
        notes = {}
        for r in wb["Notes"].iter_rows(min_row=3, values_only=True):
            if r[0] and r[1]:
                notes[str(r[0]).strip()] = str(r[1]).strip()
        out[folder] = notes or None
    return out


def read_shortlists(con, by_local, by_url):
    """Parse every workbook. Returns (rows, unmatched) where rows are cloud-ready."""
    folder_to_slug = {r["folder"]: r["slug"] for r in rows_of(con, "select slug, folder from candidates") if r["folder"]}
    rows, unmatched = [], []
    for path in workbooks():
        folder = os.path.basename(os.path.dirname(path))
        slug = folder_to_slug.get(folder)
        if not slug:
            unmatched.append(f"{folder}: no candidate row has this folder")
            continue
        wb = openpyxl.load_workbook(path)          # never saved
        for ws in wb.worksheets:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", ws.title):
                continue                              # Notes tab etc.
            week = ws.title
            for row in ws.iter_rows(min_row=5):
                rank, title, posted = row[0].value, row[1].value, row[3].value
                if rank is None or title is None:
                    continue
                link = row[10].hyperlink.target if len(row) > 10 and row[10].hyperlink else None
                vid = by_url.get(link) if link else None
                if vid is None:
                    hit = con.execute("select id from vacancies where title=? and posted_at=?", (title, posted)).fetchone()
                    vid = by_local.get(hit[0]) if hit else None
                if vid is None:
                    unmatched.append(f"{folder} / {week} / #{rank} {title!r}")
                    continue
                mark = row[11].value if len(row) > 11 else None
                start = {"yes": True, "no": False}.get(str(mark).strip().lower()) if mark not in (None, "") else None
                rows.append({
                    "candidate": slug,
                    "vacancy_id": vid,
                    "week": week,
                    "rank": int(rank),
                    "start_processing": start,
                    "salary_text": None if row[5].value in (None, "—") else str(row[5].value),
                    "why_matches": row[6].value,
                })
    return rows, unmatched


def sync_shortlists(con, rest, by_local, by_url):
    rows, unmatched = read_shortlists(con, by_local, by_url)
    rest.upsert("shortlists", rows, "candidate,vacancy_id,week")
    for line in unmatched:
        print(f"  unmatched {line}")


def sync_workbooks(con, rest):
    """Upload every shortlist workbook to bucket `shortlists` at <slug>/<file>
    and record the path on candidates.workbook_path. Overwrites each run."""
    folder_to_slug = {r["folder"]: r["slug"] for r in rows_of(con, "select slug, folder from candidates") if r["folder"]}
    key = sb.service_key()
    n = 0
    for path in workbooks():
        folder = os.path.basename(os.path.dirname(path))
        slug = folder_to_slug.get(folder)
        if not slug:
            continue
        name = os.path.basename(path)
        object_path = f"{slug}/{name}"
        if rest.dry_run:
            print(f"  workbook     would upload {object_path}")
            continue
        with open(path, "rb") as fh:
            data = fh.read()
        req = urllib.request.Request(
            f"{SUPABASE_URL}/storage/v1/object/shortlists/{urllib.parse.quote(object_path)}",
            data=data, method="POST",
            headers={"apikey": key, "Authorization": f"Bearer {key}", "x-upsert": "true",
                     "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})
        try:
            urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:
            print(f"  workbook     FAILED {object_path}: {e.code} {e.read().decode('utf-8', 'replace')[:200]}")
            continue
        rest._req("PATCH", "candidates",
                  body={"workbook_path": object_path, "workbook_uploaded_at": dt_now()},
                  prefer="return=minimal", params={"slug": f"eq.{slug}"})
        n += 1
    print(f"  workbook     uploaded {n} file(s)")


def sync_linkedin_audits(con, rest):
    """<folder>/NNN II LinkedIn Audit.json -> candidates.linkedin_audit (jsonb)."""
    folder_to_slug = {r["folder"]: r["slug"] for r in rows_of(con, "select slug, folder from candidates") if r["folder"]}
    n = 0
    for path in sorted(glob.glob(os.path.join(os.path.dirname(SHORTLIST_GLOB), "* LinkedIn Audit.json"))):
        folder = os.path.basename(os.path.dirname(path))
        slug = folder_to_slug.get(folder)
        if not slug:
            print(f"  audit        skipped {folder}: no candidate row has this folder")
            continue
        with open(path, encoding="utf-8") as fh:
            audit = json.load(fh)
        if rest.dry_run:
            print(f"  audit        would set {slug}")
            continue
        rest._req("PATCH", "candidates", body={"linkedin_audit": audit},
                  prefer="return=minimal", params={"slug": f"eq.{slug}"})
        n += 1
    print(f"  audit        set {n} candidate(s)")


def dt_now():
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sync_sends(con, rest, by_local):
    rows, skipped = [], 0
    for r in rows_of(con, "select * from sends"):
        vid = by_local.get(r["vacancy_id"])
        if vid is None:
            skipped += 1
            continue
        rows.append({
            "vacancy_id": vid,
            "candidate": r["candidate"],
            "sent_at": r.get("sent_at"),
            "outcome": r.get("outcome") or "sent",
            "outcome_at": r.get("outcome_at"),
            "notes": r.get("notes"),
        })
    if skipped:
        print(f"  note: {skipped} sends skipped (vacancy not in cloud)")
    rest.upsert("sends", rows, "vacancy_id,candidate")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="read everything, write nothing")
    ap.add_argument("--only", help="comma-separated subset of: " + ",".join(TABLES_IN_ORDER))
    args = ap.parse_args()

    only = set(args.only.split(",")) if args.only else set(TABLES_IN_ORDER)
    bad = only - set(TABLES_IN_ORDER)
    if bad:
        sys.exit(f"unknown table(s): {', '.join(sorted(bad))}")

    rest = Rest(sb.service_key(), args.dry_run)
    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row

    print(("DRY RUN — " if args.dry_run else "") + f"syncing to {SUPABASE_URL}")
    if "industries" in only:
        sync_industries(con, rest)
    if "companies" in only:
        sync_companies(con, rest)
    cmap = company_map(rest) if only & {"vacancies", "company_aliases"} else None
    if "company_aliases" in only:
        sync_company_aliases(con, rest, cmap)
    if "function_keywords" in only:
        sync_function_keywords(con, rest)
    if "runs" in only:
        sync_runs(con, rest)
    if "vacancies" in only:
        sync_vacancies(con, rest, cmap)
    if "prospects" in only:
        sync_prospects(rest)
    if "candidates" in only:
        sync_candidates(con, rest)
    if only & {"shortlists", "sends"}:
        by_local, by_url = vacancy_map(rest)
        if "shortlists" in only:
            sync_shortlists(con, rest, by_local, by_url)
        if "sends" in only:
            sync_sends(con, rest, by_local)
    if "workbooks" in only:
        sync_workbooks(con, rest)
    if "audits" in only:
        sync_linkedin_audits(con, rest)
    print("done")


if __name__ == "__main__":
    main()
