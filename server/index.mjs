// silo API + static site. Zero dependencies: node:http, node:sqlite, node:crypto.
//
//   PORT            port to listen on (Railway sets this)
//   DATABASE_PATH   sqlite file, put it on a Railway volume, e.g. /data/silo.db
//   CORS_ORIGIN     comma-separated origins allowed to call the API, e.g.
//                   "https://silo.fund,https://www.silo.fund" (default *)
//   SEED_DEMO       "0" to start with an empty database
//   PROGRAM_ID      silo program id used in signed messages

import http from "node:http";
import { createPublicKey, verify as edVerify } from "node:crypto";
import { readFile, stat, mkdir } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import * as W from "./wots.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "..", "dist");
const PORT = Number(process.env.PORT || 8787);
const DB_PATH = process.env.DATABASE_PATH || join(ROOT, "..", "data", "silo.db");
const CORS = (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const PROGRAM_ID = process.env.PROGRAM_ID || "S1LoqVau1tPq9xW3mZ7bHn4cRk2eYd8uTf6gJsA5LvN";
const SOL_MINT = "So11111111111111111111111111111111111111112";

await mkdir(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS coins (
    mint TEXT PRIMARY KEY, ticker TEXT, name TEXT, image TEXT, creator TEXT,
    vault TEXT UNIQUE, share INTEGER, first_key_hash TEXT, lock_sig TEXT,
    locked_at INTEGER, mcap REAL, vol24 REAL, price REAL, holders INTEGER,
    in_silo REAL DEFAULT 0, lifetime REAL DEFAULT 0, graduated INTEGER DEFAULT 0,
    demo INTEGER DEFAULT 0, updated_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS releases (
    id TEXT PRIMARY KEY, vault TEXT, mint TEXT, ticker TEXT, key_index INTEGER,
    kind TEXT, coin_mint TEXT, amount TEXT, destination TEXT, next_key_hash TEXT,
    salt INTEGER, sig TEXT, key_hash TEXT, program TEXT, steps INTEGER, created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS releases_vault ON releases (vault);
`);

/* ------------------------------------------------------------- live events */

const clients = new Set();
function broadcast(type, data) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}
setInterval(() => {
  for (const res of clients) res.write(": ping\n\n");
}, 25_000);

/* ------------------------------------------------------------- market data */

const cache = new Map();
async function lookup(mint) {
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.t < 60_000) return hit.v;
  let v = null;
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    const pairs = (j.pairs || []).filter((p) => p.chainId === "solana" && p.baseToken?.address === mint);
    pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const p = pairs[0];
    if (p) {
      v = {
        mint,
        name: p.baseToken.name,
        ticker: p.baseToken.symbol,
        image: p.info?.imageUrl || null,
        price: Number(p.priceUsd) || null,
        mcap: p.marketCap || p.fdv || null,
        vol24: p.volume?.h24 ?? null,
        graduated: pairs.some((x) => x.dexId === "pumpswap" || x.dexId === "raydium"),
        source: "dexscreener",
      };
    }
  } catch {}
  cache.set(mint, { t: Date.now(), v });
  return v;
}

async function refreshMarkets() {
  const rows = db.prepare("SELECT mint FROM coins WHERE demo = 0").all();
  for (const { mint } of rows) {
    const m = await lookup(mint);
    if (!m) continue;
    db.prepare("UPDATE coins SET mcap=?, vol24=?, price=?, image=COALESCE(?, image), graduated=?, updated_at=? WHERE mint=?")
      .run(m.mcap, m.vol24, m.price, m.image, m.graduated ? 1 : 0, Date.now(), mint);
    broadcast("coin", coinRow(mint));
  }
}
setInterval(() => refreshMarkets().catch(() => {}), 60_000);

/* ------------------------------------------------------------- helpers */

const coinRow = (mint) => shapeCoin(db.prepare("SELECT * FROM coins WHERE mint = ?").get(mint));
function shapeCoin(r) {
  if (!r) return null;
  return {
    mint: r.mint, ticker: r.ticker, name: r.name, image: r.image, creator: r.creator, vault: r.vault,
    share: r.share, firstKeyHash: r.first_key_hash, lockedAt: r.locked_at, mcap: r.mcap, vol24: r.vol24,
    price: r.price, holders: r.holders, inSilo: r.in_silo, lifetime: r.lifetime, graduated: !!r.graduated,
  };
}
function shapeRelease(r) {
  if (!r) return null;
  return {
    id: r.id, vault: r.vault, mint: r.mint, ticker: r.ticker, keyIndex: r.key_index, kind: r.kind,
    coinMint: r.coin_mint, amount: r.amount, destination: r.destination, nextKeyHash: r.next_key_hash,
    salt: r.salt, sig: r.sig, keyHash: r.key_hash, program: r.program, steps: r.steps, createdAt: r.created_at,
  };
}

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HEX = (n) => new RegExp(`^[0-9a-f]{${n}}$`);

function verifyEd25519(pubkeyB58, message, sigB58) {
  try {
    const pub = W.unbase58(pubkeyB58);
    const sig = W.unbase58(sigB58);
    if (pub.length !== 32 || sig.length !== 64) return false;
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(pub).toString("base64url") }, format: "jwk" });
    return edVerify(null, Buffer.from(message, "utf8"), key, Buffer.from(sig));
  } catch {
    return false;
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64_000) throw new HttpError(413, "body too large");
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "invalid json");
  }
}

/* ------------------------------------------------------------- routes */

async function api(req, res, url) {
  const p = url.pathname;
  const send = (status, data) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(data));
  };

  if (p === "/api/health") return send(200, { ok: true });

  if (p === "/api/stream") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write("retry: 3000\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (p === "/api/stats" && req.method === "GET") {
    const c = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(in_silo),0) s, COALESCE(SUM(lifetime),0) l FROM coins").get();
    const r = db.prepare("SELECT COUNT(*) n FROM releases").get();
    return send(200, { coins: c.n, inSilo: c.s, lifetime: c.l, signatures: r.n });
  }

  if (p === "/api/coins" && req.method === "GET") {
    const vault = url.searchParams.get("vault");
    if (vault) return send(200, shapeCoin(db.prepare("SELECT * FROM coins WHERE vault = ?").get(vault)));
    return send(200, db.prepare("SELECT * FROM coins ORDER BY locked_at DESC").all().map(shapeCoin));
  }

  let m;
  if ((m = p.match(/^\/api\/coins\/([^/]+)$/)) && req.method === "GET") {
    const c = coinRow(m[1]);
    return c ? send(200, c) : send(404, { error: "not found" });
  }

  if ((m = p.match(/^\/api\/lookup\/([^/]+)$/)) && req.method === "GET") {
    const mint = m[1];
    if (!B58.test(mint)) throw new HttpError(400, "not a Solana address");
    const locked = coinRow(mint);
    const market = await lookup(mint);
    return send(200, { mint, locked: !!locked, coin: locked, market });
  }

  if (p === "/api/locks" && req.method === "POST") {
    const b = await body(req);
    const { mint, creator, vault, share, firstKeyHash, message, signature } = b;
    if (![mint, creator, vault].every((x) => typeof x === "string" && B58.test(x))) throw new HttpError(400, "bad address");
    if (!Number.isInteger(share) || share < 1 || share > 100) throw new HttpError(400, "share must be a whole percent from 1 to 100");
    if (typeof firstKeyHash !== "string" || !HEX(64).test(firstKeyHash)) throw new HttpError(400, "bad key hash");
    if (W.vaultAddress(W.unhex(firstKeyHash), PROGRAM_ID) !== vault) throw new HttpError(400, "vault does not match key hash");
    if (typeof message !== "string" || !message.includes(mint) || !message.includes(vault) || !message.includes(firstKeyHash))
      throw new HttpError(400, "message does not describe this lock");
    if (!verifyEd25519(creator, message, signature)) throw new HttpError(401, "wallet signature invalid");
    if (coinRow(mint)) throw new HttpError(409, "this coin is already in a silo");

    const mk = await lookup(mint);
    const now = Date.now();
    db.prepare(`INSERT INTO coins (mint,ticker,name,image,creator,vault,share,first_key_hash,lock_sig,locked_at,mcap,vol24,price,holders,in_silo,lifetime,graduated,demo,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`)
      .run(mint, mk?.ticker ?? b.ticker ?? "COIN", mk?.name ?? b.name ?? "unknown", mk?.image ?? null, creator, vault, share,
        firstKeyHash, signature, now, mk?.mcap ?? null, mk?.vol24 ?? null, mk?.price ?? null, null, 0, 0, mk?.graduated ? 1 : 0, now);
    const c = coinRow(mint);
    broadcast("coin", c);
    return send(201, c);
  }

  if (p === "/api/releases" && req.method === "GET") {
    const limit = Math.min(100, Number(url.searchParams.get("limit") || 25));
    const vault = url.searchParams.get("vault");
    const rows = vault
      ? db.prepare("SELECT * FROM releases WHERE vault = ? ORDER BY created_at DESC LIMIT ?").all(vault, limit)
      : db.prepare("SELECT * FROM releases ORDER BY created_at DESC LIMIT ?").all(limit);
    return send(200, rows.map(shapeRelease));
  }

  if ((m = p.match(/^\/api\/releases\/([^/]+)$/)) && req.method === "GET") {
    const r = shapeRelease(db.prepare("SELECT * FROM releases WHERE id = ?").get(m[1]));
    return r ? send(200, r) : send(404, { error: "no withdrawal with that id" });
  }

  if (p === "/api/releases" && req.method === "POST") {
    const b = await body(req);
    const coin = shapeCoin(db.prepare("SELECT * FROM coins WHERE vault = ?").get(b.vault));
    if (!coin) throw new HttpError(404, "unknown silo");
    if (!HEX(1680).test(b.sig || "")) throw new HttpError(400, "signature must be 840 bytes hex");
    if (!HEX(64).test(b.keyHash || "") || !HEX(64).test(b.nextKeyHash || "")) throw new HttpError(400, "bad key hash");
    if (!B58.test(b.destination || "")) throw new HttpError(400, "bad destination");
    if (!/^\d+$/.test(String(b.amount))) throw new HttpError(400, "bad amount");

    // The silo's current key is the committed next key of its latest withdrawal, or key #0.
    const last = db.prepare("SELECT * FROM releases WHERE vault = ? ORDER BY key_index DESC LIMIT 1").get(b.vault);
    const expectIndex = last ? last.key_index + 1 : 0;
    const expectHash = last ? last.next_key_hash : coin.firstKeyHash;
    if (b.keyIndex !== expectIndex) throw new HttpError(409, `silo expects key #${expectIndex}`);
    if (b.keyHash !== expectHash) throw new HttpError(409, "key hash does not match the silo's current key");

    const w = { program: PROGRAM_ID, vault: b.vault, keyIndex: b.keyIndex, kind: "sol", mint: SOL_MINT,
      amount: BigInt(b.amount), destination: b.destination, nextKeyHash: W.unhex(b.nextKeyHash), salt: Number(b.salt) };
    const sig = W.unhex(b.sig);
    const res2 = W.verify(sig, W.encodeWithdrawal(w), W.unhex(b.keyHash));
    if (res2.steps > W.MAX_VERIFY_STEPS) throw new HttpError(400, "TooMuchWork: grind a new salt");
    if (!res2.ok) throw new HttpError(401, "InvalidSignature");

    const sol = Number(b.amount) / 1e9;
    if (sol > coin.inSilo + 1e-9) throw new HttpError(400, "Insufficient");
    const id = W.base58(W.sha256(sig)); // stands in for the authorize tx signature
    db.prepare(`INSERT INTO releases (id,vault,mint,ticker,key_index,kind,coin_mint,amount,destination,next_key_hash,salt,sig,key_hash,program,steps,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, b.vault, SOL_MINT, coin.ticker, b.keyIndex, "sol", coin.mint, String(b.amount), b.destination, b.nextKeyHash,
        w.salt, b.sig, b.keyHash, PROGRAM_ID, res2.steps + 1, Date.now());
    db.prepare("UPDATE coins SET in_silo = MAX(0, in_silo - ?) WHERE vault = ?").run(sol, b.vault);
    const out = shapeRelease(db.prepare("SELECT * FROM releases WHERE id = ?").get(id));
    broadcast("release", out);
    broadcast("coin", coinRow(coin.mint));
    return send(201, out);
  }

  throw new HttpError(404, "not found");
}

/* ------------------------------------------------------------- static */

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".json": "application/json", ".ico": "image/x-icon" };

async function serveStatic(req, res, url) {
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) file = join(DIST, "index.html");
  let st = await stat(file).catch(() => null);
  if (!st || st.isDirectory()) {
    file = join(DIST, "index.html");
    st = await stat(file).catch(() => null);
    if (!st) {
      res.writeHead(404).end("build the site first: npm run build");
      return;
    }
  }
  const type = TYPES[extname(file)] || "application/octet-stream";
  const immutable = url.pathname.startsWith("/assets/");
  const headers = { "content-type": type, "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300" };

  // range requests so browsers can stream and loop the hero video
  const range = req.headers.range;
  if (range && type === "video/mp4") {
    const [s, e] = range.replace("bytes=", "").split("-");
    const start = Number(s), end = e ? Number(e) : st.size - 1;
    const buf = (await readFile(file)).subarray(start, end + 1);
    res.writeHead(206, { ...headers, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${st.size}`, "content-length": buf.length });
    return res.end(buf);
  }
  res.writeHead(200, { ...headers, "accept-ranges": "bytes", "content-length": st.size });
  res.end(await readFile(file));
}

/* ------------------------------------------------------------- server */

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const origin = req.headers.origin;
    if (CORS.includes("*")) res.setHeader("access-control-allow-origin", "*");
    else if (origin && CORS.includes(origin)) {
      res.setHeader("access-control-allow-origin", origin);
      res.setHeader("vary", "origin");
    }
    res.setHeader("access-control-allow-headers", "content-type");
    res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    try {
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      return await serveStatic(req, res, url);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      if (!res.headersSent) res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: status === 500 ? "server error" : e.message }));
    }
  })
  .listen(PORT, () => console.log(`silo listening on :${PORT} (db ${DB_PATH})`));

/* ------------------------------------------------------------- demo seed */

if (process.env.SEED_DEMO !== "0" && db.prepare("SELECT COUNT(*) n FROM coins").get().n === 0) {
  const { seedDemo } = await import("./seed.mjs");
  seedDemo(db, PROGRAM_ID, SOL_MINT);
  console.log("seeded demo data");
}
