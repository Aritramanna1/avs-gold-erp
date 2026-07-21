import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAttachmentUrl } from "@/lib/attachments-store";
import { formatWeight } from "@/lib/gold";
import { BookOpen, CalendarClock, ChevronRight, User } from "lucide-react";

/**
 * A book's summary metrics for the card face. Weights are integer mg; the card
 * formats them. `balanceSide` drives the ledger-status pill.
 */
export interface BookCardMetrics {
  receivedMg: number;
  issuedMg: number;
  outstandingMg: number;
  balanceMg: number;
  lastTs: number;
  /** Ledger-status pill text — context-worded by the caller (jeweller vs worker). */
  statusLabel: string;
  statusTone: "held" | "owed" | "settled";
}

export interface BookCardData {
  id: string;
  title: string;
  subtitle: string;
  /** People-module person id for the avatar photo; omit for non-person parties. */
  personId?: string;
  icon: LucideIcon;
  metrics: BookCardMetrics;
}

const TONE_CLS: Record<BookCardMetrics["statusTone"], string> = {
  owed: "bg-red-500/15 text-red-300 border-red-500/40",
  held: "bg-gold/15 text-gold border-gold/40",
  settled: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
};

/**
 * A People-style ledger book card. Single click selects (highlights); double
 * click or the Open button opens the full book. Shows manufacturing metrics
 * instead of People's phone/KYC.
 */
export function BookCard({
  data,
  selected,
  onSelect,
  onOpen,
}: {
  data: BookCardData;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const photoUrl = useAttachmentUrl("person", data.personId ?? "", "photo");
  const Icon = data.icon;

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={`cursor-pointer rounded-2xl border bg-card p-4 transition-all ${
        selected ? "border-gold shadow-gold" : "border-border hover:border-gold/40"
      }`}
      data-testid="book-card"
    >
      <div className="flex items-start gap-3">
        {/* Avatar — worker/jeweller photo from People, else a book icon. */}
        <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden border border-border bg-muted/40 grid place-items-center">
          {photoUrl ? (
            <img src={photoUrl} alt={data.title} className="h-full w-full object-cover" />
          ) : data.personId ? (
            <User className="h-6 w-6 text-muted-foreground" />
          ) : (
            <Icon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{data.title}</span>
            <Badge variant="secondary" className="text-[10px]">
              {data.subtitle}
            </Badge>
            <Badge variant="outline" className={`text-[10px] ${TONE_CLS[data.metrics.statusTone]}`}>
              {data.metrics.statusLabel}
            </Badge>
          </div>

          {/* Manufacturing metrics — the People phone/KYC row's replacement. */}
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-xs">
            <Metric k="Gold Received" v={formatWeight(data.metrics.receivedMg)} />
            <Metric k="Gold Issued" v={formatWeight(data.metrics.issuedMg)} />
            <Metric k="Outstanding" v={formatWeight(data.metrics.outstandingMg)} />
            <Metric
              k="Current Balance"
              v={formatWeight(Math.abs(data.metrics.balanceMg))}
              tone="gold"
            />
          </div>

          <div className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {data.metrics.lastTs
              ? `Last transaction ${new Date(data.metrics.lastTs).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}`
              : "No transactions yet"}
          </div>
        </div>

        <div className="shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            data-testid="book-card-open"
          >
            <BookOpen className="h-3.5 w-3.5" /> Open <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Metric({ k, v, tone }: { k: string; v: string; tone?: "gold" }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={`font-mono ${tone === "gold" ? "text-gold" : ""}`}>{v}</div>
    </div>
  );
}
