import { useEffect, useRef, useState } from "react";

// Full-bleed looping background video. Large screens get AV1 (sharper at the
// same size) with an H.264 fallback; phones get 720p. Reduced motion shows the poster only.
export default function BgVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"off" | "large" | "small">("off");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setMode(window.innerWidth >= 1024 ? "large" : "small");
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v || mode === "off") return;
    v.load();
    v.play().catch(() => {});
  }, [mode]);

  return (
    <video
      ref={ref}
      className={className}
      poster="/video/silo-loop-poster.jpg"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden
      tabIndex={-1}
    >
      {mode === "large" && <source src="/video/silo-loop-1080.av1.mp4" type='video/mp4; codecs="av01.0.08M.10"' />}
      {mode === "large" && <source src="/video/silo-loop-1080.mp4" type="video/mp4" />}
      {mode === "small" && <source src="/video/silo-loop-720.mp4" type="video/mp4" />}
    </video>
  );
}
