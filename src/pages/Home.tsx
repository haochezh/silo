import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import BgVideo from "../components/BgVideo";
import CoinAvatar from "../components/CoinAvatar";
import { ChainPlay, CountUp, CurvePlay, StepsPlay } from "../components/Interactive";
import { ago, api, usd, useApi, useLive, type Coin } from "../lib/api";
import { short } from "../lib/chain";

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`mx-auto max-w-[1280px] px-4 sm:px-6 ${className}`}>{children}</section>;
}

function Eyebrow({ n, children }: { n: string; children: string }) {
  return <p className="label flex items-center gap-3"><span className="text-ink/40">{n}</span><span className="h-px w-8 bg-line2" />{children}</p>;
}

function H2({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mt-5 max-w-3xl">
      <h2 className="display text-[40px] sm:text-[56px] leading-[1.02]">{children}</h2>
      {sub && <p className="mt-5 text-[17px] leading-relaxed text-ink/60 font-light max-w-2xl">{sub}</p>}
    </div>
  );
}

const FAQ: [string, string][] = [
  ["Can a quantum computer break Solana today?", "No. Current machines are far from the scale needed. The concern is that estimates keep falling, and creator fees can sit untouched for years. The vault should be safe for whenever that day comes."],
  ["Can I change the fee split after locking?", "No. pump.fun allows a coin's split to be configured once, then revokes the admin. That permanence is what makes the route trustworthy to holders."],
  ["What happens if I lose my 24 words?", "The silo is sealed forever. Fees keep arriving and nobody, including silo, can move them. Write the words on paper and keep two copies."],
  ["Does silo take a fee?", "Locking is free. Withdrawals cost only Solana transaction fees."],
  ["Why can't Shor's algorithm break a silo?", "Shor's algorithm finds discrete logarithms on curves like ed25519. A silo has no curve key at all: withdrawals are authorized by chains of SHA-256, where the best known quantum attack is Grover's search, leaving about 112 bits of security."],
];

export default function Home() {
  const stats = useApi(api.stats);
  const coins = useApi(api.coins);
  useLive(() => {
    stats.reload();
    coins.reload();
  });
  const top: Coin[] = (coins.data ?? []).slice(0, 5);

  return (
    <>
      {/* hero */}
      <section className="relative h-[100svh] min-h-[640px] overflow-hidden bg-bg">
        <BgVideo className="absolute inset-0 h-full w-full object-cover [filter:contrast(1.05)_saturate(1.05)]" />
        <div className="absolute inset-0 overflow-hidden"><div className="grain" /></div>
        <div className="scan hidden lg:block" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_60%_42%,transparent_20%,#0e0e0e_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#0e0e0ee6_0%,#0e0e0e99_30%,transparent_58%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#0e0e0e_0%,#0e0e0ecc_20%,transparent_55%)]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,#0e0e0e_0%,transparent_100%)]" />

        <div className="relative h-full mx-auto max-w-[1440px] px-4 sm:px-10 flex flex-col justify-end items-start text-left pb-16 sm:pb-24">
          <p className="label enter" style={delay(150)}>Post-quantum vaults for pump.fun</p>
          <h1 className="display enter mt-5 text-[56px] sm:text-[96px] leading-[0.92] max-w-[11ch]" style={delay(250)}>
            Outlive the <em className="text-acc not-italic sm:italic">curve.</em>
          </h1>
          <p className="enter mt-6 max-w-xl text-[17px] sm:text-[18px] leading-relaxed text-ink/70 font-light" style={delay(350)}>
            Lock your coin's creator fees in a vault no quantum computer can open. Set once through pump.fun, opened only by your 24 words.
          </p>
          <div className="enter mt-9 flex flex-wrap gap-2" style={delay(450)}>
            <Link to="/lock" className="btn btn-primary">Lock your fees <span aria-hidden>›</span></Link>
            <Link to="/verify" className="btn btn-ghost">Re-run the math</Link>
          </div>
          <a href="#problem" className="enter mt-12 label hover:text-ink" style={delay(650)}>Scroll ↓</a>
        </div>
      </section>

      {/* stats */}
      <Section>
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-y border-line">
          {[
            [<CountUp value={stats.data?.inSilo} decimals={3} />, "SOL in silos"],
            [<CountUp value={stats.data?.coins} />, "coins locked"],
            [<CountUp value={stats.data?.signatures} />, "signatures verified"],
            ["840", "byte signature"],
            ["30", "SHA-256 chains"],
            ["0", "elliptic curves"],
          ].map(([n, l], i) => (
            <li key={l as string} className={`py-7 px-4 ${i ? "border-l border-line" : ""} ${i === 2 ? "max-lg:border-l-0 md:border-l" : ""}`}>
              <div className="text-[30px] font-light tracking-tight tabular-nums">{n}</div>
              <div className="label mt-1">{l}</div>
            </li>
          ))}
        </ul>
      </Section>

      {/* problem */}
      <Section id="problem" className="pt-32 scroll-mt-14">
        <Eyebrow n="01">The problem</Eyebrow>
        <H2 sub="Bitcoin hides most public keys behind a hash until coins move. Solana can't. Every wallet, including the one your creator fees land in, is an ed25519 key in plain sight. If the curve falls, every wallet opens at the same moment.">
          On Solana, your address <em>is</em> your public key.
        </H2>
        <div className="mt-12 grid lg:grid-cols-[1fr_1.1fr] gap-px bg-line border border-line">
          <div className="bg-bg p-6 sm:p-8 min-h-72 sm:min-h-80 flex items-center" data-no-reveal><CurvePlay /></div>
          <div className="bg-bg overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-line">
                  {["", "Bitcoin", "Solana", "silo"].map((h) => <th key={h} className="text-left font-normal label px-5 py-4">{h}</th>)}
                </tr>
              </thead>
              <tbody className="text-ink/75">
                {[
                  ["Address", "hash of a key", "the key itself", "program address"],
                  ["Key visible", "after first spend", "always", "never: no key exists"],
                  ["Signing math", "secp256k1", "ed25519", "SHA-256 only"],
                  ["Shor's algorithm", "breaks it", "breaks it", "nothing to attack"],
                  ["Best known attack", "~polynomial (quantum)", "~polynomial (quantum)", "2¹¹² (Grover)"],
                ].map((r) => (
                  <tr key={r[0]} className="border-b border-line last:border-0">
                    <td className="px-5 py-3.5 text-mute">{r[0]}</td>
                    <td className="px-5 py-3.5">{r[1]}</td>
                    <td className="px-5 py-3.5 text-warn/90">{r[2]}</td>
                    <td className="px-5 py-3.5 text-acc">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* why now */}
      <Section className="pt-32">
        <Eyebrow n="02">Why now</Eyebrow>
        <H2 sub="Creator fees are the slowest money in crypto. They pile up for months and often sit unclaimed for years, which is exactly the money a future attacker reaches first.">
          Nobody knows the date. <span className="text-ink/40">Your fees don't need to.</span>
        </H2>
        <div className="mt-12 grid md:grid-cols-2 gap-px bg-line border border-line">
          {[
            ["Earlier in 2026", "The algorithm", "Google's estimate for breaking Bitcoin's elliptic curve dropped below 500,000 physical qubits, roughly 20× fewer than earlier estimates."],
            ["October 2026", "The hardware", "Google Quantum AI ran magic state cultivation on its Willow processor for the first time: 40× fewer errors and 99.99% logical fidelity, published in Science."],
          ].map(([when, t, d]) => (
            <article key={t} className="bg-bg p-6 sm:p-8">
              <p className="label">{when}</p>
              <h3 className="mt-8 text-[22px] font-normal">{t}</h3>
              <p className="mt-3 text-[16px] leading-relaxed text-ink/60 font-light">{d}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* how it works */}
      <Section className="pt-32">
        <Eyebrow n="03">How it works</Eyebrow>
        <H2 sub="Three steps, one of them permanent. Nothing about it needs you to come back: fees flow in on their own for as long as the coin trades.">
          Set it once. Forget it for a decade.
        </H2>
        <div className="mt-12"><StepsPlay /></div>
      </Section>

      {/* sealed */}
      <Section className="pt-32">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <Eyebrow n="04">The vault</Eyebrow>
            <H2 sub="A silo is a program address with no private key. The only way out is an 840-byte Winternitz signature over SHA-256, verified on chain before a single lamport moves.">
              No key to steal.
            </H2>
            <ol className="mt-10 space-y-5">
              {[
                ["One-time keys", "Every withdrawal signs with the current key and commits to the next. The program retires the old key in the same instruction."],
                ["Every byte signed", "Amount, destination, mint, key number and next key are all inside the signature. Change one lamport and it fails."],
                ["Permissionless", "Anyone can sweep fees in or submit a signed withdrawal. The signature is the authority, not the fee payer."],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[2.5rem_1fr] border-t border-line pt-5">
                  <span className="mono text-[13px] text-mute">4.{i + 1}</span>
                  <div>
                    <p className="text-[17px]">{t}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink/60 font-light">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="border border-line p-6 sm:p-10 h-[420px]" data-no-reveal><ChainPlay /></div>
        </div>
      </Section>

      {/* coins */}
      <Section className="pt-32">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow n="05">Live</Eyebrow>
            <H2>Coins in silos.</H2>
          </div>
          <Link to="/coins" className="btn btn-ghost">View all coins <span aria-hidden>›</span></Link>
        </div>
        <ul className="mt-10 border border-line divide-y divide-line">
          {top.map((c) => (
            <li key={c.mint} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_1fr_1fr_1fr] gap-4 items-center px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <CoinAvatar ticker={c.ticker} image={c.image} size={32} />
                <div className="min-w-0">
                  <p className="truncate">${c.ticker} <span className="text-mute">{c.name}</span></p>
                  <p className="mono text-[11px] text-mute">{short(c.mint, 4)}</p>
                </div>
              </div>
              <p className="hidden sm:block text-right tabular-nums">{usd(c.mcap)} <span className="label ml-1">mcap</span></p>
              <p className="hidden sm:block text-right mono text-[13px]">{c.share}% <span className="label ml-1">routed</span></p>
              <p className="text-right mono text-[13px] text-acc">{c.inSilo.toFixed(3)} SOL<span className="block text-[11px] text-mute font-sans">{ago(c.lockedAt)}</span></p>
            </li>
          ))}
          {coins.loading && !coins.data && <li className="px-5 py-8 text-mute">Loading…</li>}
          {!coins.loading && !top.length && <li className="px-5 py-8 text-mute">No coins locked yet. Be the first.</li>}
        </ul>
      </Section>

      {/* verify */}
      <Section className="pt-32">
        <div className="grid lg:grid-cols-2 gap-px bg-line border border-line">
          <div className="bg-bg p-6 sm:p-10">
            <Eyebrow n="06">Verify</Eyebrow>
            <H2 sub="Pick any withdrawal and your browser re-walks all 30 hash chains from the raw bytes, then checks the result against the key the silo had committed to.">
              Don't trust us. Re-run the math.
            </H2>
            <div className="mt-8 flex flex-wrap gap-2">
              <Link to="/verify" className="btn btn-primary">Open verify <span aria-hidden>›</span></Link>
              <Link to="/docs/verifying" className="btn btn-ghost">How it works</Link>
            </div>
          </div>
          <div className="bg-bg p-6 sm:p-10 overflow-x-auto">
            <p className="label">Signature scheme</p>
            <table className="mt-6 w-full text-[14px]">
              <tbody>
                {[
                  ["Scheme", "Winternitz OTS, w = 256"],
                  ["Hash", "SHA-256, truncated to 224 bits"],
                  ["Chains", "28 message + 2 checksum"],
                  ["Signature", "840 bytes"],
                  ["Verify budget", "≤ 3,600 hashes"],
                  ["Security", "~112-bit vs. Grover"],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-line last:border-0">
                    <td className="py-3 text-mute">{k}</td>
                    <td className="py-3 text-right mono text-[13px]">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* statement */}
      <Section className="pt-32">
        <div className="bg-acc text-[#0e0e0e] p-8 sm:p-14">
          <p className="display text-[36px] sm:text-[60px] leading-[1.02] max-w-4xl">“Creator fees are the slowest money in crypto. They should be the safest.”</p>
          <p className="mt-10 mono text-[12px] uppercase tracking-[.06em] opacity-70">silo · why we built it</p>
        </div>
      </Section>

      {/* faq */}
      <Section className="pt-32">
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-12">
          <div>
            <Eyebrow n="07">Questions</Eyebrow>
            <H2>Asked often.</H2>
            <Link to="/docs/faq" className="mt-8 inline-flex btn btn-ghost">All questions <span aria-hidden>›</span></Link>
          </div>
          <div className="border-t border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group border-b border-line">
                <summary className="flex justify-between items-center gap-6 py-5 cursor-pointer list-none text-[17px] hover:text-ink text-ink/90">
                  {q}
                  <span className="text-mute transition-transform group-open:rotate-45 text-[20px] leading-none" aria-hidden>+</span>
                </summary>
                <p className="pb-6 -mt-1 text-[15px] leading-relaxed text-ink/60 font-light max-w-2xl">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* cta */}
      <Section className="pt-32">
        <div className="border border-line px-6 py-16 sm:py-24 text-center">
          <h2 className="display text-[44px] sm:text-[72px] leading-none">Outlive the curve.</h2>
          <p className="mt-5 text-ink/60 font-light">One signature. Every future fee, sealed.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-2">
            <Link to="/lock" className="btn btn-primary">Lock your fees <span aria-hidden>›</span></Link>
            <Link to="/docs" className="btn btn-ghost">Read the docs</Link>
          </div>
        </div>
      </Section>
    </>
  );
}
