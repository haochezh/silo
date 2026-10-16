// Demo rows for a fresh database. Withdrawals are signed with real one-time keys
// derived from per-coin demo seeds, so they verify like any other.
import * as W from "./wots.mjs";

const H = 3_600_000, D = 24 * H;
const COINS = [
  ["QUBIT", "qubit", 48_300, 7_900, 312, 0.912, 100, 6 * H],
  ["WILLOW", "willow chip", 31_700, 4_200, 198, 0.447, 100, 11 * H],
  ["SHOR", "shor's cat", 14_900, 1_850, 104, 0.163, 100, 1 * D],
  ["MAGIC", "magic state", 9_600, 940, 71, 0.067, 50, 1.2 * D],
  ["HASH", "only hashes", 6_200, 410, 43, 0.021, 100, 2 * D],
];
// [ticker, sol, ago]
const RELEASES = [
  ["QUBIT", 0.05, 1 * D], ["SHOR", 0.021, 0.9 * D], ["WILLOW", 0.056, 9 * H], ["QUBIT", 0.178, 4 * H],
];

const addr = (s) => W.base58(W.sha256(new TextEncoder().encode(s)));

export function seedDemo(db, programId, solMint) {
  const now = Date.now();
  const keys = {};
  const ins = db.prepare(`INSERT INTO coins (mint,ticker,name,image,creator,vault,share,first_key_hash,lock_sig,locked_at,mcap,vol24,price,holders,in_silo,lifetime,graduated,demo,updated_at)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,?)`);
  for (const [ticker, name, mcap, vol, holders, lifetime, share, ago] of COINS) {
    const seed = W.seedFrom(`silo demo ${ticker.toLowerCase()}`);
    const k0 = W.deriveKey(seed, 0);
    const vault = W.vaultAddress(k0.pkHash, programId);
    const mint = addr(`mint ${ticker}`).slice(0, 40) + "pump";
    keys[ticker] = { seed, vault, mint, next: 0, inSilo: lifetime };
    ins.run(mint, ticker, name, null, addr(`creator ${ticker}`), vault, share, W.hex(k0.pkHash), null, now - ago, mcap, vol,
      mcap / 1e9, holders, lifetime, lifetime, now - ago);
  }

  const rel = db.prepare(`INSERT INTO releases (id,vault,mint,ticker,key_index,kind,coin_mint,amount,destination,next_key_hash,salt,sig,key_hash,program,steps,created_at)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const [ticker, sol, ago] of RELEASES) {
    const c = keys[ticker];
    const key = W.deriveKey(c.seed, c.next);
    const next = W.deriveKey(c.seed, c.next + 1);
    const base = { program: programId, vault: c.vault, keyIndex: c.next, kind: "sol", mint: solMint,
      amount: BigInt(Math.round(sol * 1e9)), destination: addr(`dest ${ticker}`), nextKeyHash: next.pkHash };
    const salt = W.grindSalt(base);
    const msg = W.encodeWithdrawal({ ...base, salt });
    const sig = W.sign(key, msg);
    const { steps } = W.verify(sig, msg, key.pkHash);
    rel.run(W.base58(W.sha256(sig)), c.vault, solMint, ticker, c.next, "sol", c.mint, String(base.amount), base.destination,
      W.hex(next.pkHash), salt, W.hex(sig), W.hex(key.pkHash), programId, steps + 1, now - ago);
    c.next++;
    c.inSilo -= sol;
  }
  for (const c of Object.values(keys)) db.prepare("UPDATE coins SET in_silo = ? WHERE vault = ?").run(Math.max(0, c.inSilo), c.vault);
}
