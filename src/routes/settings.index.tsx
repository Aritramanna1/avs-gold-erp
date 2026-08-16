import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useDraft } from "@/lib/drafts-store";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useSettings,
  DROPDOWN_LABELS,
  exportPilotData,
  importPilotData,
  clearBrowserSessionResidue,
  flushSettingsPersistence,
  PILOT_STORAGE_KEYS,
  type DropdownKey,
  type PrinterProfile,
  type DocumentTemplate,
  type ComplianceProfile,
  type FormMetadata,
  type FormFieldMetadata,
} from "@/lib/settings-store";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModuleStore, ERP_MODULES, type ERPModuleKey } from "@/lib/module-store";
import { hardwareService } from "@/lib/hardware-service";
import { CashDrawerButton } from "@/components/hardware/CashDrawerButton";
import { HardwareDevicesRegistry } from "@/components/hardware/HardwareDevicesRegistry";
import {
  Trash2,
  Plus,
  Download,
  Upload,
  Database,
  AlertTriangle,
  Loader2,
  ImageIcon,
  X,
  Save,
  Mail,
  Sun,
  Moon,
  Monitor,
  Check,
  Eye,
  EyeOff,
  Sliders,
  KeyRound,
  MessageSquare,
  Printer,
  Hammer,
  UserCheck,
  ShieldCheck,
  FolderArchive,
  Archive,
  Lock,
  LifeBuoy,
  HardDriveDownload,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  uploadToSupabaseStorage,
  getAttachmentSignedUrl,
  uploadFileToSupabase,
} from "@/lib/supabase-storage";
import { updateFirmProfile } from "@/lib/supabase-services";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";
import { FirmPortalInvitationsPanel } from "@/components/settings/FirmPortalInvitationsPanel";
import { staffDepartments, staffRoleLabels, useStaffRoleTemplates } from "@/lib/staff-role-config";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { useDbStatus, getDbStatusLabel } from "@/lib/db-status";
import { useRoles } from "@/lib/rbac";
import { Logo } from "@/components/ui/Logo";
import { APP_NAME, APP_DESCRIPTION, APP_VERSION, COMPANY_NAME, APP_TAGLINE } from "@/lib/app-info";
import { ALL_LANGUAGES, LANGUAGE_INFO, type LanguageCode } from "@/i18n";

import { FactoryResetDialog } from "@/components/security/FactoryResetDialog";
import { useBullionRate } from "@/lib/bullion-rate-service";
import { Route as WhatsAppIntegrationRoute } from "@/routes/settings.integrations.whatsapp";
import { Route as WhatsAppSettingsRoute } from "@/routes/settings.whatsapp";
import { Route as WaTemplatesRoute } from "@/routes/settings.whatsapp-templates";
import { CustomizationDeepLink } from "@/components/settings/CustomizationDeepLink";
import { CreditsTab } from "@/components/settings/CreditsTab";

const SearchSchema = z.object({
  tab: z.string().optional(),
  waSection: z.enum(["business", "wasender", "templates"]).optional(),
});

export const Route = createFileRoute("/settings/")({
  validateSearch: (s) => SearchSchema.parse(s),
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Settings · AVS Gold ERP" }] }),
  component: SettingsPage,
});

type EmbeddedWhatsAppPage = ComponentType<{ embedded?: boolean }>;

const WhatsAppSettingsPage = WhatsAppSettingsRoute.options.component as EmbeddedWhatsAppPage;
const WhatsAppIntegrationPage = WhatsAppIntegrationRoute.options.component as EmbeddedWhatsAppPage;
const WaTemplatesPage = WaTemplatesRoute.options.component as EmbeddedWhatsAppPage;

function SettingsPage() {
  const s = useSettings();
  const navigate = useNavigate();
  const { tab, waSection } = useSearch({ from: "/settings/" });
  const [activeTab, setActiveTab] = useState(tab || "firm");
  const [isFactoryResetOpen, setIsFactoryResetOpen] = useState(false);

  useEffect(() => {
    if (tab === "terminology") {
      void navigate({ to: "/control/terminology", replace: true });
      return;
    }
    if (tab) {
      setActiveTab(tab);
    }
  }, [tab, navigate]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Brand, WhatsApp, firm, masters, compliance, hardware, backup, and pilot controls."
      />

      <Card className="p-4 mb-5 border-gold/40 bg-gold/5 text-sm">
        <strong>Pilot Notice — </strong>
        AVS ERP pilot is for controlled six-month testing. Maintain manual / physical registers in
        parallel until final production approval. See{" "}
        <Link to="/help" className="text-gold underline">
          Help &amp; Pilot Guide
        </Link>
        .
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Link
          to="/settings"
          search={{ tab: "branding" }}
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <Sliders className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm">Brand Settings</div>
            <div className="text-xs text-muted-foreground">
              Product identity, logo, colors, support details, and print branding.
            </div>
          </div>
        </Link>
        <Link
          to="/settings/license"
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <KeyRound className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm">Subscription &amp; Billing</div>
            <div className="text-xs text-muted-foreground">
              Plans, invoices, secure payments, receipts, and usage credits.
            </div>
          </div>
        </Link>
        <Link
          to="/settings"
          search={{ tab: "whatsapp", waSection: "business" }}
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <MessageSquare className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm">WhatsApp Settings</div>
            <div className="text-xs text-muted-foreground">
              Providers, WasenderAPI, templates, automation, retries, and fallback behavior.
            </div>
          </div>
        </Link>
        <Link
          to="/settings/print-templates"
          className="erp-surface rounded-md border border-border bg-gold/5 border-gold/20 hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <Printer className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm text-gold font-semibold">Printing Module</div>
            <div className="text-xs text-muted-foreground">
              Unified templates, paper sizes, PDF output, reprint audit, and document coverage.
            </div>
          </div>
        </Link>
        <Link
          to="/karigar-login"
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <Hammer className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm font-semibold">Karigar Portal</div>
            <div className="text-xs text-muted-foreground">
              Worker OTP login for gold balance, issue/return ledger, wages, and attendance.
            </div>
          </div>
        </Link>
        <Link
          to="/customer-login"
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <UserCheck className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm font-semibold">Customer Portal</div>
            <div className="text-xs text-muted-foreground">
              Customer OTP login for orders, invoices, repairs, documents, and support threads.
            </div>
          </div>
        </Link>
        <Link
          to="/verify"
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm">Security · Verify Receipt</div>
            <div className="text-xs text-muted-foreground">
              Paste a QR payload from any MTJ print to confirm it is genuine.
            </div>
          </div>
        </Link>
        <Link
          to="/settings/storage-diagnostics"
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <FolderArchive className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm font-semibold">Storage &amp; File Diagnostics</div>
            <div className="text-xs text-muted-foreground">
              Verify configured Supabase storage connectivity and synchronized attachment records.
            </div>
          </div>
        </Link>
        <Link
          to="/settings/document-vault"
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <Archive className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm font-semibold">Document Vault</div>
            <div className="text-xs text-muted-foreground">
              Supabase-backed document storage and central document engine readiness.
            </div>
          </div>
        </Link>
        <Link
          to="/settings/security-center"
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <Lock className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm font-semibold">Security Center</div>
            <div className="text-xs text-muted-foreground">
              Registered devices, trust status, and encryption key rotation.
            </div>
          </div>
        </Link>
        <Link
          to="/settings/support"
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <LifeBuoy className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm font-semibold">Support</div>
            <div className="text-xs text-muted-foreground">
              Raise a ticket and chat live with Arivahly support.
            </div>
          </div>
        </Link>
        <Link
          to="/settings/backup-recovery"
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <HardDriveDownload className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm font-semibold">Backup &amp; Disaster Recovery</div>
            <div className="text-xs text-muted-foreground">
              Run a restore drill or download an encrypted backup snapshot.
            </div>
          </div>
        </Link>
        <Link
          to="/communications"
          className="erp-surface rounded-md border border-border bg-gold/5 border-gold/20 hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <Mail className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm text-gold font-semibold">Communications Hub</div>
            <div className="text-xs text-muted-foreground">
              Configure communication providers, templates, automation and CRM campaigns.
            </div>
          </div>
        </Link>
        <Link
          to="/settings/automation"
          className="erp-surface rounded-md border border-border bg-card hover:border-gold/40 transition p-4 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-md bg-gold/15 grid place-items-center text-gold border border-gold/20">
            <Bell className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <div className="font-medium text-sm font-semibold">Communication Automation</div>
            <div className="text-xs text-muted-foreground">
              Toggle auto-sent messages per event — off by default, gold/financial reminders stay
              manual.
            </div>
          </div>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Mobile View: Select Dropdown to keep layout clean */}
        <div className="block md:hidden mb-4">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full bg-white border border-border rounded-md px-4 py-3 text-sm font-semibold shadow-sm focus:ring-2 focus:ring-gold focus:ring-offset-1 focus:border-transparent">
              <SelectValue placeholder="Select settings section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="firm">Firm Settings</SelectItem>
              <SelectItem value="branches">Branches</SelectItem>
              <SelectItem value="branding">Branding &amp; Logo</SelectItem>
              <SelectItem value="whatsapp">WhatsApp Integration</SelectItem>
              <SelectItem value="appearance">Appearance &amp; Theme</SelectItem>
              <SelectItem value="print">Print Margins</SelectItem>
              <SelectItem value="printers">Printer Profiles</SelectItem>
              <SelectItem value="templates">Document Templates</SelectItem>
              <SelectItem value="compliance">Compliance Profile</SelectItem>
              <SelectItem value="forms">Dynamic Forms</SelectItem>
              <SelectItem value="users">Users &amp; Roles</SelectItem>
              <SelectItem value="logs">Security Audit Logs</SelectItem>
              {useModuleStore.getState().isModuleEnabled("gst") && (
                <SelectItem value="gst">GST Registration</SelectItem>
              )}
              <SelectItem value="hardware">Hardware Scales</SelectItem>
              <SelectItem value="language">Language Preference</SelectItem>
              <SelectItem value="credits">Credits &amp; Usage Wallet</SelectItem>
              <SelectItem value="modules">Modules Manager</SelectItem>
              <SelectItem value="email">Email &amp; SMTP</SelectItem>
              <SelectItem value="backup">Data Backup &amp; Sync</SelectItem>
              <SelectItem value="about">About ERP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop View: Full horizontal tab triggers list */}
        <TabsList className="hidden md:flex flex-wrap h-auto">
          <TabsTrigger value="firm">Firm</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="print">Print</TabsTrigger>
          <TabsTrigger value="printers">Printer Profiles</TabsTrigger>
          <TabsTrigger value="templates">Document Templates</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="forms">Dynamic Forms</TabsTrigger>
          <TabsTrigger value="users">Users &amp; Roles</TabsTrigger>
          <TabsTrigger value="logs">Security Logs</TabsTrigger>
          {useModuleStore.getState().isModuleEnabled("gst") && (
            <TabsTrigger value="gst">GST</TabsTrigger>
          )}
          <TabsTrigger value="hardware">Hardware</TabsTrigger>
          <TabsTrigger value="language">Language</TabsTrigger>
          <TabsTrigger value="credits">Credits Wallet</TabsTrigger>
          <TabsTrigger value="modules">Modules Manager</TabsTrigger>
          <TabsTrigger value="email">Email &amp; SMTP</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="firm">
          <FirmTab />
        </TabsContent>
        <TabsContent value="branches">
          <BranchesTab />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingTab />
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsAppTab initialSection={waSection} />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="print">
          <CustomizationDeepLink
            title="Print & Stamp Configuration"
            description="Company logo, authorized signature, stamp images, and print profiles."
            tab="print"
          />
        </TabsContent>
        <TabsContent value="printers">
          <CustomizationDeepLink
            title="Printer Profiles"
            description="Printer routing, margins, and device-specific print profiles."
            tab="print"
          />
        </TabsContent>
        <TabsContent value="templates">
          <CustomizationDeepLink
            title="Document Templates"
            description="Invoice layouts, ledger formats, and document template designer."
            tab="documents"
          />
        </TabsContent>
        <TabsContent value="compliance">
          <ComplianceTab />
        </TabsContent>
        <TabsContent value="forms">
          <FormsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="logs">
          <SecurityLogsTab />
        </TabsContent>
        {useModuleStore.getState().isModuleEnabled("gst") && (
          <TabsContent value="gst">
            <GstTab />
          </TabsContent>
        )}
        <TabsContent value="purity">
          <CustomizationDeepLink
            title="Purity & Fineness"
            description="Configure purity grades, fineness rules, and hallmark mappings for your manufacturing books."
            tab="purity"
          />
        </TabsContent>
        <TabsContent value="workshop">
          <CustomizationDeepLink
            title="Workshop Processes"
            description="Define workshop stages, WIP rules, and manufacturing process definitions."
            tab="workshop"
          />
        </TabsContent>
        <TabsContent value="rate">
          <CustomizationDeepLink
            title="Rates & Bullion Rules"
            description="Daily bhav, metal rate policies, and branch rate override rules."
            tab="rates"
          />
        </TabsContent>
        <TabsContent value="making">
          <CustomizationDeepLink
            title="Making & Labour Rules"
            description="Making charge slabs, labour rules, and wastage policies."
            tab="making"
          />
        </TabsContent>
        <TabsContent value="hardware">
          <HardwareTab />
        </TabsContent>
        <TabsContent value="catalog">
          <CustomizationDeepLink
            title="Catalog Settings"
            description="Catalog categories, design attributes, and product classification."
            tab="catalog"
          />
        </TabsContent>
        <TabsContent value="dropdowns">
          <CustomizationDeepLink
            title="Custom Dropdowns & Fields"
            description="Dropdown masters, custom fields, and business vocabulary aliases."
            tab="dropdowns"
          />
        </TabsContent>
        <TabsContent value="language">
          <LanguageTab />
        </TabsContent>
        <TabsContent value="credits">
          <CreditsTab />
        </TabsContent>
        <TabsContent value="migration">
          <Card className="p-6 space-y-4">
            <h3 className="font-serif text-lg text-gold">Data Import & Migration</h3>
            <p className="text-sm text-muted-foreground">
              Historical data migration runs from the dedicated import area. After completion or
              choosing Start Fresh, the onboarding prompt will not reappear on your dashboard.
            </p>
            <Button asChild className="bg-gold hover:bg-gold/90 text-black">
              <Link to="/control/migration">Open Migration Tools</Link>
            </Button>
          </Card>
        </TabsContent>
        <TabsContent value="modules">
          <ModulesManagerTab />
        </TabsContent>
        <TabsContent value="email">
          <EmailTab />
        </TabsContent>
        <TabsContent value="backup">
          <BackupTab />
        </TabsContent>
        <TabsContent value="db">
          <Card className="p-6 space-y-3">
            <h3 className="font-serif text-lg text-gold">Platform Administration</h3>
            <p className="text-sm text-muted-foreground">
              Database administration, provider secrets, and infrastructure controls are managed in
              the Platform Owner console — not in tenant ERP Settings.
            </p>
            <p className="text-xs text-muted-foreground">
              For connection status and business integrations, use WhatsApp, Email, and Hardware
              tabs above.
            </p>
          </Card>
        </TabsContent>
        <TabsContent value="about">
          <AboutTab />
        </TabsContent>
      </Tabs>

      <div className="mt-8 pt-6 border-t border-red-200">
        <h3 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5" /> Danger Zone
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Session cleanup and guarded troubleshooting actions for this browser. Supabase production
          data is managed through authorized online workflows.
        </p>
        <div className="flex gap-4">
          <Button
            variant="destructive"
            onClick={() => setIsFactoryResetOpen(true)}
            className="bg-red-600 hover:bg-red-700"
          >
            Clear Browser Session
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (
                confirm(
                  "Reset appearance, print and hardware preferences to default? Users, roles, branches, and company info are not affected.",
                )
              )
                s.resetAll();
            }}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            Reset Settings to Default
          </Button>
        </div>
      </div>

      <FactoryResetDialog
        open={isFactoryResetOpen}
        onOpenChange={setIsFactoryResetOpen}
        firmName={s.firm?.shopName || "AVS Gold"}
      />
    </div>
  );
}

interface LogoUploaderProps {
  logoUrl: string;
  logoStoragePath: string;
  onLogoChange: (url: string, path: string) => void;
  onClearLogo: () => void;
}

function LogoUploader({ logoUrl, logoStoragePath, onLogoChange, onClearLogo }: LogoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { filePath, signedUrl } = await uploadFileToSupabase(
        "firm-assets",
        file,
        "firm_profile",
        "logo",
      );

      onLogoChange(signedUrl, filePath);
      toast.success("Firm logo uploaded. Click 'Save Changes' to apply.");
    } catch (err: any) {
      console.error("Logo upload error:", err);
      toast.error(err.message || "Failed to save the firm logo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 border border-input rounded-md bg-muted/20">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-lg bg-card border border-border flex items-center justify-center overflow-hidden relative shadow-sm">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo Preview"
              className="object-contain max-h-full max-w-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Firm Logo</span>
          <span className="text-[11px] text-muted-foreground leading-snug">
            {logoStoragePath
              ? "New logo chosen. Save changes to update sidebar and records."
              : "Using default application branding assets."}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-1.5 transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploading ? "Uploading..." : "Upload Logo"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        {logoUrl && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onClearLogo}
            disabled={uploading}
            className="gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Remove Logo
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FirmTab() {
  const { firm, setFirm } = useSettings();

  // Local state drafts
  const [shopName, setShopName, clearShopName] = useDraft(
    "mtj-settings-shopName-v1",
    () => firm.shopName,
  );
  const [phone, setPhone, clearPhone] = useDraft("mtj-settings-phone-v1", () => firm.phone);
  const [email, setEmail, clearEmail] = useDraft("mtj-settings-email-v1", () => firm.email);
  const [gstin, setGstin, clearGstin] = useDraft("mtj-settings-gstin-v1", () => firm.gstin);
  const [ownerName, setOwnerName, clearOwnerName] = useDraft(
    "mtj-settings-ownerName-v1",
    () => firm.ownerName || "",
  );
  const [pan, setPan, clearPan] = useDraft("mtj-settings-pan-v1", () => firm.pan || "");
  const [cityState, setCityState, clearCityState] = useDraft(
    "mtj-settings-cityState-v1",
    () => firm.cityState || "",
  );
  const [website, setWebsite, clearWebsite] = useDraft(
    "mtj-settings-website-v1",
    () => firm.website || "",
  );
  const [whatsappNumber, setWhatsappNumber, clearWhatsappNumber] = useDraft(
    "mtj-settings-whatsappNumber-v1",
    () => firm.whatsappNumber || "",
  );
  const [tagline, setTagline, clearTagline] = useDraft(
    "mtj-settings-tagline-v1",
    () => firm.tagline || "",
  );
  const [address, setAddress, clearAddress] = useDraft(
    "mtj-settings-address-v1",
    () => firm.address || "",
  );
  const [footerLine, setFooterLine, clearFooterLine] = useDraft(
    "mtj-settings-footerLine-v1",
    () => firm.footerLine || "",
  );
  const [terms, setTerms, clearTerms] = useDraft("mtj-settings-terms-v1", () => firm.terms || "");
  const [signatureLabelLeft, setSignatureLabelLeft, clearSignatureLabelLeft] = useDraft(
    "mtj-settings-signatureLabelLeft-v1",
    () => firm.signatureLabelLeft || "",
  );
  const [signatureLabelRight, setSignatureLabelRight, clearSignatureLabelRight] = useDraft(
    "mtj-settings-signatureLabelRight-v1",
    () => firm.signatureLabelRight || "",
  );
  const [logoUrl, setLogoUrl, clearLogoUrl] = useDraft(
    "mtj-settings-logoUrl-v1",
    () => firm.logoUrl || "",
  );
  const [logoStoragePath, setLogoStoragePath, clearLogoStoragePath] = useDraft(
    "mtj-settings-logoStoragePath-v1",
    () => firm.logoStoragePath || "",
  );
  const [hostingerUploadUrl, setHostingerUploadUrl, clearHostingerUploadUrl] = useDraft(
    "mtj-settings-hostingerUploadUrl-v1",
    () => firm.hostingerUploadUrl || "",
  );

  const [saving, setSaving] = useState(false);

  // Sync draft states with store when store change occurs
  useEffect(() => {
    setShopName(firm.shopName);
    setPhone(firm.phone);
    setEmail(firm.email);
    setGstin(firm.gstin);
    setOwnerName(firm.ownerName || "");
    setPan(firm.pan || "");
    setCityState(firm.cityState || "");
    setWebsite(firm.website || "");
    setWhatsappNumber(firm.whatsappNumber || "");
    setTagline(firm.tagline || "");
    setAddress(firm.address || "");
    setFooterLine(firm.footerLine || "");
    setTerms(firm.terms || "");
    setSignatureLabelLeft(firm.signatureLabelLeft || "");
    setSignatureLabelRight(firm.signatureLabelRight || "");
    setLogoUrl(firm.logoUrl || "");
    setLogoStoragePath(firm.logoStoragePath || "");
    setHostingerUploadUrl(firm.hostingerUploadUrl || "");
  }, [firm]);

  const isDirty =
    shopName !== firm.shopName ||
    phone !== firm.phone ||
    email !== firm.email ||
    gstin !== firm.gstin ||
    ownerName !== (firm.ownerName || "") ||
    pan !== (firm.pan || "") ||
    cityState !== (firm.cityState || "") ||
    website !== (firm.website || "") ||
    whatsappNumber !== (firm.whatsappNumber || "") ||
    tagline !== (firm.tagline || "") ||
    address !== (firm.address || "") ||
    footerLine !== (firm.footerLine || "") ||
    terms !== (firm.terms || "") ||
    signatureLabelLeft !== (firm.signatureLabelLeft || "") ||
    signatureLabelRight !== (firm.signatureLabelRight || "") ||
    logoUrl !== (firm.logoUrl || "") ||
    logoStoragePath !== (firm.logoStoragePath || "") ||
    hostingerUploadUrl !== (firm.hostingerUploadUrl || "");

  const handleSave = async () => {
    // 0. Perform robust organizational validations
    if (!shopName.trim()) {
      toast.error("Shop Name is a mandatory organizational profile field.");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone number is a mandatory organizational profile field.");
      return;
    }
    if (!email.trim()) {
      toast.error("Email address is a mandatory organizational profile field.");
      return;
    }

    // formatted GSTIN validation (optional but validated if provided)
    if (gstin.trim()) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin.toUpperCase().trim())) {
        toast.error(
          "Invalid GSTIN format. Must be a standard 15-character Indian GSTIN (e.g., 27AAAAA1111A1Z1).",
        );
        return;
      }
    }

    // formatted PAN validation (optional but validated if provided)
    if (pan.trim()) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(pan.toUpperCase().trim())) {
        toast.error(
          "Invalid PAN format. Must be a 10-character alphanumeric Indian PAN (e.g., ABCDE1234F).",
        );
        return;
      }
    }

    // billing terms & conditions presence
    if (!terms.trim()) {
      toast.error("Billing Terms & Conditions are required for compliant invoice generation.");
      return;
    }

    setSaving(true);
    try {
      const updatedProfile = {
        shopName,
        phone,
        email,
        gstin,
        ownerName,
        pan,
        cityState,
        website,
        whatsappNumber,
        tagline,
        address,
        footerLine,
        terms,
        signatureLabelLeft,
        signatureLabelRight,
        logoUrl,
        logoStoragePath,
        hostingerUploadUrl,
      };

      const success = await updateFirmProfile(updatedProfile);
      if (!success) {
        throw new Error("The connected profile service could not save these changes.");
      }

      // Commit to runtime store configuration for immediate layout/sidebar sync.
      setFirm(updatedProfile);
      toast.success("Firm profile and settings saved successfully.");

      // Clear draft states
      clearShopName();
      clearPhone();
      clearEmail();
      clearGstin();
      clearOwnerName();
      clearPan();
      clearCityState();
      clearWebsite();
      clearWhatsappNumber();
      clearTagline();
      clearAddress();
      clearFooterLine();
      clearTerms();
      clearSignatureLabelLeft();
      clearSignatureLabelRight();
      clearLogoUrl();
      clearLogoStoragePath();
      clearHostingerUploadUrl();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save firm profile changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    clearShopName();
    clearPhone();
    clearEmail();
    clearGstin();
    clearOwnerName();
    clearPan();
    clearCityState();
    clearWebsite();
    clearWhatsappNumber();
    clearTagline();
    clearAddress();
    clearFooterLine();
    clearTerms();
    clearSignatureLabelLeft();
    clearSignatureLabelRight();
    clearLogoUrl();
    clearLogoStoragePath();
    clearHostingerUploadUrl();
    toast.info("Unsaved changes discarded.");
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved settings. Defer leaving?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  return (
    <div className="flex flex-col gap-4 mt-4">
      <Card className="p-5 grid md:grid-cols-2 gap-4">
        <Field label="Shop Name">
          <Input value={shopName} onChange={(e) => setShopName(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="GSTIN">
          <Input value={gstin} onChange={(e) => setGstin(e.target.value)} />
        </Field>

        <Field label="Owner Name">
          <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </Field>
        <Field label="PAN Number">
          <Input value={pan} onChange={(e) => setPan(e.target.value)} />
        </Field>
        <Field label="City / State">
          <Input value={cityState} onChange={(e) => setCityState(e.target.value)} />
        </Field>
        <Field label="Website">
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
        </Field>
        <Field label="WhatsApp Number">
          <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
        </Field>
        <Field label="Hostinger Upload URL">
          <Input
            value={hostingerUploadUrl}
            onChange={(e) => setHostingerUploadUrl(e.target.value)}
            placeholder="https://yourdomain.com/api/hostinger-upload.php"
          />
          <p className="text-[11px] text-muted-foreground">
            PHP upload endpoint for PDF sharing via WhatsApp. Leave blank to skip PDF generation.
          </p>
        </Field>
        <Field label="Tagline / Slogan">
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </Field>

        <div className="md:col-span-2">
          <LogoUploader
            logoUrl={logoUrl}
            logoStoragePath={logoStoragePath}
            onLogoChange={async (url, path) => {
              setLogoUrl(url);
              setLogoStoragePath(path);
              const updated = {
                shopName,
                phone,
                email,
                gstin,
                ownerName,
                pan,
                cityState,
                website,
                whatsappNumber,
                tagline,
                address,
                footerLine,
                terms,
                signatureLabelLeft,
                signatureLabelRight,
                logoUrl: url,
                logoStoragePath: path,
              };
              // setFirm() alone persists the full settings snapshot (see
              // settings-store.ts's persistSettings()) — a separate
              // updateFirmProfile() call here used to fire a second,
              // concurrent, unmerged write to the same app_settings row,
              // racing with this one and occasionally letting a stale
              // in-memory snapshot silently overwrite the logo/firm fields
              // that had just been saved (the root cause of "logo/settings
              // disappear after restart"). One write path only, now.
              setFirm(updated);
              toast.success("Logo uploaded and firm profile saved successfully!");
            }}
            onClearLogo={async () => {
              setLogoUrl("");
              setLogoStoragePath("");
              const updated = {
                shopName,
                phone,
                email,
                gstin,
                ownerName,
                pan,
                cityState,
                website,
                whatsappNumber,
                tagline,
                address,
                footerLine,
                terms,
                signatureLabelLeft,
                signatureLabelRight,
                logoUrl: "",
                logoStoragePath: "",
              };
              setFirm(updated);
              toast.info("Logo cleared and firm profile updated!");
            }}
          />
        </div>

        <div className="md:col-span-2">
          <Field label="Address">
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Footer line on prints">
            <Input value={footerLine} onChange={(e) => setFooterLine(e.target.value)} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Terms & Conditions">
            <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} />
          </Field>
        </div>
        <Field label="Signature Label (left)">
          <Input
            value={signatureLabelLeft}
            onChange={(e) => setSignatureLabelLeft(e.target.value)}
          />
        </Field>
        <Field label="Signature Label (right)">
          <Input
            value={signatureLabelRight}
            onChange={(e) => setSignatureLabelRight(e.target.value)}
          />
        </Field>
      </Card>

      <div className="flex items-center gap-3 justify-end bg-card p-4 rounded-md border border-border mt-1 shadow-sm">
        {isDirty && (
          <span className="text-xs text-amber-500 font-medium mr-auto flex items-center gap-1.5 animate-pulse">
            You have unsaved changes in profile settings
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={saving}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          Cancel / Reset
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="gap-1.5 bg-gold hover:bg-gold-light text-primary-foreground font-semibold"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving Changes..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  const themes: Array<{
    id: Theme;
    name: string;
    description: string;
    icon: typeof Sun;
    previewBg: string;
    previewText: string;
    previewAccent: string;
  }> = [
    {
      id: "light",
      name: "Light Theme",
      description:
        "Default corporate brand theme. Clean, readable off-white background with professional purple action colors and gold brand accents.",
      icon: Sun,
      previewBg: "bg-[#fcfcfa]",
      previewText: "text-[#2e2b26]",
      previewAccent: "bg-[#7c3aed]",
    },
    {
      id: "dark",
      name: "Dark Theme",
      description:
        "Sophisticated twilight theme. Deep indigo-charcoal backgrounds paired with a glowing lavender-purple primary and subtle gold accents.",
      icon: Moon,
      previewBg: "bg-[#15131a]",
      previewText: "text-[#f5f2f8]",
      previewAccent: "bg-[#a78bfa]",
    },
    {
      id: "system",
      name: "System Mode",
      description:
        "Allows the interface to adjust dynamically to your operating system or browser's dark/light schedule.",
      icon: Monitor,
      previewBg: "bg-gradient-to-r from-[#fcfcfa] to-[#15131a]",
      previewText: "text-muted-foreground",
      previewAccent: "bg-indigo-500",
    },
  ];

  return (
    <Card className="p-6 mt-4 space-y-6">
      <div>
        <h3 className="text-lg font-serif text-primary">Theme &amp; Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Customize the visual interface of AVS ERP. The light theme maintains corporate branding,
          while the dark theme provides a sophisticated night layout.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {themes.map((t) => {
          const isActive = theme === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                setTheme(t.id);
                toast.success(`Theme changed to ${t.name}`);
              }}
              className={`flex flex-col text-left rounded-md border p-4 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-background/40 hover:border-primary/40 hover:bg-background/80"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`p-1.5 rounded-lg ${isActive ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted"}`}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="font-semibold text-sm">{t.name}</span>
                </div>
                {isActive && (
                  <span className="text-primary bg-primary/10 p-1 rounded-full">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>

              {/* Mini mockup preview of the theme card */}
              <div
                className={`h-20 w-full rounded-lg ${t.previewBg} border border-border/20 p-2.5 mb-3 flex flex-col justify-between overflow-hidden shadow-inner`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="h-1 w-10 rounded bg-muted-foreground/30" />
                    <div className="h-1.5 w-14 rounded bg-muted-foreground/45" />
                  </div>
                  <div className={`h-3 w-10 rounded-full ${t.previewAccent} opacity-90`} />
                </div>
                <div className="flex gap-1.5 items-center">
                  <div className="h-3 w-3 rounded-full bg-muted/40" />
                  <div className="h-2 flex-1 rounded bg-muted/30" />
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
            </button>
          );
        })}
      </div>

      {/* Print behaviors disclaimer */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-4 flex gap-3 text-sm text-foreground/90">
        <span className="text-gold select-none mt-0.5">ℹ️</span>
        <div className="space-y-1">
          <p className="font-medium">Automatic Print-to-Light Override</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            To guarantee absolute legibility and optimal ink consumption, all generated invoices,
            vouchers, physical reports, and barcode tags are locked to the high-contrast **Light
            Theme** during active print layout rendering, irrespective of the display mode selected
            here.
          </p>
        </div>
      </div>
    </Card>
  );
}

function BrandingTab() {
  const { branding, setBranding, developer, setDeveloper, firm, setFirm } = useSettings();

  // setFirm() alone persists (see settings-store.ts's persistSettings()) —
  // same double-write race fix as the Firm tab's logo uploader above.
  const handleLogoChange = async (url: string, path: string) => {
    const updated = { ...firm, logoUrl: url, logoStoragePath: path };
    setFirm(updated);
    toast.success("Logo uploaded and firm profile saved successfully!");
  };

  const handleClearLogo = async () => {
    const updated = { ...firm, logoUrl: "", logoStoragePath: "" };
    setFirm(updated);
    toast.info("Logo cleared and firm profile updated!");
  };

  return (
    <div className="space-y-5 mt-4">
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-serif text-lg text-gold">Application identity</h3>
          <p className="text-xs text-muted-foreground">
            These values drive the login screens, setup wizard, app chrome, About panel, support
            details, and document branding at runtime.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Application Name">
            <Input
              value={branding.applicationName}
              onChange={(e) => setBranding({ applicationName: e.target.value })}
              placeholder="AVS Gold ERP"
            />
          </Field>
          <Field label="Short Name">
            <Input
              value={branding.shortName}
              onChange={(e) => setBranding({ shortName: e.target.value })}
              placeholder="ERP"
              maxLength={20}
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={branding.tagline}
              onChange={(e) => setBranding({ tagline: e.target.value })}
            />
          </Field>
          <Field label="Product Description">
            <Input
              value={branding.description}
              onChange={(e) => setBranding({ description: e.target.value })}
            />
          </Field>
          <Field label="Company / Publisher">
            <Input
              value={branding.companyName}
              onChange={(e) => setBranding({ companyName: e.target.value })}
            />
          </Field>
          <Field label="Print Header Text">
            <Input
              value={branding.printHeader}
              onChange={(e) => setBranding({ printHeader: e.target.value })}
              placeholder="Leave blank to use the firm name"
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-serif text-lg text-gold">Palette and logo</h3>
          <p className="text-xs text-muted-foreground">
            Brand colors are applied immediately across the application. Print layouts continue to
            enforce their high-contrast print-safe overrides.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Primary Color">
            <div className="flex gap-2">
              <Input
                type="color"
                value={branding.primaryColor}
                onChange={(e) => setBranding({ primaryColor: e.target.value })}
                className="w-14 p-1"
              />
              <Input
                value={branding.primaryColor}
                onChange={(e) => setBranding({ primaryColor: e.target.value })}
                placeholder="#0F172A"
              />
            </div>
          </Field>
          <Field label="Gold Accent">
            <div className="flex gap-2">
              <Input
                type="color"
                value={branding.goldAccent}
                onChange={(e) => setBranding({ goldAccent: e.target.value })}
                className="w-14 p-1"
              />
              <Input
                value={branding.goldAccent}
                onChange={(e) => setBranding({ goldAccent: e.target.value })}
                placeholder="#C8A24B"
              />
            </div>
          </Field>
        </div>
        <LogoUploader
          logoUrl={firm?.logoUrl || ""}
          logoStoragePath={firm?.logoStoragePath || ""}
          onLogoChange={handleLogoChange}
          onClearLogo={handleClearLogo}
        />
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-serif text-lg text-gold">Support and reseller credit</h3>
          <p className="text-xs text-muted-foreground">
            Customer-facing support details and optional implementation-partner attribution.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Support Email">
            <Input
              type="email"
              value={branding.supportEmail}
              onChange={(e) => setBranding({ supportEmail: e.target.value })}
            />
          </Field>
          <Field label="Support Phone">
            <Input
              value={branding.supportPhone}
              onChange={(e) => setBranding({ supportPhone: e.target.value })}
            />
          </Field>
          <Field label="Website">
            <Input
              type="url"
              value={branding.website}
              onChange={(e) => setBranding({ website: e.target.value })}
            />
          </Field>
          <Field label="Developer / Studio Name">
            <Input
              value={developer.avsName}
              onChange={(e) => setDeveloper({ avsName: e.target.value })}
            />
          </Field>
          <Field label="Developer Support Number">
            <Input
              value={developer.contactNumber}
              onChange={(e) => setDeveloper({ contactNumber: e.target.value })}
            />
          </Field>
          <Field label="Developer Support Email">
            <Input
              type="email"
              value={developer.email}
              onChange={(e) => setDeveloper({ email: e.target.value })}
            />
          </Field>
          <Field label="Developer Logo URL">
            <Input
              type="url"
              value={developer.logoUrl || ""}
              onChange={(e) => setDeveloper({ logoUrl: e.target.value })}
            />
          </Field>
          <ToggleRow
            label="Show developer credit on printed materials"
            value={developer.footerEnabled}
            onChange={(value) => setDeveloper({ footerEnabled: value })}
          />
        </div>
      </Card>
    </div>
  );
}

function WhatsAppTab({
  initialSection = "business",
}: {
  initialSection?: "business" | "wasender" | "templates";
}) {
  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 border-gold/30 bg-gold/5">
        <h3 className="font-serif text-lg text-gold">WhatsApp Settings</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Configure branch providers, secured WasenderAPI credentials, approved template mappings,
          editable message bodies, rate limits, retries, fallback behavior, and automation from one
          place. Operational messaging remains in Communications Hub.
        </p>
      </Card>
      <Tabs defaultValue={initialSection}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="business">Providers &amp; Automation</TabsTrigger>
          <TabsTrigger value="wasender">WasenderAPI</TabsTrigger>
          <TabsTrigger value="templates">Message Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="business" className="pt-4">
          <WhatsAppSettingsPage embedded />
        </TabsContent>
        <TabsContent value="wasender" className="pt-4">
          <WhatsAppIntegrationPage embedded />
        </TabsContent>
        <TabsContent value="templates" className="pt-4">
          <WaTemplatesPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PrintTab() {
  const { print, setPrint } = useSettings();
  return (
    <Card className="p-5 grid md:grid-cols-2 gap-4 mt-4">
      <Field label="Invoice Header">
        <Input
          value={print.invoiceHeader}
          onChange={(e) => setPrint({ invoiceHeader: e.target.value })}
        />
      </Field>
      <Field label="Invoice Footer">
        <Input
          value={print.invoiceFooter}
          onChange={(e) => setPrint({ invoiceFooter: e.target.value })}
        />
      </Field>
      <ToggleRow
        label="Show HUID on prints"
        value={print.showHUID}
        onChange={(v) => setPrint({ showHUID: v })}
      />
      <ToggleRow
        label="Show price on jewellery tag"
        value={print.showPriceOnTag}
        onChange={(v) => setPrint({ showPriceOnTag: v })}
      />
      <ToggleRow
        label="Show making charge on tag"
        value={print.showMakingOnTag}
        onChange={(v) => setPrint({ showMakingOnTag: v })}
      />
      <Field label="Tag Size">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={print.tagSize}
          onChange={(e) => setPrint({ tagSize: e.target.value as "40x25" })}
        >
          <option value="40x25">40 × 25 mm</option>
          <option value="50x25">50 × 25 mm</option>
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Copy Labels (comma separated)">
          <Input
            value={print.copyLabels.join(", ")}
            onChange={(e) =>
              setPrint({
                copyLabels: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
      </div>

      <Field label="Voucher Calculation Mode">
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          value={print.voucherCalculationMode || "fine_only"}
          onChange={(e) =>
            setPrint({
              voucherCalculationMode: e.target.value as "fine_only" | "fine_wastage" | "custom",
            })
          }
        >
          <option value="fine_only">Fine only (Net Weight x Touch %)</option>
          <option value="fine_wastage">Fine + Wastage (Fine + Net Weight x Wastage %)</option>
          <option value="custom">Custom manual adjustment</option>
        </select>
      </Field>

      <Field label="Balance Side Labels">
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          value={print.balanceSideLabels || "jama_naam"}
          onChange={(e) =>
            setPrint({
              balanceSideLabels: e.target.value as "jama_naam" | "credit_debit",
            })
          }
        >
          <option value="jama_naam">Jama / Naam (Traditional Ledger)</option>
          <option value="credit_debit">Credit / Debit (Modern Accounting)</option>
        </select>
      </Field>
    </Card>
  );
}

import { useCan, type Action as RbacAction } from "@/lib/rbac";
import {
  UserPlus,
  Copy,
  Trash2 as TrashIcon,
  Shield,
  ShieldAlert,
  CheckSquare,
  Square,
  RefreshCw,
  Search,
  FileText,
  Ban,
  Power,
  ShieldX,
  Activity,
  Edit,
  Key,
} from "lucide-react";

function UsersTab() {
  const { can, email: currentEmail, ready } = useCan();
  const staffRoleTemplates = useStaffRoleTemplates();
  const rolesAvailable = staffRoleLabels(staffRoleTemplates);
  const departmentsAvailable = staffDepartments(staffRoleTemplates);
  const {
    users,
    invitations,
    addInvitation,
    updateInvitation,
    updateUser,
    deleteUser,
    addUser,
    addSecurityLog,
    branches,
    workshops,
    firm,
  } = useSettings();

  const [searchQuery, setSearchQuery] = useState("");
  const [creationTab, setCreationTab] = useState<"invite" | "instant">("invite");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(rolesAvailable[0] ?? "Branch Manager");
  const [inviteBranchId, setInviteBranchId] = useState("MAIN");
  const [inviteWorkshopId, setInviteWorkshopId] = useState("");
  const [inviteDept, setInviteDept] = useState("Management");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [instantName, setInstantName] = useState("");
  const [instantEmail, setInstantEmail] = useState("");
  const [instantPhone, setInstantPhone] = useState("");
  const [instantRole, setInstantRole] = useState(rolesAvailable[0] ?? "Retail Staff");
  const [instantBranchId, setInstantBranchId] = useState("MAIN");
  const [instantWorkshopId, setInstantWorkshopId] = useState("");
  const [instantDept, setInstantDept] = useState("Retail");

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [customPerms, setCustomPerms] = useState<Record<string, boolean>>({});

  const [editingUserDetail, setEditingUserDetail] = useState<any | null>(null);
  const [editDetailForm, setEditDetailForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    branchId: "MAIN",
    workshopId: "",
    department: "Retail",
    landingDashboard: "/dashboard",
    locked: false,
  });

  const [resettingUser, setResettingUser] = useState<any | null>(null);
  const [tempResetCode, setTempResetCode] = useState<string | null>(null);

  if (!ready) {
    return <div className="p-5 text-sm">Loading security context…</div>;
  }

  if (!can("userManagement.view")) {
    return (
      <Card className="p-8 mt-4 text-center border-dashed border-red-500/30 max-w-xl mx-auto">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 mx-auto">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-serif text-lg text-red-400 font-semibold">Access Restricted</h3>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          The fine-grained User Directory and Access Control panel is exclusive to authorized system
          Owners and Administrators. Contact your organization administrator to unlock.
        </p>
      </Card>
    );
  }

  function getDefaultPermissionsForRole(role: string): Record<string, boolean> {
    const perms: Record<string, boolean> = {};
    const allModules = [
      "dashboard",
      "customers",
      "orders",
      "billing",
      "goldLedger",
      "workerSalary",
      "reports",
      "settings",
      "userManagement",
    ];
    const allActions = ["view", "create", "edit", "delete"];

    if (role === "Super Owner" || role === "Administrator") {
      allModules.forEach((m) => {
        allActions.forEach((a) => {
          perms[`${m}_${a}`] = true;
        });
      });
    } else if (role === "Branch Manager") {
      allModules.forEach((m) => {
        allActions.forEach((a) => {
          if (m === "userManagement" && a === "delete") return;
          if (m === "settings" && a === "delete") return;
          perms[`${m}_${a}`] = true;
        });
      });
    } else if (role === "CEO (View Only)") {
      allModules.forEach((m) => {
        perms[`${m}_view`] = true;
      });
    } else if (role === "Accountant") {
      perms["dashboard_view"] = true;
      perms["customers_view"] = true;
      perms["billing_view"] = true;
      perms["billing_print"] = true;
      perms["reports_view"] = true;
      perms["reports_export"] = true;
    } else if (role === "Retail Staff" || role === "Sales Executive") {
      perms["dashboard_view"] = true;
      perms["customers_view"] = true;
      perms["customers_create"] = true;
      perms["orders_view"] = true;
      perms["orders_create"] = true;
      perms["billing_view"] = true;
      perms["billing_create"] = true;
    } else if (role === "CRM Executive") {
      perms["dashboard_view"] = true;
      perms["customers_view"] = true;
      perms["customers_create"] = true;
      perms["customers_edit"] = true;
    } else if (role === "Workshop Manager") {
      perms["dashboard_view"] = true;
      perms["goldLedger_view"] = true;
      perms["goldLedger_create"] = true;
      perms["workerSalary_view"] = true;
      perms["workerSalary_create"] = true;
    } else {
      perms["dashboard_view"] = true;
    }
    return perms;
  }

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToInvite = inviteEmail.trim().toLowerCase();
    if (!emailToInvite) return;

    if (users.some((u) => u.email.toLowerCase() === emailToInvite)) {
      toast.error("This user is already a registered employee in your organization.");
      return;
    }

    const existingPending = invitations.find(
      (i) =>
        i.email.toLowerCase() === emailToInvite &&
        i.status === "pending" &&
        (!i.expiresAt || i.expiresAt > Date.now()),
    );
    if (existingPending) {
      toast.error(
        `An active invitation was already sent to ${emailToInvite} (expires ${new Date(existingPending.expiresAt ?? 0).toLocaleDateString("en-IN")}). Revoke it first to send a new one.`,
      );
      return;
    }

    const code = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const acceptLink = `${getAuthRedirectUrl(`/invite/accept?code=${code}&email=${encodeURIComponent(emailToInvite)}`)}`;
    const firmName = firm?.shopName || "AVS ERP";
    const branchName = branches.find((b) => b.id === inviteBranchId)?.name ?? inviteBranchId;

    const newInvite: import("@/lib/settings-store").InvitationItem = {
      id: `inv_${Date.now()}`,
      email: emailToInvite,
      role: inviteRole,
      code,
      createdAt: Date.now(),
      expiresAt,
      status: "pending" as const,
      branchId: inviteBranchId,
      workshopId: inviteWorkshopId || undefined,
      invitedBy: currentEmail ?? undefined,
    };

    // Persist invitation immediately — email delivery is best-effort and must
    // never block the admin from getting the code/link (send-email can hang on
    // staging when SMTP is not configured).
    addInvitation(newInvite);
    setGeneratedCode(code);
    (window as any).__lastInviteLink = acceptLink;
    setInviteEmail("");
    addSecurityLog(
      "user created",
      `Invitation ${code} generated for ${emailToInvite} (${inviteRole}) — branch: ${branchName}`,
      currentEmail || "System",
    );
    await flushSettingsPersistence();

    setIsSendingEmail(true);
    setEmailSuccess(null);

    try {
      const { sendGenericEmail } = await import("@/lib/email-service");
      const result = await sendGenericEmail({
        to: emailToInvite,
        subject: `[Invitation] Access Granted to ${firmName} ERP`,
        htmlBody: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
            <h2 style="color:#C8A24B;margin-bottom:4px;">${firmName}</h2>
            <p style="color:#666;font-size:13px;margin-top:0;">Employee Invitation</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
            <p>Hello,</p>
            <p>You have been invited to join <strong>${firmName}</strong> as a <strong>${inviteRole}</strong>${inviteDept ? ` (${inviteDept})` : ""}.</p>
            <p><strong>Branch:</strong> ${branchName}</p>
            <div style="margin:24px 0;padding:20px;background:#fffbeb;border:2px solid #C8A24B;border-radius:8px;text-align:center;">
              <div style="font-size:11px;color:#92400e;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Your Invitation Code</div>
              <div style="font-size:28px;font-weight:bold;font-family:monospace;letter-spacing:0.15em;color:#C8A24B;">${code}</div>
            </div>
            <p style="margin:20px 0;">
              <a href="${acceptLink}" style="display:inline-block;padding:12px 24px;background:#C8A24B;color:white;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">
                Activate Your Account →
              </a>
            </p>
            <p style="font-size:12px;color:#666;">Or go to: <a href="${acceptLink}" style="color:#C8A24B;">${acceptLink}</a></p>
            <p style="font-size:11px;color:#999;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:20px;">
              This invitation expires in 7 days. If you did not expect this email, please ignore it.
            </p>
          </div>
        `,
        textBody: `You have been invited to ${firmName} as ${inviteRole}${inviteDept ? ` (${inviteDept})` : ""}.

Branch: ${branchName}

YOUR INVITATION CODE: ${code}

Click this link to activate your account:
${acceptLink}

Or visit the link above and enter the code manually.

This invitation expires in 7 days.`,
      });
      if (result.success) {
        setEmailSuccess(`Invitation email successfully dispatched to ${emailToInvite}.`);
        toast.success(`Invitation sent to ${emailToInvite}`);
      } else {
        setEmailSuccess(null);
        toast.error(
          `Invitation created, but the email could not be delivered to ${emailToInvite}: ${result.error || "Unknown error"}. Share code ${code} manually.`,
        );
        console.error("[Invitation] SMTP dispatch failed:", result.error);
      }
    } catch (err: any) {
      const message = err?.message || String(err);
      setEmailSuccess(null);
      toast.error(
        `Invitation created, but the email could not be delivered to ${emailToInvite}: ${message}. Share code ${code} manually.`,
      );
      console.error("[Invitation] SMTP dispatch exception:", err);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleInstantCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToCreate = instantEmail.trim().toLowerCase();
    if (!instantName.trim() || !emailToCreate) return;

    if (users.some((u) => u.email.toLowerCase() === emailToCreate)) {
      toast.error("An employee with this email already exists.");
      return;
    }

    const code = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const acceptLink = getAuthRedirectUrl(
      `/invite/accept?code=${code}&email=${encodeURIComponent(emailToCreate)}`,
    );
    const firmName = firm?.shopName || "AVS ERP";

    const newInvite: import("@/lib/settings-store").InvitationItem = {
      id: `inv_${Date.now()}`,
      email: emailToCreate,
      role: instantRole,
      code,
      createdAt: Date.now(),
      expiresAt,
      status: "pending" as const,
      branchId: instantBranchId,
      workshopId: instantWorkshopId || undefined,
      invitedBy: currentEmail ?? undefined,
    };

    addInvitation(newInvite);
    setGeneratedCode(code);
    (window as any).__lastInviteLink = acceptLink;
    setCreationTab("invite");
    setInviteEmail("");
    setInstantName("");
    setInstantEmail("");
    setInstantPhone("");
    setInstantWorkshopId("");
    await flushSettingsPersistence();

    try {
      const { sendGenericEmail } = await import("@/lib/email-service");
      await sendGenericEmail({
        to: emailToCreate,
        subject: `[Invitation] Access Granted to ${firmName} ERP`,
        htmlBody: `
          <p>Hello ${instantName.trim()},</p>
          <p>You have been invited to join <strong>${firmName}</strong> as <strong>${instantRole}</strong>.</p>
          <p><a href="${acceptLink}">Accept invitation and create your account</a></p>
          <p>Invitation code: <strong>${code}</strong></p>
        `,
      });
      toast.success(
        `Invitation sent to ${emailToCreate}. They must accept the link to create a Supabase account.`,
      );
    } catch {
      toast.success(
        `Invitation created for ${emailToCreate}. Copy the link below — email delivery is optional.`,
      );
    }

    addSecurityLog(
      "user created",
      `Staff invite ${code} for ${instantName.trim()} (${instantRole}) — account activates on acceptance`,
      currentEmail || "Superowner",
    );
  };

  const handleCopyInviteLink = () => {
    if (!generatedCode) return;
    const acceptLink =
      (window as any).__lastInviteLink ||
      getAuthRedirectUrl(`/invite/accept?code=${generatedCode}`);
    void navigator.clipboard.writeText(acceptLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEditPermissions = (user: any) => {
    setEditingUser(user);
    const defaultModules = [
      "dashboard_view",
      "dashboard_edit",
      "customers_view",
      "customers_create",
      "customers_edit",
      "customers_delete",
      "orders_view",
      "orders_create",
      "orders_edit",
      "orders_delete",
      "billing_view",
      "billing_create",
      "billing_recordPayment",
      "billing_delete",
      "billing_print",
      "goldLedger_view",
      "goldLedger_create",
      "goldLedger_edit",
      "workerSalary_view",
      "workerSalary_create",
      "workerSalary_edit",
      "reports_view",
      "reports_export",
      "settings_view",
      "settings_edit",
      "userManagement_view",
      "userManagement_edit",
    ];

    const expanded: Record<string, boolean> = {};
    defaultModules.forEach((m) => {
      expanded[m] = user.permissions?.[m] ?? false;
    });
    setCustomPerms(expanded);
  };

  const saveCustomPermissions = () => {
    if (!editingUser) return;
    updateUser(editingUser.id, { permissions: customPerms });
    addSecurityLog(
      "permission changed",
      `Modified specific permissions matrix for employee: ${editingUser.email}`,
      currentEmail || "Superowner",
    );
    toast.success(`Successfully applied custom authorization policies to ${editingUser.name}!`);
    setEditingUser(null);
  };

  const handleToggleActive = (user: any) => {
    const nextStatus = !user.active;
    updateUser(user.id, { active: nextStatus });
    addSecurityLog(
      "permission changed",
      `Changed login permission state for ${user.email} to: ${nextStatus ? "ACTIVE" : "SUSPENDED"}`,
      currentEmail || "Superowner",
    );
    toast.success(`User state is now ${nextStatus ? "Active" : "Suspended"}`);
  };

  const handleToggleLock = (user: any) => {
    const nextLock = !user.locked;
    updateUser(user.id, { locked: nextLock });
    addSecurityLog(
      "permission changed",
      `Toggled account locked status for ${user.email} to: ${nextLock ? "LOCKED" : "UNLOCKED"}`,
      currentEmail || "Superowner",
    );
    toast.success(`User account is now ${nextLock ? "Locked" : "Unlocked"}`);
  };

  const startEditUserDetail = (user: any) => {
    setEditingUserDetail(user);
    setEditDetailForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      branchId: user.branchId || "MAIN",
      workshopId: user.workshopId || "",
      department: user.department || "Management",
      landingDashboard: user.landingDashboard || "/dashboard",
      locked: user.locked || false,
    });
  };

  const handleSaveUserDetail = () => {
    if (!editingUserDetail) return;

    const patch: any = {
      name: editDetailForm.name.trim(),
      email: editDetailForm.email.trim(),
      phone: editDetailForm.phone.trim(),
      role: editDetailForm.role,
      branchId: editDetailForm.branchId,
      workshopId: editDetailForm.workshopId || null,
      department: editDetailForm.department,
      landingDashboard: editDetailForm.landingDashboard,
      locked: editDetailForm.locked,
    };

    if (editingUserDetail.role !== editDetailForm.role) {
      const confirmDefaults = window.confirm(
        `You changed the role from "${editingUserDetail.role}" to "${editDetailForm.role}". Reset permissions to default settings?`,
      );
      if (confirmDefaults) {
        patch.permissions = getDefaultPermissionsForRole(editDetailForm.role);
      }
    }

    updateUser(editingUserDetail.id, patch);
    addSecurityLog(
      "permission changed",
      `Edited details for user ${editingUserDetail.email} (Role: ${editDetailForm.role})`,
      currentEmail || "Superowner",
    );

    toast.success("Employee details updated successfully!");
    setEditingUserDetail(null);
  };

  const handleDeleteUser = (user: any) => {
    const confirmDelete = window.confirm(`Permanently delete user "${user.name}" (${user.email})?`);
    if (!confirmDelete) return;

    deleteUser(user.id);
    addSecurityLog(
      "permission changed",
      `Permanently deleted user account for ${user.email} (${user.name})`,
      currentEmail || "Superowner",
    );
    toast.success(`User "${user.name}" has been deleted.`);
  };

  const handleResetPassword = async (user: any) => {
    const resetCode = `OTP-${Math.floor(100000 + Math.random() * 900000)}`;
    setResettingUser(user);
    setTempResetCode(resetCode);

    try {
      const { sendGenericEmail } = await import("@/lib/email-service");
      const result = await sendGenericEmail({
        to: user.email,
        subject: "[Security] Password Reset Request Verification",
        htmlBody: `
          <h3>Passcode Reset</h3>
          <p>An administrator has initiated a password reset request for your account.</p>
          <p>Use the following emergency access OTP to log in and update your credentials:</p>
          <p style="font-size:20px; font-weight:bold; letter-spacing:2px; color:#C8A24B;">${resetCode}</p>
        `,
      });
      if (result.success) {
        toast.success("Security password reset email dispatched.");
      } else {
        toast.error(`Failed to send OTP email: ${result.error || "Unknown error"}`);
      }
    } catch (e: any) {
      toast.error(`Failed to send OTP email: ${e?.message ?? String(e)}`);
    }

    addSecurityLog(
      "permission changed",
      `Issued high-privilege emergency password reset for user: ${user.email}`,
      currentEmail || "Superowner",
    );
  };

  const handleRevokeInvite = (inviteId: string, inviteEmail: string) => {
    updateInvitation(inviteId, { status: "used" });
    addSecurityLog(
      "permission changed",
      `Revoked outstanding invite code for: ${inviteEmail}`,
      currentEmail || "Superowner",
    );
    toast.success("Invitation link revoked successfully.");
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.phone && u.phone.toLowerCase().includes(query)) ||
      u.role.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 mt-4">
      <Card className="p-5 border-border">
        <h2 className="font-serif text-lg text-gold flex items-center gap-2 mb-1.5">
          <UserPlus className="h-5 w-5 text-gold" />
          Onboard Showroom Staff
        </h2>
        <p className="text-xs text-muted-foreground mb-4">Add new users to this ERP.</p>

        <div className="flex border-b border-border mb-4 text-xs">
          <button
            type="button"
            onClick={() => setCreationTab("invite")}
            className={`pb-2 px-4 font-medium transition-colors ${creationTab === "invite" ? "border-b-2 border-gold text-gold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Email Invite Link
          </button>
          <button
            type="button"
            onClick={() => setCreationTab("instant")}
            className={`pb-2 px-4 font-medium transition-colors ${creationTab === "instant" ? "border-b-2 border-gold text-gold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Add Staff Instantly (Pre-Activated)
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground mb-3 -mt-2">
          All staff accounts are created when the invitee accepts the link (password or Google). No
          local-only users are created without Supabase Auth.
        </p>

        {creationTab === "invite" ? (
          <form onSubmit={handleGenerateInvite} className="grid md:grid-cols-6 gap-3 items-end">
            <div className="grid gap-1.5">
              <Label className="text-xs">Employee Email ID</Label>
              <Input
                type="email"
                required
                placeholder="e.g. staff@maatarajewellers.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Assigned Role</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {rolesAvailable.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Department</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                value={inviteDept}
                onChange={(e) => setInviteDept(e.target.value)}
              >
                {departmentsAvailable.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Assigned Branch</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                value={inviteBranchId}
                onChange={(e) => setInviteBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Workshop (optional)</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                value={inviteWorkshopId}
                onChange={(e) => setInviteWorkshopId(e.target.value)}
              >
                <option value="">— None —</option>
                {workshops
                  .filter((w) => !w.branchId || w.branchId === inviteBranchId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </div>
            <Button
              type="submit"
              className="w-full bg-gold hover:bg-gold/90 text-background"
              disabled={isSendingEmail}
            >
              {isSendingEmail ? "Sending..." : "Send Invite"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleInstantCreateUser} className="grid md:grid-cols-7 gap-3 items-end">
            <div className="grid gap-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input
                type="text"
                required
                placeholder="e.g. Joydeb Manna"
                value={instantName}
                onChange={(e) => setInstantName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Email ID</Label>
              <Input
                type="email"
                required
                placeholder="joydeb@mtj.com"
                value={instantEmail}
                onChange={(e) => setInstantEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                type="text"
                placeholder="+91 XXXXX XXXXX"
                value={instantPhone}
                onChange={(e) => setInstantPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Role</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                value={instantRole}
                onChange={(e) => setInstantRole(e.target.value)}
              >
                {rolesAvailable.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Department</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                value={instantDept}
                onChange={(e) => setInstantDept(e.target.value)}
              >
                {departmentsAvailable.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Workshop (optional)</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                value={instantWorkshopId}
                onChange={(e) => setInstantWorkshopId(e.target.value)}
              >
                <option value="">— None —</option>
                {workshops
                  .filter((w) => !w.branchId || w.branchId === instantBranchId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-1" /> Add Staff
            </Button>
          </form>
        )}

        {isSendingEmail && (
          <p className="text-xs text-gold animate-pulse mt-2">Dispatching invitation email...</p>
        )}
        {emailSuccess && <p className="text-xs text-green-400 mt-2">✔ {emailSuccess}</p>}

        {generatedCode && (
          <div className="mt-4 p-3 bg-gold/5 rounded border border-gold/20 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-gold tracking-wider">
                Active Invitation Token
              </span>
              <p className="text-xs font-mono font-medium text-foreground">
                Code:{" "}
                <span className="bg-gold/10 px-2 py-0.5 rounded text-gold">{generatedCode}</span>
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={handleCopyInviteLink}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-400" /> Copied Text!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy Invitation Link
                </>
              )}
            </Button>
          </div>
        )}
      </Card>

      {editingUser && (
        <Card className="p-5 border-gold/30 bg-muted/10 animate-fade-in relative">
          <button
            onClick={() => setEditingUser(null)}
            className="absolute right-4 top-4 hover:text-muted-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="font-serif text-lg text-gold flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-gold" />
            Fine-grained Authorization Matrix:{" "}
            <span className="text-foreground">{editingUser.name}</span>
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-background p-4 rounded border border-border">
            {[
              { label: "Dashboard Hub Status", prefix: "dashboard" },
              { label: "Client Directory", prefix: "customers" },
              { label: "Gold & Metal Orders", prefix: "orders" },
              { label: "Billing & Invoices", prefix: "billing" },
              { label: "Gold Vault & Ledger", prefix: "goldLedger" },
              { label: "Karigar Work & Salaries", prefix: "workerSalary" },
              { label: "Audit Reports", prefix: "reports" },
              { label: "Firm Settings", prefix: "settings" },
              { label: "User Management", prefix: "userManagement" },
            ].map((module) => (
              <div key={module.prefix} className="space-y-1.5 p-2 bg-muted/20 rounded">
                <span className="text-xs font-bold text-gold/90">{module.label}</span>
                <div className="space-y-1 text-xs">
                  {["view", "create", "edit", "delete"].map((act) => {
                    const key = `${module.prefix}_${act}`;
                    const skips: Omit<Record<string, string[]>, ""> = {
                      goldLedger: ["delete"],
                      workerSalary: ["delete"],
                      reports: ["create", "edit", "delete"],
                      settings: ["create", "delete"],
                      userManagement: ["delete", "create"],
                    };
                    if (skips[module.prefix]?.includes(act)) return null;
                    return (
                      <label
                        key={act}
                        className="flex items-center gap-2 cursor-pointer select-none py-0.5 hover:text-gold transition text-xs"
                      >
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 accent-gold border-border bg-background cursor-pointer"
                          checked={customPerms[key] ?? false}
                          onChange={(e) =>
                            setCustomPerms({ ...customPerms, [key]: e.target.checked })
                          }
                        />
                        <span className="capitalize">{act}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-gold hover:bg-gold/90 text-background"
              onClick={saveCustomPermissions}
            >
              Apply Security Overrides
            </Button>
          </div>
        </Card>
      )}

      {resettingUser && tempResetCode && (
        <Card className="p-5 border-emerald-500/30 bg-emerald-500/5 text-xs relative animate-fade-in">
          <button
            onClick={() => {
              setResettingUser(null);
              setTempResetCode(null);
            }}
            className="absolute right-4 top-4 text-emerald-500 hover:text-emerald-400"
          >
            <X className="h-4 w-4" />
          </button>
          <h4 className="font-semibold text-emerald-400 flex items-center gap-1.5 text-sm mb-1">
            <Lock className="h-4 w-4" /> Reset Security Code Issued
          </h4>
          <p className="text-muted-foreground text-xs leading-relaxed mb-3">
            A temporary passcode has been generated for <strong>{resettingUser.name}</strong>.
          </p>
          <div className="p-3.5 bg-emerald-500/10 rounded border border-emerald-500/20 font-mono text-center">
            <span className="text-xl font-bold tracking-widest text-white">{tempResetCode}</span>
          </div>
        </Card>
      )}

      {editingUserDetail && (
        <Card className="p-5 border-blue-500/30 bg-blue-500/5 animate-fade-in relative">
          <button
            onClick={() => setEditingUserDetail(null)}
            className="absolute right-4 top-4 hover:text-muted-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="font-serif text-base text-gold flex items-center gap-1.5 mb-3">
            <Edit className="h-4 w-4 text-gold" />
            Edit Showroom Employee Profile
          </h3>
          <div className="grid md:grid-cols-4 gap-3 items-end text-xs">
            <div className="grid gap-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input
                type="text"
                required
                value={editDetailForm.name}
                onChange={(e) => setEditDetailForm({ ...editDetailForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Email ID</Label>
              <Input
                type="email"
                required
                value={editDetailForm.email}
                onChange={(e) => setEditDetailForm({ ...editDetailForm, email: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                type="text"
                value={editDetailForm.phone}
                onChange={(e) => setEditDetailForm({ ...editDetailForm, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Role</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                value={editDetailForm.role}
                onChange={(e) => setEditDetailForm({ ...editDetailForm, role: e.target.value })}
              >
                {rolesAvailable.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Department</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                value={editDetailForm.department}
                onChange={(e) =>
                  setEditDetailForm({ ...editDetailForm, department: e.target.value })
                }
              >
                {departmentsAvailable.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Branch</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                value={editDetailForm.branchId}
                onChange={(e) => setEditDetailForm({ ...editDetailForm, branchId: e.target.value })}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Default Dashboard</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                value={editDetailForm.landingDashboard}
                onChange={(e) =>
                  setEditDetailForm({ ...editDetailForm, landingDashboard: e.target.value })
                }
              >
                <option value="/dashboard">Owner Executive</option>
                <option value="/workshop">Workshop Floor</option>
                <option value="/billing">Billing POS Counter</option>
                <option value="/communications">CRM Manager</option>
              </select>
            </div>
            <div className="flex items-center gap-4 h-9">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Switch
                  checked={editDetailForm.locked}
                  onCheckedChange={(checked) =>
                    setEditDetailForm({ ...editDetailForm, locked: checked })
                  }
                />
                <span>Lock Account</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 text-xs">
            <Button size="sm" variant="outline" onClick={() => setEditingUserDetail(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSaveUserDetail}
            >
              Save Updates
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-gold">Active Showroom Directory</h3>
            <p className="text-xs text-muted-foreground">
              Manage organization profile structures, designation matrices and security controls.
            </p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search directory..."
              className="pl-8 text-xs h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((u) => {
            const isSuperOwner = u.role === "Super Owner" || u.role === "Owner";
            const isLocked = u.locked;
            return (
              <Card
                key={u.id}
                className={`p-4 border-border bg-card/60 flex flex-col justify-between space-y-3 relative ${isLocked ? "border-red-500/40 bg-red-500/5" : ""}`}
              >
                <div className="space-y-2 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-gold">{u.name}</h4>
                      <p className="text-[11px] text-muted-foreground font-mono">{u.email}</p>
                      {u.phone && <p className="text-[10px] text-muted-foreground">{u.phone}</p>}
                    </div>
                    <Badge
                      variant="outline"
                      className={`${isLocked ? "border-red-500 text-red-400" : "border-gold/30 text-gold bg-gold/5"} text-[10px]`}
                    >
                      {u.role}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-border/40">
                    <div>
                      <span className="text-muted-foreground block text-[9px] uppercase">
                        Department
                      </span>
                      <span className="font-medium">{u.department || "Retail"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[9px] uppercase">
                        Branch Unit
                      </span>
                      <span className="font-medium">
                        {branches.find((b) => b.id === u.branchId)?.name || u.branchId || "MAIN"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block text-[9px] uppercase">
                        Default Dashboard
                      </span>
                      <span className="font-medium font-mono text-[10px]">
                        {u.landingDashboard || "/dashboard"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[9px] uppercase">
                        Last Active
                      </span>
                      <span className="font-mono">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "Never"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/40 text-[11px]">
                  <div className="flex gap-2">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${u.active && !isLocked ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
                    >
                      {isLocked ? "Locked" : u.active ? "Active" : "Suspended"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      title="Edit Profile Settings"
                      onClick={() => startEditUserDetail(u)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-gold"
                      title="Custom ACL Matrix"
                      onClick={() => startEditPermissions(u)}
                      disabled={isSuperOwner}
                    >
                      <ShieldCheck className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-amber-400"
                      title="Reset Security Password"
                      onClick={() => handleResetPassword(u)}
                    >
                      <Key className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      title={isLocked ? "Unlock Account" : "Lock Account"}
                      disabled={isSuperOwner}
                      onClick={() => handleToggleLock(u)}
                    >
                      <Lock
                        className={`h-3 w-3 ${isLocked ? "text-red-500" : "text-muted-foreground"}`}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10"
                      title="Delete User permanently"
                      disabled={isSuperOwner}
                      onClick={() => handleDeleteUser(u)}
                    >
                      <TrashIcon className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {invitations.filter((i) => i.status === "pending").length > 0 && (
        <Card className="p-5 border-dashed border-border mt-4">
          <h2 className="font-serif text-sm text-gold tracking-wide uppercase flex items-center gap-1.5 mb-3">
            <RefreshCw className="h-4 w-4 text-gold shrink-0" />
            Outstanding Corporate Registrations
          </h2>
          <div className="space-y-2">
            {invitations
              .filter((i) => i.status === "pending")
              .map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-2.5 bg-muted/25 rounded border border-border/80 text-xs text-muted-foreground hover:bg-muted/40 transition"
                >
                  <div>
                    <span className="font-semibold text-foreground">{inv.email}</span>
                    <span className="mx-2">·</span>
                    <span>
                      Role: <strong className="text-gold">{inv.role}</strong>
                    </span>
                    <span className="mx-2">·</span>
                    <span>
                      Code:{" "}
                      <code className="bg-gold/10 text-gold px-1.5 py-0.5 rounded font-mono">
                        {inv.code}
                      </code>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 hover:bg-red-500/10 hover:text-red-400 gap-1"
                    onClick={() => handleRevokeInvite(inv.id, inv.email)}
                  >
                    <ShieldX className="h-3.5 w-3.5" /> Revoke
                  </Button>
                </div>
              ))}
          </div>
        </Card>
      )}

      <FirmPortalInvitationsPanel />
    </div>
  );
}

function SecurityLogsTab() {
  const { ready, can } = useCan();
  const logsList = useSettings((s) => s.securityLogs);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");

  if (!ready) {
    return <div className="p-5 text-sm">Loading security log context…</div>;
  }

  // Strictly restrict log access
  if (!can("userManagement.view")) {
    return (
      <Card className="p-8 mt-4 text-center border-dashed border-red-500/30 max-w-xl mx-auto">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 mx-auto">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-serif text-lg text-red-400 font-semibold">Access Restricted</h3>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          The Security Logs panel containing audit details is exclusive to system Owner and
          Administrators.
        </p>
      </Card>
    );
  }

  const filteredLogs = logsList.filter((log) => {
    const matchesQuery =
      log.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());

    if (filterAction === "all") return matchesQuery;
    return log.action === filterAction && matchesQuery;
  });

  return (
    <Card className="p-5 mt-4 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h2 className="font-serif text-lg text-gold flex items-center gap-2">
            <Activity className="h-5 w-5 text-gold shrink-0" />
            Security Audit Trail
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit logs tracking security actions (logins, invoice deletion, golds edits, role
            updates, and user invite code utilization).
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Search audit trail by user email, role change notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none shrink-0"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          <option value="all">All Events</option>
          <option value="login">Logins</option>
          <option value="failed login">Failed Logins</option>
          <option value="user created">User Invite/Created</option>
          <option value="permission changed">Permission Overrides</option>
          <option value="invoice deleted">Invoice Deletion</option>
          <option value="gold edited">Gold Rate Changes</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            No security log events found matching criteria.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                <th className="py-2">Time Signature (UTC)</th>
                <th className="py-2">Authorized ID</th>
                <th className="py-2">Log Action</th>
                <th className="py-2 text-right">Activity details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                  <td className="py-2.5 text-muted-foreground font-mono">
                    {new Date(log.ts).toISOString().replace("T", " ").substring(0, 19)}
                  </td>
                  <td className="py-2.5 font-semibold text-foreground">{log.userEmail}</td>
                  <td className="py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.action.includes("failed")
                          ? "bg-red-500/10 text-red-400"
                          : log.action.includes("deleted")
                            ? "bg-orange-500/10 text-orange-400"
                            : log.action.includes("changed") || log.action.includes("edited")
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-green-500/10 text-green-400"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-medium text-muted-foreground text-xs leading-relaxed max-w-sm ml-auto">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

function GstTab() {
  const { gst, setGst, makingCharge, setMakingCharge } = useSettings();
  const [newOverrideCategory, setNewOverrideCategory] = useState("");
  const [newOverrideBasis, setNewOverrideBasis] =
    useState<typeof makingCharge.defaultBasis>("percentage");
  const [newOverrideValue, setNewOverrideValue] = useState("");

  function addCategoryOverride() {
    const category = newOverrideCategory.trim();
    const value = parseFloat(newOverrideValue) || 0;
    if (!category) return;
    setMakingCharge({
      categoryOverrides: {
        ...makingCharge.categoryOverrides,
        [category]:
          newOverrideBasis === "percentage"
            ? { basis: "percentage", percent: value }
            : { basis: newOverrideBasis, ratePerUnitPaise: Math.round(value * 100) },
      },
    });
    setNewOverrideCategory("");
    setNewOverrideValue("");
  }
  function removeCategoryOverride(category: string) {
    const next = { ...makingCharge.categoryOverrides };
    delete next[category];
    setMakingCharge({ categoryOverrides: next });
  }

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-5 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-foreground">GST & Compliance Configuration</h3>
            <p className="text-xs text-muted-foreground">
              Define tax split rules, HSN/SAC categories and compliance thresholds
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <ToggleRow
            label="GST Enabled (Global Toggle)"
            value={gst.enabled}
            onChange={(v) => setGst({ enabled: v })}
          />

          <Field label="Split Mode">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50 w-full"
              value={gst.splitMode}
              onChange={(e) => setGst({ splitMode: e.target.value as "cgst_sgst" | "igst" })}
            >
              <option value="cgst_sgst">CGST + SGST (intra-state)</option>
              <option value="igst">IGST (inter-state)</option>
            </select>
          </Field>

          <ToggleRow
            label="Apply GST on Making & Stone charges only"
            value={gst.applyOnMakingAndStoneOnly}
            onChange={(v) => setGst({ applyOnMakingAndStoneOnly: v })}
          />

          <Field label="GST Rate % (Metal/Invoice)">
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                value={gst.gstRatePct ?? 3}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setGst({
                    gstRatePct: val,
                    cgstPct: val / 2,
                    sgstPct: val / 2,
                  });
                }}
              />
            </div>
          </Field>

          <Field label="GST Rate % (Making/Job Work Services)">
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                value={gst.makingRatePct ?? 5}
                onChange={(e) => setGst({ makingRatePct: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </Field>

          <Field label="HSN Code (Jewellery / Metal)">
            <div className="relative">
              <Input
                type="text"
                value={gst.hsnJewellery ?? "71131910"}
                onChange={(e) => setGst({ hsnJewellery: e.target.value })}
              />
            </div>
          </Field>

          <Field label="SAC Code (Job Work / Making Charges)">
            <div className="relative">
              <Input
                type="text"
                value={gst.sacServices ?? "9988"}
                onChange={(e) => setGst({ sacServices: e.target.value })}
              />
            </div>
          </Field>

          <Field label="Metal Value vs Making Value Split ratio (Metal %)">
            <div className="relative">
              <Input
                type="number"
                value={gst.metalSplitPct ?? 85}
                onChange={(e) => {
                  const m = parseInt(e.target.value, 10) || 0;
                  setGst({ metalSplitPct: m, makingSplitPct: 100 - m });
                }}
              />
            </div>
          </Field>

          <Field label="PAN Required Threshold Limit (₹)">
            <div className="relative">
              <Input
                type="number"
                value={(gst.panRequiredThresholdPaise ?? 20000000) / 100}
                onChange={(e) =>
                  setGst({ panRequiredThresholdPaise: (parseFloat(e.target.value) || 0) * 100 })
                }
              />
            </div>
          </Field>

          <Field label="Rule 269ST Cash Transaction Limit (₹)">
            <div className="relative">
              <Input
                type="number"
                value={(gst.cashLimitPaise ?? 1000000) / 100}
                onChange={(e) =>
                  setGst({ cashLimitPaise: (parseFloat(e.target.value) || 0) * 100 })
                }
              />
            </div>
          </Field>
        </div>
      </Card>

      <Card className="p-5 space-y-6">
        <div className="border-b border-border pb-3 space-y-0.5">
          <h3 className="text-sm font-bold text-foreground">Making Charge Basis</h3>
          <p className="text-xs text-muted-foreground">
            Default calculation basis for new items. A stock item's own explicit % (or an
            item/category picked at billing time) always overrides this — changing it here never
            affects invoices already issued.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Default basis">
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={makingCharge.defaultBasis}
              onChange={(e) =>
                setMakingCharge({
                  defaultBasis: e.target.value as typeof makingCharge.defaultBasis,
                })
              }
            >
              <option value="percentage">% of gold value</option>
              <option value="gross">Gross weight (₹/gram)</option>
              <option value="net">Net weight (₹/gram)</option>
              <option value="fine">Fine weight (₹/gram)</option>
              <option value="piece">Per piece</option>
              <option value="carat">Per carat</option>
              <option value="flat">Flat amount</option>
            </select>
          </Field>
          {makingCharge.defaultBasis === "percentage" ? (
            <Field label="Default %">
              <Input
                type="number"
                step="0.01"
                value={makingCharge.defaultPercent}
                onChange={(e) =>
                  setMakingCharge({ defaultPercent: parseFloat(e.target.value) || 0 })
                }
              />
            </Field>
          ) : (
            <Field
              label={
                makingCharge.defaultBasis === "flat"
                  ? "Flat amount (₹)"
                  : makingCharge.defaultBasis === "piece"
                    ? "Rate per piece (₹)"
                    : makingCharge.defaultBasis === "carat"
                      ? "Rate per carat (₹)"
                      : "Rate per gram (₹)"
              }
            >
              <Input
                type="number"
                step="0.01"
                value={(makingCharge.defaultRatePerUnitPaise ?? 0) / 100}
                onChange={(e) =>
                  setMakingCharge({
                    defaultRatePerUnitPaise: Math.round((parseFloat(e.target.value) || 0) * 100),
                  })
                }
              />
            </Field>
          )}
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-xs font-semibold text-foreground">Category overrides</p>
          <p className="text-xs text-muted-foreground -mt-2">
            Category must match a stock item's Category field exactly (case-sensitive).
          </p>
          {Object.keys(makingCharge.categoryOverrides).length > 0 && (
            <div className="space-y-1.5">
              {Object.entries(makingCharge.categoryOverrides).map(([category, override]) => (
                <div
                  key={category}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-xs"
                >
                  <span className="font-medium">{category}</span>
                  <span className="text-muted-foreground">
                    {override.basis === "percentage"
                      ? `${override.percent ?? 0}%`
                      : `${override.basis} · ₹${((override.ratePerUnitPaise ?? 0) / 100).toFixed(2)}`}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-red-500"
                    onClick={() => removeCategoryOverride(category)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Input
                className="w-40"
                value={newOverrideCategory}
                onChange={(e) => setNewOverrideCategory(e.target.value)}
                placeholder="e.g. Bangles"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Basis</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={newOverrideBasis}
                onChange={(e) =>
                  setNewOverrideBasis(e.target.value as typeof makingCharge.defaultBasis)
                }
              >
                <option value="percentage">% of gold value</option>
                <option value="gross">Gross (₹/gram)</option>
                <option value="net">Net (₹/gram)</option>
                <option value="fine">Fine (₹/gram)</option>
                <option value="piece">Per piece</option>
                <option value="carat">Per carat</option>
                <option value="flat">Flat amount</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{newOverrideBasis === "percentage" ? "%" : "₹"}</Label>
              <Input
                className="w-28"
                type="number"
                step="0.01"
                value={newOverrideValue}
                onChange={(e) => setNewOverrideValue(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={addCategoryOverride} disabled={!newOverrideCategory.trim()}>
              Add
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-6">
        <div className="border-b border-border pb-3 space-y-0.5">
          <h3 className="text-sm font-bold text-foreground">
            TCS & Gold Payment Configuration (Manufacturing Mode)
          </h3>
          <p className="text-xs text-muted-foreground">
            Tax Collected at Source and whether GST can be settled in gold, for Customer Settlement
            / GST Invoices.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <ToggleRow
            label="Enable TCS (Tax Collected at Source)"
            value={gst.tcsEnabled}
            onChange={(v) => setGst({ tcsEnabled: v })}
          />
          <Field label="TCS Threshold (₹, per invoice)">
            <Input
              type="number"
              value={(gst.tcsThresholdPaise ?? 20000000) / 100}
              disabled={!gst.tcsEnabled}
              onChange={(e) =>
                setGst({ tcsThresholdPaise: (parseFloat(e.target.value) || 0) * 100 })
              }
            />
          </Field>
          <Field label="TCS Rate %">
            <Input
              type="number"
              step="0.1"
              value={gst.tcsRatePct ?? 1}
              disabled={!gst.tcsEnabled}
              onChange={(e) => setGst({ tcsRatePct: parseFloat(e.target.value) || 0 })}
            />
          </Field>
          <ToggleRow
            label="Allow GST Payment in Gold"
            value={gst.allowGstPaymentInGold}
            onChange={(v) => setGst({ allowGstPaymentInGold: v })}
          />
          <Field label="Gold Rate for GST Conversion (₹/g, 0 = use invoice rate)">
            <Input
              type="number"
              value={(gst.gstGoldConversionRatePaise ?? 0) / 100}
              disabled={!gst.allowGstPaymentInGold}
              onChange={(e) =>
                setGst({ gstGoldConversionRatePaise: (parseFloat(e.target.value) || 0) * 100 })
              }
            />
          </Field>
        </div>
      </Card>
    </div>
  );
}

function PurityTab() {
  const { purities, addPurity, updatePurity, removePurity } = useSettings();
  const [label, setLabel] = useState("");
  const [pm, setPm] = useState("");
  const [metal, setMetal] = useState("Gold");
  return (
    <Card className="p-5 mt-4">
      <div className="space-y-2">
        {purities.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <Input
              className="w-28"
              value={p.metal ?? "Gold"}
              aria-label={`${p.label} metal`}
              onChange={(e) => updatePurity(p.id, { metal: e.target.value })}
              placeholder="Metal"
            />
            <Input
              className="max-w-xs"
              value={p.label}
              onChange={(e) => updatePurity(p.id, { label: e.target.value })}
            />
            <Input
              className="w-32"
              type="number"
              value={p.permille}
              onChange={(e) =>
                updatePurity(p.id, { permille: parseInt(e.target.value || "0", 10) })
              }
            />
            <label className="text-xs flex items-center gap-1">
              <Switch
                checked={p.active}
                onCheckedChange={(v) => updatePurity(p.id, { active: v })}
              />{" "}
              Active
            </label>
            <Button variant="ghost" size="sm" onClick={() => removePurity(p.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2 items-end">
        <Field label="Label">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. 20K / 833"
          />
        </Field>
        <Field label="Metal">
          <Input value={metal} onChange={(e) => setMetal(e.target.value)} placeholder="Gold" />
        </Field>
        <Field label="Per-mille">
          <Input
            className="w-32"
            type="number"
            value={pm}
            onChange={(e) => setPm(e.target.value)}
          />
        </Field>
        <Button
          onClick={() => {
            if (label && pm) {
              addPurity({
                label,
                metal: metal || "Gold",
                permille: parseInt(pm, 10),
                active: true,
              });
              setLabel("");
              setPm("");
            }
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
    </Card>
  );
}

function WorkshopProcessTab() {
  const {
    workshopProcesses,
    updateWorkshopProcess,
    alloyFormulas,
    addAlloyFormula,
    updateAlloyFormula,
    removeAlloyFormula,
    purities,
  } = useSettings();
  const [fromP, setFromP] = useState("");
  const [toP, setToP] = useState("");
  const [alloyRatio, setAlloyRatio] = useState("");
  const [expLoss, setExpLoss] = useState("");

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">
          Workshop Processes — Allowed Loss &amp; Labour
        </h3>
        <div className="space-y-3">
          {workshopProcesses.map((p) => (
            <div key={p.id} className="flex flex-wrap items-end gap-3 border-b pb-3 last:border-0">
              <div className="min-w-[140px]">
                <Label className="text-xs">{p.label}</Label>
                <div className="flex items-center gap-1 mt-1">
                  <Switch
                    checked={p.active}
                    onCheckedChange={(v) => updateWorkshopProcess(p.id, { active: v })}
                  />
                  <span className="text-xs text-muted-foreground">Active</span>
                </div>
              </div>
              <Field label="Allowed Loss %">
                <Input
                  className="w-28"
                  type="number"
                  step="0.1"
                  value={p.allowedLossPct}
                  onChange={(e) =>
                    updateWorkshopProcess(p.id, {
                      allowedLossPct: parseFloat(e.target.value || "0"),
                    })
                  }
                />
              </Field>
              <Field label="Labour Method">
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={p.labourCalcMethod}
                  onChange={(e) =>
                    updateWorkshopProcess(p.id, { labourCalcMethod: e.target.value as any })
                  }
                >
                  <option value="per_gram">Per Gram</option>
                  <option value="fixed">Fixed</option>
                  <option value="per_piece">Per Piece</option>
                </select>
              </Field>
              <Field label="Labour Rate (Rs.)">
                <Input
                  className="w-28"
                  type="number"
                  value={(p.labourRatePaise / 100).toFixed(2)}
                  onChange={(e) =>
                    updateWorkshopProcess(p.id, {
                      labourRatePaise: Math.round(parseFloat(e.target.value || "0") * 100),
                    })
                  }
                />
              </Field>
              <label className="text-xs flex items-center gap-1">
                <Switch
                  checked={p.recoveryApplicable}
                  onCheckedChange={(v) => updateWorkshopProcess(p.id, { recoveryApplicable: v })}
                />
                Recovery Applicable
              </label>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Metal Conversion Formulas</h3>
        <div className="space-y-2">
          {alloyFormulas.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <Input
                className="w-24"
                value={f.metal ?? "Gold"}
                aria-label={`Formula ${f.id} metal`}
                onChange={(e) => updateAlloyFormula(f.id, { metal: e.target.value })}
              />
              <span className="text-xs w-28">
                {f.fromPurityPermille} → {f.toPurityPermille}
              </span>
              <Field label="Alloy mg / 1000mg">
                <Input
                  className="w-32"
                  type="number"
                  value={f.alloyRatioMgPer1000}
                  onChange={(e) =>
                    updateAlloyFormula(f.id, {
                      alloyRatioMgPer1000: parseInt(e.target.value || "0", 10),
                    })
                  }
                />
              </Field>
              <Field label="Expected Loss %">
                <Input
                  className="w-28"
                  type="number"
                  step="0.1"
                  value={f.expectedLossPct}
                  onChange={(e) =>
                    updateAlloyFormula(f.id, { expectedLossPct: parseFloat(e.target.value || "0") })
                  }
                />
              </Field>
              <label className="text-xs flex items-center gap-1">
                <Switch
                  checked={f.active}
                  onCheckedChange={(v) => updateAlloyFormula(f.id, { active: v })}
                />
                Active
              </label>
              <Button variant="ghost" size="sm" onClick={() => removeAlloyFormula(f.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 items-end">
          <Field label="From Purity">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm w-32"
              value={fromP}
              onChange={(e) => setFromP(e.target.value)}
            >
              <option value="">Select</option>
              {purities.map((p) => (
                <option key={p.id} value={p.permille}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="To Purity">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm w-32"
              value={toP}
              onChange={(e) => setToP(e.target.value)}
            >
              <option value="">Select</option>
              {purities.map((p) => (
                <option key={p.id} value={p.permille}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Alloy mg/1000mg">
            <Input
              className="w-32"
              type="number"
              value={alloyRatio}
              onChange={(e) => setAlloyRatio(e.target.value)}
            />
          </Field>
          <Field label="Expected Loss %">
            <Input
              className="w-28"
              type="number"
              step="0.1"
              value={expLoss}
              onChange={(e) => setExpLoss(e.target.value)}
            />
          </Field>
          <Button
            onClick={() => {
              if (fromP && toP) {
                addAlloyFormula({
                  active: true,
                  fromPurityPermille: parseInt(fromP, 10),
                  toPurityPermille: parseInt(toP, 10),
                  alloyRatioMgPer1000: parseInt(alloyRatio || "0", 10),
                  expectedLossPct: parseFloat(expLoss || "0"),
                });
                setFromP("");
                setToP("");
                setAlloyRatio("");
                setExpLoss("");
              }
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Shows next to a manual rate Field when the live provider's last-fetched
 *  snapshot has a different figure — never auto-applies, "Apply" is always
 *  an explicit click. Rendered as null (not an empty wrapper) when there's
 *  nothing to suggest, so it never affects layout when unused. */
function SuggestedRateHint({
  suggestedPaise,
  currentPaise,
  onApply,
}: {
  suggestedPaise: number | undefined;
  currentPaise: number;
  onApply: () => void;
}) {
  if (!suggestedPaise || suggestedPaise === currentPaise) return null;
  return (
    <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
      <span>Live: ₹{(suggestedPaise / 100).toLocaleString("en-IN")}</span>
      <button
        type="button"
        onClick={onApply}
        className="underline underline-offset-2 hover:text-emerald-500"
      >
        Apply
      </button>
    </div>
  );
}

function RatesTab() {
  const {
    goldRatePerGramPaise,
    goldRate24KPerGramPaise,
    goldRate18KPerGramPaise,
    silverRatePerGramPaise,
    setGoldRate,
    setGoldRate24K,
    setGoldRate18K,
    setSilverRate,
    selectedBranchId,
    getBranchSettings,
    setBranchSettings,
    branches,
    bullionRateProvider,
    setBullionRateProvider,
  } = useSettings();
  const { roles, ready } = useRoles();
  const isAuthorized = ready && (roles.includes("owner") || roles.includes("manager"));

  const activeBranchId = selectedBranchId || "MAIN";
  const rateSource = getBranchSettings(activeBranchId).goldRateSource ?? "manual";
  const branchOverride = getBranchSettings(activeBranchId);
  const { snapshot, status, lastError, fetchNow, applyFetchedRates } = useBullionRate();

  const autoFillFrom24K = (val24: number) => {
    if (!isNaN(val24) && val24 >= 0) {
      setGoldRate24K(Math.round(val24 * 100));
      // Suggest/calculate 22K (91.6%) and 18K (75%)
      setGoldRate(Math.round(val24 * 0.916 * 100));
      setGoldRate18K(Math.round(val24 * 0.75 * 100));
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Rate Source: </span>
          <span className="font-semibold">
            {rateSource === "api" ? "Live API" : "Manual (set daily)"}
          </span>
          <Link
            to="/settings/branch-settings"
            className="ml-2 text-xs text-gold underline underline-offset-2"
          >
            Change in Branch Settings
          </Link>
        </div>
        {rateSource === "api" && (
          <div className="flex items-center gap-3 text-xs">
            {snapshot && (
              <span className="text-muted-foreground">
                Last updated {Math.max(0, Math.round((Date.now() - snapshot.fetchedAt) / 60000))}m
                ago
              </span>
            )}
            {status === "error" && lastError && (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {lastError}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={status === "fetching"}
              onClick={() => void fetchNow()}
            >
              {status === "fetching" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              Fetch Now
            </Button>
            {snapshot && (
              <Button size="sm" className="bg-gold text-black" onClick={applyFetchedRates}>
                Apply All
              </Button>
            )}
          </div>
        )}
      </Card>

      {rateSource === "api" && (
        <Card className="p-5 grid md:grid-cols-2 gap-4">
          <div className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold -mb-2">
            Live Rate Provider
          </div>
          <Field label="API URL">
            <Input
              placeholder="https://your-provider.example.com/v1/rates"
              value={bullionRateProvider.httpProvider.apiUrl}
              onChange={(e) =>
                setBullionRateProvider({
                  httpProvider: { ...bullionRateProvider.httpProvider, apiUrl: e.target.value },
                })
              }
              disabled={!isAuthorized}
            />
          </Field>
          <Field label="API Key (optional)">
            <Input
              type="password"
              value={bullionRateProvider.httpProvider.apiKey ?? ""}
              onChange={(e) =>
                setBullionRateProvider({
                  httpProvider: { ...bullionRateProvider.httpProvider, apiKey: e.target.value },
                })
              }
              disabled={!isAuthorized}
            />
          </Field>
          <Field label="Response Path — 24K rate (₹/g)">
            <Input
              placeholder="e.g. data.gold.xau24kInrPerGram"
              value={bullionRateProvider.httpProvider.responsePaths.gold24K}
              onChange={(e) =>
                setBullionRateProvider({
                  httpProvider: {
                    ...bullionRateProvider.httpProvider,
                    responsePaths: {
                      ...bullionRateProvider.httpProvider.responsePaths,
                      gold24K: e.target.value,
                    },
                  },
                })
              }
              disabled={!isAuthorized}
            />
          </Field>
          <Field label="Refresh Every (minutes)">
            <Input
              type="number"
              min="5"
              value={bullionRateProvider.refreshIntervalMinutes}
              onChange={(e) =>
                setBullionRateProvider({
                  refreshIntervalMinutes: Math.max(5, parseInt(e.target.value || "60", 10)),
                })
              }
              disabled={!isAuthorized}
            />
          </Field>
          <p className="col-span-2 text-[11px] text-muted-foreground">
            22K and 18K are auto-derived (91.6% / 75% of the 24K figure) unless you map their own
            response paths — most feeds only quote 24K/fine gold. Fetched rates only take effect
            when you click Apply; they never overwrite a manual entry silently.
          </p>
        </Card>
      )}

      <Card className="p-5 grid md:grid-cols-2 gap-4">
        <Field label="Gold Rate (24K / 999) ₹ / gram">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={goldRate24KPerGramPaise > 0 ? (goldRate24KPerGramPaise / 100).toString() : ""}
            placeholder={
              goldRatePerGramPaise > 0
                ? Math.round(goldRatePerGramPaise / 0.916 / 100).toString()
                : "0"
            }
            onChange={(e) => {
              const val = parseFloat(e.target.value || "0");
              autoFillFrom24K(val);
            }}
            disabled={!isAuthorized}
          />
          <SuggestedRateHint
            suggestedPaise={snapshot?.gold24KPerGramPaise}
            currentPaise={goldRate24KPerGramPaise}
            onApply={() => snapshot && setGoldRate24K(snapshot.gold24KPerGramPaise)}
          />
        </Field>
        <Field label="Gold Rate (22K / 916 Reference) ₹ / gram">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={goldRatePerGramPaise > 0 ? (goldRatePerGramPaise / 100).toString() : ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value || "0");
              if (!isNaN(val) && val >= 0) {
                setGoldRate(Math.round(val * 100));
              }
            }}
            disabled={!isAuthorized}
          />
          <SuggestedRateHint
            suggestedPaise={snapshot?.gold22KPerGramPaise}
            currentPaise={goldRatePerGramPaise}
            onApply={() => snapshot && setGoldRate(snapshot.gold22KPerGramPaise)}
          />
        </Field>
        <Field label="Gold Rate (18K / 750) ₹ / gram">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={goldRate18KPerGramPaise > 0 ? (goldRate18KPerGramPaise / 100).toString() : ""}
            placeholder={
              goldRatePerGramPaise > 0
                ? Math.round(((goldRatePerGramPaise / 0.916) * 0.75) / 100).toString()
                : "0"
            }
            onChange={(e) => {
              const val = parseFloat(e.target.value || "0");
              if (!isNaN(val) && val >= 0) {
                setGoldRate18K(Math.round(val * 100));
              }
            }}
            disabled={!isAuthorized}
          />
          <SuggestedRateHint
            suggestedPaise={snapshot?.gold18KPerGramPaise}
            currentPaise={goldRate18KPerGramPaise}
            onApply={() => snapshot && setGoldRate18K(snapshot.gold18KPerGramPaise)}
          />
        </Field>
        <Field label="Silver Rate ₹ / gram">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={silverRatePerGramPaise > 0 ? (silverRatePerGramPaise / 100).toString() : ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value || "0");
              if (!isNaN(val) && val >= 0) {
                setSilverRate(Math.round(val * 100));
              }
            }}
            disabled={!isAuthorized}
          />
          <SuggestedRateHint
            suggestedPaise={snapshot?.silverPerGramPaise}
            currentPaise={silverRatePerGramPaise}
            onApply={() => snapshot && setSilverRate(snapshot.silverPerGramPaise)}
          />
        </Field>
        {!isAuthorized && ready && (
          <p className="col-span-2 text-xs text-red-500 font-semibold mt-1">
            Only owners or managers can modify gold and silver rates.
          </p>
        )}
      </Card>

      {branches.length > 1 && (
        <Card className="p-5 grid md:grid-cols-2 gap-4">
          <div className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold -mb-2">
            Branch Rate Override —{" "}
            {branches.find((b) => b.id === activeBranchId)?.name ?? activeBranchId}
          </div>
          <p className="col-span-2 text-[11px] text-muted-foreground -mt-2">
            Leave blank to use the firm-wide rate above for this branch.
          </p>
          {(
            [
              ["24K / 999", "goldRate24KOverridePaise"],
              ["22K / 916", "goldRate22KOverridePaise"],
              ["18K / 750", "goldRate18KOverridePaise"],
              ["Silver", "silverRateOverridePaise"],
            ] as const
          ).map(([label, field]) => (
            <Field key={field} label={`${label} Override ₹ / gram`}>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={
                  branchOverride[field] && branchOverride[field]! > 0
                    ? (branchOverride[field]! / 100).toString()
                    : ""
                }
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  const val = raw === "" ? undefined : Math.round(parseFloat(raw) * 100);
                  setBranchSettings(activeBranchId, { [field]: val && val > 0 ? val : undefined });
                }}
                disabled={!isAuthorized}
              />
            </Field>
          ))}
        </Card>
      )}
    </div>
  );
}

function MakingTab() {
  const { making, addMaking, updateMaking, removeMaking } = useSettings();
  const [draft, setDraft] = useState({
    category: "Ring",
    purity: "22K / 916",
    type: "per_gram" as const,
    ratePerGramPaise: 0,
    fixedPaise: 0,
    notes: "",
  });
  return (
    <Card className="p-5 mt-4">
      {making.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No making charge templates yet. Add one below.
        </div>
      ) : (
        <div className="space-y-2">
          {making.map((m) => (
            <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
              <Input
                className="col-span-2"
                value={m.category}
                onChange={(e) => updateMaking(m.id, { category: e.target.value })}
              />
              <Input
                className="col-span-2"
                value={m.purity}
                onChange={(e) => updateMaking(m.id, { purity: e.target.value })}
              />
              <select
                className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={m.type}
                onChange={(e) => updateMaking(m.id, { type: e.target.value as "per_gram" })}
              >
                <option value="per_gram">Per gram</option>
                <option value="fixed">Fixed</option>
              </select>
              <Input
                className="col-span-2"
                type="number"
                value={(m.ratePerGramPaise / 100).toString()}
                onChange={(e) =>
                  updateMaking(m.id, {
                    ratePerGramPaise: Math.round(parseFloat(e.target.value || "0") * 100),
                  })
                }
                placeholder="₹/g"
              />
              <Input
                className="col-span-2"
                type="number"
                value={(m.fixedPaise / 100).toString()}
                onChange={(e) =>
                  updateMaking(m.id, {
                    fixedPaise: Math.round(parseFloat(e.target.value || "0") * 100),
                  })
                }
                placeholder="Fixed ₹"
              />
              <Button
                className="col-span-2"
                variant="ghost"
                size="sm"
                onClick={() => removeMaking(m.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 grid grid-cols-12 gap-2 items-end">
        <div className="col-span-2">
          <Field label="Category">
            <Input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Purity">
            <Input
              value={draft.purity}
              onChange={(e) => setDraft({ ...draft, purity: e.target.value })}
            />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Type">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as "per_gram" })}
            >
              <option value="per_gram">Per gram</option>
              <option value="fixed">Fixed</option>
            </select>
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="₹ / g">
            <Input
              type="number"
              value={(draft.ratePerGramPaise / 100).toString()}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  ratePerGramPaise: Math.round(parseFloat(e.target.value || "0") * 100),
                })
              }
            />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Fixed ₹">
            <Input
              type="number"
              value={(draft.fixedPaise / 100).toString()}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  fixedPaise: Math.round(parseFloat(e.target.value || "0") * 100),
                })
              }
            />
          </Field>
        </div>
        <Button className="col-span-2" onClick={() => addMaking(draft)}>
          <Plus className="h-4 w-4 mr-1" /> Add Template
        </Button>
      </div>
    </Card>
  );
}

function HardwareTab() {
  const { hardware, setHardware } = useSettings();
  const [currentReading, setCurrentReading] = useState<{
    weightGrams: number;
    isStable: boolean;
    rawString: string;
  } | null>(null);
  const [isScaleConnected, setIsScaleConnected] = useState(false);
  const [testBarcode, setTestBarcode] = useState("");

  useEffect(() => {
    const unsubScale = hardwareService.onScaleReading((reading) => {
      setCurrentReading(reading);
    });
    const unsubBarcode = hardwareService.onBarcodeScanned((barcode) => {
      setTestBarcode(barcode);
    });
    return () => {
      unsubScale();
      unsubBarcode();
    };
  }, []);

  const handleConnectScale = async () => {
    const success = await hardwareService.connectPhysicalScale();
    if (success) {
      setIsScaleConnected(true);
      toast.success("Precision Weighing Scale Connected");
    } else {
      toast.error(
        "Failed to connect. Please check USB cable, Baud Rate, and browser WebSerial permissions.",
      );
    }
  };

  const handleDisconnectScale = async () => {
    await hardwareService.disconnectPhysicalScale();
    setIsScaleConnected(false);
    setCurrentReading(null);
    toast.success("Weighing Scale Disconnected");
  };

  return (
    <Card className="p-6 mt-4 space-y-6">
      <HardwareDevicesRegistry />
      <div>
        <h3 className="font-serif text-lg text-gold font-bold">Hardware Connectivity Hub</h3>
        <p className="text-xs text-muted-foreground">
          Configure actual retail hardware devices: Weighing scales, laser barcode scanners, and tag
          printers.
        </p>
      </div>

      {/* Device status — which hardware is active vs still in development. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            { name: "Printer", active: true },
            { name: "Thermal Printer", active: true },
            { name: "Camera QR Scanner", active: true },
            { name: "Scale", active: false },
            { name: "Barcode Scanner", active: false },
            { name: "Label Printer", active: false },
          ] as const
        ).map((d) => (
          <div
            key={d.name}
            className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
          >
            <span className="text-sm font-medium">{d.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                d.active
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {d.active ? "Active" : "Not configured"}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Printers and Scanners Section */}
        <div className="space-y-4 border-r border-border/40 pr-0 md:pr-6">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Printers & Barcode Scanner
          </h4>

          <ToggleRow
            label="Enable USB Barcode Laser Scanner"
            value={hardware.scannerEnabled}
            onChange={(v) => setHardware({ scannerEnabled: v })}
          />
          <ToggleRow
            label="Focus scan field on pressing F2"
            value={hardware.f2FocusScanner}
            onChange={(v) => setHardware({ f2FocusScanner: v })}
          />

          <Field label="Barcode & Tag Printer Name">
            <Input
              value={hardware.printerLabel}
              onChange={(e) => setHardware({ printerLabel: e.target.value })}
              placeholder="e.g. TSC TTP-244 Pro, Zebra GC420t"
            />
          </Field>

          <Field label="Jewellery Label Dimensions">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-gold"
              value={hardware.labelSize}
              onChange={(e) => setHardware({ labelSize: e.target.value as "40x25" })}
            >
              <option value="40x25">40 × 25 mm (Portrait Tag)</option>
              <option value="50x25">50 × 25 mm (Landscape Tag)</option>
            </select>
          </Field>

          <Field label="Print Command Protocol">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-gold"
              value={hardware.browserPrintMode}
              onChange={(e) => setHardware({ browserPrintMode: e.target.value as "dialog" })}
            >
              <option value="dialog">Browser Print Engine (Clean HTML Templates)</option>
              <option value="silent_placeholder">Direct TSPL / ZPL Command Stream</option>
            </select>
          </Field>

          {/* Live Scanner Test */}
          <div className="rounded-md border border-border/50 bg-muted/20 p-3.5 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Laser Scanner Live Signal Test
            </span>
            <div className="bg-background border border-border px-3 py-2 rounded-lg font-mono text-xs text-foreground min-h-[40px] flex items-center justify-between">
              <span>
                {testBarcode
                  ? `Scanned: "${testBarcode}"`
                  : "Please scan any barcode/HUID label..."}
              </span>
              {testBarcode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={() => setTestBarcode("")}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Digital Weighing Scale Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Precision Weighing Scale
          </h4>

          <Field label="Connection Profile">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-gold"
              value={hardware.scaleMode}
              onChange={(e) =>
                setHardware({ scaleMode: e.target.value as "simulation" | "webserial" })
              }
            >
              <option value="simulation">Software Emulator (For Sandbox Testing)</option>
              <option value="webserial">Physical Scale (Direct WebSerial API)</option>
            </select>
          </Field>

          <Field label="Baud Rate (BPS)">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-gold"
              value={hardware.scaleBaudRate}
              onChange={(e) => setHardware({ scaleBaudRate: Number(e.target.value) })}
            >
              <option value="1200">1200 bps</option>
              <option value="2400">2400 bps</option>
              <option value="4800">4800 bps</option>
              <option value="9600">9600 bps (Standard)</option>
              <option value="19200">19200 bps</option>
              <option value="38400">38400 bps</option>
              <option value="115200">115200 bps</option>
            </select>
          </Field>

          <ToggleRow
            label="Auto-populate weight on billing and catalog"
            value={hardware.autoPopulateWeight}
            onChange={(v) => setHardware({ autoPopulateWeight: v })}
          />

          {/* WebSerial Scale Connection Action */}
          {hardware.scaleMode === "webserial" && (
            <div className="flex gap-2">
              {!isScaleConnected ? (
                <Button
                  onClick={handleConnectScale}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10"
                >
                  Connect Physical Scale
                </Button>
              ) : (
                <Button
                  onClick={handleDisconnectScale}
                  variant="destructive"
                  className="w-full font-bold h-10"
                >
                  Disconnect Scale
                </Button>
              )}
            </div>
          )}

          {/* Scale telemetry visualizer */}
          <div className="rounded-md border border-gold/30 bg-gold/5 p-4 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold">
              Scale Telemetry Diagnostics
            </span>

            <div className="bg-black/90 p-4 rounded-md border border-emerald-500/40 flex items-center justify-between font-mono">
              <div className="flex flex-col">
                <span className="text-[9px] text-emerald-500/60 uppercase font-bold tracking-wider">
                  {currentReading
                    ? currentReading.isStable
                      ? "STABLE (ST)"
                      : "UNSTABLE (US)"
                    : "OFFLINE / DISCONNECTED"}
                </span>
                <span className="text-3xl text-emerald-400 font-bold tracking-widest mt-1">
                  {currentReading ? currentReading.weightGrams.toFixed(3) : "0.000"}
                </span>
              </div>
              <div className="flex flex-col items-end justify-between h-12">
                <span className="text-lg text-emerald-400 font-bold">g</span>
                <span
                  className={`h-3.5 w-3.5 rounded-full ${
                    currentReading
                      ? currentReading.isStable
                        ? "bg-emerald-500 shadow-lg shadow-emerald-500/50"
                        : "bg-amber-500 animate-ping"
                      : "bg-slate-700"
                  }`}
                />
              </div>
            </div>

            {currentReading?.rawString && (
              <div className="text-[10px] text-muted-foreground font-mono truncate px-1">
                Raw string: "{currentReading.rawString}"
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cash Drawer Section */}
      <div className="space-y-4 border-t border-border/40 pt-6">
        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Cash Drawer
        </h4>

        <ToggleRow
          label="Enable cash drawer"
          value={hardware.cashDrawerEnabled}
          onChange={(v) => setHardware({ cashDrawerEnabled: v })}
        />

        {hardware.cashDrawerEnabled && (
          <>
            <ToggleRow
              label="Auto-open after a fully-cash payment"
              value={hardware.cashDrawerAutoOpenOnCash}
              onChange={(v) => setHardware({ cashDrawerAutoOpenOnCash: v })}
            />

            <Field label="ESC/POS Kick Command (hex bytes)">
              <Input
                value={hardware.cashDrawerEscPosCommand}
                onChange={(e) => setHardware({ cashDrawerEscPosCommand: e.target.value })}
                placeholder="1B 70 00 19 FA"
                className="font-mono"
              />
            </Field>

            <div className="flex items-center gap-3">
              <CashDrawerButton />
              <span className="text-xs text-muted-foreground">
                Test the drawer — same action as the manual button on the Billing screen.
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function CatalogTab() {
  const { catalog, setCatalog } = useSettings();
  return (
    <Card className="p-5 grid md:grid-cols-2 gap-4 mt-4">
      <Field label="Categories (comma)">
        <Input
          value={catalog.categories.join(", ")}
          onChange={(e) =>
            setCatalog({
              categories: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        />
      </Field>
      <Field label="Tags (comma)">
        <Input
          value={catalog.tags.join(", ")}
          onChange={(e) =>
            setCatalog({
              tags: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        />
      </Field>
      <Field label="Default purity">
        <Input
          value={catalog.defaultPurity}
          onChange={(e) => setCatalog({ defaultPurity: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Default min weight (g)">
          <Input
            type="number"
            value={catalog.defaultWeightMinG}
            onChange={(e) => setCatalog({ defaultWeightMinG: parseFloat(e.target.value || "0") })}
          />
        </Field>
        <Field label="Default max weight (g)">
          <Input
            type="number"
            value={catalog.defaultWeightMaxG}
            onChange={(e) => setCatalog({ defaultWeightMaxG: parseFloat(e.target.value || "0") })}
          />
        </Field>
      </div>
    </Card>
  );
}

function DropdownsTab() {
  const {
    dropdowns,
    disabledDropdowns,
    setDropdown,
    addDropdownItem,
    removeDropdownItem,
    renameDropdownItem,
    setDropdownItemDisabled,
  } = useSettings();
  return (
    <Card className="p-5 mt-4 space-y-5">
      <p className="text-xs text-muted-foreground">
        Disable retires a value: it stops being offered on new records, but orders and job cards
        that already use it keep reading correctly. Delete removes it outright — only safe for a
        value nothing has used yet.
      </p>
      {(Object.keys(dropdowns) as DropdownKey[]).map((k) => (
        <DropdownEditor
          key={k}
          label={DROPDOWN_LABELS[k]}
          values={dropdowns[k]}
          disabled={disabledDropdowns[k] ?? []}
          onAdd={(v) => addDropdownItem(k, v)}
          onRemove={(v) => removeDropdownItem(k, v)}
          onRename={(from, to) => renameDropdownItem(k, from, to)}
          onToggleDisabled={(v, off) => setDropdownItemDisabled(k, v, off)}
          onReorder={(vals) => setDropdown(k, vals)}
        />
      ))}
    </Card>
  );
}

function DropdownEditor({
  label,
  values,
  disabled,
  onAdd,
  onRemove,
  onRename,
  onToggleDisabled,
}: {
  label: string;
  values: string[];
  disabled: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  onRename: (from: string, to: string) => void;
  onToggleDisabled: (v: string, disabled: boolean) => void;
  onReorder: (v: string[]) => void;
}) {
  const [v, setV] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function commitRename() {
    if (editing) onRename(editing, draft);
    setEditing(null);
    setDraft("");
  }

  return (
    <div>
      <div className="font-medium text-sm mb-2">{label}</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((x) => {
          const isOff = disabled.includes(x);
          if (editing === x) {
            return (
              <span key={x} className="flex items-center gap-1">
                <Input
                  autoFocus
                  className="h-7 w-40 text-xs"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
              </span>
            );
          }
          return (
            <Badge
              key={x}
              variant={isOff ? "outline" : "secondary"}
              className={`gap-1.5 ${isOff ? "opacity-50 line-through" : ""}`}
            >
              <button
                onClick={() => {
                  setEditing(x);
                  setDraft(x);
                }}
                title="Rename"
              >
                {x}
              </button>
              <button
                onClick={() => onToggleDisabled(x, !isOff)}
                className="hover:text-gold"
                title={isOff ? "Enable" : "Disable"}
                aria-label={isOff ? "Enable" : "Disable"}
              >
                {isOff ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
              <button
                onClick={() => onRemove(x)}
                className="hover:text-destructive"
                aria-label="Delete"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground">No values yet.</span>
        )}
      </div>
      <div className="flex gap-2 max-w-md">
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Add value…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd(v);
              setV("");
            }
          }}
        />
        <Button
          size="sm"
          onClick={() => {
            onAdd(v);
            setV("");
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function LanguageTab() {
  const { language, setLanguage } = useSettings();
  const { t, setLanguage: setAppLanguage } = useLanguage();
  return (
    <Card className="p-5 grid md:grid-cols-2 gap-4 mt-4">
      <div className="md:col-span-2 text-sm text-muted-foreground">
        {t("settings.languageTabDesc")}
      </div>
      <div className="md:col-span-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ALL_LANGUAGES.map((code) => (
          <div key={code} className="rounded-md border border-border bg-muted/20 p-3">
            <div className="font-medium">{LANGUAGE_INFO[code].native}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {LANGUAGE_INFO[code].coveragePct}% {t("settings.localizedCoverage")}
            </div>
          </div>
        ))}
      </div>
      <Field label={t("settings.appPanelLanguage")}>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
          value={language.appLanguage}
          onChange={(e) => {
            const val = e.target.value as "en" | "mr" | "hi" | "bn";
            setAppLanguage(val);
          }}
        >
          <LanguageOptions />
        </select>
      </Field>
      <Field label={t("settings.receiptPrintLanguage")}>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
          value={language.printLanguage}
          onChange={(e) =>
            setLanguage({ printLanguage: e.target.value as "en" | "mr" | "hi" | "bn" })
          }
        >
          <LanguageOptions />
        </select>
      </Field>
      <Field label={t("settings.whatsAppDispatchLanguage")}>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
          value={language.whatsappLanguage}
          onChange={(e) =>
            setLanguage({ whatsappLanguage: e.target.value as "en" | "mr" | "hi" | "bn" })
          }
        >
          <LanguageOptions />
        </select>
      </Field>
      <Field label={t("settings.staffMemberLanguage")}>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
          value={language.staffLanguage}
          onChange={(e) =>
            setLanguage({ staffLanguage: e.target.value as "en" | "mr" | "hi" | "bn" })
          }
        >
          <LanguageOptions />
        </select>
      </Field>
    </Card>
  );
}

function LanguageOptions() {
  return ALL_LANGUAGES.map((code: LanguageCode) => (
    <option key={code} value={code}>
      {LANGUAGE_INFO[code].native}
    </option>
  ));
}

function EmailTab() {
  const { smtp, setSmtp } = useSettings();
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const handleSave = () => {
    toast.success("SMTP and Email integration settings saved successfully!");
  };

  const handleSendTest = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Please enter a valid test recipient email.");
      return;
    }
    setSendingTest(true);
    try {
      // Route directly to the dedicated SMTP test/send backend (Nodemailer-based,
      // no deno.land dependency) so the real dispatch error is surfaced instead
      // of a generic "diagnostic failure" toast.
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmail,
        },
      });

      if (error) {
        const msg = await extractEdgeFunctionError(error, "SMTP diagnostics dispatch failed.");
        toast.error(msg);
        console.error("[SMTP Diagnostics Test] Edge function error:", msg);
        return;
      }

      if (data?.success) {
        toast.success(`Diagnostic test email dispatched successfully to ${testEmail}!`);
      } else {
        const msg = data?.error || "SMTP diagnostics dispatch failed.";
        toast.error(msg);
        console.error("[SMTP Diagnostics Test] Dispatch failed:", msg);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      toast.error(`Test failed: ${msg}`);
      console.error("[SMTP Diagnostics Test] Unexpected exception:", e);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-5 grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2 flex items-center gap-2 border-b border-border pb-3 mb-2">
          <Mail className="h-5 w-5 text-gold" />
          <div>
            <h3 className="font-serif text-lg text-gold">Email Delivery & SMTP Integration</h3>
            <p className="text-xs text-muted-foreground">
              Configure SMTP servers or dedicated APIs (Resend, SendGrid, Supabase) to enable fully
              automated transactional job card, invoice, and receipt delivery.
            </p>
          </div>
        </div>

        <Field label="API Integration / Delivery Provider">
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
            value={smtp.apiProvider}
            onChange={(e) =>
              setSmtp({
                apiProvider: e.target.value as "smtp",
              })
            }
          >
            <option value="smtp">Standard SMTP Mail Server (SSL/TLS)</option>
          </select>
        </Field>

        <Field label="From Display Name">
          <Input
            value={smtp.fromName}
            onChange={(e) => setSmtp({ fromName: e.target.value })}
            placeholder="e.g. Maa Tara Jewellers"
          />
        </Field>

        <Field label="From Email Address (Sender identity)">
          <Input
            value={smtp.fromEmail}
            onChange={(e) => setSmtp({ fromEmail: e.target.value })}
            placeholder="e.g. notifications@maatarajewellers.com"
          />
        </Field>

        {smtp.apiProvider === "smtp" ? (
          <>
            <Field label="SMTP Server Hostname">
              <Input
                value={smtp.host}
                onChange={(e) => setSmtp({ host: e.target.value })}
                placeholder="e.g. smtp.gmail.com"
              />
            </Field>

            <Field label="SMTP Server Port">
              <Input
                type="number"
                value={smtp.port}
                onChange={(e) => setSmtp({ port: parseInt(e.target.value) || 587 })}
                placeholder="e.g. 587"
              />
            </Field>

            <Field label="SMTP Authentication Username">
              <Input
                value={smtp.username}
                onChange={(e) => setSmtp({ username: e.target.value })}
                placeholder="e.g. smtp-user@yourfirm.com"
              />
            </Field>

            <Field label="SMTP Authentication Password / App Key">
              <Input
                type="password"
                value={smtp.passKey}
                onChange={(e) => setSmtp({ passKey: e.target.value })}
                placeholder="••••••••••••••••"
              />
            </Field>

            <div className="flex items-center gap-2 py-3">
              <Switch
                checked={smtp.useSsl}
                onCheckedChange={(checked) => setSmtp({ useSsl: checked })}
              />
              <span className="text-sm font-medium">Use Secure Connection (SSL / TLS)</span>
            </div>
          </>
        ) : null}

        <div className="md:col-span-2 flex justify-end gap-2 pt-3 border-t border-border">
          <Button
            onClick={handleSave}
            className="bg-gold hover:bg-gold-600 text-slate-950 font-semibold gap-2"
          >
            <Save className="h-4 w-4" /> Save Settings
          </Button>
        </div>
      </Card>

      <Card className="p-5 border border-amber-500/10 bg-amber-500/5">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-4 w-4 text-amber-500" />
          <h4 className="font-semibold text-sm text-amber-400">Diagnostic Delivery Verification</h4>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Send a verification test email using your currently active integration settings to verify
          server and secret credentials.
        </p>
        <div className="flex gap-2 max-w-md">
          <Input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter test recipient email address"
            className="text-xs"
          />
          <Button
            size="sm"
            onClick={handleSendTest}
            disabled={sendingTest || !testEmail}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
          >
            {sendingTest ? "Sending Test..." : "Send Test"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function BackupTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string>("");
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const { roles, email: currentEmail } = useCan();
  const canClearLocalData = roles.includes("super_owner") || roles.includes("owner");
  const [passwordGateOpen, setPasswordGateOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState("");
  const [clearPasswordError, setClearPasswordError] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const verifyAdminPasswordAndProceed = async () => {
    if (!currentEmail) {
      setClearPasswordError("No signed-in admin session found.");
      return;
    }
    setVerifyingPassword(true);
    setClearPasswordError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: clearPassword,
    });
    setVerifyingPassword(false);
    if (error) {
      setClearPasswordError("Incorrect password. Try again.");
      return;
    }
    setPasswordGateOpen(false);
    setClearPassword("");
    setClearConfirmOpen(true);
  };

  const handleExport = () => {
    void exportPilotData();
    setMsg("Browser-local ERP backup has been retired. Use Supabase Backup & Disaster Recovery.");
  };

  const runRestore = async (file: File) => {
    const text = await file.text();
    const res = importPilotData(text);
    if (res.ok) {
      setMsg(`Restored ${res.restored.length} stores. Reloading...`);
      setTimeout(() => window.location.reload(), 800);
    } else {
      setMsg(`Import failed: ${res.error}`);
    }
  };

  return (
    <Card className="p-5 mt-4 space-y-4">
      <div className="text-sm">
        Production backup and restore must run through Supabase-controlled recovery workflows.
        Browser-local ERP backup/import is retired; this page only keeps local cache cleanup tools
        for troubleshooting. Use{" "}
        <Link to="/settings/backup-recovery" className="underline text-gold">
          Backup &amp; Disaster Recovery
        </Link>
        .
      </div>
      <div className="flex flex-wrap gap-2">
        <Button data-testid="settings-export-backup" variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1.5" /> Browser Export Retired
        </Button>
        <Button variant="outline" asChild>
          <Link to="/settings/backup-recovery">
            <Upload className="h-4 w-4 mr-1.5" /> Open Supabase Recovery
          </Link>
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPendingRestoreFile(f);
            e.target.value = "";
          }}
        />
        {canClearLocalData && (
          <Button
            variant="destructive"
            onClick={() => {
              setClearPassword("");
              setClearPasswordError("");
              setPasswordGateOpen(true);
            }}
          >
            <Lock className="h-4 w-4 mr-1.5" /> Clear Browser Cache
          </Button>
        )}
      </div>
      {msg && <div className="text-sm text-muted-foreground">{msg}</div>}

      <AlertDialog
        open={!!pendingRestoreFile}
        onOpenChange={(o) => !o && setPendingRestoreFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Browser import retired</AlertDialogTitle>
            <AlertDialogDescription>
              Browser-local ERP restore is retired. The selected file{" "}
              <strong>{pendingRestoreFile?.name}</strong> will only be checked so the screen can
              explain the supported Supabase recovery path.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRestoreFile) runRestore(pendingRestoreFile);
                setPendingRestoreFile(null);
              }}
            >
              Check file
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={passwordGateOpen}
        onOpenChange={(o) => {
          setPasswordGateOpen(o);
          if (!o) {
            setClearPassword("");
            setClearPasswordError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-gold" /> Admin password required
            </AlertDialogTitle>
            <AlertDialogDescription>
              This is a developer/troubleshooting tool restricted to Owner / Super Owner. Re-enter
              your account password ({currentEmail}) to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="clear-data-password">Password</Label>
            <Input
              id="clear-data-password"
              type="password"
              autoFocus
              value={clearPassword}
              onChange={(e) => setClearPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && clearPassword && !verifyingPassword) {
                  void verifyAdminPasswordAndProceed();
                }
              }}
              placeholder="Enter your account password"
            />
            {clearPasswordError && <p className="text-xs text-red-500">{clearPasswordError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={() => void verifyAdminPasswordAndProceed()}
              disabled={!clearPassword || verifyingPassword}
            >
              {verifyingPassword ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-1.5" />
              )}
              Verify &amp; Continue
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear browser cache?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete obsolete local cache residue on this device. Supabase
              production data is not affected. This cannot be undone. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setClearConfirmOpen(false);
                setMsg("Clearing browser cache residue...");
                void clearBrowserSessionResidue().then(() => {
                  setMsg("Browser cache cleared. Reloading...");
                  setTimeout(() => window.location.reload(), 500);
                });
              }}
            >
              Clear Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function AboutTab() {
  const branding = useSettings((s) => s.branding);
  const branches = useSettings((s) => s.branches);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const currentBranch = branches.find((b) => b.id === selectedBranchId);
  const [desktopVersion, setDesktopVersion] = useState<string | null>(null);

  useEffect(() => {
    const desktop = (window as any).mtjDesktop;
    if (desktop?.getVersion) {
      desktop
        .getVersion()
        .then(setDesktopVersion)
        .catch(() => {});
    }
  }, []);

  return (
    <Card className="p-6 max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <Logo variant="svg" className="h-14 w-14 object-contain" />
        <div>
          <div className="font-serif text-xl text-gold">{branding.applicationName || APP_NAME}</div>
          <div className="text-xs text-muted-foreground">
            {branding.description || APP_DESCRIPTION}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
        <div className="text-muted-foreground">Version</div>
        <div className="font-mono text-right">{APP_VERSION}</div>

        {desktopVersion && (
          <>
            <div className="text-muted-foreground">Desktop Build</div>
            <div className="font-mono text-right">{desktopVersion}</div>
          </>
        )}

        <div className="text-muted-foreground">Company</div>
        <div className="text-right">{branding.companyName || COMPANY_NAME}</div>

        <div className="text-muted-foreground">Copyright</div>
        <div className="text-right">
          © {new Date().getFullYear()} {branding.companyName || COMPANY_NAME}
        </div>

        <div className="text-muted-foreground">Support</div>
        <div className="text-right">{branding.supportEmail || branding.supportPhone || "—"}</div>

        <div className="text-muted-foreground">Website</div>
        <div className="text-right">{branding.website || "—"}</div>
        <ConnectedDatabaseSummary />

        <div className="text-muted-foreground">Current Branch</div>
        <div className="text-right">{currentBranch?.name ?? selectedBranchId ?? "—"}</div>

        <div className="text-muted-foreground">Installation</div>
        <div className="text-right">
          {(window as any).mtjDesktop ? "Desktop (Electron)" : "Web"}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
        {branding.tagline || APP_TAGLINE}
      </p>
    </Card>
  );
}

function ConnectedDatabaseSummary() {
  const { status } = useDbStatus();
  return (
    <>
      <div className="text-muted-foreground">Database Status</div>
      <div className="text-right">{getDbStatusLabel(status)}</div>

      <div className="text-muted-foreground">Data Source</div>
      <div className="text-right">Supabase Online</div>
    </>
  );
}

function DbTab() {
  return <DbStatusPanel />;
}

function DbStatusPanel() {
  const { status, email, userId, lastMigrationAt } = useDbStatus();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);

  // Load this user's roles when signed in
  useEffect(() => {
    if (!userId) {
      setRoles([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!cancelled && data) setRoles(data.map((r) => r.role as string));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleAuth() {
    setBusy(true);
    try {
      const { error } =
        authMode === "signin"
          ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPass })
          : await supabase.auth.signUp({
              email: authEmail,
              password: authPass,
              options: { emailRedirectTo: getAuthRedirectUrl("/auth/callback") },
            });
      if (error) toast.error(error.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in/sign-up failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleMigrate() {
    toast.info(
      "Local pilot migration is retired. Supabase is already the production source of truth; use Backup & Disaster Recovery for restore operations.",
    );
  }

  return (
    <div data-testid="database-status-root" className="space-y-4 mt-4">
      <Card className="p-5 space-y-3 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Database className="h-4 w-4" /> Database Status
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground mb-1">Supabase Connection</div>
            <Badge
              variant="outline"
              className={
                status === "connected_authed"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : status === "connected_anon"
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-red-500/15 text-red-300 border-red-500/30"
              }
            >
              {getDbStatusLabel(status)}
            </Badge>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Signed-in User</div>
            <div className="font-mono">{email ?? "— not signed in —"}</div>
            {roles.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {roles.map((r) => (
                  <Badge key={r} variant="outline" className="text-[10px]">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Last Migration</div>
            <div className="font-mono">
              {lastMigrationAt ? new Date(lastMigrationAt).toLocaleString() : "— never —"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Production Source of Truth</div>
            <Badge
              variant="outline"
              className={"bg-emerald-500/15 text-emerald-300 border-emerald-500/30"}
            >
              Supabase Online
            </Badge>
            <div className="mt-1 text-muted-foreground">
              Local browser storage is limited to UI/session cache and retired residue cleanup.
            </div>
          </div>
        </div>
      </Card>

      {status !== "connected_authed" ? (
        <Card className="p-5 space-y-3 text-sm">
          <div className="font-medium">Sign in to verify Supabase status</div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={authMode === "signin" ? "default" : "outline"}
              onClick={() => setAuthMode("signin")}
            >
              Sign in
            </Button>
            <Button
              size="sm"
              variant={authMode === "signup" ? "default" : "outline"}
              onClick={() => setAuthMode("signup")}
            >
              Create account
            </Button>
          </div>
          <Input
            placeholder="Email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
          />
          <Button onClick={handleAuth} disabled={busy || !authEmail || !authPass}>
            {busy ? "Working..." : authMode === "signin" ? "Sign in" : "Create account"}
          </Button>
          <div className="text-xs text-muted-foreground">
            Supabase Auth uses email/password here. Add Google sign-in later from Cloud settings.
          </div>
        </Card>
      ) : (
        <Card className="p-5 space-y-3 text-sm">
          <div className="font-medium">Supabase Online Data</div>
          <div className="text-xs text-muted-foreground">
            Production data is already managed through Supabase. Browser-local pilot migration is
            retired; use authorized backup, disaster recovery, import, and support workflows
            instead.
          </div>
          <div className="flex gap-2">
            <Button onClick={handleMigrate} variant="outline">
              Migration Retired
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4 text-xs text-muted-foreground">
        Retired browser-local ERP stores tracked for cleanup: {PILOT_STORAGE_KEYS.length}
        <div className="mt-1 font-mono break-all">
          {PILOT_STORAGE_KEYS.length ? PILOT_STORAGE_KEYS.join(", ") : "none"}
        </div>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function BranchesTab() {
  const {
    branches,
    addBranch,
    updateBranch,
    removeBranch,
    setDefaultBranch,
    branchRules,
    setBranchRules,
  } = useSettings();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [managerName, setManagerName] = useState("");
  const [gstin, setGstin] = useState("");

  const handleCreate = () => {
    if (!name || !code) return;
    addBranch({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      address: address.trim(),
      phone: phone.trim(),
      managerName: managerName.trim(),
      gstin: gstin.trim(),
      active: true,
    });
    setName("");
    setCode("");
    setAddress("");
    setPhone("");
    setManagerName("");
    setGstin("");
  };

  return (
    <Card className="p-6 mt-4 space-y-6">
      <div>
        <h3 className="text-lg font-serif text-gold font-medium mb-1">Company Branches</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Manage physical shop locations, workshops, or counters. These branches route stock, sales,
          cash ledger, and physical inventory.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-md border border-gold/20 bg-gold/5">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gold uppercase tracking-wider">
            Gold Booking Mode
          </Label>
          <Select
            value={branchRules?.goldBookingMode || "branch-wise"}
            onValueChange={(val: any) => setBranchRules({ goldBookingMode: val })}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="centralized">Centralized Book</SelectItem>
              <SelectItem value="branch-wise">Branch-wise Ledger</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Whether gold book/ledger entries are shared globally or separated by branch.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gold uppercase tracking-wider">
            Stock Access Mode
          </Label>
          <Select
            value={branchRules?.stockAccessMode || "branch-wise"}
            onValueChange={(val: any) => setBranchRules({ stockAccessMode: val })}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="universal">Universal Stock List</SelectItem>
              <SelectItem value="branch-wise">Branch-wise Inventory</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Whether users see inventory across all counters or only the selected branch.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gold uppercase tracking-wider">
            Billing Sequence Mode
          </Label>
          <Select
            value={branchRules?.billingSequenceMode || "branch-wise"}
            onValueChange={(val: any) => setBranchRules({ billingSequenceMode: val })}
          >
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="universal">Universal Sequence</SelectItem>
              <SelectItem value="branch-wise">Branch-wise Series</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Separate branch-specific receipt series vs continuous company wide numbers.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {branches.map((b) => (
          <div
            key={b.id}
            className="p-4 rounded-md border border-border bg-slate-900/40 space-y-3 relative overflow-hidden"
            id={`branch-card-${b.id}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">Branch Name</Label>
                  <Input
                    value={b.name}
                    onChange={(e) => updateBranch(b.id, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">Code</Label>
                  <Input
                    value={b.code}
                    disabled={b.id === "MAIN" || b.id === "WORKSHOP"}
                    onChange={(e) => updateBranch(b.id, { code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">
                    Manager Name
                  </Label>
                  <Input
                    value={b.managerName}
                    onChange={(e) => updateBranch(b.id, { managerName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">Phone</Label>
                  <Input
                    value={b.phone}
                    onChange={(e) => updateBranch(b.id, { phone: e.target.value })}
                  />
                </div>
              </div>

              {b.id !== "MAIN" && b.id !== "WORKSHOP" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => removeBranch(b.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase">Address</Label>
                <Input
                  value={b.address}
                  onChange={(e) => updateBranch(b.id, { address: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase">
                  GSTIN (if different)
                </Label>
                <Input
                  value={b.gstin || ""}
                  placeholder="Leave empty to inherit firm GSTIN"
                  onChange={(e) => updateBranch(b.id, { gstin: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-1 border-t border-border/40 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  id={`branch-switch-active-${b.id}`}
                  checked={b.active}
                  disabled={b.isDefault}
                  onCheckedChange={(val) => updateBranch(b.id, { active: val })}
                />
                <span className="text-muted-foreground">Active Status</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  id={`branch-switch-default-${b.id}`}
                  checked={b.isDefault}
                  onCheckedChange={() => setDefaultBranch(b.id)}
                />
                <span className="text-muted-foreground font-semibold text-gold">
                  Default Branch
                </span>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-border/80">
        <h4 className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-1.5">
          <Plus className="h-4 w-4 text-gold" /> Add New Branch
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="space-y-1">
            <Label className="text-[10px]">Branch Name</Label>
            <Input
              id="new-branch-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Garia Arcade"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Code</Label>
            <Input
              id="new-branch-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. GARIA"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Manager</Label>
            <Input
              id="new-branch-manager-input"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="Manager Name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Phone</Label>
            <Input
              id="new-branch-phone-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="space-y-1">
            <Label className="text-[10px]">Address</Label>
            <Input
              id="new-branch-address-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Branch Address"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">GSTIN (if different)</Label>
            <Input
              id="new-branch-gstin-input"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <Button
          id="create-branch-btn"
          onClick={handleCreate}
          disabled={!name || !code}
          className="bg-gold hover:bg-gold/90 text-slate-950 font-medium"
        >
          Create Branch Location
        </Button>
      </div>
    </Card>
  );
}

function PrintersTab() {
  const s = useSettings();
  const [editingId, setEditingId] = useState<string | null>(null);

  // State for adding/editing a profile
  const [name, setName] = useState("");
  const [type, setType] = useState<"thermal" | "laser" | "inkjet" | "label">("thermal");
  const [paperSize, setPaperSize] = useState<"A4" | "A5" | "80mm" | "58mm" | "40x25" | "50x25">(
    "80mm",
  );
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [margins, setMargins] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [colorMode, setColorMode] = useState<"bw" | "color">("bw");
  const [defaultCopies, setDefaultCopies] = useState(1);
  const [quality, setQuality] = useState<"draft" | "normal" | "high">("normal");
  const [archivalMode, setArchivalMode] = useState(false);
  const [templateMapping, setTemplateMapping] = useState<string[]>([]);

  const resetForm = () => {
    setName("");
    setType("thermal");
    setPaperSize("80mm");
    setOrientation("portrait");
    setMargins({ top: 0, right: 0, bottom: 0, left: 0 });
    setColorMode("bw");
    setDefaultCopies(1);
    setQuality("normal");
    setArchivalMode(false);
    setTemplateMapping([]);
    setEditingId(null);
  };

  const startEdit = (profile: PrinterProfile) => {
    setEditingId(profile.id);
    setName(profile.name);
    setType(profile.type);
    setPaperSize(profile.paperSize);
    setOrientation(profile.orientation);
    setMargins({ ...profile.margins });
    setColorMode(profile.colorMode);
    setDefaultCopies(profile.defaultCopies);
    setQuality(profile.quality);
    setArchivalMode(profile.archivalMode);
    setTemplateMapping([...profile.templateMapping]);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const payload = {
      name,
      type,
      paperSize,
      orientation,
      margins,
      colorMode,
      defaultCopies,
      quality,
      archivalMode,
      templateMapping,
    };

    if (editingId) {
      s.updatePrinterProfile(editingId, payload);
      toast.success("Printer profile updated successfully");
    } else {
      s.addPrinterProfile(payload);
      toast.success("Printer profile added successfully");
    }
    resetForm();
  };

  const toggleTemplateMapping = (tpl: string) => {
    if (templateMapping.includes(tpl)) {
      setTemplateMapping(templateMapping.filter((t) => t !== tpl));
    } else {
      setTemplateMapping([...templateMapping, tpl]);
    }
  };

  const availableTemplates = ["Invoice", "Receipt", "Job Card", "Estimation", "Tag"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Printer Profiles</h3>
          <p className="text-sm text-muted-foreground">
            Configure physical print routing, page sizes, and default copy counts.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {s.printerProfiles.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No printer profiles configured. Add one on the right to get started.
            </Card>
          ) : (
            s.printerProfiles.map((p) => (
              <Card
                key={p.id}
                className="p-4 border-border/60 bg-card/50 flex justify-between items-start"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {p.type}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {p.paperSize}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>
                      Orientation: <span className="capitalize">{p.orientation}</span> | Color:{" "}
                      <span className="capitalize">{p.colorMode}</span>
                    </div>
                    <div>
                      Margins: T:{p.margins.top} R:{p.margins.right} B:{p.margins.bottom} L:
                      {p.margins.left}
                    </div>
                    {p.templateMapping.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.templateMapping.map((t) => (
                          <Badge
                            key={t}
                            variant="outline"
                            className="text-[9px] bg-gold/5 border-gold/20 text-gold"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      s.removePrinterProfile(p.id);
                      toast.success("Printer profile removed");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <div>
          <Card className="p-4 space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              {editingId ? "Edit Printer Profile" : "Add Printer Profile"}
            </h4>
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label htmlFor="printer-name">Profile/Printer Name</Label>
                <Input
                  id="printer-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Counter Thermal, Office LaserJet"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Printer Type</Label>
                  <Select value={type} onValueChange={(v: any) => setType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thermal">Thermal (Roll)</SelectItem>
                      <SelectItem value="laser">Laser Jet</SelectItem>
                      <SelectItem value="inkjet">Ink Jet</SelectItem>
                      <SelectItem value="label">Label Printer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Paper Size</Label>
                  <Select value={paperSize} onValueChange={(v: any) => setPaperSize(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 Standard</SelectItem>
                      <SelectItem value="A5">A5 Statement</SelectItem>
                      <SelectItem value="80mm">80mm Roll</SelectItem>
                      <SelectItem value="58mm">58mm Roll</SelectItem>
                      <SelectItem value="40x25">40x25 Label</SelectItem>
                      <SelectItem value="50x25">50x25 Label</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Orientation</Label>
                  <Select value={orientation} onValueChange={(v: any) => setOrientation(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Color Mode</Label>
                  <Select value={colorMode} onValueChange={(v: any) => setColorMode(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bw">Black &amp; White</SelectItem>
                      <SelectItem value="color">Color</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Margins (mm)</Label>
                <div className="grid grid-cols-4 gap-1">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-muted-foreground block text-center">Top</span>
                    <Input
                      type="number"
                      value={margins.top}
                      onChange={(e) =>
                        setMargins({ ...margins, top: parseFloat(e.target.value) || 0 })
                      }
                      className="text-center h-8 px-1"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-muted-foreground block text-center">
                      Right
                    </span>
                    <Input
                      type="number"
                      value={margins.right}
                      onChange={(e) =>
                        setMargins({ ...margins, right: parseFloat(e.target.value) || 0 })
                      }
                      className="text-center h-8 px-1"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-muted-foreground block text-center">
                      Bottom
                    </span>
                    <Input
                      type="number"
                      value={margins.bottom}
                      onChange={(e) =>
                        setMargins({ ...margins, bottom: parseFloat(e.target.value) || 0 })
                      }
                      className="text-center h-8 px-1"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-muted-foreground block text-center">Left</span>
                    <Input
                      type="number"
                      value={margins.left}
                      onChange={(e) =>
                        setMargins({ ...margins, left: parseFloat(e.target.value) || 0 })
                      }
                      className="text-center h-8 px-1"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="printer-copies">Default Copies</Label>
                  <Input
                    id="printer-copies"
                    type="number"
                    min={1}
                    value={defaultCopies}
                    onChange={(e) => setDefaultCopies(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Quality Preset</Label>
                  <Select value={quality} onValueChange={(v: any) => setQuality(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft (Eco)</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High Resolution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2 py-1">
                <Switch
                  id="printer-archival"
                  checked={archivalMode}
                  onCheckedChange={setArchivalMode}
                />
                <Label htmlFor="printer-archival" className="cursor-pointer">
                  Archival Saving Mode (PDF Backup)
                </Label>
              </div>

              <div className="space-y-1.5">
                <Label>Template Auto-Routing</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableTemplates.map((tpl) => {
                    const active = templateMapping.includes(tpl);
                    return (
                      <button
                        key={tpl}
                        type="button"
                        onClick={() => toggleTemplateMapping(tpl)}
                        className={`px-2 py-1 rounded text-[10px] border transition ${
                          active
                            ? "bg-gold/15 border-gold text-gold"
                            : "bg-background border-border text-muted-foreground hover:border-border/80"
                        }`}
                      >
                        {tpl}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1 bg-gold hover:bg-gold/90 text-slate-950">
                  <Save className="h-4 w-4 mr-1.5" /> {editingId ? "Update" : "Save Profile"}
                </Button>
                {editingId && (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const s = useSettings();
  const [selectedId, setSelectedId] = useState<string | null>(s.documentTemplates[0]?.id || null);

  const activeTemplate = s.documentTemplates.find((t) => t.id === selectedId);

  const handleUpdate = (patch: Partial<DocumentTemplate>) => {
    if (selectedId) {
      s.updateDocumentTemplate(selectedId, patch);
      toast.success("Template style setting updated");
    }
  };

  if (!activeTemplate) {
    return (
      <Card className="p-8 text-center text-muted-foreground">No document templates loaded.</Card>
    );
  }

  const fontFamilies = ["Inter", "Space Grotesk", "Outfit", "JetBrains Mono", "Playfair Display"];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Document Templates</h3>
        <p className="text-sm text-muted-foreground">
          Customize branding typography, fonts, colors, and layout blocks for printable documents.
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Select Document Type</Label>
          <div className="flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0">
            {s.documentTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`px-3 py-2 text-left rounded-md text-xs font-medium transition whitespace-nowrap lg:whitespace-normal border ${
                  t.id === selectedId
                    ? "bg-gold/10 border-gold/30 text-gold"
                    : "bg-card border-border hover:border-border/80 text-muted-foreground"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          <Card className="p-5 space-y-6 text-xs">
            <div className="flex justify-between items-center pb-3 border-b border-border/40">
              <h4 className="font-semibold text-sm text-gold">
                Styling options for {activeTemplate.name}
              </h4>
              <Badge variant="outline" className="text-[10px] font-mono">
                ID: {activeTemplate.id}
              </Badge>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h5 className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                  Typography &amp; Scale
                </h5>

                <div className="space-y-1">
                  <Label>Font Family</Label>
                  <Select
                    value={activeTemplate.fontFamily}
                    onValueChange={(v: any) => handleUpdate({ fontFamily: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontFamilies.map((ff) => (
                        <SelectItem key={ff} value={ff}>
                          {ff}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Base Font Size</Label>
                  <Select
                    value={activeTemplate.fontSize}
                    onValueChange={(v: any) => handleUpdate({ fontSize: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xs">Extra Small (xs)</SelectItem>
                      <SelectItem value="sm">Small (sm)</SelectItem>
                      <SelectItem value="base">Normal (base)</SelectItem>
                      <SelectItem value="lg">Large (lg)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Primary Hex Color</Label>
                    <div className="flex gap-1.5 items-center">
                      <Input
                        type="color"
                        value={activeTemplate.primaryColor}
                        onChange={(e) => handleUpdate({ primaryColor: e.target.value })}
                        className="w-8 h-8 p-0 border-0 rounded"
                      />
                      <Input
                        value={activeTemplate.primaryColor}
                        onChange={(e) => handleUpdate({ primaryColor: e.target.value })}
                        className="font-mono h-8 uppercase"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Accent Hex Color</Label>
                    <div className="flex gap-1.5 items-center">
                      <Input
                        type="color"
                        value={activeTemplate.accentColor}
                        onChange={(e) => handleUpdate({ accentColor: e.target.value })}
                        className="w-8 h-8 p-0 border-0 rounded"
                      />
                      <Input
                        value={activeTemplate.accentColor}
                        onChange={(e) => handleUpdate({ accentColor: e.target.value })}
                        className="font-mono h-8 uppercase"
                        placeholder="#D4AF37"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                  Header &amp; Footer Layout
                </h5>

                <div className="space-y-1">
                  <Label>Header Arrangement</Label>
                  <Select
                    value={activeTemplate.headerLayout}
                    onValueChange={(v: any) => handleUpdate({ headerLayout: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard Left-Aligned</SelectItem>
                      <SelectItem value="compact">Compact Space Saver</SelectItem>
                      <SelectItem value="centered">Centered Elegant Header</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Footer Arrangement</Label>
                  <Select
                    value={activeTemplate.footerLayout}
                    onValueChange={(v: any) => handleUpdate({ footerLayout: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard Bottom Block</SelectItem>
                      <SelectItem value="two_column">Split Two-Column Grid</SelectItem>
                      <SelectItem value="minimal">Minimal Single-Line Footer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-border/40">
              <h5 className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Element Visibility Toggles
              </h5>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <span className="font-medium text-[11px]">Show Logo Block</span>
                  <Switch
                    checked={activeTemplate.showLogo}
                    onCheckedChange={(checked) => handleUpdate({ showLogo: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <span className="font-medium text-[11px]">Show Firm Address</span>
                  <Switch
                    checked={activeTemplate.showHeaderAddress}
                    onCheckedChange={(checked) => handleUpdate({ showHeaderAddress: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <span className="font-medium text-[11px]">Show Contact No</span>
                  <Switch
                    checked={activeTemplate.showContact}
                    onCheckedChange={(checked) => handleUpdate({ showContact: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <span className="font-medium text-[11px]">Show GSTIN Code</span>
                  <Switch
                    checked={activeTemplate.showGst}
                    onCheckedChange={(checked) => handleUpdate({ showGst: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <span className="font-medium text-[11px]">Show PAN Number</span>
                  <Switch
                    checked={activeTemplate.showPan}
                    onCheckedChange={(checked) => handleUpdate({ showPan: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <span className="font-medium text-[11px]">Show Bank Details</span>
                  <Switch
                    checked={activeTemplate.showBankDetails}
                    onCheckedChange={(checked) => handleUpdate({ showBankDetails: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <span className="font-medium text-[11px]">Show Hallmarked HUID</span>
                  <Switch
                    checked={activeTemplate.showHuid}
                    onCheckedChange={(checked) => handleUpdate({ showHuid: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <span className="font-medium text-[11px]">Show Page Numbers</span>
                  <Switch
                    checked={activeTemplate.showPageNumbers}
                    onCheckedChange={(checked) => handleUpdate({ showPageNumbers: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <span className="font-medium text-[11px]">Show Signature Blocks</span>
                  <Switch
                    checked={activeTemplate.showSignatureBlocks}
                    onCheckedChange={(checked) => handleUpdate({ showSignatureBlocks: checked })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-3 border-t border-border/40">
              <h5 className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                Predefined Legal Clauses
              </h5>

              <div className="space-y-1">
                <Label>Terms and Conditions</Label>
                <Textarea
                  value={activeTemplate.termsAndConditions}
                  onChange={(e) => handleUpdate({ termsAndConditions: e.target.value })}
                  placeholder="Insert terms & conditions here"
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-1">
                <Label>Disclaimer Notice</Label>
                <Textarea
                  value={activeTemplate.disclaimer}
                  onChange={(e) => handleUpdate({ disclaimer: e.target.value })}
                  placeholder="Insert print footer disclaimer"
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ComplianceTab() {
  const s = useSettings();
  const [hsn, setHsn] = useState(s.complianceProfile.hsnCodeJewellery);
  const [sac, setSac] = useState(s.complianceProfile.sacCodeServices);
  const [hallmark, setHallmark] = useState(s.complianceProfile.hallmarkLicenseNo);
  const [bis, setBis] = useState(s.complianceProfile.bisRegistrationNo);
  const [stateCode, setStateCode] = useState(s.complianceProfile.stateCode);
  const [panThresholdRupees, setPanThresholdRupees] = useState(
    s.complianceProfile.panRequiredThresholdPaise / 100,
  );

  // Sync state if store changes in the background
  useEffect(() => {
    setHsn(s.complianceProfile.hsnCodeJewellery);
    setSac(s.complianceProfile.sacCodeServices);
    setHallmark(s.complianceProfile.hallmarkLicenseNo);
    setBis(s.complianceProfile.bisRegistrationNo);
    setStateCode(s.complianceProfile.stateCode);
    setPanThresholdRupees(s.complianceProfile.panRequiredThresholdPaise / 100);
  }, [s.complianceProfile]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    s.setComplianceProfile({
      hsnCodeJewellery: hsn,
      sacCodeServices: sac,
      hallmarkLicenseNo: hallmark,
      bisRegistrationNo: bis,
      stateCode: stateCode,
      panRequiredThresholdPaise: panThresholdRupees * 100,
    });
    toast.success("Compliance profile saved successfully");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Compliance Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage legal codes, Hallmark license registration, BIS registration, state billing codes,
          and regulatory thresholds.
        </p>
      </div>

      <Card className="p-5 max-w-2xl text-xs">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="comp-hsn">HSN Code (Jewellery Items)</Label>
              <Input
                id="comp-hsn"
                value={hsn}
                onChange={(e) => setHsn(e.target.value)}
                placeholder="e.g. 7113"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="comp-sac">SAC Code (Services/Labour/Making)</Label>
              <Input
                id="comp-sac"
                value={sac}
                onChange={(e) => setSac(e.target.value)}
                placeholder="e.g. 9988"
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="comp-hallmark">Hallmark License No</Label>
              <Input
                id="comp-hallmark"
                value={hallmark}
                onChange={(e) => setHallmark(e.target.value)}
                placeholder="e.g. HM-W-916053"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="comp-bis">BIS Registration No</Label>
              <Input
                id="comp-bis"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
                placeholder="e.g. BIS-MTJ-882"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="comp-state">State Code (GST State Digit)</Label>
              <Input
                id="comp-state"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                placeholder="e.g. 19 for West Bengal"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="comp-pan-threshold">PAN Card Mandatory Threshold (INR)</Label>
              <Input
                id="comp-pan-threshold"
                type="number"
                value={panThresholdRupees}
                onChange={(e) => setPanThresholdRupees(parseFloat(e.target.value) || 0)}
                placeholder="e.g. 200000"
                required
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Billing above this amount triggers mandatory PAN validation on invoices.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 flex justify-end">
            <Button type="submit" className="bg-gold hover:bg-gold/90 text-slate-950">
              <Save className="h-4 w-4 mr-1.5" /> Save Compliance Settings
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function FormsTab() {
  const s = useSettings();
  const [editingFormId, setEditingFormId] = useState<string | null>(null);

  // Form details state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("kyc");
  const [fields, setFields] = useState<FormFieldMetadata[]>([]);
  const [printTemplateId, setPrintTemplateId] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(false);

  // New field creator state
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<
    "text" | "number" | "select" | "date" | "boolean" | "textarea"
  >("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState("");

  const resetForm = () => {
    setFormName("");
    setFormType("kyc");
    setFields([]);
    setPrintTemplateId("");
    setApprovalRequired(false);
    setEditingFormId(null);
    resetNewFieldCreator();
  };

  const resetNewFieldCreator = () => {
    setNewFieldName("");
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldRequired(false);
    setNewFieldOptions("");
  };

  const startEdit = (form: FormMetadata) => {
    setEditingFormId(form.id);
    setFormName(form.name);
    setFormType(form.type);
    setFields([...form.fields]);
    setPrintTemplateId(form.printTemplateId);
    setApprovalRequired(form.approvalRequired);
  };

  const handleAddField = () => {
    if (!newFieldName || !newFieldLabel) {
      toast.error("Please provide both name and label for the field");
      return;
    }

    const cleanedName = newFieldName.replace(/[^a-zA-Z0-9]/g, "");
    if (fields.some((f) => f.name === cleanedName)) {
      toast.error("A field with this variable name already exists");
      return;
    }

    const fieldPayload: FormFieldMetadata = {
      name: cleanedName,
      label: newFieldLabel,
      type: newFieldType,
      required: newFieldRequired,
      options: newFieldOptions ? newFieldOptions.split(",").map((o) => o.trim()) : undefined,
    };

    setFields([...fields, fieldPayload]);
    resetNewFieldCreator();
    toast.success("Field added to template layout");
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    const payload = {
      name: formName,
      type: formType,
      fields,
      printTemplateId,
      pdfTemplateId: "default_pdf",
      emailTemplateId: "default_email",
      permissionsRequired: ["manage_settings"],
      approvalRequired,
    };

    if (editingFormId) {
      s.updateFormMetadata(editingFormId, payload);
      toast.success("Dynamic form specification updated");
    } else {
      s.addFormMetadata({
        ...payload,
      });
      toast.success("New dynamic form spec registered successfully");
    }
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Dynamic Customer Forms</h3>
          <p className="text-sm text-muted-foreground">
            Draft and configure structure schemas for KYC, feedback surveys, or warranty consent
            records.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {s.formsMetadata.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No custom forms configured. Build one on the right to start gathering custom fields.
            </Card>
          ) : (
            s.formsMetadata.map((f) => (
              <Card
                key={f.id}
                className="p-4 border-border/60 bg-card/50 flex justify-between items-start"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{f.name}</span>
                    <Badge variant="secondary" className="text-[9px] uppercase font-mono">
                      {f.type}
                    </Badge>
                    {f.approvalRequired && (
                      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px]">
                        Owner Approval Required
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground pt-1">
                    Fields: {f.fields.map((field) => `${field.label} (${field.type})`).join(", ")}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(f)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      s.removeFormMetadata(f.id);
                      toast.success("Form deleted");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <div>
          <Card className="p-4 space-y-4">
            <h4 className="font-semibold text-sm">
              {editingFormId ? "Edit Form Schema" : "Create Form Schema"}
            </h4>

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label htmlFor="form-name">Form Display Name</Label>
                <Input
                  id="form-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Gold Exchange Consent Form"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Form Category</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kyc">KYC &amp; AML Verification</SelectItem>
                      <SelectItem value="consent">Liability &amp; Melting Consent</SelectItem>
                      <SelectItem value="feedback">Customer Satisfaction</SelectItem>
                      <SelectItem value="custom">Other Custom Registry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Print Stylesheet</Label>
                  <Select value={printTemplateId} onValueChange={setPrintTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No print route" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default_invoice">Invoice Style</SelectItem>
                      <SelectItem value="default_receipt">Receipt Style</SelectItem>
                      <SelectItem value="default_jobcard">Job Card Style</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2 py-1">
                <Switch
                  id="form-approval"
                  checked={approvalRequired}
                  onCheckedChange={setApprovalRequired}
                />
                <Label htmlFor="form-approval" className="cursor-pointer">
                  Require Owner Manager Auth Pin to Lock
                </Label>
              </div>

              <div className="space-y-2 p-3 bg-secondary/20 rounded-md border border-border/40">
                <h5 className="font-semibold text-muted-foreground text-[10px] uppercase">
                  Form Field Constructor
                </h5>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">Variable Identifier</Label>
                    <Input
                      placeholder="e.g. panNo (No spaces)"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">User Label Text</Label>
                    <Input
                      placeholder="e.g. Enter PAN Card"
                      value={newFieldLabel}
                      onChange={(e) => setNewFieldLabel(e.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 items-end">
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">Input Element Type</Label>
                    <Select value={newFieldType} onValueChange={(v: any) => setNewFieldType(v)}>
                      <SelectTrigger className="h-8 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Single Line Text</SelectItem>
                        <SelectItem value="number">Numeric Input</SelectItem>
                        <SelectItem value="select">Dropdown Select</SelectItem>
                        <SelectItem value="date">Calendar Date</SelectItem>
                        <SelectItem value="textarea">Multi-line Text</SelectItem>
                        <SelectItem value="boolean">Yes/No Toggle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-background border border-border h-8">
                    <Label className="text-[10px] cursor-pointer">Required Field</Label>
                    <Switch checked={newFieldRequired} onCheckedChange={setNewFieldRequired} />
                  </div>
                </div>

                {newFieldType === "select" && (
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">Dropdown Options (Comma Separated)</Label>
                    <Input
                      placeholder="e.g. Yes, No, Pending"
                      value={newFieldOptions}
                      onChange={(e) => setNewFieldOptions(e.target.value)}
                      className="h-8"
                    />
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleAddField}
                  variant="outline"
                  className="w-full h-8 text-[11px] border-dashed border-gold/40 text-gold hover:bg-gold/5 mt-1"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Append Field to Form Layout
                </Button>
              </div>

              <div className="space-y-1">
                <Label>Current Schema Fields ({fields.length})</Label>
                {fields.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground p-2 text-center border border-dashed rounded-lg bg-card/20">
                    No custom fields appended yet. Add fields above.
                  </div>
                ) : (
                  <div className="max-h-[150px] overflow-y-auto space-y-1">
                    {fields.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-1.5 rounded bg-secondary/40 border border-border/30"
                      >
                        <span className="font-mono text-[10px]">
                          {f.label}{" "}
                          <span className="text-muted-foreground font-sans">({f.type})</span>
                          {f.required && <span className="text-red-500 font-sans">*</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(idx)}
                          className="text-destructive hover:bg-destructive/10 p-0.5 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-border/30">
                <Button
                  type="submit"
                  className="flex-1 bg-gold hover:bg-gold/90 text-slate-950"
                  disabled={fields.length === 0}
                >
                  <Save className="h-4 w-4 mr-1.5" />{" "}
                  {editingFormId ? "Update Schema" : "Register Schema"}
                </Button>
                {editingFormId && (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ModulesManagerTab() {
  const mStore = useModuleStore();
  const settings = useSettings();
  const currentBranchId = settings.selectedBranchId || "MAIN";

  useEffect(() => {
    void mStore.refresh(currentBranchId);
  }, [currentBranchId]);

  const handleToggle = async (key: ERPModuleKey, checked: boolean) => {
    try {
      await mStore.toggleModule(currentBranchId, key, checked);
      toast.success(`${key.toUpperCase()} module toggled successfully`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-gold">ERP Modules & Features</h3>
          <p className="text-xs text-muted-foreground">
            Activate or deactivate module workflows globally for this branch. Disabling a module
            hides it from navigation, reports and dashboards.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ERP_MODULES.map((mod: any) => {
          const isEnabled = mStore.isModuleEnabled(mod.key);
          return (
            <Card key={mod.key} className="p-4 border-border bg-card/60 flex items-start gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{mod.label}</span>
                  {mod.dependencies.length > 0 && (
                    <Badge variant="outline" className="text-[9px] uppercase">
                      Requires: {mod.dependencies.join(", ")}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{mod.description}</p>
              </div>
              <div className="flex items-center pt-1.5">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggle(mod.key, checked)}
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
