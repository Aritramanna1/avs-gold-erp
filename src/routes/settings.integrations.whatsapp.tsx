/**
 * Settings → Integrations → WhatsApp (WasenderAPI)
 *
 * Configures the WasenderAPI WhatsApp integration. The Personal Access Token
 * is stored ENCRYPTED in the Electron main process (never in the renderer, DB,
 * or this component's state after saving) — see electron/wasender.ts. All
 * session management (list/connect/disconnect/restart/status/QR) is proxied
 * through the same secured bridge.
 *
 * When enabled, WasenderAPI becomes the primary WhatsApp provider; the ERP's
 * existing deep-link provider is retained as an automatic fallback, so no
 * message path breaks if the API is disabled or unreachable.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useCurrentBranchId } from "@/lib/branch-store";
import { useCommSettings } from "@/lib/comm/comm-settings-store";
import { WHATSAPP_KEYS } from "@/lib/comm/types";
import {
  wasenderClient,
  isWasenderBridgeAvailable,
  WASENDER_DEFAULT_BASE_URL,
  type WasenderSession,
  type WasenderSessionStatus,
} from "@/lib/comm/wasender-client";
import {
  Wifi,
  WifiOff,
  Save,
  TestTube,
  Loader2,
  KeyRound,
  QrCode,
  RefreshCw,
  Trash2,
  Link2,
  Link2Off,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/integrations/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp (WasenderAPI) · AVS Gold ERP" }] }),
  component: WhatsAppIntegrationPage,
});

const STATUS_BADGE: Record<WasenderSessionStatus, { label: string; cls: string }> = {
  connected: { label: "Connected", cls: "border-emerald-500/40 text-emerald-300" },
  connecting: { label: "Connecting…", cls: "border-amber-500/40 text-amber-300" },
  need_scan: { label: "Waiting for QR", cls: "border-amber-500/40 text-amber-300" },
  need_passkey: { label: "Waiting for Passkey", cls: "border-amber-500/40 text-amber-300" },
  disconnected: { label: "Disconnected", cls: "border-red-500/40 text-red-300" },
  error: { label: "Error", cls: "border-red-500/40 text-red-300" },
  unknown: { label: "Unknown", cls: "border-border text-muted-foreground" },
};

function WhatsAppIntegrationPage() {
  const branchId = useCurrentBranchId();
  const existing = useCommSettings((s) => s.getWasenderConfig(branchId));
  const setWasender = useCommSettings((s) => s.setWasender);

  const bridgeAvailable = isWasenderBridgeAvailable();

  const [enabled, setEnabled] = useState(existing?.isActive ?? false);
  const [baseUrl, setBaseUrl] = useState(
    existing?.settings[WHATSAPP_KEYS.apiBaseUrl] || WASENDER_DEFAULT_BASE_URL,
  );
  const [session, setSession] = useState(existing?.settings[WHATSAPP_KEYS.wasenderSession] || "");
  const [token, setToken] = useState("");
  const [tokenSet, setTokenSet] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sessions, setSessions] = useState<WasenderSession[]>([]);
  const [qr, setQr] = useState<{ id: string | number; src: string } | null>(null);

  useEffect(() => {
    wasenderClient.setBaseUrl(baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    void wasenderClient.hasToken().then(setTokenSet);
    void wasenderClient.hasApiKey().then(setApiKeySet);
  }, []);

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const saveToken = () =>
    withBusy("token", async () => {
      if (!token.trim()) {
        toast.error("Enter a Personal Access Token first");
        return;
      }
      const res = await wasenderClient.saveToken(token.trim());
      if (!res.ok) {
        toast.error("Could not store the token");
        return;
      }
      setToken("");
      setTokenSet(true);
      toast.success(
        res.encrypted
          ? "Token saved (encrypted)"
          : "Token saved (unencrypted — OS keychain unavailable)",
      );
    });

  const clearToken = () =>
    withBusy("token", async () => {
      await wasenderClient.clearToken();
      setTokenSet(false);
      toast.success("Token removed");
    });

  const saveApiKey = () =>
    withBusy("apikey", async () => {
      if (!apiKey.trim()) {
        toast.error("Enter the session API Key first");
        return;
      }
      const res = await wasenderClient.saveApiKey(apiKey.trim());
      if (!res.ok) {
        toast.error("Could not store the API Key");
        return;
      }
      setApiKey("");
      setApiKeySet(true);
      toast.success(
        res.encrypted
          ? "API Key saved (encrypted)"
          : "API Key saved (unencrypted — OS keychain unavailable)",
      );
    });

  const clearApiKey = () =>
    withBusy("apikey", async () => {
      await wasenderClient.clearApiKey();
      setApiKeySet(false);
      toast.success("API Key removed");
    });

  const save = () => {
    setWasender(branchId, { enabled, baseUrl, session });
    toast.success("WhatsApp integration settings saved");
  };

  const testConnection = () =>
    withBusy("test", async () => {
      const res = await wasenderClient.testConnection();
      if (!res.ok) {
        toast.error(`Test failed: ${res.error ?? `HTTP ${res.status}`}`);
        return;
      }
      // Populate the session panel too, so a successful test is actionable.
      setSessions(res.sessions);
      const accountMsg =
        res.accounts.length > 0
          ? `Connected — ${res.accounts.join(", ")}`
          : `Token valid — ${res.sessions.length} session(s), none connected yet`;
      toast.success(accountMsg);
    });

  const listSessions = () =>
    withBusy("list", async () => {
      const list = await wasenderClient.listSessions();
      setSessions(list);
      if (list.length === 0) toast.info("No sessions returned (check token / base URL)");
    });

  const sessionAction = (
    key: string,
    id: string | number,
    fn: () => Promise<{ ok: boolean; error?: string; status: number }>,
    okMsg: string,
  ) =>
    withBusy(`${key}-${id}`, async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        await listSessions();
      } else {
        toast.error(res.error ?? `HTTP ${res.status}`);
      }
    });

  const showQr = (id: string | number) =>
    withBusy(`qr-${id}`, async () => {
      const raw = await wasenderClient.qrCode(id);
      if (!raw) {
        toast.error("No QR available (session may already be connected)");
        return;
      }
      const src = raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
      setQr({ id, src });
    });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="WhatsApp Integration (WasenderAPI)"
        subtitle="Send order slips, job cards, bills and ledgers over WhatsApp automatically."
      />

      {!bridgeAvailable && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-200">
          The WasenderAPI integration requires the desktop app (token security runs in the Electron
          main process). In the browser build the ERP falls back to WhatsApp deep links.
        </div>
      )}

      {/* Enable + credentials */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-serif text-lg text-gold">Enable WhatsApp Integration</div>
            <div className="text-xs text-muted-foreground">
              When on, WasenderAPI is the primary sender; deep links stay as automatic fallback.
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!bridgeAvailable} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Base URL</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={WASENDER_DEFAULT_BASE_URL}
              className="text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Default Session</Label>
            <Input
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="e.g. main"
              className="text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> Personal Access Token
            {tokenSet && (
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-300 text-[10px]"
              >
                Stored (encrypted)
              </Badge>
            )}
          </Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={tokenSet ? "•••••••• (leave blank to keep)" : "Paste token"}
              className="text-xs font-mono"
              disabled={!bridgeAvailable}
            />
            <Button size="sm" onClick={saveToken} disabled={!bridgeAvailable || busy === "token"}>
              {busy === "token" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Token"}
            </Button>
            {tokenSet && (
              <Button
                size="sm"
                variant="outline"
                onClick={clearToken}
                disabled={busy === "token"}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            The token is encrypted with the OS keychain and never leaves the desktop app's main
            process — it is never exposed to the page, stored in the database, or synced to the
            cloud.
          </p>
        </div>

        {/* Session API Key — the credential WasenderAPI's send-message endpoint requires. */}
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" /> Session API Key
            {apiKeySet && (
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-300 text-[10px]"
              >
                Stored (encrypted)
              </Badge>
            )}
          </Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeySet ? "•••••••• (leave blank to keep)" : "Paste session API Key"}
              className="text-xs font-mono"
              disabled={!bridgeAvailable}
            />
            <Button size="sm" onClick={saveApiKey} disabled={!bridgeAvailable || busy === "apikey"}>
              {busy === "apikey" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save API Key"}
            </Button>
            {apiKeySet && (
              <Button
                size="sm"
                variant="outline"
                onClick={clearApiKey}
                disabled={busy === "apikey"}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Required to <strong>send</strong> messages. In the WasenderAPI dashboard open{" "}
            <strong>WhatsApp Sessions → your session → API Key</strong> and paste it here. This is a
            different credential from the Personal Access Token above (which only manages sessions);
            sending with the Personal Access Token returns “401 Invalid API Key”. Stored encrypted,
            same as the token.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={save} className="gap-1.5 bg-gold text-black hover:bg-gold/90">
            <Save className="h-4 w-4" /> Save Settings
          </Button>
          <Button
            variant="outline"
            onClick={testConnection}
            disabled={!bridgeAvailable || busy === "test"}
            className="gap-1.5"
          >
            {busy === "test" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}
            Test Connection
          </Button>
          <Button
            variant="outline"
            onClick={listSessions}
            disabled={!bridgeAvailable || busy === "list"}
            className="gap-1.5"
          >
            {busy === "list" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            List Sessions
          </Button>
        </div>
      </section>

      {/* Sessions */}
      {sessions.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="font-serif text-lg text-gold">Sessions</div>
          {sessions.map((sess) => {
            const badge = STATUS_BADGE[sess.status];
            return (
              <div
                key={String(sess.id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    {sess.status === "connected" ? (
                      <Wifi className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    {sess.name || `Session ${sess.id}`}
                    <Badge variant="outline" className={`text-[10px] ${badge.cls}`}>
                      {badge.label}
                    </Badge>
                  </div>
                  {sess.phone_number && (
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {sess.phone_number}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sess.status === "connected" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-8 border-emerald-500/40 text-emerald-300"
                      disabled
                    >
                      <Link2 className="h-3.5 w-3.5" /> Connected
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-8"
                      onClick={() =>
                        sessionAction(
                          "connect",
                          sess.id,
                          () => wasenderClient.connect(sess.id),
                          "Connecting…",
                        )
                      }
                      disabled={busy === `connect-${sess.id}`}
                    >
                      <Link2 className="h-3.5 w-3.5" /> Connect
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs h-8"
                    onClick={() =>
                      sessionAction(
                        "disconnect",
                        sess.id,
                        () => wasenderClient.disconnect(sess.id),
                        "Disconnected",
                      )
                    }
                    disabled={busy === `disconnect-${sess.id}`}
                  >
                    <Link2Off className="h-3.5 w-3.5" /> Disconnect
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs h-8"
                    onClick={() => showQr(sess.id)}
                    disabled={busy === `qr-${sess.id}`}
                  >
                    <QrCode className="h-3.5 w-3.5" /> QR
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs h-8"
                    onClick={() =>
                      sessionAction(
                        "restart",
                        sess.id,
                        () => wasenderClient.restart(sess.id),
                        "Restarted",
                      )
                    }
                    disabled={busy === `restart-${sess.id}`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Restart
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* QR modal-ish inline */}
      {qr && (
        <section className="rounded-2xl border border-border bg-card p-5 text-center space-y-3">
          <div className="font-serif text-lg text-gold">
            Scan to Connect — Session {String(qr.id)}
          </div>
          <img
            src={qr.src}
            alt="WhatsApp QR"
            className="mx-auto h-56 w-56 bg-white p-2 rounded-lg"
          />
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => showQr(qr.id)} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Refresh QR
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setQr(null)}>
              Close
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
