import { SILO_PATH, SILO_VIEWBOX } from "./siloPath";

export default function Logo({ height = 26, className = "" }: { height?: number; className?: string }) {
  const [, , w, h] = SILO_VIEWBOX.split(" ").map(Number);
  return (
    <svg height={height} width={(height * w) / h} viewBox={SILO_VIEWBOX} className={className} aria-hidden>
      <path fill="currentColor" fillRule="evenodd" d={SILO_PATH} />
    </svg>
  );
}
