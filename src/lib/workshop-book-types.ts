/**
 * Workshop — book-type registry.
 *
 * Workshop is a shelf of LEDGER BOOKS, not one screen. Today the only book
 * type implemented here is the Jeweller Book; tomorrow there may be Outside
 * Worker Books, Polishing Books, and other manufacturing books. Rather than
 * hard-wire the landing page to jeweller books, it renders whatever is
 * registered here — a new book type is a new entry in BOOK_TYPES plus its own
 * route, and nothing in the existing types changes.
 *
 * IMPORTANT — what does NOT belong here: the Karigar / Worker Gold Book is a
 * separate module with its own workflow and ledger logic. It is only *linked*
 * from Workshop (as an external module), never registered as a book type, and
 * this registry must not read or write its store. The same holds for Outside
 * Work and Polishing until they are deliberately migrated into a book type of
 * their own.
 */
import type { LucideIcon } from "lucide-react";
import { BookOpen, Truck, Sparkles, Users } from "lucide-react";

export interface WorkshopBookType {
  /** Stable key — also the segment under /workshop/… when it owns a route. */
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** The route that lists this book type's books. */
  indexRoute: string;
  /**
   * "implemented" — a first-class book type with its own list/detail here.
   * "section" — a ledger section that lives INSIDE Workshop (its own route
   *   under /workshop), not a separate module. Its ledger is part of Workshop.
   * "planned" — shown as a disabled shelf slot so the shape is visible, not built.
   */
  status: "implemented" | "section" | "planned";
  /** For "section"/"planned": one line on what it holds / when it lands. */
  note?: string;
}

/**
 * The shelf. Order is display order. Add a book type by appending an entry and
 * (for "implemented") giving it a route — no existing entry needs to change.
 */
export const BOOK_TYPES: WorkshopBookType[] = [
  {
    key: "jeweller",
    title: "Jeweller Books",
    description:
      "One ledger per client jeweller — gold received and issued, orders, job cards, manufacturing bills, settlements and a running gold/cash balance.",
    icon: BookOpen,
    indexRoute: "/workshop",
    status: "implemented",
  },
  {
    key: "worker",
    title: "Worker Books",
    description:
      "Read-only ledger of gold/materials issued to and returned by each worker, kept in their own purity. Transactions are entered in the Worker Gold Book module.",
    icon: Users,
    indexRoute: "/workshop/worker-books",
    status: "implemented",
  },
  {
    key: "outside-worker",
    title: "Outside Worker Books",
    description:
      "Read-only per-purity ledgers of gold sent to and returned by outside workers. Transactions are entered in the Outside Work module.",
    icon: Truck,
    indexRoute: "/workshop/outside-worker-books",
    status: "implemented",
  },
  {
    key: "polishing",
    title: "Polishing Books",
    description:
      "Read-only per-purity ledgers of gold sent to and returned by each polisher. Transactions are entered in the Polishing module.",
    icon: Sparkles,
    indexRoute: "/workshop/polishing-books",
    status: "implemented",
  },
];

export function implementedBookTypes(): WorkshopBookType[] {
  return BOOK_TYPES.filter((b) => b.status === "implemented");
}
