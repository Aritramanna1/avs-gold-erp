/**
 * Device class detection for intentional Desktop / Tablet / Mobile UX.
 * Breakpoints align with ADAPTIVE_UI_MASTER.md and responsive test matrix.
 */
import { useEffect, useState } from "react";

export type DeviceClass = "mobile" | "tablet-portrait" | "tablet-landscape" | "desktop";

const QUERIES = {
  mobile: "(max-width: 767px)",
  tabletPortrait: "(min-width: 768px) and (max-width: 1023px) and (orientation: portrait)",
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

export function useDeviceClass(): DeviceClass {
  const [deviceClass, setDeviceClass] = useState<DeviceClass>(() => resolveClass());

  useEffect(() => {
    const update = () => {
      const next = resolveClass();
      setDeviceClass(next);
      if (typeof document !== "undefined") {
        document.documentElement.dataset.device = next;
        document.documentElement.dataset.layout =
          next === "mobile" ? "mobile" : next.startsWith("tablet") ? "tablet" : "desktop";
      }
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
