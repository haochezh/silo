import { useEffect, useRef, useState } from "react";

// Same origin by default (the Railway server serves the site and the API).
// Set VITE_API_URL when the frontend is hosted somewhere else.
export const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export type Coin = {
  mint: string;
  ticker: string;
  name: string;
  image: string | null;
  creator: string;
  vault: string;
  share: number;
  firstKeyHash: string;
  lockedAt: number;
  mcap: number | null;
  vol24: number | null;
  price: number | null;
  holders: number | null;
  inSilo: number;
  lifetime: number;
  graduated: boolean;
};

export type Release = {
  id: string;
  vault: string;
  mint: string;
  ticker: string;
  keyIndex: number;
  kind: "sol" | "token";
  coinMint: string;
  amount: string;
  destination: string;
  nextKeyHash: string;
  salt: number;
  sig: string;
  keyHash: string;
  program: string;
  steps: number;
  createdAt: number;
};

export type Market = { mint: string; name: string; ticker: string; image: string | null; price: number | null; mcap: number | null; vol24: number | null; graduated: boolean };
export type Lookup = { mint: string; locked: boolean; coin: Coin | null; market: Market | null };
export type Stats = { coins: number; inSilo: number; lifetime: number; signatures: number };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API + path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, j.error ?? `request failed (${r.status})`);
  return j as T;
}

export const api = {
  stats: () => req<Stats>("/api/stats"),
  coins: () => req<Coin[]>("/api/coins"),
  coinByVault: (vault: string) => req<Coin | null>(`/api/coins?vault=${vault}`),
  lookup: (mint: string) => req<Lookup>(`/api/lookup/${mint}`),
  lock: (b: { mint: string; creator: string; vault: string; share: number; firstKeyHash: string; message: string; signature: string; ticker?: string; name?: string }) =>
    req<Coin>("/api/locks", { method: "POST", body: JSON.stringify(b) }),
  releases: (opts: { vault?: string; limit?: number } = {}) =>
    req<Release[]>(`/api/releases?limit=${opts.limit ?? 25}${opts.vault ? `&vault=${opts.vault}` : ""}`),
  release: (id: string) => req<Release>(`/api/releases/${id}`),
  withdraw: (b: Record<string, unknown>) => req<Release>("/api/releases", { method: "POST", body: JSON.stringify(b) }),
};

// Subscribe to server events; falls back to polling if the stream drops.
export function useLive(on: (type: "coin" | "release", data: unknown) => void) {
  const cb = useRef(on);
  cb.current = on;
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    try {
      es = new EventSource(API + "/api/stream");
      es.addEventListener("coin", (e) => cb.current("coin", JSON.parse((e as MessageEvent).data)));
      es.addEventListener("release", (e) => cb.current("release", JSON.parse((e as MessageEvent).data)));
      es.onerror = () => {
        if (!poll) poll = setInterval(() => cb.current("coin", null), 20_000);
      };
      es.onopen = () => {
        if (poll) clearInterval(poll);
        poll = null;
      };
    } catch {
      poll = setInterval(() => cb.current("coin", null), 20_000);
    }
    return () => {
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, []);
}

export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = () =>
    fn()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), deps);
  return { data, setData, error, loading, reload: load };
}

export const usd = (n: number | null | undefined) =>
  n == null ? "—" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;

export function ago(t: number) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const isAddress = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());
