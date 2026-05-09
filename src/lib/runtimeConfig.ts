function coerceBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value === "true";
}

function getDefaultWebSocketUrl() {
  if (typeof window === "undefined") {
    return "ws://localhost:5173/ws";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

const defaultRealtime =
  typeof import.meta !== "undefined" && import.meta.env.DEV;

export const runtimeConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  webSocketUrl: import.meta.env.VITE_WS_BASE_URL ?? getDefaultWebSocketUrl(),
  enableRealtime: coerceBoolean(import.meta.env.VITE_ENABLE_WEBSOCKETS, defaultRealtime),
  pollingIntervalMs: Number(import.meta.env.VITE_POLLING_INTERVAL_MS ?? "10000"),
  solanaRpcUrl: import.meta.env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com"
};
