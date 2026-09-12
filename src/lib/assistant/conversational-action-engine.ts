import { ERPActionCard, AssistantMessage, type ActionPayload } from "./assistant-types";

export interface DraftState {
  actionKey: string;
  status: "gathering_info" | "ready_for_preview" | "confirmed" | "cancelled";
  extractedFields: Record<string, any>;
  missingFields: string[];
  currentPromptField?: string;
  stepIdx: number;
}

export interface ActionDefinition {
  actionKey: string;
  requiredFields: string[];
  optionalFields: string[];
  prompts: Record<string, string>;
  generatePreviewCard: (draft: DraftState) => ERPActionCard;
}

// Simulated active draft in memory (In production, this would be tied to session/DB)
let activeDraft: DraftState | null = null;

const REGISTRY: Record<string, ActionDefinition> = {
  create_party: {
    actionKey: "create_party",
    requiredFields: ["fullName", "partyType", "mobile"],
    optionalFields: ["openingGoldBalance", "openingCashBalance"],
    prompts: {
      fullName: "What is the customer/business name?",
      partyType: "Is this a customer, supplier, or karigar?",
      mobile: "What is their mobile number?",
      openingGoldBalance: "Does this customer have an opening gold balance?",
    },
    generatePreviewCard: (draft) => ({
      type: "action_confirmation",
      title: "New Party Draft",
      summary: "Please review the details before creating this record.",
      actionPayload: {
        actionId: `draft_${Date.now()}`,
        actionType: "create_voucher",
        title: "Create Party",
        description: "Are you sure you want to create this new party record?",
        requiresConfirmation: true,
        details: draft.extractedFields,
      },
      kpis: [
        { label: "Name", value: draft.extractedFields.fullName },
        { label: "Type", value: draft.extractedFields.partyType },
        { label: "Mobile", value: draft.extractedFields.mobile },
      ],
      data: draft.extractedFields,
    }),
  },
  create_order: {
    actionKey: "create_order",
    requiredFields: ["partyId", "designReference", "expectedWeight"],
    optionalFields: [],
    prompts: {
      partyId: "Which customer is this order for?",
      designReference: "What is the design reference or description?",
      expectedWeight: "What is the expected weight?",
    },
    generatePreviewCard: (draft) => ({
      type: "action_confirmation",
      title: "New Order Draft",
      summary: "Please review the order details.",
      actionPayload: {
        actionId: `draft_${Date.now()}`,
        actionType: "create_voucher",
        title: "Create Order",
        description: "Are you sure you want to create this new order?",
        requiresConfirmation: true,
        details: draft.extractedFields,
      },
      kpis: [
        { label: "Customer", value: draft.extractedFields.partyId },
        { label: "Design", value: draft.extractedFields.designReference },
      ],
      data: draft.extractedFields,
    }),
  },
  create_ready_stock: {
    actionKey: "create_ready_stock",
    requiredFields: ["itemType", "metal", "purity", "grossWeight", "pieces"],
    optionalFields: ["stoneWeight", "netWeight", "tagNumber", "location"],
    prompts: {
      itemType: "What type of item is this? (e.g. Ring, Bangle, Necklace)",
      metal: "What metal is it made of? (e.g. Gold, Silver)",
      purity: "What is the purity? (e.g. 22K, 18K)",
      grossWeight: "What is the gross weight in grams?",
      pieces: "How many pieces are being added?",
    },
    generatePreviewCard: (draft) => ({
      type: "action_confirmation",
      title: "New Ready Stock Draft",
      summary: "Please review the inventory details.",
      actionPayload: {
        actionId: `draft_${Date.now()}`,
        actionType: "create_voucher",
        title: "Create Ready Stock",
        description: "Are you sure you want to add this to inventory?",
        requiresConfirmation: true,
        details: draft.extractedFields,
      },
      kpis: [
        { label: "Item", value: draft.extractedFields.itemType },
        { label: "Weight", value: `${draft.extractedFields.grossWeight}g` },
        { label: "Purity", value: draft.extractedFields.purity },
      ],
      data: draft.extractedFields,
    }),
  },
  create_expense: {
    actionKey: "create_expense",
    requiredFields: ["expenseCategory", "amount", "paymentMethod"],
    optionalFields: ["date", "partyId"],
    prompts: {
      expenseCategory: "What is the expense category? (e.g. Travel, Meals, Supplies)",
      amount: "What is the total amount?",
      paymentMethod: "How was this paid? (e.g. Cash, Bank Transfer, UPI)",
    },
    generatePreviewCard: (draft) => ({
      type: "action_confirmation",
      title: "New Expense Draft",
      summary: "Please review the expense details.",
      actionPayload: {
        actionId: `draft_${Date.now()}`,
        actionType: "create_voucher",
        title: "Book Expense",
        description: "Are you sure you want to book this expense?",
        requiresConfirmation: true,
        details: draft.extractedFields,
      },
      kpis: [
        { label: "Category", value: draft.extractedFields.expenseCategory },
        { label: "Amount", value: `₹${draft.extractedFields.amount}` },
        { label: "Payment", value: draft.extractedFields.paymentMethod },
      ],
      data: draft.extractedFields,
    }),
  },
  create_job: {
    actionKey: "create_job",
    requiredFields: ["orderId", "karigarId", "processType"],
    optionalFields: ["dueDate"],
    prompts: {
      orderId: "Which order ID is this for?",
      karigarId: "Which karigar (worker) is assigned to this job?",
      processType: "What is the process type? (e.g. Making, Polish, Setting)",
    },
    generatePreviewCard: (draft) => ({
      type: "action_confirmation",
      title: "New Job Draft",
      summary: "Please review the job assignment details.",
      actionPayload: {
        actionId: `draft_${Date.now()}`,
        actionType: "create_voucher",
        title: "Assign Job",
        description: "Are you sure you want to assign this job?",
        requiresConfirmation: true,
        details: draft.extractedFields,
      },
      kpis: [
        { label: "Order", value: draft.extractedFields.orderId },
        { label: "Worker", value: draft.extractedFields.karigarId },
        { label: "Process", value: draft.extractedFields.processType },
      ],
      data: draft.extractedFields,
    }),
  },
  issue_gold: {
    actionKey: "issue_gold",
    requiredFields: ["karigarId", "jobId", "sourceVault", "grossWeight", "purity"],
    optionalFields: [],
    prompts: {
      karigarId: "Which karigar is receiving this gold?",
      jobId: "Which job ID is this for?",
      sourceVault: "Which vault are you issuing from?",
      grossWeight: "What is the gross weight to issue?",
      purity: "What is the purity of the metal?",
    },
    generatePreviewCard: (draft) => ({
      type: "action_confirmation",
      title: "Issue Gold Draft",
      summary: "Please review the gold issuance details.",
      actionPayload: {
        actionId: `draft_${Date.now()}`,
        actionType: "gold_issue",
        title: "Issue Gold",
        description: "Confirm gold transfer from vault to worker.",
        requiresConfirmation: true,
        details: {
          ...draft.extractedFields,
          workerId: draft.extractedFields.karigarId ?? draft.extractedFields.workerId,
          karigarId: draft.extractedFields.karigarId ?? draft.extractedFields.workerId,
          grossGrams: Number(
            draft.extractedFields.grossWeight ?? draft.extractedFields.grossGrams ?? 0,
          ),
          fineGrams: Number(
            draft.extractedFields.fineGrams ??
              (draft.extractedFields.grossWeight && draft.extractedFields.purity
                ? (Number(draft.extractedFields.grossWeight) *
                    Number(draft.extractedFields.purity)) /
                  1000
                : (draft.extractedFields.grossWeight ?? 0)),
          ),
          purity: Number(draft.extractedFields.purity ?? 0),
        },
      },
      kpis: [
        { label: "Karigar", value: draft.extractedFields.karigarId },
        { label: "Weight", value: `${draft.extractedFields.grossWeight}g` },
        { label: "Vault", value: draft.extractedFields.sourceVault },
      ],
      data: draft.extractedFields,
    }),
  },
  receive_gold: {
    actionKey: "receive_gold",
    requiredFields: ["jobId", "grossReceivedWeight"],
    optionalFields: ["stoneDeduction", "lossWeight", "scrapRecovery"],
    prompts: {
      jobId: "Which job ID are you receiving against?",
      grossReceivedWeight: "What is the gross weight received?",
    },
    generatePreviewCard: (draft) => ({
      type: "action_confirmation",
      title: "Receive Gold Draft",
      summary: "Please review the receiving details.",
      actionPayload: {
        actionId: `draft_${Date.now()}`,
        actionType: "create_voucher",
        title: "Receive Gold",
        description: "Confirm receiving gold from worker.",
        requiresConfirmation: true,
        details: draft.extractedFields,
      },
      kpis: [
        { label: "Job", value: draft.extractedFields.jobId },
        { label: "Weight", value: `${draft.extractedFields.grossReceivedWeight}g` },
      ],
      data: draft.extractedFields,
    }),
  },
  create_invoice: {
    actionKey: "create_invoice",
    requiredFields: ["partyId", "itemsList"],
    optionalFields: ["applicableBhav", "taxConfig", "paymentTerms"],
    prompts: {
      partyId: "Which customer is this invoice for?",
      itemsList: "What items are being invoiced? (Please describe or list them)",
    },
    generatePreviewCard: (draft) => ({
      type: "action_confirmation",
      title: "New Invoice Draft",
      summary: "Please review the invoice details.",
      actionPayload: {
        actionId: `draft_${Date.now()}`,
        actionType: "create_voucher",
        title: "Create Invoice",
        description: "Are you sure you want to generate this invoice?",
        requiresConfirmation: true,
        details: draft.extractedFields,
      },
      kpis: [
        { label: "Customer", value: draft.extractedFields.partyId },
        { label: "Items", value: draft.extractedFields.itemsList },
      ],
      data: draft.extractedFields,
    }),
  },
  prepare_payment: {
    actionKey: "prepare_payment",
    requiredFields: ["partyId", "amountPaise", "paymentType"],
    optionalFields: ["paymentMode"],
    prompts: {
      partyId: "Which party is this payment for? (name or id)",
      amountPaise: "What is the amount in rupees?",
      paymentType: "Is this inward (receive) or outward (pay)?",
      paymentMode: "Cash, UPI, bank, or card?",
    },
    generatePreviewCard: (draft) => ({
      type: "voucher_draft",
      title: "PREPARE payment draft (not posted)",
      summary: "HIGH-RISK payment draft. Confirm on the card — never auto-posts.",
      actionRoute: "/control/accounts",
      actionPayload: {
        actionId: `draft_pay_${Date.now()}`,
        actionType: "execute_payment",
        title: "Confirm payment EXECUTE",
        description:
          "HIGH-RISK: EXECUTE stub refuses unless isConfirmed and required fields are present. No ledger invented.",
        requiresConfirmation: true,
        isConfirmed: false,
        details: {
          capabilityId: "AI_EXECUTE_PAYMENT",
          ...draft.extractedFields,
        },
      },
      kpis: [
        { label: "Party", value: draft.extractedFields.partyId },
        { label: "Amount", value: String(draft.extractedFields.amountPaise ?? "missing") },
        { label: "Type", value: draft.extractedFields.paymentType },
      ],
      data: { ...draft.extractedFields, approvalRequired: true },
    }),
  },
  prepare_settlement: {
    actionKey: "prepare_settlement",
    requiredFields: ["karigarId"],
    optionalFields: ["settlementGoldMg", "settlementCashPaise"],
    prompts: {
      karigarId: "Which karigar is this settlement for?",
      settlementGoldMg: "Gold to settle (grams)? Leave blank if cash-only.",
      settlementCashPaise: "Cash to settle (rupees)? Leave blank if metal-only.",
    },
    generatePreviewCard: (draft) => ({
      type: "voucher_draft",
      title: "PREPARE settlement draft (not posted)",
      summary: "HIGH-RISK settlement draft. Confirm on the card — never auto-posts.",
      actionRoute: "/settlement/new",
      actionPayload: {
        actionId: `draft_settle_${Date.now()}`,
        actionType: "execute_settlement",
        title: "Confirm settlement EXECUTE",
        description:
          "HIGH-RISK: EXECUTE stub refuses unless isConfirmed and required fields are present. No ledger invented.",
        requiresConfirmation: true,
        isConfirmed: false,
        details: {
          capabilityId: "AI_EXECUTE_SETTLEMENT",
          ...draft.extractedFields,
        },
      },
      kpis: [
        { label: "Karigar", value: draft.extractedFields.karigarId },
        { label: "Gold mg", value: String(draft.extractedFields.settlementGoldMg ?? "—") },
        { label: "Cash paise", value: String(draft.extractedFields.settlementCashPaise ?? "—") },
      ],
      data: { ...draft.extractedFields, approvalRequired: true },
    }),
  },
};

export function startActionDraft(
  actionKey: string,
  initialEntities: Record<string, any> = {},
): string {
  const def = REGISTRY[actionKey];
  if (!def) return "I cannot perform that action right now.";

  const missing = def.requiredFields.filter((f) => !initialEntities[f]);

  activeDraft = {
    actionKey,
    status: missing.length > 0 ? "gathering_info" : "ready_for_preview",
    extractedFields: initialEntities,
    missingFields: missing,
    currentPromptField: missing[0],
    stepIdx: 0,
  };

  if (activeDraft.status === "ready_for_preview") {
    return "I have all the required information. Are you ready to preview?";
  }

  return (
    def.prompts[activeDraft.currentPromptField!] ||
    `Please provide ${activeDraft.currentPromptField}.`
  );
}

export function processDraftInput(userInput: string): {
  reply: string;
  card?: ERPActionCard;
  completed: boolean;
  executePayload?: ActionPayload;
} {
  if (!activeDraft) return { reply: "No active draft.", completed: true };

  const def = REGISTRY[activeDraft.actionKey];

  if (activeDraft.status === "gathering_info") {
    // Basic extraction - in reality this would use a lightweight intent/entity extractor
    activeDraft.extractedFields[activeDraft.currentPromptField!] = userInput;

    // Recalculate missing
    activeDraft.missingFields = def.requiredFields.filter((f) => !activeDraft!.extractedFields[f]);

    if (activeDraft.missingFields.length > 0) {
      activeDraft.currentPromptField = activeDraft.missingFields[0];
      return {
        reply:
          def.prompts[activeDraft.currentPromptField] ||
          `Please provide ${activeDraft.currentPromptField}.`,
        completed: false,
      };
    } else {
      activeDraft.status = "ready_for_preview";
      const card = def.generatePreviewCard(activeDraft);
      const reply = `I have everything needed. Would you like to add anything else like opening balances, or shall I create the record?`;
      return { reply, card, completed: false };
    }
  }

  if (activeDraft.status === "ready_for_preview") {
    if (
      userInput.toLowerCase().includes("confirm") ||
      userInput.toLowerCase().includes("yes") ||
      userInput.toLowerCase().includes("create")
    ) {
      const card = def.generatePreviewCard(activeDraft);
      const payload = card.actionPayload;
      const highRiskNoAuto =
        activeDraft.actionKey === "prepare_payment" ||
        activeDraft.actionKey === "prepare_settlement" ||
        payload?.actionType === "execute_payment" ||
        payload?.actionType === "execute_settlement";
      activeDraft = null;
      if (highRiskNoAuto) {
        return {
          reply:
            "HIGH-RISK draft ready. Click Confirm & Execute on the card. Payment/settlement never auto-posts from chat.",
          card,
          completed: true,
        };
      }
      if (!payload) {
        return {
          reply: "Could not execute — draft action payload is missing.",
          completed: true,
        };
      }
      return {
        reply: "Executing confirmed action…",
        completed: true,
        executePayload: { ...payload, isConfirmed: true },
      };
    }
  }

  return {
    reply: "I'm not sure what you mean. Do you want to confirm or cancel?",
    completed: false,
  };
}

export function getActiveDraft(): DraftState | null {
  return activeDraft;
}

export function clearDraft() {
  activeDraft = null;
}
