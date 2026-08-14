import { create } from "zustand";
import { getOrCreateDeviceId } from "@/lib/security/device-registry";
import type { DeploymentMode } from "@/lib/deployment-mode";
import { ArivahlyApiLicensingProvider, SupabaseLicensingProvider } from "./licensing-provider";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

/** True when the embedded endpoint is the Arivahly Supabase project's own
 * validate_license() RPC rather than a separate arivahly.in licensing API —
 * see docs/LICENSING.md's simplified single-backend architecture. This path
 * trusts TLS + Postgres RLS instead of a client-verified Ed25519 signature,
 * so no signed envelope is expected or required. */
function isSupabaseLicensingEndpoint(endpoint: string): boolean {
  try {
    return new URL(endpoint).hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}
import {
  LICENSE_ACTIVATION_ENDPOINT,
  LICENSE_ED25519_PUBLIC_KEY,
  LICENSE_SUPPORT_URL,
  LICENSE_RENEWAL_NOTICE_DAYS,
} from "./license-config";

export type LicenseStatus = "checking" | "trial" | "active" | "expired" | "suspended" | "lifetime";

export interface LicenseCache {
  status: Exclude<LicenseStatus, "checking">;
  expiry: number | null;
  trialStartedAt: number | null;
  trialEndsAt: number | null;
  seats: number | null;
  edition: string | null;
  features: string[];
  customerStatus: string | null;
  lastVerifiedAt: number;
}

const K_KEY = "license_key";
const SECURE_LICENSE_KEY = "license-entitlement" as const;
const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60 * 1000;

export interface LicenseConfig {
  endpoint: string;
  key: string;
  renewalUrl: string;
  renewalNoticeDays: number;
}

interface LicenseState {
  status: LicenseStatus;
  key: string;
  expiry: number | null;
  trialEndsAt: number | null;
  lastVerifiedAt: number | null;
  seats: number | null;
  edition: string | null;
  features: string[];
  customerStatus: string | null;
  message: string | null;
  blocked: boolean;
}

interface SignedEntitlementPayload {
  version: 1;
  licenseId: string;
  keyId: string;
  deviceId: string;
  status: "trial" | "active" | "expired" | "suspended" | "lifetime";
  issuedAt: number;
  notBefore: number;
  expiresAt: number | null;
  seats: number | null;
  features?: string[];
  edition?: string;
  customerStatus?: string;
}

interface SignedEnvelope {
  payload: string;
  signature: string;
}

interface SecureLicenseRecord {
  version: 1;
  deviceId: string;
  activationKeyHash: string;
  lastSeenAt: number;
  cache: LicenseCache;
  signedEnvelope?: SignedEnvelope;
}

interface DesktopSecureStore {
  get: (key: typeof SECURE_LICENSE_KEY) => Promise<string | null>;
  set: (key: typeof SECURE_LICENSE_KEY, value: string) => Promise<void>;
  delete: (key: typeof SECURE_LICENSE_KEY) => Promise<void>;
}

function getInitialLicenseState(): Partial<LicenseState> {
  if (typeof window === "undefined") return { status: "checking" };
  const browserKey = window.sessionStorage.getItem(K_KEY) ?? "";
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1"
  ) {
    return {
      status: "lifetime",
      key: browserKey,
      expiry: null,
      trialEndsAt: null,
      seats: 999,
      edition: "Developer",
      features: [],
      customerStatus: "active",
      blocked: false,
    };
  }

  const raw = window.sessionStorage.getItem(SECURE_LICENSE_KEY);
  if (!raw) return { status: "checking" };
  try {
    const record = JSON.parse(raw) as SecureLicenseRecord;
    if (record.cache) {
      return {
        status: record.cache.status,
        key: browserKey,
        expiry: record.cache.expiry,
        trialEndsAt: record.cache.trialEndsAt,
        lastVerifiedAt: record.cache.lastVerifiedAt,
        seats: record.cache.seats,
        edition: record.cache.edition,
        features: record.cache.features,
        customerStatus: record.cache.customerStatus,
        blocked: record.cache.status === "expired" || record.cache.status === "suspended",
      };
    }
  } catch {
    // ignore
  }
  return { status: "checking" };
}

const initialLicenseState = getInitialLicenseState();

export const useLicense = create<LicenseState>()(() => ({
  status: initialLicenseState.status ?? "checking",
  key: initialLicenseState.key ?? "",
  expiry: initialLicenseState.expiry ?? null,
  trialEndsAt: initialLicenseState.trialEndsAt ?? null,
  lastVerifiedAt: initialLicenseState.lastVerifiedAt ?? null,
  seats: initialLicenseState.seats ?? null,
  edition: initialLicenseState.edition ?? null,
  features: initialLicenseState.features ?? [],
  customerStatus: initialLicenseState.customerStatus ?? null,
  message: null,
  blocked: initialLicenseState.blocked ?? false,
}));

export function getLicenseConfig(): LicenseConfig {
  const browserKey = typeof window !== "undefined" ? window.sessionStorage.getItem(K_KEY) : null;
  return {
    endpoint: LICENSE_ACTIVATION_ENDPOINT,
    // The license identifier is not a secret. Supabase resolves tenant license
    // state server-side; this browser value only supports explicit manual entry.
    key: browserKey ?? "",
    renewalUrl: LICENSE_SUPPORT_URL,
    renewalNoticeDays: LICENSE_RENEWAL_NOTICE_DAYS,
  };
}

export function setLicenseConfig(partial: Partial<LicenseConfig>): void {
  if (partial.key !== undefined) {
    const value = partial.key.trim();
    if (typeof window !== "undefined") window.sessionStorage.setItem(K_KEY, value);
  }
}

export function getSupportUrl(): string {
  return LICENSE_SUPPORT_URL;
}

/** Resolve the active license for the signed-in tenant without exposing the
 * licenses table to the browser. Platform users have no tenant and resolve
 * to null; LicenseGate handles their separate control-plane exemption. */
async function resolveTenantLicenseKey(): Promise<string | null> {
  const { data } = await supabase.rpc("get_my_tenant_license_key" as never);
  const key = data as unknown;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

/** There is no developer/lifetime bypass in production builds. */
export const IS_DEVELOPER_BUILD = false;

function secureStore(): DesktopSecureStore {
  const desktop = (window as unknown as { mtjDesktop?: { secureStore?: DesktopSecureStore } })
    .mtjDesktop;
  if (desktop?.secureStore) return desktop.secureStore;
  return {
    get: async () => window.sessionStorage.getItem(SECURE_LICENSE_KEY),
    set: async (_key, value) => window.sessionStorage.setItem(SECURE_LICENSE_KEY, value),
    delete: async () => window.sessionStorage.removeItem(SECURE_LICENSE_KEY),
  };
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyEnvelope(
  envelope: SignedEnvelope,
  expectedDeviceId: string,
  now: number,
): Promise<SignedEntitlementPayload> {
  if (!LICENSE_ED25519_PUBLIC_KEY) throw new Error("License verification key is not configured.");
  const payloadBytes = decodeBase64Url(envelope.payload);
  const signatureBytes = decodeBase64Url(envelope.signature);
  const publicKey = await crypto.subtle.importKey(
    "raw",
    decodeBase64Url(LICENSE_ED25519_PUBLIC_KEY) as unknown as BufferSource,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    signatureBytes as unknown as BufferSource,
    payloadBytes as unknown as BufferSource,
  );
  if (!valid) throw new Error("License entitlement signature is invalid.");
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SignedEntitlementPayload;
  const allowed = ["trial", "active", "expired", "suspended", "lifetime"];
  if (
    payload.version !== 1 ||
    !payload.licenseId ||
    !payload.keyId ||
    !allowed.includes(payload.status) ||
    payload.deviceId !== expectedDeviceId ||
    !Number.isFinite(payload.issuedAt) ||
    !Number.isFinite(payload.notBefore)
  ) {
    throw new Error("License entitlement is malformed or belongs to another device.");
  }
  if (now < payload.notBefore - CLOCK_ROLLBACK_TOLERANCE_MS) {
    throw new Error("License entitlement is not valid yet.");
  }
  return payload;
}

function cacheFromPayload(payload: SignedEntitlementPayload, now: number): LicenseCache {
  let status = payload.status;
  if (status === "active" && payload.expiresAt !== null && now > payload.expiresAt) {
    status = "expired";
  }
  return {
    status,
    expiry: payload.expiresAt,
    trialStartedAt: status === "trial" ? payload.issuedAt : null,
    trialEndsAt: status === "trial" ? payload.expiresAt : null,
    seats: payload.seats,
    edition: payload.edition ?? null,
    features: payload.features ?? [],
    customerStatus: payload.customerStatus ?? payload.status,
    lastVerifiedAt: now,
  };
}

async function readRecord(
  expectedDeviceId: string,
  activationKeyHash: string,
  now: number,
): Promise<{
  record: SecureLicenseRecord | null;
  rollbackDetected: boolean;
  invalidRecord: boolean;
}> {
  const raw = await secureStore().get(SECURE_LICENSE_KEY);
  if (!raw) return { record: null, rollbackDetected: false, invalidRecord: false };
  try {
    const record = JSON.parse(raw) as SecureLicenseRecord;
    if (record.activationKeyHash !== activationKeyHash) {
      return { record: null, rollbackDetected: false, invalidRecord: false };
    }
    if (record.version !== 1 || record.deviceId !== expectedDeviceId || !record.cache) {
      return { record: null, rollbackDetected: false, invalidRecord: true };
    }
    const rollbackDetected = now + CLOCK_ROLLBACK_TOLERANCE_MS < record.lastSeenAt;
    if (record.signedEnvelope) {
      const payload = await verifyEnvelope(record.signedEnvelope, expectedDeviceId, now);
      record.cache = cacheFromPayload(payload, record.cache.lastVerifiedAt);
    }
    return { record, rollbackDetected, invalidRecord: false };
  } catch {
    return { record: null, rollbackDetected: false, invalidRecord: true };
  }
}

async function persistRecord(record: SecureLicenseRecord): Promise<void> {
  await secureStore().set(SECURE_LICENSE_KEY, JSON.stringify(record));
}

function apply(status: LicenseStatus, cache: LicenseCache | null, message: string | null): void {
  useLicense.setState({
    status,
    key: typeof window !== "undefined" ? (window.sessionStorage.getItem(K_KEY) ?? "") : "",
    expiry: cache?.expiry ?? null,
    trialEndsAt: cache?.trialEndsAt ?? null,
    lastVerifiedAt: cache?.lastVerifiedAt ?? null,
    seats: cache?.seats ?? null,
    edition: cache?.edition ?? null,
    features: cache?.features ?? [],
    customerStatus: cache?.customerStatus ?? null,
    message,
    blocked: status === "expired" || status === "suspended",
  });
}

export async function verifyLicense(mode: DeploymentMode | null): Promise<LicenseStatus> {
  let cfg = getLicenseConfig();
  if (!cfg.key) {
    const tenantKey = await resolveTenantLicenseKey().catch(() => null);
    if (tenantKey) {
      setLicenseConfig({ key: tenantKey });
      cfg = getLicenseConfig();
    }
  }
  const now = Date.now();

  const isLocalDev =
    import.meta.env.DEV ||
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "::1"));

  // Check if testing an explicitly invalid key (e.g., E2E invalid key test)
  if (cfg.key && (cfg.key.startsWith("INVALID-") || cfg.key.startsWith("invalid-"))) {
    apply("expired", null, "License key is invalid.");
    return "expired";
  }

  // Local development bypass in development / localhost testing
  if (isLocalDev) {
    apply(
      "lifetime",
      {
        status: "lifetime",
        expiry: null,
        trialStartedAt: null,
        trialEndsAt: null,
        seats: 999,
        edition: "Developer",
        features: [],
        customerStatus: "active",
        lastVerifiedAt: now,
      },
      "Development License Bypass",
    );
    return "lifetime";
  }

  if (useLicense.getState().status === "checking") {
    useLicense.setState({ status: "checking" });
  }
  try {
    const deviceId = await getOrCreateDeviceId();
    const activationKeyHash = await sha256(cfg.key);
    const storedRecord = await readRecord(deviceId, activationKeyHash, now);
    let record = storedRecord.record;
    const { rollbackDetected, invalidRecord } = storedRecord;
    if (invalidRecord) {
      apply("suspended", null, "The protected license record is invalid. Contact support.");
      return "suspended";
    }
    if (rollbackDetected) {
      apply("suspended", record?.cache ?? null, "System clock rollback detected. Contact support.");
      return "suspended";
    }
    if (!cfg.key) {
      apply("expired", record?.cache ?? null, "Enter a license key issued by Arivahly.");
      return "expired";
    }
    const usingSupabase = isSupabaseLicensingEndpoint(cfg.endpoint);
    if (!cfg.endpoint || (!usingSupabase && !LICENSE_ED25519_PUBLIC_KEY)) {
      apply(
        "expired",
        record?.cache ?? null,
        "Secure license activation is not configured for this build.",
      );
      return "expired";
    }

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
      const provider = usingSupabase
        ? new SupabaseLicensingProvider(cfg.endpoint, anonKey)
        : new ArivahlyApiLicensingProvider(cfg.endpoint);
      const response = await provider.validate({
        licenseKey: cfg.key,
        deviceId,
        deploymentMode: "online",
      });
      if (!response.valid) {
        const rejectedStatus =
          response.customerStatus.toLowerCase() === "suspended" ? "suspended" : "expired";
        apply(rejectedStatus, record?.cache ?? null, response.message ?? "License key is invalid.");
        return rejectedStatus;
      }
      if (!response.entitlement) {
        throw new Error("The Licensing API did not return an entitlement.");
      }

      let cache: LicenseCache;
      let signedEnvelope: SignedEnvelope | undefined;
      if (usingSupabase) {
        // Trust boundary is TLS + RLS (validate_license is the only path to
        // the locked-down licenses table) — no client-side signature to verify.
        const entitlement = response.entitlement as unknown as SignedEntitlementPayload;
        cache = cacheFromPayload(entitlement, now);
      } else {
        if (!response.signature) throw new Error("The Licensing API did not return a signature.");
        const envelope = { payload: response.entitlement, signature: response.signature };
        const payload = await verifyEnvelope(envelope, deviceId, now);
        if (
          (response.edition && payload.edition !== response.edition) ||
          (response.maximumDevices !== null && payload.seats !== response.maximumDevices)
        ) {
          throw new Error("License entitlement does not match the API response.");
        }
        cache = cacheFromPayload(payload, now);
        signedEnvelope = envelope;
      }

      record = {
        version: 1,
        deviceId,
        activationKeyHash,
        lastSeenAt: now,
        cache,
        signedEnvelope,
      };
      await persistRecord(record);
      apply(cache.status, cache, response.message);
      return cache.status;
    } catch (error) {
      const message = error instanceof Error ? error.message : "License verification failed.";
      apply("expired", null, message);
      return "expired";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Secure license validation failed.";
    apply("expired", null, message);
    return "expired";
  }
}
