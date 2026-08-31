import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CircleAlert, Settings2, ShieldCheck } from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/company-admin")({ component: CompanyAdminPage });

type Subscription = {
  status: string;
  trial_ends_at: string | null;
  renews_at: string | null;
  plan_id: string;
};
type Feature = { feature_key: string; enabled: boolean; source: string };

function CompanyAdminPage() {
  const role = useSettings((s) => s.currentUserRole);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const allowed = ["owner", "admin", "ceo", "Owner", "Administrator", "CEO (View Only)"].includes(
    role ?? "",
  );
  useEffect(() => {
    if (!allowed) return;
    void Promise.all([
      supabase
        .from("organization_subscriptions" as never)
        .select("status,trial_ends_at,renews_at,plan_id")
        .maybeSingle(),
      supabase
        .from("organization_features" as never)
        .select("feature_key,enabled,source")
        .order("feature_key"),
    ]).then(([sub, flags]) => {
      if (sub.error || flags.error) setError("Company administration data could not be loaded.");
      setSubscription((sub.data ?? null) as Subscription | null);
      setFeatures((flags.data ?? []) as Feature[]);
    });
  }, [allowed]);
  if (!allowed)
    return (
      <main className="p-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <CircleAlert className="mb-2 text-destructive" />
          <h1 className="font-semibold">Company admin access denied</h1>
          <p className="text-sm text-muted-foreground">
            Only firm owner, admin, and CEO roles can access company administration.
          </p>
        </div>
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <p className="text-sm font-medium text-primary">Firm control center</p>
        <h1 className="text-2xl font-semibold">Company Administration</h1>
        <p className="text-sm text-muted-foreground">
          Firm-scoped settings, security, and subscription visibility.
        </p>
      </header>
      {error && (
        <div className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border bg-card p-5">
          <ShieldCheck className="mb-3 h-5 w-5 text-primary" />
          <h2 className="font-semibold">Subscription</h2>
          {subscription ? (
            <div className="mt-3 space-y-1 text-sm">
              <p>
                Status: <strong>{subscription.status}</strong>
              </p>
              <p>
                Renewal:{" "}
                {subscription.renews_at
                  ? new Date(subscription.renews_at).toLocaleDateString()
                  : "Not scheduled"}
              </p>
              <p>
                Trial expiry:{" "}
                {subscription.trial_ends_at
                  ? new Date(subscription.trial_ends_at).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No subscription has been assigned yet.
            </p>
          )}
        </section>
        <section className="rounded-lg border bg-card p-5">
          <Settings2 className="mb-3 h-5 w-5 text-primary" />
          <h2 className="font-semibold">Feature access</h2>
          {features.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {features.map((feature) => (
                <div className="rounded border p-2" key={feature.feature_key}>
                  <span className={feature.enabled ? "text-emerald-600" : "text-muted-foreground"}>
                    {feature.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <div>{feature.feature_key}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Feature access is controlled by the assigned plan.
            </p>
          )}
        </section>
      </div>
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Company settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Firm profile, branches, workflows, GST, print templates, storage, notifications, security,
          and audit tools.
        </p>
        <Link to="/settings">
          <Button className="mt-4">Open Settings</Button>
        </Link>
      </section>
    </main>
  );
}
