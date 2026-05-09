import { beforeEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  SETTINGS_STORAGE_KEY,
  defaultSettings,
  getEffectiveRpcEndpoint,
  loadSettings,
  resolveThemePreference,
  saveSettings
} from "../../src/lib/settings";
import { ThemeProvider } from "../../src/components/ThemeProvider";
import { Settings } from "../../src/pages/Settings";
import { useSettingsStore } from "../../src/stores/settingsStore";

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
