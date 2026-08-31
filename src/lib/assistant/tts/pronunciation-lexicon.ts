/**
 * Jewellery / gold / ERP pronunciation lexicon for Assistant Read Aloud.
 * Applied before any TTS engine so device fallback and Qwen3-TTS share terms.
 */

export interface PronunciationRule {
  /** Case-insensitive whole-word or regex source */
  pattern: RegExp;
  replacement: string;
  note?: string;
}

/** Ordered rules — more specific first. */
export const JEWELLERY_PRONUNCIATION_RULES: PronunciationRule[] = [
  { pattern: /\bHUID\b/gi, replacement: "H U I D", note: "Hallmark Unique ID" },
  { pattern: /\bGSTIN\b/gi, replacement: "G S T I N" },
  { pattern: /\bCGST\b/gi, replacement: "C G S T" },
  { pattern: /\bSGST\b/gi, replacement: "S G S T" },
  { pattern: /\bIGST\b/gi, replacement: "I G S T" },
  { pattern: /\bTCS\b/gi, replacement: "T C S" },
  { pattern: /\bPAN\b/gi, replacement: "P A N" },
  { pattern: /\bUPI\b/gi, replacement: "U P I" },
  { pattern: /\bKYC\b/gi, replacement: "K Y C" },
  { pattern: /\bAMC\b/gi, replacement: "A M C" },
  { pattern: /\bRLS\b/gi, replacement: "R L S" },
  { pattern: /\bERP\b/gi, replacement: "E R P" },
  { pattern: /\bPDF\b/gi, replacement: "P D F" },
  { pattern: /\bQR\b/gi, replacement: "Q R" },
  { pattern: /\bMTJ\b/gi, replacement: "M T J" },
  { pattern: /\bAVS\b/gi, replacement: "A V S" },
  { pattern: /\bOrnexa\b/gi, replacement: "Or-nex-a" },
  { pattern: /\bkarigar\b/gi, replacement: "kaarigar" },
  { pattern: /\bkárigar\b/gi, replacement: "kaarigar" },
  { pattern: /\bhisab\b/gi, replacement: "hisaab" },
  { pattern: /\bhisob\b/gi, replacement: "hisaab" },
  { pattern: /\btanch\b/gi, replacement: "taanch" },
  { pattern: /\bwstg\b/gi, replacement: "wastage" },
  { pattern: /\bwastage\b/gi, replacement: "wastage" },
  { pattern: /\bchallan\b/gi, replacement: "challan" },
  { pattern: /\bhasta\b/gi, replacement: "hasta" },
  { pattern: /\bhaste\b/gi, replacement: "haste" },
  { pattern: /\bsona\b/gi, replacement: "sona" },
  { pattern: /\bfine\s*gold\b/gi, replacement: "fine gold" },
  { pattern: /\b916\b/g, replacement: "nine sixteen", note: "22K hallmark" },
  { pattern: /\b750\b/g, replacement: "seven fifty", note: "18K" },
  { pattern: /\b585\b/g, replacement: "five eighty five", note: "14K" },
  { pattern: /\b999\b/g, replacement: "nine ninety nine", note: "24K" },
  { pattern: /(\d+(?:\.\d+)?)\s*mg\b/gi, replacement: "$1 milligrams" },
  { pattern: /(\d+(?:\.\d+)?)\s*g\b/gi, replacement: "$1 grams" },
  { pattern: /(\d+(?:\.\d+)?)\s*ct\b/gi, replacement: "$1 carats" },
  { pattern: /\bRs\.?\s*/gi, replacement: "Rupees " },
  { pattern: /\bINR\b/gi, replacement: "Indian Rupees" },
  { pattern: /\bpaise\b/gi, replacement: "paise" },
  { pattern: /\bvault\b/gi, replacement: "vault" },
  { pattern: /\bledger\b/gi, replacement: "ledger" },
  { pattern: /\binvoice\b/gi, replacement: "invoice" },
  { pattern: /\bestimate\b/gi, replacement: "estimate" },
  { pattern: /\bquotation\b/gi, replacement: "quotation" },
  { pattern: /\breceipt\b/gi, replacement: "receipt" },
];

export function applyJewelleryPronunciation(text: string): string {
  let out = text;
  for (const rule of JEWELLERY_PRONUNCIATION_RULES) {
    out = out.replace(rule.pattern, rule.replacement);
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Compact phrase pack for on-device TTS quality gates. */
export const TTS_PRONUNCIATION_PHRASE_PACK: string[] = [
  "Invoice INV-1042 for nine sixteen gold, gross weight 12.450 grams.",
  "Karigar hisaab shows fine gold 3.200 grams in the vault ledger.",
  "HUID ABC12345, GSTIN 27AABCU9603R1ZM, making charges Rupees 2,500.",
  "AVS Assistant: settlement challan and TCS on purchase are ready.",
  "आज का सोना भाव और कारीगर हिसाब चेक करें।",
];
