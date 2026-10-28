#!/usr/bin/env python3
"""Generate 15 simulated game sessions -> sample_sessions.json (SIMULATED DATA).
Only 2 of the 15 sessions use the language switcher (the underused feature)."""
import json, random, time, uuid
random.seed(42)

# (user, started_game, levels_completed, features_used, used_language_switch)
SESSIONS = [
    ("u01", True, 3, ["sound_toggled", "share_clicked"], False),
    ("u02", True, 3, ["sound_toggled", "pause_clicked", "share_clicked"], False),
    ("u03", True, 3, ["hint_clicked", "share_clicked", "restart_clicked"], False),
    ("u04", True, 3, ["sound_toggled", "share_clicked", "restart_clicked"], True),
    ("u05", True, 3, ["pause_clicked", "sound_toggled", "share_clicked"], False),
    ("u06", True, 2, ["sound_toggled", "restart_clicked"], False),
    ("u07", True, 2, ["pause_clicked", "hint_clicked"], False),
    ("u08", True, 2, ["sound_toggled"], False),
    ("u09", True, 1, ["restart_clicked", "sound_toggled"], True),
    ("u10", True, 1, ["pause_clicked", "hint_clicked"], False),
    ("u11", True, 1, ["sound_toggled", "restart_clicked"], False),
    ("u12", True, 1, [], False),
    ("u13", True, 0, ["restart_clicked", "hint_clicked"], False),
    ("u14", True, 0, ["sound_toggled"], False),
    ("u15", False, 0, [], False),   # opened from QR, never pressed Start
]
OS = ["Android", "Android", "Android", "iOS", "iOS"]
BROWSER = {"Android": "Chrome", "iOS": "Mobile Safari"}

def build(now=None):
    now = int(now or time.time())
    start = now - 60 * 60  # spread over the last hour
    sessions = []
    for i, (uid, started, lv, feats, lang) in enumerate(SESSIONS):
        did = f"demo_{uid}_{uuid.UUID(int=random.getrandbits(128)).hex[:8]}"
        osn = random.choice(OS)
        base = {"distinct_id": did, "$os": osn, "$browser": BROWSER[osn], "utm_source": "qr",
                "game": "mango_catch", "simulated": True, "demo_session_id": f"sim_{uid}"}
        t = start + i * 220 + random.randint(0, 60)
        ev = []
        def add(name, **p):
            nonlocal t
            ev.append({"event": name, "time": t, "properties": {**base, "lang": cur["lang"], **p}})
        cur = {"lang": "en"}
        add("app_opened", referrer="qr")
        if lang:
            t += random.randint(2, 5); add("language_switch_clicked", **{"from": "en", "to": "ta", "screen": "start"}); cur["lang"] = "ta"
        if not started:
            sessions.append({"user": uid, "distinct_id": did, "events": ev}); continue
        t += random.randint(3, 8)
        pre = [f for f in feats if f == "sound_toggled"]
        mid = [f for f in feats if f in ("pause_clicked", "hint_clicked")]
        post = [f for f in feats if f in ("share_clicked", "restart_clicked")]
        for f in pre: add(f, sound_on=False, in_game=False); t += 2
        add("game_started", via="start_button")
        score = 0
        reached = min(lv + 1, 3)
        for L in range(1, reached + 1):
            add("level_started", level=L)
            if L == 1:
                for f in mid:
                    t += random.randint(4, 9)
                    add(f, level=L, **({"time_left": random.randint(5, 15)} if f == "pause_clicked" else {"in_game": True}))
                    if f == "pause_clicked": t += random.randint(3, 10); add("resume_clicked", level=L)
            score += random.randint(10, 18) + L * 3
            if L <= lv:
                t += 20 + random.randint(0, 3); add("level_completed", level=L, score=score)
                t += 2
            else:
                t += random.randint(6, 16); break
        dur = t - next(e["time"] for e in ev if e["event"] == "game_started")
        add("game_over", reason="completed" if lv == 3 else "out_of_lives", score=score,
            level_reached=reached, levels_completed=lv, duration_s=dur)
        for f in post:
            t += random.randint(2, 6)
            add(f, **({"score": score, "method": "native"} if f == "share_clicked" else {"from": "game_over", "prev_score": score}))
        sessions.append({"user": uid, "distinct_id": did, "events": ev})
    return sessions

def summary(sessions):
    n = len(sessions)
    feats = ["game_started", "sound_toggled", "restart_clicked", "share_clicked", "pause_clicked", "hint_clicked", "language_switch_clicked"]
    used = {f: sum(any(e["event"] == f for e in s["events"]) for s in sessions) for f in feats}
    lc = lambda L: sum(any(e["event"] == "level_completed" and e["properties"]["level"] == L for e in s["events"]) for s in sessions)
    funnel = [("app_opened", n), ("game_started", used["game_started"]), ("level_1_completed", lc(1)), ("level_2_completed", lc(2)), ("level_3_completed", lc(3))]
    return {"sessions": n, "feature_sessions": used, "funnel": funnel}

if __name__ == "__main__":
    s = build()
    out = {"_note": "SIMULATED sample data for the GDG 'Beyond the UI' demo. Not real users.",
           "generated_at": int(time.time()), "sessions": s, "summary": summary(s)}
    json.dump(out, open("sample_sessions.json", "w"), indent=1, ensure_ascii=False)
    print(json.dumps(out["summary"], indent=1))
