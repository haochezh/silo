import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../wallet";
import { MY_COINS } from "../lib/demo";
import { deriveKey, newMnemonic, seedFrom, hex } from "../lib/wots";
import { LOCK_STEPS, fakeSignature, short, sleep, vaultAddress } from "../lib/chain";
import { session } from "../lib/session";

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
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [mint, setMint] = useState<string>("");
  const [share, setShare] = useState(100);
  const [words] = useState(() => newMnemonic().split(" "));
  const [wrote, setWrote] = useState(false);
  const [checks, setChecks] = useState<Record<number, string>>({});
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [progress, setProgress] = useState(-1);
  const [sigs, setSigs] = useState<string[]>([]);

  const coin = MY_COINS.find((c) => c.mint === mint);
  const quiz = useMemo(() => {
    const picks = new Set<number>();
    while (picks.size < 3) picks.add(Math.floor(Math.random() * 24));
    return [...picks].sort((a, b) => a - b);
  }, []);
  const quizOk = quiz.every((i) => (checks[i] ?? "").trim().toLowerCase() === words[i]);

  const key0 = useMemo(() => (step >= 2 ? deriveKey(seedFrom(words.join(" ")), 0) : null), [step, words]);
  const vault = key0 ? vaultAddress(key0.pkHash) : "";

  async function lock() {
    setError("");
    const signature = await signMessage(
      [
        "silo: lock creator fees",
        `coin: $${coin?.ticker} ${mint}`,
        `silo: ${vault}`,
        `share: ${share}%`,
        `key #0: ${key0 ? hex(key0.pkHash) : ""}`,
        "This split is permanent.",
      ].join("\n"),
    );
    if (!signature && canSign) {
      setError("Signature rejected in your wallet.");
      return;
    }
    for (let i = 0; i < LOCK_STEPS.length; i++) {
      setProgress(i);
      await sleep(900 + Math.random() * 700);
      setSigs((s) => [...s, fakeSignature(vault + i)]);
    }
    setProgress(LOCK_STEPS.length);
    session.mnemonic = words.join(" ");
    session.keyIndex = 0;
    session.locked = { ticker: coin?.ticker ?? "COIN", mint, share, unclaimed: coin?.unclaimed ?? 0, vault };
  }

  const done = progress === LOCK_STEPS.length;

  return (
    <div className="mx-auto max-w-xl px-4 pt-16">
      <h1 className="text-[40px] font-medium tracking-[-0.03em]">Lock your fees</h1>
      <p className="mt-2 text-dim">
        Route a pump.fun coin's creator fees into a silo. One transaction, set by pump.fun's own fee sharing, final.
      </p>
      <Stepper at={step} />

      {step === 0 && (
        <div className="card p-6 mt-8">
          {!address ? (
            <div className="text-center py-6">
              <p className="text-dim">Connect the wallet that created the coin.</p>
              <button onClick={connect} className="btn btn-primary mt-5">Connect wallet</button>
            </div>
          ) : (
            <>
              <div className="label mb-3">your pump.fun coins</div>
              <div className="space-y-2">
                {MY_COINS.map((c) => (
                  <button
                    key={c.mint}
                    onClick={() => setMint(c.mint)}
                    className={`w-full flex items-center justify-between rounded-xl border p-4 text-left transition ${mint === c.mint ? "border-ink bg-white/[.03]" : "border-line hover:border-line2"}`}
                  >
                    <div>
                      <div className="font-medium">${c.ticker} <span className="text-mute font-normal">{c.name}</span></div>
                      <div className="label mt-0.5">{short(c.mint, 5)} · {c.graduated ? "PumpSwap" : "bonding curve"}</div>
                    </div>
                    <div className="text-right">
                      <div className="mono text-sm">{c.unclaimed.toFixed(3)} SOL</div>
                      <div className="label">unclaimed</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="label mt-6 mb-2">fee share to the silo</div>
              <div className="flex rounded-full border border-line p-1 w-fit">
                {[100, 80, 50].map((s) => (
                  <button key={s} className="pill" data-on={share === s} onClick={() => setShare(s)}>{s}%</button>
                ))}
              </div>
              <p className="label mt-2">
                {share === 100 ? "Every creator fee goes to the silo." : `${100 - share}% keeps flowing to your wallet.`}
              </p>
              <button disabled={!mint} onClick={() => setStep(1)} className="btn btn-primary w-full mt-6">Continue</button>
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="card p-6 mt-8">
          <div className="flex items-center justify-between">
            <div className="label">your 24 words · generated in this tab</div>
            <button className="label hover:text-ink" onClick={() => navigator.clipboard?.writeText(words.join(" "))}>copy</button>
          </div>
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
            {words.map((w, i) => (
              <div key={i} className="rounded-lg border border-line px-2.5 py-2 text-sm mono">
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
              ["Coin", `$${coin?.ticker}`],
              ["Fee share", `${share}% to silo`],
              ["Silo", short(vault, 6)],
              ["Key #0 commitment", hex(key0.pkHash, 16) + "…"],
              ["Pending fees swept in", `${coin?.unclaimed.toFixed(3)} SOL`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5">
                <dt className="text-dim">{k}</dt>
                <dd className="mono">{v}</dd>
              </div>
            ))}
          </dl>

          {progress < 0 && (
            <>
              <div className="mt-5 rounded-xl border border-warn/30 bg-warn/[.06] p-4 text-sm space-y-3">
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
                <button disabled={!ack1 || !ack2} onClick={lock} className="btn btn-primary flex-1">Lock fees forever</button>
              </div>
              {error && <p className="label mt-3 !text-warn">{error}</p>}
            </>
          )}

          {progress >= 0 && (
            <ol className="mt-6 space-y-3">
              {LOCK_STEPS.map((s, i) => (
                <li key={s.label} className="flex gap-3">
                  <span className={`mt-1 size-2 rounded-full shrink-0 ${i < progress ? "bg-acc" : i === progress ? "bg-ink animate-pulse" : "bg-line2"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <span className="mono text-[13px]">{s.label}</span>
                      {sigs[i] && <span className="label">{short(sigs[i], 5)} ↗</span>}
                    </div>
                    <div className="text-[13px] text-dim">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {done && (
            <div className="mt-6 pt-6 border-t border-line">
              <div className="text-lg">${coin?.ticker} is in a silo.</div>
              <p className="text-sm text-dim mt-1">Every future creator fee lands somewhere Shor's algorithm can't reach.</p>
              <div className="mt-5 flex gap-3">
                <Link to="/silo" className="btn btn-primary flex-1">Open your silo</Link>
                <a className="btn btn-ghost" href={`https://x.com/intent/post?text=${encodeURIComponent(`$${coin?.ticker} creator fees are now in a post-quantum silo. Locked forever, opened by hash signatures only.\n\nsilo.fund via @silodotfund`)}`} target="_blank" rel="noreferrer">Share</a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
