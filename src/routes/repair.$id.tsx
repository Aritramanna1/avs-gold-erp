import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePrintEngine } from "@/lib/print-engine";
import { PageHeader } from "@/components/app-shell";
import { AttachmentsSection } from "@/components/attachments-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useRepairs,
  REPAIR_STATUS_LABELS,
  REPAIR_TYPE_LABELS,
  REPAIR_KIND_LABELS,
  computeRepairTotals,
  type RepairStatus,
} from "@/lib/repair-store";
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees, rupeesToPaise, PAYMENT_MODE_LABELS } from "@/lib/billing-store";
import type { PaymentMode } from "@/lib/billing-store";
import { ArrowLeft, Printer, Wrench, CheckCircle2, Truck, Wallet, FileText } from "lucide-react";
import { DocCommActions } from "@/components/doc-comm-actions";
import { useSettings } from "@/lib/settings-store";

export const Route = createFileRoute("/repair/$id")({
  head: () => ({ meta: [{ title: "Repair Detail · AVS Gold ERP" }] }),
  component: RepairDetail,
});

function RepairDetail() {
  const { id } = useParams({ from: "/repair/$id" });
  const repair = useRepairs((s) => s.repairs.find((r) => r.id === id));
  const setStatus = useRepairs((s) => s.setStatus);
  const update = useRepairs((s) => s.update);
  const addPayment = useRepairs((s) => s.addPayment);
  const people = usePeople((s) => s.people);
  const karigars = useMemo(
    () => people.filter((p) => p.type === "karigar" || p.type === "worker"),
    [people],
  );

  const [finalCharge, setFinalCharge] = useState("");
  const [polishCharge, setPolishCharge] = useState("");
  const [addnCharge, setAddnCharge] = useState("");
  const [gst, setGst] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<PaymentMode>("cash");
  const [payRef, setPayRef] = useState("");
  const [workerId, setWorkerId] = useState("");

  const { triggerPrint } = usePrintEngine();

  if (!repair) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link to="/repair">
          <Button variant="ghost">← Back</Button>
        </Link>
        <div className="mt-4 text-muted-foreground">Repair not found.</div>
      </div>
    );
  }

  const totals = computeRepairTotals(repair);

  const onAssign = () => {
    const w = karigars.find((k) => k.id === workerId);
    if (!w) return;
    update(repair.id, { workerId: w.id, workerName: w.fullName });
  };
  const onSaveCharges = () => {
    update(repair.id, {
      finalChargePaise: finalCharge
        ? rupeesToPaise(finalCharge)
        : repair.finalChargePaise || repair.estimatedChargePaise,
      polishingChargePaise: polishCharge
        ? rupeesToPaise(polishCharge)
        : repair.polishingChargePaise,
      additionalChargePaise: addnCharge ? rupeesToPaise(addnCharge) : repair.additionalChargePaise,
      gstEnabled: gst || repair.gstEnabled,
    });
  };
  const onPay = () => {
    const amt = rupeesToPaise(payAmount || 0);
    if (amt <= 0) return;
    addPayment(repair.id, { mode: payMode, amountPaise: amt, reference: payRef || undefined });
    setPayAmount("");
    setPayRef("");
  };

  const statusTone: Record<RepairStatus, string> = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    in_work: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    ready: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    delivered: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    cancelled: "bg-muted text-muted-foreground",
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/repair">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <DocCommActions
          printA4Href={`/repair/print/receipt/${repair.id}` as any}
          whatsapp={{
            phone: repair.customerPhone,
            message: `Hello ${repair.customerName},\nYour ${REPAIR_KIND_LABELS[repair.kind]} (${repair.repairNo}) at ${useSettings.getState().firm.shopName} is ${REPAIR_STATUS_LABELS[repair.status]}.\n\nThank you!`,
          }}
          linkedType="repair"
          linkedId={repair.id}
          recipientLabel={repair.customerName}
          variant="compact"
        />
      </div>
      <PageHeader
        title={`${REPAIR_KIND_LABELS[repair.kind]} · ${repair.repairNo}`}
        subtitle={`${repair.customerName}${repair.customerPhone ? " · " + repair.customerPhone : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={statusTone[repair.status]}>
              {REPAIR_STATUS_LABELS[repair.status]}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() =>
                triggerPrint(
                  `/repair/print/receipt/${repair.id}`,
                  `Repair Receipt Preview · ${repair.repairNo}`,
                )
              }
            >
              <Printer className="h-4 w-4" /> Repair Receipt
            </Button>
            {repair.status === "delivered" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  triggerPrint(
                    `/repair/print/delivery/${repair.id}`,
                    `Delivery Slip Preview · ${repair.repairNo}`,
                  )
                }
              >
                <Printer className="h-4 w-4" /> Delivery Slip
              </Button>
            )}
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-md border border-border bg-card p-5">
            <h3 className="font-serif text-gold mb-3">Item Details</h3>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row k="Item Type" v={repair.itemType} />
              <Row k="Description" v={repair.itemDescription || "—"} />
              <Row k="Received Weight" v={`${mgToGrams(repair.receivedGrossMg)} g`} />
              <Row k="Purity" v={repair.purity ? `${repair.purity}/1000` : "—"} />
              <Row k="Repair Type" v={REPAIR_TYPE_LABELS[repair.repairType]} />
              <Row k="Expected Delivery" v={repair.expectedDelivery ?? "—"} />
              <Row k="Worker" v={repair.workerName ?? "Unassigned"} />
              <Row k="Estimated Charge" v={`₹ ${paiseToRupees(repair.estimatedChargePaise)}`} />
            </dl>
            {repair.conditionNotes && (
              <div className="mt-3 text-sm">
                <b>Condition:</b> {repair.conditionNotes}
              </div>
            )}
            {repair.stoneFittingNotes && (
              <div className="mt-1 text-sm">
                <b>Stones/Fittings:</b> {repair.stoneFittingNotes}
              </div>
            )}
            {repair.notes && (
              <div className="mt-1 text-sm">
                <b>Notes:</b> {repair.notes}
              </div>
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-5">
            <h3 className="font-serif text-gold mb-3">Status Timeline</h3>
            <ol className="space-y-2 text-sm">
              {repair.timeline.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-muted-foreground text-xs w-36 shrink-0">
                    {new Date(t.ts).toLocaleString("en-IN")}
                  </span>
                  <span>
                    {t.label}
                    {t.note ? ` — ${t.note}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <Tabs defaultValue="actions">
            <TabsList>
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="charges">Charges & GST</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
            </TabsList>

            <TabsContent value="actions">
              <div className="rounded-md border border-border bg-card p-5 space-y-4">
                <div>
                  <Label>Assign Worker</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={workerId} onValueChange={setWorkerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose karigar/worker" />
                      </SelectTrigger>
                      <SelectContent>
                        {karigars.map((k) => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={onAssign} variant="outline">
                      Assign
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setStatus(repair.id, "in_work")}
                    disabled={repair.status === "delivered" || repair.status === "cancelled"}
                    variant="outline"
                    className="gap-2"
                  >
                    <Wrench className="h-4 w-4" /> Mark In Work
                  </Button>
                  <Button
                    onClick={() => setStatus(repair.id, "ready")}
                    disabled={repair.status === "delivered" || repair.status === "cancelled"}
                    variant="outline"
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark Ready
                  </Button>
                  <Button
                    onClick={() => setStatus(repair.id, "delivered")}
                    disabled={totals.balancePaise > 0 || repair.status === "cancelled"}
                    className="gap-2"
                  >
                    <Truck className="h-4 w-4" /> Mark Delivered
                  </Button>
                  <Button
                    onClick={() => setStatus(repair.id, "cancelled")}
                    variant="ghost"
                    className="text-destructive"
                  >
                    Cancel
                  </Button>
                </div>
                {totals.balancePaise > 0 && (
                  <p className="text-xs text-amber-400">
                    Outstanding balance ₹ {paiseToRupees(totals.balancePaise)} — collect payment
                    before delivery.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="charges">
              <div className="rounded-md border border-border bg-card p-5 space-y-3">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Final Repair Charge (₹)</Label>
                    <Input
                      value={finalCharge}
                      onChange={(e) => setFinalCharge(e.target.value)}
                      placeholder={paiseToRupees(
                        repair.finalChargePaise || repair.estimatedChargePaise,
                      )}
                    />
                  </div>
                  <div>
                    <Label>Polishing Charge (₹)</Label>
                    <Input
                      value={polishCharge}
                      onChange={(e) => setPolishCharge(e.target.value)}
                      placeholder={paiseToRupees(repair.polishingChargePaise)}
                    />
                  </div>
                  <div>
                    <Label>Additional Material (₹)</Label>
                    <Input
                      value={addnCharge}
                      onChange={(e) => setAddnCharge(e.target.value)}
                      placeholder={paiseToRupees(repair.additionalChargePaise)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={gst || repair.gstEnabled}
                    onCheckedChange={(v) => setGst(v)}
                    id="gst"
                  />
                  <Label htmlFor="gst">Apply GST 3% on service charge</Label>
                </div>
                <Button onClick={onSaveCharges}>Save Charges</Button>
                <div className="text-sm border-t border-border pt-3">
                  <div className="flex justify-between">
                    <span>Base</span>
                    <span>₹ {paiseToRupees(totals.baseChargePaise)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST</span>
                    <span>₹ {paiseToRupees(totals.gstPaise)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gold">
                    <span>Grand Total</span>
                    <span>₹ {paiseToRupees(totals.grandTotalPaise)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paid (incl. advance)</span>
                    <span>₹ {paiseToRupees(totals.paidPaise)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Balance</span>
                    <span>₹ {paiseToRupees(totals.balancePaise)}</span>
                  </div>
                </div>
                <Link to="/repair/print/$kind/$id" params={{ kind: "invoice", id: repair.id }}>
                  <Button variant="outline" className="gap-2 mt-2">
                    <FileText className="h-4 w-4" /> Print Repair Invoice
                  </Button>
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="payments">
              <div className="rounded-md border border-border bg-card p-5 space-y-3">
                <div className="text-sm">
                  <b>Advance:</b> ₹ {paiseToRupees(repair.advancePaise)}{" "}
                  {repair.advanceMode ? `· ${PAYMENT_MODE_LABELS[repair.advanceMode]}` : ""}
                </div>
                <div className="grid sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Mode</Label>
                    <Select value={payMode} onValueChange={(v) => setPayMode(v as PaymentMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="outstanding">Outstanding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reference</Label>
                    <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                  </div>
                  <Button onClick={onPay} className="gap-2">
                    <Wallet className="h-4 w-4" /> Record Payment
                  </Button>
                </div>
                {repair.payments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No payments yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-left">Mode</th>
                          <th className="p-2 text-left">Ref</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repair.payments.map((p) => (
                          <tr key={p.id} className="border-t border-border">
                            <td className="p-2">{new Date(p.ts).toLocaleString("en-IN")}</td>
                            <td className="p-2">{PAYMENT_MODE_LABELS[p.mode]}</td>
                            <td className="p-2">{p.reference ?? "—"}</td>
                            <td className="p-2 text-right">₹ {paiseToRupees(p.amountPaise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() =>
                    triggerPrint(
                      `/repair/print/payment/${repair.id}`,
                      `Payment Receipt Preview · ${repair.repairNo}`,
                    )
                  }
                >
                  <Printer className="h-4 w-4" /> Print Payment Receipt
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-gold/30 bg-gold/5 p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Customer</div>
            <div className="font-serif text-gold text-lg">{repair.customerName}</div>
            {repair.customerPhone && <div className="text-sm">{repair.customerPhone}</div>}
            <Link to="/people">
              <Button variant="ghost" size="sm" className="mt-2">
                View Customers
              </Button>
            </Link>
          </div>
          <div className="rounded-md border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Quick Actions
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() =>
                  triggerPrint(
                    `/repair/print/receipt/${repair.id}`,
                    `Repair Receipt Preview · ${repair.repairNo}`,
                  )
                }
              >
                <Printer className="h-4 w-4" /> Repair Receipt
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() =>
                  triggerPrint(
                    `/repair/print/invoice/${repair.id}`,
                    `Repair Invoice Preview · ${repair.repairNo}`,
                  )
                }
              >
                <Printer className="h-4 w-4" /> Repair Invoice
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() =>
                  triggerPrint(
                    `/repair/print/delivery/${repair.id}`,
                    `Delivery Slip Preview · ${repair.repairNo}`,
                  )
                }
              >
                <Printer className="h-4 w-4" /> Delivery Slip
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() =>
                  triggerPrint(
                    `/repair/print/payment/${repair.id}`,
                    `Payment Receipt Preview · ${repair.repairNo}`,
                  )
                }
              >
                <Printer className="h-4 w-4" /> Payment Receipt
              </Button>
            </div>
          </div>
          <AttachmentsSection
            entityType="repair"
            entityId={repair.id}
            slots={[
              { key: "item_photo", label: "Item photo" },
              { key: "condition_photo", label: "Condition photo" },
              { key: "reference", label: "Repair reference" },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </>
  );
}
