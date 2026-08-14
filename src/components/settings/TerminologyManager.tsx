import React, { useState } from "react";
import {
  useTerminology,
  CANONICAL_42_TERMS,
  type TerminologyPackId,
} from "@/lib/terminology-engine-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, RefreshCw, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";

export function TerminologyManager() {
  const {
    activePack,
    setActivePack,
    customOverrides,
    setCustomOverride,
    resetCustomOverrides,
    tTerm,
  } = useTerminology();

  const [search, setSearch] = useState("");

  const PACK_LABELS: Record<TerminologyPackId, string> = {
    indian_trade: "Indian Jewellery Trade (Bhav, Karigar, Jama, Khata, Hisab)",
    standard_business: "Standard Business / Accounting (Rate, Worker, Inward, Ledger)",
    international_formal: "International / Formal (Spot Rate, Artisan, Statement)",
    manufacturer_default: "Manufacturer Default (Daily Bhav, Bench Karigar, Majuri)",
    wholesaler_default: "Wholesaler Default (Dealer Rate, Stock Inward, Batch)",
    retail_default: "Retail Showroom Default (Today's Rate, Customer Old Gold)",
  };

  const filteredTerms = CANONICAL_42_TERMS.filter(
    (t) =>
      t.key.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      tTerm(t.key).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Active Pack Selector */}
      <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-500" />
              Canonical Jewellery Terminology Engine (42 Terms)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Personalize domain vocabulary across all screens, print documents, reports, and AI
              assistant prompts.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetCustomOverrides();
              toast.success("Custom overrides reset to active preset default.");
            }}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset Custom Overrides
          </Button>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <label className="text-xs font-semibold text-foreground">
            Active Terminology Preset Pack:
          </label>
          <Select
            value={activePack}
            onValueChange={(v) => {
              setActivePack(v as TerminologyPackId);
              toast.success(`Terminology pack switched to: ${PACK_LABELS[v as TerminologyPackId]}`);
            }}
          >
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Select Terminology Preset" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PACK_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dictionary Search & Custom Override Grid */}
      <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-semibold text-sm text-foreground">
            Trade Terms Dictionary ({filteredTerms.length} of 42)
          </h3>
          <Input
            placeholder="Search terms (e.g. Karigar, Bhav, Hisab, Gold)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs h-8 max-w-xs"
          />
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted text-muted-foreground font-medium border-b">
              <tr>
                <th className="py-2.5 px-3 text-left w-12">#</th>
                <th className="py-2.5 px-3 text-left">Canonical Key & Concept</th>
                <th className="py-2.5 px-3 text-left">Active Display Label</th>
                <th className="py-2.5 px-3 text-left">Custom Tenant Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTerms.map((term) => {
                const activeLabel = tTerm(term.key);
                const isOverridden = !!customOverrides[term.key];

                return (
                  <tr key={term.key} className="hover:bg-muted/40">
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">{term.number}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-medium text-foreground text-[11px]">
                        {term.key}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {term.description}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant={isOverridden ? "default" : "outline"}
                        className="text-xs font-medium"
                      >
                        {activeLabel}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <Input
                        placeholder={activeLabel}
                        value={customOverrides[term.key] || ""}
                        onChange={(e) => setCustomOverride(term.key, e.target.value)}
                        className="text-xs h-7 max-w-[200px]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
