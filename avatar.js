/* Cartoon mango avatars — inline SVG, deterministic from a player id (no names). */
(function () {
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var BODIES = [["#ffe259", "#ffa751"], ["#ffd54f", "#ff8f00"], ["#c6e377", "#f9d423"], ["#ffb347", "#ff5e3a"],
                ["#fceabb", "#f8b500"], ["#a8e063", "#ffd200"], ["#ff9a8b", "#ffcc33"], ["#f6d365", "#fda085"]];
  var EYES = [
    '<circle cx="24" cy="30" r="3.2" fill="#2b1a0e"/><circle cx="40" cy="30" r="3.2" fill="#2b1a0e"/><circle cx="25" cy="29" r="1" fill="#fff"/><circle cx="41" cy="29" r="1" fill="#fff"/>',
    '<path d="M20 31 Q24 25 28 31 M36 31 Q40 25 44 31" stroke="#2b1a0e" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    '<circle cx="24" cy="30" r="3.2" fill="#2b1a0e"/><path d="M36 30 Q40 26 44 30" stroke="#2b1a0e" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    '<circle cx="24" cy="30" r="5" fill="#fff" stroke="#2b1a0e" stroke-width="1.2"/><circle cx="40" cy="30" r="5" fill="#fff" stroke="#2b1a0e" stroke-width="1.2"/><circle cx="25" cy="31" r="2.4" fill="#2b1a0e"/><circle cx="41" cy="31" r="2.4" fill="#2b1a0e"/>',
    '<rect x="16" y="26" width="13" height="8" rx="3" fill="#111"/><rect x="35" y="26" width="13" height="8" rx="3" fill="#111"/><path d="M29 29 H35" stroke="#111" stroke-width="2"/><path d="M18 28 l4 0" stroke="#fff" stroke-width="1.2" opacity=".7"/>',
    '<path d="M20 28 l7 4 M27 28 l-7 4 M37 28 l7 4 M44 28 l-7 4" stroke="#2b1a0e" stroke-width="2.2" stroke-linecap="round"/>'
  ];
  var MOUTHS = [
    '<path d="M25 40 Q32 47 39 40" stroke="#5a1e0e" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    '<path d="M24 39 Q32 50 40 39 Z" fill="#7b1f12"/><path d="M28 44 Q32 47 36 44" fill="#ff7a8a"/>',
    '<path d="M25 40 Q32 46 39 40" stroke="#5a1e0e" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M33 43 q3 5 6 0" fill="#ff5d73"/>',
    '<ellipse cx="32" cy="42" rx="3.6" ry="4.2" fill="#7b1f12"/>',
    '<path d="M24 39 H40 Q38 47 32 47 Q26 47 24 39 Z" fill="#7b1f12"/><rect x="26" y="39" width="12" height="3" fill="#fff"/>'
  ];
  var ACC = [
    '',
    '<path d="M17 18 Q32 2 47 18 Z" fill="#e53935"/><path d="M40 17 Q52 16 55 21 L42 20 Z" fill="#b71c1c"/><circle cx="32" cy="9" r="2" fill="#b71c1c"/>',
    '<path d="M20 15 L23 5 L28 12 L32 3 L36 12 L41 5 L44 15 Z" fill="#ffd700" stroke="#c79100" stroke-width="1"/><circle cx="32" cy="9" r="1.6" fill="#e53935"/>',
    '<path d="M44 14 l8 -5 l0 10 Z M44 14 l-1 -9 l9 4 Z" fill="#ec407a"/><circle cx="45" cy="14" r="2.2" fill="#ad1457"/>',
    '<path d="M12 22 Q32 12 52 22" stroke="#1e88e5" stroke-width="5" fill="none" stroke-linecap="round"/>',
    '<path d="M24 14 L32 -1 L40 14 Z" fill="#7e57c2"/><circle cx="32" cy="-1" r="2.6" fill="#ffca28"/><path d="M27 10 h10" stroke="#ffca28" stroke-width="2"/>',
    '<path d="M24 37 Q28 33 32 37 Q36 33 40 37 Q36 39 32 37.5 Q28 39 24 37 Z" fill="#3e2723"/>'
  ];
  window.mangoAvatar = function (id, size) {
    var h = hash(String(id || "x")), b = BODIES[h % BODIES.length], e = EYES[(h >>> 4) % EYES.length],
        m = MOUTHS[(h >>> 8) % MOUTHS.length], a = ACC[(h >>> 12) % ACC.length], tilt = ((h >>> 16) % 17) - 8,
        gid = "g" + h.toString(36), s = size || 44;
    return '<svg class="mango-av" width="' + s + '" height="' + s + '" viewBox="0 -4 64 68" aria-hidden="true">' +
      '<defs><radialGradient id="' + gid + '" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="' + b[0] + '"/><stop offset="1" stop-color="' + b[1] + '"/></radialGradient></defs>' +
      '<g transform="rotate(' + tilt + ' 32 34)">' +
      '<path d="M31 12 q1 -6 4 -8" stroke="#6d4c41" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M34 9 Q46 0 54 8 Q44 16 34 9 Z" fill="#43a047"/><path d="M36 9 Q45 6 52 8" stroke="#2e7d32" stroke-width="1" fill="none"/>' +
      '<path d="M32 12 C48 11 58 24 56 39 C54 54 43 61 30 59 C16 57 7 45 9 31 C11 18 20 12 32 12 Z" fill="url(#' + gid + ')" stroke="#c76b00" stroke-width="1.5"/>' +
      '<ellipse cx="22" cy="22" rx="5" ry="3" fill="#fff" opacity=".45" transform="rotate(-30 22 22)"/>' +
      '<circle cx="19" cy="39" r="3.6" fill="#ff6f91" opacity=".45"/><circle cx="45" cy="39" r="3.6" fill="#ff6f91" opacity=".45"/>' +
      e + m + a + '</g></svg>';
  };
})();
