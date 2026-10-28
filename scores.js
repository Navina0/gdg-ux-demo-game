/* Score store abstraction used by the game, scan.html and leaderboard.html.
 *   1. FIREBASE_CONFIG set in config.js  → Cloud Firestore (collection "scores", rules in firestore.rules)
 *   2. otherwise                          → the Render API (lb.js, server-validated) if it answers
 *   3. if Render is unreachable           → demo mode: dummy players + scores saved on this device
 * Dummy players come from dummy_players.json and are merged client-side (never written to a store).
 * No names or other input are ever collected. */
(function () {
  var C = window.GAME_CONFIG || {};
  var P = C.HINT_PENALTY || 5, LEVELS = C.LEVELS || 3;
  var FB = C.FIREBASE_CONFIG || null;
  var FB_VER = "10.12.2", LOCAL_KEY = "mc_local_scores";

  // ---------- Firebase (lazy, modular SDK from gstatic) ----------
  var fbP = null;
  function fb() {
    if (!fbP) fbP = Promise.all([
      import("https://www.gstatic.com/firebasejs/" + FB_VER + "/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/" + FB_VER + "/firebase-firestore.js")
    ]).then(function (m) {
      var app = m[0].getApps().length ? m[0].getApp() : m[0].initializeApp(FB);
      var db = m[1].getFirestore(app);
      if (C.FIRESTORE_EMULATOR) { var hp = String(C.FIRESTORE_EMULATOR).split(":"); m[1].connectFirestoreEmulator(db, hp[0], +hp[1]); } // local testing only
      return { fs: m[1], db: db };
    });
    return fbP;
  }

  // ---------- dummy players ----------
  var dummiesP = fetch("dummy_players.json", { cache: "no-store" }).then(function (r) { return r.json(); })
    .then(function (d) { return (d.players || []).map(function (p) { return norm(p, { dummy: true, at: 9e15 }); }); })
    .catch(function () { return []; });

  function norm(e, extra) {
    var ls = (e.levelScores || e.level_scores || [0, 0, 0]).slice(0, 3);
    while (ls.length < 3) ls.push(0);
    var o = { pid: String(e.pid || e.session_id || "x"), score: e.score | 0, hints: (e.hints != null ? e.hints : e.hints_used) | 0,
              levels: (e.levels != null ? e.levels : e.level) | 0, levelScores: ls, first: !!e.first, dummy: false, at: +e.at || 0 };
    Object.assign(o, extra || {});
    o.adjusted = o.score - P * o.hints;
    return o;
  }
  function rankAll(real, dummies, store, state) {
    var all = real.concat(dummies).sort(function (a, b) {
      return b.adjusted - a.adjusted || b.score - a.score || a.hints - b.hints || a.at - b.at; });
    all.forEach(function (e, i) { e.rank = i + 1; });
    var perLevel = [0, 1, 2].map(function (i) {
      return all.filter(function (e) { return e.levelScores[i] > 0; })
        .sort(function (a, b) { return b.levelScores[i] - a.levelScores[i] || a.hints - b.hints || a.at - b.at; });
    });
    return { store: store, state: state || "ok", entries: all, perLevel: perLevel, real: real.length, dummy: dummies.length,
             hasFirst: real.some(function (e) { return e.first; }) };
  }

  // ---------- local (demo) store ----------
  function localList() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch (e) { return []; } }
  function localRead() {
    var l = localList().map(function (e) { return norm(e, { local: true }); });
    var firstAt = Math.min.apply(null, l.filter(function (e) { return e.levels >= LEVELS; }).map(function (e) { return e.at; }).concat([Infinity]));
    l.forEach(function (e) { e.first = e.levels >= LEVELS && e.at === firstAt; });
    return l;
  }
  function localSave(e) { var l = localList(); l.push(e); try { localStorage.setItem(LOCAL_KEY, JSON.stringify(l.slice(-200))); } catch (x) {} }

  // ---------- Firestore read ----------
  function fsDocsToEntries(docs) {
    var bySess = {};
    docs.forEach(function (d) {
      var x = d.data ? d.data() : d; if (x.dummy) return;
      var at = x.created_at && x.created_at.toMillis ? x.created_at.toMillis() : Date.now();
      var cur = bySess[x.session_id];
      var cand = { pid: x.session_id, score: x.score, hints_used: x.hints_used, level: x.level, level_scores: x.level_scores, at: at, final: !!x.final };
      if (!cur || (cand.final && !cur.final) || (cand.final === cur.final && cand.score + cand.level * 1000 > cur.score + cur.level * 1000)) bySess[x.session_id] = cand;
    });
    var list = Object.keys(bySess).map(function (k) { return norm(bySess[k]); });
    // first finisher = earliest real document with level 3 (see README for the race caveat)
    var fin = list.filter(function (e) { return e.levels >= LEVELS; }).sort(function (a, b) { return a.at - b.at; })[0];
    if (fin) fin.first = true;
    return list;
  }
  function fsQuery(f) { return f.fs.query(f.fs.collection(f.db, "scores"), f.fs.orderBy("created_at", "desc"), f.fs.limit(2000)); }

  // ---------- Render read ----------
  function renderRead() {
    var API = (C.LEADERBOARD_API || "").replace(/\/+$/, "");
    if (!API) return Promise.reject(new Error("no_api"));
    var ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 75000);
    return fetch(API + "/leaderboard", { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("http_" + r.status); return r.json(); })
      .then(function (d) { clearTimeout(t); return (d.entries || []).map(function (e) { return norm(e); }); },
            function (e) { clearTimeout(t); throw e; });
  }

  var renderOk = null; // null = unknown, true/false after the last attempt
  function readOnce() {
    return dummiesP.then(function (dum) {
      if (FB) return fb().then(function (f) { return f.fs.getDocs(fsQuery(f)); })
        .then(function (snap) { return rankAll(fsDocsToEntries(snap.docs), dum, "firestore"); });
      return renderRead().then(function (real) { renderOk = true; return rankAll(real, dum, "render"); },
        function () { renderOk = false; return rankAll(localRead(), dum, "local", "demo"); });
    });
  }

  // Live updates: Firestore onSnapshot, otherwise poll every ~10 s.
  function subscribe(cb) {
    dummiesP.then(function (dum) {
      if (FB) {
        cb(rankAll([], dum, "firestore", "loading"));
        fb().then(function (f) {
          f.fs.onSnapshot(fsQuery(f), function (snap) { cb(rankAll(fsDocsToEntries(snap.docs), dum, "firestore")); },
            function (err) { console.warn("Firestore read failed:", err && err.code); cb(rankAll(localRead(), dum, "local", "demo")); });
        }, function () { cb(rankAll(localRead(), dum, "local", "demo")); });
        return;
      }
      var busy = false;
      function tick() {
        if (busy) return; busy = true;
        var wake = setTimeout(function () { if (renderOk === null) cb(rankAll([], dum, "render", "waking")); }, 2500);
        readOnce().then(function (v) { cb(v); }).then(function () { clearTimeout(wake); busy = false; });
      }
      cb(rankAll([], dum, FB ? "firestore" : "render", "loading"));
      tick(); setInterval(tick, 10000);
    });
  }

  // ---------- writes (called by game.js; same shape as lb.js) ----------
  var run = null;
  function sid() { var a = new Uint8Array(12); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function levelScoresOf(r, score, levels) {
    var ls = [0, 0, 0];
    for (var i = 0; i < LEVELS; i++) {
      if (i < levels) ls[i] = Math.max(0, (r.marks[i + 1] || 0) - (r.marks[i] || 0));
      else if (i === levels) ls[i] = Math.max(0, score - (r.marks[levels] || 0));
    }
    return ls;
  }
  function fsWrite(r, state, final) {
    return fb().then(function (f) {
      var id = r.sid + (final ? "_final" : "_p" + state.levelsCompleted);
      return f.fs.setDoc(f.fs.doc(f.db, "scores", id), {
        session_id: r.sid, score: state.score, hints_used: state.hintsUsed, level: state.levelsCompleted,
        level_scores: levelScoresOf(r, state.score, state.levelsCompleted), final: !!final, dummy: false,
        started_at: f.fs.Timestamp.fromMillis(r.t0), created_at: f.fs.serverTimestamp()
      });
    });
  }
  function rankOf(pid) {
    return readOnce().then(function (v) {
      var me = v.entries.filter(function (e) { return e.pid === pid; })[0];
      return { rank: me ? me.rank : null, total: v.entries.length, first: !!(me && me.first) };
    }).catch(function () { return { rank: null }; });
  }

  window.Scores = {
    mode: FB ? "firestore" : "render",
    subscribe: subscribe, readOnce: readOnce,
    beginRun: function () {
      run = { sid: sid(), t0: Date.now(), marks: [0] };
      if (!FB && window.LB) LB.beginRun();
    },
    progress: function (state) {
      if (!run) return;
      while (run.marks.length <= state.levelsCompleted) run.marks.push(state.score);
      if (FB) fsWrite(run, state, false).catch(function (e) { console.warn("progress save failed:", e && e.code); });
      else if (window.LB) LB.progress(state);
    },
    // Resolves { ok, store, rank, adjustedScore, firstFinisher, error }
    finish: function (state) {
      if (!run) return Promise.resolve({ ok: false, error: "no_run" });
      var r = run; run = null;
      while (r.marks.length <= state.levelsCompleted) r.marks.push(state.score);
      var adj = state.score - P * state.hintsUsed;
      function local() {
        var e = { pid: "local-" + r.sid.slice(0, 10), score: state.score, hints: state.hintsUsed, levels: state.levelsCompleted,
                  levelScores: levelScoresOf(r, state.score, state.levelsCompleted), at: Date.now() };
        localSave(e);
        return dummiesP.then(function (dum) {
          var all = rankAll(localRead(), dum, "local"), me = all.entries.filter(function (x) { return x.pid === e.pid; })[0];
          return { ok: true, store: "local", adjustedScore: adj, rank: me && me.rank, firstFinisher: !!(me && me.first) };
        });
      }
      if (FB) {
        var timeout = new Promise(function (res) { setTimeout(function () { res("pending"); }, 15000); });
        return Promise.race([fsWrite(r, state, true), timeout]).then(function (w) {
          if (w === "pending") return { ok: true, store: "firestore", adjustedScore: adj, rank: null, pending: true };
          return rankOf(r.sid).then(function (k) { return { ok: true, store: "firestore", adjustedScore: adj, rank: k.rank, firstFinisher: k.first }; });
        }, function (e) {
          var code = (e && e.code) || "offline";
          if (code === "permission-denied") return { ok: false, store: "firestore", error: "run_failed_validation:" + code };
          return local();
        });
      }
      if (!window.LB || !LB.api) return local();
      return LB.finish(state).then(function (res) {
        if (res && res.ok) return rankOf(res.pid).then(function (k) {
          return { ok: true, store: "render", adjustedScore: res.adjustedScore, rank: k.rank || res.rank, firstFinisher: !!res.firstFinisher }; });
        var err = (res && res.error) || "offline";
        if (/validation|too_fast|implausible|backwards|too_many|bad_numbers|already_submitted|session_closed|bad_signature|session_too_old/.test(err))
          return { ok: false, store: "render", error: err };
        return local();   // server asleep/unreachable → keep the score on this device (demo mode)
      });
    }
  };
})();
