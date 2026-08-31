import { useMemo, useState } from "react";
import { Package, Search, ImageOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { StockItem } from "@/lib/stock-store";
import { mgToGrams } from "@/lib/gold";
import { StockListThumbnail } from "@/components/stock/StockListThumbnail";
import {
  assertReadyStockSellable,
  stockItemHasProductPhoto,
  stockItemMissingDetails,
} from "@/lib/stock-photos";
import { toast } from "sonner";

export function ReadyStockPickerDialog({
  open,
  onOpenChange,
  stockItems,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockItems: StockItem[];
  onSelect: (item: StockItem) => void;
}) {
  const [query, setQuery] = useState("");

  const available = useMemo(
    () => stockItems.filter((s) => s.status === "available"),
    [stockItems],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available.slice(0, 100);
    return available
      .filter(
        (s) =>
          (s.itemName ?? "").toLowerCase().includes(q) ||
          (s.itemCode ?? "").toLowerCase().includes(q) ||
          (s.barcode ?? "").toLowerCase().includes(q) ||
          (s.huid ?? "").toLowerCase().includes(q),
      )
      .slice(0, 100);
  }, [available, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-gold" />
            Select from Ready Stock
          </DialogTitle>
          <DialogDescription>
            Only pieces with product photo(s) and full details (name, category, purity, weights) can
            be billed.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, code, barcode, HUID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto border rounded-md divide-y min-h-[240px]">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No available stock matches.</p>
          ) : (
            filtered.map((s) => {
              const missing = stockItemMissingDetails(s);
              const hasPhoto = stockItemHasProductPhoto(s);
              const sellable = hasPhoto && missing.length === 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!sellable}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                    sellable ? "hover:bg-muted/60" : "opacity-60 cursor-not-allowed bg-muted/20"
                  }`}
                  onClick={() => {
                    try {
                      assertReadyStockSellable(s);
                      onSelect(s);
                      onOpenChange(false);
                      setQuery("");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Cannot select");
                    }
                  }}
                >
                  <StockListThumbnail
                    imageStoragePath={s.imageStoragePath}
                    alt={s.itemName || s.itemCode || "Stock item"}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{s.itemName || s.itemCode || s.id}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.barcode || s.huid || s.itemCode} · {mgToGrams(s.grossMg ?? 0)}g
                      {s.purity ? ` · ${s.purity}‰` : ""}
                    </p>
                    {!sellable ? (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 flex items-center gap-1">
                        <ImageOff className="h-3 w-3" />
                        {!hasPhoto ? "Photo required" : `Missing: ${missing.join(", ")}`}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {sellable ? "Available" : "Incomplete"}
                  </Badge>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
