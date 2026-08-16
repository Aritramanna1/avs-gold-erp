/**
 * Canonical Route: /control/shortcuts
 * Configurable Keyboard Shortcuts & Power-User Input Workspace
 * Master Reference: docs/KEYBOARD_AND_INPUT_MASTER.md & ADAPTIVE_UI_MASTER.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Keyboard,
  RotateCcw,
  Search,
  Zap,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Edit2,
  Check,
} from "lucide-react";
import { useShortcutsStore, type ShortcutDefinition } from "@/lib/shortcuts-store";
import { toast } from "sonner";

export const Route = createFileRoute("/control/shortcuts")({
  head: () => ({ meta: [{ title: "Keyboard Shortcuts & Input · Ornexa ERP" }] }),
  component: ShortcutsControlPage,
});

function ShortcutsControlPage() {
  const {
    shortcuts,
    powerUser,
    updateShortcut,
    resetShortcut,
    restoreAllDefaults,
    setPresetProfile,
    updatePowerUserSettings,
  } = useShortcutsStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Keybinding Capture Modal
  const [editingShortcut, setEditingShortcut] = useState<ShortcutDefinition | null>(null);
  const [capturedKeys, setCapturedKeys] = useState("");

  const categories = [
    "Navigation",
    "Sales & Billing",
    "Workshop & Metal",
    "Accounts & Stock",
    "System Tools",
  ];

  const filteredShortcuts = shortcuts.filter((s) => {
    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;
    const matchesQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.customKeys || s.defaultKeys).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingShortcut) return;
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.metaKey) parts.push("Cmd");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");

    const key = e.key.toUpperCase();
    if (!["CONTROL", "ALT", "SHIFT", "META"].includes(key)) {
      parts.push(key);
      setCapturedKeys(parts.join("+"));
    }
  };

  const handleSaveCapturedKey = () => {
    if (editingShortcut && capturedKeys) {
      updateShortcut(editingShortcut.id, capturedKeys);
      setEditingShortcut(null);
      setCapturedKeys("");
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Keyboard Shortcuts & Power-User Ergonomics"
        subtitle="Configure rapid keystrokes, streamline counter billing workflows, and customize numpad data entry speeds without touching the mouse."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={restoreAllDefaults}
            className="h-8 text-xs gap-1.5 border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restore Factory Defaults
          </Button>
        }
      />

      {/* Power-User Ergonomics Panel */}
      <Card className="p-5 border bg-muted/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold text-sm text-foreground">
              High-Speed Power-User Mode Settings
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Preset Profile:</span>
            <select
              value={powerUser.presetProfile}
              onChange={(e) => setPresetProfile(e.target.value as any)}
              className="h-7 text-xs rounded border border-input bg-background px-2 font-medium"
            >
              <option value="standard">Standard Ornexa</option>
              <option value="tally_like">Tally Prime Ergonomics</option>
              <option value="jwelly_like">Jwelly Industry Layout</option>
              <option value="custom">Custom Customized</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-card cursor-pointer hover:border-primary/50 transition">
            <input
              type="checkbox"
              checked={powerUser.autoAdvanceGridOnEnter}
              onChange={(e) =>
                updatePowerUserSettings({ autoAdvanceGridOnEnter: e.target.checked })
              }
              className="mt-0.5 rounded border-input text-amber-500 focus:ring-amber-500"
            />
            <div>
              <div className="font-semibold text-foreground">Auto-Advance on Enter</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Pressing Enter on the last column commits the row and opens a new blank line item
                with autofocus.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-card cursor-pointer hover:border-primary/50 transition">
            <input
              type="checkbox"
              checked={powerUser.stickyRapidActionBar}
              onChange={(e) => updatePowerUserSettings({ stickyRapidActionBar: e.target.checked })}
              className="mt-0.5 rounded border-input text-amber-500 focus:ring-amber-500"
            />
            <div>
              <div className="font-semibold text-foreground">Sticky Rapid-Action Bar</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Renders a fixed bottom hotkey tray: [F2: New Row], [F4: Tax], [F8: Print], [F10:
                Post].
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded-lg border bg-card cursor-pointer hover:border-primary/50 transition">
            <input
              type="checkbox"
              checked={powerUser.numpadQuickOperators}
              onChange={(e) => updatePowerUserSettings({ numpadQuickOperators: e.target.checked })}
              className="mt-0.5 rounded border-input text-amber-500 focus:ring-amber-500"
            />
            <div>
              <div className="font-semibold text-foreground">Numpad Quick Operators (+ - * /)</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Directly compute calculations in weight and making charge columns using numpad
                arithmetic keys.
              </div>
            </div>
          </label>
        </div>
      </Card>

      {/* Shortcuts Registry Table */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search shortcuts by command or key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <Badge
            variant="outline"
            className="text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
          >
            {filteredShortcuts.length} Mapped Keybindings Active
          </Badge>
        </div>

        <div className="overflow-x-auto rounded-md border text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted text-muted-foreground font-semibold border-b">
                <th className="p-2.5">Action Command</th>
                <th className="p-2.5">Category</th>
                <th className="p-2.5">Active Keybinding</th>
                <th className="p-2.5">Default</th>
                <th className="p-2.5">Description</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredShortcuts.map((s) => {
                const activeKey = s.customKeys || s.defaultKeys;
                const isCustomized = !!s.customKeys;
                return (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="p-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Keyboard className="h-3.5 w-3.5 text-amber-500" />
                        <span>{s.name}</span>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <Badge variant="outline" className="text-[9px]">
                        {s.category}
                      </Badge>
                    </td>
                    <td className="p-2.5">
                      <kbd className="px-2 py-0.5 text-xs font-mono font-bold bg-muted border border-border/80 rounded shadow-xs text-foreground">
                        {activeKey}
                      </kbd>
                      {isCustomized && (
                        <Badge variant="secondary" className="ml-2 text-[9px]">
                          Custom
                        </Badge>
                      )}
                    </td>
                    <td className="p-2.5 font-mono text-[10px] text-muted-foreground">
                      {s.defaultKeys}
                    </td>
                    <td className="p-2.5 text-muted-foreground max-w-xs truncate">
                      {s.description}
                    </td>
                    <td className="p-2.5 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingShortcut(s);
                          setCapturedKeys("");
                        }}
                        className="h-6 text-[11px] px-2"
                      >
                        <Edit2 className="h-3 w-3 mr-1" /> Rebind
                      </Button>
                      {isCustomized && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resetShortcut(s.id)}
                          className="h-6 text-[11px] px-2 text-muted-foreground"
                        >
                          Reset
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Key Capture Modal ──────────────────────────────────────────────── */}
      <Dialog open={!!editingShortcut} onOpenChange={(open) => !open && setEditingShortcut(null)}>
        <DialogContent className="max-w-md" onKeyDown={handleKeyDown}>
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-amber-500" />
              Rebind Shortcut: {editingShortcut?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Press the desired key combination on your keyboard (e.g. <code>Ctrl + Shift + D</code>{" "}
              or <code>Alt + B</code>).
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 text-center space-y-3">
            <div className="p-6 rounded-lg border-2 border-dashed bg-muted/30 flex items-center justify-center min-h-[90px]">
              {capturedKeys ? (
                <kbd className="px-4 py-2 text-base font-mono font-bold bg-background border rounded-lg shadow-sm text-foreground">
                  {capturedKeys}
                </kbd>
              ) : (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Listening for keypress... Press your combination now.
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingShortcut(null)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!capturedKeys}
              onClick={handleSaveCapturedKey}
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Save Keybinding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
