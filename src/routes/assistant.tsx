import { createFileRoute } from "@tanstack/react-router";
import { AssistantWorkspace } from "@/components/assistant/AssistantWorkspace";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant Workspace · Ornexa ERP" }] }),
  component: AssistantPage,
});

function AssistantPage() {
  return <AssistantWorkspace />;
}
