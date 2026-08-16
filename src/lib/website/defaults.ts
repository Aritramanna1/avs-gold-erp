import type { WebsiteFeatureFlags, PublicWebsiteBundle } from "./types";

export const DEFAULT_FEATURE_FLAGS: WebsiteFeatureFlags = {
  homepage: true,
  features_page: true,
  manufacturing_page: true,
  wholesale_page: true,
  retail_page: false,
  pricing: true,
  amc_display: true,
  free_trial_cta: true,
  request_demo: true,
  contact: true,
  tutorials: true,
  blog: false,
  whats_new: false,
  downloads: false,
  testimonials: true,
  faq: true,
  whatsapp_chat: true,
  social_links: true,
  branded_loader: true,
  footer: true,
};

export const DEFAULT_WEBSITE_BUNDLE: PublicWebsiteBundle = {
  feature_flags: DEFAULT_FEATURE_FLAGS,
  contact: {
    sales_email: "sales@arivahly.in",
    whatsapp_phone: "919876543210",
    whatsapp_label: "Chat on WhatsApp",
    whatsapp_message:
      "Hi, I am interested in Ornexa Jewellery ERP and would like more information.",
  },
  social: {},
  loader: { enabled: true, max_ms: 4000 },
  seo_default: {
    title: "Ornexa — Jewellery Ecosystem ERP",
    description:
      "Manufacturing-first jewellery ERP with gold custody, karigar management, portals, and GST compliance. Jewellery ERP India, gold manufacturing software, karigar management.",
    og_image_path: "/assets/ornexa-brand-master.png",
  },
  downloads: {
    enabled: false,
    items: [
      { id: "web", label: "Web App", platform: "web", url: "/login", enabled: true },
      { id: "desktop", label: "Desktop App", platform: "desktop", url: "", enabled: false },
      { id: "mobile", label: "Mobile App", platform: "mobile", url: "", enabled: false },
    ],
  },
  pages: [],
};

/** Paths that never require ERP auth gate. */
export const PUBLIC_MARKETING_PREFIXES = [
  "/",
  "/login",
  "/pricing",
  "/contact",
  "/faq",
  "/features",
  "/blog",
  "/tutorials",
  "/whats-new",
  "/solutions",
  "/legal",
  "/downloads",
] as const;

export function isPublicMarketingPath(pathname: string): boolean {
  if (
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/auth/callback" ||
    pathname === "/otp-login" ||
    pathname.startsWith("/invite") ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/trial/start" ||
    pathname.startsWith("/doc/")
  ) {
    return true;
  }
  return PUBLIC_MARKETING_PREFIXES.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );
}
