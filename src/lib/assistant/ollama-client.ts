/**
 * Optional desktop loopback Ollama — still local-only (never AVS ERP cloud LLM).
 * Disabled unless VITE_OLLAMA_BASE_URL is set. Never used for gold/accounting math.
 * Production Assistant path defaults to Deterministic Layer-1; Ollama is optional narrative fallback.
 */
export function isOllamaEnabled(): boolean {
  const base = String(import.meta.env.VITE_OLLAMA_BASE_URL ?? "").trim();
  return base.length > 0;
}

export function getOllamaBaseUrl(): string | null {
  const base = String(import.meta.env.VITE_OLLAMA_BASE_URL ?? "").trim();
  return base ? base.replace(/\/$/, "") : null;
}

export function getOllamaModel(): string {
  return String(import.meta.env.VITE_OLLAMA_MODEL ?? "llama3.2").trim() || "llama3.2";
}

export async function completeWithOllama(params: {
  system: string;
  user: string;
  signal?: AbortSignal;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const base = getOllamaBaseUrl();
  if (!base) {
    return { ok: false, error: "Ollama is not configured (set VITE_OLLAMA_BASE_URL)." };
  }

  // Safety: only allow loopback / private hosts — never public cloud LLM endpoints
  try {
    const host = new URL(base).hostname;
    const local =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local");
    if (!local) {
      return {
        ok: false,
        error: "Ollama base URL must be a local loopback host (local-only Assistant policy).",
      };
    }
  } catch {
    return { ok: false, error: "Invalid Ollama base URL." };
  }

  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: params.signal,
      body: JSON.stringify({
        model: getOllamaModel(),
        stream: false,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `Ollama HTTP ${res.status}` };
    }
    const body = (await res.json()) as { message?: { content?: string } };
    const text = body.message?.content?.trim();
    if (!text) return { ok: false, error: "Empty Ollama response" };
    return { ok: true, text };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ollama request failed",
    };
  }
}
