/* Frontend observability layer for the GDG "Beyond the UI" demo.
 *   • Firebase Performance Monitoring (modular CDN SDK): automatic page-load + network traces, and
 *     custom traces via OBS.trace(name) / OBS.record(...): game_load, level_play, score_submit, leaderboard_load.
 *   • Google Analytics 4 is NOT done here: analytics.js sends every track() to gtag (standalone GA4 property).
 *   • Web Vitals (web-vitals library): LCP, CLS, INP (+ FCP, TTFB) → track("web_vital", …) → Mixpanel.
 *   • Error tracking: window.onerror / unhandledrejection → track("js_error", …) (message only, truncated, URLs stripped).
 *   • Rage clicks: 3+ clicks on the same button/link within 1 s → track("rage_click", { target }).
 * Uses FIREBASE_WEB_CONFIG, never FIREBASE_CONFIG, so the leaderboard keeps using the Render API. */
(function () {
  var C = window.GAME_CONFIG || {};
  var FBW = C.FIREBASE_WEB_CONFIG || null;
  var FB_VER = "10.12.2";
  var PAGE = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  function track(n, p) { if (window.track) window.track(n, p); }
  function lang() { return window.currentLang || "en"; }

  // ---------- Firebase Performance ----------
  var perf = null, perfMod = null, pending = [];
  function flush() { var q = pending; pending = []; q.forEach(send); }
  function send(r) {
    if (!perf) { if (pending.length < 100) pending.push(r); return; }
    try {
      var tr = perfMod.trace(perf, r.name);
      tr.record(r.start, Math.max(1, Math.round(r.dur)), { attributes: r.attrs, metrics: r.metrics });
    } catch (e) { console.warn("trace failed", r.name, e && e.message); }
  }
  function attrsOf(a) {   // Firebase: ≤5 custom attributes, name ≤40, value ≤100 chars
    var o = {}, n = 0;
    Object.keys(a || {}).forEach(function (k) { var v = a[k]; if (v === undefined || v === null || n >= 5) return; o[k.slice(0, 40)] = String(v).slice(0, 100); n++; });
    return o;
  }
  if (FBW && FBW.apiKey) {
    Promise.all([
      import("https://www.gstatic.com/firebasejs/" + FB_VER + "/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/" + FB_VER + "/firebase-performance.js")
    ]).then(function (m) {
      // Performance Monitoring only runs on the DEFAULT app. Scores never use this app
      // (FIREBASE_CONFIG stays null, scores go to Render), so it is safe to own it here.
      var apps = m[0].getApps(), app = apps.filter(function (a) { return a.name === "[DEFAULT]"; })[0] ||
        m[0].initializeApp(FBW);
      perfMod = m[1]; perf = m[1].initializePerformance(app, { dataCollectionEnabled: true, instrumentationEnabled: true });
      window.OBS.firebase = { app: app, perf: perf };
      flush();
    }).catch(function (e) { console.warn("Firebase observability disabled:", e && e.message); });
  }

  // ---------- custom traces ----------
  window.OBS = {
    // Start a trace now; returns { attr(k, v), metric(k, n), stop(extraAttrs) }. Safe before the SDK loads.
    trace: function (name, attrs) {
      var t0 = performance.now(), start = Date.now(), a = Object.assign({}, attrs || {}), m = {}, done = false;
      return {
        attr: function (k, v) { a[k] = v; return this; },
        metric: function (k, n) { m[k] = Math.round(+n || 0); return this; },
        stop: function (extra) {
          if (done) return; done = true;
          Object.assign(a, extra || {}); if (a.language === undefined) a.language = lang();
          send({ name: name, start: start, dur: performance.now() - t0, attrs: attrsOf(a), metrics: m });
        }
      };
    },
    // Record an already-measured span (e.g. game_load from navigation start).
    record: function (name, startEpochMs, durMs, attrs, metrics) {
      var a = Object.assign({ language: lang() }, attrs || {});
      send({ name: name, start: Math.round(startEpochMs), dur: durMs, attrs: attrsOf(a), metrics: metrics || {} });
    }
  };

  // ---------- Web Vitals → Mixpanel (Firebase Perf records them on its page_load trace too) ----------
  import("https://unpkg.com/web-vitals@4.2.4/dist/web-vitals.js").then(function (wv) {
    function rep(m) {
      track("web_vital", { metric: m.name, value: Math.round(m.name === "CLS" ? m.value * 1000 : m.value) / (m.name === "CLS" ? 1000 : 1),
                           rating: m.rating, page: PAGE, nav_type: m.navigationType });
    }
    wv.onLCP(rep); wv.onCLS(rep); wv.onINP(rep); wv.onFCP(rep); wv.onTTFB(rep);
  }).catch(function () { console.warn("web-vitals failed to load"); });

  // ---------- JS errors ----------
  var errCount = 0;
  function clean(msg) {   // message only: strip URLs/query strings (could hold tokens), emails, long digit runs; truncate
    return String(msg || "unknown").replace(/https?:\/\/\S+/g, "<url>").replace(/[^\s@]+@[^\s@]+/g, "<email>")
      .replace(/\d{6,}/g, "<n>").replace(/\s+/g, " ").trim().slice(0, 150);
  }
  function file(src) { try { return String(src || "").split("?")[0].split("/").pop().slice(0, 40) || "inline"; } catch (e) { return "?"; } }
  window.addEventListener("error", function (e) {
    if (!e || e.target !== window && e.target && e.target.tagName) return;   // resource load errors are not JS errors
    if (++errCount > 10) return;
    track("js_error", { kind: "error", message: clean(e.message), file: file(e.filename), line: e.lineno || 0, page: PAGE });
  });
  window.addEventListener("unhandledrejection", function (e) {
    if (++errCount > 10) return;
    var r = e && e.reason;
    track("js_error", { kind: "unhandledrejection", message: clean(r && r.message ? r.message : r), page: PAGE });
  });
  // Demo helper: ?demo_error=1 throws one harmless error 2 s after load, to show error tracking live.
  if (/[?&]demo_error=1\b/.test(location.search)) setTimeout(function () { throw new Error("Demo error: leaderboard widget failed to render"); }, 2000);

  // ---------- rage clicks (buttons / links only; tapping fruit fast is normal play) ----------
  var clicks = {};
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest && e.target.closest("button, a, [data-track]");
    if (!el || (el.closest && el.closest("#field"))) return;
    var id = el.getAttribute("data-track") || el.id || (el.textContent || "").trim().slice(0, 20) || el.tagName.toLowerCase();
    var now = Date.now(), c = clicks[id] = (clicks[id] || []).filter(function (t) { return now - t < 1000; });
    c.push(now);
    if (c.length === 3) track("rage_click", { target: id, clicks_in_1s: 3, page: PAGE });
  }, true);
})();
