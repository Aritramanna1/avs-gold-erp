/**
 * Entity Resolution — fuzzy party/name matching with disambiguation.
 * Protected identifiers (invoice nos, HUIDs, tag IDs) are never fuzzy-matched.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  extractEntityNameCandidates,
  fuzzyWordMatch,
  phoneticSimilarity,
  isProtectedIdentifier,
} from "./language-understanding";

export interface ResolvedEntity {
  id: string;
  name: string;
  type: string;
  phone?: string;
  score: number;
  matchReason: string;
}

export interface EntityResolutionResult {
  query: string;
  candidates: ResolvedEntity[];
  needsDisambiguation: boolean;
  bestMatch: ResolvedEntity | null;
}

function scorePersonMatch(
  person: { full_name: string; phone?: string; type: string },
  candidate: string,
): { score: number; reason: string } {
  const name = person.full_name.toLowerCase();
  const cand = candidate.toLowerCase();
  const words = cand.split(/\s+/);

  if (name === cand) return { score: 1, reason: "exact name" };

  if (name.includes(cand) || cand.includes(name)) {
    return { score: 0.92, reason: "partial name match" };
  }

  let wordScore = 0;
  let matchedWords = 0;
  for (const w of words) {
    if (w.length < 3) continue;
    const nameWords = name.split(/\s+/);
    for (const nw of nameWords) {
      const fuzzy = fuzzyWordMatch(w, nw);
      const phon = phoneticSimilarity(w, nw);
      const best = Math.max(fuzzy, phon);
      if (best >= 0.75) {
        wordScore += best;
        matchedWords++;
      }
    }
  }
  if (matchedWords > 0) {
    const avg = wordScore / words.length;
    return { score: avg * 0.9, reason: `fuzzy word match (${matchedWords} words)` };
  }

  const fullFuzzy = fuzzyWordMatch(cand, name);
  if (fullFuzzy >= 0.7) return { score: fullFuzzy * 0.85, reason: "fuzzy full name" };

  return { score: 0, reason: "no match" };
}

export async function resolvePartyEntities(
  normalizedQuery: string,
  options: { types?: string[]; limit?: number } = {},
): Promise<EntityResolutionResult> {
  const candidates = extractEntityNameCandidates(normalizedQuery);
  const searchPhrase = candidates[0] ?? normalizedQuery;

  if (!searchPhrase || searchPhrase.length < 2) {
    return { query: searchPhrase, candidates: [], needsDisambiguation: false, bestMatch: null };
  }

  // Don't fuzzy-search if query is purely a protected identifier
  if (isProtectedIdentifier(searchPhrase)) {
    return { query: searchPhrase, candidates: [], needsDisambiguation: false, bestMatch: null };
  }

  const types = options.types ?? [
    "customer",
    "dealer",
    "supplier",
    "karigar",
    "worker",
    "vendor",
    "refinery",
  ];
  const limit = options.limit ?? 5;

  // Fetch broader set for client-side fuzzy scoring
  const safe = searchPhrase.replace(/[%_,]/g, " ").trim();
  const firstWord = safe.split(/\s+/)[0] ?? safe;

  let request = supabase
    .from("people" as never)
    .select("id,full_name,phone,type,active")
    .eq("active", true)
    .limit(50);

  if (types.length > 0) {
    request = request.in("type", types);
  }

  if (firstWord.length >= 2) {
    request = request.or(`full_name.ilike.%${firstWord}%,phone.ilike.%${firstWord}%`);
  }

  const { data, error } = await request;
  if (error || !data) {
    return { query: searchPhrase, candidates: [], needsDisambiguation: false, bestMatch: null };
  }

  const scored: ResolvedEntity[] = [];
  for (const row of data as { id: string; full_name: string; phone?: string; type: string }[]) {
    for (const cand of candidates.length > 0 ? candidates : [searchPhrase]) {
      const { score, reason } = scorePersonMatch(row, cand);
      if (score >= 0.65) {
        scored.push({
          id: row.id,
          name: row.full_name,
          type: row.type,
          phone: row.phone,
          score,
          matchReason: reason,
        });
        break;
      }
    }
  }

  // Deduplicate by id, keep highest score
  const byId = new Map<string, ResolvedEntity>();
  for (const s of scored) {
    const existing = byId.get(s.id);
    if (!existing || s.score > existing.score) byId.set(s.id, s);
  }

  const sorted = [...byId.values()].sort((a, b) => b.score - a.score).slice(0, limit);

  const topScore = sorted[0]?.score ?? 0;
  const secondScore = sorted[1]?.score ?? 0;
  const needsDisambiguation = sorted.length > 1 && topScore - secondScore < 0.08 && topScore < 0.98;

  return {
    query: searchPhrase,
    candidates: sorted,
    needsDisambiguation,
    bestMatch: sorted[0] ?? null,
  };
}

export function formatDisambiguationPrompt(entities: ResolvedEntity[], context: string): string {
  const lines = entities
    .slice(0, 4)
    .map((e, i) => `${i + 1}. **${e.name}** (${e.type}${e.phone ? `, ${e.phone}` : ""})`)
    .join("\n");
  return `I found multiple parties matching "${context}". Which one did you mean?\n\n${lines}\n\nPlease reply with the number or full name.`;
}

/** Resolve user's disambiguation reply (number or name) to a party candidate */
export function resolveDisambiguationChoice(
  reply: string,
  candidates: ResolvedEntity[],
): ResolvedEntity | null {
  const trimmed = reply.trim();
  if (!trimmed || candidates.length === 0) return null;

  const num = parseInt(trimmed, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= candidates.length) {
    return candidates[num - 1];
  }

  const lower = trimmed.toLowerCase();
  const exact = candidates.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact;

  const partial = candidates.find(
    (c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()),
  );
  if (partial) return partial;

  let best: ResolvedEntity | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = Math.max(
      fuzzyWordMatch(lower, c.name.toLowerCase()),
      phoneticSimilarity(lower, c.name),
    );
    if (score > bestScore && score >= 0.75) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
