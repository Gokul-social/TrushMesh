import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { Buffer } from "buffer";
import { App } from "./App";
import { runtimeConfig } from "./lib/runtimeConfig";
import { getEffectiveRpcEndpoint } from "./lib/settings";
import { ThemeProvider, initializeThemeOnLoad } from "./components/ThemeProvider";
import { useSettingsStore } from "./stores/settingsStore";
import "./styles.css";
import "@solana/wallet-adapter-react-ui/styles.css";

if (!("Buffer" in window)) {
  Object.assign(window, { Buffer });
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

const wallets = [new PhantomWalletAdapter()];

function AppProviders() {
  const settings = useSettingsStore((state) => ({
    rpcPreset: state.rpcPreset,
    customRpcUrl: state.customRpcUrl,
    autoConnectWallet: state.autoConnectWallet
  }));
  const endpoint = getEffectiveRpcEndpoint(settings, runtimeConfig.solanaRpcUrl);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={settings.autoConnectWallet}>
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
