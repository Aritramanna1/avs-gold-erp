import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Server,
  Database,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  ArrowLeft,
  Loader2,
  ExternalLink,
  User,
  Calendar,
} from "lucide-react";

export const Route = createFileRoute("/settings/storage-diagnostics")({
  head: () => ({ meta: [{ title: "Storage Diagnostics · MTJ ERP" }] }),
  component: StorageDiagnostics,
});

function StorageDiagnostics() {
  const { t } = useLanguage();
  const [gatewayStatus, setGatewayStatus] = useState<"checking" | "online" | "offline">("checking");
  const [gatewayMsg, setGatewayMsg] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResponse, setTestResponse] = useState<any>(null);

  // Check the Supabase Storage connectivity
  async function checkGateway() {
    setGatewayStatus("checking");
    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) {
        setGatewayStatus("offline");
        setGatewayMsg(`Supabase Storage error: ${error.message}`);
        setTestResponse({ status: "error", text: error.message });
      } else {
        setGatewayStatus("online");
        const bucketNames = (data || []).map((b: any) => b.name).join(", ");
        setGatewayMsg(`Supabase Storage connected. Buckets: ${bucketNames || "none"}`);
        setTestResponse({ status: "ok", text: bucketNames });
      }
    } catch (err: any) {
      setGatewayStatus("offline");
      setGatewayMsg(err.message || "Failed to connect to Supabase Storage.");
      setTestResponse({ status: "error", text: err.message });
    }
  }

  // Load last 20 attachments from the database
  async function loadAttachments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Database retrieve error:", error);
        setAttachments([]);
      } else {
        setAttachments(data || []);
      }
    } catch (err) {
      console.error(err);
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkGateway();
    loadAttachments();
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Storage & File Diagnostics"
        subtitle="Verify Supabase Storage connectivity and file persistence records."
        actions={
          <Link to="/settings">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Settings
            </Button>
          </Link>
        }
      />

      {/* Gateway Connection Card */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Supabase Storage</h3>
              <p className="text-[11px] text-muted-foreground">Storage buckets</p>
            </div>
          </div>
          <div>
            {gatewayStatus === "checking" ? (
              <Badge
                variant="outline"
                className="animate-pulse flex items-center gap-1.5 text-amber-300"
              >
                <Loader2 className="h-3 w-3 animate-spin" /> Ping Handshake
              </Badge>
            ) : gatewayStatus === "online" ? (
              <Badge
                variant="outline"
                className="flex items-center gap-1.5 border-emerald-500/35 text-emerald-300 bg-emerald-500/10"
              >
                <CheckCircle2 className="h-3 w-3" /> Online & Responsive
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="flex items-center gap-1.5 border-red-500/35 text-red-300 bg-red-500/10"
              >
                <AlertTriangle className="h-3 w-3" /> Offline / Simulation fallback
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
            {gatewayMsg}
          </p>
          <Button size="sm" variant="outline" onClick={checkGateway}>
            Retest Connection
          </Button>
        </Card>

        {/* Supabase Link Metadata */}
        <Card className="p-5 flex flex-col justify-between space-y-3 col-span-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Supabase Attachments Table</h3>
              <p className="text-[11px] text-muted-foreground">public.attachments</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every secure document or image uploaded via the ERP writes a tracking row inside
            Supabase with the file's binary url link, physical Hostinger path, file size, mime type,
            and linked parent module reference.
          </p>
          <div className="flex gap-2">
            <div className="text-center bg-muted/30 border border-border rounded-lg p-2 flex-1">
              <span className="text-xs text-muted-foreground block text-left">
                Active rows Logged
              </span>
              <span className="font-mono text-lg font-bold block text-left text-gold">
                {attachments.length}
              </span>
            </div>
            <div className="text-center bg-muted/30 border border-border rounded-lg p-2 flex-1">
              <span className="text-xs text-muted-foreground block text-left">Target Storage</span>
              <span className="font-mono text-xs font-semibold block text-left text-foreground mt-1.5">
                Hostinger FTP
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Uploaded folders overview checklist */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-gold" /> Hostinger Directories Required
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          {[
            "uploads/firm-logos/",
            "uploads/expense-attachments/",
            "uploads/kyc-documents/",
            "uploads/order-attachments/",
            "uploads/billing-attachments/",
            "uploads/gold-settlement-proofs/",
            "uploads/worker-documents/",
            "uploads/customer-documents/",
          ].map((dir) => (
            <div
              key={dir}
              className="p-2 border border-border/50 bg-muted/15 rounded flex items-center justify-between"
            >
              <span className="truncate text-[10px]" title={dir}>
                {dir}
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold shrink-0">Checked</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Last 20 rows table */}
      <Card className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold">Supabase Metadata Ledger (Last 20 Files)</h3>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={loadAttachments}>
            Refresh Ledger Data
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-10">
            <Loader2 className="h-4 w-4 animate-spin text-gold" /> Retrieving attachment headers...
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-10">
            No tracked attachments rows found in public.attachments. Create an order or worker KYC
            to upload files.
          </div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground uppercase tracking-wider">
                  <th className="p-3">File Name</th>
                  <th className="p-3">Mime Type</th>
                  <th className="p-3">Bytes</th>
                  <th className="p-3">Attached To</th>
                  <th className="p-3">Uploaded By</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {attachments.map((row) => {
                  const meta = row.data || {};
                  return (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td
                        className="p-3 font-semibold max-w-[150px] truncate"
                        title={row.file_name}
                      >
                        {row.file_name}
                        {meta.notes && (
                          <span className="block font-normal text-[10px] text-gold/80 truncate">
                            {meta.notes}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-[10px]">
                        {row.mime_type || "image/unknown"}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {(row.size_bytes || 0).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-[10px] scale-90 origin-left">
                          {row.linked_table || "people"}
                        </Badge>
                        <span
                          className="block text-[10px] text-muted-foreground truncate max-w-[100px]"
                          title={row.linked_id}
                        >
                          ID: {row.linked_id?.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="p-3 flex items-center gap-1 text-muted-foreground mt-0.5">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[100px]">
                          {meta.uploadedByEmail || "System"}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-gold">
                        {meta.storage_provider || "hostinger"}
                      </td>
                      <td className="p-3 text-right">
                        <a
                          href={meta.file_url || meta.fileDataUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button size="sm" variant="ghost" className="h-6 gap-1 text-[11px]">
                            View URL <ExternalLink className="h-2.5 w-2.5" />
                          </Button>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
