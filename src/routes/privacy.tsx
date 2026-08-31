import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/ui/Logo";
import { CURRENT_POLICY_VERSION } from "@/lib/compliance/consent-store";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy Â· AVS ERP" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-4 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Logo className="h-7" />
          <div>
            <h1 className="font-serif text-xl text-gold">Privacy Policy</h1>
            <p className="text-[10px] text-muted-foreground">Version {CURRENT_POLICY_VERSION}</p>
          </div>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-4 py-8 md:px-8 prose prose-sm dark:prose-invert max-w-none space-y-4 text-sm leading-relaxed">
        <p>
          Ornexa / AVS Gold ERP (&quot;we&quot;, &quot;us&quot;) provides cloud jewellery
          manufacturing ERP software. This policy explains how we collect, use, and protect personal
          and business data.
        </p>
        <section>
          <h2 className="font-semibold text-base">1. Data we process</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Account credentials (email, hashed password) via Supabase Auth</li>
            <li>Business profile, firm settings, and operational ERP records you enter</li>
            <li>Device/browser metadata for security and fraud prevention</li>
            <li>Communication logs when you use WhatsApp/SMS/email features (with consent)</li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold text-base">2. Legal bases (GDPR)</h2>
          <p className="text-muted-foreground">
            Contract performance (providing the ERP), legitimate interests (security, product
            improvement), and consent (marketing, optional analytics, WhatsApp messaging).
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-base">3. Cookies &amp; local storage</h2>
          <p className="text-muted-foreground">
            Essential cookies and local storage are required for authentication and session
            security. Functional preferences (theme, language, shortcuts) are stored locally.
            Analytics cookies load only after you opt in via the cookie banner.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-base">4. Data retention &amp; deletion</h2>
          <p className="text-muted-foreground">
            Operational data is retained per your subscription and applicable tax law (e.g. GST
            records). You may request export or deletion subject to legal holds â€” contact your firm
            administrator or support.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-base">5. International transfers</h2>
          <p className="text-muted-foreground">
            Data may be processed on Supabase and approved sub-processors. Standard contractual
            safeguards apply where required.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-base">6. Your rights</h2>
          <p className="text-muted-foreground">
            Access, rectification, erasure, restriction, portability, and objection â€” contact{" "}
            <a href="mailto:privacy@ornexa.com" className="text-gold underline">
              privacy@ornexa.com
            </a>
            .
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-base">7. Children</h2>
          <p className="text-muted-foreground">
            The service is for businesses. Users must be 18+ or have guardian consent for workforce
            accounts.
          </p>
        </section>
        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
          <Link to="/terms" className="text-gold underline">
            Terms of Service
          </Link>{" "}
          Â·{" "}
          <Link to="/" className="text-gold underline">
            Back to app
          </Link>
        </p>
      </article>
    </div>
  );
}

