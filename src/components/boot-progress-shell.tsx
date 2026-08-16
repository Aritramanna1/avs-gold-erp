import { AppBootSkeleton } from "@/components/app-boot-skeleton";
import { StagedLoadPanel } from "@/components/staged-load-panel";
import { useStagedLoad } from "@/hooks/use-staged-load";

interface BootProgressShellProps {
  title?: string;
  failed?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}

/**
 * Session / platform boot placeholder with staged slow-connection messaging.
 */
export function BootProgressShell({
  title = "Starting Ornexa",
  failed = false,
  errorMessage,
  onRetry,
}: BootProgressShellProps) {
  const staged = useStagedLoad({ active: !failed, failed, done: false });

  return (
    <div className="relative h-screen w-full">
      <AppBootSkeleton />
      <div className="absolute inset-x-0 bottom-8 z-20 flex justify-center px-4">
        <div className="w-full max-w-lg">
          {failed ? (
            <StagedLoadPanel
              phase="failed"
              title={title}
              onRetry={onRetry}
              onGoHome={() => {
                window.location.href = "/";
              }}
              onReportIssue={() => {
                window.location.href = "/settings/support";
              }}
            />
          ) : staged.phase !== "loading" ? (
            <StagedLoadPanel phase={staged.phase} title={title} onRetry={onRetry} />
          ) : null}
          {errorMessage ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">{errorMessage}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
