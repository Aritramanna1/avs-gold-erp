import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/lib/settings-store";
import { Logo } from "@/components/ui/Logo";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";
import { guardRoute } from "@/lib/permissions";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/setup")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: `First-Time Setup · ${APP_NAME}` }] }),
  component: SetupWizard,
});

/**
 * First-Time Setup — collects the essentials a brand-new install needs
 * before daily operation: business identity, GST, address, and the first
 * branch. Writes through the same setFirm()/addBranch() actions the
 * Settings → Firm/Branches tabs already use — nothing new is persisted
 * that Settings can't also edit later, so this is a guided front door to
 * existing settings, not a second source of truth.
 *
 * Financial Year, Backup Location, Default Printer, and Barcode Printer
 * are NOT collected here — no corresponding field exists yet in
 * settings-store, and inventing one just for this wizard would leave data
 * nothing else reads. Configure printers under Settings → Printer
 * Profiles / Hardware once that data model exists.
 */
function SetupWizard() {
  const navigate = useNavigate();
  const firm = useSettings((s) => s.firm);
  const setFirm = useSettings((s) => s.setFirm);
  const addBranch = useSettings((s) => s.addBranch);

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

  // Auto-advance to the dashboard once setup completes — a brief pause so
  // the confirmation is actually readable, with the button below as an
  // immediate-skip for anyone who doesn't want to wait.
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="text-center space-y-1">
          <Logo variant="svg" className="h-14 w-14 object-contain mx-auto" />
          <h1 className="font-serif text-xl text-gold">Welcome to {APP_NAME}</h1>
          <p className="text-xs text-muted-foreground">
            Let's set up your business before you start. You can change any of this later in
            Settings.
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
          Finish Setup
        </Button>
      </Card>
    </div>
  );
}
