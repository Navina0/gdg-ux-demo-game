/* Leaderboard client: talks to the server-validated API (config LEADERBOARD_API).
 * No names or other input are collected — scores are saved automatically.
 * Flow: /health on page load (wakes the free Render service) → /session/start
 * (signed session, server start time) → /session/progress after each level →
 * /score at game over. All validation happens on the server. */
(function () {
  var C = window.GAME_CONFIG || {};
  var API = (C.LEADERBOARD_API || "").replace(/\/+$/, "");

  function call(path, body, ms) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 75000);
    var opts = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" };
    if (ctl) opts.signal = ctl.signal;
    return fetch(API + path, opts).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: "http_" + r.status }; }).then(function (j) {
        if (!r.ok && j && j.ok !== false) j = { ok: false, error: "http_" + r.status };
        return j;
      });
    }).then(function (j) { clearTimeout(timer); return j; }, function (e) { clearTimeout(timer); throw e; });
  }

  var nextP = null, run = null;
  function prefetch() {
    nextP = call("/session/start", {}).then(function (j) { return j && j.ok ? j : null; }).catch(function () { return null; });
  }

  window.LB = {
    api: API,
    call: call,
    beginRun: function () {
      if (!API) return;
      if (!nextP) prefetch();
      var p = nextP; nextP = null;
      run = { sessP: p, chain: p };
      p.then(function () { if (!nextP) prefetch(); });   // have a session ready for "Play again"
    },
    progress: function (state) {
      if (!run) return;
      var r = run;
      r.chain = r.chain.then(function () {
        return r.sessP.then(function (s) {
          if (!s) return null;
          return call("/session/progress", Object.assign({ sessionId: s.sessionId, sig: s.sig }, state)).catch(function () { return null; });
        });
      });
    },
    finish: function (state) {
      if (!run) return Promise.resolve(null);
      var r = run; run = null;
      r.chain = r.chain.then(function () {
        return r.sessP.then(function (s) {
          if (!s) return { ok: false, error: "no_session" };
          return call("/score", Object.assign({ sessionId: s.sessionId, sig: s.sig }, state)).catch(function () { return { ok: false, error: "offline" }; });
        });
      });
      return r.chain;
    }
  };

  // Wake the (possibly sleeping) free server on page load, then get a session ready.
  if (API) call("/health", null, 75000).catch(function () { return null; }).then(function () { if (!nextP) prefetch(); });
})();
