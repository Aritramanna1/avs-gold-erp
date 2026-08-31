/**
 * Platform Owner branding — load/save logo and company info for UI + PDF documents.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { Json } from "@/integrations/supabase/types";
import type { PlatformBranding } from "@/lib/platform-billing-pdf";

export type PlatformBrandingSettings = {
  appName: string;
  legalName: string;
  tagline: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  gstin: string;
  cin: string;
  logoPrimary: string | null;
  logoCompact: string | null;
  logoDocument: string | null;
};

const BRANDING_KEYS = [
  "branding.app_name",
  "branding.legal_name",
  "branding.tagline",
  "branding.address",
  "branding.email",
  "branding.phone",
  "branding.website",
  "branding.gstin",
  "branding.cin",
  "branding.logo_primary",
  "branding.logo_compact",
  "branding.logo_document",
  "billing.seller_name",
  "billing.seller_address",
  "billing.seller_gstin",
] as const;

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "url" in value) {
    return String((value as { url: string }).url);
  }
  return String(value);
}

export async function loadPlatformBrandingSettings(): Promise<PlatformBrandingSettings> {
  const { data } = await supabase
    .from("platform_settings")
    .select("key,value")
    .in("key", [...BRANDING_KEYS]);

  const m = new Map(
    ((data ?? []) as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]),
  );

  const sellerName = asString(m.get("billing.seller_name"));
  const appName = asString(m.get("branding.app_name"));

  return {
    appName: appName || sellerName || "AVS Gold ERP",
    legalName: asString(m.get("branding.legal_name")) || sellerName,
    tagline: asString(m.get("branding.tagline")),
    address: asString(m.get("branding.address")) || asString(m.get("billing.seller_address")),
    email: asString(m.get("branding.email")),
    phone: asString(m.get("branding.phone")),
    website: asString(m.get("branding.website")),
    gstin: asString(m.get("branding.gstin")) || asString(m.get("billing.seller_gstin")),
    cin: asString(m.get("branding.cin")),
    logoPrimary: asString(m.get("branding.logo_primary")) || null,
    logoCompact: asString(m.get("branding.logo_compact")) || null,
    logoDocument: asString(m.get("branding.logo_document")) || null,
  };
}

export async function savePlatformBrandingSettings(
  settings: Partial<PlatformBrandingSettings>,
): Promise<void> {
  const upserts: Array<{ key: string; value: unknown }> = [];
  const map: Record<string, keyof PlatformBrandingSettings> = {
    "branding.app_name": "appName",
    "branding.legal_name": "legalName",
    "branding.tagline": "tagline",
    "branding.address": "address",
    "branding.email": "email",
    "branding.phone": "phone",
    "branding.website": "website",
    "branding.gstin": "gstin",
    "branding.cin": "cin",
    "branding.logo_primary": "logoPrimary",
    "branding.logo_compact": "logoCompact",
    "branding.logo_document": "logoDocument",
  };

  for (const [key, field] of Object.entries(map)) {
    if (field in settings && settings[field] !== undefined) {
      upserts.push({ key, value: settings[field] });
    }
  }

  if (settings.legalName) {
    upserts.push({ key: "billing.seller_name", value: settings.legalName });
  }
  if (settings.address) {
    upserts.push({ key: "billing.seller_address", value: settings.address });
  }
  if (settings.gstin) {
    upserts.push({ key: "billing.seller_gstin", value: settings.gstin });
  }

  await Promise.all(
    upserts.map((row) =>
      supabase.from("platform_settings").upsert({
        key: row.key,
        value: row.value as Json,
      }),
    ),
  );
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

export async function urlToDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("[platform-branding] could not inline logo:", url, err);
    return null;
  }
}

export function brandingToPdfInput(settings: PlatformBrandingSettings): PlatformBranding {
  const logo = settings.logoDocument || settings.logoPrimary || settings.logoCompact || null;
  return {
    companyName: settings.legalName || settings.appName,
    legalName: settings.legalName,
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    website: settings.website,
    gstin: settings.gstin,
    logoDataUrl: logo,
  };
}

export async function brandingToPdfInputAsync(
  settings: PlatformBrandingSettings,
): Promise<PlatformBranding> {
  const base = brandingToPdfInput(settings);
  const logo = settings.logoDocument || settings.logoPrimary || settings.logoCompact || null;
  const logoDataUrl = await urlToDataUrl(logo);
  return { ...base, logoDataUrl };
}
