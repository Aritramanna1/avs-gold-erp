import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { toast } from "sonner";

export const Route = createFileRoute("/workshop/dhadi-groups")({
  head: () => ({ meta: [{ title: "Dhadi Groups · AVS ERP" }] }),
  component: DhadiGroupsPage,
});

type DhadiGroup = {
  id: string;
  firm_id: string;
  name: string;
  code: string | null;
  karigar_party_ids: string[];
  active: boolean;
  notes: string | null;
};

/** Parity table may lag generated Database types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function resolveFirmId(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("my_firm_id");
  if (error || !data) return null;
  return String(data);
}

function DhadiGroupsPage() {
  const [firmKey, setFirmKey] = useState<string | null>(null);
  const [rows, setRows] = useState<DhadiGroup[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const fid = await resolveFirmId();
    setFirmKey(fid);
    if (!fid) return;
    const { data, error } = await db
      .from("dhadi_groups")
      .select("*")
      .eq("firm_id", fid)
      .order("name");
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as DhadiGroup[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const fid = firmKey ?? (await resolveFirmId());
    if (!fid) {
      toast.error("Firm not loaded.");
      return;
    }
    if (!name.trim()) {
      toast.error("Group name is required.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await db.from("dhadi_groups").insert({
        firm_id: fid,
        name: name.trim(),
        code: code.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
      toast.success("Dhadi group created.");
      setName("");
      setCode("");
      setNotes("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: DhadiGroup) {
    const fid = firmKey ?? (await resolveFirmId());
    if (!fid) return;
    const { error } = await db
      .from("dhadi_groups")
      .update({ active: !row.active, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("firm_id", fid);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(row.active ? "Group deactivated." : "Group activated.");
    await load();
  }

  async function remove(row: DhadiGroup) {
    const fid = firmKey ?? (await resolveFirmId());
    if (!fid) return;
    if (!window.confirm(`Delete dhadi group “${row.name}”?`)) return;
    const { error } = await db.from("dhadi_groups").delete().eq("id", row.id).eq("firm_id", fid);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Group deleted.");
    await load();
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Dhadi Groups"
        subtitle="Karigar / worker group master for manufacturing assignment (Offline parity)."
        actions={<SourceOfTruthBadge variant="operational" />}
      />

      <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2 border rounded-lg p-4">
        <div className="space-y-1">
          <Label htmlFor="dhadi-name">Group name</Label>
          <Input id="dhadi-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dhadi-code">Code</Label>
          <Input id="dhadi-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="dhadi-notes">Notes</Label>
          <Input id="dhadi-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button type="submit" disabled={saving} className="sm:col-span-2 w-fit">
          {saving ? "Saving…" : "Add group"}
        </Button>
      </form>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Code</th>
              <th className="p-2">Status</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.name}</td>
                <td className="p-2 font-mono text-xs">{r.code ?? "—"}</td>
                <td className="p-2">{r.active ? "Active" : "Inactive"}</td>
                <td className="p-2 text-right space-x-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void toggleActive(r)}>
                    {r.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void remove(r)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-muted-foreground text-center">
                  No dhadi groups yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
