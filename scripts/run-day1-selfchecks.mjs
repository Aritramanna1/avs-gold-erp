function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function fineGoldMg(grossMg, purityPerMille) {
  return Math.round((grossMg * purityPerMille) / 1000);
}

assertEqual(fineGoldMg(100000, 916), 91600, "916 fine gold");
assertEqual(fineGoldMg(100000, 750), 75000, "750 fine gold");
assertEqual(fineGoldMg(12500, 999), 12488, "rounded fine gold");

console.log("[day1-selfchecks] OK");
