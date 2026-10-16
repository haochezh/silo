// Simulated chain layer for the preview. Every function here has the shape the
// real client will have, but resolves locally instead of sending a transaction.

import { sha256 } from "@noble/hashes/sha256";
import { PROGRAM_ID } from "./config";
import { concat } from "./wots";

const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58(bytes: Uint8Array): string {
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

export function short(a: string, n = 4): string {
  return a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}

const enc = new TextEncoder();

// Stand-in for PublicKey.findProgramAddressSync(["silo", firstKeyHash], PROGRAM_ID).
export function vaultAddress(firstKeyHash: Uint8Array): string {
  return base58(sha256(concat(enc.encode("silo"), firstKeyHash, enc.encode(PROGRAM_ID))));
}

export function fakeSignature(seed: string): string {
  return base58(concat(sha256(enc.encode(seed + "a")), sha256(enc.encode(seed + "b"))));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type TxStep = { label: string; detail: string };

// Lock flow, in the order the real client sends it.
export const LOCK_STEPS: TxStep[] = [
  { label: "open_silo", detail: "Create the vault PDA, committed to key #0's hash" },
  { label: "create_fee_sharing_config", detail: "Pump Fees: move the coin's creator vault to a sharing config" },
  { label: "update_fee_shares_v2", detail: "Set the silo as recipient. Pump revokes the admin, so this is final" },
  { label: "distribute_creator_fees_v2", detail: "Sweep pending fees into the silo (permissionless)" },
];

export const WITHDRAW_STEPS: TxStep[] = [
  { label: "authorize", detail: "Program checks the 840-byte signature and rotates to key #n+1" },
  { label: "execute_sol", detail: "Pays exactly what was signed. Anyone can submit it" },
];
