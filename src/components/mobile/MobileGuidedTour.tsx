/**
 * Mobile Guided Tour — navigates the real mobile UI (hubs + People).
 * Role-aware shell only; desktop tour remains separate.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { isNativeApp, prefersMobileAppChrome } from "@/lib/native/platform";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const STORAGE_KEY = "ornexa_mobile_tour_v4";

type Step = {
  id: string;
  title: string;
  body: string;
  route: string;
};

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "Getting Started",
    body: "Home dashboard and workspace. Same ERP as desktop — mobile only changes layout.",
    route: "/app",
  },
  {
    id: "parties",
    title: "Parties",
    body: "People holds customers, firms, suppliers, and karigars with full desktop fields.",
    route: "/people",
  },
  {
    id: "gold",
    title: "Gold",
    body: "Worker Gold Book and vault flows are the accounting source of truth.",
    route: "/workshop/gold-book",
  },
  {
    id: "orders",
    title: "Orders",
    body: "Customer orders drive manufacturing. Open Orders to create and track.",
    route: "/orders",
  },
  {
    id: "manufacturing",
    title: "Manufacturing",
    body: "Workshop jobs and process queue live under Work.",
    route: "/mobile/work",
  },
  {
    id: "karigar",
    title: "Karigar",
    body: "Issue and receive gold against the gold book. Confirm before posting.",
    route: "/workshop/gold-book",
  },
  {
    id: "stock",
    title: "Stock",
    body: "Ready / tagged stock for showroom and delivery.",
    route: "/stock",
  },
  {
    id: "billing",
    title: "Billing",
    body: "Invoices and settlements under Business. Use Universal Print for documents.",
    route: "/mobile/business",
  },
  {
    id: "accounts",
    title: "Accounts",
    body: "Party ledgers and receivables — integer mg / paise only.",
    route: "/ledger",
  },
  {
    id: "reports",
    title: "Reports",
    body: "Operational and gold reports for owners.",
    route: "/reports",
  },
  {
    id: "customization",
    title: "Customization",
    body: "Branding, masters, and forms under Settings.",
    route: "/settings",
  },
  {
    id: "documents",
    title: "Documents",
    body: "Print profiles use the same Universal Print Engine on phone and desktop.",
    route: "/settings",
  },
  {
    id: "assistant",
    title: "Assistant",
    body: "Ask “Teach me AVS ERP” for this curriculum anytime. Drafts need confirm before posting.",
    route: "/assistant",
  },
  {
    id: "more",
    title: "More",
    body: "Language, Sync Status, Help, and all modules are under More.",
    route: "/mobile/more",
  },
];

export function MobileGuidedTour() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!(isNativeApp() || prefersMobileAppChrome())) return;
    if (localStorage.getItem(STORAGE_KEY) === "done") return;
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const step = STEPS[index];
    if (!step) return;
    void navigate({ to: step.route as "/app" });
  }, [open, index, navigate]);

  if (!open) return null;

  const step = STEPS[index];
  if (!step) return null;
  const isLast = index >= STEPS.length - 1;

  function finish() {
    localStorage.setItem(STORAGE_KEY, "done");
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl overflow-hidden pointer-events-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            AVS ERP mobile · {index + 1}/{STEPS.length}
          </p>
          <button type="button" aria-label={t("common.close")} onClick={finish} className="p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <h2 className="font-serif text-xl text-foreground">{step.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
        </div>
        <div className="flex items-center gap-2 px-4 pb-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={finish}>
            Skip
          </Button>
          {isLast ? (
            <Button type="button" className="flex-1" size="sm" onClick={finish}>
              Complete
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1 gap-1"
              size="sm"
              onClick={() => setIndex((i) => i + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
