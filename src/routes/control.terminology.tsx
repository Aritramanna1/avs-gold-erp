/**
 * Canonical Route: /control/terminology
 * 42-Term Canonical Jewellery Terminology Engine & Trade Packs
 * Master Reference: docs/MASTER/JEWELLERY_TERMINOLOGY_MASTER.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { PageHeader } from "@/components/app-shell";
import { TerminologyManager } from "@/components/settings/TerminologyManager";

export const Route = createFileRoute("/control/terminology")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Terminology Engine · Ornexa ERP" }] }),
  component: ControlTerminologyPage,
});

function ControlTerminologyPage() {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Jewellery Terminology Engine (42 Terms)"
        subtitle="Manage active trade packs (Standard, Indian Trade, Bengali, Gujarati, Manufacturer) and custom vocabulary aliases."
      />
      <TerminologyManager />
    </div>
  );
}
