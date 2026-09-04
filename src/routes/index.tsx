import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/login", search: { redirect: "", error: "", audience: undefined } });
  },
  component: () => null,
});
