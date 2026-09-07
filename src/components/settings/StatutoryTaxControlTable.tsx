import React from "react";
import {
  useStatutoryTaxStore,
  type TaxRuleStatus,
  type StatutoryRule,
} from "@/lib/statutory-tax-engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, HelpCircle, ShieldAlert, RotateCcw } from "lucide-react";

export function StatutoryTaxControlTable() {
  const { rules, setRuleStatus, setRuleRate, resetToDefaults } = useStatutoryTaxStore();

  const getStatusBadge = (status: TaxRuleStatus) => {
    switch (status) {
      case "ON":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px] font-semibold uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" />
            ON
          </Badge>
        );
      case "OFF":
        return (
          <Badge variant="outline" className="text-muted-foreground border-zinc-500/30 gap-1 text-[11px] font-semibold uppercase tracking-wider">
            OFF
          </Badge>
        );
      case "CONFIGURATION_REQUIRED":
        return (
          <Badge className="bg-amber-600/90 hover:bg-amber-700 text-white gap-1 text-[11px] font-semibold uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" />
            CONFIG REQUIRED
          </Badge>
        );
      case "REVIEW_REQUIRED":
        return (
          <Badge className="bg-purple-600/90 hover:bg-purple-700 text-white gap-1 text-[11px] font-semibold uppercase tracking-wider">
            <HelpCircle className="w-3 h-3" />
            REVIEW REQUIRED
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCategoryBadge = (cat: StatutoryRule["statusCategory"]) => {
    switch (cat) {
      case "STATUTORY RULE VERIFIED":
        return <span className="text-[10px] text-emerald-500 font-medium tracking-tight">Statutory Rule Verified</span>;
      case "CONFIGURATION-DEPENDENT":
        return <span className="text-[10px] text-amber-500 font-medium tracking-tight">Configuration-Dependent</span>;
      case "PROFESSIONAL REVIEW REQUIRED":
        return <span className="text-[10px] text-purple-400 font-medium tracking-tight">Professional Review Required</span>;
      default:
        return <span className="text-[10px] text-muted-foreground">{cat}</span>;
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-gold" />
            Statutory Tax & Compliance Control Matrix
          </h4>
          <p className="text-xs text-muted-foreground">
            Deterministic statutory tax rules. Tax is applied only when Rule is ON and statutory conditions match.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetToDefaults}
          className="text-xs h-7 gap-1 border-border/60 hover:bg-accent"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Defaults
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/70 bg-card/60">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-medium">
              <th className="py-2.5 px-3">Tax Rule</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Config Rate</th>
              <th className="py-2.5 px-3">Applies To</th>
              <th className="py-2.5 px-3">Effective From</th>
              <th className="py-2.5 px-3">Effective To</th>
              <th className="py-2.5 px-3 text-center">Toggle Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rules.map((rule) => (
              <tr key={rule.ruleId} className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-3 font-medium text-foreground">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground/90">{rule.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {rule.hsnSacCode ? `Code: ${rule.hsnSacCode} | ` : ""}ID: {rule.ruleId}
                    </span>
                    {getCategoryBadge(rule.statusCategory)}
                  </div>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  {getStatusBadge(rule.status)}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <Input
                      type="number"
                      step="0.1"
                      className="w-16 h-7 text-right text-xs px-1.5 font-mono"
                      value={rule.defaultRatePct}
                      disabled={rule.status === "OFF" || rule.taxType === "EXEMPT"}
                      onChange={(e) => setRuleRate(rule.ruleId, parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-muted-foreground font-mono">%</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-muted-foreground max-w-[220px]">
                  <p className="line-clamp-2">{rule.appliesTo}</p>
                </td>
                <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                  {rule.effectiveFrom}
                </td>
                <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                  {rule.effectiveTo ? (
                    <span className="text-red-400/90 font-medium">{rule.effectiveTo}</span>
                  ) : (
                    <span className="text-emerald-400/90 font-medium">Active (—)</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  <select
                    value={rule.status}
                    onChange={(e) => setRuleStatus(rule.ruleId, e.target.value as TaxRuleStatus)}
                    className="h-7 text-xs rounded border border-input bg-background px-2 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                  >
                    <option value="ON">ON</option>
                    <option value="OFF">OFF</option>
                    <option value="CONFIGURATION_REQUIRED">CONFIG REQ</option>
                    <option value="REVIEW_REQUIRED">REVIEW REQ</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-muted-foreground/80 flex items-center gap-2 p-2 rounded bg-muted/20 border border-border/40">
        <span className="font-semibold text-foreground">Rule Invariant:</span>
        Tax is only computed when Rule is ON and statutory transaction criteria match. Rule OFF always evaluates to ₹0 with an immutable frozen snapshot.
      </div>
    </div>
  );
}
