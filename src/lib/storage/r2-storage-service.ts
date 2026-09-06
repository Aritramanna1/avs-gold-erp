/**
 * AVS ERP — Cloudflare R2 Storage Client Service (High Performance & Cached)
 *
 * Centralized abstraction for tenant-isolated object storage:
 * - High-speed in-memory URL caching (eliminates sequential worker roundtrips)
 * - Batch presigned URL resolution
 * - Client-side image compression & thumbnail optimization
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

interface CachedUrlEntry {
  url: string;
  expiresAt: number;
}

export class R2StorageService {
  private defaultTenantId = "tenant_default";
  // In-memory cache for signed URLs (50-minute TTL to stay safely within 1-hour signed URL expiry)
  private urlCache = new Map<string, CachedUrlEntry>();
  private readonly CACHE_TTL_MS = 50 * 60 * 1000;

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
   * Client-side image optimization: Downsample high-res camera photos before upload
   * to reduce bandwidth, worker latency, and storage footprint.
   */
  public async compressImage(file: File, maxWidth = 1920, maxHeight = 1920, quality = 0.82): Promise<File> {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      return file;
    }

    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), { type: "image/webp" }));
            } else {
              resolve(file);
            }
          },
          "image/webp",
          quality,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  }

  /**
   * Upload file into the tenant's isolated R2 prefix with automatic image optimization.
   */
  public async upload(
    file: File,
    category: "designs" | "products" | "documents" | "invoices" | "inventory" = "documents",
    tenantId: string = this.defaultTenantId,
    uploadedBy = "admin@maatarajewellers.shop",
  ): Promise<UploadResult> {
    const optimizedFile = await this.compressImage(file);
    const validation = this.validateFile(optimizedFile);
    if (!validation.valid) {
      toast.error(validation.error);
      return { success: false, error: validation.error };
    }

    try {
      const formData = new FormData();
      formData.append("file", optimizedFile);
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
      
      // Prime the client-side URL cache with the newly generated download URL
      if (data.object_key && data.download_url) {
        this.urlCache.set(`${tenantId}:${data.object_key}`, {
          url: data.download_url,
          expiresAt: Date.now() + this.CACHE_TTL_MS,
        });
      }

      toast.success(`Uploaded: ${optimizedFile.name}`);
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
   * Generate an authenticated temporary signed download URL (High-speed cached).
   */
  public async getSignedUrl(
    objectKey: string,
    tenantId: string = this.defaultTenantId,
  ): Promise<string | null> {
    if (!objectKey) return null;

    const cacheKey = `${tenantId}:${objectKey}`;
    const cached = this.urlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    try {
      const resp = await fetch(
        `/api/storage/r2.php?action=download_url&tenant_id=${tenantId}&object_key=${encodeURIComponent(objectKey)}`,
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      const signedUrl = data.signed_url || null;

      if (signedUrl) {
        this.urlCache.set(cacheKey, {
          url: signedUrl,
          expiresAt: Date.now() + this.CACHE_TTL_MS,
        });
      }

      return signedUrl;
    } catch {
      return null;
    }
  }

  /**
   * Batch resolver for multiple object keys (reduces N worker roundtrips).
   */
  public async getBatchSignedUrls(
    objectKeys: string[],
    tenantId: string = this.defaultTenantId,
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const missingKeys: string[] = [];

    // Check memory cache first
    for (const key of objectKeys) {
      const cacheKey = `${tenantId}:${key}`;
      const cached = this.urlCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        result[key] = cached.url;
      } else {
        missingKeys.push(key);
      }
    }

    // If all were cached, return immediately
    if (missingKeys.length === 0) return result;

    try {
      const resp = await fetch("/api/storage/r2.php?action=batch_download_urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          object_keys: missingKeys,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.urls) {
          const expiresAt = Date.now() + this.CACHE_TTL_MS;
          for (const [k, u] of Object.entries(data.urls)) {
            result[k] = u as string;
            this.urlCache.set(`${tenantId}:${k}`, { url: u as string, expiresAt });
          }
          return result;
        }
      }
    } catch {
      /* fallback to individual requests if batch fails */
    }

    // Fallback parallel resolution
    await Promise.all(
      missingKeys.map(async (key) => {
        const url = await this.getSignedUrl(key, tenantId);
        if (url) result[key] = url;
      }),
    );

    return result;
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
        this.urlCache.delete(`${tenantId}:${objectKey}`);
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
