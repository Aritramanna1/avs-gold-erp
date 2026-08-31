function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function fineGoldMg(grossMg, purityPerMille, basis = 999) {
  if (purityPerMille >= basis || (basis === 1000 && purityPerMille >= 999)) return grossMg;
  return Math.round((grossMg * purityPerMille) / basis);
}

assertEqual(fineGoldMg(100000, 916), 91692, "916 fine gold (/999 basis)");
assertEqual(fineGoldMg(100000, 750), 75075, "750 fine gold (/999 basis)");
assertEqual(fineGoldMg(12500, 999), 12500, "999 fine gold at full fine");

console.log("[day1-selfchecks] OK");
