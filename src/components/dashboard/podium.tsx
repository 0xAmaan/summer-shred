import { ParticipantAvatar } from "@/components/shared/avatar";
import type {
  BuilderLeader,
  DashRow,
  ChallengeLite,
  DashStats,
  WeighInLeader,
} from "@/lib/dashboard-data";

const ORDINAL = ["", "First", "Second", "Third"];

function fmtScore(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;
}

function headlineMetric(row: DashRow): string | null {
  const c = row.breakdown.contributions;
  if (c.length === 0) return null;
  const top = [...c].sort(
    (a, b) => Math.abs(b.signedPoints) - Math.abs(a.signedPoints)
  )[0];
  const map: Record<string, { name: string; sign: "down" | "up" }> = {
    "%FatLost": { name: "fat", sign: "down" },
    "%FatGained": { name: "fat", sign: "up" },
    "%LeanGained": { name: "lean", sign: "up" },
    "%LeanLost": { name: "lean", sign: "down" },
    "%ALMGained": { name: "ALM", sign: "up" },
    "%ALMLost": { name: "ALM", sign: "down" },
  };
  const meta = map[top.label];
  if (!meta) return null;
  const arrow = meta.sign === "up" ? "+" : "−";
  return `${arrow}${top.pct.toFixed(1)}% ${meta.name}`;
}

export function V1Podium({
  challenge,
  stats,
  leaderRow,
  weighInLeader,
  topRows,
}: {
  challenge: ChallengeLite;
  stats: DashStats;
  /** First-place row from the leaderboard, if scoring is settled. */
  leaderRow: DashRow | null;
  /** Best weight-loss leader from weigh-in data. Used as fallback for active. */
  weighInLeader: WeighInLeader | null;
  /** Top-3 fully-scorable rows for the completed-podium layout. */
  topRows: DashRow[];
}) {
  if (challenge.status === "upcoming") {
    return null;
  }

  if (challenge.status === "active") {
    // Render the live banner only if there's something to lead with.
    if (!leaderRow && !weighInLeader) {
      return <ActiveBareBanner stats={stats} />;
    }
    return (
      <V1ActiveBanner
        stats={stats}
        leaderRow={leaderRow}
        weighInLeader={weighInLeader}
      />
    );
  }

  // Completed podium — classic 2-1-3 layout (2nd | 1st-tallest | 3rd)
  if (topRows.length === 0) return null;
  // Reorder: index 0 = 2nd column (silver), index 1 = 1st column (winner), index 2 = 3rd column (bronze)
  const podiumOrder: Array<{ row: DashRow; place: 1 | 2 | 3 } | null> = [
    topRows[1] ? { row: topRows[1], place: 2 } : null,
    topRows[0] ? { row: topRows[0], place: 1 } : null,
    topRows[2] ? { row: topRows[2], place: 3 } : null,
  ];
  return (
    <section
      aria-label="Final standings"
      className="grid grid-cols-3 items-end gap-3 sm:gap-6 md:gap-10"
    >
      {podiumOrder.map((entry, i) => {
        if (!entry) return <div key={`empty-${i}`} aria-hidden />;
        const { row, place } = entry;
        const isWinner = place === 1;
        const headline = headlineMetric(row);
        return (
          <article
            key={row.challengeParticipantId}
            className={
              "flex flex-col items-center text-center " +
              (isWinner
                ? "space-y-2 sm:space-y-3 md:space-y-4"
                : "space-y-1.5 sm:space-y-2 md:space-y-3 pb-2 sm:pb-4 md:pb-6")
            }
          >
            <span
              className={
                "v1-smallcaps " +
                (isWinner
                  ? "text-[11px] sm:text-[13px] md:text-[14px]"
                  : "text-[10px] sm:text-[12px] md:text-[13px]")
              }
              style={{
                color: isWinner ? "var(--v1-terracotta)" : "var(--v1-ink-mute)",
              }}
            >
              {ORDINAL[place]}
            </span>
            <div className="flex flex-col items-center gap-1.5 sm:gap-2 md:gap-3">
              <ParticipantAvatar
                name={row.participantName}
                color={row.participantColor}
                size={isWinner ? "lg" : "md"}
              />
              <div className="flex flex-col items-center gap-1">
                <h3
                  className={
                    "v1-display leading-none font-medium text-[color:var(--v1-ink)] " +
                    (isWinner
                      ? "text-[16px] sm:text-[22px] md:text-[28px]"
                      : "text-[13px] sm:text-[18px] md:text-[22px]")
                  }
                >
                  {row.participantName}
                </h3>
                {isWinner && (
                  <div
                    className="h-px w-10 md:w-12"
                    style={{ background: "var(--v1-terracotta)" }}
                  />
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5 sm:gap-1">
              <p
                className={
                  "v1-display v1-onum font-medium leading-none " +
                  (isWinner
                    ? "text-[34px] sm:text-[52px] md:text-[64px]"
                    : "text-[24px] sm:text-[40px] md:text-[48px]")
                }
                style={{
                  color: isWinner
                    ? "var(--v1-terracotta)"
                    : "var(--v1-ink)",
                }}
              >
                {fmtScore(row.score)}
              </p>
              {headline && (
                <p className="hidden sm:block v1-display-italic text-[13px] md:text-[15px] text-[color:var(--v1-ink-soft)]">
                  driven by {headline}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function V1BuilderCallout({
  builder,
  challenge,
}: {
  builder: BuilderLeader;
  challenge: ChallengeLite;
}) {
  const metricLabel = builder.mode === "alm" ? "ALM" : "lean";
  const sign = builder.changePct >= 0 ? "+" : "−";
  const lossOnly = builder.changePct < 0;
  const headline =
    challenge.status === "completed"
      ? "The Builder"
      : "Currently the Builder";
  const prize = challenge.prizes?.builderUsd;
  return (
    <section
      aria-label="The Builder"
      className="flex items-center gap-4 rounded-sm border border-[color:var(--v1-ink-mute)]/15 bg-[color:var(--v1-cream-deep)]/40 px-5 py-4"
    >
      <ParticipantAvatar
        name={builder.participantName}
        color={builder.participantColor}
        size="md"
      />
      <div className="flex-1 space-y-1">
        <p className="v1-smallcaps text-[12px]">
          {headline}
          {prize ? ` · $${prize} prize` : ""}
        </p>
        <p className="v1-display text-[22px] leading-none font-medium">
          {builder.participantName}
        </p>
        <p className="v1-display-italic text-[14px] text-[color:var(--v1-ink-soft)]">
          {sign}
          {Math.abs(builder.changePct).toFixed(1)}% {metricLabel}
          {lossOnly ? " (smallest loss)" : " gained"}
        </p>
      </div>
    </section>
  );
}

function ActiveBareBanner({ stats: _stats }: { stats: DashStats }) {
  // No leaderboard score and no weigh-in data — render nothing; the stat strip
  // already shows day count + progress bar.
  return null;
}

function V1ActiveBanner({
  stats: _stats,
  leaderRow,
  weighInLeader,
}: {
  stats: DashStats;
  leaderRow: DashRow | null;
  weighInLeader: WeighInLeader | null;
}) {
  return (
    <section aria-label="Currently leading" className="space-y-3 py-2">
      <p className="v1-smallcaps text-[14px]">Currently leading</p>
      {leaderRow ? (
        <div className="flex items-center gap-4">
          <ParticipantAvatar
            name={leaderRow.participantName}
            color={leaderRow.participantColor}
            size="lg"
          />
          <div className="space-y-1">
            <p className="v1-display text-[40px] leading-none font-medium">
              {leaderRow.participantName}
            </p>
            <p className="v1-display-italic text-[18px] text-[color:var(--v1-ink-soft)]">
              {fmtScore(leaderRow.score)} points
            </p>
          </div>
        </div>
      ) : weighInLeader ? (
        <div className="flex items-center gap-4">
          <ParticipantAvatar
            name={weighInLeader.participantName}
            color={weighInLeader.participantColor}
            size="lg"
          />
          <div className="space-y-1">
            <p className="v1-display text-[40px] leading-none font-medium">
              {weighInLeader.participantName}
            </p>
            <p className="v1-display-italic text-[18px] text-[color:var(--v1-ink-soft)]">
              {weighInLeader.changeLb >= 0 ? "+" : "−"}
              {Math.abs(weighInLeader.changeLb).toFixed(1)} lb since week 1 ·{" "}
              currently {weighInLeader.latestLb.toFixed(1)} lb
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
