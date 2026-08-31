/**
 * Renders mobile or desktop UI from the same route — one URL, adaptive presentation.
 */
import type { ReactNode } from "react";
import { useDeviceClass, type DeviceClass } from "@/hooks/use-device-class";

export function AdaptiveView({
  mobile,
  desktop,
  tablet,
}: {
  mobile: ReactNode;
  desktop: ReactNode;
  /** Optional tablet-specific view; falls back to desktop */
  tablet?: ReactNode;
}) {
  const device = useDeviceClass();
  if (device === "mobile") return <>{mobile}</>;
  if (tablet && (device === "tablet-portrait" || device === "tablet-landscape")) {
    return <>{tablet}</>;
  }
  return <>{desktop}</>;
}

export function useIsMobileLayout(): boolean {
  return useDeviceClass() === "mobile";
}

export function useIsDesktopLayout(): boolean {
  const d = useDeviceClass();
  return d === "desktop" || d === "tablet-landscape";
}

export function deviceLayoutLabel(device: DeviceClass): string {
  switch (device) {
    case "mobile":
      return "mobile";
    case "tablet-portrait":
    case "tablet-landscape":
      return "tablet";
    default:
      return "desktop";
  }
}
