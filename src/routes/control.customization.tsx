/**
 * Canonical Route: /control/customization
 * Top-Level Customization Workspace — 11 Business Adaptation Categories
 * Master Reference: docs/MASTER/CUSTOMIZATION_MASTER.md
 *
 * SETTINGS CONFIGURES THE SYSTEM; CUSTOMIZATION ADAPTS THE BUSINESS.
 */
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { lazy, Suspense } from "react";
import { z } from "zod";
import { StandardPage } from "@/components/design-system";
import { ModuleSkeleton } from "@/components/module-skeleton";

const CustomizationHub = lazy(() =>
  import("@/components/customization/CustomizationHub").then((m) => ({
    default: m.CustomizationHub,
  })),
);

const SearchSchema = z.object({
  tab: z.string().optional(),
});

export const Route = createFileRoute("/control/customization")({
  validateSearch: (s) => SearchSchema.parse(s),
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Customization Workspace · Ornexa ERP" }] }),
  component: ControlCustomizationPage,
});

function ControlCustomizationPage() {
  const { tab } = useSearch({ from: "/control/customization" });
  return (
    <StandardPage
      title="Customization Workspace"
      subtitle="Adapt business language, books, rules, entities, and transaction definitions."
      maxWidth="full"
    >
      <Suspense fallback={<ModuleSkeleton />}>
        <CustomizationHub activeTab={tab} />
      </Suspense>
    </StandardPage>
  );
}
