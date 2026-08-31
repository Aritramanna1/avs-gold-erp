import * as React from "react";
import { Input } from "@/components/ui/input";
import { sanitizeDecimalTyping } from "@/lib/decimal-input";
import { cn } from "@/lib/utils";

type DecimalInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: string;
  onChange: (value: string) => void;
  /** When true, strip non-numeric characters on each keystroke. Default true. */
  sanitize?: boolean;
};

/**
 * Controlled decimal text field — preserves empty string while the user clears input.
 * Prefer this over type="number" + numeric state for gold weights across the ERP.
 */
export function DecimalInput({
  value,
  onChange,
  sanitize = true,
  className,
  ...props
}: DecimalInputProps) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cn("font-mono tabular-nums", className)}
      {...props}
      value={value}
      onChange={(e) => {
        const next = sanitize ? sanitizeDecimalTyping(e.target.value) : e.target.value;
        onChange(next);
      }}
    />
  );
}
