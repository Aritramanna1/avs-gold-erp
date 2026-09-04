import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Logo } from "@/components/ui/Logo";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";
import { guardRoute } from "@/lib/permissions";
import { toast } from "sonner";
import {
  CheckCircle2,
  Building2,
  Network,
  Globe,
  Radio,
  Users,
  Hammer,
  Truck,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Server,
  Lock,
  ArrowRight,
} from "lucide-react";
import { useInstallationConfig, type DeploymentMode } from "@/lib/installation-config";
import { useSettings } from "@/lib/settings-store";

export const Route = createFileRoute("/setup")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: `First-Time Setup Wizard · ${APP_NAME}` }] }),
  component: FirstTimeSetupWizard,
});

export function FirstTimeSetupWizard() {
  const navigate = useNavigate();
  const config = useInstallationConfig();
  const setFirm = useSettings((s) => s.setFirm);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Step 1: Business Profile state
  const [shopName, setShopName] = useState(config.businessProfile.shopName || "MTJ / AVS Gold & Diamond Jewellers");
  const [legalName, setLegalName] = useState(config.businessProfile.legalName || "MTJ AVS JEWELLERS PVT LTD");
  const [tradeName, setTradeName] = useState(config.businessProfile.tradeName || "MTJ / AVS Gold & Diamond Jewellers");
  const [address, setAddress] = useState(config.businessProfile.address || "123 Swarna Bazzar, Jewellers Lane, Mumbai, MH 400002");
  const [phone, setPhone] = useState(config.businessProfile.phone || "+91 98765 43210");
  const [email, setEmail] = useState(config.businessProfile.email || "contact@mtjgold.example");
  const [gstin, setGstin] = useState(config.businessProfile.gstin || "27AAACM1234F1Z5");
  const [pan, setPan] = useState(config.businessProfile.pan || "AAACM1234F");

  // Step 2: Deployment Mode state
  const [deploymentMode, setDeploymentMode] = useState<DeploymentMode>(config.deploymentMode || "local");

  // Step 3: Portal Selection state
  const [customerPortal, setCustomerPortal] = useState(config.activePortals.customer ?? true);
  const [karigarPortal, setKarigarPortal] = useState(config.activePortals.karigar ?? true);
  const [supplierPortal, setSupplierPortal] = useState(config.activePortals.supplier ?? true);
  const [carrierPortal, setCarrierPortal] = useState(config.activePortals.carrier ?? false);

  // Step 4: Cloudflare Tunnel state (for Internet Mode)
  const [tunnelEnabled, setTunnelEnabled] = useState(config.cloudflareTunnel.enabled ?? false);
  const [tunnelName, setTunnelName] = useState(config.cloudflareTunnel.tunnelName || "mtj-shop-tunnel");
  const [tunnelHostname, setTunnelHostname] = useState(config.cloudflareTunnel.hostname || "erp.mtjgold.com");
  const [localService, setLocalService] = useState(config.cloudflareTunnel.localService || "http://localhost:8000");

  useEffect(() => {
    config.loadInstallationConfig();
  }, []);

  async function handleFinishSetup() {
    setSaving(true);
    try {
      // 1. Update installation store
      config.setBusinessProfile({
        shopName: shopName.trim(),
        legalName: legalName.trim(),
        tradeName: tradeName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim(),
        pan: pan.trim(),
      });

      config.setDeploymentMode(deploymentMode);

      config.setAllPortals({
        customer: customerPortal,
        karigar: karigarPortal,
        supplier: supplierPortal,
        carrier: carrierPortal,
      });

      config.setCloudflareTunnel({
        enabled: deploymentMode === "internet" && tunnelEnabled,
        tunnelName: tunnelName.trim(),
        hostname: tunnelHostname.trim(),
        localService: localService.trim(),
        httpsRequired: true,
        status: deploymentMode === "internet" && tunnelEnabled ? "active" : "inactive",
      });

      config.markSetupCompleted(true);

      // 2. Persist to settings store & database
      setFirm({
        shopName: shopName.trim(),
        legalName: legalName.trim(),
        gstin: gstin.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });

      await config.saveInstallationConfig();

      setDone(true);
      toast.success("First-time setup completed successfully!");
    } catch (err) {
      console.error("[setup] Error completing setup:", err);
      toast.error("Failed to save configuration. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(
      () =>
        navigate({
          to: "/login",
          search: { redirect: "", error: "", audience: undefined },
          replace: true,
        }),
      1500,
    );
    return () => clearTimeout(t);
  }, [done, navigate]);

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-slate-100">
        <Card className="w-full max-w-md p-8 text-center space-y-5 bg-slate-900 border-slate-800 shadow-2xl">
          <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto animate-bounce" />
          <div className="space-y-1">
            <h1 className="font-serif text-2xl font-bold text-amber-400">
              {shopName || "MTJ / AVS ERP"} is Ready
            </h1>
            <p className="text-sm text-slate-400">
              Single-tenant authoritative setup complete. Redirecting to login...
            </p>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-lg text-left text-xs space-y-1.5 border border-slate-800 text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">Operating Mode:</span>
              <span className="font-semibold text-amber-400 uppercase">{deploymentMode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Active Portals:</span>
              <span>
                {[
                  customerPortal && "Customer",
                  karigarPortal && "Karigar",
                  supplierPortal && "Supplier",
                  carrierPortal && "Carrier",
                ]
                  .filter(Boolean)
                  .join(", ") || "None"}
              </span>
            </div>
            {deploymentMode === "internet" && tunnelEnabled && (
              <div className="flex justify-between">
                <span className="text-slate-500">Cloudflare Domain:</span>
                <span className="font-mono text-emerald-400">{tunnelHostname}</span>
              </div>
            )}
          </div>
          <Button
            className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold"
            onClick={() =>
              navigate({
                to: "/login",
                search: { redirect: "", error: "", audience: undefined },
                replace: true,
              })
            }
          >
            Proceed to Login <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8">
      {/* Header */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Logo variant="svg" className="h-10 w-10 object-contain text-amber-400" />
          <div>
            <h1 className="font-bold text-lg text-slate-100 tracking-tight">
              {APP_NAME} Production Setup Wizard
            </h1>
            <p className="text-xs text-slate-400">{APP_TAGLINE}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="hidden sm:inline">Step {step} of 5</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`w-5 h-1.5 rounded-full transition-colors ${
                  s === step ? "bg-amber-400" : s < step ? "bg-emerald-500" : "bg-slate-800"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="max-w-4xl w-full mx-auto my-6 flex-1 flex flex-col justify-center">
        {/* Step 1: Business Profile */}
        {step === 1 && (
          <Card className="p-6 md:p-8 bg-slate-900 border-slate-800 shadow-xl space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <Building2 className="w-4 h-4" /> Step 1: Authoritative Business Profile
              </div>
              <h2 className="text-xl font-bold text-slate-100">Configure Your Jewellery Firm</h2>
              <p className="text-xs text-slate-400">
                These details form the single authoritative legal and trade identity across all invoices, ledgers, and Karigar slips.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Shop / Firm Display Name</Label>
                <Input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. MTJ / AVS Gold & Diamond Jewellers"
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Legal Registered Name</Label>
                <Input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. MTJ AVS JEWELLERS PRIVATE LIMITED"
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">GSTIN (15 Digits)</Label>
                <Input
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="27AAACM1234F1Z5"
                  className="bg-slate-950 border-slate-800 font-mono text-slate-100 uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">PAN Number (10 Digits)</Label>
                <Input
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  placeholder="AAACM1234F"
                  className="bg-slate-950 border-slate-800 font-mono text-slate-100 uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Contact Phone / Mobile</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Contact Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@mtjgold.example"
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs text-slate-300">Shop / Showroom Address</Label>
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  placeholder="Street, City, State, Pincode"
                  className="bg-slate-950 border-slate-800 text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <Button
                onClick={() => setStep(2)}
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold gap-2"
              >
                Next: Deployment Mode <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Deployment Mode */}
        {step === 2 && (
          <Card className="p-6 md:p-8 bg-slate-900 border-slate-800 shadow-xl space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <Network className="w-4 h-4" /> Step 2: Choose Deployment Mode
              </div>
              <h2 className="text-xl font-bold text-slate-100">How will you use the ERP?</h2>
              <p className="text-xs text-slate-400">
                Choose how your shop devices and staff will connect to the authoritative host server.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Local Only Card */}
              <div
                onClick={() => setDeploymentMode("local")}
                className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  deploymentMode === "local"
                    ? "bg-amber-500/10 border-amber-500 text-slate-100 shadow-lg shadow-amber-500/10"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Radio className="w-5 h-5" />
                  </div>
                  {deploymentMode === "local" && (
                    <span className="text-xs bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                      SELECTED
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-base text-slate-100 mb-1">LOCAL NETWORK ONLY</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Operate entirely on your Shop LAN / Wi-Fi. Fast, private, and independent of internet availability.
                </p>
                <ul className="text-xs space-y-1.5 text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> No domain or public IP required
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Phones & tablets connect via Shop Wi-Fi
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 100% private local operation
                  </li>
                </ul>
              </div>

              {/* Local + Internet Card */}
              <div
                onClick={() => setDeploymentMode("internet")}
                className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  deploymentMode === "internet"
                    ? "bg-amber-500/10 border-amber-500 text-slate-100 shadow-lg shadow-amber-500/10"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Globe className="w-5 h-5" />
                  </div>
                  {deploymentMode === "internet" && (
                    <span className="text-xs bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                      SELECTED
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-base text-slate-100 mb-1">LOCAL + INTERNET ACCESS</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Shop host PC remains the authoritative database, exposed securely over Cloudflare Tunnel on an approved domain.
                </p>
                <ul className="text-xs space-y-1.5 text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Secure Cloudflare Tunnel (HTTPS)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Remote Owner & Karigar mobile access
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Zero direct PostgreSQL exposure
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold gap-2"
              >
                Next: Portal Selection <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Portal Modules Selection */}
        {step === 3 && (
          <Card className="p-6 md:p-8 bg-slate-900 border-slate-800 shadow-xl space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <Users className="w-4 h-4" /> Step 3: Portal Installation & Capabilities
              </div>
              <h2 className="text-xl font-bold text-slate-100">Select Portals to Activate</h2>
              <p className="text-xs text-slate-400">
                Portals give external parties restricted, authenticated access directly to the authoritative ERP database.
              </p>
            </div>

            <div className="space-y-3">
              {/* Customer Portal */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-sm text-slate-100">Customer Portal</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Allows customers to view verified digital tax invoices, repair statuses, estimate slips, and ledger balances.
                  </p>
                </div>
                <Switch
                  checked={customerPortal}
                  onCheckedChange={setCustomerPortal}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>

              {/* Karigar Portal */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <Hammer className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-sm text-slate-100">Karigar (Artisan) Portal</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Enables karigars to log in via mobile, view assigned Dhadi job cards, record daily gold loss/filings, and review pending balances.
                  </p>
                </div>
                <Switch
                  checked={karigarPortal}
                  onCheckedChange={setKarigarPortal}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>

              {/* Supplier Portal */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-sm text-slate-100">Supplier / Bullion Dealer Portal</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Provides suppliers with access to purchase orders, gold delivery receipts, and settlement statements.
                  </p>
                </div>
                <Switch
                  checked={supplierPortal}
                  onCheckedChange={setSupplierPortal}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>

              {/* Carrier Portal */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold text-sm text-slate-100">Carrier / Logistics Portal</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Permits transport logistics partners to verify delivery challans, custody handovers, and package tracking.
                  </p>
                </div>
                <Switch
                  checked={carrierPortal}
                  onCheckedChange={setCarrierPortal}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={() => {
                  if (deploymentMode === "internet") {
                    setStep(4);
                  } else {
                    setStep(5);
                  }
                }}
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold gap-2"
              >
                {deploymentMode === "internet" ? "Next: Cloudflare Tunnel" : "Next: Review & Finish"} <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 4: Cloudflare Tunnel Configuration (Internet Mode only) */}
        {step === 4 && deploymentMode === "internet" && (
          <Card className="p-6 md:p-8 bg-slate-900 border-slate-800 shadow-xl space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-400 text-sm font-semibold">
                <Globe className="w-4 h-4" /> Step 4: Cloudflare Tunnel Configuration
              </div>
              <h2 className="text-xl font-bold text-slate-100">Secure Internet Exposure</h2>
              <p className="text-xs text-slate-400">
                Cloudflare Tunnel exposes the local Supabase API Gateway and web application securely over HTTPS without port forwarding.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Security Guard:</strong> PostgreSQL direct port (5432) is NEVER exposed. Only the Supabase API Gateway (Envoy port 8000) is routed through the tunnel.
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Enable Cloudflare Tunnel</div>
                  <div className="text-xs text-slate-400">Route public domain traffic to this host server</div>
                </div>
                <Switch
                  checked={tunnelEnabled}
                  onCheckedChange={setTunnelEnabled}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>

              {tunnelEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Tunnel Identifier / Name</Label>
                    <Input
                      value={tunnelName}
                      onChange={(e) => setTunnelName(e.target.value)}
                      placeholder="e.g. mtj-shop-tunnel"
                      className="bg-slate-950 border-slate-800 text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Approved Public Domain / Subdomain</Label>
                    <Input
                      value={tunnelHostname}
                      onChange={(e) => setTunnelHostname(e.target.value)}
                      placeholder="e.g. erp.mtjgold.com"
                      className="bg-slate-950 border-slate-800 font-mono text-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-slate-300">Local Service Mapping (Gateway Port)</Label>
                    <Input
                      value={localService}
                      onChange={(e) => setLocalService(e.target.value)}
                      placeholder="http://localhost:8000"
                      className="bg-slate-950 border-slate-800 font-mono text-slate-100"
                    />
                    <p className="text-[11px] text-slate-500">
                      Standard Supabase API Gateway endpoint on host machine.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => setStep(3)}
                className="border-slate-800 text-slate-300 hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={() => setStep(5)}
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold gap-2"
              >
                Next: Review & Finish <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 5: Review & Finish */}
        {step === 5 && (
          <Card className="p-6 md:p-8 bg-slate-900 border-slate-800 shadow-xl space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Step 5: Review & Complete Installation
              </div>
              <h2 className="text-xl font-bold text-slate-100">Confirm ERP Setup</h2>
              <p className="text-xs text-slate-400">
                Verify your installation parameters before completing setup.
              </p>
            </div>

            <div className="space-y-4">
              {/* Profile summary */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Authoritative Firm Profile
                  </span>
                  <Button variant="link" size="sm" onClick={() => setStep(1)} className="text-xs text-amber-400 p-0 h-auto">
                    Edit
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Firm Name:</span>
                    <p className="font-semibold text-slate-200">{shopName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">GSTIN / PAN:</span>
                    <p className="font-mono text-slate-200">{gstin} / {pan}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">Address:</span>
                    <p className="text-slate-200">{address}</p>
                  </div>
                </div>
              </div>

              {/* Mode & Portals summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5" /> Operating Mode
                    </span>
                    <Button variant="link" size="sm" onClick={() => setStep(2)} className="text-xs text-amber-400 p-0 h-auto">
                      Edit
                    </Button>
                  </div>
                  <p className="text-sm font-bold text-slate-100 uppercase">
                    {deploymentMode === "local" ? "Local Network Only" : "Local + Internet Access"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {deploymentMode === "local"
                      ? "Shop LAN / Wi-Fi authoritative host."
                      : `Tunnel ${tunnelEnabled ? "Enabled" : "Disabled"}: ${tunnelHostname}`}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Active Portals
                    </span>
                    <Button variant="link" size="sm" onClick={() => setStep(3)} className="text-xs text-amber-400 p-0 h-auto">
                      Edit
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {customerPortal && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Customer
                      </span>
                    )}
                    {karigarPortal && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Karigar
                      </span>
                    )}
                    {supplierPortal && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Supplier
                      </span>
                    )}
                    {carrierPortal && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Carrier
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => (deploymentMode === "internet" ? setStep(4) : setStep(3))}
                className="border-slate-800 text-slate-300 hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={handleFinishSetup}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 px-6"
              >
                {saving ? "Saving Configuration..." : "Complete Setup & Proceed to Login"}
                <CheckCircle2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-4xl w-full mx-auto text-center text-xs text-slate-500 pt-4 border-t border-slate-800/60">
        Single-Tenant Authoritative Jewellery Manufacturing ERP · Version 1.1.2
      </div>
    </div>
  );
}

export const SetupWizard = FirstTimeSetupWizard;

