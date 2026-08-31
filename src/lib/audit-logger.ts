import { dataProvider } from "@/lib/providers/data-provider";

type AuditValue = Record<string, unknown> | string | number | boolean | null;

/** Persist configuration changes through the tenant-scoped data provider. */
export const AuditLogger = {
  async logChange(
    userId: string,
    key: string,
    oldValue: AuditValue,
    newValue: AuditValue,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!userId.trim() || !key.trim()) {
      return { ok: false, error: "Audit user and key are required" };
    }

    const { data: profile, error: profileError } = await dataProvider
      .from("user_profiles" as never)
      .select("firm_id")
      .eq("auth_id", userId)
      .maybeSingle();
    if (profileError) {
      console.error("[AuditLogger] Unable to resolve tenant scope");
      return { ok: false, error: "Unable to resolve tenant scope" };
    }

    const { error } = await dataProvider.from("audit_logs" as never).insert({
      user_id: userId,
      firm_id: (profile as { firm_id?: string | null } | null)?.firm_id ?? null,
      action: "configuration.changed",
      table_name: "configuration",
      record_id: key,
      old_data: oldValue,
      new_data: newValue,
    } as never);
    if (error) {
      console.error("[AuditLogger] Audit persistence failed");
      return { ok: false, error: "Audit persistence failed" };
    }
    return { ok: true };
  },
};
