/**
 * AVS ERP — Settings / Masters store
 * Pilot-controlled firm profile, branding, GST, purity, dropdown masters.
 */
import { useMemo } from "react";
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  DEFAULT_BULLION_RATE_PROVIDER_CONFIG,
  type BullionRateProviderConfig,
} from "./bullion-rate/types";
import { normalizeR2Url } from "./supabase-storage";

import {
  redactBullionRateProvider,
  redactSmtpSettings,
} from "@/lib/security/client-secret-redaction";

/** Saves the main firm settings blob to app_settings (id = firm UUID) */
/**
 * When this tab last wrote settings. A pull whose row is older than this is
 * carrying a snapshot taken BEFORE our write — applying it would roll the local
 * state back to a stale value, and the next persist would then write that
 * staleness to the database, permanently losing the edit. See
 * `isSettingsPullStale()`, which data-loader consults before applying a pull.
 *
 * This is what made a newly-created custom form vanish on restart: a pull already
 * in flight when the form was saved landed just after it, reset formsMetadata to
 * the pre-save list, and the next persist wrote that list back over the good row.
 * (The same race is named in settings.index.tsx as the old "logo/settings
 * disappear after restart" bug — it was only ever half-fixed, on one write path.)
 */
let lastLocalSettingsWriteAt = 0;
let settingsWriteQueue: Promise<void> = Promise.resolve();
let lastSettingsPersistError: string | null = null;
let lastPersistFailNotifyAt = 0;

const SETTINGS_PERSIST_FAILED_EVENT = "ornexa:settings-persist-failed";

function notifySettingsPersistFailure(message: string): void {
  lastSettingsPersistError = message;
  if (typeof window === "undefined") return;
  const now = Date.now();
  // Auto-save tabs fire many writes; throttle so one RLS failure does not spam.
  if (now - lastPersistFailNotifyAt < 4000) return;
  lastPersistFailNotifyAt = now;
  window.dispatchEvent(
    new CustomEvent(SETTINGS_PERSIST_FAILED_EVENT, { detail: { message } }),
  );
}

/** Subscribe to settings persist failures (Settings UI shows toast). */
export function onSettingsPersistFailed(
  handler: (message: string) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ message?: string }>).detail;
    handler(detail?.message || "Firm settings could not be saved.");
  };
  window.addEventListener(SETTINGS_PERSIST_FAILED_EVENT, listener);
  return () => window.removeEventListener(SETTINGS_PERSIST_FAILED_EVENT, listener);
}

/** Await all queued app_settings writes (e.g. before invite validation). */
export async function flushSettingsPersistence(): Promise<{ ok: boolean; error?: string }> {
  await settingsWriteQueue.catch(() => undefined);
  if (lastSettingsPersistError) {
    return { ok: false, error: lastSettingsPersistError };
  }
  return { ok: true };
}

/**
 * Queue the current in-memory settings snapshot and wait for the write.
 * Use `force` for explicit Save actions so a pending hydration gate cannot
 * silently skip the persist and report success.
 */
export async function persistAndFlushSettings(
  force = false,
): Promise<{ ok: boolean; error?: string }> {
  lastSettingsPersistError = null;
  persistSettings(() => useSettings.getState(), force);
  return flushSettingsPersistence();
}

/** True if `rowUpdatedAt` predates this tab's most recent settings write. */
export function isSettingsPullStale(rowUpdatedAt: string | null | undefined): boolean {
  if (!lastLocalSettingsWriteAt) return false;
  if (!rowUpdatedAt) return false;
  const rowMs = Date.parse(rowUpdatedAt);
  if (Number.isNaN(rowMs)) return false;
  return rowMs < lastLocalSettingsWriteAt;
}

const LOCAL_STORAGE_SETTINGS_CACHE_KEY = "avs_firm_app_settings_cache";

export function loadInitialCachedSettings(defaults: typeof DEFAULTS): typeof DEFAULTS {
  if (typeof window === "undefined" || !window.localStorage) {
    return defaults;
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_SETTINGS_CACHE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;

    const firm = { ...defaults.firm, ...(parsed.firm || {}) };
    if (firm.logoUrl) firm.logoUrl = normalizeR2Url(firm.logoUrl);
    const branding = { ...defaults.branding, ...(parsed.branding || {}) };
    if (branding.logoUrl) branding.logoUrl = normalizeR2Url(branding.logoUrl);
    const branchSettings = (Array.isArray(parsed.branchSettings)
      ? parsed.branchSettings
      : defaults.branchSettings
    ).map((bs: BranchSettings) => ({
      ...bs,
      logoUrl: bs.logoUrl ? normalizeR2Url(bs.logoUrl) : bs.logoUrl,
    }));

    return {
      ...defaults,
      ...parsed,
      firm,
      branding,
      branchSettings,
      print: { ...defaults.print, ...(parsed.print || {}) },
      gst: { ...defaults.gst, ...(parsed.gst || {}) },
      makingCharge: { ...defaults.makingCharge, ...(parsed.makingCharge || {}) },
      hardware: { ...defaults.hardware, ...(parsed.hardware || {}) },
      catalog: { ...defaults.catalog, ...(parsed.catalog || {}) },
      language: { ...defaults.language, ...(parsed.language || {}) },
      developer: { ...defaults.developer, ...(parsed.developer || {}) },
      purities:
        Array.isArray(parsed.purities) && parsed.purities.length > 0
          ? parsed.purities
          : defaults.purities,
      workshopProcesses:
        Array.isArray(parsed.workshopProcesses) && parsed.workshopProcesses.length > 0
          ? parsed.workshopProcesses
          : defaults.workshopProcesses,
      alloyFormulas:
        Array.isArray(parsed.alloyFormulas) && parsed.alloyFormulas.length > 0
          ? parsed.alloyFormulas
          : defaults.alloyFormulas,
      purityHelper: { ...defaults.purityHelper, ...(parsed.purityHelper || {}) },
      dropdowns: { ...defaults.dropdowns, ...(parsed.dropdowns || {}) },
      disabledDropdowns: { ...defaults.disabledDropdowns, ...(parsed.disabledDropdowns || {}) },
      printerProfiles:
        Array.isArray(parsed.printerProfiles) && parsed.printerProfiles.length > 0
          ? parsed.printerProfiles
          : defaults.printerProfiles,
      documentTemplates:
        Array.isArray(parsed.documentTemplates) && parsed.documentTemplates.length > 0
          ? parsed.documentTemplates
          : defaults.documentTemplates,
      complianceProfile: { ...defaults.complianceProfile, ...(parsed.complianceProfile || {}) },
      formsMetadata:
        Array.isArray(parsed.formsMetadata) && parsed.formsMetadata.length > 0
          ? parsed.formsMetadata
          : defaults.formsMetadata,
      campaignTemplates: { ...defaults.campaignTemplates, ...(parsed.campaignTemplates || {}) },
      commAutomation: { ...defaults.commAutomation, ...(parsed.commAutomation || {}) },
      emailTemplates: Array.isArray(parsed.emailTemplates)
        ? parsed.emailTemplates
        : defaults.emailTemplates,
    };
  } catch (e) {
    console.warn("[settings] Failed to parse initial cached settings:", e);
    return defaults;
  }
}

async function saveAppSettingsToDb(snapshot: Record<string, unknown>): Promise<void> {
  // Stamped before the await: a pull that raced this write must lose regardless
  // of when the round trip happens to complete.
  lastLocalSettingsWriteAt = Date.now();
  lastSettingsPersistError = null;
  try {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth?.session?.user?.id;
    if (!userId) {
      console.warn("[settings] Skipping remote database persistence: not signed in (cached locally).");
      return;
    }

    let firmId: string | null = null;
    try {
      const { clearCachedFirmId, resolveCurrentFirmId } = await import(
        "@/lib/firm-scoped-app-settings"
      );
      clearCachedFirmId();
      firmId = await resolveCurrentFirmId();
    } catch {
      /* fall through */
    }
    if (!firmId) {
      try {
        const { data: rpcFirm, error: rpcError } = await (supabase as any).rpc("my_firm_id");
        if (!rpcError && rpcFirm) firmId = String(rpcFirm);
      } catch {
        /* fall through to profile lookup */
      }
    }
    if (!firmId) {
      const { data: profile } = await supabase
        .from("user_profiles" as never)
        .select("firm_id")
        .eq("auth_id", userId)
        .maybeSingle();
      firmId = (profile as { firm_id?: string } | null)?.firm_id ?? null;
    }
    if (!firmId) {
      const { data: membership } = await supabase
        .from("tenant_memberships" as never)
        .select("organization_id")
        .eq("auth_user_id", userId)
        .eq("status", "active")
        .order("last_active_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      firmId = (membership as { organization_id?: string } | null)?.organization_id ?? null;
    }
    if (!firmId) {
      try {
        const { data: org } = await supabase
          .from("organizations" as never)
          .select("id")
          .limit(1)
          .maybeSingle();
        firmId = (org as { id?: string } | null)?.id ?? null;
      } catch {
        /* fall through */
      }
    }

    let savedToDb = false;

    // Prefer the membership-checked RPC. The RPC writes as SECURITY DEFINER
    // after authz checks and raises if the row was not actually updated.
    try {
      const { data: rpcResult, error: rpcWriteError } = await (supabase as any).rpc(
        "upsert_my_firm_app_settings",
        { p_data: snapshot },
      );
      if (!rpcWriteError && rpcResult && (rpcResult as { ok?: boolean }).ok !== false) {
        savedToDb = true;
      } else if (rpcWriteError) {
        console.warn(
          "[settings] RPC upsert_my_firm_app_settings failed, falling back to direct table upsert:",
          rpcWriteError.message,
        );
      }
    } catch (rpcEx) {
      console.warn("[settings] RPC invocation exception, falling back to direct table upsert:", rpcEx);
    }

    // Direct table upsert fallback (if RPC failed, was missing, or unconfirmed)
    if (!savedToDb) {
      const targetId = firmId || userId || "main_settings";
      try {
        const { error: directErr } = await (supabase.from("app_settings") as any).upsert(
          {
            id: targetId,
            scope: "firm",
            data: snapshot as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
        if (!directErr) {
          savedToDb = true;
        } else {
          console.warn("[settings] Direct app_settings upsert fallback error:", directErr.message);
          // If we had no firmId, try again with "main_settings"
          if (firmId && firmId !== "main_settings") {
            const { error: fallbackErr } = await (supabase.from("app_settings") as any).upsert(
              {
                id: "main_settings",
                scope: "firm",
                data: snapshot as any,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" },
            );
            if (!fallbackErr) savedToDb = true;
          }
        }
      } catch (directEx) {
        console.warn("[settings] Direct app_settings upsert exception:", directEx);
      }
    }

    if (!savedToDb) {
      notifySettingsPersistFailure("Could not persist settings to cloud database. Settings are preserved locally.");
    }

    // Also sync normalized dropdown masters
    if (snapshot.dropdowns) {
      try {
        const ddRows: any[] = [];
        const masterFirmId = firmId || "default_firm";
        for (const [key, items] of Object.entries(snapshot.dropdowns as Record<string, string[]>)) {
          (items || []).forEach((val, idx) => {
            ddRows.push({
              id: `${masterFirmId}_${key}_${idx}`,
              firm_id: masterFirmId,
              master_key: key,
              value: val,
              sort_order: idx,
              active: true,
              updated_at: new Date().toISOString(),
            });
          });
        }
        if (ddRows.length > 0) {
          await (supabase.from("dropdown_masters") as any).upsert(ddRows, { onConflict: "id" });
        }
      } catch (ddErr) {
        console.warn("[settings] Dropdown masters relational sync:", ddErr);
      }
    }

    // Also sync normalized custom field definitions
    if (Array.isArray(snapshot.formsMetadata)) {
      try {
        const fieldRows: any[] = [];
        const customFirmId = firmId || "default_firm";
        for (const form of snapshot.formsMetadata as FormMetadata[]) {
          (form.fields || []).forEach((f, idx) => {
            fieldRows.push({
              firm_id: customFirmId,
              entity_type: form.type || form.id,
              field_code: f.name,
              field_label: f.label,
              field_type: f.type,
              options: f.options ? JSON.stringify(f.options) : null,
              default_value: f.defaultValue ?? null,
              is_required: !!f.required,
              display_order: idx,
              section_label: form.name,
              is_active: true,
              updated_at: new Date().toISOString(),
            });
          });
        }
        if (fieldRows.length > 0) {
          await (supabase.from("custom_field_definitions") as any).upsert(fieldRows, {
            onConflict: "firm_id,entity_type,field_code",
          });
        }
      } catch (cfErr) {
        console.warn("[settings] Custom fields relational sync:", cfErr);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    notifySettingsPersistFailure(message || "Failed to persist firm settings.");
    console.warn("[settings] Failed to persist to Supabase:", err);
  }
}

/** Saves a single branch row to the branches table */
async function saveBranchToDb(b: {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  managerName: string;
  gstin?: string;
  active: boolean;
  isDefault?: boolean;
}): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth?.session?.user?.id;
    if (!userId) {
      console.warn("[settings] Skipping branch persistence: not signed in.");
      return;
    }
    const { data: profile } = await supabase
      .from("user_profiles" as never)
      .select("firm_id")
      .eq("auth_id", userId)
      .maybeSingle();
    const firmId = (profile as { firm_id?: string } | null)?.firm_id;
    if (!firmId) {
      console.warn("[settings] Skipping branch persistence: firm identity is unavailable.");
      return;
    }
    await supabase.from("branches").upsert(
      [
        {
          id: b.id,
          firm_id: firmId,
          name: b.name,
          short_name: b.code,
          branch_type: "main",
          address: b.address,
          phone: b.phone,
          gstin: b.gstin ?? null,
          active: b.active,
          data: { managerName: b.managerName, isDefault: b.isDefault ?? false },
          updated_at: new Date().toISOString(),
        },
      ] as any,
      { onConflict: "id" },
    );
  } catch (err) {
    console.warn("[settings] Failed to persist branch:", err);
  }
}

async function deleteBranchFromDb(id: string): Promise<void> {
  try {
    await supabase.from("branches").delete().eq("id", id);
  } catch (err) {
    console.warn("[settings] Failed to delete branch:", err);
  }
}

async function saveWorkshopToDb(w: {
  id: string;
  name: string;
  type: string;
  branchId: string;
  active: boolean;
  description?: string;
}): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth?.session?.user?.id;
    if (!userId) {
      console.warn("[settings] Skipping workshop persistence: not signed in.");
      return;
    }
    const { data: profile } = await supabase
      .from("user_profiles" as never)
      .select("firm_id")
      .eq("auth_id", userId)
      .maybeSingle();
    const firmId = (profile as { firm_id?: string } | null)?.firm_id;
    if (!firmId) {
      console.warn("[settings] Skipping workshop persistence: firm identity is unavailable.");
      return;
    }
    await (supabase.from("workshops") as any).upsert(
      [
        {
          id: w.id,
          firm_id: firmId,
          name: w.name,
          branch_id: w.branchId,
          data: {
            type: w.type,
            active: w.active,
            description: w.description ?? null,
          },
        },
      ],
      { onConflict: "id" },
    );
  } catch (err) {
    console.warn("[settings] Failed to persist workshop:", err);
  }
}

async function deleteWorkshopFromDb(id: string): Promise<void> {
  try {
    await supabase.from("workshops").delete().eq("id", id);
  } catch (err) {
    console.warn("[settings] Failed to delete workshop:", err);
  }
}

/** Collects the current state snapshot and saves it to app_settings */
function persistSettings(get: () => any, force = false): void {
  const s = get();

  const snapshot = {
    firm: s.firm,
    branding: s.branding,
    print: s.print,
    gst: s.gst,
    makingCharge: s.makingCharge,
    purities: s.purities,
    workshopProcesses: s.workshopProcesses,
    alloyFormulas: s.alloyFormulas,
    purityHelper: s.purityHelper,
    making: s.making,
    hardware: s.hardware,
    catalog: s.catalog,
    smtp: redactSmtpSettings(s.smtp),
    dropdowns: s.dropdowns,
    disabledDropdowns: s.disabledDropdowns,
    goldRatePerGramPaise: s.goldRatePerGramPaise,
    goldRate24KPerGramPaise: s.goldRate24KPerGramPaise,
    goldRate18KPerGramPaise: s.goldRate18KPerGramPaise,
    silverRatePerGramPaise: s.silverRatePerGramPaise,
    bullionRateProvider: redactBullionRateProvider(s.bullionRateProvider),
    language: s.language,
    developer: s.developer,
    users: s.users,
    invitations: s.invitations,
    securityLogs: s.securityLogs,
    printerProfiles: s.printerProfiles,
    documentTemplates: s.documentTemplates,
    complianceProfile: s.complianceProfile,
    formsMetadata: s.formsMetadata,
    campaignTemplates: s.campaignTemplates,
    commAutomation: s.commAutomation,
    branchSettings: (s.branchSettings ?? []).map((row: BranchSettings) => {
      const { smtpPassword: _ignored, ...safe } = row as BranchSettings & {
        smtpPassword?: string;
      };
      return safe;
    }),
    emailTemplates: s.emailTemplates,
  };

  // 1. Immediately cache snapshot to localStorage synchronously for instant offline & reload recovery
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(LOCAL_STORAGE_SETTINGS_CACHE_KEY, JSON.stringify(snapshot));
    }
  } catch (err) {
    console.warn("[settings] Failed to cache snapshot in localStorage:", err);
  }

  // Never write DEFAULT snapshot over the real database row before stored settings are read back.
  // Explicit saves or user changes with force=true bypass this gate.
  if (!s.settingsHydrated && !force) return;

  // Several related rate fields are updated by one dialog action. Serialize
  // the snapshots so concurrent upserts cannot finish out of order and leave
  // the remote row with only one of the edited rates.
  settingsWriteQueue = settingsWriteQueue
    .catch(() => undefined)
    .then(() => saveAppSettingsToDb(snapshot));
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  variables: string[]; // custom placeholder names, e.g. ["customer_name", "order_number"]
  createdAt: number;
}

export interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string; // e.g. Super Owner, Owner, Admin, Manager, Billing Staff, Workshop Manager, etc.
  permissions: Record<string, boolean>;
  active: boolean;
  createdAt: number;
  // Org placement
  branchId?: string;
  workshopId?: string; // e.g. "workshop_mfg_ich", "workshop_retail"
  department?: string; // e.g. "Accounts", "CRM", "Manufacturing"
  reportingManagerId?: string; // ID of the user they report to
  // Super Owner flag — above normal Owner, manages the ERP platform itself
  isSuperOwner?: boolean;
  locked?: boolean;
  landingDashboard?: string;
}

export interface WorkshopDefinition {
  id: string;
  name: string; // e.g. "Manufacturing Workshop — ICH"
  type: "manufacturing" | "repair" | "retail_counter" | "hallmark" | "accounts" | "crm" | "other";
  branchId: string;
  active: boolean;
  description?: string;
}

export interface InvitationItem {
  id: string;
  email: string;
  role: string;
  code: string;
  createdAt: number;
  expiresAt?: number; // Unix ms
  status: "pending" | "used" | "expired";
  // Extra details included in invitation email
  branchId?: string;
  workshopId?: string;
  tempPassword?: string; // optional one-time password
  invitedBy?: string; // email of the inviter
}

export interface BranchSettings {
  branchId: string;
  // Identity
  logoUrl?: string;
  logoStoragePath?: string;
  gstin?: string;
  address?: string;
  phone?: string;
  email?: string;
  // Invoice / barcode series
  invoiceSeries?: string;
  receiptSeries?: string;
  barcodeSeries?: string;
  // Communication per branch
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  /** Write-only in UI — never hydrated from Supabase. */
  smtpPasswordConfigured?: boolean;
  smtpFromName?: string;
  smtpFromEmail?: string;
  waPhoneNumber?: string;
  // Hardware
  thermalPrinterIp?: string;
  thermalPrinterPort?: string;
  // Gold rate preferences
  defaultKarat?: 22 | 24 | 18;
  goldRateSource?: "manual" | "api";
  /** Per-branch rate overrides. Unset/0 = fall back to the firm-wide rate. */
  goldRate24KOverridePaise?: number;
  goldRate22KOverridePaise?: number;
  goldRate18KOverridePaise?: number;
  silverRateOverridePaise?: number;
  // Print templates
  invoiceTemplateId?: string;
  receiptTemplateId?: string;
}

export interface SecurityLogItem {
  id: string;
  ts: number;
  action:
    | "login"
    | "failed login"
    | "rate limited"
    | "user created"
    | "permission changed"
    | "invoice deleted"
    | "gold edited";
  details: string;
  userEmail: string;
}

export interface FirmProfile {
  shopName: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  footerLine: string;
  terms: string;
  signatureLabelLeft: string;
  signatureLabelRight: string;
  ownerName?: string;
  pan?: string;
  cityState?: string;
  website?: string;
  whatsappNumber?: string;
  tagline?: string;
  logoUrl?: string;
  logoStoragePath?: string;
  /** R2 path — manual stamp scan; only printed when printStampEnabled. */
  stampImageStoragePath?: string;
  printStampEnabled?: boolean;
  /** R2 path — authorized signatory image. */
  authorizedSignatureStoragePath?: string;
  printSignatureEnabled?: boolean;
  /** Legacy verify-token QR on bills/slips — off by default. */
  printVerificationQrEnabled?: boolean;
  legalName?: string;
  brandName?: string;
  branchAddress?: string;
  stateCode?: string;
  registrationNo?: string;
  bankDetails?: { bankName?: string; accountNo?: string; ifsc?: string; branch?: string };
  upiQr?: string;
  defaultCurrency?: string;
  timeZone?: string;
  themeColors?: { primaryColor?: string; goldAccent?: string };
  socialLinks?: { instagram?: string; facebook?: string; twitter?: string };
  legalDisclaimer?: string;
  hostingerUploadUrl?: string;
  tenant_migration_status?: "NOT_STARTED" | "DEFERRED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  /** ISO timestamp — assisted setup wizard completed once (never re-gate). */
  assisted_setup_completed_at?: string;
  /** ManuBook / MTG surface enable — recovered shop settings. */
  manubookEnabled?: boolean;
  /**
   * Default purity (per-mille) pre-filled into new billing items, karigar
   * issue/return forms, vault entries, etc. when the user has not yet selected
   * a purity. Configurable per firm in Settings → Firm Profile.
   *
   * MTJ mandate: 995 is the operational default. Must never be hard-coded at
   * call-site. Zero / absent = fall back to MTJ_DEFAULT_PURITY_PERMILLE (995).
   *
   * DISTINCT from GoldCalculationRulesDoc.finenessBasis (the ÷denominator for
   * fine-gold arithmetic, typically 999). These are two different concepts.
   */
  defaultPurityPermille?: number;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  managerName: string;
  gstin?: string;
  active: boolean;
  isDefault: boolean;
  email?: string;
  bankAccount?: { bankName?: string; accountNo?: string; ifsc?: string; branch?: string };
  logoOverrideUrl?: string;
  printerProfiles?: string[];
  invoiceSeries?: string;
  receiptSeries?: string;
}

export interface PrinterProfile {
  id: string;
  name: string;
  type: "thermal" | "laser" | "inkjet" | "label";
  paperSize: "A4" | "A5" | "80mm" | "58mm" | "40x25" | "50x25";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
  colorMode: "bw" | "color";
  defaultCopies: number;
  quality: "draft" | "normal" | "high";
  archivalMode: boolean;
  templateMapping: string[]; // e.g. ["Invoice", "Receipt", "Job Card"]
}

export interface DocumentTemplate {
  id: string;
  name: string;
  fontSize: "xs" | "sm" | "base" | "lg";
  fontFamily: "Inter" | "Space Grotesk" | "Outfit" | "JetBrains Mono" | "Playfair Display";
  primaryColor: string;
  accentColor: string;
  showLogo: boolean;
  showHeaderAddress: boolean;
  showContact: boolean;
  showBranchDetails: boolean;
  showGst: boolean;
  showPan: boolean;
  showTerms: boolean;
  showSignatureBlocks: boolean;
  showBankDetails: boolean;
  showDisclaimer: boolean;
  showHuid: boolean;
  showPrintTimestamp: boolean;
  showPageNumbers: boolean;
  headerLayout: "standard" | "compact" | "centered";
  footerLayout: "standard" | "two_column" | "minimal";
  termsAndConditions: string;
  disclaimer: string;
  fieldsVisibility: Record<string, boolean>;
}

export interface ComplianceProfile {
  hsnCodeJewellery: string;
  sacCodeServices: string;
  hallmarkLicenseNo: string;
  bisRegistrationNo: string;
  panRequiredThresholdPaise: number;
  taxFields: { label: string; ratePct: number; active: boolean }[];
  stateCode: string;
}

export interface FormFieldMetadata {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "boolean" | "textarea";
  required: boolean;
  defaultValue?: string;
  options?: string[];
  validationRule?: string;
}

export interface FormMetadata {
  id: string;
  name: string;
  type: string;
  fields: FormFieldMetadata[];
  printTemplateId: string;
  pdfTemplateId: string;
  emailTemplateId: string;
  permissionsRequired: string[];
  approvalRequired: boolean;
}

export interface BranchRules {
  goldBookingMode: "centralized" | "branch-wise";
  stockAccessMode: "universal" | "branch-wise";
  billingSequenceMode: "universal" | "branch-wise";
}

export interface LanguageSettings {
  appLanguage: "en" | "mr" | "hi" | "bn";
  printLanguage: "en" | "mr" | "hi" | "bn";
  whatsappLanguage: "en" | "mr" | "hi" | "bn";
  staffLanguage: "en" | "mr" | "hi" | "bn";
}

export interface DeveloperSettings {
  avsName: string;
  contactNumber: string;
  email: string;
  logoUrl?: string;
  footerEnabled: boolean;
}

export interface Branding {
  applicationName: string;
  shortName: string;
  tagline: string;
  description: string;
  companyName: string;
  logoUrl?: string;
  supportEmail: string;
  supportPhone: string;
  website: string;
  primaryColor: string;
  goldAccent: string;
  /** Invoice/document accent (defaults to goldAccent) */
  accentColor?: string;
  headerColor?: string;
  footerColor?: string;
  textColor?: string;
  borderColor?: string;
  fontFamily?: string;
  printHeader: string;
}

export interface PrintTemplateSettings {
  invoiceHeader: string;
  invoiceFooter: string;
  showHUID: boolean;
  showPriceOnTag: boolean;
  showMakingOnTag: boolean;
  tagSize: "40x25" | "50x25";
  copyLabels: string[];
  voucherCalculationMode?: "fine_only" | "fine_wastage" | "custom";
  balanceSideLabels?: "jama_naam" | "credit_debit";
}

export interface GstSettings {
  enabled: boolean;
  splitMode: "cgst_sgst" | "igst";
  applyOnMakingAndStoneOnly: boolean;
  /**
   * auto: full invoice value when any line is full_value (ready stock);
   * making+stone+hallmark for job-work. total_value / making_stone_hallmark force one base.
   */
  taxableBase?: "auto" | "total_value" | "making_stone_hallmark";
  cgstPct: number; // store as tenths of percent? we'll keep as float
  sgstPct: number;
  igstPct: number;
  gstRatePct?: number;
  makingRatePct?: number;
  metalSplitPct?: number;
  makingSplitPct?: number;
  hsnJewellery?: string;
  sacServices?: string;
  panRequiredThresholdPaise?: number;
  cashLimitPaise?: number;

  // ── Tax Configuration — Customer GST Billing (Manufacturing Mode) ───────
  /** Shop-policy TCS. Not automatically 206C(1H) (0.1% after ₹50L/buyer/year). */
  tcsEnabled: boolean;
  /** Invoice grand-total-before-TCS threshold above which TCS is collected. */
  tcsThresholdPaise: number;
  /** TCS rate applied to the full invoice value once the threshold is crossed. */
  tcsRatePct: number;
  /** Whether a customer can settle the GST portion of an invoice in gold, not just cash. */
  allowGstPaymentInGold: boolean;
  /**
   * Gold rate (paise/gram) used specifically to convert the GST cash amount
   * into a fine-gold equivalent for display/settlement — kept independent of
   * the live market rate used for pricing the invoice items themselves, so a
   * CA can lock a specific conversion rate for tax purposes if needed. 0 means
   * "use the same live rate the invoice items were priced at".
   */
  gstGoldConversionRatePaise: number;
}

/**
 * Tenant-wide default for how making/labour charges are calculated, plus
 * optional per-category overrides. "percentage" (of gold value) is the
 * long-standing default and stays that way unless an admin explicitly
 * changes it — existing invoices are never affected, since each InvoiceItem
 * snapshots its own resolved basis/rate at creation time (see
 * resolveMakingCharge in calculation-engine.ts) rather than reading this
 * config live.
 */
export interface MakingChargeCategoryOverride {
  basis: "percentage" | "gross" | "net" | "fine" | "piece" | "carat" | "flat";
  /** Used when basis is "percentage". */
  percent?: number;
  /** Used for every other basis — paise per gram, per piece, per carat, or the flat amount itself. */
  ratePerUnitPaise?: number;
}
export interface MakingChargeSettings {
  defaultBasis: MakingChargeCategoryOverride["basis"];
  defaultPercent: number;
  defaultRatePerUnitPaise: number;
  /** Keyed by StockItem.category (case-sensitive, as stored). */
  categoryOverrides: Record<string, MakingChargeCategoryOverride>;
}

export interface Purity {
  id: string;
  /** Defaults to Gold for legacy records created before multi-metal support. */
  metal?: string;
  label: string;
  permille: number;
  active: boolean;
}

/** Workshop process types this ERP supports on the shared workshop-books framework. */
export type WorkshopProcessType =
  | "manufacturing"
  | "melting"
  | "kdm"
  | "meena"
  | "stone_setting"
  | "polish"
  | "cutting"
  | "casting"
  | "filing"
  | "setting"
  | "engraving"
  | "plating"
  | "rhodium"
  | "outside_work"
  | (string & {});

/**
 * Per-process configuration — allowable loss and labour calculation, driven
 * entirely from Settings so a process's economics can change without a code
 * change (V1.1 manufacturing spec, Phase 1: Configuration Foundation).
 */
export interface WorkshopProcessConfig {
  id: string;
  processType: WorkshopProcessType;
  label: string;
  active: boolean;
  /** Loss beyond this % of input weight is flagged as excess loss, never silently absorbed. */
  allowedLossPct: number;
  labourCalcMethod: "per_gram" | "fixed" | "per_piece";
  /** Interpreted per labourCalcMethod: per-gram rate, one fixed charge, or per-piece charge. */
  labourRatePaise: number;
  /** Whether this process can recover reclaimable gold (e.g. polish dust, cutting scrap). */
  recoveryApplicable: boolean;
  notes?: string;
}

/**
 * Purity conversion formula: source purity -> destination purity, with the
 * alloy ratio needed to make up the difference. permille values reference
 * Purity.permille — not FK-enforced in this client-side config, resolved by
 * value at conversion time.
 */
export interface AlloyFormula {
  id: string;
  /** Metal family this formula applies to; legacy records default to Gold. */
  metal?: string;
  active: boolean;
  fromPurityPermille: number;
  toPurityPermille: number;
  /** Alloy metal added per 1000mg of input fine gold, in mg. */
  alloyRatioMgPer1000: number;
  /** Expected process loss for this specific conversion, as a % of input weight. */
  expectedLossPct: number;
  version?: number;
  effectiveFrom?: string;
  components?: Array<{ metal: string; permille: number }>;
  notes?: string;
}

/** Defaults for the optional purity-check helper (never blocks posting). */
export interface PurityHelperSettings {
  fromPurityPermille: number;
  toPurityPermille: number;
}

/** Versioned multi-metal composition rule. Legacy AlloyFormula remains readable for migration. */
export interface MetalCompositionFormula {
  id: string;
  metal: string;
  targetPurityPermille: number;
  fineMetalPermille: number;
  components: Array<{ metal: string; permille: number }>;
  effectiveFrom: string;
  version: number;
  active: boolean;
  expectedLossPct: number;
  remarks?: string;
}

export interface MakingTemplate {
  id: string;
  category: string;
  purity: string;
  type: "per_gram" | "fixed";
  ratePerGramPaise: number;
  fixedPaise: number;
  notes?: string;
}

export interface HardwareSettings {
  scannerEnabled: boolean;
  printerLabel: string;
  labelSize: "40x25" | "50x25";
  f2FocusScanner: boolean;
  browserPrintMode: "dialog" | "silent_placeholder";
  scaleMode: "simulation" | "webserial";
  autoPopulateWeight: boolean;
  scaleBaudRate: number;
  /** Master switch — CashDrawerButton renders nothing and auto-open never fires when false. */
  cashDrawerEnabled: boolean;
  /** Only fires after a payment whose mode is exactly "cash" (not mixed/UPI/card/etc). */
  cashDrawerAutoOpenOnCash: boolean;
  /** Hex bytes, space-separated (e.g. "1B 70 00 19 FA") — the ESC/POS drawer-kick pulse sent through the connected receipt printer. */
  cashDrawerEscPosCommand: string;
}

export interface CatalogSettings {
  categories: string[];
  tags: string[];
  defaultPurity: string;
  defaultWeightMinG: number;
  defaultWeightMaxG: number;
  defaultTemplateId?: string;
  defaultPageSize?: "a4_portrait" | "a4_landscape" | "a5_portrait" | "square";
  defaultProductsPerPage?: number;
  showPrice?: boolean;
  showWeight?: boolean;
  showPurity?: boolean;
  showItemCode?: boolean;
  showDescription?: boolean;
  showHsn?: boolean;
  showFine?: boolean;
  showBranding?: boolean;
  showFooter?: boolean;
  showPageNumber?: boolean;
  headerTitle?: string;
  footerText?: string;
  themeBackground?: "white" | "cream" | "dark" | "gradient";
}

export interface SmtpSettings {
  host: string;
  port: number;
  username: string;
  passKey: string;
  fromEmail: string;
  fromName: string;
  useSsl: boolean;
  apiProvider: "smtp";
  apiKey: string;
}

export interface CampaignTemplates {
  emailInvoice: string;
  waInvoice: string;
  emailBirthday: string;
  waBirthday: string;
}

export interface CommAutomation {
  birthday: boolean;
  anniversary: boolean;
  invoice: boolean;
  payment: boolean;
  orderReady: boolean;
  repairReady: boolean;
}

export type DropdownKey =
  | "orderType"
  | "itemCategory"
  | "metalColor"
  | "repairType"
  | "paymentMode"
  | "workerRole"
  | "stockLocation"
  | "priority"
  | "sourceType"
  | "stoneType";

export const DROPDOWN_LABELS: Record<DropdownKey, string> = {
  orderType: "Order Type",
  itemCategory: "Item Category",
  metalColor: "Metal Color",
  repairType: "Repair Type",
  paymentMode: "Payment Mode",
  workerRole: "Worker Role",
  stockLocation: "Stock Location",
  priority: "Priority",
  sourceType: "Source Type",
  stoneType: "Stone Type",
};

/**
 * The selectable values of a master: everything configured, minus the retired
 * ones. Every picker in the app must go through this rather than reading
 * `dropdowns[key]` directly — otherwise a value the workshop disabled in
 * Settings keeps being offered on the very screens that create new records.
 *
 * `include` re-admits a value that is already on the record being edited, so
 * opening an old order whose category has since been retired doesn't silently
 * blank that field on save.
 */
export function activeDropdownValues(key: DropdownKey, include?: string | null): string[] {
  const { dropdowns, disabledDropdowns } = useSettings.getState();
  const disabled = new Set(disabledDropdowns[key] ?? []);
  const values = (dropdowns[key] ?? []).filter((v) => !disabled.has(v));
  if (include && !values.includes(include)) return [include, ...values];
  return values;
}

/**
 * MTJ mandate: 995 is the firm-level default purity (per-mille) for new forms.
 * Never hard-code 995 at call sites — always use this helper so it remains
 * configurable per firm without hunting down magic numbers.
 */
export const MTJ_DEFAULT_PURITY_PERMILLE = 995 as const;

/**
 * Returns the firm-configured default purity (per-mille) for new-item prefills.
 * Falls back to MTJ_DEFAULT_PURITY_PERMILLE (995) when not set.
 *
 * DISTINCT from finenessBasis (÷denominator, typically 999) — two separate concepts:
 *  - defaultPurityPermille = what the operator sees pre-filled in purity selectors
 *  - finenessBasis = the denominator in fine = gross × purity ÷ basis
 */
export function getDefaultPurityPermille(): number {
  const v = useSettings.getState().firm?.defaultPurityPermille;
  return v && v > 0 ? v : MTJ_DEFAULT_PURITY_PERMILLE;
}

/** Reactive form of `activeDropdownValues` — re-renders when Settings changes. */
export function useActiveDropdownValues(key: DropdownKey, include?: string | null): string[] {
  const values = useSettings((s) => s.dropdowns[key]);
  const disabled = useSettings((s) => s.disabledDropdowns[key]);
  return useMemo(() => {
    const off = new Set(disabled ?? []);
    const active = (values ?? []).filter((v) => !off.has(v));
    if (include && !active.includes(include)) return [include, ...active];
    return active;
  }, [values, disabled, include]);
}

export interface SettingsState {
  firm: FirmProfile;
  branding: Branding;
  print: PrintTemplateSettings;
  gst: GstSettings;
  makingCharge: MakingChargeSettings;
  purities: Purity[];
  workshopProcesses: WorkshopProcessConfig[];
  alloyFormulas: AlloyFormula[];
  purityHelper: PurityHelperSettings;
  making: MakingTemplate[];
  hardware: HardwareSettings;
  catalog: CatalogSettings;
  smtp: SmtpSettings;
  dropdowns: Record<DropdownKey, string[]>;
  /**
   * Master values that are retired: hidden from every picker, but still a
   * legal value on records that already carry them. Deleting a value a past
   * order/job card references would leave that record showing a category or
   * production type the system no longer admits exists — disabling is the
   * correct retirement path for a master a workshop has already used.
   */
  disabledDropdowns: Partial<Record<DropdownKey, string[]>>;
  goldRatePerGramPaise: number;
  goldRate24KPerGramPaise: number;
  goldRate18KPerGramPaise: number;
  silverRatePerGramPaise: number;
  /** Technical config for the live-rate provider used when a branch's
   *  goldRateSource is "api" (see bullion-rate-service.ts). Global, not
   *  per-branch — one subscription typically covers the whole business. */
  bullionRateProvider: BullionRateProviderConfig;
  language: LanguageSettings;
  developer: DeveloperSettings;
  branches: Branch[];
  selectedBranchId: string;
  branchRules: BranchRules;
  users: RegisteredUser[];
  invitations: InvitationItem[];
  securityLogs: SecurityLogItem[];
  printerProfiles: PrinterProfile[];
  documentTemplates: DocumentTemplate[];
  complianceProfile: ComplianceProfile;
  formsMetadata: FormMetadata[];

  /** Custom email templates for the owner email panel. */
  emailTemplates: EmailTemplate[];
  saveEmailTemplate: (t: Omit<EmailTemplate, "id" | "createdAt"> & { id?: string }) => void;
  deleteEmailTemplate: (id: string) => void;

  /** Campaign message templates (WhatsApp & Email bodies for automated sends). */
  campaignTemplates: CampaignTemplates;
  setCampaignTemplates: (t: Partial<CampaignTemplates>) => void;

  /** Automation rules — which channels auto-send on events. */
  commAutomation: CommAutomation;
  setCommAutomation: (a: Partial<CommAutomation>) => void;

  /** Workshop definitions — each branch can have multiple workshops */
  workshops: WorkshopDefinition[];
  setWorkshops: (workshops: WorkshopDefinition[]) => void;
  addWorkshop: (w: Omit<WorkshopDefinition, "id">) => void;
  updateWorkshop: (id: string, patch: Partial<WorkshopDefinition>) => void;
  removeWorkshop: (id: string) => void;

  /** Per-branch settings (overrides global firm settings for that branch) */
  branchSettings: BranchSettings[];
  getBranchSettings: (branchId: string) => BranchSettings;
  setBranchSettings: (branchId: string, patch: Partial<BranchSettings>) => void;

  /** Currently logged-in user's role — set by AuthGate on login. */
  currentUserRole: string | null;
  setCurrentUserRole: (role: string | null) => void;

  /**
   * True once the initial critical settings pull (data-loader.ts's
   * startCloudSync -> pullCritical) has resolved, success or failure. Routes
   * that redirect based on `firm.shopName` being empty (e.g. index.tsx's
   * first-run gate) must wait for this — otherwise every fresh page load
   * would briefly see the pre-hydration empty firm and bounce an already
   * configured business to /setup.
   */
  settingsHydrated: boolean;
  setSettingsHydrated: (v: boolean) => void;

  setFirm: (p: Partial<FirmProfile>) => void;
  setSmtp: (s: Partial<SmtpSettings>) => void;
  setUsers: (users: RegisteredUser[]) => void;
  addUser: (user: RegisteredUser) => void;
  updateUser: (id: string, patch: Partial<RegisteredUser>) => void;
  deleteUser: (id: string) => void;
  addInvitation: (invite: InvitationItem) => void;
  updateInvitation: (id: string, patch: Partial<InvitationItem>) => void;
  addSecurityLog: (
    action:
      | "login"
      | "failed login"
      | "rate limited"
      | "user created"
      | "permission changed"
      | "invoice deleted"
      | "gold edited",
    details: string,
    email: string,
  ) => void;
  setBranding: (p: Partial<Branding>) => void;
  setPrint: (p: Partial<PrintTemplateSettings>) => void;
  setGst: (p: Partial<GstSettings>) => void;
  setMakingCharge: (p: Partial<MakingChargeSettings>) => void;
  setHardware: (p: Partial<HardwareSettings>) => void;
  setCatalog: (p: Partial<CatalogSettings>) => void;
  setGoldRate: (paise: number) => void;
  setGoldRate24K: (paise: number) => void;
  setGoldRate18K: (paise: number) => void;
  setSilverRate: (paise: number) => void;
  setBullionRateProvider: (p: Partial<BullionRateProviderConfig>) => void;
  setLanguage: (l: Partial<LanguageSettings>) => void;
  setDeveloper: (d: Partial<DeveloperSettings>) => void;
  setSelectedBranchId: (id: string) => void;
  setBranches: (branches: Branch[]) => void;
  addBranch: (b: Omit<Branch, "id" | "isDefault">) => void;
  updateBranch: (id: string, patch: Partial<Branch>) => void;
  removeBranch: (id: string) => void;
  setDefaultBranch: (id: string) => void;
  setBranchRules: (rules: Partial<BranchRules>) => void;

  addPurity: (p: Omit<Purity, "id">) => void;
  updatePurity: (id: string, patch: Partial<Purity>) => void;
  removePurity: (id: string) => void;

  addWorkshopProcess: (p: Omit<WorkshopProcessConfig, "id">) => void;
  updateWorkshopProcess: (id: string, patch: Partial<WorkshopProcessConfig>) => void;
  removeWorkshopProcess: (id: string) => void;

  addAlloyFormula: (f: Omit<AlloyFormula, "id">) => void;
  updateAlloyFormula: (id: string, patch: Partial<AlloyFormula>) => void;
  removeAlloyFormula: (id: string) => void;
  setPurityHelper: (patch: Partial<PurityHelperSettings>) => void;

  addMaking: (m: Omit<MakingTemplate, "id">) => void;
  updateMaking: (id: string, patch: Partial<MakingTemplate>) => void;
  removeMaking: (id: string) => void;

  setDropdown: (key: DropdownKey, values: string[]) => void;
  addDropdownItem: (key: DropdownKey, value: string) => void;
  removeDropdownItem: (key: DropdownKey, value: string) => void;
  /** Renames a master value in place, keeping its position in the list. */
  renameDropdownItem: (key: DropdownKey, from: string, to: string) => void;
  /** Disables/re-enables a value: it disappears from pickers but stays a valid
   *  historical value, so records already carrying it still read correctly. */
  setDropdownItemDisabled: (key: DropdownKey, value: string, disabled: boolean) => void;

  setPrinterProfiles: (profiles: PrinterProfile[]) => void;
  addPrinterProfile: (profile: Omit<PrinterProfile, "id">) => void;
  updatePrinterProfile: (id: string, patch: Partial<PrinterProfile>) => void;
  removePrinterProfile: (id: string) => void;
  setDocumentTemplates: (templates: DocumentTemplate[]) => void;
  updateDocumentTemplate: (id: string, patch: Partial<DocumentTemplate>) => void;
  setComplianceProfile: (profile: Partial<ComplianceProfile>) => void;
  setFormsMetadata: (forms: FormMetadata[]) => void;
  addFormMetadata: (form: Omit<FormMetadata, "id">) => void;
  updateFormMetadata: (id: string, patch: Partial<FormMetadata>) => void;
  removeFormMetadata: (id: string) => void;

  resetAll: () => void;
}

const DEFAULT_PURITIES: Purity[] = [
  { id: "p_au_999", metal: "Gold", label: "24K / 999", permille: 999, active: true },
  { id: "p_au_916", metal: "Gold", label: "22K / 916", permille: 916, active: true },
  { id: "p_au_750", metal: "Gold", label: "18K / 750", permille: 750, active: true },
  { id: "p_au_585", metal: "Gold", label: "14K / 585", permille: 585, active: true },
  { id: "p_ag_999", metal: "Silver", label: "Fine Silver / 999", permille: 999, active: true },
  { id: "p_ag_925", metal: "Silver", label: "Sterling / 925", permille: 925, active: true },
];

/**
 * Starting allowed-loss/labour figures per process, sourced from the
 * pre-existing hardcoded assumptions in mfg-costing.ts / melt-store.ts so
 * behavior doesn't change the moment those callers switch to reading this
 * config — an owner tunes these per their own workshop from here on.
 */
const DEFAULT_WORKSHOP_PROCESSES: WorkshopProcessConfig[] = [
  {
    id: "wp_manufacturing",
    processType: "manufacturing",
    label: "Manufacturing",
    active: true,
    allowedLossPct: 2,
    labourCalcMethod: "per_gram",
    labourRatePaise: 0,
    recoveryApplicable: true,
  },
  {
    id: "wp_melting",
    processType: "melting",
    label: "Melting",
    active: true,
    allowedLossPct: 1,
    labourCalcMethod: "per_gram",
    labourRatePaise: 0,
    recoveryApplicable: true,
  },
  {
    id: "wp_kdm",
    processType: "kdm",
    label: "Manufacturing Material Making",
    active: true,
    allowedLossPct: 3,
    labourCalcMethod: "per_gram",
    labourRatePaise: 0,
    recoveryApplicable: true,
  },
  {
    id: "wp_meena",
    processType: "meena",
    label: "Meena (Enamel)",
    active: true,
    allowedLossPct: 1.5,
    labourCalcMethod: "per_piece",
    labourRatePaise: 0,
    recoveryApplicable: false,
  },
  {
    id: "wp_stone_setting",
    processType: "stone_setting",
    label: "Stone Setting",
    active: false,
    allowedLossPct: 0.5,
    labourCalcMethod: "per_piece",
    labourRatePaise: 0,
    recoveryApplicable: false,
  },
  {
    id: "wp_polish",
    processType: "polish",
    label: "Polish",
    active: true,
    allowedLossPct: 1,
    labourCalcMethod: "per_gram",
    labourRatePaise: 0,
    recoveryApplicable: true,
  },
  {
    id: "wp_cutting",
    processType: "cutting",
    label: "Cutting",
    active: true,
    allowedLossPct: 0.5,
    labourCalcMethod: "per_gram",
    labourRatePaise: 0,
    recoveryApplicable: true,
  },
  {
    id: "wp_casting",
    processType: "casting",
    label: "Casting",
    active: true,
    allowedLossPct: 1.5,
    labourCalcMethod: "per_gram",
    labourRatePaise: 0,
    recoveryApplicable: true,
  },
  {
    id: "wp_filing",
    processType: "filing",
    label: "Filing / Ghasai",
    active: true,
    allowedLossPct: 1.0,
    labourCalcMethod: "per_gram",
    labourRatePaise: 0,
    recoveryApplicable: true,
  },
  {
    id: "wp_setting",
    processType: "setting",
    label: "Setting / Jadhai",
    active: true,
    allowedLossPct: 0.5,
    labourCalcMethod: "per_piece",
    labourRatePaise: 0,
    recoveryApplicable: false,
  },
  {
    id: "wp_engraving",
    processType: "engraving",
    label: "Engraving / Chhilai",
    active: true,
    allowedLossPct: 0.5,
    labourCalcMethod: "per_piece",
    labourRatePaise: 0,
    recoveryApplicable: true,
  },
  {
    id: "wp_plating",
    processType: "plating",
    label: "Plating / Electroplating",
    active: true,
    allowedLossPct: 0.2,
    labourCalcMethod: "fixed",
    labourRatePaise: 0,
    recoveryApplicable: false,
  },
  {
    id: "wp_rhodium",
    processType: "rhodium",
    label: "Rhodium / Two-Tone",
    active: true,
    allowedLossPct: 0.2,
    labourCalcMethod: "per_piece",
    labourRatePaise: 0,
    recoveryApplicable: false,
  },
  {
    id: "wp_outside_work",
    processType: "outside_work",
    label: "Outside Work / Bahar Ka Kaam",
    active: true,
    allowedLossPct: 1.0,
    labourCalcMethod: "fixed",
    labourRatePaise: 0,
    recoveryApplicable: true,
  },
];

const DEFAULT_ALLOY_FORMULAS: AlloyFormula[] = [
  {
    id: "af_999_916",
    metal: "Gold",
    active: true,
    fromPurityPermille: 999,
    toPurityPermille: 916,
    alloyRatioMgPer1000: 90,
    expectedLossPct: 1,
    version: 1,
    effectiveFrom: "2026-01-01",
    components: [{ metal: "Alloy", permille: 1000 }],
  },
  {
    id: "af_999_750",
    metal: "Gold",
    active: true,
    fromPurityPermille: 999,
    toPurityPermille: 750,
    alloyRatioMgPer1000: 332,
    expectedLossPct: 1,
    version: 1,
    effectiveFrom: "2026-01-01",
    components: [{ metal: "Alloy", permille: 1000 }],
  },
];

const DEFAULT_DROPDOWNS: Record<DropdownKey, string[]> = {
  orderType: ["Custom", "Repair", "Polishing", "Ready Stock", "Wholesale"],
  itemCategory: [
    "Ring",
    "Chain",
    "Earring",
    "Pendant",
    "Bangle",
    "Necklace",
    "Bracelet",
    "Nose Pin",
  ],
  metalColor: ["Yellow", "White", "Rose"],
  repairType: ["Soldering", "Polish", "Re-size", "Re-string", "Tip Change", "Stone Setting"],
  paymentMode: ["Cash", "UPI", "Bank Transfer", "Card", "Gold Exchange"],
  workerRole: ["Master Karigar", "Helper", "Polisher", "Stone Setter", "Finisher"],
  stockLocation: ["Showroom", "Vault", "Display", "Workshop", "Repair Bench"],
  priority: ["Normal", "High", "Urgent"],
  sourceType: ["Walk-in", "Phone", "WhatsApp", "Referral", "Repeat Customer"],
  stoneType: ["Diamond", "Ruby", "Emerald", "Pearl", "CZ", "Other"],
};

const DEFAULT_PRINTER_PROFILES: PrinterProfile[] = [
  {
    id: "pr_laser_office",
    name: "Office Laser Printer",
    type: "laser",
    paperSize: "A4",
    orientation: "portrait",
    margins: { top: 12, right: 15, bottom: 15, left: 15 },
    colorMode: "color",
    defaultCopies: 1,
    quality: "normal",
    archivalMode: false,
    templateMapping: ["Invoice", "Estimate", "Ledger", "Reports"],
  },
  {
    id: "pr_thermal_slip",
    name: "Billing Slip Printer (Thermal)",
    type: "thermal",
    paperSize: "80mm",
    orientation: "portrait",
    margins: { top: 2, right: 2, bottom: 2, left: 2 },
    colorMode: "bw",
    defaultCopies: 1,
    quality: "normal",
    archivalMode: true,
    templateMapping: ["Receipt", "Repair Slip", "Worker Settlement", "Job Card"],
  },
  {
    id: "pr_label_tags",
    name: "Tag Label Printer",
    type: "label",
    paperSize: "40x25",
    orientation: "portrait",
    margins: { top: 1, right: 1, bottom: 1, left: 1 },
    colorMode: "bw",
    defaultCopies: 1,
    quality: "normal",
    archivalMode: false,
    templateMapping: ["Label"],
  },
];

const DEFAULT_DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "invoice",
    name: "Standard Invoice Template",
    fontSize: "sm",
    fontFamily: "Inter",
    primaryColor: "#0F172A",
    accentColor: "#C8A24B",
    showLogo: true,
    showHeaderAddress: true,
    showContact: true,
    showBranchDetails: true,
    showGst: true,
    showPan: true,
    showTerms: true,
    showSignatureBlocks: true,
    showBankDetails: true,
    showDisclaimer: true,
    showHuid: true,
    showPrintTimestamp: true,
    showPageNumbers: true,
    headerLayout: "standard",
    footerLayout: "standard",
    termsAndConditions:
      "Goods once sold will not be taken back. Subject to local jurisdiction. Gold purity as per specifications.",
    disclaimer: "This is a computer generated invoice and does not require physical signatures.",
    fieldsVisibility: {
      grossWeight: true,
      netWeight: true,
      makingCharge: true,
      stoneCharge: true,
      huid: true,
      purity: true,
    },
  },
  {
    id: "jobcard",
    name: "Workshop Job Card Template",
    fontSize: "xs",
    fontFamily: "JetBrains Mono",
    primaryColor: "#1E293B",
    accentColor: "#C8A24B",
    showLogo: false,
    showHeaderAddress: true,
    showContact: true,
    showBranchDetails: false,
    showGst: false,
    showPan: false,
    showTerms: true,
    showSignatureBlocks: true,
    showBankDetails: false,
    showDisclaimer: false,
    showHuid: true,
    showPrintTimestamp: true,
    showPageNumbers: false,
    headerLayout: "compact",
    footerLayout: "minimal",
    termsAndConditions:
      "Please retain this slip. Gold purity and weight will be confirmed on final receipt.",
    disclaimer: "Workshop authorized processing copy.",
    fieldsVisibility: {
      karigarName: true,
      expectedDate: true,
      metalPurity: true,
      designCategory: true,
    },
  },
  {
    id: "receipt",
    name: "Payment Receipt Template",
    fontSize: "sm",
    fontFamily: "Outfit",
    primaryColor: "#0F172A",
    accentColor: "#10B981",
    showLogo: true,
    showHeaderAddress: true,
    showContact: true,
    showBranchDetails: true,
    showGst: true,
    showPan: false,
    showTerms: false,
    showSignatureBlocks: true,
    showBankDetails: false,
    showDisclaimer: true,
    showHuid: false,
    showPrintTimestamp: true,
    showPageNumbers: false,
    headerLayout: "standard",
    footerLayout: "standard",
    termsAndConditions: "Receipt valid subject to realization of cheque/digital transaction.",
    disclaimer: "Thank you for your transaction.",
    fieldsVisibility: {
      paymentMode: true,
      referenceNo: true,
      receivedFrom: true,
    },
  },
  {
    id: "estimate",
    name: "Customer Estimate Template",
    fontSize: "sm",
    fontFamily: "Space Grotesk",
    primaryColor: "#334155",
    accentColor: "#C8A24B",
    showLogo: true,
    showHeaderAddress: true,
    showContact: true,
    showBranchDetails: true,
    showGst: false,
    showPan: false,
    showTerms: false,
    showSignatureBlocks: false,
    showBankDetails: false,
    showDisclaimer: true,
    showHuid: false,
    showPrintTimestamp: true,
    showPageNumbers: true,
    headerLayout: "centered",
    footerLayout: "minimal",
    termsAndConditions: "Estimate valid for current day rates only. Values tentative.",
    disclaimer: "This is an estimate/quotation slip, not a valid tax invoice.",
    fieldsVisibility: {
      estimatedCost: true,
      currentGoldRate: true,
    },
  },
  {
    id: "repair_slip",
    name: "Repair Intake Slip Template",
    fontSize: "sm",
    fontFamily: "Inter",
    primaryColor: "#1E293B",
    accentColor: "#F59E0B",
    showLogo: true,
    showHeaderAddress: true,
    showContact: true,
    showBranchDetails: false,
    showGst: false,
    showPan: false,
    showTerms: true,
    showSignatureBlocks: true,
    showBankDetails: false,
    showDisclaimer: true,
    showHuid: false,
    showPrintTimestamp: true,
    showPageNumbers: false,
    headerLayout: "standard",
    footerLayout: "standard",
    termsAndConditions: "Goods are stored at owner's risk. No responsibility for stone breakage.",
    disclaimer: "Intake receipt copy.",
    fieldsVisibility: {
      repairType: true,
      description: true,
      advancePaid: true,
    },
  },
  {
    id: "gold_settlement",
    name: "Metal Settlement Template",
    fontSize: "sm",
    fontFamily: "JetBrains Mono",
    primaryColor: "#0F172A",
    accentColor: "#C8A24B",
    showLogo: false,
    showHeaderAddress: true,
    showContact: true,
    showBranchDetails: true,
    showGst: false,
    showPan: true,
    showTerms: true,
    showSignatureBlocks: true,
    showBankDetails: false,
    showDisclaimer: true,
    showHuid: false,
    showPrintTimestamp: true,
    showPageNumbers: true,
    headerLayout: "compact",
    footerLayout: "two_column",
    termsAndConditions:
      "Settlement calculated at declared touches and rates. Signatures enforce finality.",
    disclaimer: "Durable ledger balance acknowledgement.",
    fieldsVisibility: {
      goldWeight: true,
      purity: true,
      adjustedGoldValue: true,
    },
  },
  {
    id: "worker_settlement",
    name: "Worker Settlement Template",
    fontSize: "sm",
    fontFamily: "Inter",
    primaryColor: "#0F172A",
    accentColor: "#C8A24B",
    showLogo: false,
    showHeaderAddress: true,
    showContact: false,
    showBranchDetails: true,
    showGst: false,
    showPan: false,
    showTerms: true,
    showSignatureBlocks: true,
    showBankDetails: false,
    showDisclaimer: true,
    showHuid: false,
    showPrintTimestamp: true,
    showPageNumbers: false,
    headerLayout: "compact",
    footerLayout: "standard",
    termsAndConditions: "Wages settled as per job work calculations. Final balances signed off.",
    disclaimer: "Internal payroll / subcontractor payment voucher.",
    fieldsVisibility: {
      wagesEarned: true,
      tdsDeducted: true,
      netPaid: true,
    },
  },
  {
    id: "ledger",
    name: "Customer Ledger Template",
    fontSize: "sm",
    fontFamily: "Inter",
    primaryColor: "#0F172A",
    accentColor: "#C8A24B",
    showLogo: true,
    showHeaderAddress: true,
    showContact: true,
    showBranchDetails: true,
    showGst: false,
    showPan: false,
    showTerms: false,
    showSignatureBlocks: true,
    showBankDetails: true,
    showDisclaimer: true,
    showHuid: false,
    showPrintTimestamp: true,
    showPageNumbers: true,
    headerLayout: "standard",
    footerLayout: "two_column",
    termsAndConditions: "Ledger subject to continuous audit. Report discrepancies immediately.",
    disclaimer: "Statement of Account.",
    fieldsVisibility: {
      runningBalance: true,
      paymentDetails: true,
    },
  },
  {
    id: "reports",
    name: "Dynamic Report Layout Template",
    fontSize: "xs",
    fontFamily: "Inter",
    primaryColor: "#1E293B",
    accentColor: "#334155",
    showLogo: false,
    showHeaderAddress: true,
    showContact: false,
    showBranchDetails: true,
    showGst: false,
    showPan: false,
    showTerms: false,
    showSignatureBlocks: false,
    showBankDetails: false,
    showDisclaimer: false,
    showHuid: false,
    showPrintTimestamp: true,
    showPageNumbers: true,
    headerLayout: "centered",
    footerLayout: "minimal",
    termsAndConditions: "",
    disclaimer: "AVS ERP Auto-Generated Analytical Summary. Confidential.",
    fieldsVisibility: {
      totals: true,
      subtotals: true,
    },
  },
];

const DEFAULT_COMPLIANCE_PROFILE: ComplianceProfile = {
  hsnCodeJewellery: "7113",
  sacCodeServices: "9988",
  hallmarkLicenseNo: "",
  bisRegistrationNo: "",
  panRequiredThresholdPaise: 20000000,
  stateCode: "",
  taxFields: [
    { label: "CGST @ 1.5%", ratePct: 1.5, active: true },
    { label: "SGST @ 1.5%", ratePct: 1.5, active: true },
    { label: "IGST @ 3%", ratePct: 3, active: false },
  ],
};

const DEFAULT_FORMS_METADATA: FormMetadata[] = [
  {
    id: "customer_kyc",
    name: "Customer KYC Form",
    type: "kyc",
    fields: [
      { name: "fullName", label: "Full Name", type: "text", required: true },
      {
        name: "phone",
        label: "Phone Number",
        type: "text",
        required: true,
        validationRule: "phone",
      },
      { name: "aadhaar", label: "Aadhaar Card No", type: "text", required: true },
      { name: "pan", label: "PAN Card No", type: "text", required: false, validationRule: "pan" },
      { name: "address", label: "Residential Address", type: "textarea", required: true },
      { name: "dob", label: "Date of Birth", type: "date", required: false },
    ],
    printTemplateId: "ledger",
    pdfTemplateId: "ledger",
    emailTemplateId: "ledger",
    permissionsRequired: ["people.edit"],
    approvalRequired: false,
  },
  {
    id: "order_intake",
    name: "Custom Order Intake Form",
    type: "order",
    fields: [
      {
        name: "itemCategory",
        label: "Item Category",
        type: "select",
        required: true,
        options: ["Ring", "Chain", "Earring", "Pendant", "Bangle", "Necklace"],
      },
      {
        name: "metalPurity",
        label: "Purity Required",
        type: "select",
        required: true,
        options: ["22K / 916", "24K / 999", "18K / 750"],
      },
      { name: "approxWeightG", label: "Estimated Weight (g)", type: "number", required: true },
      { name: "advancePaidPaise", label: "Advance Amount (Rs.)", type: "number", required: false },
      { name: "expectedDelivery", label: "Expected Delivery Date", type: "date", required: true },
      {
        name: "designNotes",
        label: "Design Notes / Instructions",
        type: "textarea",
        required: false,
      },
    ],
    printTemplateId: "jobcard",
    pdfTemplateId: "jobcard",
    emailTemplateId: "jobcard",
    permissionsRequired: ["orders.edit"],
    approvalRequired: true,
  },
  {
    id: "repair_intake",
    name: "Repair Slip Intake Form",
    type: "repair",
    fields: [
      {
        name: "repairType",
        label: "Repair Type",
        type: "select",
        required: true,
        options: ["Soldering", "Polish", "Re-size", "Stone Setting"],
      },
      { name: "itemDescription", label: "Item Description", type: "text", required: true },
      { name: "weightG", label: "Intake Weight (g)", type: "number", required: true },
      {
        name: "advancePaidPaise",
        label: "Advance Received (Rs.)",
        type: "number",
        required: false,
      },
      { name: "instructions", label: "Repair Instructions", type: "textarea", required: false },
    ],
    printTemplateId: "repair_slip",
    pdfTemplateId: "repair_slip",
    emailTemplateId: "repair_slip",
    permissionsRequired: ["repair.edit"],
    approvalRequired: false,
  },
];

const DEFAULTS: Omit<SettingsState, keyof Functions> = {
  firm: {
    shopName: "",
    phone: "",
    email: "",
    address: "",
    cityState: "",
    gstin: "",
    footerLine: "Thank you for your business.",
    terms: "Goods once sold will not be taken back.",
    signatureLabelLeft: "Customer Signature",
    signatureLabelRight: "Authorised Signatory",
    ownerName: "",
    pan: "",
    website: "",
    whatsappNumber: "",
    tagline: "",
    logoUrl: "",
    logoStoragePath: "",
    stampImageStoragePath: "",
    printStampEnabled: false,
    authorizedSignatureStoragePath: "",
    printSignatureEnabled: false,
    printVerificationQrEnabled: false,
    brandName: "",
    branchAddress: "",
    stateCode: "",
    registrationNo: "",
    bankDetails: {
      bankName: "",
      accountNo: "",
      ifsc: "",
      branch: "",
    },
    upiQr: "",
    defaultCurrency: "INR",
    timeZone: "Asia/Kolkata",
    themeColors: { primaryColor: "#0F172A", goldAccent: "#C8A24B" },
    socialLinks: {
      instagram: "",
      facebook: "",
    },
    legalDisclaimer:
      "Purity certified under BIS guidelines. Hallmark charges applicable extra as per regulations.",
    /**
     * 995 = MTJ operational default. Configurable per firm.
     * Do NOT change this default — use setFirm({ defaultPurityPermille: X }) instead.
     */
    defaultPurityPermille: 995,
  },
  branding: {
    applicationName: "AVS ERP",
    shortName: "ERP",
    tagline: "Powered by Arivahly Venture Sphere",
    description: "Professional Jewellery Manufacturing ERP",
    companyName: "Arivahly Venture Sphere",
    supportEmail: "",
    supportPhone: "",
    website: "https://arivahly.in/",
    primaryColor: "#0F172A",
    goldAccent: "#C8A24B",
    accentColor: "#C8A24B",
    headerColor: "#0F172A",
    footerColor: "#F8FAFC",
    textColor: "#1E293B",
    borderColor: "#CBD5E1",
    fontFamily: "Inter, system-ui, sans-serif",
    printHeader: "",
  },
  print: {
    invoiceHeader: "TAX INVOICE",
    invoiceFooter: "Thank you for your business.",
    showHUID: true,
    showPriceOnTag: true,
    showMakingOnTag: false,
    tagSize: "40x25",
    copyLabels: ["Customer Copy", "Office Copy", "Karigar Copy"],
    voucherCalculationMode: "fine_only",
    balanceSideLabels: "jama_naam",
  },
  gst: {
    enabled: false, // Defaulting to FALSE as confirmed ("likely OFF unless the bill is a GST bill")
    splitMode: "cgst_sgst",
    applyOnMakingAndStoneOnly: true,
    taxableBase: "auto",
    cgstPct: 1.5,
    sgstPct: 1.5,
    igstPct: 3,
    gstRatePct: 3,
    makingRatePct: 5,
    metalSplitPct: 85,
    makingSplitPct: 15,
    hsnJewellery: "71131910",
    sacServices: "9988",
    panRequiredThresholdPaise: 20000000, // ₹2,00,000
    cashLimitPaise: 1000000, // ₹10,000
    tcsEnabled: false,
    tcsThresholdPaise: 20000000, // ₹2,00,000 house default — not statutory 206C(1H)
    tcsRatePct: 1,
    allowGstPaymentInGold: false,
    gstGoldConversionRatePaise: 0, // 0 = use the live rate the invoice was priced at
  },
  makingCharge: {
    defaultBasis: "percentage", // preserves the long-standing "% of gold value" behavior
    defaultPercent: 12,
    defaultRatePerUnitPaise: 0,
    categoryOverrides: {},
  },
  purities: DEFAULT_PURITIES,
  workshopProcesses: DEFAULT_WORKSHOP_PROCESSES,
  alloyFormulas: DEFAULT_ALLOY_FORMULAS,
  purityHelper: { fromPurityPermille: 999, toPurityPermille: 920 },
  making: [],
  hardware: {
    scannerEnabled: true,
    printerLabel: "Default browser printer",
    labelSize: "40x25",
    f2FocusScanner: true,
    browserPrintMode: "dialog",
    scaleMode: "simulation",
    autoPopulateWeight: true,
    scaleBaudRate: 9600,
    cashDrawerEnabled: false,
    cashDrawerAutoOpenOnCash: false,
    cashDrawerEscPosCommand: "1B 70 00 19 FA",
  },
  catalog: {
    categories: ["Ring", "Chain", "Earring", "Pendant", "Bangle", "Necklace"],
    tags: ["Bestseller", "New", "Festival", "Bridal"],
    defaultPurity: "22K / 916",
    defaultWeightMinG: 2,
    defaultWeightMaxG: 25,
    defaultTemplateId: "tpl_classic",
    defaultPageSize: "a4_portrait",
    defaultProductsPerPage: 4,
    showPrice: true,
    showWeight: true,
    showPurity: true,
    showItemCode: true,
    showDescription: false,
    showHsn: false,
    showFine: true,
    showBranding: true,
    showFooter: true,
    showPageNumber: true,
    headerTitle: "EXQUISITE JEWELLERY CATALOGUE",
    footerText: "Certified 100% Hallmarked Jewellery • All weights approximate",
    themeBackground: "cream",
  },
  smtp: {
    host: "",
    port: 587,
    username: "",
    passKey: "",
    fromEmail: "",
    fromName: "",
    useSsl: false,
    apiProvider: "smtp",
    apiKey: "",
  },
  dropdowns: DEFAULT_DROPDOWNS,
  disabledDropdowns: {},
  goldRatePerGramPaise: 0,
  goldRate24KPerGramPaise: 0,
  goldRate18KPerGramPaise: 0,
  silverRatePerGramPaise: 0,
  bullionRateProvider: DEFAULT_BULLION_RATE_PROVIDER_CONFIG,
  language: {
    appLanguage: "en",
    printLanguage: "en",
    whatsappLanguage: "en",
    staffLanguage: "en",
  },
  developer: {
    avsName: "AVS ERP — a product by AVS, Arivahly Venture Sphere",
    contactNumber: "",
    email: "",
    logoUrl: "",
    footerEnabled: true,
  },
  branches: [
    {
      id: "MAIN",
      name: "Main Branch",
      code: "MAIN",
      address: "",
      phone: "",
      managerName: "",
      gstin: "",
      active: true,
      isDefault: true,
      email: "",
      bankAccount: {
        bankName: "",
        accountNo: "",
        ifsc: "",
        branch: "",
      },
      logoOverrideUrl: "",
      printerProfiles: ["pr_laser_office"],
      invoiceSeries: "INV-2026-",
      receiptSeries: "REC-2026-",
    },
  ],
  selectedBranchId: "MAIN",
  branchRules: {
    goldBookingMode: "branch-wise",
    stockAccessMode: "branch-wise",
    billingSequenceMode: "branch-wise",
  },
  users: [
    {
      id: "owner_default",
      name: "Owner",
      email: "",
      phone: "",
      role: "Owner",
      permissions: {},
      active: true,
      createdAt: 1718841600000,
    },
  ],
  invitations: [],
  securityLogs: [],
  printerProfiles: DEFAULT_PRINTER_PROFILES,
  documentTemplates: DEFAULT_DOCUMENT_TEMPLATES,
  complianceProfile: DEFAULT_COMPLIANCE_PROFILE,
  formsMetadata: DEFAULT_FORMS_METADATA,
  currentUserRole: null,
  settingsHydrated: false,
  emailTemplates: [],
  campaignTemplates: {
    emailInvoice:
      "Namaste {{customer_name}}, your invoice {{invoice_number}} is ready. Total due: {{due_amount}}.",
    waInvoice:
      "नमस्कार {{customer_name}} जी, आपका Invoice {{invoice_number}} तैयार है। कुल: {{due_amount}}।",
    emailBirthday:
      "Dear {{customer_name}}, wishing you a very happy birthday from {{branch_name}}!",
    waBirthday: "नमस्कार {{customer_name}} जी, आपकी ओर से जन्मदिन की हार्दिक शुभकामनाएं! 🎉",
  },
  commAutomation: {
    birthday: true,
    anniversary: true,
    invoice: true,
    payment: true,
    orderReady: true,
    repairReady: true,
  },
  // branchId values here must match real ids in `branches` above (MAIN /
  // WORKSHOP) — this array previously referenced branch-store.ts's own
  // hardcoded, disconnected branch ids (branch_mfg_ich / branch_mfg_gkp /
  // branch_retail_ich), none of which exist in `branches`, so every
  // default-seeded workshop was silently orphaned from any real branch.
  workshops: [
    {
      id: "workshop_main",
      name: "Main Workshop",
      type: "manufacturing",
      branchId: "MAIN",
      active: true,
    },
  ] as WorkshopDefinition[],
  branchSettings: [] as BranchSettings[],
};

type Functions = Pick<
  SettingsState,
  | "setFirm"
  | "setSmtp"
  | "setBranding"
  | "setPrint"
  | "setGst"
  | "setMakingCharge"
  | "setHardware"
  | "setBullionRateProvider"
  | "setCatalog"
  | "setGoldRate"
  | "setGoldRate24K"
  | "setGoldRate18K"
  | "setSilverRate"
  | "setLanguage"
  | "setDeveloper"
  | "setSelectedBranchId"
  | "setBranches"
  | "addBranch"
  | "updateBranch"
  | "removeBranch"
  | "setDefaultBranch"
  | "setBranchRules"
  | "deleteUser"
  | "addPurity"
  | "updatePurity"
  | "removePurity"
  | "addWorkshopProcess"
  | "updateWorkshopProcess"
  | "removeWorkshopProcess"
  | "addAlloyFormula"
  | "updateAlloyFormula"
  | "removeAlloyFormula"
  | "setPurityHelper"
  | "addMaking"
  | "updateMaking"
  | "removeMaking"
  | "setDropdown"
  | "addDropdownItem"
  | "removeDropdownItem"
  | "renameDropdownItem"
  | "setDropdownItemDisabled"
  | "resetAll"
  | "setUsers"
  | "addUser"
  | "updateUser"
  | "addInvitation"
  | "updateInvitation"
  | "addSecurityLog"
  | "setPrinterProfiles"
  | "addPrinterProfile"
  | "updatePrinterProfile"
  | "removePrinterProfile"
  | "setDocumentTemplates"
  | "updateDocumentTemplate"
  | "setComplianceProfile"
  | "setFormsMetadata"
  | "addFormMetadata"
  | "updateFormMetadata"
  | "removeFormMetadata"
  | "saveEmailTemplate"
  | "deleteEmailTemplate"
  | "setWorkshops"
  | "addWorkshop"
  | "updateWorkshop"
  | "removeWorkshop"
  | "setBranchSettings"
  | "getBranchSettings"
  | "setCurrentUserRole"
  | "setSettingsHydrated"
  | "setCampaignTemplates"
  | "setCommAutomation"
>;

function id(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useSettings = create<SettingsState>()((set, get) => ({
  ...loadInitialCachedSettings(DEFAULTS),
  setFirm: (p) => {
    set({ firm: { ...get().firm, ...p } });
    persistSettings(get);
  },
  setSmtp: (s) => {
    set({ smtp: { ...get().smtp, ...s } });
    persistSettings(get);
  },
  setBranding: (p) => {
    set({ branding: { ...get().branding, ...p } });
    persistSettings(get);
  },
  setPrint: (p) => {
    set({ print: { ...get().print, ...p } });
    persistSettings(get);
  },
  setGst: (p) => {
    set({ gst: { ...get().gst, ...p } });
    persistSettings(get);
  },
  setMakingCharge: (p) => {
    set({ makingCharge: { ...get().makingCharge, ...p } });
    persistSettings(get);
  },
  setHardware: (p) => {
    set({ hardware: { ...get().hardware, ...p } });
    persistSettings(get);
  },
  setCatalog: (p) => {
    set({ catalog: { ...get().catalog, ...p } });
    persistSettings(get);
  },
  setGoldRate: (paise) => {
    set({ goldRatePerGramPaise: paise });
    // A deliberate bullion-rate edit is an explicit operator action. It must
    // not be dropped merely because the background settings pull is still
    // completing during the first authenticated page load.
    persistSettings(get, true);
  },
  setGoldRate24K: (paise) => {
    set({ goldRate24KPerGramPaise: paise });
    persistSettings(get, true);
  },
  setGoldRate18K: (paise) => {
    set({ goldRate18KPerGramPaise: paise });
    persistSettings(get, true);
  },
  setSilverRate: (paise) => {
    set({ silverRatePerGramPaise: paise });
    persistSettings(get, true);
  },
  setBullionRateProvider: (p) => {
    set({
      bullionRateProvider: {
        ...get().bullionRateProvider,
        ...p,
        httpProvider: { ...get().bullionRateProvider.httpProvider, ...(p.httpProvider ?? {}) },
      },
    });
    persistSettings(get);
  },
  setLanguage: (l) => {
    set({ language: { ...get().language, ...l } });
    persistSettings(get);
  },
  setDeveloper: (d) => {
    set({ developer: { ...get().developer, ...d } });
    persistSettings(get);
  },
  setSelectedBranchId: (id) => set({ selectedBranchId: id }),
  setBranches: (branches) => set({ branches }),
  addBranch: (b) => {
    void (async () => {
      const { data: allowed } = await supabase.rpc("check_organization_limit", {
        p_resource: "branches",
      });
      if (allowed === false) {
        console.warn("[settings] Plan allows one branch only. Existing branch was kept.");
        return;
      }
      const newBranchId = id("br");
      const newBranch = { ...b, id: newBranchId, isDefault: false };
      set({ branches: [...get().branches, newBranch] });
      void saveBranchToDb(newBranch);
    })();
  },
  updateBranch: (bid, patch) => {
    set({ branches: get().branches.map((b) => (b.id === bid ? { ...b, ...patch } : b)) });
    const updated = get().branches.find((b) => b.id === bid);
    if (updated) void saveBranchToDb(updated);
  },
  removeBranch: (bid) => {
    const remaining = get().branches.filter((b) => b.id !== bid);
    let selectedId = get().selectedBranchId;
    if (selectedId === bid) {
      const newDefault = remaining.find((b) => b.isDefault) || remaining[0];
      selectedId = newDefault ? newDefault.id : "MAIN";
    }
    set({ branches: remaining, selectedBranchId: selectedId });
    void deleteBranchFromDb(bid);
  },
  setDefaultBranch: (bid) => {
    const updated = get().branches.map((b) => ({ ...b, isDefault: b.id === bid }));
    set({ branches: updated });
    // Update all branches in DB (clear then set default)
    updated.forEach((b) => void saveBranchToDb(b));
  },
  setBranchRules: (rules) => {
    set({ branchRules: { ...get().branchRules, ...rules } });
    persistSettings(get);
  },

  addPurity: (p) => {
    set({ purities: [...get().purities, { ...p, id: id("p") }] });
    persistSettings(get);
  },
  updatePurity: (pid, patch) => {
    set({ purities: get().purities.map((x) => (x.id === pid ? { ...x, ...patch } : x)) });
    persistSettings(get);
  },
  removePurity: (pid) => {
    set({ purities: get().purities.filter((x) => x.id !== pid) });
    persistSettings(get);
  },

  addWorkshopProcess: (p) => {
    set({ workshopProcesses: [...get().workshopProcesses, { ...p, id: id("wp") }] });
    persistSettings(get);
  },
  updateWorkshopProcess: (pid, patch) => {
    set({
      workshopProcesses: get().workshopProcesses.map((x) =>
        x.id === pid ? { ...x, ...patch } : x,
      ),
    });
    persistSettings(get);
  },
  removeWorkshopProcess: (pid) => {
    set({ workshopProcesses: get().workshopProcesses.filter((x) => x.id !== pid) });
    persistSettings(get);
  },

  addAlloyFormula: (f) => {
    set({ alloyFormulas: [...get().alloyFormulas, { ...f, id: id("af") }] });
    persistSettings(get);
  },
  updateAlloyFormula: (fid, patch) => {
    set({
      alloyFormulas: get().alloyFormulas.map((x) => (x.id === fid ? { ...x, ...patch } : x)),
    });
    persistSettings(get);
  },
  removeAlloyFormula: (fid) => {
    set({ alloyFormulas: get().alloyFormulas.filter((x) => x.id !== fid) });
    persistSettings(get);
  },

  setPurityHelper: (patch) => {
    set({ purityHelper: { ...get().purityHelper, ...patch } });
    persistSettings(get);
  },

  addMaking: (m) => {
    set({ making: [...get().making, { ...m, id: id("m") }] });
    persistSettings(get);
  },
  updateMaking: (mid, patch) => {
    set({ making: get().making.map((x) => (x.id === mid ? { ...x, ...patch } : x)) });
    persistSettings(get);
  },
  removeMaking: (mid) => {
    set({ making: get().making.filter((x) => x.id !== mid) });
    persistSettings(get);
  },

  setDropdown: (key, values) => {
    set({ dropdowns: { ...get().dropdowns, [key]: values } });
    persistSettings(get);
  },
  addDropdownItem: (key, value) => {
    const v = value.trim();
    if (!v) return;
    const cur = get().dropdowns[key];
    if (cur.includes(v)) return;
    set({ dropdowns: { ...get().dropdowns, [key]: [...cur, v] } });
    persistSettings(get);
  },
  removeDropdownItem: (key, value) => {
    set({
      dropdowns: { ...get().dropdowns, [key]: get().dropdowns[key].filter((v) => v !== value) },
      disabledDropdowns: {
        ...get().disabledDropdowns,
        [key]: (get().disabledDropdowns[key] ?? []).filter((v) => v !== value),
      },
    });
    persistSettings(get);
  },
  renameDropdownItem: (key, from, to) => {
    const v = to.trim();
    const cur = get().dropdowns[key];
    if (!v || v === from || !cur.includes(from) || cur.includes(v)) return;
    set({
      dropdowns: { ...get().dropdowns, [key]: cur.map((x) => (x === from ? v : x)) },
      disabledDropdowns: {
        ...get().disabledDropdowns,
        [key]: (get().disabledDropdowns[key] ?? []).map((x) => (x === from ? v : x)),
      },
    });
    persistSettings(get);
  },
  setDropdownItemDisabled: (key, value, disabled) => {
    const cur = get().disabledDropdowns[key] ?? [];
    const next = disabled
      ? cur.includes(value)
        ? cur
        : [...cur, value]
      : cur.filter((v) => v !== value);
    set({ disabledDropdowns: { ...get().disabledDropdowns, [key]: next } });
    persistSettings(get);
  },

  setUsers: (users) => {
    set({ users });
    persistSettings(get);
  },
  addUser: (user) => {
    set({ users: [...get().users, user] });
    persistSettings(get);
  },
  updateUser: (uid, patch) => {
    set({ users: get().users.map((u) => (u.id === uid ? { ...u, ...patch } : u)) });
    persistSettings(get);
  },
  deleteUser: (uid) => {
    set({ users: get().users.filter((u) => u.id !== uid) });
    persistSettings(get);
  },
  addInvitation: (invite) => {
    set({ invitations: [...get().invitations, invite] });
    persistSettings(get, true);
  },
  updateInvitation: (iid, patch) => {
    set({ invitations: get().invitations.map((i) => (i.id === iid ? { ...i, ...patch } : i)) });
    persistSettings(get);
  },
  addSecurityLog: (action, details, email) => {
    const newLog: SecurityLogItem = {
      id: id("log"),
      ts: Date.now(),
      action,
      details,
      userEmail: email || "unknown@system.com",
    };
    set({ securityLogs: [newLog, ...get().securityLogs].slice(0, 1000) });
    persistSettings(get);
  },

  setPrinterProfiles: (profiles) => set({ printerProfiles: profiles }),
  addPrinterProfile: (profile) => {
    const newId = id("pr");
    set({ printerProfiles: [...get().printerProfiles, { ...profile, id: newId }] });
    persistSettings(get);
  },
  updatePrinterProfile: (id, patch) => {
    set({
      printerProfiles: get().printerProfiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
    persistSettings(get);
  },
  removePrinterProfile: (id) => {
    set({ printerProfiles: get().printerProfiles.filter((p) => p.id !== id) });
    persistSettings(get);
  },
  setDocumentTemplates: (templates) => set({ documentTemplates: templates }),
  updateDocumentTemplate: (id, patch) => {
    set({
      documentTemplates: get().documentTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
    persistSettings(get);
  },
  setComplianceProfile: (profile) => {
    set({ complianceProfile: { ...get().complianceProfile, ...profile } });
    persistSettings(get);
  },
  setCurrentUserRole: (role) => set({ currentUserRole: role }),
  setSettingsHydrated: (v) => set({ settingsHydrated: v }),

  setWorkshops: (workshops) => set({ workshops }),

  // Workshop CRUD — writes to Supabase workshops table
  addWorkshop: (w) => {
    const newId = `workshop_${Date.now()}`;
    const newW = { ...w, id: newId };
    set({ workshops: [...get().workshops, newW] });
    void saveWorkshopToDb(newW);
  },
  updateWorkshop: (wId, patch) => {
    set({ workshops: get().workshops.map((w) => (w.id === wId ? { ...w, ...patch } : w)) });
    const updated = get().workshops.find((w) => w.id === wId);
    if (updated) void saveWorkshopToDb(updated);
  },
  removeWorkshop: (wId) => {
    set({ workshops: get().workshops.filter((w) => w.id !== wId) });
    void deleteWorkshopFromDb(wId);
  },

  // Per-branch settings
  getBranchSettings: (branchId) => {
    return get().branchSettings.find((b) => b.branchId === branchId) ?? { branchId };
  },
  setBranchSettings: (branchId, patch) => {
    const existing = get().branchSettings;
    const idx = existing.findIndex((b) => b.branchId === branchId);
    if (idx >= 0) {
      const next = [...existing];
      next[idx] = { ...next[idx], ...patch };
      set({ branchSettings: next });
    } else {
      set({ branchSettings: [...existing, { branchId, ...patch }] });
    }
    persistSettings(get);
  },
  setFormsMetadata: (forms) => {
    set({ formsMetadata: forms });
    persistSettings(get);
  },
  addFormMetadata: (form) => {
    const newId = id("form");
    set({ formsMetadata: [...get().formsMetadata, { ...form, id: newId }] });
    persistSettings(get);
  },
  updateFormMetadata: (id, patch) => {
    set({
      formsMetadata: get().formsMetadata.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
    persistSettings(get);
  },
  removeFormMetadata: (id) => {
    set({ formsMetadata: get().formsMetadata.filter((f) => f.id !== id) });
    persistSettings(get);
  },

  saveEmailTemplate: (t) => {
    const now = Date.now();
    const templates = get().emailTemplates;
    if (t.id) {
      set({ emailTemplates: templates.map((x) => (x.id === t.id ? { ...x, ...t } : x)) });
    } else {
      const newId = id("etpl");
      set({ emailTemplates: [...templates, { ...t, id: newId, createdAt: now }] });
    }
    persistSettings(get);
  },
  deleteEmailTemplate: (tid) => {
    set({ emailTemplates: get().emailTemplates.filter((t) => t.id !== tid) });
    persistSettings(get);
  },
  setCampaignTemplates: (t) => {
    set({ campaignTemplates: { ...get().campaignTemplates, ...t } });
    persistSettings(get);
  },
  setCommAutomation: (a) => {
    set({ commAutomation: { ...get().commAutomation, ...a } });
    persistSettings(get);
  },

  // Reset Settings must only touch cosmetic/preference fields — never users,
  // roles, permissions, branches, firm/company identity, or auth state. This
  // used to be `set({ ...DEFAULTS })`, which wiped every registered user back
  // to a single default "Owner" stub, blanked the firm profile, and reset
  // currentUserRole/branches — locking the administrator out mid-pilot.
  // Browser session cleanup (FactoryResetDialog -> clearBrowserSessionResidue)
  // is only a troubleshooting action. Supabase production data remains
  // authoritative and is never deleted by this client-side path.
  resetAll: () => {
    set({
      branding: DEFAULTS.branding,
      print: DEFAULTS.print,
      hardware: DEFAULTS.hardware,
      language: DEFAULTS.language,
      developer: DEFAULTS.developer,
    });
    persistSettings(get);
  },
}));

/** Retired local business-store keys. Kept empty for legacy settings UI imports. */
export const PILOT_STORAGE_KEYS: string[] = [];

export function exportPilotData(): string {
  return JSON.stringify(
    {
      _exportedAt: new Date().toISOString(),
      _app: "AVS ERP",
      _status: "retired",
      message:
        "Browser-local ERP backup/export has been retired. Use Supabase backup and document export workflows.",
    },
    null,
    2,
  );
}

export function importPilotData(json: string): { ok: boolean; restored: string[]; error?: string } {
  void json;
  return {
    ok: false,
    restored: [],
    error:
      "Browser-local ERP import has been retired. Restore production data through Supabase-controlled backup workflows.",
  };
}

/** Production ERP data remains in Supabase and must be managed through authorized workflows. */
export async function clearBrowserSessionResidue(): Promise<void> {
  if (typeof window !== "undefined") {
    window.sessionStorage.clear();
  }
}
