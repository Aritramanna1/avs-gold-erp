/**
 * Ornexa Knowledge & RAG Engine (Path A - Local / Standard Assistant)
 * @deprecated Import from knowledge-repository.ts directly for new code.
 */
export {
  queryKnowledgeBase,
  searchKnowledgeRepository,
  hydrateKnowledgeRepository,
  formatKnowledgeAnswer,
  toKnowledgeSourceRef,
  getAllArticles,
  type KnowledgeArticle,
  type KnowledgeTier,
  type KnowledgeSearchResult,
  type KnowledgeSourceRef,
} from "./knowledge-repository";

// Legacy type alias
export type { KnowledgeArticle as KnowledgeItem } from "./knowledge-repository";
