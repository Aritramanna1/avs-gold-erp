import { createFileRoute } from "@tanstack/react-router";
import { useDbStatus, getDbStatusLabel } from "@/lib/db-status";

export const Route = createFileRoute("/settings/storage-diagnostics")({
  component: StorageDiagnosticsPage,
});

function StorageDiagnosticsPage() {
  const { status, email } = useDbStatus();
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-lg font-semibold">Cloud Diagnostics</h1>
      <p className="text-sm text-muted-foreground">{getDbStatusLabel(status)}</p>
      {email && <p className="text-sm text-muted-foreground">Signed in as {email}</p>}
    </div>
  );
}
