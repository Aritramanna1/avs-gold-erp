import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile/transactions")({
  beforeLoad: () => {
    throw redirect({ to: "/transaction-hub", replace: true });
  },
  component: () => null,
});
