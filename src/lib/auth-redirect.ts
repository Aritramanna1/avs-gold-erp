/** Canonical public URL for Supabase Auth emails. */
export function getAuthRedirectUrl(path: string): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const base = configured || window.location.origin;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
