import { useAttachments, type AttachmentEntityType } from "./attachments-store";
import { uploadFileToSupabase, getBucketForEntityType } from "./supabase-storage";

export type HostingerModule =
  | "firm-logos"
  | "catalog"
  | "order-attachments"
  | "repair-photos"
  | "expense-attachments"
  | "billing-attachments"
  | "kyc-documents"
  | "gold-settlement-proofs"
  | "worker-documents"
  | "customer-documents";

export interface FileAttachment {
  id: string;
  storage_provider: string;
  file_path: string;
  file_url: string;
  file_name: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  related_module: string;
  related_table: string;
  related_record_id: string;
  branch_id?: string | null;
  uploaded_by?: string;
  uploaded_at: string;
  is_deleted: boolean;
  deleted_at?: string | null;
  notes?: string | null;
}

export interface UploadResponse {
  status: "success" | "error";
  file_path: string;
  file_url: string;
  file_name: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  message?: string;
}

export function base64ToFile(dataUrl: string, fileName: string): File {
  const parts = dataUrl.split(";base64,");
  const mimeType = parts[0].split(":")[1] || "application/octet-stream";
  const characters = atob(parts[1]);
  const bytes = Uint8Array.from(characters, (character) => character.charCodeAt(0));
  return new File([bytes], fileName, { type: mimeType });
}

function moduleEntity(module: HostingerModule): AttachmentEntityType | "firm-logo" {
  if (module === "firm-logos") return "firm-logo";
  if (module === "customer-documents" || module === "kyc-documents") return "person";
  if (module === "worker-documents") return "worker";
  if (module === "catalog") return "catalog";
  if (module === "repair-photos") return "repair";
  if (module === "expense-attachments") return "expense";
  return "order";
}

function attachmentEntity(value: string): AttachmentEntityType {
  const accepted: AttachmentEntityType[] = [
    "person",
    "order",
    "catalog",
    "repair",
    "stock",
    "worker",
    "jobcard",
    "outside",
    "expense",
    "supplier",
  ];
  return accepted.includes(value as AttachmentEntityType)
    ? (value as AttachmentEntityType)
    : "order";
}

/** Compatibility API backed by Cloudflare R2 through the shared adapter. */
export async function uploadToHostinger(
  fileOrBase64: File | string,
  fileName: string,
  module: HostingerModule,
  recordId: string,
): Promise<UploadResponse> {
  const file =
    typeof fileOrBase64 === "string" ? base64ToFile(fileOrBase64, fileName) : fileOrBase64;
  if (file.size > 10 * 1024 * 1024) throw new Error("File exceeds the maximum limit of 10MB.");
  const namespace = getBucketForEntityType(moduleEntity(module));
  const { filePath, signedUrl } = await uploadFileToSupabase(namespace, file, recordId, module);
  return {
    status: "success",
    file_url: signedUrl,
    file_path: filePath,
    file_name: file.name,
    original_file_name: fileName,
    mime_type: file.type || "application/octet-stream",
    file_size: file.size,
  };
}

/** Stores attachment metadata through the shared Supabase-backed attachment store. */
export async function saveAttachmentMetadata(params: {
  filePath: string;
  fileUrl: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  relatedModule: HostingerModule;
  relatedTable: string;
  relatedRecordId: string;
  branchId?: string | null;
  notes?: string;
  docKey?: string;
  thumbnailDataUrl?: string;
  storageProvider?: string;
}): Promise<FileAttachment> {
  const entityType = attachmentEntity(params.relatedTable);
  const docKey = params.docKey || params.relatedModule;
  useAttachments.getState().save(entityType, params.relatedRecordId, docKey, {
    filed: true,
    note: params.notes || "",
    fileName: params.originalFileName || params.fileName,
    mimeType: params.mimeType,
    thumbnailDataUrl: params.thumbnailDataUrl,
    storagePath: params.filePath,
    bucket: getBucketForEntityType(moduleEntity(params.relatedModule)),
  });
  return {
    id: `${entityType}:${params.relatedRecordId}:${docKey}`,
    storage_provider: "cloudflare-r2",
    file_path: params.filePath,
    file_url: params.fileUrl,
    file_name: params.fileName,
    original_file_name: params.originalFileName,
    mime_type: params.mimeType,
    file_size: params.fileSize,
    related_module: params.relatedModule,
    related_table: entityType,
    related_record_id: params.relatedRecordId,
    branch_id: params.branchId,
    uploaded_at: new Date().toISOString(),
    is_deleted: false,
    notes: params.notes,
  };
}

export async function getAttachmentsForRecord(
  relatedModule: HostingerModule,
  relatedRecordId: string,
): Promise<FileAttachment[]> {
  const entityType = moduleEntity(relatedModule);
  if (entityType === "firm-logo") return [];
  return useAttachments
    .getState()
    .listForEntity(entityType, relatedRecordId)
    .map(({ docKey, rec }) => ({
      id: `${entityType}:${relatedRecordId}:${docKey}`,
      storage_provider: "cloudflare-r2",
      file_path: rec.storagePath || "",
      file_url: "",
      file_name: rec.fileName || "",
      original_file_name: rec.fileName || "",
      mime_type: rec.mimeType || "application/octet-stream",
      file_size: 0,
      related_module: relatedModule,
      related_table: entityType,
      related_record_id: relatedRecordId,
      uploaded_by: rec.uploadedBy,
      uploaded_at: new Date(rec.updatedAt).toISOString(),
      is_deleted: false,
      notes: rec.note,
    }));
}

export async function softDeleteAttachment(id: string): Promise<boolean> {
  const [entityType, entityId, ...docParts] = id.split(":");
  if (!entityType || !entityId || docParts.length === 0) return false;
  useAttachments.getState().clear(attachmentEntity(entityType), entityId, docParts.join(":"));
  return true;
}
