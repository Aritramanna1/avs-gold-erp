/**
 * Device Registration (Plan 1 Step 8).
 *
 * Each install gets one persistent device id, generated once and stored in
 * IndexedDB (survives SQLite restore/rebuild, since a restored database
 * shouldn't change which physical machine it's running on). That id is
 * attached to every audit log entry produced on this machine (see
 * audit-log.ts's `deviceId` field) so historical entries are always
 * traceable to a specific device, and is recorded in the local `device_registry`
 * table so an admin can see every device that has ever written to this
 * install's database.
 */
import { runLocal, getDb, queryTable, initLocalDb, openIndexedDbForDeviceId } from "@/lib/local-db";

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

/** Returns this machine's persistent device id, generating and storing one on first call. */
export async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  cachedDeviceId = await openIndexedDbForDeviceId(makeDeviceId());
  return cachedDeviceId;
}

function defaultLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  return navigator.platform || navigator.userAgent.slice(0, 40) || "Unknown device";
}

/** Registers (or touches last_seen_at for) this device. Called once at app startup. */
export async function registerThisDevice(label?: string): Promise<DeviceInfo> {
  await initLocalDb();
  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const existing = (
    queryTable("device_registry", "device_id = ?", [deviceId]) as Record<string, unknown>[]
  )[0];

  if (existing) {
    await runLocal(() => {
      getDb().run(`UPDATE device_registry SET last_seen_at = ? WHERE device_id = ?;`, [
        now,
        deviceId,
      ]);
    });
    return {
      deviceId,
      label: existing.label as string,
      platform: (existing.platform as string) ?? null,
      firstSeenAt: existing.first_seen_at as string,
      lastSeenAt: now,
      trusted: Boolean(existing.trusted),
    };
  }

  const resolvedLabel = label ?? defaultLabel();
  const platform = typeof navigator !== "undefined" ? navigator.platform || null : null;
  await runLocal(() => {
    getDb().run(
      `INSERT INTO device_registry (device_id, label, platform, first_seen_at, last_seen_at, trusted)
       VALUES (?, ?, ?, ?, ?, 1);`,
      [deviceId, resolvedLabel, platform, now, now],
    );
  });
  return {
    deviceId,
    label: resolvedLabel,
    platform,
    firstSeenAt: now,
    lastSeenAt: now,
    trusted: true,
  };
}

export async function listRegisteredDevices(): Promise<DeviceInfo[]> {
  await initLocalDb();
  const rows = queryTable("device_registry", "", []) as Record<string, unknown>[];
  return rows.map((r) => ({
    deviceId: r.device_id as string,
    label: r.label as string,
    platform: (r.platform as string) ?? null,
    firstSeenAt: r.first_seen_at as string,
    lastSeenAt: r.last_seen_at as string,
    trusted: Boolean(r.trusted),
  }));
}

/** Revokes trust for a device — an untrusted device's audit entries remain (immutable), but it's flagged for review. */
export async function setDeviceTrust(deviceId: string, trusted: boolean): Promise<void> {
  await runLocal(() => {
    getDb().run(`UPDATE device_registry SET trusted = ? WHERE device_id = ?;`, [
      trusted ? 1 : 0,
      deviceId,
    ]);
  });
}
