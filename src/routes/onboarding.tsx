import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: () => {
    // SECURITY LOCK: Onboarding setup is only accessible through the local Electron host installer.
    throw redirect({
      to: "/login",
      search: { redirect: "", error: "", audience: undefined },
      replace: true,
    });
  },
  component: () => null,
});
