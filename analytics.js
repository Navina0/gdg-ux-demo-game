/* Thin analytics wrapper: Mixpanel (if a real token is set) + local event log.
 * Every event is also stored in localStorage so dashboard.html can show
 * "live events from this device" even with no Mixpanel account. */
(function () {
  var cfg = window.GAME_CONFIG || {};
  var PLACEHOLDER = "YOUR_MIXPANEL_PROJECT_TOKEN";
  var params = new URLSearchParams(location.search);
  var urlToken = params.get("mp_token");
  if (urlToken) { try { localStorage.setItem("mp_token", urlToken); } catch (e) {} }
  var token = urlToken || (function(){ try { return localStorage.getItem("mp_token"); } catch(e){ return null; } })() || cfg.MIXPANEL_TOKEN;
  var mpEnabled = !!token && token !== PLACEHOLDER;

  function sid() {
    try {
      var s = sessionStorage.getItem("demo_session_id");
      if (!s) { s = "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); sessionStorage.setItem("demo_session_id", s); }
      return s;
    } catch (e) { return "s_anon"; }
  }
  var SESSION = sid();
  var queue = [];

  if (mpEnabled) {
    // Official Mixpanel JS snippet loader (CDN), then init.
    var s = document.createElement("script");
    s.src = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";
    s.async = true;
    s.onload = function () {
      try {
        window.mixpanel.init(token, { api_host: cfg.MIXPANEL_API_HOST || "https://api-js.mixpanel.com", track_pageview: false, persistence: "localStorage" });
        window.mixpanel.register({ game: cfg.GAME_NAME, demo_session_id: SESSION, source: params.get("utm_source") || "direct" });
        queue.forEach(function (q) { window.mixpanel.track(q[0], q[1]); });
        queue = [];
      } catch (e) { console.warn("Mixpanel init failed", e); }
    };
    s.onerror = function () { console.warn("Mixpanel SDK failed to load; local logging only."); };
    document.head.appendChild(s);
  }

  /* ---- Optional Firebase Analytics hook (off unless FIREBASE_CONFIG set) ----
   * Uses the modular CDN build. Each track() call is mirrored via logEvent(). */
  var fbLog = null;
  if (cfg.FIREBASE_CONFIG) {
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js").then(function (app) {
      return import("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js").then(function (an) {
        var a = an.getAnalytics(app.initializeApp(cfg.FIREBASE_CONFIG));
        fbLog = function (n, p) { an.logEvent(a, n, p); };
      });
    }).catch(function (e) { console.warn("Firebase disabled:", e); });
  }

  function localLog(name, props) {
    try {
      var log = JSON.parse(localStorage.getItem("demo_events") || "[]");
      log.push({ event: name, time: Date.now(), session: SESSION, props: props || {} });
      if (log.length > 2000) log = log.slice(-2000);
      localStorage.setItem("demo_events", JSON.stringify(log));
    } catch (e) {}
  }

  window.track = function (name, props) {
    props = Object.assign({ lang: (window.currentLang || "en") }, props || {});
    localLog(name, props);
    if (fbLog) { try { fbLog(name, props); } catch (e) {} }
    if (!mpEnabled) return;
    if (window.mixpanel && window.mixpanel.track && window.mixpanel.__loaded) window.mixpanel.track(name, props);
    else queue.push([name, props]);
  };
  window.ANALYTICS_STATUS = { mixpanel: mpEnabled, tokenSource: urlToken ? "url" : (token === cfg.MIXPANEL_TOKEN ? "config" : "localStorage"), session: SESSION };
})();
