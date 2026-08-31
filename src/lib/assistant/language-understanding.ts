/**
 * Ornexa Language Understanding Layer
 * Typo tolerance, fuzzy/phonetic matching, Hinglish, and jewellery trade aliases.
 * Protected tokens (invoice numbers, HUIDs, tag IDs, amounts) are never altered.
 */

export type DetectedLanguage = "en-IN" | "hi-roman" | "mr-roman" | "mixed";

/** Tokens that must never be fuzzy-corrected */
const PROTECTED_PATTERNS: RegExp[] = [
  /\bINV[-/]?\d{4,}[-/]?\d+\b/gi,
  /\bEST[-/]?\d+\b/gi,
  /\b[A-Z]{2,}\d{6,}\b/g, // tag / voucher refs
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  /\b\d{6}\b/g, // BIS HUID 6-char numeric
  /\b\+?\d{10,13}\b/g, // phone
  /\b₹?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b/g, // money
  /\b\d+(?:\.\d+)?\s*(?:g|gm|gram|grams|mg|ct|carat)\b/gi, // weights
  /\b\d{3,4}\b/g, // purity permille like 916, 750
];

/** Built-in jewellery trade aliases (system-wide) */
export const BUILTIN_ALIASES: Record<string, string> = {
  // Karigar / worker typos
  karigr: "karigar",
  karigarrr: "karigar",
  karigarr: "karigar",
  kargir: "karigar",
  kariger: "karigar",
  goldsmith: "karigar",
  // Bhav / rate
  bhav: "bhav",
  bhaav: "bhav",
  bhaw: "bhav",
  bhaaw: "bhav",
  // Jama / receipt
  jma: "jama",
  jamaa: "jama",
  // Hallmark
  halmark: "hallmark",
  hallmrk: "hallmark",
  huid: "hallmark huid",
  // Purity
  purty: "purity",
  puritty: "purity",
  touchh: "touch",
  // Common action typos
  recive: "receive",
  recieved: "received",
  isshu: "issue",
  issu: "issue",
  trasfer: "transfer",
  // Business terms
  costomer: "customer",
  custmer: "customer",
  invoce: "invoice",
  invioce: "invoice",
  refinary: "refinery",
  refinry: "refinery",
  jewlers: "jewellers",
  jeweller: "jewellers",
  jewler: "jewellers",
  jewllery: "jewellery",
  jewlry: "jewellery",
  // Hinglish / Roman Hindi
  sone: "gold",
  sona: "gold",
  kaam: "work",
  hisaab: "hisab",
  hisab: "settlement",
  udhar: "outstanding",
  jama: "receipt",
  nikasi: "issue",
  ghat: "wastage",
  milavat: "alloy",
  dhalai: "melting",
  saaf: "refining",
  // Abbreviations
  og: "old gold",
  dc: "delivery challan",
  gst: "gst",
  hsn: "hsn",
  kyc: "kyc",
};

/** Multi-word phrase aliases (applied before tokenization) */
export const BUILTIN_PHRASE_ALIASES: [RegExp, string][] = [
  [/\bisshu\s+gold\b/gi, "issue gold"],
  [/\brecive\s+gold\b/gi, "receive gold"],
  [/\bgold\s+with\s+karigar\b/gi, "karigar gold balance"],
  [/\bkarigar\s+gold\b/gi, "karigar gold balance"],
  [/\bgold\s+book\b/gi, "gold book"],
  [/\bparty\s+ledger\b/gi, "party ledger"],
  [/\bopening\s+bal(ance)?\b/gi, "opening balance"],
  [/\bold\s+gold\b/gi, "old gold purchase"],
  [/\bfine\s+wt\b/gi, "fine weight"],
  [/\bgross\s+wt\b/gi, "gross weight"],
  [/\bnet\s+wt\b/gi, "net weight"],
  [/\bhisab\s+final\b/gi, "hisab final settlement"],
];

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** Simple consonant-skeleton phonetic key for Indian name matching */
export function phoneticKey(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/[aeiou]/g, "")
    .replace(/(.)\1+/g, "$1")
    .slice(0, 6);
}

export function phoneticSimilarity(a: string, b: string): number {
  const ka = phoneticKey(a);
  const kb = phoneticKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  const dist = levenshteinDistance(ka, kb);
  const maxLen = Math.max(ka.length, kb.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

export function fuzzyWordMatch(input: string, candidate: string): number {
  const a = input.toLowerCase();
  const b = candidate.toLowerCase();
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.85;
  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  const threshold = maxLen <= 4 ? 1 : maxLen <= 6 ? 2 : 3;
  if (dist > threshold) {
    const phon = phoneticSimilarity(a, b);
    return phon >= 0.75 ? phon * 0.9 : 0;
  }
  return 1 - dist / maxLen;
}

export function detectLanguage(text: string): DetectedLanguage {
  const lower = text.toLowerCase();
  const hinglishMarkers =
    /\b(kya|kaise|kahan|hai|hain|mujhe|batao|dikhao|kitna|kaun|sone|sona|udhar|jama|hisab|karigar|bhav)\b/;
  const marathiMarkers = /\b(kay|kasa|kiti|ahe|mala|dakhva)\b/;
  if (marathiMarkers.test(lower)) return "mr-roman";
  if (hinglishMarkers.test(lower)) return "hi-roman";
  if (/[\u0900-\u097F]/.test(text)) return "hi-roman";
  if (/[\u0900-\u097F\u0980-\u09FF\u0A80-\u0AFF]/.test(text)) return "mixed";
  return "en-IN";
}

interface ProtectedSpan {
  start: number;
  end: number;
  text: string;
}

function extractProtectedSpans(text: string): ProtectedSpan[] {
  const spans: ProtectedSpan[] = [];
  for (const pattern of PROTECTED_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      spans.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

function isInsideProtected(index: number, spans: ProtectedSpan[]): boolean {
  return spans.some((s) => index >= s.start && index < s.end);
}

export interface NormalizeOptions {
  tenantAliases?: Record<string, string>;
  preserveOriginalEntities?: boolean;
}

/**
 * Normalize user text: phrase aliases → token typos → tenant aliases.
 * Protected spans (IDs, numbers, HUIDs) are left untouched.
 */
export function normalizeUserText(
  rawText: string,
  options: NormalizeOptions = {},
): { normalized: string; corrections: Array<{ from: string; to: string }> } {
  let text = rawText.trim();
  const corrections: Array<{ from: string; to: string }> = [];

  for (const [pattern, replacement] of BUILTIN_PHRASE_ALIASES) {
    const before = text;
    text = text.replace(pattern, replacement);
    if (text !== before) {
      corrections.push({ from: before.match(pattern)?.[0] ?? "", to: replacement });
    }
  }

  const protectedSpans = extractProtectedSpans(text);
  const mergedAliases = { ...BUILTIN_ALIASES, ...options.tenantAliases };

  const tokens = text.split(/(\s+)/);
  const normalizedTokens = tokens.map((token, tokenIndex) => {
    if (/^\s+$/.test(token)) return token;
    const charOffset = tokens.slice(0, tokenIndex).join("").length;
    if (isInsideProtected(charOffset, protectedSpans)) return token;

    const lower = token.toLowerCase().replace(/[.,!?;:]+$/, "");
    const punct = token.slice(lower.length);

    if (mergedAliases[lower]) {
      const corrected = mergedAliases[lower];
      if (corrected !== lower) corrections.push({ from: lower, to: corrected });
      return corrected + punct;
    }

    // Fuzzy match against alias keys for typo tolerance
    let bestKey = "";
    let bestScore = 0;
    for (const key of Object.keys(mergedAliases)) {
      if (key.length < 3) continue;
      const score = fuzzyWordMatch(lower, key);
      if (score > bestScore && score >= 0.78) {
        bestScore = score;
        bestKey = key;
      }
    }
    if (bestKey) {
      const corrected = mergedAliases[bestKey];
      if (corrected !== lower) corrections.push({ from: lower, to: corrected });
      return corrected + punct;
    }

    return token;
  });

  return {
    normalized: normalizedTokens.join("").replace(/\s+/g, " ").trim(),
    corrections,
  };
}

/** Check if text looks like a protected identifier (never fuzzy-match party names against these) */
export function isProtectedIdentifier(token: string): boolean {
  return PROTECTED_PATTERNS.some((p) => {
    const re = new RegExp(`^${p.source}$`, p.flags.replace("g", ""));
    return re.test(token);
  });
}

/** Extract likely party/entity name fragments from a query */
export function extractEntityNameCandidates(normalizedText: string): string[] {
  const stopWords = new Set([
    "show",
    "find",
    "search",
    "get",
    "tell",
    "what",
    "is",
    "the",
    "my",
    "me",
    "for",
    "of",
    "gold",
    "balance",
    "position",
    "ledger",
    "book",
    "customer",
    "party",
    "karigar",
    "worker",
    "invoice",
    "order",
    "job",
    "stock",
    "outstanding",
    "a",
    "an",
    "please",
    "can",
    "you",
    "how",
    "much",
    "where",
    "their",
    "his",
    "her",
    "this",
    "that",
  ]);

  const words = normalizedText
    .toLowerCase()
    .replace(/[^a-z0-9\s&'.-]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w) && !isProtectedIdentifier(w));

  if (words.length === 0) return [];

  const candidates: string[] = [];
  // Full remaining phrase
  const phrase = words.join(" ");
  if (phrase.length >= 3) candidates.push(phrase);

  // Sliding windows of 2-4 words (for "raj jewellers gold" → "raj jewellers")
  for (let len = Math.min(4, words.length); len >= 2; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const slice = words.slice(i, i + len).join(" ");
      if (slice.length >= 3 && !candidates.includes(slice)) candidates.push(slice);
    }
  }

  // Single distinctive words (proper-noun-like)
  for (const w of words) {
    if (w.length >= 4 && !candidates.includes(w)) candidates.push(w);
  }

  return candidates.slice(0, 5);
}
