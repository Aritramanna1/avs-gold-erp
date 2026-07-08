import { useMemo, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrintLayout } from "@/components/print/PrintLayout";
import { usePrintLog } from "@/lib/printlog-store";
import { useBusinessRules } from "@/lib/business-rules-store";
import { useBarcodeConfig } from "@/lib/barcode-config-store";
import type { ManufacturingBarcode } from "@/lib/manufacturing-barcode-store";
import { mgToGrams } from "@/lib/gold";
import { Printer, Layers } from "lucide-react";

type TagVariant = "jewellery_tag" | "barcode_label" | "qr_label";

const VARIANT_LABELS: Record<TagVariant, string> = {
  jewellery_tag: "Jewellery Tag",
  barcode_label: "Barcode Label",
  qr_label: "QR Label",
};

/**
 * Tag Printing — Print Single Tag / Print Multiple Tags / Reprint Existing
 * Tag, all going through the same existing Print History system
 * (printlog-store.ts's `recordPrint`, docType "jewellery_tag" — already a
 * valid PrintDocType from an earlier phase) so reprint tracking works
 * identically to every other document in the ERP, not a new parallel log.
 */
export function ManufacturingTagPrintDialog({
  open,
  onClose,
  barcode,
  printedBy,
}: {
  open: boolean;
  onClose: () => void;
  barcode: ManufacturingBarcode | null;
  printedBy?: string;
}) {
  const recordPrint = usePrintLog((s) => s.recordPrint);
  const events = usePrintLog((s) => s.events);
  const isEnabled = useBusinessRules((s) => s.isEnabled);
  const requireApproval = isEnabled("require_approval_before_printing_barcode");
  const config = useBarcodeConfig((s) => s.config);

  const [variant, setVariant] = useState<TagVariant>("jewellery_tag");
  const [copies, setCopies] = useState("1");
  const [approvedBy, setApprovedBy] = useState("");

  const existingEvent = useMemo(
    () =>
      barcode
        ? events.find((e) => e.docType === "jewellery_tag" && e.linkedId === barcode.id)
        : undefined,
    [events, barcode],
  );
  const isReprint = !!existingEvent;

  if (!barcode) return null;

  const canPrint = (!requireApproval || approvedBy.trim().length > 0) && Number(copies) >= 1;

  function doPrint() {
    if (!canPrint || !barcode) return;
    recordPrint({
      docType: "jewellery_tag",
      docNumber: barcode.barcodeNumber,
      linkedId: barcode.id,
      linkedLabel: `${barcode.productDescription} · ${VARIANT_LABELS[variant]}`,
      printedBy: printedBy ?? "Owner",
      reason: isReprint ? "customer_copy" : undefined,
      note: `${Number(copies)} ${VARIANT_LABELS[variant]}${Number(copies) > 1 ? "s" : ""}${requireApproval ? ` · Approved by ${approvedBy.trim()}` : ""}`,
    });
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-gold" /> {isReprint ? "Reprint" : "Print"} Tag —{" "}
            {barcode.barcodeNumber}
          </DialogTitle>
          <DialogDescription>
            {barcode.productDescription} · {barcode.orderNo}
            {isReprint && (
              <span className="ml-2 text-amber-500">
                (Previously printed {existingEvent!.reprintCount + 1}× — this will be reprint #
                {existingEvent!.reprintCount + 2})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={variant} onValueChange={(v) => setVariant(v as TagVariant)}>
          <TabsList className="no-print">
            {(Object.keys(VARIANT_LABELS) as TagVariant[]).map((v) => (
              <TabsTrigger key={v} value={v} data-testid={`tag-variant-${v}`}>
                {VARIANT_LABELS[v]}
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(VARIANT_LABELS) as TagVariant[]).map((v) => (
            <TabsContent key={v} value={v}>
              <div className="border border-dashed border-border rounded-lg p-2 flex justify-center bg-muted/20">
                <PrintLayout
                  title={VARIANT_LABELS[v]}
                  docNumber={barcode.barcodeNumber}
                  docType="jewellery_tag"
                  recordId={barcode.id}
                  createdAt={barcode.createdAt}
                  size="tag"
                  showQR={v !== "barcode_label"}
                  qrPosition="footer"
                >
                  <div className="text-center space-y-1">
                    {v !== "qr_label" && config.fieldsVisible.product && (
                      <div className="font-semibold text-xs">{barcode.productDescription}</div>
                    )}
                    {v === "jewellery_tag" && (
                      <>
                        {config.fieldsVisible.category && (
                          <div className="text-[10px]">{barcode.category}</div>
                        )}
                        {config.fieldsVisible.grossWeight && (
                          <div className="text-[10px]">Gross: {mgToGrams(barcode.grossMg)} g</div>
                        )}
                        {config.fieldsVisible.netWeight && (
                          <div className="text-[10px]">Net: {mgToGrams(barcode.netMg)} g</div>
                        )}
                        {config.fieldsVisible.purity && (
                          <div className="text-[10px]">Purity: {barcode.purity}</div>
                        )}
                        {config.fieldsVisible.pieces && (
                          <div className="text-[10px]">Pcs: {barcode.pieces}</div>
                        )}
                        {config.fieldsVisible.customer && (
                          <div className="text-[10px]">{barcode.customerName}</div>
                        )}
                      </>
                    )}
                    <div className="text-[9px] font-mono mt-1">{barcode.barcodeNumber}</div>
                    {v === "barcode_label" && (
                      <div className="font-mono text-xs tracking-widest border border-foreground/40 px-2 py-1 mt-1">
                        {barcode.barcodeNumber}
                      </div>
                    )}
                  </div>
                </PrintLayout>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="grid grid-cols-2 gap-3 no-print">
          <div>
            <Label>Copies (Print Multiple Tags)</Label>
            <Input
              value={copies}
              onChange={(e) => setCopies(e.target.value)}
              inputMode="numeric"
              data-testid="tag-print-copies"
            />
          </div>
          {requireApproval && (
            <div>
              <Label>Approved By *</Label>
              <Input
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="Required by current settings"
                data-testid="tag-print-approver"
              />
            </div>
          )}
        </div>

        <DialogFooter className="no-print">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={doPrint}
            disabled={!canPrint}
            className="gap-2"
            data-testid="tag-print-submit"
          >
            <Layers className="h-4 w-4" /> {isReprint ? "Reprint" : "Print"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
