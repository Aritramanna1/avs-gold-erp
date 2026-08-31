import { Component, type ReactNode } from "react";
import { StagedLoadPanel } from "@/components/staged-load-panel";
import { logAppError, normalizeError } from "@/lib/error-handling";

interface State {
  errorId: string | null;
  message: string;
}

/**
 * Isolates a dashboard widget / panel so one failed query cannot crash the page.
 */
export class WidgetErrorBoundary extends Component<
  { children: ReactNode; title?: string; onRetry?: () => void },
  State
> {
  state: State = { errorId: null, message: "" };

  static getDerivedStateFromError(error: Error): State {
    const normalized = normalizeError(error, "widget.boundary");
    return { errorId: normalized.id, message: normalized.message };
  }

  componentDidCatch(error: Error) {
    logAppError(normalizeError(error, "widget.boundary"));
  }

  render() {
    if (!this.state.errorId) return this.props.children;
    return (
      <StagedLoadPanel
        phase="failed"
        title={this.props.title ?? "This section could not load"}
        compact
        onRetry={() => {
          this.setState({ errorId: null, message: "" });
          this.props.onRetry?.();
        }}
        onReportIssue={() => {
          window.location.href = `/settings/support?subject=${encodeURIComponent(
            `Widget error ${this.state.errorId}`,
          )}`;
        }}
      />
    );
  }
}
