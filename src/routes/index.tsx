import { createFileRoute } from "@tanstack/react-router";
import { WorkshopDashboard } from "@/components/workshop-dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workshop Dashboard · AVS Gold ERP" },
      { name: "description", content: "Fine gold position and daily workshop operations." },
    ],
  }),
  component: WorkshopDashboard,
});
