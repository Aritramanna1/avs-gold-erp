import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerGoldRateEditor } from "@/components/app-shell";
import { listAttentionItems, type AttentionItem } from "@/lib/attention/list-attention-items";
import { useCurrentGoldRatePaise } from "@/lib/bullion-rate-service";

function AttentionRow({ item }: { item: AttentionItem }) {
  if (item.kind === "RATE") {
    return (
      <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2.5 min-h-[48px]">
        <span className="text-sm font-medium">{item.title}</span>
        <Button
          size="sm"
          className="bg-gold hover:bg-gold/90 text-black font-medium shrink-0 min-h-[48px] sm:min-h-0"
          onClick={() => triggerGoldRateEditor()}
        >
          {item.fixLabel ?? "Open"}
        </Button>
      </li>
    );
  }

  return (
    <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2.5 min-h-[48px]">
      <span className="text-sm font-medium">{item.title}</span>
      <Link
        to={item.href as any}
        className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium hover:border-gold/40 min-h-[48px] sm:min-h-0"
      >
        {item.fixLabel ?? "Open"}
      </Link>
    </li>
  );
}

/** Optional Home teaser — calls thin listAttentionItems (rate-missing today). */
export function HomeNeedsAttention() {
  // Recompute when rate changes (settings/bullion store).
  const ratePaise = useCurrentGoldRatePaise();
  const items = useMemo(() => listAttentionItems().items, [ratePaise]);

  if (items.length === 0) return null;

  return (
    <section className="mb-6" aria-labelledby="home-needs-attention-heading" data-tour="home-needs-attention">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
        <h2 id="home-needs-attention-heading" className="erp-section-title mb-0">
          Needs attention
        </h2>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <AttentionRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
