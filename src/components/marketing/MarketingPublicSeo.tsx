import { useRouterState } from "@tanstack/react-router";
import { MarketingSeo } from "@/components/marketing/MarketingSeo";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";

const PATH_SEO: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Jewellery Manufacturing ERP",
    description:
      "Ornexa is a manufacturing-first jewellery ERP for India — gold vault custody, karigar job cards, GST billing, customer portals, and a 14-day free trial.",
  },
  "/features": {
    title: "Features",
    description:
      "Gold vault ledger, job cards, print engine, party 360, portals, and assistant — built for jewellery factories and wholesalers.",
  },
  "/pricing": {
    title: "Pricing",
    description:
      "Transparent plans for jewellery manufacturers. Start a 14-day free trial or talk to sales.",
  },
  "/contact": {
    title: "Contact & Demo",
    description: "Book a demo or contact Ornexa sales for jewellery ERP onboarding.",
  },
  "/faq": {
    title: "FAQ",
    description: "Frequently asked questions about Ornexa jewellery manufacturing ERP.",
  },
  "/tutorials": {
    title: "Tutorials",
    description: "Video and written guides for Ornexa ERP modules.",
  },
  "/blog": {
    title: "Blog",
    description: "Jewellery manufacturing operations, gold accounting, and ERP best practices.",
  },
  "/whats-new": {
    title: "What's New",
    description: "Ornexa release notes and product updates.",
  },
  "/downloads": {
    title: "Downloads",
    description: "Download Ornexa web, desktop, and mobile apps when available.",
  },
  "/login": {
    title: "Login",
    description: "Sign in to your Ornexa jewellery ERP workspace.",
  },
  "/trial/start": {
    title: "Start Free Trial",
    description: "14-day free trial of Ornexa jewellery manufacturing ERP.",
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
      ogImage={bundle.seo_default.og_image_path ?? "/assets/ornexa-brand-master.png"}
    />
  );
}
