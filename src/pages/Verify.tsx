import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CHAINS, MAX_VERIFY_STEPS, N, SIG_BYTES, W, digits, encodeWithdrawal, hex, walk } from "../lib/wots";
import { sha256 } from "@noble/hashes/sha256";
import { ago, api, useApi, useLive, type Release } from "../lib/api";
import { short } from "../lib/chain";
import VerifyExplainer from "../components/VerifyExplainer";

// Two seeded withdrawals that exist on every deployment (deterministic demo keys).
const EXAMPLES: [string, string][] = [
  ["$QUBIT · key #1", "DM8YGyvZcVrRvUY5xSwnArB4mDNCHtTuEcVMG8kvgf5Y"],
  ["$WILLOW · key #0", "A5etzyWewR9EVFFa5UD6HFE3yXcwmN9yVb8CXs7zPxRT"],
];

const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((b) => parseInt(b, 16)));
const enc = new TextEncoder();

type Forge = "none" | "lamport" | "dest" | "bit" | "key";
const FORGES: [Forge, string][] = [
  ["none", "Honest"],
  ["lamport", "+1 lamport"],
  ["dest", "Swap destination"],
  ["bit", "Flip one signature bit"],
  ["key", "Check against next key"],
];

type Field = { name: string; bytes: number; color: string };

function run(r: Release, forge: Forge) {
  const amount = BigInt(r.amount) + (forge === "lamport" ? 1n : 0n);
  const destination = forge === "dest" ? "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" : r.destination;
  const w = { program: r.program, vault: r.vault, keyIndex: r.keyIndex, kind: r.kind, mint: r.mint, amount, destination, nextKeyHash: unhex(r.nextKeyHash), salt: r.salt };
  const msg = encodeWithdrawal(w);
  const sig = unhex(r.sig);
  if (forge === "bit") sig[137] ^= 0x01;
  const keyHash = unhex(forge === "key" ? r.nextKeyHash : r.keyHash);
  const t0 = performance.now();
  const ds = digits(msg);
  const ends: Uint8Array[] = [];
  for (let j = 0; j < CHAINS; j++) ends.push(walk(sig.slice(j * N, (j + 1) * N), j, ds[j], W - 1 - ds[j]));
  const flat = new Uint8Array(CHAINS * N);
  ends.forEach((e, j) => flat.set(e, j * N));
  const recomputed = sha256(flat);
  const ms = performance.now() - t0;
  const ok = hex(recomputed) === hex(keyHash);
  const steps = ds.reduce((s, d) => s + (W - 1 - d), 0);
  const fields: Field[] = [
    { name: "domain", bytes: 16, color: "#6b6b6b" },
    { name: "program", bytes: enc.encode(w.program).length, color: "#60a5fa" },
    { name: "silo", bytes: enc.encode(w.vault).length, color: "#c084fc" },
    { name: "key index", bytes: 4, color: "#f472b6" },
    { name: "kind", bytes: 1, color: "#fbbf24" },
    { name: "mint", bytes: enc.encode(w.mint).length, color: "#34d399" },
    { name: "amount", bytes: 8, color: "#b6ff3c" },
    { name: "destination", bytes: enc.encode(w.destination).length, color: "#f87171" },
    { name: "next key", bytes: 32, color: "#e4e4e7" },
    { name: "salt", bytes: 4, color: "#a3a3a3" },
  ];
  return { msg, ds, ends, recomputed, keyHash, ok, ms, steps, fields, digest: sha256(msg) };
}

function MessageBytes({ msg, fields }: { msg: Uint8Array; fields: Field[] }) {
  let o = 0;
  const spans = fields.map((f) => {
    const s = { ...f, start: o };
    o += f.bytes;
    return s;
  });
  const colorAt = (i: number) => spans.find((s) => i >= s.start && i < s.start + s.bytes)?.color ?? "#6b6b6b";
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
        {spans.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-[12px] text-ink/70">
            <span className="size-2 rounded-[1px]" style={{ background: s.color }} /> {s.name} <span className="text-mute">{s.bytes}B</span>
          </span>
        ))}
      </div>
      <div className="mono text-[11px] leading-[1.6] break-all bg-[#0b0b0b] border border-line p-3 max-h-48 overflow-y-auto">
        {Array.from(msg).map((b, i) => (
          <span key={i} style={{ color: colorAt(i) }}>{b.toString(16).padStart(2, "0")}{i % 2 ? " " : ""}</span>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-mute">{msg.length} bytes signed. Any change to any byte produces different digits.</p>
    </div>
  );
}

export default function Verify() {
  const [params, setParams] = useSearchParams();
  const latest = useApi(() => api.releases({ limit: 12 }));
  const stats = useApi(api.stats);
  const [input, setInput] = useState(params.get("id") ?? "");
  const [rel, setRel] = useState<Release | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forge, setForge] = useState<Forge>("none");
  const [shown, setShown] = useState(CHAINS);
  const [hover, setHover] = useState<number | null>(null);
  const [mode, setMode] = useState<"id" | "raw">("id");
  const [raw, setRaw] = useState("");
  const [custody, setCustody] = useState<"checking" | "ok" | "bad" | null>(null);
  const [showChains, setShowChains] = useState(false);

  useLive((type, data) => {
    if (type === "release" && data) {
      latest.setData((prev) => [data as Release, ...(prev ?? [])].slice(0, 12));
      stats.reload();
    }
  });

  async function load(id: string) {
    const v = id.trim();
    if (!v) return;
    setBusy(true);
    setErr("");
    setForge("none");
    try {
      const r = await api.release(v);
      setRel(r);
      setInput(r.id);
      setParams({ id: r.id }, { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function loadRaw() {
    setErr("");
    try {
      const r = JSON.parse(raw) as Release;
      if (!r.sig || unhex(r.sig).length !== SIG_BYTES) throw new Error("sig must be 840 bytes of hex");
      for (const k of ["program", "vault", "mint", "destination", "nextKeyHash", "keyHash", "amount"] as const) if (r[k] == null) throw new Error(`missing ${k}`);
      setRel({ ...r, id: r.id ?? "raw", ticker: r.ticker ?? "raw", kind: r.kind ?? "sol", keyIndex: Number(r.keyIndex ?? 0), salt: Number(r.salt ?? 0) });
      setForge("none");
    } catch (e) {
      setErr(`Couldn't read that JSON: ${(e as Error).message}`);
    }
  }

  // first load: ?id= or the latest withdrawal
  useEffect(() => {
    if (params.get("id")) load(params.get("id")!);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!rel && !params.get("id") && latest.data?.length) setRel(latest.data[0]);
  }, [latest.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const trace = useMemo(() => (rel ? run(rel, forge) : null), [rel, forge]);

  // animate the chain walk whenever a new check runs
  useEffect(() => {
    if (!trace) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setShown(CHAINS);
    setShown(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= CHAINS) clearInterval(t);
    }, 28);
    return () => clearInterval(t);
  }, [trace]);

  // key commitment: this key must be the previous withdrawal's next key, or the silo's key #0
  useEffect(() => {
    if (!rel || rel.id === "raw") return setCustody(null);
    let live = true;
    setCustody("checking");
    (async () => {
      try {
        if (rel.keyIndex === 0) {
          const c = await api.coinByVault(rel.vault);
          live && setCustody(c?.firstKeyHash === rel.keyHash ? "ok" : "bad");
        } else {
          const list = await api.releases({ vault: rel.vault, limit: 100 });
          const prev = list.find((x) => x.keyIndex === rel.keyIndex - 1);
          live && setCustody(prev?.nextKeyHash === rel.keyHash ? "ok" : "bad");
        }
      } catch {
        live && setCustody(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [rel]);

  const done = shown >= CHAINS;
  const ok = !!trace?.ok && done;

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-14">
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-end">
        <div>
          <p className="label flex items-center gap-2"><span className="dot" /> Verify</p>
          <h1 className="display mt-4 text-[48px] sm:text-[68px] leading-[0.98]">Don't trust us.<br />Re-run the math.</h1>
          <p className="mt-5 text-dim leading-relaxed max-w-xl">
            Every withdrawal from a silo carries an 840-byte hash signature. Paste a withdrawal ID and your browser re-walks
            all 30 SHA-256 chains from the raw bytes, then checks the result against the key the silo had committed to.
          </p>
        </div>
        <div className="lg:text-right">
          <div className="text-[64px] leading-none tracking-tight tabular-nums">{stats.data?.signatures ?? "—"}</div>
          <div className="label mt-2">hash signatures verified</div>
        </div>
      </div>

      {/* input */}
      <div className="mt-10 border border-line">
        <div className="flex border-b border-line">
          {(["id", "raw"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-4 h-10 mono text-[11px] uppercase tracking-[.06em] ${mode === m ? "text-ink border-b border-ink -mb-px" : "text-mute hover:text-ink"}`}>
              {m === "id" ? "Withdrawal ID" : "Raw JSON"}
            </button>
          ))}
        </div>
        {mode === "id" ? (
          <>
          <form className="p-4 flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); load(input); }}>
            <input className="input mono text-[13px]" placeholder="Paste a withdrawal ID" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Withdrawal ID" />
            <button className="btn btn-primary sm:w-36" disabled={busy || !input.trim()}>{busy ? "Fetching…" : "Verify"}</button>
          </form>
          <div className="px-4 pb-4 flex flex-wrap items-center gap-2">
            <span className="label mr-1">Try an example</span>
            {EXAMPLES.map(([label, id]) => (
              <button key={id} type="button" onClick={() => { setInput(id); load(id); }} className="mono text-[12px] border border-line px-2.5 py-1.5 hover:border-ink/40 hover:text-ink text-ink/70 transition-colors">
                {label} · {id.slice(0, 6)}…{id.slice(-4)}
              </button>
            ))}
          </div>
          </>
        ) : (
          <div className="p-4">
            <textarea className="input mono text-[12px] min-h-32" placeholder='{"program":"…","vault":"…","keyIndex":0,"mint":"…","amount":"…","destination":"…","nextKeyHash":"…","salt":0,"sig":"…","keyHash":"…"}' value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Raw withdrawal JSON" />
            <button className="btn btn-primary mt-2" onClick={loadRaw} disabled={!raw.trim()}>Verify JSON</button>
          </div>
        )}
        {err && <p className="px-4 pb-4 text-[13px] text-warn">{err}</p>}
      </div>

      <div className="mt-8 grid lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
        {/* result */}
        <div className="border border-line">
          {!rel || !trace ? (
            <div className="p-10 text-center text-mute">{latest.loading ? "Loading latest withdrawal…" : "Paste a withdrawal ID to begin."}</div>
          ) : (
            <>
              <div className="p-5 border-b border-line flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[17px]">${rel.ticker} silo · key #{rel.keyIndex}</p>
                  <p className="mono text-[12px] text-mute mt-0.5">{short(rel.id, 8)} · {rel.createdAt ? ago(rel.createdAt) : "raw input"}</p>
                </div>
                <span className={`mono text-[12px] uppercase tracking-[.06em] px-2.5 py-1 border ${!done ? "border-line text-mute" : ok ? "border-acc/40 text-acc" : "border-warn/40 text-warn"}`}>
                  {!done ? "Checking…" : ok ? "Valid" : "Invalid"}
                </span>
              </div>

              <ol className="p-5 space-y-4">
                {[
                  ["Withdrawal", `${(Number(BigInt(rel.amount) + (forge === "lamport" ? 1n : 0n)) / 1e9).toFixed(9)} SOL → ${short(forge === "dest" ? "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" : rel.destination)}`, `key #${rel.keyIndex} → #${rel.keyIndex + 1}`],
                  ["Message digest", "SHA-256 of the signed bytes; first 28 bytes are the digits", hex(trace.digest, 14) + "…"],
                  ["Hash chains walked", `${CHAINS} chains, ${trace.ms.toFixed(1)} ms in this browser`, `${(trace.steps + 1).toLocaleString()} hashes`],
                  ["Verify budget", `program limit ${MAX_VERIFY_STEPS.toLocaleString()} steps`, trace.steps <= MAX_VERIFY_STEPS ? "within budget" : "over budget"],
                  ["Key the signature proves", "SHA-256 of the 30 chain ends", hex(trace.recomputed, 14) + "…"],
                  ["Key the silo held", rel.keyIndex === 0 ? "committed when the silo was opened" : `committed by key #${rel.keyIndex - 1}'s withdrawal`, hex(trace.keyHash, 14) + "…"],
                ].map(([t, d, v], i) => (
                  <li key={t} className="grid grid-cols-[28px_1fr_auto] gap-3 items-start">
                    <span className="label pt-0.5">0{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-[15px]">{t}</div>
                      <div className="text-[12px] text-mute">{d}</div>
                    </div>
                    <span className={`mono text-[12px] text-right ${i === 3 && trace.steps > MAX_VERIFY_STEPS ? "text-warn" : "text-ink/70"}`}>{v}</span>
                  </li>
                ))}
                <li className="grid grid-cols-[28px_1fr_auto] gap-3">
                  <span className="label pt-0.5">07</span>
                  <div className="text-[15px]">Match</div>
                  <span className={`mono text-[12px] ${!done ? "text-mute" : ok ? "text-acc" : "text-warn"}`}>{!done ? "…" : ok ? "identical" : "different"}</span>
                </li>
                {custody && (
                  <li className="grid grid-cols-[28px_1fr_auto] gap-3">
                    <span className="label pt-0.5">08</span>
                    <div>
                      <div className="text-[15px]">Key commitment</div>
                      <div className="text-[12px] text-mute">{rel.keyIndex === 0 ? "matches the silo's key #0" : `matches key #${rel.keyIndex - 1}'s committed next key`}</div>
                    </div>
                    <span className={`mono text-[12px] ${custody === "ok" ? "text-acc" : custody === "bad" ? "text-warn" : "text-mute"}`}>{custody === "checking" ? "…" : custody === "ok" ? "linked" : "broken"}</span>
                  </li>
                )}
              </ol>

              {/* chain chart */}
              <div className="px-5">
                <div className="relative flex items-end gap-[3px] h-36" onMouseLeave={() => setHover(null)}>
                  {trace.ds.map((d, j) => {
                    const lit = j < shown;
                    return (
                      <button
                        key={j}
                        className="flex-1 h-full flex flex-col-reverse rounded-[1px] overflow-hidden focus-visible:outline-acc"
                        onMouseEnter={() => setHover(j)}
                        onFocus={() => setHover(j)}
                        aria-label={`chain ${j}: signer ${d} steps, verifier ${W - 1 - d} steps`}
                      >
                        <div className="bg-zinc-700" style={{ height: `${(d / (W - 1)) * 100}%` }} />
                        <div
                          className={`transition-[height] duration-200 ${!lit ? "bg-transparent" : trace.ok ? (j >= 28 ? "bg-ink" : "bg-acc") : "bg-warn"}`}
                          style={{ height: lit ? `${((W - 1 - d) / (W - 1)) * 100}%` : "0%" }}
                        />
                      </button>
                    );
                  })}
                  {hover !== null && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-raise border border-line2 px-3 py-2 mono text-[11px] whitespace-nowrap pointer-events-none z-10">
                      chain {hover}{hover >= 28 ? " (checksum)" : ""} · digit {trace.ds[hover]} · signer {trace.ds[hover]} · verifier {W - 1 - trace.ds[hover]}
                      <br />end {hex(trace.ends[hover], 16)}…
                    </div>
                  )}
                </div>
                <div className="flex justify-between label mt-2 !normal-case !tracking-normal">
                  <span>grey: walked by the signer</span>
                  <span>lit: walked by the verifier · white: checksum chains</span>
                </div>
              </div>

              {/* forge */}
              <div className="p-5 mt-3 border-t border-line">
                <p className="label">Try to forge it</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {FORGES.map(([f, l]) => (
                    <button key={f} className="pill min-h-9 border border-line" data-on={forge === f} onClick={() => setForge(f)}>{l}</button>
                  ))}
                </div>
                <p className={`mt-4 text-[15px] ${!done ? "text-mute" : ok ? "text-acc" : "text-warn"}`}>
                  {!done ? "Walking chains…" : ok ? "Valid. Same answer the program got on chain." : {
                    lamport: "Invalid. One extra lamport changes the digest, the digits, and every chain end.",
                    dest: "Invalid. The destination is part of the signed bytes; changing it changes the key the chains reach.",
                    bit: "Invalid. Flipping one bit of the signature sends chain 4 somewhere else entirely.",
                    key: "Invalid. A one-time signature only proves the key it was made with.",
                    none: "Invalid. This signature does not match the silo's key.",
                  }[forge]}
                </p>
              </div>

              {/* message bytes */}
              <div className="p-5 border-t border-line">
                <p className="label mb-3">Signed message</p>
                <MessageBytes msg={trace.msg} fields={trace.fields} />
              </div>

              {/* per-chain table */}
              <div className="border-t border-line">
                <button className="w-full p-5 flex justify-between items-center label hover:text-ink" onClick={() => setShowChains((s) => !s)} aria-expanded={showChains}>
                  <span>All 30 chains</span>
                  <span>{showChains ? "Hide" : "Show"}</span>
                </button>
                {showChains && (
                  <div className="overflow-x-auto px-5 pb-5">
                    <table className="w-full mono text-[12px]">
                      <thead>
                        <tr className="text-mute text-left border-b border-line">
                          <th className="py-2 font-normal">#</th><th className="font-normal">digit</th><th className="font-normal">signer</th><th className="font-normal">verifier</th><th className="font-normal">signature value</th><th className="font-normal">chain end</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trace.ds.map((d, j) => (
                          <tr key={j} className="border-b border-line last:border-0">
                            <td className="py-1.5 text-mute">{j}{j >= 28 ? "c" : ""}</td>
                            <td>{d}</td>
                            <td>{d}</td>
                            <td>{W - 1 - d}</td>
                            <td className="text-ink/60">{rel.sig.slice(j * 56, j * 56 + 16)}…</td>
                            <td className="text-ink/60">{hex(trace.ends[j], 8)}…</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* latest */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[17px]">Latest withdrawals</p>
            <span className="label flex items-center gap-2"><span className="dot" /> live</span>
          </div>
          <p className="text-[13px] text-mute mt-1">Each one was checked by the server before it was accepted. Pick one to check it yourself.</p>
          <ul className="mt-4 border border-line divide-y divide-line">
            {(latest.data ?? []).map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => { setRel(r); setInput(r.id); setForge("none"); setParams({ id: r.id }, { replace: true }); }}
                  className={`w-full grid grid-cols-[1fr_auto] gap-3 text-left px-4 py-3 transition-colors ${rel?.id === r.id ? "bg-acc/[.08]" : "hover:bg-white/[.02]"}`}
                >
                  <span>
                    <span className="block text-[14px]">${r.ticker} · key #{r.keyIndex}</span>
                    <span className="block mono text-[11px] text-mute">{short(r.id, 6)} → {short(r.destination)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block mono text-[13px]">{(Number(r.amount) / 1e9).toFixed(3)} SOL</span>
                    <span className="block text-[11px] text-mute">{ago(r.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
            {!latest.loading && !latest.data?.length && <li className="p-6 text-center text-mute text-[14px]">No withdrawals yet.</li>}
          </ul>
          <p className="mt-4 text-[13px] text-mute">
            How this works: <Link to="/docs/verifying" className="underline hover:text-ink">Verifying a withdrawal</Link> ·{" "}
            <Link to="/docs/signature-scheme" className="underline hover:text-ink">Signature scheme</Link>
                    </p>
        </div>
      </div>
      <VerifyExplainer />
    </div>
  );
}
