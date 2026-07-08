import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useManufacturingBarcodes,
  checkEligibility,
  BARCODE_STATUS_LABELS,
  type BarcodeStatus,
} from "@/lib/manufacturing-barcode-store";
import { useOrderIssues } from "@/lib/order-issue-store";
import { useWorkerReturns } from "@/lib/worker-return-store";
import { usePolishing } from "@/lib/polishing-store";
import { useBusinessRules } from "@/lib/business-rules-store";
import type { Order } from "@/lib/orders-store";
import { mgToGrams } from "@/lib/gold";
import { supabase } from "@/integrations/supabase/client";
import { ManufacturingTagPrintDialog } from "@/components/manufacturing-tag-print-dialog";
import { toast } from "sonner";
import { Barcode as BarcodeIcon, Printer, ArrowRightCircle } from "lucide-react";

const STATUS_FLOW: BarcodeStatus[] = [
  "created",
  "ready_for_tag",
  "tagged",
  "ready_for_delivery",
  "delivered",
];

export function ManufacturingBarcodePanel({
  order,
  customerName,
}: {
  order: Order;
  customerName: string;
}) {
  const isEnabled = useBusinessRules((s) => s.isEnabled);
  const moduleEnabled = isEnabled("enable_barcode_module");
  const requirePolishing = isEnabled("require_polishing_before_barcode");

  const allBarcodes = useManufacturingBarcodes((s) => s.barcodes);
  const generate = useManufacturingBarcodes((s) => s.generate);
  const advanceStatus = useManufacturingBarcodes((s) => s.advanceStatus);
  const existingForOrder = useMemo(
    () => allBarcodes.filter((b) => b.orderId === order.id),
    [allBarcodes, order.id],
  );
  const barcode = existingForOrder[0];

  // checkEligibility() reads order-issue/worker-return/polishing state via
  // getState() internally, not via a reactive selector — so this useMemo
  // must explicitly depend on those stores' live arrays, or eligibility
  // would silently go stale the moment a Gold Issue/Worker Return/Polishing
  // transaction is recorded elsewhere on this same page without a reload.
  const allIssues = useOrderIssues((s) => s.issues);
  const allReturns = useWorkerReturns((s) => s.returns);
  const allPolishingTxns = usePolishing((s) => s.transactions);
  const eligibility = useMemo(
    () => checkEligibility(order.id, requirePolishing, existingForOrder),
    [order.id, requirePolishing, existingForOrder, allIssues, allReturns, allPolishingTxns],
  );

  const [productDescription, setProductDescription] = useState(order.item.itemName || "");
  const [pieces, setPieces] = useState(String(order.item.quantity || 1));
  const [generating, setGenerating] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  if (!moduleEnabled) return null;

  async function handleGenerate() {
    if (!eligibility.eligible) return;
    setGenerating(true);
    try {
      const { data } = await supabase.auth.getSession();
      await generate(
        order,
        customerName,
        {
          productDescription: productDescription.trim() || order.item.itemName,
          category: order.item.category,
          grossMg: order.item.grossMg,
          netMg: order.item.netMg,
          purity: order.item.purity,
          fineMg: order.item.fineMg,
          pieces: Math.max(1, Number(pieces) || 1),
        },
        { id: data.session?.user.id ?? null, email: data.session?.user.email ?? null },
      );
      toast.success("Barcode generated — finished goods identity created.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate barcode.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAdvance(next: BarcodeStatus) {
    if (!barcode) return;
    const { data } = await supabase.auth.getSession();
    await advanceStatus(barcode.id, next, {
      id: data.session?.user.id ?? null,
      email: data.session?.user.email ?? null,
    });
  }

  return (
    <div
      className="rounded-2xl border border-border bg-card p-5"
      data-testid="manufacturing-barcode-panel"
    >
      <div className="flex items-center gap-2 mb-3">
        <BarcodeIcon className="h-4 w-4 text-gold" />
        <h3 className="font-serif text-lg text-gold">Barcode &amp; Tagging</h3>
      </div>

      {!barcode ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Product Description</Label>
              <Input
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                data-testid="barcode-product-description"
              />
            </div>
            <div>
              <Label className="text-xs">Pieces</Label>
              <Input
                value={pieces}
                onChange={(e) => setPieces(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          {!eligibility.eligible && (
            <p className="text-xs text-muted-foreground" data-testid="barcode-ineligible-reason">
              {eligibility.reason}
            </p>
          )}
          <Button
            className="w-full gap-2"
            onClick={handleGenerate}
            disabled={!eligibility.eligible || generating}
            data-testid="barcode-generate-button"
          >
            <BarcodeIcon className="h-4 w-4" /> {generating ? "Generating…" : "Generate Barcode"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <KV k="Barcode Number" v={barcode.barcodeNumber} testId="barcode-number-value" />
            <KV k="Internal Product ID" v={barcode.internalProductId} />
            <KV k="Tag Number" v={barcode.tagNumber} />
            <KV k="Manufacturing Date" v={barcode.manufacturingDate} />
            <KV
              k="Gross / Net"
              v={`${mgToGrams(barcode.grossMg)}g / ${mgToGrams(barcode.netMg)}g`}
            />
            <KV k="Purity / Pieces" v={`${barcode.purity} · ${barcode.pieces} pcs`} />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Badge variant="outline" data-testid="barcode-status-badge">
              {BARCODE_STATUS_LABELS[barcode.status]}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setPrintOpen(true)}
              data-testid="barcode-print-tag"
            >
              <Printer className="h-3.5 w-3.5" /> Print Tag
            </Button>
            {STATUS_FLOW.filter((s) => s !== barcode.status).map((s, idx) =>
              STATUS_FLOW.indexOf(s) === STATUS_FLOW.indexOf(barcode.status) + 1 ? (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => handleAdvance(s)}
                  data-testid={`barcode-advance-${s}`}
                >
                  <ArrowRightCircle className="h-3.5 w-3.5" /> Mark {BARCODE_STATUS_LABELS[s]}
                </Button>
              ) : null,
            )}
          </div>
        </div>
      )}

      <ManufacturingTagPrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        barcode={barcode ?? null}
      />
    </div>
  );
}

function KV({ k, v, testId }: { k: string; v: string; testId?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="text-sm font-mono" data-testid={testId}>
        {v}
      </div>
    </div>
  );
}
