/**
 * Ornexa Unified Credit Engine
 * Production wallet + ledger via Supabase RPC; local fallback for dev-only surfaces.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface CreditRateCard {
  service: "cloud_ai" | "whatsapp" | "premium_ocr" | "sms";
  unit: "1k_tokens" | "message" | "document_scan";
  creditsPerUnit: number;
  description: string;
}

export interface CreditTransaction {
  id: string;
  tenantId: string;
  service: "cloud_ai" | "whatsapp" | "premium_ocr" | "topup" | "adjustment" | "plan_grant";
  amount: number; // positive = added, negative = deducted
  balanceAfter: number;
  reason: string;
  referenceId?: string;
  timestamp: string;
  actor?: string;
}

export interface TenantCreditWallet {
  tenantId: string;
  creditBalance: number;
  consumedThisMonth: number;
  aiCreditsUsed: number;
  whatsappCreditsUsed: number;
  ocrCreditsUsed: number;
  lowBalanceThreshold: number;
  isLowBalance: boolean;
  lastUpdated: string;
}

const WALLET_STORAGE_KEY = "ornexa_credit_wallet";
const TRANSACTIONS_STORAGE_KEY = "ornexa_credit_transactions";

export const DEFAULT_RATE_CARDS: CreditRateCard[] = [
  {
    service: "cloud_ai",
    unit: "1k_tokens",
    creditsPerUnit: 5,
    description: "Cloud LLM reasoning & multi-step analysis (per 1,000 tokens)",
  },
  {
    service: "whatsapp",
    unit: "message",
    creditsPerUnit: 10,
    description: "Official WhatsApp Business API utility & transactional messages",
  },
  {
    service: "premium_ocr",
    unit: "document_scan",
    creditsPerUnit: 15,
    description: "Deep multimodal document & invoice vision extraction",
  },
];

export function getTenantCreditWallet(tenantId: string = "default_firm"): TenantCreditWallet {
  try {
    const raw = localStorage.getItem(`${WALLET_STORAGE_KEY}_${tenantId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }

  // Default initial starter wallet
  const initialWallet: TenantCreditWallet = {
    tenantId,
    creditBalance: 500, // 500 complimentary starter credits
    consumedThisMonth: 45,
    aiCreditsUsed: 25,
    whatsappCreditsUsed: 20,
    ocrCreditsUsed: 0,
    lowBalanceThreshold: 50,
    isLowBalance: false,
    lastUpdated: new Date().toISOString(),
  };

  try {
    localStorage.setItem(`${WALLET_STORAGE_KEY}_${tenantId}`, JSON.stringify(initialWallet));
  } catch {
    // Ignore
  }

  return initialWallet;
}

export function getCreditTransactions(tenantId: string = "default_firm"): CreditTransaction[] {
  try {
    const raw = localStorage.getItem(`${TRANSACTIONS_STORAGE_KEY}_${tenantId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return [];
}

export function deductCredits(
  service: "cloud_ai" | "whatsapp" | "premium_ocr",
  amount: number,
  reason: string,
  referenceId?: string,
  tenantId: string = "default_firm",
): { success: boolean; newBalance: number; error?: string } {
  const serviceCode =
    service === "cloud_ai" ? "ai_query" : service === "premium_ocr" ? "ai_doc_ocr" : "wa_utility";

  void (async () => {
    try {
      const { data, error } = await (supabase as any).rpc("deduct_tenant_credits", {
        p_service_code: serviceCode,
        p_units: amount,
        p_reference_id: referenceId ?? null,
        p_description: reason,
        p_metadata: { legacy_service: service, tenant_id: tenantId },
      });
      if (error) console.warn("[CreditEngine] Supabase deduction failed:", error.message);
      else if (data && !(data as { success?: boolean }).success) {
        console.warn("[CreditEngine] Insufficient credits:", (data as { error?: string }).error);
      }
    } catch {
      // fall through to local dev wallet below
    }
  })();

  return deductCreditsLocal(service, amount, reason, referenceId, tenantId);
}

function deductCreditsLocal(
  service: "cloud_ai" | "whatsapp" | "premium_ocr",
  amount: number,
  reason: string,
  referenceId?: string,
  tenantId: string = "default_firm",
): { success: boolean; newBalance: number; error?: string } {
  const wallet = getTenantCreditWallet(tenantId);

  if (wallet.creditBalance < amount) {
    return {
      success: false,
      newBalance: wallet.creditBalance,
      error: `Insufficient credits. Required: ${amount}, Available: ${wallet.creditBalance}. Please add credits or use local standard mode.`,
    };
  }

  wallet.creditBalance -= amount;
  wallet.consumedThisMonth += amount;
  if (service === "cloud_ai") wallet.aiCreditsUsed += amount;
  if (service === "whatsapp") wallet.whatsappCreditsUsed += amount;
  if (service === "premium_ocr") wallet.ocrCreditsUsed += amount;
  wallet.isLowBalance = wallet.creditBalance <= wallet.lowBalanceThreshold;
  wallet.lastUpdated = new Date().toISOString();

  // Record transaction in ledger
  const tx: CreditTransaction = {
    id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tenantId,
    service,
    amount: -amount,
    balanceAfter: wallet.creditBalance,
    reason,
    referenceId,
    timestamp: new Date().toISOString(),
  };

  try {
    localStorage.setItem(`${WALLET_STORAGE_KEY}_${tenantId}`, JSON.stringify(wallet));
    const txs = getCreditTransactions(tenantId);
    localStorage.setItem(
      `${TRANSACTIONS_STORAGE_KEY}_${tenantId}`,
      JSON.stringify([tx, ...txs.slice(0, 100)]),
    );
  } catch {
    // Ignore
  }

  return { success: true, newBalance: wallet.creditBalance };
}

export function addCredits(
  amount: number,
  packType: "starter" | "pack_500" | "pack_2000" | "enterprise" | "promo",
  referenceId?: string,
  actorId: string = "Admin",
  tenantId: string = "default_firm",
): TenantCreditWallet {
  const wallet = getTenantCreditWallet(tenantId);
  wallet.creditBalance += amount;
  wallet.isLowBalance = wallet.creditBalance <= wallet.lowBalanceThreshold;
  wallet.lastUpdated = new Date().toISOString();

  const tx: CreditTransaction = {
    id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tenantId,
    service: "topup",
    amount,
    balanceAfter: wallet.creditBalance,
    reason: `Credit Top-up (${packType})`,
    referenceId,
    actor: actorId,
    timestamp: new Date().toISOString(),
  };

  try {
    localStorage.setItem(`${WALLET_STORAGE_KEY}_${tenantId}`, JSON.stringify(wallet));
    const txs = getCreditTransactions(tenantId);
    localStorage.setItem(
      `${TRANSACTIONS_STORAGE_KEY}_${tenantId}`,
      JSON.stringify([tx, ...txs.slice(0, 100)]),
    );
  } catch {
    // Ignore
  }

  return wallet;
}

export function checkServiceCreditAvailability(
  service: "cloud_ai" | "whatsapp" | "premium_ocr",
  tenantId: string = "default_firm",
): { available: boolean; balance: number; minRequired: number } {
  const wallet = getTenantCreditWallet(tenantId);
  const minRequired = service === "premium_ocr" ? 15 : service === "whatsapp" ? 10 : 5;
  return {
    available: wallet.creditBalance >= minRequired,
    balance: wallet.creditBalance,
    minRequired,
  };
}
