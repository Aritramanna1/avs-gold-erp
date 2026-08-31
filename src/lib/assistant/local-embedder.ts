/**
 * Local open embedder — no paid AI API.
 * Character n-gram hashing into 384-d cosine space (same dim as MiniLM).
 * Swap implementation later for a licensed WASM MiniLM without changing storage.
 */
export const EMBEDDING_DIM = 384;
export const EMBEDDING_MODEL_ID = "ornexa-ngram-hash-v1";

function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function embedText(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIM);
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return Array.from(vec);

  const padded = ` ${normalized} `;
  for (let n = 2; n <= 4; n += 1) {
    for (let i = 0; i + n <= padded.length; i += 1) {
      const gram = padded.slice(i, i + n);
      const bucket = fnv1a(gram) % EMBEDDING_DIM;
      const sign = (fnv1a(`${gram}#`) & 1) === 0 ? 1 : -1;
      vec[bucket] += sign * (n === 3 ? 1.2 : 1);
    }
  }

  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i += 1) norm += vec[i] * vec[i];
  const scale = Math.sqrt(norm) || 1;
  const out = new Array<number>(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i += 1) out[i] = vec[i] / scale;
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0;
  for (const b of bytes) h = (Math.imul(h, 31) + b) | 0;
  return `fallback-${(h >>> 0).toString(16)}`;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) dot += a[i]! * b[i]!;
  return dot;
}
