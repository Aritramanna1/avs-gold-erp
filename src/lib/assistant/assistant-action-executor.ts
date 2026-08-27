/**
 * Canonical domain-service executors for Assistant confirmed actions.
 * All mutations flow through the same stores/services as the ERP UI.
 */
import { usePeople, type PersonType } from "@/lib/people-store";
import { insertPartyOpeningGoldCredit } from "@/lib/party-opening-balances";
import { useLedger } from "@/lib/ledger-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useStock } from "@/lib/stock-store";
import { useExpensesStore } from "@/lib/expenses-store";
import { useSettings } from "@/lib/settings-store";
import { fineGoldMg } from "@/lib/gold";
import type { ActionPayload } from "./assistant-types";

function mapPartyType(raw: string): PersonType {
  const normalized = raw.toLowerCase();
  if (normalized === "karigar" || normalized === "worker") return "karigar";
  if (normalized === "supplier" || normalized === "vendor") return "supplier";
  if (normalized === "dealer") return "dealer";
  return "customer";
}

export async function executeAssistantGoldIssue(
  payload: ActionPayload,
): Promise<{ success: boolean; message: string }> {
  const details = payload.details ?? {};
  const workerId = String(details.workerId ?? payload.targetId ?? "");
  const grossGrams = Number(details.grossGrams ?? details.grossWeight ?? 0);
  const purity = Number(details.purity ?? 995);
  const grossMg = Math.round(grossGrams * 1000);
  const fineMg = Math.round(Number(details.fineGrams ?? 0) * 1000) || fineGoldMg(grossMg, purity);

  if (!workerId || grossMg <= 0) {
    return { success: false, message: "Worker and gross weight are required for gold issue." };
  }

  const worker = usePeople.getState().people.find((p) => p.id === workerId);
  if (!worker) {
    return { success: false, message: "Selected worker was not found in People registry." };
  }

  const reference = String(details.orderNo ?? details.reference ?? `ASST-${Date.now()}`);

  await useLedger.getState().append({
    type: "issue_to_karigar",
    netFineMg: 0,
    deltas: { vault: -fineMg, karigar: fineMg },
    grossMg,
    purity,
    fineMg,
    reference,
    notes: `Issued via Assistant to ${worker.fullName}`,
    karigarId: workerId,
  } as never);

  await useWorkerGoldBook.getState().addEntry({
    workerId,
    workerName: worker.fullName,
    particulars: String(details.material ?? "Gold"),
    grossMg,
    lessMg: 0,
    netMg: grossMg,
    purity,
    fineMg,
    quantity: 1,
    notes: String(details.notes ?? "Issued via Assistant"),
    givenBy: "Assistant",
    receivedBy: worker.fullName,
    type: "given",
    reference,
  });

  return {
    success: true,
    message: `Posted gold issue of ${grossGrams} g to ${worker.fullName} through ledger and worker gold book.`,
  };
}

export async function executeAssistantCreateParty(
  payload: ActionPayload,
): Promise<{ success: boolean; message: string; partyId?: string }> {
  const details = payload.details ?? {};
  const fullName = String(details.fullName ?? "").trim();
  if (!fullName) return { success: false, message: "Party name is required." };

  const person = await usePeople.getState().add({
    fullName,
    phone: String(details.mobile ?? details.phone ?? ""),
    type: mapPartyType(String(details.partyType ?? "customer")),
    active: true,
  });

  const openingGold = parseFloat(String(details.openingGoldBalance ?? "0"));
  if (openingGold > 0) {
    const purity = Number(details.purity ?? details.purityPermille ?? 995);
    const grossMg = Math.round(openingGold * 1000);
    const fineMg = fineGoldMg(grossMg, purity);
    const opening = await insertPartyOpeningGoldCredit({
      partyId: person.id,
      fineGoldCreditMg: fineMg,
      notes: "Assistant conversational opening gold balance",
    });
    if (!opening.ok) {
      return {
        success: false,
        message: opening.error ?? "Failed to post opening gold balance.",
      };
    }
  }

  return {
    success: true,
    partyId: person.id,
    message: `Created ${details.partyType ?? "customer"} "${fullName}" in People registry.`,
  };
}

export async function executeAssistantCreateStock(
  payload: ActionPayload,
): Promise<{ success: boolean; message: string; tagId?: string }> {
  const details = payload.details ?? {};
  const grossWeight = parseFloat(String(details.grossWeight ?? "0"));
  if (grossWeight <= 0) {
    return { success: false, message: "Gross weight is required for stock creation." };
  }

  const grossMg = Math.round(grossWeight * 1000);
  const purity = String(details.purity ?? "").includes("18") ? 750 : 916;

  const item = await useStock.getState().addReadyStock(
    {
      itemName: String(details.itemType ?? "Ready Stock Item"),
      category: String(details.itemType ?? "Jewellery"),
      grossMg,
      netMg: grossMg,
      purity,
      piecesCount: parseInt(String(details.pieces ?? "1"), 10) || 1,
      status: "available",
      location: "counter",
    },
    "purchased",
  );

  return {
    success: true,
    tagId: item.id,
    message: `Added ${details.pieces ?? 1}x ${details.itemType} (${grossWeight}g) to inventory. Tag: ${item.barcode || item.id}.`,
  };
}

export async function executeAssistantCreateExpense(
  payload: ActionPayload,
): Promise<{ success: boolean; message: string; expenseId?: string }> {
  const details = payload.details ?? {};
  const amount = parseFloat(String(details.amount ?? "0"));
  if (amount <= 0) return { success: false, message: "Expense amount must be positive." };

  const branchId = useSettings.getState().selectedBranchId ?? "MAIN";
  const mode = String(details.paymentMethod ?? "cash").toLowerCase();
  const paymentMode =
    mode === "upi" || mode === "bank" || mode === "card"
      ? mode
      : mode === "cheque"
        ? "bank"
        : "cash";

  const expense = await useExpensesStore.getState().addExpense({
    date: String(details.date ?? new Date().toISOString().slice(0, 10)),
    type: "business",
    category: String(details.expenseCategory ?? "General"),
    amountPaise: Math.round(amount * 100),
    paymentMode: paymentMode as "cash" | "upi" | "bank" | "other",
    notes: "Booked via Assistant",
    branchId,
  });

  return {
    success: true,
    expenseId: expense.id,
    message: `Booked expense of ₹${amount} under ${details.expenseCategory}.`,
  };
}
