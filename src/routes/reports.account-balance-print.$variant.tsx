import { createFileRoute } from "@tanstack/react-router";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/reports/account-balance-print/$variant")({
  head: () => ({ meta: [{ title: "Account Balance Print · AVS ERP" }] }),
  component: AccountBalancePrintPage,
});

function AccountBalancePrintPage() {
  const { variant } = Route.useParams();
  const v = variant === "2" ? "2" : "1";
  return (
    <PrintEngine
      docType="account_balance_report"
      recordId={v}
      backUrl={`/reports/account-balance?variant=${v}`}
    />
  );
}
