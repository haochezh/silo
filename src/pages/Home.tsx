import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { COINS, RELEASES, SOL_USD, type Coin } from "../lib/demo";
import { short } from "../lib/chain";

const usd = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;

const STRIP = [
  ["840", "byte signature"],
  ["30", "SHA-256 chains"],
  ["0", "elliptic curves"],
  ["1", "setup, forever"],
  ["~112", "bit post-quantum"],
  ["0", "admin keys"],
];

type Sort = "new" | "mcap" | "vol" | "silo";

export default function Home() {
  const [sort, setSort] = useState<Sort>("new");
  const [stage, setStage] = useState<"all" | "bonding" | "graduated">("all");
  const [q, setQ] = useState("");

  const total = COINS.reduce((s, c) => s + c.inSilo, 0);
  const lifetime = COINS.reduce((s, c) => s + c.lifetime, 0);

  const rows = useMemo(() => {
    let r = COINS.filter((c) => (stage === "all" ? true : stage === "graduated" ? c.graduated : !c.graduated));
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((c) => c.ticker.toLowerCase().includes(s) || c.name.includes(s) || c.mint.toLowerCase().includes(s));
    }
    const key: Record<Sort, (c: Coin) => number> = {
      new: (c) => -COINS.indexOf(c),
      mcap: (c) => c.mcap,
      vol: (c) => c.vol24,
      silo: (c) => c.inSilo,
    };
    return [...r].sort((a, b) => key[sort](b) - key[sort](a));
  }, [sort, stage, q]);

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* hero */}
      <section className="pt-20 pb-14 grid md:grid-cols-[1.25fr_1fr] gap-12 items-end">
        <div>
          <div className="label flex items-center gap-2 mb-6">
            <span className="dot" /> post-quantum vaults for pump.fun creator fees
          </div>
          <h1 className="text-[44px] sm:text-[64px] leading-[1.02] font-medium tracking-[-0.035em]">
            Outlive
            <br />
            the curve.
          </h1>
          <p className="mt-6 text-dim text-[17px] leading-relaxed max-w-lg">
            Point your coin's creator fees at a vault no quantum computer can open. Set once, locked forever by
            pump.fun, opened only by your 24 words. Fees can sit for years. They'll still be yours.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/lock" className="btn btn-primary">Lock your fees</Link>
            <Link to="/verify" className="btn btn-ghost">Re-run the math</Link>
          </div>
        </div>
        <div className="card p-6">
          <div className="label mb-3">the problem, in one line</div>
          <p className="text-[22px] leading-snug tracking-tight">
            On Solana, your address <span className="text-acc">is</span> your public key.
          </p>
          <p className="mt-4 text-sm text-dim leading-relaxed">
            Bitcoin hides most public keys behind a hash until coins move. Solana can't. Every wallet, including the
            one your creator fees land in, is an ed25519 key in plain sight. If the curve falls, they all open at once.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-line p-3">
              <div className="label">normal wallet</div>
              <div className="mt-1 text-warn">ed25519 · exposed</div>
            </div>
            <div className="rounded-lg border border-line p-3">
              <div className="label">silo</div>
              <div className="mt-1 text-acc">SHA-256 only</div>
            </div>
          </div>
        </div>
      </section>

      {/* strip */}
      <section className="grid grid-cols-3 md:grid-cols-6 border-y border-line">
        {STRIP.map(([n, l], i) => (
          <div key={l} className={`py-5 px-4 ${i ? "md:border-l" : ""} border-line ${i % 3 ? "border-l md:border-l" : ""}`}>
            <div className="text-xl mono">{n}</div>
            <div className="label mt-1">{l}</div>
          </div>
        ))}
      </section>

      {/* why now */}
      <section className="py-16 grid md:grid-cols-2 gap-10 items-center">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="label">Google Quantum AI · Oct 2026 · Science</div>
            <span className="label">99.99%</span>
          </div>
          <p className="mt-4 text-[19px] leading-snug">
            Magic state cultivation runs on real hardware for the first time: 40× fewer errors on the Willow chip,
            99.99% logical fidelity.
          </p>
          <div className="mt-5 pt-5 border-t border-line">
            <div className="label">earlier this year</div>
            <p className="mt-2 text-sm text-dim leading-relaxed">
              Google's estimate for breaking Bitcoin's curve dropped below 500,000 physical qubits, roughly 20× fewer
              than before. One result is the algorithm, the other is the hardware.
            </p>
          </div>
        </div>
        <div>
          <h2 className="text-[34px] leading-tight font-medium tracking-tight">
            Nobody knows the date.
            <br />
            <span className="text-mute">Your fees don't need to.</span>
          </h2>
          <p className="mt-5 text-dim leading-relaxed">
            Creator fees are the slowest money in crypto. They pile up for months, sometimes years, waiting for someone
            to claim them. That's exactly the money a future attacker gets to. A silo moves them somewhere the attack
            doesn't apply: a program-owned vault that only releases funds to a Winternitz signature over SHA-256. Shor's
            algorithm has nothing to work on.
          </p>
        </div>
      </section>

      {/* live stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 border-y border-line">
        {[
          [`${total.toFixed(3)}`, "SOL", `in silos · ${usd(total * SOL_USD)}`],
          [`${COINS.length}`, "", "coins locked"],
          [`${lifetime.toFixed(2)}`, "SOL", "fees routed, lifetime"],
          [`${RELEASES.length + 3}`, "", "signatures verified on chain →"],
        ].map(([n, u, l], i) => (
          <div key={l} className={`py-6 px-4 ${i ? "border-l" : ""} border-line`}>
            <div className="text-[26px] tracking-tight">
              {n} <span className="text-sm text-dim">{u}</span>
            </div>
            <div className="label mt-1">{l}</div>
          </div>
        ))}
      </section>

      {/* coins */}
      <section className="pt-16">
        <div className="flex items-end justify-between">
          <h2 className="text-[34px] font-medium tracking-tight">Coins in silos</h2>
          <Link to="/lock" className="btn btn-ghost">Lock a coin</Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 items-center">
          <div className="flex rounded-full border border-line p-1">
            {(["new", "mcap", "vol", "silo"] as Sort[]).map((s) => (
              <button key={s} className="pill" data-on={sort === s} onClick={() => setSort(s)}>
                {{ new: "New", mcap: "Market cap", vol: "Volume 24h", silo: "In silo" }[s]}
              </button>
            ))}
          </div>
          <div className="flex rounded-full border border-line p-1 md:ml-auto">
            {(["all", "bonding", "graduated"] as const).map((s) => (
              <button key={s} className="pill capitalize" data-on={stage === s} onClick={() => setStage(s)}>
                {s}
              </button>
            ))}
          </div>
          <input className="input !rounded-full !py-2 max-w-60" placeholder="Search name, ticker or CA" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="label text-left border-b border-line">
                <th className="py-3 font-normal">Coin</th>
                <th className="font-normal text-right">Market cap</th>
                <th className="font-normal text-right">Volume 24h</th>
                <th className="font-normal text-right">Holders</th>
                <th className="font-normal text-right">Fee share</th>
                <th className="font-normal text-right">In silo</th>
                <th className="font-normal text-right">Locked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.mint} className="border-b border-line hover:bg-white/[.02]">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full grid place-items-center text-[11px] font-semibold text-black" style={{ background: c.color }}>
                        {c.ticker.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium">${c.ticker} <span className="text-mute font-normal">{c.name}</span></div>
                        <div className="label">{short(c.mint, 4)} · {c.graduated ? "PumpSwap" : "bonding curve"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right">{usd(c.mcap)}</td>
                  <td className="text-right">{usd(c.vol24)}</td>
                  <td className="text-right">{c.holders.toLocaleString()}</td>
                  <td className="text-right mono">{c.share}%</td>
                  <td className="text-right mono text-acc">{c.inSilo.toFixed(3)} SOL</td>
                  <td className="text-right text-dim">{c.lockedAt}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7} className="py-10 text-center text-mute">No coins match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* how it works */}
      <section className="pt-20 grid md:grid-cols-3 gap-4">
        {[
          ["01", "Pick your coin", "Connect the wallet that created it on pump.fun. Any coin, on the bonding curve or graduated to PumpSwap."],
          ["02", "Write down 24 words", "Your browser makes a Winternitz key chain from them. Only a hash of key #0 goes on chain. The words never leave this tab."],
          ["03", "Lock it", "Pump.fun's fee split is set once and the admin is revoked. Every future creator fee flows into your silo. Forever."],
        ].map(([n, t, d]) => (
          <div key={n} className="card p-6">
            <div className="label">{n}</div>
            <div className="mt-6 text-lg font-medium">{t}</div>
            <p className="mt-2 text-sm text-dim leading-relaxed">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
