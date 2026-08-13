/**
 * Device registration backed by Supabase.
 *
 * The device id is session-scoped in the browser. The registry and trust state
 * are remote and firm-scoped in Supabase; no permanent browser-local identity
 * is authoritative.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

const DEVICE_ID_KEY = "ornexa_device_id";

export interface DeviceInfo {
  deviceId: string;
  label: string;
  platform: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  trusted: boolean;
}

let cachedDeviceId: string | null = null;

function makeDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `dev_${crypto.randomUUID()}`;
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  if (typeof window === "undefined") {
    cachedDeviceId = makeDeviceId();
    return cachedDeviceId;
  }
  const existing = window.sessionStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    cachedDeviceId = existing;
    return existing;
  }
  const created = makeDeviceId();
  window.sessionStorage.setItem(DEVICE_ID_KEY, created);
  cachedDeviceId = created;
  return created;
}

function defaultLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  return navigator.platform || navigator.userAgent.slice(0, 40) || "Unknown device";
}

function mapRow(row: Record<string, unknown>): DeviceInfo {
  return {
    deviceId: row.device_id as string,
    label: row.label as string,
    platform: (row.platform as string) ?? null,
    firstSeenAt: row.first_seen_at as string,
    lastSeenAt: row.last_seen_at as string,
    trusted: Boolean(row.trusted),
  };
}

export async function registerThisDevice(label?: string): Promise<DeviceInfo> {
  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const resolvedLabel = label ?? defaultLabel();
  const platform = typeof navigator !== "undefined" ? navigator.platform || null : null;

  const { data, error } = await (supabase as any)
    .from("device_registry")
    .upsert(
      {
        device_id: deviceId,
        label: resolvedLabel,
        platform,
        last_seen_at: now,
      },
      { onConflict: "firm_id,device_id" },
    )
    .select("device_id,label,platform,first_seen_at,last_seen_at,trusted")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function listRegisteredDevices(): Promise<DeviceInfo[]> {
  const { data, error } = await (supabase as any)
    .from("device_registry")
    .select("device_id,label,platform,first_seen_at,last_seen_at,trusted")
    .order("last_seen_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

export async function setDeviceTrust(deviceId: string, trusted: boolean): Promise<void> {
  const { error } = await (supabase as any)
    .from("device_registry")
    .update({ trusted })
    .eq("device_id", deviceId);
  if (error) throw new Error(error.message);
}
