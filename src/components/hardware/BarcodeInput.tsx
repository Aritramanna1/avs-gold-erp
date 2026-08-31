import { useEffect, useRef, useState } from "react";
import { hardwareService } from "@/lib/hardware-service";
import { Input } from "@/components/ui/input";
import { ScanLine } from "lucide-react";

/**
 * Reusable barcode/QR entry field (Priority 7) — the manual fallback and the
 * hardware-scanned path are the SAME input, not two separate UIs: a USB HID
 * barcode scanner types into whatever field has focus and sends Enter, so
 * this field already receives scans exactly like a keyboard. When no
 * scanner is present, the user just types the code and presses Enter (or
 * blurs) — nothing about the component changes or needs a "no scanner"
 * mode; manual entry is never a degraded second-class path.
 */
export function BarcodeInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Scan or type barcode / QR code",
  autoFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [justScanned, setJustScanned] = useState(false);

  useEffect(() => {
    // hardwareService's scanner listener fires on ANY keydown activity in
    // the page (keyboard-wedge emulation) — when it detects a rapid burst
    // ending in Enter, it calls this callback directly, so a scan is
    // captured even if this field isn't focused when the scan happens.
    const unsubscribe = hardwareService.onBarcodeScanned((barcode) => {
      onChange(barcode);
      setJustScanned(true);
      onSubmit?.(barcode);
      window.setTimeout(() => setJustScanned(false), 1200);
    });
    return () => {
      unsubscribe();
    };
  }, [onChange, onSubmit]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <ScanLine
        className={`absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 ${justScanned ? "text-green-600" : "text-muted-foreground"}`}
      />
      <Input
        ref={inputRef}
        className="pl-8"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            e.preventDefault();
            onSubmit?.(value.trim());
          }
        }}
      />
    </div>
  );
}
