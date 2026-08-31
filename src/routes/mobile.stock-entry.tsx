import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile/stock-entry")({
  beforeLoad: () => {
    throw redirect({ to: "/stock/entry", replace: true });
  },
  component: () => null,
});
