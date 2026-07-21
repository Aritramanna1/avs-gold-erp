/**
 * WasenderAPI client (renderer side).
 *
 * The ONE place that knows WasenderAPI's REST shape. Every call is proxied to
 * the Electron main process (window.mtjDesktop.wasender), which holds the
 * encrypted token and performs the actual HTTPS request — the token is never
 * present in the renderer. This is also the REST/MCP swap seam: to move to the
 * WasenderAPI MCP server later, reimplement these methods against MCP without
 * touching any ERP module or the provider.
 *
 * Endpoint paths are centralized in WASENDER_ENDPOINTS so a WasenderAPI change
 * is a one-line edit, not a hunt across the codebase.
 */

export const WASENDER_DEFAULT_BASE_URL = "https://www.wasenderapi.com/api";

/** Adjust here if WasenderAPI renames a route — nothing else needs to change. */
export const WASENDER_ENDPOINTS = {
  sendMessage: "/send-message",
  uploadMedia: "/upload",
  sessions: "/whatsapp-sessions",
  session: (id: string | number) => `/whatsapp-sessions/${id}`,
  connect: (id: string | number) => `/whatsapp-sessions/${id}/connect`,
  disconnect: (id: string | number) => `/whatsapp-sessions/${id}/disconnect`,
  restart: (id: string | number) => `/whatsapp-sessions/${id}/restart`,
  status: (id: string | number) => `/whatsapp-sessions/${id}/status`,
  qrcode: (id: string | number) => `/whatsapp-sessions/${id}/qrcode`,
  regenerate: (id: string | number) => `/whatsapp-sessions/${id}/regenerate-token`,
} as const;

export type WasenderSessionStatus =
  | "connected"
  | "disconnected"
  | "need_scan" // waiting for QR
  | "need_passkey" // waiting for passkey
  | "connecting"
  | "error"
  | "unknown";

export interface WasenderSession {
  id: string | number;
  name?: string;
  phone_number?: string;
  status: WasenderSessionStatus;
  raw?: unknown;
}

export interface WasenderCallResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
}

interface DesktopWasender {
  setToken: (token: string) => Promise<{ ok: boolean; encrypted: boolean }>;
  clearToken: () => Promise<{ ok: boolean }>;
  hasToken: () => Promise<boolean>;
  setApiKey: (key: string) => Promise<{ ok: boolean; encrypted: boolean }>;
  clearApiKey: () => Promise<{ ok: boolean }>;
  hasApiKey: () => Promise<boolean>;
  request: (args: {
    baseUrl: string;
    method?: string;
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
    timeoutMs?: number;
    useApiKey?: boolean;
  }) => Promise<{ ok: boolean; status: number; data: unknown; error?: string }>;
}

/** The bridge is only present in the Electron desktop build. */
export function desktopWasender(): DesktopWasender | null {
  const w = window as unknown as { mtjDesktop?: { wasender?: DesktopWasender } };
  return w.mtjDesktop?.wasender ?? null;
}

/** True only in the desktop build with the bridge available. */
export function isWasenderBridgeAvailable(): boolean {
  return desktopWasender() !== null;
}

/** Normalise WasenderAPI's various status strings to our small enum. */
function normalizeStatus(raw: unknown): WasenderSessionStatus {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("connect") && !s.includes("dis"))
    return s.includes("ing") ? "connecting" : "connected";
  if (s.includes("scan") || s.includes("qr")) return "need_scan";
  if (s.includes("passkey") || s.includes("pair")) return "need_passkey";
  if (s.includes("disconnect") || s.includes("logout") || s.includes("close"))
    return "disconnected";
  if (s.includes("error") || s.includes("fail")) return "error";
  return "unknown";
}

export interface WasenderTestResult {
  ok: boolean;
  status: number;
  error?: string;
  /** Sessions returned by the API — proves the token + base URL are valid. */
  sessions: WasenderSession[];
  /** Connected WhatsApp account(s): phone numbers of connected sessions. */
  accounts: string[];
}

class WasenderClient {
  private base = WASENDER_DEFAULT_BASE_URL;

  setBaseUrl(url: string) {
    this.base = (url || WASENDER_DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  /** Store the Personal Access Token encrypted in the main process. */
  async saveToken(token: string) {
    const b = desktopWasender();
    if (!b) return { ok: false, encrypted: false };
    return b.setToken(token);
  }
  async clearToken() {
    const b = desktopWasender();
    if (!b) return { ok: false };
    return b.clearToken();
  }
  async hasToken() {
    const b = desktopWasender();
    if (!b) return false;
    return b.hasToken();
  }

  /** Store the per-session API Key (used to authenticate outbound messages). */
  async saveApiKey(key: string) {
    const b = desktopWasender();
    if (!b) return { ok: false, encrypted: false };
    return b.setApiKey(key);
  }
  async clearApiKey() {
    const b = desktopWasender();
    if (!b) return { ok: false };
    return b.clearApiKey();
  }
  async hasApiKey() {
    const b = desktopWasender();
    if (!b) return false;
    return b.hasApiKey();
  }

  private async call<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    useApiKey?: boolean,
  ): Promise<WasenderCallResult<T>> {
    const b = desktopWasender();
    if (!b) return { ok: false, status: 0, data: null as T, error: "Desktop bridge unavailable" };
    const res = await b.request({ baseUrl: this.base, method, path, body, useApiKey });
    return { ok: res.ok, status: res.status, data: res.data as T, error: res.error };
  }

  /**
   * "Test Connection": validates the Bearer token + base URL by retrieving the
   * session list, and surfaces the connected WhatsApp account(s). Returns a
   * meaningful error string when authentication fails.
   */
  async testConnection(): Promise<WasenderTestResult> {
    const res = await this.call<unknown>("GET", WASENDER_ENDPOINTS.sessions);
    if (!res.ok) {
      const err =
        res.status === 401 || res.status === 403
          ? "Authentication failed — check the Personal Access Token"
          : res.status === 0
            ? res.error || "Could not reach the API (check Base URL / internet)"
            : res.error || `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: err, sessions: [], accounts: [] };
    }
    const sessions = await this.listSessions();
    const accounts = sessions
      .filter((s) => s.status === "connected" && s.phone_number)
      .map((s) => s.phone_number as string);
    return { ok: true, status: res.status, sessions, accounts };
  }

  async listSessions(): Promise<WasenderSession[]> {
    const res = await this.call<unknown>("GET", WASENDER_ENDPOINTS.sessions);
    if (!res.ok) return [];
    // WasenderAPI may wrap the list under `data` or return a bare array.
    const arr = Array.isArray(res.data)
      ? res.data
      : Array.isArray((res.data as { data?: unknown[] })?.data)
        ? (res.data as { data: unknown[] }).data
        : [];
    return arr.map((r) => {
      const o = r as Record<string, unknown>;
      return {
        id: (o.id ?? o.session_id ?? o.name) as string | number,
        name: o.name as string | undefined,
        phone_number: (o.phone_number ?? o.phone) as string | undefined,
        status: normalizeStatus(o.status ?? o.connection_status ?? o.state),
        raw: r,
      };
    });
  }

  async sessionStatus(id: string | number): Promise<WasenderSessionStatus> {
    const res = await this.call<Record<string, unknown>>("GET", WASENDER_ENDPOINTS.status(id));
    if (!res.ok) return "unknown";
    return normalizeStatus(
      res.data?.status ??
        res.data?.state ??
        (res.data as { data?: { status?: unknown } })?.data?.status,
    );
  }

  async connect(id: string | number) {
    return this.call("POST", WASENDER_ENDPOINTS.connect(id));
  }
  async disconnect(id: string | number) {
    return this.call("POST", WASENDER_ENDPOINTS.disconnect(id));
  }
  async restart(id: string | number) {
    return this.call("POST", WASENDER_ENDPOINTS.restart(id));
  }
  async regenerate(id: string | number) {
    return this.call("POST", WASENDER_ENDPOINTS.regenerate(id));
  }
  async createSession(name: string, phone?: string) {
    return this.call("POST", WASENDER_ENDPOINTS.sessions, { name, phone_number: phone });
  }

  /** Fetch the QR (WasenderAPI returns a data URL or a raw string). */
  async qrCode(id: string | number): Promise<string | null> {
    const res = await this.call<Record<string, unknown>>("GET", WASENDER_ENDPOINTS.qrcode(id));
    if (!res.ok) return null;
    const d = res.data;
    if (typeof d === "string") return d;
    const q = (d?.qr ?? d?.qrcode ?? d?.data ?? d?.image) as unknown;
    return typeof q === "string" ? q : null;
  }

  /**
   * Send a plain WhatsApp text message. `to` = digits with country code.
   * Authenticated with the stored session API Key (not the account PAT) — the
   * messaging endpoint rejects the PAT with "401 Invalid API Key". The API Key
   * identifies the session, so no session id is sent in the body.
   */
  async sendText(to: string, text: string): Promise<WasenderCallResult> {
    return this.call("POST", WASENDER_ENDPOINTS.sendMessage, { to, text }, true);
  }

  /**
   * Send a document. WasenderAPI accepts a public URL (documentUrl); when a
   * URL is available (the ERP's print/upload service), that is used directly.
   * Text becomes the caption.
   */
  async sendDocument(
    to: string,
    documentUrl: string,
    fileName: string,
    caption?: string,
  ): Promise<WasenderCallResult> {
    return this.call(
      "POST",
      WASENDER_ENDPOINTS.sendMessage,
      { to, documentUrl, fileName, ...(caption ? { text: caption } : {}) },
      true,
    );
  }
}

export const wasenderClient = new WasenderClient();
