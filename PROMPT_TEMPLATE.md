# ChatGPT prompt template — "Beyond the UI" demo

Paste into ChatGPT / Gemini. Fill the [brackets] from Mixpanel (Insights → "Uniques" per event ÷ total sessions; Funnels for drop-off) or copy the auto-filled version from `dashboard.html` → "Ask AI for UX improvements".

## Blank template

```
You are a senior mobile UX researcher. Below is product analytics from [APP: one-line description, e.g. a 1–3 minute casual mobile web game opened from a QR code].

UI context: [where each feature lives on screen, e.g. "Pause/Hint/Sound/Restart in a bottom bar; language switch is a tiny corner button"]. Audience: [who uses it, where].

Sessions analysed: [N]

Feature usage (% of sessions that used it at least once):
- [Feature A]: [x]% ([a]/[N])
- [Feature B]: [y]% ([b]/[N])
- [Least-used feature]: [z]% ([c]/[N])

Drop-off funnel:
- [Step 1]: [n1]
- [Step 2]: [n2] (−[d], [p]% drop)
- [Step 3]: [n3] (−[d], [p]% drop)

Task: Give exactly 3 UX improvement suggestions, ranked by expected impact. For each: (1) the problem the data suggests, citing the numbers, (2) the specific design change, (3) the metric to watch and a realistic target, (4) effort (S/M/L). Address the least-used feature and the biggest drop-off point. Keep it under 250 words.
```

## Filled example (the 15 simulated sample sessions)

```
You are a senior mobile UX researcher. Below is product analytics from a 1–3 minute casual mobile web game, "Mango Catch" (tap falling mangoes, avoid chillies; 3 levels × 20 s; opened from a QR code; no install).

UI context: Start button on the start screen; a bottom bar with Pause, Hint, Sound and Restart; Share score + Play again on the game-over screen; a Tamil/English language switch is a tiny low-contrast "EN · த" button in the bottom-right corner. Audience: event attendees in Tamil Nadu, India.

Sessions analysed: 15 (simulated demo data)

Feature usage (% of sessions that used it at least once):
- Start game (game_started): 93.3% (14/15)
- Sound toggle (sound_toggled): 60% (9/15)
- Restart / Play again (restart_clicked): 40% (6/15)
- Share score (share_clicked): 33.3% (5/15)
- Pause (pause_clicked): 26.7% (4/15)
- Hint (hint_clicked): 26.7% (4/15)
- Language switch (language_switch_clicked): 13.3% (2/15)

Drop-off funnel:
- Opened game (QR): 15
- Started game: 14 (−1, 6.7% drop from previous step)
- Completed level 1: 12 (−2, 14.3% drop from previous step)
- Completed level 2: 8 (−4, 33.3% drop from previous step)
- Completed level 3 (finished): 5 (−3, 37.5% drop from previous step)

Task: Give exactly 3 UX improvement suggestions, ranked by expected impact. For each: (1) the problem the data suggests, citing the numbers, (2) the specific design change, (3) the metric to watch and a realistic target, (4) effort (S/M/L). Address the least-used feature and the biggest drop-off point. Keep it under 250 words.
```
