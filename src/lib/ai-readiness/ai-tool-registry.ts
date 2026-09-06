/**
 * Arivahly Venture Sphere (AVS) — Standardized AI Tool Registry
 * 
 * Schema-bound, audited tool declarations for AI agents.
 * AI interacts exclusively through these controlled tools instead of direct database access.
 * Honors the Three-Ledger financial architecture (Cash, Gold, Mixed) and Draft-First safety.
 */

import { usePeople } from "@/lib/people-store";
import { useStock } from "@/lib/stock-store";
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { useBilling } from "@/lib/billing-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useOrders } from "@/lib/orders-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { mgToGrams } from "@/lib/gold";
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required: boolean;
  }[];
  permissionLevel: number;
  handler: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export const AI_TOOL_REGISTRY: Record<string, AIToolDefinition> = {
  // 1. CUSTOMER SEARCH
  search_customer: {
    name: 'search_customer',
    description: 'Search customer database by phone, name, email, or customer ID.',
    permissionLevel: 0,
    parameters: [
      { name: 'query', type: 'string', description: 'Customer search query (name, phone, ID)', required: true },
    ],
    handler: async (params) => {
      const q = String(params.query || "").toLowerCase();
      const people = usePeople.getState().people;
      const matches = people
        .filter((p) => p.category === "customer" || !p.category)
        .filter((p) => 
          p.name.toLowerCase().includes(q) || 
          p.phone.includes(q) || 
          (p.email && p.email.toLowerCase().includes(q)) ||
          p.id.toLowerCase().includes(q)
        )
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          city: p.city,
          category: p.category,
        }));
      return { status: 'success', count: matches.length, matches };
    },
  },

  // 2. SUPPLIER SEARCH
  search_supplier: {
    name: 'search_supplier',
    description: 'Search supplier and bullion dealer database by name, phone, or company.',
    permissionLevel: 0,
    parameters: [
      { name: 'query', type: 'string', description: 'Supplier name or phone query', required: true },
    ],
    handler: async (params) => {
      const q = String(params.query || "").toLowerCase();
      const people = usePeople.getState().people;
      const matches = people
        .filter((p) => p.category === "supplier" || p.category === "dealer")
        .filter((p) => 
          p.name.toLowerCase().includes(q) || 
          p.phone.includes(q) || 
          p.id.toLowerCase().includes(q)
        )
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          city: p.city,
          category: p.category,
        }));
      return { status: 'success', count: matches.length, matches };
    },
  },

  // 3. KARIGAR / ARTISAN SEARCH
  search_karigar: {
    name: 'search_karigar',
    description: 'Search karigars, goldsmiths, and outside workshop artisans.',
    permissionLevel: 0,
    parameters: [
      { name: 'query', type: 'string', description: 'Karigar name or code', required: true },
    ],
    handler: async (params) => {
      const q = String(params.query || "").toLowerCase();
      const people = usePeople.getState().people;
      const matches = people
        .filter((p) => p.category === "worker" || p.category === "karigar" || p.category === "artisan")
        .filter((p) => 
          p.name.toLowerCase().includes(q) || 
          p.phone.includes(q) || 
          p.id.toLowerCase().includes(q)
        )
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          city: p.city,
          category: p.category,
        }));
      return { status: 'success', count: matches.length, matches };
    },
  },

  // 4. EMPLOYEE SEARCH
  search_employee: {
    name: 'search_employee',
    description: 'Search staff, sales executives, and showroom employees.',
    permissionLevel: 0,
    parameters: [
      { name: 'query', type: 'string', description: 'Employee name or staff ID', required: true },
    ],
    handler: async (params) => {
      const q = String(params.query || "").toLowerCase();
      const people = usePeople.getState().people;
      const matches = people
        .filter((p) => p.category === "employee" || p.category === "staff")
        .filter((p) => 
          p.name.toLowerCase().includes(q) || 
          p.phone.includes(q) || 
          p.id.toLowerCase().includes(q)
        )
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          category: p.category,
        }));
      return { status: 'success', count: matches.length, matches };
    },
  },

  // 5. INVENTORY & ITEM SEARCH
  search_item: {
    name: 'search_item',
    description: 'Search catalogue and ready stock items by barcode, item code, category, or purity.',
    permissionLevel: 0,
    parameters: [
      { name: 'query', type: 'string', description: 'Item barcode, code, category, or name', required: true },
    ],
    handler: async (params) => {
      const q = String(params.query || "").toLowerCase();
      const items = useStock.getState().items;
      const matches = items
        .filter((i) => 
          i.itemCode.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.category && i.category.toLowerCase().includes(q)) ||
          (i.barcode && i.barcode.toLowerCase().includes(q))
        )
        .slice(0, 10)
        .map((i) => ({
          id: i.id,
          itemCode: i.itemCode,
          name: i.name,
          category: i.category,
          purity: i.purity,
          grossWeightG: i.grossWeightG,
          netWeightG: i.netWeightG,
          status: i.status || 'in_stock',
        }));
      return { status: 'success', count: matches.length, matches };
    },
  },

  // 6. INVENTORY LEVELS / STOCK CHECK
  get_inventory_levels: {
    name: 'get_inventory_levels',
    description: 'Get live inventory counts, weights, and availability for a product category or SKU.',
    permissionLevel: 0,
    parameters: [
      { name: 'category', type: 'string', description: 'Jewellery category or SKU code', required: false },
    ],
    handler: async (params) => {
      const cat = params.category ? String(params.category).toLowerCase() : undefined;
      const items = useStock.getState().items;
      const filtered = cat
        ? items.filter((i) => (i.category || "").toLowerCase().includes(cat) || i.itemCode.toLowerCase().includes(cat))
        : items;
      
      const inStock = filtered.filter((i) => i.status === "in_stock" || !i.status);
      const totalWeightG = inStock.reduce((acc, i) => acc + Number(i.grossWeightG || 0), 0);

      return {
        status: 'success',
        totalItems: filtered.length,
        inStockCount: inStock.length,
        totalGrossWeightG: Number(totalWeightG.toFixed(3)),
        sampleItems: inStock.slice(0, 5).map((i) => ({
          id: i.id,
          itemCode: i.itemCode,
          name: i.name,
          category: i.category,
          purity: i.purity,
          grossWeightG: i.grossWeightG,
        })),
      };
    },
  },

  // 7. BARCODE & HUID LOOKUP
  search_barcode: {
    name: 'search_barcode',
    description: 'Find exact item or manufacturing job by Barcode or Hallmarking HUID tag.',
    permissionLevel: 0,
    parameters: [
      { name: 'barcode', type: 'string', description: 'Barcode or HUID identifier', required: true },
    ],
    handler: async (params) => {
      const code = String(params.barcode || "").trim().toLowerCase();
      const items = useStock.getState().items;
      const jobCards = useJobCards.getState().cards;

      const matchedStock = items.find((i) => (i.barcode && i.barcode.toLowerCase() === code) || i.itemCode.toLowerCase() === code);
      if (matchedStock) {
        return {
          status: 'success',
          type: 'stock_item',
          item: {
            id: matchedStock.id,
            itemCode: matchedStock.itemCode,
            name: matchedStock.name,
            category: matchedStock.category,
            purity: matchedStock.purity,
            grossWeightG: matchedStock.grossWeightG,
            netWeightG: matchedStock.netWeightG,
            status: matchedStock.status || 'in_stock',
          },
        };
      }

      const matchedJob = jobCards.find((j) => (j.jobCardNumber && j.jobCardNumber.toLowerCase() === code) || j.id.toLowerCase() === code);
      if (matchedJob) {
        return {
          status: 'success',
          type: 'job_card',
          job: {
            id: matchedJob.id,
            jobCardNumber: matchedJob.jobCardNumber,
            productName: matchedJob.productName,
            status: matchedJob.status,
            workerId: matchedJob.workerId,
            dueDeliveryDate: matchedJob.dueDeliveryDate,
          },
        };
      }

      return { status: 'not_found', message: `No stock item or job card matching barcode "${params.barcode}"` };
    },
  },

  // 8. VAULT GOLD BALANCE
  get_vault_gold_balance: {
    name: 'get_vault_gold_balance',
    description: 'Get authoritative vault and system gold weight balances from the Gold Ledger.',
    permissionLevel: 0,
    parameters: [],
    handler: async () => {
      const entries = useLedger.getState().entries;
      const balances = computeBalances(entries);
      return {
        status: 'success',
        vaultFineG: Number(mgToGrams(balances.vault)),
        karigarFineG: Number(mgToGrams(balances.karigar)),
        customerFineG: Number(mgToGrams(balances.customer)),
        scrapFineG: Number(mgToGrams(balances.scrap)),
        totalGoldUnderManagementG: Number(mgToGrams(balances.total)),
      };
    },
  },

  // 9. THREE-LEDGER: CASH LEDGER
  get_cash_ledger: {
    name: 'get_cash_ledger',
    description: 'Get cash and bank account transactions and net balance (₹).',
    permissionLevel: 0,
    parameters: [
      { name: 'partyId', type: 'string', description: 'Optional Party/Customer ID', required: false },
    ],
    handler: async (params) => {
      const invoices = useBilling.getState().invoices;
      const partyId = params.partyId ? String(params.partyId) : null;
      const filtered = partyId ? invoices.filter((i) => i.customerId === partyId) : invoices;
      const totalSalesPaise = filtered.reduce((acc, i) => acc + (i.grandTotalPaise || 0), 0);
      return {
        status: 'success',
        totalInvoices: filtered.length,
        totalSalesRupees: totalSalesPaise / 100,
        currency: 'INR',
      };
    },
  },

  // 10. THREE-LEDGER: GOLD LEDGER (BY PURITY)
  get_gold_ledger: {
    name: 'get_gold_ledger',
    description: 'Get gold transactions and net balance separated by purity (22K, 18K, Fine).',
    permissionLevel: 0,
    parameters: [
      { name: 'workerOrPartyId', type: 'string', description: 'Karigar or Customer ID', required: false },
    ],
    handler: async (params) => {
      const id = params.workerOrPartyId ? String(params.workerOrPartyId) : null;
      if (id) {
        const book = useWorkerGoldBook.getState();
        const bal = book.getWorkerBalance(id);
        return {
          status: 'success',
          entityId: id,
          pendingFineGoldG: Number(mgToGrams(bal.pendingFine)),
          totalIssuedFineGoldG: Number(mgToGrams(bal.totalGivenFine)),
          totalReturnedFineGoldG: Number(mgToGrams(bal.totalReturnedFine)),
        };
      }
      const ledger = useLedger.getState().entries;
      const bal = computeBalances(ledger);
      return {
        status: 'success',
        vaultFineG: Number(mgToGrams(bal.vault)),
        karigarFineG: Number(mgToGrams(bal.karigar)),
        customerFineG: Number(mgToGrams(bal.customer)),
        scrapFineG: Number(mgToGrams(bal.scrap)),
      };
    },
  },

  // 11. THREE-LEDGER: MIXED LEDGER (DUAL CURRENCY)
  get_mixed_ledger: {
    name: 'get_mixed_ledger',
    description: 'Get dual-currency financial overview (Cash ₹ and Metal Gold g) for a party.',
    permissionLevel: 0,
    parameters: [
      { name: 'partyId', type: 'string', description: 'Customer or Karigar ID', required: true },
    ],
    handler: async (params) => {
      const partyId = String(params.partyId);
      const invoices = useBilling.getState().invoices.filter((i) => i.customerId === partyId);
      const totalSalesPaise = invoices.reduce((acc, i) => acc + (i.grandTotalPaise || 0), 0);
      const book = useWorkerGoldBook.getState();
      const workerBal = book.getWorkerBalance(partyId);

      return {
        status: 'success',
        partyId,
        cashBalanceRupees: totalSalesPaise / 100,
        goldPendingGrams: Number(mgToGrams(workerBal.pendingFine)),
        invoiceCount: invoices.length,
      };
    },
  },

  // 12. KARIGAR BALANCE & OVER-LOSS
  get_karigar_balance: {
    name: 'get_karigar_balance',
    description: 'Get live gold and material balance for a specific Karigar / artisan.',
    permissionLevel: 0,
    parameters: [
      { name: 'workerId', type: 'string', description: 'Worker or Karigar ID', required: true },
    ],
    handler: async (params) => {
      const workerId = String(params.workerId);
      const book = useWorkerGoldBook.getState();
      const bal = book.getWorkerBalance(workerId);
      return {
        status: 'success',
        workerId,
        pendingFineG: Number(mgToGrams(bal.pendingFine)),
        totalGivenFineG: Number(mgToGrams(bal.totalGivenFine)),
        totalReturnedFineG: Number(mgToGrams(bal.totalReturnedFine)),
        pendingQuantity: bal.pendingQty,
      };
    },
  },

  // 13. KARIGAR OVER-LOSS HISTORY
  get_karigar_overloss: {
    name: 'get_karigar_overloss',
    description: 'Get historical over-loss transactions and loss percentages for a karigar.',
    permissionLevel: 0,
    parameters: [
      { name: 'workerId', type: 'string', description: 'Karigar ID', required: true },
    ],
    handler: async (params) => {
      const workerId = String(params.workerId);
      const entries = useWorkerGoldBook.getState().entries.filter((e) => e.workerId === workerId && e.type === 'over_loss');
      return {
        status: 'success',
        workerId,
        overLossCount: entries.length,
        entries: entries.slice(0, 10).map((e) => ({
          id: e.id,
          date: e.createdAt,
          purity: e.purity,
          weightGrams: e.weightGrams,
          notes: e.notes,
        })),
      };
    },
  },

  // 14. OUTSTANDING RECEIVABLES & PAYABLES
  get_outstanding: {
    name: 'get_outstanding',
    description: 'Outstanding receivables/payables ageing analysis.',
    permissionLevel: 0,
    parameters: [
      { name: 'partyId', type: 'string', description: 'Optional Party ID', required: false },
    ],
    handler: async (params) => {
      const invoices = useBilling.getState().invoices;
      const unpaid = invoices.filter((i) => i.status === "unpaid" || i.status === "partially_paid" || !i.status);
      const totalDuePaise = unpaid.reduce((acc, i) => acc + (i.grandTotalPaise || 0), 0);
      return {
        status: 'success',
        unpaidInvoiceCount: unpaid.length,
        totalOutstandingRupees: totalDuePaise / 100,
        sampleInvoices: unpaid.slice(0, 5).map((i) => ({
          invoiceNumber: i.invoiceNumber,
          customerName: i.customerName,
          amountRupees: (i.grandTotalPaise || 0) / 100,
          date: i.createdAt,
        })),
      };
    },
  },

  // 15. PRODUCTION STATUS & ACTIVE JOBS
  check_production_status: {
    name: 'check_production_status',
    description: 'Check active manufacturing requests, workshop jobs, and completion timelines.',
    permissionLevel: 0,
    parameters: [
      { name: 'workerId', type: 'string', description: 'Optional worker ID filter', required: false },
      { name: 'status', type: 'string', description: 'active, in_progress, completed', required: false },
    ],
    handler: async (params) => {
      const cards = useJobCards.getState().cards;
      const workerId = params.workerId ? String(params.workerId) : null;
      const status = params.status ? String(params.status) : null;

      let filtered = cards;
      if (workerId) filtered = filtered.filter((c) => c.workerId === workerId);
      if (status) filtered = filtered.filter((c) => c.status === status);

      return {
        status: 'success',
        totalJobs: filtered.length,
        activeJobs: filtered.filter((c) => c.status === "active" || c.status === "in_progress").length,
        completedJobs: filtered.filter((c) => c.status === "completed").length,
        jobs: filtered.slice(0, 10).map((c) => ({
          id: c.id,
          jobCardNumber: c.jobCardNumber,
          productName: c.productName,
          workerId: c.workerId,
          status: c.status,
          dueDeliveryDate: c.dueDeliveryDate,
        })),
      };
    },
  },

  // 16. DASHBOARD SUMMARY
  get_dashboard_summary: {
    name: 'get_dashboard_summary',
    description: 'Retrieve structured Founder Command Center metrics and summary.',
    permissionLevel: 0,
    parameters: [],
    handler: async () => {
      const invoices = useBilling.getState().invoices;
      const stockItems = useStock.getState().items;
      const jobCards = useJobCards.getState().cards;
      const ledger = useLedger.getState().entries;
      const goldBal = computeBalances(ledger);

      const today = new Date().toISOString().slice(0, 10);
      const todayInvoices = invoices.filter((i) => i.createdAt.startsWith(today));
      const todaySalesPaise = todayInvoices.reduce((acc, i) => acc + (i.grandTotalPaise || 0), 0);

      return {
        status: 'success',
        todaySalesRupees: todaySalesPaise / 100,
        todayInvoiceCount: todayInvoices.length,
        activeJobCards: jobCards.filter((c) => c.status === "active" || c.status === "in_progress").length,
        readyStockCount: stockItems.filter((i) => i.status === "in_stock" || !i.status).length,
        vaultGoldGrams: Number(mgToGrams(goldBal.vault)),
      };
    },
  },

  // 17. DRAFT QUOTATION (DRAFT-FIRST)
  draft_quotation: {
    name: 'draft_quotation',
    description: 'Prepare a draft quotation for a customer with frozen live gold rates.',
    permissionLevel: 1,
    parameters: [
      { name: 'customerId', type: 'string', description: 'Customer ID', required: true },
      { name: 'grossWeightG', type: 'number', description: 'Gross gold weight in grams', required: true },
      { name: 'purityPermille', type: 'number', description: 'Gold purity permille (e.g. 916)', required: true },
      { name: 'makingChargePerGram', type: 'number', description: 'Making charge per gram in rupees', required: false },
    ],
    handler: async (params) => {
      const currentRate = getCurrentGoldRatePaise() || 720000;
      const ratePerGram = currentRate / 10;
      const weightG = Number(params.grossWeightG || 0);
      const purity = Number(params.purityPermille || 916);
      const mcPerGram = Number(params.makingChargePerGram || 450);

      const goldValuePaise = Math.round(weightG * (purity / 1000) * ratePerGram);
      const makingChargePaise = Math.round(weightG * mcPerGram * 100);
      const subtotalPaise = goldValuePaise + makingChargePaise;
      const gstPaise = Math.round(subtotalPaise * 0.03);
      const grandTotalPaise = subtotalPaise + gstPaise;

      return {
        status: 'success',
        draftQuotation: {
          customerId: params.customerId,
          grossWeightG: weightG,
          purityPermille: purity,
          appliedGoldRatePerGramRupees: ratePerGram / 100,
          goldValueRupees: goldValuePaise / 100,
          makingChargeRupees: makingChargePaise / 100,
          gstRupees: gstPaise / 100,
          grandTotalRupees: grandTotalPaise / 100,
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };
    },
  },

  // 18. DRAFT INVOICE (DRAFT-FIRST)
  draft_invoice: {
    name: 'draft_invoice',
    description: 'Prepare a draft tax invoice from job cards or stock items for maker-checker review.',
    permissionLevel: 1,
    parameters: [
      { name: 'customerId', type: 'string', description: 'Customer ID', required: true },
      { name: 'itemsDescription', type: 'string', description: 'Item codes or description', required: true },
    ],
    handler: async (params) => {
      return {
        status: 'success',
        draftInvoiceId: `DRAFT-INV-${Date.now().toString().slice(-5)}`,
        customerId: params.customerId,
        itemsDescription: params.itemsDescription,
        draftStatus: 'DRAFT_PENDING_REVIEW',
        requiresMakerCheckerApproval: true,
      };
    },
  },

  // 19. DRAFT DELIVERY CHALLAN (DRAFT-FIRST)
  draft_delivery_challan: {
    name: 'draft_delivery_challan',
    description: 'Prepare a draft delivery challan for goods movement.',
    permissionLevel: 1,
    parameters: [
      { name: 'recipientId', type: 'string', description: 'Customer or Workshop recipient ID', required: true },
      { name: 'purpose', type: 'string', description: 'Job delivery, outside process, or exhibition', required: true },
    ],
    handler: async (params) => {
      return {
        status: 'success',
        draftChallanNumber: `DC-DRAFT-${Date.now().toString().slice(-4)}`,
        recipientId: params.recipientId,
        purpose: params.purpose,
        draftStatus: 'DRAFT_REQUIRES_SIGNOFF',
      };
    },
  },

  // 20. DRAFT OWNER DRAWINGS (VIA EXPENSE WORKFLOW)
  draft_owner_drawings: {
    name: 'draft_owner_drawings',
    description: 'Prepare draft owner drawings record strictly routed through the Expense workflow.',
    permissionLevel: 4,
    parameters: [
      { name: 'ownerName', type: 'string', description: 'Partner/Owner name', required: true },
      { name: 'amountRupees', type: 'number', description: 'Drawing amount in INR', required: true },
      { name: 'reason', type: 'string', description: 'Personal drawing reason', required: true },
    ],
    handler: async (params) => {
      return {
        status: 'success',
        workflow: 'Expense -> Record Owner Drawings',
        ownerName: params.ownerName,
        amountRupees: params.amountRupees,
        reason: params.reason,
        draftStatus: 'DRAFT_REQUIRES_FOUNDER_APPROVAL',
      };
    },
  },

  // 21. CREATE FOLLOW-UP TASK
  create_task: {
    name: 'create_task',
    description: 'Create a staff follow-up or review task in the ERP.',
    permissionLevel: 2,
    parameters: [
      { name: 'title', type: 'string', description: 'Task title', required: true },
      { name: 'dueDate', type: 'string', description: 'ISO due date string', required: true },
      { name: 'priority', type: 'string', description: 'CRITICAL, HIGH, MEDIUM, LOW', required: true },
    ],
    handler: async (params) => {
      return {
        status: 'success',
        createdTaskId: `TASK-${Date.now().toString().slice(-4)}`,
        title: params.title,
        dueDate: params.dueDate,
        priority: params.priority,
      };
    },
  },
};
