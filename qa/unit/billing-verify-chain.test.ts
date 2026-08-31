import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rowToInvoice } from "../../src/lib/billing-query";
import { computeInvoicePaymentSummary } from "../../src/lib/billing-store";
import {
  payloadFor,
  parsePayload,
  verifyPayload,
} from "../../src/lib/verify-token";
import {
  invoiceVerificationQrUrl,
  invoiceVerificationDocType,
  invoiceItemSummary,
} from "../../src/lib/document-verification";

const ROOT = resolve(import.meta.dirname, "../..");

describe("billing rowToInvoice legacy safety", () => {
  it("normalizes null/non-array items and payments to empty arrays", () => {
    const inv = rowToInvoice({
      id: "inv-1",
      invoice_no: "INV-001",
      customer_id: "c1",
      order_id: null,
      status: "posted",
      subtotal_paise: 10000,
      gst_paise: 0,
      grand_total_paise: 10000,
      paid_paise: 0,
      balance_paise: 10000,
      data: {
        items: null as unknown as undefined,
        payments: "not-an-array" as unknown as undefined,
        grandTotalPaise: 10000,
        verificationPublicToken: "pub_tok_abc",
        verificationAccessExpiresAt: 1_700_000_000_000,
        documentShareToken: "share_xyz",
      },
    });
    expect(inv).not.toBeNull();
    expect(inv!.items).toEqual([]);
    expect(inv!.payments).toEqual([]);
    expect(inv!.verificationPublicToken).toBe("pub_tok_abc");
    expect(inv!.documentShareToken).toBe("share_xyz");
    const summary = computeInvoicePaymentSummary(inv!);
    expect(summary.remainingBalancePaise).toBe(10000);
  });

  it("billing print prep module loads invoice and mints verification before print", () => {
    const src = readFileSync(resolve(ROOT, "src/lib/billing-print-prep.ts"), "utf8");
    expect(src).toContain("ensureBillingInvoiceForPrint");
    expect(src).toContain("ensureInvoiceVerification");
    const pdf = readFileSync(resolve(ROOT, "src/lib/native/document-output.ts"), "utf8");
    expect(pdf).toContain("ensureBillingInvoiceForPrint");
  });
});

describe("QR verification token lifecycle (local checksum path)", () => {
  const input = {
    docType: "gst_invoice" as const,
    docNumber: "G-100",
    recordId: "00000000-0000-0000-0000-000000000099",
    createdAt: "2026-08-01",
  };

  it("mints AVS payload and verification URL shape", () => {
    const payload = payloadFor(input);
    expect(payload).toMatch(/^AVS\|gst_invoice\|G-100\|/);
    const parsed = parsePayload(payload);
    expect(parsed?.docNumber).toBe("G-100");
  });

  it("checksum changes when document fields are tampered", () => {
    const payload = payloadFor(input);
    const alt = payloadFor({ ...input, docNumber: "G-999" });
    expect(payload).not.toBe(alt);
    const parsed = parsePayload(payload);
    const parsedAlt = parsePayload(alt);
    expect(parsed?.checksum).not.toBe(parsedAlt?.checksum);
  });

  it("rejects invalid token format", () => {
    const result = verifyPayload("not-a-valid-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("format");
  });

  it("builds public invoice verify URL from minted token", () => {
    const url = invoiceVerificationQrUrl("abc123token");
    expect(url).toMatch(/\/verify\/invoice\/abc123token$/);
  });

  it("classifies GST vs retail invoice doc types", () => {
    expect(invoiceVerificationDocType({ gst: "gst3" })).toBe("gst_invoice");
    expect(invoiceVerificationDocType({ gst: "none" })).toBe("retail_invoice");
  });

  it("summarizes invoice items for verification RPC", () => {
    const summary = invoiceItemSummary({
      items: [
        { itemName: "Ring", category: "Gold" },
        { itemName: "Chain", category: "Gold" },
        { itemName: "Bangle", category: "Gold" },
        { itemName: "Extra", category: "Gold" },
      ] as never,
    });
    expect(summary).toContain("4 item(s)");
    expect(summary).toContain("+1 more");
  });
});
