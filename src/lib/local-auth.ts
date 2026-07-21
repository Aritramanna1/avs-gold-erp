/**
 * Local Authentication (Deployment Modes — Offline Mode).
 *
 * Verifies credentials entirely against the local encrypted SQLite DB
 * (`local_users` table) — zero network calls, unlike Supabase auth. Password
 * hashing uses PBKDF2-SHA256 via Web Crypto, the same crypto surface already
 * used for the DB's own AES-GCM encryption and HMAC audit-chain signing in
 * local-db.ts/key-management.ts — no new dependency (bcrypt/argon2) needed.
 */
import { runLocal, selectAllLive, selectById, upsertRow, initLocalDb } from "@/lib/local-db";
import { append as appendAudit } from "@/lib/security/audit-log";
import { getOrCreateDeviceId } from "@/lib/security/device-registry";
import { getDeploymentMode } from "@/lib/deployment-mode";

const PBKDF2_ITERATIONS = 150_000;

export interface LocalUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  branchId: string | null;
  active: boolean;
  isSuperOwner: boolean;
  failedLoginCount: number;
  lastPasswordChange: string | null;
  createdAt: string;
  updatedAt: string;
}

function toLocalUser(row: Record<string, unknown>): LocalUser {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    role: String(row.role ?? ""),
    branchId: row.branch_id ? String(row.branch_id) : null,
    active: Boolean(row.active),
    isSuperOwner: Boolean(row.is_super_owner),
    failedLoginCount: Number(row.failed_login_count ?? 0),
    lastPasswordChange: row.last_password_change ? String(row.last_password_change) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...arr));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function derivePasswordHash(password: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return toBase64(derived);
}

async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return { hash, salt: toBase64(salt) };
}

async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const candidate = await derivePasswordHash(password, fromBase64(salt));
  if (candidate.length !== hash.length) return false;
  // Constant-time-ish comparison — avoids leaking match length via early-exit
  // string equality, cheap enough at 256-bit length that a simple XOR-fold is
  // sufficient here (no dedicated timing-safe-compare utility exists in this
  // codebase or the Web Crypto API itself).
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

export async function listLocalUsers(): Promise<LocalUser[]> {
  await initLocalDb();
  return selectAllLive("local_users").map(toLocalUser);
}

export async function hasAnyLocalUser(): Promise<boolean> {
  await initLocalDb();
  return selectAllLive("local_users").length > 0;
}

export async function createLocalUser(input: {
  name: string;
  email: string;
  phone?: string;
  role: string;
  branchId?: string | null;
  password: string;
  isSuperOwner?: boolean;
}): Promise<LocalUser> {
  const email = input.email.trim().toLowerCase();
  if (!input.role.trim()) throw new Error("A role must be assigned to every user.");
  await initLocalDb();
  const existing = selectAllLive("local_users");
  if (existing.some((row: any) => String(row.email).toLowerCase() === email)) {
    throw new Error(`A local user with email ${email} already exists.`);
  }
  const { hash, salt } = await hashPassword(input.password);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const user: LocalUser = {
    id,
    name: input.name.trim(),
    email,
    phone: input.phone?.trim() ?? "",
    role: input.role,
    branchId: input.branchId ?? null,
    active: true,
    isSuperOwner: !!input.isSuperOwner,
    failedLoginCount: 0,
    lastPasswordChange: now,
    createdAt: now,
    updatedAt: now,
  };
  await runLocal(() =>
    upsertRow("local_users", {
      id,
      name: user.name,
      email,
      phone: user.phone,
      role: user.role,
      branch_id: user.branchId,
      password_hash: hash,
      password_salt: salt,
      last_password_change: now,
      failed_login_count: 0,
      active: true,
      is_super_owner: user.isSuperOwner,
      created_at: now,
      updated_at: now,
    }),
  );
  return user;
}

async function setFailedLoginCount(row: Record<string, unknown>, count: number): Promise<void> {
  await runLocal(() => upsertRow("local_users", { ...row, failed_login_count: count }));
}

export async function verifyLocalLogin(
  email: string,
  password: string,
): Promise<{ ok: boolean; user?: LocalUser; error?: string }> {
  await initLocalDb();
  const normalizedEmail = email.trim().toLowerCase();
  const rows = selectAllLive("local_users") as Record<string, unknown>[];
  const row = rows.find((r) => String(r.email).toLowerCase() === normalizedEmail);
  if (!row) return { ok: false, error: "Invalid email or password." };
  if (!row.active) return { ok: false, error: "Your account is deactivated. Contact admin." };
  const valid = await verifyPassword(
    password,
    String(row.password_hash),
    String(row.password_salt),
  );
  if (!valid) {
    await setFailedLoginCount(row, Number(row.failed_login_count ?? 0) + 1);
    return { ok: false, error: "Invalid email or password." };
  }
  if (!String(row.role ?? "").trim()) {
    return { ok: false, error: "No role assigned to this account. Contact admin." };
  }
  if (Number(row.failed_login_count ?? 0) !== 0) await setFailedLoginCount(row, 0);
  return { ok: true, user: toLocalUser({ ...row, failed_login_count: 0 }) };
}

export async function changeLocalPassword(userId: string, newPassword: string): Promise<void> {
  const row = await runLocal(() => selectById("local_users", userId));
  if (!row) throw new Error("Local user not found.");
  const { hash, salt } = await hashPassword(newPassword);
  const now = new Date().toISOString();
  await runLocal(() =>
    upsertRow("local_users", {
      ...row,
      password_hash: hash,
      password_salt: salt,
      last_password_change: now,
      updated_at: now,
    }),
  );
  await appendAudit({
    actorId: userId,
    actorEmail: String(row.email ?? "") || null,
    action: "auth.password_change",
    entityType: "user",
    entityId: userId,
  });
}

export async function setLocalUserActive(userId: string, active: boolean): Promise<void> {
  const row = await runLocal(() => selectById("local_users", userId));
  if (!row) throw new Error("Local user not found.");
  await runLocal(() =>
    upsertRow("local_users", { ...row, active, updated_at: new Date().toISOString() }),
  );
}

// ---- Local session ----
// No JWT/expiry machinery: this is a single-device local credential, not a
// federated token. The session row lives in `user_sessions` (SAD §5: user,
// role, branch, login time, device id, deployment mode); localStorage holds
// only the pointer to it, so a relaunch stays logged in without re-verifying
// the password (same mechanism Supabase's own SDK uses to persist sessions).
const LOCAL_SESSION_KEY = "mtj_erp_local_session_user_id";
const LOCAL_SESSION_ID_KEY = "mtj_erp_local_session_id";

export function getLocalSessionUserId(): string | null {
  return window.localStorage.getItem(LOCAL_SESSION_KEY);
}

/** Login service: records the session (SAD §5) and audits it (BFS §20). */
export async function setLocalSession(userId: string): Promise<void> {
  const row = await runLocal(() => selectById("local_users", userId));
  if (!row) throw new Error("Local user not found.");
  const sessionId = crypto.randomUUID();
  const deviceId = await getOrCreateDeviceId();
  const mode = await getDeploymentMode();
  await runLocal(() =>
    upsertRow("user_sessions", {
      id: sessionId,
      user_id: userId,
      role: String(row.role ?? ""),
      branch_id: row.branch_id ?? null,
      login_at: new Date().toISOString(),
      ended_at: null,
      device_id: deviceId,
      deployment_mode: mode,
    }),
  );
  window.localStorage.setItem(LOCAL_SESSION_KEY, userId);
  window.localStorage.setItem(LOCAL_SESSION_ID_KEY, sessionId);
  await appendAudit({
    actorId: userId,
    actorEmail: String(row.email ?? "") || null,
    action: "auth.login",
    entityType: "user_session",
    entityId: sessionId,
    deviceId,
  });
}

/** Logout service: ends the session row, clears the marker, audits it. */
export async function clearLocalSession(): Promise<void> {
  const sessionId = window.localStorage.getItem(LOCAL_SESSION_ID_KEY);
  const userId = getLocalSessionUserId();
  window.localStorage.removeItem(LOCAL_SESSION_KEY);
  window.localStorage.removeItem(LOCAL_SESSION_ID_KEY);
  if (!sessionId) return;
  const row = await runLocal(() => selectById("user_sessions", sessionId));
  if (row) {
    await runLocal(() =>
      upsertRow("user_sessions", { ...row, ended_at: new Date().toISOString() }),
    );
  }
  await appendAudit({
    actorId: userId,
    actorEmail: null,
    action: "auth.logout",
    entityType: "user_session",
    entityId: sessionId,
  });
}

export async function getLocalSessionUser(): Promise<LocalUser | null> {
  const userId = getLocalSessionUserId();
  if (!userId) return null;
  await initLocalDb();
  const row = selectById("local_users", userId);
  if (!row || !row.active) return null;
  return toLocalUser(row);
}
