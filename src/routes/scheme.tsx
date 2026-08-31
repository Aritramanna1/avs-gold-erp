import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout shell for /scheme/* (index, plans, accounts, receipts). */
export const Route = createFileRoute("/scheme")({
  head: () => ({ meta: [{ title: "Scheme · AVS ERP" }] }),
  component: () => <Outlet />,
});
