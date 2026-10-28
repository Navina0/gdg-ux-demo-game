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
  LEVEL_SECONDS: 20,
  LIVES: 3
};
