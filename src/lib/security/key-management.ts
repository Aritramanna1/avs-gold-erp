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

  let actorId: string | null = null;
  let resolvedEmail = actorEmail;
  try {
    const { data: userData } = await (supabase.auth?.getUser
      ? supabase.auth.getUser()
      : Promise.resolve({ data: { user: null } })
    ).catch(() => ({ data: { user: null } }));
    if (userData?.user) {
      actorId = userData.user.id;
      if (!resolvedEmail) resolvedEmail = userData.user.email ?? null;
    }
  } catch {
    // Auth resolution fallback
  }

  const { error } = await supabase.from("security_operations" as never).upsert({
    id,
    operation_type: "key_rotation_request",
    status: "not_applicable",
    summary: result.message,
    details: result,
    actor_id: actorId,
    actor_email: resolvedEmail,
  } as never);

  if (error && !error.message.includes("violates row-level security policy") && (error as any).code !== "42501") {
    // If table RLS restricts client-side direct upsert, log warning and preserve immutable audit chain
    console.warn("security_operations record skipped, logging to secure audit trail:", error.message);
  }

  await appendAuditEntry({
    actorId,
    actorEmail: resolvedEmail,
    action: "key_management.supabase_no_local_key",
    entityType: "security_operations",
    entityId: id,
    before: null,
    after: result,
    deviceId: null,
  }).catch((auditErr) => {
    console.warn("Audit log fallback notice:", auditErr);
  });

  return result;
}
