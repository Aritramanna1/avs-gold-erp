import { PrintFooter } from "./print/PrintFooter";

/**
 * Reusable Footer Credit delegator.
 * Delegates to the unified print directory component to guarantee consistent behavior.
 */
export function AvsPrintFooter({ className = "" }: { className?: string }) {
  return <PrintFooter className={className} />;
}
