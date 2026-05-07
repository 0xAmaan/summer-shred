"use client";

import { type ScoringConfig, type ScoringWeights } from "@/lib/scoring";
import { cn } from "@/lib/utils";

const TERM_LABELS: Record<keyof ScoringWeights, string> = {
  fatLossPct: "%FatLost",
  leanGainPct: "%LeanGained",
  almGainPct: "%ALMGained",
  leanLossPct: "%LeanLost",
  fatGainPct: "%FatGained",
  almLossPct: "%ALMLost",
};

const TERM_ORDER: (keyof ScoringWeights)[] = [
  "fatLossPct",
  "leanGainPct",
  "almGainPct",
  "leanLossPct",
  "fatGainPct",
  "almLossPct",
];

const POSITIVE: Record<keyof ScoringWeights, boolean> = {
  fatLossPct: true,
  leanGainPct: true,
  almGainPct: true,
  leanLossPct: false,
  fatGainPct: false,
  almLossPct: false,
};

export function ScoreFormula({
  config,
  className,
}: {
  config: ScoringConfig;
  className?: string;
}) {
  const terms = TERM_ORDER.filter((k) => config.weights[k] !== 0);
  if (terms.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No formula configured.
      </div>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-sm font-medium text-foreground">Score =</span>
      {terms.map((k, i) => {
        const positive = POSITIVE[k];
        const sign = i === 0 ? (positive ? "" : "−") : positive ? "+" : "−";
        return (
          <div key={k} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-sm text-muted-foreground">{sign}</span>}
            {i === 0 && !positive && (
              <span className="text-sm text-muted-foreground">{sign}</span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                positive
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
              )}
            >
              <span className="font-mono font-semibold">{config.weights[k]}</span>
              <span className="opacity-60">·</span>
              <span>{TERM_LABELS[k]}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
