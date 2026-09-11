import { createFileRoute } from "@tanstack/react-router";
import { AssistantWorkspace } from "@/components/assistant/AssistantWorkspace";
import { MobileAssistant } from "@/components/mobile/MobileAssistant";
import { AdaptiveView } from "@/components/adaptive/AdaptiveView";
import { APP_NAME } from "@/lib/app-info";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: `AI Assistant Workspace · ${APP_NAME}` }] }),
  component: AssistantPage,
});

function AssistantPage() {
  return <AdaptiveView mobile={<MobileAssistant />} desktop={<AssistantWorkspace />} />;
}
