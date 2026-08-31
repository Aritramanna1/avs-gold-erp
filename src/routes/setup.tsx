import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSettings } from "@/lib/settings-store";
import { Logo } from "@/components/ui/Logo";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";
import { guardRoute } from "@/lib/permissions";
import { toast } from "sonner";
import { CheckCircle2, Sparkles, Layers } from "lucide-react";
import { MigrationWizard } from "@/components/migration/MigrationWizard";

export const Route = createFileRoute("/setup")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: `Setup & Migration · ${APP_NAME}` }] }),
  component: SetupWizard,
});

export function SetupWizard() {
  const navigate = useNavigate();
  const firm = useSettings((s) => s.firm);
  const setFirm = useSettings((s) => s.setFirm);
  const addBranch = useSettings((s) => s.addBranch);

  const [mode, setMode] = useState<"quick" | "migration">("quick");
  const [shopName, setShopName] = useState(firm.shopName || "");
  const [ownerName, setOwnerName] = useState(firm.ownerName || "");
  const [gstin, setGstin] = useState(firm.gstin || "");
  const [address, setAddress] = useState(firm.address || "");
  const [branchName, setBranchName] = useState("Main Branch");
  const [done, setDone] = useState(false);

  function handleFinish() {
    setFirm({
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      gstin: gstin.trim(),
      address: address.trim(),
    });
    if (branchName.trim()) {
      addBranch({
        name: branchName.trim(),
        code: "MAIN",
        address: address.trim(),
        phone: "",
        managerName: ownerName.trim(),
        active: true,
      });
    }
    setDone(true);
    toast.success(`Your ${APP_NAME} is ready.`);
  }

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate({ to: "/", replace: true }), 1500);
    return () => clearTimeout(t);
  }, [done, navigate]);

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm p-8 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <h1 className="font-serif text-xl text-gold">Your {APP_NAME} is ready.</h1>
          <p className="text-sm text-muted-foreground">{APP_TAGLINE}</p>
          <Button className="w-full" onClick={() => navigate({ to: "/", replace: true })}>
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          <Logo variant="svg" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="font-bold text-lg text-foreground">{APP_NAME} Onboarding & Setup</h1>
            <p className="text-xs text-muted-foreground">{APP_TAGLINE}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={mode === "quick" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("quick")}
            className="text-xs gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" /> Quick Setup
          </Button>
          <Button
            variant={mode === "migration" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("migration")}
            className="text-xs gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" /> 13-Stage Migration Wizard
          </Button>
        </div>
      </div>

      {mode === "quick" ? (
        <div className="flex justify-center">
          <Card className="w-full max-w-md p-6 space-y-5 shadow-sm">
            <div className="text-center space-y-1">
              <h2 className="font-semibold text-base text-foreground">Quick Business Setup</h2>
              <p className="text-xs text-muted-foreground">
                Enter your fundamental shop details. You can configure complete migration batches
                anytime.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Business Name</Label>
                <Input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  data-testid="setup-shop-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Branch Name</Label>
                <Input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  data-testid="setup-branch-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">GST Number</Label>
                <Input
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  data-testid="setup-gstin"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Address</Label>
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  data-testid="setup-address"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Administrator Name</Label>
                <Input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  data-testid="setup-owner-name"
                />
              </div>
            </div>

            <Button className="w-full" onClick={handleFinish} data-testid="setup-finish">
              Finish Quick Setup
            </Button>
          </Card>
        </div>
      ) : (
        <MigrationWizard />
      )}
    </div>
  );
}
