import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { session } from "../lib/session";
import { PROGRAM_ID } from "../lib/config";
import { SIG_BYTES, deriveKey, encodeWithdrawal, grindSalt, hex, isMnemonic, seedFrom, sign, verify, type Withdrawal } from "../lib/wots";
import { WITHDRAW_STEPS, short, sleep, vaultAddress } from "../lib/chain";
import { ago, api, isAddress, useLive, type Coin, type Release } from "../lib/api";
import CoinAvatar from "../components/CoinAvatar";
import VaultExplainer from "../components/VaultExplainer";

const SOL_MINT = "So11111111111111111111111111111111111111112";
type Signed = { w: Withdrawal; sig: Uint8Array; keyHash: Uint8Array; tries: number; hashes: number; ms: number; ok: boolean };

export default function Vault() {
  const [words, setWords] = useState(session.mnemonic ?? "");
  const [open, setOpen] = useState(!!session.mnemonic);
  const [coin, setCoin] = useState<Coin | null | undefined>(undefined);
  const [history, setHistory] = useState<Release[]>([]);
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
  const [signed, setSigned] = useState<Signed | null>(null);
  const [progress, setProgress] = useState(-1);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Release | null>(null);

  const seed = useMemo(() => (open ? seedFrom(words) : null), [open, words]);
  const key0 = useMemo(() => (seed ? deriveKey(seed, 0) : null), [seed]);
  const vault = key0 ? vaultAddress(key0.pkHash) : "";
  const keyIndex = history.length ? Math.max(...history.map((h) => h.keyIndex)) + 1 : 0;
  const balance = coin?.inSilo ?? 0;

  async function load() {
    if (!vault) return;
    try {
      const [c, r] = await Promise.all([api.coinByVault(vault), api.releases({ vault, limit: 100 })]);
      setCoin(c);
      setHistory(r);
    } catch (e) {
      setCoin(null);
      setError((e as Error).message);
    }
  }
  useEffect(() => void load(), [vault]); // eslint-disable-line react-hooks/exhaustive-deps
  useLive((type, data) => {
    const d = data as { vault?: string } | null;
    if (!d || d.vault === vault) load();
  });

  const lamports = BigInt(Math.round((parseFloat(amount) || 0) * 1e9));
  const canSign = lamports > 0n && Number(lamports) / 1e9 <= balance + 1e-9 && isAddress(dest);

  function doSign() {
    if (!seed) return;
    setError("");
    setResult(null);
    const key = deriveKey(seed, keyIndex);
    const next = deriveKey(seed, keyIndex + 1);
    const base = { program: PROGRAM_ID, vault, keyIndex, kind: "sol" as const, mint: SOL_MINT, amount: lamports, destination: dest, nextKeyHash: next.pkHash };
    const { salt, tries } = grindSalt(base);
    const w = { ...base, salt };
    const msg = encodeWithdrawal(w);
    const sig = sign(key, msg);
    const t = verify(sig, msg, key.pkHash);
    setSigned({ w, sig, keyHash: key.pkHash, tries, hashes: t.hashes, ms: t.ms, ok: t.ok });
    setProgress(-1);
  }

  async function submit() {
    if (!signed) return;
    setError("");
    try {
      setProgress(0);
      await sleep(600);
      const r = await api.withdraw({
        vault, keyIndex: signed.w.keyIndex, amount: signed.w.amount.toString(), destination: signed.w.destination,
        nextKeyHash: hex(signed.w.nextKeyHash), salt: signed.w.salt, sig: hex(signed.sig), keyHash: hex(signed.keyHash),
      });
      setProgress(1);
      await sleep(600);
      setProgress(WITHDRAW_STEPS.length);
      setResult(r);
      session.keyIndex = r.keyIndex + 1;
      await load();
    } catch (e) {
      setProgress(-1);
      setError((e as Error).message);
    }
  }

  function reset() {
    setSigned(null);
    setProgress(-1);
    setAmount("");
    setResult(null);
  }

  if (!open) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-16">
        <div className="max-w-xl">
        <h1 className="display text-[48px] leading-none">Your silo</h1>
        <p className="mt-3 text-dim">Enter your 24 words. They stay in this tab: the key is derived and used locally.</p>
        <div className="card p-6 mt-8">
          <textarea className="input mono min-h-32 resize-none" placeholder="word1 word2 word3 …" value={words} onChange={(e) => setWords(e.target.value)} aria-label="24 words" />
          {words && !isMnemonic(words) && <p className="mt-2 text-[13px] text-warn">Not a valid 24-word phrase yet.</p>}
          <button disabled={!isMnemonic(words)} onClick={() => setOpen(true)} className="btn btn-primary w-full mt-4">Open silo</button>
          <p className="mt-4 text-center text-[13px] text-mute">
            No silo yet? <Link to="/lock" className="underline hover:text-ink">Lock a coin's fees</Link>
          </p>
        </div>
        </div>
        <VaultExplainer />
      </div>
    );
  }

  if (coin === undefined) return <div className="mx-auto max-w-xl px-4 pt-16 text-mute">Opening silo…</div>;

  if (coin === null) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-16">
        <h1 className="display text-[48px] leading-none">No silo found</h1>
        <p className="mt-3 text-dim">
          These words derive the silo <span className="mono text-ink">{short(vault, 6)}</span>, but no coin has been locked to it.
          Check the words, or lock a coin first.
        </p>
        {error && <p className="mt-3 text-[13px] text-warn">{error}</p>}
        <div className="mt-6 flex gap-2">
          <button className="btn btn-ghost" onClick={() => { setOpen(false); setCoin(undefined); }}>Try other words</button>
          <Link to="/lock" className="btn btn-primary">Lock a coin</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <CoinAvatar ticker={coin.ticker} image={coin.image} size={44} />
          <div>
            <div className="label">${coin.ticker} creator silo</div>
            <h1 className="mt-1 text-[32px] mono tracking-tight">{short(vault, 6)}</h1>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => { setOpen(false); setWords(""); setCoin(undefined); session.mnemonic = null; }}>Close silo</button>
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 border-y border-line">
        {[
          [balance.toFixed(4), "SOL", "in silo"],
          [`#${keyIndex}`, "", "current one-time key"],
          [`${coin.share}%`, "", "of creator fees routed"],
          [coin.lifetime.toFixed(3), "SOL", "routed, lifetime"],
        ].map(([n, u, l], i) => (
          <div key={l} className={`py-5 px-4 ${i ? "border-l" : ""} border-line`}>
            <div className="text-[24px] tracking-tight tabular-nums">{n} <span className="text-sm text-dim">{u}</span></div>
            <div className="label mt-1">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="text-lg">Withdraw</div>
          <p className="text-sm text-dim mt-1">Signed in your browser with key #{keyIndex}. The server checks it exactly as the program does, then the silo rotates to key #{keyIndex + 1}.</p>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex justify-between label mb-1.5">
                <span>Amount (SOL)</span>
                <button className="hover:text-ink" onClick={() => setAmount(balance.toFixed(4))}>max</button>
              </div>
              <input className="input mono" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setSigned(null); }} placeholder="0.0" />
            </div>
            <div>
              <div className="label mb-1.5">Destination</div>
              <input className="input mono" value={dest} onChange={(e) => { setDest(e.target.value.trim()); setSigned(null); }} placeholder="Any Solana address" />
            </div>
            {!signed && <button disabled={!canSign} onClick={doSign} className="btn btn-primary w-full">Sign with 24 words</button>}
          </div>

          {signed && (
            <div className="mt-5 space-y-4">
              <dl className="text-[13px] divide-y divide-line border border-line px-4">
                {[
                  ["Signature", `${SIG_BYTES} bytes · ${hex(signed.sig, 12)}…`],
                  ["Salt ground", `${signed.w.salt} (${signed.tries} tries)`],
                  ["Verifier work", `${signed.hashes.toLocaleString()} SHA-256`],
                  ["Local check", signed.ok ? `valid · ${signed.ms.toFixed(1)} ms` : "INVALID"],
                  ["Next key", hex(signed.w.nextKeyHash, 12) + "…"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2">
                    <dt className="text-dim">{k}</dt>
                    <dd className={`mono ${k === "Local check" ? "text-acc" : ""}`}>{v}</dd>
                  </div>
                ))}
              </dl>
              {progress < 0 && <button onClick={submit} className="btn btn-primary w-full">Submit withdrawal</button>}
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
              {result && (
                <div className="flex gap-2">
                  <Link to={`/verify?id=${result.id}`} className="btn btn-primary flex-1">Verify this withdrawal</Link>
                  <button onClick={reset} className="btn btn-ghost">New</button>
                </div>
              )}
            </div>
          )}
          {error && <p className="mt-3 text-[13px] text-warn">{error}</p>}
        </div>

        <div className="card p-6">
          <div className="text-lg">Activity</div>
          <ul className="mt-4 text-sm divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="py-3 flex justify-between gap-3">
                <Link to={`/verify?id=${h.id}`} className="hover:text-acc">Withdraw · key #{h.keyIndex}</Link>
                <span className="mono text-right">{(Number(h.amount) / 1e9).toFixed(4)} SOL → {short(h.destination)}<br /><span className="text-mute">{ago(h.createdAt)}</span></span>
              </li>
            ))}
            <li className="py-3 flex justify-between text-dim">
              <span>Silo opened · key #0 committed</span>
              <span className="mono">{ago(coin.lockedAt)}</span>
            </li>
          </ul>
          <p className="mt-6 text-[12px] text-mute leading-relaxed">
            Fees arrive on their own: anyone can call pump.fun's distribute instruction, so the silo fills even if you never
            come back. Withdraw in a year, or in ten.
          </p>
        </div>
      </div>
      <VaultExplainer />
    </div>
  );
}
