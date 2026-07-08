import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getPrintJobHistory,
  listAvailablePrinters,
  type PrinterInfo,
} from "@/lib/print/print-queue";
import { RefreshCw, Loader2, Printer, FileDown, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/reports/print-queue")({
  head: () => ({ meta: [{ title: "Print Job Queue & History · AVS Gold ERP" }] }),
  component: PrintQueuePage,
});

interface PrintJobRow {
  id: string;
  docType: string;
  title: string;
  status: string;
  attempts: number;
  lastError: string | null;
  pdfFileName: string | null;
  createdAt: string;
}

function PrintQueuePage() {
  const [jobs, setJobs] = useState<PrintJobRow[]>([]);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [history, printerList] = await Promise.all([
        getPrintJobHistory(200),
        listAvailablePrinters(),
      ]);
      setJobs(history);
      setPrinters(printerList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const printedCount = jobs.filter((j) => j.status === "printed").length;
  const pdfFallbackCount = jobs.filter((j) => j.status === "pdf_fallback").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Print Job Queue & History"
        subtitle="Every print attempt, durably recorded. A failure always falls back to a downloaded PDF — 'Failed' here means even that fallback didn't work."
        actions={
          <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Printers Detected
          </div>
          <div className="text-2xl font-bold">{printers.length}</div>
          {printers.length === 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              None (browser mode, or no desktop printer) — PDF fallback covers every print.
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Printed
          </div>
          <div className="text-2xl font-bold text-green-600">{printedCount}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            PDF Fallback
          </div>
          <div className="text-2xl font-bold text-amber-600">{pdfFallbackCount}</div>
        </div>
        <div
          className={`rounded-2xl border p-4 ${failedCount > 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}
        >
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Failed
          </div>
          <div className={`text-2xl font-bold ${failedCount > 0 ? "text-destructive" : ""}`}>
            {failedCount}
          </div>
        </div>
      </div>

      {printers.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-6">
          <div className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Printer className="h-4 w-4" /> Detected Printers
          </div>
          <div className="flex flex-wrap gap-2">
            {printers.map((p) => (
              <Badge key={p.name} variant={p.isDefault ? "default" : "secondary"}>
                {p.displayName} {p.isDefault ? "(default)" : ""}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3">Time</th>
                <th className="p-3">Document</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Attempts</th>
                <th className="p-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No print jobs recorded yet."}
                  </td>
                </tr>
              )}
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">
                    {new Date(j.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">{j.title}</td>
                  <td className="p-3 text-muted-foreground capitalize">{j.docType}</td>
                  <td className="p-3">
                    {j.status === "printed" && (
                      <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                        <Printer className="h-3 w-3" /> Printed
                      </Badge>
                    )}
                    {j.status === "pdf_fallback" && (
                      <Badge variant="secondary" className="gap-1">
                        <FileDown className="h-3 w-3" /> PDF Fallback
                      </Badge>
                    )}
                    {j.status === "failed" && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Failed
                      </Badge>
                    )}
                  </td>
                  <td className="p-3">{j.attempts}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {j.lastError ?? j.pdfFileName ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
