(function () {
  var FEATURES = [
    ["game_started", "Start game"], ["sound_toggled", "Sound toggle"], ["restart_clicked", "Restart / Play again"],
    ["share_clicked", "Share score"], ["pause_clicked", "Pause"], ["hint_clicked", "Hint"],
    ["language_switch_clicked", "Language switch (தமிழ்)"]
  ];
  var FUNNEL = [["app_opened", "Opened game (QR)"], ["game_started", "Started game"], ["level_1", "Completed level 1"],
                ["level_2", "Completed level 2"], ["level_3", "Completed level 3 (finished)"]];
  var sample = [], local = [], src = "sample";
  var $ = function (id) { return document.getElementById(id); };
  var tok = localStorage.getItem("mp_token") || (window.GAME_CONFIG || {}).MIXPANEL_TOKEN;
  $("mpStatus").textContent = (tok && tok !== "YOUR_MIXPANEL_PROJECT_TOKEN") ? "Mixpanel: connected (events from this device are also sent to your project)." : "Mixpanel: no token set (placeholder) — local logging only.";

  function loadLocal() {
    try { local = JSON.parse(localStorage.getItem("demo_events") || "[]").map(function (e) {
      return { event: e.event, time: Math.round(e.time / 1000), session: "local_" + e.session, props: e.props || {} }; }); }
    catch (e) { local = []; }
  }
  function sessions(evs) {
    var m = {}; evs.forEach(function (e) { (m[e.session] = m[e.session] || []).push(e); }); return m;
  }
  function pct(a, b) { return b ? Math.round(a / b * 1000) / 10 : 0; }
  function stats(evs) {
    var S = sessions(evs), ids = Object.keys(S), n = ids.length;
    var has = function (s, f) { return S[s].some(f); };
    var feat = FEATURES.map(function (f) { var c = ids.filter(function (s) { return has(s, function (e) { return e.event === f[0]; }); }).length;
      return { key: f[0], label: f[1], count: c, pct: pct(c, n) }; });
    var fun = FUNNEL.map(function (f) {
      var c = ids.filter(function (s) { return has(s, function (e) {
        if (f[0].indexOf("level_") === 0) return e.event === "level_completed" && +e.props.level === +f[0].split("_")[1];
        return e.event === f[0]; }); }).length;
      return { key: f[0], label: f[1], count: c };
    });
    // sessions that started from a state already in-progress (local) may lack app_opened: use max as base
    var base = Math.max(n && fun[0].count, fun[1].count) || n;
    fun.forEach(function (f, i) { f.pct = pct(f.count, base); f.drop = i ? fun[i - 1].count - f.count : 0;
      f.dropPct = i ? pct(fun[i - 1].count - f.count, fun[i - 1].count) : 0; });
    return { n: n, feat: feat, fun: fun, events: evs.length };
  }
  function current() { return src === "sample" ? sample : src === "local" ? local : sample.concat(local); }
  function render() {
    var st = stats(current());
    $("features").innerHTML = st.n ? st.feat.map(function (f) {
      return '<div class="row' + (f.key === "language_switch_clicked" ? " under" : "") + '"><div>' + f.label + '</div><div class="bar"><div class="fill" style="width:' + f.pct + '%"></div></div><div class="num">' + f.pct + '% (' + f.count + '/' + st.n + ')</div></div>';
    }).join("") : '<p class="muted">No sessions yet. Play the game on this device, then come back.</p>';
    $("funnel").innerHTML = st.n ? st.fun.map(function (f, i) {
      return '<div class="row"><div>' + f.label + '</div><div class="bar"><div class="fill" style="width:' + f.pct + '%;background:#1e88e5"></div></div><div class="num">' + f.count + ' (' + f.pct + '%)' +
        (i && f.drop ? '<div class="drop">−' + f.drop + ' (' + f.dropPct + '% drop)</div>' : '') + '</div></div>';
    }).join("") : "";
    $("prompt").value = buildPrompt(st);
    $("evSrc").textContent = src === "sample" ? "sample" : src === "local" ? "this device" : "combined";
    var last = current().slice().sort(function (a, b) { return b.time - a.time; }).slice(0, 60);
    $("events").innerHTML = '<table><tr><th>time</th><th>session</th><th>event</th><th>props</th></tr>' + last.map(function (e) {
      var p = Object.assign({}, e.props); ["distinct_id","$os","$browser","utm_source","game","simulated","demo_session_id"].forEach(function(k){ delete p[k]; });
      return '<tr><td>' + new Date(e.time * 1000).toLocaleTimeString() + '</td><td>' + e.session.slice(0, 18) + '</td><td>' + e.event + '</td><td>' + JSON.stringify(p).slice(0, 80) + '</td></tr>'; }).join("") + '</table>';
  }
  function buildPrompt(st) {
    var feat = st.feat.map(function (f) { return "- " + f.label + " (" + f.key + "): " + f.pct + "% of sessions (" + f.count + "/" + st.n + ")"; }).join("\n");
    var fun = st.fun.map(function (f, i) { return "- " + f.label + ": " + f.count + (i ? " (−" + f.drop + ", " + f.dropPct + "% drop from previous step)" : ""); }).join("\n");
    return "You are a senior mobile UX researcher. Below is product analytics from a 1–3 minute casual mobile web game, \"Mango Catch\" (tap falling mangoes, avoid chillies; 3 levels × 20 s; opened from a QR code; no install).\n\n" +
      "UI context: Start button on the start screen; a bottom bar with Pause, Hint, Sound and Restart; Share score + Play again on the game-over screen; a Tamil/English language switch is a tiny low-contrast \"EN · த\" button in the bottom-right corner. Audience: event attendees in Tamil Nadu, India.\n\n" +
      "Sessions analysed: " + st.n + (src === "sample" ? " (simulated demo data)" : "") + "\n\nFeature usage (% of sessions that used it at least once):\n" + feat +
      "\n\nDrop-off funnel:\n" + fun +
      "\n\nTask: Give exactly 3 UX improvement suggestions, ranked by expected impact. For each: (1) the problem the data suggests, citing the numbers, (2) the specific design change, (3) the metric to watch and a realistic target, (4) effort (S/M/L). Address the least-used feature and the biggest drop-off point. Keep it under 250 words.";
  }
  document.querySelectorAll("#tabs button").forEach(function (b) { b.onclick = function () {
    document.querySelectorAll("#tabs button").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); src = b.dataset.src; loadLocal(); render(); }; });
  $("copy").onclick = function () { var ta = $("prompt"); ta.select(); (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).catch(function () { document.execCommand("copy"); }); $("copy").textContent = "Copied ✓"; setTimeout(function(){ $("copy").textContent = "Copy prompt"; }, 1500); };
  $("clear").onclick = function () { if (confirm("Clear locally logged events on this device?")) { localStorage.removeItem("demo_events"); loadLocal(); render(); } };
  window.addEventListener("storage", function () { loadLocal(); render(); });
  loadLocal();
  fetch("sample_sessions.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
    sample = []; d.sessions.forEach(function (s) { s.events.forEach(function (e) { sample.push({ event: e.event, time: e.time, session: "sim_" + s.user, props: e.properties }); }); });
    render();
  }).catch(function (e) { $("features").innerHTML = '<p class="muted">Could not load sample_sessions.json (' + e + '). Open via http(s), not file://.</p>'; });
  setInterval(function () { if (src !== "sample") { loadLocal(); render(); } }, 3000);
})();
