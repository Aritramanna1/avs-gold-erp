import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSettings, type Branch } from "@/lib/settings-store";
import {
  dbAddBranch,
  dbUpdateBranch,
  dbRemoveBranch,
  dbSetDefaultBranch,
} from "@/lib/supabase-sync";
import { useOrders } from "@/lib/orders-store";
import { useExpensesStore } from "@/lib/expenses-store";
import { usePeople } from "@/lib/people-store";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  UserCheck,
  CheckCircle,
  Clock,
  Briefcase,
  Layers,
  FileText,
  Settings,
  Trash2,
} from "lucide-react";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/branches/")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Branch Management · AVS Gold ERP" }] }),
  component: BranchesPage,
});

function BranchesPage() {
  const { t } = useLanguage();
  const {
    branches,
    addBranch,
    updateBranch,
    removeBranch,
    setDefaultBranch,
    selectedBranchId,
    setSelectedBranchId,
  } = useSettings();
  const orders = useOrders((s) => s.orders);
  const expenses = useExpensesStore((s) => s.expenses);
  const withdrawals = useExpensesStore((s) => s.withdrawals);
  const people = usePeople((s) => s.people);

  // Dialog State
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<Branch | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [phone, setPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [managerName, setManagerName] = useState("");
  const [notes, setNotes] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGstin, setEditGstin] = useState("");
  const [editManagerName, setEditManagerName] = useState("");
  const [editActive, setEditActive] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    const finalAddress = `${address.trim()}${city ? `, ${city}` : ""}${state ? `, ${state}` : ""}`;
    const newId = `branch_${code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
    const branchData = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      address: finalAddress,
      phone: phone.trim(),
      managerName: managerName.trim() || "Unassigned",
      gstin: gstin.trim() || undefined,
      active: true,
      isDefault: false,
    };
    addBranch(branchData);
    void dbAddBranch({ id: newId, ...branchData });

    // Reset Form
    setName("");
    setCode("");
    setAddress("");
    setCity("");
    setState("");
    setPhone("");
    setGstin("");
    setManagerName("");
    setNotes("");
    setAddOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOpen) return;
    const patch = {
      name: editName.trim(),
      code: editCode.toUpperCase(),
      address: editAddress.trim(),
      phone: editPhone.trim(),
      managerName: editManagerName.trim(),
      gstin: editGstin.trim() || undefined,
      active: editActive,
    };
    updateBranch(editOpen.id, patch);
    void dbUpdateBranch(editOpen.id, patch);
    setEditOpen(null);
  };

  const openEdit = (b: Branch) => {
    setEditOpen(b);
    setEditName(b.name);
    setEditCode(b.code);
    setEditAddress(b.address);
    setEditPhone(b.phone);
    setEditGstin(b.gstin ?? "");
    setEditManagerName(b.managerName);
    setEditActive(b.active);
  };

  const branchStats = useMemo(() => {
    const stats: Record<string, { ordersCount: number; expensesTotal: number; kycCount: number }> =
      {};

    branches.forEach((b) => {
      stats[b.id] = { ordersCount: 0, expensesTotal: 0, kycCount: 0 };
    });

    orders.forEach((o) => {
      const bid = o.branchId || "MAIN";
      if (!stats[bid]) stats[bid] = { ordersCount: 0, expensesTotal: 0, kycCount: 0 };
      stats[bid].ordersCount++;
    });

    expenses.forEach((e) => {
      const bid = e.branchId || "MAIN";
      if (!stats[bid]) stats[bid] = { ordersCount: 0, expensesTotal: 0, kycCount: 0 };
      stats[bid].expensesTotal += e.amountPaise;
    });

    withdrawals.forEach((w) => {
      const bid = w.branchId || "MAIN";
      if (!stats[bid]) stats[bid] = { ordersCount: 0, expensesTotal: 0, kycCount: 0 };
      stats[bid].expensesTotal += w.amountPaise;
    });

    return stats;
  }, [branches, orders, expenses, withdrawals]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6" id="branches-management-root">
      <PageHeader
        title={t("branches.title") || "Branch Management"}
        subtitle={
          t("branches.subtitle") ||
          "Setup and govern firm shop locations or production workshop units."
        }
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" id="btn-add-branch">
                <Plus className="h-4 w-4" /> Add New Branch
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Setup New Branch</DialogTitle>
                  <DialogDescription>
                    Create a showroom location, retail counters, or warehouse manufacturing points.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="b-name">Branch Full Name</Label>
                    <Input
                      id="b-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Salt Lake Outlet"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-code">Branch Code (Unique)</Label>
                    <Input
                      id="b-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. SL01"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-phone">Branch Phone</Label>
                    <Input
                      id="b-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 99999 88888"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="b-address">Street Address</Label>
                    <Input
                      id="b-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. 45 Street Lanes, Sector 5"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-city">City</Label>
                    <Input
                      id="b-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Kolkata"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-state">State</Label>
                    <Input
                      id="b-state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="West Bengal"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-manager">Manager / Overseer Name</Label>
                    <Input
                      id="b-manager"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      placeholder="e.g. Biplab Manna"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-gstin">GSTIN (Optional)</Label>
                    <Input
                      id="b-gstin"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                      placeholder="e.g. 19AAAAA1111A1Z1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Establish Branch</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Grid view of cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((b) => {
          const stats = branchStats[b.id] || { ordersCount: 0, expensesTotal: 0, kycCount: 0 };
          const activeSec = selectedBranchId === b.id;
          return (
            <Card
              key={b.id}
              className={`border transition-all flex flex-col justify-between ${
                activeSec
                  ? "border-gold bg-gold/5 shadow-[0_0_15px_rgba(200,162,75,0.1)] scale-[1.01]"
                  : "border-border bg-card/60 hover:bg-card hover:border-gold/30"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="font-serif text-gold text-xl flex items-center gap-1.5">
                      <Building2 className="h-5 w-5" />
                      {b.name}
                    </CardTitle>
                    <CardDescription className="text-xs uppercase font-mono tracking-wider text-muted-foreground mt-1">
                      Code: {b.code}{" "}
                      {b.isDefault && (
                        <span className="text-gold font-semibold ml-2">(Default Branch)</span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={b.active ? "default" : "outline"}
                    className={
                      b.active ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : ""
                    }
                  >
                    {b.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-xs sm:text-sm">
                <p className="text-muted-foreground flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                  <span>{b.address || "No address defined"}</span>
                </p>
                {b.phone && (
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gold shrink-0" />
                    <span>{b.phone}</span>
                  </p>
                )}
                <p className="text-muted-foreground flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-gold shrink-0" />
                  <span>
                    Manager:{" "}
                    <strong className="text-foreground">{b.managerName || "Unassigned"}</strong>
                  </span>
                </p>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border/60">
                  <div className="bg-background/40 p-2.5 rounded-lg border border-border/30">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Active Orders
                    </span>
                    <span className="text-base font-bold text-gold">{stats.ordersCount}</span>
                  </div>
                  <div className="bg-background/40 p-2.5 rounded-lg border border-border/30">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      Expense Outflow
                    </span>
                    <span className="text-base font-bold text-red-300">
                      ₹ {(stats.expensesTotal / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </CardContent>
              <div className="p-4 border-t border-border/40 bg-muted/20 flex gap-2 justify-end">
                {!activeSec && b.active && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-gold"
                    onClick={() => setSelectedBranchId(b.id)}
                  >
                    Select Working Branch
                  </Button>
                )}
                {!b.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gold hover:underline"
                    onClick={() => {
                      setDefaultBranch(b.id);
                      void dbSetDefaultBranch(b.id);
                    }}
                  >
                    Make Default
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>
                  Edit Details
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editOpen} onOpenChange={(o) => !o && setEditOpen(null)}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Branch: {editOpen?.name}</DialogTitle>
              <DialogDescription>Modify parameters for this branch location.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="edit-name">Branch Full Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-code">Branch Code</Label>
                <Input
                  id="edit-code"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-phone">Branch Phone</Label>
                <Input
                  id="edit-phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="edit-address">Street Address</Label>
                <Input
                  id="edit-address"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-manager">Manager Name</Label>
                <Input
                  id="edit-manager"
                  value={editManagerName}
                  onChange={(e) => setEditManagerName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-gstin">GSTIN (Optional)</Label>
                <Input
                  id="edit-gstin"
                  value={editGstin}
                  onChange={(e) => setEditGstin(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  id="edit-active"
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded border-border bg-background"
                />
                <Label htmlFor="edit-active">Branch is Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(null)}>
                Cancel
              </Button>
              <Button type="submit">Update Branch</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
