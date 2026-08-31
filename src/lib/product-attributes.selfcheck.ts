/**
 * Self-check for category → product-attribute resolution.
 *
 * Categories are workshop-managed free text (Settings → Dropdowns), so this
 * matcher is the one thing standing between "Gents Ring" and a job card with no
 * ring size on it. A miss here is silent: the field simply never appears, and
 * the piece reaches the bench without the dimension it must be made to.
 *
 * Run: npx tsx src/lib/product-attributes.selfcheck.ts
 */
import assert from "node:assert/strict";
import { attributesForCategory, formatAttributes } from "./product-attributes";

const keys = (c: string) => attributesForCategory(c).map((a) => a.key);

// Exact master values.
assert.deepEqual(keys("Ring"), ["ringSize", "ringWidthMm"]);
assert.ok(keys("Chain").includes("chainLengthIn"));
assert.ok(keys("Bangle").includes("bangleSize"));
assert.ok(keys("Bracelet").includes("braceletLengthIn"));

// Case and punctuation the workshop actually types.
assert.deepEqual(keys("ring"), keys("Ring"));
assert.deepEqual(keys("RINGS"), keys("Ring"));
assert.deepEqual(keys("Nose Pin"), keys("nosepin"));

// A workshop's own naming still resolves to the right field set.
assert.ok(keys("Gents Ring").includes("ringSize"));
assert.ok(keys("Bridal Necklace Set").includes("necklaceLengthIn"));

// Longest match wins: mangalsutra must not be swallowed by a shorter key.
assert.ok(keys("Mangalsutra").includes("blackBeadType"));

// Unknown / empty categories are not an error — they simply have no extra fields.
assert.deepEqual(keys("Idol"), []);
assert.deepEqual(keys(""), []);
assert.deepEqual(attributesForCategory(null), []);
assert.deepEqual(attributesForCategory(undefined), []);

// Formatting for the job card: only filled-in fields, labelled.
assert.equal(formatAttributes("Ring", { ringSize: "14" }), "Ring Size: 14");
assert.equal(
  formatAttributes("Ring", { ringSize: "14", ringWidthMm: "3.5" }),
  "Ring Size: 14 · Band Width (mm): 3.5",
);
// A value for a key the category doesn't define is ignored, not printed.
assert.equal(formatAttributes("Ring", { chainLengthIn: "18" }), "");
assert.equal(formatAttributes("Ring", undefined), "");

console.log("product-attributes self-check passed");
