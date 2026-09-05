/**
 * AVS ERP — Cloudflare R2 Storage Client Service
 *
 * Centralized abstraction for tenant-isolated object storage:
 * - Direct upload to Hostinger R2 backend
 * - Presigned URL fetching with tenant boundary verification
 * - File size & MIME type validation
 * - Cross-tenant protection enforcement
 */

import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";

export interface StorageObjectMetadata {
  id: string;
  tenantId: string;
  objectKey: string;
  category: "designs" | "products" | "documents" | "invoices" | "inventory";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  isPrivate: boolean;
  uploadedBy: string;
  createdAt: string;
}

export interface UploadResult {
  success: boolean;
  objectKey?: string;
  filename?: string;
  sizeBytes?: number;
  downloadUrl?: string;
  error?: string;
}

export class R2StorageService {
  private defaultTenantId = "tenant_default";

  /**
   * Validate file size and MIME type before transmission.
   */
  public validateFile(file: File): { valid: boolean; error?: string } {
    const maxBytes = 25 * 1024 * 1024; // 25 MB
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (file.size > maxBytes) {
      return { valid: false, error: "File exceeds 25 MB size limit." };
    }

    if (!allowedMimes.includes(file.type)) {
      return { valid: false, error: `Unsupported file type: ${file.type}` };
    }

    return { valid: true };
  }

  /**
   * Upload file into the tenant's isolated R2 prefix.
   */
  public async upload(
    file: File,
    category: "designs" | "products" | "documents" | "invoices" | "inventory" = "documents",
    tenantId: string = this.defaultTenantId,
    uploadedBy = "admin@maatarajewellers.shop",
  ): Promise<UploadResult> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return { success: false, error: validation.error };
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tenant_id", tenantId);
      formData.append("category", category);
      formData.append("uploaded_by", uploadedBy);

      const resp = await fetch("/api/storage/r2.php?action=upload", {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(errText || `Upload error HTTP ${resp.status}`);
      }

      const data = await resp.json();
      toast.success(`Uploaded: ${file.name}`);
      return {
        success: true,
        objectKey: data.object_key,
        filename: data.filename,
        sizeBytes: data.size_bytes,
        downloadUrl: data.download_url,
      };
    } catch (err: any) {
      const msg = err?.message || "Storage upload failure";
      toast.error(msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Generate an authenticated temporary signed download URL.
   */
  public async getSignedUrl(
    objectKey: string,
    tenantId: string = this.defaultTenantId,
  ): Promise<string | null> {
    try {
      const resp = await fetch(
        `/api/storage/r2.php?action=download_url&tenant_id=${tenantId}&object_key=${encodeURIComponent(objectKey)}`,
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.signed_url || null;
    } catch {
      return null;
    }
  }

  /**
   * Delete an object from storage with tenant authorization check.
   */
  public async deleteObject(
    objectKey: string,
    tenantId: string = this.defaultTenantId,
  ): Promise<boolean> {
    try {
      const resp = await fetch("/api/storage/r2.php?action=delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          object_key: objectKey,
        }),
      });

      if (resp.ok) {
        toast.success("File deleted from vault");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * List all objects belonging strictly to the current tenant.
   */
  public async listTenantObjects(
    tenantId: string = this.defaultTenantId,
  ): Promise<StorageObjectMetadata[]> {
    try {
      const { data } = await (supabase as any)
        .from("storage_objects_registry")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (data) {
        return data.map((r: any) => ({
          id: r.id,
          tenantId: r.tenant_id,
          objectKey: r.object_key,
          category: r.category,
          filename: r.filename,
          mimeType: r.mime_type,
          sizeBytes: Number(r.size_bytes),
          isPrivate: r.is_private,
          uploadedBy: r.uploaded_by,
          createdAt: r.created_at,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }
}

export const r2Storage = new R2StorageService();
