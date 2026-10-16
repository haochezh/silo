import { useMemo, type ReactNode } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { ConnectionProvider, WalletProvider as AdapterProvider, useWallet as useAdapter } from "@solana/wallet-adapter-react";
import { WalletModalProvider, useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import "@solana/wallet-adapter-react-ui/styles.css";

// Phantom, Solflare, Backpack and other Wallet Standard wallets are detected
// automatically, so no adapters are listed here.
export function WalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => import.meta.env.VITE_RPC_URL || clusterApiUrl("mainnet-beta"), []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <AdapterProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </AdapterProvider>
    </ConnectionProvider>
  );
}

export function useWallet() {
  const w = useAdapter();
  const { setVisible } = useWalletModal();
  return {
    address: w.publicKey?.toBase58() ?? null,
    walletName: w.wallet?.adapter.name,
    walletIcon: w.wallet?.adapter.icon,
    connecting: w.connecting,
    canSign: !!w.signMessage,
    connect: () => setVisible(true),
    disconnect: () => w.disconnect(),
    // Off-chain message signature; moves no funds. Returns null if the wallet
    // can't sign messages or the user rejects.
    signMessage: async (text: string): Promise<string | null> => {
      if (!w.signMessage) return null;
      try {
        return bs58.encode(await w.signMessage(new TextEncoder().encode(text)));
      } catch {
        return null;
      }
    },
  };
}
