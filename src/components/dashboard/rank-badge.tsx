const ROMAN: Record<number, string> = { 1: "I", 2: "II", 3: "III" };

export function V1RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) return null;
  const roman = ROMAN[rank] ?? `${rank}`;
  const isWinner = rank === 1;
  return (
    <span
      className="v1-smallcaps text-[12.5px]"
      style={{
        color: isWinner ? "var(--v1-terracotta)" : "var(--v1-ink-mute)",
      }}
    >
      {roman}
    </span>
  );
}
