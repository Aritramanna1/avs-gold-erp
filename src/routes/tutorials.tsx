import { createFileRoute, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { usePublicTutorials, usePublicWebsiteBundle } from "@/hooks/use-public-website";

export const Route = createFileRoute("/tutorials")({
  component: TutorialsPage,
});

function TutorialsPage() {
  const { data: bundle } = usePublicWebsiteBundle();
  const { data: tutorials = [], isLoading } = usePublicTutorials();

  if (!bundle.feature_flags.tutorials) throw notFound();

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-serif text-3xl">Tutorials & learning</h1>
        <p className="mt-2 text-muted-foreground">
          Step-by-step guides for Ornexa. Video tutorials appear here when published by Platform
          Owner — no placeholder videos.
        </p>

        {isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : tutorials.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Tutorials are being prepared. Check back soon or start your trial for in-app guided
            onboarding.
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tutorials.map((t) => (
              <article key={t.id} className="rounded-lg border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wider text-gold">{t.category}</p>
                <h2 className="mt-2 font-medium">{t.title}</h2>
                {t.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
                )}
                {t.video_url && t.video_provider && t.video_provider !== "none" ? (
                  <a
                    href={t.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-sm text-gold underline"
                  >
                    Watch tutorial
                  </a>
                ) : t.body_md ? (
                  <p className="mt-4 text-sm whitespace-pre-wrap">{t.body_md.slice(0, 240)}…</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </MarketingLayout>
  );
}
