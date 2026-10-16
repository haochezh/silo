import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWallet } from "../wallet";
import { deriveKey, newMnemonic, seedFrom, hex } from "../lib/wots";
import { LOCK_STEPS, short, sleep, vaultAddress } from "../lib/chain";
import { api, isAddress, usd, type Lookup } from "../lib/api";
import { session } from "../lib/session";
import CoinAvatar from "../components/CoinAvatar";

const STEPS = ["Coin", "Key", "Lock"];

function Stepper({ at }: { at: number }) {
  return (
    <div className="flex items-center gap-3 text-[13px] mt-6">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-3">
          <span className={`size-5 rounded-full grid place-items-center text-[11px] ${i <= at ? "bg-ink text-black" : "border border-line2 text-mute"}`}>{i + 1}</span>
          <span className={i <= at ? "text-ink" : "text-mute"}>{s}</span>
          {i < STEPS.length - 1 && <span className="w-10 h-px bg-line2" />}
        </div>
      ))}
    </div>
  );
}

export default function Lock() {
  const { address, connect, signMessage, canSign } = useWallet();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [mint, setMint] = useState(params.get("mint") ?? "");
  const [look, setLook] = useState<Lookup | null>(null);
  const [lookErr, setLookErr] = useState("");
  const [looking, setLooking] = useState(false);
  const [share, setShare] = useState(100);
  const [words] = useState(() => newMnemonic().split(" "));
  const [wrote, setWrote] = useState(false);
  const [checks, setChecks] = useState<Record<number, string>>({});
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [progress, setProgress] = useState(-1);
  const [error, setError] = useState("");

  const ticker = look?.market?.ticker ?? look?.coin?.ticker ?? "COIN";

  useEffect(() => {
    const m = mint.trim();
    setLook(null);
    setLookErr("");
    if (!isAddress(m)) return;
    let live = true;
    setLooking(true);
    api.lookup(m)
      .then((r) => live && setLook(r))
      .catch((e) => live && setLookErr(e.message))
      .finally(() => live && setLooking(false));
    return () => {
      live = false;
    };
  }, [mint]);

  const quiz = useMemo(() => {
    const picks = new Set<number>();
    while (picks.size < 3) picks.add(Math.floor(Math.random() * 24));
    return [...picks].sort((a, b) => a - b);
  }, []);
  const quizOk = quiz.every((i) => (checks[i] ?? "").trim().toLowerCase() === words[i]);

  const key0 = useMemo(() => (step >= 2 ? deriveKey(seedFrom(words.join(" ")), 0) : null), [step, words]);
  const vault = key0 ? vaultAddress(key0.pkHash) : "";
  const canContinue = !!address && isAddress(mint) && !!look && !look.locked;

  async function lock() {
    if (!key0 || !address) return;
    setError("");
    if (!canSign) return setError("This wallet can't sign messages. Try Phantom, Solflare or Backpack.");
    const message = [
      "silo: lock creator fees",
      `coin: $${ticker} ${mint.trim()}`,
      `silo: ${vault}`,
      `share: ${share}%`,
      `key #0: ${hex(key0.pkHash)}`,
      "This split is permanent.",
    ].join("\n");
    const signature = await signMessage(message);
    if (!signature) return setError("Signature rejected in your wallet.");

    setProgress(0);
    try {
      for (let i = 0; i < LOCK_STEPS.length - 1; i++) {
        setProgress(i);
        await sleep(700 + Math.random() * 500);
      }
      setProgress(LOCK_STEPS.length - 1);
      await api.lock({ mint: mint.trim(), creator: address, vault, share, firstKeyHash: hex(key0.pkHash), message, signature, ticker, name: look?.market?.name });
      setProgress(LOCK_STEPS.length);
      session.mnemonic = words.join(" ");
      session.keyIndex = 0;
      session.locked = { ticker, mint: mint.trim(), share, unclaimed: 0, vault };
    } catch (e) {
      setProgress(-1);
      setError((e as Error).message);
    }
  }

  const done = progress === LOCK_STEPS.length;

  return (
    <div className="mx-auto max-w-xl px-4 pt-16">
      <h1 className="display text-[48px] leading-none">Lock your fees</h1>
      <p className="mt-3 text-dim">
        Route a pump.fun coin's creator fees into a silo. One signature, set by pump.fun's own fee sharing, final.
      </p>
      <Stepper at={step} />

      {step === 0 && (
        <div className="card p-6 mt-8">
          <label className="label" htmlFor="mint">Coin contract address</label>
          <input id="mint" className="input mono mt-2" placeholder="Paste your coin's CA" value={mint} onChange={(e) => setMint(e.target.value.trim())} autoFocus />
          {mint && !isAddress(mint) && <p className="label mt-2 !text-warn !normal-case !tracking-normal">That doesn't look like a Solana address.</p>}
          {looking && <p className="mt-4 text-[14px] text-mute">Looking up coin…</p>}
          {lookErr && <p className="mt-4 text-[14px] text-warn">{lookErr}</p>}

          {look && (
            <div className="mt-4 border border-line p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <CoinAvatar ticker={ticker} image={look.market?.image ?? look.coin?.image} size={36} />
                <div className="min-w-0">
                  <p className="truncate">${ticker} <span className="text-mute">{look.market?.name ?? look.coin?.name ?? "unknown coin"}</span></p>
                  <p className="mono text-[12px] text-mute">
                    {look.market ? `${usd(look.market.mcap)} mcap · ${usd(look.market.vol24)} vol` : "no market data yet"}
                  </p>
                </div>
              </div>
              {look.locked && <span className="mono text-[11px] uppercase tracking-[.06em] text-acc shrink-0">Already in a silo</span>}
            </div>
          )}

          <div className="mt-7 flex items-baseline justify-between">
            <label className="label" htmlFor="share">Fee share to the silo</label>
            <span className="display text-[34px] leading-none text-acc tabular-nums">{share}%</span>
          </div>
          <input
            id="share"
            type="range"
            min={1}
            max={100}
            value={share}
            onChange={(e) => setShare(Number(e.target.value))}
            className="range mt-3 w-full"
            style={{ ["--p" as string]: `${share}%` }}
          />
          <div className="mt-2 flex justify-between gap-2">
            {[25, 50, 75, 100].map((v) => (
              <button key={v} type="button" className="pill min-h-8 border border-line" data-on={share === v} onClick={() => setShare(v)}>{v}%</button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-px bg-line border border-line text-[13px]">
            <div className="bg-bg p-3">
              <p className="label">To the silo</p>
              <p className="mt-1 mono">{share}% of every creator fee</p>
            </div>
            <div className="bg-bg p-3">
              <p className="label">To your wallet</p>
              <p className="mt-1 mono text-ink/60">{100 - share}%{share === 100 ? " · nothing exposed" : " · still ed25519"}</p>
            </div>
          </div>

          {!address ? (
            <button onClick={connect} className="btn btn-primary w-full mt-6">Connect the creator wallet</button>
          ) : (
            <button disabled={!canContinue} onClick={() => setStep(1)} className="btn btn-primary w-full mt-6">Continue</button>
          )}
          {address && <p className="mt-3 text-center text-[12px] text-mute">Connected as <span className="mono">{short(address)}</span>. It must be the coin's creator.</p>}
        </div>
      )}

      {step === 1 && (
        <div className="card p-6 mt-8">
          <div className="flex items-center justify-between">
            <div className="label">Your 24 words · generated in this tab</div>
            <button className="label hover:text-ink" onClick={() => navigator.clipboard?.writeText(words.join(" "))}>copy</button>
          </div>
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
            {words.map((w, i) => (
              <div key={i} className="border border-line px-2.5 py-2 text-sm mono">
                <span className="text-mute mr-1.5">{i + 1}</span>{w}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-dim leading-relaxed">
            These words are the only key to the silo. There is no recovery, no support ticket, no admin. Write them on
            paper. Lose them and the fees stay sealed forever.
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={wrote} onChange={(e) => setWrote(e.target.checked)} /> I wrote them down
          </label>
          {wrote && (
            <div className="mt-5 grid grid-cols-3 gap-2">
              {quiz.map((i) => (
                <div key={i}>
                  <div className="label mb-1">word #{i + 1}</div>
                  <input className="input mono" value={checks[i] ?? ""} onChange={(e) => setChecks({ ...checks, [i]: e.target.value })} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep(0)} className="btn btn-ghost">Back</button>
            <button disabled={!quizOk} onClick={() => setStep(2)} className="btn btn-primary flex-1">Continue</button>
          </div>
        </div>
      )}

      {step === 2 && key0 && (
        <div className="card p-6 mt-8">
          <dl className="text-sm divide-y divide-line">
            {[
              ["Coin", `$${ticker}`],
              ["Contract", short(mint, 6)],
              ["Fee share", `${share}% to silo`],
              ["Silo", short(vault, 6)],
              ["Key #0 commitment", hex(key0.pkHash, 16) + "…"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5">
                <dt className="text-dim">{k}</dt>
                <dd className="mono">{v}</dd>
              </div>
            ))}
          </dl>

          {progress < 0 && (
            <>
              <div className="mt-5 border border-warn/30 bg-warn/[.06] p-4 text-sm space-y-3">
                <label className="flex gap-2">
                  <input type="checkbox" checked={ack1} onChange={(e) => setAck1(e.target.checked)} />
                  <span>I understand pump.fun locks this fee split permanently. Not even I can change it later.</span>
                </label>
                <label className="flex gap-2">
                  <input type="checkbox" checked={ack2} onChange={(e) => setAck2(e.target.checked)} />
                  <span>I understand only my 24 words can open the silo.</span>
                </label>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(1)} className="btn btn-ghost">Back</button>
                <button disabled={!ack1 || !ack2} onClick={lock} className="btn btn-primary flex-1">Sign and lock</button>
              </div>
            </>
          )}
          {error && <p className="mt-3 text-[13px] text-warn">{error}</p>}

          {progress >= 0 && (
            <ol className="mt-6 space-y-3">
              {LOCK_STEPS.map((s, i) => (
                <li key={s.label} className="flex gap-3">
                  <span className={`mt-1.5 size-2 rounded-full shrink-0 ${i < progress ? "bg-acc" : i === progress ? "bg-ink animate-pulse" : "bg-line2"}`} />
                  <div className="min-w-0 flex-1">
                    <span className="mono text-[13px]">{s.label}</span>
                    <div className="text-[13px] text-dim">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {done && (
            <div className="mt-6 pt-6 border-t border-line">
              <div className="text-lg">${ticker} is in a silo.</div>
              <p className="text-sm text-dim mt-1">It's live on the coins board now. Every future creator fee lands somewhere Shor's algorithm can't reach.</p>
              <div className="mt-5 flex gap-3">
                <Link to="/silo" className="btn btn-primary flex-1">Open your silo</Link>
                <Link to="/coins" className="btn btn-ghost">View on board</Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
