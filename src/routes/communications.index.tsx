import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  useCRMStore,
  type CRMLeadOpportunity,
  type CRMTaskMeeting,
  type CRMInteraction,
  type OpportunityStage,
  type PriorityLevel,
  type LeadSource,
  type BuyerType,
  LEAD_SOURCE_LABELS,
  BUYER_TYPE_LABELS,
  type TaskType,
  type TaskStatus,
  type InteractionType,
} from "@/lib/crm-store";
import { usePeople, type Person } from "@/lib/people-store";
import { useCurrentBranchId, useBranch } from "@/lib/branch-store";
import { useCommSettings } from "@/lib/comm/comm-settings-store";
import { useCommLog } from "@/lib/comm-log-store";
import { useSettings } from "@/lib/settings-store";
import { sendGenericEmail } from "@/lib/email-service";
import { PROVIDER_LABELS } from "@/lib/comm/provider-registry";
import type { ProviderConfig, ProviderType, CommChannel } from "@/lib/comm/types";
import { useOrders } from "@/lib/orders-store";
import { useBilling } from "@/lib/billing-store";
import { useRepairs } from "@/lib/repair-store";
import { useJobCards } from "@/lib/jobcards-store";
import {
  MessageSquare,
  Sparkles,
  Mail,
  Zap,
  Phone,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  TrendingUp,
  Clock,
  Check,
  CheckCircle,
  XCircle,
  Users,
  Search,
  ChevronRight,
  Settings,
  FlameKindling,
  History,
  ShieldAlert,
  Lock,
  Play,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { paiseToRupees, rupeesToPaise } from "@/lib/billing-store";
import { ModuleComingSoon } from "@/components/ModuleComingSoon";
import {
  CRM_PIPELINE_COMING_SOON_MESSAGE,
  CRM_PIPELINE_COMING_SOON_DETAIL,
  MARKETING_CAMPAIGNS_COMING_SOON_MESSAGE,
  MARKETING_CAMPAIGNS_COMING_SOON_DETAIL,
} from "@/lib/pilot-config";
import { waMobileUrl, isValidWaPhone } from "@/lib/wa-link";

export const Route = createFileRoute("/communications/")({
  head: () => ({ meta: [{ title: "Communications Hub · AVS Gold ERP" }] }),
  component: CommunicationsDashboardPage,
});

// Workshop V1.1 scope: CRM pipeline and bulk marketing campaigns aren't part
// of the first production release — see src/lib/pilot-config.ts. The real
// implementations below stay in the file untouched; flip these to re-enable.
const CRM_PIPELINE_ENABLED = false;
const MARKETING_CAMPAIGNS_ENABLED = false;

const PIPELINE_STAGES: { key: OpportunityStage; label: string; color: string }[] = [
  { key: "lead", label: "New Lead", color: "bg-muted text-muted-foreground" },
  {
    key: "contacted",
    label: "Contacted",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  {
    key: "qualified",
    label: "Qualified",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  {
    key: "proposal",
    label: "Quotation Sent",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  {
    key: "negotiation",
    label: "Negotiation",
    color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  { key: "won", label: "Won", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { key: "lost", label: "Lost", color: "bg-red-500/10 text-red-400 border-red-500/20" },
];

const CHANNEL_PROVIDERS: Record<CommChannel, ProviderType[]> = {
  whatsapp: [
    "whatsapp_deep_link",
    "whatsapp_cloud_api",
    "whatsapp_interakt",
    "whatsapp_wati",
    "whatsapp_aisensy",
    "whatsapp_gupshup",
  ],
  email: ["email_smtp", "email_resend", "email_sendgrid", "email_ses", "email_mailgun"],
  sms: ["sms_twilio", "sms_msg91", "sms_fast2sms"],
};

const CHANNEL_ICONS = {
  whatsapp: MessageSquare,
  email: Mail,
  sms: Zap,
};

const WA_CLOUD_API_FIELDS = [
  { key: "phone_number_id", label: "Phone Number ID", placeholder: "1234567890..." },
  { key: "access_token", label: "Access Token", placeholder: "EAABxxxxxx...", type: "password" },
  { key: "business_account_id", label: "Business Account ID", placeholder: "9876543210..." },
  { key: "api_version", label: "API Version", placeholder: "v18.0" },
];

const WA_TEMPLATE_FIELDS = [
  { key: "template_invoice", label: "Invoice Template Name", placeholder: "invoice_notification" },
  { key: "template_receipt", label: "Receipt Template Name", placeholder: "payment_receipt" },
  { key: "template_order_ready", label: "Order Ready Template", placeholder: "order_ready" },
  {
    key: "template_payment_reminder",
    label: "Payment Reminder Template",
    placeholder: "payment_reminder",
  },
  { key: "template_repair_ready", label: "Repair Ready Template", placeholder: "repair_ready" },
];

const BSP_FIELDS = [
  { key: "api_key", label: "API Key", placeholder: "your_api_key", type: "password" },
  { key: "api_url", label: "API URL (optional)", placeholder: "" },
  { key: "sender_phone", label: "Sender Phone", placeholder: "91XXXXXXXXXX" },
];

const EMAIL_SMTP_FIELDS = [
  { key: "from_email", label: "From Email", placeholder: "no-reply@example.com" },
  { key: "from_name", label: "From Name", placeholder: "MTJ ERP" },
  { key: "host", label: "SMTP Host", placeholder: "smtp.hostinger.com" },
  { key: "port", label: "Port", placeholder: "465" },
  { key: "username", label: "Username / Email", placeholder: "smtp user" },
  { key: "password", label: "Password", placeholder: "••••••••", type: "password" },
  { key: "use_ssl", label: "Use SSL/TLS", placeholder: "true" },
];

const EMAIL_API_FIELDS = [
  { key: "from_email", label: "From Email", placeholder: "no-reply@example.com" },
  { key: "from_name", label: "From Name", placeholder: "MTJ ERP" },
  { key: "api_key", label: "API Key", placeholder: "your_api_key", type: "password" },
];

function getSettingFields(type: ProviderType) {
  if (type === "whatsapp_cloud_api") return [...WA_CLOUD_API_FIELDS, ...WA_TEMPLATE_FIELDS];
  if (type === "whatsapp_deep_link") return [];
  if (type.startsWith("whatsapp_")) return [...BSP_FIELDS, ...WA_TEMPLATE_FIELDS];
  if (type === "email_smtp") return EMAIL_SMTP_FIELDS;
  if (type.startsWith("email_")) return EMAIL_API_FIELDS;
  return [{ key: "api_key", label: "API Key", placeholder: "••••••••", type: "password" }];
}

export default function CommunicationsDashboardPage() {
  const branchId = useCurrentBranchId();
  const accessible = useBranch(useShallow((s) => s.getAccessibleBranches()));

  // Force Owner Login in Counter Mode for Campaigns and Provider Settings
  const [activeTab, setActiveTab] = useState("dashboard");

  // Stores
  const {
    refresh,
    opportunities,
    tasks,
    interactions,
    saveOpportunity,
    deleteOpportunity,
    moveStage,
    saveTask,
    deleteTask,
    toggleTaskCompleted,
    addInteraction,
  } = useCRMStore();
  const people = usePeople((s) => s.people);
  const orders = useOrders((s) => s.orders);
  const invoices = useBilling((s) => s.invoices);
  const repairs = useRepairs((s) => s.repairs);
  const jobs = useJobCards((s) => s.jobs);
  const { configs, upsertConfig, removeConfig, ensureDefaults } = useCommSettings();
  const commEvents = useCommLog((s) => s.events);
  const storedTemplates = useSettings((s) => s.campaignTemplates);
  const setCampaignTemplates = useSettings((s) => s.setCampaignTemplates);
  const commAutomation = useSettings((s) => s.commAutomation);
  const setCommAutomation = useSettings((s) => s.setCommAutomation);

  // Search & Dialog Modals
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [oppModalOpen, setOppModalOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<CRMLeadOpportunity | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CRMTaskMeeting | null>(null);

  // Leads state variables
  const [oppFormName, setOppFormName] = useState("");
  const [oppFormPersonId, setOppFormPersonId] = useState("");
  const [oppFormStage, setOppFormStage] = useState<OpportunityStage>("lead");
  const [oppFormPriority, setOppFormPriority] = useState<PriorityLevel>("medium");
  const [oppFormSource, setOppFormSource] = useState<LeadSource>("unknown");
  const [oppFormBuyerType, setOppFormBuyerType] = useState<BuyerType>("individual");
  const [oppFormValue, setOppFormValue] = useState("");
  const [oppFormGold, setOppFormGold] = useState("");
  const [oppFormRemarks, setOppFormRemarks] = useState("");
  const [oppFormFollowUp, setOppFormFollowUp] = useState("");

  // Tasks state variables
  const [taskFormTitle, setTaskFormTitle] = useState("");
  const [taskFormType, setTaskFormType] = useState<TaskType>("task");
  const [taskFormStatus, setTaskFormStatus] = useState<TaskStatus>("pending");
  const [taskFormPriority, setTaskFormPriority] = useState<PriorityLevel>("medium");
  const [taskFormPersonId, setTaskFormPersonId] = useState("");
  const [taskFormDueDate, setTaskFormDueDate] = useState("");
  const [taskFormDesc, setTaskFormDesc] = useState("");

  // Quick message note fields
  const [quickTitle, setQuickTitle] = useState("");
  const [quickBody, setQuickBody] = useState("");
  const [quickType, setQuickType] = useState<InteractionType>("call");

  // Campaigns filters & details
  const [campaignChannel, setCampaignChannel] = useState<CommChannel>("whatsapp");
  const [campaignFilterType, setCampaignFilterType] = useState("birthday");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignText, setCampaignText] = useState("");

  // Auto Automation Rules — sourced from and persisted to settings store
  const autoBirthday = commAutomation.birthday;
  const autoAnniversary = commAutomation.anniversary;
  const autoInvoice = commAutomation.invoice;
  const autoPayment = commAutomation.payment;
  const autoOrderReady = commAutomation.orderReady;
  const autoRepairReady = commAutomation.repairReady;

  // Editable Templates States — initialized from and saved to the settings store
  const [templateEmailInvoice, setTemplateEmailInvoice] = useState(storedTemplates.emailInvoice);
  const [templateWaInvoice, setTemplateWaInvoice] = useState(storedTemplates.waInvoice);
  const [templateEmailBirthday, setTemplateEmailBirthday] = useState(storedTemplates.emailBirthday);
  const [templateWaBirthday, setTemplateWaBirthday] = useState(storedTemplates.waBirthday);

  // WA bulk queue — built at campaign time, user opens each link one by one
  const [waQueue, setWaQueue] = useState<{ name: string; url: string }[]>([]);
  const [waQueueIdx, setWaQueueIdx] = useState(0);

  useEffect(() => {
    ensureDefaults(branchId);
    void refresh();
  }, [branchId, refresh, ensureDefaults]);

  // Resync template drafts when the settings store hydrates (or changes) —
  // these fields snapshot storedTemplates via useState() below, which would
  // otherwise keep showing pre-hydration defaults and silently overwrite the
  // real saved templates on Save, same class of bug fixed for firm profile
  // fields in settings.index.tsx.
  useEffect(() => {
    setTemplateEmailInvoice(storedTemplates.emailInvoice);
    setTemplateWaInvoice(storedTemplates.waInvoice);
    setTemplateEmailBirthday(storedTemplates.emailBirthday);
    setTemplateWaBirthday(storedTemplates.waBirthday);
  }, [storedTemplates]);

  const selectedPerson = useMemo(() => {
    return people.find((p) => p.id === selectedPersonId) || null;
  }, [people, selectedPersonId]);

  const stats = useMemo(() => {
    const opps = opportunities.filter((o) => o.branchId === branchId);
    const active = opps.filter((o) => !["won", "lost"].includes(o.stage));
    const won = opps.filter((o) => o.stage === "won");
    const totalVal = won.reduce((s, o) => s + o.estimatedValuePaise, 0);

    const pendingTasks = tasks.filter((t) => t.branchId === branchId && t.status !== "completed");
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayFollows = pendingTasks.filter((t) => t.dueDate.slice(0, 10) === todayStr).length;
    const overdue = pendingTasks.filter((t) => t.dueDate.slice(0, 10) < todayStr).length;

    // Person.dateOfBirth/anniversary are real "YYYY-MM-DD" fields (people
    // .index.tsx's edit form already writes them) — .slice(5) reads the
    // "MM-DD" portion for a same-day-every-year comparison.
    const today = new Date();
    const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const birthdaysToday = people.filter((p) => p.dateOfBirth?.slice(5) === mmdd).length;
    const anniversariesTodayCount = people.filter((p) => p.anniversary?.slice(5) === mmdd).length;

    // AVS-102 — lead counts grouped by acquisition channel and buyer
    // segment, so an owner can see which channel/segment is actually
    // generating leads without exporting to a spreadsheet.
    const bySource = {} as Record<LeadSource, number>;
    const byBuyerType = {} as Record<BuyerType, number>;
    for (const o of opps) {
      bySource[o.source] = (bySource[o.source] ?? 0) + 1;
      byBuyerType[o.buyerType] = (byBuyerType[o.buyerType] ?? 0) + 1;
    }

    return {
      activeOpportunities: active.length,
      wonDealsCount: won.length,
      wonDealsValue: totalVal,
      todayFollowUps: todayFollows,
      overdueTasks: overdue,
      birthdaysToday,
      anniversariesToday: anniversariesTodayCount,
      bySource,
      byBuyerType,
    };
  }, [opportunities, tasks, people, branchId]);

  // Unified Timeline for Selected Customer
  const customerTimeline = useMemo(() => {
    if (!selectedPerson) return [];
    const events: { id: string; ts: number; type: string; title: string; body?: string }[] = [];

    interactions
      .filter((i) => i.personId === selectedPerson.id)
      .forEach((i) => {
        events.push({
          id: i.id,
          ts: new Date(i.createdAt).getTime(),
          type: i.type,
          title: i.title,
          body: i.body,
        });
      });

    orders
      .filter((o) => o.customerId === selectedPerson.id)
      .forEach((o) => {
        events.push({
          id: `ord-${o.id}`,
          ts: o.createdAt,
          type: "order",
          title: `Order Created: ${o.orderNo}`,
          body: `Items: ${o.item.itemName} (${(o.item.grossMg / 1000).toFixed(3)}g). Status: ${o.status.toUpperCase()}`,
        });
      });

    invoices
      .filter((i) => i.customerId === selectedPerson.id)
      .forEach((i) => {
        events.push({
          id: `inv-${i.id}`,
          ts: i.createdAt || Date.now(),
          type: "invoice",
          title: `Invoice Generated: ${i.invoiceNo}`,
          body: `Grand Total: ₹${paiseToRupees(i.grandTotalPaise)}. Paid: ₹${paiseToRupees(i.paidPaise)}`,
        });
      });

    repairs
      .filter((r) => r.customerId === selectedPerson.id)
      .forEach((r) => {
        events.push({
          id: `rep-${r.id}`,
          ts: r.createdAt || Date.now(),
          type: "repair",
          title: `Repair Job: ${r.repairNo}`,
          body: `Status: ${r.status.toUpperCase()}`,
        });
      });

    return events.sort((a, b) => b.ts - a.ts);
  }, [selectedPerson, interactions, orders, invoices, repairs]);

  // Campaign Target Audience Count
  const campaignTargetsCount = useMemo(() => {
    if (campaignFilterType === "all") return people.length;
    if (campaignFilterType === "birthday") return stats.birthdaysToday;
    if (campaignFilterType === "vip")
      return people.filter((p) => p.notes?.includes("VIP")).length || 2;
    if (campaignFilterType === "outstanding")
      return invoices.filter((i) => i.balancePaise > 0).length || 3;
    return 1;
  }, [campaignFilterType, people, invoices, stats]);

  const handleTriggerCampaign = async () => {
    if (!campaignTitle.trim()) {
      toast.error("Please enter a campaign title.");
      return;
    }
    if (!campaignText.trim()) {
      toast.error("Please enter message template body.");
      return;
    }

    const todayMmdd = `${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
    const audience = people.filter((p) => {
      if (campaignFilterType === "all") return true;
      if (campaignFilterType === "birthday") return p.dateOfBirth?.slice(5) === todayMmdd;
      if (campaignFilterType === "vip") return p.notes?.includes("VIP");
      if (campaignFilterType === "outstanding")
        return invoices.some((i) => i.customerId === p.id && i.balancePaise > 0);
      return true;
    });

    if (audience.length === 0) {
      toast.warning("No recipients match the selected filter.");
      return;
    }

    toast.info(`Dispatching campaign to ${audience.length} recipients via ${campaignChannel}…`);

    let sent = 0;
    let failed = 0;

    if (campaignChannel === "email") {
      for (const person of audience) {
        const email = (person as any).email as string | undefined;
        if (!email || !email.includes("@")) {
          failed++;
          continue;
        }
        const result = await sendGenericEmail({
          to: email,
          subject: campaignTitle,
          htmlBody: `<p>${campaignText.replace(/\n/g, "<br/>")}</p>`,
          textBody: campaignText,
        });
        if (result.success) sent++;
        else failed++;
      }
    } else if (campaignChannel === "whatsapp") {
      const queue: { name: string; url: string }[] = [];
      for (const person of audience) {
        const phone = (person as any).phone as string | undefined;
        if (!phone) {
          failed++;
          continue;
        }
        // Built through waMobileUrl, not by hand: a bare 10-digit number has no
        // country code, and wa.me silently opens an empty chat rather than
        // erroring — a whole broadcast would report "sent" and reach nobody.
        //
        // OPENWA MIGRATION POINT — the last deep-link-specific surface left.
        // This screen's whole UX is "here is a list of links, open them one by
        // one", which only makes sense for a deep link. Under OpenWA a broadcast
        // should actually SEND (via sendWhatsAppText per recipient, through
        // comm-queue's retry), and this queue UI should collapse into a progress
        // list. Deliberately not rewritten now: it would be a redesign of the
        // screen, not a transport swap. Every other WhatsApp action in the app
        // already goes through sendWhatsAppText and needs no change.
        if (!isValidWaPhone(phone)) {
          failed++;
          continue;
        }
        queue.push({ name: person.fullName, url: waMobileUrl(phone, campaignText) });
        sent++;
      }
      if (queue.length > 0) {
        setWaQueue(queue);
        setWaQueueIdx(0);
        toast.info(`${queue.length} WhatsApp messages queued — open each link below.`);
      }
    } else {
      toast.error(`Channel "${campaignChannel}" not yet wired for bulk dispatch.`);
      return;
    }

    if (campaignChannel !== "whatsapp") {
      toast.success(`Campaign "${campaignTitle}" sent: ${sent} delivered, ${failed} skipped.`);
      setCampaignTitle("");
      setCampaignText("");
    }
  };

  const handleAddInteraction = async () => {
    if (!quickTitle.trim()) {
      toast.error("Please enter a title.");
      return;
    }
    if (!selectedPersonId) {
      toast.error("Please select a customer first.");
      return;
    }

    await addInteraction({
      branchId,
      personId: selectedPersonId,
      type: quickType,
      title: quickTitle,
      body: quickBody || undefined,
      data: {},
    });

    setQuickTitle("");
    setQuickBody("");
    toast.success("Activity logged on timeline.");
  };

  const handleOpenNewOpp = () => {
    setSelectedOpp(null);
    setOppFormName("");
    setOppFormPersonId("");
    setOppFormStage("lead");
    setOppFormPriority("medium");
    setOppFormSource("unknown");
    setOppFormBuyerType("individual");
    setOppFormValue("");
    setOppFormGold("");
    setOppFormRemarks("");
    setOppFormFollowUp("");
    setOppModalOpen(true);
  };

  const handleSaveOpp = async () => {
    if (!oppFormName.trim()) {
      toast.error("Opportunity name is required.");
      return;
    }
    if (!oppFormSource) {
      toast.error("Lead source is required.");
      return;
    }
    if (!oppFormBuyerType) {
      toast.error("Buyer type is required.");
      return;
    }
    const payload: CRMLeadOpportunity = {
      id: selectedOpp?.id || "",
      branchId,
      leadName: oppFormName,
      stage: oppFormStage,
      priority: oppFormPriority,
      source: oppFormSource,
      buyerType: oppFormBuyerType,
      personId: oppFormPersonId || undefined,
      estimatedValuePaise: rupeesToPaise(Number(oppFormValue || 0)),
      targetGoldMg: Math.round(Number(oppFormGold || 0) * 1000),
      followUpDate: oppFormFollowUp || undefined,
      remarks: oppFormRemarks || undefined,
      data: selectedOpp?.data || {},
      createdAt: selectedOpp?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveOpportunity(payload);
    toast.success("Opportunity saved");
    setOppModalOpen(false);
  };

  const handleOpenNewTask = () => {
    setSelectedTask(null);
    setTaskFormTitle("");
    setTaskFormType("task");
    setTaskFormStatus("pending");
    setTaskFormPriority("medium");
    setTaskFormPersonId("");
    setTaskFormDueDate(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    setTaskFormDesc("");
    setTaskModalOpen(true);
  };

  const handleSaveTask = async () => {
    if (!taskFormTitle.trim() || !taskFormDueDate) {
      toast.error("Title and due date are required.");
      return;
    }
    const payload: CRMTaskMeeting = {
      id: selectedTask?.id || "",
      branchId,
      title: taskFormTitle,
      type: taskFormType,
      status: taskFormStatus,
      priority: taskFormPriority,
      personId: taskFormPersonId || undefined,
      dueDate: new Date(taskFormDueDate).toISOString(),
      description: taskFormDesc || undefined,
      data: selectedTask?.data || {},
      createdAt: selectedTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveTask(payload);
    toast.success("Task updated successfully");
    setTaskModalOpen(false);
  };

  const addProviderSetting = (channel: CommChannel, type: ProviderType) => {
    const channelConfigs = configs.filter((c) => c.branchId === branchId && c.channel === channel);
    // API-delivery providers (OpenWA, Cloud API, BSPs) are tried before the
    // free WhatsApp Deep Link fallback that's always active by default — so
    // "OpenWA unavailable → fall back to Deep Link" works via the existing
    // priority-ordered failover loop in service.ts, not a special case.
    const priority =
      type === "whatsapp_deep_link"
        ? channelConfigs.length
        : Math.min(0, ...channelConfigs.map((c) => c.priority)) - 1;
    const config: ProviderConfig = {
      id: crypto.randomUUID(),
      branchId,
      channel,
      providerType: type,
      isActive: true,
      priority,
      settings: {},
    };
    upsertConfig(config);
    toast.success("Provider added");
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-3.5 w-3.5 text-blue-400" />;
      case "meeting":
        return <Calendar className="h-3.5 w-3.5 text-purple-400" />;
      case "whatsapp":
        return <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />;
      case "email":
        return <Mail className="h-3.5 w-3.5 text-amber-400" />;
      case "order":
        return <CheckCircle className="h-3.5 w-3.5 text-pink-400" />;
      case "invoice":
        return <Plus className="h-3.5 w-3.5 text-cyan-400" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Communications & CRM"
        subtitle="Unified Customer Relationship Hub. Manage leads pipeline, campaigns, automated alerts, and communications configurations."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto bg-card border border-border p-1 w-full justify-start gap-1">
          <TabsTrigger value="dashboard" className="gap-2 text-xs">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2 text-xs">
            Customer Timeline
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-2 text-xs">
            Sales Pipeline
            <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
              Soon
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="followups" className="gap-2 text-xs">
            Follow-ups
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2 text-xs">
            Campaigns
            <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
              Soon
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2 text-xs">
            Automation
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 text-xs">
            Templates
          </TabsTrigger>
          <TabsTrigger value="providers" className="gap-2 text-xs">
            Provider Settings
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-xs">
            History Logs
          </TabsTrigger>
        </TabsList>

        {/* 1. DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-card border-border flex flex-col justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Active Pipeline
              </span>
              <span className="text-2xl font-mono font-bold text-blue-400 mt-2">
                {stats.activeOpportunities} Leads
              </span>
            </Card>
            <Card className="p-4 bg-card border-border flex flex-col justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Won Deals Value
              </span>
              <span className="text-2xl font-mono font-bold text-emerald-400 mt-2">
                ₹{paiseToRupees(stats.wonDealsValue)}
              </span>
            </Card>
            <Card className="p-4 bg-card border-border flex flex-col justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Followups Today
              </span>
              <span className="text-2xl font-mono font-bold text-amber-400 mt-2">
                {stats.todayFollowUps} Events
              </span>
            </Card>
            <Card className="p-4 bg-card border-border flex flex-col justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Today Birthdays
              </span>
              <span className="text-2xl font-mono font-bold text-pink-400 mt-2">
                {stats.birthdaysToday} Contacts
              </span>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Lead channel/segment breakdown — AVS-102 */}
            <Card className="p-5 border-border bg-card space-y-4">
              <h3 className="font-semibold text-sm">Leads by Source &amp; Buyer Type</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">
                    Source
                  </div>
                  {(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[])
                    .filter((key) => stats.bySource[key])
                    .map((key) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{LEAD_SOURCE_LABELS[key]}</span>
                        <span className="font-mono">{stats.bySource[key]}</span>
                      </div>
                    ))}
                  {Object.keys(stats.bySource).length === 0 && (
                    <div className="text-muted-foreground">No leads yet</div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">
                    Buyer Type
                  </div>
                  {(Object.keys(BUYER_TYPE_LABELS) as BuyerType[])
                    .filter((key) => stats.byBuyerType[key])
                    .map((key) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{BUYER_TYPE_LABELS[key]}</span>
                        <span className="font-mono">{stats.byBuyerType[key]}</span>
                      </div>
                    ))}
                  {Object.keys(stats.byBuyerType).length === 0 && (
                    <div className="text-muted-foreground">No leads yet</div>
                  )}
                </div>
              </div>
            </Card>
            {/* Reminders overview */}
            <Card className="p-5 border-border bg-card space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400" /> Pending Operation Reminders
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Outstanding Payment Reminders</span>
                  <Badge variant="secondary" className="bg-red-500/10 text-red-400">
                    {invoices.filter((i) => i.balancePaise > 0).length || 3} invoices
                  </Badge>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Gold Due Alerts</span>
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-400">
                    1 karigar
                  </Badge>
                </div>
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Manufacturing Jobs Followup</span>
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-400">
                    {jobs.filter((j) => j.status === "in_progress").length || 2} jobs
                  </Badge>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-muted-foreground">Delivery Reminders</span>
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-400">
                    {orders.filter((o) => o.status === "ready").length || 1} orders
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Quick Actions Panel */}
            <Card className="p-5 border-border bg-card space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" /> CRM Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="text-xs h-10 gap-1.5"
                  onClick={handleOpenNewOpp}
                >
                  <Plus className="h-4 w-4 text-gold" /> New Opportunity
                </Button>
                <Button
                  variant="outline"
                  className="text-xs h-10 gap-1.5"
                  onClick={handleOpenNewTask}
                >
                  <Plus className="h-4 w-4 text-gold" /> Assign Task
                </Button>
                <Button
                  variant="outline"
                  className="text-xs h-10 gap-1.5 col-span-2"
                  onClick={() => setActiveTab("campaigns")}
                >
                  <MessageSquare className="h-4 w-4" /> Start Marketing Campaign
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* 2. CUSTOMER TIMELINE */}
        <TabsContent value="timeline" className="space-y-6 mt-4">
          <Card className="p-5 border-border bg-card space-y-5">
            <div className="space-y-2">
              <Label>Select Customer / Contact Link</Label>
              <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Search people registry..." />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.fullName} ({p.phone} — {p.type.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPerson && (
              <div className="grid gap-6 md:grid-cols-[1fr_320px] pt-3">
                {/* Form & Timeline */}
                <div className="space-y-5">
                  {/* Quick timeline note */}
                  <Card className="p-4 border-border bg-muted/20 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Log Interaction Note
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <Select value={quickType} onValueChange={(v) => setQuickType(v as any)}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="call">Phone Call</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp Note</SelectItem>
                          <SelectItem value="note">Internal Comment</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        placeholder="Subject/Topic*"
                        className="col-span-2 h-8"
                      />
                    </div>
                    <Textarea
                      value={quickBody}
                      onChange={(e) => setQuickBody(e.target.value)}
                      placeholder="Enter details of conversation..."
                      rows={2}
                      className="text-xs"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="bg-gold text-primary-foreground font-semibold"
                        onClick={handleAddInteraction}
                      >
                        Log Activity
                      </Button>
                    </div>
                  </Card>

                  {/* Customer specific timeline list */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-gold" /> Interaction History
                    </h4>
                    <div className="relative border-l border-border/80 ml-3.5 space-y-4">
                      {customerTimeline.map((ev) => (
                        <div key={ev.id} className="relative pl-6">
                          <div className="absolute -left-3.5 top-1 h-7 w-7 rounded-full bg-accent border border-border grid place-items-center">
                            {getTimelineIcon(ev.type)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs">{ev.title}</span>
                              <Badge
                                variant="outline"
                                className="text-[8px] uppercase tracking-wider scale-90 origin-left"
                              >
                                {ev.type}
                              </Badge>
                              <span className="text-[9px] text-muted-foreground font-mono ml-auto">
                                {new Date(ev.ts).toLocaleDateString()}
                              </span>
                            </div>
                            {ev.body && (
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {ev.body}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                      {customerTimeline.length === 0 && (
                        <p className="text-xs text-muted-foreground pl-4 py-4">
                          No logged history found.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile Card Sidebar */}
                <aside className="bg-muted/10 border border-border rounded-xl p-4 space-y-4">
                  <div>
                    <h4 className="font-serif text-gold font-bold text-sm">
                      {selectedPerson.fullName}
                    </h4>
                    <p className="text-xs text-muted-foreground capitalize">
                      {selectedPerson.type}
                    </p>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span>{selectedPerson.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Address</span>
                      <span className="truncate max-w-[150px]">
                        {selectedPerson.villageCity || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aadhaar (Masked)</span>
                      <span>
                        {selectedPerson.aadhaar
                          ? `XXXX XXXX ${selectedPerson.aadhaar.slice(-4)}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* 3. PIPELINE */}
        <TabsContent value="pipeline" className="mt-4">
          {CRM_PIPELINE_ENABLED ? (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-[1200px]">
                {PIPELINE_STAGES.map((col) => {
                  const stageOpps = opportunities.filter(
                    (o) => o.branchId === branchId && o.stage === col.key,
                  );
                  const stageTotalVal = stageOpps.reduce((s, o) => s + o.estimatedValuePaise, 0);

                  return (
                    <div
                      key={col.key}
                      className="flex-1 min-w-[220px] bg-card/40 rounded-xl border border-border p-3 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                          {col.label}
                        </h3>
                        <Badge variant="outline" className="text-[10px]">
                          {stageOpps.length}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Value: ₹{paiseToRupees(stageTotalVal)}
                      </div>
                      <div className="space-y-2 flex-1 min-h-[400px] max-h-[600px] overflow-y-auto p-0.5">
                        {stageOpps.map((opp) => {
                          const cust = people.find((p) => p.id === opp.personId);
                          return (
                            <div
                              key={opp.id}
                              className="bg-card hover:bg-muted/30 border border-border p-3 rounded-lg shadow-sm space-y-2 relative group cursor-pointer"
                              onClick={() => {
                                setSelectedOpp(opp);
                                setOppFormName(opp.leadName);
                                setOppFormPersonId(opp.personId || "");
                                setOppFormStage(opp.stage);
                                setOppFormPriority(opp.priority);
                                setOppFormSource(opp.source);
                                setOppFormBuyerType(opp.buyerType);
                                setOppFormValue(String(paiseToRupees(opp.estimatedValuePaise)));
                                setOppFormGold(
                                  opp.targetGoldMg ? String(opp.targetGoldMg / 1000) : "",
                                );
                                setOppFormRemarks(opp.remarks || "");
                                setOppFormFollowUp(opp.followUpDate || "");
                                setOppModalOpen(true);
                              }}
                            >
                              <div className="font-medium text-sm leading-tight pr-5">
                                {opp.leadName}
                              </div>
                              {cust && (
                                <div className="text-xs text-gold truncate">{cust.fullName}</div>
                              )}
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>₹{paiseToRupees(opp.estimatedValuePaise)}</span>
                                {opp.priority === "high" && (
                                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] py-0">
                                    High
                                  </Badge>
                                )}
                              </div>
                              <div className="absolute top-2 right-2 flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Select
                                  value={opp.stage}
                                  onValueChange={(val) => {
                                    void moveStage(opp.id, val as OpportunityStage);
                                    toast.success(`Lead moved to ${val.toUpperCase()}`);
                                  }}
                                >
                                  <SelectTrigger className="w-6 h-6 p-0 border-0 bg-transparent text-muted-foreground hover:text-gold">
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PIPELINE_STAGES.map((s) => (
                                      <SelectItem key={s.key} value={s.key}>
                                        {s.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          );
                        })}
                        {stageOpps.length === 0 && (
                          <div className="text-center text-xs text-muted-foreground/35 py-10">
                            No items
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <ModuleComingSoon
              title={CRM_PIPELINE_COMING_SOON_MESSAGE}
              message={CRM_PIPELINE_COMING_SOON_DETAIL}
            />
          )}
        </TabsContent>

        {/* 4. FOLLOW-UPS */}
        <TabsContent value="followups" className="mt-4">
          <div className="grid gap-4">
            {tasks
              .filter((t) => t.branchId === branchId)
              .map((t) => {
                const cust = people.find((p) => p.id === t.personId);
                return (
                  <Card
                    key={t.id}
                    className="p-4 bg-card border-border flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => {
                          void toggleTaskCompleted(t.id);
                          toast.success("Task completed status toggled");
                        }}
                        className={`h-5 w-5 rounded border ${t.status === "completed" ? "bg-emerald-500 border-emerald-600 text-white" : "border-border hover:border-gold"} grid place-items-center shrink-0 transition-colors`}
                      >
                        {t.status === "completed" && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-semibold text-sm ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}
                          >
                            {t.title}
                          </span>
                          <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                            {t.status}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/20"
                          >
                            {t.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                        <div className="mt-2 text-[10px] text-muted-foreground font-mono">
                          Due: {new Date(t.dueDate).toLocaleString()}
                          {cust && (
                            <span className="ml-3 text-gold">
                              Contact: {cust.fullName} ({cust.phone})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedTask(t);
                        setTaskFormTitle(t.title);
                        setTaskFormType(t.type);
                        setTaskFormStatus(t.status);
                        setTaskFormPriority(t.priority);
                        setTaskFormPersonId(t.personId || "");
                        setTaskFormDueDate(new Date(t.dueDate).toISOString().slice(0, 16));
                        setTaskFormDesc(t.description || "");
                        setTaskModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </Card>
                );
              })}
            {tasks.filter((t) => t.branchId === branchId).length === 0 && (
              <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
                No pending follow-ups.
              </div>
            )}
          </div>
        </TabsContent>

        {/* 5. CAMPAIGNS */}
        <TabsContent value="campaigns" className="mt-4">
          {MARKETING_CAMPAIGNS_ENABLED ? (
            <Card className="p-5 border-border bg-card space-y-4 max-w-2xl mx-auto">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gold" /> Bulk Campaign Creator
              </h3>
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Channel</Label>
                    <Select
                      value={campaignChannel}
                      onValueChange={(val) => setCampaignChannel(val as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp Business API</SelectItem>
                        <SelectItem value="email">SMTP Email Campaign</SelectItem>
                        <SelectItem value="sms">SMS Gateway Gateway</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Target Customer Filter Segment</Label>
                    <Select value={campaignFilterType} onValueChange={setCampaignFilterType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="birthday">Today's Birthdays</SelectItem>
                        <SelectItem value="vip">VIP Customers</SelectItem>
                        <SelectItem value="outstanding">Outstanding Payments Due</SelectItem>
                        <SelectItem value="all">
                          Entire Database ({people.length} contacts)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Campaign Title / Internal Name</Label>
                  <Input
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    placeholder="e.g. Diwali Festival Wishes 2026"
                  />
                </div>

                <div className="space-y-1">
                  <Label>
                    Message Template Body (Supports variables like{" "}
                    {"{{customer_name}}, {{invoice_number}}"})
                  </Label>
                  <Textarea
                    value={campaignText}
                    onChange={(e) => setCampaignText(e.target.value)}
                    placeholder="Write message template here..."
                    rows={4}
                  />
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <span className="font-bold">Total Target Receivers:</span> {campaignTargetsCount}{" "}
                  people
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    className="bg-gold text-primary-foreground font-semibold"
                    onClick={handleTriggerCampaign}
                  >
                    <Play className="h-4 w-4 mr-1.5" /> Launch Campaign
                  </Button>
                </div>

                {/* WA queue: popup-blocker-safe sequential sending */}
                {waQueue.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gold">
                        WhatsApp Queue ({waQueueIdx}/{waQueue.length} sent)
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px]"
                        onClick={() => {
                          setWaQueue([]);
                          setWaQueueIdx(0);
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    {waQueueIdx < waQueue.length ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground truncate flex-1">
                          {waQueue[waQueueIdx].name}
                        </span>
                        <a href={waQueue[waQueueIdx].url} target="_blank" rel="noreferrer">
                          <Button
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => setWaQueueIdx((i) => i + 1)}
                          >
                            Open WhatsApp
                          </Button>
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-400">All messages opened.</p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <ModuleComingSoon
              title={MARKETING_CAMPAIGNS_COMING_SOON_MESSAGE}
              message={MARKETING_CAMPAIGNS_COMING_SOON_DETAIL}
            />
          )}
        </TabsContent>

        {/* 6. AUTOMATION */}
        <TabsContent value="automation" className="mt-4">
          <Card className="p-5 border-border bg-card space-y-4 max-w-2xl mx-auto">
            <h3 className="font-semibold text-sm">Event-driven Auto Notifications</h3>
            <p className="text-xs text-muted-foreground">
              Configure templates to be auto-sent instantly on trigger events.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-border/45 pb-3">
                <div>
                  <h4 className="font-medium text-xs">Automated Birthday Wishes</h4>
                  <p className="text-[10px] text-muted-foreground">
                    Sends greeting wish at 10 AM on customer's birth day.
                  </p>
                </div>
                <Switch
                  checked={autoBirthday}
                  onCheckedChange={(v) => setCommAutomation({ birthday: v })}
                />
              </div>
              <div className="flex items-center justify-between border-b border-border/45 pb-3">
                <div>
                  <h4 className="font-medium text-xs">Anniversary Greetings</h4>
                  <p className="text-[10px] text-muted-foreground">
                    Auto greeting message to wedding anniversary segments.
                  </p>
                </div>
                <Switch
                  checked={autoAnniversary}
                  onCheckedChange={(v) => setCommAutomation({ anniversary: v })}
                />
              </div>
              <div className="flex items-center justify-between border-b border-border/45 pb-3">
                <div>
                  <h4 className="font-medium text-xs">New Invoice Created</h4>
                  <p className="text-[10px] text-muted-foreground">
                    Instantly delivers PDF invoice links on finalising bill.
                  </p>
                </div>
                <Switch
                  checked={autoInvoice}
                  onCheckedChange={(v) => setCommAutomation({ invoice: v })}
                />
              </div>
              <div className="flex items-center justify-between border-b border-border/45 pb-3">
                <div>
                  <h4 className="font-medium text-xs">Payment Receipt Alerts</h4>
                  <p className="text-[10px] text-muted-foreground">
                    Auto receipt generated instantly on collecting payments.
                  </p>
                </div>
                <Switch
                  checked={autoPayment}
                  onCheckedChange={(v) => setCommAutomation({ payment: v })}
                />
              </div>
              <div className="flex items-center justify-between border-b border-border/45 pb-3">
                <div>
                  <h4 className="font-medium text-xs">Order Ready Alerts</h4>
                  <p className="text-[10px] text-muted-foreground">
                    Alerts customer to pickup gold when order finishes.
                  </p>
                </div>
                <Switch
                  checked={autoOrderReady}
                  onCheckedChange={(v) => setCommAutomation({ orderReady: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-xs">Repair Jobs Completed</h4>
                  <p className="text-[10px] text-muted-foreground">
                    Alerts user when polishing/repair scale jobs are ready.
                  </p>
                </div>
                <Switch
                  checked={autoRepairReady}
                  onCheckedChange={(v) => setCommAutomation({ repairReady: v })}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* 7. TEMPLATES */}
        <TabsContent value="templates" className="mt-4">
          <Card className="p-5 border-border bg-card space-y-4 max-w-2xl mx-auto">
            <h3 className="font-semibold text-sm">Editable Message Templates</h3>
            <p className="text-xs text-muted-foreground">
              Edit message copies. Variables like &#123;&#123;customer_name&#125;&#125;,
              &#123;&#123;due_amount&#125;&#125; are replaced at runtime.
            </p>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label>WhatsApp Invoice Notification Template</Label>
                <Textarea
                  value={templateWaInvoice}
                  onChange={(e) => setTemplateWaInvoice(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label>Email Invoice Notification HTML Body</Label>
                <Textarea
                  value={templateEmailInvoice}
                  onChange={(e) => setTemplateEmailInvoice(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label>WhatsApp Birthday Greeting Copy</Label>
                <Textarea
                  value={templateWaBirthday}
                  onChange={(e) => setTemplateWaBirthday(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <Label>Email Birthday Wishing Template</Label>
                <Textarea
                  value={templateEmailBirthday}
                  onChange={(e) => setTemplateEmailBirthday(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  className="bg-gold text-primary-foreground font-semibold"
                  onClick={() => {
                    setCampaignTemplates({
                      emailInvoice: templateEmailInvoice,
                      waInvoice: templateWaInvoice,
                      emailBirthday: templateEmailBirthday,
                      waBirthday: templateWaBirthday,
                    });
                    toast.success("Campaign templates saved");
                  }}
                >
                  Save Templates
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* 8. PROVIDER SETTINGS */}
        <TabsContent value="providers" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-sm uppercase tracking-wider">
                Configure Branch Providers
              </h3>
              <Select
                onValueChange={(val) => {
                  const parts = val.split(":");
                  addProviderSetting(parts[0] as CommChannel, parts[1] as ProviderType);
                }}
              >
                <SelectTrigger className="w-52 h-8 text-xs">
                  <SelectValue placeholder="+ Add Provider Connection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp:whatsapp_openwa">
                    OpenWA (Self-hosted WhatsApp)
                  </SelectItem>
                  <SelectItem value="whatsapp:whatsapp_cloud_api">
                    Meta Cloud API (WhatsApp)
                  </SelectItem>
                  <SelectItem value="email:email_smtp" disabled>
                    Email — Coming Soon
                  </SelectItem>
                  <SelectItem value="sms:sms_twilio">Twilio (SMS)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] px-1 py-0">
                Soon
              </Badge>
              Email Automation is Coming Soon — WhatsApp (Deep Link + OpenWA) is fully available
              below.
            </div>

            <div className="space-y-4">
              {configs
                .filter((c) => c.branchId === branchId && c.channel !== "email")
                .map((cfg, i) => {
                  const fields = getSettingFields(cfg.providerType);
                  return (
                    <Card key={cfg.id} className="p-4 border-border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gold uppercase">
                          {PROVIDER_LABELS[cfg.providerType] || cfg.providerType}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400"
                          onClick={() => removeConfig(cfg.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {fields.length > 0 && (
                        <div className="grid sm:grid-cols-2 gap-3 text-xs">
                          {fields.map((f) => (
                            <div key={f.key} className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground uppercase">
                                {f.label}
                              </Label>
                              <Input
                                type={"type" in f ? (f as any).type : "text"}
                                defaultValue={cfg.settings[f.key] ?? ""}
                                placeholder={f.placeholder}
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
            </div>
          </div>
        </TabsContent>

        {/* 9. HISTORY LOGS */}
        <TabsContent value="history" className="mt-4">
          <Card className="overflow-hidden border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted border-b border-border uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Channel</th>
                    <th className="p-3">Template</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Log Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {commEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-muted/10">
                      <td className="p-3 font-mono">{new Date(ev.ts).toLocaleString()}</td>
                      <td className="p-3 font-medium">{ev.recipientLabel}</td>
                      <td className="p-3 uppercase">{ev.target}</td>
                      <td className="p-3 font-mono text-[10px]">{ev.templateName}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        >
                          Sent
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground truncate max-w-[200px]">
                        {ev.body}
                      </td>
                    </tr>
                  ))}
                  {commEvents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-muted-foreground">
                        No communication events sent yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* dialog modals */}
      <Dialog open={oppModalOpen} onOpenChange={setOppModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>CRM Lead / Opportunity</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4 text-xs">
            <div className="space-y-1">
              <Label>Lead Topic Name *</Label>
              <Input
                value={oppFormName}
                onChange={(e) => setOppFormName(e.target.value)}
                placeholder="Topic..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Pipeline Stage</Label>
                <Select value={oppFormStage} onValueChange={(val) => setOppFormStage(val as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select
                  value={oppFormPriority}
                  onValueChange={(val) => setOppFormPriority(val as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Source *</Label>
                <Select
                  value={oppFormSource}
                  onValueChange={(val) => setOppFormSource(val as LeadSource)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {LEAD_SOURCE_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Buyer Type *</Label>
                <Select
                  value={oppFormBuyerType}
                  onValueChange={(val) => setOppFormBuyerType(val as BuyerType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(BUYER_TYPE_LABELS) as BuyerType[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {BUYER_TYPE_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Value (INR)</Label>
                <Input
                  value={oppFormValue}
                  onChange={(e) => setOppFormValue(e.target.value)}
                  placeholder="₹"
                />
              </div>
              <div className="space-y-1">
                <Label>Gold Weight (g)</Label>
                <Input
                  value={oppFormGold}
                  onChange={(e) => setOppFormGold(e.target.value)}
                  placeholder="g"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOppModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-primary-foreground font-semibold"
              onClick={handleSaveOpp}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Assign Task / Follow-up</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4 text-xs">
            <div className="space-y-1">
              <Label>Task Title *</Label>
              <Input
                value={taskFormTitle}
                onChange={(e) => setTaskFormTitle(e.target.value)}
                placeholder="e.g. Call client for approval"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={taskFormType} onValueChange={(val) => setTaskFormType(val as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="follow_up">Follow-up Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input
                  type="datetime-local"
                  value={taskFormDueDate}
                  onChange={(e) => setTaskFormDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-primary-foreground font-semibold"
              onClick={handleSaveTask}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
