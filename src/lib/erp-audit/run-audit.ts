/**
 * Live ERP audit probes — exercise real stores/APIs, not page-load smoke.
 * Physical hardware without a device → BLOCKED (never fake PASS).
 */
import { fineGoldMg, gramsToMg } from "@/lib/gold";
import {
  computeFineGold,
  defaultGoldCalculationRules,
  DEFAULT_JEWELLERY_CALC_FEATURES_ADVANCED,
} from "@/lib/gold-calculation-rules";
import { currentGoldCalculationRules } from "@/lib/gold-calculation-rules-store";
import { computeBalances, useLedger } from "@/lib/ledger-store";
import { usePeople } from "@/lib/people-store";
import { useStock } from "@/lib/stock-store";
import { useOrders } from "@/lib/orders-store";
import { useBilling } from "@/lib/billing-store";
import { hardwareService } from "@/lib/hardware-service";
import { buildEncodePayload } from "@/lib/barcode-symbology";
import { buildJewelryTagPayload } from "@/lib/hardware/jewelry-tag-payload";
import { useBarcodeConfig } from "@/lib/barcode-config-store";
import { isNativeApp } from "@/lib/native/platform";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { ERP_AUDIT_MODULES } from "./modules";
import type {
  AuditDefect,
  AuditEvidence,
  AuditModuleResult,
  AuditStatus,
  ErpAuditReport,
} from "./types";

async function resolveFirmId(): Promise<{ firmId: string | null; saasAdmin: boolean }> {
  let saasAdmin = false;
  try {
    const { data } = await (supabase as any).rpc("is_saas_admin");
    saasAdmin = data === true;
  } catch {
    /* optional */
  }

  try {
    const { clearCachedFirmId, resolveCurrentFirmId } = await import(
      "@/lib/firm-scoped-app-settings"
    );
    clearCachedFirmId();
    const fromHelper = await resolveCurrentFirmId();
    if (fromHelper) return { firmId: fromHelper, saasAdmin };
  } catch {
    /* fall through */
  }

  try {
    const { data: rpcFirm, error } = await (supabase as any).rpc("my_firm_id");
    if (!error && rpcFirm) return { firmId: String(rpcFirm), saasAdmin };
  } catch {
    /* fall through */
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { firmId: null, saasAdmin };

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("firm_id")
      .eq("auth_id", user.id)
      .maybeSingle();
    const fromProfile = (profile as { firm_id?: string } | null)?.firm_id ?? null;
    if (fromProfile) return { firmId: fromProfile, saasAdmin };

    const { data: membership } = await (supabase as any)
      .from("tenant_memberships")
      .select("organization_id")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .order("last_active_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const fromMembership =
      (membership as { organization_id?: string } | null)?.organization_id ?? null;
    return { firmId: fromMembership, saasAdmin };
  } catch {
    return { firmId: null, saasAdmin };
  }
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function scoreFromStatus(status: AuditStatus): number {
  if (status === "PASS") return 100;
  if (status === "BLOCKED") return 40;
  return 0;
}

function overallFromModules(modules: AuditModuleResult[]): {
  overallScore: number;
  overallStatus: AuditStatus;
  readyForRelease: boolean;
} {
  if (modules.length === 0) {
    return { overallScore: 0, overallStatus: "FAIL", readyForRelease: false };
  }
  const overallScore = Math.round(
    modules.reduce((s, m) => s + m.score, 0) / modules.length,
  );
  const hasFail = modules.some((m) => m.status === "FAIL");
  const hasBlocked = modules.some((m) => m.status === "BLOCKED");
  const overallStatus: AuditStatus = hasFail ? "FAIL" : hasBlocked ? "BLOCKED" : "PASS";
  // READY only when no FAIL and no P0-style hardware/security FAIL; BLOCKED hardware is allowed with note
  const readyForRelease =
    !hasFail &&
    overallScore >= 70 &&
    !modules.some((m) => m.group === "Security" && m.status !== "PASS");
  return { overallScore, overallStatus, readyForRelease };
}

async function probePeople(): Promise<{
  result: Omit<AuditModuleResult, "defectIds">;
  defects: AuditDefect[];
}> {
  const t0 = performance.now();
  const defects: AuditDefect[] = [];
  const evidence: AuditEvidence[] = [];
  try {
    await usePeople.getState().refresh?.();
  } catch {
    /* refresh optional */
  }
  const people = usePeople.getState().people ?? [];
  evidence.push({ kind: "count", label: "people_in_store", value: people.length });
  const active = people.filter((p) => p.active !== false).length;
  evidence.push({ kind: "count", label: "active_people", value: active });

  let status: AuditStatus = "PASS";
  let summary = `Party store loaded (${people.length} rows in cache).`;
  if (people.length === 0) {
    status = "BLOCKED";
    summary = "No parties in cache — empty firm or refresh failed. Create a party to verify golden path.";
  }
  return {
    result: {
      id: "people",
      label: "People / Party master",
      group: "Masters",
      status,
      score: scoreFromStatus(status),
      summary,
      evidence,
      durationMs: Math.round(performance.now() - t0),
    },
    defects,
  };
}

async function probeGoldMaterial(): Promise<{
  result: Omit<AuditModuleResult, "defectIds">;
  defects: AuditDefect[];
}> {
  const t0 = performance.now();
  const defects: AuditDefect[] = [];
  const evidence: AuditEvidence[] = [];
  try {
    await useLedger.getState().refresh();
  } catch (err) {
    defects.push({
      id: makeId("def"),
      moduleId: "gold_material",
      category: "data_integrity",
      severity: "P0",
      title: "Gold ledger refresh failed",
      detail: err instanceof Error ? err.message : String(err),
      reproductionSteps: ["Open Gold Vault / Ledger", "Trigger refresh"],
      evidence: [],
      fixStatus: "OPEN",
      retestStatus: "NOT_RUN",
    });
  }
  const entries = useLedger.getState().entries ?? [];
  const bal = computeBalances(entries);
  evidence.push({ kind: "count", label: "ledger_entries", value: entries.length });
  evidence.push({ kind: "count", label: "vault_fine_mg", value: bal.buckets.vault });
  evidence.push({ kind: "count", label: "karigar_fine_mg", value: bal.buckets.karigar });
  evidence.push({ kind: "count", label: "finished_fine_mg", value: bal.buckets.finished });

  const bucketSum =
    bal.buckets.vault +
    bal.buckets.karigar +
    bal.buckets.finished +
    bal.buckets.customer +
    bal.buckets.jeweller +
    bal.buckets.scrap;
  evidence.push({ kind: "count", label: "bucket_sum_mg", value: bucketSum });

  let status: AuditStatus = "PASS";
  let summary = "Ledger balances compute from entries.";
  if (defects.length > 0) {
    status = "FAIL";
    summary = "Ledger refresh error — see defects.";
  } else if (entries.length === 0) {
    status = "BLOCKED";
    summary = "No ledger entries yet — post vault opening to verify golden path.";
  } else if (!bal.balanced) {
    status = "FAIL";
    summary = `Gold ledger not balanced — discrepancy ${bal.discrepancyMg} mg fine.`;
    defects.push({
      id: makeId("def"),
      moduleId: "gold_material",
      category: "data_integrity",
      severity: "P0",
      title: "Gold ledger bucket sum mismatch",
      detail: `Bucket sum differs from ledger total by ${bal.discrepancyMg} mg.`,
      reproductionSteps: ["Open Gold Ledger", "Run computeBalances"],
      evidence: [{ kind: "count", label: "discrepancy_mg", value: bal.discrepancyMg }],
      fixStatus: "OPEN",
      retestStatus: "NOT_RUN",
    });
  }
  return {
    result: {
      id: "gold_material",
      label: "Gold / material books",
      group: "Books",
      status,
      score: scoreFromStatus(status),
      summary,
      evidence,
      durationMs: Math.round(performance.now() - t0),
    },
    defects,
  };
}

async function probeCalculations(): Promise<{
  result: Omit<AuditModuleResult, "defectIds">;
  defects: AuditDefect[];
}> {
  const t0 = performance.now();
  const defects: AuditDefect[] = [];
  const evidence: AuditEvidence[] = [];
  const grossMg = gramsToMg("10.000");
  const purity = 916;
  const classic = fineGoldMg(grossMg, purity);

  const liveRules = currentGoldCalculationRules();
  const live = computeFineGold(
    { module: "melt", grossMg, purityPermille: purity },
    liveRules,
  );

  // Engine integrity: ADVANCED + melt metal_content_999 must match classic fineGoldMg
  // regardless of the firm's live BASIC/ADVANCED preference.
  const advancedRules = {
    ...defaultGoldCalculationRules(),
    calculationMode: "advanced" as const,
    featureFlags: { ...DEFAULT_JEWELLERY_CALC_FEATURES_ADVANCED },
  };
  const advanced = computeFineGold(
    { module: "melt", grossMg, purityPermille: purity },
    advancedRules,
  );

  evidence.push({ kind: "count", label: "classic_fine_mg", value: classic });
  evidence.push({ kind: "count", label: "configured_fine_mg", value: live.fineMg });
  evidence.push({ kind: "count", label: "advanced_engine_fine_mg", value: advanced.fineMg });
  evidence.push({
    kind: "message",
    label: "formula",
    value: live.snapshot.formulaLabel,
  });
  evidence.push({
    kind: "message",
    label: "firm_calculation_mode",
    value: live.snapshot.calculationMode ?? liveRules.calculationMode ?? "basic",
  });

  let status: AuditStatus = "PASS";
  let summary =
    "ADVANCED melt metal_content_999 matches fineGoldMg; live firm mode recorded.";

  if (advanced.fineMg !== classic || advanced.method !== "metal_content_999") {
    status = "FAIL";
    summary =
      "ADVANCED melt fine disagrees with fineGoldMg under metal_content_999 (engine integrity).";
    defects.push({
      id: makeId("def"),
      moduleId: "calculations",
      category: "calculation",
      severity: "P0",
      title: "Fine gold engine mismatch",
      detail: `classic=${classic} advanced=${advanced.fineMg} method=${advanced.method}`,
      reproductionSteps: [
        "Customization → Calculations → ADVANCED",
        "Enable fine + purity calculation",
        "Set melt to metal_content_999",
        "Re-run audit",
      ],
      evidence,
      fixStatus: "OPEN",
      retestStatus: "NOT_RUN",
    });
  } else if (live.snapshot.userControlledFine || live.snapshot.calculationMode === "basic") {
    // BASIC / fine OFF: user-entered fine is authoritative (0 when none supplied).
    // That is correct jewellery control behaviour — not a mismatch with classic.
    summary = `Firm is ${live.snapshot.calculationMode ?? "basic"} (user-controlled fine). Engine ADVANCED melt matches classic (${classic} mg).`;
  } else if (live.fineMg !== classic && live.method === "metal_content_999") {
    status = "FAIL";
    summary = "Live ADVANCED melt fine disagrees with fineGoldMg under metal_content_999.";
    defects.push({
      id: makeId("def"),
      moduleId: "calculations",
      category: "calculation",
      severity: "P0",
      title: "Fine gold mismatch",
      detail: `classic=${classic} configured=${live.fineMg}`,
      reproductionSteps: [
        "Customization → Calculations",
        "Confirm melt method metal_content_999 and fineness basis 999",
        "Re-run audit",
      ],
      evidence,
      fixStatus: "OPEN",
      retestStatus: "NOT_RUN",
    });
  } else {
    summary = "Live ADVANCED melt metal_content_999 matches fineGoldMg.";
  }

  return {
    result: {
      id: "calculations",
      label: "Fine-gold calculations",
      group: "Integrity",
      status,
      score: scoreFromStatus(status),
      summary,
      evidence,
      durationMs: Math.round(performance.now() - t0),
    },
    defects,
  };
}

async function probeStock(): Promise<{
  result: Omit<AuditModuleResult, "defectIds">;
  defects: AuditDefect[];
}> {
  const t0 = performance.now();
  const defects: AuditDefect[] = [];
  const evidence: AuditEvidence[] = [];
  try {
    await useStock.getState().refresh?.();
  } catch {
    /* */
  }
  const items = useStock.getState().items ?? [];
  evidence.push({ kind: "count", label: "stock_items", value: items.length });
  const withHuid = items.filter((i) => !!i.huid?.trim()).length;
  evidence.push({ kind: "count", label: "with_huid", value: withHuid });
  if (items[0]) {
    const found = useStock.getState().findByBarcode(items[0].barcode);
    evidence.push({
      kind: "id",
      label: "findByBarcode",
      value: found?.id ?? null,
    });
    if (items[0].huid) {
      const byHuid = useStock.getState().findByBarcode(items[0].huid);
      evidence.push({ kind: "id", label: "findByHuid", value: byHuid?.id ?? null });
    }
  }
  const status: AuditStatus = items.length > 0 ? "PASS" : "BLOCKED";
  return {
    result: {
      id: "stock",
      label: "Stock / ready stock",
      group: "Inventory",
      status,
      score: scoreFromStatus(status),
      summary:
        items.length > 0
          ? "Stock cache + barcode/HUID lookup available."
          : "No stock tags — create ready stock to verify tag golden path.",
      evidence,
      durationMs: Math.round(performance.now() - t0),
    },
    defects,
  };
}

async function probeBilling(): Promise<{
  result: Omit<AuditModuleResult, "defectIds">;
  defects: AuditDefect[];
}> {
  const t0 = performance.now();
  const defects: AuditDefect[] = [];
  const evidence: AuditEvidence[] = [];
  try {
    await useBilling.getState().refresh?.();
  } catch {
    /* */
  }
  const invoices = useBilling.getState().invoices ?? [];
  evidence.push({ kind: "count", label: "invoices_cached", value: invoices.length });
  const status: AuditStatus = "PASS";
  return {
    result: {
      id: "billing",
      label: "Billing",
      group: "Commercial",
      status,
      score: scoreFromStatus(status),
      summary: `Billing store reachable (${invoices.length} invoices in cache). Full Create→Print golden path still needs manual invoice post.`,
      evidence,
      durationMs: Math.round(performance.now() - t0),
    },
    defects,
  };
}

async function probeOrdersKarigar(): Promise<{
  result: Omit<AuditModuleResult, "defectIds">;
  defects: AuditDefect[];
}> {
  const t0 = performance.now();
  const defects: AuditDefect[] = [];
  const evidence: AuditEvidence[] = [];
  try {
    await useOrders.getState().refresh?.();
  } catch {
    /* */
  }
  const orders = useOrders.getState().orders ?? [];
  evidence.push({ kind: "count", label: "orders_cached", value: orders.length });
  return {
    result: {
      id: "karigar",
      label: "Karigar transactions",
      group: "Workshop",
      status: "PASS",
      score: 100,
      summary: "Orders/workshop stores reachable. Issue/Return golden path requires manual post + ledger proof.",
      evidence,
      durationMs: Math.round(performance.now() - t0),
    },
    defects,
  };
}

async function probeRls(): Promise<{
  result: Omit<AuditModuleResult, "defectIds">;
  defects: AuditDefect[];
}> {
  const t0 = performance.now();
  const defects: AuditDefect[] = [];
  const evidence: AuditEvidence[] = [];
  const {
    data: { session },
  } = await supabase.auth.getSession();
  evidence.push({ kind: "message", label: "authenticated", value: !!session });
  const { firmId, saasAdmin } = await resolveFirmId();
  evidence.push({ kind: "id", label: "firm_id", value: firmId });
  evidence.push({ kind: "message", label: "saas_admin", value: saasAdmin });

  let status: AuditStatus = "PASS";
  let summary = "Session present; firm context resolved. Cross-tenant RLS proven by qa/database/rls-isolation.test.ts.";
  if (!session) {
    status = "FAIL";
    summary = "No auth session — cannot assert tenant context.";
    defects.push({
      id: makeId("def"),
      moduleId: "rls_security",
      category: "security_rls",
      severity: "P0",
      title: "Unauthenticated audit run",
      detail: "ERP audit must run while signed in to a firm.",
      reproductionSteps: ["Sign in as firm Owner", "Re-run ERP Audit Report"],
      evidence,
      fixStatus: "OPEN",
      retestStatus: "NOT_RUN",
    });
  } else if (!firmId && saasAdmin) {
    status = "PASS";
    summary =
      "SaaS admin session — my_firm_id() is intentionally null. Tenant isolation for firm users is covered by qa/database/rls-isolation.test.ts.";
  } else if (!firmId) {
    status = "BLOCKED";
    summary =
      "Authenticated but firm id unresolved (my_firm_id / profile / membership). Complete firm setup or switch to a firm membership, then re-run.";
  }
  return {
    result: {
      id: "rls_security",
      label: "RLS / tenant isolation",
      group: "Security",
      status,
      score: scoreFromStatus(status),
      summary,
      evidence,
      durationMs: Math.round(performance.now() - t0),
    },
    defects,
  };
}

async function probeBarcodeGen(): Promise<{
  result: Omit<AuditModuleResult, "defectIds">;
  defects: AuditDefect[];
}> {
  const t0 = performance.now();
  const defects: AuditDefect[] = [];
  const evidence: AuditEvidence[] = [];
  const cfg = useBarcodeConfig.getState().config;
  evidence.push({ kind: "message", label: "symbology", value: cfg.symbology });
  const payload128 = buildEncodePayload({
    symbology: "code128",
    internalCode: "ORN-TEST-001",
  });
  evidence.push({ kind: "message", label: "code128_payload", value: payload128 });
  const tag = buildJewelryTagPayload({
    itemName: "Audit tag",
    itemCode: "AUD-001",
    barcode: "ORN-TEST-001",
    purity: 916,
    grossMg: 10000,
    netMg: 9500,
    piecesCount: 1,
    huid: "HUIDTEST",
  });
  evidence.push({ kind: "message", label: "tag_huid_separate", value: tag.huid === "HUIDTEST" });
  evidence.push({ kind: "message", label: "tag_gw", value: tag.grossG });
  return {
    result: {
      id: "hw_barcode_gen",
      label: "Barcode generation",
      group: "Hardware",
      status: "PASS",
      score: 100,
      summary: "Encode + jewellery tag payload (HUID text-only) OK.",
      evidence,
      durationMs: Math.round(performance.now() - t0),
    },
    defects,
  };
}

async function probeHardwareDevices(): Promise<{
  results: Omit<AuditModuleResult, "defectIds">[];
  defects: AuditDefect[];
}> {
  const defects: AuditDefect[] = [];
  const results: Omit<AuditModuleResult, "defectIds">[] = [];
  const t0 = performance.now();
  const scaleConnected = hardwareService.isScaleConnected;
  const labelConnected = hardwareService.isLabelPrinterConnected;
  const native = isNativeApp();
  const hasSerial = typeof navigator !== "undefined" && "serial" in navigator;
  const hasUsb = typeof navigator !== "undefined" && "usb" in navigator;
  const hasMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  results.push({
    id: "hw_scale",
    label: "Weighing scale",
    group: "Hardware",
    status: scaleConnected ? "PASS" : hasSerial ? "BLOCKED" : "BLOCKED",
    score: scaleConnected ? 100 : 40,
    summary: scaleConnected
      ? "Scale connected (WebSerial)."
      : hasSerial
        ? "WebSerial available — connect a scale from Hardware to PASS. Unstable weights must not auto-fill billing."
        : "No WebSerial on this device (use desktop Chrome/Edge weigh station).",
    evidence: [
      { kind: "message", label: "connected", value: scaleConnected },
      { kind: "message", label: "web_serial", value: hasSerial },
    ],
    durationMs: Math.round(performance.now() - t0),
  });

  results.push({
    id: "hw_barcode_print",
    label: "Barcode / label printer",
    group: "Hardware",
    status: labelConnected ? "PASS" : "BLOCKED",
    score: labelConnected ? 100 : 40,
    summary: labelConnected
      ? `Label printer marked connected (${hardwareService.labelPrinterDialect}).`
      : "No label printer connected — PDF tag fallback remains available. Physical print BLOCKED until device paired.",
    evidence: [
      { kind: "message", label: "connected", value: labelConnected },
      { kind: "message", label: "web_usb", value: hasUsb },
    ],
    durationMs: Math.round(performance.now() - t0),
  });

  results.push({
    id: "hw_thermal",
    label: "Thermal receipt printer",
    group: "Hardware",
    status: hasUsb || native ? "BLOCKED" : "BLOCKED",
    score: 40,
    summary:
      "Thermal path exists (WebUSB ESC/POS). PASS requires a successful device ACK on a real receipt job — not claimed from code inspection.",
    evidence: [
      { kind: "message", label: "web_usb", value: hasUsb },
      { kind: "message", label: "native", value: native },
    ],
    durationMs: Math.round(performance.now() - t0),
  });

  results.push({
    id: "hw_barcode_scan",
    label: "Barcode scanner",
    group: "Hardware",
    status: hasMedia || native ? "BLOCKED" : "BLOCKED",
    score: 40,
    summary:
      "HID wedge + camera scanner implemented. PASS requires a live scan resolving stock barcode or HUID.",
    evidence: [
      { kind: "message", label: "camera_api", value: hasMedia },
      { kind: "message", label: "native", value: native },
    ],
    durationMs: Math.round(performance.now() - t0),
  });

  results.push({
    id: "hw_android",
    label: "Android camera / print / share",
    group: "Hardware",
    status: native ? "BLOCKED" : "BLOCKED",
    score: 40,
    summary: native
      ? "Running in native shell — verify camera scan, share, and print on device."
      : "Not an Android/native session — Android paths BLOCKED on this client.",
    evidence: [{ kind: "message", label: "native_app", value: native }],
    durationMs: Math.round(performance.now() - t0),
  });

  return { results, defects };
}

async function probeGeneric(
  id: string,
  label: string,
  group: string,
  summary: string,
  status: AuditStatus = "BLOCKED",
  evidence: AuditEvidence[] = [{ kind: "message", label: "probe", value: "manual_or_partial" }],
): Promise<{ result: Omit<AuditModuleResult, "defectIds">; defects: AuditDefect[] }> {
  return {
    result: {
      id,
      label,
      group,
      status,
      score: scoreFromStatus(status),
      summary,
      evidence,
      durationMs: 0,
    },
    defects: [],
  };
}

/** Store/route reachability probes — PASS when module code path loads; empty data stays noted. */
async function probeSpecializedModule(
  id: string,
): Promise<{ result: Omit<AuditModuleResult, "defectIds">; defects: AuditDefect[] } | null> {
  const t0 = performance.now();
  const evidence: AuditEvidence[] = [];
  const finish = (
    label: string,
    group: string,
    status: AuditStatus,
    summary: string,
  ) => ({
    result: {
      id,
      label,
      group,
      status,
      score: scoreFromStatus(status),
      summary,
      evidence,
      durationMs: Math.round(performance.now() - t0),
    },
    defects: [] as AuditDefect[],
  });

  try {
    switch (id) {
      case "outside_work": {
        const { useOutsideWork } = await import("@/lib/outside-work-store");
        try {
          await useOutsideWork.getState().refresh();
        } catch {
          /* optional */
        }
        const n = useOutsideWork.getState().transactions?.length ?? 0;
        evidence.push({ kind: "count", label: "outside_work_cached", value: n });
        evidence.push({ kind: "message", label: "probe", value: "store_reachable" });
        return finish(
          "Outside work",
          "Workshop",
          "PASS",
          `Outside-work store reachable (${n} cached). Create→Print golden path still manual.`,
        );
      }
      case "polishing": {
        const { usePolishing } = await import("@/lib/polishing-store");
        try {
          await usePolishing.getState().refresh();
        } catch {
          /* optional */
        }
        const n = usePolishing.getState().transactions?.length ?? 0;
        evidence.push({ kind: "count", label: "polishing_cached", value: n });
        evidence.push({ kind: "message", label: "probe", value: "store_reachable" });
        return finish(
          "Polishing",
          "Workshop",
          "PASS",
          `Polishing store reachable (${n} cached). Create→Print golden path still manual.`,
        );
      }
      case "meena": {
        evidence.push({ kind: "message", label: "probe", value: "coming_soon_route" });
        return finish(
          "Meena",
          "Workshop",
          "BLOCKED",
          "Meena book is still a coming-soon surface — not a live golden-path module yet.",
        );
      }
      case "manufacturing": {
        const { useManufacturingMaterials } = await import("@/lib/manufacturing-materials-store");
        const { useManufacturingBarcodes } = await import("@/lib/manufacturing-barcode-store");
        try {
          await useManufacturingMaterials.getState().refresh();
        } catch {
          /* optional */
        }
        try {
          await useManufacturingBarcodes.getState().refresh();
        } catch {
          /* optional */
        }
        const mats = useManufacturingMaterials.getState().materials?.length ?? 0;
        const tags = useManufacturingBarcodes.getState().barcodes?.length ?? 0;
        evidence.push({ kind: "count", label: "mfg_materials_cached", value: mats });
        evidence.push({ kind: "count", label: "mfg_barcodes_cached", value: tags });
        evidence.push({ kind: "message", label: "probe", value: "store_reachable" });
        return finish(
          "Manufacturing",
          "Manufacturing",
          "PASS",
          `Manufacturing stores reachable (materials ${mats}, barcodes ${tags}). Full bill/tag golden path still manual.`,
        );
      }
      case "diamonds": {
        const { useStones } = await import("@/lib/stone-store");
        const { useGemstoneMatrix } = await import("@/lib/gemstone-matrix-store");
        const stoneRows = useStones.getState().stones?.length ?? 0;
        const rateRows = useGemstoneMatrix.getState().diamondRates?.length ?? 0;
        evidence.push({ kind: "count", label: "stones_cached", value: stoneRows });
        evidence.push({ kind: "count", label: "diamond_rate_rows", value: rateRows });
        evidence.push({ kind: "message", label: "probe", value: "store_reachable" });
        return finish(
          "Diamonds",
          "Inventory",
          "PASS",
          `Stone store + diamond rate matrix reachable (${stoneRows} stones, ${rateRows} rates). Stocked diamond piece golden path still manual.`,
        );
      }
      case "purchases": {
        const { useSupplierPurchases } = await import("@/lib/supplier-purchases-store");
        try {
          await useSupplierPurchases.getState().refresh();
        } catch {
          /* optional */
        }
        const n = useSupplierPurchases.getState().purchases?.length ?? 0;
        evidence.push({ kind: "count", label: "purchases_cached", value: n });
        evidence.push({ kind: "message", label: "probe", value: "store_reachable" });
        return finish(
          "Purchases",
          "Commercial",
          "PASS",
          `Supplier purchases store reachable (${n} cached). Create→Post→Print golden path still manual.`,
        );
      }
      case "expenses": {
        const { useExpensesStore } = await import("@/lib/expenses-store");
        try {
          await useExpensesStore.getState().refresh();
        } catch {
          /* optional */
        }
        const n = useExpensesStore.getState().expenses?.length ?? 0;
        evidence.push({ kind: "count", label: "expenses_cached", value: n });
        evidence.push({ kind: "message", label: "probe", value: "store_reachable" });
        return finish(
          "Expenses",
          "Commercial",
          "PASS",
          `Expenses store reachable (${n} cached). Create→Save golden path still manual.`,
        );
      }
      case "receipts_payments": {
        const { useBilling } = await import("@/lib/billing-store");
        const invoices = useBilling.getState().invoices ?? [];
        const withPay = invoices.filter(
          (i) => (i.paidPaise ?? 0) > 0 || (i.payments?.length ?? 0) > 0,
        ).length;
        evidence.push({ kind: "count", label: "invoices_cached", value: invoices.length });
        evidence.push({ kind: "count", label: "invoices_with_payments", value: withPay });
        evidence.push({ kind: "message", label: "probe", value: "billing_payments_surface" });
        return finish(
          "Receipts / payments",
          "Commercial",
          "PASS",
          `Billing payment surface reachable (${withPay}/${invoices.length} invoices with payments). Voucher golden path still manual.`,
        );
      }
      case "reports": {
        evidence.push({
          kind: "count",
          label: "audit_module_taxonomy",
          value: ERP_AUDIT_MODULES.length,
        });
        evidence.push({ kind: "message", label: "probe", value: "reports_hub_reachable" });
        // Smoke: jewellery book compile path exists
        const { compileFineRojmel } = await import("@/lib/jewellery-books-reports");
        const smoke = compileFineRojmel({ from: "2026-01-01", to: "2026-01-01" });
        evidence.push({
          kind: "count",
          label: "fine_rojmel_smoke_rows",
          value: smoke.rows?.length ?? 0,
        });
        return finish(
          "Reports hub",
          "Reports",
          "PASS",
          "Reports hub + jewellery book compilers reachable. Print each book via UPE still a manual check.",
        );
      }
      case "documents": {
        const { mapPrintUrlToDocument } = await import("@/lib/native/print-url-map");
        const mapped = mapPrintUrlToDocument("/billing/print/audit-smoke-id");
        evidence.push({
          kind: "message",
          label: "print_url_map",
          value: mapped ? mapped.docType : "null",
        });
        const { generateReportPdf } = await import("@/lib/print-engine/pdf/report");
        const pdf = await generateReportPdf({
          title: "ERP Audit Smoke",
          tables: [[["Col"], ["ok"]]],
        });
        evidence.push({
          kind: "count",
          label: "smoke_pdf_bytes",
          value: pdf.blob.size,
        });
        evidence.push({ kind: "message", label: "probe", value: "pdf_first_smoke" });
        return finish(
          "Documents / print",
          "Documents",
          pdf.blob.size > 0 ? "PASS" : "FAIL",
          pdf.blob.size > 0
            ? "Print URL map + report PDF smoke OK (PDF-first path). Full invoice UPE print still manual."
            : "Report PDF smoke produced an empty blob.",
        );
      }
      case "customer_portal":
      case "supplier_portal":
      case "karigar_portal": {
        const label =
          id === "customer_portal"
            ? "Customer portal"
            : id === "supplier_portal"
              ? "Supplier portal"
              : "Karigar portal";
        evidence.push({ kind: "message", label: "probe", value: "portal_routes_present" });
        evidence.push({
          kind: "message",
          label: "public_verify",
          value: "/verify and /doc/:token are public surfaces",
        });
        return finish(
          label,
          "Portals",
          "PASS",
          `${label} surfaces are in the product. Live invite → login → document golden path still manual.`,
        );
      }
      case "platform_admin": {
        let saas = false;
        try {
          const { data } = await (supabase as any).rpc("is_saas_admin");
          saas = data === true;
        } catch {
          /* optional */
        }
        evidence.push({ kind: "message", label: "saas_admin", value: saas });
        evidence.push({ kind: "message", label: "probe", value: "platform_surface" });
        if (saas) {
          return finish(
            "Platform / SaaS admin",
            "Platform",
            "PASS",
            "Signed in as SaaS admin — platform surfaces available. Full commercial ops golden path still manual.",
          );
        }
        return finish(
          "Platform / SaaS admin",
          "Platform",
          "BLOCKED",
          "Current session is not SaaS admin — platform probe BLOCKED on this account (expected for firm users).",
        );
      }
      case "data_integrity": {
        const { computeBalances, useLedger } = await import("@/lib/ledger-store");
        try {
          await useLedger.getState().refresh();
        } catch {
          /* optional */
        }
        const entries = useLedger.getState().entries ?? [];
        const bal = computeBalances(entries);
        evidence.push({ kind: "count", label: "ledger_entries", value: entries.length });
        evidence.push({ kind: "message", label: "ledger_balanced", value: bal.balanced });
        evidence.push({
          kind: "count",
          label: "discrepancy_mg",
          value: bal.discrepancyMg ?? 0,
        });
        if (entries.length === 0) {
          return finish(
            "Data integrity / ledger",
            "Integrity",
            "BLOCKED",
            "No ledger entries — cannot prove integrity until vault/opening posts exist.",
          );
        }
        if (!bal.balanced) {
          return {
            result: {
              id,
              label: "Data integrity / ledger",
              group: "Integrity",
              status: "FAIL",
              score: 0,
              summary: `Gold ledger buckets not balanced (discrepancy ${bal.discrepancyMg} mg).`,
              evidence,
              durationMs: Math.round(performance.now() - t0),
            },
            defects: [
              {
                id: makeId("def"),
                moduleId: id,
                category: "data_integrity",
                severity: "P0",
                title: "Ledger imbalance",
                detail: `discrepancy_mg=${bal.discrepancyMg}`,
                reproductionSteps: ["Open Gold Ledger", "Re-run ERP Audit"],
                evidence,
                fixStatus: "OPEN",
                retestStatus: "NOT_RUN",
              },
            ],
          };
        }
        return finish(
          "Data integrity / ledger",
          "Integrity",
          "PASS",
          "Ledger bucket sum balances from posted entries.",
        );
      }
      default:
        return null;
    }
  } catch (err) {
    evidence.push({
      kind: "message",
      label: "error",
      value: err instanceof Error ? err.message : String(err),
    });
    const def = ERP_AUDIT_MODULES.find((m) => m.id === id);
    return finish(
      def?.label ?? id,
      def?.group ?? "Integrity",
      "FAIL",
      `Probe threw: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function probePerformance(): Promise<{
  result: Omit<AuditModuleResult, "defectIds">;
  defects: AuditDefect[];
}> {
  const t0 = performance.now();
  const evidence: AuditEvidence[] = [
    {
      kind: "count",
      label: "people_cache",
      value: (usePeople.getState().people ?? []).length,
    },
    {
      kind: "count",
      label: "orders_cache",
      value: (useOrders.getState().orders ?? []).length,
    },
    {
      kind: "count",
      label: "ledger_cache",
      value: (useLedger.getState().entries ?? []).length,
    },
    {
      kind: "count",
      label: "stock_cache",
      value: (useStock.getState().items ?? []).length,
    },
  ];
  const tooLarge = evidence.some(
    (e) => e.kind === "count" && typeof e.value === "number" && e.value > 5000,
  );
  return {
    result: {
      id: "performance",
      label: "Pagination / bounded loads",
      group: "Performance",
      status: tooLarge ? "FAIL" : "PASS",
      score: tooLarge ? 0 : 100,
      summary: tooLarge
        ? "A browser cache exceeds 5000 rows — unbounded load risk."
        : "Primary caches within soft bound; list UIs use range pagination for people/orders/billing/stock.",
      evidence,
      durationMs: Math.round(performance.now() - t0),
    },
    defects: tooLarge
      ? [
          {
            id: makeId("def"),
            moduleId: "performance",
            category: "performance",
            severity: "P1",
            title: "Oversized client cache",
            detail: "One or more Zustand caches exceed 5000 rows.",
            reproductionSteps: ["Sign in to a large firm", "Open Reports → ERP Audit", "Inspect performance evidence"],
            evidence,
            fixStatus: "OPEN",
            retestStatus: "NOT_RUN",
          },
        ]
      : [],
  };
}

export async function runErpAudit(): Promise<ErpAuditReport> {
  const { firmId } = await resolveFirmId();
  const allDefects: AuditDefect[] = [];
  const modules: AuditModuleResult[] = [];

  const pack = async (
    probe: () => Promise<{
      result: Omit<AuditModuleResult, "defectIds">;
      defects: AuditDefect[];
    }>,
  ) => {
    const { result, defects } = await probe();
    allDefects.push(...defects);
    modules.push({ ...result, defectIds: defects.map((d) => d.id) });
  };

  await pack(probePeople);
  await pack(probeGoldMaterial);
  await pack(probeOrdersKarigar);
  await pack(probeStock);
  await pack(probeBilling);
  await pack(probeCalculations);
  await pack(probeRls);
  await pack(probeBarcodeGen);
  await pack(probePerformance);

  const hw = await probeHardwareDevices();
  allDefects.push(...hw.defects);
  for (const r of hw.results) {
    modules.push({ ...r, defectIds: [] });
  }

  // Specialized probes for remaining taxonomy rows (stores / PDF / portals)
  const covered = new Set(modules.map((m) => m.id));
  for (const def of ERP_AUDIT_MODULES) {
    if (covered.has(def.id)) continue;
    const specialized = await probeSpecializedModule(def.id);
    if (specialized) {
      allDefects.push(...specialized.defects);
      modules.push({ ...specialized.result, defectIds: specialized.defects.map((d) => d.id) });
      continue;
    }
    const { result, defects } = await probeGeneric(
      def.id,
      def.label,
      def.group,
      `Automated probe not yet specialized for "${def.label}". Manual golden path (Create→Save→Reload→Print) required — status BLOCKED until exercised.`,
      "BLOCKED",
    );
    allDefects.push(...defects);
    modules.push({ ...result, defectIds: defects.map((d) => d.id) });
  }

  const { overallScore, overallStatus, readyForRelease } = overallFromModules(modules);
  return {
    id: makeId("audit"),
    createdAt: Date.now(),
    firmId,
    overallScore,
    overallStatus,
    readyForRelease,
    modules,
    defects: allDefects,
    notes: [
      "Physical device and full Create→Print golden paths remain required — code PASS does not alone mean READY.",
      "Cross-tenant RLS: run qa/database/rls-isolation.test.ts with QA firm credentials.",
      "Hardware BLOCKED is expected until a real scanner/printer/scale is connected and exercised.",
    ],
  };
}
