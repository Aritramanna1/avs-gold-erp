import React, { useState, useEffect } from "react";
import {
  Building2,
  User,
  ShieldCheck,
  GitBranch,
  CreditCard,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  FileText,
  Eye,
  EyeOff,
  Check,
  RefreshCw,
} from "lucide-react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { sendPlatformEmail } from "@/lib/platform-email-service";
import { DEFAULT_PLATFORM_ADDONS, PlatformAddonRecord } from "./PlatformAddonsManager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-shell";

export interface PlatformPlanItem {
  id: string;
  name: string;
  description: string;
  price: { monthly: number; yearly: number };
  limits: { maxUsers: number; maxBranches: number; maxStorageMb: number; monthlyInvoiceLimit: number };
  features: Record<string, boolean>;
  active: boolean;
}

export interface PlatformAddonItem {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  billingFrequency: "monthly" | "yearly" | "annual" | "one_time";
  active: boolean;
}

const DEFAULT_PLANS: PlatformPlanItem[] = [
  {
    id: "plan_gold_starter",
    name: "Gold Starter",
    description: "Ideal for single retail jewelry showrooms and boutiques.",
    price: { monthly: 1499, yearly: 14990 },
    limits: { maxUsers: 3, maxBranches: 1, maxStorageMb: 2000, monthlyInvoiceLimit: 1000 },
    features: {
      accounts_ledger: true,
      gold_cash_pos: true,
      workshop_karigar: false,
      hallmarking_tracking: true,
      payroll_hr: false,
      multi_branch: false,
      reports_gst: true,
      whatsapp_alerts: false,
      custom_branding: true,
      api_access: false,
    },
    active: true,
  },
  {
    id: "plan_gold_professional",
    name: "Gold Professional",
    description: "Complete ERP for manufacturing jewellers, karigars, and multi-counter stores.",
    price: { monthly: 3499, yearly: 34990 },
    limits: { maxUsers: 10, maxBranches: 3, maxStorageMb: 10000, monthlyInvoiceLimit: 10000 },
    features: {
      accounts_ledger: true,
      gold_cash_pos: true,
      workshop_karigar: true,
      hallmarking_tracking: true,
      payroll_hr: true,
      multi_branch: true,
      reports_gst: true,
      whatsapp_alerts: true,
      custom_branding: true,
      api_access: false,
    },
    active: true,
  },
  {
    id: "plan_gold_enterprise",
    name: "Enterprise Bullion & Multi-Branch",
    description: "High-volume wholesale, bullion trading, multi-chain operations with custom APIs.",
    price: { monthly: 7999, yearly: 79990 },
    limits: { maxUsers: 50, maxBranches: 10, maxStorageMb: 50000, monthlyInvoiceLimit: 50000 },
    features: {
      accounts_ledger: true,
      gold_cash_pos: true,
      workshop_karigar: true,
      hallmarking_tracking: true,
      payroll_hr: true,
      multi_branch: true,
      reports_gst: true,
      whatsapp_alerts: true,
      custom_branding: true,
      api_access: true,
    },
    active: true,
  },
];

interface StepState {
  // Step 1: Business Information
  legalName: string;
  displayName: string;
  proprietorName: string;
  gstin: string;
  pan: string;
  businessType: "proprietorship" | "partnership" | "llp" | "pvt_ltd" | "public_ltd" | "other";
  address: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;

  // Step 2: Primary Contact
  contactPerson: string;
  contactEmail: string;
  contactMobile: string;
  designation: string;

  // Step 3: Initial Admin User
  adminName: string;
  adminEmail: string;
  adminMobile: string;
  adminRole: string;
  adminPassword: string;
  sendWelcomeEmail: boolean;

  // Step 4: Branch Details
  branchName: string;
  branchCode: string;
  branchAddress: string;
  branchCity: string;
  branchState: string;
  branchPin: string;

  // Step 5: Plan
  selectedPlanId: string;
  billingFrequency: "monthly" | "yearly";

  // Step 6: Add-ons
  selectedAddonIds: string[];

  // Step 7/8: State
  isSubmitting: boolean;
  creationSuccess: boolean;
  createdTenantId?: string;
  error?: string;
}

const INITIAL_STATE: StepState = {
  legalName: "",
  displayName: "",
  proprietorName: "",
  gstin: "",
  pan: "",
  businessType: "pvt_ltd",
  address: "",
  city: "",
  state: "West Bengal",
  pinCode: "",
  country: "India",

  contactPerson: "",
  contactEmail: "",
  contactMobile: "",
  designation: "Director / Owner",

  adminName: "",
  adminEmail: "",
  adminMobile: "",
  adminRole: "super_admin",
  adminPassword: "",
  sendWelcomeEmail: true,

  branchName: "Main Showroom",
  branchCode: "MAIN-01",
  branchAddress: "",
  branchCity: "",
  branchState: "West Bengal",
  branchPin: "",

  selectedPlanId: "plan_gold_professional",
  billingFrequency: "yearly",

  selectedAddonIds: ["addon_whatsapp_pack", "addon_extra_users"],

  isSubmitting: false,
  creationSuccess: false,
};

const STEPS = [
  { id: 1, label: "Business Info", icon: Building2 },
  { id: 2, label: "Primary Contact", icon: User },
  { id: 3, label: "Admin User", icon: ShieldCheck },
  { id: 4, label: "Main Branch", icon: GitBranch },
  { id: 5, label: "Select Plan", icon: CreditCard },
  { id: 6, label: "Add-ons", icon: Layers },
  { id: 7, label: "Review & Billing", icon: FileText },
  { id: 8, label: "Provision Tenant", icon: Sparkles },
];

export function PlatformCreateTenantWizard({
  onTenantCreated,
  onCancel,
}: {
  onTenantCreated?: (tenantId: string) => void;
  onCancel?: () => void;
}) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<StepState>(INITIAL_STATE);
  const [plans, setPlans] = useState<PlatformPlanItem[]>(DEFAULT_PLANS);
  const [addons, setAddons] = useState<PlatformAddonItem[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [planRes, addRes] = await Promise.all([
          supabase.from("platform_plans").select("*").eq("is_active", true),
          supabase
            .from("platform_settings")
            .select("value")
            .eq("key", "commercial.addons")
            .maybeSingle(),
        ]);

        if (planRes.data && planRes.data.length > 0) {
          const mapped: PlatformPlanItem[] = (planRes.data as any[]).map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description || "",
            price: {
              monthly: Math.round((p.price_minor || 0) / 100),
              yearly: Math.round(((p.price_minor || 0) / 100) * 10),
            },
            limits: {
              maxUsers: p.user_limit || 10,
              maxBranches: p.branch_limit || 2,
              maxStorageMb: 10000,
              monthlyInvoiceLimit: 10000,
            },
            features:
              typeof p.feature_limits === "object" && p.feature_limits ? p.feature_limits : {},
            active: Boolean(p.is_active),
          }));
          setPlans(mapped);
          if (mapped[0] && !formData.selectedPlanId) {
            setFormData((prev) => ({ ...prev, selectedPlanId: mapped[0].id }));
          }
        } else {
          setPlans(DEFAULT_PLANS);
        }

        if (addRes.data?.value && Array.isArray(addRes.data.value)) {
          const mappedAddons: PlatformAddonItem[] = (addRes.data.value as any[]).map((a) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            description: a.description || "",
            price: Math.round((a.price_minor || a.price || 0) / (a.price_minor ? 100 : 1)),
            billingFrequency:
              a.billing_frequency || a.billingFrequency || "monthly",
            active: Boolean(a.is_active ?? a.active ?? true),
          }));
          setAddons(mappedAddons.filter((a) => a.active));
        } else {
          setAddons(
            DEFAULT_PLATFORM_ADDONS.map((a) => ({
              id: a.id,
              code: a.code,
              name: a.name,
              description: a.description,
              price: Math.round(a.price_minor / 100),
              billingFrequency: a.billing_frequency,
              active: a.is_active,
            })),
          );
        }
      } catch {
        setPlans(DEFAULT_PLANS);
      }
    }
    void loadData();
  }, []);

  const updateField = <K extends keyof StepState>(key: K, value: StepState[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "contactPerson" && !prev.adminName) next.adminName = value as string;
      if (key === "contactEmail" && !prev.adminEmail) next.adminEmail = value as string;
      if (key === "contactMobile" && !prev.adminMobile) next.adminMobile = value as string;
      if (key === "address" && !prev.branchAddress) next.branchAddress = value as string;
      if (key === "city" && !prev.branchCity) next.branchCity = value as string;
      if (key === "state" && !prev.branchState) next.branchState = value as string;
      if (key === "pinCode" && !prev.branchPin) next.branchPin = value as string;
      return next;
    });
  };

  const toggleAddon = (addonId: string) => {
    setFormData((prev) => {
      const exists = prev.selectedAddonIds.includes(addonId);
      return {
        ...prev,
        selectedAddonIds: exists
          ? prev.selectedAddonIds.filter((id) => id !== addonId)
          : [...prev.selectedAddonIds, addonId],
      };
    });
  };

  const selectedPlan = plans.find((p) => p.id === formData.selectedPlanId) || plans[0];
  const selectedAddonsList = addons.filter((a) => formData.selectedAddonIds.includes(a.id));

  // Commercial Calculations
  const planBasePrice = selectedPlan
    ? formData.billingFrequency === "yearly"
      ? selectedPlan.price.yearly
      : selectedPlan.price.monthly
    : 0;
  const addonsTotal = selectedAddonsList.reduce((acc, a) => {
    const price =
      formData.billingFrequency === "yearly" && a.billingFrequency === "monthly"
        ? a.price * 12
        : a.price;
    return acc + price;
  }, 0);
  const subtotal = planBasePrice + addonsTotal;
  const isInterState = formData.state.toLowerCase() !== "west bengal";
  const igst = isInterState ? Math.round(subtotal * 0.18) : 0;
  const cgst = !isInterState ? Math.round(subtotal * 0.09) : 0;
  const sgst = !isInterState ? Math.round(subtotal * 0.09) : 0;
  const taxTotal = igst + cgst + sgst;
  const grandTotal = subtotal + taxTotal;

  const validateCurrentStep = (): boolean => {
    if (currentStep === 1) {
      if (!formData.legalName.trim() || !formData.displayName.trim() || !formData.city.trim()) {
        alert("Please fill in the required business details (Legal Name, Display Name, City).");
        return false;
      }
    } else if (currentStep === 2) {
      if (
        !formData.contactPerson.trim() ||
        !formData.contactEmail.trim() ||
        !formData.contactMobile.trim()
      ) {
        alert("Please enter Primary Contact name, email, and mobile number.");
        return false;
      }
    } else if (currentStep === 3) {
      if (
        !formData.adminName.trim() ||
        !formData.adminEmail.trim() ||
        !formData.adminPassword.trim()
      ) {
        alert("Please provide Admin User Name, Email, and Initial Password.");
        return false;
      }
      if (formData.adminPassword.length < 6) {
        alert("Admin password must be at least 6 characters.");
        return false;
      }
    } else if (currentStep === 4) {
      if (!formData.branchName.trim() || !formData.branchCode.trim()) {
        alert("Please specify Branch Name and Branch Code.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setCurrentStep((prev) => Math.min(prev + 1, 8));
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleProvisionTenant = async () => {
    setFormData((prev) => ({ ...prev, isSubmitting: true, error: undefined }));
    try {
      const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const slug = formData.displayName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      const newTenant = {
        id: tenantId,
        slug: slug || tenantId,
        name: formData.displayName,
        legalName: formData.legalName,
        proprietorName: formData.proprietorName,
        gstin: formData.gstin,
        pan: formData.pan,
        businessType: formData.businessType,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pinCode: formData.pinCode,
        country: formData.country,
        status: "active",
        plan: selectedPlan?.id || "plan_gold_professional",
        planName: selectedPlan?.name || "Gold Professional",
        billingFrequency: formData.billingFrequency,
        selectedAddons: formData.selectedAddonIds,
        createdAt: new Date().toISOString(),
        subscriptionStatus: "active",
        renewalDate: new Date(
          Date.now() + (formData.billingFrequency === "yearly" ? 365 : 30) * 86400000,
        ).toISOString(),
        isTrial: false,
        primaryContact: {
          name: formData.contactPerson,
          email: formData.contactEmail,
          mobile: formData.contactMobile,
          designation: formData.designation,
        },
        adminUser: {
          name: formData.adminName,
          email: formData.adminEmail,
          mobile: formData.adminMobile,
          role: formData.adminRole,
        },
        mainBranch: {
          id: `branch_${tenantId}_main`,
          name: formData.branchName,
          code: formData.branchCode,
          address: formData.branchAddress,
          city: formData.branchCity,
          state: formData.branchState,
          pin: formData.branchPin,
          isMain: true,
          status: "active",
        },
        limits: selectedPlan?.limits || {
          maxUsers: 10,
          maxBranches: 2,
          maxStorageMb: 5000,
          monthlyInvoiceLimit: 5000,
        },
        features: selectedPlan?.features || {
          accounts_ledger: true,
          gold_cash_pos: true,
          workshop_karigar: true,
          hallmarking_tracking: true,
          payroll_hr: true,
          multi_branch: true,
          reports_gst: true,
          whatsapp_alerts: true,
          custom_branding: true,
          api_access: false,
        },
      };

      // 1. Save into Organizations table / local storage
      const existingTenantsStr = localStorage.getItem("platform_tenants");
      const existingTenants = existingTenantsStr ? JSON.parse(existingTenantsStr) : [];
      existingTenants.unshift(newTenant);
      localStorage.setItem("platform_tenants", JSON.stringify(existingTenants));

      // 2. Save initial Admin User credential in local auth directory
      const usersKey = `tenant_${tenantId}_users`;
      const initialUsers = [
        {
          id: `user_${Date.now()}`,
          tenantId: tenantId,
          name: formData.adminName,
          email: formData.adminEmail,
          mobile: formData.adminMobile,
          role: formData.adminRole,
          active: true,
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(usersKey, JSON.stringify(initialUsers));

      // 3. Save initial Branch
      const branchesKey = `tenant_${tenantId}_branches`;
      localStorage.setItem(branchesKey, JSON.stringify([newTenant.mainBranch]));

      // 4. Generate Initial Subscription Invoice Record
      const invNumber = `INV-AVS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const subscriptionRecord = {
        invoiceNumber: invNumber,
        tenantId: tenantId,
        tenantName: formData.displayName,
        planId: selectedPlan?.id,
        planName: selectedPlan?.name,
        billingFrequency: formData.billingFrequency,
        subtotal,
        taxTotal,
        grandTotal,
        status: "PAID",
        paymentMethod: "OWNER_CONSOLE_DIRECT_PROVISIONING",
        paidAt: new Date().toISOString(),
        addons: selectedAddonsList.map((a) => ({ id: a.id, name: a.name, price: a.price })),
      };
      const invoicesKey = `platform_subscription_invoices`;
      const existingInvoices = JSON.parse(localStorage.getItem(invoicesKey) || "[]");
      existingInvoices.unshift(subscriptionRecord);
      localStorage.setItem(invoicesKey, JSON.stringify(existingInvoices));

      // 5. Send Centralized AVS Platform Welcome Email
      if (formData.sendWelcomeEmail) {
        await sendPlatformEmail({
          tenantId: tenantId,
          templateKey: "account_welcome",
          recipientEmail: formData.adminEmail,
          recipientName: formData.adminName,
          variables: {
            tenant_name: formData.displayName,
            admin_name: formData.adminName,
            admin_email: formData.adminEmail,
            temp_password: formData.adminPassword,
            login_url: "https://erp.arivahly.in/auth/login",
            plan_name: selectedPlan?.name || "Gold Professional",
            renewal_date: new Date(
              Date.now() + (formData.billingFrequency === "yearly" ? 365 : 30) * 86400000,
            ).toLocaleDateString("en-IN"),
          },
        });
      }

      // 6. Write Audit Log
      await supabase.from("platform_audit_events").insert({
        action: "PLATFORM_CREATE_TENANT",
        target_type: "organization",
        reason: `Created tenant "${formData.displayName}" (${tenantId}) with plan ${selectedPlan?.name}, initial admin ${formData.adminEmail}`,
      });

      setFormData((prev) => ({
        ...prev,
        isSubmitting: false,
        creationSuccess: true,
        createdTenantId: tenantId,
      }));

      if (onTenantCreated) {
        onTenantCreated(tenantId);
      }
    } catch (err: any) {
      setFormData((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err?.message || "Failed to provision tenant",
      }));
    }
  };

  // SUCCESS SCREEN
  if (formData.creationSuccess) {
    return (
      <Card className="max-w-2xl mx-auto border-border bg-card p-6 md:p-8 text-center space-y-5">
        <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-serif text-xl font-bold text-foreground">Tenant Successfully Created & Provisioned</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            <strong className="text-gold">{formData.displayName}</strong> has been configured with the <strong className="text-gold">{selectedPlan?.name}</strong> plan and initialized in the database.
          </p>
        </div>

        <div className="erp-surface rounded-md border border-border p-4 text-left grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block text-[10px] font-mono uppercase">Tenant ID:</span>
            <span className="font-mono text-gold font-bold">{formData.createdTenantId}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] font-mono uppercase">Admin Email:</span>
            <span className="font-mono text-foreground font-semibold">{formData.adminEmail}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] font-mono uppercase">Assigned Plan:</span>
            <span className="text-foreground font-medium">{selectedPlan?.name} ({formData.billingFrequency})</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] font-mono uppercase">Welcome Email:</span>
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Dispatched via Platform Email
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFormData(INITIAL_STATE);
              setCurrentStep(1);
            }}
            className="text-xs h-9 font-semibold"
          >
            Create Another Tenant
          </Button>
          <Button
            size="sm"
            onClick={() => (onCancel ? onCancel() : (window.location.href = "/platform?view=firms"))}
            className="text-xs h-9 font-bold bg-gold text-black hover:bg-gold/90"
          >
            Open Tenant Directory
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <PageHeader
            title="Create Tenant / Customer Account"
            subtitle="Manual transactional provisioning with central plan selection, initial branch, and admin account setup"
          />
        </div>
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs font-semibold self-start sm:self-auto">
            Cancel & Exit
          </Button>
        )}
      </div>

      {/* STEP PROGRESS BAR */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                if (step.id < currentStep) setCurrentStep(step.id);
              }}
              disabled={step.id > currentStep}
              className={`flex flex-col items-center p-2 rounded-md text-center transition-all border ${
                isActive
                  ? "bg-card border-gold text-gold font-bold shadow-xs"
                  : isDone
                    ? "bg-card border-border text-emerald-500 hover:bg-muted/40"
                    : "bg-muted/20 border-border/60 text-muted-foreground opacity-60 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-center mb-1">
                {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              </div>
              <span className="text-[10px] font-mono uppercase line-clamp-1">{step.label}</span>
            </button>
          );
        })}
      </div>

      {/* FORM CARD */}
      <Card className="border border-border bg-card shadow-xs">
        <CardContent className="p-6">
          {/* STEP 1: BUSINESS INFO */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-base font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gold" /> Step 1: Legal Business Information
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Official registration details and statutory tax identifiers (GSTIN & PAN).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Legal / Registered Business Name *</Label>
                  <Input
                    value={formData.legalName}
                    onChange={(e) => updateField("legalName", e.target.value)}
                    placeholder="e.g. Sree Balaji Jewellers Pvt Ltd"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Display / Brand Name *</Label>
                  <Input
                    value={formData.displayName}
                    onChange={(e) => updateField("displayName", e.target.value)}
                    placeholder="e.g. Balaji Jewellers"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Proprietor / Director Name</Label>
                  <Input
                    value={formData.proprietorName}
                    onChange={(e) => updateField("proprietorName", e.target.value)}
                    placeholder="e.g. Ramesh Sen"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Business Constitution</Label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => updateField("businessType", e.target.value as any)}
                    className="w-full h-9 bg-background border border-border rounded-md px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                  >
                    <option value="proprietorship">Sole Proprietorship</option>
                    <option value="partnership">Partnership Firm</option>
                    <option value="llp">Limited Liability Partnership (LLP)</option>
                    <option value="pvt_ltd">Private Limited Company</option>
                    <option value="public_ltd">Public Limited Company</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">GSTIN (15-Digit GST Number)</Label>
                  <Input
                    value={formData.gstin}
                    onChange={(e) => updateField("gstin", e.target.value.toUpperCase())}
                    placeholder="e.g. 19AAAAA0000A1Z5"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">PAN Number</Label>
                  <Input
                    value={formData.pan}
                    onChange={(e) => updateField("pan", e.target.value.toUpperCase())}
                    placeholder="e.g. ABCDE1234F"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold font-mono"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Registered Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="e.g. 12/B Bowbazar Jewellers Lane"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">City *</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="e.g. Kolkata"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">State / UT *</Label>
                  <select
                    value={formData.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    className="w-full h-9 bg-background border border-border rounded-md px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                  >
                    <option value="West Bengal">West Bengal</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Bihar">Bihar</option>
                    <option value="Other">Other State</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">PIN / Postal Code</Label>
                  <Input
                    value={formData.pinCode}
                    onChange={(e) => updateField("pinCode", e.target.value)}
                    placeholder="e.g. 700012"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Country</Label>
                  <Input
                    value={formData.country}
                    disabled
                    className="h-9 text-xs bg-muted/40 border-border text-muted-foreground"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PRIMARY CONTACT */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-base font-bold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-gold" /> Step 2: Primary Commercial Contact
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Official billing and primary platform contact details.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Contact Person Name *</Label>
                  <Input
                    value={formData.contactPerson}
                    onChange={(e) => updateField("contactPerson", e.target.value)}
                    placeholder="e.g. Ramesh Sen"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Designation</Label>
                  <Input
                    value={formData.designation}
                    onChange={(e) => updateField("designation", e.target.value)}
                    placeholder="e.g. Managing Director"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Official Email Address *</Label>
                  <Input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => updateField("contactEmail", e.target.value)}
                    placeholder="e.g. ramesh@balajijewellers.com"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Mobile Number (WhatsApp Enabled) *</Label>
                  <Input
                    type="tel"
                    value={formData.contactMobile}
                    onChange={(e) => updateField("contactMobile", e.target.value)}
                    placeholder="e.g. +91 98300 12345"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INITIAL ADMIN USER */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gold" /> Step 3: First Authorized Tenant Administrator
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create the initial Super Administrator login for this tenant. No self-registration needed.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Administrator Full Name *</Label>
                  <Input
                    value={formData.adminName}
                    onChange={(e) => updateField("adminName", e.target.value)}
                    placeholder="e.g. Ramesh Sen"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Admin Email (Login ID) *</Label>
                  <Input
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => updateField("adminEmail", e.target.value)}
                    placeholder="e.g. admin@balajijewellers.com"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Admin Mobile</Label>
                  <Input
                    type="tel"
                    value={formData.adminMobile}
                    onChange={(e) => updateField("adminMobile", e.target.value)}
                    placeholder="e.g. +91 98300 12345"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Assigned ERP Role</Label>
                  <select
                    value={formData.adminRole}
                    onChange={(e) => updateField("adminRole", e.target.value)}
                    className="w-full h-9 bg-background border border-border rounded-md px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                  >
                    <option value="super_admin">Super Administrator (Full Tenant Control)</option>
                    <option value="tenant_owner">Owner / Director</option>
                    <option value="store_manager">General Manager</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Initial Password *</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.adminPassword}
                      onChange={(e) => updateField("adminPassword", e.target.value)}
                      placeholder="Enter secure initial password (min 6 characters)"
                      className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-md border border-border bg-muted/30 text-xs">
                  <div>
                    <span className="font-semibold text-foreground block">Dispatch Welcome Credentials by Email</span>
                    <span className="text-[11px] text-muted-foreground">
                      Dispatches login credentials via configured AVS Platform Email service
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.sendWelcomeEmail}
                    onChange={(e) => updateField("sendWelcomeEmail", e.target.checked)}
                    className="h-4 w-4 rounded border-border text-gold focus:ring-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: MAIN BRANCH */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-base font-bold text-foreground flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-gold" /> Step 4: Primary Operating Branch
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Initial Main showroom / workshop branch for stock vaults and invoicing.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Branch Name *</Label>
                  <Input
                    value={formData.branchName}
                    onChange={(e) => updateField("branchName", e.target.value)}
                    placeholder="e.g. Main Showroom - Bowbazar"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Branch Code / Prefix *</Label>
                  <Input
                    value={formData.branchCode}
                    onChange={(e) => updateField("branchCode", e.target.value.toUpperCase())}
                    placeholder="e.g. MAIN-01"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold font-mono"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Branch Address</Label>
                  <Input
                    value={formData.branchAddress}
                    onChange={(e) => updateField("branchAddress", e.target.value)}
                    placeholder="e.g. 12/B Bowbazar Jewellers Lane"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">City</Label>
                  <Input
                    value={formData.branchCity}
                    onChange={(e) => updateField("branchCity", e.target.value)}
                    placeholder="e.g. Kolkata"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">PIN Code</Label>
                  <Input
                    value={formData.branchPin}
                    onChange={(e) => updateField("branchPin", e.target.value)}
                    placeholder="e.g. 700012"
                    className="h-9 text-xs bg-background border-border focus:ring-1 focus:ring-gold font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: PLAN SELECTION */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-base font-bold text-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gold" /> Step 5: Select Authoritative Plan
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select active subscription tier from central catalog.
                  </p>
                </div>

                {/* Billing cycle toggle */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border border-border self-start sm:self-auto text-xs">
                  <button
                    type="button"
                    onClick={() => updateField("billingFrequency", "monthly")}
                    className={`px-3 py-1 rounded text-xs font-semibold transition ${
                      formData.billingFrequency === "monthly"
                        ? "bg-gold text-black font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("billingFrequency", "yearly")}
                    className={`px-3 py-1 rounded text-xs font-semibold transition ${
                      formData.billingFrequency === "yearly"
                        ? "bg-gold text-black font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Yearly (Save 15%)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {plans.map((plan) => {
                  const isSelected = formData.selectedPlanId === plan.id;
                  const price =
                    formData.billingFrequency === "yearly"
                      ? plan.price.yearly
                      : plan.price.monthly;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => updateField("selectedPlanId", plan.id)}
                      className={`cursor-pointer rounded-md p-4 border transition-all relative ${
                        isSelected
                          ? "bg-muted/30 border-gold shadow-sm"
                          : "bg-card border-border hover:border-gold/40"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{plan.name}</h4>
                          <p className="text-[11px] text-muted-foreground mt-1 min-h-[32px]">
                            {plan.description}
                          </p>
                        </div>
                        {isSelected && (
                          <Badge variant="default" className="bg-gold text-black text-[10px] font-mono">
                            SELECTED
                          </Badge>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-border">
                        <span className="text-xl font-mono font-bold text-foreground">
                          ₹{price.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono ml-1">
                          /{formData.billingFrequency === "yearly" ? "yr" : "mo"}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-muted-foreground pt-2 border-t border-border/60">
                        <div className="flex justify-between">
                          <span>Users:</span>
                          <span className="font-mono font-semibold text-foreground">{plan.limits.maxUsers} Users</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Branches:</span>
                          <span className="font-mono font-semibold text-foreground">{plan.limits.maxBranches} Branches</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Invoices:</span>
                          <span className="font-mono font-semibold text-foreground">{plan.limits.monthlyInvoiceLimit.toLocaleString()} /mo</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 6: ADD-ONS */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-base font-bold text-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4 text-gold" /> Step 6: Select Active Platform Add-ons
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Attach quota boosters and communication channels configured in Add-ons catalog.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {addons.map((addon) => {
                  const isSelected = formData.selectedAddonIds.includes(addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`cursor-pointer rounded-md p-3.5 border transition-all flex items-start justify-between ${
                        isSelected
                          ? "bg-muted/30 border-gold shadow-sm"
                          : "bg-card border-border hover:border-gold/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-foreground">{addon.name}</h4>
                          <span className="text-[10px] font-mono text-gold px-1.5 py-0.5 bg-muted rounded border border-border">
                            {addon.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{addon.description}</p>
                        <div className="text-xs font-mono font-bold text-foreground mt-2">
                          ₹{addon.price.toLocaleString("en-IN")}{" "}
                          <span className="text-[10px] text-muted-foreground font-normal">({addon.billingFrequency})</span>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border mt-0.5 ${
                          isSelected ? "bg-gold border-gold text-black" : "border-border bg-background"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 7: REVIEW & BILLING */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-base font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gold" /> Step 7: Order Summary & Commercial Review
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify profile data, selected entitlements, and statutory GST calculation before provisioning.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Profile Summary */}
                <div className="erp-surface rounded-md border border-border p-4 space-y-2 text-xs">
                  <h4 className="font-bold font-serif text-sm text-foreground border-b border-border pb-2">Tenant Profile</h4>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Legal Name:</span>
                    <span className="font-semibold text-foreground">{formData.legalName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Display Name:</span>
                    <span className="font-semibold text-foreground">{formData.displayName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GSTIN / PAN:</span>
                    <span className="font-mono text-foreground">{formData.gstin || "N/A"} / {formData.pan || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="text-foreground">{formData.city}, {formData.state}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Admin Account:</span>
                    <span className="font-mono text-gold font-semibold">{formData.adminEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Main Branch:</span>
                    <span className="text-foreground">{formData.branchName} ({formData.branchCode})</span>
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="erp-surface rounded-md border border-border p-4 space-y-2 text-xs">
                  <h4 className="font-bold font-serif text-sm text-foreground border-b border-border pb-2">Commercial Summary</h4>
                  <div className="flex justify-between text-foreground">
                    <span>{selectedPlan?.name} ({formData.billingFrequency}):</span>
                    <span className="font-mono font-semibold">₹{planBasePrice.toLocaleString("en-IN")}</span>
                  </div>

                  {selectedAddonsList.map((addon) => {
                    const price =
                      formData.billingFrequency === "yearly" && addon.billingFrequency === "monthly"
                        ? addon.price * 12
                        : addon.price;
                    return (
                      <div key={addon.id} className="flex justify-between text-muted-foreground text-[11px]">
                        <span>+ {addon.name}:</span>
                        <span className="font-mono">₹{price.toLocaleString("en-IN")}</span>
                      </div>
                    );
                  })}

                  <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground">
                    <span>Subtotal:</span>
                    <span className="font-mono">₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>

                  {isInterState ? (
                    <div className="flex justify-between text-muted-foreground text-[11px]">
                      <span>IGST (18%):</span>
                      <span className="font-mono">₹{igst.toLocaleString("en-IN")}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-muted-foreground text-[11px]">
                        <span>CGST (9%):</span>
                        <span className="font-mono">₹{cgst.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground text-[11px]">
                        <span>SGST (9%):</span>
                        <span className="font-mono">₹{sgst.toLocaleString("en-IN")}</span>
                      </div>
                    </>
                  )}

                  <div className="border-t border-border pt-2 flex justify-between text-sm font-bold text-gold">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base">₹{grandTotal.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: FINAL PROVISIONING */}
          {currentStep === 8 && (
            <div className="space-y-4 text-center max-w-md mx-auto py-6">
              <div className="w-10 h-10 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto border border-gold/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-foreground">Ready to Provision Tenant</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Clicking confirm will atomically create the tenant workspace, isolated main branch, super admin login, apply entitlements, and dispatch access credentials.
                </p>
              </div>

              {formData.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded-md flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formData.error}</span>
                </div>
              )}

              <div className="pt-2">
                <Button
                  disabled={formData.isSubmitting}
                  onClick={handleProvisionTenant}
                  className="w-full h-10 bg-gold text-black font-bold text-xs hover:bg-gold/90 shadow-sm gap-2"
                >
                  {formData.isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Provisioning Tenant & Dispatching Email...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Confirm & Provision Workspace
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        {/* Action footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={currentStep === 1 || formData.isSubmitting}
            className="h-8 text-xs font-semibold gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>

          <span className="text-[11px] font-mono text-muted-foreground">
            Step {currentStep} of {STEPS.length}
          </span>

          {currentStep < 8 ? (
            <Button
              size="sm"
              onClick={handleNext}
              className="h-8 text-xs font-bold bg-gold text-black hover:bg-gold/90 shadow-xs gap-1"
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      </Card>
    </div>
  );
}
