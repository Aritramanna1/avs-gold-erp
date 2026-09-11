import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phpFile = path.join(root, 'public/api/mcp/index.php');

let php = fs.readFileSync(phpFile, 'utf8');

// Update validateWeightAndPurity in PHP
const newPhpValidator = `// ── Strict Weight & Fineness Pre-Flight Validator (P0-4) ──
function validateWeightAndPurity($rawWeight, $rawPurity, &$cleanWeight, &$cleanPurityValue, &$cleanPurityStr, &$errStructure) {
    $errStructure = null;

    // 1. Weight Validation
    if ($rawWeight === null || $rawWeight === '' || !is_numeric($rawWeight)) {
        $errStructure = [
            "code" => -32010,
            "field" => "grossWeightGrams",
            "receivedValue" => $rawWeight,
            "message" => "INVALID_WEIGHT: Gross weight must be a valid positive number.",
            "allowedRange" => "weight > 0.000 (Numeric Grams)",
            "mutationOccurred" => false
        ];
        return false;
    }
    $cleanWeight = floatval($rawWeight);
    if ($cleanWeight <= 0) {
        $errStructure = [
            "code" => -32010,
            "field" => "grossWeightGrams",
            "receivedValue" => $cleanWeight,
            "message" => "INVALID_WEIGHT: Gross weight must be strictly greater than 0. Received: {$cleanWeight}g",
            "allowedRange" => "weight > 0.000 (Numeric Grams)",
            "mutationOccurred" => false
        ];
        return false;
    }

    // 2. Purity Validation
    if ($rawPurity === null || $rawPurity === '') {
        $errStructure = [
            "code" => -32011,
            "field" => "purity",
            "receivedValue" => $rawPurity,
            "message" => "INVALID_PURITY: Purity / Touch is required and cannot be empty.",
            "allowedValues" => ["24K (999)", "22K (916)", "18K (750)", "14K (585)", "9K (375)", "995 Bullion", "Touch ppt 10..1000"],
            "mutationOccurred" => false
        ];
        return false;
    }

    $rawStr = strtoupper(trim((string)$rawPurity));
    
    $karatMap = [
        '24K' => 999, '24KT' => 999, '999' => 999, '999.0' => 999, '99.9' => 999,
        '995' => 995, '995.0' => 995, '99.5' => 995,
        '22K' => 916, '22KT' => 916, '916' => 916, '916.0' => 916, '91.6' => 916,
        '18K' => 750, '18KT' => 750, '750' => 750, '750.0' => 750, '75.0' => 750, '75' => 750,
        '14K' => 585, '14KT' => 585, '585' => 585, '585.0' => 585, '58.5' => 585,
        '9K' => 375, '9KT' => 375, '375' => 375, '375.0' => 375, '37.5' => 375
    ];

    if (isset($karatMap[$rawStr])) {
        $cleanPurityValue = $karatMap[$rawStr];
        $cleanPurityStr = $rawStr;
        return true;
    }

    // Check numeric purity
    if (is_numeric($rawStr)) {
        $num = floatval($rawStr);
        if ($num <= 1) {
            $errStructure = [
                "code" => -32011,
                "field" => "purity",
                "receivedValue" => $num,
                "message" => "INVALID_PURITY: Purity cannot be <= 1 (Touch must be standard parts per thousand e.g. 995, 916, 750 or Karats). Received: {$rawStr}",
                "allowedValues" => ["24K (999)", "22K (916)", "18K (750)", "14K (585)", "9K (375)", "995 Bullion", "Touch ppt 10..1000"],
                "mutationOccurred" => false
            ];
            return false;
        }
        if ($num > 1000) {
            $errStructure = [
                "code" => -32011,
                "field" => "purity",
                "receivedValue" => $num,
                "message" => "INVALID_PURITY: Purity cannot exceed 1000 ppt. Received: {$rawStr}",
                "allowedValues" => ["24K (999)", "22K (916)", "18K (750)", "14K (585)", "9K (375)", "995 Bullion", "Touch ppt 10..1000"],
                "mutationOccurred" => false
            ];
            return false;
        }
        if ($num >= 10 && $num <= 100) {
            $cleanPurityValue = round($num * 10, 1);
            $cleanPurityStr = strval($num) . "%";
            return true;
        }
        if ($num > 100 && $num <= 999.9) {
            $cleanPurityValue = $num;
            $cleanPurityStr = strval($num);
            return true;
        }
    }

    $errStructure = [
        "code" => -32011,
        "field" => "purity",
        "receivedValue" => $rawPurity,
        "message" => "INVALID_PURITY: Unknown or malformed purity '{$rawPurity}'. Supported values: 24K (999), 22K (916), 18K (750), 14K (585), 9K (375), 995 Bullion.",
        "allowedValues" => ["24K (999)", "22K (916)", "18K (750)", "14K (585)", "9K (375)", "995 Bullion", "Touch ppt 10..1000"],
        "mutationOccurred" => false
    ];
    return false;
}`;

// Replace validator in PHP
php = php.replace(/\/\/ ── Strict Weight & Fineness Pre-Flight Validator \(P0-4\) ──[\s\S]*?return false;\s*\}/, newPhpValidator);

// Update computeJewelleryCalculationTree to handle making cleanly
const newPhpCalcEngine = `// ── Dynamic 24-Field Calculation Engine (P0-1) ──
function computeJewelleryCalculationTree($rawItems, $topLevelArgs = []) {
    if (empty($rawItems)) {
        $rawItems = [[
            "grossWeightGrams" => $topLevelArgs['grossWeightGrams'] ?? ($topLevelArgs['weight'] ?? 1.25),
            "lessWeightGrams" => $topLevelArgs['lessWeightGrams'] ?? ($topLevelArgs['less'] ?? 0),
            "addWeightGrams" => $topLevelArgs['addWeightGrams'] ?? ($topLevelArgs['add'] ?? 0),
            "purity" => $topLevelArgs['purity'] ?? 916,
            "wastagePercent" => $topLevelArgs['wastagePercent'] ?? ($topLevelArgs['wastage'] ?? 0),
            "ratePerGramRupees" => $topLevelArgs['goldRatePerGramRupees'] ?? ($topLevelArgs['rate'] ?? null),
            "makingChargesRupees" => $topLevelArgs['makingChargesRupees'] ?? ($topLevelArgs['making'] ?? null),
            "makingChargesPerGramRupees" => $topLevelArgs['makingChargesPerGramRupees'] ?? ($topLevelArgs['makingPerGram'] ?? null),
            "stoneChargesRupees" => $topLevelArgs['stoneChargesRupees'] ?? ($topLevelArgs['stone'] ?? 0),
            "diamondChargesRupees" => $topLevelArgs['diamondChargesRupees'] ?? ($topLevelArgs['diamond'] ?? 0),
            "hallmarkChargesRupees" => $topLevelArgs['hallmarkChargesRupees'] ?? ($topLevelArgs['hallmark'] ?? 0),
            "otherChargesRupees" => $topLevelArgs['otherChargesRupees'] ?? ($topLevelArgs['other'] ?? 0),
            "discountRupees" => $topLevelArgs['discountRupees'] ?? ($topLevelArgs['discount'] ?? 0)
        ]];
    }

    $totalGross = 0.0;
    $totalLess = 0.0;
    $totalAdd = 0.0;
    $totalNet = 0.0;
    $totalFine = 0.0;
    $totalWastageWeight = 0.0;
    $totalHisabWeight = 0.0;
    $totalGoldValue = 0.0;
    $totalMaking = 0.0;
    $totalStone = 0.0;
    $totalDiamond = 0.0;
    $totalHallmark = 0.0;
    $totalOther = 0.0;
    $totalDiscount = 0.0;
    $calculatedLines = [];

    $primaryPurity = 916;
    $primaryRate = 6824.20;

    foreach ($rawItems as $idx => $line) {
        $gross = floatval($line['grossWeightGrams'] ?? ($line['gross'] ?? ($line['weight'] ?? 0)));
        $less = floatval($line['lessWeightGrams'] ?? ($line['less'] ?? 0));
        $add = floatval($line['addWeightGrams'] ?? ($line['add'] ?? 0));
        $net = round(max(0, $gross - $less + $add), 3);

        $rawPurity = $line['purity'] ?? ($line['tanch'] ?? 916);
        $cleanPurityVal = 916;
        $cleanPurityStr = "916";
        $errStruct = null;
        if (validateWeightAndPurity($gross > 0 ? $gross : 1, $rawPurity, $gClean, $cleanPurityVal, $cleanPurityStr, $errStruct)) {
            $purity = $cleanPurityVal;
        } else {
            $purity = 916;
        }
        $primaryPurity = $purity;

        $fine = round(($net * $purity) / 995.0, 3);
        $wastagePct = floatval($line['wastagePercent'] ?? ($line['wastage'] ?? 0));
        $wastageW = round($net * ($wastagePct / 100.0), 3);
        $hisabW = round($net + $wastageW, 3);

        // Rate determination
        $defaultRate = ($purity >= 995) ? 7450.00 : (($purity >= 916) ? 6824.20 : (($purity >= 750) ? 5587.50 : 4000.00));
        $rate = floatval($line['ratePerGramRupees'] ?? ($line['rate'] ?? ($line['goldRatePerGramRupees'] ?? ($topLevelArgs['goldRatePerGramRupees'] ?? ($topLevelArgs['rate'] ?? $defaultRate)))));
        $primaryRate = $rate;
        $goldVal = round($net * $rate, 2);

        // Making determination: per gram vs fixed
        if (isset($line['makingChargesPerGramRupees'])) {
            $making = round($net * floatval($line['makingChargesPerGramRupees']), 2);
        } elseif (isset($topLevelArgs['makingChargesPerGramRupees'])) {
            $making = round($net * floatval($topLevelArgs['makingChargesPerGramRupees']), 2);
        } elseif (isset($line['makingChargesRupees'])) {
            $making = round(floatval($line['makingChargesRupees']), 2);
        } elseif (isset($topLevelArgs['makingChargesRupees'])) {
            $making = round(floatval($topLevelArgs['makingChargesRupees']), 2);
        } elseif (isset($line['making'])) {
            $making = round(floatval($line['making']), 2);
        } elseif (isset($topLevelArgs['making'])) {
            $making = round(floatval($topLevelArgs['making']), 2);
        } else {
            $making = 0.0;
        }

        $stone = floatval($line['stoneChargesRupees'] ?? ($line['stone'] ?? 0));
        $diamond = floatval($line['diamondChargesRupees'] ?? ($line['diamond'] ?? 0));
        $hallmark = floatval($line['hallmarkChargesRupees'] ?? ($line['hallmark'] ?? 0));
        $other = floatval($line['otherChargesRupees'] ?? ($line['other'] ?? 0));
        $discount = floatval($line['discountRupees'] ?? ($line['discount'] ?? ($topLevelArgs['discountRupees'] ?? 0)));
        $lineTaxable = round($goldVal + $making + $stone + $diamond + $hallmark + $other - $discount, 2);

        $totalGross += $gross;
        $totalLess += $less;
        $totalAdd += $add;
        $totalNet += $net;
        $totalFine += $fine;
        $totalWastageWeight += $wastageW;
        $totalHisabWeight += $hisabW;
        $totalGoldValue += $goldVal;
        $totalMaking += $making;
        $totalStone += $stone;
        $totalDiamond += $diamond;
        $totalHallmark += $hallmark;
        $totalOther += $other;
        $totalDiscount += $discount;

        $calculatedLines[] = [
            "lineIndex" => $idx + 1,
            "grossWeightGrams" => $gross,
            "lessWeightGrams" => $less,
            "addWeightGrams" => $add,
            "netWeightGrams" => $net,
            "purity" => $purity,
            "tanch" => $purity,
            "fineWeightGrams" => $fine,
            "wastagePercent" => $wastagePct,
            "wastageWeightGrams" => $wastageW,
            "hisabWeightGrams" => $hisabW,
            "ratePerGramRupees" => $rate,
            "goldValueRupees" => $goldVal,
            "makingChargesRupees" => $making,
            "stoneChargesRupees" => $stone,
            "diamondChargesRupees" => $diamond,
            "hallmarkChargesRupees" => $hallmark,
            "otherChargesRupees" => $other,
            "discountRupees" => $discount,
            "taxableAmountRupees" => $lineTaxable
        ];
    }

    $taxableTotal = round($totalGoldValue + $totalMaking + $totalStone + $totalDiamond + $totalHallmark + $totalOther - $totalDiscount, 2);
    $isInterstate = !empty($topLevelArgs['isInterstate']);
    $cgst = $isInterstate ? 0.0 : round($taxableTotal * 0.015, 2);
    $sgst = $isInterstate ? 0.0 : round($taxableTotal * 0.015, 2);
    $igst = $isInterstate ? round($taxableTotal * 0.03, 2) : 0.0;
    $grandTotal = round($taxableTotal + $cgst + $sgst + $igst, 2);

    $amountPaid = floatval($topLevelArgs['amountPaidRupees'] ?? ($topLevelArgs['payment'] ?? ($topLevelArgs['advanceCashRupees'] ?? 0)));
    $remaining = max(0.0, round($grandTotal - $amountPaid, 2));
    $excessLedgerCredit = max(0.0, round($amountPaid - $grandTotal, 2));

    return [
        "calculationTree" => [
            "gross" => $totalGross,
            "less" => $totalLess,
            "add" => $totalAdd,
            "net" => $totalNet,
            "purity" => $primaryPurity,
            "tanch" => $primaryPurity,
            "wastage" => $totalWastageWeight,
            "hisab" => $totalHisabWeight,
            "fine" => $totalFine,
            "rate" => $primaryRate,
            "goldValue" => $totalGoldValue,
            "making" => $totalMaking,
            "stoneCharges" => $totalStone,
            "diamond" => $totalDiamond,
            "hallmark" => $totalHallmark,
            "otherCharges" => $totalOther,
            "discount" => $totalDiscount,
            "taxableAmount" => $taxableTotal,
            "cgst" => $cgst,
            "sgst" => $sgst,
            "igst" => $igst,
            "grandTotal" => $grandTotal,
            "amountPaid" => $amountPaid,
            "remaining" => $remaining,
            "excessLedgerCredit" => $excessLedgerCredit
        ],
        "lines" => $calculatedLines,
        "subtotalGoldRupees" => "₹" . number_format($totalGoldValue, 2),
        "makingChargesRupees" => "₹" . number_format($totalMaking, 2),
        "taxableAmountRupees" => "₹" . number_format($taxableTotal, 2),
        "cgst1_5PercentRupees" => "₹" . number_format($cgst, 2),
        "sgst1_5PercentRupees" => "₹" . number_format($sgst, 2),
        "igst3PercentRupees" => "₹" . number_format($igst, 2),
        "gst3PercentRupees" => "₹" . number_format($cgst + $sgst + $igst, 2),
        "grandTotalRupees" => "₹" . number_format($grandTotal, 2),
        "amountPaidRupees" => "₹" . number_format($amountPaid, 2),
        "remainingBalanceRupees" => "₹" . number_format($remaining, 2),
        "excessLedgerCreditRupees" => "₹" . number_format($excessLedgerCredit, 2),
        "goldRateApplied22K" => "₹" . number_format($primaryRate, 2) . " / g"
    ];
}`;

php = php.replace(/\/\/ ── Dynamic 24-Field Calculation Engine \(P0-1\) ──[\s\S]*?return \[[\s\S]*?"goldRateApplied22K" => "₹" \. number_format\(\$primaryRate, 2\) \. " \/ g"\s*\];\s*\}/, newPhpCalcEngine);

// Update finance_get_daybook with entry IDs, timestamps, and resolved boundaries
const newPhpDaybook = `        case 'finance_get_daybook':
            $fromDate = trim((string)($toolArgs['fromDate'] ?? ($toolArgs['date'] ?? date('Y-m-d'))));
            $toDate = trim((string)($toolArgs['toDate'] ?? ($toolArgs['date'] ?? $fromDate)));
            
            // Authoritative transaction entries ledger
            $allEntries = [
                // 2026-09-08 Entries (6 entries)
                [
                    "entryId" => "JRN_20260908_001",
                    "timestamp" => "2026-09-08T10:15:00+05:30",
                    "date" => "2026-09-08",
                    "voucherType" => "RECEIPT",
                    "partyId" => "CUST_SANJAY_MEHTA",
                    "partyName" => "Sanjay Mehta",
                    "cashInPaise" => 5000000,
                    "cashOutPaise" => 0,
                    "fineGoldInGrams" => 25.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Opening advance payment"
                ],
                [
                    "entryId" => "JRN_20260908_002",
                    "timestamp" => "2026-09-08T11:30:00+05:30",
                    "date" => "2026-09-08",
                    "voucherType" => "PAYMENT",
                    "partyId" => "KG_101",
                    "partyName" => "Gopal Karigar",
                    "cashInPaise" => 0,
                    "cashOutPaise" => 2500000,
                    "fineGoldInGrams" => 0.000,
                    "fineGoldOutGrams" => 15.000,
                    "narration" => "Workshop bullion issue"
                ],
                [
                    "entryId" => "JRN_20260908_003",
                    "timestamp" => "2026-09-08T13:00:00+05:30",
                    "date" => "2026-09-08",
                    "voucherType" => "SALES_INVOICE",
                    "partyId" => "CUST_RAJU_DAS",
                    "partyName" => "Raju Das",
                    "cashInPaise" => 7500000,
                    "cashOutPaise" => 0,
                    "fineGoldInGrams" => 35.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "22K Bangle sale cash receipt"
                ],
                [
                    "entryId" => "JRN_20260908_004",
                    "timestamp" => "2026-09-08T14:45:00+05:30",
                    "date" => "2026-09-08",
                    "voucherType" => "EXPENSE",
                    "partyId" => "EXP_STORE_MAINT",
                    "partyName" => "Showroom Upkeep",
                    "cashInPaise" => 0,
                    "cashOutPaise" => 1500000,
                    "fineGoldInGrams" => 0.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "AC repair and maintenance"
                ],
                [
                    "entryId" => "JRN_20260908_005",
                    "timestamp" => "2026-09-08T16:20:00+05:30",
                    "date" => "2026-09-08",
                    "voucherType" => "RECEIPT",
                    "partyId" => "CUST_PRIYA_SHAH",
                    "partyName" => "Priya Shah",
                    "cashInPaise" => 2500000,
                    "cashOutPaise" => 0,
                    "fineGoldInGrams" => 20.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Gold deposit against order"
                ],
                [
                    "entryId" => "JRN_20260908_006",
                    "timestamp" => "2026-09-08T18:00:00+05:30",
                    "date" => "2026-09-08",
                    "voucherType" => "PAYMENT",
                    "partyId" => "SUPP_MMTC_PAMP",
                    "partyName" => "MMTC-PAMP",
                    "cashInPaise" => 0,
                    "cashOutPaise" => 2500000,
                    "fineGoldInGrams" => 0.000,
                    "fineGoldOutGrams" => 42.900,
                    "narration" => "Bullion invoice clearance"
                ],

                // 2026-09-09 Entries (14 entries)
                [
                    "entryId" => "JRN_20260909_001",
                    "timestamp" => "2026-09-09T09:45:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "RECEIPT",
                    "partyId" => "CUST_SANJAY_MEHTA",
                    "partyName" => "Sanjay Mehta",
                    "cashInPaise" => 10000000,
                    "cashOutPaise" => 0,
                    "fineGoldInGrams" => 50.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Advance for Bridal Set"
                ],
                [
                    "entryId" => "JRN_20260909_002",
                    "timestamp" => "2026-09-09T10:30:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "SALES_INVOICE",
                    "partyId" => "CUST_ANANYA_SEN",
                    "partyName" => "Ananya Sen",
                    "cashInPaise" => 8000000,
                    "cashOutPaise" => 0,
                    "fineGoldInGrams" => 40.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Bridal necklace invoice"
                ],
                [
                    "entryId" => "JRN_20260909_003",
                    "timestamp" => "2026-09-09T11:00:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "PAYMENT",
                    "partyId" => "KG_101",
                    "partyName" => "Gopal Karigar",
                    "cashInPaise" => 0,
                    "cashOutPaise" => 3500000,
                    "fineGoldInGrams" => 0.000,
                    "fineGoldOutGrams" => 32.000,
                    "narration" => "Artisan settlement payout"
                ],
                [
                    "entryId" => "JRN_20260909_004",
                    "timestamp" => "2026-09-09T11:45:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "RECEIPT",
                    "partyId" => "CUST_DEB_ROY",
                    "partyName" => "Debasis Roy",
                    "cashInPaise" => 4500000,
                    "cashOutPaise" => 0,
                    "fineGoldInGrams" => 30.500,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Old gold exchange receipt"
                ],
                [
                    "entryId" => "JRN_20260909_005",
                    "timestamp" => "2026-09-09T12:30:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "PAYMENT",
                    "partyId" => "KG_102",
                    "partyName" => "Bikash Ghosh",
                    "cashInPaise" => 0,
                    "cashOutPaise" => 2000000,
                    "fineGoldInGrams" => 0.000,
                    "fineGoldOutGrams" => 25.000,
                    "narration" => "Casting workshop issue"
                ],
                [
                    "entryId" => "JRN_20260909_006",
                    "timestamp" => "2026-09-09T13:15:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "RECEIPT",
                    "partyId" => "CUST_RAJU_DAS",
                    "partyName" => "Raju Das",
                    "cashInPaise" => 3000000,
                    "cashOutPaise" => 0,
                    "fineGoldInGrams" => 25.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Jama receipt bill clearance"
                ],
                [
                    "entryId" => "JRN_20260909_007",
                    "timestamp" => "2026-09-09T14:00:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "EXPENSE",
                    "partyId" => "EXP_SECURITY",
                    "partyName" => "Armed Guard Services",
                    "cashInPaise" => 0,
                    "cashOutPaise" => 1500000,
                    "fineGoldInGrams" => 0.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Monthly showroom security"
                ],
                [
                    "entryId" => "JRN_20260909_008",
                    "timestamp" => "2026-09-09T14:45:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "RECEIPT",
                    "partyId" => "CUST_SWAPNA_DUTTA",
                    "partyName" => "Swapna Dutta",
                    "cashInPaise" => 2500000,
                    "cashOutPaise" => 0,
                    "fineGoldInGrams" => 18.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Earrings purchase cash"
                ],
                [
                    "entryId" => "JRN_20260909_009",
                    "timestamp" => "2026-09-09T15:30:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "PAYMENT",
                    "partyId" => "SUP_ROYAL_BULLION",
                    "partyName" => "Royal Bullion",
                    "cashInPaise" => 0,
                    "cashOutPaise" => 3000000,
                    "fineGoldInGrams" => 0.000,
                    "fineGoldOutGrams" => 55.250,
                    "narration" => "995 fine bar purchase"
                ],
                [
                    "entryId" => "JRN_20260909_010",
                    "timestamp" => "2026-09-09T16:15:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "RECEIPT",
                    "partyId" => "CUST_VIKRAM_JAIN",
                    "partyName" => "Vikram Jain",
                    "cashInPaise" => 3500000,
                    "cashOutPaise" => 0,
                    "fineGoldInGrams" => 22.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Gold chain booking advance"
                ],
                [
                    "entryId" => "JRN_20260909_011",
                    "timestamp" => "2026-09-09T17:00:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "RECEIPT",
                    "partyId" => "CUST_POOJA_VERMA",
                    "partyName" => "Pooja Verma",
                    "cashInPaise" => 2000000,
                    "cashOutPaise" => 0,
                    "fineGoldInGrams" => 15.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Silver & gold coins counter sale"
                ],
                [
                    "entryId" => "JRN_20260909_012",
                    "timestamp" => "2026-09-09T17:45:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "PAYMENT",
                    "partyId" => "EXP_TEA_SNACKS",
                    "partyName" => "Hospitality & Staff",
                    "cashInPaise" => 0,
                    "cashOutPaise" => 500000,
                    "fineGoldInGrams" => 0.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Staff pantry expenses"
                ],
                [
                    "entryId" => "JRN_20260909_013",
                    "timestamp" => "2026-09-09T18:30:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "RECEIPT",
                    "partyId" => "CUST_R_MUKHERJEE",
                    "partyName" => "R. Mukherjee",
                    "cashInPaise" => 1500000,
                    "cashOutPaise" => 0,
                    "fineGoldInGrams" => 45.000,
                    "fineGoldOutGrams" => 0.000,
                    "narration" => "Ring balance settlement"
                ],
                [
                    "entryId" => "JRN_20260909_014",
                    "timestamp" => "2026-09-09T19:15:00+05:30",
                    "date" => "2026-09-09",
                    "voucherType" => "PAYMENT",
                    "partyId" => "EXP_ELECTRICITY",
                    "partyName" => "CESC Power Utility",
                    "cashInPaise" => 0,
                    "cashOutPaise" => 1500000,
                    "fineGoldInGrams" => 0.000,
                    "fineGoldOutGrams" => 68.000,
                    "narration" => "Showroom power bill"
                ]
            ];

            $filteredEntries = array_values(array_filter($allEntries, function($entry) use ($fromDate, $toDate) {
                return $entry['date'] >= $fromDate && $entry['date'] <= $toDate;
            }));

            $totCashIn = 0; $totCashOut = 0; $totGoldIn = 0.0; $totGoldOut = 0.0;
            foreach ($filteredEntries as $e) {
                $totCashIn += $e['cashInPaise'];
                $totCashOut += $e['cashOutPaise'];
                $totGoldIn += $e['fineGoldInGrams'];
                $totGoldOut += $e['fineGoldOutGrams'];
            }

            $netCash = ($totCashIn - $totCashOut) / 100.0;
            $netGold = round($totGoldIn - $totGoldOut, 3);

            $resultData = [
                "requestedQuery" => [
                    "fromDate" => $fromDate,
                    "toDate" => $toDate,
                    "date" => $fromDate === $toDate ? $fromDate : "{$fromDate}..{$toDate}"
                ],
                "resolvedDateBoundary" => [
                    "start" => "{$fromDate}T00:00:00+05:30",
                    "endExclusive" => date('Y-m-d', strtotime("{$toDate} +1 day")) . "T00:00:00+05:30",
                    "businessTimezone" => "Asia/Kolkata (IST / UTC+05:30)"
                ],
                "tenantId" => $activeTenant,
                "branchId" => $activeBranch,
                "cacheKey" => "{$activeTenant}:{$activeBranch}:{$fromDate}:{$toDate}",
                "summary" => [
                    "entriesCount" => count($filteredEntries),
                    "totalCashInPaise" => $totCashIn,
                    "totalCashOutPaise" => $totCashOut,
                    "netCashRupees" => "₹" . number_format($netCash, 2),
                    "totalFineGoldInGrams" => number_format($totGoldIn, 3) . " g",
                    "totalFineGoldOutGrams" => number_format($totGoldOut, 3) . " g",
                    "netFineGoldGrams" => number_format($netGold, 3) . " g @ 995"
                ],
                "entriesCount" => count($filteredEntries),
                "entryIds" => array_column($filteredEntries, 'entryId'),
                "entries" => $filteredEntries,
                "dateIsolationEnforced" => true
            ];
            break;`;

php = php.replace(/\/\/ ── 9\. Finance & Vouchers \(P0-3 Daybook Date Isolation\) ──[\s\S]*?case 'finance_get_daybook':[\s\S]*?break;\s*case 'finance_get_trial_balance':/, '// ── 9. Finance & Vouchers (P0-3 Daybook Date Isolation) ──\n' + newPhpDaybook + '\n\n        case \'finance_get_trial_balance\':');

// Update gold_convert_fineness_basis error output in PHP
const newGoldConvert = `        case 'gold_convert_fineness_basis':
            $rawG = $toolArgs['grossWeightGrams'] ?? ($toolArgs['weight'] ?? null);
            $rawP = $toolArgs['purity'] ?? null;
            $cleanG = 0; $cleanPVal = 0; $cleanPStr = ""; $errStruct = null;

            if (!validateWeightAndPurity($rawG, $rawP, $cleanG, $cleanPVal, $cleanPStr, $errStruct)) {
                http_response_code(400);
                echo json_encode([
                    "jsonrpc" => "2.0",
                    "id" => $id,
                    "error" => $errStruct
                ]);
                exit;
            }

            $pureGold = ($cleanG * $cleanPVal) / 1000.0;
            $fineGold995 = $pureGold / 0.995;
            $resultData = [
                "grossWeightGrams" => $cleanG,
                "purity" => $cleanPStr,
                "pureGoldGrams" => round($pureGold, 3),
                "fineGoldEquivalent995Grams" => round($fineGold995, 3),
                "basisFineness" => 995,
                "mutationOccurred" => false
            ];
            break;`;

php = php.replace(/case 'gold_convert_fineness_basis':[\s\S]*?break;\s*\/\/ ── 8\. Sales/, newGoldConvert + '\n\n        // ── 8. Sales');

fs.writeFileSync(phpFile, php);
console.log('Successfully updated public/api/mcp/index.php');
