import { ParticipantAvatar } from "@/components/shared/avatar";
import type {
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

  // Completed podium
  if (topRows.length === 0) return null;
  return (
    <section aria-label="Final standings" className="grid gap-10 md:grid-cols-3">
      {topRows.map((row, i) => {
        const place = (i + 1) as 1 | 2 | 3;
        const isWinner = place === 1;
        const headline = headlineMetric(row);
        return (
          <article
            key={row.challengeParticipantId}
            className="flex flex-col items-start text-left space-y-4"
          >
            <span
              className="v1-smallcaps text-[14px]"
              style={{
                color: isWinner ? "var(--v1-terracotta)" : "var(--v1-ink-mute)",
              }}
            >
              {ORDINAL[place]} place
            </span>
            <div className="flex items-center gap-3">
              <ParticipantAvatar
                name={row.participantName}
                color={row.participantColor}
                size="lg"
              />
              <div className="space-y-1.5">
                <h3 className="v1-display text-[28px] leading-none font-medium text-[color:var(--v1-ink)]">
                  {row.participantName}
                </h3>
                {isWinner && (
                  <div
                    className="h-px w-12"
                    style={{ background: "var(--v1-terracotta)" }}
                  />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p
                className="v1-display v1-onum text-[64px] font-medium leading-none"
                style={{
                  color: isWinner
                    ? "var(--v1-terracotta)"
                    : "var(--v1-ink)",
                }}
              >
                {fmtScore(row.score)}
              </p>
              {headline && (
                <p className="v1-display-italic text-[15px] text-[color:var(--v1-ink-soft)]">
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
