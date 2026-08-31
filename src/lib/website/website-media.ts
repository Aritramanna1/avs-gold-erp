/**
 * Public marketing website media — Platform Owner uploads that must work
 * without a tenant firm_id and must be readable by anonymous visitors.
 *
 * Strategy: compress aggressively and store a data-URL (or pasted https URL)
 * in `public_website_media.storage_path`. The public site merges slot media
 * into page sections at render time. Private firm-scoped R2 is not used.
 */
import { compressImage } from "@/lib/image-compression";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { WebsiteSection } from "@/lib/website/types";

const MAX_DATA_URL_CHARS = 480_000; // ~360KB binary — keeps RPC/bundle workable

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image for upload."));
    reader.readAsDataURL(blob);
  });
}

/** Convert a File into a publicly embeddable URL (data URL or reject). */
export async function fileToPublicWebsiteUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be uploaded as website screenshots.");
  }
  const { file: compressed } = await compressImage(file);
  let dataUrl = await blobToDataUrl(compressed);

  // Second pass: smaller canvas if still too large for DB embed.
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    const bitmap = await createImageBitmap(compressed);
    const scale = Math.sqrt(MAX_DATA_URL_CHARS / dataUrl.length) * 0.85;
    const w = Math.max(320, Math.round(bitmap.width * scale));
    const h = Math.max(240, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not compress screenshot further.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.65),
    );
    if (!blob) throw new Error("Screenshot compression failed.");
    dataUrl = await blobToDataUrl(blob);
  }

  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error(
      "Screenshot is still too large after compression. Crop it or paste a public image URL instead.",
    );
  }
  return dataUrl;
}

export function isPublicEmbeddableUrl(url: string): boolean {
  const u = url.trim();
  return (
    u.startsWith("data:image/") ||
    u.startsWith("https://") ||
    u.startsWith("http://") ||
    u.startsWith("/")
  );
}

export type WebsiteMediaRow = {
  id: string;
  page_key: string | null;
  slot_key: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
  is_active?: boolean;
};

export async function fetchActiveWebsiteMedia(): Promise<WebsiteMediaRow[]> {
  const { data, error } = await supabase
    .from("public_website_media" as never)
    .select("id,page_key,slot_key,storage_path,alt_text,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order");
  if (error) return [];
  return (data ?? []) as WebsiteMediaRow[];
}

/** Slot key for a feature_grid card screenshot: `feature:gold-vault`. */
export function featureMediaSlotKey(itemId: string): string {
  return `feature:${itemId}`;
}

export function slugifyFeatureItemId(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "feature"
  );
}

export async function insertWebsiteMedia(input: {
  pageKey: string;
  slotKey: string;
  publicUrl: string;
  altText?: string;
  sortOrder?: number;
}): Promise<WebsiteMediaRow> {
  if (!isPublicEmbeddableUrl(input.publicUrl)) {
    throw new Error("Media URL must be a public https path, site path, or embedded image.");
  }
  // Replace prior active media for the same page/slot so uploads always win.
  await supabase
    .from("public_website_media" as never)
    .update({ is_active: false } as never)
    .eq("page_key", input.pageKey)
    .eq("slot_key", input.slotKey)
    .eq("is_active", true);

  const { data, error } = await supabase
    .from("public_website_media" as never)
    .insert({
      page_key: input.pageKey,
      slot_key: input.slotKey,
      storage_path: input.publicUrl,
      alt_text: input.altText ?? null,
      sort_order: input.sortOrder ?? 0,
      is_active: true,
    } as never)
    .select("id,page_key,slot_key,storage_path,alt_text,sort_order")
    .single();
  if (error) throw new Error(error.message);
  return data as WebsiteMediaRow;
}

export async function deactivateWebsiteMedia(id: string): Promise<void> {
  const { error } = await supabase
    .from("public_website_media" as never)
    .update({ is_active: false } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Apply active media slots onto CMS sections (hero + feature_grid card images). */
export function applyWebsiteMediaToSections(
  pageKey: string,
  sections: WebsiteSection[],
  media: WebsiteMediaRow[],
): WebsiteSection[] {
  const forPage = media.filter((m) => m.page_key === pageKey && isPublicEmbeddableUrl(m.storage_path));
  if (forPage.length === 0) return sections;

  return sections.map((section) => {
    if (section.type === "hero") {
      const hero =
        forPage.find((m) => m.slot_key === "hero" || m.slot_key === section.id) ??
        forPage.find((m) => m.slot_key === "default");
      if (hero?.storage_path) {
        return { ...section, image_path: hero.storage_path };
      }
    }
    if (section.type === "feature_grid") {
      return {
        ...section,
        items: (section.items ?? []).map((item) => {
          const id = item.id?.trim() || slugifyFeatureItemId(item.title);
          const slot = featureMediaSlotKey(id);
          const row =
            forPage.find((m) => m.slot_key === slot) ??
            forPage.find((m) => m.slot_key === id);
          if (!row?.storage_path) return { ...item, id };
          return {
            ...item,
            id,
            image_path: row.storage_path,
            image_alt: row.alt_text ?? item.image_alt ?? item.title,
          };
        }),
      };
    }
    return section;
  });
}
