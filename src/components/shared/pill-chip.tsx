import * as React from "react";
import { cn } from "@/lib/utils";

type PillTone =
  | "default"
  | "summary"
  | "productive"
  | "necessary"
  | "recovery"
  | "waste"
  | "calories"
  | "protein"
  | "carbs"
  | "fat";

const toneStyles: Record<PillTone, string> = {
  default: "",
  summary:
    "bg-[var(--tint-summary)] text-[var(--tint-summary-fg)] border-[var(--tint-summary)]",
  productive:
    "bg-[var(--tint-productive)] text-[var(--tint-productive-fg)] border-[var(--tint-productive)]",
  necessary:
    "bg-[var(--tint-necessary)] text-[var(--tint-necessary-fg)] border-[var(--tint-necessary)]",
  recovery:
    "bg-[var(--tint-recovery)] text-[var(--tint-recovery-fg)] border-[var(--tint-recovery)]",
  waste:
    "bg-[var(--tint-waste)] text-[var(--tint-waste-fg)] border-[var(--tint-waste)]",
  calories:
    "text-[var(--macro-calories)] border-[color-mix(in_oklch,var(--macro-calories)_35%,transparent)]",
  protein:
    "text-[var(--macro-protein)] border-[color-mix(in_oklch,var(--macro-protein)_35%,transparent)]",
  carbs:
    "text-[var(--macro-carbs)] border-[color-mix(in_oklch,var(--macro-carbs)_45%,transparent)]",
  fat:
    "text-[var(--macro-fat)] border-[color-mix(in_oklch,var(--macro-fat)_40%,transparent)]",
};

interface PillChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon?: React.ReactNode;
  tone?: PillTone;
  size?: "sm" | "md";
}

export function PillChip({
  icon,
  tone = "default",
  size = "sm",
  className,
  children,
  ...props
}: PillChipProps) {
  return (
    <span
      className={cn(
        size === "md" ? "pill-chip-lg" : "pill-chip",
        toneStyles[tone],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
