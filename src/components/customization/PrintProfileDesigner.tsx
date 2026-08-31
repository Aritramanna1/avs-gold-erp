/**
 * Physical Print Profile & Hardware Calibration Designer.
 *
 * Master Reference: docs/PRINT_PROFILE_MASTER.md
 */
import { useState, useEffect } from "react";
import { usePrintProfiles } from "@/lib/print-engine/profile-store";
import { PRINT_DOC_LABELS, type PrintDocType } from "@/lib/printlog-store";
import type { PrintProfile, PrintSize } from "@/lib/print-engine/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Printer,
  Sliders,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  CheckCircle2,
  SlidersHorizontal,
  FileCheck,
  Tag,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_SIZES: PrintSize[] = ["a4", "a5", "a5l", "a6", "thermal", "thermal58", "tag"];

export function PrintProfileDesigner() {
  const profiles = usePrintProfiles((s) => s.profiles);
  const refresh = usePrintProfiles((s) => s.refresh);
  const createProfile = usePrintProfiles((s) => s.create);
  const updateProfile = usePrintProfiles((s) => s.update);
  const removeProfile = usePrintProfiles((s) => s.remove);
  const resetToDefaults = usePrintProfiles((s) => s.resetToDefaults);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const [editingProfile, setEditingProfile] = useState<PrintProfile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleEdit = (prof: PrintProfile) => {
    setEditingProfile({ ...prof });
    setIsNew(false);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    const empty: Omit<PrintProfile, "id" | "createdAt" | "updatedAt"> = {
      name: "New Custom Printer Profile",
      isDefault: false,
      paperSize: "a4",
      orientation: "portrait",
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      scale: 100,
      copies: 1,
      printerClass: "laser",
      colorMode: "color",
      headerFooterRepeat: "all_pages",
      fitToPage: false,
      targetDocTypes: ["gst_invoice"],
    };
    setEditingProfile(empty as any);
    setIsNew(true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingProfile) return;
    if (isNew) {
      await createProfile({
        name: editingProfile.name,
        isDefault: editingProfile.isDefault,
        paperSize: editingProfile.paperSize,
        orientation: editingProfile.orientation,
        margins: editingProfile.margins,
        scale: editingProfile.scale,
        copies: editingProfile.copies,
        printerClass: editingProfile.printerClass,
        colorMode: editingProfile.colorMode,
        headerFooterRepeat: editingProfile.headerFooterRepeat,
        fitToPage: editingProfile.fitToPage,
        labelDimensions: editingProfile.labelDimensions,
        targetDocTypes: editingProfile.targetDocTypes,
      });
      toast.success("Created print profile.");
    } else {
      await updateProfile(editingProfile.id, {
        name: editingProfile.name,
        isDefault: editingProfile.isDefault,
        paperSize: editingProfile.paperSize,
        orientation: editingProfile.orientation,
        margins: editingProfile.margins,
        scale: editingProfile.scale,
        copies: editingProfile.copies,
        printerClass: editingProfile.printerClass,
        colorMode: editingProfile.colorMode,
        headerFooterRepeat: editingProfile.headerFooterRepeat,
        fitToPage: editingProfile.fitToPage,
        labelDimensions: editingProfile.labelDimensions,
        targetDocTypes: editingProfile.targetDocTypes,
      });
      toast.success("Updated print profile.");
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await removeProfile(id);
    toast.success("Deleted print profile.");
  };

  const handleResetFactory = async () => {
    await resetToDefaults();
    toast.success("Restored factory hardware print profiles.");
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-md border border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-base">
              Physical Print Profiles & Hardware Calibration
            </h2>
            <Badge
              variant="outline"
              className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-600 border-amber-500/30"
            >
              Millimeter Calibrated
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure exact laser margins, thermal receipt cut offsets, continuous dot-matrix
            pitches, and jewellery barcode tag dimensions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleCreate}
            className="h-9 gap-1.5 text-xs bg-amber-500 text-black hover:bg-amber-400 font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Add Profile
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetFactory}
            className="h-9 gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Factory Profiles
          </Button>
        </div>
      </div>

      {/* Profile Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((prof) => (
          <Card
            key={prof.id}
            className="border-border hover:border-amber-500/40 transition-colors flex flex-col justify-between"
          >
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm truncate">{prof.name}</span>
                    {prof.isDefault && (
                      <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-500 border-amber-500/40">
                        Default
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground uppercase">
                    {prof.paperSize} · {prof.orientation} · {prof.printerClass || "laser"}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-3 text-xs">
              {/* Margin & Scale Metrics */}
              <div className="grid grid-cols-2 gap-2 bg-muted/30 p-2 rounded-lg border border-border/60 font-mono text-[11px]">
                <div>
                  <span className="text-muted-foreground block text-[9px] uppercase">
                    Margins (T/R/B/L)
                  </span>
                  <span className="font-medium">
                    {prof.margins.top} / {prof.margins.right} / {prof.margins.bottom} /{" "}
                    {prof.margins.left} mm
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[9px] uppercase">
                    Scale / Copies
                  </span>
                  <span className="font-medium">
                    {prof.scale}% · {prof.copies} {prof.copies === 1 ? "copy" : "copies"}
                  </span>
                </div>
              </div>

              {/* Target Documents Badges */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-mono block mb-1">
                  Bound Documents ({prof.targetDocTypes?.length || 0})
                </span>
                <div className="flex flex-wrap gap-1">
                  {(prof.targetDocTypes || []).slice(0, 4).map((dt) => (
                    <Badge
                      key={dt}
                      variant="secondary"
                      className="text-[9px] px-1.5 py-0 font-normal"
                    >
                      {PRINT_DOC_LABELS[dt] || dt}
                    </Badge>
                  ))}
                  {(prof.targetDocTypes?.length || 0) > 4 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">
                      +{prof.targetDocTypes!.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(prof)}
                  className="h-7 text-xs gap-1"
                >
                  <Edit2 className="h-3 w-3" /> Edit Calibration
                </Button>
                {!prof.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(prof.id)}
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Profile Calibration Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-amber-500" />
              {isNew ? "Create Physical Print Profile" : "Hardware & Margins Calibration"}
            </DialogTitle>
            <DialogDescription>
              Adjust exact millimeter feed margins, scale percentages, and target document routing.
            </DialogDescription>
          </DialogHeader>

          {editingProfile && (
            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <Label>Profile Display Name</Label>
                <Input
                  value={editingProfile.name}
                  onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                  placeholder="e.g. Front Counter 80mm Thermal"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Paper Format</Label>
                  <Select
                    value={editingProfile.paperSize}
                    onValueChange={(v) =>
                      setEditingProfile({ ...editingProfile, paperSize: v as PrintSize })
                    }
                  >
                    <SelectTrigger className="h-9 font-mono uppercase">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_SIZES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Orientation</Label>
                  <Select
                    value={editingProfile.orientation}
                    onValueChange={(v) =>
                      setEditingProfile({
                        ...editingProfile,
                        orientation: v as "portrait" | "landscape",
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Hardware Class</Label>
                  <Select
                    value={editingProfile.printerClass || "laser"}
                    onValueChange={(v) =>
                      setEditingProfile({ ...editingProfile, printerClass: v as any })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laser">Laser / Inkjet</SelectItem>
                      <SelectItem value="thermal">POS Thermal</SelectItem>
                      <SelectItem value="label">Jewellery Tag</SelectItem>
                      <SelectItem value="dotmatrix">Dot Matrix Ledger</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Exact Millimeter Margins */}
              <div className="border border-border p-3 rounded-lg bg-muted/20 space-y-2">
                <span className="font-semibold text-muted-foreground uppercase text-[10px] font-mono block">
                  Hardware Feed Margins (Millimeters)
                </span>
                <div className="grid grid-cols-4 gap-2 font-mono">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Top (mm)</Label>
                    <Input
                      type="number"
                      value={editingProfile.margins.top}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          margins: { ...editingProfile.margins, top: Number(e.target.value) || 0 },
                        })
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Right (mm)</Label>
                    <Input
                      type="number"
                      value={editingProfile.margins.right}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          margins: {
                            ...editingProfile.margins,
                            right: Number(e.target.value) || 0,
                          },
                        })
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Bottom (mm)</Label>
                    <Input
                      type="number"
                      value={editingProfile.margins.bottom}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          margins: {
                            ...editingProfile.margins,
                            bottom: Number(e.target.value) || 0,
                          },
                        })
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Left (mm)</Label>
                    <Input
                      type="number"
                      value={editingProfile.margins.left}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          margins: { ...editingProfile.margins, left: Number(e.target.value) || 0 },
                        })
                      }
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Print Scale (%)</Label>
                  <Input
                    type="number"
                    min={50}
                    max={150}
                    value={editingProfile.scale}
                    onChange={(e) =>
                      setEditingProfile({ ...editingProfile, scale: Number(e.target.value) || 100 })
                    }
                    className="h-8 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Default Copies</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={editingProfile.copies}
                    onChange={(e) =>
                      setEditingProfile({ ...editingProfile, copies: Number(e.target.value) || 1 })
                    }
                    className="h-8 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-amber-500 text-black hover:bg-amber-400 font-semibold"
            >
              Save Calibration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
