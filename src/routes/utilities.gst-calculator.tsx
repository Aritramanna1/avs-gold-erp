import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";

export const Route = createFileRoute("/utilities/gst-calculator")({
  head: () => ({ meta: [{ title: "GST Calculator · AVS ERP" }] }),
  component: GstCalculatorPage,
});

function GstCalculatorPage() {
  const [taxable, setTaxable] = useState("");
  const [ratePct, setRatePct] = useState("3");
  const taxablePaise = Math.round(parseFloat(taxable || "0") * 100);
  const rate = parseFloat(ratePct || "0") || 0;
  const gstPaise = Math.round((taxablePaise * rate) / 100);
  const half = Math.round(gstPaise / 2);
  const cgst = half;
  const sgst = gstPaise - half;
  const grand = taxablePaise + gstPaise;

  const fmt = (p: number) => (p / 100).toFixed(2);

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto space-y-6">
      <PageHeader
        title="GST Calculator"
        subtitle="Offline GHT Calculations utility — worksheet only; invoices use billing tax engine"
        actions={<SourceOfTruthBadge variant="report" />}
      />
      <div className="erp-surface rounded-xl p-5 space-y-4">
        <div>
          <Label>Taxable amount ₹</Label>
          <Input
            className="font-mono"
            value={taxable}
            onChange={(e) => setTaxable(e.target.value)}
            placeholder="100000"
          />
        </div>
        <div>
          <Label>GST %</Label>
          <Input
            className="font-mono"
            value={ratePct}
            onChange={(e) => setRatePct(e.target.value)}
          />
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm font-mono">
          <dt className="text-muted-foreground">CGST</dt>
          <dd className="text-right">{fmt(cgst)}</dd>
          <dt className="text-muted-foreground">SGST</dt>
          <dd className="text-right">{fmt(sgst)}</dd>
          <dt className="text-muted-foreground">Total GST</dt>
          <dd className="text-right">{fmt(gstPaise)}</dd>
          <dt className="font-semibold">Grand total</dt>
          <dd className="text-right font-semibold">{fmt(grand)}</dd>
        </dl>
        <Button variant="outline" asChild>
          <Link to="/reports/gst-returns">Open GST Returns</Link>
        </Button>
      </div>
    </div>
  );
}
