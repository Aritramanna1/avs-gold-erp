import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  createSupportTicket,
  listMySupportTickets,
  getSupportThread,
  replySupportTicket,
  resolveSupportTicket,
  type SupportTicket,
  type SupportThread,
} from "@/lib/platform-support-service";
import { useRoles } from "@/lib/rbac";
import {
  HelpCircle,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  PlusCircle,
  Package,
  Receipt,
  Hammer,
  Printer,
  ChevronRight,
  Shield,
  LifeBuoy,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ISSUE_CATEGORIES = [
  {
    id: "orders",
    title: "Customer Order & Delivery",
    subtitle: "Custom jewellery order, due dates, or design change",
    icon: Package,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    faqs: [
      { q: "How to edit an active customer order design?", a: "Go to Sell & Customers > Orders > click the order > Edit specs." },
      { q: "How to mark an order ready for customer pickup?", a: "Update the status to 'Ready' in the Order details card." },
    ],
  },
  {
    id: "billing",
    title: "Invoice, GST & Payments",
    subtitle: "Bill calculations, tax rate, payment settlement, or refund",
    icon: Receipt,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    faqs: [
      { q: "Why is GST showing separate CGST & SGST?", a: "For intra-state sales, GST is split 50-50 into CGST (1.5%) and SGST (1.5%)." },
      { q: "How to cancel or issue a credit note for a bill?", a: "Go to Sell & Customers > Credit Notes > Create Credit Note." },
    ],
  },
  {
    id: "karigar",
    title: "Karigar Gold & Workshop",
    subtitle: "Metal issue discrepancy, wastage % or outside jobwork",
    icon: Hammer,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    faqs: [
      { q: "How is pure gold (995) calculated from 22K?", a: "Fine Weight = Gross Weight × (22 / 24) = Gross × 0.9167." },
      { q: "How to record Karigar final settlement?", a: "Use Workshop > Artisan Settlements to reconcile gold and cash wages." },
    ],
  },
  {
    id: "hardware",
    title: "Printers, Barcode & Scales",
    subtitle: "Thermal label printer, weighing scale connection, or scanner",
    icon: Printer,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    faqs: [
      { q: "Printer not responding via WebUSB / RawPrint?", a: "Check device power and ensure USB permissions are granted in browser settings." },
      { q: "Barcode scanner not typing into field?", a: "Ensure the cursor is active inside the barcode input field before scanning." },
    ],
  },
  {
    id: "system",
    title: "Staff Access & Security",
    subtitle: "Staff login issues, PIN reset, or branch permissions",
    icon: Shield,
    color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    faqs: [
      { q: "How to invite a new staff member?", a: "Go to Settings > Users & Roles > Staff Directory > Invite Staff." },
      { q: "How to change staff role permissions?", a: "Select the role in Users & Roles and toggle permitted module switches." },
    ],
  },
];

export function ConsumerSupportDesk() {
  const { roles } = useRoles();
  const isStaff =
    roles.includes("super_owner") ||
    roles.includes("owner") ||
    roles.includes("manager") ||
    roles.includes("billing");

  const [selectedCategory, setSelectedCategory] = useState<string>("orders");
  const [activeTab, setActiveTab] = useState<"triage" | "tickets" | "workspace">("triage");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // New Ticket Form State
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [orderContext, setOrderContext] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await listMySupportTickets();
      setTickets(res || []);
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [isStaff]);

  const handleSelectTicket = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    try {
      const data = await getSupportThread(ticketId);
      setThread(data);
    } catch {
      toast.error("Could not load conversation thread");
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error("Please fill in the subject and issue details.");
      return;
    }

    setSubmitting(true);
    try {
      const fullDesc = orderContext
        ? `${description.trim()}\n\n[Related Record: ${orderContext.trim()}]`
        : description.trim();

      const created = await createSupportTicket({
        subject: subject.trim(),
        description: fullDesc,
        category: selectedCategory,
        priority,
      });

      toast.success("Support ticket created! A specialist is reviewing your request.");
      setSubject("");
      setDescription("");
      setOrderContext("");
      await fetchTickets();
      setActiveTab("tickets");
      if (created?.id) {
        handleSelectTicket(created.id);
      }
    } catch (err: any) {
      toast.error(err.message || "Error submitting ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicketId || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await replySupportTicket(selectedTicketId, replyText.trim());
      setReplyText("");
      const updated = await getSupportThread(selectedTicketId);
      setThread(updated);
    } catch {
      toast.error("Error sending reply");
    } finally {
      setSendingReply(false);
    }
  };

  const handleResolve = async (ticketId: string) => {
    try {
      await resolveSupportTicket(ticketId);
      toast.success("Ticket marked as resolved!");
      await fetchTickets();
      if (selectedTicketId === ticketId) {
        const updated = await getSupportThread(ticketId);
        setThread(updated);
      }
    } catch {
      toast.error("Could not update ticket status");
    }
  };

  const activeCategory = ISSUE_CATEGORIES.find((c) => c.id === selectedCategory) || ISSUE_CATEGORIES[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-r from-card via-card to-gold/5 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gold/15 border border-gold/30 grid place-items-center text-gold shrink-0 shadow-xs">
              <LifeBuoy className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>AVS Support & Resolution Desk</span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]">
                  SLA: &lt; 15 min response
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Instant troubleshooting, guided issue triage, and live support tracking for all store operations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab("triage");
                setSelectedTicketId(null);
              }}
              className="text-xs gap-1.5 h-9"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>New Request</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActiveTab("tickets");
                fetchTickets();
              }}
              className="text-xs gap-1.5 h-9"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>My Tickets ({tickets.length})</span>
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 max-w-md">
          <TabsTrigger value="triage" className="text-xs">
            1. What's Wrong?
          </TabsTrigger>
          <TabsTrigger value="tickets" className="text-xs">
            2. Active Tickets ({tickets.length})
          </TabsTrigger>
          {isStaff && (
            <TabsTrigger value="workspace" className="text-xs">
              Staff Desk
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Guided "What's Wrong?" Triage */}
        <TabsContent value="triage" className="space-y-6">
          <div className="space-y-3">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Step 1: Select What You Need Help With
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {ISSUE_CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer group",
                      isSelected
                        ? "border-gold bg-gold/5 shadow-xs"
                        : "border-border bg-card/80 hover:border-gold/40 hover:bg-card"
                    )}
                  >
                    <div className={`h-8 w-8 rounded-lg grid place-items-center mb-2.5 border shrink-0 ${cat.color}`}>
                      <CatIcon className="h-4 w-4" />
                    </div>
                    <div className="font-bold text-xs text-foreground group-hover:text-gold transition-colors">
                      {cat.title}
                    </div>
                    <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                      {cat.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Instant Answers Before Ticket Creation */}
          {activeCategory.faqs.length > 0 && (
            <Card className="border-border bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <HelpCircle className="h-3.5 w-3.5 text-gold" />
                  <span>Instant Answers for {activeCategory.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {activeCategory.faqs.map((faq, i) => (
                  <div key={i} className="text-xs p-2.5 rounded-lg border border-border/70 bg-card">
                    <div className="font-semibold text-foreground">{faq.q}</div>
                    <div className="text-muted-foreground mt-0.5 text-[11px]">{faq.a}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Fast Ticket Form */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-gold" />
                <span>Submit a Request for {activeCategory.title}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Provide details and our technical operations team will resolve it swiftly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Issue Summary *</label>
                    <Input
                      required
                      placeholder="e.g. Weight mismatch on Gold Book entry for Karigar Ramesh"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Urgency Level</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-gold"
                    >
                      <option value="low">Low (General Query)</option>
                      <option value="normal">Normal (Standard)</option>
                      <option value="high">High (Blocking Work)</option>
                      <option value="urgent">Urgent (Critical Store Blocker)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Related Invoice, Order, or Barcode # (Optional)</label>
                  <Input
                    placeholder="e.g. INV-1042 or ORD-889 or Tag #10294"
                    value={orderContext}
                    onChange={(e) => setOrderContext(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Detailed Description *</label>
                  <Textarea
                    required
                    rows={4}
                    placeholder="Explain what happened, what was expected, and any error message shown..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gold text-black hover:bg-gold/90 font-bold text-xs gap-1.5 h-9"
                >
                  {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>Submit Ticket</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Active Tickets & Live Timeline */}
        <TabsContent value="tickets" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ticket List */}
            <div className="md:col-span-1 space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {loading && <div className="text-xs text-muted-foreground p-3">Loading tickets...</div>}
              {!loading && tickets.length === 0 && (
                <div className="text-xs text-muted-foreground p-4 text-center rounded-xl border border-dashed border-border">
                  No active support tickets found. Everything is operating smoothly!
                </div>
              )}
              {tickets.map((t) => {
                const isSelected = selectedTicketId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTicket(t.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all cursor-pointer space-y-1.5",
                      isSelected
                        ? "border-gold bg-gold/10 shadow-xs"
                        : "border-border bg-card/80 hover:border-gold/30 hover:bg-card"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                        {t.ticket_no}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] uppercase",
                          t.status === "resolved"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            : "bg-blue-500/10 text-blue-500 border-blue-500/30"
                        )}
                      >
                        {t.status}
                      </Badge>
                    </div>
                    <div className="font-bold text-xs text-foreground line-clamp-1">{t.subject}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      <span className="capitalize font-medium text-gold">{t.priority} priority</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Conversation Timeline & Details */}
            <div className="md:col-span-2">
              {thread ? (
                <Card className="border-border bg-card flex flex-col h-[550px]">
                  <CardHeader className="p-4 border-b border-border/70 shrink-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gold font-bold">{thread.ticket.ticket_no}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {thread.ticket.status}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-sm text-foreground mt-0.5">{thread.ticket.subject}</h3>
                      </div>
                      {thread.ticket.status !== "resolved" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolve(thread.ticket.id)}
                          className="text-xs h-8 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Mark Resolved</span>
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  {/* Messages Feed */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3">
                    {thread.messages.map((m) => {
                      const isMe = m.sender === "customer";
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "flex flex-col max-w-[85%] rounded-xl p-3 text-xs space-y-1",
                            isMe
                              ? "ml-auto bg-primary text-primary-foreground"
                              : "mr-auto bg-muted border border-border text-foreground"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3 text-[10px] opacity-80">
                            <span className="font-semibold">{isMe ? "You" : "AVS Support Specialist"}</span>
                            <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply Input */}
                  <div className="p-3 border-t border-border/70 bg-card/60 flex gap-2 shrink-0">
                    <Input
                      placeholder="Type your message or follow-up query..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      className="text-xs"
                    />
                    <Button
                      onClick={handleSendReply}
                      disabled={sendingReply || !replyText.trim()}
                      className="bg-gold text-black hover:bg-gold/90 h-9 px-3 text-xs font-bold"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="h-[550px] rounded-xl border border-dashed border-border flex flex-col items-center justify-center p-6 text-center text-muted-foreground text-xs space-y-2">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                  <p>Select a support ticket from the list to view the conversation thread.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Staff Workspace */}
        {isStaff && (
          <TabsContent value="workspace" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <LifeBuoy className="h-4 w-4 text-emerald-500" />
                  <span>Support Staff Operations Queue</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage store tickets, assign technicians, reply with internal notes, and track resolution metrics.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/70 text-muted-foreground font-semibold border-b border-border">
                      <tr>
                        <th className="p-2.5">Ticket #</th>
                        <th className="p-2.5">Subject</th>
                        <th className="p-2.5">Priority</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Created</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tickets.map((t) => (
                        <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-2.5 font-mono text-gold font-medium">{t.ticket_no}</td>
                          <td className="p-2.5 font-medium text-foreground">{t.subject}</td>
                          <td className="p-2.5 capitalize">{t.priority}</td>
                          <td className="p-2.5">
                            <Badge variant="outline" className="text-[10px]">
                              {t.status}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                          <td className="p-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setActiveTab("tickets");
                                handleSelectTicket(t.id);
                              }}
                              className="h-7 text-xs text-gold"
                            >
                              Open Thread
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
