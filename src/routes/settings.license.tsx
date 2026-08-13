/**
 * Settings → License & Activation. Reuses LicensePanel (same form the
 * activation gate shows) so there is one licensing UI, not two.
 */
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { LicensePanel } from "@/components/license-gate";
import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/settings/license")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "License & Activation · AVS Gold ERP" }] }),
  component: LicenseSettingsPage,
});

function LicenseSettingsPage() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="License & Activation"
        subtitle="Configure Trial, Active, Expired, and Suspended licensing for Supabase-online tenant firms. Payments are not collected in this build."
      />
      <section className="rounded-2xl border border-border bg-card p-5">
        <LicensePanel />
      </section>
    </div>
  );
}
