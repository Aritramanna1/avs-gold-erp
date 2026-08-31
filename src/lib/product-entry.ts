const LEFT_PUBLIC_KEY = "ornexa.left-public-site";

export function markLeftPublicSite(): void {
  try {
    localStorage.setItem(LEFT_PUBLIC_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function hasLeftPublicSite(): boolean {
  try {
    return localStorage.getItem(LEFT_PUBLIC_KEY) === "1";
  } catch {
    return false;
  }
}

/** True when a Supabase auth session is already in this browser. */
export function hasAuthSessionHint(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (raw && raw.includes("access_token")) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** After login / trial / app entry, never show the public marketing site again. */
export function shouldStayInProduct(): boolean {
  return hasLeftPublicSite() || hasAuthSessionHint();
}
