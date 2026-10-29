/* leaderboard.html — Rank, Score, Hint clicks (+ Adjusted, Levels). No names.
 * Data via scores.js (Firestore → Render API → demo mode). Dummy players are labelled. */
(function () {
  var C = window.GAME_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  applyLang(localStorage.getItem("lang") || "en");
  track("leaderboard_viewed", { page: "leaderboard", from: params.get("from") || "direct", utm_source: params.get("utm_source") || "direct" });
  $("explain").textContent = t("lbExplain", { p: C.HINT_PENALTY || 5 });

  function setState(kind) {
    var el = $("state");
    if (!kind) { el.hidden = true; return; }
    el.hidden = false;
    el.querySelector(".spin").style.display = kind === "waking" || kind === "loading" ? "" : "none";
    $("stateText").textContent = kind === "loading" ? "…" : t(kind === "waking" ? "lbWaking" : kind === "demo" ? "demoNote" : "lbEmpty");
  }
  function cell(tr, cls, html) { var td = document.createElement("td"); td.className = cls; td.innerHTML = html; tr.appendChild(td); return td; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function dummyTag() { return '<span class="dtag" title="' + esc(t("dummyTitle")) + '">' + esc(t("dummy")) + "</span>"; }

  Scores.subscribe(function (v) {
    var tb = $("rows"); tb.textContent = "";
    v.entries.slice(0, 100).forEach(function (e) {
      var tr = document.createElement("tr"); if (e.rank <= 3) tr.className = "top"; if (e.dummy) tr.className += " dummy";
      cell(tr, "rank", (e.rank === 1 ? "🥇 " : e.rank === 2 ? "🥈 " : e.rank === 3 ? "🥉 " : "") + e.rank);
      var sc = cell(tr, "score", '<span class="who">' + mangoAvatar(e.pid, 34) + (e.dummy ? "" : '<span class="pname"></span>') +
        "<b>" + e.score + "</b>" + (e.dummy ? dummyTag() : "") +
        (e.first ? '<span class="badge">🏁 ' + esc(t("firstBadge")) + "</span>" : "") + "</span>");
      // player-typed name: plain text only (textContent), never HTML. Old entries without a name → "Player".
      if (!e.dummy) { var pn = sc.querySelector(".pname"); pn.textContent = e.name || "Player"; pn.title = pn.textContent; }
      cell(tr, "hints" + (e.hints >= 3 ? " many" : ""), String(e.hints));
      cell(tr, "adj", String(e.adjusted));
      cell(tr, "levels", e.levels + "/" + (C.LEVELS || 2));
      tb.appendChild(tr);
    });
    $("tbl").hidden = v.entries.length === 0;
    setState(v.state === "waking" || v.state === "loading" || v.state === "demo" ? v.state : (v.entries.length ? null : "empty"));
    $("count").textContent = t("totalPlayers") + ": " + t("realPlayers", { n: v.real }) + " · " + t("dummyPlayers", { n: v.dummy });
    $("updated").textContent = t("lbUpdated", { t: new Date().toLocaleTimeString() });
  });
})();
