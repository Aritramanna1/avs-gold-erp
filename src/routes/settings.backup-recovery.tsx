import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getSyncStatus, type SyncStatus } from "@/lib/sync-engine";
import { Cloud, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/backup-recovery")({
  head: () => ({ meta: [{ title: "Backup & Disaster Recovery - AVS Gold ERP" }] }),
  component: BackupRecoveryPage,
});

function BackupRecoveryPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  function refreshSyncStatus() {
    setSyncStatus(getSyncStatus());
    toast.success("Supabase online state refreshed.");
  }

  useEffect(() => {
    setSyncStatus(getSyncStatus());
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHeader
        title="Backup & Disaster Recovery"
        subtitle="Production data is authoritative in Supabase. Backup and recovery controls now point to the managed project-level strategy."
      />

      <div className="grid gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <Cloud className="h-4 w-4" />
                Supabase Online Mode
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Authentication, tenant data, roles, licensing, support, and central ERP records use
                the configured Supabase project.
              </div>
            </div>
            <Button onClick={refreshSyncStatus} variant="outline" className="shrink-0 gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Local database controls removed</div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                Browser-local backup downloads, restore uploads, and local disaster drills are not
                valid for the Supabase-only production architecture. Backup verification must be
                handled at the Supabase project level.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <div className="font-semibold">Online sync facade</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Pending browser queue: {syncStatus?.pending ?? 0}. Conflicts:{" "}
                {syncStatus?.conflicts ?? 0}. Failed: {syncStatus?.failed ?? 0}.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
