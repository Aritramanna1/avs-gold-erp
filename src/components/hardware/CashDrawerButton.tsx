import { useEffect, useState } from "react";
import { thermalPrinterService } from "@/lib/thermal-printer";
import { Button } from "@/components/ui/button";
import { Archive } from "lucide-react";
import { toast } from "sonner";

/**
 * Cash drawer control (Priority 7). No dedicated "cash drawer API" exists
 * in real hardware — drawers are triggered by an ESC/POS kick pulse sent
 * through the connected receipt printer's own cable (see
 * thermalPrinterService.openCashDrawer()). Manual fallback per the
 * requirement ("Cash Drawer -> Disable drawer action gracefully"): with no
 * printer connected, this button is disabled with an explanatory label
 * rather than firing a command into nothing or throwing.
 */
export function CashDrawerButton() {
  const [connected, setConnected] = useState(thermalPrinterService.isConnected);

  useEffect(() => thermalPrinterService.onStatusChange((s) => setConnected(s === "connected")), []);

  async function handleOpen() {
    const ok = await thermalPrinterService.openCashDrawer();
    if (ok) toast.success("Cash drawer opened");
    else toast.error("Cash drawer unavailable — no printer connected");
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!connected}
      onClick={handleOpen}
      title={connected ? "Open cash drawer" : "No printer connected — cash drawer unavailable"}
    >
      <Archive className="mr-1.5 h-4 w-4" />
      {connected ? "Open Drawer" : "Drawer Unavailable"}
    </Button>
  );
}
