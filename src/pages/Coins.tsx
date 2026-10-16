import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ago, api, isAddress, usd, useApi, useLive, type Coin, type Lookup } from "../lib/api";
import { short } from "../lib/chain";
import CoinAvatar from "../components/CoinAvatar";

type Sort = "new" | "mcap" | "vol" | "silo";
const SORTS: Record<Sort, [string, (c: Coin) => number]> = {
  new: ["New", (c) => c.lockedAt],
  mcap: ["Market cap", (c) => c.mcap ?? 0],
  vol: ["Volume 24h", (c) => c.vol24 ?? 0],
  silo: ["In silo", (c) => c.inSilo],
};

export default function Coins() {
  const { data: coins, setData, error, loading, reload } = useApi(api.coins);
  const [sort, setSort] = useState<Sort>("new");
  const [q, setQ] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [look, setLook] = useState<Lookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookErr, setLookErr] = useState("");

  useLive((type, data) => {
    if (type !== "coin") return;
    if (!data) return void reload();
    const c = data as Coin;
    setData((prev) => {
      const list = prev ?? [];
      const i = list.findIndex((x) => x.mint === c.mint);
      if (i < 0) {
        setFresh(c.mint);
        return [c, ...list];
      }
      const next = list.slice();
      next[i] = c;
      return next;
    });
  });

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 4000);
    return () => clearTimeout(t);
  }, [fresh]);

  const rows = useMemo(() => {
    let r = coins ?? [];
    const s = q.trim().toLowerCase();
    if (s) r = r.filter((c) => c.ticker.toLowerCase().includes(s) || c.name.toLowerCase().includes(s) || c.mint.toLowerCase() === s || c.mint.toLowerCase().includes(s));
    const key = SORTS[sort][1];
    return [...r].sort((a, b) => key(b) - key(a));
  }, [coins, sort, q]);

  const total = (coins ?? []).reduce((s, c) => s + c.inSilo, 0);
  const query = q.trim();
  const canLookup = isAddress(query) && !rows.some((c) => c.mint === query);

  useEffect(() => {
    setLook(null);
    setLookErr("");
  }, [query]);

  async function lookup() {
    setLooking(true);
    setLookErr("");
    try {
      setLook(await api.lookup(query));
    } catch (e) {
      setLookErr((e as Error).message);
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label flex items-center gap-2"><span className="dot" /> Live</p>
          <h1 className="display mt-3 text-[44px] sm:text-[56px] leading-none">
            Coins in silos
          </h1>
          <p className="mt-3 text-ink/60">
            {(coins?.length ?? 0).toLocaleString()} coins · {total.toFixed(3)} SOL held · updates the moment a coin is locked
          </p>
        </div>
        <Link to="/lock" className="btn btn-primary">Lock your fees <span aria-hidden>›</span></Link>
      </div>

      <div className="mt-8 border border-line">
        <div className="p-4 sm:p-5 flex flex-wrap gap-4 items-center justify-between border-b border-line">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Sort">
            {(Object.keys(SORTS) as Sort[]).map((s) => (
              <button key={s} role="tab" aria-selected={sort === s} className="pill min-h-9" data-on={sort === s} onClick={() => setSort(s)}>
                {SORTS[s][0]}
              </button>
            ))}
          </div>
          <input className="input sm:max-w-80" placeholder="Search name, ticker or paste a CA" aria-label="Search coins" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {canLookup && (
          <div className="p-5 border-b border-line bg-white/[.02]">
            {!look && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[14px] text-ink/70">That address isn't in a silo yet. Look it up on chain?</p>
                <button className="btn btn-ghost" onClick={lookup} disabled={looking}>{looking ? "Looking up…" : "Look up coin"}</button>
              </div>
            )}
            {lookErr && <p className="mt-2 text-[13px] text-warn">{lookErr}</p>}
            {look && (
              look.market ? (
                <div className="flex flex-wrap items-center gap-4 justify-between">
                  <div className="flex items-center gap-3">
                    <CoinAvatar ticker={look.market.ticker} image={look.market.image} size={36} />
                    <div>
                      <p>${look.market.ticker} <span className="text-mute">{look.market.name}</span></p>
                      <p className="mono text-[12px] text-mute">{usd(look.market.mcap)} mcap · {usd(look.market.vol24)} vol · {look.market.graduated ? "PumpSwap" : "bonding curve"}</p>
                    </div>
                  </div>
                  <Link to={`/lock?mint=${look.mint}`} className="btn btn-primary">Lock this coin <span aria-hidden>›</span></Link>
                </div>
              ) : (
                <p className="text-[14px] text-ink/70">No market found for that address yet. If it's a brand-new coin, try again in a minute.</p>
              )
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[14px] min-w-[760px]">
            <thead>
              <tr className="label text-left border-b border-line">
                <th className="py-3 pl-5 font-normal">Coin</th>
                <th className="font-normal text-right">Market cap</th>
                <th className="font-normal text-right">Volume 24h</th>
                <th className="font-normal text-right">Fee share</th>
                <th className="font-normal text-right">In silo</th>
                <th className="font-normal text-right">Lifetime</th>
                <th className="font-normal text-right pr-5">Locked</th>
              </tr>
            </thead>
            <tbody>
              {loading && !coins && Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-line"><td colSpan={7} className="py-4 pl-5"><div className="h-4 w-1/3 bg-white/[.05] animate-pulse" /></td></tr>
              ))}
              {rows.map((c) => (
                <tr key={c.mint} className={`border-b border-line last:border-b-0 transition-colors ${fresh === c.mint ? "bg-acc/10" : "hover:bg-white/[.02]"}`}>
                  <td className="py-3.5 pl-5">
                    <div className="flex items-center gap-3">
                      <CoinAvatar ticker={c.ticker} image={c.image} />
                      <div className="min-w-0">
                        <div className="truncate">${c.ticker} <span className="text-mute">{c.name}</span></div>
                        <div className="mono text-[11px] text-mute">{short(c.mint, 4)} · {c.graduated ? "PumpSwap" : "curve"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{usd(c.mcap)}</td>
                  <td className="text-right tabular-nums">{usd(c.vol24)}</td>
                  <td className="text-right mono text-[13px]">{c.share}%</td>
                  <td className="text-right mono text-[13px] text-acc">{c.inSilo.toFixed(3)} SOL</td>
                  <td className="text-right mono text-[13px] text-ink/60">{c.lifetime.toFixed(3)}</td>
                  <td className="text-right pr-5 text-mute">{ago(c.lockedAt)}</td>
                </tr>
              ))}
              {!loading && !rows.length && (
                <tr><td colSpan={7} className="py-12 text-center text-mute">{error ? `Couldn't reach the server: ${error}` : q ? "No coins match." : "No coins locked yet."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
