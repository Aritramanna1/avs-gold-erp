import { Link, useRouterState } from "@tanstack/react-router";
import { Gem, Hammer, Package, Sparkles, Truck, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type NavLink =
  | {
      kind: "path";
      to: "/workshop/gold-book" | "/workshop/outside-work" | "/workshop/polishing";
      i18nKey: string;
      icon: LucideIcon;
      match: (p: string) => boolean;
    }
  | {
      kind: "process";
      type: "meena" | "kdm";
      i18nKey: string;
      icon: LucideIcon;
    };

const PRIMARY: NavLink[] = [
  {
    kind: "path",
    to: "/workshop/gold-book",
    i18nKey: "item_gold_book",
    icon: Hammer,
    match: (p) => p === "/workshop/gold-book" || p.startsWith("/workshop/gold-book/"),
  },
  {
    kind: "path",
    to: "/workshop/outside-work",
    i18nKey: "item_outside_work",
    icon: Truck,
    match: (p) =>
      p.startsWith("/workshop/outside-work") || p.startsWith("/workshop/outside-worker"),
  },
  {
    kind: "path",
    to: "/workshop/polishing",
    i18nKey: "item_polishing",
    icon: Sparkles,
    match: (p) => p.startsWith("/workshop/polishing"),
  },
  {
    kind: "process",
    type: "meena",
    i18nKey: "item_meena",
    icon: Gem,
  },
  {
    kind: "process",
    type: "kdm",
    i18nKey: "item_mfg_material_making",
    icon: Package,
  },
];

/**
 * In-module subnav for Transaction Module pages.
 *
 * Outside Work = bahar ka kaam (external party).
 * Manufacturing Material Making (legacy process key `kdm`) = internal
 * manufacturing materials made in-house.
 * Stone setting / cutting are not process books here — outsource labour is
 * paid via Receipts & Payments / Attendance & Payroll.
 */
export function TransactionModuleNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useLanguage();

  return (
    <div className="mb-6 space-y-2">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {t("navigation.group_transactions")}
      </div>
      <div className="flex flex-wrap gap-2">
        {PRIMARY.map((item) => {
          const Icon = item.icon;
          if (item.kind === "path") {
            const active = item.match(pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-xs md:text-sm font-semibold transition-all",
                  active
                    ? "border-gold bg-gold/10 text-gold shadow-xs"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-gold/40",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(`navigation.${item.i18nKey}`)}
              </Link>
            );
          }
          const active = pathname === `/workshop/process/${item.type}`;
          return (
            <Link
              key={item.type}
              to="/workshop/process/$type"
              params={{ type: item.type }}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-xs md:text-sm font-semibold transition-all",
                active
                  ? "border-gold bg-gold/10 text-gold shadow-xs"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-gold/40",
              )}
            >
              <Icon className="h-4 w-4" />
              {t(`navigation.${item.i18nKey}`)}
            </Link>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground max-w-3xl">
        Outside Work and Manufacturing Material Making give metal from firm stock (live Gold Vault).
        Polishing and Meena are manufacturing steps: send weight before → receive weight after — they
        do not issue from the vault. Sub-modules open from this strip, not as separate sidebar items.
      </p>
    </div>
  );
}
