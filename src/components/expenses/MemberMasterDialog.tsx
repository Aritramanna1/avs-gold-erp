import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useExpensesStore, RELATIONSHIP_LABELS, type ExpensePerson, type FamilyRelationship } from "@/lib/expenses-store";

export function MemberMasterDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ExpensePerson | null;
}) {
  const addPerson = useExpensesStore((s) => s.addPerson);
  const updatePerson = useExpensesStore((s) => s.updatePerson);

  const [fullName, setFullName] = useState(() => initial?.fullName ?? "");
  const [relationship, setRelationship] = useState<FamilyRelationship>(
    initial?.relationship ?? "home",
  );
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [compensationMode, setCompensationMode] = useState<"drawing" | "salary">(
    initial?.compensationMode ?? "drawing",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    if (!fullName.trim()) {
      setError("Please enter the member's full name.");
      return;
    }

    setSaving(true);
    try {
      if (initial) {
        await updatePerson(initial.id, {
          fullName: fullName.trim(),
          relationship,
          phone: phone.trim(),
          role: role.trim(),
          compensationMode,
          notes: notes.trim(),
          active,
        });
        toast.success("Member record updated.");
      } else {
        await addPerson({
          fullName: fullName.trim(),
          relationship,
          phone: phone.trim(),
          role: role.trim(),
          compensationMode,
          notes: notes.trim(),
          active,
        });
        toast.success("New member added to Family/Owner Master.");
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gold font-serif text-lg">
            {initial ? "Edit Family / Beneficiary Member" : "Add Family / Beneficiary Member"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Manage owner family members and beneficiaries for personal drawings and compensation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {error && <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{error}</p>}

          <div className="space-y-1">
            <Label className="text-xs">Full Name / Account Title</Label>
            <Input
              placeholder="e.g. Aritra Manna, Home Common Pool"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Relationship</Label>
              <Select value={relationship} onValueChange={(v) => setRelationship(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RELATIONSHIP_LABELS) as FamilyRelationship[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {RELATIONSHIP_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Compensation Treatment</Label>
              <Select value={compensationMode} onValueChange={(v) => setCompensationMode(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drawing">Owner Drawing (Equity)</SelectItem>
                  <SelectItem value="salary">Owner Salary (P&amp;L Expense)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Phone (Optional)</Label>
              <Input
                placeholder="+91 98000 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role / Designation</Label>
              <Input
                placeholder="e.g. Founder, Partner"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes / Details</Label>
            <Input
              placeholder="e.g. Domestic bank account, equity ratio"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-2">
            <Label className="text-xs">Active Status</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gold text-black hover:bg-gold/90">
              {saving ? "Saving…" : "Save Member"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
