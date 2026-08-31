import type { WebsiteFeatureFlags, PublicWebsiteBundle } from "./types";
import { FALLBACK_WEBSITE_PAGES } from "./fallback-pages";

export const DEFAULT_FEATURE_FLAGS: WebsiteFeatureFlags = {
  homepage: true,
  features_page: true,
  manufacturing_page: true,
  wholesale_page: true,
  retail_page: false,
  pricing: true,
  amc_display: true,
  free_trial_cta: false,
  request_demo: true,
  contact: true,
  tutorials: true,
  blog: false,
  whats_new: false,
  downloads: false,
  testimonials: true,
  faq: true,
  whatsapp_chat: false,
  social_links: true,
  branded_loader: true,
  footer: true,
};

export const DEFAULT_WEBSITE_BUNDLE: PublicWebsiteBundle = {
  feature_flags: DEFAULT_FEATURE_FLAGS,
  contact: {
    sales_email: "sales@arivahly.in",
    support_email: "sales@arivahly.in",
    whatsapp_phone: "",
    whatsapp_label: "Chat on WhatsApp",
    whatsapp_message:
      "Hi, I am interested in AVS ERP Jewellery ERP and would like more information.",
  },
  social: {},
  loader: { enabled: true, max_ms: 4000 },
  seo_default: {
    title: "AVS ERP — Jewellery Manufacturing ERP",
    description:
      "Manufacturing-first jewellery ERP from Arivahly Venture Sphere. Gold Vault custody, karigar management, GST documents, and portals for Indian jewellery factories.",
    og_image_path: "/assets/ornexa-logo-full.png",
  },
  downloads: {
    enabled: false,
    items: [
      { id: "web", label: "Web App", platform: "web", url: "/login", enabled: true },
      { id: "desktop", label: "Desktop App", platform: "desktop", url: "", enabled: false },
      { id: "mobile", label: "Mobile App", platform: "mobile", url: "", enabled: false },
    ],
  },
  pages: FALLBACK_WEBSITE_PAGES,
};

/** Paths that never require ERP auth gate. */
export const PUBLIC_MARKETING_PREFIXES = [
  "/",
  "/login",
  "/pricing",
  "/contact",
  "/faq",
  "/features",
  "/about",
  "/blog",
  "/tutorials",
  "/whats-new",
  "/solutions",
  "/legal",
  "/downloads",
  "/product",
  "/workflows",
  "/request-access",
  "/support",
] as const;

/** Public marketing pages (not login, trial, legal, or invite). */
export function isCommercialPublicPath(pathname: string): boolean {
  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/auth/callback" ||
    pathname === "/otp-login" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/trial/start" ||
    pathname === "/request-access" ||
    pathname === "/onboarding" ||
    pathname === "/setup" ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/legal/") ||
    pathname.startsWith("/doc/")
  ) {
    return false;
  }
  if (pathname === "/") return true;
  const prefixes = [
    "/pricing",
    "/contact",
    "/faq",
    "/features",
    "/about",
    "/blog",
    "/tutorials",
    "/whats-new",
    "/solutions",
    "/downloads",
    "/website",
    "/product",
    "/workflows",
    "/support",
  ];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

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
    pathname === "/request-access" ||
    pathname.startsWith("/doc/")
  ) {
    return true;
  }
  return PUBLIC_MARKETING_PREFIXES.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );
}
