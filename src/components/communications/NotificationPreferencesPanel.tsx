/**
 * Per-event notification preferences — channels, recipients, schedule.
 */
import { useEffect, useState } from "react";
import { Panel } from "@/components/design-system";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  fetchEventCatalog,
  fetchNotificationPreferences,
  upsertNotificationPreference,
  type NotificationPreference,
} from "@/lib/comm/platform/notification-preferences-store";
import type { CommunicationChannel } from "@/lib/comm/platform/communication-events";
import { toast } from "sonner";

export function NotificationPreferencesPanel({ branchId }: { branchId: string }) {
  const [catalog, setCatalog] = useState<
    Array<{ eventKey: string; displayName: string; defaultChannels: CommunicationChannel[] }>
  >([]);
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [cat, pr] = await Promise.all([
        fetchEventCatalog(),
        fetchNotificationPreferences({ branchId }),
      ]);
      setCatalog(cat);
      setPrefs(pr);
      setLoading(false);
    })();
  }, [branchId]);

  function prefFor(eventKey: string) {
    return prefs.find((p) => p.eventKey === eventKey);
  }

  async function toggle(
    eventKey: string,
    enabled: boolean,
    defaultChannels: CommunicationChannel[],
  ) {
    const existing = prefFor(eventKey);
    const result = await upsertNotificationPreference({
      id: existing?.id,
      eventKey: eventKey as NotificationPreference["eventKey"],
      branchId,
      enabled,
      channels: existing?.channels ?? defaultChannels,
      recipients: existing?.recipients ?? [],
    });
    if (result) {
      setPrefs((prev) => {
        const rest = prev.filter((p) => p.eventKey !== eventKey);
        return [...rest, result];
      });
      toast.success(enabled ? "Notification enabled" : "Notification disabled");
    }
  }

  async function setChannel(eventKey: string, channel: CommunicationChannel, on: boolean) {
    const existing = prefFor(eventKey);
    const channels = new Set<CommunicationChannel>(existing?.channels ?? ["email"]);
    if (on) channels.add(channel);
    else channels.delete(channel);
    if (channels.size === 0) channels.add("email");
    const channelList: CommunicationChannel[] = Array.from(channels);
    const result = await upsertNotificationPreference({
      id: existing?.id,
      eventKey: eventKey as NotificationPreference["eventKey"],
      branchId,
      enabled: existing?.enabled ?? true,
      channels: channelList,
      recipients: existing?.recipients ?? [],
    });
    if (result) {
      setPrefs((prev) => [...prev.filter((p) => p.eventKey !== eventKey), result]);
    }
  }

  if (loading) return <p className="text-xs text-muted-foreground p-4">Loading preferences…</p>;

  return (
    <Panel
      title="Notification Preferences"
      description="Per-event channel routing. Email is default for scheduled reports and low-cost automation."
    >
      <div className="space-y-3">
        {catalog.map((ev) => {
          const p = prefFor(ev.eventKey);
          const enabled = p?.enabled ?? false;
          const channels = p?.channels ?? ev.defaultChannels;
          return (
            <div
              key={ev.eventKey}
              className="flex flex-col gap-2 border-b border-border pb-3 last:border-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{ev.displayName}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{ev.eventKey}</p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => void toggle(ev.eventKey, v, ev.defaultChannels)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["email", "whatsapp", "in_app"] as CommunicationChannel[]).map((ch) => (
                  <Badge
                    key={ch}
                    variant={channels.includes(ch) ? "default" : "outline"}
                    className="cursor-pointer text-[10px]"
                    onClick={() => void setChannel(ev.eventKey, ch, !channels.includes(ch))}
                  >
                    {ch}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
