import { supabase } from "@/integrations/supabase/client";
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

/**
 * Converts a Base64 Data URL to a browser-compatible File object.
 */
export function base64ToFile(base64DataUrl: string, fileName: string): File {
  const parts = base64DataUrl.split(";base64,");
  const mimeType = parts[0].split(":")[1] || "application/octet-stream";
  const b64Data = parts[1];

  const byteCharacters = atob(b64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  return new File([blob], fileName, { type: mimeType });
}

function mapHostingerModuleToEntityType(module: HostingerModule): any {
  if (module === "firm-logos") return "firm-logo";
  if (module === "customer-documents" || module === "kyc-documents") return "person";
  if (module === "worker-documents") return "worker";
  if (
    module === "order-attachments" ||
    module === "billing-attachments" ||
    module === "gold-settlement-proofs" ||
    module === "catalog"
  ) {
    return "order";
  }
  if (module === "repair-photos") return "repair";
  if (module === "expense-attachments") return "expense";
  return "order";
}

/**
 * Sends a file directly to Supabase Storage as a replacement for the legacy PHP upload
 */
export async function uploadToHostinger(
  fileOrBase64: File | string,
  fileName: string,
  module: HostingerModule,
  recordId: string,
): Promise<UploadResponse> {
  let fileToUpload: File;

  if (typeof fileOrBase64 === "string") {
    if (fileOrBase64.startsWith("data:")) {
      fileToUpload = base64ToFile(fileOrBase64, fileName);
    } else {
      throw new Error("Invalid base64 string provided for upload.");
    }
  } else {
    fileToUpload = fileOrBase64;
  }

  // Double-check file size (10MB limit)
  if (fileToUpload.size > 10 * 1024 * 1024) {
    throw new Error("File exceeds the maximum limit of 10MB.");
  }

  const entityType = mapHostingerModuleToEntityType(module);
  const bucket = getBucketForEntityType(entityType);
  const docKey = module || "general";

  const { filePath, signedUrl } = await uploadFileToSupabase(
    bucket,
    fileToUpload,
    recordId,
    docKey,
  );

  return {
    status: "success",
    file_url: signedUrl,
    file_path: filePath,
    file_name: fileToUpload.name,
    original_file_name: fileName,
    mime_type: fileToUpload.type || "application/octet-stream",
    file_size: fileToUpload.size,
  } as UploadResponse;
}

// Helper to safely check if a string is a valid UUID before sending to Supabase uuid columns
const isValidUuid = (val?: string | null): boolean => {
  if (!val) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(val);
};

/**
 * Inserts the uploaded metadata record into Supabase `attachments` table
 */
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
}): Promise<any> {
  const currentUser = (await supabase.auth.getUser()).data.user;
  const uploadedBy = currentUser?.id || null;
  const docKey = params.docKey || params.relatedModule;
  const id = `${params.relatedTable}:${params.relatedRecordId}:${docKey}`;

  const relatedRecordUuid = isValidUuid(params.relatedRecordId) ? params.relatedRecordId : null;
  const branchUuid = isValidUuid(params.branchId) ? params.branchId : null;

  const provider = params.storageProvider || "supabase";

  // Hybrid payload matching BOTH the requested corrected table columns and older schemas for total bulletproof compatibility
  const attachmentData = {
    id,
    storage_provider: provider,
    file_path: params.filePath,
    storage_path: params.filePath, // fallback
    file_url: params.fileUrl,
    file_name: params.fileName,
    original_file_name: params.originalFileName || params.fileName,
    mime_type: params.mimeType,
    file_size: params.fileSize,
    size_bytes: params.fileSize, // fallback
    related_module: params.relatedModule,
    related_table: params.relatedTable,
    kind: docKey, // fallback, must not be null!
    related_record_id: relatedRecordUuid,
    linked_id: params.relatedRecordId, // fallback text/uuid
    linked_table: params.relatedTable, // fallback
    branch_id: branchUuid,
    uploaded_by: uploadedBy,
    uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_deleted: false,
    notes: params.notes || null,
    data: {
      filed: true,
      note: params.notes || "",
      updatedAt: Date.now(),
      fileName: params.originalFileName || params.fileName,
      fileDataUrl: params.fileUrl,
      thumbnailDataUrl: params.thumbnailDataUrl || null,
      storagePath: params.filePath,
      storage_provider: provider,
      uploadedByEmail: currentUser?.email || "anonymous",
      original_related_record_id: params.relatedRecordId,
    },
  };

  const { data, error } = await supabase
    .from("attachments")
    .upsert([attachmentData as any])
    .select();

  if (error) {
    console.warn(
      "[Attachment Metadata] Insert/Upsert error into attachments, retrying with raw fields:",
      error,
    );
    // If table column contracts fail, try pure raw field insert as a safety fallback, guaranteeing 'kind' is always set to bypass not-null
    const { data: retryData, error: retryError } = await supabase
      .from("attachments")
      .upsert([
        {
          id,
          kind: docKey,
          linked_id: params.relatedRecordId,
          linked_table: params.relatedTable,
          file_name: params.originalFileName || params.fileName,
          storage_path: params.filePath,
          mime_type: params.mimeType,
          size_bytes: params.fileSize,
          data: attachmentData.data,
        } as any,
      ])
      .select();

    if (retryError) {
      console.error("[Attachment Metadata] Critical retry failure:", retryError);
      throw new Error(`Failed to log attachment metadata: ${retryError.message}`);
    }
    return retryData ? retryData[0] : attachmentData;
  }

  return data ? data[0] : attachmentData;
}

/**
 * Fetches all file attachments for a specific module and record from Supabase metadata
 */
export async function getAttachmentsForRecord(
  relatedModule: HostingerModule,
  relatedRecordId: string,
): Promise<FileAttachment[]> {
  const isUuid = isValidUuid(relatedRecordId);

  let query = (supabase as any).from("attachments").select("*").eq("is_deleted", false);

  if (isUuid) {
    query = query.or(`related_record_id.eq.${relatedRecordId},linked_id.eq.${relatedRecordId}`);
  } else {
    query = query.eq("linked_id", relatedRecordId);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) {
    console.error("[Attachment Retrieval] Error fetching metadata from Supabase:", error);
    // Fallback to offline listing on store to prevent crashing
    return [];
  }

  return ((data || []) as any[]).map((row) => {
    const rawData = row.data as any;
    return {
      id: row.id,
      storage_provider: row.storage_provider || rawData?.storage_provider || "hostinger",
      file_path: row.file_path || row.storage_path || rawData?.storagePath || "",
      file_url: row.file_url || rawData?.fileDataUrl || "",
      file_name: row.file_name || rawData?.fileName || "",
      original_file_name: row.original_file_name || row.file_name || rawData?.fileName || "",
      mime_type: row.mime_type || rawData?.mimeType || "application/octet-stream",
      file_size: Number(row.file_size || row.size_bytes || rawData?.fileSize || 0),
      related_module: row.related_module || relatedModule,
      related_table: row.related_table || row.linked_table || "",
      related_record_id: row.related_record_id || row.linked_id || "",
      uploaded_by: row.uploaded_by || rawData?.uploadedBy || "anonymous",
      uploaded_at: row.uploaded_at || row.created_at || row.updated_at,
      is_deleted: row.is_deleted || false,
    };
  });
}

/**
 * Soft deletes a file attachment in Supabase metadata
 */
export async function softDeleteAttachment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("attachments")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    } as any)
    .eq("id", id);

  if (error) {
    console.warn(
      "[Attachment Deletion] Soft-delete in database failed, attempting fallback hard delete:",
      error,
    );
    // Fallback if soft delete columns are brand new and some rows are unmigrated
    const { error: fallbackError } = await supabase.from("attachments").delete().eq("id", id);
    if (fallbackError) {
      console.error("[Attachment Deletion] Critical hard-delete failed:", fallbackError);
      return false;
    }
  }

  return true;
}
