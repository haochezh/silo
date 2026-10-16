import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function H2({ children }: { children: string }) {
  const id = slugify(children);
  return (
    <h2 id={id} className="group scroll-mt-24 mt-14 mb-4 text-[24px] font-normal tracking-tight text-ink">
      <a href={`#${id}`} className="no-underline">
        {children}
        <span className="ml-2 text-mute opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>#</span>
      </a>
    </h2>
  );
}

export function H3({ children }: { children: string }) {
  return <h3 id={slugify(children)} className="scroll-mt-24 mt-9 mb-3 text-[18px] font-normal text-ink">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="my-4 text-[15.5px] leading-[1.75] text-ink/75">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="my-4 pl-5 list-disc space-y-2 text-[15.5px] leading-[1.7] text-ink/75 marker:text-mute">{children}</ul>;
}

export function OL({ children }: { children: ReactNode }) {
  return <ol className="my-4 pl-5 list-decimal space-y-2 text-[15.5px] leading-[1.7] text-ink/75 marker:text-mute">{children}</ol>;
}

export function C({ children }: { children: ReactNode }) {
  return <code className="mono text-[13px] px-1.5 py-0.5 rounded-[2px] bg-white/[.06] text-ink">{children}</code>;
}

export function A({ to, children }: { to: string; children: ReactNode }) {
  const cls = "text-ink underline decoration-white/25 underline-offset-4 hover:decoration-ink";
  return to.startsWith("http") ? (
    <a href={to} target="_blank" rel="noreferrer" className={cls}>{children}</a>
  ) : (
    <Link to={to} className={cls}>{children}</Link>
  );
}

export function Code({ children, lang = "", title }: { children: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const text = children.replace(/^\n/, "").replace(/\s+$/, "");
  return (
    <div className="my-6 border border-line rounded-[2px] bg-[#0b0b0b] overflow-hidden">
      <div className="flex items-center justify-between h-9 px-3 border-b border-line">
        <span className="mono text-[11px] text-mute uppercase tracking-[.06em]">{title ?? lang}</span>
        <button
          className="mono text-[11px] text-mute hover:text-ink uppercase tracking-[.06em]"
          onClick={() => {
            navigator.clipboard?.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-[1.7] mono text-ink/90"><code>{text}</code></pre>
    </div>
  );
}

export function Note({ kind = "note", title, children }: { kind?: "note" | "warn" | "tip"; title?: string; children: ReactNode }) {
  const color = { note: "border-l-ink/40", warn: "border-l-warn", tip: "border-l-acc" }[kind];
  const label = title ?? { note: "Note", warn: "Warning", tip: "Tip" }[kind];
  return (
    <div className={`my-6 border border-line border-l-2 ${color} bg-white/[.02] px-4 py-3`}>
      <p className="mono text-[11px] uppercase tracking-[.06em] text-ink/80">{label}</p>
      <div className="mt-1.5 text-[14.5px] leading-[1.7] text-ink/70">{children}</div>
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-6 overflow-x-auto border border-line">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-line bg-white/[.02]">
            {head.map((h) => (
              <th key={h} className="text-left font-normal mono text-[11px] uppercase tracking-[.06em] text-mute px-4 py-2.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-b-0 align-top">
              {r.map((c, j) => (
                <td key={j} className="px-4 py-2.5 text-ink/75 leading-relaxed">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Steps({ items }: { items: [string, ReactNode][] }) {
  return (
    <ol className="my-6 border-l border-line">
      {items.map(([t, d], i) => (
        <li key={t} className="relative pl-7 pb-6 last:pb-0">
          <span className="absolute -left-[11px] top-0 size-[21px] grid place-items-center rounded-full bg-bg border border-line2 mono text-[10px] text-ink/80">
            {i + 1}
          </span>
          <p className="text-[15.5px] text-ink">{t}</p>
          <div className="mt-1 text-[15px] leading-[1.7] text-ink/70">{d}</div>
        </li>
      ))}
    </ol>
  );
}
