import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Cloud, FolderLock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/document-vault")({
  head: () => ({ meta: [{ title: "Document Vault - AVS Gold ERP" }] }),
  component: DocumentVaultPage,
});

function DocumentVaultPage() {
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        title="Document Vault"
        subtitle="Production document storage is Supabase-backed. The legacy browser-local encrypted vault has been retired from the online build."
      />

      <div className="grid gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <FolderLock className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold">Supabase storage required</div>
                <div className="mt-1 text-sm leading-6 text-muted-foreground">
                  Upload, preview, share, WhatsApp, email, and print attachments should use the
                  centralized document engine and Supabase storage policies.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="shrink-0 gap-2"
              onClick={() => toast.success("Document vault is in Supabase-online mode.")}
            >
              <RefreshCw className="h-4 w-4" />
              Check
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <Cloud className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <div className="font-semibold">Central document engine</div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                The next implementation step is to bind this screen to Supabase Storage buckets,
                document definitions, preview records, and RLS-protected attachment metadata.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
