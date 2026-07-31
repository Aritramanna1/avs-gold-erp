import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Package, ScanLine, ArrowRightLeft, Plus } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { useStock, STOCK_STATUS_LABELS } from "@/lib/stock-store";
export const Route = createFileRoute("/stock/")({ component: StockWorkspace });
function StockWorkspace() {
  const items = useStock((s) => s.items);
  const movements = useStock((s) => s.movements);
  const refresh = useStock((s) => s.refresh);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const available = items.filter((i) => i.status === "available");
  return (
    <ModuleWorkspace
      eyebrow="Inventory desk"
      title="Ready stock"
      description="Work with real finished jewellery inventory, status, location, barcode, and movement history."
      icon={Package}
      onRefresh={() => void refresh()}
      metrics={[
        { label: "Items", value: items.length },
        { label: "Available", value: available.length },
        {
          label: "Gold",
          value: `${(available.reduce((n, i) => n + i.fineMg, 0) / 1000).toFixed(3)} g`,
        },
        { label: "Movements", value: movements.length },
      ]}
      actions={[
        { label: "Add ready stock", to: "/stock/entry", icon: Plus },
        { label: "Scan barcode", to: "/workshop/barcode-scanner", icon: ScanLine },
        { label: "Stock verification", to: "/stock/verification", icon: ArrowRightLeft },
      ]}
    >
      <section className="erp-surface rounded-md p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Latest stock</h2>
          <Link className="text-sm text-primary hover:underline" to="/stock/import">
            Import
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="erp-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Item</th>
                <th className="text-left">Barcode</th>
                <th className="text-left">Location</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={4}>
                    No stock items found.
                  </td>
                </tr>
              ) : (
                items.slice(0, 12).map((item) => (
                  <tr key={item.id}>
                    <td>{item.itemName}</td>
                    <td className="font-mono text-xs">{item.barcode || "—"}</td>
                    <td>{item.location}</td>
                    <td className="text-right">{STOCK_STATUS_LABELS[item.status]}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ModuleWorkspace>
  );
}
