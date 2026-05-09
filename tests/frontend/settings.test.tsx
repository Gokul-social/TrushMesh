import { beforeEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  SETTINGS_STORAGE_KEY,
  defaultSettings,
  getEffectiveRpcEndpoint,
  getSystemColorScheme,
  loadSettings,
  resolveThemePreference,
  saveSettings
} from "../../src/lib/settings";
import { ThemeProvider } from "../../src/components/ThemeProvider";
import { Settings } from "../../src/pages/Settings";
import { useSettingsStore } from "../../src/stores/settingsStore";
import { getJwtFromLocalStorage } from "../../src/lib/utils";

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    }
  };
}

describe("settings helpers", () => {
  it("falls back safely when browser storage access throws", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

    try {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get() {
          throw new Error("blocked");
        }
      });

      expect(loadSettings()).toEqual(defaultSettings);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "localStorage");
      }
    }
  });

  it("reads JWT storage safely when localStorage is blocked", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

    try {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get() {
          throw new Error("blocked");
        }
      });

      expect(getJwtFromLocalStorage()).toBeNull();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "localStorage");
      }
    }
  });

  it("persists and restores user preferences", () => {
    const storage = createMemoryStorage();
    const nextSettings = {
      ...defaultSettings,
      themePreference: "midnight" as const,
      rpcPreset: "custom" as const,
      customRpcUrl: "https://rpc.trustmesh.example",
      pollingIntervalMs: 30_000
    };

    saveSettings(nextSettings, storage);

    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toContain("\"midnight\"");
    expect(loadSettings(storage)).toEqual(nextSettings);
  });

  it("resolves system theme and invalid custom rpc safely", () => {
    expect(resolveThemePreference("system", "dark")).toBe("dark-mesh");
    expect(getSystemColorScheme()).toBe("light");
    expect(
      getEffectiveRpcEndpoint(
        {
          rpcPreset: "custom",
          customRpcUrl: "not-a-url"
        },
        "https://fallback.rpc"
      )
    ).toBe("https://fallback.rpc");
  });
});

describe("Settings page", () => {
  beforeEach(() => {
    useSettingsStore.setState(defaultSettings);
  });

  it("renders the production settings dashboard sections", () => {
    const html = renderToString(
      <ThemeProvider>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(html).toContain("TrustMesh settings");
    expect(html).toContain("Appearance / Theme");
    expect(html).toContain("Network / RPC Settings");
    expect(html).toContain("Privacy &amp; Security");
    expect(html).toContain("Developer Options");
    expect(html).toContain("System Default");
  });
});
