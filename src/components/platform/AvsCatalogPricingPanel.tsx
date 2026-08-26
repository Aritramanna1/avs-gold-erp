/**
 * Platform Owner — edit AVS commercial catalog prices (price_minor) without code changes.
 */
import { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type AvsPlanRow = {
  id: string;
  code: string;
  name: string;
  price_minor: number | null;
  business_edition: string | null;
  price_band_code: string | null;
  edition_family: string | null;
};

export function AvsCatalogPricingPanel() {
  const [rows, setRows] = useState<AvsPlanRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("platform_plans")
      .select("id,code,name,price_minor,business_edition,price_band_code,edition_family")
      .like("code", "AVS_%")
      .order("code");
    if (error) {
      toast.error(error.message);
      return;
    }
    const list = (data ?? []) as unknown as AvsPlanRow[];
    setRows(list);
    const next: Record<string, string> = {};
    for (const r of list) {
      next[r.id] = String(Math.round((r.price_minor ?? 0) / 100));
    }
    setDrafts(next);
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveRow(row: AvsPlanRow) {
    setSaving(row.id);
    try {
      const inr = Number(drafts[row.id] || 0);
      const price_minor = Math.round(inr * 100);
      const { error } = await supabase
        .from("platform_plans")
        .update({ price_minor, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw error;
      toast.success(`${row.code} price saved (₹${inr}/mo)`);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No AVS_* plans found. Apply catalog migration first.
      </p>
    );
  }

  return (
    <div className="erp-surface rounded-md border border-border bg-card overflow-hidden shadow-xs">
      <div className="p-4 border-b border-border">
        <h3 className="font-serif font-bold text-base text-gold">AVS Plan × Edition Catalog</h3>
        <p className="mt-0.5 text-xs text-muted-foreground font-mono">
          Edit monthly ₹ amounts only — never hardcode in the frontend
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Edition</th>
              <th className="p-3">Band</th>
              <th className="p-3">₹ / month</th>
              <th className="p-3 text-right">Save</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="p-3 font-mono font-semibold">{row.code}</td>
                <td className="p-3">
                  {[row.edition_family, row.business_edition].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="p-3 font-mono text-muted-foreground">
                  {row.price_band_code ?? "—"}
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    className="h-8 w-28 font-mono"
                    value={drafts[row.id] ?? "0"}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />
                </td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={saving === row.id}
                    onClick={() => void saveRow(row)}
                  >
                    {saving === row.id ? "…" : "Save"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
