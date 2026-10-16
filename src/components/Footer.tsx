import { Link } from "react-router-dom";
import { BRAND, PROGRAM_ID } from "../lib/config";
import { short } from "../lib/chain";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-line mt-24">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col md:flex-row gap-6 justify-between text-[12px] text-mute leading-relaxed">
        <div className="max-w-md">
        <div className="flex items-center gap-2 text-ink text-sm font-medium mb-3"><Logo height={20} /> {BRAND.domain}</div>
        <p>
          {BRAND.name} is experimental software on Solana that routes pump.fun creator fees into vaults opened only
          by hash-based signatures. It protects fees from a broken signing curve. It cannot protect against Solana
          itself failing, and a lost set of 24 words is a sealed silo forever. Nothing here is financial advice.
        </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 items-start">
          <a href={BRAND.xUrl} target="_blank" rel="noreferrer" className="hover:text-ink">{BRAND.x}</a>
          <Link to="/verify" className="hover:text-ink">Verify</Link>
          <Link to="/docs" className="hover:text-ink">Docs</Link>
          <a href={BRAND.github} target="_blank" rel="noreferrer" className="hover:text-ink">GitHub</a>
          <span className="mono">program {short(PROGRAM_ID, 5)}</span>
        </div>
      </div>
    </footer>
  );
}
