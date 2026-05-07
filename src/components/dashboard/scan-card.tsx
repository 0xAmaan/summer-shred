import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";
import { ParticipantAvatar } from "@/components/shared/avatar";
import { V1RankBadge } from "./rank-badge";
import type { ScanLite } from "@/lib/dashboard-data";
import type { ScoringConfig } from "@/lib/scoring";
import { cn } from "@/lib/utils";

type MetricKey =
  | "totalMassLb"
  | "fatMassLb"
  | "leanMassLb"
  | "armsLeanLb"
  | "legsLeanLb"
  | "almLb"
  | "bodyFatPct"
  | "bmd";

interface MetricMeta {
  key: MetricKey;
  label: string;
  unit: string;
  decimals: number;
  goodDirection: "up" | "down" | "neutral";
}

const METRICS: Record<MetricKey, MetricMeta> = {
  totalMassLb: { key: "totalMassLb", label: "Total mass", unit: "lb", decimals: 1, goodDirection: "neutral" },
  fatMassLb:   { key: "fatMassLb",   label: "Fat mass",   unit: "lb", decimals: 1, goodDirection: "down" },
  leanMassLb:  { key: "leanMassLb",  label: "Lean mass",  unit: "lb", decimals: 1, goodDirection: "up" },
  armsLeanLb:  { key: "armsLeanLb",  label: "Arms lean",  unit: "lb", decimals: 1, goodDirection: "up" },
  legsLeanLb:  { key: "legsLeanLb",  label: "Legs lean",  unit: "lb", decimals: 1, goodDirection: "up" },
  almLb:       { key: "almLb",       label: "ALM",        unit: "lb", decimals: 1, goodDirection: "up" },
  bodyFatPct:  { key: "bodyFatPct",  label: "Body fat",   unit: "%",  decimals: 1, goodDirection: "down" },
  bmd:         { key: "bmd",         label: "BMD",        unit: "g/cm²", decimals: 3, goodDirection: "up" },
};

const FULL_ORDER: MetricKey[] = [
  "totalMassLb",
  "fatMassLb",
  "leanMassLb",
  "armsLeanLb",
  "legsLeanLb",
  "almLb",
  "bodyFatPct",
  "bmd",
];

function fmtNum(n: number | undefined, decimals: number): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(decimals);
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface DeltaInfo {
  abs: number;
  pct: number | null;
  isUp: boolean;
  isZero: boolean;
  isGood: boolean | null;
}

function computeDelta(
  start: number | undefined,
  end: number | undefined,
  good: "up" | "down" | "neutral"
): DeltaInfo | null {
  if (start === undefined || end === undefined) return null;
  const abs = end - start;
  const pct = start !== 0 ? (abs / start) * 100 : null;
  const isZero = Math.abs(abs) < 0.05;
  const isUp = abs > 0;
  const isGood = good === "neutral" ? null : good === "up" ? isUp : !isUp;
  return { abs, pct, isUp, isZero, isGood };
}

function deltaColor(d: DeltaInfo | null): string {
  if (!d || d.isZero) return "var(--v1-ink-mute)";
  if (d.isGood === null) return "var(--v1-ink-soft)";
  return d.isGood ? "var(--v1-sage)" : "var(--v1-clay)";
}

export function V1ScanCard({
  participantName,
  participantColor,
  startScan,
  endScan,
  rank,
  scoring,
  onPreview,
}: {
  participantName: string;
  participantColor: string | null;
  startScan: ScanLite | null;
  endScan: ScanLite | null;
  rank: number | null;
  scoring: ScoringConfig;
  onPreview: (url: string, label: string) => void;
}) {
  const isWinner = rank === 1;

  return (
    <article
      className={cn(
        "v1-card p-4 sm:p-5 space-y-3 sm:space-y-4 transition-colors",
        isWinner && "border-[color:var(--v1-terracotta)]/40"
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ParticipantAvatar
            name={participantName}
            color={participantColor}
            size="md"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="v1-display text-[20px] leading-none font-medium truncate">
                {participantName}
              </h3>
              <V1RankBadge rank={rank} />
            </div>
            <p className="mt-1.5 text-[12px] text-[color:var(--v1-ink-mute)] v1-tnum">
              {fmtDate(startScan?.scanDate)} → {fmtDate(endScan?.scanDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(endScan?.pdfUrl || startScan?.pdfUrl) && (
            <PdfLink
              onClick={() =>
                onPreview(
                  (endScan?.pdfUrl ?? startScan?.pdfUrl)!,
                  `${participantName} · DEXA report`
                )
              }
              label="view dexa"
            />
          )}
        </div>
      </header>

      <div className="v1-rule-thin" />

      <table className="w-full text-[12.5px] sm:text-[13.5px]">
        <thead>
          <tr className="v1-smallcaps text-[11px] sm:text-[12px] text-[color:var(--v1-ink-mute)]">
            <th className="text-left font-normal pb-1.5"></th>
            <th className="text-right font-normal pb-1.5 pr-2 sm:pr-3">start</th>
            <th className="text-right font-normal pb-1.5 pr-2 sm:pr-3">end</th>
            <th className="text-right font-normal pb-1.5">change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--v1-rule-soft)]">
          {FULL_ORDER.map((k) => {
            const meta = METRICS[k];
            const startVal = startScan?.[k];
            const endVal = endScan?.[k];
            if (startVal === undefined && endVal === undefined) return null;
            const delta = computeDelta(startVal, endVal, meta.goodDirection);
            return (
              <tr key={k}>
                <td className="py-1.5 sm:py-2 v1-display-italic text-[color:var(--v1-ink-soft)]">
                  {meta.label}
                </td>
                <td className="py-1.5 sm:py-2 pr-2 sm:pr-3 text-right v1-tnum text-[color:var(--v1-ink-mute)]">
                  {fmtNum(startVal, meta.decimals)}
                  <span className="ml-0.5 sm:ml-1 text-[11px] sm:text-[12px] text-[color:var(--v1-ink-mute)]/70">
                    {meta.unit}
                  </span>
                </td>
                <td className="py-1.5 sm:py-2 pr-2 sm:pr-3 text-right v1-tnum text-[color:var(--v1-ink)]">
                  {fmtNum(endVal, meta.decimals)}
                  <span className="ml-0.5 sm:ml-1 text-[11px] sm:text-[12px] text-[color:var(--v1-ink-mute)]/70">
                    {meta.unit}
                  </span>
                </td>
                <td
                  className="py-1.5 sm:py-2 text-right v1-tnum"
                  style={{ color: deltaColor(delta) }}
                >
                  {delta && !delta.isZero ? (
                    <span className="inline-flex items-center justify-end gap-0.5">
                      {delta.isUp ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      <span>
                        {Math.abs(delta.abs).toFixed(meta.decimals)} {meta.unit}
                      </span>
                      {delta.pct !== null && (
                        <span className="ml-1 sm:ml-1.5 text-[11px] sm:text-[12.5px] text-[color:var(--v1-ink-mute)]">
                          ({delta.pct > 0 ? "+" : "−"}
                          {Math.abs(delta.pct).toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  ) : delta ? (
                    <span className="text-[color:var(--v1-ink-mute)]">no change</span>
                  ) : (
                    <span className="text-[color:var(--v1-ink-mute)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

    </article>
  );
}

function PdfLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="v1-smallcaps text-[12px] inline-flex items-center gap-1 text-[color:var(--v1-ink-mute)] hover:text-[color:var(--v1-terracotta)] transition-colors"
    >
      {label}
      <ExternalLink className="h-2.5 w-2.5" />
    </button>
  );
}
