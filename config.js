/* ============================================================
 *  GAME CONFIG  —  the ONE place to set your Mixpanel token
 * ============================================================
 *  1. Create a free Mixpanel project (mixpanel.com → Sign up → New project).
 *  2. Project Settings → "Project Token" → copy it.
 *  3. Paste it below (replace the placeholder), OR open the game with
 *        https://<game-url>/?mp_token=YOUR_TOKEN
 *     (the URL value is remembered on that device in localStorage).
 *  With the placeholder left in, the game works normally and events are
 *  only logged locally (see dashboard.html → "Live events from this device").
 */
window.GAME_CONFIG = {
  // ⚠️ PLACEHOLDER — not a real token. Replace with your Mixpanel project token.
  // TODO(Mixpanel): this is STILL the placeholder, so nothing reaches Mixpanel yet.
  //   Either paste your Project Token here, or open the game / leaderboard once with
  //   ?mp_token=YOUR_TOKEN (remembered on that device in localStorage).
  MIXPANEL_TOKEN: "YOUR_MIXPANEL_PROJECT_TOKEN",

  // Mixpanel ingestion host. Use "https://api-eu.mixpanel.com" for EU-residency
  // projects or "https://api-in.mixpanel.com" for India-residency projects.
  MIXPANEL_API_HOST: "https://api-js.mixpanel.com",

  // Optional Firebase Analytics hook (disabled). To enable, paste your web app
  // config object from Firebase console → Project settings → Your apps, e.g.
  // FIREBASE_CONFIG: { apiKey: "...", authDomain: "...", projectId: "...",
  //                    appId: "...", measurementId: "G-XXXXXXX" },
  FIREBASE_CONFIG: null,

  GAME_NAME: "mango_catch",
  LEVELS: 3,
  LEVEL_SECONDS: 60,   // 3 levels × 60 s = 3 minutes (the server validates against 60 s too)
  LIVES: 3,

  // Leaderboard API (Render free web service, code in /server). Scores are validated
  // server-side; the browser never sees any database credentials.
  LEADERBOARD_API: "https://mango-catch-api.onrender.com",
  HINT_PENALTY: 5      // adjusted score = score − 5 × hint clicks (must match server)
};
