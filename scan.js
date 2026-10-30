/* scan.html — QR entry page: big Play button + live leaderboard (overall + per level).
 * No names: every player is a cartoon mango generated from their id. Dummy players are labelled. */
(function () {
  var C = window.GAME_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search), src = params.get("utm_source") || "direct";
  applyLang(localStorage.getItem("lang") || "en");
  track("scan_page_opened", { utm_source: src, referrer: document.referrer || "direct" });
  track("leaderboard_viewed", { page: "scan", from: src, utm_source: src });

  $("faces").innerHTML = ["sun", "rain", "party"].map(function (k) { return "<span>" + mangoAvatar("hero-" + k, 78) + "</span>"; }).join("");
  $("btnPlay").href = "./?utm_source=" + encodeURIComponent(src) + "&from=scan";
  $("btnPlay").onclick = function () { track("play_clicked", { from: "scan", utm_source: src }); };
  $("lnkFull").onclick = function () { track("full_leaderboard_clicked", { from: "scan" }); };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function tags(e) {
    return (e.dummy ? '<span class="dtag" title="' + esc(t("dummyTitle")) + '">' + esc(t("dummy")) + "</span>" : "") +
           (e.first ? '<span class="badge">🏁 ' + esc(t("firstBadge")) + "</span>" : "");
  }
  function medal(r) { return r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : String(r); }

  // Player names are filled in AFTER the markup is built, with textContent only (never parsed as HTML).
  // Dummy players have no name: their row keeps the existing DUMMY label. Old entries without a name → "Player".
  function setNames(root, list) {
    var els = root.querySelectorAll(".pname");
    list.forEach(function (e, k) {
      var el = els[k]; if (!el) return;
      if (e.dummy) { el.remove(); return; }
      el.textContent = e.name || "Player"; el.title = el.textContent;
    });
  }
  var last = null;
  function render(v) {
    last = v;
    $("explain").textContent = t("lbExplain", { p: C.HINT_PENALTY || 5 });
    $("total").textContent = v.real + v.dummy;
    $("cReal").textContent = t("realPlayers", { n: v.real });
    $("cDummy").textContent = t("dummyPlayers", { n: v.dummy });
    var note = v.state === "waking" ? t("lbWaking") : v.state === "demo" ? t("demoNote") : v.state === "loading" ? "…" : "";
    $("note").hidden = !note; $("note").textContent = note;

    var top = v.entries.slice(0, 10);
    $("top").innerHTML = top.map(function (e) {
      return '<li class="row' + (e.dummy ? " dummy" : "") + (e.rank === 1 ? " r1" : "") + '"><span class="rk">' + medal(e.rank) + "</span>" +
        mangoAvatar(e.pid, 46) + '<div class="info"><div class="pname"></div><div class="sc">' + e.score + tags(e) + "</div>" +
        '<div class="meta">💡 ' + esc(t("colHints")) + ": " + e.hints + " · " + esc(t("colLevels")) + ": " + e.levels + "/" + (C.LEVELS || 2) + "</div></div>" +
        '<div class="adj">' + e.adjusted + "<small>" + esc(t("colAdj")) + "</small></div></li>";
    }).join("") || '<li class="empty">' + esc(t("lbEmpty")) + "</li>";
    setNames($("top"), top);

    $("levels").innerHTML = v.perLevel.map(function (list, i) {
      return '<div class="lv"><h3>' + ["🟢", "🟠", "🔴"][i] + " " + esc(t("topLevel", { n: i + 1 })) + "</h3><ol>" +
        (list.slice(0, 5).map(function (e, j) {
          return '<li class="row' + (e.dummy ? " dummy" : "") + '"><span class="rk">' + medal(j + 1) + "</span>" + mangoAvatar(e.pid, 34) +
            '<div class="info"><div class="pname"></div><div class="sc">' + e.levelScores[i] + tags(e) + '</div><div class="meta">💡 ' + e.hints + "</div></div></li>";
        }).join("") || '<li class="empty">' + esc(t("noneYet")) + "</li>") + "</ol></div>";
    }).join("");
    v.perLevel.forEach(function (list, i) { var ol = $("levels").querySelectorAll(".lv ol")[i]; if (ol) setNames(ol, list.slice(0, 5)); });
    $("updated").textContent = t("lbUpdated", { t: new Date().toLocaleTimeString() });
  }
  // Firebase Perf custom trace: page start → first real leaderboard data (not "loading"/"waking")
  var lbTrace = window.OBS ? OBS.trace("leaderboard_load", { page: "scan" }) : null, sawWaking = false;
  Scores.subscribe(function (v) {
    if (v.state === "waking") sawWaking = true;
    if (lbTrace && v.state !== "loading" && v.state !== "waking") { lbTrace.metric("entries", v.entries.length).stop({ store: v.store, state: v.state, cold_start: sawWaking }); lbTrace = null; }
    render(v);
  });

  // tiny language switcher (same as the game's)
  $("btnLang").onclick = function () {
    var to = window.currentLang === "en" ? "ta" : "en";
    track("language_changed", { from: window.currentLang, to: to, screen: "scan" });
    applyLang(to); if (last) render(last);
  };
})();
