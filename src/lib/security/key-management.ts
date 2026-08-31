/**
 * Supabase-era key management.
 *
 * There is no browser-local encrypted database key to rotate. This API remains
 * for existing settings screens, but records an auditable no-op security event.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { append as appendAuditEntry } from "./audit-log";

export interface KeyRotationResult {
  rotated: boolean;
  previousChecksum: string | null;
  newChecksum: string | null;
  filesReencrypted: number;
  message: string;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `key_rotation_${crypto.randomUUID()}`;
  }
  return `key_rotation_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function rotateEncryptionKey(actorEmail: string | null): Promise<KeyRotationResult> {
  const id = makeId();
  const result: KeyRotationResult = {
    rotated: false,
    previousChecksum: null,
    newChecksum: null,
    filesReencrypted: 0,
    message:
      "No browser-local database key exists. Supabase platform secrets and RLS remain active.",
  };
  const { error } = await supabase.from("security_operations" as never).upsert({
    id,
    operation_type: "key_rotation_request",
    status: "not_applicable",
    summary: result.message,
    details: result,
    actor_email: actorEmail,
  } as never);
  if (error) throw new Error(`Could not record key rotation request: ${error.message}`);
  await appendAuditEntry({
    actorId: null,
    actorEmail,
    action: "key_management.supabase_no_local_key",
    entityType: "security_operations",
    entityId: id,
    before: null,
    after: result,
    deviceId: null,
  });
  return result;
}
