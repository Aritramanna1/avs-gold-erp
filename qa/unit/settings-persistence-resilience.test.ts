import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useSettings,
  loadInitialCachedSettings,
  persistAndFlushSettings,
} from "@/lib/settings-store";
import { updateFirmProfile, getFirmProfile } from "@/lib/supabase-services";

describe("Settings Persistence & Resilience", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
    (globalThis as any).window = {
      localStorage: storageMock,
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  it("caches firm settings locally on update and recovers on reload", () => {
    useSettings.getState().setFirm({
      shopName: "AVS Jewels Enterprise",
      gstin: "27AAAAA1111A1Z1",
      cityState: "Ichalkaranji, Maharashtra",
      phone: "9822000000",
      email: "info@avsjewels.com",
    });

    const cached = mockStorage["avs_firm_app_settings_cache"];
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached!);
    expect(parsed.firm.shopName).toBe("AVS Jewels Enterprise");
    expect(parsed.firm.gstin).toBe("27AAAAA1111A1Z1");

    // Test loadInitialCachedSettings rehydration
    const rehydrated = loadInitialCachedSettings(useSettings.getState());
    expect(rehydrated.firm.shopName).toBe("AVS Jewels Enterprise");
    expect(rehydrated.firm.cityState).toBe("Ichalkaranji, Maharashtra");
  });

  it("updates firm profile via supabase-services updateFirmProfile cleanly", async () => {
    const success = await updateFirmProfile({
      shopName: "Gold Craft Works",
      phone: "9822112233",
      email: "craft@goldworks.in",
      address: "123 Market Street",
      gstin: "27AAAAA1111A1Z1",
      footerLine: "Custom Footer",
      terms: "Standard terms",
      signatureLabelLeft: "Customer Sign",
      signatureLabelRight: "Manager Sign",
    });

    expect(success).toBe(true);
    expect(useSettings.getState().firm.shopName).toBe("Gold Craft Works");
    const retrieved = await getFirmProfile();
    expect(retrieved?.shopName).toBe("Gold Craft Works");
  });

  it("flushes persistence cleanly without dropping updates", async () => {
    useSettings.getState().setGst({
      enabled: true,
      splitMode: "cgst_sgst",
      gstRatePct: 3,
      cgstPct: 1.5,
      sgstPct: 1.5,
    });

    const result = await persistAndFlushSettings(true);
    expect(result.ok).toBe(true);
    expect(useSettings.getState().gst.gstRatePct).toBe(3);
  });
});
