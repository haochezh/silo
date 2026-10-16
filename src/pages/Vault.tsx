import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { session } from "../lib/session";
import { PROGRAM_ID } from "../lib/config";
import { SOL_USD } from "../lib/demo";
import {
  SIG_BYTES, deriveKey, encodeWithdrawal, grindSalt, hex, isMnemonic, seedFrom, sign, verify, type Withdrawal,
} from "../lib/wots";
import { WITHDRAW_STEPS, fakeSignature, short, sleep, vaultAddress } from "../lib/chain";

type Signed = { w: Withdrawal; sig: Uint8Array; tries: number; hashes: number; ms: number; ok: boolean };

export default function Vault() {
  const [words, setWords] = useState(session.mnemonic ?? "");
  const [open, setOpen] = useState(!!session.mnemonic);
  const [keyIndex, setKeyIndex] = useState(session.keyIndex);
  const [balance, setBalance] = useState(() => (session.locked?.unclaimed ?? 0.084) + 0.0041);
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
  const [signed, setSigned] = useState<Signed | null>(null);
  const [progress, setProgress] = useState(-1);
  const [history, setHistory] = useState<{ key: number; amount: string; to: string; tx: string }[]>([]);

  const seed = useMemo(() => (open ? seedFrom(words) : null), [open, words]);
  const key0 = useMemo(() => (seed ? deriveKey(seed, 0) : null), [seed]);
  const vault = key0 ? vaultAddress(key0.pkHash) : "";
  const ticker = session.locked?.ticker ?? "BUNKR";

  const lamports = BigInt(Math.round((parseFloat(amount) || 0) * 1e9));
  const canSign = lamports > 0n && lamports <= BigInt(Math.round(balance * 1e9)) && dest.length >= 32;

  function doSign() {
    if (!seed) return;
    const key = deriveKey(seed, keyIndex);
    const next = deriveKey(seed, keyIndex + 1);
    const base = {
      program: PROGRAM_ID, vault, keyIndex, kind: "sol" as const, mint: "So11111111111111111111111111111111111111112",
      amount: lamports, destination: dest, nextKeyHash: next.pkHash,
    };
    const { salt, tries } = grindSalt(base);
    const w = { ...base, salt };
    const msg = encodeWithdrawal(w);
    const sig = sign(key, msg);
    const t = verify(sig, msg, key.pkHash);
    setSigned({ w, sig, tries, hashes: t.hashes, ms: t.ms, ok: t.ok });
    setProgress(-1);
  }

  async function submit() {
    if (!signed) return;
    for (let i = 0; i < WITHDRAW_STEPS.length; i++) {
      setProgress(i);
      await sleep(1000 + Math.random() * 600);
    }
    setProgress(WITHDRAW_STEPS.length);
    const sol = Number(signed.w.amount) / 1e9;
    setBalance((b) => Math.max(0, b - sol));
    setHistory((h) => [{ key: keyIndex, amount: `${sol} SOL`, to: short(dest), tx: fakeSignature(hex(signed.sig, 32)) }, ...h]);
    setKeyIndex((k) => k + 1);
    session.keyIndex = keyIndex + 1;
  }

  function reset() {
    setSigned(null);
    setProgress(-1);
    setAmount("");
  }

  if (!open) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-16">
        <h1 className="text-[40px] font-medium tracking-[-0.03em]">Your silo</h1>
        <p className="mt-2 text-dim">Enter your 24 words. They stay in this tab: the key is derived and used locally.</p>
        <div className="card p-6 mt-8">
          <textarea
            className="input mono min-h-32 resize-none"
            placeholder="word1 word2 word3 …"
            value={words}
            onChange={(e) => setWords(e.target.value)}
          />
          {words && !isMnemonic(words) && <p className="label mt-2 !text-warn">Not a valid 24-word phrase yet.</p>}
          <button disabled={!isMnemonic(words)} onClick={() => setOpen(true)} className="btn btn-primary w-full mt-4">Open silo</button>
          <p className="label mt-4 text-center">
            No silo yet? <Link to="/lock" className="underline hover:text-ink">Lock a coin's fees</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label">${ticker} creator silo</div>
          <h1 className="mt-2 text-[40px] font-medium tracking-[-0.03em] mono">{short(vault, 6)}</h1>
        </div>
        <button className="btn btn-ghost" onClick={() => { setOpen(false); setWords(""); session.mnemonic = null; }}>Close silo</button>
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 border-y border-line">
        {[
          [`${balance.toFixed(4)}`, "SOL", `$${(balance * SOL_USD).toFixed(2)}`],
          [`#${keyIndex}`, "", "current one-time key"],
          [`${session.locked?.share ?? 100}%`, "", "of creator fees routed"],
          ["0", "", "elliptic curves in the path"],
        ].map(([n, u, l], i) => (
          <div key={l} className={`py-5 px-4 ${i ? "border-l" : ""} border-line`}>
            <div className="text-[24px] tracking-tight">{n} <span className="text-sm text-dim">{u}</span></div>
            <div className="label mt-1">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid md:grid-cols-[1fr_1fr] gap-6">
        <div className="card p-6">
          <div className="text-lg font-medium">Withdraw</div>
          <p className="text-sm text-dim mt-1">Signed in your browser with key #{keyIndex}. The program checks it, pays, and rotates to key #{keyIndex + 1}.</p>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex justify-between label mb-1.5">
                <span>amount (SOL)</span>
                <button className="hover:text-ink" onClick={() => setAmount(balance.toFixed(4))}>max</button>
              </div>
              <input className="input mono" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setSigned(null); }} placeholder="0.0" />
            </div>
            <div>
              <div className="label mb-1.5">destination</div>
              <input className="input mono" value={dest} onChange={(e) => { setDest(e.target.value.trim()); setSigned(null); }} placeholder="Any Solana address" />
            </div>
            {!signed && <button disabled={!canSign} onClick={doSign} className="btn btn-primary w-full">Sign with 24 words</button>}
          </div>

          {signed && (
            <div className="mt-5 space-y-4">
              <dl className="text-[13px] divide-y divide-line rounded-xl border border-line px-4">
                {[
                  ["signature", `${SIG_BYTES} bytes · ${hex(signed.sig, 12)}…`],
                  ["salt ground", `${signed.w.salt} (${signed.tries} tries)`],
                  ["verifier work", `${signed.hashes.toLocaleString()} SHA-256`],
                  ["local check", signed.ok ? `valid · ${signed.ms.toFixed(1)} ms` : "INVALID"],
                  ["next key", hex(signed.w.nextKeyHash, 12) + "…"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2">
                    <dt className="text-dim">{k}</dt>
                    <dd className={`mono ${k === "local check" ? "text-acc" : ""}`}>{v}</dd>
                  </div>
                ))}
              </dl>
              {progress < 0 && <button onClick={submit} className="btn btn-primary w-full">Submit to Solana</button>}
              {progress >= 0 && (
                <ol className="space-y-2.5">
                  {WITHDRAW_STEPS.map((s, i) => (
                    <li key={s.label} className="flex gap-3">
                      <span className={`mt-1.5 size-2 rounded-full shrink-0 ${i < progress ? "bg-acc" : i === progress ? "bg-ink animate-pulse" : "bg-line2"}`} />
                      <div>
                        <div className="mono text-[13px]">{s.label}</div>
                        <div className="text-[13px] text-dim">{s.detail}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {progress === WITHDRAW_STEPS.length && (
                <button onClick={reset} className="btn btn-ghost w-full">Done · new withdrawal</button>
              )}
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="text-lg font-medium">Activity</div>
          <ul className="mt-4 text-sm divide-y divide-line">
            {history.map((h) => (
              <li key={h.tx} className="py-3 flex justify-between">
                <span>Withdraw · key #{h.key}</span>
                <span className="mono">{h.amount} → {h.to}</span>
              </li>
            ))}
            <li className="py-3 flex justify-between text-dim">
              <span>Fees in · distribute_creator_fees_v2</span>
              <span className="mono">+0.0041 SOL</span>
            </li>
            <li className="py-3 flex justify-between text-dim">
              <span>Silo opened · key #0 committed</span>
              <span className="mono">{key0 ? hex(key0.pkHash, 10) : ""}…</span>
            </li>
          </ul>
          <p className="label mt-6 leading-relaxed">
            Fees arrive on their own: anyone can call pump.fun's distribute instruction, so the silo fills even if you
            never come back. Withdraw in a year, or in ten.
          </p>
        </div>
      </div>
    </div>
  );
}
