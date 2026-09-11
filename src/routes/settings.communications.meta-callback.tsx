import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/app-info";

/** OAuth redirect landing page for Meta Embedded Signup (popup closes automatically). */
export const Route = createFileRoute("/settings/communications/meta-callback")({
  head: () => ({ meta: [{ title: `Meta WhatsApp Signup · ${APP_NAME}` }] }),
  component: MetaCallbackPage,
});

function MetaCallbackPage() {
  useEffect(() => {
    if (window.opener) {
      window.close();
    }
  }, []);

  return (
    <StandardPage title="Meta WhatsApp Signup" subtitle="Completing connection…" maxWidth="sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        You can close this window and return to Communications settings.
      </div>
    </StandardPage>
  );
}
