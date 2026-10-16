import { NavLink, Link } from "react-router-dom";
import Logo from "./Logo";
import { BRAND, NETWORK } from "../lib/config";
import { useWallet } from "../wallet";
import { short } from "../lib/chain";

const links = [
  ["/", "Coins"],
  ["/lock", "Lock fees"],
  ["/silo", "Your silo"],
  ["/verify", "Verify"],
  ["/docs", "Docs"],
] as const;

export default function Nav() {
  const { address, connect, disconnect, walletIcon, connecting } = useWallet();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 font-semibold text-[17px] tracking-tight">
          <Logo /> {BRAND.name}
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-full transition ${isActive ? "bg-white/[.07] text-ink" : "text-dim hover:text-ink"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {NETWORK === "devnet" && <span className="label hidden sm:inline">devnet</span>}
          <a href={BRAND.xUrl} target="_blank" rel="noreferrer" aria-label={`${BRAND.x} on X`} className="text-dim hover:text-ink">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          {address ? (
            <button onClick={disconnect} title="Disconnect" className="btn btn-ghost mono text-[13px] py-1.5">
              {walletIcon && <img src={walletIcon} alt="" className="size-4 rounded" />}
              {short(address)}
            </button>
          ) : (
            <button onClick={connect} className="btn btn-ghost py-1.5">{connecting ? "Connecting…" : "Connect"}</button>
          )}
        </div>
      </div>
      <nav className="md:hidden flex gap-1 overflow-x-auto px-3 pb-2 text-sm">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `px-3 py-1 rounded-full whitespace-nowrap ${isActive ? "bg-white/[.07]" : "text-dim"}`}>
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
