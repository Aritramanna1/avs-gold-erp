import { createFileRoute, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { MarketingSectionRenderer } from "@/components/marketing/MarketingSectionRenderer";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { getPageFromBundle } from "@/lib/website/website-service";

export const Route = createFileRoute("/solutions/wholesale")({
  component: WholesaleSolutionPage,
});

function WholesaleSolutionPage() {
  const { data: bundle } = usePublicWebsiteBundle();
  if (!bundle.feature_flags.wholesale_page) throw notFound();
  const page = getPageFromBundle(bundle, "wholesale");

  return (
    <MarketingLayout>
      <div className="py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="font-serif text-3xl md:text-4xl">Wholesale</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            B2B dealer operations — price lists, dispatch, and dealer portal when licensed.
          </p>
        </div>
        <div className="mt-10">
          <MarketingSectionRenderer
            sections={
              page?.sections?.length
                ? page.sections
                : [
                    {
                      id: "ws",
                      type: "feature_grid",
                      items: [
                        { title: "Dealer accounts", body: "Customer-specific rates and terms." },
                        {
                          title: "Bulk orders",
                          body: "Booking, allocation, and dispatch challans.",
                        },
                        { title: "Profit analysis", body: "Margin visibility by dealer." },
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
