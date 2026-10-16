import { useState } from "react";

const PALETTE = ["#b6ff3c", "#60a5fa", "#f472b6", "#c084fc", "#f87171", "#fbbf24", "#34d399"];

export default function CoinAvatar({ ticker, image, size = 28 }: { ticker: string; image?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const color = PALETTE[[...ticker].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length];
  if (image && !broken) {
    return <img src={image} alt="" width={size} height={size} onError={() => setBroken(true)} className="rounded-[2px] object-cover bg-raise shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <span className="grid place-items-center rounded-[2px] text-[10px] font-medium text-black shrink-0" style={{ width: size, height: size, background: color }}>
      {ticker.slice(0, 2).toUpperCase()}
    </span>
  );
}
