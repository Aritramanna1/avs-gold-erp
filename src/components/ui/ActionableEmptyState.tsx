/**
 * AVS ERP — Actionable Empty State Component
 *
 * Replaces vague "No data" screens with encouraging, actionable empty states
 * that guide the user directly to the next creation step.
 */

import React from "react";
import { Plus, Package, Users, ShoppingCart, Hammer, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ActionableEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: "stock" | "customer" | "sales" | "karigar" | "reports" | "default";
  className?: string;
}

export const ActionableEmptyState: React.FC<ActionableEmptyStateProps> = ({
  icon,
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = "default",
  className = "",
}) => {
  const resolvedLabel = primaryActionLabel || actionLabel || "Get Started";
  const resolvedAction = onPrimaryAction || onAction || (() => {});
  const defaultIcon = () => {
    switch (variant) {
      case "stock":
        return <Package className="h-8 w-8 text-gold" />;
      case "customer":
        return <Users className="h-8 w-8 text-blue-500" />;
      case "sales":
        return <ShoppingCart className="h-8 w-8 text-emerald-500" />;
      case "karigar":
        return <Hammer className="h-8 w-8 text-amber-500" />;
      case "reports":
        return <FileText className="h-8 w-8 text-purple-500" />;
      default:
        return <Plus className="h-8 w-8 text-primary" />;
    }
  };

  return (
    <div
      className={`rounded-2xl border-2 border-dashed border-border/80 p-8 md:p-12 text-center bg-card/40 backdrop-blur-sm max-w-lg mx-auto my-6 space-y-4 ${className}`}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 shadow-inner">
        {icon || defaultIcon()}
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
        <Button
          onClick={onPrimaryAction}
          className="w-full sm:w-auto h-10 px-5 font-semibold gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>{primaryActionLabel}</span>
        </Button>

        {secondaryActionLabel && onSecondaryAction && (
          <Button
            variant="outline"
            onClick={onSecondaryAction}
            className="w-full sm:w-auto h-10 px-4 text-xs text-muted-foreground hover:text-foreground"
          >
            <span>{secondaryActionLabel}</span>
          </Button>
        )}
      </div>
    </div>
  );
};
