/**
 * Expenses — module landing.
 *
 * Kept visible in navigation but showing a professional Coming Soon placeholder
 * until development begins. The underlying architecture stays ready (expense
 * store and receipt storage) — only this landing is deferred.
 */
import { createFileRoute } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import { TrendingDown } from "lucide-react";

export const Route = createFileRoute("/expenses/")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Expenses · AVS Gold ERP" }] }),
  component: ExpensesComingSoon,
});

function ExpensesComingSoon() {
  return (
    <ModuleComingSoon
      title="Expenses"
      message="The Expenses workspace is under active development. Expense tracking, categories, and receipt capture will land here. The data model and receipt storage are already in place — this workspace is being built."
      icon={TrendingDown}
    />
  );
}
