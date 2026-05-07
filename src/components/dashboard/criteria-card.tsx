"use client";

import * as React from "react";
import { Markdown } from "@/components/shared/markdown";
import { V1ScoreFormula } from "./score-formula";
import { fraunces } from "./fonts";
import { TIEBREAKER_LABELS } from "@/lib/constants";
import type { ScoringConfig } from "@/lib/scoring";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowUpRight } from "lucide-react";

export function V1CriteriaCard({
  rulesMarkdown,
  scoring,
}: {
  rulesMarkdown?: string;
  scoring: ScoringConfig;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <section aria-label="Rules and scoring" className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="v1-display text-[26px] font-medium">Formula</h2>
        {rulesMarkdown && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="v1-smallcaps text-[15px] inline-flex items-center gap-1.5 text-[color:var(--v1-ink-mute)] hover:text-[color:var(--v1-terracotta)] transition-colors whitespace-nowrap"
          >
            Read the rules
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="v1-rule" />
      <div className="space-y-4">
        <V1ScoreFormula config={scoring} />
        <div className="v1-rule-thin" />
        <p className="v1-display-italic text-[17px] leading-snug text-[color:var(--v1-ink-soft)]">
          Tiebreaker —{" "}
          <span className="text-[color:var(--v1-ink)]">
            {TIEBREAKER_LABELS[scoring.tiebreaker] ?? scoring.tiebreaker}
          </span>
        </p>
      </div>
      {rulesMarkdown && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className={`vibe-v1 ${fraunces.variable} sm:max-w-2xl max-h-[85vh] overflow-y-auto p-0 ring-0 rounded-2xl border border-black/15`}
            style={{
              backgroundColor: "oklch(0.975 0.020 80)",
              boxShadow:
                "0 32px 80px -16px rgba(20, 14, 8, 0.55), 0 12px 32px -10px rgba(20, 14, 8, 0.30)",
            }}
          >
            <DialogHeader className="px-7 py-5 border-b border-[color:var(--v1-rule-soft)]">
              <DialogTitle className="v1-display text-[26px] font-medium leading-tight text-[color:var(--v1-ink)]">
                Rules &amp; conditions
              </DialogTitle>
            </DialogHeader>
            <div className="px-7 pt-4 pb-6 text-[15px] leading-[1.65] text-[color:var(--v1-ink-soft)] [&_p]:mb-3 [&_strong]:text-[color:var(--v1-ink)] [&_strong]:font-semibold [&_h2]:v1-display [&_h2]:text-[22px] [&_h2]:font-medium [&_h2]:text-[color:var(--v1-ink)] [&_h2]:mt-6 [&_h2]:mb-3 [&_h2:first-child]:mt-0 [&_h3]:text-[12px] [&_h3]:uppercase [&_h3]:tracking-[0.14em] [&_h3]:font-semibold [&_h3]:text-[color:var(--v1-ink-mute)] [&_h3]:mt-5 [&_h3]:mb-2 [&_h3:first-child]:mt-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_li]:leading-[1.6] [&>*:first-child]:mt-0">
              <Markdown source={rulesMarkdown} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
