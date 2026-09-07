/**
 * AVS ERP — "What Should I Do Next?" Action Guidance Banner
 *
 * Implements the core usability principle: every important screen makes the
 * next immediate action obvious and intuitive for non-technical users.
 */

import React from "react";
import { ArrowRight, Sparkles, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface StepItem {
  number: number;
  label: string;
  isCurrent?: boolean;
  isCompleted?: boolean;
}

export interface NextActionBannerProps {
  currentTaskTitle: string;
  nextStepDescription: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  primaryActionIcon?: React.ReactNode;
  keyboardShortcut?: string;
  steps?: StepItem[];
  variant?: "default" | "gold" | "success";
  className?: string;
}

export const NextActionBanner: React.FC<NextActionBannerProps> = ({
  currentTaskTitle,
  nextStepDescription,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionIcon,
  keyboardShortcut,
  steps,
  variant = "default",
  className = "",
}) => {
  const bgClass =
    variant === "gold"
      ? "bg-gold/10 border-gold/30 text-foreground"
      : variant === "success"
      ? "bg-emerald-500/10 border-emerald-500/30 text-foreground"
      : "bg-card/70 border-border/80 text-foreground";

  return (
    <div
      className={`rounded-xl border p-4 mb-5 shadow-sm backdrop-blur-sm transition-all ${bgClass} ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> {currentTaskTitle}
            </span>
            {keyboardShortcut && (
              <kbd className="hidden sm:inline-flex items-center rounded border bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {keyboardShortcut}
              </kbd>
            )}
          </div>

          <div className="text-sm font-medium text-foreground">
            {nextStepDescription}
          </div>

          {/* Optional multi-step trail */}
          {steps && steps.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-xs">
              {steps.map((s, idx) => (
                <React.Fragment key={s.number}>
                  <div
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      s.isCurrent
                        ? "bg-primary text-primary-foreground font-semibold"
                        : s.isCompleted
                        ? "bg-muted text-muted-foreground line-through opacity-80"
                        : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {s.isCompleted ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <span>{s.number}.</span>
                    )}
                    <span>{s.label}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center shrink-0">
          <Button
            size="sm"
            onClick={onPrimaryAction}
            className="h-9 px-4 font-semibold shadow-sm gap-2 w-full sm:w-auto"
          >
            {primaryActionIcon}
            <span>{primaryActionLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
