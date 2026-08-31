import { createFileRoute } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { CommunicationProvidersPanel } from "@/components/platform/CommunicationProvidersPanel";

export const Route = createFileRoute("/platform/communication-providers")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Communication Providers · Platform" }] }),
  component: CommunicationProvidersPage,
});

function CommunicationProvidersPage() {
  return <CommunicationProvidersPanel />;
}
