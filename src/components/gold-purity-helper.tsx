import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPurityOptions, gramsToMg } from "@/lib/gold";
import { calculatePurityConversion, formatPurityConversionGrams } from "@/lib/purity-conversion";
import { useSettings } from "@/lib/settings-store";
import { cn } from "@/lib/utils";
import { ensurePurityGradesLoaded } from "@/lib/purity-grades-store";

/**
 * Bound purity expected-panel. Prefer parent-controlled weight/from/to.
 * When `lockedFrom` is true, From is read-only (ledger line). User may still
 * change To when the business allows. Does not invent a second weight form
 * when weightG is provided by the parent.
 */
export function GoldPurityHelper({
  className,
  defaultWeightG,
  defaultFromPurity,
  defaultToPurity,
  weightG,
  fromPurity,
  toPurity,
  lockedFrom = false,
  lockedWeight = false,
  purityOptions,
  onApplyAlloyG,
  onToPurityChange,
  onFromPurityChange,
}: {
  className?: string;
  defaultWeightG?: string;
  defaultFromPurity?: number;
  defaultToPurity?: number;
  /** Controlled weight (g) from parent — preferred over local typing. */
  weightG?: string;
  fromPurity?: number;
  toPurity?: number;
  lockedFrom?: boolean;
  lockedWeight?: boolean;
  purityOptions?: { label: string; value: number }[];
  onApplyAlloyG?: (alloyG: string) => void;
  onToPurityChange?: (permille: number) => void;
  onFromPurityChange?: (permille: number) => void;
}) {
  const presets = useSettings((s) => s.purityHelper) ?? {
    fromPurityPermille: 999,
    toPurityPermille: 920,
  };
  const [open, setOpen] = useState(true);
  const controlled = weightG != null || fromPurity != null || toPurity != null;
  const [weightStr, setWeightStr] = useState(defaultWeightG ?? "");
  const [fromP, setFromP] = useState(
    String(defaultFromPurity ?? presets.fromPurityPermille ?? 999),
  );
  const [toP, setToP] = useState(String(defaultToPurity ?? presets.toPurityPermille ?? 920));

  useEffect(() => {
    if (weightG != null && weightG !== weightStr) setWeightStr(weightG);
  }, [weightG, weightStr]);
  useEffect(() => {
    if (fromPurity != null && fromPurity > 0 && String(fromPurity) !== fromP) {
      setFromP(String(fromPurity));
    }
  }, [fromPurity, fromP]);
  useEffect(() => {
    if (toPurity != null && toPurity > 0 && String(toPurity) !== toP) {
      setToP(String(toPurity));
    }
  }, [toPurity, toP]);

  useEffect(() => {
    void ensurePurityGradesLoaded();
  }, []);

  const purityChoices = useMemo(
    () => purityOptions ?? getPurityOptions("gold"),
    [purityOptions],
  );
  const toPurityInList = purityChoices.some((p) => String(p.value) === toP);
  const fromPurityInList = purityChoices.some((p) => String(p.value) === fromP);

  const result = useMemo(() => {
    try {
      const n = Number(weightStr);
      if (!Number.isFinite(n) || n <= 0) return null;
      const weightMg = gramsToMg(weightStr.trim() || "0");
      if (weightMg <= 0) return null;
      const from = Number(fromP) || 0;
      const to = Number(toP) || 0;
      if (from <= 0 || to <= 0) return null;
      const raw = calculatePurityConversion({
        weightMg,
        fromPurityPermille: from,
        toPurityPermille: to,
      });
      return formatPurityConversionGrams(raw);
    } catch {
      return null;
    }
  }, [weightStr, fromP, toP]);

  return (
    <div className={cn("rounded-md border border-border/60 bg-muted/20 text-sm", className)}>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Expected purity result
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border/50 px-3 pb-3 pt-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Weight (g)
              </Label>
              <Input
                value={weightStr}
                disabled={lockedWeight || controlled}
                onChange={(e) => setWeightStr(e.target.value)}
                className="h-8 text-xs"
                inputMode="decimal"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Source ‰
              </Label>
              {lockedFrom ? (
                <Input value={fromP} disabled className="h-8 text-xs bg-muted" />
              ) : fromPurityInList ? (
                <Select
                  value={fromP}
                  onValueChange={(v) => {
                    setFromP(v);
                    onFromPurityChange?.(Number(v) || 0);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {purityChoices.map((p) => (
                      <SelectItem key={p.value} value={String(p.value)}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={fromP}
                  className="h-8 text-xs font-mono"
                  inputMode="decimal"
                  onChange={(e) => {
                    setFromP(e.target.value);
                    onFromPurityChange?.(Number(e.target.value) || 0);
                  }}
                />
              )}
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Target ‰
              </Label>
              {toPurityInList ? (
                <Select
                  value={toP}
                  onValueChange={(v) => {
                    setToP(v);
                    onToPurityChange?.(Number(v) || 0);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {purityChoices.map((p) => (
                      <SelectItem key={p.value} value={String(p.value)}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={toP}
                  className="h-8 text-xs font-mono"
                  inputMode="decimal"
                  onChange={(e) => {
                    setToP(e.target.value);
                    onToPurityChange?.(Number(e.target.value) || 0);
                  }}
                />
              )}
            </div>
          </div>
          {result ? (
            <div className="rounded border border-gold/30 bg-[#faf8f4] px-2 py-1.5 text-[11px] space-y-0.5">
              <p>
                Fine: <strong>{result.fineG} g</strong>
              </p>
              <p>
                At target: <strong>{result.equivalentG} g</strong>
              </p>
              <p>
                Alloy: <strong>{result.alloyG} g</strong>
              </p>
              {onApplyAlloyG ? (
                <button
                  type="button"
                  className="text-[10px] text-gold underline"
                  onClick={() => onApplyAlloyG(String(result.alloyG))}
                >
                  Use alloy in form
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">Enter gross weight and purities.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
