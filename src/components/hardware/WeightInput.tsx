import { useState } from "react";
import { hardwareService, useScaleReading } from "@/lib/hardware-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Scale, PencilLine } from "lucide-react";

/**
 * Reusable weight-entry field (Priority 7). If a physical scale is
 * connected (WebSerial, see hardware-service.ts), shows the live stable
 * reading and lets the user accept it with one click. If no scale is
 * connected — or the user doesn't trust a given reading — "Enter Manually"
 * always works: this is a production-ready fallback, not a placeholder,
 * since gold weighing must never be blocked by a missing/misbehaving
 * device.
 */
export function WeightInput({
  valueGrams,
  onChange,
  autoFocus,
}: {
  valueGrams: number | null;
  onChange: (grams: number | null) => void;
  autoFocus?: boolean;
}) {
  const { reading: liveReading, connected: scaleAvailable } = useScaleReading();
  const [manualMode, setManualMode] = useState(!hardwareService.isScaleConnected);
  const [manualText, setManualText] = useState(valueGrams != null ? String(valueGrams) : "");

  if (!manualMode && scaleAvailable) {
    return (
      <div className="flex items-center gap-2">
        <Scale
          className={`h-4 w-4 ${liveReading?.isStable ? "text-green-600" : "text-muted-foreground"}`}
        />
        <span className="text-sm">
          {liveReading ? `${liveReading.weightGrams.toFixed(3)} g` : "Waiting for reading..."}
          {liveReading && !liveReading.isStable && (
            <span className="ml-1 text-xs text-muted-foreground">(settling...)</span>
          )}
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!liveReading?.isStable}
          onClick={() => liveReading && onChange(liveReading.weightGrams)}
        >
          Use Reading
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setManualMode(true)}>
          <PencilLine className="mr-1 h-3 w-3" /> Enter Manually
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        step="0.001"
        min="0"
        autoFocus={autoFocus}
        placeholder="Weight in grams"
        value={manualText}
        onChange={(e) => {
          setManualText(e.target.value);
          const num = parseFloat(e.target.value);
          onChange(Number.isFinite(num) ? num : null);
        }}
      />
      {scaleAvailable && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setManualMode(false)}>
          <Scale className="mr-1 h-3 w-3" /> Use Scale
        </Button>
      )}
    </div>
  );
}
