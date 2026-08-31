import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { usePublicPricingPlans, usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { formatPriceMinor } from "@/lib/website/website-service";
import { REQUEST_ACCESS_PATH } from "@/lib/auth/public-signup-policy";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  const { data: bundle } = usePublicWebsiteBundle();
  const { data: plans = [], isLoading } = usePublicPricingPlans();

  if (!bundle.feature_flags.pricing) throw notFound();

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-serif text-3xl md:text-4xl">Plans for every stage of growth</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Ornexa Basic through Max — manufacturing, wholesale, and retail capabilities licensed per
          your business. Prices shown only when published by Platform Owner.
        </p>

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading plans…</p>
        ) : plans.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              Public pricing is being configured. Please contact sales for a quotation.
            </p>
            <Button asChild className="mt-4 bg-gold text-slate-950">
              <Link to="/contact" search={{ intent: "sales" }}>
                Contact Sales
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h2 className="font-serif text-xl text-gold">{plan.name}</h2>
                {plan.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                )}
                <div className="mt-6 text-2xl font-semibold">
                  {plan.pricing_display_mode === "show_price" && plan.price_minor != null
                    ? formatPriceMinor(plan.price_minor)
                    : "Contact Sales"}
                </div>
                {bundle.feature_flags.free_trial_cta && (
                  <Button asChild className="mt-6 w-full bg-gold text-slate-950">
                    <Link to={REQUEST_ACCESS_PATH}>Request access</Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {bundle.feature_flags.amc_display && (
          <p className="mt-12 text-sm text-muted-foreground">
            Annual Platform Care (AMC) is configured per plan in your commercial agreement — renewal
            reminders and grace periods are handled inside Ornexa billing.
          </p>
        )}
      </div>
    </MarketingLayout>
  );
}
