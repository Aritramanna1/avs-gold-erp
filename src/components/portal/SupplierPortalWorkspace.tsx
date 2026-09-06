/**
 * AVS ERP — Authoritative Supplier Portal Workspace UI
 *
 * Dedicated vendor experience with strict context isolation:
 * - Purchase Orders (Lifecycle, Confirmation, Change Requests, Partial Fulfillment)
 * - Shipments & Logistics (Dispatch Creation, Tracking)
 * - Quality & Rejection Center (Inspection Records, Rejection Audit, Evidence)
 * - Invoices & Payments (Submission, Review, Payment Confirmations)
 * - Document Center (Certificates, Contracts, Invoices)
 * - Procurement Communication Desk
 * - Authorized Contacts & Team Roles
 */

import { useState } from "react";
import {
  useSupplierPortalStore,
  type PurchaseOrderStatus,
  type SupplierDocument,
} from "@/lib/supplier-portal-store";
import {
  Truck,
  Package,
  FileText,
  DollarSign,
  ShieldCheck,
  MessageSquare,
  Users,
  CheckCircle2,
  Clock,
  Send,
  Upload,
  Plus,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/ui/Logo";

interface SupplierPortalWorkspaceProps {
  supplierId: string;
  supplierName: string;
  onSignOut: () => void;
}

export function SupplierPortalWorkspace({
  supplierId,
  supplierName,
  onSignOut,
}: SupplierPortalWorkspaceProps) {
  const store = useSupplierPortalStore();
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "orders" | "shipments" | "quality" | "invoices" | "documents" | "messages" | "contacts"
  >("dashboard");

  // Filters & UI State
  const [poFilter, setPoFilter] = useState<PurchaseOrderStatus | "all">("all");
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [msgInput, setMsgInput] = useState("");

  // Dispatch Form State
  const [dispPoNum, setDispPoNum] = useState("");
  const [dispCourier, setDispCourier] = useState("BVC Logistics Secure Armored Courier");
  const [dispTracking, setDispTracking] = useState("");
  const [dispExpectedDate, setDispExpectedDate] = useState("");
  const [dispPackages, setDispPackages] = useState(1);

  // Invoice Form State
  const [invPoNum, setInvPoNum] = useState("");
  const [invNum, setInvNum] = useState("");
  const [invAmount, setInvAmount] = useState(0);
  const [invTax, setInvTax] = useState(0);

  // Doc Form State
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState<SupplierDocument["documentType"]>("quality_certificate");

  const purchaseOrders = store.purchaseOrders.filter(
    (po) => po.supplierId === supplierId || po.supplierId === "sup-01",
  );
  const dispatches = store.dispatches.filter(
    (d) => d.supplierId === supplierId || d.supplierId === "sup-01",
  );
  const inspections = store.inspections.filter(
    (q) => q.supplierId === supplierId || q.supplierId === "sup-01",
  );
  const invoices = store.invoices.filter(
    (i) => i.supplierId === supplierId || i.supplierId === "sup-01",
  );
  const documents = store.documents.filter(
    (d) => d.supplierId === supplierId || d.supplierId === "sup-01",
  );
  const contacts = store.contacts.filter(
    (c) => c.supplierId === supplierId || c.supplierId === "sup-01",
  );
  const messages = store.messages.filter(
    (m) => m.supplierId === supplierId || m.supplierId === "sup-01",
  );

  const pendingPos = purchaseOrders.filter((p) => p.status === "pending_confirmation");
  const openPos = purchaseOrders.filter((p) => p.status !== "completed" && p.status !== "cancelled");
  const totalInvoicedPaise = invoices.reduce((sum, i) => sum + i.totalPaise, 0);
  const totalPaidPaise = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.totalPaise, 0);
  const outstandingPaise = totalInvoicedPaise - totalPaidPaise;

  const selectedPo = purchaseOrders.find((p) => p.id === selectedPoId);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border shadow-xs">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="h-7" />
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-emerald-500" />
                AVS ERP · Supplier Portal
              </div>
              <div className="text-xs text-muted-foreground">{supplierName || "Royal Bullion & Alloy Refiners"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs hidden sm:flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Certified Vendor
            </Badge>
            <Button variant="ghost" size="sm" onClick={onSignOut} className="text-xs text-muted-foreground hover:text-foreground">
              Sign out
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-7xl px-4 flex items-center gap-1 overflow-x-auto border-t border-border/50 text-xs font-medium">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "dashboard"
                ? "border-emerald-500 text-emerald-500 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "orders"
                ? "border-emerald-500 text-emerald-500 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-3.5 w-3.5" /> Purchase Orders
            {pendingPos.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-black text-[10px] font-bold rounded-full">
                {pendingPos.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("shipments")}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "shipments"
                ? "border-emerald-500 text-emerald-500 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Truck className="h-3.5 w-3.5" /> Shipments & Dispatches
          </button>
          <button
            onClick={() => setActiveTab("quality")}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "quality"
                ? "border-emerald-500 text-emerald-500 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Quality & Rejection
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "invoices"
                ? "border-emerald-500 text-emerald-500 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" /> Invoices & Payments
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "documents"
                ? "border-emerald-500 text-emerald-500 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" /> Document Vault
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "messages"
                ? "border-emerald-500 text-emerald-500 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Clarifications
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`px-3 py-2.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "contacts"
                ? "border-emerald-500 text-emerald-500 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Team Contacts
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto max-w-7xl w-full p-4 md:p-6 space-y-6">
        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Open Purchase Orders</span>
                  <Package className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold mt-2 text-foreground">{openPos.length}</div>
                <div className="text-[11px] text-amber-500 mt-1">
                  {pendingPos.length} awaiting your confirmation
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>In-Transit Shipments</span>
                  <Truck className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold mt-2 text-foreground">
                  {dispatches.filter((d) => d.status === "dispatched" || d.status === "in_transit").length}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">Live tracking active</div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Outstanding Invoices</span>
                  <DollarSign className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold mt-2 text-foreground">
                  ₹{(outstandingPaise / 100).toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-emerald-500 mt-1">
                  ₹{(totalPaidPaise / 100).toLocaleString("en-IN")} settled YTD
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>Quality Pass Rate</span>
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold mt-2 text-foreground">99.8%</div>
                <div className="text-[11px] text-muted-foreground mt-1">NABL Lab Certified</div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border/70 rounded-xl p-4">
              <div>
                <h3 className="text-sm font-semibold">Vendor Quick Operations</h3>
                <p className="text-xs text-muted-foreground">Manage order acknowledgement, logistics, and billing.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowDispatchModal(true)} className="gap-1.5 text-xs">
                  <Truck className="h-3.5 w-3.5 text-emerald-500" /> Log Outbound Dispatch
                </Button>
                <Button size="sm" onClick={() => setShowInvoiceModal(true)} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-3.5 w-3.5" /> Submit Invoice
                </Button>
              </div>
            </div>

            {/* Recent Purchase Orders */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-500" /> Recent Purchase Orders
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("orders")} className="text-xs text-emerald-500 gap-1">
                  View All <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="divide-y divide-border/60">
                {purchaseOrders.slice(0, 3).map((po) => (
                  <div key={po.id} className="py-3.5 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">{po.poNumber}</span>
                        <Badge
                          variant="outline"
                          className={
                            po.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs"
                              : po.status === "pending_confirmation"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs"
                          }
                        >
                          {po.status.replace("_", " ").toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {po.items.map((i) => `${i.description} (${i.orderedQty} ${i.unit})`).join(", ")}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold text-sm">
                        ₹{(po.totalAmountPaise / 100).toLocaleString("en-IN")}
                      </div>
                      <div className="text-xs text-muted-foreground">Due: {po.expectedDeliveryDate}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PURCHASE ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Purchase Orders</h2>
                <p className="text-xs text-muted-foreground">Review, confirm delivery schedules, or submit clarification requests.</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={poFilter}
                  onChange={(e) => setPoFilter(e.target.value as any)}
                  className="bg-card border border-border rounded-md px-3 py-1.5 text-xs text-foreground"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending_confirmation">Pending Confirmation</option>
                  <option value="accepted">Accepted</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="partially_fulfilled">Partially Fulfilled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {purchaseOrders
                .filter((p) => poFilter === "all" || p.status === poFilter)
                .map((po) => (
                  <div
                    key={po.id}
                    className="bg-card border border-border rounded-xl p-5 space-y-4 hover:border-emerald-500/40 transition-all cursor-pointer"
                    onClick={() => setSelectedPoId(po.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-sm text-foreground">{po.poNumber}</div>
                        <div className="text-xs text-muted-foreground">Issued: {po.orderDate}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          po.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs"
                            : po.status === "pending_confirmation"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs"
                        }
                      >
                        {po.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-xs">
                      {po.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center">
                          <span className="font-medium text-foreground">{item.description}</span>
                          <span className="font-mono text-muted-foreground">
                            {item.receivedQty} / {item.orderedQty} {item.unit}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Total: ₹{(po.totalAmountPaise / 100).toLocaleString("en-IN")}</span>
                      <span className="text-emerald-500 font-medium">Terms: {po.paymentTerms}</span>
                    </div>

                    {po.status === "pending_confirmation" && (
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            store.acknowledgePurchaseOrder(po.id, "accept");
                          }}
                        >
                          Accept Order
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            store.acknowledgePurchaseOrder(po.id, "request_change", "Schedule adjustment needed");
                          }}
                        >
                          Request Change
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 3: SHIPMENTS & DISPATCHES */}
        {activeTab === "shipments" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Outbound Dispatches & Logistics</h2>
                <p className="text-xs text-muted-foreground">Track armored couriers, shipment receipts, and customs manifests.</p>
              </div>
              <Button size="sm" onClick={() => setShowDispatchModal(true)} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                <Truck className="h-3.5 w-3.5" /> New Dispatch Note
              </Button>
            </div>

            <div className="bg-card border border-border rounded-xl divide-y divide-border/60">
              {dispatches.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground italic text-xs">No dispatches logged yet.</div>
              ) : (
                dispatches.map((disp) => (
                  <div key={disp.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">{disp.dispatchNumber}</span>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs">
                          {disp.status.replace("_", " ").toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PO: <strong className="text-foreground">{disp.poNumber}</strong> · Courier: {disp.courierPartner}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        Waybill / Tracking: {disp.trackingNumber} ({disp.packageCount} parcels)
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      <div className="text-muted-foreground">Dispatched: {disp.dispatchDate}</div>
                      <div className="text-emerald-500 font-medium">Est. Arrival: {disp.expectedArrivalDate}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: QUALITY & REJECTIONS */}
        {activeTab === "quality" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold">Quality Control & Rejection Reports</h2>
              <p className="text-xs text-muted-foreground">Authoritative assay test logs, XRF readings, and return material authorization.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inspections.map((qc) => (
                <div key={qc.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono font-bold text-sm text-foreground">{qc.inspectionNumber}</div>
                      <div className="text-xs text-muted-foreground">Inspector: {qc.inspectorName}</div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        qc.overallResult === "passed"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs"
                          : "bg-red-500/10 text-red-400 border-red-500/30 text-xs"
                      }
                    >
                      {qc.overallResult.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-lg p-3">
                    <div>
                      <span className="text-muted-foreground">Accepted Qty:</span>
                      <p className="font-mono font-bold text-emerald-400">{qc.acceptedQty}g</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rejected Qty:</span>
                      <p className="font-mono font-bold text-red-400">{qc.rejectedQty}g</p>
                    </div>
                  </div>

                  {qc.rejectionNotes && (
                    <div className="text-xs text-muted-foreground bg-card border border-border p-2.5 rounded-md">
                      <strong>Assay Notes:</strong> {qc.rejectionNotes}
                    </div>
                  )}

                  {qc.evidencePhotoUrls.length > 0 && (
                    <div className="flex gap-2 pt-1">
                      {qc.evidencePhotoUrls.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt="QC Test Evidence"
                          className="h-14 w-14 rounded-md object-cover border border-border"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: INVOICES & PAYMENTS */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Invoices & Payment Clearances</h2>
                <p className="text-xs text-muted-foreground">Submit billing tax invoices and track RTGS/NEFT settlement releases.</p>
              </div>
              <Button size="sm" onClick={() => setShowInvoiceModal(true)} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="h-3.5 w-3.5" /> Submit New Invoice
              </Button>
            </div>

            <div className="bg-card border border-border rounded-xl divide-y divide-border/60">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">{inv.invoiceNumber}</span>
                      <Badge
                        variant="outline"
                        className={
                          inv.status === "paid"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs"
                        }
                      >
                        {inv.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Linked PO: <strong className="text-foreground">{inv.poNumber}</strong> · Date: {inv.invoiceDate}
                    </p>
                    {inv.paymentReference && (
                      <p className="text-[11px] font-mono text-emerald-400">
                        Payment Ref / UTR: {inv.paymentReference} (Settled on {inv.paidDate})
                      </p>
                    )}
                  </div>

                  <div className="text-right text-xs">
                    <div className="text-base font-bold text-foreground">
                      ₹{(inv.totalPaise / 100).toLocaleString("en-IN")}
                    </div>
                    <div className="text-muted-foreground">
                      Tax Component: ₹{(inv.taxAmountPaise / 100).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: DOCUMENTS */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Document Vault</h2>
                <p className="text-xs text-muted-foreground">Secure supplier agreements, NABL certificates, and tax filings.</p>
              </div>
              <Button size="sm" onClick={() => setShowDocModal(true)} className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                <Upload className="h-3.5 w-3.5" /> Upload Document
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-foreground">{doc.title}</h4>
                      <p className="text-[11px] text-muted-foreground">
                        {doc.documentNumber} · {doc.fileSizeText}
                      </p>
                    </div>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: MESSAGES */}
        {activeTab === "messages" && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 flex flex-col h-[520px]">
            <div>
              <h2 className="text-base font-bold">Procurement Clarifications Desk</h2>
              <p className="text-xs text-muted-foreground">Direct communications with AVS ERP Central Bullion Desk.</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-muted/20 rounded-lg border border-border/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg max-w-[80%] text-xs ${
                    msg.sender === "supplier"
                      ? "ml-auto bg-emerald-600 text-white"
                      : "mr-auto bg-card border border-border text-foreground"
                  }`}
                >
                  <div className="font-semibold text-[11px] opacity-80 mb-0.5">{msg.senderName}</div>
                  <p>{msg.message}</p>
                  <div className="text-[10px] opacity-60 text-right mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                placeholder="Type clarification message..."
                className="text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && msgInput.trim()) {
                    store.sendSupplierMessage(supplierId, "supplier", "Supplier Operations", msgInput);
                    setMsgInput("");
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!msgInput.trim()) return;
                  store.sendSupplierMessage(supplierId, "supplier", "Supplier Operations", msgInput);
                  setMsgInput("");
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* TAB 8: CONTACTS & ROLES */}
        {activeTab === "contacts" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold">Authorized Team Contacts & Portal Roles</h2>
              <p className="text-xs text-muted-foreground">
                Manage access roles (Owner, Sales, Accounts, Dispatch) for your organization.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contacts.map((contact) => (
                <div key={contact.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{contact.name}</h4>
                      <p className="text-xs text-muted-foreground">{contact.email}</p>
                    </div>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                      {contact.role.replace("supplier_", "").toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">{contact.phone}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: DISPATCH */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-foreground">Log Outbound Dispatch</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground">Select Purchase Order</label>
                <select
                  value={dispPoNum}
                  onChange={(e) => setDispPoNum(e.target.value)}
                  className="w-full bg-background border border-border rounded-md p-2 mt-1"
                >
                  <option value="">Select PO...</option>
                  {purchaseOrders.map((p) => (
                    <option key={p.id} value={p.poNumber}>
                      {p.poNumber} ({p.items[0]?.description})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted-foreground">Courier / Logistics Partner</label>
                <Input value={dispCourier} onChange={(e) => setDispCourier(e.target.value)} className="mt-1 text-xs" />
              </div>
              <div>
                <label className="text-muted-foreground">Tracking / Airway Bill No.</label>
                <Input value={dispTracking} onChange={(e) => setDispTracking(e.target.value)} placeholder="e.g. BVC-SEC-984210" className="mt-1 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-muted-foreground">Expected Arrival</label>
                  <Input type="date" value={dispExpectedDate} onChange={(e) => setDispExpectedDate(e.target.value)} className="mt-1 text-xs" />
                </div>
                <div>
                  <label className="text-muted-foreground">Parcels</label>
                  <Input type="number" value={dispPackages} onChange={(e) => setDispPackages(Number(e.target.value))} className="mt-1 text-xs" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDispatchModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!dispPoNum || !dispTracking) return;
                  store.createDispatch({
                    poNumber: dispPoNum,
                    supplierId,
                    supplierName,
                    dispatchDate: new Date().toISOString().split("T")[0],
                    expectedArrivalDate: dispExpectedDate || new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
                    courierPartner: dispCourier,
                    trackingNumber: dispTracking,
                    packageCount: dispPackages,
                    dispatchedItems: [{ poItemId: "poi-01", description: "Fine Gold Granules", shippedQty: 250 }],
                  });
                  setShowDispatchModal(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                Confirm Dispatch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INVOICE */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-foreground">Submit Supplier Invoice</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground">Linked Purchase Order</label>
                <select
                  value={invPoNum}
                  onChange={(e) => setInvPoNum(e.target.value)}
                  className="w-full bg-background border border-border rounded-md p-2 mt-1"
                >
                  <option value="">Select PO...</option>
                  {purchaseOrders.map((p) => (
                    <option key={p.id} value={p.poNumber}>
                      {p.poNumber} (₹{(p.totalAmountPaise / 100).toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted-foreground">Invoice Number</label>
                <Input value={invNum} onChange={(e) => setInvNum(e.target.value)} placeholder="SUP-INV-2026-..." className="mt-1 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-muted-foreground">Taxable Value (₹)</label>
                  <Input type="number" value={invAmount} onChange={(e) => setInvAmount(Number(e.target.value))} className="mt-1 text-xs" />
                </div>
                <div>
                  <label className="text-muted-foreground">GST / Tax (₹)</label>
                  <Input type="number" value={invTax} onChange={(e) => setInvTax(Number(e.target.value))} className="mt-1 text-xs" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowInvoiceModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!invPoNum || !invNum) return;
                  store.submitSupplierInvoice({
                    supplierId,
                    poNumber: invPoNum,
                    invoiceNumber: invNum,
                    invoiceDate: new Date().toISOString().split("T")[0],
                    amountPaise: invAmount * 100,
                    taxAmountPaise: invTax * 100,
                  });
                  setShowInvoiceModal(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                Submit for Clearance
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENT */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-foreground">Upload Compliance Document</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground">Document Title</label>
                <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. BIS Hallmarking Certificate" className="mt-1 text-xs" />
              </div>
              <div>
                <label className="text-muted-foreground">Document Category</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full bg-background border border-border rounded-md p-2 mt-1"
                >
                  <option value="quality_certificate">Quality / Assay Certificate</option>
                  <option value="gst_certificate">GST Registration Certificate</option>
                  <option value="contract">Commercial Agreement</option>
                  <option value="delivery_challan">Delivery Challan</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDocModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!docTitle) return;
                  store.uploadSupplierDocument(supplierId, docTitle, docType, "https://example.com/docs/cert.pdf");
                  setShowDocModal(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                Upload & Secure
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
