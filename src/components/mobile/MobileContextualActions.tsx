import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Phone,
  MessageCircle,
  Briefcase,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  BookOpen,
  Printer,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import type { Person } from "@/lib/people-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { hasRoutePermission } from "@/lib/permissions";
import { useSettings } from "@/lib/settings-store";
import { hapticLight } from "@/lib/native/haptics";
import { isNativeApp } from "@/lib/native/platform";
import { shareContent } from "@/lib/native/share";

type ActionItem = {
  id: string;
  label: string;
  icon: typeof Phone;
  onClick: () => void;
  permissionPath?: string;
  show?: boolean;
};

/**
 * Sticky contextual actions for party detail — permission-gated, one primary + overflow sheet.
 */
export function MobileContextualActions({ person }: { person: Person }) {
  const navigate = useNavigate();
  const role = useSettings((s) => s.currentUserRole);
  const [open, setOpen] = useState(false);

  const isCustomerLike = person.type === "customer" || person.type === "firm_customer";
  const isKarigarLike = ["karigar", "worker", "outside_karigar", "outside_worker"].includes(
    person.type,
  );
  const phoneDigits = person.phone?.replace(/\D/g, "") ?? "";

  const actions = useMemo(() => {
    const list: ActionItem[] = [
      {
        id: "call",
        label: "Call",
        icon: Phone,
        show: phoneDigits.length >= 10,
        onClick: () => {
          window.location.href = `tel:${phoneDigits}`;
        },
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        icon: MessageCircle,
        show: phoneDigits.length >= 10,
        onClick: () => {
          const text = `Hello, this is regarding ${person.fullName}.`;
          void shareContent({
            title: person.fullName,
            text: person.phone ? `${text}\n${person.phone}` : text,
          });
        },
      },
      {
        id: "share",
        label: "Share contact",
        icon: Share2,
        show: !!person.fullName,
        onClick: () => {
          const text = [person.fullName, person.phone, person.tradeName]
            .filter(Boolean)
            .join(" · ");
          void shareContent({ title: person.fullName, text });
        },
      },
      {
        id: "order",
        label: "New order",
        icon: Briefcase,
        permissionPath: "/orders/new",
        show: isCustomerLike,
        onClick: () => void navigate({ to: "/orders/new" }),
      },
      {
        id: "invoice",
        label: "Invoice",
        icon: FileText,
        permissionPath: "/billing",
        show: isCustomerLike,
        onClick: () => void navigate({ to: "/billing", search: { new: "1" } as never }),
      },
      {
        id: "issue",
        label: "Issue gold",
        icon: ArrowUpRight,
        permissionPath: "/workshop/gold-book",
        show: isKarigarLike,
        onClick: () =>
          void navigate({
            to: "/workshop/gold-book",
            search: { mode: "issue" } as never,
          }),
      },
      {
        id: "receive",
        label: "Receive gold",
        icon: ArrowDownLeft,
        permissionPath: "/workshop/gold-book",
        show: isKarigarLike,
        onClick: () =>
          void navigate({
            to: "/workshop/gold-book",
            search: { mode: "receive" } as never,
          }),
      },
      {
        id: "ledger",
        label: "Ledger",
        icon: BookOpen,
        permissionPath: "/ledger",
        onClick: () => void navigate({ to: "/ledger" }),
      },
      {
        id: "print",
        label: "Print KYC",
        icon: Printer,
        permissionPath: "/people",
        onClick: () =>
          void navigate({
            to: "/people/print/$id" as "/people",
            params: { id: person.id } as never,
          }),
      },
    ];

    return list.filter((a) => {
      if (a.show === false) return false;
      if (a.permissionPath && !hasRoutePermission(role, a.permissionPath)) return false;
      return true;
    });
  }, [isCustomerLike, isKarigarLike, navigate, person, phoneDigits, role]);

  if (!isNativeApp() && typeof window !== "undefined" && window.innerWidth >= 1024) {
    return null;
  }

  if (actions.length === 0) return null;

  const primary = actions[0];
  const PrimaryIcon = primary.icon;

  return (
    <>
      <div className="lg:hidden sticky bottom-[calc(var(--mobile-nav-height,4.25rem)+var(--ornexa-inset-bottom))] z-20 -mx-1 mt-3 flex gap-2 border-t border-border bg-card/95 px-1 pt-2 pb-2 backdrop-blur-sm">
        <Button
          type="button"
          className="flex-1 min-h-[var(--touch-target)] bg-gold text-black hover:bg-gold/90 font-semibold gap-2"
          onClick={() => {
            void hapticLight();
            primary.onClick();
          }}
        >
          <PrimaryIcon className="h-4 w-4" />
          {primary.label}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-[var(--touch-target)] min-w-[var(--touch-target)] px-3"
          aria-label="More actions"
          onClick={() => {
            void hapticLight();
            setOpen(true);
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="font-serif text-gold">{person.fullName}</SheetTitle>
          </SheetHeader>
          <ul className="grid gap-1.5 pb-4">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 min-h-[var(--touch-target)] rounded-xl border border-border px-3 py-2.5 text-left hover:border-gold/40"
                    onClick={() => {
                      void hapticLight();
                      setOpen(false);
                      a.onClick();
                    }}
                  >
                    <Icon className="h-4 w-4 text-gold" />
                    <span className="text-sm font-semibold">{a.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
