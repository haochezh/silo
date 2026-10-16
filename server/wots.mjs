// Server-side copy of src/lib/wots.ts. Same parameters and byte layout, so a
// signature made in the browser verifies here identically.
import { createHash, pbkdf2Sync } from "node:crypto";

export const N = 28;
export const MSG_DIGITS = 28;
export const CHAINS = 30;
export const W = 256;
export const SIG_BYTES = CHAINS * N; // 840
export const MAX_VERIFY_STEPS = 3600;

const enc = new TextEncoder();
export const sha256 = (...parts) => {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return new Uint8Array(h.digest());
};

export function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const u32 = (n) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
};
const u64 = (n) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n), true);
  return b;
};

const step = (x, j, k) => sha256(new Uint8Array([j, k]), x).slice(0, N);
export function walk(x, j, from, steps) {
  let v = x;
  for (let k = from; k < from + steps; k++) v = step(v, j, k);
  return v;
}

export function digits(message) {
  const d = Array.from(sha256(message).slice(0, MSG_DIGITS));
  const csum = d.reduce((s, x) => s + (W - 1 - x), 0);
  return [...d, (csum >> 8) & 0xff, csum & 0xff];
}

export const verifySteps = (ds) => ds.reduce((s, x) => s + (W - 1 - x), 0);

export function encodeWithdrawal(w) {
  return concat(
    enc.encode("silo/withdraw/v1"),
    enc.encode(w.program),
    enc.encode(w.vault),
    u32(w.keyIndex),
    new Uint8Array([w.kind === "sol" ? 0 : 1]),
    enc.encode(w.mint),
    u64(w.amount),
    enc.encode(w.destination),
    w.nextKeyHash,
    u32(w.salt),
  );
}

export function verify(sig, message, pkHash) {
  const ds = digits(message);
  const pk = [];
  for (let j = 0; j < CHAINS; j++) pk.push(walk(sig.slice(j * N, (j + 1) * N), j, ds[j], W - 1 - ds[j]));
  const recomputed = sha256(...pk);
  return { ok: equal(recomputed, pkHash), steps: verifySteps(ds), recomputed };
}

export function equal(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

// --- key derivation (used only to seed demo data) ---------------------------
export function seedFrom(mnemonic) {
  const m = mnemonic.trim().toLowerCase().split(/\s+/).join(" ").normalize("NFKD");
  return new Uint8Array(pbkdf2Sync(m, "mnemonicsilo/v1", 2048, 64, "sha512"));
}

export function deriveKey(seed, index) {
  const sk = [], pk = [];
  for (let j = 0; j < CHAINS; j++) {
    const s = sha256(enc.encode("silo/sk"), seed, u32(index), new Uint8Array([j])).slice(0, N);
    sk.push(s);
    pk.push(walk(s, j, 0, W - 1));
  }
  return { index, sk, pk, pkHash: sha256(...pk) };
}

export function sign(key, message) {
  const ds = digits(message);
  return concat(...ds.map((d, j) => walk(key.sk[j], j, 0, d)));
}

export function grindSalt(w) {
  for (let salt = 0; ; salt++) {
    if (verifySteps(digits(encodeWithdrawal({ ...w, salt }))) <= MAX_VERIFY_STEPS) return salt;
  }
}

// --- encoding helpers --------------------------------------------------------
const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = "";
  while (n > 0n) {
    s = ALPHA[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    s = "1" + s;
  }
  return s;
}
export function unbase58(str) {
  let n = 0n;
  for (const c of str) {
    const i = ALPHA.indexOf(c);
    if (i < 0) throw new Error("bad base58");
    n = n * 58n + BigInt(i);
  }
  const out = [];
  while (n > 0n) {
    out.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of str) {
    if (c !== "1") break;
    out.unshift(0);
  }
  return new Uint8Array(out);
}
export const hex = (b) => Buffer.from(b).toString("hex");
export const unhex = (s) => new Uint8Array(Buffer.from(s, "hex"));
export const vaultAddress = (firstKeyHash, programId) =>
  base58(sha256(enc.encode("silo"), firstKeyHash, enc.encode(programId)));
