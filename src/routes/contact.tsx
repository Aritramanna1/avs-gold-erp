import { createFileRoute, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { ContactLeadForm } from "@/components/marketing/ContactLeadForm";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";

export const Route = createFileRoute("/contact")({
  validateSearch: (s: Record<string, unknown>) => ({
    intent: (s.intent as string) ?? "contact",
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: bundle } = usePublicWebsiteBundle();
  const { intent } = Route.useSearch();

  if (!bundle.feature_flags.contact) throw notFound();

  const title =
    intent === "demo" ? "Book a Demo" : intent === "sales" ? "Talk to Sales" : "Contact Us";

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="font-serif text-3xl text-foreground">{title}</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us about your jewellery factory or wholesale workshop. Write to{" "}
          <a href="mailto:sales@arivahly.in" className="text-gold underline">
            sales@arivahly.in
          </a>{" "}
          or use the form — Arivahly Venture Sphere responds during business hours. Company site:{" "}
          <a href="https://arivahly.in/" className="text-gold underline" target="_blank" rel="noreferrer">
            arivahly.in
          </a>
          .
        </p>
        <div className="mt-8 rounded-lg border border-border bg-card p-6">
          <ContactLeadForm intent={intent} />
        </div>
      </div>
    </MarketingLayout>
  );
}
