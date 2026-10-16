import { useEffect } from "react";

// Site-wide scroll reveal. Tags sections, cards, tables, headings and list rows
// inside <main> and fades them up as they enter the viewport. Content added
// later (API data, route changes) is picked up by a MutationObserver.
const SELECTOR = [
  "main section > *",
  "main article",
  "main .card",
  "main table",
  "main h1",
  "main h2",
  "main h3",
  "main ul > li",
  "main ol > li",
  "main details",
  "main pre",
  "main [data-reveal]",
].join(",");

export function useReveal(key: string) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const main = document.querySelector("main");
    if (!main) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          // small stagger for siblings revealed together
          const i = Array.prototype.indexOf.call(el.parentElement?.children ?? [], el);
          el.style.transitionDelay = `${Math.min(i, 6) * 60}ms`;
          el.classList.add("rv-in");
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );

    const tag = () => {
      main.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (el.dataset.rv || el.closest("[data-no-reveal]")) return;
        el.dataset.rv = "1";
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.92) return; // already on screen: leave it alone
        el.classList.add("rv");
        io.observe(el);
      });
    };

    tag();
    let raf = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tag);
    });
    mo.observe(main, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [key]);
}
