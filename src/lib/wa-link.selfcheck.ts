/**
 * Self-check for the WhatsApp link helpers.
 *
 * These are the shapes real workshop phone records actually come in — pasted
 * from a bill book, typed with a trunk zero, copied with a +91 and spaces. A
 * wrong normalisation here does not throw: it produces a wa.me link that opens
 * a chat with nobody, and the workshop believes the customer was messaged.
 *
 * Run: npx tsx src/lib/wa-link.selfcheck.ts
 */
import assert from "node:assert/strict";
import { cleanPhone, isValidWaPhone, waMobileUrl } from "./wa-link";

// Indian 10-digit mobile in every form a record might hold it.
assert.equal(cleanPhone("9876543210"), "919876543210");
assert.equal(cleanPhone("98765 43210"), "919876543210");
assert.equal(cleanPhone("+91 98765 43210"), "919876543210");
assert.equal(cleanPhone("+91-98765-43210"), "919876543210");
assert.equal(cleanPhone("919876543210"), "919876543210");
// Trunk zero and 00 international prefix.
assert.equal(cleanPhone("09876543210"), "919876543210");
assert.equal(cleanPhone("0091 98765 43210"), "919876543210");
// Empty / junk.
assert.equal(cleanPhone(""), "");
assert.equal(cleanPhone(null), "");
assert.equal(cleanPhone("n/a"), "");

// Validity: a bare national number is NOT enough — wa.me needs a country code.
assert.equal(isValidWaPhone("9876543210"), true); // normalises to 91…
assert.equal(isValidWaPhone("+91 98765 43210"), true);
assert.equal(isValidWaPhone("12345"), false); // too short
assert.equal(isValidWaPhone(""), false);
assert.equal(isValidWaPhone("22334455"), false); // landline, 8 digits

// The link itself: country code present, message percent-encoded.
const url = waMobileUrl("09876543210", "Order MTJ-1 is ready & waiting");
assert.equal(url, "https://wa.me/919876543210?text=Order%20MTJ-1%20is%20ready%20%26%20waiting");

console.log("wa-link self-check passed");
