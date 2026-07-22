/**
 * Web-safe WhatsApp provider seam.
 *
 * Credentials and provider calls must be implemented by a Supabase Edge
 * Function. The browser never stores provider secrets or calls a desktop
 * bridge. Until that cloud function is configured, manual wa.me messaging
 * remains available and automated sends fail safely.
 */

export const WASENDER_DEFAULT_BASE_URL = "https://www.wasenderapi.com/api";
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

import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type WasenderSessionStatus =
  "connected" | "disconnected" | "need_scan" | "need_passkey" | "connecting" | "error" | "unknown";

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
  retryCount?: number;
}

export interface WasenderTestResult {
  ok: boolean;
  status: number;
  error?: string;
  sessions: WasenderSession[];
  accounts: string[];
}

const WEB_PROVIDER_MESSAGE =
  "Automated WhatsApp delivery is not configured. Add WASENDER_API_KEY to the Supabase Edge Function secrets.";

async function invokeCloud(body: Record<string, unknown>): Promise<WasenderCallResult<any>> {
  const { data, error } = await supabase.functions.invoke("whatsapp-send", { body });
  if (error) return { ok: false, status: 502, data: null, error: error.message };
  const payload = (data ?? {}) as any;
  return {
    ok: payload.success !== false && !payload.error,
    status: 200,
    data: payload,
    error: payload.error,
  };
}

function unavailable<T = null>(): WasenderCallResult<T> {
  return { ok: false, status: 501, data: null as T, error: WEB_PROVIDER_MESSAGE };
}

class WasenderClient {
  setBaseUrl(_url: string): void {}
  async saveToken(_token: string) {
    return { ok: false, encrypted: false, error: WEB_PROVIDER_MESSAGE };
  }
  async clearToken() {
    return { ok: true };
  }
  async hasToken() {
    return false;
  }
  async saveApiKey(_key: string) {
    return { ok: false, encrypted: false, error: WEB_PROVIDER_MESSAGE };
  }
  async clearApiKey() {
    return { ok: true };
  }
  async hasApiKey() {
    return false;
  }
  async testConnection(): Promise<WasenderTestResult> {
    return { ok: false, status: 501, error: WEB_PROVIDER_MESSAGE, sessions: [], accounts: [] };
  }
  async listSessions(): Promise<WasenderSession[]> {
    return [];
  }
  async sessionStatus(_id: string | number): Promise<WasenderSessionStatus> {
    return "unknown";
  }
  async connect(_id: string | number) {
    return unavailable();
  }
  async disconnect(_id: string | number) {
    return unavailable();
  }
  async restart(_id: string | number) {
    return unavailable();
  }
  async regenerate(_id: string | number) {
    return unavailable();
  }
  async createSession(_name: string, _phone?: string) {
    return unavailable();
  }
  async qrCode(_id: string | number): Promise<string | null> {
    return null;
  }
  async sendText(to: string, text: string): Promise<WasenderCallResult> {
    return invokeCloud({ to, text });
  }
  async sendDocument(to: string, documentUrl: string, fileName: string, caption?: string) {
    return invokeCloud({ to, documentUrl, fileName, text: caption ?? "" });
  }
  async uploadMedia(_blob: Blob, _fileName: string, _mimeType = "application/pdf") {
    const base64 = await blobToDataUrl(_blob);
    const result = await invokeCloud({
      uploadOnly: true,
      base64,
      fileName: _fileName,
      mimeType: _mimeType,
    });
    return {
      ok: result.ok,
      status: result.status,
      error: result.error,
      raw: result.data,
      url: result.data?.publicUrl ?? "",
    };
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

export const wasenderClient = new WasenderClient();
export function isWasenderBridgeAvailable(): boolean {
  return true;
}
