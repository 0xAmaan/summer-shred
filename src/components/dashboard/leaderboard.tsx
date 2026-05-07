"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { ParticipantAvatar } from "@/components/shared/avatar";
import { V1RankBadge } from "./rank-badge";
import type { DashRow } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

function fmtScore(n: number, scorable: boolean): string {
  if (!scorable) return "—";
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;
}

function fmtPct(n: number | null, signed = true): string {
  if (n === null) return "—";
  if (signed) {
    return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`;
  }
  return `${n.toFixed(1)}%`;
}

function fmtLb(n: number | null): string {
  if (n === null) return "—";
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)} lb`;
}

export function V1Leaderboard({ rows }: { rows: DashRow[] }) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="v1-display text-[26px] font-medium">Standings</h2>
        <span className="v1-smallcaps">{rows.length} entrants</span>
      </div>
      <div className="v1-rule" />
      <ol className="divide-y divide-[color:var(--v1-rule-soft)]">
        {rows.map((r) => {
          const open = expanded.has(r.challengeParticipantId);
          const winner = r.rank === 1;
          return (
            <li key={r.challengeParticipantId}>
              <button
                type="button"
                onClick={() => toggle(r.challengeParticipantId)}
                className="w-full py-4 text-left transition-colors hover:bg-[color:var(--v1-cream-deep)]/40 px-1 -mx-1 rounded-sm"
              >
                <div className="grid grid-cols-[2.5rem_2rem_1fr_auto_1.25rem] items-center gap-4">
                  <span className="v1-display v1-onum text-[24px] text-[color:var(--v1-ink-mute)] font-medium leading-none">
                    {r.rank ?? "—"}
                  </span>
                  <ParticipantAvatar
                    name={r.participantName}
                    color={r.participantColor}
                    size="md"
                  />
                  <div className="min-w-0 flex items-center gap-3">
                    <span
                      className="v1-display text-[20px] leading-none font-medium truncate"
                      style={{
                        color: winner
                          ? "var(--v1-terracotta)"
                          : "var(--v1-ink)",
                      }}
                    >
                      {r.participantName}
                    </span>
                    <V1RankBadge rank={r.rank} />
                    {r.withdrew && (
                      <span className="v1-display-italic text-[13px] text-[color:var(--v1-ink-mute)]">
                        withdrew
                      </span>
                    )}
                  </div>
                  <span
                    className="v1-display v1-onum text-[28px] leading-none font-medium tabular-nums"
                    style={{
                      color: !r.scorable
                        ? "var(--v1-ink-mute)"
                        : r.score > 0
                          ? "var(--v1-ink)"
                          : r.score < 0
                            ? "var(--v1-clay)"
                            : "var(--v1-ink)",
                    }}
                  >
                    {fmtScore(r.score, r.scorable)}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-[color:var(--v1-ink-mute)] transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </div>
              </button>
              {open && (
                <div className="pb-5 pt-1 pl-[3.5rem] pr-1">
                  {!r.scorable ? (
                    <p className="v1-display-italic text-[14px] text-[color:var(--v1-ink-mute)]">
                      {r.breakdown.missingMetrics.length > 0
                        ? `Cannot score — missing ${r.breakdown.missingMetrics.join(", ")}.`
                        : "Awaiting end scan."}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-6">
                        <ChangeCell
                          label="Fat"
                          pct={r.breakdown.fatChangePct}
                          lb={r.breakdown.fatChangeLb}
                          good="down"
                        />
                        <ChangeCell
                          label="Lean"
                          pct={r.breakdown.leanChangePct}
                          lb={r.breakdown.leanChangeLb}
                          good="up"
                        />
                        <ChangeCell
                          label="ALM"
                          pct={r.breakdown.almChangePct}
                          lb={r.breakdown.almChangeLb}
                          good="up"
                        />
                      </div>
                      {r.breakdown.contributions.length > 0 && (
                        <div className="space-y-2">
                          <p className="v1-smallcaps text-[12px]">
                            Score breakdown
                          </p>
                          <table className="w-full text-[14px] v1-tnum">
                            <tbody>
                              {r.breakdown.contributions.map((c, i) => (
                                <tr
                                  key={i}
                                  className="border-t border-[color:var(--v1-rule-soft)]"
                                >
                                  <td className="py-1.5 v1-display-italic text-[color:var(--v1-ink-soft)]">
                                    {c.coefficient}
                                    <span className="px-1 text-[color:var(--v1-ink-mute)]">·</span>
                                    {c.label}
                                  </td>
                                  <td className="py-1.5 text-right text-[color:var(--v1-ink-mute)]">
                                    {c.pct.toFixed(1)}%
                                  </td>
                                  <td
                                    className="py-1.5 text-right font-medium"
                                    style={{
                                      color:
                                        c.signedPoints >= 0
                                          ? "var(--v1-ink)"
                                          : "var(--v1-clay)",
                                    }}
                                  >
                                    {c.signedPoints >= 0 ? "+" : "−"}
                                    {Math.abs(c.signedPoints).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ChangeCell({
  label,
  pct,
  lb,
  good,
}: {
  label: string;
  pct: number | null;
  lb: number | null;
  good: "up" | "down";
}) {
  const isGood =
    pct === null ? null : good === "up" ? pct > 0 : pct < 0;
  const tone =
    isGood === true
      ? "var(--v1-sage)"
      : isGood === false
        ? "var(--v1-clay)"
        : "var(--v1-ink-mute)";
  return (
    <div className="space-y-1">
      <p className="v1-smallcaps text-[12px]">{label}</p>
      <p
        className="v1-display v1-onum text-[22px] leading-none font-medium"
        style={{ color: tone }}
      >
        {fmtPct(pct)}
      </p>
      <p className="v1-display-italic text-[13px] text-[color:var(--v1-ink-mute)] v1-tnum">
        {fmtLb(lb)}
      </p>
    </div>
  );
}
