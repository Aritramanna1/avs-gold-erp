import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Mail, RefreshCw, UserCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

interface PortalInvitationRow {
  id: string;
  portal_type: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  code: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface PortalInvitationsPanelProps {
  partyId: string;
  partyName: string;
  onInvite: () => void;
}

export function PortalInvitationsPanel({
  partyId,
  partyName,
  onInvite,
}: PortalInvitationsPanelProps) {
  const [rows, setRows] = useState<PortalInvitationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("portal_invitations" as never)
        .select(
          "id,portal_type,recipient_email,recipient_phone,code,status,expires_at,accepted_at,created_at",
        )
        .eq("party_id", partyId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setRows((data ?? []) as unknown as PortalInvitationRow[]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load portal invitations.");
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function revokeInvitation(id: string) {
    const { error } = await supabase
      .from("portal_invitations" as never)
      .update({ status: "REVOKED", updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invitation revoked.");
    void refresh();
  }

  function copyLink(row: PortalInvitationRow) {
    const contact = row.recipient_email || row.recipient_phone || "";
    const url = `${window.location.origin}/invite/accept?code=${row.code}&email=${encodeURIComponent(contact)}`;
    void navigator.clipboard.writeText(url);
    toast.success("Invitation link copied.");
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-amber-500" />
            Portal Access · {partyName}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Customer, Karigar, and Supplier portal invitations with revoke and resend controls.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={onInvite}>
            <Mail className="h-3.5 w-3.5 mr-1" />
            New Invitation
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No portal invitations sent yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs">
                <th className="py-2 pr-3">Portal</th>
                <th className="py-2 pr-3">Recipient</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Expires</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3 capitalize">{row.portal_type.replace(/_/g, " ")}</td>
                  <td className="py-2.5 pr-3 text-xs">
                    {row.recipient_email || row.recipient_phone || "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge
                      variant="outline"
                      className={
                        row.status === "ACCEPTED"
                          ? "text-emerald-600 border-emerald-500/40"
                          : row.status === "SENT"
                            ? "text-blue-600 border-blue-500/40"
                            : ""
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                    {new Date(row.expires_at).toLocaleString("en-IN")}
                  </td>
                  <td className="py-2.5 text-right space-x-1">
                    {row.status === "SENT" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => copyLink(row)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => void revokeInvitation(row.id)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
