import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { usePeople } from "@/lib/people-store";
import { useStock } from "@/lib/stock-store";
import { useLedger } from "@/lib/ledger-store";
import { gramsToMg, fineGoldMg, parsePurity, assertNetNotAboveGross } from "@/lib/gold";
import { toast } from "sonner";

export const Route = createFileRoute("/utilities/item-transaction")({
  head: () => ({ meta: [{ title: "Item Transaction Entry · AVS ERP" }] }),
  component: ItemTransactionEntryPage,
});

type PostMode = "stock" | "ledger";
type Direction = "jama" | "nave";

function ItemTransactionEntryPage() {
  const people = usePeople((s) => s.people);
  const addReadyStock = useStock((s) => s.addReadyStock);
  const append = useLedger((s) => s.append);
  const [mode, setMode] = useState<PostMode>("stock");
  const [direction, setDirection] = useState<Direction>("jama");
  const [partyId, setPartyId] = useState("");
  const [itemName, setItemName] = useState("");
  const [grossG, setGrossG] = useState("");
  const [netG, setNetG] = useState("");
  const [purity, setPurity] = useState("916");
  const [fineG, setFineG] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const grossMg = gramsToMg(grossG);
      const netMg = gramsToMg(netG || grossG);
      const p = parsePurity(purity);
      assertNetNotAboveGross(grossMg, netMg, "Item transaction");
      let fineMg = fineG.trim() ? gramsToMg(fineG) : fineGoldMg(netMg, p);
      if (grossMg <= 0 || fineMg <= 0) throw new Error("Enter positive weights.");

      if (mode === "stock") {
        if (direction === "nave") {
          toast.error("Nave stock out: use Ready Stock sell / billing, or switch to ledger adjustment.");
          return;
        }
        if (!itemName.trim()) throw new Error("Item name required for stock entry.");
        await addReadyStock(
          {
            itemName: itemName.trim(),
            category: "Item Txn",
            purity: p,
            grossMg,
            netMg,
            location: "safe",
            status: "available",
            linkedCustomerId: partyId || undefined,
            notes:
              notes.trim() ||
              `Item txn Jama${partyId ? ` · party ${partyId}` : ""}`,
          },
          "purchased",
        );
        toast.success("Stock tag created (Jama / stock-in).");
      } else {
        const signed = direction === "jama" ? fineMg : -fineMg;
        await append({
          type: "adjustment",
          netFineMg: signed,
          deltas: { vault: signed },
          grossMg,
          purity: p,
          fineMg,
          customerId: partyId || undefined,
          notes:
            notes.trim() ||
            `Item txn ${direction === "jama" ? "Jama" : "Nave"}${itemName ? ` · ${itemName}` : ""}`,
          source: "item_transaction",
          reference: itemName || undefined,
        });
        toast.success(`Ledger ${direction === "jama" ? "Jama" : "Nave"} posted.`);
      }
      setGrossG("");
      setNetG("");
      setFineG("");
      setItemName("");
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Posting failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto space-y-6">
      <PageHeader
        title="Item Transaction Entry"
        subtitle="Gross / net / fine Jama–Nave — stock tag or gold ledger adjustment"
        actions={<SourceOfTruthBadge variant="ledger" />}
      />

      <form onSubmit={onSubmit} className="erp-surface rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mode">Post to</Label>
            <select
              id="mode"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as PostMode)}
            >
              <option value="stock">Stock (tag in)</option>
              <option value="ledger">Gold ledger adjustment</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dir">Direction</Label>
            <select
              id="dir"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
            >
              <option value="jama">Jama (in)</option>
              <option value="nave">Nave (out)</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="party">Party</Label>
            <select
              id="party"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            >
              <option value="">Optional…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="item">Item name</Label>
            <Input id="item" value={itemName} onChange={(e) => setItemName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gross">Gross (g)</Label>
            <Input id="gross" className="font-mono" value={grossG} onChange={(e) => setGrossG(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="net">Net (g)</Label>
            <Input id="net" className="font-mono" value={netG} onChange={(e) => setNetG(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purity">Purity (‰)</Label>
            <Input id="purity" className="font-mono" value={purity} onChange={(e) => setPurity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fine">Fine (g) optional</Label>
            <Input id="fine" className="font-mono" value={fineG} onChange={(e) => setFineG(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Narration</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Posting…" : "Post transaction"}
        </Button>
      </form>

      <Button variant="outline" size="sm" asChild>
        <Link to="/reports/item-transaction">Open Item Transaction report</Link>
      </Button>
    </div>
  );
}
