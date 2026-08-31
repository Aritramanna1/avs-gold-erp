import { createFileRoute, Navigate } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";

/** Thin Transaction Module hub — Karigar Transactions is the default ledger. */
export const Route = createFileRoute("/transactions")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Transaction Module · AVS ERP" }] }),
  component: () => <Navigate to="/workshop/gold-book" replace />,
});
