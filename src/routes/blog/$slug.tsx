import { createFileRoute, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { usePublicWebsiteBundle } from "@/hooks/use-public-website";
import { fetchBlogPostBySlug } from "@/lib/website/website-service";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = await fetchBlogPostBySlug(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const { data: bundle } = usePublicWebsiteBundle();
  const { post } = Route.useLoaderData();

  if (!bundle.feature_flags.blog) throw notFound();

  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-12 prose prose-sm dark:prose-invert">
        <h1>{post.title}</h1>
        {post.author_name && (
          <p className="text-sm text-muted-foreground not-prose">By {post.author_name}</p>
        )}
        <div className="whitespace-pre-wrap">{post.body_md}</div>
      </article>
    </MarketingLayout>
  );
}
