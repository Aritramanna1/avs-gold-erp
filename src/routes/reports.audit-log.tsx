import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  verifyAuditChain,
  getAuditEntries,
  type AuditEntry,
  type ChainVerificationResult,
} from "@/lib/security/audit-log";
import { exportToCSV, triggerPrint } from "@/lib/report-engine";
import { ShieldCheck, ShieldAlert, RefreshCw, Loader2, Download, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reports/audit-log")({
  head: () => ({ meta: [{ title: "Audit & Compliance Log · AVS Gold ERP" }] }),
  component: AuditLogPage,
});

function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [verification, setVerification] = useState<ChainVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [q, setQ] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const all = await getAuditEntries();
      setEntries(all.sort((a, b) => b.seq - a.seq).slice(0, 500));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load the audit log. Retry shortly.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    try {
      const result = await verifyAuditChain();
      setVerification(result);
      if (result.ok)
        toast.success(`Chain verified — ${result.entriesChecked} entries, no tampering detected.`);
      else toast.error(`Chain integrity FAILED at seq ${result.brokenAtSeq} — see details below.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not verify the audit chain. Retry shortly.",
      );
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function handleCSV() {
    const header = ["Seq", "Time", "Action", "Entity Type", "Entity Id", "Actor"];
    const data = filtered.map((e) => [
      e.seq,
      new Date(e.ts).toLocaleString(),
      e.action,
      e.entityType,
      e.entityId ?? "",
      e.actorEmail ?? "system",
    ]);
    exportToCSV("audit-log.csv", [header, ...data]);
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter(
      (e) =>
        e.action.toLowerCase().includes(needle) ||
        e.entityType.toLowerCase().includes(needle) ||
        (e.entityId ?? "").toLowerCase().includes(needle) ||
        (e.actorEmail ?? "").toLowerCase().includes(needle),
    );
  }, [entries, q]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Audit & Compliance Log"
        subtitle="Immutable, hash-chained record of every financial and gold-accounting action. Verify integrity on demand."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button variant="outline" onClick={handleCSV} className="gap-2">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" onClick={() => triggerPrint()} className="gap-2">
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button onClick={handleVerify} disabled={verifying} className="gap-2">
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Verify Chain Integrity
            </Button>
          </div>
        }
      />

      {verification && (
        <div
          className={`rounded-md border p-4 mb-4 flex items-start gap-3 ${
            verification.ok
              ? "border-green-600/40 bg-green-600/5"
              : "border-destructive/40 bg-destructive/5"
          }`}
        >
          {verification.ok ? (
            <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <div className="font-semibold">
              {verification.ok
                ? `Chain verified clean — ${verification.entriesChecked} entries checked.`
                : `Chain integrity FAILED at sequence ${verification.brokenAtSeq}.`}
            </div>
            {verification.issues.length > 0 && (
              <ul className="list-disc list-inside mt-1 text-muted-foreground">
                {verification.issues.slice(0, 10).map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by action, entity type, entity id or actor email"
        className="mb-4 max-w-md"
      />

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3">Seq</th>
                <th className="p-3">Time</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Actor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No audit entries match."}
                  </td>
                </tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">{e.seq}</td>
                  <td className="p-3 text-muted-foreground">{new Date(e.ts).toLocaleString()}</td>
                  <td className="p-3">
                    <Badge variant="secondary">{e.action}</Badge>
                  </td>
                  <td className="p-3">
                    {e.entityType}
                    {e.entityId ? ` · ${e.entityId.slice(0, 12)}` : ""}
                  </td>
                  <td className="p-3 text-muted-foreground">{e.actorEmail ?? "system"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
