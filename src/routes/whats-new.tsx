import { createFileRoute, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { usePublicReleaseNotes, usePublicWebsiteBundle } from "@/hooks/use-public-website";

export const Route = createFileRoute("/whats-new")({
  component: WhatsNewPage,
});

function WhatsNewPage() {
  const { data: bundle } = usePublicWebsiteBundle();
  const { data: notes = [], isLoading } = usePublicReleaseNotes();

  if (!bundle.feature_flags.whats_new) throw notFound();

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-3xl">What&apos;s new</h1>
        <p className="mt-2 text-muted-foreground">
          Product updates for Ornexa Jewellery Ecosystem.
        </p>

        {isLoading ? (
          <p className="mt-8 text-sm">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="mt-8 text-muted-foreground">No public release notes published yet.</p>
        ) : (
          <div className="mt-10 space-y-10">
            {notes.map((note) => (
              <section key={note.id} className="border-b border-border pb-8">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {note.release_date} · v{note.version} · {note.release_type}
                </p>
                <h2 className="mt-2 font-serif text-xl">{note.headline}</h2>
                {note.improvements?.length > 0 && (
                  <ul className="mt-4 list-disc pl-5 text-sm">
                    {note.improvements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </MarketingLayout>
  );
}
