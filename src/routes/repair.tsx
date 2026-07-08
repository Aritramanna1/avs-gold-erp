import { createFileRoute } from "@tanstack/react-router";

import { guardRoute } from "@/lib/permissions";
import { RetailComingSoon } from "@/components/RetailComingSoon";

// Pilot Phase 1 (Manufacturing Mode only): Repairs & Polishing intake is a
// retail-service workflow, not part of the manufacturing production
// pipeline, and was already unreachable from any nav link. Gated here
// rather than deleted — see src/lib/pilot-config.ts. The nested /repair/*
// routes (repair.index.tsx, repair.$id.tsx, etc.) stay in the repository
// untouched and will render again once this layout route returns <Outlet />.
export const Route = createFileRoute("/repair")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Repair · AVS Gold ERP" }] }),
  component: () => <RetailComingSoon />,
});
