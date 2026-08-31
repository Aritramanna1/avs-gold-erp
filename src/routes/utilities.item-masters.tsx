import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemGroupsPanel } from "@/components/catalog/ItemGroupsPanel";

export const Route = createFileRoute("/utilities/item-masters")({
  validateSearch: (s: Record<string, unknown>): { tab?: string } => ({
    tab:
      typeof s.tab === "string" && ["items", "groups", "stamps", "types"].includes(s.tab)
        ? s.tab
        : "items",
  }),
  head: () => ({ meta: [{ title: "Item Masters · AVS ERP" }] }),
  component: ItemMastersPage,
});

function ItemMastersPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Item Masters"
        subtitle="Offline Item Master / Group / Stamp / Type — mapped to AVS catalog, purity, and stock"
        actions={<SourceOfTruthBadge variant="report" />}
      />
      <Tabs
        value={tab || "items"}
        onValueChange={(next) => {
          void navigate({
            to: "/utilities/item-masters",
            search: { tab: next },
            replace: true,
          });
        }}
      >
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="items">Item Master</TabsTrigger>
          <TabsTrigger value="groups">Item Group</TabsTrigger>
          <TabsTrigger value="stamps">Item Stamps</TabsTrigger>
          <TabsTrigger value="types">Item Type</TabsTrigger>
        </TabsList>
        <TabsContent value="items" className="erp-surface rounded-xl p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            SKU / design / stock items live in Catalog and Ready Stock.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/catalog/masters">Item Master (SKU registry)</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/catalog">Catalog & Designs</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/stock">Ready Stock</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/stock/entry">Stock Entry / Opening</Link>
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="groups" className="erp-surface rounded-xl p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Firm-scoped item groups for Master Items, stock categories, and reports.
          </p>
          <ItemGroupsPanel />
        </TabsContent>
        <TabsContent value="stamps" className="erp-surface rounded-xl p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Purity stamps (916‰, 750‰, …) and fineness basis are under Settings / Customization
            calculations.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/settings" search={{ tab: "purity" }}>
                Purity / Stamps
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/control/customization">Gold calculation rules</Link>
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="types" className="erp-surface rounded-xl p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Metal types (gold / silver / alloy) use manufacturing materials and conversion.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/conversion">Metal Conversion</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/settings" search={{ tab: "firm" }}>
                Firm metal defaults
              </Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
