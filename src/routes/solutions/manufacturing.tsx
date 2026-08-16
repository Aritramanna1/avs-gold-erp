import { createFileRoute, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { MarketingSectionRenderer } from "@/components/marketing/MarketingSectionRenderer";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { getPageFromBundle } from "@/lib/website/website-service";

export const Route = createFileRoute("/solutions/manufacturing")({
  component: ManufacturingSolutionPage,
});

function ManufacturingSolutionPage() {
  const { data: bundle } = usePublicWebsiteBundle();
  if (!bundle.feature_flags.manufacturing_page) throw notFound();
  const page = getPageFromBundle(bundle, "manufacturing");

  return (
    <MarketingLayout>
      <div className="py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="font-serif text-3xl md:text-4xl">Manufacturing</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Built for jewellery factories — job cards, karigar custody, melting, QC, and hallmark on
            one gold ledger.
          </p>
        </div>
        <div className="mt-10">
          <MarketingSectionRenderer
            sections={
              page?.sections?.length
                ? page.sections
                : [
                    {
                      id: "mfg",
                      type: "feature_grid",
                      items: [
                        {
                          title: "Job cards",
                          body: "Issue, WIP, receive, and settle karigar work.",
                        },
                        { title: "Gold Vault", body: "Authoritative fine metal balances." },
                        { title: "Loss & wastage", body: "Stage-wise accountability and reports." },
                        {
                          title: "Documents",
                          body: "Slips and vouchers via Universal Print Engine.",
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
