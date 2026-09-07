import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Receipt,
  UserPlus,
  Hammer,
  PackagePlus,
  TrendingDown,
  FlameKindling,
  ChevronDown,
} from "lucide-react";

export function UniversalActionMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full bg-gold text-black hover:bg-gold/90 px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 focus:outline-none"
          title="Quick Actions & Create"
          aria-label="Create new item or record"
          id="universal-action-trigger"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span className="hidden sm:inline">New</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5 bg-card/95 backdrop-blur-md border-border shadow-xl">
        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
          Retail Actions
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link
            to="/billing/new"
            className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-md hover:bg-gold/10 hover:text-gold transition-colors"
          >
            <Receipt className="h-4 w-4 text-gold shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-foreground">New Sale / Bill</div>
              <div className="text-[10px] text-muted-foreground">Estimate, retail or tax bill</div>
            </div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            to="/people"
            search={{ tab: "customers" }}
            className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-md hover:bg-gold/10 hover:text-gold transition-colors"
          >
            <UserPlus className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-foreground">Add Customer</div>
              <div className="text-[10px] text-muted-foreground">Register customer or party</div>
            </div>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
          Workshop Actions
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link
            to="/workshop/outside-work"
            className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-md hover:bg-gold/10 hover:text-gold transition-colors"
          >
            <Hammer className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-foreground">Karigar Issue / Receive</div>
              <div className="text-[10px] text-muted-foreground">Issue bullion & receive ornaments</div>
            </div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            to="/orders"
            className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-md hover:bg-gold/10 hover:text-gold transition-colors"
          >
            <FlameKindling className="h-4 w-4 text-orange-500 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-foreground">Create Job Card</div>
              <div className="text-[10px] text-muted-foreground">New custom order production</div>
            </div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            to="/stock"
            className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-md hover:bg-gold/10 hover:text-gold transition-colors"
          >
            <PackagePlus className="h-4 w-4 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-foreground">Add Stock / Barcode</div>
              <div className="text-[10px] text-muted-foreground">Inward ready jewellery</div>
            </div>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
          Finance Actions
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link
            to="/expenses"
            search={{ tab: "vouchers" } as any}
            className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-md hover:bg-gold/10 hover:text-gold transition-colors"
          >
            <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-foreground">Record Expense</div>
              <div className="text-[10px] text-muted-foreground">Petty cash & shop drawings</div>
            </div>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
