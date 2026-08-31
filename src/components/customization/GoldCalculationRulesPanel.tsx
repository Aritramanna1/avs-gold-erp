import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Calculator,
  Coins,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  useGoldCalculationRules,
  currentGoldCalculationRules,
} from "@/lib/gold-calculation-rules-store";
import {
  GOLD_CALC_MODULES,
  DEFAULT_MODULE_GOLD_RULES,
  type GoldCalcModuleId,
  type ModuleGoldRule,
  type FineGoldMethod,
  type FineGoldBase,
  type FinenessBasis,
  type SourcePurityMode,
  type ModuleSourcePurityPolicy,
  type GoldSourcePurityPolicies,
  type CalculationMode,
  type JewelleryCalcFeatureFlags,
} from "@/lib/gold-calculation-rules";
import { mgToGrams, gramsToMg } from "@/lib/gold";

const METHOD_LABELS: Record<FineGoldMethod, string> = {
  metal_content_999: "metal_content_999",
  hisob_100: "hisob_100",
  touch_100: "touch_100",
};

const METHOD_DESCRIPTIONS: Record<FineGoldMethod, string> = {
  metal_content_999: "Metal Content (Gross/Net x Purity / Basis)",
  hisob_100: "Hisob 100 (Traditional Wastage & Touch)",
  touch_100: "Touch 100 (Simple Purity Percentage)",
};

interface PurityPrefixRule {
  id: string;
  prefix: string;
  standardTouch: string;
  rounding: string;
}

const DEFAULT_PREFIX_RULES: PurityPrefixRule[] = [
  { id: "1", prefix: "22K / 916", standardTouch: "91.60", rounding: "0.001 fine" },
  { id: "2", prefix: "18K / 750", standardTouch: "75.00", rounding: "0.001 fine" },
  { id: "3", prefix: "14K / 585", standardTouch: "58.50", rounding: "0.001 fine" },
  { id: "4", prefix: "24K / 999", standardTouch: "99.90", rounding: "0.001 fine" },
  { id: "5", prefix: "Bullion / 995", standardTouch: "99.50", rounding: "0.001 fine" },
];

export function GoldCalculationRulesPanel() {
  const { doc, hydrated, saving, hydrate, saveRules } = useGoldCalculationRules();

  // Local draft states
  const [pureThreshold, setPureThreshold] = useState<string>("995");
  const [defaultCalcMode, setDefaultCalcMode] = useState<string>("995");
  const [moduleRules, setModuleRules] = useState<Record<GoldCalcModuleId, ModuleGoldRule>>(
    DEFAULT_MODULE_GOLD_RULES,
  );
  const [conversionPolicy, setConversionPolicy] = useState<ModuleSourcePurityPolicy>({
    mode: "ledger_with_override",
    overrideRoles: ["owner", "admin", "manager", "boss_admin"],
    requireOverrideReason: true,
    requireConfirmBeforePost: true,
  });
  const [salePolicy, setSalePolicy] = useState<ModuleSourcePurityPolicy>({
    mode: "ledger_with_override",
    overrideRoles: ["owner", "admin", "manager", "boss_admin"],
    requireOverrideReason: true,
    requireConfirmBeforePost: true,
  });
  const [prefixRules, setPrefixRules] = useState<PurityPrefixRule[]>(DEFAULT_PREFIX_RULES);

  // Live Formula Simulator State
  const [simGross, setSimGross] = useState<string>("46.112");
  const [simAdd, setSimAdd] = useState<string>("0");
  const [simLess, setSimLess] = useState<string>("0");
  const [simTouch, setSimTouch] = useState<string>("92");
  const [simWastage, setSimWastage] = useState<string>("3.00");
  const [simFormula, setSimFormula] = useState<string>("gross_touch_wastage");

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (doc) {
      setPureThreshold(String(doc.pureGoldMinPermille || 995));
      setDefaultCalcMode(String(doc.finenessBasis || 995));
      setModuleRules(doc.moduleMap ? { ...doc.moduleMap } : DEFAULT_MODULE_GOLD_RULES);
      if (doc.sourcePurityPolicy) {
        if (doc.sourcePurityPolicy.conversion) {
          setConversionPolicy({ ...doc.sourcePurityPolicy.conversion });
        }
        if (doc.sourcePurityPolicy.melt) {
          setSalePolicy({ ...doc.sourcePurityPolicy.melt });
        }
      }
    }
  }, [doc]);

  // Simulator Computation
  const simResult = useMemo(() => {
    const gross = parseFloat(simGross) || 0;
    const add = parseFloat(simAdd) || 0;
    const less = parseFloat(simLess) || 0;
    const touch = parseFloat(simTouch) || 0;
    const wastage = parseFloat(simWastage) || 0;
    const net = gross + add - less;

    let fine = 0;
    const basisVal = parseFloat(defaultCalcMode) || 995;
    if (simFormula === "gross_touch_wastage" || simFormula === "hisob") {
      fine = (net * (touch + wastage)) / 100;
    } else if (simFormula === "net_touch") {
      fine = (net * touch) / 100;
    } else if (simFormula === "gross_basis") {
      fine = (gross * (touch * 10)) / basisVal;
    } else if (simFormula === "net_basis") {
      fine = (net * (touch * 10)) / basisVal;
    } else if (simFormula === "gross_995") {
      fine = (gross * (touch * 10)) / 995;
    } else if (simFormula === "gross_999") {
      fine = (gross * (touch * 10)) / 999;
    } else if (simFormula === "gross_1000") {
      fine = (gross * (touch * 10)) / 1000;
    } else {
      fine = (net * touch) / 100;
    }

    return {
      netGrams: net.toFixed(3),
      fineGrams: fine.toFixed(3),
    };
  }, [simGross, simAdd, simLess, simTouch, simWastage, simFormula, defaultCalcMode]);

  const handleSaveThreshold = async () => {
    const val = parseInt(pureThreshold, 10);
    if (isNaN(val) || val < 500 || val > 1000) {
      toast.error("Enter a valid purity threshold between 500 and 1000 ‰");
      return;
    }
    try {
      await saveRules({
        moduleMap: moduleRules,
        pureGoldMinPermille: val,
        finenessBasis: (parseInt(defaultCalcMode, 10) || 995) as FinenessBasis,
        sourcePurityPolicy: {
          conversion: conversionPolicy,
          melt: salePolicy,
        },
      });
      toast.success(`Pure gold threshold saved: ${val}‰ active.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save threshold.");
    }
  };

  const handleSaveAll = async () => {
    try {
      const basis = (parseInt(defaultCalcMode, 10) || 995) as FinenessBasis;
      const pureVal = parseInt(pureThreshold, 10) || 995;

      await saveRules({
        moduleMap: moduleRules,
        pureGoldMinPermille: pureVal,
        finenessBasis: basis,
        sourcePurityPolicy: {
          conversion: conversionPolicy,
          melt: salePolicy,
        },
      });
      toast.success("All gold calculation rules and module matrix saved successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save gold calculation rules.");
    }
  };

  const updateModuleRule = (
    modId: GoldCalcModuleId,
    patch: Partial<ModuleGoldRule>,
  ) => {
    setModuleRules((prev) => ({
      ...prev,
      [modId]: {
        ...(prev[modId] ?? DEFAULT_MODULE_GOLD_RULES[modId]),
        ...patch,
      },
    }));
  };

  const getRuleFormulaString = (rule?: ModuleGoldRule) => {
    if (!rule) return "Gross - Wastage - Less + Add";
    const baseStr = rule.base === "net" ? "Net" : "Gross";
    if (rule.method === "hisob_100") {
      return rule.includeWastage
        ? `(${baseStr} + Wastage) x Touch / 100`
        : `${baseStr} x Touch / 100`;
    }
    if (rule.method === "touch_100") {
      return `${baseStr} x Touch / 100`;
    }
    return rule.base === "net"
      ? `Net x Purity / ${defaultCalcMode}`
      : `Gross - Wastage - Less + Add`;
  };

  return (
    <div className="space-y-6">
      {/* ── Section 1: Interactive Gold Calculation Formula Tester ── */}
      <Card className="border border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Calculator className="h-4 w-4 text-gold" />
                Gold calculation
              </CardTitle>
              <CardDescription className="text-xs">
                Formula: Gross - Less + Add - Loss / Fine = User Entered · Live calculation verification
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs bg-gold/10 text-gold border-gold/30">
              Interactive Tester
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Controls */}
            <div className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Lot / Gross g</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={simGross}
                    onChange={(e) => setSimGross(e.target.value)}
                    className="font-mono text-sm h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Add g</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={simAdd}
                    onChange={(e) => setSimAdd(e.target.value)}
                    className="font-mono text-sm h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Touch %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={simTouch}
                    onChange={(e) => setSimTouch(e.target.value)}
                    className="font-mono text-sm h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Wastage %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={simWastage}
                    onChange={(e) => setSimWastage(e.target.value)}
                    className="font-mono text-sm h-9"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Formula</Label>
                <select
                  value={simFormula}
                  onChange={(e) => setSimFormula(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-mono"
                >
                  <option value="gross_touch_wastage">
                    Gross + (Gross - Less - Touch + Wastage) = 100 as Fine
                  </option>
                  <option value="hisob">
                    Traditional Hisob: (Net + Wastage) x Touch / 100
                  </option>
                  <option value="net_touch">
                    Net Touch: Net x Touch / 100
                  </option>
                  <option value="gross_basis">
                    {`Metal Content ${defaultCalcMode}: Gross x Purity / ${defaultCalcMode}`}
                  </option>
                  <option value="net_basis">
                    {`Metal Content Net ${defaultCalcMode}: Net x Purity / ${defaultCalcMode}`}
                  </option>
                </select>
              </div>
            </div>

            {/* Result Box */}
            <div className="lg:col-span-4 rounded-xl border border-gold/40 bg-gradient-to-br from-gold/10 via-gold/5 to-muted/30 p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  Result
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                  GROSS - Net - (Gross + Add - Less) Fine = User Entered
                </p>
                <div className="mt-3 space-y-1">
                  <div className="text-xs text-muted-foreground font-mono">
                    Net {simResult.netGrams} g
                  </div>
                  <div className="text-2xl font-bold font-mono text-gold">
                    {simResult.fineGrams} g fine
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs h-8"
                  onClick={() => {
                    setSimGross("46.112");
                    setSimAdd("0");
                    setSimLess("0");
                    setSimTouch("92");
                    setSimWastage("3.00");
                    setSimFormula("gross_touch_wastage");
                  }}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Restore Default
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs h-8 bg-gold hover:bg-gold/90 text-black font-semibold"
                  onClick={() => toast.success(`Simulated Fine: ${simResult.fineGrams} g fine`)}
                >
                  <Sparkles className="h-3 w-3 mr-1" /> Recalculate
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Prefix / Purity Rule Matrix (Fine / 10) ── */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="bg-muted/20 pb-3 border-b">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Coins className="h-4 w-4 text-amber-500" />
            Prefix / Purity Rule Matrix (Fine / 10)
          </CardTitle>
          <CardDescription className="text-xs">
            Set specific rounding rules or fixed conversion factors if applicable for other pure metals / purities / items (e.g. 10 purity = exact 1.0000 fine). Formula selection default / Fine matrix lookup by prefix and purity.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="text-left p-2.5">Gross metal / item prefix</th>
                  <th className="text-left p-2.5">Standard Touch/Purity</th>
                  <th className="text-left p-2.5">Rounding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {prefixRules.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="p-2.5 font-medium">{r.prefix}</td>
                    <td className="p-2.5 font-mono">{r.standardTouch}%</td>
                    <td className="p-2.5 font-mono text-muted-foreground">{r.rounding}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Pure / Fine Gold Threshold & Default Calculation Mode ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="bg-muted/20 pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Pure / Fine gold threshold
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                System Enforcement
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Any balance or issue in which fine gold purity is treated as pure gold (e.g. gross weight = fine weight). Set this to 995, 999, or 1000 to match local bullion market purity standards: 995 (default for local fine), 999.0 (mint standard), 999.9 (Karat fine), 1000 (standard pure).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Minimum pure / gold purity</Label>
                <Input
                  type="number"
                  value={pureThreshold}
                  onChange={(e) => setPureThreshold(e.target.value)}
                  className="font-mono text-sm h-9"
                  placeholder="995"
                />
              </div>
              <Button
                size="sm"
                onClick={handleSaveThreshold}
                disabled={saving}
                className="h-9 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                Save threshold
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Current active rule:</span>
              <Badge variant="outline" className="font-mono text-xs font-bold text-amber-600">
                {pureThreshold}‰
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="bg-muted/20 pb-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-gold" />
              Standard / Default calculation mode
            </CardTitle>
            <CardDescription className="text-xs">
              When a transaction does not specify formula, the configured default in the dropdown applies. Selecting 995 use = 995 metal return rule applies — the engine uses default calculations from 995.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Default calculation basis</Label>
              <select
                value={defaultCalcMode}
                onChange={(e) => setDefaultCalcMode(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-mono"
              >
                <option value="995">995 - Fine = Gross x purity / 995 (Legacy default)</option>
                <option value="999">999 - Fine = Gross x purity / 999 (Bullion standard)</option>
                <option value="1000">1000 - Fine = Gross x purity / 1000 (Exact decimal)</option>
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Active Fineness Denominator: <strong className="text-foreground font-mono">{defaultCalcMode}</strong>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 4: Module-Wise Calculation Matrix Table ── */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="bg-muted/20 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold">Gold calculation rules by module</CardTitle>
              <CardDescription className="text-xs">
                Applied methods for advance/job issues. Pure gold threshold is set above; the style/formula below sets the exact per-module format.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs bg-gold/10 text-gold border-gold/30">
              15 Operational Modules
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="text-left p-2.5">Module</th>
                  <th className="text-left p-2.5 min-w-[180px]">Method</th>
                  <th className="text-left p-2.5">Base</th>
                  <th className="text-center p-2.5">Wastage</th>
                  <th className="text-center p-2.5">Less</th>
                  <th className="text-left p-2.5 min-w-[200px]">Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {GOLD_CALC_MODULES.map((m) => {
                  const rule = moduleRules[m.id] ?? DEFAULT_MODULE_GOLD_RULES[m.id] ?? {
                    method: "metal_content_999",
                    base: "gross",
                    includeWastage: false,
                    includeLess: true,
                  };
                  return (
                    <tr key={m.id} className="hover:bg-muted/20">
                      <td className="p-2.5 font-medium">{m.label}</td>
                      <td className="p-2.5">
                        <select
                          value={rule.method}
                          onChange={(e) =>
                            updateModuleRule(m.id, {
                              method: e.target.value as FineGoldMethod,
                            })
                          }
                          className="h-8 w-full rounded border border-input bg-background px-2 text-xs font-mono"
                        >
                          <option value="metal_content_999">{`metal_content_${defaultCalcMode}`}</option>
                          <option value="hisob_100">hisob_100</option>
                          <option value="touch_100">touch_100</option>
                        </select>
                      </td>
                      <td className="p-2.5">
                        <select
                          value={rule.base}
                          onChange={(e) =>
                            updateModuleRule(m.id, {
                              base: e.target.value as FineGoldBase,
                            })
                          }
                          className="h-8 rounded border border-input bg-background px-2 text-xs font-mono"
                        >
                          <option value="gross">Gross</option>
                          <option value="net">Net</option>
                        </select>
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={rule.includeWastage}
                          onChange={(e) =>
                            updateModuleRule(m.id, { includeWastage: e.target.checked })
                          }
                          className="rounded border-input h-4 w-4"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={rule.includeLess}
                          onChange={(e) =>
                            updateModuleRule(m.id, { includeLess: e.target.checked })
                          }
                          className="rounded border-input h-4 w-4"
                        />
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-muted-foreground">
                        {getRuleFormulaString(rule)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Conversion & Alert Policy per purity policy ── */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="bg-muted/20 pb-3 border-b">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-500" />
            Conversion &amp; Alert Policy per purity policy
          </CardTitle>
          <CardDescription className="text-xs">
            Below are system policies around how impure purity is calculated for fine conversion and whether there are upper/lower limits or warnings when fine is entered below / above threshold. Modifying these policies requires admin authority.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">
          {/* Conversion Policy Box */}
          <div className="p-4 border rounded-xl bg-muted/10 space-y-4">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wide">
              Conversion
            </h4>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Purity calculation Mode</Label>
                <select
                  value={conversionPolicy.mode}
                  onChange={(e) =>
                    setConversionPolicy({
                      ...conversionPolicy,
                      mode: e.target.value as SourcePurityMode,
                    })
                  }
                  className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="ledger_with_override">
                    From ledger/fine (authorized override allowed)
                  </option>
                  <option value="ledger_line">Always from ledger line (strictly locked)</option>
                  <option value="manual">Manual entry allowed</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground">
                  Override roles (semicolon-separated, leave blank for no role allowed)
                </Label>
                <Input
                  value={conversionPolicy.overrideRoles.join(", ")}
                  onChange={(e) =>
                    setConversionPolicy({
                      ...conversionPolicy,
                      overrideRoles: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="h-8 text-xs font-mono"
                  placeholder="owner, admin, manager, boss_admin"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={conversionPolicy.requireOverrideReason}
                    onChange={(e) =>
                      setConversionPolicy({
                        ...conversionPolicy,
                        requireOverrideReason: e.target.checked,
                      })
                    }
                    className="rounded border-input h-4 w-4"
                  />
                  <span>Require override reason</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={conversionPolicy.requireConfirmBeforePost}
                    onChange={(e) =>
                      setConversionPolicy({
                        ...conversionPolicy,
                        requireConfirmBeforePost: e.target.checked,
                      })
                    }
                    className="rounded border-input h-4 w-4"
                  />
                  <span>Require two-factor / OTP confirmation before post</span>
                </label>
              </div>
            </div>
          </div>

          {/* Sale / Melt Policy Box */}
          <div className="p-4 border rounded-xl bg-muted/10 space-y-4">
            <h4 className="font-semibold text-xs text-foreground uppercase tracking-wide">
              Sale
            </h4>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Purity calculation Mode</Label>
                <select
                  value={salePolicy.mode}
                  onChange={(e) =>
                    setSalePolicy({
                      ...salePolicy,
                      mode: e.target.value as SourcePurityMode,
                    })
                  }
                  className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="ledger_with_override">
                    From ledger/fine (authorized override allowed)
                  </option>
                  <option value="ledger_line">Always from ledger line (strictly locked)</option>
                  <option value="manual">Manual entry allowed</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground">
                  Override roles (semicolon-separated, leave blank for no role allowed)
                </Label>
                <Input
                  value={salePolicy.overrideRoles.join(", ")}
                  onChange={(e) =>
                    setSalePolicy({
                      ...salePolicy,
                      overrideRoles: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="h-8 text-xs font-mono"
                  placeholder="owner, admin, manager, boss_admin"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salePolicy.requireOverrideReason}
                    onChange={(e) =>
                      setSalePolicy({
                        ...salePolicy,
                        requireOverrideReason: e.target.checked,
                      })
                    }
                    className="rounded border-input h-4 w-4"
                  />
                  <span>Require override reason</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salePolicy.requireConfirmBeforePost}
                    onChange={(e) =>
                      setSalePolicy({
                        ...salePolicy,
                        requireConfirmBeforePost: e.target.checked,
                      })
                    }
                    className="rounded border-input h-4 w-4"
                  />
                  <span>Require two-factor / OTP confirmation before post</span>
                </label>
              </div>
            </div>
          </div>

          {/* Master Save Button */}
          <div className="flex justify-end pt-2">
            <Button
              size="lg"
              onClick={handleSaveAll}
              disabled={saving}
              className="bg-gold hover:bg-gold/90 text-black font-bold text-sm gap-2 h-11 px-6 shadow-md"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving rules…" : "Save gold calculation rules"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
