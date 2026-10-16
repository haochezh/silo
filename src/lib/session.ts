// In-memory only: words are never written to storage.
export type Locked = { ticker: string; mint: string; share: number; unclaimed: number; vault: string };

export const session: { mnemonic: string | null; locked: Locked | null; keyIndex: number } = {
  mnemonic: null,
  locked: null,
  keyIndex: 0,
};
