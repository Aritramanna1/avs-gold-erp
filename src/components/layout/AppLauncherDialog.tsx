import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText,
  ShieldCheck,
  Settings,
  Sliders,
  Users,
  Hammer,
  Truck,
  TrendingDown,
  Mail,
  Calculator,
  ExternalLink,
  Layers,
} from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AppLauncherItem {
  title: string;
  subtitle: string;
  to: string;
  icon: ReactNode;
  isExternal?: boolean;
}

interface AppLauncherSection {
  title: string;
  description?: string;
  items: AppLauncherItem[];
}

interface AppLauncherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppLauncherDialog({ open, onOpenChange }: AppLauncherDialogProps) {
  const { t } = useLanguage();

  const handleSelect = () => {
    onOpenChange(false);
  };

  const appSections: AppLauncherSection[] = [
    {
      title: "Documents & Tools",
      items: [
        {
          title: "Document Centre",
          subtitle: "Vault, bills & certificates",
          to: "/settings/document-vault",
          icon: <FileText className="h-5 w-5 text-blue-500" />,
        },
        {
          title: "Customization Hub",
          subtitle: "Themes, columns & layouts",
          to: "/control/customization",
          icon: <Sliders className="h-5 w-5 text-amber-500" />,
        },
        {
          title: "Expenses & Petty Cash",
          subtitle: "Shop overheads & drawings",
          to: "/expenses",
          icon: <TrendingDown className="h-5 w-5 text-red-500" />,
        },
        {
          title: "Attendance & Payroll",
          subtitle: "Staff & worker wage register",
          to: "/attendance",
          icon: <Calculator className="h-5 w-5 text-emerald-500" />,
        },
        {
          title: "Marketing & WhatsApp",
          subtitle: "Campaigns & automated alerts",
          to: "/communications",
          icon: <Mail className="h-5 w-5 text-purple-500" />,
        },
        {
          title: "System Settings",
          subtitle: "Branches, security & backup",
          to: "/settings",
          icon: <Settings className="h-5 w-5 text-zinc-400" />,
        },
      ],
    },
    {
      title: "External Portals & Public Verification",
      description: "Dedicated external surfaces for customers, karigars, and public verification",
      items: [
        {
          title: "Public Verification",
          subtitle: "Verify invoice/estimate QR tokens",
          to: "/verify",
          icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />,
          isExternal: false,
        },
        {
          title: "Customer Portal",
          subtitle: "Client orders, ledger & loyalty",
          to: "/customer-portal",
          icon: <Users className="h-5 w-5 text-cyan-500" />,
          isExternal: true,
        },
        {
          title: "Karigar Portal",
          subtitle: "Artisan gold balance & job status",
          to: "/karigar-portal",
          icon: <Hammer className="h-5 w-5 text-amber-500" />,
          isExternal: true,
        },
        {
          title: "Supplier Portal",
          subtitle: "Vendor bullion supply & invoices",
          to: "/supplier-portal",
          icon: <Truck className="h-5 w-5 text-indigo-500" />,
          isExternal: true,
        },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-md border-border p-6 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gold/10 text-gold">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                Apps & Utilities
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Secondary tools, external portals, document vaults, and configuration
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
          {appSections.map((sec, idx) => (
            <div key={idx} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {sec.title}
                </h4>
                {sec.description && (
                  <span className="text-[11px] text-muted-foreground/70 hidden sm:inline">
                    {sec.description}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sec.items.map((item, itemIdx) => (
                  <Link
                    key={itemIdx}
                    to={item.to as any}
                    onClick={handleSelect}
                    className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-background/50 hover:bg-gold/5 hover:border-gold/40 transition-all group cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-card border border-border/60 group-hover:border-gold/30 shrink-0">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium text-sm text-foreground group-hover:text-gold transition-colors">
                        <span className="truncate">{item.title}</span>
                        {item.isExternal && (
                          <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-gold" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
