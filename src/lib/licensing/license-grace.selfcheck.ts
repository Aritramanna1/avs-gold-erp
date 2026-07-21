import assert from "node:assert/strict";
import { evaluateOffline, DAY_MS, type LicenseCache } from "./license-grace";

const now = 1_000 * DAY_MS;
const active = (over: Partial<LicenseCache> = {}): LicenseCache => ({
  status: "active",
  expiry: null,
  trialStartedAt: null,
  trialEndsAt: null,
  seats: 1,
  lastVerifiedAt: now,
  ...over,
});

assert.equal(evaluateOffline(null, 7, now), "expired");
assert.equal(evaluateOffline(active(), 7, now), "active");
assert.equal(evaluateOffline(active({ lastVerifiedAt: now - 8 * DAY_MS }), 7, now), "expired");
assert.equal(evaluateOffline(active({ expiry: now - 1 }), 7, now), "expired");
assert.equal(evaluateOffline({ ...active(), status: "suspended" }, 7, now), "suspended");
// Lifetime never expires and ignores the grace window.
assert.equal(
  evaluateOffline({ ...active(), status: "lifetime", lastVerifiedAt: now - 999 * DAY_MS }, 7, now),
  "lifetime",
);
assert.equal(
  evaluateOffline(
    { ...active(), status: "trial", trialStartedAt: now, trialEndsAt: now + DAY_MS },
    7,
    now,
  ),
  "trial",
);
assert.equal(
  evaluateOffline(
    { ...active(), status: "trial", trialStartedAt: now - DAY_MS, trialEndsAt: now - 1 },
    7,
    now,
  ),
  "expired",
);

console.log("license status self-check passed");
