import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePeople } from "@/lib/people-store";
import {
  computeInvoiceTotals,
  computeItemTotals,
  useBilling,
  type GstKind,
  type PaymentMode,
} from "@/lib/billing-store";
import { useSettings } from "@/lib/settings-store";
import { fineGoldMg, gramsToMg, mgToGrams } from "@/lib/gold";

export function WorkshopBillingModule() {
  const navigate = useNavigate();
  const people = usePeople((s) => s.people).filter(
    (p) => p.type === "customer" || p.type === "firm_customer",
  );
  const addInvoice = useBilling((s) => s.add);
  const rate = useSettings((s) => s.goldRatePerGramPaise || s.goldRate24KPerGramPaise);
  const branchId = useSettings((s) => s.selectedBranchId || undefined);
  const [customerId, setCustomerId] = useState("");
  const [itemName, setItemName] = useState("Workshop job");
  const [gross, setGross] = useState("");
  const [net, setNet] = useState("");
  const [purity, setPurity] = useState("916");
  const [making, setMaking] = useState("");
  const [payment, setPayment] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [gst, setGst] = useState<GstKind>("gst3");
  const [saving, setSaving] = useState(false);

  const customer = people.find((p) => p.id === customerId);
  const grossMg = gramsToMg(Number(gross) || 0);
  const netMg = gramsToMg(Number(net || gross) || 0);
  const fineMg = fineGoldMg(netMg, Number(purity) || 0);
  const item = useMemo(() => {
    const base = {
      id: "workshop-line",
      itemName,
      category: "workshop",
      purity: Number(purity) || 0,
      grossMg,
      netMg,
      fineMg,
      goldRatePerGramPaise: rate || 0,
      makingChargesPaise: Math.round((Number(making) || 0) * 100),
      stoneChargesPaise: 0,
      hallmarkChargesPaise: 0,
      otherChargesPaise: 0,
      discountPaise: 0,
      chargeMode: "job_work" as const,
    };
    return { ...base, ...computeItemTotals(base) };
  }, [itemName, purity, grossMg, netMg, fineMg, rate, making]);

  const totals = computeInvoiceTotals([item], gst, undefined, []);

  async function save() {
    if (!customer || !itemName.trim() || netMg <= 0 || fineMg <= 0) {
      toast.error("Select a customer and enter a valid gold weight and purity.");
      return;
    }
    setSaving(true);
    try {
      const paid = Math.max(0, Math.round((Number(payment) || 0) * 100));
      const payments =
        paid > 0
          ? [{ id: crypto.randomUUID(), ts: Date.now(), mode: paymentMode, amountPaise: paid }]
          : [];
      const finalTotals = computeInvoiceTotals([item], gst, undefined, payments);
      const invoice = await addInvoice({
        branchId,
        billingType: "workshop",
        status: finalTotals.balancePaise <= 0 ? "paid" : paid > 0 ? "partial" : "issued",
        customerId: customer.id,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        items: [item],
        gst,
        ...finalTotals,
        payments,
        notes: "Workshop billing",
      });
      toast.success(`Invoice ${invoice.invoiceNo} created.`);
      navigate({ to: "/billing/$id", params: { id: invoice.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        title="New Workshop Bill"
        subtitle="Record workshop charges against a jeweller or customer."
      />
      <Card>
        <CardHeader>
          <CardTitle>Gold and billing details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer / Jeweller">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select party</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} />
          </Field>
          <Field label="Gross weight (g)">
            <Input inputMode="decimal" value={gross} onChange={(e) => setGross(e.target.value)} />
          </Field>
          <Field label="Net weight (g)">
            <Input
              inputMode="decimal"
              value={net}
              onChange={(e) => setNet(e.target.value)}
              placeholder={gross || "0"}
            />
          </Field>
          <Field label="Purity (per mille)">
            <Input inputMode="numeric" value={purity} onChange={(e) => setPurity(e.target.value)} />
          </Field>
          <Field label="Making charges (₹)">
            <Input inputMode="decimal" value={making} onChange={(e) => setMaking(e.target.value)} />
          </Field>
          <Field label="Payment received (₹)">
            <Input
              inputMode="decimal"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            />
          </Field>
          <Field label="Payment mode">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank</option>
              <option value="outstanding">Outstanding</option>
            </select>
          </Field>
          <Field label="GST">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={gst}
              onChange={(e) => setGst(e.target.value as GstKind)}
            >
              <option value="gst3">GST 3%</option>
              <option value="none">No GST</option>
            </select>
          </Field>
          <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm sm:col-span-2">
            Fine gold: <strong className="text-gold">{mgToGrams(fineMg)} g</strong> · Bill total:{" "}
            <strong>₹{(totals.grandTotalPaise / 100).toFixed(2)}</strong>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="outline" onClick={() => navigate({ to: "/billing" })}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Create bill"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
