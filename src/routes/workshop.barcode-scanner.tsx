import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { BarcodeInput } from "@/components/hardware/BarcodeInput";
import { CameraBarcodeScanner } from "@/components/hardware/CameraBarcodeScanner";
import { useManufacturingBarcodes, BARCODE_STATUS_LABELS } from "@/lib/manufacturing-barcode-store";
import { usePrintLog } from "@/lib/printlog-store";
import { useBusinessRules } from "@/lib/business-rules-store";
import { mgToGrams } from "@/lib/gold";
import { ScanLine, Package, User as UserIcon, History, Wallet } from "lucide-react";

export const Route = createFileRoute("/workshop/barcode-scanner")({
  head: () => ({ meta: [{ title: "Barcode Scanner · AVS Gold ERP" }] }),
  component: BarcodeScannerPage,
});

/**
 * Barcode Scanner Desk — scan (or type) a finished-product barcode/QR/tag
 * number and jump straight to its Production Order, Customer, or Print
 * History. USB HID keyboard-wedge scanners work here with zero setup:
 * BarcodeInput/hardwareService already treat a scan as a fast keystroke
 * burst ending in Enter, identical to manual typing — reused as-is from
 * the existing retail barcode desk, no new scanner code needed.
 */
function BarcodeScannerPage() {
  const barcodes = useManufacturingBarcodes((s) => s.barcodes);
  const refresh = useManufacturingBarcodes((s) => s.refresh);
  const findByBarcodeNumber = useManufacturingBarcodes((s) => s.findByBarcodeNumber);
  const printEvents = usePrintLog((s) => s.events);
  const moduleEnabled = useBusinessRules((s) => s.isEnabled("enable_barcode_module"));
  const refreshRules = useBusinessRules((s) => s.refresh);

  useEffect(() => {
    refresh();
    refreshRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [code, setCode] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const found = findByBarcodeNumber(code.trim());

  function handleSubmit(scanned: string) {
    const match = findByBarcodeNumber(scanned.trim());
    setNotFound(!match);
  }

  function handleCameraDetected(scanned: string) {
    setCode(scanned);
    handleSubmit(scanned);
    setCameraOpen(false);
  }

  if (!moduleEnabled) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto text-center">
        <PageHeader title="Barcode Scanner" subtitle="This module is currently disabled." />
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 mt-6">
          <ScanLine className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-serif text-xl text-gold">Barcode module is off</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Turn on "Enable Barcode Module (Manufacturing)" in Business Rule settings.
          </p>
        </div>
      </div>
    );
  }

  const relatedPrints = found ? printEvents.filter((e) => e.linkedId === found.id) : [];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader
        title="Barcode Scanner"
        subtitle="Scan (or type) a finished-product barcode, QR, or tag number to open it instantly."
      />

      <div className="rounded-2xl border border-border bg-card p-5 mb-6 space-y-3">
        <div className="flex items-center gap-2">
          <BarcodeInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setNotFound(false);
            }}
            onSubmit={handleSubmit}
            placeholder="Scan barcode / QR / tag number, or type it and press Enter"
            autoFocus
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={() => setCameraOpen((o) => !o)}
            data-testid="camera-scan-toggle"
          >
            {cameraOpen ? "Hide Camera" : "Use Camera"}
          </Button>
        </div>
        {cameraOpen && (
          <CameraBarcodeScanner
            onDetected={handleCameraDetected}
            onClose={() => setCameraOpen(false)}
          />
        )}
      </div>

      {notFound && (
        <div className="rounded-xl border border-dashed border-border bg-background/40 p-6 text-center text-sm text-muted-foreground mb-6">
          No finished-product barcode matches "{code}".
        </div>
      )}

      {found && (
        <div
          className="rounded-2xl border border-gold/40 bg-gold/5 p-5 space-y-4"
          data-testid="scanner-result"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-serif text-xl text-gold">{found.barcodeNumber}</div>
              <div className="text-sm text-muted-foreground">{found.productDescription}</div>
            </div>
            <Badge>{BARCODE_STATUS_LABELS[found.status]}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-[11px] uppercase text-muted-foreground">Gross / Net</div>
              <div className="font-mono">
                {mgToGrams(found.grossMg)}g / {mgToGrams(found.netMg)}g
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-muted-foreground">Purity / Pieces</div>
              <div className="font-mono">
                {found.purity} · {found.pieces} pcs
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/orders/$id" params={{ id: found.orderId }}>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                data-testid="scanner-open-order"
              >
                <Package className="h-3.5 w-3.5" /> Open Production Order
              </Button>
            </Link>
            <Link to="/people">
              <Button size="sm" variant="outline" className="gap-1.5">
                <UserIcon className="h-3.5 w-3.5" /> Open Customer
              </Button>
            </Link>
            {/* Settlement — reserved extension point, not implemented yet */}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled
              title="Reserved for a future phase"
            >
              <Wallet className="h-3.5 w-3.5" /> Open Settlement
            </Button>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Print History ({relatedPrints.length})
            </div>
            {relatedPrints.length === 0 ? (
              <p className="text-xs text-muted-foreground">Never printed.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {relatedPrints.map((e) => (
                  <li key={e.id} className="text-muted-foreground">
                    {new Date(e.firstPrintedAt).toLocaleString("en-IN")}
                    {e.reprintCount > 0 ? ` · reprinted ${e.reprintCount}×` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!found && !notFound && barcodes.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          {barcodes.length} finished-product barcode{barcodes.length === 1 ? "" : "s"} in the
          system.
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs text-gold">
      {children}
    </span>
  );
}
