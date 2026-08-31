export type WebsiteFeatureFlags = {
  homepage: boolean;
  features_page: boolean;
  manufacturing_page: boolean;
  wholesale_page: boolean;
  retail_page: boolean;
  pricing: boolean;
  amc_display: boolean;
  free_trial_cta: boolean;
  request_demo: boolean;
  contact: boolean;
  tutorials: boolean;
  blog: boolean;
  whats_new: boolean;
  downloads: boolean;
  testimonials: boolean;
  faq: boolean;
  whatsapp_chat: boolean;
  social_links: boolean;
  branded_loader: boolean;
  footer: boolean;
};

export type WebsiteContactConfig = {
  sales_email?: string;
  support_email?: string;
  phone?: string;
  address?: string;
  whatsapp_phone?: string;
  whatsapp_label?: string;
  whatsapp_message?: string;
};

export type SocialLinkConfig = {
  enabled: boolean;
  url: string;
};

export type WebsiteSocialConfig = {
  facebook?: SocialLinkConfig;
  instagram?: SocialLinkConfig;
  linkedin?: SocialLinkConfig;
  youtube?: SocialLinkConfig;
  whatsapp?: SocialLinkConfig;
};

export type WebsiteSection =
  | {
      id: string;
      type: "hero";
      heading: string;
      subheading?: string;
      primary_cta?: { label: string; href: string };
      secondary_cta?: { label: string; href: string };
      image_path?: string;
    }
  | {
      id: string;
      type: "pillars";
      items: Array<{ title: string; body: string }>;
    }
  | {
      id: string;
      type: "feature_grid";
      heading?: string;
      items: Array<{
        /** Stable id for screenshot slot `feature:<id>` */
        id?: string;
        title: string;
        body: string;
        icon?: string;
        /** Public https / data / site path — filled by Screenshots CMS or media merge */
        image_path?: string;
        image_alt?: string;
      }>;
    }
  | {
      id: string;
      type: "rich_text";
      heading?: string;
      body_md?: string;
    }
  | {
      id: string;
      type: "testimonials";
      items: Array<{ quote: string; author: string; company?: string }>;
    }
  | {
      id: string;
      type: "faq";
      items: Array<{ question: string; answer: string }>;
    };

export type WebsitePage = {
  page_key: string;
  title: string;
  sections: WebsiteSection[];
  seo: {
    title?: string;
    description?: string;
    canonical?: string;
    og_image?: string;
  };
};

export type WebsiteDownloadItem = {
  id: string;
  label: string;
  platform: string;
  url: string;
  enabled: boolean;
};

export type WebsiteDownloadsConfig = {
  enabled?: boolean;
  items?: WebsiteDownloadItem[];
};

export type PublicWebsiteBundle = {
  feature_flags: WebsiteFeatureFlags;
  contact: WebsiteContactConfig;
  social: WebsiteSocialConfig;
  loader: { enabled?: boolean; max_ms?: number };
  seo_default: { title?: string; description?: string; og_image_path?: string };
  downloads?: WebsiteDownloadsConfig;
  pages: WebsitePage[];
};

export type PublicPricingPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billing_cycle: string | null;
  price_minor: number | null;
  pricing_display_mode: "show_price" | "contact_sales" | "hidden";
  feature_limits: Record<string, unknown> | null;
  commercial_config: Record<string, unknown> | null;
  branch_limit: number | null;
  user_limit: number | null;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  cover_image_path: string | null;
  author_name: string | null;
  category: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  status: string;
  published_at: string | null;
};

export type PublicTutorial = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  thumbnail_path: string | null;
  video_url: string | null;
  video_provider: string | null;
  body_md: string | null;
  erp_module: string | null;
  language: string;
  is_featured: boolean;
  is_published?: boolean;
  sort_order: number;
};

export type ReleaseNote = {
  id: string;
  product_id: string;
  version: string;
  release_date: string;
  release_type: string;
  headline: string;
  changes: string[];
  fixes: string[];
  improvements: string[];
  known_issues: string[];
  cta_label: string | null;
  cta_url: string | null;
  status: string;
};

export type LegalPage = {
  slug: string;
  title: string;
  body_md: string;
  version: string;
  effective_date: string;
};
