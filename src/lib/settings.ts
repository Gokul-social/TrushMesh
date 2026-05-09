export const SETTINGS_STORAGE_KEY = "trustmesh.settings";

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export const RPC_PRESET_ENDPOINTS = {
  "runtime-default": "",
  "solana-devnet": "https://api.devnet.solana.com",
  "solana-mainnet": "https://api.mainnet-beta.solana.com",
  "solana-testnet": "https://api.testnet.solana.com",
  custom: ""
} as const;

export type ThemePreference =
  | "light-mesh"
  | "dark-mesh"
  | "midnight"
  | "ocean"
  | "forest"
  | "solar"
  | "system";

export type ResolvedTheme =
  | "light-mesh"
  | "dark-mesh"
  | "midnight"
  | "ocean"
  | "forest"
  | "solar";

export type SystemColorScheme = "light" | "dark";

export type WalletPreference = "last-connected" | "phantom-only" | "manual-connect";
export type RpcPreset = keyof typeof RPC_PRESET_ENDPOINTS;

export type AppSettings = {
  themePreference: ThemePreference;
  walletPreference: WalletPreference;
  autoConnectWallet: boolean;
  rpcPreset: RpcPreset;
  customRpcUrl: string;
  pollingIntervalMs: number;
  notifications: {
    jobCompletion: boolean;
    securityAlerts: boolean;
    weeklyDigest: boolean;
    productAnnouncements: boolean;
  };
  privacy: {
    maskWalletAddresses: boolean;
    redactPayloadPreviews: boolean;
    shareAnonymousTelemetry: boolean;
    warnOnExternalLinks: boolean;
  };
  developer: {
    developerMode: boolean;
    showRawIdentifiers: boolean;
    websocketDiagnostics: boolean;
  };
};

export const themeOptions: Array<{
  id: ThemePreference;
  label: string;
  description: string;
  swatches: [string, string, string];
}> = [
  {
    id: "light-mesh",
    label: "Light Mesh",
    description: "Bright frosted surfaces with the original TrustMesh glow.",
    swatches: ["#eef2ff", "#6366f1", "#8b5cf6"]
  },
  {
    id: "dark-mesh",
    label: "Dark Mesh",
    description: "A low-light glass console tuned for long operator sessions.",
    swatches: ["#111827", "#60a5fa", "#8b5cf6"]
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Deep indigo atmosphere with cooler neon accents.",
    swatches: ["#0b1120", "#4f46e5", "#38bdf8"]
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Calm marine tones with crisp cyan telemetry highlights.",
    swatches: ["#e0f2fe", "#0ea5e9", "#2563eb"]
  },
  {
    id: "forest",
    label: "Forest",
    description: "Grounded greens for a quieter operational workspace.",
    swatches: ["#ecfdf5", "#10b981", "#059669"]
  },
  {
    id: "solar",
    label: "Solar",
    description: "Warm amber contrast for high-visibility monitoring.",
    swatches: ["#fff7ed", "#f59e0b", "#f97316"]
  },
  {
    id: "system",
    label: "System Default",
    description: "Follow your operating system’s light or dark preference.",
    swatches: ["#e2e8f0", "#64748b", "#1e293b"]
  }
];

export const defaultSettings: AppSettings = {
  themePreference: "system",
  walletPreference: "last-connected",
  autoConnectWallet: true,
  rpcPreset: "runtime-default",
  customRpcUrl: "",
  pollingIntervalMs: 10_000,
  notifications: {
    jobCompletion: true,
    securityAlerts: true,
    weeklyDigest: false,
    productAnnouncements: false
  },
  privacy: {
    maskWalletAddresses: false,
    redactPayloadPreviews: true,
    shareAnonymousTelemetry: true,
    warnOnExternalLinks: true
  },
  developer: {
    developerMode: false,
    showRawIdentifiers: false,
    websocketDiagnostics: false
  }
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isThemePreference(value: unknown): value is ThemePreference {
  return themeOptions.some((theme) => theme.id === value);
}

function isWalletPreference(value: unknown): value is WalletPreference {
  return value === "last-connected" || value === "phantom-only" || value === "manual-connect";
}

function isRpcPreset(value: unknown): value is RpcPreset {
  return typeof value === "string" && value in RPC_PRESET_ENDPOINTS;
}

function coerceBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function coerceNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeSettings(value: unknown): AppSettings {
  if (!isObject(value)) {
    return defaultSettings;
  }

  const notifications = isObject(value.notifications) ? value.notifications : {};
  const privacy = isObject(value.privacy) ? value.privacy : {};
  const developer = isObject(value.developer) ? value.developer : {};

  return {
    themePreference: isThemePreference(value.themePreference)
      ? value.themePreference
      : defaultSettings.themePreference,
    walletPreference: isWalletPreference(value.walletPreference)
      ? value.walletPreference
      : defaultSettings.walletPreference,
    autoConnectWallet: coerceBoolean(value.autoConnectWallet, defaultSettings.autoConnectWallet),
    rpcPreset: isRpcPreset(value.rpcPreset) ? value.rpcPreset : defaultSettings.rpcPreset,
    customRpcUrl: typeof value.customRpcUrl === "string" ? value.customRpcUrl : defaultSettings.customRpcUrl,
    pollingIntervalMs: coerceNumber(value.pollingIntervalMs, defaultSettings.pollingIntervalMs),
    notifications: {
      jobCompletion: coerceBoolean(notifications.jobCompletion, defaultSettings.notifications.jobCompletion),
      securityAlerts: coerceBoolean(notifications.securityAlerts, defaultSettings.notifications.securityAlerts),
      weeklyDigest: coerceBoolean(notifications.weeklyDigest, defaultSettings.notifications.weeklyDigest),
      productAnnouncements: coerceBoolean(
        notifications.productAnnouncements,
        defaultSettings.notifications.productAnnouncements
      )
    },
    privacy: {
      maskWalletAddresses: coerceBoolean(
        privacy.maskWalletAddresses,
        defaultSettings.privacy.maskWalletAddresses
      ),
      redactPayloadPreviews: coerceBoolean(
        privacy.redactPayloadPreviews,
        defaultSettings.privacy.redactPayloadPreviews
      ),
      shareAnonymousTelemetry: coerceBoolean(
        privacy.shareAnonymousTelemetry,
        defaultSettings.privacy.shareAnonymousTelemetry
      ),
      warnOnExternalLinks: coerceBoolean(
        privacy.warnOnExternalLinks,
        defaultSettings.privacy.warnOnExternalLinks
      )
    },
    developer: {
      developerMode: coerceBoolean(developer.developerMode, defaultSettings.developer.developerMode),
      showRawIdentifiers: coerceBoolean(
        developer.showRawIdentifiers,
        defaultSettings.developer.showRawIdentifiers
      ),
      websocketDiagnostics: coerceBoolean(
        developer.websocketDiagnostics,
        defaultSettings.developer.websocketDiagnostics
      )
    }
  };
}

function getStorage(storage?: StorageLike | null) {
  if (storage) {
    return storage;
  }

  try {
    const browserGlobal = globalThis as typeof globalThis & {
      localStorage?: StorageLike;
    };
    return browserGlobal.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings(storage?: StorageLike | null): AppSettings {
  const resolvedStorage = getStorage(storage);
  if (!resolvedStorage) {
    return defaultSettings;
  }

  try {
    const raw = resolvedStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return defaultSettings;
    }

    return normalizeSettings(JSON.parse(raw));
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings, storage?: StorageLike | null) {
  const resolvedStorage = getStorage(storage);
  if (!resolvedStorage) {
    return;
  }

  try {
    resolvedStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage write failures so preferences never block app usage.
  }
}

export function resetStoredSettings(storage?: StorageLike | null) {
  const resolvedStorage = getStorage(storage);
  if (!resolvedStorage) {
    return;
  }

  try {
    resolvedStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch {
    // Ignore storage reset failures so the app can continue rendering.
  }
}

export function getSystemColorScheme(): SystemColorScheme {
  try {
    const browserGlobal = globalThis as typeof globalThis & {
      matchMedia?: (query: string) => { matches: boolean };
    };
    if (typeof browserGlobal.matchMedia !== "function") {
      return "light";
    }

    return browserGlobal.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemColorScheme: SystemColorScheme
): ResolvedTheme {
  if (preference === "system") {
    return systemColorScheme === "dark" ? "dark-mesh" : "light-mesh";
  }

  return preference;
}

export function isDarkTheme(theme: ResolvedTheme) {
  return theme === "dark-mesh" || theme === "midnight";
}

export function isValidRpcEndpoint(value: string) {
  if (!value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "ws:" || parsed.protocol === "wss:";
  } catch {
    return false;
  }
}

export function getEffectiveRpcEndpoint(settings: Pick<AppSettings, "rpcPreset" | "customRpcUrl">, fallback: string) {
  if (settings.rpcPreset === "custom") {
    return isValidRpcEndpoint(settings.customRpcUrl) ? settings.customRpcUrl.trim() : fallback;
  }

  const preset = RPC_PRESET_ENDPOINTS[settings.rpcPreset];
  return preset || fallback;
}
