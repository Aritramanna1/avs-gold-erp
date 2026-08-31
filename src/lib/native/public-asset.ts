/**
 * Public static asset URL that works on both Hostinger (`/`) and Electron file:// (`./`).
 */
export function publicAsset(path: string): string {
  const rel = path.replace(/^\//, "");
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    return `./${rel}`;
  }
  try {
    if (import.meta.env.VITE_SURFACE === "erp") return `./${rel}`;
  } catch {
    /* ignore */
  }
  return `/${rel}`;
}
