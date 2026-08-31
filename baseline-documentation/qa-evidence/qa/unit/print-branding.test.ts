import { describe, expect, it } from "vitest";
import {
  shouldRenderAuthorizedSignature,
  shouldRenderPrintStamp,
  shouldRenderVerificationQr,
} from "@/lib/print-engine/print-branding";
import type { FirmProfile } from "@/lib/settings-store";

const baseFirm = {
  shopName: "Test",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  footerLine: "",
  terms: "",
  signatureLabelLeft: "",
  signatureLabelRight: "",
} satisfies FirmProfile;

describe("print branding gates", () => {
  it("never renders stamp without uploaded asset and tenant enable", () => {
    expect(shouldRenderPrintStamp(baseFirm, true)).toBe(false);
    expect(
      shouldRenderPrintStamp(
        { ...baseFirm, printStampEnabled: true, stampImageStoragePath: "print_assets/stamp.png" },
        true,
      ),
    ).toBe(true);
    expect(
      shouldRenderPrintStamp(
        { ...baseFirm, printStampEnabled: true, stampImageStoragePath: "print_assets/stamp.png" },
        false,
      ),
    ).toBe(false);
  });

  it("never renders authorized signature without tenant enable", () => {
    expect(shouldRenderAuthorizedSignature(baseFirm, true)).toBe(false);
    expect(
      shouldRenderAuthorizedSignature(
        {
          ...baseFirm,
          printSignatureEnabled: true,
          authorizedSignatureStoragePath: "print_assets/sig.png",
        },
        true,
      ),
    ).toBe(true);
  });

  it("keeps verification QR off unless tenant opts in", () => {
    expect(shouldRenderVerificationQr(baseFirm)).toBe(false);
    expect(shouldRenderVerificationQr({ ...baseFirm, printVerificationQrEnabled: true })).toBe(
      true,
    );
  });
});
