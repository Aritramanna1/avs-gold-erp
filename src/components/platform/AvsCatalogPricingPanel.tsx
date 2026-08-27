/**
 * Platform Owner — edit AVS commercial catalog prices (price_minor) without code changes.
 * SoT: docs/AVS_ERP_PRODUCT_EDITION_PLANNING.docx — ₹10k / ₹30k / ₹50k (+ MTG).
 * ₹20k band rows may exist but are not assignable (hide≠delete).
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
  is_assignable?: boolean | null;
};

export function AvsCatalogPricingPanel() {
  const [rows, setRows] = useState<AvsPlanRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showHistorical, setShowHistorical] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("platform_plans")
      .select(
        "id,code,name,price_minor,business_edition,price_band_code,edition_family,is_assignable",
      )
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
      toast.success(`${row.code} price saved (₹${inr}/yr seed — Owner-editable)`);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  const visible = rows.filter((r) => showHistorical || r.is_assignable !== false);

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No AVS_* plans found. Apply catalog migration first.
      </p>
    );
  }

  return (
    <div className="erp-surface rounded-md border border-border bg-card overflow-hidden shadow-xs">
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-serif font-bold text-base text-gold">AVS Plan × Edition Catalog</h3>
          <p className="mt-0.5 text-xs text-muted-foreground font-mono">
            Docx SoT: ₹10k / ₹30k / ₹50k + MTG — edit ₹/year via DB price_minor only
          </p>
        </div>
        <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showHistorical}
            onChange={(e) => setShowHistorical(e.target.checked)}
          />
          Show non-assignable (e.g. 20K history)
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-mono border-b border-border">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Edition</th>
              <th className="p-3">Band</th>
              <th className="p-3">₹ / year</th>
              <th className="p-3 text-right">Save</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="p-3 font-mono font-semibold">
                  {row.code}
                  {row.is_assignable === false ? (
                    <span className="ml-2 text-[9px] uppercase text-amber-600">hidden</span>
                  ) : null}
                </td>
                <td className="p-3">
                  {[row.edition_family, row.business_edition].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="p-3 font-mono">{row.price_band_code ?? "—"}</td>
                <td className="p-3">
                  <Input
                    className="h-8 w-28 font-mono text-xs"
                    value={drafts[row.id] ?? "0"}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [row.id]: e.target.value.replace(/[^\d]/g, ""),
                      }))
                    }
                  />
                </td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    className="h-8 text-xs"
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
