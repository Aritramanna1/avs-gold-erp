import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("mb-3", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 ? <ChevronRight className="h-3 w-3 opacity-50" aria-hidden /> : null}
              <li>
                {item.href && !isLast ? (
                  <Link
                    to={item.href as never}
                    className="hover:text-foreground transition-colors min-h-[var(--touch-target)] sm:min-h-0 inline-flex items-center"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={cn(isLast && "text-foreground font-medium")}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
