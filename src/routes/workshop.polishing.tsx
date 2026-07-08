import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { usePeople } from "@/lib/people-store";
import { usePolishing, computePolisherLedger, computeCurrentPosition } from "@/lib/polishing-store";
import { useBusinessRules } from "@/lib/business-rules-store";
import { paiseToRupees } from "@/lib/orders-store";
import { mgToGrams } from "@/lib/gold";
import { SendToPolishingDialog } from "@/components/send-to-polishing-dialog";
import { ReceiveFromPolishingDialog } from "@/components/receive-from-polishing-dialog";
import { Sparkles, PackageCheck, ArrowUpRight, ArrowDownLeft } from "lucide-react";

export const Route = createFileRoute("/workshop/polishing")({
  head: () => ({ meta: [{ title: "Polishing · AVS Gold ERP" }] }),
  component: PolishingPage,
});

function PolishingPage() {
  const people = usePeople((s) => s.people);
  const transactions = usePolishing((s) => s.transactions);
  const refresh = usePolishing((s) => s.refresh);
  const isEnabled = useBusinessRules((s) => s.isEnabled);
  const refreshRules = useBusinessRules((s) => s.refresh);
  const moduleEnabled = isEnabled("enable_polishing_module");

  useEffect(() => {
    refresh();
    refreshRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedPolisherId, setSelectedPolisherId] = useState<string>("");

  const polishers = useMemo(
    () =>
      people.filter(
        (p) => p.type === "karigar" || p.type === "worker" || p.type === "outside_worker",
      ),
    [people],
  );

  const ledgerRows = useMemo(() => computePolisherLedger(transactions), [transactions]);
  const currentPosition = useMemo(() => computeCurrentPosition(transactions), [transactions]);
  const selectedRow = ledgerRows.find((r) => r.polisherId === selectedPolisherId);
  const selectedHistory = useMemo(
    () =>
      transactions.filter((t) => t.polisherId === selectedPolisherId).sort((a, b) => b.ts - a.ts),
    [transactions, selectedPolisherId],
  );

  if (!moduleEnabled) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto text-center">
        <PageHeader title="Polishing" subtitle="This module is currently disabled." />
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 mt-6">
          <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-serif text-xl text-gold">Polishing module is off</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Turn on "Enable Polishing Module" in Business Rule settings to use this workflow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Polishing"
        subtitle="Digitized Polishing Register — send gold/product out for polishing and receive it back."
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              className="gap-2"
              onClick={() => setSendOpen(true)}
              data-testid="polishing-send-btn"
            >
              <Sparkles className="h-4 w-4" /> Send to Polishing
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setReceiveOpen(true)}
              data-testid="polishing-receive-btn"
            >
              <PackageCheck className="h-4 w-4" /> Receive from Polishing
            </Button>
          </div>
        }
      />

      {/* Current Position — shop-wide */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Stat label="Gold Sent" value={`${mgToGrams(currentPosition.goldSentFineMg)} g`} />
        <Stat label="Gold Returned" value={`${mgToGrams(currentPosition.goldReturnedFineMg)} g`} />
        <Stat
          label="Pending Gold"
          value={`${mgToGrams(currentPosition.pendingFineMg)} g`}
          tone={currentPosition.pendingFineMg > 0 ? "gold" : undefined}
        />
        <Stat
          label="Pending Jobs"
          value={String(currentPosition.pendingJobs)}
          tone={currentPosition.pendingJobs > 0 ? "gold" : undefined}
        />
        <Stat
          label="Last Activity"
          value={
            currentPosition.lastActivityTs
              ? new Date(currentPosition.lastActivityTs).toLocaleDateString("en-IN")
              : "—"
          }
        />
      </div>

      {/* Per-Polisher Ledger */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border font-serif text-gold">
          Polishing Ledger — by Polisher
        </div>
        {ledgerRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No polishing transactions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-background/40">
                <tr>
                  <th className="text-left px-4 py-2">Polisher</th>
                  <th className="text-right px-4 py-2">Total Issued</th>
                  <th className="text-right px-4 py-2">Total Returned</th>
                  <th className="text-right px-4 py-2">Pending</th>
                  <th className="text-right px-4 py-2">Current Jobs</th>
                  <th className="text-right px-4 py-2">Last Transaction</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((r) => (
                  <tr
                    key={r.polisherId}
                    className={`border-t border-border cursor-pointer hover:bg-background/40 ${selectedPolisherId === r.polisherId ? "bg-gold/5" : ""}`}
                    onClick={() => setSelectedPolisherId(r.polisherId)}
                    data-testid={`polishing-ledger-row-${r.polisherId}`}
                  >
                    <td className="px-4 py-2">{r.polisherName}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {mgToGrams(r.totalIssuedFineMg)} g
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {mgToGrams(r.totalReturnedFineMg)} g
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono ${r.pendingFineMg > 0 ? "text-amber-500" : ""}`}
                    >
                      {mgToGrams(r.pendingFineMg)} g
                    </td>
                    <td className="px-4 py-2 text-right">{r.currentJobs}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {r.lastTransactionTs
                        ? new Date(r.lastTransactionTs).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected polisher's transaction history */}
      {selectedRow && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-serif text-gold">
            {selectedRow.polisherName} — Transaction History
          </div>
          <ul className="divide-y divide-border">
            {selectedHistory.map((t) => (
              <li key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {t.type === "sent" ? (
                    <ArrowUpRight className="h-4 w-4 text-amber-400 shrink-0" />
                  ) : (
                    <ArrowDownLeft className="h-4 w-4 text-emerald-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm">
                      {t.type === "sent" ? "Sent" : "Received"} · {t.product} ·{" "}
                      {mgToGrams(t.grossMg)} g
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {new Date(t.ts).toLocaleString("en-IN")}
                      {t.orderNo ? ` · Order ${t.orderNo}` : ""}
                      {t.expectedReturnDate ? ` · Expected back ${t.expectedReturnDate}` : ""}
                      {t.polishingChargesPaise
                        ? ` · Charges ₹${paiseToRupees(t.polishingChargesPaise)}`
                        : ""}
                      {t.remarks ? ` · ${t.remarks}` : ""}
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    t.type === "sent"
                      ? "border-amber-500/40 text-amber-300"
                      : "border-emerald-500/40 text-emerald-300"
                  }
                >
                  {mgToGrams(t.fineMg)} g fine
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SendToPolishingDialog open={sendOpen} onClose={() => setSendOpen(false)} />
      <ReceiveFromPolishingDialog open={receiveOpen} onClose={() => setReceiveOpen(false)} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-mono ${tone === "gold" ? "text-gold" : ""}`}>{value}</div>
    </div>
  );
}
