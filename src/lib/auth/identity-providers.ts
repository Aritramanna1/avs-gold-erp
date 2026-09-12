import type { User } from "@supabase/supabase-js";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

/** Set on the user when they complete the post-OAuth password setup gate. */
export const EMAIL_PASSWORD_CONFIGURED_META = "email_password_configured";

export const PASSWORD_GATE_STORAGE_PREFIX = "ornexa_pwd_gate_";
export const PASSWORD_LOGIN_SESSION_PREFIX = "ornexa_pwd_login_";

/** True when the user can sign in with email + password (not Google-only). */
export function hasEmailPasswordIdentity(user: User | null | undefined): boolean {
  if (!user) return false;

  if (user.user_metadata?.[EMAIL_PASSWORD_CONFIGURED_META] === true) return true;

  if (
    (user.identities ?? []).some((identity) => {
      const provider = String(identity.provider ?? "").toLowerCase();
      return provider === "email";
    })
  ) {
    return true;
  }

  const providers = user.app_metadata?.providers;
  if (
    Array.isArray(providers) &&
    providers.some((provider) => String(provider).toLowerCase() === "email")
  ) {
    return true;
  }

  return false;
}

/** User linked Google/OAuth (may also have a password without an email identity row). */
export function hasOAuthIdentity(user: User | null | undefined): boolean {
  if (!user) return false;
  return (user.identities ?? []).some((identity) => {
    const provider = String(identity.provider ?? "").toLowerCase();
    return provider !== "email";
  });
}

export function hasPasswordLoginSession(userId: string): boolean {
  try {
    return sessionStorage.getItem(`${PASSWORD_LOGIN_SESSION_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

export function writePasswordLoginSession(userId: string): void {
  try {
    sessionStorage.setItem(`${PASSWORD_LOGIN_SESSION_PREFIX}${userId}`, "1");
  } catch {
    /* sessionStorage unavailable */
  }
}

/**
 * Record a successful email+password sign-in. OAuth-linked accounts can use
 * password login without an `email` identity — that must skip CreatePasswordGate.
 */
export async function noteSuccessfulPasswordLogin(userId: string): Promise<void> {
  writePasswordGateDismissed(userId);
  writePasswordLoginSession(userId);
  await markEmailPasswordConfiguredServer();
}

/** Gate only OAuth-only users who have not yet set up (or used) password login. */
export async function shouldRequireCreatePasswordGate(
  user: User | null | undefined,
): Promise<boolean> {
  if (!user) return false;
  if (hasEmailPasswordIdentity(user)) return false;
  if (readPasswordGateDismissed(user.id)) return false;
  if (hasPasswordLoginSession(user.id)) return false;
  if (await fetchEmailPasswordConfigured()) return false;
  return hasOAuthIdentity(user);
}

export function primaryOAuthProvider(user: User | null | undefined): string | null {
  if (!user) return null;
  const oauth = (user.identities ?? []).find((identity) => {
    const provider = String(identity.provider ?? "").toLowerCase();
    return provider !== "email";
  });
  return oauth?.provider ?? null;
}

export function readPasswordGateDismissed(userId: string): boolean {
  try {
    return sessionStorage.getItem(`${PASSWORD_GATE_STORAGE_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

export function writePasswordGateDismissed(userId: string): void {
  try {
    sessionStorage.setItem(`${PASSWORD_GATE_STORAGE_PREFIX}${userId}`, "1");
  } catch {
    /* sessionStorage unavailable */
  }
}

/** Authoritative server read — survives JWT refresh races. */
export async function fetchEmailPasswordConfigured(): Promise<boolean> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.user_metadata?.[EMAIL_PASSWORD_CONFIGURED_META] === true) {
      return true;
    }
  } catch {
    /* auth session check fallback */
  }

  try {
    const { data, error } = await (supabase as any).rpc("my_email_password_configured");
    if (!error && data === true) {
      return true;
    }
  } catch {
    /* RPC optional */
  }

  return false;
}

/** Persist gate completion in auth.users metadata (server-side). */
export async function markEmailPasswordConfiguredServer(): Promise<boolean> {
  // 1. Direct Supabase Auth user metadata update (client-authoritative, standard Auth API)
  try {
    const { error } = await supabase.auth.updateUser({
      data: { [EMAIL_PASSWORD_CONFIGURED_META]: true },
    });
    if (!error) return true;
  } catch {
    /* try fallback */
  }

  // 2. Optional RPC if deployed
  try {
    const { error } = await (supabase as any).rpc("mark_my_email_password_configured");
    if (!error) return true;
  } catch {
    /* non-critical */
  }

  return false;
}
