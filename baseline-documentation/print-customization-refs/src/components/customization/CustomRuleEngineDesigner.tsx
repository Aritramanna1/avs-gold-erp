/**
 * Declarative Business Rule Engine Designer
 * Master Reference: docs/MASTER/CALCULATION_AND_RULE_ENGINE.md
 * Master Reference: docs/MASTER/CUSTOMIZATION_MASTER.md
 *
 * "Support safe business rules such as:
 * IF Process = Chain THEN Exclude chain weight from worker remuneration.
 * IF Customer Type = Wholesale AND Net Weight > X THEN Use Formula B.
 * IF Loss > allowed wastage THEN Manager Approval Required.
 * Use declarative rules. No arbitrary JavaScript."
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sliders,
  Plus,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  type BusinessRuleDefinition,
  type RuleCondition,
  evaluateBusinessRules,
} from "@/lib/formula-engine";
import {
  ensureDeclarativeRulesLoaded,
  useDeclarativeRulesStore,
} from "@/lib/declarative-rules-store";

const PRESET_RULES: BusinessRuleDefinition[] = [
  {
    id: "rule_chain_exclusion",
    name: "Chain Weight Remuneration Exclusion",
    description:
      "When manufacturing chain items, deduct machine chain weight from worker labour calculation.",
    category: "labour",
    conditions: [{ field: "process_type", operator: "eq", value: "Chain" }],
    conditionLogic: "AND",
    action: {
      type: "apply_formula",
      targetField: "worker_eligible_weight",
      formulaExpression: "{net_weight} - {chain_weight}",
      message: "Deducted machine chain weight from worker remuneration.",
    },
    isActive: true,
  },
  {
    id: "rule_wholesale_pricing",
    name: "Wholesale Heavy Weight Rate Tier",
    description: "Wholesale orders exceeding 50g apply wholesale flat making charge rate.",
    category: "discount",
    conditions: [
      { field: "customer_type", operator: "eq", value: "Wholesale" },
      { field: "gross_weight", operator: "gt", value: 50.0 },
    ],
    conditionLogic: "AND",
    action: {
      type: "override_rate",
      targetField: "making_rate_per_gram",
      overrideValue: 350,
      message: "Applied Wholesale Volume Rate tier (₹350/g).",
    },
    isActive: true,
  },
  {
    id: "rule_excess_wastage_gate",
    name: "Karigar Excess Loss Approval Gate",
    description: "Require Workshop Owner OTP authorization if loss exceeds 0.50% of issued weight.",
    category: "approval",
    conditions: [{ field: "loss_percentage", operator: "gt", value: 0.5 }],
    conditionLogic: "AND",
    action: {
      type: "require_approval",
      approvalRole: "owner",
      message: "Loss exceeds allowed threshold (0.50%). Owner approval required to post voucher.",
    },
    isActive: true,
  },
];

export function CustomRuleEngineDesigner() {
  const { rules, hydrate, upsertRule, deleteRule, setRules } = useDeclarativeRulesStore();
  const [isNewRuleModalOpen, setIsNewRuleModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  useEffect(() => {
    void ensureDeclarativeRulesLoaded();
  }, []);

  // New Rule Form State
  const [ruleName, setRuleName] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");
  const [ruleCategory, setRuleCategory] = useState<BusinessRuleDefinition["category"]>("labour");
  const [conditionLogic, setConditionLogic] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { field: "process_type", operator: "eq", value: "Chain" },
  ]);
  const [actionType, setActionType] =
    useState<BusinessRuleDefinition["action"]["type"]>("apply_formula");
  const [actionTargetField, setActionTargetField] = useState("worker_eligible_weight");
  const [actionFormula, setActionFormula] = useState("{net_weight} - {chain_weight}");
  const [actionRole, setActionRole] = useState<"manager" | "owner" | "admin">("manager");
  const [actionMessage, setActionMessage] = useState("");

  // Test Simulation State
  const [testProcess, setTestProcess] = useState("Chain");
  const [testCustomerType, setTestCustomerType] = useState("Wholesale");
  const [testGrossWt, setTestGrossWt] = useState(65.0);
  const [testNetWt, setTestNetWt] = useState(60.0);
  const [testChainWt, setTestChainWt] = useState(8.5);
  const [testLossPct, setTestLossPct] = useState(0.65);

  const handleAddCondition = () => {
    setConditions([...conditions, { field: "gross_weight", operator: "gt", value: 50.0 }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleSaveNewRule = () => {
    if (!ruleName.trim()) {
      toast.error("Rule name is required.");
      return;
    }

    const newRule: BusinessRuleDefinition = {
      id: `rule_${Date.now()}`,
      name: ruleName.trim(),
      description: ruleDesc.trim(),
      category: ruleCategory,
      conditions,
      conditionLogic,
      action: {
        type: actionType,
        targetField: actionTargetField.trim() || undefined,
        formulaExpression: actionType === "apply_formula" ? actionFormula.trim() : undefined,
        approvalRole: actionType === "require_approval" ? actionRole : undefined,
        message: actionMessage.trim() || undefined,
      },
      isActive: true,
    };

    void upsertRule(newRule);
    setIsNewRuleModalOpen(false);
  };

  const toggleRuleActive = (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (rule) void upsertRule({ ...rule, isActive: !rule.isActive });
  };

  const handleDeleteRule = (id: string) => {
    void deleteRule(id);
  };

  // Test Simulation Execution
  const testContext = {
    process_type: testProcess,
    customer_type: testCustomerType,
    gross_weight: testGrossWt,
    net_weight: testNetWt,
    chain_weight: testChainWt,
    loss_percentage: testLossPct,
  };

  const testResults = evaluateBusinessRules(rules, testContext);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <Card className="p-5 border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-transparent to-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Sliders className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Declarative Business Rule Engine
                <Badge
                  variant="outline"
                  className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10"
                >
                  Safe Execution
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define automated business constraints (e.g. IF Process = Chain THEN Deduct Chain Wt;
                IF Loss &gt; 0.5% THEN Owner Approval).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTestModalOpen(true)}
              className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-600"
            >
              <Sparkles className="h-3.5 w-3.5" /> Test Rules Live
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setRuleName("");
                setRuleDesc("");
                setConditions([{ field: "process_type", operator: "eq", value: "Chain" }]);
                setIsNewRuleModalOpen(true);
              }}
              className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Create Business Rule
            </Button>
          </div>
        </div>
      </Card>

      {/* Rules Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rules.map((rule) => (
          <Card
            key={rule.id}
            className={`border transition-all ${
              rule.isActive ? "bg-card" : "opacity-60 bg-muted/20 border-dashed"
            }`}
          >
            <CardHeader className="p-4 pb-2 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-foreground">{rule.name}</h4>
                  <Badge variant="outline" className="text-[9px] capitalize mt-1">
                    {rule.category}
                  </Badge>
                </div>
                <Switch checked={rule.isActive} onCheckedChange={() => toggleRuleActive(rule.id)} />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                {rule.description}
              </p>
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-3">
              {/* Conditions Box */}
              <div className="p-2.5 rounded bg-muted/30 border space-y-1.5 text-[11px]">
                <span className="font-semibold text-muted-foreground block text-[10px]">
                  IF ({rule.conditionLogic}):
                </span>
                {rule.conditions.map((c, i) => (
                  <div key={i} className="font-mono text-foreground">
                    • {c.field} <span className="text-amber-500 font-bold">{c.operator}</span>{" "}
                    {String(c.value)}
                  </div>
                ))}
              </div>

              {/* Action Box */}
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 space-y-1 text-[11px]">
                <span className="font-semibold text-amber-600 block text-[10px]">THEN ACTION:</span>
                <div className="font-medium text-foreground">
                  {rule.action.type === "apply_formula" && (
                    <span>
                      Compute <code className="text-amber-600">{rule.action.targetField}</code> ={" "}
                      <code className="text-amber-600">{rule.action.formulaExpression}</code>
                    </span>
                  )}
                  {rule.action.type === "override_rate" && (
                    <span>
                      Set <code className="text-amber-600">{rule.action.targetField}</code> to ₹
                      {rule.action.overrideValue}
                    </span>
                  )}
                  {rule.action.type === "require_approval" && (
                    <span className="text-rose-500 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 inline" /> Requires{" "}
                      {rule.action.approvalRole} sign-off
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteRule(rule.id)}
                  className="h-6 w-6 p-0 text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Modal: Create Business Rule ─────────────────────────────────── */}
      <Dialog open={isNewRuleModalOpen} onOpenChange={setIsNewRuleModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Sliders className="h-5 w-5 text-amber-500" />
              Define Declarative Business Rule
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Rule Name *</Label>
                <Input
                  placeholder="e.g. Casting Shrinkage Limit"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <select
                  value={ruleCategory}
                  onChange={(e) => setRuleCategory(e.target.value as any)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                >
                  <option value="labour">Artisan Labour & Remuneration</option>
                  <option value="approval">Approval Authorization Gate</option>
                  <option value="discount">Pricing & Discount Tier</option>
                  <option value="wastage">Wastage & Loss Matrix</option>
                  <option value="custom">Custom Policy</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Input
                placeholder="Explain the policy rationale..."
                value={ruleDesc}
                onChange={(e) => setRuleDesc(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>

            {/* Conditions Builder */}
            <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">IF Conditions</Label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Match Logic:</span>
                  <select
                    value={conditionLogic}
                    onChange={(e) => setConditionLogic(e.target.value as any)}
                    className="h-7 rounded border border-input bg-background px-2 text-xs"
                  >
                    <option value="AND">All Conditions (AND)</option>
                    <option value="OR">Any Condition (OR)</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddCondition}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Condition
                  </Button>
                </div>
              </div>

              {conditions.map((cond, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                  <Input
                    placeholder="Field (e.g. process_type)"
                    value={cond.field}
                    onChange={(e) => {
                      const updated = [...conditions];
                      updated[idx].field = e.target.value;
                      setConditions(updated);
                    }}
                    className="h-8 text-xs font-mono"
                  />
                  <select
                    value={cond.operator}
                    onChange={(e) => {
                      const updated = [...conditions];
                      updated[idx].operator = e.target.value as any;
                      setConditions(updated);
                    }}
                    className="h-8 rounded border border-input bg-background px-2 text-xs"
                  >
                    <option value="eq">Equals (=)</option>
                    <option value="neq">Not Equals (!=)</option>
                    <option value="gt">Greater Than (&gt;)</option>
                    <option value="gte">Greater or Equal (&gt;=)</option>
                    <option value="lt">Less Than (&lt;)</option>
                    <option value="lte">Less or Equal (&lt;=)</option>
                    <option value="contains">Contains</option>
                  </select>
                  <Input
                    placeholder="Value (e.g. Chain or 50)"
                    value={String(cond.value)}
                    onChange={(e) => {
                      const updated = [...conditions];
                      updated[idx].value = e.target.value;
                      setConditions(updated);
                    }}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveCondition(idx)}
                    disabled={conditions.length === 1}
                    className="h-8 w-8 p-0 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Action Builder */}
            <div className="p-3 border rounded-lg bg-amber-500/5 border-amber-500/20 space-y-3">
              <Label className="text-xs font-semibold text-amber-600">THEN Action</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px]">Action Type</Label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value as any)}
                    className="w-full h-8 rounded border border-input bg-background px-2 text-xs mt-1"
                  >
                    <option value="apply_formula">Apply Mathematical Formula</option>
                    <option value="override_rate">Override Pricing / Rate</option>
                    <option value="require_approval">Require Manager / Owner Approval</option>
                  </select>
                </div>

                {actionType === "apply_formula" && (
                  <div>
                    <Label className="text-[11px]">Target Formula Expression</Label>
                    <Input
                      placeholder="e.g. {net_weight} - {chain_weight}"
                      value={actionFormula}
                      onChange={(e) => setActionFormula(e.target.value)}
                      className="h-8 text-xs font-mono mt-1"
                    />
                  </div>
                )}

                {actionType === "require_approval" && (
                  <div>
                    <Label className="text-[11px]">Required Approver Role</Label>
                    <select
                      value={actionRole}
                      onChange={(e) => setActionRole(e.target.value as any)}
                      className="w-full h-8 rounded border border-input bg-background px-2 text-xs mt-1"
                    >
                      <option value="manager">Workshop Manager</option>
                      <option value="owner">Super Owner / Director</option>
                      <option value="admin">System Administrator</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsNewRuleModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveNewRule}
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Live Test Console ────────────────────────────────────── */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Live Rule Engine Evaluation Test
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Process Type</Label>
                <Input
                  value={testProcess}
                  onChange={(e) => setTestProcess(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Customer Type</Label>
                <Input
                  value={testCustomerType}
                  onChange={(e) => setTestCustomerType(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Gross Weight (g)</Label>
                <Input
                  type="number"
                  value={testGrossWt}
                  onChange={(e) => setTestGrossWt(parseFloat(e.target.value || "0"))}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Chain Weight (g)</Label>
                <Input
                  type="number"
                  value={testChainWt}
                  onChange={(e) => setTestChainWt(parseFloat(e.target.value || "0"))}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Loss Percentage (%)</Label>
                <Input
                  type="number"
                  value={testLossPct}
                  onChange={(e) => setTestLossPct(parseFloat(e.target.value || "0"))}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            {/* Triggered Results */}
            <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
              <div className="font-bold text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Triggered Rules: {testResults.triggeredRules.length}
              </div>

              {testResults.triggeredRules.map((tr) => (
                <div key={tr.id} className="p-2 border rounded bg-card text-[11px]">
                  <div className="font-semibold text-amber-600">{tr.name}</div>
                  <div className="text-muted-foreground">{tr.description}</div>
                </div>
              ))}

              {testResults.requiresApproval && (
                <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-500 font-semibold text-xs flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Approval Required: {testResults.approvalRole?.toUpperCase()}
                </div>
              )}

              {Object.keys(testResults.calculatedOverrides).length > 0 && (
                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                  <span className="font-semibold text-amber-600 block">
                    Calculated Formula Overrides:
                  </span>
                  {Object.entries(testResults.calculatedOverrides).map(([k, v]) => (
                    <div key={k} className="font-mono">
                      {k} = {v.toFixed(3)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setIsTestModalOpen(false)} className="text-xs h-8">
              Close Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
