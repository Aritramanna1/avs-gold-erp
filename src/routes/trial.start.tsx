import { createFileRoute, Navigate } from "@tanstack/react-router";
import { REQUEST_ACCESS_PATH } from "@/lib/auth/public-signup-policy";

export const Route = createFileRoute("/trial/start")({
  head: () => ({ meta: [{ title: "Trial · AVS ERP" }] }),
  component: () => <Navigate to={REQUEST_ACCESS_PATH} replace />,
});
