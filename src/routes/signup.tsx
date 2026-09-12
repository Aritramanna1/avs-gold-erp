import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";
import { AuthNativeBrandHeader, AuthNativeShell } from "@/components/layout/AuthNativeShell";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Start 3-Day Free Trial · AVS Gold ERP" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [firmName, setFirmName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanFirm = firmName.trim();
    const cleanOwner = ownerName.trim();
    const cleanPhone = phone.trim();

    if (!cleanFirm || !cleanOwner || !cleanEmail || !password) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      // 1. Supabase Auth Signup
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanOwner,
            firm_name: cleanFirm,
            phone: cleanPhone,
            requested_role: "owner",
          },
        },
      });

      if (authError) {
        // If user already exists, prompt to log in
        if (authError.message?.toLowerCase().includes("already registered")) {
          toast.error("An account with this email already exists. Please log in.");
          void navigate({ to: "/login" });
          return;
        }
        throw authError;
      }

      const user = authData?.user;
      const trialDays = 3;
      const trialEndsAt = new Date(Date.now() + trialDays * 86400 * 1000).toISOString();
      const newFirmId = crypto.randomUUID();
      const mainBranchId = "MAIN";

      // 2. Provision Single Primary Branch and Firm locally in Settings Store
      const newBranch = {
        id: mainBranchId,
        name: `${cleanFirm} (Main Showroom)`,
        code: "MAIN",
        address: "",
        phone: cleanPhone,
        managerName: cleanOwner,
        active: true,
        isDefault: true,
      };

      useSettings.setState({
        firm: {
          ...useSettings.getState().firm,
          id: newFirmId,
          name: cleanFirm,
          phone: cleanPhone,
          email: cleanEmail,
          tenant_migration_status: "DEFERRED",
        },
        branches: [newBranch],
        selectedBranchId: mainBranchId,
        users: [
          {
            id: user?.id || crypto.randomUUID(),
            name: cleanOwner,
            email: cleanEmail,
            role: "owner",
            active: true,
            branchId: mainBranchId,
          },
        ],
        currentUserRole: "owner",
      });

      // Save initial snapshot to localStorage for instant offline/online access
      try {
        const snap = useSettings.getState();
        localStorage.setItem("ornexa:cached-firm-settings", JSON.stringify(snap));
        localStorage.setItem("avs_settings", JSON.stringify(snap));
        localStorage.setItem("ornexa_migration_banner_dismissed", "true");
        localStorage.setItem("ornexa_trial_ends_at", trialEndsAt);
      } catch {
        // Ignore quota
      }

      // 3. Attempt DB provisioning if permitted
      if (user?.id) {
        try {
          await (supabase.from("organizations" as never) as any).insert({
            id: newFirmId,
            name: cleanFirm,
            slug: cleanFirm.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            license_type: "trial",
            is_active: true,
            data: {
              owner_name: cleanOwner,
              phone: cleanPhone,
              trial_days: trialDays,
              trial_ends_at: trialEndsAt,
            },
          });

          await (supabase.from("branches" as never) as any).insert({
            id: mainBranchId,
            firm_id: newFirmId,
            name: `${cleanFirm} (Main Showroom)`,
            short_name: "MAIN",
            code: "MAIN",
            branch_type: "main",
            address: "",
            phone: cleanPhone,
            manager_name: cleanOwner,
            active: true,
            is_default: true,
          });

          await (supabase.from("user_profiles" as never) as any).upsert({
            auth_id: user.id,
            firm_id: newFirmId,
            branch_id: mainBranchId,
            full_name: cleanOwner,
            role: "owner",
            status: "active",
            active: true,
          });
        } catch (dbErr) {
          console.debug("[signup] Cloud auto-provisioning handled locally:", dbErr);
        }
      }

      toast.success("Welcome to AVS ERP! Your 3-day all-access trial is active.");
      void navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthNativeShell>
      <div className="mx-auto w-full max-w-lg space-y-6">
        <AuthNativeBrandHeader />

        <Card className="border border-border/80 bg-card p-6 md:p-8 shadow-md space-y-6">
          <div className="text-center space-y-2 border-b border-border/60 pb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> 3-Day Free All-Access Trial
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Start Your Jewellery ERP Trial
            </h2>
            <p className="text-xs text-muted-foreground">
              Full access to Dual-Running Accounting, Barcoding, Karigar Workshop & WhatsApp. No credit card required.
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="firm-name" className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-gold" /> Jewellery Firm / Showroom Name *
              </Label>
              <Input
                id="firm-name"
                type="text"
                required
                placeholder="e.g. Maa Tara Jewellers"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="owner-name" className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-gold" /> Owner / Proprietor Name *
                </Label>
                <Input
                  id="owner-name"
                  type="text"
                  required
                  placeholder="e.g. Aritra Manna"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-semibold flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-gold" /> Mobile Phone *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-gold" /> Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="owner@yourjewellers.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-gold" /> Password *
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 text-foreground font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> What happens next:
              </div>
              <p>1. Instant access with a single pre-configured Main Showroom branch.</p>
              <p>2. Full access for 3 days to test invoices, stock, and Karigar accounts.</p>
              <p>3. Flexible upgrade via Razorpay whenever you are ready to continue.</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gold hover:bg-gold-600 text-black font-bold text-sm gap-2 shadow-sm"
            >
              {loading ? (
                "Setting Up Your Firm..."
              ) : (
                <>
                  <Zap className="h-4 w-4" /> Start My 3-Day Free Trial <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="pt-2 border-t border-border/60 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-gold hover:underline">
              Sign In to Existing Account
            </Link>
          </div>
        </Card>
      </div>
    </AuthNativeShell>
  );
}
