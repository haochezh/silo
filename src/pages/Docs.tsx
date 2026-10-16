import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { BRAND } from "../lib/config";
import { Concepts, Introduction, Keys, Locking, Quickstart, Verifying, Withdrawing } from "./docs/guides";
import { Faq, ProgramReference, PumpIntegration, Sdk, Security, SignatureScheme } from "./docs/reference";

type Page = { slug: string; title: string; lead: string; Body: ComponentType };

const GROUPS: { name: string; pages: Page[] }[] = [
  {
    name: "Getting started",
    pages: [
      { slug: "introduction", title: "Introduction", lead: "Post-quantum vaults for pump.fun creator fees.", Body: Introduction },
      { slug: "quickstart", title: "Quickstart", lead: "Route a coin's creator fees into a silo in a few minutes.", Body: Quickstart },
      { slug: "concepts", title: "Core concepts", lead: "Silos, one-time keys and the fee route.", Body: Concepts },
    ],
  },
  {
    name: "Guides",
    pages: [
      { slug: "locking", title: "Locking creator fees", lead: "Connect a pump.fun coin to a silo, permanently.", Body: Locking },
      { slug: "withdrawing", title: "Withdrawing", lead: "Sign in the browser, verify on chain, pay out exactly what was signed.", Body: Withdrawing },
      { slug: "verifying", title: "Verifying a withdrawal", lead: "Re-run the program's check from the raw transaction bytes.", Body: Verifying },
      { slug: "keys", title: "Managing your 24 words", lead: "How the words become keys, and how to keep them.", Body: Keys },
    ],
  },
  {
    name: "Reference",
    pages: [
      { slug: "signature-scheme", title: "Signature scheme", lead: "Winternitz one-time signatures over SHA-256, byte for byte.", Body: SignatureScheme },
      { slug: "program", title: "Program reference", lead: "Instructions, accounts and errors of the silo program.", Body: ProgramReference },
      { slug: "sdk", title: "TypeScript client", lead: "Key derivation, signing and verification in the browser.", Body: Sdk },
      { slug: "pump-fun", title: "pump.fun integration", lead: "How silo uses pump.fun's fee sharing.", Body: PumpIntegration },
    ],
  },
  {
    name: "More",
    pages: [
      { slug: "security", title: "Security model", lead: "What silo protects, what it assumes, and where it stops.", Body: Security },
      { slug: "faq", title: "FAQ", lead: "Short answers to common questions.", Body: Faq },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.pages.map((p) => ({ ...p, group: g.name })));

export default function Docs() {
  const { slug = "introduction" } = useParams();
  const idx = Math.max(0, ALL.findIndex((p) => p.slug === slug));
  const page = ALL[idx];
  const prev = ALL[idx - 1];
  const next = ALL[idx + 1];
  const body = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState("");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    setMenu(false);
    const hs = Array.from(body.current?.querySelectorAll("h2[id]") ?? []) as HTMLElement[];
    setToc(hs.map((h) => ({ id: h.id, text: h.textContent?.replace(/#$/, "") ?? "" })));
    document.title = `${page.title} · ${BRAND.name} docs`;
    if (!hs.length) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive((e.target as HTMLElement).id)),
      { rootMargin: "-80px 0px -70% 0px" },
    );
    hs.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [page]);

  const sidebar = (
    <nav aria-label="Docs" className="space-y-7">
      {GROUPS.map((g) => (
        <div key={g.name}>
          <p className="label">{g.name}</p>
          <ul className="mt-2.5 space-y-0.5 border-l border-line">
            {g.pages.map((p) => (
              <li key={p.slug}>
                <NavLink
                  to={`/docs/${p.slug}`}
                  className={() =>
                    `block py-1.5 pl-3 -ml-px border-l text-[14px] transition-colors ${
                      p.slug === page.slug ? "border-ink text-ink" : "border-transparent text-ink/55 hover:text-ink"
                    }`
                  }
                >
                  {p.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_220px] gap-10 xl:gap-14">
        <aside className="hidden lg:block border-r border-line">
          <div className="sticky top-14 max-h-[calc(100vh-56px)] overflow-y-auto py-10 pr-6">{sidebar}</div>
        </aside>

        <article className="min-w-0 py-10 lg:py-12 max-w-3xl">
          <button className="lg:hidden btn btn-ghost mb-6" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
            {menu ? "Close menu" : "Docs menu"}
          </button>
          {menu && <div className="lg:hidden mb-10 border border-line p-5">{sidebar}</div>}

          <p className="label">{page.group}</p>
          <h1 className="mt-3 text-[34px] sm:text-[40px] leading-tight font-normal tracking-tight">{page.title}</h1>
          <p className="mt-3 text-[18px] leading-relaxed text-ink/60 font-light">{page.lead}</p>

          <div ref={body} className="mt-8 border-t border-line pt-2">
            <page.Body />
          </div>

          <div className="mt-16 grid sm:grid-cols-2 gap-3">
            {prev ? (
              <Link to={`/docs/${prev.slug}`} className="border border-line p-4 hover:border-line2 hover:bg-white/[.02]">
                <span className="label">Previous</span>
                <span className="block mt-1 text-[15px]">‹ {prev.title}</span>
              </Link>
            ) : <span />}
            {next && (
              <Link to={`/docs/${next.slug}`} className="border border-line p-4 text-right hover:border-line2 hover:bg-white/[.02]">
                <span className="label">Next</span>
                <span className="block mt-1 text-[15px]">{next.title} ›</span>
              </Link>
            )}
          </div>

          <div className="mt-8 flex flex-wrap justify-between gap-3 text-[13px] text-mute">
            <a href={`${BRAND.github}/tree/main/src/pages/docs`} target="_blank" rel="noreferrer" className="hover:text-ink">Edit this page on GitHub</a>
            <span>Last updated October 2026</span>
          </div>
        </article>

        <aside className="hidden xl:block">
          {toc.length > 0 && (
            <div className="sticky top-14 py-12">
              <p className="label">On this page</p>
              <ul className="mt-3 space-y-1.5 text-[13px]">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className={`transition-colors ${active === t.id ? "text-ink" : "text-ink/50 hover:text-ink"}`}>{t.text}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
