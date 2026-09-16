r"""
Apply numbered SQL migrations in this folder to the Supabase project, in order.

  python supabase/migrate.py            # apply every NNNN-*.sql not yet applied
  python supabase/migrate.py --force 0003   # re-apply one file (they are idempotent)

Applied files are recorded in public._migrations (name, applied_at).
Uses the Management API via sb.py (needs SUPABASE_ACCESS_TOKEN in ../.env).
"""

import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sb  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    force = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == "--force" else None
    sb.sql("create table if not exists _migrations (name text primary key, applied_at timestamptz default now())")
    done = {r["name"] for r in sb.sql("select name from _migrations")}
    for path in sorted(glob.glob(os.path.join(HERE, "[0-9][0-9][0-9][0-9]-*.sql"))):
        name = os.path.basename(path)
        if force and not name.startswith(force):
            continue
        if name in done and not force:
            print(f"  skip   {name}")
            continue
        text = open(path, encoding="utf-8").read()
        try:
            sb.sql(text)
        except RuntimeError as e:
            sys.exit(f"  FAILED {name}\n{e}")
        sb.sql(f"insert into _migrations (name) values ('{name}') on conflict (name) do update set applied_at = now()")
        print(f"  applied {name}")
    print("done")


if __name__ == "__main__":
    main()
