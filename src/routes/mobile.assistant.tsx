import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile/assistant")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/assistant", search, replace: true });
  },
  component: () => null,
});
