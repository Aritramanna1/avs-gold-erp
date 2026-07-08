import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEstimates } from "@/lib/billing-documents-store";
import { paiseToRupees } from "@/lib/billing-store";
import { Search } from "lucide-react";

export const Route = createFileRoute("/billing/estimates/")({
  head: () => ({ meta: [{ title: "Estimates · AVS Gold ERP" }] }),
  component: EstimatesIndex,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  converted: "Converted",
  expired: "Expired",
  cancelled: "Cancelled",
};

function EstimatesIndex() {
  const estimates = useEstimates((s) => s.estimates);
  const refresh = useEstimates((s) => s.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const t = q.toLowerCase();
    return estimates.filter((e) => {
      if (!t) return true;
      return e.estimateNo.toLowerCase().includes(t) || e.customerName.toLowerCase().includes(t);
    });
  }, [estimates, q]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Estimates / Quotations"
        subtitle="Draft quotes that can be converted into a real invoice once accepted. Create one from the New Bill screen."
      />

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="relative max-w-sm mb-3">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search estimate, customer"
            className="pl-9"
          />
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No estimates yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Estimate</th>
                  <th className="text-left">Customer</th>
                  <th className="text-right">Grand Total</th>
                  <th className="text-left pl-3">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="border-b border-border/60 hover:bg-background/30">
                    <td className="py-2 font-mono text-xs text-gold">{e.estimateNo}</td>
                    <td>{e.customerName}</td>
                    <td className="text-right">₹ {paiseToRupees(e.grandTotalPaise)}</td>
                    <td className="pl-3">
                      <Badge variant="outline" className="text-[10px]">
                        {STATUS_LABEL[e.status]}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <Link to="/billing/estimates/$id" params={{ id: e.id }}>
                        <Button size="sm" variant="outline">
                          Open
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
