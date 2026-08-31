import { createFileRoute, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { fetchLegalPage } from "@/lib/website/website-service";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";

export const Route = createFileRoute("/legal/$slug")({
  loader: async ({ params }) => {
    const page = await fetchLegalPage(params.slug);
    if (!page) throw notFound();
    return { page };
  },
  component: LegalPageView,
});

function LegalPageView() {
  const { page } = Route.useLoaderData();
  usePublicWebsiteBundle();

  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-3xl">{page.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Version {page.version} · Effective {page.effective_date}
        </p>
        <div className="mt-8 prose prose-sm dark:prose-invert whitespace-pre-wrap">
          {page.body_md}
        </div>
      </article>
    </MarketingLayout>
  );
}
