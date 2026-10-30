/* Leaderboard client: talks to the server-validated API (config LEADERBOARD_API).
 * Scores are saved automatically; the final /score also carries the player's display name
 * (cleaned in scores.js, re-validated by the server, falls back to "Player").
 * Flow: /health on page load (wakes the free Render service) → /session/start
 * (signed session, server start time) → /session/progress after each level →
 * /score at game over. All validation happens on the server. */
(function () {
  var C = window.GAME_CONFIG || {};
  // Render API is only used while Firebase is not configured (see scores.js).
  var API = C.FIREBASE_CONFIG ? "" : (C.LEADERBOARD_API || "").replace(/\/+$/, "");

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

  // A session's clock (t0) starts on the SERVER when /session/start is answered, and the server
  // checks "N levels need ≥ N×30 s since t0". So a run may only use a session that was ready
  // BEFORE the run started. On a sleeping free Render instance /session/start can take ~50 s;
  // a run started meanwhile used to get a late t0 and was rejected as "completed_too_fast"
  // after the game. Now: game.js waits for LB.ready() before starting, and a run that starts
  // without a ready session is played offline (score kept on this device).
  var STALE_MS = 90 * 60 * 1000;   // server sessions expire after 2 h — refresh well before that
  var nextP = null, nextAt = 0, nextSess, run = null;   // nextSess: undefined = pending, null = failed, object = ready
  function prefetch() {
    var p = call("/session/start", {}).then(function (j) { return j && j.ok ? j : null; }).catch(function () { return null; });
    nextP = p; nextAt = Date.now(); nextSess = undefined;
    p.then(function (s) { if (nextP === p) nextSess = s; });
  }
  function freshNext() {   // make sure a usable (or in-flight) session is queued
    if (!nextP || nextSess === null || (nextSess && Date.now() - nextAt > STALE_MS)) prefetch();
  }

  window.LB = {
    api: API,
    call: call,
    // Resolves true when a session is ready (false on failure or after `ms`).
    ready: function (ms) {
      if (!API) return Promise.resolve(true);
      freshNext();
      if (nextSess) return Promise.resolve(true);
      var p = nextP;
      return new Promise(function (res) {
        var t = setTimeout(function () { res(false); }, ms || 60000);
        p.then(function (s) { clearTimeout(t); res(!!s); });
      });
    },
    beginRun: function () {
      if (!API) return;
      freshNext();
      if (!nextSess) { run = { sessP: Promise.resolve(null), chain: Promise.resolve(null), offline: true }; return; } // not ready → offline run
      var s = nextSess, p = Promise.resolve(s);
      run = { sessP: p, chain: p };
      prefetch();   // have a session ready for "Play again"
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
  if (API) call("/health", null, 75000).catch(function () { return null; }).then(function () { freshNext(); });
})();
