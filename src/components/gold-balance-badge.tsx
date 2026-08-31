import { Badge } from "@/components/ui/badge";
import { formatWeight } from "@/lib/gold";

/**
 * The one number a jeweller always asks for: is their gold with us, or do they
 * owe us gold? One balance with a side — never two columns to subtract in your
 * head at the bench.
 */
export function GoldBalanceBadge({ heldMg, owedMg }: { heldMg: number; owedMg: number }) {
  if (owedMg > 0) {
    return (
      <Badge variant="outline" className="border-red-500/40 text-red-300 font-mono">
        {formatWeight(owedMg)} owed to us
      </Badge>
    );
  }
  if (heldMg > 0) {
    return (
      <Badge variant="outline" className="border-gold/40 text-gold font-mono">
        {formatWeight(heldMg)} with us
      </Badge>
    );
  }
  return <span className="text-xs text-muted-foreground">Settled</span>;
}
