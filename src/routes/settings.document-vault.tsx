import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Cloud, FolderLock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { ensureStorageBucketsReady } from "@/lib/supabase-storage";

export const Route = createFileRoute("/settings/document-vault")({
  head: () => ({ meta: [{ title: "Document Vault - AVS Gold ERP" }] }),
  component: DocumentVaultPage,
});

function DocumentVaultPage() {
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  async function runVaultCheck() {
    setChecking(true);
    try {
      await ensureStorageBucketsReady();
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Sign in required to verify document vault connectivity");
        return;
      }
      const { count, error } = await supabase
        .from("storage_file_metadata")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      const stamp = new Date().toLocaleString("en-IN");
      setLastCheck(stamp);
      toast.success(`Document vault online — ${count ?? 0} indexed file(s)`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Document vault check failed");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        title="Document Vault"
        subtitle="Production document storage is Supabase-backed with R2 object storage behind the authenticated proxy."
      />

      <div className="grid gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <FolderLock className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="font-semibold">Supabase + R2 storage</div>
                <div className="mt-1 text-sm leading-6 text-muted-foreground">
                  Upload, preview, share, WhatsApp, email, and print attachments use the centralized
                  document engine, storage metadata, and RLS-protected buckets.
                </div>
                {lastCheck && (
                  <p className="text-xs text-muted-foreground mt-2">Last verified: {lastCheck}</p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              className="shrink-0 gap-2"
              disabled={checking}
              onClick={() => void runVaultCheck()}
            >
              <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
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
                Attachments are indexed in `storage_file_metadata` and served through the R2 proxy
                with session-gated access. Deleting an attachment removes both metadata and the R2
                object.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
