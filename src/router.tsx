import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { reportUnexpectedError, showErrorToast } from "./lib/error-handling";
import { registerTenantQueryClient } from "./lib/identity/tenant-context-store";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // #region agent log
      fetch("http://127.0.0.1:7392/ingest/d117bcf7-cdbf-4990-9937-fb01ef1c6a78", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "093a7b" },
        body: JSON.stringify({
          sessionId: "093a7b",
          hypothesisId: "H1",
          location: "router.tsx:queryCache.onError",
          message: "react-query error",
          data: {
            queryHash: query.queryHash,
            errorMessage: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      const normalized = reportUnexpectedError(error, `react-query.query:${query.queryHash}`);
      showErrorToast(normalized);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const normalized = reportUnexpectedError(
        error,
        `react-query.mutation:${mutation.options.mutationKey?.join(".") ?? "anonymous"}`,
      );
      showErrorToast(normalized);
    },
  }),
});

registerTenantQueryClient(queryClient);

// Packaged Electron loads index.html over the file:// protocol, where
// location.pathname is the document's full filesystem path rather than "/".
// Browser (pushState) history can't match that path against the route tree,
// so every launch 404s. Hash-based history keeps routing state after a "#"
// fragment, which is independent of the file:// path entirely.
const isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:";

export const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 60_000,
  defaultPreload: "intent",
  history: isFileProtocol ? createHashHistory() : undefined,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
