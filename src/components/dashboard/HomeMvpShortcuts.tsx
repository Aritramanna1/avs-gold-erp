import { Link } from "@tanstack/react-router";
import {
  Receipt,
  Scale,
  Hammer,
  Users,
  CalendarCheck,
} from "lucide-react";

/**
 * AVS-32 MVP-HOME / AVS-4 locked shortcuts.
 * Wire to EXISTING tip routes only — miss/disabled OK if route missing; do not invent.
 */
const SHORTCUTS = [
  {
    id: "sell",
    label: "Sell",
    to: "/billing",
    icon: Receipt,
    primary: true,
  },
  {
    id: "old-gold",
    label: "Old gold",
    to: "/utilities/urd-purchase",
    icon: Scale,
    primary: false,
  },
  {
    id: "give-metal",
    label: "Give metal",
    to: "/workshop/gold-book",
    icon: Hammer,
    primary: false,
  },
  {
    id: "who-owes",
    label: "Who owes",
    to: "/reports/ledgers",
    icon: Users,
    primary: false,
  },
  {
    id: "day-done",
    label: "Day done",
    to: "/reports/daily-close",
    icon: CalendarCheck,
    primary: false,
  },
] as const;

export function HomeMvpShortcuts() {
  return (
    <section className="mb-6" aria-labelledby="home-mvp-shortcuts-heading" data-tour="home-mvp-shortcuts">
      <h2 id="home-mvp-shortcuts-heading" className="erp-section-title mb-3">
        Shortcuts
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {SHORTCUTS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={item.to}
              className={`flex items-center gap-2 rounded-md border px-3 py-3 text-sm font-medium transition-colors min-h-[48px] ${
                item.primary
                  ? "border-gold/50 bg-gold text-black hover:bg-gold/90 font-semibold"
                  : "border-border bg-card hover:border-gold/40 hover:bg-gold/5"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${item.primary ? "text-black" : "text-gold"}`} aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
