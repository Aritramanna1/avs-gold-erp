import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDraft } from "@/lib/drafts-store";
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
import { useRepairs, REPAIR_TYPE_LABELS, type RepairType } from "@/lib/repair-store";
import { getNextSequenceNumber } from "@/lib/sequence-manager";
import { gramsToMg } from "@/lib/gold";
import { rupeesToPaise } from "@/lib/billing-store";
import type { PaymentMode } from "@/lib/billing-store";
import { ArrowLeft, Camera, ImageIcon, Save } from "lucide-react";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/repair/new")({
  head: () => ({ meta: [{ title: "New Repair Intake · AVS Gold ERP" }] }),
  component: RepairNew,
});

function RepairNew() {
  const navigate = useNavigate();
  const people = usePeople((s) => s.people);
  const addPerson = usePeople((s) => s.add);
  const add = useRepairs((s) => s.add);
  const [draftId, setDraftId, clearDraftId] = useDraft(
    "mtj-repair-draftId-v1",
    () => "rp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
  );

  const customers = useMemo(
    () => people.filter((p) => p.type === "customer" || p.type === "firm_customer"),
    [people],
  );
  const karigars = useMemo(
    () => people.filter((p) => p.type === "karigar" || p.type === "worker"),
    [people],
  );

  const [customerId, setCustomerId, clearCustomerId] = useDraft("mtj-repair-customerId-v1", "");
  const [quickName, setQuickName, clearQuickName] = useDraft("mtj-repair-quickName-v1", "");
  const [quickPhone, setQuickPhone, clearQuickPhone] = useDraft("mtj-repair-quickPhone-v1", "");

  const [itemType, setItemType, clearItemType] = useDraft("mtj-repair-itemType-v1", "Chain");
  const [itemDescription, setItemDescription, clearItemDescription] = useDraft(
    "mtj-repair-itemDescription-v1",
    "",
  );
  const [conditionNotes, setConditionNotes, clearConditionNotes] = useDraft(
    "mtj-repair-conditionNotes-v1",
    "",
  );
  const [stoneFittingNotes, setStoneFittingNotes, clearStoneFittingNotes] = useDraft(
    "mtj-repair-stoneFittingNotes-v1",
    "",
  );
  const [receivedGrams, setReceivedGrams, clearReceivedGrams] = useDraft(
    "mtj-repair-receivedGrams-v1",
    "",
  );
  const [purity, setPurity, clearPurity] = useDraft("mtj-repair-purity-v1", "916");

  const [repairType, setRepairType, clearRepairType] = useDraft<RepairType>(
    "mtj-repair-repairType-v1",
    "chain_repair",
  );
  const [workerId, setWorkerId, clearWorkerId] = useDraft("mtj-repair-workerId-v1", "");
  const [expectedDelivery, setExpectedDelivery, clearExpectedDelivery] = useDraft(
    "mtj-repair-expectedDelivery-v1",
    "",
  );
  const [estimated, setEstimated, clearEstimated] = useDraft("mtj-repair-estimated-v1", "");
  const [advance, setAdvance, clearAdvance] = useDraft("mtj-repair-advance-v1", "");
  const [advanceMode, setAdvanceMode, clearAdvanceMode] = useDraft<PaymentMode>(
    "mtj-repair-advanceMode-v1",
    "cash",
  );
  const [notes, setNotes, clearNotes] = useDraft("mtj-repair-notes-v1", "");

  const cust = customers.find((c) => c.id === customerId);

  const onSave = async () => {
    let cid = customerId;
    let cname = cust?.fullName ?? "";
    let cphone = cust?.phone ?? undefined;
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
      toast.error("Select or quick-add a customer.");
      return;
    }
    if (!itemType.trim()) {
      toast.error("Item type is required.");
      return;
    }
    const gross = receivedGrams ? gramsToMg(receivedGrams) : 0;
    const w = karigars.find((k) => k.id === workerId);

    const repairNo = await getNextSequenceNumber("repair");

    const r = add({
      id: draftId,
      repairNo,
      kind: "repair",
      status: "pending",
      customerId: cid,
      customerName: cname,
      customerPhone: cphone,
      itemType,
      itemDescription,
      conditionNotes,
      stoneFittingNotes,
      receivedGrossMg: gross,
      purity: purity ? Number(purity) : undefined,
      repairType,
      workerId: w?.id,
      workerName: w?.fullName,
      expectedDelivery: expectedDelivery || undefined,
      estimatedChargePaise: rupeesToPaise(estimated || 0),
      advancePaise: rupeesToPaise(advance || 0),
      advanceMode: advance ? advanceMode : undefined,
      notes,
    });

    clearDraftId();
    clearCustomerId();
    clearQuickName();
    clearQuickPhone();
    clearItemType();
    clearItemDescription();
    clearConditionNotes();
    clearStoneFittingNotes();
    clearReceivedGrams();
    clearPurity();
    clearRepairType();
    clearWorkerId();
    clearExpectedDelivery();
    clearEstimated();
    clearAdvance();
    clearAdvanceMode();
    clearNotes();

    navigate({ to: "/repair/$id", params: { id: r.id } });
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/repair">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
      </div>
      <PageHeader title="New Repair Intake" subtitle="Receive a repair item from the customer." />

      <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
        <section>
          <h2 className="font-serif text-gold text-lg mb-3">Customer</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Select Customer</Label>
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
                  placeholder="New customer name"
                  disabled={!!customerId}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  placeholder="Phone"
                  disabled={!!customerId}
                />
              </div>
            </div>
          </div>
          {cust && (
            <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm">
              <b>{cust.fullName}</b> · {cust.phone} · {cust.villageCity ?? ""}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-serif text-gold text-lg mb-3">Item</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Item Type</Label>
              <Input
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                placeholder="Chain, Ring..."
              />
            </div>
            <div>
              <Label>Received Weight (g)</Label>
              <Input
                value={receivedGrams}
                onChange={(e) => setReceivedGrams(e.target.value)}
                placeholder="0.000"
              />
            </div>
            <div>
              <Label>Purity (per-mille)</Label>
              <Input value={purity} onChange={(e) => setPurity(e.target.value)} placeholder="916" />
            </div>
            <div>
              <Label>Item Description</Label>
              <Input
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Short description"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Condition Notes</Label>
              <Textarea
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                placeholder="Broken clasp, scratches..."
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Stone / Fitting Notes</Label>
              <Textarea
                value={stoneFittingNotes}
                onChange={(e) => setStoneFittingNotes(e.target.value)}
                placeholder="Stones present, fittings..."
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <AttachmentButton
              entityType="repair"
              entityId={draftId}
              docKey="item_photo"
              docLabel="Item photo"
              title="Upload Item Photo"
              variant="outline"
              size="sm"
            />
            <AttachmentButton
              entityType="repair"
              entityId={draftId}
              docKey="condition_photo"
              docLabel="Condition photo"
              title="Upload Condition Photo"
              variant="outline"
              size="sm"
            />
          </div>
        </section>

        <section>
          <h2 className="font-serif text-gold text-lg mb-3">Repair</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Repair Type</Label>
              <Select value={repairType} onValueChange={(v) => setRepairType(v as RepairType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REPAIR_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned Worker / Karigar</Label>
              <Select value={workerId} onValueChange={setWorkerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {karigars.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estimated Charge (₹)</Label>
              <Input
                value={estimated}
                onChange={(e) => setEstimated(e.target.value)}
                placeholder="0.00"
              />
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
              <Label>Advance Received (₹)</Label>
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
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Gold issue for repair will be enabled in future workshop phase. If additional gold is
            required, record it on the paper register for now.
          </p>
        </section>

        <div className="flex justify-end gap-2 pt-2">
          <Link to="/repair">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={onSave} className="gap-2">
            <Save className="h-4 w-4" /> Save Repair Intake
          </Button>
        </div>
      </div>
    </div>
  );
}
