import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSettings } from "@/lib/settings-store";
import {
  BookOpen,
  Key,
  Database,
  Users,
  Hammer,
  Printer,
  QrCode,
  ShieldCheck,
  AlertOctagon,
  Scale,
  GitBranch,
  Search,
  CheckCircle2,
  PlayCircle,
  HelpCircle,
  FileText,
  Sparkles,
  Coins,
  Receipt,
  BarChart3,
  Globe,
  Bot,
  Keyboard,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { ModuleSkeleton } from "@/components/module-skeleton";

const LazyHelpAgentWorkspace = lazy(async () => ({
  default: (await import("@/components/help/HelpAgentWorkspace")).HelpAgentWorkspace,
}));
import { toast } from "sonner";
import { useTrainingProgressStore } from "@/lib/training-progress-store";
import { startGuidedTour, useAvailableTours } from "@/components/training/InteractiveGuidedTour";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Training Centre & Learning Hub · Ornexa ERP" }] }),
  component: HelpPage,
});

interface CourseModule {
  id: string;
  number: number;
  title: string;
  category: string;
  icon: any;
  summary: string;
  duration: string;
  targetRole: string;
  sopSteps: string[];
  keyRules: string[];
}

const COURSES: CourseModule[] = [
  {
    id: "getting-started",
    number: 1,
    title: "First-Day Workspace Orientation & Login",
    category: "Basics",
    icon: Key,
    summary: "System navigation, branch switching, profile credentials, and top header controls.",
    duration: "10 mins",
    targetRole: "All Staff",
    sopSteps: [
      "Log in using your official email address and password.",
      "Check the active branch in the top header; switch if managing multiple branches.",
      "Review the Daily Dashboard for pending alerts, reminders, and daily bhav.",
      "Keep manual registers in parallel during your initial week of training.",
    ],
    keyRules: [
      "Never share administrative login passwords.",
      "Branch partition strictly isolates inventory, rates, and cash counters.",
    ],
  },
  {
    id: "manufacturing-hub",
    number: 2,
    title: "Manufacturing Orders, Job Cards & Karigar Flow",
    category: "Workshop",
    icon: Hammer,
    summary:
      "Job card generation, fine metal issues, stage transitions (Mina, Polish, Setting), and scrap return.",
    duration: "25 mins",
    targetRole: "Workshop Supervisor / Karigar Manager",
    sopSteps: [
      "Create a Job Card linked to a confirmed customer order or stock replenishment.",
      "Issue pure or alloyed gold to the assigned Karigar with exact gross weight and touch fineness.",
      "Record partial weight returns, filing scrap, and melting loss after each process stage.",
      "Perform QC inspection before sending the finished item for BIS Hallmarking.",
    ],
    keyRules: [
      "Every gram issued to a Karigar remains on their personal custody ledger until returned or accounted for.",
      "Losses exceeding tenant tolerance threshold (0.50%) trigger supervisor approval flags.",
    ],
  },
  {
    id: "gold-bullion-math",
    number: 3,
    title: "Daily Bhav Rate Cards & Touch Fineness Math",
    category: "Bullion",
    icon: Coins,
    summary:
      "Formula-based fine gold conversion (Fine = Gross × Purity ÷ 999), MTG default purity 995, and market rate propagation.",
    duration: "15 mins",
    targetRole: "Owners / Counter Managers",
    sopSteps: [
      "Set the Daily Desk Bhav at morning opening under Control → Daily Bhav Rate Book.",
      "Apply live bullion feeds or manually configure 24K, 22K (916), 18K (750), 14K (585), and Silver.",
      "Verify purity math on scrap receipts: Fine (mg) = Gross (mg) × selected purity ÷ 999.",
    ],
    keyRules: [
      "200.000g of 999 gold equals exactly 200.000g Fine (purity ≥ 999).",
      "10.000g of 916 gold = round(10000 × 916 / 999) mg Fine ≈ 9.169g (not ×0.916).",
      "MTG default selected purity is 995; the divisor stays 999.",
    ],
  },
  {
    id: "party-360",
    number: 4,
    title: "Party 360, Mandatory KYC & Multi-Bank Registry",
    category: "Parties",
    icon: Users,
    summary:
      "Customer, Karigar, Supplier & Jeweller master files, Aadhaar/PAN compliance, and credit limits.",
    duration: "20 mins",
    targetRole: "Accountant / Front Desk",
    sopSteps: [
      "Register new customers or vendors with Trade Name, Legal Name, and WhatsApp number.",
      "Upload mandatory KYC (Photo, Aadhaar front/back, PAN) before issuing vault metal.",
      "Configure Cash Credit Limits (₹) and Gold Credit Limits (g) with due days.",
      "Link multi-bank account details for RTGS/NEFT vendor settlements.",
    ],
    keyRules: [
      "The system blocks metal release to any Karigar lacking verified KYC documents.",
      "A single party can hold multiple business relationships (e.g. Customer + Supplier).",
    ],
  },
  {
    id: "inventory-tags",
    number: 5,
    title: "Barcode Tagging, Trays & BIS HUID Hallmarking",
    category: "Stock",
    icon: QrCode,
    summary:
      "Stock inward, unique tag printing, 6-character alphanumeric HUID tracking, and tray physical audit.",
    duration: "20 mins",
    targetRole: "Inventory Manager / Showroom Staff",
    sopSteps: [
      "Inward finished pieces into stock, recording Gross Weight, Net Weight, Stone Weight, and Purity.",
      "Generate and print high-density thermal barcode tags with QR verification code.",
      "Assign unique 6-digit BIS HUID alphanumeric code upon hallmarking return.",
      "Conduct regular tray audits using handheld barcode scanners.",
    ],
    keyRules: [
      "Untagged gold cannot be sold or billed on retail tax invoices.",
      "Physical stock discrepancies must be reconciled before performing Daily Close.",
    ],
  },
  {
    id: "dual-accounting",
    number: 6,
    title: "Dual Cash & Fine Gold Double-Entry Accounting",
    category: "Accounts",
    icon: Receipt,
    summary:
      "Synchronized monetary and fine metal ledgers, gold rate-cuts, GST returns, and Tally Prime XML export.",
    duration: "30 mins",
    targetRole: "Chief Accountant",
    sopSteps: [
      "Record sales with split tax calculation (3% IGST or 1.5% CGST + 1.5% SGST).",
      "Process customer old gold exchanges with touch-based fine gold credit.",
      "Execute Rate-Cut vouchers to convert metal credit into cash liability at locked bhav.",
      "Export period ledgers to Tally Prime using the automated XML export engine.",
    ],
    keyRules: [
      "Cash Ledger and Gold Ledger maintain independent running balances for every account.",
      "All vouchers maintain an immutable audit trail with timestamp and user ID.",
    ],
  },
  {
    id: "reports-analytics",
    number: 7,
    title: "Executive Reports & 'Where Is My Gold?' Traceability",
    category: "Reports",
    icon: BarChart3,
    summary:
      "Instant gold position summary, Karigar custody ageing, Daily Close reconciliation, and GST ITC-04.",
    duration: "15 mins",
    targetRole: "Owners / Directors",
    sopSteps: [
      "Open Reports → Gold Position to view total shop gold (Vault + Karigar WIP + Showcase).",
      "Inspect Karigar Ageing Report to identify delayed jobs exceeding promised delivery dates.",
      "Verify GST ITC-04 quarterly returns for job work metal sent outside factory premises.",
    ],
    keyRules: [
      "Every aggregate metric allows one-click drill-down to underlying source vouchers.",
      "Daily Close must be executed at the conclusion of each working day.",
    ],
  },
  {
    id: "documents-printing",
    number: 8,
    title: "Universal Document Engine & Calibrated Hardware",
    category: "Printing",
    icon: Printer,
    summary:
      "10 base document templates, 9 calibrated hardware profiles (Thermal 3-inch, Inkjet A4/A5), and QR security.",
    duration: "15 mins",
    targetRole: "Billing Staff / Counter Staff",
    sopSteps: [
      "Select desired document layout (Modern Luxury, Classical Heritage, Compact POS).",
      "Calibrate hardware profile in Settings → Printing for thermal vs laser printers.",
      "Review in-app print preview before dispatching to physical printer.",
      "Share secure document links via official WhatsApp or Email.",
    ],
    keyRules: [
      "Printed documents include tamper-evident cryptographic QR verification codes.",
      "Thermal print slips include mandatory thermal-fade legal compliance disclaimer.",
    ],
  },
  {
    id: "external-portals",
    number: 9,
    title: "Customer, Karigar & Supplier External Portals",
    category: "Portals",
    icon: Globe,
    summary:
      "Self-service mobile-optimized portals for live CAD approvals, worker bench logs, and vendor PO memos.",
    duration: "15 mins",
    targetRole: "Admin / Relationship Managers",
    sopSteps: [
      "Generate secure portal invite links from Party 360 workspace.",
      "Customers log in to view real-time order progress, 3D CAD models, and dual running statements.",
      "Karigars log in to view bench gold custody, job card instructions, and receive acknowledgments.",
      "Suppliers log in to review Purchase Orders and metal settlement statements.",
    ],
    keyRules: [
      "Portal configurations and portal launches are strictly separated for security.",
      "External parties only have read-access to their own ledger and allocated transactions.",
    ],
  },
  {
    id: "ai-assistant",
    number: 10,
    title: "AI Assistant & Conversational ERP Tool Execution",
    category: "AI",
    icon: Bot,
    summary:
      "Natural language business queries, voice commands, document analysis, and controlled record generation.",
    duration: "10 mins",
    targetRole: "All Staff",
    sopSteps: [
      "Click the Assistant icon or press the assistant shortcut to open the drawer.",
      "Ask natural questions: 'What is our fine gold balance?', 'Show pending orders for MTJ Jewellers'.",
      "Use voice speech-to-text for hands-free counter inquiries.",
      "Review tool action confirmation cards before executing state changes.",
    ],
    keyRules: [
      "Financial and gold mutations require explicit human review and confirmation.",
      "Cloud AI includes intelligent fallback to local ERP rules when offline or credits expire.",
    ],
  },
  {
    id: "security-backup",
    number: 11,
    title: "Security, Role Permissions & Encrypted Backups",
    category: "Security",
    icon: ShieldCheck,
    summary:
      "Role-based access control (RBAC), inactivity lockouts, self-service encrypted .ornexa.enc export, and restore validation.",
    duration: "20 mins",
    targetRole: "Super Owners / System Admins",
    sopSteps: [
      "Assign precise roles (Owner, Manager, Billing Staff, Workshop Supervisor, Accountant).",
      "Set auto-lock inactivity timeouts in Settings → Security.",
      "Generate and download periodic encrypted backup files (.ornexa.enc).",
      "Perform disaster recovery drills using the Restore Preview and Checksum verification engine.",
    ],
    keyRules: [
      "Encrypted backups use SHA-256 integrity checksums and tenant-match verification.",
      "Restores require explicit high-security confirmation phrases to prevent accidental overwrites.",
    ],
  },
  {
    id: "keyboard-mastery",
    number: 12,
    title: "Desktop Keyboard Hotkeys & Rapid Navigation",
    category: "Productivity",
    icon: Keyboard,
    summary:
      "Keyboard-first counter workflow: instant search (Ctrl+K), quick invoice (Alt+N), and tab switching.",
    duration: "10 mins",
    targetRole: "Power Users / Billing Staff",
    sopSteps: [
      "Press Ctrl+K (Cmd+K on Mac) anywhere to open Global Instant Search.",
      "Press Alt+N to quickly create a new invoice or job card.",
      "Use Tab and Enter keys for rapid form navigation without touching the mouse.",
      "Press Esc to dismiss modals, drawers, and print previews cleanly.",
    ],
    keyRules: [
      "Mastering keyboard shortcuts cuts customer counter turnaround time by 60%.",
      "Form auto-saves drafts locally to prevent data loss on accidental browser refreshes.",
    ],
  },
  {
    id: "whatsapp-crm",
    number: 13,
    title: "WhatsApp Inbox, Campaigns & CRM Integration",
    category: "Communications",
    icon: Globe,
    summary: "AVS Communication Platform — inbox, templates, campaigns, opt-in, Party 360 context.",
    duration: "20 mins",
    targetRole: "Owner / Manager",
    sopSteps: [
      "Open WhatsApp from the sidebar for inbox, campaigns, and templates.",
      "Link conversations to Party 360 for orders, gold balance, and invoices.",
      "Record WhatsApp opt-in before marketing campaigns.",
      "Use approved templates only for mass campaigns outside the 24-hour service window.",
    ],
    keyRules: [
      "External BSP mode: outbound and templates only — full inbox requires AVS Managed Meta.",
      "Internal notes in inbox are never sent to customers.",
    ],
  },
  {
    id: "gold-settlement",
    number: 14,
    title: "Gold Settlement, Purchases & Supplier Flows",
    category: "Gold",
    icon: Scale,
    summary: "Customer gold settlement, supplier purchases, and liability reconciliation.",
    duration: "25 mins",
    targetRole: "Accountant / Owner",
    sopSteps: [
      "Create gold settlement from Billing when customer brings metal or cash.",
      "Record supplier purchases with proper fine gold and rupee components.",
      "Reconcile worker and outside-work books before month-end close.",
    ],
    keyRules: [
      "Gold Vault remains the accounting source of truth — no independent balance fields.",
    ],
  },
  {
    id: "customization",
    number: 15,
    title: "Customization Hub — Terminology, Rules, Print, Transactions",
    category: "Customization",
    icon: Sparkles,
    summary: "Business language, formulas, document templates, and universal transaction types.",
    duration: "30 mins",
    targetRole: "Owner / Admin",
    sopSteps: [
      "Use Control → Customization for terminology, dropdowns, and print templates.",
      "Configure making formulas and wastage rules in the Formula Engine.",
      "Set up custom transaction types without duplicating core modules.",
    ],
    keyRules: ["Settings hold account/security; Customization holds business structures."],
  },
];

const FAQS = [
  {
    q: "How does Ornexa calculate Fine Gold from alloyed metal?",
    a: "Ornexa uses fineGoldMg: Fine Weight (mg) = round(Gross Weight (mg) × Purity ÷ 999). Purity is per-mille (e.g. 916, 995). The MTG default purity is 995, but whatever purity you select drives the calculation. Both physical gross and pure fine balances are kept in milligrams.",
  },
  {
    q: "Can a customer also be a supplier or karigar in the system?",
    a: "Yes! Ornexa's Party 360 engine allows a single entity to hold multiple business roles. A jeweller can be a customer for custom job orders while simultaneously supplying bullion or ready jewellery items, all tracked within a unified ledger.",
  },
  {
    q: "What happens if our shop internet goes down temporarily?",
    a: "Ornexa is built on high-availability Supabase Cloud infrastructure with client-side caching. When connection drops, active forms preserve your draft state. Reconnection syncs immediately once internet resumes.",
  },
  {
    q: "How do we send invoices and receipts to customers on WhatsApp?",
    a: "Under Settings → WhatsApp, enable WhatsApp automation. You can choose Mode B (Managed Zero-Setup Ornexa Partner) or Mode C (Client-Owned Meta Business Account). Tax invoices, payment receipts, and order ready updates dispatch automatically.",
  },
  {
    q: "How do we export data to Tally Prime?",
    a: "Go to Control → Tally Prime Export or Reports → Tally Export. Select the financial period and branch, then download the compliant Tally XML package for direct import into Tally Prime.",
  },
];

function HelpPage() {
  const firm = useSettings((state) => state.firm);
  const { t } = useLanguage();
  const availableTours = useAvailableTours();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All Staff");
  const [selectedCourse, setSelectedCourse] = useState<CourseModule>(COURSES[0]);
  const [completedModules, setCompletedModules] = useState<Record<string, boolean>>({});
  const { hydrate, markComplete, modules } = useTrainingProgressStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const map: Record<string, boolean> = {};
    for (const m of modules) {
      if (m.isCompleted) map[m.moduleCode.toLowerCase().replace(/_/g, "-")] = true;
      map[m.moduleCode] = m.isCompleted;
    }
    setCompletedModules((prev) => ({ ...prev, ...map }));
  }, [modules]);

  const filteredCourses = useMemo(() => {
    let list = COURSES;
    if (roleFilter !== "All Staff") {
      list = list.filter(
        (c) =>
          c.targetRole === roleFilter ||
          c.targetRole.includes(roleFilter) ||
          c.targetRole === "All Staff",
      );
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.targetRole.toLowerCase().includes(q) ||
        c.sopSteps.some((s) => s.toLowerCase().includes(q)),
    );
  }, [searchQuery, roleFilter]);

  const toggleComplete = (id: string) => {
    const next = !completedModules[id];
    setCompletedModules((prev) => ({ ...prev, [id]: next }));
    if (next) void markComplete(id);
    toast.success(next ? "Module marked as completed!" : "Module marked as in-progress.");
  };

  const completionCount = Object.values(completedModules).filter(Boolean).length;
  const progressPercent = Math.round((completionCount / COURSES.length) * 100);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <PageHeader
          title="Ornexa Training Centre & Learning Hub"
          subtitle="Interactive curriculum, standard operating procedures (SOPs), and jewellery manufacturing knowledge base."
        />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-muted-foreground block">Curriculum Progress</span>
            <span className="text-xs font-bold text-gold">
              {completionCount} / {COURSES.length} Modules ({progressPercent}%)
            </span>
          </div>
          <Badge variant="outline" className="bg-gold/10 text-gold border-gold/40 py-1.5 px-3">
            ● ONLINE LEARNING ACTIVE
          </Badge>
        </div>
      </div>

      {/* Hero Search Box */}
      <Card className="p-6 border-gold/40 bg-gradient-to-r from-gold/5 via-gold/10 to-transparent space-y-4">
        <div className="flex items-start gap-3">
          <BookOpen className="h-6 w-6 text-gold mt-1 shrink-0" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground">
              Welcome to the Ornexa Learning Hub
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Designed for jewellery showroom owners, workshop supervisors, accountants, and bench
              karigars. Search for any workflow, accounting formula, or standard operating procedure
              below.
            </p>
            <div className="relative mt-4 max-w-xl">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder='Search: "issue gold", "create customer", "print invoice", "WhatsApp"...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9 bg-background/80"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                "All Staff",
                "Owner",
                "Manager",
                "Accountant",
                "Workshop Supervisor / Karigar Manager",
              ].map((role) => (
                <Button
                  key={role}
                  size="sm"
                  variant={roleFilter === role ? "default" : "outline"}
                  className="text-[10px] h-7"
                  onClick={() => setRoleFilter(role)}
                >
                  {role}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 border-border space-y-3">
        <div className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-gold" />
          <h2 className="text-sm font-semibold">{t("tour.guidedTours")}</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Interactive walkthroughs spotlight real screens in the ERP. Progress is saved per user.
        </p>
        <div className="flex flex-wrap gap-2">
          {availableTours.map((tour) => (
            <Button
              key={tour.id}
              size="sm"
              variant="outline"
              className="text-xs gap-1"
              onClick={() => startGuidedTour(tour.id, 0)}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              {t(tour.titleKey)}
            </Button>
          ))}
        </div>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="curriculum" className="space-y-6">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="curriculum" className="text-xs">
            Interactive Tracks
          </TabsTrigger>
          <TabsTrigger value="sop" className="text-xs">
            Operational SOPs
          </TabsTrigger>
          <TabsTrigger value="faq" className="text-xs">
            Jewellery FAQ
          </TabsTrigger>
          <TabsTrigger value="agent" className="text-xs">
            Help Agent
          </TabsTrigger>
        </TabsList>

        {/* ── Curriculum Tab ──────────────────────────────────────────────── */}
        <TabsContent value="curriculum" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left Sidebar: Course List */}
            <div className="md:col-span-5 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Curriculum Modules ({filteredCourses.length})
              </h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredCourses.map((c) => {
                  const Icon = c.icon;
                  const isSelected = selectedCourse.id === c.id;
                  const isDone = !!completedModules[c.id];

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCourse(c)}
                      className={`p-3 rounded-md border cursor-pointer transition-all flex items-start gap-3 ${
                        isSelected
                          ? "border-gold bg-gold/10 shadow-sm"
                          : "border-border hover:border-border/80 bg-card"
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg ${isSelected ? "bg-gold text-slate-950" : "bg-muted text-muted-foreground"} shrink-0`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-muted-foreground uppercase">
                            Module {c.number}
                          </span>
                          {isDone && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            >
                              Completed
                            </Badge>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-foreground truncate mt-0.5">
                          {c.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{c.duration}</span>
                          <span>•</span>
                          <span>{c.targetRole}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Pane: Selected Course Workspace */}
            <div className="md:col-span-7">
              <Card className="p-6 border-border space-y-6">
                <div className="flex items-start justify-between gap-4 border-b pb-4">
                  <div>
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-bold text-gold border-gold/30"
                    >
                      Module {selectedCourse.number} • {selectedCourse.category}
                    </Badge>
                    <h3 className="text-base font-bold text-foreground mt-1.5">
                      {selectedCourse.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{selectedCourse.summary}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={completedModules[selectedCourse.id] ? "outline" : "default"}
                    onClick={() => toggleComplete(selectedCourse.id)}
                    className="text-xs gap-1.5 shrink-0"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {completedModules[selectedCourse.id] ? "Mark Incomplete" : "Mark as Done"}
                  </Button>
                </div>

                {/* SOP Steps */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <PlayCircle className="h-4 w-4 text-gold" /> Step-by-Step Procedure
                  </h4>
                  <div className="space-y-2 text-xs">
                    {selectedCourse.sopSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-muted/20"
                      >
                        <span className="h-5 w-5 rounded-full bg-gold/20 text-gold font-bold grid place-items-center shrink-0 text-[10px]">
                          {idx + 1}
                        </span>
                        <p className="text-muted-foreground leading-relaxed pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mandatory Rules */}
                <div className="space-y-2 bg-amber-500/5 border border-amber-500/20 rounded-md p-4 text-xs">
                  <h4 className="font-bold text-amber-500 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" /> Mandatory Business Invariants
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    {selectedCourse.keyRules.map((rule, idx) => (
                      <li key={idx}>{rule}</li>
                    ))}
                  </ul>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Operational SOPs Tab ────────────────────────────────────────── */}
        <TabsContent value="sop" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 border-border space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Scale className="h-4 w-4 text-gold" /> Daily Vault & Counter Balancing SOP
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                At the beginning of each day, verify vault fine gold opening balance. At the close
                of each day, execute the Daily Close report under <code>/reports/daily-close</code>{" "}
                to freeze daily transactions and verify zero unaccounted metal differences.
              </p>
            </Card>

            <Card className="p-5 border-border space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <QrCode className="h-4 w-4 text-gold" /> Tagging & BIS HUID Intake SOP
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every manufactured piece returned from hallmarking centers must have its 6-character
                BIS HUID entered before attaching the thermal barcode tag. Scan tags during tray
                transfers to maintain physical custody records.
              </p>
            </Card>
          </div>
        </TabsContent>

        {/* ── Jewellery FAQ Tab ───────────────────────────────────────────── */}
        <TabsContent value="faq" className="space-y-4">
          <div className="space-y-3">
            {FAQS.map((faq, idx) => (
              <Card key={idx} className="p-5 border-border space-y-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-gold shrink-0" /> {faq.q}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">{faq.a}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="agent" className="space-y-4">
          <Suspense fallback={<ModuleSkeleton />}>
            <LazyHelpAgentWorkspace />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
