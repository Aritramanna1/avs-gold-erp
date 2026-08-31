/**
 * Outside Work custody helpers — pure classification for Gold Vault vs Material Vault.
 * Gold Vault remains SoT for fine-bearing metal; components never debit Gold Vault.
 */

export function isOutsideWorkFineBearingMaterial(materialType: string): boolean {
  const m = materialType.trim();
  return (
    m === "Gold" ||
    m === "Filings / Dust" ||
    m === "Filings" ||
    /filing|dust/i.test(m)
  );
}

export function isOutsideWorkComponentMaterial(materialType: string): boolean {
  return ["KDM", "Ball", "Wire", "Finding", "Chain"].includes(materialType.trim());
}

export function isOutsideWorkFinishedMaterial(materialType: string): boolean {
  return materialType.trim() === "Finished Product";
}

/** Gold Ledger bucket deltas for Outside Work issue. Components → empty (Material Vault only). */
export function outsideWorkIssueGoldLedgerDeltas(input: {
  materialType: string;
  fineMg: number;
}): { vault?: number; karigar?: number } {
  if (!isOutsideWorkFineBearingMaterial(input.materialType)) return {};
  if (input.fineMg <= 0) return {};
  return { vault: -input.fineMg, karigar: input.fineMg };
}

/** Gold Ledger bucket deltas for Outside Work receive. */
export function outsideWorkReceiveGoldLedgerDeltas(input: {
  materialType: string;
  fineMg: number;
}): { vault?: number; karigar?: number; finished?: number; scrap?: number } {
  const fine = Math.max(0, input.fineMg);
  if (isOutsideWorkFinishedMaterial(input.materialType)) {
    if (fine <= 0) return {};
    return { karigar: -fine, finished: fine };
  }
  if (isOutsideWorkFineBearingMaterial(input.materialType)) {
    if (fine <= 0) return {};
    return { karigar: -fine, vault: fine };
  }
  if (isOutsideWorkComponentMaterial(input.materialType)) {
    return {};
  }
  if (fine <= 0) return {};
  return { karigar: -fine, scrap: fine };
}

/** True when issue/receive should move Material Vault (components + filings forms). Gold bullion stays Gold Ledger only. */
export function outsideWorkShouldSyncMaterialVault(materialType: string): boolean {
  if (isOutsideWorkFinishedMaterial(materialType)) return false;
  if (isOutsideWorkFineBearingMaterial(materialType)) {
    // Filings/dust tracked in Material Vault forms; pure "Gold" is Gold Ledger only.
    return /filing|dust/i.test(materialType) || materialType === "Filings" || materialType === "Filings / Dust";
  }
  return true;
}
