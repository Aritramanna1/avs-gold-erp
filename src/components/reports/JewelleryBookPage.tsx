import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { ReportShell } from "@/components/reports/ReportShell";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { Button } from "@/components/ui/button";
import { usePrintEngine } from "@/lib/print-engine";
import {
  exportToCSV,
  rangeForPeriod,
  thisMonthRange,
  triggerPrint as triggerReportPrint,
  type DateRange,
  type ReportPeriod,
} from "@/lib/report-engine";
import { Download, Printer, ArrowLeft } from "lucide-react";

export function useJewelleryReportRange() {
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [customRange, setCustomRange] = useState(thisMonthRange());
  const range = useMemo(() => rangeForPeriod(period, customRange), [period, customRange]);
  return { period, setPeriod, customRange, setCustomRange, range };
}

export function JewelleryBookPage(props: {
  title: string;
  offlineName: string;
  description: string;
  columns: string[];
  rows: (string | number)[][];
  openingLabel?: string;
  closingLabel?: string;
  filters?: ReactNode;
  csvName: string;
  period: ReportPeriod;
  onPeriodChange: (p: ReportPeriod) => void;
  customRange: DateRange;
  onCustomRangeChange: (r: DateRange) => void;
  /** UPE print path e.g. /reports/book-print/fine_rojmel?from=&to= */
  printHref?: string;
}) {
  const { triggerPrint } = usePrintEngine();

  function handlePrint() {
    if (props.printHref) {
      triggerPrint(props.printHref, `${props.title} · Print`);
      return;
    }
    const tableData = [props.columns, ...props.rows.map((r) => r.map((c) => String(c ?? "")))];
    void triggerReportPrint(props.title, props.customRange, [tableData]);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title={props.title}
        subtitle={`${props.offlineName} · ${props.description}`}
        actions={
          <div className="flex gap-2 items-center flex-wrap">
            <SourceOfTruthBadge variant="report" />
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports">
                <ArrowLeft className="h-4 w-4 mr-1" /> Reports
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                exportToCSV(props.csvName, [props.columns, ...props.rows.map((r) => r.map(String))])
              }
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        }
      />
      <ReportShell
        title={props.title}
        description={`Offline parity: ${props.offlineName}. Derived from AVS ERP ledgers (gold_ledger / money vouchers / invoices).`}
        variant="report"
        period={props.period}
        onPeriodChange={props.onPeriodChange}
        customRange={props.customRange}
        onCustomRangeChange={props.onCustomRangeChange}
        openingLabel={props.openingLabel}
        closingLabel={props.closingLabel}
        filters={props.filters}
        onPrint={handlePrint}
        onExport={() =>
          exportToCSV(props.csvName, [props.columns, ...props.rows.map((r) => r.map(String))])
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                {props.columns.map((c) => (
                  <th key={c} className="text-left p-2 font-semibold whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  {row.map((cell, j) => (
                    <td key={j} className="p-2 font-mono whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportShell>
    </div>
  );
}
