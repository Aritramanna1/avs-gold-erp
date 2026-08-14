import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOutsideWork } from "@/lib/outside-work-store";
import { useOutsideWorkLabour } from "@/lib/outside-work-labour-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useSettings } from "@/lib/settings-store";
import { buildOutsideWorkStatement, type StatementKind } from "@/lib/outside-work-statement";
import { FileText, AlertTriangle } from "lucide-react";

const KIND_OPTIONS: { value: StatementKind; label: string }[] = [
  { value: "date_range", label: "Date Range" },
  { value: "monthly", label: "Monthly Statement" },
  { value: "outstanding", label: "Outstanding Statement" },
  { value: "settlement", label: "Settlement Statement" },
];

/**
 * Generates one of the four statement kinds the spec calls for, and hands
 * it to outside-worker-statement-pdf.ts for rendering. PDF-only for now —
 * no Communication integration yet (deliberately out of scope this phase).
 */
export function OutsideWorkStatementDialog({
  open,
  onClose,
  jewellerId,
  jewellerName,
}: {
  open: boolean;
  onClose: () => void;
  jewellerId: string;
  jewellerName: string;
}) {
  const transactions = useOutsideWork((s) => s.transactions);
  const charges = useOutsideWorkLabour((s) => s.charges);
  const payments = useOutsideWorkLabour((s) => s.payments);
  const settlements = useGoldSettlement((s) => s.settlements);
  const firm = useSettings((s) => s.firm);

  const [kind, setKind] = useState<StatementKind>("date_range");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const needsDateRange = kind === "date_range";
  const canGenerate = !generating && (!needsDateRange || (fromDate && toDate));

  async function generate() {
    if (!canGenerate) return;
    setError(null);
    setGenerating(true);
    try {
      const data = buildOutsideWorkStatement({
        kind,
        jewellerId,
        jewellerName,
        allTransactions: transactions,
        allCharges: charges,
        allPayments: payments,
        allSettlements: settlements,
        fromTs: fromDate ? new Date(fromDate).getTime() : undefined,
        toTs: toDate ? new Date(toDate).setHours(23, 59, 59, 999) : undefined,
      });
      const { generateOutsideWorkerStatementPdf, outsideWorkerStatementFileName } =
        await import("@/lib/pdf/outside-worker-statement-pdf");
      const blob = await generateOutsideWorkerStatementPdf(data, firm);
      const fileName = outsideWorkerStatementFileName(data, firm);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.setAttribute("data-testid", "outside-statement-download-link");
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to generate statement.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gold" /> Generate Statement
          </DialogTitle>
          <DialogDescription>{jewellerName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Statement Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as StatementKind)}>
              <SelectTrigger data-testid="outside-statement-kind-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsDateRange && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={generate}
            disabled={!canGenerate}
            className="gap-2"
            data-testid="outside-statement-generate"
          >
            <FileText className="h-4 w-4" /> {generating ? "Generating…" : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
