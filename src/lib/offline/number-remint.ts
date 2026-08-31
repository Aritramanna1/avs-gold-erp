/**
 * Legal document numbers are reserved in Supabase (`next_document_number`).
 * Offline drafts use a provisional local id. On sync, reserve a server number.
 * If insert hits a duplicate/unique conflict, remint a *new* server number and
 * retry. Never rewrite a number that already exists as a synced cloud row.
 */

export function isNumberConflictMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("conflict") ||
    m.includes("duplicate") ||
    m.includes("unique") ||
    m.includes("already exists") ||
    m.includes("already used") ||
    m.includes("already been taken")
  );
}

export async function retryOnNumberConflict<T>(
  run: (attempt: number) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await run(attempt);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!isNumberConflictMessage(msg) || attempt === maxAttempts - 1) {
        throw err;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
