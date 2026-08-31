import { useRouterState } from "@tanstack/react-router";
import { MarketingSeo } from "@/components/marketing/MarketingSeo";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";

const PATH_SEO: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Jewellery Manufacturing ERP",
    description:
      "AVS ERP is a manufacturing-first jewellery ERP for India — gold vault custody, karigar job cards, GST billing, and customer portals. Access is invitation-only.",
  },
  "/features": {
    title: "Features",
    description:
      "Gold vault ledger, job cards, print engine, party 360, portals, and assistant — built for jewellery factories and wholesalers.",
  },
  "/pricing": {
    title: "Pricing",
    description:
      "Transparent plans for jewellery manufacturers. Request access or talk to sales.",
  },
  "/contact": {
    title: "Contact & Demo",
    description: "Book a demo or contact AVS ERP sales for jewellery ERP onboarding.",
  },
  "/faq": {
    title: "FAQ",
    description: "Frequently asked questions about AVS ERP jewellery manufacturing ERP.",
  },
  "/tutorials": {
    title: "Tutorials",
    description: "Video and written guides for AVS ERP modules.",
  },
  "/blog": {
    title: "Blog",
    description: "Jewellery manufacturing operations, gold accounting, and ERP best practices.",
  },
  "/whats-new": {
    title: "What's New",
    description: "AVS ERP release notes and product updates.",
  },
  "/downloads": {
    title: "Downloads",
    description: "Download AVS ERP web, desktop, and mobile apps when available.",
  },
  "/login": {
    title: "Login",
    description: "Sign in to your AVS ERP jewellery ERP workspace.",
  },
  "/trial/start": {
    title: "Request Access",
    description: "AVS ERP access is invitation-only. Request access or accept your secure invitation.",
  },
  "/request-access": {
    title: "Request Access · AVS ERP",
    description: "Request AVS ERP access or complete signup with your authorized invitation link.",
  },
  "/solutions/manufacturing": {
    title: "Manufacturing Solution",
    description:
      "Melting, bench WIP, karigar custody, hallmark, and scrap — for jewellery factories.",
  },
  "/solutions/wholesale": {
    title: "Wholesale Solution",
    description: "Stock, billing, and party ledgers for jewellery wholesalers.",
  },
};

/** Applies per-route SEO using CMS defaults as fallback. */
export function MarketingPublicSeo() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: bundle } = usePublicWebsiteBundle();
  const route = PATH_SEO[pathname] ?? PATH_SEO["/"];
  const legalMatch = pathname.match(/^\/legal\/([^/]+)/);
  const title = legalMatch ? `Legal — ${legalMatch[1]}` : route.title;
  const description = bundle.seo_default.description ?? route.description;

  return (
    <MarketingSeo
      title={title}
      description={description}
      path={pathname}
      ogImage={bundle.seo_default.og_image_path ?? "/assets/ornexa-logo-full.png"}
    />
  );
}
