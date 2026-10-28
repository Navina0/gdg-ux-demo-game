#!/usr/bin/env python3
"""
Seed a Mixpanel project with the 15 SIMULATED sessions from sample_sessions.json
(only 2 of them use language_switch_clicked).

Timestamps are re-based so the sessions are spread over the hour before "now",
so they appear in today's reports.

USAGE
  # Recent events (< 5 days old) — only the project token is needed:
  python3 seed_mixpanel.py --token YOUR_PROJECT_TOKEN

  # Historical import (events older than 5 days, or if /track rejects them):
  # needs a Service Account (Org settings → Service accounts) + project id
  python3 seed_mixpanel.py --token TOKEN --import --project-id 1234567 \
        --sa-user my-sa.123.mp-service-account --sa-secret XXXXX [--days-ago 7]
  # (legacy alternative: --api-secret PROJECT_API_SECRET instead of --sa-user/--sa-secret)

  # Data residency: add --region eu  or  --region in
  # Dry run (print, send nothing):   --dry-run
Requires: Python 3.8+ (standard library only).
"""
import argparse, base64, json, os, sys, time, urllib.request, uuid

HOSTS = {"us": "https://api.mixpanel.com", "eu": "https://api-eu.mixpanel.com", "in": "https://api-in.mixpanel.com"}
HERE = os.path.dirname(os.path.abspath(__file__))

def load_events(days_ago):
    path = os.path.join(HERE, "sample_sessions.json")
    if os.path.exists(path):
        data = json.load(open(path, encoding="utf-8"))
    else:
        sys.path.insert(0, HERE); import make_sample_data as m
        data = {"sessions": m.build()}
    evs = [e for s in data["sessions"] for e in s["events"]]
    newest = max(e["time"] for e in evs)
    shift = int(time.time()) - 60 - days_ago * 86400 - newest
    out = []
    for e in evs:
        p = dict(e["properties"])
        p["time"] = e["time"] + shift
        p["$insert_id"] = uuid.uuid5(uuid.NAMESPACE_URL, f"{p['distinct_id']}|{e['event']}|{e['time']}").hex
        out.append({"event": e["event"], "properties": p})
    return out, data.get("summary")

def post(url, body, auth=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "Accept": "application/json"})
    if auth:
        req.add_header("Authorization", "Basic " + base64.b64encode(auth.encode()).decode())
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode()

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--token", default=os.environ.get("MIXPANEL_TOKEN"), help="Mixpanel project token")
    ap.add_argument("--region", choices=HOSTS, default="us")
    ap.add_argument("--import", dest="use_import", action="store_true", help="use /import (historical)")
    ap.add_argument("--project-id"); ap.add_argument("--sa-user"); ap.add_argument("--sa-secret"); ap.add_argument("--api-secret")
    ap.add_argument("--days-ago", type=int, default=0, help="shift data N days back (needs --import if > 5)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if not a.token or a.token == "YOUR_MIXPANEL_PROJECT_TOKEN":
        if not a.dry_run: sys.exit("Need a real --token (or MIXPANEL_TOKEN env). Use --dry-run to preview.")
    if a.days_ago > 5 and not a.use_import:
        sys.exit("Events older than 5 days are rejected by /track — add --import with service-account credentials.")
    events, summary = load_events(a.days_ago)
    for e in events: e["properties"]["token"] = a.token or "DRY_RUN"
    print(f"{len(events)} events from {len({e['properties']['distinct_id'] for e in events})} simulated sessions")
    if summary: print("summary:", json.dumps(summary))
    if a.dry_run:
        print(json.dumps(events[:3], indent=1)); return
    host = HOSTS[a.region]
    for i in range(0, len(events), 50):
        batch = events[i:i + 50]
        if a.use_import:
            if a.sa_user and a.sa_secret: auth = f"{a.sa_user}:{a.sa_secret}"
            elif a.api_secret: auth = f"{a.api_secret}:"
            else: sys.exit("--import needs --sa-user/--sa-secret (or --api-secret)")
            url = f"{host}/import?strict=1" + (f"&project_id={a.project_id}" if a.project_id else "")
            code, body = post(url, batch, auth)
        else:
            code, body = post(f"{host}/track?verbose=1", batch)
        print(f"batch {i // 50 + 1}: HTTP {code} {body[:200]}")
    print("Done. Data shows up in Mixpanel within ~1 minute (Events → filter simulated = true).")

if __name__ == "__main__":
    main()
