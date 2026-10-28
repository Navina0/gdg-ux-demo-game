/* Mango Catch leaderboard API — server-validated scores.
 *
 * Store: Render Key Value (Valkey/Redis) via REDIS_URL (internal URL, never sent
 * to the browser). Without REDIS_URL it falls back to an in-memory store (dev only).
 *
 * Env vars (set in the Render dashboard → service → Environment):
 *   REDIS_URL       internal Key Value URL
 *   SESSION_SECRET  HMAC key used to sign session ids
 *   ADMIN_KEY       protects /admin/* routes (header X-Admin-Key)
 *   ALLOWED_ORIGIN  comma-separated origins allowed by CORS (default https://navina0.github.io)
 *
 * Honest caveat: the game runs in the player's browser, so no client-side game can be
 * made fully cheat-proof. This API makes cheating hard: it never trusts timing from the
 * client, signs sessions, bounds the score by what the game can physically spawn in the
 * elapsed server time, enforces 60 s per level, one submission per session, rate limits.
 */
const express = require("express");
const crypto = require("crypto");

// ---- game constants (must mirror config.js / game.js) ----
const G = {
  LEVELS: 3,
  LEVEL_SECONDS: 60,
  GOLD_P: 0.12,                                   // spawn(): r < 0.12 -> gold (+3)
  chilliP: (l) => 0.18 + l * 0.05,                // spawn(): chilli probability
  spawnEvery: (l) => Math.max(0.3, 0.85 - l * 0.15), // loop(): seconds between spawns
  TIME_TOLERANCE_S: 8,                            // network / timer slack per check
  HINT_PENALTY: 5
};
const SESSION_TTL_S = 2 * 60 * 60;

// Plausible max points for `seconds` of play at level l: number of items that can
// spawn, each worth its expected value if the player caught every mango, plus a
// 6-sigma allowance for lucky gold streaks, plus a small constant.
function plausibleMax(l, seconds) {
  const n = Math.floor(Math.max(0, seconds) / G.spawnEvery(l)) + 2;
  const pg = G.GOLD_P, pm = 1 - pg - G.chilliP(l);
  const mu = pm * 1 + pg * 3;
  const ex2 = pm * 1 + pg * 9;
  const sd = Math.sqrt(ex2 - mu * mu);
  return Math.ceil(n * mu + 6 * Math.sqrt(n) * sd + 5);
}
function maxScoreFor(levelsCompleted, partialSeconds) {
  let m = 0;
  for (let l = 1; l <= levelsCompleted; l++) m += plausibleMax(l, G.LEVEL_SECONDS);
  if (levelsCompleted < G.LEVELS) m += plausibleMax(levelsCompleted + 1, Math.min(G.LEVEL_SECONDS, partialSeconds));
  return m;
}

// ---- store ----
function memoryStore() {
  const kv = new Map(), hashes = new Map();
  return {
    kind: "memory",
    async get(k) { const v = kv.get(k); if (!v) return null; if (v.exp && v.exp < Date.now()) { kv.delete(k); return null; } return v.val; },
    async set(k, val, ttl) { kv.set(k, { val, exp: ttl ? Date.now() + ttl * 1000 : 0 }); },
    async setNX(k, val) { if (await this.get(k) !== null) return false; kv.set(k, { val, exp: 0 }); return true; },
    async del(k) { kv.delete(k); hashes.delete(k); },
    async hset(h, f, v) { if (!hashes.has(h)) hashes.set(h, new Map()); hashes.get(h).set(f, v); },
    async hgetall(h) { return Object.fromEntries(hashes.get(h) || []); },
    async hdel(h, f) { if (hashes.has(h)) hashes.get(h).delete(f); },
    async incr(k, ttl) { const v = (+(await this.get(k)) || 0) + 1; const e = kv.get(k); kv.set(k, { val: String(v), exp: e && e.exp ? e.exp : Date.now() + ttl * 1000 }); return v; },
    async ping() { return "PONG"; }
  };
}
function redisStore(url) {
  const { createClient } = require("redis");
  const c = createClient({ url, socket: { reconnectStrategy: (n) => Math.min(n * 200, 3000) } });
  c.on("error", (e) => console.error("redis error:", e.message));
  c.connect().then(() => console.log("redis connected"));
  return {
    kind: "redis",
    get: (k) => c.get(k),
    set: (k, v, ttl) => (ttl ? c.set(k, v, { EX: ttl }) : c.set(k, v)),
    setNX: async (k, v) => (await c.set(k, v, { NX: true })) === "OK",
    del: (k) => c.del(k),
    hset: (h, f, v) => c.hSet(h, f, v),
    hgetall: (h) => c.hGetAll(h),
    hdel: (h, f) => c.hDel(h, f),
    incr: async (k, ttl) => { const v = await c.incr(k); if (v === 1) await c.expire(k, ttl); return v; },
    ping: () => c.ping()
  };
}
const store = process.env.REDIS_URL ? redisStore(process.env.REDIS_URL) : memoryStore();
const K = { sess: (id) => "mc:sess:" + id, entries: "mc:entries", first: "mc:first_finisher", rl: (ip, b) => "mc:rl:" + b + ":" + ip };

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) console.warn("SESSION_SECRET not set — using a random per-boot secret");
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const ALLOWED = (process.env.ALLOWED_ORIGIN || "https://navina0.github.io").split(",").map((s) => s.trim()).filter(Boolean);

const sign = (id, t0) => crypto.createHmac("sha256", SECRET).update(id + "." + t0).digest("base64url");
function verifySig(id, t0, sig) {
  if (typeof sig !== "string") return false;
  const a = Buffer.from(sign(id, t0)), b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function cleanName(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.normalize("NFC").replace(/[\u0000-\u001f\u007f<>&"'`\\{}]/g, "").replace(/[^\p{L}\p{M}\p{N} ._\-]/gu, "").replace(/\s+/g, " ").trim();
  const chars = Array.from(s);
  if (chars.length < 1) return null;
  if (chars.length > 20) s = chars.slice(0, 20).join("").trim();
  return s || null;
}
const int = (v) => (Number.isInteger(v) ? v : NaN);

// ---- app ----
const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "2kb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") return res.sendStatus(origin && ALLOWED.includes(origin) ? 204 : 403);
  // Browser writes from any other site are refused outright.
  if (req.method === "POST" && origin && !ALLOWED.includes(origin)) return res.status(403).json({ ok: false, error: "origin_not_allowed" });
  next();
});

const ipOf = (req) => (req.ip || "unknown").replace(/^::ffff:/, "");
function rateLimit(bucket, max, windowS) {
  return async (req, res, next) => {
    try {
      const n = await store.incr(K.rl(ipOf(req), bucket), windowS);
      if (n > max) return res.status(429).json({ ok: false, error: "rate_limited" });
    } catch (e) { /* fail open on store hiccup */ }
    next();
  };
}

app.get("/", (req, res) => res.json({ ok: true, service: "mango-catch-api", see: "/health, /leaderboard" }));
app.get("/health", async (req, res) => {
  let db = "down";
  try { db = (await store.ping()) ? "up" : "down"; } catch (e) {}
  res.json({ ok: true, store: store.kind, db, time: Date.now() });
});

app.post("/session/start", rateLimit("start", 300, 600), async (req, res) => {
  const id = crypto.randomBytes(12).toString("base64url");
  const t0 = Date.now();
  const sess = { id, t0, ip: ipOf(req), levels: 0, score: 0, hints: 0, checkpoints: [t0], final: false, submitted: false, first: false };
  await store.set(K.sess(id), JSON.stringify(sess), SESSION_TTL_S);
  res.json({ ok: true, sessionId: id, sig: sign(id, t0), serverStart: t0, levelSeconds: G.LEVEL_SECONDS, hintPenalty: G.HINT_PENALTY });
});

async function loadSession(body) {
  const id = body && typeof body.sessionId === "string" ? body.sessionId : "";
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return { err: "bad_session" };
  const raw = await store.get(K.sess(id));
  if (!raw) return { err: "unknown_or_expired_session" };
  const s = JSON.parse(raw);
  if (!verifySig(s.id, s.t0, body.sig)) return { err: "bad_signature" };
  return { s };
}

// Validate a (score, levels, hints) state against the session and server clock.
function validate(s, score, levels, hints, now) {
  if (![score, levels, hints].every((v) => Number.isInteger(v) && v >= 0)) return "bad_numbers";
  if (levels > G.LEVELS) return "too_many_levels";
  if (levels < s.levels || score < s.score || hints < s.hints) return "values_went_backwards";
  if (hints > 500) return "too_many_hints";
  const elapsed = (now - s.t0) / 1000;
  // 1) cannot complete N levels faster than N × LEVEL_SECONDS (server-measured)
  if (levels > 0 && elapsed + G.TIME_TOLERANCE_S < levels * G.LEVEL_SECONDS) return "completed_too_fast";
  // each new level checkpoint must be >= LEVEL_SECONDS after the previous one
  if (levels > s.levels) {
    const last = s.checkpoints[s.checkpoints.length - 1];
    const perLevel = (now - last) / 1000 / (levels - s.levels);
    if (perLevel + G.TIME_TOLERANCE_S < G.LEVEL_SECONDS) return "level_too_fast";
  }
  // 2) score cannot exceed what the game can spawn in the elapsed time
  const partial = Math.max(0, elapsed - levels * G.LEVEL_SECONDS);
  const max = maxScoreFor(levels, partial + G.TIME_TOLERANCE_S);
  if (score > max) return "score_implausible";
  if (elapsed > SESSION_TTL_S) return "session_too_old";
  return null;
}

app.post("/session/progress", rateLimit("progress", 1500, 600), async (req, res) => {
  const { s, err } = await loadSession(req.body);
  if (err) return res.status(400).json({ ok: false, error: err });
  if (s.final || s.submitted) return res.status(409).json({ ok: false, error: "session_closed" });
  const now = Date.now();
  const score = int(req.body.score), levels = int(req.body.levelsCompleted), hints = int(req.body.hintsUsed);
  const bad = validate(s, score, levels, hints, now);
  if (bad) { s.rejected = bad; await store.set(K.sess(s.id), JSON.stringify(s), SESSION_TTL_S); return res.status(422).json({ ok: false, error: bad }); }
  if (levels > s.levels) for (let i = s.levels; i < levels; i++) s.checkpoints.push(now);
  Object.assign(s, { score, levels, hints, updatedAt: now });
  let firstFinisher = false;
  if (req.body.final === true) {
    s.final = true;
    s.reason = req.body.reason === "completed" ? "completed" : "out_of_lives";
    if (levels === G.LEVELS) firstFinisher = await store.setNX(K.first, s.id);
    s.first = firstFinisher;
  }
  await store.set(K.sess(s.id), JSON.stringify(s), SESSION_TTL_S);
  res.json({ ok: true, firstFinisher, adjustedScore: score - G.HINT_PENALTY * hints });
});

app.post("/score", rateLimit("score", 200, 600), async (req, res) => {
  const { s, err } = await loadSession(req.body);
  if (err) return res.status(400).json({ ok: false, error: err });
  if (s.submitted) return res.status(409).json({ ok: false, error: "already_submitted" });
  if (s.rejected) return res.status(422).json({ ok: false, error: "run_failed_validation:" + s.rejected });
  if (!s.final) return res.status(409).json({ ok: false, error: "game_not_finished" });
  const name = cleanName(req.body.name);
  if (!name) return res.status(400).json({ ok: false, error: "bad_name" });
  // Optional re-check if the client re-sends its final numbers: they must match the server record.
  if (req.body.score !== undefined && int(req.body.score) !== s.score) return res.status(422).json({ ok: false, error: "score_mismatch" });
  s.submitted = true;
  await store.set(K.sess(s.id), JSON.stringify(s), SESSION_TTL_S);
  const entry = { id: s.id, name, score: s.score, hints: s.hints, levels: s.levels, adjusted: s.score - G.HINT_PENALTY * s.hints,
                  first: !!s.first, at: Date.now(), duration_s: Math.round(((s.updatedAt || Date.now()) - s.t0) / 1000) };
  await store.hset(K.entries, s.id, JSON.stringify(entry));
  const all = await sorted();
  res.json({ ok: true, entry: publicEntry(entry), rank: all.findIndex((e) => e.id === s.id) + 1 });
});

async function sorted() {
  const h = await store.hgetall(K.entries);
  return Object.values(h).map((v) => JSON.parse(v))
    .sort((a, b) => b.adjusted - a.adjusted || b.score - a.score || a.hints - b.hints || a.at - b.at);
}
const publicEntry = (e) => ({ name: e.name, score: e.score, hints: e.hints, levels: e.levels, adjusted: e.adjusted, first: e.first, at: e.at });

app.get("/leaderboard", async (req, res) => {
  const all = await sorted();
  const firstId = await store.get(K.first);
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, hintPenalty: G.HINT_PENALTY, total: all.length, hasFirstFinisher: !!firstId,
             entries: all.slice(0, 100).map((e, i) => Object.assign({ rank: i + 1 }, publicEntry(e))) });
});

// ---- admin (X-Admin-Key header must equal ADMIN_KEY env var) ----
function admin(req, res, next) {
  const k = req.get("x-admin-key") || "";
  if (!ADMIN_KEY || k.length !== ADMIN_KEY.length || !crypto.timingSafeEqual(Buffer.from(k), Buffer.from(ADMIN_KEY))) return res.status(401).json({ ok: false });
  next();
}
app.post("/admin/delete", admin, async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name : "";
  const prefix = typeof req.body.prefix === "string" && req.body.prefix.length >= 3 ? req.body.prefix : null;
  const h = await store.hgetall(K.entries);
  let removed = 0;
  for (const [id, v] of Object.entries(h)) {
    const e = JSON.parse(v);
    if (e.name === name || (prefix && e.name.startsWith(prefix))) { await store.hdel(K.entries, id); removed++; if ((await store.get(K.first)) === id) await store.del(K.first); }
  }
  res.json({ ok: true, removed });
});
app.post("/admin/reset", admin, async (req, res) => {
  await store.del(K.entries); await store.del(K.first);
  res.json({ ok: true });
});

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ ok: false, error: "server_error" }); });

if (require.main === module) {
  const port = process.env.PORT || 10000;
  app.listen(port, () => console.log("mango-catch-api listening on", port, "store:", store.kind, "origins:", ALLOWED.join(",")));
}
module.exports = { app, plausibleMax, maxScoreFor, cleanName };
