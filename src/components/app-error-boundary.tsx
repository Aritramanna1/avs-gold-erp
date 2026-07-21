import { Component, useMemo, type ReactNode } from "react";
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

export function RouteErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const normalized = useMemo(() => reportUnexpectedError(error, "react.route-boundary"), [error]);

  return (
    <UniversalErrorScreen
      error={normalized}
      fullScreen={false}
      retryLabel="Try again"
      onRetry={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}
