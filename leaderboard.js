/* Leaderboard page: Rank, Score, Hint clicks, Adjusted (= score − penalty × hints), Levels.
 * No names. Ranked by adjusted score so heavy hint users rank lower. Auto-refreshes every 10 s. */
(function () {
  var C = window.GAME_CONFIG || {};
  var API = (C.LEADERBOARD_API || "").replace(/\/+$/, "");
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  applyLang(localStorage.getItem("lang") || "en");
  track("leaderboard_viewed", { from: params.get("from") || "direct" });

  var penalty = C.HINT_PENALTY || 5, loadedOnce = false, inFlight = false;
  function explain() { $("explain").textContent = t("lbExplain", { p: penalty }); }
  explain();

  function setState(kind) {
    var st = $("state");
    if (!kind) { st.hidden = true; return; }
    st.hidden = false;
    st.querySelector(".spin").style.display = kind === "empty" ? "none" : "inline-block";
    $("stateText").textContent = t(kind === "waking" ? "lbWaking" : kind === "error" ? "lbError" : "lbEmpty");
  }

  function cell(tr, cls, text) { var td = document.createElement("td"); td.className = cls; td.textContent = text; tr.appendChild(td); return td; }
  function render(d) {
    penalty = d.hintPenalty || penalty; explain();
    var tb = $("rows"); tb.textContent = "";
    d.entries.forEach(function (e) {
      var tr = document.createElement("tr"); if (e.rank <= 3) tr.className = "top";
      var r = cell(tr, "rank", e.rank === 1 ? "🥇 1" : e.rank === 2 ? "🥈 2" : e.rank === 3 ? "🥉 3" : String(e.rank));
      var sc = cell(tr, "score", String(e.score));
      if (e.first) { var b = document.createElement("span"); b.className = "badge"; b.textContent = "🏁 " + t("firstBadge"); sc.appendChild(b); }
      cell(tr, "hints" + (e.hints >= 3 ? " many" : ""), String(e.hints));
      cell(tr, "adj", String(e.adjusted));
      cell(tr, "levels", e.levels + "/" + (C.LEVELS || 3));
      tb.appendChild(tr);
    });
    $("tbl").hidden = d.entries.length === 0;
    setState(d.entries.length === 0 ? "empty" : null);
    $("count").textContent = t("lbPlayers", { n: d.total });
    $("updated").textContent = t("lbUpdated", { t: new Date().toLocaleTimeString() });
  }

  function load() {
    if (inFlight || !API) return;
    inFlight = true;
    // Free Render services sleep when idle; show a friendly state instead of failing.
    var wakeTimer = setTimeout(function () { if (!loadedOnce) setState("waking"); }, 2500);
    var ctl = window.AbortController ? new AbortController() : null;
    var abortT = setTimeout(function () { if (ctl) ctl.abort(); }, 75000);
    fetch(API + "/leaderboard", { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("http_" + r.status); return r.json(); })
      .then(function (d) { loadedOnce = true; render(d); })
      .catch(function () { if (!loadedOnce) setState("error"); })
      .then(function () { clearTimeout(wakeTimer); clearTimeout(abortT); inFlight = false; });
  }
  setState("waking"); $("stateText").textContent = "…";
  load();
  setInterval(load, 10000);
})();
