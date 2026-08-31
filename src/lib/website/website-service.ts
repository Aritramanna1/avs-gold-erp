import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { FALLBACK_PUBLIC_PLANS } from "./fallback-pages";
import { DEFAULT_WEBSITE_BUNDLE } from "./defaults";
import {
  applyWebsiteMediaToSections,
  fetchActiveWebsiteMedia,
} from "./website-media";
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
    const [{ data, error }, media] = await Promise.all([
      supabase.rpc("get_public_website_bundle" as never),
      fetchActiveWebsiteMedia(),
    ]);
    if (error || !data) {
      return mergeMediaIntoBundle(DEFAULT_WEBSITE_BUNDLE, media);
    }
    const raw = data as PublicWebsiteBundle;
    const merged: PublicWebsiteBundle = {
      ...DEFAULT_WEBSITE_BUNDLE,
      ...raw,
      feature_flags: { ...DEFAULT_WEBSITE_BUNDLE.feature_flags, ...raw.feature_flags },
      contact: { ...DEFAULT_WEBSITE_BUNDLE.contact, ...raw.contact },
      social: { ...DEFAULT_WEBSITE_BUNDLE.social, ...raw.social },
      loader: { ...DEFAULT_WEBSITE_BUNDLE.loader, ...raw.loader },
      seo_default: { ...DEFAULT_WEBSITE_BUNDLE.seo_default, ...raw.seo_default },
      downloads: { ...DEFAULT_WEBSITE_BUNDLE.downloads, ...raw.downloads },
      pages:
        raw.pages && raw.pages.length > 0 ? raw.pages : DEFAULT_WEBSITE_BUNDLE.pages,
    };
    return mergeMediaIntoBundle(merged, media);
  } catch {
    return DEFAULT_WEBSITE_BUNDLE;
  }
}

function mergeMediaIntoBundle(
  bundle: PublicWebsiteBundle,
  media: Awaited<ReturnType<typeof fetchActiveWebsiteMedia>>,
): PublicWebsiteBundle {
  if (!media.length) return bundle;
  return {
    ...bundle,
    pages: bundle.pages.map((page) => ({
      ...page,
      sections: applyWebsiteMediaToSections(page.page_key, page.sections ?? [], media),
    })),
  };
}

export async function fetchPublicPricingPlans(): Promise<PublicPricingPlan[]> {
  try {
    const { data, error } = await supabase.rpc("get_public_pricing_plans" as never);
    if (error || !data) return FALLBACK_PUBLIC_PLANS;
    const plans = data as PublicPricingPlan[];
    return plans.length > 0 ? plans : FALLBACK_PUBLIC_PLANS;
  } catch {
    return FALLBACK_PUBLIC_PLANS;
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

export async function fetchAdminTutorials(): Promise<PublicTutorial[]> {
  const { data, error } = await supabase
    .from("public_website_tutorials" as never)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return [];
  return (data ?? []) as PublicTutorial[];
}

export type TutorialUpsert = {
  id?: string;
  slug: string;
  title: string;
  category?: string;
  description?: string;
  body_md?: string;
  video_url?: string | null;
  video_provider?: string;
  is_published?: boolean;
  sort_order?: number;
};

export async function upsertWebsiteTutorial(payload: TutorialUpsert): Promise<boolean> {
  const row = {
    ...(payload.id ? { id: payload.id } : {}),
    slug: payload.slug,
    title: payload.title,
    category: payload.category ?? "Getting started",
    description: payload.description ?? null,
    body_md: payload.body_md ?? null,
    video_url: payload.video_url ?? null,
    video_provider: payload.video_provider ?? "none",
    is_published: payload.is_published ?? false,
    sort_order: payload.sort_order ?? 0,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("public_website_tutorials" as never).upsert(row as never);
  return !error;
}

export async function deleteWebsiteTutorial(id: string): Promise<boolean> {
  const { error } = await supabase.from("public_website_tutorials" as never).delete().eq("id", id);
  return !error;
}

export async function fetchAdminBlogPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from("public_blog_posts" as never)
    .select(
      "id,slug,title,excerpt,body_md,cover_image_path,author_name,category,tags,seo_title,seo_description,status,published_at",
    )
    .order("updated_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as BlogPost[];
}

export type BlogUpsert = {
  id?: string;
  slug: string;
  title: string;
  excerpt?: string;
  body_md?: string;
  cover_image_path?: string | null;
  author_name?: string;
  category?: string;
  status?: "draft" | "published" | "archived" | "scheduled";
  published_at?: string | null;
};

export async function upsertWebsiteBlogPost(payload: BlogUpsert): Promise<boolean> {
  const status = payload.status ?? "draft";
  const publishedAt =
    status === "published"
      ? (payload.published_at ?? new Date().toISOString())
      : payload.published_at ?? null;
  const row = {
    ...(payload.id ? { id: payload.id } : {}),
    slug: payload.slug,
    title: payload.title,
    excerpt: payload.excerpt ?? null,
    body_md: payload.body_md ?? "",
    cover_image_path: payload.cover_image_path ?? null,
    author_name: payload.author_name ?? null,
    category: payload.category ?? null,
    status,
    published_at: publishedAt,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("public_blog_posts" as never).upsert(row as never);
  return !error;
}

export async function deleteWebsiteBlogPost(id: string): Promise<boolean> {
  const { error } = await supabase.from("public_blog_posts" as never).delete().eq("id", id);
  return !error;
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
