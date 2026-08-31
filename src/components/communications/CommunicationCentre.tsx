/**
 * AVS Communication Centre — unified log of all email/WhatsApp/in-app messages.
 */
import { useEffect, useState } from "react";
import { Panel, StatusBadge } from "@/components/design-system";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  fetchCommunicationCentre,
  type CommunicationCentreRow,
} from "@/lib/comm/platform/communication-jobs-store";
import { Mail, MessageSquare, Bell, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHANNEL_ICONS = {
  email: Mail,
  whatsapp: MessageSquare,
  in_app: Bell,
  sms: MessageSquare,
} as const;

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "completed" || status === "delivered" || status === "sent") return "success";
  if (status === "partial" || status === "processing" || status === "pending") return "info";
  if (status === "failed") return "danger";
  return "neutral";
}

export function CommunicationCentre() {
  const [rows, setRows] = useState<CommunicationCentreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const data = await fetchCommunicationCentre({ limit: 100 });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.eventKey.includes(q) ||
      r.recipientName.toLowerCase().includes(q) ||
      r.recipientContact.toLowerCase().includes(q) ||
      (r.referenceId ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Panel
      title="Communication Centre"
      description="All outbound messages across Email, WhatsApp, and in-app channels. Business transactions are never rolled back when messaging fails."
      actions={
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="pl-8 h-9"
          placeholder="Search event, party, reference…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto border border-border rounded-sm">
        <table className="erp-table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Date</th>
              <th className="text-left">Event</th>
              <th className="text-left">Recipient</th>
              <th className="text-left">Channels</th>
              <th className="text-left">Status</th>
              <th className="text-left">Reference</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground py-8">
                  {loading ? "Loading…" : "No communication jobs yet."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td>
                    <div className="font-medium">{row.eventKey}</div>
                    <div className="text-[10px] text-muted-foreground">{row.productId}</div>
                  </td>
                  <td>
                    <div>{row.recipientName}</div>
                    <div className="text-xs text-muted-foreground">{row.recipientContact}</div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {row.channelResults.length > 0
                        ? row.channelResults.map((cr, i) => {
                            const Icon = CHANNEL_ICONS[cr.channel] ?? Mail;
                            return (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-[10px] gap-1 font-normal"
                              >
                                <Icon className="h-2.5 w-2.5" />
                                {cr.channel}
                                <span className="opacity-60">· {cr.status}</span>
                              </Badge>
                            );
                          })
                        : row.channelsRequested.map((ch) => (
                            <Badge key={ch} variant="outline" className="text-[10px] font-normal">
                              {ch}
                            </Badge>
                          ))}
                    </div>
                  </td>
                  <td>
                    <StatusBadge label={row.status} tone={statusTone(row.status)} dot />
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {row.referenceType && row.referenceId
                      ? `${row.referenceType} / ${row.referenceId.slice(0, 12)}`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
