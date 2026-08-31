/**
 * Ornexa Knowledge Repository — RAG search layer
 * Tiers: product | industry | india | tenant | faq
 * Never conflated with live ERP data.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { SYSTEM_KNOWLEDGE_ARTICLES } from "./knowledge-articles-seed";
import { normalizeUserText, fuzzyWordMatch, type DetectedLanguage } from "./language-understanding";

export type KnowledgeTier = "product" | "industry" | "india" | "tenant" | "faq";

export interface KnowledgeArticle {
  id: string;
  knowledgeTier: KnowledgeTier;
  topic: string;
  title: string;
  language: string;
  summary: string;
  content: string;
  keywords: string[];
  aliases?: string[];
  sourceDoc?: string;
  relatedRoute?: string;
  version: string;
  effectiveFrom: string;
  lastReviewedAt: string;
  isSystem?: boolean;
  firmId?: string;
}

export interface KnowledgeSearchResult {
  article: KnowledgeArticle;
  score: number;
  matchedTerms: string[];
  knowledgeTier: KnowledgeTier;
}

export interface KnowledgeSourceRef {
  id: string;
  title: string;
  topic: string;
  knowledgeTier: KnowledgeTier;
  sourceDoc?: string;
  relatedRoute?: string;
  lastReviewedAt: string;
}

let cachedArticles: KnowledgeArticle[] | null = null;
let tenantArticles: KnowledgeArticle[] = [];
let hydratePromise: Promise<void> | null = null;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function scoreArticle(
  article: KnowledgeArticle,
  queryTokens: string[],
  rawQuery: string,
): KnowledgeSearchResult | null {
  const searchable = [
    article.title,
    article.summary,
    article.topic,
    ...article.keywords,
    ...(article.aliases ?? []),
    article.content.slice(0, 500),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  const matchedTerms: string[] = [];

  for (const token of queryTokens) {
    if (article.title.toLowerCase().includes(token)) {
      score += 12;
      matchedTerms.push(token);
    }
    if (
      article.keywords.some(
        (k) => k.toLowerCase().includes(token) || fuzzyWordMatch(token, k) > 0.8,
      )
    ) {
      score += 8;
      matchedTerms.push(token);
    }
    if (
      article.aliases?.some(
        (a) => a.toLowerCase().includes(token) || fuzzyWordMatch(token, a) > 0.8,
      )
    ) {
      score += 9;
      matchedTerms.push(token);
    }
    if (article.summary.toLowerCase().includes(token)) {
      score += 4;
    }
    if (searchable.includes(token)) {
      score += 2;
    }
  }

  // Exact phrase boost
  const qLower = rawQuery.toLowerCase();
  if (article.title.toLowerCase().includes(qLower)) score += 20;
  if (article.summary.toLowerCase().includes(qLower)) score += 10;

  // "What is X" → boost definitional articles
  if (/^what (is|does|are)\b/.test(qLower) && article.topic) {
    const topicWords = article.topic.replace(/_/g, " ");
    if (qLower.includes(topicWords)) score += 15;
  }

  if (score < 6) return null;
  return {
    article,
    score,
    matchedTerms: [...new Set(matchedTerms)],
    knowledgeTier: article.knowledgeTier,
  };
}

export function getAllArticles(): KnowledgeArticle[] {
  return [...(cachedArticles ?? SYSTEM_KNOWLEDGE_ARTICLES), ...tenantArticles];
}

export async function hydrateKnowledgeRepository(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    cachedArticles = SYSTEM_KNOWLEDGE_ARTICLES;

    try {
      const { data, error } = await supabase
        .from("assistant_knowledge_articles" as never)
        .select(
          "id,knowledge_tier,topic,title,language,summary,content,keywords,aliases,source_doc,related_route,version,effective_from,last_reviewed_at,is_system,firm_id",
        )
        .eq("is_active", true)
        .limit(500);

      if (!error && data && (data as unknown[]).length > 0) {
        const fromDb = (data as Record<string, unknown>[]).map((row): KnowledgeArticle => ({
          id: String(row.id),
          knowledgeTier: row.knowledge_tier as KnowledgeTier,
          topic: String(row.topic),
          title: String(row.title),
          language: String(row.language ?? "en-IN"),
          summary: String(row.summary),
          content: String(row.content),
          keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : [],
          aliases: Array.isArray(row.aliases) ? (row.aliases as string[]) : [],
          sourceDoc: row.source_doc ? String(row.source_doc) : undefined,
          relatedRoute: row.related_route ? String(row.related_route) : undefined,
          version: String(row.version ?? "1.0.0"),
          effectiveFrom: String(row.effective_from ?? "2026-01-01"),
          lastReviewedAt: String(row.last_reviewed_at ?? new Date().toISOString()),
          isSystem: Boolean(row.is_system),
          firmId: row.firm_id ? String(row.firm_id) : undefined,
        }));
        tenantArticles = fromDb.filter((a) => !a.isSystem);
      }
    } catch {
      // Offline / table not migrated — use seed only
    }

    // Best-effort seed of system articles when DB is empty
    try {
      const { count } = await supabase
        .from("assistant_knowledge_articles" as never)
        .select("id", { count: "exact", head: true })
        .eq("is_system", true);
      if ((count ?? 0) === 0) {
        await seedSystemArticlesToDatabase();
      }
    } catch {
      // Seed is optional
    }
  })();
  return hydratePromise;
}

/**
 * RAG search over knowledge repository. Does NOT query live ERP data.
 */
export function searchKnowledgeRepository(
  query: string,
  options: {
    limit?: number;
    tiers?: KnowledgeTier[];
    language?: DetectedLanguage;
    tenantAliases?: Record<string, string>;
  } = {},
): KnowledgeSearchResult[] {
  const { normalized } = normalizeUserText(query, { tenantAliases: options.tenantAliases });
  const searchText = normalized || query;
  const tokens = tokenize(searchText);
  const limit = options.limit ?? 3;
  const tierFilter = options.tiers;

  const articles = getAllArticles().filter(
    (a) => !tierFilter || tierFilter.includes(a.knowledgeTier),
  );

  const results: KnowledgeSearchResult[] = [];
  for (const article of articles) {
    const scored = scoreArticle(article, tokens, searchText);
    if (scored) results.push(scored);
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function toKnowledgeSourceRef(result: KnowledgeSearchResult): KnowledgeSourceRef {
  const a = result.article;
  return {
    id: a.id,
    title: a.title,
    topic: a.topic,
    knowledgeTier: a.knowledgeTier,
    sourceDoc: a.sourceDoc,
    relatedRoute: a.relatedRoute,
    lastReviewedAt: a.lastReviewedAt,
  };
}

export function formatKnowledgeAnswer(results: KnowledgeSearchResult[]): {
  content: string;
  sources: KnowledgeSourceRef[];
  confidence: "high" | "medium" | "low";
} {
  if (results.length === 0) {
    return {
      content: "",
      sources: [],
      confidence: "low",
    };
  }

  const primary = results[0];
  const sources = results.map(toKnowledgeSourceRef);

  let content = primary.article.summary;
  if (primary.score >= 15) {
    content = `${primary.article.summary}\n\n${primary.article.content}`;
  }

  const confidence: "high" | "medium" | "low" =
    primary.score >= 20 ? "high" : primary.score >= 10 ? "medium" : "low";

  return { content, sources, confidence };
}

/** Backward-compatible export for knowledge-service.ts */
export function queryKnowledgeBase(
  query: string,
  limit: number = 3,
  tenantAliases?: Record<string, string>,
): KnowledgeArticle[] {
  return searchKnowledgeRepository(query, { limit, tenantAliases }).map((r) => r.article);
}

export async function seedSystemArticlesToDatabase(): Promise<void> {
  const rows = SYSTEM_KNOWLEDGE_ARTICLES.map((a) => ({
    id: a.id,
    firm_id: null,
    knowledge_tier: a.knowledgeTier,
    topic: a.topic,
    title: a.title,
    language: a.language,
    summary: a.summary,
    content: a.content,
    keywords: a.keywords,
    aliases: a.aliases,
    source_doc: a.sourceDoc ?? null,
    related_route: a.relatedRoute ?? null,
    version: a.version,
    effective_from: a.effectiveFrom,
    last_reviewed_at: a.lastReviewedAt,
    is_system: true,
    is_active: true,
  }));

  await supabase.from("assistant_knowledge_articles" as never).upsert(rows as never, {
    onConflict: "id",
  });
}
