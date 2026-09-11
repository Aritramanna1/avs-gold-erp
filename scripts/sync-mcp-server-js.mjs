import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverFile = path.join(root, 'scripts/mcp/avs-mcp-server.mjs');

let code = fs.readFileSync(serverFile, 'utf8');

// Insert helpers before REGISTERED_TOOLS
const helperCode = `
// ── Strict Weight & Fineness Pre-Flight Validator (P0-4) ──
export function validateWeightAndPurity(rawWeight, rawPurity) {
  if (rawWeight === null || rawWeight === undefined || rawWeight === "" || isNaN(Number(rawWeight))) {
    return { valid: false, code: -32010, message: "INVALID_WEIGHT: Gross weight must be a valid positive number. Received: " + JSON.stringify(rawWeight) };
  }
  const cleanWeight = Number(rawWeight);
  if (cleanWeight <= 0) {
    return { valid: false, code: -32010, message: "INVALID_WEIGHT: Gross weight must be strictly greater than 0. Received: " + cleanWeight + " g" };
  }

  if (rawPurity === null || rawPurity === undefined || rawPurity === "") {
    return { valid: false, code: -32011, message: "INVALID_PURITY: Purity / Touch is required and cannot be empty." };
  }

  const rawStr = String(rawPurity).trim().toUpperCase();
  const karatMap = {
    "24K": 999, "24KT": 999, "999": 999, "999.0": 999, "99.9": 999,
    "995": 995, "995.0": 995, "99.5": 995,
    "22K": 916, "22KT": 916, "916": 916, "916.0": 916, "91.6": 916,
    "18K": 750, "18KT": 750, "750": 750, "750.0": 750, "75.0": 750, "75": 750,
    "14K": 585, "14KT": 585, "585": 585, "585.0": 585, "58.5": 585,
    "9K": 375, "9KT": 375, "375": 375, "375.0": 375, "37.5": 375
  };

  if (karatMap[rawStr] !== undefined) {
    return { valid: true, cleanWeight, cleanPurityValue: karatMap[rawStr], cleanPurityStr: rawStr };
  }

  if (!isNaN(Number(rawStr))) {
    const num = Number(rawStr);
    if (num <= 1) {
      return { valid: false, code: -32011, message: "INVALID_PURITY: Purity cannot be <= 1 (Touch must be standard parts per thousand e.g. 995, 916, 750 or Karats). Received: " + rawStr };
    }
    if (num > 1000) {
      return { valid: false, code: -32011, message: "INVALID_PURITY: Purity cannot exceed 1000 ppt. Received: " + rawStr };
    }
    if (num >= 10 && num <= 100) {
      return { valid: true, cleanWeight, cleanPurityValue: Math.round(num * 10 * 10) / 10, cleanPurityStr: num + "%" };
    }
    if (num > 100 && num <= 999.9) {
      return { valid: true, cleanWeight, cleanPurityValue: num, cleanPurityStr: String(num) };
    }
  }

  return { valid: false, code: -32011, message: "INVALID_PURITY: Unknown or malformed purity '" + rawPurity + "'. Supported values: 24K (999), 22K (916), 18K (750), 14K (585), 9K (375), 995 Bullion." };
}

// ── Canonical Stock Catalog (P0-2) ──
export function getStockCatalog(branchId = "MAIN", tenantId = "MTJ_FIRM") {
  const items = {
    "TAG-99281": {
      itemId: "ITM_99281",
      tag: "TAG-99281",
      tagBarcode: "TAG-99281",
      barcode: "TAG-99281",
      category: "Necklace 22K",
      description: "Bridal Floral Filigree Necklace 22K",
      hsnCode: "7113",
      grossWeightGrams: 24.500,
      lessWeightGrams: 0.400,
      addWeightGrams: 0.000,
      netWeightGrams: 24.100,
      purity: "22K (916)",
      fineGoldGrams: 22.075,
      huid: "HUID99281X",
      hallmarkUId: "HUID99281X",
      status: "IN_STOCK",
      branchId,
      tenantId
    },
    "TAG-99282": {
      itemId: "ITM_99282",
      tag: "TAG-99282",
      tagBarcode: "TAG-99282",
      barcode: "TAG-99282",
      category: "Bangles 22K",
      description: "Kada Pair Handcrafted 22K",
      hsnCode: "7113",
      grossWeightGrams: 32.100,
      lessWeightGrams: 0.200,
      addWeightGrams: 0.000,
      netWeightGrams: 31.900,
      purity: "22K (916)",
      fineGoldGrams: 29.220,
      huid: "HUID99282Y",
      hallmarkUId: "HUID99282Y",
      status: "IN_STOCK",
      branchId,
      tenantId
    },
    "TAG-99283": {
      itemId: "ITM_99283",
      tag: "TAG-99283",
      tagBarcode: "TAG-99283",
      barcode: "TAG-99283",
      category: "Chains 22K",
      description: "Rope Design Machine Chain 22K",
      hsnCode: "7113",
      grossWeightGrams: 18.500,
      lessWeightGrams: 0.000,
      addWeightGrams: 0.000,
      netWeightGrams: 18.500,
      purity: "22K (916)",
      fineGoldGrams: 16.945,
      huid: "HUID99283Z",
      hallmarkUId: "HUID99283Z",
      status: "IN_STOCK",
      branchId,
      tenantId
    },
    "TAG-99284": {
      itemId: "ITM_99284",
      tag: "TAG-99284",
      tagBarcode: "TAG-99284",
      barcode: "TAG-99284",
      category: "Rings 18K",
      description: "Solitaire Diamond Mount Ring 18K",
      hsnCode: "7113",
      grossWeightGrams: 4.250,
      lessWeightGrams: 0.150,
      addWeightGrams: 0.000,
      netWeightGrams: 4.100,
      purity: "18K (750)",
      fineGoldGrams: 3.090,
      huid: "HUID99284A",
      hallmarkUId: "HUID99284A",
      status: "IN_STOCK",
      branchId,
      tenantId
    },
    "TAG-99285": {
      itemId: "ITM_99285",
      tag: "TAG-99285",
      tagBarcode: "TAG-99285",
      barcode: "TAG-99285",
      category: "Earrings 22K",
      description: "Jhumka Traditional Bengali 22K",
      hsnCode: "7113",
      grossWeightGrams: 12.800,
      lessWeightGrams: 0.300,
      addWeightGrams: 0.000,
      netWeightGrams: 12.500,
      purity: "22K (916)",
      fineGoldGrams: 11.450,
      huid: "HUID99285B",
      hallmarkUId: "HUID99285B",
      status: "IN_STOCK",
      branchId,
      tenantId
    }
  };

  for (let i = 6; i <= 20; i++) {
    const tagNo = "TAG-992" + String(i + 80).padStart(2, "0");
    const gross = Math.round((5.0 + i * 1.35) * 1000) / 1000;
    const less = Math.round((0.10 + i * 0.02) * 1000) / 1000;
    const net = Math.round((4.90 + i * 1.33) * 1000) / 1000;
    items[tagNo] = {
      itemId: "ITM_992" + String(i + 80).padStart(2, "0"),
      tag: tagNo,
      tagBarcode: tagNo,
      barcode: tagNo,
      category: i % 2 === 0 ? "Pendant 22K" : "Mangalsutra 22K",
      description: "Fine Jewellery Ornament " + tagNo,
      hsnCode: "7113",
      grossWeightGrams: gross,
      lessWeightGrams: less,
      addWeightGrams: 0.000,
      netWeightGrams: net,
      purity: "22K (916)",
      fineGoldGrams: Math.round(((net * 916) / 995.0) * 1000) / 1000,
      huid: "HUID" + (9000 + i) + "X",
      hallmarkUId: "HUID" + (9000 + i) + "X",
      status: "IN_STOCK",
      branchId,
      tenantId
    };
  }

  return items;
}

// ── Dynamic 24-Field Calculation Engine (P0-1) ──
export function computeJewelleryCalculationTree(rawItems = [], topLevelArgs = {}) {
  let items = rawItems;
  if (!items || !items.length) {
    items = [{
      grossWeightGrams: topLevelArgs.grossWeightGrams ?? topLevelArgs.weight ?? 1.25,
      lessWeightGrams: topLevelArgs.lessWeightGrams ?? topLevelArgs.less ?? 0,
      addWeightGrams: topLevelArgs.addWeightGrams ?? topLevelArgs.add ?? 0,
      purity: topLevelArgs.purity ?? 916,
      wastagePercent: topLevelArgs.wastagePercent ?? topLevelArgs.wastage ?? 0,
      ratePerGramRupees: topLevelArgs.goldRatePerGramRupees ?? topLevelArgs.rate ?? null,
      makingChargesRupees: topLevelArgs.makingChargesRupees ?? topLevelArgs.making ?? null,
      makingChargesPerGramRupees: topLevelArgs.makingChargesPerGramRupees ?? topLevelArgs.makingPerGram ?? null,
      stoneChargesRupees: topLevelArgs.stoneChargesRupees ?? topLevelArgs.stone ?? 0,
      diamondChargesRupees: topLevelArgs.diamondChargesRupees ?? topLevelArgs.diamond ?? 0,
      hallmarkChargesRupees: topLevelArgs.hallmarkChargesRupees ?? topLevelArgs.hallmark ?? 0,
      otherChargesRupees: topLevelArgs.otherChargesRupees ?? topLevelArgs.other ?? 0,
      discountRupees: topLevelArgs.discountRupees ?? topLevelArgs.discount ?? 0
    }];
  }

  let totalGross = 0.0;
  let totalLess = 0.0;
  let totalAdd = 0.0;
  let totalNet = 0.0;
  let totalFine = 0.0;
  let totalWastageWeight = 0.0;
  let totalHisabWeight = 0.0;
  let totalGoldValue = 0.0;
  let totalMaking = 0.0;
  let totalStone = 0.0;
  let totalDiamond = 0.0;
  let totalHallmark = 0.0;
  let totalOther = 0.0;
  let totalDiscount = 0.0;
  const calculatedLines = [];

  let primaryPurity = 916;
  let primaryRate = 6824.20;

  for (let idx = 0; idx < items.length; idx++) {
    const line = items[idx];
    const gross = Number(line.grossWeightGrams ?? line.gross ?? line.weight ?? 0);
    const less = Number(line.lessWeightGrams ?? line.less ?? 0);
    const add = Number(line.addWeightGrams ?? line.add ?? 0);
    const net = Math.round(Math.max(0, gross - less + add) * 1000) / 1000;

    const rawP = line.purity ?? line.tanch ?? 916;
    const vRes = validateWeightAndPurity(gross > 0 ? gross : 1, rawP);
    const purity = vRes.valid ? vRes.cleanPurityValue : 916;
    primaryPurity = purity;

    const fine = Math.round(((net * purity) / 995.0) * 1000) / 1000;
    const wastagePct = Number(line.wastagePercent ?? line.wastage ?? 0);
    const wastageW = Math.round(net * (wastagePct / 100.0) * 1000) / 1000;
    const hisabW = Math.round((net + wastageW) * 1000) / 1000;

    const defaultRate = purity >= 995 ? 7450.00 : (purity >= 916 ? 6824.20 : (purity >= 750 ? 5587.50 : 4000.00));
    const rate = Number(line.ratePerGramRupees ?? line.rate ?? line.goldRatePerGramRupees ?? topLevelArgs.goldRatePerGramRupees ?? topLevelArgs.rate ?? defaultRate);
    primaryRate = rate;
    const goldVal = Math.round(net * rate * 100) / 100;

    let making = 0;
    if (line.makingChargesPerGramRupees !== undefined && line.makingChargesPerGramRupees !== null) {
      making = Math.round(net * Number(line.makingChargesPerGramRupees) * 100) / 100;
    } else if (topLevelArgs.makingChargesPerGramRupees !== undefined || (topLevelArgs.making !== undefined && !isNaN(Number(topLevelArgs.making)) && Number(topLevelArgs.making) <= 500 && line.makingChargesRupees === undefined)) {
      const rateMaking = Number(topLevelArgs.makingChargesPerGramRupees ?? topLevelArgs.making);
      making = Math.round(net * rateMaking * 100) / 100;
    } else {
      making = Number(line.makingChargesRupees ?? line.making ?? topLevelArgs.makingChargesRupees ?? topLevelArgs.making ?? 0);
    }

    const stone = Number(line.stoneChargesRupees ?? line.stone ?? 0);
    const diamond = Number(line.diamondChargesRupees ?? line.diamond ?? 0);
    const hallmark = Number(line.hallmarkChargesRupees ?? line.hallmark ?? 0);
    const other = Number(line.otherChargesRupees ?? line.other ?? 0);
    const discount = Number(line.discountRupees ?? line.discount ?? topLevelArgs.discountRupees ?? 0);
    const lineTaxable = Math.round((goldVal + making + stone + diamond + hallmark + other - discount) * 100) / 100;

    totalGross += gross;
    totalLess += less;
    totalAdd += add;
    totalNet += net;
    totalFine += fine;
    totalWastageWeight += wastageW;
    totalHisabWeight += hisabW;
    totalGoldValue += goldVal;
    totalMaking += making;
    totalStone += stone;
    totalDiamond += diamond;
    totalHallmark += hallmark;
    totalOther += other;
    totalDiscount += discount;

    calculatedLines.push({
      lineIndex: idx + 1,
      grossWeightGrams: gross,
      lessWeightGrams: less,
      addWeightGrams: add,
      netWeightGrams: net,
      purity,
      tanch: purity,
      fineWeightGrams: fine,
      wastagePercent: wastagePct,
      wastageWeightGrams: wastageW,
      hisabWeightGrams: hisabW,
      ratePerGramRupees: rate,
      goldValueRupees: goldVal,
      makingChargesRupees: making,
      stoneChargesRupees: stone,
      diamondChargesRupees: diamond,
      hallmarkChargesRupees: hallmark,
      otherChargesRupees: other,
      discountRupees: discount,
      taxableAmountRupees: lineTaxable
    });
  }

  const taxableTotal = Math.round((totalGoldValue + totalMaking + totalStone + totalDiamond + totalHallmark + totalOther - totalDiscount) * 100) / 100;
  const isInterstate = Boolean(topLevelArgs.isInterstate);
  const cgst = isInterstate ? 0.0 : Math.round(taxableTotal * 0.015 * 100) / 100;
  const sgst = isInterstate ? 0.0 : Math.round(taxableTotal * 0.015 * 100) / 100;
  const igst = isInterstate ? Math.round(taxableTotal * 0.03 * 100) / 100 : 0.0;
  const grandTotal = Math.round((taxableTotal + cgst + sgst + igst) * 100) / 100;

  const amountPaid = Number(topLevelArgs.amountPaidRupees ?? topLevelArgs.payment ?? topLevelArgs.advanceCashRupees ?? 0);
  const remaining = Math.max(0.0, Math.round((grandTotal - amountPaid) * 100) / 100);
  const excessLedgerCredit = Math.max(0.0, Math.round((amountPaid - grandTotal) * 100) / 100);

  return {
    calculationTree: {
      gross: totalGross,
      less: totalLess,
      add: totalAdd,
      net: totalNet,
      purity: primaryPurity,
      tanch: primaryPurity,
      wastage: totalWastageWeight,
      hisab: totalHisabWeight,
      fine: totalFine,
      rate: primaryRate,
      goldValue: totalGoldValue,
      making: totalMaking,
      stoneCharges: totalStone,
      diamond: totalDiamond,
      hallmark: totalHallmark,
      otherCharges: totalOther,
      discount: totalDiscount,
      taxableAmount: taxableTotal,
      cgst,
      sgst,
      igst,
      grandTotal,
      amountPaid,
      remaining,
      excessLedgerCredit
    },
    lines: calculatedLines,
    subtotalGoldRupees: "₹" + totalGoldValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    makingChargesRupees: "₹" + totalMaking.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    taxableAmountRupees: "₹" + taxableTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    cgst1_5PercentRupees: "₹" + cgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    sgst1_5PercentRupees: "₹" + sgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    igst3PercentRupees: "₹" + igst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    gst3PercentRupees: "₹" + (cgst + sgst + igst).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    grandTotalRupees: "₹" + grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    amountPaidRupees: "₹" + amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    remainingBalanceRupees: "₹" + remaining.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    excessLedgerCreditRupees: "₹" + excessLedgerCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    goldRateApplied22K: "₹" + primaryRate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " / g"
  };
}
`;

if (!code.includes('computeJewelleryCalculationTree')) {
  code = code.replace('export const REGISTERED_TOOLS = [', helperCode + '\nexport const REGISTERED_TOOLS = [');
}

fs.writeFileSync(serverFile, code);
console.log('Successfully updated helpers in scripts/mcp/avs-mcp-server.mjs');
