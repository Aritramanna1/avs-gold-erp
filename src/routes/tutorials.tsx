import { createFileRoute, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { VideoEmbed } from "@/components/marketing/VideoEmbed";
import { usePublicTutorials, usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { youtubeThumbnailUrl, parseYouTubeId } from "@/lib/website/video-embed";

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
          Step-by-step video guides for AVS ERP — Gold Vault, karigar workflows, billing, and more.
        </p>

        {isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : tutorials.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Tutorials are being prepared. Check back soon or start your trial for in-app guided
            onboarding.
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {tutorials.map((t) => {
              const hasVideo = t.video_url && t.video_provider && t.video_provider !== "none";
              const ytId =
                t.video_provider === "youtube" && t.video_url ? parseYouTubeId(t.video_url) : null;

              return (
                <article
                  key={t.id}
                  id={t.slug}
                  className="overflow-hidden rounded-lg border border-border bg-card"
                >
                  {hasVideo ? (
                    <VideoEmbed
                      videoUrl={t.video_url!}
                      provider={t.video_provider}
                      title={t.title}
                      className="aspect-video w-full bg-black"
                    />
                  ) : ytId ? (
                    <img
                      src={youtubeThumbnailUrl(ytId)}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  ) : null}
                  <div className="p-5">
                    <p className="text-xs uppercase tracking-wider text-gold">{t.category}</p>
                    <h2 className="mt-2 font-serif text-xl">{t.title}</h2>
                    {t.description && (
                      <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
                    )}
                    {t.body_md && (
                      <p className="mt-4 text-sm whitespace-pre-wrap leading-relaxed">{t.body_md}</p>
                    )}
                    {hasVideo && (
                      <a
                        href={t.video_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block text-sm text-gold underline"
                      >
                        Open on YouTube
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </MarketingLayout>
  );
}
