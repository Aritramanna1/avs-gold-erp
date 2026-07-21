/**
 * Local Authentication (Deployment Modes — Offline Mode).
 *
 * Verifies credentials entirely against the local encrypted SQLite DB
 * (`local_users` table) — zero network calls, unlike Supabase auth. Password
 * hashing uses PBKDF2-SHA256 via Web Crypto, the same crypto surface already
 * used for the DB's own AES-GCM encryption and HMAC audit-chain signing in
 * local-db.ts/key-management.ts — no new dependency (bcrypt/argon2) needed.
 */
import {
  runLocal,
  selectAllLive,
  selectById,
  upsertRow,
  initLocalDb,
  getMetaValue,
  setMetaValue,
} from "@/lib/local-db";
import { append as appendAudit } from "@/lib/security/audit-log";
import { getOrCreateDeviceId } from "@/lib/security/device-registry";
import { getDeploymentMode } from "@/lib/deployment-mode";

const PBKDF2_ITERATIONS = 600_000;
const LEGACY_PBKDF2_ITERATIONS = 150_000;
const PASSWORD_HASH_PREFIX = `pbkdf2-sha256$${PBKDF2_ITERATIONS}$`;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const ABSOLUTE_SESSION_MS = 12 * 60 * 60 * 1000;
const LOCKOUT_META_PREFIX = "auth_lockout:";
const SECURE_SESSION_KEY = "local-session" as const;

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

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
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
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return toBase64(derived);
}

async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  if (password.length < 10) throw new Error("Password must contain at least 10 characters.");
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const hash = PASSWORD_HASH_PREFIX + (await derivePasswordHash(password, salt));
  return { hash, salt: toBase64(salt) };
}

async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string,
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  const modern = storedHash.startsWith(PASSWORD_HASH_PREFIX);
  const expected = modern ? storedHash.slice(PASSWORD_HASH_PREFIX.length) : storedHash;
  const candidate = await derivePasswordHash(
    password,
    fromBase64(salt),
    modern ? PBKDF2_ITERATIONS : LEGACY_PBKDF2_ITERATIONS,
  );
  if (candidate.length !== expected.length) return { valid: false, needsUpgrade: false };
  // Constant-time-ish comparison — avoids leaking match length via early-exit
  // string equality, cheap enough at 256-bit length that a simple XOR-fold is
  // sufficient here (no dedicated timing-safe-compare utility exists in this
  // codebase or the Web Crypto API itself).
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return { valid: diff === 0, needsUpgrade: !modern && diff === 0 };
}

function lockoutKey(userId: string): string {
  return `${LOCKOUT_META_PREFIX}${userId}`;
}

function readLockoutUntil(userId: string): number {
  try {
    const raw = getMetaValue(lockoutKey(userId));
    if (!raw) return 0;
    const value = Number((JSON.parse(raw) as { until?: number }).until ?? 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function clearLockout(userId: string): void {
  setMetaValue(lockoutKey(userId), JSON.stringify({ until: 0 }));
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
  // Installation invariant: the first account is the permanent Super Owner,
  // regardless of which setup/recovery entry point created it.
  const isFirstAccount = existing.length === 0;
  const isSuperOwner = isFirstAccount || !!input.isSuperOwner;
  const user: LocalUser = {
    id,
    name: input.name.trim(),
    email,
    phone: input.phone?.trim() ?? "",
    role: isSuperOwner ? "Super Owner" : input.role,
    branchId: input.branchId ?? null,
    active: true,
    isSuperOwner,
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
  const lockoutUntil = readLockoutUntil(String(row.id));
  if (lockoutUntil > Date.now()) {
    const minutes = Math.max(1, Math.ceil((lockoutUntil - Date.now()) / 60_000));
    return { ok: false, error: `Account temporarily locked. Try again in ${minutes} minute(s).` };
  }
  const verification = await verifyPassword(
    password,
    String(row.password_hash),
    String(row.password_salt),
  );
  if (!verification.valid) {
    const failedCount = Number(row.failed_login_count ?? 0) + 1;
    await setFailedLoginCount(row, failedCount);
    if (failedCount >= MAX_FAILED_ATTEMPTS) {
      setMetaValue(lockoutKey(String(row.id)), JSON.stringify({ until: Date.now() + LOCKOUT_MS }));
      return { ok: false, error: "Account temporarily locked after repeated failed attempts." };
    }
    return { ok: false, error: "Invalid email or password." };
  }
  if (!String(row.role ?? "").trim()) {
    return { ok: false, error: "No role assigned to this account. Contact admin." };
  }
  if (verification.needsUpgrade) {
    const upgraded = await hashPassword(password);
    await runLocal(() =>
      upsertRow("local_users", {
        ...row,
        password_hash: upgraded.hash,
        password_salt: upgraded.salt,
        failed_login_count: 0,
        updated_at: new Date().toISOString(),
      }),
    );
  } else if (Number(row.failed_login_count ?? 0) !== 0) {
    await setFailedLoginCount(row, 0);
  }
  clearLockout(String(row.id));
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
  if (Boolean(row.is_super_owner) && !active) {
    throw new Error("The Super Owner account cannot be deactivated.");
  }
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
interface SecureLocalSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  issuedAt: number;
  expiresAt: number;
}

interface DesktopSecureStore {
  get: (key: typeof SECURE_SESSION_KEY) => Promise<string | null>;
  set: (key: typeof SECURE_SESSION_KEY, value: string) => Promise<void>;
  delete: (key: typeof SECURE_SESSION_KEY) => Promise<void>;
}

function secureStore(): DesktopSecureStore {
  const desktop = (window as unknown as { mtjDesktop?: { secureStore?: DesktopSecureStore } })
    .mtjDesktop;
  if (desktop?.secureStore) return desktop.secureStore;
  if (import.meta.env.DEV) {
    return {
      get: async () => window.sessionStorage.getItem(SECURE_SESSION_KEY),
      set: async (_key, value) => window.sessionStorage.setItem(SECURE_SESSION_KEY, value),
      delete: async () => window.sessionStorage.removeItem(SECURE_SESSION_KEY),
    };
  }
  throw new Error("Secure desktop session storage is unavailable.");
}

async function readSecureSession(): Promise<SecureLocalSession | null> {
  const raw = await secureStore().get(SECURE_SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as SecureLocalSession;
    if (!session.sessionId || !session.userId || !session.deviceId) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getLocalSessionUserId(): Promise<string | null> {
  return (await readSecureSession())?.userId ?? null;
}

/** Login service: records the session (SAD §5) and audits it (BFS §20). */
export async function setLocalSession(userId: string): Promise<void> {
  const row = await runLocal(() => selectById("local_users", userId));
  if (!row) throw new Error("Local user not found.");
  const sessionId = crypto.randomUUID();
  const deviceId = await getOrCreateDeviceId();
  const mode = await getDeploymentMode();
  const issuedAt = Date.now();
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
  await secureStore().set(
    SECURE_SESSION_KEY,
    JSON.stringify({
      sessionId,
      userId,
      deviceId,
      issuedAt,
      expiresAt: issuedAt + ABSOLUTE_SESSION_MS,
    } satisfies SecureLocalSession),
  );
  window.localStorage.removeItem("mtj_erp_local_session_user_id");
  window.localStorage.removeItem("mtj_erp_local_session_id");
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
  const secureSession = await readSecureSession();
  const sessionId = secureSession?.sessionId ?? null;
  const userId = secureSession?.userId ?? null;
  await secureStore().delete(SECURE_SESSION_KEY);
  window.localStorage.removeItem("mtj_erp_local_session_user_id");
  window.localStorage.removeItem("mtj_erp_local_session_id");
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
  const session = await readSecureSession();
  if (!session) return null;
  await initLocalDb();
  const currentDeviceId = await getOrCreateDeviceId();
  if (session.deviceId !== currentDeviceId || session.expiresAt <= Date.now()) {
    await clearLocalSession();
    return null;
  }
  const sessionRow = selectById("user_sessions", session.sessionId);
  if (!sessionRow || sessionRow.ended_at || String(sessionRow.device_id) !== currentDeviceId) {
    await clearLocalSession();
    return null;
  }
  const row = selectById("local_users", session.userId);
  if (!row || !row.active) {
    await clearLocalSession();
    return null;
  }
  return toLocalUser(row);
}

// ---- Production Offline Account Recovery Flow ----

export function generateRecoveryKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "MTJ-RECO-";
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) key += "-";
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export async function setLocalUserRecovery(
  userId: string,
  q1: string,
  a1: string,
  q2: string,
  a2: string,
  recoveryKey: string,
): Promise<void> {
  await initLocalDb();
  const row = await runLocal(() => selectById("local_users", userId));
  if (!row) throw new Error("Local user not found.");

  const salt1 = window.crypto.getRandomValues(new Uint8Array(16));
  const salt2 = window.crypto.getRandomValues(new Uint8Array(16));
  const saltK = window.crypto.getRandomValues(new Uint8Array(16));

  const hash1 = await derivePasswordHash(a1.trim().toLowerCase(), salt1);
  const hash2 = await derivePasswordHash(a2.trim().toLowerCase(), salt2);
  const hashK = await derivePasswordHash(recoveryKey.trim().toUpperCase(), saltK);

  const now = new Date().toISOString();
  await runLocal(() =>
    upsertRow("local_users", {
      ...row,
      recovery_question_1: q1.trim(),
      recovery_answer_hash_1: `${toBase64(salt1)}:${hash1}`,
      recovery_question_2: q2.trim(),
      recovery_answer_hash_2: `${toBase64(salt2)}:${hash2}`,
      recovery_key_hash: `${toBase64(saltK)}:${hashK}`,
      updated_at: now,
    }),
  );
}

export async function getLocalUserRecoveryQuestions(
  email: string,
): Promise<{ q1: string; q2: string } | null> {
  await initLocalDb();
  const normalizedEmail = email.trim().toLowerCase();
  const rows = selectAllLive("local_users") as Record<string, unknown>[];
  const row = rows.find((r) => String(r.email).toLowerCase() === normalizedEmail);
  if (!row || !row.recovery_question_1 || !row.recovery_question_2) return null;
  return {
    q1: String(row.recovery_question_1),
    q2: String(row.recovery_question_2),
  };
}

export async function verifyRecoveryAnswers(
  email: string,
  a1: string,
  a2: string,
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  await initLocalDb();
  const normalizedEmail = email.trim().toLowerCase();
  const rows = selectAllLive("local_users") as Record<string, unknown>[];
  const row = rows.find((r) => String(r.email).toLowerCase() === normalizedEmail);
  if (!row) return { ok: false, error: "User not found." };
  if (!row.recovery_answer_hash_1 || !row.recovery_answer_hash_2) {
    return { ok: false, error: "Recovery questions have not been set up for this account." };
  }

  const [salt1B64, storedHash1] = String(row.recovery_answer_hash_1).split(":");
  const [salt2B64, storedHash2] = String(row.recovery_answer_hash_2).split(":");

  const candidate1 = await derivePasswordHash(a1.trim().toLowerCase(), fromBase64(salt1B64));
  const candidate2 = await derivePasswordHash(a2.trim().toLowerCase(), fromBase64(salt2B64));

  if (candidate1 !== storedHash1 || candidate2 !== storedHash2) {
    return { ok: false, error: "Incorrect recovery answers." };
  }

  // Success: Reset failed count, unlock, and return ID
  await setFailedLoginCount(row, 0);
  clearLockout(String(row.id));
  return { ok: true, userId: String(row.id) };
}

export async function verifyRecoveryKey(
  email: string,
  recoveryKey: string,
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  await initLocalDb();
  const normalizedEmail = email.trim().toLowerCase();
  const rows = selectAllLive("local_users") as Record<string, unknown>[];
  const row = rows.find((r) => String(r.email).toLowerCase() === normalizedEmail);
  if (!row) return { ok: false, error: "User not found." };
  if (!row.recovery_key_hash) {
    return { ok: false, error: "Recovery key has not been set up for this account." };
  }

  const [saltKB64, storedHashK] = String(row.recovery_key_hash).split(":");
  const candidateK = await derivePasswordHash(
    recoveryKey.trim().toUpperCase(),
    fromBase64(saltKB64),
  );

  if (candidateK !== storedHashK) {
    return { ok: false, error: "Incorrect recovery key." };
  }

  // Success: Reset failed count, unlock, and return ID
  await setFailedLoginCount(row, 0);
  clearLockout(String(row.id));
  return { ok: true, userId: String(row.id) };
}

export async function recoverLocalUsernames(phoneOrName: string): Promise<string[]> {
  await initLocalDb();
  const query = phoneOrName.trim().toLowerCase();
  if (!query) return [];
  const rows = selectAllLive("local_users") as Record<string, unknown>[];
  const matches = rows.filter(
    (r) =>
      String(r.name).toLowerCase().includes(query) || String(r.phone).toLowerCase().includes(query),
  );
  return matches.map((r) => String(r.email));
}
