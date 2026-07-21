/**
 * Self-check for the Daily Material Slip number format.
 *
 * The slip number is printed on the paper handed to the worker and stamped on
 * every ledger row that traces back to it. A malformed number silently breaks
 * that trace: staff cannot find the slip a Manufacturing Book entry came from.
 *
 * Run: npx tsx src/lib/daily-material-slip.selfcheck.ts
 */
import assert from "node:assert/strict";
import { dailySlipNumber, slipNumberForEntry } from "./daily-material-slip-number";

// MTS-YYYYMMDD-NNN, dashes stripped from the date, 3-digit zero-padded sequence.
assert.equal(dailySlipNumber("2026-07-17"), "MTS-20260717-001");
assert.equal(dailySlipNumber("2026-07-17", 2), "MTS-20260717-002");
assert.equal(dailySlipNumber("2026-12-01", 12), "MTS-20261201-012");

// An entry maps to its day's slip regardless of time-of-day.
assert.equal(slipNumberForEntry({ date: "2026-07-17" }), "MTS-20260717-001");

console.log("daily-material-slip self-check passed");
