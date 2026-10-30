/* Thin analytics wrapper: ONE track() → Mixpanel (if a real token is set) + Google Analytics 4
 * (gtag, if GA_MEASUREMENT_ID is set) + local event log.
 * Every event is also stored in localStorage so dashboard.html can show
 * "live events from this device" even with no Mixpanel account. */
(function () {
  var cfg = window.GAME_CONFIG || {};
  var PLACEHOLDER = "YOUR_MIXPANEL_PROJECT_TOKEN";
  var params = new URLSearchParams(location.search);
  var urlToken = params.get("mp_token");
  if (urlToken) {
    try { localStorage.setItem("mp_token", urlToken); } catch (e) {}
    try { params.delete("mp_token"); var qs = params.toString(); history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash); } catch (e) {}
  }
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
    // The CDN build expects the official snippet stub on window.mixpanel before it loads.
    if (!window.mixpanel) { window.mixpanel = []; window.mixpanel._i = []; window.mixpanel.__SV = 1.2; }
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

  /* ---- Google Analytics 4 (standalone property, gtag.js loaded in the page <head>) ----
   * Every track() is mirrored as gtag("event", name, params). GA4-safe: snake_case names ≤40 chars,
   * ≤25 params, string values ≤100 chars, no PII (the player name is never tracked). */
  var GA_ID = cfg.GA_MEASUREMENT_ID || null;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  if (GA_ID) {
    window.gtag("js", new Date());
    // page_location / page_referrer are sent without query strings (they could carry ?mp_token=…).
    window.gtag("config", GA_ID, { page_location: location.origin + location.pathname,
      page_referrer: (document.referrer || "").split("?")[0], game: cfg.GAME_NAME, demo_session_id: SESSION });
  }
  function gaName(n) { return String(n).toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^[^a-z]+/, "e_").slice(0, 40); }
  function gaParams(p) {
    var o = {}, n = 0;
    Object.keys(p || {}).forEach(function (k) {
      if (n >= 25) return; var v = p[k];
      if (v === null || v === undefined) return;
      o[gaName(k)] = typeof v === "number" ? v : String(v).slice(0, 100); n++;
    });
    return o;
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
    if (GA_ID) { try { window.gtag("event", gaName(name), gaParams(props)); } catch (e) {} }
    if (!mpEnabled) return;
    if (window.mixpanel && window.mixpanel.track && window.mixpanel.__loaded) window.mixpanel.track(name, props);
    else queue.push([name, props]);
  };
  window.ANALYTICS_STATUS = { mixpanel: mpEnabled, ga4: !!GA_ID, tokenSource: urlToken ? "url" : (token === cfg.MIXPANEL_TOKEN ? "config" : "localStorage"), session: SESSION };
})();
