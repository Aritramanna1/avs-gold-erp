/**
 * Business Language Aliases — Customization → Language & Terms
 * Tenant-configurable spelling/terminology aliases for the Assistant.
 */
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Languages, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  ensureLanguageAliasesLoaded,
  useLanguageAliasesStore,
  type AliasType,
} from "@/lib/assistant/language-aliases-store";

const ALIAS_TYPE_LABELS: Record<AliasType, string> = {
  terminology: "Trade Term",
  typo: "Spelling Fix",
  hinglish: "Hinglish",
  abbreviation: "Abbreviation",
  party_nickname: "Party Nickname",
};

export function BusinessLanguageAliases() {
  const { aliases, loading, hydrated, hydrate, addAlias, removeAlias } = useLanguageAliasesStore();
  const [open, setOpen] = useState(false);
  const [aliasText, setAliasText] = useState("");
  const [canonicalText, setCanonicalText] = useState("");
  const [aliasType, setAliasType] = useState<AliasType>("terminology");
  const [contextHint, setContextHint] = useState("");

  useEffect(() => {
    void ensureLanguageAliasesLoaded();
  }, [hydrate]);

  const handleAdd = async () => {
    if (!aliasText.trim() || !canonicalText.trim()) {
      toast.error("Both alias and canonical term are required.");
      return;
    }
    const created = await addAlias({
      aliasText: aliasText.trim(),
      canonicalText: canonicalText.trim(),
      aliasType,
      language: "en-IN",
      contextHint: contextHint.trim() || undefined,
    });
    if (created) {
      setOpen(false);
      setAliasText("");
      setCanonicalText("");
      setContextHint("");
      toast.success(
        `Alias "${created.aliasText}" → "${created.canonicalText}" saved. Assistant will understand it immediately.`,
      );
    }
  };

  return (
    <Card className="p-5 mt-4 border-border/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-sm bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Languages className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Business Language Aliases
              <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/30">
                Assistant
              </Badge>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Teach the Assistant local words, typos, and trade slang your team uses. Applied
              instantly — no retraining needed.
            </p>
          </div>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Alias
        </Button>
      </div>

      {loading && !hydrated ? (
        <p className="text-xs text-muted-foreground">Loading aliases…</p>
      ) : aliases.length === 0 ? (
        <div className="rounded-sm border border-dashed p-6 text-center text-xs text-muted-foreground">
          <Sparkles className="h-5 w-5 mx-auto mb-2 text-amber-500/60" />
          No custom aliases yet. Built-in jewellery trade aliases (karigr→karigar, bhav, jama, etc.)
          are already active.
          <br />
          Add city-specific or business-specific words here.
        </div>
      ) : (
        <div className="rounded-sm border divide-y text-xs">
          {aliases.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-2.5 gap-2">
              <div className="min-w-0">
                <span className="font-mono text-amber-600">{a.aliasText}</span>
                <span className="text-muted-foreground mx-2">→</span>
                <span className="font-medium">{a.canonicalText}</span>
                <Badge variant="secondary" className="ml-2 text-[9px]">
                  {ALIAS_TYPE_LABELS[a.aliasType]}
                </Badge>
                {a.contextHint && (
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    {a.contextHint}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => void removeAlias(a.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Business Language Alias</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Word your team uses (alias)</Label>
              <Input
                className="h-8 text-xs mt-1"
                placeholder="e.g. mistri, seth, sonar"
                value={aliasText}
                onChange={(e) => setAliasText(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Canonical term Assistant should understand</Label>
              <Input
                className="h-8 text-xs mt-1"
                placeholder="e.g. karigar, customer, gold"
                value={canonicalText}
                onChange={(e) => setCanonicalText(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <select
                className="w-full h-8 mt-1 rounded-md border border-input bg-background px-2 text-xs"
                value={aliasType}
                onChange={(e) => setAliasType(e.target.value as AliasType)}
              >
                {Object.entries(ALIAS_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Context hint (optional)</Label>
              <Input
                className="h-8 text-xs mt-1"
                placeholder="e.g. Used in Mumbai workshop for stone setters"
                value={contextHint}
                onChange={(e) => setContextHint(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleAdd()}>
              Save Alias
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
