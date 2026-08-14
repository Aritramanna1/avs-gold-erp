/**
 * Canonical Route: /control/customization
 * Top-Level Customization Workspace — 11 Business Adaptation Categories
 * Master Reference: docs/MASTER/CUSTOMIZATION_MASTER.md
 *
 * SETTINGS CONFIGURES THE SYSTEM; CUSTOMIZATION ADAPTS THE BUSINESS.
 */
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { z } from "zod";
import { CustomizationHub } from "@/components/customization/CustomizationHub";

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
  return <CustomizationHub activeTab={tab} />;
}
