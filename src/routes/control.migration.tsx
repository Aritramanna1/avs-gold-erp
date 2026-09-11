/**
 * Canonical Route: /control/migration
 * 13-Stage Migration Wizard & Opening Balance Engine
 * Master Reference: docs/MASTER/OPENING_BALANCE_AND_MIGRATION_MASTER.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { PageHeader } from "@/components/app-shell";
import { MigrationWizard } from "@/components/migration/MigrationWizard";
import { APP_NAME } from "@/lib/app-info";

export const Route = createFileRoute("/control/migration")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: `13-Stage Migration Wizard · ${APP_NAME}` }] }),
  component: ControlMigrationPage,
});

function ControlMigrationPage() {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Opening Balance & 13-Stage Migration Wizard"
        subtitle="Step-by-step master data and opening balance migration with validation dry-runs and CEO audit freeze."
      />
      <MigrationWizard />
    </div>
  );
}
