import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { usePublicBlogPosts, usePublicWebsiteBundle } from "@/hooks/use-public-website";

export const Route = createFileRoute("/blog/")({
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { data: bundle } = usePublicWebsiteBundle();
  const { data: posts = [], isLoading } = usePublicBlogPosts();

  if (!bundle.feature_flags.blog) throw notFound();

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="font-serif text-3xl">Blog</h1>
        {isLoading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="mt-8 text-muted-foreground">No published articles yet.</p>
        ) : (
          <ul className="mt-10 space-y-8">
            {posts.map((post) => (
              <li key={post.id} className="border-b border-border pb-8">
                <Link to="/blog/$slug" params={{ slug: post.slug }} className="group">
                  <h2 className="font-serif text-xl group-hover:text-gold">{post.title}</h2>
                </Link>
                {post.excerpt && (
                  <p className="mt-2 text-sm text-muted-foreground">{post.excerpt}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </MarketingLayout>
  );
}
