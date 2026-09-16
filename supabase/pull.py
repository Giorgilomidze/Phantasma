r"""
Pull data out of Supabase to the local disk (no browser).

  python supabase/pull.py tables             # every public table -> exports\<date>\<table>.csv (+ .json)
  python supabase/pull.py tables profiles preferences
  python supabase/pull.py cvs                # every file in the private `cvs` bucket -> exports\cvs\<user_id>\<file>
  python supabase/pull.py sql "select email, linkedin_url from profiles"   # ad-hoc query -> prints + exports\query.csv

Uses the service_role key (RLS bypassed) and the Management API via sb.py.
Output goes to .\exports\ (git-ignored). Never copy exports into a synced folder.
"""

import csv
import datetime as dt
import io
import json
import os
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "exports")


def _rest(path, params=None):
    key = sb.service_key()
    url = f"{sb.SUPABASE_URL}/{path}" + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    return urllib.request.urlopen(req)


def write(rows, path_base):
    os.makedirs(os.path.dirname(path_base), exist_ok=True)
    with io.open(path_base + ".json", "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=1, default=str)
    if rows:
        cols = list(rows[0].keys())
        with io.open(path_base + ".csv", "w", encoding="utf-8-sig", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=cols)
            w.writeheader()
            for r in rows:
                w.writerow({k: (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v) for k, v in r.items()})
    print(f"  {os.path.relpath(path_base, ROOT)}.csv  ({len(rows)} rows)")


def pull_tables(names):
    day = dt.date.today().isoformat()
    if not names:
        names = [r["table_name"] for r in sb.sql(
            "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1")]
    for t in names:
        rows = sb.sql(f'select * from "{t}"')
        write(rows, os.path.join(OUT, day, t))


def pull_cvs():
    key = sb.service_key()
    body = json.dumps({"prefix": "", "limit": 1000, "offset": 0}).encode()
    req = urllib.request.Request(f"{sb.SUPABASE_URL}/storage/v1/object/list/cvs", data=body, method="POST",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    folders = [o["name"] for o in json.load(urllib.request.urlopen(req)) if o.get("id") is None]
    n = 0
    for folder in folders:
        body = json.dumps({"prefix": folder + "/", "limit": 1000, "offset": 0}).encode()
        req = urllib.request.Request(f"{sb.SUPABASE_URL}/storage/v1/object/list/cvs", data=body, method="POST",
                                     headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        for o in json.load(urllib.request.urlopen(req)):
            if o.get("id") is None:
                continue
            rel = f"{folder}/{o['name']}"
            dest = os.path.join(OUT, "cvs", folder, o["name"])
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with _rest(f"storage/v1/object/cvs/{urllib.parse.quote(rel)}") as r, open(dest, "wb") as fh:
                fh.write(r.read())
            n += 1
            print("  " + os.path.relpath(dest, ROOT))
    print(f"{n} file(s)")


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("tables", "cvs", "sql"):
        sys.exit(__doc__)
    cmd = sys.argv[1]
    if cmd == "tables":
        pull_tables(sys.argv[2:])
    elif cmd == "cvs":
        pull_cvs()
    else:
        rows = sb.sql(" ".join(sys.argv[2:]))
        for r in rows[:50]:
            print(r)
        write(rows, os.path.join(OUT, "query"))


if __name__ == "__main__":
    main()
