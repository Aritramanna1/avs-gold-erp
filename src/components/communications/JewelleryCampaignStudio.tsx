import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Send,
  Sparkles,
  Users,
  MessageSquare,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Copy,
  Search,
  Filter,
  Layers,
  Flame,
  Gift,
  Crown,
  TrendingUp,
  Receipt,
  Calendar,
  ExternalLink,
  RefreshCw,
  Eye,
  Check,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings-store";
import { useBilling, paiseToRupees } from "@/lib/billing-store";
import { usePeople, type Person } from "@/lib/people-store";
import { sendGenericEmail } from "@/lib/email-service";
import { waMobileUrl, isValidWaPhone } from "@/lib/wa-link";

export interface CampaignRecord {
  id: string;
  name: string;
  channel: "whatsapp" | "email" | "sms";
  category: string;
  targetFilter: string;
  targetCount: number;
  sentCount: number;
  skippedCount: number;
  status: "completed" | "scheduled" | "in_progress" | "draft";
  contentPreview: string;
  createdAt: string;
}

interface JewelleryTemplate {
  id: string;
  name: string;
  category: "festive" | "bridal" | "birthday" | "rate" | "scheme" | "payment";
  channel: "whatsapp" | "email" | "sms" | "all";
  subject: string;
  body: string;
  badge: string;
  icon: any;
}

const JEWELLERY_TEMPLATES: JewelleryTemplate[] = [
  {
    id: "festive-dhanteras",
    name: "🪔 Dhanteras & Diwali Gold Fest",
    category: "festive",
    channel: "all",
    badge: "Festive Season",
    icon: Flame,
    subject: "✨ Exclusive Dhanteras & Diwali Shubh Mahurat Gold Offers at {{firm_name}}!",
    body: `Namaste {{customer_name}},\n\nCelebrate this auspicious Festive Season with {{firm_name}}! 🪔✨\n\n🌟 Special Dhanteras & Diwali Privileges:\n• Up to 25% OFF on Making Charges for 22K/18K Gold Jewellery\n• Flat 50% OFF on Making Charges on Diamond & Polki Collection\n• Complimentary Free Silver Coin with every Gold purchase above ₹50,000\n\n📍 Visit our showroom: {{shop_address}}\n📞 Helpline: {{phone}}\n\nBook your bridal & festive designs in advance to lock today's gold rate: {{action_url}}`,
  },
  {
    id: "bridal-showcase",
    name: "💍 Royal Bridal & Wedding Showcase",
    category: "bridal",
    channel: "all",
    badge: "Wedding Collection",
    icon: Crown,
    subject: "👰 Exclusive Invitation: Royal Bridal Jewellery Showcase at {{firm_name}}",
    body: `Dear {{customer_name}},\n\nPlanning your dream wedding or family occasion? ✨\n\n{{firm_name}} cordially invites you to our Exclusive Royal Bridal & Heritage Polki Showcase.\n\n✨ Highlights of the Collection:\n• Handcrafted Antique Kundan & Temple Gold Sets\n• Certified Natural Diamond Chokers & Layered Necklaces\n• Lightweight Modern Reception Wear\n• 100% BIS Hallmark & HUID certified purity\n\n✨ Book a VIP Private Viewing with our master stylists: {{action_url}}\n\nWarm regards,\n{{firm_name}} Bridal Studio`,
  },
  {
    id: "birthday-gift",
    name: "🎂 Birthday Special Greetings & Gift Voucher",
    category: "birthday",
    channel: "all",
    badge: "Personal Touch",
    icon: Gift,
    subject: "🎉 Happy Birthday {{customer_name}}! A Special Gift from {{firm_name}} 🎁",
    body: `Wishing you a very Happy Birthday, {{customer_name}}! 🎂✨\n\nMay this year bring immense prosperity, health, and happiness to you and your family.\n\n🎁 As a token of our appreciation, we are delighted to gift you an exclusive Birthday Privilege Voucher worth ₹1,500 on your next jewellery purchase with us this month.\n\nUse Code: BDAY{{date}}\n📍 Redeem at: {{firm_name}}, {{shop_address}}\n\nWe look forward to celebrating your special day with you!`,
  },
  {
    id: "gold-rate-alert",
    name: "📈 Gold Rate Advisory & Price Lock",
    category: "rate",
    channel: "all",
    badge: "Market Advisory",
    icon: TrendingUp,
    subject: "📊 Today's Gold Rate Update & Advance Booking Advisory — {{firm_name}}",
    body: `Daily Bullion Update from {{firm_name}} 📈\n\n• 22K Hallmark Gold: {{gold_rate}}/g\n• 24K Pure Gold: {{gold_rate_24k}}/g\n• Silver 999: {{silver_rate}}/g\n\n💡 Protect against future price surges by booking your gold weight in advance at today's benchmark rate.\n\nLock today's rate online: {{action_url}}\nHelpline: {{phone}}`,
  },
  {
    id: "scheme-reminder",
    name: "🔔 Monthly Gold Scheme Installment",
    category: "scheme",
    channel: "all",
    badge: "Saving Scheme",
    icon: Calendar,
    subject: "Reminder: Your Monthly Gold Saving Scheme Installment is Due — {{firm_name}}",
    body: `Dear {{customer_name}},\n\nThis is a friendly reminder that your monthly installment for the {{firm_name}} Gold Saving Scheme is due for this cycle.\n\nKeep your savings on track to earn the 1-month bonus making benefit at maturity! ✨\n\n💳 Pay securely online via UPI / Card: {{action_url}}\n\nThank you for choosing {{firm_name}}.`,
  },
  {
    id: "payment-due",
    name: "🧾 Polite Ledger & Balance Reminder",
    category: "payment",
    channel: "all",
    badge: "Accounts",
    icon: Receipt,
    subject: "Statement & Payment Reminder for Account — {{firm_name}}",
    body: `Dear {{customer_name}},\n\nGreetings from {{firm_name}}.\n\nThis is a gentle update regarding your outstanding account balance of ₹{{balance_due}}.\n\nKindly arrange for the balance settlement at your earliest convenience. You can view your detailed bill statement and pay directly here: {{action_url}}\n\nFor any billing clarification, please contact our accounts desk at {{phone}}.\n\nThank you!`,
  },
];

export function JewelleryCampaignStudio({ branchId }: { branchId: string }) {
  const { firm } = useSettings();
  const people = usePeople((s) => s.people);
  const invoices = useBilling((s) => s.invoices);

  // Campaign State
  const [campaignTitle, setCampaignTitle] = useState("Festive Gold & Diamond Special 2026");
  const [selectedCategory, setSelectedCategory] = useState<string>("festive");
  const [selectedChannel, setSelectedChannel] = useState<"whatsapp" | "email" | "sms">("whatsapp");
  const [targetSegment, setTargetSegment] = useState<string>("all");
  const [messageSubject, setMessageSubject] = useState("Special Gold & Diamond Festive Offer");
  const [messageBody, setMessageBody] = useState(JEWELLERY_TEMPLATES[0].body);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");

  // Execution & Progress State
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState<{ total: number; sent: number; skipped: number } | null>(null);
  const [waQueue, setWaQueue] = useState<{ name: string; phone: string; url: string }[]>([]);
  const [waQueueIdx, setWaQueueIdx] = useState(0);

  // Campaign History
  const [campaignHistory, setCampaignHistory] = useState<CampaignRecord[]>(() => {
    try {
      const saved = localStorage.getItem("onyxa_crm_campaign_history");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "cmp_demo_1",
        name: "Akshaya Tritiya Gold Booking Preview",
        channel: "whatsapp",
        category: "festive",
        targetFilter: "VIP Customers",
        targetCount: 42,
        sentCount: 42,
        skippedCount: 0,
        status: "completed",
        contentPreview: "Namaste! Special Dhanteras & Diwali Shubh Mahurat Gold Offers...",
        createdAt: new Date(Date.now() - 3600 * 24 * 3 * 1000).toISOString(),
      },
      {
        id: "cmp_demo_2",
        name: "Monthly Gold Scheme Due Alert",
        channel: "email",
        category: "scheme",
        targetFilter: "Scheme Subscribers",
        targetCount: 28,
        sentCount: 28,
        skippedCount: 0,
        status: "completed",
        contentPreview: "Reminder: Your Monthly Gold Saving Scheme Installment is Due...",
        createdAt: new Date(Date.now() - 3600 * 24 * 7 * 1000).toISOString(),
      },
    ];
  });

  const saveHistory = (record: CampaignRecord) => {
    setCampaignHistory((prev) => {
      const next = [record, ...prev];
      try {
        localStorage.setItem("onyxa_crm_campaign_history", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Filtered target recipients
  const todayMMDD = useMemo(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const eligibleRecipients = useMemo(() => {
    return people.filter((p: Person) => {
      if (targetSegment === "birthday") {
        return p.dateOfBirth?.slice(5) === todayMMDD || p.anniversary?.slice(5) === todayMMDD;
      }
      if (targetSegment === "vip") {
        return p.notes?.toLowerCase().includes("vip") || p.type === "customer";
      }
      if (targetSegment === "outstanding") {
        return invoices.some((inv) => inv.customerId === p.id && inv.balancePaise > 0);
      }
      if (targetSegment === "customers") {
        return p.type === "customer";
      }
      if (targetSegment === "karigars") {
        return p.type === "worker";
      }
      return true;
    });
  }, [people, targetSegment, todayMMDD, invoices]);

  // Initial selection of all eligible recipients on segment change
  useEffect(() => {
    setSelectedCustomerIds(new Set(eligibleRecipients.map((p: Person) => p.id)));
  }, [eligibleRecipients]);

  const displayedRecipients = useMemo(() => {
    if (!searchTerm.trim()) return eligibleRecipients;
    const term = searchTerm.toLowerCase();
    return eligibleRecipients.filter(
      (p: Person) =>
        p.fullName.toLowerCase().includes(term) ||
        p.phone?.includes(term) ||
        p.email?.toLowerCase().includes(term),
    );
  }, [eligibleRecipients, searchTerm]);

  const activeRecipientsCount = selectedCustomerIds.size;

  // Variable replacement helper
  const replaceVariables = (template: string, person?: Person) => {
    const samplePerson = person || eligibleRecipients[0] || {
      id: "sample-1",
      fullName: "Ananya Sharma",
      phone: "+91 98765 43210",
      email: "ananya.sharma@example.com",
    };

    const currentGoldRate = "₹ 13,740";
    const balance = invoices.find((inv) => inv.customerId === samplePerson.id)?.balancePaise || 2500000;

    return template
      .replace(/{{customer_name}}/g, samplePerson.fullName || "Valued Customer")
      .replace(/{{phone}}/g, firm.phone || "+91 98300 12345")
      .replace(/{{firm_name}}/g, firm.shopName || "AVS Gold & Diamond Jewellers")
      .replace(/{{shop_address}}/g, firm.address || "Main Market, Jewellery Hub")
      .replace(/{{gold_rate}}/g, currentGoldRate)
      .replace(/{{gold_rate_24k}}/g, "₹ 14,980")
      .replace(/{{silver_rate}}/g, "₹ 98")
      .replace(/{{balance_due}}/g, paiseToRupees(balance))
      .replace(/{{date}}/g, new Date().getFullYear().toString())
      .replace(/{{action_url}}/g, "https://erp.arivahly.in/app");
  };

  const samplePreviewText = useMemo(() => {
    return replaceVariables(messageBody);
  }, [messageBody, firm, eligibleRecipients]);

  const samplePreviewSubject = useMemo(() => {
    return replaceVariables(messageSubject);
  }, [messageSubject, firm, eligibleRecipients]);

  // Apply template
  const handleApplyTemplate = (tmpl: JewelleryTemplate) => {
    setMessageSubject(tmpl.subject);
    setMessageBody(tmpl.body);
    setCampaignTitle(tmpl.name.replace(/[^a-zA-Z0-9 ]/g, "").trim());
    setSelectedCategory(tmpl.category);
    toast.success(`Applied template: ${tmpl.name}`);
  };

  // Insert dynamic variable pill at cursor
  const handleInsertVariable = (varName: string) => {
    setMessageBody((prev) => `${prev} {{${varName}}}`);
  };

  // Trigger campaign execution
  const handleExecuteCampaign = async () => {
    const targets = eligibleRecipients.filter((p) => selectedCustomerIds.has(p.id));

    if (targets.length === 0) {
      toast.error("Please select at least one recipient.");
      return;
    }

    if (!campaignTitle.trim() || !messageBody.trim()) {
      toast.error("Campaign title and message content are required.");
      return;
    }

    setIsDispatching(true);
    setDispatchProgress({ total: targets.length, sent: 0, skipped: 0 });

    let sent = 0;
    let skipped = 0;

    if (selectedChannel === "email") {
      toast.info(`Dispatching email campaign to ${targets.length} recipients...`);
      for (const recipient of targets) {
        const email = recipient.email?.trim();
        if (!email || !email.includes("@")) {
          skipped++;
          setDispatchProgress((p) => (p ? { ...p, skipped: p.skipped + 1 } : null));
          continue;
        }

        const personalizedSubject = replaceVariables(messageSubject, recipient);
        const personalizedHtml = `<div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; line-height: 1.6;">
          <div style="background-color: #1a1613; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="color: #b89454; margin: 0; font-size: 20px; font-weight: bold;">${firm.shopName || "AVS Jewellery"}</h2>
          </div>
          <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="white-space: pre-line; font-size: 14px; margin-bottom: 20px;">${replaceVariables(messageBody, recipient)}</p>
            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center;">
              ${firm.shopName || "AVS ERP"} · ${firm.address || ""} · Ph: ${firm.phone || ""}
            </div>
          </div>
        </div>`;

        try {
          const res = await sendGenericEmail({
            to: email,
            subject: personalizedSubject,
            htmlBody: personalizedHtml,
            textBody: replaceVariables(messageBody, recipient),
          });
          if (res.success) {
            sent++;
          } else {
            skipped++;
          }
        } catch {
          skipped++;
        }
        setDispatchProgress((p) => (p ? { ...p, sent, skipped } : null));
      }

      toast.success(`Email Campaign dispatched: ${sent} delivered, ${skipped} skipped.`);
    } else if (selectedChannel === "whatsapp") {
      const queue: { name: string; phone: string; url: string }[] = [];
      for (const recipient of targets) {
        const phone = recipient.phone?.trim();
        if (!phone || !isValidWaPhone(phone)) {
          skipped++;
          continue;
        }
        const text = replaceVariables(messageBody, recipient);
        queue.push({
          name: recipient.fullName,
          phone,
          url: waMobileUrl(phone, text),
        });
        sent++;
      }

      if (queue.length > 0) {
        setWaQueue(queue);
        setWaQueueIdx(0);
        toast.info(`${queue.length} WhatsApp messages ready in sequential queue!`);
      } else {
        toast.warning("No valid WhatsApp phone numbers found in selection.");
      }
    } else {
      // SMS Broadcast mock/bridge
      toast.success(`SMS Broadcast queued for ${targets.length} recipients.`);
      sent = targets.length;
    }

    saveHistory({
      id: `cmp_${Date.now()}`,
      name: campaignTitle,
      channel: selectedChannel,
      category: selectedCategory,
      targetFilter: targetSegment,
      targetCount: targets.length,
      sentCount: sent,
      skippedCount: skipped,
      status: "completed",
      contentPreview: messageBody.slice(0, 80) + "...",
      createdAt: new Date().toISOString(),
    });

    setIsDispatching(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP METRICS BANNER */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Total Campaigns
            </span>
            <Flame className="h-4 w-4 text-gold" />
          </div>
          <span className="text-2xl font-mono font-bold text-gold mt-2">
            {campaignHistory.length}
          </span>
          <span className="text-[11px] text-muted-foreground">Automated & Broadcast</span>
        </Card>

        <Card className="p-4 bg-card border-border flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Audience Reach
            </span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <span className="text-2xl font-mono font-bold text-blue-400 mt-2">
            {people.length} Contacts
          </span>
          <span className="text-[11px] text-muted-foreground">Verified in CRM directory</span>
        </Card>

        <Card className="p-4 bg-card border-border flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Today's Celebrations
            </span>
            <Gift className="h-4 w-4 text-pink-400" />
          </div>
          <span className="text-2xl font-mono font-bold text-pink-400 mt-2">
            {people.filter((p) => p.dateOfBirth?.slice(5) === todayMMDD).length} Birthdays
          </span>
          <span className="text-[11px] text-muted-foreground">Auto-greeting ready</span>
        </Card>

        <Card className="p-4 bg-card border-border flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Primary Channel
            </span>
            <Smartphone className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-emerald-400 mt-2">WhatsApp & Email</span>
          <span className="text-[11px] text-muted-foreground">Zero per-message surcharge</span>
        </Card>
      </div>

      {/* 2. MAIN CAMPAIGN STUDIO WORKBENCH */}
      <div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
        {/* Left Column: Creator Studio */}
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold" /> Jewellery Campaign Studio
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Create, personalize, and broadcast high-conversion jewellery marketing campaigns.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-gold/40 text-gold text-xs font-mono">
                  {activeRecipientsCount} Target Recipients
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              {/* Step 1: Channel & Segment Selection */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Dispatch Channel</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedChannel("whatsapp")}
                      className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                        selectedChannel === "whatsapp"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-xs"
                          : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <Smartphone className="h-4 w-4" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChannel("email")}
                      className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                        selectedChannel === "email"
                          ? "border-blue-500 bg-blue-500/10 text-blue-400 shadow-xs"
                          : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                      <span>Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChannel("sms")}
                      className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                        selectedChannel === "sms"
                          ? "border-amber-500 bg-amber-500/10 text-amber-400 shadow-xs"
                          : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>SMS</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Audience Segment</Label>
                  <Select value={targetSegment} onValueChange={setTargetSegment}>
                    <SelectTrigger className="h-12 text-xs">
                      <SelectValue placeholder="Select segment..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">🌟 All Registered Contacts ({people.length})</SelectItem>
                      <SelectItem value="birthday">🎂 Today's Birthdays & Anniversaries</SelectItem>
                      <SelectItem value="vip">💎 VIP Jewellery Buyers</SelectItem>
                      <SelectItem value="customers">🛍️ All Retail Customers</SelectItem>
                      <SelectItem value="outstanding">⏳ Customers with Outstanding Balance</SelectItem>
                      <SelectItem value="karigars">🔨 Karigars & Artisans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Step 2: 1-Click Prebuilt Jewellery Templates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-gold" /> Jewellery Campaign Presets (1-Click Apply)
                  </Label>
                  <span className="text-[10px] text-muted-foreground">Select to auto-populate</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {JEWELLERY_TEMPLATES.map((tmpl) => {
                    const IconComp = tmpl.icon;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => handleApplyTemplate(tmpl)}
                        className="p-2.5 rounded-lg border border-border/70 hover:border-gold bg-muted/10 hover:bg-gold/5 text-left transition-all space-y-1 group"
                      >
                        <div className="flex items-center justify-between">
                          <IconComp className="h-3.5 w-3.5 text-gold group-hover:scale-110 transition-transform" />
                          <Badge variant="outline" className="text-[8px] px-1 py-0 scale-90">
                            {tmpl.badge}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-foreground truncate">{tmpl.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Campaign Content Details */}
              <div className="space-y-3 pt-2">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Campaign Internal Title</Label>
                    <Input
                      value={campaignTitle}
                      onChange={(e) => setCampaignTitle(e.target.value)}
                      placeholder="e.g. Dhanteras 2026 Gold Discount Offer"
                      className="text-xs h-9"
                    />
                  </div>
                  {selectedChannel === "email" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Email Subject Line</Label>
                      <Input
                        value={messageSubject}
                        onChange={(e) => setMessageSubject(e.target.value)}
                        placeholder="Subject line..."
                        className="text-xs h-9"
                      />
                    </div>
                  )}
                </div>

                {/* Variable Pills */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Insert Live Data Tag:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Customer Name", key: "customer_name" },
                      { label: "Shop Name", key: "firm_name" },
                      { label: "Gold Rate", key: "gold_rate" },
                      { label: "Balance Due", key: "balance_due" },
                      { label: "Shop Address", key: "shop_address" },
                      { label: "Helpline", key: "phone" },
                      { label: "Website URL", key: "action_url" },
                    ].map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => handleInsertVariable(v.key)}
                        className="text-[10px] bg-muted hover:bg-gold/20 border border-border px-2 py-0.5 rounded text-muted-foreground hover:text-gold transition-colors font-mono"
                      >
                        + &#123;&#123;{v.key}&#125;&#125;
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Body Textarea */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-semibold">Message Copy</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {messageBody.length} characters
                    </span>
                  </div>
                  <Textarea
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    rows={8}
                    className="font-mono text-xs leading-relaxed"
                    placeholder="Type your message copy here..."
                  />
                </div>
              </div>

              {/* Step 4: Dispatch Controls */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  Sending to <span className="font-bold text-foreground">{activeRecipientsCount}</span>{" "}
                  selected contacts via{" "}
                  <span className="font-bold uppercase text-gold">{selectedChannel}</span>
                </div>
                <Button
                  className="bg-gold hover:bg-gold-600 text-slate-950 font-bold gap-2 text-xs h-10 px-5 shadow-sm"
                  onClick={handleExecuteCampaign}
                  disabled={isDispatching || activeRecipientsCount === 0}
                >
                  <Play className="h-4 w-4 fill-current" />
                  {isDispatching ? "Broadcasting..." : "Launch Campaign Now"}
                </Button>
              </div>

              {/* WhatsApp Sequential Sender Queue Widget */}
              {waQueue.length > 0 && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-400">
                        WhatsApp Dispatch Queue ({waQueueIdx + 1} of {waQueue.length})
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-muted-foreground"
                      onClick={() => {
                        setWaQueue([]);
                        setWaQueueIdx(0);
                      }}
                    >
                      Dismiss
                    </Button>
                  </div>

                  {waQueueIdx < waQueue.length ? (
                    <div className="flex items-center gap-3 bg-card p-3 rounded-lg border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {waQueue[waQueueIdx].name}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {waQueue[waQueueIdx].phone}
                        </p>
                      </div>
                      <a
                        href={waQueue[waQueueIdx].url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 gap-1.5"
                          onClick={() => setWaQueueIdx((i) => i + 1)}
                        >
                          Send on WhatsApp <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold p-2">
                      <CheckCircle2 className="h-4 w-4" /> All queued WhatsApp messages dispatched!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recipient Selection Table Card */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-gold" /> Recipient Audience Manager
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[10px] h-7"
                    onClick={() => setSelectedCustomerIds(new Set(eligibleRecipients.map((p) => p.id)))}
                  >
                    Select All ({eligibleRecipients.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[10px] h-7"
                    onClick={() => setSelectedCustomerIds(new Set())}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search recipient by name, phone or email..."
                  className="pl-8 text-xs h-8"
                />
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-border border border-border rounded-lg">
                {displayedRecipients.map((p) => {
                  const isSelected = selectedCustomerIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`p-2.5 flex items-center justify-between text-xs hover:bg-muted/30 cursor-pointer transition-colors ${
                        isSelected ? "bg-muted/15" : "opacity-60"
                      }`}
                      onClick={() => {
                        setSelectedCustomerIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-border text-gold focus:ring-gold"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{p.fullName}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {p.phone || "No phone"} · {p.email || "No email"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                        {p.type}
                      </Badge>
                    </div>
                  );
                })}
                {displayedRecipients.length === 0 && (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No matching recipients found in this segment.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Interactive Realtime Visual Preview */}
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-xs sticky top-6">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-gold" /> Live Device Preview
                </CardTitle>
                <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                      previewDevice === "mobile"
                        ? "bg-card text-gold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Mobile WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                      previewDevice === "desktop"
                        ? "bg-card text-gold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Desktop Email
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {previewDevice === "mobile" ? (
                /* Smartphone Mockup */
                <div className="mx-auto w-full max-w-[340px] rounded-3xl border-4 border-slate-800 bg-slate-950 p-3 shadow-2xl space-y-3">
                  {/* Smartphone Top Notch / Header */}
                  <div className="flex items-center justify-between px-2 pt-1 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-gold/20 text-gold grid place-items-center font-bold text-[10px]">
                        AVS
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-white leading-tight">
                          {firm.shopName || "AVS Jewellers"}
                        </p>
                        <p className="text-[9px] text-emerald-400">Official Business Account</p>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Chat Bubble */}
                  <div className="p-2 space-y-2 min-h-[360px] bg-[#0b141a] rounded-2xl flex flex-col justify-end">
                    <div className="bg-[#005c4b] text-white p-3 rounded-xl rounded-tr-none text-xs leading-relaxed space-y-2 shadow-sm">
                      <p className="whitespace-pre-line text-[11px] font-sans">
                        {samplePreviewText}
                      </p>
                      <div className="flex justify-end items-center gap-1 text-[9px] text-white/60">
                        <span>10:30 AM</span>
                        <Check className="h-3 w-3 text-cyan-300" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Desktop Email Mockup */
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3 text-xs">
                  <div className="space-y-1 border-b border-border pb-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">From:</span>
                      <span className="font-semibold">{firm.shopName || "AVS ERP"} &lt;no-reply@arivahly.in&gt;</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Subject:</span>
                      <span className="font-bold text-foreground truncate max-w-[220px]">
                        {samplePreviewSubject}
                      </span>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg p-4 space-y-3 min-h-[280px]">
                    <div className="border-b border-border/60 pb-2 text-center">
                      <h4 className="font-serif font-bold text-gold text-sm">
                        {firm.shopName || "AVS Gold & Diamond Jewellers"}
                      </h4>
                    </div>
                    <p className="whitespace-pre-line text-[11px] text-muted-foreground leading-relaxed">
                      {samplePreviewText}
                    </p>
                    <div className="border-t border-border/60 pt-3 text-center text-[10px] text-muted-foreground">
                      {firm.shopName} · {firm.address || "Main Showroom"}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. CAMPAIGN HISTORY & AUDIT LOG */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-gold" /> Campaign History & Broadcast Logs
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {campaignHistory.length} Total Campaigns
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted border-b border-border uppercase font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Campaign Name</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">Target Segment</th>
                  <th className="p-3">Audience Reach</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Dispatched Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaignHistory.map((cmp) => (
                  <tr key={cmp.id} className="hover:bg-muted/15 transition-colors">
                    <td className="p-3 font-semibold text-foreground">
                      {cmp.name}
                      <p className="text-[10px] text-muted-foreground font-normal truncate max-w-[200px]">
                        {cmp.contentPreview}
                      </p>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase font-mono ${
                          cmp.channel === "whatsapp"
                            ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                            : cmp.channel === "email"
                            ? "border-blue-500/30 text-blue-400 bg-blue-500/5"
                            : "border-amber-500/30 text-amber-400 bg-amber-500/5"
                        }`}
                      >
                        {cmp.channel}
                      </Badge>
                    </td>
                    <td className="p-3 capitalize text-muted-foreground">{cmp.targetFilter}</td>
                    <td className="p-3 font-mono font-medium">
                      {cmp.sentCount} / {cmp.targetCount}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      >
                        {cmp.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground font-mono text-[11px]">
                      {new Date(cmp.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 gap-1 text-gold hover:text-gold-400"
                        onClick={() => {
                          setCampaignTitle(`Copy of ${cmp.name}`);
                          setSelectedChannel(cmp.channel);
                          toast.success(`Loaded campaign settings from "${cmp.name}"`);
                        }}
                      >
                        <Copy className="h-3 w-3" /> Duplicate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
