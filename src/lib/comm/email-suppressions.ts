/**
 * Email suppressions + unsubscribe token minting.
 * Promotional mail must check suppressions permanently until opt-in.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function sha256Hex(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return false;
  try {
    const { data: firmId } = await supabase.rpc("my_firm_id");
    if (!firmId) return false;
    const { data } = await supabase.rpc("email_is_suppressed" as never, {
      p_firm_id: firmId,
      p_email: normalized,
    } as never);
    return data === true;
  } catch {
    const { data } = await supabase
      .from("email_suppressions" as never)
      .select("status")
      .eq("email_normalized", normalized)
      .eq("status", "opted_out")
      .maybeSingle();
    return Boolean(data);
  }
}

/** Mint or refresh an unsubscribe token for a recipient (promotional footers). */
export async function ensureUnsubscribeLink(email: string): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return null;
  const { data: existing } = await supabase
    .from("email_suppressions" as never)
    .select("status")
    .eq("email_normalized", normalized)
    .maybeSingle();
  if (existing && String((existing as { status?: string }).status) === "opted_out") {
    return null;
  }

  const token = randomToken();
  const hash = await sha256Hex(token);
  const payload: Record<string, unknown> = {
    email_normalized: normalized,
    source: "unsubscribe_link",
    token_hash: hash,
    updated_at: new Date().toISOString(),
  };
  if (!existing) payload.status = "opted_in";
  const { error } = await supabase.from("email_suppressions" as never).upsert(payload as never, {
    onConflict: "firm_id,email_normalized",
  });
  if (error) return null;
  const origin =
    import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}/unsubscribe/${token}`;
}

export async function resolvePublicUnsubscribe(
  token: string,
  action: "opt_out" | "opt_in" = "opt_out",
): Promise<{ ok: boolean; email?: string; status?: string } | null> {
  const { data, error } = await supabase.rpc("resolve_email_unsubscribe" as never, {
    p_token: token,
    p_action: action,
  } as never);
  if (error || !data) return null;
  return data as unknown as { ok: boolean; email?: string; status?: string };
}
