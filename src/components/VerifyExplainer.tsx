import { useState } from "react";
import { Link } from "react-router-dom";

const CHECKS: [string, string][] = [
  ["Withdrawal", "The amount, destination and key numbers decoded from the transaction. These are exactly the values the signature has to cover."],
  ["Message digest", "SHA-256 of the full signed message. Its first 28 bytes become the 28 message digits; two checksum digits are derived from them."],
  ["Hash chains walked", "For each of the 30 chains, the verifier hashes the signature value 255 − digit more times. Your browser does the same work the program did."],
  ["Verify budget", "The program refuses anything that would take more than 3,600 hash steps, so a signature can never exceed one transaction's compute budget."],
  ["Key the signature proves", "SHA-256 of the 30 chain ends. If the signature is genuine, this is the public key it was made with."],
  ["Key the silo held", "The key hash the silo was expecting at that moment, published either when the silo was opened or by the previous withdrawal."],
  ["Match", "If the two keys are identical, the signature is valid. There is no other way to make the chains land on the right key without the secret."],
  ["Key commitment", "Confirms this key was the one committed by the previous withdrawal (or key #0 at lock), so the chain of custody is unbroken."],
];

const SNIPPET = `import { encodeWithdrawal, verify } from "./lib/wots";

// fetch any withdrawal from the public API
const r = await fetch("https://api.silo.fund/api/releases/" + id).then((x) => x.json());
const unhex = (h) => Uint8Array.from(h.match(/../g), (b) => parseInt(b, 16));

const msg = encodeWithdrawal({
  program: r.program, vault: r.vault, keyIndex: r.keyIndex, kind: r.kind,
  mint: r.mint, amount: BigInt(r.amount), destination: r.destination,
  nextKeyHash: unhex(r.nextKeyHash), salt: r.salt,
});

console.log(verify(unhex(r.sig), msg, unhex(r.keyHash)).ok); // true`;

export default function VerifyExplainer() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-28 space-y-24">
      <section>
        <p className="label">What each check means</p>
        <h2 className="display mt-4 text-[40px] sm:text-[48px] leading-[1.02] max-w-3xl">Eight checks, all in your browser.</h2>
        <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {CHECKS.map(([t, d], i) => (
            <li key={t} className="bg-bg p-6 hover:bg-white/[.02] transition-colors">
              <p className="mono text-[12px] text-mute">0{i + 1}</p>
              <p className="mt-5 text-[17px]">{t}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/60 font-light">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid lg:grid-cols-[1fr_1.3fr] gap-10 items-start">
        <div>
          <p className="label">Do it without this page</p>
          <h2 className="display mt-4 text-[40px] leading-[1.02]">Verify from your own code.</h2>
          <p className="mt-5 text-[16px] leading-relaxed text-ink/65 font-light">
            The verifier is about forty lines of TypeScript with no Solana dependency. Fetch any withdrawal from the public
            API and run the same check yourself. If you'd rather not trust our client either, the scheme is fully specified
            in the docs and can be reimplemented in any language with SHA-256.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/docs/signature-scheme" className="btn btn-ghost">Signature scheme</Link>
            <Link to="/docs/sdk" className="btn btn-ghost">TypeScript client</Link>
          </div>
        </div>
        <div className="border border-line bg-[#0b0b0b]">
          <div className="flex items-center justify-between h-9 px-3 border-b border-line">
            <span className="mono text-[11px] text-mute uppercase tracking-[.06em]">verify.ts</span>
            <button
              className="mono text-[11px] text-mute hover:text-ink uppercase tracking-[.06em]"
              onClick={() => { navigator.clipboard?.writeText(SNIPPET); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="p-4 overflow-x-auto mono text-[12.5px] leading-[1.7] text-ink/85"><code>{SNIPPET}</code></pre>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-px bg-line border border-line">
        {[
          ["Checked twice", "Every withdrawal is verified by the server before it is accepted, and again by your browser on this page. Both use the same byte layout as the on-chain program."],
          ["Nothing to trust", "The page downloads only public data: the signature, the signed fields and the key hash. The math either lands on the key or it doesn't."],
          ["Forgery fails loudly", "Use the forge buttons above: one extra lamport, a different destination or a single flipped bit sends every chain somewhere else."],
        ].map(([t, d]) => (
          <article key={t} className="bg-bg p-6 sm:p-8">
            <p className="text-[18px]">{t}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/60 font-light">{d}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
