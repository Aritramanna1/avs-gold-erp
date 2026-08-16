/**
 * Attendance & Worker Slips Print Route — Unified Print Engine.
 */
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-store";
import { shortShopName } from "@/lib/app-info";
import type { PrintDocType } from "@/lib/printlog-store";
import { PrintEngine } from "@/components/print-engine/PrintEngine";

export const Route = createFileRoute("/attendance/print/$kind/$id")({
  head: () => {
    const shortName = shortShopName(useSettings.getState().firm?.shopName);
    return {
      meta: [{ title: `Print · ${shortName} ERP` }],
    };
  },
  component: PrintPage,
});

const docTypeMap: Record<string, PrintDocType> = {
  passbook: "worker_passbook",
  settlement: "home_settlement_slip",
  withdrawal: "withdrawal_slip",
  loan: "loan_slip",
  advance: "withdrawal_slip",
  gold_advance: "gold_advance_slip",
  wastage_return: "wastage_return_receipt",
  attendance: "attendance_sheet",
};

function PrintPage() {
  const { kind, id } = useParams({ from: "/attendance/print/$kind/$id" });
  const docType = docTypeMap[kind] ?? "attendance_sheet";

  return <PrintEngine docType={docType} recordId={id} backUrl="/attendance" />;
}
