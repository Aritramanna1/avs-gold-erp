import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/ui/Logo";
import { CURRENT_POLICY_VERSION } from "@/lib/compliance/consent-store";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service · Ornexa ERP" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-4 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Logo className="h-7" />
          <div>
            <h1 className="font-serif text-xl text-gold">Terms of Service</h1>
            <p className="text-[10px] text-muted-foreground">Version {CURRENT_POLICY_VERSION}</p>
          </div>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-4 py-8 md:px-8 space-y-4 text-sm leading-relaxed">
        <p>
          By creating an account or using Ornexa / AVS Gold ERP, you agree to these terms on behalf
          of your organisation.
        </p>
        <section>
          <h2 className="font-semibold text-base">1. Service</h2>
          <p className="text-muted-foreground">
            Cloud ERP for jewellery manufacturing — gold vault, workshop, billing, stock, and
            communications. Features depend on your subscription plan.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-base">2. Account responsibility</h2>
          <p className="text-muted-foreground">
            You are responsible for accurate business data, user access control, and compliance with
            GST, hallmark, and WhatsApp Meta policies when using integrated channels.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-base">3. Acceptable use</h2>
          <p className="text-muted-foreground">
            No unlawful activity, credential sharing outside your organisation, or attempts to
            bypass security or licensing controls.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-base">4. Mobile &amp; desktop apps</h2>
          <p className="text-muted-foreground">
            Future native apps distributed via Apple App Store and Google Play are subject to their
            store policies in addition to these terms. In-app purchases and subscriptions follow
            platform billing rules where applicable.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-base">5. Data &amp; availability</h2>
          <p className="text-muted-foreground">
            Production data is Supabase-authoritative. Limited offline UI caching may be offered in
            desktop clients; gold balances and transactions always require online approval through
            the vault engine.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-base">6. Limitation of liability</h2>
          <p className="text-muted-foreground">
            The service is provided as-is within the scope of your agreement. You remain responsible
            for statutory filings and physical gold custody.
          </p>
        </section>
        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
          <Link to="/privacy" className="text-gold underline">
            Privacy Policy
          </Link>{" "}
          ·{" "}
          <Link to="/" className="text-gold underline">
            Back to app
          </Link>
        </p>
      </article>
    </div>
  );
}
