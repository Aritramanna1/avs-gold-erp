/**
 * Native haptic feedback — Capacitor Haptics on device, no-op on web.
 */
import { isNativeApp } from "@/lib/native/platform";

export async function hapticLight(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle } = await import(/* @vite-ignore */ "@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* optional */
  }
}

export async function hapticMedium(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle } = await import(/* @vite-ignore */ "@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    /* optional */
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Haptics, NotificationType } = await import(/* @vite-ignore */ "@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* optional */
  }
}

export async function hapticError(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Haptics, NotificationType } = await import(/* @vite-ignore */ "@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Error });
  } catch {
    /* optional */
  }
}
