import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  ArrowRight,
  ClipboardList,
  Scale,
  Users,
  Package,
  FileSpreadsheet,
  Receipt,
  ShieldAlert,
} from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
export const Route = createFileRoute("/reports/")({ component: ReportsWorkspace });
const reports = [
  {
    label: "Gold summary",
    description: "Vault, karigar, customer, and finished-goods position.",
    to: "/reports/gold-summary",
    icon: Scale,
  },
  {
    label: "Gold outstanding",
    description: "Customer and workshop balances requiring action.",
    to: "/reports/gold-outstanding",
    icon: Users,
  },
  {
    label: "Manufacturing",
    description: "Production movement, loss, recovery, and delay views.",
    to: "/reports/manufacturing",
    icon: ClipboardList,
  },
  {
    label: "Inventory ageing",
    description: "Ready stock by age, status, and location.",
    to: "/reports/inventory-ageing",
    icon: Package,
  },
  {
    label: "Tally export",
    description: "Sales, purchase, and receipt vouchers as a Tally XML import file.",
    to: "/reports/tally-export",
    icon: FileSpreadsheet,
  },
  {
    label: "GST returns",
    description: "GSTR-1 (B2B) and GSTR-3B summary exports for the GST portal.",
    to: "/reports/gst-returns",
    icon: Receipt,
  },
  {
    label: "Auditor workspace",
    description:
      "Verify immutable audit logs, check financial year locks, and manage freeze status.",
    to: "/reports/auditor",
    icon: ShieldAlert,
  },
];
function ReportsWorkspace() {
  return (
    <ModuleWorkspace
      eyebrow="Decision support"
      title="Reports"
      description="Choose a report from the live reporting suite. Each report owns its filters, export, print, and empty states."
      icon={BarChart3}
      metrics={[]}
      actions={[]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {reports.map(({ label, description, to, icon: Icon }) => (
          <Link
            className="erp-surface group rounded-md p-5 hover:border-primary/50"
            key={to}
            to={to}
          >
            <div className="flex items-start justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
            <h2 className="mt-5 font-semibold">{label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </ModuleWorkspace>
  );
}
