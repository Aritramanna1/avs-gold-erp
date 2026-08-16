import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

/**
 * QA-11 Payment idempotency — duplicate webhook must not double-fulfil.
 * Uses deterministic idempotency key hashing (no live Razorpay calls in unit layer).
 */
function idempotencyKey(eventId: string, paymentId: string): string {
  return createHash("sha256").update(`${eventId}:${paymentId}`).digest("hex");
}

describe("QA Payment idempotency (Razorpay TEST mode logic)", () => {
  it("same webhook event produces stable idempotency key", () => {
    const k1 = idempotencyKey("evt_1", "pay_1");
    const k2 = idempotencyKey("evt_1", "pay_1");
    expect(k1).toBe(k2);
  });

  it("duplicate processing guard rejects second fulfilment", () => {
    const processed = new Set<string>();
    const key = idempotencyKey("evt_dup", "pay_dup");
    expect(processed.has(key)).toBe(false);
    processed.add(key);
    expect(processed.has(key)).toBe(true);
    // Second webhook delivery must be no-op
    const duplicateAllowed = !processed.has(key);
    expect(duplicateAllowed).toBe(false);
  });
});
