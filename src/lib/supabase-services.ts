import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { uploadToSupabaseStorage, getAttachmentSignedUrl } from "./supabase-storage";
import { uploadToHostinger, saveAttachmentMetadata } from "./hostinger-storage";

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
}

export interface GoldSettlementRecord {
  id: string;
  settlement_date: string;
  party_type: "customer" | "worker" | "vendor" | "internal";
  party_id: string;
  branch_id?: string;
  settlement_type:
    | "gold_received"
    | "gold_given"
    | "cash_received_against_gold"
    | "cash_paid_against_gold"
    // Customer pays cash as an advance; it is converted to gold weight at
    // that day's rate_per_gram_paise and credited to the customer's GOLD
    // balance (not the money balance) — a walk-in cash-for-future-gold
    // deposit, distinct from cash_received_against_gold (which pays off
    // gold already owed and only touches the money balance).
    | "cash_advance_gold_credit"
    | "wastage_adjustment"
    | "overloss_adjustment"
    | "final_settlement"
    // Customer owes us gold not yet received (e.g. paid an invoice short in
    // a Pay-In-Gold settlement) — distinct from "gold_given" (which means WE
    // handed gold TO the customer) so the customer ledger's Type/Description
    // column reads correctly instead of mislabeling a receivable as an
    // outgoing gold issue. See customer-account-ledger.ts's switch.
    | "gold_shortfall_receivable"
    // Outside Work (external jeweller) settlements — distinct types so the
    // Outside Work Ledger's Settlement History can tell a pure gold
    // settlement apart from a labour-bill settlement without guessing from
    // amount_paise/gold_entry_mg alone.
    | "outside_work_gold_settlement"
    | "outside_work_labour_settlement";
  purity: number;
  gross_mg: number;
  net_mg: number;
  wastage_mg: number;
  rate_per_gram_paise: number;
  amount_paise: number;
  payment_mode?: string;
  notes?: string;
  attachment_url?: string;
  // Extra rich data parameters for multi-item metal payments & double balances
  items?: any[];
  p_balance_gold_mg?: number;
  p_balance_cash_paise?: number;
  /** The specific prior voucher this p_balance_* carry-forward came from — cited on print as "LB Bal. [#<id> · <date>]", same lineage the legacy ledger shows. Absent for a party's first-ever voucher. */
  p_balance_ref_voucher_id?: string;
  p_balance_ref_voucher_date?: string;
  cash_entry_paise?: number;
  gold_entry_mg?: number;
  direction?: "Jama" | "Naam";
  link_use?: string;
  /** Outside Work only: the labour-charge component settled, in paise (kept
   *  distinct from amount_paise, which some callers already use for gold
   *  cash-equivalents, so labour cash never gets double-counted). */
  labour_component_paise?: number;
}

/**
 * 1. getFirmProfile()
 * Fetches the firm's profile data from app_settings table.
 */
export async function getFirmProfile(): Promise<FirmProfile | null> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("data")
      .eq("id", "firm")
      .maybeSingle();

    if (error || !data?.data) {
      console.warn(
        "[supabase-services] No existing firm profile in DB. Falling back to local state.",
      );
      return null;
    }
    const fullSettings = data.data as any;
    const firm = (fullSettings?.firm as FirmProfile) || null;

    // Dynamically re-sign logo to prevent expiration of transient signed URLs
    if (firm && firm.logoStoragePath) {
      try {
        const freshUrl = await getAttachmentSignedUrl("firm-assets", firm.logoStoragePath);
        if (freshUrl) {
          firm.logoUrl = freshUrl;
        }
      } catch (err) {
        console.warn("[supabase-services] Failed to dynamically sign firm logo:", err);
      }
    }

    return firm;
  } catch (err) {
    console.error("[supabase-services] Error in getFirmProfile:", err);
    return null;
  }
}

/**
 * 2. updateFirmProfile()
 * Saves/updates the firm's profile data in app_settings table.
 */
export async function updateFirmProfile(profile: FirmProfile): Promise<boolean> {
  try {
    const { data: currentFull } = await supabase
      .from("app_settings")
      .select("data")
      .eq("id", "firm")
      .maybeSingle();

    const currentData = (currentFull?.data as any) || {};
    const updatedData = {
      ...currentData,
      firm: {
        ...(currentData.firm || {}),
        ...profile,
      },
    };

    const { error } = await supabase.from("app_settings").upsert({
      id: "firm",
      scope: "firm",
      data: updatedData as any,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[supabase-services] Failed to update firm profile in DB:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[supabase-services] Error in updateFirmProfile:", err);
    return false;
  }
}

/**
 * 3. uploadFirmLogo()
 * Uploads logo image to Supabase Storage, logs metadata, and updates the firm profile inside app_settings in one sweep.
 */
export async function uploadFirmLogo(fileName: string, base64Url: string): Promise<string> {
  // 1. Upload to Supabase Storage "firm-assets" private bucket
  const filePath = await uploadToSupabaseStorage(
    "firm-assets",
    fileName,
    base64Url,
    "firm_profile",
    "logo",
  );

  // 2. Obtain a signed URL for visualization
  const signedUrl = await getAttachmentSignedUrl("firm-assets", filePath);

  // Parse mime type and size for metadata logging
  const parts = base64Url.split(";base64,");
  const mimeType = parts[0]?.split(":")[1] || "image/png";
  const sizeBytes = Math.round((parts[1] || "").length * 0.75);

  // 3. Register standard metadata in the attachments table
  await saveAttachmentMetadata({
    filePath: filePath,
    fileUrl: signedUrl,
    fileName: fileName,
    originalFileName: fileName,
    mimeType: mimeType,
    fileSize: sizeBytes,
    relatedModule: "firm-logos",
    relatedTable: "app_settings",
    relatedRecordId: "firm_profile",
    docKey: "logo",
    storageProvider: "cloudflare-r2",
  });

  // 4. Update the firm profile row
  const currentProfile = (await getFirmProfile()) || ({} as FirmProfile);
  currentProfile.logoUrl = signedUrl;
  currentProfile.logoStoragePath = filePath;
  await updateFirmProfile(currentProfile);

  return signedUrl;
}

/**
 * 4. createInvoice()
 * Inserts a new invoice into public.invoices table.
 */
export async function createInvoice(invoice: any): Promise<boolean> {
  try {
    const { error } = await supabase.from("invoices").insert({
      id: invoice.id,
      invoice_no: invoice.invoiceNo,
      customer_id: invoice.customerId || null,
      status: invoice.status,
      gst: invoice.gst,
      subtotal_paise: invoice.subtotalPaise,
      cgst_paise: invoice.cgstPaise,
      sgst_paise: invoice.sgstPaise,
      gst_paise: invoice.gstPaise,
      adjustment_paise: invoice.adjustmentPaise,
      grand_total_paise: invoice.grandTotalPaise,
      paid_paise: invoice.paidPaise,
      balance_paise: invoice.balancePaise,
      data: invoice,
    });

    if (error) {
      console.error("[supabase-services] Failed to create invoice in DB:", error.message);
      return false;
    }

    // Mirror payments
    if (invoice.payments && invoice.payments.length > 0) {
      for (const pay of invoice.payments) {
        await supabase.from("payments").upsert({
          id: pay.id,
          invoice_id: invoice.id,
          ts: new Date(pay.ts).toISOString(),
          mode: pay.mode,
          amount_paise: pay.amountPaise,
          reference: pay.reference || null,
          notes: pay.notes || null,
          data: pay,
        });
      }
    }

    return true;
  } catch (err) {
    console.error("[supabase-services] Error in createInvoice:", err);
    return false;
  }
}

/**
 * 5. updateInvoice()
 * Updates invoice fields in public.invoices table.
 */
export async function updateInvoice(id: string, patch: any): Promise<boolean> {
  try {
    const { data: currentInv } = await supabase
      .from("invoices")
      .select("data")
      .eq("id", id)
      .single();

    const mergedData = { ...((currentInv?.data as any) || {}), ...patch };

    const { error } = await supabase
      .from("invoices")
      .update({
        status: mergedData.status,
        gst: mergedData.gst,
        subtotal_paise: mergedData.subtotalPaise,
        cgst_paise: mergedData.cgstPaise,
        sgst_paise: mergedData.sgstPaise,
        gst_paise: mergedData.gstPaise,
        adjustment_paise: mergedData.adjustmentPaise,
        grand_total_paise: mergedData.grandTotalPaise,
        paid_paise: mergedData.paidPaise,
        balance_paise: mergedData.balancePaise,
        data: mergedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[supabase-services] Failed to update invoice in DB:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[supabase-services] Error in updateInvoice:", err);
    return false;
  }
}

/**
 * 6. getInvoice()
 * Fetches single invoice profile by id.
 */
export async function getInvoice(id: string): Promise<any | null> {
  try {
    const { data, error } = await supabase.from("invoices").select("data").eq("id", id).single();

    if (error) {
      console.error("[supabase-services] Failed to get invoice:", error.message);
      return null;
    }
    return data?.data;
  } catch (err) {
    console.error("[supabase-services] Error in getInvoice:", err);
    return null;
  }
}

/**
 * 7. listInvoices()
 * Lists invoice rows from Supabase DB.
 */
export async function listInvoices(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("data")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[supabase-services] Failed to list invoices:", error.message);
      return [];
    }
    return (data || []).map((x) => x.data);
  } catch (err) {
    console.error("[supabase-services] Error in listInvoices:", err);
    return [];
  }
}

/**
 * 8. createGoldSettlement()
 * Creates a persistent Gold Settlement record in the DB.
 */
export async function createGoldSettlement(
  settlement: Omit<GoldSettlementRecord, "id"> & { id?: string },
): Promise<GoldSettlementRecord | null> {
  try {
    const finalId = settlement.id || `gset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullRecord: GoldSettlementRecord = {
      id: finalId,
      ...settlement,
    };

    const { error } = await (supabase as any).from("gold_settlements").insert({
      id: finalId,
      settlement_date: fullRecord.settlement_date,
      party_type: fullRecord.party_type,
      party_id: fullRecord.party_id,
      branch_id: fullRecord.branch_id || null,
      settlement_type: fullRecord.settlement_type,
      purity: fullRecord.purity,
      gross_mg: fullRecord.gross_mg,
      net_mg: fullRecord.net_mg,
      wastage_mg: fullRecord.wastage_mg,
      rate_per_gram_paise: fullRecord.rate_per_gram_paise,
      amount_paise: fullRecord.amount_paise,
      payment_mode: fullRecord.payment_mode || null,
      notes: fullRecord.notes || null,
      attachment_url: fullRecord.attachment_url || null,
      data: fullRecord as any,
    });

    if (error) {
      console.error("[supabase-services] Failed to create gold settlement:", error.message);
      return null;
    }

    return fullRecord;
  } catch (err) {
    console.error("[supabase-services] Error in createGoldSettlement:", err);
    return null;
  }
}

/**
 * 9. listGoldSettlements()
 * Lists persistent gold settlement records from standard Supabase DB.
 * Pass branchId to restrict results to a single branch (required in multi-branch setups).
 */
export async function listGoldSettlements(branchId?: string): Promise<GoldSettlementRecord[]> {
  try {
    let query = supabase
      .from("gold_settlements" as any)
      .select("data")
      .order("settlement_date", { ascending: false });

    if (branchId) {
      query = (query as any).eq("branch_id", branchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[supabase-services] Failed to list gold settlements:", error.message);
      return [];
    }
    return ((data as any[]) || []).map((x) => x.data as GoldSettlementRecord);
  } catch (err) {
    console.error("[supabase-services] Error in listGoldSettlements:", err);
    return [];
  }
}

/**
 * 10. createPrintLog()
 * Creates/appends a logged document printing row in public.print_logs table.
 */
export async function createPrintLog(
  docType: string,
  docNumber: string,
  linkedId?: string,
  printedBy?: string,
  linkedLabel?: string,
): Promise<boolean> {
  try {
    const logId = `plog_${docType}_${docNumber}_${Date.now()}`;
    const { error } = await supabase.from("print_logs").insert({
      id: logId,
      doc_type: docType,
      doc_number: docNumber,
      linked_id: linkedId || null,
      linked_label: linkedLabel || docType,
      printed_by: printedBy || "System User",
      first_printed_at: new Date().toISOString(),
      last_printed_at: new Date().toISOString(),
      reprint_count: 0,
      history: [{ ts: Date.now(), user: printedBy || "System User" }],
    });

    if (error) {
      console.error("[supabase-services] Failed to create print log in DB:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[supabase-services] Error in createPrintLog:", err);
    return false;
  }
}

/**
 * 11. printInvoice()
 * Specialized wrapper for registering / logging printing of invoices.
 */
export async function printInvoice(
  invoiceId: string,
  docType: string,
  docNumber: string,
  printedBy?: string,
): Promise<boolean> {
  return createPrintLog(docType, docNumber, invoiceId, printedBy, "Invoice Record");
}
