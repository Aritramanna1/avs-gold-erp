import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useAttachments, type AttachmentRecord } from "@/lib/attachments-store";
import { KYC_DOC_LABELS, type KycDocKey } from "@/lib/people-store";
import type { PortalType } from "@/lib/portal/portal-context-service";

export const PORTAL_KYC_DOC_KEYS: KycDocKey[] = [
  "photo",
  "aadhaar_front",
  "aadhaar_back",
  "pan",
  "address_proof",
  "signature",
];

export { KYC_DOC_LABELS };

function attachmentRowToRecord(rawData: Record<string, unknown>, row: {
  file_name?: string | null;
  storage_path?: string | null;
}): AttachmentRecord {
  return {
    filed: !!(rawData.filed ?? row.storage_path),
    note: String(rawData.note ?? ""),
    updatedAt: Number(rawData.updatedAt ?? Date.now()),
    fileName: row.file_name || (rawData.fileName as string | undefined),
    checksum: rawData.checksum as string | undefined,
    mimeType: rawData.mimeType as string | undefined,
    bucket: rawData.bucket as string | undefined,
    storagePath: row.storage_path || (rawData.storagePath as string | undefined),
    uploadedBy: rawData.uploadedBy as string | undefined,
    thumbnailDataUrl: rawData.thumbnailDataUrl as string | undefined,
  };
}

/** Hydrate KYC attachment metadata for the signed-in portal user's own party record. */
export async function pullPortalPartyAttachments(partyId: string): Promise<void> {
  if (!partyId) return;

  const { data, error } = await supabase
    .from("attachments")
    .select("id, file_name, storage_path, data")
    .eq("linked_table", "person")
    .eq("linked_id", partyId);

  if (error) {
    console.warn("[portal-kyc] attachment pull failed:", error.message);
    return;
  }

  const dict: Record<string, AttachmentRecord> = {};
  for (const row of data ?? []) {
    const rawData = (row.data as Record<string, unknown> | null) ?? {};
    dict[row.id] = attachmentRowToRecord(rawData, row);
  }

  if (Object.keys(dict).length === 0) return;

  useAttachments.setState((s) => ({
    items: { ...s.items, ...dict },
  }));
}

/** Sync the party KYC boolean flag after a successful R2 upload (ERP People KYC tab). */
export async function markPortalKycDoc(
  partyId: string,
  docKey: KycDocKey,
  filed: boolean,
): Promise<void> {
  const { error } = await (supabase as any).rpc("mark_my_portal_kyc_doc", {
    p_party_id: partyId,
    p_doc_key: docKey,
    p_filed: filed,
  });
  if (error) {
    console.warn("[portal-kyc] doc flag sync failed:", error.message);
  }
}

export function isPortalKycFiled(partyId: string, docKey: KycDocKey): boolean {
  const rec = useAttachments.getState().items[`person:${partyId}:${docKey}`];
  return !!(rec?.storagePath && rec?.bucket);
}

export type PortalKycPortalType = Extract<PortalType, "customer" | "karigar" | "supplier">;
