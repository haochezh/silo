// Fictional coins and numbers. Replace with reads from the program + pump.fun.

export type Coin = {
  ticker: string;
  name: string;
  mint: string;
  mcap: number; // USD
  vol24: number; // USD
  holders: number;
  inSilo: number; // SOL sitting in the vault
  lifetime: number; // SOL ever routed into the vault
  share: number; // % of creator fees routed
  graduated: boolean;
  lockedAt: string;
  color: string;
};

export const COINS: Coin[] = [
  { ticker: "QUBIT", name: "qubit", mint: "7Qb1tP9mXo2uK4nV8sRz3LhWcY6eTfJdA5gBpump", mcap: 48_300, vol24: 7_900, holders: 312, inSilo: 0.684, lifetime: 0.912, share: 100, graduated: false, lockedAt: "6h ago", color: "#a3e635" },
  { ticker: "WILLOW", name: "willow chip", mint: "9WiLLoWa3Tq7nRk2PzXe5uVb8mYcHdJ4sFg6pump", mcap: 31_700, vol24: 4_200, holders: 198, inSilo: 0.391, lifetime: 0.447, share: 100, graduated: false, lockedAt: "11h ago", color: "#60a5fa" },
  { ticker: "SHOR", name: "shor's cat", mint: "4ShoRcAt8pLx2Qm9VnK7eTb3RyWu6ZdHj5sFpump", mcap: 14_900, vol24: 1_850, holders: 104, inSilo: 0.142, lifetime: 0.163, share: 100, graduated: false, lockedAt: "1d ago", color: "#f472b6" },
  { ticker: "MAGIC", name: "magic state", mint: "6MaGiCsT4teQx8Rn2LpVk7Yb3WmTe9uZdHj5pump", mcap: 9_600, vol24: 940, holders: 71, inSilo: 0.067, lifetime: 0.067, share: 50, graduated: false, lockedAt: "1d ago", color: "#c084fc" },
  { ticker: "HASH", name: "only hashes", mint: "2HaShOnLy5Qp8Xm3Vn7Kb2Ty4WzHe9uRdJs1pump", mcap: 6_200, vol24: 410, holders: 43, inSilo: 0.021, lifetime: 0.021, share: 100, graduated: false, lockedAt: "2d ago", color: "#f87171" },
];

export type Release = { who: string; key: number; amount: string; to: string; ago: string; tx: string };

export const RELEASES: Release[] = [
  { who: "$QUBIT silo", key: 1, amount: "0.18 SOL", to: "Ag7q…9NQy", ago: "4h ago", tx: "3xQe9vKp2TbLmN7rWc4uY8aZsHd6fJg1oP5iRkV2eBnX" },
  { who: "$WILLOW silo", key: 0, amount: "0.05 SOL", to: "EMBx…mXBn", ago: "9h ago", tx: "5kLm2pQr8TvXw3Yz9AbCd4EfGh6IjKl7MnOp1QrStUv" },
  { who: "$QUBIT silo", key: 0, amount: "0.05 SOL", to: "Ag7q…9NQy", ago: "1d ago", tx: "4hIj5kLm6nOp7qRs8tUv9wXy1zAb2cDe3fGh4iJk5lMn" },
  { who: "$SHOR silo", key: 0, amount: "0.02 SOL", to: "FQCr…V7SN", ago: "1d ago", tx: "2aBc3dEf4gHi5jKl6mNo7pQr8sTu9vWx1yZa2bCd3eFg" },
];

// Coins the connected (demo) wallet created on pump.fun.
export const MY_COINS = [
  { ticker: "BUNKR", name: "bunker boy", mint: "BuNkRb0y7Qp2Xm8Vn4Kb6Ty9WzHe5uRdJs1pump", unclaimed: 0.084, mcap: 11_400, graduated: false },
  { ticker: "ZERO", name: "zero curves", mint: "ZeRoCuRv3sQp8Xm2Vn7Kb4Ty6WzHe9uRdJs1pump", unclaimed: 0.019, mcap: 4_100, graduated: false },
];

export const SOL_USD = 182.4;
