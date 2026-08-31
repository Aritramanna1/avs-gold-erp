/**
 * Business Rule Toggles (store) — the runtime half of
 * business-rules-registry.ts's static metadata. Holds the CURRENT value of
 * every rule, persisted via the repository layer (so it syncs like any
 * other data), permission-checked on every change, and every change is
 * recorded in the immutable audit log (Step 8) — "audit log whenever
 * changed" is structural here, not optional.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { append as appendAuditEntry } from "./security/audit-log";
import { useSettings } from "./settings-store";
import {
  BUSINESS_RULE_REGISTRY,
  BUSINESS_RULE_KEYS,
  type BusinessRuleKey,
  type RulePermissionTier,
} from "./business-rules-registry";

export class InsufficientPermissionError extends Error {}

interface BusinessRuleRecord {
  id: "business_rules";
  values: Partial<Record<BusinessRuleKey, boolean>>;
}

const rulesRepository = createRepository<BusinessRuleRecord>("app_settings");

function defaultValues(): Record<BusinessRuleKey, boolean> {
  const values = {} as Record<BusinessRuleKey, boolean>;
  for (const key of BUSINESS_RULE_KEYS) values[key] = BUSINESS_RULE_REGISTRY[key].defaultValue;
  return values;
}

interface BusinessRulesState {
  values: Record<BusinessRuleKey, boolean>;
  loaded: boolean;
  refresh: () => Promise<void>;
  isEnabled: (key: BusinessRuleKey) => boolean;
  /** Throws InsufficientPermissionError if `actor`'s role doesn't meet the rule's required tier — never silently ignores a denied change. */
  setRule: (
    key: BusinessRuleKey,
    value: boolean,
    actor: { id: string | null; email: string | null; role: string | null },
  ) => Promise<void>;
}

function actorMeetsTier(role: string | null, tier: RulePermissionTier): boolean {
  if (!role) return false;
  const isSuperOwner = /super\s*owner/i.test(role);
  const isOwnerOrAdmin = isSuperOwner || /^owner$/i.test(role) || /administrator/i.test(role);
  if (tier === "super_owner_only") return isSuperOwner;
  return isOwnerOrAdmin;
}

export const useBusinessRules = create<BusinessRulesState>()((set, get) => ({
  values: defaultValues(),
  loaded: false,

  refresh: async () => {
    const record = await rulesRepository.read("business_rules");
    set({
      values: { ...defaultValues(), ...(record?.values ?? {}) },
      loaded: true,
    });
  },

  isEnabled: (key) => get().values[key],

  setRule: async (key, value, actor) => {
    const def = BUSINESS_RULE_REGISTRY[key];
    if (!actorMeetsTier(actor.role, def.permissionRequired)) {
      throw new InsufficientPermissionError(
        `"${actor.role ?? "unknown role"}" does not have permission to change "${def.name}" (requires ${def.permissionRequired}).`,
      );
    }

    const before = get().values[key];
    const nextValues = { ...get().values, [key]: value };
    set({ values: nextValues });

    await rulesRepository.saveAs("business_rules", { id: "business_rules", values: nextValues });

    await appendAuditEntry({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "business_rule.changed",
      entityType: "business_rules",
      entityId: key,
      before: { value: before },
      after: { value, ruleName: def.name },
      deviceId: null,
    });
  },
}));

/** Convenience — resolves the current signed-in user's role from settings-store's registered-users list, for callers that don't already have it handy. */
export function currentActorRole(email: string | null): string | null {
  if (!email) return null;
  const user = useSettings
    .getState()
    .users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  return user?.role ?? null;
}
