"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasApiKey = exports.clearApiKey = exports.setApiKey = exports.hasToken = exports.clearToken = exports.setToken = void 0;
exports.wasenderRequest = wasenderRequest;
exports.wasenderUploadMedia = wasenderUploadMedia;
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
const MAX_SECRET_LENGTH = 16_384;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
/** Persist a secret encrypted at rest. Falls back to a marked base64 blob only if the OS keychain is unavailable. */
function writeSecret(file, value) {
    if (typeof value !== "string")
        return { ok: false, encrypted: false };
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_SECRET_LENGTH || !electron_1.safeStorage.isEncryptionAvailable()) {
        return { ok: false, encrypted: false };
    }
    try {
        const temporary = `${file}.${process.pid}.tmp`;
        node_fs_1.default.writeFileSync(temporary, electron_1.safeStorage.encryptString(trimmed), { mode: 0o600 });
        node_fs_1.default.renameSync(temporary, file);
        return { ok: true, encrypted: true };
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
        if (!electron_1.safeStorage.isEncryptionAvailable())
            return null;
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
const hasToken = () => readSecret(TOKEN_FILE()) !== null;
exports.hasToken = hasToken;
const readToken = () => readSecret(TOKEN_FILE());
// ── Session API Key (messaging endpoints: /send-message) ──
const setApiKey = (key) => writeSecret(APIKEY_FILE(), key);
exports.setApiKey = setApiKey;
const clearApiKey = () => removeSecret(APIKEY_FILE());
exports.clearApiKey = clearApiKey;
const hasApiKey = () => readSecret(APIKEY_FILE()) !== null;
exports.hasApiKey = hasApiKey;
const readApiKey = () => readSecret(APIKEY_FILE());
/** One raw authenticated fetch. Resolves (never throws) into a WasenderResponse. */
async function doFetch(url, method, bearer, body, headers, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const encodedBody = body !== undefined ? JSON.stringify(body) : undefined;
        if (encodedBody && Buffer.byteLength(encodedBody, "utf8") > MAX_BODY_BYTES) {
            return { ok: false, status: 0, data: null, error: "Request payload is too large." };
        }
        const safeHeaders = Object.fromEntries(Object.entries(headers ?? {}).filter(([name]) => ["accept", "content-type"].includes(name.toLowerCase())));
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
    let url;
    try {
        const base = new URL(args.baseUrl);
        const trustedHost = base.hostname === "wasenderapi.com" || base.hostname.endsWith(".wasenderapi.com");
        if (base.protocol !== "https:" || !trustedHost || base.username || base.password) {
            throw new Error("Untrusted WasenderAPI endpoint.");
        }
        if (!args.path || args.path.startsWith("//") || args.path.includes("\\")) {
            throw new Error("Invalid WasenderAPI path.");
        }
        const relativePath = args.path.startsWith("/") ? args.path.slice(1) : args.path;
        url = new URL(relativePath, `${base.toString().replace(/\/+$/, "")}/`).toString();
    }
    catch (error) {
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
    const result = await doFetch(url, method, bearer, args.body, args.headers, Math.min(60_000, Math.max(1_000, args.timeoutMs ?? 20_000)));
    // Communication Log for debugging: full URL + payload + response, never a secret.
    if (!electron_1.app.isPackaged)
        console.log(`[wasender] ${method} ${url} -> ${result.status}`);
    return result;
}
/** Upload media (PDF/images) via WasenderAPI multipart /upload endpoint. */
async function wasenderUploadMedia(args) {
    const bearer = args.useApiKey ? readApiKey() : readApiKey() || readToken();
    if (!bearer) {
        return {
            ok: false,
            status: 0,
            error: "No WasenderAPI key configured for media upload.",
        };
    }
    let url;
    try {
        const base = new URL(args.baseUrl || "https://www.wasenderapi.com/api");
        const trustedHost = base.hostname === "wasenderapi.com" || base.hostname.endsWith(".wasenderapi.com");
        if (base.protocol !== "https:" || !trustedHost) {
            throw new Error("Untrusted WasenderAPI endpoint.");
        }
        url = new URL("upload", `${base.toString().replace(/\/+$/, "")}/`).toString();
    }
    catch (err) {
        return { ok: false, status: 0, error: err?.message || "Invalid upload endpoint." };
    }
    try {
        const buffer = Buffer.from(args.base64Data, "base64");
        const blob = new Blob([buffer], { type: args.mimeType || "application/pdf" });
        const formData = new FormData();
        formData.append("file", blob, args.fileName || "document.pdf");
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${bearer}`,
            },
            body: formData,
        });
        const resText = await res.text();
        let resJson = null;
        try {
            resJson = resText ? JSON.parse(resText) : null;
        }
        catch { }
        const publicUrl = resJson?.url ||
            resJson?.fileUrl ||
            resJson?.mediaUrl ||
            resJson?.link ||
            resJson?.data?.url ||
            resJson?.data?.link ||
            resJson?.data?.fileUrl;
        if (!res.ok || !publicUrl) {
            const errMsg = resJson?.message || resJson?.error || apiError(res.status, resJson ?? resText);
            console.error(`[wasender-upload-failed] ${url} HTTP ${res.status}:`, resText, "Validation errors:", resJson?.errors || resJson?.validation);
            return {
                ok: false,
                status: res.status,
                requestUrl: url,
                responseBody: resJson ?? resText,
                error: `WasenderAPI Upload failed (${res.status}): ${errMsg}`,
            };
        }
        if (!electron_1.app.isPackaged)
            console.log(`[wasender-upload-success] ${url} -> ${publicUrl}`);
        return {
            ok: true,
            status: res.status,
            url: publicUrl,
            responseBody: resJson,
            requestUrl: url,
        };
    }
    catch (err) {
        console.error(`[wasender-upload-error] ${url}:`, err);
        return {
            ok: false,
            status: 0,
            requestUrl: url,
            error: err?.message || String(err),
        };
    }
}
