import { createFileRoute } from "@tanstack/react-router";
import { MtgHome } from "@/components/mtg/MtgHome";
import { useTenantEntitlements } from "@/lib/tenant-entitlements";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/mtg")({
  head: () => ({
    meta: [{ title: "MTG Workshop · Home" }],
  }),
  component: MtgPage,
});

function MtgPage() {
  const isMtg = useTenantEntitlements((s) => s.isMtg);
  const loaded = useTenantEntitlements((s) => s.loaded);
  if (loaded && !isMtg) {
    return <Navigate to="/app" replace />;
  }
  return <MtgHome />;
}
