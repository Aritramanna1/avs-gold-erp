/**
 * WasenderAPI bridge — MAIN PROCESS ONLY.
 *
 * Security posture (per spec): the Personal Access Token never reaches the
 * renderer. It is written to disk encrypted with Electron `safeStorage`
 * (OS-backed keychain/DPAPI) and only decrypted here, in the main process,
 * for the moment of an outbound HTTPS call. The renderer can ask us to store a
 * token, to forget it, and to make an authenticated request — it can never
 * read the token back.
 *
 * Every WasenderAPI call is proxied through `wasenderRequest`, so the renderer
 * owns the endpoint knowledge (paths/bodies) while the main process owns the
 * secret and the network egress. Responses are shape-validated (JSON or text)
 * and the token is never echoed back.
 */
import { app, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";

const secretFile = (name: string) => path.join(app.getPath("userData"), `wasender-${name}.enc`);
const TOKEN_FILE = () => secretFile("token"); // account Personal Access Token
const APIKEY_FILE = () => secretFile("apikey"); // per-session API Key (messaging)
const MAX_SECRET_LENGTH = 16_384;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/** Persist a secret encrypted at rest. Falls back to a marked base64 blob only if the OS keychain is unavailable. */
function writeSecret(file: string, value: string): { ok: boolean; encrypted: boolean } {
  if (typeof value !== "string") return { ok: false, encrypted: false };
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_SECRET_LENGTH || !safeStorage.isEncryptionAvailable()) {
    return { ok: false, encrypted: false };
  }
  try {
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, safeStorage.encryptString(trimmed), { mode: 0o600 });
    fs.renameSync(temporary, file);
    return { ok: true, encrypted: true };
  } catch {
    return { ok: false, encrypted: false };
  }
}

function removeSecret(file: string): { ok: boolean } {
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function readSecret(file: string): string | null {
  try {
    if (!fs.existsSync(file)) return null;
    const buf = fs.readFileSync(file);
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

// ── Account Personal Access Token (management endpoints: session list, connect, QR) ──
export const setToken = (token: string) => writeSecret(TOKEN_FILE(), token);
export const clearToken = () => removeSecret(TOKEN_FILE());
export const hasToken = () => readSecret(TOKEN_FILE()) !== null;
const readToken = () => readSecret(TOKEN_FILE());

// ── Session API Key (messaging endpoints: /send-message) ──
export const setApiKey = (key: string) => writeSecret(APIKEY_FILE(), key);
export const clearApiKey = () => removeSecret(APIKEY_FILE());
export const hasApiKey = () => readSecret(APIKEY_FILE()) !== null;
const readApiKey = () => readSecret(APIKEY_FILE());

export interface WasenderRequestArgs {
  baseUrl: string;
  method?: string;
  /** Path appended to baseUrl, e.g. "/send-message" or "/whatsapp-sessions". */
  path: string;
  body?: unknown;
  /** Extra headers (never Authorization — that's injected here from the stored token). */
  headers?: Record<string, string>;
  timeoutMs?: number;
  /**
   * When true, this request is signed with the stored *session API Key* instead
   * of the account Personal Access Token. WasenderAPI's messaging endpoints
   * (/send-message) require the session API Key and reject the PAT with
   * "401 Invalid API Key". Management endpoints (session list, connect, QR)
   * leave this false and keep using the PAT.
   */
  useApiKey?: boolean;
}

export interface WasenderResponse {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}

/** One raw authenticated fetch. Resolves (never throws) into a WasenderResponse. */
async function doFetch(
  url: string,
  method: string,
  bearer: string,
  body: unknown,
  headers: Record<string, string> | undefined,
  timeoutMs: number,
): Promise<WasenderResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const encodedBody = body !== undefined ? JSON.stringify(body) : undefined;
    if (encodedBody && Buffer.byteLength(encodedBody, "utf8") > MAX_BODY_BYTES) {
      return { ok: false, status: 0, data: null, error: "Request payload is too large." };
    }
    const safeHeaders = Object.fromEntries(
      Object.entries(headers ?? {}).filter(([name]) =>
        ["accept", "content-type"].includes(name.toLowerCase()),
      ),
    );
    const res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...safeHeaders,
        Authorization: `Bearer ${bearer}`,
      },
      body: encodedBody,
      signal: controller.signal,
    });
    const declaredLength = Number(res.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_RESPONSE_BYTES) {
      await res.body?.cancel();
      return { ok: false, status: res.status, data: null, error: "API response is too large." };
    }
    const text = await res.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
      return { ok: false, status: res.status, data: null, error: "API response is too large." };
    }
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON response (e.g. a QR image string) — keep the raw text */
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? undefined : apiError(res.status, data),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Surface the API's own message (not just "HTTP 400") so the UI can show it. */
function apiError(status: number, data: unknown): string {
  const o = data as Record<string, unknown> | null;
  const msg =
    (typeof o?.message === "string" && o.message) ||
    (typeof o?.error === "string" && o.error) ||
    (typeof data === "string" && data) ||
    "";
  return msg ? `HTTP ${status}: ${msg}` : `HTTP ${status}`;
}

/**
 * Perform an authenticated WasenderAPI request. Secrets are read+decrypted here
 * and attached as `Authorization: Bearer …`; they are never returned to the
 * caller. Messaging requests (`useApiKey`) are signed with the stored session
 * API Key; everything else uses the account Personal Access Token. Network/
 * timeout/HTTP errors resolve (never throw) so the renderer's queue can treat a
 * failure as "retry later" rather than a crash.
 */
export async function wasenderRequest(args: WasenderRequestArgs): Promise<WasenderResponse> {
  const bearer = args.useApiKey ? readApiKey() : readToken();
  if (!bearer) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: args.useApiKey
        ? "No session API Key configured — enter it in Settings → WhatsApp"
        : "No Personal Access Token configured",
    };
  }

  let url: string;
  try {
    const base = new URL(args.baseUrl);
    const trustedHost =
      base.hostname === "wasenderapi.com" || base.hostname.endsWith(".wasenderapi.com");
    if (base.protocol !== "https:" || !trustedHost || base.username || base.password) {
      throw new Error("Untrusted WasenderAPI endpoint.");
    }
    if (!args.path || args.path.startsWith("//") || args.path.includes("\\")) {
      throw new Error("Invalid WasenderAPI path.");
    }
    const relativePath = args.path.startsWith("/") ? args.path.slice(1) : args.path;
    url = new URL(relativePath, `${base.toString().replace(/\/+$/, "")}/`).toString();
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : "Invalid WasenderAPI endpoint.",
    };
  }
  const method = (args.method ?? "GET").toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return { ok: false, status: 0, data: null, error: "Unsupported HTTP method." };
  }

  const result = await doFetch(
    url,
    method,
    bearer,
    args.body,
    args.headers,
    Math.min(60_000, Math.max(1_000, args.timeoutMs ?? 20_000)),
  );

  // Communication Log for debugging: full URL + payload + response, never a secret.
  if (!app.isPackaged) console.log(`[wasender] ${method} ${url} -> ${result.status}`);

  return result;
}
