import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { reportUnexpectedError, showErrorToast } from "./lib/error-handling";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
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
  defaultPreloadStaleTime: 0,
  history: isFileProtocol ? createHashHistory() : undefined,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
