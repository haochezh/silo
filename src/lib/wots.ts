// Winternitz one-time signatures over SHA-256 (w = 256).
// Same parameters the on-chain verifier uses: 28 message digits + 2 checksum
// digits = 30 chains, each value truncated to 224 bits. Signature = 840 bytes.

import { sha256 } from "@noble/hashes/sha256";
import { mnemonicToSeedSync, generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

export const N = 28; // bytes per chain value
export const MSG_DIGITS = 28;
export const CSUM_DIGITS = 2;
export const CHAINS = MSG_DIGITS + CSUM_DIGITS; // 30
export const W = 256;
export const SIG_BYTES = CHAINS * N; // 840
export const MAX_VERIFY_STEPS = 3600; // client grinds a salt until verify work is under this

const enc = new TextEncoder();

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function u64(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
}

// One hash step on chain `j` at position `k`. The (j, k) tweak stops an
// attacker from reusing a value found on one chain or step on another.
function step(x: Uint8Array, j: number, k: number): Uint8Array {
  return sha256(concat(new Uint8Array([j, k]), x)).slice(0, N);
}

export function walk(x: Uint8Array, j: number, from: number, steps: number): Uint8Array {
  let v = x;
  for (let k = from; k < from + steps; k++) v = step(v, j, k);
  return v;
}

export type KeyPair = { index: number; sk: Uint8Array[]; pk: Uint8Array[]; pkHash: Uint8Array };

export function newMnemonic(): string {
  return generateMnemonic(wordlist, 256); // 24 words
}

export function isMnemonic(m: string): boolean {
  return validateMnemonic(m.trim().toLowerCase().split(/\s+/).join(" "), wordlist);
}

export function seedFrom(mnemonic: string): Uint8Array {
  return mnemonicToSeedSync(mnemonic.trim().toLowerCase().split(/\s+/).join(" "), "silo/v1");
}

export function deriveKey(seed: Uint8Array, index: number): KeyPair {
  const sk: Uint8Array[] = [];
  const pk: Uint8Array[] = [];
  for (let j = 0; j < CHAINS; j++) {
    const s = sha256(concat(enc.encode("silo/sk"), seed, u32(index), new Uint8Array([j]))).slice(0, N);
    sk.push(s);
    pk.push(walk(s, j, 0, W - 1));
  }
  return { index, sk, pk, pkHash: sha256(concat(...pk)) };
}

export function digits(message: Uint8Array): number[] {
  const d = Array.from(sha256(message).slice(0, MSG_DIGITS));
  const csum = d.reduce((s, x) => s + (W - 1 - x), 0); // max 7140, fits in 2 bytes
  return [...d, (csum >> 8) & 0xff, csum & 0xff];
}

export function verifySteps(ds: number[]): number {
  return ds.reduce((s, x) => s + (W - 1 - x), 0);
}

export type Withdrawal = {
  program: string;
  vault: string;
  keyIndex: number;
  kind: "sol" | "token";
  mint: string;
  amount: bigint;
  destination: string;
  nextKeyHash: Uint8Array;
  salt: number;
};

export function encodeWithdrawal(w: Withdrawal): Uint8Array {
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

// Grind a salt so the verifier's hash work stays under MAX_VERIFY_STEPS
// (keeps the on-chain check inside one transaction's compute budget).
export function grindSalt(w: Omit<Withdrawal, "salt">): { salt: number; digits: number[]; tries: number } {
  for (let salt = 0; ; salt++) {
    const ds = digits(encodeWithdrawal({ ...w, salt }));
    if (verifySteps(ds) <= MAX_VERIFY_STEPS) return { salt, digits: ds, tries: salt + 1 };
  }
}

export function sign(key: KeyPair, message: Uint8Array): Uint8Array {
  const ds = digits(message);
  return concat(...ds.map((d, j) => walk(key.sk[j], j, 0, d)));
}

export type VerifyTrace = {
  ok: boolean;
  digits: number[];
  hashes: number;
  recomputed: Uint8Array;
  ms: number;
};

export function verify(sig: Uint8Array, message: Uint8Array, pkHash: Uint8Array): VerifyTrace {
  const t0 = performance.now();
  const ds = digits(message);
  const pk: Uint8Array[] = [];
  for (let j = 0; j < CHAINS; j++) {
    const part = sig.slice(j * N, (j + 1) * N);
    pk.push(walk(part, j, ds[j], W - 1 - ds[j]));
  }
  const recomputed = sha256(concat(...pk));
  return {
    ok: equal(recomputed, pkHash),
    digits: ds,
    hashes: verifySteps(ds) + 1,
    recomputed,
    ms: performance.now() - t0,
  };
}

export function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

export function hex(b: Uint8Array, n?: number): string {
  const s = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return n ? s.slice(0, n) : s;
}
