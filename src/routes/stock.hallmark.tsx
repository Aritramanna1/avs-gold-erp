import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings } from "@/lib/settings-store";
import { useStock } from "@/lib/stock-store";
import { useHallmarkBatches, loadHallmarkBatches, type HallmarkBatch } from "@/lib/hallmark-store";
import { supabase } from "@/integrations/supabase/client";
import { Stamp, Plus, CheckCircle2, XCircle, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stock/hallmark")({
  head: () => ({ meta: [{ title: "Hallmark Lifecycle · AVS Gold ERP" }] }),
  component: HallmarkPage,
});

function HallmarkPage() {
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const batches = useHallmarkBatches((s) => s.batches);
  const [sending, setSending] = useState(false);
  const [receivingLine, setReceivingLine] = useState<{
    batch: HallmarkBatch;
    itemId: string;
    itemCode: string;
  } | null>(null);

  useEffect(() => {
    void loadHallmarkBatches();
  }, []);

  const branchBatches = useMemo(
    () =>
      batches
        .filter((b) => b.branchId === (selectedBranchId || "MAIN"))
        .sort((a, b) => b.sentAt - a.sentAt),
    [batches, selectedBranchId],
  );

  async function actor() {
    const { data } = await supabase.auth.getSession();
    return { id: data.session?.user.id ?? null, email: data.session?.user.email ?? null };
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Hallmark Lifecycle"
        subtitle="Track batches sent to the assay/hallmarking center through to HUID receipt or rejection."
        actions={
          <Button onClick={() => setSending(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Send Batch
          </Button>
        }
      />

      <div className="grid gap-4">
        {branchBatches.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            No hallmark batches yet for this branch.
          </div>
        )}
        {branchBatches.map((batch) => (
          <div key={batch.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Stamp className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{batch.batchNumber}</span>
                <Badge
                  variant={
                    batch.status === "received"
                      ? "secondary"
                      : batch.status === "closed"
                        ? "outline"
                        : "default"
                  }
                >
                  {batch.status.replace(/_/g, " ")}
                </Badge>
              </div>
              {batch.status === "received" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => useHallmarkBatches.getState().close(batch.id)}
                >
                  <Lock className="h-3.5 w-3.5" /> Close Batch
                </Button>
              )}
            </div>
            <div className="text-sm text-muted-foreground mb-3">
              Sent to {batch.assayCenterName} on {new Date(batch.sentAt).toLocaleDateString()} ·{" "}
              {batch.lines.length} items
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className="p-2">Item Code</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">HUID / Reason</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.lines.map((l) => (
                      <tr key={l.itemId} className="border-b border-border last:border-0">
                        <td className="p-2">{l.itemCode}</td>
                        <td className="p-2">
                          {l.status === "received" && (
                            <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Received
                            </Badge>
                          )}
                          {l.status === "rejected" && (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" /> Rejected
                            </Badge>
                          )}
                          {l.status === "pending" && <Badge variant="outline">Pending</Badge>}
                        </td>
                        <td className="p-2">{l.huid ?? l.rejectionReason ?? "—"}</td>
                        <td className="p-2 text-right">
                          {l.status === "pending" && (
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setReceivingLine({
                                    batch,
                                    itemId: l.itemId,
                                    itemCode: l.itemCode,
                                  })
                                }
                              >
                                Receive
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => {
                                  const reason = window.prompt("Rejection reason?") ?? "";
                                  if (reason)
                                    useHallmarkBatches
                                      .getState()
                                      .rejectItem(batch.id, l.itemId, reason);
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SendBatchDialog
        open={sending}
        onClose={() => setSending(false)}
        branchId={selectedBranchId || "MAIN"}
      />
      {receivingLine && (
        <ReceiveDialog
          itemCode={receivingLine.itemCode}
          onClose={() => setReceivingLine(null)}
          onConfirm={async (huid) => {
            const who = await actor();
            await useHallmarkBatches
              .getState()
              .receiveItem(receivingLine.batch.id, receivingLine.itemId, huid, who);
            toast.success(`${receivingLine.itemCode} received with HUID ${huid}.`);
            setReceivingLine(null);
          }}
        />
      )}
    </div>
  );
}

function SendBatchDialog({
  open,
  onClose,
  branchId,
}: {
  open: boolean;
  onClose: () => void;
  branchId: string;
}) {
  const items = useStock((s) => s.items);
  const [assayCenterName, setAssayCenterName] = useState("");
  const [notes, setNotes] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((i) => !i.huid)
      .filter(
        (i) =>
          !needle ||
          i.itemCode.toLowerCase().includes(needle) ||
          i.itemName.toLowerCase().includes(needle),
      )
      .slice(0, 50);
  }, [items, q]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleSend() {
    if (!assayCenterName.trim() || selected.size === 0) {
      toast.error("Enter the assay center name and select at least one item.");
      return;
    }
    setSaving(true);
    try {
      const batch = await useHallmarkBatches.getState().send({
        branchId,
        assayCenterName,
        itemIds: Array.from(selected),
        notes: notes || undefined,
      });
      toast.success(`Batch ${batch.batchNumber} sent with ${selected.size} items.`);
      setSelected(new Set());
      setAssayCenterName("");
      setNotes("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Batch to Assay Center</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1">
            <Label>Assay/Hallmarking Center *</Label>
            <Input value={assayCenterName} onChange={(e) => setAssayCenterName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Label>Items without HUID ({selected.size} selected)</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items"
              className="my-2"
            />
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              {candidates.map((i) => (
                <label
                  key={i.id}
                  className="flex items-center justify-between p-2 border-b border-border last:border-0 text-sm cursor-pointer"
                >
                  <span>
                    {i.itemCode} · {i.itemName}
                  </span>
                  <input
                    type="checkbox"
                    checked={selected.has(i.id)}
                    onChange={() => toggle(i.id)}
                  />
                </label>
              ))}
              {candidates.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">
                  No un-hallmarked items found.
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={saving}>
            Send Batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveDialog({
  itemCode,
  onClose,
  onConfirm,
}: {
  itemCode: string;
  onClose: () => void;
  onConfirm: (huid: string) => void;
}) {
  const [huid, setHuid] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive {itemCode}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <Label>HUID *</Label>
          <Input
            value={huid}
            onChange={(e) => setHuid(e.target.value)}
            placeholder="6-digit HUID"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => huid.trim() && onConfirm(huid.trim())} disabled={!huid.trim()}>
            Confirm Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
