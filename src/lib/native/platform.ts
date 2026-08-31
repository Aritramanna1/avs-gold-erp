/**
 * Detect whether AVS ERP is running inside the Capacitor native shell
 * or the Electron desktop shell.
 * Uses window.Capacitor only so web builds do not require @capacitor/core.
 */
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
    mtjDesktop?: unknown;
  }
}

/** True when packaged as Android/iOS via Capacitor (not mobile browser). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/**
 * True inside the Electron desktop shell (preload bridge or Electron UA).
 */
export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.mtjDesktop) return true;
  try {
    return /Electron/i.test(navigator.userAgent || "");
  } catch {
    return false;
  }
}

/** Vite bake flag: desktop/Capacitor prepare scripts set `erp`; Hostinger web stays marketing. */
export function isErpSurface(): boolean {
  try {
    return import.meta.env.VITE_SURFACE === "erp";
  } catch {
    return false;
  }
}

/**
 * Packaged ERP (Capacitor, Electron, or VITE_SURFACE=erp bake).
 */
export function isPackagedErpSurface(): boolean {
  return isNativeApp() || isDesktopApp() || isErpSurface();
}

export function nativePlatform(): "ios" | "android" | "web" {
  if (!isNativeApp()) return "web";
  const p = typeof window !== "undefined" ? window.Capacitor?.getPlatform?.() : undefined;
  if (p === "ios") return "ios";
  if (p === "android") return "android";
  return "web";
}

/**
 * Mobile ERP layout — native phone app OR phone-width browser.
 */
export function prefersMobileAppChrome(): boolean {
  if (isDesktopApp()) return false;
  if (isNativeApp()) return true;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

/** Commercial SaaS checkout must not appear inside the mobile V1 APK. Desktop may keep it. */
export function hideCommercialPaymentUi(): boolean {
  return isNativeApp();
}
