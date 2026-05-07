import type { DashStats, ChallengeLite } from "@/lib/dashboard-data";

function fmtSigned(n: number, decimals = 1): string {
  if (Math.abs(n) < 0.05) return "0";
  return `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(decimals)}`;
}

interface Stat {
  value: string;
  label: string;
}

function shortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function V1StatStrip({
  stats,
  challenge,
}: {
  stats: DashStats;
  challenge: ChallengeLite;
}) {
  const challengerLabel =
    stats.totalCount === 1 ? "challenger" : "challengers";

  // No end-of-challenge scans yet → only useful stats are time-based.
  // Once end scans land, surface the group totals.
  const items: Stat[] = stats.hasEndScans
    ? [
        { value: `${stats.totalDays} days`, label: "duration" },
        {
          value: `${stats.groupFatLostLb.toFixed(1)} lb`,
          label: "fat shed",
        },
        {
          value: `${fmtSigned(stats.groupLeanChangeLb)} lb`,
          label: "net lean",
        },
        {
          value: `${stats.totalCount}`,
          label: challengerLabel,
        },
      ]
    : challenge.status === "upcoming"
      ? [
          {
            value: shortDate(challenge.startDate),
            label: "begins",
          },
          {
            value: `${stats.totalCount}`,
            label: challengerLabel,
          },
        ]
      : [
          {
            value: `Day ${stats.daysElapsed}`,
            label: `of ${stats.totalDays} · ${Math.round(
              (stats.daysElapsed / stats.totalDays) * 100
            )}% complete`,
          },
          {
            value: `${stats.totalCount}`,
            label: challengerLabel,
          },
        ];

  return (
    <section aria-label="Challenge at a glance" className="space-y-3">
      <div className="v1-rule-thin" />
      <div className="flex flex-wrap items-baseline gap-x-6 sm:gap-x-12 gap-y-3 px-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-baseline gap-2">
            <span className="v1-display text-[24px] sm:text-[30px] font-medium leading-none text-[color:var(--v1-ink)] v1-tnum">
              {it.value}
            </span>
            <span className="v1-display-italic text-[14px] sm:text-[16px] text-[color:var(--v1-ink-mute)]">
              {it.label}
            </span>
          </div>
        ))}
      </div>
      <div className="v1-rule-thin" />
    </section>
  );
}
