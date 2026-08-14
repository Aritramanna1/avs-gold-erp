/**
 * Canonical Route: /onboarding
 * Assisted Setup & 12-Stage Onboarding Wizard
 * Master Reference: docs/MASTER/ONBOARDING_MASTER.md & ONBOARDING_AND_TUTORIAL_MASTER.md
 */
import { createFileRoute } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { APP_NAME } from "@/lib/app-info";
import { SetupWizard } from "./setup";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: `Onboarding & Setup · ${APP_NAME}` }] }),
  component: SetupWizard,
});
