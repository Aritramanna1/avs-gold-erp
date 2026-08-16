import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useRepairs,
  REPAIR_STATUS_LABELS,
  REPAIR_TYPE_LABELS,
  computeRepairTotals,
  type Repair,
  type RepairStatus,
} from "@/lib/repair-store";
import { paiseToRupees } from "@/lib/billing-store";
import { Plus, Search, Wrench, Sparkles, Eye } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export const Route = createFileRoute("/repair/")({
  head: () => ({ meta: [{ title: "Repair · AVS Gold ERP" }] }),
  component: RepairIndex,
});

const STATUS_TONE: Record<RepairStatus, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  in_work: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  ready: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  delivered: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

function RepairIndex() {
  const repairs = useRepairs((s) => s.repairs);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    if (!t) return repairs;
    return repairs.filter(
      (r) =>
        r.repairNo.toLowerCase().includes(t) ||
        r.customerName.toLowerCase().includes(t) ||
        (r.customerPhone ?? "").includes(t) ||
        r.itemType.toLowerCase().includes(t),
    );
  }, [repairs, q]);

  const repairsOnly = filtered.filter((r) => r.kind === "repair");
  const polishingOnly = filtered.filter((r) => r.kind === "polishing");
  const byStatus = (list: Repair[], s: RepairStatus) => list.filter((r) => r.status === s);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Repair / Polishing"
        subtitle="Customer repairs, polishing and re-delivery."
        actions={
          <div className="flex gap-2">
            <Link to="/repair/polishing/new">
              <Button variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" /> New Polishing
              </Button>
            </Link>
            <Link to="/repair/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New Repair Intake
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card label="Pending" value={byStatus(repairsOnly, "pending").length} />
        <Card label="In Work" value={byStatus(repairsOnly, "in_work").length} />
        <Card label="Ready" value={byStatus(repairsOnly, "ready").length} />
        <Card label="Delivered" value={byStatus(repairsOnly, "delivered").length} />
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search repair no / customer / phone"
          className="pl-9"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Mobile Tab Select */}
        <div className="block md:hidden mb-4">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_work">In Work</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="delivered">Delivered / History</SelectItem>
              <SelectItem value="polishing">Polishing Jobs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop TabsList */}
        <TabsList className="hidden md:flex">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in_work">In Work</TabsTrigger>
          <TabsTrigger value="ready">Ready</TabsTrigger>
          <TabsTrigger value="delivered">Delivered / History</TabsTrigger>
          <TabsTrigger value="polishing">Polishing Jobs</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <RepairTable rows={byStatus(repairsOnly, "pending")} />
        </TabsContent>
        <TabsContent value="in_work">
          <RepairTable rows={byStatus(repairsOnly, "in_work")} />
        </TabsContent>
        <TabsContent value="ready">
          <RepairTable rows={byStatus(repairsOnly, "ready")} />
        </TabsContent>
        <TabsContent value="delivered">
          <RepairTable rows={byStatus(repairsOnly, "delivered")} />
        </TabsContent>
        <TabsContent value="polishing">
          <RepairTable rows={polishingOnly} polishing />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-serif text-gold mt-1">{value}</div>
    </div>
  );
}

function RepairTable({ rows, polishing }: { rows: Repair[]; polishing?: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-10 text-center text-muted-foreground">
        <Wrench className="h-6 w-6 mx-auto mb-2 opacity-60" />
        No records yet.
      </div>
    );
  }
  return (
    <>
      {/* Mobile view */}
      <div className="md:hidden space-y-3">
        {rows.map((r) => {
          const t = computeRepairTotals(r);
          return (
            <div
              key={r.id}
              className="rounded-md border border-border bg-card p-4 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-gold font-semibold">{r.repairNo}</span>
                <Badge variant="outline" className={STATUS_TONE[r.status]}>
                  {REPAIR_STATUS_LABELS[r.status]}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Customer</span>
                  <span className="font-medium text-foreground">{r.customerName}</span>
                  {r.customerPhone && (
                    <span className="block text-[10px] text-muted-foreground">
                      {r.customerPhone}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Item</span>
                  <span className="font-medium text-foreground">{r.itemType}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Type</span>
                  <span className="font-medium text-foreground">
                    {polishing ? "Polishing" : REPAIR_TYPE_LABELS[r.repairType]}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Expected Date</span>
                  <span className="font-medium text-foreground">{r.expectedDelivery ?? "—"}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <span className="font-semibold text-gold">
                  Balance: ₹{paiseToRupees(t.balancePaise)}
                </span>
                <Link to="/repair/$id" params={{ id: r.id }}>
                  <Button size="sm" variant="ghost" className="gap-1 h-8 text-xs">
                    <Eye className="h-3 w-3" /> View
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">No.</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Item</th>
                <th className="p-3">Type</th>
                <th className="p-3">Expected</th>
                <th className="p-3 text-right">Balance ₹</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = computeRepairTotals(r);
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3 font-mono">{r.repairNo}</td>
                    <td className="p-3">
                      <div>{r.customerName}</div>
                      {r.customerPhone && (
                        <div className="text-xs text-muted-foreground">{r.customerPhone}</div>
                      )}
                    </td>
                    <td className="p-3">{r.itemType}</td>
                    <td className="p-3">
                      {polishing ? "Polishing" : REPAIR_TYPE_LABELS[r.repairType]}
                    </td>
                    <td className="p-3">{r.expectedDelivery ?? "—"}</td>
                    <td className="p-3 text-right">{paiseToRupees(t.balancePaise)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={STATUS_TONE[r.status]}>
                        {REPAIR_STATUS_LABELS[r.status]}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Link to="/repair/$id" params={{ id: r.id }}>
                        <Button size="sm" variant="ghost" className="gap-1">
                          <Eye className="h-3 w-3" /> Open
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
