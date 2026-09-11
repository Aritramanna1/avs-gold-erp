/**
 * Canonical Route: /control/terminology
 * 42-Term Canonical Jewellery Terminology Engine & Trade Packs
 * Master Reference: docs/MASTER/JEWELLERY_TERMINOLOGY_MASTER.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { StandardPage } from "@/components/design-system";
import { TerminologyManager } from "@/components/settings/TerminologyManager";
import { APP_NAME } from "@/lib/app-info";

export const Route = createFileRoute("/control/terminology")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: `Terminology Engine · ${APP_NAME}` }] }),
  component: ControlTerminologyPage,
});

function ControlTerminologyPage() {
  return (
    <StandardPage
      title="Jewellery Terminology Engine (42 Terms)"
      subtitle="Manage active trade packs and custom vocabulary aliases."
    >
      <TerminologyManager />
    </StandardPage>
  );
}
