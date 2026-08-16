import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL — unified login at `/` resolves portal vs ERP from backend authorization. */
export const Route = createFileRoute("/supplier-login")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
  component: () => null,
});
