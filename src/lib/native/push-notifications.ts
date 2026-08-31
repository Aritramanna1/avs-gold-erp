/**
 * Capacitor Push Notifications â€” request permission, register, bind FCM token to Supabase.
 */
import { Preferences } from "@capacitor/preferences";
import { PushNotifications } from "@capacitor/push-notifications";
import { isNativeApp } from "@/lib/native/platform";
import { getOrCreateDeviceId } from "@/lib/security/device-registry";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { handlePushDeepLink } from "@/lib/notifications/deep-link";

const ENABLED_KEY = "ornexa.push.enabled.v1";
const TOKEN_KEY = "ornexa.push.token.v1";

export type PushPermissionState = "prompt" | "granted" | "denied" | "unsupported";

let listenersAttached = false;
let presenceBound = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_MS = 60_000;

function nativePlatform(): "android" | "ios" {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() === "ios" ? "ios" : "android";
}

async function bindTokenToServer(token: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  await (supabase as any).rpc("register_push_endpoint", {
    p_device_id: deviceId,
    p_platform: nativePlatform(),
    p_fcm_token: token,
    p_web_subscription: undefined,
    p_permission_state: "granted",
    p_app_version: import.meta.env.VITE_APP_VERSION,
    p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  });
}

async function updateNativePresence(presence: "foreground" | "background"): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  await (supabase as any).rpc("update_push_presence", {
    p_device_id: deviceId,
    p_platform: nativePlatform(),
    p_presence: presence,
  });
}

async function attachListeners(): Promise<void> {
  if (listenersAttached || !isNativeApp()) return;
  listenersAttached = true;

  await PushNotifications.addListener("registration", (token) => {
    void Preferences.set({ key: TOKEN_KEY, value: token.value });
    void bindTokenToServer(token.value);
  });

  await PushNotifications.addListener("registrationError", (err) => {
    console.warn("[OrnexaPush] registrationError", err.error);
  });

  await PushNotifications.addListener("pushNotificationReceived", () => {
    void import("@/lib/notifications-store").then(({ useNotifications }) =>
      useNotifications.getState().refresh(),
    );
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification.data as {
      href?: string;
      notificationId?: string;
    };
    void handlePushDeepLink(data.href, data.notificationId);
  });

  if (typeof document !== "undefined") {
    if (!presenceBound) {
      presenceBound = true;
      const sync = () =>
        void updateNativePresence(document.visibilityState === "visible" ? "foreground" : "background");
      document.addEventListener("visibilitychange", sync);
      window.addEventListener("focus", () => void updateNativePresence("foreground"));
      window.addEventListener("blur", () => void updateNativePresence("background"));
      sync();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (document.visibilityState === "visible") void updateNativePresence("foreground");
      }, HEARTBEAT_MS);
    }
  }
}

export async function getPushEnabledPreference(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: ENABLED_KEY });
    if (value == null) return false;
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

export async function setPushEnabledPreference(enabled: boolean): Promise<void> {
  await Preferences.set({ key: ENABLED_KEY, value: enabled ? "1" : "0" });
}

export async function getStoredPushToken(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value || null;
  } catch {
    return null;
  }
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (!isNativeApp()) return "unsupported";
  try {
    const status = await PushNotifications.checkPermissions();
    if (status.receive === "granted") return "granted";
    if (status.receive === "denied") return "denied";
    return "prompt";
  } catch {
    return "unsupported";
  }
}

/** Request OS permission and register for FCM/APNs when user enables notifications. */
export async function enablePushNotifications(): Promise<{
  ok: boolean;
  permission: PushPermissionState;
  token: string | null;
  error?: string;
}> {
  if (!isNativeApp()) {
    return { ok: false, permission: "unsupported", token: null, error: "Not a native app" };
  }
  try {
    await attachListeners();
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      await setPushEnabledPreference(false);
      return {
        ok: false,
        permission: perm.receive === "denied" ? "denied" : "prompt",
        token: null,
        error: "Notification permission denied",
      };
    }
    await setPushEnabledPreference(true);
    await PushNotifications.register();
    const token = await getStoredPushToken();
    if (token) await bindTokenToServer(token);
    void updateNativePresence("foreground");
    return { ok: true, permission: "granted", token };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, permission: "prompt", token: null, error: msg };
  }
}

export async function disablePushNotifications(): Promise<void> {
  await setPushEnabledPreference(false);
  const deviceId = await getOrCreateDeviceId();
  await (supabase as any).rpc("unregister_push_endpoint", {
    p_device_id: deviceId,
    p_platform: nativePlatform(),
  });
}

/**
 * Boot: if user previously enabled notifications and permission still granted, re-register.
 */
export async function initPushNotificationsIfEnabled(): Promise<void> {
  if (!isNativeApp()) return;
  const enabled = await getPushEnabledPreference();
  if (!enabled) return;
  const state = await getPushPermissionState();
  if (state !== "granted") return;
  try {
    await attachListeners();
    await PushNotifications.register();
    const token = await getStoredPushToken();
    if (token) await bindTokenToServer(token);
    void updateNativePresence("foreground");
  } catch (e) {
    console.warn("[OrnexaPush] init failed", e);
  }
}

