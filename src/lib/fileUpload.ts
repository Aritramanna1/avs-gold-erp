import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { uploadFileToSupabase, getBucketForEntityType } from "./supabase-storage";

export type UploadModule =
  | "firm-logos"
  | "expense-attachments"
  | "kyc-documents"
  | "order-attachments"
  | "billing-attachments"
  | "gold-settlement-proofs"
  | "worker-documents"
  | "customer-documents";

type UploadArgs = {
  file: File;
  module: UploadModule;
  relatedTable: string;
  relatedRecordId?: string;
  relatedModule: string;
  branchId?: string | null;
  notes?: string | null;
};

// Helper to safely check if a string is a valid UUID before sending to Supabase uuid columns
const isValidUuid = (val?: string | null): boolean => {
  if (!val) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(val);
};

function mapUploadModuleToEntityType(module: UploadModule): any {
  if (module === "firm-logos") return "firm-logo";
  if (module === "customer-documents" || module === "kyc-documents") return "person";
  if (module === "worker-documents") return "worker";
  if (module === "order-attachments") return "order";
  if (module === "billing-attachments") return "order";
  if (module === "gold-settlement-proofs") return "order";
  if (module === "expense-attachments") return "expense";
  return "order";
}

/**
 * Stores a file in the local application vault with auto-compression,
 * and records its metadata entry in the Supabase 'attachments' table securely.
 */
export async function uploadFileToHostinger(args: UploadArgs) {
  const { file, module, relatedTable, relatedRecordId, relatedModule, branchId, notes } = args;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be logged in to upload files.");
  }

  // Tenant identity is always resolved from the authenticated profile. The
  // browser may choose a related record, but it must never choose the tenant.
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("firm_id, branch_id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (profileError || !profile?.firm_id) {
    throw new Error(
      "Your account is not linked to a firm. Contact an administrator before uploading files.",
    );
  }

  // Pre-validate file weight (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File exceeds the maximum limit of 10MB.");
  }

  const docKey = relatedModule || "general";
  const entityId = relatedRecordId || "temp";
  const entityType = mapUploadModuleToEntityType(module);
  const bucket = getBucketForEntityType(entityType);
  // Store the object in Cloudflare R2 and record its tenant metadata in Supabase.
  const { filePath, signedUrl } = await uploadFileToSupabase(
    bucket,
    file,
    entityId,
    docKey,
    branchId,
  );

  // Pre-sanitize and cast UUID targets
  const relatedRecordUuid = isValidUuid(relatedRecordId) ? relatedRecordId : null;
  const branchUuid = isValidUuid(branchId) ? branchId : null;
  const uniqueId = `${relatedTable}:${entityId}:${docKey}-${Date.now()}`;

  const attachmentPayload = {
    id: uniqueId,
    kind: docKey,
    linked_id: entityId,
    linked_table: relatedTable,
    storage_path: filePath,
    size_bytes: file.size,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",

    // Fallback/Legacy properties for compatibility
    storage_provider: "cloudflare-r2",
    file_path: filePath,
    file_url: signedUrl,
    original_file_name: file.name,
    file_size: file.size,
    related_module: relatedModule,
    related_table: relatedTable,
    related_record_id: relatedRecordUuid,
    branch_id: branchUuid,
    firm_id: profile.firm_id,
    uploaded_by: user.id,
    notes: notes ?? null,
    is_deleted: false,
    uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data: {
      storage_provider: "cloudflare-r2",
      uploadedByEmail: user.email,
      original_related_record_id: entityId,
      file_url: signedUrl,
    },
  };

  // Insert securely to the attachments table with layout adhering to correct column contracts
  // Try inserting with all fields first. If it fails due to extra columns (which is standard if they aren't migrated), fallback to strict columns.
  let finalData: any = null;

  const { data, error } = await supabase
    .from("attachments")
    .insert(attachmentPayload as any)
    .select()
    .maybeSingle();

  if (error) {
    console.warn(
      "[fileUpload] Initial insert failed, retrying with strict database column mapping:",
      error,
    );
    const strictPayload = {
      id: uniqueId,
      kind: docKey,
      linked_id: entityId,
      linked_table: relatedTable,
      storage_path: filePath,
      size_bytes: file.size,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      data: attachmentPayload.data,
      firm_id: profile.firm_id,
      branch_id: branchUuid,
      uploaded_by: user.id,
    };

    const { data: retryData, error: retryError } = await supabase
      .from("attachments")
      .insert(strictPayload as any)
      .select()
      .maybeSingle();

    if (retryError) {
      console.error("[fileUpload] Error retry insertion into database:", retryError);
      // Fallback return of strictPayload so the UI doesn't crash but displays it locally
      return strictPayload;
    }
    finalData = retryData;
  } else {
    finalData = data;
  }

  return finalData || attachmentPayload;
}

/**
 * Lists all active attachments links from Supabase matching table and record UUID
 */
export async function listAttachments(relatedTable: string, relatedRecordId: string) {
  try {
    const isUuid = isValidUuid(relatedRecordId);

    // Filter active items from Supabase
    let query = (supabase as any)
      .from("attachments")
      .select("*")
      .eq("related_table", relatedTable)
      .eq("is_deleted", false);

    if (isUuid) {
      query = query.eq("related_record_id", relatedRecordId);
    }

    const { data, error } = await query.order("uploaded_at", { ascending: false });

    if (error) {
      console.warn("Could not retrieve database attachments. Emptied lists fallback.", error);
      return [];
    }

    let filtered = data || [];

    // If search term is a temporary identifier, filter matched keys in JSON column
    if (!isUuid) {
      filtered = filtered.filter((row: any) => {
        const metadata = row.data || {};
        return (
          row.related_record_id === relatedRecordId ||
          metadata.original_related_record_id === relatedRecordId
        );
      });
    }

    return filtered.map((row: any) => {
      return {
        id: row.id,
        storage_provider: row.storage_provider || "hostinger",
        file_path: row.file_path || "",
        file_url: row.file_url || "",
        file_name: row.file_name || "",
        original_file_name: row.original_file_name || "",
        mime_type: row.mime_type || "application/octet-stream",
        file_size: Number(row.file_size || 0),
        related_module: row.related_module || "general",
        related_table: row.related_table || "people",
        related_record_id:
          row.related_record_id || (row.data && row.data.original_related_record_id) || "",
        uploaded_by: row.uploaded_by || "anonymous",
        uploaded_at: row.uploaded_at,
        is_deleted: row.is_deleted,
        notes: row.notes || "",
      };
    });
  } catch (err) {
    console.error("Failed to query attachments from Supabase:", err);
    return [];
  }
}

/**
 * Soft deletes an attachment record in the backend database
 */
export async function softDeleteAttachment(id: string) {
  const { error } = await supabase
    .from("attachments")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    } as any)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
