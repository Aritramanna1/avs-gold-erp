import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/ui/Logo";
import { getLegalDocument } from "@/lib/compliance/legal-policies";
import { pageTitle } from "@/lib/app-info";

const doc = getLegalDocument("privacy");

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: pageTitle(doc.title) }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
      <article className="max-w-3xl mx-auto px-4 py-8 md:px-8 prose prose-sm dark:prose-invert max-w-none space-y-4 text-sm leading-relaxed">
        <div className="whitespace-pre-wrap text-muted-foreground">{doc.body}</div>
        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
          <Link to="/terms" className="text-gold underline">
            Terms of Service
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
