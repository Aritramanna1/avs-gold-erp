/**
 * Platform Owner — Central Add-ons Manager
 * Authoritative configurator for platform add-on modules, quotas, and pricing.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Plus,
  Save,
  Search,
  RefreshCw,
  Edit2,
  Copy,
  Power,
  PowerOff,
  Check,
  Tag,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface PlatformAddonRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  price_minor: number;
  currency: string;
  billing_frequency: "monthly" | "annual" | "one_time";
  is_recurring: boolean;
  is_active: boolean;
  entitlements: Record<string, any>;
  limits: {
    additional_users?: number;
    additional_branches?: number;
    additional_storage_gb?: number;
    whatsapp_messages?: number;
  };
  display_order: number;
  applicable_plans: string[]; // empty array = all plans
  tax_behavior: "standard" | "exempt" | "nil_rated";
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_PLATFORM_ADDONS: PlatformAddonRecord[] = [
  {
    id: "addon_whatsapp_pack",
    code: "addon_whatsapp_pack",
    name: "Automated WhatsApp Delivery Pack",
    description: "Official Meta Cloud WhatsApp API for invoice sharing, gold balance notices, and status updates.",
    price_minor: 99900, // ₹999.00
    currency: "INR",
    billing_frequency: "monthly",
    is_recurring: true,
    is_active: true,
    entitlements: { whatsapp_enabled: true, automated_dispatch: true },
    limits: { whatsapp_messages: 5000 },
    display_order: 1,
    applicable_plans: [],
    tax_behavior: "standard",
  },
  {
    id: "addon_extra_users",
    code: "addon_extra_users",
    name: "Additional User Seats (Pack of 5)",
    description: "Add 5 additional authorized operator seats across accounting and workshop.",
    price_minor: 149900, // ₹1,499.00
    currency: "INR",
    billing_frequency: "monthly",
    is_recurring: true,
    is_active: true,
    entitlements: { extra_users: 5 },
    limits: { additional_users: 5 },
    display_order: 2,
    applicable_plans: [],
    tax_behavior: "standard",
  },
  {
    id: "addon_extra_branch",
    code: "addon_extra_branch",
    name: "Additional Branch Location Sync",
    description: "Enable 1 additional physical retail counter or workshop unit with real-time stock sync.",
    price_minor: 249900, // ₹2,499.00
    currency: "INR",
    billing_frequency: "monthly",
    is_recurring: true,
    is_active: true,
    entitlements: { multi_branch: true },
    limits: { additional_branches: 1 },
    display_order: 3,
    applicable_plans: [],
    tax_behavior: "standard",
  },
  {
    id: "addon_cloud_storage_50gb",
    code: "addon_cloud_storage_50gb",
    name: "Extra Cloud Storage (50 GB)",
    description: "High-resolution design catalog, CAD renders, and invoice document hosting vault.",
    price_minor: 79900, // ₹799.00
    currency: "INR",
    billing_frequency: "monthly",
    is_recurring: true,
    is_active: true,
    entitlements: { extra_storage_gb: 50 },
    limits: { additional_storage_gb: 50 },
    display_order: 4,
    applicable_plans: [],
    tax_behavior: "standard",
  },
  {
    id: "addon_rest_api",
    code: "addon_rest_api",
    name: "REST API & Webhooks Access",
    description: "Programmatic API access for e-commerce website sync and third-party accounting export.",
    price_minor: 399900, // ₹3,999.00
    currency: "INR",
    billing_frequency: "monthly",
    is_recurring: true,
    is_active: true,
    entitlements: { api_access: true, webhooks_enabled: true },
    limits: {},
    display_order: 5,
    applicable_plans: [],
    tax_behavior: "standard",
  },
];

export function PlatformAddonsManager() {
  const [addons, setAddons] = useState<PlatformAddonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingAddon, setEditingAddon] = useState<PlatformAddonRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addonForm, setAddonForm] = useState<Omit<PlatformAddonRecord, "id">>({
    code: "",
    name: "",
    description: "",
    price_minor: 99900,
    currency: "INR",
    billing_frequency: "monthly",
    is_recurring: true,
    is_active: true,
    entitlements: {},
    limits: { additional_users: 0, additional_branches: 0, additional_storage_gb: 0 },
    display_order: 10,
    applicable_plans: [],
    tax_behavior: "standard",
  });
  const [formPriceINR, setFormPriceINR] = useState("999");
  const [saving, setSaving] = useState(false);

  async function loadAddons() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "commercial.addons")
        .maybeSingle();

      if (data?.value && Array.isArray(data.value) && data.value.length > 0) {
        setAddons(data.value as unknown as PlatformAddonRecord[]);
      } else {
        setAddons(DEFAULT_PLATFORM_ADDONS);
      }
    } catch {
      setAddons(DEFAULT_PLATFORM_ADDONS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAddons();
  }, []);

  const filteredAddons = useMemo(() => {
    return addons.filter((a) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
      );
    });
  }, [addons, searchQuery]);

  function openCreateModal(template?: Partial<PlatformAddonRecord>) {
    const initial: Omit<PlatformAddonRecord, "id"> = {
      code: template?.code ? `${template.code}_copy` : `addon_${Date.now().toString(36)}`,
      name: template?.name ? `${template.name} (Copy)` : "New Add-on Pack",
      description: template?.description || "Description of add-on value and entitlements.",
      price_minor: template?.price_minor || 99900,
      currency: template?.currency || "INR",
      billing_frequency: template?.billing_frequency || "monthly",
      is_recurring: template?.is_recurring ?? true,
      is_active: template?.is_active ?? true,
      entitlements: template?.entitlements || {},
      limits: template?.limits || {},
      display_order: (template?.display_order ?? 10) + 1,
      applicable_plans: template?.applicable_plans || [],
      tax_behavior: template?.tax_behavior || "standard",
    };
    setAddonForm(initial);
    setFormPriceINR(String(Math.round(initial.price_minor / 100)));
    setEditingAddon(null);
    setIsModalOpen(true);
  }

  function openEditModal(addon: PlatformAddonRecord) {
    setEditingAddon(addon);
    setAddonForm({
      code: addon.code,
      name: addon.name,
      description: addon.description,
      price_minor: addon.price_minor,
      currency: addon.currency,
      billing_frequency: addon.billing_frequency,
      is_recurring: addon.is_recurring,
      is_active: addon.is_active,
      entitlements: addon.entitlements,
      limits: addon.limits,
      display_order: addon.display_order,
      applicable_plans: addon.applicable_plans,
      tax_behavior: addon.tax_behavior,
    });
    setFormPriceINR(String(Math.round(addon.price_minor / 100)));
    setIsModalOpen(true);
  }

  async function handleToggleAddon(addon: PlatformAddonRecord) {
    const updated = addons.map((a) =>
      a.id === addon.id ? { ...a, is_active: !a.is_active, updated_at: new Date().toISOString() } : a,
    );
    setAddons(updated);
    try {
      await supabase.from("platform_settings").upsert({
        key: "commercial.addons",
        value: updated as any,
      });
      toast.success(`Add-on "${addon.name}" is now ${!addon.is_active ? "ACTIVE" : "INACTIVE"}.`);
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  }

  async function handleSaveAddon() {
    if (!addonForm.name.trim() || !addonForm.code.trim()) {
      toast.error("Add-on Name and Code are required.");
      return;
    }

    setSaving(true);
    try {
      const priceMinor = Math.round((parseFloat(formPriceINR) || 0) * 100);
      const cleanCode = addonForm.code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");

      let updated: PlatformAddonRecord[];
      if (editingAddon) {
        updated = addons.map((a) =>
          a.id === editingAddon.id
            ? {
                ...a,
                ...addonForm,
                code: cleanCode,
                price_minor: priceMinor,
                updated_at: new Date().toISOString(),
              }
            : a,
        );
      } else {
        const newAddon: PlatformAddonRecord = {
          id: `addon_${Date.now().toString(36)}`,
          ...addonForm,
          code: cleanCode,
          price_minor: priceMinor,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        updated = [...addons, newAddon];
      }

      await supabase.from("platform_settings").upsert({
        key: "commercial.addons",
        value: updated as any,
      });

      setAddons(updated);
      setIsModalOpen(false);
      toast.success(`Add-on "${addonForm.name}" saved successfully.`);
    } catch (err: any) {
      toast.error("Failed to save add-on: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-serif text-lg font-bold text-gold flex items-center gap-2">
            <Package className="h-5 w-5" /> Central Add-ons Configurator
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure platform add-ons, limits, recurring fees, and entitlement bundles. Active add-ons dynamically appear across tenant onboarding and billing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadAddons()}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            onClick={() => openCreateModal()}
            size="sm"
            className="h-8 text-xs font-bold bg-gold text-black hover:bg-gold-dark gap-1.5"
          >
            <Plus className="h-4 w-4" /> Create Add-on
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search add-ons by name, code, description..."
          className="pl-9 h-9 text-xs bg-background border-border"
        />
      </div>

      {/* Add-on Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAddons.map((addon) => {
          const priceDisplay = (addon.price_minor / 100).toLocaleString("en-IN");
          const currencySymbol = addon.currency === "INR" ? "₹" : "$";

          return (
            <Card
              key={addon.id}
              className={`border transition-all ${
                addon.is_active
                  ? "border-border bg-card shadow-sm hover:border-gold/50"
                  : "border-border/60 bg-muted/20 opacity-75"
              }`}
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-foreground">{addon.name}</h3>
                      <Badge
                        variant={addon.is_active ? "default" : "secondary"}
                        className={`text-[10px] font-mono uppercase font-bold ${
                          addon.is_active
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {addon.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-gold mt-0.5">{addon.code}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono uppercase">
                    {addon.billing_frequency}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                  {addon.description}
                </p>

                <div className="pt-2 border-t border-border flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-mono font-extrabold text-foreground">
                      {currencySymbol}{priceDisplay}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono ml-1">
                      /{addon.billing_frequency === "one_time" ? "once" : addon.billing_frequency === "annual" ? "yr" : "mo"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Order #{addon.display_order}
                  </span>
                </div>

                {/* Quota Highlights */}
                <div className="bg-muted/30 p-2 rounded text-xs space-y-1">
                  {addon.limits.additional_users ? (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Extra Users:</span>
                      <span className="font-bold font-mono">+{addon.limits.additional_users}</span>
                    </div>
                  ) : null}
                  {addon.limits.additional_branches ? (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Extra Branches:</span>
                      <span className="font-bold font-mono">+{addon.limits.additional_branches}</span>
                    </div>
                  ) : null}
                  {addon.limits.additional_storage_gb ? (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Extra Storage:</span>
                      <span className="font-bold font-mono">+{addon.limits.additional_storage_gb} GB</span>
                    </div>
                  ) : null}
                  {addon.limits.whatsapp_messages ? (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">WhatsApp Messages:</span>
                      <span className="font-bold font-mono">{addon.limits.whatsapp_messages.toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleToggleAddon(addon)}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    {addon.is_active ? (
                      <>
                        <PowerOff className="h-3.5 w-3.5 text-muted-foreground" /> Deactivate
                      </>
                    ) : (
                      <>
                        <Power className="h-3.5 w-3.5 text-emerald-500" /> Activate
                      </>
                    )}
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCreateModal(addon)}
                      className="h-8 text-xs font-semibold gap-1 px-2"
                      title="Clone this add-on"
                    >
                      <Copy className="h-3.5 w-3.5" /> Clone
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(addon)}
                      className="h-8 text-xs font-bold gap-1 bg-gold/10 text-gold border-gold/30 hover:bg-gold/20"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal: Create or Edit Add-on */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold text-gold flex items-center gap-2">
              <Package className="h-5 w-5" />
              {editingAddon ? `Edit Add-on: ${editingAddon.name}` : "Create New Add-on Pack"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure add-on pricing, quotas, and billing terms. Active add-ons will immediately be selectable by tenants.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-bold">Add-on Display Name *</Label>
                <Input
                  value={addonForm.name}
                  onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                  placeholder="e.g. Extra Branch Sync Pack"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold">System Code (Slug) *</Label>
                <Input
                  value={addonForm.code}
                  onChange={(e) => setAddonForm({ ...addonForm, code: e.target.value })}
                  placeholder="e.g. addon_extra_branch"
                  className="h-9 text-xs font-mono"
                  disabled={Boolean(editingAddon)}
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="font-bold">Description</Label>
                <Input
                  value={addonForm.description}
                  onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })}
                  placeholder="Summary of entitlements and features provided"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-border">
              <div className="space-y-1.5">
                <Label className="font-bold">Billing Frequency</Label>
                <Select
                  value={addonForm.billing_frequency}
                  onValueChange={(v: any) =>
                    setAddonForm({
                      ...addonForm,
                      billing_frequency: v,
                      is_recurring: v !== "one_time",
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly Recurring</SelectItem>
                    <SelectItem value="annual">Annual Recurring</SelectItem>
                    <SelectItem value="one_time">One-Time Fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold">Price (₹ INR) *</Label>
                <Input
                  type="number"
                  value={formPriceINR}
                  onChange={(e) => setFormPriceINR(e.target.value)}
                  placeholder="e.g. 999"
                  className="h-9 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold">Display Priority</Label>
                <Input
                  type="number"
                  value={addonForm.display_order}
                  onChange={(e) => setAddonForm({ ...addonForm, display_order: Number(e.target.value) || 0 })}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-border">
              <div className="space-y-1.5">
                <Label className="font-bold">Additional Users</Label>
                <Input
                  type="number"
                  value={addonForm.limits.additional_users || ""}
                  onChange={(e) =>
                    setAddonForm({
                      ...addonForm,
                      limits: { ...addonForm.limits, additional_users: Number(e.target.value) || 0 },
                    })
                  }
                  placeholder="0"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold">Additional Branches</Label>
                <Input
                  type="number"
                  value={addonForm.limits.additional_branches || ""}
                  onChange={(e) =>
                    setAddonForm({
                      ...addonForm,
                      limits: { ...addonForm.limits, additional_branches: Number(e.target.value) || 0 },
                    })
                  }
                  placeholder="0"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold">Additional Storage (GB)</Label>
                <Input
                  type="number"
                  value={addonForm.limits.additional_storage_gb || ""}
                  onChange={(e) =>
                    setAddonForm({
                      ...addonForm,
                      limits: { ...addonForm.limits, additional_storage_gb: Number(e.target.value) || 0 },
                    })
                  }
                  placeholder="0"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-border mt-3">
              <div className="space-y-0.5">
                <Label className="font-bold text-foreground">Add-on Active Status</Label>
                <p className="text-[10px] text-muted-foreground">
                  Active add-ons can be selected during tenant onboarding and subscription purchases.
                </p>
              </div>
              <Switch
                checked={addonForm.is_active}
                onCheckedChange={(checked) => setAddonForm({ ...addonForm, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveAddon()}
              disabled={saving}
              size="sm"
              className="text-xs font-bold bg-gold text-black hover:bg-gold/90 gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : editingAddon ? "Update Add-on" : "Create Add-on"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
