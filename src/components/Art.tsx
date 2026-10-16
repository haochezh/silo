// Minimal line illustrations used on the home page.
const MONO = "Geist Mono, monospace";

export function CurveArt() {
  const up: [number, number][] = [], lo: [number, number][] = [];
  for (let x = -1.769; x <= 2.6; x += 0.02) {
    const v = x ** 3 - 2 * x + 2;
    if (v < 0) continue;
    up.push([200 + x * 80, 130 - Math.sqrt(v) * 38]);
    lo.push([200 + x * 80, 130 + Math.sqrt(v) * 38]);
  }
  const pts = [...up.reverse(), ...lo].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 400 260" className="w-full h-full" aria-hidden>
      {[60, 130, 200].map((y) => <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="#1f1f1f" />)}
      {[80, 200, 320].map((x) => <line key={x} y1="0" y2="260" x1={x} x2={x} stroke="#1f1f1f" />)}
      <polyline points={pts} fill="none" stroke="#f4f4f4" strokeWidth="1.2" />
      {[[106, 90], [200, 76], [263, 170]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#f4f4f4" />)}
      <line x1="106" y1="90" x2="263" y2="170" stroke="#f4f4f4" strokeDasharray="3 4" strokeOpacity=".5" />
      <text x="12" y="248" fill="#6b6b6b" fontFamily={MONO} fontSize="10">elliptic curve · every address is a public key</text>
    </svg>
  );
}

const D = [212, 41, 188, 97, 150, 23, 240, 66, 131, 179, 84, 205, 12, 160, 119, 57, 230, 140, 31, 199, 108, 75, 222, 168, 46, 93, 186, 137, 18, 201];

export function ChainArt({ label = true }: { label?: boolean }) {
  return (
    <svg viewBox="0 0 400 260" className="w-full h-full" aria-hidden>
      {D.map((v, i) => {
        const x = 30 + i * 11.3, h = 170, lit = ((255 - v) / 255) * h, acc = i % 7 === 3;
        return (
          <g key={i}>
            <rect x={x} y={40} width="6" height={h} fill="#1b1b1b" />
            <rect x={x} y={40 + h - lit} width="6" height={lit} fill={acc ? "#b6ff3c" : "#f4f4f4"} fillOpacity={acc ? 1 : 0.85} />
          </g>
        );
      })}
      {label && <text x="30" y="248" fill="#6b6b6b" fontFamily={MONO} fontSize="10">30 chains · walked to the top · 840 bytes</text>}
    </svg>
  );
}

export function IsoStack({ labels }: { labels: string[] }) {
  return (
    <svg viewBox="0 0 300 220" className="w-full h-full" aria-hidden>
      {labels.map((l, i) => {
        const y = 20 + i * 34, top = i === 0;
        return (
          <g key={l}>
            <polygon points={`150,${y} 250,${y + 36} 150,${y + 72} 50,${y + 36}`} fill={top ? "#131313" : "none"} stroke={top ? "#f4f4f4" : "#3a3a3a"} />
            {top && (
              <text x="150" y={y + 40} textAnchor="middle" fill="#f4f4f4" fontFamily={MONO} fontSize="9" letterSpacing=".1em" transform={`rotate(20 150 ${y + 40})`}>
                {l}
              </text>
            )}
          </g>
        );
      })}
      <circle cx="226" cy="56" r="2.5" fill="#b6ff3c" />
    </svg>
  );
}

export function WordGrid() {
  return (
    <svg viewBox="0 0 300 220" className="w-full h-full" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => {
        const c = i % 4, r = Math.floor(i / 4), on = i === 9;
        return (
          <g key={i}>
            <rect x={45 + c * 54} y={30 + r * 27} width="48" height="20" fill="none" stroke={on ? "#f4f4f4" : "#2f2f2f"} />
            <text x={50 + c * 54} y={44 + r * 27} fill={on ? "#f4f4f4" : "#4a4a4a"} fontFamily={MONO} fontSize="8">{String(i + 1).padStart(2, "0")}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Funnel() {
  return (
    <svg viewBox="0 0 300 220" className="w-full h-full" aria-hidden>
      {[40, 90, 150, 210, 260].map((x, i) => <path key={i} d={`M${x},10 C${x},70 150,60 150,108`} fill="none" stroke="#3a3a3a" />)}
      <circle cx="150" cy="110" r="5" fill="#f4f4f4" />
      <line x1="150" y1="116" x2="150" y2="150" stroke="#f4f4f4" strokeDasharray="2 3" />
      <polygon points="150,150 196,170 150,190 104,170" fill="#f4f4f4" />
      <polygon points="150,140 240,180 150,220 60,180" fill="none" stroke="#2a2a2a" />
    </svg>
  );
}
