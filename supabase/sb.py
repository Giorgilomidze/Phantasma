r"""
Shared helper for the Supabase scripts in this folder.

  * env()      -> loads ../.env (SUPABASE_ACCESS_TOKEN, optionally SUPABASE_SERVICE_ROLE_KEY)
  * sql(text)  -> runs SQL on the Phantasma project through the Management API
                  (needs the personal access token). Returns rows for SELECTs.
  * service_key() -> the service_role key; read from .env, otherwise fetched
                  once via the Management API and cached into .env.

Nothing here is imported by the website. Never commit .env.
"""

import io
import json
import os
import sys
import urllib.error
import urllib.request

PROJECT_REF = "muumpjtpjnoxxdkhqtik"
SUPABASE_URL = f"https://{PROJECT_REF}.supabase.co"
MGMT = "https://api.supabase.com/v1"
ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")

_env = None


def env():
    global _env
    if _env is None:
        _env = {}
        if os.path.exists(ENV_PATH):
            for line in io.open(ENV_PATH, encoding="utf-8"):
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    _env[k.strip()] = v.strip().strip('"').strip("'")
        if "SUPABASE_ACCESS_TOKEN" not in _env:
            sys.exit(f"SUPABASE_ACCESS_TOKEN missing in {ENV_PATH}")
    return _env


def _save_env():
    io.open(ENV_PATH, "w", encoding="utf-8").write("".join(f"{k}={v}\n" for k, v in env().items()))


def _mgmt(method, path, body=None):
    req = urllib.request.Request(
        MGMT + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": f"Bearer {env()['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            t = r.read().decode()
            return json.loads(t) if t else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode('utf-8', 'replace')[:800]}")


def sql(text):
    """Run SQL as the postgres role. Returns list of dicts (empty for DDL)."""
    return _mgmt("POST", f"/projects/{PROJECT_REF}/database/query", {"query": text}) or []


def service_key():
    e = env()
    if not e.get("SUPABASE_SERVICE_ROLE_KEY"):
        keys = _mgmt("GET", f"/projects/{PROJECT_REF}/api-keys?reveal=true")
        for k in keys:
            if k.get("name") == "service_role":
                e["SUPABASE_SERVICE_ROLE_KEY"] = k["api_key"]
                _save_env()
                break
        else:
            sys.exit("service_role key not found via Management API")
    return e["SUPABASE_SERVICE_ROLE_KEY"]


if __name__ == "__main__":
    print("project:", PROJECT_REF)
    print("tables:", [r["table_name"] for r in sql(
        "select table_name from information_schema.tables where table_schema='public' order by 1")])
    service_key()
    print("service_role key: ok (cached in .env)")
