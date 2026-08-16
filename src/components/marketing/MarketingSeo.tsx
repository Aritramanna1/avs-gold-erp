import { useEffect } from "react";
import {
  getPublicSiteOrigin,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_TAGLINE,
} from "@/lib/website/public-site-url";

export type MarketingSeoProps = {
  title?: string;
  description?: string;
  path?: string;
  ogImage?: string;
  noIndex?: boolean;
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Client-side SEO for marketing routes (title, description, OG, Twitter, canonical, JSON-LD). */
export function MarketingSeo({
  title,
  description,
  path = "/",
  ogImage = "/assets/ornexa-brand-master.png",
  noIndex = false,
}: MarketingSeoProps) {
  const origin = getPublicSiteOrigin();
  const fullTitle = title
    ? `${title} · ${PUBLIC_SITE_NAME}`
    : `${PUBLIC_SITE_NAME} — ${PUBLIC_SITE_TAGLINE}`;
  const desc =
    description ??
    "Ornexa is a manufacturing-first jewellery ERP with gold custody, karigar management, GST billing, portals, and a 14-day free trial.";
  const canonical = `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  const image = ogImage.startsWith("http") ? ogImage : `${origin}${ogImage}`;

  useEffect(() => {
    document.title = fullTitle;
    upsertMeta("name", "description", desc);
    upsertMeta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow");
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", PUBLIC_SITE_NAME);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", image);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", desc);
    upsertMeta("name", "twitter:image", image);
    upsertLink("canonical", canonical);

    const ldId = "ornexa-jsonld-organization";
    let script = document.getElementById(ldId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = ldId;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: PUBLIC_SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Windows, Android, iOS",
      description: desc,
      url: origin,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
        description: "14-day free trial available",
      },
      publisher: {
        "@type": "Organization",
        name: "Arivahly Venture Sphere",
        url: "https://arivahly.in",
      },
      keywords:
        "jewellery ERP, jewellery manufacturing software, gold ERP India, karigar management, Ornexa, XR jewellery software",
    });
  }, [fullTitle, desc, canonical, image, noIndex]);

  return null;
}
