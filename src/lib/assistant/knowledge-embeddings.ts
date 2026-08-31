/**
 * Sync approved knowledge article embeddings into Supabase pgvector.
 * Tenant isolation via RLS + firm_id. Never embeds live ERP tables.
 *
 * Upsert path:
 * - Firm-scoped custom articles: `assistant_knowledge_embeddings_tenant_write`
 *   (firm_id = my_firm_id()) — works for authenticated firm users.
 * - System articles: require rows in `assistant_knowledge_articles` first
 *   (service-role / admin seed). Embeddings then upsert under
 *   `assistant_knowledge_embeddings_system_write` (is_system + firm_id null).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { embedText, sha256Hex, EMBEDDING_MODEL_ID } from "./local-embedder";
import type { KnowledgeArticle } from "./knowledge-repository";

export async function upsertKnowledgeEmbedding(article: KnowledgeArticle): Promise<boolean> {
  try {
    const payload = `${article.title}\n${article.summary}\n${article.content}\n${(article.keywords ?? []).join(" ")}`;
    const hash = await sha256Hex(`${article.version}:${payload}`);
    const embedding = embedText(payload);
    const { error } = await supabase.from("assistant_knowledge_embeddings" as never).upsert(
      {
        article_id: article.id,
        firm_id: article.firmId ?? null,
        embedding,
        embedding_model: EMBEDDING_MODEL_ID,
        source_version: article.version,
        content_sha256: hash,
        is_system: Boolean(article.isSystem) && !article.firmId,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "article_id,embedding_model" },
    );
    return !error;
  } catch {
    return false;
  }
}

export async function searchKnowledgeEmbeddings(query: string, limit = 5): Promise<
  Array<{ articleId: string; similarity: number; sourceVersion: string }>
> {
  try {
    const { data, error } = await supabase.rpc("match_assistant_knowledge_embeddings" as never, {
      query_embedding: embedText(query),
      match_count: limit,
    } as never);
    if (error || !data) return [];
    return (data as Array<Record<string, unknown>>).map((row) => ({
      articleId: String(row.article_id),
      similarity: Number(row.similarity ?? 0),
      sourceVersion: String(row.source_version ?? ""),
    }));
  } catch {
    return [];
  }
}

/**
 * Best-effort: refresh embeddings for articles whose version/hash may have changed.
 * Prefer calling with firm-scoped custom articles from the client; system articles
 * after a service-role article seed.
 */
export async function syncKnowledgeEmbeddings(articles: KnowledgeArticle[]): Promise<number> {
  let ok = 0;
  for (const article of articles.slice(0, 80)) {
    if (await upsertKnowledgeEmbedding(article)) ok += 1;
  }
  return ok;
}
