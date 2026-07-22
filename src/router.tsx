import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
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

export const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
