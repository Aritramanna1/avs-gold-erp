import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

describe("sharing / WhatsApp chain (static audit)", () => {
  it("send-whatsapp-document has deep-link fallback after API/share modes", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/comm/send-whatsapp-document.ts"), "utf8");
    expect(src).toContain("openWhatsAppDocumentDeepLink");
    expect(src).toContain('deliveryMode: "deep_link"');
  });

  it("document public access uses resolve_document_share RPC not storage URLs", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/document-shares.ts"), "utf8");
    expect(src).toContain("resolve_document_share");
    expect(src).not.toMatch(/getPublicUrl|storage\.from\(/);
  });

  it("portal KYC marks docs via RPC not direct people table writes", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/portal/portal-kyc-service.ts"), "utf8");
    expect(src).toContain("mark_my_portal_kyc_doc");
  });

  it("comm renderer does not embed Wasender/API secrets", () => {
    const paths = [
      "src/lib/comm/send-whatsapp-document.ts",
      "src/lib/comm/whatsapp-mode-router.ts",
      "src/lib/comm/send-whatsapp-text.ts",
    ];
    for (const rel of paths) {
      const full = resolve(ROOT, rel);
      expect(existsSync(full), rel).toBe(true);
      const src = readFileSync(full, "utf8");
      expect(src).not.toMatch(/WASENDER_API_KEY\s*=\s*["']/);
      expect(src).not.toMatch(/VITE_.*SECRET/);
    }
  });

  it("₹30k/₹50k commercial plans declare document_hosting feature", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/saas-entitlements.ts"), "utf8");
    expect(src).toContain('"business.document_hosting"');
  });
});
