import { create } from "zustand";
import {
  defaultSettings,
  loadSettings,
  resetStoredSettings,
  saveSettings,
  type AppSettings,
  type RpcPreset,
  type ThemePreference,
  type WalletPreference
} from "../lib/settings";

type SettingsStore = AppSettings & {
  setThemePreference: (themePreference: ThemePreference) => void;
  setWalletPreference: (walletPreference: WalletPreference) => void;
  setAutoConnectWallet: (autoConnectWallet: boolean) => void;
  setRpcPreset: (rpcPreset: RpcPreset) => void;
  setCustomRpcUrl: (customRpcUrl: string) => void;
  setPollingIntervalMs: (pollingIntervalMs: number) => void;
  setNotificationPreference: (
    key: keyof AppSettings["notifications"],
    value: boolean
  ) => void;
  setPrivacyPreference: (key: keyof AppSettings["privacy"], value: boolean) => void;
  setDeveloperPreference: (key: keyof AppSettings["developer"], value: boolean) => void;
  resetSettings: () => void;
};

const initialSettings = loadSettings();

function extractPersistedSettings(state: SettingsStore): AppSettings {
  return {
    themePreference: state.themePreference,
    walletPreference: state.walletPreference,
    autoConnectWallet: state.autoConnectWallet,
    rpcPreset: state.rpcPreset,
    customRpcUrl: state.customRpcUrl,
    pollingIntervalMs: state.pollingIntervalMs,
    notifications: state.notifications,
    privacy: state.privacy,
    developer: state.developer
  };
}

function persist(next: AppSettings) {
  saveSettings(next);
  return next;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...initialSettings,
  setThemePreference: (themePreference) =>
    set((state) => persist({ ...extractPersistedSettings(state), themePreference })),
  setWalletPreference: (walletPreference) =>
    set((state) => persist({ ...extractPersistedSettings(state), walletPreference })),
  setAutoConnectWallet: (autoConnectWallet) =>
    set((state) => persist({ ...extractPersistedSettings(state), autoConnectWallet })),
  setRpcPreset: (rpcPreset) =>
    set((state) => persist({ ...extractPersistedSettings(state), rpcPreset })),
  setCustomRpcUrl: (customRpcUrl) =>
    set((state) => persist({ ...extractPersistedSettings(state), customRpcUrl })),
  setPollingIntervalMs: (pollingIntervalMs) =>
    set((state) => persist({ ...extractPersistedSettings(state), pollingIntervalMs })),
  setNotificationPreference: (key, value) =>
    set((state) =>
      persist({
        ...extractPersistedSettings(state),
        notifications: {
          ...state.notifications,
          [key]: value
        }
      })
    ),
  setPrivacyPreference: (key, value) =>
    set((state) =>
      persist({
        ...extractPersistedSettings(state),
        privacy: {
          ...state.privacy,
          [key]: value
        }
      })
    ),
  setDeveloperPreference: (key, value) =>
    set((state) =>
      persist({
        ...extractPersistedSettings(state),
        developer: {
          ...state.developer,
          [key]: value
        }
      })
    ),
  resetSettings: () =>
    set(() => {
      resetStoredSettings();
      return defaultSettings;
    })
}));
