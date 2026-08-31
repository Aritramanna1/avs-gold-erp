/**
 * Firebase Web Push â€” permission, token registration, foreground onMessage, presence heartbeat.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { getOrCreateDeviceId } from "@/lib/security/device-registry";
import { isDesktopApp, isNativeApp } from "@/lib/native/platform";
import { toast } from "sonner";
import { useNotifications } from "@/lib/notifications-store";
import { normalizeNotificationHref } from "@/lib/notifications/href-policy";

const ENABLED_KEY = "ornexa.webpush.enabled.v1";
const HEARTBEAT_MS = 60_000;
const SW_READY_TIMEOUT_MS = 8_000;

async function waitForServiceWorker(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return;
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("service worker ready timeout")), SW_READY_TIMEOUT_MS),
    ),
  ]);
}

function firebaseConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();
  if (!apiKey || !projectId || !messagingSenderId || !appId) return null;
  return {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`,
    projectId,
    messagingSenderId,
    appId,
  };
}

function vapidKey(): string | null {
  return import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim() || null;
}

export function isWebPushConfigured(): boolean {
  return Boolean(firebaseConfig() && vapidKey());
}

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let presenceBound = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (app) return app;
  const cfg = firebaseConfig();
  if (!cfg) return null;
  app = getApps().length ? getApps()[0]! : initializeApp(cfg);
  return app;
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messaging) return messaging;
  const fb = getFirebaseApp();
  if (!fb || typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    messaging = getMessaging(fb);
    return messaging;
  } catch {
    return null;
  }
}

async function postFirebaseConfigToSw(reg: ServiceWorkerRegistration): Promise<void> {
  const cfg = firebaseConfig();
  if (!cfg) return;
  const sw = reg.active ?? reg.waiting ?? reg.installing;
  sw?.postMessage({ type: "firebase-config", config: cfg });
}

export async function getWebPushEnabledPreference(): Promise<boolean> {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

async function setWebPushEnabledPreference(enabled: boolean): Promise<void> {
  localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
}

async function registerWebEndpoint(token: string): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  await (supabase as any).rpc("register_push_endpoint", {
    p_device_id: deviceId,
    p_platform: "web",
    p_fcm_token: token,
    p_web_subscription: undefined,
    p_permission_state: "granted",
    p_app_version: import.meta.env.VITE_APP_VERSION,
    p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  });
}

async function updatePresence(presence: "foreground" | "background"): Promise<void> {
  const deviceId = await getOrCreateDeviceId();
  await (supabase as any).rpc("update_push_presence", {
    p_device_id: deviceId,
    p_platform: "web",
    p_presence: presence,
  });
}

function bindPresenceHeartbeat(): void {
  if (presenceBound || typeof document === "undefined") return;
  presenceBound = true;
  const sync = () =>
    void updatePresence(document.visibilityState === "visible" ? "foreground" : "background");
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("focus", () => void updatePresence("foreground"));
  window.addEventListener("blur", () => void updatePresence("background"));
  sync();
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === "visible") void updatePresence("foreground");
  }, HEARTBEAT_MS);
}

export async function enableWebPush(): Promise<{ ok: boolean; error?: string }> {
  if (isNativeApp() || isDesktopApp()) {
    return { ok: false, error: "Use device settings in the native app" };
  }
  if (!isWebPushConfigured()) {
    return { ok: false, error: "Web push is not configured for this deployment" };
  }
  if (!("Notification" in window)) {
    return { ok: false, error: "Notifications not supported in this browser" };
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    await setWebPushEnabledPreference(false);
    return { ok: false, error: "Permission denied" };
  }

  try {
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await waitForServiceWorker(reg);
    await postFirebaseConfigToSw(reg);
    const msg = await getMessagingInstance();
    if (!msg) return { ok: false, error: "Messaging unavailable" };
    const token = await getToken(msg, { vapidKey: vapidKey()!, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, error: "Could not obtain FCM token" };
    await registerWebEndpoint(token);
    await setWebPushEnabledPreference(true);
    bindPresenceHeartbeat();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function disableWebPush(): Promise<void> {
  await setWebPushEnabledPreference(false);
  const deviceId = await getOrCreateDeviceId();
  await (supabase as any).rpc("unregister_push_endpoint", { p_device_id: deviceId, p_platform: "web" });
}

export async function initWebPushIfEnabled(): Promise<void> {
  if (isNativeApp() || isDesktopApp() || !isWebPushConfigured()) return;

  const enabled = await getWebPushEnabledPreference();
  if (!enabled || Notification.permission !== "granted") return;

  bindPresenceHeartbeat();
  void import("@/lib/notifications/deep-link").then((m) => m.installPushMessageListener());

  const msg = await getMessagingInstance();
  if (!msg) return;

  onMessage(msg, (payload) => {
    const data = payload.data ?? {};
    const title = data.title ?? payload.notification?.title ?? "AVS ERP";
    const body = data.body ?? payload.notification?.body ?? "";
    toast(title, { description: body });
    void useNotifications.getState().refresh();
    const href = normalizeNotificationHref(data.href);
    if (href && data.notificationId) {
      void import("@/lib/notifications/deep-link").then((m) =>
        m.handlePushDeepLink(href, String(data.notificationId)),
      );
    }
  });

  try {
    let reg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (!reg) {
      reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    }
    await waitForServiceWorker(reg);
    await postFirebaseConfigToSw(reg);
    const token = await getToken(msg, { vapidKey: vapidKey()!, serviceWorkerRegistration: reg });
    if (token) await registerWebEndpoint(token);
  } catch (e) {
    console.warn("[WebPush] init failed", e);
  }
}

