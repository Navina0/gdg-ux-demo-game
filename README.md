# Mango Catch — GDG "Beyond the UI: How AI can help increase user experience" demo

**Play:** https://navina0.github.io/gdg-ux-demo-game/ · **Dashboard:** https://navina0.github.io/gdg-ux-demo-game/dashboard.html · QR: `qr.svg` (served from the `gh-pages` branch — push changes there)

A 1–3 minute mobile web game (no install, open from a QR code) instrumented with Mixpanel, with one
deliberately under-discoverable feature: the tiny **EN · த** Tamil/English language switch in the bottom-right corner.

| File | What |
|---|---|
| `index.html`, `game.js`, `style.css`, `i18n.js` | The game (3 levels × 20 s; Start, Pause/Resume, Hint, Sound, Restart, Share, Play again, language switch) |
| `config.js` | **The one place to set the Mixpanel token** (placeholder `YOUR_MIXPANEL_PROJECT_TOKEN`) + optional Firebase hook |
| `analytics.js` | `track()` wrapper → Mixpanel (if a real token) + local log for the dashboard |
| `dashboard.html` / `dashboard.js` | Built-in analytics page: feature usage %, drop-off funnel, auto-filled AI prompt. Tabs: Sample / This device / Combined |
| `sample_sessions.json` | 15 **simulated** sessions (136 events); only 2 use `language_switch_clicked` |
| `make_sample_data.py` | Regenerates `sample_sessions.json` |
| `seed_mixpanel.py` | Sends the simulated sessions to your Mixpanel project |
| `PROMPT_TEMPLATE.md` | Blank + filled ChatGPT prompt |

## Events tracked
`app_opened`, `game_started`, `level_started {level}`, `level_completed {level, score}`, `game_over {reason, score, level_reached, levels_completed, duration_s}`,
`pause_clicked`, `resume_clicked`, `hint_clicked`, `sound_toggled`, `restart_clicked {from}`, `share_clicked {method}`,
**`language_switch_clicked {from, to, screen}`**. Every event carries `lang`; simulated events carry `simulated: true`.

## Connect Mixpanel (free tier, ~5 min)
1. Sign up at https://mixpanel.com (free plan) → create a project (choose US, EU or India data residency).
2. Project Settings → Overview → copy the **Project Token**.
3. Set it either way:
   - edit `config.js` → `MIXPANEL_TOKEN: "your_token"` (and `MIXPANEL_API_HOST` to `https://api-eu.mixpanel.com` / `https://api-in.mixpanel.com` for EU/India projects), or
   - no code change: open `https://<game-url>/?mp_token=your_token` once on each device (it's remembered), or put it in the QR URL.
4. Seed the sample sessions: `python3 seed_mixpanel.py --token your_token` (add `--region eu|in` if needed; `--dry-run` to preview).
   Ingestion takes ~1 minute. `/track` only accepts events up to 5 days old; for older timestamps use the Import API with a
   service account: `python3 seed_mixpanel.py --token T --import --project-id 123 --sa-user SA_USER --sa-secret SA_SECRET --days-ago 7`.
5. Where to see it in Mixpanel:
   - **Events** (live view): stream of events; filter `simulated = true` for the sample, or `simulated is not set` for live players.
   - **Insights**: Metric = *Uniques* of `game_started`, `sound_toggled`, `restart_clicked`, `share_clicked`, `pause_clicked`, `hint_clicked`, `language_switch_clicked`
     (bar chart) → language switch clearly stands out at the bottom (2 of 15).
   - **Funnels**: `app_opened` → `game_started` → `level_completed (level = 1)` → `level_completed (level = 2)` → `level_completed (level = 3)` for drop-off.

Without a token the game works normally and `dashboard.html` shows the sample data plus events from your own device.

## Firebase Analytics (optional)
Paste your web-app config into `FIREBASE_CONFIG` in `config.js`; `analytics.js` then mirrors every `track()` into `logEvent()`. Off by default.
