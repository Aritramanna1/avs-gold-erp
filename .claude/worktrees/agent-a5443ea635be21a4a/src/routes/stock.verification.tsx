import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarcodeInput } from "@/components/hardware/BarcodeInput";
import { useSettings } from "@/lib/settings-store";
import {
  usePhysicalStockCounts,
  loadPhysicalStockCounts,
} from "@/lib/physical-stock-verification-store";
import { mgToGrams } from "@/lib/gold";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, ScanLine, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stock/verification")({
  head: () => ({ meta: [{ title: "Physical Stock Verification · MTJ ERP" }] }),
  component: StockVerificationPage,
});

function StockVerificationPage() {
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const counts = usePhysicalStockCounts((s) => s.counts);
  const [scanInput, setScanInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPhysicalStockCounts();
  }, []);

  const active = useMemo(
    () => counts.find((c) => c.branchId === selectedBranchId && c.status === "in_progress"),
    [counts, selectedBranchId],
  );
  const history = useMemo(
    () =>
      counts
        .filter((c) => c.branchId === selectedBranchId && c.status !== "in_progress")
        .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.startedAt)),
    [counts, selectedBranchId],
  );

  async function actor() {
    const { data } = await supabase.auth.getSession();
    return { id: data.session?.user.id ?? null, email: data.session?.user.email ?? null };
  }

  async function handleStart() {
    setBusy(true);
    try {
      const who = await actor();
      const session = usePhysicalStockCounts.getState().start(selectedBranchId || "MAIN", who);
      toast.success(`Count started — ${session.lines.length} items expected on hand.`);
    } finally {
      setBusy(false);
    }
  }

  function handleScan(code?: string) {
    if (!active) return;
    const res = usePhysicalStockCounts.getState().scan(active.id, code ?? scanInput);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    setScanInput("");
  }

  async function handleComplete() {
    if (!active) return;
    setBusy(true);
    try {
      const who = await actor();
      const done = usePhysicalStockCounts.getState().complete(active.id, who);
      if (done) {
        const shortMg = done.shortFineMg ?? 0;
        toast(
          shortMg > 0
            ? `Count completed. Short by ${mgToGrams(shortMg)}g fine gold — investigate missing items below.`
            : "Count completed. No shortage detected.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const scannedCount = active?.lines.filter((l) => l.scanned).length ?? 0;
  const totalCount = active?.lines.length ?? 0;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Physical Stock Verification"
        subtitle="Reconcile physical stock-take against system inventory. Every gram short is traceable to a specific item."
      />

      {!active && (
        <div className="rounded-2xl border border-border bg-card p-6 mb-6 flex items-center justify-between">
          <div>
            <div className="font-semibold">No count in progress for this branch</div>
            <div className="text-sm text-muted-foreground">
              Starting a count snapshots every available/reserved item currently expected on hand.
            </div>
          </div>
          <Button onClick={handleStart} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Start Count
          </Button>
        </div>
      )}

      {active && (
        <div className="rounded-2xl border border-border bg-card p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold">
              Count in progress — {scannedCount}/{totalCount} scanned
            </div>
            <Button onClick={handleComplete} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Complete Count
            </Button>
          </div>
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <BarcodeInput
                value={scanInput}
                onChange={setScanInput}
                onSubmit={(code) => handleScan(code)}
                placeholder="Scan or type barcode / item code"
                autoFocus
              />
            </div>
            <Button variant="outline" onClick={() => handleScan()} className="gap-2">
              <ScanLine className="h-4 w-4" /> Mark Found
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left sticky top-0 bg-card">
                  <th className="p-2">Item Code</th>
                  <th className="p-2">Barcode</th>
                  <th className="p-2">Expected Fine (g)</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {active.lines.map((l) => (
                  <tr key={l.itemId} className="border-b border-border last:border-0">
                    <td className="p-2">{l.itemCode}</td>
                    <td className="p-2">{l.barcode}</td>
                    <td className="p-2">{mgToGrams(l.expectedFineMg)}</td>
                    <td className="p-2">
                      {l.scanned ? (
                        <Badge className="bg-green-600 hover:bg-green-600">Found</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border font-semibold">Past Counts</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3">Started</th>
              <th className="p-3">Completed</th>
              <th className="p-3">Status</th>
              <th className="p-3">Items</th>
              <th className="p-3">Short (g fine)</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No completed counts yet.
                </td>
              </tr>
            )}
            {history.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="p-3">{new Date(c.startedAt).toLocaleString()}</td>
                <td className="p-3">{c.completedAt ? new Date(c.completedAt).toLocaleString() : "—"}</td>
                <td className="p-3 capitalize">{c.status}</td>
                <td className="p-3">{c.lines.length}</td>
                <td className="p-3">
                  {c.shortFineMg != null ? (
                    <span className={c.shortFineMg > 0 ? "text-destructive font-semibold" : ""}>
                      {mgToGrams(c.shortFineMg)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-right">
                  {c.status === "completed" && (c.shortFineMg ?? 0) > 0 && (
                    c.adjustmentLedgerEntryId ? (
                      <Badge variant="secondary">Posted to Ledger</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const { data } = await supabase.auth.getSession();
                          await usePhysicalStockCounts.getState().postShortageAdjustment(c.id, {
                            id: data.session?.user.id ?? null,
                            email: data.session?.user.email ?? null,
                          });
                          toast.success("Shortage posted as a gold-ledger adjustment.");
                        }}
                      >
                        Post Shortage to Ledger
                      </Button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
