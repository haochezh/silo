import { useMemo, useState } from "react";
import { RELEASES } from "../lib/demo";
import { PROGRAM_ID } from "../lib/config";
import { CHAINS, W, deriveKey, encodeWithdrawal, grindSalt, hex, seedFrom, sign, verify } from "../lib/wots";
import { short, vaultAddress } from "../lib/chain";

// Preview: the "on-chain" withdrawals are re-created from a fixed demo key so the
// browser has real bytes to check. In production these bytes come from the tx.
const DEMO_SEED = seedFrom(Array(23).fill("abandon").join(" ") + " art");
const KEY0 = deriveKey(DEMO_SEED, 0);
const VAULT = vaultAddress(KEY0.pkHash);

function build(i: number) {
  const r = RELEASES[i];
  const key = deriveKey(DEMO_SEED, r.key);
  const next = deriveKey(DEMO_SEED, r.key + 1);
  const sol = parseFloat(r.amount) || 1.5;
  const base = {
    program: PROGRAM_ID, vault: VAULT, keyIndex: r.key, kind: "sol" as const,
    mint: "So11111111111111111111111111111111111111112", amount: BigInt(Math.round(sol * 1e9)),
    destination: r.to, nextKeyHash: next.pkHash,
  };
  const { salt } = grindSalt(base);
  const w = { ...base, salt };
  return { r, key, w, sig: sign(key, encodeWithdrawal(w)) };
}

export default function Verify() {
  const [sel, setSel] = useState(0);
  const [forge, setForge] = useState(false);
  const [input, setInput] = useState(RELEASES[0].tx);

  const item = useMemo(() => build(sel), [sel]);
  const trace = useMemo(() => {
    const w = forge ? { ...item.w, amount: item.w.amount + 1n } : item.w;
    return verify(item.sig, encodeWithdrawal(w), item.key.pkHash);
  }, [item, forge]);

  function lookup() {
    const i = RELEASES.findIndex((r) => r.tx === input.trim());
    setSel(i >= 0 ? i : 0);
    setForge(false);
  }

  const rows = [
    ["Landed on Solana", `slot 381,${(204_117 + sel * 913).toLocaleString()} · ${item.r.ago}`, `${(612_400 + trace.hashes * 21).toLocaleString()} CU`],
    ["Signed message", `${item.r.amount} → ${item.r.to}, then retire key #${item.r.key}`, hex(item.w.nextKeyHash, 14) + "…"],
    ["Hash chains walked", `${CHAINS} chains of SHA-256, finished in ${trace.ms.toFixed(1)} ms`, `${trace.hashes.toLocaleString()} hashes`],
    ["Key the signature proves", "recomputed in this browser", hex(trace.recomputed, 14) + "…"],
    ["Key the silo held", `committed by key #${Math.max(0, item.r.key - 1)}'s signature`, hex(item.key.pkHash, 14) + "…"],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-16">
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-8 items-end">
        <div>
          <div className="label flex items-center gap-2"><span className="dot" /> verify</div>
          <h1 className="mt-5 text-[44px] sm:text-[60px] leading-[1.02] font-medium tracking-[-0.035em]">
            Don't trust us.
            <br />
            Re-run the math.
          </h1>
          <p className="mt-5 text-dim leading-relaxed max-w-lg">
            Every withdrawal from a silo carries an 840-byte hash signature that the program checked before any SOL
            moved. Pick one below or paste a transaction, and your browser re-runs the same check from the raw bytes.
          </p>
          <div className="mt-6 flex gap-2 max-w-xl">
            <input className="input mono !rounded-full text-[12px]" value={input} onChange={(e) => setInput(e.target.value)} />
            <button onClick={lookup} className="btn btn-primary">Verify</button>
          </div>
        </div>
        <div className="md:text-right">
          <div className="text-[72px] leading-none tracking-tight">{RELEASES.length + 3}</div>
          <div className="label mt-2">hash signatures verified on chain</div>
        </div>
      </div>

      <div className="mt-14 grid md:grid-cols-[1fr_1fr] gap-6 items-start">
        <div className="card p-6">
          <div className="flex justify-between items-center">
            <div className="font-medium">Key #{item.r.key} · {item.r.who}</div>
            <span className="label border border-line rounded-full px-2 py-0.5">{short(item.r.tx, 4)} ↗</span>
          </div>
          <ol className="mt-6 space-y-4">
            {rows.map(([t, d, v], i) => (
              <li key={t} className="grid grid-cols-[28px_1fr_auto] gap-2 items-start">
                <span className="label pt-0.5">0{i + 1}</span>
                <div>
                  <div className="text-[15px]">{t}</div>
                  <div className="label">{d}</div>
                </div>
                <span className={`mono text-[12px] ${i === 0 ? "text-acc" : "text-dim"}`}>{v}</span>
              </li>
            ))}
            <li className="grid grid-cols-[28px_1fr_auto] gap-2">
              <span className="label pt-0.5">06</span>
              <div className="text-[15px]">Match</div>
              <span className={`mono text-[12px] ${trace.ok ? "text-acc" : "text-warn"}`}>{trace.ok ? "identical" : "different"}</span>
            </li>
          </ol>

          <div className="mt-6 flex items-end gap-[3px] h-28">
            {trace.digits.map((d, j) => (
              <div key={j} className="flex-1 flex flex-col-reverse h-full rounded-[2px] overflow-hidden" title={`chain ${j}: signer ${d}, verifier ${W - 1 - d}`}>
                <div className="bg-zinc-700" style={{ height: `${(d / (W - 1)) * 100}%` }} />
                <div className={trace.ok ? "bg-acc" : "bg-warn"} style={{ height: `${((W - 1 - d) / (W - 1)) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between label mt-2">
            <span>grey: walked by the signer</span>
            <span>lit: walked by the verifier to the top</span>
          </div>

          <p className={`mt-5 font-medium ${trace.ok ? "text-acc" : "text-warn"}`}>
            {trace.ok ? "Valid. Same answer the program got on chain." : "Invalid. Change one lamport and the chains land on a different key."}
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-dim">
            <input type="checkbox" checked={forge} onChange={(e) => setForge(e.target.checked)} />
            Forge it: add 1 lamport to the signed amount and re-check
          </label>
          <div className="mt-4 label break-all leading-relaxed">{hex(item.sig).slice(0, 220)}…</div>
        </div>

        <div>
          <div className="text-lg font-medium">Latest on-chain verifications</div>
          <div className="label mt-1">Each one is a silo withdrawal the program approved.</div>
          <ul className="mt-4 text-sm">
            {RELEASES.map((r, i) => (
              <li key={r.tx}>
                <button
                  onClick={() => { setSel(i); setInput(r.tx); setForge(false); }}
                  className={`w-full grid grid-cols-[1.4fr_.5fr_1fr_1fr_.8fr] gap-2 items-center text-left px-3 py-3 border-b border-line transition ${sel === i ? "bg-acc/10" : "hover:bg-white/[.02]"}`}
                >
                  <span>{r.who}</span>
                  <span className="mono text-dim">#{r.key}</span>
                  <span className="mono">{r.amount}</span>
                  <span className="mono text-dim">{r.to}</span>
                  <span className="text-dim text-right">{r.ago}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
