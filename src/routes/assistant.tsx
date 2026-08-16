import { createFileRoute } from "@tanstack/react-router";
import { AssistantWorkspace } from "@/components/assistant/AssistantWorkspace";
import { MobileAssistant } from "@/components/mobile/MobileAssistant";
import { AdaptiveView } from "@/components/adaptive/AdaptiveView";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant Workspace · Ornexa ERP" }] }),
  component: AssistantPage,
});

function AssistantPage() {
  return <AdaptiveView mobile={<MobileAssistant />} desktop={<AssistantWorkspace />} />;
}
