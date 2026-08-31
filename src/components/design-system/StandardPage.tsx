import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageHeader, type PageHeaderProps } from "./PageHeader";

export interface StandardPageProps extends PageHeaderProps {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}

const widthMap = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
};

/** Canonical operational page shell — dense ERP layout with design-system header. */
export function StandardPage({
  children,
  maxWidth = "lg",
  className,
  ...headerProps
}: StandardPageProps) {
  return (
    <div className={cn("p-4 md:p-8 mx-auto space-y-6", widthMap[maxWidth], className)}>
      <PageHeader {...headerProps} />
      {children}
    </div>
  );
}
