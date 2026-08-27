/**
 * Universal configuration bundle — export / import / apply.
 * Additive layer over settings + terminology. Does not rewrite gold math.
 */
import { useSettings, type DropdownKey, type FormMetadata } from "@/lib/settings-store";
import { useTerminology, type TerminologyPackId } from "@/lib/terminology-engine-store";
import {
  DEFAULT_PURE_GOLD_REFERENCE_PERMILLE,
  normalizeMaTaraWorkshopPolicy,
  type MaTaraWorkshopPolicy,
} from "@/lib/ma-tara-workshop-policy";

export const CONFIG_BUNDLE_SCHEMA = "ornexa.configuration_bundle";
export const CONFIG_BUNDLE_VERSION = "1.0.0";

export type ConfigurationBundle = {
  schema: typeof CONFIG_BUNDLE_SCHEMA;
  version: string;
  bundleId: string;
  label: string;
  exportedAt?: string;
  dropdowns?: Partial<Record<DropdownKey, string[]>>;
  formsMetadata?: FormMetadata[];
  terminologyOverrides?: Record<string, string>;
  activeTerminologyPack?: TerminologyPackId;
  /** Firm/MTJ policy defaults — config only; does not change fineGoldMg formula. */
  maTaraWorkshopPolicy?: Partial<MaTaraWorkshopPolicy>;
  /** Soft flags for simplified MTJ chrome (edition UI still driven by plan). */
  mtjSimplifiedWorkflow?: boolean;
  notes?: string;
};

export type BundleValidationResult =
  { ok: true; bundle: ConfigurationBundle } | { ok: false; errors: string[] };

export function validateConfigurationBundle(raw: unknown): BundleValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["Bundle must be a JSON object"] };
  }
  const o = raw as Record<string, unknown>;
  if (o.schema !== CONFIG_BUNDLE_SCHEMA) {
    errors.push(`Unsupported schema (expected ${CONFIG_BUNDLE_SCHEMA})`);
  }
  if (typeof o.version !== "string" || !o.version.trim()) {
    errors.push("Missing version");
  }
  if (typeof o.bundleId !== "string" || !o.bundleId.trim()) {
    errors.push("Missing bundleId");
  }
  if (typeof o.label !== "string" || !o.label.trim()) {
    errors.push("Missing label");
  }
  if (
    o.dropdowns !== undefined &&
    (typeof o.dropdowns !== "object" || Array.isArray(o.dropdowns))
  ) {
    errors.push("dropdowns must be an object");
  }
  if (o.formsMetadata !== undefined && !Array.isArray(o.formsMetadata)) {
    errors.push("formsMetadata must be an array");
  }
  if (
    o.terminologyOverrides !== undefined &&
    (typeof o.terminologyOverrides !== "object" || Array.isArray(o.terminologyOverrides))
  ) {
    errors.push("terminologyOverrides must be an object");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, bundle: o as unknown as ConfigurationBundle };
}

export function buildExportConfigurationBundle(
  label = "Exported firm configuration",
): ConfigurationBundle {
  const settings = useSettings.getState();
  const terminology = useTerminology.getState();
  const policy = normalizeMaTaraWorkshopPolicy(
    (settings as { maTaraWorkshopPolicy?: Partial<MaTaraWorkshopPolicy> }).maTaraWorkshopPolicy ?? {
      pureGoldReferencePermille: DEFAULT_PURE_GOLD_REFERENCE_PERMILLE,
    },
  );
  return {
    schema: CONFIG_BUNDLE_SCHEMA,
    version: CONFIG_BUNDLE_VERSION,
    bundleId: `export-${Date.now()}`,
    label,
    exportedAt: new Date().toISOString(),
    dropdowns: settings.dropdowns,
    formsMetadata: settings.formsMetadata,
    terminologyOverrides: terminology.customOverrides,
    activeTerminologyPack: terminology.activePack,
    maTaraWorkshopPolicy: policy,
    notes: "Exported from live firm customization. Apply via Import Configuration Bundle.",
  };
}

export type ApplyBundleOptions = {
  /** When true, replace dropdown keys present in bundle; when false, merge unique values. */
  mode: "merge" | "replace";
};

/**
 * Apply a validated bundle into local stores. Caller must confirm with the user.
 * Never auto-applies without UI confirmation.
 */
export function applyConfigurationBundle(
  bundle: ConfigurationBundle,
  opts: ApplyBundleOptions = { mode: "merge" },
): void {
  const settings = useSettings.getState();
  if (bundle.dropdowns) {
    const validKeys = new Set([
      "orderType",
      "itemCategory",
      "metalColor",
      "repairType",
      "paymentMode",
      "workerRole",
      "stockLocation",
      "priority",
      "sourceType",
      "stoneType",
    ]);
    for (const [key, values] of Object.entries(bundle.dropdowns)) {
      if (!Array.isArray(values) || !validKeys.has(key)) continue;
      const k = key as DropdownKey;
      if (opts.mode === "replace") {
        settings.setDropdown(
          k,
          values.filter((v) => typeof v === "string"),
        );
      } else {
        const cur = settings.dropdowns[k] ?? [];
        const merged = [...cur];
        for (const v of values) {
          if (typeof v === "string" && v && !merged.includes(v)) merged.push(v);
        }
        settings.setDropdown(k, merged);
      }
    }
  }
  if (Array.isArray(bundle.formsMetadata) && bundle.formsMetadata.length > 0) {
    if (opts.mode === "replace") {
      settings.setFormsMetadata(bundle.formsMetadata);
    } else {
      const byId = new Map(settings.formsMetadata.map((f) => [f.id, f]));
      for (const f of bundle.formsMetadata) {
        if (f?.id) byId.set(f.id, f);
      }
      settings.setFormsMetadata([...byId.values()]);
    }
  }
  const terminology = useTerminology.getState();
  if (bundle.activeTerminologyPack) {
    terminology.setActivePack(bundle.activeTerminologyPack);
  }
  if (bundle.terminologyOverrides && typeof bundle.terminologyOverrides === "object") {
    for (const [k, v] of Object.entries(bundle.terminologyOverrides)) {
      if (typeof v === "string") terminology.setCustomOverride(k, v);
    }
  }
  if (bundle.maTaraWorkshopPolicy) {
    const setPolicy = (
      settings as {
        setMaTaraWorkshopPolicy?: (p: Partial<MaTaraWorkshopPolicy>) => void;
      }
    ).setMaTaraWorkshopPolicy;
    if (typeof setPolicy === "function") {
      setPolicy(normalizeMaTaraWorkshopPolicy(bundle.maTaraWorkshopPolicy));
    }
  }
}

export async function loadBundledJson(url: string): Promise<ConfigurationBundle> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load bundle: ${res.status}`);
  const json = await res.json();
  const v = validateConfigurationBundle(json);
  if (!v.ok) throw new Error(v.errors.join("; "));
  return v.bundle;
}

const MTJ_DEFAULT_BUNDLE_PATH = "/config-bundles/mtj-default.v1.json";

/**
 * Apply MTJ Default Bundle once per firm session flag in settings.
 * DEFAULT ≠ LOCKED — subsequent customization persists.
 */
export async function ensureMtjDefaultBundleAppliedOnce(): Promise<boolean> {
  const settings = useSettings.getState();
  if (settings.mtjDefaultBundleAppliedAt) return false;
  try {
    if (localStorage.getItem("avs_mtj_default_bundle_applied") === "1") {
      settings.setMtjDefaultBundleAppliedAt(new Date().toISOString());
      return false;
    }
  } catch {
    /* ignore */
  }
  const bundle = await loadBundledJson(MTJ_DEFAULT_BUNDLE_PATH);
  applyConfigurationBundle(bundle, { mode: "merge" });
  settings.setMtjDefaultBundleAppliedAt(new Date().toISOString());
  try {
    localStorage.setItem("avs_mtj_default_bundle_applied", "1");
  } catch {
    /* ignore */
  }
  return true;
}

export function wasMtjDefaultBundleApplied(): boolean {
  if (useSettings.getState().mtjDefaultBundleAppliedAt) return true;
  try {
    return localStorage.getItem("avs_mtj_default_bundle_applied") === "1";
  } catch {
    return false;
  }
}
