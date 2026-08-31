/** Preserve invite context across Google OAuth PKCE (which overwrites ?code=). */
const STORAGE_KEY = "ornexa_invite_oauth_ctx";
const MAX_AGE_MS = 15 * 60 * 1000;

export type InviteOAuthContext = {
  inviteCode: string;
  email: string;
};

export function stashInviteOAuthContext(ctx: InviteOAuthContext): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...ctx, at: Date.now() }),
  );
}

export function consumeInviteOAuthContext(): InviteOAuthContext | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    const parsed = JSON.parse(raw) as InviteOAuthContext & { at?: number };
    if (!parsed.inviteCode || !parsed.email) return null;
    if (parsed.at && Date.now() - parsed.at > MAX_AGE_MS) return null;
    return { inviteCode: parsed.inviteCode, email: parsed.email };
  } catch {
    return null;
  }
}

/** Read invite code from URL — `invite` param avoids OAuth PKCE `code` collision. */
export function readInviteCodeFromLocation(search = window.location.search): string {
  const params = new URLSearchParams(search);
  const invite = params.get("invite")?.trim();
  if (invite) return invite;

  const code = params.get("code")?.trim() ?? "";
  if (!code) return "";

  // OAuth PKCE authorization codes are long opaque strings — not invite codes.
  if (code.length >= 32 && !/^INV[-_]/i.test(code)) return "";

  return code;
}

export function readInviteEmailFromLocation(search = window.location.search): string {
  return new URLSearchParams(search).get("email")?.trim() ?? "";
}

export function isOAuthReturnLocation(search = window.location.search, hash = window.location.hash): boolean {
  if (hash.includes("access_token=")) return true;
  const params = new URLSearchParams(search);
  const code = params.get("code")?.trim() ?? "";
  return code.length >= 32 && !/^INV[-_]/i.test(code);
}

export function inviteAcceptPath(inviteCode: string, email: string): string {
  const q = new URLSearchParams({
    invite: inviteCode,
    email,
  });
  return `/invite/accept?${q.toString()}`;
}
