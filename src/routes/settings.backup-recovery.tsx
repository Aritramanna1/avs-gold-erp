import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { runDisasterRecoveryDrill, type DrillResult } from "@/lib/security/disaster-recovery";
import {
  useDeploymentMode,
  setDeploymentMode,
  type DeploymentMode,
} from "@/lib/deployment-mode";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { pushPendingOutbox, getSyncStatus, type SyncStatus } from "@/lib/sync-engine";
import {
  createBackupSnapshot,
  restoreFromBackupSnapshot,
  verifyBackupRestorable,
} from "@/lib/local-db";
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  Upload,
  Loader2,
  Cloud,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/backup-recovery")({
  head: () => ({ meta: [{ title: "Backup & Disaster Recovery · AVS Gold ERP" }] }),
  component: BackupRecoveryPage,
});

function BackupRecoveryPage() {
  const deploymentMode = useDeploymentMode((s) => s.mode);
  const [drilling, setDrilling] = useState(false);
  const [lastDrill, setLastDrill] = useState<DrillResult | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  // Runtime deployment-mode switch (Offline ↔ Hybrid) + manual cloud sync.
  const [pendingMode, setPendingMode] = useState<DeploymentMode | null>(null);
  const [switching, setSwitching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  function refreshSyncStatus() {
    try {
      setSyncStatus(getSyncStatus());
    } catch {
      setSyncStatus(null);
    }
  }

  async function handleConfirmModeSwitch() {
    if (!pendingMode) return;
    setSwitching(true);
    try {
      await setDeploymentMode(pendingMode);
      toast.success(`Switched to ${pendingMode} mode. Reloading…`);
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to switch mode");
      setSwitching(false);
      setPendingMode(null);
    }
  }

  async function handleCloudSync() {
    setSyncing(true);
    try {
      const result = await pushPendingOutbox();
      refreshSyncStatus();
      if (result.conflicts > 0) {
        toast.warning(
          `Synced ${result.pushed} change(s) to cloud. ${result.conflicts} conflict(s) need review.`,
        );
      } else if (result.pushed === 0 && result.skippedNotDue === 0) {
        toast.success("Already up to date — nothing pending to sync.");
      } else {
        toast.success(`Synced ${result.pushed} change(s) to cloud.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cloud sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const canHybrid = isSupabaseConfigured();

  useEffect(() => {
    if (deploymentMode && deploymentMode !== "offline") refreshSyncStatus();
  }, [deploymentMode]);

  function handleRestoreFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingRestoreFile(file);
    setRestoreConfirmOpen(true);
    e.target.value = ""; // allow re-selecting the same file later
  }

  async function handleConfirmRestore() {
    if (!pendingRestoreFile) return;
    setRestoring(true);
    setRestoreConfirmOpen(false);
    try {
      const text = await pendingRestoreFile.text();
      const parsed = JSON.parse(text);
      const snapshot = {
        schemaVersion: parsed.schemaVersion,
        checksum: parsed.checksum,
        createdAt: parsed.createdAt,
        iv: new Uint8Array(parsed.iv),
        encryptedBlob: new Uint8Array(parsed.encryptedBlob),
      };

      // Verify BEFORE touching the live database — a bad file must never
      // partially replace live data. verifyBackupRestorable never mutates
      // anything; restoreFromBackupSnapshot only runs if this passes.
      const verification = await verifyBackupRestorable(snapshot);
      if (!verification.ok) {
        toast.error(
          `Backup file failed verification — restore aborted. ${verification.issues.join("; ")}`,
        );
        return;
      }

      await restoreFromBackupSnapshot(snapshot);
      toast.success("Database restored from backup. Reloading...");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to restore from backup file");
    } finally {
      setRestoring(false);
      setPendingRestoreFile(null);
    }
  }

  async function handleDrill() {
    setDrilling(true);
    try {
      const result = await runDisasterRecoveryDrill();
      setLastDrill(result);
      if (result.ok) toast.success("Drill passed — backup is genuinely restorable.");
      else toast.error(`Drill FAILED: ${result.issues.join("; ") || "unknown issue"}`);
    } finally {
      setDrilling(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const snapshot = await createBackupSnapshot();
      const payload = {
        schemaVersion: snapshot.schemaVersion,
        checksum: snapshot.checksum,
        createdAt: snapshot.createdAt,
        iv: Array.from(snapshot.iv),
        encryptedBlob: Array.from(snapshot.encryptedBlob),
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mtj-erp-backup-${snapshot.createdAt.slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success(
        `Backup downloaded (${(snapshot.encryptedBlob.byteLength / 1024).toFixed(0)} KB, encrypted).`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create backup");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader
        title="Backup & Disaster Recovery"
        subtitle="An automatic weekly drill already proves backups are restorable in the background. Trigger it manually, or download an encrypted snapshot now."
      />

      <div className="grid gap-4">
        {/* ── Deployment mode: Offline (local only) ↔ Hybrid (local + cloud) ─ */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold flex items-center gap-2">
                {deploymentMode === "offline" ? (
                  <HardDrive className="h-4 w-4" />
                ) : (
                  <Cloud className="h-4 w-4" />
                )}
                Deployment Mode —{" "}
                <span className="capitalize text-gold">{deploymentMode ?? "…"}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Daily operations always run on the local database. Offline uses only local storage.
                Hybrid additionally authenticates, backs up and syncs to the cloud. Switching
                reloads the app.
              </div>
            </div>
            {deploymentMode === "offline" ? (
              <Button
                onClick={() => setPendingMode("hybrid")}
                disabled={!canHybrid || switching}
                variant="outline"
                className="gap-2 shrink-0"
                title={canHybrid ? undefined : "Cloud is not configured for this install."}
              >
                <Cloud className="h-4 w-4" /> Enable Hybrid / Cloud
              </Button>
            ) : (
              <Button
                onClick={() => setPendingMode("offline")}
                disabled={switching}
                variant="outline"
                className="gap-2 shrink-0"
              >
                <HardDrive className="h-4 w-4" /> Switch to Offline
              </Button>
            )}
          </div>
        </div>

        {/* ── Manual cloud backup / sync (Hybrid & Online only) ───────────── */}
        {deploymentMode && deploymentMode !== "offline" && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold">Backup / Sync to Cloud</div>
                <div className="text-sm text-muted-foreground">
                  Pushes locally-recorded changes up to the cloud (Supabase) for backup and
                  cross-device sync. Runs automatically in the background; use this to force it now.
                </div>
                {syncStatus && (
                  <div className="text-xs text-muted-foreground mt-2 font-mono">
                    Pending: {syncStatus.pending} · Synced: {syncStatus.synced}
                    {syncStatus.conflicts > 0 ? ` · Conflicts: ${syncStatus.conflicts}` : ""}
                    {syncStatus.lastPushedAt
                      ? ` · Last push: ${new Date(syncStatus.lastPushedAt).toLocaleString()}`
                      : ""}
                  </div>
                )}
              </div>
              <Button
                onClick={handleCloudSync}
                disabled={syncing}
                variant="outline"
                className="gap-2 shrink-0"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync to Cloud Now
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Disaster Recovery Drill</div>
              <div className="text-sm text-muted-foreground">
                Snapshots the live database, then verifies it decrypts and passes an integrity check
                — without touching the live data.
              </div>
            </div>
            <Button onClick={handleDrill} disabled={drilling} className="gap-2 shrink-0">
              {drilling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Run Drill Now
            </Button>
          </div>
          {lastDrill && (
            <div
              className={`mt-4 rounded-xl border p-3 text-sm flex items-start gap-2 ${
                lastDrill.ok
                  ? "border-green-600/40 bg-green-600/5"
                  : "border-destructive/40 bg-destructive/5"
              }`}
            >
              {lastDrill.ok ? (
                <ShieldCheck className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-medium">
                  {lastDrill.ok ? "Backup verified restorable" : "Drill failed"} — ran{" "}
                  {new Date(lastDrill.ranAt).toLocaleString()}
                </div>
                <div className="text-muted-foreground">
                  Checksum verified: {lastDrill.checksumVerified ? "yes" : "no"} · Integrity check:{" "}
                  {lastDrill.integrityCheckPassed ? "passed" : "failed"} · Size:{" "}
                  {(lastDrill.sizeBytes / 1024).toFixed(0)} KB
                </div>
                {lastDrill.issues.length > 0 && (
                  <ul className="list-disc list-inside mt-1">
                    {lastDrill.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Manual Backup Download</div>
              <div className="text-sm text-muted-foreground">
                Downloads an encrypted, checksummed snapshot of the current local database to your
                computer — same at-rest encryption as normal storage.
              </div>
            </div>
            <Button
              onClick={handleDownload}
              disabled={downloading}
              variant="outline"
              className="gap-2 shrink-0"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download Backup
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Restore From Backup</div>
              <div className="text-sm text-muted-foreground">
                Verifies the file's checksum and integrity before touching anything — replaces the
                entire live database only if verification passes. This is destructive and cannot be
                undone.
              </div>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={restoring}
              variant="destructive"
              className="gap-2 shrink-0"
            >
              {restoring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Restore Backup File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleRestoreFileSelected}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
          Every drill run — automatic (weekly) or manual — is recorded in the{" "}
          <a href="/reports/audit-log" className="text-gold underline">
            Audit Log
          </a>{" "}
          as <code>disaster_recovery.drill_passed</code> /{" "}
          <code>disaster_recovery.drill_failed</code>, so drill history and trends are auditable
          there.
        </div>
      </div>

      <AlertDialog
        open={pendingMode !== null}
        onOpenChange={(open) => {
          if (!open && !switching) setPendingMode(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Switch to {pendingMode === "offline" ? "Offline" : "Hybrid / Cloud"} mode?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMode === "offline"
                ? "The app will stop authenticating and syncing to the cloud and run entirely on the local database. Your local data is untouched. The app reloads."
                : "The app will additionally use the cloud for authentication, backup and sync. Daily operations still run on the local database. You will need to sign in with your cloud account after reload."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={switching}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmModeSwitch} disabled={switching}>
              {switching ? "Switching…" : "Switch & Reload"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore database from this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the ENTIRE live database — every branch, invoice, ledger entry, and
              stock record currently in this install — with the contents of{" "}
              <b>{pendingRestoreFile?.name}</b>. Any changes made since that backup was taken will
              be lost. This cannot be undone. Only proceed if you are certain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRestoreFile(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, Restore and Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
