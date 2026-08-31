/**
 * Device class detection for intentional Desktop / Tablet / Mobile UX.
 * Breakpoints align with ADAPTIVE_UI_MASTER.md — one business logic, three ergonomics.
 */
import { useEffect, useState } from "react";
import { isDesktopApp, isNativeApp } from "@/lib/native/platform";

export type DeviceClass = "mobile" | "tablet-portrait" | "tablet-landscape" | "desktop";
export type LayoutAttribute = "mobile" | "tablet" | "desktop";

const QUERIES = {
  mobile: "(max-width: 767px)",
  // iPad Pro portrait is often 1024 CSS px — include through 1279 so it is not
  // misclassified as desktop (desktop starts at 1280).
  tabletPortrait: "(min-width: 768px) and (max-width: 1279px) and (orientation: portrait)",
  tabletLandscape: "(min-width: 768px) and (max-width: 1279px) and (orientation: landscape)",
  desktop: "(min-width: 1280px)",
} as const;

function resolveClass(): DeviceClass {
  if (typeof window === "undefined") return "desktop";
  if (window.matchMedia(QUERIES.mobile).matches) return "mobile";
  if (window.matchMedia(QUERIES.tabletPortrait).matches) return "tablet-portrait";
  if (window.matchMedia(QUERIES.tabletLandscape).matches) return "tablet-landscape";
  return "desktop";
}

export function layoutFromDevice(device: DeviceClass): LayoutAttribute {
  if (device === "mobile") return "mobile";
  if (device === "tablet-portrait" || device === "tablet-landscape") return "tablet";
  return "desktop";
}

/** Apply layout attributes used by CSS (`html[data-layout]` / `data-device`). */
export function applyDeviceLayoutAttributes(device: DeviceClass = resolveClass()): void {
  if (typeof document === "undefined") return;
  const layout = layoutFromDevice(device);
  document.documentElement.dataset.device = device;
  document.documentElement.dataset.layout = layout;
}

export function useDeviceClass(): DeviceClass {
  const [deviceClass, setDeviceClass] = useState<DeviceClass>(() => resolveClass());

  useEffect(() => {
    const update = () => {
      const next = resolveClass();
      setDeviceClass(next);
      applyDeviceLayoutAttributes(next);
    };
    update();
    const mqs = Object.values(QUERIES).map((q) => window.matchMedia(q));
    mqs.forEach((mq) => mq.addEventListener("change", update));
    window.addEventListener("resize", update);
    return () => {
      mqs.forEach((mq) => mq.removeEventListener("change", update));
      window.removeEventListener("resize", update);
    };
  }, []);

  return deviceClass;
}

export function isMobileDevice(): boolean {
  return resolveClass() === "mobile";
}

export function isTabletDevice(): boolean {
  const c = resolveClass();
  return c === "tablet-portrait" || c === "tablet-landscape";
}

/**
 * Phone chrome only (bottom nav, card lists).
 * Native tablets must NOT collapse into phone chrome — they use tablet layout.
 */
export function usePhoneChrome(): boolean {
  const device = useDeviceClass();
  if (isDesktopApp()) return false;
  if (device === "mobile") return true;
  // Native phone builds report as mobile width; native iPad reports tablet breakpoints.
  return false;
}

/** iPad / tablet chrome — Sheet nav, touch tables, no phone bottom nav. */
export function useTabletChrome(): boolean {
  const device = useDeviceClass();
  if (isDesktopApp()) return false;
  return device === "tablet-portrait" || device === "tablet-landscape";
}

/** @deprecated Prefer usePhoneChrome — kept for call sites that meant “compact chrome”. */
export function useIsMobileChrome(): boolean {
  const phone = usePhoneChrome();
  const native = isNativeApp();
  const device = useDeviceClass();
  // Preserve prior native-phone behavior; do not force native iPad into phone chrome.
  if (native && device === "mobile") return true;
  return phone;
}
