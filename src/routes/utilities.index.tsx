import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Wrench, ArrowRight, Search } from "lucide-react";
import { OFFLINE_PARITY_CATALOG, searchOfflineParity } from "@/lib/offline-parity-catalog";

export const Route = createFileRoute("/utilities/")({
  head: () => ({ meta: [{ title: "Utilities · AVS ERP" }] }),
  component: UtilitiesHub,
});

function UtilitiesHub() {
  const [q, setQ] = useState("");
  const entries = useMemo(
    () =>
      searchOfflineParity(q).filter((e) =>
        ["utility", "master", "txn", "settings"].includes(e.kind),
      ),
    [q],
  );

  return (
    <ModuleWorkspace
      eyebrow="Offline parity"
      title="Utilities & Masters"
      description="Every Offline ERP utility/master name is listed here and opens the AVS ERP screen (live or alias). Gold Vault and money vouchers remain the only SoT."
      icon={Wrench}
      metrics={[]}
      actions={[]}
    >
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search Offline names (URD, Sauda, Rate Master…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Showing {entries.length} of{" "}
        {OFFLINE_PARITY_CATALOG.filter((e) =>
          ["utility", "master", "txn", "settings"].includes(e.kind),
        ).length}{" "}
        utilities / masters / txns
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {entries.map((e) => (
          <Link
            key={`${e.offlineName}-${e.to}`}
            to={e.to}
            search={e.search}
            className="erp-surface rounded-xl p-4 hover:border-primary/50 flex gap-3 items-start"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-sm">{e.offlineName}</h3>
                <Badge variant="outline" className="text-[10px]">
                  {e.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">AVS: {e.avsName}</p>
              <p className="text-xs text-muted-foreground mt-1">{e.description}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
          </Link>
        ))}
      </div>
    </ModuleWorkspace>
  );
}
