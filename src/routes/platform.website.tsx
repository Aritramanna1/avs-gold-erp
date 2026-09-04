import { createFileRoute, Navigate } from "@tanstack/react-router";
import { DEFAULT_PLATFORM_SEARCH } from "@/lib/platform-search";

export const Route = createFileRoute("/platform/website")({
  component: () => <Navigate to="/platform" search={DEFAULT_PLATFORM_SEARCH} replace />,
});
