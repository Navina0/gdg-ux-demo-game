(function () {
  var C = window.GAME_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var field = $("field");
  var st = { running: false, paused: false, level: 1, score: 0, lives: C.LIVES, timeLeft: C.LEVEL_SECONDS,
             items: [], last: 0, spawnAcc: 0, sound: true, startedAt: 0, hintsUsed: 0 };
  var best = +(localStorage.getItem("best") || 0);
  $("bestScore").textContent = best; $("levels").textContent = C.LEVELS;

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
  function toast(msg, ms) { var el = $("toast"); el.textContent = msg; el.style.display = "block"; clearTimeout(toast._t); toast._t = setTimeout(function(){ el.style.display = "none"; }, ms || 2000); }
  function hud() {
    $("score").textContent = st.score; $("level").textContent = st.level;
    $("time").textContent = Math.max(0, Math.ceil(st.timeLeft));
    $("lives").textContent = "❤️".repeat(Math.max(0, st.lives)) + "🤍".repeat(Math.max(0, C.LIVES - st.lives));
  }
  function clearItems() { st.items.forEach(function (it) { it.el.remove(); }); st.items = []; }

  function spawn() {
    var r = Math.random(), kind = r < 0.12 ? "gold" : (r < 0.12 + 0.18 + st.level * 0.05 ? "chilli" : "mango");
    var el = document.createElement("div");
    el.className = "item" + (kind === "gold" ? " gold" : "");
    el.textContent = kind === "chilli" ? "🌶️" : "🥭";
    var w = field.clientWidth, x = Math.random() * (w - 64);
    var it = { el: el, kind: kind, x: x, y: -60, v: 120 + st.level * 55 + Math.random() * 60 };
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
    if (it.kind === "chilli") { st.lives--; beep(160, 0.25); popText(it, "−❤️", "#ff5252"); if (navigator.vibrate) navigator.vibrate(60); }
    else { var pts = it.kind === "gold" ? 3 : 1; st.score += pts; beep(it.kind === "gold" ? 990 : 660); popText(it, "+" + pts, it.kind === "gold" ? "gold" : "#fff"); }
    it.el.remove(); st.items.splice(st.items.indexOf(it), 1); hud();
    if (st.lives <= 0) endGame("out_of_lives");
  }

  function loop(ts) {
    if (!st.running) return;
    if (st.paused) { st.last = ts; return requestAnimationFrame(loop); }
    var dt = st.last ? Math.min(0.05, (ts - st.last) / 1000) : 0; st.last = ts;
    st.timeLeft -= dt; st.spawnAcc += dt;
    var every = Math.max(0.3, 0.85 - st.level * 0.15);
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

  function startLevel() {
    st.timeLeft = C.LEVEL_SECONDS; st.last = 0; st.spawnAcc = 0; st.running = true; st.paused = false;
    track("level_started", { level: st.level });
    hud(); requestAnimationFrame(loop);
  }

  function levelDone() {
    st.running = false; clearItems();
    track("level_completed", { level: st.level, score: st.score, lives_left: st.lives });
    if (st.level >= C.LEVELS) return endGame("completed");
    st.level++; beep(880, 0.3);
    $("levelUpText").textContent = t("nextLevel", { n: st.level }); show("levelUp", true);
    setTimeout(function () { show("levelUp", false); startLevel(); }, 1600);
  }

  function startGame(via) {
    st.level = 1; st.score = 0; st.lives = C.LIVES; st.hintsUsed = 0; st.startedAt = Date.now();
    clearItems(); ["start", "over", "paused", "levelUp"].forEach(function (id) { show(id, false); });
    track("game_started", { via: via || "start_button", sound_on: st.sound });
    startLevel();
  }

  function endGame(reason) {
    st.running = false; clearItems();
    if (st.score > best) { best = st.score; localStorage.setItem("best", best); $("bestScore").textContent = best; }
    track("game_over", { reason: reason, score: st.score, level_reached: st.level,
                         levels_completed: reason === "completed" ? C.LEVELS : st.level - 1,
                         duration_s: Math.round((Date.now() - st.startedAt) / 1000), hints_used: st.hintsUsed });
    $("overTitle").textContent = t(reason === "completed" ? "youWon" : "gameOver");
    $("overReason").textContent = reason === "completed" ? "" : t("outOfLives");
    $("finalScore").textContent = st.score; show("over", true);
  }

  // ---------- feature buttons (each one tracked) ----------
  $("btnStart").onclick = function () { beep(520); startGame("start_button"); };
  $("btnAgain").onclick = function () { track("restart_clicked", { from: "game_over", prev_score: st.score }); startGame("play_again"); };
  $("btnRestart").onclick = function () {
    if (!st.running && !$("over").classList.contains("show")) return;
    track("restart_clicked", { from: "in_game", level: st.level, prev_score: st.score }); startGame("restart");
  };
  function pause() {
    if (!st.running || st.paused) return;
    st.paused = true; show("paused", true); track("pause_clicked", { level: st.level, time_left: Math.ceil(st.timeLeft) });
  }
  $("btnPause").onclick = pause;
  $("btnResume").onclick = function () { st.paused = false; show("paused", false); track("resume_clicked", { level: st.level }); };
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
  $("btnHint").onclick = function () {
    st.hintsUsed++; toast(t("hintText"), 2600);
    st.items.forEach(function (it) { if (it.kind === "gold") it.el.classList.add("hint"); });
    track("hint_clicked", { level: st.level, in_game: st.running });
  };
  $("btnSound").onclick = function () {
    st.sound = !st.sound; $("btnSound").setAttribute("data-i18n", st.sound ? "soundOn" : "soundOff");
    $("btnSound").textContent = t(st.sound ? "soundOn" : "soundOff"); beep(440);
    track("sound_toggled", { sound_on: st.sound, level: st.level, in_game: st.running });
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
    track("language_switch_clicked", { from: from, to: to, screen: st.running ? "game" : ($("over").classList.contains("show") ? "game_over" : "start") });
    applyLang(to);
    $("btnSound").textContent = t(st.sound ? "soundOn" : "soundOff");
    toast(t("langChanged"));
  };
  hud();
})();
