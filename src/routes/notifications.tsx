import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Bell, CheckCheck, CircleAlert, Info, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications, type AppNotification } from "@/lib/notifications-store";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications · ERP Gold" }] }),
  component: NotificationsPage,
});

function formatMessage(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function NotificationsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const items = useNotifications((state) => state.items);
  const readIds = useNotifications((state) => state.readIds);
  const loading = useNotifications((state) => state.loading);
  const lastRefreshedAt = useNotifications((state) => state.lastRefreshedAt);
  const refresh = useNotifications((state) => state.refresh);
  const markRead = useNotifications((state) => state.markRead);
  const markAllRead = useNotifications((state) => state.markAllRead);
  const [tab, setTab] = useState<"all" | "unread">("all");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(
    () => (tab === "unread" ? items.filter((item) => !readIds.includes(item.id)) : items),
    [items, readIds, tab],
  );
  const unread = items.filter((item) => !readIds.includes(item.id)).length;

  function open(item: AppNotification) {
    markRead(item.id);
    void navigate({ to: item.href as never });
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => void refresh()}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {t("notifications.refresh")}
            </Button>
            <Button variant="outline" className="gap-2" onClick={markAllRead} disabled={!unread}>
              <CheckCheck className="h-4 w-4" /> {t("notifications.mark_all_read")}
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-4 shadow-elegant">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(value) => setTab(value as "all" | "unread")}>
            <TabsList>
              <TabsTrigger value="all">{t("notifications.all")}</TabsTrigger>
              <TabsTrigger value="unread">
                {t("notifications.unread")} {unread > 0 && `(${unread})`}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {lastRefreshedAt && (
            <p className="text-xs text-muted-foreground">
              {t("notifications.updated")} {new Date(lastRefreshedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-center">
            <div>
              <Bell className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <h2 className="mt-3 font-serif text-xl text-gold">
                {tab === "unread"
                  ? t("notifications.no_unread_title")
                  : t("notifications.empty_title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("notifications.empty_description")}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((item) => {
              const isRead = readIds.includes(item.id);
              const Icon =
                item.severity === "critical"
                  ? CircleAlert
                  : item.severity === "warning"
                    ? AlertTriangle
                    : Info;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => open(item)}
                  className="flex w-full gap-3 px-2 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                >
                  <span
                    className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                      item.severity === "critical"
                        ? "bg-destructive/10 text-destructive"
                        : item.severity === "warning"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t(item.titleKey)}</span>
                      {!isRead && <span className="h-2 w-2 rounded-full bg-gold" />}
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {t(`notifications.severity_${item.severity}`)}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {formatMessage(t(item.descriptionKey), item.descriptionValues)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
