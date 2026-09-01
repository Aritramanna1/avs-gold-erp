import { useEffect, useState } from "react";
import { hardwareService, useScaleReading } from "@/lib/hardware-service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Scale, PencilLine } from "lucide-react";

/**
 * Reusable weight-entry field. If a physical scale is connected,
 * shows the live stable reading. If manual entry is used, typing
 * (e.g. 8.100) is fully preserved without jumping or resetting.
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
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setManualText(valueGrams != null ? String(valueGrams) : "");
    }
  }, [valueGrams, isFocused]);

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
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder="0.000"
        value={manualText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          const num = parseFloat(manualText);
          if (!isNaN(num) && num > 0) {
            setManualText(num.toFixed(3));
          }
        }}
        onChange={(e) => {
          const val = e.target.value;
          setManualText(val);
          const num = parseFloat(val);
          onChange(Number.isFinite(num) && num >= 0 ? num : val === "" ? null : undefined as any);
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
