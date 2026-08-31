/** Runtime surface detection — web, Capacitor native, Electron desktop. */

declare global {
  interface Window {
    mtjDesktop?: unknown;
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.mtjDesktop) return true;
  try {
    return /Electron/i.test(navigator.userAgent || "");
  } catch {
    return false;
  }
}

export function isErpSurface(): boolean {
  return true;
}

export function isPackagedErpSurface(): boolean {
  return isNativeApp() || isDesktopApp() || isErpSurface();
}

export type NativePlatform = "ios" | "android" | "web";

export function nativePlatform(): NativePlatform {
  if (!isNativeApp()) return "web";
  const platform =
    typeof window !== "undefined" ? window.Capacitor?.getPlatform?.() : undefined;
  if (platform === "ios") return "ios";
  if (platform === "android") return "android";
  return "web";
}

export function prefersMobileAppChrome(): boolean {
  if (isDesktopApp()) return false;
  if (isNativeApp()) return true;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function hideCommercialPaymentUi(): boolean {
  return isNativeApp();
}
