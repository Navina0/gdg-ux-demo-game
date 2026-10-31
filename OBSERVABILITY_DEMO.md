# Mango Catch — Frontend Observability demo sheet (GDG Salem, 31 Oct 2026)

Talk: **"Beyond the UI: How AI Can Help You Improve User Experience"**. Story: users don't tell you what's wrong, the
telemetry does → give the telemetry to AI → AI suggests the UX fix.

Every `track(name, props)` call goes to **3 places at once** (see `analytics.js`):

| Sink | What it's for in the talk | Needs | Where to look |
|---|---|---|---|
| **Mixpanel** (EU host) | Event counts, funnels, feature usage %, rage clicks, Web Vitals as events | token via `?mp_token=` (stored per device, removed from the URL) | Mixpanel → Events (live) / Insights / Funnels |
| **Google Analytics 4** (`G-6XY4T8T70S`, plain gtag.js) | Same events, live in Realtime for *every* phone (no token needed) | nothing | [GA4 Realtime](https://analytics.google.com/analytics/web/#/a414169165p561606788/reports/realtime) |
| **Local log** (`localStorage`) | Offline backup, `dashboard.html` | nothing | https://navina0.github.io/gdg-ux-demo-game/dashboard.html |

Plus **Firebase Performance Monitoring** (project `mango-catch`, `observability.js`) for *rendering speed*: page load,
network requests and 4 custom traces. Console: https://console.firebase.google.com/project/mango-catch/performance
(first data can take **several hours** to appear, so check it the evening before, not live on stage).

Every event also carries `lang` (en/ta). In GA4, `demo_session_id` is set on the config. Names are GA4-safe (lowercase, `_`, ≤ 40 chars).
No names, emails, scores-as-identity or tokens are ever sent (`name_entered` is yes/no only).

## Demo switches (URL parameters)
- `?mp_token=TOKEN`: enables Mixpanel on that device (remembered, then removed from the address bar). **Not committed.**
  Audience phones: give them a QR for `scan.html?utm_source=qr&mp_token=TOKEN` if you want their events in Mixpanel;
  the committed `qr.png` has no token, so those phones only report to GA4 + Firebase Perf.
- `?demo_error=1`: throws a harmless demo JavaScript error after 2 s → shows up as `js_error`.
- `?v=N`: cache-buster.

## Events: properties and talk points

### Funnel / core game
| Event | Properties | Talk point |
|---|---|---|
| `app_opened` | referrer, screen_w | Top of funnel |
| `start_screen_ready` | load_ms | "How long before the user could even tap Start?" |
| `game_started` | via / start_method (`quick_play` \| `choose_mode`), mode, sound_on, has_name, has_room_code, room_code | **Quick Play vs Choose mode / Enter code**: like *scan vs enter code at a charger*. Show most people pick the 1-tap path |
| `name_entered` | entered (yes/no), start_method | How many skip optional input (friction) |
| `level_started` | level | Funnel step |
| `level_completed` | level, score, lives_left | Drop-off between L1 → L2 |
| `game_over` | reason, score, level_reached, levels_completed, duration_s, … | End of funnel |
| `score_submitted` / `score_rejected` / `first_finisher` | score, hints_used, levels_completed, store, error | Server-side validation; errors are visible, not silent |
| `share_clicked` | score, method | Virality |

### Feature discovery (the "unused features" slide)
| Event | Properties | Talk point |
|---|---|---|
| `language_changed` | from, to, screen | The tiny **EN · த** switch: Tamil users exist, but hardly anyone finds it |
| `sound_toggled` | state (on/off), sound_on, level, in_game | Feature that nobody turns on/off |
| `hint_used` | level, in_game, hints_this_run | Is the hint useful or ignored? |
| `pause_used` / `resume_used` | level, time_left | Rarely used controls |
| `restart_used` | from (in_game/game_over), level, prev_score | Frustration vs replay |
| `choose_mode_opened` | open | Opened the advanced path at all? |
| `leaderboard_opened` | from (start/game_over), link (`hidden_small` = the low-contrast start-screen link) | **Hidden feature**: same feature, two placements, very different usage |
| `scan_page_opened`, `leaderboard_viewed`, `play_clicked`, `full_leaderboard_clicked` | utm_source, page, from | QR → play conversion |

### Frustration signals (the "users don't complain, they rage-click" slide)
| Event | Properties | Talk point |
|---|---|---|
| `bonus_clicked` | click_n, pending, claimed | The **🎁 Daily bonus** button takes ~3 s with *no feedback* |
| `rage_click` | target (e.g. `daily_bonus`), clicks_in_1s (3), page | 3+ clicks on the same control within 1 s. Fires on any button/link (not the game field) |
| `bonus_granted` | wait_ms, clicks_while_waiting, cosmetic: true | Show `clicks_while_waiting` > 0 → "add a spinner" is the AI's obvious fix. The bonus is cosmetic (sparkle), **score unchanged** |
| `js_error` | kind (error/unhandledrejection), message (≤150 chars, URLs/emails/numbers stripped), file, line, page | Errors users never report. Demo with `?demo_error=1` |

### Rendering speed (Core Web Vitals)
| Event | Properties | Talk point |
|---|---|---|
| `web_vital` | metric (LCP, CLS, INP, FCP, TTFB), value (ms; CLS unitless), rating (good/needs-improvement/poor), page, nav_type | "Fast for *whom*?": break down by rating / page. INP is reported when the page is hidden/left |

## Firebase Performance custom traces
| Trace | Attributes (≤ 5) | Metrics | Measures |
|---|---|---|---|
| `game_load` | page, from, language | — | navigation start → start screen ready |
| `level_play` | level, mode, outcome (completed/lost/restarted/abandoned), language | score, lives_left | one 30 s level |
| `score_submit` | store, levels, result (ok/rejected), error, language | — | `/score` round-trip to Render (cold start visible) |
| `leaderboard_load` | page (scan/leaderboard), store, state, cold_start, language | entries | until the first real leaderboard data (Render cold start ≈ 30–60 s) |

Firebase also records automatic page-load and network-request traces (Render API, CDNs).

## Suggested live flow
1. Open GA4 Realtime + Mixpanel Events side by side. Audience scans the QR and plays.
2. Show Quick Play vs Choose mode (`game_started` by `start_method`).
3. Show feature usage: `language_changed`, `sound_toggled`, `hint_used`, hidden `leaderboard_opened (link = hidden_small)`.
4. Show `rage_click target = daily_bonus` + `bonus_granted.clicks_while_waiting`.
5. Show `web_vital` by rating, and `score_submit` / `leaderboard_load` durations (Render cold start).
6. Paste the numbers into the AI prompt (`PROMPT_TEMPLATE.md` / dashboard) → AI proposes UX fixes.

## Config (public IDs only)
`config.js`: `GA_MEASUREMENT_ID` (`G-6XY4T8T70S`; also in the gtag `<script>` tags of `index.html`, `scan.html`, `leaderboard.html`),
`FIREBASE_WEB_CONFIG` (Performance only; it is not a secret), `MIXPANEL_API_HOST` (EU). `FIREBASE_CONFIG` stays `null` → scores stay on Render.
The Mixpanel token is **not** in the repo.

## Microsoft Clarity custom events (project z5u9dwxkxk)

| Event | When |
|---|---|
| `daily_bonus_clicked` | first tap on 🎁 Daily bonus |
| `rage_daily_bonus` | 3+ taps on 🎁 Daily bonus within 2 s (once per burst; also `clarity("upgrade")` so the recording is prioritised) |
| `dead_click_bait` | tap on the bobbing 🥭 "tap me" emoji on the start card, or the "GDG · Beyond the UI" footer pill (both do nothing on purpose) |
| `game_started`, `game_over` | game start / game over (tag `score_bucket` = 0-9, 10-29, 30+) |
| `chilli_hit` | a 🌶️ was tapped |
| `screen_start`, `screen_playing`, `screen_level_up`, `screen_paused`, `screen_game_over`, `screen_leaderboard_opened` | screen changes (tag `screen` has the same value) |

The Daily bonus now waits ~3 s with no feedback.
