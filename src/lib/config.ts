// Rename the product in one place.
export const BRAND = {
  name: "silo",
  ticker: "$SILO",
  motto: "Outlive the curve.",
  x: "@silodotfund",
  xUrl: "https://x.com/silodotfund",
  domain: "silo.fund",
  url: "https://silo.fund",
  // Change to your repo once it's created.
  github: "https://github.com/silodotfund/silo",
};

// Placeholder until the program is deployed. Nothing in this preview sends a
// real transaction: the lock and withdraw flows are simulated (see lib/chain.ts).
export const PROGRAM_ID = "S1LoqVau1tPq9xW3mZ7bHn4cRk2eYd8uTf6gJsA5LvN";
// Pump Fees program (fee sharing). Confirm against pump-fun/pump-public-docs before wiring up.
export const PUMP_FEES_PROGRAM = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
export const NETWORK: "devnet" | "mainnet" = "devnet";
