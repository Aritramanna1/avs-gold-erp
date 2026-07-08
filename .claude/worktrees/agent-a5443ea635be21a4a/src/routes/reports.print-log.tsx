import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePrintLog, PRINT_DOC_LABELS, REPRINT_REASON_LABELS } from "@/lib/printlog-store";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/reports/print-log")({
  head: () => ({ meta: [{ title: "Print Log · MTJ ERP" }] }),
  component: PrintLogPage,
});

function PrintLogPage() {
  const events = usePrintLog((s) => s.events);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q.trim()) return events;
    const t = q.toLowerCase();
    return events.filter(
      (e) =>
        e.docNumber.toLowerCase().includes(t) ||
        PRINT_DOC_LABELS[e.docType].toLowerCase().includes(t) ||
        (e.linkedLabel ?? "").toLowerCase().includes(t),
    );
  }, [events, q]);

  return (
    <div data-testid="print-log-root" className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Print Log / Reprint Registry"
        subtitle="Every important document printed by the shop is recorded here for audit and reprint tracking."
        actions={
          <Link to="/reports">
            <Button variant="outline" size="sm">
              Back to Reports
            </Button>
          </Link>
        }
      />
      <Card className="p-3 mb-4 flex gap-2">
        <Input
          placeholder="Search document #, type, linked record…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </Card>
      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Printer className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <div>No print events recorded yet.</div>
          <div className="text-xs mt-1">
            Printing any slip, tag or invoice will add an entry here.
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Document</th>
                <th className="text-left p-3">Number</th>
                <th className="text-left p-3">Linked</th>
                <th className="text-left p-3">By</th>
                <th className="text-left p-3">First Printed</th>
                <th className="text-left p-3">Last Printed</th>
                <th className="text-right p-3">Reprints</th>
                <th className="text-left p-3">Last Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const last = e.history[e.history.length - 1];
                return (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-3">{PRINT_DOC_LABELS[e.docType]}</td>
                    <td className="p-3 font-mono text-xs">{e.docNumber}</td>
                    <td className="p-3 text-muted-foreground">
                      {e.linkedLabel || e.linkedId.slice(0, 8)}
                    </td>
                    <td className="p-3">{e.printedBy}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(e.firstPrintedAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(e.lastPrintedAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      {e.reprintCount > 0 ? (
                        <Badge variant="secondary">{e.reprintCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {last?.reason ? REPRINT_REASON_LABELS[last.reason] : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
