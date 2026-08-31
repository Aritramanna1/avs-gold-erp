import { createFileRoute, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { MarketingSectionRenderer } from "@/components/marketing/MarketingSectionRenderer";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { getPageFromBundle } from "@/lib/website/website-service";

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
});

function FeaturesPage() {
  const { data: bundle } = usePublicWebsiteBundle();
  if (!bundle.feature_flags.features_page) throw notFound();
  const page = getPageFromBundle(bundle, "features");

  return (
    <MarketingLayout>
      <div className="py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="font-serif text-3xl md:text-4xl">Platform capabilities</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            One jewellery ecosystem — gold vault, manufacturing, documents, communication, and
            portals when licensed.
          </p>
        </div>
        <div className="mt-10">
          <MarketingSectionRenderer
            sections={
              page?.sections?.length
                ? page.sections
                : [
                    {
                      id: "grid",
                      type: "feature_grid",
                      heading: "Core modules",
                      items: [
                        {
                          title: "Gold Vault",
                          body: "Fine metal custody and milligram accounting.",
                        },
                        {
                          title: "Manufacturing",
                          body: "Job cards, melting, bench WIP, hallmark.",
                        },
                        { title: "Party 360", body: "Customers, karigars, suppliers, ledgers." },
                        {
                          title: "Print & Export",
                          body: "Universal engines for invoices and reports.",
                        },
                        { title: "Communication", body: "Email and WhatsApp on the AVS platform." },
                        {
                          title: "Customization",
                          body: "Terminology, workflows, and templates on Scale/Max.",
                        },
                      ],
                    },
                  ]
            }
          />
        </div>
      </div>
    </MarketingLayout>
  );
}
