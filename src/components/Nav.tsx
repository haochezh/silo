import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import Logo from "./Logo";
import { BRAND } from "../lib/config";
import { useWallet } from "../wallet";
import { short } from "../lib/chain";

const links = [
  ["/coins", "Coins"],
  ["/lock", "Lock fees"],
  ["/silo", "Your silo"],
  ["/verify", "Verify"],
  ["/docs", "Docs"],
] as const;

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `h-9 px-3 flex items-center text-[14px] transition-colors ${isActive ? "text-ink" : "text-ink/60 hover:text-ink"}`;

export default function Nav() {
  const { address, connect, disconnect, walletIcon, connecting } = useWallet();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const solid = scrolled || pathname !== "/";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 transition-colors duration-300 border-b ${solid ? "bg-bg/85 backdrop-blur border-line" : "bg-transparent border-transparent"}`}
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 h-14 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-[17px] font-medium tracking-tight shrink-0">
          <Logo height={24} /> {BRAND.name}
        </Link>

        <nav className="hidden md:flex items-center ml-6" aria-label="Primary">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={linkCls}>{label}</NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <a
            href={BRAND.xUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${BRAND.x} on X`}
            className="h-9 w-9 grid place-items-center text-ink/60 hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          {address ? (
            <button onClick={disconnect} title="Disconnect" className="btn btn-ghost !normal-case !tracking-normal">
              {walletIcon && <img src={walletIcon} alt="" className="size-4" />}
              {short(address)}
            </button>
          ) : (
            <button onClick={connect} className="btn btn-primary">{connecting ? "Connecting…" : "Connect"}</button>
          )}
        </div>
      </div>

      <nav className="md:hidden flex overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Primary mobile">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} className={(s) => `${linkCls(s)} shrink-0`}>{label}</NavLink>
        ))}
      </nav>
    </header>
  );
}
