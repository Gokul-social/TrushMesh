import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import type { WalletAdapter } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { Buffer } from "buffer";
import { App } from "./App";
import { runtimeConfig } from "./lib/runtimeConfig";
import { getEffectiveRpcEndpoint } from "./lib/settings";
import { ThemeProvider, initializeThemeOnLoad } from "./components/ThemeProvider";
import { useSettingsStore } from "./stores/settingsStore";
import "./styles.css";
import "@solana/wallet-adapter-react-ui/styles.css";

if (typeof window !== "undefined") {
  try {
    if (!("Buffer" in window)) {
      Object.assign(window, { Buffer });
    }
  } catch {
    // Ignore shim failures; app should still boot without crashing.
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15_000
    }
  }
});

function AppProviders() {
  const [wallets, setWallets] = React.useState<WalletAdapter[]>([]);
  const rpcPreset = useSettingsStore((state) => state.rpcPreset);
  const customRpcUrl = useSettingsStore((state) => state.customRpcUrl);
  const autoConnectWallet = useSettingsStore((state) => state.autoConnectWallet);
  const endpoint = getEffectiveRpcEndpoint({ rpcPreset, customRpcUrl }, runtimeConfig.solanaRpcUrl);

  React.useEffect(() => {
    let cancelled = false;

    const loadWallets = async () => {
      try {
        const { PhantomWalletAdapter } = await import("@solana/wallet-adapter-phantom");
        if (!cancelled) {
          setWallets([new PhantomWalletAdapter()]);
        }
      } catch (error) {
        // Keep the app usable even if a wallet adapter fails to initialize.
        console.error("Wallet adapter initialization failed", error);
        if (!cancelled) {
          setWallets([]);
        }
      }
    };

    void loadWallets();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={autoConnectWallet}>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

initializeThemeOnLoad();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppProviders />
    </ThemeProvider>
  </React.StrictMode>
);
