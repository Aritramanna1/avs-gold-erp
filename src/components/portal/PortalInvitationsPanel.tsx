/**
 * Party 360 → Portal Access panel.
 * Shows Not Invited / Pending / Active / Suspended / Revoked and staff actions.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  Mail,
  Power,
  RefreshCw,
  Share2,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings-store";
import {
  accessStatusLabel,
  buildPortalInviteShareUrl,
  loadPartyPortalAccess,
  markInviteLinkCopied,
  portalTypeLabel,
  resendPortalInvitation,
  revokePortalInvitation,
  setPortalIdentityStatus,
  type PartyPortalAccessSnapshot,
  type PortalAccessStatus,
  type PortalInvitationRow,
} from "@/lib/portal/portal-access-service";
import { shareContent } from "@/lib/native/share";

interface PortalInvitationsPanelProps {
  partyId: string;
  partyName: string;
  onInvite: () => void;
}

function statusTone(status: PortalAccessStatus): string {
  switch (status) {
    case "active":
      return "text-emerald-600 border-emerald-500/40 bg-emerald-500/10";
    case "invitation_pending":
      return "text-blue-600 border-blue-500/40 bg-blue-500/10";
    case "suspended":
      return "text-amber-600 border-amber-500/40 bg-amber-500/10";
    case "revoked":
      return "text-destructive border-destructive/40 bg-destructive/10";
    default:
      return "text-muted-foreground border-border";
  }
}

function inviteLifecycleLabel(row: PortalInvitationRow): string {
  if (row.status === "ACCEPTED") return "Accepted";
  if (row.status === "REVOKED") return "Revoked";
  if (row.status === "EXPIRED") return "Expired";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "Expired";
  if (row.delivery_status === "failed") return "Pending (delivery failed)";
  if (row.status === "PENDING") return "Invitation Pending";
  return "Invitation Pending";
}

export function PortalInvitationsPanel({
  partyId,
  partyName,
  onInvite,
}: PortalInvitationsPanelProps) {
  const firm = useSettings((s) => s.firm);
  const [snap, setSnap] = useState<PartyPortalAccessSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadPartyPortalAccess(partyId);
      setSnap(next);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load portal access.");
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function copyLink(row: PortalInvitationRow) {
    const url = buildPortalInviteShareUrl(row);
    await navigator.clipboard.writeText(url);
    await markInviteLinkCopied(row.id);
    toast.success("Invite link copied.");
    void refresh();
  }

  async function shareLink(row: PortalInvitationRow) {
    const url = buildPortalInviteShareUrl(row);
    await shareContent({
      title: `AVS ERP invitation for ${partyName}`,
      text: `Accept your AVS ERP portal invitation:`,
      url,
    });
    await markInviteLinkCopied(row.id);
    toast.success("Invite ready to share.");
    void refresh();
  }

  async function handleResend(row: PortalInvitationRow) {
    setBusyId(row.id);
    try {
      const result = await resendPortalInvitation(row, {
        firmName: firm.shopName || "AVS ERP",
        partyName,
      });
      if (result.deliveryOk) toast.success(result.deliveryMessage);
      else toast.warning(result.deliveryMessage);
      void refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Resend failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeInvite(id: string) {
    setBusyId(id);
    try {
      await revokePortalInvitation(id);
      toast.success("Pending invitation revoked.");
      void refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not revoke invitation.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleIdentity(status: "active" | "suspended" | "revoked") {
    const id = snap?.primaryIdentity?.identity_id;
    if (!id) return;
    setBusyId(id);
    try {
      await setPortalIdentityStatus(id, status);
      toast.success(
        status === "active"
          ? "Portal access re-enabled."
          : status === "suspended"
            ? "Portal access disabled."
            : "Portal access revoked.",
      );
      void refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update portal access.");
    } finally {
      setBusyId(null);
    }
  }

  const accessStatus = snap?.accessStatus ?? "not_invited";

  return (
    <Card className="p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-amber-500" />
            Portal Access · {partyName}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Status</span>
            <Badge variant="outline" className={statusTone(accessStatus)}>
              {accessStatusLabel(accessStatus)}
            </Badge>
            {snap?.lastLoginAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last login {new Date(snap.lastLoginAt).toLocaleString("en-IN")}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground max-w-xl">
            Invite this party to the Customer, Supplier, or Karigar workspace in the same AVS ERP
            app. Acceptance binds their login to this Party 360 record — no duplicate customer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={onInvite} className="gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Create invitation
          </Button>
          <Link
            to="/invite/accept"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-8 px-3 gap-1.5"
          >
            Accept invitation
          </Link>
        </div>
      </div>

      {/* Primary actions by status */}
      <div className="flex flex-wrap gap-2">
        {(accessStatus === "not_invited" || accessStatus === "revoked") && (
          <Button size="sm" onClick={onInvite} className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Invite to Customer Portal
          </Button>
        )}
        {accessStatus === "invitation_pending" && snap?.pendingInvitation && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void copyLink(snap.pendingInvitation!)}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Invite Link
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void shareLink(snap.pendingInvitation!)}
              className="gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share Invite
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busyId === snap.pendingInvitation.id}
              onClick={() => void handleResend(snap.pendingInvitation!)}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Resend Invitation
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive gap-1.5"
              disabled={busyId === snap.pendingInvitation.id}
              onClick={() => void handleRevokeInvite(snap.pendingInvitation!.id)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Revoke Pending Invite
            </Button>
          </>
        )}
        {accessStatus === "active" && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-amber-700"
            disabled={!!busyId}
            onClick={() => void handleIdentity("suspended")}
          >
            <Ban className="h-3.5 w-3.5" />
            Disable Portal Access
          </Button>
        )}
        {accessStatus === "suspended" && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-emerald-700"
            disabled={!!busyId}
            onClick={() => void handleIdentity("active")}
          >
            <Power className="h-3.5 w-3.5" />
            Re-enable Access
          </Button>
        )}
        {(accessStatus === "active" || accessStatus === "suspended") && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive gap-1.5"
            disabled={!!busyId}
            onClick={() => void handleIdentity("revoked")}
          >
            <XCircle className="h-3.5 w-3.5" />
            Revoke Access
          </Button>
        )}
      </div>

      {snap?.identities && snap.identities.length > 0 && (
        <div className="rounded-md border border-border/80 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Linked portal accounts
          </p>
          {snap.identities.map((id) => (
            <div
              key={id.identity_id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>{portalTypeLabel(id.portal_type)}</span>
                <Badge variant="outline" className="text-[10px]">
                  {id.status}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {id.last_login_at
                  ? `Last login ${new Date(id.last_login_at).toLocaleString("en-IN")}`
                  : "No login yet"}
              </span>
            </div>
          ))}
        </div>
      )}

      {!snap?.invitations?.length ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          No portal invitations yet. Use Invite to Portal to send a secure, expiring link.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs">
                <th className="py-2 pr-3">Portal</th>
                <th className="py-2 pr-3">Recipient</th>
                <th className="py-2 pr-3">Invitation</th>
                <th className="py-2 pr-3">Delivery</th>
                <th className="py-2 pr-3">Expires</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {snap.invitations.map((row) => {
                const open = row.status === "PENDING" || row.status === "SENT";
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-3 text-xs">{portalTypeLabel(row.portal_type)}</td>
                    <td className="py-2.5 pr-3 text-xs">
                      {row.recipient_email || row.recipient_phone || "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge variant="outline" className="text-[10px]">
                        {inviteLifecycleLabel(row)}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {row.delivery_status}
                      {row.delivery_error ? ` · ${row.delivery_error}` : ""}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {new Date(row.expires_at).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 text-right space-x-1">
                      {open && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => void copyLink(row)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => void shareLink(row)}>
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === row.id}
                            onClick={() => void handleResend(row)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={busyId === row.id}
                            onClick={() => void handleRevokeInvite(row.id)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
