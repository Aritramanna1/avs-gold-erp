import type { ReactNode } from "react";
import { useDeviceClass } from "@/hooks/use-device-class";

/**
 * Tablet master-detail split — landscape uses side rail + main panel.
 */
export function TabletSplitView({
  list,
  detail,
  listWidth = "minmax(240px, 32%)",
}: {
  list: ReactNode;
  detail: ReactNode;
  listWidth?: string;
}) {
  const device = useDeviceClass();
  const isTablet = device === "tablet-landscape" || device === "tablet-portrait";

  if (!isTablet) {
    return <>{detail}</>;
  }

  return (
    <div
      className="grid min-h-[calc(100vh-3.5rem)] gap-0 border-t border-border"
      style={{ gridTemplateColumns: `${listWidth} 1fr` }}
    >
      <aside className="border-r border-border overflow-y-auto bg-card/50">{list}</aside>
      <section className="overflow-y-auto">{detail}</section>
    </div>
  );
}
