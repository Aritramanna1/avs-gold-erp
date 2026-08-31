import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { ContactLeadForm } from "@/components/marketing/ContactLeadForm";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [{ title: "Support — AVS ERP", description: "AVS ERP jewellery ERP support and contact." }],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-3xl px-4 py-14 space-y-8">
        <header className="space-y-3">
          <h1 className="font-serif text-4xl">Support</h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Firm operators use in-app Support under Settings when signed in. For sales, demos, and
            onboarding questions before you have a firm, use the form below or email{" "}
            <a className="underline underline-offset-2" href="mailto:sales@arivahly.in">
              sales@arivahly.in
            </a>
            .
          </p>
        </header>
        <ContactLeadForm intent="contact" />
        <p className="text-sm text-muted-foreground">
          <Link className="underline underline-offset-2" to="/faq">
            FAQ
          </Link>
          {" · "}
          <Link className="underline underline-offset-2" to="/contact" search={{ intent: "demo" }}>
            Book a demo
          </Link>
        </p>
      </div>
    </MarketingLayout>
  );
}
