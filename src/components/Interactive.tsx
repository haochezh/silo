import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { digits, newMnemonic, W } from "../lib/wots";

const MONO = "Geist Mono, monospace";
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ----------------------------------------------------------- curve */

// y^2 = x^3 + A x + B, the same shape used across the site
const A = -2, B = 2;
const X0 = -1.769, X1 = 2.6;
const toSvg = (x: number, y: number) => [200 + x * 80, 130 - y * 38] as const;
const yAt = (x: number) => Math.sqrt(Math.max(0, x ** 3 + A * x + B));

type Pt = { x: number; s: 1 | -1 };
const pt = (p: Pt) => ({ x: p.x, y: p.s * yAt(p.x) });

function add(p: { x: number; y: number }, q: { x: number; y: number }) {
  let l: number;
  if (Math.abs(p.x - q.x) < 1e-6) {
    if (Math.abs(p.y + q.y) < 1e-6) return null; // vertical line: point at infinity
    l = (3 * p.x ** 2 + A) / (2 * p.y);
  } else l = (q.y - p.y) / (q.x - p.x);
  const x = l * l - p.x - q.x;
  return { x, y: l * (p.x - x) - p.y, l };
}

export function CurvePlay() {
  const svg = useRef<SVGSVGElement>(null);
  const [P, setP] = useState<Pt>({ x: -1.1, s: 1 });
  const [Q, setQ] = useState<Pt>({ x: 0.4, s: 1 });
  const [drag, setDrag] = useState<"P" | "Q" | null>(null);
  const [touched, setTouched] = useState(false);
  const [hovering, setHovering] = useState(false);

  // idle drift so the figure is never static (pauses under the cursor)
  useEffect(() => {
    if (touched || hovering || reduced()) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = (t - t0) / 1000;
      setP({ x: -1.15 + Math.sin(k * 0.6) * 0.45, s: 1 });
      setQ({ x: 0.9 + Math.sin(k * 0.45 + 1.3) * 0.75, s: Math.sin(k * 0.3) > -0.6 ? 1 : -1 });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [touched, hovering]);

  const curvePts = (() => {
    const up: string[] = [], lo: string[] = [];
    for (let x = X0; x <= X1; x += 0.02) {
      const [sx, sy] = toSvg(x, yAt(x));
      up.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
      lo.push(`${sx.toFixed(1)},${(260 - sy).toFixed(1)}`);
    }
    return [...up.reverse(), ...lo].join(" ");
  })();

  const local = (e: RPointerEvent<SVGSVGElement>) => {
    const r = svg.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 400, ((e.clientY - r.top) / r.height) * 260] as const;
  };

  function down(e: RPointerEvent<SVGSVGElement>) {
    if (!svg.current) return;
    const [sx, sy] = local(e);
    const d = (a: Pt) => {
      const [x, y] = toSvg(a.x, a.s * yAt(a.x));
      return Math.hypot(x - sx, y - sy);
    };
    const near = d(P) <= d(Q) ? "P" : "Q";
    if (Math.min(d(P), d(Q)) > 45) return;
    svg.current.setPointerCapture?.(e.pointerId);
    setDrag(near);
    setTouched(true);
  }

  function move(e: RPointerEvent<SVGSVGElement>) {
    if (!drag || !svg.current) return;
    const [sx, sy] = local(e);
    const x = Math.min(X1, Math.max(X0 + 0.001, (sx - 200) / 80));
    const next: Pt = { x, s: sy < 130 ? 1 : -1 };
    (drag === "P" ? setP : setQ)(next);
  }

  const p = pt(P), q = pt(Q);
  const r = add(p, q);
  const [px, py] = toSvg(p.x, p.y), [qx, qy] = toSvg(q.x, q.y);
  const inView = (x: number, y: number) => x > -2.2 && x < 3 && Math.abs(y) < 4.5;
  let line: [number, number, number, number] | null = null;
  if (r) {
    const xs = [p.x, q.x, r.x], lo = Math.min(...xs) - 0.4, hi = Math.max(...xs) + 0.4;
    const [ax, ay] = toSvg(lo, p.y + r.l * (lo - p.x)), [bx, by] = toSvg(hi, p.y + r.l * (hi - p.x));
    line = [ax, ay, bx, by];
  }
  const neg = r ? toSvg(r.x, -r.y) : null;
  const sum = r ? toSvg(r.x, r.y) : null;

  return (
    <div className="relative h-full w-full select-none">
      <svg
        ref={svg}
        viewBox="0 0 400 260"
        className="w-full h-full touch-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => { setHovering(false); setDrag(null); }}
        role="img"
        aria-label="Interactive elliptic curve. Drag points P and Q to see P plus Q."
      >
        <defs>
          <clipPath id="cv"><rect width="400" height="260" /></clipPath>
        </defs>
        {[60, 130, 200].map((y) => <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="#1f1f1f" />)}
        {[80, 200, 320].map((x) => <line key={x} y1="0" y2="260" x1={x} x2={x} stroke="#1f1f1f" />)}
        <g clipPath="url(#cv)">
          <polyline points={curvePts} fill="none" stroke="#f4f4f4" strokeWidth="1.2" />
          {line && <line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke="#f4f4f4" strokeOpacity=".35" strokeDasharray="3 4" />}
          {r && neg && sum && inView(r.x, r.y) && (
            <>
              <line x1={neg[0]} y1={neg[1]} x2={sum[0]} y2={sum[1]} stroke="#b6ff3c" strokeOpacity=".5" strokeDasharray="2 3" />
              <circle cx={neg[0]} cy={neg[1]} r="3" fill="none" stroke="#f4f4f4" strokeOpacity=".6" />
              <circle cx={sum[0]} cy={sum[1]} r="4.5" fill="#b6ff3c" />
              <text x={sum[0] + 8} y={sum[1] + 4} fill="#b6ff3c" fontFamily={MONO} fontSize="10">P + Q</text>
            </>
          )}
        </g>
        {([["P", px, py], ["Q", qx, qy]] as const).map(([n, x, y]) => (
          <g key={n} className="cursor-grab active:cursor-grabbing">
            <circle cx={x} cy={y} r="14" fill="transparent" />
            <circle cx={x} cy={y} r={drag === n ? 6 : 4.5} fill="#f4f4f4" />
            <text x={x + 9} y={y - 7} fill="#f4f4f4" fontFamily={MONO} fontSize="11">{n}</text>
          </g>
        ))}
        <text x="12" y="248" fill="#6b6b6b" fontFamily={MONO} fontSize="10">
          {touched ? `P = (${p.x.toFixed(2)}, ${p.y.toFixed(2)})  Q = (${q.x.toFixed(2)}, ${q.y.toFixed(2)})` : "drag P or Q · y² = x³ − 2x + 2"}
        </text>
      </svg>
    </div>
  );
}

/* ----------------------------------------------------------- chains */

function randomDigits() {
  const m = new Uint8Array(32);
  crypto.getRandomValues(m);
  return digits(m);
}

export function ChainPlay({ compact = false }: { compact?: boolean }) {
  const [ds, setDs] = useState<number[]>(() => randomDigits());
  const [shown, setShown] = useState(30);
  const [hover, setHover] = useState<number | null>(null);
  const [n, setN] = useState(1);
  const wrap = useRef<HTMLDivElement>(null);
  const visible = useRef(false);

  function resign() {
    setDs(randomDigits());
    setN((k) => k + 1);
  }

  useEffect(() => {
    if (reduced()) return setShown(30);
    setShown(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= 30) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [ds]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting));
    io.observe(el);
    const t = setInterval(() => visible.current && hover === null && !reduced() && resign(), 6000);
    return () => {
      io.disconnect();
      clearInterval(t);
    };
  }, [hover]);

  const steps = ds.reduce((s, d) => s + (W - 1 - d), 0);

  return (
    <div ref={wrap} className="h-full flex flex-col">
      <div className="relative flex-1 flex items-end gap-[3px] min-h-40" onMouseLeave={() => setHover(null)}>
        {ds.map((d, j) => (
          <button
            key={j}
            onMouseEnter={() => setHover(j)}
            onFocus={() => setHover(j)}
            className="flex-1 h-full flex flex-col-reverse overflow-hidden rounded-[1px] focus-visible:outline-acc"
            aria-label={`chain ${j}: signer ${d} steps, verifier ${W - 1 - d}`}
          >
            <div className="bg-[#2a2a2a]" style={{ height: `${(d / (W - 1)) * 100}%` }} />
            <div
              className={`transition-[height] duration-200 ${j < shown ? (hover === j ? "bg-acc" : j >= 28 ? "bg-ink/60" : "bg-ink/90") : ""}`}
              style={{ height: j < shown ? `${((W - 1 - d) / (W - 1)) * 100}%` : "0%" }}
            />
          </button>
        ))}
        {hover !== null && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-raise border border-line2 px-3 py-1.5 mono text-[11px] whitespace-nowrap pointer-events-none">
            chain {hover}{hover >= 28 ? " · checksum" : ""} · signer {ds[hover]} · verifier {W - 1 - ds[hover]}
          </div>
        )}
      </div>
      <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 ${compact ? "text-[11px]" : "text-[12px]"}`}>
        <span className="mono text-mute">signature #{n} · {steps + 1} hashes to verify · 840 bytes</span>
        <button onClick={resign} className="btn btn-ghost !min-h-8 !py-1">Sign a new message</button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- steps */

const DEMO_CA = "7Qb1tP9mXo2uK4nV8sRz3LhWcY6eTfJdA5gBpump";

function StepCoin() {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (reduced()) return setTyped(DEMO_CA);
    setTyped("");
    let i = 0;
    const t = setInterval(() => {
      i += 2;
      setTyped(DEMO_CA.slice(0, i));
      if (i >= DEMO_CA.length) clearInterval(t);
    }, 35);
    return () => clearInterval(t);
  }, []);
  const found = typed.length >= DEMO_CA.length;
  return (
    <div className="space-y-3">
      <div className="label">Coin contract address</div>
      <div className="input mono text-[12px] truncate">{typed}<span className="cursor inline-block w-[6px] h-[13px] align-[-2px] bg-ink/70 ml-px" /></div>
      <div className={`border border-line p-3 flex items-center justify-between transition-opacity duration-500 ${found ? "opacity-100" : "opacity-0"}`}>
        <div className="flex items-center gap-3">
          <span className="size-8 grid place-items-center bg-acc text-black text-[10px] font-medium rounded-[2px]">QU</span>
          <div>
            <p className="text-[14px]">$QUBIT <span className="text-mute">qubit</span></p>
            <p className="mono text-[11px] text-mute">$48.3K mcap · bonding curve</p>
          </div>
        </div>
        <span className="mono text-[11px] text-acc uppercase tracking-[.06em]">Found</span>
      </div>
    </div>
  );
}

function StepWords() {
  const [words, setWords] = useState(() => newMnemonic().split(" "));
  const [reveal, setReveal] = useState(false);
  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        {words.map((w, i) => (
          <div key={i + w} className="border border-line px-2 py-1.5 mono text-[11px] truncate">
            <span className="text-mute mr-1">{i + 1}</span>
            <span className={`transition-[filter] duration-300 ${reveal ? "" : "blur-[4px]"}`}>{w}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn btn-ghost !min-h-8 !py-1" onClick={() => setReveal((r) => !r)}>{reveal ? "Hide" : "Reveal"}</button>
        <button className="btn btn-ghost !min-h-8 !py-1" onClick={() => { setWords(newMnemonic().split(" ")); setReveal(false); }}>Generate new</button>
      </div>
      <p className="mt-2 text-[12px] text-mute">A real BIP-39 phrase, generated in your browser just now. Never shown to anyone else.</p>
    </div>
  );
}

function StepLock() {
  const [share, setShare] = useState(100);
  const [lit, setLit] = useState(0);
  const layers = ["Bonding curve", "Creator vault", "Fee split", "Silo"];
  function lock() {
    setLit(0);
    layers.forEach((_, i) => setTimeout(() => setLit(i + 1), 350 * (i + 1)));
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="label">Fee share to the silo</span>
        <span className="mono text-[13px] text-acc">{share}%</span>
      </div>
      <input type="range" min={1} max={100} value={share} onChange={(e) => { setShare(Number(e.target.value)); setLit(0); }} className="range mt-2 w-full" style={{ ["--p" as string]: `${share}%` }} aria-label="Fee share" />
      <div className="mt-4 space-y-1.5">
        {layers.map((l, i) => (
          <div key={l} className={`flex items-center justify-between border px-3 py-2 text-[13px] transition-colors duration-300 ${i < lit ? "border-acc/50 text-ink" : "border-line text-mute"}`}>
            <span>{l}</span>
            <span className="mono text-[11px]">{i < lit ? (i === 3 ? `${share}% sealed` : "routed") : "—"}</span>
          </div>
        ))}
      </div>
      <button className="btn btn-primary w-full mt-3" onClick={lock}>{lit === 4 ? "Locked · run again" : "Lock it"}</button>
    </div>
  );
}

export function StepsPlay() {
  const [at, setAt] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || reduced()) return;
    const t = setTimeout(() => setAt((a) => (a + 1) % 3), 7000);
    return () => clearTimeout(t);
  }, [at, auto]);
  const steps = [
    ["Pick your coin", "Paste any pump.fun coin's contract address and connect the wallet that created it. Bonding curve or graduated, both work."],
    ["Write down 24 words", "Your browser derives a chain of Winternitz keys from them. Only the hash of key #0 is ever published. The words never leave the tab."],
    ["Lock it", "pump.fun's fee split is set to your silo and its admin is revoked. Every future creator fee lands in the vault, forever."],
  ];
  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-px bg-line border border-line" data-no-reveal>
      <div className="bg-bg" role="tablist" aria-label="How it works">
        {steps.map(([t, d], i) => (
          <button
            key={t}
            role="tab"
            aria-selected={at === i}
            onClick={() => { setAt(i); setAuto(false); }}
            className={`relative w-full text-left p-6 sm:p-8 border-b border-line last:border-b-0 transition-colors ${at === i ? "bg-white/[.03]" : "hover:bg-white/[.015]"}`}
          >
            <p className="label">Step {i + 1}</p>
            <p className={`mt-3 text-[20px] ${at === i ? "text-ink" : "text-ink/60"}`}>{t}</p>
            <p className={`mt-2 text-[15px] leading-relaxed font-light transition-colors ${at === i ? "text-ink/60" : "text-ink/35"}`}>{d}</p>
            {at === i && auto && <span key={at} className="absolute left-0 bottom-0 h-px bg-acc progress" />}
          </button>
        ))}
      </div>
      <div className="bg-bg p-6 sm:p-8 flex flex-col justify-center min-h-[380px]" role="tabpanel">
        {at === 0 && <StepCoin key="c" />}
        {at === 1 && <StepWords key="w" />}
        {at === 2 && <StepLock key="l" />}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- count up */

export function CountUp({ value, decimals = 0 }: { value: number | null | undefined; decimals?: number }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (value == null) return;
    if (reduced()) return setV(value);
    let raf = 0;
    const el = ref.current;
    const start = () => {
      const t0 = performance.now(), from = 0, dur = 1200;
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        setV(from + (value - from) * e);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        start();
        io.disconnect();
      }
    });
    if (el) io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return <span ref={ref}>{value == null ? "—" : v.toFixed(decimals)}</span>;
}
