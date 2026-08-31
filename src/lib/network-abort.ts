/** Detect fetch/sign-in aborts and timeouts for user-friendly retry messaging. */

export function isAbortLikeError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "object") {
    const err = error as { name?: string; message?: string; code?: string };
    const haystack = `${err.name ?? ""} ${err.message ?? ""} ${err.code ?? ""}`.toLowerCase();
    if (
      err.name === "AbortError" ||
      err.name === "TimeoutError" ||
      haystack.includes("aborterror") ||
      haystack.includes("timeouterror") ||
      haystack.includes("fetch is aborted") ||
      haystack.includes("the user aborted") ||
      haystack.includes("signal is aborted") ||
      haystack.includes("timed out")
    ) {
      return true;
    }
  }

  if (typeof error === "string") {
    const haystack = error.toLowerCase();
    return haystack.includes("abort") || haystack.includes("timed out");
  }

  return false;
}

export function abortFriendlyMessage(): string {
  return "Connection was interrupted. Please try again.";
}
