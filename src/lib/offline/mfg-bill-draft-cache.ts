/**
 * Local manufacturing-bill drafts when next_document_number is unreachable.
 * Not a reserved legal number. Not a Gold Vault post.
 */
import { loadEncryptedJson, removeEncryptedJson, saveEncryptedJson } from "./storage";
import type { ManufacturingBill } from "@/lib/manufacturing-bill-store";

const keyFor = (jobId: string) => `mfg.bill.draft.${jobId}`;

/** True only after Supabase reserved a real MFG-… number. */
export function isReservedMfgBillNumber(billNo: string | undefined | null): boolean {
  const n = (billNo ?? "").trim();
  if (!n) return false;
  if (n.toUpperCase().startsWith("PENDING-")) return false;
  if (n.toUpperCase() === "DRAFT") return false;
  return n.startsWith("MFG-");
}

export async function saveLocalMfgBillDraft(jobId: string, bill: ManufacturingBill): Promise<void> {
  await saveEncryptedJson(keyFor(jobId), bill);
}

export async function loadLocalMfgBillDraft(jobId: string): Promise<ManufacturingBill | null> {
  return loadEncryptedJson<ManufacturingBill>(keyFor(jobId));
}

export async function clearLocalMfgBillDraft(jobId: string): Promise<void> {
  await removeEncryptedJson(keyFor(jobId));
}
