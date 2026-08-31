/**
 * Supabase's functions.invoke() surfaces a generic "Edge Function returned a
 * non-2xx status code" message on FunctionsHttpError, discarding the actual
 * JSON error body the function returned. The real message lives on
 * `error.context`, a fetch Response — this reads it back out.
 */
export async function extractEdgeFunctionError(error: unknown, fallback?: string): Promise<string> {
  const genericFallback = fallback ?? "The request failed. Please try again.";
  if (!error || typeof error !== "object") return genericFallback;

  const context = (error as { context?: unknown }).context;
  if (context && typeof context === "object" && "json" in context) {
    try {
      const body = await (context as Response).clone().json();
      if (body && typeof body === "object" && typeof body.error === "string") {
        return body.error;
      }
    } catch {
      // Body wasn't JSON or already consumed — fall through to the message below.
    }
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : genericFallback;
}
