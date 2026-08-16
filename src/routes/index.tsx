import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { MarketingSectionRenderer } from "@/components/marketing/MarketingSectionRenderer";
import { OrnexaBrandedLoader } from "@/components/marketing/OrnexaBrandedLoader";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { getPageFromBundle } from "@/lib/website/website-service";
import { notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ornexa — Jewellery Ecosystem ERP" },
      {
        name: "description",
        content:
          "Manufacturing-first jewellery ERP with gold custody, karigar management, portals, and GST compliance.",
      },
    ],
  }),
  component: MarketingHomePage,
});

function MarketingHomePage() {
  const { data: bundle, isLoading } = usePublicWebsiteBundle();

  if (!bundle.feature_flags.homepage) {
    throw notFound();
  }

  const page = getPageFromBundle(bundle, "home");

  if (isLoading && bundle.loader.enabled) {
    return (
      <MarketingLayout>
        <OrnexaBrandedLoader enabled maxMs={bundle.loader.max_ms ?? 4000} />
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <div className="pb-16">
        {page?.sections?.length ? (
          <MarketingSectionRenderer sections={page.sections} />
        ) : (
          <MarketingSectionRenderer
            sections={[
              {
                id: "hero",
                type: "hero",
                heading: "Jewellery manufacturing ERP with gold custody you can audit",
                subheading:
                  "Job cards, karigar issue and return, vault balances, GST documents, and customer portals.",
                primary_cta: { label: "Start 14-Day Free Trial", href: "/trial/start" },
                secondary_cta: { label: "Book a Demo", href: "/contact?intent=demo" },
              },
            ]}
          />
        )}
      </div>
    </MarketingLayout>
  );
}
