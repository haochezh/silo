import { BRAND, PROGRAM_ID, PUMP_FEES_PROGRAM } from "../lib/config";

const SCHEME = [
  ["Scheme", "Winternitz OTS (WOTS+-style tweaks), w = 256"],
  ["Hash", "SHA-256, chain values truncated to 224 bits"],
  ["Chains", "28 message digits + 2 checksum digits = 30"],
  ["Signature", "840 bytes, one transaction"],
  ["Verify cost", "≤ 3,600 hashes (client grinds a salt to bound it)"],
  ["Keys", "one-time; each withdrawal commits to the next key's hash"],
  ["Security", "~112-bit against Grover; Shor does not apply"],
];

function H({ children }: { children: string }) {
  return <h2 className="text-2xl font-medium tracking-tight mt-14 mb-4">{children}</h2>;
}

export default function Docs() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-16 text-[15px] leading-relaxed text-dim">
      <div className="label">docs</div>
      <h1 className="mt-3 text-[44px] font-medium tracking-[-0.03em] text-ink">How {BRAND.name} works</h1>
      <p className="mt-4">
        {BRAND.name} is a Solana program that holds pump.fun creator fees in vaults with no private key. The only way
        out is a hash-based one-time signature, verified on chain. No elliptic curve is involved at any step of a
        withdrawal.
      </p>

      <H>Why</H>
      <p>
        On Solana an address is its ed25519 public key. If the curve ever falls, to a quantum computer or a classical
        shortcut, every wallet is exposed at once. Creator fees are especially exposed: they accumulate for months and
        often go unclaimed for years. Hash-based signatures rest on the preimage resistance of SHA-256 alone.
      </p>

      <H>Flow</H>
      <pre className="card p-5 mono text-[12px] text-ink overflow-x-auto leading-6">{`pump.fun trades ──creator fee──▶ creator vault (pump PDA)
                                      │
            distribute_creator_fees_v2 │  permissionless
                                      ▼
                              silo (PDA, no key)
                                      │
   authorize(sig, action, next_key_hash) ◀── 24 words, signed in the browser
         │  verify WOTS on chain, rotate key, record action
         ▼
   execute_sol / execute_token ──▶ any Solana address`}</pre>
      <ol className="mt-6 space-y-3 list-decimal pl-5">
        <li>
          <span className="text-ink">Open.</span> The browser derives key #0 from 24 words and sends only its hash.{" "}
          <code className="mono text-ink">open_silo</code> creates a PDA committed to it.
        </li>
        <li>
          <span className="text-ink">Lock.</span> The creator calls pump.fun's{" "}
          <code className="mono text-ink">create_fee_sharing_config</code> and{" "}
          <code className="mono text-ink">update_fee_shares_v2</code> with the silo as recipient. Pump.fun allows this
          once and then revokes the admin, so the route is permanent.
        </li>
        <li>
          <span className="text-ink">Collect.</span> Anyone can call{" "}
          <code className="mono text-ink">distribute_creator_fees_v2</code> (and the PumpSwap sweep after graduation).
          Fees land in the silo without anyone signing.
        </li>
        <li>
          <span className="text-ink">Withdraw.</span> The browser signs{" "}
          <code className="mono text-ink">(program, silo, key number, kind, mint, amount, destination, next_key_hash, salt)</code>.{" "}
          <code className="mono text-ink">authorize</code> verifies it and rotates to the next key;{" "}
          <code className="mono text-ink">execute_*</code> pays exactly what was signed. Anyone can submit either; the
          signature is the authority, not the fee payer.
        </li>
      </ol>

      <H>Signature scheme</H>
      <table className="w-full text-sm">
        <tbody>
          {SCHEME.map(([k, v]) => (
            <tr key={k} className="border-b border-line">
              <td className="py-2.5 text-ink w-40">{k}</td>
              <td className="py-2.5 mono text-[13px]">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H>What it doesn't protect</H>
      <ul className="space-y-2 list-disc pl-5">
        <li>Solana itself. Validators still sign blocks with ed25519.</li>
        <li>The share of fees you didn't route. Anything below 100% still flows to your normal wallet.</li>
        <li>Lost words. There is no recovery path by design.</li>
        <li>The moment funds leave. A withdrawal to a normal wallet is only as safe as that wallet.</li>
      </ul>

      <H>Addresses</H>
      <dl className="text-sm mono">
        <div className="flex justify-between border-b border-line py-2.5"><dt className="text-dim">silo program</dt><dd className="text-ink break-all">{PROGRAM_ID}</dd></div>
        <div className="flex justify-between border-b border-line py-2.5"><dt className="text-dim">pump fees</dt><dd className="text-ink break-all">{PUMP_FEES_PROGRAM}</dd></div>
      </dl>
    </div>
  );
}
