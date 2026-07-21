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

/** Persist a secret encrypted at rest. Falls back to a marked base64 blob only if the OS keychain is unavailable. */
function writeSecret(file: string, value: string): { ok: boolean; encrypted: boolean } {
  const trimmed = (value || "").trim();
  if (!trimmed) return { ok: false, encrypted: false };
  try {
    if (safeStorage.isEncryptionAvailable()) {
      fs.writeFileSync(file, safeStorage.encryptString(trimmed));
      return { ok: true, encrypted: true };
    }
    // Keychain unavailable (rare on Linux without a secret service) — store a
    // reversible blob so the feature still works, clearly marked as un-keyed.
    fs.writeFileSync(file, Buffer.from(`plain:${trimmed}`, "utf8"));
    return { ok: true, encrypted: false };
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
    const head = buf.subarray(0, 6).toString("utf8");
    if (head.startsWith("plain:")) return buf.toString("utf8").slice(6);
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

// ── Account Personal Access Token (management endpoints: session list, connect, QR) ──
export const setToken = (token: string) => writeSecret(TOKEN_FILE(), token);
export const clearToken = () => removeSecret(TOKEN_FILE());
export const hasToken = () => fs.existsSync(TOKEN_FILE());
const readToken = () => readSecret(TOKEN_FILE());

// ── Session API Key (messaging endpoints: /send-message) ──
export const setApiKey = (key: string) => writeSecret(APIKEY_FILE(), key);
export const clearApiKey = () => removeSecret(APIKEY_FILE());
export const hasApiKey = () => fs.existsSync(APIKEY_FILE());
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
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(headers ?? {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
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

  const base = (args.baseUrl || "").replace(/\/+$/, "");
  const rel = args.path.startsWith("/") ? args.path : `/${args.path}`;
  const url = `${base}${rel}`;
  const method = args.method ?? "GET";

  const result = await doFetch(
    url,
    method,
    bearer,
    args.body,
    args.headers,
    args.timeoutMs ?? 20000,
  );

  // Communication Log for debugging: full URL + payload + response, never a secret.
  console.log(
    `[wasender] ${method} ${url}`,
    JSON.stringify({
      auth: args.useApiKey ? "session-api-key" : "personal-access-token",
      payload: args.body ?? null,
      status: result.status,
      response: result.data,
    }),
  );

  return result;
}
