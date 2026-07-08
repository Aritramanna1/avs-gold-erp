import { useState } from "react";
import { Printer, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { REPRINT_REASON_LABELS, type ReprintReason } from "@/lib/printlog-store";

interface PrintToolbarProps {
  title: string;
  docNumber: string;
  isReprint?: boolean;
  reprintCount?: number;
  reprintOpen?: boolean;
  setReprintOpen?: (open: boolean) => void;
  onPrint?: () => void;
  onReprintConfirm?: (reason: ReprintReason, note?: string) => void;
  backUrl?: string; // Optional custom fallback URL
  layoutSize?: "a4" | "a5" | "thermal" | "thermal58" | "tag";
  onLayoutSizeChange?: (size: "a4" | "a5" | "thermal" | "thermal58" | "tag") => void;
}

export function PrintToolbar({
  title,
  docNumber,
  isReprint = false,
  reprintCount = 0,
  reprintOpen = false,
  setReprintOpen,
  onPrint,
  onReprintConfirm,
  backUrl,
  layoutSize,
  onLayoutSizeChange,
}: PrintToolbarProps) {
  const [selectedReason, setSelectedReason] = useState<ReprintReason>("wrong_printer");
  const [note, setNote] = useState("");

  const isIframe = typeof window !== "undefined" && window !== window.parent;

  if (isIframe) {
    return null;
  }

  const handleBack = () => {
    if (backUrl) {
      window.location.href = backUrl;
    } else {
      window.history.back();
    }
  };

  const handleConfirmReprint = () => {
    if (onReprintConfirm) {
      onReprintConfirm(selectedReason, note);
    }
  };

  return (
    <>
      <header
        data-testid="print-toolbar"
        className="sticky top-0 bg-background/95 backdrop-blur border-b border-border/40 p-4 z-50 print:hidden flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-9 w-9 shrink-0"
            title="Go Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-serif text-base font-semibold tracking-tight text-foreground truncate">
                {title}
              </span>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono">
                {docNumber}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
              MTJ ERP High-Fidelity Printing System. Inkjet copies are optimized for legal archives.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
          {onLayoutSizeChange && layoutSize && (
            <div className="flex bg-muted rounded-xl p-0.5 border border-border mr-1">
              {(["a4", "a5", "thermal", "thermal58", "tag"] as const).map((sz) => {
                let label = sz.toUpperCase();
                if (sz === "thermal") label = "80mm Thermal";
                if (sz === "thermal58") label = "58mm Thermal";
                if (sz === "tag") label = "Jewellery Tag";
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onLayoutSizeChange(sz)}
                    className={`px-3 py-1 text-xs rounded-lg transition-all cursor-pointer font-sans whitespace-nowrap ${
                      layoutSize === sz
                        ? "bg-background text-foreground shadow-sm font-semibold border-stone-200"
                        : "text-muted-foreground hover:text-foreground hover:bg-neutral-100/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {isReprint && (
            <div className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2.5 py-1.5 rounded-md text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>
                Reprint Required (Prev: <strong>{reprintCount}</strong>)
              </span>
            </div>
          )}

          <Button
            onClick={onPrint}
            className="bg-gold text-black hover:bg-gold/90 font-medium text-xs gap-1.5 px-4 h-9 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            {isReprint ? "Trigger Secure Reprint" : "Print Document"}
          </Button>
        </div>
      </header>

      {/* Standardized Secure Reprint Reason Dialog */}
      <Dialog open={reprintOpen} onOpenChange={setReprintOpen}>
        <DialogContent className="max-w-md bg-background border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="h-5 w-5" />
              Secure Reprint Registry
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This document ({docNumber}) has been printed before. To maintain integrity, please
              declare the reason for this duplicate print.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Select Reprint Reason</label>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(REPRINT_REASON_LABELS) as ReprintReason[]).map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors text-xs ${
                      selectedReason === reason
                        ? "border-gold/50 bg-gold/5 text-foreground"
                        : "border-border bg-card/50 text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reprint_reason"
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                      className="accent-gold h-4 w-4"
                    />
                    <span>{REPRINT_REASON_LABELS[reason]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Internal Log / Explanation Note (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Declare corrective measures, damaged queue logs, or printer jam notes..."
                className="w-full h-20 rounded-md border border-input bg-card px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReprintOpen?.(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmReprint}
              className="bg-gold text-black hover:bg-gold/90 font-medium text-xs"
            >
              Verify &amp; Print Copies
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
