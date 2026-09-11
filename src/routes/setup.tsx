import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/setup")({
  beforeLoad: () => {
    // SECURITY LOCK: First-time setup is strictly an Electron installer / first-run host function.
    // Public web access and external Internet access to /setup are completely blocked.
    throw redirect({
      to: "/login",
      search: { redirect: undefined, error: undefined, audience: undefined },
      replace: true,
    });
  },
  component: () => null,
});

export const SetupWizard = () => null;
