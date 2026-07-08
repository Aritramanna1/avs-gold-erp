import { Component, type ReactNode } from "react";
import { LocalDbIntegrityError, clearLocalDatabase } from "@/lib/local-db";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface State {
  error: Error | null;
}

/**
 * Root-level crash guard. Without this, an uncaught render error (most
 * notably local-db.ts's LocalDbIntegrityError on a corrupted local
 * database) unmounts the whole React tree with no recovery path — a blank
 * white screen the operator can't act on. Offers the actually-available
 * recovery for a corrupted local DB (wipe the encrypted local cache and
 * restart fresh; nothing already synced to Supabase is lost) rather than
 * a generic "reload" that would just crash again on the same bad data.
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

    const isDbCorruption = error instanceof LocalDbIntegrityError;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-2xl border border-destructive/40 bg-card p-6 space-y-4 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-lg font-bold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            {isDbCorruption
              ? "The local offline database on this device appears corrupted and can't be loaded safely. Data already synced to the server is not affected."
              : "The application hit an unexpected error and can't continue."}
          </p>
          <p className="text-xs text-muted-foreground font-mono break-words">{error.message}</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
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
}
