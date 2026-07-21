"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasApiKey = exports.clearApiKey = exports.setApiKey = exports.hasToken = exports.clearToken = exports.setToken = void 0;
exports.wasenderRequest = wasenderRequest;
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
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const secretFile = (name) => node_path_1.default.join(electron_1.app.getPath("userData"), `wasender-${name}.enc`);
const TOKEN_FILE = () => secretFile("token"); // account Personal Access Token
const APIKEY_FILE = () => secretFile("apikey"); // per-session API Key (messaging)
/** Persist a secret encrypted at rest. Falls back to a marked base64 blob only if the OS keychain is unavailable. */
function writeSecret(file, value) {
    const trimmed = (value || "").trim();
    if (!trimmed)
        return { ok: false, encrypted: false };
    try {
        if (electron_1.safeStorage.isEncryptionAvailable()) {
            node_fs_1.default.writeFileSync(file, electron_1.safeStorage.encryptString(trimmed));
            return { ok: true, encrypted: true };
        }
        // Keychain unavailable (rare on Linux without a secret service) — store a
        // reversible blob so the feature still works, clearly marked as un-keyed.
        node_fs_1.default.writeFileSync(file, Buffer.from(`plain:${trimmed}`, "utf8"));
        return { ok: true, encrypted: false };
    }
    catch {
        return { ok: false, encrypted: false };
    }
}
function removeSecret(file) {
    try {
        if (node_fs_1.default.existsSync(file))
            node_fs_1.default.unlinkSync(file);
        return { ok: true };
    }
    catch {
        return { ok: false };
    }
}
function readSecret(file) {
    try {
        if (!node_fs_1.default.existsSync(file))
            return null;
        const buf = node_fs_1.default.readFileSync(file);
        const head = buf.subarray(0, 6).toString("utf8");
        if (head.startsWith("plain:"))
            return buf.toString("utf8").slice(6);
        return electron_1.safeStorage.decryptString(buf);
    }
    catch {
        return null;
    }
}
// ── Account Personal Access Token (management endpoints: session list, connect, QR) ──
const setToken = (token) => writeSecret(TOKEN_FILE(), token);
exports.setToken = setToken;
const clearToken = () => removeSecret(TOKEN_FILE());
exports.clearToken = clearToken;
const hasToken = () => node_fs_1.default.existsSync(TOKEN_FILE());
exports.hasToken = hasToken;
const readToken = () => readSecret(TOKEN_FILE());
// ── Session API Key (messaging endpoints: /send-message) ──
const setApiKey = (key) => writeSecret(APIKEY_FILE(), key);
exports.setApiKey = setApiKey;
const clearApiKey = () => removeSecret(APIKEY_FILE());
exports.clearApiKey = clearApiKey;
const hasApiKey = () => node_fs_1.default.existsSync(APIKEY_FILE());
exports.hasApiKey = hasApiKey;
const readApiKey = () => readSecret(APIKEY_FILE());
/** One raw authenticated fetch. Resolves (never throws) into a WasenderResponse. */
async function doFetch(url, method, bearer, body, headers, timeoutMs) {
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
        let data = text;
        try {
            data = text ? JSON.parse(text) : null;
        }
        catch {
            /* non-JSON response (e.g. a QR image string) — keep the raw text */
        }
        return {
            ok: res.ok,
            status: res.status,
            data,
            error: res.ok ? undefined : apiError(res.status, data),
        };
    }
    catch (err) {
        return {
            ok: false,
            status: 0,
            data: null,
            error: err instanceof Error ? err.message : String(err),
        };
    }
    finally {
        clearTimeout(timeout);
    }
}
/** Surface the API's own message (not just "HTTP 400") so the UI can show it. */
function apiError(status, data) {
    const o = data;
    const msg = (typeof o?.message === "string" && o.message) ||
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
async function wasenderRequest(args) {
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
    const result = await doFetch(url, method, bearer, args.body, args.headers, args.timeoutMs ?? 20000);
    // Communication Log for debugging: full URL + payload + response, never a secret.
    console.log(`[wasender] ${method} ${url}`, JSON.stringify({
        auth: args.useApiKey ? "session-api-key" : "personal-access-token",
        payload: args.body ?? null,
        status: result.status,
        response: result.data,
    }));
    return result;
}
