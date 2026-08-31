/**
 * Admin CRUD for public_website_pages — Platform Owner CMS.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { WebsitePage, WebsiteSection } from "@/lib/website/types";
import {
  ABOUT_FALLBACK_SECTIONS,
  FAQ_FALLBACK_SECTIONS,
  FEATURE_FALLBACK_SECTIONS,
  HOME_FALLBACK_SECTIONS,
  MANUFACTURING_FALLBACK_SECTIONS,
  WHOLESALE_FALLBACK_SECTIONS,
} from "@/lib/website/fallback-pages";

export type AdminWebsitePage = WebsitePage & {
  is_published?: boolean;
  id?: string;
};

const PAGE_SEEDS: Array<{
  page_key: string;
  title: string;
  sections: WebsiteSection[];
  seo: WebsitePage["seo"];
}> = [
  {
    page_key: "home",
    title: "Home",
    sections: HOME_FALLBACK_SECTIONS,
    seo: {
      title: "AVS ERP — Jewellery Manufacturing ERP",
      description:
        "Manufacturing-first jewellery ERP. Gold Vault custody, karigar management, GST documents, and portals.",
    },
  },
  {
    page_key: "features",
    title: "Features",
    sections: FEATURE_FALLBACK_SECTIONS,
    seo: { title: "Features · AVS ERP", description: "Core modules in AVS ERP jewellery ERP." },
  },
  {
    page_key: "manufacturing",
    title: "Manufacturing",
    sections: MANUFACTURING_FALLBACK_SECTIONS,
    seo: {
      title: "Manufacturing · AVS ERP",
      description: "Factory operations for jewellery manufacturers.",
    },
  },
  {
    page_key: "wholesale",
    title: "Wholesale",
    sections: WHOLESALE_FALLBACK_SECTIONS,
    seo: { title: "Wholesale · AVS ERP", description: "Wholesale jewellery operations." },
  },
  {
    page_key: "about",
    title: "About",
    sections: ABOUT_FALLBACK_SECTIONS,
    seo: { title: "About · AVS ERP", description: "About AVS ERP and Arivahly Venture Sphere." },
  },
  {
    page_key: "faq",
    title: "FAQ",
    sections: FAQ_FALLBACK_SECTIONS,
    seo: { title: "FAQ · AVS ERP", description: "Frequently asked questions." },
  },
];

export async function fetchAdminWebsitePages(): Promise<AdminWebsitePage[]> {
  const { data, error } = await supabase
    .from("public_website_pages" as never)
    .select("page_key,title,sections,seo,is_published")
    .order("page_key");
  if (error) return [];
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    page_key: String(row.page_key),
    title: String(row.title ?? row.page_key),
    sections: (row.sections as WebsiteSection[]) ?? [],
    seo: (row.seo as WebsitePage["seo"]) ?? {},
    is_published: row.is_published !== false,
  }));
}

/** Seed missing pages from code fallbacks so the CMS is immediately editable. */
export async function ensureWebsitePagesSeeded(): Promise<void> {
  const existing = await fetchAdminWebsitePages();
  const have = new Set(existing.map((p) => p.page_key));
  for (const seed of PAGE_SEEDS) {
    if (have.has(seed.page_key)) continue;
    await supabase.from("public_website_pages" as never).upsert(
      {
        page_key: seed.page_key,
        title: seed.title,
        sections: seed.sections,
        seo: seed.seo,
        is_published: true,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "page_key" } as never,
    );
  }
  await ensureFeaturesPageScreenshotPlaceholders();
}

/**
 * If the Features page still has old text-only cards (no item ids),
 * replace with the screenshot-ready module template (Gold Vault, Dashboard, …).
 */
export async function ensureFeaturesPageScreenshotPlaceholders(): Promise<void> {
  const pages = await fetchAdminWebsitePages();
  const features = pages.find((p) => p.page_key === "features");
  if (!features) return;
  const grids = (features.sections ?? []).filter((s) => s.type === "feature_grid");
  const needsUpgrade = grids.some(
    (s) =>
      s.type === "feature_grid" &&
      (!(s.items?.length) || s.items.some((item) => !item.id?.trim())),
  );
  if (!needsUpgrade) return;
  await upsertWebsitePage({
    page_key: "features",
    title: features.title || "Features",
    sections: FEATURE_FALLBACK_SECTIONS,
    seo: features.seo ?? {
      title: "Features · AVS ERP",
      description: "Core modules in AVS ERP jewellery ERP.",
    },
    is_published: features.is_published !== false,
  });
}

/** Force-refresh Features modules to the latest placeholder template. */
export async function resetFeaturesPagePlaceholders(): Promise<boolean> {
  return upsertWebsitePage({
    page_key: "features",
    title: "Features",
    sections: FEATURE_FALLBACK_SECTIONS,
    seo: {
      title: "Features · AVS ERP",
      description: "Core modules in AVS ERP jewellery ERP.",
    },
    is_published: true,
  });
}

export async function upsertWebsitePage(input: {
  page_key: string;
  title: string;
  sections: WebsiteSection[];
  seo: WebsitePage["seo"];
  is_published: boolean;
}): Promise<boolean> {
  const { error } = await supabase.from("public_website_pages" as never).upsert(
    {
      page_key: input.page_key,
      title: input.title,
      sections: input.sections,
      seo: input.seo ?? {},
      is_published: input.is_published,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "page_key" } as never,
  );
  return !error;
}
