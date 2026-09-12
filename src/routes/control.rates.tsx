/**
 * Canonical Route: /control/rates
 * Daily Bhav Rate Book & Multi-Karat Fineness Propagation Engine
 * Master Reference: docs/MASTER/RATE_BOOK_MASTER.md & ITEM_AND_MATERIAL_MASTER.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { guardRoute } from "@/lib/permissions";
import { PageHeader } from "@/components/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/lib/settings-store";
import { useBullionRate, useCurrentBullionRates } from "@/lib/bullion-rate-service";
import { useRoles } from "@/lib/rbac";
import {
  Coins,
  RefreshCw,
  Shield,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app-info";

export const Route = createFileRoute("/control/rates")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: `Daily Bhav Rate Book · ${APP_NAME}` }] }),
  component: DailyBhavRateBookPage,
});

function DailyBhavRateBookPage() {
  const {
    setGoldRate,
    setGoldRate24K,
    setGoldRate18K,
    setSilverRate,
    addSecurityLog,
  } = useSettings();

  // Prefer branch overrides when set; fall back to firm-wide hydrated rates.
  const {
    gold22KPerGramPaise: goldRatePerGramPaise,
    gold24KPerGramPaise: goldRate24KPerGramPaise,
    gold18KPerGramPaise: goldRate18KPerGramPaise,
    silverPerGramPaise: silverRatePerGramPaise,
  } = useCurrentBullionRates();

  const { roles, email, ready } = useRoles();
  const isAuthorized =
    ready &&
    (roles.includes("super_owner") || roles.includes("owner") || roles.includes("manager"));

  const { snapshot: liveSnapshot, fetchNow } = useBullionRate();

  const [gold24, setGold24] = useState(
    goldRate24KPerGramPaise > 0 ? (goldRate24KPerGramPaise / 100).toString() : "",
  );
  const [gold22, setGold22] = useState(
    goldRatePerGramPaise > 0 ? (goldRatePerGramPaise / 100).toString() : "",
  );
  const [gold18, setGold18] = useState(
    goldRate18KPerGramPaise > 0 ? (goldRate18KPerGramPaise / 100).toString() : "",
  );
  const [silver, setSilver] = useState(
    silverRatePerGramPaise > 0 ? (silverRatePerGramPaise / 100).toString() : "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (goldRate24KPerGramPaise > 0) setGold24((goldRate24KPerGramPaise / 100).toString());
    if (goldRatePerGramPaise > 0) setGold22((goldRatePerGramPaise / 100).toString());
    if (goldRate18KPerGramPaise > 0) setGold18((goldRate18KPerGramPaise / 100).toString());
    if (silverRatePerGramPaise > 0) setSilver((silverRatePerGramPaise / 100).toString());
  }, [
    goldRate24KPerGramPaise,
    goldRatePerGramPaise,
    goldRate18KPerGramPaise,
    silverRatePerGramPaise,
  ]);

  const handleApplyLiveFeed = async () => {
    try {
      const snap = await fetchNow();
      if (snap) {
        setGold24((snap.gold24KPerGramPaise / 100).toFixed(2));
        setGold22((snap.gold22KPerGramPaise / 100).toFixed(2));
        setGold18((snap.gold18KPerGramPaise / 100).toFixed(2));
        if (snap.silverPerGramPaise) {
          setSilver((snap.silverPerGramPaise / 100).toFixed(2));
        }
        toast.success("Live market rates loaded. Review and click Save to apply.");
      }
    } catch {
      toast.error("Failed to fetch live feed. Please enter desk rates manually.");
    }
  };

  const handleSaveRates = () => {
    if (!isAuthorized) {
      toast.error("Unauthorized: Only Owners and Managers can modify Daily Bhav rates.");
      return;
    }
    setSaving(true);
    try {
      const g24 = parseFloat(gold24) || 0;
      const g22 = parseFloat(gold22) || 0;
      const g18 = parseFloat(gold18) || 0;
      const s = parseFloat(silver) || 0;

      if (g24 <= 0 && g22 <= 0) {
        toast.error("Please enter a valid gold rate.");
        setSaving(false);
        return;
      }

      setGoldRate24K(Math.round(g24 * 100));
      setGoldRate(Math.round(g22 * 100));
      setGoldRate18K(Math.round(g18 * 100));
      setSilverRate(Math.round(s * 100));

      addSecurityLog(
        "gold edited",
        `Updated rates: 24K: ₹${g24}/g, 22K: ₹${g22}/g, 18K: ₹${g18}/g, Silver: ₹${s}/g`,
        email || "Authorized Staff",
      );

      toast.success("Daily Bhav Rate Book updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save rates.");
    } finally {
      setSaving(false);
    }
  };

  const calculateDerived14K = (g24Rate: number) => ((g24Rate * 585) / 1000).toFixed(2);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Daily Bhav Rate Book"
        subtitle="Manage authoritative precious metal spot rates across purities (24K, 22K 916, 18K 750, 14K, 925 Silver)."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Rate Input Card */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              Active Daily Rates (₹ / Gram)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyLiveFeed}
              className="text-xs gap-1.5 border-amber-500/30"
            >
              <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
              Fetch Live Feed
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">24K Pure Gold (999/1000)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-7 text-sm font-mono font-bold"
                    placeholder="7450.00"
                    value={gold24}
                    onChange={(e) => {
                      const v = e.target.value;
                      setGold24(v);
                      const num = parseFloat(v) || 0;
                      if (num > 0) {
                        setGold22(((num * 916) / 1000).toFixed(2));
                        setGold18(((num * 750) / 1000).toFixed(2));
                      }
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">22K Standard Gold (916/1000)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-7 text-sm font-mono font-bold"
                    placeholder="6824.00"
                    value={gold22}
                    onChange={(e) => setGold22(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">18K Hallmark Gold (750/1000)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-7 text-sm font-mono font-bold"
                    placeholder="5587.50"
                    value={gold18}
                    onChange={(e) => setGold18(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">925 Fine Silver</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-7 text-sm font-mono font-bold"
                    placeholder="88.00"
                    value={silver}
                    onChange={(e) => setSilver(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-500" />
                Audit Trail Logged on Save
              </div>
              <Button
                onClick={handleSaveRates}
                disabled={saving}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2 text-xs"
              >
                {saving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Save & Broadcast Rates
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Derived Fineness Matrix Card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Purity Fineness Matrix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="font-medium text-foreground">24K (999 Pure)</span>
              <span className="font-mono font-bold text-amber-600">₹{gold24 || "0.00"}/g</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="font-medium text-foreground">22K 916 Hallmark</span>
              <span className="font-mono font-bold text-foreground">₹{gold22 || "0.00"}/g</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="font-medium text-foreground">18K 750 Hallmark</span>
              <span className="font-mono font-bold text-foreground">₹{gold18 || "0.00"}/g</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="font-medium text-foreground">14K 585 (Derived)</span>
              <span className="font-mono font-bold text-muted-foreground">
                ₹{calculateDerived14K(parseFloat(gold24) || 0)}/g
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="font-medium text-foreground">925 Sterling Silver</span>
              <span className="font-mono font-bold text-blue-600">₹{silver || "0.00"}/g</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
