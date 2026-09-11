import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePeople, PERSON_TYPE_LABELS, KYC_DOC_LABELS, type KycDocKey } from "@/lib/people-store";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";
import { useOrders, ORDER_STATUS_LABELS, paiseToRupees } from "@/lib/orders-store";
import { useJobCards, JOB_STATUS_LABELS } from "@/lib/jobcards-store";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useBilling } from "@/lib/billing-store";
import {
  compileCustomerLedger,
  getPartyGoldBalance,
  getPartyCashBalance,
} from "@/lib/customer-account-ledger";
import { exportToCSV, exportToXLSX } from "@/lib/report-engine";
import { mgToGrams } from "@/lib/gold";
import { useSettings } from "@/lib/settings-store";
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Hammer,
  Receipt,
  Wallet,
  Sparkles,
  Building2,
  FileText,
  ShieldCheck,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Clock,
  Coins,
  History,
  Printer,
  MessageSquare,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { InviteToPortalDialog } from "@/components/invite-to-portal-dialog";
import { PortalInvitationsPanel } from "@/components/portal/PortalInvitationsPanel";
import { getPartyTimelineData, type PartyTimelineData } from "@/lib/central-foundation";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { GoldWeightDisplay } from "@/components/ui/GoldWeightDisplay";
import { PersonProfileAvatar } from "@/components/people/PersonProfileAvatar";
import { JamaSlipDialog } from "@/components/billing/JamaSlipDialog";

export const Route = createFileRoute("/people/$id")({
  head: () => ({ meta: [{ title: "Party 360 Workspace · Ornexa ERP" }] }),
  component: Party360WorkspacePage,
});

function Party360WorkspacePage() {
  const { id } = useParams({ from: "/people/$id" });
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [jamaOpen, setJamaOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [timeline, setTimeline] = useState<PartyTimelineData | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const people = usePeople((s) => s.people);
  const refreshPeople = usePeople((s) => s.refresh);
  const orders = useOrders((s) => s.orders);
  const refreshOrders = useOrders((s) => s.refresh);
  const jobs = useJobCards((s) => s.jobs);
  const refreshJobs = useJobCards((s) => s.refresh);
  const mfgBills = useMfgBills((s) => s.bills);
  const refreshMfgBills = useMfgBills((s) => s.refresh);
  const settlements = useGoldSettlement((s) => s.settlements);
  const refreshSettlements = useGoldSettlement((s) => s.refresh);
  const invoices = useBilling((s) => s.invoices);
  const refreshInvoices = useBilling((s) => s.refresh);

  useEffect(() => {
    refreshPeople();
    refreshOrders();
    refreshJobs();
    refreshMfgBills();
    refreshSettlements();
    refreshInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (activeTab !== "timeline" || !id || timeline || timelineLoading) return;
    setTimelineLoading(true);
    setTimelineError(null);
    getPartyTimelineData(id)
      .then(setTimeline)
      .catch((e) => setTimelineError(e instanceof Error ? e.message : String(e)))
      .finally(() => setTimelineLoading(false));
  }, [activeTab, id, timeline, timelineLoading]);

  const person = useMemo(() => people.find((p) => p.id === id), [people, id]);

  const partyOrders = useMemo(() => orders.filter((o) => o.customerId === id), [orders, id]);
  const partyJobs = useMemo(
    () => jobs.filter((j) => j.customerId === id || j.karigarId === id),
    [jobs, id],
  );
  const partyMfgBills = useMemo(() => mfgBills.filter((b) => b.customerId === id), [mfgBills, id]);
  const partySettlements = useMemo(
    () => settlements.filter((s) => s.party_id === id),
    [settlements, id],
  );
  const partyInvoices = useMemo(() => invoices.filter((i) => i.customerId === id), [invoices, id]);
  const partyPayments = useMemo(
    () => partyInvoices.flatMap((i) => i.payments.map((p) => ({ ...p, invoiceNo: i.invoiceNo }))),
    [partyInvoices],
  );

  // Authoritative double-entry ledger calculation
  const ledger = useMemo(
    () => (id ? compileCustomerLedger(id) : null),
    [id, settlements, orders, invoices],
  );
  const goldBalance = useMemo(
    () => (id ? getPartyGoldBalance(id) : null),
    [id, settlements, orders, invoices],
  );
  const cashBalance = useMemo(
    () => (id ? getPartyCashBalance(id) : null),
    [id, settlements, orders, invoices],
  );

  if (!person) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title="Party 360 Workspace" />
        <p className="text-sm text-muted-foreground">Party record not found.</p>
        <Button variant="ghost" onClick={() => navigate({ to: "/people" })}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Directory
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/people" })}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Party Directory
        </Button>
        <div className="flex items-center gap-3">
          {(person.whatsapp || person.phone) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() =>
                navigate({
                  to: "/whatsapp",
                  search: {
                    tab: "inbox",
                    phone: (person.whatsapp || person.phone || "").replace(/\D/g, ""),
                  },
                })
              }
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
              Message on WhatsApp
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setInviteOpen(true)}
            className="gap-1.5 text-xs border-amber-500/40 hover:bg-amber-500/10 text-foreground"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Invite to Portal
          </Button>
          <Link
            to="/orders/new"
            className="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            + New Order
          </Link>
        </div>
      </div>

      {/* Header Summary Card */}
      <div className="rounded-md border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <PersonProfileAvatar
              person={person}
              name={person.fullName}
              className="h-14 w-14 rounded-full border border-border shrink-0"
              imgClassName="object-contain p-0.5"
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {person.fullName}
                </h1>
                <Badge variant="outline" className="capitalize text-xs font-medium">
                  {PERSON_TYPE_LABELS[person.type] || person.type}
                </Badge>
                <Badge variant={person.active ? "default" : "secondary"} className="text-[11px]">
                  {person.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {person.phone}
                </span>
                {person.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {person.email}
                  </span>
                )}
                {person.gstin && (
                  <span className="font-mono bg-muted/60 px-2 py-0.5 rounded">
                    GSTIN: {person.gstin}
                  </span>
                )}
                {person.pan && (
                  <span className="font-mono bg-muted/60 px-2 py-0.5 rounded">PAN: {person.pan}</span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setJamaOpen(true)}
                  className="bg-gold hover:bg-gold/90 text-white font-bold gap-1.5 shadow-sm text-xs h-8"
                >
                  <Receipt className="h-3.5 w-3.5" /> Record Jama Receipt (पावती)
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Metric Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
            <div className="rounded-xl border border-gold/30 bg-gradient-to-br from-gold/10 via-gold/5 to-muted/30 p-4 min-w-[180px]">
              <p className="text-[10px] uppercase tracking-wider text-gold font-bold flex items-center gap-1">
                <Coins className="h-3 w-3 text-gold" />
                Net Fine Gold (Gold First)
              </p>
              <div className="text-xl font-bold font-mono text-gold mt-1">
                <GoldWeightDisplay mg={goldBalance?.outstandingFineMg || 0} kind="fine" showCrDr />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {(goldBalance?.outstandingFineMg || 0) >= 0 ? "Workshop owes metal" : "Party owes metal"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-gradient-to-br from-muted/40 via-background to-card p-4 min-w-[180px]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                Net Cash Due (Gold Equiv)
              </p>
              <div className="text-xl font-bold font-mono text-emerald-500 mt-1">
                <GoldWeightDisplay
                  mg={Math.round((Math.abs(cashBalance?.outstandingPaise || 0) / (getCurrentGoldRatePaise() || 750000)) * 1000)}
                  kind="fine"
                />
              </div>
              <div className="text-[11px] text-muted-foreground font-mono mt-1 flex items-center gap-1">
                <MoneyDisplay paise={cashBalance?.outstandingPaise || 0} showCrDr />
              </div>
            </div>
          </div>
        </div>
      </div>

      <InviteToPortalDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        person={{
          id: person.id,
          fullName: person.fullName,
          phone: person.phone,
          type: person.type,
          email: person.email,
        }}
      />

      <JamaSlipDialog
        open={jamaOpen}
        onClose={() => setJamaOpen(false)}
        defaultPartyId={person.id}
        onSaved={() => {
          refreshInvoices();
          refreshSettlements();
          refreshPeople();
        }}
      />

      {/* Party 360 Tabbed Workspace */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-lg">
          <TabsTrigger value="overview" className="text-xs">
            Overview
          </TabsTrigger>
          <TabsTrigger value="ledger" className="text-xs gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Dual Ledger
          </TabsTrigger>
          <TabsTrigger value="orders_jobs" className="text-xs gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Orders & Jobs (
            {partyOrders.length + partyJobs.length})
          </TabsTrigger>
          <TabsTrigger value="bills_settlements" className="text-xs gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Bills & Settlements (
            {partyMfgBills.length + partySettlements.length})
          </TabsTrigger>
          <TabsTrigger value="bank_compliance" className="text-xs gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Bank & Compliance
          </TabsTrigger>
          <TabsTrigger value="vault" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Document Vault
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs gap-1.5">
            <History className="h-3.5 w-3.5" /> Timeline & Comms
          </TabsTrigger>
          <TabsTrigger value="portal" className="text-xs gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Portal Access
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Identity & Address Card */}
            <div className="rounded-md border border-border/80 bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" /> Contact & Address Profile
              </h3>
              <div className="text-xs space-y-2">
                {person.tradeName && (
                  <div>
                    <span className="text-muted-foreground">Trade / Shop Name: </span>
                    <span className="font-semibold text-foreground">{person.tradeName}</span>
                  </div>
                )}
                {person.legalName && (
                  <div>
                    <span className="text-muted-foreground">Legal Entity: </span>
                    <span className="text-foreground">{person.legalName}</span>
                  </div>
                )}
                {person.contactPerson && (
                  <div>
                    <span className="text-muted-foreground">Contact Person: </span>
                    <span className="text-foreground">{person.contactPerson}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Address: </span>
                  <span className="text-foreground">
                    {[
                      person.addressLine1 || person.currentAddress,
                      person.addressLine2,
                      person.area,
                      person.villageCity,
                      person.district,
                      person.state,
                      person.pin,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Not specified"}
                  </span>
                </div>
                {person.whatsapp && (
                  <div>
                    <span className="text-muted-foreground">WhatsApp: </span>
                    <span className="text-foreground">{person.whatsapp}</span>
                  </div>
                )}
                {person.altPhone && (
                  <div>
                    <span className="text-muted-foreground">Alternate Phone: </span>
                    <span className="text-foreground">{person.altPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Credit Limits & Commercial Terms */}
            <div className="rounded-md border border-border/80 bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Commercial Terms & Credit
                Controls
              </h3>
              <div className="text-xs space-y-2.5">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Max Cash Credit Limit:</span>
                  <span className="font-semibold text-foreground">
                    {person.cashCreditLimitPaise
                      ? `₹${paiseToRupees(person.cashCreditLimitPaise)}`
                      : "Standard / Unlimited"}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Max Gold Credit Limit:</span>
                  <span className="font-semibold text-foreground">
                    {person.goldCreditLimitMg || person.maxFineGoldCreditMg
                      ? `${mgToGrams(person.goldCreditLimitMg || person.maxFineGoldCreditMg || 0)} g`
                      : "Standard / Unlimited"}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Payment Due Term:</span>
                  <span className="font-semibold text-foreground">
                    {person.dueDays ? `${person.dueDays} Days` : "Immediate / Standard"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Portal Status:</span>
                  <Badge variant="outline" className="text-[10px]">
                    Ready to Invite
                  </Badge>
                </div>
              </div>
            </div>

            {/* Opening Balances & Outstandings Card */}
            {(person.cashOpeningBalancePaise ||
              person.goldOpeningGrossMg ||
              person.silverOpeningFineMg) && (
              <div className="col-span-1 md:col-span-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" /> Opening Balances & Metal
                    Outstandings
                  </h3>
                  <Badge
                    variant="outline"
                    className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10"
                  >
                    Single Source of Truth
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                  {person.cashOpeningBalancePaise !== undefined && (
                    <div className="rounded-lg border p-3 bg-card">
                      <span className="text-[11px] text-muted-foreground font-sans block">
                        Cash Opening (
                        {person.cashOpeningType === "payable" ? "Payable / Cr" : "Receivable / Dr"}
                        ):
                      </span>
                      <span className="font-bold text-foreground text-sm">
                        ₹{paiseToRupees(person.cashOpeningBalancePaise)}
                      </span>
                    </div>
                  )}

                  {person.goldOpeningGrossMg !== undefined && (
                    <div className="rounded-lg border p-3 bg-card">
                      <span className="text-[11px] text-muted-foreground font-sans block">
                        Gold Opening (
                        {person.goldOpeningType === "payable" ? "Payable / Cr" : "Receivable / Dr"}
                        ):
                      </span>
                      <span className="font-bold text-amber-500 text-sm">
                        {mgToGrams(person.goldOpeningGrossMg)} g ({person.goldOpeningTouch || 91.6}%
                        Touch)
                      </span>
                      {person.goldOpeningFineMg && (
                        <div className="text-[10px] text-muted-foreground pt-0.5">
                          Pure Fine (999): {mgToGrams(person.goldOpeningFineMg)} g
                        </div>
                      )}
                    </div>
                  )}

                  {person.silverOpeningFineMg !== undefined && (
                    <div className="rounded-lg border p-3 bg-card">
                      <span className="text-[11px] text-muted-foreground font-sans block">
                        Silver Opening Fine:
                      </span>
                      <span className="font-bold text-foreground text-sm">
                        {mgToGrams(person.silverOpeningFineMg)} g
                      </span>
                    </div>
                  )}
                </div>

                {person.openingBalanceNotes && (
                  <p className="text-[11px] text-muted-foreground italic pt-1">
                    Notes: {person.openingBalanceNotes}
                  </p>
                )}
              </div>
            )}

            {/* Dynamic Custom Fields & KYC Dossier Card */}
            {person.customForms && Object.keys(person.customForms).length > 0 && (
              <div className="col-span-1 md:col-span-2 rounded-md border border-border/80 bg-card p-5 space-y-4 shadow-sm">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Configured Custom Fields &
                  Extended Metadata
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {Object.entries(person.customForms).flatMap(([formKey, formValues]) =>
                    Object.entries(formValues || {}).map(([fieldKey, val]) => (
                      <div
                        key={`${formKey}_${fieldKey}`}
                        className="rounded-lg border p-2.5 bg-muted/20"
                      >
                        <span className="text-muted-foreground block text-[11px] font-medium capitalize">
                          {fieldKey.replace(/([A-Z])/g, " $1")}
                        </span>
                        <span className="font-semibold text-foreground mt-0.5 block">
                          {String(val) || "—"}
                        </span>
                      </div>
                    )),
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Dual Ledger */}
        <TabsContent value="ledger" className="space-y-4">
          <div className="rounded-md border border-border/80 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-sm text-foreground">
                  Authoritative Running Dual Ledger
                </h3>
                <p className="text-xs text-muted-foreground">
                  Cash (₹) and Fine Metal (g) synchronized transaction log
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ledger && ledger.rows.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => {
                        const header = [
                          "Date",
                          "Voucher",
                          "Type",
                          "Description",
                          "Gold Bal (g)",
                          "Cash Bal (₹)",
                        ];
                        const data = ledger.rows.map((r) => [
                          r.date,
                          r.voucherNo,
                          r.type,
                          r.description,
                          mgToGrams(r.closingGoldMg),
                          paiseToRupees(r.closingMoneyPaise),
                        ]);
                        exportToCSV(`party-ledger-${person.id}.csv`, [header, ...data]);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" /> CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => {
                        const header = [
                          "Date",
                          "Voucher",
                          "Type",
                          "Description",
                          "Gold Bal (g)",
                          "Cash Bal (₹)",
                        ];
                        const data = ledger.rows.map((r) => [
                          r.date,
                          r.voucherNo,
                          r.type,
                          r.description,
                          mgToGrams(r.closingGoldMg),
                          paiseToRupees(r.closingMoneyPaise),
                        ]);
                        exportToXLSX(`party-ledger-${person.id}.xlsx`, {
                          Ledger: [header, ...data],
                        });
                      }}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" /> XLSX
                    </Button>
                  </>
                )}
                <Link
                  to="/people/ledger-print/$id"
                  params={{ id: person.id }}
                  search={{ docType: "customer_unpaid_invoices" }}
                  className="text-xs inline-flex items-center gap-1 text-rose-500 hover:underline font-medium"
                >
                  <Printer className="h-3 w-3" /> Print Unpaid Invoices
                </Link>
                <span className="text-muted-foreground/40">·</span>
                <Link
                  to="/people/ledger-print/$id"
                  params={{ id: person.id }}
                  search={{ docType: "customer_paid_invoices" }}
                  className="text-xs inline-flex items-center gap-1 text-emerald-500 hover:underline font-medium"
                >
                  <Printer className="h-3 w-3" /> Print Paid Invoices
                </Link>
                <span className="text-muted-foreground/40">·</span>
                <Link
                  to="/people/ledger-print/$id"
                  params={{ id: person.id }}
                  search={{ docType: "customer_ledger_statement" }}
                  className="text-xs inline-flex items-center gap-1 text-gold hover:underline font-medium"
                >
                  <Printer className="h-3 w-3" /> Print Full Ledger
                </Link>
              </div>
            </div>

            {!ledger || ledger.rows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No ledger entries recorded yet.
              </p>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground font-medium border-b">
                    <tr>
                      <th className="py-2 px-3 text-left">Date</th>
                      <th className="py-2 px-3 text-left">Voucher</th>
                      <th className="py-2 px-3 text-left">Type</th>
                      <th className="py-2 px-3 text-left">Description</th>
                      <th className="py-2 px-3 text-right">Gold Bal (g)</th>
                      <th className="py-2 px-3 text-right">Cash Bal (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ledger.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/40">
                        <td className="py-2 px-3">{r.date}</td>
                        <td className="py-2 px-3 font-mono">
                          {r.sourceRoute ? (
                            <Link to={r.sourceRoute} className="text-primary hover:underline">
                              {r.voucherNo}
                            </Link>
                          ) : (
                            r.voucherNo
                          )}
                        </td>
                        <td className="py-2 px-3 capitalize">{r.type.replace("_", " ")}</td>
                        <td className="py-2 px-3">{r.description}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-amber-500">
                          {mgToGrams(r.closingGoldMg)} g
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          ₹{paiseToRupees(r.closingMoneyPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Orders & Jobs */}
        <TabsContent value="orders_jobs" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Orders Section */}
            <div className="rounded-md border border-border/80 bg-card p-5 space-y-3 shadow-sm">
              <h3 className="font-semibold text-sm flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Retail & Custom Orders
                </span>
                <Badge variant="outline" className="text-xs">
                  {partyOrders.length}
                </Badge>
              </h3>
              {partyOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No orders on record.</p>
              ) : (
                <ul className="divide-y text-xs">
                  {partyOrders.map((o) => (
                    <li key={o.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-medium">{o.orderNo}</span> ·{" "}
                        <span className="text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {ORDER_STATUS_LABELS[o.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Job Cards Section */}
            <div className="rounded-md border border-border/80 bg-card p-5 space-y-3 shadow-sm">
              <h3 className="font-semibold text-sm flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <Hammer className="h-4 w-4" /> Job Cards & Custody
                </span>
                <Badge variant="outline" className="text-xs">
                  {partyJobs.length}
                </Badge>
              </h3>
              {partyJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active job cards.</p>
              ) : (
                <ul className="divide-y text-xs">
                  {partyJobs.map((j) => (
                    <li key={j.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-medium">{j.jobNo}</span> · <span>{j.itemName}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {JOB_STATUS_LABELS[j.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Bills & Settlements */}
        <TabsContent value="bills_settlements" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Manufacturing Bills */}
            <div className="rounded-md border border-border/80 bg-card p-5 space-y-3 shadow-sm">
              <h3 className="font-semibold text-sm flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Manufacturing Bills
                </span>
                <Badge variant="outline" className="text-xs">
                  {partyMfgBills.length}
                </Badge>
              </h3>
              {partyMfgBills.length === 0 ? (
                <p className="text-xs text-muted-foreground">No manufacturing bills.</p>
              ) : (
                <ul className="divide-y text-xs">
                  {partyMfgBills.map((b) => (
                    <li key={b.id} className="py-2 flex items-center justify-between">
                      <span>Job {b.jobNo}</span>
                      <span className="text-muted-foreground">
                        Outstanding: {mgToGrams(b.goldOutstandingFineMg ?? 0)} g
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Gold Settlement Vouchers */}
            <div className="rounded-md border border-border/80 bg-card p-5 space-y-3 shadow-sm">
              <h3 className="font-semibold text-sm flex items-center justify-between text-foreground">
                <span className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Gold Settlements
                </span>
                <Badge variant="outline" className="text-xs">
                  {partySettlements.length}
                </Badge>
              </h3>
              {partySettlements.length === 0 ? (
                <p className="text-xs text-muted-foreground">No settlement vouchers recorded.</p>
              ) : (
                <ul className="divide-y text-xs">
                  {partySettlements.map((s) => (
                    <li key={s.id} className="py-2 flex items-center justify-between">
                      <span className="capitalize">{s.settlement_type.replace("_", " ")}</span>
                      <span className="text-muted-foreground">
                        {new Date(s.settlement_date).toLocaleDateString("en-IN")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Bank & Compliance */}
        <TabsContent value="bank_compliance" className="space-y-6">
          <div className="rounded-md border border-border/80 bg-card p-5 space-y-4 shadow-sm">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Tax & Statutory Compliance
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                <span className="text-muted-foreground">GSTIN: </span>
                <span className="font-mono font-semibold text-foreground">
                  {person.gstin || "Unregistered"}
                </span>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                <span className="text-muted-foreground">PAN: </span>
                <span className="font-mono font-semibold text-foreground">
                  {person.pan || "Not provided"}
                </span>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                <span className="text-muted-foreground">MSME Udyam No: </span>
                <span className="font-mono font-semibold text-foreground">
                  {person.msmeUdyamNo || "Not registered"}
                </span>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                <span className="text-muted-foreground">TAN: </span>
                <span className="font-mono font-semibold text-foreground">{person.tan || "—"}</span>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                <span className="text-muted-foreground">Place of Supply: </span>
                <span className="font-semibold text-foreground">
                  {person.placeOfSupply || "State 19 (WB)"}
                </span>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                <span className="text-muted-foreground">TDS / TCS Applicability: </span>
                <span className="font-semibold text-foreground capitalize">
                  {person.tdsTcsApplicability || "None"}
                </span>
              </div>
            </div>

            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2 pt-2 border-t border-border">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Verified Bank Accounts &
              Payout Registry
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {person.bankAccounts && person.bankAccounts.length > 0 ? (
                person.bankAccounts.map((ba, idx) => (
                  <div key={ba.id} className="rounded-lg border p-4 bg-muted/20 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {ba.bankName || `Account #${idx + 1}`}
                      </span>
                      {ba.isPrimary && (
                        <Badge variant="default" className="text-[10px]">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Account Holder: </span>
                      <span className="text-foreground">
                        {ba.accountHolderName || person.fullName}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Account Number: </span>
                      <span className="font-mono text-foreground">{ba.accountNumber || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">IFSC Code: </span>
                      <span className="font-mono text-foreground">{ba.ifscCode || "—"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border p-4 bg-muted/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Primary Bank Account</span>
                    <Badge variant="default" className="text-[10px]">
                      Primary
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bank Name: </span>
                    <span className="text-foreground">
                      {person.bankName || "State Bank of India"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Account Holder: </span>
                    <span className="text-foreground">
                      {person.bankAccountName || person.fullName}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Account Number: </span>
                    <span className="font-mono text-foreground">
                      {person.bankAccountNumber
                        ? `••••${person.bankAccountNumber.slice(-4)}`
                        : "Not provided"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IFSC Code: </span>
                    <span className="font-mono text-foreground">
                      {person.bankIfsc || "SBIN0001234"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 6: Document Vault */}
        <TabsContent value="vault" className="space-y-4">
          <div className="rounded-md border border-border/80 bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" /> Party Document Vault & KYC
              </h3>
              <Link
                to={`/people/print/${person.id}` as any}
                className="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 border border-border bg-background hover:bg-muted"
              >
                Print KYC Sheet
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {(["photo", "aadhaar_front", "aadhaar_back", "pan", "address_proof", "signature"] as KycDocKey[]).map((k) => {
                const filed = !!person.docs?.[k];
                return (
                  <div
                    key={k}
                    className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${
                      filed
                        ? "border-gold/40 bg-gold/5"
                        : "border-dashed border-border bg-background/30"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{KYC_DOC_LABELS[k]}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {filed ? "Verified & on file" : "Not uploaded yet"}
                      </p>
                    </div>
                    <AttachmentButton
                      entityType="person"
                      entityId={person.id}
                      docKey={k}
                      docLabel={KYC_DOC_LABELS[k]}
                      title={`${person.fullName} — ${KYC_DOC_LABELS[k]}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Tab 7: Activity Timeline & Communication */}
        <TabsContent value="timeline" className="space-y-4">
          {timelineLoading && <p className="text-xs text-muted-foreground">Loading timeline…</p>}
          {timelineError && (
            <p className="text-xs text-destructive">Failed to load timeline: {timelineError}</p>
          )}
          {!timelineLoading && !timelineError && timeline && !timeline.centralPartyId && (
            <p className="text-xs text-muted-foreground">
              This party has not been synced to the central directory yet, so no activity or
              messages are available.
            </p>
          )}
          {!timelineLoading && timeline?.centralPartyId && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-md border border-border/80 bg-card p-5 space-y-3 shadow-sm">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" /> Activity Timeline (
                  {timeline.events.length})
                </h3>
                {timeline.events.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  <ul className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {timeline.events.map((ev) => (
                      <li key={ev.id} className="text-xs border-l-2 border-border pl-3 py-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{ev.title}</span>
                          <Badge
                            variant={
                              ev.severity === "critical" || ev.severity === "error"
                                ? "destructive"
                                : "outline"
                            }
                            className="text-[10px] capitalize"
                          >
                            {ev.eventType}
                          </Badge>
                        </div>
                        {ev.description && (
                          <p className="text-muted-foreground mt-0.5">{ev.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {new Date(ev.occurredAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-md border border-border/80 bg-card p-5 space-y-3 shadow-sm">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" /> Communication (
                  {timeline.messages.length})
                </h3>
                {timeline.messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No WhatsApp, email, or in-app messages logged for this party yet.
                  </p>
                ) : (
                  <ul className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {timeline.messages.map((msg) => (
                      <li key={msg.id} className="text-xs border-l-2 border-border pl-3 py-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {msg.channel}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {msg.direction}
                          </Badge>
                          {msg.threadSubject && (
                            <span className="text-muted-foreground">{msg.threadSubject}</span>
                          )}
                        </div>
                        {msg.body && <p className="text-foreground mt-0.5">{msg.body}</p>}
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {new Date(msg.createdAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="portal" className="space-y-4">
          <PortalInvitationsPanel
            partyId={person.id}
            partyName={person.fullName}
            onInvite={() => setInviteOpen(true)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
