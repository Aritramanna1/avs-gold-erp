import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/lib/notifications-store";

export function NotificationBell() {
  const { t } = useLanguage();
  const items = useNotifications((state) => state.items);
  const readIds = useNotifications((state) => state.readIds);
  const refresh = useNotifications((state) => state.refresh);
  const unread = items.filter((item) => !readIds.includes(item.id)).length;

  useEffect(() => {
    // Notification aggregation touches several Supabase-backed operational stores.
    // It is useful background work, but not part of the first-paint path.
    let interval: number | undefined;
    const initial = window.setTimeout(() => {
      const run = () => {
        void refresh();
        interval = window.setInterval(() => void refresh(), 60_000);
      };
      if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 3000 });
      else run();
    }, 8_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initial);
      if (interval) window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return (
    <Link
      to="/notifications"
      aria-label={t("notifications.title")}
      title={t("notifications.title")}
      className="relative h-9 w-9 grid place-items-center rounded-full border border-border hover:border-gold/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
    >
      <Bell className="h-4 w-4 text-muted-foreground" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 min-w-4 h-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground text-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
