/**
 * Last-known jeweller ERP session (auth, memberships, granted subscription).
 * Used only when RPCs fail (airplane mode). Not a second identity plane.
 * Platform / customer / supplier / karigar portals are not restored as active.
 */
import type { AuthorizationContext, AuthorizedWorkspace } from "@/lib/identity/authorization-types";
import type { TenantMembership } from "@/lib/identity/membership-service";
import type { SubscriptionAccessSnapshot } from "@/lib/identity/subscription-access-service";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/lib/compliance/legal-policies";
import { loadEncryptedJson, removeEncryptedJson, saveEncryptedJson } from "./storage";

const SESSION_KEY = "erp.session.v1";

export type ErpSessionCache = {
  authUserId: string;
  savedAt: number;
  authorization: AuthorizationContext;
  memberships: TenantMembership[];
  subscription: SubscriptionAccessSnapshot | null;
  legalCleared: { termsVersion: string; privacyVersion: string } | null;
};

function isJewellerWorkspace(w: AuthorizedWorkspace): boolean {
  return w.workspace_type === "erp" || w.workspace_type === "ceo";
}

function isJewellerMembership(m: TenantMembership): boolean {
  if (m.membership_kind === "internal") return true;
  if (!m.portal_type || m.portal_type === "ceo") return true;
  return false;
}

/** Prefer ERP/CEO as the active workspace so the jeweller app opens offline. */
export function preferJewellerAuthorization(ctx: AuthorizationContext): AuthorizationContext {
  if (ctx.is_platform_owner) return ctx;

  const activeType = ctx.active_workspace?.workspace_type;
  if (activeType === "platform") return ctx;
  if (activeType === "customer" || activeType === "supplier" || activeType === "karigar") {
    return ctx;
  }

  const jeweller = ctx.workspaces.filter(isJewellerWorkspace);
  if (jeweller.length === 0) return ctx;

  const hasPortal = ctx.workspaces.some(
    (w) =>
      w.workspace_type === "customer" ||
      w.workspace_type === "supplier" ||
      w.workspace_type === "karigar",
  );
  if (hasPortal && activeType !== "erp" && activeType !== "ceo") {
    return ctx;
  }

  const active =
    jeweller.find((w) => w.is_active) ??
    jeweller.find((w) => w.workspace_key === ctx.active_workspace?.workspace_key) ??
    jeweller[0]!;
  return {
    ...ctx,
    workspaces: jeweller,
    active_workspace: {
      workspace_key: active.workspace_key,
      workspace_type: active.workspace_type,
      organization_id: active.organization_id,
      portal_type: active.portal_type ?? null,
      membership_id: active.membership_id ?? null,
      branch_id: ctx.active_workspace?.branch_id ?? null,
    },
    default_route: active.route || "/app",
  };
}

export async function loadErpSessionCache(): Promise<ErpSessionCache | null> {
  return loadEncryptedJson<ErpSessionCache>(SESSION_KEY);
}

export async function saveErpSessionCache(next: ErpSessionCache): Promise<void> {
  const jewellerMemberships = next.memberships.filter(isJewellerMembership);
  const authorization = preferJewellerAuthorization(next.authorization);
  await saveEncryptedJson(SESSION_KEY, {
    ...next,
    authorization,
    memberships: jewellerMemberships.length > 0 ? jewellerMemberships : next.memberships,
    savedAt: Date.now(),
  } satisfies ErpSessionCache);
}

export async function patchErpSessionCache(
  patch: Partial<Omit<ErpSessionCache, "savedAt">>,
): Promise<void> {
  const current = (await loadErpSessionCache()) ?? {
    authUserId: patch.authUserId ?? "",
    savedAt: 0,
    authorization: patch.authorization!,
    memberships: patch.memberships ?? [],
    subscription: patch.subscription ?? null,
    legalCleared: patch.legalCleared ?? null,
  };
  if (!patch.authorization && !current.authorization) return;
  await saveErpSessionCache({
    ...current,
    ...patch,
    authorization: patch.authorization ?? current.authorization,
    savedAt: Date.now(),
  });
}

export async function clearErpSessionCache(): Promise<void> {
  await removeEncryptedJson(SESSION_KEY);
}

export function legalCacheMatchesCurrent(
  cleared: ErpSessionCache["legalCleared"] | null | undefined,
): boolean {
  if (!cleared) return false;
  return (
    cleared.termsVersion === CURRENT_TERMS_VERSION &&
    cleared.privacyVersion === CURRENT_PRIVACY_VERSION
  );
}
