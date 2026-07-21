import { Component, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { LocalDbIntegrityError, clearLocalDatabase } from "@/lib/local-db";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface CardProps {
  error: Error;
  fullScreen: boolean;
  retryLabel: string;
  onRetry: () => void;
}

function ErrorCard({ error, fullScreen, retryLabel, onRetry }: CardProps) {
  const isDbCorruption = error instanceof LocalDbIntegrityError;
  return (
    <div
      className={
        fullScreen
          ? "min-h-screen flex items-center justify-center p-6 bg-background"
          : "flex items-center justify-center p-6"
      }
    >
      <div className="max-w-md w-full rounded-2xl border border-destructive/40 bg-card p-6 space-y-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
        <h1 className="text-lg font-bold">
          {fullScreen ? "Something went wrong" : "This page hit an error"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isDbCorruption
            ? "The local offline database on this device appears corrupted and can't be loaded safely. Data already synced to the server is not affected."
            : fullScreen
              ? "The application hit an unexpected error and can't continue."
              : "This page couldn't render. The rest of the app is unaffected."}
        </p>
        <p className="text-xs text-muted-foreground font-mono break-words">{error.message}</p>
        <div className="flex flex-col gap-2">
          <Button onClick={onRetry}>{retryLabel}</Button>
          {isDbCorruption && (
            <Button
              variant="destructive"
              onClick={async () => {
                await clearLocalDatabase();
                window.location.reload();
              }}
            >
              Reset Local Database & Reload
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface State {
  error: Error | null;
}

/**
 * App-level crash guard (main.tsx, wraps the whole RouterProvider). Without
 * this, an uncaught render error (most notably local-db.ts's
 * LocalDbIntegrityError on a corrupted local database) unmounts the whole
 * React tree with no recovery path — a blank white screen the operator
 * can't act on. Offers the actually-available recovery for a corrupted
 * local DB (wipe the encrypted local cache and restart fresh; nothing
 * already synced to Supabase is lost) rather than a generic reload that
 * would just crash again on the same bad data.
 *
 * For a single ROUTE's render error (as opposed to this catastrophic,
 * whole-app case), routes/__root.tsx wraps just `<Outlet/>` in TanStack
 * Router's own `<CatchBoundary>` + `RouteErrorFallback` below instead of
 * this class — that keeps the app shell (sidebar/header/nav) mounted and
 * gets a real per-navigation reset for free via `getResetKey`, which a
 * second instance of this class (holding its own local `error` state with
 * no way to know a navigation happened underneath it) can't provide.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[AppErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <ErrorCard
        error={error}
        fullScreen
        retryLabel="Reload"
        onRetry={() => window.location.reload()}
      />
    );
  }
}

/**
 * Per-route crash guard — pass as the `errorComponent` to TanStack Router's
 * `<CatchBoundary>` (see routes/__root.tsx). Same recovery options as
 * AppErrorBoundary, scaled down to fit inside the app shell's content area
 * instead of taking over the whole screen, since the shell around it is
 * still fully mounted and working.
 *
 * "Try again" calls router.invalidate() (TanStack Router's own match cache
 * doesn't self-heal after a route component throws synchronously during
 * render, unlike a loader/beforeLoad error — <Outlet/> keeps re-resolving
 * to the failed match and re-throwing the same error even after navigating
 * to a different path) together with reset() (which is what actually asks
 * <Outlet/> to try again against the now-fixed matches — invalidate() alone
 * isn't sufficient). Deliberately NOT automatic on catch/navigation: every
 * attempt at that (getResetKey alone, invalidate+reset from an effect, with
 * or without a retry-count/time throttle) was unreliable in testing, and a
 * naive automatic retry on a genuinely, permanently broken route reruns
 * invalidate+reset in an unthrottled loop (confirmed: 100+ retries/sec).
 * One manual click is a small, guaranteed-safe price for keeping the app
 * shell (sidebar/header/nav) alive and usable, which is the actual goal.
 */
export function RouteErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[RouteErrorFallback] Uncaught render error:", error);
  const router = useRouter();
  return (
    <ErrorCard
      error={error}
      fullScreen={false}
      retryLabel="Try again"
      onRetry={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}
