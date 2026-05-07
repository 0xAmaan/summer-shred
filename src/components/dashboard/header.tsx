import type { ChallengeLite, DashStats } from "@/lib/dashboard-data";

const STATUS_LABEL: Record<ChallengeLite["status"], string> = {
  upcoming: "Upcoming",
  active: "In progress",
  completed: "Concluded",
};

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function V1Header({
  challenge,
  stats,
}: {
  challenge: ChallengeLite;
  stats: DashStats;
}) {
  const challengerLabel =
    stats.totalCount === 1 ? "challenger" : "challengers";

  // Only the active state benefits from inline progress info — completed rounds
  // surface their summary stats in the strip below.
  const showLiveProgress = challenge.status === "active";
  const pct = Math.round((stats.daysElapsed / stats.totalDays) * 100);

  return (
    <header className="space-y-2.5 sm:space-y-3">
      <h1 className="v1-display text-[clamp(2rem,7vw,4.5rem)] font-medium leading-[1] sm:leading-[0.98] tracking-tight text-[color:var(--v1-ink)]">
        Summer Shred — Round {challenge.round}
      </h1>
      <p className="v1-display-italic text-[color:var(--v1-ink-soft)] text-[16px] sm:text-[20px] leading-snug">
        {fmtDate(challenge.startDate)} → {fmtDate(challenge.endDate)}
      </p>
      {stats.totalCount > 0 && (
        <p className="v1-display-italic text-[color:var(--v1-ink-mute)] text-[14px] sm:text-[17px] leading-snug">
          ${stats.totalCount * 100} prize pool
        </p>
      )}
      <div className="space-y-1.5 pt-1">
        <p
          className="v1-smallcaps text-[13px] sm:text-[15px]"
          style={{
            letterSpacing: "0.24em",
            color: "var(--v1-terracotta)",
          }}
        >
          {STATUS_LABEL[challenge.status]}
        </p>
        {showLiveProgress && (
          <p className="v1-display-italic text-[14px] sm:text-[17px] leading-snug text-[color:var(--v1-ink-soft)]">
            Day {stats.daysElapsed} of {stats.totalDays}{" "}
            <span className="text-[color:var(--v1-ink-mute)]">·</span> {pct}%
            complete{" "}
            <span className="text-[color:var(--v1-ink-mute)]">·</span>{" "}
            {stats.totalCount} {challengerLabel}
          </p>
        )}
      </div>
    </header>
  );
}
