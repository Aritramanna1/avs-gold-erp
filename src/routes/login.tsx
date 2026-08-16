import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { OrnexaParentAttribution } from "@/components/marketing/OrnexaBrandLogo";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: (s.redirect as string) ?? undefined,
    error: (s.error as string) ?? undefined,
  }),
  head: () => ({
    meta: [{ title: "Login · Ornexa" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  return (
    <MarketingLayout>
      <div className="mx-auto max-w-md px-4 py-12">
        <AuthLayout
          onSuccess={() => {
            void navigate({ to: (redirect as "/app") || "/app", replace: true });
          }}
        />
        <OrnexaParentAttribution className="mt-8 text-center" />
      </div>
    </MarketingLayout>
  );
}
