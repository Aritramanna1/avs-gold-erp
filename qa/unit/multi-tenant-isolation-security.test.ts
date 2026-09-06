import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  saveTenantIntegration,
  getTenantIntegration,
  disconnectTenantIntegration,
  resolveActiveCredentials,
  canTenantSendWhatsApp,
  isFlagshipMTJTenant,
  maskSecret,
} from "@/lib/tenant-integrations/tenant-integration-service";
import type {
  TenantAIConfig,
  TenantWhatsAppConfig,
  TenantEmailConfig,
} from "@/lib/tenant-integrations/tenant-integration-types";

// Polyfill localStorage for node/vitest environment
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};

describe("Multi-Tenant Credential Isolation & Security Test Suite", () => {
  beforeAll(() => {
    (globalThis as any).window = (globalThis as any).window || { localStorage: localStorageMock };
    (globalThis as any).localStorage = localStorageMock;
  });

  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("1. Strict Tenant-to-Tenant Credential Isolation", () => {
    it("isolates credentials between Tenant A and Tenant B", () => {
      const tenantA = "tenant-alpha-jewellers";
      const tenantB = "tenant-beta-goldsmiths";

      const configA: TenantAIConfig = {
        enabled: true,
        provider: "google_gemini",
        model: "gemini-1.5-pro",
        apiKey: "AIzaSy_TenantA_Key_12345",
        temperature: 0.2,
        monthlyTokenQuota: 500000,
        tokensUsedThisMonth: 1000,
      };

      const configB: TenantAIConfig = {
        enabled: true,
        provider: "openai",
        model: "gpt-4o",
        apiKey: "sk-TenantB_OpenAI_Key_67890",
        temperature: 0.5,
        monthlyTokenQuota: 1000000,
        tokensUsedThisMonth: 2500,
      };

      saveTenantIntegration(tenantA, "ai", configA);
      saveTenantIntegration(tenantB, "ai", configB);

      // Verify Tenant A gets only Tenant A's config
      const resA = getTenantIntegration<TenantAIConfig>(tenantA, "ai");
      expect(resA).not.toBeNull();
      expect(resA?.tenantId).toBe(tenantA);
      expect(resA?.config.apiKey).toBe("AIzaSy_TenantA_Key_12345");
      expect(resA?.config.provider).toBe("google_gemini");

      // Verify Tenant B gets only Tenant B's config
      const resB = getTenantIntegration<TenantAIConfig>(tenantB, "ai");
      expect(resB).not.toBeNull();
      expect(resB?.tenantId).toBe(tenantB);
      expect(resB?.config.apiKey).toBe("sk-TenantB_OpenAI_Key_67890");
      expect(resB?.config.provider).toBe("openai");

      // Verify Tenant A cannot access Tenant B's credentials
      expect(resA?.config.apiKey).not.toBe(resB?.config.apiKey);
    });

    it("ensures unconfigured tenants receive NOT CONFIGURED status with no silent fallbacks", () => {
      const unconfiguredTenant = "tenant-gamma-retailers";

      const res = resolveActiveCredentials(unconfiguredTenant, "ai");
      expect(res.isConfigured).toBe(false);
      expect(res.credentials).toBeNull();
      expect(res.isFlagshipException).toBe(false);

      const whatsAppRes = canTenantSendWhatsApp(unconfiguredTenant);
      expect(whatsAppRes.allowed).toBe(false);
      expect(whatsAppRes.reason).toContain("not configured");
    });
  });

  describe("2. Controlled MTJ Flagship Exception", () => {
    it("correctly identifies MTJ Flagship identity server-side", () => {
      expect(isFlagshipMTJTenant("mtj-flagship-001")).toBe(true);
      expect(isFlagshipMTJTenant("tenant-mtj")).toBe(true);
      expect(isFlagshipMTJTenant("random-tenant-123")).toBe(false);
      expect(isFlagshipMTJTenant(null)).toBe(false);
    });

    it("allows only MTJ tenant to use designated centralized platform credentials", () => {
      const mtjTenant = "mtj-flagship-001";
      const normalTenant = "tenant-xyz";

      // MTJ resolves centralized platform credentials
      const mtjAI = resolveActiveCredentials(mtjTenant, "ai");
      expect(mtjAI.isConfigured).toBe(true);
      expect(mtjAI.isFlagshipException).toBe(true);
      expect(mtjAI.credentials).not.toBeNull();

      // Normal tenant does NOT inherit MTJ credentials
      const normalAI = resolveActiveCredentials(normalTenant, "ai");
      expect(normalAI.isConfigured).toBe(false);
      expect(normalAI.isFlagshipException).toBe(false);
      expect(normalAI.credentials).toBeNull();
    });

    it("allows MTJ to send WhatsApp via flagship platform authorization", () => {
      const mtjTenant = "mtj-flagship-001";
      const res = canTenantSendWhatsApp(mtjTenant);
      expect(res.allowed).toBe(true);
    });
  });

  describe("3. Chargeable WhatsApp Entitlements & Governance", () => {
    it("enforces monthly message quota for tenant plans", () => {
      const tenant = "tenant-delta-jewels";
      const config: TenantWhatsAppConfig = {
        enabled: true,
        provider: "wasender",
        isChargeableActive: true,
        planTier: "starter",
        monthlyMessageLimit: 500,
        messagesSentThisMonth: 500, // Quota exhausted
        billingStatus: "paid",
      };

      saveTenantIntegration(tenant, "whatsapp", config);

      const check = canTenantSendWhatsApp(tenant);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain("quota exceeded");
    });

    it("blocks WhatsApp when subscription is overdue", () => {
      const tenant = "tenant-epsilon";
      const config: TenantWhatsAppConfig = {
        enabled: true,
        provider: "wasender",
        isChargeableActive: true,
        planTier: "growth",
        monthlyMessageLimit: 2000,
        messagesSentThisMonth: 100,
        billingStatus: "overdue", // Overdue billing
      };

      saveTenantIntegration(tenant, "whatsapp", config);

      const check = canTenantSendWhatsApp(tenant);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain("overdue");
    });
  });

  describe("4. Secret Masking & Safe Display", () => {
    it("masks secrets securely for UI presentation", () => {
      const secret = "AIzaSyB1234567890abcdefXYZ";
      const masked = maskSecret(secret);
      expect(masked).toBe("AIz••••••••fXYZ");
      expect(masked).not.toContain("1234567890abcdef");

      expect(maskSecret("")).toBe("");
      expect(maskSecret(null)).toBe("");
      expect(maskSecret("short")).toBe("••••••••");
    });
  });
});
