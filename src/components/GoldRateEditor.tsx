import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/lib/settings-store";
import { useBullionRate } from "@/lib/bullion-rate-service";
import { useRoles } from "@/lib/rbac";
import { Shield, Sparkles, AlertCircle, Coins, Percent, Radio } from "lucide-react";

interface GoldRateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoldRateEditor({ open, onOpenChange }: GoldRateEditorProps) {
  const {
    goldRatePerGramPaise,
    goldRate24KPerGramPaise,
    goldRate18KPerGramPaise,
    silverRatePerGramPaise,
    setGoldRate,
    setGoldRate24K,
    setGoldRate18K,
    setSilverRate,
    addSecurityLog,
  } = useSettings();
  const { roles, email, ready } = useRoles();
  const { snapshot: liveSnapshot } = useBullionRate();

  // Check roles: user must be either "owner" or "manager" to edit.
  const isAuthorized = ready && (roles.includes("owner") || roles.includes("manager"));

  const [gold24Input, setGold24Input] = useState("");
  const [gold22Input, setGold22Input] = useState("");
  const [gold18Input, setGold18Input] = useState("");
  const [silverInput, setSilverInput] = useState("");

  const [gold24Error, setGold24Error] = useState<string | null>(null);
  const [gold22Error, setGold22Error] = useState<string | null>(null);
  const [gold18Error, setGold18Error] = useState<string | null>(null);
  const [silverError, setSilverError] = useState<string | null>(null);

  // Initialize values when the dialog opens
  useEffect(() => {
    if (open) {
      // 24K
      setGold24Input(
        goldRate24KPerGramPaise > 0
          ? (goldRate24KPerGramPaise / 100).toString()
          : goldRatePerGramPaise > 0
            ? Math.round(goldRatePerGramPaise / 0.916 / 100).toString()
            : "",
      );

      // 22K (referencing main gold rate)
      setGold22Input(goldRatePerGramPaise > 0 ? (goldRatePerGramPaise / 100).toString() : "");

      // 18K
      setGold18Input(
        goldRate18KPerGramPaise > 0
          ? (goldRate18KPerGramPaise / 100).toString()
          : goldRatePerGramPaise > 0
            ? Math.round(((goldRatePerGramPaise / 0.916) * 0.75) / 100).toString()
            : "",
      );

      // Silver
      setSilverInput(silverRatePerGramPaise > 0 ? (silverRatePerGramPaise / 100).toString() : "");

      setGold24Error(null);
      setGold22Error(null);
      setGold18Error(null);
      setSilverError(null);
    }
  }, [
    open,
    goldRatePerGramPaise,
    goldRate24KPerGramPaise,
    goldRate18KPerGramPaise,
    silverRatePerGramPaise,
  ]);

  // Assist calculation if 24K inputs change to provide instant estimations helper
  const handleGold24Change = (val: string) => {
    setGold24Input(val);
    if (!val.trim()) {
      setGold24Error("24K gold rate is required");
      return;
    }
    const parsed = Number(val);
    if (isNaN(parsed)) {
      setGold24Error("Please enter a valid number");
    } else if (parsed <= 0) {
      setGold24Error("Rate must be greater than zero");
    } else {
      setGold24Error(null);

      // Auto-calculate suggested 22K (91.6%) and 18K (75%)
      const calculated22 = Math.round(parsed * 0.916);
      const calculated18 = Math.round(parsed * 0.75);

      setGold22Input(calculated22.toString());
      setGold18Input(calculated18.toString());
      setGold22Error(null);
      setGold18Error(null);
    }
  };

  const handleGold22Change = (val: string) => {
    setGold22Input(val);
    if (!val.trim()) {
      setGold22Error("22K gold rate is required");
      return;
    }
    const parsed = Number(val);
    if (isNaN(parsed)) {
      setGold22Error("Please enter a valid number");
    } else if (parsed <= 0) {
      setGold22Error("Rate must be greater than zero");
    } else {
      setGold22Error(null);
    }
  };

  const handleGold18Change = (val: string) => {
    setGold18Input(val);
    if (!val.trim()) {
      setGold18Error("18K gold rate is required");
      return;
    }
    const parsed = Number(val);
    if (isNaN(parsed)) {
      setGold18Error("Please enter a valid number");
    } else if (parsed <= 0) {
      setGold18Error("Rate must be greater than zero");
    } else {
      setGold18Error(null);
    }
  };

  const handleSilverChange = (val: string) => {
    setSilverInput(val);
    if (!val.trim()) {
      setSilverError(null);
      return;
    }
    const parsed = Number(val);
    if (isNaN(parsed)) {
      setSilverError("Please enter a valid number");
    } else if (parsed < 0) {
      setSilverError("Rate cannot be negative");
    } else {
      setSilverError(null);
    }
  };

  const handleSave = () => {
    if (!isAuthorized) {
      toast.error("Unauthorized: Only Owners or Managers can update rates");
      return;
    }

    const val24 = Number(gold24Input);
    const val22 = Number(gold22Input);
    const val18 = Number(gold18Input);
    const valSilver = silverInput.trim() ? Number(silverInput) : 0;

    if (isNaN(val24) || val24 <= 0 || !gold24Input.trim()) {
      setGold24Error("Please enter a valid positive 24K rate");
      return;
    }
    if (isNaN(val22) || val22 <= 0 || !gold22Input.trim()) {
      setGold22Error("Please enter a valid positive 22K rate");
      return;
    }
    if (isNaN(val18) || val18 <= 0 || !gold18Input.trim()) {
      setGold18Error("Please enter a valid positive 18K rate");
      return;
    }
    if (silverInput.trim() && (isNaN(valSilver) || valSilver < 0)) {
      setSilverError("Please enter a valid non-negative silver rate");
      return;
    }

    // Convert to paise representation
    const paise24 = Math.round(val24 * 100);
    const paise22 = Math.round(val22 * 100);
    const paise18 = Math.round(val18 * 100);
    const paiseSilver = Math.round(valSilver * 100);

    addSecurityLog(
      "gold edited",
      `Rates updated: Gold 24K: ₹${val24}/g, Gold 22K (Standard): ₹${val22}/g, Gold 18K: ₹${val18}/g, Silver: ₹${valSilver}/g`,
      email || "System/Owner",
    );

    setGoldRate24K(paise24);
    // 22K is stored in the reference rate `goldRatePerGramPaise`
    setGoldRate(paise22);
    setGoldRate18K(paise18);
    setSilverRate(paiseSilver);

    toast.success("Precious metal rates updated successfully!");
    onOpenChange(false);
  };

  const hasChanges =
    gold24Input !== (goldRate24KPerGramPaise / 100).toString() ||
    gold22Input !== (goldRatePerGramPaise / 100).toString() ||
    gold18Input !== (goldRate18KPerGramPaise / 100).toString() ||
    silverInput !== (silverRatePerGramPaise / 100).toString();

  const isValid =
    !gold24Error &&
    !gold22Error &&
    !gold18Error &&
    !silverError &&
    gold24Input.trim() &&
    gold22Input.trim() &&
    gold18Input.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background border-border" id="gold-rate-editor-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Coins className="h-5 w-5 text-gold" />
            <DialogTitle className="font-serif text-xl text-gold">Update Metal Rates</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Set the live rates for primary gold purities (24K, 22K, 18K) and silver. These direct
            the ERP's pricing, valuation, and billing calculations.
          </DialogDescription>
        </DialogHeader>

        {/* Roles status banner */}
        {!ready ? (
          <div className="text-xs text-muted-foreground animate-pulse p-2 bg-muted rounded">
            Checking roles...
          </div>
        ) : isAuthorized ? (
          <div className="p-3 bg-gold/5 border border-gold/20 rounded-lg flex gap-3 items-start text-xs text-amber-900 dark:text-gold/90">
            <Sparkles className="h-4 w-4 shrink-0 text-gold mt-0.5" />
            <div>
              <p className="font-semibold">Authorized Session</p>
              <p className="opacity-80">
                You are logged in with administrative privileges (Owner/Manager role). Changes are
                applied globally.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3 items-start text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">View Only Mode</p>
              <p className="opacity-80">
                Only owners or managers can modify metal rates. Your current role does not allow
                editing.
              </p>
            </div>
          </div>
        )}

        {/* Live rate suggestion — never applied automatically, only on click */}
        {isAuthorized && liveSnapshot && (
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex gap-3 items-start text-xs text-emerald-700 dark:text-emerald-400">
            <Radio className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">
                Live rate available: ₹
                {(liveSnapshot.gold24KPerGramPaise / 100).toLocaleString("en-IN")}/g (24K)
              </p>
              <p className="opacity-80">
                Fetched {Math.max(0, Math.round((Date.now() - liveSnapshot.fetchedAt) / 60000))}m
                ago from your configured provider.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 h-7"
              onClick={() => {
                setGold24Input((liveSnapshot.gold24KPerGramPaise / 100).toString());
                setGold22Input((liveSnapshot.gold22KPerGramPaise / 100).toString());
                setGold18Input((liveSnapshot.gold18KPerGramPaise / 100).toString());
                if (liveSnapshot.silverPerGramPaise > 0) {
                  setSilverInput((liveSnapshot.silverPerGramPaise / 100).toString());
                }
                setGold24Error(null);
                setGold22Error(null);
                setGold18Error(null);
                setSilverError(null);
              }}
            >
              Fill In
            </Button>
          </div>
        )}

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Gold 24K */}
          <div className="space-y-1.5 border-l-2 border-amber-500 pl-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="gold-24k-rate" className="text-sm font-semibold text-amber-500">
                Gold 24K (Pure Gold){" "}
                <span className="text-muted-foreground font-normal text-xs">(₹/g)</span>
              </Label>
              <span className="text-xs font-mono text-muted-foreground">
                {gold24Input && !isNaN(Number(gold24Input)) && Number(gold24Input) > 0
                  ? `₹ ${(Number(gold24Input) * 10).toLocaleString("en-IN")} / 10g`
                  : "—"}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-xs font-serif">
                ₹
              </span>
              <Input
                id="gold-24k-rate"
                type="text"
                placeholder="0.00"
                className={`pl-7 font-mono ${gold24Error ? "border-destructive focus-visible:ring-destructive" : ""}`}
                value={gold24Input}
                onChange={(e) => handleGold24Change(e.target.value)}
                disabled={!isAuthorized}
              />
            </div>
            {gold24Error && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {gold24Error}
              </p>
            )}
          </div>

          {/* Gold 22K / 916 */}
          <div className="space-y-1.5 border-l-2 border-gold pl-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="gold-22k-rate" className="text-sm font-semibold text-gold">
                Gold 22K (916 Benchmark){" "}
                <span className="text-muted-foreground font-normal text-xs">(₹/g)</span>
              </Label>
              <span className="text-xs font-mono text-muted-foreground">
                {gold22Input && !isNaN(Number(gold22Input)) && Number(gold22Input) > 0
                  ? `₹ ${(Number(gold22Input) * 10).toLocaleString("en-IN")} / 10g`
                  : "—"}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-xs font-serif">
                ₹
              </span>
              <Input
                id="gold-22k-rate"
                type="text"
                placeholder="0.00"
                className={`pl-7 font-mono ${gold22Error ? "border-destructive focus-visible:ring-destructive" : ""}`}
                value={gold22Input}
                onChange={(e) => handleGold22Change(e.target.value)}
                disabled={!isAuthorized}
              />
            </div>
            {gold22Error && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {gold22Error}
              </p>
            )}
            {gold24Input && !gold24Error && (
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Percent className="h-3 w-3 text-gold shrink-0" />
                <span>Calculated at 91.6% of 24K rate</span>
              </div>
            )}
          </div>

          {/* Gold 18K / 750 */}
          <div className="space-y-1.5 border-l-2 border-amber-300 pl-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="gold-18k-rate" className="text-sm font-semibold text-amber-300">
                Gold 18K (750 Purity){" "}
                <span className="text-muted-foreground font-normal text-xs">(₹/g)</span>
              </Label>
              <span className="text-xs font-mono text-muted-foreground">
                {gold18Input && !isNaN(Number(gold18Input)) && Number(gold18Input) > 0
                  ? `₹ ${(Number(gold18Input) * 10).toLocaleString("en-IN")} / 10g`
                  : "—"}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-xs font-serif">
                ₹
              </span>
              <Input
                id="gold-18k-rate"
                type="text"
                placeholder="0.00"
                className={`pl-7 font-mono ${gold18Error ? "border-destructive focus-visible:ring-destructive" : ""}`}
                value={gold18Input}
                onChange={(e) => handleGold18Change(e.target.value)}
                disabled={!isAuthorized}
              />
            </div>
            {gold18Error && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {gold18Error}
              </p>
            )}
            {gold24Input && !gold24Error && (
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Percent className="h-3 w-3 text-amber-300 shrink-0" />
                <span>Calculated at 75.0% of 24K rate</span>
              </div>
            )}
          </div>

          {/* Silver */}
          <div className="space-y-1.5 border-l-2 border-slate-400 pl-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="silver-rate" className="text-sm font-semibold text-slate-400">
                Silver Rate <span className="text-muted-foreground font-normal text-xs">(₹/g)</span>
              </Label>
              <span className="text-xs font-mono text-muted-foreground">
                {silverInput && !isNaN(Number(silverInput)) && Number(silverInput) > 0
                  ? `₹ ${(Number(silverInput) * 1000).toLocaleString("en-IN")} / kg`
                  : "—"}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-xs font-serif">
                ₹
              </span>
              <Input
                id="silver-rate"
                type="text"
                placeholder="0.00"
                className={`pl-7 font-mono ${silverError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                value={silverInput}
                onChange={(e) => handleSilverChange(e.target.value)}
                disabled={!isAuthorized}
              />
            </div>
            {silverError && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {silverError}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {isAuthorized && (
            <Button
              className="bg-gold hover:bg-gold-dark text-black gap-1.5 font-medium"
              onClick={handleSave}
              disabled={!isValid || !hasChanges}
              id="gold-rate-save-btn"
            >
              <Shield className="h-4 w-4" />
              Update Rates
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
