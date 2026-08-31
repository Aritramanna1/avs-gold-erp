/**
 * Multi-Dimensional Gold Stock Position & Complete Traceability Lineage
 * Master Reference: docs/MASTER/GOLD/
 * Master Reference: docs/MASTER/UNIVERSAL_TRANSACTION_ENGINE.md
 *
 * "Every gold position must know OWNER and CUSTODIAN / PHYSICAL LOCATION.
 * Support the full lineage answering 'WHERE DID THE GOLD GO?' for any source transaction."
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Coins,
  Scale,
  Building2,
  Hammer,
  Truck,
  Layers,
  ArrowRight,
  Search,
  CheckCircle2,
  ShieldAlert,
  Flame,
  Tag,
  User,
} from "lucide-react";
import { useGoldInventoryStore, ensureGoldInventoryLoaded } from "@/lib/gold-inventory-store";

export function GoldLineageTracker() {
  const { inventoryLots, ownershipPositions, lineageEvents, getTotalPhysicalGoldPosition } =
    useGoldInventoryStore();

  useEffect(() => {
    void ensureGoldInventoryLoaded();
  }, []);

  const [searchLotQuery, setSearchLotQuery] = useState("");
  const [selectedLotNumber, setSelectedLotNumber] = useState<string | null>(null);

  const stats = getTotalPhysicalGoldPosition();

  // Filtered lineage events
  const selectedLotEvents = selectedLotNumber
    ? lineageEvents.filter(
        (e) => e.sourceLotNumber === selectedLotNumber || e.targetLotNumber === selectedLotNumber,
      )
    : lineageEvents;

  return (
    <div className="space-y-6">
      {/* ── Multi-Dimensional Gold Position Summary ───────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <Card className="p-3.5 bg-card border">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-amber-500" />
            <span>Total Gross Gold</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-foreground font-mono mt-1">
            {stats.totalGrossG.toFixed(3)} g
          </div>
          <div className="text-[10px] text-muted-foreground">
            Physical custody across all vaults
          </div>
        </Card>

        <Card className="p-3.5 bg-card border">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Scale className="h-3.5 w-3.5 text-amber-500" />
            <span>Pure Fine Gold (999)</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-amber-600 font-mono mt-1">
            {stats.totalFineG.toFixed(3)} g
          </div>
          <div className="text-[10px] text-muted-foreground">100% fine metal equivalent</div>
        </Card>

        <Card className="p-3.5 bg-card border">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 text-blue-500" />
            <span>In Vault Custody</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-foreground font-mono mt-1">
            {stats.vaultGrossG.toFixed(3)} g
          </div>
          <div className="text-[10px] text-muted-foreground">Strongroom & storage safes</div>
        </Card>

        <Card className="p-3.5 bg-card border">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-3.5 w-3.5 text-purple-500" />
            <span>Customer-Owned Gold</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-purple-600 font-mono mt-1">
            {stats.customerOwnedGrossG.toFixed(3)} g
          </div>
          <div className="text-[10px] text-muted-foreground">Active metal advance liabilities</div>
        </Card>

        <Card className="p-3.5 bg-card border">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-emerald-500" />
            <span>Company-Owned Metal</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-emerald-600 font-mono mt-1">
            {stats.companyOwnedGrossG.toFixed(3)} g
          </div>
          <div className="text-[10px] text-muted-foreground">Unencumbered bullion stock</div>
        </Card>

        <Card className="p-3.5 bg-card border">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-cyan-500" />
            <span>Active Metal Lots</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-foreground font-mono mt-1">
            {inventoryLots.filter((l) => l.isActive).length} Lots
          </div>
          <div className="text-[10px] text-muted-foreground">Bars, granules & scrap</div>
        </Card>
      </div>

      {/* ── Active Customer Gold Liabilities & Physical Custody Status ────── */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <User className="h-4 w-4 text-purple-500" />
              Customer Gold Positions & Physical Custody Status
            </CardTitle>
            <CardDescription className="text-xs">
              Physical gold may be utilized in pooled production while customer ownership liability
              remains strictly active.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] text-purple-600 border-purple-500/30 bg-purple-500/10"
          >
            Ownership vs Custody Decoupled
          </Badge>
        </div>

        <div className="overflow-x-auto rounded-md border text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted text-muted-foreground font-semibold border-b">
                <th className="p-2.5">Party / Owner</th>
                <th className="p-2.5">Gross Weight</th>
                <th className="p-2.5">Touch Purity</th>
                <th className="p-2.5">Fine Gold (999)</th>
                <th className="p-2.5">Physical Location</th>
                <th className="p-2.5">Physical Status</th>
                <th className="p-2.5">Liability Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ownershipPositions.map((pos) => (
                <tr key={pos.id} className="hover:bg-muted/20">
                  <td className="p-2.5 font-medium text-foreground">
                    <div>{pos.partyName}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      ref: {pos.depositVoucherRef}
                    </div>
                  </td>
                  <td className="p-2.5 font-mono">{pos.grossWeightG.toFixed(3)} g</td>
                  <td className="p-2.5 font-mono">{pos.touchPurity.toFixed(2)}%</td>
                  <td className="p-2.5 font-mono font-bold text-amber-600">
                    {pos.fineGoldG.toFixed(3)} g
                  </td>
                  <td className="p-2.5 font-mono text-muted-foreground capitalize">
                    {pos.physicalVaultId}
                  </td>
                  <td className="p-2.5">
                    {pos.physicalIsUtilized ? (
                      <Badge
                        variant="outline"
                        className="text-[9px] text-blue-500 border-blue-500/30 bg-blue-500/10"
                      >
                        Pooled in Production
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[9px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                      >
                        In Vault Custody
                      </Badge>
                    )}
                  </td>
                  <td className="p-2.5">
                    <Badge
                      variant={pos.liabilityStatus === "active" ? "default" : "secondary"}
                      className="text-[9px] capitalize"
                    >
                      {pos.liabilityStatus.replace(/_/g, " ")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Lineage & Traceability ("Where Did The Gold Go?") ─────────────── */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-amber-500" />
              Gold Lineage & Lifecycle Traceability
            </CardTitle>
            <CardDescription className="text-xs">
              Complete audit trail answering &quot;Where did the gold go?&quot; from initial
              customer deposit to finished jewellery.
            </CardDescription>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter by Lot No or Voucher..."
              value={searchLotQuery}
              onChange={(e) => setSearchLotQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Timeline Stream */}
        <div className="space-y-3 pt-2">
          {lineageEvents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground italic text-xs">
              No conversion or movement events logged yet. Metal movements and conversion batches
              will appear here in real-time.
            </div>
          ) : (
            lineageEvents
              .filter(
                (e) =>
                  !searchLotQuery ||
                  e.voucherRef.toLowerCase().includes(searchLotQuery.toLowerCase()) ||
                  (e.sourceLotNumber &&
                    e.sourceLotNumber.toLowerCase().includes(searchLotQuery.toLowerCase())) ||
                  (e.targetLotNumber &&
                    e.targetLotNumber.toLowerCase().includes(searchLotQuery.toLowerCase())),
              )
              .map((ev) => (
                <div
                  key={ev.id}
                  className="p-3.5 rounded-lg border bg-muted/10 space-y-2 text-xs hover:bg-muted/20 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] text-amber-600 bg-amber-500/10 border-amber-500/30 capitalize"
                      >
                        {ev.eventType.replace(/_/g, " ")}
                      </Badge>
                      <span className="font-mono font-semibold text-foreground">
                        {ev.voucherRef}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(ev.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">
                        Movement Path:
                      </span>
                      <span className="text-foreground">
                        {ev.fromLocation} → {ev.toLocation}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Gross Weight:</span>
                      <span className="font-bold text-foreground">
                        {ev.grossWeightG.toFixed(3)} g
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">
                        Fine Gold (999):
                      </span>
                      <span className="font-bold text-amber-600">{ev.fineGoldG.toFixed(3)} g</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Operator:</span>
                      <span className="text-foreground">{ev.operatorName}</span>
                    </div>
                  </div>

                  {ev.notes && (
                    <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      {ev.notes}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </Card>
    </div>
  );
}
