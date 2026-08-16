import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Globe, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";
import { usePeople } from "@/lib/people-store";

interface PortalInvitationRow {
  id: string;
  portal_type: string;
  party_id: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  code: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export function FirmPortalInvitationsPanel() {
  const people = usePeople((s) => s.people);
  const [rows, setRows] = useState<PortalInvitationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const partyName = (partyId: string) =>
    people.find((p) => p.id === partyId)?.fullName ?? partyId.slice(0, 8);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("portal_invitations" as never)
        .select(
          "id,portal_type,party_id,recipient_email,recipient_phone,code,status,expires_at,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setRows((data ?? []) as unknown as PortalInvitationRow[]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load portal invitations.");
    } finally {
      setLoading(false);
    }
  }, []);

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
    toast.success("Portal invitation revoked.");
    void refresh();
  }

  function copyLink(row: PortalInvitationRow) {
    const contact = row.recipient_email || row.recipient_phone || "";
    const url = getAuthRedirectUrl(
      `/invite/accept?code=${row.code}&email=${encodeURIComponent(contact)}`,
    );
    void navigator.clipboard.writeText(url);
    toast.success("Portal invitation link copied.");
  }

  return (
    <Card className="p-5 border-dashed border-border mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-sm text-gold tracking-wide uppercase flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Portal User Invitations
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Customer, Karigar, and Supplier portal access sent from your firm. Invite new portal
            users from each party profile, or resend links here.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No portal invitations yet. Open a Customer, Karigar, or Supplier profile and use
          &quot;Invite to Portal&quot;.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs">
                <th className="py-2 pr-3">Portal</th>
                <th className="py-2 pr-3">Party</th>
                <th className="py-2 pr-3">Recipient</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Expires</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3 capitalize text-xs">
                    {row.portal_type.replace(/_/g, " ")}
                  </td>
                  <td className="py-2.5 pr-3 text-xs">{partyName(row.party_id)}</td>
                  <td className="py-2.5 pr-3 text-xs">
                    {row.recipient_email || row.recipient_phone || "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge variant="outline" className="text-[10px]">
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
