import { Component, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";

import { UniversalErrorScreen } from "@/components/universal-error-screen";
import {
  normalizeError,
  reportUnexpectedError,
  type NormalizedAppError,
} from "@/lib/error-handling";

interface State {
  error: NormalizedAppError | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error: normalizeError(error, "react.app-boundary") };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.setState({
      error: reportUnexpectedError(
        new Error(`${error.message}\n\nComponent stack:\n${info.componentStack}`),
        "react.app-boundary",
      ),
    });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <UniversalErrorScreen
        error={error}
        fullScreen
        retryLabel="Reload"
        onRetry={() => window.location.reload()}
      />
    );
  }
}

function isDynamicImportError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Importing a module script failed")
  );
}

export function RouteErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const reportedKey = useRef<string | null>(null);
  const normalized = useMemo(() => normalizeError(error, "react.route-boundary"), [error]);

  useEffect(() => {
    if (typeof window !== "undefined" && isDynamicImportError(error)) {
      const reloadKey = `mtj_chunk_reload_${window.location.pathname}`;
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 10000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
        return;
      }
    }
    const key = `${error.name}:${error.message}`;
    if (reportedKey.current === key) return;
    reportedKey.current = key;
    reportUnexpectedError(error, "react.route-boundary");
  }, [error]);

  return (
    <UniversalErrorScreen
      error={normalized}
      fullScreen={false}
      retryLabel="Try again"
      onRetry={() => {
        if (isDynamicImportError(error)) {
          window.location.reload();
          return;
        }
        router.invalidate();
        reset();
      }}
    />
  );
}
