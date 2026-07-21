import type { DeploymentMode } from "@/lib/deployment-mode";

export interface LicenseValidationRequest {
  licenseKey: string;
  deviceId: string;
  deploymentMode: DeploymentMode;
}

export interface LicenseValidationResponse {
  valid: boolean;
  edition: string | null;
  expiry: number | null;
  enabledFeatures: string[];
  maximumDevices: number | null;
  customerStatus: string;
  entitlement: string | null;
  signature: string | null;
  message: string | null;
}

export interface LicensingProvider {
  validate(request: LicenseValidationRequest): Promise<LicenseValidationResponse>;
}

interface LicensingApiBody {
  valid?: unknown;
  edition?: unknown;
  expiry?: unknown;
  expiry_date?: unknown;
  enabledFeatures?: unknown;
  features?: unknown;
  maximumDevices?: unknown;
  max_devices?: unknown;
  customerStatus?: unknown;
  status?: unknown;
  entitlement?: unknown;
  signature?: unknown;
  message?: unknown;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullablePositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function parseExpiry(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export class ArivahlyApiLicensingProvider implements LicensingProvider {
  constructor(
    private readonly endpoint: string,
    private readonly timeoutMs = 15_000,
  ) {}

  async validate(request: LicenseValidationRequest): Promise<LicenseValidationResponse> {
    const endpoint = this.validateEndpoint();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          licenseKey: request.licenseKey,
          deviceId: request.deviceId,
          deploymentMode: request.deploymentMode,
        }),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as LicensingApiBody;
      if (!response.ok) {
        throw new Error(
          nullableString(body.message) ?? `License API request failed (${response.status}).`,
        );
      }
      const features = Array.isArray(body.enabledFeatures)
        ? body.enabledFeatures
        : Array.isArray(body.features)
          ? body.features
          : [];
      return {
        valid: body.valid === true,
        edition: nullableString(body.edition),
        expiry: parseExpiry(body.expiry ?? body.expiry_date),
        enabledFeatures: features.filter((value): value is string => typeof value === "string"),
        maximumDevices: nullablePositiveInteger(body.maximumDevices ?? body.max_devices),
        customerStatus: nullableString(body.customerStatus ?? body.status) ?? "invalid",
        entitlement: nullableString(body.entitlement),
        signature: nullableString(body.signature),
        message: nullableString(body.message),
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("License verification timed out.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private validateEndpoint(): string {
    if (!this.endpoint)
      throw new Error("The Arivahly Licensing API is not configured in this build.");
    const parsed = new URL(this.endpoint);
    const trustedHost =
      parsed.hostname === "arivahly.in" ||
      parsed.hostname.endsWith(".arivahly.in") ||
      parsed.hostname.endsWith(".supabase.co");
    if (parsed.protocol !== "https:" || !trustedHost || parsed.username || parsed.password) {
      throw new Error("The embedded licensing endpoint is invalid.");
    }
    return parsed.toString();
  }
}

/**
 * Licensing backed directly by the Arivahly Supabase project's
 * validate_license() RPC (see docs/LICENSING.md's simplified architecture:
 * Supabase is the single central backend — no separate licensing server).
 * Trust boundary is TLS + Postgres RLS (validate_license is the only way
 * to reach the locked-down `licenses` table), not a client-verified
 * signature — so this response is used as-is, with no signature/entitlement
 * envelope to unwrap.
 */
export class SupabaseLicensingProvider implements LicensingProvider {
  constructor(
    private readonly endpoint: string,
    private readonly anonKey: string,
    private readonly timeoutMs = 15_000,
  ) {}

  async validate(request: LicenseValidationRequest): Promise<LicenseValidationResponse> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          apikey: this.anonKey,
          Authorization: `Bearer ${this.anonKey}`,
        },
        body: JSON.stringify({
          p_license_key: request.licenseKey,
          p_device_id: request.deviceId,
          p_deployment_mode: request.deploymentMode,
        }),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as LicensingApiBody;
      if (!response.ok) {
        throw new Error(
          nullableString(body.message) ?? `License check failed (${response.status}).`,
        );
      }
      const features = Array.isArray(body.enabledFeatures) ? body.enabledFeatures : [];
      return {
        valid: body.valid === true,
        edition: nullableString(body.edition),
        expiry: parseExpiry(body.expiry),
        enabledFeatures: features.filter((v): v is string => typeof v === "string"),
        maximumDevices: nullablePositiveInteger(body.maximumDevices),
        customerStatus: nullableString(body.customerStatus) ?? "invalid",
        entitlement: body.entitlement ? JSON.stringify(body.entitlement) : null,
        signature: null,
        message: nullableString(body.message),
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("License verification timed out.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }
}
