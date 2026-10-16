import { useState } from "react";
import { Link } from "react-router-dom";

function KeyRotation() {
  const [k, setK] = useState(0);
  const keys = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div className="border border-line p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label">Key rotation</p>
        <div className="flex gap-2">
          <button className="btn btn-ghost !min-h-8 !py-1" onClick={() => setK(0)} disabled={k === 0}>Reset</button>
          <button className="btn btn-primary !min-h-8 !py-1" onClick={() => setK((x) => Math.min(5, x + 1))} disabled={k >= 5}>Simulate a withdrawal</button>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
        {keys.map((i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <div
              className={`w-[86px] border px-3 py-2.5 transition-all duration-500 ${
                i < k ? "border-line text-mute line-through opacity-50" : i === k ? "border-acc text-ink bg-acc/[.06]" : "border-line text-ink/50"
              }`}
            >
              <p className="mono text-[13px]">key #{i}</p>
              <p className="mono text-[10px] mt-0.5 no-underline">{i < k ? "retired" : i === k ? "current" : "committed"}</p>
            </div>
            {i < keys.length - 1 && <span className={`text-[12px] ${i < k ? "text-acc" : "text-mute"}`}>→</span>}
          </div>
        ))}
      </div>
      <p className="mt-4 text-[14px] text-ink/60 leading-relaxed">
        {k === 0
          ? "The silo starts out expecting key #0. Its hash was published when you locked the coin."
          : `Withdrawal ${k} was signed with key #${k - 1}, which committed to key #${k}. The program retired key #${k - 1} in the same instruction, so that signature can never be used again.`}
      </p>
    </div>
  );
}

const QA: [string, string][] = [
  ["Do I need my wallet to withdraw?", "No. The 24 words are the only authority over a silo. Any wallet, or no wallet, can submit a signed withdrawal; the signature decides where funds go."],
  ["What if I enter the wrong words?", "You'll derive a different silo address with nothing locked to it. Nothing is sent anywhere and nothing can break; just try again."],
  ["How often can I withdraw?", "As often as you like. Every withdrawal uses the next one-time key, and there is no limit on how many keys a phrase can produce."],
  ["Can someone watching the chain steal my next withdrawal?", "No. A withdrawal pays exactly the amount and destination you signed. Anyone who copies it can only submit it for you."],
];

export default function VaultExplainer() {
  return (
    <div className="mt-24 space-y-24">
      <section className="grid lg:grid-cols-[1fr_1.2fr] gap-10">
        <div>
          <p className="label">What is a silo</p>
          <h2 className="display mt-4 text-[40px] leading-[1.02]">A vault with no private key.</h2>
        </div>
        <div className="space-y-4 text-[16px] leading-relaxed text-ink/65 font-light">
          <p>
            A silo is a program address on Solana. Unlike a normal wallet, there is no ed25519 key behind it, so there is
            nothing for a quantum computer, or anyone else, to steal. Creator fees flow in through pump.fun's fee sharing;
            the only way out is a hash-based signature made from your 24 words.
          </p>
          <p>
            The page above never sends your words anywhere. It derives your keys inside this tab, works out your silo's
            address from the hash of key #0, and asks the network for its balance and history.
          </p>
        </div>
      </section>

      <section>
        <p className="label">When you open a silo</p>
        <ol className="mt-6 grid md:grid-cols-3 gap-px bg-line border border-line">
          {[
            ["Derive", "Your words become a 64-byte seed, and the seed becomes a chain of one-time Winternitz keys. This happens locally in a few milliseconds."],
            ["Locate", "The hash of key #0 is part of the silo's address. That's how the same words always find the same silo, on any device."],
            ["Read", "silo fetches the balance, the fee share and every past withdrawal, then works out which key the vault expects next."],
          ].map(([t, d], i) => (
            <li key={t} className="bg-bg p-6">
              <p className="mono text-[12px] text-mute">0{i + 1}</p>
              <p className="mt-5 text-[18px]">{t}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/60 font-light">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid lg:grid-cols-[1fr_1.4fr] gap-10 items-start">
        <div>
          <p className="label">Withdrawing</p>
          <h2 className="display mt-4 text-[40px] leading-[1.02]">Every signature is used once.</h2>
          <p className="mt-5 text-[16px] leading-relaxed text-ink/65 font-light">
            Winternitz signatures are one-time: signing two different messages with the same key would leak enough to forge
            a third. So each withdrawal signs with the current key and commits to the next one, and the vault moves forward a
            key every time. Try it.
          </p>
          <Link to="/docs/withdrawing" className="mt-6 inline-flex btn btn-ghost">Read the withdrawal guide</Link>
        </div>
        <KeyRotation />
      </section>

      <section>
        <p className="label">Keeping your words safe</p>
        <div className="mt-6 grid md:grid-cols-2 gap-px bg-line border border-line">
          <div className="bg-bg p-6">
            <p className="text-[17px] text-acc">Do</p>
            <ul className="mt-4 space-y-2.5 text-[15px] text-ink/70">
              <li>Write the 24 words on paper, in order, and keep two copies in different places.</li>
              <li>Use a metal backup if you plan to hold for years.</li>
              <li>Label each phrase with the coin's ticker if you lock more than one coin.</li>
              <li>Only enter the words on silo.fund, on a device you trust.</li>
            </ul>
          </div>
          <div className="bg-bg p-6">
            <p className="text-[17px] text-warn">Don't</p>
            <ul className="mt-4 space-y-2.5 text-[15px] text-ink/70">
              <li>Screenshot them, email them or paste them into a notes app.</li>
              <li>Store them in a password manager that syncs to the cloud.</li>
              <li>Share them with anyone claiming to be support. silo has no support that needs your words.</li>
              <li>Reuse them as a normal wallet phrase.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1fr_1.5fr] gap-10">
        <div>
          <p className="label">Questions</p>
          <h2 className="display mt-4 text-[40px] leading-[1.02]">About your silo.</h2>
        </div>
        <div className="border-t border-line">
          {QA.map(([q, a]) => (
            <details key={q} className="group border-b border-line">
              <summary className="flex justify-between items-center gap-6 py-4 cursor-pointer list-none text-[16px] text-ink/90">
                {q}
                <span className="text-mute transition-transform group-open:rotate-45 text-[18px] leading-none" aria-hidden>+</span>
              </summary>
              <p className="pb-5 text-[15px] leading-relaxed text-ink/60 font-light">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
