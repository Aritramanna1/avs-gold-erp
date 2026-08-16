import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { DEFAULT_WEBSITE_BUNDLE } from "./defaults";
import type {
  BlogPost,
  LegalPage,
  PublicPricingPlan,
  PublicTutorial,
  PublicWebsiteBundle,
  ReleaseNote,
  WebsiteFeatureFlags,
} from "./types";

export async function fetchPublicWebsiteBundle(): Promise<PublicWebsiteBundle> {
  try {
    const { data, error } = await supabase.rpc("get_public_website_bundle" as never);
    if (error || !data) return DEFAULT_WEBSITE_BUNDLE;
    const raw = data as PublicWebsiteBundle;
    return {
      ...DEFAULT_WEBSITE_BUNDLE,
      ...raw,
      feature_flags: { ...DEFAULT_WEBSITE_BUNDLE.feature_flags, ...raw.feature_flags },
      contact: { ...DEFAULT_WEBSITE_BUNDLE.contact, ...raw.contact },
      social: { ...DEFAULT_WEBSITE_BUNDLE.social, ...raw.social },
      loader: { ...DEFAULT_WEBSITE_BUNDLE.loader, ...raw.loader },
      seo_default: { ...DEFAULT_WEBSITE_BUNDLE.seo_default, ...raw.seo_default },
      downloads: { ...DEFAULT_WEBSITE_BUNDLE.downloads, ...raw.downloads },
      pages: raw.pages ?? [],
    };
  } catch {
    return DEFAULT_WEBSITE_BUNDLE;
  }
}

export async function fetchPublicPricingPlans(): Promise<PublicPricingPlan[]> {
  try {
    const { data, error } = await supabase.rpc("get_public_pricing_plans" as never);
    if (error || !data) return [];
    return data as PublicPricingPlan[];
  } catch {
    return [];
  }
}

export async function fetchPublishedBlogPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from("public_blog_posts" as never)
    .select("*")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as BlogPost[];
}

export async function fetchBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from("public_blog_posts" as never)
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;
  return data as BlogPost;
}

export async function fetchPublishedTutorials(): Promise<PublicTutorial[]> {
  const { data, error } = await supabase
    .from("public_website_tutorials" as never)
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data ?? []) as PublicTutorial[];
}

export async function fetchPublishedReleaseNotes(): Promise<ReleaseNote[]> {
  const { data, error } = await supabase
    .from("public_release_notes" as never)
    .select("*")
    .eq("status", "published")
    .order("release_date", { ascending: false });
  if (error) return [];
  return (data ?? []) as ReleaseNote[];
}

export async function fetchLegalPage(slug: string): Promise<LegalPage | null> {
  const { data, error } = await supabase
    .from("public_legal_pages" as never)
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as LegalPage;
}

export type LeadSubmission = {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  city?: string;
  product_id?: string;
  interest?: string;
  message?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export async function submitWebsiteLead(
  payload: LeadSubmission,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase.rpc(
    "submit_website_lead" as never,
    {
      p_company_name: payload.company_name,
      p_contact_name: payload.contact_name,
      p_contact_email: payload.contact_email,
      p_contact_phone: payload.contact_phone ?? null,
      p_city: payload.city ?? null,
      p_product_id: payload.product_id ?? "ORNEXA",
      p_interest: payload.interest ?? "general",
      p_message: payload.message ?? null,
      p_source: payload.source ?? "website_contact",
      p_metadata: payload.metadata ?? {},
    } as never,
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data as string };
}

export async function updateWebsiteFeatureFlags(
  flags: Partial<WebsiteFeatureFlags>,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("platform_settings" as never)
    .select("value")
    .eq("key", "website.feature_flags")
    .maybeSingle();
  const current =
    (existing as { value?: WebsiteFeatureFlags } | null)?.value ??
    DEFAULT_WEBSITE_BUNDLE.feature_flags;
  const merged = { ...current, ...flags };
  const { error } = await supabase.from("platform_settings" as never).upsert({
    key: "website.feature_flags",
    value: merged,
    updated_at: new Date().toISOString(),
  } as never);
  return !error;
}

export async function updatePlatformSetting(key: string, value: unknown): Promise<boolean> {
  const { error } = await supabase.from("platform_settings" as never).upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  } as never);
  return !error;
}

export function getPageFromBundle(bundle: PublicWebsiteBundle, pageKey: string) {
  return bundle.pages.find((p) => p.page_key === pageKey) ?? null;
}

export function formatPriceMinor(minor: number | null | undefined): string | null {
  if (minor == null) return null;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}
