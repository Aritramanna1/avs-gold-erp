import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePeople } from "@/lib/people-store";
import { useRepairs } from "@/lib/repair-store";
import { getNextSequenceNumber } from "@/lib/sequence-manager";
import { gramsToMg } from "@/lib/gold";
import { rupeesToPaise } from "@/lib/billing-store";
import type { PaymentMode } from "@/lib/billing-store";
import { ArrowLeft, Save } from "lucide-react";

export const Route = createFileRoute("/repair/polishing/new")({
  head: () => ({ meta: [{ title: "New Polishing Job · MTJ ERP" }] }),
  component: PolishingNew,
});

function PolishingNew() {
  const navigate = useNavigate();
  const people = usePeople((s) => s.people);
  const addPerson = usePeople((s) => s.add);
  const add = useRepairs((s) => s.add);

  const customers = useMemo(
    () => people.filter((p) => p.type === "customer" || p.type === "firm_customer"),
    [people],
  );

  const [customerId, setCustomerId] = useState("");
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [weightIn, setWeightIn] = useState("");
  const [polishingType, setPolishingType] = useState<"polishing" | "rhodium">("polishing");
  const [charge, setCharge] = useState("");
  const [advance, setAdvance] = useState("");
  const [advanceMode, setAdvanceMode] = useState<PaymentMode>("cash");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");

  const onSave = async () => {
    let cid = customerId;
    let cname = customers.find((c) => c.id === customerId)?.fullName ?? "";
    let cphone = customers.find((c) => c.id === customerId)?.phone;
    if (!cid && quickName.trim()) {
      const p = await addPerson({
        type: "customer",
        active: true,
        fullName: quickName.trim(),
        phone: quickPhone.trim(),
      });
      cid = p.id;
      cname = p.fullName;
      cphone = p.phone;
    }
    if (!cid) {
      alert("Select or quick-add a customer");
      return;
    }

    const repairNo = await getNextSequenceNumber("repair");

    const r = add({
      repairNo,
      id: ("pol_" + Date.now()) as string,
      kind: "polishing",
      status: "pending",
      customerId: cid,
      customerName: cname,
      customerPhone: cphone,
      itemType: "Polishing item",
      itemDescription,
      receivedGrossMg: weightIn ? gramsToMg(weightIn) : 0,
      repairType: polishingType,
      expectedDelivery: expectedDelivery || undefined,
      estimatedChargePaise: rupeesToPaise(charge || 0),
      advancePaise: rupeesToPaise(advance || 0),
      advanceMode: advance ? advanceMode : undefined,
      notes,
    });
    navigate({ to: "/repair/$id", params: { id: r.id } });
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/repair">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
      </div>
      <PageHeader title="New Polishing Job" subtitle="Quick polishing / rhodium intake." />
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.fullName} · {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Quick add — Name</Label>
              <Input
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                disabled={!!customerId}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={quickPhone}
                onChange={(e) => setQuickPhone(e.target.value)}
                disabled={!!customerId}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Item Description</Label>
            <Input
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="Gold ring, set..."
            />
          </div>
          <div>
            <Label>Weight In (g)</Label>
            <Input
              value={weightIn}
              onChange={(e) => setWeightIn(e.target.value)}
              placeholder="0.000"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select
              value={polishingType}
              onValueChange={(v) => setPolishingType(v as "polishing" | "rhodium")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="polishing">Polishing</SelectItem>
                <SelectItem value="rhodium">Rhodium Plating</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Charge (₹)</Label>
            <Input value={charge} onChange={(e) => setCharge(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label>Expected Delivery</Label>
            <Input
              type="date"
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
            />
          </div>
          <div>
            <Label>Advance (₹)</Label>
            <Input
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Advance Mode</Label>
            <Select value={advanceMode} onValueChange={(v) => setAdvanceMode(v as PaymentMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Link to="/repair">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={onSave} className="gap-2">
            <Save className="h-4 w-4" /> Save Polishing Job
          </Button>
        </div>
      </div>
    </div>
  );
}
