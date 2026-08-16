/**
 * Public 14-Day Free Trial — Sign Up → Provision → Onboarding
 * AVS Communication Platform product-aware (ORNEXA default).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/Logo";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { LegalConsentFields } from "@/components/compliance/LegalConsentFields";
import { useConsentStore } from "@/lib/compliance/consent-store";

const SearchSchema = z.object({
  product: z.string().optional(),
});

export const Route = createFileRoute("/trial/start")({
  validateSearch: (s) => SearchSchema.parse(s),
  head: () => ({ meta: [{ title: "Start 14-Day Free Trial · Ornexa" }] }),
  component: TrialStartPage,
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function TrialStartPage() {
  const navigate = useNavigate();
  const { product } = Route.useSearch();
  const productId = product ?? "ORNEXA";

  const [step, setStep] = useState<"auth" | "company">("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const recordSignupConsent = useConsentStore((s) => s.recordSignupConsent);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!termsAccepted || !privacyAccepted) {
      toast.error("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/trial/start` },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    recordSignupConsent({ termsAccepted, privacyAccepted, marketingOptIn });
    if (data.session) {
      setStep("company");
      toast.success("Account created — tell us about your company");
    } else {
      toast.info("Check your email to verify, then return here to complete setup.");
    }
  }

  async function handleGoogle() {
    if (!termsAccepted || !privacyAccepted) {
      toast.error("Please accept the Terms of Service and Privacy Policy first.");
      return;
    }
    recordSignupConsent({ termsAccepted, privacyAccepted, marketingOptIn });
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/trial/start?product=${productId}` },
    });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  async function handleProvision(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setBusy(false);
      toast.error("Please sign in first");
      setStep("auth");
      return;
    }

    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const res = await fetch(`${url}/functions/v1/public-trial-provision`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firmName: companyName.trim(),
        firmSlug: slugify(companyName),
        ownerName: ownerName.trim(),
        ownerPhone: phone.trim(),
        productId,
      }),
    });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!res.ok || !body.ok) {
      toast.error(body.error ?? "Trial provisioning failed");
      return;
    }
    toast.success("Your 14-day Ornexa trial is ready!");
    void navigate({ to: "/onboarding" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="text-center space-y-2">
          <Logo className="h-8 mx-auto" />
          <h1 className="text-xl font-serif font-bold text-gold">Start Your Free Trial</h1>
          <p className="text-xs text-muted-foreground">
            14 days of full {productId === "ORNEXA" ? "Ornexa" : productId} — no credit card
            required.
          </p>
        </div>

        {step === "auth" && (
          <form onSubmit={(e) => void handleSignUp(e)} className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Work Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Password</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <LegalConsentFields
              termsAccepted={termsAccepted}
              privacyAccepted={privacyAccepted}
              marketingOptIn={marketingOptIn}
              onTermsChange={setTermsAccepted}
              onPrivacyChange={setPrivacyAccepted}
              onMarketingChange={setMarketingOptIn}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !termsAccepted || !privacyAccepted}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleGoogle()}
              disabled={busy}
            >
              Continue with Google
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              Already have an account?{" "}
              <Link to="/" className="text-gold hover:underline">
                Sign in
              </Link>
            </p>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs"
              onClick={() => setStep("company")}
            >
              I already signed in → Company setup
            </Button>
          </form>
        )}

        {step === "company" && (
          <form onSubmit={(e) => void handleProvision(e)} className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Company / Workshop Name</Label>
              <Input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Your Name</Label>
              <Input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Phone (WhatsApp)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
            </div>
            <Button type="submit" className="w-full gap-1" disabled={busy}>
              <Sparkles className="h-4 w-4" />
              {busy ? "Setting up…" : "Start 14-Day Trial"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
