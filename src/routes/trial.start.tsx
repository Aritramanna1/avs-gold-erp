/**
 * Legacy public trial URL — invitation-only policy redirects to request-access.
 */
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { REQUEST_ACCESS_PATH } from "@/lib/auth/public-signup-policy";

export const Route = createFileRoute("/trial/start")({
  head: () => ({ meta: [{ title: "Request Access · Ornexa" }] }),
  component: () => <Navigate to={REQUEST_ACCESS_PATH} replace />,
});
