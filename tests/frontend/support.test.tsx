import { beforeEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../src/components/ThemeProvider";
import {
  getDefaultSupportRequestValues,
  toggleAccordionItem,
  validateSupportRequest
} from "../../src/lib/support";
import { Support } from "../../src/pages/Support";
import { defaultSettings } from "../../src/lib/settings";
import { useSettingsStore } from "../../src/stores/settingsStore";

describe("Support page", () => {
  beforeEach(() => {
    useSettingsStore.setState(defaultSettings);
  });

  it("renders the TrustMesh support center", () => {
    const html = renderToString(
      <ThemeProvider>
        <MemoryRouter>
          <Support />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(html).toContain("Support &amp; Documentation");
    expect(html).toContain("Network operational");
    expect(html).toContain("TrustMesh operator docs");
    expect(html).toContain("Node Management");
    expect(html).toContain("Submit support request");
    expect(html).toContain("Current system status");
  });
});

describe("support helpers", () => {
  it("toggles faq items open and closed", () => {
    expect(toggleAccordionItem(null, "faq-wallet")).toBe("faq-wallet");
    expect(toggleAccordionItem("faq-wallet", "faq-wallet")).toBeNull();
    expect(toggleAccordionItem("faq-wallet", "faq-rpc")).toBe("faq-rpc");
  });

  it("validates support request fields and trims clean payloads", () => {
    const invalidRequest = validateSupportRequest({
      ...getDefaultSupportRequestValues(),
      name: "A",
      email: "not-an-email",
      description: "too short"
    });

    expect(invalidRequest.success).toBe(false);
    if (!invalidRequest.success) {
      expect(invalidRequest.errors.name?.[0]).toContain("primary operator name");
      expect(invalidRequest.errors.email?.[0]).toContain("valid email");
      expect(invalidRequest.errors.description?.[0]).toContain("Describe what happened");
    }

    const validRequest = validateSupportRequest({
      name: "  Ops Lead  ",
      email: "  operator@example.com  ",
      issueType: "rpc-network",
      priority: "p2",
      walletAddressOrNodeId: "  node-planner-44  ",
      description:
        "  Deployment activation is stalling after signature approval, and websocket updates stop for the affected planner node.  ",
      attachmentName: "  planner-log.txt  "
    });

    expect(validRequest.success).toBe(true);
    if (validRequest.success) {
      expect(validRequest.data.name).toBe("Ops Lead");
      expect(validRequest.data.email).toBe("operator@example.com");
      expect(validRequest.data.walletAddressOrNodeId).toBe("node-planner-44");
      expect(validRequest.data.attachmentName).toBe("planner-log.txt");
    }
  });
});
