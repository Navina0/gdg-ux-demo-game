(function () {
  var C = window.GAME_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var field = $("field");
  // ---------- Microsoft Clarity custom tags/events (never throws if Clarity is blocked or missing) ----------
  function cl() { try { if (typeof window.clarity === "function") window.clarity.apply(null, arguments); } catch (e) {} }
  function setScreen(x) {
    try { document.body.setAttribute("data-screen", x); } catch (e) {}
    cl("set", "screen", x); cl("event", "screen_" + x);
  }
  var st = { running: false, paused: false, level: 1, score: 0, lives: C.LIVES, timeLeft: C.LEVEL_SECONDS,
             items: [], last: 0, spawnAcc: 0, sound: true, startedAt: 0, hintsUsed: 0 };
  var best = +(localStorage.getItem("best") || 0);
  $("bestScore").textContent = best; $("levels").textContent = C.LEVELS;

  // ---------- player name (local only: never sent to analytics or the leaderboard) ----------
  var NAME_MAX = 20;
  function cleanName(v) {
    var s = String(v || "").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, "")
      .replace(/\s+/g, " ").trim();
    return Array.from(s).slice(0, NAME_MAX).join("").trim();
  }
  var savedName = ""; try { savedName = cleanName(localStorage.getItem("playerName")); } catch (e) {}
  $("playerName").value = savedName;
  function playerName() { return cleanName($("playerName").value) || t("defaultName"); }
  function showName() { var n = playerName(); $("hudName").textContent = "👤 " + n; $("hudName").title = n; }
  function fill(key, vars) { // safe templating: plain split/join, result is only ever used as textContent
    var s = t(key); Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); }); return s;
  }
  $("playerName").addEventListener("input", showName);
  $("playerName").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("btnStart").click(); } });
  window.onLangApplied = function () {
    if (!$("playerName")) return;
    showName();
    if ($("over").classList.contains("show")) $("overName").textContent = fill("wellPlayed", { name: playerName(), n: st.score });
  };

  applyLang(localStorage.getItem("lang") || "en");
  track("app_opened", { referrer: document.referrer || "direct", screen_w: innerWidth });

  // ---------- sound (WebAudio beeps, no assets) ----------
  var ac = null;
  function beep(freq, dur) {
    if (!st.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = freq; o.type = "triangle"; g.gain.value = 0.08;
      o.connect(g); g.connect(ac.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (dur || 0.12));
      o.stop(ac.currentTime + (dur || 0.12));
    } catch (e) {}
  }

  function show(id, on) { $(id).classList.toggle("show", !!on); }
  function showRules() {   // Hint → points/rules panel (tap anywhere on it or ✕ to close; auto-closes after 6 s)
    var el = $("rules"); el.hidden = false; clearTimeout(showRules._t);
    showRules._t = setTimeout(function () { el.hidden = true; }, 6000);
  }
  $("rules").onclick = function () { clearTimeout(showRules._t); $("rules").hidden = true; };
  function toast(msg, ms) { var el = $("toast"); el.textContent = msg; el.style.display = "block"; clearTimeout(toast._t); toast._t = setTimeout(function(){ el.style.display = "none"; }, ms || 2000); }
  function hud() {
    $("score").textContent = st.score; $("level").textContent = st.level;
    $("time").textContent = Math.max(0, Math.ceil(st.timeLeft));
    $("lives").textContent = "❤️".repeat(Math.max(0, st.lives)) + "🤍".repeat(Math.max(0, C.LIVES - st.lives));
  }
  function clearItems() { st.items.forEach(function (it) { it.el.remove(); }); st.items = []; }

  // Difficulty step per level: level 1 = 1 (unchanged); level 2 uses the old level-3 speed/spawn rate (step 3).
  // Keep in sync with server/index.js G.step.
  function step(l) { return l >= 2 ? 3 : l; }
  function spawn() {
    var d = step(st.level), r = Math.random(), neg = 0.18 + d * 0.05;   // share of negative items (old formula)
    var apple = st.level >= 2 ? 0.15 : 0;                                // level 2: apples take part of the negative share
    var kind = r < 0.12 ? "gold" : r < 0.12 + apple ? "apple" : r < 0.12 + neg ? "chilli" : "mango";
    var el = document.createElement("div");
    el.className = "item" + (kind === "gold" ? " gold" : "");
    el.textContent = kind === "chilli" ? "🌶️" : kind === "apple" ? "🍎" : "🥭";
    var w = field.clientWidth, x = Math.random() * (w - 64);
    var it = { el: el, kind: kind, x: x, y: -60, v: 120 + d * 55 + Math.random() * 60 };
    el.style.transform = "translate(" + x + "px,-60px)";
    el.addEventListener("pointerdown", function (e) { e.preventDefault(); hit(it); });
    field.appendChild(el); st.items.push(it);
  }

  function popText(it, txt, color) {
    var p = document.createElement("div"); p.className = "pop"; p.textContent = txt; p.style.color = color;
    p.style.left = (it.x + 10) + "px"; p.style.top = it.y + "px"; field.appendChild(p);
    setTimeout(function () { p.remove(); }, 650);
  }

  function hit(it) {
    if (!st.running || st.paused) return;
    if (it.kind === "chilli") { cl("event", "chilli_hit"); st.lives--; beep(160, 0.25); popText(it, "−❤️", "#ff5252"); if (navigator.vibrate) navigator.vibrate(60); }
    else if (it.kind === "apple") {   // −2 points, no life lost; never below the score banked at the start of this level (level score ≥ 0)
      st.score = Math.max(st.score - 2, st.levelStartScore || 0); beep(220, 0.2); popText(it, "−2", "#ff8a65");
    }
    else { var pts = it.kind === "gold" ? 3 : 1; st.score += pts; beep(it.kind === "gold" ? 990 : 660); popText(it, "+" + pts, it.kind === "gold" ? "gold" : "#fff"); }
    it.el.remove(); st.items.splice(st.items.indexOf(it), 1); hud();
    if (st.lives <= 0) endGame("out_of_lives");
  }

  function loop(ts) {
    if (!st.running) return;
    if (st.paused) { st.last = ts; return requestAnimationFrame(loop); }
    var dt = st.last ? Math.min(0.05, (ts - st.last) / 1000) : 0; st.last = ts;
    st.timeLeft -= dt; st.spawnAcc += dt;
    var every = Math.max(0.3, 0.85 - step(st.level) * 0.15);
    while (st.spawnAcc > every) { st.spawnAcc -= every; spawn(); }
    var h = field.clientHeight;
    for (var i = st.items.length - 1; i >= 0; i--) {
      var it = st.items[i]; it.y += it.v * dt;
      it.el.style.transform = "translate(" + it.x + "px," + it.y + "px)";
      if (it.y > h) { it.el.remove(); st.items.splice(i, 1); }
    }
    hud();
    if (st.timeLeft <= 0) return levelDone();
    requestAnimationFrame(loop);
  }

  // Firebase Performance custom trace per level (see observability.js)
  var levelTrace = null;
  function endLevelTrace(outcome) { if (levelTrace) { levelTrace.metric("score", st.score).metric("lives_left", st.lives).stop({ outcome: outcome }); levelTrace = null; } }
  function startLevel() {
    endLevelTrace("abandoned");
    if (window.OBS) levelTrace = OBS.trace("level_play", { level: st.level, mode: st.mode || "classic" });
    st.timeLeft = C.LEVEL_SECONDS; st.last = 0; st.spawnAcc = 0; st.running = true; st.paused = false; st.levelStartScore = st.score;
    track("level_started", { level: st.level });
    setScreen("playing");
    hud(); requestAnimationFrame(loop);
  }

  var levelTimer = null;
  function levelDone() {
    st.running = false; clearItems(); endLevelTrace("completed");
    track("level_completed", { level: st.level, score: st.score, lives_left: st.lives });
    // leaderboard: per-level save to the server (the final level is saved by endGame)
    if (window.Scores && st.level < C.LEVELS) Scores.progress({ score: st.score, levelsCompleted: st.level, hintsUsed: st.hintsUsed });
    if (st.level >= C.LEVELS) return endGame("completed");
    st.level++; beep(880, 0.3);
    $("levelUpText").textContent = t("nextLevel", { n: st.level }); show("levelUp", true); setScreen("level_up");
    levelTimer = setTimeout(function () { show("levelUp", false); startLevel(); }, 1600);
  }

  // Start only once the leaderboard session is ready: the server times the run from the moment it
  // created the session, so a session that arrives mid-game made the run look "too fast" and the
  // score was rejected after play. "Play now" skips the wait (that run is saved on this device only).
  var startSeq = 0;
  function startGame(via, extra) {
    var my = ++startSeq;
    endLevelTrace("restarted");
    st.running = false; clearTimeout(levelTimer); clearItems();
    ["start", "over", "paused", "levelUp"].forEach(function (id) { show(id, false); });
    if (!window.Scores || !Scores.whenReady) return beginGame(via, extra);
    var done = false;
    function go() { if (done || my !== startSeq) return; done = true; clearTimeout(slow); show("waking", false); beginGame(via, extra); }
    var slow = setTimeout(function () { if (!done && my === startSeq) show("waking", true); }, 400);
    $("btnPlayNow").onclick = go;
    Scores.whenReady(60000).then(go);
  }

  function beginGame(via, extra) {
    st.level = 1; st.score = 0; st.lives = C.LIVES; st.hintsUsed = 0; st.startedAt = Date.now();
    clearItems(); ["start", "over", "paused", "levelUp", "waking"].forEach(function (id) { show(id, false); });
    track("game_started", Object.assign({ via: via || "quick_play", start_method: via || "quick_play", mode: st.mode || "classic",
                                          sound_on: st.sound, has_name: !!cleanName($("playerName").value) }, extra || {}));
    if (window.Scores) Scores.beginRun();
    cl("event", "game_started");
    startLevel();
  }

  function endGame(reason) {
    st.running = false; clearItems(); endLevelTrace(reason === "completed" ? "completed" : "lost");
    if (st.score > best) { best = st.score; localStorage.setItem("best", best); $("bestScore").textContent = best; }
    track("game_over", { reason: reason, score: st.score, level_reached: st.level,
                         levels_completed: reason === "completed" ? C.LEVELS : st.level - 1,
                         duration_s: Math.round((Date.now() - st.startedAt) / 1000), hints_used: st.hintsUsed });
    $("overTitle").textContent = t(reason === "completed" ? "youWon" : "gameOver");
    $("overReason").textContent = reason === "completed" ? "" : t("outOfLives");
    $("finalScore").textContent = st.score;
    $("overName").textContent = fill("wellPlayed", { name: playerName(), n: st.score });
    show("over", true);
    cl("set", "score_bucket", st.score >= 30 ? "30+" : st.score >= 10 ? "10-29" : "0-9");
    cl("event", "game_over"); setScreen("game_over");
    saveScore(reason, reason === "completed" ? C.LEVELS : st.level - 1);
  }

  // ---------- leaderboard: automatic, silent save at game over (no name / input) ----------
  var runSeq = 0;
  function saveScore(reason, levelsCompleted) {
    var my = ++runSeq, status = $("submitStatus"), first = $("firstMsg");
    first.hidden = true; status.className = "status"; status.textContent = "";
    if (!window.Scores) return;
    var score = st.score, hints = st.hintsUsed;
    status.textContent = t("saving");
    // name goes to the score store only (never to analytics); blank → "Player" (not the translated default)
    Scores.finish({ score: score, levelsCompleted: levelsCompleted, hintsUsed: hints, reason: reason, name: cleanName($("playerName").value) || "Player" }).then(function (r) {
      var current = my === runSeq && $("over").classList.contains("show");
      if (r && r.ok) {
        track("score_submitted", { score: score, hints_used: hints, levels_completed: levelsCompleted,
                                   adjusted_score: r.adjustedScore, rank: r.rank, auto_saved: true, store: r.store });
        if (r.firstFinisher) track("first_finisher", { store: r.store, score: score, hints_used: hints, adjusted_score: r.adjustedScore });
        if (current) { status.textContent = r.rank ? t(r.store === "local" ? "savedLocal" : "saved", { n: r.rank }) : t("savedNoRank"); if (r.firstFinisher) { first.textContent = t("firstFinisher"); first.hidden = false; } }
      } else {
        var err = (r && r.error) || "offline";
        track("score_rejected", { store: r && r.store, error: err, score: score, hints_used: hints, levels_completed: levelsCompleted, auto_saved: true });
        if (current) { status.className = "status err"; status.textContent = /validation|too_fast|implausible|backwards/.test(err) ? t("notVerified") : t("saveFailed", { e: err }); }
      }
    });
  }

  // ---------- feature buttons (each one tracked) ----------
  // Two ways to do one thing (like "Scan charger" vs "Enter charger ID"): Quick Play vs Choose mode / Enter code.
  function prepStart(method) {
    var n = cleanName($("playerName").value); $("playerName").value = n;
    try { if (n) localStorage.setItem("playerName", n); else localStorage.removeItem("playerName"); } catch (e) {}
    track("name_entered", { entered: n ? "yes" : "no", start_method: method });   // never the name itself
    showName(); $("playerName").blur(); beep(520);
  }
  $("btnStart").onclick = function () {
    st.mode = "classic"; $("app").classList.remove("night");
    prepStart("quick_play"); startGame("quick_play");
  };
  $("btnChooseMode").onclick = function () {
    var p = $("modePanel"), open = p.hidden; p.hidden = !open;
    track("choose_mode_opened", { open: open });
  };
  $("btnStartMode").onclick = function () {
    var m = document.querySelector('input[name="mode"]:checked'), mode = m ? m.value : "classic";
    var code = String($("roomCode").value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    st.mode = mode; $("app").classList.toggle("night", mode === "night");   // cosmetic only: same game, same scoring
    prepStart("choose_mode");
    startGame("choose_mode", { has_room_code: !!code, room_code: /^[A-Z0-9]{2,8}$/.test(code) ? code : null });
  };

  // Deliberately slow "Daily bonus": no feedback for ~3 s → people tap again and again (rage clicks).
  // Purely cosmetic (a sparkle next to the name); it never touches the score.
  // Clarity: 3+ taps within 2 s = one "rage_daily_bonus" event per burst (+ upgrade so the recording is kept/prioritised).
  var bonus = { pending: false, claimed: false, clicks: 0, firstAt: 0, recent: [], rageFired: false };
  $("btnBonus").onclick = function () {
    bonus.clicks++;
    var now = Date.now();
    bonus.recent = bonus.recent.filter(function (t) { return now - t < 2000; }); bonus.recent.push(now);
    if (bonus.recent.length === 1) bonus.rageFired = false;   // a new burst
    if (bonus.clicks === 1) cl("event", "daily_bonus_clicked");
    if (bonus.recent.length >= 3 && !bonus.rageFired) {
      bonus.rageFired = true; cl("event", "rage_daily_bonus"); cl("upgrade", "rage_daily_bonus");
    }
    track("bonus_clicked", { click_n: bonus.clicks, pending: bonus.pending, claimed: bonus.claimed });
    if (bonus.claimed) { toast(t("bonusAlready")); return; }
    if (bonus.pending) return;   // still "loading", with no spinner on purpose
    bonus.pending = true; bonus.firstAt = Date.now();
    setTimeout(function () {
      bonus.pending = false; bonus.claimed = true;
      $("btnBonus").classList.add("claimed"); $("hudName").classList.add("sparkle");
      toast(t("bonusGranted"), 2600); beep(990, 0.2);
      track("bonus_granted", { wait_ms: Date.now() - bonus.firstAt, clicks_while_waiting: bonus.clicks - 1, cosmetic: true });
    }, 3000);
  };

  // Leaderboard links: track, then navigate a moment later so the event can leave the page.
  ["lnkLbStart", "lnkLbOver"].forEach(function (id) {
    $(id).addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); var href = $(id).href;
      setScreen("leaderboard_opened");
      track("leaderboard_opened", { from: id === "lnkLbStart" ? "start" : "game_over", link: id === "lnkLbStart" ? "hidden_small" : "game_over" });
      setTimeout(function () { location.href = href; }, 300);
    });
  });
  $("btnAgain").onclick = function () { track("restart_used", { from: "game_over", prev_score: st.score }); startGame("play_again"); };
  $("btnRestart").onclick = function () {
    if (!st.running && !$("over").classList.contains("show")) return;
    track("restart_used", { from: "in_game", level: st.level, prev_score: st.score }); startGame("restart");
  };
  function pause() {
    if (!st.running || st.paused) return;
    st.paused = true; show("paused", true); setScreen("paused"); track("pause_used", { level: st.level, time_left: Math.ceil(st.timeLeft) });
  }
  $("btnPause").onclick = pause;
  $("btnResume").onclick = function () { st.paused = false; show("paused", false); setScreen("playing"); track("resume_used", { level: st.level }); };
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
  $("btnHint").onclick = function () {
    st.hintsUsed++; showRules();
    st.items.forEach(function (it) { if (it.kind === "gold") it.el.classList.add("hint"); });
    track("hint_used", { level: st.level, in_game: st.running, hints_this_run: st.hintsUsed });
  };
  $("btnSound").onclick = function () {
    st.sound = !st.sound; $("btnSound").setAttribute("data-i18n", st.sound ? "soundOn" : "soundOff");
    $("btnSound").textContent = t(st.sound ? "soundOn" : "soundOff"); beep(440);
    track("sound_toggled", { state: st.sound ? "on" : "off", sound_on: st.sound, level: st.level, in_game: st.running });
  };
  $("btnShare").onclick = function () {
    var text = t("shareText", { n: st.score }), url = location.origin + location.pathname;
    var method = "clipboard";
    if (navigator.share) { method = "native"; navigator.share({ title: t("title"), text: text, url: url }).catch(function(){}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(text + " " + url).then(function(){ toast(t("copied")); }, function(){ toast(text); }); }
    else toast(text);
    track("share_clicked", { score: st.score, method: method });
  };
  // ---------- the deliberately underused feature ----------
  $("btnLang").onclick = function () {
    var from = window.currentLang, to = from === "en" ? "ta" : "en";
    track("language_changed", { from: from, to: to, screen: st.running ? "game" : ($("over").classList.contains("show") ? "game_over" : "start") });
    applyLang(to);
    $("btnSound").textContent = t(st.sound ? "soundOn" : "soundOff");
    toast(t("langChanged"));
  };
  hud();
  // Dead-click bait: these LOOK tappable (pointer cursor, "tap me" hint) but deliberately do nothing.
  // Clarity detects the dead clicks itself; this custom event is just an extra marker.
  Array.prototype.forEach.call(document.querySelectorAll(".dead-bait"), function (el) {
    el.addEventListener("click", function () { cl("event", "dead_click_bait"); cl("set", "dead_bait", el.getAttribute("data-bait") || "?"); });
  });
  setScreen("start");
  // game_load: from navigation start until the start screen is ready (Firebase Performance custom trace)
  if (window.OBS) OBS.record("game_load", performance.timeOrigin || (Date.now() - performance.now()), performance.now(),
                             { page: "game", from: new URLSearchParams(location.search).get("from") || "direct" });
  track("start_screen_ready", { load_ms: Math.round(performance.now()) });
})();
