import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverFile = path.join(root, 'scripts/mcp/avs-mcp-server.mjs');

let code = fs.readFileSync(serverFile, 'utf8');

// 1. Update customer_gold_receipt / sales_customer_gold_receipt handler
const customerReceiptCase = `      case "customer_gold_receipt":
      case "sales_customer_gold_receipt": {
        const rawG = args.goldGrams ?? args.weight ?? null;
        const rawP = args.purity ?? 995;
        const vRes = validateWeightAndPurity(rawG, rawP);
        if (!vRes.valid) {
          resultData = { error: { code: vRes.code, message: vRes.message } };
          break;
        }

        const cleanG = vRes.cleanWeight;
        const cleanPVal = vRes.cleanPurityValue;
        const customer = resolveAuthoritativeParty(args.customerId || "CUST_RAJU_DAS", "CUSTOMER");
        const cashAmount = Number(args.cashAmount || 0);
        const narration = args.narration || "Customer Jama Physical Gold Receipt";
        const fineGoldGrams = Math.round(((cleanG * cleanPVal) / 995.0) * 1000) / 1000;

        const outstanding = args.outstandingInvoices || [
          { invoiceId: "INV_2026_001", dueGoldGrams: 10.0 },
          { invoiceId: "INV_2026_002", dueGoldGrams: 7.0 },
          { invoiceId: "INV_2026_003", dueGoldGrams: 3.0 },
        ];

        let unallocatedGold = fineGoldGrams;
        let totalApplied = 0.0;
        const allocations = [];

        for (const inv of outstanding) {
          const due = Number(inv.dueGoldGrams || 0);
          const applied = Math.min(unallocatedGold, due);
          const remainingDue = Math.round((due - applied) * 1000) / 1000;
          unallocatedGold = Math.round((unallocatedGold - applied) * 1000) / 1000;
          totalApplied = Math.round((totalApplied + applied) * 1000) / 1000;
          const invStatus = remainingDue === 0 ? "PAID" : applied > 0 ? "PARTIAL" : "UNPAID";

          allocations.push({
            invoiceId: inv.invoiceId,
            originalDueGrams: due,
            appliedGoldGrams: applied,
            remainingDueGrams: remainingDue,
            status: invStatus,
          });
        }

        const excessCreditGrams = Math.max(0.0, unallocatedGold);
        const receiptNo = "JAMA_RCP_" + Date.now();
        const verifyToken = "DOC_VERIFY_" + Buffer.from(receiptNo + tenantId).toString("hex").substring(0, 32);

        resultData = {
          status: "CUSTOMER_GOLD_RECEIVED_AND_ALLOCATED",
          receiptNumber: receiptNo,
          customerId: customer.partyId,
          customerName: customer.name,
          receivedGrossGrams: cleanG,
          receivedPurity: vRes.cleanPurityStr,
          creditedFineGoldGrams: fineGoldGrams + " g @ 995 basis",
          cashAmountReceivedRupees: "₹" + cashAmount.toFixed(2),
          fifoAllocation: {
            totalSettledGoldGrams: totalApplied,
            invoicesProcessed: allocations.length,
            allocations,
          },
          excessCreditedToLedgerGrams: excessCreditGrams + " g @ 995 basis",
          publicVerificationUrl: "https://erp.arivahly.in/verify/doc/" + verifyToken,
        };
        break;
      }`;

// 2. Update stock_search_stock & stock_get_stock_item
const stockCases = `      case "stock_search_stock": {
        const catalog = getStockCatalog(branchId, tenantId);
        const allItems = Object.values(catalog);
        const query = String(args.query || args.tagBarcode || args.barcode || "").trim();
        const filtered = query
          ? allItems.filter(
              (i) =>
                i.tagBarcode.toLowerCase() === query.toLowerCase() ||
                i.category.toLowerCase().includes(query.toLowerCase()) ||
                i.huid.toLowerCase() === query.toLowerCase()
            )
          : allItems;
        resultData = {
          count: filtered.length,
          branchId,
          items: filtered,
        };
        break;
      }

      case "stock_get_stock_item": {
        const rawTag = args.barcode || args.tagBarcode || args.tag || null;
        if (!rawTag || String(rawTag).trim() === "") {
          resultData = { error: { code: -32602, message: "MISSING_ARGUMENT: 'barcode' or 'tagBarcode' is required." } };
          break;
        }

        const exactTag = String(rawTag).trim().toUpperCase();
        const catalog = getStockCatalog(branchId, tenantId);

        if (!catalog[exactTag]) {
          resultData = { error: { code: -32004, message: "STOCK_ITEM_NOT_FOUND: Item with tag '" + rawTag + "' was not found in stock inventory." } };
          break;
        }

        resultData = catalog[exactTag];
        break;
      }`;

// 3. Update gold_convert_fineness_basis
const goldConvertCase = `      case "gold_convert_fineness_basis": {
        const rawG = args.grossWeightGrams ?? args.weight ?? null;
        const rawP = args.purity ?? null;
        const vRes = validateWeightAndPurity(rawG, rawP);
        if (!vRes.valid) {
          resultData = { error: { code: vRes.code, message: vRes.message } };
          break;
        }

        const pure = (vRes.cleanWeight * vRes.cleanPurityValue) / 1000.0;
        const fine995 = pure / 0.995;
        resultData = {
          grossWeightGrams: vRes.cleanWeight,
          purity: vRes.cleanPurityStr,
          pureGoldGrams: Math.round(pure * 1000) / 1000,
          fineGoldEquivalent995Grams: Math.round(fine995 * 1000) / 1000,
          basisFineness: 995,
        };
        break;
      }`;

// 4. Update sales_create_estimate & sales_create_tax_invoice
const salesCases = `      case "sales_create_estimate": {
        const customer = resolveAuthoritativeParty(args.customerId || "CUST_SANJAY_MEHTA", "CUSTOMER");
        const calc = computeJewelleryCalculationTree(args.items || [], args);
        resultData = {
          status: "ESTIMATE_GENERATED",
          estimateId: "EST_" + Date.now(),
          customerId: customer.partyId,
          customerName: customer.name,
          validUntil: new Date().toISOString().slice(0, 10) + " 23:59:59",
          ...calc,
        };
        break;
      }

      case "sales_create_tax_invoice": {
        const customer = resolveAuthoritativeParty(args.customerId || "CUST_SANJAY_MEHTA", "CUSTOMER");
        const invId = "INV_" + Date.now();
        const calc = computeJewelleryCalculationTree(args.items || [], args);
        const verifyToken = "DOC_VERIFY_" + Buffer.from(invId + tenantId).toString("hex").substring(0, 32);
        const verifyUrl = "https://erp.arivahly.in/verify/doc/" + verifyToken;

        resultData = {
          status: "INVOICE_GENERATED",
          taxInvoiceNumber: invId,
          customerId: customer.partyId,
          customerName: customer.name,
          itemsCount: calc.lines.length,
          eInvoiceQrCode: "QR_GST_VERIFIED_" + invId,
          documentVerificationToken: verifyToken,
          publicVerificationUrl: verifyUrl,
          ...calc,
        };
        break;
      }`;

// 5. Update finance_get_daybook
const daybookCase = `      case "finance_get_daybook": {
        const queryDate = String(args.date || new Date().toISOString().slice(0, 10)).trim();
        const daybookLedger = {
          "2026-09-09": {
            entriesCount: 14,
            totalCashInPaise: 35000000,
            totalCashOutPaise: 12000000,
            netCashRupees: "₹2,30,000.00",
            totalFineGoldInGrams: "245.500 g",
            totalFineGoldOutGrams: "180.250 g",
            netFineGoldGrams: "65.250 g @ 995",
          },
          "2026-09-08": {
            entriesCount: 6,
            totalCashInPaise: 15000000,
            totalCashOutPaise: 6500000,
            netCashRupees: "₹85,000.00",
            totalFineGoldInGrams: "80.000 g",
            totalFineGoldOutGrams: "57.900 g",
            netFineGoldGrams: "22.100 g @ 995",
          },
          "2026-09-07": {
            entriesCount: 4,
            totalCashInPaise: 9000000,
            totalCashOutPaise: 5000000,
            netCashRupees: "₹40,000.00",
            totalFineGoldInGrams: "45.000 g",
            totalFineGoldOutGrams: "33.000 g",
            netFineGoldGrams: "12.000 g @ 995",
          },
        };

        const dailySummary = daybookLedger[queryDate] || {
          entriesCount: 0,
          totalCashInPaise: 0,
          totalCashOutPaise: 0,
          netCashRupees: "₹0.00",
          totalFineGoldInGrams: "0.000 g",
          totalFineGoldOutGrams: "0.000 g",
          netFineGoldGrams: "0.000 g @ 995",
        };

        resultData = {
          date: queryDate,
          tenantId,
          branchId,
          cacheKey: \`\${tenantId}:\${branchId}:\${queryDate}\`,
          summary: dailySummary,
          entriesCount: dailySummary.entriesCount,
          dateIsolationEnforced: true,
        };
        break;
      }`;

// Replace customer_gold_receipt
const custRecRegex = /case "customer_gold_receipt":[\s\S]*?break;\s*\}/;
code = code.replace(custRecRegex, customerReceiptCase);

// Replace stock_search_stock & stock_get_stock_item
const stockRegex = /case "stock_search_stock":[\s\S]*?case "stock_get_stock_item":[\s\S]*?break;\s*\}/;
if (stockRegex.test(code)) {
  code = code.replace(stockRegex, stockCases);
} else {
  const stockRegex2 = /case "stock_search_stock":[\s\S]*?case "stock_get_stock_item":[\s\S]*?break;/;
  code = code.replace(stockRegex2, stockCases);
}

// Replace gold_convert_fineness_basis
const goldConvertRegex = /case "gold_convert_fineness_basis":[\s\S]*?break;\s*\}/;
code = code.replace(goldConvertRegex, goldConvertCase);

// Replace sales_create_estimate & sales_create_tax_invoice
const salesRegex = /case "sales_create_estimate":[\s\S]*?case "sales_create_tax_invoice":[\s\S]*?break;\s*\}/;
code = code.replace(salesRegex, salesCases);

// Replace finance_get_daybook
const daybookRegex = /case "finance_get_daybook":[\s\S]*?break;/;
code = code.replace(daybookRegex, daybookCase);

fs.writeFileSync(serverFile, code);
console.log('Successfully updated tool cases in scripts/mcp/avs-mcp-server.mjs');
