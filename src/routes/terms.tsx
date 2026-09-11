import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/ui/Logo";
import { getLegalDocument } from "@/lib/compliance/legal-policies";
import { pageTitle } from "@/lib/app-info";

const doc = getLegalDocument("terms");

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: pageTitle(doc.title) }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-4 md:px-8">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Logo className="h-7" />
          <div>
            <h1 className="font-serif text-xl text-gold">{doc.title}</h1>
            <p className="text-[10px] text-muted-foreground">
              Version {doc.version} · Effective {doc.effectiveDate}
            </p>
          </div>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-4 py-8 md:px-8 space-y-4 text-sm leading-relaxed whitespace-pre-wrap">
        {doc.body}
        <p className="text-xs text-muted-foreground pt-4 border-t border-border whitespace-normal">
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