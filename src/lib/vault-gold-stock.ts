/**
 * Vault / scrap gold purity lines from the gold ledger (not material vault / KDM).
 * Stock is aggregated by purity per bucket — repeated deposits at 916‰ show one 916 line.
 */
import { computeBalances, type Bucket, type LedgerEntry } from "@/lib/ledger-store";
import { mgToGrams } from "@/lib/gold";
import { allowNegativeStock, requireVaultStockLine } from "@/lib/invoice-due";

export type VaultGoldPurityLine = {
  id: string;
  bucket: Extract<Bucket, "vault" | "scrap">;
  purity: number;
  touchPct: number;
  availableFineMg: number;
  availableGrossMg: number;
  location: string;
};

/** Karigar book materials that move weighed gold (vault purity applies). */
export const GOLD_WEIGHT_MATERIALS = new Set([
  "Gold",
  "Item / Ornaments",
  "Filings / Dust",
  "returned gold",
]);

export function isGoldWeightMaterial(particulars: string): boolean {
  return GOLD_WEIGHT_MATERIALS.has(particulars.trim());
}

export function buildVaultGoldPurityLines(entries: LedgerEntry[]): VaultGoldPurityLine[] {
  const balances = computeBalances(entries);
  const lines: VaultGoldPurityLine[] = [];
  const targets: Array<{ bucket: "vault" | "scrap"; location: string }> = [
    { bucket: "vault", location: "Gold Vault" },
    { bucket: "scrap", location: "Scrap / Filings" },
  ];
  for (const t of targets) {
    const purities = balances.bucketBreakdowns[t.bucket]?.purities ?? {};
    for (const row of Object.values(purities)) {
      const fineMg = Math.round(row.fineMg);
      const grossMg = Math.round(row.grossMg);
      if (fineMg <= 0 && grossMg <= 0) continue;
      const purity = Math.round(row.purity);
      lines.push({
        id: `${t.bucket}:${purity}`,
        bucket: t.bucket,
        purity,
        touchPct: Math.round((purity / 10) * 1000) / 1000,
        availableFineMg: Math.max(fineMg, 0),
        availableGrossMg: Math.max(grossMg, fineMg, 0),
        location: t.location,
      });
    }
  }
  return lines.sort((a, b) => b.availableFineMg - a.availableFineMg);
}

export function vaultGoldPurityOptions(entries: LedgerEntry[]): VaultGoldPurityLine[] {
  return vaultGoldPurityOptionsForIssue(entries);
}

/** One aggregated line per purity in Gold Vault — for karigar issue, customer issue, etc. */
export function vaultGoldPurityOptionsForIssue(entries: LedgerEntry[]): VaultGoldPurityLine[] {
  const balances = computeBalances(entries);
  const purities = balances.bucketBreakdowns.vault?.purities ?? {};
  const lines: VaultGoldPurityLine[] = [];
  for (const row of Object.values(purities)) {
    const fineMg = Math.round(row.fineMg);
    const grossMg = Math.round(row.grossMg);
    if (fineMg <= 0 && grossMg <= 0) continue;
    const purity = Math.round(row.purity);
    lines.push({
      id: `vault:${purity}`,
      bucket: "vault",
      purity,
      touchPct: Math.round((purity / 10) * 1000) / 1000,
      availableFineMg: Math.max(fineMg, 0),
      availableGrossMg: Math.max(grossMg, fineMg, 0),
      location: "Gold Vault",
    });
  }
  return lines.sort((a, b) => b.purity - a.purity);
}

export function formatVaultGoldStockLabel(line: VaultGoldPurityLine): string {
  const touch = Number.isInteger(line.touchPct) ? String(line.touchPct) : line.touchPct.toFixed(1);
  return `${line.purity}‰ / ${touch}% — ${mgToGrams(line.availableGrossMg)} g gross (${mgToGrams(line.availableFineMg)} g fine)`;
}

export function findVaultGoldStockLine(
  entries: LedgerEntry[],
  purityPermille: number,
  bucket: Extract<Bucket, "vault" | "scrap"> = "vault",
): VaultGoldPurityLine | undefined {
  return buildVaultGoldPurityLines(entries).find(
    (l) => l.bucket === bucket && l.purity === Math.round(purityPermille),
  );
}

/** Fail closed when issuing/deducting gold without enough stock at the chosen purity. */
export function assertVaultGoldIssueAvailable(input: {
  entries: LedgerEntry[];
  purityPermille: number;
  fineMg: number;
  grossMg?: number;
  bucket?: Extract<Bucket, "vault" | "scrap">;
}): VaultGoldPurityLine {
  const bucket = input.bucket ?? "vault";
  const purity = Math.round(input.purityPermille);
  const line = findVaultGoldStockLine(input.entries, purity, bucket);

  if (allowNegativeStock()) {
    return (
      line ?? {
        id: `${bucket}:${purity}`,
        bucket,
        purity,
        touchPct: Math.round((purity / 10) * 1000) / 1000,
        availableFineMg: 0,
        availableGrossMg: 0,
        location: bucket === "vault" ? "Gold Vault" : "Scrap / Filings",
      }
    );
  }

  if (!requireVaultStockLine()) {
    return (
      line ?? {
        id: `${bucket}:${purity}`,
        bucket,
        purity,
        touchPct: Math.round((purity / 10) * 1000) / 1000,
        availableFineMg: 0,
        availableGrossMg: 0,
        location: bucket === "vault" ? "Gold Vault" : "Scrap / Filings",
      }
    );
  }

  if (!line) {
    throw new Error(
      `No ${Math.round(input.purityPermille)}‰ gold in ${bucket === "vault" ? "Gold Vault" : "Scrap"}. Post opening gold or choose another purity.`,
    );
  }
  if (input.fineMg > line.availableFineMg) {
    throw new Error(
      `Insufficient ${line.purity}‰ vault stock. Need ${mgToGrams(input.fineMg)} g fine; available ${mgToGrams(line.availableFineMg)} g.`,
    );
  }
  if (input.grossMg != null && input.grossMg > 0 && input.grossMg > line.availableGrossMg) {
    throw new Error(
      `Insufficient ${line.purity}‰ vault gross. Need ${mgToGrams(input.grossMg)} g; available ${mgToGrams(line.availableGrossMg)} g.`,
    );
  }
  return line;
}
