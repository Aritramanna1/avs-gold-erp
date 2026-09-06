/**
 * AVS ERP — Manufacturing Customer Portal
 *
 * Dedicated client-facing manufacturing portal providing:
 * - Active work order & production milestone tracker
 * - Physical item custody receipts & NFC/Barcode resolution
 * - New manufacturing work order submission desk
 * - Multi-version design revisions & quotation approval desk
 * - Invoices & payments desk
 * - Delivery status & acknowledgement
 * - Service & support request desk
 * - Customer notification hub
 *
 * Strictly separated from Retail Showroom / E-commerce portal.
 * AI STATUS: STRICTLY DISABLED.
 */

import { useState, useMemo } from "react";
import {
  Factory,
  Package,
  Layers,
  FileCheck,
  CheckCircle2,
  Clock,
  Truck,
  Shield,
  CreditCard,
  Wrench,
  Bell,
  Search,
  Plus,
  Eye,
  Check,
  X,
  RotateCcw,
  Sparkles,
  QrCode,
  FileText,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import {
  useManufacturingCustomerPortal,
  type ManufacturingJob,
  type CustomerFacingStatus,
  type ManufacturingRequestType,
} from "@/lib/manufacturing-customer-portal-store";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  customerId?: string;
  customerName?: string;
  onSwitchPortal?: () => void;
}

export function ManufacturingCustomerPortal({
  customerId = "cust-mfg-01",
  customerName = "Aarav Singhania",
  onSwitchPortal,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "jobs"
    | "new_request"
    | "submitted_items"
    | "approvals"
    | "payments"
    | "deliveries"
    | "documents"
    | "service"
    | "notifications"
  >("dashboard");

  const [selectedJobId, setSelectedJobId] = useState<string | null>("mfg-job-001");
  const [nfcScannerInput, setNfcScannerInput] = useState("");
  const [scannedResult, setScannedResult] = useState<any | null>(null);

  // Form State for new manufacturing request
  const [reqType, setReqType] = useState<ManufacturingRequestType>("custom_jewellery");
  const [reqDesc, setReqDesc] = useState("");
  const [reqDate, setReqDate] = useState("");
  const [reqWeight, setReqWeight] = useState("");
  const [reqNotes, setReqNotes] = useState("");
  const [hasOldGold, setHasOldGold] = useState(false);
  const [oldGoldDesc, setOldGoldDesc] = useState("");
  const [oldGoldWeight, setOldGoldWeight] = useState("");
  const [oldGoldPurity, setOldGoldPurity] = useState("22K (916)");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Service ticket state
  const [serviceDesc, setServiceDesc] = useState("");
  const [serviceJobNumber, setServiceJobNumber] = useState("");

  const store = useManufacturingCustomerPortal();
  const customerJobs = useMemo(
    () => store.jobs.filter((j) => j.customerId === customerId),
    [store.jobs, customerId],
  );
  const customerItems = useMemo(
    () => store.submittedItems.filter((i) => i.customerId === customerId),
    [store.submittedItems, customerId],
  );
  const customerDeliveries = useMemo(
    () => store.deliveries.filter((d) => d.customerId === customerId),
    [store.deliveries, customerId],
  );
  const customerServices = useMemo(
    () => store.serviceTickets.filter((s) => s.customerId === customerId),
    [store.serviceTickets, customerId],
  );
  const customerNotifs = useMemo(
    () => store.notifications.filter((n) => n.customerId === customerId),
    [store.notifications, customerId],
  );
  const unreadNotifs = useMemo(() => customerNotifs.filter((n) => !n.read).length, [customerNotifs]);

  const selectedJob = useMemo(
    () => customerJobs.find((j) => j.id === selectedJobId) || customerJobs[0],
    [customerJobs, selectedJobId],
  );

  function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reqDesc.trim() || !reqDate) {
      toast.error("Please enter a description and target completion date.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { requestNumber, jobNumber } = store.createManufacturingRequest({
        customerId,
        customerName,
        requestType: reqType,
        description: reqDesc,
        desiredCompletionDate: reqDate,
        approxWeightGrams: parseFloat(reqWeight) || 10,
        notes: reqNotes,
        hasPhysicalItemToProvide: hasOldGold,
        itemDescription: oldGoldDesc,
        itemGrossWeightGrams: parseFloat(oldGoldWeight) || undefined,
        itemPurity: oldGoldPurity,
      });

      toast.success(`Manufacturing Request logged successfully: ${requestNumber}`);
      setReqDesc("");
      setReqDate("");
      setReqWeight("");
      setReqNotes("");
      setHasOldGold(false);
      setOldGoldDesc("");
      setOldGoldWeight("");
      setActiveTab("jobs");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleScanNfcOrBarcode() {
    if (!nfcScannerInput.trim()) {
      toast.error("Please enter an NFC Tag UID, Barcode, or Job Number.");
      return;
    }
    const res = store.resolveItemByNfcOrBarcode(nfcScannerInput);
    if (!res) {
      toast.error(`No item or manufacturing job matches identifier: ${nfcScannerInput}`);
      setScannedResult(null);
    } else {
      toast.success("Identity verified in authoritative ledger!");
      setScannedResult(res);
    }
  }

  function handleApproveDesign(jobId: string) {
    store.approveDesign(jobId, "Design approved via customer portal.");
    toast.success("Design approved! Goldsmith bench has been notified.");
  }

  function handleRejectDesign(jobId: string) {
    store.rejectDesign(jobId, "Design rejected. Designer will contact you.");
    toast.error("Design rejected.");
  }

  function handleRequestRevision(jobId: string) {
    const changes = window.prompt("Please detail what adjustments you would like in the next revision:");
    if (changes?.trim()) {
      store.requestDesignRevision(jobId, changes);
      toast.success("Design revision request submitted to our master designer.");
    }
  }

  function handleApproveEstimate(jobId: string) {
    store.approveEstimate(jobId, "Estimate approved via portal.");
    toast.success("Estimate approved! Production has started.");
  }

  function handleCreateService(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceDesc.trim()) {
      toast.error("Please describe the service or adjustment needed.");
      return;
    }
    const ticket = store.createServiceTicket(
      customerId,
      customerName,
      serviceDesc,
      [],
      serviceJobNumber || undefined,
    );
    toast.success(`Service Ticket created: ${ticket.ticketNumber}`);
    setServiceDesc("");
    setServiceJobNumber("");
    setActiveTab("service");
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Manufacturing Portal Header */}
      <header className="border-b border-border bg-card px-4 py-3 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold">
            <Factory className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">Manufacturing Customer Portal</h1>
              <Badge variant="outline" className="text-[10px] uppercase font-semibold border-amber-500/40 text-amber-500">
                Custom Workshop
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Client: <span className="font-semibold text-foreground">{customerName}</span> (Ref: AVS-MC-000042)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchPortal && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSwitchPortal}
              className="text-xs gap-1.5 border-border hover:bg-muted/40"
            >
              <Sparkles className="h-3.5 w-3.5 text-gold" /> Switch to Retail Showroom
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("notifications")}
            className="relative p-2 h-9 w-9 rounded-full"
          >
            <Bell className="h-4 w-4" />
            {unreadNotifs > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-600 text-[10px] text-white font-bold flex items-center justify-center">
                {unreadNotifs}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Main Navigation Bar for Manufacturing Portal */}
      <div className="border-b border-border bg-card/60 px-4 overflow-x-auto scrollbar-none flex items-center gap-1">
        {[
          { id: "dashboard", label: "Dashboard", icon: Layers },
          { id: "jobs", label: `Active Work (${customerJobs.length})`, icon: Factory },
          { id: "new_request", label: "Submit Request", icon: Plus },
          { id: "submitted_items", label: `Items & NFC (${customerItems.length})`, icon: QrCode },
          { id: "approvals", label: "Approvals", icon: FileCheck },
          { id: "payments", label: "Payments & Invoices", icon: CreditCard },
          { id: "deliveries", label: `Deliveries (${customerDeliveries.length})`, icon: Truck },
          { id: "documents", label: "Documents", icon: FileText },
          { id: "service", label: `Service & Support (${customerServices.length})`, icon: Wrench },
          { id: "notifications", label: `Alerts (${unreadNotifs})`, icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? "border-amber-500 text-amber-500 bg-amber-500/5 font-bold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Quick Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Active Manufacturing Jobs</span>
                  <Factory className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold mt-2">{customerJobs.length}</div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {customerJobs.filter((j) => j.currentMilestone === "in_production").length} in active goldsmith bench
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Submitted Custody Items</span>
                  <Package className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold mt-2">{customerItems.length}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Verified in vault custody</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Pending Approvals</span>
                  <FileCheck className="h-4 w-4 text-orange-500" />
                </div>
                <div className="text-2xl font-bold mt-2">
                  {customerJobs.filter((j) => j.designApprovalStatus === "pending" || j.estimateApprovalStatus === "pending").length}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Action required by client</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Upcoming Deliveries</span>
                  <Truck className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold mt-2">{customerDeliveries.length}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Tracked with digital confirmation</p>
              </div>
            </div>

            {/* Active Manufacturing Work Focus */}
            {selectedJob && (
              <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Featured Work Order · {selectedJob.jobNumber}
                    </span>
                    <h2 className="text-lg font-bold mt-0.5">{selectedJob.title}</h2>
                  </div>
                  <Badge className="bg-amber-500 text-black font-bold uppercase text-xs">
                    {selectedJob.currentMilestone.replace(/_/g, " ")}
                  </Badge>
                </div>

                {/* Progress Milestone Line */}
                <div className="py-2">
                  <div className="grid grid-cols-5 text-center text-xs font-medium gap-1">
                    {[
                      { key: "received", label: "1. Received" },
                      { key: "in_production", label: "2. In Production" },
                      { key: "quality_check", label: "3. Quality Check" },
                      { key: "ready", label: "4. Ready" },
                      { key: "delivered", label: "5. Delivered" },
                    ].map((step, idx) => {
                      const steps: CustomerFacingStatus[] = ["received", "in_production", "quality_check", "ready", "delivered"];
                      const currentIdx = steps.indexOf(selectedJob.currentMilestone);
                      const isComplete = currentIdx >= idx;
                      const isCurrent = currentIdx === idx;

                      return (
                        <div key={step.key} className="flex flex-col items-center">
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs mb-1 transition-all ${
                              isCurrent
                                ? "bg-amber-500 text-black ring-4 ring-amber-500/20"
                                : isComplete
                                  ? "bg-emerald-600 text-white"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isComplete ? <Check className="h-4 w-4" /> : idx + 1}
                          </div>
                          <span className={isCurrent ? "font-bold text-amber-500" : isComplete ? "text-foreground" : "text-muted-foreground"}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground">Target Completion: </span>
                    <span className="font-semibold">{selectedJob.estimatedCompletionDate}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setActiveTab("jobs")}>
                      View Detailed Timeline
                    </Button>
                    <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-600" onClick={() => setActiveTab("approvals")}>
                      Review Approvals
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => setActiveTab("new_request")}
                className="p-4 rounded-xl border border-border bg-card hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left flex flex-col justify-between h-28 cursor-pointer"
              >
                <Plus className="h-5 w-5 text-amber-500" />
                <div>
                  <div className="text-xs font-bold">New Work Order</div>
                  <div className="text-[10px] text-muted-foreground">Submit custom jewellery order</div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("submitted_items")}
                className="p-4 rounded-xl border border-border bg-card hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left flex flex-col justify-between h-28 cursor-pointer"
              >
                <QrCode className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-xs font-bold">NFC & Barcode Scan</div>
                  <div className="text-[10px] text-muted-foreground">Track physical item custody</div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("payments")}
                className="p-4 rounded-xl border border-border bg-card hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left flex flex-col justify-between h-28 cursor-pointer"
              >
                <CreditCard className="h-5 w-5 text-emerald-500" />
                <div>
                  <div className="text-xs font-bold">View Invoices</div>
                  <div className="text-[10px] text-muted-foreground">Pay and check balances</div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("service")}
                className="p-4 rounded-xl border border-border bg-card hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left flex flex-col justify-between h-28 cursor-pointer"
              >
                <Wrench className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="text-xs font-bold">Service & Repairs</div>
                  <div className="text-[10px] text-muted-foreground">Request polish or resize</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE JOBS & TIMELINE */}
        {activeTab === "jobs" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Manufacturing Work Orders</h2>
                <p className="text-xs text-muted-foreground">Track handcrafting stages, milestones, and estimates.</p>
              </div>
              <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-600 gap-1.5" onClick={() => setActiveTab("new_request")}>
                <Plus className="h-4 w-4" /> Submit New Request
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Job List */}
              <div className="space-y-3">
                {customerJobs.map((j) => (
                  <div
                    key={j.id}
                    onClick={() => setSelectedJobId(j.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      j.id === selectedJob?.id
                        ? "border-amber-500 bg-amber-500/10 shadow-sm"
                        : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-amber-500">{j.jobNumber}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {j.currentMilestone.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="font-bold text-sm mt-1 truncate">{j.title}</div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                      <span>Target: {j.estimatedCompletionDate}</span>
                      <span>₹{(j.totalAmountPaise / 100).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Detailed Timeline View */}
              {selectedJob && (
                <div className="md:col-span-2 p-5 rounded-xl border border-border bg-card space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                    <div>
                      <div className="text-xs font-mono text-muted-foreground">Request #{selectedJob.requestNumber}</div>
                      <h3 className="text-lg font-bold">{selectedJob.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedJob.description}</p>
                    </div>
                    <Badge className="bg-amber-500 text-black font-bold uppercase text-xs">
                      {selectedJob.currentMilestone.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  {/* Visual Milestones */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Production Journey & Milestones
                    </h4>
                    <div className="relative pl-6 space-y-6 border-l-2 border-amber-500/30">
                      {selectedJob.milestoneHistory.map((m, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[31px] top-0 h-4 w-4 rounded-full bg-amber-500 border-2 border-background" />
                          <div className="text-xs font-bold text-foreground">{m.label}</div>
                          <div className="text-[10px] text-muted-foreground">{new Date(m.timestamp).toLocaleString()}</div>
                          {m.note && <div className="text-xs text-muted-foreground mt-1 bg-muted/30 p-2 rounded-md">{m.note}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Associated Specs */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-border text-xs">
                    <div>
                      <span className="text-muted-foreground">Estimate No:</span>
                      <p className="font-mono font-semibold">{selectedJob.estimateNumber || "Pending"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Hallmark HUID:</span>
                      <p className="font-mono font-semibold">{selectedJob.huid || "Registered"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Delivery Method:</span>
                      <p className="font-semibold">{selectedJob.deliveryStatus || "In Progress"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SUBMIT NEW MANUFACTURING REQUEST */}
        {activeTab === "new_request" && (
          <div className="max-w-2xl mx-auto p-6 rounded-xl border border-border bg-card space-y-6 shadow-sm">
            <div>
              <h2 className="text-lg font-bold">Submit Custom Manufacturing Work Order</h2>
              <p className="text-xs text-muted-foreground">
                Provide specifications, reference photos, or existing gold jewelry for remaking/refining.
              </p>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Work Order Type</Label>
                  <select
                    value={reqType}
                    onChange={(e) => setReqType(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="custom_jewellery">Custom Jewellery Making</option>
                    <option value="manufacturing_work">Manufacturing Work</option>
                    <option value="modification">Modification & Alteration</option>
                    <option value="remaking">Remaking Old Gold into New Design</option>
                    <option value="repair_processing">Repair / Processing</option>
                    <option value="polishing">Professional Buffing & Polishing</option>
                    <option value="special_production">Special Bridal Production</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Desired Completion Date</Label>
                  <Input
                    type="date"
                    value={reqDate}
                    onChange={(e) => setReqDate(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Work Specifications & Design Brief</Label>
                <Textarea
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                  placeholder="e.g. 22K Solid Gold Peacock Choker with ruby setting and lightweight mesh back..."
                  rows={3}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Estimated Weight (Grams)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={reqWeight}
                  onChange={(e) => setReqWeight(e.target.value)}
                  placeholder="e.g. 35.50"
                  className="h-9 text-xs"
                />
              </div>

              {/* Old Gold / Physical Item Intake Toggle */}
              <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold">Provide Physical Jewelry / Old Gold?</div>
                    <div className="text-[11px] text-muted-foreground">
                      We will generate an official custody receipt (AVS-CR) with weight & purity testing.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasOldGold}
                    onChange={(e) => setHasOldGold(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                  />
                </div>

                {hasOldGold && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Item Description</Label>
                      <Input
                        value={oldGoldDesc}
                        onChange={(e) => setOldGoldDesc(e.target.value)}
                        placeholder="e.g. 2 Bangles for melt"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Gross Weight (g)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={oldGoldWeight}
                        onChange={(e) => setOldGoldWeight(e.target.value)}
                        placeholder="42.50"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Stated Purity</Label>
                      <select
                        value={oldGoldPurity}
                        onChange={(e) => setOldGoldPurity(e.target.value)}
                        className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                      >
                        <option value="22K (916)">22K (916)</option>
                        <option value="18K (750)">18K (750)</option>
                        <option value="14K (585)">14K (585)</option>
                        <option value="Old Gold Mixed">Old Gold Mixed</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Special Instructions & Notes</Label>
                <Input
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder="e.g. Anti-tarnish gold rhodium polish required."
                  className="h-9 text-xs"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-amber-500 text-black hover:bg-amber-600 font-bold"
              >
                {isSubmitting ? "Logging Request..." : "Submit Manufacturing Work Order"}
              </Button>
            </form>
          </div>
        )}

        {/* TAB 4: SUBMITTED ITEMS & NFC/BARCODE RESOLVER */}
        {activeTab === "submitted_items" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Physical Item Custody & NFC/Barcode Verification</h2>
                <p className="text-xs text-muted-foreground">
                  Authoritative chain of custody for client-supplied metal, bangles, and gemstone reset items.
                </p>
              </div>
            </div>

            {/* Live NFC / Barcode Lookup Box */}
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-500">
                  Instant NFC Tag & Barcode Item Lookup
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={nfcScannerInput}
                  onChange={(e) => setNfcScannerInput(e.target.value)}
                  placeholder="Scan or enter NFC UID (e.g. 04:52:8A:19:9C:70:80) or Barcode..."
                  className="h-9 text-xs font-mono"
                />
                <Button size="sm" onClick={handleScanNfcOrBarcode} className="bg-blue-600 text-white hover:bg-blue-700">
                  Verify Item
                </Button>
              </div>

              {scannedResult && (
                <div className="mt-3 p-3 rounded-lg border border-border bg-background text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
                    <span>✓ Authentic Item Verified in ERP Vault</span>
                    <Badge variant="outline">{scannedResult.item?.status || "Active Job"}</Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground pt-1">
                    <div>
                      <span>Receipt: </span>
                      <strong className="text-foreground">{scannedResult.item?.receiptNumber}</strong>
                    </div>
                    <div>
                      <span>Gross Weight: </span>
                      <strong className="text-foreground">{scannedResult.item?.grossWeightGrams}g</strong>
                    </div>
                    <div>
                      <span>Purity: </span>
                      <strong className="text-foreground">{scannedResult.item?.purityKarat}</strong>
                    </div>
                    <div>
                      <span>Receiver: </span>
                      <strong className="text-foreground">{scannedResult.item?.receiverName}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Item Custody Table */}
            <div className="space-y-3">
              {customerItems.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-amber-500">{item.receiptNumber}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                          {item.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-bold mt-1">{item.description}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold">{item.grossWeightGrams}g Gross</div>
                      <div className="text-[10px] text-muted-foreground">{item.purityKarat}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                    <div>
                      <span>Barcode: </span>
                      <strong className="font-mono text-foreground">{item.barcode || "N/A"}</strong>
                    </div>
                    <div>
                      <span>NFC Tag UID: </span>
                      <strong className="font-mono text-foreground">{item.nfcTagUid || "Linked"}</strong>
                    </div>
                    <div>
                      <span>Received Date: </span>
                      <strong className="text-foreground">{item.receivedDate}</strong>
                    </div>
                    <div>
                      <span>Intake Officer: </span>
                      <strong className="text-foreground">{item.receiverName}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: APPROVALS & DESIGN REVISIONS */}
        {activeTab === "approvals" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">Design Revisions & Estimate Approvals</h2>
              <p className="text-xs text-muted-foreground">
                Inspect 3D renders, CAD drawings, and quotation estimates. Approving immediately queues production.
              </p>
            </div>

            {selectedJob && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Design Review Card */}
                <div className="p-5 rounded-xl border border-border bg-card space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-amber-500" />
                      Design Render (v{selectedJob.currentDesignVersion})
                    </h3>
                    <Badge
                      className={
                        selectedJob.designApprovalStatus === "approved"
                          ? "bg-emerald-600 text-white font-bold"
                          : "bg-amber-500 text-black font-bold"
                      }
                    >
                      {selectedJob.designApprovalStatus.toUpperCase()}
                    </Badge>
                  </div>

                  {selectedJob.designs.length > 0 && (
                    <div className="rounded-lg overflow-hidden border border-border max-h-64 flex items-center justify-center bg-black/20">
                      <img
                        src={selectedJob.designs[selectedJob.designs.length - 1].imageUrl}
                        alt="Design revision"
                        className="object-contain h-full w-full"
                      />
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {selectedJob.designs[selectedJob.designs.length - 1]?.notes || "Original client CAD visual draft."}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      onClick={() => handleApproveDesign(selectedJob.id)}
                      className="bg-emerald-600 text-white hover:bg-emerald-700 flex-1 font-bold gap-1"
                    >
                      <Check className="h-4 w-4" /> Approve Design
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestRevision(selectedJob.id)}
                      className="flex-1 text-xs gap-1 border-border"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Request Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectDesign(selectedJob.id)}
                      className="text-xs gap-1"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>

                {/* Quotation & Estimate Card */}
                <div className="p-5 rounded-xl border border-border bg-card space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-emerald-500" />
                      Commercial Quotation #{selectedJob.estimateNumber}
                    </h3>
                    <Badge
                      className={
                        selectedJob.estimateApprovalStatus === "approved"
                          ? "bg-emerald-600 text-white font-bold"
                          : "bg-amber-500 text-black font-bold"
                      }
                    >
                      {selectedJob.estimateApprovalStatus.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/30 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fine Gold Component (999):</span>
                      <span className="font-semibold">₹{((selectedJob.estimateAmountPaise * 0.85) / 100).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Workshop Handcrafting / Labour:</span>
                      <span className="font-semibold">₹{((selectedJob.estimateAmountPaise * 0.12) / 100).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hallmark HUID & Certification:</span>
                      <span className="font-semibold">₹{((selectedJob.estimateAmountPaise * 0.03) / 100).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm pt-2 border-t border-border text-amber-500">
                      <span>Total Estimated Cost:</span>
                      <span>₹{(selectedJob.estimateAmountPaise / 100).toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Button
                      size="sm"
                      onClick={() => handleApproveEstimate(selectedJob.id)}
                      className="w-full bg-emerald-600 text-white hover:bg-emerald-700 font-bold gap-1"
                    >
                      <Check className="h-4 w-4" /> Accept & Confirm Estimate
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: PAYMENTS & INVOICES */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">Manufacturing Invoices & Advances</h2>
              <p className="text-xs text-muted-foreground">
                Real-time ledger statements, advance credits, and outstanding work order obligations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customerJobs.map((j) => {
                const outstanding = j.totalAmountPaise - j.paidAmountPaise;
                return (
                  <div key={j.id} className="p-5 rounded-xl border border-border bg-card space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-mono font-bold text-amber-500">{j.invoiceNumber || j.jobNumber}</div>
                        <h3 className="font-bold text-sm mt-0.5">{j.title}</h3>
                      </div>
                      <Badge variant={outstanding === 0 ? "default" : "outline"} className="text-xs">
                        {outstanding === 0 ? "FULLY PAID" : "OUTSTANDING"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/30 text-xs text-center">
                      <div>
                        <span className="text-muted-foreground text-[10px]">Total Bill</span>
                        <div className="font-bold">₹{(j.totalAmountPaise / 100).toLocaleString("en-IN")}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px]">Paid Advance</span>
                        <div className="font-bold text-emerald-500">₹{(j.paidAmountPaise / 100).toLocaleString("en-IN")}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px]">Balance Due</span>
                        <div className="font-bold text-red-500">₹{(outstanding / 100).toLocaleString("en-IN")}</div>
                      </div>
                    </div>

                    {outstanding > 0 && (
                      <Button
                        size="sm"
                        onClick={() => {
                          const ref = window.prompt("Enter payment transaction reference (UPI / IMPS / Bank Txn):");
                          if (ref) {
                            store.recordPayment(j.id, outstanding, ref);
                            toast.success("Payment recorded and posted to double-entry ledger!");
                          }
                        }}
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
                      >
                        Make Payment (₹{(outstanding / 100).toLocaleString("en-IN")})
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 7: DELIVERIES */}
        {activeTab === "deliveries" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">Manufacturing Deliveries & Handover</h2>
              <p className="text-xs text-muted-foreground">
                Track dispatched finished pieces, security logistics, and digital delivery confirmations.
              </p>
            </div>

            <div className="space-y-4">
              {customerDeliveries.map((d) => (
                <div key={d.id} className="p-5 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-amber-500">{d.deliveryNumber}</span>
                        <Badge className="text-[10px] uppercase font-bold bg-emerald-600 text-white">
                          {d.status}
                        </Badge>
                      </div>
                      <h3 className="font-bold text-sm mt-1">Linked Work Order: {d.jobNumber}</h3>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-muted-foreground">Scheduled Date: </span>
                      <strong className="text-foreground">{d.scheduledDate}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
                    <div>
                      <span>Method: </span>
                      <strong className="text-foreground capitalize">{d.deliveryMethod.replace(/_/g, " ")}</strong>
                    </div>
                    <div>
                      <span>Recipient: </span>
                      <strong className="text-foreground">{d.customerName}</strong>
                    </div>
                    <div>
                      <span>Address: </span>
                      <strong className="text-foreground">{d.deliveryAddress || "Showroom Vault Desk"}</strong>
                    </div>
                  </div>

                  {d.status !== "delivered" && (
                    <Button
                      size="sm"
                      onClick={() => {
                        store.confirmDelivery(d.id, customerName, "otp");
                        toast.success("Delivery confirmed and acknowledged by client!");
                      }}
                      className="bg-amber-500 text-black hover:bg-amber-600 font-bold"
                    >
                      Acknowledge Delivery Received
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: DOCUMENT CENTER */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">Authorized Document Vault</h2>
              <p className="text-xs text-muted-foreground">
                Download verified manufacturing invoices, hallmark certificates, and work order specifications.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {customerJobs.map((j) => (
                <div key={j.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center gap-2 text-amber-500">
                    <FileText className="h-5 w-5" />
                    <span className="font-bold text-xs">{j.title}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <div>Job Number: {j.jobNumber}</div>
                    <div>Quotation Ref: {j.estimateNumber}</div>
                    <div>Hallmark HUID: {j.huid || "Registered"}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.success(`Exporting verified document package for ${j.jobNumber}`)}
                    className="w-full text-xs font-semibold gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5" /> Download Verified PDF
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 9: SERVICE & REPAIR DESK */}
        {activeTab === "service" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Manufacturing Service & Support Desk</h2>
                <p className="text-xs text-muted-foreground">
                  Request resizing, clasp adjustments, ultrasonic cleaning, or stone resetting.
                </p>
              </div>
            </div>

            {/* Service Form */}
            <div className="p-5 rounded-xl border border-border bg-card space-y-4">
              <h3 className="text-sm font-bold">Raise New Service Ticket</h3>
              <form onSubmit={handleCreateService} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Linked Manufacturing Work Order (Optional)</Label>
                  <select
                    value={serviceJobNumber}
                    onChange={(e) => setServiceJobNumber(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs"
                  >
                    <option value="">Select Linked Job Order...</option>
                    {customerJobs.map((j) => (
                      <option key={j.id} value={j.jobNumber}>
                        {j.jobNumber} — {j.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Issue Description / Adjustment Needed</Label>
                  <Textarea
                    value={serviceDesc}
                    onChange={(e) => setServiceDesc(e.target.value)}
                    placeholder="e.g. Need safety clasp tension adjustment and re-polishing..."
                    rows={3}
                    className="text-xs"
                    required
                  />
                </div>

                <Button type="submit" size="sm" className="bg-purple-600 text-white hover:bg-purple-700 font-bold">
                  Submit Service Request
                </Button>
              </form>
            </div>

            {/* Service Tickets List */}
            <div className="space-y-3">
              {customerServices.map((st) => (
                <div key={st.id} className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-purple-500">{st.ticketNumber}</span>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">
                        {st.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(st.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs">{st.issueDescription}</p>
                  {st.resolutionNotes && (
                    <div className="p-2 rounded-md bg-muted/40 text-[11px] text-muted-foreground">
                      <strong className="text-foreground">Workshop Note: </strong>
                      {st.resolutionNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 10: NOTIFICATIONS HUB */}
        {activeTab === "notifications" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Client Notification Alerts</h2>
                <p className="text-xs text-muted-foreground">Real-time status updates and milestone confirmations.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  store.clearAllNotifications(customerId);
                  toast.success("All notifications marked as read.");
                }}
                className="text-xs"
              >
                Mark All as Read
              </Button>
            </div>

            <div className="space-y-3">
              {customerNotifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => store.markNotificationRead(n.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    n.read ? "border-border bg-card opacity-80" : "border-amber-500/50 bg-amber-500/5 shadow-xs font-medium"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{n.title}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
