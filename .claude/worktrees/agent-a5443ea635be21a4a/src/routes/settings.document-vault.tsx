import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  saveFile,
  loadFile,
  listCurrentFiles,
  verifyFileIntegrity,
  repairFile,
  UploadValidationError,
  type FileVaultEntry,
} from "@/lib/local-file-store";
import { initLocalDb } from "@/lib/local-db";
import { Upload, Download, ShieldCheck, ShieldAlert, Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/document-vault")({
  head: () => ({ meta: [{ title: "Document Vault · MTJ ERP" }] }),
  component: DocumentVaultPage,
});

function makeAttachmentId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `doc_${crypto.randomUUID()}`;
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function DocumentVaultPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileVaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      await initLocalDb();
      setEntries(listCurrentFiles());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await saveFile(makeAttachmentId(), bytes, {
        fileName: file.name,
        mimeType: file.type,
        entityType: entityType || undefined,
        entityId: entityId || undefined,
      });
      toast.success(`${file.name} stored (encrypted, checksummed).`);
      await refresh();
    } catch (err) {
      if (err instanceof UploadValidationError) toast.error(err.message);
      else toast.error(err instanceof Error ? err.message : "Failed to store file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDownload(entry: FileVaultEntry) {
    setBusyId(entry.attachment_id);
    try {
      const bytes = await loadFile(entry.attachment_id);
      if (!bytes) {
        toast.error("File not found.");
        return;
      }
      const blob = new Blob([bytes.slice().buffer], { type: entry.mime_type ?? "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = entry.file_name ?? entry.attachment_id;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decrypt/load file — it may be corrupted.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleVerify(entry: FileVaultEntry) {
    setBusyId(entry.attachment_id);
    try {
      const result = await verifyFileIntegrity(entry.attachment_id);
      if (result.ok) toast.success(`${entry.file_name ?? entry.attachment_id} verified OK.`);
      else toast.error(`Integrity check FAILED: ${result.error ?? "unknown"}`);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRepair(entry: FileVaultEntry) {
    setBusyId(entry.attachment_id);
    try {
      const result = await repairFile(entry.attachment_id);
      if (result.repaired) toast.success(`Repaired: ${result.reason}`);
      else toast.error(`Not repaired: ${result.reason}`);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Document Vault"
        subtitle="Encrypted, checksummed, versioned local file storage — every stored document is content-addressed and verifiable on demand."
      />

      <div className="rounded-2xl border border-border bg-card p-5 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label>Entity Type (optional)</Label>
            <Input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="e.g. order, stock_item" className="w-48" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Entity ID (optional)</Label>
            <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="linked record id" className="w-48" />
          </div>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload File
          </Button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3">File</th>
              <th className="p-3">Linked To</th>
              <th className="p-3">Version</th>
              <th className="p-3">Size</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  {loading ? "Loading…" : "No documents stored yet."}
                </td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-border last:border-0">
                <td className="p-3">{entry.file_name ?? entry.attachment_id}</td>
                <td className="p-3 text-muted-foreground">
                  {entry.entity_type ? `${entry.entity_type} · ${entry.entity_id?.slice(0, 10)}` : "—"}
                </td>
                <td className="p-3">v{entry.version}</td>
                <td className="p-3">{entry.size_bytes ? `${(entry.size_bytes / 1024).toFixed(0)} KB` : "—"}</td>
                <td className="p-3">
                  {entry.corrupted ? (
                    <Badge variant="destructive" className="gap-1">
                      <ShieldAlert className="h-3 w-3" /> Corrupted
                    </Badge>
                  ) : (
                    <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                      <ShieldCheck className="h-3 w-3" /> OK
                    </Badge>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="outline" disabled={busyId === entry.attachment_id} onClick={() => handleDownload(entry)} className="gap-1">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                    <Button size="sm" variant="outline" disabled={busyId === entry.attachment_id} onClick={() => handleVerify(entry)} className="gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verify
                    </Button>
                    {entry.corrupted === 1 && (
                      <Button size="sm" variant="outline" disabled={busyId === entry.attachment_id} onClick={() => handleRepair(entry)} className="gap-1">
                        <Wrench className="h-3.5 w-3.5" /> Repair
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
